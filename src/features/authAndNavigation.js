// @ts-nocheck
/**
 * RP Skill Portal — Authentication, 2FA, Single-Device Sessions, Maintenance & Router
 * Clean Vite ES module (zero layered monkey-patch conflicts).
 */

import { portalState } from '../core/state.ts';
import { portalHooks } from '../core/hooks.ts';
import { onDomReady } from '../core/domReady.ts';
import { adjustAdminUploadForm, applyAdminTabPermissions, loadAdminData, loadDashboardBannerIntoAdminForm, loadMaintenanceSettingsIntoAdminForm, pushAdminRealtimeNotification, renderAdminBannersTable, renderAdminDateBannersTable, renderAdminFeedback, renderAdminLeaderboard, renderAdminLogs, renderAdminMaterialsTable, renderAdminPerformanceDashboard, renderAdminRealtimeNotifications, renderAdminSubtabsTable, renderAdminUsers, safeNotify, switchAdminTab } from './adminPanel.js';
import { autoResetAdminFiltersOnSearch, loadMaterials, loadUserFeedback, renderDashboardUI, renderHelpAdminContacts, renderPitmanSubtabs, renderPromoBanner, renderSubtabs, setupAuthenticatedUI, syncProfileTabUI } from './dashboardAndProfile.js';
import { escapeHtml } from '../utils/formatting.ts';
import { CLIENT_DEVICE_ID, NOTIFICATION_TTL_24H_MS, apiCall, applyUserCloudStateFromBackend, ensureSessionVerifyLoopRunning, loadSelectedEvaluationRulesIntoForm, logPortalAction, populateEvalCategoryDropdown, populateSavedRulesQuickDropdown, registerSingleDeviceSession, renderUnsyncedTestRetryBanner, showLoader, showToast, syncPortalDataInBackground, syncUserCloudStateToBackend } from './apiAndCore.js';
import { populateAdminLiveTestRankSelector, populateLiveTestMaterialOptions, renderAdminLiveTestsTable, renderDedicatedLiveTestsTab, renderLiveTestsEverywhere } from './mediaAndDictation.js';
import { FAKE_INJECTED_RULE_KEYS, initLearningTypingTutor, purgeFakeInjectedRules, renderVideoCourseView, seedRichDemoDataIfNeeded, switchLearningTypingSection } from './videoAndTutor.js';
import { buildAlphabetBar, initTypingTestWizard, loadTestHistory, populateWordsCategoryDropdown, renderTestHistoryTable, renderWords } from './typingAndEvaluation.js';
import { renderCbtTestCatalog } from './cbtArena.js';

const switchHelpTabSection = (...args) => (typeof window.switchHelpTabSection === 'function' ? window.switchHelpTabSection(...args) : undefined);

export const TAB_DISPLAY_META = {
  'auth': { icon: 'fa-solid fa-right-to-bracket', label: 'Login / Sign Up Page' },
  'dashboard': { icon: 'fa-solid fa-compass', label: 'Command Center' },
  'profile': { icon: 'fa-solid fa-id-badge', label: 'My Profile & Fees' },
  'buy-plans': { icon: 'fa-solid fa-cart-shopping', label: 'Buy Batches & Plans' },
  'livetests': { icon: 'fa-solid fa-tower-broadcast', label: 'Live Tests & Contests' },
  'videocourse': { icon: 'fa-solid fa-clapperboard', label: 'Video Masterclasses' },
  'words': { icon: 'fa-solid fa-pen-nib', label: 'Steno Outlines & Vocab' },
  'pdf': { icon: 'fa-solid fa-book-bookmark', label: 'E-Books & PDF Library' },
  'audio': { icon: 'fa-solid fa-microphone-lines', label: 'Dictation Studio & Pad' },
  'pitman': { icon: 'fa-solid fa-feather-pointed', label: 'Pitman Shorthand Academy' },
  'learningtyping': { icon: 'fa-solid fa-graduation-cap', label: 'Touch-Typing Academy' },
  'typingtest': { icon: 'fa-solid fa-keyboard', label: 'Skill Typing Arena' },
  'cbttest': { icon: 'fa-solid fa-desktop', label: 'CBT Mock Exam Suite' },
  'test': { icon: 'fa-solid fa-award', label: 'Scorecards & Transcripts' },
  'feedback': { icon: 'fa-solid fa-headset', label: 'Student Helpdesk' },
  'analytics': { icon: 'fa-solid fa-chart-pie', label: 'Executive Telemetry' },
  'admin': { icon: 'fa-solid fa-shield-halved', label: 'Admin Control Center' }
};

window.lastOriginTabBeforeTest = 'dashboard';

export function getMaterialTimestampScore(item, fallbackIdx = 0) {
  if (!item) return 0;
  // Check explicit UploadOrder / CreatedAt / UpdatedAt / Timestamp first
  if (typeof item._uploadTimestamp === 'number') return item._uploadTimestamp;
  const rawCreated = item.CreatedAt || item.createdAt || item.UpdatedAt || item.PostedDate || item.postedDate || '';
  if (rawCreated) {
    const t = new Date(rawCreated).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  // Check numeric timestamp embedded in MaterialID (e.g., MAT-1731000000000 or DEMO-...)
  const idStr = String(item.MaterialID || item.id || item.HomeworkID || item.AnnouncementID || '');
  const numMatch = idStr.match(/(\d{10,14})/);
  if (numMatch && numMatch[1]) {
    return parseInt(numMatch[1], 10);
  }
  const examDate = item.ExamDate || item.TargetDate || item.Date || '';
  if (examDate) {
    const dt = new Date(examDate).getTime();
    if (!isNaN(dt) && dt > 0) return dt + fallbackIdx;
  }
  return fallbackIdx;
}

export function sortMaterialsLatestFirst(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item, idx) => ({ item, idx, score: getMaterialTimestampScore(item, idx) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.idx - a.idx;
    })
    .map(entry => entry.item);
}

portalState.isLaptopMenuUserHidden = false;

export function updateMenuTriggerButtonState(isOpen) {
  const btn = document.getElementById('all-device-menu-btn');
  if (btn) {
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    btn.classList.toggle('menu-is-open', Boolean(isOpen));
  }
  if (window.innerWidth >= 1024 && isOpen) {
    document.body.classList.add('laptop-menu-docked');
  } else {
    document.body.classList.remove('laptop-menu-docked');
  }
}

export function openAllDeviceNavMenu() {
  if (!portalState.currentUser) return;
  document.body.classList.add('rp-authenticated');
  document.body.classList.remove('rp-unauthenticated');
  const navTabs = document.getElementById('main-nav-tabs');
  const authTabsList = document.getElementById('menu-authenticated-tabs-list');
  const backdrop = document.getElementById('nav-menu-backdrop');
  if (!navTabs) return;
  const headerEl = document.querySelector('header');
  if (headerEl) {
    const rect = headerEl.getBoundingClientRect();
    const topPx = Math.max(56, Math.round(rect.bottom + 6));
    navTabs.style.top = topPx + 'px';
    navTabs.style.maxHeight = `calc(100dvh - ${topPx + 14}px)`;
  }
  if (authTabsList) authTabsList.style.setProperty('display', 'flex', 'important');
  navTabs.style.setProperty('display', 'flex', 'important');
  navTabs.style.setProperty('visibility', 'visible', 'important');
  navTabs.style.setProperty('pointer-events', 'auto', 'important');
  navTabs.classList.add('menu-open');
  if (backdrop) {
    if (window.innerWidth < 1024) backdrop.classList.add('show');
    else backdrop.classList.remove('show');
  }
  updateMenuTriggerButtonState(true);
}

export function toggleAllDeviceNavMenu(event) {
  if (event) event.stopPropagation();
  if (!portalState.currentUser) return;
  if (window.isCbtExamActive) {
    showToast('🔒 Navigation is locked while a CBT Exam is in progress! Submit or Exit CBT Exam first.');
    return;
  }
  const navTabs = document.getElementById('main-nav-tabs');
  if (!navTabs) return;
  const isOpen = navTabs.classList.contains('menu-open');
  if (isOpen) {
    if (window.innerWidth >= 1024) portalState.isLaptopMenuUserHidden = true;
    closeAllDeviceNavMenu(true);
  } else {
    if (window.innerWidth >= 1024) portalState.isLaptopMenuUserHidden = false;
    openAllDeviceNavMenu();
  }

  try { portalHooks.emit('afterNavMenuToggle'); } catch (_hk) {}
}

export function closeAllDeviceNavMenu(forceHide = false) {
  // On laptop (>= 1024px), keep menu shown unless forceHide is true or user explicitly hid it
  if (window.innerWidth >= 1024 && portalState.currentUser && !forceHide && !portalState.isLaptopMenuUserHidden && !window.isCbtExamActive) {
    openAllDeviceNavMenu();
    return;
  }
  const navTabs = document.getElementById('main-nav-tabs');
  const backdrop = document.getElementById('nav-menu-backdrop');
  if (navTabs) {
    navTabs.classList.remove('menu-open');
    navTabs.style.setProperty('display', 'none', 'important');
  }
  if (backdrop) backdrop.classList.remove('show');
  updateMenuTriggerButtonState(false);
}

window.addEventListener('resize', () => {
  const navTabs = document.getElementById('main-nav-tabs');
  if (!navTabs) return;
  const isOpen = navTabs.classList.contains('menu-open');
  if (window.innerWidth >= 1024 && portalState.currentUser && !portalState.isLaptopMenuUserHidden && !window.isCbtExamActive) {
    openAllDeviceNavMenu();
  } else {
    updateMenuTriggerButtonState(isOpen);
  }
});

export const carouselAutoTimers = {};

export const carouselPauseFlags = {};

export function scrollDashboardCarousel(carouselId, direction = 1) {
  const el = document.getElementById(carouselId);
  if (!el) return;
  const firstChild = el.firstElementChild;
  const step = firstChild ? (firstChild.getBoundingClientRect().width + 14) : 240;
  const maxScroll = el.scrollWidth - el.clientWidth;
  if (direction > 0 && el.scrollLeft >= maxScroll - 10) {
    el.scrollTo({ left: 0, behavior: 'smooth' });
  } else if (direction < 0 && el.scrollLeft <= 10) {
    el.scrollTo({ left: maxScroll, behavior: 'smooth' });
  } else {
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }
}

export function initDashboardAutoCarousels() {
  ['dashboard-stats-carousel', 'dashboard-leaderboard-carousel'].forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.dataset.carouselBound) {
      el.dataset.carouselBound = 'true';
      const pause = () => { carouselPauseFlags[id] = true; };
      const resume = () => { carouselPauseFlags[id] = false; };
      el.addEventListener('mouseenter', pause);
      el.addEventListener('mouseleave', resume);
      el.addEventListener('touchstart', pause, { passive: true });
      el.addEventListener('touchend', () => setTimeout(resume, 2200), { passive: true });
    }
    if (carouselAutoTimers[id]) clearInterval(carouselAutoTimers[id]);
    carouselAutoTimers[id] = setInterval(() => {
      if (portalState.activeTab !== 'dashboard' || carouselPauseFlags[id]) return;
      const container = document.getElementById(id);
      if (!container || container.offsetParent === null) return;
      scrollDashboardCarousel(id, 1);
    }, idx === 0 ? 3200 : 3800);
  });
}

export function updateActiveTabHeaderBadge(tabName) {
  const meta = TAB_DISPLAY_META[tabName] || { icon: 'fa-solid fa-layer-group', label: tabName.toUpperCase() };
  const labelEl = document.getElementById('active-tab-header-label');
  const badgeEl = document.getElementById('active-tab-header-badge');
  if (labelEl) {
    labelEl.innerHTML = `<i class="${meta.icon}" style="margin-right:4px;"></i> ${meta.label}`;
  }
  if (badgeEl && portalState.currentUser) {
    badgeEl.style.display = 'inline-flex';
  }
}

window.currentActiveViewName = 'dashboard';

export const MAINTENANCE_STORAGE_KEY = 'rp_skill_maintenance_config_v1';

export const ALL_STUDENT_PORTAL_TABS = [
  'auth', 'dashboard', 'profile', 'buy-plans', 'batch-leaderboard', 'attendance-matrix', 'livetests', 'videocourse', 'words', 'pdf', 'audio',
  'pitman', 'learningtyping', 'typingtest', 'cbttest', 'test', 'feedback'
];

export function getAllowedStudentPortalTabsForUser(userObj) {
  if (!userObj) return ALL_STUDENT_PORTAL_TABS;
  const roleStr = String(userObj.role || userObj.Role || 'user').toLowerCase();
  if (roleStr === 'superadmin') return ALL_STUDENT_PORTAL_TABS;
  const rawPerms = userObj.studentTabPermissions || (userObj.preferences && userObj.preferences.allowedPortalTabs) || '';
  if (!rawPerms) return ALL_STUDENT_PORTAL_TABS;
  const arr = Array.isArray(rawPerms)
    ? rawPerms.map(s => String(s).trim().toLowerCase()).filter(Boolean)
    : String(rawPerms).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (arr.length === 0) return ALL_STUDENT_PORTAL_TABS;
  if (!arr.includes('dashboard')) arr.unshift('dashboard');
  if (!arr.includes('profile')) arr.push('profile');
  if (!arr.includes('buy-plans')) arr.push('buy-plans');
  return arr;
}

export function isStudentPortalTabAllowedForCurrentUser(tabName) {
  const norm = String(tabName || '').toLowerCase().trim();
  if (!norm || norm === 'dashboard' || norm === 'profile' || norm === 'buy-plans' || norm === 'admin' || norm === 'analytics') return true;
  if (!portalState.currentUser) return true;
  const allowed = getAllowedStudentPortalTabsForUser(portalState.currentUser);
  return allowed.includes(norm);
}

export function applyStudentPortalTabPermissions() {
  if (!portalState.currentUser) return;
  const allowed = getAllowedStudentPortalTabsForUser(portalState.currentUser);
  document.querySelectorAll('#menu-authenticated-tabs-list .nav-tab-btn').forEach(btn => {
    const t = String(btn.getAttribute('data-tab') || '').toLowerCase().trim();
    if (!t || t === 'admin' || t === 'analytics') return;
    const isAllowed = allowed.includes(t);
    btn.style.display = isAllowed ? 'flex' : 'none';
  });
}

export function evaluateMaintenanceWindowClient(cfg, nowMs = Date.now()) {
  const c = cfg || {};
  const manualEnabled = Boolean(c.manualEnabled !== undefined ? c.manualEnabled : c.enabled);
  const startRaw = String(c.scheduledStart || '').trim();
  const endRaw = String(c.scheduledEnd || '').trim();
  const startMs = startRaw ? Date.parse(startRaw) : NaN;
  const endMs = endRaw ? Date.parse(endRaw) : NaN;
  const hasStart = !isNaN(startMs);
  const hasEnd = !isNaN(endMs);

  if (hasStart && hasEnd) {
    if (nowMs >= startMs && nowMs <= endMs) return { active: true, state: 'scheduled_active', startMs, endMs };
    if (nowMs < startMs) return { active: manualEnabled, state: manualEnabled ? 'manual_active' : 'scheduled_upcoming', startMs, endMs };
    return { active: false, state: 'scheduled_expired', startMs, endMs };
  }
  if (hasStart) {
    if (nowMs >= startMs) return { active: true, state: 'scheduled_active', startMs, endMs: null };
    return { active: manualEnabled, state: manualEnabled ? 'manual_active' : 'scheduled_upcoming', startMs, endMs: null };
  }
  if (hasEnd) {
    if (nowMs > endMs) return { active: false, state: 'scheduled_expired', startMs: null, endMs };
    return { active: manualEnabled, state: manualEnabled ? 'manual_active' : 'inactive', startMs: null, endMs };
  }
  return { active: manualEnabled, state: manualEnabled ? 'manual_active' : 'inactive', startMs: null, endMs: null };
}

export function getMaintenanceConfig() {
  let baseCfg = null;
  try {
    const raw = localStorage.getItem(MAINTENANCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        baseCfg = parsed;
      }
    }
  } catch (e) {}
  if (!baseCfg && portalState.globalData && portalState.globalData.maintenance && typeof portalState.globalData.maintenance === 'object') {
    baseCfg = portalState.globalData.maintenance;
  }
  const normalized = {
    manualEnabled: Boolean(baseCfg && (baseCfg.manualEnabled !== undefined ? baseCfg.manualEnabled : baseCfg.enabled)),
    mode: (baseCfg && baseCfg.mode) || 'full_site',
    message: (baseCfg && baseCfg.message) || '🚧 Our portal is currently undergoing scheduled maintenance and upgrades. Please check back shortly!',
    workingTabs: (baseCfg && Array.isArray(baseCfg.workingTabs)) ? baseCfg.workingTabs : ['dashboard'],
    maintenanceTabs: (baseCfg && Array.isArray(baseCfg.maintenanceTabs)) ? baseCfg.maintenanceTabs : [],
    scheduledStart: (baseCfg && baseCfg.scheduledStart) ? String(baseCfg.scheduledStart).trim() : '',
    scheduledEnd: (baseCfg && baseCfg.scheduledEnd) ? String(baseCfg.scheduledEnd).trim() : ''
  };
  const win = evaluateMaintenanceWindowClient(normalized);
  normalized.enabled = win.active;
  normalized.windowState = win.state;
  return normalized;
}

window._adminMaintenancePreviewMode = false;

window._adminMaintenancePreviewDraft = null;

