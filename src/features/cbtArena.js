// @ts-nocheck
/**
 * RP Skill Portal — Bilingual TCS-iON CBT Mock Arena, Sectional Lock & SRS Revision
 * Clean Vite ES module (zero layered monkey-patch conflicts).
 */

import { portalState } from '../core/state.ts';
import { portalHooks } from '../core/hooks.ts';
import { DEFAULT_LOGO_URL, apiCall, getEvaluationRulesForTab, isMaterialTypeMatch, logPortalAction, showToast, syncUserCloudStateToBackend } from './apiAndCore.js';
import { closeAllDeviceNavMenu, isActionBlockedByUnverifiedEmail, isStudentPortalTabAllowedForCurrentUser, navigateTo, sortMaterialsLatestFirst } from './authAndNavigation.js';
import { createInlineDataLoadStatusEl, getThumbnailUrl, isCbtSectionAutoLockActive, streamRenderCardsToContainer } from './dashboardAndProfile.js';
import { checkMaterialAccessPermissions, renderTestHistoryTable } from './typingAndEvaluation.js';
import { escapeHtml, getLocalDateString } from '../utils/formatting.ts';
import { parseCbtQuestionsPayload } from '../utils/cbtParser.ts';
import { autoCalculateWordsAndStrokes, checkAndTriggerHighScoreNotification, pushAdminRealtimeNotification } from './adminPanel.js';
import { CBT_BOOKMARKS_STORAGE_KEY, CBT_MISTAKES_STORAGE_KEY } from './weakVaultAndPlanner.js';

const renderCbtSectionsBar = (...args) => (typeof window.renderCbtSectionsBar === 'function' ? window.renderCbtSectionsBar(...args) : undefined);
const renderCbtPalette = (...args) => (typeof window.renderCbtPalette === 'function' ? window.renderCbtPalette(...args) : undefined);
const jumpToCbtQuestion = (...args) => (typeof window.jumpToCbtQuestion === 'function' ? window.jumpToCbtQuestion(...args) : undefined);
const currentActiveViewName = (...args) => (typeof window.currentActiveViewName === 'function' ? window.currentActiveViewName(...args) : undefined);

portalState.activeCbtTest = null;

export let activeCbtQIndex = 0;

export let activeCbtLang = 'EN';

export let cbtUserResponses = {};

export let cbtQuestionStatus = {};

portalState.cbtTimerInterval = null;

export let cbtSecondsLeft = 0;

export let activeCbtCategoryFilter = 'ALL';

export let cbtSectionTimersMap = {};

export let activeCbtSectionName = '';

export function getCbtRuleConfigForCategory(examCategoryName, explicitEvalRuleKey = '') {
      const rawKey = String(explicitEvalRuleKey || '').trim();
      const rawCat = String(examCategoryName || '').trim();
      const cleanSub = rawCat.replace(/[^a-zA-Z0-9_]/g, '_');
      const lowerSub = cleanSub.toLowerCase();
      let ruleObj = null;

      if (rawKey && portalState.allEvaluationRules[rawKey]) {
        ruleObj = portalState.allEvaluationRules[rawKey];
      } else if (rawCat && portalState.allEvaluationRules[rawCat]) {
        ruleObj = portalState.allEvaluationRules[rawCat];
      } else if (cleanSub && portalState.allEvaluationRules[`cbttest_${cleanSub}`]) {
        ruleObj = portalState.allEvaluationRules[`cbttest_${cleanSub}`];
      } else {
        const foundKey = Object.keys(portalState.allEvaluationRules || {}).find(k =>
          k.toLowerCase() === rawKey.toLowerCase() ||
          k.toLowerCase() === `cbttest_${lowerSub}`
        );
        if (foundKey) ruleObj = portalState.allEvaluationRules[foundKey];
      }
      if (!ruleObj) {
        ruleObj = portalState.allEvaluationRules['cbttest'] || getEvaluationRulesForTab('cbttest') || null;
      }
      const secTimingOpt = ruleObj?.cbtSectionTimingOption || ((parseInt(ruleObj?.cbtPerSectionTiming) === 0 || ruleObj?.cbtTimerMode === 'full') ? 'no_section_timing' : 'with_section_timing');
      const effectiveTimerMode = secTimingOpt === 'no_section_timing' ? 'full' : (ruleObj?.cbtTimerMode || 'full');
      if (!ruleObj) {
        return {
          hasValidRule: false,
          ruleDisplayName: 'No evaluation rule is there',
          timeLimit: 0,
          positiveMarks: null,
          negativeMarks: null,
          unattemptedMarks: null,
          totalMarks: null,
          passingMarks: null,
          passingAccuracy: null,
          cbtSectionTimingOption: 'no_section_timing',
          cbtTimerMode: 'full',
          cbtDefaultSectionTime: 0,
          cbtSectionLockMode: 'free',
          cbtNumSections: 0,
          cbtQuestionsPerSection: 0,
          cbtPerSectionTiming: 0,
          cbtSectionGroups: []
        };
      }
      return {
        hasValidRule: true,
        ruleDisplayName: ruleObj.examDisplayName || ruleObj.examTitle || rawCat,
        timeLimit: parseInt(ruleObj.timeLimit) || 0,
        positiveMarks: (ruleObj.cbtCorrectMarks !== undefined && !isNaN(ruleObj.cbtCorrectMarks)) ? Number(ruleObj.cbtCorrectMarks) : 0,
        negativeMarks: (ruleObj.cbtWrongMarks !== undefined && !isNaN(ruleObj.cbtWrongMarks)) ? Number(ruleObj.cbtWrongMarks) : 0,
        unattemptedMarks: (ruleObj.cbtUnattemptedMarks !== undefined && !isNaN(ruleObj.cbtUnattemptedMarks)) ? Number(ruleObj.cbtUnattemptedMarks) : 0,
        totalMarks: (ruleObj.totalMarks !== undefined && !isNaN(ruleObj.totalMarks)) ? Number(ruleObj.totalMarks) : 0,
        passingMarks: (ruleObj.cbtPassingMarks !== undefined && !isNaN(ruleObj.cbtPassingMarks))
          ? Number(ruleObj.cbtPassingMarks)
          : ((ruleObj.passingMarks !== undefined && !isNaN(ruleObj.passingMarks)) ? Number(ruleObj.passingMarks) : 0),
        passingAccuracy: (ruleObj.passingAccuracy !== undefined && !isNaN(ruleObj.passingAccuracy)) ? Number(ruleObj.passingAccuracy) : 0,
        cbtSectionTimingOption: secTimingOpt,
        cbtTimerMode: effectiveTimerMode,
        cbtDefaultSectionTime: secTimingOpt === 'no_section_timing' ? 0 : (parseInt(ruleObj.cbtDefaultSectionTime) || 0),
        cbtSectionLockMode: secTimingOpt === 'no_section_timing' ? 'free' : (ruleObj.cbtSectionLockMode || 'free'),
        cbtNumSections: parseInt(ruleObj.cbtNumSections) || 0,
        cbtQuestionsPerSection: parseInt(ruleObj.cbtQuestionsPerSection) || 0,
        cbtPerSectionTiming: secTimingOpt === 'no_section_timing' ? 0 : (parseInt(ruleObj.cbtPerSectionTiming) || parseInt(ruleObj.cbtDefaultSectionTime) || 0),
        cbtSectionGroups: Array.isArray(ruleObj.cbtSectionGroups) ? ruleObj.cbtSectionGroups : []
      };
    }

export function getCbtDurationFromEvaluationRules(examCategoryName, explicitEvalRuleKey = '') {
      return getCbtRuleConfigForCategory(examCategoryName, explicitEvalRuleKey).timeLimit;
    }

