// @ts-nocheck
/**
 * RP Skill Portal — Universal Media Viewer, PDF Reader, Audio Dictation & Shorthand Pads
 * Clean Vite ES module (zero layered monkey-patch conflicts).
 */

import { portalState } from '../core/state.ts';
import { portalHooks } from '../core/hooks.ts';
import { apiCall, getEvaluationRulesForTab, loadSelectedEvaluationRulesIntoForm, logPortalAction, populateSavedRulesQuickDropdown, renderGlobalWatermark, showToast, syncUserCloudStateToBackend } from './apiAndCore.js';
import { isActionBlockedByUnverifiedEmail, navigateTo, sortMaterialsLatestFirst } from './authAndNavigation.js';
import { buildCompleteRuleDetailsGridHtml, getAllAvailableCbtTests, startCbtMockTest } from './cbtArena.js';
import { PAD_ANNOTATIONS_KEY, getInstituteBatchesList, getUserAssignedBatch, populateAllBatchSelectDropdowns, probeYouTubeVideoDuration, safeNotify } from './adminPanel.js';
import { escapeHtml, getLocalDateString } from '../utils/formatting.ts';
import { checkMaterialAccessPermissions, getUniversalUrl, handleTypingInputProgress, isElementVisibleInDom, preparePassageForInitialWordsRule, renderMaterialsList, renderPitmanList, renderWords, startPitmanTest, startPitmanTestById, startTestTimer, startTypingExam, toggleMobileExamFocusMode, updateLiveTypingStatusBar, updateTestSubmitMinTimeLockUI } from './typingAndEvaluation.js';
import { loadLearningLesson, purgeFakeInjectedRules, renderLearningKeyboard, renderVideoCourseList, updateLearningDisplayAndKeyHighlight, updateLearningStudioCompleteRules } from './videoAndTutor.js';
import { countMasterPassageWords, getWatermarkText, renderDailyPracticeGoalUI } from './dashboardAndProfile.js';
import { formatSecMMSS, getActiveDictationAudioElement } from './weakVaultAndPlanner.js';
import { extractHardWordsFromPassage } from '../utils/pitman.ts';
import { buildProtectedMediaProxyUrl, extractGoogleDriveFileId, isGoogleDriveOrDocsUrl } from '../utils/mediaProxy.ts';

const enterImmersiveFullscreenLock = (...args) => (typeof window.enterImmersiveFullscreenLock === 'function' ? window.enterImmersiveFullscreenLock(...args) : undefined);
const exitImmersiveFullscreenLock = (...args) => (typeof window.exitImmersiveFullscreenLock === 'function' ? window.exitImmersiveFullscreenLock(...args) : undefined);
const openUniversalMediaViewer = (...args) => (typeof window.openUniversalMediaViewer === 'function' ? window.openUniversalMediaViewer(...args) : undefined);
const skipMandatoryReadingPhaseAndUnlock = (...args) => (typeof window.skipMandatoryReadingPhaseAndUnlock === 'function' ? window.skipMandatoryReadingPhaseAndUnlock(...args) : undefined);
const switchDictationMergedTrack = (...args) => (typeof window.switchDictationMergedTrack === 'function' ? window.switchDictationMergedTrack(...args) : undefined);
const loadShorthandPadsFromServer = (...args) => (typeof window.loadShorthandPadsFromServer === 'function' ? window.loadShorthandPadsFromServer(...args) : undefined);
const currentActiveViewName = (...args) => (typeof window.currentActiveViewName === 'function' ? window.currentActiveViewName(...args) : undefined);

export const LIVE_SCHEDULED_TESTS_STORAGE_KEY = 'steno_scheduled_live_tests_v1';

export function getScheduledLiveTestsList() {
      try {
        const raw = localStorage.getItem(LIVE_SCHEDULED_TESTS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
      if (typeof portalState.globalData !== 'undefined' && portalState.globalData && Array.isArray(portalState.globalData.scheduledLiveTests) && portalState.globalData.scheduledLiveTests.length > 0) {
        return portalState.globalData.scheduledLiveTests;
      }
      return [];
    }

export function saveScheduledLiveTestsList(list, syncToServer = true) {
      const normalized = Array.isArray(list) ? list : [];
      try {
        localStorage.setItem(LIVE_SCHEDULED_TESTS_STORAGE_KEY, JSON.stringify(normalized));
      } catch (e) {}
      if (typeof portalState.globalData !== 'undefined' && portalState.globalData) {
        portalState.globalData.scheduledLiveTests = normalized;
      }
      if (syncToServer) {
        apiCall('saveScheduledLiveTests', { liveTests: normalized }, true);
      }
    }

export function populateLiveTestMaterialOptions() {
      const catSel = document.getElementById('live-test-category') || document.getElementById('livetest-category-select');
      const matSel = document.getElementById('live-test-material-id') || document.getElementById('livetest-material-select');
      const ruleSel = document.getElementById('live-test-eval-rule');
      if (!catSel || !matSel) return;
      const cat = catSel.value || 'typingtest';
      const allMats = sortMaterialsLatestFirst(
        (portalState.adminData && Array.isArray(portalState.adminData.materials) && portalState.adminData.materials.length > 0)
          ? portalState.adminData.materials
          : (portalState.materialsData || [])
      );

      matSel.innerHTML = '';
      if (cat === 'cbttest') {
        const cbtList = typeof getAllAvailableCbtTests === 'function' ? getAllAvailableCbtTests() : [];
        cbtList.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.ID || t.id;
          opt.innerText = `[CBT] ${t.Title || t.title} (${t.Subtab || t.examCategory || 'CBT'})`;
          matSel.appendChild(opt);
        });
      } else {
        const filtered = allMats.filter(m => String(m.Type || '').toLowerCase() === cat.toLowerCase());
        filtered.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.ID;
          opt.innerText = `[${(m.Subtab || cat).toUpperCase()}] ${m.Title}`;
          matSel.appendChild(opt);
        });
      }
      if (matSel.options.length === 0) {
        const opt = document.createElement('option');
        opt.value = 'DEFAULT_LIVE';
        opt.innerText = `Default ${cat.toUpperCase()} Live Test Exercise`;
        matSel.appendChild(opt);
      }

      if (ruleSel) {
        const allKeys = Object.keys(portalState.allEvaluationRules || {}).filter(k => k !== 'default' && k !== 'ephemeral_learning_once');
        // 👉 REQUIREMENT #15: Strictly show ONLY evaluation rules belonging to the selected material category tab
        const matchingKeys = allKeys.filter(k => {
          const r = portalState.allEvaluationRules[k] || {};
          const rTab = String(r.tabType || '').toLowerCase();
          const lowK = k.toLowerCase();
          if (cat === 'pitman') return rTab === 'pitman' || lowK === 'pitman' || lowK.startsWith('pitman_');
          if (cat === 'audio') return rTab === 'audio' || lowK === 'audio' || lowK.startsWith('audio_') || (lowK.startsWith('exam_') && !rTab);
          if (cat === 'typingtest') return rTab === 'typingtest' || lowK === 'typingtest' || lowK.startsWith('typing_') || lowK.startsWith('typingtest_');
          if (cat === 'cbttest') return rTab === 'cbttest' || lowK === 'cbttest' || lowK.startsWith('cbttest_');
          return rTab === cat.toLowerCase() || lowK.startsWith(cat.toLowerCase());
        });
        if (matchingKeys.length > 0) {
          ruleSel.innerHTML = matchingKeys.map(k => {
            const r = portalState.allEvaluationRules[k] || {};
            return `<option value="${k}">${r.examDisplayName || k} (${r.timeLimit || 10}m)</option>`;
          }).join('');
        } else {
          ruleSel.innerHTML = `<option value="">No evaluation rule is there</option>`;
        }
      }
    }

export function setLiveTestQuickNow(durationMinutes = 15) {
      const startIn = document.getElementById('live-test-start-time') || document.getElementById('livetest-start-input');
      const endIn = document.getElementById('live-test-end-time') || document.getElementById('livetest-end-input');
      const now = new Date(Date.now() - 30000);
      const end = new Date(Date.now() + durationMinutes * 60000);
      const toLocalIsoInput = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      if (startIn) startIn.value = toLocalIsoInput(now);
      if (endIn) endIn.value = toLocalIsoInput(end);
      populateLiveTestMaterialOptions();
      showToast(`⚡ Live Test window set: LIVE NOW for ${durationMinutes} Minutes.`);
    }

export function editScheduledLiveTest(id) {
      const list = getScheduledLiveTestsList();
      const item = list.find(x => x.id === id);
      if (!item) {
        showToast('Live Test record not found.');
        return;
      }
      if (typeof populateAllBatchSelectDropdowns === 'function') populateAllBatchSelectDropdowns();
      const catEl = document.getElementById('live-test-category') || document.getElementById('livetest-category-select');
      const matEl = document.getElementById('live-test-material-id') || document.getElementById('livetest-material-select');
      const ruleEl = document.getElementById('live-test-eval-rule');
      const titleEl = document.getElementById('live-test-title') || document.getElementById('livetest-title-input');
      const startEl = document.getElementById('live-test-start-time') || document.getElementById('livetest-start-input');
      const endEl = document.getElementById('live-test-end-time') || document.getElementById('livetest-end-input');
      const modeEl = document.getElementById('live-test-result-mode') || document.getElementById('livetest-result-mode-select');
      const pubEl = document.getElementById('live-test-publish-time') || document.getElementById('livetest-publish-input');
      const batchEl = document.getElementById('live-test-target-batch');
      const grpPub = document.getElementById('group-live-custom-publish-time') || document.getElementById('group-livetest-custom-publish');
      const editIdEl = document.getElementById('live-test-editing-id');
      const btnSaveText = document.getElementById('btn-save-live-test-text');
      const btnCancel = document.getElementById('btn-cancel-edit-live-test');

      if (editIdEl) editIdEl.value = item.id;
      if (catEl) {
        catEl.value = item.category || 'typingtest';
        populateLiveTestMaterialOptions();
      }
      setTimeout(() => {
        if (matEl && item.materialId) matEl.value = item.materialId;
        if (ruleEl && item.evalRuleKey) ruleEl.value = item.evalRuleKey;
        if (batchEl) batchEl.value = item.targetBatch || 'ALL';
      }, 50);

      if (titleEl) titleEl.value = item.title || '';
      if (startEl) startEl.value = item.startTime ? item.startTime.substring(0, 16) : '';
      if (endEl) endEl.value = item.endTime ? item.endTime.substring(0, 16) : '';
      if (modeEl) {
        modeEl.value = item.resultDisplayMode || 'immediate';
        if (grpPub) grpPub.style.display = (modeEl.value === 'custom_time' || modeEl.value === 'custom') ? 'block' : 'none';
      }
      if (pubEl) pubEl.value = item.resultPublishTime ? item.resultPublishTime.substring(0, 16) : '';
      if (btnSaveText) btnSaveText.innerText = 'Update Scheduled Live Test';
      if (btnCancel) btnCancel.style.display = 'inline-flex';

      const formEl = document.querySelector('#admin-sub-livetests form');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast(`✏️ Editing Live Test "${item.title}" — Update details and save.`);
    }

export function cancelEditScheduledLiveTest() {
      const editIdEl = document.getElementById('live-test-editing-id');
      const titleEl = document.getElementById('live-test-title') || document.getElementById('livetest-title-input');
      const btnSaveText = document.getElementById('btn-save-live-test-text');
      const btnCancel = document.getElementById('btn-cancel-edit-live-test');
      if (editIdEl) editIdEl.value = '';
      if (titleEl) titleEl.value = '';
      if (btnSaveText) btnSaveText.innerText = 'Schedule / Save Live Test';
      if (btnCancel) btnCancel.style.display = 'none';
      showToast('Edit cancelled.');
    }

export function handleSaveScheduledLiveTest() {
      const catEl = document.getElementById('live-test-category') || document.getElementById('livetest-category-select');
      const matEl = document.getElementById('live-test-material-id') || document.getElementById('livetest-material-select');
      const ruleEl = document.getElementById('live-test-eval-rule');
      const titleEl = document.getElementById('live-test-title') || document.getElementById('livetest-title-input');
      const startEl = document.getElementById('live-test-start-time') || document.getElementById('livetest-start-input');
      const endEl = document.getElementById('live-test-end-time') || document.getElementById('livetest-end-input');
      const modeEl = document.getElementById('live-test-result-mode') || document.getElementById('livetest-result-mode-select');
      const pubEl = document.getElementById('live-test-publish-time') || document.getElementById('livetest-publish-input');
      const batchEl = document.getElementById('live-test-target-batch');
      const disappearEl = document.getElementById('live-test-disappear-mins');
      const editIdEl = document.getElementById('live-test-editing-id');

      const cat = catEl ? catEl.value : 'typingtest';
      const matId = matEl ? matEl.value : '';
      const evalRuleKey = ruleEl ? ruleEl.value : '';
      const customTitle = titleEl ? titleEl.value.trim() : '';
      const startTime = startEl ? startEl.value : '';
      const endTime = endEl ? endEl.value : '';
      const resultDisplayMode = modeEl ? modeEl.value : 'immediate';
      const resultPublishTime = (resultDisplayMode === 'custom_time' && pubEl) ? pubEl.value : '';
      const targetBatch = batchEl ? (batchEl.value || 'ALL') : 'ALL';
      const disappearAfterMinutes = disappearEl ? (parseInt(disappearEl.value, 10) || 60) : 60;
      const editingId = editIdEl ? editIdEl.value.trim() : '';

      if (!customTitle || !startTime || !endTime) {
        showToast('Please fill in Title, Start Date/Time, and End Date/Time (*).');
        return;
      }
      if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
        showToast('End Time must be after Start Time.');
        return;
      }

      let list = getScheduledLiveTestsList();
      if (editingId) {
        const idx = list.findIndex(item => item.id === editingId);
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            category: cat,
            materialId: matId,
            evalRuleKey: evalRuleKey,
            title: customTitle,
            startTime: startTime,
            endTime: endTime,
            resultDisplayMode: resultDisplayMode,
            resultPublishTime: resultPublishTime,
            targetBatch: targetBatch,
            disappearAfterMinutes: disappearAfterMinutes,
            updatedAt: new Date().toISOString()
          };
          if (typeof logPortalAction === 'function') {
            logPortalAction('UPDATE_LIVE_TEST', `Updated Live Test "${customTitle}" (${cat.toUpperCase()} | Batch: ${targetBatch})`);
          }
          showToast(`✅ Live Test "${customTitle}" updated successfully!`);
        }
        cancelEditScheduledLiveTest();
      } else {
        const newEntry = {
          id: 'LIVE-' + Date.now(),
          category: cat,
          materialId: matId,
          evalRuleKey: evalRuleKey,
          title: customTitle,
          startTime: startTime,
          endTime: endTime,
          resultDisplayMode: resultDisplayMode,
          resultPublishTime: resultPublishTime,
          targetBatch: targetBatch,
          disappearAfterMinutes: disappearAfterMinutes,
          createdAt: new Date().toISOString()
        };
        list.unshift(newEntry);
        if (typeof logPortalAction === 'function') {
          logPortalAction('SCHEDULE_LIVE_TEST', `Scheduled Live Test "${customTitle}" (${cat.toUpperCase()} | Batch: ${targetBatch}) from ${startTime} to ${endTime}`);
        }
        if (titleEl) titleEl.value = '';
        showToast(`✅ Scheduled Live Test "${customTitle}" is now saved & active!`);
      }

      saveScheduledLiveTestsList(list);
      renderAdminLiveTestsTable();
      renderLiveTestsEverywhere();
    }

export function deleteScheduledLiveTest(id, skipConfirm = false) {
      if (!skipConfirm && typeof window.rpConfirmDelete === 'function') {
        window.rpConfirmDelete('Delete Scheduled Live Test?', 'Remove this scheduled live test from Google Sheets?', () => deleteScheduledLiveTest(id, true));
        return;
      }
      const list = getScheduledLiveTestsList().filter(item => item.id !== id);
      saveScheduledLiveTestsList(list);
      cancelEditScheduledLiveTest();
      renderAdminLiveTestsTable();
      renderLiveTestsEverywhere();
      showToast('Live Test removed successfully.');
    }

export function renderAdminLiveTestsTable() {
      if (typeof populateAllBatchSelectDropdowns === 'function') populateAllBatchSelectDropdowns();
      if (typeof populateAdminLiveTestRankSelector === 'function') populateAdminLiveTestRankSelector();
      const container = document.getElementById('admin-live-tests-table-container') || document.getElementById('admin-livetests-table-container');
      if (!container) return;
      const list = getScheduledLiveTestsList();
      if (list.length === 0) {
        container.innerHTML = window.buildRpEmptyStateHtml(
          'No live tests scheduled yet',
          'Use the scheduler above to launch a timed Live Audio, Pitman Book, Typing, or CBT Exam for any batch.',
          'Schedule First Live Test',
          "document.getElementById('live-test-title')?.focus()"
        );
        return;
      }
      const nowMs = Date.now();
      let html = `<div class="table-responsive"><table class="rp-admin-clean-table">
        <thead><tr>
          <th>Category</th><th>Live Test Title</th><th>Target Batch</th><th>Window</th><th>Status</th><th>Result Mode</th><th>Actions</th>
        </tr></thead><tbody>`;
      list.forEach(lt => {
        const sMs = new Date(lt.startTime).getTime();
        const eMs = new Date(lt.endTime).getTime();
        const disMins = Number(lt.disappearAfterMinutes || 60);
        const disMs = eMs + (disMins * 60000);
        let statusBadge = `<span style="color:#d97706; font-weight:700;">⏳ Upcoming</span>`;
        if (nowMs >= sMs && nowMs < eMs) {
          statusBadge = `<span style="color:#059669; font-weight:800;">● LIVE NOW</span>`;
        } else if (nowMs >= eMs && nowMs < disMs) {
          const remDisMins = Math.max(1, Math.ceil((disMs - nowMs) / 60000));
          statusBadge = `<span style="color:#dc2626; font-weight:700;">Ended (${remDisMins}m left)</span>`;
        } else if (nowMs >= disMs) {
          statusBadge = `<span style="color:var(--text-muted); font-weight:600;">Archived</span>`;
        }
        const modeLabel = lt.resultDisplayMode === 'after_end'
          ? 'After End'
          : ((lt.resultDisplayMode === 'custom_time' || lt.resultDisplayMode === 'custom') ? `${lt.resultPublishTime || '-'}` : 'Immediate');
        const batchLabel = (!lt.targetBatch || lt.targetBatch === 'ALL') ? 'All-India Open' : lt.targetBatch;
        const catLabel = lt.category === 'pitman' ? 'PITMAN BOOK' : (lt.category || 'TEST').toUpperCase();
        html += `<tr>
          <td><span class="subtab-badge">${escapeHtml(catLabel)}</span></td>
          <td><strong>${escapeHtml(lt.title)}</strong></td>
          <td>${escapeHtml(batchLabel)}</td>
          <td style="font-size:11.5px;">${new Date(lt.startTime).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })} → ${new Date(lt.endTime).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</td>
          <td>${statusBadge}</td>
          <td style="font-size:11.5px;">${escapeHtml(modeLabel)}</td>
          <td>
            <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
              <button type="button" class="btn btn-primary btn-sm" style="padding:3px 9px; font-size:11px; background:#d97706; border-color:#d97706;" onclick="inspectAdminLiveTestRanks('${lt.id}')"><i class="fa-solid fa-ranking-star"></i> View Ranks</button>
              <button type="button" class="btn btn-secondary btn-sm" style="padding:3px 9px; font-size:11px;" onclick="editScheduledLiveTest('${lt.id}')"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
              <button type="button" class="btn btn-danger btn-sm" style="padding:3px 9px; font-size:11px;" onclick="deleteScheduledLiveTest('${lt.id}')"><i class="fa-solid fa-trash-can"></i></button>
              ${nowMs >= sMs && nowMs < eMs ? `<button type="button" class="btn btn-success btn-sm" style="padding:3px 9px; font-size:11px;" onclick="launchScheduledLiveTest('${lt.id}')"><i class="fa-solid fa-play"></i> Launch</button>` : ''}
            </div>
          </td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
      container.innerHTML = html;
    }

window._adminLiveTestRanksCache = [];

export function populateAdminLiveTestRankSelector() {
      const sel = document.getElementById('admin-livetest-rank-select');
      const batchSel = document.getElementById('admin-livetest-rank-batch');
      if (!sel) return;
      const prev = sel.value;
      const list = getScheduledLiveTestsList();
      sel.innerHTML = `<option value="">-- Select a Live Test --</option>` +
        list.map(lt => `<option value="${escapeHtml(lt.id)}">[${escapeHtml((lt.category || 'test').toUpperCase())}] ${escapeHtml(lt.title)}</option>`).join('');
      if (prev && Array.from(sel.options).some(o => o.value === prev)) {
        sel.value = prev;
      } else if (list.length > 0 && !prev) {
        sel.value = list[0].id;
      }
      if (batchSel) {
        const prevB = batchSel.value || 'ALL';
        const batches = ['RP-Trail', ...(typeof getInstituteBatchesList === 'function' ? getInstituteBatchesList() : [])];
        batchSel.innerHTML = `<option value="ALL">All Batches</option>` +
          batches.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
        if (Array.from(batchSel.options).some(o => o.value === prevB)) batchSel.value = prevB;
      }
    }

export function inspectAdminLiveTestRanks(liveTestId) {
      populateAdminLiveTestRankSelector();
      const sel = document.getElementById('admin-livetest-rank-select');
      if (sel && liveTestId) sel.value = liveTestId;
      const card = document.getElementById('admin-livetest-ranks-card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      loadAdminLiveTestRanks(true);
    }

export async function loadAdminLiveTestRanks(forceServer = true) {
      const sel = document.getElementById('admin-livetest-rank-select');
      const tbody = document.getElementById('admin-livetest-ranks-tbody');
      const summaryEl = document.getElementById('admin-livetest-ranks-summary');
      const ltId = sel ? sel.value : '';
      if (!ltId) {
        window._adminLiveTestRanksCache = [];
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:22px; color:var(--text-muted);">Select a Live Test above to view student rankings.</td></tr>`;
        if (summaryEl) summaryEl.textContent = '';
        return;
      }
      const list = getScheduledLiveTestsList();
      const ltObj = list.find(x => x.id === ltId) || {};
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--primary); font-weight:700;"><span class="mini-spin"></span> Loading ranked merit list...</td></tr>`;

      let serverRanks = null;
      if (forceServer && typeof apiCall === 'function') {
        try {
          const res = await apiCall('getAdminLiveTestRanks', {
            liveTestId: ltId,
            liveTestTitle: ltObj.title || '',
            category: ltObj.category || '',
            startTime: ltObj.startTime || '',
            endTime: ltObj.endTime || ''
          });
          if (res && res.success && Array.isArray(res.ranks)) {
            serverRanks = res.ranks;
          }
        } catch (e) {}
      }

      if (!serverRanks) {
        // Fallback: compute locally from adminData.history
        const hist = (portalState.adminData && Array.isArray(portalState.adminData.history)) ? portalState.adminData.history : (portalState.allTestHistoryList || []);
        const titleLow = String(ltObj.title || '').toLowerCase();
        const catLow = String(ltObj.category || '').toLowerCase();
        const bestByUser = {};
        hist.forEach(h => {
          const examLow = String(h.ExamName || h.examName || '').toLowerCase();
          const matched = (titleLow && examLow.includes(titleLow)) || (catLow && examLow.includes(catLow));
          if (!matched) return;
          const uid = String(h.UserID || h.userId || h.UserName || 'USR');
          const acc = parseFloat(String(h.Accuracy ?? h.accuracy ?? '0').replace('%', '')) || 0;
          const wpm = parseFloat(h.NetSpeed ?? h.netSpeed ?? h.GrossSpeed ?? 0) || 0;
          const errs = parseFloat(h.TotalErrors ?? h.totalErrors ?? 0) || 0;
          const prev = bestByUser[uid];
          if (!prev || acc > prev.accuracy || (acc === prev.accuracy && wpm > prev.speedWpm)) {
            bestByUser[uid] = {
              userId: uid,
              name: h.UserName || h.userName || uid,
              batch: h.Batch || (typeof getUserAssignedBatch === 'function' ? getUserAssignedBatch(uid, '') : 'RP-Trail'),
              accuracy: Number(acc.toFixed(2)),
              speedWpm: Number(wpm.toFixed(1)),
              totalErrors: errs,
              submittedAt: h.Date || h.date || ''
            };
          }
        });
        serverRanks = Object.values(bestByUser)
          .sort((a, b) => (b.accuracy - a.accuracy) || (b.speedWpm - a.speedWpm) || (a.totalErrors - b.totalErrors))
          .map((r, i) => ({ rank: i + 1, ...r }));
      }

      window._adminLiveTestRanksCache = serverRanks;
      renderAdminLiveTestRanksTable();
    }

export function renderAdminLiveTestRanksTable() {
      const tbody = document.getElementById('admin-livetest-ranks-tbody');
      const summaryEl = document.getElementById('admin-livetest-ranks-summary');
      const batchFilter = document.getElementById('admin-livetest-rank-batch')?.value || 'ALL';
      const searchQ = (document.getElementById('admin-livetest-rank-search')?.value || '').toLowerCase().trim();
      if (!tbody) return;

      let rows = Array.isArray(window._adminLiveTestRanksCache) ? window._adminLiveTestRanksCache.slice() : [];
      if (batchFilter !== 'ALL') {
        rows = rows.filter(r => String(r.batch || '').toLowerCase() === batchFilter.toLowerCase());
      }
      if (searchQ) {
        rows = rows.filter(r =>
          String(r.name || r.userName || '').toLowerCase().includes(searchQ) ||
          String(r.userId || '').toLowerCase().includes(searchQ) ||
          String(r.batch || '').toLowerCase().includes(searchQ)
        );
      }

      if (summaryEl) {
        const avgAcc = rows.length ? (rows.reduce((a, r) => a + Number(r.accuracy || 0), 0) / rows.length).toFixed(1) : '0.0';
        const avgWpm = rows.length ? Math.round(rows.reduce((a, r) => a + Number(r.speedWpm || 0), 0) / rows.length) : 0;
        summaryEl.innerHTML = rows.length
          ? `Showing <strong>${rows.length}</strong> ranked candidates • Avg Accuracy: <strong style="color:#059669;">${avgAcc}%</strong> • Avg Speed: <strong style="color:var(--primary);">${avgWpm} WPM</strong>`
          : 'No submissions recorded yet for this filter.';
      }

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:22px; color:var(--text-muted);">No candidate submissions found for this Live Test yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map((r, idx) => {
        const rankNum = idx + 1;
        const medal = rankNum === 1 ? '🥇 #1' : (rankNum === 2 ? '🥈 #2' : (rankNum === 3 ? '🥉 #3' : `#${rankNum}`));
        const displayName = r.name || r.userName || r.userId || 'Student';
        const submittedRaw = r.submittedAt || r.timestamp || '';
        return `
          <tr>
            <td class="mono-num" style="font-weight:800; color:${rankNum <= 3 ? '#d97706' : 'var(--secondary)'};">${medal}</td>
            <td><strong>${escapeHtml(displayName)}</strong><div style="font-size:10.5px; color:var(--text-muted);" class="mono-num">${escapeHtml(r.userId || '')}</div></td>
            <td>${escapeHtml(r.batch || 'RP-Trail')}</td>
            <td class="mono-num" style="font-weight:800; color:#059669;">${Number(r.accuracy || 0).toFixed(2)}%</td>
            <td class="mono-num" style="font-weight:700; color:var(--primary);">${Number(r.speedWpm || 0).toFixed(1)} WPM</td>
            <td class="mono-num" style="color:${Number(r.totalErrors || 0) > 10 ? '#dc2626' : 'var(--secondary)'};">${r.totalErrors ?? 0}</td>
            <td style="font-size:11.5px; color:var(--text-muted);">${submittedRaw ? new Date(submittedRaw).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '-'}</td>
          </tr>
        `;
      }).join('');
    }

export function exportAdminLiveTestRanksCsv() {
      const rows = Array.isArray(window._adminLiveTestRanksCache) ? window._adminLiveTestRanksCache : [];
      if (rows.length === 0) {
        showToast('No ranks to export yet.');
        return;
      }
      const header = ['Rank', 'UserID', 'Student Name', 'Batch', 'Accuracy (%)', 'Speed (WPM)', 'Errors', 'Submitted At'];
      const csvLines = [header.join(',')].concat(rows.map((r, i) => [
        i + 1,
        `"${String(r.userId || '').replace(/"/g, '""')}"`,
        `"${String(r.name || r.userName || '').replace(/"/g, '""')}"`,
        `"${String(r.batch || '').replace(/"/g, '""')}"`,
        r.accuracy ?? 0,
        r.speedWpm ?? 0,
        r.totalErrors ?? 0,
        `"${String(r.submittedAt || r.timestamp || '').replace(/"/g, '""')}"`
      ].join(',')));
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LiveTest_MeritList_${getLocalDateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('📥 Downloaded Live Test Merit List CSV!');
    }

window._dedicatedLiveTestsStatusFilter = 'ALL';

export function setDedicatedLiveTestsStatusFilter(status, btnEl) {
      const normalized = String(status || 'ALL').trim().toUpperCase();
      window._dedicatedLiveTestsStatusFilter = normalized;
      document.querySelectorAll('#livetests-status-tabs .rp-segmented-btn').forEach(b => {
        const attr = String(b.getAttribute('data-lt-status') || '').trim().toUpperCase();
        b.classList.toggle('active', b === btnEl || attr === normalized);
      });
      renderDedicatedLiveTestsTab();
    }

export function renderDedicatedLiveTestsTab() {
      const grid = document.getElementById('dedicated-livetests-grid');
      if (!grid) return;
      const rawList = getScheduledLiveTestsList();
      const nowMs = Date.now();
      const isAdmin = portalState.currentUser && ['admin', 'superadmin'].includes(String(portalState.currentUser.role || '').toLowerCase());
      const myBatch = portalState.currentUser && typeof getUserAssignedBatch === 'function'
        ? getUserAssignedBatch(portalState.currentUser.userId || portalState.currentUser.mobile, portalState.currentUser.batch || portalState.currentUser.Batch)
        : 'RP-Trail';

      const myBatchSet = new Set(String(myBatch || 'RP-Trail').split(/[,;|]/).map(b => b.trim().toLowerCase()).filter(Boolean));
      const eligible = rawList.filter(lt => {
        if (isAdmin) return true;
        const tb = String(lt.targetBatch || 'ALL').trim();
        if (!tb || tb.toUpperCase() === 'ALL') return true;
        return myBatchSet.has(tb.toLowerCase());
      });

      const liveCount = eligible.filter(lt => nowMs >= new Date(lt.startTime).getTime() && nowMs < new Date(lt.endTime).getTime()).length;
      const upcomingCount = eligible.filter(lt => nowMs < new Date(lt.startTime).getTime()).length;
      const endedCount = eligible.filter(lt => nowMs >= new Date(lt.endTime).getTime()).length;

      const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
      setTxt('lt-count-all', eligible.length);
      setTxt('lt-count-live', liveCount);
      setTxt('lt-count-upcoming', upcomingCount);
      setTxt('lt-count-ended', endedCount);
      setTxt('lt-kpi-live-now', liveCount);
      setTxt('lt-kpi-upcoming', upcomingCount);
      setTxt('lt-kpi-ended', endedCount);
      setTxt('lt-kpi-total', eligible.length);

      const statusFilter = String(window._dedicatedLiveTestsStatusFilter || 'ALL').trim().toUpperCase();
      const catFilter = document.getElementById('livetests-category-filter')?.value || 'ALL';
      const searchQ = (document.getElementById('livetests-search-input')?.value || '').toLowerCase().trim();

      const filtered = eligible.filter(lt => {
        const sMs = new Date(lt.startTime).getTime();
        const eMs = new Date(lt.endTime).getTime();
        const isLive = nowMs >= sMs && nowMs < eMs;
        const isUp = nowMs < sMs;
        const isEnded = nowMs >= eMs;
        if (statusFilter === 'LIVE' && !isLive) return false;
        if (statusFilter === 'UPCOMING' && !isUp) return false;
        if (statusFilter === 'ENDED' && !isEnded) return false;
        if (catFilter !== 'ALL' && String(lt.category || '').toLowerCase() !== catFilter.toLowerCase()) return false;
        if (searchQ && !String(lt.title || '').toLowerCase().includes(searchQ) && !String(lt.category || '').toLowerCase().includes(searchQ) && !String(lt.targetBatch || '').toLowerCase().includes(searchQ)) return false;
        return true;
      });

      if (filtered.length === 0) {
        grid.innerHTML = window.buildRpEmptyStateHtml(
          'No Live Tests match this filter',
          'Check back soon or switch the status/category filters above to view scheduled Live Audio, Pitman Book, Typing, and CBT contests.',
          'Show All Live Tests',
          "setDedicatedLiveTestsStatusFilter('ALL', document.querySelector('#livetests-status-tabs [data-lt-status=\"ALL\"]'))"
        );
        return;
      }

      grid.innerHTML = filtered.map(lt => {
        const sMs = new Date(lt.startTime).getTime();
        const eMs = new Date(lt.endTime).getTime();
        const isLive = nowMs >= sMs && nowMs < eMs;
        const isUp = nowMs < sMs;
        const catMeta = {
          audio: { label: 'Audio Dictation', icon: 'fa-microphone-lines', color: '#4f46e5' },
          pitman: { label: 'Pitman Book', icon: 'fa-feather-pointed', color: '#0d9488' },
          typingtest: { label: 'Skill Typing', icon: 'fa-keyboard', color: '#0284c7' },
          cbttest: { label: 'CBT Mock Exam', icon: 'fa-desktop', color: '#7c3aed' }
        }[String(lt.category || '').toLowerCase()] || { label: 'Live Test', icon: 'fa-tower-broadcast', color: '#2563eb' };

        let statusHtml = '';
        let actionHtml = '';
        if (isLive) {
          const secsLeft = Math.max(0, Math.floor((eMs - nowMs) / 1000));
          const m = Math.floor(secsLeft / 60);
          const s = String(secsLeft % 60).padStart(2, '0');
          statusHtml = `<span style="color:#dc2626; font-weight:800; font-size:12px;"><i class="fa-solid fa-circle fa-beat-fade" style="font-size:8px;"></i> LIVE NOW • ${m}:${s} left</span>`;
          actionHtml = `
            <button type="button" class="btn btn-danger btn-sm" onclick="launchScheduledLiveTest('${lt.id}')"><i class="fa-solid fa-bolt"></i> Start Live Test</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="openLiveBatchMeritListModal('${lt.id}')"><i class="fa-solid fa-ranking-star"></i> Live Ranks</button>
          `;
        } else if (isUp) {
          const minsUntil = Math.max(1, Math.ceil((sMs - nowMs) / 60000));
          statusHtml = `<span style="color:#d97706; font-weight:700; font-size:12px;">⏳ Starts in ${minsUntil} min</span>`;
          actionHtml = `<button type="button" class="btn btn-primary btn-sm" style="background:#d97706; border-color:#d97706;" onclick="openLiveBatchContestLobby('${lt.id}')"><i class="fa-solid fa-hourglass-start"></i> Enter Countdown Lobby</button>`;
        } else {
          statusHtml = `<span style="color:var(--text-muted); font-weight:700; font-size:12px;">🛑 Window Closed</span>`;
          actionHtml = `<button type="button" class="btn btn-primary btn-sm" style="background:#059669; border-color:#059669;" onclick="openLiveBatchMeritListModal('${lt.id}')"><i class="fa-solid fa-trophy"></i> View Final Ranks</button>`;
        }

        const batchText = (!lt.targetBatch || lt.targetBatch === 'ALL') ? 'All-India Open' : `Batch: ${lt.targetBatch}`;
        return `
          <div style="background:var(--surface); border:1px solid ${isLive ? 'rgba(220,38,38,0.45)' : 'var(--border)'}; border-top:3px solid ${isLive ? '#dc2626' : catMeta.color}; border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:10px; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                <span style="font-size:11px; font-weight:800; color:${catMeta.color}; text-transform:uppercase; letter-spacing:0.04em;"><i class="fa-solid ${catMeta.icon}"></i> ${catMeta.label}</span>
                ${statusHtml}
              </div>
              <h3 style="margin:0 0 6px; font-size:15px; font-weight:800; color:var(--secondary); line-height:1.35;">${escapeHtml(lt.title)}</h3>
              <div style="font-size:12px; color:var(--text-muted); display:flex; flex-direction:column; gap:3px;">
                <span><i class="fa-solid fa-users" style="width:15px;"></i> ${escapeHtml(batchText)}</span>
                <span><i class="fa-regular fa-clock" style="width:15px;"></i> ${new Date(sMs).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })} → ${new Date(eMs).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
              </div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; padding-top:8px; border-top:1px solid var(--border);">${actionHtml}</div>
          </div>
        `;
      }).join('');
    }

export function renderLiveTestsEverywhere() {
      const rawList = getScheduledLiveTestsList();
      const nowMs = Date.now();
      const isAdmin = portalState.currentUser && ['admin', 'superadmin'].includes(String(portalState.currentUser.role || '').toLowerCase());
      const myBatch = portalState.currentUser && typeof getUserAssignedBatch === 'function'
        ? getUserAssignedBatch(portalState.currentUser.userId || portalState.currentUser.mobile, portalState.currentUser.batch || portalState.currentUser.Batch)
        : 'RP-Trail';

      const list = rawList.filter(lt => {
        const eMs = new Date(lt.endTime).getTime();
        const disMins = Number(lt.disappearAfterMinutes || 60);
        const disMs = eMs + (disMins * 60000);
        if (!isNaN(disMs) && nowMs > disMs) return false;
        if (isAdmin) return true;
        if (!lt.targetBatch || lt.targetBatch === 'ALL') return true;
        return lt.targetBatch === myBatch;
      });

      const buildStripHtml = (items) => {
        if (!items || items.length === 0) return '';
        const cardsHtml = items.map(lt => {
          const sMs = new Date(lt.startTime).getTime();
          const eMs = new Date(lt.endTime).getTime();
          const isUpcoming = nowMs < sMs;
          const isLiveNow = nowMs >= sMs && nowMs < eMs;

          let timeBadge = '';
          let actionBtn = '';
          if (isUpcoming) {
            const minsUntil = Math.max(1, Math.ceil((sMs - nowMs) / 60000));
            timeBadge = `<span style="color:#b45309; font-size:11.5px; font-weight:700;">⏳ Starts in ${minsUntil} min</span>`;
            actionBtn = `<button class="btn btn-primary btn-sm" style="background:#d97706; border-color:#d97706;" onclick="openLiveBatchContestLobby('${lt.id}')"><i class="fa-solid fa-hourglass-start"></i> Enter Lobby</button>`;
          } else if (isLiveNow) {
            const secsLeft = Math.max(0, Math.floor((eMs - nowMs) / 1000));
            const mLeft = Math.floor(secsLeft / 60);
            const sLeft = String(secsLeft % 60).padStart(2, '0');
            timeBadge = `<span style="color:#059669; font-size:11.5px; font-weight:800;">● LIVE NOW (${mLeft}:${sLeft} left)</span>`;
            actionBtn = `<div style="display:flex; gap:6px; flex-wrap:wrap;"><button class="btn btn-danger btn-sm" onclick="launchScheduledLiveTest('${lt.id}')"><i class="fa-solid fa-bolt"></i> Start Now</button><button class="btn btn-secondary btn-sm" onclick="openLiveBatchMeritListModal('${lt.id}')"><i class="fa-solid fa-trophy"></i> Ranks</button></div>`;
          } else {
            timeBadge = `<span style="color:var(--text-muted); font-size:11.5px; font-weight:700;">Ended (${new Date(eMs).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})</span>`;
            actionBtn = `<button class="btn btn-primary btn-sm" style="background:#059669; border-color:#059669;" onclick="openLiveBatchMeritListModal('${lt.id}')"><i class="fa-solid fa-medal"></i> View Merit List</button>`;
          }

          const batchText = (!lt.targetBatch || lt.targetBatch === 'ALL') ? 'All-India Open' : `Batch: ${lt.targetBatch}`;
          return `
            <div style="background:var(--surface); border:1px solid ${isLiveNow ? 'rgba(220,38,38,0.45)' : 'var(--border)'}; border-left:4px solid ${isLiveNow ? '#dc2626' : (isUpcoming ? '#d97706' : '#64748b')}; border-radius:10px; padding:11px 14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; flex-direction:column; gap:3px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span class="subtab-badge">${escapeHtml((lt.category === 'pitman' ? 'PITMAN' : (lt.category || 'TEST')).toUpperCase())}</span>
                  <strong style="font-size:13.5px; color:var(--secondary);">${escapeHtml(lt.title)}</strong>
                  ${timeBadge}
                </div>
                <div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(batchText)} • ${new Date(sMs).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} → ${new Date(eMs).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
              </div>
              <div>${actionBtn}</div>
            </div>
          `;
        }).join('');
        return `<div style="display:flex; flex-direction:column; gap:8px;">${cardsHtml}</div>`;
      };

      const dashStrip = document.getElementById('dashboard-live-tests-strip');
      if (dashStrip) {
        if (list.length > 0) {
          dashStrip.style.display = 'block';
          dashStrip.innerHTML = buildStripHtml(list);
        } else {
          dashStrip.style.display = 'none';
          dashStrip.innerHTML = '';
        }
      }

      ['audio', 'pitman', 'typingtest', 'cbttest'].forEach(cat => {
        const el = document.getElementById(`${cat}-live-tests-strip`);
        if (!el) return;
        const catItems = list.filter(item => item.category === cat);
        if (catItems.length > 0) {
          el.style.display = 'block';
          el.innerHTML = buildStripHtml(catItems);
        } else {
          el.style.display = 'none';
          el.innerHTML = '';
        }
      });

      if (portalState.activeTab === 'livetests') {
        renderDedicatedLiveTestsTab();
      }
    }

export function launchScheduledLiveTest(liveTestId) {
      const list = getScheduledLiveTestsList();
      const lt = list.find(x => x.id === liveTestId);
      if (!lt) {
        showToast('Scheduled Live Test not found.');
        return;
      }
      const nowMs = Date.now();
      const sMs = new Date(lt.startTime).getTime();
      const eMs = new Date(lt.endTime).getTime();
      if (nowMs < sMs) {
        showToast(`⏳ This Live Test has not started yet. Starts at ${new Date(sMs).toLocaleTimeString()}.`);
        return;
      }
      if (nowMs >= eMs) {
        showToast('🛑 This Live Test window has already ended.');
        return;
      }

      window.activeScheduledLiveTestObj = lt;
      window.activeScheduledLiveTestEndTime = eMs;
      const remainingMinutes = Math.max(0.5, (eMs - nowMs) / 60000);

      if (lt.category === 'cbttest') {
        window.lastOriginTabBeforeTest = portalState.activeTab === 'livetests' ? 'livetests' : 'cbttest';
        navigateTo('cbttest', false, true);
        const cbtList = typeof getAllAvailableCbtTests === 'function' ? getAllAvailableCbtTests() : [];
        if (cbtList.length > 0) {
          startCbtMockTest(lt.materialId, remainingMinutes);
        } else {
          showToast('No CBT exam material has been uploaded for this live test yet.', 'warning');
        }
      } else if (lt.category === 'pitman') {
        window.lastOriginTabBeforeTest = portalState.activeTab === 'livetests' ? 'livetests' : 'pitman';
        navigateTo('pitman', false, true);
        let foundPitman = (portalState.materialsData || []).find(m => String(m.ID) === String(lt.materialId))
          || (portalState.materialsData || []).find(m => String(m.Type || '').toLowerCase() === 'pitman');
        if (!foundPitman) {
          showToast('No Pitman Book exercise has been uploaded for this live test yet. Please upload a Pitman exercise first.', 'warning');
          return;
        }
        if (lt.evalRuleKey && portalState.allEvaluationRules && portalState.allEvaluationRules[lt.evalRuleKey]) {
          startPitmanTest(foundPitman, lt.evalRuleKey);
        } else {
          startPitmanTestById(foundPitman.ID);
        }
      } else if (lt.category === 'audio') {
        window.lastOriginTabBeforeTest = portalState.activeTab === 'livetests' ? 'livetests' : 'audio';
        navigateTo('audio', false, true);
        let foundAudio = (portalState.materialsData || []).find(m => String(m.ID) === String(lt.materialId))
          || (portalState.materialsData || []).find(m => String(m.Type || '').toLowerCase() === 'audio');
        if (!foundAudio) {
          showToast('No audio dictation material has been uploaded for this live test yet.', 'warning');
          return;
        }
        startAudioDictationTestById(foundAudio.ID);
      } else {
        window.lastOriginTabBeforeTest = portalState.activeTab === 'livetests' ? 'livetests' : 'typingtest';
        navigateTo('typingtest', false, true);
        let foundPassage = (portalState.materialsData || []).find(m => String(m.ID) === String(lt.materialId))
          || (portalState.materialsData || []).find(m => String(m.Type || '').toLowerCase() === 'typingtest');
        if (!foundPassage) {
          showToast('No typing passage has been uploaded for this live test yet.', 'warning');
          return;
        }
        startTypingExam(foundPassage);
      }
    }

if (window._liveTestsRefreshIntervalId) clearInterval(window._liveTestsRefreshIntervalId);

window._liveTestsRefreshIntervalId = setInterval(() => {
      if (portalState.currentUser && !document.hidden && ['dashboard', 'livetests', 'audio', 'pitman', 'typingtest', 'cbttest', 'admin'].includes(portalState.activeTab)) {
        renderLiveTestsEverywhere();
      }
    }, 5000);

document.addEventListener('click', function(event) {
      const profilePopup = document.getElementById('profile-popup');
      const userMenuTrigger = document.getElementById('user-menu-trigger');
      
      if (!profilePopup || !userMenuTrigger) return;
      if (!profilePopup.contains(event.target) && !userMenuTrigger.contains(event.target)) {
        profilePopup.classList.remove('show');
      }
    });

export function openReferenceVideoModal(rawUrl, title) {
      if (!rawUrl || rawUrl.trim() === '' || rawUrl.trim() === '-') {
        showToast('Invalid or missing video link.');
        return;
      }

      const modal = document.getElementById('reference-video-modal');
      const viewport = document.getElementById('ref-video-modal-viewport');
      const titleElem = document.getElementById('ref-video-modal-title');

      const clipCfg = typeof window.resolveMaterialMediaClipConfig === 'function'
        ? window.resolveMaterialMediaClipConfig(rawUrl, title)
        : { startSec: null, endSec: null, startLabel: '', endLabel: '' };
      const clipLabelText = (clipCfg.startLabel || clipCfg.endLabel)
        ? ` [Clip: ${clipCfg.startLabel || '00:00'} – ${clipCfg.endLabel || 'End'}]`
        : '';

      if (titleElem) titleElem.innerText = (title || 'Reference Video') + clipLabelText;
      if (!modal || !viewport) return;

      let url = rawUrl.trim();
      let mediaHtml = '';
      const ytClipQuery = typeof window.buildYouTubeClipQueryParams === 'function'
        ? window.buildYouTubeClipQueryParams(clipCfg.startSec, clipCfg.endSec)
        : '';

      const jumpBarHtml = `
        <div id="ref-video-jump-toolbar" style="display: none; background: #0f172a; color: #f8fafc; padding: 6px 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; border-bottom: 1px solid #334155; z-index: 30; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
            <input type="text" id="ref-video-jump-time-input" placeholder="MM:SS" style="width: 82px; padding: 3px 7px; border-radius: 6px; border: 1px solid #475569; background: #1e293b; color: #fff; font-size: 11.5px; font-weight: 700; margin: 0; min-height: 28px;">
            <button type="button" class="btn btn-primary btn-sm" style="padding: 3px 9px; font-size: 11px; min-height: 28px;" onclick="window.seekActiveMediaPlayerToInput('ref-video-jump-time-input')">Go</button>
            ${clipLabelText ? `<span style="font-size:10.5px; font-weight:800; color:#34d399; background:rgba(16,185,129,0.16); padding:2px 7px; border-radius:999px;">✂️ ${clipCfg.startLabel || '00:00'} – ${clipCfg.endLabel || 'End'}</span>` : ''}
          </div>
          <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 10.5px; min-height: 26px;" onclick="window.seekActiveMediaPlayerByOffset(-30)">-30s</button>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 10.5px; min-height: 26px;" onclick="window.seekActiveMediaPlayerByOffset(30)">+30s</button>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 10.5px; min-height: 26px;" onclick="window.seekActiveMediaPlayerToSeconds(120)">02:00</button>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 10.5px; min-height: 26px;" onclick="window.seekActiveMediaPlayerToSeconds(300)">05:00</button>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 10.5px; min-height: 26px;" onclick="window.seekActiveMediaPlayerToSeconds(600)">10:00</button>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 7px; font-size: 10.5px; min-height: 26px;" onclick="window.seekActiveMediaPlayerToSeconds(900)">15:00</button>
          </div>
        </div>
      `;

      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('watch?v=')) videoId = url.split('watch?v=')[1]?.split('&')[0];
        else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1]?.split('?')[0];
        else if (url.includes('embed/')) videoId = url.split('embed/')[1]?.split('?')[0];
        else if (url.includes('shorts/')) videoId = url.split('shorts/')[1]?.split('?')[0];

        if (videoId) {
          mediaHtml = `
            <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; min-height: 0;">
              ${jumpBarHtml}
              <iframe id="ref-youtube-video-iframe" data-yt-id="${videoId}" src="https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&playsinline=1${ytClipQuery}&origin=${encodeURIComponent(window.location.origin)}" style="width:100%; flex:1; min-height:0; border:none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
          `;
        }
      } else if (isGoogleDriveOrDocsUrl(url)) {
        const fileId = extractGoogleDriveFileId(url);
        if (fileId) {
          const proxiedVideoUrl = buildProtectedMediaProxyUrl(url, 'video');
          mediaHtml = `
            <div style="position: relative; width: 100%; height: 100%; background: #000; display: flex; flex-direction: column; min-height: 0;" oncontextmenu="return false;">
              ${jumpBarHtml}
              <video id="ref-html5-video-player" controls autoplay playsinline controlsList="nodownload noplaybackrate" disablePictureInPicture oncontextmenu="return false;" style="width:100%; flex:1; min-height:0; object-fit: contain;" src="${proxiedVideoUrl}" onerror="const e=document.getElementById('ref-protected-video-err'); if(e) e.style.display='flex';"></video>
              <div id="ref-protected-video-err" style="display:none; position:absolute; inset:0; align-items:center; justify-content:center; padding:24px; text-align:center; color:#e2e8f0; background:rgba(15,23,42,0.92); font-size:13px; flex-direction:column; gap:10px;">
                <i class="fa-solid fa-shield-halved" style="font-size:28px; color:#38bdf8;"></i>
                <strong>Protected video stream unavailable</strong>
                <span style="color:#94a3b8; max-width:380px;">Ensure the source file is shared as "Anyone with the link" on Google Drive so the portal server can stream it privately without exposing Drive.</span>
              </div>
            </div>
          `;
        } else {
          const proxiedGeneric = buildProtectedMediaProxyUrl(url, 'video');
          mediaHtml = `
            <div style="width:100%; height:100%; display:flex; flex-direction:column; background:#000; min-height: 0;" oncontextmenu="return false;">
              ${jumpBarHtml}
              <video id="ref-html5-video-player" controls autoplay playsinline controlsList="nodownload" disablePictureInPicture oncontextmenu="return false;" style="width:100%; flex:1; min-height:0; object-fit: contain;" src="${proxiedGeneric}"></video>
            </div>
          `;
        }
      } else if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) || url.includes('raw.githubusercontent.com') || /^https?:\/\//i.test(url)) {
        const proxiedDirect = buildProtectedMediaProxyUrl(url, 'video');
        mediaHtml = `
          <div style="width:100%; height:100%; display:flex; flex-direction:column; background:#000; min-height: 0;" oncontextmenu="return false;">
            ${jumpBarHtml}
            <video id="ref-html5-video-player" controls autoplay playsinline controlsList="nodownload" disablePictureInPicture oncontextmenu="return false;" style="width:100%; flex:1; min-height:0; object-fit: contain;" src="${proxiedDirect}">
              Your browser does not support video playback.
            </video>
          </div>
        `;
      } else {
        mediaHtml = `
          <div style="position: relative; width: 100%; height: 100%; display:flex; align-items:center; justify-content:center; color:#cbd5e1; font-size:13px; padding:20px; text-align:center;">
            Unsupported media format.
          </div>
        `;
      }

      viewport.innerHTML = mediaHtml;
      const toggleJumpBtn = document.getElementById('ref-video-toggle-jump-btn');
      if (toggleJumpBtn) {
        toggleJumpBtn.style.display = document.getElementById('ref-video-jump-toolbar') ? 'inline-flex' : 'none';
      }
      modal.style.display = 'flex';

      // Automatically sync video duration from loaded video metadata & enforce Start/End clip bounds
      const html5Vid = document.getElementById('ref-html5-video-player');
      if (html5Vid) {
        if (typeof window.bindHtml5MediaClipBounds === 'function') {
          window.bindHtml5MediaClipBounds(html5Vid, clipCfg.startSec, clipCfg.endSec);
        }
        html5Vid.addEventListener('loadedmetadata', () => {
          if (html5Vid.duration && isFinite(html5Vid.duration) && html5Vid.duration > 0) {
            const mins = Math.max(1, Math.round(html5Vid.duration / 60));
            if (titleElem) titleElem.innerText = `${title || 'Video Class'} (${mins} Mins)${clipLabelText}`;
            const matchedMat = (portalState.materialsData || []).find(m => m.ContentOrUrl === rawUrl || m.Title === title);
            if (matchedMat) {
              matchedMat.TimeLimit = String(mins);
              renderVideoCourseList(portalState.currentSubtabFilter.videocourse || 'ALL');
            }
          }
        });
      } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const ytId = extractYouTubeVideoId(url);
        if (ytId && typeof probeYouTubeVideoDuration === 'function') {
          probeYouTubeVideoDuration(ytId, (durSec) => {
            if (durSec && durSec > 0) {
              const mins = Math.max(1, Math.round(durSec / 60));
              if (titleElem) titleElem.innerText = `${title || 'Video Class'} (${mins} Mins)${clipLabelText}`;
              const matchedMat = (portalState.materialsData || []).find(m => m.ContentOrUrl === rawUrl || m.Title === title);
              if (matchedMat) {
                matchedMat.TimeLimit = String(mins);
                renderVideoCourseList(portalState.currentSubtabFilter.videocourse || 'ALL');
              }
            }
          });
        }
      }

      enterImmersiveFullscreenLock('reference-video');

      if (portalState.currentUser) {
        apiCall('logActivity', { userId: portalState.currentUser.userId, userName: portalState.currentUser.name, activityType: 'WATCH_VIDEO', details: title });
      }
    }

window.toggleRefVideoJumpToolbar = function() {
      const bar = document.getElementById('ref-video-jump-toolbar');
      if (!bar) return;
      const isHidden = bar.style.display === 'none' || !bar.style.display;
      bar.style.display = isHidden ? 'flex' : 'none';
    };

window.toggleCompactViewerChrome = function(viewerType, hideBar) {
      if (viewerType === 'embedded-image') {
        const bar = document.getElementById('embedded-image-top-bar');
        const pill = document.getElementById('embedded-image-restore-pill');
        if (bar) bar.style.display = hideBar ? 'none' : 'flex';
        if (pill) pill.style.display = hideBar ? 'flex' : 'none';
        const img = document.getElementById('embedded-modal-img');
        if (img && customImageZoomLevel === 1) {
          img.style.maxHeight = hideBar ? 'calc(100dvh - 14px)' : 'calc(100dvh - 54px)';
        }
      } else if (viewerType === 'reader') {
        const bar = document.getElementById('reader-modal-top-bar');
        const pill = document.getElementById('reader-restore-pill');
        if (bar) bar.style.display = hideBar ? 'none' : 'flex';
        if (pill) pill.style.display = hideBar ? 'flex' : 'none';
        if (!customPdfDoc) {
          applyFallbackPdfZoomLayout();
        }
      }
    };

export function closeReferenceVideoModal() {
      const modal = document.getElementById('reference-video-modal');
      const viewport = document.getElementById('ref-video-modal-viewport');
      if (viewport) viewport.innerHTML = '';
      if (modal) modal.style.display = 'none';
      exitImmersiveFullscreenLock('reference-video');

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }

export function extractYouTubeVideoId(url) {
      if (!url) return '';
      if (url.includes('watch?v=')) return url.split('watch?v=')[1]?.split('&')[0] || '';
      if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split('?')[0] || '';
      if (url.includes('embed/')) return url.split('embed/')[1]?.split('?')[0] || '';
      if (url.includes('shorts/')) return url.split('shorts/')[1]?.split('?')[0] || '';
      return '';
    }

export let universalAudioTimeSyncInterval = null;

export let universalVirtualElapsedSec = 0;

export let universalVirtualTotalSec = 600;

export let universalVirtualPlaying = false;

export function formatAudioTimeMmSs(secVal) {
      const s = Math.max(0, Math.floor(Number(secVal) || 0));
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return String(m).padStart(2, '0') + ':' + String(rem).padStart(2, '0');
    }

export function renderUniversalAudioTimeSeekBarHtml() {
      return `
        <div id="universal-audio-time-bar-container" style="margin-top: 8px; width: 100%; max-width: 620px; background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: 12px; padding: 12px 16px; text-align: left; color: #f8fafc; box-shadow: 0 6px 18px rgba(0,0,0,0.28);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12px; font-weight: 800; color: #e2e8f0;">
            <span><i class="fa-solid fa-wave-square" style="color: #38bdf8;"></i> Audio Progress &amp; Timeline Seek Bar</span>
            <span style="font-family: monospace; font-size: 12.5px; color: #38bdf8; background: rgba(56,189,248,0.14); padding: 2px 10px; border-radius: 999px; border: 1px solid rgba(56,189,248,0.3);">
              <span id="universal-audio-cur-time">00:00</span> / <span id="universal-audio-tot-time">00:00</span>
            </span>
          </div>
          <input type="range" id="universal-audio-seek-slider" min="0" max="100" value="0" step="0.5"
            style="width: 100%; accent-color: #38bdf8; cursor: pointer; height: 6px; margin: 6px 0;"
            oninput="seekUniversalAudioTimeline(this.value)" />
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 6px;">
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 11px;" onclick="skipUniversalAudioSeconds(-10)">
              <i class="fa-solid fa-backward-step"></i> -10s
            </button>
            <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">Drag timeline bar to seek audio position</span>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 11px;" onclick="skipUniversalAudioSeconds(10)">
              +10s <i class="fa-solid fa-forward-step"></i>
            </button>
          </div>
        </div>
      `;
    }

export function startUniversalAudioTimeBarSync() {
      if (universalAudioTimeSyncInterval) clearInterval(universalAudioTimeSyncInterval);
      universalVirtualElapsedSec = 0;
      universalVirtualPlaying = true;
      universalAudioTimeSyncInterval = setInterval(() => {
        const mediaEl = document.getElementById('universal-audio-player');
        const curEl = document.getElementById('universal-audio-cur-time');
        const totEl = document.getElementById('universal-audio-tot-time');
        const sliderEl = document.getElementById('universal-audio-seek-slider');
        if (!curEl || !totEl || !sliderEl) return;

        if (mediaEl && typeof mediaEl.currentTime === 'number') {
          const cur = mediaEl.currentTime || 0;
          const dur = (Number.isFinite(mediaEl.duration) && mediaEl.duration > 0) ? mediaEl.duration : 0;
          curEl.innerText = formatAudioTimeMmSs(cur);
          totEl.innerText = dur > 0 ? formatAudioTimeMmSs(dur) : '--:--';
          if (dur > 0) {
            sliderEl.max = String(Math.floor(dur));
            sliderEl.value = String(Math.floor(cur));
          }
        } else {
          if (universalVirtualPlaying) {
            universalVirtualElapsedSec += 0.5;
          }
          curEl.innerText = formatAudioTimeMmSs(universalVirtualElapsedSec);
          totEl.innerText = formatAudioTimeMmSs(universalVirtualTotalSec);
          sliderEl.max = String(universalVirtualTotalSec);
          sliderEl.value = String(Math.min(universalVirtualTotalSec, Math.floor(universalVirtualElapsedSec)));
        }
      }, 500);
    }

export function seekUniversalAudioTimeline(targetSecValue) {
      const targetSec = Math.max(0, parseFloat(targetSecValue) || 0);
      const mediaEl = document.getElementById('universal-audio-player');
      if (mediaEl && typeof mediaEl.currentTime === 'number') {
        try { mediaEl.currentTime = targetSec; } catch (e) {}
      } else {
        universalVirtualElapsedSec = Math.floor(targetSec);
        sendYouTubeAudioCommand('seekTo', [Math.floor(targetSec), true]);
      }
      const curEl = document.getElementById('universal-audio-cur-time');
      if (curEl) curEl.innerText = formatAudioTimeMmSs(targetSec);
    }

export function skipUniversalAudioSeconds(deltaSec) {
      const mediaEl = document.getElementById('universal-audio-player');
      if (mediaEl && typeof mediaEl.currentTime === 'number') {
        const nextSec = Math.max(0, (mediaEl.currentTime || 0) + deltaSec);
        seekUniversalAudioTimeline(nextSec);
      } else {
        const nextSec = Math.max(0, universalVirtualElapsedSec + deltaSec);
        seekUniversalAudioTimeline(nextSec);
      }
    }

export function stepDictationWpmBy5(delta = 5) {
      const cur = typeof currentDictationWpm !== 'undefined' && currentDictationWpm ? Number(currentDictationWpm) : 80;
      const nextWpm = Math.max(40, Math.min(250, Math.round((cur + delta) / 5) * 5));
      setSyncedTargetWpmPace(nextWpm);
    }

export function renderWpmSpeedButtonsHtml(lightTheme = false) {
      const wpmPresets = [60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 140, 160];
      const bgStyle = lightTheme
        ? 'background: var(--background); border: 1px solid var(--border); color: var(--secondary);'
        : 'background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.16); color: #fff;';
      const isSyncOn = window.isAudioSpeedSyncedWithWpm !== false;
      const baseWpm = window.detectedSourceAudioBaseWpm || 80;
      const activeTargetWpm = typeof currentDictationWpm !== 'undefined' && currentDictationWpm ? currentDictationWpm : 80;
      return `
        <div class="wpm-control-panel" style="display: flex; flex-direction: column; gap: 10px; align-items: center; justify-content: center; ${bgStyle} padding: 12px 16px; border-radius: 12px; width: 100%; max-width: 920px;">
          <!-- Sync Audio Speed with WPM Toggle + Real-Time Pitch-Preserved ±5 WPM Shifter -->
          <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(148,163,184,0.25);">
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; font-weight: 800; margin: 0;">
              <input type="checkbox" class="modal-sync-wpm-toggle" ${isSyncOn ? 'checked' : ''} onchange="toggleSyncAudioSpeedWithWpm(this.checked, this)" style="width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer; margin: 0;">
              <span><i class="fa-solid fa-wave-square" style="color: var(--primary);"></i> Pitch-Preserved WPM Speed Shifter (5 WPM Steps)</span>
              <span class="modal-sync-wpm-pill" style="background: ${isSyncOn ? '#10b981' : '#64748b'}; color: #fff; font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px;">${isSyncOn ? 'PITCH NORMALIZED' : 'MANUAL'}</span>
            </label>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <button type="button" class="btn btn-sm btn-secondary" onclick="stepDictationWpmBy5(-5)" style="padding: 3px 9px; font-size: 11px; font-weight: 900;">-5 WPM</button>
              <span class="custom-wpm-readout" style="font-size: 11.5px; font-weight: 900; background: var(--primary); color: #fff; padding: 3px 10px; border-radius: 999px;">${activeTargetWpm} WPM</span>
              <button type="button" class="btn btn-sm btn-secondary" onclick="stepDictationWpmBy5(5)" style="padding: 3px 9px; font-size: 11px; font-weight: 900;">+5 WPM</button>
              <span class="modal-source-base-wpm-info" style="font-size: 11px; font-weight: 700; opacity: 0.85;">
                Base: <strong>${baseWpm} WPM</strong> (${(activeTargetWpm / baseWpm).toFixed(2)}x Pitch-Preserved)
              </span>
            </div>
          </div>
          <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap; justify-content: center;">
            <span style="font-size: 11.5px; font-weight: 800; margin-right: 4px;"><i class="fa-solid fa-gauge-high" style="color: var(--primary);"></i> 5-WPM Presets:</span>
            ${wpmPresets.map(wpm => {
              const rate = Number((wpm / baseWpm).toFixed(4));
              const isDefault = wpm === activeTargetWpm;
              return `<button type="button" class="btn btn-sm ${isDefault ? 'btn-primary' : 'btn-secondary'} speed-btn" data-wpm="${wpm}" onclick="setAudioSpeed(${rate}, this, ${wpm})" style="${isDefault ? 'background: var(--primary);' : ''} padding: 4px 8px; font-size: 11px;">${wpm} WPM</button>`;
            }).join('')}
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; width: 100%; max-width: 720px; padding-top: 6px; border-top: 1px dashed rgba(148,163,184,0.28);">
            <span style="font-size: 11px; font-weight: 800; color: var(--primary);"><i class="fa-solid fa-sliders"></i> Fine 5-WPM Slider (60–140 WPM):</span>
            <input type="range" class="modal-quick-60-140-slider" min="60" max="140" step="5" value="${Math.max(60, Math.min(140, activeTargetWpm))}" oninput="handleAudioCustom60To140Slider(this.value, this)" style="flex: 1; min-width: 150px; accent-color: var(--primary); cursor: pointer; margin: 0;">
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; width: 100%; max-width: 620px; padding-top: 4px;">
            <span style="font-size: 10.5px; font-weight: 700; opacity: 0.85;">Full Range (40–250 WPM • 5 WPM Step):</span>
            <input type="range" min="40" max="250" step="5" value="${activeTargetWpm}" oninput="setCustomWpmSpeedFromSlider(this.value, this)" style="flex: 1; min-width: 120px; accent-color: #6366f1; cursor: pointer; margin: 0;">
          </div>
        </div>
      `;
    }

window.isAudioSpeedSyncedWithWpm = true;

window.detectedSourceAudioBaseWpm = 80;

export function detectBaseWpmFromAudioItem(item, audioDurationSeconds = 0) {
      if (!item) return 80;
      const passage = (item.ThumbnailUrl && item.ThumbnailUrl !== '-' && !item.ThumbnailUrl.startsWith('http'))
        ? item.ThumbnailUrl
        : (item.ContentOrUrl && !item.ContentOrUrl.startsWith('http') ? item.ContentOrUrl : '');
      const wordCount = passage ? passage.trim().split(/\s+/).filter(Boolean).length : 0;

      if (audioDurationSeconds > 8 && wordCount >= 15) {
        const calcWpm = Math.round(wordCount / (audioDurationSeconds / 60));
        if (calcWpm >= 40 && calcWpm <= 220) {
          return calcWpm;
        }
      }

      const combinedTitle = `${item.Title || ''} ${item.Subtab || ''} ${item.Category || ''}`;
      const match = combinedTitle.match(/(\d{2,3})\s*wpm/i);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (parsed >= 40 && parsed <= 250) return parsed;
      }
      return 80;
    }

export function updateSyncAudioWpmUI() {
      const isSyncOn = window.isAudioSpeedSyncedWithWpm !== false;
      const baseWpm = window.detectedSourceAudioBaseWpm || 80;
      const targetWpm = typeof currentDictationWpm !== 'undefined' && currentDictationWpm ? currentDictationWpm : 80;
      const alignedRate = isSyncOn ? Number((targetWpm / baseWpm).toFixed(2)) : 1.0;

      const headerToggle = document.getElementById('audio-tab-sync-wpm-toggle');
      if (headerToggle) headerToggle.checked = isSyncOn;

      const headerPill = document.getElementById('audio-wpm-sync-status-pill');
      if (headerPill) {
        headerPill.innerText = isSyncOn ? 'ACTIVE' : 'OFF';
        headerPill.style.background = isSyncOn ? '#10b981' : '#64748b';
      }

      const headerSelect = document.getElementById('audio-tab-target-wpm-select');
      if (headerSelect) {
        const hasOpt = Array.from(headerSelect.options).some(o => parseInt(o.value, 10) === targetWpm);
        if (hasOpt) headerSelect.value = String(targetWpm);
      }

      const slider60140 = document.getElementById('audio-custom-wpm-slider-60-140');
      if (slider60140 && targetWpm >= 60 && targetWpm <= 140) {
        slider60140.value = String(targetWpm);
      }
      const badge60140 = document.getElementById('audio-custom-wpm-slider-badge');
      if (badge60140) {
        badge60140.innerText = `${targetWpm} WPM`;
      }

      const baseLabel = document.getElementById('audio-tab-source-base-wpm-label');
      if (baseLabel) {
        baseLabel.innerText = isSyncOn
          ? `Base: ${baseWpm} WPM → ${targetWpm} WPM (${alignedRate}x Sync)`
          : `Sync Off (Original 1.0x Base: ${baseWpm} WPM)`;
      }

      document.querySelectorAll('.modal-sync-wpm-toggle').forEach(chk => {
        chk.checked = isSyncOn;
      });
      document.querySelectorAll('.modal-sync-wpm-pill').forEach(p => {
        p.innerText = isSyncOn ? 'ACTIVE' : 'MANUAL';
        p.style.background = isSyncOn ? '#10b981' : '#64748b';
      });
      document.querySelectorAll('.modal-source-base-wpm-info').forEach(info => {
        info.innerHTML = isSyncOn
          ? `Source Base: <strong>${baseWpm} WPM</strong> → Pace Rate: <strong>${alignedRate}x</strong> (Pitch-Preserved)`
          : `Sync Disabled — Playing at Native 1.00x Recording Rate (Base: ${baseWpm} WPM)`;
      });
    }

export function toggleSyncAudioSpeedWithWpm(isChecked, sourceEl = null) {
      window.isAudioSpeedSyncedWithWpm = Boolean(isChecked);
      const baseWpm = window.detectedSourceAudioBaseWpm || 80;
      const targetWpm = typeof currentDictationWpm !== 'undefined' && currentDictationWpm ? currentDictationWpm : 80;
      updateSyncAudioWpmUI();

      if (window.isAudioSpeedSyncedWithWpm) {
        const rate = Number((targetWpm / baseWpm).toFixed(4));
        setAudioSpeed(rate, null, targetWpm);
        showToast(`✅ Sync Audio Speed with WPM enabled (${targetWpm} WPM aligned to ${baseWpm} WPM base)`);
      } else {
        const audioIds = ['universal-audio-player', 'active-audio-exam-player', 'stenoshala-dictation-audio'];
        audioIds.forEach(id => {
          const audioElem = document.getElementById(id);
          if (audioElem) audioElem.playbackRate = 1.0;
        });
        sendYouTubeAudioCommand('setPlaybackRate', [1.0]);
        showToast('⏸️ Sync Audio Speed with WPM paused (Playing at native 1.0x audio rate)');
      }
      if (typeof logPortalAction === 'function') {
        logPortalAction('AUDIO_WPM_SYNC_TOGGLE', `Toggled Sync Audio Speed with WPM: ${window.isAudioSpeedSyncedWithWpm ? 'ON' : 'OFF'} (Target: ${targetWpm} WPM, Base: ${baseWpm} WPM)`);
      }
    }

export function setSyncedTargetWpmPace(wpmVal) {
      const targetWpm = Math.max(40, Math.min(250, parseInt(wpmVal, 10) || 80));
      currentDictationWpm = targetWpm;
      const baseWpm = window.detectedSourceAudioBaseWpm || 80;
      const rate = window.isAudioSpeedSyncedWithWpm !== false
        ? Number((targetWpm / baseWpm).toFixed(4))
        : Number((targetWpm / 80).toFixed(4));
      setAudioSpeed(rate, null, targetWpm);
      updateSyncAudioWpmUI();
    }

export function handleAudioCustom60To140Slider(wpmVal, sliderEl = null) {
      const wpm = Math.max(60, Math.min(140, Math.round((parseInt(wpmVal, 10) || 80) / 5) * 5));
      const badge = document.getElementById('audio-custom-wpm-slider-badge');
      if (badge) badge.innerText = `${wpm} WPM`;
      const mainSlider = document.getElementById('audio-custom-wpm-slider-60-140');
      if (mainSlider && mainSlider !== sliderEl) mainSlider.value = String(wpm);
      setCustomWpmSpeedFromSlider(wpm, sliderEl);
    }

export function setCustomWpmSpeedFromSlider(wpmVal, sliderEl) {
      const wpm = Math.max(40, Math.min(250, parseInt(wpmVal) || 80));
      const baseWpm = (window.isAudioSpeedSyncedWithWpm !== false && window.detectedSourceAudioBaseWpm) ? window.detectedSourceAudioBaseWpm : 80;
      const rate = Number((wpm / baseWpm).toFixed(4));
      if (sliderEl && sliderEl.parentElement) {
        const readout = sliderEl.parentElement.querySelector('.custom-wpm-readout');
        if (readout) readout.innerText = `${wpm} WPM`;
      }
      setAudioSpeed(rate, null, wpm);
    }

export function sendYouTubeAudioCommand(funcName, argsArray = []) {
      const ytFrames = [
        document.getElementById('hidden-youtube-audio'),
        document.getElementById('stenoshala-youtube-audio')
      ];
      ytFrames.forEach(iframe => {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: funcName,
            args: argsArray
          }), '*');
        }
      });
    }

export function setAudioSpeed(rate, btn, wpmLabel = null) {
      const baseWpm = (window.isAudioSpeedSyncedWithWpm !== false && window.detectedSourceAudioBaseWpm) ? window.detectedSourceAudioBaseWpm : 80;
      const computedWpm = wpmLabel || Math.max(40, Math.min(250, Math.round((Number(rate) || 1.0) * baseWpm)));
      currentDictationWpm = computedWpm;
      const effectiveRate = window.isAudioSpeedSyncedWithWpm !== false
        ? Math.max(0.35, Math.min(3.5, Number((computedWpm / baseWpm).toFixed(4))))
        : Math.max(0.35, Math.min(3.5, Number(rate) || 1.0));

      // 1. Direct HTML5 audio players with Pitch Preservation for natural shorthand dictation voice
      const audioIds = ['universal-audio-player', 'active-audio-exam-player', 'stenoshala-dictation-audio'];
      audioIds.forEach(id => {
        const audioElem = document.getElementById(id);
        if (audioElem) {
          try {
            if ('preservesPitch' in audioElem) audioElem.preservesPitch = true;
            if ('mozPreservesPitch' in audioElem) audioElem.mozPreservesPitch = true;
            if ('webkitPreservesPitch' in audioElem) audioElem.webkitPreservesPitch = true;
            audioElem.playbackRate = effectiveRate;
          } catch (e) {
            audioElem.playbackRate = Math.max(0.5, Math.min(2.0, effectiveRate));
          }
        }
      });

      // Update any active WPM badge
      document.querySelectorAll('.wpm-active-badge').forEach(b => {
        b.innerText = `Speed: ${computedWpm} WPM${window.isAudioSpeedSyncedWithWpm !== false ? ' (WPM-Synced)' : ''}`;
      });

      // 2. YouTube Audio-Only iframes via postMessage
      sendYouTubeAudioCommand('setPlaybackRate', [Math.max(0.25, Math.min(2.0, effectiveRate))]);

      // 3. Sync TTS dropdown if present
      const ttsSelect = document.getElementById('tts-wpm-speed-select');
      if (ttsSelect) {
        const matchingOpt = Array.from(ttsSelect.options).find(o => parseInt(o.value) === computedWpm);
        if (matchingOpt) ttsSelect.value = String(computedWpm);
      }

      // 4. Highlight active speed button
      if (btn) {
        const panel = btn.closest('.wpm-control-panel') || btn.parentElement;
        if (panel) {
          panel.querySelectorAll('.speed-btn').forEach(b => {
            b.classList.remove('btn-primary');
            b.classList.add('btn-secondary');
            b.style.background = '';
          });
          const readout = panel.querySelector('.custom-wpm-readout');
          if (readout) readout.innerText = `${computedWpm} WPM`;
          const slider = panel.querySelector('input[type="range"]');
          if (slider) slider.value = String(computedWpm);
        }
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        btn.style.background = 'var(--primary)';
      } else {
        document.querySelectorAll('.wpm-control-panel').forEach(panel => {
          panel.querySelectorAll('.speed-btn').forEach(b => {
            const btnWpm = parseInt(b.getAttribute('data-wpm') || '0', 10);
            const isMatch = btnWpm === computedWpm;
            b.classList.toggle('btn-primary', isMatch);
            b.classList.toggle('btn-secondary', !isMatch);
            b.style.background = isMatch ? 'var(--primary)' : '';
          });
          const readout = panel.querySelector('.custom-wpm-readout');
          if (readout) readout.innerText = `${computedWpm} WPM`;
          const slider = panel.querySelector('input[type="range"]');
          if (slider) slider.value = String(computedWpm);
        });
      }
      updateSyncAudioWpmUI();
      showToast(`Dictation pace synced to ${computedWpm} WPM (${effectiveRate.toFixed(2)}x rate)`);
    }

export function restartYouTubeAudio(videoId) {
      const iframe = document.getElementById('hidden-youtube-audio') || document.getElementById('stenoshala-youtube-audio');
      if (iframe) {
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
        showToast('YouTube Audio restarted.');
      }
    }

export function closeUniversalMediaModal() {
      if (universalAudioTimeSyncInterval) {
        clearInterval(universalAudioTimeSyncInterval);
        universalAudioTimeSyncInterval = null;
      }
      const audioElem = document.getElementById('universal-audio-player');
      if (audioElem) audioElem.pause();
      const modal = document.getElementById('universal-media-modal');
      const viewport = document.getElementById('universal-modal-viewport');
      if (viewport) viewport.innerHTML = '';
      if (modal) modal.style.display = 'none';
      exitImmersiveFullscreenLock('universal-media');
    }

export let customImageZoomLevel = 1;

export function openEmbeddedImageModal(imgUrl, title) {
      const modal = document.getElementById('embedded-image-modal');
      const imgElem = document.getElementById('embedded-modal-img');
      const titleElem = document.getElementById('embedded-image-title');
      
      if (titleElem) titleElem.innerText = title || 'Outline Viewer';
      if (imgElem) imgElem.src = getUniversalUrl(imgUrl, 'image');
      if (typeof window.toggleCompactViewerChrome === 'function') {
        window.toggleCompactViewerChrome('embedded-image', false);
      }
      
      customImageZoomLevel = 1;
      customImageRotationDeg = 0;
      updateImageTransform();
      initImageDragAndPan();

      if (modal) modal.style.display = 'flex';
      enterImmersiveFullscreenLock('image-modal');
      renderGlobalWatermark();
    }

export function closeEmbeddedImageModal() {
      const modal = document.getElementById('embedded-image-modal');
      if (modal) modal.style.display = 'none';
      if (typeof window.toggleCompactViewerChrome === 'function') {
        window.toggleCompactViewerChrome('embedded-image', false);
      }
      exitImmersiveFullscreenLock('image-modal');
    }

export let pdfZoomLevel = 1.0;

export let customPdfDoc = null;

export let customPdfPageNum = 1;

export let customPdfTotalPages = 1;

export let customPdfRendering = false;

export let customPdfRawEmbedUrl = '';

export async function buildInteractiveStudyPdfBytes(docTitle, sourceUrl) {
      if (typeof PDFLib === 'undefined' || !PDFLib.PDFDocument) return null;
      const pdfDoc = await PDFLib.PDFDocument.create();
      const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

      // Find any matching study notes or outlines from materialsData
      const relatedItems = (portalState.materialsData || []).filter(m =>
        String(m.Title || '').toLowerCase().includes(String(docTitle || '').toLowerCase().slice(0, 12))
      );

      const pageSections = [
        {
          heading: `${docTitle || 'Steno Exam Study Material'} — Page 1: Executive Overview & Shorthand Key Principles`,
          lines: [
            '1. Official Stenography & Transcription Reference Sheet (SSC Grade C & D / High Court / Parliamentary Reporter).',
            '2. Maintain uniform stroke length (1/6th inch standard) and clear distinction between light and heavy strokes.',
            '3. Vowel placement rules: 1st-place vowels above the line, 2nd-place on the line, 3rd-place through the line.',
            '4. Always practice grammalogues, contractions, and departmental phraseography before high-speed dictation (80–250 WPM).',
            '5. Punctuation accuracy: Full stops, paragraph breaks, and proper noun capitalization carry direct evaluation weight.',
            `6. Document Source Reference: ${sourceUrl || 'Protected Portal Repository'}`
          ]
        },
        {
          heading: `${docTitle || 'Steno Exam Study Material'} — Page 2: High-Frequency Phrases & Parliamentary Outlines`,
          lines: [
            '1. Parliamentary & Official Phrases: "Mr. Chairman, Sir", "Honourable Member", "Ministry of Home Affairs".',
            '2. Legal & Courtroom Phrases: "Learned Counsel", "Beyond Reasonable Doubt", "High Court of Judicature".',
            '3. Halving & Doubling Principles: Halving adds T or D; Doubling adds TR, DR, or THR in curved and straight strokes.',
            '4. Initial & Final Hooks: R-hook, L-hook, N-hook, F/V-hook, and SHUN-hook rapid joining exercises.',
            '5. Speed Building Drill: Practice each outline 10 times at 80 WPM, 120 WPM, 160 WPM, and 200+ WPM.'
          ]
        },
        {
          heading: `${docTitle || 'Steno Exam Study Material'} — Page 3: Self-Evaluation Checklist & Transcription Rules`,
          lines: [
            '1. Full Mistake (1.0 Deducted): Every omitted word, substituted word, or unauthorized addition.',
            '2. Half Mistake (0.5 Deducted): Spelling error, singular/plural mismatch, or improper capitalization.',
            '3. 5-Stroke Formula vs Actual Word Count: Verify which rule applies to your target examination.',
            '4. Revision Strategy: Dedicate the final 3–5 minutes of transcription strictly to proofreading.',
            ...(relatedItems.length > 0
              ? relatedItems.slice(0, 3).map((it, idx) => `${idx + 5}. Related Portal Resource: ${it.Title} (${it.Subtab || it.Type})`)
              : ['5. Use the Prev Page, Next Page, Zoom In, Zoom Out, and 100% buttons above to inspect every page clearly.'])
          ]
        }
      ];

      for (let i = 0; i < pageSections.length; i++) {
        const page = pdfDoc.addPage([612, 792]);
        const { width, height } = page.getSize();
        // Header banner
        page.drawRectangle({ x: 36, y: height - 92, width: width - 72, height: 52, color: PDFLib.rgb(0.12, 0.16, 0.36) });
        page.drawText('SHORTHAND & TYPING PORTAL — PROTECTED PDF READER', {
          x: 50, y: height - 62, size: 11, font: fontBold, color: PDFLib.rgb(1, 1, 1)
        });
        page.drawText(`Page ${i + 1} of ${pageSections.length}`, {
          x: width - 125, y: height - 62, size: 11, font: fontBold, color: PDFLib.rgb(0.75, 0.85, 1)
        });
        page.drawText(pageSections[i].heading.slice(0, 78), {
          x: 50, y: height - 80, size: 9.5, font: fontRegular, color: PDFLib.rgb(0.9, 0.94, 1)
        });

        let cursorY = height - 130;
        pageSections[i].lines.forEach((lineText) => {
          page.drawRectangle({ x: 42, y: cursorY - 12, width: width - 84, height: 42, color: PDFLib.rgb(0.96, 0.97, 0.99) });
          page.drawText(String(lineText).slice(0, 92), {
            x: 52, y: cursorY + 8, size: 10.5, font: fontBold, color: PDFLib.rgb(0.08, 0.12, 0.22)
          });
          if (String(lineText).length > 92) {
            page.drawText(String(lineText).slice(92, 184), {
              x: 52, y: cursorY - 6, size: 9.5, font: fontRegular, color: PDFLib.rgb(0.25, 0.32, 0.45)
            });
          }
          cursorY -= 58;
        });

        page.drawText('Use Prev Page / Next Page / Zoom In / Zoom Out / 100% in the top bar at any time.', {
          x: 46, y: 42, size: 9, font: fontRegular, color: PDFLib.rgb(0.4, 0.45, 0.55)
        });
      }

      return await pdfDoc.save();
    }

export async function openPdfModal(pdfUrl, title) {
      const modal = document.getElementById('reader-modal');
      const body = document.getElementById('modal-viewport');
      const titleEl = document.getElementById('modal-title');
      
      if (titleEl) titleEl.innerText = title || 'Protected PDF Document';
      pdfZoomLevel = 1.0;
      customPdfDoc = null;
      customPdfPageNum = 1;
      customPdfTotalPages = 1;

      let rawUrl = String(pdfUrl || '').trim();
      const isHttpUrl = /^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('/api/media-proxy');
      const isGoogleDrive = isGoogleDriveOrDocsUrl(rawUrl);
      const protectedProxyUrl = isHttpUrl ? buildProtectedMediaProxyUrl(rawUrl, 'pdf') : rawUrl;
      customPdfRawEmbedUrl = protectedProxyUrl;

      const inlineControls = document.getElementById('reader-modal-inline-controls');
      if (inlineControls) {
        inlineControls.innerHTML = `
          <button type="button" class="rp-viewer-ico-btn" id="pdf-prev-page-btn" onclick="changeCustomPdfPage(-1)" title="Previous Page" aria-label="Previous Page"><i class="fa-solid fa-chevron-left"></i></button>
          <span id="custom-pdf-page-indicator" class="mono-num" style="font-size: 11px; font-weight: 800; color: var(--secondary); padding: 2px 7px; background: var(--background); border: 1px solid var(--border); border-radius: 6px; white-space: nowrap;">1/1 · 100%</span>
          <button type="button" class="rp-viewer-ico-btn" id="pdf-next-page-btn" onclick="changeCustomPdfPage(1)" title="Next Page" aria-label="Next Page"><i class="fa-solid fa-chevron-right"></i></button>
          <button type="button" class="rp-viewer-ico-btn" onclick="adjustPdfZoom(-0.2)" title="Zoom Out" aria-label="Zoom Out"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
          <button type="button" class="rp-viewer-ico-btn" onclick="adjustPdfZoom(0.2)" title="Zoom In" aria-label="Zoom In"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
          <button type="button" class="rp-viewer-ico-btn" onclick="resetPdfZoom()" title="Reset Zoom (100%)" aria-label="Reset Zoom"><i class="fa-solid fa-compress"></i></button>
        `;
      }
      if (typeof window.toggleCompactViewerChrome === 'function') {
        window.toggleCompactViewerChrome('reader', false);
      }

      if (body) {
        body.style.overflow = 'hidden';
        body.style.overflowY = 'hidden';
        body.style.overscrollBehavior = 'contain';
        body.innerHTML = `
          <div class="watermark-text-container" style="position: relative; width: 100%; height: 100%; min-height: 0; background: #ffffff !important; color-scheme: light !important; display: flex; flex-direction: column; overflow: hidden; flex: 1;">
            <div class="global-watermark-layer" style="opacity: 0.12; z-index: 10; pointer-events: none;"></div>
            <!-- Pure White Full-Viewport Scrollable Canvas (Zero Google Drive Footprint) -->
            <div id="custom-pdf-scroll-container" oncontextmenu="return false;" style="width: 100%; flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y; background: #f1f5f9 !important; display: block; text-align: center; padding: 6px; position: relative; z-index: 5; -webkit-overflow-scrolling: touch;">
              <div id="custom-pdf-status-msg" style="display: inline-block; padding: 10px 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; color: #334155; font-weight: 700; font-size: 12.5px; margin: 12px auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <i class="fa-solid fa-spinner fa-spin" style="color: var(--primary); margin-right: 6px;"></i> Loading Protected PDF Document...
              </div>
              <div id="pdf-zoomable-wrapper" style="background: #ffffff; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.12); border: 1px solid #cbd5e1; border-radius: 4px; display: inline-block; margin: 0 auto; position: relative; vertical-align: top;">
                <canvas id="custom-pdf-canvas" style="display: block; background: #ffffff;"></canvas>
              </div>
              <div id="custom-pdf-fallback-frame" style="display: none; width: 100%; height: calc(100dvh - 52px); margin: 0 auto; background: #ffffff; border-radius: 4px; overflow: hidden; box-shadow: 0 4px 18px rgba(15,23,42,0.1); vertical-align: top;"></div>
            </div>
          </div>
        `;
      }

      if (modal) {
        modal.style.display = 'flex';
        modal.style.background = '#ffffff'; 
        modal.style.setProperty('background-color', '#ffffff', 'important');
        modal.style.setProperty('color-scheme', 'light', 'important');
      }
      enterImmersiveFullscreenLock('pdf-modal');
      renderGlobalWatermark();

      // Strictly same-origin protected fallback (NEVER uses drive.google.com/preview or docs.google.com/viewer)
      const buildFallbackEmbedHtml = (safeProxyUrl) => {
        if (!safeProxyUrl || (!safeProxyUrl.startsWith('/api/media-proxy') && !safeProxyUrl.startsWith('blob:'))) {
          return `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:28px; text-align:center; color:#334155; gap:10px;">
              <i class="fa-solid fa-shield-halved" style="font-size:28px; color:var(--primary);"></i>
              <strong>Protected PDF could not be streamed</strong>
              <span style="font-size:12.5px; color:#64748b; max-width:420px;">Verify that the source PDF link is publicly accessible to the portal server ("Anyone with the link"). Direct Google Drive pop-outs are disabled for security.</span>
            </div>
          `;
        }
        const fitUrl = safeProxyUrl.includes('#') ? safeProxyUrl : `${safeProxyUrl}#toolbar=0&navpanes=0&view=Fit`;
        return `
          <div style="position:relative; width:100%; height:100%; background:#ffffff;" oncontextmenu="return false;">
            <object data="${fitUrl}" type="application/pdf" style="width:100%; height:100%; border:none;">
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:28px; text-align:center; color:#334155; gap:8px;">
                <i class="fa-solid fa-file-shield" style="font-size:26px; color:var(--primary);"></i>
                <strong>Protected PDF Viewer</strong>
                <span style="font-size:12.5px; color:#64748b;">Please reload if the PDF canvas did not initialize.</span>
              </div>
            </object>
          </div>
        `;
      };

      try {
        if (typeof pdfjsLib !== 'undefined') {
          if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }
          let pdfSource = null;

          if (rawUrl.startsWith('data:application/pdf;base64,')) {
            const b64 = rawUrl.split(',')[1] || '';
            const binStr = atob(b64);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
            pdfSource = { data: bytes };
          } else if (isHttpUrl && protectedProxyUrl.startsWith('/api/media-proxy')) {
            // 1. Primary: fetch raw PDF bytes anonymously via our cookie-less server proxy (zero Drive footprint!)
            try {
              const pResp = await fetch(protectedProxyUrl, { credentials: 'same-origin' });
              if (pResp.ok) {
                const ab = await pResp.arrayBuffer();
                if (ab && ab.byteLength > 64) {
                  pdfSource = { data: new Uint8Array(ab) };
                }
              }
            } catch (_serverProxyErr) {}

            // 2. Secondary fallback for Google Drive: Apps Script server-side base64 proxy (still zero client Drive cookies)
            if (!pdfSource && isGoogleDrive) {
              try {
                const proxyRes = await apiCall('getDriveFileBase64', { fileUrl: rawUrl, url: rawUrl }, true);
                if (proxyRes && proxyRes.success && proxyRes.base64) {
                  const binStr = atob(proxyRes.base64);
                  const bytes = new Uint8Array(binStr.length);
                  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                  pdfSource = { data: bytes };
                }
              } catch (_gasErr) {}
            }
          } else {
            // Raw text / passage content (NOT an external HTTP URL): synthesize multi-page interactive PDF
            const synthBytes = await buildInteractiveStudyPdfBytes(title || 'Protected Study Material', rawUrl);
            if (synthBytes) {
              pdfSource = { data: synthBytes };
            }
          }

          if (!customPdfDoc && pdfSource) {
            const loadingTask = pdfjsLib.getDocument(pdfSource);
            customPdfDoc = await loadingTask.promise;
          }

          if (customPdfDoc) {
            customPdfTotalPages = customPdfDoc.numPages || 1;
            customPdfPageNum = 1;
            const statusMsg = document.getElementById('custom-pdf-status-msg');
            if (statusMsg) statusMsg.style.display = 'none';
            await renderCustomPdfPage(customPdfPageNum);
            return;
          }
        }
      } catch (err) {
        console.warn('PDF Canvas fallback activated:', err);
      }

      const statusMsg = document.getElementById('custom-pdf-status-msg');
      const canvasWrap = document.getElementById('pdf-zoomable-wrapper');
      const fallbackEl = document.getElementById('custom-pdf-fallback-frame');
      if (statusMsg) statusMsg.style.display = 'none';
      if (canvasWrap) canvasWrap.style.display = 'none';
      if (fallbackEl) {
        fallbackEl.style.display = 'inline-block';
        fallbackEl.innerHTML = buildFallbackEmbedHtml(protectedProxyUrl);
        applyFallbackPdfZoomLayout();
      }
      customPdfTotalPages = 1;
      customPdfPageNum = 1;
      updateCustomPdfIndicatorOnly();
    }

export function updateCustomPdfIndicatorOnly() {
      const indicator = document.getElementById('custom-pdf-page-indicator');
      if (indicator) {
        indicator.innerText = `${customPdfPageNum}/${customPdfTotalPages} · ${Math.round(pdfZoomLevel * 100)}%`;
      }
      const prevBtn = document.getElementById('pdf-prev-page-btn');
      const nextBtn = document.getElementById('pdf-next-page-btn');
      if (prevBtn) prevBtn.disabled = customPdfPageNum <= 1;
      if (nextBtn) nextBtn.disabled = customPdfPageNum >= customPdfTotalPages;
    }

let _customPdfPendingPage = null;
let _customPdfResizeTimer = null;

if (typeof window !== 'undefined' && !window.__rpPdfResizeBound) {
      window.__rpPdfResizeBound = true;
      window.addEventListener('resize', () => {
        const modal = document.getElementById('reader-modal');
        if (!modal || modal.style.display === 'none') return;
        const pdfWrap = document.getElementById('custom-pdf-scroll-container');
        if (!pdfWrap) return;
        clearTimeout(_customPdfResizeTimer);
        _customPdfResizeTimer = setTimeout(() => {
          if (customPdfDoc) {
            renderCustomPdfPage(customPdfPageNum);
          } else {
            applyFallbackPdfZoomLayout();
          }
        }, 140);
      });
    }

function applyFallbackPdfZoomLayout() {
      const fallbackEl = document.getElementById('custom-pdf-fallback-frame');
      if (!fallbackEl || fallbackEl.style.display === 'none') return;
      const scrollContainer = document.getElementById('custom-pdf-scroll-container');
      const topBar = document.getElementById('reader-modal-top-bar');
      const topBarH = (topBar && topBar.style.display !== 'none') ? topBar.offsetHeight : 0;
      const containerW = (scrollContainer && scrollContainer.clientWidth > 120) ? scrollContainer.clientWidth : (window.innerWidth || 360);
      const containerH = (scrollContainer && scrollContainer.clientHeight > 120) ? scrollContainer.clientHeight : ((window.innerHeight || 640) - topBarH);
      const baseWidth = Math.max(240, containerW - 14);
      const baseHeight = Math.max(260, containerH - 14);
      const zoomedWidth = Math.round(baseWidth * pdfZoomLevel);
      const zoomedHeight = Math.round(baseHeight * pdfZoomLevel);

      fallbackEl.style.maxWidth = 'none';
      fallbackEl.style.transform = 'none';
      fallbackEl.style.width = `${zoomedWidth}px`;
      fallbackEl.style.height = `${zoomedHeight}px`;

      const innerBox = fallbackEl.firstElementChild;
      if (innerBox) {
        innerBox.style.width = `${zoomedWidth}px`;
        innerBox.style.height = `${zoomedHeight}px`;
      }
    }

export async function renderCustomPdfPage(pageNum) {
      if (!customPdfDoc) {
        applyFallbackPdfZoomLayout();
        updateCustomPdfIndicatorOnly();
        return;
      }
      if (customPdfRendering) {
        _customPdfPendingPage = pageNum;
        return;
      }
      customPdfRendering = true;
      _customPdfPendingPage = null;
      try {
        const page = await customPdfDoc.getPage(pageNum);
        let scrollContainer = document.getElementById('custom-pdf-scroll-container');
        if (scrollContainer && (scrollContainer.clientWidth < 120 || scrollContainer.clientHeight < 120)) {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          scrollContainer = document.getElementById('custom-pdf-scroll-container');
        }
        const topBar = document.getElementById('reader-modal-top-bar');
        const topBarH = (topBar && topBar.style.display !== 'none') ? topBar.offsetHeight : 42;
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const containerAvailW = Math.max(240, ((scrollContainer && scrollContainer.clientWidth > 120) ? scrollContainer.clientWidth : (window.innerWidth || 360)) - 16);
        const containerAvailH = Math.max(260, ((scrollContainer && scrollContainer.clientHeight > 120) ? scrollContainer.clientHeight : ((window.innerHeight || 640) - topBarH)) - 16);
        const fitWidthScale = containerAvailW / Math.max(1, unscaledViewport.width);
        const fitHeightScale = containerAvailH / Math.max(1, unscaledViewport.height);
        // True Fit-to-Screen: fits full page width & height inside the screen on open across mobile, tablet & desktop
        const fitScale = Math.min(fitWidthScale, fitHeightScale);
        const effectiveScale = Math.max(0.25, Math.min(4.5, fitScale * pdfZoomLevel));
        const viewport = page.getViewport({ scale: effectiveScale });

        const canvas = document.getElementById('custom-pdf-canvas');
        if (!canvas) {
          customPdfRendering = false;
          return;
        }
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const ctx = canvas.getContext('2d');
        canvas.width = Math.round(viewport.width * dpr);
        canvas.height = Math.round(viewport.height * dpr);
        canvas.style.width = `${Math.round(viewport.width)}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        ctx.save();
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.fillStyle = 'rgba(79, 70, 229, 0.10)';
        ctx.translate(viewport.width / 2, viewport.height / 2);
        ctx.rotate(-Math.PI / 6);
        ctx.textAlign = 'center';
        ctx.fillText(getWatermarkText(), 0, 0);
        ctx.restore();

        updateCustomPdfIndicatorOnly();
      } finally {
        customPdfRendering = false;
        if (_customPdfPendingPage !== null) {
          const nextPage = _customPdfPendingPage;
          _customPdfPendingPage = null;
          renderCustomPdfPage(nextPage);
        }
      }
    }

export function changeCustomPdfPage(delta) {
      const total = customPdfDoc ? (customPdfDoc.numPages || 1) : (customPdfTotalPages || 1);
      customPdfTotalPages = total;
      const next = customPdfPageNum + delta;
      if (next < 1 || next > total) {
        updateCustomPdfIndicatorOnly();
        return;
      }
      customPdfPageNum = next;
      if (customPdfDoc) {
        renderCustomPdfPage(customPdfPageNum);
      } else {
        const iframe = document.getElementById('custom-pdf-embed-iframe');
        if (iframe && customPdfRawEmbedUrl) {
          iframe.src = `${customPdfRawEmbedUrl}#page=${customPdfPageNum}`;
        }
        updateCustomPdfIndicatorOnly();
      }
      const scrollContainer = document.getElementById('custom-pdf-scroll-container');
      if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }

export function adjustPdfZoom(amount) {
      pdfZoomLevel = Math.max(0.5, Math.min(3.0, +(pdfZoomLevel + amount).toFixed(2)));
      if (customPdfDoc) {
        renderCustomPdfPage(customPdfPageNum);
      } else {
        applyFallbackPdfZoomLayout();
      }
      updateCustomPdfIndicatorOnly();
    }

export function resetPdfZoom() {
      pdfZoomLevel = 1.0;
      if (customPdfDoc) {
        renderCustomPdfPage(customPdfPageNum);
      } else {
        applyFallbackPdfZoomLayout();
      }
      updateCustomPdfIndicatorOnly();
    }

export function stopAllPortalAudioAndMediaPlayback() {
      try {
        if (typeof activeFiveSecCountdownTimer !== 'undefined' && activeFiveSecCountdownTimer) {
          clearInterval(activeFiveSecCountdownTimer);
          activeFiveSecCountdownTimer = null;
        }
        if (typeof stopExamHallSynth === 'function') stopExamHallSynth();
        if (typeof stopTtsDictationSpeech === 'function') stopTtsDictationSpeech();
        if (typeof sendYouTubeAudioCommand === 'function') sendYouTubeAudioCommand('pauseVideo');
        if (typeof stopSynthMicRecording === 'function') stopSynthMicRecording(true);

        document.querySelectorAll('audio, video').forEach(mediaEl => {
          try {
            mediaEl.pause();
            mediaEl.currentTime = 0;
            mediaEl.removeAttribute('src');
            mediaEl.load();
          } catch (e) {}
        });

        ['stenoshala-youtube-audio'].forEach(ifrId => {
          const ifr = document.getElementById(ifrId);
          if (ifr) {
            try { ifr.src = 'about:blank'; } catch (e) {}
          }
        });

        const dynMount = document.getElementById('stenoshala-dynamic-media-mount');
        if (dynMount) {
          dynMount.querySelectorAll('iframe').forEach(ifr => {
            try { ifr.src = 'about:blank'; } catch (e) {}
          });
        }
      } catch (e) {}
    }

export function cancelStenoTest() {
      document.body.classList.remove('reading-time-fullscreen-lock');
      exitImmersiveFullscreenLock('active-test-modal');
      try {
        if (typeof portalState.testTimerInterval !== 'undefined' && portalState.testTimerInterval) {
          clearInterval(portalState.testTimerInterval);
          portalState.testTimerInterval = null;
        }
        if (window.activeTestTimer) {
          clearInterval(window.activeTestTimer);
          window.activeTestTimer = null;
        }
        portalState.isTypingTimerStarted = false;
        portalState.isTestPaused = false;

        stopAllPortalAudioAndMediaPlayback();
        if (typeof toggleMobileExamFocusMode === 'function') toggleMobileExamFocusMode(false);

        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }

        const mainBody = document.getElementById('test-main-body-container');
        if (mainBody) mainBody.innerHTML = '';

        const statusBar = document.getElementById('live-typing-status-bar');
        if (statusBar) statusBar.style.display = 'none';
        const transcribeModal = document.getElementById('transcribe-exam-select-modal');
        if (transcribeModal) transcribeModal.style.display = 'none';
        const testModal = document.getElementById('active-test-modal');
        if (testModal) testModal.style.display = 'none';
        const activeTestInterface = document.getElementById('active-test-interface');
        if (activeTestInterface) activeTestInterface.style.display = 'none';
        const completePassageBtn = document.getElementById('btn-toggle-complete-passage');
        if (completePassageBtn) completePassageBtn.style.display = 'none';
        window.isCountUpTimerMode = false;
        window.activeScheduledLiveTestEndTime = null;
        window.activeScheduledLiveTestObj = null;
        updateTestSubmitMinTimeLockUI(999999);
        showToast('Exited test & stopped all audio playback.');
        const returnTab = window.lastOriginTabBeforeTest || window.currentActiveViewName || portalState.activeTab || 'dashboard';
        navigateTo(returnTab, false, true);
      } catch (err) {
        console.error('cancelStenoTest error:', err);
        stopAllPortalAudioAndMediaPlayback();
        const testModal = document.getElementById('active-test-modal');
        if (testModal) testModal.style.display = 'none';
      }
    }

export function togglePauseStenoTest() {
      portalState.isTestPaused = !portalState.isTestPaused;
      const pauseBtn = document.getElementById('test-pause-btn');
      const audioElem = document.getElementById('active-bg-audio') || document.getElementById('stenoshala-dictation-audio');

      if (portalState.isTestPaused) {
        if (pauseBtn) pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume Test';
        if (audioElem) audioElem.pause();
        updateLiveTypingStatusBar('Paused');
        showToast('Test paused.');
      } else {
        if (pauseBtn) pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Test';
        if (audioElem) audioElem.play().catch(() => {});
        updateLiveTypingStatusBar('Typing Active');
        showToast('Test resumed.');
      }
    }

export function handleTestPaste(event) {
      const rules = window.currentExamRules || getEvaluationRulesForTab(portalState.activeTestSubtabKey) || {};
      const mode = String(rules.copyPasteMode || (rules.copyPasteRestricted === true ? 'no' : 'yes')).toLowerCase();
      if (mode === 'no' || mode === 'copy_only') {
        event.preventDefault();
        showToast(mode === 'copy_only' ? 'Paste is disabled (Copy-Only policy active for this exam).' : 'Copy & Paste is disabled for this exam.');
      }
    }

export function handleTestCopy(event) {
      const rules = window.currentExamRules || getEvaluationRulesForTab(portalState.activeTestSubtabKey) || {};
      const mode = String(rules.copyPasteMode || (rules.copyPasteRestricted === true ? 'no' : 'yes')).toLowerCase();
      if (mode === 'no' || mode === 'paste_only') {
        event.preventDefault();
        showToast(mode === 'paste_only' ? 'Copy is disabled (Paste-Only policy active for this exam).' : 'Copying text is disabled for this exam.');
      }
    }

export function handleTestCut(event) {
      const rules = window.currentExamRules || getEvaluationRulesForTab(portalState.activeTestSubtabKey) || {};
      const mode = String(rules.copyPasteMode || (rules.copyPasteRestricted === true ? 'no' : 'yes')).toLowerCase();
      if (mode === 'no' || mode === 'paste_only') {
        event.preventDefault();
        showToast(mode === 'paste_only' ? 'Cutting text is disabled (Paste-Only policy active for this exam).' : 'Cutting text is disabled for this exam.');
      }
    }

export function handleTestInput() {
      if (!portalState.isTypingTimerStarted) {
        portalState.isTypingTimerStarted = true;
        portalState.testStartTime = Date.now();
        startTestTimer(portalState.testDurationMinutes * 60);
      }
      handleTypingInputProgress();
    }

export function initImageDragAndPan() {
      const stage = document.getElementById('embedded-image-scroll-stage');
      if (!stage) return;
      let isPanning = false;
      let panStartX = 0, panStartY = 0, scrollLeftStart = 0, scrollTopStart = 0;

      stage.onmousedown = (e) => {
        if (customImageZoomLevel <= 1) return;
        isPanning = true;
        stage.style.cursor = 'grabbing';
        panStartX = e.pageX - stage.offsetLeft;
        panStartY = e.pageY - stage.offsetTop;
        scrollLeftStart = stage.scrollLeft;
        scrollTopStart = stage.scrollTop;
        e.preventDefault();
      };
      stage.onmouseleave = () => { isPanning = false; stage.style.cursor = 'grab'; };
      stage.onmouseup = () => { isPanning = false; stage.style.cursor = 'grab'; };
      stage.onmousemove = (e) => {
        if (!isPanning) return;
        e.preventDefault();
        const x = e.pageX - stage.offsetLeft;
        const y = e.pageY - stage.offsetTop;
        stage.scrollLeft = scrollLeftStart - (x - panStartX);
        stage.scrollTop = scrollTopStart - (y - panStartY);
      };
    }

export let customImageRotationDeg = 0;

export function updateImageTransform() {
      const wrapper = document.getElementById('zoomable-image-wrapper');
      const img = document.getElementById('embedded-modal-img');
      const topBar = document.getElementById('embedded-image-top-bar');
      const isBarHidden = Boolean(topBar && topBar.style.display === 'none');
      const pct = Math.round(customImageZoomLevel * 100);
      if (img) {
        if (customImageZoomLevel === 1) {
          img.style.width = 'auto';
          img.style.maxWidth = '98%';
          img.style.maxHeight = isBarHidden ? 'calc(100dvh - 14px)' : 'calc(100dvh - 54px)';
        } else {
          img.style.width = `${pct}%`;
          img.style.maxWidth = 'none';
          img.style.maxHeight = 'none';
        }
        img.style.transform = `rotate(${customImageRotationDeg}deg)`;
      }
      if (wrapper) {
        wrapper.style.width = customImageZoomLevel > 1 ? `${pct}%` : '100%';
      }
      const badge = document.getElementById('embedded-image-zoom-badge');
      if (badge) {
        badge.innerText = `${pct}%`;
      }
    }

export function adjustCustomImageZoom(amount) {
      customImageZoomLevel = Math.max(0.5, Math.min(4, +(customImageZoomLevel + amount).toFixed(2)));
      updateImageTransform();
    }

export function rotateCustomImage(deg) {
      customImageRotationDeg = (customImageRotationDeg + deg) % 360;
      updateImageTransform();
    }

export function resetCustomImageZoom() {
      customImageZoomLevel = 1;
      customImageRotationDeg = 0;
      updateImageTransform();
    }

portalState.currentEvalRulesPage = 1;

export const EVAL_RULES_PER_PAGE = 30;

export function renderAdminEvaluationRulesTable() {
      const container = document.getElementById('admin-eval-rules-table-container');
      const pageIndicator = document.getElementById('admin-eval-rules-page-indicator');
      const searchInput = document.getElementById('admin-search-eval-rules');
      const categoryFilterSelect = document.getElementById('admin-filter-eval-category');
      
      if (!container) return;

      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
      if (search && categoryFilterSelect) {
        categoryFilterSelect.value = 'ALL';
      }

      const categoryFilter = categoryFilterSelect ? categoryFilterSelect.value : 'ALL';
      let keys = Object.keys(portalState.allEvaluationRules || {});

      if (search) {
        keys = keys.filter(key => {
          const rule = portalState.allEvaluationRules[key];
          const ruleStr = JSON.stringify(rule).toLowerCase();
          return key.toLowerCase().includes(search) || ruleStr.includes(search);
        });
      }

      if (categoryFilter !== 'ALL') {
        keys = keys.filter(key => key.toLowerCase().startsWith(categoryFilter.toLowerCase()));
      }

      if (keys.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color: #dc2626; font-weight: 800;"><i class="fa-solid fa-triangle-exclamation"></i> No evaluation rule is there</div>`;
        if (pageIndicator) pageIndicator.innerText = `Page 1 of 1 (0 entries)`;
        return;
      }

      const totalPages = Math.ceil(keys.length / EVAL_RULES_PER_PAGE) || 1;
      if (portalState.currentEvalRulesPage > totalPages) portalState.currentEvalRulesPage = totalPages;
      if (portalState.currentEvalRulesPage < 1) portalState.currentEvalRulesPage = 1;

      const startIndex = (portalState.currentEvalRulesPage - 1) * EVAL_RULES_PER_PAGE;
      const paginatedKeys = keys.slice(startIndex, startIndex + EVAL_RULES_PER_PAGE);

      if (pageIndicator) {
        pageIndicator.innerText = `Page ${portalState.currentEvalRulesPage} of ${totalPages} (${keys.length} total rules)`;
      }

      let html = `<table border="1" borderColor="var(--border)" cellpadding="8" style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="background:var(--border);">
          <th>Exam / Rule Key</th>
          <th>Word Count / CBT Marking</th>
          <th>Min Submit Time / Initial Passage / CBT Timer</th>
          <th>Total Marks / Passing (%)</th>
          <th>Verb Ded. / Merged Sections</th>
          <th>Backspace / Mode</th>
          <th>Actions</th>
        </tr>`;

      paginatedKeys.forEach(key => {
        const rule = portalState.allEvaluationRules[key] || {};
        const isCbtRule = (rule.tabType === 'cbttest') || String(key).toLowerCase().startsWith('cbttest');
        const bsDisplay = isCbtRule
          ? (rule.cbtTimerMode === 'sectional' ? 'SECTIONAL TIMER' : 'FULL TIMER')
          : (rule.backspaceMode === 'limited'
              ? `LIMITED (${rule.backspaceLimit || 20})`
              : (rule.backspaceMode === 'until_space' ? 'UNTIL SPACEBAR' : (rule.backspaceMode || 'on').toUpperCase()));
        const wordRuleDisplay = isCbtRule
          ? `<span style="color:#16a34a;font-weight:800;">+${rule.cbtCorrectMarks ?? 1}</span> / <span style="color:#dc2626;font-weight:800;">-${rule.cbtWrongMarks ?? 0.25}</span>`
          : (rule.wordCountRule === '5stroke' ? '5 Strokes = 1 Word' : '1 Space = 1 Word');
        const minTimeSec = parseInt(rule.minTimeSeconds ?? rule.minSubmitTimeSec) || 0;
        const effInitMode = rule.initialWordsMode || rule.minInitialWordsMode || 'all';
        const effInitWords = parseInt(rule.initialWords ?? rule.minInitialWords) || 0;
        const initUnit = rule.wordCountRule === '5stroke' ? 'Strokes' : 'Words';
        const initWordsLabel = isCbtRule
          ? `${rule.timeLimit || 20}m (${rule.cbtTimerMode === 'sectional' ? `Sec: ${rule.cbtDefaultSectionTime || 20}m` : 'Full Exam'})`
          : ((effInitMode === 'all' || effInitMode === 'complete' || effInitWords <= 0)
              ? 'Complete Passage'
              : `${effInitWords} ${initUnit}`);
        const unifiedPass = rule.passingAccuracy !== undefined ? rule.passingAccuracy : (rule.passingMarks !== undefined ? rule.passingMarks : 85);
        const verbDed = isCbtRule
          ? (Array.isArray(rule.cbtSectionGroups) && rule.cbtSectionGroups.length > 0 ? `${rule.cbtSectionGroups.length} Sec Group(s)` : 'Standard Sections')
          : `-${rule.deductVerbForm !== undefined ? rule.deductVerbForm : (rule.deductVerb !== undefined ? rule.deductVerb : 0.5)}`;

        html += `<tr>
          <td><strong>${key || '-'}</strong>${rule.examDisplayName ? `<div style="font-size:10.5px;color:var(--text-muted);">${rule.examDisplayName}</div>` : ''}</td>
          <td>${wordRuleDisplay}</td>
          <td>${minTimeSec}s / ${initWordsLabel}</td>
          <td>${rule.totalMarks || 100} / <strong>${unifiedPass}%</strong> (Pass: ${rule.passingMarks ?? unifiedPass})</td>
          <td>${verbDed}</td>
          <td><span class="role-badge" style="background:${isCbtRule ? '#0284c7' : (rule.backspaceMode === 'off' ? 'var(--danger)' : (rule.backspaceMode === 'limited' || rule.backspaceMode === 'until_space' ? '#f59e0b' : 'var(--success)'))}">${bsDisplay}</span></td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="loadSpecificSavedRule('${key}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteEvaluationRuleByKey('${key}')">Delete</button>
          </td>
        </tr>`;
      });

      html += `</table>`;
      container.innerHTML = html;
    }

export function paginateEvalRules(direction) {
      const searchInput = document.getElementById('admin-search-eval-rules');
      const categoryFilterSelect = document.getElementById('admin-filter-eval-category');
      
      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const categoryFilter = categoryFilterSelect ? categoryFilterSelect.value : 'ALL';
      let keys = Object.keys(portalState.allEvaluationRules || {});

      if (search) {
        keys = keys.filter(key => {
          const rule = portalState.allEvaluationRules[key];
          const ruleStr = JSON.stringify(rule).toLowerCase();
          return key.toLowerCase().includes(search) || ruleStr.includes(search);
        });
      }
      if (categoryFilter !== 'ALL') {
        keys = keys.filter(key => key.toLowerCase().startsWith(categoryFilter.toLowerCase()));
      }

      const totalPages = Math.ceil(keys.length / EVAL_RULES_PER_PAGE) || 1;

      if (direction === 1 && portalState.currentEvalRulesPage < totalPages) {
        portalState.currentEvalRulesPage++;
      } else if (direction === -1 && portalState.currentEvalRulesPage > 1) {
        portalState.currentEvalRulesPage--;
      }
      renderAdminEvaluationRulesTable();
    }

export async function deleteEvaluationRuleByKey(key, skipConfirm = false) {
      if (!skipConfirm && typeof window.rpConfirmDelete === 'function') {
        window.rpConfirmDelete('Delete Evaluation Rule?', `Permanently delete evaluation rule "${key}" from Google Sheets?`, () => deleteEvaluationRuleByKey(key, true));
        return;
      }
      delete portalState.allEvaluationRules[key];
      localStorage.setItem('steno_all_eval_rules', JSON.stringify(portalState.allEvaluationRules));
      
      if (typeof populateSavedRulesQuickDropdown === 'function') populateSavedRulesQuickDropdown();
      if (typeof renderAdminEvaluationRulesTable === 'function') renderAdminEvaluationRulesTable();

      const res = await apiCall('saveEvaluationRules', { ruleKey: key, ruleJson: '' });
      loadSelectedEvaluationRulesIntoForm();
      showToast(res.success ? 'Evaluation rule deleted and synced successfully.' : 'Evaluation rule deleted locally.');
    }

export function autoCalculateAudioWordsAndStrokes() {
      const text = document.getElementById('adm-upload-audio-passage').value || '';
      const statsElem = document.getElementById('adm-audio-auto-stats');
      if (!statsElem) return;

      const words = text.split(/\s+/).filter(Boolean).length;
      const strokes = text.length;
      statsElem.innerText = `Auto Count - Words: ${words} | Strokes (Characters): ${strokes} | 5-Stroke Words: ${Math.round(strokes / 5)}`;
    }

export function activateAllSubtabs(type) {
      const inputIdMap = {
        pdf: 'pdf-search-input',
        audio: 'audio-search-input',
        pitman: 'pitman-search-input',
        videocourse: 'videocourse-search-input',
        word: 'words-search'
      };
      const searchEl = document.getElementById(inputIdMap[type] || '');
      const hasQuery = Boolean(searchEl && String(searchEl.value || '').trim().length > 0);

      if (type === 'pdf' || type === 'audio') {
        if (hasQuery) {
          portalState.currentSubtabFilter[type] = 'ALL';
          const container = document.getElementById(`${type}-subtabs`);
          if (container) {
            container.querySelectorAll('.subtab-btn').forEach((btn, idx) => {
              if (idx === 0) btn.classList.add('active');
              else btn.classList.remove('active');
            });
          }
        }
        renderMaterialsList(type, portalState.currentSubtabFilter[type] || 'ALL');
      } else if (type === 'pitman') {
        if (hasQuery) {
          portalState.currentSubtabFilter.pitman = 'ALL';
          const container = document.getElementById('pitman-subtabs');
          if (container) {
            container.querySelectorAll('.subtab-btn').forEach((btn, idx) => {
              if (idx === 0) btn.classList.add('active');
              else btn.classList.remove('active');
            });
          }
        }
        renderPitmanList(portalState.currentSubtabFilter.pitman || 'ALL');
      } else if (type === 'videocourse') {
        if (hasQuery) {
          portalState.currentSubtabFilter.videocourse = 'ALL';
          const container = document.getElementById('videocourse-subtabs');
          if (container) {
            container.querySelectorAll('.subtab-btn').forEach((btn, idx) => {
              if (idx === 0) btn.classList.add('active');
              else btn.classList.remove('active');
            });
          }
        }
        renderVideoCourseList(portalState.currentSubtabFilter.videocourse || 'ALL');
      } else if (type === 'word') {
        if (hasQuery) {
          portalState.selectedCategoryFilter = 'ALL';
          portalState.selectedAlphabet = 'ALL';
          const catSelect = document.getElementById('words-category-filter');
          if (catSelect) catSelect.value = 'ALL';
          const alphabetBar = document.getElementById('alphabet-bar');
          if (alphabetBar) {
            alphabetBar.querySelectorAll('.alpha-btn').forEach((btn, idx) => {
              if (idx === 0) btn.classList.add('active');
              else btn.classList.remove('active');
            });
          }
        }
        renderWords();
      }
    }

portalState.examHallAudioCtx = null;

export let examHallIntervalId = null;

export let examHallNoiseNode = null;

export let examHallRoomGainNode = null;

portalState.isExamHallSoundActive = false;

window.examHallNoiseProfile = 'full_mix';

window.examHallNoiseVolumePct = 45;

export function playExamHallPaperRustleOrCough(ctx, volScale = 1.0) {
      if (!portalState.isExamHallSoundActive || !ctx || ctx.state !== 'running') return;
      try {
        const now = ctx.currentTime;
        const isCough = Math.random() > 0.55;
        const duration = isCough ? 0.16 : 0.24;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const env = Math.sin((i / bufferSize) * Math.PI);
          data[i] = (Math.random() * 2 - 1) * env;
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = isCough ? (380 + Math.random() * 220) : (2200 + Math.random() * 1200);
        filter.Q.value = isCough ? 3.5 : 1.4;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.045 * volScale, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
      } catch (e) {}
    }

export function triggerExamHallKeyClick(ctx = portalState.examHallAudioCtx, volumeScale = 1.0) {
      if (!portalState.isExamHallSoundActive) return;
      const audioCtx = ctx || portalState.examHallAudioCtx;
      if (!audioCtx || audioCtx.state !== 'running') return;
      const userVol = Math.max(0.05, Math.min(2.0, (window.examHallNoiseVolumePct || 45) / 50));
      try {
        const now = audioCtx.currentTime;
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.028);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const env = Math.exp(-i / (bufferSize * 0.25));
          data[i] = (Math.random() * 2 - 1) * env;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1100 + Math.random() * 1400;
        filter.Q.value = 2.2;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime((0.08 + Math.random() * 0.12) * volumeScale * userVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start(now);
      } catch (e) {}
    }

export function startExamHallSynth() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return false;
        if (!portalState.examHallAudioCtx) {
          portalState.examHallAudioCtx = new AudioContextClass();
        }
        if (portalState.examHallAudioCtx.state === 'suspended') {
          portalState.examHallAudioCtx.resume();
        }

        stopExamHallSynth();
        portalState.isExamHallSoundActive = true;

        const profileSel = document.getElementById('audio-exam-hall-noise-profile');
        if (profileSel && profileSel.value) window.examHallNoiseProfile = profileSel.value;
        const volSlider = document.getElementById('audio-exam-hall-noise-volume');
        if (volSlider && volSlider.value) window.examHallNoiseVolumePct = parseInt(volSlider.value, 10) || 45;

        const userVol = Math.max(0.05, Math.min(2.0, (window.examHallNoiseVolumePct || 45) / 50));
        const profile = window.examHallNoiseProfile || 'full_mix';

        if (profile !== 'keys_only') {
          const bufferSize = portalState.examHallAudioCtx.sampleRate * 2;
          const noiseBuffer = portalState.examHallAudioCtx.createBuffer(1, bufferSize, portalState.examHallAudioCtx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * (profile === 'fan_hum' ? 0.024 : 0.014);
          }
          examHallNoiseNode = portalState.examHallAudioCtx.createBufferSource();
          examHallNoiseNode.buffer = noiseBuffer;
          examHallNoiseNode.loop = true;

          const roomFilter = portalState.examHallAudioCtx.createBiquadFilter();
          roomFilter.type = 'lowpass';
          roomFilter.frequency.value = profile === 'fan_hum' ? 240 : 320;

          examHallRoomGainNode = portalState.examHallAudioCtx.createGain();
          examHallRoomGainNode.gain.value = userVol;

          examHallNoiseNode.connect(roomFilter);
          roomFilter.connect(examHallRoomGainNode);
          examHallRoomGainNode.connect(portalState.examHallAudioCtx.destination);
          examHallNoiseNode.start();
        }

        examHallIntervalId = setInterval(() => {
          if (!portalState.isExamHallSoundActive || !portalState.examHallAudioCtx) return;
          const activeProf = window.examHallNoiseProfile || 'full_mix';
          const vScale = Math.max(0.05, Math.min(2.0, (window.examHallNoiseVolumePct || 45) / 50));
          if (activeProf === 'full_mix' || activeProf === 'keys_only') {
            const burstCount = 1 + Math.floor(Math.random() * 3);
            for (let b = 0; b < burstCount; b++) {
              setTimeout(() => {
                if (portalState.isExamHallSoundActive) triggerExamHallKeyClick(portalState.examHallAudioCtx, 0.9);
              }, Math.random() * 85);
            }
          }
          if ((activeProf === 'full_mix' || activeProf === 'cough_rustle') && Math.random() < 0.08) {
            playExamHallPaperRustleOrCough(portalState.examHallAudioCtx, vScale);
          }
        }, 95);

        const masterChk = document.getElementById('audio-exam-hall-noise-Master-chk');
        if (masterChk) masterChk.checked = true;
        return true;
      } catch (err) {
        console.error('Exam hall sound synth error:', err);
        return false;
      }
    }

export function stopExamHallSynth() {
      portalState.isExamHallSoundActive = false;
      if (examHallIntervalId) {
        clearInterval(examHallIntervalId);
        examHallIntervalId = null;
      }
      if (examHallNoiseNode) {
        try { examHallNoiseNode.stop(); } catch (e) {}
        examHallNoiseNode = null;
      }
      examHallRoomGainNode = null;
      const examAudio = document.getElementById('exam-hall-audio');
      if (examAudio) {
        examAudio.pause();
        examAudio.currentTime = 0;
      }
      const masterChk = document.getElementById('audio-exam-hall-noise-Master-chk');
      if (masterChk) masterChk.checked = false;
    }

export function toggleAudioExamHallNoiseMaster(checked) {
      if (checked) {
        const ok = startExamHallSynth();
        if (ok) showToast('🔊 Exam Hall Background Noise Simulator activated!');
      } else {
        stopExamHallSynth();
        showToast('🔇 Exam Hall Background Noise Simulator turned off.');
      }
    }

export function changeExamHallNoiseProfile(profileVal) {
      window.examHallNoiseProfile = profileVal || 'full_mix';
      document.querySelectorAll('.exam-hall-profile-select').forEach(sel => {
        if (sel && sel.value !== window.examHallNoiseProfile) sel.value = window.examHallNoiseProfile;
      });
      if (portalState.isExamHallSoundActive) {
        startExamHallSynth();
        showToast(`🎧 Exam Hall Noise profile switched to: ${window.examHallNoiseProfile}`);
      }
    }

export function changeExamHallNoiseVolume(val) {
      const num = parseFloat(val);
      let pct = 45;
      if (!isNaN(num)) {
        // Support both float multipliers (0.4 / 0.8 / 1.35) and integer percentages (5..100)
        pct = num <= 2.5 ? Math.round(Math.max(10, Math.min(100, num * 75))) : Math.round(Math.max(5, Math.min(100, num)));
        window.examHallNoiseVolume = num <= 2.5 ? num : +(pct / 75).toFixed(2);
      }
      window.examHallNoiseVolumePct = pct;
      const label = document.getElementById('audio-exam-hall-noise-vol-label');
      if (label) label.innerText = `${pct}%`;
      if (examHallRoomGainNode) {
        examHallRoomGainNode.gain.value = Math.max(0.05, Math.min(2.0, pct / 50));
      }
    }

export let activeFiveSecCountdownTimer = null;

export function playCountdownToneBeep(freq = 880, durationSec = 0.14, isFinalGoBeep = false) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!portalState.examHallAudioCtx) portalState.examHallAudioCtx = new AudioContextClass();
        if (portalState.examHallAudioCtx.state === 'suspended') portalState.examHallAudioCtx.resume();
        const now = portalState.examHallAudioCtx.currentTime;
        const osc = portalState.examHallAudioCtx.createOscillator();
        const gain = portalState.examHallAudioCtx.createGain();
        osc.type = isFinalGoBeep ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(isFinalGoBeep ? 0.26 : 0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
        osc.connect(gain);
        gain.connect(portalState.examHallAudioCtx.destination);
        osc.start(now);
        osc.stop(now + durationSec);
      } catch (e) {}
    }

export function runFiveSecondBeepCountdown(onCompleteCallback) {
      if (activeFiveSecCountdownTimer) {
        clearInterval(activeFiveSecCountdownTimer);
        activeFiveSecCountdownTimer = null;
      }
      let remaining = 5;
      const bannerOverlay = document.getElementById('audio-5sec-countdown-banner-overlay');
      const modalBanner = document.getElementById('modal-5sec-countdown-live-banner');
      if (bannerOverlay) bannerOverlay.style.display = 'block';
      if (modalBanner) modalBanner.style.display = 'flex';

      const updateCountdownText = (sec) => {
        const numEl = document.getElementById('audio-5sec-countdown-number');
        const txtEl = document.getElementById('audio-5sec-countdown-text');
        if (numEl) numEl.innerText = sec > 0 ? String(sec) : 'GO!';
        if (txtEl) {
          txtEl.innerText = sec > 0
            ? `Get Ready — Dictation starts in ${sec}... (Keep pencil on shorthand pad)`
            : `🔔 BEEP! Dictation Started Now!`;
        }
        if (modalBanner) {
          modalBanner.innerHTML = sec > 0
            ? `<i class="fa-solid fa-bell"></i> <span>Get Ready — Dictation starts in <strong>${sec}</strong>...</span>`
            : `<i class="fa-solid fa-volume-high"></i> <span>🔔 BEEP! Dictation Audio Playing Now!</span>`;
        }
      };

      updateCountdownText(remaining);
      playCountdownToneBeep(880, 0.14, false);

      activeFiveSecCountdownTimer = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          updateCountdownText(remaining);
          playCountdownToneBeep(880, 0.14, false);
        } else {
          clearInterval(activeFiveSecCountdownTimer);
          activeFiveSecCountdownTimer = null;
          updateCountdownText(0);
          playCountdownToneBeep(1320, 0.42, true);
          setTimeout(() => {
            if (bannerOverlay) bannerOverlay.style.display = 'none';
            if (modalBanner) modalBanner.style.display = 'none';
          }, 1200);
          if (typeof onCompleteCallback === 'function') {
            onCompleteCallback();
          }
        }
      }, 1000);
    }

export function triggerFiveSecondBeepCountdownPreview(restartActiveDictation = false) {
      const dictAudio = document.getElementById('stenoshala-dictation-audio');
      if (restartActiveDictation && dictAudio) {
        dictAudio.pause();
        dictAudio.currentTime = 0;
      }
      runFiveSecondBeepCountdown(() => {
        if (restartActiveDictation) {
          const a = document.getElementById('stenoshala-dictation-audio');
          if (a) {
            a.currentTime = 0;
            a.play().catch(() => {});
          } else {
            sendYouTubeAudioCommand('seekTo', [0, true]);
            sendYouTubeAudioCommand('playVideo');
          }
        } else {
          showToast('🔔 5-Second Exam Beep Countdown Complete!');
        }
      });
    }

document.addEventListener("change", function (event) {
      if (event.target && (event.target.id === "exam-hall-sound-toggle" || event.target.classList.contains("exam-hall-sound-chk"))) {
        if (event.target.checked) {
          const started = startExamHallSynth();
          if (started) {
            showToast('🔊 Exam Hall Ambient Typing Sound enabled!');
          } else {
            showToast('⚠️ Could not start Exam Hall sound.');
            event.target.checked = false;
          }
        } else {
          stopExamHallSynth();
          showToast('🔇 Exam Hall Ambient Sound disabled.');
        }
      }
    });

portalState.pendingAudioDictationItem = null;

export let activePreAudioBeepTimeout = null;

export function cancelPreAudioStartAutoBeep() {
      if (activePreAudioBeepTimeout) {
        clearTimeout(activePreAudioBeepTimeout);
        activePreAudioBeepTimeout = null;
      }
      if (activeFiveSecCountdownTimer) {
        clearInterval(activeFiveSecCountdownTimer);
        activeFiveSecCountdownTimer = null;
      }
      const bannerOverlay = document.getElementById('audio-5sec-countdown-banner-overlay');
      const modalBanner = document.getElementById('modal-5sec-countdown-live-banner');
      if (bannerOverlay) bannerOverlay.style.display = 'none';
      if (modalBanner) modalBanner.style.display = 'none';
      const dictAudio = document.getElementById('stenoshala-dictation-audio');
      if (dictAudio && dictAudio.dataset) {
        delete dictAudio.dataset.autoBeepInProgress;
      }
    }

export function playPreAudioStartAutoBeep(onAfterBeep) {
      cancelPreAudioStartAutoBeep();
      const statusBadge = document.getElementById('stenoshala-audio-verify-status');
      if (statusBadge) {
        statusBadge.style.color = '#d97706';
        statusBadge.innerHTML = `<i class="fa-solid fa-bell"></i> 5-Second Beep Countdown... Get ready!`;
      }
      runFiveSecondBeepCountdown(() => {
        if (typeof onAfterBeep === 'function') onAfterBeep();
      });
    }

export function playOrVerifyStenoshalaDictationAudio(action = 'play', options = {}) {
      const statusBadge = document.getElementById('stenoshala-audio-verify-status');
      const dictAudio = document.getElementById('stenoshala-dictation-audio');
      const ytIframe = document.getElementById('stenoshala-youtube-audio');

      if (action === 'pause') {
        cancelPreAudioStartAutoBeep();
        if (dictAudio) dictAudio.pause();
        if (ytIframe) sendYouTubeAudioCommand('pauseVideo');
        if ('speechSynthesis' in window && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
        }
        if (statusBadge) {
          statusBadge.style.color = '#d97706';
          statusBadge.innerHTML = `<i class="fa-solid fa-pause"></i> Audio Paused`;
        }
        return;
      }

      // Auto-beep before starting audio on play / replay (unless already beeped)
      const skipAutoBeep = Boolean(options && options.skipAutoBeep);
      const isAlreadyPlaying = Boolean(
        (dictAudio && !dictAudio.paused && !dictAudio.ended && action === 'play') ||
        ('speechSynthesis' in window && window.speechSynthesis.speaking && !window.speechSynthesis.paused && action === 'play')
      );
      if (!skipAutoBeep && !isAlreadyPlaying && (action === 'play' || action === 'replay')) {
        playPreAudioStartAutoBeep(() => {
          playOrVerifyStenoshalaDictationAudio(action, { skipAutoBeep: true });
        });
        return;
      }

      if (action === 'replay') {
        if (ytIframe) {
          const vidId = ytIframe.getAttribute('data-yt-id') || '';
          if (vidId) {
            restartYouTubeAudio(vidId);
            sendYouTubeAudioCommand('setPlaybackQuality', ['tiny']);
          }
          if (statusBadge) {
            statusBadge.style.color = '#16a34a';
            statusBadge.innerHTML = `<i class="fa-solid fa-bolt"></i> Low-Bitrate Audio Stream Replaying (${currentDictationWpm || 80} WPM)`;
          }
          return;
        }
        if (dictAudio && (dictAudio.getAttribute('src') || dictAudio.querySelector('source')) && !dictAudio.dataset.useTtsFallback) {
          const clipStart = Number(dictAudio.dataset.clipStartSec || 0) || 0;
          dictAudio.currentTime = clipStart;
          dictAudio.dataset.skipNextAutoBeep = 'true';
          dictAudio.play().then(() => {
            if (statusBadge) {
              statusBadge.style.color = '#16a34a';
              statusBadge.innerHTML = `<i class="fa-solid fa-volume-high"></i> Voice Stream Playing (${currentDictationWpm || 80} WPM • Low-Bitrate Mode)`;
            }
          }).catch(() => {
            startTtsDictationSpeech({ forceSpeechSynthesis: true, skipAutoBeep: true });
          });
          return;
        }
        startTtsDictationSpeech({ forceSpeechSynthesis: true, skipAutoBeep: true });
        return;
      }

      if (ytIframe) {
        sendYouTubeAudioCommand('setPlaybackQuality', ['tiny']);
        sendYouTubeAudioCommand('playVideo');
        if (statusBadge) {
          statusBadge.style.color = '#16a34a';
          statusBadge.innerHTML = `<i class="fa-brands fa-youtube"></i> Video-to-Audio Low-Bitrate (144p/0fps Audio-Only) Playing (${currentDictationWpm || 80} WPM)`;
        }
        return;
      }

      if (dictAudio && !dictAudio.dataset.useTtsFallback) {
        const srcEl = dictAudio.querySelector('source');
        const srcUrl = (srcEl ? srcEl.getAttribute('src') : dictAudio.getAttribute('src')) || '';
        const isPlayableUrl = /^https?:\/\//i.test(srcUrl) || srcUrl.startsWith('data:audio') || srcUrl.startsWith('blob:') || srcUrl.startsWith('/');
        if (isPlayableUrl) {
          // Enforce lowest framerate & audio-only track if source is a video container
          try {
            if (dictAudio.videoTracks && dictAudio.videoTracks.length > 0) {
              for (let vt = 0; vt < dictAudio.videoTracks.length; vt++) {
                dictAudio.videoTracks[vt].selected = false;
              }
            }
          } catch (e) {}
          dictAudio.dataset.skipNextAutoBeep = 'true';
          dictAudio.play().then(() => {
            if (statusBadge) {
              statusBadge.style.color = '#16a34a';
              const isVidConverted = dictAudio.dataset.videoConvertedToAudio === 'true';
              statusBadge.innerHTML = isVidConverted
                ? `<i class="fa-solid fa-compress"></i> Video Auto-Converted to Low-Bitrate Audio (0fps • ~48kbps • ${currentDictationWpm || 80} WPM)`
                : `<i class="fa-solid fa-circle-check"></i> Voice Audio Stream Playing (${currentDictationWpm || 80} WPM)`;
            }
          }).catch(() => {
            dictAudio.dataset.useTtsFallback = 'true';
            if (statusBadge) {
              statusBadge.style.color = '#2563eb';
              statusBadge.innerHTML = `<i class="fa-solid fa-microphone-lines"></i> Master Passage Voice Dictation Active (${currentDictationWpm || 80} WPM)`;
            }
            startTtsDictationSpeech({ forceSpeechSynthesis: true, skipAutoBeep: true });
          });
          return;
        }
      }

      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        if (statusBadge) {
          statusBadge.style.color = '#16a34a';
          statusBadge.innerHTML = `<i class="fa-solid fa-volume-high"></i> Voice Dictation Resumed (${currentDictationWpm || 80} WPM)`;
        }
        return;
      }

      if (statusBadge) {
        statusBadge.style.color = '#2563eb';
        statusBadge.innerHTML = `<i class="fa-solid fa-microphone-lines"></i> Master Passage Voice Dictation Active (${currentDictationWpm || 80} WPM)`;
      }
      startTtsDictationSpeech({ forceSpeechSynthesis: true, skipAutoBeep: true });
    }

// Auto-beep before native <audio id="stenoshala-dictation-audio"> play when triggered directly from browser controls
if (!window.__stenoshalaNativeAudioAutoBeepBound) {
      window.__stenoshalaNativeAudioAutoBeepBound = true;
      document.addEventListener('play', (ev) => {
        const target = ev && ev.target;
        if (!target || target.id !== 'stenoshala-dictation-audio') return;
        if (target.dataset.skipNextAutoBeep === 'true') {
          delete target.dataset.skipNextAutoBeep;
          return;
        }
        if (target.dataset.autoBeepInProgress === 'true') return;
        target.dataset.autoBeepInProgress = 'true';
        try { target.pause(); } catch (e) {}
        playPreAudioStartAutoBeep(() => {
          delete target.dataset.autoBeepInProgress;
          target.dataset.skipNextAutoBeep = 'true';
          target.play().catch(() => {});
        });
      }, true);
    }

window.customUserDictationVoiceUrl = '';

export async function tryLoadDriveAudioIntoElement(rawUrl, audioElementId) {
      const clean = String(rawUrl || '').trim();
      const match = clean.match(/\/d\/([a-zA-Z0-9_-]+)/) || clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (!match || !match[1]) return false;
      const fileId = match[1];
      try {
        const res = await apiCall('getDriveFileBase64', { fileId }, true);
        if (res && res.success && res.dataUrl) {
          const audioEl = document.getElementById(audioElementId);
          if (audioEl) {
            audioEl.src = res.dataUrl;
            delete audioEl.dataset.useTtsFallback;
            audioEl.load();
            return true;
          }
        }
      } catch (e) {}
      return false;
    }

export function classifyAndConvertVoiceMediaUrl(rawInputUrl) {
      const clean = String(rawInputUrl || '').trim();
      if (!clean || clean === '-' || (!/^https?:\/\//i.test(clean) && !clean.startsWith('data:') && !clean.startsWith('blob:'))) {
        return { isValidMedia: false, isVideoConverted: false, isYouTube: false, isDrive: false, driveId: '', ytVideoId: '', streamUrl: '', label: 'Smart Voice Dictation Engine' };
      }

      const isYouTube = clean.includes('youtube.com') || clean.includes('youtu.be');
      if (isYouTube) {
        const ytId = extractYouTubeVideoId(clean);
        return {
          isValidMedia: Boolean(ytId),
          isVideoConverted: true,
          isYouTube: true,
          isDrive: false,
          driveId: '',
          ytVideoId: ytId,
          streamUrl: ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=0&enablejsapi=1&vq=tiny&playsinline=1&controls=0&rel=0&origin=${encodeURIComponent(window.location.origin)}` : '',
          label: 'YouTube Video → MP3 Audio-Only Mode'
        };
      }

      const isVideoExt = /\.(mp4|webm|mkv|mov|avi|m3u8|ogv|m4v|3gp|flv|ts)(\?.*)?$/i.test(clean) || /\/video\//i.test(clean);
      let finalUrl = getUniversalUrl(clean, 'audio');
      let isDrive = false;
      let driveId = '';
      let cloudProviderLabel = 'Protected MP3 Audio Stream';

      if (isGoogleDriveOrDocsUrl(clean)) {
        const extractedId = extractGoogleDriveFileId(clean);
        if (extractedId) {
          isDrive = true;
          driveId = extractedId;
          finalUrl = buildProtectedMediaProxyUrl(clean, 'audio');
          cloudProviderLabel = 'Protected Audio Stream';
        }
      } else if (clean.includes('github.com') || clean.includes('raw.githubusercontent.com')) {
        finalUrl = buildProtectedMediaProxyUrl(clean, 'audio');
        cloudProviderLabel = 'Protected Audio Stream';
      } else if (clean.includes('supabase.co') || clean.includes('supabase.in')) {
        finalUrl = buildProtectedMediaProxyUrl(clean, 'audio');
        cloudProviderLabel = 'Protected Audio Stream';
      } else if (clean.startsWith('blob:') || clean.startsWith('data:')) {
        finalUrl = clean;
        cloudProviderLabel = 'Recorded Microphone MP3 Stream';
      } else if (/^https?:\/\//i.test(clean)) {
        finalUrl = buildProtectedMediaProxyUrl(clean, 'audio');
      }

      return {
        isValidMedia: true,
        isVideoConverted: isVideoExt,
        isYouTube: false,
        isDrive: isDrive,
        driveId: driveId,
        ytVideoId: '',
        streamUrl: finalUrl,
        label: isVideoExt ? `${cloudProviderLabel} (Video → MP3 Audio-Only)` : `${cloudProviderLabel} (Ready)`
      };
    }

export function playCustomUserVoiceUrlInTab(tabType = 'audio') {
      const isPdfTab = tabType === 'pdf';
      const inputId = isPdfTab ? 'pdf-tab-custom-voice-url' : 'audio-tab-custom-voice-url';
      const mountId = isPdfTab ? 'pdf-tab-custom-voice-player-mount' : 'audio-tab-custom-voice-player-mount';
      const inp = document.getElementById(inputId);
      const rawUrl = inp ? inp.value.trim() : '';
      if (!rawUrl) {
        showToast('Please paste a Voice, Audio, or Video URL first.');
        return;
      }
      window.customUserDictationVoiceUrl = rawUrl;
      try {
        localStorage.setItem('steno_user_custom_voice_url', rawUrl);
      } catch (e) {}
      if (typeof syncUserCloudStateToBackend === 'function') {
        syncUserCloudStateToBackend({ customVoiceUrl: rawUrl });
      }

      const info = classifyAndConvertVoiceMediaUrl(rawUrl);
      if (!info.isValidMedia) {
        showToast('Invalid URL. Please paste a valid https:// Audio, Video, YouTube, or Google Drive URL.');
        return;
      }

      let mount = document.getElementById(mountId);
      if (!mount && inp && inp.parentElement) {
        mount = document.createElement('div');
        mount.id = mountId;
        mount.style.cssText = 'display:block; margin-top:8px; width:100%;';
        inp.parentElement.parentElement.appendChild(mount);
      }
      if (!mount) {
        openUniversalMediaViewer(rawUrl, 'Custom User Voice / Audio Stream', true);
        return;
      }

      const audioElId = `tab-custom-voice-audio-${tabType}`;
      const safeRawUrl = rawUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      mount.style.display = 'block';

      if (info.isYouTube && info.ytVideoId) {
        const ytFrameId = `tab-custom-yt-mp3-${tabType}`;
        mount.innerHTML = `
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:8px 10px; display:flex; flex-direction:column; gap:6px; position:relative;">
            <iframe id="${ytFrameId}" src="https://www.youtube.com/embed/${info.ytVideoId}?autoplay=1&enablejsapi=1&vq=tiny&playsinline=1&controls=0&origin=${encodeURIComponent(window.location.origin)}" style="width:1px; height:1px; opacity:0; position:absolute; pointer-events:none; border:none;" allow="autoplay; encrypted-media"></iframe>
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <span style="font-size:12px; font-weight:800; color:#059669;"><i class="fa-solid fa-music"></i> ${info.label}</span>
              <div style="display:flex; gap:5px; align-items:center;">
                <button type="button" class="btn btn-sm btn-success" style="padding:3px 9px; font-size:11px;" onclick="document.getElementById('${ytFrameId}')?.contentWindow?.postMessage(JSON.stringify({event:'command',func:'playVideo',args:[]}),'*')"><i class="fa-solid fa-play"></i> Play</button>
                <button type="button" class="btn btn-sm btn-warning" style="padding:3px 9px; font-size:11px;" onclick="document.getElementById('${ytFrameId}')?.contentWindow?.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:[]}),'*')"><i class="fa-solid fa-pause"></i> Pause</button>
                <button type="button" class="btn btn-sm btn-danger" style="padding:3px 8px; font-size:11px;" onclick="document.getElementById('${mountId}').style.display='none'; document.getElementById('${mountId}').innerHTML='';"><i class="fa-solid fa-xmark"></i></button>
              </div>
            </div>
          </div>
        `;
      } else {
        mount.innerHTML = `
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:8px 10px; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <span style="font-size:12px; font-weight:800; color:#059669;"><i class="fa-solid fa-music"></i> ${info.label}</span>
              <div style="display:flex; gap:5px; align-items:center;">
                <select onchange="const a=document.getElementById('${audioElId}'); if(a) a.playbackRate=parseFloat(this.value)||1;" style="margin:0; padding:2px 6px; font-size:11px; font-weight:700; width:auto;">
                  <option value="0.75">0.75x (~60 WPM)</option>
                  <option value="0.88">0.88x (~70 WPM)</option>
                  <option value="1" selected>1.0x (80 WPM)</option>
                  <option value="1.12">1.12x (~90 WPM)</option>
                  <option value="1.25">1.25x (100 WPM)</option>
                  <option value="1.5">1.5x (120 WPM)</option>
                  <option value="1.75">1.75x (140 WPM)</option>
                  <option value="2">2.0x (160 WPM)</option>
                </select>
                <button type="button" class="btn btn-sm btn-secondary" style="padding:3px 8px; font-size:11px;" onclick="openUniversalMediaViewer('${safeRawUrl}', 'Custom Audio Stream', true)"><i class="fa-solid fa-headphones"></i> Player</button>
                <button type="button" class="btn btn-sm btn-danger" style="padding:3px 8px; font-size:11px;" onclick="document.getElementById('${mountId}').style.display='none'; document.getElementById('${mountId}').innerHTML='';"><i class="fa-solid fa-xmark"></i></button>
              </div>
            </div>
            <audio id="${audioElId}" controls autoplay preload="auto" controlsList="nodownload" oncontextmenu="return false;" style="width:100%; height:36px;" src="${info.streamUrl}"></audio>
          </div>
        `;
        const audioEl = document.getElementById(audioElId);
        if (audioEl) {
          audioEl.onerror = () => {
            if (info.isDrive) tryLoadDriveAudioIntoElement(rawUrl, audioElId);
          };
          audioEl.play().catch(() => {});
        }
      }
      showToast('🔊 Playing in MP3 Audio-Only Mode!');
    }

export let __activeReadingPhaseInterval = null;

export let __pendingReadingUnlockCallback = null;

window.toggleActiveTestToolsBar = function(forceShow) {
      const statusBar = document.getElementById('live-typing-status-bar');
      const toggleBtn = document.getElementById('test-tools-drawer-toggle-btn');
      if (!statusBar) return;
      const isHidden = statusBar.style.display === 'none' || !statusBar.style.display;
      const showNext = typeof forceShow === 'boolean' ? forceShow : isHidden;
      statusBar.style.display = showNext ? 'flex' : 'none';
      if (toggleBtn) {
        toggleBtn.innerHTML = showNext
          ? '<i class="fa-solid fa-chevron-up"></i> <span>Hide Tools</span>'
          : '<i class="fa-solid fa-sliders"></i> <span>Tools</span>';
        toggleBtn.classList.toggle('btn-primary', showNext);
        toggleBtn.classList.toggle('btn-secondary', !showNext);
      }
    };

export function configureActiveTestModalChrome(mode) {
      // mode: 'dictation_room' | 'audio_transcription' | 'pitman_transcription' | 'typing_exam' | 'learning_exercise'
      const isDictationRoom = mode === 'dictation_room';
      const isCompactStartMode = mode === 'audio_transcription' || mode === 'pitman_transcription' || mode === 'typing_exam';

      const mainBody = document.getElementById('test-main-body-container');
      if (mainBody) {
        mainBody.classList.toggle('rp-typing-exam-body', mode === 'typing_exam');
      }
      const zoomWrap = document.getElementById('test-header-font-zoom-wrap');
      const submitBtn = document.getElementById('test-header-quick-submit-btn');
      const exitBtn = document.getElementById('test-header-exit-btn');
      const timerWrap = document.getElementById('test-timer-pill-wrap');
      const inlineWords = document.getElementById('test-header-inline-words');
      const toolsToggleBtn = document.getElementById('test-tools-drawer-toggle-btn');
      const fsBtn = document.getElementById('test-fullscreen-toggle-btn');
      const statusBar = document.getElementById('live-typing-status-bar');
      const footerBar = document.getElementById('active-test-footer-bar');
      const hallSoundStatusWrap = document.getElementById('live-status-hall-sound-wrap');
      const hallChk = document.getElementById('status-bar-hall-sound-chk');
      const readingBanner = document.getElementById('mandatory-reading-phase-banner');
      const hardWordsDrawer = document.getElementById('modal-hard-words-glossary-box');
      const legacyComfortBar = document.getElementById('rp-mobile-test-comfort-bar');
      if (legacyComfortBar) legacyComfortBar.remove();
      document.body.classList.remove('mobile-exam-focus-mode');
      if (hardWordsDrawer) {
        hardWordsDrawer.classList.add('hidden');
        hardWordsDrawer.style.display = 'none';
      }

      if (isDictationRoom) {
        // Step 1 Dictation Room: ultra-slim header with only title + Exit
        document.body.classList.remove('reading-time-fullscreen-lock');
        if (zoomWrap) zoomWrap.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';
        if (timerWrap) timerWrap.style.display = 'none';
        if (inlineWords) inlineWords.style.display = 'none';
        if (toolsToggleBtn) toolsToggleBtn.style.display = 'none';
        if (statusBar) statusBar.style.display = 'none';
        if (footerBar) footerBar.style.display = 'none';
        if (readingBanner) {
          readingBanner.classList.add('hidden');
          readingBanner.classList.remove('reading-fullscreen-active');
          readingBanner.style.display = 'none';
        }
        if (exitBtn) exitBtn.style.display = 'inline-flex';
        if (fsBtn) fsBtn.style.display = 'none';
      } else {
        // Active Transcription / Pitman / Typing / Learning Test Started:
        // Slim 38px top bar (Title + inline word count + Timer + 1-click Tools toggle) so workspace fills nearly the entire viewport.
        // Audio & Pitman start with secondary tools strip collapsed by default; click "Tools" anytime for Zoom (A-/A+), Hall Noise, Full Screen & live stats.
        if (zoomWrap) zoomWrap.style.display = 'inline-flex';
        if (submitBtn) submitBtn.style.display = 'none';
        if (exitBtn) exitBtn.style.display = 'none';
        if (timerWrap) timerWrap.style.display = 'inline-flex';
        if (inlineWords) inlineWords.style.display = 'inline-flex';
        if (toolsToggleBtn) toolsToggleBtn.style.display = 'inline-flex';
        if (fsBtn) fsBtn.style.display = 'inline-flex';
        if (footerBar) footerBar.style.display = 'flex';
        if (typeof window.toggleActiveTestToolsBar === 'function') {
          window.toggleActiveTestToolsBar(!isCompactStartMode);
        } else if (statusBar) {
          statusBar.style.display = isCompactStartMode ? 'none' : 'flex';
        }
        if (hallSoundStatusWrap) {
          hallSoundStatusWrap.style.display = 'inline-flex';
        }
        if (hallChk) {
          hallChk.checked = Boolean(portalState.isExamHallSoundActive);
        }
        const statusProfSel = document.getElementById('status-bar-hall-profile-select');
        if (statusProfSel) {
          statusProfSel.value = window.examHallNoiseProfile || 'full_mix';
        }
        const statusVolSel = document.getElementById('status-bar-hall-vol-select');
        if (statusVolSel) {
          const curPct = Number(window.examHallNoiseVolumePct || 45);
          statusVolSel.value = curPct <= 35 ? '30' : (curPct >= 80 ? '95' : '60');
        }
      }
    }

export function toggleExamHallSoundFromStatusBar(checked) {
      portalState.isExamHallSoundActive = Boolean(checked);
      document.querySelectorAll('.exam-hall-sound-chk').forEach(el => {
        el.checked = portalState.isExamHallSoundActive;
      });
      if (portalState.isExamHallSoundActive) {
        if (typeof startExamHallSynth === 'function') {
          startExamHallSynth();
        } else if (!portalState.examHallAudioCtx) {
          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) portalState.examHallAudioCtx = new AudioCtx();
          } catch (e) {}
        }
      } else {
        if (typeof stopExamHallSynth === 'function') {
          stopExamHallSynth();
        }
      }
      showToast(portalState.isExamHallSoundActive ? '🔊 Exam Hall Mechanical Key Sound: ON' : '🔇 Exam Hall Sound: OFF');
    }

export function triggerRuleReadingTimeBeforeTest(rules, onUnlockStartTimer) {
      if (__activeReadingPhaseInterval) {
        clearInterval(__activeReadingPhaseInterval);
        __activeReadingPhaseInterval = null;
      }
      const readingBanner = document.getElementById('mandatory-reading-phase-banner');
      const timerDisplay = document.getElementById('mandatory-reading-timer-display');
      const ruleLabel = document.getElementById('mandatory-reading-rule-label');
      const inputEl = document.getElementById('test-user-input');

      const readingMins = (rules && rules.readingTimeMinutes !== undefined && !isNaN(rules.readingTimeMinutes))
        ? Math.max(0, Number(rules.readingTimeMinutes))
        : 2;

      if (readingMins <= 0 || !readingBanner || !timerDisplay) {
        document.body.classList.remove('reading-time-fullscreen-lock');
        if (readingBanner) {
          readingBanner.classList.add('hidden');
          readingBanner.classList.remove('reading-fullscreen-active');
          readingBanner.style.display = 'none';
        }
        if (inputEl) {
          inputEl.disabled = false;
          inputEl.focus();
        }
        if (typeof onUnlockStartTimer === 'function') onUnlockStartTimer();
        return;
      }

      const totalSec = Math.max(1, Math.round(readingMins * 60));
      let remainingSec = totalSec;
      __pendingReadingUnlockCallback = onUnlockStartTimer;

      const headingEl = document.getElementById('mandatory-reading-exam-heading');
      if (headingEl) {
        headingEl.innerText = `${rules.examDisplayName || 'Commission Skill Test'} — ${readingMins} Min Reading Time`;
      }
      if (ruleLabel) {
        ruleLabel.innerText = `Auto-fetched ${readingMins}-Minute Shorthand Read-Back Phase for "${rules.examDisplayName || 'Selected Evaluation Rule'}". Review your shorthand outlines peacefully — nothing else is shown until transcription begins.`;
      }

      // Lock entire screen so ONLY the animated Reading Time screen is visible
      document.body.classList.add('reading-time-fullscreen-lock');
      readingBanner.classList.remove('hidden');
      readingBanner.classList.add('reading-fullscreen-active');
      readingBanner.style.display = 'flex';

      if (inputEl) {
        inputEl.disabled = true;
      }

      const progressCircle = document.getElementById('mandatory-reading-progress-circle');
      const circumference = 578;
      const renderFmt = (sec) => {
        const s = Math.max(0, Math.floor(sec));
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      };
      const syncRing = () => {
        if (timerDisplay) timerDisplay.textContent = renderFmt(remainingSec);
        if (progressCircle) {
          const pctElapsed = Math.min(1, Math.max(0, (totalSec - remainingSec) / totalSec));
          progressCircle.style.strokeDashoffset = String(Math.round(circumference * pctElapsed));
        }
      };
      syncRing();

      __activeReadingPhaseInterval = setInterval(() => {
        remainingSec--;
        syncRing();
        if (remainingSec <= 0) {
          skipMandatoryReadingPhaseAndUnlock();
        }
      }, 1000);
    }

export function openLearningStudioPracticeScreen() {
      const setupScreen = document.getElementById('learning-studio-screen-setup');
      const practiceScreen = document.getElementById('learning-studio-screen-practice');
      const customInp = document.getElementById('learning-custom-text-input');
      if (customInp && customInp.value.trim()) {
        window.currentLearningTargetText = customInp.value.trim();
      }
      if (!window.currentLearningTargetText || !window.currentLearningTargetText.trim()) {
        const select = document.getElementById('learning-drill-select');
        loadLearningLesson(select && select.value ? select.value : 'ergo_home_row');
      }
      if (setupScreen) setupScreen.style.display = 'none';
      if (practiceScreen) {
        practiceScreen.classList.remove('rp-practice-fs-on');
        practiceScreen.style.display = 'flex';
      }
      if (typeof exitImmersiveFullscreenLock === 'function') exitImmersiveFullscreenLock('learning-practice');
      renderLearningKeyboard();
      updateLearningStudioCompleteRules();
      const input = document.getElementById('learning-user-input');
      if (input) setTimeout(() => input.focus(), 60);
    }

export function openLearningStudioSetupScreen() {
      const setupScreen = document.getElementById('learning-studio-screen-setup');
      const practiceScreen = document.getElementById('learning-studio-screen-practice');
      if (practiceScreen) {
        practiceScreen.classList.remove('rp-practice-fs-on');
        practiceScreen.style.display = 'none';
      }
      if (setupScreen) setupScreen.style.display = 'flex';
      const fsBtn = document.getElementById('btn-learning-practice-fs');
      if (fsBtn) fsBtn.innerHTML = '<i class="fa-solid fa-expand"></i> Full Screen';
      if (typeof exitImmersiveFullscreenLock === 'function') exitImmersiveFullscreenLock('learning-practice');
    }

export function toggleLearningPracticeFullscreen() {
      const practiceScreen = document.getElementById('learning-studio-screen-practice');
      const fsBtn = document.getElementById('btn-learning-practice-fs');
      if (!practiceScreen) return;
      const isNowFs = practiceScreen.classList.toggle('rp-practice-fs-on');
      if (isNowFs) {
        if (typeof enterImmersiveFullscreenLock === 'function') enterImmersiveFullscreenLock('learning-practice');
        if (fsBtn) fsBtn.innerHTML = '<i class="fa-solid fa-compress"></i> Exit Full Screen';
      } else {
        if (typeof exitImmersiveFullscreenLock === 'function') exitImmersiveFullscreenLock('learning-practice');
        if (fsBtn) fsBtn.innerHTML = '<i class="fa-solid fa-expand"></i> Full Screen';
      }
    }

export function applyCustomTextToLearningStudio() {
      const inp = document.getElementById('learning-custom-text-input');
      const raw = inp ? inp.value.replace(/\s+/g, ' ').trim() : '';
      if (!raw) {
        showToast('Paste or type some practice text first.');
        return;
      }
      window.currentLearningTargetText = raw;
      portalState.learningStartTime = null;
      portalState.learningBackspaces = 0;
      if (portalState.learningTimerInterval) { clearInterval(portalState.learningTimerInterval); portalState.learningTimerInterval = null; }
      const userInp = document.getElementById('learning-user-input');
      if (userInp) userInp.value = '';
      updateLearningDisplayAndKeyHighlight();
      showToast('✅ Custom practice text loaded! Click "Start Touch-Typing Practice Screen" to begin.');
    }

export async function submitLearningStudioPracticeResult() {
      const target = window.currentLearningTargetText || '';
      const inputEl = document.getElementById('learning-user-input') || document.getElementById('learning-typing-input');
      const typed = inputEl ? inputEl.value : '';
      if (!typed || typed.trim().length === 0) {
        showToast('⚠️ Please type at least a few words before saving your practice result.');
        return;
      }
      if (portalState.learningTimerInterval) {
        clearInterval(portalState.learningTimerInterval);
        portalState.learningTimerInterval = null;
      }
      const stats = updateLearningDisplayAndKeyHighlight();
      const elapsedSec = portalState.learningStartTime ? Math.max(1, Math.round((Date.now() - portalState.learningStartTime) / 1000)) : 60;
      const elapsedMin = Math.max(elapsedSec / 60, 0.05);
      const wcRule = (document.getElementById('learning-studio-wordrule-select'))?.value || '5stroke';
      const wpmByStroke = Math.round((stats.typedLen / 5) / elapsedMin);
      const wpmBySpace = Math.round(stats.typedWords / elapsedMin);
      const netSpeed = wcRule === '1word' ? wpmBySpace : wpmByStroke;
      const grossSpeed = Math.max(netSpeed, wpmByStroke);
      const acc = stats.typedLen > 0 ? Number(((stats.correctChars / stats.typedLen) * 100).toFixed(2)) : 100;
      const wrongChars = Math.max(0, stats.typedLen - stats.correctChars);
      const wrongWords = Math.max(0, Math.ceil(wrongChars / 5));
      const drillSel = document.getElementById('learning-drill-select');
      const drillTitle = (drillSel && drillSel.options[drillSel.selectedIndex])
        ? drillSel.options[drillSel.selectedIndex].text.replace(/^[^A-Za-z0-9]+/, '').trim()
        : 'Touch-Typing Studio Drill';

      const nowObj = new Date();
      const dateStr = getLocalDateString();
      const mmUsed = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const ssUsed = String(elapsedSec % 60).padStart(2, '0');

      const payload = {
        userId: portalState.currentUser ? (portalState.currentUser.userId || portalState.currentUser.mobile || portalState.currentUser.email || 'STUDENT') : 'GUEST',
        userName: portalState.currentUser ? (portalState.currentUser.name || 'Student') : 'Guest Student',
        examName: 'Touch-Typing Studio Practice',
        passageTitle: drillTitle,
        timeDuration: `${mmUsed}m ${ssUsed}s`,
        typingDate: nowObj.toLocaleString(),
        timeTaken: `${mmUsed}m ${ssUsed}s`,
        errorRelaxed: '0%',
        penaltyWord: '1',
        date: dateStr,
        grossSpeed: grossSpeed,
        netSpeed: netSpeed,
        totalWord: stats.totalWords,
        totalCharacter: stats.targetLen,
        totalTypedCharacter: stats.typedLen,
        totalTypedWords: stats.typedWords,
        totalBackspace: portalState.learningBackspaces,
        accuracyPercentage: acc,
        errorPercentage: Number((100 - acc).toFixed(2)),
        marksObtained: acc,
        totalMarks: 100,
        wrongTyped: wrongWords,
        wordLeft: Math.max(0, stats.totalWords - stats.typedWords),
        extraTyped: 0,
        paraNotChanged: 0,
        punctuationError: 0,
        capitalError: 0,
        status: acc >= 85 ? 'Qualified' : 'Practiced',
        timeUsed: `${mmUsed}:${ssUsed}`,
        userTranscription: typed,
        referenceText: target,
        timestamp: nowObj.toISOString(),
        correctWords: Math.max(0, stats.typedWords - wrongWords),
        wordCountRule: wcRule
      };

      const uiRow = {
        HistoryID: 'TST-' + Date.now(),
        UserID: payload.userId,
        UserName: payload.userName,
        ExamName: payload.examName,
        PassageTitle: payload.passageTitle,
        Date: payload.date,
        GrossSpeed: payload.grossSpeed,
        NetSpeed: payload.netSpeed,
        TotalWord: payload.totalWord,
        TotalTypedWords: payload.totalTypedWords,
        TotalBackspace: payload.totalBackspace,
        AccuracyPercentage: payload.accuracyPercentage,
        ErrorPercentage: payload.errorPercentage,
        MarksObtained: payload.marksObtained,
        TotalMarks: payload.totalMarks,
        Status: payload.status,
        TimeUsed: payload.timeUsed,
        UserTranscription: payload.userTranscription,
        ReferenceText: payload.referenceText,
        Timestamp: payload.timestamp
      };

      portalState.allTestHistoryList.unshift(uiRow);
      if (!Array.isArray(portalState.globalData.userHistory)) portalState.globalData.userHistory = [];
      portalState.globalData.userHistory.unshift(uiRow);
      if (!Array.isArray(portalState.globalData.history)) portalState.globalData.history = [];
      portalState.globalData.history.unshift(uiRow);
      localStorage.setItem('steno_test_history', JSON.stringify(portalState.allTestHistoryList.slice(0, 150)));

      if (typeof renderDailyPracticeGoalUI === 'function') renderDailyPracticeGoalUI();
      if (typeof window.renderTestHistoryTable === 'function') window.renderTestHistoryTable();

      showToast(`✅ Touch-Typing Studio Result Saved! Net Speed: ${netSpeed} WPM | Accuracy: ${acc}%`);
      try {
        await apiCall('saveTestHistory', payload, true);
      } catch (e) {}
    }

export function startAudioDictationTestById(id) {
      if (typeof isActionBlockedByUnverifiedEmail === 'function' && isActionBlockedByUnverifiedEmail('starting an Audio Dictation Test')) return;
      const item = portalState.materialsData.find(m => String(m.ID || m.id) === String(id));
      if (!item) {
        showToast('Audio dictation exercise not found.');
        return;
      }

      const perms = checkMaterialAccessPermissions(item.AccessLevel, item);
      if (!perms.canView) {
        showToast(`Access Denied: Restricted to ${perms.requiredRoleLabel}.`);
        return;
      }

      stopAllPortalAudioAndMediaPlayback();

      portalState.pendingAudioDictationItem = item;
      window.pendingPitmanDirectLaunch = false;
      window.lastOriginTabBeforeTest = 'audio';
      window.isCountUpTimerMode = false;
      portalState.currentExamName = `Audio Dictation: ${item.Title}`;
      portalState.currentReferenceText = (item.ThumbnailUrl && item.ThumbnailUrl !== '-' && !item.ThumbnailUrl.startsWith('http'))
        ? item.ThumbnailUrl
        : (item.ContentOrUrl && !item.ContentOrUrl.startsWith('http') ? item.ContentOrUrl : '');
      window.fullMasterPassageText = portalState.currentReferenceText;
      window.showingCompletePassageOverride = false;
      window.__originalModalRefPlainText = portalState.currentReferenceText;

      portalState.isTestPaused = false;
      portalState.isTypingTimerStarted = false;
      portalState.testBackspaces = 0;
      const keepNoiseOn = document.getElementById('audio-exam-hall-noise-Master-chk')?.checked;
      if (!keepNoiseOn) {
        stopExamHallSynth();
      }
      stopTtsDictationSpeech();

      if (typeof logPortalAction === 'function') {
        logPortalAction('OPEN_AUDIO_DICTATION', `Opened Stenoshala Dictation: ${item.Title}`);
      }

      const titleEl = document.getElementById('test-modal-title');
      if (titleEl) titleEl.innerText = `Stenoshala Dictation Room: ${item.Title}`;

      // Configure top header for Step 1 Dictation Room: hide Focus Mode, + -, TIME LEFT: DICTATION, Submit, Status Bar & Reading Time until test is started
      configureActiveTestModalChrome('dictation_room');

      window.currentActivePassageTitle = item.Title || 'Audio Dictation Passage';
      window.currentActiveExamRuleTitle = 'Audio Dictation Room';

      const rawAudioUrl = String(item.VoiceUrl || item.AudioUrl || item.ContentOrUrl || '').trim();
      const clipConfig = typeof window.resolveMaterialMediaClipConfig === 'function'
        ? window.resolveMaterialMediaClipConfig(rawAudioUrl, item.Title, item)
        : { startSec: null, endSec: null, startLabel: '', endLabel: '', tracks: [] };
      window.activeDictationTrackQueue = clipConfig.tracks.length > 0
        ? clipConfig.tracks
        : [];
      window.activeDictationTrackIndex = 0;

      const activeTrack = window.activeDictationTrackQueue[0] || {
        title: item.Title || 'Part 1',
        url: (/^https?:\/\//i.test(rawAudioUrl) || rawAudioUrl.startsWith('data:') || rawAudioUrl.startsWith('blob:')) ? rawAudioUrl : '',
        startSec: clipConfig.startSec,
        endSec: clipConfig.endSec,
        startLabel: clipConfig.startLabel,
        endLabel: clipConfig.endLabel
      };
      const effectiveInitialUrl = activeTrack.url || '';
      window.currentAdminAudioCloudUrl = effectiveInitialUrl;

      const mediaInfo = classifyAndConvertVoiceMediaUrl(effectiveInitialUrl);
      const isDirectMediaUrl = mediaInfo.isValidMedia;
      const isYouTube = mediaInfo.isYouTube;
      const ytVideoId = mediaInfo.ytVideoId;
      const audioFileUrl = mediaInfo.streamUrl;
      const ytClipQuery = typeof window.buildYouTubeClipQueryParams === 'function'
        ? window.buildYouTubeClipQueryParams(activeTrack.startSec, activeTrack.endSec)
        : '';
      const hasMergedTracks = window.activeDictationTrackQueue.length > 1;
      const hasClipWindow = activeTrack.startSec !== null || activeTrack.endSec !== null;

      const refWordsCount = portalState.currentReferenceText.trim().split(/\s+/).filter(Boolean).length;
      const refStrokesCount = portalState.currentReferenceText.length;

      window.detectedSourceAudioBaseWpm = detectBaseWpmFromAudioItem(item, 0);
      const headerTargetSelect = document.getElementById('audio-tab-target-wpm-select');
      if (headerTargetSelect && headerTargetSelect.value) {
        currentDictationWpm = parseInt(headerTargetSelect.value, 10) || 80;
      }
      updateSyncAudioWpmUI();

      const mainBody = document.getElementById('test-main-body-container');
      mainBody.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 1180px; margin: 0 auto; flex: 1; padding-bottom: 20px;">
          <!-- 5-Second Countdown Live Banner -->
          <div id="modal-5sec-countdown-live-banner" style="display: none; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(90deg, #dc2626, #ea580c); color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 14px; font-weight: 800;">
            <i class="fa-solid fa-bell"></i> <span>Get Ready — Dictation starts in 5...</span>
          </div>

          <!-- TOP STUDIO BAR: Title, Word Stats, Optional Hard Words Toggle (Hidden by Default) & Step 2 CTA -->
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 18px 22px; border-radius: 14px; border: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div style="flex: 1; min-width: 240px;">
              <div style="font-size: 11.5px; font-weight: 700; color: #93c5fd; margin-bottom: 4px;">
                Step 1 of 2 · Dictation &amp; Shorthand Studio
              </div>
              <h3 style="margin: 0; font-size: 18px; font-weight: 800; line-height: 1.28; color: #ffffff;">${escapeHtml(item.Title || 'Audio Dictation')}</h3>
              <div style="margin-top: 6px; font-size: 12.5px; color: #cbd5e1; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                <span>Subtab: <strong style="color:#fff;">${escapeHtml(item.Subtab || 'General')}</strong></span>
                <span aria-hidden="true">·</span>
                <span class="mono-num" style="color: #7dd3fc; font-weight: 700;">${refWordsCount} Words · ${refStrokesCount} Strokes</span>
                ${hasClipWindow ? `<span aria-hidden="true">·</span><span class="mono-num" style="color: #34d399; font-weight: 800;">✂️ Clip: ${activeTrack.startLabel || '00:00'} – ${activeTrack.endLabel || 'End'}</span>` : ''}
                ${hasMergedTracks ? `<span aria-hidden="true">·</span><span style="color: #c4b5fd; font-weight: 800;">🎵 ${window.activeDictationTrackQueue.length} Merged Tracks</span>` : ''}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button type="button" id="dictation-toggle-hard-words-btn" class="btn btn-secondary btn-sm" style="background: rgba(255,255,255,0.1); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.22); padding: 9px 14px; font-size: 12px; font-weight: 700;" onclick="toggleExerciseHardWordsPanel()">
                <i class="fa-solid fa-eye"></i> Show 50 Hard Words
              </button>
              <button type="button" class="btn btn-success" style="padding: 10px 20px; font-size: 13.5px; font-weight: 800; box-shadow: 0 6px 18px rgba(16, 185, 129, 0.3);" onclick="window.openTranscribeExamSelector('audio')">
                <i class="fa-solid fa-keyboard"></i> Step 2: Transcribe Now &rarr;
              </button>
            </div>
          </div>

          <!-- COLLAPSIBLE HARD WORDS DRAWER (Hidden By Default — Opens Only When User Clicks "Show 50 Hard Words") -->
          <div id="stenoshala-exercise-hard-words-card" style="display: none; background: var(--surface); border: 1px solid rgba(16,185,129,0.4); border-radius: 14px; padding: 14px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
              <div>
                <strong style="font-size: 13.5px; color: var(--secondary);"><i class="fa-solid fa-spell-check" style="color: #059669;"></i> Top 50 Hard &amp; Legal Words in This Passage</strong>
                <span style="font-size: 11.5px; color: var(--text-muted); margin-left: 8px;">Click any word to inspect its Pitman Shorthand outline</span>
              </div>
              <button type="button" class="btn btn-sm btn-secondary" onclick="toggleExerciseHardWordsPanel(false)">Hide</button>
            </div>
            <div id="stenoshala-exercise-hard-words-chips" style="display: flex; flex-wrap: wrap; gap: 7px;"></div>
          </div>

          <!-- MAIN CONSOLE: Balanced 2-Column Dictation Deck -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 16px; align-items: stretch;">
            
            <!-- LEFT CARD: Audio Stream, Playback Transport, WPM Speed & Practice Drills -->
            <div style="background: var(--surface); padding: 18px; border-radius: 14px; border: 1px solid var(--border); display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
                <span style="font-size: 13.5px; font-weight: 800; color: var(--secondary);">
                  <i class="fa-solid fa-circle-play" style="color: var(--primary);"></i> 1. Audio Stream &amp; Speed Control
                </span>
                <span id="stenoshala-audio-verify-status" style="font-size: 11.5px; font-weight: 700; color: #059669;">
                  ${mediaInfo.label} Ready
                </span>
              </div>

              ${(hasMergedTracks || hasClipWindow) ? `
                <div id="stenoshala-merged-track-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding:8px 12px; border-radius:10px; background:rgba(124,58,237,0.08); border:1px solid rgba(124,58,237,0.3); font-size:11.5px;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <strong id="stenoshala-active-track-label" style="color:var(--secondary);">
                      ${hasMergedTracks ? `Part 1 of ${window.activeDictationTrackQueue.length}: ${escapeHtml(activeTrack.title)}` : 'Active Audio Clip'}
                    </strong>
                    <span id="stenoshala-active-clip-badge" class="mono-num" style="color:#059669; font-weight:800;">
                      ${hasClipWindow ? `✂️ ${activeTrack.startLabel || '00:00'} – ${activeTrack.endLabel || 'End'}` : 'Full Track'}
                    </span>
                  </div>
                  ${hasMergedTracks ? `
                    <div style="display:flex; gap:6px; align-items:center;">
                      <button type="button" class="btn btn-secondary btn-sm" style="padding:3px 9px; font-size:11px;" onclick="switchDictationMergedTrack(window.activeDictationTrackIndex - 1, true)"><i class="fa-solid fa-backward-step"></i> Prev</button>
                      <button type="button" class="btn btn-primary btn-sm" style="padding:3px 9px; font-size:11px;" onclick="switchDictationMergedTrack(window.activeDictationTrackIndex + 1, true)">Next <i class="fa-solid fa-forward-step"></i></button>
                    </div>
                  ` : ''}
                </div>
              ` : ''}

              <div id="stenoshala-dynamic-media-mount" style="position:relative;">
                ${isYouTube && ytVideoId ? `
                  <iframe id="stenoshala-youtube-audio" data-yt-id="${ytVideoId}" src="https://www.youtube.com/embed/${ytVideoId}?autoplay=0&enablejsapi=1&vq=tiny&playsinline=1&controls=0${ytClipQuery}&origin=${encodeURIComponent(window.location.origin)}" style="width:1px; height:1px; opacity:0; position:absolute; pointer-events:none; border:none;" allow="autoplay"></iframe>
                  <div style="padding:10px 12px; border-radius:10px; background:var(--background); border:1px solid var(--border); font-size:12px; font-weight:700; color:var(--secondary); display:flex; align-items:center; justify-content:space-between; gap:8px;">
                    <span><i class="fa-solid fa-music" style="color:#059669;"></i> MP3 Audio-Only Mode (Video Hidden)</span>
                    <span style="font-size:11px; color:#059669;">Click Play below</span>
                  </div>
                ` : `
                  <audio id="stenoshala-dictation-audio" controls preload="metadata" data-video-converted-to-audio="${mediaInfo.isVideoConverted ? 'true' : 'false'}" ${!isDirectMediaUrl ? 'data-use-tts-fallback="true"' : ''} controlsList="nodownload" oncontextmenu="return false;" style="width:100%; height:40px;">
                    ${isDirectMediaUrl ? `<source src="${audioFileUrl}">` : ''}
                  </audio>
                  ${mediaInfo.isVideoConverted ? `
                    <div style="margin-top:5px; font-size:11px; font-weight:700; color:#059669;"><i class="fa-solid fa-music"></i> Video URL playing strictly in MP3 Audio-Only Mode</div>
                  ` : ''}
                `}
              </div>

              <!-- Transport Controls + Synced WPM Pace -->
              <div style="display: flex; flex-direction: column; gap: 10px; background: var(--background); padding: 12px; border-radius: 12px; border: 1px solid var(--border);">
                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                  <button type="button" class="btn btn-success btn-sm" style="flex: 1; min-width: 82px;" onclick="playOrVerifyStenoshalaDictationAudio('play')"><i class="fa-solid fa-play"></i> Play</button>
                  <button type="button" class="btn btn-warning btn-sm" style="flex: 1; min-width: 82px;" onclick="playOrVerifyStenoshalaDictationAudio('pause')"><i class="fa-solid fa-pause"></i> Pause</button>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="playOrVerifyStenoshalaDictationAudio('replay')"><i class="fa-solid fa-rotate-right"></i> Replay</button>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding-top: 8px; border-top: 1px solid var(--border);">
                  <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 700; font-size: 12px; color: var(--secondary); margin: 0;">
                    <input type="checkbox" id="audio-tab-sync-wpm-toggle" ${window.isAudioSpeedSyncedWithWpm !== false ? 'checked' : ''} onchange="toggleSyncAudioSpeedWithWpm(this.checked)" style="width: 14px; height: 14px; accent-color: var(--primary); margin: 0;">
                    <span>Target WPM Pace</span>
                  </label>
                  <div style="display: flex; align-items: center; gap: 5px;">
                    <button type="button" class="btn btn-sm btn-secondary" onclick="stepDictationWpmBy5(-5)" style="padding: 4px 9px; font-size: 11px; font-weight: 800;">-5</button>
                    <select id="audio-tab-target-wpm-select" onchange="setSyncedTargetWpmPace(this.value)" style="width: 108px; margin: 0; padding: 5px 8px; font-size: 12px; font-weight: 800;">
                      ${[40, 50, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 140, 150, 160, 180, 200, 220, 250].map(w => `<option value="${w}" ${(currentDictationWpm || 80) === w ? 'selected' : ''}>${w} WPM</option>`).join('')}
                    </select>
                    <button type="button" class="btn btn-sm btn-secondary" onclick="stepDictationWpmBy5(5)" style="padding: 4px 9px; font-size: 11px; font-weight: 800;">+5</button>
                    <span id="audio-wpm-sync-status-pill" class="mono-num" style="font-size: 11px; font-weight: 800; color: var(--primary); min-width: 56px; text-align: right;">${currentDictationWpm || 80} WPM</span>
                  </div>
                </div>
              </div>

              <!-- Practice Tools: Pedal Rewind, A-B Loop, Pyramid Ramp, Voice Check -->
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                  <button type="button" class="btn btn-sm btn-secondary" style="padding: 4px 9px; font-size: 11px;" onclick="rewindAudioDictationByPedal(3)" title="Foot Pedal Rewind 3s (Alt+Left / F7)"><i class="fa-solid fa-rotate-left"></i> -3s</button>
                  <button type="button" class="btn btn-sm btn-secondary" style="padding: 4px 9px; font-size: 11px;" onclick="setAudioAbLoopPoint('A')">A: <span id="audio-ab-label-a" class="mono-num">--:--</span></button>
                  <button type="button" class="btn btn-sm btn-secondary" style="padding: 4px 9px; font-size: 11px;" onclick="setAudioAbLoopPoint('B')">B: <span id="audio-ab-label-b" class="mono-num">--:--</span></button>
                  <button type="button" id="audio-ab-clear-btn" class="btn btn-sm btn-danger hidden" style="padding: 4px 8px; font-size: 10.5px;" onclick="clearAudioAbLoop()">Clear</button>
                  <button type="button" class="btn btn-sm btn-secondary" style="padding: 4px 9px; font-size: 11px;" onclick="togglePyramidSpeedRampMode()">Pyramid: <strong id="pyramid-drill-status-label">OFF</strong></button>
                </div>
                <button type="button" class="btn btn-sm btn-secondary" style="padding: 4px 10px; font-size: 11px; font-weight: 700; color: #0284c7;" onclick="openVoiceReadbackSelfCheckModal('modal')">
                  <i class="fa-solid fa-microphone-lines"></i> Voice Readback
                </button>
              </div>
            </div>

            <!-- RIGHT CARD: Voice Synthesizer, Courtroom Acoustics & Custom Link / Recorder -->
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
                <span style="font-size: 13.5px; font-weight: 800; color: var(--secondary);">
                  <i class="fa-solid fa-sliders" style="color: var(--primary);"></i> 2. Voice Engine &amp; Hall Acoustics
                </span>
                <span id="tts-live-status-badge" style="font-size: 11px; font-weight: 700; color: #059669;">Voice Ready</span>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
                <select id="tts-voice-mode-select" onchange="handlePassageSynthSourceModeChange(this.value)" style="margin: 0; font-size: 12px; font-weight: 700; padding: 7px 10px;">
                  <option value="cloud_url" selected>Uploaded Cloud Audio (Admin Stream)</option>
                  <option value="human">Natural Human Voice (TTS)</option>
                  <option value="computer">Computer Precision Voice</option>
                  <option value="record_mic">Record Custom Dictation (Mic)</option>
                </select>
                <select id="tts-punctuation-pause-mode-select" onchange="window.customPunctuationDictationMode=this.value; showToast('Punctuation Mode: ' + this.options[this.selectedIndex].text);" style="margin: 0; padding: 7px 10px; font-size: 12px; font-weight: 700;">
                  <option value="off" ${(!window.customPunctuationDictationMode || window.customPunctuationDictationMode === 'off') ? 'selected' : ''}>Standard Flow (No Punctuation Cues)</option>
                  <option value="speak_punct" ${window.customPunctuationDictationMode === 'speak_punct' ? 'selected' : ''}>Speak Punctuation ("Comma", "Full Stop")</option>
                  <option value="pause_only" ${window.customPunctuationDictationMode === 'pause_only' ? 'selected' : ''}>Extra Clause Pauses</option>
                  <option value="speak_and_pause" ${window.customPunctuationDictationMode === 'speak_and_pause' ? 'selected' : ''}>Speak Punctuation + Clause Pauses</option>
                </select>
              </div>
              <select id="tts-wpm-speed-select" style="display: none;" onchange="setSyncedTargetWpmPace(this.value)">
                ${[40, 50, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 140, 150, 160, 180, 200, 220, 250].map(w => `<option value="${w}" ${(currentDictationWpm || 80) === w ? 'selected' : ''}>${w} WPM</option>`).join('')}
              </select>

              <!-- Acoustics + Multi-Speaker Grid -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
                <div style="background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 9px 11px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                    <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: var(--secondary); cursor: pointer; margin: 0;">
                      <input type="checkbox" id="exam-hall-noise-toggle" class="exam-hall-sound-chk" ${portalState.isExamHallSoundActive ? 'checked' : ''} onchange="toggleAudioExamHallNoiseMaster(this.checked)" style="width: 14px; height: 14px; accent-color: #d97706; margin: 0;">
                      <span>Hall Noise</span>
                    </label>
                    <select id="exam-hall-noise-volume-select" onchange="changeExamHallNoiseVolume(this.value)" style="margin: 0; padding: 2px 6px; font-size: 11px; width: 78px;">
                      <option value="0.4" ${window.examHallNoiseVolume === 0.4 ? 'selected' : ''}>Low Vol</option>
                      <option value="0.8" ${(!window.examHallNoiseVolume || window.examHallNoiseVolume === 0.8) ? 'selected' : ''}>Med Vol</option>
                      <option value="1.35" ${window.examHallNoiseVolume === 1.35 ? 'selected' : ''}>High Vol</option>
                    </select>
                  </div>
                  <select id="exam-hall-noise-profile-select" onchange="changeExamHallNoiseProfile(this.value)" style="margin: 0; padding: 4px 6px; font-size: 11px; width: 100%;">
                    <option value="full_mix" ${(window.examHallNoiseProfile || 'full_mix') === 'full_mix' ? 'selected' : ''}>Full Exam Hall Mix</option>
                    <option value="keys_only" ${window.examHallNoiseProfile === 'keys_only' ? 'selected' : ''}>Keyboards Clatter Only</option>
                    <option value="fan_hum" ${window.examHallNoiseProfile === 'fan_hum' ? 'selected' : ''}>Ceiling Fan &amp; AC</option>
                    <option value="cough_rustle" ${window.examHallNoiseProfile === 'cough_rustle' ? 'selected' : ''}>Footsteps &amp; Paper Rustle</option>
                  </select>
                </div>

                <div style="background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 9px 11px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: var(--secondary); cursor: pointer; margin: 0;">
                      <input type="checkbox" ${window.isMultiSpeakerDictationEnabled ? 'checked' : ''} onchange="toggleMultiSpeakerDictationMode(this.checked)" style="width: 14px; height: 14px; accent-color: #0284c7; margin: 0;">
                      <span>Multi-Speaker</span>
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: var(--secondary); cursor: pointer; margin: 0;">
                      <input type="checkbox" ${window.isVariableSpeedDictationEnabled ? 'checked' : ''} onchange="toggleVariableSpeedDictationMode(this.checked)" style="width: 14px; height: 14px; accent-color: #4f46e5; margin: 0;">
                      <span>±WPM Surge</span>
                    </label>
                    <span id="var-speed-live-readout-badge" style="font-size: 10px; font-weight: 700; color: var(--text-muted);">STEADY</span>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    <select id="var-speed-speaker-mode" onchange="window.varSpeedSpeakerMode=this.value; window.isMultiSpeakerDictationEnabled=(this.value!=='single'); updateVariableSpeedDictationConfig();" style="margin: 0; padding: 4px 6px; font-size: 11px;">
                      <option value="multi" ${(window.varSpeedSpeakerMode || 'multi') === 'multi' ? 'selected' : ''}>Parliament Dual</option>
                      <option value="dual_examiner" ${window.varSpeedSpeakerMode === 'dual_examiner' ? 'selected' : ''}>Indian English</option>
                      <option value="hindi_parliament" ${window.varSpeedSpeakerMode === 'hindi_parliament' ? 'selected' : ''}>Hindi / Bilingual</option>
                      <option value="single" ${window.varSpeedSpeakerMode === 'single' ? 'selected' : ''}>1-Speaker Steady</option>
                    </select>
                    <select id="var-speed-fluctuation-profile" onchange="updateVariableSpeedDictationConfig()" style="margin: 0; padding: 4px 6px; font-size: 11px;">
                      <option value="realistic_5" ${(window.varSpeedFluctuationProfile || 'realistic_5') === 'realistic_5' ? 'selected' : ''}>±5 WPM Hall</option>
                      <option value="court_10" ${window.varSpeedFluctuationProfile === 'court_10' ? 'selected' : ''}>±10 WPM Court</option>
                      <option value="progressive_ramp" ${window.varSpeedFluctuationProfile === 'progressive_ramp' ? 'selected' : ''}>+15 WPM Ramp</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Optional Custom Link & Mic Recorder Panels -->
              <div id="synth-cloud-url-panel" style="display: flex; flex-direction: column; gap: 6px; background: var(--background); padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <span id="synth-admin-cloud-status-text" style="font-size: 11.5px; font-weight: 700; color: #059669;">
                    ${effectiveInitialUrl ? `Admin Audio (${mediaInfo.label})` : 'Smart Voice Dictation Active'}
                  </span>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding: 3px 9px; font-size: 11px;" onclick="toggleOptionalCustomCloudUrlBox()">
                    <i class="fa-solid fa-link"></i> Custom Link
                  </button>
                </div>
                <div id="synth-custom-url-collapsible" style="display: none; flex-direction: column; gap: 6px; padding-top: 6px; border-top: 1px dashed var(--border);">
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <input type="text" id="synth-cloud-media-url-input" value="${effectiveInitialUrl.replace(/"/g, '&quot;')}" placeholder="https://youtu.be/... or Drive / MP3 / MP4 URL" style="flex: 1; min-width: 160px; margin: 0; padding: 5px 8px; font-size: 11.5px;">
                    <button type="button" class="btn btn-success btn-sm" onclick="loadAndPlayCloudMediaInSynthesizer(true, false)">Play Link</button>
                  </div>
                </div>
              </div>

              <div id="synth-record-mic-panel" style="display: none; flex-direction: column; gap: 6px; background: var(--background); padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                  <span style="font-size: 11.5px; font-weight: 700; color: #dc2626;"><i class="fa-solid fa-microphone"></i> Voice Recorder</span>
                  <span id="synth-mic-record-timer" class="mono-num" style="font-size: 11.5px; font-weight: 700;">00:00</span>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <button type="button" id="btn-synth-mic-start" class="btn btn-danger btn-sm" onclick="startSynthMicRecording()">Start Recording</button>
                  <button type="button" id="btn-synth-mic-stop" class="btn btn-secondary btn-sm" onclick="stopSynthMicRecording(false)" disabled>Stop &amp; Use</button>
                  <a id="btn-synth-mic-download" class="btn btn-secondary btn-sm" style="display: none; text-decoration: none;" download="rp-skill-dictation-recording.webm">Download</a>
                </div>
              </div>

              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary btn-sm" style="flex:1;" onclick="startTtsDictationSpeech()"><i class="fa-solid fa-play"></i> Speak Voice</button>
                <button type="button" class="btn btn-warning btn-sm" onclick="pauseOrResumeTtsDictationSpeech()"><i class="fa-solid fa-pause"></i> Pause</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="stopTtsDictationSpeech()"><i class="fa-solid fa-stop"></i> Stop</button>
              </div>
            </div>
          </div>

          <!-- SECTION 3: SHORTHAND NOTEBOOK PAD CAMERA CAPTURE & MENTOR/ADMIN UPLOAD -->
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
              <div style="display: flex; align-items: flex-start; gap: 11px;">
                <span style="width: 38px; height: 38px; border-radius: 10px; background: rgba(37,99,235,0.1); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
                  <i class="fa-solid fa-camera-retro"></i>
                </span>
                <div>
                  <div style="font-size: 13.5px; font-weight: 800; color: var(--secondary);">3. Shorthand Notebook Pad Photo Upload (For Monitor, Admin &amp; Superadmin Review)</div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Snap with your live camera or choose a photo from your device, then click <strong>Upload to Monitor &amp; Admin</strong>. Reviewers can inspect &amp; comment in Batch Hub and Admin Panel.</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary btn-sm" onclick="openShorthandPadCameraModal()" style="font-weight: 700;">
                  <i class="fa-solid fa-camera"></i> Open Live Camera
                </button>
                <label class="btn btn-secondary btn-sm" style="cursor: pointer; margin: 0; font-weight: 700;">
                  <i class="fa-solid fa-image"></i> Upload From Device
                  <input type="file" id="steno-pad-camera-input" accept="image/*" onchange="handleShorthandPadPhotoUpload(this)" style="display: none;">
                </label>
                <span id="shorthand-pad-upload-status" style="font-size: 11.5px; font-weight: 700; color: var(--text-muted);">${(window.__uploadedShorthandPadDataUrl || window.__uploadedShorthandPadPhotoDataUrl) ? 'Ready to upload' : 'No photo selected'}</span>
              </div>
            </div>

            <div id="shorthand-pad-preview-strip" style="display: ${(window.__uploadedShorthandPadDataUrl || window.__uploadedShorthandPadPhotoDataUrl) ? 'flex' : 'none'}; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; background: var(--background); padding: 12px; border-radius: 12px; border: 1px solid var(--border);">
              <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 240px;">
                <img id="shorthand-pad-preview-img" src="${window.__uploadedShorthandPadDataUrl || window.__uploadedShorthandPadPhotoDataUrl || ''}" onclick="openShorthandPadLightbox(this.src, 'Attached Shorthand Pad Preview')" style="height: 76px; width: auto; max-width: 120px; border-radius: 8px; border: 1px solid var(--border); object-fit: cover; cursor: zoom-in;" title="Click to zoom">
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <span id="steno-pad-photo-status-text" style="font-size: 12px; color: var(--secondary); font-weight: 700;">Shorthand notebook photo ready.</span>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <select id="shorthand-pad-diagnosis-tag" onchange="window.currentShorthandPadDiagnosis=this.value;" style="margin: 0; padding: 5px 8px; font-size: 11.5px; width: auto;">
                      <option value="Pending Mentor Review">Pending Mentor Review</option>
                      <option value="Outline Formation Issue">Outline Formation Issue</option>
                      <option value="Outline Misreading Issue">Outline Misreading Issue</option>
                      <option value="Vowel / Hook Omission">Vowel / Hook Omission</option>
                    </select>
                    <input type="text" id="shorthand-pad-student-note" class="form-control" placeholder="Optional note for Monitor / Admin..." style="flex: 1; min-width: 170px; margin: 0; padding: 5px 9px; font-size: 11.5px; min-height: 30px;">
                  </div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <button type="button" id="btn-upload-shorthand-pad-server" class="btn btn-success btn-sm" style="font-weight: 800; padding: 7px 14px;" onclick="uploadShorthandPadToServer()">
                  <i class="fa-solid fa-cloud-arrow-up"></i> Upload to Monitor &amp; Admin
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="clearShorthandPadPhotoUpload()">Clear</button>
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('active-test-modal').style.display = 'flex';
      if (typeof enterImmersiveFullscreenLock === 'function') enterImmersiveFullscreenLock('dictation-room');

      if (mediaInfo.isDrive) {
        tryLoadDriveAudioIntoElement(effectiveInitialUrl, 'stenoshala-dictation-audio');
      }

      if (window.rpAudioCacheManager && typeof window.rpAudioCacheManager.prepareAndPrebuffer === 'function') {
        window.rpAudioCacheManager.prepareAndPrebuffer(item, audioFileUrl, window.activeDictationTrackQueue, window.activeDictationTrackIndex);
      }

      const dictAudioEl = document.getElementById('stenoshala-dictation-audio');
      if (dictAudioEl) {
        if (typeof window.bindHtml5MediaClipBounds === 'function') {
          window.bindHtml5MediaClipBounds(dictAudioEl, activeTrack.startSec, activeTrack.endSec, () => {
            if (Array.isArray(window.activeDictationTrackQueue) && window.activeDictationTrackIndex + 1 < window.activeDictationTrackQueue.length) {
              switchDictationMergedTrack(window.activeDictationTrackIndex + 1, true);
            } else if (activeTrack.endSec !== null) {
              showToast(`⏹️ Reached dictation end time (${activeTrack.endLabel}).`);
            }
          });
        }
        dictAudioEl.addEventListener('loadedmetadata', () => {
          if (dictAudioEl.duration && isFinite(dictAudioEl.duration) && dictAudioEl.duration > 8) {
            window.detectedSourceAudioBaseWpm = detectBaseWpmFromAudioItem(item, dictAudioEl.duration);
            if (window.isAudioSpeedSyncedWithWpm !== false) {
              setSyncedTargetWpmPace(currentDictationWpm || 80);
            } else {
              updateSyncAudioWpmUI();
            }
          }
        });
        dictAudioEl.addEventListener('error', () => {
          const driveFb = document.getElementById('stenoshala-drive-mp3-fallback');
          if (driveFb) {
            driveFb.style.display = 'block';
          }
          dictAudioEl.dataset.useTtsFallback = 'true';
          const statusBadge = document.getElementById('stenoshala-audio-verify-status');
          if (statusBadge) {
            statusBadge.style.color = '#2563eb';
            statusBadge.innerHTML = `<i class="fa-solid fa-microphone-lines"></i> Ready with Smart Voice Dictation (${currentDictationWpm || 80} WPM) — Click Play`;
          }
        });
      }
      if (window.isAudioSpeedSyncedWithWpm !== false) {
        setSyncedTargetWpmPace(currentDictationWpm || 80);
      }
    
  try { portalHooks.emit('afterAudioDictationStart', ...arguments); } catch (_hk) {}
}

window.switchDictationMergedTrack = function(nextIdx, autoPlayNow = true) {
      const queue = Array.isArray(window.activeDictationTrackQueue) ? window.activeDictationTrackQueue : [];
      if (!queue.length) return;
      if (nextIdx < 0 || nextIdx >= queue.length) {
        showToast(nextIdx >= queue.length ? '✅ Completed all merged dictation tracks.' : 'Already at Part 1.');
        return;
      }
      window.activeDictationTrackIndex = nextIdx;
      const tr = queue[nextIdx];
      const mount = document.getElementById('stenoshala-dynamic-media-mount');
      const labelEl = document.getElementById('stenoshala-active-track-label');
      const clipBadge = document.getElementById('stenoshala-active-clip-badge');
      const statusBadge = document.getElementById('stenoshala-audio-verify-status');
      if (labelEl) labelEl.textContent = `Part ${nextIdx + 1} of ${queue.length}: ${tr.title || ('Part ' + (nextIdx + 1))}`;
      if (clipBadge) clipBadge.textContent = (tr.startSec !== null || tr.endSec !== null) ? `✂️ ${tr.startLabel || '00:00'} – ${tr.endLabel || 'End'}` : 'Full Track';

      const mediaInfo = classifyAndConvertVoiceMediaUrl(tr.url);
      const ytClipQuery = typeof window.buildYouTubeClipQueryParams === 'function'
        ? window.buildYouTubeClipQueryParams(tr.startSec, tr.endSec)
        : '';
      window.currentAdminAudioCloudUrl = tr.url;

      if (mount) {
        if (mediaInfo.isYouTube && mediaInfo.ytVideoId) {
          mount.innerHTML = `
            <iframe id="stenoshala-youtube-audio" data-yt-id="${mediaInfo.ytVideoId}" src="https://www.youtube.com/embed/${mediaInfo.ytVideoId}?autoplay=${autoPlayNow ? '1' : '0'}&enablejsapi=1&vq=tiny&playsinline=1&controls=0${ytClipQuery}&origin=${encodeURIComponent(window.location.origin)}" style="width:1px; height:1px; opacity:0; position:absolute; pointer-events:none; border:none;" allow="autoplay"></iframe>
            <div style="padding:10px 12px; border-radius:10px; background:var(--background); border:1px solid var(--border); font-size:12px; font-weight:700; color:var(--secondary); display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <span><i class="fa-brands fa-youtube" style="color:#dc2626;"></i> Part ${nextIdx + 1}/${queue.length}: YouTube Audio Stream</span>
              <span style="font-size:11px; color:#059669;">${autoPlayNow ? 'Playing' : 'Ready'}</span>
            </div>
          `;
        } else {
          mount.innerHTML = `
            <audio id="stenoshala-dictation-audio" controls preload="metadata" data-video-converted-to-audio="${mediaInfo.isVideoConverted ? 'true' : 'false'}" controlsList="nodownload" style="width:100%; height:40px;">
              <source src="${mediaInfo.streamUrl}">
            </audio>
            ${mediaInfo.isVideoConverted ? `<div style="margin-top:5px; font-size:11px; font-weight:700; color:#059669;"><i class="fa-solid fa-music"></i> Video URL playing in MP3 Audio-Only Mode</div>` : ''}
          `;
          if (mediaInfo.isDrive) tryLoadDriveAudioIntoElement(tr.url, 'stenoshala-dictation-audio');
          const el = document.getElementById('stenoshala-dictation-audio');
          if (el) {
            if (typeof window.bindHtml5MediaClipBounds === 'function') {
              window.bindHtml5MediaClipBounds(el, tr.startSec, tr.endSec, () => {
                if (window.activeDictationTrackIndex + 1 < queue.length) {
                  window.switchDictationMergedTrack(window.activeDictationTrackIndex + 1, true);
                } else {
                  showToast('✅ All merged audio tracks finished!');
                }
              });
            }
            if (window.isAudioSpeedSyncedWithWpm !== false) setSyncedTargetWpmPace(currentDictationWpm || 80);
            if (autoPlayNow) el.play().catch(() => {});
          }
        }
      }
      if (statusBadge) {
        statusBadge.style.color = '#059669';
        statusBadge.innerHTML = `<i class="fa-solid fa-layer-group"></i> Part ${nextIdx + 1}/${queue.length} Loaded`;
      }
    };

export let synthMediaRecorder = null;

export let synthRecordedChunks = [];

export let synthRecordInterval = null;

export let synthRecordSeconds = 0;

window.lastRecordedSynthAudioBlobUrl = '';

export function toggleOptionalCustomCloudUrlBox() {
      const box = document.getElementById('synth-custom-url-collapsible');
      if (!box) return;
      const isHidden = box.style.display === 'none' || !box.style.display;
      box.style.display = isHidden ? 'flex' : 'none';
    }

export function handlePassageSynthSourceModeChange(mode) {
      const cloudPanel = document.getElementById('synth-cloud-url-panel');
      const micPanel = document.getElementById('synth-record-mic-panel');
      if (cloudPanel) cloudPanel.style.display = mode === 'cloud_url' ? 'flex' : 'none';
      if (micPanel) micPanel.style.display = mode === 'record_mic' ? 'flex' : 'none';
      const statusBadge = document.getElementById('tts-live-status-badge');
      if (statusBadge) {
        const labels = {
          human: 'Human Voice Ready',
          computer: 'Computer Voice Ready',
          cloud_url: 'Playing Admin Cloud Audio',
          record_mic: 'Mic Recorder Ready'
        };
        statusBadge.innerText = labels[mode] || 'Ready';
      }
      // When user selects Uploaded Cloud Audio, immediately play the Admin's pasted link without asking to paste
      if (mode === 'cloud_url') {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        loadAndPlayCloudMediaInSynthesizer(true, true);
      }
    }

export function loadAndPlayCloudMediaInSynthesizer(autoPlayNow = true, preferAdminUrl = false) {
      const urlInp = document.getElementById('synth-cloud-media-url-input');
      const customTypedUrl = urlInp ? urlInp.value.trim() : '';
      const rawUrl = preferAdminUrl
        ? (window.currentAdminAudioCloudUrl || customTypedUrl || window.lastRecordedSynthAudioBlobUrl || '')
        : (customTypedUrl || window.currentAdminAudioCloudUrl || window.lastRecordedSynthAudioBlobUrl || '');

      if (!rawUrl) {
        // Fallback to existing playable media element if mounted, otherwise directly use Speech Synthesis
        // (avoids bouncing back into cloud_url mode and overflowing the call stack).
        const ytIframe = document.getElementById('stenoshala-youtube-audio');
        const dictAudio = document.getElementById('stenoshala-dictation-audio');
        const hasPlayableEl = Boolean(ytIframe) || Boolean(
          dictAudio && !dictAudio.dataset.useTtsFallback && (
            /^https?:\/\//i.test((dictAudio.querySelector('source')?.getAttribute('src') || dictAudio.getAttribute('src') || '')) ||
            (dictAudio.querySelector('source')?.getAttribute('src') || dictAudio.getAttribute('src') || '').startsWith('data:audio') ||
            (dictAudio.querySelector('source')?.getAttribute('src') || dictAudio.getAttribute('src') || '').startsWith('blob:')
          )
        );
        if (hasPlayableEl) {
          playOrVerifyStenoshalaDictationAudio('play');
        } else if (autoPlayNow) {
          startTtsDictationSpeech({ forceSpeechSynthesis: true });
        }
        return;
      }

      const mediaInfo = classifyAndConvertVoiceMediaUrl(rawUrl);
      if (!mediaInfo.isValidMedia) {
        showToast('⚠️ Invalid URL. Paste a valid https:// link from YouTube, Drive, GitHub, Supabase, or direct audio/video.');
        return;
      }

      const mount = document.getElementById('stenoshala-dynamic-media-mount');
      const verifyBadge = document.getElementById('stenoshala-audio-verify-status');
      const synthBadge = document.getElementById('tts-live-status-badge');
      const adminCloudText = document.getElementById('synth-admin-cloud-status-text');

      if (adminCloudText) {
        const isAdminSource = rawUrl === window.currentAdminAudioCloudUrl;
        adminCloudText.innerText = isAdminSource
          ? `Playing Admin's Uploaded Cloud Audio (${mediaInfo.label})`
          : `Playing Custom Cloud Audio (${mediaInfo.label})`;
      }
      if (verifyBadge) {
        verifyBadge.style.color = '#059669';
        verifyBadge.innerHTML = `<i class="fa-solid fa-wave-square"></i> ${mediaInfo.label}`;
      }
      if (synthBadge) {
        synthBadge.style.color = '#059669';
        synthBadge.innerText = mediaInfo.isVideoConverted ? '🎬→🔊 Video Converted to Audio' : '🔊 Cloud Audio Playing';
      }

      if (mount) {
        if (mediaInfo.isYouTube && mediaInfo.ytVideoId) {
          mount.innerHTML = `
            <iframe id="stenoshala-youtube-audio" data-yt-id="${mediaInfo.ytVideoId}" src="https://www.youtube.com/embed/${mediaInfo.ytVideoId}?autoplay=${autoPlayNow ? '1' : '0'}&enablejsapi=1&vq=tiny&playsinline=1&controls=0&origin=${encodeURIComponent(window.location.origin)}" style="width:1px; height:1px; opacity:0; position:absolute; pointer-events:none; border:none;" allow="autoplay"></iframe>
            <div style="padding:10px 12px; border-radius:8px; background:rgba(220,38,38,0.08); border:1px solid rgba(220,38,38,0.25); font-size:12px; font-weight:700; color:var(--secondary); display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <span><i class="fa-brands fa-youtube" style="color:#dc2626;"></i> YouTube Video Auto-Converted to Audio Stream</span>
              <span style="font-size:11px; color:#059669; font-weight:800;">${autoPlayNow ? 'Playing Audio Now' : 'Ready — Click Play'}</span>
            </div>
          `;
        } else {
          mount.innerHTML = `
            <audio id="stenoshala-dictation-audio" controls preload="metadata" data-video-converted-to-audio="${mediaInfo.isVideoConverted ? 'true' : 'false'}" controlsList="nodownload" oncontextmenu="return false;" style="width:100%; height:38px;" src="${mediaInfo.streamUrl}"></audio>
            ${mediaInfo.isVideoConverted ? `
              <div style="margin-top:5px; font-size:11px; font-weight:700; color:#059669;"><i class="fa-solid fa-music"></i> Video URL playing strictly in MP3 Audio-Only Mode</div>
            ` : ''}
          `;
          const audioEl = document.getElementById('stenoshala-dictation-audio');
          if (audioEl) {
            audioEl.onerror = () => {
              if (mediaInfo.isDrive) tryLoadDriveAudioIntoElement(rawUrl, 'stenoshala-dictation-audio');
            };
            if (window.isAudioSpeedSyncedWithWpm !== false) {
              setSyncedTargetWpmPace(currentDictationWpm || 80);
            }
            if (autoPlayNow) {
              audioEl.play().catch(() => {});
            }
          }
        }
      }

      showToast(autoPlayNow ? `🔊 Playing ${mediaInfo.label}` : `✅ Loaded ${mediaInfo.label} — Click Play to start!`);
    }

export async function startSynthMicRecording() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('⚠️ Microphone recording is not supported in this browser.');
        return;
      }
      try {
        stopSynthMicRecording(true);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        synthRecordedChunks = [];
        synthMediaRecorder = new MediaRecorder(stream);
        synthMediaRecorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) synthRecordedChunks.push(e.data);
        };
        synthMediaRecorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          if (synthRecordedChunks.length === 0) return;
          const blob = new Blob(synthRecordedChunks, { type: 'audio/webm' });
          if (window.lastRecordedSynthAudioBlobUrl) {
            try { URL.revokeObjectURL(window.lastRecordedSynthAudioBlobUrl); } catch (e) {}
          }
          const blobUrl = URL.createObjectURL(blob);
          window.lastRecordedSynthAudioBlobUrl = blobUrl;

          const dlBtn = document.getElementById('btn-synth-mic-download');
          if (dlBtn) {
            dlBtn.href = blobUrl;
            dlBtn.style.display = 'inline-flex';
          }
          const urlInp = document.getElementById('synth-cloud-media-url-input');
          if (urlInp) urlInp.value = blobUrl;

          const mount = document.getElementById('stenoshala-dynamic-media-mount');
          if (mount) {
            mount.innerHTML = `
              <audio id="stenoshala-dictation-audio" controls preload="metadata" style="width:100%; height:38px;">
                <source src="${blobUrl}" type="audio/webm">
              </audio>
            `;
          }
          const statusBadge = document.getElementById('tts-live-status-badge');
          if (statusBadge) {
            statusBadge.style.color = '#059669';
            statusBadge.innerText = '🎙️ Recorded Audio Ready';
          }
          showToast('🎙️ Recording saved! Click Play to listen or Download to upload to YouTube/Drive/GitHub/Supabase.');
        };

        synthMediaRecorder.start();
        synthRecordSeconds = 0;
        const timerEl = document.getElementById('synth-mic-record-timer');
        if (timerEl) timerEl.innerText = '00:00';
        if (synthRecordInterval) clearInterval(synthRecordInterval);
        synthRecordInterval = setInterval(() => {
          synthRecordSeconds++;
          const m = String(Math.floor(synthRecordSeconds / 60)).padStart(2, '0');
          const s = String(synthRecordSeconds % 60).padStart(2, '0');
          if (timerEl) timerEl.innerText = `${m}:${s}`;
        }, 1000);

        const startBtn = document.getElementById('btn-synth-mic-start');
        const stopBtn = document.getElementById('btn-synth-mic-stop');
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        const statusBadge = document.getElementById('tts-live-status-badge');
        if (statusBadge) {
          statusBadge.style.color = '#dc2626';
          statusBadge.innerText = '🔴 Recording Mic...';
        }
        showToast('🎙️ Microphone recording started...');
      } catch (err) {
        showToast('⚠️ Could not access microphone. Please allow mic permissions.');
      }
    }

export function stopSynthMicRecording(silentAbort = false) {
      if (synthRecordInterval) {
        clearInterval(synthRecordInterval);
        synthRecordInterval = null;
      }
      if (synthMediaRecorder && synthMediaRecorder.state !== 'inactive') {
        if (silentAbort) {
          synthRecordedChunks = [];
        }
        try { synthMediaRecorder.stop(); } catch (e) {}
      }
      const startBtn = document.getElementById('btn-synth-mic-start');
      const stopBtn = document.getElementById('btn-synth-mic-stop');
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
    }

export let pendingTranscriptionSourceType = 'audio';

export function closeTranscribeExamSelector() {
      const modal = document.getElementById('transcribe-exam-select-modal');
      if (modal) modal.style.display = 'none';
    }

export let currentDictationWpm = 80;

export let activeTtsUtterance = null;

export function startTtsDictationSpeech(options = {}) {
      const forceSpeechSynthesis = Boolean(options && options.forceSpeechSynthesis);
      const skipAutoBeep = Boolean(options && options.skipAutoBeep);
      const modeSelect = document.getElementById('tts-voice-mode-select');
      const wpmSelect = document.getElementById('tts-wpm-speed-select');
      const statusBadge = document.getElementById('tts-live-status-badge');

      const voiceMode = modeSelect ? modeSelect.value : 'human';
      const targetWpm = Math.max(40, Math.min(250, wpmSelect ? (parseInt(wpmSelect.value) || 80) : (currentDictationWpm || 80)));
      currentDictationWpm = targetWpm;

      if (!skipAutoBeep) {
        playPreAudioStartAutoBeep(() => {
          startTtsDictationSpeech({ forceSpeechSynthesis, skipAutoBeep: true });
        });
        return;
      }

      // Mode 3: Uploaded Cloud Audio / Video URL (YouTube, Google Drive, GitHub, Supabase, MP4/MP3 -> Audio)
      if (voiceMode === 'cloud_url' && !forceSpeechSynthesis) {
        const urlInp = document.getElementById('synth-cloud-media-url-input');
        const hasCloudMediaUrl = Boolean(
          (urlInp && urlInp.value.trim()) ||
          window.currentAdminAudioCloudUrl ||
          window.lastRecordedSynthAudioBlobUrl
        );
        if (hasCloudMediaUrl) {
          if ('speechSynthesis' in window) window.speechSynthesis.cancel();
          loadAndPlayCloudMediaInSynthesizer(true);
          return;
        }
      }

      // Mode 4: Recorded Mic Audio
      if (voiceMode === 'record_mic') {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        if (window.lastRecordedSynthAudioBlobUrl) {
          const audioEl = document.getElementById('stenoshala-dictation-audio');
          if (audioEl) {
            setSyncedTargetWpmPace(targetWpm);
            audioEl.play().catch(() => {});
            if (statusBadge) {
              statusBadge.style.color = '#10b981';
              statusBadge.innerText = `🔊 Playing Recorded Audio (${targetWpm} WPM)`;
            }
            showToast(`🔊 Playing your recorded audio at ${targetWpm} WPM`);
            return;
          }
        }
        showToast('🎙️ Click "Start Recording" first to record your voice dictation.');
        return;
      }

      if (!('speechSynthesis' in window)) {
        showToast('Speech Synthesis is not supported in this browser.');
        return;
      }
      const rawPassage = (portalState.currentReferenceText || '').trim();
      if (!rawPassage) {
        showToast('No master passage text found for auto-generating voice dictation.');
        return;
      }
      window.speechSynthesis.cancel();

      const punctModeSel = document.getElementById('tts-punctuation-pause-mode-select');
      const punctPauseMode = punctModeSel ? punctModeSel.value : (window.customPunctuationDictationMode || 'off');
      window.customPunctuationDictationMode = punctPauseMode;

      const formatPassageForPunctuationMode = (txt) => {
        let out = String(txt || '');
        if (punctPauseMode === 'speak_punct' || punctPauseMode === 'speak_and_pause') {
          out = out
            .replace(/\n\s*\n/g, ' ... new paragraph ... ')
            .replace(/,/g, ' comma ')
            .replace(/\./g, ' full stop ')
            .replace(/\?/g, ' question mark ')
            .replace(/;/g, ' semicolon ');
        }
        if (punctPauseMode === 'pause_only' || punctPauseMode === 'speak_and_pause') {
          out = out
            .replace(/,/g, ', ... ')
            .replace(/\./g, '. ... ... ');
        }
        return out;
      };
      const passage = formatPassageForPunctuationMode(rawPassage);

      const voices = window.speechSynthesis.getVoices() || [];
      const enVoices = voices.filter(v => String(v.lang || '').toLowerCase().startsWith('en'));
      const isMultiSpeaker = Boolean(window.isMultiSpeakerDictationEnabled || (window.varSpeedSpeakerMode && window.varSpeedSpeakerMode !== 'single'));
      const speakerBadge = document.getElementById('var-speed-live-readout-badge');

      // 👉 Requirement #1: Multi-Speaker Courtroom & Exam-Hall Sentence-by-Sentence Voice Simulation
      if (isMultiSpeaker) {
        const sentences = passage.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [passage];
        const roles = window.varSpeedSpeakerMode === 'dual_examiner'
          ? [
              { label: '🎙️ Chief Examiner', pitch: 0.96, speedDelta: 0, voiceIdx: 0 },
              { label: '🗣️ Co-Reader', pitch: 1.10, speedDelta: 4, voiceIdx: 1 }
            ]
          : [
              { label: '⚖️ Judge', pitch: 0.88, speedDelta: -4, voiceIdx: 0 },
              { label: '🗣️ Counsel', pitch: 1.04, speedDelta: +6, voiceIdx: 1 },
              { label: '👤 Witness', pitch: 1.14, speedDelta: +2, voiceIdx: 2 }
            ];

        sentences.forEach((rawSeg, idx) => {
          const segText = String(rawSeg || '').trim();
          if (!segText) return;
          const role = roles[idx % roles.length];
          const segWpm = Math.max(40, Math.min(250, targetWpm + (window.isVariableSpeedDictationEnabled ? role.speedDelta : 0)));
          const segUtter = new SpeechSynthesisUtterance(segText);
          if (enVoices.length > 0) {
            segUtter.voice = enVoices[role.voiceIdx % enVoices.length] || enVoices[0];
          }
          segUtter.pitch = role.pitch;
          segUtter.rate = Math.max(0.45, Math.min(3.15, Number((segWpm / 80).toFixed(2))));

          segUtter.onstart = () => {
            if (statusBadge) {
              statusBadge.style.color = '#10b981';
              statusBadge.innerText = `${role.label} @ ${segWpm} WPM`;
            }
            if (speakerBadge) {
              speakerBadge.innerText = `${role.label} • ${segWpm} WPM`;
              speakerBadge.style.background = '#4f46e5';
              speakerBadge.style.color = '#fff';
            }
          };
          if (idx === sentences.length - 1) {
            segUtter.onend = () => {
              if (statusBadge) {
                statusBadge.style.color = '#2563eb';
                statusBadge.innerText = '✅ Multi-Speaker Dictation Completed';
              }
            };
          }
          window.speechSynthesis.speak(segUtter);
        });
        logPortalAction('AUTO_GENERATE_AUDIO_TTS', `Started Multi-Speaker Courtroom dictation at ${targetWpm} WPM`);
        showToast(`⚖️ Multi-Speaker Courtroom Dictation active (${targetWpm} WPM)`);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(passage);
      if (enVoices.length > 0) {
        if (voiceMode === 'human') {
          const naturalVoice = enVoices.find(v => /natural|neural|google|online|premium|india|uk/i.test(v.name)) || enVoices[0];
          utterance.voice = naturalVoice;
          utterance.pitch = 1.02;
        } else {
          const computerVoice = enVoices.find(v => !/natural|neural|online/i.test(v.name)) || enVoices[enVoices.length - 1];
          utterance.voice = computerVoice;
          utterance.pitch = 0.92;
        }
      }

      utterance.rate = Math.max(0.45, Math.min(3.15, Number((targetWpm / 80).toFixed(2))));

      utterance.onstart = () => {
        if (statusBadge) {
          statusBadge.style.color = '#10b981';
          statusBadge.innerText = `🔊 Speaking (${voiceMode === 'human' ? 'Human' : 'Computer'} @ ${targetWpm} WPM)`;
        }
      };
      utterance.onend = () => {
        if (statusBadge) {
          statusBadge.style.color = '#2563eb';
          statusBadge.innerText = '✅ Dictation Completed';
        }
      };
      utterance.onerror = () => {
        if (statusBadge) {
          statusBadge.style.color = '#64748b';
          statusBadge.innerText = 'Stopped';
        }
      };

      activeTtsUtterance = utterance;
      window.speechSynthesis.speak(utterance);
      logPortalAction('AUTO_GENERATE_AUDIO_TTS', `Started ${voiceMode.toUpperCase()} voice dictation at ${targetWpm} WPM`);
      showToast(`🎙️ Speaking passage in ${voiceMode === 'human' ? 'Natural Human' : 'Computer'} Voice at ${targetWpm} WPM`);
    }

export function pauseOrResumeTtsDictationSpeech() {
      const modeSelect = document.getElementById('tts-voice-mode-select');
      const voiceMode = modeSelect ? modeSelect.value : 'human';
      if (voiceMode === 'cloud_url' || voiceMode === 'record_mic') {
        const audioEl = document.getElementById('stenoshala-dictation-audio');
        if (audioEl) {
          if (audioEl.paused) {
            audioEl.play().catch(() => {});
          } else {
            audioEl.pause();
          }
          return;
        }
      }

      if (!('speechSynthesis' in window)) return;
      const statusBadge = document.getElementById('tts-live-status-badge');
      if (window.speechSynthesis.speaking) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          if (statusBadge) statusBadge.innerText = `🔊 Resumed (${currentDictationWpm} WPM)`;
          showToast('▶️ Voice Dictation Resumed');
        } else {
          window.speechSynthesis.pause();
          if (statusBadge) statusBadge.innerText = '⏸️ Paused';
          showToast('⏸️ Voice Dictation Paused');
        }
      } else {
        startTtsDictationSpeech();
      }
    }

export function stopTtsDictationSpeech() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      const audioEl = document.getElementById('stenoshala-dictation-audio');
      if (audioEl) {
        try {
          audioEl.pause();
          audioEl.currentTime = 0;
        } catch (e) {}
      }
      sendYouTubeAudioCommand('pauseVideo');
      const statusBadge = document.getElementById('tts-live-status-badge');
      if (statusBadge) {
        statusBadge.style.color = '#64748b';
        statusBadge.innerText = 'Stopped';
      }
    }

export function confirmExamAndStartTranscription() {
      const select = document.getElementById('transcribe-exam-dropdown') || document.getElementById('transcribe-exam-rule-dropdown');
      const selectedRuleKey = select ? select.value : '';
      const rules = selectedRuleKey ? getEvaluationRulesForTab(selectedRuleKey) : null;
      if (!selectedRuleKey || !rules) {
        showToast('No evaluation rule is there');
        return;
      }
      closeTranscribeExamSelector();

      stopTtsDictationSpeech();
      const dictAudio = document.getElementById('stenoshala-dictation-audio');
      if (dictAudio) dictAudio.pause();
      sendYouTubeAudioCommand('pauseVideo');

      if (pendingTranscriptionSourceType === 'pitman' && window.pendingPitmanDirectLaunch && portalState.pendingAudioDictationItem) {
        window.pendingPitmanDirectLaunch = false;
        startPitmanTest(portalState.pendingAudioDictationItem, selectedRuleKey);
        return;
      }
      if (typeof enterImmersiveFullscreenLock === 'function') {
        enterImmersiveFullscreenLock('active-test-modal');
      }

      portalState.activeTestSubtabKey = selectedRuleKey;
      window.currentExamRules = rules;
      const ruleDisplay = rules.examDisplayName || rules.examTitle || selectedRuleKey;

      const item = portalState.pendingAudioDictationItem;
      const baseTitle = item ? item.Title : portalState.currentExamName;
      const prefixLabel = pendingTranscriptionSourceType === 'pitman' ? 'Pitman' : 'Audio Dictation';
      window.lastOriginTabBeforeTest = pendingTranscriptionSourceType === 'pitman' ? 'pitman' : 'audio';
      window.isCountUpTimerMode = false;
      // 👉 REQUIREMENT #5: Store distinct Exam Rule Title and Passage Title
      window.currentActiveExamRuleTitle = ruleDisplay;
      window.currentActivePassageTitle = baseTitle;
      portalState.currentExamName = `${prefixLabel}: ${baseTitle} [${ruleDisplay}]`;
      portalState.testDurationMinutes = parseInt(rules.timeLimit) || 10;
      if (window.activeScheduledLiveTestEndTime && Date.now() < window.activeScheduledLiveTestEndTime) {
        portalState.testDurationMinutes = Math.max(1, Math.round((window.activeScheduledLiveTestEndTime - Date.now()) / 60000));
      }
      portalState.testBackspaces = 0;
      portalState.testStartTime = Date.now();
      portalState.isTestPaused = false;
      portalState.isTypingTimerStarted = false;

      const titleEl = document.getElementById('test-modal-title');
      if (titleEl) titleEl.innerText = portalState.currentExamName;
      const timerEl = document.getElementById('test-timer') || document.getElementById('test-timer-display');
      if (timerEl) timerEl.innerText = `${String(portalState.testDurationMinutes).padStart(2, '0')}:00`;

      configureActiveTestModalChrome(pendingTranscriptionSourceType === 'pitman' ? 'pitman_transcription' : 'audio_transcription');

      if (portalState.currentReferenceText) {
        portalState.currentReferenceText = preparePassageForInitialWordsRule(portalState.currentReferenceText, rules);
      }

      updateTestSubmitMinTimeLockUI(0);

      if (pendingTranscriptionSourceType === 'pitman' && document.getElementById('test-pitman-img')) {
        updateLiveTypingStatusBar('Ready - Pitman Exam Rule Applied');
        const inputEl = document.getElementById('test-user-input');
        if (inputEl) {
          inputEl.value = '';
          inputEl.style.fontSize = (rules.defaultTextSize || 16) + 'px';
          inputEl.focus();
        }
        startTestTimer(portalState.testDurationMinutes * 60);
        showToast(`Pitman Exam Rule applied: ${ruleDisplay}`);
        return;
      }

      const refWordsTotal = countMasterPassageWords(window.fullMasterPassageText || portalState.currentReferenceText);
      const bsRuleBadge = rules.backspaceMode === 'until_space'
        ? 'UNTIL SPACEBAR ONLY'
        : (rules.backspaceMode === 'limited' ? `LIMITED (${rules.backspaceLimit || 15})` : (rules.backspaceMode || 'on').toUpperCase());

      // Compact Step 2 Transcription Desk: razor-slim 1-line header + full-screen typing area
      const mainBody = document.getElementById('test-main-body-container');
      mainBody.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 1280px; margin: 0 auto; flex: 1; min-height: 0;">
          <div id="step2-transcription-meta-banner" style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: nowrap; flex-shrink: 0;">
            <span style="font-size: 11.5px; font-weight: 700; color: var(--secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">
              <i class="fa-solid fa-scale-balanced" style="color: var(--primary);"></i> ${ruleDisplay} · ${refWordsTotal}w · ${portalState.testDurationMinutes}m · BS: ${bsRuleBadge}
            </span>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 11px; min-height: 24px; white-space: nowrap; flex-shrink: 0;" onclick="if(pendingAudioDictationItem) startAudioDictationTestById(pendingAudioDictationItem.ID || pendingAudioDictationItem.id)">
              <i class="fa-solid fa-arrow-left"></i> Audio Room
            </button>
          </div>
          <textarea id="test-user-input" 
                    class="form-control" 
                    spellcheck="false" 
                    autocorrect="off" 
                    autocapitalize="off" 
                    autocomplete="off" 
                    style="width: 100%; flex: 1; min-height: clamp(280px, 66vh, 720px); resize: none; font-family: 'Segoe UI', monospace; padding: 14px; border-radius: 10px; font-size: ${(rules.defaultTextSize || 16)}px; line-height: 1.7; background: var(--surface);" 
                    placeholder="Start typing your shorthand transcription here (Auto-submits at 00:00)..." 
                    oninput="handleTestInput()" 
                    onkeydown="handleTestKeyDown(event)" 
                    onpaste="handleTestPaste(event)" 
                    oncopy="handleTestCopy(event)" 
                    oncut="handleTestCut(event)"></textarea>
        </div>
      `;

      const initTransFontSize = parseInt(rules.defaultTextSize, 10) || 16;
      portalState.currentTestFontSize = initTransFontSize;
      portalState.currentPassageFontSize = initTransFontSize;
      document.documentElement.style.setProperty('--test-active-font-size', initTransFontSize + 'px');
      document.documentElement.style.setProperty('--mobile-test-font-size', initTransFontSize + 'px');
      const initTransInput = document.getElementById('test-user-input');
      if (initTransInput) initTransInput.style.setProperty('font-size', initTransFontSize + 'px', 'important');

      const fontSizeBadge = document.getElementById('test-header-font-size-badge');
      if (fontSizeBadge) fontSizeBadge.textContent = initTransFontSize + 'px';

      updateLiveTypingStatusBar('Ready - Evaluation Rule Applied');
      if (typeof window.resetActiveTestKeystrokeTelemetry === 'function') {
        window.resetActiveTestKeystrokeTelemetry();
      }
      // Auto-fetch Reading Time from Admin Evaluation Rule (with Skip option to start test immediately)
      triggerRuleReadingTimeBeforeTest(rules, () => {
        portalState.isTypingTimerStarted = true;
        portalState.testStartTime = Date.now();
        if (typeof window.resetActiveTestKeystrokeTelemetry === 'function') {
          window.resetActiveTestKeystrokeTelemetry();
        }
        startTestTimer(portalState.testDurationMinutes * 60);
        updateLiveTypingStatusBar('Countdown Active - Type Transcription');
        const inputEl = document.getElementById('test-user-input');
        if (inputEl) {
          inputEl.disabled = false;
          inputEl.placeholder = 'Start typing your shorthand transcription here (Live countdown timer is running and auto-submits at 00:00)...';
          inputEl.focus();
        }
        showToast(`⏱️ Stenography Transcription Timer Started (${portalState.testDurationMinutes}:00) — Rule: ${ruleDisplay}`);
      });
    
  try { portalHooks.emit('afterTranscriptionConfirmed', ...arguments); } catch (_hk) {}
}

export function getActiveEvaluationRules(subtabName, categoryType) {
      const cleanSubtab = subtabName ? subtabName.replace(/[^a-zA-Z0-9_]/g, '_') : 'General';
      const specificKey = `${categoryType}_${cleanSubtab}`;
      return portalState.allEvaluationRules[specificKey] || 
             portalState.allEvaluationRules[subtabName] ||
             portalState.allEvaluationRules[categoryType] || 
             null;
    }

export function adjustTestFontSize(amount) {
      const userInput = document.getElementById('test-user-input');
      const passageElem = document.getElementById('test-material-passage-text');
      const refDisplayElem = document.getElementById('test-reference-display');
      const badge = document.getElementById('test-header-font-size-badge');
      const rules = (typeof getEvaluationRulesForTab === 'function' && portalState.activeTestSubtabKey) ? (getEvaluationRulesForTab(portalState.activeTestSubtabKey) || {}) : {};
      const defaultSize = parseInt(rules.defaultTextSize, 10) || 16;
      const baseEl = userInput || passageElem || refDisplayElem;
      const badgeSize = badge ? parseInt(badge.textContent, 10) : NaN;
      let currentSize = Number(portalState.currentTestFontSize)
        || (isFinite(badgeSize) ? badgeSize : 0)
        || (baseEl ? (parseInt(window.getComputedStyle(baseEl).fontSize, 10) || defaultSize) : defaultSize);
      const delta = Number(amount) || 0;
      const newSize = delta === 0 ? defaultSize : Math.max(12, Math.min(36, currentSize + delta));

      portalState.currentTestFontSize = newSize;
      portalState.currentPassageFontSize = newSize;
      document.documentElement.style.setProperty('--test-active-font-size', newSize + 'px');
      document.documentElement.style.setProperty('--mobile-test-font-size', newSize + 'px');
      const modalRoot = document.getElementById('active-test-modal');
      if (modalRoot) {
        modalRoot.style.setProperty('--test-active-font-size', newSize + 'px');
        modalRoot.style.setProperty('--mobile-test-font-size', newSize + 'px');
      }

      if (userInput) userInput.style.setProperty('font-size', newSize + 'px', 'important');
      if (passageElem) passageElem.style.setProperty('font-size', newSize + 'px', 'important');
      if (refDisplayElem) refDisplayElem.style.setProperty('font-size', newSize + 'px', 'important');
      if (badge) badge.textContent = newSize + 'px';
    }

portalState.currentPassageFontSize = 15;

export function adjustPassageZoom(amount) {
      adjustTestFontSize(amount);
    }

export function resetPassageZoom() {
      adjustTestFontSize(0);
    }

portalState.variableSpeedIntervalId = null;

window.isVariableSpeedDictationEnabled = false;

window.varSpeedFluctuationProfile = 'realistic_5';

window.varSpeedSpeakerMode = 'multi';

export function toggleExamHallNoiseSimulator(isChecked) {
      const badge = document.getElementById('exam-hall-noise-status-badge');
      if (isChecked) {
        updateExamHallNoiseSettings();
        const ok = startExamHallSynth();
        if (badge) {
          badge.innerText = ok ? 'ACTIVE' : 'OFF';
          badge.style.background = ok ? '#10b981' : 'var(--background)';
          badge.style.color = ok ? '#fff' : 'var(--text-muted)';
        }
        if (ok) showToast('🔊 Courtroom & Exam-Hall Multi-Speaker Audio Simulator ON');
      } else {
        stopExamHallSynth();
        if (badge) {
          badge.innerText = 'OFF';
          badge.style.background = 'var(--background)';
          badge.style.color = 'var(--text-muted)';
        }
        showToast('🔇 Courtroom & Exam-Hall Audio Simulator OFF');
      }
    }

export function updateExamHallNoiseSettings() {
      const profSel = document.getElementById('exam-hall-noise-profile-select');
      const volSel = document.getElementById('exam-hall-noise-volume-select');
      if (profSel) {
        const val = profSel.value;
        if (val === 'court_room' || val === 'cross_exam') {
          window.examHallNoiseProfile = 'cough_rustle';
        } else if (val === 'typing_only') {
          window.examHallNoiseProfile = 'keys_only';
        } else {
          window.examHallNoiseProfile = 'full_mix';
        }
        window.courtroomAcousticPreset = val;
      }
      if (volSel) {
        const vFloat = parseFloat(volSel.value) || 0.7;
        window.examHallNoiseVolumePct = Math.round(Math.min(100, Math.max(10, vFloat * 75)));
      }
      if (portalState.isExamHallSoundActive) {
        startExamHallSynth();
      }
    }

export function previewCourtroomExamHallSimulation() {
      updateExamHallNoiseSettings();
      updateVariableSpeedDictationConfig();
      const profSel = document.getElementById('exam-hall-noise-profile-select');
      const spkSel = document.getElementById('var-speed-speaker-mode');
      const envVal = profSel ? profSel.value : 'ssc_hall';
      const spkVal = spkSel ? spkSel.value : 'multi';

      const ok = startExamHallSynth();
      if (ok && portalState.examHallAudioCtx) {
        for (let i = 0; i < 6; i++) {
          setTimeout(() => {
            if (portalState.examHallAudioCtx) triggerExamHallKeyClick(portalState.examHallAudioCtx, 0.9 + Math.random() * 0.35);
          }, i * 160);
        }
        if (envVal === 'court_room' || envVal === 'cross_exam' || envVal === 'parliament_floor') {
          setTimeout(() => {
            if (portalState.examHallAudioCtx && typeof window.triggerExamHallPaperRustle === 'function') {
              window.triggerExamHallPaperRustle(portalState.examHallAudioCtx, 1.0);
            }
          }, 300);
        }
      }

      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const lines = spkVal === 'multi'
            ? [
                { text: 'Speaker channel one audio calibration check.', pitch: 0.9, rate: 0.98 },
                { text: 'Speaker channel two audio calibration check.', pitch: 1.06, rate: 1.02 }
              ]
            : (spkVal === 'dual_examiner'
              ? [
                  { text: 'Examiner voice one calibration check.', pitch: 0.94, rate: 0.98 },
                  { text: 'Examiner voice two calibration check.', pitch: 1.06, rate: 1.02 }
                ]
              : [
                  { text: 'Audio playback calibration check is ready.', pitch: 1.0, rate: 1.0 }
                ]);
          lines.forEach((seg) => {
            const utter = new SpeechSynthesisUtterance(seg.text);
            utter.pitch = seg.pitch;
            utter.rate = seg.rate;
            window.speechSynthesis.speak(utter);
          });
        } catch (e) {}
      }

      setTimeout(() => {
        const chk = document.getElementById('exam-hall-noise-toggle');
        if (!chk || !chk.checked) {
          stopExamHallSynth();
        }
      }, 4500);
      showToast(`🎧 Previewing ${envVal.replace(/_/g, ' ').toUpperCase()} (${spkVal.toUpperCase()} Voice Mode)...`);
    }

export function toggleVariableSpeedDictationMode(isChecked) {
      window.isVariableSpeedDictationEnabled = Boolean(isChecked);
      const badge = document.getElementById('var-speed-live-readout-badge');
      if (portalState.variableSpeedIntervalId) {
        clearInterval(portalState.variableSpeedIntervalId);
        portalState.variableSpeedIntervalId = null;
      }
      if (window.isVariableSpeedDictationEnabled) {
        updateVariableSpeedDictationConfig();
        let stepCount = 0;
        const speakerRoles = window.varSpeedSpeakerMode === 'multi'
          ? ['⚖️ Judge', '🗣️ Counsel', '👤 Witness']
          : (window.varSpeedSpeakerMode === 'dual_examiner' ? ['🎙️ Chief Examiner', '🗣️ Co-Reader'] : ['🎙️ Narrator']);
        portalState.variableSpeedIntervalId = setInterval(() => {
          if (!window.isVariableSpeedDictationEnabled) return;
          stepCount++;
          const baseTarget = typeof currentDictationWpm !== 'undefined' && currentDictationWpm ? currentDictationWpm : 80;
          const prof = window.varSpeedFluctuationProfile || 'realistic_5';
          let delta = 0;
          if (prof === 'realistic_5') {
            const offsets = [-5, 0, +5, +3, -4, +5];
            delta = offsets[stepCount % offsets.length];
          } else if (prof === 'court_10') {
            const offsets = [-8, +6, +10, -5, +10, 0];
            delta = offsets[stepCount % offsets.length];
          } else if (prof === 'progressive_ramp') {
            delta = Math.min(15, stepCount * 2);
          }
          const dynamicWpm = Math.max(40, Math.min(240, baseTarget + delta));
          const sourceBase = window.detectedSourceAudioBaseWpm || 80;
          const dynamicRate = Math.max(0.4, Math.min(2.5, Number((dynamicWpm / sourceBase).toFixed(3))));
          const activeSpeakerLabel = speakerRoles[stepCount % speakerRoles.length];

          ['universal-audio-player', 'active-audio-exam-player', 'stenoshala-dictation-audio'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.paused) {
              if ('preservesPitch' in el) el.preservesPitch = window.varSpeedSpeakerMode === 'single';
              el.playbackRate = dynamicRate;
            }
          });
          sendYouTubeAudioCommand('setPlaybackRate', [Math.max(0.5, Math.min(2.0, dynamicRate))]);
          if (badge) {
            badge.innerText = `${activeSpeakerLabel}: ${dynamicWpm} WPM (${delta >= 0 ? '+' : ''}${delta})`;
            badge.style.background = '#8b5cf6';
            badge.style.color = '#fff';
          }
        }, 4000);
        if (badge) {
          badge.innerText = `DYNAMIC (${window.varSpeedSpeakerMode === 'multi' ? '3-SPEAKER COURT' : (window.varSpeedSpeakerMode === 'dual_examiner' ? '2-SPEAKER HALL' : '1-VOICE')})`;
          badge.style.background = '#8b5cf6';
          badge.style.color = '#fff';
        }
        showToast('🌊 Courtroom Multi-Speaker & Variable Speed Dictation enabled!');
      } else {
        if (badge) {
          badge.innerText = 'STEADY PACE';
          badge.style.background = 'var(--background)';
          badge.style.color = 'var(--text-muted)';
        }
        setSyncedTargetWpmPace(currentDictationWpm || 80);
        showToast('⏸️ Variable Speed Dictation returned to Steady Pace.');
      }
    }

export function toggleMultiSpeakerDictationMode(isChecked) {
      window.isMultiSpeakerDictationEnabled = Boolean(isChecked);
      window.varSpeedSpeakerMode = isChecked ? 'multi' : 'single';
      const spkEl = document.getElementById('var-speed-speaker-mode');
      if (spkEl) spkEl.value = window.varSpeedSpeakerMode;
      showToast(isChecked ? '🗣️ Multi-Speaker Alternating Courtroom Voice Dictation enabled!' : '🗣️ Single-Speaker Voice Dictation active.');
    }

export function updateVariableSpeedDictationConfig() {
      const profEl = document.getElementById('var-speed-fluctuation-profile');
      const spkEl = document.getElementById('var-speed-speaker-mode');
      if (profEl) window.varSpeedFluctuationProfile = profEl.value || 'realistic_5';
      if (spkEl) window.varSpeedSpeakerMode = spkEl.value || 'multi';
      if (window.isVariableSpeedDictationEnabled) {
        showToast(`🎙️ Courtroom Dictation updated: ${window.varSpeedFluctuationProfile} (${window.varSpeedSpeakerMode})`);
      }
    }

export function prefillTonight8PmBatchContest() {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
      if (start.getTime() <= Date.now()) {
        start.setTime(Date.now() + 5 * 60 * 1000);
      }
      const end = new Date(start.getTime() + 10 * 60 * 1000);
      const toLocalIso = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      const titleIn = document.getElementById('live-test-title');
      const startIn = document.getElementById('live-test-start-time');
      const endIn = document.getElementById('live-test-end-time');
      const modeIn = document.getElementById('live-test-result-mode');
      if (titleIn && !titleIn.value) titleIn.value = '8:00 PM Daily Batch Simultaneous Skill Contest (10-Min Window)';
      if (startIn) startIn.value = toLocalIso(start);
      if (endIn) endIn.value = toLocalIso(end);
      if (modeIn) modeIn.value = 'immediate';
      if (typeof populateLiveTestMaterialOptions === 'function') populateLiveTestMaterialOptions();
      showToast('🏆 Loaded 8:00 PM Daily Batch Contest preset (10-Minute Simultaneous Exam Window)!');
    }

export let _liveLobbyIntervalId = null;

export function openLiveBatchContestLobby(liveTestId) {
      const list = typeof getScheduledLiveTestsList === 'function' ? getScheduledLiveTestsList() : [];
      const lt = list.find(item => String(item.id) === String(liveTestId));
      if (!lt) {
        showToast('Live contest details not found.');
        return;
      }

      let modal = document.getElementById('live-batch-contest-lobby-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'live-batch-contest-lobby-modal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'z-index: 9450; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15,23,42,0.86);';
        document.body.appendChild(modal);
      }

      const renderLobbyTick = () => {
        const nowMs = Date.now();
        const sMs = new Date(lt.startTime).getTime();
        const diffSec = Math.max(0, Math.floor((sMs - nowMs) / 1000));
        const mins = String(Math.floor(diffSec / 60)).padStart(2, '0');
        const secs = String(diffSec % 60).padStart(2, '0');

        if (diffSec <= 0) {
          if (_liveLobbyIntervalId) {
            clearInterval(_liveLobbyIntervalId);
            _liveLobbyIntervalId = null;
          }
          modal.style.display = 'none';
          launchScheduledLiveTest(lt.id);
          return;
        }

        modal.innerHTML = `
          <div class="modal-content" style="max-width: 560px; width: 100%; border-radius: 18px; padding: 24px; background: var(--surface); border: 2px solid #f59e0b; text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,0.45);">
            <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; background: rgba(245,158,11,0.16); color: #b45309; font-size: 11px; font-weight: 800; margin-bottom: 10px;">
              <i class="fa-solid fa-satellite-dish"></i> SIMULTANEOUS BATCH EXAM COUNTDOWN LOBBY
            </div>
            <h3 style="margin: 0 0 6px 0; color: var(--secondary); font-size: 18px; font-weight: 800;">${lt.title}</h3>
            <p style="margin: 0 0 16px 0; font-size: 12.5px; color: var(--text-muted);">
              Target Batch: <strong>${lt.targetBatch || 'All-India Open'}</strong> • Category: <strong>${(lt.category || 'Exam').toUpperCase()}</strong>
            </p>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 38px; font-weight: 900; color: #ea580c; background: var(--background); padding: 16px; border-radius: 14px; border: 1px dashed #f59e0b; margin-bottom: 14px;">
              ${mins}:${secs}
            </div>
            <div style="font-size: 12px; color: var(--secondary); font-weight: 700; margin-bottom: 18px;">
              Keep your keyboard &amp; shorthand pad ready — the exam will launch automatically when the countdown hits 00:00!
            </div>
            <div style="display: flex; justify-content: center; gap: 10px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="if(_liveLobbyIntervalId){clearInterval(_liveLobbyIntervalId);_liveLobbyIntervalId=null;} document.getElementById('live-batch-contest-lobby-modal').style.display='none';">Exit Lobby</button>
              <button type="button" class="btn btn-primary btn-sm" onclick="openLiveBatchMeritListModal('${lt.id}')"><i class="fa-solid fa-trophy"></i> View Batch Merit List</button>
            </div>
          </div>
        `;
      };

      if (_liveLobbyIntervalId) clearInterval(_liveLobbyIntervalId);
      renderLobbyTick();
      modal.style.display = 'flex';
      _liveLobbyIntervalId = setInterval(renderLobbyTick, 1000);
    }

export function openLiveBatchMeritListModal(liveTestId) {
      const list = typeof getScheduledLiveTestsList === 'function' ? getScheduledLiveTestsList() : [];
      const lt = list.find(item => String(item.id) === String(liveTestId)) || { title: 'Live Batch Contest', targetBatch: 'All Batches' };
      const rawHist = [
        ...(Array.isArray(portalState.adminData?.history) ? portalState.adminData.history : []),
        ...(Array.isArray(portalState.allTestHistoryList) ? portalState.allTestHistoryList : [])
      ];
      const seenIds = new Set();
      const allHist = rawHist.filter(h => {
        const hid = String(h.HistoryID || h.id || `${h.UserID}_${h.Timestamp}_${h.ExamName}`);
        if (seenIds.has(hid)) return false;
        seenIds.add(hid);
        return true;
      });

      const contestTitleLower = String(lt.title || '').toLowerCase().trim();
      let matching = allHist.filter(h => {
        if (lt.id && String(h.liveTestId || '') === String(lt.id)) return true;
        const ex = String(h.ExamName || h.examName || '').toLowerCase();
        return Boolean(contestTitleLower && ex.includes(contestTitleLower.slice(0, 12)));
      });
      if (matching.length === 0) {
        matching = allHist;
      }
      matching = matching.slice(0, 25);

      matching.sort((a, b) => {
        const mA = parseFloat(a.MarksObtained ?? a.marksObtained ?? 0) || 0;
        const mB = parseFloat(b.MarksObtained ?? b.marksObtained ?? 0) || 0;
        if (mB !== mA) return mB - mA;
        return (parseFloat(b.NetSpeed ?? b.netSpeed ?? 0) || 0) - (parseFloat(a.NetSpeed ?? a.netSpeed ?? 0) || 0);
      });

      let modal = document.getElementById('live-batch-merit-list-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'live-batch-merit-list-modal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'z-index: 9460; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15,23,42,0.85);';
        document.body.appendChild(modal);
      }

      const rowsHtml = matching.length === 0
        ? `<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">No submissions recorded yet for this live contest window.</td></tr>`
        : matching.map((r, idx) => `
            <tr>
              <td><strong>#${idx + 1}</strong> ${idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : ''))}</td>
              <td><strong>${r.UserName || r.userName || (portalState.currentUser && portalState.currentUser.name) || 'Candidate'}</strong></td>
              <td>${r.NetSpeed ?? r.netSpeed ?? 0} WPM</td>
              <td>${r.AccuracyPercentage ?? r.accuracyPercentage ?? 0}%</td>
              <td><strong>${r.MarksObtained ?? r.marksObtained ?? '-'} / ${r.TotalMarks ?? r.totalMarks ?? 100}</strong></td>
              <td><span class="role-badge" style="background:${(r.Status || r.status) === 'PASSED' ? 'var(--success)' : 'var(--danger)'}">${r.Status || r.status || 'EVALUATED'}</span></td>
            </tr>
          `).join('');

      modal.innerHTML = `
        <div class="modal-content" style="max-width: 740px; width: 100%; border-radius: 16px; padding: 20px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 20px 50px rgba(0,0,0,0.4);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 12px;">
            <div>
              <h4 style="margin: 0; color: var(--secondary); font-size: 16px; font-weight: 800;"><i class="fa-solid fa-trophy" style="color: #d97706;"></i> Instant Batch Merit List — ${lt.title}</h4>
              <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">Batch: <strong>${lt.targetBatch || 'All-India Open'}</strong> • Ranked by Marks Obtained &amp; Net Speed</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('live-batch-merit-list-modal').style.display='none'">✕</button>
          </div>
          <div style="overflow-x: auto; max-height: 55vh;">
            <table border="1" borderColor="var(--border)" cellpadding="8" style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: var(--background); text-align: left;">
                  <th>Rank</th><th>Candidate</th><th>Net Speed</th><th>Accuracy</th><th>Marks</th><th>Result</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      `;
      modal.style.display = 'flex';
    }

setInterval(() => {
        const audio = getActiveDictationAudioElement();
        if (!audio) return;
        if (window.__audioAbLoop.active && window.__audioAbLoop.b !== null && audio.currentTime >= window.__audioAbLoop.b) {
            audio.currentTime = window.__audioAbLoop.a || 0;
            audio.play().catch(() => {});
        }
        if (window.__pyramidDrillState.active && !audio.paused) {
            const st = window.__pyramidDrillState;
            const stageIdx = Math.min(st.steps.length - 1, Math.floor((audio.currentTime || 0) / 60));
            if (stageIdx !== st.stepIndex) {
                st.stepIndex = stageIdx;
                audio.playbackRate = st.steps[stageIdx];
                const lbl = document.getElementById('pyramid-drill-status-label');
                if (lbl) lbl.textContent = st.labels[stageIdx];
                if (typeof showToast === 'function') showToast(`Pyramid Speed-Ramp escalated to ${st.labels[stageIdx]}!`, 'info');
            }
        }
    }, 250);

document.addEventListener('keydown', (e) => {
        const audioView = document.getElementById('view-audio') || document.getElementById('view-audiodictation');
        const testModal = document.getElementById('active-test-modal');
        const audioViewVisible = isElementVisibleInDom(audioView) || isElementVisibleInDom(testModal);
        if ((e.altKey && e.key === 'ArrowLeft') || e.key === 'F7') {
            if (audioViewVisible) {
                e.preventDefault();
                window.rewindAudioDictationByPedal(3);
            }
        } else if (e.altKey && (e.key === 'l' || e.key === 'L')) {
            if (audioViewVisible) {
                e.preventDefault();
                window.triggerQuick10SecAudioLoop();
            }
        }
    });

export let __mandatoryReadingInterval = null;

window.startMandatoryReadingPhase = function() {
        const banner = document.getElementById('mandatory-reading-phase-banner');
        const timerEl = document.getElementById('mandatory-reading-timer-display');
        const selectEl = document.getElementById('mandatory-reading-duration-select');
        const startTransBtn = document.getElementById('start-transcription-btn');
        const box = document.getElementById('audio-transcription-box');
        if (!banner || !timerEl) return;

        const totalSec = Math.max(1, Number(selectEl?.value || 120));
        let remaining = totalSec;
        document.body.classList.add('reading-time-fullscreen-lock');
        banner.classList.remove('hidden');
        banner.classList.add('reading-fullscreen-active');
        banner.style.display = 'flex';
        if (box) box.disabled = true;
        if (startTransBtn) startTransBtn.disabled = true;

        if (__mandatoryReadingInterval) clearInterval(__mandatoryReadingInterval);
        const progressCircle = document.getElementById('mandatory-reading-progress-circle');
        const renderClock = () => {
            timerEl.textContent = formatSecMMSS(remaining);
            if (progressCircle) {
                const pct = Math.min(1, Math.max(0, (totalSec - remaining) / totalSec));
                progressCircle.style.strokeDashoffset = String(Math.round(578 * pct));
            }
        };
        renderClock();

        __mandatoryReadingInterval = setInterval(() => {
            remaining--;
            renderClock();
            if (remaining <= 0) {
                clearInterval(__mandatoryReadingInterval);
                __mandatoryReadingInterval = null;
                window.skipMandatoryReadingPhaseAndUnlock();
            }
        }, 1000);
    };

window.skipMandatoryReadingPhaseAndUnlock = function() {
        if (__mandatoryReadingInterval) {
            clearInterval(__mandatoryReadingInterval);
            __mandatoryReadingInterval = null;
        }
        if (typeof __activeReadingPhaseInterval !== 'undefined' && __activeReadingPhaseInterval) {
            clearInterval(__activeReadingPhaseInterval);
            __activeReadingPhaseInterval = null;
        }
        document.body.classList.remove('reading-time-fullscreen-lock');
        const banner = document.getElementById('mandatory-reading-phase-banner');
        const startTransBtn = document.getElementById('start-transcription-btn');
        if (banner) {
            banner.classList.add('hidden');
            banner.classList.remove('reading-fullscreen-active');
            banner.style.display = 'none';
        }
        if (startTransBtn) startTransBtn.disabled = false;
        const inputEl = document.getElementById('test-user-input');
        if (inputEl) {
            inputEl.disabled = false;
            inputEl.focus();
        }
        if (typeof __pendingReadingUnlockCallback === 'function') {
            const cb = __pendingReadingUnlockCallback;
            __pendingReadingUnlockCallback = null;
            cb();
        } else if (typeof window.startAudioTranscription === 'function') {
            window.startAudioTranscription();
        }
    };

export let __learningGhostInterval = null;

portalState.__modalGhostInterval = null;

window.toggleLearningGhostPacer = function(enabled) {
        if (__learningGhostInterval) {
            clearInterval(__learningGhostInterval);
            __learningGhostInterval = null;
        }
        if (!enabled) {
            document.querySelectorAll('.ghost-pacer-caret').forEach(el => el.classList.remove('ghost-pacer-caret', 'bg-amber-300/60', 'border-b-2', 'border-amber-500'));
            return;
        }
        const wpm = Number(document.getElementById('learning-ghost-pacer-wpm')?.value || 35);
        const charsPerSec = (wpm * 5) / 60;
        const startTs = Date.now();
        __learningGhostInterval = setInterval(() => {
            const container = document.getElementById('learning-target-display') || document.getElementById('learning-display-text');
            if (!container) return;
            const spans = container.querySelectorAll('span');
            if (!spans.length) return;
            const targetIdx = Math.min(spans.length - 1, Math.floor(((Date.now() - startTs) / 1000) * charsPerSec));
            spans.forEach((s, idx) => {
                if (idx === targetIdx) {
                    s.classList.add('ghost-pacer-caret', 'bg-amber-300/60', 'border-b-2', 'border-amber-500');
                } else if (s.classList.contains('ghost-pacer-caret')) {
                    s.classList.remove('ghost-pacer-caret', 'bg-amber-300/60', 'border-b-2', 'border-amber-500');
                }
            });
        }, 180);
    };

window.updateLearningGhostPacerWpm = function() {
        const toggle = document.getElementById('learning-ghost-pacer-toggle');
        if (toggle && toggle.checked) window.toggleLearningGhostPacer(true);
    };

window.__uploadedShorthandPadPhotoDataUrl = '';

window.__uploadedShorthandPadDataUrl = '';

window.__shorthandPadCameraStream = null;

window.__shorthandPadCameraFacing = 'environment';

window.__shorthandPadLightboxScale = 1;

window.__serverShorthandPadsCache = [];

export function compressCanvasToShorthandDataUrl(canvas) {
        let quality = 0.80;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 180000 && quality > 0.42) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length > 180000) {
            const smallCanvas = document.createElement('canvas');
            const scale = 0.72;
            smallCanvas.width = Math.max(480, Math.round(canvas.width * scale));
            smallCanvas.height = Math.max(360, Math.round(canvas.height * scale));
            const sctx = smallCanvas.getContext('2d');
            if (sctx) {
                sctx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
                dataUrl = smallCanvas.toDataURL('image/jpeg', 0.68);
            }
        }
        return dataUrl;
    }

export function applySelectedShorthandPadDataUrl(dataUrl, labelText) {
        window.__uploadedShorthandPadPhotoDataUrl = dataUrl;
        window.__uploadedShorthandPadDataUrl = dataUrl;
        const previewStrip = document.getElementById('shorthand-pad-preview-strip') || document.getElementById('steno-pad-photo-preview-strip');
        const thumb = document.getElementById('shorthand-pad-preview-img') || document.getElementById('steno-pad-photo-thumb');
        const statusTxt = document.getElementById('steno-pad-photo-status-text');
        const uploadBadge = document.getElementById('shorthand-pad-upload-status');
        if (thumb) thumb.src = dataUrl;
        if (previewStrip) previewStrip.style.display = 'flex';
        if (uploadBadge) {
            uploadBadge.textContent = 'Photo ready — click Upload to Monitor & Admin';
            uploadBadge.style.color = '#059669';
        }
        const kb = Math.max(1, Math.round((dataUrl.length * 0.75) / 1024));
        if (statusTxt) statusTxt.textContent = `${labelText} (${kb} KB) — ready to send to Monitor, Admin & Superadmin.`;
    }

export async function startShorthandPadCameraStream() {
        const video = document.getElementById('shorthand-pad-camera-video');
        const errBox = document.getElementById('shorthand-pad-camera-error');
        const snapBtn = document.getElementById('shorthand-pad-snap-btn');
        if (!video) return;

        if (window.__shorthandPadCameraStream) {
            try { window.__shorthandPadCameraStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            window.__shorthandPadCameraStream = null;
        }
        if (errBox) {
            errBox.style.display = 'none';
            errBox.innerHTML = '';
        }
        video.style.display = 'block';
        if (snapBtn) snapBtn.disabled = false;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            video.style.display = 'none';
            if (snapBtn) snapBtn.disabled = true;
            if (errBox) {
                errBox.style.display = 'block';
                errBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; color: #f59e0b; display: block; margin-bottom: 8px;"></i>Live camera API is unavailable in this browser/context.<br>Click <strong>Upload Image File Instead</strong> below to choose a photo from your device or phone camera.';
            }
            return;
        }

        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: window.__shorthandPadCameraFacing || 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
                    audio: false
                });
            } catch (primaryErr) {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }
            window.__shorthandPadCameraStream = stream;
            video.srcObject = stream;
            await video.play().catch(() => {});
        } catch (err) {
            video.style.display = 'none';
            if (snapBtn) snapBtn.disabled = true;
            if (errBox) {
                errBox.style.display = 'block';
                errBox.innerHTML = `<i class="fa-solid fa-camera-slash" style="font-size: 24px; color: #f87171; display: block; margin-bottom: 8px;"></i>Camera access was blocked or no camera was detected (${escapeHtml(err.message || 'Permission denied')}).<br>Click <strong>Upload Image File Instead</strong> below to attach a photo from your device.`;
            }
        }
    }

window.openShorthandPadCameraModal = function() {
        const modal = document.getElementById('shorthand-pad-camera-modal');
        if (!modal) {
            document.getElementById('steno-pad-camera-input')?.click();
            return;
        }
        modal.style.display = 'flex';
        startShorthandPadCameraStream();
    };

window.closeShorthandPadCameraModal = function() {
        if (window.__shorthandPadCameraStream) {
            try { window.__shorthandPadCameraStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            window.__shorthandPadCameraStream = null;
        }
        const video = document.getElementById('shorthand-pad-camera-video');
        if (video) video.srcObject = null;
        const modal = document.getElementById('shorthand-pad-camera-modal');
        if (modal) modal.style.display = 'none';
    };

window.switchShorthandPadCameraFacing = function() {
        window.__shorthandPadCameraFacing = window.__shorthandPadCameraFacing === 'environment' ? 'user' : 'environment';
        startShorthandPadCameraStream();
    };

window.captureShorthandPadPhotoFromCamera = function() {
        const video = document.getElementById('shorthand-pad-camera-video');
        if (!video || !video.videoWidth || !video.videoHeight) {
            if (typeof showToast === 'function') showToast('Camera preview is not ready yet. Please wait or upload from device.');
            return;
        }
        const maxDim = 960;
        let w = video.videoWidth;
        let h = video.videoHeight;
        if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = compressCanvasToShorthandDataUrl(canvas);
        applySelectedShorthandPadDataUrl(dataUrl, 'Camera Capture');
        window.closeShorthandPadCameraModal();
        if (typeof showToast === 'function') showToast('Shorthand pad photo captured! Click "Upload to Monitor & Admin" to submit it.');
    };

window.handleShorthandPadPhotoUpload = function(inputEl) {
        const file = inputEl && inputEl.files && inputEl.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const rawDataUrl = String(evt.target?.result || '');
            const img = new Image();
            img.onload = function() {
                const maxDim = 960;
                let w = img.naturalWidth || img.width || 800;
                let h = img.naturalHeight || img.height || 600;
                if (w > maxDim || h > maxDim) {
                    const ratio = Math.min(maxDim / w, maxDim / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, w, h);
                    const compressed = compressCanvasToShorthandDataUrl(canvas);
                    applySelectedShorthandPadDataUrl(compressed, file.name);
                } else {
                    applySelectedShorthandPadDataUrl(rawDataUrl, file.name);
                }
                if (typeof showToast === 'function') showToast('Photo attached! Click "Upload to Monitor & Admin" to send it for review.');
            };
            img.onerror = function() {
                applySelectedShorthandPadDataUrl(rawDataUrl, file.name);
            };
            img.src = rawDataUrl;
        };
        reader.readAsDataURL(file);
    };

window.clearShorthandPadPhotoUpload = function() {
        window.__uploadedShorthandPadPhotoDataUrl = '';
        window.__uploadedShorthandPadDataUrl = '';
        const inputEl = document.getElementById('steno-pad-camera-input');
        const previewStrip = document.getElementById('shorthand-pad-preview-strip') || document.getElementById('steno-pad-photo-preview-strip');
        const statusTxt = document.getElementById('steno-pad-photo-status-text');
        const uploadBadge = document.getElementById('shorthand-pad-upload-status');
        const noteEl = document.getElementById('shorthand-pad-student-note');
        if (inputEl) inputEl.value = '';
        if (noteEl) noteEl.value = '';
        if (previewStrip) previewStrip.style.display = 'none';
        if (uploadBadge) {
            uploadBadge.textContent = 'No photo selected';
            uploadBadge.style.color = 'var(--text-muted)';
        }
        if (statusTxt) statusTxt.textContent = 'Shorthand notebook photo ready.';
    };

window.uploadShorthandPadToServer = async function() {
        const dataUrl = window.__uploadedShorthandPadDataUrl || window.__uploadedShorthandPadPhotoDataUrl || '';
        if (!dataUrl) {
            if (typeof showToast === 'function') showToast('Please capture or choose a shorthand notebook photo first.');
            return;
        }
        const activeUserId = (typeof portalState.currentUser !== 'undefined' && portalState.currentUser) ? (portalState.currentUser.userId || portalState.currentUser.id) : '';
        if (!activeUserId) {
            if (typeof showToast === 'function') showToast('Please sign in before uploading a shorthand pad photo.');
            return;
        }
        const btn = document.getElementById('btn-upload-shorthand-pad-server');
        const statusBadge = document.getElementById('shorthand-pad-upload-status');
        const diagEl = document.getElementById('shorthand-pad-diagnosis-tag');
        const noteEl = document.getElementById('shorthand-pad-student-note');
        const item = window.pendingAudioDictationItem || {};

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
        }
        try {
            const cleanDataUrl = String(dataUrl || '').trim();
            const safeMatTitle = String(item.Title || portalState.currentExamName || 'Dictation Exercise');
            const safeFileName = `ShorthandPad_${activeUserId}_${Date.now()}.jpg`;
            const res = await apiCall('uploadShorthandPad', {
                userId: activeUserId,
                userName: portalState.currentUser.name || portalState.currentUser.email || 'Student',
                batch: portalState.currentUser.batch || 'General Batch',
                materialId: String(item.ID || item.id || ''),
                materialTitle: safeMatTitle,
                diagnosisTag: diagEl ? diagEl.value : 'Pending Mentor Review',
                notes: noteEl ? noteEl.value.trim() : '',
                fileName: safeFileName,
                mimeType: 'image/jpeg',
                imageDataUrl: cleanDataUrl
            });
            if (res && res.success) {
                const storedInDrive = Boolean(res.driveFileId || (res.photoUrl && String(res.photoUrl).includes('drive.google.com')));
                if (statusBadge) {
                    statusBadge.textContent = storedInDrive
                      ? 'Saved to Google Drive & Sheet'
                      : 'Submitted to Monitor & Admin';
                    statusBadge.style.color = '#059669';
                }
                if (typeof showToast === 'function') {
                    showToast(res.message || (storedInDrive
                      ? 'Shorthand pad photo saved to Google Drive & Sheet! Your Batch Monitor & Admin can now inspect it.'
                      : 'Shorthand pad photo uploaded! Your Batch Monitor & Admin can now inspect it.'));
                }
                if (typeof loadShorthandPadsFromServer === 'function') {
                    loadShorthandPadsFromServer('batchhub', false);
                    loadShorthandPadsFromServer('admin', false);
                }
            } else {
                throw new Error((res && (res.message || res.error)) || 'Upload failed on server');
            }
        } catch (err) {
            if (statusBadge) {
                statusBadge.textContent = 'Upload failed — retry';
                statusBadge.style.color = '#dc2626';
            }
            if (typeof showToast === 'function') showToast('Could not upload shorthand pad: ' + (err.message || err), true);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Monitor &amp; Admin';
            }
        }
    };

window.openShorthandPadLightbox = function(src, title) {
        if (!src) return;
        const modal = document.getElementById('shorthand-pad-lightbox-modal');
        const img = document.getElementById('shorthand-pad-lightbox-img');
        const titleEl = document.getElementById('shorthand-pad-lightbox-title');
        if (!modal || !img) return;
        window.__shorthandPadLightboxScale = 1;
        img.src = src;
        img.style.width = '100%';
        img.style.maxWidth = '100%';
        if (titleEl) titleEl.textContent = title || 'Shorthand Notebook Page Preview';
        const lbl = document.getElementById('shorthand-pad-lightbox-zoom-label');
        if (lbl) lbl.textContent = '100%';
        modal.style.display = 'flex';
    };

window.closeShorthandPadLightbox = function() {
        const modal = document.getElementById('shorthand-pad-lightbox-modal');
        if (modal) modal.style.display = 'none';
    };

window.adjustShorthandPadLightboxZoom = function(delta) {
        const img = document.getElementById('shorthand-pad-lightbox-img');
        const lbl = document.getElementById('shorthand-pad-lightbox-zoom-label');
        if (!img) return;
        const next = delta === 0 ? 1 : Math.max(0.5, Math.min(2.5, (window.__shorthandPadLightboxScale || 1) + delta));
        window.__shorthandPadLightboxScale = Math.round(next * 100) / 100;
        const pct = Math.round(window.__shorthandPadLightboxScale * 100);
        img.style.maxWidth = pct > 100 ? 'none' : '100%';
        img.style.width = pct + '%';
        if (lbl) lbl.textContent = pct + '%';
    };

window.loadShorthandPadsFromServer = async function(targetContext = 'batchhub', showToastOnDone = false) {
        const listEl = document.getElementById(targetContext === 'admin' ? 'admin-shorthand-pads-list' : 'batchhub-shorthand-pads-list');
        if (listEl) {
            listEl.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--text-muted); font-size: 12.5px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading shorthand pad submissions from server...</div>';
        }
        try {
            const res = await apiCall('getShorthandPads', {});
            if (res && res.success) {
                window.__serverShorthandPadsCache = Array.isArray(res.pads) ? res.pads : [];
                window.__canReviewShorthandPads = Boolean(res.canReview);
                window.renderShorthandPadsGallery('batchhub');
                window.renderShorthandPadsGallery('admin');
                if (showToastOnDone && typeof showToast === 'function') {
                    showToast(`Loaded ${window.__serverShorthandPadsCache.length} shorthand pad submission(s) from server.`);
                }
            } else {
                throw new Error((res && (res.message || res.error)) || 'Failed to fetch shorthand pads');
            }
        } catch (err) {
            if (listEl) {
                listEl.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 18px; color: #dc2626; font-size: 12.5px; border: 1px dashed rgba(220,38,38,0.35); border-radius: 10px;">Unable to load shorthand pad submissions from server (${escapeHtml(err.message || 'Error')}).</div>`;
            }
        }
    };

window.renderShorthandPadsGallery = function(targetContext = 'batchhub') {
        const isAdminCtx = targetContext === 'admin';
        const listEl = document.getElementById(isAdminCtx ? 'admin-shorthand-pads-list' : 'batchhub-shorthand-pads-list');
        const countEl = document.getElementById(isAdminCtx ? 'admin-shorthand-pads-count' : 'batchhub-shorthand-pads-count');
        const statusSel = document.getElementById(isAdminCtx ? 'admin-pads-status-filter' : 'batchhub-pads-status-filter');
        const searchIn = isAdminCtx ? document.getElementById('admin-pads-search-input') : null;
        if (!listEl) return;

        const rawPads = Array.isArray(window.__serverShorthandPadsCache) ? window.__serverShorthandPadsCache : [];
        const statusVal = statusSel ? statusSel.value : 'ALL';
        const q = searchIn ? searchIn.value.trim().toLowerCase() : '';

        const filtered = rawPads.filter(p => {
            if (statusVal !== 'ALL' && String(p.ReviewStatus || 'Pending Review') !== statusVal) return false;
            if (q) {
                const hay = `${p.UserName || ''} ${p.Batch || ''} ${p.MaterialTitle || ''} ${p.DiagnosisTag || ''} ${p.Notes || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        if (countEl) {
            countEl.textContent = `${filtered.length} submission${filtered.length === 1 ? '' : 's'}`;
        }

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 22px; color: var(--text-muted); font-size: 12.5px; border: 1px dashed var(--border); border-radius: 10px;">
                    No shorthand notebook submissions found for this filter yet. Students can snap or upload their pad photo inside the <strong>Dictation &amp; Transcribe Room</strong>.
                </div>
            `;
            return;
        }

        const roleLower = String((typeof portalState.currentUser !== 'undefined' && portalState.currentUser && portalState.currentUser.role) || '').toLowerCase();
        const isReviewer = Boolean(window.__canReviewShorthandPads) || roleLower === 'admin' || roleLower === 'superadmin';

        listEl.innerHTML = filtered.map(pad => {
            const padId = String(pad.PadID || '');
            const safePadId = padId.replace(/'/g, "\\'");
            const imgSrc = String(pad.ImageDataOrUrl || '');
            const status = String(pad.ReviewStatus || 'Pending Review');
            const statusColor = status === 'Reviewed' ? '#059669' : (status === 'Needs Practice' ? '#d97706' : '#2563eb');
            const submittedAt = pad.SubmittedAt ? new Date(pad.SubmittedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
            const safeTitle = escapeHtml(`${pad.UserName || 'Student'} — ${pad.MaterialTitle || 'Shorthand Pad'}`).replace(/'/g, "\\'");
            const activeUid = (typeof portalState.currentUser !== 'undefined' && portalState.currentUser) ? (portalState.currentUser.userId || portalState.currentUser.id) : '';
            const canDelete = isReviewer || (Boolean(activeUid) && String(activeUid) === String(pad.UserID));

            return `
                <div style="background: var(--background); border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <div style="min-width: 0;">
                            <div style="font-size: 13px; font-weight: 800; color: var(--secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(pad.UserName || 'Student')}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(pad.Batch || 'General')} &middot; ${escapeHtml(submittedAt)}</div>
                        </div>
                        <span style="font-size: 11px; font-weight: 700; color: ${statusColor}; white-space: nowrap;">${escapeHtml(status)}</span>
                    </div>

                    <div style="position: relative; border-radius: 8px; overflow: hidden; background: #0f172a; border: 1px solid var(--border); aspect-ratio: 4 / 3; cursor: zoom-in;" onclick="openShorthandPadLightbox('${imgSrc.replace(/'/g, "\\'")}', '${safeTitle}')">
                        <img src="${escapeHtml(imgSrc)}" alt="Shorthand Notebook Submission" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                        <span style="position: absolute; bottom: 6px; right: 6px; background: rgba(15,23,42,0.78); color: #fff; font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
                            <i class="fa-solid fa-magnifying-glass-plus"></i> Zoom
                        </span>
                    </div>

                    <div style="font-size: 12px; color: var(--secondary); line-height: 1.45;">
                        <div><strong>Exercise:</strong> ${escapeHtml(pad.MaterialTitle || 'Dictation')}</div>
                        <div style="color: var(--text-muted); font-size: 11.5px; margin-top: 2px;"><strong>Tag:</strong> ${escapeHtml(pad.DiagnosisTag || 'Pending Mentor Review')}</div>
                        ${pad.Notes ? `<div style="color: var(--text-muted); font-size: 11.5px; margin-top: 3px;"><strong>Student Note:</strong> ${escapeHtml(pad.Notes)}</div>` : ''}
                    </div>

                    ${pad.ReviewerRemarks ? `
                        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 11.5px; color: var(--secondary);">
                            <div style="font-weight: 800; color: #059669; margin-bottom: 2px;">Mentor / Admin Remark (${escapeHtml(pad.ReviewedBy || 'Reviewer')}${pad.ReviewerRole ? ' · ' + escapeHtml(pad.ReviewerRole) : ''}):</div>
                            <div>${escapeHtml(pad.ReviewerRemarks)}</div>
                        </div>
                    ` : ''}

                    ${isReviewer ? `
                        <div style="display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--border); padding-top: 8px;">
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <select id="pad-review-status-${targetContext}-${escapeHtml(padId)}" class="form-control" style="padding: 4px 8px; font-size: 11.5px; min-height: 30px; margin: 0; flex: 1;">
                                    <option value="Reviewed" ${status === 'Reviewed' ? 'selected' : ''}>Reviewed</option>
                                    <option value="Needs Practice" ${status === 'Needs Practice' ? 'selected' : ''}>Needs Practice</option>
                                    <option value="Pending Review" ${status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
                                </select>
                                <button type="button" class="btn btn-primary btn-sm" style="padding: 5px 10px; font-size: 11px;" onclick="submitShorthandPadReview('${safePadId}', '${targetContext}')">Save Review</button>
                                ${canDelete ? `<button type="button" class="btn btn-danger btn-sm" style="padding: 5px 8px; font-size: 11px;" onclick="deleteShorthandPadSubmission('${safePadId}', '${targetContext}')" title="Delete"><i class="fa-solid fa-trash"></i></button>` : ''}
                            </div>
                            <input type="text" id="pad-review-remarks-${targetContext}-${escapeHtml(padId)}" class="form-control" value="${escapeHtml(pad.ReviewerRemarks || '')}" placeholder="Write outline feedback or remarks for student..." style="padding: 5px 8px; font-size: 11.5px; min-height: 30px; margin: 0;">
                        </div>
                    ` : (canDelete ? `
                        <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--border); padding-top: 8px;">
                            <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 11px; color: #dc2626;" onclick="deleteShorthandPadSubmission('${safePadId}', '${targetContext}')"><i class="fa-solid fa-trash"></i> Remove My Upload</button>
                        </div>
                    ` : '')}
                </div>
            `;
        }).join('');
    };

window.submitShorthandPadReview = async function(padId, targetContext = 'batchhub') {
        const statusEl = document.getElementById(`pad-review-status-${targetContext}-${padId}`);
        const remarksEl = document.getElementById(`pad-review-remarks-${targetContext}-${padId}`);
        try {
            const res = await apiCall('reviewShorthandPad', {
                padId: padId,
                reviewStatus: statusEl ? statusEl.value : 'Reviewed',
                reviewerRemarks: remarksEl ? remarksEl.value.trim() : ''
            });
            if (res && res.success) {
                if (typeof showToast === 'function') showToast('Shorthand pad review saved!');
                window.loadShorthandPadsFromServer(targetContext, false);
            } else {
                throw new Error((res && (res.message || res.error)) || 'Could not save review');
            }
        } catch (err) {
            if (typeof showToast === 'function') showToast('Review failed: ' + (err.message || err));
        }
    };

window.deleteShorthandPadSubmission = async function(padId, targetContext = 'batchhub') {
        try {
            const res = await apiCall('deleteShorthandPad', { padId: padId });
            if (res && res.success) {
                if (typeof showToast === 'function') showToast('Shorthand pad submission removed.');
                window.loadShorthandPadsFromServer(targetContext, false);
            } else {
                throw new Error((res && (res.message || res.error)) || 'Delete failed');
            }
        } catch (err) {
            if (typeof showToast === 'function') showToast('Delete failed: ' + (err.message || err));
        }
    };

window.showShorthandHoverTooltip = function(evt, word, index, totalWords) {
        const tip = document.getElementById('shorthand-outline-hover-tooltip');
        if (!tip) return;
        const clean = String(word || '').replace(/[^a-zA-Z0-9\u0900-\u097F'-]/g, '') || word;
        const wEl = document.getElementById('shorthand-tip-word');
        const sysEl = document.getElementById('shorthand-tip-system');
        const svgBox = document.getElementById('shorthand-tip-svg-box');
        const strokeEl = document.getElementById('shorthand-tip-stroke-desc');

        if (wEl) wEl.textContent = clean;
        const info = (typeof window.generatePitmanOutlineBreakdown === 'function')
            ? window.generatePitmanOutlineBreakdown(clean)
            : null;
        if (sysEl) sysEl.textContent = (info && info.category) || 'Pitman 2000';

        // Generate a clean, deterministic vector stroke path for the hovered word
        const chars = clean.toLowerCase();
        let dPath = 'M 20 35 ';
        let x = 20, y = 35;
        for (let i = 0; i < Math.min(6, chars.length); i++) {
            const c = chars.charCodeAt(i);
            const dx = 22 + (c % 11);
            const dy = ((c % 3) - 1) * 14;
            if (c % 2 === 0) {
                dPath += `Q ${x + dx / 2} ${y - 14} ${x + dx} ${Math.max(12, Math.min(48, y + dy))} `;
            } else {
                dPath += `L ${x + dx} ${Math.max(12, Math.min(48, y + dy))} `;
            }
            x += dx;
            y = Math.max(12, Math.min(48, y + dy));
        }
        if (svgBox) {
            svgBox.innerHTML = `<svg viewBox="0 0 190 56" class="w-full h-12"><path d="${dPath}" fill="none" stroke="#38bdf8" stroke-width="2.8" stroke-linecap="round"/><circle cx="${Math.min(175, x - 6)}" cy="${Math.max(10, y - 8)}" r="2.8" fill="#fbbf24"/></svg>`;
        }
        const secEst = Math.max(0, Math.round((Number(index || 0) / Math.max(1, Number(totalWords || 100))) * 300));
        const mm = String(Math.floor(secEst / 60)).padStart(2, '0');
        const ss = String(secEst % 60).padStart(2, '0');
        if (strokeEl) {
            strokeEl.innerHTML = `${(info && info.strokeBreakdown) ? info.strokeBreakdown : `Standard consonant stem + vowel indicator for "${clean}".`}<br><span style="color:#6ee7b7;font-weight:800;">🔊 Click word to jump Dictation Audio to ${mm}:${ss}</span>`;
        }

        tip.classList.remove('hidden');
        tip.style.display = 'block';
        const clientX = evt && evt.clientX ? evt.clientX : 200;
        const clientY = evt && evt.clientY ? evt.clientY : 200;
        tip.style.left = `${Math.min(window.innerWidth - 280, Math.max(12, clientX - 110))}px`;
        tip.style.top = `${Math.max(12, clientY - 155)}px`;
    };

window.hideShorthandHoverTooltip = function() {
        const tip = document.getElementById('shorthand-outline-hover-tooltip');
        if (tip) {
            tip.classList.add('hidden');
            tip.style.display = 'none';
        }
    };

window.jumpDictationAudioToWordTimestamp = function(wordIdx, totalWords, wordText) {
        const ratio = Math.max(0, Math.min(0.98, Number(wordIdx || 0) / Math.max(1, Number(totalWords || 100))));
        const audioEl = document.getElementById('stenoshala-dictation-audio') || document.getElementById('dictation-audio-player');
        if (audioEl && audioEl.src && isFinite(audioEl.duration) && audioEl.duration > 0) {
            audioEl.currentTime = Math.round(audioEl.duration * ratio);
            audioEl.play().catch(() => {});
            const mm = String(Math.floor(audioEl.currentTime / 60)).padStart(2, '0');
            const ss = String(Math.floor(audioEl.currentTime % 60)).padStart(2, '0');
            if (typeof showToast === 'function') showToast(`Karaoke Replay: Jumped dictation audio to "${wordText}" at ${mm}:${ss}!`, 'success');
            return;
        }
        // Fallback: speak the surrounding phrase using Web Speech API at the student's selected WPM & Accent
        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(String(wordText || ''));
                u.lang = 'en-IN';
                u.rate = 0.95;
                window.speechSynthesis.speak(u);
            } catch (e) {}
        }
        const estSec = Math.round(ratio * 300);
        const mm = String(Math.floor(estSec / 60)).padStart(2, '0');
        const ss = String(estSec % 60).padStart(2, '0');
        if (typeof showToast === 'function') showToast(`Karaoke Audio Replay: Replaying "${wordText}" (Timestamp ${mm}:${ss})`, 'info');
    };

window.openTranscribeExamSelector = function(sourceType = 'audio') {
    purgeFakeInjectedRules();
    pendingTranscriptionSourceType = String(sourceType || 'audio').toLowerCase().trim();

    const modal = document.getElementById('transcribe-exam-select-modal');
    const select = document.getElementById('transcribe-exam-dropdown') || document.getElementById('transcribe-exam-rule-dropdown');
    const grid = document.getElementById('transcribe-exam-cards-grid');
    const preview = document.getElementById('transcribe-exam-rule-preview');
    const searchInput = document.getElementById('transcribe-rule-search-input');
    const searchClearBtn = document.getElementById('transcribe-rule-search-clear-btn');
    const filterSelect = document.getElementById('transcribe-rule-filter-select');
    const sortSelect = document.getElementById('transcribe-rule-sort-select');
    const countBadge = document.getElementById('transcribe-rule-match-count');
    if (!modal || !select) return;

    modal.style.cssText = 'position:fixed; inset:0; z-index:99998; display:flex; align-items:center; justify-content:center; padding:8px; background:rgba(15,23,42,0.78); backdrop-filter:blur(4px);';

    select.innerHTML = '';
    const primaryKeys = window.getSectionEvaluationRuleKeys(pendingTranscriptionSourceType);

    if (primaryKeys.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.innerText = 'No evaluation rule is there';
      select.appendChild(opt);
    } else {
      primaryKeys.forEach(k => {
        const r = portalState.allEvaluationRules[k] || {};
        const opt = document.createElement('option');
        opt.value = k;
        opt.innerText = r.examDisplayName || r.examTitle || k;
        select.appendChild(opt);
      });
    }

    if (searchInput) searchInput.value = '';
    if (searchClearBtn) searchClearBtn.style.display = 'none';
    if (filterSelect) filterSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'name_asc';

    let activeKey = primaryKeys[0] || '';
    select.value = activeKey;

    const sectionTitleLabel = pendingTranscriptionSourceType === 'pitman'
      ? 'Pitman Shorthand'
      : (pendingTranscriptionSourceType === 'typingtest' ? 'Skill Typing Test' : 'Audio Dictation');

    let showCompleteRuleDetails = false;

    const getFilteredSortedKeys = () => {
      const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const f = filterSelect ? filterSelect.value : 'all';
      const s = sortSelect ? sortSelect.value : 'name_asc';

      let list = primaryKeys.filter(k => {
        const r = portalState.allEvaluationRules[k] || {};
        const dispName = String(r.examDisplayName || r.examTitle || k.replace(/^(audio|pitman|typing|typingtest|exam)_/, '').replace(/_/g, ' '));
        const timeLimit = Number(r.timeLimit || 10);
        const passAcc = Number(r.passingAccuracy ?? 90);
        const bsMode = String(r.backspaceMode || 'on').toLowerCase();
        const wordRule = String(r.wordCountRule || '1space').toLowerCase();

        if (f === 'short' && timeLimit > 10) return false;
        if (f === 'long' && timeLimit <= 10) return false;
        if (f === 'bs_locked' && bsMode === 'on') return false;
        if (f === '5stroke' && wordRule !== '5stroke') return false;
        if (f === '1space' && wordRule === '5stroke') return false;

        if (q) {
          const hay = `${dispName} ${k} ${timeLimit}m ${timeLimit} min ${passAcc}% ${bsMode} ${wordRule}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      const pinnedSet = new Set(typeof window.getPinnedEvaluationRules === 'function' ? window.getPinnedEvaluationRules() : []);
      list.sort((a, b) => {
        const pa = pinnedSet.has(a) ? 0 : 1;
        const pb = pinnedSet.has(b) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        const ra = portalState.allEvaluationRules[a] || {};
        const rb = portalState.allEvaluationRules[b] || {};
        const na = String(ra.examDisplayName || ra.examTitle || a).toLowerCase();
        const nb = String(rb.examDisplayName || rb.examTitle || b).toLowerCase();
        if (s === 'time_asc') return (Number(ra.timeLimit) || 10) - (Number(rb.timeLimit) || 10);
        if (s === 'time_desc') return (Number(rb.timeLimit) || 10) - (Number(ra.timeLimit) || 10);
        if (s === 'acc_desc') return (Number(rb.passingAccuracy ?? 90)) - (Number(ra.passingAccuracy ?? 90));
        return na.localeCompare(nb);
      });
      return list;
    };

    const renderCardsAndDetails = () => {
      const visibleKeys = getFilteredSortedKeys();
      const pinnedList = typeof window.getPinnedEvaluationRules === 'function' ? window.getPinnedEvaluationRules() : [];
      if (countBadge) {
        countBadge.textContent = `${visibleKeys.length} of ${primaryKeys.length} rule${primaryKeys.length === 1 ? '' : 's'}${pinnedList.length ? ' · ' + pinnedList.length + ' pinned' : ''}`;
      }
      if (searchClearBtn && searchInput) {
        searchClearBtn.style.display = searchInput.value.trim() ? 'block' : 'none';
      }
      if (visibleKeys.length > 0 && !visibleKeys.includes(activeKey)) {
        activeKey = visibleKeys[0];
        select.value = activeKey;
      }

      if (grid) {
        grid.className = 'eval-rule-cards-grid';
        if (primaryKeys.length === 0) {
          grid.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 18px; border-radius: 12px; background: rgba(245, 158, 11, 0.1); border: 1px dashed #f59e0b; color: #b45309; font-weight: 700; text-align: center;">
              No Evaluation Rule has been uploaded for the <strong>${sectionTitleLabel}</strong> section yet.
            </div>
          `;
        } else if (visibleKeys.length === 0) {
          grid.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 18px; border-radius: 12px; background: var(--background); border: 1px dashed var(--border); color: var(--text-muted); font-weight: 600; text-align: center;">
              No evaluation rules match your search or filter. Clear the search box to see all ${primaryKeys.length} rules.
            </div>
          `;
        } else {
          grid.innerHTML = visibleKeys.map(k => {
            const r = portalState.allEvaluationRules[k] || {};
            const dispName = r.examDisplayName || r.examTitle || k.replace(/^(audio|pitman|typing|typingtest|exam)_/, '').replace(/_/g, ' ');
            const isSel = k === activeKey;
            const isPinned = pinnedList.includes(k);
            const bsShort = String(r.backspaceMode || 'on').toLowerCase() === 'on' ? 'BS On' : 'BS Limited';
            return `
              <div class="eval-rule-select-card ${isSel ? 'selected' : ''}" data-rule-key="${escapeHtml(k)}" title="Click to select & view complete evaluation rule">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:4px;">
                  <span style="font-size:10.5px; font-weight:700; color:var(--primary);">${isPinned ? '★ Pinned · ' : ''}${sectionTitleLabel}</span>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <button type="button" class="rp-pin-rule-btn" data-pin-rule-key="${escapeHtml(k)}" title="${isPinned ? 'Unpin favourite rule' : 'Pin to top (max 3)'}" style="border:none; background:transparent; cursor:pointer; padding:0 3px; font-size:14px; color:${isPinned ? '#d97706' : 'var(--text-muted)'}; line-height:1;">
                      <i class="fa-${isPinned ? 'solid' : 'regular'} fa-star"></i>
                    </button>
                    ${isSel ? '<span style="font-size:10px; font-weight:800; color:#059669;"><i class="fa-solid fa-circle-check"></i> Selected</span>' : ''}
                  </div>
                </div>
                <div style="font-weight:800; font-size:13.5px; color:var(--secondary); margin-bottom:6px; line-height:1.3;">
                  ${escapeHtml(dispName)}
                </div>
                <div class="mono-num" style="font-size:11.5px; color:var(--text-muted); display:flex; flex-wrap:wrap; gap:8px;">
                  <span>${r.timeLimit || 10}m</span>
                  <span>&middot;</span>
                  <span style="color:#059669; font-weight:700;">Pass ${r.passingAccuracy ?? 90}%</span>
                  <span>&middot;</span>
                  <span>${bsShort}</span>
                </div>
                <div style="margin-top:7px; display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                  <button type="button" class="btn btn-sm btn-secondary rp-card-toggle-params-btn" data-param-rule-key="${escapeHtml(k)}" style="padding:3px 9px; min-height:24px; font-size:10.5px; font-weight:700;">
                    <i class="fa-solid ${isSel && showCompleteRuleDetails ? 'fa-eye-slash' : 'fa-eye'}"></i> ${isSel && showCompleteRuleDetails ? 'Hide Full Parameters' : 'Show Full Parameters'}
                  </button>
                  ${isSel ? `<button type="button" class="btn btn-success btn-sm" style="padding:4px 10px; min-height:26px; font-size:11px; font-weight:800;" onclick="event.stopPropagation(); confirmExamAndStartTranscription();"><i class="fa-solid fa-keyboard"></i> Transcribe Now &rarr;</button>` : ''}
                </div>
              </div>
            `;
          }).join('');

          grid.querySelectorAll('.rp-pin-rule-btn').forEach(pinBtn => {
            pinBtn.onclick = (ev) => {
              ev.stopPropagation();
              const rk = pinBtn.getAttribute('data-pin-rule-key');
              if (rk && typeof window.togglePinEvaluationRule === 'function') {
                window.togglePinEvaluationRule(rk);
                renderCardsAndDetails();
              }
            };
          });

          grid.querySelectorAll('.rp-card-toggle-params-btn').forEach(paramBtn => {
            paramBtn.onclick = (ev) => {
              ev.stopPropagation();
              const rk = paramBtn.getAttribute('data-param-rule-key');
              if (!rk) return;
              if (activeKey === rk) {
                showCompleteRuleDetails = !showCompleteRuleDetails;
              } else {
                activeKey = rk;
                select.value = rk;
                showCompleteRuleDetails = true;
              }
              renderCardsAndDetails();
            };
          });

          grid.querySelectorAll('.eval-rule-select-card').forEach(card => {
            card.onclick = () => {
              const k = card.getAttribute('data-rule-key');
              if (k) {
                activeKey = k;
                select.value = k;
                showCompleteRuleDetails = false;
                renderCardsAndDetails();
              }
            };
          });
        }
      }

      if (preview) {
        const r = activeKey ? (portalState.allEvaluationRules[activeKey] || getEvaluationRulesForTab(activeKey)) : null;
        if (!showCompleteRuleDetails) {
          preview.style.display = 'block';
          preview.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <span style="font-size:12px; color:var(--text-muted); font-weight:600;">Selected Rule: <strong style="color:var(--secondary);">${escapeHtml((r && (r.examDisplayName || r.examTitle)) || activeKey || 'None')}</strong></span>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-secondary" style="font-size:11.5px; font-weight:700; padding:4px 10px;" onclick="window.previewSelectedTranscribeExamRule(true)">
                  <i class="fa-solid fa-eye"></i> Show Full Parameters
                </button>
                <button type="button" class="btn btn-sm btn-success" style="font-size:11.5px; font-weight:800; padding:4px 12px;" onclick="confirmExamAndStartTranscription()">
                  <i class="fa-solid fa-keyboard"></i> Transcribe Now &rarr;
                </button>
              </div>
            </div>
          `;
        } else {
          preview.style.display = 'block';
          preview.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid var(--border);">
              <strong style="font-size:12px; color:var(--secondary);">${escapeHtml((r && (r.examDisplayName || r.examTitle)) || activeKey || 'Rule Parameters')}</strong>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-secondary" style="font-size:11px; font-weight:700; padding:3px 9px;" onclick="window.previewSelectedTranscribeExamRule(false)">
                  <i class="fa-solid fa-eye-slash"></i> Hide Full Parameters
                </button>
                <button type="button" class="btn btn-sm btn-success" style="font-size:11px; font-weight:800; padding:3px 11px;" onclick="confirmExamAndStartTranscription()">
                  <i class="fa-solid fa-keyboard"></i> Transcribe Now &rarr;
                </button>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:6px 10px;">
              ${buildCompleteRuleDetailsGridHtml(activeKey, r)}
            </div>
          `;
        }
      }
    };

    if (searchInput) {
      searchInput.oninput = renderCardsAndDetails;
      setTimeout(() => searchInput.focus(), 40);
    }
    if (searchClearBtn) {
      searchClearBtn.onclick = () => {
        if (searchInput) searchInput.value = '';
        renderCardsAndDetails();
        if (searchInput) searchInput.focus();
      };
    }
    if (filterSelect) filterSelect.onchange = renderCardsAndDetails;
    if (sortSelect) sortSelect.onchange = renderCardsAndDetails;

    window.__toggleTranscribeRuleFullParams = (openFlag) => {
      showCompleteRuleDetails = Boolean(openFlag);
      renderCardsAndDetails();
    };
    renderCardsAndDetails();
  };

window.previewSelectedTranscribeExamRule = function(forceExpand = true) {
    if (typeof window.__toggleTranscribeRuleFullParams === 'function') {
      window.__toggleTranscribeRuleFullParams(Boolean(forceExpand));
      return;
    }
    const select = document.getElementById('transcribe-exam-dropdown') || document.getElementById('transcribe-exam-rule-dropdown');
    const preview = document.getElementById('transcribe-exam-rule-preview');
    if (!select || !preview) return;
    if (!forceExpand) {
      preview.style.display = 'none';
      return;
    }
    const key = select.value;
    const r = key ? (portalState.allEvaluationRules[key] || getEvaluationRulesForTab(key)) : null;
    preview.style.display = 'grid';
    preview.innerHTML = buildCompleteRuleDetailsGridHtml(key, r);
  };



export function extractTop50HardWordsFromPassage(passageText) {
    return extractHardWordsFromPassage(String(passageText || ''), 50);
  }
window.extractTop50HardWordsFromPassage = extractTop50HardWordsFromPassage;

export function extractTop15HardWordsFromPassage(passageText) {
    return extractHardWordsFromPassage(String(passageText || ''), 50);
  }
window.extractTop15HardWordsFromPassage = extractTop15HardWordsFromPassage;

export function populateExerciseHardWordsChips(passageText) {
    const chips = document.getElementById('stenoshala-exercise-hard-words-chips');
    if (!chips) return [];
    const fallbackItem = portalState.pendingAudioDictationItem || window.pendingAudioDictationItem || null;
    const rawCandidate =
      (passageText && String(passageText).trim()) ||
      portalState.currentReferenceText ||
      window.currentReferenceText ||
      window.fullMasterPassageText ||
      document.getElementById('test-reference-text')?.textContent ||
      (fallbackItem && !/^https?:\/\//i.test(String(fallbackItem.ThumbnailUrl || '')) ? fallbackItem.ThumbnailUrl : '') ||
      (fallbackItem && !/^https?:\/\//i.test(String(fallbackItem.ContentOrUrl || '')) ? fallbackItem.ContentOrUrl : '') ||
      '';
    const topWords = extractTop50HardWordsFromPassage(rawCandidate);
    if (topWords.length === 0) {
      chips.innerHTML = `<span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">No passage transcript available to extract hard words for this dictation.</span>`;
      return [];
    }
    chips.innerHTML = topWords.map((w, i) => {
      const safeWord = escapeHtml(String(w));
      const safeJs = String(w).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `
        <button type="button" onclick="inspectPitmanWordInVault('${safeJs}')" style="padding: 5px 11px; border-radius: 8px; background: rgba(16,185,129,0.14); border: 1px solid rgba(16,185,129,0.42); color: var(--secondary); font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <span style="color: #059669; font-family: monospace;">#${i + 1}</span> ${safeWord} <i class="fa-solid fa-pen-nib" style="font-size: 10px; opacity: 0.75; color: #059669;"></i>
        </button>
      `;
    }).join('');
    return topWords;
  }
window.populateExerciseHardWordsChips = populateExerciseHardWordsChips;

export function toggleExerciseHardWordsPanel(forceState) {
    const card = document.getElementById('stenoshala-exercise-hard-words-card');
    const btn = document.getElementById('dictation-toggle-hard-words-btn');
    if (!card) return;
    const isHidden = card.style.display === 'none' || card.classList.contains('hidden');
    const shouldShow = typeof forceState === 'boolean' ? forceState : isHidden;

    if (shouldShow) {
      const words = populateExerciseHardWordsChips();
      card.classList.remove('hidden');
      card.style.display = 'block';
      if (btn) btn.innerHTML = `<i class="fa-solid fa-eye-slash"></i> Hide Hard Words (${words.length})`;
    } else {
      card.style.display = 'none';
      if (btn) btn.innerHTML = '<i class="fa-solid fa-eye"></i> Show 50 Hard Words';
    }
  }
window.toggleExerciseHardWordsPanel = toggleExerciseHardWordsPanel;

window.togglePreDictationHardWordsGlossary = function(mode) {
    if (mode === 'modal' && typeof window.toggleExerciseHardWordsPanel === 'function') {
      window.toggleExerciseHardWordsPanel();
      return;
    }
    const isModal = mode === 'modal';
    const boxId = isModal ? 'modal-hard-words-glossary-box' : 'audio-hard-words-glossary-box';
    const chipsId = isModal ? 'modal-hard-words-chips' : 'audio-hard-words-chips';
    const box = document.getElementById(boxId);
    const chips = document.getElementById(chipsId);
    if (!box || !chips) return;

    const isCurrentlyHidden = box.classList.contains('hidden') || box.style.display === 'none';
    if (!isCurrentlyHidden) {
      box.classList.add('hidden');
      box.style.display = 'none';
      return;
    }

    const sourceText =
      window.currentReferenceText ||
      window.fullMasterPassageText ||
      document.getElementById('test-reference-text')?.textContent ||
      (window.pendingAudioDictationItem && (window.pendingAudioDictationItem.ThumbnailUrl || window.pendingAudioDictationItem.ContentOrUrl)) ||
      '';

    const topWords = (typeof window.extractTop15HardWordsFromPassage === 'function')
      ? window.extractTop15HardWordsFromPassage(sourceText)
      : [];

    chips.innerHTML = topWords.map((w, i) => `
      <button type="button" onclick="inspectPitmanWordInVault('${String(w).replace(/'/g, "\\'")}')" style="padding: 4px 10px; border-radius: 8px; background: rgba(16,185,129,0.2); border: 1px solid rgba(52,211,153,0.45); color: #ecfdf5; font-size: 11.5px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
        <span style="color: #6ee7b7; font-family: monospace;">#${i + 1}</span> ${w} <i class="fa-solid fa-pen-nib" style="font-size: 10px; opacity: 0.8;"></i>
      </button>
    `).join('');
    box.classList.remove('hidden');
    box.style.display = 'block';
  };



window.toggleUniversalAudioJumpToolbar = function() {
    const bar = document.getElementById('vc-audio-jump-toolbar');
    const btn = document.getElementById('vc-audio-toggle-jump-btn');
    if (!bar) return;
    const isHidden = bar.style.display === 'none' || !bar.style.display;
    bar.style.display = isHidden ? 'flex' : 'none';
    if (btn) {
      btn.innerHTML = isHidden
        ? '<i class="fa-solid fa-chevron-up"></i> <span>Hide Jump</span>'
        : '<i class="fa-solid fa-clock"></i> <span>Jump</span>';
    }
  };

window.openUniversalMediaViewer = function(rawUrl, title, isVideoCourseAudioMode = false) {
    if (typeof isActionBlockedByUnverifiedEmail === 'function' && isActionBlockedByUnverifiedEmail('opening this media file')) return;
    if (!rawUrl || rawUrl === '-') {
      showToast('No media link available for this item.');
      return;
    }

    const modal = document.getElementById('reader-modal');
    const viewport = document.getElementById('modal-viewport');
    const titleElem = document.getElementById('modal-title');
    const inlineControls = document.getElementById('reader-modal-inline-controls');

    let url = String(rawUrl).trim();
    const isAudioLectureMode = Boolean(
      isVideoCourseAudioMode ||
      currentActiveViewName === 'videocourse' ||
      portalState.activeTab === 'videocourse' ||
      String(title || '').toLowerCase().includes('audio')
    );

    if (titleElem) {
      titleElem.innerText = isAudioLectureMode
        ? ('🎧 Audio Only: ' + (title || 'Video Course Lecture'))
        : (title || 'Media Viewer');
    }

    if (url.includes('github.com') && url.includes('/blob/')) {
      url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }

    const directStreamUrl = buildProtectedMediaProxyUrl(url, 'audio');
    const isDriveSource = isGoogleDriveOrDocsUrl(url);

    const ytId = typeof extractYouTubeVideoId === 'function' ? extractYouTubeVideoId(url) : null;
    const safeTitleJs = String(title || 'Video Lecture').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeUrlJs = String(rawUrl).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const clipCfg = typeof window.resolveMaterialMediaClipConfig === 'function'
      ? window.resolveMaterialMediaClipConfig(rawUrl, title)
      : { startSec: null, endSec: null, startLabel: '', endLabel: '', tracks: [] };
    const ytClipQuery = typeof window.buildYouTubeClipQueryParams === 'function'
      ? window.buildYouTubeClipQueryParams(clipCfg.startSec, clipCfg.endSec)
      : '';
    const hasClipWindow = clipCfg.startSec !== null || clipCfg.endSec !== null;

    if (isAudioLectureMode) {
      if (inlineControls) {
        inlineControls.innerHTML = `
          <button type="button" id="vc-audio-toggle-jump-btn" class="rp-viewer-ico-btn" style="width:auto; padding:0 8px; gap:4px; font-size:11px; font-weight:700;" onclick="window.toggleUniversalAudioJumpToolbar()" title="Show / Hide Jump Controls"><i class="fa-solid fa-clock"></i> <span>Jump</span></button>
          <button type="button" class="rp-viewer-ico-btn" style="width:auto; padding:0 8px; gap:4px; font-size:11px; font-weight:700;" onclick="openReferenceVideoModal('${safeUrlJs}', '${safeTitleJs}')" title="Switch to Full Video Mode"><i class="fa-solid fa-film"></i> <span>Video</span></button>
        `;
      }
      viewport.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; background:#0f172a; color:#fff; padding:14px; box-sizing:border-box; gap:12px;" oncontextmenu="return false;">
          <!-- Collapsible Jump to Time Strip (Hidden by default so audio view stays ultra-clean) -->
          <div id="vc-audio-jump-toolbar" style="display:none; width:100%; max-width:560px; background:rgba(30,41,59,0.92); border:1px solid #334155; border-radius:10px; padding:7px 10px; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; align-items:center; gap:5px;">
              <input type="text" id="audio-lecture-jump-time-input" placeholder="MM:SS" style="width:82px; padding:3px 7px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#fff; font-size:11px; font-weight:700; margin:0;" onkeydown="if(event.key==='Enter'){event.preventDefault(); window.seekActiveMediaPlayerToInput('audio-lecture-jump-time-input');}">
              <button type="button" class="btn btn-sm btn-primary" style="padding:3px 8px; font-size:10.5px; min-height:24px;" onclick="window.seekActiveMediaPlayerToInput('audio-lecture-jump-time-input')">Go</button>
            </div>
            <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
              <button type="button" class="btn btn-sm btn-secondary" style="padding:2px 7px; font-size:10.5px; min-height:24px; background:#1e293b; color:#e2e8f0; border:1px solid #334155;" onclick="window.seekActiveMediaPlayerByOffset(-30)">-30s</button>
              <button type="button" class="btn btn-sm btn-secondary" style="padding:2px 7px; font-size:10.5px; min-height:24px; background:#1e293b; color:#e2e8f0; border:1px solid #334155;" onclick="window.seekActiveMediaPlayerByOffset(30)">+30s</button>
              <button type="button" class="btn btn-sm btn-secondary" style="padding:2px 7px; font-size:10.5px; min-height:24px; background:#1e293b; color:#38bdf8; border:1px solid #334155;" onclick="window.seekActiveMediaPlayerToSeconds(300)">05:00</button>
              <button type="button" class="btn btn-sm btn-secondary" style="padding:2px 7px; font-size:10.5px; min-height:24px; background:#1e293b; color:#38bdf8; border:1px solid #334155;" onclick="window.seekActiveMediaPlayerToSeconds(600)">10:00</button>
            </div>
          </div>

          <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(148,163,184,0.22); border-radius:16px; padding:18px 20px; max-width:560px; width:100%; display:flex; flex-direction:column; align-items:center; gap:14px;">
            <div style="text-align:center;">
              <div style="font-size:11px; font-weight:800; color:#34d399; letter-spacing:0.04em; margin-bottom:4px;">
                <i class="fa-solid fa-headphones"></i> PROTECTED MP3 AUDIO-ONLY MODE${hasClipWindow ? ` · ✂️ ${clipCfg.startLabel || '00:00'}–${clipCfg.endLabel || 'End'}` : ''}
              </div>
              <h3 style="margin:0; font-size:16px; font-weight:800; color:#f8fafc; line-height:1.35;">${title || 'Video Course Lecture'}</h3>
            </div>

            <div id="vc-audio-eq-visualizer" style="display:flex; align-items:flex-end; justify-content:center; gap:5px; height:24px;">
              <span class="rp-eq-bar" style="animation-delay:0s;"></span>
              <span class="rp-eq-bar" style="animation-delay:0.15s;"></span>
              <span class="rp-eq-bar" style="animation-delay:0.3s;"></span>
              <span class="rp-eq-bar" style="animation-delay:0.1s;"></span>
              <span class="rp-eq-bar" style="animation-delay:0.25s;"></span>
            </div>

            ${ytId ? `
              <iframe id="hidden-youtube-audio" src="https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1&playsinline=1&vq=tiny&controls=0${ytClipQuery}&origin=${encodeURIComponent(window.location.origin)}" style="width:1px; height:1px; opacity:0; position:absolute; pointer-events:none; border:none;" allow="autoplay; encrypted-media"></iframe>
              <div style="display:flex; gap:8px; justify-content:center; align-items:center;">
                <button type="button" class="btn btn-success btn-sm" style="padding:6px 16px; border-radius:10px;" onclick="sendYouTubeAudioCommand('playVideo'); document.getElementById('vc-audio-eq-visualizer')?.classList.remove('rp-eq-paused');"><i class="fa-solid fa-play"></i> Play</button>
                <button type="button" class="btn btn-warning btn-sm" style="padding:6px 16px; border-radius:10px;" onclick="sendYouTubeAudioCommand('pauseVideo'); document.getElementById('vc-audio-eq-visualizer')?.classList.add('rp-eq-paused');"><i class="fa-solid fa-pause"></i> Pause</button>
              </div>
            ` : `
              <div style="width:100%; display:flex; align-items:center; gap:8px;">
                <audio id="universal-audio-player" controls autoplay controlsList="nodownload" oncontextmenu="return false;" style="flex:1; min-width:0; height:40px; border-radius:8px;"
                       onplay="document.getElementById('vc-audio-eq-visualizer')?.classList.remove('rp-eq-paused')"
                       onpause="document.getElementById('vc-audio-eq-visualizer')?.classList.add('rp-eq-paused')"
                       src="${directStreamUrl}"></audio>
                <select onchange="const a=document.getElementById('universal-audio-player'); if(a){a.playbackRate=parseFloat(this.value)||1;}" title="Playback Speed" style="width:68px; margin:0; padding:6px 6px; border-radius:8px; background:#1e293b; color:#fff; border:1px solid #475569; font-size:11.5px; font-weight:800; flex-shrink:0;">
                  <option value="0.75">0.75x</option>
                  <option value="1" selected>1.0x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2.0x</option>
                </select>
              </div>
            `}
          </div>
        </div>
      `;
      modal.style.display = 'flex';
      const audEl = document.getElementById('universal-audio-player');
      if (audEl) {
        if (typeof window.bindHtml5MediaClipBounds === 'function') {
          window.bindHtml5MediaClipBounds(audEl, clipCfg.startSec, clipCfg.endSec);
        }
        if (isDriveSource) {
          audEl.onerror = () => {
            tryLoadDriveAudioIntoElement(rawUrl, 'universal-audio-player');
          };
        }
      }
      if (typeof enterImmersiveFullscreenLock === 'function') enterImmersiveFullscreenLock('universal-media');
      if (typeof startUniversalAudioTimeBarSync === 'function') startUniversalAudioTimeBarSync();
      return;
    }

    if (typeof openReferenceVideoModal === 'function') {
      openReferenceVideoModal(rawUrl, title);
    }
  };

window.adjustMasterPassageFontSize = function(delta) {
    const root = document.documentElement;
    const current = parseInt(getComputedStyle(root).getPropertyValue('--master-passage-font-size') || '17', 10) || 17;
    const next = delta === 0 ? 17 : Math.min(30, Math.max(13, current + delta));
    root.style.setProperty('--master-passage-font-size', next + 'px');
    document.querySelectorAll('.rp-master-font-label').forEach(el => {
      el.textContent = next + 'px';
    });
  };

export function injectMasterPassageFontToolbars() {
    [
      { id: 'typing-passage-preview-box', label: 'Master Passage Size' },
      { id: 'learning-section-studio-card', label: 'Drill Passage Size' }
    ].forEach(t => {
      const container = document.getElementById(t.id);
      if (!container || container.querySelector('.master-passage-size-toolbar')) return;
      const bar = document.createElement('div');
      bar.className = 'master-passage-size-toolbar';
      bar.style.marginBottom = '8px';
      bar.innerHTML = `
        <span>🔍 ${t.label}: <strong class="rp-master-font-label">17px</strong></span>
        <button type="button" onclick="window.adjustMasterPassageFontSize(-2)">A-</button>
        <button type="button" onclick="window.adjustMasterPassageFontSize(2)">A+</button>
        <button type="button" onclick="window.adjustMasterPassageFontSize(0)">Reset</button>
      `;
      container.insertBefore(bar, container.firstChild);
    });
  }

window.toggleLearningStudioFullscreen = function() {
    const card = document.getElementById('learning-section-studio-card') || document.getElementById('view-learningtyping');
    if (!card) return;
    const isFull = card.classList.toggle('rp-studio-fullscreen-active');
    const btn = document.getElementById('rp-studio-fullscreen-btn');
    if (btn) {
      btn.innerHTML = isFull ? '🗗 Exit Full Screen (ESC)' : '⛶ Open Studio in Full Screen Mode';
      btn.style.background = isFull ? '#dc2626' : 'linear-gradient(135deg,#4f46e5,#0ea5e9)';
    }
    if (isFull && card.requestFullscreen) {
      card.requestFullscreen().catch(() => {});
    } else if (!isFull && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

window.parseTimeInputToSeconds = function(rawStr) {
    const str = String(rawStr || '').trim();
    if (!str) return null;
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    const parts = str.split(':').map(p => parseInt(p.trim(), 10));
    if (parts.some(isNaN)) return null;
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    return null;
  };

window.formatSecondsAsMmSs = function(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

window.seekActiveMediaPlayerToSeconds = function(targetSec) {
    const sec = Math.max(0, Math.floor(Number(targetSec) || 0));
    window.__lastMediaSeekSec = sec;

    const html5Vid = document.getElementById('ref-html5-video-player') || document.getElementById('ref-video-html5-player');
    if (html5Vid && html5Vid.style.display !== 'none') {
      html5Vid.currentTime = sec;
      html5Vid.play?.().catch(() => {});
      showToast(`⏱️ Jumped video to ${window.formatSecondsAsMmSs(sec)}`);
      return;
    }
    const html5Aud = document.getElementById('universal-audio-player');
    if (html5Aud) {
      html5Aud.currentTime = sec;
      html5Aud.play?.().catch(() => {});
      showToast(`⏱️ Jumped audio lecture to ${window.formatSecondsAsMmSs(sec)}`);
      return;
    }

    const ytFrame = document.getElementById('ref-youtube-video-iframe') || document.getElementById('ref-video-yt-iframe') || document.getElementById('hidden-youtube-audio');
    if (ytFrame && ytFrame.contentWindow) {
      try {
        ytFrame.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [sec, true]
        }), '*');
        ytFrame.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: 'playVideo',
          args: []
        }), '*');
      } catch (e) {}
      showToast(`⏱️ Jumped lecture stream to ${window.formatSecondsAsMmSs(sec)}`);
      return;
    }

    const driveFrame = document.getElementById('ref-drive-fallback-iframe') || document.getElementById('ref-video-drive-iframe');
    if (driveFrame) {
      const base = (driveFrame.getAttribute('src') || '').split('#')[0].split('?')[0];
      driveFrame.setAttribute('src', `${base}?t=${sec}s`);
      showToast(`⏱️ Jumped stream to ${window.formatSecondsAsMmSs(sec)}`);
    }
  };

window.seekActiveMediaPlayerByOffset = function(deltaSec) {
    const html5Vid = document.getElementById('ref-html5-video-player') || document.getElementById('ref-video-html5-player');
    if (html5Vid && html5Vid.style.display !== 'none') {
      window.seekActiveMediaPlayerToSeconds(Math.max(0, (html5Vid.currentTime || 0) + deltaSec));
      return;
    }
    const html5Aud = document.getElementById('universal-audio-player');
    if (html5Aud) {
      window.seekActiveMediaPlayerToSeconds(Math.max(0, (html5Aud.currentTime || 0) + deltaSec));
      return;
    }
    const baseSec = Number(window.__lastMediaSeekSec || 0);
    window.seekActiveMediaPlayerToSeconds(Math.max(0, baseSec + deltaSec));
  };

window.seekActiveMediaPlayerToInput = function(inputId) {
    const inp = document.getElementById(inputId);
    const val = inp ? inp.value.trim() : '';
    const sec = window.parseTimeInputToSeconds(val);
    if (sec === null || sec < 0) {
      showToast('⚠️ Enter a valid time in MM:SS (e.g. 05:30) or HH:MM:SS format.');
      return;
    }
    window.seekActiveMediaPlayerToSeconds(sec);
  };

export function setupInteractiveTouchTypingStudio() {
    // Remove any legacy duplicate fullscreen button bar so only the single practice top-bar fullscreen toggle exists
    const oldFsBtn = document.getElementById('rp-studio-fullscreen-btn');
    if (oldFsBtn) {
      const p = oldFsBtn.parentElement;
      if (p && p.children.length === 1) p.remove();
      else oldFsBtn.remove();
    }
    const studioCard = document.getElementById('learning-section-studio-card');
    if (studioCard) studioCard.classList.remove('rp-studio-fullscreen-active');
    if (typeof window.initLearningTypingTutor === 'function') {
      window.initLearningTypingTutor();
    }
    if (typeof window.renderKeystrokeRhythmHeatmap === 'function') {
      window.renderKeystrokeRhythmHeatmap();
    }
  }

window.uploadSelectedAudioToDriveVault = async function (customBlob, customFileName) {
    const fileInput = document.getElementById('adm-drive-audio-file-input');
    const statusEl = document.getElementById('adm-drive-audio-upload-status');
    const btn = document.getElementById('adm-drive-audio-upload-btn');
    const urlField = document.getElementById('adm-upload-url');

    const fileObj = customBlob || (fileInput && fileInput.files && fileInput.files[0]);
    if (!fileObj) {
      safeNotify('Please select an audio file (MP3 / WAV / M4A / OGG) first.');
      return;
    }

    const maxBytes = 24 * 1024 * 1024;
    if (fileObj.size > maxBytes) {
      safeNotify('Audio file exceeds 24 MB Apps Script upload limit. Please compress or use a Drive share link.');
      return;
    }

    const fileName = customFileName || fileObj.name || `dictation_${Date.now()}.mp3`;
    const mimeType = fileObj.type || 'audio/mpeg';

    if (btn) btn.disabled = true;
    if (statusEl) statusEl.innerHTML = `<span style="color: var(--primary); font-weight: 700;"><i class="fa-solid fa-spinner fa-spin"></i> Uploading "${escapeHtml(fileName)}" to Google Drive Vault...</span>`;

    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read audio file'));
        reader.readAsDataURL(fileObj);
      });

      const titleVal = document.getElementById('adm-upload-title')?.value?.trim() || fileName;
      const res = await apiCall('uploadAudioToDrive', {
        base64Data: base64Data,
        fileName: fileName,
        mimeType: mimeType,
        title: titleVal
      }, true);

      if (res && res.success && res.streamUrl) {
        if (urlField) urlField.value = res.streamUrl;
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #059669; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Uploaded to <code>RP_Skill_Media_Vault/Dictation_Audio</code> — Streaming link auto-filled above!</span>`;
        }
        safeNotify('Audio uploaded to Google Drive Vault & streaming link filled!');
      } else {
        throw new Error((res && res.message) || 'Upload failed');
      }
    } catch (err) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #dc2626; font-weight: 700;">Upload failed: ${escapeHtml(err.message || err)}</span>`;
      }
      safeNotify('Google Drive audio upload failed: ' + (err.message || err));
    } finally {
      if (btn) btn.disabled = false;
    }
  };

export function getLocalPadAnnotationsMap() {
    try {
      const raw = JSON.parse(localStorage.getItem(PAD_ANNOTATIONS_KEY) || '{}');
      return (raw && typeof raw === 'object') ? raw : {};
    } catch (e) {
      return {};
    }
  }

export function findMatchingShorthandPadForHistoryItem(historyItem) {
    if (!historyItem) return null;
    if (historyItem.shorthandPadUrl || historyItem.ShorthandPadUrl || historyItem.padImageUrl) {
      return {
        id: historyItem.shorthandPadId || ('PAD-' + (historyItem.ID || Date.now())),
        imageUrl: historyItem.shorthandPadUrl || historyItem.ShorthandPadUrl || historyItem.padImageUrl,
        title: historyItem.PassageTitle || historyItem.ExamName || 'Shorthand Pad'
      };
    }
    const uid = String(historyItem.UserID || historyItem.userId || (typeof portalState.currentUser !== 'undefined' && portalState.currentUser ? portalState.currentUser.userId : '')).trim();
    const title = String(historyItem.PassageTitle || historyItem.passageTitle || historyItem.ExamName || '').toLowerCase().trim();
    const pools = [];
    if (Array.isArray(window.allShorthandPadsList)) pools.push(...window.allShorthandPadsList);
    if (typeof portalState.adminData !== 'undefined' && portalState.adminData && Array.isArray(portalState.adminData.shorthandPads)) pools.push(...portalState.adminData.shorthandPads);

    const exact = pools.find((p) => {
      const pUid = String(p.UserID || p.userId || '').trim();
      const pTitle = String(p.PassageTitle || p.ExamName || p.Title || '').toLowerCase().trim();
      return (!uid || pUid === uid) && title && pTitle && (pTitle.includes(title) || title.includes(pTitle));
    });
    if (exact) {
      return {
        id: exact.ID || exact.id || ('PAD-' + Date.now()),
        imageUrl: exact.ImageUrl || exact.imageUrl || exact.DriveUrl || exact.Url || '',
        title: exact.PassageTitle || exact.Title || 'Shorthand Pad'
      };
    }
    const latestForUser = pools.find((p) => uid && String(p.UserID || p.userId || '').trim() === uid && (p.ImageUrl || p.imageUrl || p.DriveUrl));
    if (latestForUser) {
      return {
        id: latestForUser.ID || latestForUser.id || ('PAD-' + Date.now()),
        imageUrl: latestForUser.ImageUrl || latestForUser.imageUrl || latestForUser.DriveUrl || '',
        title: latestForUser.PassageTitle || latestForUser.Title || 'Student Shorthand Pad'
      };
    }
    return null;
  }

export function injectSideBySideShorthandAnnotationStudio(historyItem) {
    const body = document.getElementById('modal-viewport');
    if (!body) return;
    if (historyItem && (historyItem.isCbtExam || String(historyItem.ExamName || '').toLowerCase().includes('cbt'))) return;

    const shell = body.querySelector('.rp-comparison-inner-shell') || body.firstElementChild;
    if (!shell || document.getElementById('rp-pad-annotation-studio-card')) return;

    const pad = findMatchingShorthandPadForHistoryItem(historyItem);
    const testKey = String(historyItem.ID || historyItem.id || `${historyItem.UserID || 'U'}_${historyItem.Date || historyItem.ExamName || 'T'}`);
    const savedMap = getLocalPadAnnotationsMap();
    const existingAnn = savedMap[testKey] || null;

    const card = document.createElement('div');
    card.id = 'rp-pad-annotation-studio-card';
    card.style.cssText = 'background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px;';

    const resolvedImg = pad && pad.imageUrl
      ? (typeof getUniversalUrl === 'function' ? getUniversalUrl(pad.imageUrl, 'image') : pad.imageUrl)
      : '';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.04em;">Side-by-Side Outline Review</div>
          <h4 style="margin: 2px 0 0 0; font-size: 15px; font-weight: 800; color: var(--secondary);">Shorthand Pad Annotation &amp; Comparison Studio</h4>
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
          <label class="btn btn-secondary btn-sm" style="margin: 0; cursor: pointer;">
            <i class="fa-solid fa-image"></i> Load Pad Photo
            <input type="file" id="rp-pad-ann-local-file" accept="image/*" style="display: none;">
          </label>
          <button type="button" class="btn btn-secondary btn-sm" id="rp-pad-ann-toggle-side-btn">
            <i class="fa-solid fa-table-columns"></i> Side-by-Side Diff Mode
          </button>
        </div>
      </div>

      <div id="rp-pad-ann-toolbar" style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; padding: 8px 10px; background: var(--background); border: 1px solid var(--border); border-radius: 8px;">
        <button type="button" class="btn btn-primary btn-sm" data-tool="pen">Pen</button>
        <button type="button" class="btn btn-secondary btn-sm" data-tool="highlighter">Highlighter</button>
        <button type="button" class="btn btn-secondary btn-sm" data-tool="text">Text Pin</button>
        <select id="rp-pad-ann-color" class="form-control" style="width: auto; min-height: 30px; padding: 2px 8px; font-size: 11.5px; margin: 0;">
          <option value="#dc2626">Red Ink</option>
          <option value="#2563eb">Blue Ink</option>
          <option value="#059669">Green Ink</option>
          <option value="#f59e0b">Amber Highlight</option>
        </select>
        <button type="button" class="btn btn-secondary btn-sm" id="rp-pad-ann-undo">Undo</button>
        <button type="button" class="btn btn-secondary btn-sm" id="rp-pad-ann-clear">Clear</button>
        <button type="button" class="btn btn-primary btn-sm" id="rp-pad-ann-save" style="margin-left: auto; background: #059669; border-color: #059669;">
          <i class="fa-solid fa-cloud-arrow-up"></i> Save Annotation to Sheet
        </button>
      </div>

      <div id="rp-pad-ann-split-wrap" style="display: grid; grid-template-columns: 1fr; gap: 12px; align-items: start;">
        <div style="position: relative; background: var(--background); border: 1px solid var(--border); border-radius: 10px; overflow: auto; min-height: 240px; max-height: 520px; display: flex; align-items: center; justify-content: center;">
          ${resolvedImg ? '' : '<div id="rp-pad-ann-empty-msg" style="padding: 28px; text-align: center; color: var(--text-muted); font-size: 12.5px;">No shorthand pad photo attached for this test yet. Click <strong>Load Pad Photo</strong> above to annotate &amp; compare side-by-side with the transcription diff.</div>'}
          <div id="rp-pad-ann-stage" style="position: relative; display: ${resolvedImg ? 'inline-block' : 'none'}; max-width: 100%;">
            <img id="rp-pad-ann-img" src="${escapeHtml(resolvedImg)}" crossorigin="anonymous" style="display: block; max-width: 100%; height: auto; user-select: none;">
            <canvas id="rp-pad-ann-canvas" style="position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; touch-action: none;"></canvas>
          </div>
        </div>
        <div id="rp-pad-ann-side-diff-slot" style="display: none; background: var(--background); border: 1px solid var(--border); border-radius: 10px; padding: 12px; max-height: 520px; overflow-y: auto; font-size: 13px; line-height: 1.7;"></div>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <input type="text" id="rp-pad-ann-feedback-note" class="form-control" value="${escapeHtml(existingAnn ? (existingAnn.feedbackNote || '') : '')}" placeholder="Faculty / Monitor outline feedback note (saved with annotation)..." style="flex: 1; min-width: 220px; font-size: 12px; min-height: 34px; margin: 0;">
        <span id="rp-pad-ann-status" style="font-size: 11.5px; color: var(--text-muted);">${existingAnn ? 'Saved annotation loaded' : ''}</span>
      </div>
    `;

    const passageGridEl = document.getElementById('comparison-passage-grid');
    if (passageGridEl && passageGridEl.parentElement === shell) {
      passageGridEl.insertAdjacentElement('afterend', card);
    } else {
      shell.appendChild(card);
    }

    // Wire up interactive Canvas Annotation Engine
    const imgEl = document.getElementById('rp-pad-ann-img');
    const canvas = document.getElementById('rp-pad-ann-canvas');
    const stageEl = document.getElementById('rp-pad-ann-stage');
    const emptyMsg = document.getElementById('rp-pad-ann-empty-msg');
    const colorSel = document.getElementById('rp-pad-ann-color');
    const noteIn = document.getElementById('rp-pad-ann-feedback-note');
    const statusEl = document.getElementById('rp-pad-ann-status');
    const ctx = canvas ? canvas.getContext('2d') : null;

    let activeTool = 'pen';
    let drawing = false;
    const strokes = (existingAnn && Array.isArray(existingAnn.strokes)) ? JSON.parse(JSON.stringify(existingAnn.strokes)) : [];
    let currentStroke = null;

    const resizeAndRedraw = () => {
      if (!canvas || !imgEl || !ctx) return;
      const w = imgEl.naturalWidth || imgEl.clientWidth || 720;
      const h = imgEl.naturalHeight || imgEl.clientHeight || 480;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokes.forEach((st) => {
        ctx.save();
        if (st.tool === 'text') {
          ctx.fillStyle = st.color || '#dc2626';
          ctx.font = `bold ${Math.max(18, Math.round(canvas.width * 0.025))}px Inter, sans-serif`;
          ctx.fillText(st.text || '', st.x * canvas.width, st.y * canvas.height);
        } else if (Array.isArray(st.points) && st.points.length > 0) {
          ctx.strokeStyle = st.color || '#dc2626';
          ctx.lineWidth = st.tool === 'highlighter' ? Math.max(12, canvas.width * 0.022) : Math.max(3, canvas.width * 0.005);
          ctx.globalAlpha = st.tool === 'highlighter' ? 0.32 : 0.92;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          st.points.forEach((pt, idx) => {
            const px = pt.x * canvas.width;
            const py = pt.y * canvas.height;
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
        }
        ctx.restore();
      });
    };

    if (imgEl) {
      imgEl.onload = resizeAndRedraw;
      if (imgEl.complete && imgEl.naturalWidth) resizeAndRedraw();
    }

    const getNormPt = (ev) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (ev.clientX - rect.left) / Math.max(1, rect.width))),
        y: Math.max(0, Math.min(1, (ev.clientY - rect.top) / Math.max(1, rect.height)))
      };
    };

    if (canvas) {
      canvas.onpointerdown = (ev) => {
        if (!imgEl || !imgEl.src) return;
        const pt = getNormPt(ev);
        if (activeTool === 'text') {
          const pinText = (noteIn && noteIn.value.trim()) ? noteIn.value.trim().slice(0, 32) : 'Review Outline';
          strokes.push({ tool: 'text', color: colorSel ? colorSel.value : '#dc2626', x: pt.x, y: pt.y, text: pinText });
          resizeAndRedraw();
          return;
        }
        drawing = true;
        canvas.setPointerCapture(ev.pointerId);
        currentStroke = { tool: activeTool, color: colorSel ? colorSel.value : '#dc2626', points: [pt] };
        strokes.push(currentStroke);
        resizeAndRedraw();
      };
      canvas.onpointermove = (ev) => {
        if (!drawing || !currentStroke) return;
        currentStroke.points.push(getNormPt(ev));
        resizeAndRedraw();
      };
      canvas.onpointerup = () => { drawing = false; currentStroke = null; };
      canvas.onpointercancel = () => { drawing = false; currentStroke = null; };
    }

    card.querySelectorAll('#rp-pad-ann-toolbar [data-tool]').forEach((tBtn) => {
      tBtn.onclick = () => {
        activeTool = tBtn.getAttribute('data-tool') || 'pen';
        card.querySelectorAll('#rp-pad-ann-toolbar [data-tool]').forEach((b) => {
          b.className = b === tBtn ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
        });
      };
    });

    const undoBtn = document.getElementById('rp-pad-ann-undo');
    if (undoBtn) undoBtn.onclick = () => { strokes.pop(); resizeAndRedraw(); };
    const clearBtn = document.getElementById('rp-pad-ann-clear');
    if (clearBtn) clearBtn.onclick = () => { strokes.length = 0; resizeAndRedraw(); };

    const fileIn = document.getElementById('rp-pad-ann-local-file');
    if (fileIn) {
      fileIn.onchange = (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (imgEl) imgEl.src = String(reader.result || '');
          if (stageEl) stageEl.style.display = 'inline-block';
          if (emptyMsg) emptyMsg.style.display = 'none';
        };
        reader.readAsDataURL(f);
      };
    }

    // Side-by-side comparison toggle showing the test diff next to the annotated pad
    const toggleSideBtn = document.getElementById('rp-pad-ann-toggle-side-btn');
    const splitWrap = document.getElementById('rp-pad-ann-split-wrap');
    const diffSlot = document.getElementById('rp-pad-ann-side-diff-slot');
    if (toggleSideBtn && splitWrap && diffSlot) {
      let sideOn = false;
      toggleSideBtn.onclick = () => {
        sideOn = !sideOn;
        if (sideOn) {
          splitWrap.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';
          const diffSource = shell.querySelector('#diff-output-box, .diff-text-box, [id*="diff"], [id*="comparison"]');
          diffSlot.innerHTML = `<div style="font-size: 11px; font-weight: 800; color: var(--primary); margin-bottom: 8px; text-transform: uppercase;">Transcription Diff Reference</div>` +
            (diffSource ? diffSource.innerHTML : `<div style="white-space: pre-wrap;">${escapeHtml(historyItem.UserTypedText || historyItem.userTypedText || 'Diff preview synced with report below.')}</div>`);
          diffSlot.style.display = 'block';
          toggleSideBtn.className = 'btn btn-primary btn-sm';
        } else {
          splitWrap.style.gridTemplateColumns = '1fr';
          diffSlot.style.display = 'none';
          toggleSideBtn.className = 'btn btn-secondary btn-sm';
        }
      };
    }

    // Save Annotation to Google Sheets + Local Cache
    const saveBtn = document.getElementById('rp-pad-ann-save');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const payload = {
          padId: pad ? pad.id : testKey,
          testResultId: testKey,
          studentId: String(historyItem.UserID || historyItem.userId || ''),
          feedbackNote: noteIn ? noteIn.value.trim() : '',
          strokes: strokes,
          annotatedBy: (typeof portalState.currentUser !== 'undefined' && portalState.currentUser) ? portalState.currentUser.name : 'Reviewer',
          updatedAt: new Date().toISOString()
        };
        const map = getLocalPadAnnotationsMap();
        map[testKey] = payload;
        try { localStorage.setItem(PAD_ANNOTATIONS_KEY, JSON.stringify(map)); } catch (e) {}

        if (statusEl) statusEl.textContent = 'Saving to Google Sheets...';
        if (typeof apiCall === 'function') {
          await apiCall('saveShorthandPadAnnotation', {
            padId: payload.padId,
            testResultId: payload.testResultId,
            studentId: payload.studentId,
            feedbackNote: payload.feedbackNote,
            strokesCount: strokes.length,
            strokes: strokes.slice(0, 200),
            annotationSummary: `${strokes.length} stroke(s) | ${payload.feedbackNote || 'Annotated'}`,
            annotatedBy: payload.annotatedBy
          }, true);
        }
        if (statusEl) statusEl.textContent = 'Saved to Google Sheets';
        safeNotify('Shorthand Pad annotation & feedback saved to Google Sheets!');
      };
    }

    // Pull server annotations if available
    if (typeof apiCall === 'function') {
      apiCall('getShorthandPadAnnotations', { testResultId: testKey, padId: pad ? pad.id : '' }, true).then((res) => {
        if (res && res.success && Array.isArray(res.annotations) && res.annotations.length > 0) {
          const latest = res.annotations[0];
          if (noteIn && !noteIn.value && latest.FeedbackNote) noteIn.value = latest.FeedbackNote;
          if (statusEl) statusEl.textContent = `Cloud note by ${latest.AnnotatedBy || 'Faculty'} loaded`;
        }
      }).catch(() => {});
    }
  }