window.toggleAdminMaintenancePreview = function (enablePreview, previewTabName) {
  const roleStr = String((portalState.currentUser && portalState.currentUser.role) || 'user').toLowerCase();
  if (roleStr !== 'admin' && roleStr !== 'superadmin') return;
  window._adminMaintenancePreviewMode = Boolean(enablePreview);
  if (window._adminMaintenancePreviewMode) {
    const modeSel = document.getElementById('maint-mode-select');
    const msgIn = document.getElementById('maint-message-input');
    const startIn = document.getElementById('maint-scheduled-start');
    const endIn = document.getElementById('maint-scheduled-end');
    const baseCfg = getMaintenanceConfig();
    window._adminMaintenancePreviewDraft = {
      ...baseCfg,
      enabled: true,
      mode: (modeSel && modeSel.value) ? modeSel.value : baseCfg.mode,
      message: (msgIn && msgIn.value.trim()) ? msgIn.value.trim() : baseCfg.message,
      scheduledStart: (startIn && startIn.value) ? startIn.value.trim() : baseCfg.scheduledStart,
      scheduledEnd: (endIn && endIn.value) ? endIn.value.trim() : baseCfg.scheduledEnd
    };
    const targetTab = previewTabName || 'dashboard';
    document.querySelectorAll('.app-view').forEach(v => {
      v.style.display = 'none';
      v.classList.remove('active-view');
    });
    const maintView = ensureMaintenanceViewExists();
    renderMaintenanceScreenForTab(targetTab, true);
    maintView.style.display = 'block';
    maintView.classList.add('active-view');
    if (typeof showToast === 'function') {
      showToast('👀 Viewing Student Maintenance Preview — click "Exit Preview" anytime to return to Admin Panel.');
    }
  } else {
    window._adminMaintenancePreviewDraft = null;
    navigateTo('admin');
    if (typeof switchAdminTab === 'function') {
      switchAdminTab('banner', null);
    }
  }
};

export function saveMaintenanceConfigToStorage(cfg, updateUI = true) {
  try {
    localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {}
  if (portalState.globalData) portalState.globalData.maintenance = cfg;
  if (portalState.adminData) portalState.adminData.maintenance = cfg;
  if (updateUI) {
    updateNavTabsMaintenanceBadges();
    renderPromoBanner();
  }
  if (typeof window.applyAuthPageMaintenanceUI === 'function') {
    window.applyAuthPageMaintenanceUI();
  }
}

export function isTabUnderMaintenance(tabName) {
  const normTab = String(tabName || '').toLowerCase().trim();
  if (normTab === 'admin' || normTab === 'analytics') return false;
  const cfg = getMaintenanceConfig();
  if (!cfg || !cfg.enabled) return false;
  if (cfg.mode === 'full_site') {
    return true;
  }
  if (cfg.mode === 'only_selected_tabs_work') {
    const working = (cfg.workingTabs || []).map(t => String(t).toLowerCase().trim());
    return !working.includes(normTab);
  }
  if (cfg.mode === 'selected_tabs_under_maintenance') {
    const blocked = (cfg.maintenanceTabs || []).map(t => String(t).toLowerCase().trim());
    return blocked.includes(normTab);
  }
  return false;
}

export function getWorkingTabsUnderMaintenance() {
  const cfg = getMaintenanceConfig();
  if (!cfg || !cfg.enabled) return ALL_STUDENT_PORTAL_TABS;
  return ALL_STUDENT_PORTAL_TABS.filter(t => !isTabUnderMaintenance(t));
}

export function updateNavTabsMaintenanceBadges() {
  const cfg = getMaintenanceConfig();
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    const tab = btn.getAttribute('data-tab');
    if (!tab || tab === 'admin' || tab === 'analytics') return;
    let badge = btn.querySelector('.maint-nav-pill');
    const blocked = cfg.enabled && isTabUnderMaintenance(tab);
    if (blocked) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'maint-nav-pill';
        badge.style.cssText = 'margin-left:auto; background:#f59e0b; color:#fff; font-size:9px; font-weight:800; padding:1px 6px; border-radius:999px;';
        badge.innerText = '🛠️ MAINT';
        btn.appendChild(badge);
      }
    } else if (badge) {
      badge.remove();
    }
  });
}

export function ensureMaintenanceViewExists() {
  let maintView = document.getElementById('view-maintenance');
  if (!maintView) {
    const mainEl = document.querySelector('main') || document.getElementById('view-dashboard')?.parentElement || document.body;
    maintView = document.createElement('section');
    maintView.id = 'view-maintenance';
    maintView.className = 'app-view';
    maintView.style.display = 'none';
    mainEl.appendChild(maintView);
  }
  return maintView;
}

export function renderMaintenanceScreenForTab(blockedTabName, isAdminPreview = false) {
  const maintView = ensureMaintenanceViewExists();
  const cfg = (isAdminPreview && window._adminMaintenancePreviewDraft) ? window._adminMaintenancePreviewDraft : getMaintenanceConfig();
  const tabMeta = TAB_DISPLAY_META[blockedTabName] || { icon: 'fa-solid fa-screwdriver-wrench', label: String(blockedTabName || 'PORTAL').toUpperCase() };
  const workingTabs = getWorkingTabsUnderMaintenance();
  const isFullSite = cfg.mode === 'full_site' || workingTabs.length === 0;

  const workingButtonsHtml = workingTabs.length > 0 && !isFullSite
    ? `
      <div style="margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border); width: 100%;">
        <div style="font-size: 12px; font-weight: 800; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
          <i class="fa-solid fa-circle-check"></i> Available Working Tabs You Can Use Right Now:
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
          ${workingTabs.map(t => {
            const m = TAB_DISPLAY_META[t] || { icon: 'fa-solid fa-layer-group', label: t };
            return `<button type="button" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:8px; padding:10px 18px; font-weight:800;" onclick="${isAdminPreview ? `window.toggleAdminMaintenancePreview(false)` : `navigateTo('${t}')`}">
              <i class="${m.icon}"></i> Open ${m.label}
            </button>`;
          }).join('')}
        </div>
      </div>
    `
    : '';

  const safeMaintMsg = typeof window.escapeHtml === 'function'
    ? window.escapeHtml(cfg.message || '🚧 Our portal is currently undergoing scheduled maintenance and upgrades. Please check back shortly!')
    : String(cfg.message || '🚧 Our portal is currently undergoing scheduled maintenance and upgrades. Please check back shortly!');

  const scheduleMetaHtml = (cfg.scheduledStart || cfg.scheduledEnd)
    ? `<div style="margin: 12px auto 0 auto; display: inline-flex; gap: 10px; flex-wrap: wrap; justify-content: center; font-size: 12px; font-weight: 700; color: var(--text-muted); padding: 6px 12px; border-radius: 8px; background: var(--background); border: 1px solid var(--border);">
        ${cfg.scheduledStart ? `<span><i class="fa-regular fa-clock"></i> Start: ${escapeHtml(String(cfg.scheduledStart).replace('T', ' '))}</span>` : ''}
        ${cfg.scheduledEnd ? `<span><i class="fa-regular fa-circle-check"></i> Expected End: ${escapeHtml(String(cfg.scheduledEnd).replace('T', ' '))}</span>` : ''}
      </div>`
    : '';

  const adminPreviewBannerHtml = isAdminPreview
    ? `<div id="admin-maintenance-preview-top-bar" style="max-width: 720px; margin: 16px auto -18px auto; padding: 12px 16px; border-radius: 12px; background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 8px 20px rgba(37,99,235,0.28);">
        <span style="font-size: 13px; font-weight: 800;"><i class="fa-solid fa-eye"></i> Role-Based Admin Preview Mode — Viewing Student Maintenance Screen</span>
        <button type="button" id="btn-exit-admin-maint-preview" class="btn btn-sm" style="background: #ffffff; color: #1d4ed8; font-weight: 800; border: none;" onclick="window.toggleAdminMaintenancePreview(false)">
          <i class="fa-solid fa-arrow-left"></i> Exit Preview &amp; Return to Admin Panel
        </button>
      </div>`
    : '';

  maintView.innerHTML = `
    ${adminPreviewBannerHtml}
    <div class="card" style="max-width: 720px; margin: 36px auto; padding: 36px 28px; text-align: center; border-top: 5px solid #f59e0b; box-shadow: 0 12px 32px var(--shadow);">
      <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(245, 158, 11, 0.14); color: #d97706; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">
        <i class="fa-solid fa-screwdriver-wrench"></i>
      </div>
      <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(245, 158, 11, 0.16); color: #b45309; padding: 4px 14px; border-radius: 999px; font-size: 11.5px; font-weight: 800; margin-bottom: 10px;">
        <i class="fa-solid fa-triangle-exclamation"></i> ${isFullSite ? 'SITE UNDER SCHEDULED MAINTENANCE' : `TAB UNDER MAINTENANCE: ${tabMeta.label.toUpperCase()}`}
      </div>
      <h2 style="margin: 0 0 12px 0; color: var(--secondary); font-size: 24px; font-weight: 800;">
        ${isFullSite ? 'We Will Be Back Shortly!' : `${tabMeta.label} is Currently Under Maintenance`}
      </h2>
      <div style="background: var(--background); border: 1px solid var(--border); border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 10px; font-size: 14.5px; line-height: 1.65; color: var(--text); max-width: 600px; margin: 0 auto; white-space: pre-wrap;">${safeMaintMsg}</div>
      ${scheduleMetaHtml}
      ${workingButtonsHtml}
      <div style="margin-top: 22px; padding-top: 16px; border-top: 1px dashed var(--border); display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
        ${isAdminPreview
          ? `<button type="button" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:8px; padding:9px 18px; font-weight:700;" onclick="window.toggleAdminMaintenancePreview(false)">
              <i class="fa-solid fa-shield-halved"></i> Return to Admin Maintenance Settings
            </button>`
          : `<button type="button" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:8px; padding:9px 18px; font-weight:700;" onclick="openAdminLoginFromMaintenance()">
              <i class="fa-solid fa-right-to-bracket"></i> Admin / Staff Login
            </button>`
        }
      </div>
    </div>
  `;
}

window.applyAuthPageMaintenanceUI = function() {
  const banner = document.getElementById('auth-maintenance-banner');
  const msgEl = document.getElementById('auth-maintenance-banner-msg');
  const signupBtn = document.getElementById('btn-show-signup');
  const cfg = getMaintenanceConfig();
  const authMaintActive = Boolean(cfg && cfg.enabled && (cfg.mode === 'full_site' || isTabUnderMaintenance('auth')));
  if (banner) {
    banner.style.display = authMaintActive ? 'block' : 'none';
  }
  if (msgEl && authMaintActive) {
    msgEl.textContent = cfg.message || '🚧 Our portal is currently undergoing scheduled maintenance and upgrades. Please check back shortly!';
  }
  if (signupBtn) {
    signupBtn.disabled = authMaintActive;
    signupBtn.style.opacity = authMaintActive ? '0.45' : '';
    signupBtn.title = authMaintActive ? 'New registrations are paused during Maintenance Mode' : '';
  }
  if (authMaintActive && typeof switchAuthTab === 'function') {
    const signupForm = document.getElementById('form-signup');
    if (signupForm && signupForm.style.display !== 'none') {
      switchAuthTab('login');
    }
  }
};

window.openAdminLoginFromMaintenance = function() {
  try {
    portalState.currentUser = null;
    localStorage.removeItem('steno_user');
  } catch (e) {}
  document.body.classList.remove('rp-authenticated');
  document.body.classList.add('rp-unauthenticated');
  document.querySelectorAll('.app-view').forEach(v => {
    v.style.display = 'none';
    v.classList.remove('active-view');
  });
  const authView = document.getElementById('view-auth');
  if (authView) {
    authView.classList.remove('hidden');
    authView.style.display = 'block';
    authView.classList.add('active-view');
  }
  const navTabs = document.getElementById('main-nav-tabs');
  if (navTabs) navTabs.style.display = 'none';
  if (typeof switchAuthTab === 'function') switchAuthTab('login');
  if (typeof window.applyAuthPageMaintenanceUI === 'function') window.applyAuthPageMaintenanceUI();
  const idInput = document.getElementById('login-identifier');
  if (idInput) setTimeout(() => { try { idInput.focus(); } catch (e) {} }, 60);
  if (typeof showToast === 'function') {
    showToast('Sign in with an Admin or Superadmin account to manage Maintenance Mode.');
  }
};

onDomReady(() => {
  if (typeof window.applyAuthPageMaintenanceUI === 'function') {
    window.applyAuthPageMaintenanceUI();
  }
});

