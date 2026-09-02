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
export type SplitMode = 'rise' | 'fade';
export type SplitOptions = {
    /**
     * `rise` masks the word and lifts characters
     * into it. `fade` steps them in without a mask and stays fully inline.
     */
    mode?: SplitMode;
    /**
     * Range start of the first character, in percent of `cover`.
     */
    start?: number;
    /**
     * Range end of the first character, in percent of `cover`.
     */
    end?: number;
    /**
     * Scroll distance between the first and the last
     * character finishing, in percentage points of `cover`. Held constant while the
     * per-character step is derived from it, so a six-word headline and a forty-word
     * paragraph both complete over the same share of their own scroll. Ignored
     * when `step` is set.
     */
    spread?: number;
    /**
     * Scroll distance from one character to the
     * next, in percentage points of `cover`, written rather than derived. This is
     * the opposite trade to `spread`: the stagger stays the same density in every
     * block and the whole run grows with the copy instead. What it fixes is how
     * many characters are ever moving at once, `(end - start) / step` of them, so
     * the wave stays a wave in a long paragraph rather than smearing across all
     * of it. Passing both this and `spread` throws.
     */
    step?: number | null;
};
export type SplitChar = {
    /**
     * One grapheme cluster.
     */
    value: string;
    /**
     * Position across the whole string, not within the word.
     * This is `--split-i`, so it is the character's place in the stagger.
     */
    index: number;
};
export type SplitWordToken = {
    type: 'word';
    /**
     * The word as written.
     */
    value: string;
    chars: SplitChar[];
};
export type SplitSpaceToken = {
    type: 'space';
    value: string;
};
export type SplitToken = SplitWordToken | SplitSpaceToken;
export type SplitAttributes = {
    'data-split-reveal': SplitMode;
    style: string;
};
export type ElementAttributes = Record<string, string | number | boolean | null | undefined>;
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
declare const DEFAULTS: Readonly<Required<SplitOptions>>;
/**
 * Split a string into per-word and per-character tokens for split-reveal.
 *
 * @param {string} text
 * @param {SplitOptions} [options]
 * @returns {SplitResult}
 */
export declare function splitText(text: string, options?: SplitOptions): SplitResult;
/**
 * The outcome of a split: the token tree plus everything needed to render it.
 * Frameworks that build real nodes read `tokens` and `attributes`; string based
 * templates call `toHTML()` or `toElement()`.
 */
export declare class SplitResult {
    /** @type {string} The untouched input. */
    text: string;
    /** @type {SplitMode} */
    mode: SplitMode;
    /** @type {SplitToken[]} Word and whitespace tokens, in reading order. */
    tokens: SplitToken[];
    /** @type {number} Number of characters, across all words. */
    count: number;
    /** @type {number} Range start of the first character, in percent of `cover`. */
    start: number;
    /** @type {number} Range end of the first character, in percent of `cover`. */
    end: number;
    /** @type {number} Range shift per character, in percentage points of `cover`. */
    step: number;
    /**
     * @param {{text: string, mode: SplitMode, tokens: SplitToken[], count: number,
     *   start: number, end: number, step: number}} init
     */
    constructor(init: {
        text: string;
        mode: SplitMode;
        tokens: SplitToken[];
        count: number;
        start: number;
        end: number;
        step: number;
    });
    /**
     * Attributes for the element that wraps the split copy.
     * @returns {SplitAttributes}
     */
    get attributes(): SplitAttributes;
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
    toHTML(): string;
    /**
     * The complete element, attributes included.
     *
     * @param {string} [tag='span']
     * @param {ElementAttributes} [attrs]
     * @returns {string}
     */
    toElement(tag?: string, attrs?: ElementAttributes): string;
}
export { DEFAULTS as defaults };
