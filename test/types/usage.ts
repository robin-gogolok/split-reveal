// Not run, only compiled. Every `@ts-expect-error` below is an assertion in
// reverse: the check fails if the error stops happening, which is how a
// widened type gets caught.
import { splitText, SplitResult, defaults } from 'split-reveal';
import type {
  SplitMode,
  SplitOptions,
  SplitChar,
  SplitToken,
  SplitAttributes,
} from 'split-reveal';
import { installFallback } from 'split-reveal/fallback';

const result: SplitResult = splitText('Scroll is the timeline.');

const text: string = result.text;
const count: number = result.count;
const mode: SplitMode = result.mode;
const step: number = result.step;
const attributes: SplitAttributes = result.attributes;
const html: string = result.toHTML();
const element: string = result.toElement('h1', { class: 'hero', hidden: false, id: null });

// The wrapper attributes have to spread onto a JSX element, which is the shape
// the README's React example depends on.
const wrapperMode: SplitMode = attributes['data-split-reveal'];
const wrapperStyle: string = attributes.style;

const options: SplitOptions = { mode: 'fade', start: 8, end: 34, spread: 22 };
const nudged: SplitMode = 'nudge';
splitText('…', { mode: nudged });
splitText('…', options);

// `step` replaces `spread`, and `null` is the way to say it is not set.
splitText('…', { start: 8, end: 18, step: 0.25 });
splitText('…', { spread: 22, step: null });

// Framework wrappers pass every prop through, set or not.
splitText('…', { mode: undefined, start: undefined, step: undefined });

// Narrowing on `type` is the documented way through the token tree.
for (const token of result.tokens satisfies SplitToken[]) {
  if (token.type === 'space') {
    const space: string = token.value;
    // @ts-expect-error space tokens carry no characters
    token.chars;
  } else {
    const chars: SplitChar[] = token.chars;
    const first: number = chars[0].index;
  }
}

const fallbackTook: boolean = installFallback({ rootMargin: '0px' });
installFallback();
installFallback({ root: document.body });

const defaultMode: SplitMode = defaults.mode;
// No number default: `null` is what makes `spread` the one that applies.
const defaultStep: number | null = defaults.step;
// @ts-expect-error the defaults are frozen
defaults.start = 12;

// @ts-expect-error only 'rise' and 'fade' exist
splitText('…', { mode: 'slide' });

// @ts-expect-error the ranges are numbers, not CSS percentages
splitText('…', { start: '8%' });

// @ts-expect-error the step is percentage points too, not a CSS percentage
splitText('…', { step: '0.25%' });

// @ts-expect-error the text is required and has to be a string
splitText(42);

// The README's TypeScript example, kept here so a widened `tokens` type shows
// up as a failing test rather than as a broken snippet in the docs.
function longestWord(tokens: SplitToken[]): number {
  return tokens.reduce((n, t) => (t.type === 'word' ? Math.max(n, t.chars.length) : n), 0);
}
longestWord(splitText('Scroll is the timeline.').tokens);

// The README's React example spreads the attributes onto an element and keys
// characters by index.
const reactShape = result.tokens.map((token, i) =>
  token.type === 'space' ? ' ' : token.chars.map((c) => [c.index, c.value] as const),
);
