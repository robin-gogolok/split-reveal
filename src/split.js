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

/** @typedef {'rise' | 'fade'} SplitMode */

/**
 * @typedef {object} SplitOptions
 * @property {SplitMode} [mode='rise']  `rise` masks the word and lifts characters
 *   into it. `fade` steps them in without a mask and stays fully inline.
 * @property {number} [start=8]   Range start of the first character, in percent of `cover`.
 * @property {number} [end=34]    Range end of the first character, in percent of `cover`.
 * @property {number} [spread=22] Scroll distance between the first and the last
 *   character finishing, in percentage points of `cover`. Held constant while the
 *   per-character step is derived from it, so a six-word headline and a forty-word
 *   paragraph both complete over the same share of their own scroll.
 */

const DEFAULTS = Object.freeze({
  mode: 'rise',
  start: 8,
  end: 34,
  spread: 22,
});

const MODES = new Set(['rise', 'fade']);

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
 * @param {Record<string, string | number | boolean | null | undefined>} attrs
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
  const config = { ...DEFAULTS };
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) config[key] = value;
  }
  const { mode, start, end, spread } = config;

  if (!MODES.has(mode)) {
    throw new RangeError(`split-reveal: unknown mode "${mode}", expected "rise" or "fade"`);
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
  const step = spread / Math.max(count - 1, 1);

  return new SplitResult({ text, mode, tokens, count, start, end, step });
}

/**
 * The outcome of a split: the token tree plus everything needed to render it.
 * Frameworks that build real nodes read `tokens` and `attributes`; string based
 * templates call `toHTML()` or `toElement()`.
 */
export class SplitResult {
  /** @param {object} init */
  constructor(init) {
    /** @type {string} The untouched input. */
    this.text = init.text;
    /** @type {SplitMode} */
    this.mode = init.mode;
    /** @type {Array<{type: 'word', value: string, chars: Array<{value: string, index: number}>} | {type: 'space', value: string}>} */
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
   * @returns {{'data-split-reveal': SplitMode, style: string}}
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
   * @param {Record<string, string | number | boolean | null | undefined>} [attrs]
   * @returns {string}
   */
  toElement(tag = 'span', attrs = {}) {
    const merged = { ...attrs, ...this.attributes };
    if (attrs.style) merged.style = `${attrs.style};${this.attributes.style}`;
    return `<${tag}${renderAttributes(merged)}>${this.toHTML()}</${tag}>`;
  }
}

export { DEFAULTS as defaults };
