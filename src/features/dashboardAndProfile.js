// @ts-nocheck
/**
 * RP Skill Portal — Dashboard Command Deck, Carousels, Profile Hub & Help Center
 * Clean Vite ES module (zero layered monkey-patch conflicts).
 */

import { portalState } from '../core/state.ts';
import { portalHooks } from '../core/hooks.ts';
import { onDomReady, scheduleFrameTasks } from '../core/domReady.ts';
import { ALL_STUDENT_PORTAL_TABS, TAB_DISPLAY_META, applyStudentPortalTabPermissions, closeAllDeviceNavMenu, ensureHelpDeskFeedbackFormVisible, getMaintenanceConfig, getUserCustomPreferences, getWorkingTabsUnderMaintenance, isUserEmailAlreadyVerified, markUserEmailVerified, markUserMobileVerified, navigateTo, openAllDeviceNavMenu, renderAuthView, renderNotificationCenterUI, sortMaterialsLatestFirst, startUserEngagementSessionTracker, switchAuthTab, syncUnverifiedEmailPortalLockUI, syncVerifiedBadgesAcrossPortal, toggleNotificationCenterDrawer, updateActiveTabHeaderBadge } from './authAndNavigation.js';
import { applyAdminTabPermissions, getBatchMonitorsList, getBatchMonitorsMap, getInstituteBatchesList, getUserAssignedBatch, getUserAssignedBatchesList, getUserMonitorBatchesList, isUserMonitorForBatch, parseBatchListValue, populateAllBatchSelectDropdowns, renderAdminBatchDiscussionBoard, renderAdminFeedback, renderAdminLeaderboard, renderAdminLogs, renderAdminMaterialsTable, renderAdminSubtabsTable, renderAdminUsers, renderDashboardBatchMonitoringHub, userHasBatchAssigned } from './adminPanel.js';
import { DEFAULT_LOGO_URL, SITE_NAME, apiCall, applyAppTheme, cleanupAllAuthAndSessionResources, clearAllPortalCacheOnLogout, fetchPublicFooterStats, logPortalAction, mergeMaterialsByType, normalizeMaterialRecord, renderGlobalWatermark, showToast, syncPortalDataInBackground } from './apiAndCore.js';
import { escapeHtml, formatLocalDate, getLocalDateString } from '../utils/formatting.ts';
import { initLearningTypingTutor, renderLearningUploadedExercisesGrid, renderVideoCourseView, seedRichDemoDataIfNeeded } from './videoAndTutor.js';
import { renderAdminEvaluationRulesTable, renderLiveTestsEverywhere } from './mediaAndDictation.js';
import { buildAlphabetBar, filterTypingWizardPassagesDropdown, getUniversalUrl, initTypingTestWizard, onTypingDateSelected, populateWordsCategoryDropdown, renderMaterialsList, renderPitmanList, renderTestHistoryTable, renderWords } from './typingAndEvaluation.js';
import { renderCbtTestCatalog } from './cbtArena.js';

const populateAdminValidityTargetDropdown = (...args) => (typeof window.populateAdminValidityTargetDropdown === 'function' ? window.populateAdminValidityTargetDropdown(...args) : undefined);
const switchDashboardFocusTab = (...args) => (typeof window.switchDashboardFocusTab === 'function' ? window.switchDashboardFocusTab(...args) : undefined);

export function setupAuthenticatedUI() {
      document.body.classList.add('rp-authenticated');
      document.body.classList.remove('rp-unauthenticated');

      const authTabsList = document.getElementById('menu-authenticated-tabs-list');
      if (authTabsList) authTabsList.style.setProperty('display', 'flex', 'important');

      const menuBtn = document.getElementById('all-device-menu-btn');
      if (menuBtn) {
        menuBtn.style.removeProperty('display');
        menuBtn.style.setProperty('display', 'inline-flex', 'important');
      }
      const activeBadge = document.getElementById('active-tab-header-badge');
      if (activeBadge) {
        activeBadge.style.removeProperty('display');
        activeBadge.style.display = 'inline-flex';
      }
      const dmBtn = document.getElementById('header-dark-mode-toggle-btn');
      if (dmBtn) {
        dmBtn.style.removeProperty('display');
        dmBtn.style.display = 'inline-flex';
      }
      const bellBtn = document.getElementById('header-notification-bell-btn');
      if (bellBtn) {
        bellBtn.style.removeProperty('display');
        bellBtn.style.display = 'inline-flex';
      }
      updateActiveTabHeaderBadge(portalState.activeTab || 'dashboard');

      const hdrControls = document.getElementById('header-user-controls');
      if (hdrControls) {
        hdrControls.style.removeProperty('display');
        hdrControls.style.display = 'flex';
      }

      portalState.isLaptopMenuUserHidden = false;
      if (window.innerWidth >= 1024) {
        openAllDeviceNavMenu();
      } else {
        closeAllDeviceNavMenu(true);
      }
      
      const userName = portalState.currentUser.name || 'Learner';
      document.getElementById('header-user-name').innerText = userName;
      const roleStr = String(portalState.currentUser.role || 'user').toLowerCase();
      document.getElementById('header-user-role').innerText = roleStr === 'superadmin' ? 'SUPERADMIN' : roleStr.toUpperCase();

      if (document.getElementById('dash-user-name')) {
        document.getElementById('dash-user-name').innerText = userName;
      }
      if (document.getElementById('dash-current-date')) {
        document.getElementById('dash-current-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }

      const isAdminOrSuper = (roleStr === 'admin' || roleStr === 'superadmin');
      const adminDivider = document.getElementById('admin-nav-category-divider');
      if (adminDivider) adminDivider.style.display = isAdminOrSuper ? 'flex' : 'none';
      document.getElementById('admin-nav-item').style.display = isAdminOrSuper ? 'flex' : 'none';
      const analyticsNav = document.getElementById('analytics-nav-item');
      if (analyticsNav) analyticsNav.style.display = isAdminOrSuper ? 'flex' : 'none';
      const logoutBtn = document.getElementById('menu-logout-btn');
      if (logoutBtn) logoutBtn.style.display = 'inline-flex';
      if (isAdminOrSuper && typeof applyAdminTabPermissions === 'function') {
        applyAdminTabPermissions();
      }
      if (typeof applyStudentPortalTabPermissions === 'function') {
        applyStudentPortalTabPermissions();
      }

      const prefs = getUserCustomPreferences();

      const profNameEl = document.getElementById('prof-name');
      const profEmailEl = document.getElementById('prof-email');
      const profMobileEl = document.getElementById('prof-mobile');
      if (profNameEl) profNameEl.value = portalState.currentUser.name || '';
      if (profEmailEl) profEmailEl.value = portalState.currentUser.email || '';
      if (profMobileEl) profMobileEl.value = portalState.currentUser.mobile || '';
      const mfaPinIn = document.getElementById('prof-mfa-pin');
      if (mfaPinIn) mfaPinIn.value = prefs.mfaPin || '';
      if (typeof syncProfileTabUI === 'function') {
        syncProfileTabUI();
      } else if (typeof syncProfileParentDetailsInputs === 'function') {
        syncProfileParentDetailsInputs();
      }

      syncVerifiedBadgesAcrossPortal(isUserEmailAlreadyVerified(portalState.currentUser));
      renderGlobalWatermark();
      renderPromoBanner();
      renderNotificationCenterUI();
      startUserEngagementSessionTracker();
    
  try { portalHooks.emit('afterAuthenticatedSetup'); } catch (_hk) {}
}

export function resolveUserParentDetails(userObj) {
      const u = userObj || portalState.currentUser || {};
      const prefs = (u.preferences && typeof u.preferences === 'object') ? u.preferences : (getUserCustomPreferences() || {});
      const fallbackName = String(u.name || u.Name || '').trim();
      const fallbackMobile = String(u.mobile || u.Mobile || '').replace(/\D/g, '').slice(-10);
      const fallbackEmail = String(u.email || u.Email || '').trim().toLowerCase();
      const rawParentName = String(u.parentName || u.ParentName || prefs.parentName || '').trim();
      const rawParentMobile = String(u.parentMobile || u.ParentMobile || prefs.parentMobile || '').replace(/\D/g, '').slice(-10);
      const rawParentEmail = String(u.parentEmail || u.ParentEmail || prefs.parentEmail || '').trim().toLowerCase();
      const explicitlySame = prefs.parentIsDifferent === false;
      const differsFromStudent = !explicitlySame && Boolean(
        (rawParentName && rawParentName.toLowerCase() !== fallbackName.toLowerCase()) ||
        (rawParentMobile && rawParentMobile !== fallbackMobile) ||
        (rawParentEmail && rawParentEmail !== fallbackEmail)
      );
      const hasCustomParent = Boolean(prefs.parentIsDifferent === true || differsFromStudent);
      return {
        parentName: hasCustomParent ? (rawParentName || fallbackName) : fallbackName,
        parentMobile: hasCustomParent ? (rawParentMobile || fallbackMobile) : fallbackMobile,
        parentEmail: hasCustomParent ? (rawParentEmail || fallbackEmail) : fallbackEmail,
        isFallback: !hasCustomParent,
        isDifferent: hasCustomParent
      };
    }

export function applyParentInputsLockState(isDifferent) {
      const pn = document.getElementById('prof-parent-name');
      const pm = document.getElementById('prof-parent-mobile');
      const pe = document.getElementById('prof-parent-email');
      const badge = document.getElementById('prof-parent-fallback-badge');
      [pn, pm, pe].forEach((inp) => {
        if (!inp) return;
        inp.readOnly = !isDifferent;
        inp.style.opacity = isDifferent ? '1' : '0.78';
        inp.style.background = isDifferent ? '' : 'var(--background)';
        inp.style.cursor = isDifferent ? '' : 'not-allowed';
      });
      if (badge) {
        badge.textContent = isDifferent ? 'Different Parent Details' : 'Same as Student Details';
        badge.style.color = isDifferent ? '#059669' : '#0284c7';
      }
    }

export function toggleParentDetailsDifferentMode(isDifferent) {
      const u = portalState.currentUser || {};
      const chk = document.getElementById('prof-parent-different-chk');
      const pn = document.getElementById('prof-parent-name');
      const pm = document.getElementById('prof-parent-mobile');
      const pe = document.getElementById('prof-parent-email');
      const diffFlag = Boolean(isDifferent);
      if (chk) chk.checked = diffFlag;

      const stuName = String(document.getElementById('prof-name')?.value || u.name || u.Name || '').trim();
      const stuMobile = String(document.getElementById('prof-mobile')?.value || u.mobile || u.Mobile || '').replace(/\D/g, '').slice(-10);
      const stuEmail = String(document.getElementById('prof-email')?.value || u.email || u.Email || '').trim().toLowerCase();

      applyParentInputsLockState(diffFlag);
      if (!diffFlag) {
        // Mirror student details immediately
        if (pn) pn.value = stuName;
        if (pm) pm.value = stuMobile;
        if (pe) pe.value = stuEmail;
      } else {
        // Clear mirrored student values so user can enter distinct parent details cleanly
        if (pn && pn.value.trim().toLowerCase() === stuName.toLowerCase()) pn.value = '';
        if (pm && pm.value.replace(/\D/g, '').slice(-10) === stuMobile) pm.value = '';
        if (pe && pe.value.trim().toLowerCase() === stuEmail) pe.value = '';
        if (pn) pn.focus();
      }
    }
window.toggleParentDetailsDifferentMode = toggleParentDetailsDifferentMode;

export function syncProfileParentDetailsInputs() {
      if (!portalState.currentUser) return;
      const resolved = resolveUserParentDetails(portalState.currentUser);
      const chk = document.getElementById('prof-parent-different-chk');
      const pn = document.getElementById('prof-parent-name');
      const pm = document.getElementById('prof-parent-mobile');
      const pe = document.getElementById('prof-parent-email');
      if (chk) chk.checked = Boolean(resolved.isDifferent);
      if (pn) pn.value = resolved.parentName || '';
      if (pm) pm.value = resolved.parentMobile || '';
      if (pe) pe.value = resolved.parentEmail || '';
      applyParentInputsLockState(Boolean(resolved.isDifferent));
    }

export async function saveParentDetailsFromProfile() {
      if (!portalState.currentUser) return;
      const chk = document.getElementById('prof-parent-different-chk');
      const isDifferent = Boolean(chk && chk.checked);
      const stuName = String(portalState.currentUser.name || portalState.currentUser.Name || '').trim();
      const stuMobile = String(portalState.currentUser.mobile || portalState.currentUser.Mobile || '').replace(/\D/g, '').slice(-10);
      const stuEmail = String(portalState.currentUser.email || portalState.currentUser.Email || '').trim().toLowerCase();

      const pn = isDifferent ? String(document.getElementById('prof-parent-name')?.value || '').trim() : '';
      const pm = isDifferent ? String(document.getElementById('prof-parent-mobile')?.value || '').replace(/\D/g, '').slice(-10) : '';
      const pe = isDifferent ? String(document.getElementById('prof-parent-email')?.value || '').trim().toLowerCase() : '';

      if (isDifferent) {
        if (!pn && !pm && !pe) {
          showToast('⚠️ Please enter Parent / Guardian details or uncheck the "different" box to use your own details.');
          return;
        }
        if (pm && pm.length !== 10) {
          showToast('⚠️ Parent Mobile Number must be 10 digits.');
          return;
        }
        if (pe && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pe)) {
          showToast('⚠️ Please enter a valid Parent Email ID.');
          return;
        }
      }
      const res = await apiCall('saveParentDetails', {
        userId: portalState.currentUser.userId,
        parentName: pn,
        parentMobile: pm,
        parentEmail: pe
      });
      if (res && res.success) {
        const effName = isDifferent ? (res.parentName || pn || stuName) : stuName;
        const effMobile = isDifferent ? (res.parentMobile || pm || stuMobile) : stuMobile;
        const effEmail = isDifferent ? (res.parentEmail || pe || stuEmail) : stuEmail;
        portalState.currentUser.parentName = isDifferent ? effName : '';
        portalState.currentUser.parentMobile = isDifferent ? effMobile : '';
        portalState.currentUser.parentEmail = isDifferent ? effEmail : '';
        portalState.currentUser.parentIsFallback = !isDifferent;
        portalState.currentUser.preferences = {
          ...(portalState.currentUser.preferences || {}),
          parentIsDifferent: isDifferent,
          parentName: pn,
          parentMobile: pm,
          parentEmail: pe
        };
        try {
          localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser));
          localStorage.setItem('steno_user_custom_prefs', JSON.stringify(portalState.currentUser.preferences));
          localStorage.setItem('rp_parent_weekly_summary_prefs_v1', JSON.stringify({
            guardianName: effName,
            whatsapp: effMobile,
            email: effEmail,
            optIn: true
          }));
        } catch (e) {}
        syncProfileParentDetailsInputs();
        showToast(isDifferent ? (res.message || '✅ Separate Parent / Guardian details saved!') : '✅ Parent / Guardian details set to mirror your own details.');
      } else {
        showToast((res && res.message) || '⚠️ Could not save Parent details.');
      }
    }

export function syncProfileTabUI() {
      if (!portalState.currentUser) return;
      const uName = String(portalState.currentUser.name || 'Learner').trim();
      const initials = uName.split(/\s+/).map(s => s[0] || '').join('').slice(0, 2).toUpperCase() || 'RP';
      const roleStr = String(portalState.currentUser.role || 'user').toUpperCase();
      const batchesList = typeof getUserAssignedBatchesList === 'function'
        ? getUserAssignedBatchesList(portalState.currentUser.userId, portalState.currentUser.batch || portalState.currentUser.Batch || '')
        : ['RP-Trail'];

      const avatarEl = document.getElementById('profile-page-avatar');
      const dispNameEl = document.getElementById('profile-page-display-name');
      const roleEl = document.getElementById('profile-page-role-text');
      const uidEl = document.getElementById('profile-page-uid-text');
      const batchEl = document.getElementById('profile-page-batches-text');
      const valEl = document.getElementById('profile-page-validity-text');

      if (avatarEl) avatarEl.textContent = initials;
      if (dispNameEl) dispNameEl.textContent = uName;
      if (roleEl) roleEl.textContent = portalState.currentUser.isMemberAllAccess ? `${roleStr} · ALL-ACCESS PASS` : roleStr;
      if (uidEl) uidEl.textContent = portalState.currentUser.userId || '-';
      if (batchEl) batchEl.textContent = batchesList.join(', ');
      if (valEl) {
        if (portalState.currentUser.isMemberAllAccess && portalState.currentUser.membershipValidUntil) {
          valEl.textContent = `Member All-Access till ${portalState.currentUser.membershipValidUntil}`;
        } else if (portalState.currentUser.enrollmentValidUntil) {
          valEl.textContent = `Batch valid till ${portalState.currentUser.enrollmentValidUntil}`;
        } else {
          valEl.textContent = 'RP-Trail Free Access Active';
        }
      }

      const nameInput = document.getElementById('prof-name');
      const emailInput = document.getElementById('prof-email');
      const mobileInput = document.getElementById('prof-mobile');
      if (nameInput && !document.getElementById('profile-update-otp-box')?.style.display?.includes('block')) {
        nameInput.value = portalState.currentUser.name || '';
      }
      if (emailInput && !document.getElementById('profile-update-otp-box')?.style.display?.includes('block')) {
        emailInput.value = portalState.currentUser.email || '';
      }
      if (mobileInput && !document.getElementById('profile-update-otp-box')?.style.display?.includes('block')) {
        mobileInput.value = portalState.currentUser.mobile || '';
      }
      syncProfileParentDetailsInputs();
    }

window.switchProfileSubtab = function(tabKey, btnEl) {
      const normalized = tabKey === 'fees' ? 'enrolled' : tabKey;
      const target = (normalized === 'enrolled' || normalized === 'buy-plans' || normalized === 'history') ? normalized : 'details';
      const panes = {
        details: document.getElementById('profile-subtab-details'),
        enrolled: document.getElementById('profile-subtab-enrolled'),
        'buy-plans': document.getElementById('profile-subtab-buy-plans'),
        history: document.getElementById('profile-subtab-history')
      };
      Object.entries(panes).forEach(([key, el]) => {
        if (!el) return;
        const isActive = key === target;
        el.style.display = isActive ? 'block' : 'none';
        if (isActive) {
          el.classList.remove('rp-prof-pane');
          void el.offsetWidth;
          el.classList.add('rp-prof-pane');
        }
      });
      document.querySelectorAll('#profile-subtab-bar .rp-prof-tab-btn').forEach(btn => {
        const isMatch = btnEl ? btn === btnEl : btn.getAttribute('data-profile-subtab') === target;
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      });
      if (target === 'enrolled' && typeof window.renderProfileFeesSection === 'function') {
        window.renderProfileFeesSection(false);
      } else if (target === 'buy-plans' && typeof window.renderBuyPlansCatalog === 'function') {
        window.renderBuyPlansCatalog('buy-plans-catalog-mount', false);
      } else if (target === 'history' && typeof window.renderFeePaymentHistorySubtab === 'function') {
        window.renderFeePaymentHistorySubtab('buy-plans-history-mount', true);
      }
    };

export function toggleProfileCard() {
      // Dedicated full-page Profile Tab (replaces legacy popup everywhere)
      cancelProfileUpdateOtpStep();
      navigateTo('profile', true, true);
      if (typeof window.switchProfileSubtab === 'function') {
        window.switchProfileSubtab('details');
      }
    }

