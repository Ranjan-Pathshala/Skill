// @ts-nocheck
/**
 * RP Skill Portal — Core API Client, Caching, Offline Retry Queues, Streaming & Rule Pinning
 * Clean Vite ES module (zero layered monkey-patch conflicts).
 */

import { portalState } from '../core/state.ts';
import { portalHooks } from '../core/hooks.ts';
import { onDomReady, yieldToMainFrame } from '../core/domReady.ts';
import { _activeStreamTokens, carouselAutoTimers, getOrCreateStreamFooterEl, getUserCustomPreferences, isUserEmailAlreadyVerified, navigateTo, pruneExpiredNotifications24h, pushPortalNotification, pushPortalNotificationsBatch, renderAuthView, saveMaintenanceConfigToStorage, switchAuthTab, updateNavTabsMaintenanceBadges } from './authAndNavigation.js';
import { ensureFreeBatchIncluded, getBatchMonitorsMap, getUserBatchAssignmentsMap, loadAdminData, mergeBatchMonitorsMaps, parseBatchListValue, populateUploadCbtEvalRulesDropdown, renderAdminLogs, renderAdminMaterialsTable, renderAdminPerformanceDashboard, safeNotify, saveBatchMonitorsMap, saveInstituteBatchesList, saveUserBatchAssignmentsMap } from './adminPanel.js';
import { initLearningTypingTutor, renderVideoCourseView, toggleKeystrokeLatencyHeatmap } from './videoAndTutor.js';
import { renderCbtTestCatalog, updateCbtRevisionCountsUI } from './cbtArena.js';
import { getDateSpecificBannersMap, getWatermarkText, refreshVisibleDataLoadFooters, renderDashboardFreeTierNotice, renderDashboardUI, renderHelpAdminContacts, renderPitmanSubtabs, renderPromoBanner, renderSubtabs, saveDashboardCustomBannerConfig, saveDateSpecificBannersMap, setupAuthenticatedUI, syncProfileTabUI } from './dashboardAndProfile.js';
import { classifyAndConvertVoiceMediaUrl, deleteEvaluationRuleByKey, populateLiveTestMaterialOptions, renderAdminEvaluationRulesTable, saveScheduledLiveTestsList } from './mediaAndDictation.js';
import { initTypingTestWizard, renderTestHistoryTable, renderWords } from './typingAndEvaluation.js';
import { resolveStandaloneBackendUrl } from '../core/config.ts';
import { escapeHtml } from '../utils/formatting.ts';


try {
  const savedUser = localStorage.getItem('steno_user');
  if (savedUser && savedUser !== 'undefined') {
    portalState.currentUser = JSON.parse(savedUser);
  }
} catch (e) {
  try { localStorage.removeItem('steno_user'); } catch (_e) {}
}

export const HISTORY_PER_PAGE = 30;

portalState.currentHistoryPage = 1;

export const ADMIN_FEEDBACK_PER_PAGE = 30;

portalState.currentAdminFeedbackPage = 1;

export const ADMIN_LEADERBOARD_PER_PAGE = 30;

portalState.currentAdminLeaderboardPage = 1;

export const ADMIN_USERS_PER_PAGE = 30;

portalState.currentAdminUserPage = 1;

try {
  const savedRules = localStorage.getItem('steno_all_eval_rules');
  if (savedRules && savedRules !== 'undefined') {
    portalState.allEvaluationRules = JSON.parse(savedRules);
  }
} catch (e) {
  try { localStorage.removeItem('steno_all_eval_rules'); } catch (_e) {}
  portalState.allEvaluationRules = {};
}

export let announcementPage = 1;

portalState.logsPage = 1;

portalState.selectedAlphabet = 'ALL';

portalState.selectedCategoryFilter = 'ALL';

portalState.testPhotoZoom = 1;

portalState.currentSubtabFilter = { pdf: 'ALL', audio: 'ALL', pitman: 'ALL', typingtest: 'ALL', videocourse: 'ALL', cbttest: 'ALL' };

portalState.testBackspaces = 0;

portalState.testStartTime = 0;

portalState.currentExamName = '';

portalState.testDurationMinutes = 5;

portalState.testTimerInterval = null;

portalState.currentReferenceText = '';

portalState.activeTestSubtabKey = 'default';

portalState.isTestPaused = false;

portalState.secondsRemainingGlobal = 0;

portalState.isTypingTimerStarted = false;

portalState.selectedTypingMedium = null;

portalState.selectedTypingExam = null;

portalState.selectedTypingDate = null;

portalState.selectedTypingPassage = null;

portalState.currentTypingPassagesCache = [];

export const SITE_NAME = 'RP Skill';

export const DEFAULT_LOGO_DRIVE_ID = '1NuRUWqMk9uP8FsUCYGsf5Qq9ersIigv_';

export const DEFAULT_LOGO_CDN_URL = `https://lh3.googleusercontent.com/d/${DEFAULT_LOGO_DRIVE_ID}=s512`;

export const DEFAULT_LOGO_URL = `/api/media-proxy?driveId=${DEFAULT_LOGO_DRIVE_ID}&kind=image`;

export const FAST_CACHE_KEY = 'steno_fast_cache_v3';

function extractAnyDriveFileId(rawUrl) {
  const s = String(rawUrl || '').trim();
  if (!s) return '';
  const m = s.match(/[?&]driveId=([a-zA-Z0-9_-]{10,120})/) || s.match(/\/d\/([a-zA-Z0-9_-]{10,120})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{10,120})/);
  return (m && m[1]) ? m[1] : '';
}

window.rpHandleImageError = function(imgEl, allowLogoFallback = true) {
  if (!imgEl || imgEl.tagName !== 'IMG') return;
  const stage = parseInt(imgEl.dataset.rpImgStage || '0', 10) || 0;
  const currentSrc = String(imgEl.getAttribute('src') || imgEl.src || '').trim();
  const origSrc = imgEl.dataset.rpOrigSrc || currentSrc;
  if (!imgEl.dataset.rpOrigSrc && origSrc) imgEl.dataset.rpOrigSrc = origSrc;

  const driveId = String(imgEl.dataset.driveId || extractAnyDriveFileId(origSrc) || extractAnyDriveFileId(currentSrc) || '').trim();
  imgEl.referrerPolicy = 'no-referrer';

  // Stage 0 -> Stage 1: Zero-footprint Googleusercontent CDN (works on static hosts & never creates Drive "Shared with me" footprint)
  if (stage < 1 && driveId) {
    imgEl.dataset.rpImgStage = '1';
    imgEl.src = `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveId)}=s1600`;
    return;
  }

  // Stage 1 -> Stage 2: Google Drive thumbnail endpoint (with no-referrer)
  if (stage < 2 && driveId) {
    imgEl.dataset.rpImgStage = '2';
    imgEl.src = `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1600`;
    return;
  }

  // Stage 2 -> Stage 3: If original was an external URL wrapped in /api/media-proxy?url=..., try direct URL
  if (stage < 3 && origSrc.includes('/api/media-proxy') && origSrc.includes('url=')) {
    try {
      const u = new URL(origSrc, window.location.origin);
      const rawExternal = u.searchParams.get('url');
      if (rawExternal && /^https?:\/\//i.test(rawExternal)) {
        imgEl.dataset.rpImgStage = '3';
        imgEl.src = rawExternal;
        return;
      }
    } catch (_e) {}
  }

  // Stage 3 -> Stage 4: Apps Script DriveApp base64 fetch (works even for private/restricted Drive images)
  if (stage < 4 && driveId && typeof apiCall === 'function') {
    imgEl.dataset.rpImgStage = '4';
    apiCall('getDriveFileBase64', { fileId: driveId }, true).then((res) => {
      if (res && res.success && res.base64) {
        const mime = res.mimeType || 'image/png';
        imgEl.src = `data:${mime};base64,${res.base64}`;
      } else if (allowLogoFallback && driveId !== DEFAULT_LOGO_DRIVE_ID) {
        imgEl.dataset.rpImgStage = '5';
        imgEl.src = DEFAULT_LOGO_CDN_URL;
      }
    }).catch(() => {
      if (allowLogoFallback && driveId !== DEFAULT_LOGO_DRIVE_ID) {
        imgEl.dataset.rpImgStage = '5';
        imgEl.src = DEFAULT_LOGO_CDN_URL;
      }
    });
    return;
  }

  // Stage 5: Final brand logo fallback via reliable CDN
  if (stage < 5 && allowLogoFallback && currentSrc !== DEFAULT_LOGO_CDN_URL) {
    imgEl.dataset.rpImgStage = '5';
    imgEl.src = DEFAULT_LOGO_CDN_URL;
    return;
  }

  imgEl.onerror = null;
};

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Global capture-phase fallback for ANY <img> tag across the entire portal
  document.addEventListener('error', (ev) => {
    const target = ev && ev.target;
    if (target && target.tagName === 'IMG') {
      window.rpHandleImageError(target, true);
    }
  }, true);

  // Non-blocking startup probe to detect whether Express /api/media-proxy is active (vs static deploy)
  window.__RP_MEDIA_PROXY_AVAILABLE__ = true;
  fetch('/api/health', { method: 'GET', cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('no-proxy');
      return r.json();
    })
    .then((j) => {
      if (!j || j.status !== 'ok') throw new Error('no-proxy');
      window.__RP_MEDIA_PROXY_AVAILABLE__ = true;
    })
    .catch(() => {
      window.__RP_MEDIA_PROXY_AVAILABLE__ = false;
      document.querySelectorAll('img[src*="/api/media-proxy"]').forEach((img) => {
        if (!img.complete || img.naturalWidth === 0) {
          window.rpHandleImageError(img, true);
        }
      });
    });
}

export function applyAppTheme(theme) {
      const normalized = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', normalized);
      if (normalized === 'dark') {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
      localStorage.setItem('steno_theme', normalized);

      ['theme-toggle-icon', 'header-theme-toggle-icon', 'auth-theme-toggle-icon', 'header-public-theme-icon'].forEach(id => {
        const icon = document.getElementById(id);
        if (icon) {
          icon.className = normalized === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
          icon.style.color = normalized === 'dark' ? '#fbbf24' : 'var(--primary)';
        }
      });
      ['theme-toggle-label', 'header-theme-toggle-label'].forEach(id => {
        const label = document.getElementById(id);
        if (label) {
          label.innerText = normalized === 'dark' ? 'Light Mode' : 'Dark Mode';
        }
      });
      ['auth-theme-toggle-label', 'header-public-theme-label'].forEach(id => {
        const label = document.getElementById(id);
        if (label) {
          label.textContent = normalized === 'dark' ? 'Light' : 'Dark';
        }
      });
      const statusPill = document.getElementById('menu-theme-status-pill');
      if (statusPill) {
        statusPill.textContent = normalized === 'dark' ? 'Dark' : 'Light';
      }
      const metaTheme = document.getElementById('meta-theme-color');
      if (metaTheme) {
        metaTheme.setAttribute('content', normalized === 'dark' ? '#0b1120' : '#1d4ed8');
      }

      // Notify parent wrapper if embedded
      try {
        window.parent.postMessage({ type: 'RP_SKILL_THEME_CHANGED', theme: normalized }, '*');
      } catch (e) {}
    }

export function initAppTheme() {
      const savedTheme = localStorage.getItem('steno_theme') || 'light';
      applyAppTheme(savedTheme);
    }

export function syncPublicHeaderThemeToggle(themeName) {
      const isDark = themeName === 'dark';
      ['header-public-theme-icon', 'auth-theme-toggle-icon', 'theme-toggle-icon'].forEach(id => {
        const iconEl = document.getElementById(id);
        if (iconEl) iconEl.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      });
      ['header-public-theme-label', 'auth-theme-toggle-label'].forEach(id => {
        const labelEl = document.getElementById(id);
        if (labelEl) labelEl.textContent = isDark ? 'Light' : 'Dark';
      });
      const menuLabel = document.getElementById('theme-toggle-label');
      if (menuLabel) menuLabel.textContent = isDark ? 'Light Mode' : 'Dark Mode';
      const statusPill = document.getElementById('menu-theme-status-pill');
      if (statusPill) statusPill.textContent = isDark ? 'Dark' : 'Light';
    }

export function toggleAppTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyAppTheme(next);
      syncPublicHeaderThemeToggle(next);
      if (typeof syncUserCloudStateToBackend === 'function') {
        syncUserCloudStateToBackend({ theme: next });
      }
      showToast(next === 'dark' ? '🌙 Dark Mode enabled' : '☀️ Light Mode enabled');
    }

export let deferredPwaPrompt = null;

export function isRunningAsInstalledPwa() {
      try {
        return Boolean(
          (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
          window.navigator.standalone === true
        );
      } catch (e) {
        return false;
      }
    }

export function syncPwaInstallButtonVisibility() {
      const btn = document.getElementById('pwa-install-btn');
      if (!btn) return;
      if (isRunningAsInstalledPwa()) {
        btn.style.display = 'none';
      } else {
        btn.style.display = 'inline-flex';
      }
    }

window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPwaPrompt = e;
      syncPwaInstallButtonVisibility();
    });

window.addEventListener('appinstalled', () => {
      deferredPwaPrompt = null;
      const btn = document.getElementById('pwa-install-btn');
      if (btn) btn.style.display = 'none';
      showToast('✅ RP Skill Portal installed as an App!');
    });

export function showGuidedPwaInstallModal() {
      const existing = document.getElementById('rp-pwa-install-guide-modal');
      if (existing) existing.remove();
      const ua = navigator.userAgent || '';
      const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
      const isAndroid = /Android/i.test(ua);
      const stepsHtml = isIos
        ? `<ol style="margin:0; padding-left:18px; line-height:1.7; font-size:13px; color:var(--text-main);">
             <li>Open this portal in <strong>Safari</strong> (tap the link outside in-app browsers if needed).</li>
             <li>Tap the <strong>Share</strong> icon <span style="font-weight:800;">(↑)</span> at the bottom toolbar.</li>
             <li>Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
           </ol>`
        : (isAndroid
          ? `<ol style="margin:0; padding-left:18px; line-height:1.7; font-size:13px; color:var(--text-main);">
               <li>Tap the <strong>Browser Menu (⋮)</strong> at the top-right corner of Chrome / Edge.</li>
               <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
               <li>Confirm <strong>Install</strong> to launch RP Skill as a standalone app.</li>
             </ol>`
          : `<ol style="margin:0; padding-left:18px; line-height:1.7; font-size:13px; color:var(--text-main);">
               <li>Open the portal directly in Chrome, Edge, or Brave (click <strong>Open Fullscreen</strong> if viewing inside a preview frame).</li>
               <li>Click the <strong>Install App</strong> icon <i class="fa-solid fa-download"></i> on the right side of the browser address bar.</li>
               <li>Alternatively open Browser Menu <strong>(⋮) → Cast, save, and share → Install RP Skill</strong>.</li>
             </ol>`);
      const overlay = document.createElement('div');
      overlay.id = 'rp-pwa-install-guide-modal';
      overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.72); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px;';
      overlay.innerHTML = `
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:14px; max-width:460px; width:100%; padding:20px 22px; box-shadow:0 20px 50px rgba(0,0,0,0.35);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <img src="/pwa-192x192.png" alt="RP Skill" style="width:36px; height:36px; border-radius:9px;" onerror="this.style.display='none'">
              <div>
                <h4 style="margin:0; font-size:16px; font-weight:800; color:var(--secondary);">Install RP Skill App</h4>
                <div style="font-size:11.5px; color:var(--text-muted);">Fast offline-ready desktop &amp; mobile shortcut</div>
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('rp-pwa-install-guide-modal')?.remove()">✕</button>
          </div>
          <div style="background:var(--background); border:1px solid var(--border); border-radius:10px; padding:12px 14px; margin-bottom:14px;">
            ${stepsHtml}
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('rp-pwa-install-guide-modal')?.remove()">Got It</button>
          </div>
        </div>
      `;
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) overlay.remove();
      });
      document.body.appendChild(overlay);
    }

export async function triggerPwaInstall() {
      if (isRunningAsInstalledPwa()) {
        showToast('✅ RP Skill App is already installed and running in standalone mode.');
        syncPwaInstallButtonVisibility();
        return;
      }
      if (deferredPwaPrompt) {
        try {
          deferredPwaPrompt.prompt();
          const { outcome } = await deferredPwaPrompt.userChoice;
          if (outcome === 'accepted') {
            deferredPwaPrompt = null;
            syncPwaInstallButtonVisibility();
          }
          return;
        } catch (e) {}
      }
      // If hosted inside the parent app shell iframe, delegate native install prompt to top frame
      let delegatedToParent = false;
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'TRIGGER_PWA_INSTALL' }, '*');
          delegatedToParent = true;
        }
      } catch (e) {}
      if (!delegatedToParent) {
        showGuidedPwaInstallModal();
      } else {
        // Wait briefly for parent shell to respond; if parent has no native prompt, parent handles or shows its install guide
        showToast('📲 Opening RP Skill App installer...');
      }
    }

window.addEventListener('message', (ev) => {
      if (ev && ev.data && ev.data.type === 'PWA_INSTALL_FALLBACK_GUIDE') {
        showGuidedPwaInstallModal();
      }
    });

export function registerPwaServiceWorker() {
      syncPwaInstallButtonVisibility();
      const isAppsScriptHost = (typeof google !== 'undefined' && google && google.script && google.script.run);
      if (window.__RP_PREVIEW_PROXY__ || isAppsScriptHost) return;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
      }
    }

export function normalizeMaterialRecord(m) {
      if (!m || typeof m !== 'object') return m;
      const strFields = ['ID', 'id', 'Type', 'type', 'Subtab', 'Category', 'Title', 'Name', 'Word', 'ContentOrUrl', 'ThumbnailUrl', 'LogoUrl', 'AccessLevel', 'Medium', 'Difficulty', 'ExamDate', 'TargetDate', 'Details', 'Content'];
      strFields.forEach(k => {
        if (m[k] !== undefined && m[k] !== null) {
          m[k] = String(m[k]);
        }
      });
      return m;
    }

export function normalizeSubtabRecord(s) {
      if (!s || typeof s !== 'object') return s;
      if (s.ID !== undefined && s.ID !== null) s.ID = String(s.ID);
      if (s.Type !== undefined && s.Type !== null) s.Type = String(s.Type);
      if (s.SubtabName !== undefined && s.SubtabName !== null) s.SubtabName = String(s.SubtabName);
      return s;
    }

export function normalizeUserRecord(u) {
      if (!u || typeof u !== 'object') return u;
      const strFields = [
        'UserID', 'userId', 'Name', 'name', 'Email', 'email', 'Mobile', 'mobile',
        'Role', 'role', 'Status', 'status', 'Batch', 'batch',
        'Password', 'VisiblePassword', 'ParentName', 'parentName',
        'ParentMobile', 'parentMobile', 'ParentEmail', 'parentEmail',
        'BatchValidUntil', 'EnrollmentValidUntil', 'enrollmentValidUntil',
        'MembershipPlan', 'membershipPlan', 'MembershipValidUntil', 'membershipValidUntil',
        'MemberAccessScope', 'memberAccessScope', 'MemberIncludedBatches', 'memberIncludedBatches',
        'MemberJoinDate', 'memberJoinDate',
        'FeeStatus', 'feeStatus', 'AdminPermissions', 'adminPermissions',
        'StudentTabPermissions', 'studentTabPermissions'
      ];
      strFields.forEach(k => {
        if (u[k] !== undefined && u[k] !== null) {
          u[k] = String(u[k]);
        }
      });
      const resolvedPass = String(u.VisiblePassword || u.Password || '').trim();
      if (resolvedPass && !resolvedPass.includes('$') && resolvedPass.length < 60) {
        u.Password = resolvedPass;
        u.VisiblePassword = resolvedPass;
      } else if (!u.Password && u.VisiblePassword) {
        u.Password = u.VisiblePassword;
      }
      if (u.EmailVerified === true || u.emailVerified === true || isUserEmailAlreadyVerified(u)) {
        u.EmailVerified = true;
        u.emailVerified = true;
      }
      if (u.MobileVerified === true || u.mobileVerified === true) {
        u.MobileVerified = true;
        u.mobileVerified = true;
      }
      if (u.IsMemberAllAccess === true || u.isMemberAllAccess === true) {
        u.IsMemberAllAccess = true;
        u.isMemberAllAccess = true;
      }
      if (u.MemberIncludeUpcoming === true || u.memberIncludeUpcoming === true || String(u.MemberIncludeUpcoming || '').toLowerCase() === 'true') {
        u.MemberIncludeUpcoming = true;
        u.memberIncludeUpcoming = true;
      }
      return u;
    }

export function normalizeAllPortalCollections() {
      if (Array.isArray(portalState.materialsData)) portalState.materialsData = portalState.materialsData.map(normalizeMaterialRecord);
      if (Array.isArray(portalState.subtabsData)) portalState.subtabsData = portalState.subtabsData.map(normalizeSubtabRecord);
      if (portalState.globalData && typeof portalState.globalData === 'object') {
        if (Array.isArray(portalState.globalData.materials)) portalState.globalData.materials = portalState.globalData.materials.map(normalizeMaterialRecord);
        if (Array.isArray(portalState.globalData.subtabs)) portalState.globalData.subtabs = portalState.globalData.subtabs.map(normalizeSubtabRecord);
      }
      if (portalState.adminData && typeof portalState.adminData === 'object') {
        if (Array.isArray(portalState.adminData.users)) portalState.adminData.users = portalState.adminData.users.map(normalizeUserRecord);
        if (Array.isArray(portalState.adminData.materials)) portalState.adminData.materials = portalState.adminData.materials.map(normalizeMaterialRecord);
        if (Array.isArray(portalState.adminData.subtabs)) portalState.adminData.subtabs = portalState.adminData.subtabs.map(normalizeSubtabRecord);
      }
    }

