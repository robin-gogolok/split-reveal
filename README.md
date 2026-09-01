# split-reveal

Scroll-linked per-character text reveal, in CSS. The split runs at build time, so nothing ships to the browser but markup and a stylesheet.

**[Live demo →](https://robin-gogolok.github.io/split-reveal/)**

```
715 B  gzipped CSS
  0    runtime dependencies
  0    bytes of JavaScript on the page
```

Characters move with the wheel, in both directions, for as long as the element is on screen. Scroll is the timeline, not a trigger that fires a clip.

---

## Why this exists

The usual way to do this is GSAP with ScrollTrigger and SplitText: about 51 KB gzipped, splitting the DOM at runtime, re-measuring on resize. This does the same effect with a stylesheet and a build step.

The trade is real and worth stating plainly: you give up Firefox (see [Browser support](#browser-support)), and you give up per-line masking, because line breaks only exist after layout and this never measures layout.

## Install

```sh
npm i split-reveal
```

## Use

Import the stylesheet once, anywhere in your app:

```js
import 'split-reveal/css'
```

### Astro

```astro
---
import SplitReveal from 'split-reveal/astro'
---
<SplitReveal as="h1" class="hero-title" text="Scroll is the timeline." />
<SplitReveal as="p" mode="fade" text="Not a trigger that fires a clip." />
```

### Any other build step

`splitText()` is a plain function with no framework attached. Call it wherever you render.

```js
import { splitText } from 'split-reveal'

const title = splitText('Scroll is the timeline.')

// String templates (11ty, Hono, plain Node):
title.toElement('h1', { class: 'hero-title' })

// Frameworks that build real nodes read the tree instead:
title.tokens      // [{ type: 'word', chars: [{ value: 'S', index: 0 }, …] }, …]
title.attributes  // { 'data-split-reveal': 'rise', style: '--split-start:8%;…' }
```

In React:

```jsx
const t = splitText('Scroll is the timeline.')

<h1 className="hero-title" {...t.attributes}>
  <span className="split-a11y">{t.text}</span>
  <span aria-hidden="true">
    {t.tokens.map((token, i) =>
      token.type === 'space' ? ' ' : (
        <span className="split-word" key={i}>
          {token.chars.map((c) => (
            <span className="split-char" key={c.index} style={{ '--split-i': c.index }}>
              {c.value}
            </span>
          ))}
        </span>
      ),
    )}
  </span>
</h1>
```

## Modes

| Mode | What it does | Use for |
|---|---|---|
| `rise` (default) | Masks the word with `clip-path` and lifts characters into it | Headlines |
| `fade` | Steps characters in with `steps(1)`. No mask, stays fully inline | Body copy, ledes |

`fade` is stepped rather than faded on purpose. A real fade shows a cloud of half-transparent letters for the whole scroll range; a single step means a character is either set or absent, which stays legible while the page is moving.

## API

### `splitText(text, options?)`

| Option | Default | Meaning |
|---|---|---|
| `mode` | `'rise'` | `'rise'` or `'fade'` |
| `start` | `8` | Range start of the **first** character, in percent of `cover` |
| `end` | `34` | Range end of the **first** character, in percent of `cover` |
| `spread` | `22` | Scroll distance between the first and the last character finishing, in percentage points of `cover` |

Returns a `SplitResult`:

| Member | Type | |
|---|---|---|
| `text` | `string` | The untouched input |
| `count` | `number` | Number of characters |
| `tokens` | `array` | Word and whitespace tokens, each word carrying its characters and their running index |
| `attributes` | `object` | `data-split-reveal` and the `style` string for the wrapping element |
| `toHTML()` | `string` | Inner markup: hidden original plus the `aria-hidden` split copy |
| `toElement(tag?, attrs?)` | `string` | The complete element |

### Why `spread` and not a delay

A scroll timeline has no time. Forty `animation-delay` values would all resolve to the same frame, because nothing is playing at a rate that a delay could offset. The stagger has to be a shift of `animation-range` instead:

```css
animation-range:
  cover calc(var(--split-start) + var(--split-i) * var(--split-step))
  cover calc(var(--split-end)   + var(--split-i) * var(--split-step));
```

`--split-step` is derived from `spread` and the character count, not written by hand. That is the part worth taking: **`spread` is held constant, so a six-word headline and a forty-word paragraph both finish over the same share of their own scroll.** Hand-tuned per-block values drift the moment the copy changes.

Reading order also holds at any scroll speed, which a fixed delay cannot promise.

## CSS custom properties

Set these on the element, or anywhere above it.

| Property | Default | |
|---|---|---|
| `--split-bleed-top` | `0.4em` | Headroom the mask leaves above the line box, for ascenders and umlaut dots |
| `--split-bleed-bottom` | `0.25em` | Headroom below, for descenders |
| `--split-fallback-duration` | `500ms` | Fallback only |
| `--split-fallback-stagger` | `14ms` | Fallback only |
| `--split-fallback-ease` | `cubic-bezier(.16,1,.3,1)` | Fallback only |

Raise both bleeds for display faces set below `line-height: 1`, where glyphs sit well outside the line box. Too much bleed costs nothing; too little shaves the tops off umlauts.

All rules live in an `@layer split-reveal` cascade layer, so your own unlayered CSS wins without needing `!important`.

## Accessibility

- The split copy is `aria-hidden`. The untouched string sits beside it in a visually hidden span, so assistive technology reads sentences, never letters.
- Under `prefers-reduced-motion: reduce` nothing animates at all: the copy renders as plain text.
- Only `opacity` and `transform` are animated, both compositor-only. No `will-change`.

## Browser support

| | `animation-timeline: view()` |
|---|---|
| Chrome / Edge | 115+ |
| Chrome Android | 115+ |
| Safari / iOS | 26+ |
| **Firefox** | behind a flag |
| **Firefox Android** | not supported |

Without support the copy renders as plain, unanimated text. That is the intended resting state, not a broken one, and it needs no JavaScript.

If you would rather have something animated there, opt into the fallback:

```js
import 'split-reveal/fallback'
```

It is roughly 600 bytes and trades the scroll coupling for a fire-once `IntersectionObserver` transition: the reveal still reads left to right, but it plays on its own clock and does not run backwards. Different effect, similar look. It stays out of the bundle unless you ask for it.

## Known limitation

`rise` needs a box per character, because `transform` does not apply to non-replaced inline elements. Each of those boxes is also a line-break opportunity, which would let a long compound break mid-word with no hyphen, so the word wrapper carries `white-space: nowrap`.

**Hyphenation is therefore off for `rise`.** A long German compound at hero size can run out of the line on narrow viewports. Check headline copy at 375px, or use `fade`, which stays fully inline and breaks exactly like untouched text.

## How it compares

| | Splits | Animates | Runtime cost |
|---|---|---|---|
| **split-reveal** | build time | yes, scroll-linked in CSS | none |
| [Splitting.js](https://splitting.js.org/) | runtime | no, gives you the custom properties | ~2 KB |
| [SplitType](https://github.com/lukePeavey/SplitType) | runtime | no | ~3 KB |
| GSAP SplitText + ScrollTrigger | runtime | yes, with a full timeline API | ~51 KB |

If you need per-line masking, timeline control or Firefox today, use GSAP. If you want the effect and nothing else, use this.

## Licence

MIT © Robin Gogolok
