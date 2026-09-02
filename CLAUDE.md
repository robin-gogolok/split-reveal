# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file is committed and public. Never put secrets, tokens, credentials,
internal URLs, host paths, or anything else here that must not appear in a
public repository. Keep it to architecture and commands.

## Commands

```sh
npm run build          # minify src/ CSS into dist/, emit dist/types/, generate demo/index.html
npm test               # unit + types + browser
npm run test:unit      # node --test test/*.test.js
npm run test:types     # tsc -p test/types/tsconfig.json
npm run test:browser   # playwright; starts scripts/serve.js on :4517 itself
npm run serve          # static server on :4517, serves the repo root
```

Single tests:

```sh
node --test test/split.test.js
node --test --test-name-pattern='counts characters' test/split.test.js
npx playwright test -g 'rise brings characters home'
```

`test:types` needs `npm run build` first: it compiles `test/types/usage.ts`,
which imports `split-reveal` by name and so resolves through the `exports` map
into `dist/types/`.

`npm run build` is a prerequisite for `test:browser`: the Playwright fixture is
`demo/index.html`, which is generated and gitignored.

The test port is 4517, not Vite's 4173. Playwright reuses whatever already
answers on the port, so a forgotten server from a sibling repo would silently
serve its own pages. The readiness check hits `dist/split-reveal.css` for that
reason: a foreign server 404s there and the port clash fails loudly instead.

## Architecture

The library is a build-time text splitter plus a stylesheet. No JavaScript from
`src/split.js` is ever meant to reach the browser; the only runtime module is the
opt-in `src/fallback.js`.

### The contract between the two source files

`src/split.js` emits markup and custom properties that `src/split-reveal.css`
consumes. Nothing enforces this coupling, so a rename in one file must be
mirrored in the other, in `integrations/astro/SplitReveal.astro`, and in the
README's React example. Only the *option names* are enforced now, because the
Astro props extend `SplitOptions`; class names and custom properties are still
strings on both sides and drift silently:

| Emitted by `split.js` | Consumed by `split-reveal.css` |
|---|---|
| `data-split-reveal="rise\|fade"` on the wrapper | mode selectors |
| `--split-start`, `--split-end`, `--split-step` on the wrapper | `animation-range` |
| `--split-i` per character | the per-character range offset |
| `.split-word`, `.split-char` | mask and animation targets |
| `.split-a11y` | visually-hidden original string |

### Why the stagger is a range shift, not a delay

A `view()` timeline has no time, so `animation-delay` resolves every character to
the same frame. Each character instead runs the same range, offset by
`--split-i * --split-step`.

The timeline sits on `.split-char`, so each character is its own subject and its
`cover` range is `viewport height + line height` long. The block's height is not
in it. Two things follow that are easy to get wrong: a character always lands at
the same height on screen whatever line it is on, which is what makes a
paragraph read as one wave rather than as a stack of separate ones; and the
scroll room a block needs below it does not grow with the block. Verified by
measurement, not by reading the spec: `(B + h) / (V + h)` is the progress the
last character reaches at the end of the document, with `h` the line height, and
the same figure computed with the block height is wrong by a third. `--split-step` is derived from `spread / (count - 1)`
in `splitText`, never hand-written, which is what keeps a short headline and a
long paragraph finishing over the same share of their own scroll. Changing this
to a delay would silently break the whole effect.

The caller can write the step instead, with the `step` option, and the two are
mutually exclusive on purpose: they describe the same stagger from opposite
ends, so honouring one silently reads as "my spread does nothing". The trade is
worth knowing before touching either default. A derived step gets finer as the
copy grows, so past roughly sixty characters `(end - start) / step` exceeds the
character count and the whole block is in flight at once, which is why long
paragraphs blur where headlines snap. A written step keeps that number fixed
and lets the run grow instead. Neither is the correct one.

To debug a range, read the progress an element actually reaches:
`document.querySelector('.split-char').getAnimations()[0].timeline.currentTime.value`
gives the cover progress in percent. Compare it against `end + spread`, the point
where the last character lands.

### Deliberate details that look like mistakes

- **No object spread for options.** `splitText` copies defaults and skips
  `undefined` values in a loop, because framework wrappers pass every prop
  through whether set or not. Test: `treats an explicit undefined option as absent`.
  The `Record<string, unknown>` cast on the assignment is what makes that loop
  survive `checkJs`; narrowing the key to `keyof SplitOptions` instead widens
  the value to a union that fits no slot.
- **`typesVersions` in `package.json`.** The `exports` map already carries a
  `types` condition, but the legacy `moduleResolution: node` setting ignores
  `exports` entirely, so `split-reveal/fallback` resolves to no types there.
  The top-level `types` field covers the root import; `typesVersions` covers
  the subpath.