export function runOneTimeZeroSeedPurge() {
      try {
        if (!localStorage.getItem('steno_clean_zero_seed_v8')) {
          localStorage.removeItem('steno_all_eval_rules');
          localStorage.removeItem('steno_live_scheduled_tests');
          localStorage.removeItem('steno_dashboard_custom_banner');
          localStorage.removeItem('steno_date_specific_banners');
          localStorage.removeItem('steno_portal_notifications_v1');
          localStorage.removeItem('steno_admin_realtime_notifs_v1');
          localStorage.removeItem('steno_fast_cache_v3');

          // Clean any residual legacy starter MCQs and mistake bank entries
          ['rp_skill_cbt_saved_mcqs_v1', 'rp_skill_cbt_mistake_bank_v1'].forEach(k => {
            try {
              const arr = JSON.parse(localStorage.getItem(k) || '[]');
              if (Array.isArray(arr)) {
                const cleaned = arr.filter(item => !window.isLegacySeededCbtMcqGlobal(item));
                localStorage.setItem(k, JSON.stringify(cleaned));
              }
            } catch (e) { localStorage.removeItem(k); }
          });

          // Clean any residual legacy starter weak outline words
          try {
            const arrW = JSON.parse(localStorage.getItem('rp_skill_weak_outlines_vault_v1') || '[]');
            if (Array.isArray(arrW)) {
              const cleanedW = arrW.filter(item => !window.isLegacySeededWeakWordGlobal(item));
              localStorage.setItem('rp_skill_weak_outlines_vault_v1', JSON.stringify(cleanedW));
            }
          } catch (e) { localStorage.removeItem('rp_skill_weak_outlines_vault_v1'); }

          // Clean 'General Batch' / 'Free Tier' out of stored institute batches
          try {
            const rawB = JSON.parse(localStorage.getItem('steno_institute_batches_v1') || '[]');
            if (Array.isArray(rawB)) {
              const cleanB = rawB.filter(b => {
                const low = String(b || '').trim().toLowerCase();
                return low && low !== 'general batch' && low !== 'free tier' && low !== 'rp-trail';
              });
              localStorage.setItem('steno_institute_batches_v1', JSON.stringify(cleanB));
            }
          } catch (e) {}

          localStorage.setItem('steno_clean_zero_seed_v8', 'true');
        }
      } catch (e) {}
    }

export function clearTransientDataCachesOnRefresh(forceWipeFastCache = false) {
      runOneTimeZeroSeedPurge();
      if (forceWipeFastCache) {
        cancelPendingFastPortalCacheSave();
        try {
          localStorage.removeItem(FAST_CACHE_KEY);
          if ('caches' in window && window.caches && typeof window.caches.keys === 'function') {
            window.caches.keys().then(names => {
              names.forEach(name => { try { window.caches.delete(name); } catch (e) {} });
            }).catch(() => {});
          }
        } catch (e) {}
        portalState.materialsData = [];
        portalState.subtabsData = [];
        portalState.allTestHistoryList = [];
        portalState.globalData = {
          stats: { activeUsers: 0, materialsCount: 0, testsTaken: 0 },
          homework: [],
          announcements: [],
          materials: [],
          subtabs: [],
          leaderboard: [],
          userHistory: [],
          banner: { enabled: false, text: '', startTime: '', stopTime: '' },
          dashboardBanner: { mode: 'hidden', imageUrl: '', title: '', text: '' }
        };
      }
    }

export async function forceRefreshAndClearPortalCache() {
      clearTransientDataCachesOnRefresh(true);
      if (typeof pruneExpiredNotifications24h === 'function') {
        pruneExpiredNotifications24h();
      }
      showToast('🔄 Cache cleared! Reloading latest data from cloud...');
      await syncPortalDataInBackground(true);
      if (typeof fetchPublicFooterStats === 'function') {
        fetchPublicFooterStats();
      }
      if (portalState.activeTab === 'admin' && typeof loadAdminData === 'function') {
        loadAdminData();
      }
    }

export function hydrateFastPortalCache() {
      runOneTimeZeroSeedPurge();
      try {
        const raw = localStorage.getItem(FAST_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const ageMs = Date.now() - Number(parsed && parsed.savedAt ? parsed.savedAt : 0);
          const maxStaleMs = 6 * 60 * 60 * 1000; // 6 hours warm window
          if (parsed && ageMs >= 0 && ageMs < maxStaleMs) {
            if (parsed.globalData && typeof parsed.globalData === 'object') {
              portalState.globalData = { ...portalState.globalData, ...parsed.globalData };
            }
            if (Array.isArray(parsed.materialsData)) {
              portalState.materialsData = parsed.materialsData;
              if (portalState.globalData) portalState.globalData.materials = portalState.materialsData;
            }
            if (Array.isArray(parsed.subtabsData)) {
              portalState.subtabsData = parsed.subtabsData;
              if (portalState.globalData) portalState.globalData.subtabs = portalState.subtabsData;
            }
            if (Array.isArray(parsed.allTestHistoryList)) {
              portalState.allTestHistoryList = parsed.allTestHistoryList;
              if (portalState.globalData) portalState.globalData.history = portalState.allTestHistoryList;
            }
            if (Array.isArray(parsed.adminUsers) && parsed.adminUsers.length > 0) {
              portalState.adminData = portalState.adminData || {};
              portalState.adminData.users = parsed.adminUsers;
            }
          }
        }
      } catch (e) {}
      normalizeAllPortalCollections();
    }

let _fastCacheSaveTimer = null;
let _fastCacheIdleId = null;
let _fastCacheDirty = false;

function cancelPendingFastPortalCacheSave() {
      _fastCacheDirty = false;
      if (_fastCacheSaveTimer) {
        clearTimeout(_fastCacheSaveTimer);
        _fastCacheSaveTimer = null;
      }
      if (_fastCacheIdleId !== null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        try { window.cancelIdleCallback(_fastCacheIdleId); } catch (e) {}
        _fastCacheIdleId = null;
      }
    }

function flushFastPortalCacheNow() {
      _fastCacheDirty = false;
      _fastCacheSaveTimer = null;
      _fastCacheIdleId = null;
      try {
        // Avoid duplicating heavy arrays (materials, subtabs, history) inside globalData
        const slimGlobal = portalState.globalData ? { ...portalState.globalData } : {};
        delete slimGlobal.materials;
        delete slimGlobal.subtabs;
        delete slimGlobal.history;
        delete slimGlobal.userHistory;

        const payload = {
          globalData: slimGlobal,
          materialsData: portalState.materialsData || [],
          subtabsData: portalState.subtabsData || [],
          allTestHistoryList: (portalState.allTestHistoryList || []).slice(0, 120),
          adminUsers: (portalState.adminData && Array.isArray(portalState.adminData.users)) ? portalState.adminData.users : [],
          savedAt: Date.now()
        };

        // Strip oversized inline base64 data URIs (>16KB) from cached copy so localStorage stays tiny and fast on mobile
        const serialized = JSON.stringify(payload, (_k, v) => {
          if (typeof v === 'string' && v.length > 16384 && v.startsWith('data:')) {
            return '';
          }
          return v;
        });
        localStorage.setItem(FAST_CACHE_KEY, serialized);
      } catch (e) {}
    }

if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => {
        if (_fastCacheDirty) flushFastPortalCacheNow();
      });
    }

export function saveFastPortalCache(immediate = false) {
      if (immediate) {
        cancelPendingFastPortalCacheSave();
        flushFastPortalCacheNow();
        return;
      }
      _fastCacheDirty = true;
      if (_fastCacheSaveTimer) clearTimeout(_fastCacheSaveTimer);
      if (_fastCacheIdleId !== null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        try { window.cancelIdleCallback(_fastCacheIdleId); } catch (e) {}
        _fastCacheIdleId = null;
      }
      _fastCacheSaveTimer = setTimeout(() => {
        _fastCacheSaveTimer = null;
        if (!_fastCacheDirty) return;
        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
          _fastCacheIdleId = window.requestIdleCallback(() => {
            if (_fastCacheDirty) flushFastPortalCacheNow();
          }, { timeout: 1500 });
        } else {
          flushFastPortalCacheNow();
        }
      }, 900);
    }

window.buildRpEmptyStateHtml = function(title, description, actionLabel, actionOnClick) {
      const safeTitle = window.escapeHtml(title || 'No records yet');
      const safeDesc = window.escapeHtml(description || 'Items will appear here once added.');
      const ctaHtml = (actionLabel && actionOnClick)
        ? `<button type="button" class="btn btn-primary btn-sm" onclick="${actionOnClick}" style="margin-top:4px;">${window.escapeHtml(actionLabel)}</button>`
        : '';
      return `
        <div class="rp-saas-empty-state" style="grid-column: 1 / -1;">
          <div class="rp-empty-svg-badge" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
              <path d="M8 7h8"/><path d="M8 11h5"/>
            </svg>
          </div>
          <div class="rp-empty-title">${safeTitle}</div>
          <p class="rp-empty-desc">${safeDesc}</p>
          ${ctaHtml}
        </div>
      `;
    };

export let _cloudSyncDebounceTimer = null;

export function syncUserCloudStateToBackend(partialState = {}) {
      if (!portalState.currentUser || !portalState.currentUser.userId || portalState.currentUser.userId === 'GUEST') return;
      if (_cloudSyncDebounceTimer) clearTimeout(_cloudSyncDebounceTimer);
      _cloudSyncDebounceTimer = setTimeout(() => {
        try {
          const prefs = typeof getUserCustomPreferences === 'function' ? getUserCustomPreferences() : {};
          const theme = localStorage.getItem('steno_theme') || 'light';
          const heatmapOn = window.isKeystrokeLatencyHeatmapEnabled !== false;
          let weakOutlinesVault = null;
          let cbtBookmarkedMcqs = null;
          let weeklyStudyPlanner = null;
          try {
            const rawV = localStorage.getItem('rp_skill_weak_outlines_vault_v1');
            if (rawV) {
              const parsedV = JSON.parse(rawV);
              if (Array.isArray(parsedV)) weakOutlinesVault = parsedV.slice(0, 120);
            }
          } catch (e) {}
          try {
            const rawB = localStorage.getItem('rp_skill_cbt_saved_mcqs_v1');
            if (rawB) {
              const parsedB = JSON.parse(rawB);
              if (Array.isArray(parsedB)) cbtBookmarkedMcqs = parsedB.slice(0, 120);
            }
          } catch (e) {}
          try {
            const rawP = localStorage.getItem('rp_skill_weekly_study_planner_v1');
            if (rawP) {
              const parsedP = JSON.parse(rawP);
              if (parsedP && typeof parsedP === 'object') weeklyStudyPlanner = parsedP;
            }
          } catch (e) {}

          const safePartial = (partialState && typeof partialState === 'object') ? partialState : {};
          const cloudState = {
            theme: theme,
            heatmapOn: heatmapOn,
            customPrefs: prefs,
            ...(weakOutlinesVault !== null ? { weakOutlinesVault } : {}),
            ...(cbtBookmarkedMcqs !== null ? { cbtBookmarkedMcqs } : {}),
            ...(weeklyStudyPlanner !== null ? { weeklyStudyPlanner } : {}),
            updatedAtMs: Date.now(),
            ...safePartial
          };
          apiCall('syncUserCloudState', {
            userId: portalState.currentUser.userId,
            cloudState: cloudState
          }, true);
        } catch (e) {}
      }, 650);
    }

export function applyUserCloudStateFromBackend(cloudState) {
      if (!cloudState || typeof cloudState !== 'object') return;
      try {
        if (cloudState.theme && (cloudState.theme === 'dark' || cloudState.theme === 'light')) {
          const currentTheme = localStorage.getItem('steno_theme');
          if (currentTheme !== cloudState.theme) {
            applyAppTheme(cloudState.theme);
          }
        }
        if (typeof cloudState.heatmapOn === 'boolean' && typeof toggleKeystrokeLatencyHeatmap === 'function') {
          window.isKeystrokeLatencyHeatmapEnabled = cloudState.heatmapOn;
          localStorage.setItem('steno_latency_heatmap_on', cloudState.heatmapOn ? 'true' : 'false');
        }
        if (cloudState.customPrefs && typeof cloudState.customPrefs === 'object') {
          const existing = typeof getUserCustomPreferences === 'function' ? getUserCustomPreferences() : {};
          const merged = { ...existing, ...cloudState.customPrefs };
          localStorage.setItem('steno_user_custom_prefs', JSON.stringify(merged));
        }
        const _isLegacySeedWeak = (item) => typeof window.isLegacySeededWeakWordGlobal === 'function' ? window.isLegacySeededWeakWordGlobal(item) : false;
        const _isLegacySeedMcq = (b) => typeof window.isLegacySeededCbtMcqGlobal === 'function' ? window.isLegacySeededCbtMcqGlobal(b) : false;
        let _needsCloudCleanSync = false;

        if (Array.isArray(cloudState.weakOutlinesVault)) {
          let localVault = [];
          try { localVault = JSON.parse(localStorage.getItem('rp_skill_weak_outlines_vault_v1') || '[]'); } catch (e) {}
          const rawCloudCount = cloudState.weakOutlinesVault.length;
          const cleanCloudWeak = cloudState.weakOutlinesVault.filter(x => !_isLegacySeedWeak(x));
          if (cleanCloudWeak.length !== rawCloudCount) _needsCloudCleanSync = true;
          const mergedMap = new Map();
          cleanCloudWeak.forEach(item => {
            if (item && item.word) mergedMap.set(String(item.word).toLowerCase(), item);
          });
          (Array.isArray(localVault) ? localVault : []).filter(x => !_isLegacySeedWeak(x)).forEach(item => {
            if (item && item.word) {
              const k = String(item.word).toLowerCase();
              const prev = mergedMap.get(k);
              if (!prev || (Number(item.count || 0) >= Number(prev.count || 0))) {
                mergedMap.set(k, { ...(prev || {}), ...item });
              }
            }
          });
          localStorage.setItem('rp_skill_weak_outlines_vault_v1', JSON.stringify(Array.from(mergedMap.values()).slice(0, 250)));
          if (typeof window.renderDashboardWeakOutlinesVault === 'function') window.renderDashboardWeakOutlinesVault();
        }
        if (Array.isArray(cloudState.cbtBookmarkedMcqs)) {
          let localBm = [];
          try { localBm = JSON.parse(localStorage.getItem('rp_skill_cbt_saved_mcqs_v1') || '[]'); } catch (e) {}
          const rawCloudBmCount = cloudState.cbtBookmarkedMcqs.length;
          const cleanCloudBm = cloudState.cbtBookmarkedMcqs.filter(b => !_isLegacySeedMcq(b));
          if (cleanCloudBm.length !== rawCloudBmCount) _needsCloudCleanSync = true;
          const bmMap = new Map();
          cleanCloudBm.forEach(b => { if (b && b.id) bmMap.set(String(b.id), b); });
          (Array.isArray(localBm) ? localBm : []).filter(b => !_isLegacySeedMcq(b)).forEach(b => { if (b && b.id) bmMap.set(String(b.id), b); });
          localStorage.setItem('rp_skill_cbt_saved_mcqs_v1', JSON.stringify(Array.from(bmMap.values()).slice(0, 300)));
          if (typeof updateCbtRevisionCountsUI === 'function') updateCbtRevisionCountsUI();
        }
        if (_needsCloudCleanSync && typeof syncUserCloudStateToBackend === 'function') {
          syncUserCloudStateToBackend();
        }
        if (cloudState.weeklyStudyPlanner && typeof cloudState.weeklyStudyPlanner === 'object') {
          let localPlan = {};
          try { localPlan = JSON.parse(localStorage.getItem('rp_skill_weekly_study_planner_v1') || '{}'); } catch (e) {}
          const mergedPlan = {
            ...cloudState.weeklyStudyPlanner,
            ...localPlan,
            completedMap: {
              ...(cloudState.weeklyStudyPlanner.completedMap || {}),
              ...(localPlan.completedMap || {})
            }
          };
          localStorage.setItem('rp_skill_weekly_study_planner_v1', JSON.stringify(mergedPlan));
          if (typeof window.renderWeeklyStudyPlanner === 'function') window.renderWeeklyStudyPlanner();
        }
      } catch (e) {}
    }

export const NOTIFICATION_TTL_24H_MS = 7 * 24 * 60 * 60 * 1000;

export const NOTIFICATION_TTL_7D_MS = NOTIFICATION_TTL_24H_MS;

export function scanAndNotifyRecentUploads24h(dashRes) {
      if (!dashRes || typeof pushPortalNotification !== 'function') return;
      const nowMs = Date.now();
      let notifiedMap = {};
      try {
        notifiedMap = JSON.parse(localStorage.getItem('steno_notified_upload_ids_24h') || '{}') || {};
      } catch (e) { notifiedMap = {}; }

      // Prune notified IDs older than 7 days
      Object.keys(notifiedMap).forEach(k => {
        if (nowMs - Number(notifiedMap[k] || 0) > NOTIFICATION_TTL_7D_MS) {
          delete notifiedMap[k];
        }
      });

      const parseItemTimeMs = (item) => {
        const raw = item._uploadTimestamp || item.UploadedDate || item.CreatedDate || item.PostedDate || item.CreatedAt || item.createdAt || item.timestamp;
        if (!raw || raw === '-') return 0;
        if (typeof raw === 'number') return raw;
        const parsed = new Date(raw).getTime();
        return isNaN(parsed) ? 0 : parsed;
      };

      const mapTypeToTab = (t) => {
        const norm = String(t || '').toLowerCase().replace(/[-_\s]/g, '');
        if (norm.includes('audio')) return 'audio';
        if (norm.includes('pitman')) return 'pitman';
        if (norm.includes('typingtest') || norm === 'typing') return 'typingtest';
        if (norm.includes('learning')) return 'learningtyping';
        if (norm.includes('cbt')) return 'cbttest';
        if (norm.includes('videocourse')) return 'videocourse';
        if (norm.includes('word')) return 'words';
        if (norm.includes('pdf')) return 'pdf';
        return 'dashboard';
      };

      let addedNew = false;
      const pendingAlerts = [];

      // 1. Check uploaded Materials (within last 7 days)
      if (Array.isArray(dashRes.materials)) {
        dashRes.materials.forEach(m => {
          const id = String(m.ID || m.id || '');
          if (!id || notifiedMap[id]) return;
          const tMs = parseItemTimeMs(m);
          if (tMs > 0 && (nowMs - tMs) <= NOTIFICATION_TTL_7D_MS) {
            notifiedMap[id] = tMs;
            addedNew = true;
            const matType = String(m.Type || m.type || 'Material').toUpperCase();
            pendingAlerts.push({
              id: 'UP-' + id,
              type: 'UPLOAD_ALERT',
              icon: '📤',
              color: '#2563eb',
              title: `New ${matType} Uploaded: ${m.Title || 'Study Material'}`,
              body: `Subtab: ${m.Subtab && m.Subtab !== '-' ? m.Subtab : 'General'} • Available now (Auto-removes after 7 days).`,
              targetTab: mapTypeToTab(m.Type || m.type),
              createdAtMs: tMs
            });
          }
        });
      }

      // 2. Check uploaded Homework (within last 7 days)
      if (Array.isArray(dashRes.homework)) {
        dashRes.homework.forEach(h => {
          const id = String(h.ID || h.id || '');
          if (!id || notifiedMap[id]) return;
          const tMs = parseItemTimeMs(h);
          if (tMs > 0 && (nowMs - tMs) <= NOTIFICATION_TTL_7D_MS) {
            notifiedMap[id] = tMs;
            addedNew = true;
            pendingAlerts.push({
              id: 'HW-' + id,
              type: 'HOMEWORK_UPLOAD',
              icon: '📚',
              color: '#10b981',
              title: `New Homework Assigned: ${h.Title || 'Daily Practice'}`,
              body: `${h.Details && h.Details !== '-' ? String(h.Details).slice(0, 90) : 'Check Dashboard Homework Tracer.'} (Auto-removes after 7 days)`,
              targetTab: 'dashboard',
              createdAtMs: tMs
            });
          }
        });
      }

      // 3. Check uploaded Announcements & Live Alerts (within last 7 days)
      if (Array.isArray(dashRes.announcements)) {
        dashRes.announcements.forEach(a => {
          const id = String(a.ID || a.id || '');
          if (!id || notifiedMap[id]) return;
          const tMs = parseItemTimeMs(a);
          if (tMs > 0 && (nowMs - tMs) <= NOTIFICATION_TTL_7D_MS) {
            notifiedMap[id] = tMs;
            addedNew = true;
            pendingAlerts.push({
              id: 'ANN-' + id,
              type: 'ANNOUNCEMENT_UPLOAD',
              icon: '📢',
              color: '#f59e0b',
              title: `Live Alert / Announcement: ${a.Title || 'Notice'}`,
              body: `${a.Content && a.Content !== '-' ? String(a.Content).slice(0, 90) : 'View on Dashboard Notice Board.'} (Auto-removes after 7 days)`,
              targetTab: 'dashboard',
              createdAtMs: tMs
            });
          }
        });
      }

      if (pendingAlerts.length > 0) {
        if (typeof pushPortalNotificationsBatch === 'function') {
          pushPortalNotificationsBatch(pendingAlerts);
        } else {
          pendingAlerts.forEach(alert => pushPortalNotification(alert));
        }
      }

      if (addedNew) {
        try {
          localStorage.setItem('steno_notified_upload_ids_24h', JSON.stringify(notifiedMap));
        } catch (e) {}
      }
    }

export function isMaterialTypeMatch(mType, targetType) {
      const m = String(mType || '').toLowerCase().replace(/[-_\s]/g, '');
      const t = String(targetType || '').toLowerCase().replace(/[-_\s]/g, '');
      if (m === t) return true;
      if ((t === 'videocourse' || t === 'videocourses') &&
          (m === 'videocourse' || m === 'videocourses')) {
        return true;
      }
      if ((t === 'video' || t === 'videos' || t === 'referencevideo') &&
          (m === 'video' || m === 'videos' || m === 'referencevideo')) {
        return true;
      }
      if ((t === 'pdf' || t === 'pdfs') && (m === 'pdf' || m === 'pdfs')) return true;
      if ((t === 'audio' || t === 'audios') && (m === 'audio' || m === 'audios')) return true;
      if ((t === 'word' || t === 'words') && (m === 'word' || m === 'words')) return true;
      if ((t === 'pitman' || t === 'pitmanbook' || t === 'pitmanbooks') && (m === 'pitman' || m === 'pitmanbook' || m === 'pitmanbooks')) return true;
      if ((t === 'typingtest' || t === 'typing') && (m === 'typingtest' || m === 'typing')) return true;
      if ((t === 'learningtyping' || t === 'learning') && (m === 'learningtyping' || m === 'learning')) return true;
      if ((t === 'cbttest' || t === 'cbt') && (m === 'cbttest' || m === 'cbt')) return true;
      return false;
    }

export function mergeMaterialsByType(type, incomingMaterials, incomingSubtabs, options = {}) {
      const normType = String(type || '').toLowerCase().trim();
      if (Array.isArray(incomingMaterials) && incomingMaterials.length > 0) {
        const normalizedIncoming = incomingMaterials.map(normalizeMaterialRecord);
        if (!normType || normType === 'all') {
          portalState.materialsData = normalizedIncoming;
        } else {
          const others = (portalState.materialsData || []).filter(m => !isMaterialTypeMatch(m.Type || m.type, normType));
          portalState.materialsData = [...others, ...normalizedIncoming];
        }
        if (portalState.globalData) portalState.globalData.materials = portalState.materialsData;
      }
      if (Array.isArray(incomingSubtabs) && incomingSubtabs.length > 0) {
        const normalizedSubs = incomingSubtabs.map(normalizeSubtabRecord);
        if (!normType || normType === 'all') {
          portalState.subtabsData = normalizedSubs;
        } else {
          const otherSubs = (portalState.subtabsData || []).filter(s => !isMaterialTypeMatch(s.Type || s.type, normType));
          portalState.subtabsData = [...otherSubs, ...normalizedSubs];
        }
        if (portalState.globalData) portalState.globalData.subtabs = portalState.subtabsData;
      }
      if (!options || !options.skipCache) {
        saveFastPortalCache();
      }
    }

