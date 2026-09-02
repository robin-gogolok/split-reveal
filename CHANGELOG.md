# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the version is below `1.0.0` the API may still change in a minor release.

## [Unreleased]

## [0.4.0] - 2026-09-03

### Added

- `nudge` mode, where the distance a character travels is a setting rather than
  a consequence. In `rise` it is neither: the character hides behind the word's
  mask, so it has to clear that mask's lower edge, which floors the travel at
  the glyph's own height, around 1.36em, or 67px at a 2.5rem headline. No
  combination of `line-height` and bleed gets under it. `nudge` hides with
  `visibility` instead, which uncouples the concealment from the geometry, and
  `--split-travel` then sets the distance, 0.25em by default; a negative value
  brings the character down from above. It keeps the box per character that
  `rise` needs for `transform`, so hyphenation is off in this mode too.
- `--split-travel` custom property, read by `nudge` only.

## [0.3.0] - 2026-09-03

### Added

- `step` option on `splitText`: the scroll distance from one character to the
  next, written rather than derived from `spread`. `spread` divides a fixed run
  by the character count, so the longer the copy the finer the step, and past
  roughly sixty characters every character in the block is moving at once and
  the wave blurs into the paragraph. `step` instead holds `(end - start) / step`
  characters in flight whatever the length, at the cost of a run that grows with
  the copy. The two describe the same stagger, so passing both throws rather
  than honouring one in silence.
- `--split-ease` custom property, the timing function of one character's own
  travel. Default `linear`, so nothing moves differently than before. `fade`
  ignores it: a single step has nothing to interpolate.

### Changed

- The per-character rule sets `animation-fill-mode` and
  `animation-timing-function` as longhands rather than through the `animation`
  shorthand. A `var()` that does not parse is invalid at computed-value time,
  and in the shorthand that would drop `both` along with the easing, parking
  every character at its resting position for the whole scroll.

### Fixed

- The scroll-room formula in the README was computed from the height of the
  block, `(B + H) / (V + H)`. The timeline sits on the character, so the range
  is `viewport height + line height` long and the block's height is not in it;
  the figure is `(B + h) / (V + h)`, around a third lower for a multi-line
  block. The rule of thumb it fed, `end + spread` percent of the viewport
  height below the block, was right all along and is unchanged. It now also
  reads as what it is: the same figure whatever the block's height, where the
  old formula implied a tall block needed less room below it. Guarded by the
  browser test `the scroll-room formula in the README matches what the last
  character reaches`.

## [0.2.1] - 2026-09-01

### Fixed

- `fade` left characters painted on screen in Safari when scrolling back up,
  the more of them the faster the scroll. Safari does not reliably invalidate a
  scroll-driven `opacity` animation across many small inline boxes: the computed
  style reported the characters as gone while the pixels stayed. The mode now
  hides with `visibility`, which is discrete anyway, given the `steps(1)` this
  mode has always used, and leaves colour, `text-shadow` and
  `background-clip: text` untouched. `rise` was never affected; it animates
  `transform`.

### Changed

- The accessibility notes no longer claim that everything animated is
  compositor-only. `visibility` is not, though being discrete it costs one paint
  per character across the whole scroll rather than a value interpolated every
  frame.
- 728 B gzipped CSS, up from 715 B.

## [0.2.0] - 2026-09-01

### Added

- TypeScript declarations. They are generated from the JSDoc in `src/` into
  `dist/types/` and committed next to `dist/split-reveal.css`, so the types are
  there whether the package comes from npm or straight from git. `SplitMode`,
  `SplitOptions`, `SplitChar`, `SplitWordToken`, `SplitSpaceToken`,
  `SplitToken`, `SplitAttributes` and `ElementAttributes` are exported as types
  alongside the `SplitResult` class, and the token tree is a discriminated
  union, so narrowing on `type` is what hands you `chars`.
- Resolution is covered under `nodenext`, `bundler` and the legacy `node`
  setting, the last one through `typesVersions` for the `fallback` subpath.

### Changed

- The Astro component's `Props` extends `SplitOptions` rather than restating
  `mode`, `start`, `end` and `spread`, so the two cannot drift apart.

## [0.1.1] - 2026-09-01

### Added

- README section for pages with no build step at all. The split can run in the
  browser off the CDN build, which trades the zero-JavaScript property for
  needing no tooling, or the markup can be generated once and pasted into the
  page, which keeps it. Nothing in the package changed.

## [0.1.0] - 2026-09-01

First release.

### Added

- `splitText(text, options)` splits a string into per-word and per-character
  tokens at build time. Returns a token tree for frameworks that build real
  nodes, plus `toHTML()` and `toElement()` for string templates, so no
  per-framework adapter packages are needed.
- `split-reveal/css`: the whole effect in an `@layer split-reveal` cascade
  layer, 715 B gzipped, no runtime dependencies.
- Two modes. `rise` masks the word with `clip-path` and lifts characters into
  it, for headlines. `fade` steps characters in with `steps(1)` and stays fully
  inline, so line breaking and hyphenation behave like untouched copy.
- The stagger is a shift of `animation-range` rather than a delay, because a
  scroll timeline has no time for a delay to offset. `--split-step` is derived
  from a constant `spread` and the character count, so copy of any length
  finishes over the same share of its own scroll.
- `split-reveal/astro`: Astro component wrapping the same function.
- `split-reveal/fallback`: opt-in ~600 B `IntersectionObserver` fallback for
  browsers without `animation-timeline: view()`. Trades the scroll coupling for
  a fire-once transition. Kept out of the bundle unless imported.
- Grapheme-cluster splitting via `Intl.Segmenter`, so combining marks and
  emoji sequences stay one character rather than being torn in half.
- Accessibility: the split copy is `aria-hidden` with the untouched string
  beside it in a visually hidden span. Under `prefers-reduced-motion`, and in
  browsers without `view()`, the copy renders as plain text with no JavaScript.

### Notes

- A block needs roughly `end + spread` percent of the viewport height of
  content below it, 56% with the defaults. `cover` only completes once the
  element has travelled a viewport past its own top edge, so at the bottom of
  a page the scroll runs out first and the closing characters never land. The
  README gives the formula and the ways around it.
- `rise` needs a box per character for `transform` to apply, and each box is a
  line-break opportunity, so the word wrapper carries `white-space: nowrap`.
  Hyphenation is therefore off for that mode: check headline copy at 375px, or
  use `fade`.
- Firefox does not ship `animation-timeline: view()` yet. See the README.

[Unreleased]: https://github.com/robin-gogolok/split-reveal/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/robin-gogolok/split-reveal/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/robin-gogolok/split-reveal/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/robin-gogolok/split-reveal/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/robin-gogolok/split-reveal/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/robin-gogolok/split-reveal/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/robin-gogolok/split-reveal/releases/tag/v0.1.0