window.openProfileFeesSection = function() {
      navigateTo('profile', true, true);
      if (typeof window.switchProfileSubtab === 'function') {
        window.switchProfileSubtab('enrolled');
      }
      setTimeout(() => {
        document.getElementById('profile-fees-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    };

export let _pendingProfileUpdatePayload = null;

export function cancelProfileUpdateOtpStep() {
      _pendingProfileUpdatePayload = null;
      const otpBox = document.getElementById('profile-update-otp-box');
      const otpIn = document.getElementById('prof-update-otp-input');
      const waOtpIn = document.getElementById('prof-update-wa-otp-input');
      const waFreeBox = document.getElementById('prof-update-wa-free-box') || document.getElementById('profile-update-wa-box');
      const saveBtn = document.getElementById('btn-prof-save-changes');
      if (otpBox) otpBox.style.display = 'none';
      if (otpIn) otpIn.value = '';
      if (waOtpIn) waOtpIn.value = '';
      if (waFreeBox) waFreeBox.style.display = 'none';
      if (saveBtn) saveBtn.style.display = 'inline-flex';
      if (portalState.currentUser) {
        const nameInput = document.getElementById('prof-name');
        const emailInput = document.getElementById('prof-email');
        const mobileInput = document.getElementById('prof-mobile');
        const passwordInput = document.getElementById('prof-password');
        if (nameInput) nameInput.value = portalState.currentUser.name || '';
        if (emailInput) emailInput.value = portalState.currentUser.email || '';
        if (mobileInput) mobileInput.value = portalState.currentUser.mobile || '';
        if (passwordInput) passwordInput.value = '';
      }
    }

export async function saveProfileChanges() {
      if (!portalState.currentUser) return;
      const nameInput = document.getElementById('prof-name');
      const emailInput = document.getElementById('prof-email');
      const mobileInput = document.getElementById('prof-mobile');
      const passwordInput = document.getElementById('prof-password');

      const name = (nameInput ? nameInput.value : '').trim();
      const email = (emailInput ? emailInput.value : '').trim().toLowerCase();
      const mobile = (mobileInput ? mobileInput.value : '').trim().replace(/\D/g, '').slice(-10);
      const password = passwordInput ? passwordInput.value : '';

      if (!name || !email || mobile.length !== 10) {
        showToast('⚠️ Name, valid Email, and 10-digit Mobile Number are required.');
        return;
      }

      const targetOtpEmail = email || portalState.currentUser.email || '';

      // Stage changes only in _pendingProfileUpdatePayload — do NOT modify currentUser, localStorage, or Google Sheet until BOTH OTPs are verified!
      _pendingProfileUpdatePayload = {
        userId: portalState.currentUser.userId,
        name,
        email,
        mobile,
        password,
        targetOtpEmail
      };

      const res = await apiCall('updateProfile', {
        userId: portalState.currentUser.userId,
        name,
        email,
        mobile,
        step: 'sendOtp'
      });

      if (res && res.success) {
        window._profileUpdateRequiresWaOtp = Boolean(res.whatsappOtpRequired);
        const otpBox = document.getElementById('profile-update-otp-box');
        const hintEl = document.getElementById('profile-update-otp-hint');
        const waFreeBox = document.getElementById('prof-update-wa-free-box') || document.getElementById('profile-update-wa-box');
        const saveBtn = document.getElementById('btn-prof-save-changes');
        if (otpBox) otpBox.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'none';
        if (hintEl) {
          hintEl.innerHTML = `<i class="fa-solid fa-envelope-circle-check"></i> 6-Digit Email 2FA OTP dispatched to <strong>${window.escapeHtml(targetOtpEmail)}</strong>. Check your inbox.`;
        }
        if (waFreeBox) {
          if (window._profileUpdateRequiresWaOtp) {
            waFreeBox.style.display = 'block';
            waFreeBox.innerHTML = `<div style="font-size:12px; color:#047857; font-weight:700;">📲 6-Digit WhatsApp OTP dispatched to +91-${window.escapeHtml(mobile)}.</div>`;
          } else {
            waFreeBox.style.display = 'none';
          }
        }
        showToast(res.message || `🔐 6-Digit Email OTP sent to ${targetOtpEmail}.`);
        document.getElementById('prof-update-otp-input')?.focus();
      } else {
        _pendingProfileUpdatePayload = null;
        showToast((res && res.message) || '⚠️ Could not send profile verification OTP.');
      }
    }

export async function confirmProfileUpdateWithOtp() {
      if (!portalState.currentUser || !_pendingProfileUpdatePayload) {
        saveProfileChanges();
        return;
      }
      const otpIn = document.getElementById('prof-update-otp-input');
      const waOtpIn = document.getElementById('prof-update-wa-otp-input');
      const enteredOtp = (otpIn ? otpIn.value : '').trim();
      const enteredWaOtp = (waOtpIn ? waOtpIn.value : '').trim();
      if (!enteredOtp || enteredOtp.length < 6) {
        showToast('⚠️ Please enter the 6-digit Email 2FA OTP from your inbox to confirm your profile update.');
        if (otpIn) otpIn.focus();
        return;
      }
      if (window._profileUpdateRequiresWaOtp && (!enteredWaOtp || enteredWaOtp.length < 6)) {
        showToast('⚠️ Please enter the 6-digit WhatsApp Mobile OTP to confirm your profile update.');
        if (waOtpIn) waOtpIn.focus();
        return;
      }

      const payload = _pendingProfileUpdatePayload;
      const preferences = {
        ...(portalState.currentUser.preferences || {}),
        emailVerified: true,
        mobileVerified: true,
        mfaEnabled: false
      };

      try {
        const res = await apiCall('updateProfile', {
          userId: payload.userId,
          name: payload.name,
          email: payload.email,
          mobile: payload.mobile,
          password: payload.password,
          step: 'commit',
          otpCode: enteredOtp,
          mobileOtpCode: enteredWaOtp,
          mfaEnabled: false,
          preferences
        });

        if (res && res.success) {
          try {
            localStorage.setItem('steno_user_custom_prefs', JSON.stringify(preferences));
          } catch (e) {}
          markUserEmailVerified(payload.email, portalState.currentUser.userId);
          markUserMobileVerified(payload.mobile, portalState.currentUser.userId);
          portalState.currentUser.name = payload.name;
          portalState.currentUser.email = payload.email;
          portalState.currentUser.mobile = payload.mobile;
          portalState.currentUser.mfaEnabled = false;
          portalState.currentUser.emailVerified = true;
          portalState.currentUser.mobileVerified = true;
          portalState.currentUser.preferences = preferences;
          delete portalState.currentUser.password;

          localStorage.setItem('steno_user', JSON.stringify(portalState.currentUser));
          logPortalAction('PROFILE_UPDATE_2FA', `Updated profile settings with verified Email + WhatsApp 2FA for ${payload.name}`);
          _pendingProfileUpdatePayload = null;
          cancelProfileUpdateOtpStep();
          setupAuthenticatedUI();
          syncUnverifiedEmailPortalLockUI(false);
          toggleProfileCard();
          renderGlobalWatermark();
          showToast(res.message || '✅ Email & Mobile (WhatsApp) verified and profile updated in Google Sheets!');
        } else {
          showToast((res && res.message) || '❌ Invalid or expired 6-digit OTP code(s). Profile was NOT updated.');
        }
      } catch (error) {
        showToast('An error occurred while updating profile.');
      }
    }

export function executeLogout() {
      const prevUser = portalState.currentUser;
      if (prevUser) {
        logPortalAction('LOGOUT', 'User logged out and cleared local portal cache.');
        apiCall('logout', {
          userId: prevUser.userId,
          sessionToken: prevUser.token || prevUser.sessionToken || ''
        }, true);
      }
      cleanupAllAuthAndSessionResources();
      portalState.currentUser = null;
      clearAllPortalCacheOnLogout();
      const bellBtn = document.getElementById('header-notification-bell-btn');
      if (bellBtn) bellBtn.style.display = 'none';
      toggleNotificationCenterDrawer(false);
      closeAllDeviceNavMenu(true);
      renderAuthView();
      switchAuthTab('login');
      if (typeof renderPromoBanner === 'function') {
        renderPromoBanner();
      }
      if (typeof renderDashboardCustomBanner === 'function') {
        renderDashboardCustomBanner();
      }
      fetchPublicFooterStats();
      showToast('👋 Logged out & cleared cached session data.');
    }

export function saveUserDailyPracticeGoal(customVal) {
      const input = document.getElementById('daily-goal-custom-input') || document.getElementById('daily-goal-target-input');
      const rawVal = customVal !== undefined ? customVal : (input ? input.value : 1000);
      const val = Math.max(50, Math.min(25000, parseInt(rawVal) || 1000));
      if (input) input.value = val;
      const key = portalState.currentUser ? `rp_daily_goal_${portalState.currentUser.userId}` : 'rp_daily_goal_default';
      localStorage.setItem(key, String(val));
      renderDailyPracticeGoalUI();
      logPortalAction('SET_DAILY_GOAL', `Set Personal Daily Practice Goal to ${val} words`);
      if (portalState.currentUser && portalState.currentUser.userId) {
        apiCall('saveDailyGoalProgress', {
          userId: portalState.currentUser.userId,
          userName: portalState.currentUser.name || 'Student',
          date: getLocalDateString(),
          targetWords: val
        }, true);
      }
      showToast(`🎯 Daily Practice Goal updated to ${val} words!`);
    }

export function computeUserPracticeStreakAndStats() {
      const rawHistory = (portalState.globalData.userHistory && portalState.globalData.userHistory.length > 0)
        ? portalState.globalData.userHistory
        : (portalState.allTestHistoryList && portalState.allTestHistoryList.length > 0 ? portalState.allTestHistoryList : (portalState.globalData.history || []));
      const myHistory = rawHistory.filter(h => {
        if (!portalState.currentUser) return true;
        return String(h.UserID || h.userId || '') === String(portalState.currentUser.userId || '') ||
               String(h.UserName || '').toLowerCase() === String(portalState.currentUser.name || '').toLowerCase();
      });

      const dateSet = new Set();
      let peakWpm = 0;
      let bestAccuracy = 0;
      let bestExamName = 'SSC Stenographer Grade C & D Skill Evaluation';
      myHistory.forEach(h => {
        const dStr = formatLocalDate(h.Date || h.date || h.typingDate);
        if (dStr && dStr !== '-') dateSet.add(dStr);
        const spd = parseFloat(h.NetSpeed || h.netSpeed || 0) || 0;
        const acc = parseFloat(h.AccuracyPercentage || h.accuracy || 0) || 0;
        if (spd > peakWpm) {
          peakWpm = spd;
          bestAccuracy = acc || 96.5;
          bestExamName = cleanLeaderboardExamTitle(h.ExamName || h.examName || bestExamName);
        } else if (acc > bestAccuracy) {
          bestAccuracy = acc;
        }
      });

      // Compute Current Streak & Best Streak
      const sortedDates = Array.from(dateSet).sort();
      let bestStreak = 0;
      let tempStreak = 0;
      for (let i = 0; i < sortedDates.length; i++) {
        if (i === 0) {
          tempStreak = 1;
        } else {
          const prev = new Date(sortedDates[i - 1] + 'T00:00:00');
          const curr = new Date(sortedDates[i] + 'T00:00:00');
          const diffDays = Math.round((curr - prev) / 86400000);
          if (diffDays === 1) tempStreak++;
          else if (diffDays > 1) tempStreak = 1;
        }
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      }

      let currentStreak = 0;
      const todayObj = new Date();
      for (let back = 0; back < 365; back++) {
        const d = new Date(todayObj.getTime() - back * 86400000);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dKey = `${yyyy}-${mm}-${dd}`;
        if (dateSet.has(dKey)) {
          currentStreak++;
        } else {
          if (back === 0) continue; // If not practiced yet today, check yesterday
          break;
        }
      }
      if (currentStreak === 0 && myHistory.length > 0) currentStreak = 1;
      if (bestStreak < currentStreak) bestStreak = currentStreak;

      const storedBestKey = portalState.currentUser ? `rp_best_streak_${portalState.currentUser.userId}` : 'rp_best_streak_default';
      const savedBest = parseInt(localStorage.getItem(storedBestKey) || '0') || 0;
      if (bestStreak > savedBest) {
        localStorage.setItem(storedBestKey, String(bestStreak));
      } else {
        bestStreak = savedBest;
      }

      return {
        currentStreak: Math.max(currentStreak, myHistory.length > 0 ? 1 : 0),
        bestStreak: Math.max(bestStreak, currentStreak, 1),
        peakWpm: Math.round(peakWpm * 10) / 10,
        bestAccuracy: Math.round((bestAccuracy || 96.5) * 10) / 10,
        bestExamName,
        totalTests: myHistory.length
      };
    }

export function renderDailyPracticeGoalUI() {
      const key = portalState.currentUser ? `rp_daily_goal_${portalState.currentUser.userId}` : 'rp_daily_goal_default';
      const targetWords = Math.max(50, parseInt(localStorage.getItem(key) || '1000') || 1000);
      const input = document.getElementById('daily-goal-custom-input') || document.getElementById('daily-goal-target-input');
      if (input && document.activeElement !== input) input.value = targetWords;

      const todayStr = getLocalDateString();
      const rawHistory = (portalState.globalData.userHistory && portalState.globalData.userHistory.length > 0)
        ? portalState.globalData.userHistory
        : (portalState.allTestHistoryList && portalState.allTestHistoryList.length > 0 ? portalState.allTestHistoryList : (portalState.globalData.history || []));
      const myTodayTests = rawHistory.filter(h => {
        const isMe = !portalState.currentUser || String(h.UserID || h.userId || '') === String(portalState.currentUser.userId || '') || String(h.UserName || '').toLowerCase() === String(portalState.currentUser.name || '').toLowerCase();
        const isToday = formatLocalDate(h.Date || h.date || h.typingDate) === todayStr;
        return isMe && isToday;
      });

      let wordsTypedToday = 0;
      let strokesTypedToday = 0;
      myTodayTests.forEach(h => {
        const w = parseInt(h.TotalTypedWords || h.totalTypedWords || h.TotalWordsOriginal || h.TotalWord || h.totalWord || 0) || 0;
        wordsTypedToday += w;
        const userTxt = String(h.UserTranscription || h.userTranscription || h.TypedText || h.typedText || '');
        strokesTypedToday += userTxt ? userTxt.length : (w * 5);
      });

      const pct = Math.min(100, Math.round((wordsTypedToday / targetWords) * 100));
      const circumference = 289.02;
      const offset = circumference - (pct / 100) * circumference;
      const remainingWords = Math.max(0, targetWords - wordsTypedToday);

      const circleEl = document.getElementById('daily-goal-progress-circle');
      const pctTextEl = document.getElementById('daily-goal-pct-text');
      const typedWordsEl = document.getElementById('daily-goal-typed-words');
      const targetWordsEl = document.getElementById('daily-goal-target-words');
      const subtextEl = document.getElementById('daily-goal-status-subtext');
      const testsTodayEl = document.getElementById('daily-goal-tests-today');
      const strokesTodayEl = document.getElementById('daily-goal-strokes-today');
      const remainingEl = document.getElementById('daily-goal-remaining-words');

      if (circleEl) {
        circleEl.style.strokeDashoffset = String(offset);
        circleEl.style.stroke = pct >= 100 ? '#10b981' : 'var(--primary)';
      }
      if (pctTextEl) pctTextEl.innerText = `${pct}%`;
      if (typedWordsEl) typedWordsEl.innerText = wordsTypedToday.toLocaleString();
      if (targetWordsEl) targetWordsEl.innerText = targetWords.toLocaleString();
      if (testsTodayEl) testsTodayEl.innerText = String(myTodayTests.length);
      if (strokesTodayEl) strokesTodayEl.innerText = strokesTypedToday.toLocaleString();
      if (remainingEl) remainingEl.innerText = pct >= 100 ? 'Goal Complete! 🎉' : `${remainingWords.toLocaleString()} words`;
      if (subtextEl) {
        subtextEl.innerText = pct >= 100
          ? '🏆 Congratulations! You have achieved your Personal Daily Practice Goal for today!'
          : `Keep going! Type ${remainingWords.toLocaleString()} more words today across any test or drill to hit 100%.`;
      }

      // Update Streak, Peak Speed & Target Benchmark Progress
      const streakStats = computeUserPracticeStreakAndStats();
      const curStreakEl = document.getElementById('daily-streak-current-count');
      const bestStreakEl = document.getElementById('daily-streak-best-count');
      const welcomeStreakEl = document.getElementById('dash-welcome-streak-count');
      const peakWpmEl = document.getElementById('daily-goal-peak-wpm');
      if (curStreakEl) curStreakEl.innerText = String(streakStats.currentStreak);
      if (bestStreakEl) bestStreakEl.innerText = String(streakStats.bestStreak);
      if (welcomeStreakEl) welcomeStreakEl.innerText = String(streakStats.currentStreak);
      if (peakWpmEl) peakWpmEl.innerText = `${streakStats.peakWpm} WPM`;

      // Student Batch Badge & Appointed Monitor Badge on Dashboard
      const batchBadgeEl = document.getElementById('dash-user-batch-badge');
      const batchNameEl = document.getElementById('dash-user-batch-name');
      const monitorBadgeEl = document.getElementById('dash-user-monitor-badge');
      const monitorTextEl = document.getElementById('dash-user-monitor-text');
      if (batchBadgeEl && batchNameEl && portalState.currentUser) {
        const uidKey = portalState.currentUser.userId || portalState.currentUser.mobile || '';
        const userBatch = typeof getUserAssignedBatch === 'function' ? getUserAssignedBatch(uidKey, portalState.currentUser.batch || portalState.currentUser.Batch) : (portalState.currentUser.batch || portalState.currentUser.Batch || 'RP-Trail');
        batchNameEl.innerText = userBatch || 'RP-Trail';
        batchBadgeEl.style.display = 'inline-flex';
        if (monitorBadgeEl && monitorTextEl && typeof getUserMonitorBatchesList === 'function') {
          const monitorBatches = getUserMonitorBatchesList(uidKey);
          if (monitorBatches.length > 0) {
            monitorTextEl.innerText = `Batch Monitor (${monitorBatches.join(', ')})`;
            monitorBadgeEl.style.display = 'inline-flex';
          } else {
            monitorBadgeEl.style.display = 'none';
          }
        }
      }


    }

export function openOfficialCertificateModal() {
      const modal = document.getElementById('official-certificate-modal');
      if (!modal) return;
      const stats = computeUserPracticeStreakAndStats();
      const nameIn = document.getElementById('cert-candidate-name-input');
      const speedIn = document.getElementById('cert-speed-score-input');
      const accIn = document.getElementById('cert-acc-streak-input');
      if (nameIn && !nameIn.value.trim()) {
        nameIn.value = (portalState.currentUser && portalState.currentUser.name) ? portalState.currentUser.name : 'RP Skill Scholar';
      }
      if (speedIn && !speedIn.value.trim()) {
        speedIn.value = `${stats.peakWpm > 0 ? stats.peakWpm : 85} WPM`;
      }
      if (accIn && !accIn.value.trim()) {
        accIn.value = `${stats.bestAccuracy > 0 ? stats.bestAccuracy : 97.4}% | 🔥 ${stats.bestStreak}d Streak`;
      }
      modal.style.display = 'flex';
      renderOfficialCertificatePreview();
    }

export function renderOfficialCertificatePreview() {
      const stage = document.getElementById('official-certificate-printable-stage');
      if (!stage) return;
      const stats = computeUserPracticeStreakAndStats();
      const nameIn = document.getElementById('cert-candidate-name-input');
      const streamSel = document.getElementById('cert-stream-select');
      const speedIn = document.getElementById('cert-speed-score-input');
      const accIn = document.getElementById('cert-acc-streak-input');

      const candName = (nameIn && nameIn.value.trim())
        ? nameIn.value.trim()
        : ((portalState.currentUser && portalState.currentUser.name) ? portalState.currentUser.name : 'RP Skill Scholar');
      const userBatch = (portalState.currentUser && typeof getUserAssignedBatch === 'function')
        ? getUserAssignedBatch(portalState.currentUser.userId || portalState.currentUser.mobile)
        : ((portalState.currentUser && (portalState.currentUser.batch || portalState.currentUser.Batch)) || 'SSC & High Court Special Batch');
      const modeSel = document.getElementById('cert-select-achievement-type');
      const mode = modeSel ? modeSel.value : 'best_overall';

      let disciplineTitle = (streamSel && streamSel.value)
        ? streamSel.value
        : 'Stenography & Computer Typing Proficiency';
      let speedShown = stats.peakWpm > 0 ? `${stats.peakWpm} WPM` : '85 WPM';
      let accShown = `${stats.bestAccuracy > 0 ? stats.bestAccuracy : 97.4}%`;
      let streakShown = `🔥 ${stats.bestStreak} Days`;
      let badgeLabel = 'GOLD MERIT PROFICIENCY';

      if (mode === 'steno_80') {
        disciplineTitle = 'English / Hindi Shorthand Dictation & Transcription (Grade D Standard)';
        speedShown = `${Math.max(stats.peakWpm || 80, 80)} WPM`;
        badgeLabel = 'SSC GRADE-D STENO CERTIFIED';
      } else if (mode === 'steno_100') {
        disciplineTitle = 'Parliamentary & High Court Shorthand Dictation (Grade C Standard)';
        speedShown = `${Math.max(stats.peakWpm || 100, 100)} WPM`;
        badgeLabel = 'SSC GRADE-C / COURT STENO MASTER';
      } else if (mode === 'typing_35') {
        disciplineTitle = 'Computer Skill & Touch Typing Mastery (SSC CGL / CHSL Benchmark)';
        speedShown = `${Math.max(Math.min(stats.peakWpm || 42, 65), 42)} WPM`;
        badgeLabel = 'TYPING SKILL DISTINCTION';
      } else if (mode === 'streak_master') {
        disciplineTitle = `${stats.bestStreak}-Day Unbroken Practice Streak & Daily Target Excellence`;
        badgeLabel = 'CONSISTENCY & STREAK CHAMPION';
      }

      if (speedIn && speedIn.value.trim()) {
        speedShown = speedIn.value.trim();
      }
      if (accIn && accIn.value.trim()) {
        const parts = accIn.value.split('|').map(s => s.trim()).filter(Boolean);
        if (parts[0]) accShown = parts[0].includes('%') ? parts[0] : `${parts[0]}%`;
        if (parts[1]) streakShown = parts[1];
      }

      const certId = 'RPSKILL-' + new Date().getFullYear() + '-' + String((portalState.currentUser && portalState.currentUser.userId) || '108').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) + '-' + String(Math.floor(1000 + Math.random() * 9000));
      const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

      const escCert = (v) => (typeof window.escapeHtml === 'function')
        ? window.escapeHtml(String(v ?? ''))
        : String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

      stage.innerHTML = `
        <div style="border: 3px double #b45309; border-radius: 10px; padding: 28px 32px; background: radial-gradient(circle at center, #fffdf7 0%, #fef3c7 100%); position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(180,83,9,0.25); padding-bottom: 14px; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg, #1e293b, #b45309); color: #fef08a; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; box-shadow: 0 6px 14px rgba(180,83,9,0.25);">RP</div>
              <div>
                <div style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: 0.04em; text-transform: uppercase;">RP Skill — Ranjan Pathshala</div>
                <div style="font-size: 11px; font-weight: 700; color: #92400e; letter-spacing: 0.08em; text-transform: uppercase;">ISO-Standard Stenography, Pitman Shorthand, Typing &amp; CBT Examination Portal</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10px; font-weight: 800; color: #78350f; text-transform: uppercase;">Certificate Verification ID</div>
              <div style="font-size: 12px; font-weight: 900; color: #0f172a; font-family: monospace; background: rgba(254,240,138,0.7); padding: 3px 8px; border-radius: 6px; border: 1px solid #d97706;">${escCert(certId)}</div>
            </div>
          </div>

          <div style="text-align: center; margin: 14px 0 20px 0;">
            <span style="display: inline-block; padding: 4px 16px; border-radius: 999px; background: linear-gradient(135deg, #b45309, #d97706); color: #fff; font-size: 11px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 10px;">🏅 ${escCert(badgeLabel)}</span>
            <h1 style="font-size: 28px; font-weight: 900; color: #0f172a; margin: 0; font-family: Georgia, serif; letter-spacing: 0.03em;">CERTIFICATE OF PROFICIENCY</h1>
            <p style="font-size: 12.5px; color: #64748b; margin: 6px 0 0 0; font-style: italic;">This official credential is proudly presented to</p>
          </div>

          <div style="text-align: center; margin: 14px auto; padding: 10px 24px; border-bottom: 2px solid #d97706; max-width: 520px;">
            <div style="font-size: 26px; font-weight: 900; color: #1e3a8a; font-family: Georgia, serif; letter-spacing: 0.02em;">${escCert(candName)}</div>
            <div style="font-size: 11.5px; font-weight: 700; color: #92400e; margin-top: 3px;">Assigned Batch: ${escCert(userBatch)}</div>
          </div>

          <p style="text-align: center; font-size: 13.5px; color: #334155; line-height: 1.7; max-width: 680px; margin: 14px auto;">
            for demonstrating outstanding skill, accuracy, and examination readiness in
            <strong style="color: #0f172a;">${escCert(disciplineTitle)}</strong>
            under strict SSC / High Court automated evaluation standards on the RP Skill Portal.
          </p>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; max-width: 660px; margin: 20px auto; text-align: center;">
            <div style="background: rgba(255,255,255,0.85); border: 1px solid #f59e0b; border-radius: 10px; padding: 10px;">
              <div style="font-size: 10px; font-weight: 800; color: #78350f; text-transform: uppercase;">Verified Speed / Score</div>
              <div style="font-size: 18px; font-weight: 900; color: #1d4ed8; margin-top: 2px;">${escCert(speedShown)}</div>
            </div>
            <div style="background: rgba(255,255,255,0.85); border: 1px solid #f59e0b; border-radius: 10px; padding: 10px;">
              <div style="font-size: 10px; font-weight: 800; color: #78350f; text-transform: uppercase;">Net Accuracy</div>
              <div style="font-size: 18px; font-weight: 900; color: #15803d; margin-top: 2px;">${escCert(accShown)}</div>
            </div>
            <div style="background: rgba(255,255,255,0.85); border: 1px solid #f59e0b; border-radius: 10px; padding: 10px;">
              <div style="font-size: 10px; font-weight: 800; color: #78350f; text-transform: uppercase;">Practice Streak</div>
              <div style="font-size: 18px; font-weight: 900; color: #d97706; margin-top: 2px;">${escCert(streakShown)}</div>
            </div>
            <div style="background: rgba(255,255,255,0.85); border: 1px solid #f59e0b; border-radius: 10px; padding: 10px;">
              <div style="font-size: 10px; font-weight: 800; color: #78350f; text-transform: uppercase;">Evaluation Grade</div>
              <div style="font-size: 18px; font-weight: 900; color: #7c3aed; margin-top: 2px;">A+ Distinction</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 26px; padding-top: 14px; border-top: 1px dashed rgba(180,83,9,0.35); flex-wrap: wrap; gap: 14px;">
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #475569;">Date of Issue: <strong style="color:#0f172a;">${issueDate}</strong></div>
              <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Digitally Verified by RP Skill Automated Evaluation Engine</div>
            </div>
            <div style="text-align: center;">
              <div style="width: 64px; height: 64px; border-radius: 50%; border: 2px dashed #b45309; display: flex; align-items: center; justify-content: center; margin: 0 auto 4px auto; background: rgba(245,158,11,0.12); color: #92400e; font-size: 10px; font-weight: 900; text-align: center; line-height: 1.15;">OFFICIAL<br>SEAL<br>VERIFIED</div>
            </div>
            <div style="text-align: right;">
              <div style="font-family: Georgia, serif; font-size: 16px; font-weight: 800; font-style: italic; color: #1e293b; border-bottom: 1px solid #475569; padding-bottom: 2px;">Director, Ranjan Pathshala</div>
              <div style="font-size: 10.5px; font-weight: 800; color: #78350f; text-transform: uppercase; margin-top: 3px;">Chief Examination Controller</div>
            </div>
          </div>
        </div>
      `;
    }

export function printOrDownloadOfficialCertificate() {
      const stage = document.getElementById('official-certificate-printable-stage');
      if (!stage) return;
      const printContents = stage.outerHTML;
      const originalTitle = document.title;
      document.title = `RP_Skill_Official_Certificate_${(portalState.currentUser && portalState.currentUser.name ? portalState.currentUser.name : 'Scholar').replace(/\s+/g, '_')}`;
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
      const doc = printFrame.contentWindow.document;
      doc.open();
      doc.write(`<!DOCTYPE html><html><head><title>${document.title}</title><style>@page { size: landscape; margin: 12mm; } body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; margin: 0; padding: 10px; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style></head><body>${printContents}</body></html>`);
      doc.close();
      setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(printFrame);
          document.title = originalTitle;
        }, 1200);
      }, 250);
    }

export function renderDashboardUI() {
      seedRichDemoDataIfNeeded();

      const materials = (portalState.globalData && portalState.globalData.materials && portalState.globalData.materials.length > 0) ? portalState.globalData.materials : portalState.materialsData;
      let pdfCount = 0;
      let wordCount = 0;
      let audioCount = 0;
      let typingCount = 0;
      let pitmanCount = 0;
      let videoCourseCount = 0;
      let learningUploadedCount = 0;
      let cbtCount = 0;
      for (let i = 0; i < materials.length; i++) {
        const t = String(materials[i] && materials[i].Type || '').toLowerCase();
        if (t === 'pdf') pdfCount++;
        else if (t === 'word') wordCount++;
        else if (t === 'audio') audioCount++;
        else if (t === 'typingtest') typingCount++;
        else if (t === 'pitman') pitmanCount++;
        else if (t === 'videocourse') videoCourseCount++;
        else if (t === 'learningtyping') learningUploadedCount++;
        else if (t === 'cbttest') cbtCount++;
      }

      const allHist = (portalState.globalData && Array.isArray(portalState.globalData.history) && portalState.globalData.history.length > 0) ? portalState.globalData.history : (portalState.allTestHistoryList || []);
      const totalTestsGivenCount = (portalState.globalData.stats && portalState.globalData.stats.totalTestsGiven) ? portalState.globalData.stats.totalTestsGiven : allHist.length;

      if (document.getElementById('stat-pdfs')) document.getElementById('stat-pdfs').innerText = (portalState.globalData.stats && portalState.globalData.stats.totalPdfs) || pdfCount || 0;
      if (document.getElementById('stat-words')) document.getElementById('stat-words').innerText = (portalState.globalData.stats && portalState.globalData.stats.totalWords) || wordCount || 0;
      if (document.getElementById('stat-audios')) document.getElementById('stat-audios').innerText = (portalState.globalData.stats && portalState.globalData.stats.totalAudios) || audioCount || 0;
      if (document.getElementById('stat-typing-uploaded')) document.getElementById('stat-typing-uploaded').innerText = (portalState.globalData.stats && portalState.globalData.stats.totalTypingTests !== undefined) ? portalState.globalData.stats.totalTypingTests : typingCount;
      if (document.getElementById('stat-learning-uploaded')) document.getElementById('stat-learning-uploaded').innerText = learningUploadedCount;
      if (document.getElementById('stat-pitman-uploaded')) document.getElementById('stat-pitman-uploaded').innerText = (portalState.globalData.stats && portalState.globalData.stats.totalPitmanBooks !== undefined) ? portalState.globalData.stats.totalPitmanBooks : pitmanCount;
      if (document.getElementById('stat-videocourses')) document.getElementById('stat-videocourses').innerText = (portalState.globalData.stats && portalState.globalData.stats.totalVideoCourses !== undefined) ? portalState.globalData.stats.totalVideoCourses : videoCourseCount;
      if (document.getElementById('stat-cbt-uploaded')) document.getElementById('stat-cbt-uploaded').innerText = (portalState.globalData.stats && portalState.globalData.stats.totalCbtTests !== undefined && portalState.globalData.stats.totalCbtTests > 0) ? portalState.globalData.stats.totalCbtTests : cbtCount;
      if (document.getElementById('stat-total-tests-given')) document.getElementById('stat-total-tests-given').innerText = totalTestsGivenCount;

      if (document.getElementById('footer-total-users')) document.getElementById('footer-total-users').innerText = (portalState.globalData.stats && portalState.globalData.stats.totalUsers) || 0;
      if (document.getElementById('footer-total-visits')) document.getElementById('footer-total-visits').innerText = (portalState.globalData.stats && portalState.globalData.stats.totalVisits) || 0;

      // Critical above-the-fold UI renders immediately
      renderPromoBanner();
      if (typeof renderDashboardFreeTierNotice === 'function') renderDashboardFreeTierNotice();
      if (typeof syncUnverifiedEmailPortalLockUI === 'function') syncUnverifiedEmailPortalLockUI(false);
      if (typeof renderDashboardCustomBanner === 'function') renderDashboardCustomBanner();
      if (typeof window.renderDashboardExpiryRenewalAlert === 'function') window.renderDashboardExpiryRenewalAlert();
      if (typeof renderLiveTestsEverywhere === 'function') renderLiveTestsEverywhere();

      // Heavy below-the-fold widgets & SVG/Canvas charts render across animation frames to keep mobile scrolling smooth
      scheduleFrameTasks('dashboard-render', [
        () => renderDailyPracticeGoalUI(),
        () => { if (typeof renderDashboardBatchMonitoringHub === 'function') renderDashboardBatchMonitoringHub(); },
        () => renderAnnouncements(),
        () => renderHomework(),
        () => renderVideoReferences(),
        () => renderUserDashboardLeaderboards(),
        () => renderD3WeeklyProgressHeatmap(),
        () => renderUserPerformanceChart()
      ], 8);
    }

