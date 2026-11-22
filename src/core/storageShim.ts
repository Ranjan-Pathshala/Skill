/**
 * Safe Storage & BroadcastChannel shim for restricted third-party iframes
 * and Google Apps Script HtmlService sandboxes, plus early theme bootstrap.
 */

interface MemoryStorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

function makeMemoryStorage(): MemoryStorageLike {
  let store: Record<string, string> = Object.create(null);
  return {
    get length(): number {
      return Object.keys(store).length;
    },
    key(index: number): string | null {
      const keys = Object.keys(store);
      return keys[index] !== undefined ? keys[index] : null;
    },
    getItem(key: string): string | null {
      const k = String(key);
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem(key: string, value: string): void {
      store[String(key)] = String(value);
    },
    removeItem(key: string): void {
      delete store[String(key)];
    },
    clear(): void {
      store = Object.create(null);
    },
  };
}

function ensureSafeStorage(propName: 'localStorage' | 'sessionStorage'): void {
  if (typeof window === 'undefined') return;
  try {
    const s = window[propName];
    const testKey = '__rp_storage_probe__';
    s.setItem(testKey, '1');
    s.removeItem(testKey);
  } catch {
    try {
      Object.defineProperty(window, propName, {
        value: makeMemoryStorage(),
        configurable: true,
        writable: true,
      });
    } catch {
      // Non-configurable host environment
    }
  }
}

export function initStorageAndThemeShim(): void {
  if (typeof window === 'undefined') return;
  ensureSafeStorage('localStorage');
  ensureSafeStorage('sessionStorage');

  try {
    if (typeof window.BroadcastChannel === 'function') {
      const probe = new window.BroadcastChannel('__rp_bc_probe__');
      probe.close();
    }
  } catch {
    const SafeBroadcastChannel = function SafeBroadcastChannel(
      this: {
        name: string;
        onmessage: ((ev: MessageEvent) => void) | null;
        postMessage: () => void;
        close: () => void;
        addEventListener: () => void;
        removeEventListener: () => void;
      },
      name?: string,
    ) {
      this.name = String(name || '');
      this.onmessage = null;
      this.postMessage = () => {};
      this.close = () => {};
      this.addEventListener = () => {};
      this.removeEventListener = () => {};
    };
    (window as unknown as Record<string, unknown>).BroadcastChannel = SafeBroadcastChannel;
  }

  try {
    const savedTheme =
      window.localStorage.getItem('steno_theme') ||
      window.localStorage.getItem('steno_theme_preference') ||
      'light';
    document.documentElement.setAttribute(
      'data-theme',
      savedTheme === 'dark' ? 'dark' : 'light',
    );
  } catch {
    // Ignore storage read issues
  }
}