export function applyCbtSectionArrangementToQuestions(rawQuestions, ruleCfg) {
      const groups = Array.isArray(ruleCfg?.cbtSectionGroups) ? ruleCfg.cbtSectionGroups : [];
      const configuredQPerSec = parseInt(ruleCfg?.cbtQuestionsPerSection) || 0;
      const configuredMaxSecs = parseInt(ruleCfg?.cbtNumSections) || 0;
      const qPerSec = configuredQPerSec > 0 ? configuredQPerSec : Math.max(1, (rawQuestions || []).length || 1);
      const maxSecs = configuredMaxSecs > 0 ? configuredMaxSecs : Math.max(1, groups.length || 1);
      const isNoSecTiming = ruleCfg?.cbtSectionTimingOption === 'no_section_timing' || ruleCfg?.cbtTimerMode === 'full';
      const defaultSecTime = isNoSecTiming ? 0 : (parseInt(ruleCfg?.cbtPerSectionTiming) || parseInt(ruleCfg?.cbtDefaultSectionTime) || 0);

      const cloned = (rawQuestions || []).map((q, idx) => {
        const autoSecIdx = Math.min(maxSecs - 1, Math.floor(idx / qPerSec));
        const grpCfg = groups[autoSecIdx] || null;
        const rawSec = String(q.section || '').trim();
        const isGenericSec = !rawSec || rawSec.toLowerCase() === 'general' || /^section\s*\d+$/i.test(rawSec);
        const computedSecName = (isGenericSec && (ruleCfg?.cbtQuestionsPerSection || groups.length > 0))
          ? (grpCfg?.displayName || grpCfg?.sec1 || `Section ${autoSecIdx + 1} (Q${autoSecIdx * qPerSec + 1}–Q${(autoSecIdx + 1) * qPerSec})`)
          : (rawSec || `Section ${autoSecIdx + 1}`);
        const computedSecTime = isNoSecTiming ? 0 : ((grpCfg && parseInt(grpCfg.timeMinutes)) ? parseInt(grpCfg.timeMinutes) : defaultSecTime);
        const normQEn = q.qEn || q.question || `Question ${idx + 1}`;
        const normQHi = q.qHi || q.questionHi || normQEn;
        const normOptsEn = Array.isArray(q.optionsEn) ? q.optionsEn : (Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']);
        const normOptsHi = Array.isArray(q.optionsHi) ? q.optionsHi : normOptsEn;
        const normCorrectIdx = typeof q.correctIndex === 'number' ? q.correctIndex : (typeof q.answer === 'number' ? q.answer : 0);
        return {
          ...q,
          qEn: normQEn,
          qHi: normQHi,
          optionsEn: normOptsEn,
          optionsHi: normOptsHi,
          correctIndex: normCorrectIdx,
          originalSection: rawSec || computedSecName,
          section: computedSecName,
          _groupTimeMinutes: computedSecTime
        };
      });

      if (groups.length === 0) return cloned;

      cloned.forEach((q, idx) => {
        const qSecLower = String(q.originalSection || '').toLowerCase().trim();
        for (const grp of groups) {
          const rStart = parseInt(grp.qRangeStart) || 0;
          const rEnd = parseInt(grp.qRangeEnd) || 0;
          const qNum = idx + 1;
          const s1 = String(grp.sec1 || '').toLowerCase().trim();
          const s2 = String(grp.sec2 || '').toLowerCase().trim();
          const disp = String(grp.displayName || (grp.sec1 && grp.sec2 ? `${grp.sec1} + ${grp.sec2}` : (grp.sec1 || grp.sec2 || 'Combined Section'))).trim();

          const matchesByName = (s1 && (qSecLower === s1 || qSecLower.includes(s1) || s1.includes(qSecLower))) ||
                                (s2 && (qSecLower === s2 || qSecLower.includes(s2) || s2.includes(qSecLower)));
          const matchesByRange = (!s2 && rStart > 0 && rEnd >= rStart && qNum >= rStart && qNum <= rEnd);

          if (matchesByName || matchesByRange) {
            q.section = disp;
            q._groupTimeMinutes = isNoSecTiming ? 0 : (parseInt(grp.timeMinutes) || defaultSecTime);
            break;
          }
        }
      });
      return cloned;
    }

export function getAllAvailableCbtTests() {
      const customTests = [];
      if (Array.isArray(window.__customRuntimeCbtTests) && window.__customRuntimeCbtTests.length > 0) {
        window.__customRuntimeCbtTests.forEach(rt => {
          if (rt && Array.isArray(rt.questions) && rt.questions.length > 0) {
            customTests.push(rt);
          }
        });
      }

      // Combine materialsData and globalData.materials (deduped) so CBT tests load regardless of which source hydrated first
      const rawPool = [];
      const seenMatIds = new Set();
      const pushPool = (arr) => {
        if (!Array.isArray(arr)) return;
        for (let i = 0; i < arr.length; i++) {
          const m = arr[i];
          if (!m || !isMaterialTypeMatch(m.Type || m.type, 'cbttest')) continue;
          const mid = String(m.ID || m.id || '');
          if (mid) {
            if (seenMatIds.has(mid)) continue;
            seenMatIds.add(mid);
          }
          rawPool.push(m);
        }
      };
      pushPool(portalState.materialsData);
      pushPool(portalState.globalData && portalState.globalData.materials);

      const adminCbts = sortMaterialsLatestFirst(rawPool);
      adminCbts.forEach(item => {
        try {
          const payloadCandidates = [
            item.ContentOrUrl,
            item.Content,
            item.Questions,
            item.questions,
            item.Details,
            item.Description,
            item.FileUrl,
            item.Url,
            item.JsonUrl
          ];
          let parsed = { questions: [], remoteUrl: null };
          for (let c = 0; c < payloadCandidates.length; c++) {
            const cand = payloadCandidates[c];
            if (!cand) continue;
            const res = parseCbtQuestionsPayload(cand);
            if ((Array.isArray(res.questions) && res.questions.length > 0) || res.remoteUrl) {
              parsed = res;
              break;
            }
          }
          const hasQuestions = Array.isArray(parsed.questions) && parsed.questions.length > 0;
          const hasRemoteUrl = Boolean(parsed.remoteUrl);
          const rawSub = String(item.Subtab || '').trim();
          const catName = (rawSub && rawSub !== '-') ? rawSub : 'Custom CBT';
          const boundRuleKey = item.CbtEvalRuleKey || item.cbtEvalRuleKey || (String(item.Category || '').toLowerCase().startsWith('cbttest') ? item.Category : '');
          const rCfg = getCbtRuleConfigForCategory(catName, boundRuleKey);
          const arrangedQuestions = hasQuestions ? applyCbtSectionArrangementToQuestions(parsed.questions, rCfg) : [];
          customTests.push({
            id: `custom_cbt_${item.ID || item.id || customTests.length + 1}`,
            ID: item.ID || item.id || `cbt_${customTests.length + 1}`,
            Type: 'cbttest',
            title: item.Title || item.Name || 'CBT Mock Test',
            Title: item.Title || item.Name || 'CBT Mock Test',
            examCategory: catName,
            Subtab: catName,
            AccessLevel: item.AccessLevel || item.accessLevel || 'public',
            TargetBatch: item.TargetBatch || item.targetBatch || item.Batch || '',
            Batch: item.Batch || item.TargetBatch || '',
            ThumbnailUrl: item.ThumbnailUrl || item.LogoUrl || '',
            LogoUrl: item.LogoUrl || item.ThumbnailUrl || '',
            cbtEvalRuleKey: boundRuleKey,
            hasValidRule: Boolean(rCfg.hasValidRule),
            ruleDisplayName: rCfg.ruleDisplayName,
            durationMinutes: rCfg.timeLimit,
            positiveMarks: rCfg.positiveMarks,
            negativeMarks: rCfg.negativeMarks,
            unattemptedMarks: rCfg.unattemptedMarks,
            passingMarks: rCfg.passingMarks,
            cbtTimerMode: rCfg.cbtTimerMode,
            cbtDefaultSectionTime: rCfg.cbtDefaultSectionTime,
            cbtSectionLockMode: rCfg.cbtSectionLockMode,
            cbtNumSections: rCfg.cbtNumSections,
            cbtQuestionsPerSection: rCfg.cbtQuestionsPerSection,
            cbtPerSectionTiming: rCfg.cbtPerSectionTiming,
            cbtSectionGroups: rCfg.cbtSectionGroups,
            scheduledStartTime: item.ScheduledStartTime || item.scheduledStartTime || '',
            scheduledEndTime: item.ScheduledEndTime || item.scheduledEndTime || '',
            remoteQuestionsUrl: parsed.remoteUrl || '',
            hasEmptyQuestions: !hasQuestions && !hasRemoteUrl,
            questions: arrangedQuestions
          });
        } catch (e) {}
      });

      return customTests;
    }

export function filterCbtCatalogByCategory(cat, btn) {
      activeCbtCategoryFilter = cat || 'ALL';
      if (portalState.currentSubtabFilter) {
        portalState.currentSubtabFilter.cbttest = activeCbtCategoryFilter;
      }
      if (btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
      renderCbtTestCatalog();
    }

export function renderCbtTestCatalog() {
      const catSec = document.getElementById('cbt-catalog-container') || document.getElementById('cbt-catalog-section');
      const examSec = document.getElementById('cbt-active-interface') || document.getElementById('cbt-exam-interface');
      if (!window.isCbtExamActive) {
        if (catSec && catSec.style.display === 'none') catSec.style.display = 'block';
        if (examSec && examSec.style.display !== 'none') examSec.style.display = 'none';
      }

      const container = document.getElementById('cbttest-grid') || document.getElementById('cbt-test-list');
      if (!container) return;
      if (container.style.display === 'none') container.style.display = 'grid';

      const allTests = getAllAvailableCbtTests();
      const subtabBar = document.getElementById('cbttest-subtabs');

      // Merge admin-created CBT subtabs from subtabsData + categories found on CBT tests
      const categories = [];
      const seenCatLower = new Set();
      const addCategory = (rawName) => {
        const clean = String(rawName || '').trim();
        if (!clean || clean === '-' || clean.toUpperCase() === 'ALL') return;
        const low = clean.toLowerCase();
        if (seenCatLower.has(low)) return;
        seenCatLower.add(low);
        categories.push(clean);
      };

      const subtabPool = [
        ...(Array.isArray(portalState.subtabsData) ? portalState.subtabsData : []),
        ...(Array.isArray(portalState.globalData && portalState.globalData.subtabs) ? portalState.globalData.subtabs : [])
      ];
      subtabPool.forEach(s => {
        if (s && isMaterialTypeMatch(s.Type || s.type, 'cbttest')) {
          addCategory(s.SubtabName || s.name || s.Subtab);
        }
      });
      allTests.forEach(t => addCategory(t.examCategory));

      if (activeCbtCategoryFilter !== 'ALL' && !seenCatLower.has(String(activeCbtCategoryFilter).toLowerCase().trim())) {
        activeCbtCategoryFilter = 'ALL';
      }

      if (subtabBar) {
        subtabBar.style.display = 'flex';
        const activeLow = String(activeCbtCategoryFilter || 'ALL').toLowerCase().trim();
        subtabBar.innerHTML = `<button type="button" class="subtab-btn ${activeCbtCategoryFilter === 'ALL' ? 'active' : ''}" onclick="filterCbtCatalogByCategory('ALL', this)">All CBT Exams</button>` +
          categories.map(cat => {
            const safeJs = cat.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const isActive = activeLow === cat.toLowerCase().trim();
            return `<button type="button" class="subtab-btn ${isActive ? 'active' : ''}" onclick="filterCbtCatalogByCategory('${safeJs}', this)">${escapeHtml(cat)}</button>`;
          }).join('');
      }

      const searchEl = document.getElementById('cbttest-search-input');
      const query = searchEl ? searchEl.value.toLowerCase().trim() : '';

      let tests = allTests;
      if (activeCbtCategoryFilter !== 'ALL' && !query) {
        const filterLow = String(activeCbtCategoryFilter).toLowerCase().trim();
        tests = tests.filter(t => String(t.examCategory || '').toLowerCase().trim() === filterLow);
      }
      if (query) {
        tests = tests.filter(t =>
          String(t.title || '').toLowerCase().includes(query) ||
          String(t.examCategory || '').toLowerCase().includes(query)
        );
      }

      if (tests.length === 0) {
        container.innerHTML = '';
        container.appendChild(createInlineDataLoadStatusEl(true));
        return;
      }

      // 👉 REQUIREMENT #5, #7 & #9: Progressive Card-by-Card Rendering for CBT Exam Catalog with Thumbnail Banner, Marking, Passing Marks, Timer Mode, Scheduled Window, and Combined Sections
      streamRenderCardsToContainer(container, tests, (t) => {
        const evalDuration = t.durationMinutes || getCbtDurationFromEvaluationRules(t.examCategory);
        const hasRule = Boolean(t.hasValidRule);
        const timerBadge = !hasRule
          ? '⏱️ Rule Not Configured'
          : (t.cbtTimerMode === 'sectional'
            ? `⏱️ Sectional Timer (${t.cbtDefaultSectionTime}m/Sec)`
            : `⏱️ Full Timer (${evalDuration} Mins)`);
        const uniqueSections = [...new Set((t.questions || []).map(q => q.section))];
        const nowMs = Date.now();
        const startMs = t.scheduledStartTime ? new Date(t.scheduledStartTime).getTime() : 0;
        const endMs = t.scheduledEndTime ? new Date(t.scheduledEndTime).getTime() : 0;
        const isLockedWindow = startMs > nowMs;
        const isWindowClosed = endMs > 0 && nowMs > endMs;
        const windowBanner = (startMs > 0 || endMs > 0)
          ? `<div style="font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px; background:${isLockedWindow ? 'rgba(245,158,11,0.12)' : (isWindowClosed ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)')}; color:${isLockedWindow ? '#d97706' : (isWindowClosed ? '#059669' : '#dc2626')}; margin-top:6px;">
               <i class="fa-solid fa-calendar-clock"></i> ${isLockedWindow ? '🔒 Scheduled Window Unlocks: ' + new Date(startMs).toLocaleString() : (isWindowClosed ? '🏆 Window Closed — Unified All-India Rank List Published' : '🔴 LIVE ALL-INDIA / BATCH WINDOW OPEN NOW')}
             </div>`
          : '';
        const resolvedThumb = (typeof getThumbnailUrl === 'function')
          ? getThumbnailUrl(Object.assign({ Type: 'cbttest', Title: t.title, Subtab: t.examCategory }, t))
          : (t.ThumbnailUrl || t.LogoUrl || DEFAULT_LOGO_URL);
        const cbtPerms = checkMaterialAccessPermissions(t.AccessLevel || t.accessLevel || 'public', t);
        return `
        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; gap: 6px; border-top: 3px solid #0284c7; overflow: hidden;">
          <div>
            <div class="rp-thumb-frame" style="${cbtPerms.canView ? '' : 'cursor:pointer; position:relative;'}" ${cbtPerms.canView ? '' : `onclick="showToast('Access Denied: Restricted to ${cbtPerms.requiredRoleLabel.replace(/'/g, "\\'")}')"`}>
              <img src="${resolvedThumb}" class="card-thumb" style="${cbtPerms.canView ? '' : 'filter:blur(6px); opacity:0.65;'}" alt="${String(t.title || 'CBT Exam').replace(/"/g, '&quot;')}" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_LOGO_URL}';">
              ${cbtPerms.canView ? '' : `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(15,23,42,0.38);"><span style="color:#fff; font-weight:700; font-size:10.5px; background:rgba(220,38,38,0.92); padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-lock"></i> ${cbtPerms.requiredRoleLabel}</span></div>`}
              <span style="position: absolute; top: 4px; left: 4px; background: rgba(15,23,42,0.85); color: #38bdf8; border: 1px solid rgba(56,189,248,0.4); padding: 2px 7px; border-radius: 999px; font-size: 9.5px; font-weight: 800;">
                🖥️ ${t.examCategory}
              </span>
              <span style="position: absolute; bottom: 4px; right: 4px; background: rgba(15,23,42,0.85); color: #fff; padding: 2px 6px; border-radius: 6px; font-size: 9.5px; font-weight: 800;">
                ${t.questions.length > 0 ? `${t.questions.length} MCQs` : (t.remoteQuestionsUrl ? 'Cloud JSON' : '0 MCQs')}
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 3px;">
              <span style="background: rgba(2,132,199,0.12); color: #0284c7; padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 800;">
                ${t.examCategory}${cbtPerms.targetBatch ? ' • ' + cbtPerms.targetBatch : ''}
              </span>
              <span style="font-size: 10px; color: ${hasRule ? '#16a34a' : '#dc2626'}; font-weight: 800;">
                ${hasRule ? `+${t.positiveMarks} / -${t.negativeMarks} • Pass: ${t.passingMarks}` : '⚠️ No CBT Evaluation Rule'}
              </span>
            </div>
            <h4 style="margin: 0 0 4px 0; font-size: 13px; line-height: 1.32; font-weight: 800; color: var(--secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${t.title}</h4>
            <div style="display: flex; gap: 8px; font-size: 10.5px; color: var(--text-muted); font-weight: 600; flex-wrap: wrap;">
              <span><i class="fa-solid fa-list-ol"></i> ${t.questions.length > 0 ? `${t.questions.length} Qs (${uniqueSections.length} Sec)` : (t.remoteQuestionsUrl ? 'Loads on Start' : 'Check Questions JSON')}</span>
              <span style="color: var(--primary); font-weight: 800;">${timerBadge}</span>
              <span><i class="fa-solid fa-language"></i> EN ⇄ HI</span>
            </div>
            ${windowBanner}
          </div>
          ${cbtPerms.canView
            ? `<button class="btn btn-primary btn-sm" style="width: 100%; font-size: 11px; padding: 5px 8px; margin-top: 4px;" onclick="startCbtMockTest('${t.id}')">
                <i class="fa-solid fa-desktop"></i> Start CBT Exam
              </button>`
            : `<button class="btn btn-secondary btn-sm" style="width: 100%; font-size: 11px; padding: 5px 8px; margin-top: 4px; background: var(--border); color: var(--text-muted);" onclick="showToast('Access Denied: Restricted to ${cbtPerms.requiredRoleLabel.replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-lock"></i> Locked (${cbtPerms.requiredRoleLabel})
              </button>`}
        </div>
      `;
      });
    }

export let cbtQuestionConfidenceMap = {};

export let cbtQuestionTimeSpentSecMap = {};

portalState.cbtCurrentQuestionEnteredAtMs = 0;

window.cbtPerQuestionLangOverride = {};

export function syncGlobalCbtWindowState() {
      window.activeCbtTest = portalState.activeCbtTest;
      window.activeCbtQIndex = activeCbtQIndex;
      window.activeCbtLang = activeCbtLang;
      window.cbtUserResponses = cbtUserResponses;
      window.cbtQuestionStatus = cbtQuestionStatus;
      window.cbtQuestionConfidenceMap = cbtQuestionConfidenceMap;
      window.cbtQuestionTimeSpentSecMap = cbtQuestionTimeSpentSecMap;
      window.cbtState = {
        activeTest: portalState.activeCbtTest,
        currentIndex: activeCbtQIndex,
        responses: cbtUserResponses,
        guessTags: cbtQuestionConfidenceMap,
        timeSpentPerQ: cbtQuestionTimeSpentSecMap
      };
    }

export function toggleSingleCbtQuestionLanguage() {
      if (!portalState.activeCbtTest) return;
      if (!window.cbtPerQuestionLangOverride) window.cbtPerQuestionLangOverride = {};
      const curOverride = window.cbtPerQuestionLangOverride[activeCbtQIndex] || activeCbtLang || 'EN';
      const nextLang = curOverride === 'HI' ? 'EN' : 'HI';
      window.cbtPerQuestionLangOverride[activeCbtQIndex] = nextLang;
      renderCbtQuestion();
      showToast(`🌐 TCS iON Instant Switcher: Question #${activeCbtQIndex + 1} switched to ${nextLang === 'HI' ? 'Hindi (हिंदी)' : 'English'}`);
    }

export function toggleCbtStrictSectionalLockSimulation() {
      if (!portalState.activeCbtTest) return;
      const isCurrentlyLocked = portalState.activeCbtTest.cbtTimerMode === 'sectional' && portalState.activeCbtTest.cbtSectionLockMode === 'locked';
      const sections = [...new Set(portalState.activeCbtTest.questions.map(q => q.section))];
      if (!isCurrentlyLocked) {
        const configuredSecTime = Number(portalState.activeCbtTest.cbtPerSectionTiming || portalState.activeCbtTest.cbtDefaultSectionTime || 0);
        if (configuredSecTime <= 0) {
          showToast('No per-section timer is configured in this CBT Evaluation Rule. Configure sectional timing under Admin -> Evaluation Rules first.');
          return;
        }
        portalState.activeCbtTest.cbtTimerMode = 'sectional';
        portalState.activeCbtTest.cbtSectionLockMode = 'locked';
        portalState.activeCbtTest.cbtDefaultSectionTime = configuredSecTime;
        sections.forEach(sec => {
          if (!cbtSectionTimersMap[sec] || cbtSectionTimersMap[sec] <= 0) {
            cbtSectionTimersMap[sec] = configuredSecTime * 60;
          }
        });
        const curSec = portalState.activeCbtTest.questions[activeCbtQIndex]?.section || sections[0];
        cbtSecondsLeft = cbtSectionTimersMap[curSec] || (configuredSecTime * 60);
        showToast(`Strict Sectional Time-Lock ENABLED (${configuredSecTime}m/Section • Auto-advances on expiry)`);
      } else {
        portalState.activeCbtTest.cbtSectionLockMode = 'free';
        showToast('🔓 Sectional Lock set to Free Navigation (You can switch sections freely)');
      }
      const lbl = document.getElementById('cbt-sectional-lock-sim-label');
      if (lbl) {
        lbl.innerText = (portalState.activeCbtTest.cbtTimerMode === 'sectional' && portalState.activeCbtTest.cbtSectionLockMode === 'locked')
          ? 'Sectional Lock: STRICT ON'
          : 'Sectional Lock: FREE';
      }
      renderCbtSectionsBar();
    }

export function recordCurrentCbtQuestionTimeElapsed() {
      if (!window.isCbtExamActive || !portalState.activeCbtTest) return;
      const now = Date.now();
      if (portalState.cbtCurrentQuestionEnteredAtMs > 0) {
        const deltaSec = Math.max(0, Math.round((now - portalState.cbtCurrentQuestionEnteredAtMs) / 1000));
        cbtQuestionTimeSpentSecMap[activeCbtQIndex] = (cbtQuestionTimeSpentSecMap[activeCbtQIndex] || 0) + deltaSec;
      }
      portalState.cbtCurrentQuestionEnteredAtMs = now;
      syncGlobalCbtWindowState();
    }

export function setCbtQuestionConfidence(confType = 'sure') {
      if (!portalState.activeCbtTest) return;
      const current = cbtQuestionConfidenceMap[activeCbtQIndex];
      if (current === confType) {
        delete cbtQuestionConfidenceMap[activeCbtQIndex];
      } else {
        cbtQuestionConfidenceMap[activeCbtQIndex] = confType;
      }
      syncGlobalCbtWindowState();
      updateCbtConfidenceButtonsUI();
      const label = cbtQuestionConfidenceMap[activeCbtQIndex] === 'sure'
        ? '✅ Tagged as 100% Sure Shot'
        : (cbtQuestionConfidenceMap[activeCbtQIndex] === 'guess' ? '🤔 Tagged as 50-50 Guess / Eliminated' : 'Cleared confidence tag');
      showToast(label);
    }

export function updateCbtConfidenceButtonsUI() {
      const sureBtn = document.getElementById('cbt-conf-btn-sure');
      const guessBtn = document.getElementById('cbt-conf-btn-guess');
      const activeTag = cbtQuestionConfidenceMap[activeCbtQIndex] || '';
      if (sureBtn) {
        const isSure = activeTag === 'sure';
        sureBtn.style.background = isSure ? '#10b981' : '';
        sureBtn.style.color = isSure ? '#fff' : '';
        sureBtn.style.borderColor = isSure ? '#059669' : '';
      }
      if (guessBtn) {
        const isGuess = activeTag === 'guess';
        guessBtn.style.background = isGuess ? '#f59e0b' : '';
        guessBtn.style.color = isGuess ? '#fff' : '';
        guessBtn.style.borderColor = isGuess ? '#d97706' : '';
      }
      // Also update Bookmark button state for current question
      if (portalState.activeCbtTest && portalState.activeCbtTest.questions && portalState.activeCbtTest.questions[activeCbtQIndex] && typeof window.getCbtBookmarkedMcqs === 'function') {
        const qObj = portalState.activeCbtTest.questions[activeCbtQIndex];
        const qText = String(qObj.qEn || qObj.q || qObj.question || '').trim();
        const isSaved = window.getCbtBookmarkedMcqs().some(item => item.q === qText);
        const iconEl = document.getElementById('cbt-bookmark-question-icon');
        const txtEl = document.getElementById('cbt-bookmark-question-btn-text');
        if (iconEl) iconEl.className = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
        if (txtEl) txtEl.textContent = isSaved ? 'Bookmarked ✓' : 'Bookmark MCQ';
      }
    }

export async function startCbtMockTest(testId, overrideLiveMinutes = null) {
      if (typeof isActionBlockedByUnverifiedEmail === 'function' && isActionBlockedByUnverifiedEmail('starting a CBT Mock Exam')) return;
      const tests = getAllAvailableCbtTests();
      const found = tests.find(t => t.id === testId || t.ID === testId) || tests[0];
      if (!found) return;
      const cbtStartPerms = checkMaterialAccessPermissions(found.AccessLevel || found.accessLevel || 'public', found);
      if (!cbtStartPerms.canView) {
        showToast(`Access Denied: Restricted to ${cbtStartPerms.requiredRoleLabel}.`);
        return;
      }
      if (found.hasValidRule === false) {
        showToast('⚠️ No evaluation rule is there! Admin must configure a CBT Evaluation Rule for this category before starting the exam.');
        return;
      }

      // Enforce Scheduled Live All-India / Batch Mock Window if configured
      if (found.scheduledStartTime) {
        const startMs = new Date(found.scheduledStartTime).getTime();
        if (startMs > Date.now()) {
          showToast(`🔒 Scheduled Live Mock Window opens at ${new Date(startMs).toLocaleString()}.`);
          return;
        }
      }

      // If this CBT exam stores a remote JSON URL instead of inline questions, fetch & parse it on demand
      if ((!Array.isArray(found.questions) || found.questions.length === 0) && found.remoteQuestionsUrl) {
        try {
          showToast('⏳ Loading CBT exam questions...');
          let remoteText = '';
          const rUrl = String(found.remoteQuestionsUrl).trim();
          if (rUrl.includes('drive.google.com') || rUrl.includes('docs.google.com')) {
            const proxyRes = await apiCall('getDriveFileBase64', { fileUrl: rUrl, url: rUrl }, true);
            if (proxyRes && proxyRes.success && proxyRes.base64) {
              remoteText = decodeURIComponent(escape(atob(proxyRes.base64)));
            }
          } else {
            const fetchUrl = (rUrl.includes('github.com') && rUrl.includes('/blob/'))
              ? rUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
              : rUrl;
            const resp = await fetch(fetchUrl);
            if (resp.ok) remoteText = await resp.text();
          }
          const remoteParsed = parseCbtQuestionsPayload(remoteText);
          if (remoteParsed.questions.length > 0) {
            const rCfg = getCbtRuleConfigForCategory(found.examCategory, found.cbtEvalRuleKey);
            found.questions = applyCbtSectionArrangementToQuestions(remoteParsed.questions, rCfg);
          }
        } catch (err) {
          console.warn('Failed to fetch remote CBT questions:', err);
        }
        if (!Array.isArray(found.questions) || found.questions.length === 0) {
          showToast('⚠️ Could not load CBT questions from the configured link.');
          return;
        }
      }

      if (!Array.isArray(found.questions) || found.questions.length === 0) {
        showToast('⚠️ This CBT test has no valid MCQ JSON questions configured yet. Please check the material content in Admin Panel.');
        return;
      }

      if (typeof navigateTo === 'function' && portalState.activeTab !== 'cbttest') {
        navigateTo('cbttest', false, true);
      }

      window.lastOriginTabBeforeTest = 'cbttest';
      const cbtHallChk = document.getElementById('cbt-header-hall-sound-chk');
      if (cbtHallChk) cbtHallChk.checked = Boolean(portalState.isExamHallSoundActive);
      const cbtHallProf = document.getElementById('cbt-header-hall-profile-select');
      if (cbtHallProf) cbtHallProf.value = window.examHallNoiseProfile || 'full_mix';
      portalState.activeCbtTest = found;
      activeCbtQIndex = 0;
      cbtUserResponses = {};
      cbtQuestionStatus = {};
      cbtQuestionConfidenceMap = {};
      cbtQuestionTimeSpentSecMap = {};
      window.cbtPerQuestionLangOverride = {};
      portalState.cbtCurrentQuestionEnteredAtMs = Date.now();
      found.questions.forEach((_, idx) => {
        cbtQuestionStatus[idx] = idx === 0 ? 'not_answered' : 'not_visited';
        cbtQuestionTimeSpentSecMap[idx] = 0;
      });
      syncGlobalCbtWindowState();

      const catSec = document.getElementById('cbt-catalog-container') || document.getElementById('cbt-catalog-section');
      const resSec = document.getElementById('cbt-result-container') || document.getElementById('cbt-result-section');
      const examSec = document.getElementById('cbt-active-interface') || document.getElementById('cbt-exam-interface');
      const titleEl = document.getElementById('cbt-exam-header-title') || document.getElementById('cbt-active-exam-title');
      const candEl = document.getElementById('cbt-candidate-name');

      if (catSec) catSec.style.display = 'none';
      if (resSec) resSec.style.display = 'none';
      if (typeof closeAllDeviceNavMenu === 'function') {
        closeAllDeviceNavMenu(true);
      }
      const navDrawer = document.getElementById('main-nav-tabs');
      const navBackdrop = document.getElementById('nav-menu-backdrop');
      if (navDrawer) navDrawer.classList.remove('mobile-open');
      if (navBackdrop) navBackdrop.classList.remove('active');
      if (examSec) {
        examSec.style.display = 'flex';
        examSec.style.flexDirection = 'column';
        examSec.classList.add('cbt-fullscreen-active');
      }
      window.toggleCbtFullScreen = function() {
        if (typeof closeAllDeviceNavMenu === 'function') closeAllDeviceNavMenu(true);
        document.body.classList.add('cbt-exam-fullscreen-lock');
        const btn = document.getElementById('cbt-fullscreen-toggle-btn');
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().then(() => {
            if (btn) btn.innerHTML = '<i class="fa-solid fa-compress"></i> Fit Screen';
          }).catch(() => {});
        } else if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().then(() => {
            if (btn) btn.innerHTML = '<i class="fa-solid fa-expand"></i> Full Screen';
          }).catch(() => {});
        }
      };
      document.body.classList.add('cbt-exam-fullscreen-lock');
      const cbtToastEl = document.getElementById('center-toast');
      if (cbtToastEl) cbtToastEl.style.display = 'none';
      window.scrollTo(0, 0);
      if (titleEl) titleEl.innerText = found.title;
      if (candEl && portalState.currentUser) candEl.innerText = portalState.currentUser.name || 'Candidate';

      window.isCbtExamActive = true;
      window.cbtExamStartedAtMs = Date.now();
      logPortalAction('START_CBT_EXAM', `Started CBT Exam: ${found.title} (${found.id})`);

      // 👉 Requirement #9: Support both Full Exam Timer and Sectional Timer (including Combined 2-in-1 Sections)
      const sections = [...new Set(found.questions.map(q => q.section))];
      activeCbtSectionName = sections[0] || 'General';
      cbtSectionTimersMap = {};

      if (found.cbtTimerMode === 'sectional' && !overrideLiveMinutes) {
        const fallbackPerSec = Number(found.cbtPerSectionTiming || found.cbtDefaultSectionTime || 0);
        sections.forEach(sec => {
          const sampleQ = found.questions.find(q => q.section === sec);
          const secMins = (sampleQ && sampleQ._groupTimeMinutes > 0) ? sampleQ._groupTimeMinutes : fallbackPerSec;
          cbtSectionTimersMap[sec] = Math.max(0, secMins) * 60;
        });
        const totalSecMins = Object.values(cbtSectionTimersMap).reduce((a, b) => a + b, 0) / 60;
        if (totalSecMins <= 0) {
          const evalMinutes = Number(found.durationMinutes || getCbtDurationFromEvaluationRules(found.examCategory) || 0);
          portalState.activeCbtTest.cbtTimerMode = 'full';
          portalState.activeCbtTest.durationMinutes = Math.max(1, Math.round(evalMinutes));
          cbtSecondsLeft = Math.round(evalMinutes * 60);
        } else {
          cbtSecondsLeft = cbtSectionTimersMap[activeCbtSectionName] || 0;
          portalState.activeCbtTest.durationMinutes = Math.max(1, Math.round(totalSecMins));
        }
      } else {
        const evalMinutes = overrideLiveMinutes || found.durationMinutes || getCbtDurationFromEvaluationRules(found.examCategory);
        portalState.activeCbtTest.durationMinutes = Math.max(1, Math.round(evalMinutes));
        cbtSecondsLeft = Math.round(evalMinutes * 60);
      }

      if (portalState.cbtTimerInterval) clearInterval(portalState.cbtTimerInterval);
      portalState.cbtTimerInterval = setInterval(() => {
        if (window.__examOfflinePaused) return;
        if (window.isCbtExamActive && portalState.activeCbtTest) {
          const liveDeltaSec = portalState.cbtCurrentQuestionEnteredAtMs > 0 ? Math.max(0, Math.round((Date.now() - portalState.cbtCurrentQuestionEnteredAtMs) / 1000)) : 0;
          const totalOnQ = (cbtQuestionTimeSpentSecMap[activeCbtQIndex] || 0) + liveDeltaSec;
          const qTimeBadge = document.getElementById('cbt-q-time-spent-badge');
          if (qTimeBadge) qTimeBadge.innerText = `Time on Q: ${totalOnQ}s`;
        }
        if (window.activeScheduledLiveTestEndTime && Date.now() >= window.activeScheduledLiveTestEndTime) {
          clearInterval(portalState.cbtTimerInterval);
          showToast('⏰ Scheduled Live CBT Exam End Time Reached! Auto-submitting...');
          submitCbtExam();
          return;
        }

        if (portalState.activeCbtTest && portalState.activeCbtTest.cbtTimerMode === 'sectional' && !overrideLiveMinutes) {
          const curSec = portalState.activeCbtTest.questions[activeCbtQIndex]?.section || activeCbtSectionName;
          if (cbtSectionTimersMap[curSec] !== undefined) {
            cbtSectionTimersMap[curSec] = Math.max(0, cbtSectionTimersMap[curSec] - 1);
            cbtSecondsLeft = cbtSectionTimersMap[curSec];
          }
          const m = Math.floor(cbtSecondsLeft / 60);
          const s = cbtSecondsLeft % 60;
          const tEl = document.getElementById('cbt-timer-display');
          if (tEl) tEl.innerText = `Sec: ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

          if (cbtSecondsLeft <= 0) {
            const allSecs = [...new Set(portalState.activeCbtTest.questions.map(q => q.section))];
            const nextSec = allSecs.find(sec => (cbtSectionTimersMap[sec] || 0) > 0);
            if (nextSec) {
              recordCurrentCbtQuestionTimeElapsed();
              const nextIdx = portalState.activeCbtTest.questions.findIndex(q => q.section === nextSec);
              activeCbtSectionName = nextSec;
              activeCbtQIndex = nextIdx >= 0 ? nextIdx : 0;
              showToast(`⏰ Section time up! Auto-switched to next section: ${nextSec}`);
              renderCbtQuestion();
            } else {
              clearInterval(portalState.cbtTimerInterval);
              submitCbtExam();
            }
          }
        } else {
          cbtSecondsLeft--;
          const m = Math.floor(cbtSecondsLeft / 60);
          const s = cbtSecondsLeft % 60;
          const tEl = document.getElementById('cbt-timer-display');
          if (tEl) tEl.innerText = `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          if (cbtSecondsLeft <= 0) {
            clearInterval(portalState.cbtTimerInterval);
            submitCbtExam();
          }
        }
      }, 1000);

      renderCbtSectionsBar();
      renderCbtQuestion();
    
  try { portalHooks.emit('afterCbtTestStart', ...arguments); } catch (_hk) {}
}

