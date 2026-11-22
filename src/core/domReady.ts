/**
 * Safe DOM-ready & window-load schedulers for deferred Vite ES modules.
 * Ensures boot callbacks execute reliably whether modules load before or
 * after DOMContentLoaded / window.load.
 */

export function onDomReady(fn: () => void): void {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    queueMicrotask(fn);
  }
}

export function onWindowLoad(fn: () => void): void {
  if (typeof window === 'undefined') return;
  if (document.readyState === 'complete') {
    queueMicrotask(fn);
  } else {
    window.addEventListener('load', fn, { once: true });
  }
}
