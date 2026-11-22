// @ts-nocheck
/**
 * RP Skill Portal — Typing Test Wizard, Active Exam Engine, Comparison & Diagnostics
 * Clean Vite ES module (zero layered monkey-patch conflicts).
 */

import { portalState } from '../core/state.ts';
import { portalHooks } from '../core/hooks.ts';
import { buildComparisonHeatmapHtml, countMasterPassageStrokes, countMasterPassageWords, createInlineDataLoadStatusEl, getThumbnailUrl, getWatermarkText, renderDailyPracticeGoalUI, renderDashboardUI, streamRenderCardsToContainer, updateTypingWizardStepPills } from './dashboardAndProfile.js';
import { DEFAULT_LOGO_URL, HISTORY_PER_PAGE, apiCall, getEvaluationRulesForTab, isMaterialTypeMatch, logPortalAction, mergeMaterialsByType, renderGlobalWatermark, saveFastPortalCache, showLoader, showToast } from './apiAndCore.js';
import { escapeHtml, formatLocalDate, getLocalDateString } from '../utils/formatting.ts';
import { isActionBlockedByUnverifiedEmail, navigateTo, sortMaterialsLatestFirst } from './authAndNavigation.js';
import { configureActiveTestModalChrome, getActiveEvaluationRules, openPdfModal, stopExamHallSynth, triggerRuleReadingTimeBeforeTest } from './mediaAndDictation.js';
import { checkAndTriggerHighScoreNotification, pushAdminRealtimeNotification, userHasBatchAssigned } from './adminPanel.js';
import { applySavedRuleToEphemeralModal, purgeFakeInjectedRules } from './videoAndTutor.js';
import { buildCompleteRuleDetailsGridHtml } from './cbtArena.js';

const openTranscribeExamSelector = (...args) => (typeof window.openTranscribeExamSelector === 'function' ? window.openTranscribeExamSelector(...args) : undefined);
const enterImmersiveFullscreenLock = (...args) => (typeof window.enterImmersiveFullscreenLock === 'function' ? window.enterImmersiveFullscreenLock(...args) : undefined);
const exitImmersiveFullscreenLock = (...args) => (typeof window.exitImmersiveFullscreenLock === 'function' ? window.exitImmersiveFullscreenLock(...args) : undefined);

export function filterTypingWizardPassagesDropdown() {
      const searchEl = document.getElementById('typing-passage-quick-search');
      const query = searchEl ? searchEl.value.toLowerCase().trim() : '';
      const passageSelect = document.getElementById('typing-select-passage');
      const list = Array.isArray(portalState.currentTypingPassagesCache) ? portalState.currentTypingPassagesCache : [];
      if (passageSelect) {
        passageSelect.innerHTML = '<option value="" disabled selected>-- Select Exam Material --</option>';
        list.forEach((item, index) => {
          const titleStr = String(item.Title || '').toLowerCase();
          const diffStr = String(item.Difficulty || 'Medium').toLowerCase();
          if (query && !titleStr.includes(query) && !diffStr.includes(query)) return;
          const opt = document.createElement('option');
          opt.value = index;
          const passageWordsCount = countMasterPassageWords(item.ContentOrUrl);
          const passageStrokesCount = countMasterPassageStrokes(item.ContentOrUrl);
          opt.innerText = `Master Passage: ${item.Title} (${passageWordsCount} Words • ${passageStrokesCount} Total Strokes • ${item.Difficulty || 'Medium'})`;
          passageSelect.appendChild(opt);
        });
      }
      const step4CardsGrid = document.getElementById('typing-step-4-passage-cards');
      if (step4CardsGrid) {
        const filtered = list
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) => !query || String(item.Title || '').toLowerCase().includes(query) || String(item.Difficulty || '').toLowerCase().includes(query));
        step4CardsGrid.innerHTML = filtered.map(({ item, idx }) => {
          const wCount = countMasterPassageWords(item.ContentOrUrl);
          const strkCount = countMasterPassageStrokes(item.ContentOrUrl);
          return `
            <div class="card" style="padding: 12px; border-left: 4px solid var(--primary); cursor: pointer; display: flex; flex-direction: column; gap: 6px;" onclick="const sel=document.getElementById('typing-select-passage'); if(sel){sel.value='${idx}'; onTypingPassageSelected();}">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="font-size:10.5px; font-weight:800; background:rgba(79,70,229,0.12); color:var(--primary); padding:2px 8px; border-radius:999px;">📝 ${wCount} Words • ⌨️ ${strkCount} Total Strokes</span>
                <span style="font-size:10.5px; color:var(--text-muted); font-weight:700;">${item.Difficulty || 'Medium'}</span>
              </div>
              <strong style="font-size:13.5px; color:var(--secondary);">${item.Title || 'Typing Passage'}</strong>
              <div style="font-size:11px; color:var(--text-muted);">Words: <strong>${wCount}</strong> • Total Strokes: <strong>${strkCount}</strong> • Medium: <strong>${item.Medium || 'English'}</strong></div>
            </div>
          `;
        }).join('');
      }
    }

export async function initTypingTestWizard() {
      if (portalState.materialsData.filter(m => isMaterialTypeMatch(m.Type || m.type, 'typingtest')).length === 0) {
        const res = await apiCall('getMaterials', { type: 'typingtest' });
        if (res && res.success) {
          mergeMaterialsByType('typingtest', res.materials, res.subtabs);
        }
      }

      document.getElementById('typing-step-2').style.display = 'none';
      document.getElementById('typing-step-3').style.display = 'none';
      document.getElementById('typing-step-4').style.display = 'none';
      document.getElementById('typing-step-5').style.display = 'none';
      document.getElementById('typing-reset-wizard-btn').style.display = 'none';
      const previewBox = document.getElementById('typing-passage-preview-box');
      if (previewBox) previewBox.style.display = 'none';
      
      const mediumSelect = document.getElementById('typing-select-medium');
      if (mediumSelect) mediumSelect.selectedIndex = 0;

      portalState.selectedTypingMedium = null;
      portalState.selectedTypingExam = null;
      portalState.selectedTypingDate = null;
      portalState.selectedTypingPassage = null;
      updateTypingWizardStepPills(1);
    }

export function onTypingMediumSelected() {
      const mediumSelect = document.getElementById('typing-select-medium');
      portalState.selectedTypingMedium = mediumSelect.value;
      if (!portalState.selectedTypingMedium) return;

      const hindiBar = document.getElementById('typing-centre-hindi-keymap-bar');
      if (hindiBar) {
        hindiBar.style.display = portalState.selectedTypingMedium.toLowerCase() === 'hindi' ? 'block' : 'none';
      }

      const typingItems = portalState.materialsData.filter(m => 
        (m.Type || '').toLowerCase() === 'typingtest' && 
        ((m.Medium || 'English').toLowerCase() === portalState.selectedTypingMedium.toLowerCase())
      );

      // 👉 Requirement #1 & #2: Only show saved Admin Typing Evaluation Rules; if none exist, show "No evaluation rule is there"
      const examSelect = document.getElementById('typing-select-exam');
      const uniqueNamesSet = new Set();

      Object.keys(portalState.allEvaluationRules || {}).forEach(k => {
        if (k === 'default' || k === 'ephemeral_learning_once') return;
        const r = portalState.allEvaluationRules[k] || {};
        if ((r.tabType && r.tabType.toLowerCase() === 'typingtest') || k.startsWith('typingtest_')) {
          const disp = r.examDisplayName || k.replace(/^typingtest_/, '').replace(/_/g, ' ');
          if (disp && disp.toLowerCase() !== 'typingtest') uniqueNamesSet.add(disp.trim());
        }
      });

      const mergedExamNames = Array.from(uniqueNamesSet);
      if (mergedExamNames.length === 0) {
        examSelect.innerHTML = '<option value="" disabled selected>No evaluation rule is there</option>';
      } else {
        examSelect.innerHTML = '<option value="" disabled selected>-- Select Exam Name / Evaluation Rule --</option>';
        mergedExamNames.forEach(name => {
          const opt = document.createElement('option');
          opt.value = name;
          opt.innerText = name;
          examSelect.appendChild(opt);
        });
      }

      document.getElementById('typing-step-2').style.display = 'block';
      document.getElementById('typing-step-3').style.display = 'none';
      document.getElementById('typing-step-4').style.display = 'none';
      document.getElementById('typing-step-5').style.display = 'none';
      document.getElementById('typing-reset-wizard-btn').style.display = 'inline-flex';
      updateTypingWizardStepPills(2);
    
  try { portalHooks.emit('afterTypingMediumSelected'); } catch (_hk) {}
}

export function onTypingExamSelected() {
      const examSelect = document.getElementById('typing-select-exam');
      portalState.selectedTypingExam = examSelect.value;
      if (!portalState.selectedTypingExam) return;

      const dateInput = document.getElementById('typing-select-date');
      const todayStr = getLocalDateString();
      
      if (portalState.currentUser && portalState.currentUser.role !== 'admin' && portalState.currentUser.role !== 'superadmin') {
        dateInput.max = todayStr;
      } else {
        dateInput.removeAttribute('max');
      }

      document.getElementById('typing-step-3').style.display = 'block';
      document.getElementById('typing-step-4').style.display = 'none';
      document.getElementById('typing-step-5').style.display = 'none';
      updateTypingWizardStepPills(3);
    }

export function onTypingDateSelected() {
      const dateInput = document.getElementById('typing-select-date');
      const chosenDate = dateInput.value;
      const todayStr = getLocalDateString();

      if (portalState.currentUser && portalState.currentUser.role !== 'admin' && portalState.currentUser.role !== 'superadmin' && chosenDate > todayStr) {
        showToast('Future date test exams cannot be taken by users.');
        dateInput.value = '';
        return;
      }

      portalState.selectedTypingDate = chosenDate;
      if (!portalState.selectedTypingDate) return;

      const passageSelect = document.getElementById('typing-select-passage');
      
      const typingItems = portalState.materialsData.filter(m => {
        const isTypingTest = (m.Type || '').toLowerCase() === 'typingtest';
        const matchesMedium = ((m.Medium || 'English').toLowerCase() === (portalState.selectedTypingMedium || 'English').toLowerCase());
        const itemDate = formatLocalDate(m.ExamDate || m.date || '');
        
        const mSub = (m.Subtab || 'General').trim();
        const selExam = (portalState.selectedTypingExam || '').trim();
        const matchesSubtab = !selExam || 
                              mSub === 'ALL' || 
                              mSub === '-' || 
                              !mSub || 
                              mSub === selExam || 
                              selExam.includes(mSub) || 
                              mSub.toLowerCase().includes('general') ||
                              selExam.toLowerCase().includes('general');

        return isTypingTest && matchesMedium && itemDate === portalState.selectedTypingDate && matchesSubtab;
      });

      // 👉 Requirement #11: Sort latest uploaded passages on top
      const sortedTypingItems = sortMaterialsLatestFirst(typingItems);
      portalState.currentTypingPassagesCache = sortedTypingItems;

      passageSelect.innerHTML = '<option value="" disabled selected>-- Select Exam Material --</option>';
      
      if (sortedTypingItems.length === 0) {
        passageSelect.innerHTML = '<option value="" disabled selected>-- No passages found for this date & exam --</option>';
        showToast('No exam materials found for the selected date and exam subtab.');
      } else {
        sortedTypingItems.forEach((item, index) => {
          const opt = document.createElement('option');
          opt.value = index;
          const passageWordsCount = countMasterPassageWords(item.ContentOrUrl);
          const passageStrokesCount = countMasterPassageStrokes(item.ContentOrUrl);
          opt.innerText = `Master Passage: ${item.Title} (${passageWordsCount} Words • ${passageStrokesCount} Total Strokes • ${item.Difficulty || 'Medium'})`;
          passageSelect.appendChild(opt);
        });
      }

      // Requirement #2: Show Words AND Total Strokes in Typing Test Step 4 cards
      let step4CardsGrid = document.getElementById('typing-step-4-passage-cards');
      const step4El = document.getElementById('typing-step-4');
      if (step4El && !step4CardsGrid) {
        step4CardsGrid = document.createElement('div');
        step4CardsGrid.id = 'typing-step-4-passage-cards';
        step4CardsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; margin-top: 12px;';
        step4El.appendChild(step4CardsGrid);
      }
      if (step4CardsGrid) {
        if (sortedTypingItems.length === 0) {
          step4CardsGrid.innerHTML = '';
        } else {
          step4CardsGrid.innerHTML = sortedTypingItems.map((item, idx) => {
            const wCount = countMasterPassageWords(item.ContentOrUrl);
            const strkCount = countMasterPassageStrokes(item.ContentOrUrl);
            return `
              <div class="card" style="padding: 12px; border-left: 4px solid var(--primary); cursor: pointer; display: flex; flex-direction: column; gap: 6px;" onclick="const sel=document.getElementById('typing-select-passage'); if(sel){sel.value='${idx}'; onTypingPassageSelected();}">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
                  <span style="font-size:10.5px; font-weight:800; background:rgba(79,70,229,0.12); color:var(--primary); padding:2px 8px; border-radius:999px;">📝 ${wCount} Words • ⌨️ ${strkCount} Total Strokes</span>
                  <span style="font-size:10.5px; color:var(--text-muted); font-weight:700;">${item.Difficulty || 'Medium'}</span>
                </div>
                <strong style="font-size:13.5px; color:var(--secondary);">${item.Title || 'Typing Passage'}</strong>
                <div style="font-size:11px; color:var(--text-muted);">Words: <strong>${wCount}</strong> • Total Strokes: <strong>${strkCount}</strong> • Medium: <strong>${item.Medium || 'English'}</strong></div>
              </div>
            `;
          }).join('');
        }
      }

      document.getElementById('typing-step-4').style.display = 'block';
      document.getElementById('typing-step-5').style.display = 'none';
      updateTypingWizardStepPills(4);
    }

export function onTypingPassageSelected() {
      const passageSelect = document.getElementById('typing-select-passage');
      const rawVal = passageSelect.value;
      if (rawVal === '' || rawVal === null || rawVal === undefined) return;
      
      const idx = parseInt(rawVal, 10);
      if (isNaN(idx) || idx < 0) return;

      portalState.selectedTypingPassage = (typeof portalState.currentTypingPassagesCache !== 'undefined') ? portalState.currentTypingPassagesCache[idx] : null;
      
      if (!portalState.selectedTypingPassage) {
        showToast('Selected passage could not be loaded.');
        return;
      }

      const cleanExamName = portalState.selectedTypingExam ? portalState.selectedTypingExam.replace(/[^a-zA-Z0-9_]/g, '_') : 'General';
      const evaluationKey = `typingtest_${cleanExamName}`;
      
      let rules = getEvaluationRulesForTab(evaluationKey);
      if (!rules) {
        const matchedRuleKey = Object.keys(portalState.allEvaluationRules || {}).find(k => {
          const r = portalState.allEvaluationRules[k] || {};
          return ((r.tabType && r.tabType.toLowerCase() === 'typingtest') || k.startsWith('typingtest_')) &&
                 (r.examDisplayName === portalState.selectedTypingExam || k.toLowerCase() === evaluationKey.toLowerCase());
        });
        if (matchedRuleKey) rules = portalState.allEvaluationRules[matchedRuleKey];
      }
      if (!rules || Object.keys(rules).length === 0) {
        const summaryDiv = document.getElementById('typing-rules-summary');
        if (summaryDiv) {
          summaryDiv.innerHTML = `<div style="padding:14px; border-radius:8px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); color:#dc2626; font-weight:800; text-align:center;"><i class="fa-solid fa-triangle-exclamation"></i> No evaluation rule is there</div>`;
        }
        const step5 = document.getElementById('typing-step-5');
        if (step5) step5.style.display = 'block';
        updateTypingWizardStepPills(5);
        return;
      }
      
      const text = portalState.selectedTypingPassage.ContentOrUrl || '';
      const totalWords = text.split(/\s+/).filter(Boolean).length;
      const totalDuration = parseInt(rules.timeLimit) || 10;
      const bsLabel = rules.backspaceMode === 'until_space'
        ? 'ONLY UNTIL SPACEBAR (CURRENT WORD)'
        : (rules.backspaceMode === 'limited' ? `LIMITED (Max ${rules.backspaceLimit ?? 15})` : (rules.backspaceMode || 'on').toUpperCase());
      const is5StrokeRule = rules.wordCountRule === '5stroke';
      const initWordsLabel = (rules.initialWordsMode === 'custom' && parseInt(rules.initialWords) > 0)
        ? (is5StrokeRule
            ? `First ${rules.initialWords} Strokes (With Complete Passage Option)`
            : `First ${rules.initialWords} Words (With Complete Passage Option)`)
        : `All Complete Passage (${totalWords} Words / ${text.length} Total Strokes)`;
      const punctModeLabel = rules.punctRuleMode === 'all_punct'
        ? 'All Punctuation Marks Checked'
        : (rules.punctRuleMode === 'ignore_all' ? 'Ignored (0 Deduction)' : 'Fullstop (.) & Question Mark (?)');

      const previewBox = document.getElementById('typing-passage-preview-box');
      const previewSnippet = document.getElementById('typing-passage-preview-text') || document.getElementById('typing-passage-preview-snippet');
      const previewStats = document.getElementById('typing-passage-preview-stats');
      if (previewBox && previewSnippet) {
        const wordsPreview = text.trim().split(/\s+/).slice(0, 35).join(' ');
        previewSnippet.innerText = wordsPreview ? `${wordsPreview}${totalWords > 35 ? ' ...' : ''}` : '(Empty passage)';
        if (previewStats) {
          previewStats.innerText = `📝 ${totalWords} Words • ⌨️ ${text.length} Total Strokes • 🎯 ${portalState.selectedTypingPassage.Difficulty || 'Medium'}`;
        }
        previewBox.style.display = 'block';
      }

      // Requirement #6: Show COMPLETE Evaluation Rule set by Admin
      const summaryDiv = document.getElementById('typing-rules-summary');
      if (summaryDiv) {
        summaryDiv.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px 14px; font-size: 12.5px;">
            <div><strong>Language Medium:</strong> ${portalState.selectedTypingPassage.Medium || 'English'}</div>
            <div><strong>Selected Exam Rule:</strong> <span style="color:var(--primary); font-weight:800;">${rules.examDisplayName || portalState.selectedTypingExam || 'General Typing'}</span></div>
            <div><strong>Master Passage Title:</strong> ${portalState.selectedTypingPassage.Title}</div>
            <div><strong>Exam Date:</strong> ${(portalState.selectedTypingPassage.ExamDate || portalState.selectedTypingDate).substring(0, 10)}</div>
            <div><strong>Passage Length:</strong> ${totalWords} Words • ${text.length} Total Strokes</div>
            <div><strong>Time Limit:</strong> ${totalDuration} Minutes | <strong>Min Submit Lock:</strong> ${rules.minTimeSeconds || 0}s</div>
            <div><strong>Total Marks:</strong> ${rules.totalMarks ?? 100} | <strong>Passing Cutoff:</strong> ${rules.passingAccuracy ?? rules.passingMarks ?? 85}% (${rules.passingMarks ?? 85} Marks)</div>
            <div><strong>Min Gross Strokes Required:</strong> ${Math.round((text.length * (rules.minGrossStrokePct || 80)) / 100)} (${rules.minGrossStrokePct || 80}%)</div>
            <div><strong>Word Counting Formula:</strong> <span style="color:#059669; font-weight:800;">${is5StrokeRule ? '5 Strokes = 1 Word' : '1 Space = 1 Word'}</span></div>
            <div><strong>Ignored Error %:</strong> ${rules.ignoreErrorPct ?? 5}% | <strong>Penalty Multiplier:</strong> ${rules.penaltyValue ?? 1.0}x</div>
            <div><strong>Wrong Word Deduction:</strong> -${rules.deductWrong ?? 1.0} | <strong>Omission Deduction:</strong> -${rules.deductOmission ?? 1.0}</div>
            <div><strong>Extra Word Deduction:</strong> -${rules.deductExtraWord ?? 0.5} | <strong>Verb Form Error:</strong> -${rules.deductVerbForm ?? 0.5}</div>
            <div><strong>Punctuation Deduction:</strong> -${rules.deductPunctuation ?? 0.5} (${punctModeLabel})</div>
            <div><strong>Capitalization Error:</strong> -${rules.deductCapital ?? 0.25} | <strong>Para Change Error:</strong> -${rules.deductParaNotChanged ?? 1.0} (Ignore: ${(rules.ignoreParagraphChange || 'yes').toUpperCase()})</div>
            <div><strong>Backspace Rule:</strong> ${bsLabel}</div>
            <div><strong>Highlight / Auto-Scroll:</strong> Highlight ${(rules.highlightMode || 'on').toUpperCase()} • Scroll ${(rules.autoScrollMode || 'on').toUpperCase()}</div>
            <div><strong>Copy-Paste / Function Keys Lock:</strong> Copy-Paste Blocked: ${(rules.copyPasteMode || 'yes').toUpperCase()} • Func Keys Blocked: ${(rules.funcKeysMode || 'yes').toUpperCase()}</div>
            <div><strong>Repeat Passage / Text Size:</strong> Repeat: ${(rules.repeatPassage || 'yes').toUpperCase()} • Font: ${rules.defaultTextSize || 15}px</div>
            <div style="grid-column: 1 / -1;"><strong>Initial Words / Strokes Shown:</strong> ${initWordsLabel}</div>
          </div>
        `;
      }

      const step5 = document.getElementById('typing-step-5');
      if (step5) {
        step5.style.display = 'block';
        step5.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      updateTypingWizardStepPills(5);
    }

export function resetTypingWizard() {
      initTypingTestWizard();
    }

window.fullMasterPassageText = '';

window.showingCompletePassageOverride = false;

export function preparePassageForInitialWordsRule(fullPassage, rules) {
      const cleanFull = String(fullPassage || '').trim();
      window.fullMasterPassageText = cleanFull;
      const mode = rules && rules.initialWordsMode ? rules.initialWordsMode : ((rules && parseInt(rules.initialWords) > 0) ? 'custom' : 'all');
      const limitVal = rules ? (parseInt(rules.initialWords) || 0) : 0;
      const is5Stroke = rules && rules.wordCountRule === '5stroke';
      if (mode === 'custom' && limitVal > 0 && !window.showingCompletePassageOverride) {
        if (is5Stroke) {
          if (cleanFull.length > limitVal) {
            return cleanFull.slice(0, limitVal);
          }
        } else {
          const wordsArr = cleanFull.split(/\s+/).filter(Boolean);
          if (wordsArr.length > limitVal) {
            return wordsArr.slice(0, limitVal).join(' ');
          }
        }
      }
      return cleanFull;
    }

export function toggleCompletePassageInActiveTest() {
      window.showingCompletePassageOverride = !window.showingCompletePassageOverride;
      const rules = window.currentExamRules || {};
      const is5Stroke = rules.wordCountRule === '5stroke';
      portalState.currentReferenceText = preparePassageForInitialWordsRule(window.fullMasterPassageText || portalState.currentReferenceText, rules);
      const passageEl = document.getElementById('test-material-passage-text');
      if (passageEl) {
        passageEl.innerText = portalState.currentReferenceText;
      }
      const toggleBtn = document.getElementById('btn-toggle-complete-passage');
      if (toggleBtn) {
        const fullTxt = window.fullMasterPassageText || '';
        const totalWordsCount = fullTxt.split(/\s+/).filter(Boolean).length;
        const totalStrokesCount = fullTxt.length;
        const initUnitLabel = is5Stroke ? `${rules.initialWords || 0} Strokes` : `${rules.initialWords || 0} Words`;
        toggleBtn.innerHTML = window.showingCompletePassageOverride
          ? `<i class="fa-solid fa-compress"></i> Show Initial ${initUnitLabel} Only`
          : `<i class="fa-solid fa-expand"></i> Show Complete Passage (${totalWordsCount} Words • ${totalStrokesCount} Strokes)`;
      }
      handleTypingInputProgress();
    }

export function updateTestSubmitMinTimeLockUI(elapsedSeconds = 0) {
      const rules = window.currentExamRules || getEvaluationRulesForTab(portalState.activeTestSubtabKey) || {};
      const minTimeSec = Math.max(0, parseInt(rules.minTimeSeconds) || 0);
      const submitBtn = document.getElementById('test-submit-btn');
      const headerQuickSubmitBtn = document.getElementById('test-header-quick-submit-btn');
      const footerBar = document.getElementById('active-test-footer-bar');
      const isStep1DictationRoomOpen = footerBar && footerBar.style.display === 'none';
      const lockBadge = document.getElementById('test-min-time-lock-badge');
      const countdownEl = document.getElementById('test-min-time-countdown');

      if (isStep1DictationRoomOpen) {
        if (submitBtn) submitBtn.style.display = 'none';
        if (headerQuickSubmitBtn) headerQuickSubmitBtn.style.display = 'none';
        return;
      }

      if (minTimeSec > 0 && elapsedSeconds < minTimeSec) {
        const remainingLock = Math.max(1, Math.ceil(minTimeSec - elapsedSeconds));
        if (submitBtn) {
          submitBtn.style.display = 'none';
          submitBtn.disabled = true;
        }
        if (headerQuickSubmitBtn) {
          headerQuickSubmitBtn.style.display = 'none';
          headerQuickSubmitBtn.disabled = true;
        }
        if (lockBadge) lockBadge.style.display = 'inline-flex';
        if (countdownEl) countdownEl.innerText = `${remainingLock}s`;
      } else {
        if (submitBtn) {
          submitBtn.style.display = 'inline-flex';
          submitBtn.disabled = false;
        }
        // Keep header quick submit hidden so only a single Submit Test button appears (with Exit Test beside it)
        if (headerQuickSubmitBtn) {
          headerQuickSubmitBtn.style.display = 'none';
          headerQuickSubmitBtn.disabled = true;
        }
        if (lockBadge) lockBadge.style.display = 'none';
      }
    }

export function startConfiguredTypingExam() {
  if (typeof isActionBlockedByUnverifiedEmail === 'function' && isActionBlockedByUnverifiedEmail('starting a Typing Skill Test')) return;
  if (!portalState.selectedTypingPassage) {
    showToast('Please select medium, exam, date, and passage first.');
    return;
  }

  const role = portalState.currentUser ? String(portalState.currentUser.role || 'user').toLowerCase() : 'user';
  const accessLevel = (portalState.selectedTypingPassage.AccessLevel || 'public').toLowerCase();

  if (accessLevel === 'admin' && role !== 'admin' && role !== 'superadmin') {
    showToast('Access Denied: Restricted to Administrators.');
    return;
  }
  if (accessLevel === 'member' && role !== 'member' && role !== 'admin' && role !== 'superadmin') {
    showToast('Access Denied: Restricted to Members only.');
    return;
  } 

  const subtabName = portalState.selectedTypingExam || portalState.selectedTypingPassage.Subtab || portalState.selectedTypingPassage.subtab || 'General';
  let rules = getActiveEvaluationRules(subtabName, 'typingtest');
  if (!rules) {
    const matchedKey = Object.keys(portalState.allEvaluationRules || {}).find(k => {
      const r = portalState.allEvaluationRules[k] || {};
      return ((r.tabType && r.tabType.toLowerCase() === 'typingtest') || k.startsWith('typingtest_')) &&
             (r.examDisplayName === subtabName || k.toLowerCase() === `typingtest_${subtabName.replace(/[^a-zA-Z0-9_]/g, '_')}`.toLowerCase());
    });
    if (matchedKey) rules = portalState.allEvaluationRules[matchedKey];
  }
  if (!rules) {
    showToast('No evaluation rule is there');
    return;
  }

  window.currentExamRules = rules;
  window.isBackspaceAllowed = (rules.backspaceMode !== 'off');
  window.isCopyPasteBlocked = rules.copyPasteRestricted !== false;

  startTypingExam(portalState.selectedTypingPassage);
}

export function startTypingExam(item) {
      const cleanExamNameKey = portalState.selectedTypingExam ? portalState.selectedTypingExam.replace(/[^a-zA-Z0-9_]/g, '_') : 'General';
      const evaluationKey = `typingtest_${cleanExamNameKey}`;
      
      const rules = getEvaluationRulesForTab(evaluationKey) || window.currentExamRules;
      if (!rules) {
        showToast('No evaluation rule is there');
        return;
      }

      window.lastOriginTabBeforeTest = 'typingtest';
      window.isCountUpTimerMode = false;
      window.currentExamRules = rules;
      window.showingCompletePassageOverride = false;
      const cleanExamDate = item.ExamDate ? String(item.ExamDate).split('T')[0] : '';
      const cleanTitle = String(item.Title || '').split('T')[0];

      // 👉 Requirement #5: Keep Exam Title (Exam Pattern / Rule Name) distinct from Passage Title (Material Title)
      window.currentActiveExamRuleTitle = rules.examDisplayName || portalState.selectedTypingExam || 'Typing Skill Test';
      window.currentActivePassageTitle = cleanTitle || 'Typing Passage';
      portalState.currentExamName = `Typing Test: ${window.currentActiveExamRuleTitle}`;
      
      portalState.testDurationMinutes = parseInt(rules.timeLimit) || 10;
      if (window.activeScheduledLiveTestEndTime && Date.now() < window.activeScheduledLiveTestEndTime) {
        portalState.testDurationMinutes = Math.max(1, Math.round((window.activeScheduledLiveTestEndTime - Date.now()) / 60000));
      }
      portalState.testBackspaces = 0;
      portalState.testStartTime = 0;

      const rawFullPassage = item.ContentOrUrl || '';
      const totalFullWords = rawFullPassage.trim().split(/\s+/).filter(Boolean).length;
      const totalFullStrokes = rawFullPassage.trim().length;
      const is5Stroke = rules.wordCountRule === '5stroke';
      portalState.currentReferenceText = preparePassageForInitialWordsRule(rawFullPassage, rules);
      const hasInitialWordsSlice = (rules.initialWordsMode === 'custom' && parseInt(rules.initialWords) > 0 && (is5Stroke ? totalFullStrokes > parseInt(rules.initialWords) : totalFullWords > parseInt(rules.initialWords)));
      
      portalState.activeTestSubtabKey = evaluationKey;
      portalState.isTestPaused = false;
      portalState.isTypingTimerStarted = false;

      portalState.currentPassageFontSize = rules.defaultTextSize || 15;

      const titleElem = document.getElementById('test-modal-title');
      if (titleElem) titleElem.innerText = `${portalState.currentExamName}${cleanExamDate ? ' (' + cleanExamDate + ')' : ''}`;
      const timerEl = document.getElementById('test-timer');
      if (timerEl) timerEl.innerText = `${String(portalState.testDurationMinutes).padStart(2, '0')}:00`;
      const statusBar = document.getElementById('live-typing-status-bar');
      if (statusBar) statusBar.style.display = 'flex';
      const footerBar = document.getElementById('active-test-footer-bar');
      if (footerBar) footerBar.style.display = 'flex';
      updateTestSubmitMinTimeLockUI(0);
      
      const mainBody = document.getElementById('test-main-body-container');
      const layoutPos = rules.layoutPosition || 'top';

      let layoutFlexDir = 'flex-direction: column;';
      if (layoutPos === 'left') {
        layoutFlexDir = 'flex-direction: row; flex-wrap: wrap;';
      }

      if (mainBody) {
        mainBody.innerHTML = `
          <div style="display: flex; ${layoutFlexDir} gap: 12px; width: 100%; max-width: 1200px; flex: 1; min-height: 0; align-items: stretch;">
            <div id="test-reference-display" style="flex: 1; min-width: 0; background: var(--surface); padding: 14px; border-radius: var(--radius); border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow); display: flex; flex-direction: column; gap: 8px; max-height: 230px; overflow-y: auto;">
              <div style="font-weight: 700; font-size: 13px; color: var(--secondary); border-bottom: 1px solid var(--border); padding-bottom: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                <span><i class="fa-solid fa-file-lines"></i> Master Passage: ${item.Title} (${cleanExamDate}) · <span class="test-non-essential-mobile" style="color:var(--primary); font-weight:700;">${totalFullWords} Words · ${totalFullStrokes} Strokes</span></span>
                <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                  ${hasInitialWordsSlice ? `<button type="button" id="btn-toggle-complete-passage" class="btn btn-sm btn-primary" style="padding: 2px 8px; font-size: 11px;" onclick="toggleCompletePassageInActiveTest()">Show Complete Passage</button>` : ''}
                  <button type="button" class="btn btn-sm btn-secondary" style="padding: 2px 8px; font-size: 11px;" onclick="if(typeof toggleMobileActiveTestPassageHeight==='function') toggleMobileActiveTestPassageHeight()" title="Toggle Reference Passage Height">↕️ Passage Height</button>
                </div>
              </div>

              <div id="test-material-passage-text" style="font-size: ${portalState.currentPassageFontSize}px; line-height: 1.6; white-space: pre-wrap; font-family: 'Segoe UI', monospace;">${portalState.currentReferenceText}</div>
            </div>

            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; min-height: 0;">
              <div class="test-non-essential-mobile" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <div style="display: flex; align-items: center; gap: 8px; background: var(--surface); padding: 5px 11px; border-radius: 20px; border: 1px solid var(--border); font-size: 12px; font-weight: 600;">
                  <i class="fa-solid fa-volume-high" style="color: var(--primary);"></i> Exam Hall Sound 
                  <input type="checkbox" id="exam-hall-sound-toggle" style="cursor: pointer; width: 15px; height: 15px;">
                </div>
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Timer starts upon typing first key</div>
              </div>
              <textarea id="test-user-input" 
                        class="form-control" 
                        spellcheck="false" 
                        autocorrect="off" 
                        autocapitalize="off" 
                        autocomplete="off" 
                        style="width: 100%; flex: 1; min-height: 260px; resize: vertical; font-family: 'Segoe UI', monospace; padding: 14px; border-radius: var(--radius); box-shadow: inset 0 1px 3px var(--shadow);" 
                        placeholder="Start typing passage here (Timer starts on first keypress)..." 
                        oninput="handleTypingInputProgress()" 
                        onkeydown="handleTestKeyDown(event)" 
                        onpaste="handleTestPaste(event)" 
                        oncopy="handleTestCopy(event)" 
                        oncut="handleTestCut(event)"></textarea>
            </div>
          </div>
        `;
      }

      const userInputElem = document.getElementById('test-user-input');
      if (userInputElem) userInputElem.style.fontSize = (rules.defaultTextSize || 15) + 'px';
      if (typeof configureActiveTestModalChrome === 'function') {
        configureActiveTestModalChrome('typing_exam');
      }
      const testModal = document.getElementById('active-test-modal');
      if (testModal) testModal.style.display = 'flex';
      if (window.innerWidth < 768 && typeof toggleMobileExamFocusMode === 'function') {
        toggleMobileExamFocusMode(true);
      }
      updateLiveTypingStatusBar('Ready - Press any key');
    }

export let typingStatusIdleTimeout = null;

export function updateLiveTypingStatusBar(statusText = 'Typing...') {
      const rules = window.currentExamRules || getEvaluationRulesForTab(portalState.activeTestSubtabKey) || {};
      const userInput = document.getElementById('test-user-input');
      const typed = userInput ? userInput.value : '';
      const strokes = typed.length;
      // 👉 Requirement #12: 5 Strokes as One Word vs One Space as One Word
      const is5Stroke = rules.wordCountRule === '5stroke';
      const spaceCountWords = typed.trim().length > 0 ? typed.trim().split(/\s+/).filter(Boolean).length : 0;
      const words = is5Stroke ? Number((strokes / 5).toFixed(1)) : spaceCountWords;

      const elapsedMins = portalState.testStartTime > 0 ? Math.max(0.05, (Date.now() - portalState.testStartTime) / 60000) : 0.05;
      const liveWpm = portalState.testStartTime > 0 ? Math.round(words / elapsedMins) : 0;

      const ind = document.getElementById('live-typing-indicator');
      if (ind) {
        if (statusText === 'Typing...') {
          ind.style.background = '#dcfce7';
          ind.style.color = '#15803d';
          ind.innerHTML = `<i class="fa-solid fa-keyboard fa-fade"></i> Typing Active`;
        } else if (statusText === 'Paused') {
          ind.style.background = '#fef3c7';
          ind.style.color = '#b45309';
          ind.innerHTML = `<i class="fa-solid fa-pause"></i> Paused`;
        } else {
          ind.style.background = '#dbeafe';
          ind.style.color = '#1d4ed8';
          ind.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 8px;"></i> ${statusText}`;
        }
      }

      const ruleBadge = document.getElementById('live-exam-rule-badge');
      if (ruleBadge) {
        // 👉 Requirement #13: Remove "(1 Space = 1 Word | Full Stop (.) Only)" from status bar when test is open
        const ruleName = rules.examDisplayName || portalState.activeTestSubtabKey || 'Standard';
        ruleBadge.innerText = `${ruleName}`;
      }

      const wEl = document.getElementById('live-stat-words');
      if (wEl) wEl.innerText = `${Math.round(words)}${is5Stroke ? ' (5-Stroke)' : ' (1-Space)'}`;
      const sEl = document.getElementById('live-stat-strokes');
      if (sEl) sEl.innerText = strokes;
      const wpmEl = document.getElementById('live-stat-wpm');
      if (wpmEl) wpmEl.innerText = `${liveWpm} WPM`;

      const bsEl = document.getElementById('live-stat-backspaces');
      if (bsEl) {
        if (rules.backspaceMode === 'off') {
          bsEl.innerText = `${portalState.testBackspaces} (BLOCKED)`;
        } else if (rules.backspaceMode === 'until_space') {
          bsEl.innerText = `${portalState.testBackspaces} (Until Spacebar Only)`;
        } else if (rules.backspaceMode === 'limited') {
          const lim = parseInt(rules.backspaceLimit) || 15;
          const rem = Math.max(0, lim - portalState.testBackspaces);
          bsEl.innerText = `${portalState.testBackspaces} / ${lim} (${rem} left)`;
        } else {
          bsEl.innerText = `${portalState.testBackspaces} / Unlimited`;
        }
      }
    }