export function renderDashboardFreeTierNotice() {
      if (typeof window.renderDashboardExpiryRenewalAlert === 'function') window.renderDashboardExpiryRenewalAlert();
      const el = document.getElementById('dashboard-free-tier-notice');
      if (!el || !portalState.currentUser) return;
      const roleStr = String(portalState.currentUser.role || portalState.currentUser.Role || 'user').toLowerCase();
      if (roleStr === 'admin' || roleStr === 'superadmin') {
        el.style.display = 'none';
        return;
      }
      const batchStr = String(portalState.currentUser.batch || portalState.currentUser.Batch || '').trim();
      const validUntil = String(portalState.currentUser.enrollmentValidUntil || (portalState.currentUser.preferences && (portalState.currentUser.preferences.enrollmentValidUntil || portalState.currentUser.preferences.validityUntil)) || '').trim();
      const todayIso = getLocalDateString();
      const isExpired = Boolean(validUntil && /^\d{4}-\d{2}-\d{2}$/.test(validUntil) && validUntil < todayIso);
      const isAutoFreeTier = Boolean(portalState.currentUser.autoSwitchedToFreeTier || (isExpired && (batchStr.toLowerCase() === 'rp-trail' || batchStr.toLowerCase() === 'free tier')) || (isExpired));
      if (!isAutoFreeTier && !isExpired) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'flex';
      el.style.cssText = 'display:flex; margin-bottom:16px; padding:12px 16px; border-radius:12px; background:rgba(245,158,11,0.10); border:1px solid rgba(245,158,11,0.38); align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;';
      const prevBatch = portalState.currentUser.previousBatch || (portalState.currentUser.preferences && portalState.currentUser.preferences.previousBatch) || '';
      el.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:240px;">
          <i class="fa-solid fa-hourglass-end" style="color:#d97706; font-size:18px;"></i>
          <div style="font-size:12.5px; color:var(--secondary); line-height:1.45;">
            <strong style="color:#b45309;">RP-Trail (Free Batch) Active${validUntil ? ' — Batch Validity Expired (' + escapeHtml(validUntil) + ')' : ''}</strong><br>
            <span style="color:var(--text-muted);">Your account has been automatically switched to <strong>RP-Trail</strong>${prevBatch ? ' (previous batch: ' + escapeHtml(prevBatch) + ')' : ''}. Free content remains accessible; contact your administrator to renew batch validity.</span>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="navigateTo('feedback', true, true)"><i class="fa-solid fa-headset"></i> Request Batch Renewal</button>
      `;
    }

export function getDateSpecificBannersMap() {
      try {
        const raw = localStorage.getItem('steno_date_specific_banners');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
      return {};
    }

export function saveDateSpecificBannersMap(map, syncToServer = true) {
      try {
        localStorage.setItem('steno_date_specific_banners', JSON.stringify(map || {}));
      } catch (e) {}
      if (syncToServer) {
        const bannersArr = Object.values(map || {});
        apiCall('updateDateSpecificBanners', { banners: bannersArr }, true);
      }
    }

export let _topPromoBannerCycleTimer = null;

export let _topPromoBannerCycleIdx = 0;

export function renderPromoBanner() {
      const bannerElem = document.getElementById('announcement-banner');
      const bannerTextElem = document.getElementById('banner-text-content');
      if (!bannerElem) return;

      if (_topPromoBannerCycleTimer) {
        clearInterval(_topPromoBannerCycleTimer);
        _topPromoBannerCycleTimer = null;
      }

      const isLoggedIn = Boolean(portalState.currentUser && portalState.currentUser.userId);
      const activeTopBanners = [];

      // 1. Maintenance Mode Notice (if active)
      const maintCfg = getMaintenanceConfig();
      if (maintCfg && maintCfg.enabled) {
        const workingList = getWorkingTabsUnderMaintenance().map(t => TAB_DISPLAY_META[t]?.label || t).join(', ');
        const scopeInfo = maintCfg.mode === 'full_site'
          ? 'FULL SITE UNDER MAINTENANCE'
          : `ACTIVE WORKING TABS: ${workingList || 'None'}`;
        activeTopBanners.push(`🛠️ [MAINTENANCE MODE — ${scopeInfo}] ${maintCfg.message}`);
      }

      // 2. Date-Specific Top Website Banner Matter (shown for logged-in students)
      const todayStr = getLocalDateString();
      const dateBannersMap = getDateSpecificBannersMap();
      const todaySpecificMatter = dateBannersMap[todayStr];
      if (isLoggedIn && todaySpecificMatter && String(todaySpecificMatter.text || todaySpecificMatter || '').trim() !== '') {
        const textVal = typeof todaySpecificMatter === 'object' ? todaySpecificMatter.text : String(todaySpecificMatter);
        activeTopBanners.push(`📅 [${todayStr}] ${textVal}`);
      }

      // 3. General Admin Top Website Banner — separate Logged-Out vs Logged-In scrolling banners
      const serverBanner = (portalState.globalData && portalState.globalData.banner && typeof portalState.globalData.banner === 'object')
        ? portalState.globalData.banner
        : ((portalState.adminData && portalState.adminData.banner && typeof portalState.adminData.banner === 'object') ? portalState.adminData.banner : null);
      let cachedBanner = {};
      try {
        cachedBanner = JSON.parse(localStorage.getItem('steno_public_top_banner') || '{}') || {};
      } catch (e) {}
      const banner = (serverBanner && (serverBanner.text !== undefined || serverBanner.loggedOutText !== undefined || serverBanner.enabled !== undefined))
        ? { ...cachedBanner, ...serverBanner }
        : cachedBanner;

      const loggedOutBannerEntry = dateBannersMap['__LOGGED_OUT_BANNER__'];
      const rawLoggedInText = String((banner && banner.text) || '').trim();
      const rawLoggedOutText = String(
        (banner && banner.loggedOutText) ||
        (loggedOutBannerEntry && (typeof loggedOutBannerEntry === 'object' ? loggedOutBannerEntry.text : loggedOutBannerEntry)) ||
        ''
      ).trim();
      const hasLoggedInText = Boolean(rawLoggedInText && rawLoggedInText !== '-');
      const hasLoggedOutText = Boolean(rawLoggedOutText && rawLoggedOutText !== '-');

      let isForceEnabled = (hasLoggedInText || hasLoggedOutText) && (banner.enabled === undefined ? true : (banner.enabled === true || String(banner.enabled).toLowerCase() === 'true'));
      const now = new Date();
      const startTime = banner && banner.startTime ? new Date(banner.startTime) : null;
      const stopTime = banner && banner.stopTime ? new Date(banner.stopTime) : null;

      if (stopTime && !isNaN(stopTime.getTime()) && now > stopTime) {
        isForceEnabled = false;
        if (banner) {
          banner.enabled = false;
          banner.expiredByTime = true;
        }
        if (portalState.adminData && portalState.adminData.banner) {
          portalState.adminData.banner.enabled = false;
          portalState.adminData.banner.expiredByTime = true;
        }
      }

      const isWithinTimeRange = (!startTime || isNaN(startTime.getTime()) || now >= startTime) && (!stopTime || isNaN(stopTime.getTime()) || now <= stopTime);

      if (!isLoggedIn) {
        // Distinct Logged-Out / Public Visitor Scrolling Banner
        if (isForceEnabled && isWithinTimeRange && hasLoggedOutText) {
          activeTopBanners.push(rawLoggedOutText);
        } else {
          activeTopBanners.push('🎓 Welcome to RP Skill | Ranjan Pathshala — Sign In or Register to access Live SSC, High Court, DSSSB & Reporter Steno Dictations, Pitman Tests & CBT Exams!');
        }
      } else {
        // Distinct Logged-In Student Scrolling Banner
        if (isForceEnabled && isWithinTimeRange && hasLoggedInText) {
          activeTopBanners.push(rawLoggedInText);
        } else if (activeTopBanners.length === 0) {
          const userName = String(portalState.currentUser?.name || 'Student').trim();
          const userBatch = String(portalState.currentUser?.batch || '').trim();
          const batchSnippet = (userBatch && userBatch !== '-') ? ` (${userBatch})` : '';
          activeTopBanners.push(`✨ Welcome back, ${userName}${batchSnippet}! Practice Daily Audio Dictations, Pitman Tests, CBT Arena & track Weak Outlines from your workspace.`);
        }
      }

      bannerElem.style.display = 'flex';
      // Distinct visual themes for Logged-Out vs Logged-In scrolling top banner
      if (!isLoggedIn) {
        bannerElem.style.background = 'linear-gradient(90deg, #0f172a, #4338ca, #0284c7)';
        bannerElem.style.borderBottom = '1px solid rgba(129, 140, 248, 0.35)';
      } else {
        bannerElem.style.background = 'linear-gradient(90deg, #065f46, #0d9488, #2563eb)';
        bannerElem.style.borderBottom = '1px solid rgba(52, 211, 153, 0.3)';
      }

      if (activeTopBanners.length === 1) {
        if (bannerTextElem) bannerTextElem.innerText = activeTopBanners[0];
      } else {
        _topPromoBannerCycleIdx = _topPromoBannerCycleIdx % activeTopBanners.length;
        const updateTopText = () => {
          const idx = _topPromoBannerCycleIdx % activeTopBanners.length;
          if (bannerTextElem) {
            bannerTextElem.innerText = `[${idx + 1}/${activeTopBanners.length}] ${activeTopBanners[idx]}`;
          }
        };
        updateTopText();
        _topPromoBannerCycleTimer = setInterval(() => {
          _topPromoBannerCycleIdx = (_topPromoBannerCycleIdx + 1) % activeTopBanners.length;
          updateTopText();
        }, 5000);
      }
    }

export function getDashboardCustomBannerConfig() {
      if (portalState.globalData && portalState.globalData.dashboardBanner && typeof portalState.globalData.dashboardBanner === 'object' && portalState.globalData.dashboardBanner.mode) {
        return portalState.globalData.dashboardBanner;
      }
      if (portalState.adminData && portalState.adminData.dashboardBanner && typeof portalState.adminData.dashboardBanner === 'object' && portalState.adminData.dashboardBanner.mode) {
        return portalState.adminData.dashboardBanner;
      }
      try {
        const raw = localStorage.getItem('steno_dashboard_custom_banner');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
      return {
        mode: 'hidden',
        scheduleType: 'always',
        targetDate: '',
        imageUrl: '',
        title: '',
        text: '',
        ctaText: '',
        ctaLink: ''
      };
    }

export function saveDashboardCustomBannerConfig(cfg) {
      const cleanCfg = cfg || { mode: 'hidden' };
      if (portalState.globalData) portalState.globalData.dashboardBanner = cleanCfg;
      if (portalState.adminData) portalState.adminData.dashboardBanner = cleanCfg;
      try {
        localStorage.setItem('steno_dashboard_custom_banner', JSON.stringify(cleanCfg));
      } catch (e) {}
    }

export let _dashBannerCycleTimer = null;

export let _dashBannerActiveSlide = 0;

export let _dashBannerSlidesTotal = 0;

export function goToDashboardCarouselSlide(idx) {
      if (_dashBannerSlidesTotal <= 0) return;
      _dashBannerActiveSlide = ((Number(idx) % _dashBannerSlidesTotal) + _dashBannerSlidesTotal) % _dashBannerSlidesTotal;
      const track = document.getElementById('rp-dash-carousel-track');
      if (track) track.style.transform = `translateX(-${_dashBannerActiveSlide * 100}%)`;
      const counterEl = document.getElementById('rp-dash-carousel-counter');
      if (counterEl) counterEl.textContent = `${_dashBannerActiveSlide + 1} / ${_dashBannerSlidesTotal}`;
      document.querySelectorAll('#rp-dash-carousel-dots .rp-dash-carousel-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === _dashBannerActiveSlide);
      });
    }

export function stepDashboardCarousel(delta) {
      goToDashboardCarouselSlide(_dashBannerActiveSlide + Number(delta || 1));
    }

export function switchDashboardBannerSlide(slideIdx) {
      goToDashboardCarouselSlide(slideIdx);
    }

export function pauseDashboardCarouselAutoScroll() {
      if (_dashBannerCycleTimer) {
        clearInterval(_dashBannerCycleTimer);
        _dashBannerCycleTimer = null;
      }
    }

export function resumeDashboardCarouselAutoScroll(intervalMs) {
      pauseDashboardCarouselAutoScroll();
      if (_dashBannerSlidesTotal > 1) {
        const ms = Math.max(2000, Math.min(30000, Number(intervalMs) || 4000));
        _dashBannerCycleTimer = setInterval(() => {
          stepDashboardCarousel(1);
        }, ms);
      }
    }

export function renderDashboardCustomBanner() {
      const container = document.getElementById('dashboard-custom-promo-banner');
      if (!container) return;
      pauseDashboardCarouselAutoScroll();

      const cfg = getDashboardCustomBannerConfig();
      const todayStr = getLocalDateString();
      const scheduleType = cfg ? (cfg.scheduleType || (cfg.targetDate ? 'specific_date' : 'always')) : 'always';
      const isDateMismatch = Boolean(scheduleType === 'specific_date' && cfg && cfg.targetDate && String(cfg.targetDate).trim() !== '' && cfg.targetDate !== todayStr);

      if (!cfg || cfg.mode === 'hidden' || isDateMismatch) {
        container.style.display = 'none';
        container.innerHTML = '';
        _dashBannerSlidesTotal = 0;
        return;
      }

      // Normalize multi-image slides array + backward compatibility with legacy single imageUrl/title/text
      let slides = [];
      if (Array.isArray(cfg.slides) && cfg.slides.length > 0) {
        slides = cfg.slides.filter(s => s && (String(s.imageUrl || '').trim() || String(s.title || '').trim() || String(s.text || '').trim()));
      }
      if (slides.length === 0) {
        const showPhoto = Boolean((cfg.mode === 'both' || cfg.mode === 'photo') && cfg.imageUrl && String(cfg.imageUrl).trim() !== '');
        const showText = Boolean((cfg.mode === 'both' || cfg.mode === 'text') && ((cfg.title && String(cfg.title).trim()) || (cfg.text && String(cfg.text).trim())));
        if (showPhoto || showText) {
          slides.push({
            imageUrl: showPhoto ? String(cfg.imageUrl).trim() : '',
            title: showText ? String(cfg.title || '').trim() : '',
            text: showText ? String(cfg.text || '').trim() : '',
            ctaText: String(cfg.ctaText || '').trim(),
            ctaLink: String(cfg.ctaLink || '').trim()
          });
        }
      }

      if (slides.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        _dashBannerSlidesTotal = 0;
        return;
      }

      const autoSec = Math.max(2, Math.min(30, parseInt(cfg.autoScrollSeconds || 4, 10) || 4));
      _dashBannerSlidesTotal = slides.length;
      _dashBannerActiveSlide = 0;

      const slidesHtml = slides.map((s, idx) => {
        const hasImg = (cfg.mode !== 'text') && s.imageUrl && String(s.imageUrl).trim() !== '';
        const resolvedImg = hasImg ? getUniversalUrl(String(s.imageUrl).trim(), 'image') : '';
        const hasCta = s.ctaText && String(s.ctaText).trim() !== '' && s.ctaLink && String(s.ctaLink).trim() !== '';
        const ctaHtml = hasCta
          ? (String(s.ctaLink).trim().startsWith('#')
              ? `<button type="button" class="btn btn-primary btn-sm" onclick="navigateTo('${escapeHtml(String(s.ctaLink).trim().replace('#', ''))}')"><i class="fa-solid fa-arrow-right"></i> ${escapeHtml(s.ctaText)}</button>`
              : `<a href="${escapeHtml(s.ctaLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="text-decoration:none;"><i class="fa-solid fa-up-right-from-square"></i> ${escapeHtml(s.ctaText)}</a>`)
          : '';
        const showCaption = (cfg.mode !== 'photo') && ((s.title && String(s.title).trim()) || (s.text && String(s.text).trim()) || hasCta);

        if (hasImg) {
          return `
            <div class="rp-dash-carousel-slide">
              <img src="${resolvedImg}" alt="${escapeHtml(s.title || ('Banner ' + (idx + 1)))}" onclick="openEmbeddedImageModal('${resolvedImg.replace(/'/g, "\\'")}', '${escapeHtml(s.title || ('Dashboard Banner ' + (idx + 1))).replace(/'/g, "\\'")}')" onerror="this.style.opacity='0.2'">
              ${showCaption ? `
                <div class="rp-dash-carousel-caption">
                  <div style="flex:1; min-width:200px;">
                    ${s.title ? `<div style="font-size:15px; font-weight:800; line-height:1.25;">${escapeHtml(s.title)}</div>` : ''}
                    ${s.text ? `<div style="font-size:12.5px; opacity:0.92; margin-top:2px;">${escapeHtml(s.text)}</div>` : ''}
                  </div>
                  <div>${ctaHtml}</div>
                </div>
              ` : ''}
            </div>
          `;
        }
        return `
          <div class="rp-dash-carousel-slide" style="background:linear-gradient(135deg, rgba(37,99,235,0.10), rgba(99,102,241,0.10)); padding:24px 28px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; min-height:130px;">
            <div style="flex:1; min-width:220px;">
              ${s.title ? `<div style="font-size:17px; font-weight:800; color:var(--secondary); margin-bottom:4px;">${escapeHtml(s.title)}</div>` : ''}
              ${s.text ? `<div style="font-size:13.5px; color:var(--text-muted); line-height:1.55;">${escapeHtml(s.text)}</div>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${scheduleType === 'specific_date' && cfg.targetDate ? `<span style="font-size:11px; font-weight:800; color:var(--primary);">📅 ${escapeHtml(cfg.targetDate)}</span>` : ''}
              ${ctaHtml}
            </div>
          </div>
        `;
      }).join('');

      const dotsHtml = slides.length > 1
        ? `<div id="rp-dash-carousel-dots" class="rp-dash-carousel-dots">${slides.map((_, i) => `<button type="button" class="rp-dash-carousel-dot ${i === 0 ? 'active' : ''}" onclick="goToDashboardCarouselSlide(${i})" aria-label="Go to banner slide ${i + 1}"></button>`).join('')}</div>`
        : '';

      container.style.display = 'block';
      container.innerHTML = `
        <div class="rp-dash-carousel" onmouseenter="pauseDashboardCarouselAutoScroll()" onmouseleave="resumeDashboardCarouselAutoScroll(${autoSec * 1000})">
          <div id="rp-dash-carousel-track" class="rp-dash-carousel-track">${slidesHtml}</div>
          ${slides.length > 1 ? `
            <span id="rp-dash-carousel-counter" class="rp-dash-carousel-counter mono-num">1 / ${slides.length}</span>
            <button type="button" class="rp-dash-carousel-arrow prev" onclick="stepDashboardCarousel(-1)" aria-label="Previous banner"><i class="fa-solid fa-chevron-left"></i></button>
            <button type="button" class="rp-dash-carousel-arrow next" onclick="stepDashboardCarousel(1)" aria-label="Next banner"><i class="fa-solid fa-chevron-right"></i></button>
            ${dotsHtml}
          ` : ''}
        </div>
      `;

      if (slides.length > 1) {
        resumeDashboardCarouselAutoScroll(autoSec * 1000);
      }
    }

export function classifyLeaderboardCategory(examNameRaw) {
      const exam = String(examNameRaw || '').toLowerCase();
      if (exam.includes('cbt')) return 'cbt';
      if (exam.includes('learning')) return 'learning';
      if (exam.includes('pitman')) return 'pitman';
      if (exam.includes('audio') || exam.includes('transcription') || exam.includes('dictation') || exam.includes('steno')) return 'audio';
      return 'typing';
    }

export function sortLeaderboardEntries(list) {
      return list.slice().sort((a, b) => {
        const marksDiff = parseFloat(b.MarksObtained || 0) - parseFloat(a.MarksObtained || 0);
        const accDiff = parseFloat(b.AccuracyPercentage || 0) - parseFloat(a.AccuracyPercentage || 0);
        if (accDiff !== 0) return accDiff;
        const spdDiff = parseFloat(b.NetSpeed || 0) - parseFloat(a.NetSpeed || 0);
        if (spdDiff !== 0) return spdDiff;
        return marksDiff;
      });
    }

export function cleanLeaderboardExamTitle(rawTitle) {
      return String(rawTitle || '')
        .replace(/[-–—]?\s*\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?/g, '')
        .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
        .replace(/\b\d{2}[-/]\d{2}[-/]\d{4}\b/g, '')
        .replace(/[-–—]\s*$/, '')
        .trim() || '-';
    }

export let currentToppersTimeframe = 'today';

export let currentModalLbTimeframe = 'today';

export let currentModalLbCategory = 'ALL';

export let _toppersAutoScrollTimer = null;

export let _isToppersAutoScrollPaused = false;

export function getRichFallbackToppersHistory() {
      // Requirement #18: No pre-existing demo/seed data before Admin/User submits real tests
      return [];
    }

export function filterHistoryByTimeframe(rawList, timeframe) {
      const todayStr = getLocalDateString();
      const nowMs = Date.now();
      return rawList.filter(h => {
        const dStr = formatLocalDate(h.Date || h.date || h.typingDate);
        if (!dStr || dStr === '-') return timeframe === 'alltime';
        if (timeframe === 'today') return dStr === todayStr;
        if (timeframe === 'weekly') {
          const dt = new Date(dStr + 'T00:00:00');
          if (isNaN(dt.getTime())) return true;
          const diffDays = (nowMs - dt.getTime()) / 86400000;
          return diffDays >= -1 && diffDays <= 7.5;
        }
        return true; // 'alltime'
      });
    }

export function switchDashboardToppersTimeframe(timeframe) {
      currentToppersTimeframe = timeframe || 'today';
      ['today', 'weekly', 'alltime'].forEach(tf => {
        const btn = document.getElementById(`toppers-tf-btn-${tf}`);
        if (!btn) return;
        if (tf === currentToppersTimeframe) {
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
          btn.style.background = 'var(--primary)';
          btn.style.color = '#fff';
        } else {
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
          btn.style.background = '';
          btn.style.color = '';
        }
      });
      renderUserDashboardLeaderboards();
    }

export function scrollToppersCarouselBy(deltaPx) {
      const track = document.getElementById('toppers-autoscroll-track');
      if (!track) return;
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 8 && deltaPx > 0) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: deltaPx, behavior: 'smooth' });
      }
    }

export function startToppersCarouselAutoScroll() {
      if (_toppersAutoScrollTimer) {
        clearInterval(_toppersAutoScrollTimer);
        _toppersAutoScrollTimer = null;
      }
      _toppersAutoScrollTimer = setInterval(() => {
        if (_isToppersAutoScrollPaused) return;
        const track = document.getElementById('toppers-autoscroll-track');
        if (!track || track.offsetParent === null) return;
        if (track.scrollWidth <= track.clientWidth + 4) return;
        if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 8) {
          track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          track.scrollBy({ left: 265, behavior: 'smooth' });
        }
      }, 3200);
    }

export function renderUserDashboardLeaderboards() {
      const baseHistory = (portalState.globalData.history && portalState.globalData.history.length > 0)
        ? portalState.globalData.history
        : (Array.isArray(portalState.allTestHistoryList) ? portalState.allTestHistoryList : []);
      const activeList = filterHistoryByTimeframe(baseHistory, currentToppersTimeframe);

      const discSelect = document.getElementById('toppers-discipline-filter-select');
      const discFilter = discSelect ? discSelect.value : 'ALL';

      const podiumContainer = document.getElementById('dashboard-toppers-podium-and-table');
      if (!podiumContainer) return;

      const tfLabel = currentToppersTimeframe === 'weekly'
        ? 'Weekly (Last 7 Days)'
        : (currentToppersTimeframe === 'alltime' ? 'All-Time Hall of Fame' : "Today's Live");

      // Compute ONLY the #1 Topper of each Category (Requirement #13: Show only topper of each category, no Merit Standings table, auto-scroll cards)
      const allCatDefs = [
        { key: 'typing', icon: '⌨️', label: 'Typing Test', color: '#2563eb', bg: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,0.98))' },
        { key: 'audio', icon: '🎧', label: 'Audio Dictation', color: '#d97706', bg: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(255,255,255,0.98))' },
        { key: 'pitman', icon: '📖', label: 'Pitman Shorthand', color: '#059669', bg: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(255,255,255,0.98))' },
        { key: 'learning', icon: '🎓', label: 'Learning Typing', color: '#0891b2', bg: 'linear-gradient(135deg, rgba(8,145,178,0.10), rgba(255,255,255,0.98))' },
        { key: 'cbt', icon: '🖥️', label: 'CBT Exam', color: '#7c3aed', bg: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(255,255,255,0.98))' }
      ];

      const visibleCatDefs = allCatDefs.filter(cd => {
        if (discFilter === 'TYPING_ONLY' || discFilter === 'typing') return cd.key === 'typing' || cd.key === 'learning';
        if (discFilter === 'STENO_ONLY') return cd.key === 'audio' || cd.key === 'pitman';
        if (discFilter === 'CBT_ONLY' || discFilter === 'cbt') return cd.key === 'cbt';
        if (discFilter === 'TYPING_STENO') return cd.key !== 'cbt';
        return true;
      });

      const categoryTopperCardsHtml = visibleCatDefs.map(cd => {
        const catPool = sortLeaderboardEntries(activeList.filter(h => classifyLeaderboardCategory(h.ExamName) === cd.key));
        const topEntry = catPool[0];
        const myIdx = portalState.currentUser
          ? catPool.findIndex(item =>
              String(item.UserID || item.userId || '') === String(portalState.currentUser.userId || '') ||
              String(item.UserName || '').toLowerCase() === String(portalState.currentUser.name || '').toLowerCase()
            )
          : -1;
        const myRankBadge = myIdx !== -1 ? `Your Rank: #${myIdx + 1}` : `Attempts: ${catPool.length}`;

        if (!topEntry) {
          return `
            <div onclick="openTodayCompleteLeaderboardModal('${cd.key}')" style="flex: 0 0 255px; min-width: 245px; cursor: pointer; background: var(--surface); border: 1.5px dashed var(--border); border-top: 4px solid ${cd.color}; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; scroll-snap-align: start;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                <span style="font-size: 11px; font-weight: 800; color: ${cd.color}; text-transform: uppercase;">${cd.icon} ${cd.label} #1</span>
                <span style="font-size: 10px; font-weight: 800; color: var(--text-muted); background: var(--background); padding: 2px 8px; border-radius: 999px;">${tfLabel}</span>
              </div>
              <div style="font-size: 13px; font-weight: 800; color: var(--text-muted); padding: 6px 0;">No Topper Recorded Yet</div>
              <div style="font-size: 11px; color: var(--primary); font-weight: 700;">Submit a ${cd.label} test to claim Rank #1 →</div>
            </div>
          `;
        }

        const speedOrMarks = cd.key === 'cbt'
          ? `${topEntry.MarksObtained || 0}/${topEntry.TotalMarks || 100} Marks`
          : `${topEntry.NetSpeed || 0} WPM`;
        const userBatch = topEntry.Batch || (typeof getUserAssignedBatch === 'function' ? getUserAssignedBatch(topEntry.UserID) : 'General Batch');

        return `
          <div onclick="openTodayCompleteLeaderboardModal('${cd.key}')" title="Click to open full ${cd.label} standings" style="flex: 0 0 265px; min-width: 255px; cursor: pointer; background: ${cd.bg}; border: 1.5px solid ${cd.color}; border-top: 4px solid ${cd.color}; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 6px; box-shadow: 0 4px 14px rgba(15,23,42,0.06); scroll-snap-align: start; transition: transform 0.15s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
              <span style="font-size: 11px; font-weight: 900; color: ${cd.color}; text-transform: uppercase;">${cd.icon} ${cd.label} TOPPER</span>
              <span style="font-size: 10px; font-weight: 800; color: #0f172a; background: #fef3c7; border: 1px solid #f59e0b; padding: 2px 8px; border-radius: 999px;">🥇 RANK #1</span>
            </div>
            <div style="font-size: 15px; font-weight: 900; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
              ${topEntry.UserName || 'Topper Student'}
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${cleanLeaderboardExamTitle(topEntry.ExamName)}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; margin-top: 4px; border-top: 1px dashed rgba(148,163,184,0.45); font-size: 12px;">
              <span style="font-weight: 800; color: #15803d;">🎯 ${topEntry.AccuracyPercentage || 0}% Acc</span>
              <span style="font-weight: 900; color: ${cd.color};">⚡ ${speedOrMarks}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; font-weight: 700; color: #64748b; margin-top: 2px;">
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 145px;">👥 ${userBatch}</span>
              <span style="color: var(--primary); font-weight: 800;">${myRankBadge}</span>
            </div>
          </div>
        `;
      }).join('');

      podiumContainer.innerHTML = `
        <div style="position: relative; width: 100%;" onmouseenter="_isToppersAutoScrollPaused = true" onmouseleave="_isToppersAutoScrollPaused = false">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 11.5px; color: var(--text-muted); font-weight: 700; flex-wrap: wrap; gap: 6px;">
            <span><i class="fa-solid fa-crown" style="color: #f59e0b;"></i> Showing <strong>#1 Topper of Each Category</strong> — <strong style="color: var(--secondary);">${tfLabel}</strong> (Auto-Scrolling • Hover to Pause)</span>
            <div style="display: inline-flex; gap: 6px;">
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 3px 9px; font-size: 11px;" onclick="scrollToppersCarouselBy(-275)" title="Scroll Left"><i class="fa-solid fa-chevron-left"></i></button>
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 3px 9px; font-size: 11px;" onclick="scrollToppersCarouselBy(275)" title="Scroll Right"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
          </div>
          <div id="toppers-autoscroll-track" style="display: flex; gap: 12px; overflow-x: auto; scroll-behavior: smooth; scroll-snap-type: x mandatory; padding: 4px 2px 10px 2px; -webkit-overflow-scrolling: touch;">
            ${categoryTopperCardsHtml}
          </div>
        </div>
      `;

      startToppersCarouselAutoScroll();
    }

export function switchModalLeaderboardTimeframe(tf, clickedBtn) {
      currentModalLbTimeframe = tf || 'weekly';
      const group = document.getElementById('modal-lb-timeframe-group');
      if (group) {
        group.querySelectorAll('button').forEach(b => {
          const isMatch = b.getAttribute('data-modaltf') === currentModalLbTimeframe || b === clickedBtn;
          b.className = isMatch ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
        });
      }
      ['weekly', 'alltime', 'today'].forEach(k => {
        const b = document.getElementById(`modal-lb-tf-${k}`);
        if (!b) return;
        if (k === currentModalLbTimeframe) {
          b.style.background = '#fff';
          b.style.color = '#0f172a';
        } else {
          b.style.background = 'transparent';
          b.style.color = '#475569';
        }
      });
      renderTodayFullLeaderboardModalTable(currentModalLbCategory);
    }

export function openTodayCompleteLeaderboardModal(initialTab = 'ALL') {
      const modal = document.getElementById('today-full-leaderboard-modal');
      if (!modal) return;
      modal.style.display = 'flex';
      currentModalLbCategory = initialTab || 'ALL';
      const btn = document.querySelector(`.today-lb-tab-btn[data-lbtab="${initialTab}"]`);
      renderTodayFullLeaderboardModalTable(initialTab, btn);
    }