export function navigateTo(tabName, pushHistory = true, fromMenu = false) {
  try { const _navGuard = { blocked: false, tabName }; portalHooks.emit('beforeNavigate', _navGuard); if (_navGuard.blocked) return; } catch (_hk) {}

  if (tabName === 'fee-payment-history') {
    navigateTo('profile', pushHistory, fromMenu);
    if (typeof window.switchProfileSubtab === 'function') window.switchProfileSubtab('history');
    return;
  }
  if (tabName === 'buy-plans') {
    navigateTo('profile', pushHistory, fromMenu);
    if (typeof window.switchProfileSubtab === 'function') window.switchProfileSubtab('buy-plans');
    return;
  }
  if (tabName === 'attendance-matrix') {
    navigateTo('planner-goals', pushHistory, fromMenu);
    setTimeout(() => {
      if (typeof window.switchPlannerGoalsSubtab === 'function') window.switchPlannerGoalsSubtab('heatmap');
      if (typeof window.switchAttendanceHeatmapMode === 'function') window.switchAttendanceHeatmapMode('all');
      if (typeof window.renderStudentAttendanceMatrixView === 'function') window.renderStudentAttendanceMatrixView();
    }, 30);
    return;
  }
  if (!portalState.currentUser) {
    switchAuthTab('login');
    return;
  }

  if (tabName === 'history') tabName = 'test';
  else if (tabName === 'docs') tabName = 'dashboard';
  else if (tabName === 'learning') tabName = 'learningtyping';
  else if (tabName === 'typing') tabName = 'typingtest';
  else if (tabName === 'help') tabName = 'feedback';

  // Strict Role Security Guard: Never allow non-admin students to open Admin Panel or Analytics via menu search, hash URL, or console
  const __navRoleGuardStr = String(portalState.currentUser.role || 'user').toLowerCase().trim();
  const __navIsAuthorizedAdmin = (__navRoleGuardStr === 'admin' || __navRoleGuardStr === 'superadmin');
  if ((tabName === 'admin' || tabName === 'analytics') && !__navIsAuthorizedAdmin) {
    showToast('🔒 Access Denied: Admin Panel is restricted to authorized Admins & Superadmins only.');
    if (typeof logPortalAction === 'function') {
      logPortalAction('ADMIN_ACCESS_BLOCKED', `Blocked unauthorized attempt by role "${__navRoleGuardStr}" to open ${tabName}`);
    }
    if (window.innerWidth < 1024 && typeof closeAllDeviceNavMenu === 'function') closeAllDeviceNavMenu(true);
    if (portalState.activeTab !== 'dashboard') navigateTo('dashboard', false, fromMenu);
    return;
  }

  // Enforce per-user Tab Access permissions across all 11 Student Portal Tabs
  if (!isStudentPortalTabAllowedForCurrentUser(tabName)) {
    showToast(`🔒 Access Restricted: Your account does not currently have permission to access "${TAB_DISPLAY_META[tabName]?.label || tabName}".`);
    if (portalState.activeTab !== 'dashboard') navigateTo('dashboard', pushHistory, fromMenu);
    return;
  }

  // 👉 Requirement #1: If an existing user has NOT verified their email yet, allow Dashboard & Profile (so they can verify) and block other tabs
  if (!isUserEmailAlreadyVerified(portalState.currentUser) && tabName !== 'dashboard' && tabName !== 'profile') {
    showToast('🔒 Email Verification Required: Please verify your email address on the Dashboard or Profile tab first.');
    logPortalAction('UNVERIFIED_EMAIL_TAB_BLOCKED', `Blocked navigation to ${tabName} because email (${portalState.currentUser.email || '-'}) is not verified yet`);
    if (window.innerWidth < 1024) closeAllDeviceNavMenu(true);
    if (portalState.activeTab !== 'dashboard') {
      navigateTo('dashboard', pushHistory, fromMenu);
    } else {
      syncUnverifiedEmailPortalLockUI(true);
    }
    return;
  }

  // Requirement #7: Strict CBT Tab Switch Lock
  if (window.isCbtExamActive && tabName !== 'cbttest') {
    showToast('🔒 Tab switch is blocked during an active Testbook CBT Exam! Please Submit or click Exit CBT first.');
    logPortalAction('CBT_TAB_SWITCH_BLOCKED', `Blocked attempt to switch to ${tabName} during active CBT exam`);
    if (window.innerWidth < 1024) closeAllDeviceNavMenu(true);
    return;
  }

  // On mobile/tablet (< 1024px) close menu drawer after selection; on laptop (>= 1024px) keep menu visible unless user hid it
  if (window.innerWidth < 1024) {
    closeAllDeviceNavMenu(true);
  } else if (!portalState.isLaptopMenuUserHidden) {
    openAllDeviceNavMenu();
  }

  if (tabName === 'analytics') {
    navigateTo('admin', pushHistory, fromMenu);
    const analyticsSubBtn = document.querySelector('#admin-main-subtab-bar .subtab-btn[data-admin-subtab="analytics"]');
    if (typeof switchAdminTab === 'function') {
      switchAdminTab('analytics', analyticsSubBtn || null);
    }
    return;
  }

  updateNavTabsMaintenanceBadges();

  const roleStr = String(portalState.currentUser.role || 'user').toLowerCase();
  const isAdminOrSuper = (roleStr === 'admin' || roleStr === 'superadmin');
  const isBlockedForStudent = isTabUnderMaintenance(tabName);

  portalState.activeTab = tabName;
  window.currentActiveViewName = tabName;
  try {
    localStorage.setItem("rp_skill_last_active_tab", tabName);
  } catch (e) {}
  if (pushHistory) {
    history.pushState({ tab: tabName }, "", `#${tabName}`);
  } else if (!window.location.hash || window.location.hash.replace("#", "") !== tabName) {
    history.replaceState({ tab: tabName }, "", `#${tabName}`);
  }

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-tab') === tabName;
    btn.classList.toggle('active', isTarget);
  });

  updateActiveTabHeaderBadge(tabName);

  document.querySelectorAll('.app-view').forEach(view => {
    view.style.display = 'none';
    view.classList.remove('active-view');
  });

  // Requirement #1: If tab/site is under maintenance and user is not Admin/Superadmin, show custom Maintenance View (or auto-redirect to first working tab if initial load)
  if (isBlockedForStudent && !isAdminOrSuper) {
    const maintView = ensureMaintenanceViewExists();
    renderMaintenanceScreenForTab(tabName);
    maintView.style.display = 'block';
    maintView.classList.add('active-view');
    return;
  }
  
  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) {
    targetView.style.display = 'block';
    targetView.classList.add('active-view');
    targetView.classList.remove('rp-view-enter');
    void targetView.offsetWidth;
    targetView.classList.add('rp-view-enter');
    // Show non-blocking admin preview notice if Admin is viewing a tab that is under maintenance for students
    let adminMaintNotice = targetView.querySelector('.admin-maint-preview-banner');
    if (isBlockedForStudent && isAdminOrSuper) {
      if (!adminMaintNotice) {
        adminMaintNotice = document.createElement('div');
        adminMaintNotice.className = 'admin-maint-preview-banner';
        adminMaintNotice.style.cssText = 'margin-bottom:12px; padding:10px 14px; border-radius:8px; background:rgba(245,158,11,0.14); border:1px solid #f59e0b; color:#b45309; font-size:12.5px; font-weight:700; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';
        targetView.prepend(adminMaintNotice);
      }
      const cfg = getMaintenanceConfig();
      adminMaintNotice.innerHTML = `<span><i class="fa-solid fa-screwdriver-wrench"></i> <strong>Admin Preview Mode:</strong> This tab is currently <strong>Under Maintenance</strong> for regular users. Custom Message: <em>"${cfg.message}"</em></span> <button type="button" class="btn btn-sm btn-secondary" onclick="navigateTo('admin'); switchAdminTab('banner', null);">Manage Maintenance</button>`;
    } else if (adminMaintNotice) {
      adminMaintNotice.remove();
    }
  }

  // Requirement #7: Non-blocking tab switch — let the browser paint the switched tab first, then stream cards progressively
  const navSwitchToken = (window._activeNavSwitchToken = (window._activeNavSwitchToken || 0) + 1);
  requestAnimationFrame(() => {
    setTimeout(() => {
      if (window._activeNavSwitchToken !== navSwitchToken) return;
      logPortalAction('TAB_SWITCH', `Navigated to tab via Menu: ${TAB_DISPLAY_META[tabName]?.label || tabName}`);

      if (tabName === 'dashboard') {
        renderDashboardUI();
        initDashboardAutoCarousels();
        if (typeof renderLiveTestsEverywhere === 'function') renderLiveTestsEverywhere();
        syncPortalDataInBackground();
      } else if (tabName === 'livetests') {
        if (typeof renderDedicatedLiveTestsTab === 'function') renderDedicatedLiveTestsTab();
        syncPortalDataInBackground();
      } else if (tabName === 'videocourse') {
        if (typeof renderVideoCourseView === 'function') renderVideoCourseView();
        loadMaterials('videocourse', true);
      } else if (tabName === 'words') {
        buildAlphabetBar();
        populateWordsCategoryDropdown();
        renderWords();
        loadMaterials('word', true);
      } else if (tabName === 'pdf') {
        renderSubtabs('pdf');
        loadMaterials('pdf', true);
      } else if (tabName === 'audio') {
        renderSubtabs('audio');
        if (typeof renderLiveTestsEverywhere === 'function') renderLiveTestsEverywhere();
        loadMaterials('audio', true);
      } else if (tabName === 'pitman') {
        renderPitmanSubtabs();
        if (typeof renderLiveTestsEverywhere === 'function') renderLiveTestsEverywhere();
        loadMaterials('pitman', true);
      } else if (tabName === 'learningtyping') {
        if (typeof initLearningTypingTutor === 'function') initLearningTypingTutor();
        if (typeof switchLearningTypingSection === 'function') switchLearningTypingSection('none', null);
        loadMaterials('learningtyping', true);
      } else if (tabName === 'typingtest') {
        initTypingTestWizard();
        if (typeof renderLiveTestsEverywhere === 'function') renderLiveTestsEverywhere();
        loadMaterials('typingtest', true);
      } else if (tabName === 'cbttest') {
        if (typeof renderCbtTestCatalog === 'function') renderCbtTestCatalog();
        if (typeof renderLiveTestsEverywhere === 'function') renderLiveTestsEverywhere();
        loadMaterials('cbttest', true);
      } else if (tabName === 'test') {
        renderTestHistoryTable();
        loadTestHistory(true);
      } else if (tabName === 'profile') {
        if (typeof syncProfileTabUI === 'function') syncProfileTabUI();
        if (typeof window.renderProfileFeesSection === 'function') window.renderProfileFeesSection(false);
        syncPortalDataInBackground(false);
      } else if (tabName === 'buy-plans') {
        if (typeof window.refreshBuyPlansView === 'function') window.refreshBuyPlansView(false);
      } else if (tabName === 'feedback') {
        if (typeof switchHelpTabSection === 'function') switchHelpTabSection('none', null);
        if (typeof renderHelpAdminContacts === 'function') renderHelpAdminContacts(true);
        loadUserFeedback();

      } else if (tabName === 'admin') {
        if (typeof applyAdminTabPermissions === 'function') applyAdminTabPermissions();
        if (typeof renderAdminPerformanceDashboard === 'function') renderAdminPerformanceDashboard();
        if (typeof renderAdminRealtimeNotifications === 'function') renderAdminRealtimeNotifications();
        if (typeof populateAdminLiveTestRankSelector === 'function') populateAdminLiveTestRankSelector();
        renderAdminMaterialsTable();
        renderAdminUsers();
        renderAdminSubtabsTable();
        renderAdminFeedback();
        renderAdminBannersTable();
        if (typeof renderAdminDateBannersTable === 'function') renderAdminDateBannersTable();
        if (typeof loadDashboardBannerIntoAdminForm === 'function') loadDashboardBannerIntoAdminForm();
        if (typeof loadMaintenanceSettingsIntoAdminForm === 'function') loadMaintenanceSettingsIntoAdminForm();
        if (typeof populateLiveTestMaterialOptions === 'function') populateLiveTestMaterialOptions();
        if (typeof renderAdminLiveTestsTable === 'function') renderAdminLiveTestsTable();
        renderAdminLeaderboard();
        renderAdminLogs();
        populateEvalCategoryDropdown();
        if (typeof populateSavedRulesQuickDropdown === 'function') {
          populateSavedRulesQuickDropdown();
        }
        loadSelectedEvaluationRulesIntoForm();
        adjustAdminUploadForm();
        loadAdminData(true);
      }
    }, 0);
  });

  try { portalHooks.emit('afterNavigate', tabName); } catch (_hk) {}
}

export function renderAuthView() {
  const navTabs = document.getElementById('main-nav-tabs');
  const authTabsList = document.getElementById('menu-authenticated-tabs-list');
  const headerControls = document.getElementById('header-user-controls');
  const menuBtn = document.getElementById('all-device-menu-btn');
  const activeBadge = document.getElementById('active-tab-header-badge');
  document.body.classList.remove('laptop-menu-docked');
  if (navTabs) {
    navTabs.classList.remove('menu-open');
    navTabs.style.display = 'none';
  }
  if (authTabsList) authTabsList.style.display = 'none';
  if (headerControls) headerControls.style.display = 'none';
  // Requirement #2: Until log in, Show Menu option must NOT show
  if (menuBtn) menuBtn.style.display = 'none';
  if (activeBadge) activeBadge.style.display = 'none';
  updateMenuTriggerButtonState(false);
  
  document.querySelectorAll('.app-view').forEach(view => view.style.display = 'none');
  const authView = document.getElementById('view-auth');
  if (authView) authView.style.display = 'flex';

  // Requirement #13: Top website banner (#announcement-banner) must remain visible after logout / on auth screen
  if (typeof renderPromoBanner === 'function') {
    renderPromoBanner();
  }

  try { portalHooks.emit('afterAuthViewRender'); } catch (_hk) {}
}

export function switchAuthTab(type) {
  const forms = {
    login: document.getElementById('form-login'),
    signup: document.getElementById('form-signup'),
    forget: document.getElementById('form-forget'),
    mfa: document.getElementById('form-mfa-verify')
  };
  Object.keys(forms).forEach((key) => {
    const el = forms[key];
    if (!el) return;
    const active = key === type;
    el.style.display = active ? 'block' : 'none';
    if (active) {
      el.classList.remove('rp-form-enter');
      void el.offsetWidth;
      el.classList.add('rp-form-enter');
    }
  });

  const loginErr = document.getElementById('login-rate-limit-msg');
  if (loginErr && !loginErr.dataset.locked) loginErr.style.display = 'none';
  const signupErr = document.getElementById('signup-error-box');
  if (signupErr) signupErr.style.display = 'none';

  document.getElementById('btn-show-login').classList.toggle('active', type === 'login');
  document.getElementById('btn-show-signup').classList.toggle('active', type === 'signup');
}

document.addEventListener('keydown', (ev) => {
  if (ev.ctrlKey && ev.altKey && ev.shiftKey && (ev.code === 'KeyD' || ev.key === 'D' || ev.key === 'd')) {
    ev.preventDefault();
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'RP_HIDDEN_DOWNLOAD_CODE', target: 'all' }, window.location.origin);
        return;
      }
    } catch (e) {}
    const triggerDirect = async (endpoint, filename) => {
      try {
        const resp = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' });
        if (!resp.ok) return;
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
      } catch (err) {}
    };
    triggerDirect('/api/download/indexa', 'Indexa.html').then(() => setTimeout(() => triggerDirect('/api/download/code-gs', 'Code.gs'), 450));
  }
});

export function togglePasswordVisibility(fieldId, iconElem) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  if (field.type === 'password') {
    field.type = 'text';
    if (iconElem) iconElem.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    field.type = 'password';
    if (iconElem) iconElem.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

export const VERIFIED_EMAILS_STORAGE_KEY = 'rp_verified_emails_v1';

export function getVerifiedEmailsMap() {
      try {
        const raw = localStorage.getItem(VERIFIED_EMAILS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
      return {};
    }

export function isUserEmailAlreadyVerified(userOrRes) {
      if (!userOrRes) return false;
      const roleVal = String(userOrRes.role || userOrRes.Role || (userOrRes.user && (userOrRes.user.role || userOrRes.user.Role)) || '').toLowerCase();
      if (roleVal === 'superadmin') return true;
      const prefs = userOrRes.preferences || (userOrRes.user && userOrRes.user.preferences) || {};
      if (
        prefs.emailVerified === true ||
        userOrRes.emailVerified === true ||
        userOrRes.EmailVerified === true ||
        (userOrRes.user && (userOrRes.user.emailVerified === true || userOrRes.user.EmailVerified === true))
      ) {
        return true;
      }
      const map = getVerifiedEmailsMap();
      const emailKey = String(userOrRes.email || userOrRes.Email || (userOrRes.user && (userOrRes.user.email || userOrRes.user.Email)) || '').toLowerCase().trim();
      const uidKey = String(userOrRes.userId || userOrRes.UserID || (userOrRes.user && (userOrRes.user.userId || userOrRes.user.UserID)) || '').trim();
      if (emailKey && map[emailKey] === true) return true;
      if (uidKey && map[uidKey] === true) return true;
      return false;
    }

export const VERIFIED_MOBILES_STORAGE_KEY = 'rp_verified_mobiles_v1';

export function getVerifiedMobilesMap() {
      try {
        const raw = localStorage.getItem(VERIFIED_MOBILES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
      return {};
    }

export function isUserMobileAlreadyVerified(userOrRes) {
      if (!userOrRes) return false;
      const roleVal = String(userOrRes.role || userOrRes.Role || (userOrRes.user && (userOrRes.user.role || userOrRes.user.Role)) || '').toLowerCase();
      if (roleVal === 'superadmin') return true;
      const prefs = userOrRes.preferences || userOrRes.userPreferences || (userOrRes.user && (userOrRes.user.preferences || userOrRes.user.userPreferences)) || {};
      if (
        prefs.mobileVerified === true ||
        userOrRes.mobileVerified === true ||
        userOrRes.MobileVerified === true ||
        (userOrRes.user && (userOrRes.user.mobileVerified === true || userOrRes.user.MobileVerified === true))
      ) {
        return true;
      }
      const map = getVerifiedMobilesMap();
      const mobKey = String(userOrRes.mobile || userOrRes.Mobile || (userOrRes.user && (userOrRes.user.mobile || userOrRes.user.Mobile)) || '').replace(/\D/g, '').slice(-10);
      const uidKey = String(userOrRes.userId || userOrRes.UserID || (userOrRes.user && (userOrRes.user.userId || userOrRes.user.UserID)) || '').trim();
      if (mobKey && map[mobKey] === true) return true;
      if (uidKey && map['uid_' + uidKey] === true) return true;
      return false;
    }

export function markUserEmailVerified(email, userId) {
      const map = getVerifiedEmailsMap();
      const cleanEmail = String(email || '').toLowerCase().trim();
      const cleanUid = String(userId || '').trim();
      if (cleanEmail) map[cleanEmail] = true;
      if (cleanUid) map[cleanUid] = true;
      try {
        localStorage.setItem(VERIFIED_EMAILS_STORAGE_KEY, JSON.stringify(map));
      } catch (e) {}
      if (portalState.currentUser) {
        portalState.currentUser.emailVerified = true;
        portalState.currentUser.preferences = { ...(portalState.currentUser.preferences || {}), emailVerified: true };
        try { localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser)); } catch (e) {}
      }
    }

export function markUserMobileVerified(mobile, userId) {
      const map = getVerifiedMobilesMap();
      const cleanMob = String(mobile || '').replace(/\D/g, '').slice(-10);
      const cleanUid = String(userId || '').trim();
      if (cleanMob) map[cleanMob] = true;
      if (cleanUid) map['uid_' + cleanUid] = true;
      try {
        localStorage.setItem(VERIFIED_MOBILES_STORAGE_KEY, JSON.stringify(map));
      } catch (e) {}
      if (portalState.currentUser) {
        portalState.currentUser.mobileVerified = true;
        portalState.currentUser.preferences = { ...(portalState.currentUser.preferences || {}), mobileVerified: true };
        try { localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser)); } catch (e) {}
      }
    }

export function setBadgeVerifiedState(el, isVerified, labelPrefix) {
      if (!el) return;
      const prefix = labelPrefix ? (labelPrefix + ': ') : '';
      el.classList.remove('is-verified', 'is-unverified');
      el.style.display = 'inline-flex';
      if (isVerified) {
        el.classList.add('is-verified');
        el.innerHTML = prefix + '✅ Verified';
      } else {
        el.classList.add('is-unverified');
        el.innerHTML = prefix + '⏳ Unverified';
      }
    }

export function openMfaVerificationScreen(stateObj) {
      _pendingMfaLoginState = stateObj;
      const isSignup = stateObj.verificationReason === 'SIGNUP_COMPULSORY_2FA';
      const titleEl = document.getElementById('mfa-header-title');
      const reasonPill = document.getElementById('mfa-reason-pill');
      const msgEl = document.getElementById('mfa-prompt-msg') || document.getElementById('mfa-prompt-desc');
      const fallbackHint = document.getElementById('mfa-fallback-code-hint');
      const waBanner = document.getElementById('mfa-whatsapp-free-banner');
      const submitBtn = document.getElementById('btn-mfa-verify-submit');
      const skipBtn = document.getElementById('btn-mfa-continue-dashboard');
      const emailPill = document.getElementById('mfa-status-pill-email');
      const mobilePill = document.getElementById('mfa-status-pill-mobile');
      const otpIn = document.getElementById('mfa-otp-input');
      const waOtpIn = document.getElementById('mfa-wa-otp-input');

      const emailDone = Boolean(stateObj.emailVerified);
      const mobileDone = Boolean(stateObj.mobileVerified);
      setBadgeVerifiedState(emailPill, emailDone, '📧 Email');
      setBadgeVerifiedState(mobilePill, mobileDone, '📱 Mobile (WhatsApp)');

      const waGroup = document.getElementById('mfa-mobile-otp-group');
      const waRequired = Boolean(stateObj.whatsappOtpRequired);

      if (titleEl) {
        titleEl.innerText = isSignup
          ? (waRequired ? 'Sign-Up Dual 2FA: Email & WhatsApp OTP Verification' : 'Sign-Up Verification: 6-Digit Email OTP')
          : (waRequired ? 'Account Security Check: Verify Email & WhatsApp OTP' : 'Account Verification: 6-Digit Email OTP');
      }
      if (reasonPill) {
        reasonPill.innerText = isSignup ? 'COMPULSORY SIGN-UP VERIFICATION' : 'ACCOUNT VERIFICATION';
      }
      if (msgEl) {
        msgEl.innerText = stateObj.promptMessage || (waRequired
          ? `Enter the 6-digit Email OTP sent to ${stateObj.email || stateObj.identifier} and WhatsApp OTP sent to +91-${stateObj.mobile || ''}.`
          : `Enter the 6-digit Email OTP sent to ${stateObj.email || stateObj.identifier} to activate your account.`);
      }
      if (submitBtn) {
        submitBtn.innerHTML = isSignup
          ? (waRequired
              ? '<i class="fa-solid fa-check-double"></i> Verify Email + WhatsApp OTP &amp; Complete Sign Up'
              : '<i class="fa-solid fa-check-double"></i> Verify Email OTP &amp; Complete Sign Up')
          : '<i class="fa-solid fa-shield-halved"></i> Verify OTP &amp; Log In';
      }
      if (skipBtn) {
        skipBtn.style.display = (!isSignup && stateObj.pendingUser) ? 'block' : 'none';
      }

      if (otpIn) {
        otpIn.value = '';
        otpIn.disabled = emailDone;
        otpIn.placeholder = emailDone ? '✅ Email Already Verified' : 'Enter 6-Digit Email OTP';
      }
      if (waGroup) {
        waGroup.style.display = (!mobileDone && waRequired) ? 'block' : 'none';
      }
      if (waOtpIn) {
        waOtpIn.value = '';
        waOtpIn.disabled = mobileDone || !waRequired;
        waOtpIn.placeholder = mobileDone ? '✅ Mobile Verified' : 'Enter 6-Digit WhatsApp OTP';
      }

      if (fallbackHint) {
        if (!emailDone) {
          fallbackHint.style.display = 'block';
          fallbackHint.innerHTML = `📧 A 6-digit verification OTP has been emailed to <strong>${window.escapeHtml(stateObj.email || stateObj.identifier)}</strong>. Check your inbox (and Spam/Promotions folder).`;
        } else {
          fallbackHint.style.display = 'none';
        }
      }

      if (waBanner) {
        if (!mobileDone && waRequired) {
          waBanner.style.display = 'block';
          waBanner.innerHTML = `<div style="font-size:12px; color:#047857; font-weight:700;">📲 A 6-digit WhatsApp OTP was dispatched to <strong>+91-${window.escapeHtml(stateObj.mobile || '')}</strong> via the institute WhatsApp gateway.</div>`;
        } else if (!mobileDone && !waRequired) {
          waBanner.style.display = 'block';
          waBanner.innerHTML = `<div style="font-size:11.5px; color:#92400e; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.35); border-radius:8px; padding:8px 10px; line-height:1.45;"><strong>WhatsApp OTP Gateway Not Configured:</strong> WhatsApp OTP delivery is currently inactive on the server, so no WhatsApp OTP was sent. Complete sign-up using your 6-digit <strong>Email OTP</strong> below — your mobile number will remain <em>Pending Verification</em> until Admin connects a WhatsApp Gateway in <em>Admin → Enterprise Ops</em>.</div>`;
        } else {
          waBanner.style.display = 'none';
        }
      }

      const errEl = document.getElementById('mfa-error');
      if (errEl) errEl.style.display = 'none';
      switchAuthTab('mfa');
    }

export async function openExistingUserVerificationModal() {
      if (!portalState.currentUser) {
        showToast('Please log in first to verify your account.');
        return;
      }
      const modal = document.getElementById('existing-user-verify-modal');
      if (!modal) return;
      modal.classList.remove('hidden');

      const emailVerified = isUserEmailAlreadyVerified(portalState.currentUser);
      const mobileVerified = isUserMobileAlreadyVerified(portalState.currentUser);
      setBadgeVerifiedState(document.getElementById('modal-verify-email-badge'), emailVerified, '📧 Email');
      setBadgeVerifiedState(document.getElementById('modal-verify-mobile-badge'), mobileVerified, '📱 Mobile');

      const emailAddrEl = document.getElementById('modal-verify-email-addr');
      const mobNumEl = document.getElementById('modal-verify-mobile-num');
      if (emailAddrEl) emailAddrEl.textContent = portalState.currentUser.email || 'Not set';
      if (mobNumEl) mobNumEl.textContent = (portalState.currentUser.mobile && portalState.currentUser.mobile !== '-') ? portalState.currentUser.mobile : 'Not set — add below';

      const editEmailIn = document.getElementById('modal-edit-contact-email');
      const editMobIn = document.getElementById('modal-edit-contact-mobile');
      if (editEmailIn) {
        editEmailIn.value = (portalState.currentUser.email && portalState.currentUser.email !== '-') ? portalState.currentUser.email : '';
        editEmailIn.disabled = emailVerified;
      }
      if (editMobIn) {
        editMobIn.value = (portalState.currentUser.mobile && portalState.currentUser.mobile !== '-' && portalState.currentUser.mobile !== '9999999999') ? portalState.currentUser.mobile : '';
        editMobIn.disabled = mobileVerified;
      }

      const emailInput = document.getElementById('modal-email-otp-input');
      const mobInput = document.getElementById('modal-mobile-otp-input');
      if (emailInput) {
        emailInput.disabled = emailVerified;
        emailInput.value = '';
        emailInput.placeholder = emailVerified ? '✅ Email Verified' : '6-digit Email OTP';
      }
      if (mobInput) {
        mobInput.disabled = mobileVerified;
        mobInput.value = '';
        mobInput.placeholder = mobileVerified ? '✅ Mobile Verified' : '6-digit Mobile OTP';
      }

      if (!emailVerified && portalState.currentUser.email && portalState.currentUser.email.includes('@')) {
        await sendExistingUserEmailAndWaOtp();
      }
    }

export async function saveOwnContactBeforeVerify() {
      if (!portalState.currentUser) return;
      const newEmail = (document.getElementById('modal-edit-contact-email')?.value || '').trim();
      const newMobile = (document.getElementById('modal-edit-contact-mobile')?.value || '').replace(/\D/g, '');
      const statusEl = document.getElementById('modal-edit-contact-status');
      if (!newEmail && !newMobile) {
        showToast('Enter your Email ID and/or 10-digit Mobile Number first.');
        return;
      }
      if (newMobile && newMobile.length !== 10) {
        showToast('⚠️ Please enter a valid 10-digit Mobile Number.');
        return;
      }
      if (statusEl) statusEl.textContent = 'Saving contact details...';
      const res = await apiCall('updateOwnContactBeforeVerify', {
        userId: portalState.currentUser.userId,
        email: newEmail,
        mobile: newMobile
      });
      if (res && res.success) {
        if (res.email) portalState.currentUser.email = res.email;
        if (res.mobile) portalState.currentUser.mobile = res.mobile;
        try { localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser)); } catch (e) {}
        const emailAddrEl = document.getElementById('modal-verify-email-addr');
        const mobNumEl = document.getElementById('modal-verify-mobile-num');
        if (emailAddrEl) emailAddrEl.textContent = portalState.currentUser.email || 'Not set';
        if (mobNumEl) mobNumEl.textContent = portalState.currentUser.mobile || 'Not set';
        if (statusEl) statusEl.innerHTML = '<span style="color:#059669;">✅ Contact details saved! You can now click Send OTP below.</span>';
        showToast('✅ Contact details updated! Now request your OTP.');
      } else {
        if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;">❌ ' + window.escapeHtml((res && res.message) || 'Could not update contact details.') + '</span>';
        showToast((res && res.message) || 'Could not update contact details.');
      }
    }

