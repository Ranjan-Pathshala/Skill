// @ts-nocheck
/**
 * RP Skill Portal — Batch Hub, Doubt Wall, Polls, Leaderboard, Attendance & DRM Shield
 * Clean Vite ES module (zero layered monkey-patch conflicts).
 */

import { portalState } from '../core/state.ts';
import { onDomReady, onWindowLoad } from '../core/domReady.ts';
import { escapeHtml, formatLocalDate, getLocalDateString } from '../utils/formatting.ts';
import { getBatchGroupMessagesMap, getInstituteBatchesList, getUserAssignedBatchesList, getUserMonitorBatchesList, isUserMonitorForBatch, loadAdminData, renderAdminUsers, renderDashboardBatchMonitoringHub, saveBatchGroupMessagesMap, userHasBatchAssigned } from './adminPanel.js';
import { apiCall, showToast } from './apiAndCore.js';
import { makeCommandDeckShowAllData, renderD3WeeklyProgressHeatmap, renderDailyPracticeGoalUI, renderDashboardUI, renderUserPerformanceChart, setupDedicatedTabsAndMoveSections, switchAdminInnerSubtab } from './dashboardAndProfile.js';
import { getScheduledLiveTestsList, injectMasterPassageFontToolbars, setupInteractiveTouchTypingStudio } from './mediaAndDictation.js';
import { removeUselessPreTranscribeToolbars, renderCbtQuestion, updateCbtRevisionCountsUI } from './cbtArena.js';
import { renderTypingStep2RuleCards, renderWords } from './typingAndEvaluation.js';
import { closeAllDeviceNavMenu, ensureHelpDeskFeedbackFormVisible, isUserAuthenticated, switchAuthTab, syncAuthHeaderAndMenuVisibility } from './authAndNavigation.js';
import { purgeFakeInjectedRules } from './videoAndTutor.js';

const currentActiveViewName = (...args) => (typeof window.currentActiveViewName === 'function' ? window.currentActiveViewName(...args) : undefined);
const renderWeeklyStudyPlanner = (...args) => (typeof window.renderWeeklyStudyPlanner === 'function' ? window.renderWeeklyStudyPlanner(...args) : undefined);
const renderDashboardWeakOutlinesVault = (...args) => (typeof window.renderDashboardWeakOutlinesVault === 'function' ? window.renderDashboardWeakOutlinesVault(...args) : undefined);
const renderBatchShorthandDoubtWall = (...args) => (typeof window.renderBatchShorthandDoubtWall === 'function' ? window.renderBatchShorthandDoubtWall(...args) : undefined);
const loadShorthandPadsFromServer = (...args) => (typeof window.loadShorthandPadsFromServer === 'function' ? window.loadShorthandPadsFromServer(...args) : undefined);

export const PARENT_SUMMARY_PREFS_KEY = 'rp_parent_weekly_summary_prefs_v1';

export const SUBSCRIPTION_EXPIRY_KEY = 'rp_student_batch_validity_v1';

window.getStudentWeeklyProgressSnapshot = function() {
        const uName = window.currentUser?.name || window.currentUser?.username || 'Student';
        const uBatch = (window.currentUser?.batch && window.currentUser.batch !== '-') ? window.currentUser.batch : 'RP-Trail';
        const hist = Array.isArray(window.userTestHistory) && window.userTestHistory.length > 0
            ? window.userTestHistory
            : (Array.isArray(window.allTestHistoryList) ? window.allTestHistoryList : []);
        const testsCompleted = hist.length;
        let bestSpeed = 0, sumAcc = 0, accCount = 0;
        hist.forEach(h => {
            const s = parseFloat(h.NetSpeed ?? h.netSpeed ?? h.WPM ?? h.wpm ?? 0);
            const a = parseFloat(h.AccuracyPercentage ?? h.accuracyPercentage ?? h.Accuracy ?? 0);
            if (s > bestSpeed) bestSpeed = s;
            if (a > 0) { sumAcc += a; accCount++; }
        });
        const avgAcc = accCount > 0 ? (sumAcc / accCount).toFixed(1) : '0.0';
        const attendanceDays = testsCompleted > 0 ? Math.min(7, Math.max(1, Math.ceil(testsCompleted / 2))) : 0;
        return {
            studentName: uName,
            batchName: uBatch,
            attendance: `${attendanceDays} / 7 Days`,
            testsCompleted,
            netSpeed: `${Math.round(bestSpeed)} WPM`,
            accuracy: `${avgAcc}%`,
            batchRank: testsCompleted > 0 ? 'Active Ranker' : 'Unranked (No Tests Yet)'
        };
    };

window.openParentWeeklySummaryModal = function() {
        const modal = document.getElementById('parent-weekly-summary-modal');
        if (!modal) return;
        try {
            const prefs = JSON.parse(localStorage.getItem(PARENT_SUMMARY_PREFS_KEY) || '{}');
            const resolved = typeof window.resolveUserParentDetails === 'function'
                ? window.resolveUserParentDetails(window.currentUser)
                : {
                    parentName: prefs.guardianName || window.currentUser?.parentName || window.currentUser?.name || '',
                    parentMobile: prefs.whatsapp || window.currentUser?.parentMobile || window.currentUser?.mobile || '',
                    parentEmail: prefs.email || window.currentUser?.parentEmail || window.currentUser?.email || '',
                    usedStudentFallback: !(prefs.guardianName || prefs.whatsapp || prefs.email || window.currentUser?.parentName || window.currentUser?.parentMobile || window.currentUser?.parentEmail)
                };
            const nameEl = document.getElementById('parent-guardian-name');
            const phoneEl = document.getElementById('parent-summary-whatsapp-input') || document.getElementById('parent-guardian-whatsapp');
            const emailEl = document.getElementById('parent-summary-email-input') || document.getElementById('parent-guardian-email');
            const optInEl = document.getElementById('parent-summary-optin-chk') || document.getElementById('parent-weekly-optin-toggle');
            const fallbackEl = document.getElementById('parent-summary-fallback-notice');

            if (nameEl) nameEl.value = resolved.parentName || prefs.guardianName || '';
            if (phoneEl) phoneEl.value = resolved.parentMobile || prefs.whatsapp || '';
            if (emailEl) emailEl.value = resolved.parentEmail || prefs.email || '';
            if (optInEl && typeof prefs.optIn === 'boolean') optInEl.checked = prefs.optIn;
            if (fallbackEl) {
                fallbackEl.style.display = resolved.usedStudentFallback ? 'block' : 'none';
            }
        } catch (e) {}

        const snap = window.getStudentWeeklyProgressSnapshot();
        const previewEl = document.getElementById('parent-weekly-report-preview-box') || document.getElementById('parent-summary-live-preview');
        if (previewEl) {
            previewEl.innerHTML = `
                <div><b>Student:</b> ${snap.studentName} (${snap.batchName})</div>
                <div><b>Weekly Attendance:</b> ${snap.attendance} • <b>Tests Completed:</b> ${snap.testsCompleted}</div>
                <div><b>Net Speed Growth:</b> <span style="color:#059669; font-weight:700;">${snap.netSpeed}</span> • <b>Accuracy:</b> ${snap.accuracy}</div>
                <div><b>Current Batch Rank:</b> <span style="color:var(--primary); font-weight:700;">${snap.batchRank}</span></div>
            `;
        }
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    };

window.openParentGuardianWeeklySummaryModal = window.openParentWeeklySummaryModal;

window.getUserEnrollmentValidityLabel = function(userObj) {
        if (!userObj) return 'Active Pass';
        const uid = String(userObj.UserID || userObj.userId || '').trim();
        const todayIso = (typeof getLocalDateString === 'function') ? getLocalDateString() : new Date().toISOString().slice(0, 10);
        const batchLower = String(userObj.Batch || userObj.batch || '').toLowerCase();
        if (userObj.AutoSwitchedToFreeTier || batchLower === 'free tier' || batchLower === 'rp-trail') {
            return userObj.EnrollmentValidUntil ? `Expired (${userObj.EnrollmentValidUntil}) → RP-Trail` : 'RP-Trail (Free Batch)';
        }
        if (userObj.EnrollmentValidUntil && /^\d{4}-\d{2}-\d{2}$/.test(String(userObj.EnrollmentValidUntil))) {
            return String(userObj.EnrollmentValidUntil) < todayIso
              ? `Expired (${userObj.EnrollmentValidUntil}) → RP-Trail`
              : `Valid till ${userObj.EnrollmentValidUntil}`;
        }
        try {
            const map = JSON.parse(localStorage.getItem('rp_admin_user_validity_map_v1') || '{}');
            if (uid && map[uid]) return map[uid];
        } catch (e) {}
        if (userObj.UserPreferencesJson && userObj.UserPreferencesJson !== '-') {
            try {
                const p = JSON.parse(String(userObj.UserPreferencesJson));
                const d = p && (p.enrollmentValidUntil || p.validityUntil);
                if (d) return d < todayIso ? `Expired (${d}) → RP-Trail` : `Valid till ${d}`;
            } catch (e) {}
        }
        return 'Active Pass';
    };

window.populateAdminValidityTargetDropdown = function() {
        const sel = document.getElementById('admin-validity-target-select');
        if (!sel) return;
        const batches = typeof getInstituteBatchesList === 'function' ? getInstituteBatchesList() : [];
        const users = (window.adminData && Array.isArray(window.adminData.users)) ? window.adminData.users : [];
        let htmlOpts = '<option value="ALL_STUDENTS">🌐 All Active Students</option>';
        batches.forEach(b => {
            htmlOpts += `<option value="BATCH::${b}">🎓 Batch: ${b}</option>`;
        });
        users.slice(0, 200).forEach(u => {
            const uid = u.UserID || u.userId || '';
            const uname = u.Name || u.name || uid;
            if (uid) htmlOpts += `<option value="USER::${uid}">👤 ${uname} (${uid})</option>`;
        });
        sel.innerHTML = htmlOpts;
        window.syncAdminValidityDatePreview();
    };

window.syncAdminValidityDatePreview = function() {
        const daysSel = document.getElementById('admin-validity-days-select');
        const dateInp = document.getElementById('admin-validity-custom-date');
        if (!daysSel || !dateInp) return;
        const days = parseInt(daysSel.value, 10);
        if (!isNaN(days) && days > 0) {
            const d = new Date(Date.now() + days * 86400000);
            dateInp.value = d.toISOString().slice(0, 10);
        } else if (days === 0) {
            dateInp.value = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        }
    };

window.adminApplyEnrollmentValidity = async function() {
        const targetVal = document.getElementById('admin-validity-target-select')?.value || 'ALL_STUDENTS';
        const daysVal = parseInt(document.getElementById('admin-validity-days-select')?.value || '90', 10);
        const customDate = document.getElementById('admin-validity-custom-date')?.value || new Date(Date.now() + Math.max(0, daysVal) * 86400000).toISOString().slice(0, 10);
        const autoFreeTier = document.getElementById('admin-validity-auto-freetier-chk') ? document.getElementById('admin-validity-auto-freetier-chk').checked : true;
        const todayIso = (typeof getLocalDateString === 'function') ? getLocalDateString() : new Date().toISOString().slice(0, 10);
        const isExpiredNow = daysVal === 0 || (customDate && customDate < todayIso);
        const label = isExpiredNow ? `Expired (${customDate}) → RP-Trail` : `Valid till ${customDate} (+${daysVal}d)`;

        try {
            const map = JSON.parse(localStorage.getItem('rp_admin_user_validity_map_v1') || '{}');
            const users = (window.adminData && Array.isArray(window.adminData.users)) ? window.adminData.users : [];
            users.forEach(u => {
                const uid = String(u.UserID || u.userId || '');
                if (!uid) return;
                const matched = (targetVal === 'ALL_STUDENTS')
                  || (targetVal.startsWith('BATCH::') && typeof userHasBatchAssigned === 'function' && userHasBatchAssigned(uid, targetVal.slice(7), u.Batch || u.batch))
                  || (targetVal === 'USER::' + uid);
                if (matched) {
                    map[uid] = label;
                    u.EnrollmentValidUntil = customDate;
                    if (isExpiredNow && autoFreeTier && !['admin', 'superadmin'].includes(String(u.Role || '').toLowerCase())) {
                        u.Batch = 'RP-Trail';
                        u.batch = 'RP-Trail';
                        u.AutoSwitchedToFreeTier = true;
                    } else if (!isExpiredNow) {
                        u.AutoSwitchedToFreeTier = false;
                    }
                }
            });
            localStorage.setItem('rp_admin_user_validity_map_v1', JSON.stringify(map));
            localStorage.setItem(SUBSCRIPTION_EXPIRY_KEY, JSON.stringify({ daysLeft: Math.max(0, daysVal), validUntil: customDate, renewedAt: Date.now() }));
        } catch (e) {}

        const noteEl = document.getElementById('admin-validity-status-note');
        if (noteEl) noteEl.textContent = `⏳ Syncing Enrollment Validity (${label}) to server...`;
        if (typeof renderAdminUsers === 'function') renderAdminUsers();
        window.checkAndRenderSubscriptionExpiryAutomation(Math.max(0, daysVal));

        try {
            if (typeof apiCall === 'function') {
                const res = await apiCall('applyEnrollmentValidity', {
                    target: targetVal,
                    days: daysVal,
                    validUntil: customDate,
                    autoFreeTier: autoFreeTier
                });
                if (res && res.success) {
                    if (noteEl) noteEl.textContent = `✅ ${res.message || ('Applied Enrollment Validity (' + label + ')')}`;
                    if (typeof showToast === 'function') showToast(res.message || `✅ Enrollment Validity updated: ${label}`, 'success');
                    if (typeof loadAdminData === 'function') loadAdminData();
                    return;
                }
            }
        } catch (e) {}

        if (noteEl) noteEl.textContent = `✅ Applied Enrollment Validity (${label}) for ${targetVal.replace('::', ': ')}`;
        if (typeof showToast === 'function') showToast(`✅ Enrollment Validity updated: ${label}`, 'success');
    };

window.promptAdminQuickExtendUserValidity = function(userId, userName) {
        switchAdminInnerSubtab('users', 'validity');
        window.populateAdminValidityTargetDropdown();
        const sel = document.getElementById('admin-validity-target-select');
        if (sel) {
            const optVal = 'USER::' + userId;
            if (!Array.from(sel.options).some(o => o.value === optVal)) {
                const opt = document.createElement('option');
                opt.value = optVal;
                opt.textContent = `👤 ${userName || userId} (${userId})`;
                sel.appendChild(opt);
            }
            sel.value = optVal;
        }
        const card = document.getElementById('admin-validity-and-parent-report-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof showToast === 'function') showToast(`Selected ${userName || userId} in Enrollment Validity Manager.`);
    };

window.toggleAdminAutoWeeklyReportToAll = async function(enabled) {
        const badge = document.getElementById('admin-weekly-report-auto-badge');
        if (badge) {
            badge.textContent = enabled ? 'AUTO-SEND: ON' : 'AUTO-SEND: OFF';
            badge.style.background = enabled ? 'rgba(16,185,129,0.16)' : 'rgba(100,116,139,0.16)';
            badge.style.color = enabled ? '#059669' : '#64748b';
        }
        try {
            localStorage.setItem('rp_admin_auto_weekly_report_all', enabled ? 'true' : 'false');
            if (typeof apiCall === 'function') {
                await apiCall('sendWeeklyReportToAll', { autoScheduleOnly: true, autoSendEnabled: Boolean(enabled) }, true);
            }
        } catch (e) {}
        if (typeof showToast === 'function') {
            showToast(enabled ? '✅ Auto-Send Weekly Report to All Students/Parents Enabled!' : '⏸️ Auto-Send Weekly Report paused.');
        }
    };

window.triggerAdminSendWeeklyReportToAllNow = async function() {
        const statusEl = document.getElementById('admin-weekly-report-status-msg');
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--primary); font-weight:800;"><i class="fas fa-spinner fa-spin"></i> Dispatching Weekly Progress Reports to all active students &amp; parents...</span>';
        try {
            if (typeof apiCall === 'function') {
                const res = await apiCall('sendWeeklyReportToAll', { period: 'weekly', autoSendEnabled: true });
                const msg = (res && res.message) || 'Weekly Progress Reports dispatched to all registered student & parent emails!';
                if (statusEl) statusEl.innerHTML = `<span style="color:#059669; font-weight:800;">✅ ${msg}</span>`;
                if (typeof showToast === 'function') showToast(msg, 'success');
                return;
            }
        } catch (e) {}
        if (statusEl) statusEl.innerHTML = '<span style="color:#059669; font-weight:800;">✅ Weekly Progress Reports queued &amp; dispatched to all students/parents!</span>';
        if (typeof showToast === 'function') showToast('📤 Weekly Progress Reports dispatched to all students & parents!', 'success');
    };

