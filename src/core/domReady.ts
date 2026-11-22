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

const _frameTaskTokens: Record<string, number> = Object.create(null);

export function cancelFrameTasks(tokenKey: string): void {
  const key = String(tokenKey || 'default');
  _frameTaskTokens[key] = (_frameTaskTokens[key] || 0) + 1;
}

export function yieldToMainFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function' &&
      (typeof document === 'undefined' || !document.hidden)
    ) {
      window.requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Executes an ordered list of UI render tasks across animation frames using a
 * per-frame time budget so mobile scrolling and touch input stay responsive.
 * Re-invoking with the same tokenKey automatically cancels stale queued work.
 */
export function scheduleFrameTasks(
  tokenKey: string,
  tasks: Array<() => void>,
  frameBudgetMs = 8,
): void {
  const key = String(tokenKey || 'default');
  const token = (_frameTaskTokens[key] || 0) + 1;
  _frameTaskTokens[key] = token;

  const queue = Array.isArray(tasks) ? tasks.filter((fn) => typeof fn === 'function') : [];
  if (queue.length === 0) return;

  let index = 0;
  const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

  const scheduleNext = (fn: () => void) => {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function' &&
      (typeof document === 'undefined' || !document.hidden)
    ) {
      window.requestAnimationFrame(fn);
    } else {
      setTimeout(fn, 0);
    }
  };

  const runSlice = () => {
    if (_frameTaskTokens[key] !== token) return;
    const sliceStart = now();
    while (index < queue.length) {
      if (_frameTaskTokens[key] !== token) return;
      const task = queue[index++];
      try {
        task();
      } catch (err) {
        console.warn('[RP Skill frame task]', key, err);
      }
      if (index < queue.length && now() - sliceStart >= frameBudgetMs) {
        scheduleNext(runSlice);
        return;
      }
    }
  };

  scheduleNext(runSlice);
}