onDomReady(() => {
      const safeBoot = (fn) => { try { fn(); } catch (err) { console.warn('[RP Skill boot]', err); } };
      safeBoot(() => initAppTheme());
      safeBoot(() => registerPwaServiceWorker());
      safeBoot(() => hydrateFastPortalCache());
      safeBoot(() => initApp());
      safeBoot(() => fetchPublicFooterStats());
      safeBoot(() => injectClearIconsToInputs());
      safeBoot(() => renderGlobalWatermark());
      safeBoot(() => populateEvalCategoryDropdown());
      safeBoot(() => loadSelectedEvaluationRulesIntoForm());

      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);
      safeBoot(() => updateOnlineStatus());

      document.addEventListener('fullscreenchange', () => {
        const isFs = Boolean(document.fullscreenElement);
        if (!isFs) {
          document.body.style.overflow = 'auto';
        }
        const fsBtn = document.getElementById('test-fullscreen-toggle-btn');
        if (fsBtn) {
          fsBtn.innerHTML = isFs
            ? '<i class="fa-solid fa-compress"></i> Exit Full Screen'
            : '<i class="fa-solid fa-expand"></i> Full Screen';
        }
      });
    });

window.addEventListener("popstate", (event) => {
      const hashTab = window.location.hash ? window.location.hash.replace("#", "").trim().toLowerCase() : "";
      if (event.state && event.state.tab) {
        navigateTo(event.state.tab, false);
      } else if (hashTab && document.getElementById(`view-${hashTab}`)) {
        navigateTo(hashTab, false);
      } else {
        navigateTo("dashboard", false);
      }
    });

window.addEventListener("hashchange", () => {
      const hashTab = window.location.hash ? window.location.hash.replace("#", "").trim().toLowerCase() : "";
      if (hashTab && hashTab !== portalState.activeTab && document.getElementById(`view-${hashTab}`)) {
        navigateTo(hashTab, false);
      }
    });

export function updateOnlineStatus() {
      const indicator = document.getElementById('offline-status-indicator');
      if (!indicator) return;
      
      if (!navigator.onLine) {
        indicator.style.display = 'flex';
        showToast('⚠️ You are currently offline. Changes are saved locally.');
      } else {
        indicator.style.display = 'none';
      }
    }

export function renderGlobalWatermark() {
      const layers = document.querySelectorAll('.global-watermark-layer');
      const text = getWatermarkText();
      
      layers.forEach(layer => {
        layer.innerHTML = '';
        for (let i = 0; i < 25; i++) {
          const span = document.createElement('span');
          span.className = 'watermark-item';
          span.innerText = text;
          layer.appendChild(span);
        }
      });
    }

export let activeBgSyncCount = 0;

window.isPortalDataLoading = false;

export function setBackgroundSyncIndicator(active, labelText = 'Syncing latest data in background...') {
      const bar = document.getElementById('top-sync-progress-bar');
      const pill = document.getElementById('bg-sync-status-pill');
      const txt = document.getElementById('bg-sync-status-text');
      if (active) {
        activeBgSyncCount++;
        window.isPortalDataLoading = true;
        if (txt) txt.innerText = labelText;
        if (bar) {
          bar.style.opacity = '1';
          bar.style.width = '72%';
        }
        if (pill) pill.style.display = portalState.currentUser ? 'inline-flex' : 'none';
      } else {
        activeBgSyncCount = Math.max(0, activeBgSyncCount - 1);
        if (activeBgSyncCount === 0) {
          window.isPortalDataLoading = false;
          if (bar) {
            bar.style.width = '100%';
            setTimeout(() => {
              if (activeBgSyncCount === 0 && bar) {
                bar.style.opacity = '0';
                bar.style.width = '0%';
              }
            }, 280);
          }
          if (pill) pill.style.display = 'none';
        }
      }
      if (typeof refreshVisibleDataLoadFooters === 'function') {
        refreshVisibleDataLoadFooters();
      }
    }

export let _inFlightDashboardSyncPromise = null;

export let _lastDashboardSyncOkTs = 0;

export function showPortalLoadRetryBanner(show, message) {
      let banner = document.getElementById('rp-load-retry-banner');
      if (!show) {
        if (banner) banner.remove();
        return;
      }
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'rp-load-retry-banner';
        banner.style.cssText = 'position:fixed; bottom:18px; right:18px; z-index:99990; background:#0f172a; color:#f8fafc; border:1px solid rgba(239,68,68,0.55); border-left:4px solid #ef4444; border-radius:12px; padding:11px 14px; box-shadow:0 12px 28px rgba(15,23,42,0.32); display:flex; align-items:center; gap:10px; font-size:12px; max-width:390px;';
        document.body.appendChild(banner);
      }
      const safeMsg = window.escapeHtml(message || 'Server took too long to respond.');
      banner.innerHTML = `
        <i class="fa-solid fa-wifi" style="color:#f87171; font-size:15px;"></i>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:800; color:#fecaca;">Cloud Sync Delayed</div>
          <div style="font-size:11px; color:#cbd5e1;">${safeMsg}</div>
        </div>
        <button type="button" onclick="syncPortalDataInBackground(true)" style="background:#ef4444; color:#fff; border:none; border-radius:8px; padding:6px 11px; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap;">Retry</button>
      `;
    }

export async function syncPortalDataInBackground(force = false) {
      if (!portalState.currentUser || !portalState.currentUser.userId || !(portalState.currentUser.sessionToken || portalState.currentUser.token)) {
        if (typeof fetchPublicFooterStats === 'function') {
          fetchPublicFooterStats();
        }
        return null;
      }
      // Deduplicate concurrent dashboard syncs & apply 12-second cooldown for non-forced tab switches
      if (_inFlightDashboardSyncPromise) {
        return _inFlightDashboardSyncPromise;
      }
      if (!force && _lastDashboardSyncOkTs > 0 && (Date.now() - _lastDashboardSyncOkTs) < 12000) {
        return null;
      }

      _inFlightDashboardSyncPromise = (async () => {
        setBackgroundSyncIndicator(true, 'Syncing latest portal data from Google Sheets...');
        try {
          if (typeof flushPendingCloudWrites === 'function') {
            flushPendingCloudWrites();
          }
          if (typeof window.retryFailedTestSubmissionsNow === 'function') {
            window.retryFailedTestSubmissionsNow(true);
          }
          const uid = portalState.currentUser ? (portalState.currentUser.userId || '') : '';
          const dashRes = await apiCall('getDashboardData', { userId: uid }, true, 1, 700);
          if (dashRes && dashRes.success) {
            _lastDashboardSyncOkTs = Date.now();
            showPortalLoadRetryBanner(false);
            portalState.globalData = { ...portalState.globalData, ...dashRes };
            if (dashRes.feeConfig && typeof dashRes.feeConfig === 'object') {
              portalState.globalData.feeConfig = dashRes.feeConfig;
            }
            if (Array.isArray(dashRes.userFeeReceipts)) {
              portalState.globalData.userFeeReceipts = dashRes.userFeeReceipts;
            }
            if (dashRes.userCloudState && typeof applyUserCloudStateFromBackend === 'function') {
              applyUserCloudStateFromBackend(dashRes.userCloudState);
            }
            if (Array.isArray(dashRes.materials)) {
              const incomingMats = dashRes.materials.map(normalizeMaterialRecord);
              portalState.materialsData = incomingMats;
              portalState.globalData.materials = portalState.materialsData;
            }
            if (Array.isArray(dashRes.subtabs)) {
              portalState.subtabsData = dashRes.subtabs.map(normalizeSubtabRecord);
              portalState.globalData.subtabs = portalState.subtabsData;
            }
            if (dashRes.evaluationRulesMap && typeof dashRes.evaluationRulesMap === 'object') {
              portalState.allEvaluationRules = { ...dashRes.evaluationRulesMap };
              localStorage.setItem('steno_all_eval_rules', JSON.stringify(portalState.allEvaluationRules));
            }
            if (dashRes.maintenance && typeof dashRes.maintenance === 'object') {
              saveMaintenanceConfigToStorage(dashRes.maintenance, false);
            }
            if (dashRes.dashboardCustomBanner && typeof dashRes.dashboardCustomBanner === 'object') {
              saveDashboardCustomBannerConfig(dashRes.dashboardCustomBanner);
            }
            if (Array.isArray(dashRes.dateSpecificBanners) && dashRes.dateSpecificBanners.length > 0) {
              const dbMap = getDateSpecificBannersMap();
              dashRes.dateSpecificBanners.forEach(b => {
                if (b && b.date) dbMap[b.date] = b;
              });
              saveDateSpecificBannersMap(dbMap, false);
            }
            if (Array.isArray(dashRes.scheduledLiveTests)) {
              saveScheduledLiveTestsList(dashRes.scheduledLiveTests, false);
            }
            if (Array.isArray(dashRes.instituteBatches)) {
              const cleanServerBatches = dashRes.instituteBatches.filter(b => {
                const low = String(b || '').trim().toLowerCase();
                return low && low !== 'general batch' && low !== 'free tier' && low !== 'rp-trail';
              });
              saveInstituteBatchesList(cleanServerBatches, false);
            }
            if (dashRes.batchMonitorsMap && typeof dashRes.batchMonitorsMap === 'object') {
              saveBatchMonitorsMap(mergeBatchMonitorsMaps(getBatchMonitorsMap(), dashRes.batchMonitorsMap));
            }
            if (Array.isArray(dashRes.batchGroupMessages)) {
              portalState.globalData.batchGroupMessages = dashRes.batchGroupMessages;
            }
            if (Array.isArray(dashRes.userHistory)) {
              portalState.allTestHistoryList = dashRes.userHistory.slice().reverse();
            }
            if (dashRes.batchMetaMap && typeof dashRes.batchMetaMap === 'object') {
              window.rpBatchMetaMap = { ...(window.rpBatchMetaMap || {}), ...dashRes.batchMetaMap };
              portalState.globalData.batchMetaMap = window.rpBatchMetaMap;
            }
            if (dashRes.currentUserBatchStatus && portalState.currentUser) {
              const bs = dashRes.currentUserBatchStatus;
              if (bs.batch) {
                const canonicalBatches = ensureFreeBatchIncluded(parseBatchListValue(bs.batch));
                const joined = canonicalBatches.join(', ');
                portalState.currentUser.batch = joined;
                portalState.currentUser.Batch = joined;
                const bMap = getUserBatchAssignmentsMap();
                bMap[String(portalState.currentUser.userId)] = canonicalBatches;
                saveUserBatchAssignmentsMap(bMap);
              }
              portalState.currentUser.autoSwitchedToFreeTier = Boolean(bs.autoSwitchedToFreeTier || (bs.expired && (bs.batch === 'RP-Trail' || bs.batch === 'Free Tier')));
              portalState.currentUser.enrollmentValidUntil = bs.validUntil || '';
              portalState.currentUser.previousBatch = bs.previousBatch || portalState.currentUser.previousBatch || '';
              portalState.currentUser.isMemberAllAccess = Boolean(bs.isMemberAllAccess || dashRes.isMemberAllAccess);
              portalState.currentUser.membershipPlan = bs.membershipPlan || portalState.currentUser.membershipPlan || '';
              portalState.currentUser.membershipValidUntil = bs.membershipValidUntil || portalState.currentUser.membershipValidUntil || '';
              portalState.currentUser.memberAccessScope = bs.memberAccessScope || portalState.currentUser.memberAccessScope || '';
              portalState.currentUser.memberIncludedBatches = bs.memberIncludedBatches !== undefined ? bs.memberIncludedBatches : (portalState.currentUser.memberIncludedBatches || '');
              portalState.currentUser.memberIncludeUpcoming = bs.memberIncludeUpcoming !== undefined ? Boolean(bs.memberIncludeUpcoming) : Boolean(portalState.currentUser.memberIncludeUpcoming);
              portalState.currentUser.memberJoinDate = bs.memberJoinDate || portalState.currentUser.memberJoinDate || '';
              portalState.currentUser.feeStatus = bs.feeStatus || portalState.currentUser.feeStatus || '';
              if (bs.parentName) portalState.currentUser.parentName = bs.parentName;
              if (bs.parentMobile) portalState.currentUser.parentMobile = bs.parentMobile;
              if (bs.parentEmail) portalState.currentUser.parentEmail = bs.parentEmail;
              try { localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser)); } catch (e) {}
              if (typeof renderDashboardFreeTierNotice === 'function') renderDashboardFreeTierNotice();
              if (typeof syncProfileTabUI === 'function') syncProfileTabUI();
            }
            scanAndNotifyRecentUploads24h(dashRes);
            if (typeof pruneExpiredNotifications24h === 'function') {
              pruneExpiredNotifications24h();
            }
            saveFastPortalCache();
            updateNavTabsMaintenanceBadges();
            if (portalState.activeTab === 'dashboard') {
              renderDashboardUI();
            } else if (portalState.activeTab === 'profile') {
              if (typeof syncProfileTabUI === 'function') syncProfileTabUI();
              if (typeof window.renderProfileFeesSection === 'function') window.renderProfileFeesSection(false);
              if (typeof window.refreshBuyPlansView === 'function') window.refreshBuyPlansView(false);
            } else if (portalState.activeTab === 'buy-plans') {
              if (typeof window.refreshBuyPlansView === 'function') window.refreshBuyPlansView(false);
            } else if (portalState.activeTab === 'videocourse') {
              if (typeof renderVideoCourseView === 'function') renderVideoCourseView();
            } else if (portalState.activeTab === 'pdf') {
              renderSubtabs('pdf');
            } else if (portalState.activeTab === 'pitman') {
              renderPitmanSubtabs();
            } else if (portalState.activeTab === 'words') {
              renderWords();
            } else if (portalState.activeTab === 'audio') {
              renderSubtabs('audio');
            } else if (portalState.activeTab === 'learningtyping') {
              if (typeof initLearningTypingTutor === 'function') initLearningTypingTutor();
            } else if (portalState.activeTab === 'typingtest') {
              if (typeof initTypingTestWizard === 'function') initTypingTestWizard();
            } else if (portalState.activeTab === 'cbttest') {
              if (typeof renderCbtTestCatalog === 'function') renderCbtTestCatalog();
            } else if (portalState.activeTab === 'batch-leaderboard') {
              if (typeof window.renderBatchLeaderboardTab === 'function') window.renderBatchLeaderboardTab(false);
            } else if (portalState.activeTab === 'batchhub') {
              if (typeof window.renderDashboardBatchMonitoringHub === 'function') window.renderDashboardBatchMonitoringHub();
              if (typeof window.renderBatchPollsWidget === 'function') window.renderBatchPollsWidget();
              if (typeof window.renderBatchShorthandDoubtWall === 'function') window.renderBatchShorthandDoubtWall();
            } else if (portalState.activeTab === 'feedback' && typeof renderHelpAdminContacts === 'function') {
              renderHelpAdminContacts();
            } else if (portalState.activeTab === 'admin') {
              renderAdminMaterialsTable();
            }
            return dashRes;
          } else if (dashRes && dashRes.networkError && !dashRes.aborted) {
            showPortalLoadRetryBanner(true, 'Showing cached data if available. Tap Retry to sync from Google Sheets.');
          }
          return dashRes;
        } finally {
          setBackgroundSyncIndicator(false);
          _inFlightDashboardSyncPromise = null;
        }
      })();
      return _inFlightDashboardSyncPromise;
    }

document.addEventListener('visibilitychange', () => {
      if (!document.hidden && portalState.currentUser && portalState.currentUser.userId) {
        if (typeof pruneExpiredNotifications24h === 'function') pruneExpiredNotifications24h();
        syncPortalDataInBackground(false);
      }
    });

export async function initApp() {
      // Stale-while-revalidate: hydrate warm cache once for instant non-blocking UI, then sync fresh data from Google Sheets
      if (!window.__rpFastCacheHydratedOnce) {
        window.__rpFastCacheHydratedOnce = true;
        hydrateFastPortalCache();
      }
      try {
        const cachedRules = localStorage.getItem('steno_all_eval_rules');
        portalState.allEvaluationRules = cachedRules ? (JSON.parse(cachedRules) || {}) : {};
      } catch (e) {
        portalState.allEvaluationRules = {};
      }

      if (portalState.currentUser && (portalState.currentUser.token || portalState.currentUser.userId)) {
        setupAuthenticatedUI();
        let initialRestoreTab = "dashboard";
        const hashMatch = window.location.hash ? window.location.hash.replace("#", "").trim().toLowerCase() : "";
        const savedTab = localStorage.getItem("rp_skill_last_active_tab");
        if (hashMatch && document.getElementById(`view-${hashMatch}`)) {
          initialRestoreTab = hashMatch;
        } else if (savedTab && document.getElementById(`view-${savedTab}`)) {
          initialRestoreTab = savedTab;
        }
        // Yield a frame before rendering heavy views so the shell & header paint immediately with zero freeze
        await yieldToMainFrame();
        navigateTo(initialRestoreTab, false);
        if (initialRestoreTab === 'dashboard') {
          requestAnimationFrame(() => renderDashboardUI());
        }
        setTimeout(() => { syncPortalDataInBackground(true); }, 60);
      } else {
        const notifBtn = document.getElementById('header-notification-bell-btn');
        const notifDrawer = document.getElementById('notification-center-drawer');
        if (notifBtn) notifBtn.style.display = 'none';
        if (notifDrawer) notifDrawer.style.display = 'none';
        renderAuthView();
        setTimeout(() => { syncPortalDataInBackground(true); }, 60);
      }
    }

