// @ts-nocheck
/**
 * RP Skill Portal — Weak Outlines Vault, Pitman SVG Inspector, 7-Day Planner & Ghost Pacer
 * Clean Vite ES module (zero layered monkey-patch conflicts).
 */

import { portalState } from '../core/state.ts';
import { defaultEvaluationRule, showToast, syncUserCloudStateToBackend } from './apiAndCore.js';
import { configureActiveTestModalChrome } from './mediaAndDictation.js';
import { isElementVisibleInDom, startTestTimer, updateLiveTypingStatusBar } from './typingAndEvaluation.js';

const currentActiveViewName = (...args) => (typeof window.currentActiveViewName === 'function' ? window.currentActiveViewName(...args) : undefined);

window._lastSelectedPostDictWord = '';

export function generatePitmanOutlineSvgForWord(word) {
      const clean = String(word || 'word').trim();
      let hash = 0;
      for (let i = 0; i < clean.length; i++) {
        hash = ((hash << 5) - hash) + clean.charCodeAt(i);
        hash |= 0;
      }
      const absH = Math.abs(hash);
      const yStart = 42 + (absH % 38);
      const yMid = 26 + ((absH >> 3) % 52);
      const yEnd = 45 + ((absH >> 6) % 36);
      const xMid = 105 + (absH % 45);
      const dotX = 95 + ((absH >> 2) % 60);
      const dotY = yMid - 8;

      return `
        <div style="font-size: 10.5px; font-weight: 800; color: #4f46e5; margin-bottom: 2px;">Outline: "${clean}"</div>
        <svg viewBox="0 0 250 92" width="100%" height="85">
          <line x1="15" y1="32" x2="235" y2="32" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4" />
          <line x1="15" y1="70" x2="235" y2="70" stroke="#94a3b8" stroke-width="2" />
          <text x="18" y="66" fill="#94a3b8" font-size="7.5" font-weight="700">PITMAN RULED LINE</text>
          <path d="M 55 ${yStart} Q ${xMid} ${yMid} 195 ${yEnd}" fill="none" stroke="#1e1b4b" stroke-width="3.8" stroke-linecap="round" />
          <circle cx="${dotX}" cy="${dotY}" r="3.5" fill="#dc2626" />
        </svg>
      `;
    }

export function seekPostDictationReviewWord(wordIndex, totalWords, wordText) {
      const cleanWord = String(wordText || '').trim();
      window._lastSelectedPostDictWord = cleanWord;
      const ratio = Math.max(0, Math.min(1, (Number(wordIndex) || 0) / Math.max(1, Number(totalWords) || 1)));

      const badge = document.getElementById('post-dict-selected-word-badge');
      const svgCard = document.getElementById('post-dictation-outline-svg-card');
      if (svgCard) {
        svgCard.innerHTML = generatePitmanOutlineSvgForWord(cleanWord);
      }

      const audioEl = document.getElementById('post-dictation-review-audio');
      if (audioEl && audioEl.duration && isFinite(audioEl.duration) && audioEl.duration > 2) {
        const targetSec = Math.max(0, Math.round(audioEl.duration * ratio));
        audioEl.currentTime = targetSec;
        audioEl.play().catch(() => {});
        const m = String(Math.floor(targetSec / 60)).padStart(2, '0');
        const s = String(targetSec % 60).padStart(2, '0');
        if (badge) badge.innerText = `🔊 Playing "${cleanWord}" @ ${m}:${s} (Word #${wordIndex + 1}/${totalWords})`;
        showToast(`🎧 Jumped to "${cleanWord}" at ${m}:${s} in dictation audio`);
        return;
      }

      if (badge) badge.innerText = `🔊 Speaking "${cleanWord}" (Word #${wordIndex + 1}/${totalWords}) • Pitman Outline Displayed`;
      if ('speechSynthesis' in window && cleanWord) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(cleanWord);
          u.rate = 0.9;
          window.speechSynthesis.speak(u);
        } catch (e) {}
      }
      showToast(`✏️ Showing Pitman Shorthand Outline & pronunciation for "${cleanWord}"`);
    }

export function replayPostDictationFromCurrentWord() {
      const word = window._lastSelectedPostDictWord || 'dictation';
      const audioEl = document.getElementById('post-dictation-review-audio');
      if (audioEl && audioEl.src && audioEl.duration && isFinite(audioEl.duration)) {
        audioEl.play().catch(() => {});
        return;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const ref = (window._lastEvaluatedSheetExportData && window._lastEvaluatedSheetExportData.refText) || word;
        const idx = ref.toLowerCase().indexOf(word.toLowerCase());
        const sliceText = idx >= 0 ? ref.slice(idx, idx + 220) : ref.slice(0, 220);
        const u = new SpeechSynthesisUtterance(sliceText);
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
        showToast(`🔊 Replaying dictation segment starting from "${word}"`);
      }
    }

export const WEAK_VAULT_STORAGE_KEY = 'rp_skill_weak_outlines_vault_v1';

export function isLegacySeededWeakWordEntry(item) {
        if (typeof window.isLegacySeededWeakWordGlobal === 'function') {
            return window.isLegacySeededWeakWordGlobal(item);
        }
        if (!item || typeof item !== 'object' || !item.word) return true;
        const idStr = String(item.id || '').toLowerCase();
        if (idStr.startsWith('seed-') || idStr.startsWith('sample-') || idStr.startsWith('wk-seed') || idStr.startsWith('wk_def_')) return true;
        const catLower = String(item.category || '').toLowerCase().trim();
        if (catLower.includes('starter') || catLower.includes('sample') || catLower.includes('ssc legal') || catLower.includes('parliamentary')) return true;
        return false;
    }

window.getWeakOutlinesVault = function() {
        try {
            const raw = localStorage.getItem(WEAK_VAULT_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) {
                const cleaned = parsed.filter(v => !isLegacySeededWeakWordEntry(v));
                if (cleaned.length !== parsed.length) {
                    try { localStorage.setItem(WEAK_VAULT_STORAGE_KEY, JSON.stringify(cleaned)); } catch (e) {}
                    if (typeof syncUserCloudStateToBackend === 'function') syncUserCloudStateToBackend();
                }
                return cleaned;
            }
        } catch (e) {}
        return [];
    };

export let _weakVaultClearArmUntil = 0;

window.saveWeakOutlinesVault = function(list) {
        try {
            localStorage.setItem(WEAK_VAULT_STORAGE_KEY, JSON.stringify((list || []).slice(0, 250)));
        } catch (e) {}
        window.renderDashboardWeakOutlinesVault();
        if (typeof syncUserCloudStateToBackend === 'function') syncUserCloudStateToBackend();
    };