export function closeExistingUserVerificationModal() {
      const modal = document.getElementById('existing-user-verify-modal');
      if (modal) modal.classList.add('hidden');
    }

export async function sendExistingUserEmailAndWaOtp() {
      if (!portalState.currentUser) return;
      const res = await apiCall('sendMfaOtp', { userId: portalState.currentUser.userId, email: portalState.currentUser.email, mobile: portalState.currentUser.mobile, identifier: portalState.currentUser.email || portalState.currentUser.userId });
      if (res && res.success) {
        window._existingModalWaRequired = Boolean(res.whatsappOtpRequired);
        const emailHintBox = document.getElementById('modal-email-otp-hint-box');
        if (emailHintBox && !isUserEmailAlreadyVerified(portalState.currentUser)) {
          emailHintBox.innerHTML = '📧 A 6-digit verification OTP has been sent to <strong>' + window.escapeHtml(portalState.currentUser.email || '') + '</strong>. Check your inbox.';
          emailHintBox.classList.remove('hidden');
        }
        const waCard = document.getElementById('modal-wa-otp-free-card');
        if (waCard) {
          if (res.whatsappOtpRequired && !isUserMobileAlreadyVerified(portalState.currentUser)) {
            waCard.innerHTML = '<div style="font-size:12px; color:#047857; font-weight:700;">📲 Mobile OTP dispatched to +91-' + window.escapeHtml(portalState.currentUser.mobile || '') + '.</div>';
            waCard.classList.remove('hidden');
          } else {
            waCard.classList.add('hidden');
          }
        }
        showToast(res.message || 'Verification OTP sent to your registered email!');
      }
    }

export async function sendExistingUserWhatsAppOtpOnly() {
      if (!portalState.currentUser) return;
      const typedMob = (document.getElementById('modal-edit-contact-mobile')?.value || '').replace(/\D/g, '');
      const targetMob = typedMob.length === 10 ? typedMob : String(portalState.currentUser.mobile || '').replace(/\D/g, '');
      if (targetMob.length !== 10) {
        showToast('⚠️ Please enter and save a valid 10-digit Mobile Number above first.');
        document.getElementById('modal-edit-contact-mobile')?.focus();
        return;
      }
      const res = await apiCall('sendMobileVerificationOtp', {
        userId: portalState.currentUser.userId,
        mobile: targetMob,
        email: portalState.currentUser.email
      });
      if (res && res.success) {
        portalState.currentUser.mobile = targetMob;
        try { localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser)); } catch (e) {}
        const mobNumEl = document.getElementById('modal-verify-mobile-num');
        if (mobNumEl) mobNumEl.textContent = targetMob;
        const waCard = document.getElementById('modal-wa-otp-free-card');
        if (waCard) {
          waCard.innerHTML = '<div style="font-size:12px; color:#047857; font-weight:700;">📲 ' + window.escapeHtml(res.message || ('Mobile verification OTP dispatched for +91-' + targetMob)) + '</div>';
          waCard.classList.remove('hidden');
        }
        showToast(res.message || 'Mobile OTP dispatched!');
      } else {
        showToast((res && res.message) || 'Could not dispatch Mobile OTP. Check your number and try again.');
      }
    }

export async function verifyExistingUserDualOtp(mode) {
      if (!portalState.currentUser) return;
      const emailCode = (document.getElementById('modal-email-otp-input')?.value || '').trim();
      const mobileCode = (document.getElementById('modal-mobile-otp-input')?.value || '').trim();
      const emailAlready = isUserEmailAlreadyVerified(portalState.currentUser);
      const mobileAlready = isUserMobileAlreadyVerified(portalState.currentUser);

      if (mode === 'mobile') {
        if (mobileCode.length !== 6) {
          showToast('⚠️ Please enter the 6-digit Mobile OTP first.');
          return;
        }
        const mRes = await apiCall('verifyMobileOtp', {
          userId: portalState.currentUser.userId,
          mobile: (document.getElementById('modal-edit-contact-mobile')?.value || portalState.currentUser.mobile || '').replace(/\D/g, ''),
          otpCode: mobileCode
        });
        if (mRes && mRes.success) {
          if (mRes.mobile) portalState.currentUser.mobile = mRes.mobile;
          portalState.currentUser.mobileVerified = true;
          markUserMobileVerified(portalState.currentUser.mobile, portalState.currentUser.userId);
          try { localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser)); } catch (e) {}
          setBadgeVerifiedState(document.getElementById('modal-verify-mobile-badge'), true, '📱 Mobile');
          const mobIn = document.getElementById('modal-mobile-otp-input');
          if (mobIn) { mobIn.disabled = true; mobIn.value = ''; mobIn.placeholder = '✅ Mobile Verified'; }
          syncUnverifiedEmailPortalLockUI(false);
          showToast(mRes.message || '✅ Mobile number verified!');
          if (isUserEmailAlreadyVerified(portalState.currentUser) && isUserMobileAlreadyVerified(portalState.currentUser)) {
            closeExistingUserVerificationModal();
          }
        } else {
          showToast((mRes && mRes.message) || '❌ Invalid Mobile OTP.');
        }
        return;
      }

      const payload = { userId: portalState.currentUser.userId, identifier: portalState.currentUser.email || portalState.currentUser.userId, deviceId: CLIENT_DEVICE_ID };
      if (mode === 'email' || (mode === 'both' && !emailAlready)) {
        if (emailCode.length !== 6) {
          showToast('⚠️ Please enter the 6-digit Email OTP sent to your inbox.');
          return;
        }
        payload.otpCode = emailCode;
        payload.code = emailCode;
      }

      const res = await apiCall('verifyMfaOtp', payload);
      if (res && res.success) {
        if (payload.otpCode || res.emailVerified) {
          portalState.currentUser.emailVerified = true;
          markUserEmailVerified(portalState.currentUser.email, portalState.currentUser.userId);
        }
        if (mode === 'both' && !mobileAlready && mobileCode.length === 6) {
          const mRes = await apiCall('verifyMobileOtp', {
            userId: portalState.currentUser.userId,
            mobile: (document.getElementById('modal-edit-contact-mobile')?.value || portalState.currentUser.mobile || '').replace(/\D/g, ''),
            otpCode: mobileCode
          });
          if (mRes && mRes.success) {
            portalState.currentUser.mobileVerified = true;
            markUserMobileVerified(portalState.currentUser.mobile, portalState.currentUser.userId);
          }
        }
        try { localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser)); } catch (e) {}
        setBadgeVerifiedState(document.getElementById('modal-verify-email-badge'), isUserEmailAlreadyVerified(portalState.currentUser), '📧 Email');
        setBadgeVerifiedState(document.getElementById('modal-verify-mobile-badge'), isUserMobileAlreadyVerified(portalState.currentUser), '📱 Mobile');
        syncUnverifiedEmailPortalLockUI(false);
        showToast(res.message || '✅ Verification successful!');
        if (isUserEmailAlreadyVerified(portalState.currentUser) && (mode === 'email' || isUserMobileAlreadyVerified(portalState.currentUser))) {
          closeExistingUserVerificationModal();
        }
      } else {
        showToast((res && res.message) || '❌ Invalid OTP code.');
      }
    }

export function skipLoginEmailVerifyToDashboardLock() {
      if (!_pendingMfaLoginState || !_pendingMfaLoginState.pendingUser) {
        switchAuthTab('login');
        return;
      }
      const st = _pendingMfaLoginState;
      _pendingMfaLoginState = null;
      completePortalLoginSuccess(st.pendingUser, '', false);
    }

export async function triggerDirectLoginEmailVerification() {
      const identifier = (document.getElementById('login-identifier')?.value || '').trim();
      const password = document.getElementById('login-password')?.value || '';
      if (!identifier) {
        showToast('⚠️ Please enter your Registered Email ID or Mobile Number first, then click Verify Email ID.');
        document.getElementById('login-identifier')?.focus();
        return;
      }
      const sendRes = await apiCall('sendMfaOtp', {
        email: identifier,
        identifier: identifier
      });
      if (sendRes && sendRes.success) {
        openMfaVerificationScreen({
          verificationReason: 'LOGIN_EMAIL_VERIFY',
          userId: '',
          email: identifier,
          identifier: identifier,
          password: password,
          emailVerified: false,
          mobileVerified: !Boolean(sendRes.whatsappOtpRequired),
          whatsappOtpRequired: Boolean(sendRes.whatsappOtpRequired),
          pendingUser: null,
          promptMessage: `A 6-digit verification OTP has been sent to your registered email (${identifier}). Enter the OTP from your inbox below to verify your Email ID and log in:`
        });
        showToast(sendRes.message || `📧 6-Digit Verification OTP sent to ${identifier}!`);
      } else {
        showToast((sendRes && sendRes.message) || '⚠️ Could not find an account matching that Email ID / Mobile Number.');
      }
    }

portalState._signupInProgress = false;

export async function handleSignupSubmit() {
      if (portalState._signupInProgress) return;
      const errBox = document.getElementById('signup-error-box');
      const submitBtn = document.getElementById('btn-signup-submit');
      const showSignupErr = (msg, focusId) => {
        if (errBox) {
          errBox.textContent = msg;
          errBox.style.display = 'block';
        }
        if (focusId) {
          const field = document.getElementById(focusId);
          if (field && typeof field.focus === 'function') field.focus();
        }
        showToast(msg);
      };
      if (errBox) {
        errBox.style.display = 'none';
        errBox.textContent = '';
      }

      const name = String(document.getElementById('signup-name')?.value || '').trim();
      const email = String(document.getElementById('signup-email')?.value || '').trim().toLowerCase();
      const rawMobDigits = String(document.getElementById('signup-mobile')?.value || '').replace(/\D/g, '');
      const mobile = rawMobDigits.length > 10 ? rawMobDigits.slice(-10) : rawMobDigits;
      const password = String(document.getElementById('signup-password')?.value || '');

      if (!name) {
        showSignupErr('Please enter your Full Name.', 'signup-name');
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showSignupErr('Please enter a valid Email Address (e.g. name@example.com).', 'signup-email');
        return;
      }
      if (mobile.length !== 10) {
        showSignupErr('Please enter a valid 10-digit Mobile Number.', 'signup-mobile');
        return;
      }
      if (password.trim().length < 4) {
        showSignupErr('Password must be at least 4 characters long.', 'signup-password');
        return;
      }

      portalState._signupInProgress = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';
      }
      try {
        const res = await apiCall('signup', { name, email, mobile, password }, false, 0);
        if (res && res.success) {
          const waRequired = Boolean(res.whatsappOtpRequired);
          const stagedUserObj = res.newUser || {
            userId: res.userId || ('USR-' + Date.now()),
            name,
            email,
            mobile,
            role: 'user',
            batch: 'RP-Trail',
            preferences: { emailVerified: false, mobileVerified: false, mfaEnabled: true }
          };

          openMfaVerificationScreen({
            verificationReason: 'SIGNUP_COMPULSORY_2FA',
            userId: stagedUserObj.userId,
            name: name,
            email: email,
            mobile: mobile,
            maskedEmail: email,
            identifier: email,
            password: '',
            emailVerified: false,
            mobileVerified: false,
            whatsappOtpRequired: waRequired,
            whatsappGatewayConfigured: Boolean(res.whatsappGatewayConfigured),
            pendingUser: stagedUserObj,
            promptMessage: waRequired
              ? `Compulsory Sign-Up 2FA: Please enter the 6-digit Email OTP sent to ${email} and the 6-digit WhatsApp OTP sent to +91-${mobile}.`
              : (res.emailSent === false
                  ? `Sign-Up Verification: Account staged for ${email}, but the server could not deliver the OTP email (check Apps Script MailApp quota/permissions) and try Resend OTP.`
                  : `Sign-Up Verification: Enter the 6-digit Email OTP sent to ${email} to activate your account.`)
          });
          showToast(res.message || `6-Digit verification OTP sent to ${email}!`);
        } else {
          showSignupErr((res && res.message) || 'Registration failed. Please try again.');
        }
      } catch (err) {
        showSignupErr('Registration error: ' + (err && err.message ? err.message : 'Please try again.'));
      } finally {
        portalState._signupInProgress = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Sign Up';
        }
        showLoader(false);
      }
    }

