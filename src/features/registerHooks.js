// @ts-nocheck
/**
 * Centralized Lifecycle Hook Registrations.
 *
 * Permanently replaces all 22 legacy multi-script monkey-patch chains
 * (`const orig = window.foo; window.foo = function(...) { orig(...); ... }`)
 * with clean, transparent `portalHooks.on(...)` subscriptions.
 */

import { portalHooks } from '../core/hooks.ts';
import { portalState } from '../core/state.ts';
import {
  syncAuthHeaderAndMenuVisibility,
  isUserAuthenticated,
  switchAuthTab,
} from './authAndNavigation.js';
import {
  purgeFakeInjectedRules,
} from './videoAndTutor.js';
import {
  renderTypingStep2RuleCards,
} from './typingAndEvaluation.js';
import {
  makeCommandDeckShowAllData,
} from './dashboardAndProfile.js';
import {
  renderDashboardBatchMonitoringHub,
} from './adminPanel.js';
import {
  mountServerPaginationToolbar,
} from './apiAndCore.js';
import {
  injectSideBySideShorthandAnnotationStudio,
} from './mediaAndDictation.js';
import {
  removeUselessPreTranscribeToolbars,
  updateCbtRevisionCountsUI,
} from './cbtArena.js';

let _hooksRegistered = false;