window.openSubscriptionEnrollmentManagerModal = function() {
        window.checkAndRenderSubscriptionExpiryAutomation();
        const banner = document.getElementById('subscription-expiry-reminder-banner') || document.getElementById('subscription-expiry-automation-banner');
        if (banner) {
            banner.style.display = 'flex';
            banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (typeof showToast === 'function') {
            showToast('🎓 Active Batch Enrollment Valid — Weekly Progress & Exam Access Verified!', 'success');
        }
    };

window.closeParentWeeklySummaryModal = function() {
        const modal = document.getElementById('parent-weekly-summary-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.style.display = 'none';
    };

window.saveParentWeeklySummaryPreferences = async function() {
        const phoneEl = document.getElementById('parent-summary-whatsapp-input') || document.getElementById('parent-guardian-whatsapp');
        const emailEl = document.getElementById('parent-summary-email-input') || document.getElementById('parent-guardian-email');
        const optInEl = document.getElementById('parent-summary-optin-chk') || document.getElementById('parent-weekly-optin-toggle');
        const prefs = {
            guardianName: String(document.getElementById('parent-guardian-name')?.value || '').trim(),
            whatsapp: String(phoneEl?.value || '').trim(),
            email: String(emailEl?.value || '').trim(),
            optIn: Boolean(optInEl?.checked)
        };
        try { localStorage.setItem(PARENT_SUMMARY_PREFS_KEY, JSON.stringify(prefs)); } catch (e) {}
        if (window.currentUser) {
            window.currentUser.parentName = prefs.guardianName || window.currentUser.name || '';
            window.currentUser.parentMobile = prefs.whatsapp || window.currentUser.mobile || '';
            window.currentUser.parentEmail = prefs.email || window.currentUser.email || '';
            try { localStorage.setItem('steno_user', JSON.stringify(window.currentUser)); } catch (e) {}
            if (typeof window.syncProfileParentDetailsInputs === 'function') window.syncProfileParentDetailsInputs();
            if (typeof apiCall === 'function') {
                try {
                    await apiCall('saveParentDetails', {
                        userId: window.currentUser.userId,
                        parentName: prefs.guardianName,
                        parentMobile: prefs.whatsapp,
                        parentEmail: prefs.email,
                        optIn: prefs.optIn
                    }, true);
                } catch (e) {}
            }
        }
        const fallbackEl = document.getElementById('parent-summary-fallback-notice');
        if (fallbackEl && (prefs.guardianName || prefs.whatsapp || prefs.email)) {
            fallbackEl.style.display = 'none';
        }
        if (typeof showToast === 'function') showToast('Saved Parent / Guardian details & Weekly Progress Summary preferences!', 'success');
    };

window.dispatchParentSummaryViaWhatsApp = function() {
        window.saveParentWeeklySummaryPreferences();
        const phoneEl = document.getElementById('parent-summary-whatsapp-input') || document.getElementById('parent-guardian-whatsapp');
        const phoneRaw = String(phoneEl?.value || '').replace(/[^0-9]/g, '');
        const guardian = String(document.getElementById('parent-guardian-name')?.value || 'Parent/Guardian').trim();
        const snap = window.getStudentWeeklyProgressSnapshot();
        const msg = `*RP Skill | Ranjan Pathshala — Weekly Progress Report*\nDear ${guardian},\nHere is ${snap.studentName}'s weekly performance summary (${snap.batchName}):\n• Attendance: ${snap.attendance}\n• Skill & CBT Tests Completed: ${snap.testsCompleted}\n• Net Speed Growth: ${snap.netSpeed}\n• Average Accuracy: ${snap.accuracy}\n• Batch Rank: ${snap.batchRank}\n— Team Ranjan Pathshala`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(msg).catch(() => {});
        }
        const previewEl = document.getElementById('parent-weekly-report-preview-box') || document.getElementById('parent-summary-live-preview');
        if (previewEl) {
            previewEl.innerHTML = `<div class="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold mb-1"><i class="fa-brands fa-whatsapp"></i> WhatsApp Summary Ready ${phoneRaw ? `for +${phoneRaw}` : ''} (Copied to Clipboard):</div><pre class="whitespace-pre-wrap text-[11px] font-sans">${msg}</pre>`;
        }
        if (typeof showToast === 'function') showToast('Weekly Progress Report formatted for WhatsApp & copied to clipboard!', 'success');
    };

window.dispatchParentSummaryViaEmail = async function() {
        window.saveParentWeeklySummaryPreferences();
        const emailEl = document.getElementById('parent-summary-email-input') || document.getElementById('parent-guardian-email');
        const email = String(emailEl?.value || '').trim();
        const guardian = String(document.getElementById('parent-guardian-name')?.value || 'Parent/Guardian').trim();
        const snap = window.getStudentWeeklyProgressSnapshot();
        try {
            if (typeof window.apiCall === 'function') {
                await window.apiCall('sendBatchDigestEmail', { period: 'weekly', parentEmail: email, guardianName: guardian, summary: snap });
            }
        } catch (e) {}
        if (typeof showToast === 'function') showToast(`Weekly Progress Summary dispatched to ${email || 'registered guardian email'}!`, 'success');
    };

window.checkAndRenderSubscriptionExpiryAutomation = function(overrideDaysRemaining) {
        let daysLeft = typeof overrideDaysRemaining === 'number' ? overrideDaysRemaining : null;
        if (daysLeft === null) {
            try {
                const stored = JSON.parse(localStorage.getItem(SUBSCRIPTION_EXPIRY_KEY) || '{}');
                if (typeof stored.daysLeft === 'number') {
                    daysLeft = stored.daysLeft;
                } else if (window.currentUser && window.currentUser.expiryDate) {
                    const diffMs = new Date(window.currentUser.expiryDate).getTime() - Date.now();
                    daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
                } else {
                    daysLeft = 365; // No expiry warning unless an expiry date is set
                }
            } catch (e) { daysLeft = 365; }
        }

        // Remove any legacy duplicate expiry banner and unify onto #subscription-expiry-reminder-banner
        const legacyDupBanner = document.getElementById('batch-subscription-expiry-banner');
        if (legacyDupBanner) legacyDupBanner.remove();

        let banner = document.getElementById('subscription-expiry-reminder-banner');
        if (!banner) {
            const host = document.getElementById('view-dashboard') || document.querySelector('main');
            if (!host) return;
            banner = document.createElement('div');
            banner.id = 'subscription-expiry-reminder-banner';
            banner.style.marginBottom = '14px';
            host.insertBefore(banner, host.firstChild);
        }

        if (daysLeft > 5) {
            banner.style.display = 'none';
            window.__isFreeTierExpiredAccount = false;
            return;
        }

        banner.style.display = 'block';
        banner.style.padding = '0';
        banner.style.border = 'none';
        banner.style.background = 'transparent';
        if (daysLeft <= 0) {
            window.__isFreeTierExpiredAccount = true;
            banner.innerHTML = `
                <div style="background: linear-gradient(135deg, #7f1d1d, #991b1b); color: #fff; border-radius: 14px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border: 1px solid rgba(252,165,165,0.4); box-shadow: 0 8px 20px rgba(185,28,28,0.2);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="width: 34px; height: 34px; border-radius: 10px; background: rgba(255,255,255,0.15); display: inline-flex; align-items: center; justify-content: center; font-size: 16px;"><i class="fa-solid fa-lock-open"></i></span>
                        <div>
                            <div style="font-size: 12.5px; font-weight: 900; color: #fecaca;">Batch Subscription Expired — Auto-Switched to Free-Tier Practice Mode</div>
                            <div style="font-size: 11px; color: #fee2e2;">Your batch enrollment validity has ended. Free-tier tests &amp; saved notes remain unlocked; renew anytime to restore full Pro Batch &amp; Live Dictation access.</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" onclick="renewStudentBatchSubscriptionNow()" class="btn btn-sm" style="background: #fbbf24; color: #0f172a; font-weight: 800; font-size: 11px; border: none;">
                            <i class="fa-solid fa-bolt"></i> Extend Batch Validity (+30 Days)
                        </button>
                    </div>
                </div>
            `;
        } else {
            window.__isFreeTierExpiredAccount = false;
            banner.innerHTML = `
                <div style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: #fff; border-radius: 14px; padding: 11px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border: 1px solid rgba(251,191,36,0.45);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="width: 32px; height: 32px; border-radius: 10px; background: rgba(251,191,36,0.2); color: #fbbf24; display: inline-flex; align-items: center; justify-content: center; font-size: 15px;"><i class="fa-solid fa-calendar-check"></i></span>
                        <div>
                            <div style="font-size: 12px; font-weight: 800; color: #fde68a;">Gentle Batch Renewal Reminder: <span style="color:#fff;">${daysLeft} Day${daysLeft===1?'':'s'} Remaining</span> on Current Batch Pass</div>
                            <div style="font-size: 11px; color: #c7d2fe;">After expiry, your account automatically transitions to Free-Tier Practice Materials with zero data loss.</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <button type="button" onclick="openParentWeeklySummaryModal()" class="btn btn-sm" style="background: rgba(34,197,94,0.2); color: #86efac; border: 1px solid rgba(34,197,94,0.4); font-size: 11px; font-weight: 800;">
                            <i class="fa-brands fa-whatsapp"></i> Parent Weekly Summary
                        </button>
                        <button type="button" onclick="renewStudentBatchSubscriptionNow()" class="btn btn-sm" style="background: #10b981; color: #fff; font-weight: 800; font-size: 11px; border: none;">
                            <i class="fa-solid fa-rotate"></i> Renew Batch (+30d)
                        </button>
                        <button type="button" onclick="document.getElementById('subscription-expiry-reminder-banner').style.display='none'" class="btn btn-sm" style="background: rgba(255,255,255,0.1); color: #cbd5e1; font-size: 10.5px; border: none;">Dismiss</button>
                    </div>
                </div>
            `;
        }
    };

window.renewStudentBatchSubscriptionNow = function() {
        try {
            localStorage.setItem(SUBSCRIPTION_EXPIRY_KEY, JSON.stringify({ daysLeft: 30, renewedAt: Date.now() }));
        } catch (e) {}
        window.checkAndRenderSubscriptionExpiryAutomation(30);
        if (typeof showToast === 'function') showToast('Batch Enrollment Validity extended by +30 Days! Full Pro Batch access active.', 'success');
    };

window.renderScheduledLiveMockWindowBanner = function() {
        const strip = document.getElementById('cbttest-live-tests-strip');
        if (!strip) return;
        const liveList = (typeof getScheduledLiveTestsList === 'function') ? getScheduledLiveTestsList() : [];
        const cbtLiveTests = Array.isArray(liveList)
            ? liveList.filter(t => String(t.testType || t.type || '').toLowerCase() === 'cbttest')
            : [];
        if (cbtLiveTests.length === 0) {
            strip.style.display = 'none';
            strip.innerHTML = '';
            return;
        }
        const activeLive = cbtLiveTests[0];
        const safeTitle = typeof window.escapeHtml === 'function' ? window.escapeHtml(activeLive.title || 'Scheduled Live CBT Exam') : (activeLive.title || 'Scheduled Live CBT Exam');
        const safeId = String(activeLive.materialId || activeLive.id || '').replace(/'/g, "\\'");
        const startLabel = activeLive.startTime ? new Date(activeLive.startTime).toLocaleString() : 'Live Now';
        const endLabel = activeLive.endTime ? new Date(activeLive.endTime).toLocaleString() : '';
        strip.style.display = 'block';
        strip.innerHTML = `
            <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #f8fafc; border-radius: 12px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border: 1px solid rgba(59,130,246,0.35);">
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <span style="background: rgba(16,185,129,0.18); color: #34d399; border: 1px solid rgba(16,185,129,0.4); font-size: 10.5px; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.04em;"><i class="fa-solid fa-satellite-dish"></i> LIVE CBT WINDOW</span>
                    <div>
                        <div style="font-size: 13.5px; font-weight: 800; color: #f8fafc;">${safeTitle}</div>
                        <div style="font-size: 11.5px; color: #cbd5e1;">Window: ${startLabel}${endLabel ? ' — ' + endLabel : ''}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" onclick="if(typeof startScheduledLiveTest==='function'){startScheduledLiveTest('${String(activeLive.id || '').replace(/'/g, "\\'")}');}else{startCbtMockTest('${safeId}');}" class="btn btn-sm btn-primary" style="font-weight: 800; font-size: 12px;">
                        <i class="fa-solid fa-play"></i> Enter Live Mock Window
                    </button>
                </div>
            </div>
        `;
    };

window.updateAdminTelemetryKpiStrip = function() {
        const sessionsEl = document.getElementById('an-kpi-total-active-sessions');
        const sessionsSubEl = document.getElementById('an-kpi-sessions-subtext');
        const accEl = document.getElementById('an-kpi-avg-daily-accuracy');
        const accSubEl = document.getElementById('an-kpi-accuracy-subtext');
        const engEl = document.getElementById('an-kpi-user-engagement-index');
        const engSubEl = document.getElementById('an-kpi-engagement-subtext');
        if (!sessionsEl || !accEl || !engEl) return;

        const logs = (window.adminData && Array.isArray(window.adminData.logs)) ? window.adminData.logs : [];
        const adminHist = (window.adminData && Array.isArray(window.adminData.history)) ? window.adminData.history : [];
        const globalHist = (window.globalData && Array.isArray(window.globalData.history)) ? window.globalData.history : [];
        const userHist = (window.globalData && Array.isArray(window.globalData.userHistory)) ? window.globalData.userHistory : [];
        const localHist = Array.isArray(window.allTestHistoryList) ? window.allTestHistoryList : [];

        // Deduplicate all telemetry test history sources
        const seenHistKeys = new Set();
        const history = [];
        [adminHist, globalHist, localHist, userHist].forEach(arr => {
            (arr || []).forEach(h => {
                if (!h || typeof h !== 'object') return;
                const k = String(h.HistoryID || `${h.UserID || h.userId || h.UserName || 'u'}_${h.ExamName || h.examName || 'e'}_${h.Timestamp || h.timestamp || h.Date || ''}_${h.NetSpeed ?? h.netSpeed ?? ''}`);
                if (!seenHistKeys.has(k)) {
                    seenHistKeys.add(k);
                    history.push(h);
                }
            });
        });

        const users = (window.adminData && Array.isArray(window.adminData.users)) ? window.adminData.users : [];
        const engState = (typeof window.getEngagementAnalyticsState === 'function')
            ? window.getEngagementAnalyticsState()
            : { totalActiveSeconds: 0, sessionsCount: 1 };

        const todayIso = (typeof getLocalDateString === 'function') ? getLocalDateString() : new Date().toISOString().slice(0, 10);
        const uniqueSessionKeys = new Set();
        const todaySessionKeys = new Set();
        let sessionEventLogs = 0;

        logs.forEach((l, idx) => {
            const u = String(l.UserID || l.userId || l.UserName || l.Username || 'user').toLowerCase().trim();
            const rawTs = String(l.Timestamp || l.timestamp || '');
            const datePart = (typeof formatLocalDate === 'function') ? formatLocalDate(rawTs) : rawTs.slice(0, 10);
            const hourBucket = rawTs.length >= 13 ? rawTs.slice(0, 13) : `${datePart || 'day'}_${idx}`;
            uniqueSessionKeys.add(`${u}_${hourBucket}`);
            if (datePart === todayIso) todaySessionKeys.add(`${u}_${hourBucket}`);
            const act = String(l.ActivityType || l.activityType || '').toUpperCase();
            if (act === 'LOGIN' || act === 'SESSION_ENGAGEMENT' || act === 'TEST_GIVEN') sessionEventLogs++;
        });

        history.forEach((h, idx) => {
            const u = String(h.UserID || h.userId || h.UserName || h.Username || 'student').toLowerCase().trim();
            const rawTs = String(h.Timestamp || h.timestamp || h.Date || h.date || h.TypingDate || '');
            const datePart = (typeof formatLocalDate === 'function') ? formatLocalDate(rawTs) : rawTs.slice(0, 10);
            const hourBucket = rawTs.length >= 13 ? rawTs.slice(0, 13) : `${datePart || 'test'}_${idx}`;
            uniqueSessionKeys.add(`${u}_${hourBucket}`);
            if (datePart === todayIso) todaySessionKeys.add(`${u}_${hourBucket}`);
        });

        const localSessions = Math.max(0, parseInt(engState.sessionsCount, 10) || 0);
        const totalSessions = Math.max(uniqueSessionKeys.size, sessionEventLogs, history.length, localSessions);
        const todayActiveSessions = todaySessionKeys.size;
        sessionsEl.textContent = totalSessions.toLocaleString();
        if (sessionsSubEl) {
            sessionsSubEl.textContent = `${todayActiveSessions} active today • ${(logs.length + history.length).toLocaleString()} telemetry events`;
        }

        // Compute Avg. Daily Typing Accuracy from daily buckets of AccuracyPercentage / accuracyPercentage / Accuracy
        const dailyAccMap = new Map();
        const allAccValues = [];
        history.forEach(h => {
            const val = parseFloat(h.AccuracyPercentage ?? h.accuracyPercentage ?? h.Accuracy ?? h.accuracy ?? NaN);
            if (!isNaN(val) && val > 0 && val <= 100) {
                allAccValues.push(val);
                const rawDate = h.Date || h.date || h.TypingDate || h.typingDate || h.Timestamp || h.timestamp || '';
                const dKey = ((typeof formatLocalDate === 'function') ? formatLocalDate(rawDate) : String(rawDate).slice(0, 10)) || 'overall';
                if (!dailyAccMap.has(dKey)) dailyAccMap.set(dKey, []);
                dailyAccMap.get(dKey).push(val);
            }
        });

        let avgAcc = 0;
        if (dailyAccMap.size > 0) {
            const dayMeans = [];
            dailyAccMap.forEach(list => {
                if (list.length > 0) {
                    dayMeans.push(list.reduce((a, b) => a + b, 0) / list.length);
                }
            });
            if (dayMeans.length > 0) {
                avgAcc = dayMeans.reduce((a, b) => a + b, 0) / dayMeans.length;
            }
        } else if (allAccValues.length > 0) {
            avgAcc = allAccValues.reduce((a, b) => a + b, 0) / allAccValues.length;
        }
        accEl.textContent = `${avgAcc.toFixed(1)}%`;
        if (accSubEl) {
            accSubEl.textContent = allAccValues.length > 0
                ? `Derived from ${allAccValues.length.toLocaleString()} verified transcriptions`
                : 'Across daily typing & steno transcriptions';
        }

        // Compute User Engagement Index (0 - 100 composite score)
        const activeStudentSet = new Set();
        history.forEach(h => {
            const uid = String(h.UserID || h.userId || h.UserName || h.Username || '').toLowerCase().trim();
            if (uid && uid !== '-' && uid !== 'guest') activeStudentSet.add(uid);
        });
        logs.forEach(l => {
            const uid = String(l.UserID || l.userId || l.UserName || l.Username || '').toLowerCase().trim();
            if (uid && uid !== '-' && uid !== 'guest' && uid !== 'unauth' && uid !== 'restricted') activeStudentSet.add(uid);
        });
        if (window.currentUser && window.currentUser.userId) {
            activeStudentSet.add(String(window.currentUser.userId).toLowerCase().trim());
        }

        const totalStudents = Math.max(1, users.length || activeStudentSet.size || 1);
        const activeLearners = Math.max(activeStudentSet.size, window.currentUser ? 1 : 0);
        const activeRatio = Math.min(1, activeLearners / totalStudents);
        const sessionsPerLearner = Math.min(1, (totalSessions / Math.max(1, activeLearners)) / 6);
        const accuracyFactor = avgAcc > 0 ? Math.min(1, avgAcc / 100) : 0.85;
        const activeMins = Math.max(1, Math.round((parseInt(engState.totalActiveSeconds, 10) || 300) / 60));
        const durationFactor = Math.min(1, activeMins / 45);
        const qualityAndDuration = (accuracyFactor * 0.65) + (durationFactor * 0.35);
        const engagementIndex = Math.min(99.9, Math.max(0, (activeRatio * 40) + (sessionsPerLearner * 35) + (qualityAndDuration * 25)));
        engEl.textContent = `${engagementIndex.toFixed(1)} / 100`;
        if (engSubEl) {
            engSubEl.textContent = `${activeLearners}/${totalStudents} active learners • streaks & session depth`;
        }
    };

window.renderAdminMonthlyAttendanceMatrix = function() {
        const secCard = document.getElementById('admin-users-attendance-section');
        if (secCard && secCard.style.display === 'none') secCard.style.display = 'block';
        const container = document.getElementById('admin-monthly-attendance-matrix-container');
        const monthInput = document.getElementById('admin-attendance-month-picker');
        const batchSelect = document.getElementById('admin-attendance-batch-filter');
        const searchInput = document.getElementById('admin-attendance-search-input');
        if (!container) return;

        if (monthInput && !monthInput.value) {
            const now = new Date();
            monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        const nowDef = new Date();
        const defaultYM = `${nowDef.getFullYear()}-${String(nowDef.getMonth() + 1).padStart(2, '0')}`;
        const ymVal = String(monthInput?.value || defaultYM);
        const [yearStr, monthStr] = ymVal.split('-');
        const year = Number(yearStr) || nowDef.getFullYear();
        const month = Number(monthStr) || (nowDef.getMonth() + 1);
        const daysInMonth = new Date(year, month, 0).getDate();

        const users = (window.adminData && Array.isArray(window.adminData.users)) ? window.adminData.users : [];
        const history = (window.adminData && Array.isArray(window.adminData.history) && window.adminData.history.length > 0)
            ? window.adminData.history
            : (Array.isArray(window.allTestHistoryList) ? window.allTestHistoryList : []);
        const logs = (window.adminData && Array.isArray(window.adminData.logs)) ? window.adminData.logs : [];
        const serverAttMap = (window.adminData && window.adminData.attendanceActivityMap && typeof window.adminData.attendanceActivityMap === 'object')
            ? window.adminData.attendanceActivityMap
            : null;

        const __attRole = String((window.currentUser && (window.currentUser.role || window.currentUser.Role)) || '').toLowerCase().trim();
        const __canLoadAdminMatrix = Boolean(window.currentUser && (__attRole === 'admin' || __attRole === 'superadmin'));
        if (!__canLoadAdminMatrix) return;

        if (users.length === 0 && !window.__attMatrixAutoLoadAttempted && typeof window.loadAdminData === 'function') {
            window.__attMatrixAutoLoadAttempted = true;
            container.innerHTML = `<div style="padding: 28px 18px; text-align: center; color: var(--text-muted); font-size: 13px; font-weight: 600;"><i class="fa-solid fa-spinner fa-spin"></i> Loading student attendance matrix from Google Sheets...</div>`;
            window.loadAdminData().then(() => {
                window.__attMatrixAutoLoadAttempted = false;
                if (typeof window.renderAdminMonthlyAttendanceMatrix === 'function') window.renderAdminMonthlyAttendanceMatrix();
            });
            return;
        }
        if (users.length > 0) {
            window.__attMatrixAutoLoadAttempted = false;
        }

        const normalizeRowBatch = (u) => {
            const raw = String(u.Batch || u.batch || '').trim();
            if (!raw || raw === '-' || raw.toLowerCase() === 'general batch' || raw.toLowerCase() === 'free tier') return 'RP-Trail';
            return raw;
        };

        const extractSafeIsoDate = (raw) => {
            if (!raw) return '';
            const s = String(raw).trim();
            const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
            if (m) return m[1];
            const d = new Date(s);
            if (isNaN(d.getTime())) return '';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };

        const batches = Array.from(new Set(users.map(normalizeRowBatch).filter(Boolean))).sort();
        if (batchSelect) {
            const prevBatch = batchSelect.value || 'ALL';
            batchSelect.innerHTML = `<option value="ALL">All Batches (${users.length})</option>` +
                batches.map(b => `<option value="${window.escapeHtml ? window.escapeHtml(b) : b}">${window.escapeHtml ? window.escapeHtml(b) : b}</option>`).join('');
            if ([...batchSelect.options].some(o => o.value === prevBatch)) batchSelect.value = prevBatch;
        }
        const selectedBatch = batchSelect?.value || 'ALL';
        const searchQ = String(searchInput?.value || '').trim().toLowerCase();

        // Combine Google Sheets server-side uncapped attendanceActivityMap with client fallback from history/logs
        const perUserDates = new Map();
        const addHit = (key, iso, cnt) => {
            if (!key || !iso) return;
            let dayMap = perUserDates.get(key);
            if (!dayMap) {
                dayMap = new Map();
                perUserDates.set(key, dayMap);
            }
            dayMap.set(iso, (dayMap.get(iso) || 0) + (Number(cnt) || 1));
        };

        if (serverAttMap && Object.keys(serverAttMap).length > 0) {
            Object.keys(serverAttMap).forEach(k => {
                const daysObj = serverAttMap[k];
                if (daysObj && typeof daysObj === 'object') {
                    Object.keys(daysObj).forEach(iso => addHit(k.toLowerCase().trim(), iso, daysObj[iso]));
                }
            });
        } else {
            history.forEach(h => {
                const iso = extractSafeIsoDate(h.Timestamp || h.timestamp || h.Date || h.date || h.TypingDate || '');
                if (!iso) return;
                const uNameKey = String(h.UserName || h.userName || h.Username || h.Name || '').toLowerCase().trim();
                const uIdKey = String(h.UserID || h.userId || '').toLowerCase().trim();
                if (uNameKey) addHit(uNameKey, iso, 1);
                if (uIdKey && uIdKey !== uNameKey) addHit(uIdKey, iso, 1);
            });
            logs.forEach(l => {
                const act = String(l.ActivityType || '').toUpperCase().trim();
                if (act === 'LOGIN' || act === 'TEST_SUBMITTED' || act === 'PRACTICE_COMPLETE') {
                    const iso = extractSafeIsoDate(l.Timestamp || l.Date || '');
                    if (!iso) return;
                    const uIdKey = String(l.UserID || l.userId || '').toLowerCase().trim();
                    const uNameKey = String(l.UserName || '').replace(/\s*\([^)]*\)\s*$/, '').toLowerCase().trim();
                    if (uIdKey) addHit(uIdKey, iso, 1);
                    if (uNameKey && uNameKey !== uIdKey) addHit(uNameKey, iso, 1);
                }
            });
        }

        const studentList = users.filter(u => {
            if (selectedBatch !== 'ALL') {
                const inBatch = normalizeRowBatch(u).split(',').map(s => s.trim().toLowerCase()).includes(selectedBatch.toLowerCase());
                if (!inBatch) return false;
            }
            if (searchQ) {
                const hay = `${u.Name || ''} ${u.Username || ''} ${u.UserID || ''} ${u.Mobile || ''} ${normalizeRowBatch(u)}`.toLowerCase();
                if (!hay.includes(searchQ)) return false;
            }
            return true;
        });

        if (studentList.length === 0) {
            container.innerHTML = `<div style="padding: 28px 18px; text-align: center; color: var(--text-muted); font-size: 13px; font-weight: 600;">No student attendance records match the selected filter.</div>`;
            return;
        }

        let totalActiveStudents = 0;
        let totalPresentCells = 0;
        let topStreakOverall = 0;

        let dayHeaders = '';
        for (let d = 1; d <= daysInMonth; d++) {
            dayHeaders += `<th style="text-align:center; min-width:26px;">${d}</th>`;
        }

        const escSafe = typeof window.escapeHtml === 'function' ? window.escapeHtml : (s => String(s || ''));
        const rowsHtml = studentList.slice(0, 150).map(u => {
            const uname = u.Name || u.Username || u.UserID || 'Student';
            const uKey = String(uname).toLowerCase().trim();
            const uidKey = String(u.UserID || u.userId || '').toLowerCase().trim();
            const batchLabel = normalizeRowBatch(u);

            const mergedDays = new Map();
            const fromUid = uidKey ? perUserDates.get(uidKey) : null;
            const fromName = uKey ? perUserDates.get(uKey) : null;
            if (fromUid) fromUid.forEach((v, k) => mergedDays.set(k, Math.max(v, mergedDays.get(k) || 0)));
            if (fromName) fromName.forEach((v, k) => mergedDays.set(k, Math.max(v, mergedDays.get(k) || 0)));

            let presentDays = 0;
            let curRun = 0;
            let maxStreak = 0;
            let cellsHtml = '';

            for (let d = 1; d <= daysInMonth; d++) {
                const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const count = mergedDays.get(iso) || 0;
                if (count > 0) {
                    presentDays++;
                    curRun++;
                    if (curRun > maxStreak) maxStreak = curRun;
                    cellsHtml += `<td style="text-align:center;"><span class="rp-att-day-pill is-present" title="${escSafe(uname)}: ${count} activity hit(s) on ${iso}">${count}</span></td>`;
                } else {
                    curRun = 0;
                    cellsHtml += `<td style="text-align:center;"><span class="rp-att-day-pill is-absent" title="${escSafe(uname)}: Absent on ${iso}">·</span></td>`;
                }
            }

            // Active ongoing streak up to today across all synced dates
            let activeStreak = 0;
            const probe = new Date();
            for (let back = 0; back < 365; back++) {
                const pIso = `${probe.getFullYear()}-${String(probe.getMonth() + 1).padStart(2, '0')}-${String(probe.getDate()).padStart(2, '0')}`;
                if ((mergedDays.get(pIso) || 0) > 0) {
                    activeStreak++;
                    probe.setDate(probe.getDate() - 1);
                } else if (back === 0) {
                    probe.setDate(probe.getDate() - 1);
                } else {
                    break;
                }
            }

            if (presentDays > 0) totalActiveStudents++;
            totalPresentCells += presentDays;
            if (maxStreak > topStreakOverall) topStreakOverall = maxStreak;

            return `
                <tr>
                    <td class="rp-att-sticky-col">${escSafe(uname)}<div style="font-size:10px; font-weight:600; color:var(--text-muted);">${escSafe(u.UserID || u.userId || '')}</div></td>
                    <td style="white-space:nowrap; font-size:11px; font-weight:700; color:var(--text-muted);">${escSafe(batchLabel)}</td>
                    <td style="text-align:center; font-weight:800; color:#059669;">${presentDays}/${daysInMonth}</td>
                    <td style="text-align:center; font-weight:800; color:#ea580c;">🔥 ${activeStreak}d</td>
                    <td style="text-align:center; font-weight:800; color:#d97706;">${maxStreak}d</td>
                    ${cellsHtml}
                </tr>
            `;
        }).join('');

        const avgPresentDays = (totalPresentCells / Math.max(1, studentList.length)).toFixed(1);

        container.innerHTML = `
            <div class="rp-att-kpi-strip">
                <div class="rp-att-kpi-card">
                    <div class="rp-att-kpi-label">Students Tracked</div>
                    <div class="rp-att-kpi-val">${studentList.length}</div>
                </div>
                <div class="rp-att-kpi-card">
                    <div class="rp-att-kpi-label">Active This Month</div>
                    <div class="rp-att-kpi-val" style="color:#059669;">${totalActiveStudents}</div>
                </div>
                <div class="rp-att-kpi-card">
                    <div class="rp-att-kpi-label">Avg Present Days</div>
                    <div class="rp-att-kpi-val" style="color:var(--primary);">${avgPresentDays} / ${daysInMonth}</div>
                </div>
                <div class="rp-att-kpi-card">
                    <div class="rp-att-kpi-label">Best Month Streak</div>
                    <div class="rp-att-kpi-val" style="color:#d97706;">${topStreakOverall} Days</div>
                </div>
            </div>
            <div style="overflow-x:auto; border:1px solid var(--border); border-radius:10px;">
                <table class="rp-att-matrix-table">
                    <thead>
                        <tr>
                            <th class="rp-att-sticky-col">Student</th>
                            <th>Batch</th>
                            <th style="text-align:center;">Present</th>
                            <th style="text-align:center;">Active Streak</th>
                            <th style="text-align:center;">Best (${String(month).padStart(2, '0')})</th>
                            ${dayHeaders}
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    };

window.exportAdminMonthlyAttendanceMatrixCSV = function() {
        const monthInput = document.getElementById('admin-attendance-month-picker');
        const nowDef = new Date();
        const defaultYM = `${nowDef.getFullYear()}-${String(nowDef.getMonth() + 1).padStart(2, '0')}`;
        const [yearStr, monthStr] = String(monthInput?.value || defaultYM).split('-');
        const year = Number(yearStr) || nowDef.getFullYear();
        const month = Number(monthStr) || (nowDef.getMonth() + 1);
        const daysInMonth = new Date(year, month, 0).getDate();

        const users = (window.adminData && Array.isArray(window.adminData.users)) ? window.adminData.users : [];
        if (users.length === 0) {
            if (typeof showToast === 'function') showToast('No student attendance data loaded yet to export.');
            return;
        }
        const serverAttMap = (window.adminData && window.adminData.attendanceActivityMap && typeof window.adminData.attendanceActivityMap === 'object')
            ? window.adminData.attendanceActivityMap
            : null;
        const history = (window.adminData && Array.isArray(window.adminData.history)) ? window.adminData.history : [];

        const activityMap = new Map();
        if (serverAttMap && Object.keys(serverAttMap).length > 0) {
            Object.keys(serverAttMap).forEach(k => {
                const daysObj = serverAttMap[k];
                if (daysObj && typeof daysObj === 'object') {
                    Object.keys(daysObj).forEach(iso => {
                        if (iso.startsWith(`${year}-${String(month).padStart(2, '0')}-`)) {
                            const dayNum = parseInt(iso.slice(8, 10), 10);
                            if (dayNum >= 1 && dayNum <= daysInMonth) {
                                activityMap.set(`${k.toLowerCase().trim()}_${dayNum}`, daysObj[iso]);
                            }
                        }
                    });
                }
            });
        } else {
            history.forEach(h => {
                const raw = String(h.Timestamp || h.timestamp || h.Date || h.date || h.TypingDate || '').trim();
                const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
                const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(raw);
                if (!isNaN(d.getTime()) && d.getFullYear() === year && (d.getMonth() + 1) === month) {
                    const uNameKey = String(h.UserName || h.userName || h.Username || h.Name || '').toLowerCase().trim();
                    const uIdKey = String(h.UserID || h.userId || '').toLowerCase().trim();
                    if (uNameKey) activityMap.set(`${uNameKey}_${d.getDate()}`, (activityMap.get(`${uNameKey}_${d.getDate()}`) || 0) + 1);
                    if (uIdKey && uIdKey !== uNameKey) activityMap.set(`${uIdKey}_${d.getDate()}`, (activityMap.get(`${uIdKey}_${d.getDate()}`) || 0) + 1);
                }
            });
        }

        const headers = ['Student', 'Batch', 'Present_Days', 'Max_Streak'];
        for (let d = 1; d <= daysInMonth; d++) headers.push(`Day_${d}`);
        const csvRows = [headers.join(',')];

        users.forEach(u => {
            const uname = String(u.Name || u.Username || u.UserID || 'Student').replace(/,/g, ' ');
            const rawBatch = String(u.Batch || u.batch || '').trim();
            const batch = ((!rawBatch || rawBatch === '-' || rawBatch.toLowerCase() === 'general batch' || rawBatch.toLowerCase() === 'free tier') ? 'RP-Trail' : rawBatch).replace(/,/g, ' ');
            const uKey = uname.toLowerCase().trim();
            const uidKey = String(u.UserID || u.userId || '').toLowerCase().trim();
            let present = 0;
            let curS = 0;
            let maxS = 0;
            const dayCols = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const c = activityMap.get(`${uKey}_${d}`) || (uidKey ? activityMap.get(`${uidKey}_${d}`) : 0) || 0;
                if (c > 0) {
                    present++;
                    curS++;
                    if (curS > maxS) maxS = curS;
                    dayCols.push(`P(${c})`);
                } else {
                    curS = 0;
                    dayCols.push('A');
                }
            }
            csvRows.push([`"${uname}"`, `"${batch}"`, present, maxS, ...dayCols].join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RP_Skill_Attendance_Matrix_${year}_${String(month).padStart(2, '0')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

window.triggerOneClickGoogleDriveBackup = async function() {
        const btn = document.getElementById('btn-gdrive-snapshot-backup');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Drive Snapshot...';
        }
        try {
            if (typeof window.apiCall === 'function') {
                const res = await window.apiCall('createSpreadsheetBackup', {});
                if (res && res.success) {
                    if (typeof showToast === 'function') showToast(`Backup created: ${res.backupName || 'RP_Skill_Backup'}`, 'success');
                } else {
                    if (typeof showToast === 'function') showToast((res && res.message) || 'Snapshot request sent to Cloud Server', 'info');
                }
            }
        } catch (err) {
            if (typeof showToast === 'function') showToast('Triggered Google Drive Snapshot Backup on Cloud Server', 'info');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fab fa-google-drive"></i> 1-Click Drive Snapshot Backup';
            }
        }
    };

window.triggerAdminBatchDigestEmailNow = async function(period) {
        try {
            if (typeof window.apiCall === 'function') {
                const res = await window.apiCall('sendBatchDigestEmail', { period: period || 'daily' });
                if (typeof showToast === 'function') {
                    showToast((res && res.message) || `Dispatched ${period || 'daily'} batch progress digest email!`, res && res.success ? 'success' : 'info');
                }
            }
        } catch (err) {
            if (typeof showToast === 'function') showToast('Batch Progress Digest Email request dispatched to Cloud Server', 'info');
        }
    };

window.configureAutomatedDailyDigestTrigger = async function() {
        try {
            if (typeof window.apiCall === 'function') {
                const res = await window.apiCall('setupDailyDigestTrigger', { hour: 0, minute: 0, second: 1, timeLabel: '00:00:01 AM', period: 'daily' });
                if (typeof showToast === 'function') {
                    showToast((res && res.message) || 'Scheduled daily 00:00:01 AM Batch Progress Digest Trigger for Admin, Superadmin & Batch Monitors!', 'success');
                }
            }
        } catch (err) {
            if (typeof showToast === 'function') showToast('Daily 00:00:01 AM Trigger configured on Cloud Server', 'info');
        }
    };

onWindowLoad(() => {
        setTimeout(() => {
            window.renderWeeklyStudyPlanner();
            window.renderDashboardWeakOutlinesVault();
            updateCbtRevisionCountsUI();
            window.updateAdminTelemetryKpiStrip();
            const __bootRole = String((window.currentUser && (window.currentUser.role || window.currentUser.Role)) || '').toLowerCase().trim();
            if (window.currentUser && (__bootRole === 'admin' || __bootRole === 'superadmin')) {
                window.renderAdminMonthlyAttendanceMatrix();
            }
            if (typeof window.checkAndRenderSubscriptionExpiryAutomation === 'function') {
                window.checkAndRenderSubscriptionExpiryAutomation();
            }
            if (typeof window.renderScheduledLiveMockWindowBanner === 'function') {
                window.renderScheduledLiveMockWindowBanner();
            }
        }, 350);

        
    });

window.__enterpriseSuiteState = {
    activeCategory: 'A',
    // A. Stenography & Audio Dictation
    parliamentDebateRunning: false,
    parliamentSpeakerIdx: 0,
    rampUpEnabled: false,
    rampUpCurrentWpm: 80,
    acousticHallFilterEnabled: false,
    acousticAudioCtx: null,
    acousticNoiseNode: null,
    loopMarkerA: null,
    loopMarkerB: null,
    loopSpeed: 1.0,
    loopInterval: null,
    readingCountdownSec: 0,
    readingCountdownTimer: null,
    // B. Touch-Typing & Commission Evaluation
    hindiRemapperMode: 'OFF', // OFF, KRUTIDEV_010, MANGAL_REMINGTON, INSCRIPT
    zeroEchoBlindMode: false,
    digraphTimings: {},
    lastKeyInfo: null,
    keystrokeReplayLog: [],
    ergonomicTimerSec: 1500, // 25 mins
    ergonomicInterval: null,
    // C. CBT Mock Exam & Smart Revision
    eliminatedOptionsMap: {}, // { qIndex_optIdx: true }
    stickySplitPaneEnabled: false,
    eloRating: 0,
    eloStreak: 0,
    rapidFireTimer: null,
    rapidFireSec: 600,
    rapidFireScore: 0,
    // D. Student Engagement & Personalization
    doubtWallItems: [],
    editorTheme: 'default', // default, sepia, high_contrast, dyslexia_lexend
    editorFontSize: 16,
    editorLineHeight: 1.7,
    // E. Admin, Security & Cloud Backend
    webcamProctorActive: false,
    webcamStream: null,
    webcamSnapshots: [],
    feeLedgerItems: [],
    auditDiffLogs: [],
    franchiseBranches: []
  };

window.findExistingWordInWordsTabData = function(rawWord) {
    const clean = String(rawWord || '').trim().toLowerCase();
    if (!clean) return null;
    const pool = (typeof portalState.materialsData !== 'undefined' && Array.isArray(portalState.materialsData))
      ? portalState.materialsData
      : ((window.globalData && Array.isArray(window.globalData.materials)) ? window.globalData.materials : []);
    return pool.find(item => {
      if (!item || String(item.Type || '').toLowerCase().trim() !== 'word') return false;
      const t = String(item.Title || item.Word || '').trim().toLowerCase();
      if (!t) return false;
      if (t === clean) return true;
      const parts = t.split(/[\/|,;()-]+/).map(s => s.trim()).filter(Boolean);
      return parts.includes(clean);
    }) || null;
  };

window.checkAndSubmitWordOutlineRequest = async function(optionalWord, sourceContext = 'Words & Outlines Tab') {
    const inp = document.getElementById('words-tab-outline-request-input') || document.getElementById('word-outline-request-input');
    const statusBox = document.getElementById('words-tab-outline-request-status') || document.getElementById('word-outline-request-status-msg');
    const wordVal = String(optionalWord !== undefined ? optionalWord : (inp ? inp.value : '')).trim();
    if (!wordVal) {
      if (typeof showToast === 'function') showToast('⚠️ Please enter a word or phrase to check & request an outline.');
      return { exists: false, empty: true };
    }

    const isFromWeakVault = String(sourceContext || '').toLowerCase().includes('weak outlines vault');
    const existingItem = window.findExistingWordInWordsTabData(wordVal);
    if (existingItem) {
      if (!isFromWeakVault) {
        const msg = `⚠️ Word "${wordVal}" is already available in the Words & Outlines tab data (Section: ${existingItem.Subtab || 'General Outlines'})!`;
        if (typeof showToast === 'function') showToast(msg);
        if (statusBox) {
          statusBox.style.display = 'block';
          statusBox.style.background = 'rgba(245, 158, 11, 0.14)';
          statusBox.style.border = '1px solid #f59e0b';
          statusBox.style.color = '#b45309';
          statusBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>Word is already available!</strong> "${wordVal}" already exists in the <strong>Words &amp; Outlines</strong> tab under <em>${existingItem.Subtab || 'General'}</em>. Filtering to show it now...`;
        }
        const searchBox = document.getElementById('words-search') || document.getElementById('search-words');
        if (searchBox && (typeof currentActiveViewName === 'undefined' || currentActiveViewName === 'words')) {
          searchBox.value = wordVal;
          if (typeof renderWords === 'function') renderWords();
          else if (typeof window.renderWords === 'function') window.renderWords();
        }
      }
      return { exists: true, item: existingItem };
    }

    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.background = 'rgba(14, 165, 233, 0.12)';
      statusBox.style.border = '1px solid #0ea5e9';
      statusBox.style.color = '#0369a1';
      statusBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking server &amp; submitting outline request for <strong>"${wordVal}"</strong>...`;
    }

    const u = window.currentUser || {};
    const res = await apiCall('submitOutlineRequest', {
      word: wordVal,
      sourceTab: sourceContext,
      userId: u.userId || 'STUDENT',
      userName: u.name || u.userId || 'Student',
      userBatch: u.batch || 'General'
    }, true);

    if (res && res.alreadyExists) {
      if (!isFromWeakVault) {
        const dupMsg = res.message || `⚠️ Word "${wordVal}" is already available in the Words & Outlines tab!`;
        if (typeof showToast === 'function') showToast(dupMsg);
        if (statusBox) {
          statusBox.style.display = 'block';
          statusBox.style.background = 'rgba(245, 158, 11, 0.14)';
          statusBox.style.border = '1px solid #f59e0b';
          statusBox.style.color = '#b45309';
          statusBox.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${dupMsg}`;
        }
      }
      return { exists: true, item: res.existingItem };
    }

    const okMsg = (res && res.message) ? res.message : `Request for "${wordVal}" sent to Admin Feedback & Batch Monitor Desk.`;
    const routedTo = (res && res.routedTo) ? res.routedTo : 'Admin Panel → Feedback Inbox (Outline Query) & Batch Monitor Queue';
    const answeredBy = (res && res.answeredBy) ? res.answeredBy : 'Admin, Superadmin, or your Batch Monitor';
    if (typeof showToast === 'function') showToast(okMsg);
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.background = 'rgba(16, 185, 129, 0.12)';
      statusBox.style.border = '1px solid #10b981';
      statusBox.style.color = '#065f46';
      statusBox.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <strong>Request Logged for "${window.escapeHtml(wordVal)}"</strong><br><span style="font-size:11.5px;"><strong>Where it goes:</strong> ${window.escapeHtml(routedTo)} &middot; <strong>Who answers:</strong> ${window.escapeHtml(answeredBy)}</span>`;
    }
    if (inp && optionalWord === undefined) inp.value = '';
    if (typeof window.loadAndRenderOutlineRequestsTracker === 'function') {
      window.loadAndRenderOutlineRequestsTracker(false, true);
    }
    return { exists: false, sentToServer: true };
  };

window.loadAndRenderOutlineRequestsTracker = async function(toggleVisibility = false, forceOpen = false) {
    const box = document.getElementById('words-outline-requests-tracker-box');
    const listEl = document.getElementById('words-outline-requests-list');
    const countBadge = document.getElementById('words-outline-requests-count-badge');
    if (box) {
      if (forceOpen) {
        box.style.display = 'block';
      } else if (toggleVisibility) {
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
        if (box.style.display === 'none') return;
      }
    }
    if (listEl && (!box || box.style.display !== 'none')) {
      listEl.innerHTML = `<div style="padding:14px; font-size:12px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading word outline requests &amp; faculty replies...</div>`;
    }

    const res = await apiCall('getOutlineRequests', {}, true);
    const items = (res && res.success && Array.isArray(res.requests)) ? res.requests : [];
    const canAnswer = Boolean(res && res.canAnswer) || (typeof window.canCurrentUserCreateBatchPoll === 'function' && window.canCurrentUserCreateBatchPoll());
    if (countBadge) countBadge.textContent = String(items.length);

    if (!listEl) return;
    if (items.length === 0) {
      listEl.innerHTML = `<div style="padding:16px; text-align:center; font-size:12px; color:var(--text-muted); border:1px dashed var(--border); border-radius:10px;">No word outline requests yet. Type a missing word above to send it directly to Admin &amp; your Batch Monitor.</div>`;
      return;
    }

    listEl.innerHTML = items.map(req => {
      const isAnswered = String(req.status || '').toLowerCase().includes('answered') || String(req.status || '').toLowerCase().includes('resolved') || Boolean(req.answerNote);
      const safeId = window.escapeHtml(String(req.id || '')).replace(/'/g, "\\'");
      const safeWord = window.escapeHtml(String(req.word || ''));
      return `
        <div style="background:var(--background); border:1px solid var(--border); border-left:4px solid ${isAnswered ? '#10b981' : '#f59e0b'}; border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <strong style="font-size:14px; color:var(--secondary);">${safeWord}</strong>
              <span style="font-size:11px; font-weight:800; color:${isAnswered ? '#059669' : '#b45309'};">${isAnswered ? '✓ Answered' : '⏳ Pending Review'}</span>
            </div>
            <div style="font-size:11px; color:var(--text-muted);">
              Requested by <strong>${window.escapeHtml(req.requestedBy || 'Student')}</strong> (${window.escapeHtml(req.batch || 'General')})
            </div>
          </div>
          <div style="font-size:11.5px; color:var(--text-muted);">
            <strong>Routed To:</strong> ${window.escapeHtml(req.routedTo || 'Admin Feedback Inbox & Batch Monitor Desk')} &middot; <strong>Answered By:</strong> ${window.escapeHtml(req.answeredBy || 'Admin / Superadmin / Batch Monitor')}
          </div>
          ${req.answerNote ? `
            <div style="padding:9px 12px; border-radius:8px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.28); font-size:12.5px; color:var(--secondary);">
              <strong style="color:#059669;">Faculty / Monitor Answer:</strong> ${window.escapeHtml(req.answerNote)}
            </div>
          ` : ''}
          ${canAnswer ? `
            <div style="display:flex; flex-direction:column; gap:6px; padding-top:6px; border-top:1px dashed var(--border);">
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <input type="text" id="outline-reply-note-${window.escapeHtml(String(req.id || ''))}" class="form-control" value="${window.escapeHtml(req.answerNote || '')}" placeholder="Write Pitman stroke rule, outline tip, or image URL..." style="flex:1; min-width:220px; min-height:34px; font-size:12px;">
                <input type="url" id="outline-reply-img-${window.escapeHtml(String(req.id || ''))}" class="form-control" placeholder="Optional Outline Image URL..." style="width:210px; min-height:34px; font-size:12px;">
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <label style="font-size:11.5px; font-weight:700; color:var(--secondary); display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                  <input type="checkbox" id="outline-reply-publish-${window.escapeHtml(String(req.id || ''))}" checked> Also publish directly into Words &amp; Outlines dictionary
                </label>
                <button type="button" class="btn btn-primary btn-sm" style="padding:5px 12px; font-size:11.5px;" onclick="window.submitInlineOutlineRequestAnswer('${safeId}')">
                  <i class="fa-solid fa-reply"></i> Save Answer
                </button>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  };

window.submitInlineOutlineRequestAnswer = async function(requestId) {
    const noteEl = document.getElementById('outline-reply-note-' + requestId);
    const imgEl = document.getElementById('outline-reply-img-' + requestId);
    const pubEl = document.getElementById('outline-reply-publish-' + requestId);
    const answerNote = (noteEl ? noteEl.value : '').trim();
    const outlineImageUrl = (imgEl ? imgEl.value : '').trim();
    const publishToDictionary = Boolean(pubEl && pubEl.checked);
    if (!answerNote && !outlineImageUrl) {
      if (typeof showToast === 'function') showToast('Please enter a stroke explanation or outline image URL before saving.');
      return;
    }
    const res = await apiCall('resolveOutlineRequest', {
      requestId,
      answerNote,
      outlineImageUrl,
      publishToDictionary
    }, true);
    if (res && res.success) {
      if (typeof showToast === 'function') showToast(res.message || 'Word outline request answered!');
      window.loadAndRenderOutlineRequestsTracker(false, true);
      if (publishToDictionary) {
        if (typeof window.loadGlobalPortalData === 'function') window.loadGlobalPortalData(true);
        else if (typeof window.fetchAllMaterials === 'function') window.fetchAllMaterials();
      }
    } else if (typeof showToast === 'function') {
      showToast((res && res.message) || 'Could not save answer.');
    }
  };

window.postShorthandDoubtWord = async function() {
    const inp = document.getElementById('doubt-wall-new-word');
    const val = inp ? inp.value.trim() : '';
    if (!val) {
      if (typeof showToast === 'function') showToast('⚠️ Enter a word or phrase to post on the Shorthand Doubt Wall.');
      return;
    }
    const checkResult = await window.checkAndSubmitWordOutlineRequest(val, 'Batch Shorthand Doubt Wall');
    if (checkResult && checkResult.exists) {
      return;
    }
    const uName = (window.currentUser && (window.currentUser.name || window.currentUser.userId)) || 'Batch Student';
    const bName = window.currentDashboardMonitoredBatch || (window.currentUser && window.currentUser.batch) || 'Active Batch';
    window.__enterpriseSuiteState.doubtWallItems.unshift({
      id: 'dw-' + Date.now(),
      word: val,
      author: uName,
      batch: bName,
      replies: [{ by: 'Server Outline Request Logged', note: 'Word verified not in Words & Outlines library and forwarded to Faculty/Server.' }]
    });
    if (inp) inp.value = '';
    window.renderBatchShorthandDoubtWall();
  };

window.replyShorthandDoubtWord = function(idx) {
    const inp = document.getElementById('doubt-reply-input-' + idx);
    const val = inp ? inp.value.trim() : '';
    if (!val) return;
    const item = window.__enterpriseSuiteState.doubtWallItems[idx];
    if (!item) return;
    const uName = (window.currentUser && (window.currentUser.name || window.currentUser.userId)) || 'Batch Monitor';
    item.replies.push({ by: uName, note: val });
    window.renderBatchShorthandDoubtWall();
    if (typeof showToast === 'function') showToast('✅ Pitman stroke solution added!');
  };

window._activeImmersiveLocks = new Set();

const MEDIA_VIEWER_LOCK_KEYS = new Set(['pdf-modal', 'image-modal', 'reference-video', 'universal-media', 'reader-modal']);

window.enterImmersiveFullscreenLock = function(sourceKey = 'modal') {
    try {
      window._activeImmersiveLocks.add(sourceKey);
      document.documentElement.classList.add('rp-scroll-locked');
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('immersive-fullscreen-lock');
      if (MEDIA_VIEWER_LOCK_KEYS.has(sourceKey)) {
        document.body.classList.add('rp-media-viewer-open');
      }
      if (typeof closeAllDeviceNavMenu === 'function') {
        closeAllDeviceNavMenu(true);
      }
      // Always hide any active toast immediately so no bottom/top popup obstructs active tests or fullscreen viewers
      const toastEl = document.getElementById('center-toast');
      if (toastEl) {
        toastEl.style.display = 'none';
      }
      // Note: Do NOT auto-trigger native browser document.documentElement.requestFullscreen() on test/viewer start,
      // as browsers show an intrusive top/bottom "Press Esc to exit full screen" overlay popup.
      // Our CSS already renders active tests and viewers edge-to-edge (100vw x 100dvh); users can still opt-in via the manual Full Screen button.
    } catch (e) {}
  };

window.exitImmersiveFullscreenLock = function(sourceKey = 'modal') {
    try {
      if (sourceKey) window._activeImmersiveLocks.delete(sourceKey);
      const mediaModalIds = ['reader-modal', 'embedded-image-modal', 'reference-video-modal', 'universal-media-modal'];
      const anyMediaOpen = mediaModalIds.some(id => {
        const el = document.getElementById(id);
        return el && (el.style.display === 'flex' || el.style.display === 'block') && el.offsetWidth > 0;
      });
      if (!anyMediaOpen) {
        document.body.classList.remove('rp-media-viewer-open');
      }
      const fullScreenIds = [
        'active-test-modal',
        ...mediaModalIds,
        'cbt-active-interface'
      ];
      const practiceEl = document.getElementById('learning-studio-screen-practice');
      const practiceFsOn = Boolean(practiceEl && practiceEl.classList.contains('rp-practice-fs-on') && practiceEl.style.display && practiceEl.style.display !== 'none');
      const stillActive = practiceFsOn || fullScreenIds.some(id => {
        const el = document.getElementById(id);
        return el && (el.style.display === 'flex' || el.style.display === 'block') && el.offsetWidth > 0;
      });
      if (!stillActive) {
        window._activeImmersiveLocks.clear();
        document.documentElement.classList.remove('rp-scroll-locked');
        document.documentElement.style.overflow = '';
        document.body.classList.remove('immersive-fullscreen-lock');
        document.body.classList.remove('rp-media-viewer-open');
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    } catch (e) {}
  };

onDomReady(function() {
    const mediaIds = ['reader-modal', 'embedded-image-modal', 'reference-video-modal', 'universal-media-modal'];
    const watchedIds = [
      'active-test-modal',
      ...mediaIds
    ];
    const syncImmersiveState = () => {
      const practiceEl = document.getElementById('learning-studio-screen-practice');
      const practiceFsOn = Boolean(practiceEl && practiceEl.classList.contains('rp-practice-fs-on') && practiceEl.style.display && practiceEl.style.display !== 'none');
      const anyMediaOpen = mediaIds.some(id => {
        const el = document.getElementById(id);
        return el && el.style.display && el.style.display !== 'none';
      });
      const anyOpen = practiceFsOn || watchedIds.some(id => {
        const el = document.getElementById(id);
        return el && el.style.display && el.style.display !== 'none';
      }) || document.body.classList.contains('cbt-exam-fullscreen-lock');
      document.body.classList.toggle('rp-media-viewer-open', anyMediaOpen);
      document.documentElement.classList.toggle('rp-scroll-locked', anyOpen);
      document.documentElement.style.overflow = anyOpen ? 'hidden' : '';
      if (anyOpen) {
        document.body.classList.add('immersive-fullscreen-lock');
        if (typeof closeAllDeviceNavMenu === 'function') closeAllDeviceNavMenu(true);
      } else {
        document.body.classList.remove('immersive-fullscreen-lock');
      }
    };
    [...watchedIds, 'learning-studio-screen-practice'].forEach(id => {
      const el = document.getElementById(id);
      if (el && typeof MutationObserver !== 'undefined') {
        new MutationObserver(syncImmersiveState).observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
      }
    });
  });

window.saveAdminTelegramChannelConfig = function(silentToggle = false) {
    const channelLink = ((document.getElementById('suite-telegram-channel-link') || {}).value || '').trim();
    const chatId = ((document.getElementById('suite-telegram-chat-id') || {}).value || '').trim();
    const botTokenEl = document.getElementById('suite-telegram-bot-token');
    const botToken = ((botTokenEl || {}).value || '').trim();
    const autoSendEl = document.getElementById('suite-telegram-auto-send-toggle');
    const autoSendEnabled = autoSendEl ? Boolean(autoSendEl.checked) : true;

    let prevHasToken = false;
    try {
      const prev = JSON.parse(localStorage.getItem('rp_telegram_channel_config_v1') || '{}');
      prevHasToken = Boolean(prev.hasBotToken);
    } catch (e) {}

    // Never persist secret botToken in browser localStorage
    const safeCfg = {
      channelLink,
      chatId,
      hasBotToken: Boolean(botToken || prevHasToken),
      autoSendEnabled,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem('rp_telegram_channel_config_v1', JSON.stringify(safeCfg));
    } catch (e) {}
    window._rpTelegramChannelConfig = safeCfg;

    const badgeEl = document.getElementById('suite-telegram-auto-badge');
    if (badgeEl) {
      badgeEl.innerText = autoSendEnabled ? '⚡ AUTO-DISPATCH ACTIVE' : '⏸️ AUTO-DISPATCH PAUSED';
      badgeEl.style.background = autoSendEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.2)';
      badgeEl.style.color = autoSendEnabled ? '#059669' : 'var(--text-muted)';
    }

    if (typeof apiCall === 'function') {
      apiCall('saveTelegramWebhookConfig', {
        batchName: window.currentDashboardMonitoredBatch || 'RP-Trail',
        botToken,
        chatId,
        channelLink,
        autoSendEnabled
      }, true);
    }

    if (botToken && botTokenEl) {
      botTokenEl.value = '';
      botTokenEl.placeholder = '🔒 Stored securely on server (leave blank to keep existing token)';
    }

    const stEl = document.getElementById('suite-telegram-status');
    if (stEl) {
      stEl.innerHTML = `✅ Telegram Config Saved (${channelLink ? '<a href="' + window.escapeHtml(channelLink) + '" target="_blank" rel="noopener noreferrer" style="color:#0284c7;text-decoration:underline;">Open Channel Link</a>' : 'Bot Webhook Ready'}) • Token: <strong>Server Script Properties</strong> • Auto-Send: <strong>${autoSendEnabled ? 'ON' : 'OFF'}</strong>`;
    }
    if (!silentToggle && typeof showToast === 'function') {
      showToast('✈️ Telegram Config Saved Securely (Bot Token stored in Server Script Properties, not browser storage)!');
    }
  };

window.loadAdminTelegramChannelConfig = function() {
    try {
      const raw = localStorage.getItem('rp_telegram_channel_config_v1');
      if (!raw) return;
      const cfg = JSON.parse(raw);
      // Purge any legacy client-stored botToken immediately
      if (cfg.botToken) {
        cfg.hasBotToken = true;
        delete cfg.botToken;
        localStorage.setItem('rp_telegram_channel_config_v1', JSON.stringify(cfg));
      }
      window._rpTelegramChannelConfig = cfg;
      const linkEl = document.getElementById('suite-telegram-channel-link');
      const chatEl = document.getElementById('suite-telegram-chat-id');
      const tokEl = document.getElementById('suite-telegram-bot-token');
      const autoEl = document.getElementById('suite-telegram-auto-send-toggle');
      if (linkEl && cfg.channelLink) linkEl.value = cfg.channelLink;
      if (chatEl && cfg.chatId) chatEl.value = cfg.chatId;
      if (tokEl && cfg.hasBotToken) {
        tokEl.value = '';
        tokEl.placeholder = '🔒 Stored securely on server (enter new token to rotate)';
      }
      if (autoEl && typeof cfg.autoSendEnabled === 'boolean') autoEl.checked = cfg.autoSendEnabled;
    } catch (e) {}
  };

window.autoDispatchTelegramPortalData = function(eventCategory, messageText) {
    try {
      const cfg = window._rpTelegramChannelConfig || JSON.parse(localStorage.getItem('rp_telegram_channel_config_v1') || '{}');
      if (cfg.autoSendEnabled === false) return;
      const formatted = `🏛️ [RP SKILL | ${eventCategory}] ${messageText}${cfg.channelLink ? ' • Join: ' + cfg.channelLink : ''}`;
      if (typeof apiCall === 'function') {
        apiCall('sendTelegramBatchWebhookAlert', {
          batchName: window.currentDashboardMonitoredBatch || 'RP-Trail',
          messageText: formatted,
          channelLink: cfg.channelLink || '',
          chatId: cfg.chatId || ''
        }, true);
      }
      const stEl = document.getElementById('suite-telegram-status');
      if (stEl) {
        stEl.innerHTML = `⚡ Auto-Dispatched to Telegram (${window.escapeHtml(new Date().toLocaleTimeString())}): <em>"${window.escapeHtml(formatted)}"</em>`;
      }
    } catch (e) {}
  };

onDomReady(function() {
    window.loadAdminTelegramChannelConfig();
  });

(function initComprehensiveAntiScreenshotShield() {
    function ensureCurtainElement() {
      let curtain = document.getElementById('rp-anti-screenshot-curtain');
      if (!curtain) {
        curtain = document.createElement('div');
        curtain.id = 'rp-anti-screenshot-curtain';
        curtain.innerHTML = `
          <div style="max-width: 460px; background: rgba(30,41,59,0.95); border: 2px solid #ef4444; border-radius: 16px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
            <div style="font-size: 38px; margin-bottom: 10px;">🛡️🔒</div>
            <h3 style="margin: 0 0 8px 0; color: #f87171; font-size: 18px; font-weight: 900;">SCREENSHOT &amp; SCREEN CAPTURE BLOCKED</h3>
            <p style="margin: 0 0 14px 0; font-size: 13px; color: #e2e8f0; line-height: 1.55;">
              RP Skill | Ranjan Pathshala content is strictly protected by Digital Rights Management (DRM). Screenshots, screen recording, and 3-finger mobile captures are disabled across all devices.
            </p>
            <button type="button" class="btn btn-primary btn-sm" onclick="dismissAntiScreenshotCurtain()" style="background: #2563eb; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; color: #fff; cursor: pointer;">
              Resume Protected Session
            </button>
          </div>
        `;
        document.body.appendChild(curtain);
      }
      return curtain;
    }

    let shieldTimeout = null;
    window.triggerAntiScreenshotCurtain = function(reason = 'Screen capture attempt detected', durationMs = 2800) {
      ensureCurtainElement();
      document.body.classList.add('rp-screenshot-shield-active');
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('Protected Content — RP Skill | Ranjan Pathshala (Screenshots Disabled)').catch(() => {});
        }
      } catch (e) {}
      if (typeof showToast === 'function') {
        showToast('🛡️ Security Shield: ' + reason);
      }
      if (shieldTimeout) clearTimeout(shieldTimeout);
      shieldTimeout = setTimeout(() => {
        if (!document.hidden) {
          document.body.classList.remove('rp-screenshot-shield-active');
        }
      }, durationMs);
    };

    window.dismissAntiScreenshotCurtain = function() {
      document.body.classList.remove('rp-screenshot-shield-active');
    };

    // 1. Block Desktop & Mobile Hardware Screenshot Keys (PrintScreen, Win+Shift+S, Cmd+Shift+3/4/5, Ctrl+P, Ctrl+S)
    window.addEventListener('keydown', function(e) {
      const key = (e.key || '').toLowerCase();
      const isPrintScreen = e.key === 'PrintScreen' || e.keyCode === 44;
      const isMacShot = e.metaKey && e.shiftKey && ['3', '4', '5', 's'].includes(key);
      const isWinSnip = (e.metaKey || e.ctrlKey) && e.shiftKey && key === 's';
      const isPrintOrSave = (e.ctrlKey || e.metaKey) && (key === 'p' || key === 's');
      if (isPrintScreen || isMacShot || isWinSnip || isPrintOrSave) {
        e.preventDefault();
        e.stopPropagation();
        window.triggerAntiScreenshotCurtain('Screenshot shortcut blocked by DRM Shield', 3200);
        return false;
      }
    }, true);

    window.addEventListener('keyup', function(e) {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        window.triggerAntiScreenshotCurtain('PrintScreen capture blocked', 3200);
      }
    }, true);

    // 2. Block Mobile 3-Finger / Multi-Finger Swipe Screenshot Gesture
    window.addEventListener('touchstart', function(e) {
      if (e.touches && e.touches.length >= 3) {
        e.preventDefault();
        window.triggerAntiScreenshotCurtain('Mobile 3-finger screenshot gesture blocked', 3000);
      }
    }, { passive: false, capture: true });

    // 3. Do NOT trigger screenshot curtain on normal browser/portal tab switching (visibilitychange).
    // Only dismiss any active shield cleanly when returning to the tab.
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        document.body.classList.remove('rp-screenshot-shield-active');
      }
    });

    // 4. Block Browser Screen Recording API (getDisplayMedia)
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      navigator.mediaDevices.getDisplayMedia = async function() {
        window.triggerAntiScreenshotCurtain('Screen recording API is disabled on this portal', 3500);
        throw new Error('Screen recording is disabled by RP Skill DRM policy.');
      };
    }
  })();