export function handleTestKeyDown(event) {
  if (portalState.isTestPaused) {
    event.preventDefault();
    updateLiveTypingStatusBar('Paused');
    return;
  }

  const rules = window.currentExamRules || getEvaluationRulesForTab(portalState.activeTestSubtabKey) || {};

  const isBackspaceOrDelete = 
    event.key === 'Backspace' || event.key === 'Delete' || 
    event.code === 'Backspace' || event.code === 'Delete' || 
    event.keyCode === 8 || event.keyCode === 46;

  if (isBackspaceOrDelete) {
    if (rules.backspaceMode === 'off') {
      event.preventDefault();
      showToast('🚫 Backspace and Delete keys are disabled for this exam.');
      return;
    } else if (rules.backspaceMode === 'until_space') {
      const targetEl = event.target;
      if (targetEl && typeof targetEl.value === 'string') {
        const val = targetEl.value;
        const selStart = typeof targetEl.selectionStart === 'number' ? targetEl.selectionStart : val.length;
        const selEnd = typeof targetEl.selectionEnd === 'number' ? targetEl.selectionEnd : val.length;
        const lastSpaceIdx = Math.max(val.lastIndexOf(' '), val.lastIndexOf('\n'), val.lastIndexOf('\t'));
        if (selStart !== selEnd) {
          if (selStart <= lastSpaceIdx) {
            event.preventDefault();
            showToast('🚫 Backspace works only on the current word (locked once Spacebar is pressed).');
            return;
          }
        } else if (event.key === 'Backspace' || event.code === 'Backspace' || event.keyCode === 8) {
          const charBeforeCursor = selStart > 0 ? val[selStart - 1] : '';
          if (selStart <= lastSpaceIdx + 1 || /\s/.test(charBeforeCursor)) {
            event.preventDefault();
            showToast('🚫 Backspace is locked for previous words once Spacebar is clicked!');
            return;
          }
        } else if (event.key === 'Delete' || event.code === 'Delete' || event.keyCode === 46) {
          if (selStart <= lastSpaceIdx) {
            event.preventDefault();
            showToast('🚫 Modifying previous words before Spacebar is disabled.');
            return;
          }
        }
      }
      portalState.testBackspaces++;
    } else if (rules.backspaceMode === 'limited') {
      const maxAllowed = parseInt(rules.backspaceLimit) || 15;
      if (portalState.testBackspaces >= maxAllowed) {
        event.preventDefault();
        showToast(`🚫 Limited Backspace reached (${maxAllowed}/${maxAllowed} used). Further backspaces are blocked!`);
        updateLiveTypingStatusBar('Backspace Limit Reached');
        return;
      }
      portalState.testBackspaces++;
    } else {
      portalState.testBackspaces++;
    }
  }

  if (rules.funcKeysMode === 'no' && event.key && /^F([1-9]|1[0-2])$/.test(event.key)) {
    event.preventDefault();
    showToast('🚫 Function keys (F1–F12) are disabled under current exam rules.');
    return;
  }

  if (typeof window.recordKeystrokeLatencyForHeatmap === 'function') {
    window.recordKeystrokeLatencyForHeatmap(event, 'test');
  }

  if (typeof window.triggerExamHallKeyClick === 'function') {
    window.triggerExamHallKeyClick();
  }
}

export function adjustTestPhotoZoom(amount) {
      portalState.testPhotoZoom = Math.max(0.5, Math.min(4.0, +(portalState.testPhotoZoom + amount).toFixed(2)));
      const wrapper = document.getElementById('test-photo-zoom-wrapper');
      const img = document.getElementById('test-pitman-img');
      const badge = document.getElementById('pitman-photo-zoom-badge');
      const pct = Math.round(portalState.testPhotoZoom * 100);
      if (wrapper) {
        wrapper.style.transform = 'none';
        wrapper.style.width = portalState.testPhotoZoom > 1 ? `${pct}%` : '100%';
        wrapper.style.minWidth = portalState.testPhotoZoom > 1 ? `${pct}%` : '100%';
      }
      if (img) {
        img.style.width = portalState.testPhotoZoom > 1 ? '100%' : `${pct}%`;
        img.style.maxWidth = portalState.testPhotoZoom > 1 ? 'none' : '100%';
        img.style.maxHeight = portalState.testPhotoZoom === 1 ? 'clamp(220px, 48vh, 520px)' : 'none';
      }
      if (badge) badge.innerText = `${pct}%`;
    }

export function resetTestPhotoZoom() {
      portalState.testPhotoZoom = 1;
      const wrapper = document.getElementById('test-photo-zoom-wrapper');
      const img = document.getElementById('test-pitman-img');
      const stage = document.getElementById('test-photo-stage');
      const badge = document.getElementById('pitman-photo-zoom-badge');
      if (wrapper) {
        wrapper.style.transform = 'none';
        wrapper.style.width = '100%';
        wrapper.style.minWidth = '100%';
      }
      if (img) {
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.maxWidth = '100%';
        img.style.maxHeight = 'clamp(220px, 48vh, 520px)';
        img.style.objectFit = 'contain';
      }
      if (stage) {
        stage.scrollTop = 0;
        stage.scrollLeft = 0;
      }
      if (badge) badge.innerText = '100% Auto-Fit';
      showToast('Pitman Outline Photo auto-fitted to screen.');
    }

export function handleTypingInputProgress() {
      if (!portalState.isTypingTimerStarted) {
        portalState.isTypingTimerStarted = true;
        portalState.testStartTime = Date.now();
        startTestTimer(portalState.testDurationMinutes * 60);
      }

      updateLiveTypingStatusBar('Typing...');
      if (typingStatusIdleTimeout) clearTimeout(typingStatusIdleTimeout);
      typingStatusIdleTimeout = setTimeout(() => {
        if (!portalState.isTestPaused) updateLiveTypingStatusBar('Idle');
      }, 2200);

      const rules = window.currentExamRules || getEvaluationRulesForTab(portalState.activeTestSubtabKey);
      if (!rules) return;

      const userInput = document.getElementById('test-user-input');
      const passageContainer = document.getElementById('test-material-passage-text');
      if (!userInput || !passageContainer) return;

      const typed = userInput.value;
      const ref = String(portalState.currentReferenceText || '');
      const activeIdx = Math.min(typed.length, Math.max(0, ref.length - 1));

      if (rules.highlightMode === 'on') {
        const escCh = (ch) => ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch;
        let highlightedHtml = '';
        for (let i = 0; i < ref.length; i++) {
          const ch = escCh(ref[i]);
          const idAttr = (i === activeIdx) ? ' id="rp-active-typing-char"' : '';
          if (i < typed.length) {
            if (typed[i] === ref[i]) {
              highlightedHtml += `<span${idAttr} style="background-color: rgba(16, 185, 129, 0.25); color: var(--success);">${ch}</span>`;
            } else {
              highlightedHtml += `<span${idAttr} style="background-color: rgba(239, 68, 68, 0.25); color: var(--danger);">${ch}</span>`;
            }
          } else if (i === activeIdx) {
            highlightedHtml += `<span${idAttr} style="border-bottom: 2px solid var(--primary);">${ch}</span>`;
          } else {
            highlightedHtml += `<span>${ch}</span>`;
          }
        }
        passageContainer.innerHTML = highlightedHtml;
      }

      if (rules.autoScrollMode === 'on') {
        const behavior = String(rules.autoScrollBehavior || 'line').toLowerCase();
        const activeSpan = document.getElementById('rp-active-typing-char');
        if (activeSpan) {
          const cRect = passageContainer.getBoundingClientRect();
          const sRect = activeSpan.getBoundingClientRect();
          const relTop = (sRect.top - cRect.top) + passageContainer.scrollTop;
          const lineH = Math.max(18, Math.round(sRect.height || parseFloat(getComputedStyle(passageContainer).lineHeight) || 26));
          const viewH = passageContainer.clientHeight || 200;

          if (behavior === 'screen') {
            // Scroll forward by one full visible screen page only when cursor reaches bottom threshold
            const cursorScreenBottom = sRect.bottom - cRect.top;
            const cursorScreenTop = sRect.top - cRect.top;
            if (cursorScreenBottom > viewH - Math.round(lineH * 1.1)) {
              const targetTop = Math.max(0, relTop - Math.round(lineH * 0.6));
              passageContainer.scrollTo({ top: targetTop, behavior: 'smooth' });
            } else if (cursorScreenTop < 0) {
              passageContainer.scrollTo({ top: Math.max(0, relTop - Math.round(viewH * 0.5)), behavior: 'smooth' });
            }
          } else {
            // Line-by-line auto-scroll: smoothly advance as the active cursor advances to a new line
            const currentLineNum = Math.floor(relTop / lineH);
            if (window.__rpLastAutoScrollLine !== currentLineNum) {
              window.__rpLastAutoScrollLine = currentLineNum;
              const desiredTop = Math.max(0, relTop - Math.round(lineH * 1.4));
              passageContainer.scrollTo({ top: desiredTop, behavior: 'smooth' });
            }
          }
        } else if (ref.length > 0) {
          // Fallback ratio scrolling when highlightMode is OFF
          const progress = Math.min(1, typed.length / ref.length);
          const maxScroll = Math.max(0, passageContainer.scrollHeight - passageContainer.clientHeight);
          if (behavior === 'screen') {
            const pageH = Math.max(80, passageContainer.clientHeight - 28);
            const targetScreen = Math.floor((progress * maxScroll) / pageH) * pageH;
            if (Math.abs(passageContainer.scrollTop - targetScreen) >= pageH * 0.85) {
              passageContainer.scrollTo({ top: targetScreen, behavior: 'smooth' });
            }
          } else {
            passageContainer.scrollTo({ top: Math.round(progress * maxScroll), behavior: 'smooth' });
          }
        }
      }
    }

export function renderPitmanList(filterSubtab = 'ALL') {
      const grid = document.getElementById('pitman-grid');
      if (!grid) return;

      let items = (portalState.materialsData || []).filter(m => isMaterialTypeMatch(m.Type || m.type, 'pitman'));
      const searchInput = document.getElementById('pitman-search-input');
      const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

      if (filterSubtab !== 'ALL' && !searchQuery) {
        items = items.filter(m => String(m.Subtab || '').trim() === String(filterSubtab).trim());
      }

      if (searchQuery) {
        items = items.filter(m => 
          String(m.Title ?? '').toLowerCase().includes(searchQuery) ||
          String(m.Subtab ?? '').toLowerCase().includes(searchQuery)
        );
      }

      items = sortMaterialsLatestFirst(items);

      streamRenderCardsToContainer(grid, items, (item) => {
        const card = document.createElement('div');
        card.className = 'card';
        
        const rawLogo = String(item.LogoUrl || '').trim();
        const rawThumb = String(item.ThumbnailUrl || '').trim();
        const logoTarget = (rawLogo !== '' && rawLogo !== '-') 
          ? rawLogo 
          : ((rawThumb !== '' && rawThumb !== '-') 
              ? rawThumb 
              : DEFAULT_LOGO_URL);
        
        const thumbUrl = getUniversalUrl(logoTarget, 'image');
        const subtabStr = (item.Subtab !== undefined && item.Subtab !== null && String(item.Subtab).trim() !== '' && String(item.Subtab).trim() !== '-')
          ? String(item.Subtab).trim()
          : 'General';
        const cleanPitmanSubtab = subtabStr.replace(/[^a-zA-Z0-9_]/g, '_');
        const pitmanRules = getEvaluationRulesForTab(`pitman_${cleanPitmanSubtab}`) || getEvaluationRulesForTab('pitman');
        const displayTitle = String(item.Title ?? item.Name ?? item.Word ?? '-');
        const safeTitle = displayTitle.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const pitmanWordsCount = countMasterPassageWords(item.ContentOrUrl);
        const pitmanStrokesCount = countMasterPassageStrokes(item.ContentOrUrl);
        const perms = checkMaterialAccessPermissions(item.AccessLevel, item);
        const batchBadgeStr = perms.targetBatch ? ` • 🎯 ${perms.targetBatch}` : '';
        const safeUrl = String(item.LogoUrl || item.ThumbnailUrl || item.ContentOrUrl || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        card.innerHTML = `
          <div class="rp-thumb-frame" style="${perms.canView ? '' : 'cursor:pointer; position:relative;'}" ${perms.canView ? '' : `onclick="showToast('Access Denied: Restricted to ${perms.requiredRoleLabel.replace(/'/g, "\\'")}')"`}>
            <img src="${thumbUrl}" loading="lazy" decoding="async" class="card-thumb" style="${perms.canView ? '' : 'filter:blur(6px); opacity:0.65;'}" onerror="this.onerror=null;this.src='${DEFAULT_LOGO_URL}'">
            ${perms.canView ? '' : `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(15,23,42,0.38);"><span style="color:#fff; font-weight:700; font-size:10.5px; background:rgba(220,38,38,0.92); padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-lock"></i> ${perms.requiredRoleLabel}</span></div>`}
          </div>
          <strong style="margin: 2px 0; color: var(--secondary); font-size: 13px; line-height: 1.32; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${safeTitle}</strong>
          <span class="subtab-badge" style="font-size: 10px; padding: 2px 7px;">📂 ${subtabStr} • 🔒 ${String(item.AccessLevel || 'public').toUpperCase()}${batchBadgeStr}</span>
          <span class="subtab-badge" style="margin-top: 2px; font-size: 10px; padding: 2px 7px; background: rgba(16, 185, 129, 0.12); color: #059669; font-weight: 800;">📝 ${pitmanWordsCount} W • ⌨️ ${pitmanStrokesCount} Strokes</span>
          <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top: 6px; width: 100%;">
            ${perms.canView
              ? `<button class="btn btn-primary btn-sm" style="flex: 1; font-size: 11px; padding: 5px 8px;" onclick='startPitmanTestById("${item.ID || item.id}")'><i class="fa-solid fa-headphones"></i> Transcribe</button>
                 ${perms.canDownload ? `<button class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 5px 8px;" title="Download Material" onclick="downloadItem('${safeUrl}', '${safeTitle}', '${String(item.AccessLevel || 'public').toLowerCase()}', '${String(perms.targetBatch || '').replace(/'/g, "\\'")}')"><i class="fa-solid fa-download"></i></button>` : ''}`
              : `<button class="btn btn-secondary btn-sm" style="flex: 1; width: 100%; font-size: 11px; padding: 5px 8px; background: var(--border); color: var(--text-muted);" onclick="showToast('Access Denied: Restricted to ${perms.requiredRoleLabel.replace(/'/g, "\\'")}')"><i class="fa-solid fa-lock"></i> Locked</button>`}
          </div>
        `;
        return card;
      });
    }

export function startPitmanTestById(id) {
      if (typeof isActionBlockedByUnverifiedEmail === 'function' && isActionBlockedByUnverifiedEmail('starting a Pitman Shorthand Test')) return;
      const item = portalState.materialsData.find(m => String(m.ID || m.id) === String(id));
      if (!item) {
        showToast('Pitman exercise material not found.');
        return;
      }
      const perms = checkMaterialAccessPermissions(item.AccessLevel, item);
      if (!perms.canView) {
        showToast(`Access Denied: Restricted to ${perms.requiredRoleLabel}.`);
        return;
      }
      window.lastOriginTabBeforeTest = 'pitman';
      portalState.pendingAudioDictationItem = item;
      window.pendingPitmanDirectLaunch = true;
      openTranscribeExamSelector('pitman');
    }

export function startPitmanTest(item, overrideRuleKey) {
      const perms = checkMaterialAccessPermissions(item.AccessLevel, item);
      if (!perms.canView) {
        showToast(`Access Denied: Restricted to ${perms.requiredRoleLabel}.`);
        return;
      }

      window.lastOriginTabBeforeTest = 'pitman';
      window.isCountUpTimerMode = false;
      window.showingCompletePassageOverride = false;
      portalState.pendingAudioDictationItem = item;
      const cleanPitmanSubtab = item.Subtab ? String(item.Subtab).replace(/[^a-zA-Z0-9_]/g, '_') : 'General';
      portalState.activeTestSubtabKey = overrideRuleKey
        ? overrideRuleKey
        : (item.Subtab && portalState.allEvaluationRules[`pitman_${cleanPitmanSubtab}`]
            ? `pitman_${cleanPitmanSubtab}`
            : '');

      const rules = portalState.activeTestSubtabKey ? getEvaluationRulesForTab(portalState.activeTestSubtabKey) : null;
      if (!rules) {
        showToast('No evaluation rule is there');
        return;
      }
      if (typeof logPortalAction === 'function') {
        logPortalAction('START_PITMAN_TEST', `Started Pitman Test: ${item.Title} [Rule: ${portalState.activeTestSubtabKey}]`);
      }

      window.currentExamRules = rules;
      window.isBackspaceAllowed = (rules.backspaceMode !== 'off');
      window.isCopyPasteBlocked = rules.copyPasteRestricted !== false;

      // 👉 Requirement #5: Keep Exam Title (Rule Name) distinct from Passage Title (Material Title)
      window.currentActiveExamRuleTitle = rules.examDisplayName || portalState.activeTestSubtabKey || 'Pitman Shorthand Test';
      window.currentActivePassageTitle = String(item.Title || 'Pitman Exercise');
      portalState.currentExamName = `Pitman Test: ${window.currentActiveExamRuleTitle}`;
      portalState.testDurationMinutes = parseInt(rules.timeLimit) || 15;
      portalState.testBackspaces = 0;
      portalState.testStartTime = Date.now();
      const rawPassageRef = (item.ContentOrUrl && !String(item.ContentOrUrl).startsWith('http'))
        ? item.ContentOrUrl
        : ((item.ThumbnailUrl && item.ThumbnailUrl !== '-' && !String(item.ThumbnailUrl).startsWith('http')) ? item.ThumbnailUrl : '');
      portalState.currentReferenceText = preparePassageForInitialWordsRule(rawPassageRef, rules);

      portalState.isTestPaused = false;
      portalState.isTypingTimerStarted = true;

      document.getElementById('test-modal-title').innerText = portalState.currentExamName;
      configureActiveTestModalChrome('pitman_transcription');
      updateTestSubmitMinTimeLockUI(0);
      
      const mainBody = document.getElementById('test-main-body-container');
      portalState.testPhotoZoom = 1;

      const photoTarget = (item.ThumbnailUrl && item.ThumbnailUrl !== '-' && item.ThumbnailUrl.trim() !== '') 
        ? item.ThumbnailUrl 
        : ((item.LogoUrl && item.LogoUrl !== '-' && item.LogoUrl.trim() !== '') 
            ? item.LogoUrl 
            : ((item.ContentOrUrl && String(item.ContentOrUrl).startsWith('http')) ? item.ContentOrUrl : DEFAULT_LOGO_URL));
      
      const pitmanThumbUrl = getUniversalUrl(photoTarget, 'image');

      // Requirement #3: Clean Pitman Split-Screen Workspace with Distinct Plate Image Zoom (No duplicate Full Screen triggers)
  mainBody.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 1240px; flex: 1; overflow-y: auto; padding-bottom: 20px; margin: 0 auto;">
      <div style="display: flex; gap: 16px; width: 100%; flex: 1; align-items: stretch; flex-wrap: wrap;">
      <div style="flex: 1.15 1 320px; min-width: min(100%, 300px); background: var(--surface); padding: 12px; border-radius: var(--radius); border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow); display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 6px; flex-wrap: wrap; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="color: var(--secondary); font-size: 13px;"><i class="fa-solid fa-image" style="color: var(--primary);"></i> Pitman Shorthand Plate</strong>
            <span id="pitman-photo-zoom-badge" class="mono-num" style="font-size: 11px; font-weight: 700; color: var(--primary);">100%</span>
          </div>
          <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
            <span style="font-size: 11px; color: var(--text-muted); margin-right: 2px;">Plate Zoom:</span>
            <button type="button" class="btn btn-sm btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="adjustTestPhotoZoom(-0.2)" title="Zoom Out Shorthand Plate">-</button>
            <button type="button" class="btn btn-sm btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="adjustTestPhotoZoom(0.2)" title="Zoom In Shorthand Plate">+</button>
            <button type="button" class="btn btn-sm btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="resetTestPhotoZoom()" title="Fit Plate to Stage">Fit</button>
          </div>
        </div>
        <div id="test-photo-stage" style="flex: 1; width: 100%; overflow: auto; display: block; background: #ffffff; border-radius: 8px; padding: 10px; min-height: clamp(220px, 38vh, 420px); max-height: 56vh; position: relative; text-align: center; border: 1px solid var(--border);">
          <div class="global-watermark-layer" style="opacity: 0.18; z-index: 2; pointer-events: none;"></div>
          <div id="test-photo-zoom-wrapper" style="width: 100%; min-width: 100%; display: inline-block; position: relative; z-index: 1; text-align: center;">
            <img id="test-pitman-img" src="${pitmanThumbUrl}" style="width: 100%; height: auto; max-width: 100%; max-height: clamp(220px, 48vh, 520px); object-fit: contain; display: block; margin: 0 auto;" onerror="this.src='${DEFAULT_LOGO_URL}'">
          </div>
        </div>
      </div>

      <div style="flex: 1 1 320px; min-width: min(100%, 300px); display: flex; flex-direction: column; gap: 8px;">
        <div class="test-non-essential-mobile" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <span style="font-size: 11.5px; font-weight: 700; color: var(--primary);">
            <i class="fa-solid fa-scale-balanced"></i> Active Pitman Rule: ${rules.examDisplayName || portalState.activeTestSubtabKey} · ${portalState.testDurationMinutes} Mins
          </span>
        </div>
        <textarea id="test-user-input" 
                class="form-control" 
                spellcheck="false" 
                autocorrect="off" 
                autocapitalize="off" 
                autocomplete="off" 
                style="width: 100%; flex: 1; min-height: 250px; resize: vertical; font-family: 'Segoe UI', monospace; padding: 14px; border-radius: var(--radius); box-shadow: inset 0 1px 3px var(--shadow);" 
                placeholder="Type Pitman outline transcription here (Timer is active under the selected Pitman evaluation rule)..." 
                oninput="handleTypingInputProgress()"
                onkeydown="handleTestKeyDown(event)" 
                onpaste="handleTestPaste(event)" 
                oncopy="handleTestCopy(event)" 
                oncut="handleTestCut(event)"></textarea>
      </div>
      </div>
    </div>
  `;

      document.getElementById('test-user-input').style.fontSize = (rules.defaultTextSize || 15) + 'px';
      const fontSizeBadge = document.getElementById('test-header-font-size-badge');
      if (fontSizeBadge) fontSizeBadge.textContent = (rules.defaultTextSize || 15) + 'px';
      document.getElementById('active-test-modal').style.display = 'flex'; if (typeof enterImmersiveFullscreenLock === 'function') enterImmersiveFullscreenLock('active-test-modal');
      if (window.innerWidth < 768 && typeof toggleMobileExamFocusMode === 'function') {
        toggleMobileExamFocusMode(true);
      }
      updateLiveTypingStatusBar('Ready to Type');
      if (typeof renderGlobalWatermark === 'function') {
        renderGlobalWatermark();
      }
      triggerRuleReadingTimeBeforeTest(rules, () => {
        portalState.isTypingTimerStarted = true;
        portalState.testStartTime = Date.now();
        startTestTimer(portalState.testDurationMinutes * 60);
        updateLiveTypingStatusBar('Countdown Active - Pitman Transcription');
        const inputEl = document.getElementById('test-user-input');
        if (inputEl) {
          inputEl.disabled = false;
          inputEl.placeholder = 'Type Pitman outline transcription here (Timer is active under the selected Pitman evaluation rule)...';
          inputEl.focus();
        }
      });
    }

export function buildAlphabetBar() {
    const bar = document.getElementById('alphabet-bar');
    if (!bar) return;
    bar.innerHTML = '';

    const alphabets = ['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
    alphabets.forEach(letter => {
      const btn = document.createElement('button');
      btn.className = `alpha-btn ${portalState.selectedAlphabet === letter ? 'active' : ''}`;
      btn.innerText = letter;
      btn.onclick = () => {
        portalState.selectedAlphabet = letter;
        document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderWords();
      };
      bar.appendChild(btn);
    });
  }

export function populateWordsCategoryDropdown() {
    const select = document.getElementById('words-category-filter');
    if (!select) return;

    const categories = [...new Set(portalState.materialsData.filter(m => (m.Type || '').toLowerCase() === 'word').map(m => m.Category || 'General'))].filter(Boolean);
    
    select.innerHTML = '<option value="ALL">All Categories</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.innerText = cat;
      select.appendChild(opt);
    });
    select.value = portalState.selectedCategoryFilter;
  }