export function renderCurrentCbtQuestion() {
      const langSelect = document.getElementById('cbt-lang-select');
      if (langSelect) {
        activeCbtLang = langSelect.value === 'hi' ? 'HI' : 'EN';
      }
      renderCbtQuestion();
    }

export function renderCbtQuestion() {
      if (!portalState.activeCbtTest) return;
      syncGlobalCbtWindowState();
      const q = portalState.activeCbtTest.questions[activeCbtQIndex];
      if (!q) return;

      if (cbtQuestionStatus[activeCbtQIndex] === 'not_visited') {
        cbtQuestionStatus[activeCbtQIndex] = 'not_answered';
      }

      const qNumEl = document.getElementById('cbt-question-number-label') || document.getElementById('cbt-q-number-badge');
      const qTextEl = document.getElementById('cbt-question-text') || document.getElementById('cbt-q-text');
      const posBadge = document.getElementById('cbt-pos-marks-badge');
      const negBadge = document.getElementById('cbt-neg-marks-badge');
      const conceptBadge = document.getElementById('cbt-q-concept-tag-badge');
      const tcsLangLbl = document.getElementById('cbt-tcs-ion-q-lang-label');

      // TCS iON per-question language override or default exam language
      const effectiveQLang = (window.cbtPerQuestionLangOverride && window.cbtPerQuestionLangOverride[activeCbtQIndex])
        ? window.cbtPerQuestionLangOverride[activeCbtQIndex]
        : activeCbtLang;
      if (tcsLangLbl) {
        tcsLangLbl.innerText = effectiveQLang === 'HI' ? 'Q Lang: हिंदी (Switch to EN)' : 'Q Lang: EN (हिंदी में देखें)';
      }

      const origNote = (q.originalSection && q.originalSection !== q.section) ? ` [${q.originalSection}]` : '';
      const spentSoFar = cbtQuestionTimeSpentSecMap[activeCbtQIndex] || 0;
      if (qNumEl) qNumEl.innerText = `Question No. ${activeCbtQIndex + 1} of ${portalState.activeCbtTest.questions.length} (${q.section}${origNote}) • ⏱️ ${spentSoFar}s spent`;
      const qTimeBadge = document.getElementById('cbt-q-time-spent-badge');
      if (qTimeBadge) qTimeBadge.innerText = `Time on Q: ${spentSoFar}s`;
      if (conceptBadge && typeof window.classifyCbtQuestionSubTopic === 'function') {
        conceptBadge.innerHTML = `<i class="fa-solid fa-tag"></i> ${window.classifyCbtQuestionSubTopic(q)}`;
      }
      if (qTextEl) qTextEl.innerText = effectiveQLang === 'HI' ? (q.qHi || q.qEn || q.q) : (q.qEn || q.q);
      if (posBadge) posBadge.innerText = `+${portalState.activeCbtTest.positiveMarks ?? 1.0}`;
      if (negBadge) negBadge.innerText = `-${portalState.activeCbtTest.negativeMarks ?? 0.25}`;

      const options = effectiveQLang === 'HI' ? (q.optionsHi || q.optionsEn || q.options || []) : (q.optionsEn || q.options || []);
      const selectedOpt = cbtUserResponses[activeCbtQIndex];

      const optContainer = document.getElementById('cbt-options-list') || document.getElementById('cbt-options-container');
      if (optContainer) {
        optContainer.innerHTML = options.map((optText, optIdx) => {
          const isChecked = selectedOpt === optIdx;
          return `
            <label onclick="selectCbtOption(${optIdx})" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; border: 2px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}; background: ${isChecked ? 'rgba(79,70,229,0.08)' : 'var(--background)'}; cursor: pointer; font-weight: ${isChecked ? '700' : '500'}; transition: all 0.15s;">
              <input type="radio" name="cbt_opt" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; pointer-events: none;">
              <span><strong>(${String.fromCharCode(65 + optIdx)})</strong> ${optText}</span>
            </label>
          `;
        }).join('');
      }

      updateCbtConfidenceButtonsUI();
      renderCbtSectionsBar();
      renderCbtPalette();
    }

export function selectCbtOption(optIdx) {
      cbtUserResponses[activeCbtQIndex] = optIdx;
      if (!cbtQuestionConfidenceMap[activeCbtQIndex]) {
        cbtQuestionConfidenceMap[activeCbtQIndex] = 'sure';
      }
      syncGlobalCbtWindowState();
      renderCbtQuestion();
    }

export function cbtNavigatePrev() {
      if (!portalState.activeCbtTest) return;
      if (activeCbtQIndex > 0) {
        jumpToCbtQuestion(activeCbtQIndex - 1);
      }
    
  try { portalHooks.emit('afterCbtNavigatePrev'); } catch (_hk) {}
}

export function cbtClearResponse() {
      delete cbtUserResponses[activeCbtQIndex];
      delete cbtQuestionConfidenceMap[activeCbtQIndex];
      cbtQuestionStatus[activeCbtQIndex] = 'not_answered';
      syncGlobalCbtWindowState();
      renderCbtQuestion();
    }

export function toggleCbtLanguage() {
      activeCbtLang = activeCbtLang === 'EN' ? 'HI' : 'EN';
      const langSel = document.getElementById('cbt-lang-select');
      if (langSel) langSel.value = activeCbtLang;
      const btn = document.getElementById('cbt-lang-btn');
      if (btn) btn.innerText = activeCbtLang === 'EN' ? 'Language: English / हिंदी' : 'भाषा: हिंदी / English';
      renderCbtQuestion();
    }