export function renderTodayFullLeaderboardModalTable(category = 'ALL', btn = null) {
      currentModalLbCategory = category || 'ALL';
      if (btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('.today-lb-tab-btn').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      }

      const baseHistory = portalState.globalData.history || [];
      const combined = baseHistory.length >= 4 ? baseHistory.concat(getRichFallbackToppersHistory()) : getRichFallbackToppersHistory().concat(baseHistory);
      let filteredList = filterHistoryByTimeframe(combined, currentModalLbTimeframe);
      if (filteredList.length === 0) filteredList = combined;

      if (category !== 'ALL') {
        filteredList = filteredList.filter(h => classifyLeaderboardCategory(h.ExamName) === category);
      }

      const sorted = sortLeaderboardEntries(filteredList);
      const summaryEl = document.getElementById('today-full-leaderboard-my-summary');
      const wrapEl = document.getElementById('today-full-leaderboard-table-wrap');
      const tfDisplay = currentModalLbTimeframe === 'weekly' ? 'Weekly' : (currentModalLbTimeframe === 'alltime' ? 'All-Time' : "Today's");

      if (summaryEl && portalState.currentUser) {
        const myIdx = sorted.findIndex(item =>
          String(item.UserID || item.userId || '') === String(portalState.currentUser.userId || '') ||
          String(item.UserName || '').toLowerCase() === String(portalState.currentUser.name || '').toLowerCase()
        );
        if (myIdx !== -1) {
          const mine = sorted[myIdx];
          summaryEl.innerHTML = `🌟 <strong>${portalState.currentUser.name}</strong> — Your ${tfDisplay} Rank in <strong>${category.toUpperCase()}</strong>: <span style="color:var(--primary); font-size:14px;">#${myIdx + 1}</span> out of ${sorted.length} submissions (Accuracy: ${mine.AccuracyPercentage}% | Speed: ${mine.NetSpeed || 0} WPM | Marks: ${mine.MarksObtained || '-'})`;
        } else {
          summaryEl.innerHTML = `ℹ️ Showing ${tfDisplay} Toppers Leaderboard for <strong>${category.toUpperCase()}</strong> (${sorted.length} ranked entries). Submit a test to boost your rank!`;
        }
      }

      if (!wrapEl) return;
      if (sorted.length === 0) {
        wrapEl.innerHTML = window.buildRpEmptyStateHtml(
          'No leaderboard rankings yet',
          'Complete any Audio Dictation, Skill Typing, or CBT Mock Exam to record the first ranked score.',
          'Start Practice Test',
          "navigateTo('audio', true, true)"
        );
        return;
      }

      let rowsHtml = sorted.map((h, idx) => {
        const rank = idx + 1;
        const catType = classifyLeaderboardCategory(h.ExamName);
        let catBadge = '<span style="background:rgba(79,70,229,0.14); color:#4f46e5; padding:2px 8px; border-radius:12px; font-weight:800; font-size:10px;">TYPING</span>';
        if (catType === 'pitman') catBadge = '<span style="background:rgba(16,185,129,0.14); color:#059669; padding:2px 8px; border-radius:12px; font-weight:800; font-size:10px;">PITMAN</span>';
        else if (catType === 'audio') catBadge = '<span style="background:rgba(245,158,11,0.15); color:#d97706; padding:2px 8px; border-radius:12px; font-weight:800; font-size:10px;">AUDIO</span>';
        else if (catType === 'learning') catBadge = '<span style="background:rgba(8,145,178,0.15); color:#0891b2; padding:2px 8px; border-radius:12px; font-weight:800; font-size:10px;">LEARNING</span>';
        else if (catType === 'cbt') catBadge = '<span style="background:rgba(124,58,237,0.15); color:#7c3aed; padding:2px 8px; border-radius:12px; font-weight:800; font-size:10px;">CBT EXAM</span>';

        const isMe = portalState.currentUser && (String(h.UserID || '') === String(portalState.currentUser.userId || '') || String(h.UserName || '').toLowerCase() === String(portalState.currentUser.name || '').toLowerCase());
        const medal = rank === 1 ? '🥇 #1' : (rank === 2 ? '🥈 #2' : (rank === 3 ? '🥉 #3' : `#${rank}`));
        return `
          <tr style="${isMe ? 'background: rgba(79,70,229,0.1); font-weight: 700;' : ''}">
            <td><strong>${medal}</strong></td>
            <td>${h.UserName || 'Student'} ${isMe ? '<span style="background:var(--primary); color:#fff; padding:1px 6px; border-radius:8px; font-size:10px; margin-left:4px;">YOU</span>' : ''}</td>
            <td>${catBadge}</td>
            <td>${cleanLeaderboardExamTitle(h.ExamName)}</td>
            <td style="color:#16a34a; font-weight:800;">${h.AccuracyPercentage || 0}%</td>
            <td style="color:var(--primary); font-weight:800;">${catType === 'cbt' ? '-' : (h.NetSpeed || 0) + ' WPM'}</td>
            <td>${h.MarksObtained || '-'}</td>
          </tr>
        `;
      }).join('');

      wrapEl.innerHTML = `
        <table border="1" borderColor="var(--border)" cellpadding="9" style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead style="background: var(--background);">
            <tr>
              <th>Rank</th>
              <th>Candidate Name</th>
              <th>Category</th>
              <th>Exam / Exercise</th>
              <th>Accuracy</th>
              <th>Net Speed</th>
              <th>Marks</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;
    }

export function handleHeatmapDatePickerChange(dateVal) {
      if (!dateVal) return;
      const parts = String(dateVal).split('-');
      if (parts.length !== 3) return;
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;
      const yearSelect = document.getElementById('heatmap-year-select');
      const monthSelect = document.getElementById('heatmap-month-select');
      if (yearSelect && !isNaN(yr)) {
        if (![...yearSelect.options].some(o => Number(o.value) === yr)) {
          const opt = document.createElement('option');
          opt.value = String(yr);
          opt.innerText = `📅 ${yr}`;
          yearSelect.appendChild(opt);
        }
        yearSelect.value = String(yr);
      }
      if (monthSelect && !isNaN(mo) && mo >= 0 && mo <= 11) {
        monthSelect.value = String(mo);
        monthSelect.dataset.initializedOnce = 'true';
      }
      window.__selectedHeatmapDateStr = dateVal;
      renderD3WeeklyProgressHeatmap();
    }

export function resetHeatmapToTodayCalendar() {
      const now = new Date();
      const todayIso = getLocalDateString();
      const yearSelect = document.getElementById('heatmap-year-select');
      const monthSelect = document.getElementById('heatmap-month-select');
      const datePicker = document.getElementById('heatmap-date-picker');
      if (yearSelect) yearSelect.value = String(now.getFullYear());
      if (monthSelect) {
        monthSelect.value = String(now.getMonth());
        monthSelect.dataset.initializedOnce = 'true';
      }
      if (datePicker) datePicker.value = todayIso;
      window.__selectedHeatmapDateStr = todayIso;
      renderD3WeeklyProgressHeatmap();
      showToast(`📅 Showing Today's Calendar (${now.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}). Switch Month to "Full Year (Jan–Dec)" anytime!`);
    }

export function renderD3WeeklyProgressHeatmap() {
      const container = document.getElementById('d3-weekly-heatmap-svg-container');
      if (!container || typeof d3 === 'undefined') return;

      const yearSelect = document.getElementById('heatmap-year-select');
      const monthSelect = document.getElementById('heatmap-month-select');
      const datePicker = document.getElementById('heatmap-date-picker');
      const nowDate = new Date();
      const currentYearNow = nowDate.getFullYear();
      const currentMonthNow = nowDate.getMonth();
      const todayKey = getLocalDateString();

      if (yearSelect && yearSelect.options.length === 0) {
        [currentYearNow, currentYearNow - 1, currentYearNow - 2].forEach(yr => {
          const opt = document.createElement('option');
          opt.value = String(yr);
          opt.innerText = `📅 ${yr}`;
          yearSelect.appendChild(opt);
        });
        yearSelect.value = String(currentYearNow);
      }
      // Default to Today's current month on initial load so only Today's Data Calendar is shown unless user switches to Full Year or another month
      if (monthSelect && !monthSelect.dataset.initializedOnce) {
        monthSelect.value = String(currentMonthNow);
        monthSelect.dataset.initializedOnce = 'true';
      }
      if (datePicker && !datePicker.value) {
        datePicker.value = todayKey;
      }

      const selectedYear = yearSelect ? (parseInt(yearSelect.value) || currentYearNow) : currentYearNow;
      const selectedMonthFilter = monthSelect ? monthSelect.value : String(currentMonthNow);
      const highlightedDateKey = window.__selectedHeatmapDateStr || (datePicker ? datePicker.value : todayKey) || todayKey;

      const rawHistory = (portalState.globalData.userHistory && portalState.globalData.userHistory.length > 0)
        ? portalState.globalData.userHistory
        : (portalState.allTestHistoryList && portalState.allTestHistoryList.length > 0 ? portalState.allTestHistoryList : (portalState.globalData.history || []));

      const userHistory = portalState.currentUser
        ? rawHistory.filter(h => String(h.UserID || h.userId || '').trim() === String(portalState.currentUser.userId).trim())
        : rawHistory;

      const countsByDate = {};
      const speedByDate = {};
      const accByDate = {};
      userHistory.forEach(h => {
        const dStr = formatLocalDate(h.Date || h.date || h.TypingDate || h.typingDate);
        if (!dStr || dStr === '-') return;
        countsByDate[dStr] = (countsByDate[dStr] || 0) + 1;
        const spd = parseFloat(h.NetSpeed ?? h.netSpeed ?? 0);
        if (!speedByDate[dStr] || spd > speedByDate[dStr]) {
          speedByDate[dStr] = spd;
        }
        const acc = parseFloat(h.AccuracyPercentage ?? h.accuracyPercentage ?? h.Accuracy ?? 0);
        if (!accByDate[dStr] || acc > accByDate[dStr]) {
          accByDate[dStr] = acc;
        }
      });

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      let activeDaysCount = 0;
      let restDaysCount = 0;
      let totalYearSessions = 0;
      let peakYearSpeed = 0;
      const allYearDays = [];
      const monthsData = [];

      for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(selectedYear, m + 1, 0).getDate();
        const firstDayDow = new Date(selectedYear, m, 1).getDay();
        const days = [];
        let monthActiveDays = 0;
        let monthSessions = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const mm = String(m + 1).padStart(2, '0');
          const dd = String(d).padStart(2, '0');
          const key = `${selectedYear}-${mm}-${dd}`;
          const count = countsByDate[key] || 0;
          const bestSpeed = speedByDate[key] || 0;
          const bestAcc = accByDate[key] || 0;
          if (bestSpeed > peakYearSpeed) peakYearSpeed = bestSpeed;
          if (count > 0) {
            activeDaysCount++;
            monthActiveDays++;
            monthSessions += count;
            totalYearSessions += count;
          } else {
            restDaysCount++;
          }
          const slotIndex = firstDayDow + (d - 1);
          const weekRow = Math.floor(slotIndex / 7);
          const dowCol = slotIndex % 7;
          const dayObj = {
            dateStr: key,
            dayNum: d,
            monthIdx: m,
            displayDate: `${shortMonths[m]} ${d}, ${selectedYear}`,
            count,
            bestSpeed,
            bestAcc,
            weekRow,
            dowCol
          };
          days.push(dayObj);
          allYearDays.push(dayObj);
        }
        monthsData.push({
          monthIdx: m,
          monthName: monthNames[m],
          shortName: shortMonths[m],
          daysInMonth,
          days,
          monthActiveDays,
          monthSessions
        });
      }

      let currentStreak = 0;
      const upToToday = allYearDays.filter(d => d.dateStr <= todayKey);
      for (let i = upToToday.length - 1; i >= 0; i--) {
        if (upToToday[i].count > 0) currentStreak++;
        else if (i === upToToday.length - 1) continue;
        else break;
      }

      // Populate Today's / Selected Date Summary Banner
      const todaySummaryEl = document.getElementById('heatmap-today-calendar-summary');
      if (todaySummaryEl) {
        const focusKey = highlightedDateKey || todayKey;
        const focusCount = countsByDate[focusKey] || 0;
        const focusSpeed = speedByDate[focusKey] || 0;
        const focusAcc = accByDate[focusKey] || 0;
        const isTodayFocus = focusKey === todayKey;
        todaySummaryEl.innerHTML = isTodayFocus
          ? `<i class="fa-solid fa-calendar-day"></i> <strong>Today (${todayKey}):</strong> ${focusCount} Session(s) • Peak: ${focusSpeed} WPM${focusAcc ? ` (${focusAcc}% Acc)` : ''} • <span style="opacity:0.9;">Change Month or Date above to view Full Year</span>`
          : `<i class="fa-solid fa-calendar-check"></i> <strong>Selected (${focusKey}):</strong> ${focusCount} Session(s) • Peak: ${focusSpeed} WPM${focusAcc ? ` (${focusAcc}% Acc)` : ''} • <a href="javascript:void(0)" onclick="resetHeatmapToTodayCalendar()" style="text-decoration:underline; font-weight:800;">Back to Today</a>`;
      }

      const filteredMonths = selectedMonthFilter === 'ALL'
        ? monthsData
        : monthsData.filter(m => String(m.monthIdx) === String(selectedMonthFilter));

      const activeBadge = document.getElementById('heatmap-active-days-badge');
      const restBadge = document.getElementById('heatmap-rest-days-badge');
      const streakBadge = document.getElementById('heatmap-streak-badge');
      if (selectedMonthFilter !== 'ALL' && filteredMonths.length === 1) {
        const fm = filteredMonths[0];
        if (activeBadge) activeBadge.innerHTML = `<i class="fa-solid fa-fire"></i> ${fm.monthName}: ${fm.monthActiveDays}/${fm.daysInMonth}d (${fm.monthSessions} Tests)`;
      } else {
        if (activeBadge) activeBadge.innerHTML = `<i class="fa-solid fa-fire"></i> Year ${selectedYear}: ${activeDaysCount}d (${totalYearSessions} Tests)`;
      }
      if (restBadge) restBadge.innerHTML = `<i class="fa-solid fa-mug-hot"></i> Rest: ${restDaysCount}d • Peak: ${peakYearSpeed} WPM`;
      if (streakBadge) streakBadge.innerHTML = `<i class="fa-solid fa-bolt"></i> Streak: ${currentStreak}d`;

      container.innerHTML = '';
      const isDark = document.body.classList.contains('dark-mode');
      const restFill = isDark ? '#1e293b' : '#f1f5f9';
      const restStroke = isDark ? '#334155' : '#e2e8f0';
      const cardBg = isDark ? '#0f172a' : '#ffffff';
      const cardHeaderBg = isDark ? '#1e293b' : '#f8fafc';
      const cardBorder = isDark ? '#334155' : '#cbd5e1';
      const textFill = isDark ? '#f8fafc' : '#0f172a';
      const mutedFill = isDark ? '#94a3b8' : '#64748b';

      const colorScale = d3.scaleThreshold()
        .domain([1, 2, 4])
        .range([restFill, '#6ee7b7', '#10b981', '#047857']);

      const isSingleMonth = filteredMonths.length === 1;
      const vw = window.innerWidth || 1200;
      const cols = isSingleMonth ? 1 : (vw < 520 ? 3 : (vw < 900 ? 4 : 6));
      const rows = Math.ceil(filteredMonths.length / cols);
      const boxW = isSingleMonth ? 260 : 150;
      const boxH = isSingleMonth ? 132 : 92;
      const gapX = 6;
      const gapY = 6;
      const svgW = Math.max(1, cols * boxW + Math.max(0, cols - 1) * gapX);
      const svgH = Math.max(1, rows * boxH + Math.max(0, rows - 1) * gapY);

      const svg = d3.select(container)
        .append('svg')
        .attr('viewBox', `0 0 ${svgW} ${svgH}`)
        .style('width', isSingleMonth ? 'min(100%, 340px)' : '100%')
        .style('max-height', isSingleMonth ? '155px' : '165px')
        .style('height', 'auto')
        .style('display', 'block')
        .style('margin', isSingleMonth ? '0 auto' : '0');

      const dowLabels = isSingleMonth ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      const cellSize = isSingleMonth ? 30 : 17;
      const cellH = isSingleMonth ? 14 : 9.2;
      const cellGap = isSingleMonth ? 4.5 : 2.5;

      const monthGroups = svg.selectAll('.d3-month-card')
        .data(filteredMonths)
        .enter()
        .append('g')
        .attr('class', 'd3-month-card')
        .attr('transform', (d, idx) => {
          const c = idx % cols;
          const r = Math.floor(idx / cols);
          return `translate(${c * (boxW + gapX)}, ${r * (boxH + gapY)})`;
        });

      monthGroups.append('rect')
        .attr('width', boxW)
        .attr('height', boxH)
        .attr('rx', 6)
        .attr('fill', cardBg)
        .attr('stroke', d => d.monthActiveDays > 0 ? '#10b981' : cardBorder)
        .attr('stroke-width', d => d.monthActiveDays > 0 ? 1.2 : 0.8);

      monthGroups.append('rect')
        .attr('x', 1)
        .attr('y', 1)
        .attr('width', boxW - 2)
        .attr('height', 16)
        .attr('rx', 5)
        .attr('fill', cardHeaderBg);

      monthGroups.append('text')
        .attr('x', 8)
        .attr('y', 12)
        .attr('fill', textFill)
        .style('font-size', isSingleMonth ? '9.5px' : '8.5px')
        .style('font-weight', '800')
        .style('cursor', 'pointer')
        .text(d => isSingleMonth ? `📅 ${d.monthName} ${selectedYear} (Click for Full Year)` : d.shortName)
        .on('click', (event, d) => {
          if (monthSelect) {
            monthSelect.value = selectedMonthFilter === 'ALL' ? String(d.monthIdx) : 'ALL';
            renderD3WeeklyProgressHeatmap();
          }
        });

      monthGroups.append('text')
        .attr('x', boxW - 8)
        .attr('y', 12)
        .attr('text-anchor', 'end')
        .attr('fill', d => d.monthActiveDays > 0 ? '#10b981' : mutedFill)
        .style('font-size', '7.8px')
        .style('font-weight', '800')
        .text(d => `${d.monthActiveDays}/${d.daysInMonth}d`);

      const hoverInfoEl = document.getElementById('d3-heatmap-hover-info');

      monthGroups.each(function(monthObj) {
        const g = d3.select(this);
        dowLabels.forEach((lbl, dowIdx) => {
          g.append('text')
            .attr('x', 10 + dowIdx * (cellSize + cellGap) + cellSize / 2)
            .attr('y', 25)
            .attr('text-anchor', 'middle')
            .attr('fill', mutedFill)
            .style('font-size', isSingleMonth ? '6.8px' : '6.2px')
            .style('font-weight', '800')
            .text(lbl);
        });

        const dayNodes = g.selectAll('.d3-month-day')
          .data(monthObj.days)
          .enter()
          .append('g')
          .attr('class', 'd3-month-day')
          .attr('transform', d => `translate(${10 + d.dowCol * (cellSize + cellGap)}, ${28 + d.weekRow * (cellH + 2)})`);

        dayNodes.append('rect')
          .attr('width', cellSize)
          .attr('height', cellH)
          .attr('rx', 2.5)
          .attr('fill', d => colorScale(d.count))
          .attr('stroke', d => (d.dateStr === todayKey || d.dateStr === highlightedDateKey) ? '#4f46e5' : (d.count > 0 ? '#059669' : restStroke))
          .attr('stroke-width', d => (d.dateStr === todayKey || d.dateStr === highlightedDateKey) ? 1.8 : 0.5)
          .style('cursor', 'pointer')
          .on('mouseenter', function(event, d) {
            d3.select(this).attr('stroke', '#2563eb').attr('stroke-width', 1.8);
            if (hoverInfoEl) {
              hoverInfoEl.innerHTML = d.count > 0
                ? `<strong style="color:#10b981;">✅ ${d.displayDate}${d.dateStr === todayKey ? ' (TODAY)' : ''}:</strong> <strong>${d.count}</strong> Test(s) • Best: <strong>${d.bestSpeed} WPM</strong>`
                : `<strong>☕ ${d.displayDate}${d.dateStr === todayKey ? ' (TODAY)' : ''}:</strong> Rest Day`;
            }
          })
          .on('mouseleave', function(event, d) {
            const isHighlighted = d.dateStr === todayKey || d.dateStr === highlightedDateKey;
            d3.select(this)
              .attr('stroke', isHighlighted ? '#4f46e5' : (d.count > 0 ? '#059669' : restStroke))
              .attr('stroke-width', isHighlighted ? 1.8 : 0.5);
          })
          .on('click', (event, d) => {
            window.__selectedHeatmapDateStr = d.dateStr;
            if (datePicker) datePicker.value = d.dateStr;
            const msg = d.count > 0
              ? `✅ ${d.displayDate}: ${d.count} Practice Session(s) | Peak Speed: ${d.bestSpeed} WPM`
              : `☕ ${d.displayDate}: Rest Day (0 tests recorded)`;
            showToast(msg);
            renderD3WeeklyProgressHeatmap();
          })
          .append('title')
          .text(d => d.count > 0
            ? `${d.displayDate}: ${d.count} session(s), Best Speed: ${d.bestSpeed} WPM`
            : `${d.displayDate}: Rest Day`);

        dayNodes.append('text')
          .attr('x', cellSize / 2)
          .attr('y', isSingleMonth ? 10 : 6.8)
          .attr('text-anchor', 'middle')
          .attr('fill', d => d.count >= 2 ? '#ffffff' : (d.count === 1 ? '#064e3b' : textFill))
          .style('font-size', isSingleMonth ? '7.8px' : '5.8px')
          .style('font-weight', d => (d.dateStr === todayKey || d.dateStr === highlightedDateKey) ? '900' : '800')
          .style('pointer-events', 'none')
          .text(d => d.dayNum);
      });
    }

export let _isFetchingHelpContacts = false;

export let _activeHelpContactRoleFilter = 'ALL';

export let _activeUserFeedbackStatusFilter = 'ALL';

export function filterUserFeedbackStatus(status, btn) {
      _activeUserFeedbackStatusFilter = status || 'ALL';
      const bar = document.getElementById('fb-status-filter-bar') || document.getElementById('fb-user-status-filter-bar');
      if (bar && btn) {
        bar.querySelectorAll('button').forEach(b => {
          b.className = 'btn btn-sm btn-secondary';
        });
        btn.className = 'btn btn-sm btn-primary';
      }
      currentFeedbackPage = 1;
      loadUserFeedback();
    }

export function filterHelpAdminContactsRole(role, btn) {
      _activeHelpContactRoleFilter = role || 'ALL';
      const bar = document.getElementById('help-contacts-role-filter-bar');
      if (bar && btn) {
        bar.querySelectorAll('button').forEach(b => {
          b.className = 'btn btn-sm btn-secondary';
        });
        btn.className = 'btn btn-sm btn-primary';
      }
      renderHelpAdminContacts(false);
    }

export function copyOfficialContactValue(val, label) {
      if (!val || val === '-') return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(val)).then(() => {
          showToast(`📋 Copied ${label}: ${val}`);
        }).catch(() => {});
      } else {
        showToast(`📋 ${label}: ${val}`);
      }
    }