export function renderWords() {
    const grid = document.getElementById('words-grid');
    if (!grid) return;

    const searchInput = document.getElementById('words-search');
    const catSelect = document.getElementById('words-category-filter');
    
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    portalState.selectedCategoryFilter = catSelect ? catSelect.value : 'ALL';

    let words = portalState.materialsData.filter(m => (m.Type || '').toLowerCase() === 'word');

    if (portalState.selectedAlphabet && portalState.selectedAlphabet !== 'ALL') {
      words = words.filter(w => (w.Title || w.Word || '').trim().toUpperCase().startsWith(portalState.selectedAlphabet));
    }

    if (portalState.selectedCategoryFilter && portalState.selectedCategoryFilter !== 'ALL') {
      words = words.filter(w => (w.Category || 'General').toLowerCase() === portalState.selectedCategoryFilter.toLowerCase());
    }

    if (search) {
      words = words.filter(w => (w.Title || w.Word || '').trim().toLowerCase().includes(search));
    }

    words = sortMaterialsLatestFirst(words);

    // 👉 Requirement #7: Stream cards progressively so large Word & Outline lists never freeze the UI
    streamRenderCardsToContainer(grid, words, (w, index) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.position = 'relative';

      const displayTitle = w.Title || w.Word || '-';
      const safeTitle = displayTitle.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const accessLevel = (w.AccessLevel || 'public').toLowerCase();
      const perms = checkMaterialAccessPermissions(accessLevel, w);
      const canView = perms.canView;
      const canDownload = perms.canDownload;

      const thumbTarget = (w.ThumbnailUrl && w.ThumbnailUrl !== '-' && w.ThumbnailUrl.trim() !== '') ? w.ThumbnailUrl : (w.ContentOrUrl || '');
      const fullTarget = (w.ContentOrUrl && w.ContentOrUrl !== '-' && w.ContentOrUrl.trim() !== '') ? w.ContentOrUrl : thumbTarget;

      const thumbUrl = getUniversalUrl(thumbTarget, 'image') || DEFAULT_LOGO_URL;
      const fullContentUrl = getUniversalUrl(fullTarget, 'image') || DEFAULT_LOGO_URL;

      let thumbHtml = '';
      let actionBtnHtml = '';
      if (canView) {
        thumbHtml = `
          <div class="rp-thumb-frame" style="background: #fff !important;">
            <img src="${thumbUrl}" loading="lazy" class="card-thumb" style="cursor: pointer;" onerror="this.onerror=null; this.src='${DEFAULT_LOGO_URL}';" onclick="openEmbeddedImageModal('${fullContentUrl}', 'Sl. No. ${index + 1} - ${safeTitle}')">
          </div>
        `;
        actionBtnHtml = `
          <div style="display:flex; gap:5px; margin-top:6px; position:relative; z-index:1;">
            <button type="button" class="btn btn-primary btn-sm" style="flex: 1; font-size: 11px; padding: 5px 8px;" onclick="openEmbeddedImageModal('${fullContentUrl}', 'Sl. No. ${index + 1} - ${safeTitle}')">
              <i class="fa-solid fa-magnifying-glass-plus"></i> Inspect
            </button>
            ${canDownload ? `<button type="button" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 5px 8px;" title="Download Outline" onclick="downloadItem('${fullContentUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${safeTitle}', '${accessLevel}', '${String(perms.targetBatch || '').replace(/'/g, "\\'")}')"><i class="fa-solid fa-download"></i></button>` : ''}
          </div>
        `;
      } else {
        thumbHtml = `
          <div class="rp-thumb-frame" style="cursor: pointer;" onclick="showToast('Access Denied: Restricted to ${perms.requiredRoleLabel.replace(/'/g, "\\'")}')">
            <img src="${thumbUrl}" loading="lazy" class="card-thumb" style="filter: blur(6px); opacity: 0.7;" onerror="this.src='${DEFAULT_LOGO_URL}'">
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3);">
              <span style="color: #fff; font-weight: 700; font-size: 10.5px; background: rgba(239,68,68,0.88); padding: 3px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-lock"></i> ${perms.requiredRoleLabel}
              </span>
            </div>
          </div>
        `;
        actionBtnHtml = `
          <button type="button" class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 6px; font-size: 11px; padding: 5px 8px; position: relative; z-index: 1;" onclick="showToast('Access Denied: Restricted to ${perms.requiredRoleLabel.replace(/'/g, "\\'")}')">
            <i class="fa-solid fa-lock"></i> Locked
          </button>
        `;
      }

      card.innerHTML = `
        ${thumbHtml}
        <div style="font-size: 10px; font-weight: 800; color: var(--primary); margin-bottom: 1px; position: relative; z-index: 1;">Sl. No. ${index + 1}</div>
        <strong style="font-size: 13px; margin-bottom: 2px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; position: relative; z-index: 1; color: var(--secondary);">${safeTitle}</strong>
        <span class="subtab-badge" style="position:relative; z-index:1; font-size: 10px; padding: 2px 7px;">📁 ${w.Category || 'General'}</span>
        ${actionBtnHtml}
      `;
      return card;
    });
  }

export function checkMaterialAccessPermissions(accessLevelRaw, itemOrTargetBatch = null) {
    // Strictly evaluate base role ONLY — Batch Monitors receive ZERO extra material view/download rights
    const isLoggedIn = Boolean(portalState.currentUser && (portalState.currentUser.userId || portalState.currentUser.email || portalState.currentUser.role));
    const role = isLoggedIn ? String(portalState.currentUser.role || 'user').toLowerCase().trim() : 'guest';
    const access = String(accessLevelRaw || 'public').toLowerCase().trim();

    let rawTargetBatch = '';
    if (itemOrTargetBatch && typeof itemOrTargetBatch === 'object') {
      rawTargetBatch = String(itemOrTargetBatch.TargetBatch || itemOrTargetBatch.targetBatch || itemOrTargetBatch.Batch || '').trim();
    } else if (typeof itemOrTargetBatch === 'string') {
      rawTargetBatch = itemOrTargetBatch.trim();
    }
    const normalizedBatch = rawTargetBatch.toUpperCase();
    const isBatchRestricted = Boolean(rawTargetBatch && normalizedBatch !== 'ALL' && normalizedBatch !== 'ALL_BATCHES' && normalizedBatch !== '-' && normalizedBatch !== 'NONE' && normalizedBatch !== 'PUBLIC');

    // Check if logged-in user is allotted to targetBatch (without granting any monitor override)
    let isInAllottedBatch = false;
    if (isBatchRestricted && isLoggedIn) {
      const targetLower = rawTargetBatch.toLowerCase();
      const directBatches = String(portalState.currentUser.batch || portalState.currentUser.Batch || '').split(',').map(b => b.trim().toLowerCase()).filter(Boolean);
      if (directBatches.includes(targetLower)) {
        isInAllottedBatch = true;
      } else if (typeof userHasBatchAssigned === 'function' && portalState.currentUser.userId) {
        try {
          isInAllottedBatch = Boolean(userHasBatchAssigned(portalState.currentUser.userId, rawTargetBatch, portalState.currentUser.batch || ''));
        } catch (e) {}
      }
    }

    const batchTag = isBatchRestricted ? rawTargetBatch : '';

    // 1. SUPERADMIN GLOBAL OVERRIDE: Can view AND download ALL materials regardless of access level or target batch
    if (role === 'superadmin') {
      return { canView: true, canDownload: true, requiredRoleLabel: 'Superadmin Full Access', targetBatch: batchTag };
    }

    // 2. PUBLIC MATERIAL: All can open & download (if batch-restricted, only allotted batch users can open/download; card still visible to all)
    if (access === 'public') {
      if (isBatchRestricted && !isInAllottedBatch && role !== 'admin') {
        return { canView: false, canDownload: false, requiredRoleLabel: `Batch: ${rawTargetBatch}`, targetBatch: batchTag };
      }
      return { canView: true, canDownload: true, requiredRoleLabel: 'Public (All Users)', targetBatch: batchTag };
    }

    // 3. USER MATERIAL: User, Member, Admin, Superadmin, and Allotted Batch User can open; NO ONE can download (except Superadmin)
    if (access === 'user' || access === 'user_viewable') {
      const canView = isBatchRestricted
        ? (isLoggedIn && (isInAllottedBatch || role === 'admin'))
        : (isLoggedIn && ['user', 'member', 'admin'].includes(role));
      return {
        canView,
        canDownload: false,
        requiredRoleLabel: isBatchRestricted ? `Batch: ${rawTargetBatch} (User+)` : 'Registered Users (View Only)',
        targetBatch: batchTag
      };
    }

    // 4. MEMBER MATERIAL: Member, Admin, Superadmin, and Allotted Batch Member can open; NO ONE can download (except Superadmin)
    if (access === 'member' || access === 'member_viewable') {
      const canView = isBatchRestricted
        ? ((role === 'member' && isInAllottedBatch) || role === 'admin')
        : (role === 'member' || role === 'admin');
      return {
        canView,
        canDownload: false,
        requiredRoleLabel: isBatchRestricted ? `Batch: ${rawTargetBatch} (Members Only)` : 'Members & Admins Only',
        targetBatch: batchTag
      };
    }

    // 5. ADMIN MATERIAL: Admin, Superadmin, and Allotted Batch User can open; NO ONE can download (except Superadmin)
    if (access === 'admin' || access === 'admin_only') {
      const canView = (role === 'admin') || (isBatchRestricted && isLoggedIn && isInAllottedBatch);
      return {
        canView,
        canDownload: false,
        requiredRoleLabel: isBatchRestricted ? `Admin / Batch: ${rawTargetBatch}` : 'Admins & Superadmin Only',
        targetBatch: batchTag
      };
    }

    // 6. SUPERADMIN MATERIAL: Superadmin ONLY can open & download
    if (access === 'superadmin' || access === 'superadmin_only') {
      return {
        canView: false,
        canDownload: false,
        requiredRoleLabel: 'Superadmin Only',
        targetBatch: batchTag
      };
    }

    // Default safe fallback: logged-in view only, no download
    return {
      canView: isLoggedIn && (!isBatchRestricted || isInAllottedBatch || role === 'admin'),
      canDownload: false,
      requiredRoleLabel: isBatchRestricted ? `Batch: ${rawTargetBatch}` : 'Registered Users',
      targetBatch: batchTag
    };
  }

export function renderMaterialsList(type, filterSubtab) {
    const grid = document.getElementById(`${type}-grid`);
    if (!grid) return;

    const normalizedTargetType = String(type || '').toLowerCase().trim();
    let items = (portalState.materialsData || []).filter(m => isMaterialTypeMatch(m.Type || m.type, normalizedTargetType));

    const searchInput = document.getElementById(`${type}-search-input`);
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (filterSubtab && filterSubtab !== 'ALL' && !searchQuery) {
      const normalizedFilterSubtab = String(filterSubtab).toLowerCase().trim();
      items = items.filter(m => String(m.Subtab ?? '').toLowerCase().trim() === normalizedFilterSubtab);
    }

    if (searchQuery) {
      items = items.filter(m => 
        String(m.Title ?? '').toLowerCase().includes(searchQuery) ||
        String(m.Category ?? '').toLowerCase().includes(searchQuery) ||
        String(m.Subtab ?? '').toLowerCase().includes(searchQuery)
      );
    }

    items = sortMaterialsLatestFirst(items);

    streamRenderCardsToContainer(grid, items, (item) => {
      const accessLevel = String(item.AccessLevel || 'public').toLowerCase();
      const perms = checkMaterialAccessPermissions(accessLevel, item);
      const canView = perms.canView;
      const canDownload = perms.canDownload;
      const batchTagSafe = String(perms.targetBatch || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      const materialType = String(item.Type || '').toLowerCase();

      const card = document.createElement('div');
      card.className = 'card';
      card.style.position = 'relative';

      const defaultThumb = getThumbnailUrl(item);
      const displayTitle = String(item.Title ?? item.Name ?? item.Word ?? '-');
      const safeTitle = displayTitle.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeUrl = String(item.ContentOrUrl ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      let actionButtonsHtml = '';
      let thumbHtml = '';

      if (canView) {
        thumbHtml = `
          <div class="rp-thumb-frame" style="background: #fff !important;">
            <img src="${defaultThumb}" loading="lazy" class="card-thumb" onerror="this.onerror=null; this.src='${DEFAULT_LOGO_URL}'">
          </div>
        `;
        
        if (materialType === 'audio') {
          actionButtonsHtml = `
            <div style="margin-top:6px; display:flex; gap:5px; position:relative; z-index:1;">
              <button class="btn btn-primary btn-sm" style="flex:1; font-size:11px; padding:5px 8px;" onclick="startAudioDictationTestById('${item.ID || item.id}')">
                <i class="fa-solid fa-headphones"></i> Dictation &amp; Transcribe
              </button>
              ${canDownload ? `<button class="btn btn-secondary btn-sm" style="font-size:11px; padding:5px 8px;" title="Download Audio" onclick="downloadItem('${safeUrl}', '${safeTitle}', '${accessLevel}', '${batchTagSafe}')"><i class="fa-solid fa-download"></i></button>` : ''}
            </div>
          `;
        } else {
          actionButtonsHtml = `
            <div style="margin-top:6px; display:flex; gap:5px; position:relative; z-index:1;">
              <button class="btn btn-primary btn-sm" style="flex:1; font-size:11px; padding:5px 8px;" onclick="viewItem('${type}', '${safeUrl}', '${safeTitle}', '${accessLevel}', '${batchTagSafe}')"><i class="fa-solid fa-eye"></i> View</button>
              ${canDownload ? `<button class="btn btn-secondary btn-sm" style="font-size:11px; padding:5px 8px;" title="Download Material" onclick="downloadItem('${safeUrl}', '${safeTitle}', '${accessLevel}', '${batchTagSafe}')"><i class="fa-solid fa-download"></i></button>` : `<span style="font-size:9.5px; font-weight:700; color:var(--text-muted); display:inline-flex; align-items:center; padding:0 4px;" title="View Only — Download Disabled"><i class="fa-solid fa-ban" style="margin-right:2px;"></i> View Only</span>`}
            </div>
          `;
        }
      } else {
        thumbHtml = `
          <div class="rp-thumb-frame" style="cursor: pointer;" onclick="showToast('Access Denied: Restricted to ${perms.requiredRoleLabel.replace(/'/g, "\\'")}')">
            <img src="${defaultThumb}" loading="lazy" class="card-thumb" style="filter: blur(6px); opacity: 0.7;" onerror="this.src='${DEFAULT_LOGO_URL}'">
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3);">
              <span style="color: #fff; font-weight: 700; font-size: 10.5px; background: rgba(239,68,68,0.88); padding: 3px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-lock"></i> ${perms.requiredRoleLabel}
              </span>
            </div>
          </div>
        `;
        actionButtonsHtml = `
          <div style="margin-top:6px; position:relative; z-index:1;">
            <button class="btn btn-secondary btn-sm" style="width:100%; font-size:11px; padding:5px 8px; background: var(--border); color: var(--text-muted); cursor: pointer;" onclick="showToast('Access Denied: Restricted to ${perms.requiredRoleLabel.replace(/'/g, "\\'")}')">
              <i class="fa-solid fa-lock"></i> Locked
            </button>
          </div>
        `;
      }

      let audioMasterWordsBadgeHtml = '';
      if (materialType === 'audio') {
        const audioMasterText = (item.ThumbnailUrl && item.ThumbnailUrl !== '-' && !/^https?:\/\//i.test(String(item.ThumbnailUrl).trim()))
          ? item.ThumbnailUrl
          : ((!(/^https?:\/\//i.test(String(item.ContentOrUrl || '').trim()))) ? (item.ContentOrUrl || '') : '');
        const audioMasterWordsCount = countMasterPassageWords(audioMasterText);
        const audioMasterStrokesCount = countMasterPassageStrokes(audioMasterText);
        audioMasterWordsBadgeHtml = `<span class="subtab-badge" style="position:relative; z-index:1; margin-top:2px; font-size:10px; padding:2px 7px; background:rgba(37,99,235,0.12); color:var(--primary); font-weight:800;">📝 ${audioMasterWordsCount} W • ⌨️ ${audioMasterStrokesCount} Strokes</span>`;
      }

      const batchMetaStr = perms.targetBatch ? ` • 🎯 ${perms.targetBatch}` : '';
      card.innerHTML = `
        ${thumbHtml}
        <strong style="position:relative; z-index:1; font-size:13px; line-height:1.32; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; color:var(--secondary);">${safeTitle}</strong>
        <span class="subtab-badge" style="position:relative; z-index:1; font-size:10px; padding:2px 7px;">📂 ${item.Subtab || item.Category || 'General'} • 🔒 ${accessLevel.toUpperCase()}${batchMetaStr}</span>
        ${audioMasterWordsBadgeHtml}
        ${actionButtonsHtml}
      `;
      return card;
    });
  }

export function viewItem(type, url, title, accessLevel = 'public', targetBatch = '') {
    if (typeof isActionBlockedByUnverifiedEmail === 'function' && isActionBlockedByUnverifiedEmail('viewing study materials')) return;
    const perms = checkMaterialAccessPermissions(accessLevel, targetBatch);
    if (!perms.canView) {
      showToast(`Access Denied: Restricted to ${perms.requiredRoleLabel}.`);
      return;
    }

    logPortalAction('VIEW_MATERIAL', `Opened & viewed ${type.toUpperCase()} material: ${title} [Access: ${accessLevel}${targetBatch ? ' | Batch: ' + targetBatch : ''}]`);
    openPdfModal(url, title);
  }

export async function downloadItem(url, title, accessLevel = 'public', targetBatch = '') {
    if (typeof isActionBlockedByUnverifiedEmail === 'function' && isActionBlockedByUnverifiedEmail('downloading study materials')) return;
    const perms = checkMaterialAccessPermissions(accessLevel, targetBatch);
    if (!perms.canDownload) {
      showToast('Download Denied: Only Public materials or Superadmin can download this file.');
      return;
    }
    logPortalAction('DOWNLOAD_MATERIAL', `Downloaded material: ${title} [Access: ${accessLevel}${targetBatch ? ' | Batch: ' + targetBatch : ''}]`);

    const rawUrl = String(url || '').trim();
    const fileUrl = getUniversalUrl(rawUrl, 'download');
    const cleanFileName = `${(title || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    showLoader(true);
    try {
      let existingPdfBytes = null;

      // 1. Handle Data URI / Base64 PDF directly
      if (rawUrl.startsWith('data:application/pdf;base64,')) {
        const b64 = rawUrl.split(',')[1] || '';
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        existingPdfBytes = bytes.buffer;
      }

      // 2. If Google Drive link, try fetching raw bytes via Apps Script backend proxy
      if (!existingPdfBytes && (rawUrl.includes('drive.google.com') || rawUrl.includes('docs.google.com'))) {
        try {
          const proxyRes = await apiCall('getDriveFileBase64', { fileUrl: rawUrl, url: rawUrl }, true);
          if (proxyRes && proxyRes.success && proxyRes.base64) {
            const binaryString = atob(proxyRes.base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            existingPdfBytes = bytes.buffer;
          }
        } catch (proxyErr) {}
      }

      // 3. Try direct fetch if HTTP(S) URL
      if (!existingPdfBytes && /^https?:\/\//i.test(fileUrl)) {
        try {
          const resp = await fetch(fileUrl);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            if (buf && buf.byteLength > 100) {
              existingPdfBytes = buf;
            }
          }
        } catch (fetchErr) {
          existingPdfBytes = null;
        }
      }

      // 4. If we obtained the actual PDF bytes, apply watermark via PDFLib (or download raw bytes if encrypted)
      if (existingPdfBytes) {
        try {
          const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
          const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
          const pages = pdfDoc.getPages();
          const watermarkText = getWatermarkText();

          pages.forEach(page => {
            const { width, height } = page.getSize();
            const fontSize = 12;
            const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, fontSize);
            page.drawText(watermarkText, {
              x: Math.max(20, (width - textWidth) / 2),
              y: height - 20,
              size: fontSize,
              font: helveticaFont,
              color: PDFLib.rgb(0.85, 0.1, 0.1),
              opacity: 0.85
            });
            [height * 0.28, height * 0.55, height * 0.8].forEach(yPos => {
              page.drawText(watermarkText, {
                x: Math.max(40, width / 2 - textWidth * 0.75),
                y: yPos,
                size: 20,
                font: helveticaFont,
                color: PDFLib.rgb(0.85, 0.1, 0.1),
                opacity: 0.14,
                rotate: PDFLib.degrees(-35)
              });
            });
          });

          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const objUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objUrl;
          link.download = cleanFileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch (e) {} }, 3000);
          showLoader(false);
          showToast('✅ PDF downloaded successfully!');
          return;
        } catch (pdfLibErr) {
          const blob = new Blob([existingPdfBytes], { type: 'application/pdf' });
          const objUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objUrl;
          link.download = cleanFileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch (e) {} }, 3000);
          showLoader(false);
          showToast('✅ PDF downloaded successfully!');
          return;
        }
      }

      // 5. If rawUrl is plain text content (not a URL), generate a complete multi-page PDF of the text
      if (rawUrl && !/^https?:\/\//i.test(rawUrl) && typeof PDFLib !== 'undefined') {
        const pdfDoc = await PDFLib.PDFDocument.create();
        const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const fontReg = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        const words = rawUrl.split(/\s+/);
        const lines = [];
        let curLine = '';
        words.forEach(w => {
          if ((curLine + ' ' + w).trim().length > 82) {
            lines.push(curLine.trim());
            curLine = w;
          } else {
            curLine = (curLine + ' ' + w).trim();
          }
        });
        if (curLine.trim()) lines.push(curLine.trim());

        const linesPerPage = 36;
        const totalPages = Math.max(1, Math.ceil(lines.length / linesPerPage));
        for (let p = 0; p < totalPages; p++) {
          const page = pdfDoc.addPage([595.28, 841.89]);
          page.drawText(`${title || 'Study Material'} (Page ${p + 1} of ${totalPages})`, { x: 45, y: 795, size: 13, font: fontBold, color: PDFLib.rgb(0.1, 0.15, 0.35) });
          const slice = lines.slice(p * linesPerPage, (p + 1) * linesPerPage);
          let y = 760;
          slice.forEach(ln => {
            page.drawText(ln, { x: 45, y, size: 10.5, font: fontReg, color: PDFLib.rgb(0.1, 0.1, 0.1) });
            y -= 19;
          });
        }
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const objUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objUrl;
        link.download = cleanFileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch (e) {} }, 3000);
        showLoader(false);
        showToast('✅ PDF generated & downloaded!');
        return;
      }

      // 6. Direct browser download fallback for cross-origin Google Drive / external PDF links
      let directDownloadUrl = fileUrl;
      const driveMatch = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (driveMatch && driveMatch[1]) {
        directDownloadUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
      }
      const dlLink = document.createElement('a');
      dlLink.href = directDownloadUrl;
      dlLink.download = cleanFileName;
      dlLink.target = '_blank';
      dlLink.rel = 'noopener noreferrer';
      document.body.appendChild(dlLink);
      dlLink.click();
      dlLink.remove();
      showLoader(false);
      showToast('📥 Direct PDF download started!');
    } catch (e) {
      showLoader(false);
      showToast('Error downloading PDF: ' + e.message);
    }
  }

