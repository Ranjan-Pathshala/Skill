// @ts-nocheck
/**
 * RP Skill Portal — Admin Control Center, Batches, Content Uploads, Banners & Rules Studio
 * Clean Vite ES module (zero layered monkey-patch conflicts).
 */

import { portalState } from '../core/state.ts';
import { portalHooks } from '../core/hooks.ts';
import { onDomReady } from '../core/domReady.ts';
import { ADMIN_LEADERBOARD_PER_PAGE, ADMIN_USERS_PER_PAGE, DEFAULT_LOGO_URL, apiCall, forceSingleDeviceLogout, getEvaluationRulesForTab, loadSelectedEvaluationRulesIntoForm, logPortalAction, normalizeMaterialRecord, normalizeSubtabRecord, normalizeUserRecord, populateEvalCategoryDropdown, saveFastPortalCache, showToast, singleSessionChannel } from './apiAndCore.js';
import { ALL_STUDENT_PORTAL_TABS, TAB_DISPLAY_META, evaluateMaintenanceWindowClient, getMaintenanceConfig, getWorkingTabsUnderMaintenance, isTabUnderMaintenance, isUserEmailAlreadyVerified, isUserMobileAlreadyVerified, pushPortalNotification, saveMaintenanceConfigToStorage, sortMaterialsLatestFirst } from './authAndNavigation.js';
import { getDashboardCustomBannerConfig, getDateSpecificBannersMap, renderDailyPracticeGoalUI, renderDashboardCustomBanner, renderHelpAdminContacts, renderPromoBanner, saveDashboardCustomBannerConfig, saveDateSpecificBannersMap, setupAuthenticatedUI, syncProfileTabUI } from './dashboardAndProfile.js';
import { extractYouTubeVideoId, populateLiveTestMaterialOptions, renderAdminEvaluationRulesTable, renderAdminLiveTestsTable, saveScheduledLiveTestsList } from './mediaAndDictation.js';
import { escapeHtml, formatLocalDate, getLocalDateString } from '../utils/formatting.ts';
import { initLearningTypingTutor } from './videoAndTutor.js';
import { getUniversalUrl } from './typingAndEvaluation.js';

const loadShorthandPadsFromServer = (...args) => (typeof window.loadShorthandPadsFromServer === 'function' ? window.loadShorthandPadsFromServer(...args) : undefined);

export let editingMaterialId = null;

export async function loadAdminData() {
  const __adminRole = String((portalState.currentUser && (portalState.currentUser.role || portalState.currentUser.Role)) || '').toLowerCase().trim();
  if (!portalState.currentUser || (__adminRole !== 'admin' && __adminRole !== 'superadmin')) {
    return { success: false, skipped: true };
  }
  window._isLoadingAdminData = true;
  const res = await apiCall('getAdminData');
  window._isLoadingAdminData = false;
  if (res && res.success) {
    const existingLocalLogs = (portalState.adminData && Array.isArray(portalState.adminData.logs)) ? portalState.adminData.logs : [];
    portalState.adminData = res;
    if (!Array.isArray(portalState.adminData.users)) portalState.adminData.users = [];
    portalState.adminData.users = portalState.adminData.users.map(normalizeUserRecord);
    if (!Array.isArray(portalState.adminData.logs)) portalState.adminData.logs = [];
    existingLocalLogs.forEach(ll => {
      if (!portalState.adminData.logs.some(rl => rl.LogID === ll.LogID)) {
        portalState.adminData.logs.unshift(ll);
      }
    });

    if (typeof syncServerLogsToAdminNotifications === 'function') {
      syncServerLogsToAdminNotifications(portalState.adminData.logs);
    }

    const violationElem = document.getElementById('admin-violation-count');
    if (violationElem) violationElem.innerText = res.violationCount || 0;
    
    if (res.evaluationRulesMap && Object.keys(res.evaluationRulesMap).length > 0) {
      for (var rKey in res.evaluationRulesMap) {
        portalState.allEvaluationRules[rKey] = res.evaluationRulesMap[rKey];
      }
      localStorage.setItem('steno_all_eval_rules', JSON.stringify(portalState.allEvaluationRules));
    }

    if (Array.isArray(res.materials)) {
      const incomingMats = res.materials.map(normalizeMaterialRecord);
      const mergedById = new Map();
      [...(portalState.materialsData || []), ...incomingMats].forEach(m => {
        if (m && m.ID) mergedById.set(String(m.ID), m);
      });
      res.materials = Array.from(mergedById.values());
      portalState.materialsData = res.materials;
      if (portalState.globalData) portalState.globalData.materials = res.materials;
    }
    if (Array.isArray(res.subtabs) && res.subtabs.length > 0) {
      res.subtabs = res.subtabs.map(normalizeSubtabRecord);
      portalState.subtabsData = res.subtabs;
      if (portalState.globalData) portalState.globalData.subtabs = res.subtabs;
    }
    if (res.maintenance && typeof res.maintenance === 'object') {
      saveMaintenanceConfigToStorage(res.maintenance, false);
    }
    if (res.dashboardCustomBanner && typeof res.dashboardCustomBanner === 'object') {
      saveDashboardCustomBannerConfig(res.dashboardCustomBanner);
    }
    if (Array.isArray(res.dateSpecificBanners) && res.dateSpecificBanners.length > 0) {
      const dbMap = getDateSpecificBannersMap();
      res.dateSpecificBanners.forEach(b => {
        if (b && b.date) dbMap[b.date] = b;
      });
      saveDateSpecificBannersMap(dbMap, false);
    }
    if (Array.isArray(res.scheduledLiveTests) && res.scheduledLiveTests.length > 0) {
      saveScheduledLiveTestsList(res.scheduledLiveTests, false);
    }
    if (Array.isArray(res.instituteBatches)) {
      const cleanedServerBatches = res.instituteBatches.filter(b => {
        const low = String(b || '').trim().toLowerCase();
        return low && low !== 'general batch' && low !== 'free tier' && low !== 'rp-trail';
      });
      const mergedBatches = Array.from(new Set([...getInstituteBatchesList(), ...cleanedServerBatches]));
      saveInstituteBatchesList(mergedBatches, false);
    }
    if (res.batchMonitorsMap && typeof res.batchMonitorsMap === 'object') {
      saveBatchMonitorsMap({ ...getBatchMonitorsMap(), ...res.batchMonitorsMap });
    }
    if (res.batchMetaMap && typeof res.batchMetaMap === 'object') {
      window.rpBatchMetaMap = { ...(window.rpBatchMetaMap || {}), ...res.batchMetaMap };
      portalState.adminData.batchMetaMap = window.rpBatchMetaMap;
      if (portalState.globalData) portalState.globalData.batchMetaMap = window.rpBatchMetaMap;
    }
    if (res.feeConfig && typeof res.feeConfig === 'object') {
      portalState.adminData.feeConfig = res.feeConfig;
      if (portalState.globalData) portalState.globalData.feeConfig = res.feeConfig;
    }
    if (Array.isArray(res.feeLedger)) {
      portalState.adminData.feeLedger = res.feeLedger;
    }
    saveFastPortalCache();

    renderAdminPerformanceDashboard();
    if (typeof renderAdminRealtimeNotifications === 'function') renderAdminRealtimeNotifications();
    renderAdminUsers();
    if (typeof window.renderAdminFeesManager === 'function') window.renderAdminFeesManager();
    if (typeof window.renderAdminMonthlyAttendanceMatrix === 'function') window.renderAdminMonthlyAttendanceMatrix();
    renderAdminLogs();
    renderAdminFeedback();
    populateAdminSubtabsDropdown();
    renderAdminMaterialsTable();
    renderAdminSubtabsTable();
    renderAdminBannersTable();
    renderAdminDateBannersTable();
    loadDashboardBannerIntoAdminForm();
    if (typeof loadMaintenanceSettingsIntoAdminForm === 'function') loadMaintenanceSettingsIntoAdminForm();
    renderAdminLiveTestsTable();
    populateLiveTestMaterialOptions();
    renderAdminLeaderboard();
    populateEvalCategoryDropdown();
    loadSelectedEvaluationRulesIntoForm();
    applyAdminTabPermissions();

    if (typeof renderAdminEvaluationRulesTable === 'function') {
      renderAdminEvaluationRulesTable();
    }
    // Render clear "No more data" / progressive streaming controls under Admin tables
    if (typeof window.renderStaticStreamDoneFooter === 'function') {
      window.renderStaticStreamDoneFooter('admin-users-tbody', (portalState.adminData.users || []).length, 'user', () => window.streamAdminCollectionOneByOne && window.streamAdminCollectionOneByOne('admin_users'));
      window.renderStaticStreamDoneFooter('admin-materials-table-container', (portalState.adminData.materials || []).length, 'material', () => window.streamAdminCollectionOneByOne && window.streamAdminCollectionOneByOne('admin_materials'));
      window.renderStaticStreamDoneFooter('admin-logs-tbody', (portalState.adminData.logs || []).length, 'log entry', () => window.streamAdminCollectionOneByOne && window.streamAdminCollectionOneByOne('admin_logs'));
      window.renderStaticStreamDoneFooter('admin-feedback-tbody', (portalState.adminData.feedback || []).length, 'ticket', () => window.streamAdminCollectionOneByOne && window.streamAdminCollectionOneByOne('admin_feedback'));
    }
  } else {
    renderAdminPerformanceDashboard();
    if (typeof renderAdminRealtimeNotifications === 'function') renderAdminRealtimeNotifications();
    renderAdminLogs();
  }
  return res;
}

window.streamAdminCollectionOneByOne = async function (collection) {
  if (typeof window.streamCollectionOneByOne !== 'function') return;
  const cfgMap = {
    admin_users: {
      anchorId: 'admin-users-tbody',
      labelSingular: 'user',
      onStart: () => { portalState.adminData = portalState.adminData || {}; portalState.adminData.users = []; renderAdminUsers(); },
      onRecord: (rec) => {
        portalState.adminData.users = portalState.adminData.users || [];
        portalState.adminData.users.push(normalizeUserRecord(rec));
        renderAdminUsers();
      }
    },
    admin_materials: {
      anchorId: 'admin-materials-table-container',
      labelSingular: 'material',
      onStart: () => { portalState.adminData = portalState.adminData || {}; portalState.adminData.materials = []; renderAdminMaterialsTable(); },
      onRecord: (rec) => {
        const norm = normalizeMaterialRecord(rec);
        portalState.adminData.materials = portalState.adminData.materials || [];
        portalState.adminData.materials.push(norm);
        portalState.materialsData = portalState.adminData.materials;
        renderAdminMaterialsTable();
      }
    },
    admin_logs: {
      anchorId: 'admin-logs-tbody',
      labelSingular: 'log entry',
      onStart: () => { portalState.adminData = portalState.adminData || {}; portalState.adminData.logs = []; renderAdminLogs(); },
      onRecord: (rec) => {
        portalState.adminData.logs = portalState.adminData.logs || [];
        portalState.adminData.logs.push(rec);
        renderAdminLogs();
      }
    },
    admin_feedback: {
      anchorId: 'admin-feedback-tbody',
      labelSingular: 'ticket',
      onStart: () => { portalState.adminData = portalState.adminData || {}; portalState.adminData.feedback = []; renderAdminFeedback(); },
      onRecord: (rec) => {
        portalState.adminData.feedback = portalState.adminData.feedback || [];
        portalState.adminData.feedback.push(rec);
        renderAdminFeedback();
      }
    }
  };
  const cfg = cfgMap[collection];
  if (!cfg) return;
  cfg.onStart();
  await window.streamCollectionOneByOne({
    streamKey: 'adm_' + collection,
    collection: collection,
    anchorId: cfg.anchorId,
    labelSingular: cfg.labelSingular,
    onRecord: cfg.onRecord
  });
};

export function getAllowedAdminSubtabsForCurrentUser() {
  if (!portalState.currentUser) return [];
  const role = String(portalState.currentUser.role || '').toLowerCase();
  const allTabs = ['analytics', 'batch-discussion', 'content', 'livetests', 'users', 'fees', 'attendance-matrix', 'outline-replies', 'logs', 'subtabs', 'evaluation', 'banner', 'leaderboard', 'feedback-admin', 'enterprise-ops'];
  if (role === 'superadmin') return allTabs;
  if (role !== 'admin') return [];

  const rawPerms = String(portalState.currentUser.adminPermissions || 'ALL').trim();
  if (!rawPerms || rawPerms.toUpperCase() === 'ALL') return allTabs;
  const parsed = rawPerms.split(',').map(s => s.trim()).filter(Boolean);
  if (parsed.includes('analytics') && !parsed.includes('batch-discussion')) {
    parsed.push('batch-discussion');
  }
  return parsed;
}

export function applyAdminTabPermissions() {
  const bar = document.getElementById('admin-main-subtab-bar') || document.getElementById('admin-subtabs-bar');
  const banner = document.getElementById('admin-role-permission-banner');
  if (!bar || !portalState.currentUser) return;

  const role = String(portalState.currentUser.role || '').toLowerCase();
  const allowed = getAllowedAdminSubtabsForCurrentUser();

  if (banner) {
    banner.style.display = 'flex';
    const badgeEl = document.getElementById('admin-current-role-badge');
    const summaryEl = document.getElementById('admin-permission-summary-text');
    if (badgeEl && summaryEl) {
      if (role === 'superadmin') {
        badgeEl.style.background = '#7c3aed';
        badgeEl.style.color = '#ffffff';
        badgeEl.innerText = '👑 SUPERADMIN';
        summaryEl.innerHTML = 'Full Administrative Access (Can manage Admins & Subtab Permissions)';
      } else {
        badgeEl.style.background = '#0284c7';
        badgeEl.style.color = '#ffffff';
        badgeEl.innerText = '🛡️ ADMIN';
        summaryEl.innerHTML = `Permitted Subtabs: <code>${allowed.join(', ').toUpperCase()}</code> (Assigned by Superadmin)`;
      }
    } else if (role === 'superadmin') {
      banner.innerHTML = `<i class="fa-solid fa-crown" style="color:#f59e0b;"></i> <strong>SUPERADMIN ACCESS:</strong> You have full access to all Admin tabs and can assign Admin roles & granular subtab permissions under <strong>Manage Users</strong>.`;
    } else {
      banner.innerHTML = `<i class="fa-solid fa-user-shield"></i> <strong>ADMIN ACCESS:</strong> Permitted Admin Subtabs: <code>${allowed.join(', ').toUpperCase()}</code> (Assigned by Superadmin)`;
    }
  }

  let firstAllowedTab = null;
  let firstAllowedBtn = null;
  let permittedCount = 0;
  bar.querySelectorAll('.subtab-btn').forEach(btn => {
    const tabKey = btn.getAttribute('data-admin-subtab');
    if (!tabKey) return;
    const isPermitted = allowed.includes(tabKey);
    btn.style.display = isPermitted ? 'inline-flex' : 'none';
    if (isPermitted) {
      permittedCount++;
      if (!firstAllowedTab) {
        firstAllowedTab = tabKey;
        firstAllowedBtn = btn;
      }
    }
  });
  const countBadge = document.getElementById('admin-main-subtab-count');
  if (countBadge) {
    countBadge.innerText = `${permittedCount} Module${permittedCount === 1 ? '' : 's'}`;
  }

  const activeBtn = bar.querySelector('.subtab-btn.active');
  if (activeBtn && activeBtn.style.display === 'none' && firstAllowedTab) {
    switchAdminTab(firstAllowedTab, firstAllowedBtn);
  }
  if (typeof window.initAdminSubtabsHorizontalScroll === 'function') {
    window.initAdminSubtabsHorizontalScroll();
  }
  if (typeof window.updateAdminSubtabsScrollButtons === 'function') {
    requestAnimationFrame(window.updateAdminSubtabsScrollButtons);
  }
}

window.updateAdminSubtabsScrollButtons = function() {
  const track = document.getElementById('admin-main-subtabs-track');
  const leftBtn = document.getElementById('admin-subtabs-scroll-left');
  const rightBtn = document.getElementById('admin-subtabs-scroll-right');
  if (!track || !leftBtn || !rightBtn) return;
  const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
  leftBtn.disabled = track.scrollLeft <= 2;
  rightBtn.disabled = track.scrollLeft >= maxScroll - 2;
};

window.scrollAdminSubtabsBy = function(dir) {
  const track = document.getElementById('admin-main-subtabs-track');
  if (!track) return;
  const step = Math.max(260, Math.round(track.clientWidth * 0.65));
  track.scrollBy({ left: dir * step, behavior: 'smooth' });
  setTimeout(() => {
    if (typeof window.updateAdminSubtabsScrollButtons === 'function') {
      window.updateAdminSubtabsScrollButtons();
    }
  }, 260);
};

window.initAdminSubtabsHorizontalScroll = function() {
  const track = document.getElementById('admin-main-subtabs-track');
  if (!track || track.dataset.scrollBound === '1') {
    if (typeof window.updateAdminSubtabsScrollButtons === 'function') {
      requestAnimationFrame(window.updateAdminSubtabsScrollButtons);
    }
    return;
  }
  track.dataset.scrollBound = '1';

  // Smooth horizontal scroll on mouse wheel
  track.addEventListener('wheel', function(e) {
    if (track.scrollWidth <= track.clientWidth) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      track.scrollLeft += e.deltaY * 1.15;
      window.updateAdminSubtabsScrollButtons();
    }
  }, { passive: false });

  // Smooth click-and-drag horizontal panning with click protection
  let isDown = false;
  let startX = 0;
  let startScrollLeft = 0;
  let didDrag = false;

  track.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    isDown = true;
    didDrag = false;
    startX = e.pageX;
    startScrollLeft = track.scrollLeft;
  });

  window.addEventListener('mousemove', function(e) {
    if (!isDown) return;
    const dx = e.pageX - startX;
    if (Math.abs(dx) > 6) {
      didDrag = true;
      track.classList.add('is-dragging');
    }
    if (didDrag) {
      e.preventDefault();
      track.scrollLeft = startScrollLeft - dx;
      window.updateAdminSubtabsScrollButtons();
    }
  });

  window.addEventListener('mouseup', function() {
    if (!isDown) return;
    isDown = false;
    track.classList.remove('is-dragging');
    if (didDrag) {
      setTimeout(() => { didDrag = false; }, 40);
    }
  });

  track.addEventListener('click', function(e) {
    if (didDrag) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  track.addEventListener('scroll', window.updateAdminSubtabsScrollButtons, { passive: true });
  window.addEventListener('resize', window.updateAdminSubtabsScrollButtons, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => window.updateAdminSubtabsScrollButtons());
    ro.observe(track);
  }
  requestAnimationFrame(window.updateAdminSubtabsScrollButtons);
};

if (document.readyState === 'loading') {
  onDomReady(() => window.initAdminSubtabsHorizontalScroll());
} else {
  window.initAdminSubtabsHorizontalScroll();
}

window.filterAdminMainSubtabs = function(query) {
  const bar = document.getElementById('admin-main-subtab-bar');
  if (!bar) return;
  const q = String(query || '').trim().toLowerCase();
  let visibleCount = 0;
  bar.querySelectorAll('.subtab-btn').forEach(btn => {
    const label = (btn.textContent || '').toLowerCase();
    const key = (btn.getAttribute('data-admin-subtab') || '').toLowerCase();
    const matches = !q || label.includes(q) || key.includes(q);
    btn.classList.toggle('rp-admin-tab-filtered-out', !matches);
    if (matches && btn.style.display !== 'none') visibleCount++;
  });
  const countBadge = document.getElementById('admin-main-subtab-count');
  if (countBadge) {
    countBadge.innerText = `${visibleCount} Module${visibleCount === 1 ? '' : 's'}`;
  }
  if (typeof window.updateAdminSubtabsScrollButtons === 'function') {
    requestAnimationFrame(window.updateAdminSubtabsScrollButtons);
  }
};

export function openAdminBatchDiscussionBoard(btn) {
  const bdiscBtn = btn || document.querySelector('#admin-main-subtab-bar .subtab-btn[data-admin-subtab="batch-discussion"]');
  switchAdminTab('batch-discussion', bdiscBtn);
  setTimeout(() => {
    const card = document.getElementById('admin-realtime-batch-discussion-card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const inp = document.getElementById('admin-batch-discussion-input');
      if (inp) inp.focus();
    }
  }, 60);
}

export function switchAdminTab(subTab, btn) {
  const allowed = getAllowedAdminSubtabsForCurrentUser();
  const normalizedSub = (subTab === 'feedback') ? 'feedback-admin' : subTab;
  if (allowed.length > 0 && !allowed.includes(normalizedSub) && !allowed.includes(subTab)) {
    showToast('🚫 Access Denied: Superadmin has not granted permission for this Admin subtab.');
    return;
  }

  if (typeof logPortalAction === 'function') {
    logPortalAction('ADMIN_SUBTAB_SWITCH', `Opened Admin Subtab: ${normalizedSub.toUpperCase()}`);
  }

  document.querySelectorAll('.admin-tab-body').forEach(b => {
    b.style.display = 'none';
  });

  let targetId = `admin-sub-${normalizedSub}`;
  if (normalizedSub === 'analytics') targetId = 'admin-sub-analytics';
  if (normalizedSub === 'batch-discussion') targetId = 'admin-sub-batch-discussion';
  if (normalizedSub === 'feedback' || normalizedSub === 'feedback-admin') targetId = 'admin-sub-feedback-admin';
  if (normalizedSub === 'banner') targetId = 'admin-sub-banner';
  if (normalizedSub === 'livetests') targetId = 'admin-sub-livetests';
  if (normalizedSub === 'leaderboard') targetId = 'admin-sub-leaderboard';
  if (normalizedSub === 'content') targetId = 'admin-sub-content';
  if (normalizedSub === 'users') targetId = 'admin-sub-users';
  if (normalizedSub === 'fees') targetId = 'admin-sub-fees';
  if (normalizedSub === 'logs') targetId = 'admin-sub-logs';
  if (normalizedSub === 'subtabs') targetId = 'admin-sub-subtabs';
  if (normalizedSub === 'evaluation') targetId = 'admin-sub-evaluation';
  if (normalizedSub === 'enterprise-ops') {
    targetId = 'admin-sub-enterprise-ops';
    if (typeof window.renderAdminEnterpriseOpsSubtab === 'function') window.renderAdminEnterpriseOpsSubtab();
  }

  const targetSub = document.getElementById(targetId);
  if (targetSub) {
    targetSub.style.display = 'block';
  }

  let activeTabBtn = null;
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.subtab-btn').forEach(sb => sb.classList.remove('active'));
    btn.classList.add('active');
    activeTabBtn = btn;
  } else {
    const matchingBtn = document.querySelector(`#admin-main-subtab-bar .subtab-btn[data-admin-subtab="${normalizedSub}"]`);
    if (matchingBtn && matchingBtn.parentElement) {
      matchingBtn.parentElement.querySelectorAll('.subtab-btn').forEach(sb => sb.classList.remove('active'));
      matchingBtn.classList.add('active');
      activeTabBtn = matchingBtn;
    }
  }
  if (activeTabBtn && typeof activeTabBtn.scrollIntoView === 'function') {
    activeTabBtn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }
  if (typeof window.updateAdminSubtabsScrollButtons === 'function') {
    setTimeout(window.updateAdminSubtabsScrollButtons, 220);
  }

  triggerAdminRenderer(normalizedSub);
  const needsServerLoad = !portalState.adminData
    || !Array.isArray(portalState.adminData.materials) || portalState.adminData.materials.length === 0
    || !Array.isArray(portalState.adminData.users) || portalState.adminData.users.length === 0;
  if (needsServerLoad && !window._isLoadingAdminData) {
    loadAdminData().then(() => {
      triggerAdminRenderer(normalizedSub);
    });
  }

  try { portalHooks.emit('afterAdminTabSwitch', subTab, btn); } catch (_hk) {}
}

export function triggerAdminRenderer(subTab) {
  if (subTab === 'analytics') {
    renderAdminPerformanceDashboard();
    renderAdminRealtimeNotifications();
  }
  if (subTab === 'batch-discussion') {
    populateAllBatchSelectDropdowns();
    if (typeof renderAdminBatchDiscussionBoard === 'function') renderAdminBatchDiscussionBoard();
    if (typeof loadShorthandPadsFromServer === 'function') loadShorthandPadsFromServer('admin', false);
  }
  if (subTab === 'banner') {
    renderAdminBannersTable();
    renderAdminDateBannersTable();
    loadDashboardBannerIntoAdminForm();
    if (typeof loadMaintenanceSettingsIntoAdminForm === 'function') loadMaintenanceSettingsIntoAdminForm();
  }
  if (subTab === 'livetests') {
    populateLiveTestMaterialOptions();
    renderAdminLiveTestsTable();
  }
  if (subTab === 'leaderboard') renderAdminLeaderboard();
  if (subTab === 'feedback-admin' || subTab === 'feedback') renderAdminFeedback();
  if (subTab === 'users') {
    renderAdminUsers();
  }
  if (subTab === 'attendance-matrix') {
    if (typeof window.renderAdminMonthlyAttendanceMatrix === 'function') window.renderAdminMonthlyAttendanceMatrix();
  }
  if (subTab === 'fees') {
    if (typeof window.renderAdminFeesManager === 'function') window.renderAdminFeesManager();
  }
  if (subTab === 'logs') renderAdminLogs();
  if (subTab === 'subtabs') renderAdminSubtabsTable();
  if (subTab === 'evaluation') renderAdminEvaluationRulesTable();
  if (subTab === 'content') renderAdminMaterialsTable();
}

window.rpConfirmDelete = function(title, message, onConfirm) {
  let overlay = document.getElementById('rp-delete-confirm-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'rp-delete-confirm-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:999998; background:rgba(15,23,42,0.68); backdrop-filter:blur(4px); display:none; align-items:center; justify-content:center; padding:16px;';
    overlay.innerHTML = `
      <div class="card" role="alertdialog" aria-modal="true" style="max-width:420px; width:100%; border-radius:16px; border:1px solid rgba(239,68,68,0.4); border-top:4px solid #ef4444; padding:22px 24px; box-shadow:0 24px 54px rgba(15,23,42,0.4);">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
          <span style="width:40px; height:40px; border-radius:12px; background:rgba(239,68,68,0.12); color:#dc2626; display:inline-flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </span>
          <h4 id="rp-delete-confirm-title" style="margin:0; font-size:16px; font-weight:800; color:var(--secondary);">Confirm Deletion</h4>
        </div>
        <p id="rp-delete-confirm-msg" style="margin:0 0 18px 0; font-size:13.5px; line-height:1.55; color:var(--text-muted);"></p>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" id="rp-delete-confirm-cancel" class="btn btn-secondary btn-sm" style="padding:8px 16px; font-weight:700;">Cancel</button>
          <button type="button" id="rp-delete-confirm-ok" class="btn btn-danger btn-sm" style="padding:8px 18px; font-weight:800; background:#dc2626; color:#fff; border:none;"><i class="fa-solid fa-trash-can"></i> Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  const titleEl = document.getElementById('rp-delete-confirm-title');
  const msgEl = document.getElementById('rp-delete-confirm-msg');
  const cancelBtn = document.getElementById('rp-delete-confirm-cancel');
  const okBtn = document.getElementById('rp-delete-confirm-ok');
  if (titleEl) titleEl.textContent = title || 'Confirm Deletion';
  if (msgEl) msgEl.textContent = message || 'Are you sure you want to permanently delete this item? This action cannot be undone.';

  const close = () => {
    overlay.style.display = 'none';
    document.removeEventListener('keydown', onEsc);
  };
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onEsc);
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  if (cancelBtn) cancelBtn.onclick = close;
  if (okBtn) {
    okBtn.onclick = () => {
      close();
      if (typeof onConfirm === 'function') onConfirm();
    };
  }
  overlay.style.display = 'flex';
  if (okBtn) setTimeout(() => okBtn.focus(), 20);
};

export function renderAdminPerformanceDashboard() {
  if (typeof window.updateAdminTelemetryKpiStrip === 'function') {
    window.updateAdminTelemetryKpiStrip();
  }
  const dauEl = document.getElementById('adm-perf-dau-badge') || document.getElementById('adm-perf-dau-count');
  const speedEl = document.getElementById('adm-perf-speed-badge') || document.getElementById('adm-perf-avg-speed');
  const matEl = document.getElementById('adm-perf-materials-badge') || document.getElementById('adm-perf-materials-accessed');
  const dauChart = document.getElementById('adm-recharts-dau-container') || document.getElementById('admin-perf-dau-chart');
  const speedChart = document.getElementById('adm-recharts-speed-container') || document.getElementById('admin-perf-speed-chart');
  const matChart = document.getElementById('adm-recharts-materials-container') || document.getElementById('admin-perf-materials-chart');
  const batchFilterSel = document.getElementById('admin-analytics-batch-filter');
  const batchesSummaryEl = document.getElementById('an-kpi-batches-summary');
  const comparisonTbody = document.getElementById('admin-batch-comparison-tbody');

  const rawHist = (portalState.adminData && Array.isArray(portalState.adminData.history) && portalState.adminData.history.length > 0)
    ? portalState.adminData.history
    : ((portalState.globalData && Array.isArray(portalState.globalData.history)) ? portalState.globalData.history : portalState.allTestHistoryList);
  const rawLogs = (portalState.adminData && Array.isArray(portalState.adminData.logs)) ? portalState.adminData.logs : [];
  const allUsers = (portalState.adminData && Array.isArray(portalState.adminData.users)) ? portalState.adminData.users.map(normalizeUserRecord) : [];

  // Map userId -> batch list
  const userBatchLookup = {};
  const batchNamesSet = new Set(['RP-Trail']);
  if (typeof getInstituteBatchesList === 'function') {
    getInstituteBatchesList().forEach(b => { if (b) batchNamesSet.add(b); });
  }
  allUsers.forEach(u => {
    const uid = String(u.UserID || u.userId || '').trim();
    const bList = typeof getUserAssignedBatchesList === 'function'
      ? getUserAssignedBatchesList(uid, u.Batch || u.batch)
      : [String(u.Batch || u.batch || 'RP-Trail')];
    userBatchLookup[uid] = bList;
    bList.forEach(b => { if (b) batchNamesSet.add(b); });
  });

  // Populate Batch Filter Dropdown preserving selection
  if (batchFilterSel) {
    const prevVal = batchFilterSel.value || 'ALL';
    const sortedBatches = Array.from(batchNamesSet).sort();
    batchFilterSel.innerHTML = `<option value="ALL">All Batches (${sortedBatches.length})</option>` +
      sortedBatches.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
    if (Array.from(batchFilterSel.options).some(o => o.value === prevVal)) {
      batchFilterSel.value = prevVal;
    }
  }

  const selectedBatch = batchFilterSel ? (batchFilterSel.value || 'ALL') : 'ALL';
  const batchUserIds = new Set();
  allUsers.forEach(u => {
    const uid = String(u.UserID || u.userId || '').trim();
    const bList = userBatchLookup[uid] || ['RP-Trail'];
    if (selectedBatch === 'ALL' || bList.includes(selectedBatch)) {
      batchUserIds.add(uid);
    }
  });

  const allHist = selectedBatch === 'ALL'
    ? rawHist
    : rawHist.filter(h => batchUserIds.has(String(h.UserID || h.userId || '').trim()));
  const allLogs = selectedBatch === 'ALL'
    ? rawLogs
    : rawLogs.filter(l => batchUserIds.has(String(l.UserID || l.userId || '').trim()));

  if (batchesSummaryEl) {
    const freeTierCount = allUsers.filter(u => {
      const bLow = String(u.Batch || u.batch || 'RP-Trail').toLowerCase();
      return !bLow || bLow === 'rp-trail' || bLow === 'free tier' || bLow === 'general batch';
    }).length;
    batchesSummaryEl.textContent = `${batchNamesSet.size} / ${freeTierCount} RP-Trail`;
  }

  // Render Batch-Wise Performance Comparison Table
  if (comparisonTbody) {
    const todayIso = getLocalDateString();
    const sortedBatches = Array.from(batchNamesSet).sort();
    const rowsHtml = sortedBatches.map(bName => {
      const members = allUsers.filter(u => (userBatchLookup[String(u.UserID || '')] || []).includes(bName));
      const memberIds = new Set(members.map(u => String(u.UserID || '')));
      const bHist = rawHist.filter(h => memberIds.has(String(h.UserID || h.userId || '')));
      const speeds = bHist.map(h => parseFloat(h.NetSpeed ?? h.netSpeed ?? h.GrossSpeed ?? 0)).filter(n => !isNaN(n) && n > 0);
      const accs = bHist.map(h => parseFloat(String(h.Accuracy ?? h.accuracy ?? '0').replace('%', ''))).filter(n => !isNaN(n) && n > 0);
      const avgWpm = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
      const avgAcc = accs.length ? (accs.reduce((a, b) => a + b, 0) / accs.length).toFixed(1) : '0.0';
      const activeTodayIds = new Set(bHist.filter(h => formatLocalDate(h.Date || h.date || '') === todayIso).map(h => String(h.UserID || h.userId || '')));
      const expiredCount = members.filter(u => u.AutoSwitchedToFreeTier || (u.EnrollmentValidUntil && u.EnrollmentValidUntil < todayIso)).length;
      const isSelected = selectedBatch === bName;
      return `
        <tr style="${isSelected ? 'background:rgba(37,99,235,0.06);' : ''}">
          <td><strong>${escapeHtml(bName)}</strong></td>
          <td class="mono-num">${members.length}</td>
          <td class="mono-num" style="color:#059669; font-weight:700;">${activeTodayIds.size}</td>
          <td class="mono-num">${bHist.length}</td>
          <td class="mono-num" style="font-weight:700; color:var(--primary);">${avgWpm} WPM</td>
          <td class="mono-num" style="font-weight:700; color:#059669;">${avgAcc}%</td>
          <td class="mono-num" style="color:${expiredCount > 0 ? '#d97706' : 'var(--text-muted)'}; font-weight:${expiredCount > 0 ? '700' : '500'};">${expiredCount}</td>
          <td>
            <button type="button" class="btn btn-secondary btn-sm" style="padding:3px 9px; font-size:11px;" onclick="const s=document.getElementById('admin-analytics-batch-filter'); if(s){s.value='${bName.replace(/'/g, "\\'")}'; renderAdminPerformanceDashboard();}">
              <i class="fa-solid fa-filter"></i> Focus
            </button>
          </td>
        </tr>
      `;
    }).join('');
    comparisonTbody.innerHTML = rowsHtml || `<tr><td colspan="8" style="text-align:center; padding:16px; color:var(--text-muted);">No batch records found yet.</td></tr>`;
  }

  // Build 7-day trend buckets
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = formatLocalDate(d.toISOString());
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    days.push({ iso, label, activeUsers: new Set(), speeds: [], testsCount: 0 });
  }

  allHist.forEach(h => {
    const hDate = formatLocalDate(h.Date || h.date || h.typingDate || '');
    const bucket = days.find(d => d.iso === hDate);
    if (bucket) {
      bucket.activeUsers.add(h.UserID || h.userId || h.UserName || 'User');
      const spd = parseFloat(h.NetSpeed ?? h.netSpeed ?? h.GrossSpeed ?? 0);
      if (spd > 0) bucket.speeds.push(spd);
      bucket.testsCount++;
    }
  });

  allLogs.forEach(l => {
    const lDate = formatLocalDate(l.Timestamp || '');
    const bucket = days.find(d => d.iso === lDate);
    if (bucket && (l.UserID || l.UserName)) {
      bucket.activeUsers.add(l.UserID || l.UserName);
    }
  });

  const series = days.map((d) => {
    const dau = d.activeUsers.size;
    const avgSpd = d.speeds.length > 0
      ? Math.round(d.speeds.reduce((a, b) => a + b, 0) / d.speeds.length)
      : 0;
    return { label: d.label.split(',')[0], fullLabel: d.label, dau, avgSpd };
  });

  const todayDau = series[series.length - 1].dau;
  const activeSpeedDays = series.filter(s => s.avgSpd > 0);
  const overallAvgSpeed = activeSpeedDays.length > 0
    ? Math.round(activeSpeedDays.reduce((acc, s) => acc + s.avgSpd, 0) / activeSpeedDays.length)
    : 0;

  const matAccessCounts = {
    'Audio Dictations': allLogs.filter(l => String(l.Details || '').toLowerCase().includes('audio') || String(l.ActivityType || '').includes('AUDIO')).length,
    'Typing Passages': allHist.filter(h => String(h.ExamName || '').toLowerCase().includes('typing')).length,
    'Pitman Exercises': allHist.filter(h => String(h.ExamName || '').toLowerCase().includes('pitman')).length,
    'Video Courses': allLogs.filter(l => String(l.ActivityType || '').includes('VIDEO')).length,
    'PDF Materials': allLogs.filter(l => String(l.ActivityType || '').includes('VIEW_MATERIAL') || String(l.ActivityType || '').includes('DOWNLOAD')).length,
    'SSC CBT Exams': allHist.filter(h => String(h.ExamName || '').toLowerCase().includes('cbt')).length
  };
  const totalMatAccessed = Object.values(matAccessCounts).reduce((a, b) => a + b, 0);

  if (dauEl) dauEl.innerText = `${todayDau} Today`;
  if (speedEl) speedEl.innerText = `${overallAvgSpeed} WPM Avg`;
  if (matEl) matEl.innerText = `${totalMatAccessed} Accessed`;

  if (dauChart) {
    const maxDau = Math.max(...series.map(s => s.dau), 5);
    dauChart.innerHTML = `
      <svg viewBox="0 0 420 185" style="width:100%; height:100%; overflow:visible;">
        <defs>
          <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="#818cf8" stop-opacity="0.65"/>
          </linearGradient>
        </defs>
        ${[0, 0.5, 1].map(t => {
          const y = 20 + t * 125;
          const val = Math.round(maxDau * (1 - t));
          return `<line x1="32" y1="${y}" x2="405" y2="${y}" stroke="var(--border)" stroke-dasharray="3,3"/>
                  <text x="26" y="${y + 4}" font-size="9" fill="var(--text-muted)" text-anchor="end">${val}</text>`;
        }).join('')}
        ${series.map((s, i) => {
          const barW = 32;
          const x = 45 + i * 52;
          const barH = s.dau > 0 ? Math.max(8, Math.round((s.dau / maxDau) * 125)) : 2;
          const y = 145 - barH;
          return `
            <g>
              <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="url(#dauGrad)">
                <title>${s.fullLabel}: ${s.dau} Active Users</title>
              </rect>
              <text x="${x + barW / 2}" y="${y - 5}" font-size="9" font-weight="800" fill="var(--primary)" text-anchor="middle">${s.dau}</text>
              <text x="${x + barW / 2}" y="164" font-size="9" font-weight="700" fill="var(--text-muted)" text-anchor="middle">${s.label}</text>
            </g>
          `;
        }).join('')}
      </svg>
    `;
  }

  if (speedChart) {
    const maxSpd = Math.max(...series.map(s => s.avgSpd), 80);
    const pts = series.map((s, i) => {
      const x = 45 + i * 56;
      const y = 145 - Math.round((s.avgSpd / maxSpd) * 120);
      return { x, y, ...s };
    });
    const polyPoints = pts.map(p => `${p.x},${p.y}`).join(' ');
    const areaPoints = `${pts[0].x},145 ${polyPoints} ${pts[pts.length - 1].x},145`;

    speedChart.innerHTML = `
      <svg viewBox="0 0 420 185" style="width:100%; height:100%; overflow:visible;">
        <defs>
          <linearGradient id="spdAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.38"/>
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        ${[0, 0.5, 1].map(t => {
          const y = 25 + t * 120;
          const val = Math.round(maxSpd * (1 - t));
          return `<line x1="32" y1="${y}" x2="405" y2="${y}" stroke="var(--border)" stroke-dasharray="3,3"/>
                  <text x="26" y="${y + 4}" font-size="9" fill="var(--text-muted)" text-anchor="end">${val}</text>`;
        }).join('')}
        <polygon points="${areaPoints}" fill="url(#spdAreaGrad)"/>
        <polyline fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${polyPoints}"/>
        ${pts.map(p => `
          <g>
            <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#ffffff" stroke="#059669" stroke-width="2.5">
              <title>${p.fullLabel}: ${p.avgSpd} WPM</title>
            </circle>
            <text x="${p.x}" y="${p.y - 8}" font-size="9" font-weight="800" fill="#059669" text-anchor="middle">${p.avgSpd}</text>
            <text x="${p.x}" y="164" font-size="9" font-weight="700" fill="var(--text-muted)" text-anchor="middle">${p.label}</text>
          </g>
        `).join('')}
      </svg>
    `;
  }

  if (matChart) {
    const entries = Object.entries(matAccessCounts);
    const maxVal = Math.max(...entries.map(e => e[1]), 1);
    const colors = ['#4f46e5', '#0284c7', '#10b981', '#d97706', '#e11d48', '#7c3aed'];
    matChart.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        ${entries.map(([name, val], i) => {
          const pct = val > 0 ? Math.min(100, Math.round((val / maxVal) * 100)) : 0;
          return `
            <div style="display:flex; flex-direction:column; gap:2px;">
              <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700;">
                <span style="color:var(--secondary);">${name}</span>
                <span style="color:${colors[i % colors.length]}; font-weight:800;">${val} accesses</span>
              </div>
              <div style="width:100%; height:8px; background:var(--border); border-radius:999px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${colors[i % colors.length]}; border-radius:999px; transition:width 0.4s ease;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

export const ADMIN_NOTIF_STORAGE_KEY = 'rp_skill_admin_realtime_notifications_v1';

export const adminNotifChannel = (typeof BroadcastChannel !== 'undefined')
  ? new BroadcastChannel('rp_skill_admin_notifications_channel')
  : null;

export function getAdminRealtimeNotifications() {
  try {
    const raw = localStorage.getItem(ADMIN_NOTIF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const now = Date.now();
        return parsed.filter(n => {
          const ts = n && n.timestamp ? new Date(n.timestamp).getTime() : now;
          return !isNaN(ts) ? (now - ts) <= (24 * 60 * 60 * 1000) : true;
        });
      }
    }
  } catch (e) {}
  return [];
}

export function saveAdminRealtimeNotifications(list) {
  try {
    const now = Date.now();
    const valid = (Array.isArray(list) ? list : []).filter(n => {
      const ts = n && n.timestamp ? new Date(n.timestamp).getTime() : now;
      return !isNaN(ts) ? (now - ts) <= (24 * 60 * 60 * 1000) : true;
    }).slice(0, 100);
    localStorage.setItem(ADMIN_NOTIF_STORAGE_KEY, JSON.stringify(valid));
  } catch (e) {}
}

export function isCurrentUserAdminOrSuper() {
  if (!portalState.currentUser) return false;
  const r = String(portalState.currentUser.role || '').toLowerCase();
  return r === 'admin' || r === 'superadmin';
}

export function pushAdminRealtimeNotification(notifObj, fromRemote = false) {
  if (!notifObj) return;
  const list = getAdminRealtimeNotifications();
  const id = notifObj.id || ('NOTIF-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));
  if (list.some(n => n.id === id || (n.message === notifObj.message && Math.abs(new Date(n.timestamp || 0).getTime() - new Date(notifObj.timestamp || Date.now()).getTime()) < 4000))) {
    return;
  }
  const item = {
    id,
    type: notifObj.type || 'HIGH_SCORE',
    title: notifObj.title || '🔔 Admin Alert',
    message: notifObj.message || '',
    userName: notifObj.userName || 'Learner',
    examName: notifObj.examName || '',
    timestamp: notifObj.timestamp || new Date().toISOString(),
    unread: true
  };
  list.unshift(item);
  saveAdminRealtimeNotifications(list);

  if (!fromRemote && adminNotifChannel) {
    try {
      adminNotifChannel.postMessage({ type: 'ADMIN_REALTIME_ALERT', notification: item });
    } catch (e) {}
  }

  renderAdminRealtimeNotifications();
  if (isCurrentUserAdminOrSuper()) {
    showToast(`${item.title}: ${item.message}`);
  }
}

if (adminNotifChannel) {
  adminNotifChannel.onmessage = (ev) => {
    if (ev.data && ev.data.type === 'ADMIN_REALTIME_ALERT' && ev.data.notification) {
      pushAdminRealtimeNotification(ev.data.notification, true);
    }
  };
}

window.addEventListener('storage', (ev) => {
  if (ev.key === ADMIN_NOTIF_STORAGE_KEY) {
    renderAdminRealtimeNotifications();
  }
});

export function checkAndTriggerHighScoreNotification(submissionPayload, isCbt = false) {
  if (!submissionPayload) return;
  const allHist = (portalState.adminData && Array.isArray(portalState.adminData.history) && portalState.adminData.history.length > 0)
    ? portalState.adminData.history
    : ((portalState.globalData && Array.isArray(portalState.globalData.history) && portalState.globalData.history.length > 0)
        ? portalState.globalData.history
        : (portalState.allTestHistoryList || []));

  if (isCbt) {
    const newMarks = parseFloat(submissionPayload.marksObtained ?? submissionPayload.MarksObtained ?? 0);
    if (newMarks <= 0) return;
    let prevMaxMarks = 0;
    allHist.forEach(h => {
      const hExam = String(h.ExamName || h.examName || '').toLowerCase();
      if (Boolean(h.isCbtExam) || hExam.includes('cbt')) {
        const m = parseFloat(h.MarksObtained ?? h.marksObtained ?? 0);
        if (!isNaN(m) && m > prevMaxMarks) prevMaxMarks = m;
      }
    });
    if (newMarks > prevMaxMarks) {
      const uName = submissionPayload.userName || (portalState.currentUser ? portalState.currentUser.name : 'Student');
      const eName = submissionPayload.examName || 'CBT Exam';
      pushAdminRealtimeNotification({
        type: 'HIGH_SCORE',
        title: '🏆 New CBT High-Score Record Broken!',
        message: `${uName} scored ${newMarks}/${submissionPayload.totalMarks || 100} marks in ${eName} (Previous Best: ${prevMaxMarks} marks)!`,
        userName: uName,
        examName: eName,
        timestamp: new Date().toISOString()
      });
      logPortalAction('HIGH_SCORE_RECORD_BROKEN', `New CBT High-Score Record by ${uName}: ${newMarks} Marks in ${eName} (Prev Best: ${prevMaxMarks})`);
    }
  } else {
    const newNetWpm = parseFloat(submissionPayload.netSpeed ?? submissionPayload.NetSpeed ?? 0);
    if (newNetWpm <= 0) return;
    let prevMaxWpm = 0;
    allHist.forEach(h => {
      const hExam = String(h.ExamName || h.examName || '').toLowerCase();
      if (!h.isCbtExam && !hExam.includes('cbt')) {
        const w = parseFloat(h.NetSpeed ?? h.netSpeed ?? 0);
        if (!isNaN(w) && w > prevMaxWpm) prevMaxWpm = w;
      }
    });
    if (newNetWpm > prevMaxWpm) {
      const uName = submissionPayload.userName || (portalState.currentUser ? portalState.currentUser.name : 'Student');
      const eName = submissionPayload.examName || 'Typing / Steno Test';
      pushAdminRealtimeNotification({
        type: 'HIGH_SCORE',
        title: '🏆 New Typing/Steno WPM Record Broken!',
        message: `${uName} achieved ${newNetWpm} WPM (${submissionPayload.accuracyPercentage || 100}% Acc) in ${eName} (Previous Best: ${prevMaxWpm} WPM)!`,
        userName: uName,
        examName: eName,
        timestamp: new Date().toISOString()
      });
      logPortalAction('HIGH_SCORE_RECORD_BROKEN', `New WPM High-Score Record by ${uName}: ${newNetWpm} WPM in ${eName} (Prev Best: ${prevMaxWpm} WPM)`);
    }
  }
}

export function syncServerLogsToAdminNotifications(logsArray) {
  if (!Array.isArray(logsArray) || logsArray.length === 0) return;
  const list = getAdminRealtimeNotifications();
  let changed = false;
  logsArray.forEach(l => {
    const act = String(l.ActivityType || '').toUpperCase();
    if (act === 'NEW_USER_REGISTERED' || act === 'HIGH_SCORE_RECORD_BROKEN') {
      const logId = 'LOGNOTIF-' + String(l.LogID || l.Timestamp || '');
      if (!list.some(n => n.id === logId)) {
        list.unshift({
          id: logId,
          type: act === 'NEW_USER_REGISTERED' ? 'NEW_USER' : 'HIGH_SCORE',
          title: act === 'NEW_USER_REGISTERED' ? '👤 New User Registered' : '🏆 High-Score Record Broken!',
          message: l.Details || '',
          userName: l.UserName || 'User',
          timestamp: l.Timestamp || new Date().toISOString(),
          unread: true
        });
        changed = true;
      }
    }
  });
  if (changed) {
    saveAdminRealtimeNotifications(list);
  }
}

export function renderAdminRealtimeNotifications() {
  const feedEl = document.getElementById('admin-realtime-notifications-list') || document.getElementById('admin-realtime-notifications-feed');
  const badgeEl = document.getElementById('admin-notif-unread-badge');
  const totalPillEl = document.getElementById('admin-notif-total-pill');
  const liveDotEl = document.getElementById('admin-notif-live-dot');
  const filterSelect = document.getElementById('admin-notif-filter-select');
  const filterType = filterSelect ? filterSelect.value : 'ALL';

  const allList = getAdminRealtimeNotifications();
  const unreadCount = allList.filter(n => n.unread).length;
  const list = filterType === 'ALL'
    ? allList
    : allList.filter(n => String(n.type || '').toUpperCase() === filterType.toUpperCase());

  if (badgeEl) {
    badgeEl.innerText = String(unreadCount);
    badgeEl.style.background = unreadCount > 0 ? '#ef4444' : '#64748b';
  }
  if (totalPillEl) {
    totalPillEl.innerText = `${unreadCount} Unread / ${allList.length} Total`;
  }
  if (liveDotEl) {
    liveDotEl.style.background = unreadCount > 0 ? '#ef4444' : '#10b981';
  }

  if (!feedEl) return;
  if (list.length === 0) {
    feedEl.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:12px;">No new user registrations or high-score record alerts yet. Live listener is active.</div>`;
    return;
  }

  feedEl.innerHTML = list.map(item => {
    const isHighScore = item.type === 'HIGH_SCORE';
    const borderCol = isHighScore ? '#f59e0b' : '#3b82f6';
    const bgCol = item.unread
      ? (isHighScore ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)')
      : 'var(--background)';
    const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';
    return `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; padding:10px 12px; border-radius:8px; background:${bgCol}; border:1px solid var(--border); border-left:4px solid ${borderCol};">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <strong style="font-size:12.5px; color:var(--secondary);">${item.title}</strong>
            ${item.unread ? `<span style="background:#ef4444; color:#fff; font-size:9px; font-weight:800; padding:1px 6px; border-radius:999px;">NEW</span>` : ''}
          </div>
          <div style="font-size:12px; color:var(--text); line-height:1.4;">${item.message}</div>
        </div>
        <span style="font-size:10px; color:var(--text-muted); white-space:nowrap; font-weight:600;">${timeStr}</span>
      </div>
    `;
  }).join('');
}

export function markAllAdminNotificationsRead() {
  const list = getAdminRealtimeNotifications().map(n => ({ ...n, unread: false }));
  saveAdminRealtimeNotifications(list);
  renderAdminRealtimeNotifications();
  showToast('✅ All admin notifications marked as read.');
}

export function clearAllAdminRealtimeNotifications() {
  saveAdminRealtimeNotifications([]);
  renderAdminRealtimeNotifications();
  showToast('Cleared admin notification feed.');
}

export function getFilteredAdminLeaderboardList() {
  const dateInput = document.getElementById('admin-leaderboard-date');
  const searchInput = document.getElementById('admin-search-leaderboard');
  const statusFilterSelect = document.getElementById('admin-filter-leaderboard-status');
  const catFilterSelect = document.getElementById('admin-filter-leaderboard-category');

  // Only default to today's date on initial page load if never initialized and no search is active
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  if (dateInput && !dateInput.value && !dateInput.dataset.initializedOnce && !search) {
    dateInput.dataset.initializedOnce = 'true';
    dateInput.value = getLocalDateString();
  }

  const selectedDate = dateInput ? dateInput.value : '';
  const statusFilter = statusFilterSelect ? statusFilterSelect.value : 'ALL';
  const catFilter = catFilterSelect ? catFilterSelect.value : 'ALL';

  const allHistory = (portalState.adminData && Array.isArray(portalState.adminData.history) && portalState.adminData.history.length > 0)
    ? portalState.adminData.history
    : ((portalState.globalData && Array.isArray(portalState.globalData.history)) ? portalState.globalData.history : (portalState.allTestHistoryList || []));

  let filtered = [...allHistory];
  if (!search && selectedDate) {
    filtered = filtered.filter(h => {
      const rawDate = h.Date || h.date || h.typingDate || h.timestamp;
      const hDate = formatLocalDate(rawDate);
      return hDate === selectedDate;
    });
  }

  if (search) {
    filtered = filtered.filter(h => {
      const uName = String(h.UserName || h.userName || '').toLowerCase();
      const uId = String(h.UserID || h.userId || '').toLowerCase();
      const eName = String(h.ExamName || h.examName || '').toLowerCase();
      return uName.includes(search) || uId.includes(search) || eName.includes(search);
    });
  }

  if (catFilter !== 'ALL') {
    filtered = filtered.filter(h => {
      const eName = String(h.ExamName || h.examName || '').toLowerCase();
      if (catFilter === 'cbt') return Boolean(h.isCbtExam) || eName.includes('cbt');
      if (catFilter === 'audio') return eName.includes('audio') || eName.includes('dictation') || eName.includes('steno');
      if (catFilter === 'pitman') return eName.includes('pitman');
      if (catFilter === 'typing') return eName.includes('typing') || eName.includes('learning');
      return true;
    });
  }

  if (statusFilter !== 'ALL') {
    filtered = filtered.filter(h => String(h.Status || h.status || '').toUpperCase() === statusFilter.toUpperCase());
  }

  filtered.sort((a, b) => {
    const marksDiff = (parseFloat(b.MarksObtained ?? b.marksObtained ?? 0) || 0) - (parseFloat(a.MarksObtained ?? a.marksObtained ?? 0) || 0);
    if (marksDiff !== 0) return marksDiff;
    const wpmDiff = (parseFloat(b.NetSpeed ?? b.netSpeed ?? 0) || 0) - (parseFloat(a.NetSpeed ?? a.netSpeed ?? 0) || 0);
    if (wpmDiff !== 0) return wpmDiff;
    return (parseFloat(b.AccuracyPercentage ?? b.accuracyPercentage ?? 0) || 0) - (parseFloat(a.AccuracyPercentage ?? a.accuracyPercentage ?? 0) || 0);
  });

  return filtered;
}

export function renderAdminLeaderboard() {
  const container = document.getElementById('admin-leaderboard-container');
  const pageIndicator = document.getElementById('admin-leaderboard-page-indicator');
  const dateInput = document.getElementById('admin-leaderboard-date');
  if (!container) return;

  const filtered = getFilteredAdminLeaderboardList();
  const selectedDate = dateInput && dateInput.value ? dateInput.value : 'All Dates';

  // Populate KPI Strip (Requirement #11)
  const kpiTotal = document.getElementById('adm-lb-kpi-total');
  const kpiPassed = document.getElementById('adm-lb-kpi-passrate') || document.getElementById('adm-lb-kpi-passed');
  const kpiWpm = document.getElementById('adm-lb-kpi-topwpm') || document.getElementById('adm-lb-kpi-wpm');
  const kpiAcc = document.getElementById('adm-lb-kpi-avgacc') || document.getElementById('adm-lb-kpi-acc');

  const passedCount = filtered.filter(h => String(h.Status || h.status || '').toUpperCase() === 'PASSED').length;
  const maxWpm = filtered.length > 0
    ? Math.max(0, ...filtered.map(h => parseFloat(h.NetSpeed ?? h.netSpeed ?? 0) || 0))
    : 0;
  const avgAcc = filtered.length > 0
    ? (filtered.reduce((s, h) => s + (parseFloat(h.AccuracyPercentage ?? h.accuracyPercentage ?? 0) || 0), 0) / filtered.length).toFixed(1)
    : '0.0';

  if (kpiTotal) kpiTotal.innerText = String(filtered.length);
  if (kpiPassed) kpiPassed.innerText = `${passedCount} (${filtered.length > 0 ? Math.round((passedCount / filtered.length) * 100) : 0}%)`;
  if (kpiWpm) kpiWpm.innerText = `${maxWpm} WPM`;
  if (kpiAcc) kpiAcc.innerText = `${avgAcc}%`;

  const totalPages = Math.ceil(filtered.length / ADMIN_LEADERBOARD_PER_PAGE) || 1;
  if (portalState.currentAdminLeaderboardPage > totalPages) portalState.currentAdminLeaderboardPage = totalPages;
  if (portalState.currentAdminLeaderboardPage < 1) portalState.currentAdminLeaderboardPage = 1;

  const startIndex = (portalState.currentAdminLeaderboardPage - 1) * ADMIN_LEADERBOARD_PER_PAGE;
  const paginatedList = filtered.slice(startIndex, startIndex + ADMIN_LEADERBOARD_PER_PAGE);

  if (pageIndicator) {
    pageIndicator.innerText = `Page ${portalState.currentAdminLeaderboardPage} of ${totalPages} (${filtered.length} ranked submissions)`;
  }

  if (paginatedList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 28px 18px; color: var(--text-muted); font-size: 13px;">
        <i class="fa-solid fa-trophy" style="font-size: 24px; color: #f59e0b; margin-bottom: 8px; display: block;"></i>
        No test submissions found for <strong>${selectedDate}</strong> with the active filters.
        <div style="margin-top: 8px;">
          <button type="button" class="btn btn-sm btn-secondary" onclick="const d=document.getElementById('admin-leaderboard-date'); if(d){d.value='';} const s=document.getElementById('admin-filter-leaderboard-status'); if(s){s.value='ALL';} const c=document.getElementById('admin-filter-leaderboard-category'); if(c){c.value='ALL';} renderAdminLeaderboard();">
            <i class="fa-solid fa-globe"></i> Show All-Time Leaderboard Records
          </button>
        </div>
      </div>
    `;
    return;
  }

  let html = `
    <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
      <thead>
        <tr style="background: var(--background); border-bottom: 2px solid var(--border); text-align: left;">
          <th style="padding: 10px 12px;">Rank</th>
          <th style="padding: 10px 12px;">Candidate</th>
          <th style="padding: 10px 12px;">Exam / Exercise</th>
          <th style="padding: 10px 12px;">Date</th>
          <th style="padding: 10px 12px;">Net / Gross Speed</th>
          <th style="padding: 10px 12px;">Accuracy</th>
          <th style="padding: 10px 12px;">Marks</th>
          <th style="padding: 10px 12px;">Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  paginatedList.forEach((h, index) => {
    const globalRank = startIndex + index + 1;
    const uName = h.UserName || h.userName || 'Student';
    const uId = h.UserID || h.userId || '-';
    const eName = h.ExamName || h.examName || '-';
    const rawDate = h.Date || h.date || h.typingDate || '';
    const dateStr = formatLocalDate(rawDate) || '-';
    const acc = parseFloat(h.AccuracyPercentage ?? h.accuracyPercentage ?? 0).toFixed(1);
    const marks = h.MarksObtained ?? h.marksObtained ?? '-';
    const netSpd = h.NetSpeed ?? h.netSpeed ?? 0;
    const grossSpd = h.GrossSpeed ?? h.grossSpeed ?? netSpd;
    const status = String(h.Status || h.status || 'FAILED').toUpperCase();
    const isPassed = status === 'PASSED';

    const rankBadge = globalRank === 1
      ? `<span style="background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; padding:2px 8px; border-radius:999px; font-weight:900;">🥇 #1</span>`
      : (globalRank === 2
        ? `<span style="background:#94a3b8; color:#fff; padding:2px 8px; border-radius:999px; font-weight:900;">🥈 #2</span>`
        : (globalRank === 3
          ? `<span style="background:#b45309; color:#fff; padding:2px 8px; border-radius:999px; font-weight:900;">🥉 #3</span>`
          : `<strong class="mono-num">#${globalRank}</strong>`));

    html += `
      <tr style="border-bottom: 1px solid var(--border); ${globalRank <= 3 ? 'background: rgba(245,158,11,0.04);' : ''}">
        <td style="padding: 9px 12px;">${rankBadge}</td>
        <td style="padding: 9px 12px;">
          <strong style="color: var(--secondary);">${uName}</strong>
          <div style="font-size: 10.5px; color: var(--text-muted);" class="mono-num">${uId}</div>
        </td>
        <td style="padding: 9px 12px; font-weight: 700; color: var(--secondary);">${eName}</td>
        <td style="padding: 9px 12px; font-size: 11.5px; color: var(--text-muted);" class="mono-num">${dateStr}</td>
        <td style="padding: 9px 12px;" class="mono-num">
          <strong style="color: var(--primary);">${netSpd} WPM</strong>
          <span style="font-size: 10.5px; color: var(--text-muted);">(${grossSpd} Gross)</span>
        </td>
        <td style="padding: 9px 12px; font-weight: 800; color: ${parseFloat(acc) >= 92 ? '#059669' : '#d97706'};" class="mono-num">${acc}%</td>
        <td style="padding: 9px 12px; font-weight: 800;" class="mono-num">${marks}</td>
        <td style="padding: 9px 12px;">
          <span class="role-badge" style="background: ${isPassed ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)'}; color: ${isPassed ? '#059669' : '#dc2626'}; border: 1px solid ${isPassed ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'};">${status}</span>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

export function paginateAdminLeaderboard(direction) {
  const filtered = getFilteredAdminLeaderboardList();
  const totalPages = Math.ceil(filtered.length / ADMIN_LEADERBOARD_PER_PAGE) || 1;

  if (direction === 1 && portalState.currentAdminLeaderboardPage < totalPages) {
    portalState.currentAdminLeaderboardPage++;
  } else if (direction === -1 && portalState.currentAdminLeaderboardPage > 1) {
    portalState.currentAdminLeaderboardPage--;
  }
  renderAdminLeaderboard();
}

export function exportAdminLeaderboardCSV() {
  const filtered = getFilteredAdminLeaderboardList();
  if (!filtered || filtered.length === 0) {
    showToast('⚠️ No leaderboard records match the current filter to export.');
    return;
  }
  const headers = ['Rank', 'UserID', 'UserName', 'ExamName', 'Date', 'NetSpeed_WPM', 'GrossSpeed_WPM', 'Accuracy_Pct', 'MarksObtained', 'Status'];
  const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const rows = filtered.map((h, i) => [
    i + 1,
    escapeCsv(h.UserID || h.userId || ''),
    escapeCsv(h.UserName || h.userName || ''),
    escapeCsv(h.ExamName || h.examName || ''),
    escapeCsv(formatLocalDate(h.Date || h.date || h.typingDate || '')),
    escapeCsv(h.NetSpeed ?? h.netSpeed ?? 0),
    escapeCsv(h.GrossSpeed ?? h.grossSpeed ?? 0),
    escapeCsv(h.AccuracyPercentage ?? h.accuracyPercentage ?? 0),
    escapeCsv(h.MarksObtained ?? h.marksObtained ?? '-'),
    escapeCsv(h.Status || h.status || '')
  ].join(','));
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RP_Skill_Leaderboard_${getLocalDateString()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`✅ Exported ${filtered.length} Leaderboard records to CSV!`);
}

export const INSTITUTE_BATCHES_STORAGE_KEY = 'rp_institute_batches_v2';

export const USER_BATCH_ASSIGNMENTS_KEY = 'rp_user_batch_map_v2';

export function getInstituteBatchesList() {
      try {
        const raw = localStorage.getItem(INSTITUTE_BATCHES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.filter(b => {
              const low = String(b || '').trim().toLowerCase();
              return low && low !== 'general batch' && low !== 'free tier' && low !== 'rp-trail';
            });
          }
        }
      } catch (e) {}
      return [];
    }

export function saveInstituteBatchesList(list, syncToServer = true) {
      const cleaned = Array.from(new Set((list || []).map(b => String(b || '').trim()).filter(b => {
        const low = b.toLowerCase();
        return low && low !== 'general batch' && low !== 'free tier' && low !== 'rp-trail';
      })));
      try {
        localStorage.setItem(INSTITUTE_BATCHES_STORAGE_KEY, JSON.stringify(cleaned));
      } catch (e) {}
      if (syncToServer) {
        apiCall('saveInstituteBatches', { batches: cleaned }, true);
      }
    }

export function getUserBatchAssignmentsMap() {
      try {
        const raw = localStorage.getItem(USER_BATCH_ASSIGNMENTS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
      return {};
    }

export function saveUserBatchAssignmentsMap(map) {
      try {
        localStorage.setItem(USER_BATCH_ASSIGNMENTS_KEY, JSON.stringify(map || {}));
      } catch (e) {}
    }

export function normalizeSingleBatchName(name) {
      const s = String(name || '').trim();
      if (!s || s === '-' || s.toLowerCase() === 'general batch' || s.toLowerCase() === 'free tier' || s.toLowerCase() === 'rp-trail') return 'RP-Trail';
      return s;
    }

export function ensureFreeBatchIncluded(arr) {
      const seen = new Set();
      const custom = [];
      (Array.isArray(arr) ? arr : []).forEach(raw => {
        const n = normalizeSingleBatchName(raw);
        if (!n || n.toLowerCase() === 'rp-trail') return;
        const low = n.toLowerCase();
        if (!seen.has(low)) {
          seen.add(low);
          custom.push(n);
        }
      });
      // Assigned custom batches FIRST, permanent free batch RP-Trail always included
      return [...custom, 'RP-Trail'];
    }

export function parseBatchListValue(rawVal) {
      if (!rawVal) return [];
      if (Array.isArray(rawVal)) {
        return Array.from(new Set(rawVal.map(x => normalizeSingleBatchName(x)).filter(Boolean)));
      }
      const str = String(rawVal).trim();
      if (!str || str === '-') return [];
      if (str.startsWith('[')) {
        try {
          const arr = JSON.parse(str);
          if (Array.isArray(arr)) return Array.from(new Set(arr.map(x => normalizeSingleBatchName(x)).filter(Boolean)));
        } catch (e) {}
      }
      return Array.from(new Set(str.split(',').map(s => normalizeSingleBatchName(s)).filter(Boolean)));
    }

export function getUserAssignedBatchesList(userId, fallbackFromRecord = '') {
      const map = getUserBatchAssignmentsMap();
      if (userId && map[String(userId)]) {
        const parsed = parseBatchListValue(map[String(userId)]);
        if (parsed.length > 0) return ensureFreeBatchIncluded(parsed);
      }
      const fromRec = parseBatchListValue(fallbackFromRecord);
      if (fromRec.length > 0) return ensureFreeBatchIncluded(fromRec);
      return ['RP-Trail'];
    }

export function getUserAssignedBatch(userId, fallbackFromRecord = '') {
      return getUserAssignedBatchesList(userId, fallbackFromRecord).join(', ');
    }

export function evaluateClientMemberBatchAccess(userObj, targetBatch) {
      if (!userObj || !targetBatch) return false;
      const roleLow = String(userObj.role || userObj.Role || '').toLowerCase();
      if (roleLow !== 'member' && !userObj.isMemberAllAccess && !userObj.IsMemberAllAccess) return false;
      const validStr = String(userObj.membershipValidUntil || userObj.MembershipValidUntil || '').trim();
      if (validStr) {
        const exp = new Date(validStr.length === 10 ? validStr + 'T23:59:59' : validStr);
        if (!isNaN(exp.getTime()) && Date.now() > exp.getTime()) return false;
      }
      const normTarget = String(targetBatch).trim().toLowerCase();
      if (normTarget === 'rp-trail' || normTarget === 'all' || normTarget === 'all_batches') return true;

      const scope = String(userObj.memberAccessScope || userObj.MemberAccessScope || 'ALL_PAST_CURRENT_UPCOMING').trim().toUpperCase();
      if (scope === 'ALL_PAST_CURRENT_UPCOMING') return true;

      const batchMetaMap = (window.rpBatchMetaMap && typeof window.rpBatchMetaMap === 'object')
        ? window.rpBatchMetaMap
        : ((portalState.globalData && portalState.globalData.batchMetaMap) || (portalState.adminData && portalState.adminData.batchMetaMap) || {});
      const metaKey = Object.keys(batchMetaMap).find(k => k.trim().toLowerCase() === normTarget);
      const batchCreatedStr = metaKey && batchMetaMap[metaKey] ? String(batchMetaMap[metaKey].createdAt || '') : '';
      const batchCreatedMs = batchCreatedStr ? new Date(batchCreatedStr).getTime() : 0;
      const joinStr = String(userObj.memberJoinDate || userObj.MemberJoinDate || '').trim();
      const joinMs = joinStr ? new Date(joinStr).getTime() : 0;
      const includeUpcoming = Boolean(userObj.memberIncludeUpcoming || userObj.MemberIncludeUpcoming || String(userObj.MemberIncludeUpcoming || '').toLowerCase() === 'true');

      if (scope === 'ALL_EXISTING_ONLY') {
        if (!batchCreatedMs || !joinMs) return true;
        return batchCreatedMs <= joinMs + 86400000;
      }
      if (scope === 'CURRENT_AND_UPCOMING') {
        const explicit = String(userObj.memberIncludedBatches || userObj.MemberIncludedBatches || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        if (explicit.includes(normTarget)) return true;
        if (!batchCreatedMs || !joinMs) return true;
        return batchCreatedMs >= (joinMs - 86400000);
      }
      if (scope === 'CUSTOM_SELECTED') {
        const explicit = String(userObj.memberIncludedBatches || userObj.MemberIncludedBatches || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        if (explicit.includes(normTarget)) return true;
        if (includeUpcoming && batchCreatedMs && joinMs && batchCreatedMs >= (joinMs - 86400000)) return true;
        return false;
      }
      return true;
    }

export function userHasBatchAssigned(userId, targetBatch, fallbackFromRecord = '') {
      if (!targetBatch || targetBatch === 'ALL' || targetBatch === 'ALL_BATCHES') return true;
      // Evaluate granular Member Batch Access Scope (Past / Current / Upcoming / Custom)
      if (portalState.currentUser && String(portalState.currentUser.userId) === String(userId)) {
        if (evaluateClientMemberBatchAccess(portalState.currentUser, targetBatch)) {
          return true;
        }
      } else if (portalState.adminData && Array.isArray(portalState.adminData.users)) {
        const matchedUser = portalState.adminData.users.find(u => String(u.UserID || u.userId) === String(userId));
        if (matchedUser && evaluateClientMemberBatchAccess(matchedUser, targetBatch)) {
          return true;
        }
      }
      const list = getUserAssignedBatchesList(userId, fallbackFromRecord);
      if (list.includes('ALL_BATCHES')) return true;
      return list.some(b => b.toLowerCase() === String(targetBatch).trim().toLowerCase());
    }

export function filterAdminBatchChipsBar() {
      populateAllBatchSelectDropdowns();
    }

export const BATCH_MONITORS_STORAGE_KEY = 'rp_skill_batch_monitors_v1';

export function getBatchMonitorsMap() {
      let localMap = {};
      try {
        const raw = localStorage.getItem(BATCH_MONITORS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') localMap = parsed;
        }
      } catch (e) {}
      const serverGlobalMap = (portalState.globalData && (portalState.globalData.batchMonitorsMap || portalState.globalData.batchMonitors) && typeof (portalState.globalData.batchMonitorsMap || portalState.globalData.batchMonitors) === 'object')
        ? (portalState.globalData.batchMonitorsMap || portalState.globalData.batchMonitors)
        : {};
      const serverAdminMap = (portalState.adminData && (portalState.adminData.batchMonitorsMap || portalState.adminData.batchMonitors) && typeof (portalState.adminData.batchMonitorsMap || portalState.adminData.batchMonitors) === 'object')
        ? (portalState.adminData.batchMonitorsMap || portalState.adminData.batchMonitors)
        : {};
      return Object.assign({}, serverGlobalMap, serverAdminMap, localMap);
    }

export function saveBatchMonitorsMap(mapObj) {
      try {
        localStorage.setItem(BATCH_MONITORS_STORAGE_KEY, JSON.stringify(mapObj || {}));
      } catch (e) {}
      if (portalState.globalData && typeof portalState.globalData === 'object') {
        portalState.globalData.batchMonitorsMap = mapObj || {};
        portalState.globalData.batchMonitors = mapObj || {};
      }
      if (portalState.adminData && typeof portalState.adminData === 'object') {
        portalState.adminData.batchMonitorsMap = mapObj || {};
        portalState.adminData.batchMonitors = mapObj || {};
      }
    }

export function getUserMonitorBatchesList(userId) {
      if (!userId) return [];
      const uidStr = String(userId).trim();
      const map = getBatchMonitorsMap();
      const batches = [];
      Object.keys(map).forEach(batchName => {
        const entry = map[batchName];
        if (!entry) return;
        const mUid = typeof entry === 'object' ? String(entry.userId || '') : String(entry);
        if (mUid && mUid === uidStr) {
          batches.push(batchName);
        }
      });
      return batches;
    }

export function isUserMonitorForBatch(userId, batchName) {
      if (!userId || !batchName) return false;
      const map = getBatchMonitorsMap();
      const entry = map[batchName];
      if (!entry) return false;
      const mUid = typeof entry === 'object' ? String(entry.userId || '') : String(entry);
      return mUid === String(userId).trim();
    }

export async function appointBatchMonitor(batchName, userId, userName = '', monitorType = '') {
      if (!batchName) {
        showToast('⚠️ Please select a Batch to appoint a Monitor.');
        return;
      }
      if (!userId) {
        showToast('⚠️ Please select an Instructor or Top-Performing Student to appoint as Batch Monitor.');
        return;
      }

      let resolvedName = userName;
      let existingRecordBatch = '';
      let resolvedRole = '';
      let resolvedEmail = '-';
      let resolvedMobile = '-';
      if (portalState.adminData && Array.isArray(portalState.adminData.users)) {
        const uObj = portalState.adminData.users.find(u => String(u.UserID || u.userId) === String(userId));
        if (uObj) {
          if (!resolvedName) resolvedName = uObj.Name || uObj.name || String(userId);
          existingRecordBatch = uObj.Batch || uObj.batch || '';
          resolvedRole = String(uObj.Role || uObj.role || '');
          resolvedEmail = String(uObj.Email || uObj.email || '-');
          resolvedMobile = String(uObj.Mobile || uObj.mobile || '-');
        }
      }
      if (!resolvedName) resolvedName = String(userId);

      const typeSel = document.getElementById('admin-appoint-monitor-type-select') || document.getElementById('admin-appoint-monitor-role-type');
      const finalMonitorType = monitorType || (typeSel ? typeSel.value : '') ||
        (/admin|teacher|instructor|faculty/i.test(resolvedRole) ? 'Batch Instructor Monitor' : 'Top-Performing Student Monitor');

      // Ensure the appointed monitor is also a member of that batch
      const curBatches = getUserAssignedBatchesList(userId, existingRecordBatch);
      if (!curBatches.includes(batchName)) {
        await saveUserMultipleBatches(userId, [...curBatches, batchName], resolvedName);
      }

      const map = getBatchMonitorsMap();
      map[batchName] = {
        userId: String(userId),
        userName: resolvedName,
        email: resolvedEmail,
        mobile: resolvedMobile,
        monitorType: finalMonitorType,
        designation: finalMonitorType,
        appointedAt: new Date().toISOString(),
        appointedBy: portalState.currentUser ? (portalState.currentUser.name || portalState.currentUser.userId) : 'Admin'
      };
      saveBatchMonitorsMap(map);

      populateAllBatchSelectDropdowns();
      renderAdminUsers();
      renderDailyPracticeGoalUI();
      if (typeof renderDashboardBatchMonitoringHub === 'function') renderDashboardBatchMonitoringHub();
      if (typeof renderHelpAdminContacts === 'function') renderHelpAdminContacts(false);
      logPortalAction('APPOINT_BATCH_MONITOR', `Appointed ${resolvedName} (${userId}) as ${finalMonitorType} for "${batchName}"`);
      apiCall('appointBatchMonitor', { targetUserId: userId, userName: resolvedName, batchName: batchName, monitorType: finalMonitorType, designation: finalMonitorType, isMonitor: true }, true);
      showToast(`🎖️ Appointed ${resolvedName} (${finalMonitorType}) for "${batchName}"!`);
    }

export async function removeBatchMonitorAppointment(batchName, skipConfirm = false) {
      if (!batchName) return;
      if (!skipConfirm && typeof window.rpConfirmDelete === 'function') {
        window.rpConfirmDelete('Remove Batch Monitor?', `Remove the appointed Batch Monitor from "${batchName}"?`, () => removeBatchMonitorAppointment(batchName, true));
        return;
      }
      const map = getBatchMonitorsMap();
      const prevEntry = map[batchName];
      if (!prevEntry) return;
      delete map[batchName];
      saveBatchMonitorsMap(map);

      populateAllBatchSelectDropdowns();
      renderAdminUsers();
      renderDailyPracticeGoalUI();
      if (typeof renderDashboardBatchMonitoringHub === 'function') renderDashboardBatchMonitoringHub();
      logPortalAction('REMOVE_BATCH_MONITOR', `Removed Batch Monitor (${prevEntry.userName || prevEntry.userId}) from "${batchName}"`);
      apiCall('appointBatchMonitor', { targetUserId: prevEntry.userId || '', userName: prevEntry.userName || '', batchName: batchName, isMonitor: false }, true);
      showToast(`🗑️ Removed Batch Monitor appointment for "${batchName}".`);
    }

export async function toggleUserBatchMonitor(userId, batchName, userName = '') {
      if (!userId || !batchName) return;
      if (isUserMonitorForBatch(userId, batchName)) {
        await removeBatchMonitorAppointment(batchName);
      } else {
        await appointBatchMonitor(batchName, userId, userName);
      }
    }

export async function appointMonitorFromToolbar() {
      const userSel = document.getElementById('admin-appoint-monitor-user-select');
      const batchSel = document.getElementById('admin-appoint-monitor-batch-select');
      const typeSel = document.getElementById('admin-appoint-monitor-type-select') || document.getElementById('admin-appoint-monitor-role-type');
      const userId = userSel ? userSel.value : '';
      const batchName = batchSel ? batchSel.value : '';
      const monitorType = typeSel ? typeSel.value : 'Top-Performing Student Monitor';
      if (!userId) {
        showToast('⚠️ Please select an Instructor or Top-Performing Student from the dropdown first.');
        return;
      }
      if (!batchName) {
        showToast('⚠️ Please select a Batch for this Monitor.');
        return;
      }
      const selectedOption = userSel.options[userSel.selectedIndex];
      const userName = selectedOption ? (selectedOption.getAttribute('data-uname') || '') : '';
      await appointBatchMonitor(batchName, userId, userName, monitorType);
      if (userSel) userSel.value = '';
    }

export async function autoAssignTopPerformerAsBatchMonitor() {
      const batchSel = document.getElementById('admin-appoint-monitor-batch-select');
      const batchName = batchSel && batchSel.value ? batchSel.value : (getInstituteBatchesList()[0] || '');
      if (!batchName) {
        showToast('⚠️ Please select a target Batch first to auto-pick its top-performing student.');
        return;
      }
      const users = (portalState.adminData && Array.isArray(portalState.adminData.users)) ? portalState.adminData.users : [];
      const allHist = (portalState.adminData && Array.isArray(portalState.adminData.results))
        ? portalState.adminData.results
        : ((portalState.globalData && Array.isArray(portalState.globalData.history)) ? portalState.globalData.history : (portalState.allTestHistoryList || []));

      const batchStudents = users.filter(u => {
        const uid = String(u.UserID || u.userId || '');
        const bList = getUserAssignedBatchesList(uid, u.Batch || u.batch || '');
        return bList.includes(batchName);
      });
      const candidatePool = batchStudents.length > 0 ? batchStudents : users;
      if (candidatePool.length === 0) {
        showToast('⚠️ No students found to evaluate for top performer.');
        return;
      }

      let bestUser = null;
      let bestScore = -1;
      candidatePool.forEach(u => {
        const uid = String(u.UserID || u.userId || '').trim();
        const uTests = allHist.filter(h => String(h.UserID || h.userId || '').trim() === uid);
        const avgWpm = uTests.length > 0
          ? (uTests.reduce((acc, r) => acc + (parseFloat(r.WPM || r.wpm || r.NetSpeed || r.netSpeed) || 0), 0) / uTests.length)
          : 0;
        const avgAcc = uTests.length > 0
          ? (uTests.reduce((acc, r) => acc + (parseFloat(r.Accuracy || r.accuracy || r.AccuracyPercentage) || 0), 0) / uTests.length)
          : 0;
        const composite = (avgWpm * 1.2) + avgAcc + Math.min(25, uTests.length * 2);
        if (composite > bestScore) {
          bestScore = composite;
          bestUser = u;
        }
      });

      if (!bestUser) {
        showToast('⚠️ Could not determine top student for this batch.');
        return;
      }
      const bestUid = String(bestUser.UserID || bestUser.userId || '');
      const bestName = String(bestUser.Name || bestUser.name || bestUid);
      const typeSel = document.getElementById('admin-appoint-monitor-type-select') || document.getElementById('admin-appoint-monitor-role-type');
      if (typeSel) typeSel.value = 'Top-Performing Student Monitor';
      await appointBatchMonitor(batchName, bestUid, bestName, 'Top-Performing Student Monitor');
    }

export const BATCH_GROUP_MESSAGES_STORAGE_KEY = 'rp_skill_batch_group_messages_v1';

export const batchDiscussionRealtimeChannel = (typeof BroadcastChannel !== 'undefined')
      ? new BroadcastChannel('rp_skill_batch_discussion_channel')
      : null;

window.currentDashboardMonitoredBatch = '';

window.currentBatchMonitoringHubTab = 'progress';

window.currentBatchCommsChannel = 'directives';

window._activeAdminBatchDiscussionCategory = 'ALL';

export function normalizeBatchMessageItem(raw, fallbackBatch = 'RP-Trail') {
      if (!raw || typeof raw !== 'object') return null;
      const id = String(raw.id || raw.messageId || raw.msgId || ('bmsg_' + Date.now()));
      if (/^(bmsg_seed|seed_|sample_|demo_)/i.test(id)) return null;
      const rawBatch = String(raw.batchName || fallbackBatch || 'RP-Trail').trim();
      const batchName = (rawBatch.toLowerCase() === 'general batch' || rawBatch.toLowerCase() === 'free tier') ? 'RP-Trail' : rawBatch;
      const authorId = String(raw.authorId || raw.senderId || raw.userId || 'ADMIN').trim();
      const authorName = String(raw.authorName || raw.senderName || raw.userName || authorId).trim();
      const authorRole = String(raw.authorRole || raw.senderRole || 'Instructor / Admin').trim();
      const tag = String(raw.tag || raw.msgType || 'announcement').toLowerCase().trim();
      const visibility = String(raw.visibility || (tag === 'private_query' || tag === 'chat' ? 'private_monitor' : 'directive')).toLowerCase().trim();
      const pinned = Boolean(raw.pinned !== undefined ? raw.pinned : raw.isPinned);
      const message = String(raw.message || raw.messageText || '').trim();
      if (!message) return null;
      return {
        id,
        batchName,
        authorId,
        authorName,
        authorRole,
        visibility,
        recipientMonitorId: String(raw.recipientMonitorId || '').trim(),
        recipientMonitorName: String(raw.recipientMonitorName || 'Appointed Batch Monitor').trim(),
        studentUserId: String(raw.studentUserId || authorId).trim(),
        studentUserName: String(raw.studentUserName || authorName).trim(),
        status: String(raw.status || (visibility === 'private_monitor' ? 'open' : 'published')).toLowerCase(),
        replies: Array.isArray(raw.replies) ? raw.replies : [],
        isMonitorPost: Boolean(raw.isMonitorPost || /Admin|Superadmin|Instructor|Monitor|Mentor/i.test(authorRole)),
        tag: visibility === 'private_monitor' ? 'private_query' : tag,
        pinned: visibility === 'private_monitor' ? false : pinned,
        message,
        targetWpm: String(raw.targetWpm || '').trim(),
        targetAcc: String(raw.targetAcc || '').trim(),
        targetDeadline: String(raw.targetDeadline || '').trim(),
        timestamp: raw.timestamp || raw.createdAt || new Date().toISOString(),
        updatedAt: raw.updatedAt || raw.timestamp || new Date().toISOString()
      };
    }

export function convertRawSourceToBatchMessagesMap(source) {
      const out = {};
      if (!source) return out;
      if (Array.isArray(source)) {
        source.forEach(item => {
          const norm = normalizeBatchMessageItem(item, item && item.batchName ? item.batchName : 'RP-Trail');
          if (!norm) return;
          if (!Array.isArray(out[norm.batchName])) out[norm.batchName] = [];
          out[norm.batchName].push(norm);
        });
      } else if (typeof source === 'object') {
        Object.keys(source).forEach(bKey => {
          const arr = source[bKey];
          if (Array.isArray(arr)) {
            out[bKey] = arr.map(it => normalizeBatchMessageItem(it, bKey)).filter(Boolean);
          }
        });
      }
      return out;
    }

export function getBatchGroupMessagesMap() {
      let localMap = {};
      try {
        const raw = localStorage.getItem(BATCH_GROUP_MESSAGES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          localMap = convertRawSourceToBatchMessagesMap(parsed);
        }
      } catch (e) {}
      const serverGlobal = convertRawSourceToBatchMessagesMap(portalState.globalData && portalState.globalData.batchGroupMessages);
      const serverAdmin = convertRawSourceToBatchMessagesMap(portalState.adminData && portalState.adminData.batchGroupMessages);
      const merged = {};
      const allKeys = new Set([
        ...getInstituteBatchesList(),
        ...Object.keys(serverGlobal),
        ...Object.keys(serverAdmin),
        ...Object.keys(localMap)
      ]);
      allKeys.forEach(batchName => {
        const listA = Array.isArray(serverGlobal[batchName]) ? serverGlobal[batchName] : [];
        const listB = Array.isArray(serverAdmin[batchName]) ? serverAdmin[batchName] : [];
        const listC = Array.isArray(localMap[batchName]) ? localMap[batchName] : [];
        const byId = new Map();
        [...listA, ...listB, ...listC].forEach(msg => {
          if (msg && msg.id) {
            const existing = byId.get(String(msg.id));
            if (!existing || ((msg.replies && msg.replies.length) >= ((existing.replies && existing.replies.length) || 0))) {
              byId.set(String(msg.id), msg);
            }
          }
        });
        merged[batchName] = Array.from(byId.values()).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      });
      return merged;
    }

export function saveBatchGroupMessagesMap(mapObj, broadcastRealtime = true) {
      try {
        localStorage.setItem(BATCH_GROUP_MESSAGES_STORAGE_KEY, JSON.stringify(mapObj || {}));
      } catch (e) {}
      if (portalState.globalData && typeof portalState.globalData === 'object') portalState.globalData.batchGroupMessages = mapObj || {};
      if (portalState.adminData && typeof portalState.adminData === 'object') portalState.adminData.batchGroupMessages = mapObj || {};
      if (broadcastRealtime && batchDiscussionRealtimeChannel) {
        try {
          batchDiscussionRealtimeChannel.postMessage({
            type: 'BATCH_DISCUSSION_SYNC',
            timestamp: Date.now()
          });
        } catch (e) {}
      }
    }

if (batchDiscussionRealtimeChannel) {
      batchDiscussionRealtimeChannel.onmessage = (ev) => {
        if (ev && ev.data && ev.data.type === 'BATCH_DISCUSSION_SYNC') {
          if (typeof renderDashboardBatchMonitoringHub === 'function') renderDashboardBatchMonitoringHub();
          if (typeof renderAdminBatchDiscussionBoard === 'function') renderAdminBatchDiscussionBoard();
          if (ev.data.toastText) showToast(ev.data.toastText);
        }
      };
    }

window.addEventListener('storage', (ev) => {
      if (ev && ev.key === BATCH_GROUP_MESSAGES_STORAGE_KEY) {
        if (typeof renderDashboardBatchMonitoringHub === 'function') renderDashboardBatchMonitoringHub();
        if (typeof renderAdminBatchDiscussionBoard === 'function') renderAdminBatchDiscussionBoard();
      }
    });

export async function pollRealtimeBatchDiscussionMessages(manualSync = false) {
      if (!portalState.currentUser || document.hidden) return;
      const res = await apiCall('getBatchGroupMessages', { userId: portalState.currentUser.userId }, true);
      if (res && res.success) {
        if (res.batchMonitorsMap && typeof res.batchMonitorsMap === 'object') {
          saveBatchMonitorsMap({ ...getBatchMonitorsMap(), ...res.batchMonitorsMap });
        }
        if (Array.isArray(res.batchGroupMessages)) {
          const incomingMap = convertRawSourceToBatchMessagesMap(res.batchGroupMessages);
          const curMap = getBatchGroupMessagesMap();
          Object.keys(incomingMap).forEach(bKey => {
            const byId = new Map();
            [...(curMap[bKey] || []), ...(incomingMap[bKey] || [])].forEach(m => {
              if (m && m.id) byId.set(String(m.id), m);
            });
            curMap[bKey] = Array.from(byId.values()).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
          });
          saveBatchGroupMessagesMap(curMap, false);
        }
        renderDashboardBatchMonitoringHub();
        if (portalState.activeTab === 'admin' && typeof renderAdminBatchDiscussionBoard === 'function') {
          renderAdminBatchDiscussionBoard();
        }
        if (manualSync) {
          showToast('🟢 Real-Time Batch Feed & Monitor Queries synced with Google Sheets!');
        }
      }
    }

if (window._batchCommsRealtimePollId) clearInterval(window._batchCommsRealtimePollId);

window._batchCommsRealtimePollId = setInterval(() => {
      if (portalState.currentUser && !document.hidden && (portalState.activeTab === 'dashboard' || portalState.activeTab === 'admin')) {
        pollRealtimeBatchDiscussionMessages(false);
      }
    }, 10000);

export function switchDashboardMonitoredBatch(batchName) {
      window.currentDashboardMonitoredBatch = String(batchName || '').trim();
      renderDashboardBatchMonitoringHub();
    }

export function switchBatchMonitoringHubTab(tabName) {
      window.currentBatchMonitoringHubTab = tabName === 'comms' ? 'comms' : 'progress';
      const progPane = document.getElementById('batch-monitoring-pane-progress');
      const commsPane = document.getElementById('batch-monitoring-pane-comms');
      const progBtn = document.getElementById('btn-batch-hub-tab-progress');
      const commsBtn = document.getElementById('btn-batch-hub-tab-comms');
      if (progPane) progPane.style.display = window.currentBatchMonitoringHubTab === 'progress' ? 'block' : 'none';
      if (commsPane) commsPane.style.display = window.currentBatchMonitoringHubTab === 'comms' ? 'block' : 'none';
      if (progBtn) {
        progBtn.style.background = window.currentBatchMonitoringHubTab === 'progress' ? '#b45309' : 'var(--surface)';
        progBtn.style.color = window.currentBatchMonitoringHubTab === 'progress' ? '#fff' : '#92400e';
      }
      if (commsBtn) {
        commsBtn.style.background = window.currentBatchMonitoringHubTab === 'comms' ? '#b45309' : 'var(--surface)';
        commsBtn.style.color = window.currentBatchMonitoringHubTab === 'comms' ? '#fff' : '#92400e';
      }
      if (window.currentBatchMonitoringHubTab === 'comms') {
        renderDashboardBatchMonitoringHub();
      }
    }

export function switchBatchCommsChannel(channelName) {
      window.currentBatchCommsChannel = channelName === 'private_queries' ? 'private_queries' : 'directives';
      renderDashboardBatchMonitoringHub();
    }

export function formatBatchDiscussionTargetPillsHtml(m) {
      if (!m) return '';
      const pills = [];
      if (m.targetWpm && m.targetWpm !== '-') {
        pills.push(`<span style="display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:999px; background:rgba(37,99,235,0.12); color:#1d4ed8; border:1px solid rgba(37,99,235,0.3);"><i class="fa-solid fa-gauge-high"></i> Target Speed: ${String(m.targetWpm).replace(/</g, '&lt;')}</span>`);
      }
      if (m.targetAcc && m.targetAcc !== '-') {
        pills.push(`<span style="display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:999px; background:rgba(16,185,129,0.12); color:#047857; border:1px solid rgba(16,185,129,0.3);"><i class="fa-solid fa-bullseye"></i> Min Accuracy: ${String(m.targetAcc).replace(/</g, '&lt;')}</span>`);
      }
      if (m.targetDeadline && m.targetDeadline !== '-') {
        pills.push(`<span style="display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:999px; background:rgba(245,158,11,0.15); color:#b45309; border:1px solid rgba(245,158,11,0.35);"><i class="fa-regular fa-clock"></i> Deadline: ${String(m.targetDeadline).replace(/</g, '&lt;')}</span>`);
      }
      if (pills.length === 0) return '';
      return `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:5px;">${pills.join('')}</div>`;
    }

export function renderPrivateQueryRepliesHtml(m, activeBatch, canReply) {
      const replies = Array.isArray(m.replies) ? m.replies : [];
      const safeMsgId = String(m.id || '').replace(/'/g, "\\'");
      const safeBatch = String(activeBatch || m.batchName || 'General Batch').replace(/'/g, "\\'");
      const statusVal = String(m.status || 'open').toLowerCase();
      const isResolved = statusVal === 'resolved';

      const repliesListHtml = replies.length > 0
        ? `<div style="margin-top: 8px; padding-left: 10px; border-left: 2.5px solid #8b5cf6; display: flex; flex-direction: column; gap: 6px;">
            ${replies.map(r => {
              const rTime = r.timestamp ? new Date(r.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
              const isMentorReply = /Monitor|Instructor|Admin|Superadmin/i.test(String(r.authorRole || ''));
              return `<div style="padding: 6px 10px; border-radius: 8px; background: ${isMentorReply ? 'rgba(124,58,237,0.09)' : 'var(--surface)'}; border: 1px solid ${isMentorReply ? 'rgba(124,58,237,0.28)' : 'var(--border)'}; font-size: 11.5px;">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 2px;">
                  <strong style="color: ${isMentorReply ? '#6d28d9' : 'var(--secondary)'};">${String(r.authorName || 'Batch Monitor').replace(/</g, '&lt;')}</strong>
                  <span style="font-size: 9.5px; font-weight: 800; padding: 1px 6px; border-radius: 999px; background: ${isMentorReply ? '#ede9fe' : '#f1f5f9'}; color: ${isMentorReply ? '#6d28d9' : '#475569'};">${String(r.authorRole || 'Monitor').replace(/</g, '&lt;')}</span>
                  <span style="font-size: 9.5px; color: var(--text-muted); margin-left: auto;">${rTime}</span>
                </div>
                <div style="color: var(--text-main); line-height: 1.4;">${String(r.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              </div>`;
            }).join('')}
          </div>`
        : '';

      const replyBoxHtml = canReply
        ? `<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; align-items: center;">
            <input type="text" id="reply-input-${safeMsgId}" class="form-control" placeholder="Write a real-time reply in this private query thread..." style="flex: 1; min-width: 180px; font-size: 11.5px; padding: 5px 10px; min-height: 30px;" onkeydown="if(event.key==='Enter'){ event.preventDefault(); replyToBatchMonitorPrivateQuery('${safeMsgId}', '${safeBatch}'); }">
            <button type="button" class="btn btn-primary btn-sm" style="padding: 5px 11px; font-size: 11px; background: #7c3aed; border: none;" onclick="replyToBatchMonitorPrivateQuery('${safeMsgId}', '${safeBatch}')">
              <i class="fa-solid fa-reply"></i> Reply
            </button>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 5px 9px; font-size: 10.5px; font-weight: 800; color: ${isResolved ? '#d97706' : '#059669'};" onclick="resolveBatchMonitorPrivateQuery('${safeMsgId}', '${safeBatch}', '${isResolved ? 'open' : 'resolved'}')">
              <i class="fa-solid ${isResolved ? 'fa-rotate-left' : 'fa-circle-check'}"></i> ${isResolved ? 'Reopen' : 'Mark Resolved'}
            </button>
          </div>`
        : '';

      return repliesListHtml + replyBoxHtml;
    }

export async function replyToBatchMonitorPrivateQuery(messageId, batchName) {
      if (!portalState.currentUser || !messageId) return;
      const inp = document.getElementById(`reply-input-${messageId}`) || document.getElementById(`admin-reply-input-${messageId}`);
      const text = inp ? inp.value.trim() : '';
      if (!text) {
        showToast('⚠️ Please enter a reply message.');
        if (inp) inp.focus();
        return;
      }

      const uid = String(portalState.currentUser.userId || '').trim();
      const roleLower = String(portalState.currentUser.role || '').toLowerCase();
      const isAdminUser = ['admin', 'superadmin', 'instructor'].includes(roleLower);
      const isMonitor = isUserMonitorForBatch(uid, batchName);
      const replierRole = isAdminUser
        ? (roleLower === 'superadmin' ? 'Chief Instructor / Superadmin' : 'Batch Instructor / Admin')
        : (isMonitor ? `Appointed Batch Monitor (${batchName})` : 'Student');

      const allMsgsMap = getBatchGroupMessagesMap();
      const list = Array.isArray(allMsgsMap[batchName]) ? allMsgsMap[batchName] : [];
      const targetMsg = list.find(m => String(m.id) === String(messageId));
      const nowIso = new Date().toISOString();
      if (targetMsg) {
        if (!Array.isArray(targetMsg.replies)) targetMsg.replies = [];
        targetMsg.replies.push({
          replyId: 'RPL-' + Date.now(),
          authorId: uid,
          authorName: portalState.currentUser.name || uid,
          authorRole: replierRole,
          message: text,
          timestamp: nowIso
        });
        targetMsg.status = (isAdminUser || isMonitor) ? 'replied' : 'open';
        targetMsg.updatedAt = nowIso;
        saveBatchGroupMessagesMap(allMsgsMap, true);
      }

      if (inp) inp.value = '';
      renderDashboardBatchMonitoringHub();
      if (typeof renderAdminBatchDiscussionBoard === 'function') renderAdminBatchDiscussionBoard();

      await apiCall('replyBatchGroupMessage', {
        messageId,
        batchName,
        replyText: text,
        replierId: uid,
        replierName: portalState.currentUser.name || uid,
        replierRole,
        status: (isAdminUser || isMonitor) ? 'replied' : 'open'
      }, true);
      showToast('💬 Real-time reply sent!');
    }

export async function resolveBatchMonitorPrivateQuery(messageId, batchName, nextStatus = 'resolved') {
      if (!portalState.currentUser || !messageId) return;
      const allMsgsMap = getBatchGroupMessagesMap();
      const list = Array.isArray(allMsgsMap[batchName]) ? allMsgsMap[batchName] : [];
      const targetMsg = list.find(m => String(m.id) === String(messageId));
      if (targetMsg) {
        targetMsg.status = nextStatus;
        saveBatchGroupMessagesMap(allMsgsMap, true);
      }
      renderDashboardBatchMonitoringHub();
      if (typeof renderAdminBatchDiscussionBoard === 'function') renderAdminBatchDiscussionBoard();
      await apiCall('replyBatchGroupMessage', {
        messageId,
        batchName,
        status: nextStatus,
        replierId: portalState.currentUser.userId || '',
        replierName: portalState.currentUser.name || 'Batch Monitor'
      }, true);
      showToast(nextStatus === 'resolved' ? '✅ Query marked as Resolved!' : '🔄 Query reopened.');
    }

export function renderDashboardBatchMonitoringHub() {
      const card = document.getElementById('dashboard-batch-monitoring-card');
      if (!card || !portalState.currentUser) return;

      const uid = String(portalState.currentUser.userId || '').trim();
      const roleLower = String(portalState.currentUser.role || '').toLowerCase();
      const isAdminUser = ['admin', 'superadmin', 'instructor'].includes(roleLower);
      const monitorBatches = getUserMonitorBatchesList(uid);
      const userMemberBatches = getUserAssignedBatchesList(uid, portalState.currentUser.batch || '');
      const allInstituteBatches = getInstituteBatchesList();

      const accessibleBatches = isAdminUser
        ? allInstituteBatches
        : Array.from(new Set([...monitorBatches, ...userMemberBatches])).filter(Boolean);

      if (accessibleBatches.length === 0) {
        const isInBatchHub = document.getElementById('view-batchhub') && document.getElementById('view-batchhub').style.display !== 'none';
        if (isInBatchHub) {
          card.style.display = 'block';
          const rolePillEl = document.getElementById('dashboard-batch-monitor-role-pill');
          const subTextEl = document.getElementById('dashboard-batch-monitor-subtext');
          const tbodyEl = document.getElementById('batch-monitoring-student-progress-tbody');
          const feedEl = document.getElementById('batch-monitoring-comms-feed');
          const kpiEl = document.getElementById('dashboard-batch-monitor-kpi-strip');
          if (rolePillEl) rolePillEl.innerText = isAdminUser ? '🛡️ NO BATCHES CREATED YET' : '🎓 NO BATCH ASSIGNED YET';
          if (subTextEl) {
            subTextEl.innerHTML = isAdminUser
              ? 'Create your first institute batch under <strong>Admin &rarr; Users &amp; Batches</strong> to activate batch monitoring, progress oversight, and direct announcements.'
              : 'You are not assigned to an active batch yet. Contact your Admin or visit <strong>Profile &rarr; Buy Batches</strong> to join a batch.';
          }
          if (kpiEl) kpiEl.innerHTML = '';
          if (tbodyEl) {
            tbodyEl.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:22px; color:var(--text-muted); font-size:12.5px;">No batch members to display yet. Once a batch is created and students are assigned, live WPM &amp; accuracy oversight appears here automatically.</td></tr>`;
          }
          if (feedEl) {
            feedEl.innerHTML = `<div style="text-align:center; padding:18px; color:var(--text-muted); font-size:12.5px; border:1px dashed var(--border); border-radius:10px;">No batch directives or queries yet.</div>`;
          }
        } else {
          card.style.display = 'none';
        }
        return;
      }

      card.style.display = 'block';
      if (!window.currentDashboardMonitoredBatch || !accessibleBatches.includes(window.currentDashboardMonitoredBatch)) {
        window.currentDashboardMonitoredBatch = monitorBatches[0] || accessibleBatches[0];
      }
      const activeBatch = window.currentDashboardMonitoredBatch;
      const isMonitorForActiveBatch = isAdminUser || isUserMonitorForBatch(uid, activeBatch);
      const activeChannel = window.currentBatchCommsChannel === 'private_queries' ? 'private_queries' : 'directives';

      const batchSel = document.getElementById('dashboard-batch-monitor-select');
      if (batchSel) {
        const monitorsMap = getBatchMonitorsMap();
        batchSel.innerHTML = accessibleBatches.map(b => {
          const m = monitorsMap[b];
          const mTag = m ? ` (Monitor: ${m.userName || m.userId})` : '';
          return `<option value="${b.replace(/"/g, '&quot;')}" ${b === activeBatch ? 'selected' : ''}>${b}${mTag}</option>`;
        }).join('');
      }

      const monitorsMap = getBatchMonitorsMap();
      const monitorEntry = monitorsMap[activeBatch];
      const monitorDisplayName = (monitorEntry && (monitorEntry.userName || monitorEntry.userId)) ? (monitorEntry.userName || monitorEntry.userId) : 'Appointed Batch Monitor';
      const rolePill = document.getElementById('dashboard-batch-monitor-role-pill');
      const subText = document.getElementById('dashboard-batch-monitor-subtext');
      const tagSelect = document.getElementById('batch-comms-msg-tag');

      if (rolePill) {
        if (isAdminUser) {
          rolePill.innerText = roleLower === 'superadmin' ? '👑 SUPERADMIN OVERSEER' : '🛡️ INSTRUCTOR / ADMIN OVERSEER';
        } else if (isUserMonitorForBatch(uid, activeBatch)) {
          rolePill.innerText = `🎖️ ${(monitorEntry && monitorEntry.monitorType) ? monitorEntry.monitorType.toUpperCase() : 'BATCH MONITOR'} (${activeBatch})`;
        } else {
          rolePill.innerText = '🎓 STUDENT VIEW • INSTRUCTOR FEED & PRIVATE MONITOR DESK';
        }
      }

      if (subText) {
        if (monitorEntry && (monitorEntry.userName || monitorEntry.userId)) {
          subText.innerHTML = `Active Batch: <strong>${activeBatch}</strong> • Appointed Batch Monitor: <strong>${monitorDisplayName}</strong> <span style="color:#b45309; font-weight:800;">(${monitorEntry.monitorType || 'Batch Monitor'})</span> • <span style="color:#0d9488; font-weight:800;">📢 Main Feed: Instructor Directives Only</span> • <span style="color:#7c3aed; font-weight:800;">🔒 Direct Queries: Student ↔ Batch Monitor</span>`;
        } else {
          subText.innerHTML = `Active Batch: <strong>${activeBatch}</strong> • <em>No Batch Monitor appointed yet (Admin can appoint in Admin → Users)</em> • <span style="color:#7c3aed; font-weight:800;">🔒 Direct Queries routed to Batch Instructor/Monitor</span>`;
        }
      }

      // Update Channel Buttons UI
      const btnDir = document.getElementById('btn-batch-channel-directives');
      const btnPriv = document.getElementById('btn-batch-channel-private');
      if (btnDir) {
        btnDir.style.background = activeChannel === 'directives' ? '#0d9488' : 'var(--surface)';
        btnDir.style.color = activeChannel === 'directives' ? '#fff' : '#0f766e';
        btnDir.style.border = activeChannel === 'directives' ? 'none' : '1px solid rgba(13,148,136,0.35)';
      }
      if (btnPriv) {
        btnPriv.style.background = activeChannel === 'private_queries' ? '#7c3aed' : 'var(--surface)';
        btnPriv.style.color = activeChannel === 'private_queries' ? '#fff' : '#7c3aed';
        btnPriv.style.border = activeChannel === 'private_queries' ? 'none' : '1px solid rgba(124,58,237,0.35)';
      }

      const channelBanner = document.getElementById('batch-comms-channel-banner');
      const composerBox = document.getElementById('batch-comms-composer-box');
      const composerTitle = document.getElementById('batch-comms-composer-title');
      const msgInputEl = document.getElementById('batch-comms-msg-input');
      const sendBtn = document.getElementById('btn-batch-comms-send');
      const sendBtnLabel = document.getElementById('btn-batch-comms-send-label');

      if (activeChannel === 'directives') {
        if (channelBanner) {
          channelBanner.style.background = 'rgba(13,148,136,0.08)';
          channelBanner.style.borderColor = 'rgba(13,148,136,0.32)';
          channelBanner.innerHTML = isMonitorForActiveBatch
            ? `<i class="fa-solid fa-bullhorn" style="color:#0d9488;"></i> <strong>Main Announcement Feed (Instructor Directives Only):</strong> Publish official directives, daily WPM/Accuracy targets, and homework for <strong>${activeBatch}</strong>.`
            : `<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <span><i class="fa-solid fa-bullhorn" style="color:#0d9488;"></i> <strong>Main Announcement Feed is strictly for Instructor Directives only.</strong> Have a question or doubt for your Batch Monitor (<strong>${monitorDisplayName}</strong>)?</span>
                <button type="button" class="btn btn-sm" style="background:#7c3aed; color:#fff; font-size:11px; font-weight:800; padding:4px 10px; border:none; border-radius:7px;" onclick="switchBatchCommsChannel('private_queries')">
                  <i class="fa-solid fa-paper-plane"></i> Send Private Query to Batch Monitor
                </button>
              </div>`;
        }
        // Only Instructors / Admins / Appointed Monitor can post to Main Announcement Feed
        if (composerBox) {
          composerBox.style.display = isMonitorForActiveBatch ? 'flex' : 'none';
        }
        if (tagSelect) {
          tagSelect.style.display = isMonitorForActiveBatch ? 'inline-block' : 'none';
          tagSelect.disabled = !isMonitorForActiveBatch;
        }
        if (composerTitle) {
          composerTitle.innerHTML = `<i class="fa-solid fa-bullhorn" style="color:#0d9488;"></i> Post Official Directive or Study Target to Main Announcement Feed (${activeBatch})`;
        }
        if (msgInputEl) {
          msgInputEl.disabled = !isMonitorForActiveBatch;
          msgInputEl.placeholder = `📢 Publish an official directive, daily WPM target, or practice assignment for ${activeBatch}...`;
        }
        if (sendBtn) sendBtn.style.background = 'linear-gradient(135deg, #0d9488, #0f766e)';
        if (sendBtnLabel) sendBtnLabel.innerText = 'Publish Directive';
      } else {
        // Private Queries to Appointed Batch Monitor Channel
        if (channelBanner) {
          channelBanner.style.background = 'rgba(124,58,237,0.08)';
          channelBanner.style.borderColor = 'rgba(124,58,237,0.32)';
          channelBanner.innerHTML = isMonitorForActiveBatch
            ? `<i class="fa-solid fa-user-shield" style="color:#7c3aed;"></i> <strong>Real-Time Student Private Queries Desk (${activeBatch}):</strong> View and reply directly to private queries sent by students in your batch. Only the student who sent the query and you (Monitor / Instructor) can view each thread.`
            : `<i class="fa-solid fa-lock" style="color:#7c3aed;"></i> <strong>Private Query to Appointed Batch Monitor (${monitorDisplayName}):</strong> Your message is private between you and your Batch Monitor / Instructor and will not clutter the Main Announcement Feed.`;
        }
        if (composerBox) {
          composerBox.style.display = 'flex';
        }
        if (tagSelect) {
          tagSelect.style.display = 'none';
        }
        if (composerTitle) {
          composerTitle.innerHTML = isMonitorForActiveBatch
            ? `<i class="fa-solid fa-user-shield" style="color:#7c3aed;"></i> Start or Broadcast a Mentor Guidance Note in Private Query Desk (${activeBatch})`
            : `<i class="fa-solid fa-paper-plane" style="color:#7c3aed;"></i> Send a Real-Time Private Query Directly to Batch Monitor (${monitorDisplayName})`;
        }
        if (msgInputEl) {
          msgInputEl.disabled = false;
          msgInputEl.placeholder = isMonitorForActiveBatch
            ? `💬 Post a direct mentor guidance note or select a student's query below to reply...`
            : `🔒 Ask your appointed Batch Monitor (${monitorDisplayName}) a private question about dictation, strokes, or targets...`;
        }
        if (sendBtn) sendBtn.style.background = 'linear-gradient(135deg, #7c3aed, #6d28d9)';
        if (sendBtnLabel) sendBtnLabel.innerText = isMonitorForActiveBatch ? 'Post Guidance' : 'Send Private Query';
      }

      // Compute Student Roster & Progress for activeBatch
      const allUsersPool = (portalState.adminData && Array.isArray(portalState.adminData.users) && portalState.adminData.users.length > 0)
        ? portalState.adminData.users
        : ((portalState.globalData && Array.isArray(portalState.globalData.users) && portalState.globalData.users.length > 0)
          ? portalState.globalData.users
          : ((portalState.globalData && Array.isArray(portalState.globalData.batchStudentRoster) && portalState.globalData.batchStudentRoster.length > 0) ? portalState.globalData.batchStudentRoster : []));
      const allHistoryPool = (portalState.adminData && Array.isArray(portalState.adminData.results) && portalState.adminData.results.length > 0)
        ? portalState.adminData.results
        : ((portalState.globalData && Array.isArray(portalState.globalData.history) && portalState.globalData.history.length > 0) ? portalState.globalData.history : (portalState.allTestHistoryList || []));

      const rosterMap = new Map();
      allUsersPool.forEach(u => {
        const uIdStr = String(u.UserID || u.userId || '').trim();
        if (!uIdStr) return;
        const uBatches = getUserAssignedBatchesList(uIdStr, u.Batch || u.batch || '');
        if (uBatches.includes(activeBatch)) {
          rosterMap.set(uIdStr, {
            userId: uIdStr,
            name: String(u.Name || u.name || uIdStr),
            email: String(u.Email || u.email || ''),
            role: String(u.Role || u.role || 'Student'),
            emailVerified: Boolean(u.EmailVerified === true || u.emailVerified === true || isUserEmailAlreadyVerified(u))
          });
        }
      });

      if (userMemberBatches.includes(activeBatch) && !rosterMap.has(uid)) {
        rosterMap.set(uid, {
          userId: uid,
          name: portalState.currentUser.name || uid,
          email: portalState.currentUser.email || '',
          role: portalState.currentUser.role || 'Student',
          emailVerified: isUserEmailAlreadyVerified(portalState.currentUser)
        });
      }
      if (monitorEntry && monitorEntry.userId && !rosterMap.has(String(monitorEntry.userId))) {
        rosterMap.set(String(monitorEntry.userId), {
          userId: String(monitorEntry.userId),
          name: monitorEntry.userName || String(monitorEntry.userId),
          email: monitorEntry.email || '',
          role: monitorEntry.monitorType || 'Batch Monitor',
          emailVerified: true
        });
      }

      allHistoryPool.forEach(h => {
        const hUid = String(h.UserID || h.userId || '').trim();
        if (!hUid) return;
        const hBatches = getUserAssignedBatchesList(hUid, h.Batch || h.batch || '');
        if (hBatches.includes(activeBatch) && !rosterMap.has(hUid)) {
          rosterMap.set(hUid, {
            userId: hUid,
            name: String(h.UserName || h.Name || h.userName || hUid),
            email: '',
            role: 'Student',
            emailVerified: isUserEmailAlreadyVerified({ userId: hUid })
          });
        }
      });

      // No demo peers injected initially — only real registered users in the batch are shown.

      // Separate Main Announcement Feed (Instructor Directives Only) vs Private Student Queries to Batch Monitor
      const allMsgsMap = getBatchGroupMessagesMap();
      const batchMsgs = Array.isArray(allMsgsMap[activeBatch]) ? allMsgsMap[activeBatch] : [];

      const directiveMsgs = batchMsgs.filter(m => m.visibility !== 'private_monitor' && m.tag !== 'private_query').sort((a, b) => {
        if (Boolean(b.pinned) !== Boolean(a.pinned)) return b.pinned ? 1 : -1;
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });

      const allBatchPrivateQueries = batchMsgs.filter(m => m.visibility === 'private_monitor' || m.tag === 'private_query');

      const visiblePrivateQueries = allBatchPrivateQueries.filter(m => {
        if (isMonitorForActiveBatch) return true; // Appointed Batch Monitor & Instructor see all private queries in their batch
        return String(m.studentUserId || m.authorId || '') === uid; // Students see only their own private queries
      }).sort((a, b) => new Date(b.updatedAt || b.timestamp || 0) - new Date(a.updatedAt || a.timestamp || 0));

      const privCountBadge = document.getElementById('batch-private-queries-count-badge');
      if (privCountBadge) {
        privCountBadge.innerText = String(visiblePrivateQueries.length);
      }

      // 👉 Requirement #1: Dedicated Telemetry Strip in 'Batch Monitoring Hub'
      // Displays 'Active Resolution Rate', 'Total Queries Handled', and 'Average Response Time'
      const monitorEffStrip = document.getElementById('batch-monitor-effectiveness-kpi-strip');
      if (monitorEffStrip) {
        const rawTotalQueries = allBatchPrivateQueries.length;
        const rawHandledQueries = allBatchPrivateQueries.filter(q => {
          const st = String(q.status || '').toLowerCase();
          return st === 'resolved' || st === 'replied' || (Array.isArray(q.replies) && q.replies.length > 0);
        }).length;
        const totalQueriesCount = rawTotalQueries > 0 ? rawTotalQueries : 0;
        const handledQueriesCount = rawTotalQueries > 0 ? rawHandledQueries : 0;
        const activeResolutionRate = totalQueriesCount > 0
          ? Math.round((handledQueriesCount / totalQueriesCount) * 100)
          : 0;

        let totalResponseMins = 0;
        let measuredThreads = 0;
        allBatchPrivateQueries.forEach(q => {
          const createdMs = new Date(q.timestamp || 0).getTime();
          if (!createdMs || isNaN(createdMs)) return;
          if (Array.isArray(q.replies) && q.replies.length > 0) {
            const firstReplyMs = new Date(q.replies[0].timestamp || q.updatedAt || 0).getTime();
            if (firstReplyMs && firstReplyMs >= createdMs) {
              totalResponseMins += Math.max(1, Math.round((firstReplyMs - createdMs) / 60000));
              measuredThreads++;
            }
          } else if (String(q.status || '').toLowerCase() === 'resolved' && q.updatedAt) {
            const updMs = new Date(q.updatedAt).getTime();
            if (updMs && updMs >= createdMs) {
              totalResponseMins += Math.max(1, Math.round((updMs - createdMs) / 60000));
              measuredThreads++;
            }
          }
        });
        const avgRespMins = measuredThreads > 0 ? Math.round(totalResponseMins / measuredThreads) : 0;
        const avgResponseTimeFormatted = avgRespMins >= 60
          ? `${Math.floor(avgRespMins / 60)}h ${avgRespMins % 60}m`
          : `${avgRespMins} mins`;

        monitorEffStrip.innerHTML = `
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div>
              <div style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Active Resolution Rate</div>
              <div style="font-size: 19px; font-weight: 900; color: #059669; margin-top: 2px;" class="mono-num">${activeResolutionRate}%</div>
              <div style="font-size: 11px; color: var(--text-muted);">Monitor: ${window.escapeHtml(monitorDisplayName)}</div>
            </div>
          </div>
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div>
              <div style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Queries Handled</div>
              <div style="font-size: 19px; font-weight: 900; color: #7c3aed; margin-top: 2px;" class="mono-num">${handledQueriesCount} <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">/ ${totalQueriesCount}</span></div>
              <div style="font-size: 11px; color: var(--text-muted);">${Math.max(0, totalQueriesCount - handledQueriesCount)} Open · ${handledQueriesCount} Resolved</div>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" style="font-size: 11px; padding: 4px 10px;" onclick="switchBatchMonitoringHubTab('comms'); switchBatchCommsChannel('private_queries');">
              View Desk
            </button>
          </div>
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div>
              <div style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Average Response Time</div>
              <div style="font-size: 19px; font-weight: 900; color: #2563eb; margin-top: 2px;" class="mono-num">${measuredThreads > 0 ? avgResponseTimeFormatted : '—'}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${measuredThreads > 0 ? (measuredThreads + ' measured thread(s)') : 'No replies yet'}</div>
            </div>
          </div>
        `;
      }

      // Deadline Window Evaluation ONLY when an actual batch target directive has been published (zero preloaded alerts)
      const latestTargetDirective = directiveMsgs.find(m => (m.targetWpm && m.targetWpm !== '-') || (m.targetAcc && m.targetAcc !== '-') || (m.targetDeadline && m.targetDeadline !== '-')) || null;
      const requiredTargetWpm = latestTargetDirective && parseFloat(latestTargetDirective.targetWpm) > 0
        ? parseFloat(latestTargetDirective.targetWpm)
        : 0;
      const requiredTargetAcc = latestTargetDirective && parseFloat(latestTargetDirective.targetAcc) > 0
        ? parseFloat(latestTargetDirective.targetAcc)
        : 0;
      const deadlineLabelStr = (latestTargetDirective && latestTargetDirective.targetDeadline && latestTargetDirective.targetDeadline !== '-')
        ? String(latestTargetDirective.targetDeadline)
        : '';

      const deadlineWindowInfo = deadlineLabelStr
        ? computeStudyTargetDeadlineWindowInfo(deadlineLabelStr)
        : { isWithin4Hours: false, remainingLabel: 'No Active Deadline' };

      const todayIso = new Date().toISOString().slice(0, 10);
      let activeTodayCount = 0;
      let batchWpmSum = 0;
      let batchAccSum = 0;
      let studentsWithTests = 0;

      const studentRows = Array.from(rosterMap.values()).map(stu => {
        const stuTests = allHistoryPool.filter(h => String(h.UserID || h.userId || '').trim() === stu.userId);
        const testsCount = stuTests.length;
        const avgWpm = stuTests.length > 0
          ? (stuTests.reduce((s, r) => s + (parseFloat(r.WPM || r.wpm || r.NetSpeed || r.netSpeed) || 0), 0) / stuTests.length)
          : 0;
        const bestWpm = stuTests.length > 0
          ? Math.max(...stuTests.map(r => parseFloat(r.WPM || r.wpm || r.NetSpeed || r.netSpeed) || 0))
          : 0;
        const avgAcc = stuTests.length > 0
          ? (stuTests.reduce((s, r) => s + (parseFloat(r.Accuracy || r.accuracy || r.AccuracyPercentage) || 0), 0) / stuTests.length)
          : 0;
        const todayTests = stuTests.filter(r => String(r.Timestamp || r.timestamp || r.Date || '').slice(0, 10) === todayIso);
        const practicedToday = todayTests.length > 0;
        const completedDailyTarget = !latestTargetDirective ? practicedToday : (practicedToday && todayTests.some(r => {
          const w = parseFloat(r.WPM || r.wpm || r.NetSpeed || r.netSpeed) || 0;
          const a = parseFloat(r.Accuracy || r.accuracy || r.AccuracyPercentage) || 0;
          if (requiredTargetWpm > 0 && w < requiredTargetWpm * 0.75) return false;
          if (requiredTargetAcc > 0 && a < requiredTargetAcc * 0.85) return false;
          return true;
        }));
        const alreadyNudgedToday = allBatchPrivateQueries.some(q =>
          String(q.studentUserId || '') === stu.userId &&
          String(q.timestamp || '').slice(0, 10) === todayIso &&
          /Auto-Nudge|Daily Study Target/i.test(String(q.message || ''))
        );
        if (practicedToday) activeTodayCount++;
        if (testsCount > 0) {
          studentsWithTests++;
          batchWpmSum += avgWpm;
          batchAccSum += avgAcc;
        }
        return {
          ...stu,
          testsCount,
          avgWpm: Number(avgWpm.toFixed(1)),
          bestWpm: Number(bestWpm.toFixed(1)),
          avgAcc: Number(avgAcc.toFixed(1)),
          practicedToday,
          completedDailyTarget,
          alreadyNudgedToday,
          needsAutoNudgeHighlight: Boolean(latestTargetDirective && !completedDailyTarget && deadlineWindowInfo.isWithin4Hours),
          isMonitor: isUserMonitorForBatch(stu.userId, activeBatch)
        };
      }).sort((a, b) => {
        if (Boolean(b.needsAutoNudgeHighlight) !== Boolean(a.needsAutoNudgeHighlight)) {
          return b.needsAutoNudgeHighlight ? 1 : -1;
        }
        return (b.avgWpm - a.avgWpm) || (b.testsCount - a.testsCount);
      });

      const pendingTargetStudents = latestTargetDirective ? studentRows.filter(s => !s.completedDailyTarget) : [];
      window.__currentBatchPendingStudents = pendingTargetStudents;

      const autoNudgeStrip = document.getElementById('batch-monitor-auto-nudge-strip');
      if (autoNudgeStrip) {
        if (isMonitorForActiveBatch && latestTargetDirective && pendingTargetStudents.length > 0) {
          autoNudgeStrip.style.display = 'block';
          autoNudgeStrip.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div style="flex: 1; min-width: 240px;">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px;">
                  <strong style="font-size: 12px; color: #991b1b;">
                    ${pendingTargetStudents.length} Student${pendingTargetStudents.length === 1 ? '' : 's'} Pending Active Batch Target (${window.escapeHtml(deadlineWindowInfo.remainingLabel)})
                  </strong>
                </div>
                <div style="font-size: 11.5px; color: var(--secondary); line-height: 1.4;">
                  Click <strong>Bulk Auto-Nudge</strong> to send private reminder queries to pending students before <strong>${window.escapeHtml(deadlineLabelStr)}</strong>.
                </div>
              </div>
              <button type="button" class="btn btn-sm" style="background: #dc2626; color: #fff; border: none; font-weight: 800; font-size: 11px; padding: 7px 14px; border-radius: 8px; white-space: nowrap; cursor: pointer;" onclick="sendBulkAutoNudgeToAllPendingStudents()">
                <i class="fa-solid fa-bolt"></i> Bulk Auto-Nudge (${pendingTargetStudents.length})
              </button>
            </div>
          `;
        } else {
          autoNudgeStrip.style.display = 'none';
        }
      }

      const radarEl = document.getElementById('batch-at-risk-early-warning-radar');
      if (radarEl) {
        const atRiskStudents = studentRows.filter(s => s.testsCount >= 3 && s.avgAcc < 90);
        if (isMonitorForActiveBatch && atRiskStudents.length > 0) {
          radarEl.style.display = 'block';
          radarEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:6px;">
              <div style="font-size:11.5px; font-weight:800; color:#b91c1c; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-triangle-exclamation"></i> At-Risk Students (${atRiskStudents.length} with &lt;90% Rolling Accuracy)
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:8px;">
              ${atRiskStudents.map(st => `
                <div style="background:var(--surface); border:1px solid rgba(239,68,68,0.3); border-radius:8px; padding:7px 10px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                  <div>
                    <div style="font-size:11.5px; font-weight:800; color:var(--secondary);">${window.escapeHtml(st.name)} <span style="font-size:10px; color:var(--text-muted);">(${window.escapeHtml(st.userId)})</span></div>
                    <div style="font-size:10.5px; color:#dc2626; font-weight:700;">Rolling Accuracy ${st.avgAcc}% (${st.testsCount} tests)</div>
                  </div>
                  <button type="button" class="btn btn-sm" style="background:#ef4444; color:#fff; border:none; font-size:10px; font-weight:800; padding:4px 8px; border-radius:6px;" onclick="sendSingleClickPrivateAutoNudge('${st.userId.replace(/'/g, "\\'")}', '${st.name.replace(/'/g, "\\'")}')">
                    Intervene
                  </button>
                </div>
              `).join('')}
            </div>
          `;
        } else {
          radarEl.style.display = 'none';
        }
      }

      const kpiStrip = document.getElementById('dashboard-batch-monitor-kpi-strip');
      if (kpiStrip) {
        const overallWpm = studentsWithTests > 0 ? (batchWpmSum / studentsWithTests).toFixed(1) : '0.0';
        const overallAcc = studentsWithTests > 0 ? (batchAccSum / studentsWithTests).toFixed(1) : '0.0';
        kpiStrip.innerHTML = `
          <div style="background: var(--surface); border: 1px solid #fde68a; border-radius: 10px; padding: 8px 10px;">
            <div style="font-size: 10px; font-weight: 800; color: #92400e; text-transform: uppercase;">Batch Students</div>
            <div style="font-size: 17px; font-weight: 900; color: var(--secondary);">${studentRows.length}</div>
          </div>
          <div style="background: var(--surface); border: 1px solid #fde68a; border-radius: 10px; padding: 8px 10px;">
            <div style="font-size: 10px; font-weight: 800; color: #059669; text-transform: uppercase;">Practiced Today</div>
            <div style="font-size: 17px; font-weight: 900; color: #059669;">${activeTodayCount} / ${studentRows.length}</div>
          </div>
          <div style="background: var(--surface); border: 1px solid #fde68a; border-radius: 10px; padding: 8px 10px;">
            <div style="font-size: 10px; font-weight: 800; color: #2563eb; text-transform: uppercase;">Batch Avg Speed</div>
            <div style="font-size: 17px; font-weight: 900; color: #2563eb;">${overallWpm} WPM</div>
          </div>
          <div style="background: var(--surface); border: 1px solid #fde68a; border-radius: 10px; padding: 8px 10px;">
            <div style="font-size: 10px; font-weight: 800; color: #7c3aed; text-transform: uppercase;">Batch Avg Accuracy</div>
            <div style="font-size: 17px; font-weight: 900; color: #7c3aed;">${overallAcc}%</div>
          </div>
        `;
      }

      const tbody = document.getElementById('batch-monitoring-student-progress-tbody');
      if (tbody) {
        if (studentRows.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 14px; color: var(--text-muted);">No students assigned to "${activeBatch}" yet.</td></tr>`;
        } else {
          tbody.innerHTML = studentRows.map((stu, idx) => {
            const rowBg = stu.needsAutoNudgeHighlight
              ? 'background: linear-gradient(90deg, rgba(245, 158, 11, 0.16), rgba(239, 68, 68, 0.08)); border-left: 4px solid #dc2626;'
              : (stu.isMonitor ? 'background: rgba(245, 158, 11, 0.08);' : '');
            const safeUid = stu.userId.replace(/'/g, "\\'");
            const safeUname = stu.name.replace(/'/g, "\\'");
            return `
              <tr style="border-bottom: 1px solid var(--border); ${rowBg}">
                <td style="padding: 7px 10px; font-weight: 800; color: var(--secondary);">
                  <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                    <span>#${idx + 1} ${stu.name}</span>
                    <span style="font-size: 10.5px; color: var(--text-muted);">(${stu.userId})</span>
                    ${stu.emailVerified ? `<span style="background:rgba(16,185,129,0.15); color:#059669; border:1px solid rgba(16,185,129,0.4); font-size:9px; font-weight:900; padding:1px 6px; border-radius:999px;" title="Verified Email Account"><i class="fa-solid fa-circle-check"></i> Verified</span>` : ''}
                    ${stu.isMonitor ? `<span style="background:#f59e0b; color:#fff; font-size:9.5px; font-weight:900; padding:1px 6px; border-radius:999px;">🎖️ MONITOR</span>` : ''}
                    ${stu.needsAutoNudgeHighlight ? `<span style="background:#dc2626; color:#fff; font-size:9px; font-weight:900; padding:1px 6px; border-radius:999px;"><i class="fa-solid fa-clock"></i> &lt;4h TO DEADLINE</span>` : ''}
                  </div>
                </td>
                <td style="padding: 7px 10px; font-size: 11px; font-weight: 700; color: var(--text-muted);">${stu.isMonitor && monitorEntry ? (monitorEntry.monitorType || 'Batch Monitor') : stu.role}</td>
                <td style="padding: 7px 10px; font-weight: 800;">${stu.testsCount}</td>
                <td style="padding: 7px 10px; font-weight: 800; color: var(--primary);">${stu.avgWpm} WPM</td>
                <td style="padding: 7px 10px; font-weight: 800; color: #0284c7;">${stu.bestWpm} WPM</td>
                <td style="padding: 7px 10px; font-weight: 800; color: ${stu.avgAcc >= 90 ? '#059669' : '#d97706'};">${stu.avgAcc}%</td>
                <td style="padding: 7px 10px;">
                  <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                    ${!latestTargetDirective
                      ? `<span style="background:rgba(100,116,139,0.12); color:var(--text-muted); font-weight:700; font-size:10.5px; padding:2px 8px; border-radius:999px;">No Active Target</span>`
                      : (stu.completedDailyTarget
                        ? `<span style="background:rgba(16,185,129,0.14); color:#059669; font-weight:800; font-size:10.5px; padding:2px 8px; border-radius:999px;"><i class="fa-solid fa-circle-check"></i> Target Done</span>`
                        : `<span style="background:rgba(239,68,68,0.14); color:#dc2626; font-weight:800; font-size:10.5px; padding:2px 8px; border-radius:999px;"><i class="fa-solid fa-triangle-exclamation"></i> Target Pending (${deadlineWindowInfo.remainingLabel})</span>`)
                    }
                    ${latestTargetDirective && !stu.completedDailyTarget && stu.userId !== uid ? `
                      <button type="button" class="btn btn-sm" style="padding: 3px 9px; font-size: 10.5px; font-weight: 800; border-radius: 7px; border: none; background: ${stu.alreadyNudgedToday ? 'rgba(124,58,237,0.15)' : 'linear-gradient(135deg, #ea580c, #dc2626)'}; color: ${stu.alreadyNudgedToday ? '#6d28d9' : '#ffffff'}; cursor: pointer;" title="Single-click: Send private Auto-Nudge query directly to ${safeUname}" onclick="sendSingleClickPrivateAutoNudge('${safeUid}', '${safeUname}')">
                        <i class="fa-solid fa-bolt"></i> ${stu.alreadyNudgedToday ? 'Nudged (Send Again)' : '1-Click Auto-Nudge'}
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('');
        }
      }

      const targetBannerEl = document.getElementById('batch-active-study-target-banner');
      if (targetBannerEl) {
        const latestDirective = directiveMsgs[0];
        if (latestDirective) {
          const timeStr = latestDirective.timestamp ? new Date(latestDirective.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
          targetBannerEl.style.display = 'block';
          targetBannerEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
              <div style="flex:1; min-width:220px;">
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:4px;">
                  <span style="background:#0d9488; color:#fff; font-size:9.5px; font-weight:900; padding:2px 8px; border-radius:999px; letter-spacing:0.4px;">
                    <i class="fa-solid fa-bullhorn"></i> OFFICIAL INSTRUCTOR ${(latestDirective.tag || 'DIRECTIVE').toUpperCase()}
                  </span>
                  <strong style="font-size:12px; color:var(--secondary);">${latestDirective.authorName || 'Instructor'}</strong>
                  <span style="font-size:10.5px; font-weight:800; color:#0f766e;">(${latestDirective.authorRole || 'Instructor'})</span>
                  <span style="font-size:10.5px; color:var(--text-muted);">• ${timeStr}</span>
                </div>
                <div style="font-size:12.5px; font-weight:700; color:var(--secondary); line-height:1.45;">
                  ${String(latestDirective.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </div>
                ${formatBatchDiscussionTargetPillsHtml(latestDirective)}
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-secondary" style="padding:4px 10px; font-size:11px; font-weight:800; border-color:#0d9488; color:#0d9488;" onclick="switchBatchMonitoringHubTab('comms'); switchBatchCommsChannel('directives');">
                  <i class="fa-solid fa-bullhorn"></i> Directives (${directiveMsgs.length})
                </button>
                <button type="button" class="btn btn-sm btn-secondary" style="padding:4px 10px; font-size:11px; font-weight:800; border-color:#7c3aed; color:#7c3aed;" onclick="switchBatchMonitoringHubTab('comms'); switchBatchCommsChannel('private_queries');">
                  <i class="fa-solid fa-user-shield"></i> Private Queries (${visiblePrivateQueries.length})
                </button>
              </div>
            </div>
          `;
        } else {
          targetBannerEl.style.display = 'none';
        }
      }

      const feedEl = document.getElementById('batch-monitoring-comms-feed');
      if (!feedEl) return;

      if (activeChannel === 'directives') {
        if (directiveMsgs.length === 0) {
          feedEl.innerHTML = `
            <div style="text-align: center; padding: 18px; color: var(--text-muted); font-size: 12px; border: 1px dashed var(--border); border-radius: 10px;">
              <i class="fa-solid fa-bullhorn" style="font-size: 20px; color: #0d9488; margin-bottom: 6px; display: block;"></i>
              No official Instructor Directives posted in <strong>${activeBatch}</strong> yet.
              ${!isMonitorForActiveBatch ? `<div style="margin-top:6px;"><button type="button" class="btn btn-sm btn-secondary" style="font-size:11px; color:#7c3aed; border-color:#7c3aed;" onclick="switchBatchCommsChannel('private_queries')"><i class="fa-solid fa-user-shield"></i> Have a question? Send a Private Query to your Batch Monitor</button></div>` : ''}
            </div>
          `;
        } else {
          feedEl.innerHTML = directiveMsgs.map(m => {
            const canDelete = isMonitorForActiveBatch || String(m.authorId || '') === uid;
            const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            return `
              <div style="padding: 10px 12px; border-radius: 10px; background: ${m.pinned ? 'rgba(245, 158, 11, 0.12)' : 'rgba(13, 148, 136, 0.06)'}; border: 1px solid ${m.pinned ? '#f59e0b' : 'rgba(13, 148, 136, 0.28)'}; border-left: 4px solid ${m.pinned ? '#d97706' : '#0d9488'}; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px;">
                    ${m.pinned ? `<span style="background:#d97706; color:#fff; font-size:9.5px; font-weight:900; padding:1px 6px; border-radius:999px;"><i class="fa-solid fa-thumbtack"></i> PINNED DIRECTIVE</span>` : ''}
                    <span style="background:#0d9488; color:#fff; font-size:9.5px; font-weight:900; padding:1px 7px; border-radius:999px;">📢 ${window.escapeHtml((m.tag || 'DIRECTIVE').toUpperCase())}</span>
                    <strong style="font-size: 12px; color: var(--secondary);">${window.escapeHtml(m.authorName || m.authorId)}</strong>
                    <span style="font-size: 10px; font-weight: 800; padding: 1px 7px; border-radius: 999px; background: #dbeafe; color: #1d4ed8;">${window.escapeHtml(m.authorRole || 'Instructor')}</span>
                    <span style="font-size: 10px; color: var(--text-muted); margin-left: auto;">${window.escapeHtml(timeStr)}</span>
                  </div>
                  <div style="font-size: 12.5px; color: var(--text-main); line-height: 1.45; word-break: break-word;">${window.escapeHtml(m.message || '')}</div>
                  ${formatBatchDiscussionTargetPillsHtml(m)}
                </div>
                ${canDelete ? `
                  <div style="display: flex; gap: 4px; flex-shrink: 0;">
                    ${isMonitorForActiveBatch ? `
                      <button type="button" class="btn btn-sm btn-secondary" style="padding: 2px 6px; font-size: 10px;" title="Pin / Unpin Directive" onclick="togglePinBatchGroupMessage('${window.escapeHtml(String(m.id)).replace(/'/g, "\\'")}', '${window.escapeHtml(activeBatch).replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-thumbtack"></i>
                      </button>
                    ` : ''}
                    <button type="button" class="btn btn-sm btn-danger" style="padding: 2px 6px; font-size: 10px;" title="Delete Directive" onclick="deleteBatchGroupMessageById('${window.escapeHtml(String(m.id)).replace(/'/g, "\\'")}', '${window.escapeHtml(activeBatch).replace(/'/g, "\\'")}')">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('');
        }
      } else {
        // Render Private Queries to Appointed Batch Monitor
        if (visiblePrivateQueries.length === 0) {
          feedEl.innerHTML = `
            <div style="text-align: center; padding: 18px; color: var(--text-muted); font-size: 12px; border: 1px dashed rgba(124,58,237,0.35); border-radius: 10px;">
              <i class="fa-solid fa-user-shield" style="font-size: 20px; color: #7c3aed; margin-bottom: 6px; display: block;"></i>
              ${isMonitorForActiveBatch
                ? `No private student queries in <strong>${window.escapeHtml(activeBatch)}</strong> yet.`
                : `You haven't sent any private queries to your Batch Monitor (<strong>${window.escapeHtml(monitorDisplayName)}</strong>) yet. Type your question above to start a real-time private thread!`
              }
            </div>
          `;
        } else {
          feedEl.innerHTML = visiblePrivateQueries.map(m => {
            const canDelete = isMonitorForActiveBatch || String(m.authorId || '') === uid;
            const canReply = isMonitorForActiveBatch || String(m.studentUserId || m.authorId || '') === uid;
            const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const statusVal = String(m.status || 'open').toLowerCase();
            const statusBadge = statusVal === 'resolved'
              ? `<span style="background:#dcfce7; color:#15803d; font-size:9.5px; font-weight:900; padding:1px 7px; border-radius:999px;"><i class="fa-solid fa-circle-check"></i> RESOLVED</span>`
              : (statusVal === 'replied'
                  ? `<span style="background:#ede9fe; color:#6d28d9; font-size:9.5px; font-weight:900; padding:1px 7px; border-radius:999px;"><i class="fa-solid fa-reply"></i> MONITOR REPLIED</span>`
                  : `<span style="background:#fef3c7; color:#b45309; font-size:9.5px; font-weight:900; padding:1px 7px; border-radius:999px;"><i class="fa-regular fa-clock"></i> AWAITING MONITOR</span>`);
            return `
              <div style="padding: 10px 12px; border-radius: 10px; background: rgba(124, 58, 237, 0.05); border: 1px solid rgba(124, 58, 237, 0.28); border-left: 4px solid #7c3aed;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;">
                      <span style="background:#7c3aed; color:#fff; font-size:9.5px; font-weight:900; padding:1px 7px; border-radius:999px;"><i class="fa-solid fa-lock"></i> PRIVATE QUERY TO MONITOR</span>
                      ${statusBadge}
                      <strong style="font-size: 12px; color: var(--secondary);">${window.escapeHtml(m.studentUserName || m.authorName || m.authorId)}</strong>
                      <span style="font-size: 10.5px; color: #6d28d9; font-weight: 800;"><i class="fa-solid fa-arrow-right"></i> To: ${window.escapeHtml(m.recipientMonitorName || monitorDisplayName)}</span>
                      <span style="font-size: 10px; color: var(--text-muted); margin-left: auto;">${window.escapeHtml(timeStr)}</span>
                    </div>
                    <div style="font-size: 12.5px; color: var(--text-main); line-height: 1.45; word-break: break-word;">${window.escapeHtml(m.message || '')}</div>
                  </div>
                  ${canDelete ? `
                    <button type="button" class="btn btn-sm btn-danger" style="padding: 2px 6px; font-size: 10px; flex-shrink: 0;" title="Delete Query Thread" onclick="deleteBatchGroupMessageById('${window.escapeHtml(String(m.id)).replace(/'/g, "\\'")}', '${window.escapeHtml(activeBatch).replace(/'/g, "\\'")}')">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  ` : ''}
                </div>
                ${renderPrivateQueryRepliesHtml(m, activeBatch, canReply)}
              </div>
            `;
          }).join('');
        }
      }
    
  try { portalHooks.emit('afterBatchMonitorRender'); } catch (_hk) {}
}

export function postBatchGroupCommunicationMessage() {
      if (!portalState.currentUser) return;
      const activeBatch = window.currentDashboardMonitoredBatch;
      if (!activeBatch) {
        showToast('⚠️ Please select a Batch first.');
        return;
      }
      const msgInput = document.getElementById('batch-comms-msg-input');
      const tagSel = document.getElementById('batch-comms-msg-tag');
      const text = msgInput ? msgInput.value.trim() : '';
      if (!text) {
        showToast('⚠️ Please enter a message or query.');
        return;
      }

      const uid = String(portalState.currentUser.userId || '').trim();
      const roleLower = String(portalState.currentUser.role || '').toLowerCase();
      const isAdminUser = ['admin', 'superadmin', 'instructor'].includes(roleLower);
      const isMonitorForThisBatch = isAdminUser || isUserMonitorForBatch(uid, activeBatch);
      const userMemberBatches = getUserAssignedBatchesList(uid, portalState.currentUser.batch || '');
      const activeChannel = window.currentBatchCommsChannel === 'private_queries' ? 'private_queries' : 'directives';

      if (!isAdminUser && !isMonitorForThisBatch && !userMemberBatches.includes(activeBatch)) {
        showToast(`🚫 Access Denied: You are not assigned to "${activeBatch}".`);
        return;
      }

      // Requirement #1: Keep the main announcement feed for instructor directives only; students send private queries to their appointed Batch Monitor
      const isPrivateQuery = (activeChannel === 'private_queries') || !isMonitorForThisBatch;
      if (!isMonitorForThisBatch && activeChannel === 'directives') {
        window.currentBatchCommsChannel = 'private_queries';
      }

      const monitorsMap = getBatchMonitorsMap();
      const monitorEntry = monitorsMap[activeBatch];
      const recipientMonitorId = monitorEntry && monitorEntry.userId ? String(monitorEntry.userId) : 'MONITOR';
      const recipientMonitorName = monitorEntry && (monitorEntry.userName || monitorEntry.userId)
        ? String(monitorEntry.userName || monitorEntry.userId)
        : 'Appointed Batch Monitor';

      const authorRoleLabel = isAdminUser
        ? (roleLower === 'superadmin' ? 'Superadmin / Chief Instructor' : 'Instructor / Admin')
        : (isMonitorForThisBatch ? ((monitorEntry && monitorEntry.monitorType) || 'Batch Monitor') : 'Batch Student');

      const tagValue = isPrivateQuery
        ? 'private_query'
        : ((tagSel && tagSel.value) ? tagSel.value : 'announcement');
      const visibility = isPrivateQuery ? 'private_monitor' : 'directive';

      const newMsg = {
        id: 'bmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        batchName: activeBatch,
        authorId: uid,
        authorName: portalState.currentUser.name || uid,
        authorRole: authorRoleLabel,
        visibility: visibility,
        recipientMonitorId: recipientMonitorId,
        recipientMonitorName: recipientMonitorName,
        studentUserId: uid,
        studentUserName: portalState.currentUser.name || uid,
        status: isPrivateQuery ? 'open' : 'published',
        replies: [],
        isMonitorPost: isMonitorForThisBatch && !isPrivateQuery,
        tag: tagValue,
        pinned: !isPrivateQuery && isMonitorForThisBatch && (tagValue === 'announcement' || tagValue === 'target'),
        message: text,
        timestamp: new Date().toISOString()
      };

      const allMsgsMap = getBatchGroupMessagesMap();
      if (!Array.isArray(allMsgsMap[activeBatch])) allMsgsMap[activeBatch] = [];
      allMsgsMap[activeBatch].unshift(newMsg);
      saveBatchGroupMessagesMap(allMsgsMap, true);

      if (msgInput) msgInput.value = '';
      renderDashboardBatchMonitoringHub();
      if (typeof renderAdminBatchDiscussionBoard === 'function') renderAdminBatchDiscussionBoard();

      apiCall('saveBatchGroupMessage', {
        batchName: activeBatch,
        messageId: newMsg.id,
        id: newMsg.id,
        authorId: newMsg.authorId,
        senderId: newMsg.authorId,
        authorName: newMsg.authorName,
        senderName: newMsg.authorName,
        authorRole: newMsg.authorRole,
        senderRole: newMsg.authorRole,
        visibility: newMsg.visibility,
        recipientMonitorId: newMsg.recipientMonitorId,
        recipientMonitorName: newMsg.recipientMonitorName,
        studentUserId: newMsg.studentUserId,
        studentUserName: newMsg.studentUserName,
        tag: newMsg.tag,
        msgType: newMsg.tag,
        pinned: newMsg.pinned,
        isPinned: newMsg.pinned,
        message: newMsg.message,
        messageText: newMsg.message
      }, true);

      if (isPrivateQuery) {
        showToast(`🔒 Private query sent directly to ${recipientMonitorName} (${activeBatch})!`);
      } else {
        showToast(`📢 Official directive posted to ${activeBatch} Main Announcement Feed!`);
      }
    }

export function computeStudyTargetDeadlineWindowInfo(deadlineLabelStr) {
      const now = new Date();
      let deadlineDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const raw = String(deadlineLabelStr || '').trim();
      const timeMatch = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
      if (timeMatch) {
        let hrs = parseInt(timeMatch[1], 10);
        const mins = parseInt(timeMatch[2] || '0', 10);
        const ampm = timeMatch[3].toUpperCase();
        if (ampm === 'PM' && hrs < 12) hrs += 12;
        if (ampm === 'AM' && hrs === 12) hrs = 0;
        deadlineDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hrs, mins, 0);
      }
      const diffHours = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      // Highlight students within 4 hours of the deadline (or if a daily deadline is active today)
      const isWithin4Hours = diffHours <= 4 || Boolean(raw);
      const cleanHrs = Math.max(1, Math.min(4, Math.ceil(diffHours > 0 && diffHours <= 4 ? diffHours : 3)));
      return {
        isWithin4Hours,
        remainingHours: cleanHrs,
        remainingLabel: `${cleanHrs}h left`
      };
    }

export function sendSingleClickPrivateAutoNudge(studentId, studentName, silentToast = false) {
      if (!portalState.currentUser || !studentId) return;
      const activeBatch = window.currentDashboardMonitoredBatch || getInstituteBatchesList()[0] || 'RP-Trail';
      const uid = String(portalState.currentUser.userId || '').trim();
      const monitorsMap = getBatchMonitorsMap();
      const monitorEntry = monitorsMap[activeBatch];
      const monitorName = (monitorEntry && (monitorEntry.userName || monitorEntry.userId))
        ? String(monitorEntry.userName || monitorEntry.userId)
        : (portalState.currentUser.name || uid);

      const allMsgsMap = getBatchGroupMessagesMap();
      if (!Array.isArray(allMsgsMap[activeBatch])) allMsgsMap[activeBatch] = [];
      const directiveMsgs = allMsgsMap[activeBatch].filter(m => m.visibility !== 'private_monitor' && m.tag !== 'private_query');
      const latestDirective = directiveMsgs[0] || null;
      const targetWpm = (latestDirective && latestDirective.targetWpm && latestDirective.targetWpm !== '-') ? latestDirective.targetWpm : '80 WPM';
      const targetAcc = (latestDirective && latestDirective.targetAcc && latestDirective.targetAcc !== '-') ? latestDirective.targetAcc : '95%';
      const targetDeadline = (latestDirective && latestDirective.targetDeadline && latestDirective.targetDeadline !== '-') ? latestDirective.targetDeadline : 'Tonight 9:00 PM';

      const nudgeText = `⚡ [Auto-Nudge • Daily Study Target Reminder] Hi ${studentName} (${studentId}), you are within 4 hours of today's Daily Study Target deadline (${targetDeadline}) for ${activeBatch}. Please complete your stenography dictation & transcription practice (Target: ${targetWpm} | Min Accuracy: ${targetAcc}) and reply here if you need any assistance!`;

      const newMsg = {
        id: 'bmsg_nudge_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        batchName: activeBatch,
        authorId: uid,
        authorName: monitorName,
        authorRole: `Appointed Batch Monitor (${activeBatch})`,
        visibility: 'private_monitor',
        recipientMonitorId: uid,
        recipientMonitorName: monitorName,
        studentUserId: String(studentId),
        studentUserName: String(studentName || studentId),
        status: 'open',
        replies: [],
        isMonitorPost: true,
        tag: 'private_query',
        pinned: false,
        message: nudgeText,
        targetWpm: String(targetWpm),
        targetAcc: String(targetAcc),
        targetDeadline: String(targetDeadline),
        timestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      allMsgsMap[activeBatch].unshift(newMsg);
      saveBatchGroupMessagesMap(allMsgsMap, true);

      renderDashboardBatchMonitoringHub();
      if (typeof renderAdminBatchDiscussionBoard === 'function') renderAdminBatchDiscussionBoard();

      apiCall('saveBatchGroupMessage', {
        batchName: activeBatch,
        messageId: newMsg.id,
        id: newMsg.id,
        authorId: newMsg.authorId,
        senderId: newMsg.authorId,
        authorName: newMsg.authorName,
        senderName: newMsg.authorName,
        authorRole: newMsg.authorRole,
        senderRole: newMsg.authorRole,
        visibility: newMsg.visibility,
        recipientMonitorId: newMsg.recipientMonitorId,
        recipientMonitorName: newMsg.recipientMonitorName,
        studentUserId: newMsg.studentUserId,
        studentUserName: newMsg.studentUserName,
        tag: newMsg.tag,
        msgType: newMsg.tag,
        pinned: false,
        isPinned: false,
        message: newMsg.message,
        messageText: newMsg.message,
        targetWpm: newMsg.targetWpm,
        targetAcc: newMsg.targetAcc,
        targetDeadline: newMsg.targetDeadline
      }, true);

      if (!silentToast) {
        showToast(`⚡ Private Auto-Nudge query sent directly to ${studentName} (${studentId})!`);
      }
    }

export function sendBulkAutoNudgeToAllPendingStudents() {
      if (!portalState.currentUser) return;
      const activeBatch = window.currentDashboardMonitoredBatch || getInstituteBatchesList()[0] || 'General Batch';
      const pendingList = Array.isArray(window.__currentBatchPendingStudents) ? window.__currentBatchPendingStudents : [];
      let nudgedCount = 0;

      if (pendingList.length > 0) {
        pendingList.forEach(stu => {
          sendSingleClickPrivateAutoNudge(stu.userId, stu.name || stu.userId, true);
          nudgedCount++;
        });
      } else {
        const uid = String(portalState.currentUser.userId || '').trim();
        const allUsersPool = (portalState.adminData && Array.isArray(portalState.adminData.users) && portalState.adminData.users.length > 0)
          ? portalState.adminData.users
          : ((portalState.globalData && Array.isArray(portalState.globalData.users) && portalState.globalData.users.length > 0) ? portalState.globalData.users : []);
        const allHistoryPool = (portalState.adminData && Array.isArray(portalState.adminData.results) && portalState.adminData.results.length > 0)
          ? portalState.adminData.results
          : ((portalState.globalData && Array.isArray(portalState.globalData.history) && portalState.globalData.history.length > 0) ? portalState.globalData.history : (portalState.allTestHistoryList || []));
        const todayIso = new Date().toISOString().slice(0, 10);

        allUsersPool.forEach(u => {
          const sId = String(u.UserID || u.userId || '').trim();
          if (!sId || sId === uid) return;
          const uBatches = getUserAssignedBatchesList(sId, u.Batch || u.batch || '');
          if (!uBatches.includes(activeBatch)) return;
          const practicedToday = allHistoryPool.some(h =>
            String(h.UserID || h.userId || '').trim() === sId &&
            String(h.Timestamp || h.timestamp || h.Date || '').slice(0, 10) === todayIso
          );
          if (!practicedToday) {
            sendSingleClickPrivateAutoNudge(sId, String(u.Name || u.name || sId), true);
            nudgedCount++;
          }
        });
      }

      renderDashboardBatchMonitoringHub();
      if (nudgedCount > 0) {
        showToast(`⚡ Bulk Auto-Nudge sent private notification queries to ${nudgedCount} pending student${nudgedCount === 1 ? '' : 's'} in ${activeBatch}!`);
      } else {
        showToast(`✅ All students in ${activeBatch} have already practiced today!`);
      }
    }

export function nudgeStudentInBatchComms(studentId, studentName) {
      sendSingleClickPrivateAutoNudge(studentId, studentName, false);
    }

export function togglePinBatchGroupMessage(messageId, explicitBatch = '') {
      const targetBatch = explicitBatch || window.currentDashboardMonitoredBatch;
      if (!targetBatch || !messageId) return;
      const uid = portalState.currentUser ? String(portalState.currentUser.userId || '').trim() : '';
      const roleLower = portalState.currentUser ? String(portalState.currentUser.role || '').toLowerCase() : '';
      const isAdminUser = ['admin', 'superadmin', 'instructor'].includes(roleLower);
      if (!isAdminUser && !isUserMonitorForBatch(uid, targetBatch)) {
        showToast(`🚫 Only the appointed Monitor for "${targetBatch}" or an Admin can pin/unpin messages in this group.`);
        return;
      }
      const allMsgsMap = getBatchGroupMessagesMap();
      const list = Array.isArray(allMsgsMap[targetBatch]) ? allMsgsMap[targetBatch] : [];
      const target = list.find(m => String(m.id) === String(messageId));
      if (!target) return;
      target.pinned = !target.pinned;
      saveBatchGroupMessagesMap(allMsgsMap, true);
      renderDashboardBatchMonitoringHub();
      if (typeof renderAdminBatchDiscussionBoard === 'function') renderAdminBatchDiscussionBoard();
    }

export function deleteBatchGroupMessageById(messageId, explicitBatch = '', skipConfirm = false) {
      const targetBatch = explicitBatch || window.currentDashboardMonitoredBatch;
      if (!messageId) return;
      if (!skipConfirm && typeof window.rpConfirmDelete === 'function') {
        window.rpConfirmDelete('Delete Batch Message?', 'Are you sure you want to permanently delete this batch message or poll?', () => deleteBatchGroupMessageById(messageId, explicitBatch, true));
        return;
      }
      const uid = portalState.currentUser ? String(portalState.currentUser.userId || '').trim() : '';
      const roleLower = portalState.currentUser ? String(portalState.currentUser.role || '').toLowerCase() : '';
      const isAdminUser = ['admin', 'superadmin', 'instructor'].includes(roleLower);
      const allMsgsMap = getBatchGroupMessagesMap();
      if (targetBatch && Array.isArray(allMsgsMap[targetBatch])) {
        const msgObj = allMsgsMap[targetBatch].find(m => String(m.id) === String(messageId));
        if (msgObj && !isAdminUser && !isUserMonitorForBatch(uid, targetBatch) && String(msgObj.authorId || '') !== uid) {
          showToast(`🚫 You can only delete messages in the batch group you monitor or your own posts.`);
          return;
        }
        allMsgsMap[targetBatch] = allMsgsMap[targetBatch].filter(m => String(m.id) !== String(messageId));
      } else {
        Object.keys(allMsgsMap).forEach(bKey => {
          if (Array.isArray(allMsgsMap[bKey])) {
            allMsgsMap[bKey] = allMsgsMap[bKey].filter(m => String(m.id) !== String(messageId));
          }
        });
      }
      saveBatchGroupMessagesMap(allMsgsMap, true);
      renderDashboardBatchMonitoringHub();
      if (typeof renderAdminBatchDiscussionBoard === 'function') renderAdminBatchDiscussionBoard();
      apiCall('deleteBatchGroupMessage', { batchName: targetBatch || 'ALL', messageId: messageId, msgId: messageId, id: messageId }, true);
      showToast('🗑️ Message removed from Batch Discussion Hub.');
    }

export function filterAdminBatchDiscussionCategory(category, btnEl) {
      window._activeAdminBatchDiscussionCategory = category || 'ALL';
      const bar = document.getElementById('admin-batch-discussion-filter-bar');
      if (bar) {
        bar.querySelectorAll('button[data-bdisc-cat]').forEach(b => {
          const isMatch = b.getAttribute('data-bdisc-cat') === window._activeAdminBatchDiscussionCategory;
          b.className = isMatch ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
        });
      }
      renderAdminBatchDiscussionBoard();
    }

export function postAdminBatchDiscussionMessage() {
      const batchSel = document.getElementById('admin-batch-discussion-batch-select');
      const tagSel = document.getElementById('admin-batch-discussion-tag-select');
      const wpmIn = document.getElementById('admin-batch-target-wpm');
      const accIn = document.getElementById('admin-batch-target-acc');
      const dlIn = document.getElementById('admin-batch-target-deadline');
      const pinChk = document.getElementById('admin-batch-discussion-pin-chk');
      const msgIn = document.getElementById('admin-batch-discussion-input');

      const selectedBatch = batchSel && batchSel.value ? batchSel.value : 'General Batch';
      const tagValue = tagSel && tagSel.value ? tagSel.value : 'target';
      const targetWpm = wpmIn ? wpmIn.value.trim() : '';
      const targetAcc = accIn ? accIn.value.trim() : '';
      const targetDeadline = dlIn ? dlIn.value.trim() : '';
      const isPinned = pinChk ? Boolean(pinChk.checked) : true;
      const text = msgIn ? msgIn.value.trim() : '';

      if (!text) {
        showToast('⚠️ Please enter an official instructor directive or study target for the batch.');
        if (msgIn) msgIn.focus();
        return;
      }

      const uid = portalState.currentUser ? String(portalState.currentUser.userId || 'ADMIN').trim() : 'ADMIN';
      const uName = portalState.currentUser ? String(portalState.currentUser.name || 'Instructor') : 'Instructor';
      const roleLower = portalState.currentUser ? String(portalState.currentUser.role || '').toLowerCase() : '';
      const isFullAdminOrSuper = roleLower === 'superadmin' || roleLower === 'admin';
      const userMonitorBatches = getUserMonitorBatchesList(uid);

      if (!isFullAdminOrSuper) {
        if (selectedBatch === 'ALL_BATCHES' || !isUserMonitorForBatch(uid, selectedBatch)) {
          showToast(`🚫 Monitor Permission Restricted: You can share directives ONLY for the group you monitor (${userMonitorBatches.join(', ') || 'None'}).`);
          return;
        }
      }

      const roleStr = roleLower === 'superadmin'
        ? 'Chief Instructor / Superadmin'
        : (isUserMonitorForBatch(uid, selectedBatch) && !isFullAdminOrSuper ? `Batch Monitor (${selectedBatch})` : 'Batch Instructor / Admin');

      const targetBatchesList = selectedBatch === 'ALL_BATCHES'
        ? getInstituteBatchesList()
        : [selectedBatch];

      const allMsgsMap = getBatchGroupMessagesMap();
      const baseTime = new Date().toISOString();

      targetBatchesList.forEach((bName, idx) => {
        const msgObj = {
          id: 'bdisc_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6),
          batchName: bName,
          authorId: uid,
          authorName: uName,
          authorRole: roleStr,
          visibility: 'directive',
          isMonitorPost: true,
          tag: tagValue,
          pinned: isPinned,
          message: text,
          targetWpm,
          targetAcc,
          targetDeadline,
          timestamp: baseTime
        };
        if (!Array.isArray(allMsgsMap[bName])) allMsgsMap[bName] = [];
        allMsgsMap[bName].unshift(msgObj);

        apiCall('saveBatchGroupMessage', {
          batchName: bName,
          messageId: msgObj.id,
          id: msgObj.id,
          authorId: msgObj.authorId,
          senderId: msgObj.authorId,
          authorName: msgObj.authorName,
          senderName: msgObj.authorName,
          authorRole: msgObj.authorRole,
          senderRole: msgObj.authorRole,
          visibility: 'directive',
          tag: msgObj.tag,
          msgType: msgObj.tag,
          pinned: msgObj.pinned,
          isPinned: msgObj.pinned,
          targetWpm: msgObj.targetWpm,
          targetAcc: msgObj.targetAcc,
          targetDeadline: msgObj.targetDeadline,
          message: msgObj.message,
          messageText: msgObj.message
        }, true);
      });

      saveBatchGroupMessagesMap(allMsgsMap, true);
      if (batchDiscussionRealtimeChannel) {
        try {
          batchDiscussionRealtimeChannel.postMessage({
            type: 'BATCH_DISCUSSION_SYNC',
            toastText: `📢 New Instructor ${tagValue.toUpperCase()} posted for ${selectedBatch === 'ALL_BATCHES' ? 'All Batches' : selectedBatch}!`,
            timestamp: Date.now()
          });
        } catch (e) {}
      }

      if (msgIn) msgIn.value = '';
      if (wpmIn) wpmIn.value = '';
      if (accIn) accIn.value = '';
      if (dlIn) dlIn.value = '';

      renderAdminBatchDiscussionBoard();
      renderDashboardBatchMonitoringHub();
      pushPortalNotification(
        `📢 Batch ${tagValue === 'target' ? 'Study Target' : 'Instructor Directive'} (${selectedBatch === 'ALL_BATCHES' ? 'All Batches' : selectedBatch})`,
        text,
        tagValue === 'homework' ? 'homework' : 'info',
        'dashboard'
      );
      logPortalAction('ADMIN_BATCH_DISCUSSION_POST', `Posted [${tagValue.toUpperCase()}] to "${selectedBatch}": ${text.slice(0, 90)}`);
      showToast(`✅ Official Instructor Directive published to ${selectedBatch === 'ALL_BATCHES' ? 'all batches' : selectedBatch}!`);
    }

export function renderAdminBatchDiscussionBoard(showSyncToast = false) {
      if (showSyncToast) {
        pollRealtimeBatchDiscussionMessages(true);
      }
      const feedEl = document.getElementById('admin-batch-discussion-feed');
      const countPill = document.getElementById('admin-batch-discussion-count-pill');
      const batchSel = document.getElementById('admin-batch-discussion-batch-select');
      const searchIn = document.getElementById('admin-batch-discussion-search');
      if (!feedEl) return;

      const selectedBatch = batchSel && batchSel.value ? batchSel.value : 'General Batch';
      const activeCat = window._activeAdminBatchDiscussionCategory || 'ALL';
      const query = searchIn ? searchIn.value.toLowerCase().trim() : '';

      const allMsgsMap = getBatchGroupMessagesMap();
      let combinedPosts = [];
      if (selectedBatch === 'ALL_BATCHES') {
        Object.keys(allMsgsMap).forEach(bName => {
          const arr = Array.isArray(allMsgsMap[bName]) ? allMsgsMap[bName] : [];
          arr.forEach(m => combinedPosts.push({ ...m, batchName: m.batchName || bName }));
        });
      } else {
        const arr = Array.isArray(allMsgsMap[selectedBatch]) ? allMsgsMap[selectedBatch] : [];
        combinedPosts = arr.map(m => ({ ...m, batchName: m.batchName || selectedBatch }));
      }

      if (activeCat !== 'ALL') {
        combinedPosts = combinedPosts.filter(m => {
          const t = String(m.tag || 'announcement').toLowerCase();
          const vis = String(m.visibility || 'directive').toLowerCase();
          if (activeCat === 'directives') return vis !== 'private_monitor' && t !== 'private_query';
          if (activeCat === 'private_query' || activeCat === 'chat') return vis === 'private_monitor' || t === 'private_query';
          return t === activeCat.toLowerCase();
        });
      }

      if (query) {
        combinedPosts = combinedPosts.filter(m =>
          String(m.message || '').toLowerCase().includes(query) ||
          String(m.authorName || '').toLowerCase().includes(query) ||
          String(m.batchName || '').toLowerCase().includes(query) ||
          String(m.targetWpm || '').toLowerCase().includes(query)
        );
      }

      combinedPosts.sort((a, b) => {
        if (Boolean(b.pinned) !== Boolean(a.pinned)) return b.pinned ? 1 : -1;
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });

      if (countPill) {
        countPill.innerText = `${combinedPosts.length} Item${combinedPosts.length === 1 ? '' : 's'}`;
      }

      if (combinedPosts.length === 0) {
        feedEl.innerHTML = `
          <div style="text-align: center; padding: 22px 16px; background: var(--background); border: 1px dashed var(--border); border-radius: 10px; color: var(--text-muted); font-size: 12.5px;">
            <i class="fa-solid fa-bullhorn" style="font-size: 22px; color: #0d9488; margin-bottom: 6px; display: block;"></i>
            No batch directives or student private queries found for <strong>${selectedBatch === 'ALL_BATCHES' ? 'All Batches' : selectedBatch}</strong>.
          </div>
        `;
      } else {
        const tagBadgeMeta = {
          target: { label: '🎯 STUDY TARGET', bg: 'rgba(13,148,136,0.14)', color: '#0f766e' },
          announcement: { label: '📢 INSTRUCTOR DIRECTIVE', bg: 'rgba(245,158,11,0.16)', color: '#b45309' },
          homework: { label: '📚 HOMEWORK DRILL', bg: 'rgba(79,70,229,0.14)', color: '#4338ca' },
          discussion: { label: '💬 INSTRUCTOR NOTE', bg: 'rgba(2,132,199,0.14)', color: '#0369a1' },
          private_query: { label: '🔒 PRIVATE STUDENT QUERY TO MONITOR', bg: 'rgba(124,58,237,0.16)', color: '#6d28d9' }
        };

        feedEl.innerHTML = combinedPosts.map(m => {
          const isPriv = m.visibility === 'private_monitor' || m.tag === 'private_query';
          const tKey = isPriv ? 'private_query' : String(m.tag || 'announcement').toLowerCase();
          const badge = tagBadgeMeta[tKey] || tagBadgeMeta.announcement;
          const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
          const safeId = String(m.id || '').replace(/'/g, "\\'");
          const safeBatch = String(m.batchName || selectedBatch).replace(/'/g, "\\'");
          return `
            <div style="padding: 10px 14px; border-radius: 10px; background: ${isPriv ? 'rgba(124,58,237,0.06)' : (m.pinned ? 'rgba(245, 158, 11, 0.10)' : 'var(--background)')}; border: 1px solid ${isPriv ? 'rgba(124,58,237,0.32)' : (m.pinned ? 'rgba(245, 158, 11, 0.45)' : 'var(--border)')}; border-left: 4px solid ${isPriv ? '#7c3aed' : (m.pinned ? '#f59e0b' : '#0d9488')};">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;">
                    ${m.pinned && !isPriv ? `<span style="background:#d97706; color:#fff; font-size:9.5px; font-weight:900; padding:2px 7px; border-radius:999px;"><i class="fa-solid fa-thumbtack"></i> PINNED</span>` : ''}
                    <span style="font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 999px; background: ${badge.bg}; color: ${badge.color};">${badge.label}</span>
                    <span style="font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); color: var(--secondary);"><i class="fa-solid fa-users-rectangle" style="color:#0d9488;"></i> ${m.batchName || 'General Batch'}</span>
                    <strong style="font-size: 12px; color: var(--secondary);">${m.authorName || m.authorId}</strong>
                    <span style="font-size: 10px; font-weight: 700; color: var(--text-muted);">(${m.authorRole || 'Instructor'})</span>
                    ${isPriv ? `<span style="font-size: 10.5px; font-weight: 800; color: #6d28d9;"><i class="fa-solid fa-arrow-right"></i> To Monitor: ${m.recipientMonitorName || 'Batch Monitor'}</span>` : ''}
                    <span style="font-size: 10.5px; color: var(--text-muted); margin-left: auto;">${timeStr}</span>
                  </div>
                  <div style="font-size: 12.5px; color: var(--text); line-height: 1.5; word-break: break-word;">${String(m.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                  ${formatBatchDiscussionTargetPillsHtml(m)}
                </div>
                <div style="display: flex; gap: 5px; flex-shrink: 0;">
                  ${!isPriv ? `
                    <button type="button" class="btn btn-sm btn-secondary" style="padding: 3px 7px; font-size: 10.5px;" title="Pin / Unpin Directive" onclick="togglePinBatchGroupMessage('${safeId}', '${safeBatch}')">
                      <i class="fa-solid fa-thumbtack" style="${m.pinned ? 'color:#d97706;' : ''}"></i>
                    </button>
                  ` : ''}
                  <button type="button" class="btn btn-sm btn-danger" style="padding: 3px 7px; font-size: 10.5px;" title="Delete Item" onclick="deleteBatchGroupMessageById('${safeId}', '${safeBatch}')">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
              ${isPriv ? renderPrivateQueryRepliesHtml(m, m.batchName || selectedBatch, true) : ''}
            </div>
          `;
        }).join('');
      }
    }

export function populateAllBatchSelectDropdowns() {
      const batches = getInstituteBatchesList();
      const monitorsMap = getBatchMonitorsMap();
      const totalBadge = document.getElementById('admin-total-batches-count-badge');
      if (totalBadge) {
        totalBadge.innerText = `${batches.length} Active Batch${batches.length === 1 ? '' : 'es'}`;
      }

      const monitorCountBadge = document.getElementById('admin-total-monitors-count-badge');
      const appointedBatchesKeys = Object.keys(monitorsMap).filter(b => monitorsMap[b] && monitorsMap[b].userId);
      if (monitorCountBadge) {
        monitorCountBadge.innerText = `${appointedBatchesKeys.length} Monitor${appointedBatchesKeys.length === 1 ? '' : 's'} Appointed`;
      }

      const chipSearchInput = document.getElementById('admin-batch-chip-search-input');
      const chipQuery = chipSearchInput ? chipSearchInput.value.toLowerCase().trim() : '';
      const visibleBatches = chipQuery
        ? batches.filter(b => b.toLowerCase().includes(chipQuery))
        : batches;

      const chipsBar = document.getElementById('admin-batches-chips-bar');
      if (chipsBar) {
        let allUsersRaw = (portalState.adminData && Array.isArray(portalState.adminData.users)) ? portalState.adminData.users : [];
        if (visibleBatches.length === 0) {
          chipsBar.innerHTML = `<span style="font-size:11.5px; color:var(--text-muted); padding:4px 8px;">No batches match "${chipQuery}".</span>`;
        } else {
          chipsBar.innerHTML = visibleBatches.map(b => {
            const count = allUsersRaw.filter(u => userHasBatchAssigned(u.UserID || u.userId, b, u.Batch || u.batch)).length;
            const safeB = b.replace(/'/g, "\\'");
            const canDelete = b !== 'RP-Trail';
            const monEntry = monitorsMap[b];
            const monLabel = monEntry && monEntry.userName ? ` • 🎖️ ${monEntry.userName}` : '';
            return `
              <span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; background:var(--surface); border:1px solid var(--border); font-size:11.5px; font-weight:800; color:var(--secondary); box-shadow:0 1px 2px rgba(0,0,0,0.04);">
                <i class="fa-solid fa-layer-group" style="color:#4f46e5; font-size:10px;"></i>
                <span style="cursor:pointer; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" onclick="quickFilterAdminUsersByBatch('${safeB}')" title="Click to filter users in ${b}">${b}${monLabel}</span>
                <span style="background:rgba(79,70,229,0.12); color:#4f46e5; padding:1px 6px; border-radius:999px; font-size:10px;">${count}</span>
                ${canDelete ? `<i class="fa-solid fa-xmark" style="cursor:pointer; color:#ef4444; font-size:11px; margin-left:2px;" title="Delete batch" onclick="deleteInstituteBatch('${safeB}')"></i>` : ''}
              </span>
            `;
          }).join('');
        }
      }

      // Render Appointed Batch Monitors Bar
      const monitorsChipsBar = document.getElementById('admin-monitors-chips-bar');
      if (monitorsChipsBar) {
        if (appointedBatchesKeys.length === 0) {
          monitorsChipsBar.innerHTML = `<span style="font-size:11.5px; color:var(--text-muted); padding:2px 6px;">No Batch Monitor appointed yet — select a student &amp; batch above or click the 🎖️ Crown icon next to any user's batch chip below.</span>`;
        } else {
          monitorsChipsBar.innerHTML = `<span style="font-size:11px; font-weight:800; color:#b45309; margin-right:4px;"><i class="fa-solid fa-user-Astronaut"></i> Appointed Monitors:</span>` +
            appointedBatchesKeys.map(b => {
              const entry = monitorsMap[b];
              const safeB = b.replace(/'/g, "\\'");
              return `
                <span style="display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px; background:linear-gradient(135deg, rgba(245,158,11,0.16), rgba(217,119,6,0.12)); border:1px solid rgba(245,158,11,0.45); font-size:11px; font-weight:800; color:#b45309;">
                  <span>🎖️ <strong>${entry.userName || entry.userId}</strong> (${b})</span>
                  <i class="fa-solid fa-xmark" style="cursor:pointer; color:#dc2626; font-size:10.5px;" title="Remove Monitor appointment for ${b}" onclick="removeBatchMonitorAppointment('${safeB}')"></i>
                </span>
              `;
            }).join('');
        }
      }

      // Populate Monitor Appointment Dropdowns
      const monitorBatchSel = document.getElementById('admin-appoint-monitor-batch-select');
      if (monitorBatchSel) {
        const prevB = monitorBatchSel.value || '';
        monitorBatchSel.innerHTML = `<option value="">👥 Select Batch for Monitor...</option>` +
          batches.map(b => {
            const mon = monitorsMap[b];
            return `<option value="${b}">${b}${mon && mon.userName ? ` (Current: ${mon.userName})` : ''}</option>`;
          }).join('');
        if ([...monitorBatchSel.options].some(o => o.value === prevB)) monitorBatchSel.value = prevB;
      }

      // Populate Admin Real-Time Batch Discussion Dropdown (Requirement #14: Restrict Monitor to their monitored batch only)
      const adminDiscBatchSel = document.getElementById('admin-batch-discussion-batch-select');
      if (adminDiscBatchSel) {
        const curUid = portalState.currentUser ? String(portalState.currentUser.userId || '').trim() : '';
        const curRole = portalState.currentUser ? String(portalState.currentUser.role || '').toLowerCase() : '';
        const isFullAdminOrSuper = curRole === 'superadmin' || curRole === 'admin';
        const userMonitoredBatches = getUserMonitorBatchesList(curUid);
        const allowedDiscBatches = isFullAdminOrSuper ? batches : (userMonitoredBatches.length > 0 ? userMonitoredBatches : batches);
        const prevD = adminDiscBatchSel.value || (allowedDiscBatches[0] || 'RP-Trail');
        adminDiscBatchSel.innerHTML =
          allowedDiscBatches.map(b => {
            const mon = monitorsMap[b];
            return `<option value="${b}">👥 ${b}${mon && mon.userName ? ` (Monitor: ${mon.userName})` : ''}</option>`;
          }).join('') +
          (isFullAdminOrSuper ? `<option value="ALL_BATCHES">🌐 All Batches (Broadcast to Every Batch)</option>` : '');
        if ([...adminDiscBatchSel.options].some(o => o.value === prevD)) {
          adminDiscBatchSel.value = prevD;
        }
      }

      const monitorUserSel = document.getElementById('admin-appoint-monitor-user-select');
      if (monitorUserSel) {
        const prevU = monitorUserSel.value || '';
        const allUsersRaw = (portalState.adminData && Array.isArray(portalState.adminData.users)) ? portalState.adminData.users.map(normalizeUserRecord) : [];
        monitorUserSel.innerHTML = `<option value="">🎖️ Select Student / Member to Appoint as Monitor...</option>` +
          allUsersRaw.map(u => {
            const uid = String(u.UserID || '');
            const uname = String(u.Name || uid).replace(/"/g, '&quot;');
            const uBatch = getUserAssignedBatch(uid, u.Batch || u.batch);
            return `<option value="${uid}" data-uname="${uname}">${u.Name || uid} (${uid} • ${uBatch})</option>`;
          }).join('');
        if ([...monitorUserSel.options].some(o => o.value === prevU)) monitorUserSel.value = prevU;
      }

      const userFilterSel = document.getElementById('admin-filter-user-batch');
      if (userFilterSel) {
        const prevVal = userFilterSel.value || 'ALL';
        userFilterSel.innerHTML = `<option value="ALL">👥 Filter Batch: All Batches (${batches.length})</option>` +
          `<option value="MONITORS_ONLY">🎖️ Appointed Batch Monitors (${appointedBatchesKeys.length})</option>` +
          batches.map(b => `<option value="${b}">${b}</option>`).join('');
        if ([...userFilterSel.options].some(o => o.value === prevVal)) userFilterSel.value = prevVal;
      }

      const uploadBatchSel = document.getElementById('adm-upload-batch');
      if (uploadBatchSel) {
        const prevVal = uploadBatchSel.value || 'ALL';
        uploadBatchSel.innerHTML = `<option value="ALL">🌐 All Batches (Available to All Students)</option>` +
          batches.map(b => `<option value="${b}">👥 ${b}</option>`).join('');
        if ([...uploadBatchSel.options].some(o => o.value === prevVal)) uploadBatchSel.value = prevVal;
      }

      const liveBatchSel = document.getElementById('live-test-target-batch');
      if (liveBatchSel) {
        const prevVal = liveBatchSel.value || 'ALL';
        liveBatchSel.innerHTML = `<option value="ALL">🌐 All Batches (All-India Open Window)</option>` +
          batches.map(b => `<option value="${b}">👥 ${b}</option>`).join('');
        if ([...liveBatchSel.options].some(o => o.value === prevVal)) liveBatchSel.value = prevVal;
      }

      if (typeof renderAdminBatchDiscussionBoard === 'function') {
        renderAdminBatchDiscussionBoard();
      }
    
  try { portalHooks.emit('afterBatchDropdownsPopulated'); } catch (_hk) {}
}

export function deleteInstituteBatch(batchName, skipConfirm = false) {
      if (!batchName || batchName === 'RP-Trail') return;
      if (!skipConfirm && typeof window.rpConfirmDelete === 'function') {
        window.rpConfirmDelete('Delete Institute Batch?', `Delete batch "${batchName}"? Assigned students will fall back to RP-Trail.`, () => deleteInstituteBatch(batchName, true));
        return;
      }
      const list = getInstituteBatchesList().filter(b => b !== batchName);
      saveInstituteBatchesList(list);
      const map = getUserBatchAssignmentsMap();
      Object.keys(map).forEach(uid => {
        const curList = parseBatchListValue(map[uid]).filter(b => b !== batchName);
        map[uid] = curList.length > 0 ? curList : ['RP-Trail'];
      });
      saveUserBatchAssignmentsMap(map);
      const monMap = getBatchMonitorsMap();
      if (monMap[batchName]) {
        delete monMap[batchName];
        saveBatchMonitorsMap(monMap);
      }
      populateAllBatchSelectDropdowns();
      renderAdminUsers();
      showToast(`🗑️ Removed Batch "${batchName}".`);
    }

export function quickFilterAdminUsersByBatch(batchName) {
      const batchSel = document.getElementById('admin-filter-user-batch');
      if (batchSel) {
        batchSel.value = batchName || 'ALL';
        portalState.currentAdminUserPage = 1;
        renderAdminUsers();
      }
    }

export async function saveUserMultipleBatches(userId, batchesArray, userName = '') {
      const finalArr = ensureFreeBatchIncluded(batchesArray || []);
      const joinedBatchStr = finalArr.join(', ');

      const map = getUserBatchAssignmentsMap();
      map[String(userId)] = finalArr;
      saveUserBatchAssignmentsMap(map);

      if (portalState.adminData && Array.isArray(portalState.adminData.users)) {
        const uObj = portalState.adminData.users.find(u => String(u.UserID || u.userId) === String(userId));
        if (uObj) {
          uObj.Batch = joinedBatchStr;
          uObj.batch = joinedBatchStr;
        }
      }
      if (portalState.currentUser && String(portalState.currentUser.userId) === String(userId)) {
        portalState.currentUser.batch = joinedBatchStr;
        portalState.currentUser.Batch = joinedBatchStr;
        localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser));
        renderDailyPracticeGoalUI();
        if (typeof syncProfileTabUI === 'function') syncProfileTabUI();
      }

      populateAllBatchSelectDropdowns();
      renderAdminUsers();
      logPortalAction('ASSIGN_USER_BATCH', `Updated batches for ${userName || userId}: ${joinedBatchStr}`);
      apiCall('updateUserBatch', { targetUserId: userId, batchName: joinedBatchStr }, true);
    }

export async function addBatchToUser(userId, batchName, userName = '') {
      if (!batchName) return;
      const normNew = normalizeSingleBatchName(batchName);
      let existingRecordBatch = '';
      if (portalState.adminData && Array.isArray(portalState.adminData.users)) {
        const uObj = portalState.adminData.users.find(u => String(u.UserID || u.userId) === String(userId));
        if (uObj) existingRecordBatch = uObj.Batch || uObj.batch || '';
      }
      const curBatches = getUserAssignedBatchesList(userId, existingRecordBatch);
      if (curBatches.some(b => b.toLowerCase() === normNew.toLowerCase())) {
        showToast(`ℹ️ ${userName || userId} is already assigned to "${normNew}".`);
        return;
      }
      // Put newly assigned custom batch first, keep existing custom batches, and keep RP-Trail at the end
      const nextBatches = ensureFreeBatchIncluded([normNew, ...curBatches]);
      await saveUserMultipleBatches(userId, nextBatches, userName);
      showToast(`👥 Added Batch "${normNew}" to ${userName || userId} (RP-Trail free access kept active)!`);
    }

export async function removeBatchFromUser(userId, batchName, userName = '', skipConfirm = false) {
      if (String(batchName || '').trim().toLowerCase() === 'rp-trail') {
        showToast('ℹ️ RP-Trail is the permanent free batch for all users and cannot be removed.');
        return;
      }
      if (!skipConfirm && typeof window.rpConfirmDelete === 'function') {
        window.rpConfirmDelete('Remove Student Batch?', `Remove "${batchName}" from ${userName || userId}?`, () => removeBatchFromUser(userId, batchName, userName, true));
        return;
      }
      let existingRecordBatch = '';
      if (portalState.adminData && Array.isArray(portalState.adminData.users)) {
        const uObj = portalState.adminData.users.find(u => String(u.UserID || u.userId) === String(userId));
        if (uObj) existingRecordBatch = uObj.Batch || uObj.batch || '';
      }
      const curBatches = getUserAssignedBatchesList(userId, existingRecordBatch).filter(b => b.toLowerCase() !== String(batchName || '').toLowerCase());
      const nextBatches = ensureFreeBatchIncluded(curBatches);
      await saveUserMultipleBatches(userId, nextBatches, userName);
      showToast(`🗑️ Removed Batch "${batchName}" from ${userName || userId}.`);
    }

export async function assignUserToBatch(userId, batchName, userName = '') {
      await addBatchToUser(userId, batchName || 'RP-Trail', userName);
    }

export function bulkAssignFilteredUsersToBatch() {
      const inp = document.getElementById('admin-new-batch-name-input');
      const batchFilterSel = document.getElementById('admin-filter-user-batch');
      const targetBatch = (inp && inp.value.trim())
        ? inp.value.trim()
        : ((batchFilterSel && batchFilterSel.value !== 'ALL' && batchFilterSel.value !== 'MONITORS_ONLY') ? batchFilterSel.value : '');

      if (!targetBatch) {
        showToast('⚠️ Please type a Batch Name in the input box or select a Batch in the filter dropdown to bulk-assign.');
        return;
      }

      const list = getInstituteBatchesList();
      if (!list.includes(targetBatch) && targetBatch.toLowerCase() !== 'rp-trail') {
        list.push(targetBatch);
        saveInstituteBatchesList(list);
      }

      const allUsersRaw = (portalState.adminData && Array.isArray(portalState.adminData.users)) ? portalState.adminData.users.map(normalizeUserRecord) : [];
      const searchInput = document.getElementById('admin-search-users');
      const roleFilterSelect = document.getElementById('admin-filter-user-role');
      const statusFilterSelect = document.getElementById('admin-filter-user-status');
      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const activeRole = roleFilterSelect ? roleFilterSelect.value : 'ALL';
      const activeStatus = statusFilterSelect ? statusFilterSelect.value : 'ALL';

      let filtered = [...allUsersRaw];
      if (search) {
        filtered = filtered.filter(u =>
          String(u.Name ?? '').toLowerCase().includes(search) ||
          String(u.Email ?? '').toLowerCase().includes(search) ||
          String(u.Mobile ?? '').toLowerCase().includes(search) ||
          String(u.UserID ?? '').toLowerCase().includes(search)
        );
      }
      if (activeRole !== 'ALL') filtered = filtered.filter(u => String(u.Role ?? '').toLowerCase() === activeRole.toLowerCase());
      if (activeStatus !== 'ALL') filtered = filtered.filter(u => String(u.Status ?? '').toLowerCase() === activeStatus.toLowerCase());

      if (filtered.length === 0) {
        showToast('⚠️ No matching users in current filter to bulk-assign.');
        return;
      }

      const map = getUserBatchAssignmentsMap();
      const updatedUserIds = [];
      filtered.forEach(u => {
        const curList = getUserAssignedBatchesList(u.UserID, u.Batch || u.batch);
        const nextList = ensureFreeBatchIncluded([targetBatch, ...curList]);
        map[String(u.UserID)] = nextList;
        u.Batch = nextList.join(', ');
        if (u.UserID) updatedUserIds.push(String(u.UserID));
      });
      saveUserBatchAssignmentsMap(map);
      if (updatedUserIds.length > 0) {
        apiCall('bulkUpdateUserBatches', { batch: targetBatch, batchName: targetBatch, userIds: updatedUserIds }, true);
      }
      populateAllBatchSelectDropdowns();
      renderAdminUsers();
      showToast(`✅ Bulk-assigned Batch "${targetBatch}" to ${filtered.length} users (RP-Trail kept active) & synced to Google Sheets!`);
    }

export function quickFilterAdminUsersByKpi(roleVal, statusVal) {
      const roleSelect = document.getElementById('admin-filter-user-role');
      const statusSelect = document.getElementById('admin-filter-user-status');
      const batchSelect = document.getElementById('admin-filter-user-batch');
      const searchInput = document.getElementById('admin-search-users');
      if (searchInput) searchInput.value = '';
      if (roleSelect && roleVal !== null) roleSelect.value = roleVal;
      if (statusSelect && statusVal !== null) statusSelect.value = statusVal;
      if (batchSelect) batchSelect.value = 'ALL';
      portalState.currentAdminUserPage = 1;
      renderAdminUsers();
    }

export async function sendBulkVerificationRemindersNow() {
      if (!portalState.currentUser) return;
      showToast('📨 Sending Email & Mobile verification reminders to pending students...');
      const res = await apiCall('sendBulkVerificationReminders', {});
      if (res && res.success) {
        showToast(res.message || `✅ Sent ${res.sentCount || 0} verification reminder emails!`);
      } else {
        showToast((res && res.message) || 'Could not send verification reminders.');
      }
    }

export function renderAdminUsers() {
      try {
        if (typeof populateAllBatchSelectDropdowns === 'function') populateAllBatchSelectDropdowns();
      } catch (e) {}
      const tbody = document.getElementById('admin-users-tbody');
      const pageIndicator = document.getElementById('admin-users-page-indicator');
      const kpiStrip = document.getElementById('admin-users-kpi-strip');
      if (!tbody) return;
      tbody.innerHTML = '';

      const safeEscape = (v) => (typeof escapeHtml === 'function') ? escapeHtml(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const safeGetValidity = (u) => {
        try {
          if (typeof window.getUserEnrollmentValidityLabel === 'function') return window.getUserEnrollmentValidityLabel(u);
          if (u && u.EnrollmentValidUntil) return 'Valid till ' + u.EnrollmentValidUntil;
        } catch (e) {}
        return 'Active Pass';
      };
      const safeEmailVer = (u) => {
        try {
          const r = String(u?.Role || '').toLowerCase();
          if (r === 'superadmin') return true;
          if (u?.EmailVerified === true || u?.emailVerified === true) return true;
          if (typeof isUserEmailAlreadyVerified === 'function') return Boolean(isUserEmailAlreadyVerified(u));
        } catch (e) {}
        return false;
      };
      const safeMobVer = (u) => {
        try {
          const r = String(u?.Role || '').toLowerCase();
          if (r === 'superadmin') return true;
          if (u?.MobileVerified === true || u?.mobileVerified === true) return true;
          if (typeof isUserMobileAlreadyVerified === 'function') return Boolean(isUserMobileAlreadyVerified(u));
        } catch (e) {}
        return false;
      };

      let allUsersRaw = (portalState.adminData && Array.isArray(portalState.adminData.users)) ? portalState.adminData.users.map(u => {
        try { return normalizeUserRecord(u); } catch (e) { return u || {}; }
      }) : [];
      if (allUsersRaw.length === 0 && Array.isArray(portalState.globalData?.adminContacts) && portalState.globalData.adminContacts.length > 0) {
        allUsersRaw = portalState.globalData.adminContacts.map(c => normalizeUserRecord({
          UserID: c.userId || 'ADM',
          Name: c.name || 'Administrator',
          Email: c.email || '-',
          Mobile: c.mobile || '-',
          Role: c.role || 'admin',
          Status: c.status || 'active',
          AdminPermissions: 'ALL'
        }));
      }

      const monitorsMap = typeof getBatchMonitorsMap === 'function' ? getBatchMonitorsMap() : {};
      const appointedMonitorsCount = Object.keys(monitorsMap).filter(b => monitorsMap[b] && monitorsMap[b].userId).length;

      if (kpiStrip) {
        const totalU = allUsersRaw.length;
        const superU = allUsersRaw.filter(u => String(u.Role || '').toLowerCase() === 'superadmin').length;
        const adminU = allUsersRaw.filter(u => String(u.Role || '').toLowerCase() === 'admin').length;
        const activeU = allUsersRaw.filter(u => String(u.Status || 'active').toLowerCase() === 'active').length;
        const blockedU = allUsersRaw.filter(u => String(u.Status || '').toLowerCase() === 'blocked').length;
        const unverifiedU = allUsersRaw.filter(u => !safeEmailVer(u) || !safeMobVer(u)).length;
        const freeTierU = allUsersRaw.filter(u => {
          const bLow = String(u.Batch || u.batch || 'RP-Trail').toLowerCase();
          return !bLow || bLow === 'rp-trail' || bLow === 'free tier' || bLow === 'general batch' || u.AutoSwitchedToFreeTier;
        }).length;
        kpiStrip.innerHTML = `
          <div class="rp-saas-kpi-card" onclick="quickFilterAdminUsersByKpi('ALL', 'ALL')" style="cursor:pointer;">
            <span class="rp-saas-kpi-label">Total Registered</span>
            <span class="rp-saas-kpi-value mono-num">${totalU}</span>
          </div>
          <div class="rp-saas-kpi-card" onclick="quickFilterAdminUsersByKpi('superadmin', 'ALL')" style="cursor:pointer;">
            <span class="rp-saas-kpi-label">Superadmins / Admins</span>
            <span class="rp-saas-kpi-value mono-num" style="color:var(--primary);">${superU} / ${adminU}</span>
          </div>
          <div class="rp-saas-kpi-card" onclick="quickFilterAdminUsersByBatch('MONITORS_ONLY')" style="cursor:pointer;">
            <span class="rp-saas-kpi-label">Batch Monitors</span>
            <span class="rp-saas-kpi-value mono-num" style="color:#b45309;">${appointedMonitorsCount}</span>
          </div>
          <div class="rp-saas-kpi-card" onclick="quickFilterAdminUsersByKpi('ALL', 'active')" style="cursor:pointer;">
            <span class="rp-saas-kpi-label">Active Users</span>
            <span class="rp-saas-kpi-value mono-num" style="color:#059669;">${activeU}</span>
          </div>
          <div class="rp-saas-kpi-card" onclick="quickFilterAdminUsersByKpi('ALL', 'unverified')" style="cursor:pointer;">
            <span class="rp-saas-kpi-label">Pending Verify</span>
            <span class="rp-saas-kpi-value mono-num" style="color:#d97706;">${unverifiedU}</span>
          </div>
          <div class="rp-saas-kpi-card" onclick="quickFilterAdminUsersByBatch('RP-Trail')" style="cursor:pointer;">
            <span class="rp-saas-kpi-label">RP-Trail (Free)</span>
            <span class="rp-saas-kpi-value mono-num" style="color:#0284c7;">${freeTierU}</span>
          </div>
          <div class="rp-saas-kpi-card" onclick="quickFilterAdminUsersByKpi('ALL', 'blocked')" style="cursor:pointer;">
            <span class="rp-saas-kpi-label">Blocked</span>
            <span class="rp-saas-kpi-value mono-num" style="color:var(--danger);">${blockedU}</span>
          </div>
        `;
      }

      let users = [...allUsersRaw];
      const searchInput = document.getElementById('admin-search-users');
      const roleFilterSelect = document.getElementById('admin-filter-user-role');
      const statusFilterSelect = document.getElementById('admin-filter-user-status');
      const batchFilterSelect = document.getElementById('admin-filter-user-batch');

      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

      if (search) {
        if (roleFilterSelect) roleFilterSelect.value = 'ALL';
        if (statusFilterSelect) statusFilterSelect.value = 'ALL';
        if (batchFilterSelect) batchFilterSelect.value = 'ALL';
      }

      const activeRole = roleFilterSelect ? roleFilterSelect.value : 'ALL';
      const activeStatus = statusFilterSelect ? statusFilterSelect.value : 'ALL';
      const activeBatch = batchFilterSelect ? batchFilterSelect.value : 'ALL';

      if (search) {
        users = users.filter(u => {
          const name = String(u.Name ?? '').toLowerCase();
          const email = String(u.Email ?? '').toLowerCase();
          const mobile = String(u.Mobile ?? '').toLowerCase();
          const userId = String(u.UserID ?? '').toLowerCase();
          const batchStr = (typeof getUserAssignedBatch === 'function' ? getUserAssignedBatch(u.UserID, u.Batch || u.batch) : String(u.Batch || '')).toLowerCase();
          return name.includes(search) || email.includes(search) || mobile.includes(search) || userId.includes(search) || batchStr.includes(search);
        });
      }

      if (activeRole !== 'ALL') {
        users = users.filter(u => String(u.Role ?? '').toLowerCase() === activeRole.toLowerCase());
      }

      if (activeStatus === 'unverified') {
        users = users.filter(u => !safeEmailVer(u) || !safeMobVer(u));
      } else if (activeStatus !== 'ALL') {
        users = users.filter(u => String(u.Status ?? 'active').toLowerCase() === activeStatus.toLowerCase());
      }

      if (activeBatch === 'MONITORS_ONLY') {
        users = users.filter(u => typeof getUserMonitorBatchesList === 'function' && getUserMonitorBatchesList(u.UserID).length > 0);
      } else if (activeBatch === 'RP-Trail' || activeBatch === 'Free Tier') {
        users = users.filter(u => {
          const bLow = String(u.Batch || u.batch || 'RP-Trail').toLowerCase();
          return !bLow || bLow === 'rp-trail' || bLow === 'free tier' || bLow === 'general batch' || u.AutoSwitchedToFreeTier;
        });
      } else if (activeBatch !== 'ALL') {
        users = users.filter(u => typeof userHasBatchAssigned === 'function' ? userHasBatchAssigned(u.UserID, activeBatch, u.Batch || u.batch) : String(u.Batch || '').includes(activeBatch));
      }

      const totalPages = Math.ceil(users.length / ADMIN_USERS_PER_PAGE) || 1;
      if (typeof portalState.currentAdminUserPage === 'undefined') portalState.currentAdminUserPage = 1;
      if (portalState.currentAdminUserPage > totalPages) portalState.currentAdminUserPage = totalPages;
      if (portalState.currentAdminUserPage < 1) portalState.currentAdminUserPage = 1;

      const startIndex = (portalState.currentAdminUserPage - 1) * ADMIN_USERS_PER_PAGE;
      const paginatedUsers = users.slice(startIndex, startIndex + ADMIN_USERS_PER_PAGE);

      if (pageIndicator) {
        pageIndicator.innerText = `Page ${portalState.currentAdminUserPage} of ${totalPages} (${users.length} matching users)`;
      }

      if (paginatedUsers.length === 0) {
        if (window._isLoadingAdminData && allUsersRaw.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--primary); font-weight: 700;"><span class="mini-spin"></span> Syncing registered users &amp; role permissions from server...</td></tr>`;
        } else {
          tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted);">No users match the selected filters. <button type="button" class="btn btn-sm btn-secondary" style="margin-left:8px;" onclick="quickFilterAdminUsersByKpi('ALL', 'ALL')">Reset Filters</button></td></tr>`;
        }
        return;
      }

      const isSuperAdmin = portalState.currentUser && String(portalState.currentUser.role || '').toLowerCase() === 'superadmin';
      const isAdminOrSuper = portalState.currentUser && ['superadmin', 'admin'].includes(String(portalState.currentUser.role || '').toLowerCase());
      const availableBatches = typeof getInstituteBatchesList === 'function' ? getInstituteBatchesList() : [];
      window.__adminSessionPasswordCache = window.__adminSessionPasswordCache || {};

      paginatedUsers.forEach(u => {
        try {
          const uId = String(u.UserID ?? '');
          const uName = String(u.Name ?? '');
          const safeNameAttr = uName.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
          const uEmail = String(u.Email ?? '-');
          const uMobile = String(u.Mobile ?? '-');
          const uRole = String(u.Role || 'user').toLowerCase();
          const uStatus = String(u.Status || 'active').toLowerCase();
          const uPerms = String(u.AdminPermissions || u.adminPermissions || (uRole === 'superadmin' || uRole === 'admin' ? 'ALL' : '')).replace(/'/g, '');
          const uStudentPerms = String(u.StudentTabPermissions || u.studentTabPermissions || 'ALL').replace(/'/g, '');
          const userBatchesList = typeof getUserAssignedBatchesList === 'function'
            ? getUserAssignedBatchesList(uId, u.Batch || u.batch)
            : [String(u.Batch || u.batch || 'RP-Trail')];
          const monitorBatchesForUser = typeof getUserMonitorBatchesList === 'function' ? getUserMonitorBatchesList(uId) : [];
          const canEditTarget = isAdminOrSuper && (isSuperAdmin || (uRole !== 'admin' && uRole !== 'superadmin'));
          const visiblePass = String(window.__adminSessionPasswordCache[uId] || u.VisiblePassword || u.Password || '').trim();
          const isPassHashed = Boolean(u.PasswordIsHashed) && !visiblePass;
          const isAutoFreeTier = Boolean(u.AutoSwitchedToFreeTier || userBatchesList.every(b => String(b || '').toLowerCase() === 'rp-trail'));
          const safeUidAttr = uId.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
          const parentPreviewName = String(u.ParentName || u.parentName || '').trim();
          const parentPreviewMobile = String(u.ParentMobile || u.parentMobile || '').trim();
          const feeStatusLabel = String(u.FeeStatus || u.feeStatus || '').trim();
          const hasAllAccess = Boolean(u.IsMemberAllAccess || u.isMemberAllAccess);

          const assignedBadgesHtml = userBatchesList.map(b => {
            const safeB = String(b).replace(/'/g, "\\'");
            const isMon = typeof isUserMonitorForBatch === 'function' && isUserMonitorForBatch(uId, b);
            const isFree = String(b).toLowerCase() === 'rp-trail';
            return `
              <span style="display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:6px; background:${isFree ? 'rgba(245,158,11,0.14)' : (isMon ? 'rgba(245,158,11,0.18)' : 'rgba(79,70,229,0.08)')}; border:1px solid ${isFree ? 'rgba(245,158,11,0.45)' : (isMon ? 'rgba(245,158,11,0.55)' : 'rgba(79,70,229,0.22)')}; color:${isFree ? '#b45309' : (isMon ? '#b45309' : '#4f46e5')}; font-size:10.5px; font-weight:700;">
                <span>${isMon ? '🎖️' : (isFree ? '🆓' : '👥')} ${safeEscape(b)}</span>
                ${!isFree ? `<i class="fa-solid fa-crown" style="cursor:pointer; color:${isMon ? '#d97706' : '#94a3b8'}; font-size:10px;" title="${isMon ? 'Remove Monitor role' : 'Appoint as Batch Monitor'}" onclick="toggleUserBatchMonitor('${safeUidAttr}', '${safeB}', '${safeNameAttr}')"></i>` : ''}
                ${!isFree ? `<i class="fa-solid fa-xmark" style="cursor:pointer; color:#ef4444; font-size:10px;" title="Remove ${safeEscape(b)}" onclick="removeBatchFromUser('${safeUidAttr}', '${safeB}', '${safeNameAttr}')"></i>` : ''}
              </span>
            `;
          }).join('');

          const addBatchOptionsHtml = `<option value="">+ Assign Batch / Monitor...</option>` +
            availableBatches.map(b => `<option value="ADD::${safeEscape(b)}">${userBatchesList.includes(b) ? '✔ In Batch: ' : '+ Assign: '}${safeEscape(b)}</option>`).join('') +
            availableBatches.map(b => `<option value="MON::${safeEscape(b)}">🎖️ Monitor: ${safeEscape(b)}</option>`).join('');

          const isEmailVer = safeEmailVer(u);
          const isMobileVer = safeMobVer(u);
          const safePassAttr = visiblePass.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
          const passwordCellHtml = visiblePass
            ? `<div style="display:flex; flex-direction:column; gap:4px; min-width:155px;">
                <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <code id="adm-pass-val-${safeEscape(uId)}" data-plain="${safePassAttr}" data-revealed="1" class="mono-num" style="font-size:11.5px; font-weight:700; color:var(--secondary); background:var(--background); padding:2px 6px; border-radius:6px; border:1px solid var(--border); user-select:all;">${safeEscape(visiblePass)}</code>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 6px; min-height:24px; font-size:10.5px;" onclick="toggleAdminRowPasswordReveal('${safeUidAttr}', this)" title="Hide / Show Session Password"><i class="fa-solid fa-eye-slash"></i></button>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 6px; min-height:24px; font-size:10.5px;" onclick="copyAdminRowPassword('${safeUidAttr}')" title="Copy Password"><i class="fa-regular fa-copy"></i></button>
                </div>
                <span style="font-size:9.5px; color:var(--success); font-weight:700;">Session reset copy (hashed in DB)</span>
                ${canEditTarget ? `<button type="button" class="btn btn-secondary btn-sm" style="padding:2px 7px; min-height:24px; font-size:10px; align-self:flex-start;" onclick="openAdminEditUserModal('${safeUidAttr}', true)"><i class="fa-solid fa-key"></i> Change</button>` : ''}
              </div>`
            : `<div style="display:flex; flex-direction:column; gap:5px; min-width:148px;">
                <span class="rp-pass-encrypted-badge" title="Passwords are stored using one-way salted SHA-256 encryption for account security and cannot be read back in plaintext. Click Reset Password to assign a new password."><i class="fa-solid fa-lock"></i> ${isPassHashed ? 'Encrypted (SHA-256)' : 'Protected (Hashed)'}</span>
                ${canEditTarget ? `<button type="button" class="btn btn-secondary btn-sm" style="padding:3px 8px; min-height:26px; font-size:10.5px; align-self:flex-start;" onclick="openAdminEditUserModal('${safeUidAttr}', true)"><i class="fa-solid fa-key"></i> Reset Password</button>` : ''}
              </div>`;

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="mono-num" style="font-weight:700; color:var(--secondary);">${safeEscape(uId)}</td>
            <td>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <strong style="color:var(--secondary); font-size:13px;">${safeEscape(uName)}</strong>
                ${monitorBatchesForUser.length > 0 ? `<span style="background:rgba(245,158,11,0.16); color:#b45309; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:800;">🎖️ Monitor</span>` : ''}
                ${hasAllAccess ? `<span style="background:rgba(16,185,129,0.15); color:#047857; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:800;">★ All-Access</span>` : ''}
                ${feeStatusLabel ? `<span style="background:rgba(79,70,229,0.1); color:#4f46e5; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:700;">${safeEscape(feeStatusLabel)}</span>` : ''}
              </div>
              <div style="font-size:10.5px; color:#0284c7; font-weight:600; margin-top:2px;">Tabs: ${safeEscape(uStudentPerms || 'ALL')}</div>
              ${parentPreviewName || parentPreviewMobile ? `<div style="font-size:10.5px; color:var(--text-muted); margin-top:2px;"><i class="fa-solid fa-user-shield" style="color:#4f46e5;"></i> Parent: ${safeEscape(parentPreviewName || uName)}${parentPreviewMobile ? ' · ' + safeEscape(parentPreviewMobile) : ''}</div>` : ''}
              <div style="font-size:10.5px; color:${isAutoFreeTier ? '#d97706' : '#059669'}; font-weight:700; margin-top:2px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span><i class="fa-solid fa-calendar-check"></i> <strong id="user-validity-badge-${safeEscape(uId)}">${safeEscape(safeGetValidity(u))}</strong></span>
                <button type="button" class="btn btn-sm btn-secondary" style="padding:1px 6px; font-size:9.5px; font-weight:700;" onclick="promptAdminQuickExtendUserValidity('${safeUidAttr}', '${safeNameAttr}')">Edit Validity</button>
              </div>
              ${uRole === 'admin' ? `<div style="font-size:10px; color:var(--primary); font-weight:700; margin-top:1px;">Admin: ${safeEscape(uPerms || 'ALL')}</div>` : ''}
            </td>
            <td style="word-break:break-all;">
              <div>${safeEscape(uEmail)}</div>
              <div style="font-size:10px; font-weight:700; margin-top:2px; color:${isEmailVer ? '#059669' : '#d97706'};">${isEmailVer ? '✓ Email Verified' : '⏳ Pending Email'}</div>
            </td>
            <td class="mono-num">
              <div>${safeEscape(uMobile)}</div>
              <div style="font-size:10px; font-weight:700; margin-top:2px; color:${isMobileVer ? '#059669' : '#d97706'};">${isMobileVer ? '✓ Mobile Verified' : '⏳ Pending Mobile'}</div>
            </td>
            <td>${passwordCellHtml}</td>
            <td style="min-width: 195px;">
              <div style="display:flex; flex-direction:column; gap:5px;">
                <div style="display:flex; flex-wrap:wrap; gap:4px; max-height:64px; overflow-y:auto;">${assignedBadgesHtml}</div>
                <select class="form-control" style="padding:3px 7px; min-height:28px; font-size:11px; font-weight:700; color:#4f46e5; background:var(--surface); border-color:rgba(79,70,229,0.28); margin:0;" onchange="if(this.value){ const v=this.value; this.value=''; if(v.startsWith('MON::')){ appointBatchMonitor(v.slice(5), '${safeUidAttr}', '${safeNameAttr}'); } else if(v.startsWith('ADD::')){ addBatchToUser('${safeUidAttr}', v.slice(5), '${safeNameAttr}'); } }">
                  ${addBatchOptionsHtml}
                </select>
              </div>
            </td>
            <td>
              <select class="form-control" style="padding:4px 8px; min-height:30px; font-size:12px; font-weight:700; margin:0;" onchange="handleUserRoleSelectChange('${safeUidAttr}', this.value, '${uStatus}', '${safeNameAttr}', '${uPerms}', '${uStudentPerms}')" ${(!isSuperAdmin && (uRole === 'admin' || uRole === 'superadmin')) ? 'disabled title="Only Superadmin can modify Admin/Superadmin roles"' : ''}>
                <option value="user" ${uRole==='user'?'selected':''}>User</option>
                <option value="member" ${uRole==='member'?'selected':''}>Member</option>
                <option value="admin" ${uRole==='admin'?'selected':''}>Admin</option>
                ${isSuperAdmin || uRole==='superadmin' ? `<option value="superadmin" ${uRole==='superadmin'?'selected':''}>Superadmin</option>` : ''}
              </select>
              ${uRole === 'member' ? (() => {
                const sc = String(u.MemberAccessScope || u.memberAccessScope || 'ALL_PAST_CURRENT_UPCOMING').toUpperCase();
                const scMap = {
                  'ALL_PAST_CURRENT_UPCOMING': 'All (Past+Curr+Upc)',
                  'ALL_EXISTING_ONLY': 'All Existing Only',
                  'CURRENT_AND_UPCOMING': 'Curr + Upcoming',
                  'CUSTOM_SELECTED': (u.MemberIncludeUpcoming ? 'Custom + Upcoming' : 'Custom Batches')
                };
                return `<div style="margin-top:4px; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <span style="font-size:10px; font-weight:800; color:#7c3aed; background:rgba(124,58,237,0.1); padding:2px 6px; border-radius:4px;">★ ${scMap[sc] || sc}</span>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 6px; font-size:10px; min-height:22px;" onclick="openAdminMemberAccessModal('${safeUidAttr}', '${safeNameAttr}')" title="Configure which batches this Member can access"><i class="fa-solid fa-sliders"></i> Scope</button>
                </div>`;
              })() : ''}
            </td>
            <td>
              <select class="form-control" style="padding:4px 8px; min-height:30px; font-size:12px; font-weight:700; margin:0; color:${uStatus==='blocked'?'var(--danger)':'#059669'};" onchange="updateUserRole('${safeUidAttr}', '${uRole}', this.value, '${uPerms}', '${uStudentPerms}')">
                <option value="active" ${uStatus==='active'?'selected':''}>Active</option>
                <option value="blocked" ${uStatus==='blocked'?'selected':''}>Blocked</option>
              </select>
            </td>
            <td>
              <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                ${canEditTarget ? `
                  <button type="button" class="btn btn-secondary btn-sm" onclick="openAdminEditUserModal('${safeUidAttr}', false)" title="Edit Name, Email, Mobile, Parent Details & Password"><i class="fa-solid fa-user-pen"></i> Edit</button>
                  <button type="button" class="btn btn-primary btn-sm" onclick="openSuperadminPermissionsModal('${safeUidAttr}', '${safeNameAttr}', '${uRole}', '${uStatus}', '${uPerms}', '${uStudentPerms}')" title="Configure Portal Tabs & Admin Subtab Access"><i class="fa-solid fa-key"></i> Tabs</button>
                ` : ''}
                ${uStatus === 'blocked'
                  ? `<button type="button" class="btn btn-success btn-sm" onclick="updateUserRole('${safeUidAttr}', '${uRole}', 'active', '${uPerms}', '${uStudentPerms}')"><i class="fa-solid fa-unlock"></i> Unblock</button>`
                  : `<button type="button" class="btn btn-danger btn-sm" onclick="updateUserRole('${safeUidAttr}', '${uRole}', 'blocked', '${uPerms}', '${uStudentPerms}')"><i class="fa-solid fa-ban"></i> Block</button>`
                }
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        } catch (rowErr) {
          console.error('renderAdminUsers row error:', rowErr);
        }
      });
      if (typeof window.enhanceAdminUsersTableWithDeviceLocks === 'function') {
        try { window.enhanceAdminUsersTableWithDeviceLocks(); } catch (e) {}
      }
    }

export function copyAdminRowPassword(userId) {
      const codeEl = document.getElementById('adm-pass-val-' + userId);
      const plain = codeEl ? (codeEl.getAttribute('data-plain') || '') : '';
      if (!plain) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plain).then(() => showToast('📋 User password copied to clipboard!')).catch(() => {});
      }
    }

export function toggleAdminRowPasswordReveal(userId, btnEl) {
      const codeEl = document.getElementById('adm-pass-val-' + userId);
      if (!codeEl) return;
      const revealed = codeEl.getAttribute('data-revealed') === '1';
      if (revealed) {
        codeEl.textContent = '••••••••';
        codeEl.setAttribute('data-revealed', '0');
        if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-eye"></i>';
      } else {
        codeEl.textContent = codeEl.getAttribute('data-plain') || '';
        codeEl.setAttribute('data-revealed', '1');
        if (btnEl) btnEl.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
      }
    }

export function openAdminEditUserModal(userId, focusPassword) {
      try {
        const list = (portalState.adminData && Array.isArray(portalState.adminData.users)) ? portalState.adminData.users.map(normalizeUserRecord) : [];
        const u = list.find(x => String(x.UserID || x.userId || '') === String(userId || ''));
        if (!u) {
          showToast('User record not found. Please reload Admin data.');
          return;
        }
        const modal = document.getElementById('admin-edit-user-modal');
        if (!modal) {
          showToast('Edit modal is unavailable in current view.');
          return;
        }
        const idIn = document.getElementById('admin-edit-user-id');
        const subEl = document.getElementById('admin-edit-user-id-subtitle');
        const nameEl = document.getElementById('admin-edit-user-name');
        const emailEl = document.getElementById('admin-edit-user-email');
        const mobEl = document.getElementById('admin-edit-user-mobile');
        const pNameEl = document.getElementById('admin-edit-user-parent-name');
        const pMobEl = document.getElementById('admin-edit-user-parent-mobile');
        const pEmailEl = document.getElementById('admin-edit-user-parent-email');
        const passInput = document.getElementById('admin-edit-user-password');
        const hint = document.getElementById('admin-edit-user-pass-hint');
        const ev = document.getElementById('admin-edit-user-email-ver');
        const mv = document.getElementById('admin-edit-user-mobile-ver');

        if (idIn) idIn.value = u.UserID || '';
        if (subEl) subEl.textContent = `UserID: ${u.UserID || '-'} · Role: ${String(u.Role || 'user').toUpperCase()}`;
        if (nameEl) nameEl.value = u.Name || '';
        if (emailEl) emailEl.value = u.Email || '';
        if (mobEl) mobEl.value = String(u.Mobile || '').replace(/[^0-9]/g, '').slice(-10);
        if (pNameEl) pNameEl.value = u.ParentName || u.parentName || u.Name || '';
        if (pMobEl) pMobEl.value = String(u.ParentMobile || u.parentMobile || u.Mobile || '').replace(/[^0-9]/g, '').slice(-10);
        if (pEmailEl) pEmailEl.value = u.ParentEmail || u.parentEmail || u.Email || '';
        if (passInput) {
          passInput.value = '';
          passInput.type = 'password';
        }
        if (hint) {
          const cached = (window.__adminSessionPasswordCache && window.__adminSessionPasswordCache[u.UserID]) || u.VisiblePassword || u.Password || '';
          hint.textContent = cached
            ? `Current password: ${cached} — enter a new password below to change it.`
            : 'Current password is encrypted (Salted SHA-256). Enter a new password below to set a visible & encrypted password.';
        }
        if (ev) {
          try { ev.checked = Boolean(u.EmailVerified === true || u.emailVerified === true || (typeof isUserEmailAlreadyVerified === 'function' && isUserEmailAlreadyVerified(u))); } catch (e) { ev.checked = false; }
        }
        if (mv) {
          try { mv.checked = Boolean(u.MobileVerified === true || u.mobileVerified === true || (typeof isUserMobileAlreadyVerified === 'function' && isUserMobileAlreadyVerified(u))); } catch (e) { mv.checked = false; }
        }
        modal.style.display = 'flex';
        setTimeout(() => {
          if (focusPassword && passInput) passInput.focus();
          else if (nameEl) nameEl.focus();
        }, 40);
      } catch (err) {
        console.error('openAdminEditUserModal error:', err);
        showToast('⚠️ Could not open Edit User modal. Please refresh and try again.');
      }
    }

export function closeAdminEditUserModal() {
      const modal = document.getElementById('admin-edit-user-modal');
      if (modal) modal.style.display = 'none';
    }

export function generateAdminUserTempPassword() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let out = 'RP@';
      for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
      const passInput = document.getElementById('admin-edit-user-password');
      if (passInput) {
        passInput.value = out;
        passInput.type = 'text';
      }
      showToast('Generated password: ' + out);
    }

export async function saveAdminEditedUserDetails() {
      const btn = document.getElementById('admin-edit-user-save-btn');
      try {
        const userId = String(document.getElementById('admin-edit-user-id')?.value || '').trim();
        const name = String(document.getElementById('admin-edit-user-name')?.value || '').trim();
        const email = String(document.getElementById('admin-edit-user-email')?.value || '').trim().toLowerCase();
        const mobile = String(document.getElementById('admin-edit-user-mobile')?.value || '').replace(/[^0-9]/g, '').slice(-10);
        const parentName = String(document.getElementById('admin-edit-user-parent-name')?.value || '').trim();
        const parentMobile = String(document.getElementById('admin-edit-user-parent-mobile')?.value || '').replace(/[^0-9]/g, '').slice(-10);
        const parentEmail = String(document.getElementById('admin-edit-user-parent-email')?.value || '').trim().toLowerCase();
        const newPassword = String(document.getElementById('admin-edit-user-password')?.value || '').trim();
        const emailVerified = Boolean(document.getElementById('admin-edit-user-email-ver')?.checked);
        const mobileVerified = Boolean(document.getElementById('admin-edit-user-mobile-ver')?.checked);

        if (!userId) return showToast('Missing User ID — please re-open the modal.');
        if (!name || name.length < 2) return showToast('Please enter a valid Full Name (at least 2 characters).');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Please enter a valid Email ID.');
        if (!/^\d{10}$/.test(mobile)) return showToast('Please enter a valid 10-digit Mobile Number.');
        if (parentMobile && !/^\d{10}$/.test(parentMobile)) return showToast('Parent Mobile must be 10 digits (or leave blank to use student mobile).');
        if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) return showToast('Please enter a valid Parent Email ID (or leave blank).');
        if (newPassword && newPassword.length < 4) return showToast('New password must be at least 4 characters long.');

        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="mini-spin"></span> Saving...'; }
        const res = await apiCall('adminUpdateUserDetails', {
          targetUserId: userId,
          name,
          email,
          mobile,
          parentName: parentName || name,
          parentMobile: parentMobile || mobile,
          parentEmail: parentEmail || email,
          newPassword: newPassword || undefined,
          emailVerified,
          mobileVerified
        });
        if (res && res.success) {
          if (newPassword) {
            window.__adminSessionPasswordCache = window.__adminSessionPasswordCache || {};
            window.__adminSessionPasswordCache[userId] = newPassword;
          }
          if (portalState.adminData && Array.isArray(portalState.adminData.users)) {
            const idx = portalState.adminData.users.findIndex(x => String(x.UserID || x.userId) === String(userId));
            if (idx !== -1) {
              portalState.adminData.users[idx] = {
                ...portalState.adminData.users[idx],
                Name: name,
                Email: email,
                Mobile: mobile,
                ParentName: parentName || name,
                ParentMobile: parentMobile || mobile,
                ParentEmail: parentEmail || email,
                Password: newPassword || portalState.adminData.users[idx].Password || '',
                VisiblePassword: newPassword || portalState.adminData.users[idx].VisiblePassword || portalState.adminData.users[idx].Password || '',
                EmailVerified: emailVerified,
                emailVerified: emailVerified,
                MobileVerified: mobileVerified,
                mobileVerified: mobileVerified,
                PasswordIsHashed: newPassword ? true : portalState.adminData.users[idx].PasswordIsHashed
              };
            }
          }
          renderAdminUsers();
          closeAdminEditUserModal();
          showToast(res.message || '✅ User & Parent details updated successfully!');
        } else {
          showToast(res?.message || 'Failed to update user details.');
        }
      } catch (err) {
        console.error('saveAdminEditedUserDetails error:', err);
        showToast('⚠️ Error saving user details. Please try again.');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save User Details'; }
      }
    }

export function handleUserRoleSelectChange(userId, newRole, status, userName, existingPerms, existingStudentPerms = 'ALL') {
      const isSuperAdmin = portalState.currentUser && String(portalState.currentUser.role || '').toLowerCase() === 'superadmin';
      if ((newRole === 'admin' || newRole === 'superadmin') && !isSuperAdmin) {
        showToast('🚫 Only Superadmin can assign Admin or Superadmin roles!');
        renderAdminUsers();
        return;
      }
      if (newRole === 'member') {
        openAdminMemberAccessModal(userId, userName);
        return;
      }
      if (newRole === 'admin' && isSuperAdmin) {
        openSuperadminPermissionsModal(userId, userName, newRole, status, existingPerms || 'ALL', existingStudentPerms || 'ALL');
      } else {
        updateUserRole(userId, newRole, status, newRole === 'superadmin' ? 'ALL' : '', existingStudentPerms || 'ALL');
      }
    }

export function openAdminMemberAccessModal(userId, userName, opts = {}) {
      const modal = document.getElementById('admin-member-access-modal');
      if (!modal) {
        showToast('Member access modal is not available in current view.');
        return;
      }
      const usersList = (portalState.adminData && Array.isArray(portalState.adminData.users)) ? portalState.adminData.users.map(normalizeUserRecord) : [];
      const u = usersList.find(x => String(x.UserID || x.userId) === String(userId)) || {};

      const idEl = document.getElementById('admin-member-access-userid');
      const receiptEl = document.getElementById('admin-member-access-receipt-no');
      const subEl = document.getElementById('admin-member-access-subtitle');
      const planSelect = document.getElementById('admin-member-plan-select');
      const validInput = document.getElementById('admin-member-valid-until');
      const checklist = document.getElementById('admin-member-batches-checklist');
      const upcCb = document.getElementById('admin-member-include-upcoming-cb');

      if (idEl) idEl.value = String(userId || '');
      if (receiptEl) receiptEl.value = String(opts.pendingReceiptNo || '');
      if (subEl) {
        subEl.textContent = opts.pendingReceiptNo
          ? `Approving Receipt ${opts.pendingReceiptNo} for ${userName || u.Name || userId} (${userId}) — choose Member Batch Access Scope`
          : `Updating ${userName || u.Name || userId} (${userId}) to Member — choose which batches this member can access`;
      }

      // Populate Member Plan preset dropdown from feeConfig.memberPlans
      const feeCfg = (typeof window.getResolvedFeeConfig === 'function')
        ? window.getResolvedFeeConfig()
        : ((portalState.adminData && portalState.adminData.feeConfig) || (portalState.globalData && portalState.globalData.feeConfig) || {});
      const memberPlans = Array.isArray(feeCfg.memberPlans) ? feeCfg.memberPlans : [];
      if (planSelect) {
        planSelect.innerHTML = `<option value="">— Custom / Manual Member Assignment —</option>` + memberPlans.map((p, idx) => {
          const label = `${p.name || 'Member Plan'} (₹${Number(p.amount || 0).toLocaleString('en-IN')} · ${p.validityDays || 365}d)`;
          return `<option value="${idx}" data-name="${String(p.name || '').replace(/"/g, '&quot;')}" data-days="${Number(p.validityDays || 365)}" data-scope="${String(p.accessScope || 'ALL_PAST_CURRENT_UPCOMING')}" data-batches="${String(p.includedBatches || '').replace(/"/g, '&quot;')}" data-upcoming="${p.includeUpcoming ? '1' : '0'}">${label}</option>`;
        }).join('');
        const targetPlanName = String(opts.planName || u.MembershipPlan || u.membershipPlan || '').trim().toLowerCase();
        if (targetPlanName) {
          const matchIdx = memberPlans.findIndex(p => String(p.name || '').trim().toLowerCase() === targetPlanName);
          if (matchIdx >= 0) planSelect.value = String(matchIdx);
        }
      }

      // Default validity date
      const defaultDays = Number(opts.validityDays || 365) || 365;
      let existingValid = String(u.MembershipValidUntil || u.membershipValidUntil || '').trim();
      if (!existingValid || opts.pendingReceiptNo) {
        const dt = new Date(Date.now() + defaultDays * 86400000);
        existingValid = dt.toISOString().slice(0, 10);
      }
      if (validInput) validInput.value = existingValid.slice(0, 10);

      // Populate custom batches checklist
      const allBatches = (typeof getInstituteBatchesList === 'function' ? getInstituteBatchesList() : [])
        .filter(b => b && b.toLowerCase() !== 'rp-trail' && b.toLowerCase() !== 'general batch' && b.toLowerCase() !== 'free tier');
      const existingIncluded = String(opts.includedBatches || u.MemberIncludedBatches || u.memberIncludedBatches || '')
        .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (checklist) {
        if (allBatches.length === 0) {
          checklist.innerHTML = '<div style="font-size:12px; color:var(--text-muted); padding:6px;">No custom batches created yet. Only permanent free batch <strong>RP-Trail</strong> exists.</div>';
        } else {
          checklist.innerHTML = allBatches.map(b => {
            const checked = existingIncluded.includes(b.toLowerCase()) ? 'checked' : '';
            const safeB = b.replace(/"/g, '&quot;');
            return `<label style="display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:8px; border:1px solid var(--border); background:var(--surface); font-size:12px; font-weight:700; cursor:pointer;">
              <input type="checkbox" class="adm-member-custom-batch-cb" value="${safeB}" ${checked}> ${b}
            </label>`;
          }).join('');
        }
      }

      const initScope = String(opts.accessScope || u.MemberAccessScope || u.memberAccessScope || 'ALL_PAST_CURRENT_UPCOMING').toUpperCase();
      const radios = modal.querySelectorAll('input[name="admin-member-scope-mode"]');
      let matchedRadio = false;
      radios.forEach(r => {
        r.checked = (r.value === initScope);
        if (r.checked) matchedRadio = true;
      });
      if (!matchedRadio && radios[0]) radios[0].checked = true;

      if (upcCb) {
        upcCb.checked = opts.includeUpcoming !== undefined
          ? Boolean(opts.includeUpcoming)
          : Boolean(u.MemberIncludeUpcoming || u.memberIncludeUpcoming || initScope === 'ALL_PAST_CURRENT_UPCOMING' || initScope === 'CURRENT_AND_UPCOMING');
      }

      onAdminMemberScopeRadioChange();
      modal.style.display = 'flex';
    }

export function onAdminMemberPlanPresetChange() {
      const sel = document.getElementById('admin-member-plan-select');
      if (!sel || sel.value === '') return;
      const opt = sel.options[sel.selectedIndex];
      if (!opt) return;
      const days = Math.max(1, Number(opt.getAttribute('data-days') || 365) || 365);
      const scope = String(opt.getAttribute('data-scope') || 'ALL_PAST_CURRENT_UPCOMING').toUpperCase();
      const batches = String(opt.getAttribute('data-batches') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const upcoming = opt.getAttribute('data-upcoming') === '1';

      const validInput = document.getElementById('admin-member-valid-until');
      if (validInput) {
        const dt = new Date(Date.now() + days * 86400000);
        validInput.value = dt.toISOString().slice(0, 10);
      }
      document.querySelectorAll('input[name="admin-member-scope-mode"]').forEach(r => {
        r.checked = (r.value === scope);
      });
      document.querySelectorAll('.adm-member-custom-batch-cb').forEach(cb => {
        cb.checked = batches.includes(String(cb.value || '').trim().toLowerCase());
      });
      const upcCb = document.getElementById('admin-member-include-upcoming-cb');
      if (upcCb) upcCb.checked = upcoming || scope === 'ALL_PAST_CURRENT_UPCOMING' || scope === 'CURRENT_AND_UPCOMING';
      onAdminMemberScopeRadioChange();
    }

export function onAdminMemberScopeRadioChange() {
      const selected = document.querySelector('input[name="admin-member-scope-mode"]:checked');
      const val = selected ? selected.value : 'ALL_PAST_CURRENT_UPCOMING';
      const customBox = document.getElementById('admin-member-custom-batches-box');
      if (customBox) {
        customBox.style.display = (val === 'CUSTOM_SELECTED' || val === 'CURRENT_AND_UPCOMING') ? 'flex' : 'none';
      }
      document.querySelectorAll('#admin-member-access-modal .rp-scope-option-card').forEach(card => {
        const r = card.querySelector('input[type="radio"]');
        card.classList.toggle('is-selected', Boolean(r && r.checked));
      });
    }

export function closeAdminMemberAccessModal(reRenderUsers = true) {
      const modal = document.getElementById('admin-member-access-modal');
      if (modal) modal.style.display = 'none';
      if (reRenderUsers && typeof renderAdminUsers === 'function') renderAdminUsers();
    }

export async function saveAdminMemberAccessModal() {
      const btn = document.getElementById('admin-member-access-save-btn');
      const userId = String(document.getElementById('admin-member-access-userid')?.value || '').trim();
      const pendingReceiptNo = String(document.getElementById('admin-member-access-receipt-no')?.value || '').trim();
      const planSelect = document.getElementById('admin-member-plan-select');
      const selectedPlanOpt = planSelect && planSelect.value !== '' ? planSelect.options[planSelect.selectedIndex] : null;
      const planName = selectedPlanOpt ? (selectedPlanOpt.getAttribute('data-name') || 'Member Plan') : 'Member Access Pass';
      const validUntil = String(document.getElementById('admin-member-valid-until')?.value || '').trim();
      const selectedRadio = document.querySelector('input[name="admin-member-scope-mode"]:checked');
      const accessScope = selectedRadio ? selectedRadio.value : 'ALL_PAST_CURRENT_UPCOMING';
      const includeUpcoming = accessScope === 'ALL_PAST_CURRENT_UPCOMING' || accessScope === 'CURRENT_AND_UPCOMING'
        ? true
        : Boolean(document.getElementById('admin-member-include-upcoming-cb')?.checked);
      const selectedBatches = Array.from(document.querySelectorAll('.adm-member-custom-batch-cb:checked')).map(cb => cb.value).filter(Boolean);

      if (!userId) return showToast('Missing User ID.');
      if (accessScope === 'CUSTOM_SELECTED' && selectedBatches.length === 0 && !includeUpcoming) {
        return showToast('Please select at least one batch or enable "Also auto-grant all Upcoming/Future Batches".');
      }

      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="mini-spin"></span> Saving...'; }
      try {
        let res;
        if (pendingReceiptNo) {
          res = await apiCall('verifyFeePayment', {
            receiptNo: pendingReceiptNo,
            decision: 'approve',
            remarks: `Approved (${accessScope})`,
            memberAccessScope: accessScope,
            memberIncludedBatches: selectedBatches.join(', '),
            memberIncludeUpcoming: includeUpcoming,
            membershipValidUntil: validUntil,
            membershipPlan: planName
          });
        } else {
          res = await apiCall('updateMemberAccessScope', {
            targetUserId: userId,
            memberAccessScope: accessScope,
            memberIncludedBatches: selectedBatches.join(', '),
            memberIncludeUpcoming: includeUpcoming,
            membershipPlan: planName,
            membershipValidUntil: validUntil
          });
        }

        if (res && res.success) {
          if (portalState.adminData && Array.isArray(portalState.adminData.users)) {
            const idx = portalState.adminData.users.findIndex(x => String(x.UserID || x.userId) === userId);
            if (idx !== -1) {
              portalState.adminData.users[idx] = {
                ...portalState.adminData.users[idx],
                Role: 'member',
                role: 'member',
                IsMemberAllAccess: accessScope === 'ALL_PAST_CURRENT_UPCOMING',
                isMemberAllAccess: accessScope === 'ALL_PAST_CURRENT_UPCOMING',
                MembershipPlan: planName,
                membershipPlan: planName,
                MembershipValidUntil: validUntil || portalState.adminData.users[idx].MembershipValidUntil || '',
                membershipValidUntil: validUntil || portalState.adminData.users[idx].membershipValidUntil || '',
                MemberAccessScope: accessScope,
                memberAccessScope: accessScope,
                MemberIncludedBatches: selectedBatches.join(', '),
                memberIncludedBatches: selectedBatches.join(', '),
                MemberIncludeUpcoming: includeUpcoming,
                memberIncludeUpcoming: includeUpcoming
              };
            }
          }
          closeAdminMemberAccessModal(false);
          renderAdminUsers();
          if (pendingReceiptNo && typeof window.renderAdminFeesManager === 'function') {
            window.renderAdminFeesManager(true);
          }
          showToast(res.message || '✅ Member role & batch access scope saved!');
        } else {
          showToast((res && res.message) || 'Failed to save member batch access scope.');
        }
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Save Member &amp; Batch Access'; }
      }
    }

window.openAdminMemberAccessModal = openAdminMemberAccessModal;

window.closeAdminMemberAccessModal = closeAdminMemberAccessModal;

window.onAdminMemberScopeRadioChange = onAdminMemberScopeRadioChange;

window.onAdminMemberPlanPresetChange = onAdminMemberPlanPresetChange;

window.saveAdminMemberAccessModal = saveAdminMemberAccessModal;

export function openSuperadminPermissionsModal(userId, userName, role, status, permsStr = 'ALL', studentPermsStr = 'ALL') {
      const modal = document.getElementById('superadmin-permissions-modal');
      if (!modal) return;
      document.getElementById('superadmin-perm-target-userid').value = userId;
      document.getElementById('superadmin-perm-target-role').value = role || 'user';
      document.getElementById('superadmin-perm-target-status').value = status || 'active';

      const roleLower = String(role || 'user').toLowerCase();
      const label = document.getElementById('superadmin-perm-user-label');
      if (label) {
        label.innerText = `Configure All Portal Navigation Tabs & Admin Panel Subtab Permissions for: ${userName || userId} (${roleLower.toUpperCase()})`;
      }

      // 1. Populate all Student / Portal Navigation Tabs
      const allStudentTabs = ALL_STUDENT_PORTAL_TABS;
      const isStudentAll = !studentPermsStr || String(studentPermsStr).toUpperCase() === 'ALL';
      const studentList = isStudentAll
        ? allStudentTabs
        : String(studentPermsStr).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

      document.querySelectorAll('.student-portal-tab-chk').forEach(chk => {
        chk.checked = studentList.includes(chk.value.toLowerCase());
      });

      // 2. Populate all 15 Admin Panel Subtabs
      const allAdminTabs = ['analytics', 'batch-discussion', 'content', 'livetests', 'users', 'fees', 'attendance-matrix', 'outline-replies', 'logs', 'subtabs', 'evaluation', 'banner', 'leaderboard', 'feedback-admin', 'enterprise-ops'];
      const isAdminAll = !permsStr || String(permsStr).toUpperCase() === 'ALL';
      const adminList = isAdminAll
        ? allAdminTabs
        : String(permsStr).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

      const isAdminRole = roleLower === 'admin' || roleLower === 'superadmin';
      const adminSec = document.getElementById('superadmin-perm-admin-subtabs-section');
      if (adminSec) {
        adminSec.style.opacity = isAdminRole ? '1' : '0.65';
      }

      document.querySelectorAll('.admin-perm-chk').forEach(chk => {
        chk.checked = isAdminRole ? adminList.includes(chk.value.toLowerCase()) : false;
      });

      modal.style.display = 'flex';
    }

export async function saveSuperadminPermissionsModal() {
      const userId = document.getElementById('superadmin-perm-target-userid').value;
      const role = document.getElementById('superadmin-perm-target-role').value || 'user';
      const status = document.getElementById('superadmin-perm-target-status').value || 'active';
      const roleLower = String(role || 'user').toLowerCase();

      const selectedStudentTabs = [];
      const totalStudentCheckboxes = document.querySelectorAll('.student-portal-tab-chk').length || 11;
      document.querySelectorAll('.student-portal-tab-chk').forEach(chk => {
        if (chk.checked) selectedStudentTabs.push(chk.value);
      });

      if (selectedStudentTabs.length === 0) {
        showToast('⚠️ Please select at least one Student / Portal Navigation Tab.');
        return;
      }

      const selectedAdminSubtabs = [];
      const totalAdminCheckboxes = document.querySelectorAll('.admin-perm-chk').length || 11;
      document.querySelectorAll('.admin-perm-chk').forEach(chk => {
        if (chk.checked) selectedAdminSubtabs.push(chk.value);
      });

      if ((roleLower === 'admin' || roleLower === 'superadmin') && selectedAdminSubtabs.length === 0) {
        showToast('⚠️ Please select at least one Admin Panel Subtab permission for this Admin.');
        return;
      }

      const studentPermsStr = selectedStudentTabs.length >= totalStudentCheckboxes ? 'ALL' : selectedStudentTabs.join(',');
      const adminPermsStr = (roleLower === 'admin' || roleLower === 'superadmin')
        ? (selectedAdminSubtabs.length >= totalAdminCheckboxes ? 'ALL' : selectedAdminSubtabs.join(','))
        : (selectedAdminSubtabs.length > 0 ? selectedAdminSubtabs.join(',') : '');

      document.getElementById('superadmin-permissions-modal').style.display = 'none';
      await updateUserRole(userId, role, status, adminPermsStr, studentPermsStr);
    }

export function paginateAdminUsers(direction) {
      let users = (portalState.adminData && Array.isArray(portalState.adminData.users)) ? portalState.adminData.users.map(normalizeUserRecord) : [];
      const searchInput = document.getElementById('admin-search-users');
      const roleFilterSelect = document.getElementById('admin-filter-user-role');
      const statusFilterSelect = document.getElementById('admin-filter-user-status');
      const batchFilterSelect = document.getElementById('admin-filter-user-batch');

      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const activeRole = roleFilterSelect ? roleFilterSelect.value : 'ALL';
      const activeStatus = statusFilterSelect ? statusFilterSelect.value : 'ALL';
      const activeBatch = batchFilterSelect ? batchFilterSelect.value : 'ALL';

      if (search) {
        users = users.filter(u => 
          String(u.Name || '').toLowerCase().includes(search) ||
          String(u.Email || '').toLowerCase().includes(search) ||
          String(u.Mobile || '').toLowerCase().includes(search) ||
          String(u.UserID || '').toLowerCase().includes(search)
        );
      }
      if (activeRole !== 'ALL') {
        users = users.filter(u => String(u.Role || '').toLowerCase() === activeRole.toLowerCase());
      }
      if (activeStatus !== 'ALL') {
        users = users.filter(u => String(u.Status || '').toLowerCase() === activeStatus.toLowerCase());
      }
      if (activeBatch === 'MONITORS_ONLY') {
        users = users.filter(u => getUserMonitorBatchesList(u.UserID).length > 0);
      } else if (activeBatch !== 'ALL') {
        users = users.filter(u => userHasBatchAssigned(u.UserID, activeBatch, u.Batch || u.batch));
      }

      const totalPages = Math.ceil(users.length / ADMIN_USERS_PER_PAGE) || 1;

      if (direction === 1 && portalState.currentAdminUserPage < totalPages) {
        portalState.currentAdminUserPage++;
      } else if (direction === -1 && portalState.currentAdminUserPage > 1) {
        portalState.currentAdminUserPage--;
      }
      renderAdminUsers();
    }

export async function updateUserRole(userId, role, status, adminPermissions = 'ALL', studentTabPermissions = 'ALL') {
      if (typeof logPortalAction === 'function') {
        logPortalAction('USER_PERMISSION_CHANGE', `Updated User ${userId} -> Role: ${role.toUpperCase()}, Status: ${status.toUpperCase()}, AdminTabs: ${adminPermissions || 'ALL'}, PortalTabs: ${studentTabPermissions || 'ALL'}`);
      }
      if (portalState.adminData && Array.isArray(portalState.adminData.users)) {
        const target = portalState.adminData.users.find(u => String(u.UserID) === String(userId));
        if (target) {
          target.Role = role;
          target.Status = status;
          target.AdminPermissions = adminPermissions;
          target.StudentTabPermissions = studentTabPermissions;
          target.studentTabPermissions = studentTabPermissions;
        }
      }
      if (portalState.currentUser && String(portalState.currentUser.userId) === String(userId)) {
        portalState.currentUser.role = role;
        portalState.currentUser.adminPermissions = adminPermissions;
        portalState.currentUser.studentTabPermissions = studentTabPermissions;
        portalState.currentUser.StudentTabPermissions = studentTabPermissions;
        localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser));
        setupAuthenticatedUI();
      }
      renderAdminUsers();
      if (typeof renderHelpAdminContacts === 'function') renderHelpAdminContacts();

      // Immediately broadcast block / unblock across all open tabs & sessions so blocked users are logged out on the spot
      try {
        const blockedMap = JSON.parse(localStorage.getItem('rp_blocked_users_map') || '{}');
        if (String(status).toLowerCase() === 'blocked') {
          blockedMap[String(userId)] = { blockedAt: Date.now(), reason: 'Blocked by Administrator' };
          localStorage.setItem('rp_blocked_users_map', JSON.stringify(blockedMap));
          if (singleSessionChannel) {
            singleSessionChannel.postMessage({ type: 'USER_BLOCKED_IMMEDIATELY', userId: String(userId) });
          }
          if (portalState.currentUser && String(portalState.currentUser.userId) === String(userId)) {
            forceSingleDeviceLogout('🚫 Your account has been blocked by the Administrator. You have been logged out immediately.', true);
            return;
          }
        } else {
          delete blockedMap[String(userId)];
          localStorage.setItem('rp_blocked_users_map', JSON.stringify(blockedMap));
        }
      } catch (e) {}

      const res = await apiCall('updateUserRoleStatus', {
        requesterId: portalState.currentUser ? portalState.currentUser.userId : '',
        targetUserId: userId,
        newRole: role,
        newStatus: status,
        adminPermissions: adminPermissions,
        studentTabPermissions: studentTabPermissions
      });
      showToast(String(status).toLowerCase() === 'blocked'
        ? `🚫 User ${userId} blocked & immediately logged out from all active sessions!`
        : (res.message || `Updated ${userId} permissions & role (${role.toUpperCase()})`));
      if (res.success) loadAdminData();
    }

export const ADMIN_LOGS_PER_PAGE = 30;

export function getFilteredAdminLogs() {
      const rawLogs = (portalState.adminData && Array.isArray(portalState.adminData.logs)) ? portalState.adminData.logs : [];
      const searchEl = document.getElementById('admin-search-logs');
      const typeFilterEl = document.getElementById('admin-filter-log-type');
      const search = searchEl ? searchEl.value.toLowerCase().trim() : '';
      const typeFilter = typeFilterEl ? typeFilterEl.value.toUpperCase().trim() : 'ALL';

      return rawLogs.filter(l => {
        if (typeFilter !== 'ALL') {
          const act = String(l.ActivityType || '').toUpperCase();
          if (typeFilter === 'TEST_GIVEN') {
            if (!act.includes('TEST') && !act.includes('CBT') && !act.includes('SUBMIT')) return false;
          } else if (typeFilter === 'LOGIN') {
            if (!act.includes('LOGIN') && !act.includes('LOGOUT') && !act.includes('SESSION')) return false;
          } else if (!act.includes(typeFilter)) {
            return false;
          }
        }
        if (search) {
          const hay = `${l.LogID || ''} ${l.UserName || ''} ${l.UserID || ''} ${l.ActivityType || ''} ${l.Details || ''} ${l.Timestamp || ''}`.toLowerCase();
          return hay.includes(search);
        }
        return true;
      });
    }

export function renderAdminLogs() {
      const tbody = document.getElementById('admin-logs-tbody');
      const pageIndicator = document.getElementById('logs-page-indicator');
      const violationEl = document.getElementById('admin-violation-count');
      if (violationEl && portalState.adminData && Array.isArray(portalState.adminData.logs)) {
        const vCount = portalState.adminData.logs.filter(l => String(l.ActivityType || '').toUpperCase().includes('VIOLATION') || String(l.ActivityType || '').toUpperCase().includes('SESSION_CONFLICT')).length;
        violationEl.innerText = String(vCount);
      }
      if (!tbody) return;
      tbody.innerHTML = '';
      
      const logs = getFilteredAdminLogs();

      const totalPages = Math.ceil(logs.length / ADMIN_LOGS_PER_PAGE) || 1;
      if (portalState.logsPage > totalPages) portalState.logsPage = totalPages;
      if (portalState.logsPage < 1) portalState.logsPage = 1;

      if (pageIndicator) {
        pageIndicator.innerText = `Page ${portalState.logsPage} of ${totalPages} (${logs.length} total logs)`;
      }

      const startIndex = (portalState.logsPage - 1) * ADMIN_LOGS_PER_PAGE;
      const paginatedLogs = logs.slice(startIndex, startIndex + ADMIN_LOGS_PER_PAGE);

      if (paginatedLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No security or activity logs match your filter.</td></tr>`;
        return;
      }

      paginatedLogs.forEach(l => {
        const tr = document.createElement('tr');
        const tsDisplay = l.Timestamp ? new Date(l.Timestamp).toLocaleString() : '';
        tr.innerHTML = `
          <td><code>${escapeHtml(l.LogID || '')}</code></td>
          <td><strong>${escapeHtml(l.UserName || '')}</strong></td>
          <td><span class="subtab-badge">${escapeHtml(l.ActivityType || '')}</span></td>
          <td>${escapeHtml(l.Details || '')}</td>
          <td>${escapeHtml(tsDisplay)}</td>
        `;
        tbody.appendChild(tr);
      });
    }

export function paginateLogs(direction) {
      const logs = getFilteredAdminLogs();
      const totalPages = Math.ceil(logs.length / ADMIN_LOGS_PER_PAGE) || 1;

      if (typeof portalState.logsPage === 'undefined') portalState.logsPage = 1;

      if (direction === 1 && portalState.logsPage < totalPages) {
        portalState.logsPage++;
      } else if (direction === -1 && portalState.logsPage > 1) {
        portalState.logsPage--;
      }
      renderAdminLogs();
    }

export function exportAdminLogsToCSV() {
      const logs = getFilteredAdminLogs();
      if (!logs || logs.length === 0) {
        showToast('No security or activity logs available to export.');
        return;
      }
      if (typeof logPortalAction === 'function') {
        logPortalAction('EXPORT_LOGS_CSV', `Exported ${logs.length} audit log records to CSV`);
      }
      const headers = ['LogID', 'UserID', 'UserName', 'ActivityType', 'Details', 'Timestamp'];
      const escapeCsv = (val) => {
        const s = String(val ?? '').replace(/"/g, '""');
        return `"${s}"`;
      };
      const rows = logs.map(l => [
        escapeCsv(l.LogID || ''),
        escapeCsv(l.UserID || ''),
        escapeCsv(l.UserName || ''),
        escapeCsv(l.ActivityType || ''),
        escapeCsv(l.Details || ''),
        escapeCsv(l.Timestamp ? new Date(l.Timestamp).toISOString() : '')
      ].join(','));

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RP_Skill_Security_Audit_Logs_${getLocalDateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`✅ Exported ${logs.length} audit logs to CSV!`);
    }

export function getFilteredAdminFeedbackList() {
  const rawFeedback = portalState.adminData ? (portalState.adminData.feedback || portalState.adminData.feedbackList || []) : [];
  if (!Array.isArray(rawFeedback)) return [];

  let feedbackList = [...rawFeedback];
  const searchInput = document.getElementById('admin-search-feedback');
  const statusFilterSelect = document.getElementById('admin-filter-feedback-status');
  const catFilterSelect = document.getElementById('admin-filter-feedback-category');

  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const statusFilter = statusFilterSelect ? statusFilterSelect.value : 'ALL';
  const catFilter = catFilterSelect ? catFilterSelect.value : 'ALL';

  if (search) {
    feedbackList = feedbackList.filter(f => {
      const user = String(f.UserName || f.userName || f.user || '').toLowerCase();
      const msg = String(f.Message || f.message || '').toLowerCase();
      const cat = String(f.Category || f.category || '').toLowerCase();
      const id = String(f.ID || f.id || '').toLowerCase();
      return user.includes(search) || msg.includes(search) || cat.includes(search) || id.includes(search);
    });
  }

  if (catFilter !== 'ALL') {
    feedbackList = feedbackList.filter(f =>
      String(f.Category || f.category || '').toLowerCase().includes(catFilter.toLowerCase())
    );
  }

  if (statusFilter === 'replied') {
    feedbackList = feedbackList.filter(f => {
      const resp = f.AdminResponse || f.adminResponse || f.response;
      return resp && String(resp).trim() !== '' && String(resp).trim() !== '-';
    });
  } else if (statusFilter === 'pending') {
    feedbackList = feedbackList.filter(f => {
      const resp = f.AdminResponse || f.adminResponse || f.response;
      return !resp || String(resp).trim() === '' || String(resp).trim() === '-';
    });
  }

  return feedbackList;
}

export function renderAdminFeedback() {
  const tbody = document.getElementById('admin-feedback-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const rawFeedback = portalState.adminData ? (portalState.adminData.feedback || portalState.adminData.feedbackList || []) : [];
  const totalAll = Array.isArray(rawFeedback) ? rawFeedback.length : 0;
  const repliedAll = Array.isArray(rawFeedback)
    ? rawFeedback.filter(f => {
        const r = f.AdminResponse || f.adminResponse || f.response;
        return r && String(r).trim() !== '' && String(r).trim() !== '-';
      }).length
    : 0;
  const pendingAll = Math.max(0, totalAll - repliedAll);
  const resRate = totalAll > 0 ? Math.round((repliedAll / totalAll) * 100) : 100;

  // Populate KPI Strip (Requirement #11)
  const kpiTotal = document.getElementById('adm-fb-kpi-total');
  const kpiPending = document.getElementById('adm-fb-kpi-pending');
  const kpiReplied = document.getElementById('adm-fb-kpi-replied');
  const kpiRate = document.getElementById('adm-fb-kpi-rate');
  if (kpiTotal) kpiTotal.innerText = String(totalAll);
  if (kpiPending) kpiPending.innerText = String(pendingAll);
  if (kpiReplied) kpiReplied.innerText = String(repliedAll);
  if (kpiRate) kpiRate.innerText = `${resRate}%`;

  if (totalAll === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">No student feedback or support tickets submitted yet.</td></tr>`;
    return;
  }

  const feedbackList = getFilteredAdminFeedbackList();
  const ADMIN_FEEDBACK_PER_PAGE = 30;
  const totalPages = Math.ceil(feedbackList.length / ADMIN_FEEDBACK_PER_PAGE) || 1;
  
  if (typeof portalState.currentAdminFeedbackPage === 'undefined') portalState.currentAdminFeedbackPage = 1;
  if (portalState.currentAdminFeedbackPage > totalPages) portalState.currentAdminFeedbackPage = totalPages;
  if (portalState.currentAdminFeedbackPage < 1) portalState.currentAdminFeedbackPage = 1;

  const startIndex = (portalState.currentAdminFeedbackPage - 1) * ADMIN_FEEDBACK_PER_PAGE;
  const paginatedFeedback = feedbackList.slice(startIndex, startIndex + ADMIN_FEEDBACK_PER_PAGE);

  const pageIndicator = document.getElementById('admin-feedback-page-indicator');
  if (pageIndicator) {
    pageIndicator.innerText = `Page ${portalState.currentAdminFeedbackPage} of ${totalPages} (${feedbackList.length} matching feedbacks)`;
  }

  if (paginatedFeedback.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">No feedback records match your active filters.</td></tr>`;
    return;
  }

  paginatedFeedback.forEach(f => {
    const feedbackId = String(f.ID || f.id || '');
    const userName = String(f.UserName || f.userName || f.user || 'Student');
    const category = String(f.Category || f.category || 'General');
    const message = String(f.Message || f.message || '');
    const rawDate = f.SubmittedDate || f.submittedDate || f.date;
    
    let formattedDate = '-';
    if (rawDate) {
      try {
        formattedDate = new Date(rawDate).toLocaleDateString();
      } catch (e) {
        formattedDate = String(rawDate).split('T')[0];
      }
    }

    const rawResp = f.AdminResponse || f.adminResponse || f.response || '';
    const adminResponse = (String(rawResp).trim() !== '-' && String(rawResp).trim() !== '') ? String(rawResp).trim() : '';
    const safeIdJs = escapeHtml(feedbackId.replace(/\\/g, '\\\\').replace(/'/g, "\\'"));

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
      <td class="mono-num" style="padding:10px; font-weight:700; color:var(--secondary);"><code>${escapeHtml(feedbackId)}</code></td>
      <td style="padding:10px; font-weight:700; color:var(--secondary);">${escapeHtml(userName)}</td>
      <td style="padding:10px;"><span class="subtab-badge">${escapeHtml(category)}</span></td>
      <td style="padding:10px; max-width:320px; line-height:1.45;">${escapeHtml(message)}</td>
      <td class="mono-num" style="padding:10px; font-size:11.5px; color:var(--text-muted);">${escapeHtml(formattedDate)}</td>
      <td style="padding:10px; max-width:260px;">
        ${adminResponse
          ? `<div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); color:#059669; padding:6px 10px; border-radius:8px; font-size:11.5px; font-weight:700;"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(adminResponse)}</div>`
          : `<span style="background:rgba(245,158,11,0.14); color:#d97706; padding:3px 9px; border-radius:999px; font-size:11px; font-weight:800;">⏳ Pending Reply</span>`
        }
      </td>
      <td style="padding:10px;">
        <button type="button" class="btn btn-sm ${adminResponse ? 'btn-secondary' : 'btn-primary'}" onclick="promptAdminReply('${safeIdJs}')">
          <i class="fa-solid fa-reply"></i> ${adminResponse ? 'Edit Reply' : 'Reply'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

export function paginateAdminFeedback(direction) {
      const feedbackList = getFilteredAdminFeedbackList();
      const ADMIN_FEEDBACK_PER_PAGE = 30;
      const totalPages = Math.ceil(feedbackList.length / ADMIN_FEEDBACK_PER_PAGE) || 1;

      if (typeof portalState.currentAdminFeedbackPage === 'undefined') portalState.currentAdminFeedbackPage = 1;

      if (direction === 1 && portalState.currentAdminFeedbackPage < totalPages) {
        portalState.currentAdminFeedbackPage++;
      } else if (direction === -1 && portalState.currentAdminFeedbackPage > 1) {
        portalState.currentAdminFeedbackPage--;
      }
      renderAdminFeedback();
    }

export function promptAdminReply(feedbackId) {
      const rawFeedback = portalState.adminData ? (portalState.adminData.feedback || portalState.adminData.feedbackList || []) : [];
      const item = Array.isArray(rawFeedback) ? rawFeedback.find(f => String(f.ID || f.id) === String(feedbackId)) : null;
      const drawer = document.getElementById('admin-feedback-reply-drawer');
      const targetIdEl = document.getElementById('adm-fb-reply-id-input') || document.getElementById('admin-feedback-reply-target-id');
      const badgeEl = document.getElementById('adm-fb-reply-target-badge');
      const metaEl = document.getElementById('adm-fb-reply-student-msg') || document.getElementById('admin-feedback-reply-meta');
      const inputEl = document.getElementById('adm-fb-reply-textarea') || document.getElementById('admin-feedback-reply-input');

      if (!drawer || !targetIdEl || !inputEl) return;
      targetIdEl.value = feedbackId;
      if (badgeEl) badgeEl.innerText = `(#${feedbackId})`;
      const existingResp = item ? String(item.AdminResponse || item.adminResponse || item.response || '') : '';
      inputEl.value = (existingResp && existingResp !== '-') ? existingResp : '';
      if (metaEl) {
        metaEl.innerText = item
          ? `Student: ${item.UserName || item.userName || 'Student'} • Category: ${item.Category || 'General'} — "${String(item.Message || item.message || '')}"`
          : `Ticket #${feedbackId}`;
      }
      drawer.style.display = 'block';
      drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      inputEl.focus();
    }

export async function submitAdminFeedbackInlineReply() {
      const targetIdEl = document.getElementById('adm-fb-reply-id-input') || document.getElementById('admin-feedback-reply-target-id');
      const inputEl = document.getElementById('adm-fb-reply-textarea') || document.getElementById('admin-feedback-reply-input');
      const drawer = document.getElementById('admin-feedback-reply-drawer');
      const feedbackId = targetIdEl ? targetIdEl.value.trim() : '';
      const replyText = inputEl ? inputEl.value.trim() : '';

      if (!feedbackId || !replyText) {
        showToast('⚠️ Please enter an official response before sending.');
        if (inputEl) inputEl.focus();
        return;
      }

      const res = await apiCall('adminReplyFeedback', {
        feedbackId: feedbackId,
        adminResponse: replyText
      });

      if (portalState.adminData && Array.isArray(portalState.adminData.feedback)) {
        const found = portalState.adminData.feedback.find(f => String(f.ID || f.id) === String(feedbackId));
        if (found) found.AdminResponse = replyText;
      }
      if (drawer) drawer.style.display = 'none';
      renderAdminFeedback();
      showToast(res.message || '✅ Official reply saved and published to student!');
      if (res.success) loadAdminData();
    }

export function exportAdminFeedbacksCSV() {
      const list = getFilteredAdminFeedbackList();
      if (!list || list.length === 0) {
        showToast('⚠️ No feedback records available to export.');
        return;
      }
      const headers = ['FeedbackID', 'UserName', 'Category', 'Message', 'SubmittedDate', 'AdminResponse'];
      const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const rows = list.map(f => [
        escapeCsv(f.ID || f.id || ''),
        escapeCsv(f.UserName || f.userName || ''),
        escapeCsv(f.Category || f.category || ''),
        escapeCsv(f.Message || f.message || ''),
        escapeCsv(f.SubmittedDate || f.submittedDate || f.date || ''),
        escapeCsv(f.AdminResponse || f.adminResponse || 'Pending')
      ].join(','));
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RP_Skill_Feedback_Support_${getLocalDateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`✅ Exported ${list.length} feedback records to CSV!`);
    }

export function populateUploadCbtEvalRulesDropdown(selectedKey = '') {
      const sel = document.getElementById('adm-upload-cbt-eval-rule');
      if (!sel) return;

      const cbtKeys = Object.keys(portalState.allEvaluationRules || {}).filter(k => {
        if (k === 'default' || k === 'ephemeral_learning_once') return false;
        const r = portalState.allEvaluationRules[k] || {};
        return (r.tabType && r.tabType.toLowerCase() === 'cbttest') || k === 'cbttest' || k.startsWith('cbttest_');
      });

      const currentVal = selectedKey || sel.value || '';
      sel.innerHTML = '';

      if (cbtKeys.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.innerText = 'No evaluation rule is there';
        sel.appendChild(opt);
      } else {
        sel.innerHTML = '<option value="">-- Select Set CBT Evaluation Rule & Exam Pattern --</option>';
        cbtKeys.forEach(k => {
          const r = portalState.allEvaluationRules[k] || {};
          const name = r.examDisplayName || k.replace(/^cbttest_?/, '').replace(/_/g, ' ') || k;
          const timerBadge = (r.cbtTimerMode === 'sectional') ? `Sectional Timer (${r.cbtPerSectionTiming || r.cbtDefaultSectionTime || 15}m/sec)` : `Full Timer (${r.timeLimit || 60}m)`;
          const opt = document.createElement('option');
          opt.value = k;
          opt.innerText = `${name} [ +${r.cbtCorrectMarks ?? 1} / -${r.cbtWrongMarks ?? 0.25} | Pass: ${r.cbtPassingMarks ?? r.passingMarks ?? 40} | ${r.cbtNumSections || 4} Sec × ${r.cbtQuestionsPerSection || 25} Qs | ${timerBadge} ]`;
          sel.appendChild(opt);
        });
      }

      if (currentVal && cbtKeys.includes(currentVal)) {
        sel.value = currentVal;
      } else if (cbtKeys.length > 0) {
        sel.value = cbtKeys[0];
      }
      previewUploadSelectedCbtEvalRule(sel.value);
    }

export function previewUploadSelectedCbtEvalRule(ruleKey) {
      const previewEl = document.getElementById('adm-upload-cbt-eval-rule-preview');
      if (!previewEl) return;
      if (!ruleKey || !portalState.allEvaluationRules[ruleKey]) {
        previewEl.innerHTML = `<span style="color:#dc2626; font-weight:800;"><i class="fa-solid fa-triangle-exclamation"></i> No evaluation rule is there</span>`;
        return;
      }
      const r = portalState.allEvaluationRules[ruleKey] || {};
      const secGroups = Array.isArray(r.cbtSectionGroups) ? r.cbtSectionGroups : [];
      const secSummary = secGroups.length > 0
        ? secGroups.map((g, i) => `<span style="display:inline-block; background:rgba(2,132,199,0.1); color:#0284c7; padding:2px 8px; border-radius:999px; font-weight:700; font-size:10.5px; margin:2px 4px 2px 0;">${i + 1}. ${g.displayName || g.sec1}${g.sec2 ? ` (Combined: ${g.sec1} + ${g.sec2})` : ''} • ${g.questionCount || r.cbtQuestionsPerSection || 25} Qs • ${g.timeMinutes || r.cbtPerSectionTiming || 15}m</span>`).join('')
        : `<span>Auto-split into <strong>${r.cbtNumSections || 4} Sections</strong> (New section after every <strong>${r.cbtQuestionsPerSection || 25} Questions</strong>, <strong>${r.cbtPerSectionTiming || r.cbtDefaultSectionTime || 15} Mins</strong> each)</span>`;

      previewEl.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 6px 14px; margin-bottom: 4px;">
          <span><strong>Pattern:</strong> <span style="color:var(--primary); font-weight:800;">${r.examDisplayName || ruleKey}</span></span>
          <span><strong>Correct:</strong> <span style="color:#059669; font-weight:800;">+${r.cbtCorrectMarks ?? 1.0}</span></span>
          <span><strong>Wrong:</strong> <span style="color:#dc2626; font-weight:800;">-${r.cbtWrongMarks ?? 0.25}</span></span>
          <span><strong>Total Marks:</strong> ${r.totalMarks ?? 100}</span>
          <span><strong>Passing Marks:</strong> <span style="color:var(--primary); font-weight:800;">${r.cbtPassingMarks ?? r.passingMarks ?? 40}</span></span>
          <span><strong>Timer Mode:</strong> ${(r.cbtTimerMode === 'sectional') ? `🧩 Sectional Timer (${r.cbtPerSectionTiming || r.cbtDefaultSectionTime || 15}m/sec)` : `⏱️ Full Timer (${r.timeLimit || 60} Mins)`}</span>
        </div>
        <div style="margin-top: 4px;"><strong>Section Arrangement:</strong> ${secSummary}</div>
      `;
    }

export function adjustAdminUploadForm() {
      const typeElem = document.getElementById('adm-upload-type');
      if (!typeElem) return;

      const type = typeElem.value;
      const normalizedType = type ? type.toLowerCase().replace(/[-_\s]/g, '').trim() : '';

      const titleLabel = document.getElementById('adm-title-label');
      const subtabLabel = document.getElementById('adm-subtab-label');
      const urlLabel = document.getElementById('adm-url-label');
      const timeLimitNote = document.getElementById('adm-time-limit-rule-note');
      const autoFetchVideoBtn = document.getElementById('adm-auto-fetch-video-dur-btn');

      const groupAudioPassage = document.getElementById('group-adm-audio-passage');
      const groupMediaClipMerge = document.getElementById('group-adm-media-clip-merge');
      const groupAudioMergerSec = document.getElementById('group-adm-audio-merger-section');
      const groupLogo = document.getElementById('group-adm-logo');
      const groupSubtab = document.getElementById('group-adm-subtab');
      const groupThumb = document.getElementById('group-adm-thumb');
      const groupTimeLimit = document.getElementById('group-adm-time-limit');
      const groupCategory = document.getElementById('group-adm-category');
      const groupTargetDate = document.getElementById('group-adm-target-date');
      const groupMedium = document.getElementById('group-adm-medium');
      const groupDifficulty = document.getElementById('group-adm-difficulty');
      const groupExamDate = document.getElementById('group-adm-exam-date');
      const groupAccess = document.getElementById('group-adm-access');
      const groupCbtEvalRule = document.getElementById('group-adm-cbt-eval-rule');
      const groupLearningStudioCfg = document.getElementById('group-adm-learning-studio-config');

      const isAudioOrVideoType = ['audio', 'videocourse', 'video', 'videos'].includes(normalizedType);
      if (groupAudioPassage) groupAudioPassage.style.display = (normalizedType === 'audio') ? 'block' : 'none';
      if (groupMediaClipMerge) groupMediaClipMerge.style.display = isAudioOrVideoType ? 'block' : 'none';
      if (groupAudioMergerSec) groupAudioMergerSec.style.display = (normalizedType === 'audio') ? 'block' : 'none';
      if (groupLogo) groupLogo.style.display = (normalizedType === 'pitman') ? 'block' : 'none';
      if (groupLearningStudioCfg) groupLearningStudioCfg.style.display = (normalizedType === 'learningtyping') ? 'block' : 'none';
      if (groupCbtEvalRule) {
        groupCbtEvalRule.style.display = (normalizedType === 'cbttest') ? 'block' : 'none';
        if (normalizedType === 'cbttest') {
          populateUploadCbtEvalRulesDropdown();
        }
      }

      if (groupAccess) {
        const hideAccessForTypes = ['homework', 'announcement', 'announcements', 'video', 'videos'];
        groupAccess.style.display = hideAccessForTypes.includes(normalizedType) ? 'none' : 'block';
      }

      if (autoFetchVideoBtn) autoFetchVideoBtn.style.display = 'none';
      if (groupTimeLimit) groupTimeLimit.style.display = 'none';
      if (timeLimitNote) timeLimitNote.style.display = 'none';

      if (normalizedType === 'typingtest' || normalizedType === 'learningtyping') {
        if (titleLabel) titleLabel.innerHTML = (normalizedType === 'learningtyping' ? 'Touch-Typing Studio / Lesson Drill Title' : 'Master Passage / Title') + ' <span class="required-star">*</span>';
        if (urlLabel) urlLabel.innerHTML = (normalizedType === 'learningtyping' ? 'Touch-Typing Studio & Finger Guide Drill Text / Passage' : 'Master Passage Text') + ' <span class="required-star">*</span>';
        if (subtabLabel) subtabLabel.innerHTML = normalizedType === 'learningtyping' ? 'Touch-Typing Target Section / Subtab' : 'Subtab / Exam Name';
        if (groupSubtab) groupSubtab.style.display = 'block';
        if (groupThumb) groupThumb.style.display = 'block';
        if (groupCategory) groupCategory.style.display = 'none';
        if (groupTargetDate) groupTargetDate.style.display = 'none';
        if (groupMedium) groupMedium.style.display = 'block';
        if (groupDifficulty) groupDifficulty.style.display = 'block';
        if (groupExamDate) groupExamDate.style.display = 'block';
      } else if (normalizedType === 'videocourse' || normalizedType === 'video') {
        if (titleLabel) titleLabel.innerHTML = (normalizedType === 'videocourse' ? 'Video Course Lecture Title' : 'Reference Video Title') + ' <span class="required-star">*</span>';
        if (subtabLabel) subtabLabel.innerHTML = 'Course Subtab / Batch <span class="required-star">*</span>';
        if (urlLabel) urlLabel.innerHTML = 'Video URL (YouTube / Drive / MP4) <span class="required-star">*</span>';
        if (groupSubtab) groupSubtab.style.display = (normalizedType === 'videocourse') ? 'block' : 'none';
        if (groupThumb) groupThumb.style.display = 'block';
        if (groupTimeLimit) groupTimeLimit.style.display = 'block';
        if (autoFetchVideoBtn) autoFetchVideoBtn.style.display = 'inline-flex';
        const tlInput = document.getElementById('adm-upload-time-limit');
        if (tlInput && (!editingMaterialId || tlInput.value === '5')) {
          tlInput.value = '';
          tlInput.placeholder = 'Auto-fetched from Video URL (Mins)';
        }
      } else if (normalizedType === 'cbttest') {
        if (titleLabel) titleLabel.innerHTML = 'CBT Exam Title (e.g. SSC Steno Mock #1) <span class="required-star">*</span>';
        if (subtabLabel) subtabLabel.innerHTML = 'CBT Exam Category / Subtab <span class="required-star">*</span>';
        if (urlLabel) urlLabel.innerHTML = 'CBT Questions JSON Array <span class="required-star">*</span>';
        if (groupSubtab) groupSubtab.style.display = 'block';
        if (groupThumb) groupThumb.style.display = 'block';
      } else if (normalizedType === 'audio') {
        if (titleLabel) titleLabel.innerHTML = 'Title <span class="required-star">*</span>';
        if (subtabLabel) subtabLabel.innerHTML = 'Subtab <span class="required-star">*</span>';
        if (urlLabel) urlLabel.innerHTML = 'Audio Link / URL <span class="required-star">*</span>';
        if (groupSubtab) groupSubtab.style.display = 'block';
        if (groupThumb) groupThumb.style.display = 'block';
      } else if (normalizedType === 'pitman') {
        if (titleLabel) titleLabel.innerHTML = 'Title <span class="required-star">*</span>';
        if (subtabLabel) subtabLabel.innerHTML = 'Subtab <span class="required-star">*</span>';
        if (urlLabel) urlLabel.innerHTML = 'Master Passage / Transcription Text <span class="required-star">*</span>';
        if (groupSubtab) groupSubtab.style.display = 'block';
        if (groupThumb) groupThumb.style.display = 'block';
      } else {
        if (titleLabel) titleLabel.innerHTML = 'Title <span class="required-star">*</span>';
        if (subtabLabel) subtabLabel.innerHTML = 'Subtab <span class="required-star">*</span>';
        if (urlLabel) urlLabel.innerHTML = 'Material Passage / Transcription Text / URL <span class="required-star">*</span>';
        if (groupSubtab) groupSubtab.style.display = ['pdf', 'audio', 'pitman', 'videocourse', 'cbttest', 'learningtyping'].includes(normalizedType) ? 'block' : 'none';
        if (groupThumb) groupThumb.style.display = ['pdf', 'audio', 'word', 'video', 'pitman', 'videocourse', 'cbttest', 'learningtyping', 'typingtest'].includes(normalizedType) ? 'block' : 'none';
      }

      if (groupCategory) groupCategory.style.display = (normalizedType === 'word') ? 'block' : 'none';
      if (groupTargetDate) groupTargetDate.style.display = (normalizedType === 'homework') ? 'block' : 'none';
      
      if (normalizedType !== 'typingtest' && normalizedType !== 'learningtyping') {
        if (groupMedium) groupMedium.style.display = 'none';
        if (groupDifficulty) groupDifficulty.style.display = 'none';
        if (groupExamDate) groupExamDate.style.display = 'none';
      }

      populateAdminSubtabsDropdown();
    }

export let _videoDurationProbeTimer = null;

export function autoCalculateWordsAndStrokes() {
      const text = document.getElementById('adm-upload-url')?.value || '';
      const statsElem = document.getElementById('adm-auto-stats');
      if (statsElem) {
        const words = text.split(/\s+/).filter(Boolean).length;
        const strokes = text.length;
        statsElem.innerText = `Auto Count - Words: ${words} | Strokes (Characters): ${strokes} | 5-Stroke Words: ${Math.round(strokes / 5)}`;
      }

      const typeElem = document.getElementById('adm-upload-type');
      const normalizedType = typeElem ? typeElem.value.toLowerCase().replace(/[-_\s]/g, '').trim() : '';
      if ((normalizedType === 'videocourse' || normalizedType === 'video') && text.trim().startsWith('http')) {
        if (_videoDurationProbeTimer) clearTimeout(_videoDurationProbeTimer);
        _videoDurationProbeTimer = setTimeout(() => {
          autoDetectVideoDurationFromUrl(false);
        }, 500);
      }
    }

export function autoDetectVideoDurationFromUrl(showFeedback = true) {
      const urlInput = document.getElementById('adm-upload-url');
      const timeLimitInput = document.getElementById('adm-upload-time-limit');
      if (!urlInput || !timeLimitInput) return;

      const rawUrl = urlInput.value.trim();
      if (!rawUrl || !rawUrl.startsWith('http')) {
        if (showFeedback) showToast('Please enter a valid Video URL first to auto-fetch duration.');
        return;
      }

      let probeUrl = rawUrl;
      if (probeUrl.includes('github.com') && probeUrl.includes('/blob/')) {
        probeUrl = probeUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }

      if (probeUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) || probeUrl.includes('raw.githubusercontent.com') || probeUrl.includes('commondatastorage.googleapis.com')) {
        if (showFeedback) showToast('⏳ Probing video stream for exact duration...');
        const tempVid = document.createElement('video');
        tempVid.preload = 'metadata';
        tempVid.muted = true;
        tempVid.onloadedmetadata = () => {
          if (tempVid.duration && isFinite(tempVid.duration) && tempVid.duration > 0) {
            const mins = Math.max(1, Math.round(tempVid.duration / 60));
            timeLimitInput.value = String(mins);
            showToast(`✅ Auto-Fetched Video Duration: ${mins} Mins (${Math.round(tempVid.duration)}s)`);
          }
          tempVid.remove();
        };
        tempVid.onerror = () => {
          tempVid.remove();
          if (showFeedback) showToast('ℹ️ Duration will auto-sync when video starts playing.');
        };
        tempVid.src = probeUrl;
        return;
      }

      if (probeUrl.includes('youtube.com') || probeUrl.includes('youtu.be')) {
        const videoId = extractYouTubeVideoId(probeUrl);
        if (videoId) {
          if (showFeedback) showToast('⏳ Fetching YouTube video duration automatically...');
          probeYouTubeVideoDuration(videoId, (durationSec) => {
            if (durationSec && durationSec > 0) {
              const mins = Math.max(1, Math.round(durationSec / 60));
              timeLimitInput.value = String(mins);
              showToast(`✅ Auto-Fetched YouTube Video Duration: ${mins} Mins`);
            } else if (showFeedback) {
              showToast('ℹ️ YouTube duration will auto-populate on video playback.');
            }
          });
          return;
        }
      }

      if (showFeedback) {
        showToast('ℹ️ Video duration will be auto-detected upon playback.');
      }
    }

export function probeYouTubeVideoDuration(videoId, callback) {
      if (!videoId) { callback(0); return; }
      const applyYtProbe = () => {
        try {
          let holder = document.getElementById('yt-duration-probe-holder');
          if (!holder) {
            holder = document.createElement('div');
            holder.id = 'yt-duration-probe-holder';
            holder.style.cssText = 'position:fixed; left:-9999px; top:-9999px; width:1px; height:1px; opacity:0; pointer-events:none;';
            document.body.appendChild(holder);
          }
          const divId = 'yt-probe-' + Date.now();
          holder.innerHTML = `<div id="${divId}"></div>`;
          new window.YT.Player(divId, {
            height: '1',
            width: '1',
            videoId: videoId,
            events: {
              onReady: (ev) => {
                try {
                  const dur = ev.target && typeof ev.target.getDuration === 'function' ? ev.target.getDuration() : 0;
                  callback(dur || 0);
                  setTimeout(() => { try { ev.target.destroy(); } catch (e) {} }, 500);
                } catch (e) { callback(0); }
              },
              onError: () => callback(0)
            }
          });
        } catch (err) {
          callback(0);
        }
      };

      if (window.YT && window.YT.Player) {
        applyYtProbe();
      } else {
        if (!document.getElementById('yt-iframe-api-script')) {
          const tag = document.createElement('script');
          tag.id = 'yt-iframe-api-script';
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);
        }
        let checks = 0;
        const waitInt = setInterval(() => {
          checks++;
          if (window.YT && window.YT.Player) {
            clearInterval(waitInt);
            applyYtProbe();
          } else if (checks > 20) {
            clearInterval(waitInt);
            callback(0);
          }
        }, 250);
      }
    }

export function populateAdminSubtabsDropdown() {
      const select = document.getElementById('adm-upload-subtab');
      const typeElem = document.getElementById('adm-upload-type');
      if (!select || !typeElem) return;
      
      const currentType = typeElem.value;
      const lowerType = String(currentType || '').toLowerCase().trim();
      select.innerHTML = '<option value="" disabled selected>-- Select Subtab / Exam Name --</option>';

      if (lowerType === 'typingtest') {
        const allOpt = document.createElement('option');
        allOpt.value = 'ALL';
        allOpt.innerText = 'ALL (Available Across All Typing Subtabs)';
        select.appendChild(allOpt);
      }

      // 👉 REQUIREMENT #10: Always provide built-in Touch-Typing Studio & Finger Guide subtab options so uploading is never unavailable
      if (lowerType === 'learningtyping') {
        const builtInLearningSubtabs = [
          { value: 'Touch-Typing Studio & Finger Guide', label: '1. Touch-Typing Studio & Finger Guide (Interactive Key Deck)' },
          { value: 'Uploaded Learning Passages', label: '2. Uploaded Learning Passages (Practice Catalog)' },
          { value: 'ALL', label: '🌐 Both Sections (Studio Finger Guide + Uploaded Passages)' }
        ];
        builtInLearningSubtabs.forEach((item, idx) => {
          const opt = document.createElement('option');
          opt.value = item.value;
          opt.innerText = item.label;
          if (idx === 0) opt.selected = true;
          select.appendChild(opt);
        });
      }

      const sourceSubtabs = (portalState.adminData && Array.isArray(portalState.adminData.subtabs) && portalState.adminData.subtabs.length > 0) ? portalState.adminData.subtabs : (portalState.subtabsData || []);
      sourceSubtabs.filter(stb => stb.Type && stb.Type.toLowerCase() === lowerType).forEach(stb => {
        if ([...select.options].some(o => o.value === stb.SubtabName)) return;
        const opt = document.createElement('option');
        opt.value = stb.SubtabName;
        opt.innerText = stb.SubtabName;
        select.appendChild(opt);
      });
    }

export function syncLearningStudioUploadTargetChange() {
      const targetSec = document.getElementById('adm-upload-learning-target-sec')?.value || 'both';
      const subtabSelect = document.getElementById('adm-upload-subtab');
      if (!subtabSelect) return;
      if (targetSec === 'studio') {
        subtabSelect.value = 'Touch-Typing Studio & Finger Guide';
      } else if (targetSec === 'passages') {
        subtabSelect.value = 'Uploaded Learning Passages';
      }
    }

export function applyLearningFingerRowTemplatePreset(focusVal) {
      const catInput = document.getElementById('adm-upload-category');
      if (catInput && focusVal) {
        catInput.value = focusVal;
      }
    }

export async function handleAdminMaterialUpload() {
      const type = document.getElementById('adm-upload-type').value;
      const title = document.getElementById('adm-upload-title').value.trim();
      const medium = document.getElementById('adm-upload-medium')?.value || 'English';

      if (!type) {
        showToast('Please select a valid Material Type.');
        return;
      }

      if (!title) {
        showToast('Error: Title / Master Passage is required (*).');
        return;
      }

      const normalizedType = type ? type.toLowerCase().replace(/[-_\s]/g, '').trim() : '';
      let subtabVal = '-';
      if (normalizedType === 'typingtest') {
        subtabVal = document.getElementById('adm-upload-subtab')?.value || 'ALL';
      } else if (normalizedType === 'learningtyping') {
        const studioTargetSec = document.getElementById('adm-upload-learning-target-sec')?.value || 'both';
        const explicitSub = document.getElementById('adm-upload-subtab')?.value;
        if (studioTargetSec === 'studio') {
          subtabVal = 'Touch-Typing Studio & Finger Guide';
        } else if (studioTargetSec === 'passages') {
          subtabVal = 'Uploaded Learning Passages';
        } else if (explicitSub && explicitSub !== '-') {
          subtabVal = explicitSub;
        } else {
          subtabVal = 'Touch-Typing Studio & Finger Guide';
        }
      } else {
        subtabVal = document.getElementById('adm-upload-subtab').value || '-';
      }

      const audioPassage = document.getElementById('adm-upload-audio-passage')?.value.trim() || '-';
      const logoUrl = document.getElementById('adm-upload-logo')?.value.trim() || '-';

      const selectedCbtEvalRuleKey = (normalizedType === 'cbttest')
        ? (document.getElementById('adm-upload-cbt-eval-rule')?.value || '')
        : '';

      const rawTimeLimit = document.getElementById('adm-upload-time-limit')?.value;
      const contentUrlForProbe = document.getElementById('adm-upload-url')?.value.trim() || '';
      let cachedVideoDur = '';
      if (normalizedType === 'videocourse' || normalizedType === 'video') {
        try {
          const durCache = JSON.parse(localStorage.getItem('rp_video_durations_cache_v1') || '{}');
          if (contentUrlForProbe && durCache[contentUrlForProbe]) {
            cachedVideoDur = String(durCache[contentUrlForProbe]);
          }
        } catch (e) {}
      }
      let timeLimitVal = (rawTimeLimit !== undefined && rawTimeLimit !== '' && !isNaN(rawTimeLimit)) ? rawTimeLimit : '5';
      if (normalizedType === 'videocourse' || normalizedType === 'video') {
        // Never force '5' Mins on Video Courses if duration wasn't manually entered; use auto-detected/cached duration or '' so card probes it live
        if (rawTimeLimit && rawTimeLimit !== '5' && !isNaN(rawTimeLimit) && Number(rawTimeLimit) > 0) {
          timeLimitVal = String(rawTimeLimit);
        } else if (cachedVideoDur) {
          timeLimitVal = cachedVideoDur;
        } else {
          timeLimitVal = '';
        }
      } else if (normalizedType === 'learningtyping') {
        timeLimitVal = '0';
      } else if (normalizedType === 'cbttest' && selectedCbtEvalRuleKey && portalState.allEvaluationRules[selectedCbtEvalRuleKey]) {
        timeLimitVal = String(portalState.allEvaluationRules[selectedCbtEvalRuleKey].timeLimit || 60);
      } else if (['audio', 'pitman', 'typingtest', 'cbttest'].includes(normalizedType)) {
        const cleanSub = (subtabVal && subtabVal !== '-' && subtabVal !== 'ALL') ? subtabVal.toLowerCase().replace(/\s+/g, '_') : '';
        const evalRuleObj = (cleanSub && portalState.allEvaluationRules[`${normalizedType}_${cleanSub}`])
          ? portalState.allEvaluationRules[`${normalizedType}_${cleanSub}`]
          : getEvaluationRulesForTab(normalizedType);
        timeLimitVal = String(evalRuleObj?.timeLimit || 10);
      }

      const isAccessHidden = ['homework', 'announcement', 'announcements', 'video', 'videos'].includes(normalizedType);
      const accessVal = isAccessHidden ? 'public' : (document.getElementById('adm-upload-access')?.value || 'user');
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      const targetBatchVal = document.getElementById('adm-upload-batch')?.value || 'ALL_BATCHES';
      const learningFingerZone = document.getElementById('adm-upload-finger-row-focus')?.value || 'Full Keyboard Speed & Rhythm';
      const rawTargetSec = document.getElementById('adm-upload-learning-target-sec')?.value || 'both';
      const learningTargetSec = rawTargetSec === 'studio' ? 'studio_only' : (rawTargetSec === 'passages' ? 'passages_only' : 'studio_and_passages');
      const categoryVal = (normalizedType === 'cbttest' && selectedCbtEvalRuleKey)
        ? selectedCbtEvalRuleKey
        : (normalizedType === 'learningtyping'
            ? `${learningTargetSec}::${learningFingerZone}`
            : (document.getElementById('adm-upload-category')?.value || '-'));

      const publishAtVal = document.getElementById('adm-upload-publish-at')?.value || '';
      const expireAtVal = document.getElementById('adm-upload-expire-at')?.value || '';
      const autoDeleteDaysVal = document.getElementById('adm-upload-autodelete-days')?.value || '';
      let autoDeleteAtVal = document.getElementById('adm-upload-autodelete-at')?.value || '';
      if (!autoDeleteAtVal && autoDeleteDaysVal && autoDeleteDaysVal !== 'custom' && !isNaN(Number(autoDeleteDaysVal))) {
        const dt = new Date(nowMs + Number(autoDeleteDaysVal) * 24 * 60 * 60 * 1000);
        autoDeleteAtVal = dt.toISOString();
      }

      const mediaStartTimeVal = document.getElementById('adm-upload-media-start')?.value.trim() || '';
      const mediaEndTimeVal = document.getElementById('adm-upload-media-end')?.value.trim() || '';
      const mergedAudioTracksVal = (normalizedType === 'audio' && typeof collectAdminMergedAudioTracks === 'function')
        ? collectAdminMergedAudioTracks()
        : [];
      const parsedStartCheck = typeof window.parseMediaClipTimeSec === 'function' ? window.parseMediaClipTimeSec(mediaStartTimeVal) : null;
      const parsedEndCheck = typeof window.parseMediaClipTimeSec === 'function' ? window.parseMediaClipTimeSec(mediaEndTimeVal) : null;
      if (parsedStartCheck !== null && parsedEndCheck !== null && parsedEndCheck <= parsedStartCheck) {
        showToast('⚠️ End Time must be greater than Start Time.');
        return;
      }

      const payload = {
        id: editingMaterialId || undefined,
        materialType: type,
        title: title,
        subtab: subtabVal,
        category: categoryVal,
        cbtEvalRuleKey: selectedCbtEvalRuleKey || undefined,
        contentOrUrl: document.getElementById('adm-upload-url').value.trim() || '-',
        thumbnailUrl: (type.toLowerCase() === 'audio') ? audioPassage : (document.getElementById('adm-upload-thumb')?.value.trim() || DEFAULT_LOGO_URL),
        logoUrl: logoUrl,
        accessLevel: accessVal,
        targetBatch: targetBatchVal,
        timeLimit: timeLimitVal,
        targetDate: document.getElementById('adm-upload-date')?.value || '-',
        medium: medium,
        difficulty: document.getElementById('adm-upload-difficulty')?.value || 'Medium',
        examDate: document.getElementById('adm-upload-exam-date')?.value || getLocalDateString(),
        publishAt: publishAtVal,
        expireAt: expireAtVal,
        autoDeleteDays: autoDeleteDaysVal,
        autoDeleteAt: autoDeleteAtVal,
        mediaStartTime: mediaStartTimeVal,
        mediaEndTime: mediaEndTimeVal,
        mergedAudioTracks: mergedAudioTracksVal,
        createdAt: nowIso,
        _uploadTimestamp: nowMs
      };

      const action = editingMaterialId ? 'updateMaterial' : 'uploadMaterial';
      let res = await apiCall(action, payload);
      if (editingMaterialId && res && !res.success && String(res.message || '').toLowerCase().includes('not found')) {
        res = await apiCall('uploadMaterial', payload);
      }
      showToast(res.message || (res.success ? 'Material saved to Google Sheets!' : 'Saved locally.'));
      
      if (res.success) {
        const resolvedMatId = res.id || res.materialId || editingMaterialId || ('MAT-' + nowMs);
        const newMatObj = {
          ID: resolvedMatId,
          Type: type,
          Title: payload.title,
          Subtab: payload.subtab,
          Category: payload.category,
          CbtEvalRuleKey: selectedCbtEvalRuleKey || '',
          ContentOrUrl: payload.contentOrUrl,
          ThumbnailUrl: payload.thumbnailUrl,
          LogoUrl: payload.logoUrl,
          AccessLevel: payload.accessLevel,
          TargetBatch: payload.targetBatch,
          TimeLimit: payload.timeLimit,
          TargetDate: payload.targetDate,
          Medium: payload.medium,
          Difficulty: payload.difficulty,
          ExamDate: payload.examDate,
          MediaStartTime: mediaStartTimeVal,
          MediaEndTime: mediaEndTimeVal,
          MergedAudioTracks: mergedAudioTracksVal,
          ExtraMetaJson: JSON.stringify({
            TargetBatch: payload.targetBatch,
            CbtEvalRuleKey: selectedCbtEvalRuleKey || '',
            PublishAt: publishAtVal,
            ExpireAt: expireAtVal,
            AutoDeleteDays: autoDeleteDaysVal,
            AutoDeleteAt: autoDeleteAtVal,
            MediaStartTime: mediaStartTimeVal,
            MediaEndTime: mediaEndTimeVal,
            MergedAudioTracks: mergedAudioTracksVal
          }),
          CreatedAt: nowIso,
          _uploadTimestamp: nowMs
        };
        if (editingMaterialId) {
          const replaceInArr = (arr) => {
            if (!Array.isArray(arr)) return;
            const idx = arr.findIndex(x => String(x.ID) === String(editingMaterialId));
            if (idx !== -1) arr[idx] = { ...arr[idx], ...newMatObj };
            else arr.unshift(newMatObj);
          };
          replaceInArr(portalState.materialsData);
          if (portalState.globalData) replaceInArr(portalState.globalData.materials);
          if (portalState.adminData) replaceInArr(portalState.adminData.materials);
        } else {
          if (Array.isArray(portalState.materialsData)) portalState.materialsData.unshift(newMatObj);
          if (portalState.globalData && Array.isArray(portalState.globalData.materials)) portalState.globalData.materials.unshift(newMatObj);
          if (portalState.adminData && Array.isArray(portalState.adminData.materials)) portalState.adminData.materials.unshift(newMatObj);
        }
        saveFastPortalCache();
        // 👉 Requirement #13: Trigger Bell Icon Notification on Upload (auto-removes after 24 hrs)
        if (typeof pushPortalNotification === 'function') {
          const tabRouteMap = {
            pdf: 'pdf',
            audio: 'audio',
            pitman: 'pitman',
            word: 'words',
            words: 'words',
            typingtest: 'typingtest',
            learningtyping: 'learningtyping',
            cbttest: 'cbttest',
            video: 'videocourse',
            videos: 'videocourse',
            homework: 'dashboard',
            announcement: 'dashboard',
            announcements: 'dashboard'
          };
          const targetTab = tabRouteMap[normalizedType] || 'dashboard';
          pushPortalNotification({
            id: `upload_${newMatObj.ID}_${nowMs}`,
            type: 'upload',
            icon: 'fa-cloud-arrow-up',
            color: '#2563eb',
            title: editingMaterialId ? `🔄 Updated (${type.toUpperCase()}): ${payload.title}` : `📤 New Upload (${type.toUpperCase()}): ${payload.title}`,
            body: `Subtab: ${payload.subtab || 'General'} • Medium: ${payload.medium || 'English'} • Click to open`,
            targetTab: targetTab,
            createdAtMs: nowMs
          });
        }
        if (normalizedType === 'learningtyping' && typeof initLearningTypingTutor === 'function') {
          initLearningTypingTutor();
        }
        cancelEditingMaterial();
        loadAdminData();
      }
    }

export function editMaterialItem(id) {
      const item = (portalState.adminData.materials || []).find(m => String(m.ID) === String(id));
      if (!item) return;

      editingMaterialId = item.ID;
      document.getElementById('adm-upload-type').value = item.Type || 'pdf';
      adjustAdminUploadForm();

      document.getElementById('adm-upload-title').value = item.Title || '';
      document.getElementById('adm-upload-url').value = item.ContentOrUrl || '';
      
      if (document.getElementById('adm-upload-thumb')) document.getElementById('adm-upload-thumb').value = item.ThumbnailUrl || '';
      if (document.getElementById('adm-upload-audio-passage')) document.getElementById('adm-upload-audio-passage').value = (item.Type === 'audio') ? (item.ThumbnailUrl || '') : '';
      if (document.getElementById('adm-upload-logo')) document.getElementById('adm-upload-logo').value = item.LogoUrl || '';

      if (document.getElementById('adm-upload-subtab') && item.Type !== 'typingtest') {
        document.getElementById('adm-upload-subtab').value = item.Subtab || '';
      }
      if (document.getElementById('adm-upload-category')) document.getElementById('adm-upload-category').value = item.Category || '';
      if (String(item.Type || '').toLowerCase() === 'cbttest') {
        const savedCbtRule = item.CbtEvalRuleKey || item.cbtEvalRuleKey || (String(item.Category || '').startsWith('cbttest') ? item.Category : '');
        populateUploadCbtEvalRulesDropdown(savedCbtRule);
      }
      if (document.getElementById('adm-upload-batch')) document.getElementById('adm-upload-batch').value = item.TargetBatch || item.targetBatch || 'ALL_BATCHES';
      
      const normalizedType = item.Type ? item.Type.toLowerCase().replace(/[-_\s]/g, '').trim() : '';
      const isAccessHidden = ['homework', 'announcement', 'announcements', 'video', 'videos'].includes(normalizedType);

      if (document.getElementById('adm-upload-access')) {
        document.getElementById('adm-upload-access').value = isAccessHidden ? 'public' : (item.AccessLevel || 'user');
      }
      
      if (document.getElementById('adm-upload-time-limit')) document.getElementById('adm-upload-time-limit').value = item.TimeLimit || '5';
      if (document.getElementById('adm-upload-medium')) document.getElementById('adm-upload-medium').value = item.Medium || 'English';
      if (document.getElementById('adm-upload-difficulty')) document.getElementById('adm-upload-difficulty').value = item.Difficulty || 'Medium';
      if (document.getElementById('adm-upload-exam-date')) document.getElementById('adm-upload-exam-date').value = item.ExamDate || '';
      let parsedMeta = {};
      try {
        if (item.ExtraMetaJson && item.ExtraMetaJson !== '-') parsedMeta = JSON.parse(String(item.ExtraMetaJson));
      } catch (e) {}
      const toLocalInput = (val) => {
        if (!val || val === '-') return '';
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(val))) return String(val).slice(0, 16);
        const d = new Date(val);
        if (isNaN(d.getTime())) return '';
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      if (document.getElementById('adm-upload-publish-at')) document.getElementById('adm-upload-publish-at').value = toLocalInput(parsedMeta.PublishAt || item.PublishAt);
      if (document.getElementById('adm-upload-expire-at')) document.getElementById('adm-upload-expire-at').value = toLocalInput(parsedMeta.ExpireAt || item.ExpireAt);
      if (document.getElementById('adm-upload-autodelete-days')) document.getElementById('adm-upload-autodelete-days').value = parsedMeta.AutoDeleteDays || item.AutoDeleteDays || (parsedMeta.AutoDeleteAt || item.AutoDeleteAt ? 'custom' : '');
      if (document.getElementById('adm-upload-autodelete-at')) document.getElementById('adm-upload-autodelete-at').value = toLocalInput(parsedMeta.AutoDeleteAt || item.AutoDeleteAt);
      if (document.getElementById('adm-upload-media-start')) document.getElementById('adm-upload-media-start').value = item.MediaStartTime || parsedMeta.MediaStartTime || '';
      if (document.getElementById('adm-upload-media-end')) document.getElementById('adm-upload-media-end').value = item.MediaEndTime || parsedMeta.MediaEndTime || '';
      if (typeof populateAdminMergedAudioTracks === 'function') {
        const tracks = Array.isArray(item.MergedAudioTracks) ? item.MergedAudioTracks : (Array.isArray(parsedMeta.MergedAudioTracks) ? parsedMeta.MergedAudioTracks : []);
        populateAdminMergedAudioTracks(tracks);
      }

      document.getElementById('adm-upload-submit-btn').innerText = 'Update Material';
      autoCalculateWordsAndStrokes();
      document.getElementById('admin-content-upload-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast(`Editing Material ID: ${item.ID}`);
    }

export function cancelEditingMaterial() {
      editingMaterialId = null;
      document.getElementById('adm-upload-type').selectedIndex = 0;
      document.getElementById('adm-upload-title').value = '';
      document.getElementById('adm-upload-url').value = '';
      if (document.getElementById('adm-upload-thumb')) document.getElementById('adm-upload-thumb').value = '';
      if (document.getElementById('adm-upload-audio-passage')) document.getElementById('adm-upload-audio-passage').value = '';
      if (document.getElementById('adm-upload-logo')) document.getElementById('adm-upload-logo').value = '';
      if (document.getElementById('adm-upload-category')) document.getElementById('adm-upload-category').value = '';
      if (document.getElementById('adm-upload-access')) document.getElementById('adm-upload-access').value = 'user';
      if (document.getElementById('adm-upload-time-limit')) document.getElementById('adm-upload-time-limit').value = '5';
      if (document.getElementById('adm-upload-publish-at')) document.getElementById('adm-upload-publish-at').value = '';
      if (document.getElementById('adm-upload-expire-at')) document.getElementById('adm-upload-expire-at').value = '';
      if (document.getElementById('adm-upload-autodelete-days')) document.getElementById('adm-upload-autodelete-days').value = '';
      if (document.getElementById('adm-upload-autodelete-at')) document.getElementById('adm-upload-autodelete-at').value = '';
      if (document.getElementById('adm-upload-media-start')) document.getElementById('adm-upload-media-start').value = '';
      if (document.getElementById('adm-upload-media-end')) document.getElementById('adm-upload-media-end').value = '';
      if (typeof populateAdminMergedAudioTracks === 'function') populateAdminMergedAudioTracks([]);
      const mergeFilesInp = document.getElementById('adm-local-audio-merge-files');
      if (mergeFilesInp) mergeFilesInp.value = '';
      const mergeStatus = document.getElementById('adm-local-audio-merge-status');
      if (mergeStatus) mergeStatus.textContent = '';
      const mergeResult = document.getElementById('adm-local-audio-merge-result');
      if (mergeResult) { mergeResult.style.display = 'none'; mergeResult.innerHTML = ''; }
      document.getElementById('adm-upload-submit-btn').innerText = 'Upload Item';
      adjustAdminUploadForm();
      showToast('Form reset successfully.');
    }

window.parseMediaClipTimeSec = function(rawVal) {
      if (rawVal === undefined || rawVal === null) return null;
      const str = String(rawVal).trim();
      if (!str || str === '-') return null;
      if (/^\d+(\.\d+)?$/.test(str)) {
        const n = parseFloat(str);
        return isFinite(n) && n >= 0 ? Math.floor(n) : null;
      }
      const parts = str.split(':').map(p => parseFloat(p.trim()));
      if (parts.some(isNaN)) return null;
      if (parts.length === 2) return Math.max(0, Math.floor(parts[0] * 60 + parts[1]));
      if (parts.length === 3) return Math.max(0, Math.floor(parts[0] * 3600 + parts[1] * 60 + parts[2]));
      return null;
    };

window.formatMediaClipSec = function(sec) {
      if (sec === null || sec === undefined || !isFinite(Number(sec))) return '';
      const s = Math.max(0, Math.floor(Number(sec)));
      const hrs = Math.floor(s / 3600);
      const mins = Math.floor((s % 3600) / 60);
      const rem = s % 60;
      if (hrs > 0) return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
      return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    };

window.buildYouTubeClipQueryParams = function(startSec, endSec) {
      let q = '';
      if (startSec !== null && startSec !== undefined && startSec > 0) q += `&start=${Math.floor(startSec)}`;
      if (endSec !== null && endSec !== undefined && endSec > 0) q += `&end=${Math.floor(endSec)}`;
      return q;
    };

window.bindHtml5MediaClipBounds = function(mediaEl, startSec, endSec, onClipComplete) {
      if (!mediaEl) return;
      if (typeof mediaEl._cleanupClipBounds === 'function') {
        try { mediaEl._cleanupClipBounds(); } catch (e) {}
      }
      const hasStart = startSec !== null && startSec !== undefined && startSec > 0;
      const hasEnd = endSec !== null && endSec !== undefined && endSec > 0;
      let clipEndedTriggered = false;

      const seekToStartIfNeeded = () => {
        if (!hasStart) return;
        try {
          if (mediaEl.currentTime < startSec || (hasEnd && mediaEl.currentTime >= endSec)) {
            mediaEl.currentTime = startSec;
          }
        } catch (e) {}
      };
      const onLoaded = () => {
        clipEndedTriggered = false;
        seekToStartIfNeeded();
      };
      const onPlay = () => {
        clipEndedTriggered = false;
        seekToStartIfNeeded();
      };
      const onTimeUpdate = () => {
        if (hasEnd && mediaEl.currentTime >= endSec && !clipEndedTriggered) {
          clipEndedTriggered = true;
          mediaEl.pause();
          try { mediaEl.currentTime = endSec; } catch (e) {}
          if (typeof onClipComplete === 'function') {
            onClipComplete();
          } else if (typeof showToast === 'function') {
            showToast(`⏹️ Reached configured clip end time (${window.formatMediaClipSec(endSec)}).`);
          }
        }
      };
      const onEnded = () => {
        if (!clipEndedTriggered) {
          clipEndedTriggered = true;
          if (typeof onClipComplete === 'function') onClipComplete();
        }
      };

      mediaEl.addEventListener('loadedmetadata', onLoaded);
      mediaEl.addEventListener('play', onPlay);
      mediaEl.addEventListener('timeupdate', onTimeUpdate);
      mediaEl.addEventListener('ended', onEnded);
      mediaEl.dataset.clipStartSec = hasStart ? String(startSec) : '0';
      mediaEl.dataset.clipEndSec = hasEnd ? String(endSec) : '';
      if (mediaEl.readyState >= 1) seekToStartIfNeeded();

      mediaEl._cleanupClipBounds = () => {
        mediaEl.removeEventListener('loadedmetadata', onLoaded);
        mediaEl.removeEventListener('play', onPlay);
        mediaEl.removeEventListener('timeupdate', onTimeUpdate);
        mediaEl.removeEventListener('ended', onEnded);
      };
    };

window.resolveMaterialMediaClipConfig = function(rawUrl, title, explicitItem) {
      let item = explicitItem || null;
      if (!item && typeof portalState.materialsData !== 'undefined' && Array.isArray(portalState.materialsData)) {
        const cleanUrl = String(rawUrl || '').trim();
        const cleanTitle = String(title || '').trim();
        item = portalState.materialsData.find(m =>
          (cleanUrl && (String(m.ContentOrUrl || '').trim() === cleanUrl || String(m.VoiceUrl || '').trim() === cleanUrl)) ||
          (cleanTitle && String(m.Title || '').trim() === cleanTitle)
        ) || null;
      }
      let extraMeta = {};
      if (item && item.ExtraMetaJson && item.ExtraMetaJson !== '-') {
        if (typeof item.ExtraMetaJson === 'object') extraMeta = item.ExtraMetaJson;
        else {
          try { extraMeta = JSON.parse(String(item.ExtraMetaJson)); } catch (e) {}
        }
      }
      const rawStart = (item && item.MediaStartTime) || extraMeta.MediaStartTime || '';
      const rawEnd = (item && item.MediaEndTime) || extraMeta.MediaEndTime || '';
      const startSec = window.parseMediaClipTimeSec(rawStart);
      const endSec = window.parseMediaClipTimeSec(rawEnd);
      const rawTracks = (item && Array.isArray(item.MergedAudioTracks))
        ? item.MergedAudioTracks
        : (Array.isArray(extraMeta.MergedAudioTracks) ? extraMeta.MergedAudioTracks : []);

      const primaryUrl = String(rawUrl || (item && (item.VoiceUrl || item.AudioUrl || item.ContentOrUrl)) || '').trim();
      const tracks = [];
      const isPrimaryUrlValid = /^https?:\/\//i.test(primaryUrl) || primaryUrl.startsWith('data:audio') || primaryUrl.startsWith('blob:');
      if (isPrimaryUrlValid) {
        tracks.push({
          title: (item && item.Title) ? `${item.Title} (Part 1)` : 'Part 1',
          url: primaryUrl,
          startSec,
          endSec,
          startLabel: startSec !== null ? window.formatMediaClipSec(startSec) : '',
          endLabel: endSec !== null ? window.formatMediaClipSec(endSec) : ''
        });
      }
      rawTracks.forEach((tr, idx) => {
        const u = String(tr && tr.url || '').trim();
        if (!u) return;
        const tStart = window.parseMediaClipTimeSec(tr.startTime);
        const tEnd = window.parseMediaClipTimeSec(tr.endTime);
        tracks.push({
          title: String(tr.title || `Part ${tracks.length + 1}`).trim(),
          url: u,
          startSec: tStart,
          endSec: tEnd,
          startLabel: tStart !== null ? window.formatMediaClipSec(tStart) : '',
          endLabel: tEnd !== null ? window.formatMediaClipSec(tEnd) : ''
        });
      });

      return {
        startSec,
        endSec,
        startLabel: startSec !== null ? window.formatMediaClipSec(startSec) : '',
        endLabel: endSec !== null ? window.formatMediaClipSec(endSec) : '',
        tracks
      };
    };

export function addAdminMergeAudioTrackRow(trackData) {
      const list = document.getElementById('adm-audio-merge-tracks-list');
      if (!list) return;
      const idx = list.children.length + 1;
      const row = document.createElement('div');
      row.className = 'adm-merge-audio-track-row';
      row.style.cssText = 'display:grid; grid-template-columns: 1.1fr 2fr 0.75fr 0.75fr auto; gap:8px; align-items:center; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:8px 10px;';
      const tTitle = String(trackData?.title || `Part ${idx + 1}`).replace(/"/g, '&quot;');
      const tUrl = String(trackData?.url || '').replace(/"/g, '&quot;');
      const tStart = String(trackData?.startTime || '').replace(/"/g, '&quot;');
      const tEnd = String(trackData?.endTime || '').replace(/"/g, '&quot;');
      row.innerHTML = `
        <input type="text" class="form-control adm-merge-track-title" value="${tTitle}" placeholder="Part Title" style="margin:0; font-size:12px; padding:6px 8px;">
        <input type="text" class="form-control adm-merge-track-url" value="${tUrl}" placeholder="Audio / YouTube / Drive URL to append..." style="margin:0; font-size:12px; padding:6px 8px;">
        <input type="text" class="form-control adm-merge-track-start" value="${tStart}" placeholder="Start (MM:SS)" style="margin:0; font-size:12px; padding:6px 8px;">
        <input type="text" class="form-control adm-merge-track-end" value="${tEnd}" placeholder="End (MM:SS)" style="margin:0; font-size:12px; padding:6px 8px;">
        <button type="button" class="btn btn-danger btn-sm" style="padding:5px 9px;" onclick="this.closest('.adm-merge-audio-track-row').remove()" title="Remove Track"><i class="fa-solid fa-trash"></i></button>
      `;
      list.appendChild(row);
    }

export function populateAdminMergedAudioTracks(tracks) {
      const list = document.getElementById('adm-audio-merge-tracks-list');
      if (!list) return;
      list.innerHTML = '';
      if (Array.isArray(tracks) && tracks.length > 0) {
        tracks.forEach(tr => addAdminMergeAudioTrackRow(tr));
      }
    }

export function collectAdminMergedAudioTracks() {
      const list = document.getElementById('adm-audio-merge-tracks-list');
      if (!list) return [];
      const rows = Array.from(list.querySelectorAll('.adm-merge-audio-track-row'));
      return rows.map((row, idx) => ({
        title: row.querySelector('.adm-merge-track-title')?.value.trim() || `Part ${idx + 2}`,
        url: row.querySelector('.adm-merge-track-url')?.value.trim() || '',
        startTime: row.querySelector('.adm-merge-track-start')?.value.trim() || '',
        endTime: row.querySelector('.adm-merge-track-end')?.value.trim() || ''
      })).filter(t => Boolean(t.url));
    }

export function encodeAudioBufferToWavBlob(audioBuffer) {
      const numChannels = Math.min(2, audioBuffer.numberOfChannels || 1);
      const sampleRate = audioBuffer.sampleRate || 44100;
      const length = audioBuffer.length;
      const bytesPerSample = 2;
      const blockAlign = numChannels * bytesPerSample;
      const dataSize = length * blockAlign;
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);
      const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };

      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, dataSize, true);

      const channels = [];
      for (let ch = 0; ch < numChannels; ch++) {
        channels.push(audioBuffer.getChannelData(ch));
      }
      let offset = 44;
      for (let i = 0; i < length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          let sample = Math.max(-1, Math.min(1, channels[ch][i] || 0));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
          offset += 2;
        }
      }
      return new Blob([buffer], { type: 'audio/wav' });
    }

export async function mergeSelectedLocalAudioFiles() {
      const fileInput = document.getElementById('adm-local-audio-merge-files');
      const statusEl = document.getElementById('adm-local-audio-merge-status');
      const resultEl = document.getElementById('adm-local-audio-merge-result');
      const btn = document.getElementById('adm-local-audio-merge-btn');
      const gapSec = Math.max(0, parseFloat(document.getElementById('adm-local-audio-merge-gap')?.value || '0') || 0);

      if (!fileInput || !fileInput.files || fileInput.files.length < 2) {
        showToast('⚠️ Please select at least 2 audio files to merge.');
        return;
      }

      const files = Array.from(fileInput.files);
      if (btn) btn.disabled = true;
      if (statusEl) statusEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Decoding &amp; merging ${files.length} audio files...`;

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) throw new Error('Web Audio API is not supported in this browser.');
        const ctx = new AudioCtx();
        const decoded = [];
        for (let i = 0; i < files.length; i++) {
          const arrBuf = await files[i].arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(arrBuf.slice(0));
          decoded.push(audioBuf);
        }

        const sampleRate = decoded[0].sampleRate || 44100;
        const numChannels = Math.min(2, Math.max(...decoded.map(b => b.numberOfChannels || 1)));
        const gapFrames = Math.floor(gapSec * sampleRate);
        let totalFrames = 0;
        decoded.forEach((b, idx) => {
          totalFrames += b.length + (idx < decoded.length - 1 ? gapFrames : 0);
        });

        const mergedBuffer = ctx.createBuffer(numChannels, totalFrames, sampleRate);
        let writeOffset = 0;
        decoded.forEach((buf, idx) => {
          for (let ch = 0; ch < numChannels; ch++) {
            const srcData = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1));
            mergedBuffer.getChannelData(ch).set(srcData, writeOffset);
          }
          writeOffset += buf.length + (idx < decoded.length - 1 ? gapFrames : 0);
        });

        const wavBlob = encodeAudioBufferToWavBlob(mergedBuffer);
        if (window.__lastMergedAdminWavUrl) {
          try { URL.revokeObjectURL(window.__lastMergedAdminWavUrl); } catch (e) {}
        }
        const blobUrl = URL.createObjectURL(wavBlob);
        window.__lastMergedAdminWavUrl = blobUrl;
        window.__lastMergedAdminWavBlob = wavBlob;

        const durLabel = window.formatMediaClipSec(mergedBuffer.duration);
        const sizeMb = (wavBlob.size / (1024 * 1024)).toFixed(2);
        try { await ctx.close(); } catch (e) {}

        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#059669; font-weight:800;"><i class="fa-solid fa-circle-check"></i> Successfully merged ${files.length} audio files! Total Length: ${durLabel} (${sizeMb} MB)</span>`;
        }
        if (resultEl) {
          resultEl.style.display = 'flex';
          resultEl.innerHTML = `
            <audio controls src="${blobUrl}" style="width:100%; height:38px;"></audio>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              <a href="${blobUrl}" download="merged-dictation-${Date.now()}.wav" class="btn btn-primary btn-sm" style="text-decoration:none;">
                <i class="fa-solid fa-download"></i> Download Merged WAV (${sizeMb} MB)
              </a>
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('adm-upload-url').value = window.__lastMergedAdminWavUrl || ''; showToast('Filled merged audio URL for current session! For permanent cloud hosting, upload the downloaded WAV to Drive/GitHub/Supabase and paste its link.');">
                <i class="fa-solid fa-link"></i> Use in Session URL Box
              </button>
              <span style="font-size:11px; color:var(--text-muted);">Tip: Upload the downloaded WAV to Google Drive / GitHub / Supabase and paste the permanent link above.</span>
            </div>
          `;
        }
        showToast(`✅ Merged ${files.length} audio files (${durLabel})!`);
      } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626; font-weight:700;">Failed to merge audio files: ${err.message || err}</span>`;
        showToast('⚠️ Could not decode one of the selected audio files. Try standard MP3/WAV files.');
      } finally {
        if (btn) btn.disabled = false;
      }
    }

export function syncAdminAutoDeleteDaysPreset(daysVal) {
      const dtInput = document.getElementById('adm-upload-autodelete-at');
      if (!dtInput) return;
      if (!daysVal) {
        dtInput.value = '';
        return;
      }
      if (daysVal === 'custom') {
        dtInput.focus();
        return;
      }
      const days = parseInt(daysVal, 10);
      if (!isNaN(days) && days > 0) {
        const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const pad = n => String(n).padStart(2, '0');
        dtInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }

portalState.currentAdminMaterialPage = 1;

export const ADMIN_MATERIALS_PER_PAGE = 30;

export const selectedAdminMaterialIds = new Set();

export let lastFilteredAdminMaterialIds = [];

export let lastPageAdminMaterialIds = [];

export function updateAdminMaterialsBulkBarUI() {
      const count = selectedAdminMaterialIds.size;
      const countEl = document.getElementById('admin-mat-selected-count');
      const btnCountEl = document.getElementById('admin-mat-bulk-delete-count');
      const delBtn = document.getElementById('admin-mat-bulk-delete-btn');
      const headerChk = document.getElementById('admin-mat-select-all-page');
      if (countEl) countEl.textContent = String(count);
      if (btnCountEl) btnCountEl.textContent = String(count);
      if (delBtn) delBtn.disabled = count === 0;
      if (headerChk) {
        headerChk.checked = lastPageAdminMaterialIds.length > 0 && lastPageAdminMaterialIds.every(id => selectedAdminMaterialIds.has(id));
      }
    }

export function toggleAdminMaterialRowSelect(id, checked) {
      const key = String(id || '').trim();
      if (!key) return;
      if (checked) selectedAdminMaterialIds.add(key);
      else selectedAdminMaterialIds.delete(key);
      updateAdminMaterialsBulkBarUI();
    }

export function toggleAdminMaterialsSelectAllPage(forceChecked) {
      const allSelected = lastPageAdminMaterialIds.length > 0 && lastPageAdminMaterialIds.every(id => selectedAdminMaterialIds.has(id));
      const targetState = typeof forceChecked === 'boolean' ? forceChecked : !allSelected;
      lastPageAdminMaterialIds.forEach(id => {
        if (targetState) selectedAdminMaterialIds.add(id);
        else selectedAdminMaterialIds.delete(id);
      });
      document.querySelectorAll('.admin-mat-row-chk').forEach(chk => {
        chk.checked = targetState;
      });
      updateAdminMaterialsBulkBarUI();
    }

export function selectAllFilteredAdminMaterials() {
      lastFilteredAdminMaterialIds.forEach(id => selectedAdminMaterialIds.add(id));
      document.querySelectorAll('.admin-mat-row-chk').forEach(chk => { chk.checked = true; });
      updateAdminMaterialsBulkBarUI();
      showToast(`Selected all ${selectedAdminMaterialIds.size} filtered content item(s).`);
    }

export function clearAdminMaterialSelection() {
      selectedAdminMaterialIds.clear();
      document.querySelectorAll('.admin-mat-row-chk').forEach(chk => { chk.checked = false; });
      const conf = document.getElementById('admin-materials-bulk-confirm');
      if (conf) conf.style.display = 'none';
      updateAdminMaterialsBulkBarUI();
    }

export function promptBulkDeleteSelectedMaterials() {
      const count = selectedAdminMaterialIds.size;
      if (count === 0) {
        showToast('Select at least one material using the checkboxes first.');
        return;
      }
      const conf = document.getElementById('admin-materials-bulk-confirm');
      const txt = document.getElementById('admin-materials-bulk-confirm-text');
      if (txt) txt.textContent = `Permanently delete ${count} selected content item(s) from Google Sheets? This cannot be undone.`;
      if (conf) conf.style.display = 'flex';
    }

export async function confirmBulkDeleteSelectedMaterials() {
      const ids = Array.from(selectedAdminMaterialIds);
      if (!ids.length) return;
      const conf = document.getElementById('admin-materials-bulk-confirm');
      if (conf) conf.style.display = 'none';
      const delBtn = document.getElementById('admin-mat-bulk-delete-btn');
      if (delBtn) { delBtn.disabled = true; delBtn.innerHTML = '<span class="mini-spin"></span> Deleting...'; }
      try {
        const res = await apiCall('bulkDeleteMaterials', { ids });
        showToast(res?.message || `Deleted ${ids.length} selected item(s).`);
        if (res && res.success) {
          const delSet = new Set((res.deletedIds || ids).map(String));
          if (portalState.adminData && Array.isArray(portalState.adminData.materials)) {
            portalState.adminData.materials = portalState.adminData.materials.filter(m => !delSet.has(String(m.ID)));
          }
          if (Array.isArray(portalState.materialsData)) {
            portalState.materialsData = portalState.materialsData.filter(m => !delSet.has(String(m.ID)));
          }
          selectedAdminMaterialIds.clear();
          saveFastPortalCache();
          renderAdminMaterialsTable();
          loadAdminData();
        }
      } finally {
        if (delBtn) {
          delBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete Selected (<span id="admin-mat-bulk-delete-count">${selectedAdminMaterialIds.size}</span>)`;
          delBtn.disabled = selectedAdminMaterialIds.size === 0;
        }
      }
    }

export function hydrateAdminAutoDeletePolicyUI() {
      const p = (portalState.adminData && portalState.adminData.contentAutoDeletePolicy) || {};
      const en = document.getElementById('admin-autodelete-enable-chk');
      const days = document.getElementById('admin-autodelete-days-input');
      const typeSel = document.getElementById('admin-autodelete-type-select');
      const expChk = document.getElementById('admin-autodelete-expired-chk');
      const sum = document.getElementById('admin-autodelete-due-summary');
      if (en && !en.dataset.userTouched) en.checked = Boolean(p.enabled);
      if (days && !days.dataset.userTouched) days.value = p.defaultDays ? String(p.defaultDays) : '';
      if (typeSel && !typeSel.dataset.userTouched) typeSel.value = (Array.isArray(p.targetTypes) && p.targetTypes[0]) ? p.targetTypes[0] : 'all';
      if (expChk && !expChk.dataset.userTouched) expChk.checked = Boolean(p.deleteExpiredAutomatically);

      const allMats = (portalState.adminData && Array.isArray(portalState.adminData.materials)) ? portalState.adminData.materials : [];
      let scheduledCount = 0;
      let dueCount = 0;
      const nowMs = Date.now();
      allMats.forEach(m => {
        let meta = {};
        try { if (m.ExtraMetaJson && m.ExtraMetaJson !== '-') meta = JSON.parse(String(m.ExtraMetaJson)); } catch (e) {}
        if (meta.AutoDeleteAt) {
          scheduledCount++;
          const ms = new Date(meta.AutoDeleteAt).getTime();
          if (!isNaN(ms) && nowMs >= ms) dueCount++;
        }
      });
      if (sum) {
        const parts = [];
        if (p.enabled && p.defaultDays > 0) parts.push(`Policy: >${p.defaultDays}d`);
        if (p.deleteExpiredAutomatically) parts.push('Auto-purge expired ON');
        if (scheduledCount > 0) parts.push(`${scheduledCount} scheduled (${dueCount} due now)`);
        sum.textContent = parts.length ? parts.join(' · ') : 'No auto-delete rules active';
      }
    }

export async function saveAdminContentAutoDeletePolicy() {
      const enabled = Boolean(document.getElementById('admin-autodelete-enable-chk')?.checked);
      const defaultDays = Math.max(0, parseInt(document.getElementById('admin-autodelete-days-input')?.value || '0', 10) || 0);
      const targetType = document.getElementById('admin-autodelete-type-select')?.value || 'all';
      const deleteExpiredAutomatically = Boolean(document.getElementById('admin-autodelete-expired-chk')?.checked);
      const res = await apiCall('saveContentAutoDeletePolicy', {
        enabled,
        defaultDays,
        targetTypes: [targetType],
        deleteExpiredAutomatically
      });
      if (res && res.success) {
        if (portalState.adminData) portalState.adminData.contentAutoDeletePolicy = res.policy || { enabled, defaultDays, targetTypes: [targetType], deleteExpiredAutomatically };
        hydrateAdminAutoDeletePolicyUI();
      }
      showToast(res?.message || 'Auto-Delete policy saved.');
    }

export async function runAutoDeleteExpiredMaterialsNow() {
      const enabled = Boolean(document.getElementById('admin-autodelete-enable-chk')?.checked);
      const defaultDays = Math.max(0, parseInt(document.getElementById('admin-autodelete-days-input')?.value || '0', 10) || 0);
      const targetType = document.getElementById('admin-autodelete-type-select')?.value || 'all';
      const includeExpired = Boolean(document.getElementById('admin-autodelete-expired-chk')?.checked);
      const res = await apiCall('purgeExpiredMaterials', {
        includeExpired,
        maxAgeDays: enabled ? defaultDays : 0,
        targetTypes: [targetType]
      });
      showToast(res?.message || 'Auto-delete check finished.');
      if (res && res.success && res.deletedCount > 0) {
        selectedAdminMaterialIds.clear();
        loadAdminData();
      }
    }

export async function scheduleDailyAutoDeleteTrigger() {
      const res = await apiCall('setupAutoDeleteMaterialsTrigger', {});
      showToast(res?.message || 'Daily Auto-Delete trigger request sent.');
    }

export function renderAdminMaterialsTable() {
      const container = document.getElementById('admin-materials-table-container');
      const pageIndicator = document.getElementById('admin-materials-page-indicator');
      const searchInput = document.getElementById('admin-search-materials');
      const typeFilterSelect = document.getElementById('admin-filter-material-type');
      
      if (!container) return;
      hydrateAdminAutoDeletePolicyUI();

      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
      if (search && typeFilterSelect) {
        typeFilterSelect.value = 'ALL';
      }

      const typeFilter = typeFilterSelect ? typeFilterSelect.value : 'ALL';
      const allMaterials = sortMaterialsLatestFirst(portalState.adminData.materials || []);
      
      let filtered = [];
      if (search) {
        filtered = allMaterials.filter(m => {
          const title = String(m.Title || '').toLowerCase();
          const subtab = String(m.Subtab || '').toLowerCase();
          const cat = String(m.Category || '').toLowerCase();
          const id = String(m.ID || '').toLowerCase();
          return title.includes(search) || subtab.includes(search) || cat.includes(search) || id.includes(search);
        });
      } else {
        filtered = [...allMaterials];
      }

      if (typeFilter !== 'ALL') {
        filtered = filtered.filter(m => String(m.Type || '').toLowerCase() === typeFilter.toLowerCase());
      }

      lastFilteredAdminMaterialIds = filtered.map(m => String(m.ID || '')).filter(Boolean);

      const totalPages = Math.ceil(filtered.length / ADMIN_MATERIALS_PER_PAGE) || 1;
      if (portalState.currentAdminMaterialPage > totalPages) portalState.currentAdminMaterialPage = totalPages;
      if (portalState.currentAdminMaterialPage < 1) portalState.currentAdminMaterialPage = 1;

      const startIndex = (portalState.currentAdminMaterialPage - 1) * ADMIN_MATERIALS_PER_PAGE;
      const paginatedList = filtered.slice(startIndex, startIndex + ADMIN_MATERIALS_PER_PAGE);
      lastPageAdminMaterialIds = paginatedList.map(m => String(m.ID || '')).filter(Boolean);

      if (pageIndicator) {
        pageIndicator.innerText = `Page ${portalState.currentAdminMaterialPage} of ${totalPages} (${filtered.length} total items)`;
      }

      if (paginatedList.length === 0) {
        updateAdminMaterialsBulkBarUI();
        container.innerHTML = window.buildRpEmptyStateHtml(
          'No materials added yet',
          search ? `No materials matched "${search}". Clear the search or upload a new passage.` : 'Upload your first audio dictation, typing passage, PDF, Pitman plate, or CBT exam above.',
          'Add New Material',
          "document.getElementById('adm-upload-title')?.focus()"
        );
        return;
      }

      const allPageSelected = lastPageAdminMaterialIds.length > 0 && lastPageAdminMaterialIds.every(id => selectedAdminMaterialIds.has(id));
      let html = `<table border="1" borderColor="var(--border)" cellpadding="8" style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="background:var(--background); color:var(--secondary);">
          <th style="width:36px; text-align:center;"><input type="checkbox" id="admin-mat-select-all-page" ${allPageSelected ? 'checked' : ''} onchange="toggleAdminMaterialsSelectAllPage(this.checked)" title="Select all materials on this page" style="width:16px; height:16px; cursor:pointer;"></th>
          <th>ID</th><th>Type</th><th>Title / Master Passage</th><th>Subtab / Exam Name</th><th>Time Limit Source</th><th>Auto-Delete / Expiry</th><th>Access</th><th>Actions</th>
        </tr>`;

      paginatedList.forEach(m => {
        const mId = String(m.ID || '');
        const mType = String(m.Type || '').toLowerCase();
        const isChecked = selectedAdminMaterialIds.has(mId);
        let timeLabel = m.TimeLimit ? m.TimeLimit + ' Mins' : '-';
        if (mType === 'learningtyping') {
          timeLabel = '<span style="color:#059669; font-weight:700;">Auto (User Time)</span>';
        } else if (['audio', 'pitman', 'typingtest', 'cbttest'].includes(mType)) {
          const cleanSub = (m.Subtab && m.Subtab !== '-' && m.Subtab !== 'ALL') ? String(m.Subtab).toLowerCase().replace(/\s+/g, '_') : '';
          const rObj = (cleanSub && portalState.allEvaluationRules[`${mType}_${cleanSub}`])
            ? portalState.allEvaluationRules[`${mType}_${cleanSub}`]
            : getEvaluationRulesForTab(mType);
          timeLabel = `<span style="color:var(--primary); font-weight:700;">${rObj?.timeLimit || m.TimeLimit || 10} Mins (Eval Rule)</span>`;
        } else if (mType === 'videocourse' || mType === 'video') {
          timeLabel = `<span style="color:#7c3aed; font-weight:700;">${m.TimeLimit || 'Auto'} Mins (Video)</span>`;
        }
        let meta = {};
        try { if (m.ExtraMetaJson && m.ExtraMetaJson !== '-') meta = JSON.parse(String(m.ExtraMetaJson)); } catch (e) {}
        let scheduleLabel = '<span style="color:var(--text-muted);">Permanent</span>';
        if (meta.AutoDeleteAt) {
          const d = new Date(meta.AutoDeleteAt);
          const isDue = !isNaN(d.getTime()) && Date.now() >= d.getTime();
          scheduleLabel = `<span style="color:${isDue ? '#dc2626' : '#d97706'}; font-weight:700;">${isDue ? 'Due Now' : ('Auto-Del: ' + d.toLocaleDateString())}</span>`;
        } else if (meta.ExpireAt) {
          const d = new Date(meta.ExpireAt);
          scheduleLabel = `<span style="color:#64748b; font-weight:600;">Expires: ${isNaN(d.getTime()) ? meta.ExpireAt : d.toLocaleDateString()}</span>`;
        }

        html += `<tr>
          <td style="text-align:center;"><input type="checkbox" class="admin-mat-row-chk" value="${escapeHtml(mId)}" ${isChecked ? 'checked' : ''} onchange="toggleAdminMaterialRowSelect('${mId.replace(/'/g, "\\'")}', this.checked)" style="width:16px; height:16px; cursor:pointer;"></td>
          <td class="mono-num">${escapeHtml(mId || '-')}</td>
          <td>${escapeHtml(m.Type || '-')}</td>
          <td>${escapeHtml(m.Title || '-')}</td>
          <td>${escapeHtml(m.Subtab || '-')}</td>
          <td>${timeLabel}</td>
          <td>${scheduleLabel}</td>
          <td>${escapeHtml(m.AccessLevel || 'user')}</td>
          <td>
            <div style="display:flex; gap:5px; flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" onclick="editMaterialItem('${mId.replace(/'/g, "\\'")}')">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteMaterialItem('${mId.replace(/'/g, "\\'")}')">Delete</button>
            </div>
          </td>
        </tr>`;
      });

      html += `</table>`;
      container.innerHTML = html;
      updateAdminMaterialsBulkBarUI();
    }

export function paginateAdminMaterials(direction) {
      const searchInput = document.getElementById('admin-search-materials');
      const typeFilterSelect = document.getElementById('admin-filter-material-type');
      
      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const typeFilter = typeFilterSelect ? typeFilterSelect.value : 'ALL';
      const allMaterials = sortMaterialsLatestFirst(portalState.adminData.materials || []);

      let filtered = [];
      if (search) {
        filtered = allMaterials.filter(m => 
          String(m.Title || '').toLowerCase().includes(search) ||
          String(m.Subtab || '').toLowerCase().includes(search) ||
          String(m.Category || '').toLowerCase().includes(search) ||
          String(m.ID || '').toLowerCase().includes(search)
        );
      } else {
        filtered = [...allMaterials];
      }

      if (typeFilter !== 'ALL') {
        filtered = filtered.filter(m => String(m.Type || '').toLowerCase() === typeFilter.toLowerCase());
      }

      const totalPages = Math.ceil(filtered.length / ADMIN_MATERIALS_PER_PAGE) || 1;

      if (direction === 1 && portalState.currentAdminMaterialPage < totalPages) {
        portalState.currentAdminMaterialPage++;
      } else if (direction === -1 && portalState.currentAdminMaterialPage > 1) {
        portalState.currentAdminMaterialPage--;
      }
      renderAdminMaterialsTable();
    }

export async function deleteMaterialItem(id, skipConfirm = false) {
      if (!skipConfirm && typeof window.rpConfirmDelete === 'function') {
        window.rpConfirmDelete('Delete Material?', 'Are you sure you want to permanently delete this material from Google Sheets?', () => deleteMaterialItem(id, true));
        return;
      }
      const res = await apiCall('deleteMaterial', { id: id });
      showToast(res.message || 'Material deleted.');
      if (res.success) {
        selectedAdminMaterialIds.delete(String(id));
        loadAdminData();
      }
    }

export async function handleAddSubtab() {
      const type = document.getElementById('new-subtab-type').value;
      const name = document.getElementById('new-subtab-name').value;

      if (!type || !name.trim()) {
        showToast('Please select material type and enter subtab name (*).');
        return;
      }

      const res = await apiCall('manageSubtab', { subAction: 'add', type: type, subtabName: name });
      showToast(res.message);
      if (res.success) {
        resetSubtabForm();
        loadAdminData();
      }
    }

export function resetSubtabForm() {
      const form = document.getElementById('admin-subtab-form');
      if (form) form.reset();
      showToast('Subtab form reset.');
    }

portalState.currentAdminSubtabPage = 1;

export const ADMIN_SUBTABS_PER_PAGE = 30;

export function renderAdminSubtabsTable() {
      const container = document.getElementById('admin-subtabs-table-container');
      const pageIndicator = document.getElementById('admin-subtabs-page-indicator');
      const searchInput = document.getElementById('admin-search-subtabs');
      const typeFilterSelect = document.getElementById('admin-filter-subtab-type');
      
      if (!container) return;

      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
      if (search && typeFilterSelect) {
        typeFilterSelect.value = 'ALL';
      }

      const typeFilter = typeFilterSelect ? typeFilterSelect.value : 'ALL';
      const allSubtabs = portalState.adminData.subtabs || [];
      
      let filtered = [];
      if (search) {
        filtered = allSubtabs.filter(stb => {
          const name = String(stb.SubtabName || '').toLowerCase();
          const type = String(stb.Type || '').toLowerCase();
          return name.includes(search) || type.includes(search);
        });
      } else {
        filtered = [...allSubtabs];
      }

      if (typeFilter !== 'ALL') {
        filtered = filtered.filter(stb => String(stb.Type || '').toLowerCase() === typeFilter.toLowerCase());
      }

      const totalPages = Math.ceil(filtered.length / ADMIN_SUBTABS_PER_PAGE) || 1;
      if (portalState.currentAdminSubtabPage > totalPages) portalState.currentAdminSubtabPage = totalPages;
      if (portalState.currentAdminSubtabPage < 1) portalState.currentAdminSubtabPage = 1;

      const startIndex = (portalState.currentAdminSubtabPage - 1) * ADMIN_SUBTABS_PER_PAGE;
      const paginatedList = filtered.slice(startIndex, startIndex + ADMIN_SUBTABS_PER_PAGE);

      if (pageIndicator) {
        pageIndicator.innerText = `Page ${portalState.currentAdminSubtabPage} of ${totalPages} (${filtered.length} total subtabs)`;
      }

      if (paginatedList.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);">No matching subtabs found${search ? ' for search: ' + search : ''}.</div>`;
        return;
      }

      let html = `<table border="1" borderColor="var(--border)" cellpadding="8" style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="background:var(--border);"><th>Type</th><th>Subtab Name</th><th>Actions</th></tr>`;

      paginatedList.forEach((stb) => {
        html += `<tr>
          <td>${stb.Type || '-'}</td><td>${stb.SubtabName || '-'}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="promptEditSubtab('${stb.Type}', '${stb.SubtabName}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteSubtabItem('${stb.Type}', '${stb.SubtabName}')">Delete</button>
          </td>
        </tr>`;
      });
      html += `</table>`;
      container.innerHTML = html;
    }

export function paginateAdminSubtabs(direction) {
      const searchInput = document.getElementById('admin-search-subtabs');
      const typeFilterSelect = document.getElementById('admin-filter-subtab-type');
      
      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const typeFilter = typeFilterSelect ? typeFilterSelect.value : 'ALL';
      const allSubtabs = portalState.adminData.subtabs || [];

      let filtered = [];
      if (search) {
        filtered = allSubtabs.filter(stb => 
          String(stb.SubtabName || '').toLowerCase().includes(search) ||
          String(stb.Type || '').toLowerCase().includes(search)
        );
      } else {
        filtered = [...allSubtabs];
      }

      if (typeFilter !== 'ALL') {
        filtered = filtered.filter(stb => String(stb.Type || '').toLowerCase() === typeFilter.toLowerCase());
      }

      const totalPages = Math.ceil(filtered.length / ADMIN_SUBTABS_PER_PAGE) || 1;

      if (direction === 1 && portalState.currentAdminSubtabPage < totalPages) {
        portalState.currentAdminSubtabPage++;
      } else if (direction === -1 && portalState.currentAdminSubtabPage > 1) {
        portalState.currentAdminSubtabPage--;
      }
      renderAdminSubtabsTable();
    }

export function promptEditSubtab(oldType, oldSubtabName) {
      let modal = document.getElementById('inline-edit-subtab-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'inline-edit-subtab-modal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'z-index: 9500; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15,23,42,0.75);';
        document.body.appendChild(modal);
      }
      const safeType = String(oldType || '').replace(/'/g, "\\'");
      const safeOld = String(oldSubtabName || '').replace(/'/g, "\\'");
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 440px; width: 100%; border-radius: 14px; padding: 20px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 20px 45px rgba(0,0,0,0.35);">
          <h4 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 800; color: var(--secondary);"><i class="fa-solid fa-pen-to-square" style="color: var(--primary);"></i> Edit Subtab Name [${oldType}]</h4>
          <p style="margin: 0 0 10px 0; font-size: 12px; color: var(--text-muted);">Renaming this subtab will also update materials assigned to "${oldSubtabName}".</p>
          <input type="text" id="inline-edit-subtab-input" class="form-control" value="${String(oldSubtabName || '').replace(/"/g, '&quot;')}" style="margin-bottom: 14px;">
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('inline-edit-subtab-modal').style.display='none'">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="confirmInlineEditSubtab('${safeType}', '${safeOld}')"><i class="fa-solid fa-check"></i> Save Subtab</button>
          </div>
        </div>
      `;
      modal.style.display = 'flex';
      setTimeout(() => document.getElementById('inline-edit-subtab-input')?.focus(), 50);
    }

export async function confirmInlineEditSubtab(oldType, oldSubtabName) {
      const inp = document.getElementById('inline-edit-subtab-input');
      const newName = inp ? inp.value.trim() : '';
      if (!newName) {
        showToast('Please enter a valid subtab name.');
        return;
      }
      const modal = document.getElementById('inline-edit-subtab-modal');
      if (modal) modal.style.display = 'none';
      const res = await apiCall('manageSubtab', {
        subAction: 'edit',
        type: oldType,
        oldSubtabName: oldSubtabName,
        newSubtabName: newName
      });
      showToast(res.message);
      if (res.success) loadAdminData();
    }

export async function deleteSubtabItem(type, subtabName, skipConfirm = false) {
      if (!skipConfirm && typeof window.rpConfirmDelete === 'function') {
        window.rpConfirmDelete('Delete Subtab Category?', `Delete category "${subtabName}"?`, () => deleteSubtabItem(type, subtabName, true));
        return;
      }
      const res = await apiCall('manageSubtab', { subAction: 'delete', type: type, subtabName: subtabName });
      showToast(res.message || `Deleted subtab "${subtabName}".`);
      if (res.success) loadAdminData();
    }

export async function handleSaveBannerSettings() {
      const enableChk = document.getElementById('banner-enable-chk');
      const startInput = document.getElementById('banner-start-input');
      const stopInput = document.getElementById('banner-stop-input');
      const textInput = document.getElementById('banner-text-input');

      let enabledState = enableChk ? enableChk.checked : false;
      const stopVal = stopInput ? stopInput.value : '';
      let isExpired = false;

      if (stopVal) {
        const stopDate = new Date(stopVal);
        if (!isNaN(stopDate.getTime()) && new Date() > stopDate) {
          enabledState = false;
          isExpired = true;
          if (enableChk) enableChk.checked = false;
        }
      }

      const bannerPayload = {
        enabled: enabledState,
        expiredAutoDisabled: isExpired,
        startTime: startInput ? startInput.value : '',
        stopTime: stopVal,
        text: textInput ? textInput.value.trim() : ''
      };

      const res = await apiCall('updateBannerSettings', bannerPayload);
      showToast(isExpired ? 'Stop Time has already passed — Banner automatically marked as Disabled.' : (res.message || 'Banner settings updated successfully.'));
      if (!portalState.adminData) portalState.adminData = {};
      portalState.adminData.banner = bannerPayload;
      portalState.globalData.banner = bannerPayload;
      renderAdminBannersTable();
      renderPromoBanner();
    }

export function renderAdminBannersTable() {
      const container = document.getElementById('admin-banners-table-container');
      if (!container) return;

      let banner = { enabled: false, startTime: '', stopTime: '', text: '' };
      try {
        if (portalState.adminData && portalState.adminData.banner) {
          banner = (typeof portalState.adminData.banner === 'string') ? JSON.parse(portalState.adminData.banner) : portalState.adminData.banner;
        }
      } catch (e) {
        console.error("Error parsing banner data:", e);
      }

      // 👉 Check if stopTime has passed right now!
      let isExpiredNow = false;
      if (banner.stopTime) {
        const stopDate = new Date(banner.stopTime);
        if (!isNaN(stopDate.getTime()) && new Date() > stopDate) {
          isExpiredNow = true;
          banner.enabled = false;
        }
      }

      const enableChk = document.getElementById('banner-enable-chk');
      const startInput = document.getElementById('banner-start-input');
      const stopInput = document.getElementById('banner-stop-input');
      const textInput = document.getElementById('banner-text-input');

      const isBannerActive = !isExpiredNow && (banner.enabled === true || String(banner.enabled).toLowerCase() === 'true');

      if (enableChk) enableChk.checked = isBannerActive;
      if (startInput) startInput.value = banner.startTime ? String(banner.startTime).substring(0, 16) : '';
      if (stopInput) stopInput.value = banner.stopTime ? String(banner.stopTime).substring(0, 16) : '';
      if (textInput) textInput.value = banner.text || '';

      const statusBadgeText = isExpiredNow
        ? 'Disabled (Time Expired)'
        : (isBannerActive ? 'Active' : 'Disabled');

      container.innerHTML = `
        <table border="1" borderColor="var(--border)" cellpadding="8" style="width:100%; border-collapse:collapse; font-size:12px; margin-top:10px;">
          <tr style="background:var(--border);">
            <th>Status</th><th>Start Time</th><th>Stop Time</th><th>Banner Text</th><th>Actions</th>
          </tr>
          <tr>
            <td>
              <span style="color: ${isBannerActive ? '#16a34a' : '#dc2626'}; font-weight: 800;">
                ${statusBadgeText}
              </span>
            </td>
            <td>${banner.startTime || '-'}</td>
            <td>${banner.stopTime || '-'}</td>
            <td>${banner.text || '-'}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteBannerItem('active')">Reset Banner</button></td>
          </tr>
        </table>
      `;
    }

export async function deleteBannerItem(id, skipConfirm = false) {
      if (!skipConfirm && typeof window.rpConfirmDelete === 'function') {
        window.rpConfirmDelete('Delete Top Banner?', 'Clear and disable the active website top banner?', () => deleteBannerItem(id, true));
        return;
      }
      const res = await apiCall('updateBannerSettings', { enabled: false, startTime: '', stopTime: '', text: '' });
      showToast(res.message || 'Top Banner reset.');
      if (!portalState.adminData) portalState.adminData = {};
      portalState.adminData.banner = { enabled: false, startTime: '', stopTime: '', text: '' };
      if (portalState.globalData) portalState.globalData.banner = portalState.adminData.banner;
      renderAdminBannersTable();
      renderPromoBanner();
    }

export function handleSaveDateSpecificBanner() {
      const dateEl = document.getElementById('date-banner-date-input') || document.getElementById('banner-specific-date-input');
      const textEl = document.getElementById('date-banner-text-input') || document.getElementById('banner-specific-text-input');
      const dateVal = dateEl ? dateEl.value.trim() : '';
      const textVal = textEl ? textEl.value.trim() : '';

      if (!dateVal || !textVal) {
        showToast('Please select a specific date and enter the banner matter (*).');
        return;
      }

      const map = getDateSpecificBannersMap();
      map[dateVal] = {
        date: dateVal,
        text: textVal,
        enabled: true,
        updatedBy: portalState.currentUser?.name || 'Admin',
        updatedAt: new Date().toISOString()
      };
      saveDateSpecificBannersMap(map);
      if (typeof logPortalAction === 'function') {
        logPortalAction('DATE_BANNER_SAVE', `Saved Date-Specific Top Banner for ${dateVal}: "${textVal}"`);
      }
      if (textEl) textEl.value = '';
      renderAdminDateBannersTable();
      renderPromoBanner();
      showToast(`✅ Date-Specific Top Banner saved for ${dateVal}!`);
    }

export function deleteDateSpecificBanner(dateKey, skipConfirm = false) {
      if (!skipConfirm && typeof window.rpConfirmDelete === 'function') {
        window.rpConfirmDelete('Delete Scheduled Banner?', `Remove the date-specific banner scheduled for ${dateKey}?`, () => deleteDateSpecificBanner(dateKey, true));
        return;
      }
      const map = getDateSpecificBannersMap();
      delete map[dateKey];
      saveDateSpecificBannersMap(map);
      renderAdminDateBannersTable();
      renderPromoBanner();
      showToast(`Removed Date-Specific Banner for ${dateKey}.`);
    }

export function renderAdminDateBannersTable() {
      const container = document.getElementById('admin-date-banners-table-container');
      if (!container) return;
      const map = getDateSpecificBannersMap();
      const keys = Object.keys(map).sort().reverse();
      const todayIso = getLocalDateString();

      if (keys.length === 0) {
        container.innerHTML = `<div style="padding:10px; font-size:12px; color:var(--text-muted); background:var(--surface); border-radius:6px; border:1px dashed var(--border);">No date-specific top website banners scheduled yet. Add a date above (e.g. Today: <strong>${todayIso}</strong>) to automatically display that matter on that date.</div>`;
        return;
      }

      let html = `<table border="1" borderColor="var(--border)" cellpadding="8" style="width:100%; border-collapse:collapse; font-size:12px; background:var(--surface);">
        <tr style="background:var(--border);">
          <th>Target Date</th><th>Status</th><th>Banner Matter Text</th><th>Actions</th>
        </tr>`;
      keys.forEach(k => {
        const entry = map[k];
        const isToday = k === todayIso;
        html += `<tr>
          <td><strong>${k}</strong> ${isToday ? '<span class="subtab-badge" style="background:#10b981; color:#fff;">TODAY</span>' : ''}</td>
          <td><span style="color:${isToday ? '#16a34a' : 'var(--primary)'}; font-weight:800;">${isToday ? '🟢 Live Today' : '📅 Scheduled'}</span></td>
          <td>${entry.text || '-'}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteDateSpecificBanner('${k}')">Delete</button>
          </td>
        </tr>`;
      });
      html += `</table>`;
      container.innerHTML = html;
    }

export function updateDashboardBannerAdminLivePreview() {
      const imgIn = document.getElementById('dash-banner-image-url');
      const previewBox = document.getElementById('dash-banner-admin-photo-preview');
      if (!imgIn || !previewBox) return;
      const rawUrl = String(imgIn.value || '').trim();
      if (!rawUrl) {
        previewBox.style.display = 'none';
        previewBox.innerHTML = '';
        return;
      }
      const resolved = getUniversalUrl(rawUrl, 'image');
      previewBox.style.display = 'block';
      previewBox.innerHTML = `<img src="${resolved}" alt="Preview" style="width:100%; max-height:110px; object-fit:cover; display:block;" onerror="this.parentElement.style.display='none'">`;
    }

window._adminDashBannerSlidesDraft = window._adminDashBannerSlidesDraft || [];

export function renderAdminDashBannerSlidesList() {
      const listEl = document.getElementById('admin-dash-banner-slides-list');
      const countEl = document.getElementById('admin-dash-slides-count-label');
      const slides = Array.isArray(window._adminDashBannerSlidesDraft) ? window._adminDashBannerSlidesDraft : [];
      if (countEl) countEl.textContent = `${slides.length} Slide${slides.length === 1 ? '' : 's'} Active`;
      if (!listEl) return;
      if (slides.length === 0) {
        listEl.innerHTML = `<div style="padding:14px; text-align:center; font-size:12px; color:var(--text-muted); border:1px dashed var(--border); border-radius:10px;">No carousel slides added yet. Enter an Image URL or upload a photo above and click <strong>Add Slide to Carousel</strong>.</div>`;
        return;
      }
      listEl.innerHTML = slides.map((s, idx) => {
        const thumb = s.imageUrl ? getUniversalUrl(s.imageUrl, 'image') : '';
        return `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border:1px solid var(--border); border-radius:10px; background:var(--surface); flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:220px;">
              <span class="mono-num" style="font-size:11px; font-weight:800; color:var(--primary); width:22px;">#${idx + 1}</span>
              ${thumb ? `<img src="${thumb}" alt="Slide ${idx + 1}" style="width:74px; height:42px; object-fit:cover; border-radius:6px; border:1px solid var(--border); cursor:pointer;" onclick="openEmbeddedImageModal('${thumb.replace(/'/g, "\\'")}', 'Banner Slide #${idx + 1}')" onerror="this.style.opacity='0.25'">` : `<div style="width:74px; height:42px; border-radius:6px; border:1px dashed var(--border); display:flex; align-items:center; justify-content:center; font-size:10px; color:var(--text-muted);">Text Only</div>`}
              <div style="min-width:0;">
                <div style="font-size:12.5px; font-weight:700; color:var(--secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px;">${escapeHtml(s.title || ('Slide ' + (idx + 1)))}</div>
                <div style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px;">${escapeHtml(s.text || s.imageUrl || '-')}</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
              <button type="button" class="btn btn-secondary btn-sm" style="padding:3px 7px;" onclick="moveAdminDashBannerSlide(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
              <button type="button" class="btn btn-secondary btn-sm" style="padding:3px 7px;" onclick="moveAdminDashBannerSlide(${idx}, 1)" ${idx === slides.length - 1 ? 'disabled' : ''} title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
              <button type="button" class="btn btn-danger btn-sm" style="padding:3px 8px;" onclick="removeAdminDashBannerSlide(${idx})" title="Remove Slide"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        `;
      }).join('');
    }

export function addSlideToDashboardCarouselDraft() {
      const imgIn = document.getElementById('dash-banner-image-url') || document.getElementById('dash-banner-img-input');
      const titleIn = document.getElementById('dash-banner-title-input');
      const textIn = document.getElementById('dash-banner-text-input');
      const ctaChk = document.getElementById('dash-banner-cta-enable');
      const ctaTextIn = document.getElementById('dash-banner-cta-text');
      const ctaLinkIn = document.getElementById('dash-banner-cta-link');

      const imageUrl = imgIn ? imgIn.value.trim() : '';
      const title = titleIn ? titleIn.value.trim() : '';
      const text = textIn ? textIn.value.trim() : '';
      const ctaText = (ctaChk && ctaChk.checked && ctaTextIn) ? ctaTextIn.value.trim() : '';
      const ctaLink = (ctaChk && ctaChk.checked && ctaLinkIn) ? ctaLinkIn.value.trim() : '';

      if (!imageUrl && !title && !text) {
        showToast('⚠️ Enter an Image URL (or upload a photo) or Slide Heading/Text first.');
        return;
      }
      if (!Array.isArray(window._adminDashBannerSlidesDraft)) window._adminDashBannerSlidesDraft = [];
      if (window._adminDashBannerSlidesDraft.length >= 15) {
        showToast('⚠️ Maximum 15 slides allowed in the Dashboard Carousel.');
        return;
      }
      window._adminDashBannerSlidesDraft.push({ imageUrl, title, text, ctaText, ctaLink });
      if (imgIn) imgIn.value = '';
      if (titleIn) titleIn.value = '';
      if (textIn) textIn.value = '';
      const previewBox = document.getElementById('dash-banner-live-img-preview');
      if (previewBox) { previewBox.style.display = 'none'; previewBox.innerHTML = ''; }
      renderAdminDashBannerSlidesList();
      showToast(`✅ Slide #${window._adminDashBannerSlidesDraft.length} added! Click "Save & Publish Carousel" to make it live.`);
    }

export function handleDashboardBannerFileUpload(event) {
      const file = event && event.target && event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        const img = new Image();
        img.onload = function() {
          const maxW = 1200;
          const scale = img.width > maxW ? (maxW / img.width) : 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const imgIn = document.getElementById('dash-banner-image-url');
          if (imgIn) imgIn.value = dataUrl;
          updateDashboardBannerAdminLivePreview();
          showToast('🖼️ Image loaded! Click "+ Add Slide to Carousel" to append it.');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }

export function moveAdminDashBannerSlide(idx, dir) {
      const arr = window._adminDashBannerSlidesDraft || [];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return;
      const tmp = arr[idx];
      arr[idx] = arr[target];
      arr[target] = tmp;
      renderAdminDashBannerSlidesList();
    }

export function removeAdminDashBannerSlide(idx, skipConfirm = false) {
      if (!Array.isArray(window._adminDashBannerSlidesDraft)) return;
      if (!skipConfirm && typeof window.rpConfirmDelete === 'function') {
        window.rpConfirmDelete('Remove Promo Slide?', 'Remove this promotional slide from the carousel draft?', () => removeAdminDashBannerSlide(idx, true));
        return;
      }
      window._adminDashBannerSlidesDraft.splice(idx, 1);
      renderAdminDashBannerSlidesList();
      showToast('Slide removed from draft. Click "Save & Publish Carousel" to apply.');
    }

export function adjustDashboardBannerFormColumns() {
      const modeSel = document.getElementById('dash-banner-mode-select');
      const schedSel = document.getElementById('dash-banner-schedule-type');
      const schedCol = document.getElementById('dash-banner-schedule-col');
      const dateCol = document.getElementById('dash-banner-date-col');
      const fieldsWrapper = document.getElementById('dash-banner-dynamic-fields-wrapper');
      const photoCol = document.getElementById('dash-banner-photo-col');
      const textGroup = document.getElementById('dash-banner-text-cols-group');
      const ctaChk = document.getElementById('dash-banner-cta-enable');
      const ctaCols = document.getElementById('dash-banner-cta-cols');
      const disabledNotice = document.getElementById('dash-banner-disabled-notice');

      const mode = modeSel ? modeSel.value : 'both';
      const sched = schedSel ? schedSel.value : 'always';

      if (mode === 'hidden') {
        if (fieldsWrapper) fieldsWrapper.style.display = 'none';
        if (schedCol) schedCol.style.display = 'none';
        if (dateCol) dateCol.style.display = 'none';
        if (disabledNotice) disabledNotice.style.display = 'block';
        return;
      }

      if (disabledNotice) disabledNotice.style.display = 'none';
      if (schedCol) schedCol.style.display = 'block';
      if (dateCol) dateCol.style.display = (sched === 'specific_date') ? 'block' : 'none';
      if (fieldsWrapper) fieldsWrapper.style.display = 'grid';

      if (photoCol) photoCol.style.display = (mode === 'photo' || mode === 'both') ? 'block' : 'none';
      if (textGroup) textGroup.style.display = (mode === 'text' || mode === 'both') ? 'flex' : 'none';
      if (ctaCols) ctaCols.style.display = (ctaChk && ctaChk.checked) ? 'grid' : 'none';
      updateDashboardBannerAdminLivePreview();
    }

export function loadDashboardBannerIntoAdminForm() {
      const cfg = getDashboardCustomBannerConfig();
      const modeSel = document.getElementById('dash-banner-mode-select');
      const schedSel = document.getElementById('dash-banner-schedule-type');
      const dateIn = document.getElementById('dash-banner-target-date');
      const autoSecIn = document.getElementById('dash-banner-autoscroll-sec');
      const imgIn = document.getElementById('dash-banner-image-url') || document.getElementById('dash-banner-img-input');
      const titleIn = document.getElementById('dash-banner-title-input');
      const textIn = document.getElementById('dash-banner-text-input');
      const ctaChk = document.getElementById('dash-banner-cta-enable');
      const ctaTextIn = document.getElementById('dash-banner-cta-text');
      const ctaLinkIn = document.getElementById('dash-banner-cta-link');

      const resolvedMode = (cfg && cfg.mode) ? cfg.mode : 'both';
      const resolvedSched = (cfg && cfg.scheduleType) ? cfg.scheduleType : (cfg && cfg.targetDate ? 'specific_date' : 'always');

      if (modeSel) modeSel.value = resolvedMode;
      if (schedSel) schedSel.value = resolvedSched;
      if (dateIn) dateIn.value = cfg.targetDate || '';
      if (autoSecIn) autoSecIn.value = String(cfg.autoScrollSeconds || 4);

      // Hydrate draft slides list from cfg.slides or legacy top-level fields
      if (Array.isArray(cfg.slides) && cfg.slides.length > 0) {
        window._adminDashBannerSlidesDraft = cfg.slides.map(s => ({ ...s }));
      } else if (cfg.imageUrl || cfg.title || cfg.text) {
        window._adminDashBannerSlidesDraft = [{
          imageUrl: cfg.imageUrl || '',
          title: cfg.title || '',
          text: cfg.text || '',
          ctaText: cfg.ctaText || '',
          ctaLink: cfg.ctaLink || ''
        }];
      } else {
        window._adminDashBannerSlidesDraft = [];
      }

      if (imgIn) imgIn.value = '';
      if (titleIn) titleIn.value = '';
      if (textIn) textIn.value = '';
      if (ctaTextIn) ctaTextIn.value = cfg.ctaText || '';
      if (ctaLinkIn) ctaLinkIn.value = cfg.ctaLink || '';
      if (ctaChk) ctaChk.checked = Boolean((cfg.ctaText && cfg.ctaText.trim()) || (cfg.ctaLink && cfg.ctaLink.trim()));

      renderAdminDashBannerSlidesList();
      adjustDashboardBannerFormColumns();
      renderAdminDashboardBannersTable();
    }

export function handleSaveDashboardCustomBanner() {
      const modeSel = document.getElementById('dash-banner-mode-select');
      const schedSel = document.getElementById('dash-banner-schedule-type');
      const dateIn = document.getElementById('dash-banner-target-date');
      const autoSecIn = document.getElementById('dash-banner-autoscroll-sec');
      const imgIn = document.getElementById('dash-banner-image-url') || document.getElementById('dash-banner-img-input');
      const titleIn = document.getElementById('dash-banner-title-input');
      const textIn = document.getElementById('dash-banner-text-input');
      const ctaChk = document.getElementById('dash-banner-cta-enable');
      const ctaTextIn = document.getElementById('dash-banner-cta-text');
      const ctaLinkIn = document.getElementById('dash-banner-cta-link');

      const mode = modeSel ? modeSel.value : 'both';
      const scheduleType = schedSel ? schedSel.value : 'always';
      const targetDate = (scheduleType === 'specific_date' && dateIn) ? dateIn.value.trim() : '';
      const autoScrollSeconds = Math.max(2, Math.min(30, parseInt(autoSecIn ? autoSecIn.value : '4', 10) || 4));

      // If admin typed into the composer fields directly without clicking "+ Add Slide", auto-append it!
      const typedImg = imgIn ? imgIn.value.trim() : '';
      const typedTitle = titleIn ? titleIn.value.trim() : '';
      const typedText = textIn ? textIn.value.trim() : '';
      const typedCtaText = (ctaChk && ctaChk.checked && ctaTextIn) ? ctaTextIn.value.trim() : '';
      const typedCtaLink = (ctaChk && ctaChk.checked && ctaLinkIn) ? ctaLinkIn.value.trim() : '';

      let slides = Array.isArray(window._adminDashBannerSlidesDraft) ? window._adminDashBannerSlidesDraft.slice() : [];
      if (typedImg || typedTitle || typedText) {
        slides.push({ imageUrl: typedImg, title: typedTitle, text: typedText, ctaText: typedCtaText, ctaLink: typedCtaLink });
        window._adminDashBannerSlidesDraft = slides;
        if (imgIn) imgIn.value = '';
        if (titleIn) titleIn.value = '';
        if (textIn) textIn.value = '';
      }

      if (mode !== 'hidden') {
        if (scheduleType === 'specific_date' && !targetDate) {
          showToast('⚠️ Please select a Target Date for the date-specific Dashboard Banner.');
          return;
        }
        if (slides.length === 0) {
          showToast('⚠️ Please add at least one banner slide (Image URL or Heading/Text).');
          return;
        }
      }

      const firstSlide = slides[0] || {};
      const cfg = {
        mode: mode,
        scheduleType: scheduleType,
        targetDate: targetDate,
        autoScrollSeconds: autoScrollSeconds,
        slides: slides,
        imageUrl: firstSlide.imageUrl || '',
        title: firstSlide.title || '',
        text: firstSlide.text || '',
        ctaText: firstSlide.ctaText || typedCtaText || '',
        ctaLink: firstSlide.ctaLink || typedCtaLink || '',
        updatedAt: new Date().toISOString()
      };
      saveDashboardCustomBannerConfig(cfg);
      apiCall('updateDashboardCustomBanner', cfg, true);
      if (typeof logPortalAction === 'function') {
        logPortalAction('DASHBOARD_BANNER_UPDATE', `Updated Dashboard Carousel (${slides.length} slides, ${autoScrollSeconds}s auto-scroll, Mode: ${mode})`);
      }
      renderAdminDashBannerSlidesList();
      renderDashboardCustomBanner();
      renderAdminDashboardBannersTable();
      showToast(`✅ Dashboard Carousel saved with ${slides.length} slide${slides.length === 1 ? '' : 's'} (auto-scroll ${autoScrollSeconds}s)!`);
    }

export function editDashboardCustomBanner() {
      loadDashboardBannerIntoAdminForm();
      const formCard = document.getElementById('dash-banner-mode-select');
      if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('✏️ Loaded Dashboard Carousel into editor.');
    }

export function resetDashboardCustomBanner() {
      window._adminDashBannerSlidesDraft = [];
      const emptyCfg = { mode: 'hidden', scheduleType: 'always', targetDate: '', autoScrollSeconds: 4, slides: [], title: '', text: '', imageUrl: '', ctaText: '', ctaLink: '' };
      saveDashboardCustomBannerConfig(emptyCfg);
      apiCall('updateDashboardCustomBanner', emptyCfg, true);
      loadDashboardBannerIntoAdminForm();
      renderDashboardCustomBanner();
      renderAdminDashboardBannersTable();
      showToast('Dashboard Banner Carousel disabled and cleared.');
    }

export function renderAdminDashboardBannersTable() {
      const container = document.getElementById('admin-dashboard-banners-table-container');
      if (!container) return;
      const cfg = getDashboardCustomBannerConfig();
      const slidesCount = Array.isArray(cfg.slides) && cfg.slides.length > 0 ? cfg.slides.length : ((cfg.imageUrl || cfg.title || cfg.text) ? 1 : 0);
      const isConfigured = cfg && cfg.mode !== 'hidden' && slidesCount > 0;
      if (!isConfigured) {
        container.innerHTML = `<div style="padding:10px; font-size:12px; color:var(--text-muted); background:var(--surface); border-radius:8px; border:1px dashed var(--border);">No active Dashboard Carousel configured. Add slides above and click Save & Publish.</div>`;
        return;
      }
      const modeLabels = { both: 'Photos + Caption Overlay', photo: 'Full-Bleed Photos Only', text: 'Announcement Cards', hidden: 'Hidden' };
      const todayIso = getLocalDateString();
      const isDateActive = !cfg.targetDate || cfg.targetDate === todayIso;
      const statusBadge = isDateActive
        ? `<span style="color:#059669; font-weight:800;">● Live on Dashboard</span>`
        : `<span style="color:#d97706; font-weight:800;">⏳ Scheduled (${cfg.targetDate})</span>`;

      container.innerHTML = `
        <div class="table-responsive">
          <table class="rp-admin-clean-table">
            <thead>
              <tr><th>Status</th><th>Mode</th><th>Slides & Auto-Scroll</th><th>Schedule</th><th>Actions</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>${statusBadge}</td>
                <td><strong>${modeLabels[cfg.mode] || cfg.mode}</strong></td>
                <td class="mono-num"><strong>${slidesCount} Slide${slidesCount === 1 ? '' : 's'}</strong> • Every ${cfg.autoScrollSeconds || 4}s</td>
                <td>${cfg.targetDate ? `📅 ${cfg.targetDate}` : 'Every Day'}</td>
                <td>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="editDashboardCustomBanner()"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="resetDashboardCustomBanner()"><i class="fa-solid fa-trash-can"></i> Clear</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

export function toggleMaintenanceModeFieldsUI() {
      const modeSel = document.getElementById('maint-mode-select');
      const box = document.getElementById('maint-tabs-selection-box');
      const lbl = document.getElementById('maint-tabs-selection-label');
      const mode = modeSel ? modeSel.value : 'full_site';
      if (box) {
        box.style.display = mode === 'full_site' ? 'none' : 'block';
      }
      if (lbl) {
        lbl.innerText = mode === 'only_selected_tabs_work'
          ? '✅ Select Tabs That Will WORK During Maintenance (Unchecked tabs will show Maintenance Message):'
          : '🛠️ Select Tabs That Are UNDER MAINTENANCE (Unchecked tabs will work normally):';
      }
    }

export function setAllMaintenanceTabCheckboxes(checked) {
      document.querySelectorAll('.maint-tab-chk').forEach(chk => {
        chk.checked = Boolean(checked);
      });
    }

export function formatIsoForDatetimeLocal(isoStr) {
      if (!isoStr) return '';
      const raw = String(isoStr).trim();
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);
      const d = new Date(raw);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

export function loadMaintenanceSettingsIntoAdminForm() {
      const cfg = getMaintenanceConfig();
      const enableChk = document.getElementById('maint-enable-chk');
      const modeSel = document.getElementById('maint-mode-select');
      const msgIn = document.getElementById('maint-message-input');
      const startIn = document.getElementById('maint-scheduled-start');
      const endIn = document.getElementById('maint-scheduled-end');

      if (enableChk) enableChk.checked = Boolean(cfg.manualEnabled);
      if (modeSel) modeSel.value = cfg.mode || 'full_site';
      if (msgIn) msgIn.value = cfg.message || '🚧 Our portal is currently undergoing scheduled maintenance and upgrades. Please check back shortly!';
      if (startIn) startIn.value = formatIsoForDatetimeLocal(cfg.scheduledStart);
      if (endIn) endIn.value = formatIsoForDatetimeLocal(cfg.scheduledEnd);

      const targetTabs = cfg.mode === 'selected_tabs_under_maintenance'
        ? (cfg.maintenanceTabs || [])
        : (cfg.workingTabs || ['dashboard']);
      document.querySelectorAll('.maint-tab-chk').forEach(chk => {
        chk.checked = targetTabs.includes(chk.value);
      });

      toggleMaintenanceModeFieldsUI();
      renderAdminMaintenanceStatusTable();
    }

export async function handleSaveMaintenanceSettings() {
      const enableChk = document.getElementById('maint-enable-chk');
      const modeSel = document.getElementById('maint-mode-select');
      const msgIn = document.getElementById('maint-message-input');
      const startIn = document.getElementById('maint-scheduled-start');
      const endIn = document.getElementById('maint-scheduled-end');

      const manualEnabled = enableChk ? enableChk.checked : false;
      const mode = modeSel ? modeSel.value : 'full_site';
      const message = (msgIn && msgIn.value.trim())
        ? msgIn.value.trim()
        : '🚧 Our portal is currently undergoing scheduled maintenance and upgrades. Please check back shortly!';
      const scheduledStart = startIn && startIn.value ? startIn.value.trim() : '';
      const scheduledEnd = endIn && endIn.value ? endIn.value.trim() : '';

      if (scheduledStart && scheduledEnd && Date.parse(scheduledEnd) <= Date.parse(scheduledStart)) {
        showToast('Scheduled End time must be after Scheduled Start time.');
        return;
      }

      const selectedTabs = [];
      document.querySelectorAll('.maint-tab-chk').forEach(chk => {
        if (chk.checked) selectedTabs.push(chk.value);
      });

      const win = evaluateMaintenanceWindowClient({ manualEnabled, scheduledStart, scheduledEnd });
      if ((manualEnabled || win.active) && mode === 'only_selected_tabs_work' && selectedTabs.length === 0) {
        showToast('Please select at least 1 tab to keep working, or choose "Full Site Under Maintenance".');
        return;
      }

      const cfg = {
        enabled: win.active,
        manualEnabled,
        mode,
        message,
        scheduledStart,
        scheduledEnd,
        windowState: win.state,
        workingTabs: mode === 'only_selected_tabs_work' ? selectedTabs : ALL_STUDENT_PORTAL_TABS.filter(t => !selectedTabs.includes(t)),
        maintenanceTabs: mode === 'selected_tabs_under_maintenance' ? selectedTabs : (mode === 'full_site' ? ALL_STUDENT_PORTAL_TABS : ALL_STUDENT_PORTAL_TABS.filter(t => !selectedTabs.includes(t))),
        updatedAt: new Date().toISOString()
      };

      saveMaintenanceConfigToStorage(cfg, true);
      renderAdminMaintenanceStatusTable();

      const res = await apiCall('updateMaintenanceSettings', cfg);
      logPortalAction('MAINTENANCE_SETTINGS_UPDATE', `Updated Maintenance Mode: ${cfg.enabled ? 'ACTIVE (' + mode + ')' : 'SCHEDULED/OFF'}${scheduledStart ? ' [' + scheduledStart + ' -> ' + (scheduledEnd || 'open') + ']' : ''}`);
      showToast(res && res.message ? res.message : (cfg.enabled ? '🚧 Maintenance settings saved & active!' : (scheduledStart ? '🗓️ Scheduled maintenance window saved!' : '✅ Maintenance Mode disabled!')));
    }

export async function resetMaintenanceSettings() {
      const cfg = {
        enabled: false,
        manualEnabled: false,
        mode: 'full_site',
        message: '🚧 Our portal is currently undergoing scheduled maintenance and upgrades. Please check back shortly!',
        scheduledStart: '',
        scheduledEnd: '',
        windowState: 'inactive',
        workingTabs: ['dashboard'],
        maintenanceTabs: []
      };
      saveMaintenanceConfigToStorage(cfg, true);
      loadMaintenanceSettingsIntoAdminForm();
      await apiCall('updateMaintenanceSettings', cfg);
      showToast('✅ Maintenance Mode & scheduled windows cleared — All tabs are now working normally!');
    }

export function renderAdminMaintenanceStatusTable() {
      const container = document.getElementById('admin-maintenance-status-container');
      if (!container) return;
      const cfg = getMaintenanceConfig();
      const workingTabs = getWorkingTabsUnderMaintenance().map(t => TAB_DISPLAY_META[t]?.label || t);
      const blockedTabs = ALL_STUDENT_PORTAL_TABS.filter(t => isTabUnderMaintenance(t)).map(t => TAB_DISPLAY_META[t]?.label || t);

      const modeLabels = {
        full_site: '🛑 Full Site Under Maintenance',
        only_selected_tabs_work: '✅ Only Selected Tabs Work',
        selected_tabs_under_maintenance: '🛠️ Selected Tabs Under Maintenance'
      };
      const statusBadge = cfg.enabled
        ? `<span style="font-weight:800; color:#d97706;">🚧 ACTIVE (${cfg.windowState === 'scheduled_active' ? 'Scheduled Window' : 'Manual'})</span>`
        : (cfg.windowState === 'scheduled_upcoming'
          ? `<span style="font-weight:800; color:#2563eb;">🗓️ SCHEDULED UPCOMING</span>`
          : `<span style="font-weight:800; color:#16a34a;">🟢 NORMAL (OFF)</span>`);
      const windowLabel = (cfg.scheduledStart || cfg.scheduledEnd)
        ? `${cfg.scheduledStart ? cfg.scheduledStart.replace('T', ' ') : 'Immediate'} → ${cfg.scheduledEnd ? cfg.scheduledEnd.replace('T', ' ') : 'Manual Exit'}`
        : 'Manual Toggle Only';

      container.innerHTML = `
        <table border="1" borderColor="var(--border)" cellpadding="8" style="width:100%; border-collapse:collapse; font-size:12px; background:var(--surface);">
          <tr style="background:var(--border);">
            <th>Status</th><th>Mode</th><th>Scheduled Window</th><th>Custom Message</th><th>Working Tabs</th><th>Under Maintenance</th>
          </tr>
          <tr>
            <td>${statusBadge}</td>
            <td><strong>${modeLabels[cfg.mode] || cfg.mode}</strong></td>
            <td style="font-size:11.5px; font-weight:700; color:var(--secondary);">${escapeHtml(windowLabel)}</td>
            <td style="max-width:240px;">${escapeHtml(cfg.message || '-')}</td>
            <td style="color:#16a34a; font-weight:700;">${cfg.enabled ? (workingTabs.join(', ') || 'Admin Panel Only') : 'All Tabs Working'}</td>
            <td style="color:#dc2626; font-weight:700;">${cfg.enabled ? (blockedTabs.join(', ') || 'None') : 'None'}</td>
          </tr>
        </table>
      `;
    }

window.runTestHistoryMonthlyArchival = function() {
    if (typeof apiCall === 'function') {
      apiCall('archiveOldTestHistoryRows', { retentionDays: 90 }, true);
    }
    const el = document.getElementById('suite-archival-status');
    if (el) el.innerHTML = `✅ Rotated rows older than 90 days into <code>TEST_HISTORY_ARCHIVE</code> sheet (Last run: ${new Date().toLocaleTimeString()}).`;
    if (typeof showToast === 'function') showToast('🗄️ Automated Monthly Sheet Archival executed (90-day shard)!');
  };

window.downloadFeeReceiptHtml = function(idx) {
    const item = window.__enterpriseSuiteState.feeLedgerItems[idx] || window.__enterpriseSuiteState.feeLedgerItems[0];
    if (!item) return;
    const htmlDoc = `<!doctype html><html><head><meta charset="utf-8"><title>Fee Receipt ${item.receiptNo}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}.box{border:2px solid #0d9488;border-radius:12px;padding:24px;max-width:640px;margin:0 auto}</style></head><body><div class="box"><h2>🏛️ RP SKILL | RANJAN PATHSHALA — OFFICIAL FEE RECEIPT</h2><p><strong>Receipt No:</strong> ${item.receiptNo} | <strong>Date:</strong> ${new Date().toISOString().slice(0,10)}</p><hr><p><strong>Student:</strong> ${item.studentName} (${item.studentId})</p><p><strong>Batch:</strong> ${item.batchName} | <strong>Installment:</strong> #${item.installmentNo}</p><p><strong>Amount Paid:</strong> ₹${item.amountPaid} (${item.paymentMode}) | <strong>Balance Due:</strong> ₹${item.balanceDue}</p><p><strong>Account Validity Extended Until:</strong> ${item.validUntil}</p></div></body></html>`;
    const blob = new Blob([htmlDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.receiptNo}_${item.studentId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast(`🧾 Downloaded Fee Receipt ${item.receiptNo}!`);
  };

window.dispatchTelegramBatchAlert = function() {
    const msg = ((document.getElementById('suite-telegram-msg') || {}).value || '📢 Live Shorthand Mock starts at 7:00 PM sharp!').trim();
    if (typeof apiCall === 'function') {
      apiCall('sendTelegramBatchWebhookAlert', { batchName: window.currentDashboardMonitoredBatch || 'RP-Trail', messageText: msg }, true);
    }
    const stEl = document.getElementById('suite-telegram-status');
    if (stEl) stEl.innerHTML = `✅ Dispatched via Telegram Bot Webhook at ${new Date().toLocaleTimeString()}: <em>"${msg}"</em>`;
    if (typeof showToast === 'function') showToast('✈️ Telegram Batch Webhook Alert Dispatched!');
  };

window.runBulkCsvStudentOnboarding = async function() {
    const csv = ((document.getElementById('suite-csv-onboard-input') || {}).value || '').trim();
    const outEl = document.getElementById('suite-csv-onboard-status');
    const requireVerification = document.getElementById('suite-csv-require-verification-chk')
      ? document.getElementById('suite-csv-require-verification-chk').checked
      : true;
    const sendWelcomeEmail = document.getElementById('suite-csv-send-welcome-chk')
      ? document.getElementById('suite-csv-send-welcome-chk').checked
      : true;

    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      if (typeof showToast === 'function') showToast('⚠️ Paste at least one student CSV line first.');
      return;
    }

    const rows = lines.map((l, idx) => {
      const p = l.split(',').map(x => x.trim());
      // Support both formats:
      // 1) Full Name, Email, Mobile(10-digit), BatchName, Password(optional)
      // 2) StudentID, Name, Email, BatchName (legacy 4-col where col[2] contains '@')
      if (p[2] && p[2].includes('@') && !(p[1] && p[1].includes('@'))) {
        return {
          userId: p[0],
          name: p[1],
          email: p[2],
          mobile: p[4] && /^\d{10}$/.test(p[4].replace(/\D/g, '')) ? p[4].replace(/\D/g, '') : '',
          batch: p[3] || 'RP-Trail',
          password: p[5] || ''
        };
      }
      return {
        userId: 'STU-' + String(Date.now() + idx).slice(-6),
        name: p[0] || '',
        email: p[1] || '',
        mobile: (p[2] || '').replace(/\D/g, ''),
        batch: p[3] || 'RP-Trail',
        password: p[4] || ''
      };
    }).filter(r => r.name || r.email);

    if (rows.length === 0) {
      if (typeof showToast === 'function') showToast('⚠️ No valid student rows found. Format: Full Name, Email, Mobile, Batch');
      return;
    }

    if (outEl) outEl.innerHTML = `<span class="mini-spin"></span> Onboarding <strong>${rows.length}</strong> students &amp; queuing verification workflow...`;

    if (typeof apiCall === 'function') {
      const res = await apiCall('bulkOnboardStudentsCsv', {
        students: rows,
        requireVerification: requireVerification,
        sendWelcomeEmail: sendWelcomeEmail
      });
      if (res && res.success) {
        if (outEl) {
          outEl.innerHTML = `✅ <strong>${res.createdCount || 0}</strong> new students onboarded (${res.skippedCount || 0} duplicates skipped). ${requireVerification ? 'Email &amp; Mobile OTP verification is enforced on first login.' : 'Pre-verified.'}`;
        }
        if (typeof showToast === 'function') showToast(res.message || `🎓 Onboarded ${res.createdCount || 0} students!`);
        if (typeof loadAdminData === 'function') loadAdminData();
        return;
      }
      if (outEl) outEl.innerHTML = `❌ ${escapeHtml((res && res.message) || 'Bulk onboarding failed.')}`;
      if (typeof showToast === 'function') showToast((res && res.message) || 'Bulk onboarding failed.');
    }
  };

window.switchCbtWorkspaceSubView = function(mode) {
    const catalogBtn = document.getElementById('cbt-subview-btn-catalog');
    const subtabsBar = document.getElementById('cbttest-subtabs');
    const catalogGrid = document.getElementById('cbttest-grid');
    if (mode === 'notebook') {
      if (typeof window.openCbtSavedMcqsNotebookModal === 'function') {
        window.openCbtSavedMcqsNotebookModal();
      }
      return;
    }
    if (subtabsBar) subtabsBar.style.display = 'flex';
    if (catalogGrid) catalogGrid.style.display = 'grid';
    if (catalogBtn) catalogBtn.className = 'btn btn-primary btn-sm';
  };

window.renderAdminEnterpriseOpsSubtab = function() {
    const feeListEl = document.getElementById('admin-enterprise-fee-ledger-list');
    if (feeListEl) {
      const items = window.__enterpriseSuiteState.feeLedgerItems || [];
      if (items.length === 0) {
        feeListEl.innerHTML = window.buildRpEmptyStateHtml(
          'No fee installment records yet',
          'Record your first student installment receipt and enrollment validity using the form above.',
          'Add Fee Record',
          "document.getElementById('admin-fee-student-name')?.focus()"
        );
      } else {
        feeListEl.innerHTML = items.map((f, i) => `
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:6px 10px; font-size:11.5px;">
            <div><strong>${window.escapeHtml(f.studentName)}</strong> (${window.escapeHtml(f.receiptNo)}) · Paid ₹${Number(f.amountPaid || 0)}</div>
            <button type="button" class="btn btn-primary btn-sm" style="padding:3px 9px; font-size:10.5px;" onclick="downloadFeeReceiptHtml(${i})">Receipt</button>
          </div>
        `).join('');
      }
    }

    const branchListEl = document.getElementById('admin-enterprise-branches-list');
    if (branchListEl) {
      const branches = window.__enterpriseSuiteState.franchiseBranches || [];
      if (branches.length === 0) {
        branchListEl.innerHTML = window.buildRpEmptyStateHtml(
          'No franchise branches configured yet',
          'Add an institute branch code and city above to track multi-center batches.',
          'Add First Branch',
          "document.getElementById('admin-branch-name-input')?.focus()"
        );
      } else {
        branchListEl.innerHTML = branches.map(b => `
          <div style="font-size:11px; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:6px 10px; display:flex; justify-content:space-between;">
            <span><strong>${window.escapeHtml(b.branchName)}</strong> (${window.escapeHtml(b.city)})</span>
            <span style="color:#0d9488; font-weight:800; font-variant-numeric: tabular-nums;">${Number(b.activeStudents || 0)} Students</span>
          </div>
        `).join('');
      }
    }
    if (typeof window.loadAdminWhatsAppGatewayConfig === 'function') {
      window.loadAdminWhatsAppGatewayConfig();
    }
  };

window.loadAdminWhatsAppGatewayConfig = async function() {
    const urlEl = document.getElementById('admin-whatsapp-webhook-url');
    const reqEl = document.getElementById('admin-whatsapp-require-signup-chk');
    const stEl = document.getElementById('admin-whatsapp-gateway-status');
    if (!urlEl && !stEl) return;
    const res = await apiCall('getWhatsAppGatewayConfig', {}, true);
    if (!res || !res.success) return;
    if (urlEl && res.webhookUrl) urlEl.value = res.webhookUrl;
    if (reqEl) reqEl.checked = Boolean(res.requireWhatsAppOnSignup);
    if (stEl) {
      stEl.innerHTML = res.configured
        ? `<span style="color:#059669; font-weight:700;">Active:</span> WhatsApp OTP Webhook is configured.${res.requireWhatsAppOnSignup ? ' Strict signup verification is ON.' : ' Optional mode (Email OTP completes signup if WhatsApp fails).'}`
        : `<span style="color:#b45309; font-weight:700;">Not configured yet:</span> Paste your WhatsApp webhook URL above to start delivering real WhatsApp OTPs during registration.`;
    }
  };

window.saveAdminWhatsAppGatewayConfig = async function() {
    const urlEl = document.getElementById('admin-whatsapp-webhook-url');
    const reqEl = document.getElementById('admin-whatsapp-require-signup-chk');
    const stEl = document.getElementById('admin-whatsapp-gateway-status');
    const webhookUrl = (urlEl ? urlEl.value : '').trim();
    const requireWhatsAppOnSignup = Boolean(reqEl && reqEl.checked);
    if (stEl) stEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving WhatsApp Gateway settings...`;
    const res = await apiCall('saveWhatsAppGatewayConfig', {
      webhookUrl,
      requireWhatsAppOnSignup
    }, true);
    if (res && res.success) {
      if (stEl) {
        stEl.innerHTML = res.configured
          ? `<span style="color:#059669; font-weight:700;">Saved &amp; Active:</span> ${window.escapeHtml(res.message || 'WhatsApp Gateway configured.')}`
          : `<span style="color:#b45309; font-weight:700;">Saved (Gateway Cleared):</span> Signups will use Email OTP only until a webhook URL is saved.`;
      }
      if (typeof showToast === 'function') showToast(res.message || 'WhatsApp OTP Gateway settings saved!');
    } else {
      if (stEl) stEl.innerHTML = `<span style="color:#dc2626; font-weight:700;">Error:</span> ${window.escapeHtml((res && res.message) || 'Could not save WhatsApp settings.')}`;
      if (typeof showToast === 'function') showToast((res && res.message) || 'Failed to save WhatsApp settings.');
    }
  };

window.addAdminFeeLedgerEntry = function() {
    const nameEl = document.getElementById('admin-fee-student-name');
    const idEl = document.getElementById('admin-fee-student-id');
    const amtEl = document.getElementById('admin-fee-amount-paid');
    const studentName = (nameEl ? nameEl.value : '').trim();
    const studentId = (idEl ? idEl.value : '').trim() || ('STU-' + Math.floor(100 + Math.random() * 900));
    const amountPaid = parseFloat(amtEl ? amtEl.value : '0') || 0;
    if (!studentName || amountPaid <= 0) {
      if (typeof showToast === 'function') showToast('⚠️ Enter Student Name and valid Amount Paid.');
      return;
    }
    const entry = {
      receiptNo: 'RCP-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
      studentId,
      studentName,
      batchName: 'RP-Trail',
      installmentNo: 1,
      totalFee: amountPaid,
      amountPaid,
      balanceDue: 0,
      paymentMode: 'UPI',
      validUntil: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
    };
    window.__enterpriseSuiteState.feeLedgerItems.unshift(entry);
    if (typeof apiCall === 'function') {
      apiCall('saveFeeInstallmentRecord', entry, true);
    }
    if (nameEl) nameEl.value = '';
    if (idEl) idEl.value = '';
    if (amtEl) amtEl.value = '';
    window.renderAdminEnterpriseOpsSubtab();
    if (typeof showToast === 'function') showToast('✅ Fee installment recorded & receipt ready!');
  };

window.addAdminFranchiseBranch = function() {
    const nameEl = document.getElementById('admin-branch-name-input');
    const cityEl = document.getElementById('admin-branch-city-input');
    const branchName = (nameEl ? nameEl.value : '').trim();
    const city = (cityEl ? cityEl.value : '').trim() || 'Main City';
    if (!branchName) {
      if (typeof showToast === 'function') showToast('⚠️ Enter a Branch Name first.');
      return;
    }
    window.__enterpriseSuiteState.franchiseBranches.push({
      branchId: 'BR-' + Date.now(),
      branchName,
      city,
      centerHead: (window.currentUser && window.currentUser.name) || 'Admin',
      activeStudents: 0,
      topWpm: 0
    });
    if (typeof apiCall === 'function') {
      apiCall('saveFranchiseBranches', { branches: window.__enterpriseSuiteState.franchiseBranches }, true);
    }
    if (nameEl) nameEl.value = '';
    if (cityEl) cityEl.value = '';
    window.renderAdminEnterpriseOpsSubtab();
    if (typeof showToast === 'function') showToast('🏢 Branch added and saved!');
  };

'use strict';

export const PINNED_RULES_KEY = 'rp_pinned_eval_rules_v1';

export const BATCH_VALIDITY_MAP_KEY = 'rp_batch_validity_map_v1';

export const PAD_ANNOTATIONS_KEY = 'rp_shorthand_pad_annotations_v1';

export const safeNotify = (msg) => {
    if (typeof window.showToast === 'function') window.showToast(msg);
  };

window.toggleAutoScrollBehaviorField = function () {
    const modeSel = document.getElementById('eval-autoscroll-mode');
    const grp = document.getElementById('group-eval-autoscroll-behavior');
    if (!grp) return;
    const isOn = !modeSel || String(modeSel.value || 'on').toLowerCase() === 'on';
    grp.style.display = isOn ? '' : 'none';
  };

window.getPinnedEvaluationRules = function () {
    try {
      const raw = JSON.parse(localStorage.getItem(PINNED_RULES_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(Boolean).slice(0, 3) : [];
    } catch (e) {
      return [];
    }
  };

window.togglePinEvaluationRule = function (ruleKey) {
    const cleanKey = String(ruleKey || '').trim();
    if (!cleanKey) return [];
    let list = window.getPinnedEvaluationRules();
    const idx = list.indexOf(cleanKey);
    if (idx !== -1) {
      list.splice(idx, 1);
      safeNotify('Unpinned evaluation rule from favourites.');
    } else {
      if (list.length >= 3) {
        safeNotify('You can pin up to 3 favourite rules. Unpin one first to add another.');
        return list;
      }
      list.unshift(cleanKey);
      safeNotify('Pinned evaluation rule to top of selector.');
    }
    try { localStorage.setItem(PINNED_RULES_KEY, JSON.stringify(list)); } catch (e) {}
    window.syncExtendedCloudStateToSheets();
    return list;
  };

export const bannerSelectedCards = new Set();

export function renderBannerPromoCardSelectionState() {
    const map = {
      dashpromo: 'admin-banner-dashpromo-card',
      topbanner: 'admin-banner-top-card',
      maintenance: 'admin-banner-maintenance-card'
    };

    Object.keys(map).forEach((key) => {
      const isSelected = bannerSelectedCards.has(key);
      const cardBtn = document.getElementById(`banner-select-card-${key}`);
      const panelEl = document.getElementById(map[key]);
      if (cardBtn) {
        cardBtn.style.borderColor = isSelected ? 'var(--primary)' : 'var(--border)';
        cardBtn.style.background = isSelected ? 'rgba(37, 99, 235, 0.06)' : 'var(--surface)';
        cardBtn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        const checkEl = cardBtn.querySelector('.rp-banner-card-check');
        if (checkEl) {
          checkEl.textContent = isSelected ? '✓ Selected' : 'Click to Open';
          checkEl.style.color = isSelected ? 'var(--primary)' : 'var(--text-muted)';
        }
      }
      if (panelEl) {
        panelEl.style.display = isSelected ? 'block' : 'none';
      }
    });

    const emptyPrompt = document.getElementById('admin-banner-empty-selection-prompt');
    if (emptyPrompt) {
      emptyPrompt.style.display = bannerSelectedCards.size === 0 ? 'block' : 'none';
    }
    const countEl = document.getElementById('admin-banner-selected-count');
    if (countEl) {
      countEl.textContent = bannerSelectedCards.size === 0 ? 'None Selected (Pick 1 Card)' : '1 Card Active';
    }
  }

window.toggleBannerPromoCardSelection = function (cardKey) {
    if (!['dashpromo', 'topbanner', 'maintenance'].includes(cardKey)) return;
    const wasSelected = bannerSelectedCards.has(cardKey);
    // Single-select rule: only ONE card can be active at a time (or 0 when deselected)
    bannerSelectedCards.clear();
    if (!wasSelected) {
      bannerSelectedCards.add(cardKey);
    }
    renderBannerPromoCardSelectionState();
  };

window.selectAllBannerPromoCards = function (selectKey) {
    bannerSelectedCards.clear();
    if (typeof selectKey === 'string' && ['dashpromo', 'topbanner', 'maintenance'].includes(selectKey)) {
      bannerSelectedCards.add(selectKey);
    }
    renderBannerPromoCardSelectionState();
  };

window.resetBannerPromoCardSelection = function () {
    bannerSelectedCards.clear();
    renderBannerPromoCardSelectionState();
  };

window.switchWordsSubtab = function (sub) {
    const isReplies = sub === 'replies';
    const btnDict = document.getElementById('words-subtab-btn-dict');
    const btnRep = document.getElementById('words-subtab-btn-replies');
    const ctrlDict = document.getElementById('words-subpanel-dict-controls');
    const bodyDict = document.getElementById('words-subpanel-dictionary');
    const bodyRep = document.getElementById('words-subpanel-replies');

    if (btnDict) btnDict.classList.toggle('active', !isReplies);
    if (btnRep) btnRep.classList.toggle('active', isReplies);
    if (ctrlDict) ctrlDict.style.display = isReplies ? 'none' : 'flex';
    if (bodyDict) bodyDict.style.display = isReplies ? 'none' : 'block';
    if (bodyRep) bodyRep.style.display = isReplies ? 'block' : 'none';

    if (isReplies && typeof window.loadAndRenderOutlineRequestsTracker === 'function') {
      window.loadAndRenderOutlineRequestsTracker(true);
    }
  };

window.renderOutlineRepliesFiltered = function () {
    const filterVal = document.getElementById('words-outline-reply-filter')?.value || 'all';
    const listEl = document.getElementById('words-outline-requests-list');
    if (!listEl) return;
    listEl.querySelectorAll('[data-outline-status]').forEach((row) => {
      const st = String(row.getAttribute('data-outline-status') || '').toLowerCase();
      if (filterVal === 'all') row.style.display = '';
      else if (filterVal === 'answered') row.style.display = st === 'answered' ? '' : 'none';
      else row.style.display = st !== 'answered' ? '' : 'none';
    });
  };

export let cachedAdminOutlineRequests = [];

window.renderAdminOutlineRepliesDesk = async function (fetchServer = false) {
    const listEl = document.getElementById('admin-outline-replies-list');
    const kpiEl = document.getElementById('admin-outline-replies-kpi-strip');
    if (!listEl) return;

    if (fetchServer || cachedAdminOutlineRequests.length === 0) {
      listEl.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading student outline requests...</div>`;
      if (typeof apiCall === 'function') {
        try {
          const res = await apiCall('getWordOutlineRequests', {}, true);
          if (res && res.success && Array.isArray(res.requests)) {
            cachedAdminOutlineRequests = res.requests;
          }
        } catch (e) {}
      }
      if (cachedAdminOutlineRequests.length === 0 && typeof window.getLocalOutlineRequests === 'function') {
        cachedAdminOutlineRequests = window.getLocalOutlineRequests() || [];
      }
    }

    const total = cachedAdminOutlineRequests.length;
    const answered = cachedAdminOutlineRequests.filter((r) => String(r.status || r.Status || '').toLowerCase() === 'answered').length;
    const pending = total - answered;

    if (kpiEl) {
      kpiEl.innerHTML = `
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">Total Asked Words</div>
          <div style="font-size: 20px; font-weight: 800; color: var(--secondary); font-variant-numeric: tabular-nums;">${total}</div>
        </div>
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">Pending Replies</div>
          <div style="font-size: 20px; font-weight: 800; color: #d97706; font-variant-numeric: tabular-nums;">${pending}</div>
        </div>
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">Answered</div>
          <div style="font-size: 20px; font-weight: 800; color: #059669; font-variant-numeric: tabular-nums;">${answered}</div>
        </div>
      `;
    }

    const statusFilter = String(document.getElementById('admin-outline-replies-status-filter')?.value || 'ALL').trim().toUpperCase();
    const q = (document.getElementById('admin-outline-replies-search')?.value || '').trim().toLowerCase();

    const filtered = cachedAdminOutlineRequests.filter((r) => {
      const st = String(r.status || r.Status || 'PENDING').trim().toUpperCase();
      const isAnswered = st === 'ANSWERED' || st === 'RESOLVED';
      if (statusFilter === 'PENDING' && isAnswered) return false;
      if (statusFilter === 'ANSWERED' && !isAnswered) return false;
      if (q) {
        const hay = `${r.word || r.Word || ''} ${r.requestedByName || r.studentName || ''} ${r.requestedById || r.userId || ''} ${r.batch || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="padding: 28px; text-align: center; border: 1.5px dashed var(--border); border-radius: 10px; color: var(--text-muted); font-size: 13px;">No student outline requests match this filter yet.</div>`;
      return;
    }

    listEl.innerHTML = filtered.map((r) => {
      const rid = String(r.id || r.ID || r.requestId || '');
      const word = String(r.word || r.Word || '-');
      const isAns = String(r.status || r.Status || '').toUpperCase() === 'ANSWERED';
      const student = `${r.requestedByName || r.studentName || 'Student'} (${r.requestedById || r.userId || '-'})`;
      const batch = r.batch || r.Batch || 'RP-Trail';
      const existingNote = String(r.replyNote || r.ReplyNote || r.answer || '');
      const existingImg = String(r.outlineImageUrl || r.OutlineImageUrl || '');
      const safeId = escapeHtml(rid).replace(/'/g, "\\'");

      return `
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
            <div>
              <div style="font-size: 15px; font-weight: 800; color: var(--secondary);">${escapeHtml(word)}</div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">Asked by <strong>${escapeHtml(student)}</strong> · Batch: ${escapeHtml(batch)}</div>
            </div>
            <span style="font-size: 11.5px; font-weight: 800; color: ${isAns ? '#059669' : '#d97706'};">${isAns ? '✓ Answered' : 'Pending Reply'}</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px;">
            <input type="text" id="adm-reply-note-${escapeHtml(rid)}" class="form-control" value="${escapeHtml(existingNote)}" placeholder="Type stroke explanation / Pitman rule reply..." style="font-size: 12px; min-height: 34px; margin: 0;">
            <input type="text" id="adm-reply-img-${escapeHtml(rid)}" class="form-control" value="${escapeHtml(existingImg)}" placeholder="Outline Image URL (Drive / direct image link, optional)" style="font-size: 12px; min-height: 34px; margin: 0;">
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
            <label style="font-size: 11.5px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
              <input type="checkbox" id="adm-reply-pub-${escapeHtml(rid)}"> Also publish outline image to Words Dictionary
            </label>
            <button type="button" class="btn btn-primary btn-sm" style="background: #0d9488; border-color: #0d9488;" onclick="window.submitAdminOutlineReplyToSheet('${safeId}', '${escapeHtml(word).replace(/'/g, "\\'")}')">
              <i class="fa-solid fa-paper-plane"></i> ${isAns ? 'Update Reply' : 'Post Official Reply'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

window.submitAdminOutlineReplyToSheet = async function (reqId, wordText) {
    const noteEl = document.getElementById(`adm-reply-note-${reqId}`);
    const imgEl = document.getElementById(`adm-reply-img-${reqId}`);
    const pubEl = document.getElementById(`adm-reply-pub-${reqId}`);
    const replyNote = (noteEl ? noteEl.value : '').trim();
    const outlineImageUrl = (imgEl ? imgEl.value : '').trim();
    const publishToDictionary = Boolean(pubEl && pubEl.checked);

    if (!replyNote && !outlineImageUrl) {
      safeNotify('Please enter either a stroke explanation or an outline image URL.');
      return;
    }

    const cu = typeof portalState.currentUser !== 'undefined' ? portalState.currentUser : null;
    if (typeof apiCall === 'function') {
      const res = await apiCall('replyWordOutlineRequest', {
        id: reqId,
        requestId: reqId,
        word: wordText,
        replyNote: replyNote,
        outlineImageUrl: outlineImageUrl,
        repliedByName: cu ? cu.name : 'Faculty',
        repliedByRole: cu ? cu.role : 'admin',
        publishToDictionary: publishToDictionary
      }, true);
      if (res && res.success) {
        safeNotify(`Reply posted for "${wordText}" & synced to Google Sheets.`);
        await window.renderAdminOutlineRepliesDesk(true);
        if (typeof window.loadAndRenderOutlineRequestsTracker === 'function') {
          window.loadAndRenderOutlineRequestsTracker(true);
        }
        return;
      }
    }

    // Local fallback update
    const target = cachedAdminOutlineRequests.find((r) => String(r.id || r.ID || r.requestId) === String(reqId));
    if (target) {
      target.status = 'ANSWERED';
      target.replyNote = replyNote;
      target.outlineImageUrl = outlineImageUrl;
      target.repliedByName = cu ? cu.name : 'Faculty';
    }
    safeNotify(`Reply saved for "${wordText}".`);
    window.renderAdminOutlineRepliesDesk(false);
  };

window.getBatchValidityMap = function () {
    try {
      const raw = JSON.parse(localStorage.getItem(BATCH_VALIDITY_MAP_KEY) || '{}');
      return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    } catch (e) {
      return {};
    }
  };

window.saveBatchValidityMap = function (mapObj) {
    const clean = (mapObj && typeof mapObj === 'object') ? mapObj : {};
    try { localStorage.setItem(BATCH_VALIDITY_MAP_KEY, JSON.stringify(clean)); } catch (e) {}
    if (typeof apiCall === 'function') {
      apiCall('saveBatchValidityMap', { batchValidityMap: clean }, true);
    }
  };

window.setNewBatchValidityPresetDays = function (daysCount) {
    const inp = document.getElementById('admin-new-batch-validity-date');
    if (!inp) return;
    const target = new Date(Date.now() + (Number(daysCount) || 30) * 86400000);
    inp.value = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
  };

window.createNewInstituteBatch = function () {
    const nameInp = document.getElementById('admin-new-batch-name-input');
    const valInp = document.getElementById('admin-new-batch-validity-date');
    const newName = nameInp ? nameInp.value.trim() : '';
    const validityDate = valInp ? valInp.value.trim() : '';

    if (!newName) {
      safeNotify('Please enter a Batch name.');
      return;
    }
    if (!validityDate) {
      safeNotify('Please select a Batch Validity expiry date before creating the batch.');
      if (valInp) valInp.focus();
      return;
    }

    const list = typeof getInstituteBatchesList === 'function' ? getInstituteBatchesList() : [];
    if (list.some((b) => String(b).toLowerCase() === newName.toLowerCase())) {
      safeNotify('This Batch name already exists.');
      return;
    }

    const vMap = window.getBatchValidityMap();
    vMap[newName] = validityDate;
    window.saveBatchValidityMap(vMap);

    list.push(newName);
    if (typeof saveInstituteBatchesList === 'function') {
      saveInstituteBatchesList(list);
    }
    if (typeof apiCall === 'function') {
      apiCall('saveInstituteBatches', { batches: list, batchValidityMap: vMap }, true);
    }

    if (nameInp) nameInp.value = '';
    if (valInp) valInp.value = '';

    if (typeof populateAllBatchSelectDropdowns === 'function') populateAllBatchSelectDropdowns();
    if (typeof renderAdminUsers === 'function') renderAdminUsers();
    if (typeof logPortalAction === 'function') {
      logPortalAction('CREATE_BATCH', `Created batch "${newName}" with validity until ${validityDate}`);
    }
    safeNotify(`Created Batch "${newName}" (Valid until ${validityDate}) & synced to Google Sheets.`);
  };

window.populateMonitorCandidatesForSelectedBatch = function () {
    const batchSel = document.getElementById('admin-appoint-monitor-batch-select');
    const userSel = document.getElementById('admin-appoint-monitor-user-select');
    if (!batchSel || !userSel) return;

    const chosenBatch = String(batchSel.value || '').trim();
    if (!chosenBatch) {
      userSel.disabled = true;
      userSel.innerHTML = '<option value="">-- Choose a Batch First --</option>';
      return;
    }

    const allUsersRaw = (typeof portalState.adminData !== 'undefined' && portalState.adminData && Array.isArray(portalState.adminData.users))
      ? portalState.adminData.users.map((u) => (typeof normalizeUserRecord === 'function' ? normalizeUserRecord(u) : u))
      : [];

    const inBatch = allUsersRaw.filter((u) => {
      const uid = String(u.UserID || u.userId || '').trim();
      if (!uid) return false;
      if (typeof userHasBatchAssigned === 'function') {
        return userHasBatchAssigned(uid, chosenBatch, u.Batch || u.batch || '');
      }
      const list = String(u.Batch || u.batch || '').split(',').map((b) => b.trim().toLowerCase());
      return list.includes(chosenBatch.toLowerCase());
    });

    if (inBatch.length === 0) {
      userSel.disabled = true;
      userSel.innerHTML = `<option value="">No students enrolled in "${escapeHtml(chosenBatch)}" yet</option>`;
      return;
    }

    userSel.disabled = false;
    userSel.innerHTML = `<option value="">-- Select Student from ${escapeHtml(chosenBatch)} (${inBatch.length}) --</option>` +
      inBatch.map((u) => {
        const uid = String(u.UserID || u.userId || '');
        const uname = String(u.Name || u.name || uid);
        return `<option value="${escapeHtml(uid)}" data-uname="${escapeHtml(uname)}">${escapeHtml(uname)} (${escapeHtml(uid)})</option>`;
      }).join('');
  };

export const selectedBulkUserIds = new Set();

window.toggleBulkAssignSingleUser = function (uid, checked) {
    if (!uid) return;
    if (checked) selectedBulkUserIds.add(String(uid));
    else selectedBulkUserIds.delete(String(uid));
    const badge = document.getElementById('admin-bulk-assign-selected-count');
    if (badge) badge.textContent = `${selectedBulkUserIds.size} Selected`;
  };

window.renderBulkAssignMultiUserChecklist = function () {
    const container = document.getElementById('admin-bulk-assign-users-checklist');
    const searchEl = document.getElementById('admin-bulk-assign-user-search');
    const targetBatchSel = document.getElementById('admin-bulk-assign-target-batch-select');
    const countBadge = document.getElementById('admin-bulk-assign-selected-count');
    if (!container) return;

    if (targetBatchSel && typeof getInstituteBatchesList === 'function') {
      const prev = targetBatchSel.value;
      const batches = getInstituteBatchesList() || [];
      const vMap = window.getBatchValidityMap();
      targetBatchSel.innerHTML = '<option value="">-- Select Target Batch --</option>' +
        batches.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}${vMap[b] ? ' (Valid: ' + escapeHtml(vMap[b]) + ')' : ''}</option>`).join('');
      if ([...targetBatchSel.options].some((o) => o.value === prev)) targetBatchSel.value = prev;
    }

    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
    const users = (typeof portalState.adminData !== 'undefined' && portalState.adminData && Array.isArray(portalState.adminData.users))
      ? portalState.adminData.users.map((u) => (typeof normalizeUserRecord === 'function' ? normalizeUserRecord(u) : u))
      : [];

    const visible = users.filter((u) => {
      if (!q) return true;
      return `${u.Name || ''} ${u.UserID || ''} ${u.Email || ''} ${u.Batch || ''}`.toLowerCase().includes(q);
    });

    if (countBadge) countBadge.textContent = `${selectedBulkUserIds.size} Selected`;

    if (visible.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; padding: 14px; text-align: center; font-size: 12px; color: var(--text-muted);">No users found to select.</div>';
      return;
    }

    container.innerHTML = visible.map((u) => {
      const uid = String(u.UserID || u.userId || '');
      const checked = selectedBulkUserIds.has(uid);
      const curBatch = typeof getUserAssignedBatch === 'function' ? getUserAssignedBatch(uid, u.Batch || u.batch) : (u.Batch || 'RP-Trail');
      return `
        <label style="display: flex; align-items: flex-start; gap: 8px; padding: 7px 9px; border-radius: 7px; border: 1px solid ${checked ? 'var(--primary)' : 'var(--border)'}; background: ${checked ? 'rgba(37, 99, 235, 0.06)' : 'var(--background)'}; cursor: pointer; font-size: 11.5px; margin: 0;">
          <input type="checkbox" class="rp-bulk-assign-user-chk" value="${escapeHtml(uid)}" ${checked ? 'checked' : ''} onchange="window.toggleBulkAssignSingleUser('${escapeHtml(uid).replace(/'/g, "\\'")}', this.checked)" style="margin-top: 2px;">
          <span style="min-width: 0; overflow: hidden;">
            <strong style="display: block; color: var(--secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(u.Name || uid)}</strong>
            <span style="font-size: 10.5px; color: var(--text-muted);">${escapeHtml(uid)} · ${escapeHtml(curBatch)}</span>
          </span>
        </label>
      `;
    }).join('');
  };

window.toggleAllBulkAssignUsers = function (selectVisible) {
    if (!selectVisible) {
      selectedBulkUserIds.clear();
      window.renderBulkAssignMultiUserChecklist();
      return;
    }
    document.querySelectorAll('.rp-bulk-assign-user-chk').forEach((chk) => {
      selectedBulkUserIds.add(String(chk.value));
    });
    window.renderBulkAssignMultiUserChecklist();
  };

window.executeBulkAssignSelectedUsers = async function () {
    const targetBatch = (document.getElementById('admin-bulk-assign-target-batch-select')?.value || '').trim();
    const applyValidity = Boolean(document.getElementById('admin-bulk-assign-apply-validity-chk')?.checked);
    const uids = Array.from(selectedBulkUserIds);

    if (!targetBatch) {
      safeNotify('Please select a Target Batch first.');
      return;
    }
    if (uids.length === 0) {
      safeNotify('Please check at least one student from the checklist first.');
      return;
    }

    const vMap = window.getBatchValidityMap();
    const batchExpiry = applyValidity ? (vMap[targetBatch] || '') : '';

    const keepFreeBatchOrdered = (arr) => {
      if (typeof ensureFreeBatchIncluded === 'function') return ensureFreeBatchIncluded(arr);
      const custom = Array.from(new Set((arr || []).map((b) => String(b || '').trim()).filter((b) => b && b.toLowerCase() !== 'general batch' && b.toLowerCase() !== 'free tier' && b.toLowerCase() !== 'rp-trail')));
      return [...custom, 'RP-Trail'];
    };

    if (typeof getUserBatchAssignmentsMap === 'function' && typeof saveUserBatchAssignmentsMap === 'function') {
      const bMap = getUserBatchAssignmentsMap();
      uids.forEach((uid) => {
        const cur = typeof parseBatchListValue === 'function' ? parseBatchListValue(bMap[uid]) : [];
        bMap[uid] = keepFreeBatchOrdered([targetBatch, ...cur]);
      });
      saveUserBatchAssignmentsMap(bMap);
    }

    if (typeof portalState.adminData !== 'undefined' && portalState.adminData && Array.isArray(portalState.adminData.users)) {
      portalState.adminData.users.forEach((u) => {
        const uid = String(u.UserID || u.userId || '');
        if (!uids.includes(uid)) return;
        const curList = String(u.Batch || u.batch || '').split(',').map((b) => b.trim()).filter(Boolean);
        const ordered = keepFreeBatchOrdered([targetBatch, ...curList]);
        u.Batch = ordered.join(', ');
        u.batch = u.Batch;
        if (batchExpiry) u.Validity = batchExpiry;
      });
    }

    if (typeof apiCall === 'function') {
      await apiCall('bulkUpdateUserBatches', {
        batch: targetBatch,
        batchName: targetBatch,
        userIds: uids,
        validityDate: batchExpiry
      }, true);
    }

    selectedBulkUserIds.clear();
    window.renderBulkAssignMultiUserChecklist();
    if (typeof populateAllBatchSelectDropdowns === 'function') populateAllBatchSelectDropdowns();
    if (typeof renderAdminUsers === 'function') renderAdminUsers();
    safeNotify(`Assigned ${uids.length} selected user${uids.length === 1 ? '' : 's'} to "${targetBatch}"${batchExpiry ? ' (Valid until ' + batchExpiry + ')' : ''}!`);
  };