export async function fetchPublicFooterStats() {
      const activeElement = document.getElementById('footer-active-users');
      const userElement = document.getElementById('footer-total-users');
      const visitElement = document.getElementById('footer-total-visits');

      // Hydrate immediately from cached public stats so logged-out visitors never see 0 while fetching
      try {
        const cachedRaw = localStorage.getItem('rp_public_footer_stats_cache_v1');
        if (cachedRaw) {
          const cachedStats = JSON.parse(cachedRaw);
          if (cachedStats && typeof cachedStats === 'object') {
            if (!portalState.globalData) portalState.globalData = {};
            portalState.globalData.stats = { ...(portalState.globalData.stats || {}), ...cachedStats };
            portalState.globalData.activeUsers = Math.max(Number(portalState.globalData.activeUsers || 0), Number(cachedStats.activeUsers || 0), 1);
            portalState.globalData.totalUsers = Math.max(Number(portalState.globalData.totalUsers || 0), Number(cachedStats.totalUsers || 0));
            portalState.globalData.totalVisits = Math.max(Number(portalState.globalData.totalVisits || 0), Number(cachedStats.totalVisits || 0));
            if (activeElement) activeElement.textContent = String(portalState.globalData.activeUsers);
            if (userElement) userElement.textContent = String(portalState.globalData.totalUsers);
            if (visitElement) visitElement.textContent = String(portalState.globalData.totalVisits);
          }
        }
      } catch (e) {}

      const res = await apiCall('getPublicStats', {}, true);
      if (res && res.success) {
        const rawStats = (res.stats && typeof res.stats === 'object') ? res.stats : res;
        const activeUsersVal = Math.max(Number(rawStats.activeUsers ?? rawStats.active_users ?? 0) || 0, 1);
        const totalUsersVal = Number(rawStats.totalUsers ?? rawStats.total_users ?? 0) || 0;
        const totalVisitsVal = Number(rawStats.totalVisits ?? rawStats.total_visits ?? 0) || 0;
        if (!portalState.globalData) portalState.globalData = {};
        portalState.globalData.stats = {
          ...(portalState.globalData.stats || {}),
          ...(res.stats && typeof res.stats === 'object' ? res.stats : {}),
          activeUsers: activeUsersVal,
          totalUsers: totalUsersVal,
          totalVisits: totalVisitsVal
        };
        portalState.globalData.activeUsers = Math.max(Number(portalState.globalData.activeUsers || 0), activeUsersVal);
        portalState.globalData.totalUsers = Math.max(Number(portalState.globalData.totalUsers || 0), totalUsersVal);
        portalState.globalData.totalVisits = Math.max(Number(portalState.globalData.totalVisits || 0), totalVisitsVal);
        try {
          localStorage.setItem('rp_public_footer_stats_cache_v1', JSON.stringify({
            activeUsers: portalState.globalData.activeUsers,
            totalUsers: portalState.globalData.totalUsers,
            totalVisits: portalState.globalData.totalVisits
          }));
        } catch (e) {}
        if (activeElement) activeElement.textContent = String(portalState.globalData.activeUsers);
        if (userElement) userElement.textContent = String(portalState.globalData.totalUsers);
        if (visitElement) visitElement.textContent = String(portalState.globalData.totalVisits);

        const contacts = res.adminContacts || (res.stats && res.stats.adminContacts);
        if (Array.isArray(contacts) && contacts.length > 0) {
          portalState.globalData.adminContacts = contacts;
        }
        const topBanner = res.banner || (res.stats && res.stats.banner);
        if (topBanner && typeof topBanner === 'object') {
          let cachedTop = {};
          try { cachedTop = JSON.parse(localStorage.getItem('steno_public_top_banner') || '{}') || {}; } catch (e) {}
          const mergedBanner = { ...cachedTop, ...topBanner };
          portalState.globalData.banner = mergedBanner;
          try { localStorage.setItem('steno_public_top_banner', JSON.stringify(mergedBanner)); } catch (e) {}
        }
        const dashBanner = res.dashboardCustomBanner || (res.stats && res.stats.dashboardCustomBanner);
        if (dashBanner && typeof dashBanner === 'object') {
          saveDashboardCustomBannerConfig(dashBanner);
        }
        if (res.maintenance && typeof res.maintenance === 'object') {
          saveMaintenanceConfigToStorage(res.maintenance, false);
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
      }
      if (typeof renderPromoBanner === 'function') renderPromoBanner();
    }

export const CLIENT_DEVICE_ID = (() => {
      let id = '';
      try { id = localStorage.getItem('rp_skill_device_id') || ''; } catch (e) {}
      if (!id) {
        id = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
        try { localStorage.setItem('rp_skill_device_id', id); } catch (e) {}
      }
      return id;
    })();

export const singleSessionChannel = (() => {
      try {
        return (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('rp_skill_single_session_channel') : null;
      } catch (e) {
        return null;
      }
    })();

if (singleSessionChannel) {
      singleSessionChannel.onmessage = (ev) => {
        if (!ev.data || !portalState.currentUser) return;
        if (ev.data.type === 'NEW_DEVICE_LOGIN') {
          if (String(ev.data.userId) === String(portalState.currentUser.userId) && ev.data.sessionToken !== portalState.currentUser.token) {
            forceSingleDeviceLogout('⚠️ Security Alert: Your account was signed in on another device or browser. You have been immediately logged out on this device.', false);
          }
        }
        if (ev.data.type === 'USER_BLOCKED_IMMEDIATELY' && String(ev.data.userId) === String(portalState.currentUser.userId)) {
          forceSingleDeviceLogout('🚫 Your account has been blocked by the Administrator. You have been immediately logged out.', true);
        }
      };
    }

window.addEventListener('storage', (ev) => {
      if (ev.key === 'rp_skill_active_session_map' && ev.newValue && portalState.currentUser) {
        try {
          const map = JSON.parse(ev.newValue);
          const activeTok = map[portalState.currentUser.userId];
          if (activeTok && portalState.currentUser.token && activeTok !== portalState.currentUser.token) {
            forceSingleDeviceLogout('⚠️ Security Alert: Your account was signed in on another device or browser. You have been immediately logged out.', false);
          }
        } catch (e) {}
      }
      if (ev.key === 'rp_blocked_users_map' && ev.newValue && portalState.currentUser) {
        try {
          const blockedMap = JSON.parse(ev.newValue || '{}');
          if (blockedMap[String(portalState.currentUser.userId)]) {
            forceSingleDeviceLogout('🚫 Your account has been blocked by the Administrator. You have been immediately logged out.', true);
          }
        } catch (e) {}
      }
    });

export function registerSingleDeviceSession(userObj) {
      if (!userObj || !userObj.userId) return;
      if (userObj.sessionToken && !userObj.token) {
        userObj.token = userObj.sessionToken;
      }
      if (!userObj.token) {
        userObj.token = 'SESS_' + userObj.userId + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      }
      if (!userObj.sessionToken) {
        userObj.sessionToken = userObj.token;
      }
      userObj.deviceId = CLIENT_DEVICE_ID;
      try {
        const map = JSON.parse(localStorage.getItem('rp_skill_active_session_map') || '{}');
        map[userObj.userId] = userObj.token;
        localStorage.setItem('rp_skill_active_session_map', JSON.stringify(map));
      } catch (e) {}
      if (singleSessionChannel) {
        singleSessionChannel.postMessage({
          type: 'NEW_DEVICE_LOGIN',
          userId: userObj.userId,
          sessionToken: userObj.token,
          deviceId: CLIENT_DEVICE_ID
        });
      }
    }

window._activeApiControllers = new Set();

window._sessionVerifyIntervalId = null;

window._liveTestsRefreshIntervalId = null;

window._sharedWarningAudioCtx = null;

export function cleanupAllAuthAndSessionResources() {
      // 1. Abort all in-flight authenticated fetch requests
      if (window._activeApiControllers && window._activeApiControllers.size > 0) {
        window._activeApiControllers.forEach(ctrl => {
          try { ctrl.abort(); } catch (e) {}
        });
        window._activeApiControllers.clear();
      }
      // 2. Clear session engagement tracker timer
      if (typeof portalState._sessionEngagementTimer !== 'undefined' && portalState._sessionEngagementTimer) {
        clearInterval(portalState._sessionEngagementTimer);
        portalState._sessionEngagementTimer = null;
      }
      // 3. Clear dashboard carousel auto-timers
      if (typeof carouselAutoTimers === 'object' && carouselAutoTimers) {
        Object.keys(carouselAutoTimers).forEach(k => {
          if (carouselAutoTimers[k]) {
            clearInterval(carouselAutoTimers[k]);
            delete carouselAutoTimers[k];
          }
        });
      }
      // 4. Clear dashboard banner & toppers scroll timers
      if (window._dashBannerCycleTimer) {
        clearInterval(window._dashBannerCycleTimer);
        window._dashBannerCycleTimer = null;
      }
      if (window._toppersAutoScrollTimer) {
        clearInterval(window._toppersAutoScrollTimer);
        window._toppersAutoScrollTimer = null;
      }
      // 5. Clear active exam / typing / CBT / dictation timers
      if (typeof portalState.testTimerInterval !== 'undefined' && portalState.testTimerInterval) {
        clearInterval(portalState.testTimerInterval);
        portalState.testTimerInterval = null;
      }
      if (typeof portalState.cbtTimerInterval !== 'undefined' && portalState.cbtTimerInterval) {
        clearInterval(portalState.cbtTimerInterval);
        portalState.cbtTimerInterval = null;
      }
      if (typeof portalState.learningTimerInterval !== 'undefined' && portalState.learningTimerInterval) {
        clearInterval(portalState.learningTimerInterval);
        portalState.learningTimerInterval = null;
      }
      if (typeof portalState.variableSpeedIntervalId !== 'undefined' && portalState.variableSpeedIntervalId) {
        clearInterval(portalState.variableSpeedIntervalId);
        portalState.variableSpeedIntervalId = null;
      }
      // 6. Stop any active speech synthesis or dictation audio
      try {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      } catch (e) {}
      // 7. Close shared Web AudioContext if open
      if (window._sharedWarningAudioCtx && typeof window._sharedWarningAudioCtx.close === 'function') {
        try { window._sharedWarningAudioCtx.close(); } catch (e) {}
        window._sharedWarningAudioCtx = null;
      }
    }

export function clearAllPortalCacheOnLogout() {
      try {
        const keysToRemove = [
          'steno_user',
          'steno_fast_cache_v3',
          'steno_user_custom_prefs',
          'steno_public_top_banner',
          'steno_dashboard_custom_banner',
          'steno_date_specific_banners',
          'steno_portal_notifications_v1',
          'steno_user_engagement_analytics_v1',
          'rp_skill_last_active_tab',
          'rp_skill_active_session_map',
          'steno_login_attempts'
        ];
        keysToRemove.forEach(k => {
          try { localStorage.removeItem(k); } catch (e) {}
        });
        // Also remove any per-user daily goal or ephemeral keys in localStorage
        const allLocalKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('rp_daily_goal_') || k.startsWith('steno_') || k.startsWith('rp_client_'))) {
            allLocalKeys.push(k);
          }
        }
        allLocalKeys.forEach(k => {
          try { localStorage.removeItem(k); } catch (e) {}
        });
      } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      try {
        if ('caches' in window && window.caches && typeof window.caches.keys === 'function') {
          window.caches.keys().then(names => {
            names.forEach(name => { try { window.caches.delete(name); } catch (e) {} });
          }).catch(() => {});
        }
      } catch (e) {}
      // Reset in-memory cached state so no stale data persists after logout
      portalState.globalData = {
        stats: { activeUsers: 0, materialsCount: 0, testsTaken: 0 },
        homework: [],
        announcements: [],
        leaderboard: [],
        userHistory: [],
        banner: { enabled: false, text: '', startTime: '', stopTime: '' },
        dashboardBanner: { mode: 'hidden', imageUrl: '', title: '', text: '' }
      };
      portalState.adminData = { users: [], logs: [], subtabs: [], feedbacks: [], banner: { enabled: false, text: '' } };
      portalState.materialsData = [];
      portalState.subtabsData = [];
      portalState.allTestHistoryList = [];
    }

export function showSecurityTerminationWarning(reasonMsg, isBlockedAccount, isDifferentDeviceFlag) {
      const lowerReason = String(reasonMsg || '').toLowerCase();
      const isOtherDevice = !isBlockedAccount && Boolean(
        isDifferentDeviceFlag === true ||
        lowerReason.includes('another device') ||
        lowerReason.includes('different device') ||
        lowerReason.includes('single active device') ||
        lowerReason.includes('other browser')
      );
      const msg = reasonMsg || (isBlockedAccount
        ? '🚫 Your account has been blocked by the Administrator. You have been immediately logged out.'
        : (isOtherDevice
          ? '⚠️ Security Alert: Your account was signed in on another device or browser. You have been immediately logged out on this device.'
          : 'Your session has expired. Please sign in again to continue.'));

      const banner = document.getElementById('auth-security-termination-banner');
      const bannerIcon = document.getElementById('auth-security-termination-icon');
      const bannerTitle = document.getElementById('auth-security-termination-title');
      const bannerMsg = document.getElementById('auth-security-termination-msg');
      if (banner) {
        banner.classList.remove('hidden');
        if (bannerIcon) bannerIcon.textContent = isBlockedAccount ? '🚫' : (isOtherDevice ? '⚠️' : '🔐');
        if (bannerTitle) {
          bannerTitle.textContent = isBlockedAccount
            ? 'Account Blocked by Administrator — Logged Out Immediately'
            : (isOtherDevice ? 'Signed In on Another Device — Logged Out Immediately' : 'Session Expired — Please Sign In Again');
        }
        if (bannerMsg) bannerMsg.textContent = msg;
      }

      const modal = document.getElementById('session-termination-alert-modal');
      const modalIcon = document.getElementById('session-termination-modal-icon');
      const modalTitle = document.getElementById('session-termination-modal-title');
      const modalDesc = document.getElementById('session-termination-modal-desc');
      const modalMeta = document.getElementById('session-termination-modal-meta');
      if (modal) {
        if (modalIcon) modalIcon.textContent = isBlockedAccount ? '🚫' : (isOtherDevice ? '📲' : '🔐');
        if (modalTitle) {
          modalTitle.textContent = isBlockedAccount
            ? 'Account Blocked — Immediate Logout'
            : (isOtherDevice ? 'Signed In on Another Device' : 'Session Expired — Sign In Again');
        }
        if (modalDesc) modalDesc.textContent = msg;
        if (modalMeta) {
          modalMeta.textContent = isBlockedAccount
            ? 'Status: BLOCKED • Please contact the Institute Administrator if you need assistance.'
            : (isOtherDevice
              ? 'Policy: Single Active Device Enforced • Previous session terminated automatically.'
              : 'Your secure portal session expired. Sign in again to restore your workspace.');
        }
        modal.classList.remove('hidden');
      }
    }

export function acknowledgeSessionTerminationModal() {
      const modal = document.getElementById('session-termination-alert-modal');
      if (modal) modal.classList.add('hidden');
    }

export function forceSingleDeviceLogout(reasonMsg, isBlockedAccount, isDifferentDeviceFlag) {
      if (!portalState.currentUser) return;
      const uid = portalState.currentUser.userId;
      const uname = portalState.currentUser.name;
      cleanupAllAuthAndSessionResources();
      portalState.currentUser = null;
      clearAllPortalCacheOnLogout();
      logPortalAction(isBlockedAccount ? 'ACCOUNT_BLOCKED_LOGOUT' : 'SINGLE_DEVICE_LOGOUT', reasonMsg || 'Logged out due to security policy.', uid, uname);
      renderAuthView();
      switchAuthTab('login');
      if (typeof renderPromoBanner === 'function') renderPromoBanner();
      showSecurityTerminationWarning(reasonMsg, Boolean(isBlockedAccount), isDifferentDeviceFlag);
      showToast((isBlockedAccount ? '🚫 ' : '🔒 ') + (reasonMsg || 'Your session was logged out.'));
    }

export async function verifyUserSession() {
      if (!portalState.currentUser || !portalState.currentUser.userId) return;
      try {
        const uidStr = String(portalState.currentUser.userId).trim();
        const blockedMap = JSON.parse(localStorage.getItem('rp_blocked_users_map') || '{}');
        if (blockedMap[uidStr]) {
          forceSingleDeviceLogout('🚫 Your account has been blocked by the Administrator. You have been immediately logged out across all devices.', true);
          return;
        }
        const globalLocks = JSON.parse(localStorage.getItem('rp_global_device_locks_v1') || '{}');
        const lockEntry = globalLocks[uidStr];
        if (lockEntry && lockEntry.locked) {
          if (lockEntry.mode === 'ALL_DEVICES' || (lockEntry.allowedDeviceId && lockEntry.allowedDeviceId !== CLIENT_DEVICE_ID)) {
            forceSingleDeviceLogout(lockEntry.reason || '🔒 Security Lock: Your account has been locked across all devices by the Administrator.', true);
            return;
          }
        }
      } catch (e) {}
      if (document.hidden) return;
      // Give freshly established logins an 8s propagation grace window before polling session token
      if (window._lastSuccessfulLoginAt && (Date.now() - window._lastSuccessfulLoginAt) < 8000) return;
      const sessToken = portalState.currentUser.sessionToken || portalState.currentUser.token;
      if (sessToken) {
        const checkRes = await apiCall('verifySessionToken', {
          userId: portalState.currentUser.userId,
          sessionToken: sessToken,
          deviceId: CLIENT_DEVICE_ID
        }, true);
        if (checkRes && (checkRes.valid === false || checkRes.sessionInvalid === true || checkRes.blocked === true || checkRes.lockedAcrossDevices === true || checkRes.differentDevice === true)) {
          if (!portalState.currentUser || (portalState.currentUser.sessionToken || portalState.currentUser.token) !== sessToken) return;
          const isBlocked = Boolean(checkRes.blocked || checkRes.lockedAcrossDevices || checkRes.reason === 'ACCOUNT_BLOCKED' || checkRes.reason === 'DEVICE_LOCKED');
          const msg = checkRes.message || (isBlocked
            ? '🔒 Your account has been locked across all devices by the Administrator.'
            : '⚠️ Security Alert: Your account was signed in on another device. Cross-device lock is active (only 1 device allowed).');
          forceSingleDeviceLogout(msg, isBlocked, Boolean(checkRes.differentDevice || checkRes.reason === 'DIFFERENT_DEVICE_LOGIN'));
          return;
        }
      }
    }

export function ensureSessionVerifyLoopRunning() {
      if (window._sessionVerifyIntervalId) clearInterval(window._sessionVerifyIntervalId);
      window._sessionVerifyIntervalId = setInterval(() => {
        if (portalState.currentUser && portalState.currentUser.userId && !document.hidden) {
          verifyUserSession();
        }
      }, 6000);
    }

ensureSessionVerifyLoopRunning();

window.addEventListener('focus', () => { if (portalState.currentUser) verifyUserSession(); });

document.addEventListener('visibilitychange', () => { if (!document.hidden && portalState.currentUser) verifyUserSession(); });

window.addEventListener('storage', (ev) => {
      if (!portalState.currentUser || !portalState.currentUser.userId) return;
      if (ev.key === 'rp_blocked_users_map' || ev.key === 'rp_global_device_locks_v1' || ev.key === 'rp_skill_user') {
        verifyUserSession();
      }
    });

export function logPortalAction(activityType, details, overrideUserId = null, overrideUserName = null) {
      const uid = overrideUserId || (portalState.currentUser ? portalState.currentUser.userId : 'GUEST');
      const roleTag = portalState.currentUser && portalState.currentUser.role ? `[${String(portalState.currentUser.role).toUpperCase()}] ` : '';
      const uname = overrideUserName || (portalState.currentUser ? `${roleTag}${portalState.currentUser.name || 'User'}` : 'Guest');
      const entry = {
        LogID: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 900 + 100),
        UserID: uid,
        UserName: uname,
        ActivityType: activityType,
        Details: details,
        Timestamp: new Date().toISOString()
      };
      if (!portalState.adminData) portalState.adminData = {};
      if (!Array.isArray(portalState.adminData.logs)) portalState.adminData.logs = [];
      portalState.adminData.logs.unshift(entry);
      try {
        const localLogs = JSON.parse(localStorage.getItem('rp_skill_audit_logs') || '[]');
        localLogs.unshift(entry);
        if (localLogs.length > 500) localLogs.length = 500;
        localStorage.setItem('rp_skill_audit_logs', JSON.stringify(localLogs));
      } catch (e) {}
      if (portalState.activeTab === 'admin' && typeof renderAdminLogs === 'function') {
        renderAdminLogs();
      }
      if (typeof renderAdminPerformanceDashboard === 'function' && portalState.activeTab === 'admin') {
        renderAdminPerformanceDashboard();
      }
      if (portalState.currentUser && portalState.currentUser.userId && (portalState.currentUser.sessionToken || portalState.currentUser.token)) {
        apiCall('logActivity', {
          userId: uid,
          userName: uname,
          activityType: activityType,
          details: details
        }, true);
      }
    }

export const READ_ONLY_ACTIONS = {
      'getDashboardData': true,
      'getPublicStats': true,
      'getMaterials': true,
      'getFeedbackHistory': true,
      'getAdminData': true,
      'getTestHistory': true,
      'getUserHistory': true,
      'getTestHistoryDetail': true,
      'getEvaluationRules': true,
      'getBatchGroupMessages': true,
      'getHelpContacts': true,
      'getDailyGoalProgress': true,
      'getFeeConfig': true,
      'getFeeLedger': true,
      'getStreamRecord': true,
      'getOutlineRequests': true,
      'getWordOutlineRequests': true,
      'getActivityArchivalStatus': true,
      'validateFeeCoupon': true,
      'logActivity': true,
      'verifySessionToken': true
    };

export const NON_CACHEABLE_READ_ACTIONS = {
      'getStreamRecord': true,
      'logActivity': true,
      'verifySessionToken': true,
      'getBatchGroupMessages': true,
      'validateFeeCoupon': true
    };

export const _inFlightReadRequests = new Map();

export const _shortReadCache = new Map();

export const SHORT_READ_CACHE_TTL_MS = 8000;

export function buildReadCacheKey(action, payload) {
      try {
        const clean = {};
        if (payload && typeof payload === 'object') {
          Object.keys(payload).sort().forEach((k) => {
            if (k === 'authSessionToken' || k === 'sessionToken' || k === 'authDeviceId' || k === 'deviceId') return;
            clean[k] = payload[k];
          });
        }
        return action + '::' + JSON.stringify(clean);
      } catch (e) {
        return action;
      }
    }

export function clearShortReadApiCache() {
      _shortReadCache.clear();
    }

window.clearShortReadApiCache = clearShortReadApiCache;

export const QUEUEABLE_WRITE_ACTIONS = {
      'uploadMaterial': true,
      'updateMaterial': true,
      'deleteMaterial': true,
      'bulkDeleteMaterials': true,
      'purgeExpiredMaterials': true,
      'saveContentAutoDeletePolicy': true,
      'adminUpdateUserDetails': true,
      'saveParentDetails': true,
      'saveFeeConfig': true,
      'submitStudentFeePayment': true,
      'verifyFeePayment': true,
      'updateMemberAccessScope': true,
      'replyWordOutlineRequest': true,
      'resolveOutlineRequest': true,
      'saveTestHistory': true,
      'saveEvaluationRules': true,
      'saveDailyGoalProgress': true,
      'saveBatchGroupMessage': true,
      'replyBatchGroupMessage': true,
      'deleteBatchGroupMessage': true,
      'appointBatchMonitor': true,
      'updateUserRoleStatus': true,
      'updateUserBatch': true,
      'bulkUpdateUserBatches': true,
      'manageSubtab': true,
      'updateBannerSettings': true,
      'updateDashboardCustomBanner': true,
      'updateDateSpecificBanners': true,
      'saveScheduledLiveTests': true,
      'saveInstituteBatches': true,
      'updateMaintenanceSettings': true,
      'submitFeedback': true,
      'adminReplyFeedback': true,
      'syncUserCloudState': true
    };

export const PENDING_CLOUD_WRITES_KEY = 'rp_pending_cloud_writes_v1';

export let _isFlushingPendingWrites = false;

export function enqueuePendingCloudWrite(action, payload) {
      if (!QUEUEABLE_WRITE_ACTIONS[action]) return;
      try {
        const list = JSON.parse(localStorage.getItem(PENDING_CLOUD_WRITES_KEY) || '[]');
        list.push({
          id: 'PW-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          action,
          payload,
          queuedAt: Date.now()
        });
        if (list.length > 40) list.splice(0, list.length - 40);
        localStorage.setItem(PENDING_CLOUD_WRITES_KEY, JSON.stringify(list));
      } catch (e) {}
    }

export async function flushPendingCloudWrites() {
      if (_isFlushingPendingWrites || !navigator.onLine) return;
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem(PENDING_CLOUD_WRITES_KEY) || '[]');
      } catch (e) {
        list = [];
      }
      if (!Array.isArray(list) || list.length === 0) return;
      _isFlushingPendingWrites = true;
      try {
        const remaining = [];
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          if (!item || !item.action) continue;
          const res = await apiCall(item.action, item.payload || {}, true, 0, 500, true);
          if (!res || (!res.success && res.networkError)) {
            remaining.push(item);
          }
        }
        localStorage.setItem(PENDING_CLOUD_WRITES_KEY, JSON.stringify(remaining));
      } catch (e) {
      } finally {
        _isFlushingPendingWrites = false;
      }
    }

export const FAILED_TEST_QUEUE_KEY = 'rp_failed_test_submissions_queue_v1';

export let _isFlushingFailedTests = false;