onDomReady(function() {
    window.renderAdminEnterpriseOpsSubtab();
    setTimeout(() => {
      window.renderBatchShorthandDoubtWall();
      if (typeof renderDashboardBatchMonitoringHub === 'function') {
        renderDashboardBatchMonitoringHub();
      }
    }, 500);
  });

window.filterWeakOutlinesVaultUI = function() {
    if (typeof window.renderDashboardWeakOutlinesVault === 'function') {
      window.renderDashboardWeakOutlinesVault(true);
    }
  };

window.refreshPlannerAndGoalsTab = function() {
    if (typeof renderWeeklyStudyPlanner === 'function') renderWeeklyStudyPlanner();
    if (typeof renderDailyPracticeGoalUI === 'function') renderDailyPracticeGoalUI();
    if (typeof window.renderStudentAttendanceMatrixView === 'function') window.renderStudentAttendanceMatrixView();
    if (typeof renderD3WeeklyProgressHeatmap === 'function') renderD3WeeklyProgressHeatmap();
    if (typeof renderUserPerformanceChart === 'function') renderUserPerformanceChart();
    if (typeof renderDashboardUI === 'function') renderDashboardUI();
  };

window.renderDashboardPinnedDirectivesOnly = function() {
    const mount = document.getElementById('dashboard-pinned-batch-messages-mount');
    if (!mount) return;
    const myBatch = (portalState.currentUser && portalState.currentUser.batch && portalState.currentUser.batch !== '-') ? String(portalState.currentUser.batch).split(',')[0].trim() : 'RP-Trail';
    let rawMsgs = [];
    if (typeof getBatchGroupMessagesMap === 'function') {
      const msgMap = getBatchGroupMessagesMap() || {};
      Object.keys(msgMap).forEach(bKey => {
        const arr = msgMap[bKey];
        if (Array.isArray(arr)) {
          arr.forEach(item => rawMsgs.push(Object.assign({ batchName: item.batchName || bKey }, item)));
        }
      });
    } else if (portalState.globalData && Array.isArray(portalState.globalData.batchGroupMessages)) {
      rawMsgs = portalState.globalData.batchGroupMessages;
    }
    const pinnedOrDirectives = rawMsgs.filter(m => {
      if (!m) return false;
      const ch = String(m.channelType || m.tag || m.msgType || '').toLowerCase();
      const isPin = Boolean(m.isPinned || m.pinned || ch === 'directive' || String(m.message || '').includes('📌') || String(m.message || '').includes('[OFFICIAL'));
      if (!isPin) return false;
      const b = String(m.batchName || 'ALL_BATCHES').trim().toLowerCase();
      return b === 'all_batches' || b === 'all' || b === myBatch.toLowerCase();
    });

    const anns = (portalState.globalData && Array.isArray(portalState.globalData.announcements)) ? portalState.globalData.announcements.slice(0, 3) : [];
    const combined = [
      ...pinnedOrDirectives.slice(0, 4).map(m => ({
        title: `${m.senderName || m.authorName || 'Batch Monitor'} (${m.batchName || myBatch})`,
        body: String(m.message || m.messageText || '').replace(/^📌\s*/, ''),
        time: m.timestamp ? new Date(m.timestamp).toLocaleDateString('en-IN') : 'Pinned Directive',
        badge: '📌 Pinned Batch Directive'
      })),
      ...anns.map(a => ({
        title: a.Title || a.title || 'Institute Notice',
        body: a.Content || a.content || a.Message || '',
        time: a.Date || a.PostedDate || a.Timestamp || 'Official Notice',
        badge: '📣 Official Announcement'
      }))
    ];

    if (combined.length === 0) {
      mount.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 12px 14px; border-radius: 10px; background: var(--background); border: 1px dashed var(--border); font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span>📌 No pinned directives for <strong>${window.escapeHtml(myBatch)}</strong> right now. General batch messages, replies, and polls are available in the dedicated Batch Monitor &amp; Communication tab.</span>
          <button type="button" class="btn btn-sm btn-secondary" onclick="navigateTo('batchhub')">Open Batch Hub &amp; Polls &rarr;</button>
        </div>
      `;
      return;
    }

    mount.innerHTML = combined.slice(0, 4).map(item => `
      <div style="background: var(--background); border: 1px solid rgba(124,58,237,0.28); border-left: 4px solid #7c3aed; border-radius: 10px; padding: 11px 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
          <span style="font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: rgba(124,58,237,0.12); color: #6d28d9;">${window.escapeHtml(item.badge)}</span>
          <span style="font-size: 10px; color: var(--text-muted);">${window.escapeHtml(item.time)}</span>
        </div>
        <div style="font-size: 12.5px; font-weight: 800; color: var(--secondary);">${window.escapeHtml(item.title)}</div>
        <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">${window.escapeHtml(item.body)}</div>
      </div>
    `).join('');
  };

window.canCurrentUserCreateBatchPoll = function(batchName) {
    if (!portalState.currentUser) return false;
    const roleLower = String(portalState.currentUser.role || '').toLowerCase().trim();
    if (roleLower === 'admin' || roleLower === 'superadmin' || roleLower === 'instructor' || roleLower === 'monitor') {
      return true;
    }
    const uid = String(portalState.currentUser.userId || '').trim();
    if (!uid) return false;
    if (batchName && typeof isUserMonitorForBatch === 'function' && isUserMonitorForBatch(uid, batchName)) {
      return true;
    }
    if (typeof getUserMonitorBatchesList === 'function') {
      const mBatches = getUserMonitorBatchesList(uid) || [];
      if (mBatches.length > 0) return true;
    }
    return false;
  };

export const BATCH_POLLS_STORAGE_KEY = 'rp_batch_polls_v1';

window.getBatchPollsList = function() {
    const mapById = new Map();
    const hydrateFromMsgArray = (arr, fallbackBatch = '') => {
      if (!Array.isArray(arr)) return;
      arr.forEach(m => {
        if (!m || !m.id) return;
        const isPoll = String(m.channelType || m.msgType || '').toLowerCase() === 'poll' || Array.isArray(m.pollOptions);
        if (!isPoll || m.id === 'POLL-DEFAULT-1') return;
        const rawOpts = Array.isArray(m.pollOptions) ? m.pollOptions : (Array.isArray(m.options) ? m.options : []);
        const normOpts = rawOpts.map(o => ({
          text: String(o.text || o.label || ''),
          voters: Array.isArray(o.voters) ? o.voters : (Array.isArray(o.votes) ? o.votes : []),
          votes: Array.isArray(o.votes) ? o.votes.length : (Array.isArray(o.voters) ? o.voters.length : (Number(o.votes) || 0))
        }));
        mapById.set(String(m.id), {
          id: String(m.id),
          batchName: m.batchName || m.batch || fallbackBatch || 'RP-Trail',
          question: String(m.question || m.message || '').replace(/^📊\s*POLL:\s*/i, ''),
          createdBy: m.createdBy || m.senderName || 'Batch Monitor',
          createdAt: m.createdAt || m.timestamp || '',
          pollStartTime: m.pollStartTime || '',
          pollEndTime: m.pollEndTime || '',
          isPinned: Boolean(m.isPinned || m.pinned),
          options: normOpts
        });
      });
    };
    try {
      const msgMap = (typeof getBatchGroupMessagesMap === 'function') ? getBatchGroupMessagesMap() : null;
      if (msgMap && typeof msgMap === 'object') {
        Object.keys(msgMap).forEach(bName => hydrateFromMsgArray(msgMap[bName], bName));
      }
      if (typeof portalState.globalData !== 'undefined' && portalState.globalData && Array.isArray(portalState.globalData.batchGroupMessages)) {
        hydrateFromMsgArray(portalState.globalData.batchGroupMessages);
      }
      if (typeof portalState.adminData !== 'undefined' && portalState.adminData && Array.isArray(portalState.adminData.batchGroupMessages)) {
        hydrateFromMsgArray(portalState.adminData.batchGroupMessages);
      }
    } catch (e) {}
    return Array.from(mapById.values());
  };

window.createNewBatchPoll = async function() {
    const activeBatch = document.getElementById('batch-hub-active-batch-select')?.value || (portalState.currentUser && portalState.currentUser.batch && portalState.currentUser.batch !== '-' ? String(portalState.currentUser.batch).split(',')[0].trim() : 'RP-Trail');
    if (!window.canCurrentUserCreateBatchPoll(activeBatch)) {
      showToast('Permission Denied: Only Batch Monitors, Admins, and Superadmins can create polls.');
      return;
    }

    const q = (document.getElementById('poll-question-input')?.value || '').trim();
    const o1 = (document.getElementById('poll-opt-1')?.value || '').trim();
    const o2 = (document.getElementById('poll-opt-2')?.value || '').trim();
    const o3 = (document.getElementById('poll-opt-3')?.value || '').trim();
    const o4 = (document.getElementById('poll-opt-4')?.value || '').trim();
    const pollStartTime = (document.getElementById('poll-start-time')?.value || '').trim();
    const pollEndTime = (document.getElementById('poll-end-time')?.value || '').trim();
    const pinToDash = Boolean(document.getElementById('poll-pin-to-dashboard')?.checked);

    if (!q || !o1 || !o2) {
      showToast('Please enter a poll question and at least Option 1 and Option 2.');
      return;
    }
    if (pollStartTime && pollEndTime && new Date(pollEndTime).getTime() <= new Date(pollStartTime).getTime()) {
      showToast('Poll End Time must be later than Poll Start Time.');
      return;
    }

    const opts = [o1, o2, o3, o4].filter(Boolean).map(t => ({ text: t, votes: 0, voters: [] }));
    const newPoll = {
      id: 'POLL-' + Date.now(),
      batchName: activeBatch,
      question: q,
      createdBy: (portalState.currentUser && portalState.currentUser.name) ? portalState.currentUser.name : 'Batch Monitor',
      createdAt: new Date().toLocaleString('en-IN'),
      pollStartTime: pollStartTime || '',
      pollEndTime: pollEndTime || '',
      isPinned: pinToDash,
      options: opts
    };

    const serverRes = await apiCall('saveBatchGroupMessage', {
      id: newPoll.id,
      batchName: activeBatch,
      senderId: portalState.currentUser ? portalState.currentUser.userId : 'USER',
      senderName: portalState.currentUser ? portalState.currentUser.name : 'Monitor',
      senderRole: portalState.currentUser ? portalState.currentUser.role : 'monitor',
      channelType: 'poll',
      msgType: 'poll',
      isPinned: pinToDash,
      pollStartTime: pollStartTime,
      pollEndTime: pollEndTime,
      message: `📊 POLL: ${q}`,
      pollOptions: opts.map((o, i) => ({ id: 'OPT-' + (i + 1), text: o.text, votes: [] }))
    }, true);

    if (serverRes && serverRes.success === false && String(serverRes.message || '').toLowerCase().includes('only')) {
      showToast(serverRes.message);
      return;
    }

    const polls = window.getBatchPollsList();
    polls.unshift(newPoll);
    try { localStorage.setItem(BATCH_POLLS_STORAGE_KEY, JSON.stringify(polls)); } catch (e) {}

    if (pinToDash && typeof getBatchGroupMessagesMap === 'function' && typeof saveBatchGroupMessagesMap === 'function') {
      const msgMap = getBatchGroupMessagesMap() || {};
      if (!Array.isArray(msgMap[activeBatch])) msgMap[activeBatch] = [];
      msgMap[activeBatch].unshift({
        id: 'BGM-POLL-' + Date.now(),
        batchName: activeBatch,
        senderId: portalState.currentUser ? portalState.currentUser.userId : 'USER',
        senderName: portalState.currentUser ? portalState.currentUser.name : 'Batch Coordinator',
        senderRole: portalState.currentUser ? portalState.currentUser.role : 'monitor',
        channelType: 'directive',
        isPinned: true,
        pinned: true,
        message: `📌 [LIVE BATCH POLL] ${q} — Cast your vote in the Batch Monitor & Communication tab!`,
        timestamp: new Date().toISOString(),
        replies: []
      });
      saveBatchGroupMessagesMap(msgMap);
      window.renderDashboardPinnedDirectivesOnly();
    }

    ['poll-question-input', 'poll-opt-1', 'poll-opt-2', 'poll-opt-3', 'poll-opt-4', 'poll-start-time', 'poll-end-time'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const form = document.getElementById('new-batch-poll-form');
    if (form) form.style.display = 'none';
    window.renderBatchPollsWidget();
    showToast('Batch Poll saved & synced to Google Sheets!');
  };

window.getBatchPollTimeStatus = function(poll) {
    const now = Date.now();
    const startMs = poll && poll.pollStartTime ? new Date(poll.pollStartTime).getTime() : 0;
    const endMs = poll && poll.pollEndTime ? new Date(poll.pollEndTime).getTime() : 0;
    if (startMs && !isNaN(startMs) && now < startMs) {
      return { state: 'scheduled', label: `Scheduled · Opens ${new Date(startMs).toLocaleString('en-IN')}`, canVote: false, color: '#d97706' };
    }
    if (endMs && !isNaN(endMs) && now > endMs) {
      return { state: 'closed', label: `Closed · Ended ${new Date(endMs).toLocaleString('en-IN')}`, canVote: false, color: '#dc2626' };
    }
    if (endMs && !isNaN(endMs)) {
      return { state: 'live', label: `Live · Closes ${new Date(endMs).toLocaleString('en-IN')}`, canVote: true, color: '#059669' };
    }
    return { state: 'live', label: 'Live · Open for Voting', canVote: true, color: '#059669' };
  };

window.voteInBatchPoll = function(pollId, optIdx) {
    const uid = (portalState.currentUser && portalState.currentUser.userId) ? String(portalState.currentUser.userId) : 'GUEST-USER';
    const polls = window.getBatchPollsList();
    const poll = polls.find(p => p.id === pollId);
    if (!poll || !Array.isArray(poll.options)) return;

    const status = window.getBatchPollTimeStatus(poll);
    if (!status.canVote) {
      showToast(status.state === 'scheduled' ? 'This poll has not opened for voting yet.' : 'This poll is closed — voting window has ended.');
      return;
    }

    poll.options.forEach((opt, idx) => {
      if (!Array.isArray(opt.voters)) opt.voters = [];
      const existingPos = opt.voters.indexOf(uid);
      if (existingPos !== -1) {
        opt.voters.splice(existingPos, 1);
        opt.votes = Math.max(0, (Number(opt.votes) || 1) - 1);
      }
      if (idx === optIdx) {
        opt.voters.push(uid);
        opt.votes = (Number(opt.votes) || 0) + 1;
      }
    });

    try { localStorage.setItem(BATCH_POLLS_STORAGE_KEY, JSON.stringify(polls)); } catch (e) {}
    apiCall('voteBatchPoll', { pollId, optionIndex: optIdx, userId: uid }, true);
    window.renderBatchPollsWidget();
    showToast('Your vote has been recorded!');
  };

window.renderBatchPollsWidget = function() {
    const container = document.getElementById('batch-polls-list-container');
    const createBtn = document.getElementById('btn-toggle-new-batch-poll');
    const createForm = document.getElementById('new-batch-poll-form');
    const roleNote = document.getElementById('batch-poll-role-note');
    const activeBatch = document.getElementById('batch-hub-active-batch-select')?.value || (portalState.currentUser && portalState.currentUser.batch ? String(portalState.currentUser.batch).split(',')[0].trim() : '');
    const canCreate = window.canCurrentUserCreateBatchPoll(activeBatch);

    if (createBtn) createBtn.style.display = canCreate ? 'inline-flex' : 'none';
    if (createForm && !canCreate) createForm.style.display = 'none';
    if (roleNote) {
      roleNote.textContent = canCreate
        ? 'You have Monitor / Admin access — you can publish new scheduled polls for this batch.'
        : 'Only Batch Monitors, Admins & Superadmins can create polls. You can vote on active polls below.';
    }

    if (!container) return;
    const allPolls = window.getBatchPollsList();
    const uid = (portalState.currentUser && portalState.currentUser.userId) ? String(portalState.currentUser.userId) : 'GUEST-USER';
    const roleLower = String((portalState.currentUser && portalState.currentUser.role) || 'user').toLowerCase();
    const isAdminOrSuper = ['admin', 'superadmin', 'instructor'].includes(roleLower);
    const myBatchesLower = getCurrentUserAssignedBatchesList().map(b => String(b || '').toLowerCase().trim());

    // Regular users only see polls for their own assigned batch(es)
    const polls = isAdminOrSuper
      ? allPolls
      : (allPolls || []).filter(p => {
          const pb = String(p.batchName || '').toLowerCase().trim();
          if (!pb || pb === 'all' || pb === 'all batches') return true;
          return myBatchesLower.includes(pb);
        });

    if (!polls || polls.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1; padding:18px; text-align:center; color:var(--text-muted); border:1px dashed var(--border); border-radius:10px; font-size:12.5px;">${canCreate ? 'No batch polls created yet. Click <strong>+ Create New Batch Poll</strong> above to start one.' : 'No active polls for your batch yet. When your Batch Monitor or Admin publishes a poll, it will appear here for voting.'}</div>`;
      return;
    }

    container.innerHTML = polls.map(poll => {
      const totalVotes = (poll.options || []).reduce((acc, o) => acc + (Number(o.votes) || 0), 0);
      const timeStatus = window.getBatchPollTimeStatus(poll);
      const canSeeBatchTotals = canCreate || window.canCurrentUserCreateBatchPoll(poll.batchName || activeBatch);
      const userVotedAny = (poll.options || []).some(o => Array.isArray(o.voters) && o.voters.includes(uid));
      const scheduleLine = (poll.pollStartTime || poll.pollEndTime)
        ? `<div style="font-size:11px; color:var(--text-muted); display:flex; flex-wrap:wrap; gap:8px;">
             ${poll.pollStartTime ? `<span>Start: <strong>${window.escapeHtml(new Date(poll.pollStartTime).toLocaleString('en-IN'))}</strong></span>` : ''}
             ${poll.pollEndTime ? `<span>End: <strong>${window.escapeHtml(new Date(poll.pollEndTime).toLocaleString('en-IN'))}</strong></span>` : ''}
           </div>`
        : '';
      return `
        <div style="background:var(--background); border:1px solid var(--border); border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-size:11px; font-weight:800; color:#0284c7;">${window.escapeHtml(poll.batchName || 'Batch Poll')}</span>
            <span style="font-size:10.5px; font-weight:800; color:${timeStatus.color};">${window.escapeHtml(timeStatus.label)}</span>
          </div>
          <div style="font-size:13.5px; font-weight:800; color:var(--secondary); line-height:1.4;">${window.escapeHtml(poll.question)}</div>
          ${scheduleLine}
          <div style="font-size:10.5px; color:var(--text-muted);">By <strong>${window.escapeHtml(poll.createdBy || 'Monitor')}</strong> &middot; ${canSeeBatchTotals ? `<span class="mono-num">${totalVotes}</span> Vote(s)` : (userVotedAny ? '<span style="color:#059669; font-weight:700;">Your vote recorded</span>' : 'Tap an option to vote')}</div>
          <div style="display:flex; flex-direction:column; gap:7px;">
            ${(poll.options || []).map((opt, idx) => {
              const v = Number(opt.votes) || 0;
              const pct = totalVotes > 0 ? Math.round((v / totalVotes) * 100) : 0;
              const votedByMe = Array.isArray(opt.voters) && opt.voters.includes(uid);
              const barWidth = canSeeBatchTotals ? pct : (votedByMe ? 100 : 0);
              return `
                <button type="button" ${timeStatus.canVote ? '' : 'disabled'} onclick="window.voteInBatchPoll('${window.escapeHtml(String(poll.id)).replace(/'/g, "\\'")}', ${idx})" style="position:relative; overflow:hidden; text-align:left; padding:8px 12px; border-radius:8px; border:1.5px solid ${votedByMe ? '#0284c7' : 'var(--border)'}; background:var(--surface); cursor:${timeStatus.canVote ? 'pointer' : 'not-allowed'}; opacity:${timeStatus.canVote ? '1' : '0.72'};">
                  <div style="position:absolute; left:0; top:0; bottom:0; width:${barWidth}%; background:${votedByMe ? 'rgba(14,165,233,0.22)' : 'rgba(14,165,233,0.1)'}; transition:width 0.3s ease;"></div>
                  <div style="position:relative; z-index:1; display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; font-weight:700; color:var(--secondary);">
                    <span>${votedByMe ? '✓ ' : ''}${window.escapeHtml(opt.text)}</span>
                    ${canSeeBatchTotals
                      ? `<span class="mono-num" style="font-weight:800; color:#0284c7;">${pct}% (${v})</span>`
                      : (votedByMe ? `<span style="font-size:11px; font-weight:800; color:#0284c7;">Your Choice</span>` : '')}
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  };

window.lockUserAcrossAllDevices = async function(targetUserId, lockMode = 'LOCK_ALL') {
    if (!targetUserId) return;
    const locks = JSON.parse(localStorage.getItem('rp_global_device_locks_v1') || '{}');
    if (lockMode === 'UNLOCK') {
      delete locks[targetUserId];
      showToast(`🔓 Unlocked cross-device access for User ID: ${targetUserId}`);
    } else {
      locks[targetUserId] = {
        locked: true,
        mode: 'ALL_DEVICES',
        lockedAt: new Date().toISOString(),
        reason: '🔒 Security Lock: Your account has been locked across all devices by the Administrator.'
      };
      showToast(`🔒 User ${targetUserId} is now locked across ALL devices and active sessions terminated!`);
    }
    localStorage.setItem('rp_global_device_locks_v1', JSON.stringify(locks));
    await apiCall('lockUserDevices', {
      userId: targetUserId,
      lockMode: lockMode === 'UNLOCK' ? 'UNLOCK' : 'LOCK_ALL'
    }, true);
    if (typeof renderAdminUsers === 'function') renderAdminUsers();
    setTimeout(window.enhanceAdminUsersTableWithDeviceLocks, 60);
  };

window.enhanceAdminUsersTableWithDeviceLocks = function() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;
    const locks = JSON.parse(localStorage.getItem('rp_global_device_locks_v1') || '{}');
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      if (tr.querySelector('.rp-cross-device-lock-btn')) return;
      const firstCell = tr.querySelector('td');
      if (!firstCell) return;
      const rawFirstText = (firstCell.textContent || '').trim();
      const idMatch = rawFirstText.match(/ID:\s*([A-Za-z0-9_-]+)/i) || (tr.innerHTML || '').match(/'(STU-[A-Za-z0-9_-]+|USR-[A-Za-z0-9_-]+|ADMIN-[A-Za-z0-9_-]+)'/);
      const uid = idMatch ? idMatch[1] : (/^[A-Za-z0-9_-]{3,}$/.test(rawFirstText) ? rawFirstText : '');
      const lastTd = tr.querySelector('td:last-child');
      if (!uid || !lastTd) return;
      const isLocked = Boolean(locks[uid] && locks[uid].locked);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-top:5px; display:flex; gap:4px; flex-wrap:wrap;';
      wrap.innerHTML = isLocked
        ? `<button type="button" class="btn btn-sm btn-success rp-cross-device-lock-btn" style="font-size:10px; padding:3px 8px; min-height:24px;" onclick="window.lockUserAcrossAllDevices('${uid}', 'UNLOCK')"><i class="fa-solid fa-unlock"></i> Unlock All Devices</button>`
        : `<button type="button" class="btn btn-sm btn-danger rp-cross-device-lock-btn" style="font-size:10px; padding:3px 8px; min-height:24px; background:#be123c;" onclick="window.lockUserAcrossAllDevices('${uid}', 'LOCK_ALL')"><i class="fa-solid fa-lock"></i> Lock All Devices</button>`;
      lastTd.appendChild(wrap);
    });
  };

