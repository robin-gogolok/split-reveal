/**
 * split-reveal — build-time text splitting for scroll-linked reveals.
 *
 * The split happens while your page renders, so the browser never runs a
 * library to measure or rewrite the DOM. The animation itself is CSS on
 * `animation-timeline: view()`, which makes the scroll the timeline rather
 * than a trigger: characters move with the wheel, in both directions, and
 * a resize or font swap can never invalidate a measurement that was never
 * taken.
 *
 * @module split-reveal
 */

/** @typedef {'rise' | 'fade' | 'nudge'} SplitMode */

/**
 * @typedef {object} SplitOptions
 * @property {SplitMode} [mode='rise']  `rise` masks the word and lifts characters
 *   into it. `fade` steps them in without a mask and stays fully inline.
 *   `nudge` hides with `visibility` rather than a mask, which frees the travel
 *   distance from the glyph height that `rise` is bound to; set it with
 *   `--split-travel`.
 * @property {number} [start=8]   Range start of the first character, in percent of `cover`.
 * @property {number} [end=34]    Range end of the first character, in percent of `cover`.
 * @property {number} [spread=22] Scroll distance between the first and the last
 *   character finishing, in percentage points of `cover`. Held constant while the
 *   per-character step is derived from it, so a six-word headline and a forty-word
 *   paragraph both complete over the same share of their own scroll. Ignored
 *   when `step` is set.
 * @property {number|null} [step=null] Scroll distance from one character to the
 *   next, in percentage points of `cover`, written rather than derived. This is
 *   the opposite trade to `spread`: the stagger stays the same density in every
 *   block and the whole run grows with the copy instead. What it fixes is how
 *   many characters are ever moving at once, `(end - start) / step` of them, so
 *   the wave stays a wave in a long paragraph rather than smearing across all
 *   of it. Passing both this and `spread` throws.
 */

/**
 * @typedef {object} SplitChar
 * @property {string} value One grapheme cluster.
 * @property {number} index Position across the whole string, not within the word.
 *   This is `--split-i`, so it is the character's place in the stagger.
 */

/**
 * @typedef {object} SplitWordToken
 * @property {'word'} type
 * @property {string} value The word as written.
 * @property {SplitChar[]} chars
 */

/**
 * @typedef {object} SplitSpaceToken
 * @property {'space'} type
 * @property {string} value
 */

/**
 * A run of copy is a flat list of these. Narrow on `type` before reaching for
 * `chars`; the space tokens carry none and exist to keep the line-break
 * opportunities where untouched text would have them.
 *
 * @typedef {SplitWordToken | SplitSpaceToken} SplitToken
 */

/** @typedef {{'data-split-reveal': SplitMode, style: string}} SplitAttributes */

/** @typedef {Record<string, string | number | boolean | null | undefined>} ElementAttributes */

/** @type {Readonly<Required<SplitOptions>>} */
const DEFAULTS = Object.freeze({
  mode: 'rise',
  start: 8,
  end: 34,
  spread: 22,
  // `null`, not a number: it means "derive the step from spread". A default
  // here would silently be the third value describing a stagger that only has
  // two degrees of freedom.
  step: null,
});

const MODES = new Set(['rise', 'fade', 'nudge']);

// Grapheme clusters, not code points: `Array.from` would tear "é" written as
// e + combining acute in half, and split a flag emoji into two invisible
// halves. Intl.Segmenter is in every browser that has view() and in Node 16+,
// so the fallback below is only for exotic runtimes.
const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/**
 * @param {string} value
 * @returns {string[]}
 */
function toGraphemes(value) {
  if (!segmenter) return Array.from(value);
  const out = [];
  for (const { segment } of segmenter.segment(value)) out.push(segment);
  return out;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

/**
 * @param {ElementAttributes} attrs
 * @returns {string}
 */
function renderAttributes(attrs) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== null && value !== undefined && value !== false)
    .map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${escapeAttribute(String(value))}"`))
    .join('');
}

/**
 * Split a string into per-word and per-character tokens for split-reveal.
 *
 * @param {string} text
 * @param {SplitOptions} [options]
 * @returns {SplitResult}
 */
