/**
 * Optional fire-once fallback for browsers without `animation-timeline: view()`.
 *
 * Today that is Firefox, where scroll-driven animations are still behind a
 * flag. Import this only if plain unanimated copy is not an acceptable
 * resting state for you:
 *
 *   import 'split-reveal/fallback'
 *
 * What it trades away is the scroll coupling. A view() timeline runs both
 * ways and is driven by the wheel; this plays once, forwards, on its own
 * clock. It is a different effect that happens to look similar, which is
 * exactly why it is opt-in rather than bundled.
 *
 * @module split-reveal/fallback
 */
/**
 * Install the fallback. Safe to call more than once; later calls are ignored.
 *
 * @param {object} [options]
 * @param {ParentNode} [options.root=document] Where to look for split elements.
 * @param {string} [options.rootMargin='0px 0px -10% 0px'] Observer margin.
 * @returns {boolean} True when the fallback took charge.
 */
export declare function installFallback({ root, rootMargin }?: {
    root?: ParentNode;
    rootMargin?: string;
}): boolean;