- **No whitespace between the two spans in `toHTML()`.** The split copy is
  absolutely positioned; a text node beside it renders as a leading indent.
- **`clip-path`, not `overflow: hidden`, on `.split-word`.** An overflowing
  inline-block moves its baseline to the bottom margin edge and drops the word
  out of the line. Guarded by the `splitting does not move the copy` browser test.
- **`fade` hides with `visibility`, not `opacity`.** Safari does not reliably
  invalidate a scroll-driven opacity animation across many small inline boxes:
  scrolling back up leaves characters painted that the computed style already
  reports as gone, and it gets worse the faster the scroll. Ruled out as causes:
  the character count (23 is enough), `display: inline` (`inline-block` fails
  too), `steps()`, the fill mode, and forcing a layer with `will-change`,
  `contain: paint` or `translateZ(0)`. `rise` is unaffected because it animates
  `transform`. `color: transparent` also fixes it but breaks text with a shadow,
  a stroke or `background-clip: text`. Guarded by the browser test `fade
  switches characters without a partial state`, which fails if this returns to
  opacity.
- **Animation longhands, not the `animation` shorthand, on `.split-char`.** The
  timing function now comes from `var(--split-ease)`, and a `var()` that does
  not parse is invalid at computed-value time. In the shorthand that takes
  `both` down with it, so one mistyped ease would park every character at its
  resting transform and kill the block silently. Guarded by the browser test
  `--split-ease shapes the travel, and a bad one costs only the easing`. Its
  bad value has three control points rather than four for a reason: a bare word
  would not fail there, because the shorthand reads an unknown keyword as an
  `animation-name` and stays valid.
- **Graphemes, not code points.** `Intl.Segmenter` keeps combining marks and flag
  emoji intact where `Array.from` would tear them apart.
- **`rise` sets `white-space: nowrap` on the word**, so hyphenation is off for
  that mode. Check headline copy at 375px; use `fade` for body text.
- **The demo's `70vh` footer padding.** A `cover` range only completes once the
  character has travelled a viewport past its own top edge, and at the document
  end the scroll runs out first. Everything below a block has to be taller than
  `end + spread` percent of the viewport, or its closing characters never
  arrive. That is 50% for the last demo section, which writes a `step`; the
  `spread: 38` section before it wants 72% and has the whole last section
  below it to give. Guarded by the browser test `every block finishes by the
  end of the page`.
- **The README's CDN URLs pin `@0`, not an exact version.** The no-build section
  would otherwise need an edit in every release.

### Generated and committed files

- `dist/split-reveal.css` and `dist/types/*.d.ts` are **committed** so the
  package installs straight from git. The `dist-is-current` CI job runs
  `git diff --exit-code -- dist/`, so any edit to `src/split-reveal.css` or to
  a JSDoc annotation must be followed by `npm run build` and a commit of
  `dist/`.
- `dist/types/` is generated from the JSDoc by `scripts/build-types.js`, which
  wipes the directory first so a deleted export cannot leave a stale
  declaration that the CI job would then happily keep.
- `demo/index.html` and `demo/split-reveal.css` are gitignored build output.
  `demo/build.js` renders the demo through the public API, so it doubles as the
  integration test for `splitText`. Add new API surface to a demo section and it
  gets exercised by the browser tests.

## Conventions

- Node ESM, no TypeScript source. The JSDoc in `src/` is the only type source:
  `tsconfig.json` has `checkJs` on, so a wrong annotation fails `npm run build`,
  and `tsc` reads the same annotations back out into `dist/types/`. Never
  hand-edit a `.d.ts`; fix the JSDoc and rebuild.
- Every `@typedef` in `src/split.js` becomes an exported type, so naming one is
  a public API decision. Renaming or removing one is a breaking change.
- Zero runtime dependencies is a hard constraint, not a preference. `esbuild` and
  `@playwright/test` are dev-only.
- All CSS lives inside `@layer split-reveal`, so consumer CSS wins without
  `!important`. Do not add rules outside the layer.
- Comments in this codebase explain *why* a non-obvious choice was made. Match
  that when touching the CSS or the animation math.
- Accessibility invariants have tests: the split copy stays `aria-hidden`, the
  original string stays in `.split-a11y`, and nothing animates under
  `prefers-reduced-motion: reduce`.
- Browser tests run against the generated demo. A count of "still broken"
  elements passes on a page that has none, so assert the fixture was found
  before asserting that nothing is wrong with it.

## Release

Tag `vX.Y.Z` matching `package.json`; `release.yml` publishes via npm OIDC
trusted publishing (no token; the publisher is configured, nothing manual is
left). Bump with `npm version X.Y.Z --no-git-tag-version` so `package-lock.json`
moves with it. The workflow fails if tag and version disagree,
and skips publishing a version already on the registry. Update `CHANGELOG.md`
(Keep a Changelog format) as part of the change, not afterwards.