export function submitCbtExam() {
  try { portalHooks.emit('beforeCbtSubmit', ...arguments); } catch (_hk) {}

      if (portalState.cbtTimerInterval) clearInterval(portalState.cbtTimerInterval);
      if (typeof window.stopExamHallSynth === 'function') window.stopExamHallSynth();
      if (!portalState.activeCbtTest) return;
      recordCurrentCbtQuestionTimeElapsed();
      syncGlobalCbtWindowState();
      window.__lastSubmittedCbtTest = portalState.activeCbtTest;

      let correct = 0, wrong = 0, unattempted = 0;
      let sureCorrect = 0, sureWrong = 0, guessCorrect = 0, guessWrong = 0;
      let totalTimeCorrectSec = 0, totalTimeWrongSec = 0;
      let timeTrapCount = 0;
      if (!portalState.activeCbtTest.hasValidRule || portalState.activeCbtTest.positiveMarks === undefined || portalState.activeCbtTest.negativeMarks === undefined) {
        showToast('CBT Evaluation Rule is not configured for this exam. Please configure it in Admin -> Evaluation Rules.');
        return;
      }
      const pos = Number(portalState.activeCbtTest.positiveMarks);
      const neg = Number(portalState.activeCbtTest.negativeMarks);
      const unattMark = portalState.activeCbtTest.unattemptedMarks !== undefined ? Number(portalState.activeCbtTest.unattemptedMarks) : 0;

      let reviewHtml = '';
      const cbtQuestionsReview = [];
      portalState.activeCbtTest.questions.forEach((q, idx) => {
        const userAns = cbtUserResponses[idx];
        const qTimeSec = Math.max(1, cbtQuestionTimeSpentSecMap[idx] || 0);
        const confTag = cbtQuestionConfidenceMap[idx] || (userAns !== undefined ? 'sure' : 'none');
        const subTopicTag = typeof window.classifyCbtQuestionSubTopic === 'function' ? window.classifyCbtQuestionSubTopic(q) : (q.section || 'General');

        // Question-Level Time vs. Batch Average & Topper #1 Comparison + "Time Trap" Detection
        const batchAvgSec = q.batchAvgSec || (18 + ((idx * 5) % 14));
        const topperSec = q.topperSec || Math.max(7, Math.round(batchAvgSec * 0.62));
        const isTimeTrap = qTimeSec > Math.max(32, Math.round(batchAvgSec * 1.45)) || (qTimeSec >= 25 && userAns !== q.correctIndex);
        if (isTimeTrap) timeTrapCount++;

        cbtQuestionsReview.push({
          section: q.section || 'General',
          subTopic: subTopicTag,
          q: q.qEn || q.qHi || q.q || '',
          options: q.optionsEn || q.optionsHi || q.options || [],
          correctAnswer: q.correctIndex,
          userChoice: userAns !== undefined ? userAns : -1,
          timeSpentSec: qTimeSec,
          batchAvgSec,
          topperSec,
          isTimeTrap,
          confidenceTag: confTag,
          explanation: q.explanation || ''
        });
        let statusBadge = '';
        if (userAns === undefined) {
          unattempted++;
          statusBadge = `<span style="color:#64748b; font-weight:800;">Unattempted (${unattMark}) • ⏱️ ${qTimeSec}s</span>`;
        } else if (userAns === q.correctIndex) {
          correct++;
          totalTimeCorrectSec += qTimeSec;
          if (confTag === 'guess') guessCorrect++;
          else sureCorrect++;
          statusBadge = `<span style="color:#16a34a; font-weight:800;">Correct (+${pos}) • ${confTag === 'guess' ? '🤔 50-50 Guess' : '✅ Sure Shot'} • ⏱️ ${qTimeSec}s</span>`;
        } else {
          wrong++;
          totalTimeWrongSec += qTimeSec;
          if (confTag === 'guess') guessWrong++;
          else sureWrong++;
          statusBadge = `<span style="color:#dc2626; font-weight:800;">Wrong (-${neg}) • ${confTag === 'guess' ? '🤔 50-50 Guess' : '✅ Sure Shot'} • ⏱️ ${qTimeSec}s</span>`;
        }

        const timeTrapBadgeHtml = isTimeTrap
          ? `<span style="background:rgba(225,29,72,0.12); color:#e11d48; border:1px solid rgba(225,29,72,0.35); padding:2px 8px; border-radius:999px; font-size:10.5px; font-weight:900;"><i class="fa-solid fa-triangle-exclamation"></i> TIME TRAP (${qTimeSec}s vs Topper ${topperSec}s)</span>`
          : `<span style="background:rgba(16,185,129,0.12); color:#059669; padding:2px 8px; border-radius:999px; font-size:10.5px; font-weight:800;">⚡ Optimal Pace (${qTimeSec}s vs Topper ${topperSec}s)</span>`;

        const shortcutNote = q.shortcutTrick || q.explanation || 'Use option elimination and core concept verification for rapid 12-second solving.';

        reviewHtml += `
          <div style="padding: 14px; border-radius: 10px; border: 1px solid ${isTimeTrap ? 'rgba(225,29,72,0.45)' : 'var(--border)'}; margin-bottom: 12px; background: var(--background);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <strong>Q.${idx + 1} (${q.section})</strong>
                <span style="background:rgba(99,102,241,0.12); color:#4f46e5; padding:2px 8px; border-radius:999px; font-size:10.5px; font-weight:800;"><i class="fa-solid fa-tag"></i> ${subTopicTag}</span>
                ${timeTrapBadgeHtml}
              </div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                ${statusBadge}
                <button type="button" id="cbt-scorecard-bm-btn-${idx}" class="btn btn-sm btn-secondary" onclick="bookmarkCbtQuestionFromScorecard(${idx}, this)" style="padding:3px 9px; font-size:11px; font-weight:800; border-color:#6366f1; color:#4f46e5;">
                  <i class="fa-regular fa-bookmark"></i> Bookmark MCQ
                </button>
              </div>
            </div>
            <div style="font-size:14px; font-weight:600; margin-bottom:8px;">${q.qEn || q.q}</div>
            ${q.qHi && q.qHi !== q.qEn ? `<div style="font-size:12.5px; color:var(--text-muted); margin-bottom:8px;">🇮🇳 ${q.qHi}</div>` : ''}
            <div style="font-size:12px; color:#16a34a; font-weight:700;">✔ Correct Option: (${String.fromCharCode(65 + q.correctIndex)}) ${(q.optionsEn || q.options || [])[q.correctIndex]}</div>
            ${userAns !== undefined && userAns !== q.correctIndex ? `<div style="font-size:12px; color:#dc2626; font-weight:700;">✖ Your Answer: (${String.fromCharCode(65 + userAns)}) ${(q.optionsEn || q.options || [])[userAns]}</div>` : ''}
            <div style="display:flex; gap:14px; flex-wrap:wrap; font-size:11px; font-weight:700; color:var(--secondary); background:var(--surface); padding:6px 10px; border-radius:8px; border:1px solid var(--border); margin-top:8px;">
              <span>⏱️ Your Time: <strong>${qTimeSec}s</strong></span>
              <span>👥 Batch Avg: <strong>${batchAvgSec}s</strong></span>
              <span style="color:#059669;">🏆 Topper #1 Time: <strong>${topperSec}s</strong></span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:8px; padding:8px 10px; background:rgba(79,70,229,0.05); border-left:3px solid #4f46e5; border-radius:6px;">
              <strong>💡 Concept Solution &amp; Shortcut Trick:</strong> ${shortcutNote}
            </div>
          </div>
        `;
      });

      const netScore = Math.max(0, (correct * pos) - (wrong * neg) + (unattempted * unattMark)).toFixed(2);
      const maxMarks = (portalState.activeCbtTest.questions.length * pos).toFixed(2);
      const passingThreshold = portalState.activeCbtTest.passingMarks !== undefined && portalState.activeCbtTest.passingMarks !== null && portalState.activeCbtTest.passingMarks !== ''
        ? Number(portalState.activeCbtTest.passingMarks)
        : 0;
      const isPassedCbt = passingThreshold > 0 ? parseFloat(netScore) >= passingThreshold : true;
      const attempted = correct + wrong;
      const accuracy = attempted > 0 ? ((correct / attempted) * 100).toFixed(1) : '0.0';
      const elapsedMins = window.cbtExamStartedAtMs ? Math.max(0.1, ((Date.now() - window.cbtExamStartedAtMs) / 60000)).toFixed(2) : (portalState.activeCbtTest.durationMinutes || 0);
      const avgTimeCorrect = correct > 0 ? Math.round(totalTimeCorrectSec / correct) : 0;
      const avgTimeWrong = wrong > 0 ? Math.round(totalTimeWrongSec / wrong) : 0;
      const guessNetMarksImpact = ((guessCorrect * pos) - (guessWrong * neg)).toFixed(2);

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

      const examSec = document.getElementById('cbt-active-interface') || document.getElementById('cbt-exam-interface');
      const resSec = document.getElementById('cbt-result-container') || document.getElementById('cbt-result-section');
      document.body.classList.remove('cbt-exam-fullscreen-lock');
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      if (examSec) {
        examSec.style.display = 'none';
        examSec.classList.remove('cbt-fullscreen-active');
      }
      window.isCbtExamActive = false;
      window.activeScheduledLiveTestEndTime = null;
      window.activeScheduledLiveTestObj = null;

      if (resSec) {
        resSec.style.display = 'block';
        if (liveResultPublishTimeMs > 0 && Date.now() < liveResultPublishTimeMs) {
          const pubStr = new Date(liveResultPublishTimeMs).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
          resSec.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:36px 24px; text-align:center; background:var(--surface); border:2px solid var(--primary); border-radius:16px;">
              <h3 style="color:var(--primary); margin-bottom:8px;">🔴 Live CBT Exam Submitted!</h3>
              <p style="font-size:14px; color:var(--text-muted); margin-bottom:14px;">Your responses for <strong>${portalState.activeCbtTest.title}</strong> have been saved.</p>
              <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.4); color:#b45309; padding:12px 18px; border-radius:10px; font-size:13px; font-weight:700; margin-bottom:18px;">
                🔒 As configured by Admin Panel, the CBT Scorecard & Solutions will be displayed at: <strong>${pubStr}</strong>
              </div>
              <button class="btn btn-primary" onclick="exitCbtExam()"><i class="fa-solid fa-arrow-left"></i> Back to CBT Mock Catalog</button>
            </div>
          `;
        } else {
          resSec.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
              <h3 style="margin:0; color:var(--primary);"><i class="fa-solid fa-square-poll-vertical"></i> Testbook CBT Scorecard: ${portalState.activeCbtTest.title}</h3>
              <button class="btn btn-secondary" onclick="exitCbtExam()"><i class="fa-solid fa-arrow-left"></i> Back to CBT Mock Catalog</button>
            </div>
            <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-bottom: 16px;">
              <div class="stat-card"><div class="stat-label">Net Marks (Pass: ${passingThreshold})</div><div class="stat-value" style="color:var(--primary);">${netScore} / ${maxMarks}</div></div>
              <div class="stat-card"><div class="stat-label">Correct (+${pos})</div><div class="stat-value" style="color:#16a34a;">${correct}</div></div>
              <div class="stat-card"><div class="stat-label">Wrong (-${neg})</div><div class="stat-value" style="color:#dc2626;">${wrong}</div></div>
              <div class="stat-card"><div class="stat-label">Unattempted</div><div class="stat-value">${unattempted}</div></div>
              <div class="stat-card"><div class="stat-label">CBT Accuracy / Status</div><div class="stat-value" style="color:${isPassedCbt ? '#16a34a' : '#f59e0b'};">${accuracy}% (${isPassedCbt ? 'PASSED' : 'COMPLETED'})</div></div>
            </div>
            <!-- 🧠 NEW: QUESTION-WISE TIME SPENT & GUESSED VS. SURE ANALYTICS PANEL -->
            <div style="background: linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(16,185,129,0.08) 100%); border: 1px solid rgba(139,92,246,0.3); border-radius: 12px; padding: 14px 18px; margin-bottom: 18px;">
              <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--secondary); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-brain" style="color: #8b5cf6;"></i> Question-Wise Time Spent &amp; "Guessed vs. Sure" Intelligence Report
              </h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; font-size: 12.5px;">
                <div style="background: var(--surface); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);">
                  <strong>✅ 100% Sure-Shot Accuracy:</strong><br>
                  <span style="color: #10b981; font-weight: 800;">${sureCorrect} Correct</span> / <span style="color: #ef4444; font-weight: 800;">${sureWrong} Wrong</span>
                </div>
                <div style="background: var(--surface); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);">
                  <strong>🤔 50-50 Guesses Outcome:</strong><br>
                  <span style="color: #10b981; font-weight: 800;">${guessCorrect} Hit</span> / <span style="color: #ef4444; font-weight: 800;">${guessWrong} Miss</span> (Net: <strong>${Number(guessNetMarksImpact) >= 0 ? '+' : ''}${guessNetMarksImpact} Marks</strong>)
                </div>
                <div style="background: var(--surface); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);">
                  <strong>⏱️ Avg Time per Correct Q:</strong><br>
                  <span style="color: var(--primary); font-weight: 900;">${avgTimeCorrect} sec / question</span>
                </div>
                <div style="background: var(--surface); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);">
                  <strong>⚠️ Avg Time per Wrong Q:</strong><br>
                  <span style="color: #d97706; font-weight: 900;">${avgTimeWrong} sec / question</span>
                </div>
              </div>
            </div>
            <h4 style="margin-bottom:12px;">Detailed Question-by-Question Solutions &amp; Time Breakdown</h4>
            ${reviewHtml}
          `;
        }
      }

      const cbtHistoryRecord = {
        userId: portalState.currentUser ? portalState.currentUser.userId : 'GUEST',
        userName: portalState.currentUser ? portalState.currentUser.name : 'Candidate',
        isCbtExam: true,
        examName: `CBT Exam: ${portalState.activeCbtTest.title}`,
        ExamName: `CBT Exam: ${portalState.activeCbtTest.title}`,
        passageTitle: portalState.activeCbtTest.examCategory || 'SSC CBT Mock',
        PassageTitle: portalState.activeCbtTest.examCategory || 'SSC CBT Mock',
        timeDuration: `${portalState.activeCbtTest.durationMinutes || 0} Mins`,
        TimeDuration: `${portalState.activeCbtTest.durationMinutes || 0} Mins`,
        timeTaken: `${elapsedMins} mins`,
        TimeTaken: `${elapsedMins} mins`,
        typingDate: getLocalDateString(),
        date: getLocalDateString(),
        Date: new Date().toISOString(),
        submissionTime: new Date().toLocaleTimeString(),
        grossSpeed: 0,
        netSpeed: 0,
        totalWord: portalState.activeCbtTest.questions.length,
        TotalWord: portalState.activeCbtTest.questions.length,
        correctWords: correct,
        CorrectWords: correct,
        correctCount: correct,
        wrongCount: wrong,
        unansweredCount: unattempted,
        accuracyPercentage: accuracy,
        AccuracyPercentage: accuracy,
        marksObtained: netScore,
        MarksObtained: netScore,
        totalMarks: maxMarks,
        TotalMarks: maxMarks,
        wrongTyped: wrong,
        WrongTyped: wrong,
        wordLeft: unattempted,
        WordLeft: unattempted,
        status: isPassedCbt ? 'PASSED' : 'COMPLETED',
        Status: isPassedCbt ? 'PASSED' : 'COMPLETED',
        userTranscription: `Attempted: ${attempted}/${portalState.activeCbtTest.questions.length} | Correct: ${correct} (+${pos}) | Wrong: ${wrong} (-${neg}) | Unanswered: ${unattempted} | Net Score: ${netScore}/${maxMarks} (Passing: ${passingThreshold})`,
        referenceText: portalState.activeCbtTest.questions.map((q, i) => `Q${i + 1}: ${q.qEn} [Correct Ans: ${q.optionsEn[q.correctIndex]}]`).join('\n'),
        cbtQuestionsReview: cbtQuestionsReview,
        liveTestId: activeLiveTestObj ? activeLiveTestObj.id : undefined,
        liveResultDisplayMode: liveResultDisplayMode,
        liveResultPublishTimeMs: liveResultPublishTimeMs
      };
      if (typeof checkAndTriggerHighScoreNotification === 'function') {
        checkAndTriggerHighScoreNotification(cbtHistoryRecord, true);
      }

      portalState.allTestHistoryList.unshift(cbtHistoryRecord);
      if (portalState.globalData && Array.isArray(portalState.globalData.history)) portalState.globalData.history.unshift(cbtHistoryRecord);
      if (portalState.globalData && Array.isArray(portalState.globalData.userHistory)) portalState.globalData.userHistory.unshift(cbtHistoryRecord);
      apiCall('saveTestHistory', cbtHistoryRecord, true).then(res => {
        if (res && res.isNewHighScore && typeof pushAdminRealtimeNotification === 'function') {
          pushAdminRealtimeNotification({
            type: 'HIGH_SCORE',
            title: '🏆 High-Score Record Broken (CBT Exam)',
            message: `${cbtHistoryRecord.userName} set a new ${res.newRecordValue || netScore} Marks record in ${cbtHistoryRecord.examName} (Prev Best: ${res.previousBest || 0} Marks)!`,
            userName: cbtHistoryRecord.userName,
            examName: cbtHistoryRecord.examName,
            timestamp: new Date().toISOString()
          });
        }
      });
      logPortalAction('SUBMIT_CBT_EXAM', `Submitted CBT Exam: ${portalState.activeCbtTest.title} | Score: ${netScore}/${maxMarks}`);
      renderTestHistoryTable();

      showToast(`CBT Exam Submitted! Score: ${netScore} / ${maxMarks}`);
    
  try { portalHooks.emit('afterCbtSubmit', ...arguments); } catch (_hk) {}
}

export function confirmAndExitCbtExam() {
      exitCbtExam();
      showToast('Exited CBT Exam — returned to CBT Exam Catalog.');
    }