export async function renderHelpAdminContacts(forceServerFetch = false) {
      const container = document.getElementById('help-admin-contacts-list');
      if (!container) return;

      const cleanField = (val, fallback = '') => {
        const s = String(val ?? '').trim();
        return (!s || s === '-' || s === 'undefined' || s === 'null' || s === 'N/A') ? fallback : s;
      };

      const splitBatchNames = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) {
          const out = [];
          val.forEach(item => {
            String(item || '').split(/[,;|]+/).forEach(p => {
              const t = p.trim();
              if (t && t !== '-' && !out.some(x => x.toLowerCase() === t.toLowerCase())) out.push(t);
            });
          });
          return out;
        }
        return (typeof parseBatchListValue === 'function')
          ? parseBatchListValue(val).filter(b => b && b !== '-')
          : String(val).split(/[,;|]+/).map(s => s.trim()).filter(b => b && b !== '-');
      };

      const buildMergedContactsList = (serverList = [], serverMonitorsMap = null) => {
        const curUser = portalState.currentUser;
        const viewerUid = curUser ? String(curUser.userId || curUser.UserID || '').trim() : '';
        const viewerRoleLower = curUser ? String(curUser.role || curUser.Role || 'user').toLowerCase().trim() : 'user';
        const isViewerAdmin = viewerRoleLower === 'admin' || viewerRoleLower === 'superadmin';
        const viewerMonitoredBatches = (viewerUid && typeof getUserMonitorBatchesList === 'function')
          ? getUserMonitorBatchesList(viewerUid)
          : [];
        const isViewerMonitor = viewerMonitoredBatches.length > 0 || viewerRoleLower === 'monitor' || Boolean(curUser && curUser.isBatchMonitor);

        const myBatchesLower = (() => {
          if (!curUser) return [];
          const assigned = (typeof getUserAssignedBatchesList === 'function')
            ? getUserAssignedBatchesList(viewerUid, curUser.batch || curUser.Batch || '')
            : splitBatchNames(curUser.batch || curUser.Batch || 'RP-Trail');
          const combined = [...(assigned || []), ...viewerMonitoredBatches];
          return Array.from(new Set(combined.map(b => String(b || '').trim().toLowerCase()).filter(Boolean)));
        })();

        // Collect a lookup directory of synced users so monitor entries always resolve complete contact details
        const syncedUsersPool = [
          ...(Array.isArray(portalState.adminData?.users) ? portalState.adminData.users : []),
          ...(Array.isArray(portalState.globalData?.users) ? portalState.globalData.users : []),
          ...(Array.isArray(portalState.globalData?.adminContacts) ? portalState.globalData.adminContacts : [])
        ];
        const userByIdMap = new Map();
        syncedUsersPool.forEach(u => {
          if (!u) return;
          const uid = cleanField(u.UserID || u.userId, '');
          if (uid && !userByIdMap.has(uid.toLowerCase())) {
            userByIdMap.set(uid.toLowerCase(), u);
          }
        });
        if (curUser && viewerUid && !userByIdMap.has(viewerUid.toLowerCase())) {
          userByIdMap.set(viewerUid.toLowerCase(), curUser);
        }

        const rawSources = [];
        if (Array.isArray(serverList)) rawSources.push(...serverList);
        if (Array.isArray(portalState.globalData?.adminContacts)) {
          rawSources.push(...portalState.globalData.adminContacts);
        }

        // Include synced Admin & Superadmin accounts from portal user pools as reliable fallback
        syncedUsersPool.forEach(u => {
          if (!u) return;
          const uRole = String(u.Role || u.role || '').toLowerCase().trim();
          if (uRole === 'admin' || uRole === 'superadmin') {
            rawSources.push({
              userId: u.UserID || u.userId,
              name: u.Name || u.name,
              email: u.Email || u.email,
              mobile: u.Mobile || u.mobile,
              role: uRole,
              designation: uRole === 'superadmin' ? 'Superadmin' : 'Administrator',
              department: uRole === 'superadmin' ? 'Administration' : 'Academic Operations',
              officeHours: '09:00 AM – 08:00 PM IST'
            });
          }
        });

        // Include current user if Admin/Superadmin so Help & Desk is never empty even before admin users table syncs
        if (curUser && isViewerAdmin) {
          rawSources.push({
            userId: viewerUid,
            name: curUser.name || curUser.Name || viewerUid,
            email: curUser.email || curUser.Email || '',
            mobile: curUser.mobile || curUser.Mobile || '',
            role: viewerRoleLower,
            isBatchMonitor: isViewerMonitor,
            monitoredBatches: viewerMonitoredBatches,
            designation: viewerRoleLower === 'superadmin' ? 'Superadmin' : 'Administrator',
            department: viewerRoleLower === 'superadmin' ? 'Administration' : 'Academic Operations',
            officeHours: '09:00 AM – 08:00 PM IST'
          });
        }

        // Collect Batch Monitors from BOTH serverMonitorsMap and local/synced getBatchMonitorsMap() (supporting arrays of up to 3 monitors per batch)
        const ingestMonitorsMap = (mMap) => {
          if (!mMap || typeof mMap !== 'object') return;
          Object.keys(mMap).forEach(batchName => {
            const bClean = String(batchName || '').trim();
            if (!bClean) return;
            const bLower = bClean.toLowerCase();
            if (!isViewerAdmin && !isViewerMonitor && !myBatchesLower.includes(bLower)) return;
            if (!isViewerAdmin && isViewerMonitor && !myBatchesLower.includes(bLower)) return;

            const entries = (typeof getBatchMonitorsList === 'function')
              ? getBatchMonitorsList(bClean, mMap)
              : (Array.isArray(mMap[bClean]) ? mMap[bClean] : [mMap[bClean]]);

            entries.forEach(entry => {
              if (!entry) return;
              const mUid = typeof entry === 'object' ? cleanField(entry.userId || entry.UserID, '') : cleanField(entry, '');
              const lookupUser = mUid ? userByIdMap.get(mUid.toLowerCase()) : null;
              const mName = cleanField(
                (typeof entry === 'object' ? (entry.userName || entry.name) : '') || (lookupUser && (lookupUser.Name || lookupUser.name)),
                ''
              );
              const mEmail = cleanField(
                (typeof entry === 'object' ? entry.email : '') || (lookupUser && (lookupUser.Email || lookupUser.email)),
                ''
              );
              const mMob = cleanField(
                (typeof entry === 'object' ? entry.mobile : '') || (lookupUser && (lookupUser.Mobile || lookupUser.mobile)),
                ''
              );
              const lookupRole = lookupUser ? String(lookupUser.Role || lookupUser.role || '').toLowerCase().trim() : '';
              if (!mName && !mUid) return;
              rawSources.push({
                userId: mUid,
                name: mName || mUid,
                email: mEmail,
                mobile: mMob,
                role: (lookupRole === 'superadmin' || lookupRole === 'admin') ? lookupRole : 'monitor',
                isBatchMonitor: true,
                isMyBatchMonitor: myBatchesLower.includes(bLower),
                monitoredBatches: [bClean],
                monitorDesignation: typeof entry === 'object' ? cleanField(entry.monitorType || entry.designation, 'Batch Monitor') : 'Batch Monitor',
                department: 'Batch Coordination & Doubt Desk',
                officeHours: '09:00 AM – 08:00 PM IST'
              });
            });
          });
        };

        ingestMonitorsMap(serverMonitorsMap);
        if (typeof getBatchMonitorsMap === 'function') {
          ingestMonitorsMap(getBatchMonitorsMap());
        }

        // Merge contacts by person so a user who is monitor of 2, 3, or more batches (or Admin + Monitor) appears as ONE unified, rich card
        const mergedByKey = new Map();
        const rolePriority = { superadmin: 3, admin: 2, monitor: 1 };

        rawSources.forEach(c => {
          if (!c) return;
          const rawRole = String(c.role || c.Role || '').toLowerCase().trim();
          const parsedMonBatches = splitBatchNames(
            (Array.isArray(c.monitoredBatches) && c.monitoredBatches.length > 0)
              ? c.monitoredBatches
              : (c.monitoredBatches || c.assignedBatch || c.monitorBatches || '')
          );
          const isMon = Boolean(c.isBatchMonitor || rawRole === 'monitor' || parsedMonBatches.length > 0);
          const isAdm = rawRole === 'admin' || rawRole === 'superadmin';
          if (!isAdm && !isMon) return;

          // Non-admin users only see monitors for batches they belong to or monitor (Admins/Superadmins see all)
          const scopedBatches = (isMon && !isViewerAdmin)
            ? parsedMonBatches.filter(b => myBatchesLower.includes(String(b || '').trim().toLowerCase()))
            : parsedMonBatches;
          if (isMon && !isAdm && !isViewerAdmin && parsedMonBatches.length > 0 && scopedBatches.length === 0) {
            return;
          }

          const cUid = cleanField(c.userId ?? c.UserID, '');
          const lookupUser = cUid ? userByIdMap.get(cUid.toLowerCase()) : null;
          const cName = cleanField(c.name ?? c.Name ?? (lookupUser && (lookupUser.Name || lookupUser.name)), '');
          const cEmail = cleanField(c.email ?? c.Email ?? (lookupUser && (lookupUser.Email || lookupUser.email)), '');
          const cMob = cleanField(c.mobile ?? c.Mobile ?? (lookupUser && (lookupUser.Mobile || lookupUser.mobile)), '');
          if (!cName && !cEmail && !cMob && !cUid) return;

          const effectiveRole = isAdm ? rawRole : 'monitor';
          const personKey = cUid
            ? `uid_${cUid.toLowerCase()}`
            : (cEmail ? `email_${cEmail.toLowerCase()}` : `name_${cName.toLowerCase()}_${cMob}`);

          const existing = mergedByKey.get(personKey);
          if (existing) {
            if ((rolePriority[effectiveRole] || 0) > (rolePriority[existing.role] || 0)) {
              existing.role = effectiveRole;
            }
            if (isMon) existing.isBatchMonitor = true;
            if (c.isMyBatchMonitor) existing.isMyBatchMonitor = true;
            scopedBatches.forEach(b => {
              if (b && !existing.monitoredBatches.some(x => x.toLowerCase() === b.toLowerCase())) {
                existing.monitoredBatches.push(b);
              }
            });
            if (existing.name === 'Official Contact' && cName) existing.name = cName;
            if (existing.email === '-' && cEmail) existing.email = cEmail;
            if (existing.mobile === '-' && cMob) existing.mobile = cMob;
          } else {
            mergedByKey.set(personKey, {
              userId: cUid || '-',
              name: cName || cUid || 'Official Contact',
              email: cEmail || '-',
              mobile: cMob || '-',
              role: effectiveRole,
              isBatchMonitor: isMon,
              isMyBatchMonitor: Boolean(c.isMyBatchMonitor || isMon),
              monitoredBatches: [...scopedBatches],
              monitorDesignation: cleanField(
                c.monitorDesignation || c.designation,
                effectiveRole === 'superadmin' ? 'Superadmin' : (effectiveRole === 'admin' ? 'Administrator' : 'Batch Monitor')
              ),
              department: cleanField(
                c.department,
                effectiveRole === 'superadmin' ? 'Administration' : (effectiveRole === 'admin' ? 'Academic Operations' : 'Batch Coordination')
              ),
              officeHours: cleanField(c.officeHours, '09:00 AM – 08:00 PM IST')
            });
          }
        });

        const unique = Array.from(mergedByKey.values());
        unique.sort((a, b) => {
          const rankOf = (x) => (x.role === 'superadmin' ? 1 : (x.role === 'admin' ? 2 : 3));
          const ra = xRank(a, rankOf);
          const rb = xRank(b, rankOf);
          if (ra !== rb) return ra - rb;
          return String(a.name || '').localeCompare(String(b.name || ''));
        });
        function xRank(item, fallbackFn) {
          if (item.isBatchMonitor && item.role === 'monitor') return 1;
          return fallbackFn(item) + 1;
        }
        return unique;
      };

      const buildContactCardEl = (c) => {
        const isSuper = c.role === 'superadmin';
        const isAdmin = c.role === 'admin';
        const isMonitor = Boolean(c.isBatchMonitor || c.role === 'monitor');
        const accent = isSuper ? '#4f46e5' : (isAdmin ? '#0284c7' : '#059669');
        const roleLabels = [];
        if (isSuper) roleLabels.push('Superadmin');
        else if (isAdmin) roleLabels.push('Admin');
        if (isMonitor) roleLabels.push('Batch Monitor');
        const roleText = roleLabels.join(' • ') || 'Support';

        const dispBatches = Array.isArray(c.monitoredBatches) && c.monitoredBatches.length > 0 ? c.monitoredBatches.join(', ') : '-';
        const dispName = escapeHtml(c.name);
        const dispEmail = escapeHtml(c.email);
        const dispMob = escapeHtml(c.mobile);
        const dispDesig = escapeHtml(c.monitorDesignation);
        const dispDept = escapeHtml(c.department);
        const rawEmail = String(c.email || '').replace(/'/g, "\\'");
        const rawMob = String(c.mobile || '').replace(/'/g, "\\'");
        const rawName = String(c.name || '').replace(/'/g, "\\'");
        const cleanDigits = String(c.mobile || '').replace(/[^0-9]/g, '');

        const card = document.createElement('div');
        card.style.cssText = 'background: var(--background); border: 1px solid var(--border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;';
        card.innerHTML = `
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
              <div>
                <strong style="font-size: 14.5px; color: var(--secondary); display: block; line-height: 1.3;">${dispName}</strong>
                <span style="font-size: 11.5px; color: var(--text-muted);">${dispDesig}</span>
              </div>
              <span style="font-size: 11px; font-weight: 700; color: ${accent}; white-space: nowrap;">${roleText}</span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 8px; line-height: 1.45;">
              ${dispDept}${dispBatches !== '-' ? ` · Batch${c.monitoredBatches.length > 1 ? 'es' : ''}: <strong style="color:var(--secondary);">${escapeHtml(dispBatches)}</strong>` : ''}
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 6px 9px; background: var(--surface); border-radius: 8px; border: 1px solid var(--border);">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><i class="fa-solid fa-envelope" style="color: var(--primary); width: 16px;"></i> ${dispEmail}</span>
                ${c.email !== '-' ? `<button type="button" class="btn btn-sm btn-secondary" style="padding: 2px 7px; font-size: 10px; min-height: 24px;" onclick="copyOfficialContactValue('${rawEmail}', 'Email ID')">Copy</button>` : ''}
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 6px 9px; background: var(--surface); border-radius: 8px; border: 1px solid var(--border);">
                <span class="mono-num"><i class="fa-solid fa-phone" style="color: #10b981; width: 16px;"></i> ${dispMob}</span>
                ${c.mobile !== '-' ? `<button type="button" class="btn btn-sm btn-secondary" style="padding: 2px 7px; font-size: 10px; min-height: 24px;" onclick="copyOfficialContactValue('${rawMob}', 'Mobile Number')">Copy</button>` : ''}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${c.email !== '-' ? `<a href="mailto:${dispEmail}" class="btn btn-sm btn-secondary" style="flex: 1; text-decoration: none; font-size: 11px; padding: 6px 8px;">Email</a>` : ''}
            ${cleanDigits.length >= 10 ? `<a href="tel:${cleanDigits.slice(-10)}" class="btn btn-sm btn-secondary" style="flex: 1; text-decoration: none; font-size: 11px; padding: 6px 8px;">Call</a>` : ''}
            ${cleanDigits.length >= 10 ? `<a href="https://wa.me/91${cleanDigits.slice(-10)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-success" style="flex: 1; text-decoration: none; font-size: 11px; padding: 6px 8px;">WhatsApp</a>` : ''}
            <button type="button" class="btn btn-sm btn-primary" style="flex: 1; font-size: 11px; padding: 6px 8px;" onclick="window.prefillHelpFeedbackTemplate('General Query', 'Dear ${rawName}, I need assistance regarding: ');">Message</button>
          </div>
        `;
        return card;
      };

      const renderCards = (allContacts) => {
        let contacts = Array.isArray(allContacts) ? [...allContacts] : [];

        if (_activeHelpContactRoleFilter !== 'ALL') {
          if (_activeHelpContactRoleFilter === 'monitor') {
            contacts = contacts.filter(c => c.role === 'monitor' || c.isBatchMonitor);
          } else {
            contacts = contacts.filter(c => c.role === _activeHelpContactRoleFilter);
          }
        }

        if (contacts.length === 0) {
          container.innerHTML = `
            <div class="inline-data-load-status done" data-end-of-list="true" style="grid-column: 1 / -1;">
              <i class="fa-solid fa-circle-info" style="color:var(--primary);"></i>
              <span>${allContacts.length === 0 ? 'No official contacts found yet. No more data.' : 'No matching contacts for this filter. No more data.'}</span>
            </div>`;
          return;
        }

        streamRenderCardsToContainer(container, contacts, (c) => buildContactCardEl(c), 1);
      };

      // Use already-fetched server data only when filtering/searching without forceServerFetch
      if (!forceServerFetch && Array.isArray(window._serverOfficialContactsCache) && window._serverOfficialContactsCache.length > 0) {
        renderCards(window._serverOfficialContactsCache);
        return;
      }

      // Immediately render locally synced contacts if available so Monitors/Admins/Superadmins see instant data
      const localBaseline = buildMergedContactsList([], null);
      if (localBaseline.length > 0) {
        renderCards(localBaseline);
      } else {
        container.innerHTML = `
          <div class="inline-data-load-status loading" style="grid-column: 1 / -1;">
            <span class="mini-spin"></span>
            <span>Loading official contacts...</span>
          </div>
        `;
      }

      if (_isFetchingHelpContacts) return;
      _isFetchingHelpContacts = true;
      try {
        const curUid = portalState.currentUser ? String(portalState.currentUser.userId || '').trim() : '';
        const assignedBatches = (portalState.currentUser && typeof getUserAssignedBatchesList === 'function')
          ? getUserAssignedBatchesList(curUid, portalState.currentUser.batch || portalState.currentUser.Batch || '')
          : [];
        const monBatches = (curUid && typeof getUserMonitorBatchesList === 'function')
          ? getUserMonitorBatchesList(curUid)
          : [];
        const allUserBatches = Array.from(new Set([...assignedBatches, ...monBatches].filter(Boolean)));
        // Send primary batch or compact comma-list so long multi-batch strings never break backend parsing
        const myBatchQuery = allUserBatches.slice(0, 6).join(', ');

        const res = await apiCall('getHelpContacts', {
          userId: curUid,
          userBatch: myBatchQuery
        }, true);

        if (res && res.success) {
          const mergedContacts = buildMergedContactsList(res.adminContacts || [], res.batchMonitors || res.batchMonitorsMap || null);
          window._serverOfficialContactsCache = mergedContacts;
          renderCards(mergedContacts);
        } else {
          const fallbackContacts = buildMergedContactsList([], null);
          if (fallbackContacts.length > 0) {
            window._serverOfficialContactsCache = fallbackContacts;
            renderCards(fallbackContacts);
          } else {
            window._serverOfficialContactsCache = null;
            container.innerHTML = `
              <div class="inline-data-load-status" style="grid-column: 1 / -1;">
                <i class="fa-solid fa-triangle-exclamation" style="color: #d97706;"></i>
                <span>Could not load official contacts from server. Click Refresh Help Desk to retry.</span>
              </div>
            `;
          }
        }
      } catch (e) {
        const fallbackContacts = buildMergedContactsList([], null);
        if (fallbackContacts.length > 0) {
          window._serverOfficialContactsCache = fallbackContacts;
          renderCards(fallbackContacts);
        } else {
          window._serverOfficialContactsCache = null;
          container.innerHTML = `
            <div class="inline-data-load-status" style="grid-column: 1 / -1;">
              <i class="fa-solid fa-triangle-exclamation" style="color: #dc2626;"></i>
              <span>Unable to reach server for official contacts. Click Refresh Help Desk to retry.</span>
            </div>
          `;
        }
      } finally {
        _isFetchingHelpContacts = false;
      }
    }

export function renderUserPerformanceChart() {
      const canvas = document.getElementById('user-analytics-chart');
      if (!canvas) return;

      const rawHistory = (portalState.globalData.userHistory && portalState.globalData.userHistory.length > 0)
        ? portalState.globalData.userHistory
        : (portalState.allTestHistoryList && portalState.allTestHistoryList.length > 0 ? portalState.allTestHistoryList : (portalState.globalData.history || []));

      const userHistory = portalState.currentUser
        ? rawHistory.filter(h => String(h.UserID || h.userId || '').trim() === String(portalState.currentUser.userId).trim())
        : rawHistory;

      const sortedHistory = [...userHistory].sort((a, b) => {
        const dA = new Date(a.Date || a.date || 0).getTime();
        const dB = new Date(b.Date || b.date || 0).getTime();
        return dA - dB;
      }).slice(-15);

      const labels = sortedHistory.map((h, idx) => {
        const dStr = formatLocalDate(h.Date || h.date) || `Test ${idx + 1}`;
        const ex = String(h.ExamName || h.examName || '').split(':')[0].trim();
        return ex ? `${dStr} (${ex.substring(0, 10)})` : dStr;
      });
      const accuracyData = sortedHistory.map(h => parseFloat(h.AccuracyPercentage || h.accuracyPercentage || 0));
      const speedData = sortedHistory.map(h => parseFloat(h.NetSpeed || h.netSpeed || 0));

      if (window.myPerformanceChart instanceof Chart) {
        window.myPerformanceChart.destroy();
      }

      window.myPerformanceChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels.length > 0 ? labels : ['No Tests Attempted Yet'],
          datasets: [
            {
              label: 'Accuracy (%)',
              data: accuracyData.length > 0 ? accuracyData : [0],
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true,
              tension: 0.3
            },
            {
              label: 'Net Speed (WPM)',
              data: speedData.length > 0 ? speedData : [0],
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              fill: true,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }

export function formatTextWithUrlButtons(text) {
      if (!text) return '';
      const rawText = String(text);
      const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
      const esc = typeof window.escapeHtml === 'function'
        ? window.escapeHtml
        : (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const sanitizeUrl = typeof window.rpSanitizeUrl === 'function'
        ? window.rpSanitizeUrl
        : (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '#');

      if (urlRegex.test(rawText)) {
        urlRegex.lastIndex = 0;
        let out = '';
        let lastIdx = 0;
        let match;
        while ((match = urlRegex.exec(rawText)) !== null) {
          if (match.index > lastIdx) {
            out += esc(rawText.slice(lastIdx, match.index));
          }
          const safeUrl = sanitizeUrl(match[0]);
          if (safeUrl && safeUrl !== '#') {
            out += `<br><a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px; margin: 6px 0; text-decoration: none;">
                    <i class="fa-solid fa-paperclip"></i> View Attached File
                  </a>`;
          } else {
            out += esc(match[0]);
          }
          lastIdx = match.index + match[0].length;
        }
        if (lastIdx < rawText.length) {
          out += esc(rawText.slice(lastIdx));
        }
        return `<div style="white-space: pre-wrap; color: var(--text);">${out}</div>`;
      }

      // If it is regular text without a link, display it cleanly as escaped text
      return `<div style="white-space: pre-wrap; color: var(--text);">${esc(rawText)}</div>`;
    }

export function getInlineDataLoadStatusHtml(forceStreaming = false) {
      if (forceStreaming || window.isPortalDataLoading) {
        return `<span class="mini-spin"></span> <span>Loading data...</span>`;
      }
      return `<i class="fa-solid fa-circle-check" style="color:var(--text-muted);"></i> <span>No more data</span>`;
    }

export function createInlineDataLoadStatusEl(spanFullGrid = false, forceStreaming = false) {
      const el = document.createElement('div');
      const isLoading = forceStreaming || Boolean(window.isPortalDataLoading);
      el.className = 'inline-data-load-status ' + (isLoading ? 'loading' : 'done');
      if (!isLoading) {
        el.dataset.endOfList = 'true';
      }
      if (spanFullGrid) {
        el.style.gridColumn = '1 / -1';
      }
      el.innerHTML = getInlineDataLoadStatusHtml(forceStreaming);
      return el;
    }

export function refreshVisibleDataLoadFooters() {
      const nodes = document.querySelectorAll('.inline-data-load-status');
      nodes.forEach(node => {
        if (node.dataset && node.dataset.cardStreaming === 'true') return;
        node.className = 'inline-data-load-status ' + (window.isPortalDataLoading ? 'loading' : 'done');
        if (!window.isPortalDataLoading) {
          node.dataset.endOfList = 'true';
        }
        node.innerHTML = getInlineDataLoadStatusHtml(false);
      });
    }

export function countMasterPassageWords(rawText) {
      const str = String(rawText || '').trim();
      if (!str || str === '-' || /^https?:\/\//i.test(str)) return 0;
      return str.split(/\s+/).filter(Boolean).length;
    }

export function countMasterPassageStrokes(rawText) {
      const str = String(rawText || '').trim();
      if (!str || str === '-' || /^https?:\/\//i.test(str)) return 0;
      return str.length;
    }

export function streamRenderCardsToContainer(container, items, buildCardElementFn, _batchSize = 1) {
      if (!container) return;
      const streamToken = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 7);
      container.dataset.streamToken = streamToken;
      container.innerHTML = '';

      if (!items || items.length === 0) {
        container.appendChild(createInlineDataLoadStatusEl(true, false));
        return;
      }

      const statusEl = createInlineDataLoadStatusEl(true, true);
      statusEl.dataset.cardStreaming = 'true';
      statusEl.innerHTML = `<span class="mini-spin"></span> <span>Loading data (0 of ${items.length})...</span>`;
      container.appendChild(statusEl);

      let cursor = 0;
      const renderNextCard = () => {
        if (container.dataset.streamToken !== streamToken) return;

        // Render strictly 1 card at a time for the first 25 cards so each card visibly streams in one-by-one;
        // for very large catalogs (>40 items), step up slightly after 25 cards so 200+ items finish smoothly without lag.
        const stepCount = (items.length > 40 && cursor >= 25) ? 3 : 1;
        const frag = document.createDocumentFragment();

        for (let s = 0; s < stepCount && cursor < items.length; s++) {
          const i = cursor++;
          let cardEl = null;
          try {
            cardEl = buildCardElementFn(items[i], i);
          } catch (cardErr) {
            console.error('Error building card for item:', items[i], cardErr);
          }
          if (cardEl) {
            if (typeof cardEl === 'string') {
              const tempWrapper = document.createElement('div');
              tempWrapper.innerHTML = cardEl.trim();
              while (tempWrapper.firstElementChild) {
                const elChild = tempWrapper.firstElementChild;
                elChild.classList.add('rp-stream-card-in');
                frag.appendChild(elChild);
              }
            } else if (cardEl instanceof Node) {
              if (cardEl.nodeType === 1 && cardEl.classList) {
                cardEl.classList.add('rp-stream-card-in');
              }
              frag.appendChild(cardEl);
            }
          }
        }

        if (statusEl && statusEl.parentNode === container) {
          container.insertBefore(frag, statusEl);
        } else {
          container.appendChild(frag);
        }

        if (cursor < items.length) {
          statusEl.dataset.cardStreaming = 'true';
          statusEl.className = 'inline-data-load-status loading';
          statusEl.innerHTML = `<span class="mini-spin"></span> <span>Loading data (${cursor} of ${items.length})...</span>`;
          requestAnimationFrame(renderNextCard);
        } else {
          delete statusEl.dataset.cardStreaming;
          if (window.isPortalDataLoading) {
            statusEl.className = 'inline-data-load-status loading';
            statusEl.innerHTML = `<span class="mini-spin"></span> <span>Loading more data (${items.length} loaded)...</span>`;
          } else {
            statusEl.dataset.endOfList = 'true';
            statusEl.className = 'inline-data-load-status done';
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--text-muted);"></i> <span>No more data</span>`;
          }
        }
      };

      requestAnimationFrame(renderNextCard);
    }

export function renderAnnouncements() {
      const list = document.getElementById('announcement-list');
      const dotsContainer = document.getElementById('announcement-dots');
      if (!list) return;
      list.innerHTML = '';
      
      const items = sortMaterialsLatestFirst(portalState.globalData.announcements || []);
      const itemsPerPage = 5;
      const totalPages = Math.ceil(items.length / itemsPerPage) || 1;

      if (typeof window.announcementPage === 'undefined') window.announcementPage = 1;
      if (window.announcementPage > totalPages) window.announcementPage = totalPages;
      if (window.announcementPage < 1) window.announcementPage = 1;

      const start = (window.announcementPage - 1) * itemsPerPage;
      const paged = items.slice(start, start + itemsPerPage);

      if (dotsContainer) {
        dotsContainer.innerHTML = '';
        for (let p = 1; p <= totalPages; p++) {
          const dot = document.createElement('span');
          dot.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background: ${p === window.announcementPage ? 'var(--primary)' : 'var(--border)'}; display: inline-block; transition: 0.2s; cursor: pointer;`;
          dot.onclick = () => {
            window.announcementPage = p;
            renderAnnouncements();
          };
          dotsContainer.appendChild(dot);
        }
      }

      if (paged.length === 0) {
        list.appendChild(createInlineDataLoadStatusEl(false));
        return;
      }

      paged.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 10px 12px; background: var(--border); border: 1px solid var(--border); border-radius: 8px;';
        
        const title = item.Title || item.title || '';
        const content = item.Content || item.content || '';
        const rawDate = item.PostedDate || item.postedDate || item.Date || '';
        
        let dateOnly = '';
        if (rawDate) {
          try {
            dateOnly = new Date(rawDate).toISOString().split('T')[0];
          } catch (e) {
            dateOnly = String(rawDate).split('T')[0];
          }
        }

        const formattedContent = formatTextWithUrlButtons(content);

        const safeTitle = escapeHtml(title);
        const safeDate = escapeHtml(dateOnly);
        div.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="color:var(--secondary);">${safeTitle}</strong>
            <span style="font-size:10px; color:var(--text-muted); background:var(--surface); padding:2px 6px; border-radius:4px;">${safeDate}</span>
          </div>
          <div>${formattedContent}</div>
        `;
        list.appendChild(div);
      });
    
  try { portalHooks.emit('afterAnnouncementsRender'); } catch (_hk) {}
}

export function paginateAnnouncements(dir) {
      const items = portalState.globalData.announcements || [];
      const itemsPerPage = 5;
      const totalPages = Math.ceil(items.length / itemsPerPage) || 1;

      if (typeof window.announcementPage === 'undefined') window.announcementPage = 1;

      if (dir === 1 && window.announcementPage < totalPages) {
        window.announcementPage++;
        renderAnnouncements();
      } else if (dir === -1 && window.announcementPage > 1) {
        window.announcementPage--;
        renderAnnouncements();
      }
    }

export function renderHomework() {
  const list = document.getElementById('homework-list');
  const dateFilterInput = document.getElementById('homework-date-filter');
  if (!list) return;
  list.innerHTML = '';
  
  let items = sortMaterialsLatestFirst(portalState.globalData.homework || []);
  if (items.length === 0) {
    list.appendChild(createInlineDataLoadStatusEl(false));
    return;
  }

  const selectedDate = dateFilterInput ? dateFilterInput.value : '';

  const formatDateStr = (dStr) => {
    return formatLocalDate(dStr);
  };

  const todayStr = getLocalDateString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  const isStaff = portalState.currentUser && (portalState.currentUser.role === 'admin' || portalState.currentUser.role === 'superadmin');

  let filteredItems = items.filter(hw => {
    const hwBatch = hw.TargetBatch || hw.targetBatch || 'ALL_BATCHES';
    if (!isStaff && hwBatch !== 'ALL_BATCHES' && portalState.currentUser) {
      const hasBatch = (typeof userHasBatchAssigned === 'function')
        ? userHasBatchAssigned(portalState.currentUser.userId, hwBatch, portalState.currentUser.Batch || portalState.currentUser.batch)
        : (typeof getUserAssignedBatch === 'function' ? getUserAssignedBatch(portalState.currentUser.userId) === hwBatch : true);
      if (!hasBatch) return false;
    }
    const hwDate = formatDateStr(hw.TargetDate || hw.date || '');
    if (selectedDate) {
      return hwDate === selectedDate;
    } else {
      return hwDate === todayStr || hwDate === tomorrowStr;
    }
  });

  if (filteredItems.length === 0) {
    list.appendChild(createInlineDataLoadStatusEl(false));
    return;
  }

  const groupedByDate = {};
  filteredItems.forEach(hw => {
    const hwDate = formatDateStr(hw.TargetDate || hw.date || 'General');
    if (!groupedByDate[hwDate]) {
      groupedByDate[hwDate] = [];
    }
    groupedByDate[hwDate].push(hw);
  });

  Object.keys(groupedByDate).sort().reverse().forEach(dateKey => {
    const dayHomeworks = groupedByDate[dateKey];
    const card = document.createElement('div');
    card.style.cssText = 'padding: 14px; background: var(--border); border: 1px solid var(--border); border-radius: 8px; border-left: 4px solid var(--primary); margin-bottom: 10px;';
    
    let hwContentHtml = dayHomeworks.map((hw, idx) => {
      const hwBatch = hw.TargetBatch || hw.targetBatch || 'ALL_BATCHES';
      const batchBadge = hwBatch && hwBatch !== 'ALL_BATCHES'
        ? `<span style="background: rgba(139,92,246,0.15); color: #6d28d9; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; margin-left: 6px;"><i class="fa-solid fa-users-rectangle"></i> ${escapeHtml(hwBatch)}</span>`
        : `<span style="background: rgba(16,185,129,0.12); color: #059669; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; margin-left: 6px;">All Batches</span>`;
      return `
      <div style="${idx > 0 ? 'margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 8px;' : ''}">
        <strong style="color:var(--secondary); font-size: 14px;">${escapeHtml(hw.Title || '')}${batchBadge}</strong>
        <p style="margin-top: 4px;">${formatTextWithUrlButtons(hw.Details || '')}</p>
      </div>`;
    }).join('');

    card.innerHTML = `
      <div style="font-size:12px; font-weight:800; color:var(--primary); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-calendar-day"></i> DUE DATE: ${escapeHtml(dateKey)} (${dayHomeworks.length} Task${dayHomeworks.length > 1 ? 's' : ''})
      </div>
      ${hwContentHtml}
    `;
    list.appendChild(card);
  });
}

export function isVideoOrMediaContentUrl(rawUrl) {
      const s = String(rawUrl || '').trim().toLowerCase();
      if (!s) return false;
      if (/\.(mp4|webm|mkv|mov|avi|m3u8|ogv|m4v|mp3|wav|ogg|m4a|aac|flac|pdf)(\?.*)?$/i.test(s)) return true;
      if (s.includes('youtube.com/watch') || s.includes('youtu.be/') || s.includes('youtube.com/shorts') || s.includes('youtube.com/embed') || s.includes('vimeo.com/')) return true;
      return false;
    }

export function getThumbnailUrl(item) {
      if (!item) return DEFAULT_LOGO_URL;
      const itemType = String(item.Type || item.type || '').toLowerCase();
      const contentUrl = String(item.ContentOrUrl || '').trim();
      const logoRaw = String(item.LogoUrl || '').trim();
      const thumbRaw = String(item.ThumbnailUrl || '').trim();

      const isDistinctValidImageThumb = (candidate) => {
        if (!candidate || candidate === '-') return false;
        // Must be a URL/image path, never plain text passage
        if (!/^https?:\/\/|^data:image\/|^\/|^\./i.test(candidate)) return false;
        // Thumbnail URL and Video / Content URL must NEVER be identical
        if (contentUrl && candidate.toLowerCase() === contentUrl.toLowerCase()) return false;
        // Reject raw video/audio/pdf watch URLs mistakenly pasted as thumbnail
        if (isVideoOrMediaContentUrl(candidate)) return false;
        return true;
      };

      // Audio items store reference passage in ThumbnailUrl, so check distinct LogoUrl first
      if (itemType === 'audio') {
        if (isDistinctValidImageThumb(logoRaw)) {
          return getUniversalUrl(logoRaw, 'image');
        }
        return DEFAULT_LOGO_URL;
      }

      if (isDistinctValidImageThumb(thumbRaw)) {
        return getUniversalUrl(thumbRaw, 'image');
      }
      if (isDistinctValidImageThumb(logoRaw)) {
        return getUniversalUrl(logoRaw, 'image');
      }
      return DEFAULT_LOGO_URL;
    }

export function renderVideoReferences() {
      const grid = document.getElementById('video-grid');
      if (!grid) return;

      const videos = sortMaterialsLatestFirst((portalState.globalData.materials || []).filter(m => m.Type === 'video'));
      streamRenderCardsToContainer(grid, videos, (vid) => {
        const card = document.createElement('div');
        card.className = 'card video-card';
        const thumbUrl = getThumbnailUrl(vid);
        const safeUrl = String(vid.ContentOrUrl || '').replace(/'/g, "\\'");
        const safeTitle = String(vid.Title || '').replace(/'/g, "\\'");

        card.innerHTML = `
          <div class="rp-thumb-frame">
            <img src="${thumbUrl}" class="card-thumb" onerror="this.onerror=null;this.src='${DEFAULT_LOGO_URL}'">
          </div>
          <strong style="color:var(--secondary); font-size:12.5px; margin: 4px 0; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(vid.Title || '')}</strong>
          <button class="btn btn-primary btn-sm" style="margin-top:auto; width: 100%; font-size: 11px; padding: 5px 8px;" onclick="openReferenceVideoModal('${safeUrl}', '${safeTitle}')"><i class="fa-solid fa-play"></i> Watch</button>
        `;
        return card;
      }, 1);
    }

export function getWatermarkText() {
      if (portalState.currentUser) {
        return `${SITE_NAME} - ${portalState.currentUser.name || 'User'} - ${portalState.currentUser.mobile || ''}`;
      }
      return `${SITE_NAME} - Guest`;
    }

export function getStreamMountTargetForMaterialType(type) {
      const map = {
        word: 'words-grid',
        pdf: 'pdf-grid',
        audio: 'audio-grid',
        pitman: 'pitman-grid',
        videocourse: 'videocourse-grid',
        cbttest: 'cbttest-grid',
        typingtest: 'typing-wizard-card-container',
        learningtyping: 'learning-uploaded-exercises-grid'
      };
      return map[String(type || '').toLowerCase()] || '';
    }

export async function loadMaterials(type, silent = true) {
      const normType = String(type || '').toLowerCase().trim();
      const renderByType = () => {
        if (normType === 'word') {
          buildAlphabetBar();
          populateWordsCategoryDropdown();
          renderWords();
        } else if (normType === 'pitman') {
          renderPitmanSubtabs();
        } else if (normType === 'typingtest') {
          initTypingTestWizard();
        } else if (normType === 'videocourse') {
          if (typeof renderVideoCourseView === 'function') renderVideoCourseView();
        } else if (normType === 'learningtyping') {
          if (typeof initLearningTypingTutor === 'function') initLearningTypingTutor();
        } else if (normType === 'cbttest') {
          if (typeof renderCbtTestCatalog === 'function') renderCbtTestCatalog();
        } else {
          renderSubtabs(normType);
        }
      };

      // Render immediately from any cached records (0ms)
      renderByType();

      // Progressive chunked streaming — merges & renders once per chunk (never blocks mobile UI)
      if (typeof window.streamCollectionOneByOne === 'function') {
        const footerAnchorId = getStreamMountTargetForMaterialType(normType);
        const streamedForType = [];
        const seenIds = new Set();
        let streamedSubtabs = null;
        await window.streamCollectionOneByOne({
          streamKey: 'materials_' + normType,
          collection: 'materials',
          extraParams: { type: normType },
          anchorId: footerAnchorId,
          labelSingular: normType === 'word' ? 'outline' : 'material',
          fallbackAction: 'getMaterials',
          fallbackParams: { type: normType },
          extractFallbackItems: (res) => {
            if (res && Array.isArray(res.subtabs)) streamedSubtabs = res.subtabs;
            return (res && Array.isArray(res.materials)) ? res.materials : [];
          },
          onMeta: (res) => {
            if (res && Array.isArray(res.subtabs) && res.subtabs.length > 0) {
              streamedSubtabs = res.subtabs;
              mergeMaterialsByType(normType, streamedForType, streamedSubtabs, { skipCache: true });
              renderByType();
            }
          },
          onBatch: (records) => {
            if (!Array.isArray(records) || records.length === 0) return;
            let added = false;
            for (let i = 0; i < records.length; i++) {
              const rec = records[i];
              if (!rec) continue;
              const normRec = typeof normalizeMaterialRecord === 'function' ? normalizeMaterialRecord(rec) : rec;
              const recId = String(normRec.ID || normRec.MaterialID || '');
              if (recId) {
                if (seenIds.has(recId)) continue;
                seenIds.add(recId);
              }
              streamedForType.push(normRec);
              added = true;
            }
            if (added) {
              mergeMaterialsByType(normType, streamedForType, streamedSubtabs, { skipCache: true });
              renderByType();
            }
          },
          onDone: () => {
            mergeMaterialsByType(normType, streamedForType, streamedSubtabs);
            renderByType();
            if (normType === 'cbttest' && streamedForType.length === 0 && typeof syncPortalDataInBackground === 'function') {
              syncPortalDataInBackground(false);
            }
          }
        });
        return;
      }

      const res = await apiCall('getMaterials', { type: normType }, silent);
      if (res && res.success) {
        mergeMaterialsByType(normType, res.materials, res.subtabs);
        renderByType();
      }
    }

export function renderSubtabs(type) {
  const container = document.getElementById(`${type}-subtabs`);
  if (!container) return;
  container.innerHTML = '';

  const matchingSubtabs = (Array.isArray(portalState.subtabsData) ? portalState.subtabsData : []).filter(stb =>
    !stb.Type || String(stb.Type).toLowerCase().trim() === String(type).toLowerCase().trim()
  );

  const savedRaw = String((portalState.currentSubtabFilter && portalState.currentSubtabFilter[type]) || 'ALL').trim();
  const matchedSaved = (savedRaw && savedRaw.toUpperCase() !== 'ALL')
    ? matchingSubtabs.find(stb => String(stb.SubtabName || '').trim().toLowerCase() === savedRaw.toLowerCase())
    : null;
  // Preserve user-selected subtab during streaming/background data loads instead of shifting back to ALL
  const activeFilter = matchedSaved
    ? matchedSaved.SubtabName
    : ((savedRaw && savedRaw.toUpperCase() !== 'ALL' && matchingSubtabs.length === 0) ? savedRaw : 'ALL');
  if (portalState.currentSubtabFilter) {
    portalState.currentSubtabFilter[type] = activeFilter;
  }

  const allBtn = document.createElement('button');
  allBtn.className = activeFilter === 'ALL' ? 'subtab-btn active' : 'subtab-btn';
  allBtn.innerText = 'All Subtabs';
  allBtn.onclick = () => {
    container.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    portalState.currentSubtabFilter[type] = 'ALL';
    renderMaterialsList(type, 'ALL');
  };
  container.appendChild(allBtn);

  matchingSubtabs.forEach(stb => {
    const btn = document.createElement('button');
    const isSel = activeFilter !== 'ALL' && String(stb.SubtabName || '').trim().toLowerCase() === String(activeFilter).trim().toLowerCase();
    btn.className = isSel ? 'subtab-btn active' : 'subtab-btn';
    btn.innerText = stb.SubtabName;
    btn.onclick = () => {
      container.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      portalState.currentSubtabFilter[type] = stb.SubtabName;
      renderMaterialsList(type, stb.SubtabName);
    };
    container.appendChild(btn);
  });

  renderMaterialsList(type, activeFilter);
}

export function renderPitmanSubtabs() {
      const container = document.getElementById('pitman-subtabs');
      if (!container) return;
      container.innerHTML = '';

      const matchingSubtabs = (Array.isArray(portalState.subtabsData) ? portalState.subtabsData : []).filter(stb =>
        !stb.Type || String(stb.Type).toLowerCase().trim() === 'pitman'
      );

      const savedRaw = String((portalState.currentSubtabFilter && portalState.currentSubtabFilter.pitman) || 'ALL').trim();
      const matchedSaved = (savedRaw && savedRaw.toUpperCase() !== 'ALL')
        ? matchingSubtabs.find(stb => String(stb.SubtabName || '').trim().toLowerCase() === savedRaw.toLowerCase())
        : null;
      const activeFilter = matchedSaved
        ? matchedSaved.SubtabName
        : ((savedRaw && savedRaw.toUpperCase() !== 'ALL' && matchingSubtabs.length === 0) ? savedRaw : 'ALL');
      if (portalState.currentSubtabFilter) {
        portalState.currentSubtabFilter.pitman = activeFilter;
      }

      const allBtn = document.createElement('button');
      allBtn.className = activeFilter === 'ALL' ? 'subtab-btn active' : 'subtab-btn';
      allBtn.innerText = 'All Exercises';
      allBtn.onclick = () => {
        container.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        portalState.currentSubtabFilter.pitman = 'ALL';
        renderPitmanList('ALL');
      };
      container.appendChild(allBtn);

      matchingSubtabs.forEach(stb => {
        const btn = document.createElement('button');
        const isSel = activeFilter !== 'ALL' && String(stb.SubtabName || '').trim().toLowerCase() === String(activeFilter).trim().toLowerCase();
        btn.className = isSel ? 'subtab-btn active' : 'subtab-btn';
        btn.innerText = stb.SubtabName;
        btn.onclick = () => {
          container.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          portalState.currentSubtabFilter.pitman = stb.SubtabName;
          renderPitmanList(stb.SubtabName);
        };
        container.appendChild(btn);
      });

      renderPitmanList(activeFilter);
    }

export function updateTypingWizardStepPills(activeStep = 1) {
      for (let i = 1; i <= 5; i++) {
        const pill = document.getElementById(`typing-pill-step-${i}`);
        if (!pill) continue;
        if (i < activeStep) {
          pill.style.background = 'rgba(16, 185, 129, 0.14)';
          pill.style.color = '#059669';
          pill.style.border = '1px solid rgba(16, 185, 129, 0.35)';
          pill.style.opacity = '1';
        } else if (i === activeStep) {
          pill.style.background = 'rgba(79, 70, 229, 0.14)';
          pill.style.color = 'var(--primary)';
          pill.style.border = '1px solid rgba(79, 70, 229, 0.35)';
          pill.style.opacity = '1';
        } else {
          pill.style.background = 'var(--surface)';
          pill.style.color = 'var(--text-muted)';
          pill.style.border = '1px solid var(--border)';
          pill.style.opacity = '0.6';
        }
      }
    }

export function setTypingExamDateToday() {
      const dateInput = document.getElementById('typing-select-date');
      if (!dateInput) return;
      dateInput.value = getLocalDateString();
      onTypingDateSelected();
    }

export let currentFeedbackPage = 1;

export const ITEMS_PER_PAGE = 2;

export async function handleFeedbackSubmit() {
      const category = document.getElementById('fb-category')?.value || 'Query';
      const priority = document.getElementById('fb-priority')?.value || 'Normal';
      const rawMessage = document.getElementById('fb-message')?.value || '';

      if (!rawMessage.trim()) {
        showToast('Feedback message cannot be empty.');
        return;
      }

      const formattedCategory = priority && priority !== 'Normal' ? `${category} [${priority}]` : category;
      const message = rawMessage.trim();

      const res = await apiCall('submitFeedback', {
        userId: portalState.currentUser ? portalState.currentUser.userId : 'GUEST',
        userName: portalState.currentUser ? portalState.currentUser.name : 'User',
        category: formattedCategory,
        message: message
      });

      if (!res || !res.success) {
        showToast((res && res.message) || 'Could not save feedback to Google Sheets. Please try again.');
        return;
      }

      showToast(res.message || '✅ Your feedback/query has been saved to the Support Desk!');
      const msgEl = document.getElementById('fb-message');
      if (msgEl) msgEl.value = '';
      currentFeedbackPage = 1;
      loadUserFeedback();
    }

export async function loadUserFeedback() {
      const container = document.getElementById('feedback-history-container');
      const totalBadge = document.getElementById('fb-user-total-badge');
      if (!container || !portalState.currentUser || !portalState.currentUser.userId) return;

      const curUid = String(portalState.currentUser.userId || '').trim();
      const getSyncedFallbackFeedback = () => {
        const pool = [
          ...(Array.isArray(portalState.globalData?.feedback) ? portalState.globalData.feedback : []),
          ...(Array.isArray(portalState.adminData?.feedback) ? portalState.adminData.feedback : [])
        ];
        return pool.filter(item => String(item.UserID || item.userId || '').trim().toLowerCase() === curUid.toLowerCase());
      };

      const renderFeedbackList = (rawList) => {
        let sortedList = [...rawList].sort((a, b) => new Date(b.SubmittedDate || b.submittedDate || 0) - new Date(a.SubmittedDate || a.submittedDate || 0));
        if (totalBadge) totalBadge.innerText = `${sortedList.length} Ticket${sortedList.length === 1 ? '' : 's'}`;

        if (_activeUserFeedbackStatusFilter === 'REPLIED') {
          sortedList = sortedList.filter(item => item.AdminResponse && String(item.AdminResponse).trim() !== '' && String(item.AdminResponse).trim() !== '-');
        } else if (_activeUserFeedbackStatusFilter === 'PENDING') {
          sortedList = sortedList.filter(item => !item.AdminResponse || String(item.AdminResponse).trim() === '' || String(item.AdminResponse).trim() === '-');
        }

        if (sortedList.length === 0) {
          container.innerHTML = `<div class="inline-data-load-status done" data-end-of-list="true" style="padding: 14px; border-radius: 10px; background: var(--background); border: 1px dashed var(--border); color: var(--text-muted); text-align: center; font-size: 13px;">No ${_activeUserFeedbackStatusFilter !== 'ALL' ? _activeUserFeedbackStatusFilter.toLowerCase() + ' ' : ''}tickets found. No more data.</div>`;
          return;
        }

        const totalPages = Math.ceil(sortedList.length / ITEMS_PER_PAGE) || 1;
        if (currentFeedbackPage > totalPages) currentFeedbackPage = totalPages;
        if (currentFeedbackPage < 1) currentFeedbackPage = 1;

        const startIndex = (currentFeedbackPage - 1) * ITEMS_PER_PAGE;
        const paginatedList = sortedList.slice(startIndex, startIndex + ITEMS_PER_PAGE);

        let htmlContent = paginatedList.map(item => {
          const hasReply = item.AdminResponse && String(item.AdminResponse).trim() !== '' && String(item.AdminResponse).trim() !== '-';
          const isUrgent = String(item.Category || '').toLowerCase().includes('urgent') || String(item.Category || '').toLowerCase().includes('high');
          return `
          <div class="feedback-card rp-stream-card-in" style="background: var(--background); border: 1px solid var(--border); border-left: 4px solid ${hasReply ? '#10b981' : (isUrgent ? '#ef4444' : 'var(--primary)')}; padding: 14px; margin-bottom: 12px; border-radius: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
              <span style="font-size: 11.5px; font-weight: 800; color: ${isUrgent ? '#dc2626' : 'var(--primary)'}; background: ${isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(37,99,235,0.1)'}; padding: 2px 9px; border-radius: 999px;">${escapeHtml(item.Category || 'Query')}</span>
              <span style="font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: ${hasReply ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}; color: ${hasReply ? '#059669' : '#d97706'};">
                ${hasReply ? '✅ Replied by Admin' : '⏳ Pending Review'}
              </span>
            </div>
            <p style="margin: 0 0 6px 0; font-size: 13.5px; color: var(--secondary); font-weight: 600;">${escapeHtml(item.Message || '-')}</p>
            <p style="margin: 0 0 10px 0;"><small style="color: var(--text-muted); font-size: 11px;">Submitted: ${escapeHtml(new Date(item.SubmittedDate || item.submittedDate || Date.now()).toLocaleString())}</small></p>
            <div class="admin-response" style="background: var(--surface); padding: 9px 12px; border-radius: 8px; border-left: 3px solid ${hasReply ? '#10b981' : 'var(--primary)'}; font-size: 12.5px;">
              <strong style="color: var(--secondary);"><i class="fa-solid fa-reply" style="color: var(--primary); margin-right: 4px;"></i>Admin Response:</strong>
              <span style="margin-left: 4px;">${hasReply ? escapeHtml(item.AdminResponse) : '<em style="color: var(--text-muted);">Waiting for official response...</em>'}</span>
            </div>
          </div>
        `;
        }).join('');

        if (totalPages > 1) {
          htmlContent += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
              <button class="btn btn-sm btn-secondary" onclick="changeFeedbackPage(-1)" ${currentFeedbackPage === 1 ? 'disabled style="opacity: 0.5;"' : ''}><i class="fa-solid fa-chevron-left"></i> Prev</button>
              <span style="font-size: 12.5px; font-weight: 700; color: var(--text-muted);">Page ${currentFeedbackPage} of ${totalPages}</span>
              <button class="btn btn-sm btn-secondary" onclick="changeFeedbackPage(1)" ${currentFeedbackPage === totalPages ? 'disabled style="opacity: 0.5;"' : ''}>Next <i class="fa-solid fa-chevron-right"></i></button>
            </div>
          `;
        } else {
          htmlContent += `<div class="inline-data-load-status done" data-end-of-list="true"><i class="fa-solid fa-circle-check" style="color:var(--text-muted);"></i> <span>No more data</span></div>`;
        }

        container.innerHTML = htmlContent;
      };

      try {
        const res = await apiCall('getFeedbackHistory', { userId: curUid }, true);
        const serverList = (res && res.success)
          ? (Array.isArray(res.feedbackList) ? res.feedbackList : (Array.isArray(res.feedbacks) ? res.feedbacks : (Array.isArray(res.data) ? res.data : [])))
          : getSyncedFallbackFeedback();
        renderFeedbackList(serverList);
      } catch (error) {
        const fallback = getSyncedFallbackFeedback();
        if (fallback.length > 0) {
          renderFeedbackList(fallback);
        } else {
          container.innerHTML = '<p style="color: var(--danger); font-size: 13px;">Failed to load feedback history.</p>';
        }
      }
    }

export function changeFeedbackPage(direction) {
      currentFeedbackPage += direction;
      loadUserFeedback();
    }

export function buildComparisonHeatmapHtml(snapshotObj) {
      const unwrapped = (snapshotObj && snapshotObj.keystrokeLatencySnapshot && typeof snapshotObj.keystrokeLatencySnapshot === 'object')
        ? snapshotObj.keystrokeLatencySnapshot
        : ((snapshotObj && snapshotObj.id && !snapshotObj.keystrokeLatencySnapshot) ? null : snapshotObj);
      const statsMap = (unwrapped && typeof unwrapped === 'object' && Object.keys(unwrapped).length > 0)
        ? unwrapped
        : (window.keystrokeLatencyStatsMap || {});
      const entries = Object.entries(statsMap).map(([k, v]) => ({
        key: k,
        count: v.count || 1,
        avgMs: Math.round((v.totalMs || 150) / Math.max(1, v.count || 1))
      }));

      let overallAvg = 0;
      if (entries.length > 0) {
        const totalAllMs = Object.values(statsMap).reduce((acc, v) => acc + (v.totalMs || 0), 0);
        const totalAllCount = Object.values(statsMap).reduce((acc, v) => acc + (v.count || 0), 0);
        overallAvg = Math.round(totalAllMs / Math.max(1, totalAllCount));
      }

      let rhythmPct = 96;
      const intervals = window.lastSubmittedHeatmapIntervals || window.recentKeystrokeIntervalsMs || [];
      if (intervals.length >= 3) {
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? (stdDev / mean) : 0;
        rhythmPct = Math.max(40, Math.min(100, Math.round((1 - Math.min(0.85, cv * 0.75)) * 100)));
      }

      const sortedBySlowest = [...entries].sort((a, b) => b.avgMs - a.avgMs);
      const sortedByFastest = [...entries].sort((a, b) => a.avgMs - b.avgMs);
      const slowestText = sortedBySlowest.slice(0, 4).map(i => `${i.key} (${i.avgMs}ms)`).join(', ') || 'Steady across all keys';
      const fastestText = sortedByFastest.slice(0, 4).map(i => `${i.key} (${i.avgMs}ms)`).join(', ') || 'Balanced keystrokes';
      const isEnabled = window.isComparisonHeatmapVisible !== false;

      const chipsHtml = sortedBySlowest.length === 0
        ? `<span style="font-size: 11.5px; color: var(--text-muted);">Keystroke latency telemetry automatically captured during active tests. Type in any test to see per-key latency distribution chips here.</span>`
        : sortedBySlowest.slice(0, 18).map(item => {
            const isFast = item.avgMs < 160;
            const isMid = item.avgMs >= 160 && item.avgMs <= 280;
            const bg = isFast ? 'rgba(16,185,129,0.14)' : (isMid ? 'rgba(245,158,11,0.16)' : 'rgba(239,68,68,0.16)');
            const border = isFast ? '#10b981' : (isMid ? '#f59e0b' : '#ef4444');
            const color = isFast ? '#059669' : (isMid ? '#d97706' : '#dc2626');
            return `<span style="display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:6px; font-size:11px; font-weight:800; background:${bg}; border:1px solid ${border}; color:${color};">
              <span>${item.key}</span>
              <span style="font-size:10px; opacity:0.9;">${item.avgMs}ms (${item.count}x)</span>
            </span>`;
          }).join('');

      return `
        <div id="comparison-rhythm-heatmap-card" style="background: linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(16,185,129,0.08) 100%); border: 1.5px solid rgba(245,158,11,0.35); border-radius: 12px; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="font-size: 12.5px; font-weight: 800; color: var(--secondary); display: inline-flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-fire-flame-curved" style="color: #f59e0b;"></i> Rhythm &amp; Finger-Latency Heatmap Analysis (Automatically Recorded)
              </span>
              <span style="font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: rgba(16,185,129,0.15); color: #059669;">🟢 Fast (&lt;160ms)</span>
              <span style="font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: rgba(245,158,11,0.16); color: #d97706;">🟡 Medium (160–280ms)</span>
              <span style="font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: rgba(239,68,68,0.16); color: #dc2626;">🔴 Slow (&gt;280ms)</span>
            </div>
            <button type="button" id="comparison-heatmap-toggle-btn" class="btn btn-sm" style="padding: 4px 12px; font-size: 11px; font-weight: 800; background: var(--surface); border: 1.5px solid ${isEnabled ? '#10b981' : '#94a3b8'}; color: ${isEnabled ? '#059669' : 'var(--text-muted)'}; border-radius: 999px;" onclick="toggleComparisonModalHeatmap()">
              <i class="fa-solid fa-fire-flame-curved"></i> Rhythm &amp; Latency Heatmap: <span id="comparison-heatmap-state-txt">${isEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <div id="comparison-heatmap-body-panel" style="display: ${isEnabled ? 'flex' : 'none'}; flex-direction: column; gap: 8px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)); gap: 8px;">
              <div style="background: var(--surface); padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border); font-size: 11.5px;">
                <span style="color: var(--text-muted); font-weight: 700;">Avg Key Latency:</span>
                <strong style="color: var(--primary); margin-left: 4px;">${overallAvg > 0 ? overallAvg + ' ms' : '142 ms'}</strong>
              </div>
              <div style="background: var(--surface); padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border); font-size: 11.5px;">
                <span style="color: var(--text-muted); font-weight: 700;">Rhythm Steadiness:</span>
                <strong style="color: #059669; margin-left: 4px;">${rhythmPct}% Steady</strong>
              </div>
              <div style="background: var(--surface); padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border); font-size: 11.5px;">
                <span style="color: var(--text-muted); font-weight: 700;">Slowest Keys:</span>
                <strong style="color: #dc2626; margin-left: 4px;">${slowestText}</strong>
              </div>
              <div style="background: var(--surface); padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border); font-size: 11.5px;">
                <span style="color: var(--text-muted); font-weight: 700;">Fastest Keys:</span>
                <strong style="color: #16a34a; margin-left: 4px;">${fastestText}</strong>
              </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; background: var(--surface); padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border);">
              ${chipsHtml}
            </div>
          </div>
        </div>
      `;
    }

window.isComparisonHeatmapVisible = true;

export function toggleComparisonModalHeatmap() {
      window.isComparisonHeatmapVisible = !window.isComparisonHeatmapVisible;
      const bodyEl = document.getElementById('comparison-heatmap-body-panel');
      const btnEl = document.getElementById('comparison-heatmap-toggle-btn');
      const txtEl = document.getElementById('comparison-heatmap-state-txt');
      if (bodyEl) bodyEl.style.display = window.isComparisonHeatmapVisible ? 'flex' : 'none';
      if (txtEl) txtEl.innerText = window.isComparisonHeatmapVisible ? 'ON' : 'OFF';
      if (btnEl) {
        btnEl.style.borderColor = window.isComparisonHeatmapVisible ? '#10b981' : '#94a3b8';
        btnEl.style.color = window.isComparisonHeatmapVisible ? '#059669' : 'var(--text-muted)';
      }
    }

export function switchAdminBatchDiscussionSection(mode, btnEl) {
      const raw = String(mode || 'discussion').trim().toLowerCase();
      const normalized = (raw === 'board' || raw === 'discussion') ? 'discussion' : (raw === 'pads' ? 'pads' : 'all');
      document.querySelectorAll('#admin-sub-batch-discussion [data-bd-view], #admin-sub-batch-discussion .admin-bdisc-sub-btn').forEach(b => {
        const target = String(b.getAttribute('data-bd-view') || b.getAttribute('data-bdisc-sec') || '').trim().toLowerCase();
        const normTarget = target === 'board' ? 'discussion' : target;
        b.classList.toggle('active', b === btnEl || normTarget === normalized);
      });
      const boardCard = document.getElementById('admin-realtime-batch-discussion-card');
      const padsCard = document.getElementById('admin-shorthand-pads-review-card');
      if (boardCard) boardCard.style.display = (normalized === 'discussion' || normalized === 'all') ? '' : 'none';
      if (padsCard) padsCard.style.display = (normalized === 'pads' || normalized === 'all') ? '' : 'none';
      if ((normalized === 'pads' || normalized === 'all')) {
        if (typeof window.renderAdminShorthandPadsReview === 'function') {
          try { window.renderAdminShorthandPadsReview(false); } catch (e) {}
        } else if (typeof window.loadShorthandPadsFromServer === 'function') {
          try { window.loadShorthandPadsFromServer('admin', false); } catch (e) {}
        }
      }
    }

export function switchAdminInnerSubtab(sectionKey, subKey) {
      const mode = subKey || 'all';
      document.querySelectorAll('.admin-' + sectionKey + '-sub-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-sub') === mode);
      });

      if (sectionKey === 'content') {
        const upCard = document.getElementById('admin-content-upload-card');
        const catCard = document.getElementById('admin-content-catalog-card');
        if (upCard) upCard.style.display = (mode === 'all' || mode === 'upload') ? '' : 'none';
        if (catCard) catCard.style.display = (mode === 'all' || mode === 'catalog') ? '' : 'none';
      } else if (sectionKey === 'users') {
        if (typeof populateAdminValidityTargetDropdown === 'function') {
          try { populateAdminValidityTargetDropdown(); } catch (e) {}
        }
        const dirCard = document.getElementById('admin-users-directory-card');
        const validityCard = document.getElementById('admin-validity-and-parent-report-card');
        const batchesSec = document.getElementById('admin-users-batches-section');
        if (dirCard) dirCard.style.display = (mode === 'all' || mode === 'directory') ? '' : 'none';
        if (validityCard) validityCard.style.display = (mode === 'all' || mode === 'validity') ? '' : 'none';
        if (batchesSec) batchesSec.style.display = (mode === 'all' || mode === 'batches') ? '' : 'none';
      } else if (sectionKey === 'evaluation') {
        const bCard = document.getElementById('admin-eval-builder-card');
        const evalForm = document.getElementById('admin-eval-form') || (bCard ? bCard.querySelector('form') : null);
        const dirSec = document.getElementById('admin-eval-rules-directory-section') || document.getElementById('admin-eval-saved-card');
        if (bCard) bCard.style.display = '';
        if (evalForm) evalForm.style.display = (mode === 'all' || mode === 'builder') ? '' : 'none';
        if (dirSec) dirSec.style.display = (mode === 'all' || mode === 'saved') ? '' : 'none';
      } else if (sectionKey === 'banner') {
        const dashCard = document.getElementById('admin-banner-dashpromo-card');
        const topCard = document.getElementById('admin-banner-top-card');
        const maintCard = document.getElementById('admin-banner-maintenance-card');
        if (dashCard) dashCard.style.display = (mode === 'all' || mode === 'dashpromo') ? '' : 'none';
        if (topCard) topCard.style.display = (mode === 'all' || mode === 'topbanner') ? '' : 'none';
        if (maintCard) maintCard.style.display = (mode === 'all' || mode === 'maintenance') ? '' : 'none';
      } else if (sectionKey === 'enterprise') {
        const pOnboard = document.getElementById('admin-enterprise-onboarding-panel');
        const pWebhook = document.getElementById('admin-enterprise-webhook-panel');
        const pFee = document.getElementById('admin-enterprise-fee-panel');
        const pBranches = document.getElementById('admin-enterprise-branches-panel');
        if (pOnboard) pOnboard.style.display = (mode === 'all' || mode === 'onboarding') ? '' : 'none';
        if (pWebhook) pWebhook.style.display = (mode === 'all' || mode === 'onboarding') ? '' : 'none';
        if (pFee) pFee.style.display = (mode === 'all' || mode === 'branches') ? '' : 'none';
        if (pBranches) pBranches.style.display = (mode === 'all' || mode === 'branches') ? '' : 'none';
      }
    }

onDomReady(() => {
      try {
        switchDashboardFocusTab('overview');
        switchAdminInnerSubtab('content', 'all');
        switchAdminInnerSubtab('users', 'directory');
        switchAdminInnerSubtab('evaluation', 'all');
        if (typeof window.resetBannerPromoCardSelection === 'function') {
          window.resetBannerPromoCardSelection();
        }
        switchAdminInnerSubtab('enterprise', 'all');
        switchAdminBatchDiscussionSection('board', null);
      } catch (e) {}
    });

export function autoResetAdminFiltersOnSearch(inputId) {
      switch (inputId) {
        case 'admin-search-users': {
          const rEl = document.getElementById('admin-filter-user-role');
          const sEl = document.getElementById('admin-filter-user-status');
          const bEl = document.getElementById('admin-filter-user-batch');
          let changed = false;
          if (rEl && rEl.value !== 'ALL') { rEl.value = 'ALL'; changed = true; }
          if (sEl && sEl.value !== 'ALL') { sEl.value = 'ALL'; changed = true; }
          if (bEl && bEl.value !== 'ALL') { bEl.value = 'ALL'; changed = true; }
          if (changed) {
            portalState.currentAdminUserPage = 1;
            renderAdminUsers();
          }
          break;
        }
        case 'admin-batch-chip-search-input': {
          const bEl = document.getElementById('admin-filter-user-batch');
          const rEl = document.getElementById('admin-filter-user-role');
          const sEl = document.getElementById('admin-filter-user-status');
          if (bEl && bEl.value !== 'ALL') bEl.value = 'ALL';
          if (rEl && rEl.value !== 'ALL') rEl.value = 'ALL';
          if (sEl && sEl.value !== 'ALL') sEl.value = 'ALL';
          break;
        }
        case 'admin-search-materials': {
          const tEl = document.getElementById('admin-filter-material-type');
          if (tEl && tEl.value !== 'ALL') {
            tEl.value = 'ALL';
            portalState.currentAdminMaterialPage = 1;
            renderAdminMaterialsTable();
          }
          break;
        }
        case 'admin-search-logs': {
          const lEl = document.getElementById('admin-filter-log-type');
          if (lEl && lEl.value !== 'ALL') {
            lEl.value = 'ALL';
            portalState.logsPage = 1;
            renderAdminLogs();
          }
          break;
        }
        case 'admin-search-subtabs': {
          const stEl = document.getElementById('admin-filter-subtab-type');
          if (stEl && stEl.value !== 'ALL') {
            stEl.value = 'ALL';
            portalState.currentAdminSubtabPage = 1;
            renderAdminSubtabsTable();
          }
          break;
        }
        case 'admin-search-eval-rules': {
          const ecEl = document.getElementById('admin-filter-eval-category');
          if (ecEl && ecEl.value !== 'ALL') {
            ecEl.value = 'ALL';
            portalState.currentEvalRulesPage = 1;
            renderAdminEvaluationRulesTable();
          }
          break;
        }
        case 'admin-search-leaderboard': {
          const catEl = document.getElementById('admin-filter-leaderboard-category');
          const statEl = document.getElementById('admin-filter-leaderboard-status');
          const dateEl = document.getElementById('admin-leaderboard-date');
          let changed = false;
          if (catEl && catEl.value !== 'ALL') { catEl.value = 'ALL'; changed = true; }
          if (statEl && statEl.value !== 'ALL') { statEl.value = 'ALL'; changed = true; }
          if (dateEl && dateEl.value !== '') {
            dateEl.dataset.initializedOnce = 'true';
            dateEl.value = '';
            changed = true;
          }
          if (changed) {
            portalState.currentAdminLeaderboardPage = 1;
            renderAdminLeaderboard();
          }
          break;
        }
        case 'admin-search-feedback': {
          const catEl = document.getElementById('admin-filter-feedback-category');
          const statEl = document.getElementById('admin-filter-feedback-status');
          let changed = false;
          if (catEl && catEl.value !== 'ALL') { catEl.value = 'ALL'; changed = true; }
          if (statEl && statEl.value !== 'ALL') { statEl.value = 'ALL'; changed = true; }
          if (changed) {
            portalState.currentAdminFeedbackPage = 1;
            renderAdminFeedback();
          }
          break;
        }
        case 'admin-batch-discussion-search': {
          const batchSel = document.getElementById('admin-batch-discussion-batch-select') || document.getElementById('admin-batch-discussion-select');
          let changed = false;
          if (batchSel && batchSel.value !== 'ALL') {
            batchSel.value = 'ALL';
            changed = true;
          }
          if (window._activeAdminBatchDiscussionCategory && window._activeAdminBatchDiscussionCategory !== 'ALL') {
            window._activeAdminBatchDiscussionCategory = 'ALL';
            document.querySelectorAll('#admin-batch-discussion-filter-bar button').forEach(btn => {
              const isAll = btn.getAttribute('data-bdisc-cat') === 'ALL';
              btn.className = isAll ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
            });
            changed = true;
          }
          if (changed && typeof renderAdminBatchDiscussionBoard === 'function') {
            renderAdminBatchDiscussionBoard();
          }
          break;
        }
      }
    }

export function resetAllFiltersForSearchInput(inputId) {
      const inp = document.getElementById(inputId);
      if (inp) inp.value = '';

      switch (inputId) {
        case 'pdf-search-input':
          portalState.currentSubtabFilter.pdf = 'ALL';
          window.currentPdfPage = 1;
          if (typeof renderSubtabs === 'function') renderSubtabs('pdf');
          if (typeof renderMaterialsList === 'function') renderMaterialsList('pdf', 'ALL');
          break;
        case 'pitman-search-input':
          portalState.currentSubtabFilter.pitman = 'ALL';
          window.currentPitmanPage = 1;
          if (typeof renderPitmanSubtabs === 'function') renderPitmanSubtabs();
          if (typeof renderPitmanList === 'function') renderPitmanList('ALL');
          break;
        case 'audio-search-input':
          portalState.currentSubtabFilter.audio = 'ALL';
          window.currentAudioPage = 1;
          if (typeof renderSubtabs === 'function') renderSubtabs('audio');
          if (typeof renderMaterialsList === 'function') renderMaterialsList('audio', 'ALL');
          break;
        case 'words-search':
        case 'words-search-input': {
          const wInp = document.getElementById('words-search');
          if (wInp) wInp.value = '';
          if (typeof portalState.selectedAlphabet !== 'undefined') portalState.selectedAlphabet = 'ALL';
          window.currentWordLetter = 'ALL';
          window.currentWordsPage = 1;
          if (typeof buildAlphabetBar === 'function') buildAlphabetBar();
          if (typeof renderWords === 'function') renderWords();
          break;
        }
        case 'typingtest-search-input':
          portalState.currentSubtabFilter.typingtest = 'ALL';
          window.currentTypingTestPage = 1;
          if (typeof filterTypingWizardPassagesDropdown === 'function') filterTypingWizardPassagesDropdown();
          break;
        case 'learning-exercise-search-input':
          portalState.currentSubtabFilter.learningtyping = 'ALL';
          window.currentLearningExercisePage = 1;
          if (typeof renderLearningUploadedExercisesGrid === 'function') renderLearningUploadedExercisesGrid();
          break;
        case 'cbttest-search-input':
          portalState.currentSubtabFilter.cbttest = 'ALL';
          window.currentCbtTestPage = 1;
          if (typeof renderCbtTestCatalog === 'function') renderCbtTestCatalog();
          break;
        case 'videocourse-search-input':
          portalState.currentSubtabFilter.videocourse = 'ALL';
          window.currentVideoCoursePage = 1;
          if (typeof renderVideoCourseView === 'function') renderVideoCourseView();
          break;
        case 'history-search-input':
        case 'user-history-search': {
          const hInp = document.getElementById('history-search-input');
          if (hInp) hInp.value = '';
          const catEl = document.getElementById('history-type-filter') || document.getElementById('history-category-filter');
          if (catEl) catEl.value = 'ALL';
          portalState.currentHistoryPage = 1;
          window.currentTestHistoryPage = 1;
          if (typeof renderTestHistoryTable === 'function') renderTestHistoryTable();
          break;
        }
        case 'admin-search-users':
        case 'admin-user-search-input': {
          const uInp = document.getElementById('admin-search-users');
          if (uInp) uInp.value = '';
          autoResetAdminFiltersOnSearch('admin-search-users');
          portalState.currentAdminUserPage = 1;
          renderAdminUsers();
          break;
        }
        case 'admin-batch-chip-search-input': {
          autoResetAdminFiltersOnSearch('admin-batch-chip-search-input');
          populateAllBatchSelectDropdowns();
          renderAdminUsers();
          break;
        }
        case 'admin-search-materials':
        case 'admin-materials-search': {
          const mInp = document.getElementById('admin-search-materials');
          if (mInp) mInp.value = '';
          autoResetAdminFiltersOnSearch('admin-search-materials');
          portalState.currentAdminMaterialPage = 1;
          renderAdminMaterialsTable();
          break;
        }
        case 'admin-search-subtabs':
        case 'admin-subtabs-search': {
          const sInp = document.getElementById('admin-search-subtabs');
          if (sInp) sInp.value = '';
          autoResetAdminFiltersOnSearch('admin-search-subtabs');
          portalState.currentAdminSubtabPage = 1;
          renderAdminSubtabsTable();
          break;
        }
        case 'admin-search-eval-rules': {
          autoResetAdminFiltersOnSearch('admin-search-eval-rules');
          portalState.currentEvalRulesPage = 1;
          renderAdminEvaluationRulesTable();
          break;
        }
        case 'admin-search-leaderboard':
        case 'admin-leaderboard-search': {
          const lbInp = document.getElementById('admin-search-leaderboard');
          if (lbInp) lbInp.value = '';
          autoResetAdminFiltersOnSearch('admin-search-leaderboard');
          portalState.currentAdminLeaderboardPage = 1;
          renderAdminLeaderboard();
          break;
        }
        case 'admin-search-logs':
        case 'admin-logs-search': {
          const lgInp = document.getElementById('admin-search-logs');
          if (lgInp) lgInp.value = '';
          autoResetAdminFiltersOnSearch('admin-search-logs');
          portalState.logsPage = 1;
          renderAdminLogs();
          break;
        }
        case 'admin-search-feedback':
        case 'admin-feedback-search': {
          const fbInp = document.getElementById('admin-search-feedback');
          if (fbInp) fbInp.value = '';
          autoResetAdminFiltersOnSearch('admin-search-feedback');
          portalState.currentAdminFeedbackPage = 1;
          renderAdminFeedback();
          break;
        }
        case 'admin-batch-discussion-search': {
          autoResetAdminFiltersOnSearch('admin-batch-discussion-search');
          renderAdminBatchDiscussionBoard();
          break;
        }
      }
      showToast('🔄 All filters reset to ALL — searching across 100% of records.');
    }

export function bindUniversalSearchIconResetButtons() {
      // Unified single-icon search: do NOT inject a second .universal-search-icon-btn;
      // only strip leading 🔍 emojis and bind focus filter-reset. initExpandableSearchControls() renders the single expandable icon.
      const searchInputIds = [
        'pdf-search-input',
        'pitman-search-input',
        'audio-search-input',
        'words-search',
        'typingtest-search-input',
        'learning-exercise-search-input',
        'cbttest-search-input',
        'videocourse-search-input',
        'history-search-input',
        'weak-vault-search-input',
        'admin-search-users',
        'admin-batch-chip-search-input',
        'admin-search-materials',
        'admin-search-subtabs',
        'admin-search-eval-rules',
        'admin-search-leaderboard',
        'admin-search-logs',
        'admin-search-feedback',
        'admin-batch-discussion-search'
      ];

      searchInputIds.forEach(id => {
        const inp = document.getElementById(id);
        if (!inp || inp.dataset.searchIconBound === 'true') return;
        inp.dataset.searchIconBound = 'true';

        const rawPh = inp.getAttribute('placeholder') || 'Search...';
        inp.setAttribute('placeholder', rawPh.replace(/^🔍\s*/, ''));

        inp.addEventListener('focus', () => autoResetAdminFiltersOnSearch(id));
      });
    }

if (document.readyState === 'loading') {
      onDomReady(bindUniversalSearchIconResetButtons);
    } else {
      setTimeout(bindUniversalSearchIconResetButtons, 50);
    }

window.addEventListener('message', (event) => {
      if (event.data && (event.data.type === 'SET_RP_THEME' || event.data.type === 'SET_RP_SKILL_THEME')) {
        applyAppTheme(event.data.theme);
      }
    });

window.prefillHelpFeedbackTemplate = function(category, templateText) {
    if (typeof window.navigateTo === 'function' && portalState.activeTab !== 'feedback') {
      window.navigateTo('feedback', true, false);
    }
    ensureHelpDeskFeedbackFormVisible();

    setTimeout(() => {
      ensureHelpDeskFeedbackFormVisible();
      const catEl = document.getElementById('fb-category');
      const msgEl = document.getElementById('fb-message');
      if (catEl && category) catEl.value = category;
      if (msgEl && templateText) {
        msgEl.value = templateText;
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        msgEl.focus();
      }
      if (typeof showToast === 'function') {
        showToast('Switched to Help Desk! Complete your message below and click Submit.');
      }
    }, 60);
  };

window.switchHelpTabSection = function(mode, btn) {
    if (typeof window.navigateTo === 'function' && portalState.activeTab !== 'feedback') {
      window.navigateTo('feedback', true, false);
    }
    ensureHelpDeskFeedbackFormVisible();
    if (mode === 'contacts') {
      setTimeout(() => {
        const ctCard = document.getElementById('help-section-contacts-card');
        if (ctCard) ctCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  };

export function isCbtSectionAutoLockActive() {
    if (!portalState.activeCbtTest) return false;
    const sections = [...new Set((portalState.activeCbtTest.questions || []).map(q => q.section))];
    if (sections.length <= 1) return false;
    return Boolean(
      portalState.activeCbtTest.cbtTimerMode === 'sectional' &&
      portalState.activeCbtTest.cbtSectionLockMode !== 'free_unlocked'
    );
  }



window.renderBatchShorthandDoubtWall = function() {
    const container = document.getElementById('batch-shorthand-doubt-wall-container');
    if (!container || !portalState.currentUser) return;
    const uid = String(portalState.currentUser.userId || '').trim();
    const roleLower = String(portalState.currentUser.role || '').toLowerCase();
    const isAdminUser = ['admin', 'superadmin', 'instructor'].includes(roleLower);
    const monitorBatches = typeof getUserMonitorBatchesList === 'function' ? getUserMonitorBatchesList(uid) : [];
    const userMemberBatches = typeof getUserAssignedBatchesList === 'function'
      ? getUserAssignedBatchesList(uid, portalState.currentUser.batch || portalState.currentUser.Batch || '')
      : [portalState.currentUser.batch || 'RP-Trail'];
    const allowedBatches = isAdminUser
      ? (typeof getInstituteBatchesList === 'function' ? getInstituteBatchesList() : userMemberBatches)
      : Array.from(new Set([...monitorBatches, ...userMemberBatches])).filter(Boolean);

    const activeBatch = window.currentDashboardMonitoredBatch && allowedBatches.includes(window.currentDashboardMonitoredBatch)
      ? window.currentDashboardMonitoredBatch
      : (monitorBatches[0] || allowedBatches[0] || 'RP-Trail');

    const isMonitorForBatch = isAdminUser || monitorBatches.some(mb => String(mb).toLowerCase() === String(activeBatch).toLowerCase());
    const cuNameLow = String(portalState.currentUser.name || '').toLowerCase().trim();
    const allItems = (window.__enterpriseSuiteState && Array.isArray(window.__enterpriseSuiteState.doubtWallItems))
      ? window.__enterpriseSuiteState.doubtWallItems
      : [];
    const filteredItems = allItems.filter(it => {
      const b = String(it.batch || 'RP-Trail').trim();
      const sameBatch = b.toLowerCase() === String(activeBatch).toLowerCase() &&
        (isAdminUser || allowedBatches.some(ab => ab.toLowerCase() === b.toLowerCase()));
      if (!sameBatch) return false;
      if (isMonitorForBatch) return true;
      const authorId = String(it.authorId || it.userId || '').trim();
      const authorNameLow = String(it.author || '').toLowerCase().trim();
      return (authorId && authorId === uid) || (cuNameLow && authorNameLow === cuNameLow);
    });

    container.innerHTML = `
      <div style="background: var(--surface); border: 1.5px solid rgba(13, 148, 136, 0.35); border-radius: 12px; padding: 12px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
          <div>
            <div style="font-size: 13px; font-weight: 900; color: var(--secondary); display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-pen-nib" style="color: #0d9488;"></i> ${isMonitorForBatch ? 'Batch Shorthand Doubt Desk' : 'My Shorthand Outline Doubts'} — <span style="color:#0d9488;">${window.escapeHtml(activeBatch)}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${isMonitorForBatch ? `Monitor / Admin view for all shorthand doubts in <strong>${window.escapeHtml(activeBatch)}</strong>.` : `Your personal outline doubts and Monitor replies for <strong>${window.escapeHtml(activeBatch)}</strong>.`}</div>
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <input type="text" id="doubt-wall-new-word" placeholder="Ask a word outline in ${window.escapeHtml(activeBatch)}..." style="padding: 6px 10px; font-size: 11.5px; border: 1px solid var(--border); border-radius: 8px; min-width: 220px; background: var(--background); color: var(--text-main);">
            <button type="button" class="btn btn-sm" style="background: #0d9488; color: #fff; border: none; font-size: 11px; font-weight: 800; padding: 6px 12px; border-radius: 8px;" onclick="postShorthandDoubtWord()">
              <i class="fa-solid fa-plus"></i> Post to ${window.escapeHtml(activeBatch)}
            </button>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
          ${filteredItems.length === 0 ? `<div style="grid-column: 1 / -1; text-align: center; padding: 14px; font-size: 12px; color: var(--text-muted); background: var(--background); border: 1px dashed var(--border); border-radius: 10px;">No shorthand outline doubts posted in <strong>${window.escapeHtml(activeBatch)}</strong> yet.</div>` : filteredItems.map((item) => `
            <div style="background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="font-size: 12px; font-weight: 900; color: #0f766e;">"${window.escapeHtml(item.word)}"</span>
                <span style="font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px; background: rgba(13,148,136,0.12); color: #0d9488;">${window.escapeHtml(item.batch)}</span>
              </div>
              <div style="font-size: 10.5px; color: var(--text-muted); margin-bottom: 6px;">Asked by <strong>${window.escapeHtml(item.author)}</strong></div>
              ${(item.replies || []).map(r => `
                <div style="font-size: 11px; background: var(--surface); padding: 5px 8px; border-radius: 6px; border-left: 3px solid #0d9488; margin-bottom: 4px;">
                  <strong style="color: #0d9488;">${window.escapeHtml(r.by)}:</strong> ${window.escapeHtml(r.note)}
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };



export function makeCommandDeckShowAllData() {
    ['dashboard-subview-organizer-card', 'dashboard-subview-tabs-bar', 'dashboard-focus-subtab-bar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const showBlockIds = [
      'dashboard-analytics-hub-card',
      'dashboard-toppers-leaderboard-card',
      'dashboard-video-tutorials-card',
      'ai-coach-banner',
      'dashboard-parent-guardian-summary-bar',
      'dashboard-alumni-hall-of-fame-bar',
      'dashboard-pinned-directives-card'
    ];
    showBlockIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'block';
    });

    const hwRow = document.getElementById('dashboard-homework-announcements-row');
    if (hwRow) hwRow.style.display = 'grid';
  }

window.switchDashboardFocusTab = function() {
    makeCommandDeckShowAllData();
  };

export function setupDedicatedTabsAndMoveSections() {
    const authTabsList = document.getElementById('menu-authenticated-tabs-list');
    const mainContainer = document.getElementById('app-viewport') || document.querySelector('main') || document.body;
    if (!mainContainer) return;

    if (typeof ALL_STUDENT_PORTAL_TABS !== 'undefined' && Array.isArray(ALL_STUDENT_PORTAL_TABS)) {
      ['weak-vault', 'planner-goals', 'batchhub', 'cbt-revision'].forEach(t => {
        if (!ALL_STUDENT_PORTAL_TABS.includes(t)) ALL_STUDENT_PORTAL_TABS.push(t);
      });
      const oldOffIdx = ALL_STUDENT_PORTAL_TABS.indexOf('official-contacts');
      if (oldOffIdx !== -1) ALL_STUDENT_PORTAL_TABS.splice(oldOffIdx, 1);
    }
    if (typeof TAB_DISPLAY_META !== 'undefined' && TAB_DISPLAY_META) {
      TAB_DISPLAY_META['weak-vault'] = { icon: '🔐', label: 'My Weak Outlines Vault' };
      TAB_DISPLAY_META['planner-goals'] = { icon: '📅', label: '7-Day Planner & Goals' };
      TAB_DISPLAY_META['batchhub'] = { icon: '🏫', label: 'Batch Monitor & Polls' };
      TAB_DISPLAY_META['cbt-revision'] = { icon: '🗂️', label: 'Saved MCQs & Error Logbook' };
      delete TAB_DISPLAY_META['official-contacts'];
    }

    if (authTabsList) {
      const insertNavLiAfter = (newTabId, labelHtml, afterTabId) => {
        if (authTabsList.querySelector(`[data-tab="${newTabId}"]`)) return;
        const li = document.createElement('li');
        li.innerHTML = `<button type="button" class="nav-tab-btn" data-tab="${newTabId}" onclick="navigateTo('${newTabId}', true, true)"><span>${labelHtml}</span></button>`;
        const refBtn = authTabsList.querySelector(`[data-tab="${afterTabId}"]`);
        const refLi = refBtn ? refBtn.closest('li') : null;
        if (refLi && refLi.nextSibling) {
          authTabsList.insertBefore(li, refLi.nextSibling);
        } else {
          authTabsList.appendChild(li);
        }
      };

      insertNavLiAfter('planner-goals', '📅 7-Day Planner &amp; Goals', 'dashboard');
      insertNavLiAfter('batchhub', '🏫 Batch Monitor &amp; Communication', 'planner-goals');
      insertNavLiAfter('weak-vault', '🔐 My Weak Outlines Vault', 'words');
      insertNavLiAfter('cbt-revision', '🗂️ Saved MCQs &amp; Error Logbook', 'cbttest');

      // Remove deleted Official Dedicated Directory menu item if any exists
      const obsoleteOffBtn = authTabsList.querySelector('[data-tab="official-contacts"]');
      if (obsoleteOffBtn) obsoleteOffBtn.closest('li')?.remove();

      if (portalState.currentUser && typeof applyStudentPortalTabPermissions === 'function') {
        applyStudentPortalTabPermissions();
      }
    }

    // Remove deleted Official Dedicated Directory section cleanly; keep contacts inside Help & Contact (#view-feedback)
    const obsoleteOffSec = document.getElementById('view-official-contacts');
    if (obsoleteOffSec) obsoleteOffSec.remove();

    // Requirement #8: Remove duplicate quick-jump navigation bar & duplicate admin subtab category cards
    const dupQuickBar = document.getElementById('rp-student-quick-jump-bar');
    if (dupQuickBar) dupQuickBar.remove();
    const dupAdminOrg = document.getElementById('rp-admin-category-organizer');
    if (dupAdminOrg) dupAdminOrg.remove();

    // Attach an optional, non-intrusive Full Screen toggle inside #admin-evaluation-subtab-bar (never auto-fullscreen)
    const oldEvalFsBar = document.getElementById('rp-admin-eval-fullscreen-bar');
    if (oldEvalFsBar) oldEvalFsBar.remove();
    const evalSubtabBar = document.getElementById('admin-evaluation-subtab-bar');
    if (evalSubtabBar && !document.getElementById('rp-admin-eval-fs-btn')) {
      const fsBtn = document.createElement('button');
      fsBtn.type = 'button';
      fsBtn.id = 'rp-admin-eval-fs-btn';
      fsBtn.className = 'section-subtab-btn';
      fsBtn.style.marginLeft = 'auto';
      fsBtn.innerHTML = '⛶ Full Screen';
      fsBtn.onclick = function() {
        window.toggleElementFullScreenMode('admin-sub-evaluation', fsBtn);
      };
      evalSubtabBar.appendChild(fsBtn);
    }

    ensureHelpDeskFeedbackFormVisible();

    // =========================================================================
    // REQUIREMENT #6: NEW TAB FOR "MY WEAK OUTLINES VAULT" (#view-weak-vault)
    // =========================================================================
    if (!document.getElementById('view-weak-vault')) {
      const vaultSec = document.createElement('section');
      vaultSec.id = 'view-weak-vault';
      vaultSec.className = 'app-view';
      vaultSec.style.display = 'none';
      vaultSec.innerHTML = `
        <div style="max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
          <div class="card" style="border-top: 4px solid #e11d48; padding: 18px 20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
              <div>
                <div style="font-size:11px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#be123c; margin-bottom:4px;">SHORTHAND RECOVERY WORKSPACE</div>
                <h3 style="margin:0 0 4px 0; font-size:20px; font-weight:900; color:var(--secondary);">My Weak Outlines Vault</h3>
                <p style="margin:0; font-size:12.5px; color:var(--text-muted); max-width:680px;">Missed or misspelled words from your Dictation &amp; Typing tests are saved here automatically. Select any word on the left to inspect its Pitman stroke and practice typing it 5 times to mark it mastered.</p>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-primary btn-sm" style="background:#e11d48; border:none; font-weight:800;" onclick="if(typeof launchWeakOutlinesCustomDrill==='function') launchWeakOutlinesCustomDrill();">
                  <i class="fa-solid fa-play"></i> Practice Weak Words Drill
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="navigateTo('words')">
                  <i class="fa-solid fa-book"></i> Open Words &amp; Outlines
                </button>
                <button type="button" class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="if(typeof window.clearAllWeakOutlinesVault==='function') window.clearAllWeakOutlinesVault();">
                  <i class="fa-solid fa-trash-can"></i> Clear Vault
                </button>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; padding-top:12px; border-top:1px solid var(--border);">
              <div style="padding:10px 14px; border-radius:10px; background:var(--background); border:1px solid var(--border);">
                <div style="font-size:11px; font-weight:700; color:var(--text-muted);">Total Saved Words</div>
                <div id="weak-vault-kpi-total" style="font-size:22px; font-weight:900; color:var(--secondary); font-variant-numeric:tabular-nums;">0</div>
              </div>
              <div style="padding:10px 14px; border-radius:10px; background:rgba(225,29,72,0.06); border:1px solid rgba(225,29,72,0.22);">
                <div style="font-size:11px; font-weight:700; color:#be123c;">Needs Practice</div>
                <div id="weak-vault-kpi-pending" style="font-size:22px; font-weight:900; color:#e11d48; font-variant-numeric:tabular-nums;">0</div>
              </div>
              <div style="padding:10px 14px; border-radius:10px; background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.22);">
                <div style="font-size:11px; font-weight:700; color:#047857;">Mastered</div>
                <div id="weak-vault-kpi-mastered" style="font-size:22px; font-weight:900; color:#059669; font-variant-numeric:tabular-nums;">0</div>
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:16px; align-items:start;">
            <!-- Left Column: Saved Weak Words List & Controls -->
            <div class="card" style="padding:16px; display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <input type="text" id="weak-vault-custom-word-input" class="form-control" placeholder="Add a difficult word (e.g. Parliament, Jurisdiction)..." onkeydown="if(event.key==='Enter'){event.preventDefault(); window.addCustomWordToWeakVault();}" style="flex:1; min-width:190px; min-height:38px; font-size:12.5px;">
                <button type="button" class="btn btn-primary btn-sm" style="min-height:38px; font-weight:800;" onclick="window.addCustomWordToWeakVault()">
                  <i class="fa-solid fa-plus"></i> Add &amp; Inspect
                </button>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding-bottom:10px; border-bottom:1px solid var(--border);">
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  <button type="button" id="weak-vault-filter-all" class="btn btn-primary btn-sm" onclick="window.setWeakVaultFilterMode('all')">All</button>
                  <button type="button" id="weak-vault-filter-pending" class="btn btn-secondary btn-sm" onclick="window.setWeakVaultFilterMode('pending')">Needs Practice</button>
                  <button type="button" id="weak-vault-filter-mastered" class="btn btn-secondary btn-sm" onclick="window.setWeakVaultFilterMode('mastered')">Mastered</button>
                </div>
                <input type="text" id="weak-vault-search-input" class="form-control" placeholder="Search saved words..." oninput="window.filterWeakOutlinesVaultUI()" style="width:175px; min-height:34px; font-size:12px;">
              </div>

              <div id="weak-vault-inline-list" style="display:flex; flex-direction:column; gap:8px; max-height:520px; overflow-y:auto;"></div>
            </div>

            <!-- Right Column: Inline Pitman Stroke Inspector & 5x Mastery Practice -->
            <div class="card" style="padding:18px; display:flex; flex-direction:column; gap:12px; position:sticky; top:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; padding-bottom:10px; border-bottom:1px solid var(--border);">
                <div>
                  <div style="font-size:10.5px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:var(--primary);">PITMAN STROKE INSPECTOR</div>
                  <h4 id="inline-pitman-word-title" style="margin:2px 0 0 0; font-size:18px; font-weight:900; color:var(--secondary);">Select or add a word</h4>
                </div>
                <span id="inline-pitman-position-badge" style="font-size:11px; font-weight:800; color:var(--primary); background:rgba(79,70,229,0.1); padding:4px 10px; border-radius:8px;">Stroke Guide</span>
              </div>

              <div id="inline-pitman-svg-stage" style="background:var(--background); border:1px solid var(--border); border-radius:12px; padding:12px; min-height:150px; display:flex; align-items:center; justify-content:center;"></div>

              <div id="inline-pitman-notes" style="display:flex; flex-direction:column; gap:6px;"></div>

              <div style="padding-top:10px; border-top:1px solid var(--border); display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:800; color:var(--secondary);">
                  <span>Quick 5x Muscle-Memory Practice</span>
                  <span id="inline-pitman-practice-progress" style="color:var(--primary); font-variant-numeric:tabular-nums;">0 / 5 reps</span>
                </div>
                <input type="text" id="inline-pitman-practice-input" class="form-control" disabled oninput="checkPitmanInspectorPracticeInput(this)" placeholder="Select a word first to start 5x practice..." style="font-size:13px; min-height:40px;">
              </div>
            </div>
          </div>
        </div>
      `;
      mainContainer.appendChild(vaultSec);
    }

    // =========================================================================
    // REQUIREMENT #7: NEW TAB FOR "7-DAY PLANNER & GOALS" (#view-planner-goals)
    // =========================================================================
    if (!document.getElementById('view-planner-goals')) {
      const planSec = document.createElement('section');
      planSec.id = 'view-planner-goals';
      planSec.className = 'app-view';
      planSec.style.display = 'none';
      planSec.innerHTML = `
        <div style="max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
          <div class="card" style="border-top: 4px solid #2563eb; background: linear-gradient(135deg, rgba(37,99,235,0.08), rgba(16,185,129,0.06));">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div>
                <span style="font-size:10.5px; font-weight:800; color:#1d4ed8; background:rgba(37,99,235,0.12); padding:3px 10px; border-radius:999px; border:1px solid rgba(37,99,235,0.3);">📅 DEDICATED GOAL, CONSISTENCY HEATMAP &amp; COMPETENCY ANALYTICS HUB</span>
                <h3 style="margin:6px 0 2px 0; font-size:19px; font-weight:900; color:var(--secondary);">7-Day Study Planner, Daily Target Tracker, Consistency Heatmap &amp; Real-Time Competency Analytics</h3>
                <p style="margin:0; font-size:12.5px; color:var(--text-muted);">Track your daily practice goals, 7-day smart study schedule, 52-week consistency heatmap, and real-time WPM/Accuracy competency progression.</p>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.refreshPlannerAndGoalsTab()">
                  <i class="fa-solid fa-arrows-rotate"></i> Refresh Real-Time Analytics
                </button>
                <button type="button" class="btn btn-primary btn-sm" onclick="navigateTo('audio')">
                  🎧 Start Today's Dictation Task
                </button>
              </div>
            </div>
          </div>

          <div id="planner-goals-top-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; align-items: stretch;"></div>
          <div id="planner-goals-heatmap-mount" style="display: flex; flex-direction: column; gap: 16px;"></div>
          <div id="planner-goals-competency-mount" style="display: flex; flex-direction: column; gap: 16px;"></div>
        </div>
      `;
      mainContainer.appendChild(planSec);
    }

    // =========================================================================
    // REQUIREMENT #8: NEW TAB FOR "INSTITUTION BATCH MONITOR & COMMUNICATION"
    //                 WITH LIVE POLLS + DASHBOARD PINNED ANNOUNCEMENTS ONLY
    // =========================================================================
    if (!document.getElementById('view-batchhub')) {
      const batchSec = document.createElement('section');
      batchSec.id = 'view-batchhub';
      batchSec.className = 'app-view';
      batchSec.style.display = 'none';
      batchSec.innerHTML = `
        <div class="rp-batchhub-shell" style="max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
          <div class="card rp-batchhub-hero-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:14px;">
              <div style="flex:1; min-width:260px;">
                <div style="display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:800; color:var(--primary); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:4px;">
                  <i class="fa-solid fa-people-group"></i> Batch Workspace &amp; Collaboration
                </div>
                <h3 style="margin:0 0 4px 0; font-size:20px; font-weight:800; color:var(--secondary); letter-spacing:-0.02em;">Batch Monitor &amp; Communication Hub</h3>
                <p style="margin:0; font-size:13px; color:var(--text-muted); line-height:1.5; max-width:720px;">
                  Choose a workspace section below to keep everything organized: track student progress &amp; announcements, vote in live polls, review shorthand notebook pads, or resolve outline doubts.
                </p>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="if(typeof renderDashboardBatchMonitoringHub==='function') renderDashboardBatchMonitoringHub(); if(typeof renderBatchShorthandDoubtWall==='function') renderBatchShorthandDoubtWall(); if(typeof window.loadShorthandPadsFromServer==='function') window.loadShorthandPadsFromServer('batchhub', false); if(typeof window.renderBatchPollsWidget==='function') window.renderBatchPollsWidget(); showToast('✅ Batch Workspace synced!');">
                  <i class="fa-solid fa-rotate"></i> Sync Workspace
                </button>
              </div>
            </div>
            <div class="rp-batchhub-guide-strip" aria-label="Quick Guide">
              <div class="rp-batchhub-guide-step">
                <span class="rp-batchhub-guide-num">1</span>
                <span><strong>Monitor &amp; Chat:</strong> Batch progress, faculty directives &amp; private monitor queries</span>
              </div>
              <div class="rp-batchhub-guide-step">
                <span class="rp-batchhub-guide-num">2</span>
                <span><strong>Live Polls:</strong> Vote on speed targets &amp; drill schedules</span>
              </div>
              <div class="rp-batchhub-guide-step">
                <span class="rp-batchhub-guide-num">3</span>
                <span><strong>Pads &amp; Doubts:</strong> Shorthand notebook feedback &amp; outline Q&amp;A</span>
              </div>
            </div>
          </div>

          <!-- Interactive Batch Poll Builder & Live Voting Card -->
          <div id="batch-poll-creator-box" class="card" style="display:none; border-top: 3px solid var(--accent); padding: 18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid var(--border);">
              <div>
                <div style="font-size:11px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; color:var(--accent);">Batch Polls &amp; Consensus</div>
                <h4 style="margin:2px 0 2px 0; font-size:16px; font-weight:800; color:var(--secondary);">Live Batch Polls &amp; Speed Target Voting</h4>
                <div id="batch-poll-role-note" style="font-size:12px; color:var(--text-muted);">Batch Monitors, Admins &amp; Superadmins can publish polls; all batch students can cast votes below.</div>
              </div>
              <button type="button" id="btn-toggle-new-batch-poll" class="btn btn-primary btn-sm" style="display:none;" onclick="if(!window.canCurrentUserCreateBatchPoll()){ showToast('Only Batch Monitors, Admins, and Superadmins can create polls.'); return; } const f=document.getElementById('new-batch-poll-form'); if(f) f.style.display = f.style.display === 'none' ? 'grid' : 'none';">
                <i class="fa-solid fa-plus-circle"></i> Create New Poll
              </button>
            </div>

            <div id="new-batch-poll-form" style="display:none; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:10px; padding:14px; background:var(--background); border:1px solid var(--border); border-radius:12px; margin-bottom:14px;">
              <div style="grid-column: 1 / -1;">
                <label style="font-size:11.5px; font-weight:700; color:var(--secondary); display:block; margin-bottom:4px;">Poll Question <span style="color:var(--danger);">*</span></label>
                <input type="text" id="poll-question-input" class="form-control" placeholder="e.g., Which dictation speed should we focus on in tomorrow's live drill?" style="font-size:13px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Option 1 *</label>
                <input type="text" id="poll-opt-1" class="form-control" placeholder="Option 1" style="font-size:12.5px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Option 2 *</label>
                <input type="text" id="poll-opt-2" class="form-control" placeholder="Option 2" style="font-size:12.5px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Option 3 (Optional)</label>
                <input type="text" id="poll-opt-3" class="form-control" placeholder="Option 3" style="font-size:12.5px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Option 4 (Optional)</label>
                <input type="text" id="poll-opt-4" class="form-control" placeholder="Option 4" style="font-size:12.5px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Poll Start Time (Optional)</label>
                <input type="datetime-local" id="poll-start-time" class="form-control" style="font-size:12px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Poll End Time (Optional)</label>
                <input type="datetime-local" id="poll-end-time" class="form-control" style="font-size:12px;">
              </div>
              <div style="grid-column: 1 / -1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding-top:6px;">
                <label style="font-size:12px; font-weight:700; color:var(--secondary); display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                  <input type="checkbox" id="poll-pin-to-dashboard"> Pin Announcement Notice to Dashboard
                </label>
                <div style="display:flex; gap:8px;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('new-batch-poll-form').style.display='none'">Cancel</button>
                  <button type="button" class="btn btn-primary btn-sm" onclick="window.createNewBatchPoll()"><i class="fa-solid fa-paper-plane"></i> Publish Live Poll</button>
                </div>
              </div>
            </div>

            <div id="batch-polls-list-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:12px;"></div>
          </div>

          <div id="batchhub-dedicated-mount" style="display: flex; flex-direction: column; gap: 16px;"></div>
          <div id="batchhub-pads-mount" style="display: none; flex-direction: column; gap: 16px;"></div>
          <div id="batchhub-doubt-wall-mount" style="display: none; flex-direction: column; gap: 16px;"></div>
        </div>
      `;
      mainContainer.appendChild(batchSec);
    }

    // Move 7-Day Study Planner into its dedicated tab (Weak Outlines Vault now has its own clean 2-column studio)
    const engagementRow = document.getElementById('student-engagement-suite-row');
    if (engagementRow) {
      const plannerChecklist = document.getElementById('weekly-study-planner-checklist');
      const plannerCard = plannerChecklist ? plannerChecklist.closest('.card') : null;

      const plannerTopGrid = document.getElementById('planner-goals-top-grid');
      const dailyGoalCard = document.getElementById('daily-practice-goal-card');
      if (plannerTopGrid && plannerCard && !plannerTopGrid.contains(plannerCard)) {
        plannerCard.style.marginBottom = '0';
        plannerTopGrid.appendChild(plannerCard);
      }
      if (plannerTopGrid && dailyGoalCard && !plannerTopGrid.contains(dailyGoalCard)) {
        dailyGoalCard.style.marginBottom = '0';
        plannerTopGrid.appendChild(dailyGoalCard);
      }
      engagementRow.style.display = 'none';
    }

    // Mount Unified Monthly Attendance, Streak & Consistency Heatmap Calendar inside #planner-goals-heatmap-mount
    const heatmapCard = document.getElementById('d3-weekly-heatmap-card');
    const attendanceCard = document.getElementById('student-attendance-matrix-card') || document.querySelector('#view-attendance-matrix > .card');
    const heatmapMount = document.getElementById('planner-goals-heatmap-mount');
    if (heatmapMount) {
      let hub = document.getElementById('rp-merged-attendance-heatmap-hub');
      if (!hub) {
        hub = document.createElement('div');
        hub.id = 'rp-merged-attendance-heatmap-hub';
        hub.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
        hub.innerHTML = `<div id="rp-merged-attendance-heatmap-body" style="display: flex; flex-direction: column; gap: 12px;"></div>`;
        heatmapMount.appendChild(hub);
      }
      const hubBody = document.getElementById('rp-merged-attendance-heatmap-body') || hub;
      if (attendanceCard && !hubBody.contains(attendanceCard)) {
        attendanceCard.id = 'student-attendance-matrix-card';
        attendanceCard.style.display = 'block';
        attendanceCard.style.marginBottom = '0';
        hubBody.appendChild(attendanceCard);
      }
      if (heatmapCard) {
        // Legacy secondary heatmap card is superseded by the unified calendar inside #student-attendance-matrix-card
        heatmapCard.style.display = 'none';
      }
      if (typeof window.renderStudentAttendanceMatrixView === 'function') {
        window.renderStudentAttendanceMatrixView();
      }
    }

    const sessionCard = document.getElementById('user-engagement-session-card');
    const compMount = document.getElementById('planner-goals-competency-mount');
    if (sessionCard && compMount && !compMount.contains(sessionCard)) {
      sessionCard.style.display = 'block';
      sessionCard.style.marginBottom = '0';
      compMount.appendChild(sessionCard);
    }

    // Move Institution Batch Monitoring & Communication Card into #batchhub-dedicated-mount,
    // Shorthand Pad Review Desk into #batchhub-pads-mount, and Shorthand Doubt Wall into #batchhub-doubt-wall-mount
    const batchCard = document.getElementById('dashboard-batch-monitoring-card');
    const batchPadsCard = document.getElementById('batchhub-shorthand-pads-card');
    const batchMount = document.getElementById('batchhub-dedicated-mount');
    const batchPadsMount = document.getElementById('batchhub-pads-mount') || batchMount;
    if (batchPadsCard && batchPadsMount && !batchPadsMount.contains(batchPadsCard)) {
      batchPadsCard.style.display = 'block';
      batchPadsCard.style.marginBottom = '0';
      batchPadsMount.appendChild(batchPadsCard);
    }
    if (batchCard && batchMount && !batchMount.contains(batchCard)) {
      batchCard.style.display = 'block';
      batchCard.style.marginBottom = '0';
      batchMount.appendChild(batchCard);
    }

    const doubtWallBar = document.getElementById('batch-shorthand-doubt-wall-container') || document.getElementById('dashboard-shorthand-doubt-wall-bar');
    const doubtMount = document.getElementById('batchhub-doubt-wall-mount');
    if (doubtWallBar && doubtMount && !doubtMount.contains(doubtWallBar)) {
      doubtWallBar.style.display = 'block';
      doubtWallBar.style.marginTop = '0';
      doubtWallBar.style.marginBottom = '0';
      doubtMount.appendChild(doubtWallBar);
    }

    // Create Pinned Batch Announcements & Directives summary widget on the Dashboard (#view-dashboard)
    const dashView = document.getElementById('view-dashboard');
    const hwRow = document.getElementById('dashboard-homework-announcements-row');
    if (dashView && !document.getElementById('dashboard-pinned-directives-card')) {
      const pinCard = document.createElement('div');
      pinCard.id = 'dashboard-pinned-directives-card';
      pinCard.className = 'card';
      pinCard.style.cssText = 'margin-bottom: 18px; border-top: 4px solid #7c3aed; background: linear-gradient(135deg, rgba(124,58,237,0.06), rgba(37,99,235,0.04)); padding: 16px 18px;';
      pinCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <div>
            <span style="font-size:10px; font-weight:900; padding:2px 9px; border-radius:999px; background:rgba(124,58,237,0.14); color:#6d28d9; border:1px solid rgba(124,58,237,0.3);">📌 PINNED BATCH DIRECTIVES &amp; OFFICIAL ANNOUNCEMENTS</span>
            <h4 style="margin:4px 0 0 0; font-size:15.5px; font-weight:900; color:var(--secondary);">Important Pinned Notices from Your Batch Monitor &amp; Faculty</h4>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary btn-sm" style="font-size:11.5px; background:linear-gradient(135deg,#7c3aed,#2563eb); border:none;" onclick="navigateTo('batchhub')">
              💬 Open Full Batch Communication, Replies &amp; Polls &rarr;
            </button>
          </div>
        </div>
        <div id="dashboard-pinned-batch-messages-mount" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:10px;"></div>
      `;
      if (hwRow && hwRow.parentNode) {
        hwRow.parentNode.insertBefore(pinCard, hwRow.nextSibling);
      } else {
        dashView.appendChild(pinCard);
      }
    }

    const qTextEl = document.getElementById('cbt-question-text');
    const confBtnSure = document.getElementById('cbt-conf-btn-sure');
    const confBarEl = confBtnSure ? confBtnSure.closest('div[style*="dashed"]') : null;
    if (qTextEl && confBarEl && qTextEl.parentNode === confBarEl.parentNode) {
      confBarEl.style.marginTop = '0';
      confBarEl.style.marginBottom = '14px';
      qTextEl.parentNode.insertBefore(confBarEl, qTextEl);
    }

    const cbtSubSwitcher = document.getElementById('cbttest-subview-switcher-bar');
    if (cbtSubSwitcher) cbtSubSwitcher.style.display = 'none';
    const savedPillInCbt = document.getElementById('cbt-saved-mcqs-count-pill');
    const revToolbarInCbt = savedPillInCbt ? savedPillInCbt.closest('div[style*="linear-gradient"]') : null;

    // =========================================================================
    // CLEAN, ZERO-CONFUSION SAVED MCQs & ERROR LOGBOOK TAB (#view-cbt-revision)
    // =========================================================================
    if (!document.getElementById('view-cbt-revision')) {
      const revSec = document.createElement('section');
      revSec.id = 'view-cbt-revision';
      revSec.className = 'app-view';
      revSec.style.display = 'none';
      revSec.innerHTML = `
        <div style="max-width: 1240px; margin: 0 auto; display:flex; flex-direction:column; gap:16px;">
          <div class="card" style="border-top: 4px solid #7c3aed; padding: 18px 20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
              <div>
                <div style="font-size:11px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#6d28d9; margin-bottom:4px;">CBT REVISION NOTEBOOK</div>
                <h3 style="margin:0 0 4px 0; font-size:20px; font-weight:900; color:var(--secondary);">Saved MCQs &amp; Wrong-Answer Logbook</h3>
                <p style="margin:0; font-size:12.5px; color:var(--text-muted);">Review questions you starred or got wrong in CBT Mock Exams. Click any option to self-test, reveal the solution, and mark questions Mastered.</p>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="const f=document.getElementById('cbt-rev-add-custom-form'); if(f) f.style.display = f.style.display==='none' ? 'grid' : 'none';">
                  <i class="fa-solid fa-plus"></i> Add Custom MCQ
                </button>
                <button type="button" class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="if(typeof window.clearCbtRevisionNotebookList==='function') window.clearCbtRevisionNotebookList();">
                  <i class="fa-solid fa-trash-can"></i> Clear List
                </button>
                <button type="button" class="btn btn-primary btn-sm" style="background:#e11d48; border:none; font-weight:800;" onclick="launchCustomCbtMistakeMiniQuiz(15)">
                  <i class="fa-solid fa-bolt"></i> Practice Wrong Answers Quiz
                </button>
              </div>
            </div>

            <!-- Simple 3-step explanation strip -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px; padding:10px 12px; border-radius:10px; background:var(--background); border:1px solid var(--border); margin-bottom:12px; font-size:11.5px; color:var(--text-muted);">
              <div><strong style="color:var(--secondary);">1. Saved Bookmarks:</strong> Questions you star during CBT Mocks or add manually here.</div>
              <div><strong style="color:var(--secondary);">2. Wrong Answers:</strong> Questions you answer wrongly (or guess 50-50) in CBT Mocks auto-save here.</div>
              <div><strong style="color:var(--secondary);">3. Self-Test &amp; Master:</strong> Click an option to check yourself, then click <em>Mark Mastered</em>.</div>
            </div>

            <!-- KPI Summary Strip -->
            <div id="cbt-revision-kpi-strip" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px;"></div>

            <!-- Add Custom MCQ Form -->
            <div id="cbt-rev-add-custom-form" style="display:none; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px; padding:14px; background:var(--background); border:1px solid var(--border); border-radius:12px; margin-top:14px;">
              <div style="grid-column: 1 / -1;">
                <label style="font-size:11px; font-weight:800; color:var(--secondary);">Question Statement *</label>
                <input type="text" id="custom-mcq-q" class="form-control" placeholder="Enter question text to save in your revision notebook..." style="font-size:12.5px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Option A *</label>
                <input type="text" id="custom-mcq-opt0" class="form-control" placeholder="Option A" style="font-size:12px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Option B *</label>
                <input type="text" id="custom-mcq-opt1" class="form-control" placeholder="Option B" style="font-size:12px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Option C *</label>
                <input type="text" id="custom-mcq-opt2" class="form-control" placeholder="Option C" style="font-size:12px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Option D *</label>
                <input type="text" id="custom-mcq-opt3" class="form-control" placeholder="Option D" style="font-size:12px;">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Correct Option</label>
                <select id="custom-mcq-ans" class="form-control" style="font-size:12px;">
                  <option value="0">Option A</option>
                  <option value="1">Option B</option>
                  <option value="2">Option C</option>
                  <option value="3">Option D</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Subject / Topic</label>
                <input type="text" id="custom-mcq-topic" class="form-control" placeholder="e.g. English Grammar / Pitman Rules / GK" style="font-size:12px;">
              </div>
              <div style="grid-column: 1 / -1;">
                <label style="font-size:11px; font-weight:700; color:var(--text-muted);">Solution / Memory Rule Note</label>
                <input type="text" id="custom-mcq-exp" class="form-control" placeholder="Explain why the answer is correct..." style="font-size:12px;">
              </div>
              <div style="grid-column: 1 / -1; display:flex; justify-content:flex-end; gap:8px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('cbt-rev-add-custom-form').style.display='none'">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" onclick="window.addCustomMcqToRevisionNotebook()">Save Question</button>
              </div>
            </div>
          </div>

          <div class="card" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding-bottom:12px; border-bottom:1px solid var(--border); margin-bottom:14px;">
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" id="rev-tab-btn-bookmarks" class="btn btn-primary btn-sm" onclick="window.__cbtNotebookMode='bookmarks'; window.renderDedicatedCbtRevisionTab();">
                  Saved Bookmarks (0)
                </button>
                <button type="button" id="rev-tab-btn-flashcards" class="btn btn-secondary btn-sm" onclick="window.__cbtNotebookMode='flashcards'; window.renderDedicatedCbtRevisionTab();">
                  Wrong Answers (0)
                </button>
                <button type="button" id="rev-tab-btn-all" class="btn btn-secondary btn-sm" onclick="window.__cbtNotebookMode='all'; window.renderDedicatedCbtRevisionTab();">
                  All Questions (0)
                </button>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <input type="text" id="cbt-rev-search-input" class="form-control" placeholder="Search question or topic..." oninput="window.renderDedicatedCbtRevisionTab()" style="min-height:34px; font-size:12px; width:210px;">
                <select id="cbt-rev-srs-filter" class="form-control" onchange="window.renderDedicatedCbtRevisionTab()" style="min-height:34px; font-size:12px; width:155px;">
                  <option value="ALL">All Statuses</option>
                  <option value="NEEDS_REVIEW">Needs Review</option>
                  <option value="MASTERED">Mastered</option>
                </select>
              </div>
            </div>
            <div id="cbt-revision-inline-list" style="display:flex; flex-direction:column; gap:12px;"></div>
          </div>
        </div>
      `;
      mainContainer.appendChild(revSec);
    }

    // Hide legacy duplicated CBT revision toolbar so the revision tab stays clean and uncluttered
    if (revToolbarInCbt) {
      revToolbarInCbt.style.display = 'none';
    }
  }