window.recordWordsIntoWeakOutlinesVault = function(mistakeItems, sourceLabel) {
        if (!Array.isArray(mistakeItems) || mistakeItems.length === 0) return;
        const vault = window.getWeakOutlinesVault();
        const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

        mistakeItems.forEach(item => {
            const cleanWord = String(item.word || '').replace(/[^a-zA-Z0-9'-]/g, '').trim();
            if (!cleanWord || cleanWord.length < 3) return;
            const existing = vault.find(v => String(v.word || '').toLowerCase() === cleanWord.toLowerCase());
            if (existing) {
                const nextWrong = (Number(existing.wrongCount ?? existing.count) || 0) + 1;
                existing.count = nextWrong;
                existing.wrongCount = nextWrong;
                existing.correctCount = Number(existing.correctCount) || 0;
                existing.typed = item.typed || existing.typed || 'Omitted';
                existing.category = item.category || sourceLabel || existing.category;
                existing.lastSeen = todayStr;
                existing.mastered = false;
            } else {
                vault.unshift({
                    word: cleanWord,
                    typed: item.typed || 'Omitted',
                    category: item.category || sourceLabel || 'Steno / Typing',
                    count: 1,
                    wrongCount: 1,
                    correctCount: 0,
                    lastSeen: todayStr,
                    mastered: false
                });
            }
        });
        window.saveWeakOutlinesVault(vault);
    };

window.recordCorrectWordsInWeakOutlinesVault = function(correctWordsList) {
        if (!Array.isArray(correctWordsList) || correctWordsList.length === 0) return;
        const vault = window.getWeakOutlinesVault();
        if (!vault.length) return;
        const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const uniqueLower = new Set(
            correctWordsList
                .map(w => String(w || '').replace(/[^a-zA-Z0-9'-]/g, '').trim().toLowerCase())
                .filter(w => w.length >= 3)
        );
        let changed = false;
        vault.forEach(item => {
            const key = String(item.word || '').toLowerCase();
            if (uniqueLower.has(key)) {
                item.correctCount = (Number(item.correctCount) || 0) + 1;
                item.wrongCount = Number(item.wrongCount ?? item.count) || 0;
                item.lastSeen = todayStr;
                changed = true;
            }
        });
        if (changed) {
            window.saveWeakOutlinesVault(vault);
        }
    };

window.describePitmanShorthandOutline = function(word) {
        const w = String(word || '').trim();
        const lw = w.toLowerCase();
        const firstVowelMatch = lw.match(/[aeiouy]/);
        const firstVowel = firstVowelMatch ? firstVowelMatch[0] : 'a';
        let position = '2nd Position (On the Line)';
        let lineY = 95;
        let strokeStartY = 55;
        if (firstVowel === 'a' || firstVowel === 'o') {
            position = '1st Position (Above the Line)';
            strokeStartY = 38;
        } else if (firstVowel === 'i' || firstVowel === 'u') {
            position = '3rd Position (Through the Line)';
            strokeStartY = 72;
        }

        const consonants = lw.replace(/[aeiouy]/g, '').toUpperCase().split('').slice(0, 6);
        const hasShunHook = /(tion|sion|cian)$/.test(lw);
        const hasStLoop = /(st|str)$/.test(lw) || /^(st|str)/.test(lw);
        const hasRHook = /[pbtdkg]r/.test(lw);
        const hasLHook = /[pbtdkg]l/.test(lw);
        const isHalved = /(ed|t|d)$/.test(lw) && lw.length > 5;

        let pathD = `M 55 ${strokeStartY}`;
        let curX = 55;
        let curY = strokeStartY;
        if (/^(st|str|s)/.test(lw)) {
            pathD += ` a 9 9 0 1 1 14 6`;
            curX += 14;
            curY += 6;
        }
        consonants.slice(0, 4).forEach((c, idx) => {
            if ('PBTDJCH'.includes(c)) {
                curX += (c === 'P' || c === 'B') ? 22 : (c === 'T' || c === 'D') ? 2 : -16;
                curY += isHalved && idx === consonants.length - 1 ? 22 : 38;
                pathD += ` L ${curX} ${curY}`;
            } else if ('KGMN'.includes(c)) {
                const nextX = curX + 42;
                const ctrlY = (c === 'M') ? curY - 16 : (c === 'N') ? curY + 16 : curY;
                pathD += ` Q ${curX + 21} ${ctrlY} ${nextX} ${curY}`;
                curX = nextX;
            } else {
                const nextX = curX + 34;
                const nextY = curY - 18;
                pathD += ` Q ${curX + 16} ${curY - 22} ${nextX} ${nextY}`;
                curX = nextX;
                curY = nextY;
            }
        });
        if (hasShunHook) {
            pathD += ` c 14 -6, 16 14, 2 16`;
        }

        const svg = `
            <svg viewBox="0 0 280 130" class="w-full h-36">
                <defs>
                    <linearGradient id="pitmanStrokeGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#4f46e5"/>
                        <stop offset="100%" stop-color="#ec4899"/>
                    </linearGradient>
                </defs>
                <line x1="15" y1="${lineY}" x2="265" y2="${lineY}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 3"/>
                <text x="20" y="${lineY + 14}" font-size="9" fill="#64748b" font-family="monospace">PITMAN RULED LINE</text>
                <path d="${pathD}" fill="none" stroke="url(#pitmanStrokeGrad)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="${Math.min(230, curX - 18)}" cy="${Math.max(25, curY - 12)}" r="3.8" fill="#f59e0b"/>
            </svg>
        `;

        const rules = [
            `<b>Consonant Skeleton:</b> <span class="font-mono text-indigo-600 dark:text-indigo-400">${consonants.join(' - ') || w.toUpperCase()}</span>`,
            `<b>Line Placement:</b> ${position}`,
            hasShunHook ? `<b>Terminal Hook:</b> Large <span class="text-rose-600 font-bold">-TION / -SION Hook</span> at final stroke` : null,
            hasStLoop ? `<b>Loop Rule:</b> Use <span class="text-amber-600 font-bold">ST / STR Oval Loop</span> (half length of stroke)` : null,
            (hasRHook || hasLHook) ? `<b>Initial Blend:</b> Attach <span class="text-emerald-600 font-bold">${hasRHook ? 'Right (R) Hook' : 'Left (L) Hook'}</span> on straight downstroke` : null,
            isHalved ? `<b>Halving Principle:</b> Halve final stroke length to indicate <span class="text-purple-600 font-bold">past-tense -T / -D</span>` : null
        ].filter(Boolean);

        return { word: w, position, svg, rules };
    };

window.seedWeakVaultFromHistoryOrMaterials = function() {
        // Zero preloaded / hardcoded sample words: always return only the student's real saved Vault.
        // Also purge any legacy 6-word auto-seeded set from older portal versions.
        let vault = window.getWeakOutlinesVault();
        const legacySeeds = ['jurisprudence', 'appropriation', 'notwithstanding', 'administration', 'infrastructure', 'constitutional'];
        if (
            Array.isArray(vault) &&
            vault.length === 6 &&
            legacySeeds.every(k => vault.some(v => String(v.word || '').toLowerCase() === k && String(v.typed || '') === 'Outline Drill'))
        ) {
            vault = [];
            try { localStorage.setItem(WEAK_VAULT_STORAGE_KEY, '[]'); } catch (e) {}
        }
        return vault;
    };

window.toggleWeakOutlineMastered = function(word) {
        const target = String(word || '').trim().toLowerCase();
        if (!target) return;
        const vault = window.getWeakOutlinesVault();
        const item = vault.find(v => String(v.word || '').toLowerCase() === target);
        if (!item) return;
        item.mastered = !item.mastered;
        window.saveWeakOutlinesVault(vault);
        window.renderWeakOutlinesVaultModalList();
        if (typeof showToast === 'function') {
            showToast(item.mastered ? `Marked "${item.word}" as Mastered.` : `Moved "${item.word}" back to Needs Practice.`, 'success');
        }
    };

window.deleteWeakOutlineWord = function(word) {
        const target = String(word || '').trim().toLowerCase();
        if (!target) return;
        const vault = window.getWeakOutlinesVault().filter(v => String(v.word || '').toLowerCase() !== target);
        if (String(window.__currentInspectedPitmanWord || '').toLowerCase() === target) {
            window.__currentInspectedPitmanWord = vault.length > 0 ? vault[0].word : '';
        }
        window.saveWeakOutlinesVault(vault);
        window.renderWeakOutlinesVaultModalList();
        if (window.__currentInspectedPitmanWord) {
            window.inspectPitmanWordInVault(window.__currentInspectedPitmanWord, true);
        } else {
            window.renderInlinePitmanInspectorEmpty();
        }
        if (typeof showToast === 'function') showToast(`Removed "${word}" from your Weak Outlines Vault.`);
    };

window.renderInlinePitmanInspectorEmpty = function() {
        const wordTitle = document.getElementById('inline-pitman-word-title');
        const posBadge = document.getElementById('inline-pitman-position-badge');
        const stage = document.getElementById('inline-pitman-svg-stage');
        const notes = document.getElementById('inline-pitman-notes');
        const input = document.getElementById('inline-pitman-practice-input');
        const progressEl = document.getElementById('inline-pitman-practice-progress');
        if (wordTitle) wordTitle.textContent = 'Select or add a word';
        if (posBadge) posBadge.textContent = 'Stroke Guide';
        if (stage) {
            stage.innerHTML = `<div style="padding:26px 14px; text-align:center; color:var(--text-muted); font-size:12.5px;">Click any saved word on the left — or add a difficult word above — to view its Pitman consonant skeleton, line placement, and 5x mastery drill.</div>`;
        }
        if (notes) notes.innerHTML = '';
        if (input) {
            input.value = '';
            input.disabled = true;
            input.placeholder = 'Select a word first to start 5x practice...';
        }
        if (progressEl) progressEl.textContent = '0 / 5 reps';
    };

window.closeWeakOutlinesVaultModal = function() {
        const modal = document.getElementById('weak-outlines-vault-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.style.display = 'none';
    };

window.inspectPitmanWordInVault = function(word, inlineOnly = false) {
        const cleanWord = String(word || '').trim();
        if (!cleanWord) {
            window.renderInlinePitmanInspectorEmpty();
            return;
        }
        const vault = window.seedWeakVaultFromHistoryOrMaterials();
        if (!vault.some(v => String(v.word || '').toLowerCase() === cleanWord.toLowerCase())) {
            window.recordWordsIntoWeakOutlinesVault([{ word: cleanWord, typed: 'Stroke Lookup', category: 'Pitman Lookup' }], 'Pitman Lookup');
        }

        const info = window.describePitmanShorthandOutline(cleanWord);
        window.__currentInspectedPitmanWord = info.word;

        // 1. Update Inline Studio Inspector inside #view-weak-vault
        const inlineTitle = document.getElementById('inline-pitman-word-title');
        const inlinePos = document.getElementById('inline-pitman-position-badge');
        const inlineStage = document.getElementById('inline-pitman-svg-stage');
        const inlineNotes = document.getElementById('inline-pitman-notes');
        const inlineInput = document.getElementById('inline-pitman-practice-input');
        const inlineProgress = document.getElementById('inline-pitman-practice-progress');
        if (inlineTitle) inlineTitle.textContent = info.word;
        if (inlinePos) inlinePos.textContent = info.position;
        if (inlineStage) {
            inlineStage.innerHTML = `<div style="width:100%; max-width:290px; margin:0 auto;">${info.svg}</div>`;
        }
        if (inlineNotes) {
            inlineNotes.innerHTML = info.rules.map(r => `<div style="display:flex; align-items:flex-start; gap:8px; background:var(--background); padding:8px 10px; border-radius:8px; border:1px solid var(--border); font-size:12px; color:var(--secondary);"><i class="fas fa-check-circle" style="color:var(--primary); margin-top:2px; flex-shrink:0;"></i><span>${r}</span></div>`).join('');
        }
        if (inlineInput) {
            inlineInput.disabled = false;
            inlineInput.value = '';
            inlineInput.placeholder = `Type "${info.word}" 5 times separated by spaces to master...`;
        }
        if (inlineProgress) inlineProgress.textContent = '0 / 5 reps';

        // 2. Unified single-section layout: when inside #view-weak-vault, NEVER pop open the duplicate modal
        const vaultViewEl = document.getElementById('view-weak-vault');
        const isVaultTabOpen = (typeof currentActiveViewName !== 'undefined' && currentActiveViewName === 'weak-vault')
            || (typeof portalState.activeTab !== 'undefined' && portalState.activeTab === 'weak-vault')
            || Boolean(vaultViewEl && vaultViewEl.style.display && vaultViewEl.style.display !== 'none');
        const modal = document.getElementById('weak-outlines-vault-modal');
        if (modal && !inlineOnly && !isVaultTabOpen) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
        window.renderWeakOutlinesVaultModalList();

        const posBadge = document.getElementById('pitman-inspector-position-badge');
        const stage = document.getElementById('pitman-outline-svg-stage');
        const notes = document.getElementById('pitman-outline-Coaching-notes');
        const input = document.getElementById('pitman-inspector-practice-input');
        if (posBadge) posBadge.textContent = info.position;
        if (stage) {
            stage.innerHTML = `
                <div style="font-size: 16px; font-weight: 900; color: var(--secondary); letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 6px;">${window.escapeHtml(info.word)}</div>
                <div style="width: 100%; max-width: 280px;">${info.svg}</div>
            `;
        }
        if (notes) {
            notes.innerHTML = info.rules.map(r => `<div style="display:flex; align-items:flex-start; gap:8px; background:var(--surface); padding:6px 10px; border-radius:8px; border:1px solid var(--border);"><i class="fas fa-check-circle" style="color:var(--primary); margin-top:3px;"></i><span>${r}</span></div>`).join('');
        }
        if (input) {
            input.value = '';
            input.placeholder = `Type "${info.word}" 5x separated by space...`;
        }

        // Highlight active item in inline list
        window.renderDashboardWeakOutlinesVault(true);
    };

window.checkPitmanInspectorPracticeInput = function(inputEl) {
        const target = String(window.__currentInspectedPitmanWord || '').toLowerCase().trim();
        if (!target) return;
        const tokens = String(inputEl.value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
        const matches = tokens.filter(t => t === target).length;
        const progressEl = document.getElementById('inline-pitman-practice-progress');
        if (progressEl) {
            progressEl.textContent = `${Math.min(5, matches)} / 5 reps`;
            progressEl.style.color = matches >= 5 ? '#059669' : 'var(--primary)';
        }
        if (matches >= 5) {
            const vault = window.getWeakOutlinesVault();
            const item = vault.find(v => String(v.word || '').toLowerCase() === target);
            if (item) {
                item.mastered = true;
                item.correctCount = (Number(item.correctCount) || 0) + 1;
                item.lastSeen = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            }
            window.saveWeakOutlinesVault(vault);
            window.renderWeakOutlinesVaultModalList();
            inputEl.value = '';
            if (progressEl) progressEl.textContent = '5 / 5 Mastered';
            if (typeof showToast === 'function') showToast(`Mastered "${window.__currentInspectedPitmanWord}"! Marked complete in your Vault.`, 'success');
        }
    };

window.__weakVaultFilterMode = window.__weakVaultFilterMode || 'all';

window.setWeakVaultFilterMode = function(mode) {
        window.__weakVaultFilterMode = mode || 'all';
        ['all', 'pending', 'mastered'].forEach(m => {
            const btn = document.getElementById(`weak-vault-filter-${m}`);
            if (btn) btn.className = (window.__weakVaultFilterMode === m) ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
        });
        window.renderDashboardWeakOutlinesVault(true);
    };

window.renderDashboardWeakOutlinesVault = function(skipAutoInspect = false) {
        const vault = window.seedWeakVaultFromHistoryOrMaterials();
        const pendingCount = vault.filter(v => !v.mastered).length;
        const masteredCount = vault.filter(v => v.mastered).length;

        // Update KPI counters in #view-weak-vault
        const totalKpi = document.getElementById('weak-vault-kpi-total');
        const pendingKpi = document.getElementById('weak-vault-kpi-pending');
        const masteredKpi = document.getElementById('weak-vault-kpi-mastered');
        const badgeEl = document.getElementById('weak-outlines-count-badge');
        if (totalKpi) totalKpi.textContent = String(vault.length);
        if (pendingKpi) pendingKpi.textContent = String(pendingCount);
        if (masteredKpi) masteredKpi.textContent = String(masteredCount);
        if (badgeEl) badgeEl.textContent = `${pendingCount} Needs Practice`;

        // Render clean inline list inside #view-weak-vault
        const inlineListEl = document.getElementById('weak-vault-inline-list');
        if (inlineListEl) {
            const q = String(document.getElementById('weak-vault-search-input')?.value || '').toLowerCase().trim();
            const mode = window.__weakVaultFilterMode || 'all';
            let filtered = vault.filter(item => {
                if (mode === 'pending' && item.mastered) return false;
                if (mode === 'mastered' && !item.mastered) return false;
                if (q) {
                    const hay = `${item.word || ''} ${item.category || ''} ${item.typed || ''}`.toLowerCase();
                    if (!hay.includes(q)) return false;
                }
                return true;
            });

            if (vault.length === 0) {
                inlineListEl.innerHTML = window.buildRpEmptyStateHtml(
                    'Your Weak Outlines Vault is empty',
                    'Words you miss or misspell in Dictation & Typing tests appear here automatically. You can also type any difficult word above to inspect its Pitman stroke right away.',
                    'Focus Add Word Box',
                    "document.getElementById('weak-vault-custom-word-input')?.focus()"
                );
                window.renderInlinePitmanInspectorEmpty();
            } else if (filtered.length === 0) {
                inlineListEl.innerHTML = `<div style="padding:20px; text-align:center; font-size:12.5px; color:var(--text-muted); border:1px dashed var(--border); border-radius:10px;">No saved words match this filter or search query.</div>`;
            } else {
                const activeWordLower = String(window.__currentInspectedPitmanWord || '').toLowerCase();
                inlineListEl.innerHTML = filtered.map(item => {
                    const safeWord = window.escapeHtml(String(item.word || ''));
                    const safeJs = safeWord.replace(/'/g, "\\'");
                    const isSelected = activeWordLower === String(item.word || '').toLowerCase();
                    const wrongTimes = Number(item.wrongCount ?? item.count) || 1;
                    const correctTimes = Number(item.correctCount) || 0;
                    const totalTimes = wrongTimes + correctTimes;
                    return `
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-radius:10px; background:${isSelected ? 'rgba(79,70,229,0.08)' : 'var(--background)'}; border:1.5px solid ${isSelected ? 'var(--primary)' : (item.mastered ? 'rgba(16,185,129,0.35)' : 'var(--border)')}; transition:all 0.15s ease;">
                            <div onclick="inspectPitmanWordInVault('${safeJs}', true)" style="display:flex; align-items:center; gap:10px; min-width:0; flex:1; cursor:pointer;">
                                <span style="min-width:30px; height:28px; border-radius:6px; background:${item.mastered ? 'rgba(16,185,129,0.14)' : 'rgba(225,29,72,0.12)'}; color:${item.mastered ? '#059669' : '#e11d48'}; font-size:11px; font-weight:800; font-variant-numeric:tabular-nums; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;" title="Written wrong ${wrongTimes} time(s)">
                                    ${item.mastered ? '✓' : `${wrongTimes}x`}
                                </span>
                                <div style="min-width:0; flex:1;">
                                    <div style="font-size:13.5px; font-weight:800; color:var(--secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safeWord}</div>
                                    <div style="font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:2px; font-variant-numeric:tabular-nums;">
                                        <span style="color:#dc2626; font-weight:800;">Wrong: ${wrongTimes}x</span>
                                        <span>&middot;</span>
                                        <span style="color:#059669; font-weight:800;">Correct: ${correctTimes}x</span>
                                        <span>&middot;</span>
                                        <span>Total: ${totalTimes}x</span>
                                        <span>&middot;</span>
                                        <span>${window.escapeHtml(item.category || 'Steno')}${item.typed ? ' (' + window.escapeHtml(item.typed) + ')' : ''}</span>
                                    </div>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                                <button type="button" class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}" style="padding:4px 9px; font-size:11px;" onclick="inspectPitmanWordInVault('${safeJs}', true)">Inspect</button>
                                <button type="button" class="btn btn-sm ${item.mastered ? 'btn-success' : 'btn-secondary'}" style="padding:4px 8px; font-size:11px;" onclick="toggleWeakOutlineMastered('${safeJs}')" title="${item.mastered ? 'Mark Needs Practice' : 'Mark Mastered'}">
                                    <i class="fa-solid ${item.mastered ? 'fa-rotate-left' : 'fa-check'}"></i>
                                </button>
                                <button type="button" class="btn btn-sm btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteWeakOutlineWord('${safeJs}')" title="Delete word">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');

                if (!skipAutoInspect && (!window.__currentInspectedPitmanWord || !vault.some(v => String(v.word || '').toLowerCase() === String(window.__currentInspectedPitmanWord || '').toLowerCase()))) {
                    window.inspectPitmanWordInVault(filtered[0].word, true);
                }
            }
        }

        // Keep legacy dashboard preview list in sync if present anywhere
        const listEl = document.getElementById('dashboard-weak-outlines-list');
        if (listEl) {
            const activeItems = vault.filter(v => !v.mastered);
            if (activeItems.length === 0) {
                listEl.innerHTML = window.buildRpEmptyStateHtml(
                    'No weak outlines recorded yet',
                    'Complete any dictation or typing test to automatically capture missed words, or add a difficult shorthand word manually.',
                    'Open Weak Outlines Vault',
                    "navigateTo('weak-vault')"
                );
            } else {
                listEl.innerHTML = activeItems.slice(0, 8).map(item => {
                    const wrongTimes = Number(item.wrongCount ?? item.count) || 1;
                    const correctTimes = Number(item.correctCount) || 0;
                    return `
                    <div onclick="inspectPitmanWordInVault('${window.escapeHtml(String(item.word)).replace(/'/g, "\\'")}')" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 10px; background: var(--background); border: 1px solid var(--border); cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                            <span style="min-width: 24px; height: 24px; border-radius: 6px; background: rgba(225,29,72,0.14); color: #e11d48; font-size: 10.5px; font-weight: 900; display: inline-flex; align-items: center; justify-content: center;">${wrongTimes}x</span>
                            <strong style="font-size: 12.5px; color: var(--secondary);">${window.escapeHtml(item.word)}</strong>
                            <span style="font-size: 10.5px; color: #059669; font-weight: 700;">✓${correctTimes}x</span>
                        </div>
                        <span style="font-size: 11px; font-weight: 800; color: var(--primary);">Inspect</span>
                    </div>
                `;
                }).join('');
            }
        }
    };

window.openWeakOutlinesVaultModal = function() {
        const modal = document.getElementById('weak-outlines-vault-modal');
        if (!modal) return;
        const vault = window.seedWeakVaultFromHistoryOrMaterials();
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        window.renderWeakOutlinesVaultModalList();
        if (vault.length > 0) window.inspectPitmanWordInVault(vault[0].word);
    };

window.renderWeakOutlinesVaultModalList = function() {
        const container = document.getElementById('weak-outlines-vault-modal-list');
        if (!container) return;
        const q = String(document.getElementById('weak-outlines-search-input')?.value || '').toLowerCase().trim();
        const vault = window.getWeakOutlinesVault().filter(v => !q || String(v.word || '').toLowerCase().includes(q) || String(v.category || '').toLowerCase().includes(q));
        if (vault.length === 0) {
            container.innerHTML = `<div style="padding: 20px; text-align: center; font-size: 12.5px; color: var(--text-muted); background: var(--background); border-radius: 12px; border: 1px dashed var(--border);">No saved weak words yet. Complete a skill test or type any difficult word above to add &amp; inspect its stroke.</div>`;
            return;
        }
        container.innerHTML = vault.map(item => {
            const wrongTimes = Number(item.wrongCount ?? item.count) || 1;
            const correctTimes = Number(item.correctCount) || 0;
            const totalTimes = wrongTimes + correctTimes;
            return `
            <div onclick="inspectPitmanWordInVault('${window.escapeHtml(String(item.word)).replace(/'/g, "\\'")}')" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 12px; border: 1.5px solid ${item.mastered ? 'rgba(16,185,129,0.4)' : 'var(--border)'}; background: ${item.mastered ? 'rgba(16,185,129,0.06)' : 'var(--background)'}; cursor: pointer; transition: all 0.15s ease;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <strong style="font-size: 14px; color: var(--secondary);">${window.escapeHtml(item.word)}</strong>
                        <span style="font-size: 10.5px; font-weight: 700; color: var(--text-muted);">${window.escapeHtml(item.category || 'Steno')}</span>
                        <span style="font-size: 10.5px; font-weight: 800; color: #e11d48; font-variant-numeric:tabular-nums;">Wrong: ${wrongTimes}x</span>
                        <span style="font-size: 10.5px; font-weight: 800; color: #059669; font-variant-numeric:tabular-nums;">Correct: ${correctTimes}x</span>
                        <span style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); font-variant-numeric:tabular-nums;">Total: ${totalTimes}x</span>
                        ${item.mastered ? '<span style="font-size: 10.5px; font-weight: 800; color: #059669;"><i class="fas fa-check-circle"></i> Mastered</span>' : ''}
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">Last Typed: <span class="mono-num" style="color: #e11d48; font-weight: 700;">${window.escapeHtml(item.typed || 'Outline Drill')}</span> &bull; ${window.escapeHtml(item.lastSeen || 'Active')}</div>
                </div>
                <button type="button" class="btn btn-sm btn-secondary" style="font-size: 11px; font-weight: 800; padding: 5px 10px; color: var(--primary);">
                    <i class="fas fa-pen-nib"></i> View Stroke
                </button>
            </div>
        `;
        }).join('');
    };

window.clearMasteredWeakOutlines = function() {
        const vault = window.getWeakOutlinesVault().filter(v => !v.mastered);
        window.saveWeakOutlinesVault(vault);
        window.renderWeakOutlinesVaultModalList();
        if (typeof showToast === 'function') showToast('Cleared mastered words from Weak Outlines Vault.');
    };

window.launchWeakOutlinesCustomDrill = function() {
        window.closeWeakOutlinesVaultModal();
        const seededVault = window.seedWeakVaultFromHistoryOrMaterials();
        const unmastered = seededVault.filter(v => !v.mastered);
        const words = (unmastered.length > 0 ? unmastered : seededVault).map(v => v.word);
        if (words.length === 0) {
            if (typeof showToast === 'function') showToast('Add at least 1 weak word to your Vault (or finish a test) before starting a Weak Words Drill.');
            return;
        }

        const drillSentences = [];
        for (let i = 0; i < 12; i++) {
            const w1 = words[i % words.length];
            const w2 = words[(i + 1) % words.length];
            const w3 = words[(i + 2) % words.length];
            drillSentences.push(`The ${w1} and ${w2} were carefully examined under ${w3} during the official session.`);
        }
        const passage = drillSentences.join(' ');

        window.lastOriginTabBeforeTest = 'dashboard';
        window.isCountUpTimerMode = true;
        window.currentActiveExamRuleTitle = 'Weak Outlines Mastery Drill';
        window.currentActivePassageTitle = `Weak Words Drill (${words.slice(0, 5).join(', ')})`;
        portalState.currentExamName = 'Weak Outlines Vault — Custom Mastery Drill';
        portalState.currentReferenceText = passage;
        window.fullMasterPassageText = passage;
        window.__originalModalRefPlainText = passage;
        portalState.testDurationMinutes = 0;
        portalState.testBackspaces = 0;
        portalState.testStartTime = Date.now();
        portalState.isTestPaused = false;
        portalState.isTypingTimerStarted = false;
        window.currentExamRules = {
            examDisplayName: 'Weak Outlines Mastery Drill',
            timeLimit: 0,
            wordCountRule: '1word',
            backspaceMode: 'on',
            highlightMode: 'on',
            autoScrollMode: 'on'
        };

        const titleEl = document.getElementById('test-modal-title');
        if (titleEl) titleEl.textContent = portalState.currentExamName;
        configureActiveTestModalChrome('learning_exercise');

        const mainBody = document.getElementById('test-main-body-container');
        if (mainBody) {
            mainBody.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 1140px; flex: 1; margin: 0 auto;">
                    <div style="background: rgba(225,29,72,0.10); border: 1px solid rgba(225,29,72,0.3); padding: 10px 16px; border-radius: 10px; font-size: 12.5px; font-weight: 800; color: var(--secondary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <span><i class="fas fa-bolt" style="color: #e11d48;"></i> Weak Outlines Custom Mastery Drill — Practicing Focus Words: <strong style="color: var(--primary);">${words.slice(0, 8).join(', ')}</strong></span>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="openWeakOutlinesVaultModal()"><i class="fas fa-vault"></i> Open Weak Vault</button>
                    </div>
                    <div id="test-material-passage-text" style="background: var(--surface); padding: 18px; border-radius: 12px; border: 1.5px solid var(--border); font-size: 17px; line-height: 1.75; max-height: 220px; overflow-y: auto; user-select: none; white-space: pre-wrap;">${passage}</div>
                    <textarea id="test-user-input" class="form-control" spellcheck="false" autocorrect="off" autocapitalize="off" autocomplete="off" style="flex: 1; min-height: 220px; font-family: 'Segoe UI', monospace; font-size: 17px; padding: 14px;" placeholder="Start typing the Weak Outlines Mastery Drill here (Timer starts on your first keystroke)..." oninput="handleTypingInputProgress()" onkeydown="handleTestKeyDown(event)"></textarea>
                </div>
            `;
        }
        const activeModal = document.getElementById('active-test-modal');
        if (activeModal) {
            activeModal.classList.remove('hidden');
            activeModal.style.display = 'flex';
        }
        updateLiveTypingStatusBar('Ready - Weak Outlines Mastery Drill');
        startTestTimer(0);
        const inputBox = document.getElementById('test-user-input');
        if (inputBox) setTimeout(() => inputBox.focus(), 60);
        if (typeof showToast === 'function') showToast('⚡ Launched Custom Weak-Word Mastery Drill!');
    };

export const STUDY_PLANNER_STORAGE_KEY = 'rp_skill_weekly_study_planner_v1';

export const STUDY_PLAN_TEMPLATES = {
        ssc_80: {
            label: 'SSC 80 WPM Track',
            tasks: [
                { id: 't1', icon: 'fa-headphones-alt', color: 'indigo', title: '2x Audio Dictations @ 80 WPM (KC / Editorial)', actionView: 'audio' },
                { id: 't2', icon: 'fa-pen-fancy', color: 'purple', title: '1x Pitman Shorthand Exercise + Outline Drill', actionView: 'pitman' },
                { id: 't3', icon: 'fa-keyboard', color: 'emerald', title: '15 Mins Weak-Key & Personal Mistake Vault Drill', actionView: 'learningtyping' },
                { id: 't4', icon: 'fa-laptop-code', color: 'amber', title: '1x CBT Mock Sectional (English / Reasoning / GK)', actionView: 'cbttest' }
            ]
        },
        ssc_100: {
            label: 'SSC Grade C 100 WPM',
            tasks: [
                { id: 't1', icon: 'fa-headphones-alt', color: 'indigo', title: '2x Progressive Pyramid Dictations (90 → 110 WPM)', actionView: 'audio' },
                { id: 't2', icon: 'fa-book-open', color: 'rose', title: '2-Min Mandatory Read-Back + Full 40-Min Transcription', actionView: 'audio' },
                { id: 't3', icon: 'fa-vault', color: 'purple', title: 'Master 10 Words in Personal Weak Outlines Vault', actionView: 'dashboard' },
                { id: 't4', icon: 'fa-laptop-code', color: 'amber', title: '1x CBT Full Mock + 15-Q Mistake Mini-Quiz', actionView: 'cbttest' }
            ]
        },
        highcourt_100: {
            label: 'High Court 100-110 WPM',
            tasks: [
                { id: 't1', icon: 'fa-gavel', color: 'indigo', title: '2x High Court Legal Dictations @ 100-110 WPM', actionView: 'audio' },
                { id: 't2', icon: 'fa-spell-check', color: 'emerald', title: 'Pre-Dictation Legal Glossary & Latin Phrases Drill', actionView: 'pitman' },
                { id: 't3', icon: 'fa-keyboard', color: 'sky', title: 'High-Accuracy Legal Formatting Typing Test (50 WPM)', actionView: 'typingtest' },
                { id: 't4', icon: 'fa-microphone-alt', color: 'rose', title: '1x Voice-to-Text Shorthand Notebook Self-Check', actionView: 'audio' }
            ]
        },
        typing_35: {
            label: 'SSC Typing 35 WPM',
            tasks: [
                { id: 't1', icon: 'fa-keyboard', color: 'indigo', title: '2x 15-Minute SSC CGL/CHSL Typing Tests @ 35+ WPM', actionView: 'typingtest' },
                { id: 't2', icon: 'fa-ghost', color: 'purple', title: 'Touch-Typing Studio with Ghost Pacer @ 40 WPM', actionView: 'learningtyping' },
                { id: 't3', icon: 'fa-flag-checkered', color: 'emerald', title: '1x Head-to-Head Batchmate Ghost Race Challenge', actionView: 'dashboard' },
                { id: 't4', icon: 'fa-laptop-code', color: 'amber', title: '1x Computer Knowledge & English CBT Quiz', actionView: 'cbttest' }
            ]
        }
    };

export function getStudyPlannerState() {
        try {
            const raw = localStorage.getItem(STUDY_PLANNER_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    if (!parsed.customTasksByDay || typeof parsed.customTasksByDay !== 'object') parsed.customTasksByDay = {};
                    if (!parsed.completedMap || typeof parsed.completedMap !== 'object') parsed.completedMap = {};
                    return parsed;
                }
            }
        } catch (e) {}
        return {
            track: 'ssc_80',
            presetLoaded: false,
            selectedDayIdx: new Date().getDay(),
            customTasksByDay: {},
            completedMap: {}
        };
    }

export function saveStudyPlannerState(st) {
        try {
            localStorage.setItem(STUDY_PLANNER_STORAGE_KEY, JSON.stringify(st));
        } catch (e) {}
        if (typeof syncUserCloudStateToBackend === 'function') syncUserCloudStateToBackend();
    }

window.updateWeeklyStudyPlannerTrack = function(trackKey) {
        const st = getStudyPlannerState();
        st.track = STUDY_PLAN_TEMPLATES[trackKey] ? trackKey : 'ssc_80';
        st.presetLoaded = true;
        saveStudyPlannerState(st);
        window.renderWeeklyStudyPlanner();
    };

window.applyWeeklyStudyPlannerPreset = function() {
        const st = getStudyPlannerState();
        st.presetLoaded = true;
        saveStudyPlannerState(st);
        window.renderWeeklyStudyPlanner();
        if (typeof showToast === 'function') showToast('Recommended track schedule loaded into your 7-Day Planner.', 'success');
    };

window.addCustomStudyPlannerTask = function() {
        const inp = document.getElementById('study-planner-new-task-input');
        const viewSel = document.getElementById('study-planner-new-task-view');
        const title = inp ? inp.value.trim() : '';
        if (!title) {
            if (typeof showToast === 'function') showToast('Enter a study task title first.', 'warning');
            if (inp) inp.focus();
            return;
        }
        const st = getStudyPlannerState();
        const dayKey = String(st.selectedDayIdx);
        if (!Array.isArray(st.customTasksByDay[dayKey])) st.customTasksByDay[dayKey] = [];
        st.customTasksByDay[dayKey].push({
            id: 'custom_' + Date.now(),
            icon: 'fa-check-circle',
            color: 'indigo',
            title: title,
            actionView: viewSel ? viewSel.value : 'audio',
            isCustom: true
        });
        saveStudyPlannerState(st);
        if (inp) inp.value = '';
        window.renderWeeklyStudyPlanner();
    };

window.removeCustomStudyPlannerTask = function(dayIdx, taskId) {
        const st = getStudyPlannerState();
        const dayKey = String(dayIdx);
        if (Array.isArray(st.customTasksByDay[dayKey])) {
            st.customTasksByDay[dayKey] = st.customTasksByDay[dayKey].filter(t => t.id !== taskId);
            saveStudyPlannerState(st);
            window.renderWeeklyStudyPlanner();
        }
    };

window.selectWeeklyStudyPlannerDay = function(dayIdx) {
        const st = getStudyPlannerState();
        st.selectedDayIdx = Number(dayIdx);
        saveStudyPlannerState(st);
        window.renderWeeklyStudyPlanner();
    };

window.toggleWeeklyStudyPlannerTask = function(dayIdx, taskId) {
        const st = getStudyPlannerState();
        const key = `${st.track}_d${dayIdx}_${taskId}`;
        st.completedMap[key] = !st.completedMap[key];
        saveStudyPlannerState(st);
        window.renderWeeklyStudyPlanner();
    };

window.regenerateWeeklyStudyPlanner = function(resetChecks) {
        const st = getStudyPlannerState();
        if (resetChecks) {
            st.completedMap = {};
            st.presetLoaded = false;
            st.customTasksByDay = {};
        }
        st.selectedDayIdx = new Date().getDay();
        saveStudyPlannerState(st);
        window.renderWeeklyStudyPlanner();
        if (typeof showToast === 'function') showToast(resetChecks ? 'Study planner cleared to empty state.' : 'Weekly 7-Day Study Planner refreshed!', 'info');
    };

window.renderWeeklyStudyPlanner = function() {
        const daysBar = document.getElementById('weekly-study-planner-days-bar');
        const listEl = document.getElementById('weekly-study-planner-checklist');
        const badgeEl = document.getElementById('study-planner-benchmark-badge');
        const selectEl = document.getElementById('study-planner-track-select');
        if (!daysBar || !listEl) return;

        const st = getStudyPlannerState();
        const tpl = STUDY_PLAN_TEMPLATES[st.track] || STUDY_PLAN_TEMPLATES.ssc_80;
        if (badgeEl) badgeEl.textContent = st.presetLoaded ? tpl.label : 'Custom Empty Plan';
        if (selectEl && selectEl.value !== st.track) selectEl.value = st.track;

        const getTasksForDay = (idx) => {
            const base = st.presetLoaded ? tpl.tasks : [];
            const custom = Array.isArray(st.customTasksByDay && st.customTasksByDay[String(idx)]) ? st.customTasksByDay[String(idx)] : [];
            return [...base, ...custom];
        };

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayIdx = new Date().getDay();

        daysBar.innerHTML = dayNames.map((dName, idx) => {
            const dayTasks = getTasksForDay(idx);
            const doneCount = dayTasks.filter(t => st.completedMap[`${st.track}_d${idx}_${t.id}`]).length;
            const isSelected = idx === st.selectedDayIdx;
            const isToday = idx === todayIdx;
            return `
                <button type="button" onclick="selectWeeklyStudyPlannerDay(${idx})" class="p-1.5 rounded-xl border text-center transition ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'}">
                    <div class="text-[10px] font-extrabold uppercase">${dName}${isToday ? ' •' : ''}</div>
                    <div class="text-[10px] font-bold mt-0.5 tabular-nums ${isSelected ? 'text-indigo-100' : (dayTasks.length > 0 && doneCount === dayTasks.length) ? 'text-emerald-600' : 'text-slate-400'}">${doneCount}/${dayTasks.length}</div>
                </button>
            `;
        }).join('');

        const activeTasks = getTasksForDay(st.selectedDayIdx);
        const addTaskBarHtml = `
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; padding:10px; border-radius:10px; border:1px solid var(--border); background:var(--background);">
                <input type="text" id="study-planner-new-task-input" class="form-control" placeholder="Add a study task for ${dayNames[st.selectedDayIdx]}..." style="flex:1; min-width:170px; margin:0; padding:7px 10px; font-size:12.5px;" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomStudyPlannerTask();}">
                <select id="study-planner-new-task-view" class="form-control" style="width:auto; margin:0; padding:7px 10px; font-size:12px;">
                    <option value="audio">Audio Dictation</option>
                    <option value="pitman">Pitman Book</option>
                    <option value="learningtyping">Typing Studio</option>
                    <option value="typingtest">Skill Typing</option>
                    <option value="cbttest">CBT Exam</option>
                </select>
                <button type="button" class="btn btn-primary btn-sm" onclick="addCustomStudyPlannerTask()" style="white-space:nowrap;">+ Add Task</button>
            </div>
        `;

        if (activeTasks.length === 0) {
            listEl.innerHTML = addTaskBarHtml + `
                <div class="rp-saas-empty-state" style="padding:20px 16px;">
                    <div class="rp-empty-svg-badge" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h8"/><path d="M8 11h5"/></svg></div>
                    <div class="rp-empty-title">No study tasks planned for ${dayNames[st.selectedDayIdx]} yet</div>
                    <p class="rp-empty-desc">Add your own daily study item above, or apply the recommended <strong>${window.escapeHtml(tpl.label)}</strong> preset schedule.</p>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="applyWeeklyStudyPlannerPreset()">Load Recommended Track Preset</button>
                </div>
            `;
            return;
        }

        listEl.innerHTML = addTaskBarHtml + activeTasks.map(t => {
            const key = `${st.track}_d${st.selectedDayIdx}_${t.id}`;
            const checked = !!st.completedMap[key];
            const safeTitle = typeof window.escapeHtml === 'function' ? window.escapeHtml(t.title) : t.title;
            return `
                <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl border ${checked ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700'}">
                    <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleWeeklyStudyPlannerTask(${st.selectedDayIdx}, '${t.id}')" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500">
                        <i class="fas ${t.icon} text-xs text-${t.color}-500 shrink-0"></i>
                        <span class="text-xs font-bold ${checked ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'} truncate">${safeTitle}</span>
                    </label>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" onclick="(function(v){var map={audiodictation:'audio',learning:'learningtyping',typing:'typingtest'};var target=map[v]||v;if(typeof navigateTo==='function'){navigateTo(target,true,true);}else if(typeof switchView==='function'){switchView(target);}})('${t.actionView}')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-50 border border-slate-200 dark:border-slate-700 text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 shrink-0">
                            Go <i class="fas fa-arrow-right ml-0.5"></i>
                        </button>
                        ${t.isCustom ? `<button type="button" onclick="removeCustomStudyPlannerTask(${st.selectedDayIdx}, '${t.id}')" title="Remove task" class="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] text-rose-500 hover:bg-rose-50">✕</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    };

window.__audioAbLoop = { a: null, b: null, active: false };

window.__pyramidDrillState = { active: false, stepIndex: 0, steps: [1.0, 1.125, 1.25, 1.375], labels: ['80 WPM (1.0x)', '90 WPM (1.125x)', '100 WPM (1.25x)', '110 WPM (1.375x)'] };

export function getActiveDictationAudioElement() {
        return document.getElementById('stenoshala-dictation-audio')
            || document.getElementById('dictation-audio')
            || document.querySelector('#active-test-modal audio')
            || document.querySelector('#view-audio audio')
            || document.querySelector('#view-audiodictation audio');
    }

export function formatSecMMSS(sec) {
        if (sec === null || sec === undefined || isNaN(sec)) return '--:--';
        const s = Math.max(0, Math.floor(sec));
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

window.rewindAudioDictationByPedal = function(seconds) {
        const audio = getActiveDictationAudioElement();
        const delta = Number(seconds) || 3;
        if (audio && !isNaN(audio.currentTime)) {
            audio.currentTime = Math.max(0, audio.currentTime - delta);
            if (typeof showToast === 'function') showToast(`Foot Pedal: Rewound ${delta} seconds`, 'info');
        }
    };

window.setAudioAbLoopPoint = function(point) {
        const audio = getActiveDictationAudioElement();
        if (!audio) return;
        const cur = Number(audio.currentTime || 0);
        if (point === 'A') {
            window.__audioAbLoop.a = cur;
            const lbl = document.getElementById('audio-ab-label-a');
            if (lbl) lbl.textContent = formatSecMMSS(cur);
        } else {
            window.__audioAbLoop.b = Math.max((window.__audioAbLoop.a || 0) + 2, cur);
            window.__audioAbLoop.active = true;
            const lbl = document.getElementById('audio-ab-label-b');
            if (lbl) lbl.textContent = formatSecMMSS(window.__audioAbLoop.b);
            document.getElementById('audio-ab-clear-btn')?.classList.remove('hidden');
        }
    };

window.triggerQuick10SecAudioLoop = function() {
        const audio = getActiveDictationAudioElement();
        if (!audio) return;
        const start = Math.max(0, (audio.currentTime || 0) - 2);
        const end = start + 10;
        window.__audioAbLoop = { a: start, b: end, active: true };
        const lblA = document.getElementById('audio-ab-label-a');
        const lblB = document.getElementById('audio-ab-label-b');
        if (lblA) lblA.textContent = formatSecMMSS(start);
        if (lblB) lblB.textContent = formatSecMMSS(end);
        document.getElementById('audio-ab-clear-btn')?.classList.remove('hidden');
        if (typeof showToast === 'function') showToast(`Looping 10s segment (${formatSecMMSS(start)} – ${formatSecMMSS(end)})`, 'info');
    };

window.clearAudioAbLoop = function() {
        window.__audioAbLoop = { a: null, b: null, active: false };
        const lblA = document.getElementById('audio-ab-label-a');
        const lblB = document.getElementById('audio-ab-label-b');
        if (lblA) lblA.textContent = '--:--';
        if (lblB) lblB.textContent = '--:--';
        document.getElementById('audio-ab-clear-btn')?.classList.add('hidden');
    };

window.togglePyramidSpeedRampMode = function() {
        const st = window.__pyramidDrillState;
        st.active = !st.active;
        st.stepIndex = 0;
        const lbl = document.getElementById('pyramid-drill-status-label');
        const audio = getActiveDictationAudioElement();
        if (st.active) {
            if (audio) audio.playbackRate = st.steps[0];
            if (lbl) lbl.textContent = st.labels[0];
            if (typeof showToast === 'function') showToast('Pyramid Speed-Ramp ON: 80 → 90 → 100 → 110 WPM auto-stepping every 60s!', 'success');
        } else {
            if (audio) audio.playbackRate = 1.0;
            if (lbl) lbl.textContent = 'OFF';
        }
    };

window.toggleModalGhostPacer = function(enabled) {
        if (portalState.__modalGhostInterval) {
            clearInterval(portalState.__modalGhostInterval);
            portalState.__modalGhostInterval = null;
        }
        const refEl = document.getElementById('test-material-passage-text') || document.getElementById('test-reference-display') || document.getElementById('test-reference-text');
        if (!enabled) {
            if (refEl && window.__originalModalRefPlainText) {
                refEl.textContent = window.__originalModalRefPlainText;
            }
            return;
        }
        if (!refEl) return;
        const plain = window.__originalModalRefPlainText || refEl.textContent || '';
        window.__originalModalRefPlainText = plain;
        const words = plain.split(/\s+/).filter(Boolean);
        if (!words.length) return;
        const wpm = Number(document.getElementById('modal-ghost-pacer-wpm')?.value || 35);
        const wordsPerSec = wpm / 60;
        const startTs = Date.now();

        portalState.__modalGhostInterval = setInterval(() => {
            const modalHidden = !isElementVisibleInDom(document.getElementById('active-test-modal'));
            if (modalHidden) {
                clearInterval(portalState.__modalGhostInterval);
                portalState.__modalGhostInterval = null;
                return;
            }
            const ghostWordIdx = Math.min(words.length - 1, Math.floor(((Date.now() - startTs) / 1000) * wordsPerSec));
            refEl.innerHTML = words.map((w, idx) => idx === ghostWordIdx
                ? `<mark class="bg-amber-300 dark:bg-amber-500 text-slate-950 px-1 rounded font-bold shadow-sm" title="Ghost Pacer (${wpm} WPM)">${w}</mark>`
                : w
            ).join(' ');
        }, 350);
    };

window.updateModalGhostPacerWpm = function() {
        const toggle = document.getElementById('modal-ghost-pacer-toggle');
        if (toggle && toggle.checked) window.toggleModalGhostPacer(true);
    };

export let __speechRec = null;

export let __speechRecActive = false;

window.loadSamplePassageIntoVoiceReadback = function() {
        const masterBox = document.getElementById('voice-readback-master-text');
        if (!masterBox) return;
        let passage = window.fullMasterPassageText || portalState.currentReferenceText || window.currentAudioOriginalText || '';
        if (!passage && Array.isArray(window.materialsData)) {
            const found = window.materialsData.find(m => m.ContentOrUrl && !String(m.ContentOrUrl).startsWith('http'));
            if (found) passage = found.ContentOrUrl;
        }
        if (!passage) {
            if (typeof showToast === 'function') showToast('No uploaded reference passage found yet. Open a dictation/typing passage or paste your own text.');
            return;
        }
        masterBox.value = String(passage).trim();
        if (typeof showToast === 'function') showToast('Loaded reference passage for Voice Read-Back Self-Check!');
    };

window.openVoiceReadbackSelfCheckModal = function(context) {
        const modal = document.getElementById('voice-readback-selfcheck-modal');
        const masterBox = document.getElementById('voice-readback-master-text');
        const spokenBox = document.getElementById('voice-readback-spoken-text');
        const diffBox = document.getElementById('voice-readback-diff-result');
        if (!modal) return;

        let masterText = '';
        if (context === 'modal') {
            masterText = window.fullMasterPassageText || portalState.currentReferenceText || window.__originalModalRefPlainText || document.getElementById('test-material-passage-text')?.textContent || '';
        } else {
            masterText = window.currentAudioOriginalText || window.fullMasterPassageText || portalState.currentReferenceText || '';
        }
        if (!masterText && Array.isArray(window.materialsData)) {
            const firstMat = window.materialsData.find(m => m.ContentOrUrl && !String(m.ContentOrUrl).startsWith('http'));
            if (firstMat) masterText = firstMat.ContentOrUrl;
        }
        if (masterBox && (!masterBox.value.trim() || masterText)) {
            masterBox.value = String(masterText || '').trim();
        }
        if (spokenBox && !spokenBox.value) spokenBox.value = '';
        if (diffBox) {
            diffBox.classList.add('hidden');
            diffBox.style.display = 'none';
        }
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    };

window.closeVoiceReadbackSelfCheckModal = function() {
        if (__speechRec && __speechRecActive) {
            try { __speechRec.stop(); } catch (e) {}
            __speechRecActive = false;
        }
        const modal = document.getElementById('voice-readback-selfcheck-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    };

window.toggleVoiceReadbackRecognition = function() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const statusPill = document.getElementById('voice-readback-status-pill');
        const btnLabel = document.getElementById('voice-readback-mic-label');
        const spokenBox = document.getElementById('voice-readback-spoken-text');

        if (!SpeechRecognition) {
            if (statusPill) statusPill.textContent = '⚠️ Web Speech API not supported in this browser — type or paste your read-back directly.';
            if (spokenBox) spokenBox.focus();
            return;
        }
        if (__speechRecActive && __speechRec) {
            try { __speechRec.stop(); } catch (e) {}
            __speechRecActive = false;
            if (btnLabel) btnLabel.textContent = 'Start Speaking Read-Back';
            if (statusPill) statusPill.textContent = '⏸️ Microphone Paused';
            return;
        }
        try {
            __speechRec = new SpeechRecognition();
            __speechRec.lang = 'en-IN';
            __speechRec.continuous = true;
            __speechRec.interimResults = true;
            const baseText = spokenBox ? spokenBox.value.trim() : '';

            __speechRec.onresult = (event) => {
                let transcript = '';
                for (let i = 0; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript + ' ';
                }
                if (spokenBox) spokenBox.value = (baseText ? baseText + ' ' : '') + transcript.trim();
            };
            __speechRec.onend = () => {
                __speechRecActive = false;
                if (btnLabel) btnLabel.textContent = 'Start Speaking Read-Back';
            };
            __speechRec.start();
            __speechRecActive = true;
            if (btnLabel) btnLabel.textContent = 'Stop Microphone';
            if (statusPill) statusPill.textContent = '🔴 Listening live to your shorthand read-back...';
        } catch (err) {
            if (statusPill) statusPill.textContent = '⚠️ Could not start microphone. Check browser mic permissions.';
        }
    };

window.evaluateVoiceReadbackAgainstMaster = function() {
        const master = String(document.getElementById('voice-readback-master-text')?.value || '').trim();
        const spoken = String(document.getElementById('voice-readback-spoken-text')?.value || '').trim();
        const diffBox = document.getElementById('voice-readback-diff-result');
        if (!diffBox) return;
        diffBox.classList.remove('hidden');
        diffBox.style.display = 'block';
        if (!master || !spoken) {
            diffBox.innerHTML = `<p style="margin:0; font-size:12.5px; color:#e11d48; font-weight:800;"><i class="fas fa-exclamation-circle"></i> Please provide both the Master Reference Passage (or click "Load Latest Passage") and your Spoken Read-Back Transcript.</p>`;
            return;
        }
        const mWords = master.split(/\s+/);
        const sWords = spoken.split(/\s+/);
        let matched = 0;
        const sSet = new Set(sWords.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')));
        const wordTokensHtml = mWords.map(w => {
            const norm = w.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm && sSet.has(norm)) {
                matched++;
                return `<span style="color: #059669; font-weight: 700;">${w}</span>`;
            }
            return `<span style="background: rgba(225,29,72,0.14); color: #e11d48; padding: 1px 5px; border-radius: 5px; font-weight: 800;" title="Missed or misread in spoken read-back">${w}</span>`;
        }).join(' ');
        const accuracy = ((matched / Math.max(1, mWords.length)) * 100).toFixed(1);
        diffBox.innerHTML = `
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
                <span style="font-size: 12px; font-weight: 900; text-transform: uppercase; color: var(--primary);"><i class="fas fa-poll-h"></i> Shorthand Read-Back Verification Result</span>
                <div style="display: flex; align-items: center; gap: 12px; font-size: 12.5px; font-weight: 800;">
                    <span style="color: #059669;">Read-Back Accuracy: ${accuracy}%</span>
                    <span style="color: var(--secondary);">Matched: ${matched} / ${mWords.length} Words</span>
                </div>
            </div>
            <div style="font-size: 13px; line-height: 1.75; max-height: 180px; overflow-y: auto;">${wordTokensHtml}</div>
        `;
    };

window.__ghostRaceState = {
        active: false,
        opponentName: '',
        opponentWpm: 45,
        testTitle: '',
        startTime: 0,
        totalWords: 200
    };

window.startBatchmateGhostRace = function(opponentName, opponentWpm, testTitle) {
        const wpm = Math.max(20, Number(opponentWpm) || 45);
        const name = opponentName || 'Batch Topper';
        window.__ghostRaceState = {
            active: true,
            opponentName: name,
            opponentWpm: wpm,
            testTitle: testTitle || 'Skill Challenge',
            startTime: Date.now(),
            totalWords: 250
        };

        const modal = document.getElementById('active-test-modal');
        if (modal && modal.classList.contains('hidden')) {
            const firstTyping = (window.materialsData?.typing || [])[0];
            if (firstTyping && typeof window.startPracticeTest === 'function') {
                window.startPracticeTest(firstTyping.id, 'typing');
            } else if (modal) {
                modal.classList.remove('hidden');
            }
        }
        const banner = document.getElementById('ghost-race-live-banner');
        const oppLabel = document.getElementById('ghost-race-opponent-label');
        const oppWpmEl = document.getElementById('ghost-race-opp-wpm');
        if (banner) banner.classList.remove('hidden');
        if (oppLabel) oppLabel.textContent = `You vs. ${name} (${wpm} WPM Pace)`;
        if (oppWpmEl) oppWpmEl.textContent = String(wpm);
        if (typeof showToast === 'function') showToast(`Head-to-Head Ghost Race started against ${name} (${wpm} WPM)!`, 'success');
    };

window.stopBatchmateGhostRace = function() {
        window.__ghostRaceState.active = false;
        document.getElementById('ghost-race-live-banner')?.classList.add('hidden');
    };

window.__tickBatchmateGhostRace = function() {
        const st = window.__ghostRaceState;
        if (!st || !st.active) return;
        const inputEl = document.getElementById('test-user-input');
        const refEl = document.getElementById('test-material-passage-text') || document.getElementById('test-reference-text');
        const typedWords = String(inputEl?.value || '').trim().split(/\s+/).filter(Boolean).length;
        const totalWords = Math.max(50, String(refEl?.textContent || '').trim().split(/\s+/).filter(Boolean).length || 200);
        const elapsedMin = Math.max(0.05, (Date.now() - st.startTime) / 60000);
        const yourWpm = Math.round(typedWords / elapsedMin);
        const oppWords = Math.min(totalWords, Math.round(st.opponentWpm * elapsedMin));

        const yourPct = Math.min(100, Math.round((typedWords / totalWords) * 100));
        const oppPct = Math.min(100, Math.round((oppWords / totalWords) * 100));

        const yourWpmEl = document.getElementById('ghost-race-your-wpm');
        const yourBar = document.getElementById('ghost-race-your-bar');
        const oppBar = document.getElementById('ghost-race-opp-bar');
        const leadBadge = document.getElementById('ghost-race-lead-badge');

        if (yourWpmEl) yourWpmEl.textContent = String(yourWpm);
        if (yourBar) yourBar.style.width = `${yourPct}%`;
        if (oppBar) oppBar.style.width = `${oppPct}%`;
        if (leadBadge) {
            const diff = typedWords - oppWords;
            leadBadge.textContent = diff >= 0 ? `Leading by +${diff} words` : `Trailing by ${diff} words`;
            leadBadge.className = `px-2 py-0.5 rounded text-[10px] font-bold ${diff >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`;
        }
    };

export const CBT_BOOKMARKS_STORAGE_KEY = 'rp_skill_cbt_saved_mcqs_v1';

export const CBT_MISTAKES_STORAGE_KEY = 'rp_skill_cbt_mistake_bank_v1';