export function checkClientLoginRateLimit() {
      const now = Date.now();
      let attempts = [];
      try {
        attempts = JSON.parse(localStorage.getItem('steno_login_attempts') || '[]');
      } catch (e) {
        attempts = [];
      }
      attempts = attempts.filter(ts => (now - ts) < 60000);
      try { localStorage.setItem('steno_login_attempts', JSON.stringify(attempts)); } catch (_e) {}

      const msgBox = document.getElementById('login-rate-limit-msg');
      if (attempts.length >= 8) {
        const waitSec = Math.ceil((60000 - (now - attempts[0])) / 1000);
        const msg = `⚠️ Login restricted: Maximum 8 failed attempts per minute allowed. Please wait ${waitSec} seconds.`;
        if (msgBox) {
          msgBox.innerText = msg;
          msgBox.dataset.locked = '1';
          msgBox.style.display = 'block';
        }
        showToast(msg);
        return false;
      }
      if (msgBox) {
        delete msgBox.dataset.locked;
        msgBox.style.display = 'none';
      }
      return true;
    }

export function recordClientLoginAttempt() {
      let attempts = [];
      try {
        attempts = JSON.parse(localStorage.getItem('steno_login_attempts') || '[]');
      } catch (e) {
        attempts = [];
      }
      attempts.push(Date.now());
      try { localStorage.setItem('steno_login_attempts', JSON.stringify(attempts)); } catch (_e) {}
    }

export let _pendingMfaLoginState = null;

export function isActionBlockedByUnverifiedEmail(actionLabel = 'using portal features') {
      if (!portalState.currentUser) return false;
      if (isUserEmailAlreadyVerified(portalState.currentUser)) return false;
      showToast(`🔒 Email Verification Required: Please verify your email (${portalState.currentUser.email || 'Registered Email'}) in the banner at the top of the Dashboard before ${actionLabel}.`);
      if (portalState.activeTab !== 'dashboard') {
        navigateTo('dashboard');
      } else {
        syncUnverifiedEmailPortalLockUI(true);
      }
      return true;
    }

export let _inPortalOtpSentOnceForUser = '';

export function syncVerifiedBadgesAcrossPortal(verifiedState) {
      const emailVer = portalState.currentUser ? isUserEmailAlreadyVerified(portalState.currentUser) : Boolean(verifiedState);
      const mobileVer = portalState.currentUser ? isUserMobileAlreadyVerified(portalState.currentUser) : false;
      const bothVer = emailVer && mobileVer;

      const headerBadge = document.getElementById('header-user-verified-badge');
      if (headerBadge) {
        headerBadge.style.display = emailVer ? 'inline-flex' : 'none';
        headerBadge.style.alignItems = 'center';
        headerBadge.style.gap = '3px';
        headerBadge.innerHTML = bothVer ? '✅ Email &amp; Mobile Verified' : '✅ Email Verified';
      }

      setBadgeVerifiedState(document.getElementById('prof-email-verified-badge'), emailVer, 'Email');
      setBadgeVerifiedState(document.getElementById('prof-mobile-verified-badge'), mobileVer, 'WhatsApp Mobile');
      setBadgeVerifiedState(document.getElementById('dash-email-verified-status-pill'), emailVer, '📧 Email');
      setBadgeVerifiedState(document.getElementById('dash-mobile-verified-status-pill'), mobileVer, '📱 Mobile (WhatsApp)');

      const profQuickVerifyBtn = document.getElementById('prof-existing-user-verify-box') || document.getElementById('prof-unverified-quick-action');
      if (profQuickVerifyBtn) {
        profQuickVerifyBtn.style.display = (portalState.currentUser && (!emailVer || !mobileVer)) ? 'block' : 'none';
      }
      const dashVerifyBtn = document.getElementById('btn-dash-verify-existing-user');
      if (dashVerifyBtn) {
        dashVerifyBtn.style.display = (portalState.currentUser && (!emailVer || !mobileVer)) ? 'inline-flex' : 'none';
      }

      const dashWelcomeBadge = document.getElementById('dash-user-verified-badge');
      if (dashWelcomeBadge) {
        dashWelcomeBadge.style.display = emailVer ? 'inline-flex' : 'none';
        dashWelcomeBadge.innerHTML = bothVer ? '✅ Email &amp; WhatsApp Verified' : '✅ Email Verified';
      }
    }

export function syncUnverifiedEmailPortalLockUI(scrollIntoViewIfLocked = false) {
      const lockBanner = document.getElementById('unverified-email-lock-banner');
      if (!portalState.currentUser) {
        if (lockBanner) lockBanner.style.display = 'none';
        syncVerifiedBadgesAcrossPortal(false);
        return;
      }
      const emailVer = isUserEmailAlreadyVerified(portalState.currentUser);
      const mobileVer = isUserMobileAlreadyVerified(portalState.currentUser);
      const bothVerified = emailVer && mobileVer;
      syncVerifiedBadgesAcrossPortal(emailVer);

      setBadgeVerifiedState(document.getElementById('banner-email-verify-status-pill') || document.getElementById('banner-email-verify-pill'), emailVer, '📧 Email');
      setBadgeVerifiedState(document.getElementById('banner-mobile-verify-status-pill') || document.getElementById('banner-mobile-verify-pill'), mobileVer, '📱 Mobile (WhatsApp)');

      // Dim non-dashboard nav buttons while email is unverified
      document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        const t = btn.getAttribute('data-tab');
        if (!t || t === 'dashboard') {
          btn.style.opacity = '1';
          return;
        }
        btn.style.opacity = emailVer ? '1' : '0.45';
        btn.title = emailVer ? '' : '🔒 Verify your email on the Dashboard first to unlock this tab';
      });

      if (!lockBanner) return;
      if (emailVer) {
        lockBanner.style.display = 'none';
        return;
      }

      lockBanner.style.display = 'block';
      const emailDisplay = document.getElementById('unverified-lock-user-email');
      if (emailDisplay) emailDisplay.innerText = portalState.currentUser.email || portalState.currentUser.userId || 'your registered email';
      const mobileDisplay = document.getElementById('unverified-lock-user-mobile');
      if (mobileDisplay) mobileDisplay.innerText = portalState.currentUser.mobile ? ('+91-' + portalState.currentUser.mobile) : 'your registered mobile';

      const targetKey = (portalState.currentUser.email || '') + '|' + (portalState.currentUser.mobile || '');
      if (_inPortalOtpSentOnceForUser !== targetKey) {
        _inPortalOtpSentOnceForUser = targetKey;
        sendInPortalEmailVerificationOtp(true);
      }

      if (scrollIntoViewIfLocked) {
        try {
          lockBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
          document.getElementById('inportal-email-verify-otp-input')?.focus();
        } catch (e) {}
      }
    }

export async function sendInPortalEmailVerificationOtp(silentAuto = false) {
      if (!portalState.currentUser) return;
      const targetEmail = portalState.currentUser.email || portalState.currentUser.userId || 'user';
      const targetMobile = portalState.currentUser.mobile || '';
      const res = await apiCall('sendMfaOtp', {
        userId: portalState.currentUser.userId,
        email: portalState.currentUser.email,
        mobile: targetMobile,
        identifier: portalState.currentUser.email || portalState.currentUser.userId
      }, Boolean(silentAuto));

      const hintBox = document.getElementById('unverified-email-otp-hint');
      if (hintBox && res) {
        hintBox.style.display = 'block';
        hintBox.innerHTML = `📧 6-Digit Email OTP dispatched to <strong>${window.escapeHtml(targetEmail)}</strong>. Please check your inbox.`;
      }

      window._inPortalWaOtpRequired = Boolean(res && res.whatsappOtpRequired);
      const waBox = document.getElementById('unverified-wa-free-link-box') || document.getElementById('unverified-wa-otp-card');
      if (waBox) {
        if (res && res.whatsappOtpRequired) {
          waBox.style.display = 'block';
          waBox.innerHTML = `<div style="font-size:12px; color:#047857; font-weight:700;">📲 6-Digit WhatsApp OTP dispatched to +91-${window.escapeHtml(targetMobile)}.</div>`;
        } else {
          waBox.style.display = 'none';
        }
      }
      if (!silentAuto) {
        showToast((res && res.message) ? res.message : `📧 6-digit verification OTP sent to ${targetEmail}!`);
      }
    }

export async function verifyInPortalEmailOtpNow() {
      if (!portalState.currentUser) return;
      const emailVer = isUserEmailAlreadyVerified(portalState.currentUser);
      const mobileVer = isUserMobileAlreadyVerified(portalState.currentUser);
      const waRequired = Boolean(window._inPortalWaOtpRequired);
      const emailCode = (document.getElementById('inportal-email-verify-otp-input')?.value || '').trim();
      const mobileCode = (document.getElementById('inportal-wa-verify-otp-input')?.value || '').trim();

      if (!emailVer && emailCode.length !== 6) {
        showToast('⚠️ Please enter the 6-digit Email OTP from your inbox.');
        document.getElementById('inportal-email-verify-otp-input')?.focus();
        return;
      }
      if (!mobileVer && waRequired && mobileCode.length !== 6 && emailVer) {
        showToast('⚠️ Please enter the 6-digit WhatsApp Mobile OTP.');
        document.getElementById('inportal-wa-verify-otp-input')?.focus();
        return;
      }

      const res = await apiCall('verifyMfaOtp', {
        userId: portalState.currentUser.userId,
        identifier: portalState.currentUser.email || portalState.currentUser.userId,
        code: emailCode,
        otpCode: emailCode,
        mobileOtpCode: mobileCode,
        deviceId: CLIENT_DEVICE_ID
      });

      if (res && res.success) {
        if (emailCode.length === 6 || res.emailVerified) {
          markUserEmailVerified(portalState.currentUser.email, portalState.currentUser.userId);
          portalState.currentUser.emailVerified = true;
        }
        if (mobileCode.length === 6 || res.mobileVerified || !waRequired) {
          markUserMobileVerified(portalState.currentUser.mobile, portalState.currentUser.userId);
          portalState.currentUser.mobileVerified = true;
        }
        portalState.currentUser.preferences = {
          ...(portalState.currentUser.preferences || {}),
          emailVerified: isUserEmailAlreadyVerified(portalState.currentUser),
          mobileVerified: isUserMobileAlreadyVerified(portalState.currentUser),
          mfaEnabled: false
        };
        const safePersistUser = { ...portalState.currentUser };
        delete safePersistUser.password;
        try { localStorage.setItem('steno_user', JSON.stringify(safePersistUser)); } catch (_e) {}

        const eIn = document.getElementById('inportal-email-verify-otp-input');
        const mIn = document.getElementById('inportal-wa-verify-otp-input');
        if (eIn) eIn.value = '';
        if (mIn) mIn.value = '';
        syncUnverifiedEmailPortalLockUI(false);
        logPortalAction('DUAL_VERIFIED_IN_PORTAL', `Verified Email/Account for ${portalState.currentUser.email}`);
        showToast('✅ Verification complete! Verified badges awarded.');
      } else {
        showToast((res && res.message) || '❌ Invalid or expired 6-digit OTP code.');
      }
    }

export function completePortalLoginSuccess(userObj, passwordStr, forceMarkVerified = false) {
      window._lastSuccessfulLoginAt = Date.now();
      try { localStorage.removeItem('steno_login_attempts'); } catch (_e) {}
      const msgBox = document.getElementById('login-rate-limit-msg');
      if (msgBox) {
        delete msgBox.dataset.locked;
        msgBox.style.display = 'none';
      }
      const unvNotice = document.getElementById('login-unverified-email-notice');
      if (unvNotice) unvNotice.style.display = 'none';
      const termBanner = document.getElementById('auth-security-termination-banner');
      if (termBanner) termBanner.style.display = 'none';

      const roleStr = String((userObj && (userObj.role || userObj.Role)) || 'user').toLowerCase();
      const isSuperAdminAccount = (roleStr === 'superadmin');
      const wasEmailVerified = Boolean(forceMarkVerified || isSuperAdminAccount || isUserEmailAlreadyVerified(userObj));
      const wasMobileVerified = Boolean(forceMarkVerified || isSuperAdminAccount || isUserMobileAlreadyVerified(userObj) || (userObj && userObj.mobileVerified === true));

      if (userObj && wasEmailVerified) {
        markUserEmailVerified(userObj.email, userObj.userId);
        userObj.emailVerified = true;
      }
      if (userObj && wasMobileVerified) {
        markUserMobileVerified(userObj.mobile, userObj.userId);
        userObj.mobileVerified = true;
      }
      if (userObj) {
        userObj.preferences = {
          ...(userObj.preferences || {}),
          emailVerified: wasEmailVerified,
          mobileVerified: wasMobileVerified,
          mfaEnabled: false
        };
      }

      const sanitizedUser = { ...(userObj || {}) };
      delete sanitizedUser.password;
      const syncedToken = String(sanitizedUser.sessionToken || sanitizedUser.token || '').trim();
      portalState.currentUser = {
        ...sanitizedUser,
        role: sanitizedUser.role || sanitizedUser.Role || 'user',
        token: syncedToken || sanitizedUser.token || '',
        sessionToken: syncedToken || sanitizedUser.sessionToken || '',
        emailVerified: wasEmailVerified,
        mobileVerified: wasMobileVerified
      };
      registerSingleDeviceSession(portalState.currentUser);
      ensureSessionVerifyLoopRunning();
      try { localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser)); } catch (e) {}
      try {
        if (portalState.currentUser.preferences && typeof applyUserCloudStateFromBackend === 'function') {
          applyUserCloudStateFromBackend(portalState.currentUser.preferences);
        }
      } catch (e) {}
      try { logPortalAction('LOGIN', `User logged in on device ${CLIENT_DEVICE_ID} (Email Verified: ${wasEmailVerified}, Mobile Verified: ${wasMobileVerified})`); } catch (e) {}
      try { pushPortalNotification('🔐 Secure Session Active', `Welcome back, ${portalState.currentUser.name || 'Candidate'}! Single-device & live block protection active.`, 'security'); } catch (e) {}
      try { seedRichDemoDataIfNeeded(); } catch (e) {}
      setupAuthenticatedUI();
      navigateTo('dashboard');
      try { syncUnverifiedEmailPortalLockUI(!wasEmailVerified || !wasMobileVerified); } catch (e) {}
      try { renderUnsyncedTestRetryBanner(); } catch (e) {}
      if (typeof window.retryFailedTestSubmissionsNow === 'function') {
        setTimeout(() => { try { window.retryFailedTestSubmissionsNow(true); } catch (e) {} }, 1500);
      }
      if (!wasEmailVerified || !wasMobileVerified) {
        showToast(`🔐 Welcome ${portalState.currentUser.name || 'Candidate'}! Please verify your Email ID from the Dashboard or Profile.`);
      }
    }

export function normalizeClientLoginIdentifier(rawInput) {
      const trimmed = String(rawInput || '').trim();
      if (!trimmed) return '';
      if (trimmed.includes('@')) return trimmed.toLowerCase();
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (/^[+\d\s\-().]+$/.test(trimmed)) {
        if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) return digitsOnly.slice(2);
        if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) return digitsOnly.slice(1);
        if (digitsOnly.length === 10) return digitsOnly;
      }
      return trimmed;
    }

portalState._loginInProgress = false;

