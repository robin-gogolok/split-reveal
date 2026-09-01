# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the version is below `1.0.0` the API may still change in a minor release.

## [Unreleased]

### Fixed

- The demo's last section stopped a few characters short of revealed at the
  bottom of the page. A `cover` range only completes once the element has
  travelled a viewport past its own top edge, and the scroll ran out first.
  The demo now carries a tail taller than `end + spread`, guarded by a browser
  test that scrolls to the document end at three viewport heights.

### Added

- The README documents how much scroll room a block needs below it, which is
  `end + spread` percent of the viewport height, and what happens when a block
  sits at the very bottom of a page without it.

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

- `rise` needs a box per character for `transform` to apply, and each box is a
  line-break opportunity, so the word wrapper carries `white-space: nowrap`.
  Hyphenation is therefore off for that mode: check headline copy at 375px, or
  use `fade`.
- Firefox does not ship `animation-timeline: view()` yet. See the README.

[Unreleased]: https://github.com/robin-gogolok/split-reveal/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/robin-gogolok/split-reveal/releases/tag/v0.1.0
