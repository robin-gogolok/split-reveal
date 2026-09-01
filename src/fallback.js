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

const SELECTOR = '[data-split-reveal]';

/**
 * @returns {boolean} True when CSS already drives the reveal off the scroll.
 */
function hasScrollLinkedReveal() {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('animation-timeline: view()')
  );
}

/**
 * Install the fallback. Safe to call more than once; later calls are ignored.
 *
 * @param {object} [options]
 * @param {ParentNode} [options.root=document] Where to look for split elements.
 * @param {string} [options.rootMargin='0px 0px -10% 0px'] Observer margin.
 * @returns {boolean} True when the fallback took charge.
 */
export function installFallback({ root = document, rootMargin = '0px 0px -10% 0px' } = {}) {
  if (typeof document === 'undefined') return false;

  // Reduced motion is handled by not animating at all, which is the same
  // answer the stylesheet gives. Never override that here.
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }

  if (hasScrollLinkedReveal()) return false;
  if (document.documentElement.hasAttribute('data-split-fallback')) return false;

  const elements = root.querySelectorAll(SELECTOR);
  if (elements.length === 0) return false;

  // Setting the attribute is what arms the fallback rules in the stylesheet.
  // Doing it before observing means the characters start hidden rather than
  // flashing in and then animating.
  document.documentElement.setAttribute('data-split-fallback', '');

  if (!('IntersectionObserver' in window)) {
    elements.forEach((el) => el.setAttribute('data-split-in', ''));
    return true;
  }

  const observer = new IntersectionObserver(
    (entries, self) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-split-in', '');
        self.unobserve(entry.target);
      });
    },
    { rootMargin, threshold: 0 },
  );

  elements.forEach((el) => observer.observe(el));
  return true;
}

// Auto-install on import, so the documented one-liner is enough. Call
// `installFallback()` yourself for content added after load.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installFallback(), { once: true });
  } else {
    installFallback();
  }
}