export async function handleLoginSubmit() {
      if (portalState._loginInProgress) return;
      if (!checkClientLoginRateLimit()) return;

      const idField = document.getElementById('login-identifier');
      const passField = document.getElementById('login-password');
      const msgBox = document.getElementById('login-rate-limit-msg');
      const rawIdentifier = String(idField?.value || '').trim();
      const identifier = normalizeClientLoginIdentifier(rawIdentifier);
      const password = String(passField?.value || '');

      const showLoginErr = (msg, focusEl) => {
        if (msgBox) {
          delete msgBox.dataset.locked;
          msgBox.innerText = msg;
          msgBox.style.display = 'block';
        }
        if (focusEl && typeof focusEl.focus === 'function') focusEl.focus();
        showToast(msg);
      };

      if (!identifier) {
        showLoginErr('Please enter your registered Email ID or 10-digit Mobile Number.', idField);
        return;
      }
      if (!password) {
        showLoginErr('Please enter your Password.', passField);
        return;
      }

      const loginBtn = document.getElementById('btn-login-submit');
      if (msgBox) {
        delete msgBox.dataset.locked;
        msgBox.style.display = 'none';
      }

      portalState._loginInProgress = true;
      if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging In...';
      }

      try {
        const res = await apiCall('login', { identifier, password, deviceId: CLIENT_DEVICE_ID, requireMfa: false, mfaVerified: false }, false, 0);

        if (res && (res.success || res.mfaRequired)) {
          const baseUser = (res.user && typeof res.user === 'object') ? { ...res.user } : {
            userId: res.userId || identifier,
            name: res.name || 'Candidate',
            email: res.email || (identifier.includes('@') ? identifier : ''),
            mobile: res.mobile || (identifier.includes('@') ? '' : identifier),
            role: res.role || 'user',
            batch: res.batch || '',
            permissions: res.permissions || '',
            preferences: res.userPrefs || res.userPreferences || {}
          };
          const resolvedTok = String(res.sessionToken || baseUser.sessionToken || baseUser.token || '').trim();
          if (resolvedTok) {
            baseUser.sessionToken = resolvedTok;
            baseUser.token = resolvedTok;
          }
          if (!baseUser.role && res.role) baseUser.role = res.role;
          if (res.userPreferences && typeof res.userPreferences === 'object') {
            baseUser.preferences = { ...(baseUser.preferences || {}), ...res.userPreferences };
          }
          const candidateUser = baseUser;

          const roleLower = String(candidateUser.role || 'user').toLowerCase();
          const waRequired = Boolean(res.whatsappOtpRequired);
          const serverExplicitlyRequiresMfa = Boolean(
            roleLower !== 'superadmin' && (
              res.mfaRequired === true ||
              res.verificationRequired === true ||
              res.emailVerificationRequired === true ||
              (waRequired && res.mobileVerificationRequired === true)
            )
          );

          const emailAlreadyVerified =
            roleLower === 'superadmin' ||
            !serverExplicitlyRequiresMfa ||
            isUserEmailAlreadyVerified(candidateUser) ||
            res.emailVerified === true ||
            (res.user && res.user.emailVerified === true && !res.emailVerificationRequired);

          const mobileAlreadyVerified =
            roleLower === 'superadmin' ||
            !waRequired ||
            !serverExplicitlyRequiresMfa ||
            isUserMobileAlreadyVerified(candidateUser) ||
            res.mobileVerified === true ||
            (res.user && res.user.mobileVerified === true && !res.mobileVerificationRequired);

          if (emailAlreadyVerified) markUserEmailVerified(candidateUser.email, candidateUser.userId);
          if (mobileAlreadyVerified) markUserMobileVerified(candidateUser.mobile, candidateUser.userId);

          if (serverExplicitlyRequiresMfa && (!emailAlreadyVerified || !mobileAlreadyVerified)) {
            const userEmail = candidateUser.email || identifier;
            const userMobile = candidateUser.mobile || '';
            openMfaVerificationScreen({
              verificationReason: 'LOGIN_DUAL_VERIFY',
              userId: candidateUser.userId || '',
              name: candidateUser.name || 'Candidate',
              email: userEmail,
              mobile: userMobile,
              maskedEmail: userEmail,
              identifier: userEmail,
              password: '',
              emailVerified: emailAlreadyVerified,
              mobileVerified: mobileAlreadyVerified,
              whatsappOtpRequired: waRequired,
              pendingUser: candidateUser,
              promptMessage: (!emailAlreadyVerified && !mobileAlreadyVerified && waRequired)
                ? `Account Verification: Enter the 6-digit Email OTP sent to ${userEmail} and WhatsApp OTP sent to +91-${userMobile}.`
                : `Your Email ID (${userEmail}) is not verified yet! Please check your inbox and enter the 6-digit Email OTP below.`
            });
            showToast('🔐 A 6-digit verification OTP has been emailed to your registered address.');
            return;
          }

          completePortalLoginSuccess(candidateUser, '', true);
          return;
        }

        const isNetErr = Boolean(res && res.networkError);
        if (!isNetErr) {
          recordClientLoginAttempt();
        }
        const failMsg = isNetErr
          ? (res.message || 'Unable to reach server. Please try again.')
          : ((res && res.message) || 'Invalid Email/Mobile or Password. Please check your credentials and try again.');
        if (msgBox) {
          msgBox.innerText = `⚠️ ${failMsg}`;
          msgBox.style.display = 'block';
        }
        if (!isNetErr && typeof pushAdminRealtimeNotification === 'function') {
          pushAdminRealtimeNotification({
            type: 'SECURITY_VIOLATION',
            title: '🚨 Failed Login Attempt',
            message: `Failed login attempt for "${identifier}" from device ${CLIENT_DEVICE_ID}.`,
            userName: identifier,
            userId: 'ANONYMOUS',
            timestamp: new Date().toISOString()
          });
        }
        showToast(`⚠️ ${failMsg}`);
      } catch (err) {
        const errText = 'Login error: ' + (err && err.message ? err.message : 'Please try again.');
        if (msgBox) {
          msgBox.innerText = `⚠️ ${errText}`;
          msgBox.style.display = 'block';
        }
        showToast(`⚠️ ${errText}`);
      } finally {
        portalState._loginInProgress = false;
        if (loginBtn) {
          loginBtn.disabled = false;
          loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Log In';
        }
        showLoader(false);
      }
    }

portalState._mfaVerifyInProgress = false;

export async function handleMfaVerifySubmit(e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (portalState._mfaVerifyInProgress) return;
      const errEl = document.getElementById('mfa-error');
      const submitBtn = document.getElementById('btn-mfa-verify-submit');
      if (errEl) errEl.style.display = 'none';
      if (!_pendingMfaLoginState) {
        switchAuthTab('login');
        return;
      }
      const state = _pendingMfaLoginState;
      const needEmail = !state.emailVerified;
      const needMobile = !state.mobileVerified && Boolean(state.whatsappOtpRequired);
      const code = (document.getElementById('mfa-otp-input')?.value || '').trim();
      const mobileOtpCode = (document.getElementById('mfa-wa-otp-input')?.value || '').trim();

      if (needEmail && code.length < 6) {
        const msg = 'Please enter the 6-digit Email OTP sent to your inbox.';
        if (errEl) { errEl.innerText = msg; errEl.style.display = 'block'; } else { showToast(msg); }
        return;
      }
      if (needMobile && mobileOtpCode.length < 6) {
        const msg = 'Please enter the 6-digit WhatsApp Mobile OTP.';
        if (errEl) { errEl.innerText = msg; errEl.style.display = 'block'; } else { showToast(msg); }
        return;
      }

      portalState._mfaVerifyInProgress = true;
      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying OTP...';
      }

      try {
        const res = await apiCall('verifyMfaOtp', {
          userId: state.userId,
          identifier: state.identifier,
          code: needEmail ? code : '',
          otpCode: needEmail ? code : '',
          mobileOtpCode: needMobile ? mobileOtpCode : '',
          deviceId: CLIENT_DEVICE_ID
        }, false, 0);

        if (res && res.success && (res.user || state.pendingUser)) {
          const finalUser = res.user || state.pendingUser;
          const emailNowVerified = Boolean(needEmail || res.emailVerified || state.emailVerified);
          const mobileNowVerified = Boolean((needMobile && mobileOtpCode.length === 6) || res.mobileVerified === true || state.mobileVerified === true);
          if (emailNowVerified) markUserEmailVerified(finalUser.email || state.email, finalUser.userId || state.userId);
          if (mobileNowVerified) markUserMobileVerified(finalUser.mobile || state.mobile, finalUser.userId || state.userId);
          finalUser.emailVerified = emailNowVerified;
          finalUser.mobileVerified = mobileNowVerified;
          if (!finalUser.preferences || typeof finalUser.preferences !== 'object') finalUser.preferences = {};
          finalUser.preferences.emailVerified = emailNowVerified;
          finalUser.preferences.mobileVerified = mobileNowVerified;

          if (state.verificationReason === 'SIGNUP_COMPULSORY_2FA') {
            document.getElementById('form-signup')?.reset();
            if (typeof pushAdminRealtimeNotification === 'function') {
              pushAdminRealtimeNotification({
                type: 'NEW_USER',
                title: '👤 New Verified User Registered',
                message: `${finalUser.name} (${finalUser.email} / +91-${finalUser.mobile || ''}) verified 2FA OTP and completed registration.`,
                userName: finalUser.name,
                userId: finalUser.userId,
                timestamp: new Date().toISOString()
              });
            }
            logPortalAction('NEW_USER_REGISTERED', `New user verified 2FA OTP & registered: ${finalUser.name} (${finalUser.email})`, finalUser.userId, finalUser.name);
          }
          _pendingMfaLoginState = null;
          showToast('✅ Account Verified! Redirecting to Dashboard...');
          completePortalLoginSuccess(finalUser, '', true);
        } else {
          const failText = (res && res.message) ? res.message : '❌ Invalid or expired 6-digit OTP code. Please check your inbox and try again.';
          if (errEl) {
            errEl.innerText = failText;
            errEl.style.display = 'block';
          }
          showToast(failText);
        }
      } catch (err) {
        const errText = 'Verification error: ' + (err && err.message ? err.message : 'Please try again.');
        if (errEl) { errEl.innerText = errText; errEl.style.display = 'block'; }
        showToast(errText);
      } finally {
        portalState._mfaVerifyInProgress = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          if (origBtnHtml) submitBtn.innerHTML = origBtnHtml;
        }
        showLoader(false);
      }
    }

export async function resendMfaOtpCode() {
      if (!_pendingMfaLoginState) return;
      const res = await apiCall('sendMfaOtp', {
        userId: _pendingMfaLoginState.userId,
        email: _pendingMfaLoginState.email || _pendingMfaLoginState.identifier,
        mobile: _pendingMfaLoginState.mobile || '',
        identifier: _pendingMfaLoginState.identifier
      });
      const fallbackHint = document.getElementById('mfa-fallback-code-hint');
      if (fallbackHint && res) {
        fallbackHint.style.display = 'block';
        fallbackHint.innerHTML = `<i class="fa-solid fa-envelope-circle-check"></i> Fresh 6-digit Email OTP dispatched to <strong>${window.escapeHtml(_pendingMfaLoginState.email || _pendingMfaLoginState.identifier)}</strong>. Please check your inbox.`;
      }
      if (res) {
        _pendingMfaLoginState.whatsappOtpRequired = Boolean(res.whatsappOtpRequired);
      }
      showToast((res && res.message) ? res.message : 'Fresh 6-digit verification OTP sent to your email!');
    }

export let _forgetPasswordOtpStepActive = false;

export let _forgetPasswordRequiresWaOtp = false;

export function resetForgetPasswordFlow() {
      _forgetPasswordOtpStepActive = false;
      _forgetPasswordRequiresWaOtp = false;
      const otpBox = document.getElementById('forget-otp-step-box');
      const otpInput = document.getElementById('forget-otp-input');
      const waOtpInput = document.getElementById('forget-wa-otp-input');
      const newPassInput = document.getElementById('forget-new-password');
      const hintEl = document.getElementById('forget-otp-fallback-hint');
      const waFreeBox = document.getElementById('forget-wa-otp-free-box');
      const submitBtn = document.getElementById('btn-forget-submit');
      if (otpBox) otpBox.style.display = 'none';
      if (otpInput) otpInput.value = '';
      if (waOtpInput) waOtpInput.value = '';
      if (newPassInput) newPassInput.value = '';
      if (hintEl) hintEl.style.display = 'none';
      if (waFreeBox) waFreeBox.style.display = 'none';
      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa-solid fa-envelope-circle-check"></i> Send 2FA Verification OTP';
      }
    }

portalState._forgetPasswordInProgress = false;

export async function handleForgetPasswordSubmit() {
      if (portalState._forgetPasswordInProgress) return;
      const email = document.getElementById('forget-email').value.trim().toLowerCase();
      const rawMobile = document.getElementById('forget-mobile').value.trim();
      const mobile = rawMobile.replace(/\D/g, '').slice(-10);
      if (!email || mobile.length !== 10) {
        showToast('Please enter both your Registered Email ID and valid 10-digit Mobile Number.');
        return;
      }

      const otpBox = document.getElementById('forget-otp-step-box');
      const otpInput = document.getElementById('forget-otp-input');
      const waOtpInput = document.getElementById('forget-wa-otp-input');
      const newPassInput = document.getElementById('forget-new-password');
      const hintEl = document.getElementById('forget-otp-fallback-hint');
      const waFreeBox = document.getElementById('forget-wa-otp-free-box');
      const submitBtn = document.getElementById('btn-forget-submit');

      // Step 1: Send 6-Digit Email OTP (and WhatsApp OTP if configured)
      if (!_forgetPasswordOtpStepActive) {
        portalState._forgetPasswordInProgress = true;
        const origHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending OTP...';
        }
        try {
          const res = await apiCall('forgetPassword', { email, mobile, step: 'sendOtp' }, false, 0);
          if (res && res.success) {
            _forgetPasswordOtpStepActive = true;
            _forgetPasswordRequiresWaOtp = Boolean(res.whatsappOtpRequired);
            if (otpBox) otpBox.style.display = 'block';
            if (hintEl) {
              hintEl.style.display = 'block';
              hintEl.innerHTML = `<i class="fa-solid fa-envelope-circle-check"></i> 6-Digit Password Reset OTP dispatched to <strong>${window.escapeHtml(email)}</strong>. Please check your inbox.`;
            }
            if (waFreeBox) {
              if (_forgetPasswordRequiresWaOtp) {
                waFreeBox.style.display = 'block';
                waFreeBox.innerHTML = `<div style="font-size:12px; color:#047857; font-weight:700;">📲 6-Digit WhatsApp OTP dispatched to +91-${window.escapeHtml(mobile)}.</div>`;
              } else {
                waFreeBox.style.display = 'none';
              }
            }
            if (waOtpInput) {
              waOtpInput.placeholder = _forgetPasswordRequiresWaOtp ? '6-Digit WhatsApp OTP' : 'WhatsApp OTP (Optional — Email OTP sufficient)';
            }
            if (submitBtn) {
              submitBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Verify OTP &amp; Update Password';
            }
            if (otpInput) otpInput.focus();
            showToast(res.message || `🔐 6-Digit Password Reset OTP sent to ${email}!`);
            logPortalAction('FORGET_PASSWORD_OTP_SENT', `Dispatched Forgot Password 2FA OTP to ${email}`);
          } else {
            if (submitBtn && origHtml) submitBtn.innerHTML = origHtml;
            showToast((res && res.message) || 'Matching record not found for provided Email and Mobile combination.');
          }
        } catch (err) {
          if (submitBtn && origHtml) submitBtn.innerHTML = origHtml;
          showToast('Error sending OTP: ' + (err && err.message ? err.message : 'Please try again.'));
        } finally {
          portalState._forgetPasswordInProgress = false;
          if (submitBtn) submitBtn.disabled = false;
          showLoader(false);
        }
        return;
      }

      // Step 2: Verify Email OTP (and WhatsApp OTP if required) and Update Password
      const enteredOtp = (otpInput ? otpInput.value : '').trim();
      const enteredWaOtp = (waOtpInput ? waOtpInput.value : '').trim();
      const newPassword = (newPassInput ? newPassInput.value : '').trim();
      if (!enteredOtp || enteredOtp.length < 6) {
        showToast('⚠️ Please enter the 6-digit Email 2FA OTP from your inbox.');
        if (otpInput) otpInput.focus();
        return;
      }
      if (_forgetPasswordRequiresWaOtp && (!enteredWaOtp || enteredWaOtp.length < 6)) {
        showToast('⚠️ Please enter the 6-digit WhatsApp Mobile OTP.');
        if (waOtpInput) waOtpInput.focus();
        return;
      }
      if (!newPassword || newPassword.length < 4) {
        showToast('⚠️ Please enter a new password (at least 4 characters).');
        if (newPassInput) newPassInput.focus();
        return;
      }

      portalState._forgetPasswordInProgress = true;
      const origStep2Html = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating Password...';
      }
      try {
        const res = await apiCall('forgetPassword', {
          email,
          mobile,
          step: 'verifyOtp',
          otpCode: enteredOtp,
          mobileOtpCode: enteredWaOtp,
          newPassword: newPassword
        }, false, 0);

        if (res && res.success) {
          markUserEmailVerified(email, '');
          markUserMobileVerified(mobile, '');
          if (portalState.adminData && Array.isArray(portalState.adminData.users)) {
            const uRow = portalState.adminData.users.find(u => String(u.Email || u.email || '').toLowerCase() === email);
            if (uRow) uRow.Password = newPassword;
          }
          showToast(res.message || `✅ Email & WhatsApp OTP Verified! Your password has been updated.`);
          logPortalAction('PASSWORD_RECOVERY_VERIFIED', `Password reset verified via Dual Email + WhatsApp 2FA for ${email}`);
          document.getElementById('form-forget')?.reset();
          resetForgetPasswordFlow();
          switchAuthTab('login');
          const loginIdEl = document.getElementById('login-identifier');
          if (loginIdEl) loginIdEl.value = email;
        } else {
          if (submitBtn && origStep2Html) submitBtn.innerHTML = origStep2Html;
          showToast((res && res.message) || '❌ Invalid or expired 6-digit OTP code(s). Password was not updated.');
        }
      } catch (err) {
        if (submitBtn && origStep2Html) submitBtn.innerHTML = origStep2Html;
        showToast('Error resetting password: ' + (err && err.message ? err.message : 'Please try again.'));
      } finally {
        portalState._forgetPasswordInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
        showLoader(false);
      }
    }

export const PORTAL_NOTIFICATIONS_KEY = 'steno_portal_notifications_v1';

export const USER_ENGAGEMENT_ANALYTICS_KEY = 'steno_user_engagement_analytics_v1';

portalState._sessionEngagementTimer = null;

export let _sessionStartedAtMs = Date.now();

