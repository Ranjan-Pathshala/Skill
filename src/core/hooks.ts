/**
 * Typed Lifecycle Hook Bus for RP Skill Portal.
 *
 * Replaces the legacy multi-script monkey-patching chains where 4 layered
 * <script> tags repeatedly wrapped window.navigateTo, window.openTestComparison,
 * window.switchAdminTab, window.submitCbtExam, window.apiCall, etc.
 *
 * Every domain module defines ONE authoritative function and emits typed
 * lifecycle hooks for cross-cutting concerns (analytics, proctoring, SRS,
 * autosave cleanup, Telegram broadcasts, badge refreshes).
 */

export type PortalHookName =
  | 'afterAuthViewRender'
  | 'afterAuthenticatedSetup'
  | 'afterNavMenuToggle'
  | 'afterNavigate'
  | 'afterAdminTabSwitch'
  | 'afterAnnouncementsRender'
  | 'afterBatchMonitorRender'
  | 'afterBatchDropdownsPopulated'
  | 'afterBatchCreated'
  | 'afterTypingMediumSelected'
  | 'afterSavedRulesPopulated'
  | 'afterTranscribeExamSelectorOpen'
  | 'afterTranscribeRulePreview'
  | 'afterTranscriptionConfirmed'
  | 'afterAudioDictationStart'
  | 'afterTestTimerStart'
  | 'beforeStenoTestSubmit'
  | 'afterStenoTestSubmit'
  | 'afterComparisonOpen'
  | 'afterCbtTestStart'
  | 'afterCbtNavigatePrev'
  | 'beforeCbtSubmit'
  | 'afterCbtSubmit'
  | 'afterApiSuccess';

export type PortalHookListener = (...args: unknown[]) => unknown;

class PortalHookBus {
  private readonly listeners = new Map<PortalHookName, Set<PortalHookListener>>();

  on(hook: PortalHookName, listener: PortalHookListener): () => void {
    let set = this.listeners.get(hook);
    if (!set) {
      set = new Set();
      this.listeners.set(hook, set);
    }
    set.add(listener);
    return () => this.off(hook, listener);
  }

  once(hook: PortalHookName, listener: PortalHookListener): () => void {
    const wrapped: PortalHookListener = (...args) => {
      this.off(hook, wrapped);
      return listener(...args);
    };
    return this.on(hook, wrapped);
  }

  off(hook: PortalHookName, listener: PortalHookListener): void {
    this.listeners.get(hook)?.delete(listener);
  }

  emit(hook: PortalHookName, ...args: unknown[]): void {
    const set = this.listeners.get(hook);
    if (!set || set.size === 0) return;
    for (const fn of Array.from(set)) {
      try {
        fn(...args);
      } catch (err) {
        console.warn(`[portalHooks:${hook}] listener error:`, err);
      }
    }
  }

  async emitAsync(hook: PortalHookName, ...args: unknown[]): Promise<void> {
    const set = this.listeners.get(hook);
    if (!set || set.size === 0) return;
    for (const fn of Array.from(set)) {
      try {
        await fn(...args);
      } catch (err) {
        console.warn(`[portalHooks:${hook}] async listener error:`, err);
      }
    }
  }

  listenerCount(hook: PortalHookName): number {
    return this.listeners.get(hook)?.size ?? 0;
  }

  clear(hook?: PortalHookName): void {
    if (hook) {
      this.listeners.delete(hook);
    } else {
      this.listeners.clear();
    }
  }

  registeredHooks(): PortalHookName[] {
    return Array.from(this.listeners.keys());
  }
}

export const portalHooks = new PortalHookBus();

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).portalHooks = portalHooks;
}