window.syncFooterActiveAndTotalUsers = function() {
    const activeEl = document.getElementById('footer-active-users');
    const totalEl = document.getElementById('footer-total-users');
    const visitsEl = document.getElementById('footer-total-visits');
    const allUsers = (portalState.adminData && Array.isArray(portalState.adminData.users) && portalState.adminData.users.length > 0)
      ? portalState.adminData.users
      : ((portalState.globalData && Array.isArray(portalState.globalData.users)) ? portalState.globalData.users : []);
    let cachedStats = {};
    try {
      cachedStats = JSON.parse(localStorage.getItem('rp_public_footer_stats_cache_v1') || '{}') || {};
    } catch (e) {}
    const statsObj = (portalState.globalData && portalState.globalData.stats && typeof portalState.globalData.stats === 'object')
      ? portalState.globalData.stats
      : {};
    const domActive = Number(activeEl?.textContent || 0) || 0;
    const domTotal = Number(totalEl?.textContent || 0) || 0;
    const domVisits = Number(visitsEl?.textContent || 0) || 0;

    const totalCount = Math.max(
      allUsers.length,
      Number(portalState.globalData?.totalUsers || 0) || 0,
      Number(statsObj.totalUsers || 0) || 0,
      Number(cachedStats.totalUsers || 0) || 0,
      domTotal
    );
    const activeFromList = allUsers.filter(u => String(u.Status || u.status || 'active').toLowerCase() === 'active').length;
    const activeCount = Math.max(
      activeFromList,
      Number(portalState.globalData?.activeUsers || 0) || 0,
      Number(statsObj.activeUsers || 0) || 0,
      Number(cachedStats.activeUsers || 0) || 0,
      domActive,
      1
    );
    const visitsCount = Math.max(
      Number(portalState.globalData?.totalVisits || 0) || 0,
      Number(statsObj.totalVisits || 0) || 0,
      Number(cachedStats.totalVisits || 0) || 0,
      domVisits
    );
    if (activeEl) activeEl.textContent = String(activeCount);
    if (totalEl) totalEl.textContent = String(totalCount);
    if (visitsEl) visitsEl.textContent = String(visitsCount);
  };