export function getFailedTestSubmissionQueue() {
      try {
        const raw = localStorage.getItem(FAILED_TEST_QUEUE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

export function saveFailedTestSubmissionQueue(list) {
      try {
        localStorage.setItem(FAILED_TEST_QUEUE_KEY, JSON.stringify((list || []).slice(-30)));
      } catch (e) {}
      renderUnsyncedTestRetryBanner();
    }

export function enqueueFailedTestSubmission(payload) {
      if (!payload || typeof payload !== 'object') return;
      const queue = getFailedTestSubmissionQueue();
      const fingerprint = `${payload.userId || ''}|${payload.examName || ''}|${payload.timestamp || payload.date || ''}|${payload.wpm || payload.netSpeed || payload.score || ''}`;
      if (!queue.some(item => item.fingerprint === fingerprint)) {
        queue.push({
          id: 'FTQ-' + Date.now() + '-' + Math.floor(Math.random() * 999),
          fingerprint,
          queuedAt: new Date().toISOString(),
          payload: { ...payload }
        });
        saveFailedTestSubmissionQueue(queue);
      } else {
        renderUnsyncedTestRetryBanner();
      }
    }

export function renderUnsyncedTestRetryBanner() {
      const queue = getFailedTestSubmissionQueue();
      let bar = document.getElementById('rp-unsynced-test-retry-bar');
      if (!queue.length) {
        if (bar) bar.remove();
        return;
      }
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'rp-unsynced-test-retry-bar';
        bar.style.cssText = 'position:fixed; bottom:18px; left:18px; z-index:99999; background:#0f172a; color:#f8fafc; border:1px solid rgba(245,158,11,0.65); border-left:4px solid #f59e0b; border-radius:12px; padding:10px 14px; box-shadow:0 12px 28px rgba(15,23,42,0.35); display:flex; align-items:center; gap:10px; font-size:12px; max-width:420px;';
        document.body.appendChild(bar);
      }
      bar.innerHTML = `
        <i class="fa-solid fa-cloud-arrow-up" style="color:#fbbf24; font-size:15px;"></i>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:800; color:#fef3c7;">Unsynced Test Result${queue.length === 1 ? '' : 's'} (${queue.length})</div>
          <div style="font-size:11px; color:#cbd5e1;">Saved safely on this device while offline.</div>
        </div>
        <button type="button" onclick="window.retryFailedTestSubmissionsNow(false)" style="background:#f59e0b; color:#0f172a; border:none; border-radius:8px; padding:6px 11px; font-size:11px; font-weight:900; cursor:pointer; white-space:nowrap;">
          Retry Now
        </button>
      `;
    }

window.retryFailedTestSubmissionsNow = async function(silent = false) {
      if (_isFlushingFailedTests || !portalState.currentUser || !portalState.currentUser.userId) return;
      const queue = getFailedTestSubmissionQueue();
      if (!queue.length) return;
      _isFlushingFailedTests = true;
      const remaining = [];
      let syncedCount = 0;
      for (const entry of queue) {
        try {
          const res = await apiCall('saveTestHistory', { ...entry.payload }, true, 0, 500, true);
          if (res && res.success) {
            syncedCount++;
          } else {
            remaining.push(entry);
          }
        } catch (e) {
          remaining.push(entry);
        }
      }
      _isFlushingFailedTests = false;
      saveFailedTestSubmissionQueue(remaining);
      if (!silent && typeof showToast === 'function') {
        if (syncedCount > 0 && remaining.length === 0) {
          showToast(`✅ Synced ${syncedCount} pending test result(s) to Google Sheets!`);
        } else if (syncedCount > 0) {
          showToast(`✅ Synced ${syncedCount} test result(s); ${remaining.length} still pending.`);
        } else {
          showToast('⚠️ Still offline or server busy — results remain safely queued on this device.');
        }
      }
    };

window.addEventListener('online', () => {
      flushPendingCloudWrites();
      window.retryFailedTestSubmissionsNow(true);
      syncPortalDataInBackground();
    });

onDomReady(() => {
      renderUnsyncedTestRetryBanner();
    });

export const AUTH_NON_RETRY_ACTIONS = {
      'signup': true,
      'login': true,
      'verifyMfaOtp': true,
      'forgetPassword': true
    };

export async function _coreApiCall(action, payload = {}, silent = false, retries = null, delay = 750, skipQueue = false) {
      const isReadAction = !!READ_ONLY_ACTIONS[action];
      if (!isReadAction) {
        clearShortReadApiCache();
      }
      if (retries === null || retries === undefined) {
        retries = AUTH_NON_RETRY_ACTIONS[action] ? 0 : (isReadAction ? 1 : 2);
      }

      const canShortCache = isReadAction && !NON_CACHEABLE_READ_ACTIONS[action] && !payload._bypassCache;
      const cacheKey = canShortCache ? buildReadCacheKey(action, payload) : '';
      if (canShortCache) {
        const cached = _shortReadCache.get(cacheKey);
        if (cached && (Date.now() - cached.ts) < SHORT_READ_CACHE_TTL_MS) {
          return cached.data;
        }
        if (_inFlightReadRequests.has(cacheKey)) {
          return _inFlightReadRequests.get(cacheKey);
        }
      }

      const useSilent = silent || isReadAction;
      if (!useSilent) {
        showLoader(true);
      } else if (action !== 'logActivity' && action !== 'verifySessionToken' && action !== 'getBatchGroupMessages' && action !== 'getStreamRecord') {
        setBackgroundSyncIndicator(true, 'Syncing with Google Sheets...');
      }

      const requestSessionToken = (portalState.currentUser && (portalState.currentUser.sessionToken || portalState.currentUser.token)) ? String(portalState.currentUser.sessionToken || portalState.currentUser.token) : '';
      if (portalState.currentUser && portalState.currentUser.userId) {
        if (!payload.requesterId) payload.requesterId = portalState.currentUser.userId;
        if (!payload.requesterName) payload.requesterName = portalState.currentUser.name;
        if (!payload.sessionToken) payload.sessionToken = requestSessionToken;
        if (!payload.deviceId) payload.deviceId = CLIENT_DEVICE_ID;
        payload.authUserId = portalState.currentUser.userId;
        payload.authSessionToken = requestSessionToken;
        payload.authDeviceId = CLIENT_DEVICE_ID;
      }

      const execPromise = (async () => {
        const controller = new AbortController();
        if (window._activeApiControllers && action !== 'logout' && action !== 'logActivity') {
          window._activeApiControllers.add(controller);
        }
        const timeoutMs = isReadAction ? 16000 : 28000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        let willRetry = false;

        try {
          let result = null;
          const hasGasNativeBridge = (
            typeof google !== 'undefined' &&
            google &&
            google.script &&
            google.script.run &&
            typeof google.script.run.rpClientApiBridge === 'function'
          );

          if (hasGasNativeBridge) {
            result = await new Promise((resolve, reject) => {
              let settled = false;
              const onAbort = () => {
                if (!settled) {
                  settled = true;
                  const abortErr = new Error('Request timed out');
                  abortErr.name = 'AbortError';
                  reject(abortErr);
                }
              };
              controller.signal.addEventListener('abort', onAbort, { once: true });
              google.script.run
                .withSuccessHandler((resObj) => {
                  if (!settled) {
                    settled = true;
                    controller.signal.removeEventListener('abort', onAbort);
                    resolve(resObj);
                  }
                })
                .withFailureHandler((errObj) => {
                  if (!settled) {
                    settled = true;
                    controller.signal.removeEventListener('abort', onAbort);
                    reject(new Error((errObj && errObj.message) ? errObj.message : String(errObj || 'Apps Script bridge error')));
                  }
                })
                .rpClientApiBridge(action, payload);
            });
            clearTimeout(timeoutId);
            if (window._activeApiControllers) window._activeApiControllers.delete(controller);
          } else {
            const standaloneUrl = typeof resolveStandaloneBackendUrl === 'function' ? resolveStandaloneBackendUrl() : '';
            const isFileProtocol = Boolean(window.location && window.location.protocol === 'file:');
            const preferProxy = !isFileProtocol && (
              (window.location && window.location.search && window.location.search.indexOf('rp_proxy=1') !== -1) ||
              !standaloneUrl
            );
            const primaryEndpoint = preferProxy ? '/api/gas-proxy' : (standaloneUrl || '/api/gas-proxy');

            if (primaryEndpoint === '/api/gas-proxy' && isFileProtocol) {
              clearTimeout(timeoutId);
              if (window._activeApiControllers) window._activeApiControllers.delete(controller);
              return {
                success: false,
                networkError: true,
                message: 'Please open this portal via your hosted web URL or Google Apps Script Web App deployment to connect to Google Sheets.'
              };
            }

            const callParentApiProxy = (reqAction, reqPayload, abortSignal) => {
              return new Promise((resolve, reject) => {
                if (!window.parent || window.parent === window) {
                  reject(new Error('No parent proxy host available'));
                  return;
                }
                const requestId = 'rp_px_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
                let settled = false;
                const cleanup = () => {
                  window.removeEventListener('message', onMsg);
                  if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
                };
                const onAbort = () => {
                  if (settled) return;
                  settled = true;
                  cleanup();
                  const ae = new Error('Request aborted');
                  ae.name = 'AbortError';
                  reject(ae);
                };
                const onMsg = (ev) => {
                  if (ev.origin !== window.location.origin) return;
                  if (!ev.data || ev.data.type !== 'RP_API_PROXY_RESULT' || ev.data.requestId !== requestId) return;
                  if (settled) return;
                  settled = true;
                  cleanup();
                  if (ev.data.error && !ev.data.text) {
                    reject(new Error(String(ev.data.error)));
                    return;
                  }
                  resolve({
                    ok: Boolean(ev.data.ok),
                    status: Number(ev.data.status || 0),
                    contentType: String(ev.data.contentType || ''),
                    url: String(ev.data.url || ''),
                    rawText: String(ev.data.text || '')
                  });
                };
                window.addEventListener('message', onMsg);
                if (abortSignal) {
                  if (abortSignal.aborted) {
                    onAbort();
                    return;
                  }
                  abortSignal.addEventListener('abort', onAbort, { once: true });
                }
                try {
                  window.parent.postMessage({
                    type: 'RP_API_PROXY_CALL',
                    requestId: requestId,
                    action: reqAction,
                    payload: reqPayload
                  }, window.location.origin);
                } catch (postErr) {
                  settled = true;
                  cleanup();
                  reject(postErr);
                }
              });
            };

            const classifyNonJsonProxyReply = (statusCode, contentType, rawBody, finalUrl) => {
              const trimmedBody = String(rawBody || '').trim();
              const ctLower = String(contentType || '').toLowerCase();
              const urlLower = String(finalUrl || '').toLowerCase();
              const looksLikeHtml =
                ctLower.indexOf('text/html') !== -1 ||
                trimmedBody.startsWith('<!DOCTYPE') ||
                trimmedBody.startsWith('<!doctype') ||
                trimmedBody.startsWith('<html') ||
                trimmedBody.startsWith('<HTML');
              const isPreviewCookieGate = Boolean(
                urlLower.indexOf('__cookie_check') !== -1 ||
                urlLower.indexOf('accounts.google.com') !== -1 ||
                trimmedBody.indexOf('__cookie_check') !== -1 ||
                trimmedBody.indexOf('aistudio_auth_flow') !== -1 ||
                statusCode === 302 ||
                statusCode === 401 ||
                statusCode === 403 ||
                looksLikeHtml
              );
              if (isPreviewCookieGate) {
                return 'Browser blocked the preview session cookie inside the embedded iframe. Click "Open in New Tab" at the top-right of the preview or allow third-party cookies for this preview to sign in.';
              }
              return 'Non-JSON response from backend server';
            };

            const executeHttpPost = async (targetUrl) => {
              const isProxyMode = targetUrl === '/api/gas-proxy';
              const response = await fetch(targetUrl, {
                method: 'POST',
                redirect: 'follow',
                credentials: isProxyMode ? 'include' : 'omit',
                cache: 'no-store',
                headers: { 'Content-Type': isProxyMode ? 'application/json' : 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: action, payload: payload }),
                signal: controller.signal
              });
              const rawText = await response.text();
              return {
                ok: response.ok,
                status: response.status,
                contentType: response.headers.get('content-type') || '',
                url: response.url || targetUrl,
                rawText: rawText
              };
            };

            let replyObj = null;
            let directErr = null;
            try {
              replyObj = await executeHttpPost(primaryEndpoint);
              if (primaryEndpoint === '/api/gas-proxy' && (replyObj.status === 404 || replyObj.status === 405) && standaloneUrl) {
                replyObj = await executeHttpPost(standaloneUrl);
              }
            } catch (fetchErr) {
              directErr = fetchErr;
            }

            const parseJsonSafe = (txt) => {
              const s = String(txt || '').trim();
              if (!s) return null;
              try {
                const p = JSON.parse(s);
                return (p && typeof p === 'object') ? p : null;
              } catch (_pe) {
                return null;
              }
            };

            let parsedJson = replyObj ? parseJsonSafe(replyObj.rawText) : null;
            const canUseParentRelay = Boolean(
              primaryEndpoint === '/api/gas-proxy' &&
              window.parent &&
              window.parent !== window &&
              !(directErr && directErr.name === 'AbortError')
            );

            if (!parsedJson && canUseParentRelay) {
              try {
                const parentReply = await callParentApiProxy(action, payload, controller.signal);
                const parentParsed = parseJsonSafe(parentReply.rawText);
                if (parentParsed) {
                  replyObj = parentReply;
                  parsedJson = parentParsed;
                  directErr = null;
                } else if (!replyObj) {
                  replyObj = parentReply;
                }
              } catch (_relayErr) {
                // Keep direct error or reply classification below
              }
            }

            clearTimeout(timeoutId);
            if (window._activeApiControllers) window._activeApiControllers.delete(controller);

            if (parsedJson) {
              result = parsedJson;
            } else if (replyObj) {
              throw new Error(classifyNonJsonProxyReply(replyObj.status, replyObj.contentType, replyObj.rawText, replyObj.url));
            } else if (directErr) {
              throw directErr;
            } else {
              throw new Error('Non-JSON response from backend server');
            }
          }

          if (result && result.sessionInvalid) {
            const activeTokNow = (portalState.currentUser && (portalState.currentUser.sessionToken || portalState.currentUser.token)) ? String(portalState.currentUser.sessionToken || portalState.currentUser.token) : '';
            const isHardSecurityLock = Boolean(result.blocked || result.lockedAcrossDevices || result.differentDevice);
            const pastLoginGrace = !window._lastSuccessfulLoginAt || (Date.now() - window._lastSuccessfulLoginAt) > 8000;
            const shouldForceLogout = Boolean(
              portalState.currentUser &&
              requestSessionToken &&
              activeTokNow === requestSessionToken &&
              !AUTH_NON_RETRY_ACTIONS[action] &&
              action !== 'logActivity' &&
              (isHardSecurityLock || pastLoginGrace)
            );
            if (shouldForceLogout) {
              forceSingleDeviceLogout(result.message, Boolean(result.blocked || result.lockedAcrossDevices), Boolean(result.differentDevice || result.reason === 'DIFFERENT_DEVICE_LOGIN'));
            }
            return result;
          }

          if (!result.success && result.message && (result.message.includes('Server busy') || result.message.includes('busy')) && retries > 0) {
            willRetry = true;
            if (!useSilent) showLoader(false);
            else if (action !== 'logActivity' && action !== 'getStreamRecord') setBackgroundSyncIndicator(false);
            await new Promise(resolve => setTimeout(resolve, delay));
            return _coreApiCall(action, payload, useSilent, retries - 1, Math.round(delay * 1.4), skipQueue);
          }

          if (canShortCache && result && result.success) {
            _shortReadCache.set(cacheKey, { ts: Date.now(), data: result });
            if (_shortReadCache.size > 40) {
              const oldestKey = _shortReadCache.keys().next().value;
              if (oldestKey) _shortReadCache.delete(oldestKey);
            }
          }

          if (action === 'saveTestHistory' && !skipQueue && (!result || !result.success)) {
            enqueueFailedTestSubmission(payload);
          }

          if (result && result.success && !skipQueue && QUEUEABLE_WRITE_ACTIONS[action]) {
            setTimeout(() => flushPendingCloudWrites(), 1200);
          }
          return result;
        } catch (err) {
          clearTimeout(timeoutId);
          if (window._activeApiControllers) window._activeApiControllers.delete(controller);
          if (err && err.name === 'AbortError' && !portalState.currentUser && action !== 'login' && action !== 'signup' && action !== 'verifyMfaOtp') {
            return { success: false, aborted: true, message: 'Request cancelled after session logout.' };
          }
          if (retries > 0) {
            willRetry = true;
            if (!useSilent) showLoader(false);
            else if (action !== 'logActivity' && action !== 'verifySessionToken' && action !== 'getStreamRecord') setBackgroundSyncIndicator(false);
            await new Promise(resolve => setTimeout(resolve, delay));
            return _coreApiCall(action, payload, useSilent, retries - 1, Math.round(delay * 1.4), skipQueue);
          }
          if (action === 'saveTestHistory' && !skipQueue) {
            enqueueFailedTestSubmission(payload);
            return {
              success: false,
              queuedForRetry: true,
              networkError: true,
              message: 'Connection lost — test result saved locally and queued for automatic retry!'
            };
          }
          if (!skipQueue && QUEUEABLE_WRITE_ACTIONS[action]) {
            enqueuePendingCloudWrite(action, payload);
            return {
              success: true,
              queuedForCloudSync: true,
              networkError: true,
              message: 'Saved locally & queued for automatic Google Sheet sync!'
            };
          }
          if (AUTH_NON_RETRY_ACTIONS[action]) {
            const isTimeout = err && err.name === 'AbortError';
            const detail = isTimeout
              ? 'Server request timed out. Please try again.'
              : ((err && err.message) ? ('Unable to reach server: ' + err.message) : 'Unable to reach server. Please check your internet connection and try again.');
            return { success: false, networkError: true, message: detail };
          }
          return { success: false, networkError: true, message: 'Working in fast local/cached mode.' };
        } finally {
          if (!willRetry) {
            if (!useSilent) showLoader(false);
            else if (action !== 'logActivity' && action !== 'verifySessionToken' && action !== 'getStreamRecord') setBackgroundSyncIndicator(false);
          }
          if (canShortCache) _inFlightReadRequests.delete(cacheKey);
        }
      })();

      if (canShortCache) {
        _inFlightReadRequests.set(cacheKey, execPromise);
      }
      return execPromise;
    }

export async function apiCall(action, payload = {}, silent = false, retries = null, delay = 750, skipQueue = false) {
      return _coreApiCall(action, payload, silent, retries, delay, skipQueue);
    }

export let _loaderCancelBtnTimer = null;

export let _loaderFailsafeTimer = null;

export function showLoader(show) {
      const loader = document.getElementById('global-loader');
      const cancelBtn = document.getElementById('global-loader-cancel-btn');
      if (_loaderCancelBtnTimer) { clearTimeout(_loaderCancelBtnTimer); _loaderCancelBtnTimer = null; }
      if (_loaderFailsafeTimer) { clearTimeout(_loaderFailsafeTimer); _loaderFailsafeTimer = null; }
      if (cancelBtn) cancelBtn.style.display = 'none';
      if (loader) loader.style.display = show ? 'flex' : 'none';
      if (show) {
        _loaderCancelBtnTimer = setTimeout(() => {
          const btn = document.getElementById('global-loader-cancel-btn');
          if (btn) btn.style.display = 'inline-block';
        }, 9000);
        _loaderFailsafeTimer = setTimeout(() => {
          showLoader(false);
        }, 30000);
      }
    }

window.cancelGlobalLoaderAndRequests = function() {
      try {
        if (window._activeApiControllers && typeof window._activeApiControllers.forEach === 'function') {
          window._activeApiControllers.forEach((ctrl) => { try { ctrl.abort(); } catch (e) {} });
          window._activeApiControllers.clear();
        }
      } catch (e) {}
      portalState._signupInProgress = false;
      portalState._loginInProgress = false;
      portalState._mfaVerifyInProgress = false;
      portalState._forgetPasswordInProgress = false;
      const signupBtn = document.getElementById('btn-signup-submit');
      if (signupBtn) { signupBtn.disabled = false; signupBtn.innerHTML = 'Sign Up'; }
      const loginBtn = document.getElementById('btn-login-submit');
      if (loginBtn) { loginBtn.disabled = false; loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Log In'; }
      const mfaBtn = document.getElementById('btn-mfa-verify-submit');
      if (mfaBtn) { mfaBtn.disabled = false; }
      const forgetBtn = document.getElementById('btn-forget-submit');
      if (forgetBtn) { forgetBtn.disabled = false; }
      showLoader(false);
      if (typeof showToast === 'function') showToast('Request cancelled. You can try again.');
    };

export let _toastHideTimer = null;


export function showToast(msg) {
  const toast = document.getElementById("center-toast");
  if (!toast) return;
  // Never display top/bottom toast popups while any timed exam (Typing/Pitman/Audio/CBT) or fullscreen viewer is active
  if (
    document.body.classList.contains('immersive-fullscreen-lock') ||
    document.body.classList.contains('cbt-exam-fullscreen-lock') ||
    document.body.classList.contains('rp-media-viewer-open')
  ) {
    toast.style.display = "none";
    return;
  }
  toast.innerText = msg;
  toast.style.display = "block";
  if (_toastHideTimer) clearTimeout(_toastHideTimer);
  _toastHideTimer = setTimeout(() => {
    toast.style.display = "none";
    _toastHideTimer = null;
  }, 3500);
}

export function injectClearIconsToInputs() {
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="url"], input[type="date"]');
  inputs.forEach(input => {
    if (!input.id || input.dataset.clearInjected) return;
    input.dataset.clearInjected = "true";

    const origWidth = input.style.width;
    const origMaxWidth = input.style.maxWidth;
    const origMinWidth = input.style.minWidth;
    const origFlex = input.style.flex;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: relative; display: inline-flex; align-items: center;';
    wrapper.style.width = origWidth || '100%';
    if (origMaxWidth) wrapper.style.maxWidth = origMaxWidth;
    if (origMinWidth) wrapper.style.minWidth = origMinWidth;
    if (origFlex) wrapper.style.flex = origFlex;

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    input.style.width = '100%';
    input.style.maxWidth = '100%';
    input.style.paddingRight = '28px';

    const clearBtn = document.createElement('span');
    clearBtn.id = `clear-${input.id}`;
    clearBtn.innerHTML = '&times;';
    clearBtn.style.cssText = 'position: absolute; right: 8px; cursor: pointer; color: #94a3b8; font-weight: bold; font-size: 16px; display: none; user-select: none; z-index: 5;';
    
    clearBtn.onclick = () => {
      input.value = '';
      clearBtn.style.display = 'none';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
    };
    wrapper.appendChild(clearBtn);

    input.addEventListener('input', () => {
      clearBtn.style.display = input.value ? 'inline' : 'none';
    });
  });
}

if (!portalState.allEvaluationRules || typeof portalState.allEvaluationRules !== 'object') {
  portalState.allEvaluationRules = {};
}

export function populateEvalCategoryDropdown() {
  const select = document.getElementById('eval-category-select');
  if (!select) return;
  
  const currentVal = select.value;
  select.innerHTML = `
    <option value="audio">🎧 Audio Dictation Tab (Shown on Audio "Transcribe Now")</option>
    <option value="pitman">📖 Pitman Book Tab (Shown on Pitman "Transcribe Now")</option>
    <option value="typingtest">⌨️ Typing Test Tab (Shown on Typing Test)</option>
    <option value="cbttest">🖥️ CBT Exam Tab (Shown on SSC / CBT Exams)</option>
  `;
  
  if (currentVal && (currentVal === 'audio' || currentVal === 'pitman' || currentVal === 'typingtest' || currentVal === 'cbttest')) {
    select.value = currentVal;
  } else {
    select.selectedIndex = 0;
  }
  handleEvalCategoryChange();
  populateSavedRulesQuickDropdown();
}

export function populateSavedRulesQuickDropdown() {
  const quickSelect = document.getElementById('saved-rules-quick-select');
  if (!quickSelect) return;

  const activeCat = (document.getElementById('eval-category-select')?.value || '').toLowerCase();
  quickSelect.innerHTML = `<option value="" disabled selected>-- Select a Saved ${activeCat ? activeCat.toUpperCase() + ' ' : ''}Exam Rule to Edit/View --</option>`;
  
  const keys = Object.keys(portalState.allEvaluationRules || {}).filter(k => {
    if (k === 'default' || k === 'ephemeral_learning_once') return false;
    if (!activeCat) return true;
    const r = portalState.allEvaluationRules[k] || {};
    const rTab = String(r.tabType || '').toLowerCase();
    return rTab === activeCat || k === activeCat || k.startsWith(`${activeCat}_`) || (activeCat === 'audio' && k.startsWith('exam_'));
  });
  if (keys.length === 0) {
    quickSelect.innerHTML = '<option value="" disabled selected>No evaluation rule is there for this tab</option>';
    return;
  }

  keys.forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    const rule = portalState.allEvaluationRules[key] || {};
    const tabBadge = (rule.tabType || key.split('_')[0] || 'exam').toUpperCase();
    const label = rule.examDisplayName ? `[${tabBadge}] ${rule.examDisplayName} (${key})` : `[${tabBadge}] Rule Key: ${key}`;
    opt.innerText = label;
    quickSelect.appendChild(opt);
  });

  try { portalHooks.emit('afterSavedRulesPopulated'); } catch (_hk) {}
}