export function exitCbtExam() {
      if (portalState.cbtTimerInterval) clearInterval(portalState.cbtTimerInterval);
      if (typeof window.stopExamHallSynth === 'function') window.stopExamHallSynth();
      window.isCbtExamActive = false;
      window.activeScheduledLiveTestEndTime = null;
      window.activeScheduledLiveTestObj = null;
      document.body.classList.remove('cbt-exam-fullscreen-lock');
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      const examSec = document.getElementById('cbt-active-interface') || document.getElementById('cbt-exam-interface');
      const resSec = document.getElementById('cbt-result-container') || document.getElementById('cbt-result-section');
      const catSec = document.getElementById('cbt-catalog-container') || document.getElementById('cbt-catalog-section');
      if (examSec) {
        examSec.style.display = 'none';
        examSec.classList.remove('cbt-fullscreen-active');
      }
      if (resSec) resSec.style.display = 'none';
      if (catSec) catSec.style.display = 'block';
      logPortalAction('EXIT_CBT_EXAM', 'Exited CBT Exam to CBT Catalog');
      renderCbtTestCatalog();
      // Ensure we remain on the CBT Exam tab (Requirement #5)
      if (portalState.activeTab !== 'cbttest') {
        navigateTo('cbttest', false, true);
      }
    }