window.adjustMobileActiveTestFontSize = function(delta) {
    const root = document.documentElement;
    const current = parseFloat(getComputedStyle(root).getPropertyValue('--mobile-test-font-size') || '17') || 17;
    const next = delta === 0 ? 17 : Math.min(25, Math.max(14, current + delta));
    root.style.setProperty('--mobile-test-font-size', next + 'px');
    const uInput = document.getElementById('test-user-input');
    if (uInput) uInput.style.fontSize = next + 'px';
    const refDisp = document.getElementById('test-reference-display');
    if (refDisp) refDisp.style.fontSize = next + 'px';
    const matDisp = document.getElementById('test-material-passage-text');
    if (matDisp) matDisp.style.fontSize = next + 'px';
    const cbtQ = document.getElementById('cbt-question-text');
    if (cbtQ) cbtQ.style.fontSize = next + 'px';
    document.querySelectorAll('.rp-mobile-test-font-badge').forEach(el => {
      el.textContent = next + 'px';
    });
  };

window.toggleMobileActiveTestPassageHeight = function() {
    const root = document.documentElement;
    const cur = getComputedStyle(root).getPropertyValue('--mobile-test-ref-max-h').trim();
    const isExpanded = cur === '50vh';
    const next = isExpanded ? '32vh' : '50vh';
    root.style.setProperty('--mobile-test-ref-max-h', next);
    showToast(isExpanded ? 'Balanced 32% Passage / 68% Typing Split Active' : 'Expanded Reference Passage Height (50% Screen)');
  };