export function filterValid24hNotifications(list) {
      if (!Array.isArray(list)) return [];
      const now = Date.now();
      return list.filter(n => {
        if (!n || typeof n !== 'object') return false;
        const createdMs = Number(n.createdAtMs || n._createdAtMs || 0);
        if (createdMs > 0 && (now - createdMs) > NOTIFICATION_TTL_24H_MS) {
          return false;
        }
        return true;
      });
    }

export function pruneExpiredNotifications24h() {
      try {
        const raw = localStorage.getItem(PORTAL_NOTIFICATIONS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const valid = filterValid24hNotifications(parsed);
        if (valid.length !== parsed.length) {
          localStorage.setItem(PORTAL_NOTIFICATIONS_KEY, JSON.stringify(valid.slice(0, 60)));
          renderNotificationCenterUI();
        }
      } catch (e) {}
    }

setInterval(pruneExpiredNotifications24h, 60 * 1000);

export function getPortalNotificationsList() {
      try {
        const raw = localStorage.getItem(PORTAL_NOTIFICATIONS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const valid = filterValid24hNotifications(parsed);
            if (valid.length !== parsed.length) {
              localStorage.setItem(PORTAL_NOTIFICATIONS_KEY, JSON.stringify(valid.slice(0, 60)));
            }
            return valid;
          }
        }
      } catch (e) {}
      return [];
    }

export function savePortalNotificationsList(list) {
      try {
        const valid = filterValid24hNotifications(list || []);
        localStorage.setItem(PORTAL_NOTIFICATIONS_KEY, JSON.stringify(valid.slice(0, 60)));
      } catch (e) {}
    }

export function pushPortalNotification(titleOrObj, message = '', category = 'info', actionTab = '') {
      const prefs = getUserCustomPreferences();
      const list = getPortalNotificationsList();
      const nowMs = Date.now();

      let item = null;
      if (titleOrObj && typeof titleOrObj === 'object') {
        const createdMs = Number(titleOrObj.createdAtMs || nowMs);
        if ((nowMs - createdMs) > NOTIFICATION_TTL_24H_MS) return;
        const id = titleOrObj.id || ('notif_' + nowMs + '_' + Math.random().toString(36).slice(2, 6));
        if (list.some(x => x.id === id)) return;
        const d = new Date(createdMs);
        item = {
          id: id,
          title: String(titleOrObj.title || 'Portal Alert').trim(),
          message: String(titleOrObj.body || titleOrObj.message || '').trim(),
          category: titleOrObj.type || titleOrObj.category || 'upload',
          icon: titleOrObj.icon || '',
          color: titleOrObj.color || '',
          actionTab: titleOrObj.targetTab || titleOrObj.actionTab || '',
          createdAtMs: createdMs,
          timestamp: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • ' + d.toLocaleDateString(),
          read: false
        };
      } else {
        item = {
          id: 'notif_' + nowMs + '_' + Math.random().toString(36).slice(2, 6),
          title: String(titleOrObj || 'Portal Alert').trim(),
          message: String(message || '').trim(),
          category: category || 'info',
          actionTab: actionTab || '',
          createdAtMs: nowMs,
          timestamp: new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date(nowMs).toLocaleDateString(),
          read: false
        };
      }

      list.unshift(item);
      savePortalNotificationsList(list);
      renderNotificationCenterUI();
      if (typeof syncUserCloudStateToBackend === 'function') {
        syncUserCloudStateToBackend(true);
      }
      if (prefs.realtimeAlerts === 'off') return;
    }

export function renderNotificationCenterUI() {
      const list = getPortalNotificationsList();
      const unreadCount = list.filter(n => !n.read).length;
      const badgeHeader = document.getElementById('header-notification-badge') || document.getElementById('header-notification-unread-badge');
      const badgeMenu = document.getElementById('menu-notification-unread-badge');
      const drawerCountPill = document.getElementById('notif-drawer-count-pill');
      if (drawerCountPill) {
        drawerCountPill.innerText = `${unreadCount} Unread`;
      }
      [badgeHeader, badgeMenu].forEach(b => {
        if (!b) return;
        if (unreadCount > 0) {
          b.style.display = 'inline-flex';
          b.innerText = unreadCount > 99 ? '99+' : String(unreadCount);
        } else {
          b.style.display = 'none';
        }
      });

      const listEl = document.getElementById('notification-center-list');
      if (!listEl) return;
      if (list.length === 0) {
        listEl.innerHTML = `<div style="padding: 28px; text-align: center; color: var(--text-muted); font-size: 12.5px;"><i class="fa-regular fa-bell-slash" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.6;"></i>No active notifications from the last 7 days.<br><span style="font-size: 11px;">Whenever new study material, dictation audio, homework, or live alerts are uploaded, you will be notified here automatically (auto-removed after 7 days).</span></div>`;
        return;
      }

      const nowMs = Date.now();
      listEl.innerHTML = list.map(n => {
        const iconMap = {
          upload: 'fa-cloud-arrow-up" style="color:#2563eb;',
          security: 'fa-shield-halved" style="color:#10b981;',
          livetest: 'fa-satellite-dish" style="color:#ef4444;',
          homework: 'fa-calendar-check" style="color:#f59e0b;',
          announcement: 'fa-bullhorn" style="color:#ef4444;',
          evaluation: 'fa-scale-balanced" style="color:#6366f1;',
          info: 'fa-bell" style="color:var(--primary);'
        };
        const iconClass = n.icon
          ? `${n.icon}" style="color:${n.color || 'var(--primary)'};`
          : (iconMap[n.category] || iconMap.info);
        const createdMs = Number(n.createdAtMs || nowMs);
        const remMs = Math.max(3600000, NOTIFICATION_TTL_24H_MS - (nowMs - createdMs));
        const remDays = Math.floor(remMs / (24 * 60 * 60 * 1000));
        const remHours = Math.max(1, Math.ceil((remMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));
        const remLabel = remDays > 0 ? `${remDays}d ${remHours}h` : `${remHours}h`;
        return `
          <div onclick="markSingleNotificationRead('${n.id}', '${n.actionTab || ''}')" style="padding: 11px 13px; border-radius: 10px; border: 1px solid ${n.read ? 'var(--border)' : 'rgba(79,70,229,0.35)'}; background: ${n.read ? 'var(--background)' : 'rgba(79,70,229,0.06)'}; cursor: pointer; transition: 0.15s;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 12.5px; font-weight: 800; color: var(--secondary); display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid ${iconClass}"></i> ${n.title}
              </span>
              ${!n.read ? `<span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; display: inline-block; flex-shrink: 0;"></span>` : ''}
            </div>
            <div style="font-size: 12px; color: var(--text-muted); line-height: 1.45;">${n.message}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted); margin-top: 6px; font-weight: 700;">
              <span>${n.timestamp || ''}</span>
              <span style="color: #6366f1;"><i class="fa-regular fa-clock"></i> Auto-removes in ${remLabel} (7-Day TTL)</span>
            </div>
          </div>
        `;
      }).join('');
    }

export function toggleNotificationCenterDrawer(forceState) {
      const drawer = document.getElementById('notification-center-drawer');
      if (!drawer) return;
      const show = typeof forceState === 'boolean' ? forceState : (drawer.style.display === 'none' || !drawer.style.display);
      drawer.style.display = show ? 'flex' : 'none';
      if (show) {
        pruneExpiredNotifications24h();
        renderNotificationCenterUI();
      }
    }

export function markSingleNotificationRead(id, actionTab) {
      const list = getPortalNotificationsList();
      const target = list.find(x => x.id === id);
      if (target) target.read = true;
      savePortalNotificationsList(list);
      renderNotificationCenterUI();
      if (actionTab) {
        toggleNotificationCenterDrawer(false);
        navigateTo(actionTab);
      }
    }

export function markAllNotificationsRead() {
      const list = getPortalNotificationsList().map(n => ({ ...n, read: true }));
      savePortalNotificationsList(list);
      renderNotificationCenterUI();
      showToast('All notifications marked as read.');
    }

export function clearAllPortalNotifications() {
      savePortalNotificationsList([]);
      renderNotificationCenterUI();
      showToast('Notification center cleared.');
    }

export function getUserCustomPreferences() {
      try {
        if (portalState.currentUser && portalState.currentUser.preferences && typeof portalState.currentUser.preferences === 'object') {
          return portalState.currentUser.preferences;
        }
        const raw = localStorage.getItem('steno_user_custom_prefs');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return {
        mfaEnabled: false,
        mfaPin: '',
        defaultWpm: 80,
        defaultFontSize: 16,
        realtimeAlerts: 'on'
      };
    }

export function getEngagementAnalyticsState() {
      try {
        const raw = localStorage.getItem(USER_ENGAGEMENT_ANALYTICS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
      return {
        totalActiveSeconds: 0,
        sessionsCount: 1,
        moduleSeconds: {
          audio: 0,
          typingtest: 0,
          pitman: 0,
          cbttest: 0,
          learningtyping: 0,
          pdf: 0,
          dashboard: 0
        },
        lastUpdatedDate: new Date().toISOString().split('T')[0]
      };
    }

export function saveEngagementAnalyticsState(state) {
      try {
        localStorage.setItem(USER_ENGAGEMENT_ANALYTICS_KEY, JSON.stringify(state));
      } catch (e) {}
    }

export function startUserEngagementSessionTracker() {
      _sessionStartedAtMs = Date.now();
      const st = getEngagementAnalyticsState();
      st.sessionsCount = (parseInt(st.sessionsCount, 10) || 0) + 1;
      saveEngagementAnalyticsState(st);

      if (portalState._sessionEngagementTimer) clearInterval(portalState._sessionEngagementTimer);
      portalState._sessionEngagementTimer = setInterval(() => {
        if (document.hidden || !portalState.currentUser) return;
        const data = getEngagementAnalyticsState();
        data.totalActiveSeconds = (parseInt(data.totalActiveSeconds, 10) || 0) + 5;
        const activeView = document.querySelector('.app-view.active-view');
        const activeTabId = activeView ? activeView.id.replace('view-', '') : (portalState.activeTab || 'dashboard');
        if (!data.moduleSeconds) data.moduleSeconds = {};
        data.moduleSeconds[activeTabId] = (parseInt(data.moduleSeconds[activeTabId], 10) || 0) + 5;
        saveEngagementAnalyticsState(data);
        if (portalState.activeTab === 'dashboard') {
          renderUserEngagementAnalyticsDashboard(false);
        }
      }, 5000);
      renderUserEngagementAnalyticsDashboard(false);
    }

export function renderUserEngagementAnalyticsDashboard(showFeedbackToast = false) {
      const data = getEngagementAnalyticsState();
      const curSessionSec = Math.max(1, Math.floor((Date.now() - _sessionStartedAtMs) / 1000));
      const curMins = Math.floor(curSessionSec / 60);
      const curRemSec = curSessionSec % 60;
      const totalSecs = (parseInt(data.totalActiveSeconds, 10) || 0) + curSessionSec;
      const totalMins = Math.max(1, Math.round(totalSecs / 60));
      const totalHrs = Math.floor(totalMins / 60);
      const remMins = totalMins % 60;

      const rawHist = (portalState.globalData.userHistory && portalState.globalData.userHistory.length > 0)
        ? portalState.globalData.userHistory
        : (portalState.allTestHistoryList || []);
      const myHist = portalState.currentUser
        ? rawHist.filter(h => String(h.UserID || h.userId || '') === String(portalState.currentUser.userId))
        : rawHist;
      const totalTests = myHist.length;
      const nonCbtHist = myHist.filter(h => !String(h.ExamName || '').toLowerCase().includes('cbt'));
      const avgWpm = nonCbtHist.length > 0
        ? Math.round(nonCbtHist.reduce((acc, h) => acc + (parseFloat(h.NetSpeed) || 0), 0) / nonCbtHist.length)
        : 0;
      const peakWpm = nonCbtHist.length > 0
        ? Math.round(Math.max(0, ...nonCbtHist.map(h => parseFloat(h.NetSpeed) || 0)))
        : 0;
      const avgAcc = totalTests > 0
        ? (myHist.reduce((acc, h) => acc + (parseFloat(h.AccuracyPercentage) || 0), 0) / totalTests).toFixed(1)
        : '0.0';
      const passedCount = myHist.filter(h => {
        const st = String(h.Status || h.status || '').toUpperCase();
        return st === 'PASSED' || st === 'QUALIFIED' || st === 'COMPLETED' || (parseFloat(h.AccuracyPercentage) || 0) >= 85;
      }).length;
      const qualifyRate = totalTests > 0 ? Math.round((passedCount / totalTests) * 100) : 0;
      const focusScore = Math.min(100, Math.round(65 + Math.min(20, totalMins / 3) + Math.min(15, totalTests * 2)));

      const modSec = data.moduleSeconds || {};
      const moduleLabels = {
        audio: 'Audio Steno',
        typingtest: 'Typing Exam',
        pitman: 'Pitman Book',
        cbttest: 'CBT Mock',
        learningtyping: 'Learning Tutor',
        pdf: 'PDF Library',
        dashboard: 'Dashboard'
      };
      let topModKey = 'audio';
      let topModVal = -1;
      Object.keys(moduleLabels).forEach(k => {
        const v = parseInt(modSec[k], 10) || 0;
        if (v > topModVal) {
          topModVal = v;
          topModKey = k;
        }
      });

      // Update live header pills and metric cards in #user-engagement-session-card
      const liveTimerPill = document.getElementById('user-live-session-timer-pill');
      const scorePill = document.getElementById('user-engagement-score-pill');
      const mTotalTime = document.getElementById('eng-metric-total-time');
      const mAvgWpm = document.getElementById('eng-metric-avg-wpm');
      const mPeakWpm = document.getElementById('eng-metric-peak-wpm');
      const mAvgAcc = document.getElementById('eng-metric-avg-acc');
      const mQualRate = document.getElementById('eng-metric-qualify-rate');
      const mTopMod = document.getElementById('eng-metric-top-module');
      const mSessCount = document.getElementById('eng-metric-sessions-count');

      if (liveTimerPill) liveTimerPill.innerHTML = `<i class="fa-regular fa-clock"></i> Session: ${String(curMins).padStart(2, '0')}:${String(curRemSec).padStart(2, '0')}`;
      if (scorePill) scorePill.innerHTML = `⚡ Engagement Score: ${focusScore}/100`;
      if (mTotalTime) mTotalTime.innerText = `${totalHrs}h ${remMins}m`;
      if (mAvgWpm) mAvgWpm.innerText = `${avgWpm} WPM`;
      if (mPeakWpm) mPeakWpm.innerText = `${peakWpm} WPM`;
      if (mAvgAcc) mAvgAcc.innerText = `${avgAcc}%`;
      if (mQualRate) mQualRate.innerText = `${qualifyRate}%`;
      if (mTopMod) mTopMod.innerText = moduleLabels[topModKey] || 'Typing & Steno';
      if (mSessCount) mSessCount.innerText = String(Math.max(1, parseInt(data.sessionsCount, 10) || 1) + totalTests);

      if (showFeedbackToast) {
        showToast('📊 Session Engagement Analytics updated!');
      }
    }

window.isRuleUploadedForSection = function(ruleKey, ruleObj, targetSection) {
    if (!ruleKey || ruleKey === 'default' || ruleKey === 'ephemeral_learning_once') return false;
    if (FAKE_INJECTED_RULE_KEYS.includes(ruleKey)) return false;
    const sec = String(targetSection || '').toLowerCase().trim();
    const normSec = (sec === 'typing' || sec === 'learningtyping') ? 'typingtest' : (sec === 'cbt' ? 'cbttest' : sec);
    const lowK = String(ruleKey).toLowerCase().trim();
    const r = ruleObj || (portalState.allEvaluationRules && portalState.allEvaluationRules[ruleKey]) || {};
    const rawTab = String(r.tabType || '').toLowerCase().trim();
    const normRuleTab = rawTab === 'typing' ? 'typingtest' : (rawTab === 'cbt' ? 'cbttest' : rawTab);

    if (normRuleTab && ['audio', 'pitman', 'typingtest', 'cbttest'].includes(normRuleTab)) {
      return normRuleTab === normSec;
    }

    if (normSec === 'audio') {
      return lowK === 'audio' || lowK.startsWith('audio_') || (lowK.startsWith('exam_') && !normRuleTab);
    }
    if (normSec === 'pitman') {
      return lowK === 'pitman' || lowK.startsWith('pitman_');
    }
    if (normSec === 'typingtest') {
      return lowK === 'typingtest' || lowK.startsWith('typingtest_') || lowK.startsWith('typing_');
    }
    if (normSec === 'cbttest') {
      return lowK === 'cbttest' || lowK.startsWith('cbttest_') || lowK.startsWith('cbt_');
    }
    return false;
  };

window.getSectionEvaluationRuleKeys = function(targetSection) {
    purgeFakeInjectedRules();
    const allKeys = Object.keys(portalState.allEvaluationRules || {});
    return allKeys.filter(k => window.isRuleUploadedForSection(k, portalState.allEvaluationRules[k], targetSection));
  };

try {
    const rawSaved = localStorage.getItem('steno_user');
    if (rawSaved) {
      const parsed = JSON.parse(rawSaved);
      if (!parsed || (!parsed.userId && !parsed.token && !parsed.email && !parsed.mobile)) {
        localStorage.removeItem('steno_user');
        portalState.currentUser = null;
      }
    }
  } catch (e) {
    localStorage.removeItem('steno_user');
    portalState.currentUser = null;
  }

export function isUserAuthenticated() {
    return Boolean(
      typeof portalState.currentUser !== 'undefined' &&
      portalState.currentUser &&
      (portalState.currentUser.userId || portalState.currentUser.token || portalState.currentUser.email || portalState.currentUser.mobile)
    );
  }

export function syncAuthHeaderAndMenuVisibility() {
    const authed = isUserAuthenticated();
    document.body.classList.toggle('rp-authenticated', authed);
    document.body.classList.toggle('rp-unauthenticated', !authed);

    const menuBtn = document.getElementById('all-device-menu-btn');
    const activeBadge = document.getElementById('active-tab-header-badge');
    const navTabs = document.getElementById('main-nav-tabs');
    const headerControls = document.getElementById('header-user-controls');
    const bellBtn = document.getElementById('header-notification-bell-btn');
    const dmBtn = document.getElementById('header-dark-mode-toggle-btn');
    const quickBar = document.getElementById('rp-student-quick-jump-bar');

    if (!authed) {
      if (menuBtn) menuBtn.style.setProperty('display', 'none', 'important');
      if (activeBadge) activeBadge.style.setProperty('display', 'none', 'important');
      if (headerControls) headerControls.style.setProperty('display', 'none', 'important');
      if (bellBtn) bellBtn.style.setProperty('display', 'none', 'important');
      if (dmBtn) dmBtn.style.setProperty('display', 'none', 'important');
      if (quickBar) quickBar.style.setProperty('display', 'none', 'important');
      if (navTabs) {
        navTabs.classList.remove('menu-open');
        navTabs.style.setProperty('display', 'none', 'important');
      }
      document.body.classList.remove('laptop-menu-docked');
      document.querySelectorAll('.app-view').forEach(v => {
        if (v.id !== 'view-auth') {
          v.style.display = 'none';
          v.classList.remove('active-view');
        }
      });
      const authView = document.getElementById('view-auth');
      if (authView) authView.style.display = 'block';
    } else {
      if (menuBtn) menuBtn.style.removeProperty('display');
      if (activeBadge) activeBadge.style.removeProperty('display');
      if (headerControls) headerControls.style.removeProperty('display');
      if (bellBtn) bellBtn.style.removeProperty('display');
      if (dmBtn) dmBtn.style.removeProperty('display');
      if (navTabs) {
        navTabs.style.removeProperty('display');
        if (window.innerWidth >= 1024 && !window.isLaptopMenuUserHidden && !navTabs.classList.contains('menu-open')) {
          navTabs.classList.add('menu-open');
          document.body.classList.add('laptop-menu-docked');
        }
      }
    }
  }

window.handleBrandLogoClick = function() {
    if (!isUserAuthenticated()) {
      syncAuthHeaderAndMenuVisibility();
      if (typeof switchAuthTab === 'function') switchAuthTab('login');
      if (typeof showToast === 'function') showToast('🔒 Please Log In / Sign Up');
      return;
    }
    if (typeof navigateTo === 'function') {
      navigateTo('dashboard');
    }
  };

document.addEventListener('click', function(e) {
    const brandEl = e.target && e.target.closest ? e.target.closest('.brand') : null;
    if (brandEl && !isUserAuthenticated()) {
      e.preventDefault();
      e.stopPropagation();
      syncAuthHeaderAndMenuVisibility();
      if (typeof switchAuthTab === 'function') switchAuthTab('login');
      if (typeof showToast === 'function') {
        showToast('🔒 Please Log In / Sign Up');
      }
    }
  }, true);







document.addEventListener('pointerdown', function(ev) {
    const target = ev.target;
    if (!target) return;

    const toastEl = document.getElementById('center-toast') || document.getElementById('toast');
    if (toastEl && toastEl.classList.contains('show') && !toastEl.contains(target)) {
      toastEl.classList.remove('show');
    }

    const drawer = document.getElementById('notification-center-drawer');
    const bellBtn = document.getElementById('header-notification-bell-btn');
    if (drawer && drawer.style.display !== 'none' && !drawer.contains(target) && !(bellBtn && bellBtn.contains(target))) {
      if (typeof window.toggleNotificationCenterDrawer === 'function') {
        window.toggleNotificationCenterDrawer(false);
      } else {
        drawer.style.display = 'none';
      }
    }

    const pwaBanner = document.getElementById('pwa-install-banner');
    if (pwaBanner && pwaBanner.style.display !== 'none' && !pwaBanner.contains(target) && !target.closest('#pwa-install-btn')) {
      pwaBanner.style.display = 'none';
    }

    ['student-notif-dropdown', 'header-notification-dropdown', 'notification-panel', 'user-notification-drawer'].forEach(id => {
      const panel = document.getElementById(id);
      if (panel && panel.style.display !== 'none' && !panel.contains(target)) {
        panel.style.display = 'none';
      }
    });
  }, true);

export function ensureHelpDeskFeedbackFormVisible() {
    const helpSubtabBar = document.getElementById('help-view-section-tabs');
    if (helpSubtabBar) helpSubtabBar.style.display = 'none';
    const promptCard = document.getElementById('help-no-tab-selected-prompt');
    if (promptCard) promptCard.style.display = 'none';
    const wrapper = document.getElementById('help-sections-wrapper');
    if (wrapper) {
      wrapper.style.display = 'grid';
      wrapper.style.gridTemplateColumns = 'repeat(auto-fit, minmax(340px, 1fr))';
    }
    const fbCard = document.getElementById('help-section-feedback-card');
    if (fbCard) fbCard.style.display = 'flex';
    const ctCard = document.getElementById('help-section-contacts-card') || document.getElementById('help-official-contacts-card');
    if (ctCard) ctCard.style.display = 'flex';
  }

export let _rpScrollRevealObserver = null;

window.initRpScrollRevealAnimations = function (rootContainer) {
    try {
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const scope = rootContainer || document.querySelector('.app-view.active') || document;
      const targets = scope.querySelectorAll('.card, .stat-card');
      if (!targets || targets.length === 0) return;

      if (reduced || typeof IntersectionObserver === 'undefined') {
        targets.forEach((el) => {
          el.classList.remove('rp-scroll-reveal');
          el.classList.add('rp-scroll-visible');
        });
        return;
      }

      if (!_rpScrollRevealObserver) {
        _rpScrollRevealObserver = new IntersectionObserver((entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('rp-scroll-visible');
              obs.unobserve(entry.target);
            }
          });
        }, { rootMargin: '0px 0px -24px 0px', threshold: 0.04 });
      }

      const vh = window.innerHeight || 800;
      targets.forEach((el) => {
        if (el.classList.contains('rp-scroll-visible')) return;
        const rect = el.getBoundingClientRect();
        // Zero-latency rule: above-the-fold cards stay immediately visible
        if (rect.top < vh * 0.92) {
          el.classList.remove('rp-scroll-reveal');
          el.classList.add('rp-scroll-visible');
        } else {
          el.classList.add('rp-scroll-reveal');
          _rpScrollRevealObserver.observe(el);
        }
      });
    } catch (e) {}
  };

export const EXPANDABLE_SEARCH_IDS = [
    'audio-search-input',
    'pitman-search-input',
    'words-search',
    'pdf-search-input',
    'videocourse-search-input',
    'typingtest-search-input',
    'cbttest-search-input',
    'learning-exercise-search-input',
    'learning-passages-search-input',
    'typing-passage-quick-search',
    'history-search-input',
    'weak-vault-search-input',
    'livetests-search-input',
    'batch-lb-search-input',
    'cbt-rev-search-input',
    'admin-search-users',
    'admin-search-materials',
    'admin-search-subtabs',
    'admin-search-eval-rules',
    'admin-search-leaderboard',
    'admin-search-logs',
    'admin-search-feedback',
    'admin-batch-discussion-search',
    'admin-content-search',
    'admin-log-search',
    'admin-feedback-search',
    'admin-outline-replies-search',
    'admin-livetest-rank-search',
    'admin-bulk-assign-user-search',
    'admin-batch-chip-search-input',
    'transcribe-exam-rule-search-input',
    'typing-rule-search-input'
  ];

window.initExpandableSearchControls = function (rootEl) {
    const scope = rootEl || document;
    // Remove any legacy duplicate .universal-search-icon-btn if ever present
    try {
      scope.querySelectorAll('.universal-search-icon-btn').forEach((btn) => btn.remove());
    } catch (e) {}

    EXPANDABLE_SEARCH_IDS.forEach((id) => {
      const input = scope.getElementById ? scope.getElementById(id) : scope.querySelector(`#${id}`);
      if (!input || input.dataset.rpExpandSearchInit === '1') return;
      input.dataset.rpExpandSearchInit = '1';

      // Strip leading magnifying-glass emoji from placeholder to prevent icon duplication
      const rawPh = input.getAttribute('placeholder') || 'Search...';
      input.setAttribute('placeholder', rawPh.replace(/^🔍\s*/, ''));

      const parent = input.parentNode;
      if (!parent) return;

      // Hide any decorative sibling magnifying-glass icons inside the immediate parent wrapper
      Array.from(parent.children || []).forEach((child) => {
        if (child === input) return;
        if (child.matches && (child.matches('i.fa-magnifying-glass, i.fa-search, .universal-search-icon-btn') || (child.tagName === 'SPAN' && child.querySelector('i.fa-magnifying-glass, i.fa-search') && !child.querySelector('input, select')))) {
          child.style.display = 'none';
        }
      });

      const wrap = document.createElement('div');
      wrap.className = 'rp-expand-search-wrap';
      if (input.value && input.value.trim()) wrap.classList.add('is-open');

      const triggerBtn = document.createElement('button');
      triggerBtn.type = 'button';
      triggerBtn.className = 'rp-expand-search-trigger';
      triggerBtn.title = input.placeholder || 'Search';
      triggerBtn.setAttribute('aria-label', input.placeholder || 'Open search');
      triggerBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';

      const box = document.createElement('div');
      box.className = 'rp-expand-search-box';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'rp-expand-search-close';
      closeBtn.title = 'Close search';
      closeBtn.setAttribute('aria-label', 'Close search');
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';

      // Insert wrapper right where the input lived
      parent.insertBefore(wrap, input);
      input.style.paddingLeft = '12px';
      input.style.width = '100%';
      input.style.minWidth = '160px';
      box.appendChild(input);
      box.appendChild(closeBtn);
      wrap.appendChild(triggerBtn);
      wrap.appendChild(box);

      const openSearch = () => {
        wrap.classList.add('is-open');
        if (typeof autoResetAdminFiltersOnSearch === 'function') {
          try { autoResetAdminFiltersOnSearch(id); } catch (e) {}
        }
        setTimeout(() => {
          try { input.focus(); } catch (e) {}
        }, 30);
      };

      const closeSearch = (clearValue) => {
        if (clearValue && input.value) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (!input.value.trim()) {
          wrap.classList.remove('is-open');
        }
      };

      triggerBtn.addEventListener('click', openSearch);
      closeBtn.addEventListener('click', () => closeSearch(true));
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          closeSearch(true);
          input.blur();
        }
      });
      input.addEventListener('blur', () => {
        setTimeout(() => {
          if (!wrap.contains(document.activeElement) && !input.value.trim()) {
            wrap.classList.remove('is-open');
          }
        }, 120);
      });
    });
  };

