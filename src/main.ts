/**
 * RP Skill | Ranjan Pathshala — Modular Vite ES Entry Point.
 *
 * Boot order:
 *  1. Safe storage / BroadcastChannel shim + early light/dark theme attribute
 *  2. Modular CSS cascade (tokens -> layout -> components -> views -> exams -> admin -> polish)
 *  3. Mount modular HTML shell, 18 portal views & modal suites into #app-root
 *  4. Bind reactive portalState descriptors onto window
 *  5. Bind exported feature handlers onto window for inline HTML events
 *  6. Register centralized lifecycle hooks (zero monkey-patching!)
 */

import { initStorageAndThemeShim } from './core/storageShim.ts';
initStorageAndThemeShim();

import './styles/index.css';
import { mountPortalShell } from './templates/mountShell.ts';
import { bindStateToWindow } from './core/state.ts';
import { bindPortalGlobals } from './bridge/globals.ts';
import { registerPortalHooks } from './features/registerHooks.js';

mountPortalShell();
bindStateToWindow();
bindPortalGlobals();
registerPortalHooks();

function initScrollRevealAnimations(): void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('rp-revealed');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -24px 0px', threshold: 0.05 },
  );

  const UNBOUND_SELECTOR =
    '.auth-user-feature-card:not([data-rp-reveal-bound="1"]), .rp-quick-launch-tile:not([data-rp-reveal-bound="1"]), .stat-card:not([data-rp-reveal-bound="1"])';

  const observeTargets = (root: ParentNode = document) => {
    const els = root.querySelectorAll(UNBOUND_SELECTOR);
    if (els.length === 0) return;

    const vh = window.innerHeight || 800;
    const visibleEls: Element[] = [];
    const offscreenEls: Element[] = [];

    // Phase 1: Batch all layout reads before any DOM writes to prevent forced reflows
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const rect = el.getBoundingClientRect();
      if (rect.top < vh && rect.bottom > 0) {
        visibleEls.push(el);
      } else {
        offscreenEls.push(el);
      }
    }

    // Phase 2: Batch all DOM attribute/class writes
    for (let i = 0; i < visibleEls.length; i++) {
      const el = visibleEls[i];
      el.setAttribute('data-rp-reveal-bound', '1');
      el.classList.add('rp-revealed');
    }
    for (let i = 0; i < offscreenEls.length; i++) {
      const el = offscreenEls[i];
      el.setAttribute('data-rp-reveal-bound', '1');
      el.classList.add('rp-reveal-ready');
      observer.observe(el);
    }
  };

  observeTargets();
  const viewport = document.getElementById('app-viewport');
  if (viewport && 'MutationObserver' in window) {
    let timer: number | undefined;
    const mo = new MutationObserver(() => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        observeTargets(viewport);
      }, 180);
    });
    mo.observe(viewport, { childList: true, subtree: true });
  }
}

initScrollRevealAnimations();