export function loadSpecificSavedRule(ruleKey) {
  if (!ruleKey || !portalState.allEvaluationRules[ruleKey]) return;

  const customExamInput = document.getElementById('eval-custom-exam-name');
  if (customExamInput) customExamInput.value = '';

  const ruleObj = portalState.allEvaluationRules[ruleKey] || {};
  let cat = ruleObj.tabType || (ruleKey.includes('_') ? ruleKey.split('_')[0] : ruleKey);
  if (cat === 'exam') cat = 'audio';

  const catSelect = document.getElementById('eval-category-select');
  if (catSelect) {
    catSelect.value = cat;
    handleEvalCategoryChange();
    
    setTimeout(() => {
      const subtabSelect = document.getElementById('eval-subtab-select');
      if (subtabSelect) {
        let exists = Array.from(subtabSelect.options).some(o => o.value === ruleKey);
        if (!exists) {
          const opt = document.createElement('option');
          opt.value = ruleKey;
          opt.innerText = ruleObj.examDisplayName || ruleKey;
          subtabSelect.appendChild(opt);
        }
        subtabSelect.value = ruleKey;
      }
      loadSelectedEvaluationRulesIntoForm();
    }, 40);
  }
  loadSelectedEvaluationRulesIntoForm();
  showToast(`Loaded rule for: ${ruleKey} ready for editing.`);
}

export function handleEvalCategoryChange() {
  const catSelect = document.getElementById('eval-category-select');
  const subtabGroup = document.getElementById('group-eval-subtab');
  const subtabSelect = document.getElementById('eval-subtab-select');
  if (!catSelect || !subtabGroup || !subtabSelect) return;

  const cat = catSelect.value || 'audio';
  subtabGroup.style.display = 'block';
  subtabSelect.innerHTML = '';

  const isCbt = cat === 'cbttest';
  const cbtSec = document.getElementById('eval-cbt-specific-section');
  const stenoDedSec = document.getElementById('eval-steno-deduction-section');
  const stenoWcSec = document.getElementById('eval-steno-wordcount-section');
  const stenoSecSec = document.getElementById('eval-steno-security-section');
  const stenoDispSec = document.getElementById('eval-steno-display-section');
  const stenoGenExtra = document.getElementById('eval-steno-general-extra-row');
  const bsModeCol = document.getElementById('group-eval-backspace-mode-col');
  const passAccGrp = document.getElementById('group-eval-passing-accuracy');
  const customExamInput = document.getElementById('eval-custom-exam-name');
  const step1bLabel = document.getElementById('label-eval-step-1b');
  const step1bNote = document.getElementById('eval-step-1b-helper-note');

  if (cbtSec) cbtSec.style.display = isCbt ? 'block' : 'none';
  if (stenoDedSec) stenoDedSec.style.display = isCbt ? 'none' : 'block';
  if (stenoWcSec) stenoWcSec.style.display = isCbt ? 'none' : 'block';
  if (stenoSecSec) stenoSecSec.style.display = isCbt ? 'none' : 'block';
  if (stenoDispSec) stenoDispSec.style.display = isCbt ? 'none' : 'block';
  if (stenoGenExtra) stenoGenExtra.style.display = isCbt ? 'none' : 'flex';
  if (bsModeCol) bsModeCol.style.display = isCbt ? 'none' : 'block';
  if (passAccGrp) passAccGrp.style.display = isCbt ? 'none' : 'block';

  // 👉 Requirement #16: When CBT Exam Tab is selected, Step 1B shows ONLY CBT Subtab Names (CBT rule is fixed with Subtab); for other tabs, user can choose/create named rules
  if (customExamInput) {
    if (isCbt) {
      customExamInput.value = '';
      customExamInput.style.display = 'none';
    } else {
      customExamInput.style.display = 'block';
    }
  }
  if (step1bLabel) {
    step1bLabel.innerText = isCbt
      ? 'Step 1B. Select CBT Subtab Name (CBT Rule is Fixed with Subtab) *'
      : 'Step 1B. Select Existing Rule or Type New Exam Pattern Name *';
  }
  if (step1bNote) {
    step1bNote.innerText = isCbt
      ? 'In CBT Exam Tab, the Evaluation Rule is fixed directly to the selected CBT Subtab Name.'
      : 'Select a saved rule for this tab or type a new Exam Pattern Name to create a rule that users can choose.';
  }

  const seenRuleKeys = new Set();
  const addRuleOption = (val, label) => {
    if (!val || seenRuleKeys.has(val)) return;
    seenRuleKeys.add(val);
    const opt = document.createElement('option');
    opt.value = val;
    opt.innerText = label;
    subtabSelect.appendChild(opt);
  };

  const tabTitles = {
    audio: 'Audio Dictation Tab',
    pitman: 'Pitman Book Tab',
    typingtest: 'Typing Test Exam Tab',
    cbttest: 'CBT Exam Tab'
  };

  const allSubs = [
    ...(Array.isArray(portalState.subtabsData) ? portalState.subtabsData : []),
    ...((portalState.adminData && Array.isArray(portalState.adminData.subtabs)) ? portalState.adminData.subtabs : [])
  ];

  if (isCbt) {
    // For CBT: list CBT Subtabs first so CBT rules are strictly bound to CBT Subtab Names
    const cbtSubs = [];
    allSubs.forEach(s => {
      const pTab = String(s.ParentTab || s.parentTab || s.Type || s.type || '').toLowerCase().trim();
      const sName = String(s.SubtabName || s.subtabName || s.Name || s.name || '').trim();
      if (pTab === 'cbttest' && sName && !cbtSubs.includes(sName)) {
        cbtSubs.push(sName);
      }
    });
    (portalState.materialsData || []).forEach(m => {
      if (String(m.Type || m.type || '').toLowerCase() === 'cbttest') {
        const sName = String(m.Subtab || m.subtab || m.examCategory || '').trim();
        if (sName && sName !== '-' && !cbtSubs.includes(sName)) cbtSubs.push(sName);
      }
    });
    // Do not inject default CBT subtabs when none are created yet
    cbtSubs.forEach(sName => {
      const safeSub = sName.replace(/[^a-zA-Z0-9_]/g, '_');
      const subKey = `cbttest_${safeSub}`;
      const existingSubRule = portalState.allEvaluationRules && portalState.allEvaluationRules[subKey];
      addRuleOption(
        subKey,
        existingSubRule
          ? `📂 CBT Subtab: ${sName} (Rule Active)`
          : `📂 CBT Subtab: ${sName} (Configure Fixed Subtab Rule)`
      );
    });
    addRuleOption('cbttest', '🌟 Default CBT Master Subtab Rule (cbttest)');
  } else {
    // 1. Default base rule key for the selected Target Tab
    const baseExisting = portalState.allEvaluationRules && portalState.allEvaluationRules[cat];
    addRuleOption(
      cat,
      baseExisting && baseExisting.examDisplayName
        ? `🌟 ${baseExisting.examDisplayName} (${cat})`
        : `🌟 Default ${tabTitles[cat] || cat.toUpperCase()} Rule (${cat})`
    );

    // 2. Include all saved rules matching ONLY this Target Tab (Requirement #15)
    Object.keys(portalState.allEvaluationRules || {}).forEach(k => {
      if (k === 'default' || k === 'ephemeral_learning_once') return;
      const r = portalState.allEvaluationRules[k] || {};
      const rTab = String(r.tabType || '').toLowerCase();
      const matchesCat =
        rTab === cat.toLowerCase() ||
        k === cat ||
        k.startsWith(`${cat}_`) ||
        (cat === 'audio' && k.startsWith('exam_') && (!rTab || rTab === 'audio'));
      if (matchesCat) {
        const cleanName = r.examDisplayName || k.replace(/^(audio|pitman|typingtest|cbttest|exam)_/, '').replace(/_/g, ' ');
        addRuleOption(k, `⚙️ ${cleanName} (${k})`);
      }
    });

    // 3. Include configured Subtabs for this Target Tab
    allSubs.forEach(s => {
      const pTab = String(s.ParentTab || s.parentTab || s.Type || s.type || '').toLowerCase().trim();
      const sName = String(s.SubtabName || s.subtabName || s.Name || s.name || '').trim();
      if (pTab === cat.toLowerCase() && sName) {
        const safeSub = sName.replace(/[^a-zA-Z0-9_]/g, '_');
        const subKey = `${cat}_${safeSub}`;
        const existingSubRule = portalState.allEvaluationRules && portalState.allEvaluationRules[subKey];
        addRuleOption(
          subKey,
          existingSubRule
            ? `📂 Subtab Rule: ${sName} (Saved)`
            : `📂 Subtab: ${sName} (Configure Rule)`
        );
      }
    });
  }

  populateSavedRulesQuickDropdown();
  loadSelectedEvaluationRulesIntoForm();
}

export function getSelectedEvalKey() {
  const catSelect = document.getElementById('eval-category-select');
  const cat = (catSelect && catSelect.value) ? catSelect.value : 'audio';
  const customExam = document.getElementById('eval-custom-exam-name')?.value.trim();
  if (customExam) {
    const safeCustom = customExam.replace(/[^a-zA-Z0-9_]/g, '_');
    return `${cat}_${safeCustom}`;
  }
  const subtabSelect = document.getElementById('eval-subtab-select');
  return (subtabSelect && subtabSelect.value) ? subtabSelect.value : cat;
}

export const fallbackEvaluationRule = null;

export const defaultEvaluationRule = null;

export function syncUnifiedPassingAccuracyAndMarks() {
  const accEl = document.getElementById('eval-passing-accuracy');
  const marksEl = document.getElementById('eval-passing-marks');
  const totalEl = document.getElementById('eval-total-marks');
  if (!accEl || !marksEl) return;
  const acc = parseFloat(accEl.value);
  const total = totalEl ? (parseFloat(totalEl.value) || 100) : 100;
  if (!isNaN(acc)) {
    marksEl.value = String(Number(((acc / 100) * total).toFixed(2)));
  }
}

export function syncInitialWordsOrStrokesFieldUI() {
  const wcRule = document.getElementById('eval-word-count-rule')?.value || '1word';
  const is5Stroke = wcRule === '5stroke';
  const labelEl = document.getElementById('eval-initial-words-label');
  const badgeEl = document.getElementById('eval-initial-words-unit-badge');
  const modeEl = document.getElementById('eval-initial-words-mode');
  const numEl = document.getElementById('eval-initial-words');
  const helpEl = document.getElementById('eval-initial-words-help-note') || document.getElementById('eval-initial-words-helper');

  if (labelEl) {
    labelEl.innerText = is5Stroke
      ? 'q. Min Initial Strokes Shown to User (5 Strokes = 1 Word Mode)'
      : 'q. Min Initial Words Shown to User (1 Space = 1 Word Mode)';
  }
  if (badgeEl) {
    badgeEl.innerText = is5Stroke ? '⌨️ Counting in STROKES' : '📝 Counting in WORDS';
    badgeEl.style.background = is5Stroke ? 'rgba(16,185,129,0.14)' : 'rgba(79,70,229,0.12)';
    badgeEl.style.color = is5Stroke ? '#059669' : 'var(--primary)';
  }
  if (modeEl && modeEl.options.length >= 2) {
    modeEl.options[0].text = 'Show All / Complete Passage (Default)';
    modeEl.options[1].text = is5Stroke
      ? 'Show Custom Initial Strokes Count (Entered by Admin)'
      : 'Show Custom Initial Words Count (Entered by Admin)';
  }
  if (numEl) {
    numEl.placeholder = is5Stroke ? 'Strokes' : 'Words';
  }
  if (helpEl) {
    helpEl.innerText = is5Stroke
      ? '5 Strokes = 1 Word active: Enter the exact number of initial STROKES (characters) to show to the user.'
      : '1 Space = 1 Word active: Enter the exact number of initial space-separated WORDS to show to the user.';
  }
}

export function handleEvalInitialWordsModeChange() {
  syncInitialWordsOrStrokesFieldUI();
  const modeEl = document.getElementById('eval-initial-words-mode');
  const numEl = document.getElementById('eval-initial-words');
  const wrapEl = document.getElementById('eval-initial-words-input-wrap');
  const wcRule = document.getElementById('eval-word-count-rule')?.value || '1word';
  if (!modeEl || !numEl) return;
  if (modeEl.value === 'all') {
    numEl.value = '0';
    numEl.style.opacity = '0.6';
    if (wrapEl) wrapEl.style.display = 'none';
  } else {
    if (!parseInt(numEl.value, 10) || parseInt(numEl.value, 10) <= 0) {
      numEl.value = wcRule === '5stroke' ? '500' : '100';
    }
    numEl.style.opacity = '1';
    if (wrapEl) wrapEl.style.display = 'flex';
  }
}

export function toggleCbtSectionalTimerConfigUI() {
  const mode = document.getElementById('eval-cbt-timer-mode')?.value || 'full';
  const isSectional = mode === 'sectional';
  const defTimeGrp = document.getElementById('group-eval-cbt-default-sec-time');
  const lockGrp = document.getElementById('group-eval-cbt-sec-nav-mode') || document.getElementById('group-eval-cbt-sec-lock-mode');
  if (defTimeGrp) {
    defTimeGrp.style.display = isSectional ? 'block' : 'none';
    defTimeGrp.style.opacity = isSectional ? '1' : '0.65';
  }
  if (lockGrp) {
    lockGrp.style.display = isSectional ? 'block' : 'none';
    lockGrp.style.opacity = isSectional ? '1' : '0.65';
  }
  const secTimingOptEl = document.getElementById('eval-cbt-section-timing-option');
  if (secTimingOptEl) {
    secTimingOptEl.value = isSectional ? 'with_section_timing' : secTimingOptEl.value;
    toggleCbtPerSectionTimingField();
  }
}

export function toggleCbtPerSectionTimingField() {
  const opt = document.getElementById('eval-cbt-section-timing-option')?.value || 'no_section_timing';
  const timingWrap = document.getElementById('group-eval-cbt-per-section-timing');
  const timingInput = document.getElementById('eval-cbt-per-section-timing');
  const timerModeEl = document.getElementById('eval-cbt-timer-mode');
  if (opt === 'no_section_timing') {
    if (timingWrap) timingWrap.style.display = 'none';
    if (timingInput) timingInput.value = '0';
    if (timerModeEl && timerModeEl.value === 'sectional') {
      timerModeEl.value = 'full';
      const defTimeGrp = document.getElementById('group-eval-cbt-default-sec-time');
      const lockGrp = document.getElementById('group-eval-cbt-sec-nav-mode');
      if (defTimeGrp) defTimeGrp.style.display = 'none';
      if (lockGrp) lockGrp.style.display = 'none';
    }
  } else {
    if (timingWrap) timingWrap.style.display = 'block';
    if (timingInput && (!parseInt(timingInput.value, 10) || parseInt(timingInput.value, 10) <= 0)) {
      timingInput.value = '15';
    }
    if (timerModeEl) {
      timerModeEl.value = 'sectional';
      const defTimeGrp = document.getElementById('group-eval-cbt-default-sec-time');
      const lockGrp = document.getElementById('group-eval-cbt-sec-nav-mode');
      if (defTimeGrp) defTimeGrp.style.display = 'block';
      if (lockGrp) lockGrp.style.display = 'block';
    }
  }
}

export function getCbtSectionGroupsContainer() {
  return document.getElementById('eval-cbt-section-groups-container') || document.getElementById('eval-cbt-section-groups-list');
}

export function renderCbtSectionArrangementRows(groups = []) {
  const container = getCbtSectionGroupsContainer();
  if (!container) return;
  if (!Array.isArray(groups) || groups.length === 0) {
    container.innerHTML = `<div style="font-size: 11.5px; color: var(--text-muted); padding: 10px 12px; border: 1px dashed var(--border); border-radius: 8px; text-align: center;">No section rows added yet. Choose <strong>How Many Sections</strong>, <strong>After N Questions</strong> &amp; <strong>Section Timing Option (With or Without Section Timing)</strong> above and click <strong>"⚡ Generate Sections"</strong>, or click <strong>"+ Add Section / Merge 2 Sections"</strong>.</div>`;
    return;
  }
  const defaultQCount = parseInt(document.getElementById('eval-cbt-questions-per-section')?.value, 10) || 25;
  const timingOpt = document.getElementById('eval-cbt-section-timing-option')?.value || 'no_section_timing';
  const defaultTime = timingOpt === 'no_section_timing'
    ? 0
    : (parseInt(document.getElementById('eval-cbt-per-section-timing')?.value || document.getElementById('eval-cbt-default-sec-time')?.value, 10) || 15);
  container.innerHTML = groups.map((g, idx) => {
    const rowTimeVal = (g.timeMinutes !== undefined && g.timeMinutes !== null) ? Number(g.timeMinutes) : defaultTime;
    return `
    <div class="cbt-sec-group-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)) auto; gap: 8px; align-items: end; background: var(--background); padding: 9px 10px; border-radius: 8px; border: 1px solid var(--border);">
      <div>
        <label style="font-size: 10.5px; font-weight: 800; color: var(--secondary);">Section / Combined Title</label>
        <input type="text" class="form-control cbt-grp-display" value="${String(g.displayName || '').replace(/"/g, '&quot;')}" placeholder="e.g. Section ${idx + 1}" style="margin: 0; padding: 6px 8px; font-size: 12px;">
      </div>
      <div>
        <label style="font-size: 10.5px; font-weight: 700; color: var(--text-muted);">1st Section Name</label>
        <input type="text" class="form-control cbt-grp-sec1" value="${String(g.sec1 || '').replace(/"/g, '&quot;')}" placeholder="e.g. Reasoning" style="margin: 0; padding: 6px 8px; font-size: 12px;">
      </div>
      <div>
        <label style="font-size: 10.5px; font-weight: 800; color: #0284c7;">Combine 2nd Section (As 1)</label>
        <input type="text" class="form-control cbt-grp-sec2" value="${String(g.sec2 || '').replace(/"/g, '&quot;')}" placeholder="Optional 2nd Section to Merge" style="margin: 0; padding: 6px 8px; font-size: 12px;">
      </div>
      <div>
        <label style="font-size: 10.5px; font-weight: 800; color: #059669;">Questions in Section</label>
        <input type="number" class="form-control cbt-grp-qcount" value="${g.questionCount || defaultQCount}" min="1" max="500" style="margin: 0; padding: 6px 8px; font-size: 12px;">
      </div>
      <div>
        <label style="font-size: 10.5px; font-weight: 800; color: #7c3aed;">Section Timing (0 = No Timer)</label>
        <input type="number" class="form-control cbt-grp-time" value="${rowTimeVal}" min="0" max="180" placeholder="0 = Full Exam Timer" style="margin: 0; padding: 6px 8px; font-size: 12px;">
      </div>
      <button type="button" class="btn btn-sm btn-danger" style="padding: 6px 10px; min-height: 32px;" onclick="this.closest('.cbt-sec-group-row').remove();" title="Remove Section Row">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `}).join('');
}

export function collectCbtSectionArrangementRows() {
  const container = getCbtSectionGroupsContainer();
  if (!container) return [];
  const rows = container.querySelectorAll('.cbt-sec-group-row');
  const list = [];
  const defaultQCount = parseInt(document.getElementById('eval-cbt-questions-per-section')?.value, 10) || 25;
  const timingOpt = document.getElementById('eval-cbt-section-timing-option')?.value || 'no_section_timing';
  rows.forEach((r, idx) => {
    const sec1 = r.querySelector('.cbt-grp-sec1')?.value.trim() || '';
    const sec2 = r.querySelector('.cbt-grp-sec2')?.value.trim() || '';
    const disp = r.querySelector('.cbt-grp-display')?.value.trim() || (sec1 && sec2 ? `${sec1} + ${sec2}` : (sec1 || sec2 || `Section ${idx + 1}`));
    const questionCount = parseInt(r.querySelector('.cbt-grp-qcount')?.value, 10) || defaultQCount;
    const rawTimeVal = parseInt(r.querySelector('.cbt-grp-time')?.value, 10);
    const timeMinutes = timingOpt === 'no_section_timing' ? 0 : (isNaN(rawTimeVal) ? 0 : Math.max(0, rawTimeVal));
    if (sec1 || sec2 || disp) {
      list.push({ displayName: disp, sec1: sec1 || disp, sec2, questionCount, timeMinutes, noSectionTiming: timeMinutes === 0 });
    }
  });
  return list;
}

export function addCbtSectionArrangementRow(defaultObj = null) {
  const current = collectCbtSectionArrangementRows();
  const nextIdx = current.length + 1;
  const qPerSec = parseInt(document.getElementById('eval-cbt-questions-per-section')?.value, 10) || 25;
  const timingOpt = document.getElementById('eval-cbt-section-timing-option')?.value || 'no_section_timing';
  const secTime = timingOpt === 'no_section_timing'
    ? 0
    : (parseInt(document.getElementById('eval-cbt-per-section-timing')?.value || document.getElementById('eval-cbt-default-sec-time')?.value, 10) || 15);
  current.push(defaultObj || {
    displayName: `Section ${nextIdx}`,
    sec1: `Section ${nextIdx}`,
    sec2: '',
    questionCount: qPerSec,
    timeMinutes: secTime
  });
  renderCbtSectionArrangementRows(current);
}

export function autoGenerateCbtSectionsByQuestionCount() {
  const numSections = Math.max(1, Math.min(20, parseInt(document.getElementById('eval-cbt-num-sections')?.value, 10) || 4));
  const qPerSection = Math.max(1, parseInt(document.getElementById('eval-cbt-questions-per-section')?.value, 10) || 25);
  const timingOpt = document.getElementById('eval-cbt-section-timing-option')?.value || 'no_section_timing';
  const secTiming = timingOpt === 'no_section_timing'
    ? 0
    : Math.max(1, parseInt(document.getElementById('eval-cbt-per-section-timing')?.value, 10) || 15);
  const generated = [];
  for (let i = 0; i < numSections; i++) {
    const startQ = i * qPerSection + 1;
    const endQ = (i + 1) * qPerSection;
    generated.push({
      displayName: `Section ${i + 1} (Q${startQ}–Q${endQ})`,
      sec1: `Section ${i + 1}`,
      sec2: '',
      questionCount: qPerSection,
      timeMinutes: secTiming,
      noSectionTiming: secTiming === 0
    });
  }
  const defSecTimeEl = document.getElementById('eval-cbt-default-sec-time');
  if (defSecTimeEl && secTiming > 0) defSecTimeEl.value = String(secTiming);
  renderCbtSectionArrangementRows(generated);
  if (secTiming === 0) {
    showToast(`✅ Generated ${numSections} sections (${qPerSection} questions per section • No Individual Section Timer — Uses Full Exam Timer)!`);
  } else {
    showToast(`✅ Generated ${numSections} sections (${qPerSection} questions per section • ${secTiming} mins per section)!`);
  }
}