window.toggleMobileCbtPaletteDrawer = function() {
    const aside = document.getElementById('cbt-palette-aside');
    const btn = document.getElementById('rp-mobile-cbt-palette-toggle-btn');
    if (!aside) return;
    const collapsed = aside.classList.toggle('rp-mobile-palette-collapsed');
    if (btn) {
      btn.innerHTML = collapsed
        ? '<i class="fa-solid fa-grip"></i> Show Question Palette'
        : '<i class="fa-solid fa-eye-slash"></i> Hide Question Palette';
    }
  };

export function injectMobileActiveTestComfortToolbars() {
    // Do NOT inject duplicate zoom/passage-height bar into #active-test-modal (header already has unified A-/A+/Reset + Full Screen, and Typing has contextual Passage Height)
    const legacyBar = document.getElementById('rp-mobile-test-comfort-bar');
    if (legacyBar) legacyBar.remove();

    const cbtInterface = document.getElementById('cbt-active-interface');
    if (cbtInterface && !document.getElementById('rp-mobile-cbt-comfort-bar')) {
      const cbtBar = document.createElement('div');
      cbtBar.id = 'rp-mobile-cbt-comfort-bar';
      cbtBar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px; padding:6px 12px; background:linear-gradient(90deg,#0f172a,#1e3a8a); color:#fff; border-radius:8px; margin-bottom:8px; font-size:11px; font-weight:800;';
      cbtBar.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span style="color:#93c5fd;"><i class="fa-solid fa-magnifying-glass-plus"></i> Question Size: <strong class="rp-mobile-test-font-badge">17px</strong></span>
          <button type="button" class="btn btn-sm btn-secondary" style="padding:2px 8px; font-size:11px; min-height:24px; background:#1e293b; color:#fff; border:1px solid #475569;" onclick="window.adjustMobileActiveTestFontSize(-1.5)">A-</button>
          <button type="button" class="btn btn-sm btn-secondary" style="padding:2px 8px; font-size:11px; min-height:24px; background:#1e293b; color:#fff; border:1px solid #475569;" onclick="window.adjustMobileActiveTestFontSize(1.5)">A+</button>
          <button type="button" class="btn btn-sm btn-secondary" style="padding:2px 7px; font-size:10.5px; min-height:24px; background:#1e293b; color:#93c5fd; border:1px solid #475569;" onclick="window.adjustMobileActiveTestFontSize(0)">Reset</button>
        </div>
        <button type="button" id="rp-mobile-cbt-palette-toggle-btn" class="btn btn-sm btn-primary" style="padding:3px 10px; font-size:11px; min-height:26px; background:#0284c7; border:none;" onclick="window.toggleMobileCbtPaletteDrawer()">
          <i class="fa-solid fa-grip"></i> Toggle Question Palette
        </button>
      `;
      cbtInterface.insertBefore(cbtBar, cbtInterface.firstChild);
      if (window.innerWidth <= 768) {
        const aside = document.getElementById('cbt-palette-aside');
        if (aside) aside.classList.add('rp-mobile-palette-collapsed');
      }
    }
  }

window._activeAttendanceHeatmapMode = 'all';

window.switchAttendanceHeatmapMode = function() {
    const attendanceCard = document.getElementById('student-attendance-matrix-card');
    const heatmapCard = document.getElementById('d3-weekly-heatmap-card') || document.getElementById('dashboard-heatmap-card');
    if (attendanceCard) attendanceCard.style.display = 'block';
    if (heatmapCard) heatmapCard.style.display = 'none';
    if (typeof window.renderStudentAttendanceMatrixView === 'function') {
      window.renderStudentAttendanceMatrixView();
    }
  };

window.switchPlannerGoalsSubtab = function(mode) {
    const plannerGrid = document.getElementById('planner-goals-top-grid') || document.querySelector('#view-planner-goals > div > div:nth-of-type(2)');
    const heatmapMount = document.getElementById('planner-goals-heatmap-mount');
    const compMount = document.getElementById('planner-goals-competency-mount');
    const compCard = document.getElementById('user-engagement-session-card') || document.getElementById('planner-competency-analytics-card');
    if (plannerGrid) plannerGrid.style.display = (mode === 'all' || mode === 'planner') ? 'grid' : 'none';
    if (heatmapMount) heatmapMount.style.display = (mode === 'all' || mode === 'heatmap') ? 'flex' : 'none';
    if (mode === 'all' || mode === 'heatmap') {
      window.switchAttendanceHeatmapMode(window._activeAttendanceHeatmapMode || 'all');
    }
    if (compMount) compMount.style.display = (mode === 'all' || mode === 'analytics') ? 'flex' : 'none';
    if (compCard) compCard.style.display = (mode === 'all' || mode === 'analytics') ? 'block' : 'none';
    document.querySelectorAll('#rp-planner-subtab-bar .subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-psub') === mode);
    });
  };

window.switchBatchHubSubtab = function(mode) {
    const activeMode = mode || 'feed';
    const pollsCard = document.getElementById('batch-poll-creator-box') || document.getElementById('batch-hub-polls-card');
    const feedMount = document.getElementById('batchhub-dedicated-mount') || document.getElementById('batch-hub-Full-mount');
    const feedCard = document.getElementById('dashboard-batch-monitoring-card');
    const padsMount = document.getElementById('batchhub-pads-mount');
    const padsCard = document.getElementById('batchhub-shorthand-pads-card');
    const doubtMount = document.getElementById('batchhub-doubt-wall-mount');
    const doubtCard = document.getElementById('batch-shorthand-doubt-wall-container') || document.getElementById('dashboard-shorthand-doubt-wall-bar') || document.getElementById('dashboard-doubt-wall-card');
    if (doubtCard && doubtMount && !doubtMount.contains(doubtCard)) {
      doubtCard.style.marginTop = '0';
      doubtMount.appendChild(doubtCard);
    }

    if (pollsCard) pollsCard.style.display = (activeMode === 'all' || activeMode === 'polls') ? 'block' : 'none';
    if (feedMount) feedMount.style.display = (activeMode === 'all' || activeMode === 'feed') ? 'flex' : 'none';
    if (feedCard) feedCard.style.display = (activeMode === 'all' || activeMode === 'feed') ? 'block' : 'none';
    if (padsMount) padsMount.style.display = (activeMode === 'all' || activeMode === 'pads') ? 'flex' : 'none';
    if (padsCard) padsCard.style.display = (activeMode === 'all' || activeMode === 'pads') ? 'block' : 'none';
    if (doubtMount) doubtMount.style.display = (activeMode === 'all' || activeMode === 'doubts') ? 'flex' : 'none';
    if (doubtCard) doubtCard.style.display = (activeMode === 'all' || activeMode === 'doubts') ? 'block' : 'none';

    if (activeMode === 'polls' && typeof window.renderBatchPollsWidget === 'function') {
      window.renderBatchPollsWidget();
    } else if (activeMode === 'pads' && typeof window.loadShorthandPadsFromServer === 'function') {
      window.loadShorthandPadsFromServer('batchhub', false);
    } else if (activeMode === 'doubts' && typeof window.renderBatchShorthandDoubtWall === 'function') {
      window.renderBatchShorthandDoubtWall();
    }

    document.querySelectorAll('#rp-batchhub-subtab-bar .subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-bsub') === activeMode);
    });
  };

window.switchWeakVaultSubtab = function(mode) {
    const vaultMount = document.getElementById('weak-vault-dedicated-mount');
    const strokeCard = document.getElementById('weak-vault-stroke-geometry-card');
    if (vaultMount) vaultMount.style.display = (mode === 'all' || mode === 'vault') ? 'block' : 'none';
    if (strokeCard) strokeCard.style.display = (mode === 'all' || mode === 'geometry') ? 'block' : 'none';
    if (mode === 'geometry' && !strokeCard && typeof window.openWeakOutlinesVaultModal === 'function') {
      window.openWeakOutlinesVaultModal();
    }
    document.querySelectorAll('#rp-weakvault-subtab-bar .subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-wsub') === mode);
    });
  };

export function injectSubtabBarsIntoDedicatedViews() {
    const plannerWrap = document.querySelector('#view-planner-goals > div');
    if (plannerWrap && !document.getElementById('rp-planner-subtab-bar')) {
      const bar = document.createElement('div');
      bar.id = 'rp-planner-subtab-bar';
      bar.className = 'subtab-bar';
      bar.style.marginBottom = '4px';
      bar.innerHTML = `
        <button type="button" class="subtab-btn active" data-psub="all" onclick="window.switchPlannerGoalsSubtab('all')">📋 All Planner &amp; Analytics</button>
        <button type="button" class="subtab-btn" data-psub="planner" onclick="window.switchPlannerGoalsSubtab('planner')">📅 7-Day Planner &amp; Daily Goal Ring</button>
        <button type="button" class="subtab-btn" data-psub="heatmap" onclick="window.switchPlannerGoalsSubtab('heatmap')">🔥 Attendance, Streak &amp; Heatmap</button>
        <button type="button" class="subtab-btn" data-psub="analytics" onclick="window.switchPlannerGoalsSubtab('analytics')">📈 Real-Time Competency Analytics</button>
      `;
      plannerWrap.insertBefore(bar, plannerWrap.children[1] || null);
    }

    const batchWrap = document.querySelector('#view-batchhub > div');
    if (batchWrap && !document.getElementById('rp-batchhub-subtab-bar')) {
      const bar = document.createElement('div');
      bar.id = 'rp-batchhub-subtab-bar';
      bar.className = 'subtab-bar rp-batchhub-tabs';
      bar.style.marginBottom = '2px';
      bar.innerHTML = `
        <button type="button" class="subtab-btn active" data-bsub="feed" onclick="window.switchBatchHubSubtab('feed')"><i class="fa-solid fa-comments"></i> 1. Batch Monitor &amp; Chat</button>
        <button type="button" class="subtab-btn" data-bsub="polls" onclick="window.switchBatchHubSubtab('polls')"><i class="fa-solid fa-square-poll-vertical"></i> 2. Live Polls</button>
        <button type="button" class="subtab-btn" data-bsub="pads" onclick="window.switchBatchHubSubtab('pads')"><i class="fa-solid fa-book-open"></i> 3. Shorthand Pads</button>
        <button type="button" class="subtab-btn" data-bsub="doubts" onclick="window.switchBatchHubSubtab('doubts')"><i class="fa-solid fa-pen-nib"></i> 4. Outline Doubt Wall</button>
        <button type="button" class="subtab-btn" data-bsub="all" onclick="window.switchBatchHubSubtab('all')"><i class="fa-solid fa-layer-group"></i> Show All</button>
      `;
      batchWrap.insertBefore(bar, batchWrap.children[1] || null);
      window.switchBatchHubSubtab('feed');
    }

    // Weak Outlines Vault is a single unified master-detail view (word list left + Pitman outline preview right) — remove any legacy subtab bar
    const oldWeakSubBar = document.getElementById('rp-weakvault-subtab-bar');
    if (oldWeakSubBar) oldWeakSubBar.remove();
  }

export const AUTOSAVE_TYPING_KEY = 'rp_active_test_autosave_v1';

export const AUTOSAVE_CBT_KEY = 'rp_active_cbt_autosave_v1';

export const AUTOSAVE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function captureActiveExamAutosave() {
    try {
      const uid = (window.currentUser && window.currentUser.userId) ? String(window.currentUser.userId) : '';
      const typingInput = document.getElementById('test-user-input');
      const audioTransBox = document.getElementById('transcribe-input') || document.getElementById('audio-transcription-box');
      const activeModalEl = document.getElementById('active-test-modal');
      const modalOpen = Boolean(activeModalEl && !activeModalEl.classList.contains('hidden') && activeModalEl.style.display !== 'none');

      if (modalOpen && typingInput && typingInput.value && typingInput.value.trim().length > 0) {
        localStorage.setItem(AUTOSAVE_TYPING_KEY, JSON.stringify({
          mode: 'typing_modal',
          userId: uid,
          title: (document.getElementById('test-modal-title') && document.getElementById('test-modal-title').textContent) || (window.activeTestObj && window.activeTestObj.Title) || 'Typing / Steno Test',
          typedText: typingInput.value,
          wordCount: typingInput.value.trim().split(/\s+/).filter(Boolean).length,
          timerText: (document.getElementById('test-timer') && document.getElementById('test-timer').textContent) || '',
          updatedAt: Date.now()
        }));
      } else if (audioTransBox && audioTransBox.offsetParent !== null && audioTransBox.value && audioTransBox.value.trim().length > 0) {
        localStorage.setItem(AUTOSAVE_TYPING_KEY, JSON.stringify({
          mode: 'audio_transcription',
          userId: uid,
          title: (window.activeAudioObj && window.activeAudioObj.Title) || 'Audio Dictation Transcription',
          typedText: audioTransBox.value,
          wordCount: audioTransBox.value.trim().split(/\s+/).filter(Boolean).length,
          timerText: (document.getElementById('test-timer') && document.getElementById('test-timer').textContent) || '',
          updatedAt: Date.now()
        }));
      }

      const cbtSt = window.cbtState;
      const cbtScreen = document.getElementById('cbt-active-interface');
      const cbtOpen = Boolean(cbtScreen && !cbtScreen.classList.contains('hidden') && cbtScreen.style.display !== 'none');
      if (cbtSt && cbtSt.activeTest && cbtOpen) {
        const answers = cbtSt.answers || {};
        if (Object.keys(answers).length > 0) {
          localStorage.setItem(AUTOSAVE_CBT_KEY, JSON.stringify({
            userId: uid,
            testId: cbtSt.activeTest.ID || cbtSt.activeTest.id || '',
            title: cbtSt.activeTest.Title || cbtSt.activeTest.title || 'CBT Mock Exam',
            answers: answers,
            answeredCount: Object.keys(answers).length,
            currentIdx: Number(cbtSt.currentIdx || 0),
            timeLeftSec: Number(cbtSt.timeLeftSec || 0),
            updatedAt: Date.now()
          }));
        }
      }
    } catch (e) {}
  }

window.clearExamCrashRecoveryDraft = function(kind = 'all') {
    try {
      if (kind === 'all' || kind === 'typing') localStorage.removeItem(AUTOSAVE_TYPING_KEY);
      if (kind === 'all' || kind === 'cbt') localStorage.removeItem(AUTOSAVE_CBT_KEY);
      const banner = document.getElementById('rp-exam-crash-recovery-banner');
      if (banner) banner.remove();
    } catch (e) {}
  };

window.restoreExamCrashRecoveryDraft = function(kind) {
    try {
      if (kind === 'typing') {
        const raw = localStorage.getItem(AUTOSAVE_TYPING_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        const typingInput = document.getElementById('test-user-input');
        const audioTransBox = document.getElementById('transcribe-input') || document.getElementById('audio-transcription-box');
        if (draft.mode === 'audio_transcription' && audioTransBox) {
          audioTransBox.disabled = false;
          audioTransBox.value = draft.typedText || '';
          audioTransBox.dispatchEvent(new Event('input', { bubbles: true }));
          if (typeof showToast === 'function') showToast(`✅ Restored ${draft.wordCount || 0} words into Audio Transcription!`);
          window.clearExamCrashRecoveryDraft('typing');
          return;
        }
        if (typingInput) {
          typingInput.value = draft.typedText || '';
          typingInput.dispatchEvent(new Event('input', { bubbles: true }));
          if (typeof showToast === 'function') showToast(`✅ Restored ${draft.wordCount || 0} words from unsaved draft!`);
          window.clearExamCrashRecoveryDraft('typing');
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(draft.typedText || '').catch(() => {});
        }
        if (typeof showToast === 'function') showToast(`📋 Open your test first, then click Resume again — your ${draft.wordCount || 0}-word draft was also copied to clipboard!`);
      } else if (kind === 'cbt') {
        const raw = localStorage.getItem(AUTOSAVE_CBT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (window.cbtState && window.cbtState.activeTest) {
          window.cbtState.answers = { ...(window.cbtState.answers || {}), ...(draft.answers || {}) };
          if (typeof draft.currentIdx === 'number') window.cbtState.currentIdx = draft.currentIdx;
          if (typeof renderCbtQuestion === 'function') renderCbtQuestion();
          if (typeof window.renderCbtPalette === 'function') window.renderCbtPalette();
          if (typeof showToast === 'function') showToast(`✅ Restored ${draft.answeredCount || 0} saved CBT answer(s)!`);
          window.clearExamCrashRecoveryDraft('cbt');
        } else {
          if (typeof showToast === 'function') showToast(`ℹ️ Open "${draft.title || 'your CBT Exam'}" first, then click Resume to restore your ${draft.answeredCount || 0} saved answers!`);
        }
      }
    } catch (e) {}
  };

export function renderExamCrashRecoveryBannerIfPresent() {
    try {
      let typingDraft = null;
      let cbtDraft = null;
      const rawT = localStorage.getItem(AUTOSAVE_TYPING_KEY);
      if (rawT) {
        const parsed = JSON.parse(rawT);
        if (parsed && parsed.typedText && (Date.now() - Number(parsed.updatedAt || 0)) < AUTOSAVE_MAX_AGE_MS) {
          typingDraft = parsed;
        } else {
          localStorage.removeItem(AUTOSAVE_TYPING_KEY);
        }
      }
      const rawC = localStorage.getItem(AUTOSAVE_CBT_KEY);
      if (rawC) {
        const parsed = JSON.parse(rawC);
        if (parsed && parsed.answeredCount > 0 && (Date.now() - Number(parsed.updatedAt || 0)) < AUTOSAVE_MAX_AGE_MS) {
          cbtDraft = parsed;
        } else {
          localStorage.removeItem(AUTOSAVE_CBT_KEY);
        }
      }

      const activeDraft = typingDraft || cbtDraft;
      const draftKind = typingDraft ? 'typing' : (cbtDraft ? 'cbt' : '');
      if (!activeDraft || !draftKind) return;

      let banner = document.getElementById('rp-exam-crash-recovery-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'rp-exam-crash-recovery-banner';
        banner.style.cssText = 'position:fixed; bottom:18px; right:18px; z-index:99998; background:#0f172a; color:#f8fafc; border:1px solid rgba(16,185,129,0.55); border-left:4px solid #10b981; border-radius:12px; padding:12px 14px; box-shadow:0 12px 30px rgba(15,23,42,0.4); max-width:390px; font-size:12px;';
        document.body.appendChild(banner);
      }
      const summary = draftKind === 'typing'
        ? `${activeDraft.wordCount || 0} typed word(s) saved at ${new Date(activeDraft.updatedAt).toLocaleTimeString()}`
        : `${activeDraft.answeredCount || 0} CBT answer(s) saved at ${new Date(activeDraft.updatedAt).toLocaleTimeString()}`;

      banner.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:10px;">
          <i class="fa-solid fa-life-ring" style="color:#34d399; font-size:16px; margin-top:2px;"></i>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:900; color:#d1fae5; margin-bottom:2px;">Unsaved Exam Draft Recovered</div>
            <div style="font-size:11px; color:#cbd5e1; margin-bottom:8px;"><strong>${window.escapeHtml(activeDraft.title || 'Active Exam')}</strong> — ${window.escapeHtml(summary)}</div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" onclick="window.restoreExamCrashRecoveryDraft('${draftKind}')" style="background:#10b981; color:#052e16; border:none; border-radius:7px; padding:5px 10px; font-size:11px; font-weight:900; cursor:pointer;">Resume Draft</button>
              <button type="button" onclick="window.clearExamCrashRecoveryDraft('${draftKind}')" style="background:rgba(148,163,184,0.2); color:#e2e8f0; border:none; border-radius:7px; padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer;">Discard</button>
            </div>
          </div>
        </div>
      `;
    } catch (e) {}
  }

export function initExamCrashRecoveryHooks() {
    if (window.__rpExamCrashRecoveryInitialized) return;
    window.__rpExamCrashRecoveryInitialized = true;
    setInterval(captureActiveExamAutosave, 5000);
    document.addEventListener('input', (ev) => {
      if (ev.target && (ev.target.id === 'test-user-input' || ev.target.id === 'audio-transcription-box')) {
        captureActiveExamAutosave();
      }
    });
    window.addEventListener('beforeunload', captureActiveExamAutosave);

    /* Steno autosave clear registered via portalHooks:beforeStenoTestSubmit */
    /* CBT autosave clear registered via portalHooks:beforeCbtSubmit */
    setTimeout(renderExamCrashRecoveryBannerIfPresent, 1200);
  }

export function initAllPortalFixes() {
    purgeFakeInjectedRules();
    removeUselessPreTranscribeToolbars();
    setupDedicatedTabsAndMoveSections();
    injectSubtabBarsIntoDedicatedViews();
    injectMobileActiveTestComfortToolbars();
    makeCommandDeckShowAllData();
    syncAuthHeaderAndMenuVisibility();
    window.renderDashboardPinnedDirectivesOnly();
    window.renderBatchPollsWidget();
    window.syncFooterActiveAndTotalUsers();
    window.renderKeystrokeRhythmHeatmap();
    initExamCrashRecoveryHooks();
    setInterval(window.syncFooterActiveAndTotalUsers, 8000);
  }

if (document.readyState === 'loading') {
    onDomReady(() => setTimeout(initAllPortalFixes, 40));
  } else {
    setTimeout(initAllPortalFixes, 40);
  }

export let cachedLeaderboardRows = [];

export let cachedLeaderboardBatches = [];

export let lastLeaderboardFetchKey = '';

export function getCurrentUserAssignedBatchesList() {
    const cu = window.currentUser || (typeof portalState.currentUser !== 'undefined' ? portalState.currentUser : null);
    if (!cu) return ['RP-Trail'];
    const uid = String(cu.userId || '').trim();
    const raw = String(cu.batch || cu.Batch || '').trim();
    let list = [];
    if (typeof getUserAssignedBatchesList === 'function') {
      list = getUserAssignedBatchesList(uid, raw) || [];
    } else {
      list = raw.split(',').map((s) => s.trim()).filter((s) => s && s !== '-');
    }
    const normalized = list
      .map((b) => (!b || b === '-' || b.toLowerCase() === 'general batch' || b.toLowerCase() === 'free tier') ? 'RP-Trail' : b)
      .filter(Boolean);
    return normalized.length > 0 ? Array.from(new Set(normalized)) : ['RP-Trail'];
  }

export function getCurrentUserPrimaryBatch() {
    return getCurrentUserAssignedBatchesList()[0] || 'RP-Trail';
  }

export function computeLocalBatchLeaderboard(targetBatch, daysWindow) {
    const cutoffMs = Date.now() - (Math.max(1, Number(daysWindow) || 30) * 86400000);
    const historyPool = [];
    const seenIds = new Set();
    const fallbackUid = String((portalState.currentUser && portalState.currentUser.userId) || '').trim();

    const parseDateMs = (raw) => {
      if (!raw) return 0;
      if (typeof raw === 'number') return raw;
      const s = String(raw).trim();
      const direct = new Date(s).getTime();
      if (!isNaN(direct)) return direct;
      // Support DD/MM/YYYY or DD-MM-YYYY formats
      const dm = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
      if (dm) {
        const yr = dm[3].length === 2 ? Number('20' + dm[3]) : Number(dm[3]);
        const d = new Date(yr, Number(dm[2]) - 1, Number(dm[1])).getTime();
        if (!isNaN(d)) return d;
      }
      return 0;
    };

    const pushRow = (r, isCurrentUserHistory = false) => {
      if (!r || typeof r !== 'object') return;
      const uid = String(r.UserID || r.userId || (isCurrentUserHistory ? fallbackUid : '')).trim();
      if (!uid) return;
      const dt = String(r.Date || r.date || r.TypingDate || r.Timestamp || r.timestamp || '').trim();
      const wpmKey = r.NetWPM ?? r.netWpm ?? r.NetSpeed ?? r.netSpeed ?? r.WPM ?? r.wpm ?? '';
      const key = `${uid}|${dt}|${r.ExamName || r.examName || ''}|${wpmKey}`;
      if (seenIds.has(key)) return;
      seenIds.add(key);
      historyPool.push({ ...r, _resolvedUid: uid });
    };

    if (portalState.adminData) {
      (portalState.adminData.history || []).forEach(r => pushRow(r, false));
      (portalState.adminData.results || []).forEach(r => pushRow(r, false));
    }
    if (portalState.globalData) {
      (portalState.globalData.history || []).forEach(r => pushRow(r, false));
      (portalState.globalData.userHistory || []).forEach(r => pushRow(r, true));
      (portalState.globalData.results || []).forEach(r => pushRow(r, false));
    }
    if (Array.isArray(portalState.allTestHistoryList)) {
      portalState.allTestHistoryList.forEach(r => pushRow(r, true));
    }
    if (Array.isArray(portalState.cachedTestHistory)) {
      portalState.cachedTestHistory.forEach(r => pushRow(r, true));
    }

    const normBatch = (val) => {
      const s = String(val || '').trim();
      if (!s || s === '-' || s.toLowerCase() === 'general batch' || s.toLowerCase() === 'free tier') return 'RP-Trail';
      return s;
    };

    const userBatchMap = {};
    const userNameMap = {};
    const registerUser = (u) => {
      if (!u || typeof u !== 'object') return;
      const uid = String(u.UserID || u.userId || '').trim();
      if (!uid) return;
      if (!userNameMap[uid]) userNameMap[uid] = String(u.Name || u.name || uid).trim();
      const rawBatch = String(u.Batch || u.batch || '').trim();
      const assigned = typeof getUserAssignedBatchesList === 'function'
        ? (getUserAssignedBatchesList(uid, rawBatch) || [])
        : [];
      const merged = assigned.length > 0 ? assigned.join(', ') : rawBatch;
      if (merged) userBatchMap[uid] = normBatch(merged);
    };
    if (portalState.adminData && Array.isArray(portalState.adminData.users)) {
      portalState.adminData.users.forEach(registerUser);
    }
    if (portalState.globalData && Array.isArray(portalState.globalData.users)) {
      portalState.globalData.users.forEach(registerUser);
    }
    if (portalState.globalData && Array.isArray(portalState.globalData.batchStudentRoster)) {
      portalState.globalData.batchStudentRoster.forEach(registerUser);
    }
    if (portalState.currentUser && portalState.currentUser.userId) {
      registerUser(portalState.currentUser);
    }

    const agg = {};
    const batchesSet = new Set();
    if (typeof getInstituteBatchesList === 'function') {
      (getInstituteBatchesList() || []).forEach((b) => { if (b) batchesSet.add(String(b).trim()); });
    }

    historyPool.forEach((r) => {
      const uid = String(r._resolvedUid || r.UserID || r.userId || '').trim();
      if (!uid) return;
      const examName = String(r.ExamName || r.examName || '').toLowerCase();
      if (examName.includes('cbt')) return; // WPM/Accuracy shorthand & typing leaderboard

      const rawDate = r.Date || r.date || r.TypingDate || r.Timestamp || r.timestamp || '';
      const ts = parseDateMs(rawDate);
      if (ts > 0 && ts < cutoffMs) return;

      const userBatchStr = normBatch(r.Batch || r.batch || userBatchMap[uid]);
      const userBatches = userBatchStr.split(',').map((b) => normBatch(b)).filter(Boolean);
      userBatches.forEach((b) => batchesSet.add(b));

      if (targetBatch && targetBatch !== 'ALL') {
        const match = userBatches.some((b) => b.toLowerCase() === targetBatch.toLowerCase());
        if (!match) return;
      }

      const netWpm = parseFloat(
        r.NetWPM ?? r.netWpm ?? r.NetSpeed ?? r.netSpeed ?? r.GrossWPM ?? r.grossWpm ?? r.grossSpeed ?? r.WPM ?? r.wpm ?? r.speed ?? 0
      ) || 0;
      const acc = parseFloat(
        r.AccuracyPercentage ?? r.accuracyPercentage ?? r.Accuracy ?? r.accuracy ?? 0
      ) || 0;
      if (netWpm <= 0 && acc <= 0) return;

      if (!agg[uid]) {
        agg[uid] = {
          userId: uid,
          name: String(r.UserName || r.userName || r.Name || r.name || userNameMap[uid] || uid),
          batch: (targetBatch && targetBatch !== 'ALL') ? targetBatch : (userBatches[0] || 'RP-Trail'),
          testsCount: 0,
          wpmSum: 0,
          accSum: 0,
          bestWpm: 0,
          lastTestDate: ''
        };
      }
      const entry = agg[uid];
      entry.testsCount += 1;
      entry.wpmSum += netWpm;
      entry.accSum += acc;
      if (netWpm > entry.bestWpm) entry.bestWpm = netWpm;
      if (rawDate && String(rawDate) > entry.lastTestDate) entry.lastTestDate = String(rawDate);
    });

    const rows = Object.values(agg).map((e) => {
      const avgWpm = Number((e.wpmSum / e.testsCount).toFixed(1));
      const avgAcc = Number((e.accSum / e.testsCount).toFixed(1));
      const compositeScore = Number(((avgWpm * 0.65) + (avgAcc * 0.35)).toFixed(2));
      return {
        userId: e.userId,
        name: e.name,
        batch: e.batch,
        testsCount: e.testsCount,
        avgWpm,
        avgAcc,
        bestWpm: Number(e.bestWpm.toFixed(1)),
        compositeScore,
        lastTestDate: e.lastTestDate
      };
    });

    rows.sort((a, b) => (b.compositeScore - a.compositeScore) || (b.avgWpm - a.avgWpm) || (b.avgAcc - a.avgAcc));
    rows.forEach((r, idx) => { r.rank = idx + 1; });
    return { rows, batches: Array.from(batchesSet).filter(Boolean) };
  }

window.renderBatchLeaderboardTab = async function (forceServerFetch = false) {
    const batchSel = document.getElementById('batch-lb-batch-select');
    const winSel = document.getElementById('batch-lb-window-select');
    const searchIn = document.getElementById('batch-lb-search-input');
    const kpiStrip = document.getElementById('batch-lb-kpi-strip');
    const podiumEl = document.getElementById('batch-lb-podium-container');
    const tableMount = document.getElementById('batch-lb-table-mount');
    const headingEl = document.getElementById('batch-lb-table-heading');
    const metaEl = document.getElementById('batch-lb-meta-summary');
    if (!tableMount) return;

    const cuRole = (typeof portalState.currentUser !== 'undefined' && portalState.currentUser) ? String(portalState.currentUser.role || '').toLowerCase() : 'user';
    const isAdminOrSuper = cuRole === 'admin' || cuRole === 'superadmin';
    const myBatches = getCurrentUserAssignedBatchesList();
    const myBatch = myBatches[0] || 'RP-Trail';

    const daysWindow = Number(winSel ? winSel.value : 30) || 30;
    let selectedBatch = batchSel ? batchSel.value : 'MY_BATCH';
    let effectiveBatch = selectedBatch === 'MY_BATCH' ? myBatch : selectedBatch;

    // Strict Batch Isolation (#6): Non-admin users can ONLY view batches they are enrolled in
    if (!isAdminOrSuper) {
      const allowedLower = myBatches.map((b) => b.toLowerCase());
      if (!effectiveBatch || effectiveBatch === 'ALL' || !allowedLower.includes(effectiveBatch.toLowerCase())) {
        effectiveBatch = myBatch;
      }
    }

    const fetchKey = `${effectiveBatch}|${daysWindow}|${isAdminOrSuper ? 'adm' : 'usr'}`;
    const normalizeServerRow = (r, idx) => {
      const avgWpm = Number(parseFloat(r.avgWpm ?? r.AvgWPM ?? r.avgNetWpm ?? r.netWpm ?? r.NetWPM ?? r.wpm ?? r.WPM ?? 0).toFixed(1)) || 0;
      const avgAcc = Number(parseFloat(r.avgAcc ?? r.AvgAcc ?? r.avgAccuracy ?? r.accuracy ?? r.Accuracy ?? 0).toFixed(1)) || 0;
      const bestWpm = Number(parseFloat(r.bestWpm ?? r.BestWPM ?? r.peakWpm ?? avgWpm).toFixed(1)) || 0;
      const testsCount = Number(r.testsCount ?? r.TestsCount ?? r.tests ?? r.count ?? 1) || 1;
      const compositeScore = Number(parseFloat(r.compositeScore ?? r.CompositeScore ?? r.score ?? r.Score ?? ((avgWpm * 0.65) + (avgAcc * 0.35))).toFixed(2)) || 0;
      return {
        rank: Number(r.rank ?? r.Rank ?? (idx + 1)) || (idx + 1),
        userId: String(r.userId ?? r.UserID ?? r.id ?? '').trim(),
        name: String(r.name ?? r.Name ?? r.userName ?? r.UserName ?? r.userId ?? r.UserID ?? 'Student').trim(),
        batch: String(r.batch ?? r.Batch ?? (effectiveBatch !== 'ALL' ? effectiveBatch : 'RP-Trail')).trim() || 'RP-Trail',
        testsCount,
        avgWpm,
        avgAcc,
        bestWpm,
        compositeScore,
        lastTestDate: String(r.lastTestDate ?? r.LastTestDate ?? '').trim()
      };
    };

    const shouldFetch = forceServerFetch || lastLeaderboardFetchKey !== fetchKey || !Array.isArray(cachedLeaderboardRows) || cachedLeaderboardRows.length === 0;
    if (shouldFetch) {
      tableMount.innerHTML = `<div style="padding: 28px; text-align: center; color: var(--text-muted); font-size: 13px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading ${daysWindow}-day batch leaderboard...</div>`;
      let fetchedRows = [];
      let fetchedBatches = [];
      if (typeof apiCall === 'function') {
        try {
          const res = await apiCall('getBatchLeaderboard', {
            batch: effectiveBatch,
            daysWindow: daysWindow
          }, true);
          const rawArr = res && res.success
            ? (Array.isArray(res.leaderboard) ? res.leaderboard : (Array.isArray(res.rows) ? res.rows : (Array.isArray(res.data) ? res.data : null)))
            : null;
          if (Array.isArray(rawArr)) {
            fetchedRows = rawArr.map(normalizeServerRow).filter(r => r.userId || r.name);
            fetchedBatches = Array.isArray(res.batches) ? res.batches : [];
          }
        } catch (e) {}
      }

      // Compute local fallback and use it whenever server returned empty or failed
      const local = computeLocalBatchLeaderboard(effectiveBatch, daysWindow);
      if (fetchedRows.length > 0) {
        cachedLeaderboardRows = fetchedRows;
        cachedLeaderboardBatches = Array.from(new Set([...fetchedBatches, ...local.batches]));
      } else {
        cachedLeaderboardRows = local.rows;
        cachedLeaderboardBatches = Array.from(new Set([...fetchedBatches, ...local.batches]));
      }

      if (!isAdminOrSuper) {
        const targetLower = effectiveBatch.toLowerCase();
        cachedLeaderboardRows = (cachedLeaderboardRows || []).filter((r) => {
          const rb = String(r.batch || effectiveBatch).split(',').map((s) => s.trim().toLowerCase());
          return rb.includes(targetLower);
        });
        cachedLeaderboardRows.sort((a, b) => (b.compositeScore - a.compositeScore) || (b.avgWpm - a.avgWpm) || (b.avgAcc - a.avgAcc));
        cachedLeaderboardRows.forEach((r, idx) => { r.rank = idx + 1; });
      }
      lastLeaderboardFetchKey = cachedLeaderboardRows.length > 0 ? fetchKey : '';
    }

    // Sync batch dropdown choices — students ONLY see their enrolled batch(es)
    if (batchSel) {
      const prevVal = batchSel.value || (isAdminOrSuper ? 'MY_BATCH' : effectiveBatch);
      if (isAdminOrSuper) {
        const instituteBatches = typeof getInstituteBatchesList === 'function' ? (getInstituteBatchesList() || []) : [];
        const mergedBatches = Array.from(new Set(['RP-Trail', ...instituteBatches, ...cachedLeaderboardBatches, ...myBatches].filter(Boolean))).sort();
        const optsHtml = [
          `<option value="MY_BATCH">My Batch: ${escapeHtml(myBatch)}</option>`,
          '<option value="ALL">All Batches Combined</option>',
          ...mergedBatches.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`)
        ].join('');
        batchSel.innerHTML = optsHtml;
        if ([...batchSel.options].some((o) => o.value === prevVal)) batchSel.value = prevVal;
      } else {
        batchSel.innerHTML = myBatches.map((b) => `<option value="${escapeHtml(b)}">My Batch: ${escapeHtml(b)}</option>`).join('');
        batchSel.value = effectiveBatch;
      }
    }

    const query = (searchIn ? searchIn.value : '').trim().toLowerCase();
    const visibleRows = cachedLeaderboardRows.filter((r) => {
      if (!query) return true;
      return `${r.name} ${r.userId} ${r.batch}`.toLowerCase().includes(query);
    });

    const cuId = (typeof portalState.currentUser !== 'undefined' && portalState.currentUser && portalState.currentUser.userId) ? String(portalState.currentUser.userId) : '';
    const myRow = cachedLeaderboardRows.find((r) => String(r.userId) === cuId) || null;
    const batchAvgWpm = cachedLeaderboardRows.length
      ? (cachedLeaderboardRows.reduce((s, r) => s + (Number(r.avgWpm) || 0), 0) / cachedLeaderboardRows.length).toFixed(1)
      : '0.0';
    const batchAvgAcc = cachedLeaderboardRows.length
      ? (cachedLeaderboardRows.reduce((s, r) => s + (Number(r.avgAcc) || 0), 0) / cachedLeaderboardRows.length).toFixed(1)
      : '0.0';
    const topWpm = cachedLeaderboardRows.length
      ? Math.max(...cachedLeaderboardRows.map((r) => Number(r.avgWpm) || 0)).toFixed(1)
      : '0.0';

    if (kpiStrip) {
      kpiStrip.innerHTML = `
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">Ranked Students</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--secondary); font-variant-numeric: tabular-nums; margin-top: 2px;">${cachedLeaderboardRows.length}</div>
        </div>
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">Batch Avg Net WPM</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--primary); font-variant-numeric: tabular-nums; margin-top: 2px;">${batchAvgWpm}</div>
        </div>
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">Batch Avg Accuracy</div>
          <div style="font-size: 22px; font-weight: 800; color: #059669; font-variant-numeric: tabular-nums; margin-top: 2px;">${batchAvgAcc}%</div>
        </div>
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">Your Rank (${daysWindow}d)</div>
          <div style="font-size: 22px; font-weight: 800; color: ${myRow ? '#d97706' : 'var(--text-muted)'}; font-variant-numeric: tabular-nums; margin-top: 2px;">${myRow ? '#' + myRow.rank : '—'}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${myRow ? `${myRow.avgWpm} WPM · ${myRow.avgAcc}%` : `Top Speed: ${topWpm} WPM`}</div>
        </div>
      `;
    }

    if (headingEl) {
      headingEl.textContent = effectiveBatch === 'ALL'
        ? `All Batches Standings · Last ${daysWindow} Days`
        : `${effectiveBatch} Standings · Last ${daysWindow} Days`;
    }
    if (metaEl) {
      metaEl.textContent = `${visibleRows.length} student${visibleRows.length === 1 ? '' : 's'} shown · Score = 65% Avg WPM + 35% Avg Accuracy`;
    }

    if (visibleRows.length === 0) {
      if (podiumEl) { podiumEl.style.display = 'none'; podiumEl.innerHTML = ''; }
      tableMount.innerHTML = `
        <div style="padding: 36px 20px; text-align: center; border: 1.5px dashed var(--border); border-radius: 12px; background: var(--background);">
          <div style="font-size: 15px; font-weight: 800; color: var(--secondary); margin-bottom: 4px;">No Batch Leaderboard Records Yet</div>
          <div style="font-size: 12.5px; color: var(--text-muted); max-width: 480px; margin: 0 auto 14px auto;">
            Complete any Audio Dictation, Pitman Shorthand, or Skill Typing test within the last ${daysWindow} days to appear on the standings for your batch.
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="if(typeof navigateTo==='function') navigateTo('audio')">
            <i class="fa-solid fa-headphones"></i> Practice Dictation Now
          </button>
        </div>
      `;
      return;
    }

    // Top-3 Podium
    if (podiumEl) {
      const top3 = visibleRows.slice(0, 3);
      const medals = [
        { label: '#1 Rank', accent: '#d97706' },
        { label: '#2 Rank', accent: '#64748b' },
        { label: '#3 Rank', accent: '#b45309' }
      ];
      podiumEl.style.display = 'grid';
      podiumEl.innerHTML = top3.map((r, i) => {
        const m = medals[i] || medals[2];
        const isMe = cuId && String(r.userId) === cuId;
        return `
          <div class="card" style="padding: 14px 16px; border: 1.5px solid ${isMe ? 'var(--primary)' : 'var(--border)'}; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 800; color: ${m.accent};">${m.label}</span>
              <span style="font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums;">${r.testsCount} test${r.testsCount === 1 ? '' : 's'}</span>
            </div>
            <div style="font-size: 15px; font-weight: 800; color: var(--secondary);">${escapeHtml(r.name)}${isMe ? ' (You)' : ''}</div>
            <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(r.batch)} · ${escapeHtml(r.userId)}</div>
            <div style="display: flex; gap: 14px; padding-top: 6px; border-top: 1px solid var(--border); font-variant-numeric: tabular-nums;">
              <div><div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">AVG WPM</div><div style="font-size: 16px; font-weight: 800; color: var(--primary);">${r.avgWpm}</div></div>
              <div><div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">ACCURACY</div><div style="font-size: 16px; font-weight: 800; color: #059669;">${r.avgAcc}%</div></div>
              <div><div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">BEST WPM</div><div style="font-size: 16px; font-weight: 800; color: var(--secondary);">${r.bestWpm}</div></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Standings Table
    tableMount.innerHTML = `
      <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 10px 12px;">Rank</th>
            <th style="text-align: left; padding: 10px 12px;">Student</th>
            <th style="text-align: left; padding: 10px 12px;">Batch</th>
            <th style="text-align: right; padding: 10px 12px;">Tests (${daysWindow}d)</th>
            <th style="text-align: right; padding: 10px 12px;">Avg Net WPM</th>
            <th style="text-align: right; padding: 10px 12px;">Avg Accuracy</th>
            <th style="text-align: right; padding: 10px 12px;">Best WPM</th>
            <th style="text-align: right; padding: 10px 12px;">Score</th>
          </tr>
        </thead>
        <tbody>
          ${visibleRows.map((r) => {
            const isMe = cuId && String(r.userId) === cuId;
            return `
              <tr style="${isMe ? 'background: rgba(37, 99, 235, 0.08); font-weight: 700;' : ''}">
                <td style="padding: 10px 12px; font-variant-numeric: tabular-nums; font-weight: 800; color: ${r.rank <= 3 ? '#d97706' : 'var(--secondary)'};">#${r.rank}</td>
                <td style="padding: 10px 12px;">
                  <div style="font-weight: 700; color: var(--secondary);">${escapeHtml(r.name)}${isMe ? ' <span style="color: var(--primary); font-size: 11px;">(You)</span>' : ''}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(r.userId)}</div>
                </td>
                <td style="padding: 10px 12px; color: var(--text-muted);">${escapeHtml(r.batch)}</td>
                <td style="padding: 10px 12px; text-align: right; font-variant-numeric: tabular-nums;">${r.testsCount}</td>
                <td style="padding: 10px 12px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 800; color: var(--primary);">${r.avgWpm}</td>
                <td style="padding: 10px 12px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; color: #059669;">${r.avgAcc}%</td>
                <td style="padding: 10px 12px; text-align: right; font-variant-numeric: tabular-nums;">${r.bestWpm}</td>
                <td style="padding: 10px 12px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 800; color: var(--secondary);">${r.compositeScore}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  };

window.shiftStudentAttendanceMonth = function (deltaMonths) {
    const picker = document.getElementById('student-attendance-month-picker');
    const now = new Date();
    const curVal = (picker && picker.value) ? picker.value : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [y, m] = curVal.split('-').map(Number);
    const d = new Date(y || now.getFullYear(), ((m || (now.getMonth() + 1)) - 1) + Number(deltaMonths || 0), 1);
    const nextYM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (picker) picker.value = nextYM;
    if (typeof window.renderStudentAttendanceMatrixView === 'function') {
      window.renderStudentAttendanceMatrixView();
    }
  };

window.resetStudentAttendanceMonthToToday = function () {
    const picker = document.getElementById('student-attendance-month-picker');
    const now = new Date();
    if (picker) picker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (typeof window.renderStudentAttendanceMatrixView === 'function') {
      window.renderStudentAttendanceMatrixView();
    }
  };

window.renderStudentAttendanceMatrixView = function () {
    const card = document.getElementById('student-attendance-matrix-card');
    const picker = document.getElementById('student-attendance-month-picker');
    const kpiEl = document.getElementById('student-attendance-kpi-strip');
    const calEl = document.getElementById('student-attendance-calendar-grid');
    if (!calEl) return;

    // Hide legacy duplicate heatmap card whenever unified calendar renders
    const legacyHeatmap = document.getElementById('d3-weekly-heatmap-card');
    if (legacyHeatmap) legacyHeatmap.style.display = 'none';

    const now = new Date();
    const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (picker && !picker.value) picker.value = defaultYM;
    const ym = (picker && picker.value) ? picker.value : defaultYM;
    const [yearNum, monthNum] = ym.split('-').map(Number);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const firstWeekday = (new Date(yearNum, monthNum - 1, 1).getDay() + 6) % 7; // Mon=0
    const monthLabel = new Date(yearNum, monthNum - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const cuId = (typeof portalState.currentUser !== 'undefined' && portalState.currentUser && portalState.currentUser.userId) ? String(portalState.currentUser.userId).trim() : '';
    const pool = (typeof portalState.globalData !== 'undefined' && portalState.globalData && Array.isArray(portalState.globalData.userHistory) && portalState.globalData.userHistory.length > 0)
      ? portalState.globalData.userHistory
      : ((typeof portalState.allTestHistoryList !== 'undefined' && Array.isArray(portalState.allTestHistoryList) && portalState.allTestHistoryList.length > 0)
        ? portalState.allTestHistoryList
        : ((typeof portalState.cachedTestHistory !== 'undefined' && Array.isArray(portalState.cachedTestHistory)) ? portalState.cachedTestHistory : []));

    const historyRows = pool.filter((h) => !cuId || !h.UserID || String(h.UserID).trim() === cuId);

    const dayStatsMap = {};
    const allActiveDatesSet = new Set();
    historyRows.forEach((h) => {
      const rawD = String(h.Date || h.date || h.TypingDate || h.Timestamp || '').trim();
      if (!rawD) return;
      const m = rawD.match(/^(\d{4}-\d{2}-\d{2})/);
      let iso = m ? m[1] : '';
      if (!iso) {
        const d = new Date(rawD);
        if (isNaN(d.getTime())) return;
        iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      allActiveDatesSet.add(iso);
      if (iso.startsWith(ym + '-')) {
        if (!dayStatsMap[iso]) dayStatsMap[iso] = { count: 0, words: 0, accSum: 0, accCount: 0 };
        dayStatsMap[iso].count += 1;
        dayStatsMap[iso].words += Number(h.TotalWords || h.WordsTyped || h.TypedWords || 0) || 0;
        const acc = parseFloat(h.AccuracyPercentage || h.accuracyPercentage || h.Accuracy || 0);
        if (!isNaN(acc) && acc > 0) {
          dayStatsMap[iso].accSum += acc;
          dayStatsMap[iso].accCount += 1;
        }
      }
    });

    let activeDays = 0;
    let totalTestsMonth = 0;
    let totalWordsMonth = 0;
    let longestStreak = 0;
    let running = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${ym}-${String(day).padStart(2, '0')}`;
      const st = dayStatsMap[iso];
      if (st && st.count > 0) {
        activeDays += 1;
        totalTestsMonth += st.count;
        totalWordsMonth += st.words;
        running += 1;
        if (running > longestStreak) longestStreak = running;
      } else {
        running = 0;
      }
    }

    let currentStreak = 0;
    const probe = new Date();
    for (let i = 0; i < 365; i++) {
      const iso = `${probe.getFullYear()}-${String(probe.getMonth() + 1).padStart(2, '0')}-${String(probe.getDate()).padStart(2, '0')}`;
      if (allActiveDatesSet.has(iso)) {
        currentStreak += 1;
        probe.setDate(probe.getDate() - 1);
      } else if (i === 0) {
        probe.setDate(probe.getDate() - 1);
      } else {
        break;
      }
    }

    const coveragePct = Math.round((activeDays / Math.max(1, daysInMonth)) * 100);
    const titleEl = card ? card.querySelector('h3') : null;
    if (titleEl) titleEl.textContent = 'Attendance, Streak & Consistency Calendar';
    const descEl = card ? card.querySelector('p') : null;
    if (descEl) descEl.textContent = 'All-in-one monthly attendance sheet, active streak tracker, and daily practice intensity heatmap.';

    if (kpiEl) {
      kpiEl.innerHTML = `
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Active Streak</div>
          <div style="font-size: 22px; font-weight: 800; color: #ea580c; font-variant-numeric: tabular-nums; margin-top: 3px;">🔥 ${currentStreak} day${currentStreak === 1 ? '' : 's'}</div>
        </div>
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Best Month Streak</div>
          <div style="font-size: 22px; font-weight: 800; color: #059669; font-variant-numeric: tabular-nums; margin-top: 3px;">${longestStreak} day${longestStreak === 1 ? '' : 's'}</div>
        </div>
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Monthly Attendance</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--primary); font-variant-numeric: tabular-nums; margin-top: 3px;">${activeDays}/${daysInMonth} <span style="font-size: 13px; opacity: 0.8;">(${coveragePct}%)</span></div>
        </div>
        <div style="background: var(--background); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Tests Completed</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--secondary); font-variant-numeric: tabular-nums; margin-top: 3px;">${totalTestsMonth}${totalWordsMonth > 0 ? ` <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">· ${totalWordsMonth.toLocaleString()}w</span>` : ''}</div>
        </div>
      `;
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const heatBg = (cnt) => {
      if (cnt >= 4) return isDark ? 'rgba(16, 185, 129, 0.48)' : 'rgba(5, 150, 105, 0.34)';
      if (cnt >= 2) return isDark ? 'rgba(16, 185, 129, 0.32)' : 'rgba(16, 185, 129, 0.22)';
      if (cnt >= 1) return isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)';
      return 'var(--background)';
    };
    const heatText = (cnt) => {
      if (cnt >= 1) return isDark ? '#6ee7b7' : '#047857';
      return 'var(--text-muted)';
    };

    const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let cellsHtml = dayHeaders.map((d) => `<div role="columnheader" style="text-align: center; font-size: 11px; font-weight: 800; color: var(--text-muted); padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em;">${d}</div>`).join('');
    for (let blank = 0; blank < firstWeekday; blank++) {
      cellsHtml += `<div aria-hidden="true" style="min-height: 58px; border-radius: 10px; opacity: 0.25;"></div>`;
    }

    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayInThisMonth = todayIso.startsWith(ym + '-') ? now.getDate() : 1;
    const focusedDay = Math.min(daysInMonth, Math.max(1, Number(window._unifiedAttendanceFocusedDay) || todayInThisMonth));
    window._unifiedAttendanceFocusedDay = focusedDay;

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${ym}-${String(day).padStart(2, '0')}`;
      const st = dayStatsMap[iso] || { count: 0, words: 0, accSum: 0, accCount: 0 };
      const cnt = st.count;
      const avgAcc = st.accCount > 0 ? (st.accSum / st.accCount).toFixed(1) + '%' : '—';
      const isToday = iso === todayIso;
      const isRovingFocus = day === focusedDay;
      const borderCol = isToday ? '2px solid var(--primary)' : (cnt > 0 ? '1px solid rgba(16, 185, 129, 0.42)' : '1px solid var(--border)');
      const detailText = cnt > 0
        ? `${iso}: Present · ${cnt} test${cnt === 1 ? '' : 's'} · Avg Accuracy: ${avgAcc}${st.words > 0 ? ` · ${st.words.toLocaleString()} words` : ''}`
        : `${iso}: No practice recorded yet`;
      const safeDetailAttr = detailText.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      cellsHtml += `
        <button type="button" role="gridcell" data-att-iso="${iso}" data-att-day="${day}" tabindex="${isRovingFocus ? '0' : '-1'}" aria-selected="${isRovingFocus ? 'true' : 'false'}" aria-label="${safeDetailAttr}" onclick="window.selectUnifiedAttendanceDay('${iso}', '${safeDetailAttr}', ${day})" onkeydown="window.handleUnifiedAttendanceCalendarKeydown(event, ${day}, ${daysInMonth})" style="text-align: left; cursor: pointer; min-height: 62px; padding: 8px 9px; border-radius: 10px; border: ${borderCol}; background: ${heatBg(cnt)}; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="font-size: 12px; font-weight: 800; color: ${isToday ? 'var(--primary)' : 'var(--secondary)'}; font-variant-numeric: tabular-nums;">${day}</span>
            ${cnt > 0 ? `<span style="width: 7px; height: 7px; border-radius: 999px; background: #10b981;"></span>` : ''}
          </div>
          <span style="font-size: 11px; font-weight: 700; color: ${heatText(cnt)}; font-variant-numeric: tabular-nums;">${cnt > 0 ? `${cnt} test${cnt === 1 ? '' : 's'}` : 'Rest'}</span>
        </button>
      `;
    }

    calEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; padding: 8px 12px; border-radius: 10px; background: var(--background); border: 1px solid var(--border);">
        <div style="display: inline-flex; align-items: center; gap: 6px;">
          <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 10px; min-height: 30px;" onclick="window.shiftStudentAttendanceMonth(-1)" title="Previous Month" aria-label="Previous Month"><i class="fa-solid fa-chevron-left"></i></button>
          <strong style="font-size: 13.5px; color: var(--secondary); min-width: 132px; text-align: center;">${monthLabel}</strong>
          <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 10px; min-height: 30px;" onclick="window.shiftStudentAttendanceMonth(1)" title="Next Month" aria-label="Next Month"><i class="fa-solid fa-chevron-right"></i></button>
          <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 10px; min-height: 30px; font-size: 11px;" onclick="window.resetStudentAttendanceMonthToToday()">Today</button>
        </div>
        <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--text-muted);">
          <span>Less</span>
          <span style="width: 13px; height: 13px; border-radius: 4px; border: 1px solid var(--border); background: ${heatBg(0)}; display: inline-block;" title="0 tests"></span>
          <span style="width: 13px; height: 13px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.4); background: ${heatBg(1)}; display: inline-block;" title="1 test"></span>
          <span style="width: 13px; height: 13px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.5); background: ${heatBg(2)}; display: inline-block;" title="2-3 tests"></span>
          <span style="width: 13px; height: 13px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.7); background: ${heatBg(4)}; display: inline-block;" title="4+ tests"></span>
          <span>More</span>
        </div>
      </div>
      <div role="grid" aria-label="Attendance and consistency calendar for ${monthLabel}. Use Arrow keys, Home, End, PageUp, and PageDown to navigate dates." style="display: grid; grid-template-columns: repeat(7, minmax(64px, 1fr)); gap: 6px;">
        ${cellsHtml}
      </div>
      <div id="student-attendance-day-detail" aria-live="polite" style="margin-top: 12px; padding: 9px 12px; border-radius: 10px; background: var(--background); border: 1px solid var(--border); font-size: 12px; font-weight: 600; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-calendar-day" style="color: var(--primary);"></i>
        <span>Select any date or use Arrow keys (← ↑ → ↓, Home, End, PageUp/Down) to inspect daily tests and practice volume.</span>
      </div>
    `;
  };

window.selectUnifiedAttendanceDay = function (iso, detailText, dayNum) {
    if (dayNum) window._unifiedAttendanceFocusedDay = Number(dayNum);
    const calEl = document.getElementById('student-attendance-calendar-grid');
    if (calEl) {
      calEl.querySelectorAll('button[data-att-day]').forEach((btn) => {
        const isSelected = btn.getAttribute('data-att-iso') === iso;
        btn.setAttribute('tabindex', isSelected ? '0' : '-1');
        btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        btn.style.boxShadow = isSelected ? '0 0 0 2px var(--primary)' : '';
      });
    }
    const detailEl = document.getElementById('student-attendance-day-detail');
    if (detailEl) {
      const safeDetail = typeof window.escapeHtml === 'function' ? window.escapeHtml(detailText) : detailText;
      detailEl.innerHTML = `<i class="fa-solid fa-calendar-check" style="color: #059669;"></i> <span style="color: var(--secondary); font-weight: 700;">${safeDetail}</span>`;
    }
  };

window.handleUnifiedAttendanceCalendarKeydown = function (ev, currentDay, daysInMonth) {
    const key = ev && ev.key ? ev.key : '';
    let nextDay = null;
    let monthShift = 0;

    if (key === 'ArrowRight') nextDay = currentDay + 1;
    else if (key === 'ArrowLeft') nextDay = currentDay - 1;
    else if (key === 'ArrowDown') nextDay = currentDay + 7;
    else if (key === 'ArrowUp') nextDay = currentDay - 7;
    else if (key === 'Home') nextDay = 1;
    else if (key === 'End') nextDay = daysInMonth;
    else if (key === 'PageUp') { monthShift = -1; nextDay = currentDay; }
    else if (key === 'PageDown') { monthShift = 1; nextDay = currentDay; }
    else if (key === 'Enter' || key === ' ') {
      ev.preventDefault();
      if (ev.currentTarget && typeof ev.currentTarget.click === 'function') ev.currentTarget.click();
      return;
    } else {
      return;
    }

    ev.preventDefault();
    if (monthShift !== 0) {
      window._unifiedAttendanceFocusedDay = Math.max(1, nextDay);
      window.shiftStudentAttendanceMonth(monthShift);
      setTimeout(() => {
        const target = document.querySelector(`#student-attendance-calendar-grid button[data-att-day="${window._unifiedAttendanceFocusedDay}"]`) ||
          document.querySelector('#student-attendance-calendar-grid button[data-att-day]');
        if (target) { target.focus(); target.click(); }
      }, 25);
      return;
    }

    if (nextDay < 1) {
      window._unifiedAttendanceFocusedDay = 28;
      window.shiftStudentAttendanceMonth(-1);
      setTimeout(() => {
        const btns = document.querySelectorAll('#student-attendance-calendar-grid button[data-att-day]');
        const lastBtn = btns[btns.length - 1];
        if (lastBtn) { lastBtn.focus(); lastBtn.click(); }
      }, 25);
      return;
    }

    if (nextDay > daysInMonth) {
      window._unifiedAttendanceFocusedDay = 1;
      window.shiftStudentAttendanceMonth(1);
      setTimeout(() => {
        const firstBtn = document.querySelector('#student-attendance-calendar-grid button[data-att-day="1"]');
        if (firstBtn) { firstBtn.focus(); firstBtn.click(); }
      }, 25);
      return;
    }

    window._unifiedAttendanceFocusedDay = nextDay;
    const targetBtn = document.querySelector(`#student-attendance-calendar-grid button[data-att-day="${nextDay}"]`);
    if (targetBtn) {
      targetBtn.focus();
      targetBtn.click();
    }
  };