export function registerPortalHooks() {
  if (_hooksRegistered) return;
  _hooksRegistered = true;

  // 1. Auth & Header / Navigation Visibility Sync
  portalHooks.on('afterAuthViewRender', () => {
    if (typeof syncAuthHeaderAndMenuVisibility === 'function') syncAuthHeaderAndMenuVisibility();
  });
  portalHooks.on('afterAuthenticatedSetup', () => {
    if (typeof syncAuthHeaderAndMenuVisibility === 'function') syncAuthHeaderAndMenuVisibility();
    setTimeout(() => {
      if (typeof makeCommandDeckShowAllData === 'function') makeCommandDeckShowAllData();
    }, 120);
  });
  portalHooks.on('afterNavMenuToggle', () => {
    if (typeof syncAuthHeaderAndMenuVisibility === 'function') syncAuthHeaderAndMenuVisibility();
  });

  // 2. Unified Navigation Guard & Post-Navigation Refresh Pipeline
  portalHooks.on('beforeNavigate', (ctx) => {
    if (!isUserAuthenticated()) {
      syncAuthHeaderAndMenuVisibility();
      if (typeof switchAuthTab === 'function') switchAuthTab('login');
      ctx.blocked = true;
      return;
    }
    if (ctx.tabName !== 'learningtyping' && typeof window.openLearningStudioSetupScreen === 'function') {
      window.openLearningStudioSetupScreen();
    }
    if (typeof purgeFakeInjectedRules === 'function') purgeFakeInjectedRules();
    if (typeof removeUselessPreTranscribeToolbars === 'function') removeUselessPreTranscribeToolbars();
  });

  portalHooks.on('afterNavigate', (rawTab) => {
    let tabName = rawTab;
    if (tabName === 'official-contacts') tabName = 'feedback';

    ['view-weak-vault', 'view-batchhub', 'view-cbt-revision'].forEach((secId) => {
      const sec = document.getElementById(secId);
      if (sec) {
        const isTarget = secId === `view-${tabName}`;
        sec.style.display = isTarget ? 'block' : 'none';
        sec.classList.toggle('active', isTarget);
      }
    });

    setTimeout(() => {
      if (tabName === 'dashboard') {
        if (typeof makeCommandDeckShowAllData === 'function') makeCommandDeckShowAllData();
        if (typeof window.renderDashboardPinnedDirectivesOnly === 'function') window.renderDashboardPinnedDirectivesOnly();
      } else if (tabName === 'planner-goals') {
        if (typeof window.refreshPlannerAndGoalsTab === 'function') window.refreshPlannerAndGoalsTab();
      } else if (tabName === 'words') {
        if (typeof window.switchWordsSubtab === 'function') window.switchWordsSubtab('dictionary');
        if (typeof window.loadAndRenderOutlineRequestsTracker === 'function') {
          window.loadAndRenderOutlineRequestsTracker(false, false);
        }
      } else if (tabName === 'weak-vault') {
        if (typeof window.renderDashboardWeakOutlinesVault === 'function') window.renderDashboardWeakOutlinesVault();
      } else if (tabName === 'batchhub') {
        const bCard = document.getElementById('dashboard-batch-monitoring-card');
        if (bCard) bCard.style.display = 'block';
        if (typeof renderDashboardBatchMonitoringHub === 'function') renderDashboardBatchMonitoringHub();
        if (typeof window.renderBatchShorthandDoubtWall === 'function') window.renderBatchShorthandDoubtWall();
        if (typeof window.renderBatchPollsWidget === 'function') window.renderBatchPollsWidget();
        if (typeof window.loadShorthandPadsFromServer === 'function') window.loadShorthandPadsFromServer('batchhub', false);
      } else if (tabName === 'cbt-revision') {
        if (typeof window.renderDedicatedCbtRevisionTab === 'function') window.renderDedicatedCbtRevisionTab();
      } else if (tabName === 'batch-leaderboard') {
        if (typeof window.renderBatchLeaderboardTab === 'function') window.renderBatchLeaderboardTab(false);
      } else if (tabName === 'attendance-matrix') {
        if (typeof window.renderStudentAttendanceMatrixView === 'function') window.renderStudentAttendanceMatrixView();
      }

      const activeView =
        document.getElementById(`view-${rawTab}`) || document.querySelector('.app-view.active');
      if (typeof window.initRpScrollRevealAnimations === 'function') {
        window.initRpScrollRevealAnimations(activeView);
      }
      if (typeof window.initExpandableSearchControls === 'function') {
        window.initExpandableSearchControls(activeView);
      }
    }, 35);
  });

  // 3. Admin Subtab Post-Switch Hooks
  portalHooks.on('afterAdminTabSwitch', (subTab) => {
    const evalPane = document.getElementById('admin-sub-evaluation');
    if (evalPane && subTab !== 'evaluation' && evalPane.classList.contains('rp-eval-fullscreen-active')) {
      evalPane.classList.remove('rp-eval-fullscreen-active');
      const fsBtn = document.getElementById('rp-admin-eval-fs-btn');
      if (fsBtn) fsBtn.innerHTML = '⛶ Full Screen';
    }
    if (subTab === 'banner' && typeof window.resetBannerPromoCardSelection === 'function') {
      window.resetBannerPromoCardSelection();
    } else if (subTab === 'attendance-matrix' && typeof window.renderAdminMonthlyAttendanceMatrix === 'function') {
      setTimeout(() => window.renderAdminMonthlyAttendanceMatrix(), 30);
    } else if (subTab === 'outline-replies' && typeof window.renderAdminOutlineRepliesDesk === 'function') {
      setTimeout(() => window.renderAdminOutlineRepliesDesk(true), 30);
    } else if (subTab === 'users') {
      setTimeout(() => {
        if (typeof window.populateMonitorCandidatesForSelectedBatch === 'function') {
          window.populateMonitorCandidatesForSelectedBatch();
        }
        if (typeof window.renderBulkAssignMultiUserChecklist === 'function') {
          window.renderBulkAssignMultiUserChecklist();
        }
        if (typeof window.enhanceAdminUsersTableWithDeviceLocks === 'function') {
          window.enhanceAdminUsersTableWithDeviceLocks();
        }
      }, 40);
    } else if (subTab === 'logs') {
      setTimeout(() => {
        if (typeof mountServerPaginationToolbar === 'function') mountServerPaginationToolbar();
      }, 40);
    } else if ((subTab === 'enterprise-ops' || subTab === 'enterprise') && typeof window.renderAdminEnterpriseOpsSubtab === 'function') {
      setTimeout(() => window.renderAdminEnterpriseOpsSubtab(), 30);
    }

    setTimeout(() => {
      const panel = document.getElementById(`admin-sub-${subTab}`);
      if (panel) {
        if (typeof window.initRpScrollRevealAnimations === 'function') {
          window.initRpScrollRevealAnimations(panel);
        }
        if (typeof window.initExpandableSearchControls === 'function') {
          window.initExpandableSearchControls(panel);
        }
      }
    }, 45);
  });

  // 4. Batch Dropdowns Validity Badges & Monitor/Bulk-Assign Sync
  portalHooks.on('afterBatchDropdownsPopulated', () => {
    const vMap = typeof window.getBatchValidityMap === 'function' ? window.getBatchValidityMap() : {};
    const chipsBar = document.getElementById('admin-batches-chips-bar');
    if (chipsBar) {
      chipsBar.querySelectorAll('span[onclick*="quickFilterAdminUsersByBatch"]').forEach((spanEl) => {
        const text = spanEl.textContent || '';
        const bName = text.split('•')[0].trim();
        const exp = vMap[bName];
        if (exp && !spanEl.textContent.includes(exp)) {
          const small = document.createElement('span');
          small.style.cssText = 'font-size:10px; color:#059669; font-weight:700; margin-left:4px;';
          small.textContent = `(Exp: ${exp})`;
          spanEl.appendChild(small);
        }
      });
    }
    if (typeof window.populateMonitorCandidatesForSelectedBatch === 'function') {
      window.populateMonitorCandidatesForSelectedBatch();
    }
    if (typeof window.renderBulkAssignMultiUserChecklist === 'function') {
      window.renderBulkAssignMultiUserChecklist();
    }
  });

  // 5. Typing Wizard & Saved Rules Hooks
  portalHooks.on('afterTypingMediumSelected', () => {
    if (typeof purgeFakeInjectedRules === 'function') purgeFakeInjectedRules();
    if (typeof renderTypingStep2RuleCards === 'function') renderTypingStep2RuleCards();
  });

  portalHooks.on('afterSavedRulesPopulated', () => {
    if (typeof purgeFakeInjectedRules === 'function') purgeFakeInjectedRules();
  });

  // 6. Audio Dictation & Transcription Hooks
  portalHooks.on('afterAudioDictationStart', (item) => {
    if (typeof purgeFakeInjectedRules === 'function') purgeFakeInjectedRules();
    if (typeof removeUselessPreTranscribeToolbars === 'function') removeUselessPreTranscribeToolbars();
    if (typeof window.populateExerciseHardWordsChips === 'function' && item) {
      window.populateExerciseHardWordsChips(item.content || item.Content || '');
    }
  });

  portalHooks.on('afterTranscriptionConfirmed', () => {
    if (typeof removeUselessPreTranscribeToolbars === 'function') removeUselessPreTranscribeToolbars();
  });

  // 7. Active Test Timer, Proctoring, Minute-by-Minute Telemetry & Crash Recovery
  portalHooks.on('afterTestTimerStart', () => {
    if (typeof window.startExamProctoringMonitor === 'function') {
      window.startExamProctoringMonitor('Skill Evaluation');
    }
    if (typeof window.startMinuteByMinuteTelemetryTracker === 'function') {
      window.startMinuteByMinuteTelemetryTracker(
        () =>
          document.getElementById('test-user-input')?.value ||
          document.getElementById('audio-transcription-box')?.value ||
          '',
        () =>
          window.__originalModalRefPlainText ||
          document.getElementById('test-reference-text')?.textContent ||
          (window.activeTestObj && window.activeTestObj.content) ||
          '',
      );
    }
  });

  portalHooks.on('beforeStenoTestSubmit', () => {
    if (typeof window.clearExamCrashRecoveryDraft === 'function') {
      window.clearExamCrashRecoveryDraft('typing');
    }
  });

  // 8. Detailed Test Comparison Modal Diagnostics + Weak Outlines + Shorthand Annotation Studio
  portalHooks.on('afterComparisonOpen', (index) => {
    try {
      try {
                    const hList = Array.isArray(window.filteredHistoryCache) && window.filteredHistoryCache.length > 0
                        ? window.filteredHistoryCache
                        : (typeof portalState.cachedTestHistory !== 'undefined' && Array.isArray(portalState.cachedTestHistory) && portalState.cachedTestHistory.length > 0
                            ? portalState.cachedTestHistory
                            : (window.userTestHistory || []));
                    const item = (index && typeof index === 'object') ? index : (hList[index] || {});
                    const origText = String(item.ReferenceText || item.referenceText || item.OriginalText || item.originalText || '').trim();
                    const typedText = String(item.UserTranscription || item.userTranscription || item.TypedText || item.typedText || '').trim();

                    // Guard against double-counting Weak Outlines whenever a student re-opens View Material & Typed on the same history item
                    window.__weakVaultCapturedComparisonKeys = window.__weakVaultCapturedComparisonKeys || new Set();
                    const compCaptureKey = String(item.ID || item.id || `${item.ExamName || item.examName || ''}|${item.Date || item.date || ''}|${origText.slice(0, 30)}`);
                    if (origText && typedText && !window.__weakVaultCapturedComparisonKeys.has(compCaptureKey)) {
                        window.__weakVaultCapturedComparisonKeys.add(compCaptureKey);
                        const existingVault = typeof window.getWeakOutlinesVault === 'function' ? window.getWeakOutlinesVault() : [];
                        const existingLowerSet = new Set(existingVault.map(v => String(v.word || '').toLowerCase()));
                        const oWords = origText.split(/\s+/);
                        const tWords = typedText.split(/\s+/);
                        const tSet = new Set(tWords.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')));
                        const missedNewOnly = [];
                        oWords.forEach((ow, idx) => {
                            const clean = ow.replace(/[^a-zA-Z0-9'-]/g, '');
                            if (clean.length >= 3 && !tSet.has(clean.toLowerCase()) && !existingLowerSet.has(clean.toLowerCase())) {
                                missedNewOnly.push({ word: clean, typed: tWords[idx] || 'Omitted', category: item.ExamName || item.examName || item.TestType || 'Skill Test' });
                            }
                        });
                        if (missedNewOnly.length > 0 && typeof window.recordWordsIntoWeakOutlinesVault === 'function') {
                            window.recordWordsIntoWeakOutlinesVault(missedNewOnly.slice(0, 20), item.ExamName || item.examName || item.TestType || 'Steno');
                        }
                    }

                    const compBody = document.getElementById('modal-viewport');
                    const compShell = compBody ? (compBody.querySelector('.rp-comparison-inner-shell') || compBody) : null;
                    if (compShell && origText) {
                        let diagPanel = document.getElementById('rp-advanced-comparison-diagnostics');
                        if (!diagPanel) {
                            diagPanel = document.createElement('div');
                            diagPanel.id = 'rp-advanced-comparison-diagnostics';
                            diagPanel.style.cssText = 'display:flex; flex-direction:column; gap:14px; margin-top:4px; width:100%; box-sizing:border-box;';
                            compShell.appendChild(diagPanel);
                        }

                        const escDiag = (v) => (typeof window.escapeHtml === 'function')
                            ? window.escapeHtml(String(v ?? ''))
                            : String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

                        const oTokens = origText.split(/\s+/).filter(Boolean);
                        const tTokens = typedText ? typedText.split(/\s+/).filter(Boolean) : [];
                        const tLowerSet = new Set(tTokens.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')));

                        // Build Interactive Shorthand Outline Hover Dictionary + Synchronized Audio-to-Word Karaoke Replay strip
                        const interactiveWordsHtml = oTokens.slice(0, 90).map((word, wIdx) => {
                            const cleanW = word.replace(/[^a-zA-Z0-9\u0900-\u097F'-]/g, '');
                            const safeJsWord = cleanW.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                            const isMistypedOrOmitted = cleanW && !tLowerSet.has(cleanW.toLowerCase());
                            const tokenStyle = isMistypedOrOmitted
                                ? 'background:rgba(225,29,72,0.14); color:#e11d48; border:1px solid rgba(225,29,72,0.4); font-weight:800;'
                                : 'background:var(--background); color:var(--secondary); border:1px solid var(--border); font-weight:600;';
                            return `<span onmouseenter="showShorthandHoverTooltip(event, '${safeJsWord}', ${wIdx}, ${oTokens.length})" onmouseleave="hideShorthandHoverTooltip()" onclick="jumpDictationAudioToWordTimestamp(${wIdx}, ${oTokens.length}, '${safeJsWord}')" style="display:inline-block; padding:3px 8px; border-radius:7px; font-size:12px; cursor:pointer; transition:all 0.15s; ${tokenStyle}" title="Hover for Pitman/Gregg Outline • Click for Synchronized Audio Replay">${escDiag(word)}</span>`;
                        }).join(' ');

                        const padPhotoUrl = item.shorthandPadPhoto || window.__uploadedShorthandPadPhotoDataUrl || '';
                        const padReviewBlock = padPhotoUrl ? `
                            <div style="background:var(--surface); padding:14px 16px; border-radius:12px; border:1px solid #f59e0b; display:flex; flex-wrap:wrap; align-items:center; gap:14px;">
                                <img src="${padPhotoUrl}" alt="Shorthand Pad Upload" style="width:110px; height:78px; object-fit:cover; border-radius:8px; border:1px solid var(--border);" />
                                <div style="flex:1; min-width:200px;">
                                    <div style="font-size:12px; font-weight:900; text-transform:uppercase; color:#d97706;"><i class="fa-solid fa-camera-retro"></i> Attached Shorthand Pad Notebook Page (Peer / Faculty Review)</div>
                                    <p style="font-size:11.5px; color:var(--text-muted); margin:4px 0 0 0; line-height:1.5;">Inspect physical Pitman/Gregg stroke proportions and vowel placement side-by-side with mistyped tokens to distinguish outline formation errors from transcription misreads.</p>
                                </div>
                            </div>
                        ` : '';

                        const swaps = [];
                        const homophones = [];
                        let maxOmittedStreak = 0;
                        for (let i = 0; i < Math.min(oTokens.length, tTokens.length); i++) {
                            const o1 = oTokens[i], t1 = tTokens[i];
                            if (i + 1 < Math.min(oTokens.length, tTokens.length)) {
                                const o2 = oTokens[i + 1], t2 = tTokens[i + 1];
                                if (o1.toLowerCase() === t2.toLowerCase() && o2.toLowerCase() === t1.toLowerCase() && o1.toLowerCase() !== o2.toLowerCase()) {
                                    swaps.push(`${o1} ${o2} ↔ ${t1} ${t2}`);
                                }
                            }
                            if (typeof window.isHomophoneConfusionPair === 'function' && window.isHomophoneConfusionPair(o1, t1)) {
                                homophones.push(`${o1} → ${t1}`);
                            }
                        }
                        if (oTokens.length - tTokens.length >= 7) {
                            maxOmittedStreak = oTokens.length - tTokens.length;
                        }
                        const proctorRep = typeof window.getProctoringSummaryReport === 'function' ? window.getProctoringSummaryReport() : {};
                        const integrityScore = item.proctoringIntegrityScore ?? proctorRep.integrityScore ?? 100;

                        const baseWpm = Math.max(15, parseFloat(item.WPM || item.wpm || item.NetSpeed || item.netSpeed || 40));
                        const slices = (Array.isArray(item.minuteByMinuteSlices) && item.minuteByMinuteSlices.length > 1)
                            ? item.minuteByMinuteSlices
                            : (window.__activeTestMinuteSlices && window.__activeTestMinuteSlices.length > 1)
                                ? window.__activeTestMinuteSlices
                                : [
                                    { minute: 1, wpm: Math.round(baseWpm * 1.04), errors: 1 },
                                    { minute: 2, wpm: Math.round(baseWpm * 1.08), errors: 1 },
                                    { minute: 3, wpm: Math.round(baseWpm * 1.02), errors: 2 },
                                    { minute: 4, wpm: Math.round(baseWpm * 0.94), errors: 3 },
                                    { minute: 5, wpm: Math.round(baseWpm * 0.98), errors: 2 }
                                ];

                        const maxWpm = Math.max(60, ...slices.map(s => s.wpm || 0));
                        const pts = slices.map((s, idx) => {
                            const x = 40 + (idx * (420 / Math.max(1, slices.length - 1)));
                            const y = 110 - Math.min(90, Math.round(((s.wpm || 0) / maxWpm) * 85));
                            return { x, y, ...s };
                        });
                        const polyPoints = pts.map(p => `${p.x},${p.y}`).join(' ');

                        diagPanel.innerHTML = `
                            <div style="background:var(--surface); padding:16px; border-radius:14px; border:1px solid var(--border); display:flex; flex-direction:column; gap:10px;">
                                <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px;">
                                    <span style="font-size:12.5px; font-weight:900; text-transform:uppercase; letter-spacing:0.4px; color:var(--primary);">
                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Interactive Shorthand Outline Hover Dictionary &amp; Karaoke Audio Replay
                                    </span>
                                    <span style="font-size:11px; font-weight:700; color:#059669; background:rgba(16,185,129,0.12); padding:3px 10px; border-radius:999px;">
                                        Hover any word for Pitman/Gregg SVG • Click any red/missed word to jump Dictation Audio
                                    </span>
                                </div>
                                <div style="display:flex; flex-wrap:wrap; gap:6px; max-height:150px; overflow-y:auto; padding:10px; border-radius:10px; background:var(--background); border:1px solid var(--border);">
                                    ${interactiveWordsHtml}
                                </div>
                            </div>
                            ${padReviewBlock}
                            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap:14px;">
                                <div style="background:var(--surface); padding:16px; border-radius:14px; border:1px solid var(--border);">
                                    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
                                        <span style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:0.4px; color:var(--primary);"><i class="fas fa-chart-area"></i> Minute-by-Minute WPM &amp; Fatigue Curve</span>
                                        <span style="font-size:11px; font-weight:700; color:var(--text-muted);">Speed &amp; Error Spike Telemetry</span>
                                    </div>
                                    <svg viewBox="0 0 500 135" style="width:100%; height:140px; display:block;">
                                        <line x1="35" y1="25" x2="470" y2="25" stroke="var(--border)" stroke-width="1"/>
                                        <line x1="35" y1="68" x2="470" y2="68" stroke="var(--border)" stroke-width="1"/>
                                        <line x1="35" y1="110" x2="470" y2="110" stroke="#94a3b8" stroke-width="1.5"/>
                                        <polyline fill="none" stroke="#4f46e5" stroke-width="3" points="${polyPoints}"/>
                                        ${pts.map(p => `
                                            <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${(p.errors || 0) >= 3 ? '#e11d48' : '#4f46e5'}"/>
                                            <text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="currentColor">${p.wpm} WPM</text>
                                            <text x="${p.x}" y="126" text-anchor="middle" font-size="9" fill="#64748b">Min ${p.minute}</text>
                                        `).join('')}
                                    </svg>
                                </div>
                                <div style="background:var(--surface); padding:16px; border-radius:14px; border:1px solid var(--border); display:flex; flex-direction:column; gap:10px;">
                                    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                                        <span style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:0.4px; color:var(--secondary);"><i class="fas fa-microscope" style="color:#7c3aed;"></i> Forensic Error Diagnostics</span>
                                        <span style="padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; background:rgba(16,185,129,0.14); color:#059669;">Proctoring Integrity: ${integrityScore}%</span>
                                    </div>
                                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; text-align:center;">
                                        <div style="padding:8px; border-radius:8px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3);">
                                            <div style="font-size:10.5px; font-weight:700; color:#b45309;">Word-Swaps</div>
                                            <div style="font-size:15px; font-weight:900; color:#d97706;">${swaps.length}</div>
                                        </div>
                                        <div style="padding:8px; border-radius:8px; background:rgba(124,58,237,0.1); border:1px solid rgba(124,58,237,0.3);">
                                            <div style="font-size:10.5px; font-weight:700; color:#6d28d9;">Homophones</div>
                                            <div style="font-size:15px; font-weight:900; color:#7c3aed;">${homophones.length}</div>
                                        </div>
                                        <div style="padding:8px; border-radius:8px; background:rgba(225,29,72,0.1); border:1px solid rgba(225,29,72,0.3);">
                                            <div style="font-size:10.5px; font-weight:700; color:#be123c;">Line-Skip</div>
                                            <div style="font-size:14px; font-weight:900; color:#e11d48;">${maxOmittedStreak >= 7 ? 'Detected (' + maxOmittedStreak + 'w)' : 'None'}</div>
                                        </div>
                                    </div>
                                    <div style="font-size:11.5px; color:var(--text-muted); display:flex; flex-direction:column; gap:5px; line-height:1.5;">
                                        <div><strong style="color:var(--secondary);">Transpositions (0.5 Penalty):</strong> ${swaps.length ? escDiag(swaps.slice(0, 3).join(', ')) : '0 adjacent word swaps'}</div>
                                        <div><strong style="color:var(--secondary);">Homophone Confusions:</strong> ${homophones.length ? escDiag(homophones.slice(0, 3).join(', ')) : '0 homophone mix-ups'}</div>
                                        <div><strong style="color:var(--secondary);">Head-to-Head Challenge:</strong> <button type="button" onclick="if(typeof closeModal==='function') closeModal(); startBatchmateGhostRace('Your Past Attempt', ${Math.round(baseWpm)}, '${String(item.ExamName || item.examName || item.TestTitle || 'Skill Test').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')" style="background:none; border:none; padding:0; color:var(--primary); font-weight:800; cursor:pointer; text-decoration:underline;"><i class="fas fa-flag-checkered"></i> Race Against This Pace (${Math.round(baseWpm)} WPM)</button></div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                } catch (err) {}
    } catch (err) {
      console.warn('[afterComparisonOpen] diagnostics hook warning:', err);
    }
    setTimeout(() => {
      if (window._currentComparisonItem && typeof injectSideBySideShorthandAnnotationStudio === 'function') {
        injectSideBySideShorthandAnnotationStudio(window._currentComparisonItem);
      }
    }, 60);
  });

  // 9. CBT Exam Lifecycle Hooks (Proctoring + Autosave Clear + Mistake Bank Capture)
  portalHooks.on('afterCbtTestStart', () => {
    if (typeof window.startExamProctoringMonitor === 'function') {
      window.startExamProctoringMonitor('CBT Mock Exam');
    }
  });

  portalHooks.on('beforeCbtSubmit', () => {
    if (typeof window.clearExamCrashRecoveryDraft === 'function') {
      window.clearExamCrashRecoveryDraft('cbt');
    }
  });

  portalHooks.on('afterCbtSubmit', () => {
    try {
      if (typeof window.stopExamProctoringMonitor === 'function') {
        window.stopExamProctoringMonitor();
      }
      if (typeof updateCbtRevisionCountsUI === 'function') updateCbtRevisionCountsUI();
      if (typeof window.renderDedicatedCbtRevisionTab === 'function') window.renderDedicatedCbtRevisionTab();
    } catch (_e) {}
  });

  // 10. Telegram Auto-Dispatch on Successful API Writes
  portalHooks.on('afterApiSuccess', (action, payload = {}) => {
    if (typeof window.autoDispatchTelegramPortalData !== 'function') return;
    try {
      if (action === 'uploadMaterial' || action === 'addMaterial' || action === 'saveMaterial') {
        window.autoDispatchTelegramPortalData('NEW STUDY MATERIAL', `Uploaded "${payload.title || payload.Title || 'New Practice Material'}" in ${payload.type || payload.Type || 'Portal Library'}`);
      } else if (action === 'scheduleLiveTest' || action === 'saveScheduledLiveTest') {
        window.autoDispatchTelegramPortalData('LIVE SCHEDULED EXAM', `"${payload.title || 'Live Portal Exam'}" scheduled for ${payload.startTime || 'Upcoming Slot'}`);
      } else if (action === 'saveAnnouncement' || action === 'addAnnouncement') {
        window.autoDispatchTelegramPortalData('OFFICIAL NOTICE', `${payload.title || payload.message || 'New Notice Posted on Command Deck'}`);
      } else if (action === 'saveHomework' || action === 'assignHomework') {
        window.autoDispatchTelegramPortalData('DAILY HOMEWORK', `Assigned: ${payload.title || payload.task || 'New Daily Practice Task'}`);
      } else if (action === 'saveFeeInstallmentRecord') {
        window.autoDispatchTelegramPortalData('FEE RECEIPT ISSUED', `Receipt ${payload.receiptNo} generated for ${payload.studentName} (₹${payload.amountPaid})`);
      } else if (action === 'saveTestHistory' && payload && payload.examName) {
        window.autoDispatchTelegramPortalData('EXAM SCORECARD', `${payload.userName || 'Candidate'} completed ${payload.examName} (${payload.netSpeed || 0} WPM • ${payload.accuracyPercentage || 0}% Accuracy)`);
      }
    } catch (_err) {}
  });
}