export function autoPopulateCbtSectionsFromUploadedTests() {
  const cbtItems = (portalState.materialsData || []).filter(m => isMaterialTypeMatch(m.Type || m.type, 'cbttest'));
  const secCounts = {};
  cbtItems.forEach(item => {
    try {
      const qs = JSON.parse(item.ContentOrUrl || '[]');
      if (Array.isArray(qs)) {
        qs.forEach(q => {
          if (q && q.section) {
            const sName = String(q.section).trim();
            secCounts[sName] = (secCounts[sName] || 0) + 1;
          }
        });
      }
    } catch (e) {}
  });
  const secs = Object.keys(secCounts);
  const timingOpt = document.getElementById('eval-cbt-section-timing-option')?.value || 'no_section_timing';
  const defTime = timingOpt === 'no_section_timing'
    ? 0
    : (parseInt(document.getElementById('eval-cbt-per-section-timing')?.value || document.getElementById('eval-cbt-default-sec-time')?.value, 10) || 15);
  const defQCount = parseInt(document.getElementById('eval-cbt-questions-per-section')?.value, 10) || 25;
  if (secs.length === 0) {
    renderCbtSectionArrangementRows([]);
    showToast('ℹ️ No uploaded CBT exam sections found yet. Upload a CBT exam first or add section rows manually.');
    return;
  }
  const rows = secs.map(s => ({ displayName: s, sec1: s, sec2: '', questionCount: secCounts[s] || defQCount, timeMinutes: defTime }));
  renderCbtSectionArrangementRows(rows);
  showToast(`Auto-detected ${rows.length} section(s) from uploaded CBT Exams! You can merge any two sections by typing the 2nd section name.`);
}

export function getEvaluationRulesForTab(subtabKey) {
  if (!subtabKey) return null;
  
  if (portalState.allEvaluationRules && portalState.allEvaluationRules[subtabKey]) {
    return portalState.allEvaluationRules[subtabKey];
  }
  
  const baseCat = String(subtabKey).split('_')[0];
  if (portalState.allEvaluationRules && portalState.allEvaluationRules[baseCat]) {
    return portalState.allEvaluationRules[baseCat];
  }
  
  return null;
}

export function loadSelectedEvaluationRulesIntoForm() {
  const key = getSelectedEvalKey();
  if (!key) return;

  const existingRule = getEvaluationRulesForTab(key);
  const allNumericRuleIds = [
    'eval-time-limit', 'eval-total-marks', 'eval-passing-accuracy', 'eval-passing-marks',
    'eval-min-gross-stroke-pct', 'eval-min-time', 'eval-reading-time-mins',
    'eval-backspace-limit', 'eval-default-text-size', 'eval-initial-words',
    'eval-ignore-error-pct', 'eval-penalty-value',
    'eval-deduct-wrong', 'eval-deduct-omission', 'eval-deduct-extra-word',
    'eval-deduct-verb-form', 'eval-deduct-singular-plural', 'eval-deduct-punctuation',
    'eval-deduct-capital', 'eval-deduct-para-not-changed',
    'eval-cbt-correct-marks', 'eval-cbt-wrong-marks', 'eval-cbt-unattempted-marks',
    'eval-cbt-passing-marks', 'eval-cbt-default-sec-time', 'eval-cbt-num-sections',
    'eval-cbt-questions-per-section', 'eval-cbt-per-section-timing'
  ];
  if (!existingRule) {
    allNumericRuleIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    renderCbtSectionArrangementRows([]);
    return;
  }
  const rules = existingRule;

  const setVal = (id, val, fallback = '') => {
    const elem = document.getElementById(id);
    if (elem) {
      elem.value = (val !== undefined && val !== null && val !== '') ? val : fallback;
    }
  };

  setVal('eval-time-limit', rules.timeLimit, '');
  setVal('eval-backspace-mode', rules.backspaceMode, 'on');
  setVal('eval-backspace-limit', rules.backspaceLimit, '');
  const bsLimitGroup = document.getElementById('group-eval-backspace-limit');
  if (bsLimitGroup) {
    bsLimitGroup.style.display = (rules.backspaceMode === 'limited') ? 'block' : 'none';
  }
  const unifiedPassing = rules.passingAccuracy !== undefined ? rules.passingAccuracy : (rules.passingMarks !== undefined ? rules.passingMarks : '');
  setVal('eval-total-marks', rules.totalMarks, '');
  setVal('eval-passing-accuracy', unifiedPassing, '');
  setVal('eval-passing-marks', rules.cbtPassingMarks !== undefined ? rules.cbtPassingMarks : unifiedPassing, '');
  syncUnifiedPassingAccuracyAndMarks();
  setVal('eval-min-gross-stroke-pct', rules.minGrossStrokePct, '');
  setVal('eval-ignore-paragraph-change', rules.ignoreParagraphChange, 'yes');
  setVal('eval-repeat-passage', rules.repeatPassage, 'yes');
  setVal('eval-default-text-size', rules.defaultTextSize, '');
  setVal('eval-deduct-punctuation', rules.deductPunctuation, '');
  setVal('eval-punct-rule-mode', rules.punctRuleMode, 'fullstop_only');
  setVal('eval-deduct-capital', rules.deductCapital, '');
  setVal('eval-deduct-omission', rules.deductOmission, '');
  setVal('eval-deduct-wrong', rules.deductWrong, '');
  setVal('eval-deduct-extra-word', rules.deductExtraWord, '');
  setVal('eval-deduct-para-not-changed', rules.deductParaNotChanged, '');
  setVal('eval-deduct-verb-form', rules.deductVerbForm, '');
  setVal('eval-deduct-singular-plural', rules.deductSingularPlural, '');
  setVal('eval-copypaste-mode', rules.copyPasteMode, 'yes');
  setVal('eval-func-keys-mode', rules.funcKeysMode, 'yes');
  setVal('eval-word-count-rule', rules.wordCountRule, '1word');
  setVal('eval-autoscroll-mode', rules.autoScrollMode, 'on');
  setVal('eval-autoscroll-behavior', rules.autoScrollBehavior || 'line', 'line');
  if (typeof window.toggleAutoScrollBehaviorField === 'function') window.toggleAutoScrollBehaviorField();
  setVal('eval-highlight-mode', rules.highlightMode, 'on');
  setVal('eval-layout-position', rules.layoutPosition, 'top');
  const initWordsVal = Number(rules.initialWords || 0);
  const initWordsMode = rules.initialWordsMode || (initWordsVal > 0 ? 'custom' : 'all');
  setVal('eval-initial-words-mode', initWordsMode, 'all');
  setVal('eval-initial-words', initWordsMode === 'all' ? '' : initWordsVal, '');
  syncInitialWordsOrStrokesFieldUI();
  setVal('eval-min-time', rules.minTimeSeconds, '');
  setVal('eval-reading-time-mins', rules.readingTimeMinutes, '');
  setVal('eval-ignore-error-pct', rules.ignoreErrorPct, '');
  setVal('eval-penalty-value', rules.penaltyValue, '');

  // CBT Exam Specific Fields (No hardcoded default fallback numbers)
  setVal('eval-cbt-correct-marks', rules.cbtCorrectMarks, '');
  setVal('eval-cbt-wrong-marks', rules.cbtWrongMarks, '');
  setVal('eval-cbt-unattempted-marks', rules.cbtUnattemptedMarks, '');
  setVal('eval-cbt-passing-marks', rules.cbtPassingMarks !== undefined ? rules.cbtPassingMarks : (rules.passingMarks !== undefined ? rules.passingMarks : ''), '');
  setVal('eval-cbt-timer-mode', rules.cbtTimerMode, 'full');
  setVal('eval-cbt-default-sec-time', rules.cbtDefaultSectionTime, '');
  setVal('eval-cbt-section-lock-mode', rules.cbtSectionLockMode, 'locked');
  setVal('eval-cbt-num-sections', rules.cbtNumSections, '');
  setVal('eval-cbt-questions-per-section', rules.cbtQuestionsPerSection, '');
  const secTimingOptVal = rules.cbtSectionTimingOption || ((Number(rules.cbtPerSectionTiming) > 0 && rules.cbtTimerMode === 'sectional') ? 'with_section_timing' : 'no_section_timing');
  setVal('eval-cbt-section-timing-option', secTimingOptVal, 'no_section_timing');
  setVal('eval-cbt-per-section-timing', secTimingOptVal === 'no_section_timing' ? '' : (rules.cbtPerSectionTiming !== undefined ? rules.cbtPerSectionTiming : rules.cbtDefaultSectionTime), '');
  toggleCbtSectionalTimerConfigUI();
  toggleCbtPerSectionTimingField();
  renderCbtSectionArrangementRows(Array.isArray(rules.cbtSectionGroups) ? rules.cbtSectionGroups : []);
}

export async function saveEvaluationRulesSettings() {
  let key = getSelectedEvalKey();
  if (!key) {
    showToast('Please select a Target Tab and Exam Name.');
    return;
  }

  const selectedTabType = document.getElementById('eval-category-select')?.value || 'audio';
  const customExamInput = document.getElementById('eval-custom-exam-name');
  const customDisplayName = customExamInput?.value.trim() || '';

  if (key.includes('_')) {
    const parts = key.split('_');
    const cat = parts[0];
    const sub = parts.slice(1).join('_').replace(/[^a-zA-Z0-9_]/g, '_');
    key = `${cat}_${sub}`;
  }

  const getOptionalNumVal = (id) => {
    const raw = document.getElementById(id)?.value;
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const n = Number(raw);
    return isNaN(n) ? null : n;
  };
  const getNumVal = (id, zeroFallback = 0) => {
    const n = getOptionalNumVal(id);
    return n !== null ? n : zeroFallback;
  };

  syncUnifiedPassingAccuracyAndMarks();
  const isCbtRule = selectedTabType === 'cbttest';
  const timeLimitRaw = getOptionalNumVal('eval-time-limit');
  const totalMarksRaw = getOptionalNumVal('eval-total-marks');
  const cbtSecTimingOpt = document.getElementById('eval-cbt-section-timing-option')?.value || 'no_section_timing';

  if (timeLimitRaw === null || timeLimitRaw <= 0) {
    showToast('Please enter a valid Exam Time Limit (Minutes) before saving this rule.');
    document.getElementById('eval-time-limit')?.focus();
    return;
  }
  if (totalMarksRaw === null || totalMarksRaw <= 0) {
    showToast('Please enter valid Total Marks before saving this rule.');
    document.getElementById('eval-total-marks')?.focus();
    return;
  }

  if (isCbtRule) {
    const cbtCorrectRaw = getOptionalNumVal('eval-cbt-correct-marks');
    const cbtWrongRaw = getOptionalNumVal('eval-cbt-wrong-marks');
    const cbtPassRaw = getOptionalNumVal('eval-cbt-passing-marks');
    if (cbtCorrectRaw === null || cbtCorrectRaw <= 0) {
      showToast('Please enter Marks for Correct Answer (+) for this CBT evaluation rule.');
      document.getElementById('eval-cbt-correct-marks')?.focus();
      return;
    }
    if (cbtWrongRaw === null || cbtWrongRaw < 0) {
      showToast('Please enter Marks Deducted for Wrong Answer (0 or higher) for this CBT rule.');
      document.getElementById('eval-cbt-wrong-marks')?.focus();
      return;
    }
    if (cbtPassRaw === null || cbtPassRaw < 0) {
      showToast('Please enter CBT Passing Marks before saving this CBT evaluation rule.');
      document.getElementById('eval-cbt-passing-marks')?.focus();
      return;
    }
    if (cbtSecTimingOpt === 'with_section_timing') {
      const perSecTimeRaw = getOptionalNumVal('eval-cbt-per-section-timing') ?? getOptionalNumVal('eval-cbt-default-sec-time');
      if (perSecTimeRaw === null || perSecTimeRaw <= 0) {
        showToast('Please enter Timing per Section (Minutes) when Sectional Timing is enabled.');
        document.getElementById('eval-cbt-per-section-timing')?.focus();
        return;
      }
    }
  } else {
    const passAccRaw = getOptionalNumVal('eval-passing-accuracy');
    if (passAccRaw === null || passAccRaw <= 0) {
      showToast('Please enter Passing Accuracy (%) before saving this evaluation rule.');
      document.getElementById('eval-passing-accuracy')?.focus();
      return;
    }
  }

  const totalMarksVal = totalMarksRaw;
  const cbtPassingMarksVal = getNumVal('eval-cbt-passing-marks', 0);
  const passingAccVal = isCbtRule
    ? Number(((cbtPassingMarksVal / Math.max(1, totalMarksVal)) * 100).toFixed(2))
    : getNumVal('eval-passing-accuracy', 0);
  const unifiedPassingMarks = isCbtRule
    ? cbtPassingMarksVal
    : Number(((passingAccVal / 100) * totalMarksVal).toFixed(2));
  const initialWordsModeVal = document.getElementById('eval-initial-words-mode')?.value || 'all';
  const rawInitialWords = getNumVal('eval-initial-words', 0);
  const effectiveInitialWords = initialWordsModeVal === 'all' ? 0 : Math.max(0, rawInitialWords);
  const cbtSectionGroups = collectCbtSectionArrangementRows();

  const ruleData = {
    tabType: selectedTabType,
    examDisplayName: customDisplayName || portalState.allEvaluationRules[key]?.examDisplayName || key.replace(/^(exam|audio|pitman|typingtest|cbttest)_/, '').replace(/_/g, ' '),
    timeLimit: timeLimitRaw,
    backspaceMode: document.getElementById('eval-backspace-mode')?.value || 'on',
    backspaceLimit: getNumVal('eval-backspace-limit', 0),
    totalMarks: totalMarksVal,
    passingMarks: unifiedPassingMarks,
    passingAccuracy: passingAccVal,
    minGrossStrokePct: getNumVal('eval-min-gross-stroke-pct', 0),
    ignoreParagraphChange: document.getElementById('eval-ignore-paragraph-change')?.value || 'yes',
    repeatPassage: document.getElementById('eval-repeat-passage')?.value || 'yes',
    defaultTextSize: getNumVal('eval-default-text-size', 15),
    deductPunctuation: getNumVal('eval-deduct-punctuation', 0),
    punctRuleMode: document.getElementById('eval-punct-rule-mode')?.value || 'fullstop_only',
    deductCapital: getNumVal('eval-deduct-capital', 0),
    deductWrong: getNumVal('eval-deduct-wrong', 0),
    deductOmission: getNumVal('eval-deduct-omission', 0),
    deductExtraWord: getNumVal('eval-deduct-extra-word', 0),
    deductParaNotChanged: getNumVal('eval-deduct-para-not-changed', 0),
    deductVerbForm: getNumVal('eval-deduct-verb-form', 0),
    deductSingularPlural: getNumVal('eval-deduct-singular-plural', 0),
    copyPasteMode: document.getElementById('eval-copypaste-mode')?.value || 'yes',
    funcKeysMode: document.getElementById('eval-func-keys-mode')?.value || 'yes',
    wordCountRule: document.getElementById('eval-word-count-rule')?.value || '1word',
    autoScrollMode: document.getElementById('eval-autoscroll-mode')?.value || 'on',
    autoScrollBehavior: document.getElementById('eval-autoscroll-behavior')?.value || 'line',
    highlightMode: document.getElementById('eval-highlight-mode')?.value || 'on',
    layoutPosition: document.getElementById('eval-layout-position')?.value || 'top',
    initialWordsMode: initialWordsModeVal,
    initialWords: effectiveInitialWords,
    minTimeSeconds: getNumVal('eval-min-time', 0),
    readingTimeMinutes: getNumVal('eval-reading-time-mins', 0),
    ignoreErrorPct: getNumVal('eval-ignore-error-pct', 0),
    penaltyValue: getNumVal('eval-penalty-value', 0),
    cbtCorrectMarks: getNumVal('eval-cbt-correct-marks', 0),
    cbtWrongMarks: getNumVal('eval-cbt-wrong-marks', 0),
    cbtUnattemptedMarks: getNumVal('eval-cbt-unattempted-marks', 0),
    cbtPassingMarks: cbtPassingMarksVal,
    cbtTimerMode: cbtSecTimingOpt === 'no_section_timing' ? 'full' : (document.getElementById('eval-cbt-timer-mode')?.value || 'full'),
    cbtDefaultSectionTime: cbtSecTimingOpt === 'no_section_timing' ? 0 : getNumVal('eval-cbt-default-sec-time', 0),
    cbtSectionLockMode: document.getElementById('eval-cbt-section-lock-mode') ? document.getElementById('eval-cbt-section-lock-mode').value : 'locked',
    cbtNumSections: getNumVal('eval-cbt-num-sections', 0),
    cbtQuestionsPerSection: getNumVal('eval-cbt-questions-per-section', 0),
    cbtSectionTimingOption: cbtSecTimingOpt,
    cbtPerSectionTiming: cbtSecTimingOpt === 'no_section_timing' ? 0 : getNumVal('eval-cbt-per-section-timing', 0),
    cbtSectionGroups: cbtSectionGroups
  };

  portalState.allEvaluationRules[key] = ruleData;
  localStorage.setItem('steno_all_eval_rules', JSON.stringify(portalState.allEvaluationRules));
  if (customExamInput) customExamInput.value = '';
  
  handleEvalCategoryChange();
  if (typeof populateSavedRulesQuickDropdown === 'function') {
    populateSavedRulesQuickDropdown();
  }
  if (typeof renderAdminEvaluationRulesTable === 'function') {
    renderAdminEvaluationRulesTable();
  }
  if (typeof populateLiveTestMaterialOptions === 'function') {
    populateLiveTestMaterialOptions();
  }
  if (typeof populateUploadCbtEvalRulesDropdown === 'function') {
    populateUploadCbtEvalRulesDropdown();
  }

  const res = await apiCall('saveEvaluationRules', {
    ruleKey: key,
    ruleJson: JSON.stringify(ruleData)
  });

  if (res.success) {
    showToast(`Saved "${ruleData.examDisplayName}" under ${selectedTabType.toUpperCase()} tab rules!`);
  } else {
    showToast(`Saved "${ruleData.examDisplayName}" under ${selectedTabType.toUpperCase()} tab rules locally!`);
  }
}

export function deleteSelectedEvaluationRules() {
  const key = getSelectedEvalKey();
  if (!key) return;
  deleteEvaluationRuleByKey(key);
}

export async function handleUploadEvaluationRuleJsonFile(event) {
  const fileInput = event && event.target ? event.target : document.getElementById('eval-rule-json-upload-input');
  const file = fileInput && fileInput.files && fileInput.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') {
      showToast('⚠️ Invalid JSON file: Expected an Evaluation Rule object.');
      fileInput.value = '';
      return;
    }
    const selectedTabType = document.getElementById('eval-category-select')?.value || 'audio';
    const customNameInput = document.getElementById('eval-custom-exam-name');
    const customTypedName = customNameInput ? customNameInput.value.trim() : '';

    // Case A: Uploaded JSON is asingle rule object (contains timeLimit, totalMarks, cbtCorrectMarks, etc.)
    const isSingleRule =
      parsed.timeLimit !== undefined ||
      parsed.totalMarks !== undefined ||
      parsed.deductWrong !== undefined ||
      parsed.cbtCorrectMarks !== undefined ||
      parsed.examDisplayName !== undefined ||
      parsed.tabType !== undefined;

    const importedKeys = [];
    if (isSingleRule) {
      const cat = String(parsed.tabType || selectedTabType || 'audio').toLowerCase();
      const baseName = customTypedName || parsed.examDisplayName || file.name.replace(/\.json$/i, '').trim() || 'Uploaded_Rule';
      const safeSlug = baseName.replace(/[^a-zA-Z0-9_]/g, '_');
      const ruleKey = parsed.ruleKey || `${cat}_${safeSlug}`;
      const normalizedRule = {
        ...parsed,
        tabType: cat,
        examDisplayName: baseName
      };
      portalState.allEvaluationRules[ruleKey] = normalizedRule;
      importedKeys.push({ key: ruleKey, data: normalizedRule });
    } else {
      // Case B: Uploaded JSON is a map of multiple rules { "audio_SSC_Steno": { ... }, ... }
      Object.keys(parsed).forEach(k => {
        if (!parsed[k] || typeof parsed[k] !== 'object') return;
        const ruleObj = parsed[k];
        const cat = String(ruleObj.tabType || k.split('_')[0] || selectedTabType || 'audio').toLowerCase();
        const normalizedRule = {
          ...ruleObj,
          tabType: ['audio', 'pitman', 'typingtest', 'cbttest'].includes(cat) ? cat : selectedTabType,
          examDisplayName: ruleObj.examDisplayName || k.replace(/^(audio|pitman|typingtest|cbttest|exam)_/, '').replace(/_/g, ' ')
        };
        portalState.allEvaluationRules[k] = normalizedRule;
        importedKeys.push({ key: k, data: normalizedRule });
      });
    }

    if (importedKeys.length === 0) {
      showToast('⚠️ No valid evaluation rules found in the uploaded JSON file.');
      fileInput.value = '';
      return;
    }

    localStorage.setItem('steno_all_eval_rules', JSON.stringify(portalState.allEvaluationRules));
    if (customNameInput) customNameInput.value = '';

    // Load the first imported rule into the form immediately
    const firstImported = importedKeys[0];
    const catSelect = document.getElementById('eval-category-select');
    if (catSelect && firstImported.data.tabType) {
      catSelect.value = firstImported.data.tabType;
    }
    handleEvalCategoryChange();
    const subSelect = document.getElementById('eval-subtab-select');
    if (subSelect) {
      subSelect.value = firstImported.key;
    }
    loadSelectedEvaluationRulesIntoForm();
    if (typeof populateSavedRulesQuickDropdown === 'function') populateSavedRulesQuickDropdown();
    if (typeof renderAdminEvaluationRulesTable === 'function') renderAdminEvaluationRulesTable();
    if (typeof populateLiveTestMaterialOptions === 'function') populateLiveTestMaterialOptions();
    if (typeof populateUploadCbtEvalRulesDropdown === 'function') populateUploadCbtEvalRulesDropdown();

    // Sync each imported rule to backend
    for (const item of importedKeys) {
      await apiCall('saveEvaluationRules', {
        ruleKey: item.key,
        ruleJson: JSON.stringify(item.data)
      }, true);
    }

    showToast(`✅ Uploaded & saved ${importedKeys.length} Evaluation Rule(s) (${firstImported.data.examDisplayName})!`);
  } catch (err) {
    showToast('❌ Failed to parse Evaluation Rule JSON file: ' + (err.message || 'Invalid JSON'));
  } finally {
    if (fileInput) fileInput.value = '';
  }
}