export let offlinePauseStartMs = 0;

export let pausedAudioElements = [];

export let pausedReadOnlyTargets = [];

export let speechWasSpeaking = false;

export function isAnyExamCurrentlyActive() {
    const activeModal = document.getElementById('active-test-modal');
    if (activeModal && activeModal.style.display && activeModal.style.display !== 'none' && !activeModal.classList.contains('hidden')) {
      return true;
    }
    const cbtScreen = document.getElementById('cbt-active-interface');
    if (cbtScreen && cbtScreen.style.display && cbtScreen.style.display !== 'none' && !cbtScreen.classList.contains('hidden')) {
      return true;
    }
    if (window.isCbtExamActive) return true;
    const practiceEl = document.getElementById('learning-studio-screen-practice');
    if (practiceEl && practiceEl.style.display && practiceEl.style.display !== 'none' && practiceEl.offsetParent !== null) {
      return true;
    }
    return false;
  }

export function showOfflineExamPauseOverlay() {
    let overlay = document.getElementById('rp-exam-offline-pause-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'rp-exam-offline-pause-overlay';
      overlay.innerHTML = `
        <div class="rp-offline-pause-card">
          <div style="width:52px; height:52px; margin:0 auto 12px; border-radius:50%; background:rgba(245,158,11,0.14); color:#d97706; display:flex; align-items:center; justify-content:center; font-size:22px;">
            <i class="fa-solid fa-wifi"></i>
          </div>
          <h3 style="margin:0 0 8px 0; font-size:18px; font-weight:800; color:var(--secondary);">Internet Disconnected — Test &amp; Timer Paused</h3>
          <p style="margin:0 0 14px 0; font-size:13px; color:var(--text-muted); line-height:1.55;">
            Your active exam, audio playback, and countdown timer have been safely frozen. As soon as your connection returns, the exam will automatically resume from this exact second without losing any typed text or answers.
          </p>
          <div style="display:inline-flex; align-items:center; gap:8px; padding:7px 14px; border-radius:999px; background:rgba(245,158,11,0.12); color:#b45309; font-size:12px; font-weight:700;">
            <i class="fa-solid fa-spinner fa-spin"></i> Waiting for internet connection...
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  }

export function hideOfflineExamPauseOverlay() {
    const overlay = document.getElementById('rp-exam-offline-pause-overlay');
    if (overlay) overlay.style.display = 'none';
  }

window.pauseActiveExamForOffline = function () {
    if (window.__examOfflinePaused) return;
    if (!isAnyExamCurrentlyActive()) return;

    window.__examOfflinePaused = true;
    offlinePauseStartMs = Date.now();
    pausedAudioElements = [];
    pausedReadOnlyTargets = [];
    speechWasSpeaking = false;

    // Pause any playing HTML5 audio/video elements
    document.querySelectorAll('audio, video').forEach((mediaEl) => {
      try {
        if (!mediaEl.paused && !mediaEl.ended) {
          mediaEl.pause();
          pausedAudioElements.push(mediaEl);
        }
      } catch (e) {}
    });

    // Pause Web Speech dictation if active
    try {
      if (window.speechSynthesis && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        speechWasSpeaking = true;
      }
    } catch (e) {}

    // Lock typing inputs readOnly so timer & WPM stay fair while offline
    ['transcribe-input', 'learning-user-input'].forEach((id) => {
      const inp = document.getElementById(id);
      if (inp && !inp.readOnly) {
        inp.readOnly = true;
        pausedReadOnlyTargets.push(inp);
      }
    });

    showOfflineExamPauseOverlay();
    safeNotify('Connection lost — Exam & Timer paused automatically.');
  };

window.resumeActiveExamAfterOnline = function () {
    if (!window.__examOfflinePaused) return;
    const pausedMs = offlinePauseStartMs > 0 ? Math.max(0, Date.now() - offlinePauseStartMs) : 0;
    offlinePauseStartMs = 0;

    if (typeof window.__shiftActiveExamStartTimers === 'function' && pausedMs > 0) {
      window.__shiftActiveExamStartTimers(pausedMs);
    }

    window.__examOfflinePaused = false;

    // Unlock typing inputs
    pausedReadOnlyTargets.forEach((inp) => {
      try { inp.readOnly = false; } catch (e) {}
    });
    pausedReadOnlyTargets = [];

    // Resume audio/video that was playing before disconnect
    pausedAudioElements.forEach((mediaEl) => {
      try {
        const p = mediaEl.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {}
    });
    pausedAudioElements = [];

    if (speechWasSpeaking) {
      try {
        if (window.speechSynthesis && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (e) {}
      speechWasSpeaking = false;
    }

    hideOfflineExamPauseOverlay();
    safeNotify('Connection restored — Exam & Timer resumed from exact paused second!');
  };

window.addEventListener('offline', () => {
    window.pauseActiveExamForOffline();
  });

window.addEventListener('online', () => {
    window.resumeActiveExamAfterOnline();
  });

export const _activeStreamTokens = {};

export function getOrCreateStreamFooterEl(anchorId, streamKey) {
    if (!anchorId) return null;
    const anchor = document.getElementById(anchorId);
    if (!anchor) return null;

    // Clean up any legacy leaked stream footers sitting directly inside #app-viewport outside a section
    const viewport = document.getElementById('app-viewport');
    if (viewport) {
      Array.from(viewport.children).forEach(ch => {
        if (ch.classList && ch.classList.contains('rp-stream-status-footer')) {
          ch.remove();
        }
      });
    }

    // Key strictly by anchorId so static & streaming footers NEVER stack twice under the same table/list
    const cleanAnchorKey = String(anchorId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const footerId = 'rp-stream-footer-' + cleanAnchorKey;
    const isTopLevelSection = anchor.tagName === 'SECTION'
      || anchor.classList.contains('app-view')
      || (anchor.parentElement && anchor.parentElement.id === 'app-viewport');

    const tableWrap = anchor.tagName === 'TBODY'
      ? (anchor.closest('.table-responsive') || anchor.closest('table') || anchor.parentElement)
      : anchor;

    // Only deduplicate immediate sibling footers next to tableWrap (never wipe unrelated sections)
    if (!isTopLevelSection && tableWrap && tableWrap.parentNode) {
      let sibling = tableWrap.nextElementSibling;
      while (sibling && sibling.classList && sibling.classList.contains('rp-stream-status-footer')) {
        const nextSib = sibling.nextElementSibling;
        if (sibling.id !== footerId) sibling.remove();
        sibling = nextSib;
      }
    }

    let footer = document.getElementById(footerId);
    if (!footer) {
      footer = document.createElement('div');
      footer.id = footerId;
      footer.className = 'rp-stream-status-footer';
      if (isTopLevelSection) {
        anchor.appendChild(footer);
      } else if (tableWrap && tableWrap.parentNode) {
        tableWrap.parentNode.insertBefore(footer, tableWrap.nextSibling);
      }
    } else if (isTopLevelSection && footer.parentNode !== anchor) {
      anchor.appendChild(footer);
    }
    return footer;
  }