export function openBulkCbtQuestionImporterModal() {
      let modal = document.getElementById('bulk-cbt-importer-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'bulk-cbt-importer-modal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'z-index: 9400; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15,23,42,0.82);';
        modal.innerHTML = `
          <div class="modal-content" style="max-width: 780px; width: 100%; border-radius: 16px; padding: 20px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 20px 50px rgba(0,0,0,0.4);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 12px;">
              <div>
                <h4 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--secondary);"><i class="fa-solid fa-file-import" style="color: #7c3aed;"></i> Bulk CBT Question Importer (Word / CSV / Raw MCQ Paste Parser)</h4>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">Paste raw numbered MCQs (English/Hindi) or upload a CSV/JSON file to auto-generate a CBT Mock Test in seconds.</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('bulk-cbt-importer-modal').style.display='none'">✕</button>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 10px;">
              <input type="text" id="bulk-cbt-default-section" class="form-control" value="General Intelligence & Reasoning" placeholder="Default Section Name" style="flex: 1; min-width: 200px;">
              <label class="btn btn-secondary btn-sm" style="cursor: pointer; margin: 0;">
                <i class="fa-solid fa-file-csv" style="color: #059669;"></i> Upload CSV / JSON File
                <input type="file" accept=".csv,.json,.txt" style="display: none;" onchange="handleBulkCbtFileUpload(event)">
              </label>
              <button type="button" class="btn btn-secondary btn-sm" onclick="loadSampleBulkMcqFormat()">Load Sample Format</button>
            </div>
            <textarea id="bulk-cbt-raw-paste-input" class="form-control" rows="9" style="font-family: monospace; font-size: 12px;" placeholder="Paste numbered MCQs here, e.g.:&#10;1. Which article of the Indian Constitution deals with Official Language?&#10;(A) Article 343&#10;(B) Article 352&#10;(C) Article 360&#10;(D) Article 370&#10;Ans: A&#10;Exp: Article 343(1) declares Hindi in Devanagari script as the official language."></textarea>
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 12px;">
              <span id="bulk-cbt-parse-status" style="font-size: 12px; font-weight: 800; color: var(--primary);">Ready to parse MCQs</span>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('bulk-cbt-importer-modal').style.display='none'">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" style="background: #7c3aed; border-color: #7c3aed; font-weight: 800;" onclick="parseAndApplyBulkCbtQuestions()"><i class="fa-solid fa-check-double"></i> Parse &amp; Fill CBT Questions JSON</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      } else {
        modal.style.display = 'flex';
      }
    }

export function loadSampleBulkMcqFormat() {
      const inp = document.getElementById('bulk-cbt-raw-paste-input');
      if (!inp) return;
      inp.value = `1. In Pitman Shorthand, which stroke is written downward at a 60-degree angle?\n(A) P / B\n(B) T / D\n(C) Ch / J\n(D) K / G\nAns: C\nExp: Chay and Jay are straight downstrokes written at 60 degrees from the horizontal.\n\n2. Choose the correctly spelt word for official parliamentary transcription:\n(A) Superintendant\n(B) Superintendent\n(C) Suprentendent\n(D) Superintandent\nAns: B\nExp: Superintendent is spelt with 'e' throughout.`;
    }

export function handleBulkCbtFileUpload(event) {
      const file = event?.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = String(e.target?.result || '');
        const inp = document.getElementById('bulk-cbt-raw-paste-input');
        if (inp) inp.value = text;
        showToast(`📂 Loaded "${file.name}" — Click "Parse & Fill CBT Questions JSON"`);
      };
      reader.readAsText(file);
    }

export function parseAndApplyBulkCbtQuestions() {
      const raw = (document.getElementById('bulk-cbt-raw-paste-input')?.value || '').trim();
      const defaultSection = (document.getElementById('bulk-cbt-default-section')?.value || 'General Awareness').trim();
      if (!raw) {
        showToast('⚠️ Please paste raw MCQs or upload a CSV/JSON file first.');
        return;
      }

      let parsedQuestions = [];
      if (raw.startsWith('[')) {
        try {
          parsedQuestions = JSON.parse(raw);
        } catch (e) {}
      }

      if (parsedQuestions.length === 0) {
        const blocks = raw.split(/\n\s*(?=(?:Q\.?\s*)?\d+[\.\)\:])/i).map(b => b.trim()).filter(Boolean);
        blocks.forEach((blk) => {
          const lines = blk.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length < 2) return;
          const qLine = lines[0].replace(/^(?:Q\.?\s*)?\d+[\.\)\:]\s*/i, '').trim();
          const opts = [];
          let ansIndex = 0;
          let explanation = '';

          lines.slice(1).forEach(line => {
            const optMatch = line.match(/^\(?([A-Da-d1-4])[\.\)\:]\s*(.+)$/);
            const ansMatch = line.match(/^(?:Ans|Answer|Correct)\s*[\:\-]?\s*\(?([A-Da-d1-4])\)?/i);
            const expMatch = line.match(/^(?:Exp|Explanation|Solution)\s*[\:\-]?\s*(.+)$/i);
            if (ansMatch) {
              const token = ansMatch[1].toUpperCase();
              ansIndex = 'ABCD'.includes(token) ? 'ABCD'.indexOf(token) : Math.max(0, (parseInt(token, 10) || 1) - 1);
            } else if (expMatch) {
              explanation = expMatch[1].trim();
            } else if (optMatch && opts.length < 4) {
              opts.push(optMatch[2].trim());
            }
          });

          while (opts.length < 4) opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
          const cleanOpts = opts.slice(0, 4);
          parsedQuestions.push({
            section: defaultSection,
            qEn: qLine,
            qHi: qLine,
            optionsEn: cleanOpts,
            optionsHi: cleanOpts,
            correctIndex: ansIndex,
            explanation: explanation
          });
        });
      }

      if (parsedQuestions.length === 0) {
        showToast('⚠️ Could not detect questions. Click "Load Sample Format" to see the supported format.');
        return;
      }

      const urlBox = document.getElementById('adm-upload-url');
      if (urlBox) {
        urlBox.value = JSON.stringify(parsedQuestions, null, 2);
        if (typeof autoCalculateWordsAndStrokes === 'function') autoCalculateWordsAndStrokes();
      }
      const statusEl = document.getElementById('bulk-cbt-parse-status');
      if (statusEl) statusEl.innerText = `✅ Successfully parsed ${parsedQuestions.length} MCQ(s)!`;
      const modal = document.getElementById('bulk-cbt-importer-modal');
      if (modal) modal.style.display = 'none';
      showToast(`✅ Imported ${parsedQuestions.length} CBT MCQ(s) into the upload form!`);
    }

window.__cbtNotebookMode = 'bookmarks';

export const DEFAULT_STARTER_CBT_MCQS = [];

window.classifyCbtQuestionSubTopic = function(qObj) {
        if (!qObj) return 'General Aptitude';
        if (qObj.subTopic) return qObj.subTopic;
        const txt = ((qObj.q || qObj.qEn || qObj.question || '') + ' ' + (qObj.section || '') + ' ' + (qObj.explanation || '')).toLowerCase();
        if (/passive|active voice|voice/.test(txt)) return 'Active / Passive Voice';
        if (/direct|indirect|narration|reported speech/.test(txt)) return 'Direct / Indirect Speech';
        if (/cloze|fill in the blank/.test(txt)) return 'Cloze Test & Fillers';
        if (/synonym|antonym|vocab|idiom|phrase/.test(txt)) return 'Vocabulary & Idioms';
        if (/error|grammar|spotting|sentence improvement/.test(txt)) return 'Error Spotting & Grammar';
        if (/syllogism|statement|conclusion/.test(txt)) return 'Syllogism & Logic';
        if (/coding|decoding|series|analogy|odd one/.test(txt)) return 'Coding, Series & Analogy';
        if (/blood relation|direction|seating/.test(txt)) return 'Puzzles & Relations';
        if (/constitution|article|parliament|polity|fundamental/.test(txt)) return 'Indian Polity & Constitution';
        if (/history|mughal|freedom|ancient|medieval|modern/.test(txt)) return 'History & Culture';
        if (/pitman|stroke|hook|halving|shorthand|vowel|grammalogue/.test(txt)) return 'Pitman Shorthand Theory';
        if (/shortcut|ctrl|ms word|excel|computer|ram|cpu|protocol/.test(txt)) return 'Computer & MS Office';
        return qObj.section || 'General Awareness & Reasoning';
    };

export function isLegacySeededCbtMcqEntry(item) {
        if (typeof window.isLegacySeededCbtMcqGlobal === 'function') {
            return window.isLegacySeededCbtMcqGlobal(item);
        }
        if (!item || typeof item !== 'object') return true;
        const idStr = String(item.id || '').toLowerCase();
        if (idStr.startsWith('seed-') || idStr.startsWith('sample-') || idStr.startsWith('bm-seed') || idStr.startsWith('bm_def_') || idStr.startsWith('mcq_def_') || idStr.startsWith('err-seed')) return true;
        const title = String(item.testTitle || '').toLowerCase().trim();
        if (title === 'ssc steno mock test' || title === 'ssc steno grade c & d mock' || title === 'ssc steno mock #1' || title === 'pitman theory diagnostic' || title === 'sample cbt mock') return true;
        return false;
    }

window.getCbtBookmarkedMcqs = function() {
        try {
            const raw = localStorage.getItem(CBT_BOOKMARKS_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            const cleaned = parsed.filter(item => !isLegacySeededCbtMcqEntry(item));
            if (cleaned.length !== parsed.length) {
                try { localStorage.setItem(CBT_BOOKMARKS_STORAGE_KEY, JSON.stringify(cleaned)); } catch (e) {}
                if (typeof syncUserCloudStateToBackend === 'function') syncUserCloudStateToBackend();
            }
            return cleaned;
        } catch (e) { return []; }
    };

window.saveCbtBookmarkedMcqs = function(list) {
        try {
            const cleaned = (Array.isArray(list) ? list : []).filter(item => !isLegacySeededCbtMcqEntry(item)).slice(0, 300);
            localStorage.setItem(CBT_BOOKMARKS_STORAGE_KEY, JSON.stringify(cleaned));
        } catch (e) {}
        updateCbtRevisionCountsUI();
        if (typeof syncUserCloudStateToBackend === 'function') syncUserCloudStateToBackend();
    };

window.getCbtMistakeHistoryBank = function() {
        try {
            const raw = localStorage.getItem(CBT_MISTAKES_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            const cleaned = parsed.filter(item => !isLegacySeededCbtMcqEntry(item));
            if (cleaned.length !== parsed.length) {
                try { localStorage.setItem(CBT_MISTAKES_STORAGE_KEY, JSON.stringify(cleaned)); } catch (e) {}
            }
            return cleaned;
        } catch (e) { return []; }
    };

window.saveCbtMistakeHistoryBank = function(list) {
        try {
            const cleaned = (Array.isArray(list) ? list : []).filter(item => !isLegacySeededCbtMcqEntry(item)).slice(0, 400);
            localStorage.setItem(CBT_MISTAKES_STORAGE_KEY, JSON.stringify(cleaned));
        } catch (e) {}
        updateCbtRevisionCountsUI();
    };

export let _cbtNotebookClearArmUntil = 0;

export function updateCbtRevisionCountsUI() {
        const savedPill = document.getElementById('cbt-saved-mcqs-count-pill');
        const mistakePill = document.getElementById('cbt-mistake-bank-count-pill');
        const saved = window.getCbtBookmarkedMcqs();
        const mistakes = window.getCbtMistakeHistoryBank();
        if (savedPill) savedPill.textContent = `${saved.length} Saved MCQs`;
        if (mistakePill) mistakePill.textContent = `${mistakes.length} Past Mistakes / 50-50 Guesses`;
    }

window.toggleCbtCurrentQuestionBookmark = function() {
        if (typeof window.syncGlobalCbtWindowState === 'function') window.syncGlobalCbtWindowState();
        const st = window.cbtState;
        const activeTest = (st && st.activeTest) || window.activeCbtTest;
        if (!activeTest || !Array.isArray(activeTest.questions)) {
            if (typeof showToast === 'function') showToast('Open any CBT test to bookmark the current question, or add custom notes inside My Saved MCQs Notebook.', 'info');
            return;
        }
        const curIdx = typeof st?.currentIndex === 'number' ? st.currentIndex : 0;
        const qObj = activeTest.questions[curIdx];
        if (!qObj) return;
        const qText = String(qObj.q || qObj.qEn || qObj.question || '').trim();
        if (!qText) return;

        const list = window.getCbtBookmarkedMcqs();
        const existingIdx = list.findIndex(item => String(item.q || '').trim() === qText);
        const iconEl = document.getElementById('cbt-bookmark-question-icon');
        const txtEl = document.getElementById('cbt-bookmark-question-btn-text');

        if (existingIdx >= 0) {
            list.splice(existingIdx, 1);
            if (iconEl) iconEl.className = 'fa-regular fa-bookmark';
            if (txtEl) txtEl.textContent = 'Bookmark MCQ';
            if (typeof showToast === 'function') showToast('Removed from Saved MCQs Notebook', 'info');
        } else {
            const opts = Array.isArray(qObj.optionsEn) ? qObj.optionsEn : (Array.isArray(qObj.options) ? qObj.options : []);
            const ansIdx = Number(qObj.correctIndex ?? qObj.answer ?? 0);
            list.unshift({
                q: qText,
                qHi: qObj.qHi || qText,
                options: opts,
                optionsHi: Array.isArray(qObj.optionsHi) ? qObj.optionsHi : opts,
                answer: ansIdx,
                explanation: qObj.explanation || '',
                section: qObj.section || 'General',
                subTopic: window.classifyCbtQuestionSubTopic(qObj),
                testTitle: activeTest.title || 'CBT Mock',
                savedAt: new Date().toLocaleDateString('en-IN'),
                srsIntervalDays: 1,
                nextReviewTs: Date.now()
            });
            if (iconEl) iconEl.className = 'fa-solid fa-bookmark text-indigo-600';
            if (txtEl) txtEl.textContent = 'Bookmarked';
            if (typeof showToast === 'function') showToast('Saved to My Saved MCQs Revision Notebook!', 'success');
        }
        window.saveCbtBookmarkedMcqs(list);
    };

window.bookmarkCbtQuestionFromScorecard = function(qIdx) {
        if (typeof window.syncGlobalCbtWindowState === 'function') window.syncGlobalCbtWindowState();
        const activeTest = (window.cbtState && window.cbtState.activeTest) || window.activeCbtTest;
        if (!activeTest || !Array.isArray(activeTest.questions)) return;
        const qObj = activeTest.questions[Number(qIdx)];
        if (!qObj) return;
        const qText = String(qObj.q || qObj.qEn || qObj.question || '').trim();
        if (!qText) return;

        const list = window.getCbtBookmarkedMcqs();
        const existingIdx = list.findIndex(item => String(item.q || '').trim() === qText);
        const btnEl = document.getElementById(`cbt-scorecard-bm-btn-${qIdx}`);
        if (existingIdx >= 0) {
            list.splice(existingIdx, 1);
            if (btnEl) {
                btnEl.style.background = 'rgba(79,70,229,0.08)';
                btnEl.innerHTML = `<i class="fa-regular fa-bookmark"></i> Bookmark for 1-Click Revision`;
            }
            if (typeof showToast === 'function') showToast('Removed from My Saved MCQs Notebook', 'info');
        } else {
            const opts = Array.isArray(qObj.optionsEn) ? qObj.optionsEn : (Array.isArray(qObj.options) ? qObj.options : []);
            const ansIdx = Number(qObj.correctIndex ?? qObj.answer ?? 0);
            list.unshift({
                q: qText,
                qHi: qObj.qHi || qText,
                options: opts,
                optionsHi: Array.isArray(qObj.optionsHi) ? qObj.optionsHi : opts,
                answer: ansIdx,
                explanation: qObj.explanation || '',
                section: qObj.section || 'General',
                subTopic: window.classifyCbtQuestionSubTopic(qObj),
                testTitle: activeTest.title || 'CBT Scorecard Review',
                savedAt: new Date().toLocaleDateString('en-IN'),
                srsIntervalDays: 1,
                nextReviewTs: Date.now()
            });
            if (btnEl) {
                btnEl.style.background = 'rgba(79,70,229,0.22)';
                btnEl.innerHTML = `<i class="fa-solid fa-bookmark"></i> Saved in Notebook`;
            }
            if (typeof showToast === 'function') showToast('Question bookmarked to My Saved MCQs Notebook!', 'success');
        }
        window.saveCbtBookmarkedMcqs(list);
    };

window.openCbtSavedMcqsNotebookModal = function(initialMode) {
        const modal = document.getElementById('cbt-saved-mcqs-notebook-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        if (initialMode === 'flashcards' || initialMode === 'bookmarks') {
            window.__cbtNotebookMode = initialMode;
        }
        window.switchCbtNotebookMode(window.__cbtNotebookMode || 'bookmarks');
    };

window.closeCbtSavedMcqsNotebookModal = function() {
        const modal = document.getElementById('cbt-saved-mcqs-notebook-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.style.display = 'none';
    };

window.switchCbtNotebookMode = function(mode) {
        window.__cbtNotebookMode = mode === 'flashcards' ? 'flashcards' : 'bookmarks';
        const bmBtn = document.getElementById('cbt-nb-mode-bookmarks');
        const fcBtn = document.getElementById('cbt-nb-mode-flashcards');
        const srsFilter = document.getElementById('cbt-notebook-srs-filter');
        if (bmBtn && fcBtn) {
            if (window.__cbtNotebookMode === 'bookmarks') {
                bmBtn.className = 'px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-extrabold';
                fcBtn.className = 'px-2.5 py-1 rounded-lg text-white hover:bg-white/10 font-bold';
                if (srsFilter) srsFilter.classList.add('hidden');
            } else {
                fcBtn.className = 'px-2.5 py-1 rounded-lg bg-emerald-400 text-slate-950 font-extrabold';
                bmBtn.className = 'px-2.5 py-1 rounded-lg text-white hover:bg-white/10 font-bold';
                if (srsFilter) srsFilter.classList.remove('hidden');
            }
        }
        window.renderCbtSavedMcqsNotebookList();
    };

window.addCustomMcqToSavedNotebook = function() {
        const qInput = document.getElementById('cbt-custom-mcq-q-input') || document.getElementById('cbt-nb-custom-q');
        const ansInput = document.getElementById('cbt-custom-mcq-ans-input') || document.getElementById('cbt-nb-custom-ans');
        const topicInput = document.getElementById('cbt-nb-custom-topic') || document.getElementById('cbt-notebook-topic-filter');
        const expInput = document.getElementById('cbt-custom-mcq-exp-input') || document.getElementById('cbt-nb-custom-exp');
        const qText = String(qInput?.value || '').trim();
        const ansText = String(ansInput?.value || '').trim();
        if (!qText || !ansText) {
            if (typeof showToast === 'function') showToast('Please enter both Question / Concept and Correct Answer!', 'error');
            return;
        }
        const rawTopic = topicInput?.value;
        const subTopic = (rawTopic && rawTopic !== 'ALL') ? rawTopic : 'General Awareness & Reasoning';
        const explanation = String(expInput?.value || '').trim() || `Core revision note for ${subTopic}.`;
        const list = window.getCbtBookmarkedMcqs();
        list.unshift({
            q: qText,
            qHi: qText,
            options: [ansText, 'None of the above', 'Context dependent', 'Requires elimination'],
            optionsHi: [ansText, 'उपरोक्त में से कोई नहीं', 'संदर्भ पर निर्भर', 'विकल्प उन्मूलन आवश्यक'],
            answer: 0,
            explanation,
            section: subTopic,
            subTopic,
            testTitle: 'Custom Revision Note',
            savedAt: new Date().toLocaleDateString('en-IN'),
            srsIntervalDays: 1,
            nextReviewTs: Date.now()
        });
        window.saveCbtBookmarkedMcqs(list);
        if (qInput) qInput.value = '';
        if (ansInput) ansInput.value = '';
        if (expInput) expInput.value = '';
        document.getElementById('cbt-notebook-add-form')?.classList.add('hidden');
        window.renderCbtSavedMcqsNotebookList();
        if (typeof showToast === 'function') showToast('Custom MCQ / Concept added to your Saved Notebook!', 'success');
    };

window.scheduleSpacedRepetitionMcq = function(sourceMode, idx, days) {
        const d = Number(days) || 1;
        const list = sourceMode === 'flashcards' ? window.getCbtMistakeHistoryBank() : window.getCbtBookmarkedMcqs();
        if (!list[idx]) return;
        list[idx].srsIntervalDays = d;
        list[idx].nextReviewTs = Date.now() + (d * 24 * 60 * 60 * 1000);
        list[idx].lastReviewedAt = new Date().toLocaleDateString('en-IN');
        if (sourceMode === 'flashcards') {
            window.saveCbtMistakeHistoryBank(list);
        } else {
            window.saveCbtBookmarkedMcqs(list);
        }
        window.renderCbtSavedMcqsNotebookList();
        if (typeof showToast === 'function') showToast(`Scheduled for Spaced-Repetition Review in +${d} day(s)!`, 'success');
    };

window.renderCbtSavedMcqsNotebookList = function() {
        const container = document.getElementById('cbt-saved-mcqs-notebook-list');
        const filterEl = document.getElementById('cbt-notebook-topic-filter');
        const modeSelect = document.getElementById('cbt-notebook-mode-select');
        if (!container) return;

        const isFlashcardMode = window.__cbtNotebookMode === 'flashcards';
        if (modeSelect && modeSelect.value !== window.__cbtNotebookMode) {
            modeSelect.value = window.__cbtNotebookMode || 'bookmarks';
        }
        const rawList = isFlashcardMode
            ? [...window.getCbtMistakeHistoryBank(), ...window.getCbtBookmarkedMcqs()]
            : window.getCbtBookmarkedMcqs();

        const list = [];
        const seen = new Set();
        rawList.forEach(item => {
            const k = String(item.q || item.qEn || '').trim();
            if (k && !seen.has(k)) {
                seen.add(k);
                list.push(item);
            }
        });

        const topics = Array.from(new Set(list.map(i => i.subTopic || 'General')));
        const currentTopic = filterEl?.value || 'ALL';
        if (filterEl) {
            filterEl.innerHTML = `<option value="ALL" style="color:#0f172a;">All Sub-Topics (${list.length})</option>` +
                topics.map(t => `<option value="${t}" style="color:#0f172a;" ${t === currentTopic ? 'selected' : ''}>${t}</option>`).join('');
        }
        const selectedTopic = filterEl?.value || 'ALL';
        const filtered = list.filter(i => selectedTopic === 'ALL' || (i.subTopic || 'General') === selectedTopic);

        const dueTodayCount = list.filter(i => !i.nextReviewTs || i.nextReviewTs <= Date.now()).length;
        const masteredCount = list.filter(i => Number(i.srsIntervalDays || 1) >= 7).length;

        const summaryBarHtml = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 4px;">
                <div style="background: var(--background); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 10.5px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Total Cards in Deck</div>
                        <div class="mono-num" style="font-size: 18px; font-weight: 900; color: var(--primary);">${list.length}</div>
                    </div>
                    <i class="fa-solid fa-layer-group" style="font-size: 18px; color: var(--primary); opacity: 0.75;"></i>
                </div>
                <div style="background: var(--background); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 10.5px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">SRS Due for Review</div>
                        <div class="mono-num" style="font-size: 18px; font-weight: 900; color: #d97706;">${dueTodayCount}</div>
                    </div>
                    <i class="fa-solid fa-clock-rotate-left" style="font-size: 18px; color: #d97706; opacity: 0.75;"></i>
                </div>
                <div style="background: var(--background); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 10.5px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Long-Term Mastered (7d+)</div>
                        <div class="mono-num" style="font-size: 18px; font-weight: 900; color: #059669;">${masteredCount}</div>
                    </div>
                    <i class="fa-solid fa-award" style="font-size: 18px; color: #059669; opacity: 0.75;"></i>
                </div>
            </div>
        `;

        if (filtered.length === 0) {
            container.innerHTML = summaryBarHtml + `
                <div style="padding: 32px 20px; text-align: center; background: var(--background); border: 1.5px dashed var(--border); border-radius: 14px; color: var(--text-muted);">
                    <i class="fa-solid fa-book-bookmark" style="font-size: 28px; color: var(--primary); margin-bottom: 8px; display: block;"></i>
                    <div style="font-size: 14px; font-weight: 800; color: var(--secondary); margin-bottom: 4px;">Your Saved MCQs &amp; Spaced-Repetition Deck is Empty</div>
                    <div style="font-size: 12px;">Use the <strong>Quick-Save bar above</strong> to add any tricky question or formula, or click <strong>"Bookmark MCQ"</strong> during any Live CBT Mock Exam!</div>
                </div>`;
            return;
        }

        container.innerHTML = summaryBarHtml + filtered.map((item, idx) => {
            const opts = Array.isArray(item.options) ? item.options : (Array.isArray(item.optionsEn) ? item.optionsEn : []);
            const ansIdx = Number(item.answer ?? item.correctIndex ?? 0);
            const ansText = opts[ansIdx] !== undefined ? opts[ansIdx] : item.answer;
            const srsDays = Number(item.srsIntervalDays || 1);
            const modeKey = isFlashcardMode ? 'flashcards' : 'bookmarks';

            return `
                <div class="srs-flashcard-item">
                    <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span style="padding: 3px 10px; border-radius: 999px; background: rgba(79,70,229,0.14); color: var(--primary); font-size: 11px; font-weight: 800;"><i class="fa-solid fa-tag"></i> ${item.subTopic || 'General'}</span>
                            <span style="padding: 3px 10px; border-radius: 999px; background: rgba(245,158,11,0.16); color: #d97706; font-size: 11px; font-weight: 800;">⏱️ SRS Interval: ${srsDays}d</span>
                            <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">${item.testTitle || 'CBT Notebook'} &bull; ${item.savedAt || 'Saved'}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                            <span style="font-size: 10.5px; font-weight: 800; color: var(--text-muted); margin-right: 2px;">Next Review:</span>
                            <button type="button" onclick="scheduleSpacedRepetitionMcq('${modeKey}', ${idx}, 1)" style="padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border); font-size: 11px; font-weight: 800; cursor: pointer; background: ${srsDays===1?'#e11d48':'var(--background)'}; color: ${srsDays===1?'#fff':'var(--secondary)'};">1d</button>
                            <button type="button" onclick="scheduleSpacedRepetitionMcq('${modeKey}', ${idx}, 3)" style="padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border); font-size: 11px; font-weight: 800; cursor: pointer; background: ${srsDays===3?'#d97706':'var(--background)'}; color: ${srsDays===3?'#fff':'var(--secondary)'};">3d</button>
                            <button type="button" onclick="scheduleSpacedRepetitionMcq('${modeKey}', ${idx}, 7)" style="padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border); font-size: 11px; font-weight: 800; cursor: pointer; background: ${srsDays===7?'#059669':'var(--background)'}; color: ${srsDays===7?'#fff':'var(--secondary)'};">7d</button>
                            <button type="button" onclick="scheduleSpacedRepetitionMcq('${modeKey}', ${idx}, 14)" style="padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border); font-size: 11px; font-weight: 800; cursor: pointer; background: ${srsDays===14?'#4f46e5':'var(--background)'}; color: ${srsDays===14?'#fff':'var(--secondary)'};">14d</button>
                            ${!isFlashcardMode ? `<button type="button" onclick="removeBookmarkFromCbtNotebook(${idx})" style="padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(225,29,72,0.3); background: rgba(225,29,72,0.1); color: #e11d48; font-size: 11px; font-weight: 800; cursor: pointer; margin-left: 4px;"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                        </div>
                    </div>
                    <div style="font-size: 14px; font-weight: 800; color: var(--secondary); margin-bottom: 10px; line-height: 1.5;">Q${idx + 1}. ${item.q || item.qEn}</div>
                    ${opts.length > 0 && !isFlashcardMode ? `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; margin-bottom: 10px;">
                            ${opts.map((o, oIdx) => `
                                <div style="font-size: 12px; padding: 7px 11px; border-radius: 8px; border: 1px solid ${oIdx === ansIdx ? 'rgba(16,185,129,0.5)' : 'var(--border)'}; background: ${oIdx === ansIdx ? 'rgba(16,185,129,0.12)' : 'var(--background)'}; color: ${oIdx === ansIdx ? '#059669' : 'var(--text-main)'}; font-weight: ${oIdx === ansIdx ? '800' : '600'};">
                                    ${String.fromCharCode(65 + oIdx)}. ${o}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <details ${!isFlashcardMode ? 'open' : ''} style="background: var(--background); border-radius: 10px; border: 1px solid var(--border); padding: 10px 14px;">
                        <summary style="cursor: pointer; font-size: 12px; font-weight: 800; color: var(--primary); display: flex; align-items: center; justify-content: space-between;">
                            <span><i class="fa-solid fa-lightbulb" style="color: #f59e0b; margin-right: 6px;"></i> ${isFlashcardMode ? 'Click to Flip Flashcard &amp; Reveal Answer + Trick' : 'Verified Answer &amp; Concept Note'}</span>
                            <span style="font-size: 10.5px; color: var(--text-muted);">Toggle</span>
                        </summary>
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border); font-size: 12.5px;">
                            <div style="color: #059669; font-weight: 900; margin-bottom: 4px;"><i class="fa-solid fa-circle-check"></i> Correct Answer: ${ansText}</div>
                            ${item.explanation ? `<div style="color: var(--secondary); line-height: 1.55;"><strong>Shortcut Trick / Explanation:</strong> ${item.explanation}</div>` : ''}
                        </div>
                    </details>
                </div>
            `;
        }).join('');
    };

window.removeBookmarkFromCbtNotebook = function(idx) {
        const list = window.getCbtBookmarkedMcqs();
        list.splice(idx, 1);
        window.saveCbtBookmarkedMcqs(list);
        window.renderCbtSavedMcqsNotebookList();
    };

window.launchCustomCbtMistakeMiniQuiz = function(limitCount, sourceType) {
        const count = Number(limitCount) || 15;
        window.closeCbtSavedMcqsNotebookModal();

        let pool = sourceType === 'bookmarks'
            ? [...window.getCbtBookmarkedMcqs()]
            : [...window.getCbtMistakeHistoryBank(), ...window.getCbtBookmarkedMcqs()];

        if (typeof window.getAllAvailableCbtTests === 'function') {
            const allCatalogTests = window.getAllAvailableCbtTests();
            allCatalogTests.forEach(t => {
                (t.questions || []).forEach(q => {
                    if (pool.length < count * 3) pool.push(q);
                });
            });
        }

        const uniqueQuestions = [];
        const seenQ = new Set();
        pool.forEach(q => {
            const qText = String(q.q || q.qEn || q.question || '').trim();
            const optsEn = Array.isArray(q.optionsEn) ? q.optionsEn : (Array.isArray(q.options) ? q.options : []);
            const optsHi = Array.isArray(q.optionsHi) ? q.optionsHi : optsEn;
            const correctIdx = Number(q.correctIndex ?? q.answer ?? 0);
            if (qText && !seenQ.has(qText) && optsEn.length >= 2) {
                seenQ.add(qText);
                const subTopic = window.classifyCbtQuestionSubTopic(q);
                uniqueQuestions.push({
                    q: qText,
                    qEn: qText,
                    qHi: q.qHi || qText,
                    options: optsEn,
                    optionsEn: optsEn,
                    optionsHi: optsHi,
                    answer: correctIdx,
                    correctIndex: correctIdx,
                    explanation: q.explanation || 'Review core concept, rule of elimination, and SSC TCS iON time-saving trick.',
                    section: q.section || subTopic,
                    subTopic
                });
            }
        });

        const selected = uniqueQuestions.slice(0, count);
        if (selected.length === 0) {
            if (typeof showToast === 'function') showToast('No CBT questions found to build quiz.', 'error');
            return;
        }
        const customTestId = 'custom_mistake_miniquiz_' + Date.now();
        const rCfg = typeof getCbtRuleConfigForCategory === 'function' ? getCbtRuleConfigForCategory('cbttest') : { hasValidRule: false };
        if (!rCfg || !rCfg.hasValidRule) {
            if (typeof showToast === 'function') showToast('⚠️ No evaluation rule is there! Admin must configure a CBT Evaluation Rule before starting a quiz.', 'error');
            return;
        }
        const customTestObj = {
            id: customTestId,
            title: sourceType === 'bookmarks'
                ? `Saved MCQs Revision Quiz (${selected.length} Qs)`
                : `Smart Mistake & 50-50 Recovery Mini-Quiz (${selected.length} Qs)`,
            category: 'cbttest',
            hasValidRule: true,
            durationMins: Number(rCfg.timeLimit || Math.max(10, selected.length)),
            durationMinutes: Number(rCfg.timeLimit || Math.max(10, selected.length)),
            positiveMarks: Number(rCfg.positiveMarks),
            negativeMarks: Number(rCfg.negativeMarks),
            unattemptedMarks: Number(rCfg.unattemptedMarks || 0),
            passingMarks: Number(rCfg.passingMarks || 0),
            totalMarks: Number(rCfg.totalMarks || selected.length * Number(rCfg.positiveMarks)),
            questions: selected
        };
        if (!Array.isArray(window.__customRuntimeCbtTests)) window.__customRuntimeCbtTests = [];
        window.__customRuntimeCbtTests.unshift(customTestObj);

        if (typeof window.switchView === 'function') {
            window.switchView('cbttest');
        }
        if (typeof window.startCbtMockTest === 'function') {
            window.startCbtMockTest(customTestId);
            if (typeof showToast === 'function') showToast(`Launched ${customTestObj.title}!`, 'success');
        }
    };

window.filterSidebarMenuTabs = function(rawQuery) {
        const q = String(rawQuery || '').trim().toLowerCase();
        const list = document.getElementById('menu-authenticated-tabs-list');
        if (!list) return;

        // Enforce role & per-user tab visibility rules so searching "admin" NEVER reveals hidden or restricted items
        const roleStr = String((typeof portalState.currentUser !== 'undefined' && portalState.currentUser && portalState.currentUser.role) ? portalState.currentUser.role : 'user').toLowerCase().trim();
        const isAdminOrSuper = (roleStr === 'admin' || roleStr === 'superadmin');

        const items = Array.from(list.children);
        let currentDivider = null;
        let currentSectionHasMatch = false;

        items.forEach(li => {
            if (li.classList.contains('nav-category-divider')) {
                if (currentDivider) {
                    const isPrevAdminDiv = currentDivider.id === 'admin-nav-category-divider' || (currentDivider.textContent || '').toLowerCase().includes('administration');
                    currentDivider.style.display = (isPrevAdminDiv && !isAdminOrSuper)
                        ? 'none'
                        : ((currentSectionHasMatch) ? '' : 'none');
                }
                currentDivider = li;
                currentSectionHasMatch = false;
                return;
            }

            const btn = li.querySelector('button[data-tab]');
            if (!btn) return;
            const tabKey = (btn.getAttribute('data-tab') || '').toLowerCase().trim();

            // Strictly hide Admin / Analytics tabs from non-admin accounts even when searching
            const isAdminItem = (li.id === 'admin-nav-item' || tabKey === 'admin' || tabKey === 'analytics');
            if (isAdminItem && !isAdminOrSuper) {
                li.style.display = 'none';
                return;
            }
            // Strictly respect per-user tab access restrictions
            if (typeof isStudentPortalTabAllowedForCurrentUser === 'function' && !isStudentPortalTabAllowedForCurrentUser(tabKey)) {
                li.style.display = 'none';
                return;
            }

            const label = (btn.textContent || '').toLowerCase();
            const matches = !q || label.includes(q) || tabKey.includes(q);
            li.style.display = matches ? '' : 'none';
            if (matches) currentSectionHasMatch = true;
        });

        if (currentDivider) {
            const isLastAdminDiv = currentDivider.id === 'admin-nav-category-divider' || (currentDivider.textContent || '').toLowerCase().includes('administration');
            currentDivider.style.display = (isLastAdminDiv && !isAdminOrSuper)
                ? 'none'
                : (currentSectionHasMatch ? '' : 'none');
        }
    };

window.parseBulkMcqImport = function() {
    const raw = ((document.getElementById('suite-bulk-mcq-input') || {}).value || '').trim();
    if (!raw) {
      if (typeof showToast === 'function') showToast('⚠️ Paste CSV/Word/LaTeX questions first.');
      return;
    }
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const statusEl = document.getElementById('suite-bulk-mcq-status');
    if (statusEl) {
      statusEl.innerHTML = `✅ Parsed <strong>${lines.length} Bilingual MCQ blocks</strong> (with options A–D, answer key &amp; LaTeX/Comprehension tags) into Question Bank!`;
    }
    if (typeof showToast === 'function') showToast(`📥 Bulk imported ${lines.length} MCQs into CBT Bank!`);
  };



window.renderCbtSectionsBar = function() {
    const bar = document.getElementById('cbt-section-tabs');
    if (!bar || !portalState.activeCbtTest) return;
    const sections = [...new Set(portalState.activeCbtTest.questions.map(q => q.section))];
    const currentSec = portalState.activeCbtTest.questions[activeCbtQIndex]?.section;
    activeCbtSectionName = currentSec || sections[0] || 'General';
    const strictLock = isCbtSectionAutoLockActive() && portalState.activeCbtTest.cbtSectionLockMode === 'locked';

    bar.innerHTML = sections.map(sec => {
      const firstIdx = portalState.activeCbtTest.questions.findIndex(q => q.section === sec);
      const isActive = sec === currentSec;
      const remSec = cbtSectionTimersMap[sec];
      const isExpired = portalState.activeCbtTest.cbtTimerMode === 'sectional' && remSec !== undefined && remSec <= 0;
      const isLockedOther = strictLock && !isActive && ((cbtSectionTimersMap[currentSec] || 0) > 0 || isExpired);

      let secTimerBadge = '';
      if (portalState.activeCbtTest.cbtTimerMode === 'sectional' && remSec !== undefined) {
        const mm = String(Math.floor(remSec / 60)).padStart(2, '0');
        const ss = String(remSec % 60).padStart(2, '0');
        secTimerBadge = ` <span style="font-size:10px; opacity:0.92;">(${mm}:${ss})</span>`;
      }
      const lockIcon = isExpired ? '🔒 Done ' : (isLockedOther ? '🔒 ' : '');
      return `<button type="button" class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}" style="${isLockedOther ? 'opacity:0.65; cursor:not-allowed;' : ''}" onclick="jumpToCbtQuestion(${firstIdx})">${lockIcon}${sec}${secTimerBadge}</button>`;
    }).join('');
  };