export function exportCurrentEvaluationRuleJson() {
  const key = getSelectedEvalKey() || 'audio';
  const rule = (portalState.allEvaluationRules && portalState.allEvaluationRules[key]) ? portalState.allEvaluationRules[key] : {
    tabType: document.getElementById('eval-category-select')?.value || 'audio',
    examDisplayName: document.getElementById('eval-custom-exam-name')?.value.trim() || key
  };
  const payload = { [key]: rule };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const objUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objUrl;
  link.download = `Evaluation_Rule_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch (e) {} }, 2500);
  showToast(`📥 Exported Evaluation Rule "${rule.examDisplayName || key}" as JSON.`);
}

window._rpServerPaginationState = {
    page: 1,
    pageSize: 100,
    daysWindow: 90,
    logsCursor: 0,
    historyCursor: 0,
    logsNextCursor: null,
    historyNextCursor: null,
    startDate: '',
    endDate: ''
  };

window._rpUserHistoryCursorState = {
    nextCursor: null,
    hasMore: false,
    startDate: '',
    endDate: ''
  };

window.loadUserHistoryServerPage = async function (resetCursor = true) {
    if (typeof portalState.currentUser === 'undefined' || !portalState.currentUser || !portalState.currentUser.userId || typeof apiCall !== 'function') return;
    const startInput = document.getElementById('history-start-date');
    const endInput = document.getElementById('history-end-date');
    const startDate = startInput ? String(startInput.value || '').trim() : '';
    const endDate = endInput ? String(endInput.value || '').trim() : '';

    if (resetCursor) {
      window._rpUserHistoryCursorState = { nextCursor: null, hasMore: false, startDate, endDate };
    }
    const cursorVal = resetCursor ? 0 : (window._rpUserHistoryCursorState.nextCursor || 0);
    const res = await apiCall('getUserHistory', {
      userId: portalState.currentUser.userId,
      cursor: cursorVal,
      limit: 100,
      startDate,
      endDate
    }, true);

    if (res && res.success && Array.isArray(res.historyList)) {
      if (resetCursor) {
        portalState.allTestHistoryList = res.historyList;
      } else {
        const seenIds = new Set(portalState.allTestHistoryList.map(h => String(h.TestID || h.testId || '')));
        res.historyList.forEach(item => {
          const tid = String(item.TestID || item.testId || '');
          if (!tid || !seenIds.has(tid)) portalState.allTestHistoryList.push(item);
        });
      }
      if (typeof portalState.globalData !== 'undefined' && portalState.globalData) portalState.globalData.history = portalState.allTestHistoryList;
      window._rpUserHistoryCursorState.nextCursor = res.nextCursor;
      window._rpUserHistoryCursorState.hasMore = Boolean(res.hasMore);
      const moreBtn = document.getElementById('btn-user-history-load-more');
      if (moreBtn) moreBtn.style.display = res.hasMore ? 'inline-flex' : 'none';
      if (typeof renderTestHistoryTable === 'function') renderTestHistoryTable();
      safeNotify(`Loaded ${res.historyList.length} history record${res.historyList.length === 1 ? '' : 's'} from Google Sheets.`);
    }
  };

window.loadPaginatedAdminSheetWindow = async function (pageDelta = 0) {
    const st = window._rpServerPaginationState;
    const winSel = document.getElementById('rp-admin-server-days-window');
    const startEl = document.getElementById('rp-admin-server-start-date');
    const endEl = document.getElementById('rp-admin-server-end-date');
    if (winSel) st.daysWindow = Number(winSel.value) || 0;
    st.startDate = startEl ? String(startEl.value || '').trim() : '';
    st.endDate = endEl ? String(endEl.value || '').trim() : '';

    if (pageDelta === 0) {
      st.page = 1;
      st.logsCursor = 0;
      st.historyCursor = 0;
    } else if (pageDelta > 0) {
      st.page += 1;
      st.logsCursor = st.logsNextCursor !== null ? Number(st.logsNextCursor) : (st.page - 1) * st.pageSize;
      st.historyCursor = st.historyNextCursor !== null ? Number(st.historyNextCursor) : (st.page - 1) * st.pageSize;
    } else {
      st.page = Math.max(1, st.page - 1);
      st.logsCursor = Math.max(0, (st.page - 1) * st.pageSize);
      st.historyCursor = Math.max(0, (st.page - 1) * st.pageSize);
    }

    let computedStart = st.startDate;
    if (!computedStart && st.daysWindow > 0) {
      const d = new Date(Date.now() - st.daysWindow * 86400000);
      computedStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    if (typeof apiCall !== 'function') return;
    safeNotify(`Loading Page ${st.page} (${computedStart ? 'From ' + computedStart : 'All Dates'})...`);
    try {
      const res = await apiCall('getAdminData', {
        logsCursor: st.logsCursor,
        historyCursor: st.historyCursor,
        logsLimit: st.pageSize,
        historyLimit: st.pageSize,
        startDate: computedStart,
        endDate: st.endDate
      }, true);
      if (res && res.success && typeof portalState.adminData !== 'undefined') {
        if (Array.isArray(res.logs)) portalState.adminData.logs = res.logs;
        if (Array.isArray(res.results)) portalState.adminData.results = res.results;
        if (Array.isArray(res.history)) portalState.adminData.history = res.history;
        st.logsNextCursor = res.logsNextCursor !== undefined ? res.logsNextCursor : null;
        st.historyNextCursor = res.historyNextCursor !== undefined ? res.historyNextCursor : null;
        if (typeof renderAdminLogs === 'function') renderAdminLogs();
        if (typeof window.renderAdminHistory === 'function') window.renderAdminHistory();
        else if (typeof window.renderAdminLeaderboard === 'function') window.renderAdminLeaderboard();
        const lbl = document.getElementById('rp-admin-server-page-label');
        if (lbl) lbl.textContent = `Page ${st.page} · ${res.logs ? res.logs.length : 0}/${res.totalLogsCount || 0} logs`;
      }
    } catch (e) {}
  };

export function mountServerPaginationToolbar() {
    const logsTab = document.getElementById('admin-sub-logs');
    if (!logsTab || document.getElementById('rp-admin-server-pagination-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'rp-admin-server-pagination-bar';
    bar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 14px; margin-bottom: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; font-size: 12px;';
    bar.innerHTML = `
      <div style="font-weight: 700; color: var(--secondary);">
        <i class="fa-solid fa-database" style="color: var(--primary);"></i> Server-Side Cursor &amp; Date-Range Pagination
      </div>
      <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
        <select id="rp-admin-server-days-window" class="form-control" style="width: auto; min-height: 30px; font-size: 11.5px; margin: 0;" onchange="window.loadPaginatedAdminSheetWindow(0)">
          <option value="30">Last 30 Days</option>
          <option value="90" selected>Last 90 Days</option>
          <option value="365">Last 1 Year</option>
          <option value="0">All Dates</option>
        </select>
        <input type="date" id="rp-admin-server-start-date" class="form-control" title="Custom Start Date" style="width: 132px; min-height: 30px; font-size: 11px; margin: 0; padding: 3px 6px;" onchange="window.loadPaginatedAdminSheetWindow(0)">
        <input type="date" id="rp-admin-server-end-date" class="form-control" title="Custom End Date" style="width: 132px; min-height: 30px; font-size: 11px; margin: 0; padding: 3px 6px;" onchange="window.loadPaginatedAdminSheetWindow(0)">
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.loadPaginatedAdminSheetWindow(-1)">Prev Page</button>
        <span id="rp-admin-server-page-label" style="font-weight: 800; color: var(--primary); font-variant-numeric: tabular-nums;">Page 1 · 90d window</span>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.loadPaginatedAdminSheetWindow(1)">Next Page</button>
      </div>
    `;
    logsTab.insertBefore(bar, logsTab.firstChild);
  }

window.refreshActivityLogsArchivalStatus = async function () {
    const badge = document.getElementById('admin-archival-trigger-badge');
    const details = document.getElementById('admin-archival-status-details');
    if (typeof apiCall !== 'function') return;
    if (details) details.textContent = 'Checking Apps Script trigger & archive status...';
    const res = await apiCall('getActivityArchivalStatus', {}, true);
    if (res && res.success) {
      if (badge) {
        badge.textContent = res.triggerInstalled ? '✅ Monthly Trigger Active (1st @ 3 AM)' : '⏸️ Trigger Not Scheduled';
        badge.style.color = res.triggerInstalled ? '#059669' : '#d97706';
      }
      if (details) {
        details.textContent = `Active ACTIVITY_LOGS rows: ${res.activeLogCount || 0} · Last archived: ${res.lastArchivedCount || 0} rows${res.lastRunAt ? ' on ' + String(res.lastRunAt).slice(0, 16).replace('T', ' ') : ' (never run yet)'}.`;
      }
    } else if (details) {
      details.textContent = (res && res.message) || 'Deploy the updated Code.gs to enable automated 90-day archival status.';
    }
  };

window.setupMonthlyActivityLogsArchivalTrigger = async function () {
    if (typeof apiCall !== 'function') return;
    safeNotify('Configuring monthly Apps Script archival trigger (1st of every month at 3:00 AM)...');
    const res = await apiCall('setupMonthlyActivityArchivalTrigger', { enabled: true });
    safeNotify((res && res.message) || 'Monthly archival trigger updated.');
    window.refreshActivityLogsArchivalStatus();
  };

window.runActivityLogsArchivalNow = async function () {
    if (typeof apiCall !== 'function') return;
    safeNotify('Archiving ACTIVITY_LOGS older than 90 days into Archive Spreadsheet...');
    const res = await apiCall('archiveOldActivityLogs', { retentionDays: 90 });
    safeNotify((res && res.message) || 'Archival job completed.');
    window.refreshActivityLogsArchivalStatus();
  };

window.rpAudioCacheManager = (function () {
    const CACHE_NAME = 'rp-skill-dictation-audio-v1';
    const blobUrlMap = new Map();
    const inFlightMap = new Map();

    function isCacheableHttpAudio(url) {
      const s = String(url || '').trim();
      if (!/^https?:\/\//i.test(s)) return false;
      if (/youtube\.com|youtu\.be/i.test(s)) return false;
      return true;
    }

    async function prebufferUrl(url) {
      if (!isCacheableHttpAudio(url)) return null;
      if (blobUrlMap.has(url)) return blobUrlMap.get(url);
      if (inFlightMap.has(url)) return inFlightMap.get(url);

      const job = (async () => {
        try {
          let cachedResp = null;
          if (typeof caches !== 'undefined' && caches && typeof caches.open === 'function') {
            const cache = await caches.open(CACHE_NAME);
            cachedResp = await cache.match(url);
            if (!cachedResp) {
              const fetched = await fetch(url, { mode: 'cors' });
              if (fetched && fetched.ok) {
                await cache.put(url, fetched.clone());
                cachedResp = fetched;
              }
            }
          } else {
            const fetched = await fetch(url, { mode: 'cors' });
            if (fetched && fetched.ok) cachedResp = fetched;
          }
          if (cachedResp) {
            const blob = await cachedResp.blob();
            if (blob && blob.size > 0) {
              const objUrl = URL.createObjectURL(blob);
              blobUrlMap.set(url, objUrl);
              return objUrl;
            }
          }
        } catch (e) {
          // Cross-origin audio without CORS headers still plays via native <audio> buffering; silently degrade
          try {
            const probe = document.createElement('audio');
            probe.preload = 'auto';
            probe.src = url;
          } catch (innerErr) {}
        } finally {
          inFlightMap.delete(url);
        }
        return null;
      })();

      inFlightMap.set(url, job);
      return job;
    }

    function findNextAudioUrl(currentItem, trackQueue, trackIndex) {
      if (Array.isArray(trackQueue) && trackIndex + 1 < trackQueue.length) {
        const nextTrack = trackQueue[trackIndex + 1];
        if (nextTrack && nextTrack.url) {
          return typeof classifyAndConvertVoiceMediaUrl === 'function'
            ? (classifyAndConvertVoiceMediaUrl(nextTrack.url).streamUrl || nextTrack.url)
            : nextTrack.url;
        }
      }
      if (currentItem && Array.isArray(portalState.materialsData)) {
        const audioList = portalState.materialsData.filter(m => String(m.Type || m.type || '').toLowerCase().includes('audio'));
        const curIdx = audioList.findIndex(m => String(m.ID || m.id) === String(currentItem.ID || currentItem.id));
        if (curIdx >= 0 && curIdx + 1 < audioList.length) {
          const nextItem = audioList[curIdx + 1];
          const rawNext = String(nextItem.VoiceUrl || nextItem.AudioUrl || nextItem.ContentOrUrl || '').trim();
          if (rawNext) {
            return typeof classifyAndConvertVoiceMediaUrl === 'function'
              ? (classifyAndConvertVoiceMediaUrl(rawNext).streamUrl || rawNext)
              : rawNext;
          }
        }
      }
      return '';
    }

    return {
      CACHE_NAME,
      getCachedBlobUrl: (url) => blobUrlMap.get(url) || null,
      prebufferUrl,
      prepareAndPrebuffer: async function (item, activeStreamUrl, trackQueue, trackIndex) {
        const statusEl = document.getElementById('stenoshala-audio-verify-status');
        if (activeStreamUrl && isCacheableHttpAudio(activeStreamUrl)) {
          const cached = await prebufferUrl(activeStreamUrl);
          if (cached && statusEl) {
            statusEl.textContent = 'Offline-Ready Cached Audio';
          }
        }
        const nextUrl = findNextAudioUrl(item, trackQueue, trackIndex);
        if (nextUrl && isCacheableHttpAudio(nextUrl)) {
          prebufferUrl(nextUrl).then((ok) => {
            if (ok && statusEl && !statusEl.textContent.includes('Next Pre-Buffered')) {
              statusEl.textContent += ' · Next Pre-Buffered';
            }
          });
        }
      }
    };
  })();

window.syncExtendedCloudStateToSheets = function () {
    const cu = typeof portalState.currentUser !== 'undefined' ? portalState.currentUser : null;
    if (!cu || !cu.userId || typeof apiCall !== 'function') return;
    try {
      const payload = {
        userId: cu.userId,
        pinnedRules: window.getPinnedEvaluationRules(),
        weakOutlinesVault: JSON.parse(localStorage.getItem('rp_skill_weak_outlines_vault_v1') || '[]'),
        savedMcqs: JSON.parse(localStorage.getItem('rp_skill_cbt_saved_mcqs_v1') || '[]'),
        weeklyStudyPlanner: JSON.parse(localStorage.getItem('rp_skill_weekly_study_planner_v1') || '{}'),
        customPrefs: JSON.parse(localStorage.getItem('steno_user_custom_prefs') || '{}'),
        theme: localStorage.getItem('steno_theme') || 'light'
      };
      apiCall('syncUserCloudState', payload, true);
    } catch (e) {}
  };

window.renderStaticStreamDoneFooter = function (anchorId, count, labelSingular, onStreamRefresh) {
    const footer = getOrCreateStreamFooterEl(anchorId, anchorId);
    if (!footer) return;
    const n = Number(count) || 0;
    if (n <= 0 && typeof onStreamRefresh !== 'function') {
      footer.style.display = 'none';
      footer.innerHTML = '';
      return;
    }
    if (n <= 0) {
      // Keep empty state clean without showing alarming "No more data (0 loaded)" banners
      footer.style.display = 'none';
      footer.innerHTML = '';
      return;
    }
    const unit = n === 1 ? (labelSingular || 'record') : ((labelSingular || 'record') + 's');
    footer.style.display = 'flex';
    footer.className = 'rp-stream-status-footer is-done';
    footer.innerHTML = `
      <span class="rp-stream-status-text"><i class="fa-solid fa-circle-check" style="color:var(--success);"></i> <span class="mono-num">${n} ${escapeHtml(unit)} loaded</span></span>
      ${typeof onStreamRefresh === 'function' ? `<button type="button" class="btn btn-secondary btn-sm rp-stream-retry-btn" style="padding:3px 9px; font-size:11px; min-height:26px;"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>` : ''}
    `;
    if (typeof onStreamRefresh === 'function') {
      const btn = footer.querySelector('.rp-stream-retry-btn');
      if (btn) btn.onclick = () => onStreamRefresh();
    }
  };

window.streamCollectionOneByOne = async function (opts) {
    const {
      streamKey,
      collection,
      extraParams = {},
      anchorId = '',
      labelSingular = 'item',
      fallbackAction = '',
      fallbackParams = {},
      extractFallbackItems = null,
      onMeta = null,
      onBatch = null,
      onRecord = null,
      onDone = null
    } = opts || {};

    const key = String(streamKey || collection || 'default');
    const token = (_activeStreamTokens[key] || 0) + 1;
    _activeStreamTokens[key] = token;

    const footer = anchorId ? getOrCreateStreamFooterEl(anchorId, key) : null;
    const setFooterLoading = (nextIndex, loadedCount, totalHint) => {
      if (!footer || _activeStreamTokens[key] !== token) return;
      footer.style.display = 'flex';
      footer.className = 'rp-stream-status-footer is-loading';
      const totalPart = (typeof totalHint === 'number' && totalHint > 0) ? ` of ${totalHint}` : '';
      footer.innerHTML = `
        <span class="rp-stream-status-text">
          <span class="mini-spin" style="display:inline-block; vertical-align:middle; margin-right:6px;"></span>
          Loading ${escapeHtml(labelSingular)} <strong class="mono-num">${nextIndex}${totalPart}</strong>...
          ${loadedCount > 0 ? `<span style="opacity:0.75; margin-left:6px;">(${loadedCount} shown)</span>` : ''}
        </span>
      `;
    };
    const setFooterDone = (loadedCount) => {
      if (!footer || _activeStreamTokens[key] !== token) return;
      const n = Number(loadedCount) || 0;
      if (n <= 0) {
        // Container itself displays a clean empty state — never show duplicate "No more data (0 loaded)" banners
        footer.style.display = 'none';
        footer.innerHTML = '';
        return;
      }
      footer.style.display = 'flex';
      footer.className = 'rp-stream-status-footer is-done';
      const unit = n === 1 ? labelSingular : (labelSingular + 's');
      footer.innerHTML = `
        <span class="rp-stream-status-text">
          <i class="fa-solid fa-circle-check" style="color:var(--success);"></i>
          <span class="mono-num">${n} ${escapeHtml(unit)} loaded</span>
        </span>
      `;
    };
    const setFooterError = (msg, resumeOffset) => {
      if (!footer || _activeStreamTokens[key] !== token) return;
      footer.style.display = 'flex';
      footer.className = 'rp-stream-status-footer is-error';
      footer.innerHTML = `
        <span class="rp-stream-status-text" style="color:var(--danger);">
          <i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(msg || 'Could not load next record.')}
        </span>
        <button type="button" class="btn btn-primary btn-sm rp-stream-retry-btn" style="padding:3px 10px; font-size:11px; min-height:26px;">
          <i class="fa-solid fa-rotate-right"></i> Retry from #${resumeOffset + 1}
        </button>
      `;
      const btn = footer.querySelector('.rp-stream-retry-btn');
      if (btn) btn.onclick = () => runLoop(resumeOffset);
    };

    let loadedCount = 0;
    let totalHint = 0;
    const maxSafetySteps = 600;
    const chunkSize = 40;

    async function deliverChunk(batchItems, startIdx) {
      if (!batchItems || batchItems.length === 0) return;
      if (_activeStreamTokens[key] !== token) return;
      loadedCount += batchItems.length;
      if (typeof onBatch === 'function') {
        onBatch(batchItems, loadedCount, totalHint);
      } else if (typeof onRecord === 'function') {
        for (let b = 0; b < batchItems.length; b++) {
          if (_activeStreamTokens[key] !== token) return;
          onRecord(batchItems[b], startIdx + b, totalHint);
        }
      }
      setFooterLoading(Math.min(totalHint || loadedCount, loadedCount), loadedCount, totalHint);
      await yieldToMainFrame();
    }

    async function runFallbackDrip() {
      if (!fallbackAction || typeof apiCall !== 'function') {
        setFooterDone(loadedCount);
        if (typeof onDone === 'function') onDone(loadedCount);
        return;
      }
      setFooterLoading(loadedCount + 1, loadedCount, 0);
      const fbRes = await apiCall(fallbackAction, fallbackParams, true, 1, 700);
      if (_activeStreamTokens[key] !== token) return;
      if (!fbRes || !fbRes.success) {
        setFooterError((fbRes && fbRes.message) || 'Network error while loading data.', loadedCount);
        return;
      }
      if (typeof onMeta === 'function') onMeta(fbRes);
      const items = typeof extractFallbackItems === 'function' ? (extractFallbackItems(fbRes) || []) : [];
      totalHint = items.length;
      for (let i = 0; i < items.length; i += chunkSize) {
        if (_activeStreamTokens[key] !== token) return;
        const slice = items.slice(i, i + chunkSize);
        await deliverChunk(slice, i);
      }
      if (_activeStreamTokens[key] !== token) return;
      setFooterDone(loadedCount);
      if (typeof onDone === 'function') onDone(loadedCount);
    }

    async function runLoop(startOffset) {
      let offset = startOffset;
      let steps = 0;
      while (steps < maxSafetySteps) {
        if (_activeStreamTokens[key] !== token) return;
        setFooterLoading(offset + 1, loadedCount, totalHint);
        const res = await apiCall('getStreamRecord', {
          collection,
          offset,
          batchSize: chunkSize,
          ...extraParams
        }, true, 1, 500);
        if (_activeStreamTokens[key] !== token) return;

        if (!res || !res.success) {
          const msg = String((res && res.message) || '');
          if (offset === 0 && fallbackAction && /invalid server action|unknown action|not found/i.test(msg)) {
            await runFallbackDrip();
            return;
          }
          setFooterError(msg || 'Connection interrupted while loading.', offset);
          return;
        }

        if (offset === 0 && typeof onMeta === 'function') onMeta(res);
        if (typeof res.total === 'number') totalHint = res.total;
        else if (typeof res.totalCount === 'number') totalHint = res.totalCount;

        // Support both chunked items[] and legacy single record/item responses
        const batchItems = Array.isArray(res.items)
          ? res.items
          : (res.record ? [res.record] : (res.item ? [res.item] : []));

        if (batchItems.length > 0) {
          await deliverChunk(batchItems, offset);
          if (_activeStreamTokens[key] !== token) return;
        }

        if (!res.hasMore || batchItems.length === 0) {
          setFooterDone(loadedCount);
          if (typeof onDone === 'function') onDone(loadedCount);
          return;
        }
        offset = typeof res.nextOffset === 'number' ? res.nextOffset : (offset + batchItems.length);
        steps++;
      }
      setFooterDone(loadedCount);
      if (typeof onDone === 'function') onDone(loadedCount);
    }

    await runLoop(0);
  };
