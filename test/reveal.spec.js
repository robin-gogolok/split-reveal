import { test, expect } from '@playwright/test';

const DEMO = '/demo/index.html';

/**
 * Park an element at a given fraction of the viewport and wait for the styles
 * to settle. Scroll-driven animations resolve on the next frame, so waiting on
 * frames rather than a timeout keeps this stable under parallel workers.
 */
async function scrollTo(page, selector, fraction) {
  await page.evaluate(
    ([sel, f]) => {
      const el = document.querySelector(sel);
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * f);
      return new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    },
    [selector, fraction],
  );
}

test.describe('scroll-linked reveal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO);
    await page.evaluate(() => document.fonts.ready);
  });

  test('rise brings characters home as the scroll advances', async ({ page }) => {
    const atRest = async () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#rise .split-char')].filter(
          (c) => new DOMMatrix(getComputedStyle(c).transform).m42 < 0.5,
        ).length,
      );

    await scrollTo(page, '#rise .display', 0.9);
    const early = await atRest();
    await scrollTo(page, '#rise .display', 0.6);
    const mid = await atRest();
    await scrollTo(page, '#rise .display', 0.2);
    const late = await atRest();

    expect(early).toBe(0);
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(mid);
  });

  test('--split-ease shapes the travel, and a bad one costs only the easing', async ({ page }) => {
    // The second half is why the character rule uses animation longhands. In
    // the `animation` shorthand a `var()` that does not parse is invalid at
    // computed-value time, which takes `both` down with it: every character
    // then sits at its resting transform for the whole scroll and the block
    // silently stops animating. Three control points rather than four is the
    // typo that gets you there; a bare word would not, since the shorthand
    // reads an unknown keyword as an animation-name and stays valid.
    const eased = await page.evaluate(
      () => getComputedStyle(document.querySelector('#step .split-char')).animationTimingFunction,
    );
    expect(eased).toBe('cubic-bezier(0.33, 0.67, 0.67, 1)');

    await page.evaluate(() => {
      const bad = 'cubic-bezier(.33,.67,.67)';
      document.querySelector('#rise .display').style.setProperty('--split-ease', bad);
    });
    await scrollTo(page, '#rise .display', 0.9);
    const broken = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('#rise .split-char'));
      return { fill: style.animationFillMode, offset: new DOMMatrix(style.transform).m42 };
    });

    expect(broken.fill).toBe('both');
    expect(broken.offset).toBeGreaterThan(0.5);
  });

  test('fade switches characters without a partial state', async ({ page }) => {
    // Three things at once. Nothing may sit at a partial opacity, which is what
    // returning this mode to an opacity animation would reintroduce along with
    // the Safari repaint fault. Nothing may sit at a visibility other than the
    // two discrete ends. And somewhere mid-scroll the reveal has to be part-way
    // through, or the stagger is gone and every character switches on one frame.
    let sawPartway = false;
    for (const fraction of [0.85, 0.62, 0.45, 0.2]) {
      await scrollTo(page, '#fade .lede', fraction);
      const state = await page.evaluate(() => {
        const styles = [...document.querySelectorAll('#fade .split-char')].map((c) =>
          getComputedStyle(c),
        );
        return {
          total: styles.length,
          partial: styles.filter((s) => Number(s.opacity) > 0.01 && Number(s.opacity) < 0.99)
            .length,
          neither: styles.filter((s) => s.visibility !== 'hidden' && s.visibility !== 'visible')
            .length,
          shown: styles.filter((s) => s.visibility === 'visible').length,
        };
      });

      expect(state.total, `characters found at ${fraction}`).toBeGreaterThan(0);
      expect(state.partial, `partial opacity at ${fraction}`).toBe(0);
      expect(state.neither, `neither hidden nor visible at ${fraction}`).toBe(0);
      if (state.shown > 0 && state.shown < state.total) sawPartway = true;
    }
    expect(sawPartway, 'a scroll position with the reveal part-way through').toBe(true);
  });

  test('splitting does not move the copy', async ({ page }) => {
    // clip-path masks visually; overflow:hidden would drop the inline-block's
    // baseline and change the box. This is the regression guard for that.
    const delta = await page.evaluate(() => {
      const split = document.querySelector('#rise .display');
      const plain = document.createElement('h2');
      plain.className = split.className;
      plain.textContent = split.querySelector('.split-a11y').textContent;
      split.after(plain);
      const a = split.getBoundingClientRect();
      const b = plain.getBoundingClientRect();
      const result = { height: a.height - b.height, width: a.width - b.width };
      plain.remove();
      return result;
    });

    expect(Math.abs(delta.height)).toBeLessThan(0.5);
    expect(Math.abs(delta.width)).toBeLessThan(0.5);
  });

  test('every block finishes by the end of the page', async ({ page }) => {
    // A cover range only completes once the element has travelled a viewport
    // past its own top edge, and at the document end the scroll runs out
    // first. The last block therefore needs more than `end + spread` percent
    // of the viewport height below it, which is what the demo's tall tail is
    // for. Without it the closing characters of the last section never arrive.
    for (const height of [700, 900, 1200]) {
      await page.setViewportSize({ width: 1280, height });
      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        return new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      });

      const { total, unrevealed } = await page.evaluate(() => {
        const chars = [...document.querySelectorAll('.split-char')];
        return {
          total: chars.length,
          unrevealed: chars.filter((c) => {
            const style = getComputedStyle(c);
            const lifted =
              style.transform !== 'none' && new DOMMatrix(style.transform).m42 > 0.5;
            // fade hides with visibility, rise with transform. Miss either and
            // this counts a half-finished block as done.
            return style.visibility === 'hidden' || Number(style.opacity) < 0.99 || lifted;
          }).length,
        };
      });

      // Counting what is still hidden passes trivially on a page with no
      // characters at all, which is what a foreign server on the port serves
      // up when Playwright reuses it. Assert the fixture is really there.
      expect(total, `characters found at ${height}px tall`).toBeGreaterThan(0);
      expect(unrevealed, `unrevealed characters at ${height}px tall`).toBe(0);
    }
  });

  test("a character's cover range is the viewport plus its own line, not its block", async ({
    page,
  }) => {
    // What the README's `(B + h) / (V + h)` rests on. `animation-timeline:
    // view()` sits on `.split-char`, so every character is its own timeline
    // subject and the height of the block never enters its range. Measured as
    // a slope, from how far the page scrolls while the progress moves a
    // hundred points, because that is independent of where the range starts
    // and of the rounding in scrollHeight.
    await page.setViewportSize({ width: 1280, height: 800 });
    const measured = await page.evaluate(async () => {
      const settle = () =>
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const char = document.querySelector('#step .split-char');
      const timeline = char.getAnimations()[0].timeline;
      const y = char.getBoundingClientRect().top + window.scrollY;

      window.scrollTo(0, y - 700);
      await settle();
      const near = timeline.currentTime.value;
      window.scrollTo(0, y - 500);
      await settle();
      const far = timeline.currentTime.value;

      return {
        rangePx: 200 / ((far - near) / 100),
        viewport: window.innerHeight,
        charHeight: char.getBoundingClientRect().height,
        blockHeight: document.querySelector('#step [data-split-reveal]').getBoundingClientRect()
          .height,
      };
    });

    // On one line the two candidates coincide and the rest asserts nothing.
    expect(measured.blockHeight, 'the fixture spans more than one line').toBeGreaterThan(
      measured.charHeight * 2,
    );
    expect(measured.rangePx).toBeGreaterThan(measured.viewport + measured.charHeight - 2);
    expect(measured.rangePx).toBeLessThan(measured.viewport + measured.charHeight + 2);
  });

  test('the page never scrolls sideways', async ({ page }) => {
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow at ${width}px`).toBe(0);
    }
  });
});

test.describe('accessibility', () => {
  test('assistive tech reads the sentence, not the letters', async ({ page }) => {
    await page.goto(DEMO);
    await expect(
      page.getByRole('heading', { name: 'Scroll is the timeline, not the trigger.' }),
    ).toBeVisible();
  });

  test('the split copy is hidden from the accessibility tree', async ({ page }) => {
    await page.goto(DEMO);
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll('.split-char')].every(
        (c) => c.closest('[aria-hidden="true"]') !== null,
      ),
    );
    expect(hidden).toBe(true);
  });
});

test.describe('reduced motion', () => {
  test('renders plain, unanimated copy', async ({ page }) => {
    // Emulated on the page rather than through the fixture, so the assertion
    // fails loudly if the media query stops being honoured.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(DEMO);
    expect(
      await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    ).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    const state = await page.evaluate(() => {
      const chars = [...document.querySelectorAll('#fade .split-char')];
      return {
        animations: chars.filter((c) => getComputedStyle(c).animationName !== 'none').length,
        hidden: chars.filter((c) => {
          const style = getComputedStyle(c);
          return Number(style.opacity) < 0.99 || style.visibility === 'hidden';
        }).length,
      };
    });
    expect(state.animations).toBe(0);
    expect(state.hidden).toBe(0);
  });
});