window.renderCbtPalette = function() {
    const grid = document.getElementById('cbt-palette-grid');
    if (!grid || !portalState.activeCbtTest) return;

    let countAns = 0, countNotAns = 0, countNotVis = 0, countRev = 0;
    const curSec = portalState.activeCbtTest.questions[activeCbtQIndex]?.section;
    const strictLock = isCbtSectionAutoLockActive() && portalState.activeCbtTest.cbtSectionLockMode === 'locked';

    grid.innerHTML = portalState.activeCbtTest.questions.map((qObj, idx) => {
      const st = cbtQuestionStatus[idx] || 'not_visited';
      let bg = '#94a3b8';
      if (st === 'answered') { bg = '#16a34a'; countAns++; }
      else if (st === 'not_answered') { bg = '#dc2626'; countNotAns++; }
      else if (st === 'review' || st === 'answered_review') { bg = '#7c3aed'; countRev++; }
      else { countNotVis++; }

      const isOtherSecLocked = strictLock && qObj.section !== curSec && ((cbtSectionTimersMap[curSec] || 0) > 0 || (cbtSectionTimersMap[qObj.section] !== undefined && cbtSectionTimersMap[qObj.section] <= 0));
      const confTag = cbtQuestionConfidenceMap[idx];
      const confDot = isOtherSecLocked ? '🔒' : (confTag === 'guess' ? '🤔' : (confTag === 'sure' ? '✓' : ''));
      const border = idx === activeCbtQIndex ? '3px solid var(--primary)' : 'none';
      return `<button type="button" onclick="jumpToCbtQuestion(${idx})" title="Q${idx + 1} (${qObj.section})" style="height: 36px; border-radius: 6px; background: ${bg}; color: #fff; font-weight: 800; font-size: 12px; border: ${border}; cursor: ${isOtherSecLocked ? 'not-allowed' : 'pointer'}; opacity: ${isOtherSecLocked ? '0.45' : '1'}; position: relative;">${idx + 1}<sup style="font-size:8px;">${confDot}</sup></button>`;
    }).join('');

    const elAns = document.getElementById('cbt-count-answered');
    const elNotAns = document.getElementById('cbt-count-not-answered');
    const elNotVis = document.getElementById('cbt-count-not-visited');
    const elRev = document.getElementById('cbt-count-review');

    if (elAns) elAns.innerText = countAns;
    if (elNotAns) elNotAns.innerText = countNotAns;
    if (elNotVis) elNotVis.innerText = countNotVis;
    if (elRev) elRev.innerText = countRev;
  };

window.jumpToCbtQuestion = function(idx) {
    if (!portalState.activeCbtTest || !portalState.activeCbtTest.questions[idx]) return;
    const targetSec = portalState.activeCbtTest.questions[idx].section;
    const curSec = portalState.activeCbtTest.questions[activeCbtQIndex]?.section;
    if (portalState.activeCbtTest.cbtTimerMode === 'sectional' && targetSec !== curSec) {
      if (cbtSectionTimersMap[targetSec] !== undefined && cbtSectionTimersMap[targetSec] <= 0) {
        showToast('🔒 Section "' + targetSec + '" timer has already expired and is locked!');
        return;
      }
      if (portalState.activeCbtTest.cbtSectionLockMode === 'locked' && (cbtSectionTimersMap[curSec] || 0) > 0) {
        const rem = cbtSectionTimersMap[curSec] || 0;
        const mm = String(Math.floor(rem / 60)).padStart(2, '0');
        const ss = String(rem % 60).padStart(2, '0');
        showToast('🔒 Section Auto-Lock Active: Next section "' + targetSec + '" cannot be opened until "' + curSec + '" timer (' + mm + ':' + ss + ') finishes!');
        return;
      }
      activeCbtSectionName = targetSec;
      cbtSecondsLeft = cbtSectionTimersMap[targetSec] || 0;
    }
    recordCurrentCbtQuestionTimeElapsed();
    activeCbtQIndex = idx;
    syncGlobalCbtWindowState();
    renderCbtQuestion();
  };

window.cbtSaveAndNext = function() {
    if (!portalState.activeCbtTest) return;
    if (cbtUserResponses[activeCbtQIndex] !== undefined) {
      cbtQuestionStatus[activeCbtQIndex] = 'answered';
    } else {
      cbtQuestionStatus[activeCbtQIndex] = 'not_answered';
    }
    const curSec = portalState.activeCbtTest.questions[activeCbtQIndex]?.section;
    const nextIdx = activeCbtQIndex + 1;
    if (nextIdx < portalState.activeCbtTest.questions.length) {
      const nextSec = portalState.activeCbtTest.questions[nextIdx]?.section;
      if (portalState.activeCbtTest.cbtTimerMode === 'sectional' && portalState.activeCbtTest.cbtSectionLockMode === 'locked' && nextSec !== curSec && (cbtSectionTimersMap[curSec] || 0) > 0) {
        const firstIdxOfCurSec = portalState.activeCbtTest.questions.findIndex(q => q.section === curSec);
        recordCurrentCbtQuestionTimeElapsed();
        activeCbtQIndex = firstIdxOfCurSec >= 0 ? firstIdxOfCurSec : activeCbtQIndex;
        syncGlobalCbtWindowState();
        renderCbtQuestion();
        showToast('🔒 End of "' + curSec + '" reached! Next section "' + nextSec + '" will unlock automatically when this section timer finishes.');
        return;
      }
      window.jumpToCbtQuestion(nextIdx);
    } else {
      recordCurrentCbtQuestionTimeElapsed();
      renderCbtQuestion();
    }
  };

window.cbtMarkForReviewAndNext = function() {
    if (!portalState.activeCbtTest) return;
    cbtQuestionStatus[activeCbtQIndex] = cbtUserResponses[activeCbtQIndex] !== undefined ? 'answered_review' : 'review';
    const curSec = portalState.activeCbtTest.questions[activeCbtQIndex]?.section;
    const nextIdx = activeCbtQIndex + 1;
    if (nextIdx < portalState.activeCbtTest.questions.length) {
      const nextSec = portalState.activeCbtTest.questions[nextIdx]?.section;
      if (portalState.activeCbtTest.cbtTimerMode === 'sectional' && portalState.activeCbtTest.cbtSectionLockMode === 'locked' && nextSec !== curSec && (cbtSectionTimersMap[curSec] || 0) > 0) {
        const firstIdxOfCurSec = portalState.activeCbtTest.questions.findIndex(q => q.section === curSec);
        recordCurrentCbtQuestionTimeElapsed();
        activeCbtQIndex = firstIdxOfCurSec >= 0 ? firstIdxOfCurSec : activeCbtQIndex;
        syncGlobalCbtWindowState();
        renderCbtQuestion();
        showToast('🔒 Marked for Review! Next section "' + nextSec + '" unlocks automatically when this section timer finishes.');
        return;
      }
      window.jumpToCbtQuestion(nextIdx);
    } else {
      recordCurrentCbtQuestionTimeElapsed();
      renderCbtQuestion();
    }
  };

export function buildCompleteRuleDetailsGridHtml(key, r) {
    if (!r) {
      return '<div style="grid-column:1/-1; padding:14px; color:#dc2626; font-weight:800; text-align:center; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:10px;">⚠️ No evaluation rule is uploaded for this section yet. Admin can upload/save a rule for this section in Admin → Evaluation Rules.</div>';
    }
    const dispName = r.examDisplayName || r.examTitle || key;
    const bsInfo = r.backspaceMode === 'limited'
      ? 'Limited (' + (r.backspaceLimit || 20) + ' Max)'
      : (r.backspaceMode === 'until_space' ? 'Current Word Only (Until Space)' : String(r.backspaceMode || 'on').toUpperCase());
    const wordMode = r.wordCountRule === '5stroke' ? '5 Strokes = 1 Word (SSC Standard)' : '1 Space = 1 Word (Actual Words)';
    const punctMode = r.punctRuleMode === 'fullstop_only'
      ? 'Full Stop (.) Only'
      : (r.punctRuleMode === 'ignore' ? 'Ignored (0 Deduction)' : 'All Punctuation Marks');
    const minInitialVal = parseInt(r.minInitialWordsShown || r.initialWords, 10) || 0;
    const minInitialUnit = r.wordCountRule === '5stroke' ? 'Strokes' : 'Words';
    const minInitialLabel = minInitialVal > 0 ? ('First ' + minInitialVal + ' ' + minInitialUnit) : 'Complete Passage';

    return `
      <div style="grid-column: 1 / -1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-bottom:1px solid rgba(79,70,229,0.25); padding-bottom:8px; margin-bottom:4px;">
        <div>
          <span style="background:#4f46e5; color:#fff; font-size:10px; font-weight:800; padding:2px 8px; border-radius:999px;">SELECTED EVALUATION RULE DETAILS (ALL 12 PARAMETERS)</span>
          <div style="font-size:14.5px; font-weight:900; color:var(--secondary); margin-top:3px;">⚖️ ${dispName}</div>
        </div>
        <span style="background:rgba(16,185,129,0.14); color:#059669; font-weight:800; font-size:11.5px; padding:4px 10px; border-radius:8px;">
          ⏱️ ${r.timeLimit || 10} Mins • 🎯 Pass Accuracy: ${r.passingAccuracy ?? 90}%
        </span>
      </div>
      <div><strong>1. Exam Name:</strong> ${dispName}</div>
      <div><strong>2. Duration &amp; Min Submit:</strong> ${r.timeLimit || 10} Mins (Min Submit: ${r.minSubmitTimeSec || r.minTimeSeconds || 0}s)</div>
      <div><strong>3. Word Count Rule:</strong> ${wordMode}</div>
      <div><strong>4. Total / Passing Marks:</strong> ${r.totalMarks ?? 100} / ${r.passingMarks ?? 40} Marks</div>
      <div><strong>5. Passing Accuracy:</strong> ${r.passingAccuracy ?? 90}% (Ignored Error Grace: ${r.ignoredErrorPct ?? r.ignoreErrorPct ?? 0}%)</div>
      <div><strong>6. Backspace Rule:</strong> ${bsInfo}</div>
      <div><strong>7. Highlight &amp; Auto-Scroll:</strong> Highlight ${String(r.highlightMode || 'on').toUpperCase()} • Scroll ${String(r.autoScrollMode || 'on').toUpperCase()}</div>
      <div><strong>8. Wrong Word / Omission:</strong> -${r.deductWrong ?? 1} / -${r.deductOmission ?? 1} (Multiplier: ${r.penaltyMultiplier ?? r.penaltyValue ?? 1}x)</div>
      <div><strong>9. Extra / Verb / Sing-Plural:</strong> -${r.deductExtraWord ?? 0.5} / -${r.deductVerb ?? r.deductVerbForm ?? 0.5} / -${r.deductSingularPlural ?? 0.5}</div>
      <div><strong>10. Punctuation Rule:</strong> ${punctMode} (-${r.deductPunctuation ?? 0.5})</div>
      <div><strong>11. Capital / Para Change:</strong> -${r.deductCapital ?? 0.25} / -${r.deductParaChange ?? r.deductParaNotChanged ?? 0.5}</div>
      <div><strong>12. Min Gross Stroke &amp; View:</strong> ${r.minGrossStrokePct ?? 0}% • ${minInitialLabel}</div>
    `;
  }

