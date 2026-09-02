/**
 * Renders demo/index.html using the library itself, so the demo is also the
 * integration test for the public API and can never drift from it.
 */
import { copyFile, writeFile } from 'node:fs/promises';
import { splitText } from '../src/split.js';

const out = new URL('index.html', import.meta.url);
await copyFile(new URL('../dist/split-reveal.css', import.meta.url), new URL('split-reveal.css', import.meta.url));

/**
 * @param {string} tag
 * @param {string} className
 * @param {string} text
 * @param {import('../src/split.js').SplitOptions} [options]
 */
const block = (tag, className, text, options) =>
  splitText(text, options).toElement(tag, { class: className });

const sections = [
  {
    id: 'rise',
    label: 'mode: rise',
    note: 'The word is masked, the characters are lifted into it. For headlines.',
    html: block('h2', 'display', 'Scroll is the timeline, not the trigger.'),
  },
  {
    id: 'rise-long',
    label: 'mode: rise, two lines',
    note: 'The stagger runs across the whole element, so later lines are still arriving while the first has landed.',
    html: block('h2', 'display', 'Every character runs the same length of scroll, offset by its own index.'),
  },
  {
    id: 'nudge',
    label: 'mode: nudge, --split-travel: 0.3em',
    note: 'Hides with <code>visibility</code> instead of a mask, which is what frees the distance. In <code>rise</code> above, the travel is not a setting but a condition: the character has to clear the word mask or a sliver of it stands in the line the whole way, and that floors it at the glyph\u2019s own height, about 1.36em. Here it is 0.3em. Same box per character as <code>rise</code>, so hyphenation is off in this mode too.',
    html: splitText('The distance is a setting, not a condition.', { mode: 'nudge' }).toElement(
      'h2',
      { class: 'display', style: '--split-travel:0.3em' },
    ),
  },
  {
    id: 'fade',
    label: 'mode: fade',
    note: 'Stepped, not faded: a character is either set or absent, never half transparent. Stays fully inline, so hyphenation and line breaking are untouched.',
    html: block('p', 'lede', 'A scroll timeline has no time. Forty animation delays would all resolve to the same frame, so the stagger has to be a shift of the range instead.', { mode: 'fade' }),
  },
  {
    id: 'fade-long',
    label: 'mode: fade, spread 38',
    note: 'spread is held constant while the per-character step is derived from it, so a short headline and a long paragraph finish over the same share of their own scroll.',
    html: block('p', 'body', 'The split happens while the page renders. Nothing measures the DOM at runtime, which is also why a resize, a rotation or a late font swap can never invalidate it: there is no measurement to invalidate.', { mode: 'fade', spread: 38 }),
  },
  {
    id: 'step',
    label: 'mode: rise, step 0.25, eased',
    note: 'The other trade. <code>step</code> writes the per-character distance instead of deriving it from <code>spread</code>, so the stagger keeps its density however long the copy gets: <code>(end - start) / step</code> characters are ever in flight, 40 here rather than all 127. <code>--split-ease</code> shapes that travel, here with the quadratic ease-out a tweening library would apply without being asked.',
    // Set through the style attribute rather than a rule, which also keeps
    // `toElement`'s style merging on the demo's exercised path.
    html: splitText(
      'A written step keeps the same handful of characters in flight from the first word to the last, so a long paragraph still reads as a wave running through it.',
      { start: 8, end: 18, step: 0.25 },
    ).toElement('p', { class: 'lede', style: '--split-ease:cubic-bezier(.33,.67,.67,1)' }),
  },
];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>split-reveal</title>
<meta name="description" content="Scroll-linked per-character text reveal in CSS. Build-time splitting, zero runtime dependencies.">
<link rel="stylesheet" href="./split-reveal.css">
<style>
  :root {
    color-scheme: light dark;
    --bg: #fbfbfa;
    --fg: #16161a;
    --muted: #6f6f78;
    --rule: #e2e2df;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0d0d0e; --fg: #f3f1ed; --muted: #8a8578; --rule: #24242a; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 62rem; margin: 0 auto; padding: 0 1.5rem; }
  header { padding: 22vh 0 12vh; }
  h1 { font-size: clamp(2.5rem, 8vw, 5rem); line-height: 0.95; letter-spacing: -0.03em; margin: 0 0 1.5rem; }
  .tagline { font-size: clamp(1.05rem, 2.4vw, 1.35rem); color: var(--muted); max-width: 34em; margin: 0 0 2rem; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
  pre {
    background: color-mix(in srgb, var(--fg) 5%, transparent);
    border: 1px solid var(--rule);
    border-radius: 10px;
    padding: 1rem 1.15rem;
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85rem;
    line-height: 1.7;
  }
  section { padding: 40vh 0 6vh; border-top: 1px solid var(--rule); }
  section:first-of-type { border-top: 0; }
  .label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--muted); margin: 0 0 1.25rem;
  }
  .note { color: var(--muted); max-width: 40em; margin: 1.5rem 0 0; font-size: 0.95rem; }
  .display { font-size: clamp(2rem, 6vw, 4rem); line-height: 1.02; letter-spacing: -0.025em; margin: 0; font-weight: 800; }
  .lede { font-size: clamp(1.15rem, 2.6vw, 1.6rem); line-height: 1.45; margin: 0; max-width: 22em; }
  .body { font-size: 1.05rem; margin: 0; max-width: 34em; }
  /* The tail is this tall on purpose. A view() timeline runs on geometry, so
     the cover range of a block only completes once the block has travelled a
     viewport past its own top edge, and at the document end the scroll runs
     out first. The last section writes a step and finishes at
     end + step * (count - 1) = 50% of cover, so everything below it has to be
     taller than that share of the viewport or its closing characters never
     arrive. The fade section above it wants 72% and has this whole tail plus
     the last section to give. Guarded by the browser test
     "every block finishes by the end of the page". */
  footer { padding: 70vh 0 8vh; color: var(--muted); font-size: 0.9rem; border-top: 1px solid var(--rule); }
  a { color: inherit; }
  .support {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem; padding: 0.5rem 0.75rem; border: 1px solid var(--rule);
    border-radius: 999px; display: inline-block; color: var(--muted);
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>split-reveal</h1>
    <p class="tagline">Scroll-linked per-character text reveal, in CSS. The split runs at build time, so nothing ships to the browser but markup and a stylesheet.</p>
    <p class="support" data-support>checking support…</p>
    <pre><code>npm i split-reveal</code></pre>
  </header>

${sections
  .map(
    (s) => `  <section id="${s.id}">
    <p class="label">${s.label}</p>
    ${s.html}
    <p class="note">${s.note}</p>
  </section>`,
  )
  .join('\n\n')}

  <footer>
    <p>MIT · <a href="https://github.com/robin-gogolok/split-reveal">github.com/robin-gogolok/split-reveal</a></p>
  </footer>
</div>

<script type="module">
  const el = document.querySelector('[data-support]');
  const supported = CSS.supports('animation-timeline: view()');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  el.textContent = reduced
    ? 'prefers-reduced-motion: reduce — animation off by design'
    : supported
      ? 'animation-timeline: view() supported — scroll to see it'
      : 'no animation-timeline: view() here — loading the optional fallback';

  if (!supported && !reduced) await import('../src/fallback.js');
</script>
</body>
</html>
`;

await writeFile(out, html);
console.log(`demo/index.html  ${html.length} B`);