export function splitText(text, options = {}) {
  if (typeof text !== 'string') {
    throw new TypeError(`split-reveal: expected a string, received ${typeof text}`);
  }

  // Object spread would let an explicit `undefined` overwrite a default, and
  // every framework wrapper hands us `undefined` for props the caller left
  // out. Skipping them is what makes `splitText(text, { start: undefined })`
  // mean "use the default" rather than "use NaN".
  // The cast is only about the write: a string key cannot index a typed
  // object, and narrowing it to `keyof SplitOptions` would make the value a
  // union that fits none of the slots. `config` keeps its type for the
  // destructure below, which is where it matters.
  const config = { ...DEFAULTS };
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) /** @type {Record<string, unknown>} */ (config)[key] = value;
  }
  const { mode, start, end, spread, step: fixedStep } = config;

  if (!MODES.has(mode)) {
    throw new RangeError(
      `split-reveal: unknown mode "${mode}", expected one of ${[...MODES].map((m) => `"${m}"`).join(', ')}`,
    );
  }

  // Both describe the same stagger, so silently dropping one is the kind of
  // bug that reads as "my spread does nothing". `null` is not "both": it is how
  // a wrapper says it has no step, and the derivation below handles it.
  if (options.spread !== undefined && options.step !== undefined && options.step !== null) {
    throw new RangeError('split-reveal: pass either spread or step, not both');
  }

  // Whitespace is kept as its own token and rendered as a plain text node, so
  // it stays the only line-break opportunity and wrapping behaves exactly like
  // untouched copy.
  const raw = text.split(/(\s+)/).filter((part) => part.length > 0);

  let index = 0;
  const tokens = raw.map((part) =>
    /^\s+$/.test(part)
      ? { type: /** @type {const} */ ('space'), value: ' ' }
      : {
          type: /** @type {const} */ ('word'),
          value: part,
          chars: toGraphemes(part).map((value) => ({ value, index: index++ })),
        },
  );

  const count = index;
  const step = fixedStep ?? spread / Math.max(count - 1, 1);

  return new SplitResult({ text, mode, tokens, count, start, end, step });
}

/**
 * The outcome of a split: the token tree plus everything needed to render it.
 * Frameworks that build real nodes read `tokens` and `attributes`; string based
 * templates call `toHTML()` or `toElement()`.
 */
export class SplitResult {
  /**
   * @param {{text: string, mode: SplitMode, tokens: SplitToken[], count: number,
   *   start: number, end: number, step: number}} init
   */
  constructor(init) {
    /** @type {string} The untouched input. */
    this.text = init.text;
    /** @type {SplitMode} */
    this.mode = init.mode;
    /** @type {SplitToken[]} Word and whitespace tokens, in reading order. */
    this.tokens = init.tokens;
    /** @type {number} Number of characters, across all words. */
    this.count = init.count;
    /** @type {number} Range start of the first character, in percent of `cover`. */
    this.start = init.start;
    /** @type {number} Range end of the first character, in percent of `cover`. */
    this.end = init.end;
    /** @type {number} Range shift per character, in percentage points of `cover`. */
    this.step = init.step;
  }

  /**
   * Attributes for the element that wraps the split copy.
   * @returns {SplitAttributes}
   */
  get attributes() {
    return {
      'data-split-reveal': this.mode,
      style:
        `--split-start:${this.start}%;` +
        `--split-end:${this.end}%;` +
        `--split-step:${Number(this.step.toFixed(4))}%`,
    };
  }

  /**
   * Inner markup: the untouched string for assistive technology, then the
   * split copy marked `aria-hidden` so nobody ever hears it spelled out.
   *
   * No whitespace between the two spans. The hidden copy is absolutely
   * positioned, so a text node beside it would still render as a leading
   * space in front of the first character.
   *
   * @returns {string}
   */
  toHTML() {
    const split = this.tokens
      .map((token) => {
        if (token.type === 'space') return ' ';
        const chars = token.chars
          .map((char) => `<span class="split-char" style="--split-i:${char.index}">${escapeHtml(char.value)}</span>`)
          .join('');
        return `<span class="split-word">${chars}</span>`;
      })
      .join('');

    return `<span class="split-a11y">${escapeHtml(this.text)}</span><span aria-hidden="true">${split}</span>`;
  }

  /**
   * The complete element, attributes included.
   *
   * @param {string} [tag='span']
   * @param {ElementAttributes} [attrs]
   * @returns {string}
   */
  toElement(tag = 'span', attrs = {}) {
    const merged = { ...attrs, ...this.attributes };
    if (attrs.style) merged.style = `${attrs.style};${this.attributes.style}`;
    return `<${tag}${renderAttributes(merged)}>${this.toHTML()}</${tag}>`;
  }
}

export { DEFAULTS as defaults };