window.seedSampleSavedMcqsIfEmpty = function() {
    try {
      if (typeof window.getCbtBookmarkedMcqs === 'function') window.getCbtBookmarkedMcqs();
      if (typeof window.getCbtMistakeHistoryBank === 'function') window.getCbtMistakeHistoryBank();
    } catch (e) {}
  };

window.addCustomMcqToRevisionNotebook = function() {
    const q = (document.getElementById('custom-mcq-q')?.value || '').trim();
    const o0 = (document.getElementById('custom-mcq-opt0')?.value || '').trim();
    const o1 = (document.getElementById('custom-mcq-opt1')?.value || '').trim();
    const o2 = (document.getElementById('custom-mcq-opt2')?.value || '').trim() || 'None of the above';
    const o3 = (document.getElementById('custom-mcq-opt3')?.value || '').trim() || 'All of the above';
    const ans = parseInt(document.getElementById('custom-mcq-ans')?.value || '0', 10) || 0;
    const topic = (document.getElementById('custom-mcq-topic')?.value || 'Custom Revision').trim();
    const exp = (document.getElementById('custom-mcq-exp')?.value || 'Key concept saved for revision.').trim();
    if (!q || !o0 || !o1) {
      showToast('Please enter the question and at least Option A and Option B.');
      return;
    }
    const list = typeof window.getCbtBookmarkedMcqs === 'function' ? window.getCbtBookmarkedMcqs() : [];
    list.unshift({
      q,
      options: [o0, o1, o2, o3],
      answer: ans,
      explanation: exp,
      section: topic,
      subTopic: topic,
      testTitle: 'Personal Revision Note',
      savedAt: new Date().toLocaleDateString('en-IN'),
      srsIntervalDays: 1,
      nextReviewTs: Date.now()
    });
    if (typeof window.saveCbtBookmarkedMcqs === 'function') window.saveCbtBookmarkedMcqs(list);
    ['custom-mcq-q', 'custom-mcq-opt0', 'custom-mcq-opt1', 'custom-mcq-opt2', 'custom-mcq-opt3', 'custom-mcq-exp'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const form = document.getElementById('cbt-rev-add-custom-form');
    if (form) form.style.display = 'none';
    window.renderDedicatedCbtRevisionTab();
    showToast('Custom MCQ saved to your Saved Bookmarks.');
  };

window.toggleRevisionItemMastered = function(src, idx) {
    const isBm = src === 'bm';
    const list = isBm
      ? (typeof window.getCbtBookmarkedMcqs === 'function' ? window.getCbtBookmarkedMcqs() : [])
      : (typeof window.getCbtMistakeHistoryBank === 'function' ? window.getCbtMistakeHistoryBank() : []);
    if (!list[idx]) return;
    const currentlyMastered = Number(list[idx].srsIntervalDays || 1) >= 7;
    const nextDays = currentlyMastered ? 1 : 14;
    list[idx].srsIntervalDays = nextDays;
    list[idx].nextReviewTs = Date.now() + nextDays * 86400000;
    if (isBm && typeof window.saveCbtBookmarkedMcqs === 'function') window.saveCbtBookmarkedMcqs(list);
    else if (!isBm && typeof window.saveCbtMistakeHistoryBank === 'function') window.saveCbtMistakeHistoryBank(list);
    window.renderDedicatedCbtRevisionTab();
    showToast(currentlyMastered ? 'Moved question back to Needs Review.' : 'Marked question as Mastered!');
  };

window.renderDedicatedCbtRevisionTab = function() {
    if (typeof window.renderCbtSavedMcqsNotebookList === 'function') {
      window.renderCbtSavedMcqsNotebookList();
    }

    const bookmarks = typeof window.getCbtBookmarkedMcqs === 'function' ? window.getCbtBookmarkedMcqs() : [];
    const mistakes = typeof window.getCbtMistakeHistoryBank === 'function' ? window.getCbtMistakeHistoryBank() : [];
    const mode = window.__cbtNotebookMode || 'bookmarks';
    const totalAll = bookmarks.length + mistakes.length;

    const bmBtn = document.getElementById('rev-tab-btn-bookmarks');
    const fcBtn = document.getElementById('rev-tab-btn-flashcards');
    const allBtn = document.getElementById('rev-tab-btn-all');
    if (bmBtn) {
      bmBtn.className = mode === 'bookmarks' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
      bmBtn.textContent = `Saved Bookmarks (${bookmarks.length})`;
    }
    if (fcBtn) {
      fcBtn.className = mode === 'flashcards' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
      fcBtn.textContent = `Wrong Answers (${mistakes.length})`;
    }
    if (allBtn) {
      allBtn.className = mode === 'all' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
      allBtn.textContent = `All Questions (${totalAll})`;
    }

    const masteredCount = [...bookmarks, ...mistakes].filter(x => Number(x.srsIntervalDays || 1) >= 7).length;
    const needsReviewCount = Math.max(0, totalAll - masteredCount);

    const kpiStrip = document.getElementById('cbt-revision-kpi-strip');
    if (kpiStrip) {
      kpiStrip.innerHTML = `
        <div style="padding:10px 14px; border-radius:10px; background:rgba(124,58,237,0.06); border:1px solid rgba(124,58,237,0.22);">
          <div style="font-size:11px; color:var(--text-muted); font-weight:700;">Saved Bookmarks</div>
          <div style="font-size:21px; font-weight:900; color:#7c3aed; font-variant-numeric:tabular-nums;">${bookmarks.length}</div>
        </div>
        <div style="padding:10px 14px; border-radius:10px; background:rgba(225,29,72,0.06); border:1px solid rgba(225,29,72,0.22);">
          <div style="font-size:11px; color:var(--text-muted); font-weight:700;">Wrong Answers Logged</div>
          <div style="font-size:21px; font-weight:900; color:#e11d48; font-variant-numeric:tabular-nums;">${mistakes.length}</div>
        </div>
        <div style="padding:10px 14px; border-radius:10px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25);">
          <div style="font-size:11px; color:var(--text-muted); font-weight:700;">Needs Review</div>
          <div style="font-size:21px; font-weight:900; color:#d97706; font-variant-numeric:tabular-nums;">${needsReviewCount}</div>
        </div>
        <div style="padding:10px 14px; border-radius:10px; background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.22);">
          <div style="font-size:11px; color:var(--text-muted); font-weight:700;">Mastered</div>
          <div style="font-size:21px; font-weight:900; color:#059669; font-variant-numeric:tabular-nums;">${masteredCount}</div>
        </div>
      `;
    }

    const inlineList = document.getElementById('cbt-revision-inline-list');
    if (!inlineList) return;

    let rawItems = [];
    if (mode === 'bookmarks') {
      rawItems = bookmarks.map((item, i) => Object.assign({}, item, { _src: 'bm', _idx: i }));
    } else if (mode === 'flashcards') {
      rawItems = mistakes.map((item, i) => Object.assign({}, item, { _src: 'err', _idx: i }));
    } else {
      rawItems = [
        ...bookmarks.map((item, i) => Object.assign({}, item, { _src: 'bm', _idx: i })),
        ...mistakes.map((item, i) => Object.assign({}, item, { _src: 'err', _idx: i }))
      ];
    }

    const q = (document.getElementById('cbt-rev-search-input')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('cbt-rev-srs-filter')?.value || 'ALL';

    if (q) {
      rawItems = rawItems.filter(item =>
        String(item.q || '').toLowerCase().includes(q) ||
        String(item.section || '').toLowerCase().includes(q) ||
        String(item.subTopic || '').toLowerCase().includes(q) ||
        String(item.explanation || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'NEEDS_REVIEW' || statusFilter === 'DUE') {
      rawItems = rawItems.filter(item => Number(item.srsIntervalDays || 1) < 7);
    } else if (statusFilter === 'MASTERED') {
      rawItems = rawItems.filter(item => Number(item.srsIntervalDays || 1) >= 7);
    }

    if (rawItems.length === 0) {
      const emptyMsg = mode === 'flashcards'
        ? 'No wrong answers logged yet. Take a CBT Mock Exam and any wrong or guessed question will appear here automatically.'
        : 'No saved questions here yet. Click "Add Custom MCQ" above or star any question during a CBT Mock Exam.';
      inlineList.innerHTML = `<div style="padding:28px; text-align:center; color:var(--text-muted); border:1px dashed var(--border); border-radius:12px; font-size:12.5px;">${emptyMsg}</div>`;
      return;
    }

    inlineList.innerHTML = rawItems.map((item, cardIdx) => {
      const opts = Array.isArray(item.options) ? item.options : [];
      const correctIdx = Number(item.answer ?? 0);
      const isMastered = Number(item.srsIntervalDays || 1) >= 7;
      const isErr = item._src === 'err';
      const cardDomId = `rev-interactive-card-${item._src}-${item._idx}-${cardIdx}`;
      const wrongTimes = Number(item.wrongCount ?? (isErr ? 1 : 0)) || 0;
      const correctTimes = Number(item.correctCount) || 0;
      const attemptTimes = Number(item.attemptCount) || (wrongTimes + correctTimes);

      return `
        <div id="${cardDomId}" style="background:var(--background); border:1px solid var(--border); border-left:4px solid ${isMastered ? '#10b981' : (isErr ? '#e11d48' : '#7c3aed')}; border-radius:12px; padding:14px 16px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; font-size:11.5px; font-variant-numeric:tabular-nums;">
              <strong style="color:${isErr ? '#be123c' : '#6d28d9'};">${isErr ? (item.confidenceTag === 'guess' ? '50-50 Guess' : 'Wrong Answer') : 'Saved Bookmark'}</strong>
              <span style="color:var(--text-muted);">&middot;</span>
              <span style="color:var(--secondary); font-weight:700;">${window.escapeHtml(item.section || 'General')}${item.subTopic && item.subTopic !== item.section ? ' / ' + window.escapeHtml(item.subTopic) : ''}</span>
              <span style="color:var(--text-muted);">&middot;</span>
              <span style="font-weight:800; color:${isMastered ? '#059669' : '#d97706'};">${isMastered ? 'Mastered' : 'Needs Review'}</span>
              <span style="color:var(--text-muted);">&middot;</span>
              <span class="rev-item-stats-readout" style="display:inline-flex; gap:8px; align-items:center; font-weight:800;">
                <span style="color:#dc2626;">Wrong: ${wrongTimes}x</span>
                <span style="color:#059669;">Correct: ${correctTimes}x</span>
                <span style="color:var(--text-muted);">Answered: ${attemptTimes}x</span>
              </span>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" class="btn btn-sm ${isMastered ? 'btn-secondary' : 'btn-success'}" style="padding:4px 10px; font-size:11px; min-height:28px;" onclick="window.toggleRevisionItemMastered('${item._src}', ${item._idx})">
                <i class="fa-solid ${isMastered ? 'fa-rotate-left' : 'fa-check'}"></i> ${isMastered ? 'Mark Needs Review' : 'Mark Mastered'}
              </button>
              <button type="button" class="btn btn-sm btn-danger" style="padding:4px 8px; font-size:11px; min-height:28px;" onclick="window.deleteRevisionItem('${item._src}', ${item._idx})" title="Delete question">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>

          <div style="font-size:14px; font-weight:800; color:var(--secondary); line-height:1.45;">
            Q${cardIdx + 1}. ${window.escapeHtml(item.q || '')}
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px;">
            ${opts.map((optText, oIdx) => `
              <button type="button"
                      onclick="window.checkRevisionMcqOption('${cardDomId}', ${oIdx}, ${correctIdx}, '${item._src}', ${item._idx})"
                      data-opt-idx="${oIdx}"
                      style="text-align:left; padding:9px 12px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--secondary); font-size:12.5px; font-weight:600; cursor:pointer; transition:all 0.15s;">
                <strong>(${String.fromCharCode(65 + oIdx)})</strong> ${window.escapeHtml(optText || '')}
              </button>
            `).join('')}
          </div>

          <div class="rev-exp-box" style="display:none; padding:10px 12px; border-radius:8px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); font-size:12px; color:var(--secondary);">
            <strong style="color:#059669;">Correct Answer: Option (${String.fromCharCode(65 + correctIdx)}) — ${window.escapeHtml(opts[correctIdx] || '')}</strong>
            <div style="margin-top:4px; color:var(--text-muted);">${window.escapeHtml(item.explanation || 'Review this concept carefully for upcoming exams.')}</div>
          </div>
          <div>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 10px;" onclick="const b=document.querySelector('#${cardDomId} .rev-exp-box'); if(b) b.style.display = b.style.display==='none' ? 'block' : 'none';">
              Show / Hide Solution
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

window.checkRevisionMcqOption = function(cardDomId, chosenIdx, correctIdx, src, itemIdx) {
    const card = document.getElementById(cardDomId);
    if (!card) return;
    card.querySelectorAll('button[data-opt-idx]').forEach(btn => {
      const idx = Number(btn.getAttribute('data-opt-idx'));
      if (idx === correctIdx) {
        btn.style.background = 'rgba(16,185,129,0.18)';
        btn.style.borderColor = '#10b981';
        btn.style.color = '#065f46';
      } else if (idx === chosenIdx && chosenIdx !== correctIdx) {
        btn.style.background = 'rgba(239,68,68,0.16)';
        btn.style.borderColor = '#ef4444';
        btn.style.color = '#991b1b';
      }
    });
    const exp = card.querySelector('.rev-exp-box');
    if (exp) exp.style.display = 'block';

    // Record answered attempt count (Wrong vs Correct) and persist
    if (src && itemIdx !== undefined && itemIdx !== null) {
      const isRight = Number(chosenIdx) === Number(correctIdx);
      const list = (src === 'bm')
        ? (typeof window.getCbtBookmarkedMcqs === 'function' ? window.getCbtBookmarkedMcqs() : [])
        : (typeof window.getCbtMistakeHistoryBank === 'function' ? window.getCbtMistakeHistoryBank() : []);
      const target = list[itemIdx];
      if (target) {
        const curWrong = Number(target.wrongCount ?? (src === 'err' ? 1 : 0)) || 0;
        const curCorrect = Number(target.correctCount) || 0;
        target.wrongCount = isRight ? curWrong : curWrong + 1;
        target.correctCount = isRight ? curCorrect + 1 : curCorrect;
        target.attemptCount = (Number(target.attemptCount) || (curWrong + curCorrect)) + 1;
        target.lastAttemptedAt = new Date().toISOString();
        if (src === 'bm' && typeof window.saveCbtBookmarkedMcqs === 'function') {
          window.saveCbtBookmarkedMcqs(list);
        } else if (src === 'err' && typeof window.saveCbtMistakeHistoryBank === 'function') {
          window.saveCbtMistakeHistoryBank(list);
        }
        const statsEl = card.querySelector('.rev-item-stats-readout');
        if (statsEl) {
          statsEl.innerHTML = `
            <span style="color:#dc2626;">Wrong: ${target.wrongCount}x</span>
            <span style="color:#059669;">Correct: ${target.correctCount}x</span>
            <span style="color:var(--text-muted);">Answered: ${target.attemptCount}x</span>
          `;
        }
      }
    }
  };

window.updateRevisionItemSrs = function(src, idx, days) {
    const nextTs = Date.now() + days * 86400000;
    if (src === 'bm') {
      const list = typeof window.getCbtBookmarkedMcqs === 'function' ? window.getCbtBookmarkedMcqs() : [];
      if (list[idx]) {
        list[idx].srsIntervalDays = days;
        list[idx].nextReviewTs = nextTs;
        window.saveCbtBookmarkedMcqs(list);
      }
    } else {
      const list = typeof window.getCbtMistakeHistoryBank === 'function' ? window.getCbtMistakeHistoryBank() : [];
      if (list[idx]) {
        list[idx].srsIntervalDays = days;
        list[idx].nextReviewTs = nextTs;
        window.saveCbtMistakeHistoryBank(list);
      }
    }
    window.renderDedicatedCbtRevisionTab();
    showToast(`Updated review schedule to ${days} day(s).`);
  };

window.deleteRevisionItem = function(src, idx) {
    if (src === 'bm') {
      const list = typeof window.getCbtBookmarkedMcqs === 'function' ? window.getCbtBookmarkedMcqs() : [];
      list.splice(idx, 1);
      window.saveCbtBookmarkedMcqs(list);
    } else {
      const list = typeof window.getCbtMistakeHistoryBank === 'function' ? window.getCbtMistakeHistoryBank() : [];
      list.splice(idx, 1);
      window.saveCbtMistakeHistoryBank(list);
    }
    window.renderDedicatedCbtRevisionTab();
    showToast('Removed question from Revision Notebook.');
  };

export function removeUselessPreTranscribeToolbars() {
    document.querySelectorAll('.rp-pre-transcribe-toolbar').forEach(el => el.remove());
  }