export function getUniversalUrl(url, type = 'default') {
    const rawStr = (url !== undefined && url !== null) ? String(url).trim() : '';
    if (!rawStr || rawStr === '' || rawStr === '-') return DEFAULT_LOGO_URL;
    let processedUrl = rawStr;

    if (processedUrl.includes('youtube.com') || processedUrl.includes('youtu.be')) {
      let videoId = '';
      if (processedUrl.includes('watch?v=')) {
        videoId = processedUrl.split('watch?v=')[1]?.split('&')[0];
      } else if (processedUrl.includes('youtu.be/')) {
        videoId = processedUrl.split('youtu.be/')[1]?.split('?')[0];
      } else if (processedUrl.includes('embed/')) {
        videoId = processedUrl.split('embed/')[1]?.split('?')[0];
      } else if (processedUrl.includes('shorts/')) {
        videoId = processedUrl.split('shorts/')[1]?.split('?')[0];
      }
      if (videoId) {
        if (type === 'image') {
          return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
      }
    }

    if (processedUrl.includes('drive.google.com') || processedUrl.includes('docs.google.com')) {
      const match = processedUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || processedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const fileId = match[1];
        if (type === 'image' || type === 'zoom') {
          return `https://lh3.googleusercontent.com/d/${fileId}=s1600`;
        }
        if (type === 'download' || type === 'audio') {
          return `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }

    if (processedUrl.includes('github.com')) {
      if (processedUrl.includes('/blob/')) {
        processedUrl = processedUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }
    }

    return processedUrl;
  }

export function closeModal() {
    const modal = document.getElementById('reader-modal');
    if (modal) {
      modal.querySelectorAll('audio, video').forEach(el => {
        try {
          el.pause();
          el.currentTime = 0;
          el.removeAttribute('src');
          el.load();
        } catch (e) {}
      });
      modal.querySelectorAll('iframe').forEach(ifr => {
        try { ifr.src = 'about:blank'; } catch (e) {}
      });
      modal.style.display = 'none';
    }
    const viewport = document.getElementById('modal-viewport');
    if (viewport) viewport.innerHTML = '';
    
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    exitImmersiveFullscreenLock('reader-modal');
    if (window._returnToOriginTabOnCloseComparison) {
      const originTab = window.lastOriginTabBeforeTest || window.currentActiveViewName || portalState.activeTab || 'dashboard';
      window._returnToOriginTabOnCloseComparison = false;
      if (portalState.activeTab !== originTab) {
        navigateTo(originTab, false, true);
      }
    }
  }

export function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }

export let timerWarningTriggered = false;

export function toggleMobileExamFocusMode(forceState) {
      const nextState = typeof forceState === 'boolean'
        ? forceState
        : !document.body.classList.contains('mobile-exam-focus-mode');
      document.body.classList.toggle('mobile-exam-focus-mode', nextState);
      ['btn-mobile-exam-focus-toggle', 'mobile-exam-focus-toggle-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.style.background = nextState ? 'rgba(16,185,129,0.18)' : '';
          btn.style.borderColor = nextState ? '#10b981' : 'rgba(37,99,235,0.35)';
          btn.style.color = nextState ? '#059669' : 'var(--primary)';
          btn.innerHTML = nextState
            ? '<i class="fa-solid fa-sliders"></i> <span id="mobile-exam-focus-label">Exit Compact</span>'
            : '<i class="fa-solid fa-sliders"></i> <span id="mobile-exam-focus-label">Compact</span>';
        }
      });
    }

export function updateVisualTimerDisplayAndProgressBar(secondsLeft, totalSeconds, isCountUpMode = false) {
      const timerElem = document.getElementById('test-timer');
      const progressWrap = document.getElementById('test-timer-visual-progress-wrap');
      const progressFill = document.getElementById('test-timer-visual-progress-fill');
      const pillWrap = document.getElementById('test-timer-pill-wrap');

      if (isCountUpMode) {
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        if (timerElem) {
          timerElem.innerText = `⏱️ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} (User Time)`;
          timerElem.style.color = '#fbbf24';
        }
        if (progressFill) {
          progressFill.style.width = '100%';
          progressFill.style.background = 'linear-gradient(90deg, #38bdf8, #818cf8)';
        }
        return;
      }

      const safeLeft = Math.max(0, Math.floor(Number(secondsLeft) || 0));
      const safeTotal = Math.max(1, Math.floor(Number(totalSeconds) || 1));
      const pctRemaining = Math.max(0, Math.min(100, (safeLeft / safeTotal) * 100));

      const mins = Math.floor(safeLeft / 60);
      const secs = safeLeft % 60;
      const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      if (timerElem) {
        timerElem.innerText = formattedTime;
        if (safeLeft <= 60) {
          timerElem.style.color = '#fecaca';
        } else if (safeLeft <= 120) {
          timerElem.style.color = '#fde68a';
        } else {
          timerElem.style.color = '#fbbf24';
        }
      }

      if (progressWrap) progressWrap.style.display = 'block';
      if (progressFill) {
        progressFill.style.width = `${pctRemaining.toFixed(1)}%`;
        if (safeLeft <= 60) {
          progressFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
        } else if (safeLeft <= 120) {
          progressFill.style.background = 'linear-gradient(90deg, #f59e0b, #ea580c)';
        } else {
          progressFill.style.background = 'linear-gradient(90deg, #10b981, #fbbf24)';
        }
      }

      if (pillWrap) {
        if (safeLeft <= 60 && safeLeft > 0) {
          pillWrap.style.background = 'rgba(220, 38, 38, 0.35)';
          pillWrap.style.borderColor = '#ef4444';
          pillWrap.style.animation = 'visualPulse 0.85s infinite alternate';
        } else if (safeLeft <= 120 && safeLeft > 60) {
          pillWrap.style.background = 'rgba(245, 158, 11, 0.25)';
          pillWrap.style.borderColor = '#f59e0b';
          pillWrap.style.animation = 'none';
        } else {
          pillWrap.style.background = 'rgba(15, 23, 42, 0.55)';
          pillWrap.style.borderColor = 'rgba(251, 191, 36, 0.45)';
          pillWrap.style.animation = 'none';
        }
      }
    }

export function startTestTimer(secondsRemaining) {
      if (portalState.testTimerInterval) clearInterval(portalState.testTimerInterval);
      const isCountUp = Boolean(window.isCountUpTimerMode);
      const totalInitialSeconds = Math.max(0, Math.round(Number(secondsRemaining) || 0));
      portalState.secondsRemainingGlobal = totalInitialSeconds;
      let elapsedCountUpSeconds = 0;
      timerWarningTriggered = false;
      updateTestSubmitMinTimeLockUI(0);

      // Immediately render the starting countdown state on #test-timer and visual progress bar
      updateVisualTimerDisplayAndProgressBar(isCountUp ? 0 : portalState.secondsRemainingGlobal, totalInitialSeconds || 1, isCountUp);

      portalState.testTimerInterval = setInterval(() => {
        if (portalState.isTestPaused || window.__examOfflinePaused) return;

        if (window.activeScheduledLiveTestEndTime && Date.now() >= window.activeScheduledLiveTestEndTime) {
          clearInterval(portalState.testTimerInterval);
          portalState.testTimerInterval = null;
          updateVisualTimerDisplayAndProgressBar(0, totalInitialSeconds || 1, false);
          showToast('⏰ Scheduled Live Test End Time Reached! Submitting test automatically.');
          submitStenoTest();
          return;
        }

        if (isCountUp) {
          elapsedCountUpSeconds++;
          updateTestSubmitMinTimeLockUI(elapsedCountUpSeconds);
          updateVisualTimerDisplayAndProgressBar(elapsedCountUpSeconds, totalInitialSeconds || 1, true);
          return;
        }

        portalState.secondsRemainingGlobal = Math.max(0, portalState.secondsRemainingGlobal - 1);

        const elapsedSecNow = portalState.testStartTime > 0
          ? Math.max(0, Math.floor((Date.now() - portalState.testStartTime) / 1000))
          : Math.max(0, totalInitialSeconds - portalState.secondsRemainingGlobal);
        updateTestSubmitMinTimeLockUI(elapsedSecNow);

        checkTimerWarning(portalState.secondsRemainingGlobal);
        updateVisualTimerDisplayAndProgressBar(portalState.secondsRemainingGlobal, totalInitialSeconds || 1, false);

        if (portalState.secondsRemainingGlobal <= 0) {
          clearInterval(portalState.testTimerInterval);
          portalState.testTimerInterval = null;
          showToast('⏰ Time is up! Submitting test automatically.');
          submitStenoTest();
        }
      }, 1000);
    
  try { portalHooks.emit('afterTestTimerStart', ...arguments); } catch (_hk) {}
}

export function checkTimerWarning(secondsRemaining) {
      const modalHeader = document.querySelector('#active-test-modal .modal-header');
      if (secondsRemaining <= 60 && secondsRemaining > 0) {
        if (modalHeader) {
          modalHeader.style.animation = 'visualPulse 1s infinite alternate';
        }
        if (!timerWarningTriggered && secondsRemaining === 60) {
          playWarningBeep();
          showToast('⚠️ Warning: Only 1 minute remaining!');
          timerWarningTriggered = true;
        }
      } else {
        if (modalHeader) modalHeader.style.animation = 'none';
      }
    }

export function playWarningBeep() {
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtxClass) return;
        if (!window._sharedWarningAudioCtx || window._sharedWarningAudioCtx.state === 'closed') {
          window._sharedWarningAudioCtx = new AudioCtxClass();
        }
        const audioCtx = window._sharedWarningAudioCtx;
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
        osc.onended = () => {
          try { osc.disconnect(); gain.disconnect(); } catch (e) {}
        };
      } catch (e) {}
    }

export async function submitStenoTest(event) {
  try { portalHooks.emit('beforeStenoTestSubmit', ...arguments); } catch (_hk) {}

  if (event) event.preventDefault();

  const rules = window.currentExamRules || getEvaluationRulesForTab(portalState.activeTestSubtabKey);
  if (!rules) {
    showToast('⚠️ No evaluation rule is there! Admin must configure an Evaluation Rule before submitting.');
    return;
  }
  const currentElapsedSec = portalState.testStartTime > 0 ? Math.max(0, Math.floor((Date.now() - portalState.testStartTime) / 1000)) : 0;
  const minTimeRequiredSec = Math.max(0, parseInt(rules.minTimeSeconds) || 0);

  // 👉 Requirement #10: Block manual submission before Min Time Period (Seconds) is over
  if (event && minTimeRequiredSec > 0 && currentElapsedSec < minTimeRequiredSec) {
    const waitSec = Math.max(1, minTimeRequiredSec - currentElapsedSec);
    showToast(`🔒 Cannot submit yet! Minimum Time Period is ${minTimeRequiredSec}s (${waitSec}s remaining).`);
    updateTestSubmitMinTimeLockUI(currentElapsedSec);
    return;
  }

  if (portalState.testTimerInterval) clearInterval(portalState.testTimerInterval);
  if (typeof stopExamHallSynth === 'function') stopExamHallSynth();
  if (typeof toggleMobileExamFocusMode === 'function') toggleMobileExamFocusMode(false);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

  const userInputElem = document.getElementById('test-user-input');
  const typedText = userInputElem ? userInputElem.value.trim() : '';
  const referenceText = portalState.currentReferenceText.trim() || "The rapid advancement of digital infrastructure across the nation requires skilled stenographers who can maintain high accuracy under pressure.";

  const timeElapsedSeconds = portalState.testStartTime > 0 ? Math.max(1, Math.floor((Date.now() - portalState.testStartTime) / 1000)) : 60;
  const timeUsedMinutes = (timeElapsedSeconds / 60).toFixed(2);
  const durationMins = Math.max(0.01, timeElapsedSeconds / 60);
  const submissionTimeFormatted = new Date().toLocaleTimeString();

  const adminDurationMins = Math.max(1, parseFloat(portalState.testDurationMinutes || rules.timeLimit || 5));

  let paraNotChangedCount = 0;
  if (rules.ignoreParagraphChange === 'no') {
    const refParas = referenceText.split(/[\r\n]+/).filter(p => p.trim().length > 0);
    const userParas = typedText.split(/[\r\n]+/).filter(p => p.trim().length > 0);
    if (refParas.length !== userParas.length) {
      paraNotChangedCount = Math.abs(refParas.length - userParas.length);
    }
  }

  const refTextEval = rules.ignoreParagraphChange === 'yes' ? referenceText.replace(/[\r\n]+/g, ' ') : referenceText;
  const userTextEval = rules.ignoreParagraphChange === 'yes' ? typedText.replace(/[\r\n]+/g, ' ') : typedText;

  const isStenoExam = (portalState.currentExamName || '').toLowerCase().includes('audio') ||
                      (portalState.currentExamName || '').toLowerCase().includes('steno') ||
                      (portalState.currentExamName || '').toLowerCase().includes('pitman') ||
                      (portalState.activeTestSubtabKey || '').startsWith('exam_') ||
                      (portalState.activeTestSubtabKey || '').startsWith('audio') ||
                      (portalState.activeTestSubtabKey || '').startsWith('pitman');
  const punctMode = rules.punctRuleMode || (isStenoExam ? 'fullstop_only' : 'all');

  // 👉 Requirement #14: Global Verb Root helper shared by submitStenoTest() and openTestComparison()
  if (!window.IRREGULAR_VERB_MAP) {
    window.IRREGULAR_VERB_MAP = {
      'am':'be','is':'be','are':'be','was':'be','were':'be','been':'be','being':'be',
      'has':'have','had':'have','having':'have',
      'does':'do','did':'do','done':'do','doing':'do',
      'went':'go','gone':'go','going':'go','goes':'go',
      'came':'come','coming':'come','comes':'come',
      'saw':'see','seen':'see','seeing':'see','sees':'see',
      'took':'take','taken':'take','taking':'take','takes':'take',
      'made':'make','making':'make','makes':'make',
      'knew':'know','known':'know','knowing':'know','knows':'know',
      'gave':'give','given':'give','giving':'give','gives':'give',
      'found':'find','finding':'find','finds':'find',
      'thought':'think','thinking':'think','thinks':'think',
      'told':'tell','telling':'tell','tells':'tell',
      'became':'become','becoming':'become','becomes':'become',
      'showed':'show','shown':'show','showing':'show','shows':'show',
      'left':'leave','leaving':'leave','leaves':'leave',
      'felt':'feel','feeling':'feel','feels':'feel',
      'brought':'bring','bringing':'bring','brings':'bring',
      'began':'begin','begun':'begin','beginning':'begin','begins':'begin',
      'kept':'keep','keeping':'keep','keeps':'keep',
      'held':'hold','holding':'hold','holds':'hold',
      'wrote':'write','written':'write','writing':'write','writes':'write',
      'stood':'stand','standing':'stand','stands':'stand',
      'heard':'hear','hearing':'hear','hears':'hear',
      'meant':'mean','meaning':'mean','means':'mean',
      'met':'meet','meeting':'meet','meets':'meet',
      'paid':'pay','paying':'pay','pays':'pay',
      'sat':'sit','sitting':'sit','sits':'sit',
      'spoke':'speak','spoken':'speak','speaking':'speak','speaks':'speak',
      'led':'lead','leading':'lead','leads':'lead',
      'grew':'grow','grown':'grow','growing':'grow','grows':'grow',
      'lost':'lose','losing':'lose','loses':'lose',
      'fell':'fall','fallen':'fall','falling':'fall','falls':'fall',
      'sent':'send','sending':'send','sends':'send',
      'built':'build','building':'build','builds':'build',
      'understood':'understand','understanding':'understand','understands':'understand',
      'drew':'draw','drawn':'draw','drawing':'draw','draws':'draw',
      'broke':'break','broken':'break','breaking':'break','breaks':'break',
      'spent':'spend','spending':'spend','spends':'spend',
      'bought':'buy','buying':'buy','buys':'buy',
      'rose':'rise','risen':'rise','rising':'rise','rises':'rise',
      'drove':'drive','driven':'drive','driving':'drive','drives':'drive',
      'chose':'choose','chosen':'choose','choosing':'choose','chooses':'choose'
    };
  }

  if (typeof window.getVerbRoot !== 'function') {
    window.getVerbRoot = function(w) {
      if (!w) return '';
      if (window.IRREGULAR_VERB_MAP[w]) return window.IRREGULAR_VERB_MAP[w];
      if (w.endsWith('ied') && w.length > 4) return w.slice(0, -3) + 'y';
      if (w.endsWith('ying') && w.length > 5) return w.slice(0, -4) + 'ie';
      if (w.endsWith('ing') && w.length > 4) {
        let base = w.slice(0, -3);
        if (base.length >= 3 && base[base.length - 1] === base[base.length - 2] && !/[aeiou]/.test(base[base.length - 1])) {
          base = base.slice(0, -1);
        }
        return base;
      }
      if (w.endsWith('ed') && w.length > 3) {
        let base = w.slice(0, -2);
        if (base.endsWith('e')) return base;
        if (base.length >= 3 && base[base.length - 1] === base[base.length - 2] && !/[aeiou]/.test(base[base.length - 1])) {
          base = base.slice(0, -1);
        }
        return base;
      }
      if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
      if (w.endsWith('es') && w.length > 3) return w.slice(0, -2);
      if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
      return w;
    };
  }
  const getVerbRoot = window.getVerbRoot;

  const parseToken = (token) => {
    const cleanRaw = token.replace(/^[.,\/#!$%\^&\*;:{}=\-_`~()\[\]?+'"]+|[.,\/#!$%\^&\*;:{}=\-_`~()\[\]?+'"]+$/g, '');
    let punct = '';
    if (punctMode === 'fullstop_only') {
      punct = (token.match(/\./g) || []).join('');
    } else if (punctMode === 'ignore') {
      punct = '';
    } else {
      punct = (token.match(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]?+'"]/g) || []).join('');
    }
    
    let lower = cleanRaw.toLowerCase();
    let stem = lower;
    if (lower.endsWith('ies') && lower.length > 3) {
      stem = lower.slice(0, -3) + 'y';
    } else if (lower.endsWith('es') && lower.length > 3) {
      stem = lower.slice(0, -2);
    } else if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 2) {
      stem = lower.slice(0, -1);
    }
    const verbRoot = getVerbRoot(lower);

    return { raw: token, cleanRaw: cleanRaw, word: lower, stem: stem, verbRoot: verbRoot, punct: punct };
  };

  const refTokens = refTextEval.split(/\s+/).filter(Boolean).map(parseToken);
  const userTokens = userTextEval.split(/\s+/).filter(Boolean).map(parseToken);
  
  const totalCharacter = refTextEval.length;
  const totalTypedCharacter = userTextEval.length;

  // 👉 Requirement #12: Word Counting Rule — '1word' (1 space = 1 word) vs '5stroke' (5 strokes = 1 word)
  const is5StrokeRule = (rules.wordCountRule === '5stroke');
  const totalWordsOriginal = is5StrokeRule
    ? Math.max(1, Number((totalCharacter / 5).toFixed(2)))
    : Math.max(1, refTokens.length);
  const totalTypedWords = is5StrokeRule
    ? Number((totalTypedCharacter / 5).toFixed(2))
    : userTokens.length;

  const minGrossStrokePct = rules.minGrossStrokePct !== undefined ? rules.minGrossStrokePct : 80;
  const requiredGrossStrokes = Math.round((totalCharacter * minGrossStrokePct) / 100);
  const meetsMinGrossStroke = totalTypedCharacter >= requiredGrossStrokes;

  if (!meetsMinGrossStroke) {
    showToast(`Warning: Minimum gross stroke required is ${requiredGrossStrokes} (${minGrossStrokePct}% of ${totalCharacter} strokes). You typed ${totalTypedCharacter}.`);
  }

  const isSingularPluralPairEval = (w1, w2, s1, s2) => {
    if (!w1 || !w2 || w1 === w2) return false;
    if (s1 && s2 && s1 === s2) return true;
    const irregularPlurals = {
      'child': 'children', 'children': 'child',
      'man': 'men', 'men': 'man',
      'woman': 'women', 'women': 'woman',
      'person': 'people', 'people': 'person',
      'foot': 'feet', 'feet': 'foot',
      'tooth': 'teeth', 'teeth': 'tooth',
      'mouse': 'mice', 'mice': 'mouse',
      'datum': 'data', 'data': 'datum',
      'criterion': 'criteria', 'criteria': 'criterion',
      'phenomenon': 'phenomena', 'phenomena': 'phenomenon',
      'analysis': 'analyses', 'analyses': 'analysis',
      'basis': 'bases', 'bases': 'basis',
      'crisis': 'crises', 'crises': 'crisis',
      'index': 'indices', 'indices': 'index',
      'leaf': 'leaves', 'leaves': 'leaf',
      'life': 'lives', 'lives': 'life',
      'wife': 'wives', 'wives': 'wife',
      'wolf': 'wolves', 'wolves': 'wolf'
    };
    if (irregularPlurals[w1] === w2) return true;
    if (w1 + 's' === w2 || w2 + 's' === w1) return true;
    if (w1 + 'es' === w2 || w2 + 'es' === w1) return true;
    if ((w1.endsWith('y') && w1.slice(0, -1) + 'ies' === w2) || (w2.endsWith('y') && w2.slice(0, -1) + 'ies' === w1)) return true;
    return false;
  };

  const m = refTokens.length;
  const n = userTokens.length;
  const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const rTok = refTokens[i - 1];
      const uTok = userTokens[j - 1];
      const isSingPlur = isSingularPluralPairEval(rTok.word, uTok.word, rTok.stem, uTok.stem);
      const isVerbMatch = rTok.verbRoot && uTok.verbRoot && (
        rTok.verbRoot === uTok.verbRoot ||
        rTok.verbRoot + 'e' === uTok.verbRoot ||
        uTok.verbRoot + 'e' === rTok.verbRoot
      );
      if (rTok.word === uTok.word || isSingPlur || rTok.stem === uTok.stem || isVerbMatch) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m, j = n;
  let wrongTypedCount = 0;
  let verbFormErrorCount = 0;
  let singularPluralErrorCount = 0;
  let capitalErrorCount = 0;
  let wordLeftCount = 0;
  let extraTypedCount = 0;
  let punctuationLeftCount = 0;
  let punctuationExtraCount = 0;
  let punctuationWrongCount = 0;

  const totalMarks = rules.totalMarks !== undefined ? parseFloat(rules.totalMarks) : 100;
  const deductWrong = rules.deductWrong !== undefined ? parseFloat(rules.deductWrong) : 1.0;
  const deductOmission = rules.deductOmission !== undefined ? parseFloat(rules.deductOmission) : 1.0;
  const deductVerbForm = rules.deductVerbForm !== undefined ? parseFloat(rules.deductVerbForm) : 0.5;
  const deductSingularPlural = rules.deductSingularPlural !== undefined ? parseFloat(rules.deductSingularPlural) : 0.5;
  const deductPunctuation = rules.deductPunctuation !== undefined ? parseFloat(rules.deductPunctuation) : 0.5;
  const deductCapital = rules.deductCapital !== undefined ? parseFloat(rules.deductCapital) : 0.25;
  const deductExtraWord = rules.deductExtraWord !== undefined ? parseFloat(rules.deductExtraWord) : 0.5;
  const deductParaNotChanged = rules.deductParaNotChanged !== undefined ? parseFloat(rules.deductParaNotChanged) : 1.0;

  const pickHighestWordMistake = (candidates) => {
    if (!candidates || candidates.length === 0) return null;
    candidates.sort((a, b) => b.deduct - a.deduct);
    return candidates[0];
  };

  const detectedMistakeWordsInTest = [];

  const applySingleHighestMistakeToCounters = (candidates, expectedWordClean = '', typedWordClean = '') => {
    const chosen = pickHighestWordMistake(candidates);
    if (!chosen) return;
    if (chosen.type === 'wrong') {
      wrongTypedCount++;
      if (expectedWordClean && expectedWordClean.length >= 2) {
        detectedMistakeWordsInTest.push({ word: expectedWordClean, typed: typedWordClean || '-', type: 'wrong' });
      }
    } else if (chosen.type === 'singular_plural') {
      singularPluralErrorCount++;
      if (expectedWordClean && expectedWordClean.length >= 2) {
        detectedMistakeWordsInTest.push({ word: expectedWordClean, typed: typedWordClean || '-', type: 'singular_plural' });
      }
    } else if (chosen.type === 'verb') {
      verbFormErrorCount++;
      if (expectedWordClean && expectedWordClean.length >= 2) {
        detectedMistakeWordsInTest.push({ word: expectedWordClean, typed: typedWordClean || '-', type: 'verb' });
      }
    } else if (chosen.type === 'capital') {
      capitalErrorCount++;
    } else if (chosen.type === 'extra') {
      extraTypedCount++;
    } else if (chosen.type === 'left') {
      wordLeftCount++;
      if (expectedWordClean && expectedWordClean.length >= 2) {
        detectedMistakeWordsInTest.push({ word: expectedWordClean, typed: '(Omitted)', type: 'left' });
      }
    } else if (chosen.type === 'punct_extra') punctuationExtraCount++;
    else if (chosen.type === 'punct_left') punctuationLeftCount++;
    else if (chosen.type === 'punct_wrong') punctuationWrongCount++;
  };

  const sectionWiseMistakeDetails = {
    wrongWords: [],
    verbErrors: [],
    singularPlural: [],
    omittedWords: [],
    extraWords: [],
    capitalErrors: [],
    punctErrors: [],
    correctWords: []
  };

  while (i > 0 || j > 0) {
    const rTok = i > 0 ? refTokens[i - 1] : null;
    const uTok = j > 0 ? userTokens[j - 1] : null;
    const isSingPlur = rTok && uTok && isSingularPluralPairEval(rTok.word, uTok.word, rTok.stem, uTok.stem);
    const isVerbMatch = rTok && uTok && rTok.verbRoot && uTok.verbRoot && (
      rTok.verbRoot === uTok.verbRoot ||
      rTok.verbRoot + 'e' === uTok.verbRoot ||
      uTok.verbRoot + 'e' === rTok.verbRoot
    );

    if (i > 0 && j > 0 && (rTok.word === uTok.word || isSingPlur || rTok.stem === uTok.stem || isVerbMatch)) {
      const wordMistakes = [];
      if (rTok.word !== uTok.word) {
        if (isSingPlur) {
          wordMistakes.push({ type: 'singular_plural', deduct: deductSingularPlural });
        } else {
          wordMistakes.push({ type: 'verb', deduct: deductVerbForm });
        }
      }
      if (rTok.cleanRaw.toLowerCase() === uTok.cleanRaw.toLowerCase() && rTok.cleanRaw !== uTok.cleanRaw) {
        wordMistakes.push({ type: 'capital', deduct: deductCapital });
      } else if (rTok.word !== uTok.word && rTok.cleanRaw[0] && uTok.cleanRaw[0] && (rTok.cleanRaw[0] === rTok.cleanRaw[0].toUpperCase()) !== (uTok.cleanRaw[0] === uTok.cleanRaw[0].toUpperCase())) {
        wordMistakes.push({ type: 'capital', deduct: deductCapital });
      }
      if (rTok.punct !== uTok.punct) {
        if (!rTok.punct && uTok.punct) wordMistakes.push({ type: 'punct_extra', deduct: deductPunctuation });
        else if (rTok.punct && !uTok.punct) wordMistakes.push({ type: 'punct_left', deduct: deductPunctuation });
        else wordMistakes.push({ type: 'punct_wrong', deduct: deductPunctuation });
      }
      applySingleHighestMistakeToCounters(wordMistakes, rTok.cleanRaw, uTok.cleanRaw);
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1]) {
      const wordMistakes = [{ type: 'wrong', deduct: deductWrong }];
      if (refTokens[i - 1].punct !== userTokens[j - 1].punct) {
        wordMistakes.push({ type: 'punct_wrong', deduct: deductPunctuation });
      }
      applySingleHighestMistakeToCounters(wordMistakes, refTokens[i - 1].cleanRaw, userTokens[j - 1].cleanRaw);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      const wordMistakes = [{ type: 'extra', deduct: deductExtraWord }];
      if (userTokens[j - 1].punct) {
        wordMistakes.push({ type: 'punct_extra', deduct: deductPunctuation });
      }
      applySingleHighestMistakeToCounters(wordMistakes, '', userTokens[j - 1].cleanRaw);
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      const wordMistakes = [{ type: 'left', deduct: deductOmission }];
      if (refTokens[i - 1].punct) {
        wordMistakes.push({ type: 'punct_left', deduct: deductPunctuation });
      }
      applySingleHighestMistakeToCounters(wordMistakes, refTokens[i - 1].cleanRaw, '');
      i--;
    } else {
      const wordMistakes = [{ type: 'wrong', deduct: deductWrong }];
      if (refTokens[i - 1].punct !== userTokens[j - 1].punct) {
        wordMistakes.push({ type: 'punct_wrong', deduct: deductPunctuation });
      }
      applySingleHighestMistakeToCounters(wordMistakes, refTokens[i - 1].cleanRaw, userTokens[j - 1].cleanRaw);
      i--;
      j--;
    }
  }

  const matchingTokenWords = Math.max(0, dp[m][n] - verbFormErrorCount - singularPluralErrorCount);
  const totalPunctuationErrors = punctuationLeftCount + punctuationExtraCount + punctuationWrongCount;

  const wrongTypedDeduction = (wrongTypedCount * deductWrong).toFixed(2);
  const wordLeftDeduction = (wordLeftCount * deductOmission).toFixed(2);
  const verbFormDeduction = (verbFormErrorCount * deductVerbForm).toFixed(2);
  const singularPluralDeduction = (singularPluralErrorCount * deductSingularPlural).toFixed(2);
  const punctuationDeduction = (totalPunctuationErrors * deductPunctuation).toFixed(2);
  const capitalDeduction = (capitalErrorCount * deductCapital).toFixed(2);
  const extraDeduction = (extraTypedCount * deductExtraWord).toFixed(2);
  const paraDeduction = (paraNotChangedCount * deductParaNotChanged).toFixed(2);

  const totalErrorCount = parseFloat(wrongTypedDeduction) + 
                        parseFloat(wordLeftDeduction) + 
                        parseFloat(verbFormDeduction) +
                        parseFloat(singularPluralDeduction) +
                        parseFloat(punctuationDeduction) + 
                        parseFloat(capitalDeduction) + 
                        parseFloat(extraDeduction) + 
                        parseFloat(paraDeduction);
  
  const ignoreErrorPct = rules.ignoreErrorPct !== undefined ? parseFloat(rules.ignoreErrorPct) : 0;
  const penaltyValue = rules.penaltyValue !== undefined ? parseFloat(rules.penaltyValue) : 1.0;

  const allowedFreeErrors = totalWordsOriginal * (ignoreErrorPct / 100);
  const excessErrors = Math.max(0, totalErrorCount - allowedFreeErrors);
  const effectivePenalizedErrors = excessErrors * penaltyValue;

  const effectiveWordsScored = Math.max(0, totalWordsOriginal - effectivePenalizedErrors);

  const matchingWords = is5StrokeRule
    ? Math.max(0, Math.round(totalTypedWords - effectivePenalizedErrors))
    : matchingTokenWords;

  const accuracyPercentage = totalWordsOriginal > 0 ? ((effectiveWordsScored / totalWordsOriginal) * 100).toFixed(2) : '0.00';
  const errorPercentage = (100 - parseFloat(accuracyPercentage)).toFixed(2);
  const marksObtained = totalWordsOriginal > 0 ? ((effectiveWordsScored / totalWordsOriginal) * totalMarks).toFixed(2) : '0.00';

  const unifiedPassingPct = parseFloat(rules.passingAccuracy ?? rules.passingMarks ?? 85);
  const passingAccuracy = unifiedPassingPct;
  const passingMarks = Number(((unifiedPassingPct / 100) * totalMarks).toFixed(2));
  const isPassed = (parseFloat(accuracyPercentage) >= passingAccuracy) && meetsMinGrossStroke;

  const isLearningCountUp = Boolean(window.isCountUpTimerMode) ||
                            Boolean(rules.isOneTimeLearningRule) ||
                            String(portalState.activeTestSubtabKey || '').includes('learning') ||
                            String(portalState.currentExamName || '').toLowerCase().includes('learning');
  const effectiveDurationMinsForSpeed = isLearningCountUp ? durationMins : adminDurationMins;

  const grossSpeed = Math.round(totalTypedWords / effectiveDurationMinsForSpeed);
  const netSpeed = Math.round(matchingWords / effectiveDurationMinsForSpeed);
  const userTimeGrossSpeed = Math.round(totalTypedWords / durationMins);
  const userTimeNetSpeed = Math.round(matchingWords / durationMins);

  const activeLiveTestObj = window.activeScheduledLiveTestObj || null;
  let liveResultPublishTimeMs = 0;
  let liveResultDisplayMode = 'immediate';
  if (activeLiveTestObj) {
    liveResultDisplayMode = activeLiveTestObj.resultDisplayMode || 'immediate';
    if (liveResultDisplayMode === 'after_end' && activeLiveTestObj.endTime) {
      liveResultPublishTimeMs = new Date(activeLiveTestObj.endTime).getTime();
    } else if (liveResultDisplayMode === 'custom_time' && activeLiveTestObj.resultPublishTime) {
      liveResultPublishTimeMs = new Date(activeLiveTestObj.resultPublishTime).getTime();
    }
  }

  // 👉 Requirement #5: Separate Exam Title (Rule / Pattern Name) and Passage Title (Material Title)
  const resolvedExamTitle = window.currentActiveExamRuleTitle || rules.examDisplayName || portalState.currentExamName || 'Standard Skill Exam';
  const resolvedPassageTitle = window.currentActivePassageTitle ||
    (portalState.pendingAudioDictationItem && portalState.pendingAudioDictationItem.Title) ||
    (portalState.selectedTypingPassage && portalState.selectedTypingPassage.Title) ||
    (portalState.pendingEphemeralLearningItem && portalState.pendingEphemeralLearningItem.Title) ||
    'Master Practice Passage';

  // 👉 Requirement #12: Snapshot Keystroke Latency & Rhythm Heatmap data so it displays in Comparison
  const latencySnapshot = JSON.parse(JSON.stringify(window.keystrokeLatencyStatsMap || {}));
  const intervalsSnapshot = Array.isArray(window.recentKeystrokeIntervalsMs) ? [...window.recentKeystrokeIntervalsMs] : [];

  const payload = {
    userId: portalState.currentUser ? portalState.currentUser.userId : 'GUEST',
    userName: portalState.currentUser ? portalState.currentUser.name : 'Guest',
    examName: resolvedExamTitle,
    passageTitle: resolvedPassageTitle,
    timeDuration: isLearningCountUp ? `Auto (${timeUsedMinutes} Mins User Time)` : `${portalState.testDurationMinutes} Mins`,
    typingDate: getLocalDateString(),
    timeTaken: `${timeUsedMinutes} mins`,
    errorRelaxed: `${ignoreErrorPct}%`,
    penaltyWord: `${penaltyValue}`,
    date: getLocalDateString(),
    submissionTime: submissionTimeFormatted,
    grossSpeed: grossSpeed,
    netSpeed: netSpeed,
    userTimeGrossSpeed: userTimeGrossSpeed,
    userTimeNetSpeed: userTimeNetSpeed,
    totalWord: Math.round(totalWordsOriginal),
    correctWords: matchingWords,
    matchingTokenWords: matchingTokenWords,
    wordCountRule: rules.wordCountRule || '1word',
    punctRuleMode: punctMode,
    totalCharacter: totalCharacter,
    totalTypedCharacter: totalTypedCharacter,
    totalTypedWords: Math.round(totalTypedWords),
    totalBackspace: typeof portalState.testBackspaces !== 'undefined' ? portalState.testBackspaces : 0,
    accuracyPercentage: accuracyPercentage,
    errorPercentage: errorPercentage,
    marksObtained: marksObtained,
    totalMarks: totalMarks,
    wrongTyped: wrongTypedCount,
    wrongTypedDeduction: wrongTypedDeduction,
    wordLeft: wordLeftCount,
    wordLeftDeduction: wordLeftDeduction,
    verbFormError: verbFormErrorCount,
    verbFormDeduction: verbFormDeduction,
    singularPluralError: singularPluralErrorCount,
    singularPluralDeduction: singularPluralDeduction,
    capitalError: capitalErrorCount,
    capitalDeduction: capitalDeduction,
    extraTyped: extraTypedCount,
    extraDeduction: extraDeduction,
    paraNotChanged: paraNotChangedCount,
    paraDeduction: paraDeduction,
    punctuationLeft: totalPunctuationErrors,
    punctuationDeduction: punctuationDeduction,
    status: isPassed ? 'PASSED' : 'FAILED',
    timeUsed: `${timeUsedMinutes} mins (Submitted at ${submissionTimeFormatted})`,
    userTranscription: typedText || '-',
    referenceText: referenceText || '-',
    evaluationRules: rules,
    keystrokeLatencySnapshot: latencySnapshot,
    keystrokeIntervalsSnapshot: intervalsSnapshot,
    liveTestId: activeLiveTestObj ? activeLiveTestObj.id : undefined,
    liveResultDisplayMode: liveResultDisplayMode,
    liveResultPublishTimeMs: liveResultPublishTimeMs
  };

  if (typeof checkAndTriggerHighScoreNotification === 'function') {
    checkAndTriggerHighScoreNotification(payload, false);
  }

  portalState.allTestHistoryList.unshift(payload);
  if (portalState.globalData && Array.isArray(portalState.globalData.history)) {
    portalState.globalData.history.unshift(payload);
  }
  if (portalState.globalData && Array.isArray(portalState.globalData.userHistory)) {
    portalState.globalData.userHistory.unshift(payload);
  }
  localStorage.setItem('steno_pending_submission', JSON.stringify(payload));

  // Auto-capture omitted/mistyped words into Weak Outlines Vault AND track correctly answered words for existing Vault items
  try {
    if (referenceText && typedText) {
      const normWord = (w) => String(w || '').replace(/[^a-zA-Z0-9'-]/g, '').trim();
      const refW = referenceText.split(/\s+/).filter(Boolean);
      const typW = typedText.split(/\s+/).filter(Boolean);
      const typFreq = new Map();
      typW.forEach(w => {
        const k = normWord(w).toLowerCase();
        if (k) typFreq.set(k, (typFreq.get(k) || 0) + 1);
      });
      const autoCaptured = [];
      const correctWords = [];
      refW.forEach((rw, idx) => {
        const clean = normWord(rw);
        const low = clean.toLowerCase();
        if (clean.length < 3) return;
        const remaining = typFreq.get(low) || 0;
        if (remaining > 0) {
          typFreq.set(low, remaining - 1);
          correctWords.push(clean);
        } else {
          autoCaptured.push({ word: clean, typed: typW[idx] || 'Omitted / Wrong', category: portalState.currentExamName || 'Skill Test' });
        }
      });
      if (autoCaptured.length > 0 && typeof window.recordWordsIntoWeakOutlinesVault === 'function') {
        window.recordWordsIntoWeakOutlinesVault(autoCaptured.slice(0, 40), portalState.currentExamName || 'Skill Test');
      }
      if (correctWords.length > 0 && typeof window.recordCorrectWordsInWeakOutlinesVault === 'function') {
        window.recordCorrectWordsInWeakOutlinesVault(correctWords);
      }
    }
  } catch (e) {}

  if (typeof logPortalAction === 'function') {
    logPortalAction('SUBMIT_TEST', `Submitted ${portalState.currentExamName || 'Skill Test'} | Net Speed: ${netSpeed} WPM | Accuracy: ${accuracyPercentage}% | Marks: ${marksObtained}/${totalMarks} (${payload.status})`);
  }
  if (typeof renderDailyPracticeGoalUI === 'function') {
    renderDailyPracticeGoalUI();
  }
  if (typeof renderDashboardUI === 'function') {
    renderDashboardUI();
  }

  const modalElem = document.getElementById('active-test-modal');
  if (modalElem) modalElem.style.display = 'none';
  const activeInterfaceElem = document.getElementById('active-test-interface');
  if (activeInterfaceElem) activeInterfaceElem.style.display = 'none';

  window.isCountUpTimerMode = false;
  window.activeScheduledLiveTestEndTime = null;
  window.activeScheduledLiveTestObj = null;

  const originTab = window.lastOriginTabBeforeTest || window.currentActiveViewName || portalState.activeTab || 'dashboard';
  navigateTo(originTab, false, true);
  renderTestHistoryTable();

  if (liveResultPublishTimeMs > 0 && Date.now() < liveResultPublishTimeMs) {
    const pubStr = new Date(liveResultPublishTimeMs).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    showToast(`✅ Live Test Submitted! Result will be displayed at ${pubStr}.`);
    const rModal = document.getElementById('reader-modal');
    const rBody = document.getElementById('modal-viewport');
    const rTitle = document.getElementById('modal-title');
    if (rTitle) rTitle.innerText = '🔴 Live Test Submitted — Result Scheduled';
    if (rBody && rModal) {
      rBody.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 24px; text-align:center; max-width:600px; margin:40px auto; background:var(--surface); border:2px solid var(--primary); border-radius:16px; box-shadow:0 12px 32px var(--shadow);">
          <div style="width:68px; height:68px; border-radius:50%; background:rgba(37,99,235,0.12); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:30px; margin-bottom:16px;">
            <i class="fa-solid fa-clock-rotate-left"></i>
          </div>
          <h3 style="color:var(--secondary); margin-bottom:8px;">Your Live Test Response Has Been Recorded!</h3>
          <p style="font-size:14px; color:var(--text-muted); line-height:1.6; margin-bottom:16px;">
            Exam: <strong>${payload.examName}</strong><br>
            Submitted At: <strong>${submissionTimeFormatted}</strong>
          </p>
          <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.4); color:#b45309; padding:12px 18px; border-radius:10px; font-size:13px; font-weight:700; margin-bottom:20px;">
            🔒 As configured by Admin Panel, your detailed scorecard for this Live Test will be displayed on:<br>
            <span style="font-size:16px; color:var(--danger); display:inline-block; margin-top:4px;">📅 ${pubStr}</span>
          </div>
          <button class="btn btn-primary" onclick="closeModal()"><i class="fa-solid fa-check"></i> Back to ${originTab.toUpperCase()}</button>
        </div>
      `;
      rModal.style.display = 'flex';
    }
  } else {
    window._returnToOriginTabOnCloseComparison = true;
    openTestComparison(payload);
  }

  const safeSheetPayload = {
    ...payload,
    userId: payload.userId && payload.userId !== '-' ? payload.userId : (portalState.currentUser ? (portalState.currentUser.userId || portalState.currentUser.mobile || portalState.currentUser.email || 'STUDENT') : 'GUEST'),
    userName: payload.userName && payload.userName !== '-' ? payload.userName : (portalState.currentUser ? (portalState.currentUser.name || 'Student') : 'Student'),
    userTranscription: String(payload.userTranscription || '-').slice(0, 44000),
    referenceText: String(payload.referenceText || '-').slice(0, 44000)
  };
  const res = await apiCall('saveTestHistory', safeSheetPayload, true);
  if (res && res.success) {
    localStorage.removeItem('steno_pending_submission');
    if (res.isNewHighScore && typeof pushAdminRealtimeNotification === 'function') {
      pushAdminRealtimeNotification({
        type: 'HIGH_SCORE',
        title: '🏆 High-Score Record Broken (Typing/Steno)',
        message: `${payload.userName} set a new ${res.newRecordValue || netSpeed} WPM record in ${payload.examName} (Prev Best: ${res.previousBest || 0} WPM)!`,
        userName: payload.userName,
        examName: payload.examName,
        timestamp: new Date().toISOString()
      });
    }
    showToast('✅ Test evaluated & saved!');
  } else {
    showToast('✅ Test evaluated locally!');
  }

  try { portalHooks.emit('afterStenoTestSubmit', ...arguments); } catch (_hk) {}
}

export function loadTestHistory(silent = true) {
  const container = document.getElementById('test-history-container');
  if (!container || !portalState.currentUser) return;

  renderTestHistoryTable();

  if (typeof window.streamCollectionOneByOne === 'function') {
    const streamedHistory = [];
    window.streamCollectionOneByOne({
      streamKey: 'test_history_' + String(portalState.currentUser.userId || ''),
      collection: 'history',
      extraParams: { userId: portalState.currentUser.userId },
      anchorId: 'test-history-container',
      labelSingular: 'test record',
      fallbackAction: 'getTestHistory',
      fallbackParams: { userId: portalState.currentUser.userId },
      extractFallbackItems: (res) => (res && Array.isArray(res.historyList)) ? res.historyList : [],
      onRecord: (rec) => {
        if (!rec) return;
        streamedHistory.push(rec);
        portalState.allTestHistoryList = streamedHistory.slice();
        portalState.globalData.history = portalState.allTestHistoryList;
        renderTestHistoryTable();
      },
      onDone: () => {
        portalState.allTestHistoryList = streamedHistory.slice();
        portalState.globalData.history = portalState.allTestHistoryList;
        saveFastPortalCache();
        renderTestHistoryTable();
      }
    });
    return;
  }

  apiCall('getTestHistory', { userId: portalState.currentUser.userId }, silent).then(res => {
    if (res && res.success && Array.isArray(res.historyList)) {
      portalState.allTestHistoryList = res.historyList;
      portalState.globalData.history = res.historyList;
      saveFastPortalCache();
    }
    renderTestHistoryTable();
  });
}

export function renderTestHistoryTable() {
  const container = document.getElementById('test-history-container');
  if (!container) return;

  const useTimeToggle = document.getElementById('toggle-time-used')?.checked || false;
  const searchInput = document.getElementById('history-search-input');
  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const filterSelect = document.getElementById('history-type-filter');

  if (searchQuery && filterSelect) {
    filterSelect.value = 'ALL';
  }

  const currentFilter = filterSelect ? filterSelect.value : 'ALL';
  let historyList = [...portalState.allTestHistoryList];

  if (currentFilter === 'typing') {
    historyList = historyList.filter(h => (h.ExamName || h.examName || '').toLowerCase().includes('typing') && !(h.ExamName || h.examName || '').toLowerCase().includes('learning'));
  } else if (currentFilter === 'learning') {
    historyList = historyList.filter(h => (h.ExamName || h.examName || '').toLowerCase().includes('learning'));
  } else if (currentFilter === 'pitman') {
    historyList = historyList.filter(h => (h.ExamName || h.examName || '').toLowerCase().includes('pitman'));
  } else if (currentFilter === 'audio') {
    historyList = historyList.filter(h => (h.ExamName || h.examName || '').toLowerCase().includes('audio') || (h.ExamName || h.examName || '').toLowerCase().includes('steno'));
  } else if (currentFilter === 'cbt') {
    historyList = historyList.filter(h => (h.ExamName || h.examName || '').toLowerCase().includes('cbt'));
  }

  if (searchQuery) {
    historyList = historyList.filter(h => {
      const exam = (h.ExamName || h.examName || '').toLowerCase();
      const user = (h.UserName || h.userName || '').toLowerCase();
      const status = (h.Status || h.status || '').toLowerCase();
      const rawDate = (h.Date || h.date || '');
      const formattedDate = formatLocalDate(rawDate).toLowerCase();

      return exam.includes(searchQuery) ||
             user.includes(searchQuery) ||
             status.includes(searchQuery) ||
             rawDate.toLowerCase().includes(searchQuery) ||
             formattedDate.includes(searchQuery);
    });
  }

  if (historyList.length === 0) {
    container.innerHTML = '';
    container.appendChild(createInlineDataLoadStatusEl(false));
    const pageIndicator = document.getElementById('history-page-indicator');
    if (pageIndicator) pageIndicator.innerText = `Page 1 of 1 (0 entries)`;
    return;
  }

  portalState.cachedTestHistory = historyList;

  const totalPages = Math.ceil(historyList.length / HISTORY_PER_PAGE) || 1;
  if (typeof portalState.currentHistoryPage === 'undefined') portalState.currentHistoryPage = 1;
  if (portalState.currentHistoryPage > totalPages) portalState.currentHistoryPage = totalPages;
  if (portalState.currentHistoryPage < 1) portalState.currentHistoryPage = 1;

  const startIndex = (portalState.currentHistoryPage - 1) * HISTORY_PER_PAGE;
  const paginatedList = historyList.slice(startIndex, startIndex + HISTORY_PER_PAGE);

  const pageIndicator = document.getElementById('history-page-indicator');
  if (pageIndicator) {
    pageIndicator.innerText = `Page ${portalState.currentHistoryPage} of ${totalPages} (${historyList.length} total entries)`;
  }

  let html = `
    <table border="1" borderColor="var(--border)" cellpadding="8" style="width:100%; border-collapse:collapse; font-size:12px;">
      <tr style="background: var(--border);">
        <th>Date</th>
        <th>Exam / Exercise</th>
        <th>Correct / Total Words</th>
        <th>${useTimeToggle ? 'Time Used' : 'Gross Spd (Admin Time)'}</th>
        <th>${useTimeToggle ? 'Speed View (User Time)' : 'Net Spd (Admin Time)'}</th>
        <th>Accuracy</th>
        <th>Marks Obtained</th>
        <th>Time Submitted</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
  `;

  paginatedList.forEach((h, index) => {
    const globalIndex = startIndex + index;
    const localDateDisplay = formatLocalDate(h.Date || h.date) || '-';
    const submittedTimestamp = h.submissionTime || h.submissionTimeFormatted || h.TimeUsed || h.timeUsed || '-';
    const accuracy = parseFloat(h.AccuracyPercentage || h.accuracyPercentage || 0);
    
    const marks = h.MarksObtained ?? h.marksObtained ?? h.Marks ?? h.marks ?? '-';
    const totalMarks = h.TotalMarks ?? h.totalMarks ?? 100;
    const status = h.Status || h.status || 'FAILED';
    const examName = h.ExamName || h.examName || '-';

    // 👉 REQUIREMENT #3: Check if this record is a Live Scheduled Test whose result is still locked until endTime / publishTime
    const publishMs = Number(h.liveResultPublishTimeMs || 0);
    const isResultLocked = publishMs > 0 && Date.now() < publishMs && portalState.currentUser?.role !== 'admin' && portalState.currentUser?.role !== 'superadmin';
    if (isResultLocked) {
      const unlockStr = new Date(publishMs).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      html += `
        <tr>
          <td>${localDateDisplay}</td>
          <td><strong>🔴 LIVE: ${examName}</strong></td>
          <td colspan="6" style="text-align:center; color:#b45309; font-weight:700; background:rgba(245,158,11,0.08);">
            🔒 Live Test Result Locked — Displays on ${unlockStr}
          </td>
          <td><span class="role-badge" style="background:#f59e0b;">⏳ SCHEDULED</span></td>
          <td><button class="btn btn-sm btn-secondary" disabled>🔒 Locked</button></td>
        </tr>
      `;
      return;
    }

    // 👉 REQUIREMENT #9: In History Tab, CBT Exam results MUST show as CBT Objective Results (Correct / Wrong / Skipped & CBT Marks), NOT Typing WPM!
    const isCbtRecord = Boolean(h.isCbtExam) || String(examName).toLowerCase().includes('cbt');
    if (isCbtRecord) {
      const cbtCorrect = h.correctCount ?? h.CorrectWords ?? h.correctWords ?? 0;
      const cbtWrong = h.wrongCount ?? h.WrongTyped ?? h.wrongTyped ?? 0;
      const cbtSkipped = h.unansweredCount ?? h.WordLeft ?? h.wordLeft ?? 0;
      const cbtTotalQ = h.TotalWord ?? h.totalWord ?? (Number(cbtCorrect) + Number(cbtWrong) + Number(cbtSkipped));
      const cbtDurLabel = h.TimeDuration || h.timeDuration || '20 Mins';
      html += `
        <tr style="background: rgba(124, 58, 237, 0.03);">
          <td>${localDateDisplay}</td>
          <td>
            <span class="subtab-badge" style="background:rgba(124,58,237,0.14); color:#7c3aed; border:1px solid rgba(124,58,237,0.3); margin-right:4px;">🖥️ CBT EXAM</span>
            <strong>${examName}</strong>
          </td>
          <td>
            <span style="color:#16a34a; font-weight:800;">✔ ${cbtCorrect} Correct</span> |
            <span style="color:#dc2626; font-weight:800;">✖ ${cbtWrong} Wrong</span> |
            <span style="color:var(--text-muted); font-weight:700;">⚪ ${cbtSkipped} Skipped</span>
            <small style="display:block; color:var(--text-muted);">(${cbtTotalQ} Total Questions)</small>
          </td>
          <td colspan="2" style="text-align:center;">
            <span style="background:rgba(124,58,237,0.12); color:#7c3aed; padding:4px 10px; border-radius:999px; font-weight:800; font-size:11px;">
              🎯 Objective CBT Exam (${cbtDurLabel})
            </span>
          </td>
          <td><strong>${accuracy}%</strong></td>
          <td><strong style="color:#7c3aed;">${marks} / ${totalMarks}</strong></td>
          <td>${submittedTimestamp}</td>
          <td><span class="role-badge" style="background: ${status === 'PASSED' || status === 'COMPLETED' ? 'var(--success)' : 'var(--danger)'};">${status}</span></td>
          <td><button class="btn btn-sm btn-primary" style="background:#7c3aed;" onclick="openTestComparison(${globalIndex})"><i class="fa-solid fa-square-poll-vertical"></i> View CBT Scorecard</button></td>
        </tr>
      `;
      return;
    }

    let adminMinutes = 5;
    const timeDurStr = String(h.TimeDuration || h.timeDuration || '5').toLowerCase();
    const durMatch = timeDurStr.match(/([\d.]+)/);
    if (durMatch && durMatch[1]) adminMinutes = parseFloat(durMatch[1]);
    if (!adminMinutes || adminMinutes <= 0) adminMinutes = 5;

    let userMinutes = adminMinutes;
    const timeTakenStr = String(h.TimeTaken || h.timeTaken || h.TimeUsed || h.timeUsed || '').toLowerCase();
    const takenMatch = timeTakenStr.match(/([\d.]+)/);
    if (takenMatch && takenMatch[1]) userMinutes = parseFloat(takenMatch[1]);
    if (!userMinutes || userMinutes <= 0) userMinutes = 0.01;

    const totalWords = parseFloat(h.TotalWord || h.totalWord || h.TotalWordsOriginal || h.totalWordsOriginal || 0);
    const totalTyped = parseFloat(h.TotalTypedWords || h.totalTypedWords || totalWords || 0);
    const correctWords = (h.CorrectWords !== undefined && h.CorrectWords !== '-') 
      ? parseFloat(h.CorrectWords) 
      : (h.correctWords !== undefined ? parseFloat(h.correctWords) : Math.round((accuracy / 100) * (totalWords || totalTyped)));

    const adminGross = h.GrossSpeed ?? h.grossSpeed ?? Math.round(totalTyped / adminMinutes);
    const adminNet = h.NetSpeed ?? h.netSpeed ?? Math.round(correctWords / adminMinutes);

    const userGross = h.userTimeGrossSpeed ?? Math.round(totalTyped / userMinutes);
    const userNet = h.userTimeNetSpeed ?? Math.round(correctWords / userMinutes);

    let col3Content = `${adminGross} WPM`;
    let col4Content = `${adminNet} WPM`;

    if (useTimeToggle) {
      col3Content = `<span style="color: var(--primary); font-weight: 700;">${timeTakenStr || (userMinutes + ' mins')}</span>`;
      col4Content = `Gross: ${userGross} | Net: ${userNet} WPM`;
    }

    html += `
      <tr>
        <td>${localDateDisplay}</td>
        <td><strong>${examName}</strong></td>
        <td><strong style="color: var(--success);">${correctWords}</strong> / ${totalWords || '-'}</td>
        <td>${col3Content}</td>
        <td>${col4Content}</td>
        <td>${accuracy}%</td>
        <td>${marks} / ${totalMarks}</td>
        <td>${submittedTimestamp}</td>
        <td><span class="role-badge" style="background: ${status === 'PASSED' ? 'var(--success)' : 'var(--danger)'};">${status}</span></td>
        <td><button class="btn btn-sm btn-primary" onclick="openTestComparison(${globalIndex})">View Material & Typed</button></td>
      </tr>
    `;
  });

  html += `</table>`;
  container.innerHTML = html;
  container.appendChild(createInlineDataLoadStatusEl(false));
}

export function paginateHistory(direction) {
  const totalPages = Math.ceil((portalState.cachedTestHistory.length || 1) / HISTORY_PER_PAGE) || 1;
  if (direction === 1 && portalState.currentHistoryPage < totalPages) {
    portalState.currentHistoryPage++;
  } else if (direction === -1 && portalState.currentHistoryPage > 1) {
    portalState.currentHistoryPage--;
  }
  renderTestHistoryTable();
}

export function openTestComparison(indexOrItem) {
  if (typeof indexOrItem === 'object' && indexOrItem !== null) {
    window._currentComparisonItem = indexOrItem;
  } else {
    window._currentComparisonItem = 
      (typeof portalState.cachedTestHistory !== 'undefined' && portalState.cachedTestHistory && portalState.cachedTestHistory[indexOrItem]) || 
      (typeof portalState.allTestHistoryList !== 'undefined' && portalState.allTestHistoryList && portalState.allTestHistoryList[indexOrItem]) || 
      (typeof portalState.adminData !== 'undefined' && portalState.adminData && portalState.adminData.history && portalState.adminData.history[indexOrItem]) ||
      (typeof portalState.globalData !== 'undefined' && portalState.globalData && portalState.globalData.history && portalState.globalData.history[indexOrItem]);
  }

  const historyItem = window._currentComparisonItem;

  if (!historyItem) {
    showToast('Error loading test comparison details.');
    return;
  }

  // 👉 REQUIREMENT #3: Prevent viewing locked Live Test results before publish time
  const publishMs = Number(historyItem.liveResultPublishTimeMs || 0);
  if (publishMs > 0 && Date.now() < publishMs && portalState.currentUser?.role !== 'admin' && portalState.currentUser?.role !== 'superadmin') {
    showToast(`🔒 Live Test Result will be displayed at ${new Date(publishMs).toLocaleString()}`);
    return;
  }

  const modal = document.getElementById('reader-modal');
  const body = document.getElementById('modal-viewport');
  const titleEl = document.getElementById('modal-title');
  
  const examNameVal = historyItem.ExamName || historyItem.examName || '-';
  const dateVal = typeof formatLocalDate === 'function' 
    ? formatLocalDate(historyItem.Date || historyItem.date || historyItem.TypingDate || '') 
    : (historyItem.Date || historyItem.date || historyItem.TypingDate || '-');

  // 👉 REQUIREMENT #9: Dedicated CBT Exam Scorecard & Question-by-Question Review Modal (Not Typing Result!)
  const isCbtExamRecord = Boolean(historyItem.isCbtExam) || String(examNameVal).toLowerCase().includes('cbt');
  if (isCbtExamRecord) {
    if (titleEl) {
      titleEl.innerText = `🖥️ CBT Exam Scorecard & Question Review : ${examNameVal} (${dateVal || '-'})`;
    }
    const passageTitle = historyItem.PassageTitle || historyItem.passageTitle || 'SSC / General CBT Mock Exam';
    const timeDuration = historyItem.TimeDuration || historyItem.timeDuration || '20 Mins';
    const submittedTimeStr = historyItem.submissionTime || historyItem.TimeUsed || historyItem.timeUsed || '-';
    const accuracy = historyItem.AccuracyPercentage ?? historyItem.accuracyPercentage ?? 0;
    const totalMarksVal = historyItem.TotalMarks ?? historyItem.totalMarks ?? 100;
    const marksObtainedVal = historyItem.MarksObtained ?? historyItem.marksObtained ?? 0;
    const status = historyItem.Status || historyItem.status || 'COMPLETED';
    const cbtCorrect = historyItem.correctCount ?? historyItem.CorrectWords ?? historyItem.correctWords ?? 0;
    const cbtWrong = historyItem.wrongCount ?? historyItem.WrongTyped ?? historyItem.wrongTyped ?? 0;
    const cbtSkipped = historyItem.unansweredCount ?? historyItem.WordLeft ?? historyItem.wordLeft ?? 0;
    const cbtTotalQ = historyItem.TotalWord ?? historyItem.totalWord ?? (Number(cbtCorrect) + Number(cbtWrong) + Number(cbtSkipped));
    const reviewItems = Array.isArray(historyItem.cbtQuestionsReview) ? historyItem.cbtQuestionsReview : [];

    if (body) {
      body.scrollTop = 0;
      body.innerHTML = `
        <div class="rp-comparison-inner-shell" style="display: flex; flex-direction: column; gap: 16px; padding: 18px 20px 36px; width: 100%; max-width: 1280px; margin: 0 auto; box-sizing: border-box; background: var(--background); color: var(--text);">
          <div style="background: var(--surface); border: 1px solid var(--border); border-left: 5px solid #7c3aed; padding: 18px; border-radius: var(--radius); box-shadow: 0 4px 12px var(--shadow);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;">
              <h4 style="color: var(--secondary); margin: 0; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-computer" style="color: #7c3aed;"></i> CBT Objective Examination Scorecard — ${examNameVal}
              </h4>
              <span class="role-badge" style="background: ${status === 'PASSED' || status === 'COMPLETED' ? 'var(--success)' : 'var(--danger)'}; font-size: 12px; padding: 5px 14px;">${status}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; font-size: 13px;">
              <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Exam Category:</strong> ${passageTitle}</div>
              <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Exam Date:</strong> ${dateVal}</div>
              <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Allotted Duration:</strong> ${timeDuration}</div>
              <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Submitted At:</strong> ${submittedTimeStr}</div>
              <div style="background: rgba(16, 185, 129, 0.14); color: #059669; padding: 10px; border-radius: 6px; font-weight: 800;">✔ Correct Answers: ${cbtCorrect} / ${cbtTotalQ}</div>
              <div style="background: rgba(239, 68, 68, 0.14); color: #dc2626; padding: 10px; border-radius: 6px; font-weight: 800;">✖ Wrong Answers: ${cbtWrong}</div>
              <div style="background: rgba(100, 116, 139, 0.14); color: var(--text-muted); padding: 10px; border-radius: 6px; font-weight: 800;">⚪ Unanswered / Skipped: ${cbtSkipped}</div>
              <div style="background: rgba(124, 58, 237, 0.14); color: #7c3aed; padding: 10px; border-radius: 6px; font-weight: 800;">🏆 Final CBT Marks: ${marksObtainedVal} / ${totalMarksVal} (${accuracy}%)</div>
            </div>
          </div>

          <div style="background: var(--surface); border: 1px solid var(--border); padding: 18px; border-radius: var(--radius); flex: 1;">
            <h4 style="color: var(--secondary); margin: 0 0 12px 0;"><i class="fa-solid fa-clipboard-question" style="color: var(--primary);"></i> Question-by-Question Answer Key & Explanations</h4>
            ${reviewItems.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${reviewItems.map((qItem, qIdx) => {
                  const isCorrect = qItem.userChoice === qItem.correctAnswer;
                  const isUnanswered = qItem.userChoice === undefined || qItem.userChoice === null || qItem.userChoice === -1;
                  const borderColor = isUnanswered ? '#94a3b8' : (isCorrect ? '#10b981' : '#ef4444');
                  const confBadge = qItem.confidenceTag === 'guess'
                    ? ' • 🤔 50-50 Guess'
                    : (qItem.confidenceTag === 'sure' ? ' • ✅ Sure Shot' : '');
                  const timeBadge = qItem.timeSpentSec !== undefined ? ` • ⏱️ ${qItem.timeSpentSec}s` : '';
                  const statusLabel = (isUnanswered ? '⚪ Unanswered (0)' : (isCorrect ? '✔ Correct (+Marks)' : '✖ Wrong (-Negative)')) + confBadge + timeBadge;
                  return `
                    <div style="border: 1px solid var(--border); border-left: 4px solid ${borderColor}; border-radius: 8px; padding: 12px 14px; background: var(--background);">
                      <div style="display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; font-size: 12px; font-weight: 800;">
                        <span style="color: var(--primary);">Q${qIdx + 1}. [${qItem.section || 'General'}]</span>
                        <span style="color: ${borderColor};">${statusLabel}</span>
                      </div>
                      <div style="font-size: 13.5px; font-weight: 700; color: var(--secondary); margin-bottom: 8px;">${qItem.q || ''}</div>
                      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px; font-size: 12px; margin-bottom: 8px;">
                        ${(qItem.options || []).map((optText, oIdx) => {
                          const isRightOpt = oIdx === qItem.correctAnswer;
                          const isUserOpt = oIdx === qItem.userChoice;
                          let optBg = 'var(--surface)';
                          let optBorder = 'var(--border)';
                          if (isRightOpt) { optBg = 'rgba(16, 185, 129, 0.16)'; optBorder = '#10b981'; }
                          else if (isUserOpt && !isRightOpt) { optBg = 'rgba(239, 68, 68, 0.16)'; optBorder = '#ef4444'; }
                          return `<div style="padding: 6px 10px; border-radius: 6px; border: 1px solid ${optBorder}; background: ${optBg}; font-weight: ${isRightOpt || isUserOpt ? '800' : '500'};">
                            (${String.fromCharCode(65 + oIdx)}) ${optText}
                            ${isRightOpt ? ' <strong style="color:#059669;">[Correct Option]</strong>' : ''}
                            ${isUserOpt && !isRightOpt ? ' <strong style="color:#dc2626;">[Your Choice]</strong>' : ''}
                          </div>`;
                        }).join('')}
                      </div>
                      ${qItem.explanation ? `<div style="font-size: 12px; color: var(--text-muted); background: var(--surface); padding: 8px 10px; border-radius: 6px; border-left: 3px solid var(--primary);"><strong>💡 Explanation:</strong> ${qItem.explanation}</div>` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px;">
                <div style="background: var(--background); padding: 14px; border-radius: 8px; border: 1px solid var(--border);">
                  <h5 style="color: var(--secondary); margin: 0 0 8px 0;">📋 Your CBT Exam Summary</h5>
                  <pre style="white-space: pre-wrap; font-family: inherit; font-size: 13px; color: var(--text); margin: 0;">${historyItem.UserTranscription || historyItem.userTranscription || 'CBT Attempt Recorded'}</pre>
                </div>
                <div style="background: var(--background); padding: 14px; border-radius: 8px; border: 1px solid var(--border);">
                  <h5 style="color: var(--secondary); margin: 0 0 8px 0;">🔑 Official Answer Key</h5>
                  <pre style="white-space: pre-wrap; font-family: inherit; font-size: 13px; color: var(--text); margin: 0;">${historyItem.ReferenceText || historyItem.referenceText || 'Official Answer Key Verified'}</pre>
                </div>
              </div>
            `}
          </div>
        </div>
      `;
    }
    if (modal) modal.style.display = 'flex';
    return;
  }
  
  if (titleEl) {
    titleEl.innerText = `Detailed Test Comparison : ${examNameVal} (${dateVal || '-'})`;
  }

  const refText = historyItem.ReferenceText || historyItem.referenceText || '';
  const userText = historyItem.UserTranscription || historyItem.userTranscription || historyItem.TypedText || historyItem.typedText || '';
  const rules = historyItem.evaluationRules || (typeof getEvaluationRulesForTab === 'function' ? getEvaluationRulesForTab(typeof portalState.activeTestSubtabKey !== 'undefined' ? portalState.activeTestSubtabKey : '') : {}) || {};

  const isStenoExam = examNameVal.toLowerCase().includes('audio') ||
                      examNameVal.toLowerCase().includes('steno') ||
                      examNameVal.toLowerCase().includes('pitman');
  const punctMode = historyItem.punctRuleMode || rules.punctRuleMode || (isStenoExam ? 'fullstop_only' : 'all');

  const parseToken = (token) => {
    const cleanRaw = token.replace(/^[.,\/#!$%\^&\*;:{}=\-_`~()\[\]?+'"]+|[.,\/#!$%\^&\*;:{}=\-_`~()\[\]?+'"]+$/g, '');
    let punct = '';
    if (punctMode === 'fullstop_only') {
      punct = (token.match(/\./g) || []).join('');
    } else if (punctMode === 'ignore') {
      punct = '';
    } else {
      punct = (token.match(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]?+'"]/g) || []).join('');
    }
    
    let lower = cleanRaw.toLowerCase();
    let stem = lower;
    if (lower.endsWith('ies') && lower.length > 3) {
      stem = lower.slice(0, -3) + 'y';
    } else if (lower.endsWith('es') && lower.length > 3) {
      stem = lower.slice(0, -2);
    } else if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 2) {
      stem = lower.slice(0, -1);
    }
    let verbRoot = typeof window.getVerbRoot === 'function' ? window.getVerbRoot(lower) : lower;

    return { raw: token, cleanRaw: cleanRaw, word: lower, stem: stem, verbRoot: verbRoot, punct: punct };
  };

  const refTokens = refText.split(/\s+/).filter(Boolean).map(parseToken);
  const userTokens = userText.split(/\s+/).filter(Boolean).map(parseToken);

  const is5StrokeRule = (historyItem.wordCountRule || rules.wordCountRule) === '5stroke';
  const totalStrokesMaterial = refText.length;
  const totalStrokesUser = userText.length;
  const totalWordsMaterial = is5StrokeRule ? Math.round(totalStrokesMaterial / 5) : refTokens.length;
  const totalWordsUser = is5StrokeRule ? Math.round(totalStrokesUser / 5) : userTokens.length;

  const isCompSingularPluralPair = (w1, w2, s1, s2) => {
    if (!w1 || !w2 || w1 === w2) return false;
    if (s1 && s2 && s1 === s2) return true;
    const irregularPlurals = {
      'child': 'children', 'children': 'child',
      'man': 'men', 'men': 'man',
      'woman': 'women', 'women': 'woman',
      'person': 'people', 'people': 'person',
      'foot': 'feet', 'feet': 'foot',
      'tooth': 'teeth', 'teeth': 'tooth',
      'mouse': 'mice', 'mice': 'mouse',
      'datum': 'data', 'data': 'datum',
      'criterion': 'criteria', 'criteria': 'criterion',
      'phenomenon': 'phenomena', 'phenomena': 'phenomenon',
      'analysis': 'analyses', 'analyses': 'analysis',
      'basis': 'bases', 'bases': 'basis',
      'crisis': 'crises', 'crises': 'crisis',
      'index': 'indices', 'indices': 'index',
      'leaf': 'leaves', 'leaves': 'leaf',
      'life': 'lives', 'lives': 'life',
      'wife': 'wives', 'wives': 'wife',
      'wolf': 'wolves', 'wolves': 'wolf'
    };
    if (irregularPlurals[w1] === w2) return true;
    if (w1 + 's' === w2 || w2 + 's' === w1) return true;
    if (w1 + 'es' === w2 || w2 + 'es' === w1) return true;
    if ((w1.endsWith('y') && w1.slice(0, -1) + 'ies' === w2) || (w2.endsWith('y') && w2.slice(0, -1) + 'ies' === w1)) return true;
    return false;
  };

  const m = refTokens.length;
  const n = userTokens.length;
  const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const rTok = refTokens[i - 1];
      const uTok = userTokens[j - 1];
      const isSingPlur = isCompSingularPluralPair(rTok.word, uTok.word, rTok.stem, uTok.stem);
      const isVerbMatch = rTok.verbRoot && uTok.verbRoot && (
        rTok.verbRoot === uTok.verbRoot ||
        rTok.verbRoot + 'e' === uTok.verbRoot ||
        uTok.verbRoot + 'e' === rTok.verbRoot
      );
      if (rTok.word === uTok.word || isSingPlur || rTok.stem === uTok.stem || isVerbMatch) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m, j = n;
  let annotatedUserHtml = [];
  let annotatedRefHtml = [];

  let computedWrongWords = 0; 
  let computedVerbFormErrors = 0;
  let computedSingularPluralErrors = 0;
  let computedWordsLeft = 0;   
  let computedExtraWords = 0; 
  let computedCapitalErrors = 0;
  let computedPunctuationErrors = { extra: 0, left: 0, wrong: 0 };
  let skippedLowerMistakesCount = 0;

  const deductWrong = rules.deductWrong ?? 1.0;
  const deductOmission = rules.deductOmission ?? 1.0;
  const deductVerbForm = rules.deductVerbForm ?? 0.5;
  const deductSingularPlural = rules.deductSingularPlural ?? 0.5;
  const deductExtraWord = rules.deductExtraWord ?? 0.5;
  const deductParaNotChanged = rules.deductParaNotChanged ?? 1.0;
  const deductCapital = rules.deductCapital ?? 0.25;
  const deductPunctuation = rules.deductPunctuation ?? 0.5;

  const selectHighestMistakeForComparison = (candidates) => {
    if (!candidates || candidates.length === 0) return null;
    candidates.sort((a, b) => b.deduct - a.deduct);
    if (candidates.length > 1) {
      skippedLowerMistakesCount += (candidates.length - 1);
    }
    return {
      highest: candidates[0],
      skipped: candidates.slice(1)
    };
  };

  const sectionWiseMistakeDetails = {
    wrongWords: [],
    verbErrors: [],
    singularPlural: [],
    omittedWords: [],
    extraWords: [],
    capitalErrors: [],
    punctErrors: [],
    correctWords: []
  };
  const escCompHtml = (val) => String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const escCompJs = (val) => String(val ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  while (i > 0 || j > 0) {
    const rTok = i > 0 ? refTokens[i - 1] : null;
    const uTok = j > 0 ? userTokens[j - 1] : null;
    const isSingPlur = rTok && uTok && isCompSingularPluralPair(rTok.word, uTok.word, rTok.stem, uTok.stem);
    const isVerbMatch = rTok && uTok && rTok.verbRoot && uTok.verbRoot && (
      rTok.verbRoot === uTok.verbRoot ||
      rTok.verbRoot + 'e' === uTok.verbRoot ||
      uTok.verbRoot + 'e' === rTok.verbRoot
    );

    if (i > 0 && j > 0 && (rTok.word === uTok.word || isSingPlur || rTok.stem === uTok.stem || isVerbMatch)) {
      const refT = rTok;
      const userT = uTok;
      const safeRefRaw = escCompHtml(refT.raw);
      const safeUserRaw = escCompHtml(userT.raw);
      const safeRefClean = escCompHtml(refT.cleanRaw);
      const isWordDiff = (refT.word !== userT.word);
      const isCapErr = (refT.cleanRaw.toLowerCase() === userT.cleanRaw.toLowerCase() && refT.cleanRaw !== userT.cleanRaw) ||
                       (isWordDiff && refT.cleanRaw[0] && userT.cleanRaw[0] && (refT.cleanRaw[0] === refT.cleanRaw[0].toUpperCase()) !== (userT.cleanRaw[0] === userT.cleanRaw[0].toUpperCase()));
      const isPunctDiff = (refT.punct !== userT.punct);

      const candidates = [];
      if (isWordDiff) {
        if (isSingPlur) {
          candidates.push({ type: 'singular_plural', label: `Singular/Plural (-${deductSingularPlural})`, deduct: deductSingularPlural });
        } else {
          candidates.push({ type: 'verb', label: `Verb Form (-${deductVerbForm})`, deduct: deductVerbForm });
        }
      }
      if (isCapErr) {
        candidates.push({ type: 'capital', label: `Capital Error (-${deductCapital})`, deduct: deductCapital });
      }
      if (isPunctDiff) {
        const pSub = !refT.punct && userT.punct ? 'extra' : (refT.punct && !userT.punct ? 'left' : 'wrong');
        candidates.push({ type: 'punct', subType: pSub, label: `Punctuation Error (-${deductPunctuation})`, deduct: deductPunctuation });
      }

      const picked = selectHighestMistakeForComparison(candidates);
      const clickWordAttr = `onclick="seekPostDictationReviewWord(${i - 1}, ${refTokens.length}, '${escCompJs(refT.cleanRaw)}')" style="cursor: pointer;`;
      if (!picked) {
        sectionWiseMistakeDetails.correctWords.unshift({ pos: i, userWord: userT.raw, refWord: refT.raw });
        annotatedUserHtml.unshift(`<span ${clickWordAttr} color: inherit; margin: 0 2px;" title="Click to jump to audio timestamp &amp; view Pitman Shorthand Outline for '${safeRefClean}'">${safeUserRaw}</span>`);
      } else {
        const chosen = picked.highest;
        const skippedNote = picked.skipped.length > 0
          ? ` | Skipped lower mistake: ${picked.skipped.map(s => s.label).join(', ')}`
          : '';
        if (chosen.type === 'singular_plural') {
          computedSingularPluralErrors++;
          sectionWiseMistakeDetails.singularPlural.unshift({ pos: i, userWord: userT.raw, refWord: refT.raw, deduct: deductSingularPlural });
          annotatedUserHtml.unshift(`<span ${clickWordAttr} background: rgba(14, 165, 233, 0.22); color: #0369a1; padding: 2px 4px; border-radius: 4px; margin: 0 2px;" title="Click to jump to audio &amp; view outline • Singular/Plural Error: Expected '${safeRefClean}' (-${deductSingularPlural})${escCompHtml(skippedNote)}">${safeUserRaw} <small>(Singular/Plural: ${safeRefClean}${picked.skipped.length ? ' • Highest Counted' : ''})</small></span>`);
        } else if (chosen.type === 'verb') {
          computedVerbFormErrors++;
          sectionWiseMistakeDetails.verbErrors.unshift({ pos: i, userWord: userT.raw, refWord: refT.raw, deduct: deductVerbForm });
          annotatedUserHtml.unshift(`<span ${clickWordAttr} background: rgba(236, 72, 153, 0.22); color: #be185d; padding: 2px 4px; border-radius: 4px; margin: 0 2px;" title="Click to jump to audio &amp; view outline • Verb Form Error: Expected '${safeRefClean}' (-${deductVerbForm})${escCompHtml(skippedNote)}">${safeUserRaw} <small>(Verb Form: ${safeRefClean}${picked.skipped.length ? ' • Highest Counted' : ''})</small></span>`);
        } else if (chosen.type === 'capital') {
          computedCapitalErrors++;
          sectionWiseMistakeDetails.capitalErrors.unshift({ pos: i, userWord: userT.raw, refWord: refT.raw, deduct: deductCapital });
          annotatedUserHtml.unshift(`<span ${clickWordAttr} background: rgba(245, 158, 11, 0.25); color: #b45309; padding: 2px 4px; border-radius: 4px; margin: 0 2px;" title="Click to jump to audio &amp; view outline • Capitalization Error: Expected '${safeRefClean}' (-${deductCapital})${escCompHtml(skippedNote)}">${safeUserRaw} <small>(Cap Rule: ${safeRefClean}${picked.skipped.length ? ' • Highest Counted' : ''})</small></span>`);
        } else if (chosen.type === 'punct') {
          if (chosen.subType === 'extra') computedPunctuationErrors.extra++;
          else if (chosen.subType === 'left') computedPunctuationErrors.left++;
          else computedPunctuationErrors.wrong++;
          sectionWiseMistakeDetails.punctErrors.unshift({ pos: i, userWord: userT.raw, refWord: refT.raw, subType: chosen.subType, deduct: deductPunctuation });
          annotatedUserHtml.unshift(`<span ${clickWordAttr} background: rgba(6, 182, 212, 0.2); color: var(--accent); padding: 2px 4px; border-radius: 4px; margin: 0 2px;" title="Click to jump to audio &amp; view outline • Punctuation Error (-${deductPunctuation})${escCompHtml(skippedNote)}">${safeUserRaw} <small>(Punct Error${picked.skipped.length ? ' • Highest Counted' : ''})</small></span>`);
        }
      }

      annotatedRefHtml.unshift(`<span ${clickWordAttr} color: inherit; margin: 0 2px;" title="Click to hear '${safeRefClean}' &amp; view Pitman Shorthand Outline">${safeRefRaw}</span>`);
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1]) {
      const refT = refTokens[i - 1];
      const userT = userTokens[j - 1];
      const safeRefRaw = escCompHtml(refT.raw);
      const safeUserRaw = escCompHtml(userT.raw);
      const safeRefClean = escCompHtml(refT.cleanRaw);
      const clickWordAttr = `onclick="seekPostDictationReviewWord(${i - 1}, ${refTokens.length}, '${escCompJs(refT.cleanRaw)}')" style="cursor: pointer;`;
      const candidates = [{ type: 'wrong', label: `Wrong Word (-${deductWrong})`, deduct: deductWrong }];
      if (refT.punct !== userT.punct) {
        candidates.push({ type: 'punct', subType: 'wrong', label: `Punctuation Error (-${deductPunctuation})`, deduct: deductPunctuation });
      }
      const picked = selectHighestMistakeForComparison(candidates);
      if (picked.highest.type === 'punct') {
        computedPunctuationErrors.wrong++;
        sectionWiseMistakeDetails.punctErrors.unshift({ pos: i, userWord: userT.raw, refWord: refT.raw, subType: 'wrong', deduct: deductPunctuation });
      } else {
        computedWrongWords++;
        sectionWiseMistakeDetails.wrongWords.unshift({ pos: i, userWord: userT.raw, refWord: refT.raw, deduct: deductWrong });
      }
      const skippedNote = picked.skipped.length > 0 ? ` | Skipped lower mistake: ${picked.skipped.map(s => s.label).join(', ')}` : '';
      annotatedUserHtml.unshift(`<span ${clickWordAttr} background: rgba(239, 68, 68, 0.25); color: var(--danger); padding: 2px 4px; border-radius: 4px; margin: 0 2px;" title="Click to jump to audio timestamp &amp; view Shorthand Outline • Spelling / Wrong Word (-${picked.highest.deduct})${escCompHtml(skippedNote)}"><s>${safeUserRaw}</s> <strong style="color:var(--success);">[${safeRefRaw}]</strong></span>`);
      annotatedRefHtml.unshift(`<span ${clickWordAttr} color: inherit; margin: 0 2px;" title="Click to hear '${safeRefClean}' &amp; view Pitman Shorthand Outline">${safeRefRaw}</span>`);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      const extraRaw = escCompHtml(userTokens[j - 1].raw);
      const extraCleanJs = escCompJs(userTokens[j - 1].cleanRaw);
      const clickWordAttr = `onclick="seekPostDictationReviewWord(${Math.max(0, i - 1)}, ${refTokens.length}, '${extraCleanJs}')" style="cursor: pointer;`;
      const candidates = [{ type: 'extra', label: `Extra Word (-${deductExtraWord})`, deduct: deductExtraWord }];
      if (userTokens[j - 1].punct) {
        candidates.push({ type: 'punct', subType: 'extra', label: `Punctuation Error (-${deductPunctuation})`, deduct: deductPunctuation });
      }
      const picked = selectHighestMistakeForComparison(candidates);
      if (picked.highest.type === 'punct') {
        computedPunctuationErrors.extra++;
        sectionWiseMistakeDetails.punctErrors.unshift({ pos: j, userWord: userTokens[j - 1].raw, refWord: '(Extra Punctuation)', subType: 'extra', deduct: deductPunctuation });
      } else {
        computedExtraWords++;
        sectionWiseMistakeDetails.extraWords.unshift({ pos: j, userWord: userTokens[j - 1].raw, refWord: '(Extra Word Added)', deduct: deductExtraWord });
      }
      annotatedUserHtml.unshift(`<span ${clickWordAttr} background: rgba(139, 92, 246, 0.22); color: #7c3aed; padding: 2px 4px; border-radius: 4px; margin: 0 2px;" title="Click to jump to audio timestamp • Extra Typed Word"><s>${extraRaw}</s> <small>(Extra)</small></span>`);
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      const leftRaw = escCompHtml(refTokens[i - 1].raw);
      const leftCleanHtml = escCompHtml(refTokens[i - 1].cleanRaw);
      const leftCleanJs = escCompJs(refTokens[i - 1].cleanRaw);
      const clickWordAttr = `onclick="seekPostDictationReviewWord(${i - 1}, ${refTokens.length}, '${leftCleanJs}')" style="cursor: pointer;`;
      const candidates = [{ type: 'left', label: `Word Left (-${deductOmission})`, deduct: deductOmission }];
      if (refTokens[i - 1].punct) {
        candidates.push({ type: 'punct', subType: 'left', label: `Punctuation Error (-${deductPunctuation})`, deduct: deductPunctuation });
      }
      const picked = selectHighestMistakeForComparison(candidates);
      if (picked.highest.type === 'punct') {
        computedPunctuationErrors.left++;
        sectionWiseMistakeDetails.punctErrors.unshift({ pos: i, userWord: '(Omitted Punct)', refWord: refTokens[i - 1].raw, subType: 'left', deduct: deductPunctuation });
      } else {
        computedWordsLeft++;
        sectionWiseMistakeDetails.omittedWords.unshift({ pos: i, userWord: '(Omitted / Not Typed)', refWord: refTokens[i - 1].raw, deduct: deductOmission });
      }
      annotatedRefHtml.unshift(`<span ${clickWordAttr} color: inherit; margin: 0 2px;" title="Click to hear '${leftCleanHtml}' &amp; view Shorthand Outline">${leftRaw}</span>`);
      annotatedUserHtml.unshift(`<span ${clickWordAttr} color: var(--danger); font-weight: bold; margin: 0 2px;" title="Click to jump to audio timestamp &amp; view Shorthand Outline • Word Left / Omission">(Left) <s>${leftRaw}</s></span>`);
      i--;
    } else {
      const refT = refTokens[i - 1];
      const userT = userTokens[j - 1];
      const safeRefRaw = escCompHtml(refT.raw);
      const safeUserRaw = escCompHtml(userT.raw);
      const safeRefClean = escCompHtml(refT.cleanRaw);
      const clickWordAttr = `onclick="seekPostDictationReviewWord(${i - 1}, ${refTokens.length}, '${escCompJs(refT.cleanRaw)}')" style="cursor: pointer;`;
      const candidates = [{ type: 'wrong', label: `Wrong Word (-${deductWrong})`, deduct: deductWrong }];
      if (refT.punct !== userT.punct) {
        candidates.push({ type: 'punct', subType: 'wrong', label: `Punctuation Error (-${deductPunctuation})`, deduct: deductPunctuation });
      }
      const picked = selectHighestMistakeForComparison(candidates);
      if (picked.highest.type === 'punct') {
        computedPunctuationErrors.wrong++;
        sectionWiseMistakeDetails.punctErrors.unshift({ pos: i, userWord: userT.raw, refWord: refT.raw, subType: 'wrong', deduct: deductPunctuation });
      } else {
        computedWrongWords++;
        sectionWiseMistakeDetails.wrongWords.unshift({ pos: i, userWord: userT.raw, refWord: refT.raw, deduct: deductWrong });
      }
      annotatedUserHtml.unshift(`<span ${clickWordAttr} background: rgba(239, 68, 68, 0.25); color: var(--danger); padding: 2px 4px; border-radius: 4px; margin: 0 2px;" title="Click to jump to audio &amp; view Shorthand Outline • Spelling / Wrong Word"><s>${safeUserRaw}</s> <strong style="color:var(--success);">[${safeRefRaw}]</strong></span>`);
      annotatedRefHtml.unshift(`<span ${clickWordAttr} color: inherit; margin: 0 2px;" title="Click to hear '${safeRefClean}' &amp; view Shorthand Outline">${safeRefRaw}</span>`);
      i--;
      j--;
    }
  }

  const matchingWords = (historyItem.CorrectWords !== undefined && historyItem.CorrectWords !== '-')
    ? historyItem.CorrectWords
    : (historyItem.correctWords !== undefined ? historyItem.correctWords : Math.max(0, dp[m][n] - computedVerbFormErrors - computedSingularPluralErrors));

  if (body) {
    const accuracy = historyItem.AccuracyPercentage || historyItem.accuracyPercentage || 0;
    const totalMarksVal = historyItem.TotalMarks || historyItem.totalMarks || rules.totalMarks || 100;
    const marksObtainedVal = historyItem.MarksObtained || historyItem.marksObtained || '-';
    const passingCutoffPct = rules.passingAccuracy ?? rules.passingMarks ?? 85;
    const passingCutoffMarks = rules.passingMarks ?? passingCutoffPct;
    
    const totalBackspaces = historyItem.TotalBackspace ?? historyItem.totalBackspace ?? 0;
    const wrongWordsCount = computedWrongWords;
    const verbFormCount = computedVerbFormErrors;
    const singularPluralCount = computedSingularPluralErrors;
    const wordsLeftCount = computedWordsLeft;
    const extraWordsCount = computedExtraWords;
    const paraNotChangedCount = historyItem.ParaNotChanged ?? historyItem.paraNotChanged ?? 0;
    const capitalErrorCount = computedCapitalErrors;
    
    const totalPunctErrorCount = computedPunctuationErrors.extra + computedPunctuationErrors.left + computedPunctuationErrors.wrong;

    const wrongDeduction = (wrongWordsCount * deductWrong).toFixed(2);
    const verbFormDeduction = (verbFormCount * deductVerbForm).toFixed(2);
    const singularPluralDeduction = (singularPluralCount * deductSingularPlural).toFixed(2);
    const wordLeftDeduction = (wordsLeftCount * deductOmission).toFixed(2);
    const extraDeduction = (extraWordsCount * deductExtraWord).toFixed(2);
    const paraDeduction = (paraNotChangedCount * deductParaNotChanged).toFixed(2);
    const capitalDeduction = (capitalErrorCount * deductCapital).toFixed(2);
    const punctuationDeduction = (totalPunctErrorCount * deductPunctuation).toFixed(2);
    const totalPointsDeducted = (
      parseFloat(wrongDeduction) +
      parseFloat(verbFormDeduction) +
      parseFloat(singularPluralDeduction) +
      parseFloat(wordLeftDeduction) +
      parseFloat(extraDeduction) +
      parseFloat(paraDeduction) +
      parseFloat(capitalDeduction) +
      parseFloat(punctuationDeduction)
    ).toFixed(2);
    const correctStrokesUser = Math.max(0, Math.round(totalStrokesUser * (parseFloat(accuracy) / 100)));

    // 👉 Requirement #5: Ensure Exam Title and Passage Title are always distinct even for legacy history entries
    let displayExamTitle = examNameVal;
    let passageTitle = historyItem.PassageTitle || historyItem.passageTitle || historyItem.Title || '-';
    if (passageTitle === displayExamTitle || passageTitle === '-') {
      if (displayExamTitle.includes('[')) {
        const bracketMatch = displayExamTitle.match(/\[(.*?)\]/);
        const extractedRule = bracketMatch ? bracketMatch[1] : (rules.examDisplayName || 'Standard Evaluation Rule');
        const extractedPassage = displayExamTitle.replace(/\[.*?\]/g, '').replace(/^(Audio Dictation|Pitman|Typing Test|Learning Exercise):\s*/i, '').trim();
        displayExamTitle = extractedRule;
        passageTitle = extractedPassage || 'Master Practice Passage';
      } else if (displayExamTitle.includes(' - ')) {
        const parts = displayExamTitle.split(' - ');
        displayExamTitle = parts[0].trim();
        passageTitle = parts.slice(1).join(' - ').trim();
      } else if (rules.examDisplayName && rules.examDisplayName !== displayExamTitle) {
        passageTitle = displayExamTitle.replace(/^(Audio Dictation|Pitman|Typing Test|Learning Exercise):\s*/i, '').trim();
        displayExamTitle = rules.examDisplayName;
      } else {
        passageTitle = `${displayExamTitle} — Master Passage`;
      }
    }

    const timeDuration = historyItem.TimeDuration || historyItem.timeDuration || (rules.timeLimit ? `${rules.timeLimit} Mins` : '10 Mins');
    const timeTaken = historyItem.TimeTaken || historyItem.timeTaken || historyItem.TimeUsed || historyItem.timeUsed || '-';
    const submittedTimeStr = historyItem.submissionTime || historyItem.SubmissionTime || (dateVal ? `${dateVal}` : '-');
    const grossAdmin = historyItem.GrossSpeed ?? historyItem.grossSpeed ?? 0;
    const netAdmin = historyItem.NetSpeed ?? historyItem.netSpeed ?? 0;
    const grossUserTime = historyItem.userTimeGrossSpeed ?? historyItem.GrossSpeedUserTime ?? historyItem.grossSpeedUserTime ?? grossAdmin;
    const netUserTime = historyItem.userTimeNetSpeed ?? historyItem.NetSpeedUserTime ?? historyItem.netSpeedUserTime ?? netAdmin;
    
    const errorRelaxed = historyItem.ErrorRelaxed || historyItem.errorRelaxed || `${rules.ignoreErrorPct !== undefined ? rules.ignoreErrorPct : 0}%`;
    const penaltyWord = historyItem.PenaltyWord || historyItem.penaltyWord || `${rules.penaltyValue !== undefined ? rules.penaltyValue : 1.0}`;
    const status = historyItem.Status || historyItem.status || 'FAILED';
    window._lastCompleteUserTypedPassageText = userText || '';
    window._lastEvaluatedSheetExportData = {
      examNameVal: displayExamTitle,
      passageTitle,
      dateVal: dateVal || '-',
      timeDuration,
      timeTaken,
      submittedTimeStr,
      wordCountFormula: is5StrokeRule ? '5 Strokes = 1 Word' : '1 Space = 1 Word',
      errorRelaxed,
      penaltyWord,
      passingCutoffPct,
      passingCutoffMarks,
      accuracy,
      marksObtainedVal,
      totalMarksVal,
      totalPointsDeducted,
      status,
      grossAdmin,
      netAdmin,
      grossUserTime,
      netUserTime,
      totalWordsMaterial,
      totalStrokesMaterial,
      refTokensCount: refTokens.length,
      totalWordsUser,
      totalStrokesUser,
      correctStrokesUser,
      userTokensCount: userTokens.length,
      matchingWords,
      completionRatePct: refTokens.length > 0 ? ((matchingWords / refTokens.length) * 100).toFixed(1) : '0.0',
      totalBackspaces,
      backspaceRuleLabel: rules.disableBackspace ? 'Disabled' : (rules.maxBackspaces > 0 ? ('Max ' + rules.maxBackspaces) : 'Unlimited'),
      wrongWordsCount,
      deductWrong,
      wrongDeduction,
      verbFormCount,
      deductVerbForm,
      verbFormDeduction,
      singularPluralCount,
      deductSingularPlural,
      singularPluralDeduction,
      wordsLeftCount,
      deductOmission,
      wordLeftDeduction,
      extraWordsCount,
      deductExtraWord,
      extraDeduction,
      paraNotChangedCount,
      deductParaNotChanged,
      paraDeduction,
      capitalErrorCount,
      deductCapital,
      capitalDeduction,
      totalPunctErrorCount,
      deductPunctuation,
      punctuationDeduction,
      punctExtra: computedPunctuationErrors.extra,
      punctLeft: computedPunctuationErrors.left,
      punctWrong: computedPunctuationErrors.wrong,
      punctModeLabel: rules.punctuationMode === 'error' ? 'Counted as Error' : 'Ignored',
      skippedLowerMistakesCount,
      refText,
      userText,
      annotatedRefHtmlStr: annotatedRefHtml.join(' '),
      annotatedUserHtmlStr: annotatedUserHtml.join(' '),
      sectionWiseMistakeDetails: sectionWiseMistakeDetails,
      sectionWiseMistakeHtml: buildSectionWiseMistakeComparisonHtml(sectionWiseMistakeDetails, false),
      sectionWiseMistakePdfHtml: buildSectionWiseMistakeComparisonHtml(sectionWiseMistakeDetails, true)
    };

    const comparisonHeatmapHtml = typeof buildComparisonHeatmapHtml === 'function'
      ? buildComparisonHeatmapHtml(historyItem)
      : '';

    body.scrollTop = 0;
    body.innerHTML = `
      <div class="rp-comparison-inner-shell" style="display: flex; flex-direction: column; gap: 16px; padding: 18px 20px 36px; width: 100%; max-width: 1360px; margin: 0 auto; box-sizing: border-box; background: var(--background); color: var(--text);">
        
        <!-- ERROR COLOR LEGEND BAR -->
        <div class="error-legend-bar">
          <span style="color: var(--secondary); font-weight: 800;"><i class="fa-solid fa-palette"></i> Error Color Legend (${punctMode === 'fullstop_only' ? 'Steno Mode: Full Stop Only in Error' : 'All Punctuation Mode'}):</span>
          <div class="legend-badge">
            <span class="legend-color-box" style="background: rgba(239, 68, 68, 0.4);"></span> Spelling / Wrong Word (-${deductWrong}/word)
          </div>
          <div class="legend-badge">
            <span class="legend-color-box" style="background: rgba(236, 72, 153, 0.4);"></span> Verb Form Error (-${deductVerbForm}/word)
          </div>
          <div class="legend-badge">
            <span class="legend-color-box" style="background: rgba(14, 165, 233, 0.4);"></span> Singular / Plural Error (-${deductSingularPlural}/word)
          </div>
          <div class="legend-badge">
            <span class="legend-color-box" style="background: rgba(6, 182, 212, 0.4);"></span> Punctuation Error (-${deductPunctuation}/mark)
          </div>
          <div class="legend-badge">
            <span class="legend-color-box" style="background: rgba(245, 158, 11, 0.4);"></span> Capitalization Error (-${deductCapital}/word)
          </div>
          <div class="legend-badge">
            <span class="legend-color-box" style="background: rgba(139, 92, 246, 0.4);"></span> Extra Word (-${deductExtraWord}/word)
          </div>
          <div class="legend-badge">
            <span class="legend-color-box" style="background: #ef4444;"></span> Word Left / Omission (-${deductOmission}/word)
          </div>
        </div>

        <div style="background: var(--surface); border: 1px solid var(--border); padding: 18px; border-radius: var(--radius); box-shadow: 0 4px 12px var(--shadow);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
            <h4 style="color: var(--secondary); display: flex; align-items: center; gap: 8px; margin: 0;">
              <i class="fa-solid fa-chart-pie" style="color: var(--primary);"></i> Comprehensive Exam Details & Official Evaluation Summary
            </h4>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #059669, #10b981); border: none; font-weight: 800; padding: 6px 14px; border-radius: 20px;" onclick="downloadOfficialEvaluatedAnswerSheetPdf()">
                <i class="fa-solid fa-file-pdf"></i> Download Official Evaluated Answer Sheet (PDF)
              </button>
              <label style="display: flex; align-items: center; gap: 6px; font-weight: 700; cursor: pointer; font-size: 13px; background: rgba(37, 99, 235, 0.14); color: var(--primary); padding: 6px 14px; border-radius: 20px; border: 1px solid var(--primary);">
                <input type="checkbox" id="modal-toggle-time-used" onchange="toggleModalSpeedView()"> Toggle Admin Time vs. User Time Speed
              </label>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; font-size: 12.5px;" id="modal-summary-metrics-grid">
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Exam Title:</strong> ${displayExamTitle}</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Passage Title:</strong> ${passageTitle}</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Exam Date:</strong> ${dateVal || '-'}</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;" id="comp-metric-duration"><strong>Allotted Duration:</strong> ${timeDuration}</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;" id="comp-metric-timetaken"><strong>Actual Time Taken:</strong> ${timeTaken}</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Submitted At:</strong> ${submittedTimeStr}</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Word Count Formula:</strong> ${is5StrokeRule ? '5 Strokes = 1 Word' : '1 Space = 1 Word'}</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Error Relaxed / Penalty:</strong> ${errorRelaxed} (x${penaltyWord})</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Passing Cutoff:</strong> ${passingCutoffPct}% (${passingCutoffMarks} Marks)</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Accuracy Achieved:</strong> ${accuracy}%</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Marks Obtained:</strong> ${marksObtainedVal} / ${totalMarksVal} <span style="color:#ef4444; font-weight:700;">(-${totalPointsDeducted} Deducted)</span></div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Final Result:</strong> <span class="role-badge" style="background: ${status === 'PASSED' ? 'var(--success)' : 'var(--danger)'};">${status}</span></div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;" id="comp-metric-gross"><strong>Gross Speed (Admin Time):</strong> ${grossAdmin} WPM</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;" id="comp-metric-net"><strong>Net Speed (Admin Time):</strong> ${netAdmin} WPM</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Gross Speed (User Time):</strong> ${grossUserTime} WPM</div>
            <div style="background: var(--border); padding: 10px; border-radius: 6px;"><strong>Net Speed (User Time):</strong> ${netUserTime} WPM</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px;">
          <div class="card" style="border-left: 4px solid var(--info, #3b82f6); padding: 14px;">
            <h5 style="color: var(--info, #3b82f6); margin-bottom: 6px;"><i class="fa-solid fa-file-lines"></i> Master Passage Stats</h5>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.5;">
              Master Words: <strong>${totalWordsMaterial}</strong> (${refTokens.length} Space Tokens)<br>
              Master Strokes: <strong>${totalStrokesMaterial}</strong> Characters
            </p>
          </div>
          <div class="card" style="border-left: 4px solid var(--secondary); padding: 14px;">
            <h5 style="color: var(--secondary); margin-bottom: 6px;"><i class="fa-solid fa-keyboard"></i> User Stroke & Volume Stats</h5>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.5;">
              Words Typed: <strong>${totalWordsUser}</strong> (${userTokens.length} Space Tokens)<br>
              Total Strokes: <strong>${totalStrokesUser}</strong> | Accurate Strokes: <strong style="color:#10b981;">${correctStrokesUser}</strong>
            </p>
          </div>
          <div class="card" style="border-left: 4px solid #10b981; padding: 14px; background: rgba(16, 185, 129, 0.08);">
            <h5 style="color: #10b981; margin-bottom: 6px;"><i class="fa-solid fa-circle-check"></i> Exact Matched Words: ${matchingWords}</h5>
            <p style="font-size: 12.5px; color: var(--text); margin: 0; line-height: 1.5;">
              Matched Accuracy Ratio: <strong>${matchingWords} / ${totalWordsMaterial}</strong><br>
              Completion Rate: <strong>${totalWordsMaterial > 0 ? Math.min(100, Math.round((totalWordsUser / totalWordsMaterial) * 100)) : 0}%</strong>
            </p>
          </div>
          <div class="card" style="border-left: 4px solid var(--primary); padding: 14px;">
            <h5 style="color: var(--primary); margin-bottom: 6px;"><i class="fa-solid fa-rotate-left"></i> Backspaces Used: ${totalBackspaces}</h5>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.5;">
              Rule Mode: <strong>${rules.backspaceMode === 'until_space' ? 'UNTIL SPACEBAR ONLY' : (rules.backspaceMode || 'on').toUpperCase()}${rules.backspaceMode === 'limited' ? ' (Max ' + (rules.backspaceLimit || 15) + ')' : ''}</strong>
            </p>
          </div>
          <div class="card" style="border-left: 4px solid var(--danger); padding: 14px;">
            <h5 style="color: var(--danger); margin-bottom: 6px;"><i class="fa-solid fa-triangle-exclamation"></i> Spelling / Wrong Word: ${wrongWordsCount}</h5>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.5;">Rule: -${deductWrong}/word | Deducted: <strong>-${wrongDeduction}</strong></p>
          </div>
          <div class="card" style="border-left: 4px solid #ec4899; padding: 14px;">
            <h5 style="color: #be185d; margin-bottom: 6px;"><i class="fa-solid fa-spell-check"></i> Verb Form Errors: ${verbFormCount}</h5>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.5;">Rule: -${deductVerbForm}/word | Deducted: <strong>-${verbFormDeduction}</strong></p>
          </div>
          <div class="card" style="border-left: 4px solid #0284c7; padding: 14px;">
            <h5 style="color: #0369a1; margin-bottom: 6px;"><i class="fa-solid fa-arrows-left-right"></i> Singular / Plural Errors: ${singularPluralCount}</h5>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.5;">Rule: -${deductSingularPlural}/word | Deducted: <strong>-${singularPluralDeduction}</strong></p>
          </div>
          <div class="card" style="border-left: 4px solid var(--warning); padding: 14px;">
            <h5 style="color: var(--warning); margin-bottom: 6px;"><i class="fa-solid fa-book-bookmark"></i> Words Left / Omitted: ${wordsLeftCount}</h5>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.5;">Rule: -${deductOmission}/word | Deducted: <strong>-${wordLeftDeduction}</strong></p>
          </div>
          <div class="card" style="border-left: 4px solid #7c3aed; padding: 14px;">
            <h5 style="color: #7c3aed; margin-bottom: 6px;"><i class="fa-solid fa-plus"></i> Extra Words Added: ${extraWordsCount}</h5>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.5;">Rule: -${deductExtraWord}/word | Deducted: <strong>-${extraDeduction}</strong></p>
          </div>
          <div class="card" style="border-left: 4px solid #06b6d4; padding: 14px;">
            <h5 style="color: #06b6d4; margin-bottom: 6px;"><i class="fa-solid fa-paragraph"></i> Paragraph Changes: ${paraNotChangedCount}</h5>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.5;">Rule: -${deductParaNotChanged}/para | Deducted: <strong>-${paraDeduction}</strong></p>
          </div>
          <div class="card" style="border-left: 4px solid #b45309; padding: 14px;">
            <h5 style="color: #b45309; margin-bottom: 6px;"><i class="fa-solid fa-font"></i> Capitalization Errors: ${capitalErrorCount}</h5>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.5;">Rule: -${deductCapital}/word | Deducted: <strong>-${capitalDeduction}</strong></p>
          </div>
          <div class="card" style="border-left: 4px solid var(--accent); padding: 14px;">
            <h5 style="color: var(--accent); margin-bottom: 6px;"><i class="fa-solid fa-pencil"></i> Punctuation Errors: ${totalPunctErrorCount}</h5>
            <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.45;">
              Extra: ${computedPunctuationErrors.extra} | Left: ${computedPunctuationErrors.left} | Wrong: ${computedPunctuationErrors.wrong}<br>
              Rule: -${deductPunctuation}/mark | Deducted: <strong>-${punctuationDeduction}</strong>
            </p>
          </div>
          <div class="card" style="border-left: 4px solid #14b8a6; padding: 14px;">
            <h5 style="color: #0d9488; margin-bottom: 6px;"><i class="fa-solid fa-scale-balanced"></i> Highest Mistake Per Word Rule</h5>
            <p style="font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.45;">
              Active: Highest deduction counted per word.<br>
              Lower-Value Mistakes Skipped: <strong>${skippedLowerMistakesCount}</strong>
            </p>
          </div>
        </div>

        <!-- Requirement #6: Option to Show Complete User Typed Passage -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <strong style="color: var(--secondary); font-size: 14px;">
                <i class="fa-solid fa-file-signature" style="color: var(--primary);"></i> Complete User Typed Passage Option
              </strong>
              <span style="font-size: 11.5px; color: var(--text-muted); background: var(--background); padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); font-weight: 700;">
                📝 ${userTokens.length} Words Typed • ⌨️ ${totalStrokesUser} Characters/Strokes
              </span>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" id="btn-toggle-complete-user-passage" class="btn btn-primary btn-sm" onclick="toggleCompleteUserTypedPassagePanel()">
                <i class="fa-solid fa-eye"></i> Show Complete User Typed Passage
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="copyCompleteUserTypedPassageText()">
                <i class="fa-solid fa-copy"></i> Copy User Typed Passage
              </button>
            </div>
          </div>
          <div id="complete-user-typed-passage-panel" style="display: none; background: var(--background); border: 1px solid var(--border); border-left: 4px solid var(--primary); padding: 16px; border-radius: 8px; font-family: 'Segoe UI', monospace; font-size: 14px; line-height: 1.75; white-space: pre-wrap; color: var(--text); max-height: 280px; overflow-y: auto;">${(userText || '(No text was typed in this submission)').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>

        <!-- Shorthand Outline Overlay & Synced Word Highlight (Post-Dictation Review) -->
        <div id="post-dictation-synced-review-panel" style="background: linear-gradient(135deg, rgba(79,70,229,0.08), rgba(14,165,233,0.06)); border: 1.5px solid rgba(79,70,229,0.3); border-radius: 12px; padding: 14px 18px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px;">
          <div style="flex: 1.4; min-width: 280px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="background: #4f46e5; color: #fff; font-size: 10.5px; font-weight: 800; padding: 2px 9px; border-radius: 999px;"><i class="fa-solid fa-headphones"></i> POST-DICTATION SYNCED AUDIO &amp; SHORTHAND OUTLINE REVIEW</span>
              <span id="post-dict-selected-word-badge" style="font-size: 11.5px; font-weight: 800; color: var(--primary);">Click any word below to jump to its audio timestamp &amp; view Pitman Outline</span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted);">
              Click any misspelled, omitted, or matched word in the Master Passage or Your Transcription below to jump straight to that timestamp in the dictation audio and inspect its Pitman Shorthand stroke outline.
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
              <audio id="post-dictation-review-audio" controls style="height: 34px; max-width: 310px;" src="${window.currentAdminAudioCloudUrl || ''}"></audio>
              <button type="button" class="btn btn-primary btn-sm" onclick="replayPostDictationFromCurrentWord()">
                <i class="fa-solid fa-volume-high"></i> Replay Dictation from Selected Word
              </button>
            </div>
          </div>
          <div id="post-dictation-outline-svg-card" style="width: 260px; height: 115px; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; box-shadow: inset 0 2px 6px rgba(0,0,0,0.04);">
            <svg viewBox="0 0 250 105" width="100%" height="100%">
              <line x1="15" y1="38" x2="235" y2="38" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4" />
              <line x1="15" y1="78" x2="235" y2="78" stroke="#94a3b8" stroke-width="2" />
              <text x="18" y="73" fill="#94a3b8" font-size="8" font-weight="700">PITMAN SHORTHAND RULED LINE</text>
              <path d="M 65 78 Q 125 32 185 78" fill="none" stroke="#1e1b4b" stroke-width="3.5" stroke-linecap="round" />
              <circle cx="125" cy="48" r="3.5" fill="#dc2626" />
            </svg>
          </div>
        </div>

        <!-- PASSAGE COMPARISON (Master Passage vs. User Transcription — Annotated) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 16px; align-items: stretch;">
          <div style="display: flex; flex-direction: column; min-width: 0;">
            <h4 style="margin: 0 0 8px 0; color: var(--secondary); font-size: 14px;">📑 Master Passage (${refTokens.length} Words • ${totalStrokesMaterial} Strokes) <small style="font-size:11px; color:var(--primary); font-weight:700;">(Click any word for Audio &amp; Outline)</small></h4>
            <div class="watermark-text-container" style="background: var(--surface); border: 1px solid var(--border); padding: 16px; border-radius: 10px; min-height: 240px; max-height: 520px; overflow-y: auto; line-height: 1.85; font-size: var(--master-passage-font-size, 15px); color: var(--text); word-break: break-word; overflow-wrap: anywhere;">${annotatedRefHtml.length ? annotatedRefHtml.join(' ') : '<span style="color:var(--text-muted);">(Reference passage text not available for this record)</span>'}</div>
          </div>
          <div style="display: flex; flex-direction: column; min-width: 0;">
            <h4 style="margin: 0 0 8px 0; color: var(--secondary); font-size: 14px;">⌨️ Your Transcription — Annotated (${userTokens.length} Words • ${totalStrokesUser} Strokes) <small style="font-size:11px; color:var(--primary); font-weight:700;">(Click any mistake to jump to Audio)</small></h4>
            <div class="watermark-text-container" style="background: var(--surface); border: 1px solid var(--border); padding: 16px; border-radius: 10px; min-height: 240px; max-height: 520px; overflow-y: auto; line-height: 1.85; font-size: var(--master-passage-font-size, 15px); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: var(--text); word-break: break-word; overflow-wrap: anywhere;">${annotatedUserHtml.length ? annotatedUserHtml.join(' ') : '<span style="color:var(--text-muted);">(No typed transcription recorded for this attempt)</span>'}</div>
          </div>
        </div>

        <!-- 👉 REQUIREMENT #5: SECTION-WISE MISTAKE & CORRECT WORDS BREAKDOWN + RHYTHM & FINGER LATENCY HEATMAP AT THE BOTTOM AFTER PASSAGE COMPARISON -->
        ${window._lastEvaluatedSheetExportData.sectionWiseMistakeHtml}

        ${comparisonHeatmapHtml}

      </div>
    `;
  }
  if (modal) {
    modal.style.display = 'flex';
    enterImmersiveFullscreenLock('comparison');
  }

  try { portalHooks.emit('afterComparisonOpen', ...arguments); } catch (_hk) {}
}

export function buildSectionWiseMistakeComparisonHtml(details, isPdfMode = false) {
  if (!details) return '';
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sections = [
    {
      key: 'wrongWords',
      title: 'Section A: ❌ Spelling / Wrong Words (Typed Wrong vs. Correct Master Word)',
      color: '#dc2626',
      bg: 'rgba(239,68,68,0.08)',
      items: details.wrongWords || [],
      wrongLabel: 'Your Typed Word (Wrong)',
      rightLabel: 'Official Master Word (Correct)'
    },
    {
      key: 'verbErrors',
      title: 'Section B: 🔄 Verb Form Mistakes (Typed Verb vs. Correct Master Verb)',
      color: '#be185d',
      bg: 'rgba(236,72,153,0.08)',
      items: details.verbErrors || [],
      wrongLabel: 'Your Typed Verb (Wrong)',
      rightLabel: 'Correct Verb Form'
    },
    {
      key: 'singularPlural',
      title: 'Section C: 🔢 Singular / Plural Mistakes (Typed Form vs. Correct Form)',
      color: '#0369a1',
      bg: 'rgba(14,165,233,0.08)',
      items: details.singularPlural || [],
      wrongLabel: 'Your Typed Word (Wrong)',
      rightLabel: 'Correct Singular/Plural'
    },
    {
      key: 'omittedWords',
      title: 'Section D: ⏭️ Omitted / Left Words (Skipped in Transcription)',
      color: '#d97706',
      bg: 'rgba(245,158,11,0.08)',
      items: details.omittedWords || [],
      wrongLabel: 'Candidate Action',
      rightLabel: 'Omitted Master Word (Correct)'
    },
    {
      key: 'extraWords',
      title: 'Section E: ➕ Extra Words Added (Not Present in Master Passage)',
      color: '#7c3aed',
      bg: 'rgba(139,92,246,0.08)',
      items: details.extraWords || [],
      wrongLabel: 'Extra Word Typed (Wrong)',
      rightLabel: 'Master Passage Expects'
    },
    {
      key: 'capitalErrors',
      title: 'Section F: 🔠 Capitalization Mistakes (Case Mismatch)',
      color: '#b45309',
      bg: 'rgba(217,119,6,0.08)',
      items: details.capitalErrors || [],
      wrongLabel: 'Your Typed Case (Wrong)',
      rightLabel: 'Correct Capitalization'
    },
    {
      key: 'punctErrors',
      title: 'Section G: 🔣 Punctuation Mistakes (Missing / Extra / Wrong Mark)',
      color: '#0284c7',
      bg: 'rgba(2,132,199,0.08)',
      items: details.punctErrors || [],
      wrongLabel: 'Your Typed Token (Wrong)',
      rightLabel: 'Correct Punctuated Token'
    }
  ];

  const correctList = details.correctWords || [];
  const totalMistakeItems = sections.reduce((acc, s) => acc + s.items.length, 0);

  const sectionCardsHtml = sections.map(sec => {
    if (sec.items.length === 0) {
      return `
        <div style="border: 1px solid #cbd5e1; border-left: 4px solid ${sec.color}; border-radius: 8px; padding: 10px 12px; background: ${isPdfMode ? '#ffffff' : 'var(--surface)'};">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <strong style="font-size: 12px; color: ${sec.color};">${sec.title}</strong>
            <span style="font-size: 11px; font-weight: 800; color: #059669; background: rgba(16,185,129,0.12); padding: 2px 8px; border-radius: 999px;">✔ 0 Mistakes</span>
          </div>
        </div>
      `;
    }
    const rowsHtml = sec.items.map((item, idx) => `
      <tr style="border-bottom: 1px solid rgba(148,163,184,0.22);">
        <td style="padding: 5px 8px; font-weight: 700; color: #64748b; font-size: 11px;">#${idx + 1} (Word ${item.pos || '-'})</td>
        <td style="padding: 5px 8px; font-weight: 800; color: #dc2626; background: rgba(239,68,68,0.06); font-family: monospace; font-size: 12px;"><s>${esc(item.userWord)}</s></td>
        <td style="padding: 5px 8px; font-weight: 800; color: #059669; background: rgba(16,185,129,0.07); font-family: monospace; font-size: 12px;">${esc(item.refWord)}</td>
        <td style="padding: 5px 8px; font-weight: 800; color: ${sec.color}; font-size: 11px; text-align: right;">-${item.deduct ?? 0}</td>
      </tr>
    `).join('');

    return `
      <div style="border: 1px solid #cbd5e1; border-left: 4px solid ${sec.color}; border-radius: 8px; padding: 10px 12px; background: ${isPdfMode ? '#ffffff' : 'var(--surface)'};">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom: 8px; flex-wrap: wrap;">
          <strong style="font-size: 12.5px; color: ${sec.color};">${sec.title}</strong>
          <span style="font-size: 11px; font-weight: 900; color: #fff; background: ${sec.color}; padding: 2px 9px; border-radius: 999px;">${sec.items.length} Mistake${sec.items.length > 1 ? 's' : ''}</span>
        </div>
        <div style="max-height: ${isPdfMode ? 'none' : '210px'}; overflow-y: auto; border: 1px solid rgba(148,163,184,0.3); border-radius: 6px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: ${sec.bg}; font-size: 10.5px; text-transform: uppercase; color: #334155;">
                <th style="padding: 5px 8px;">Pos #</th>
                <th style="padding: 5px 8px; color: #b91c1c;">❌ ${sec.wrongLabel}</th>
                <th style="padding: 5px 8px; color: #047857;">✅ ${sec.rightLabel}</th>
                <th style="padding: 5px 8px; text-align: right;">Deducted</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  const correctPillsHtml = correctList.length > 0
    ? correctList.map(c => `<span style="display:inline-block; padding: 2px 7px; margin: 2px; border-radius: 5px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.35); color: #065f46; font-size: 11px; font-family: monospace; font-weight: 700;">#${c.pos}: ${esc(c.refWord)}</span>`).join('')
    : '<span style="font-size: 11.5px; color: #64748b;">No exact matched words recorded in this attempt.</span>';

  return `
    <div style="background: ${isPdfMode ? '#f8fafc' : 'var(--surface)'}; border: 1.5px solid #94a3b8; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
        <div>
          <strong style="font-size: 14px; color: ${isPdfMode ? '#1e3a8a' : 'var(--secondary)'};">
            🔍 Section-Wise Mistake &amp; Correct Word Breakdown (What You Typed vs. Official Master Word)
          </strong>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">
            Complete side-by-side table of every mistake made in each category alongside all verified correct words.
          </div>
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <span style="background: rgba(239,68,68,0.14); color: #b91c1c; border: 1px solid rgba(239,68,68,0.35); padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 800;">
            ❌ Total Section Mistakes: ${totalMistakeItems}
          </span>
          <span style="background: rgba(16,185,129,0.14); color: #047857; border: 1px solid rgba(16,185,129,0.35); padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 800;">
            ✅ Total Exact Correct Words: ${correctList.length}
          </span>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px;">
        ${sectionCardsHtml}
      </div>
      <div style="border: 1px solid #86efac; border-left: 4px solid #10b981; border-radius: 8px; padding: 10px 12px; background: ${isPdfMode ? '#ffffff' : 'var(--background)'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
          <strong style="font-size: 12.5px; color: #059669;">Section H: ✅ Verified Exact Matched Correct Words (${correctList.length} Words)</strong>
          <span style="font-size: 10.5px; font-weight: 700; color: #047857;">0.00 Deduction • 100% Matched with Master Passage</span>
        </div>
        <div style="max-height: ${isPdfMode ? 'none' : '120px'}; overflow-y: auto; line-height: 1.6;">
          ${correctPillsHtml}
        </div>
      </div>
    </div>
  `;
}

export function toggleCompleteUserTypedPassagePanel() {
  const panel = document.getElementById('complete-user-typed-passage-panel');
  const btn = document.getElementById('btn-toggle-complete-user-passage');
  if (!panel) return;
  const isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'block' : 'none';
  if (btn) {
    btn.innerHTML = isHidden
      ? '<i class="fa-solid fa-eye-slash"></i> Hide Complete User Typed Passage'
      : '<i class="fa-solid fa-eye"></i> Show Complete User Typed Passage';
  }
}

export function copyCompleteUserTypedPassageText() {
  const txt = window._lastCompleteUserTypedPassageText || '';
  if (!txt) {
    showToast('No user typed passage available to copy.');
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => {
      showToast('📋 Complete User Typed Passage copied to clipboard!');
    }).catch(() => {
      showToast('Could not copy text automatically.');
    });
  } else {
    showToast('📋 User Typed Passage ready.');
  }
}

export function toggleModalSpeedView() {
  const isChecked = document.getElementById('modal-toggle-time-used')?.checked || false;
  const historyItem = window._currentComparisonItem;

  if (!historyItem) return;

  let adminMinutes = 5;
  const timeDurStr = String(historyItem.TimeDuration || historyItem.timeDuration || '5').toLowerCase();
  const durMatch = timeDurStr.match(/([\d.]+)/);
  if (durMatch && durMatch[1]) adminMinutes = parseFloat(durMatch[1]);
  if (!adminMinutes || adminMinutes <= 0) adminMinutes = 5;

  let userMinutes = adminMinutes;
  const timeTakenStr = String(historyItem.TimeTaken || historyItem.timeTaken || historyItem.TimeUsed || historyItem.timeUsed || '').toLowerCase();
  const takenMatch = timeTakenStr.match(/([\d.]+)/);
  if (takenMatch && takenMatch[1]) userMinutes = parseFloat(takenMatch[1]);
  if (!userMinutes || userMinutes <= 0) userMinutes = 0.01;

  const totalTyped = parseFloat(historyItem.TotalTypedWords || historyItem.totalTypedWords || historyItem.TotalWord || historyItem.totalWord || 0);
  const accuracy = parseFloat(historyItem.AccuracyPercentage || historyItem.accuracyPercentage || 0);
  const matchingWords = (historyItem.CorrectWords !== undefined && historyItem.CorrectWords !== '-')
    ? parseFloat(historyItem.CorrectWords)
    : (historyItem.correctWords !== undefined ? parseFloat(historyItem.correctWords) : Math.round((accuracy / 100) * (totalTyped || 100)));

  const adminGross = Math.round(totalTyped / adminMinutes);
  const adminNet = Math.round(matchingWords / adminMinutes);

  const userGross = historyItem.userTimeGrossSpeed || Math.round(totalTyped / userMinutes);
  const userNet = historyItem.userTimeNetSpeed || Math.round(matchingWords / userMinutes);

  const submittedFull = historyItem.TimeUsed || historyItem.timeUsed || `${userMinutes} mins (Submitted at ${historyItem.submissionTime || '-'})`;

  const grossEl = document.getElementById('comp-metric-gross');
  const netEl = document.getElementById('comp-metric-net');
  const timeEl = document.getElementById('comp-metric-timetaken');

  if (grossEl) {
    grossEl.innerHTML = isChecked
      ? `<strong style="color: var(--primary);">Gross Speed (Time Used: ${userMinutes}m):</strong> <strong>${userGross} WPM</strong>`
      : `<strong>Gross Speed (Admin Time: ${adminMinutes}m):</strong> ${adminGross} WPM`;
  }
  if (netEl) {
    netEl.innerHTML = isChecked
      ? `<strong style="color: var(--success);">Net Speed (Time Used: ${userMinutes}m):</strong> <strong>${userNet} WPM</strong>`
      : `<strong>Net Speed (Admin Time: ${adminMinutes}m):</strong> ${adminNet} WPM`;
  }
  if (timeEl) {
    timeEl.innerHTML = isChecked
      ? `<strong style="color: var(--primary);">Actual Time Used & Submitted:</strong> ${submittedFull}`
      : `<strong>Time Used & Submitted:</strong> ${submittedFull}`;
  }
}

export function downloadOfficialEvaluatedAnswerSheetPdf() {
      const d = window._lastEvaluatedSheetExportData;
      if (!d) {
        showToast('⚠️ No evaluated answer sheet data found. Please open a test comparison first.');
        return;
      }
      const candidateName = portalState.currentUser ? (portalState.currentUser.name || 'Candidate') : 'Registered Candidate';
      const candidateId = portalState.currentUser ? (portalState.currentUser.userId || 'RP-STD') : 'RP-STD';
      const candidateBatch = portalState.currentUser ? (portalState.currentUser.batch || 'General Batch') : 'General Batch';
      const escapedUserPlain = String(d.userText || '(No text typed during this test)').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const htmlDoc = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Official Evaluated Answer Sheet - ${d.examNameVal}</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif; color: #0f172a; margin: 18px; line-height: 1.5; background: #ffffff; }
    .header { border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .title { font-size: 19px; font-weight: 900; color: #1e3a8a; margin: 0; letter-spacing: -0.3px; }
    .sub { font-size: 12px; color: #334155; margin-top: 4px; font-weight: 600; }
    .badge { padding: 6px 14px; border-radius: 999px; font-weight: 900; font-size: 12px; color: #fff; background: ${d.status === 'PASSED' ? '#059669' : '#dc2626'}; display: inline-block; }
    .legend-bar { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 14px; font-size: 11px; font-weight: 700; align-items: center; }
    .legend-pill { padding: 2px 8px; border-radius: 4px; }
    .sec-title { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4px; color: #1e3a8a; background: #eff6ff; border-left: 4px solid #2563eb; padding: 6px 10px; margin: 14px 0 10px 0; border-radius: 4px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .sum-cell { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 6px; font-size: 11.5px; }
    .sum-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 2px; }
    .sum-val { font-size: 13px; font-weight: 800; color: #0f172a; }
    .mistake-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .m-card { border-radius: 8px; padding: 8px 10px; font-size: 11px; border: 1px solid #cbd5e1; background: #fff; }
    .m-card-title { font-size: 10px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; display: block; }
    .m-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
    .passage-box { border: 1.5px solid #94a3b8; border-radius: 8px; padding: 12px; font-size: 12.5px; line-height: 1.85; background: #fff; word-break: break-word; }
    .passage-box h4 { margin: 0 0 8px 0; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 13px; }
    .plain-typed-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.7; background: #f8fafc; white-space: pre-wrap; word-break: break-word; margin-bottom: 14px; }
    @media print {
      .no-print { display: none !important; }
      body { margin: 8mm; }
      .passage-box, .m-card, .sum-cell { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 14px; padding: 10px 14px; background: #eff6ff; border: 1.5px solid #60a5fa; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
    <strong style="color: #1e3a8a; font-size: 13px;">📄 Official Commission Evaluated Answer Sheet — Complete Comparison Report</strong>
    <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 800; cursor: pointer; font-size: 12.5px;">🖨️ Print / Save Complete Evaluated Sheet as PDF</button>
  </div>

  <div class="header">
    <div>
      <h1 class="title">RP SKILL | RANJAN PATHSHALA — OFFICIAL EVALUATED ANSWER SHEET</h1>
      <div class="sub">
        Candidate: <strong>${candidateName} (${candidateId})</strong> • Batch: <strong>${candidateBatch}</strong><br>
        Exam Rule: <strong>${d.examNameVal}</strong> • Passage: <strong>${d.passageTitle || d.examNameVal}</strong> • Submitted: <strong>${d.submittedTimeStr || d.dateVal}</strong>
      </div>
    </div>
    <div style="text-align: right;">
      <span class="badge">${d.status} • ${d.accuracy}% Accuracy</span>
      <div style="font-size: 11px; color: #475569; margin-top: 4px; font-weight: 700;">Marks: ${d.marksObtainedVal} / ${d.totalMarksVal} (-${d.totalPointsDeducted} Deducted)</div>
    </div>
  </div>

  <!-- ERROR COLOR LEGEND BAR -->
  <div class="legend-bar">
    <strong style="color: #0f172a;">🎨 Error Color Legend:</strong>
    <span class="legend-pill" style="background: rgba(16,185,129,0.16); color: #065f46; border: 1px solid #10b981;">✔ Exact Match</span>
    <span class="legend-pill" style="background: rgba(239,68,68,0.16); color: #991b1b; border: 1px solid #ef4444;">✖ Spelling / Wrong Word</span>
    <span class="legend-pill" style="background: rgba(13,148,136,0.16); color: #115e59; border: 1px solid #0d9488;">🔄 Verb Form Error</span>
    <span class="legend-pill" style="background: rgba(219,39,119,0.16); color: #9d174d; border: 1px solid #db2777;">🔢 Singular / Plural</span>
    <span class="legend-pill" style="background: rgba(234,88,12,0.16); color: #9a3412; border: 1px solid #ea580c;">⏭ Word Left / Omitted</span>
    <span class="legend-pill" style="background: rgba(147,51,234,0.16); color: #6b21a8; border: 1px solid #9333ea;">➕ Extra Word Added</span>
    <span class="legend-pill" style="background: rgba(245,158,11,0.18); color: #92400e; border: 1px solid #f59e0b;">Aa Capitalization</span>
    <span class="legend-pill" style="background: rgba(37,99,235,0.15); color: #1e40af; border: 1px solid #3b82f6;">.,! Punctuation Error</span>
  </div>

  <!-- SECTION 1: ALL 16 SUMMARY METRICS -->
  <div class="sec-title">1. Official Exam &amp; Speed Summary (Complete 16-Point Commission Metrics)</div>
  <div class="summary-grid">
    <div class="sum-cell"><span class="sum-label">Exam Title (Rule)</span><span class="sum-val" style="color:#1d4ed8;">${d.examNameVal}</span></div>
    <div class="sum-cell"><span class="sum-label">Passage Title</span><span class="sum-val" style="color:#0284c7;">${d.passageTitle || '-'}</span></div>
    <div class="sum-cell"><span class="sum-label">Exam Date</span><span class="sum-val">${d.dateVal}</span></div>
    <div class="sum-cell"><span class="sum-label">Submitted At</span><span class="sum-val">${d.submittedTimeStr || d.dateVal}</span></div>
    <div class="sum-cell"><span class="sum-label">Allotted Duration (Admin)</span><span class="sum-val">${d.timeDuration}</span></div>
    <div class="sum-cell"><span class="sum-label">Actual Time Taken (User)</span><span class="sum-val" style="color:#2563eb;">${d.timeTaken}</span></div>
    <div class="sum-cell"><span class="sum-label">Word Count Formula</span><span class="sum-val">${d.wordCountFormula}</span></div>
    <div class="sum-cell"><span class="sum-label">Error Relaxed / Penalty</span><span class="sum-val">${d.errorRelaxed} / -${d.penaltyWord}</span></div>
    <div class="sum-cell"><span class="sum-label">Passing Cutoff</span><span class="sum-val" style="color:#d97706;">${d.passingCutoffPct}% (${d.passingCutoffMarks} Marks)</span></div>
    <div class="sum-cell"><span class="sum-label">Accuracy Achieved</span><span class="sum-val" style="color:#059669;">${d.accuracy}%</span></div>
    <div class="sum-cell"><span class="sum-label">Marks Obtained</span><span class="sum-val" style="color:#1d4ed8;">${d.marksObtainedVal} / ${d.totalMarksVal} (-${d.totalPointsDeducted})</span></div>
    <div class="sum-cell"><span class="sum-label">Final Result Status</span><span class="sum-val" style="color:${d.status === 'PASSED' ? '#059669' : '#dc2626'};">${d.status}</span></div>
    <div class="sum-cell"><span class="sum-label">Gross Speed (Admin Time)</span><span class="sum-val">${d.grossAdmin} WPM</span></div>
    <div class="sum-cell"><span class="sum-label">Net Speed (Admin Time)</span><span class="sum-val" style="color:#059669;">${d.netAdmin} WPM</span></div>
    <div class="sum-cell"><span class="sum-label">Gross Speed (User Time)</span><span class="sum-val" style="color:#0284c7;">${d.grossUserTime} WPM</span></div>
    <div class="sum-cell"><span class="sum-label">Net Speed (User Time)</span><span class="sum-val" style="color:#0d9488;">${d.netUserTime} WPM</span></div>
  </div>

  <!-- SECTION 2: ALL 13 DETAILED MISTAKE & VOLUME CARDS -->
  <div class="sec-title">2. Detailed Mistake Classification &amp; Mark Deduction Breakdown (All 13 Categories)</div>
  <div class="mistake-grid">
    <div class="m-card" style="background:#eff6ff; border-color:#93c5fd;">
      <span class="m-card-title" style="color:#1d4ed8;">📄 Master Passage Stats</span>
      <div class="m-row"><span>Total Words:</span><strong>${d.totalWordsMaterial}</strong></div>
      <div class="m-row"><span>Total Strokes:</span><strong>${d.totalStrokesMaterial}</strong></div>
      <div class="m-row"><span>Actual Tokens:</span><strong>${d.refTokensCount ?? d.totalWordsMaterial}</strong></div>
    </div>
    <div class="m-card" style="background:#f0fdf4; border-color:#86efac;">
      <span class="m-card-title" style="color:#15803d;">⌨️ User Stroke &amp; Volume</span>
      <div class="m-row"><span>Typed Words:</span><strong>${d.totalWordsUser}</strong></div>
      <div class="m-row"><span>Gross Strokes:</span><strong>${d.totalStrokesUser}</strong></div>
      <div class="m-row"><span>Net Correct Strokes:</span><strong>${d.correctStrokesUser ?? d.totalStrokesUser}</strong></div>
    </div>
    <div class="m-card">
      <span class="m-card-title" style="color:#059669;">✅ Exact Matched Words</span>
      <div class="m-row"><span>Correct Words:</span><strong>${d.matchingWords}</strong></div>
      <div class="m-row"><span>Completion Rate:</span><strong>${d.completionRatePct ?? '100'}%</strong></div>
      <div class="m-row"><span>Points Deducted:</span><strong style="color:#059669;">0.00</strong></div>
    </div>
    <div class="m-card">
      <span class="m-card-title" style="color:#475569;">⌫ Backspace Usage</span>
      <div class="m-row"><span>Backspaces Used:</span><strong>${d.totalBackspaces}</strong></div>
      <div class="m-row"><span>Rule Mode:</span><strong>${d.backspaceRuleLabel || 'Unlimited'}</strong></div>
    </div>
    <div class="m-card" style="border-left:4px solid #dc2626;">
      <span class="m-card-title" style="color:#dc2626;">❌ Spelling / Wrong Words</span>
      <div class="m-row"><span>Mistake Count:</span><strong>${d.wrongWordsCount}</strong></div>
      <div class="m-row"><span>Rate / Word:</span><strong>-${d.deductWrong ?? '1.0'}</strong></div>
      <div class="m-row"><span>Points Deducted:</span><strong style="color:#dc2626;">-${d.wrongDeduction}</strong></div>
    </div>
    <div class="m-card" style="border-left:4px solid #0d9488;">
      <span class="m-card-title" style="color:#0d9488;">🔄 Verb Form Errors</span>
      <div class="m-row"><span>Mistake Count:</span><strong>${d.verbFormCount}</strong></div>
      <div class="m-row"><span>Rate / Error:</span><strong>-${d.deductVerbForm ?? '0.5'}</strong></div>
      <div class="m-row"><span>Points Deducted:</span><strong style="color:#0d9488;">-${d.verbFormDeduction}</strong></div>
    </div>
    <div class="m-card" style="border-left:4px solid #db2777;">
      <span class="m-card-title" style="color:#db2777;">🔢 Singular / Plural Errors</span>
      <div class="m-row"><span>Mistake Count:</span><strong>${d.singularPluralCount}</strong></div>
      <div class="m-row"><span>Rate / Error:</span><strong>-${d.deductSingularPlural ?? '0.5'}</strong></div>
      <div class="m-row"><span>Points Deducted:</span><strong style="color:#db2777;">-${d.singularPluralDeduction}</strong></div>
    </div>
    <div class="m-card" style="border-left:4px solid #ea580c;">
      <span class="m-card-title" style="color:#ea580c;">⏭️ Words Left / Omitted</span>
      <div class="m-row"><span>Omitted Count:</span><strong>${d.wordsLeftCount}</strong></div>
      <div class="m-row"><span>Rate / Word:</span><strong>-${d.deductOmission ?? '1.0'}</strong></div>
      <div class="m-row"><span>Points Deducted:</span><strong style="color:#ea580c;">-${d.wordLeftDeduction}</strong></div>
    </div>
    <div class="m-card" style="border-left:4px solid #9333ea;">
      <span class="m-card-title" style="color:#9333ea;">➕ Extra Words Added</span>
      <div class="m-row"><span>Extra Count:</span><strong>${d.extraWordsCount}</strong></div>
      <div class="m-row"><span>Rate / Word:</span><strong>-${d.deductExtraWord ?? '0.5'}</strong></div>
      <div class="m-row"><span>Points Deducted:</span><strong style="color:#9333ea;">-${d.extraDeduction}</strong></div>
    </div>
    <div class="m-card" style="border-left:4px solid #0284c7;">
      <span class="m-card-title" style="color:#0284c7;">¶ Paragraph Changes</span>
      <div class="m-row"><span>Missed / Extra Para:</span><strong>${d.paraNotChangedCount}</strong></div>
      <div class="m-row"><span>Rate / Para:</span><strong>-${d.deductParaNotChanged ?? '0.5'}</strong></div>
      <div class="m-row"><span>Points Deducted:</span><strong style="color:#0284c7;">-${d.paraDeduction}</strong></div>
    </div>
    <div class="m-card" style="border-left:4px solid #d97706;">
      <span class="m-card-title" style="color:#d97706;">🔠 Capitalization Errors</span>
      <div class="m-row"><span>Case Mistakes:</span><strong>${d.capitalErrorCount}</strong></div>
      <div class="m-row"><span>Rate / Error:</span><strong>-${d.deductCapital ?? '0.5'}</strong></div>
      <div class="m-row"><span>Points Deducted:</span><strong style="color:#d97706;">-${d.capitalDeduction}</strong></div>
    </div>
    <div class="m-card" style="border-left:4px solid #2563eb;">
      <span class="m-card-title" style="color:#2563eb;">🔣 Punctuation (${d.punctModeLabel || 'Counted'})</span>
      <div class="m-row"><span>Extra / Left / Wrong:</span><strong>${d.punctExtra ?? 0} / ${d.punctLeft ?? 0} / ${d.punctWrong ?? 0}</strong></div>
      <div class="m-row"><span>Total (${d.totalPunctErrorCount}) @ -${d.deductPunctuation ?? '0.25'}:</span><strong style="color:#2563eb;">-${d.punctuationDeduction}</strong></div>
    </div>
    <div class="m-card" style="grid-column: span 4; background:#f0fdfa; border-color:#5eead4; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div><strong style="color:#0f766e;">🛡️ Highest Mistake Per Word Rule:</strong> Only 1 (Highest) Mistake Counted Per Word</div>
      <div><strong>Skipped Lower-Value Mistakes on Same Word:</strong> <span style="color:#0d9488; font-weight:900;">${d.skippedLowerMistakesCount ?? 0} Ignored (0 Extra Deduction)</span></div>
    </div>
  </div>

  <!-- SECTION 2B: SECTION-WISE MISTAKE & CORRECT WORD INSPECTOR (WRONG VS. CORRECT WORD PAIRS) -->
  <div class="sec-title">2B. Section-Wise Mistake &amp; Correct Word Breakdown (Wrong Word Typed vs. Correct Master Word)</div>
  <div style="margin-bottom: 14px;">${d.sectionWiseMistakePdfHtml || ''}</div>

  <!-- SECTION 3: COMPLETE USER TYPED PASSAGE (PLAIN TEXT) -->
  <div class="sec-title">3. Complete User Typed Passage (${d.totalWordsUser} Words • ${d.totalStrokesUser} Strokes)</div>
  <div class="plain-typed-box">${escapedUserPlain}</div>

  <!-- SECTION 4: SIDE-BY-SIDE MASTER PASSAGE VS CANDIDATE EVALUATED DIFF -->
  <div class="sec-title">4. Side-by-Side Master Reference Passage &amp; Candidate Evaluated Script (Full Inline Diff)</div>
  <div class="diff-grid">
    <div class="passage-box">
      <h4>📑 Master Reference Passage (${d.totalWordsMaterial} Words • ${d.totalStrokesMaterial} Strokes)</h4>
      <div>${d.annotatedRefHtmlStr}</div>
    </div>
    <div class="passage-box">
      <h4>⌨️ Candidate Evaluated Script — Inline Color-Coded Diff (${d.totalWordsUser} Words)</h4>
      <div>${d.annotatedUserHtmlStr}</div>
    </div>
  </div>
</body>
</html>`;

      // Download HTML file directly
      const safeFileName = `Official_Evaluated_Answer_Sheet_${String(d.examNameVal || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      // Also trigger native browser Save-as-PDF / Print dialog via hidden in-page iframe (works without window.open)
      try {
        let printFrame = document.getElementById('rp-official-pdf-print-frame');
        if (printFrame) printFrame.remove();
        printFrame = document.createElement('iframe');
        printFrame.id = 'rp-official-pdf-print-frame';
        printFrame.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; opacity:0; pointer-events:none;';
        document.body.appendChild(printFrame);
        const frameDoc = printFrame.contentWindow || printFrame.contentDocument;
        const doc = frameDoc.document || frameDoc;
        doc.open();
        doc.write(htmlDoc);
        doc.close();
        setTimeout(() => {
          try {
            if (printFrame.contentWindow) {
              printFrame.contentWindow.focus();
              printFrame.contentWindow.print();
            }
          } catch (err) {}
        }, 350);
      } catch (e) {}

      showToast('📄 Official Evaluated Answer Sheet (Complete Comparison Data) ready for Print / Save as PDF!');
    }

'use strict';

export const HOMOPHONE_GROUPS = [
        ['their', 'there', 'theyre'],
        ['principal', 'principle'],
        ['council', 'counsel'],
        ['stationary', 'stationery'],
        ['affect', 'effect'],
        ['complement', 'compliment'],
        ['weather', 'whether'],
        ['peace', 'piece'],
        ['accept', 'except'],
        ['advice', 'advise'],
        ['loose', 'lose'],
        ['passed', 'past'],
        ['personal', 'personnel'],
        ['cite', 'site', 'sight'],
        ['instant', 'instance'],
        ['statute', 'statue', 'stature'],
        ['eminent', 'imminent'],
        ['discreet', 'discrete'],
        ['allusion', 'illusion'],
        ['assent', 'ascent'],
        ['capital', 'capitol'],
        ['precede', 'proceed'],
        ['waive', 'wave'],
        ['hear', 'here'],
        ['right', 'write', 'rite'],
        ['knew', 'new'],
        ['know', 'no'],
        ['to', 'too', 'two']
    ];

export const HOMOPHONE_LOOKUP = {};

HOMOPHONE_GROUPS.forEach(group => {
        group.forEach(word => {
            HOMOPHONE_LOOKUP[word.toLowerCase()] = group.map(w => w.toLowerCase());
        });
    });

window.isHomophoneConfusionPair = function(w1, w2) {
        const a = String(w1 || '').toLowerCase().replace(/[^a-z]/g, '');
        const b = String(w2 || '').toLowerCase().replace(/[^a-z]/g, '');
        if (!a || !b || a === b) return false;
        const grp = HOMOPHONE_LOOKUP[a];
        return Array.isArray(grp) && grp.includes(b);
    };

window.__lastEvalDiagnostics = {
        transpositions: [],
        homophones: [],
        lineSkips: [],
        minuteSlices: []
    };

window.__resetAdvancedEvalCounters = function() {
        window.__lastEvalDiagnostics = {
            transpositions: [],
            homophones: [],
            lineSkips: [],
            minuteSlices: Array.isArray(window.__activeTestMinuteSlices) ? window.__activeTestMinuteSlices.slice() : []
        };
    };

window.__recordTranspositionHit = function(op) {
        if (!window.__lastEvalDiagnostics) window.__resetAdvancedEvalCounters();
        window.__lastEvalDiagnostics.transpositions.push({
            origPair: (op.origWord || '') + ' ' + (op.swappedWithOrig || ''),
            typedPair: (op.typedWord || '') + ' ' + (op.swappedWithTyped || '')
        });
    };

window.__recordHomophoneHit = function(op) {
        if (!window.__lastEvalDiagnostics) window.__resetAdvancedEvalCounters();
        window.__lastEvalDiagnostics.homophones.push({
            expected: op.origWord || '',
            typed: op.typedWord || ''
        });
    };

window.analyzeAdvancedPassageDiagnostics = function(ops) {
        const transpositions = [];
        const homophones = [];
        const lineSkips = [];
        let currentSkipRun = [];

        const flushSkipRun = () => {
            if (currentSkipRun.length >= 7) {
                lineSkips.push({
                    count: currentSkipRun.length,
                    preview: currentSkipRun.slice(0, 10).join(' ') + (currentSkipRun.length > 10 ? '...' : '')
                });
            }
            currentSkipRun = [];
        };

        for (let i = 0; i < (ops || []).length; i++) {
            const op = ops[i];
            if (!op) continue;
            if (op.type === 'omitted') {
                currentSkipRun.push(op.origWord || '');
            } else {
                flushSkipRun();
            }
            if (op.type === 'transposition') {
                transpositions.push({
                    origPair: (op.origWord || '') + ' ' + (op.swappedWithOrig || ''),
                    typedPair: (op.typedWord || '') + ' ' + (op.swappedWithTyped || '')
                });
            } else if (op.type === 'wrong' && window.isHomophoneConfusionPair(op.origWord, op.typedWord)) {
                homophones.push({
                    expected: op.origWord || '',
                    typed: op.typedWord || ''
                });
            }
        }
        flushSkipRun();
        return { transpositions, homophones, lineSkips };
    };

window.__proctoringState = {
        active: false,
        context: '',
        focusLosses: 0,
        fullscreenExits: 0,
        events: []
    };

window.startExamProctoringMonitor = function(contextName) {
        window.__proctoringState = {
            active: true,
            context: contextName || 'Skill Evaluation',
            focusLosses: 0,
            fullscreenExits: 0,
            events: []
        };
        updateLiveProctoringBadges();
    };

window.stopExamProctoringMonitor = function() {
        if (window.__proctoringState) {
            window.__proctoringState.active = false;
        }
        return window.getProctoringSummaryReport();
    };

window.getProctoringSummaryReport = function() {
        const st = window.__proctoringState || { focusLosses: 0, fullscreenExits: 0, events: [] };
        const totalViolations = (st.focusLosses || 0) + (st.fullscreenExits || 0);
        const penalty = (st.focusLosses || 0) * 8 + (st.fullscreenExits || 0) * 12;
        const integrityScore = Math.max(0, 100 - penalty);
        return {
            focusLossCount: st.focusLosses || 0,
            fullscreenExitCount: st.fullscreenExits || 0,
            totalViolations,
            integrityScore,
            events: (st.events || []).slice(-15)
        };
    };

export function isElementVisibleInDom(el) {
        if (!el) return false;
        if (el.classList.contains('hidden')) return false;
        if (el.style && el.style.display === 'none') return false;
        return window.getComputedStyle(el).display !== 'none';
    }

export function recordProctoringViolation(kind, detail) {
        const modalOpen = isElementVisibleInDom(document.getElementById('active-test-modal'));
        const audioView = document.getElementById('view-audio') || document.getElementById('view-audiodictation');
        const audioBox = document.getElementById('test-user-input') || document.getElementById('audio-transcription-box');
        const audioTranscribing = Boolean(audioBox && !audioBox.disabled && isElementVisibleInDom(audioView));
        const cbtContainer = document.getElementById('cbt-active-interface') || document.getElementById('cbt-active-exam-container');
        const cbtView = document.getElementById('view-cbttest');
        const cbtActive = isElementVisibleInDom(cbtContainer) && isElementVisibleInDom(cbtView);

        if (!window.__proctoringState.active && (modalOpen || audioTranscribing || cbtActive)) {
            window.__proctoringState.active = true;
        }
        if (!window.__proctoringState.active) return;

        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (kind === 'focus') {
            window.__proctoringState.focusLosses++;
        } else if (kind === 'fullscreen') {
            window.__proctoringState.fullscreenExits++;
        }
        window.__proctoringState.events.push({ kind, detail, time: nowStr });
        updateLiveProctoringBadges();
    }

export function updateLiveProctoringBadges() {
        const rep = window.getProctoringSummaryReport();
        const modalBadge = document.getElementById('proctoring-live-badge-modal');
        const audioBadge = document.getElementById('proctoring-live-badge-audio');
        const colorCls = rep.integrityScore >= 90
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : rep.integrityScore >= 70
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-rose-50 text-rose-700 border-rose-300';

        if (modalBadge) {
            modalBadge.className = 'text-[10px] font-extrabold px-2.5 py-1 rounded-lg border flex items-center gap-1 ' + colorCls;
            modalBadge.innerHTML = '<i class="fas fa-user-shield"></i> Integrity: <span>' + rep.integrityScore + '% (' + rep.totalViolations + ' Alerts)</span>';
        }
        if (audioBadge) {
            audioBadge.className = 'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ' + colorCls;
            audioBadge.innerHTML = '<i class="fas fa-shield-alt"></i> Integrity: ' + rep.integrityScore + '% (' + rep.totalViolations + ' Alerts)';
        }
    }

document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            recordProctoringViolation('focus', 'Tab switched or window minimized');
        }
    });

window.addEventListener('blur', () => {
        recordProctoringViolation('focus', 'Browser window lost focus');
    });

document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            recordProctoringViolation('fullscreen', 'Exited fullscreen exam mode');
        }
    });

window.__activeTestMinuteSlices = [];

export let __minuteSliceInterval = null;

export let __minuteSliceStartTime = 0;

window.startMinuteByMinuteTelemetryTracker = function(getInputTextFn, getMasterTextFn) {
        window.__activeTestMinuteSlices = [];
        __minuteSliceStartTime = Date.now();
        if (__minuteSliceInterval) clearInterval(__minuteSliceInterval);

        const captureSlice = (minuteLabel) => {
            try {
                const typed = String(getInputTextFn ? getInputTextFn() : '').trim();
                const master = String(getMasterTextFn ? getMasterTextFn() : '').trim();
                const typedWords = typed ? typed.split(/\s+/) : [];
                const masterWords = master ? master.split(/\s+/) : [];
                const elapsedMin = Math.max(0.25, (Date.now() - __minuteSliceStartTime) / 60000);
                const cumWpm = Math.round(typedWords.length / elapsedMin);
                let approxErr = 0;
                const checkLen = Math.min(typedWords.length, masterWords.length);
                for (let i = 0; i < checkLen; i++) {
                    const a = typedWords[i].toLowerCase().replace(/[^a-z0-9]/g, '');
                    const b = masterWords[i].toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (a && b && a !== b) approxErr++;
                }
                const prevWords = window.__activeTestMinuteSlices.length > 0
                    ? window.__activeTestMinuteSlices[window.__activeTestMinuteSlices.length - 1].cumWords
                    : 0;
                const sliceWpm = Math.max(0, typedWords.length - prevWords);
                window.__activeTestMinuteSlices.push({
                    minute: minuteLabel || (window.__activeTestMinuteSlices.length + 1),
                    wpm: sliceWpm || cumWpm,
                    cumWpm,
                    cumWords: typedWords.length,
                    errors: approxErr
                });
            } catch (e) {}
        };

        __minuteSliceInterval = setInterval(() => {
            captureSlice(window.__activeTestMinuteSlices.length + 1);
            if (typeof window.__tickBatchmateGhostRace === 'function') {
                window.__tickBatchmateGhostRace();
            }
        }, 15000);
    };

window.stopMinuteByMinuteTelemetryTracker = function() {
        if (__minuteSliceInterval) {
            clearInterval(__minuteSliceInterval);
            __minuteSliceInterval = null;
        }
        return window.__activeTestMinuteSlices || [];
    };

window.toggleElementFullScreenMode = function(elemId, btnEl) {
    const el = document.getElementById(elemId);
    if (!el) return;
    const isFull = el.classList.toggle('rp-eval-fullscreen-active');
    if (btnEl) {
      btnEl.innerHTML = isFull ? '🗗 Exit Full Screen' : '⛶ Open Evaluation Rule in Full Screen';
      btnEl.style.background = isFull ? '#dc2626' : 'linear-gradient(135deg, #4f46e5, #0ea5e9)';
      btnEl.style.color = '#fff';
    }
    if (isFull && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!isFull && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

export function renderTypingStep2RuleCards() {
    purgeFakeInjectedRules();
    const step2 = document.getElementById('typing-step-2');
    const examSelect = document.getElementById('typing-select-exam');
    if (!step2 || !examSelect) return;

    step2.style.display = 'block';
    examSelect.style.display = 'none';

    const typingKeys = window.getSectionEvaluationRuleKeys('typingtest');
    const typingRuleEntries = typingKeys.map(k => {
      const r = portalState.allEvaluationRules[k] || {};
      const disp = (r.examDisplayName || r.examTitle || k.replace(/^typingtest_/, '').replace(/_/g, ' ')).trim() || k;
      return { key: k, name: disp, rule: r };
    });

    examSelect.innerHTML = '<option value="" disabled>-- Select Typing Evaluation Rule --</option>' +
      typingRuleEntries.map(e => `<option value="${e.name}">${e.name}</option>`).join('');

    let mount = document.getElementById('typing-step2-cards-container');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'typing-step2-cards-container';
      examSelect.parentNode.appendChild(mount);
    }

    let selectedEntry = typingRuleEntries.find(e => e.name === examSelect.value) || typingRuleEntries[0] || null;
    if (selectedEntry && !examSelect.value) {
      examSelect.value = selectedEntry.name;
    }

    let showTypingCompleteRuleDetails = false;
    let typingRuleSearchQuery = '';

    const paintTypingCards = () => {
      const q = typingRuleSearchQuery.trim().toLowerCase();
      const pinnedList = typeof window.getPinnedEvaluationRules === 'function' ? window.getPinnedEvaluationRules() : [];
      const filteredEntries = typingRuleEntries.filter(e => {
        if (!q) return true;
        const r = e.rule || {};
        return `${e.name} ${e.key} ${r.timeLimit || 10}m ${r.passingAccuracy ?? 90}%`.toLowerCase().includes(q);
      }).sort((a, b) => {
        const pa = pinnedList.includes(a.key) ? 0 : 1;
        const pb = pinnedList.includes(b.key) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      });

      mount.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
          <span style="font-size:12px; font-weight:800; color:var(--primary);">Evaluation Rules for Skill Typing Test (${filteredEntries.length} of ${typingRuleEntries.length})</span>
          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            <input type="text" id="typing-rule-search-input" class="form-control" value="${escapeHtml(typingRuleSearchQuery)}" placeholder="Search typing rule..." style="width: 190px; min-height: 32px; padding: 4px 10px; font-size: 12px; margin: 0;">
            <button type="button" class="btn btn-sm btn-secondary" style="font-size:11px; font-weight:700;" onclick="const d=document.getElementById('typing-step2-selected-rule-all-details'); if(d){const open=d.style.display==='none'; d.style.display=open?'grid':'none'; this.innerHTML=open?'Hide Rule Details':'View Complete Rule';}">
              ${showTypingCompleteRuleDetails ? 'Hide Rule Details' : 'View Complete Rule'}
            </button>
          </div>
        </div>
        <div class="eval-rule-cards-grid" style="max-height: 280px; overflow-y: auto; padding: 2px;">
          ${typingRuleEntries.length === 0 ? `
            <div style="grid-column:1/-1; padding:14px; border-radius:10px; background:rgba(245,158,11,0.1); border:1px dashed #f59e0b; color:#b45309; font-weight:700; text-align:center;">
              No Typing Test Evaluation Rule uploaded yet. Configure one in Admin &rarr; Evaluation Rules (Target Tab: Skill Typing Test).
            </div>
          ` : (filteredEntries.length === 0 ? `
            <div style="grid-column:1/-1; padding:14px; border-radius:10px; background:var(--background); border:1px dashed var(--border); color:var(--text-muted); font-weight:600; text-align:center;">
              No typing rules match "${escapeHtml(typingRuleSearchQuery)}".
            </div>
          ` : filteredEntries.map(e => {
            const isSel = selectedEntry && e.key === selectedEntry.key;
            const isPinned = pinnedList.includes(e.key);
            const r = e.rule;
            return `
              <div class="eval-rule-select-card ${isSel ? 'selected' : ''}" data-typing-rule-key="${escapeHtml(e.key)}">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:4px;">
                  <span style="font-size:10.5px; font-weight:700; color:var(--primary);">${isPinned ? '★ Pinned · ' : ''}Typing Rule</span>
                  <button type="button" class="rp-pin-typing-rule-btn" data-pin-rule-key="${escapeHtml(e.key)}" title="${isPinned ? 'Unpin favourite rule' : 'Pin to top (max 3)'}" style="border:none; background:transparent; cursor:pointer; padding:0 3px; font-size:14px; color:${isPinned ? '#d97706' : 'var(--text-muted)'}; line-height:1;">
                    <i class="fa-${isPinned ? 'solid' : 'regular'} fa-star"></i>
                  </button>
                </div>
                <div style="font-weight:800; font-size:13px; color:var(--secondary); margin-bottom:6px;">${escapeHtml(e.name)}</div>
                <div class="mono-num" style="display:flex; flex-wrap:wrap; gap:6px; font-size:11px; color:var(--text-muted);">
                  <span>${r.timeLimit || 10}m</span>
                  <span>&middot;</span>
                  <span style="color:#059669; font-weight:700;">Pass ${r.passingAccuracy ?? 90}%</span>
                  <span>&middot;</span>
                  <span>Grace ${r.ignoredErrorPct ?? r.ignoreErrorPct ?? 0}%</span>
                </div>
              </div>
            `;
          }).join(''))}
        </div>
        <div id="typing-step2-selected-rule-all-details" style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:12px 14px; font-size:11.5px; display:${showTypingCompleteRuleDetails ? 'grid' : 'none'}; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:6px 12px; margin-top:8px;">
          ${selectedEntry ? buildCompleteRuleDetailsGridHtml(selectedEntry.key, selectedEntry.rule) : buildCompleteRuleDetailsGridHtml('', null)}
        </div>
      `;

      const typingSearchIn = document.getElementById('typing-rule-search-input');
      if (typingSearchIn) {
        typingSearchIn.oninput = (ev) => {
          typingRuleSearchQuery = ev.target.value;
          paintTypingCards();
          const refreshed = document.getElementById('typing-rule-search-input');
          if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(refreshed.value.length, refreshed.value.length);
          }
        };
      }

      mount.querySelectorAll('.rp-pin-typing-rule-btn').forEach(pinBtn => {
        pinBtn.onclick = (ev) => {
          ev.stopPropagation();
          const rk = pinBtn.getAttribute('data-pin-rule-key');
          if (rk && typeof window.togglePinEvaluationRule === 'function') {
            window.togglePinEvaluationRule(rk);
            paintTypingCards();
          }
        };
      });

      mount.querySelectorAll('.eval-rule-select-card').forEach(card => {
        card.onclick = () => {
          const rk = card.getAttribute('data-typing-rule-key');
          const found = typingRuleEntries.find(x => x.key === rk);
          if (found) {
            if (selectedEntry && selectedEntry.key === found.key) {
              showTypingCompleteRuleDetails = !showTypingCompleteRuleDetails;
            } else {
              selectedEntry = found;
              examSelect.value = found.name;
              showTypingCompleteRuleDetails = true;
            }
            if (typeof window.onTypingExamSelected === 'function') {
              window.onTypingExamSelected();
            }
            paintTypingCards();
          }
        };
      });
    };

    paintTypingCards();
  }



window.populateEphemeralPresetRulesDropdown = function() {
    purgeFakeInjectedRules();
    const modal = document.getElementById('learning-ephemeral-rule-modal');
    if (modal) {
      modal.style.cssText = 'position:fixed !important; inset:0 !important; width:100vw !important; height:100dvh !important; z-index:99998 !important; display:flex !important; background:var(--surface, #ffffff) !important; padding:0 !important; margin:0 !important;';
    }
    const loaderSel = document.getElementById('ephemeral-preset-rule-loader');
    if (!loaderSel) return;

    const typingKeys = window.getSectionEvaluationRuleKeys('typingtest');

    loaderSel.innerHTML = '<option value="">-- Custom One-Time Settings (Or Select Uploaded Typing Rule Card Below) --</option>' +
      typingKeys.map(k => {
        const r = portalState.allEvaluationRules[k] || {};
        const disp = r.examDisplayName || r.examTitle || k.replace(/^typingtest_/, '').replace(/_/g, ' ');
        return `<option value="${k}">📋 ${disp} (${r.wordCountRule === '5stroke' ? '5 Strokes=1W' : '1 Space=1W'} • ${r.timeLimit || 10}m)</option>`;
      }).join('');

    loaderSel.style.display = 'none';
    let cardWrap = document.getElementById('ephemeral-rule-cards-mount');
    if (!cardWrap) {
      cardWrap = document.createElement('div');
      cardWrap.id = 'ephemeral-rule-cards-mount';
      loaderSel.parentNode.appendChild(cardWrap);
    }

    let currentKey = loaderSel.value || typingKeys[0] || '';

    let showEphemeralCompleteRuleDetails = false;

    const paintEphemeralCards = () => {
      const activeRule = currentKey ? portalState.allEvaluationRules[currentKey] : null;
      cardWrap.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:6px;">
          <span style="font-size:11px; font-weight:800; color:var(--text-muted);">Select an Evaluation Rule card below (click card to toggle complete rule details):</span>
          <button type="button" class="btn btn-sm btn-secondary" style="font-size:11px; font-weight:800; border-color:#6366f1; color:#4f46e5;" onclick="const el=document.getElementById('ephemeral-selected-rule-all-details'); if(el){const open=el.style.display==='none'; el.style.display=open?'grid':'none'; this.innerHTML=open?'🔼 Hide Complete Evaluation Rule':'⚖️ View Complete Evaluation Rule';}">
            ${showEphemeralCompleteRuleDetails ? '🔼 Hide Complete Evaluation Rule' : '⚖️ View Complete Evaluation Rule'}
          </button>
        </div>
        <div class="eval-rule-cards-grid">
          ${typingKeys.map(k => {
            const r = portalState.allEvaluationRules[k] || {};
            const disp = r.examDisplayName || r.examTitle || k.replace(/^typingtest_/, '').replace(/_/g, ' ');
            const isSel = k === currentKey;
            return `
              <div class="eval-rule-select-card ${isSel ? 'selected' : ''}" data-eph-key="${k}">
                <div style="font-size:10px; font-weight:800; color:#4f46e5; text-transform:uppercase; margin-bottom:4px;">⌨️ UPLOADED TYPING TEST RULE</div>
                <div style="font-weight:800; font-size:13px; color:var(--secondary); margin-bottom:6px;">${disp}</div>
                <div style="display:flex; flex-wrap:wrap; gap:5px; font-size:11px; color:var(--text-muted);">
                  <span style="background:var(--surface); padding:2px 6px; border-radius:6px; border:1px solid var(--border);">⏱️ ${r.timeLimit || 10}m</span>
                  <span style="background:rgba(16,185,129,0.12); color:#059669; padding:2px 6px; border-radius:6px; font-weight:700;">🎯 ${r.passingAccuracy ?? 90}%</span>
                </div>
                <div style="margin-top:6px; font-size:10px; font-weight:800; color:#4f46e5;">
                  ${isSel && showEphemeralCompleteRuleDetails ? '🔼 Complete Rule Shown Below' : '👉 Click to View Complete Rule'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        ${activeRule ? `
          <div id="ephemeral-selected-rule-all-details" style="background:var(--surface); border:1.5px solid rgba(79,70,229,0.3); border-radius:12px; padding:12px 14px; font-size:11.5px; display:${showEphemeralCompleteRuleDetails ? 'grid' : 'none'}; grid-template-columns:repeat(auto-fit, minmax(195px, 1fr)); gap:6px 12px; margin-top:8px;">
            ${buildCompleteRuleDetailsGridHtml(currentKey, activeRule)}
          </div>
        ` : ''}
      `;

      cardWrap.querySelectorAll('.eval-rule-select-card').forEach(card => {
        card.onclick = () => {
          const k = card.getAttribute('data-eph-key');
          if (k) {
            if (currentKey === k) {
              showEphemeralCompleteRuleDetails = !showEphemeralCompleteRuleDetails;
            } else {
              currentKey = k;
              loaderSel.value = k;
              showEphemeralCompleteRuleDetails = true;
            }
            if (typeof window.loadEphemeralPresetRule === 'function') {
              window.loadEphemeralPresetRule(k);
            } else if (typeof applySavedRuleToEphemeralModal === 'function') {
              applySavedRuleToEphemeralModal(k);
            }
            paintEphemeralCards();
          }
        };
      });
    };

    if (currentKey) {
      loaderSel.value = currentKey;
      if (typeof window.loadEphemeralPresetRule === 'function') {
        window.loadEphemeralPresetRule(currentKey);
      } else if (typeof applySavedRuleToEphemeralModal === 'function') {
        applySavedRuleToEphemeralModal(currentKey);
      }
    }
    paintEphemeralCards();
  };


