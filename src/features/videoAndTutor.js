// @ts-nocheck
/**
 * RP Skill Portal — Video Course Hub, Touch-Typing Tutor, Latency Heatmap & Hindi Keymap
 * Clean Vite ES module (zero layered monkey-patch conflicts).
 */

import { portalState } from '../core/state.ts';
import { DEFAULT_LOGO_URL, defaultEvaluationRule, getEvaluationRulesForTab, isMaterialTypeMatch, showToast, syncUserCloudStateToBackend } from './apiAndCore.js';
import { navigateTo, sortMaterialsLatestFirst } from './authAndNavigation.js';
import { countMasterPassageStrokes, countMasterPassageWords, createInlineDataLoadStatusEl, getThumbnailUrl, streamRenderCardsToContainer } from './dashboardAndProfile.js';
import { cancelStenoTest, configureActiveTestModalChrome, extractYouTubeVideoId, openLearningStudioSetupScreen, triggerExamHallKeyClick } from './mediaAndDictation.js';
import { probeYouTubeVideoDuration } from './adminPanel.js';
import { checkMaterialAccessPermissions, preparePassageForInitialWordsRule, startTestTimer, updateLiveTypingStatusBar, updateTestSubmitMinTimeLockUI } from './typingAndEvaluation.js';

const populateEphemeralPresetRulesDropdown = (...args) => (typeof window.populateEphemeralPresetRulesDropdown === 'function' ? window.populateEphemeralPresetRulesDropdown(...args) : undefined);
const enterImmersiveFullscreenLock = (...args) => (typeof window.enterImmersiveFullscreenLock === 'function' ? window.enterImmersiveFullscreenLock(...args) : undefined);

export function renderVideoCourseView() {
      const subtabContainer = document.getElementById('videocourse-subtabs');
      if (subtabContainer) {
        const sourceSubtabs = (portalState.subtabsData && portalState.subtabsData.length > 0) ? portalState.subtabsData : (portalState.globalData.subtabs || []);
        const subtabs = sourceSubtabs.filter(s => isMaterialTypeMatch(s.Type || s.type, 'videocourse'));
        let html = `<button class="subtab-btn ${portalState.currentSubtabFilter.videocourse === 'ALL' ? 'active' : ''}" onclick="filterVideoCourseBySubtab('ALL', this)">All Courses</button>`;
        subtabs.forEach(s => {
          const sName = String(s.SubtabName ?? '').trim();
          if (!sName || sName === '-') return;
          const active = String(portalState.currentSubtabFilter.videocourse) === sName ? 'active' : '';
          const safeSubAttr = sName.replace(/'/g, "\\'");
          html += `<button class="subtab-btn ${active}" onclick="filterVideoCourseBySubtab('${safeSubAttr}', this)">${sName}</button>`;
        });
        subtabContainer.innerHTML = html;
      }
      renderVideoCourseList(portalState.currentSubtabFilter.videocourse || 'ALL');
    }

export function filterVideoCourseBySubtab(subtab, btn) {
      portalState.currentSubtabFilter.videocourse = subtab;
      if (btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
      renderVideoCourseList(subtab);
    }

export function renderVideoCourseList(subtab = 'ALL') {
      const container = document.getElementById('videocourse-grid') || document.getElementById('videocourse-list');
      if (!container) return;

      const searchInput = document.getElementById('videocourse-search-input') || document.getElementById('search-videocourse');
      const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

      // 👉 Requirement #1: Strictly filter ONLY 'videocourse' (never show Dashboard Reference Video 'video' here)
      let list = sortMaterialsLatestFirst(
        (portalState.materialsData || []).filter(m => {
          const rawT = String(m.Type || m.type || '').toLowerCase().replace(/[-_\s]/g, '');
          return rawT === 'videocourse' || rawT === 'videocourses';
        })
      );
      if (subtab !== 'ALL' && !query) {
        list = list.filter(m => String(m.Subtab ?? '').trim() === String(subtab).trim());
      }
      if (query) {
        list = list.filter(m =>
          String(m.Title ?? '').toLowerCase().includes(query) ||
          String(m.Subtab ?? '').toLowerCase().includes(query) ||
          String(m.Category ?? '').toLowerCase().includes(query)
        );
      }

      if (list.length === 0) {
        container.innerHTML = '';
        container.appendChild(createInlineDataLoadStatusEl(true));
        return;
      }

      const saveCachedVideoDuration = (urlKey, mins) => {
        if (!urlKey || !mins || mins <= 0) return;
        try {
          const cache = JSON.parse(localStorage.getItem('rp_video_durations_cache_v1') || '{}');
          cache[urlKey] = mins;
          localStorage.setItem('rp_video_durations_cache_v1', JSON.stringify(cache));
        } catch (e) {}
      };

      const getCachedVideoDuration = (urlKey) => {
        if (!urlKey) return 0;
        try {
          const cache = JSON.parse(localStorage.getItem('rp_video_durations_cache_v1') || '{}');
          return Number(cache[urlKey] || 0);
        } catch (e) { return 0; }
      };

      const updateCardDurationBadge = (item, mins) => {
        if (!mins || mins <= 0) return;
        item.TimeLimit = String(mins);
        saveCachedVideoDuration(String(item.ContentOrUrl ?? '').trim(), mins);
        const badge = document.getElementById(`vc-dur-badge-${item.ID}`);
        if (badge) {
          badge.innerHTML = `<i class="fa-regular fa-clock"></i> ${mins} Mins`;
        }
      };

      const probeVideoDurationForCard = (item) => {
        const rawUrl = String(item.ContentOrUrl ?? '').trim();
        if (!rawUrl || !rawUrl.startsWith('http')) return;

        // 1. Check local duration cache first
        const cachedMins = getCachedVideoDuration(rawUrl);
        if (cachedMins > 0) {
          updateCardDurationBadge(item, cachedMins);
          return;
        }

        // 2. Check if URL contains explicit duration param (e.g., ?dur=25 or &duration=1500)
        const durParamMatch = rawUrl.match(/[?&](?:dur|duration|mins)=([0-9]+)/i);
        if (durParamMatch && durParamMatch[1]) {
          const val = parseInt(durParamMatch[1], 10);
          if (val > 0) {
            const mins = val > 180 ? Math.max(1, Math.round(val / 60)) : val;
            updateCardDurationBadge(item, mins);
            return;
          }
        }

        // 3. Probe YouTube URLs via YouTube IFrame Player API
        if (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be')) {
          const videoId = typeof extractYouTubeVideoId === 'function' ? extractYouTubeVideoId(rawUrl) : '';
          if (videoId && typeof probeYouTubeVideoDuration === 'function') {
            probeYouTubeVideoDuration(videoId, (durSec) => {
              if (durSec && durSec > 0) {
                const mins = Math.max(1, Math.round(durSec / 60));
                updateCardDurationBadge(item, mins);
              }
            });
          }
          return;
        }

        // 4. Probe direct video streams (.mp4, .webm, .ogg, .mov, GitHub raw, Google Drive download stream, Supabase)
        let probeSrc = rawUrl;
        if (probeSrc.includes('github.com') && probeSrc.includes('/blob/')) {
          probeSrc = probeSrc.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        } else if (probeSrc.includes('drive.google.com')) {
          const m = probeSrc.match(/\/d\/([a-zA-Z0-9_-]+)/) || probeSrc.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (m && m[1]) probeSrc = `https://docs.google.com/uc?export=download&id=${m[1]}`;
        }

        const v = document.createElement('video');
        v.preload = 'metadata';
        v.muted = true;
        v.onloadedmetadata = () => {
          if (v.duration && isFinite(v.duration) && v.duration > 0) {
            const mins = Math.max(1, Math.round(v.duration / 60));
            updateCardDurationBadge(item, mins);
          }
          v.remove();
        };
        v.onerror = () => v.remove();
        v.src = probeSrc;
      };

      // 👉 REQUIREMENT #2 & #7: Progressive Card-by-Card Rendering for Video Course tab (Safe against numeric Title/Subtab)
      streamRenderCardsToContainer(container, list, (item, idx) => {
        setTimeout(() => probeVideoDurationForCard(item), 80 + (idx * 60));
        const displayTitle = String(item.Title ?? item.Name ?? '-');
        const safeTitleAttr = displayTitle.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeUrlAttr = String(item.ContentOrUrl ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const subtabLabel = (item.Subtab !== undefined && item.Subtab !== null && String(item.Subtab).trim() !== '' && String(item.Subtab).trim() !== '-')
          ? String(item.Subtab)
          : 'Course Module';
        const thumbUrl = getThumbnailUrl(item);
        const rawUrl = String(item.ContentOrUrl ?? '').trim();
        const cachedMins = getCachedVideoDuration(rawUrl);
        const rawTimeLimit = String(item.TimeLimit ?? '').trim();
        // Do not display stale default '5' unless verified; show auto-detected duration or 'Auto-Detecting...'
        const effectiveDurationLabel = cachedMins > 0
          ? `${cachedMins} Mins`
          : (rawTimeLimit && rawTimeLimit !== '5' && rawTimeLimit !== '-' && rawTimeLimit !== '0'
              ? `${rawTimeLimit} Mins`
              : 'Auto-Detecting Duration...');

        const vcAccess = String(item.AccessLevel || 'user').toLowerCase();
        const vcPerms = checkMaterialAccessPermissions(vcAccess, item);
        const vcBatchLabel = vcPerms.targetBatch ? ` • 🎯 ${vcPerms.targetBatch}` : '';
        const vcBatchSafe = String(vcPerms.targetBatch || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        return `
          <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; gap: 6px; border-top: 3px solid var(--primary);">
            <div>
              <div class="rp-thumb-frame" style="${vcPerms.canView ? '' : 'cursor:pointer; position:relative;'}" ${vcPerms.canView ? '' : `onclick="showToast('Access Denied: Restricted to ${vcPerms.requiredRoleLabel.replace(/'/g, "\\'")}')"`}>
                <img src="${thumbUrl}" loading="lazy" class="card-thumb" style="${vcPerms.canView ? '' : 'filter:blur(6px); opacity:0.65;'}" onerror="this.onerror=null;this.src='${DEFAULT_LOGO_URL}'">
                ${vcPerms.canView ? '' : `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(15,23,42,0.38);"><span style="color:#fff; font-weight:700; font-size:10.5px; background:rgba(220,38,38,0.92); padding:3px 8px; border-radius:6px;"><i class="fa-solid fa-lock"></i> ${vcPerms.requiredRoleLabel}</span></div>`}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 4px;">
                <span style="background: rgba(79,70,229,0.12); color: var(--primary); padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 800;">
                  📂 ${subtabLabel}
                </span>
                <span id="vc-dur-badge-${item.ID}" style="font-size: 10px; color: var(--primary); background: rgba(37,99,235,0.08); padding: 2px 6px; border-radius: 999px; font-weight: 700;">
                  <i class="fa-regular fa-clock"></i> ${effectiveDurationLabel}
                </span>
              </div>
              <h4 style="margin: 0 0 4px 0; font-size: 13px; line-height: 1.32; font-weight: 800; color: var(--secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                #${idx + 1}: ${displayTitle}
              </h4>
              <p style="margin: 0; font-size: 10.5px; color: var(--text-muted);">
                ${item.Medium || 'Bilingual'} • <strong>${vcAccess.toUpperCase()}</strong>${vcBatchLabel}
              </p>
            </div>
            <div style="display: flex; gap: 5px; margin-top: 4px;">
              ${vcPerms.canView
                ? `<button class="btn btn-primary btn-sm" style="flex: 1; font-size: 11px; padding: 5px 7px;" onclick="openReferenceVideoModal('${safeUrlAttr}', '${safeTitleAttr}')">
                    <i class="fa-solid fa-circle-play"></i> Video
                  </button>
                  <button class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 5px 7px;" title="Audio-Only Mode with Interactive Timeline Seek Bar" onclick="window.openUniversalMediaViewer('${safeUrlAttr}', '${safeTitleAttr}', true)">
                    <i class="fa-solid fa-headphones"></i> Audio
                  </button>
                  ${vcPerms.canDownload ? `<button class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 5px 7px;" title="Download" onclick="downloadItem('${safeUrlAttr}', '${safeTitleAttr}', '${vcAccess}', '${vcBatchSafe}')"><i class="fa-solid fa-download"></i></button>` : ''}`
                : `<button class="btn btn-secondary btn-sm" style="flex:1; width:100%; font-size:11px; padding:5px 7px; background:var(--border); color:var(--text-muted);" onclick="showToast('Access Denied: Restricted to ${vcPerms.requiredRoleLabel.replace(/'/g, "\\'")}')"><i class="fa-solid fa-lock"></i> Locked</button>`}
            </div>
          </div>
        `;
      });
    }

export let activeLearningLessonIdx = 0;

portalState.learningStartTime = null;

portalState.learningBackspaces = 0;

portalState.learningTimerInterval = null;

export const FINGER_MAP = {
      'Q': 'Left Pinky', 'A': 'Left Pinky', 'Z': 'Left Pinky', '1': 'Left Pinky', '`': 'Left Pinky',
      'W': 'Left Ring', 'S': 'Left Ring', 'X': 'Left Ring', '2': 'Left Ring',
      'E': 'Left Middle', 'D': 'Left Middle', 'C': 'Left Middle', '3': 'Left Middle',
      'R': 'Left Index', 'F': 'Left Index', 'V': 'Left Index', 'T': 'Left Index', 'G': 'Left Index', 'B': 'Left Index', '4': 'Left Index', '5': 'Left Index',
      'Y': 'Right Index', 'H': 'Right Index', 'N': 'Right Index', 'U': 'Right Index', 'J': 'Right Index', 'M': 'Right Index', '6': 'Right Index', '7': 'Right Index',
      'I': 'Right Middle', 'K': 'Right Middle', ',': 'Right Middle', '8': 'Right Middle',
      'O': 'Right Ring', 'L': 'Right Ring', '.': 'Right Ring', '9': 'Right Ring',
      'P': 'Right Pinky', ';': 'Right Pinky', '/': 'Right Pinky', '0': 'Right Pinky', '-': 'Right Pinky', '=': 'Right Pinky', '[': 'Right Pinky', ']': 'Right Pinky', "'": 'Right Pinky',
      ' ': 'Thumbs (Spacebar)'
    };

portalState.pendingEphemeralLearningItem = null;

window._activeLearningSectionMode = 'none';

export function switchLearningTypingSection(mode, btn) {
      const bar = document.getElementById('learning-view-section-tabs');
      let effectiveMode = mode || 'none';

      // Only toggle off when user explicitly clicks the already-active tab button (not programmatic navigation)
      if (effectiveMode !== 'none' && btn && btn.classList.contains('active')) {
        effectiveMode = 'none';
      }
      window._activeLearningSectionMode = effectiveMode;

      // Always exit fullscreen lock cleanly when switching sections
      if (effectiveMode !== 'studio' && typeof openLearningStudioSetupScreen === 'function') {
        openLearningStudioSetupScreen();
      }

      if (bar) {
        bar.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        if (effectiveMode !== 'none') {
          const targetBtn = btn || document.getElementById(effectiveMode === 'studio' ? 'learning-tab-btn-studio' : 'learning-tab-btn-passages');
          if (targetBtn) targetBtn.classList.add('active');
        }
      }
      const promptEl = document.getElementById('learning-no-tab-selected-prompt');
      const studioCard = document.getElementById('learning-section-studio-card');
      const passagesCard = document.getElementById('learning-section-passages-card');
      if (!studioCard || !passagesCard) return;

      if (effectiveMode === 'none') {
        if (promptEl) promptEl.style.display = 'block';
        studioCard.style.display = 'none';
        passagesCard.style.display = 'none';
        return;
      }

      if (promptEl) promptEl.style.display = 'none';
      if (effectiveMode === 'studio') {
        studioCard.style.display = 'flex';
        passagesCard.style.display = 'none';
        initLearningTypingTutor();
      } else if (effectiveMode === 'passages') {
        studioCard.style.display = 'none';
        passagesCard.style.display = 'flex';
        renderLearningUploadedExercisesGrid();
      }
    }

export function initLearningTypingTutor() {
      const customLessons = sortMaterialsLatestFirst(
        (portalState.materialsData || []).filter(m => String(m.Type || '').toLowerCase() === 'learningtyping')
      );
      const studioCustomDrills = customLessons.filter(c => {
        const cat = String(c.Category || '').toLowerCase();
        return !cat.includes('passages_only');
      });
      const passageCustomLessons = customLessons.filter(c => {
        const cat = String(c.Category || '').toLowerCase();
        return !cat.includes('studio_only');
      });
      const countBadge = document.getElementById('learning-passages-count-badge') || document.getElementById('learning-uploaded-count-badge');
      if (countBadge) {
        countBadge.innerText = `${passageCustomLessons.length} Passage${passageCustomLessons.length === 1 ? '' : 's'}`;
      }
      const select = document.getElementById('learning-drill-select') || document.getElementById('learning-lesson-select');
      if (select) {
        const prevVal = select.value;
        const uploadedOpts = studioCustomDrills.map(c => {
          const wCount = countMasterPassageWords(c.ContentOrUrl);
          const sCount = countMasterPassageStrokes(c.ContentOrUrl);
          const rawCat = String(c.Category || '');
          const isStudioUpload = String(c.Subtab || '').includes('Touch-Typing Studio') || rawCat.includes('studio_');
          const parts = rawCat.split('::');
          const zoneLabel = parts[1] || (rawCat.includes('home_row') ? 'Home Row' : (rawCat.includes('top_row') ? 'Top Row' : (rawCat.includes('bottom_row') ? 'Bottom Row' : 'Full Keyboard')));
          return `<option value="custom_${c.ID}">${isStudioUpload ? '[Studio Drill • ' + zoneLabel + ']' : '[Uploaded Passage]'} ${window.escapeHtml(c.Title || 'Lesson')} (${wCount} Words • ${sCount} Strokes)</option>`;
        }).join('');
        select.innerHTML = uploadedOpts
          ? `<option value="">-- Select Uploaded Typing Drill (${studioCustomDrills.length}) --</option><optgroup label="Uploaded Portal Lessons">${uploadedOpts}</optgroup>`
          : `<option value="">No typing drills uploaded yet — upload in Admin Panel or paste custom text</option>`;
        if (prevVal && Array.from(select.options).some(o => o.value === prevVal)) {
          select.value = prevVal;
        }
      }
      renderLearningUploadedExercisesGrid();
      renderLearningKeyboard();
      if (!window.currentLearningTargetText || !window.currentLearningTargetText.trim()) {
        loadLearningLesson(select && select.value ? select.value : '');
      } else {
        updateLearningDisplayAndKeyHighlight();
      }
    }

export function renderLearningUploadedExercisesGrid() {
      const grid = document.getElementById('learning-uploaded-exercises-grid');
      if (!grid) return;

      const searchEl = document.getElementById('learning-passages-search-input') || document.getElementById('learning-uploaded-search-input');
      const q = searchEl ? searchEl.value.toLowerCase().trim() : '';

      let exercises = sortMaterialsLatestFirst(
        (portalState.materialsData || []).filter(m => {
          if (String(m.Type || '').toLowerCase() !== 'learningtyping') return false;
          const cat = String(m.Category || '').toLowerCase();
          return !cat.includes('studio_only');
        })
      );
      const countBadge = document.getElementById('learning-passages-count-badge') || document.getElementById('learning-uploaded-count-badge');
      if (countBadge) {
        countBadge.innerText = `${exercises.length} Passage${exercises.length === 1 ? '' : 's'}`;
      }

      if (q) {
        exercises = exercises.filter(ex =>
          String(ex.Title || '').toLowerCase().includes(q) ||
          String(ex.Subtab || '').toLowerCase().includes(q) ||
          String(ex.Medium || '').toLowerCase().includes(q) ||
          String(ex.ContentOrUrl || '').toLowerCase().includes(q)
        );
      }

      if (exercises.length === 0) {
        grid.innerHTML = '';
        grid.appendChild(createInlineDataLoadStatusEl(true));
        return;
      }

      streamRenderCardsToContainer(grid, exercises, (ex, idx) => {
        const text = String(ex.ContentOrUrl || '').trim();
        const wordsCount = countMasterPassageWords(text);
        const strokesCount = countMasterPassageStrokes(text);
        const rawThumb = getThumbnailUrl(ex);
        const thumbUrl = (rawThumb && String(rawThumb).startsWith('http')) ? rawThumb : DEFAULT_LOGO_URL;
        return `
          <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:6px; border-left: 3px solid #10b981;">
            <div>
              <div class="rp-thumb-frame">
                <img src="${thumbUrl}" class="card-thumb" alt="Learning Typing Thumbnail" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='${DEFAULT_LOGO_URL}'">
                <span style="position:absolute; top:4px; left:4px; background:rgba(15,23,42,0.85); color:#fff; padding:2px 6px; border-radius:999px; font-size:9.5px; font-weight:800;">
                  #${idx + 1} • ${ex.Medium || 'EN'}
                </span>
                <span style="position:absolute; bottom:4px; right:4px; background:rgba(16,185,129,0.92); color:#fff; padding:2px 6px; border-radius:999px; font-size:9.5px; font-weight:800;">
                  ${wordsCount}W • ${strokesCount}S
                </span>
              </div>
              <h4 style="margin:0 0 3px 0; font-size:13px; line-height:1.32; font-weight:800; color:var(--secondary); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${ex.Title || 'Practice Exercise'}</h4>
              <p style="margin:0; font-size:11px; color:var(--text-muted); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                ${text}
              </p>
            </div>
            <div style="display:flex; gap:5px; margin-top:4px;">
              <button class="btn btn-secondary btn-sm" style="flex:1; font-size:10.5px; padding:4px 6px;" onclick="loadLearningLesson('custom_${ex.ID || ex.id}'); window._activeLearningSectionMode='none'; switchLearningTypingSection('studio', document.getElementById('learning-tab-btn-studio'));">
                <i class="fa-solid fa-keyboard"></i> Studio
              </button>
              <button class="btn btn-primary btn-sm" style="flex:1; font-size:10.5px; padding:4px 6px;" onclick="openLearningEphemeralRuleModal('${ex.ID || ex.id}')">
                <i class="fa-solid fa-sliders"></i> Custom Test
              </button>
            </div>
          </div>
        `;
      });
    }

export function resetEphemeralRuleModalDefaults() {
      const setVal = (ids, val) => {
        (Array.isArray(ids) ? ids : [ids]).forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = String(val);
        });
      };
      setVal('ephemeral-preset-rule-loader', '');
      setVal('ephemeral-timer-mode', 'countup');
      setVal('ephemeral-time-limit', '');
      setVal('ephemeral-min-submit-sec', '');
      setVal('ephemeral-word-count-rule', '1word');
      setVal('ephemeral-bs-mode', 'on');
      setVal('ephemeral-bs-limit', '');
      setVal('ephemeral-highlight-mode', 'on');
      setVal('ephemeral-autoscroll-mode', 'on');
      setVal('ephemeral-layout-pos', 'top');
      setVal('ephemeral-font-size', '');
      setVal('ephemeral-total-marks', '');
      setVal('ephemeral-passing-marks', '');
      setVal(['ephemeral-passing-accuracy', 'ephemeral-passing-acc'], '');
      setVal(['ephemeral-ignored-error-pct', 'ephemeral-ignore-error-pct'], '');
      setVal(['ephemeral-penalty-multiplier', 'ephemeral-penalty-mult'], '');
      setVal('ephemeral-min-gross-pct', '');
      setVal(['ephemeral-min-initial-shown', 'ephemeral-initial-words'], '');
      setVal('ephemeral-copypaste-lock', 'true');
      setVal('ephemeral-deduct-wrong', '');
      setVal('ephemeral-deduct-omission', '');
      setVal('ephemeral-deduct-extra', '');
      setVal('ephemeral-deduct-verb', '');
      setVal('ephemeral-deduct-singular-plural', '');
      setVal('ephemeral-punct-mode', 'all');
      setVal('ephemeral-deduct-punct', '');
      setVal('ephemeral-deduct-capital', '');
      setVal('ephemeral-deduct-para', '');
    }

export function applySavedRuleToEphemeralModal(ruleKey) {
      if (!ruleKey) {
        resetEphemeralRuleModalDefaults();
        return;
      }
      const r = getEvaluationRulesForTab(ruleKey) || {};
      const setVal = (ids, val) => {
        (Array.isArray(ids) ? ids : [ids]).forEach(id => {
          const el = document.getElementById(id);
          if (el && val !== undefined && val !== null) el.value = String(val);
        });
      };
      setVal('ephemeral-timer-mode', parseInt(r.timeLimit) > 0 ? 'countdown' : 'countup');
      setVal('ephemeral-time-limit', r.timeLimit ?? '');
      setVal('ephemeral-min-submit-sec', r.minTimeSeconds ?? r.minSubmitTimeSec ?? '');
      setVal('ephemeral-word-count-rule', r.wordCountRule || '1word');
      setVal('ephemeral-bs-mode', r.backspaceMode || 'on');
      setVal('ephemeral-bs-limit', r.backspaceLimit ?? '');
      setVal('ephemeral-highlight-mode', r.highlightMode || 'on');
      setVal('ephemeral-autoscroll-mode', r.autoScrollMode || 'on');
      setVal('ephemeral-layout-pos', r.layoutPosition || 'top');
      setVal('ephemeral-font-size', r.defaultTextSize ?? '');
      setVal('ephemeral-total-marks', r.totalMarks ?? '');
      setVal('ephemeral-passing-marks', r.passingMarks ?? '');
      setVal(['ephemeral-passing-accuracy', 'ephemeral-passing-acc'], r.passingAccuracy ?? '');
      setVal(['ephemeral-ignored-error-pct', 'ephemeral-ignore-error-pct'], r.ignoreErrorPct ?? r.ignoredErrorPct ?? '');
      setVal(['ephemeral-penalty-multiplier', 'ephemeral-penalty-mult'], r.penaltyValue ?? r.penaltyMultiplier ?? '');
      setVal('ephemeral-min-gross-pct', r.minGrossStrokePct ?? '');
      setVal(['ephemeral-min-initial-shown', 'ephemeral-initial-words'], r.initialWords ?? r.minInitialWordsShown ?? '');
      const cpLock = (r.copyPasteMode === 'no' || r.copyPasteRestricted === false) ? 'false' : 'true';
      setVal('ephemeral-copypaste-lock', cpLock);
      setVal('ephemeral-deduct-wrong', r.deductWrong ?? '');
      setVal('ephemeral-deduct-omission', r.deductOmission ?? '');
      setVal('ephemeral-deduct-extra', r.deductExtraWord ?? '');
      setVal('ephemeral-deduct-verb', r.deductVerbForm ?? r.deductVerb ?? '');
      setVal('ephemeral-deduct-singular-plural', r.deductSingularPlural ?? '');
      const pMode = (r.punctRuleMode === 'ignore_all' || r.punctRuleMode === 'ignore')
        ? 'ignore'
        : (r.punctRuleMode === 'fullstop_only' ? 'fullstop_only' : 'all');
      setVal('ephemeral-punct-mode', pMode);
      setVal('ephemeral-deduct-punct', r.deductPunctuation ?? '');
      setVal('ephemeral-deduct-capital', r.deductCapital ?? '');
      setVal('ephemeral-deduct-para', r.deductParaNotChanged ?? r.deductParaChange ?? '');
      showToast(`Loaded Evaluation Rule Template: ${r.examDisplayName || ruleKey}`);
    }

export function openLearningEphemeralRuleModal(exId) {
      const item = (portalState.materialsData || []).find(m => String(m.ID || m.id) === String(exId));
      if (!item) {
        showToast('Learning exercise not found.');
        return;
      }
      portalState.pendingEphemeralLearningItem = item;
      populateEphemeralPresetRulesDropdown();
      resetEphemeralRuleModalDefaults();

      const wordsCount = countMasterPassageWords(item.ContentOrUrl);
      const strokesCount = countMasterPassageStrokes(item.ContentOrUrl);
      const titleEl = document.getElementById('learning-ephemeral-exercise-title');
      if (titleEl) {
        titleEl.innerText = `Exercise: ${item.Title} (${wordsCount} Words • ${strokesCount} Total Strokes • ${item.Medium || 'English'})`;
      }

      const modal = document.getElementById('learning-ephemeral-rule-modal');
      if (modal) modal.style.display = 'flex';
    }

export function launchLearningEphemeralExercise() {
      const item = portalState.pendingEphemeralLearningItem;
      if (!item) return;

      const getElVal = (id1, id2) => (document.getElementById(id1) || (id2 ? document.getElementById(id2) : null))?.value;
      const numOrZero = (raw) => {
        if (raw === undefined || raw === null || String(raw).trim() === '') return 0;
        const n = parseFloat(raw);
        return isNaN(n) ? 0 : n;
      };
      const timerMode = getElVal('ephemeral-timer-mode') || 'countup';
      const timeLimitVal = parseInt(getElVal('ephemeral-time-limit'), 10) || 0;
      if (timerMode === 'countdown' && timeLimitVal <= 0) {
        showToast('Please enter a Countdown Time Limit (Minutes) or select a saved Admin Rule template.');
        document.getElementById('ephemeral-time-limit')?.focus();
        return;
      }
      const minSubmitSec = Math.max(0, parseInt(getElVal('ephemeral-min-submit-sec'), 10) || 0);
      const wordCountRule = getElVal('ephemeral-word-count-rule') || '1word';
      const bsMode = getElVal('ephemeral-bs-mode') || 'on';
      const bsLimit = Math.max(0, parseInt(getElVal('ephemeral-bs-limit'), 10) || 0);
      const hlMode = getElVal('ephemeral-highlight-mode') || 'on';
      const asMode = getElVal('ephemeral-autoscroll-mode') || 'on';
      const layoutPos = getElVal('ephemeral-layout-pos') || 'top';
      const rawFont = parseInt(getElVal('ephemeral-font-size'), 10);
      const fontSize = !isNaN(rawFont) ? Math.max(12, Math.min(28, rawFont)) : 16;
      const totalMarks = numOrZero(getElVal('ephemeral-total-marks'));
      const passingMarks = numOrZero(getElVal('ephemeral-passing-marks'));
      const passingAcc = numOrZero(getElVal('ephemeral-passing-accuracy', 'ephemeral-passing-acc'));
      const ignoreErrPct = numOrZero(getElVal('ephemeral-ignored-error-pct', 'ephemeral-ignore-error-pct'));
      const penaltyMult = numOrZero(getElVal('ephemeral-penalty-multiplier', 'ephemeral-penalty-mult'));
      const minGrossPct = numOrZero(getElVal('ephemeral-min-gross-pct'));
      const initialWordsVal = Math.max(0, parseInt(getElVal('ephemeral-min-initial-shown', 'ephemeral-initial-words'), 10) || 0);
      const rawCpLock = getElVal('ephemeral-copypaste-lock') || 'true';
      const isCpRestricted = rawCpLock === 'true' || rawCpLock === 'yes';
      const copyPasteLock = isCpRestricted ? 'yes' : 'no';
      const deductWrong = numOrZero(getElVal('ephemeral-deduct-wrong'));
      const deductOmission = numOrZero(getElVal('ephemeral-deduct-omission'));
      const deductExtra = numOrZero(getElVal('ephemeral-deduct-extra'));
      const deductVerb = numOrZero(getElVal('ephemeral-deduct-verb'));
      const deductSingularPlural = numOrZero(getElVal('ephemeral-deduct-singular-plural'));
      const rawPunctMode = getElVal('ephemeral-punct-mode') || 'all';
      const punctMode = (rawPunctMode === 'ignore' || rawPunctMode === 'ignore_all')
        ? 'ignore_all'
        : (rawPunctMode === 'fullstop_only' ? 'fullstop_only' : 'all_punct');
      const deductPunct = numOrZero(getElVal('ephemeral-deduct-punct'));
      const deductCapital = numOrZero(getElVal('ephemeral-deduct-capital'));
      const deductPara = numOrZero(getElVal('ephemeral-deduct-para'));

      document.getElementById('learning-ephemeral-rule-modal').style.display = 'none';

      const isCountUp = timerMode === 'countup';
      window.lastOriginTabBeforeTest = 'learningtyping';
      window.isCountUpTimerMode = isCountUp;
      window.showingCompletePassageOverride = false;

      const ephemeralRuleName = isCountUp ? 'One-Time Custom Rule (Self-Paced User Time)' : `One-Time Custom Rule (${timeLimitVal} Mins Countdown)`;
      const ephemeralRules = {
        isOneTimeLearningRule: true,
        examDisplayName: ephemeralRuleName,
        timeLimit: isCountUp ? 0 : timeLimitVal,
        minTimeSeconds: minSubmitSec,
        minSubmitTimeSec: minSubmitSec,
        wordCountRule: wordCountRule,
        backspaceMode: bsMode,
        backspaceLimit: bsLimit,
        highlightMode: hlMode,
        autoScrollMode: asMode,
        layoutPosition: layoutPos,
        defaultTextSize: fontSize,
        totalMarks: totalMarks,
        passingMarks: passingMarks,
        passingAccuracy: passingAcc,
        ignoreErrorPct: ignoreErrPct,
        ignoredErrorPct: ignoreErrPct,
        penaltyValue: penaltyMult,
        penaltyMultiplier: penaltyMult,
        minGrossStrokePct: minGrossPct,
        initialWordsMode: initialWordsVal > 0 ? 'custom' : 'all',
        initialWords: initialWordsVal,
        minInitialWordsShown: initialWordsVal,
        copyPasteMode: copyPasteLock,
        funcKeysMode: copyPasteLock,
        copyPasteRestricted: isCpRestricted,
        deductWrong: isNaN(deductWrong) ? 0 : deductWrong,
        deductOmission: isNaN(deductOmission) ? 0 : deductOmission,
        deductExtraWord: isNaN(deductExtra) ? 0 : deductExtra,
        deductVerbForm: isNaN(deductVerb) ? 0 : deductVerb,
        deductVerb: isNaN(deductVerb) ? 0 : deductVerb,
        deductSingularPlural: isNaN(deductSingularPlural) ? 0 : deductSingularPlural,
        punctRuleMode: punctMode,
        deductPunctuation: punctMode === 'ignore_all' ? 0 : (isNaN(deductPunct) ? 0 : deductPunct),
        deductCapital: isNaN(deductCapital) ? 0 : deductCapital,
        deductParaNotChanged: isNaN(deductPara) ? 0 : deductPara,
        deductParaChange: isNaN(deductPara) ? 0 : deductPara,
        ignoreParagraphChange: deductPara <= 0 ? 'yes' : 'no'
      };

      portalState.activeTestSubtabKey = 'ephemeral_learning_once';
      window.currentExamRules = ephemeralRules;
      portalState.allEvaluationRules['ephemeral_learning_once'] = ephemeralRules;
      // 👉 REQUIREMENT #5: Store distinct Exam Rule Title and Passage Title
      window.currentActiveExamRuleTitle = ephemeralRuleName;
      window.currentActivePassageTitle = item.Title || 'Custom Rule Practice Passage';
      portalState.currentExamName = `Learning Exercise: ${item.Title} [${ephemeralRuleName}]`;
      portalState.testDurationMinutes = isCountUp ? 0 : timeLimitVal;
      portalState.testBackspaces = 0;
      portalState.testStartTime = Date.now();
      const rawFullPassage = item.ContentOrUrl || '';
      const totalFullWords = countMasterPassageWords(rawFullPassage);
      const totalFullStrokes = countMasterPassageStrokes(rawFullPassage);
      const is5Stroke = wordCountRule === '5stroke';
      portalState.currentReferenceText = preparePassageForInitialWordsRule(rawFullPassage, ephemeralRules);
      const hasInitialWordsSlice = (initialWordsVal > 0 && (is5Stroke ? totalFullStrokes > initialWordsVal : totalFullWords > initialWordsVal));
      portalState.isTestPaused = false;
      portalState.isTypingTimerStarted = false;
      portalState.currentPassageFontSize = fontSize;

      document.getElementById('test-modal-title').innerText = portalState.currentExamName;
      const timerEl = document.getElementById('test-timer');
      if (timerEl) {
        timerEl.innerText = isCountUp ? '⏱️ 00:00 (User Time)' : `${String(portalState.testDurationMinutes).padStart(2, '0')}:00`;
      }
      const statusBar = document.getElementById('live-typing-status-bar');
      if (statusBar) statusBar.style.display = 'flex';
      const footerBar = document.getElementById('active-test-footer-bar');
      if (footerBar) footerBar.style.display = 'flex';
      updateTestSubmitMinTimeLockUI(0);

      const layoutFlexDir = layoutPos === 'left' ? 'flex-direction: row; flex-wrap: wrap;' : 'flex-direction: column;';
      const mainBody = document.getElementById('test-main-body-container');
      mainBody.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 1180px; flex: 1; margin: 0 auto;">
          <div style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); padding: 10px 16px; border-radius: 10px; font-size: 12px; font-weight: 700; color: var(--secondary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <span><i class="fa-solid fa-sliders" style="color:#10b981;"></i> Custom Practice Rule Active — Timer: <strong>${isCountUp ? 'Self-Paced Count-Up' : timeLimitVal + 'm Countdown'}</strong> • Word Formula: <strong>${is5Stroke ? '5 Strokes=1W' : '1 Space=1W'}</strong> • Backspace: <strong>${bsMode.toUpperCase()}</strong> • Highlight: <strong>${hlMode.toUpperCase()}</strong> • Scroll: <strong>${asMode.toUpperCase()}</strong></span>
            ${hasInitialWordsSlice ? `<button type="button" id="btn-toggle-complete-passage" class="btn btn-sm btn-primary" style="padding: 2px 8px; font-size: 11px;" onclick="toggleCompletePassageInActiveTest()"><i class="fa-solid fa-expand"></i> Show Complete Passage (${totalFullWords} Words • ${totalFullStrokes} Strokes)</button>` : `<span style="color:#059669;">📝 ${totalFullWords} Words • ⌨️ ${totalFullStrokes} Total Strokes</span>`}
          </div>
          <div style="display: flex; ${layoutFlexDir} gap: 12px; flex: 1; min-height: 0; align-items: stretch;">
            <div id="test-material-passage-text" style="flex: 1; min-width: 280px; background: var(--surface); padding: 18px; border-radius: var(--radius); border: 1px solid var(--border); font-size: ${fontSize}px; line-height: 1.75; max-height: 240px; overflow-y: auto; user-select: none; white-space: pre-wrap;">${portalState.currentReferenceText}</div>
            <textarea id="test-user-input" class="form-control" spellcheck="false" autocorrect="off" autocapitalize="off" autocomplete="off" style="flex: 1; min-width: 280px; width: 100%; min-height: 240px; font-family: 'Segoe UI', monospace; font-size: ${fontSize}px; padding: 14px;" placeholder="Start typing the learning exercise here (Timer starts on your first keystroke)..." oninput="handleTypingInputProgress()" onkeydown="handleTestKeyDown(event)" onpaste="handleTestPaste(event)" oncopy="handleTestCopy(event)" oncut="handleTestCut(event)"></textarea>
          </div>
        </div>
      `;

      configureActiveTestModalChrome('learning_exercise');
      portalState.currentTestFontSize = fontSize;
      document.documentElement.style.setProperty('--test-active-font-size', fontSize + 'px');
      document.documentElement.style.setProperty('--mobile-test-font-size', fontSize + 'px');
      const learningBadge = document.getElementById('test-header-font-size-badge');
      if (learningBadge) learningBadge.textContent = fontSize + 'px';
      const learningInput = document.getElementById('test-user-input');
      if (learningInput) learningInput.style.setProperty('font-size', fontSize + 'px', 'important');
      const learningPassage = document.getElementById('test-material-passage-text');
      if (learningPassage) learningPassage.style.setProperty('font-size', fontSize + 'px', 'important');
      const rBanner = document.getElementById('mandatory-reading-phase-banner');
      if (rBanner) { rBanner.classList.add('hidden'); rBanner.style.display = 'none'; }
      document.getElementById('active-test-modal').style.display = 'flex'; if (typeof enterImmersiveFullscreenLock === 'function') enterImmersiveFullscreenLock('active-test-modal');
      updateLiveTypingStatusBar('Ready - Custom Rule Practice Mode');
      if (isCountUp) {
        startTestTimer(0);
      }
    }

export function getVisualKeyDomId(rawKey) {
      if (rawKey === ' ' || rawKey === 'SPACE') return 'vkey-SPACE';
      const k = String(rawKey || '').toUpperCase();
      const map = {
        '-': 'MINUS', '=': 'EQUAL', '[': 'LBRACKET', ']': 'RBRACKET',
        ';': 'SEMICOLON', "'": 'QUOTE', ',': 'COMMA', '.': 'PERIOD', '/': 'SLASH'
      };
      return 'vkey-' + (map[k] || k.replace(/[^A-Z0-9]/g, 'OTHER'));
    }

export function renderLearningKeyboard() {
      const kb = document.getElementById('learning-visual-keyboard');
      if (!kb) return;
      const rows = [
        ['1','2','3','4','5','6','7','8','9','0','-','='],
        ['Q','W','E','R','T','Y','U','I','O','P','[',']'],
        ['A','S','D','F','G','H','J','K','L',';',"'"],
        ['Z','X','C','V','B','N','M',',','.','/'],
        ['SPACE']
      ];
      const getFingerColor = (k) => {
        if (k === 'SPACE') return '#10b981';
        const f = FINGER_MAP[k] || '';
        if (f.includes('Pinky')) return '#ec4899';
        if (f.includes('Ring')) return '#f59e0b';
        if (f.includes('Middle')) return '#3b82f6';
        return '#8b5cf6';
      };
      kb.innerHTML = rows.map(r => `
        <div style="display: flex; gap: 5px; justify-content: center; flex-wrap: nowrap;">
          ${r.map(k => {
            const isSpace = k === 'SPACE';
            const isHomeKey = ['F', 'J'].includes(k);
            const accent = getFingerColor(k);
            const domId = getVisualKeyDomId(k);
            return `<div id="${domId}" style="min-width: ${isSpace ? '240px' : '36px'}; height: 36px; padding: 0 7px; border-radius: 7px; background: var(--surface); border: 1px solid var(--border); border-bottom: 3px solid ${accent}; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; color: var(--secondary); box-shadow: 0 2px 4px rgba(15,23,42,0.06); transition: all 0.12s ease; position: relative; flex-shrink: 0;">
              <span>${isSpace ? 'SPACEBAR' : window.escapeHtml(k)}</span>
              ${isHomeKey ? `<span style="width:10px; height:2px; background:${accent}; border-radius:2px; position:absolute; bottom:3px;"></span>` : ''}
            </div>`;
          }).join('')}
        </div>
      `).join('');
    }

export function loadLearningLesson(val) {
      let lessonText = '';
      const keyStr = String(val || '').trim();
      if (keyStr.startsWith('custom_')) {
        const id = keyStr.replace('custom_', '');
        const custom = (portalState.materialsData || []).find(m => String(m.ID || m.id) === id);
        lessonText = custom ? (custom.ContentOrUrl || '') : '';
      }

      window.currentLearningTargetText = (lessonText || '').replace(/\s+/g, ' ').trim();
      portalState.learningStartTime = null;
      portalState.learningBackspaces = 0;
      if (portalState.learningTimerInterval) {
        clearInterval(portalState.learningTimerInterval);
        portalState.learningTimerInterval = null;
      }
      const elapsedEl = document.getElementById('learn-elapsed-time');
      if (elapsedEl) elapsedEl.innerText = '00:00';

      const input = document.getElementById('learning-user-input') || document.getElementById('learning-typing-input');
      if (input) input.value = '';

      const statusBadge = document.getElementById('learn-status-badge');
      if (statusBadge) statusBadge.innerText = 'READY';

      const wpmEl = document.getElementById('learn-wpm') || document.getElementById('learning-live-wpm');
      const accEl = document.getElementById('learn-accuracy') || document.getElementById('learning-live-acc');
      const strEl = document.getElementById('learn-strokes') || document.getElementById('learning-live-strokes');
      const bsEl = document.getElementById('learn-backspaces') || document.getElementById('learning-live-bs');
      const progBar = document.getElementById('learning-progress-bar-fill');

      if (wpmEl) wpmEl.innerText = '0';
      if (accEl) accEl.innerText = '100%';
      if (strEl) strEl.innerText = `0 / ${window.currentLearningTargetText.length}`;
      if (bsEl) bsEl.innerText = '0';
      if (progBar) progBar.style.width = '0%';

      updateLearningDisplayAndKeyHighlight();
    }

export function resetLearningLesson() {
      const select = document.getElementById('learning-drill-select') || document.getElementById('learning-lesson-select');
      loadLearningLesson(select ? select.value : activeLearningLessonIdx);
      const input = document.getElementById('learning-user-input') || document.getElementById('learning-typing-input');
      if (input) input.focus();
    }

export function applyLearningStudioLayoutPosition(pos) {
      const splitWrap = document.getElementById('learning-studio-workspace-split');
      if (!splitWrap) return;
      if (pos === 'left') {
        splitWrap.style.flexDirection = 'row';
        splitWrap.style.flexWrap = 'wrap';
      } else {
        splitWrap.style.flexDirection = 'column';
      }
    }

export function speakStudioTextUtterance(textToSpeak, rate = 1.0) {
      if (!('speechSynthesis' in window) || !textToSpeak) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(textToSpeak));
        u.rate = rate;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }

export function speakStudioCurrentWordNow() {
      const target = window.currentLearningTargetText || '';
      const inputEl = document.getElementById('learning-user-input') || document.getElementById('learning-typing-input');
      const typed = inputEl ? inputEl.value : '';
      if (!target) {
        showToast('Select or load a drill passage first to hear Word Speech.');
        return;
      }
      const pos = Math.min(typed.length, Math.max(0, target.length - 1));
      const leftPart = target.slice(0, pos);
      const rightPart = target.slice(pos);
      const wordStart = leftPart.lastIndexOf(' ') + 1;
      const nextSpaceOffset = rightPart.indexOf(' ');
      const wordEnd = nextSpaceOffset === -1 ? target.length : pos + nextSpaceOffset;
      const currentWord = target.slice(wordStart, wordEnd).trim() || target.split(/\s+/)[0] || 'Space';
      speakStudioTextUtterance(currentWord, 0.95);
    }

export function speakStudioCurrentStrokeNow() {
      const target = window.currentLearningTargetText || '';
      const inputEl = document.getElementById('learning-user-input') || document.getElementById('learning-typing-input');
      const typed = inputEl ? inputEl.value : '';
      if (!target) {
        showToast('Select or load a drill passage first to hear Stroke Speech.');
        return;
      }
      const nextChar = target[typed.length] || '';
      if (!nextChar) {
        speakStudioTextUtterance('Lesson Completed', 1.0);
        return;
      }
      const spokenChar = nextChar === ' ' ? 'Spacebar' : (nextChar === '.' ? 'Full Stop' : (nextChar === ',' ? 'Comma' : nextChar));
      speakStudioTextUtterance(spokenChar, 1.08);
    }

export function updateLearningStudioCompleteRules() {
      const bsSelect = document.getElementById('learning-backspace-select');
      const customBsInput = document.getElementById('learning-studio-bs-limit-input') || document.getElementById('learning-backspace-custom-limit');
      if (bsSelect && customBsInput) {
        customBsInput.style.display = bsSelect.value === 'limited_custom' ? 'inline-block' : 'none';
      }
      const layoutSelect = document.getElementById('learning-studio-layout-select');
      if (layoutSelect) {
        applyLearningStudioLayoutPosition(layoutSelect.value);
      }
      updateLearningDisplayAndKeyHighlight();
    }

export function speakLearningStudioCurrentWordAndStroke(mode) {
      if (mode === 'stroke') {
        speakStudioCurrentStrokeNow();
      } else {
        speakStudioCurrentWordNow();
      }
    }

export function handleLearningKeyDown(event) {
      if (event.key === 'Backspace' || event.key === 'Delete') {
        const bsSelect = document.getElementById('learning-backspace-select');
        const bsMode = bsSelect ? bsSelect.value : 'on';
        if (bsMode === 'off') {
          event.preventDefault();
          showToast('🚫 Backspace is disabled in this drill mode!');
          return;
        }
        if (bsMode === 'until_space') {
          const inputEl = document.getElementById('learning-user-input') || document.getElementById('learning-typing-input');
          const val = inputEl ? inputEl.value : '';
          const selStart = inputEl && typeof inputEl.selectionStart === 'number' ? inputEl.selectionStart : val.length;
          const selEnd = inputEl && typeof inputEl.selectionEnd === 'number' ? inputEl.selectionEnd : val.length;
          if (selStart === selEnd && selStart > 0 && /\s/.test(val[selStart - 1])) {
            event.preventDefault();
            showToast('🚫 Backspace only works for the current word before Spacebar is pressed!');
            return;
          }
        }
        if (bsMode.startsWith('limited_')) {
          const customLimEl = document.getElementById('learning-studio-bs-limit-input') || document.getElementById('learning-backspace-custom-limit');
          const maxBs = bsMode === 'limited_custom'
            ? (Math.max(1, parseInt(customLimEl?.value) || 20))
            : (parseInt(bsMode.replace('limited_', '')) || 15);
          if (portalState.learningBackspaces >= maxBs) {
            event.preventDefault();
            showToast(`🚫 Limited Backspace reached (${maxBs}/${maxBs})!`);
            return;
          }
        }
        portalState.learningBackspaces++;
        const bsEl = document.getElementById('learn-backspaces') || document.getElementById('learning-live-bs');
        if (bsEl) bsEl.innerText = portalState.learningBackspaces;
      }
      if (portalState.isExamHallSoundActive && portalState.examHallAudioCtx) {
        triggerExamHallKeyClick(portalState.examHallAudioCtx, 1.1);
      }
      if (typeof window.recordKeystrokeLatencyForHeatmap === 'function') {
        window.recordKeystrokeLatencyForHeatmap(event, 'learning');
      }
    }

export function updateLearningDisplayAndKeyHighlight() {
      const target = window.currentLearningTargetText || '';
      const inputEl = document.getElementById('learning-user-input') || document.getElementById('learning-typing-input');
      const typed = inputEl ? inputEl.value : '';
      const display = document.getElementById('learning-target-display');
      const hlMode = (document.getElementById('learning-studio-highlight-select') || document.getElementById('learning-highlight-select'))?.value || 'on';
      const autoScrollMode = (document.getElementById('learning-studio-autoscroll-select') || document.getElementById('learning-autoscroll-select'))?.value || 'on';

      let correctChars = 0;
      let html = '';
      const escChar = (c) => c === '&' ? '&amp;' : (c === '<' ? '&lt;' : (c === '>' ? '&gt;' : c));
      if (!target) {
        html = `<span style="color:var(--text-muted); font-size:15px;">Choose a key drill or paste custom text on the setup screen to start practicing.</span>`;
      } else {
        for (let i = 0; i < target.length; i++) {
          const ch = target[i];
          const safeCh = escChar(ch);
          if (i < typed.length) {
            if (typed[i] === ch) {
              correctChars++;
              html += hlMode === 'on'
                ? `<span style="color: #16a34a; background: rgba(22,163,74,0.12); border-radius: 3px;">${safeCh}</span>`
                : `<span style="color: var(--secondary);">${safeCh}</span>`;
            } else {
              const wrongDisplay = ch === ' ' ? '␣' : safeCh;
              html += hlMode === 'on'
                ? `<span style="color: #fff; background: #dc2626; border-radius: 3px; padding: 0 1px;">${wrongDisplay}</span>`
                : `<span style="color: var(--secondary);">${safeCh}</span>`;
            }
          } else if (i === typed.length) {
            const curDisplay = ch === ' ' ? '&nbsp;' : safeCh;
            html += hlMode === 'on'
              ? `<span id="learning-active-char" style="background: var(--primary); color: #fff; padding: 1px 4px; border-radius: 4px; box-shadow: 0 2px 6px rgba(79,70,229,0.35);">${curDisplay}</span>`
              : `<span id="learning-active-char" style="border-bottom: 2px solid var(--primary);">${curDisplay}</span>`;
          } else {
            html += `<span style="color: var(--text-muted);">${safeCh}</span>`;
          }
        }
      }
      if (display) {
        display.innerHTML = html;
        if (autoScrollMode === 'on') {
          const activeCharEl = document.getElementById('learning-active-char');
          if (activeCharEl) {
            const offsetTop = activeCharEl.offsetTop - display.offsetTop;
            if (offsetTop > display.clientHeight * 0.55 || offsetTop < display.scrollTop) {
              display.scrollTop = Math.max(0, offsetTop - 36);
            }
          }
        }
      }

      const progBar = document.getElementById('learning-progress-bar-fill');
      if (progBar) {
        const pct = target.length > 0 ? Math.min(100, Math.round((typed.length / target.length) * 100)) : 0;
        progBar.style.width = `${pct}%`;
      }

      document.querySelectorAll('[id^="vkey-"]').forEach(el => {
        el.style.background = 'var(--surface)';
        el.style.color = 'var(--secondary)';
        el.style.transform = 'scale(1)';
      });

      const nextChar = target[typed.length] || '';
      const keyElem = nextChar ? document.getElementById(getVisualKeyDomId(nextChar)) : null;
      if (keyElem) {
        keyElem.style.background = 'var(--primary)';
        keyElem.style.color = '#ffffff';
        keyElem.style.transform = 'translateY(-2px) scale(1.06)';
      }

      const nextKeyLabel = nextChar === ' ' ? 'SPACEBAR' : (nextChar || 'Done!');
      const fingerLabel = FINGER_MAP[nextChar.toUpperCase()] || 'Home Row Ready';

      const fingerHintEl = document.getElementById('learn-finger-hint');
      if (fingerHintEl) {
        fingerHintEl.innerText = nextChar ? `${fingerLabel} → Press '${nextKeyLabel}'` : 'Lesson Completed! 🎉';
      }

      const nextKeyBadge = document.getElementById('learning-next-key-badge');
      const fingerBadge = document.getElementById('learning-finger-badge');
      if (nextKeyBadge) nextKeyBadge.innerText = nextKeyLabel;
      if (fingerBadge) fingerBadge.innerText = fingerLabel;

      const totalWords = target.trim() ? target.trim().split(/\s+/).length : 0;
      const typedWords = typed.trim() ? typed.trim().split(/\s+/).length : 0;
      const strEl = document.getElementById('learn-strokes') || document.getElementById('learning-live-strokes');
      if (strEl) strEl.innerText = `${typedWords} / ${totalWords} W • ${typed.length} / ${target.length} Str`;

      return { correctChars, typedLen: typed.length, targetLen: target.length, typedWords, totalWords };
    }

window.__shiftActiveExamStartTimers = function(deltaMs) {
      const shift = Number(deltaMs) || 0;
      if (shift <= 0) return;
      if (typeof portalState.testStartTime === 'number' && portalState.testStartTime > 0) portalState.testStartTime += shift;
      if (typeof portalState.learningStartTime === 'number' && portalState.learningStartTime > 0) portalState.learningStartTime += shift;
      if (typeof portalState.cbtCurrentQuestionEnteredAtMs === 'number' && portalState.cbtCurrentQuestionEnteredAtMs > 0) portalState.cbtCurrentQuestionEnteredAtMs += shift;
      if (typeof window.cbtExamStartedAtMs === 'number' && window.cbtExamStartedAtMs > 0) window.cbtExamStartedAtMs += shift;
    };

export function updateLearningElapsedClockUI() {
      if (!portalState.learningStartTime || window.__examOfflinePaused) return;
      const elapsedSec = Math.max(0, Math.floor((Date.now() - portalState.learningStartTime) / 1000));
      const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const ss = String(elapsedSec % 60).padStart(2, '0');
      const elapsedEl = document.getElementById('learn-elapsed-time');
      if (elapsedEl) elapsedEl.innerText = `${mm}:${ss}`;
    }

export function handleLearningTypingInput() {
      if (!portalState.learningStartTime) {
        portalState.learningStartTime = Date.now();
        if (portalState.learningTimerInterval) clearInterval(portalState.learningTimerInterval);
        portalState.learningTimerInterval = setInterval(updateLearningElapsedClockUI, 1000);
      }
      updateLearningElapsedClockUI();
      const statusBadge = document.getElementById('learn-status-badge');
      if (statusBadge) statusBadge.innerText = 'TYPING...';

      const stats = updateLearningDisplayAndKeyHighlight();
      const elapsedMin = Math.max((Date.now() - portalState.learningStartTime) / 60000, 0.05);
      const wcRule = (document.getElementById('learning-studio-wordrule-select') || document.getElementById('learning-wordcount-rule-select'))?.value || '5stroke';
      const wpmByStroke = Math.round((stats.typedLen / 5) / elapsedMin);
      const wpmBySpace = Math.round(stats.typedWords / elapsedMin);
      const wpm = wcRule === '1word' ? wpmBySpace : wpmByStroke;
      const cpm = Math.round(stats.typedLen / elapsedMin);
      const acc = stats.typedLen > 0 ? Math.round((stats.correctChars / stats.typedLen) * 100) : 100;

      const wpmEl = document.getElementById('learn-wpm') || document.getElementById('learning-live-wpm');
      const subWpmEl = document.getElementById('learn-words-strokes-sub');
      const accEl = document.getElementById('learn-accuracy') || document.getElementById('learning-live-acc');
      const strEl = document.getElementById('learn-strokes') || document.getElementById('learning-live-strokes');

      if (wpmEl) wpmEl.innerText = wpm;
      if (subWpmEl) subWpmEl.innerText = `(${wpmBySpace} WPM • ${cpm} Strokes/m)`;
      if (accEl) accEl.innerText = `${acc}%`;
      if (strEl) strEl.innerText = `${stats.typedWords} / ${stats.totalWords} W • ${stats.typedLen} / ${stats.targetLen} Str`;

      // 👉 REQUIREMENT #6: Trigger Studio Voice Speech for Words, Strokes, or Both
      const speechMode = (document.getElementById('learning-studio-speech-mode-select') || document.getElementById('learning-speech-mode-select'))?.value || 'off';
      if (speechMode !== 'off') {
        const target = window.currentLearningTargetText || '';
        const inputEl = document.getElementById('learning-user-input') || document.getElementById('learning-typing-input');
        const typed = inputEl ? inputEl.value : '';
        const lastTypedChar = typed[typed.length - 1] || '';
        if (speechMode === 'strokes') {
          speakStudioCurrentStrokeNow();
        } else if (speechMode === 'words') {
          if (typed.length === 1 || lastTypedChar === ' ') {
            speakStudioCurrentWordNow();
          }
        } else if (speechMode === 'both') {
          if (typed.length === 1 || lastTypedChar === ' ') {
            speakStudioCurrentWordNow();
          } else {
            speakStudioCurrentStrokeNow();
          }
        }
      }

      if (stats.typedLen >= stats.targetLen && stats.targetLen > 0) {
        if (portalState.learningTimerInterval) {
          clearInterval(portalState.learningTimerInterval);
          portalState.learningTimerInterval = null;
        }
        if (statusBadge) statusBadge.innerText = 'DONE!';
        showToast(`🎉 Lesson Completed! Speed: ${wpm} WPM (${cpm} Strokes/m) | Accuracy: ${acc}%`);
      }
    }

window.isKeystrokeLatencyHeatmapEnabled = localStorage.getItem('steno_latency_heatmap_on') !== 'false';

window.keystrokeLatencyStatsMap = {};

window.lastKeystrokeTimestampMs = 0;

window.recentKeystrokeIntervalsMs = [];

export function toggleKeystrokeLatencyHeatmap(isEnabled, source = 'learning') {
      const nextState = typeof isEnabled === 'boolean' ? isEnabled : !window.isKeystrokeLatencyHeatmapEnabled;
      window.isKeystrokeLatencyHeatmapEnabled = nextState;
      try {
        localStorage.setItem('steno_latency_heatmap_on', nextState ? 'true' : 'false');
      } catch (e) {}

      const learnChk = document.getElementById('learning-latency-heatmap-toggle');
      const testChk = document.getElementById('test-latency-heatmap-toggle');
      if (learnChk) learnChk.checked = nextState;
      if (testChk) testChk.checked = nextState;

      // Support both sets of DOM IDs in Learning Studio and Active Test Modal
      const learnPanel = document.getElementById('learning-rhythm-heatmap-panel') || document.getElementById('learning-latency-heatmap-body');
      const learnStateLabel = document.getElementById('learning-heatmap-state-label') || document.getElementById('learning-heatmap-status-badge');
      const learnToggleBtn = document.getElementById('learning-heatmap-toggle-btn');
      const testWrap = document.getElementById('active-test-rhythm-heatmap-bar') || document.getElementById('test-live-latency-heatmap-bar');
      const testToggleBtn = document.getElementById('active-test-heatmap-toggle-btn');

      if (learnPanel) learnPanel.style.display = nextState ? 'flex' : 'none';
      if (learnStateLabel) {
        learnStateLabel.innerText = nextState ? 'ON' : 'OFF';
      }
      if (learnToggleBtn) {
        learnToggleBtn.style.borderColor = nextState ? '#10b981' : '#94a3b8';
        learnToggleBtn.style.color = nextState ? '#059669' : 'var(--text-muted)';
      }
      // 👉 REQUIREMENT #14: Keep Live Keystroke Rhythm section hidden inside active test modal when test is started
      if (testWrap) testWrap.style.display = 'none';
      if (testToggleBtn) testToggleBtn.style.display = 'none';

      if (nextState) {
        renderKeystrokeLatencyHeatmap();
      } else {
        document.querySelectorAll('[id^="vkey-"]').forEach(el => {
          el.style.boxShadow = '0 2px 4px rgba(15,23,42,0.06)';
          el.style.background = 'var(--surface)';
        });
      }
      if (typeof syncUserCloudStateToBackend === 'function') {
        syncUserCloudStateToBackend(true);
      }
      showToast(nextState ? '🔥 Keystroke Rhythm & Finger-Latency Heatmap: ON' : '⏸️ Keystroke Rhythm & Finger-Latency Heatmap: OFF');
    }

export function resetKeystrokeLatencyHeatmapData() {
      window.keystrokeLatencyStatsMap = {};
      window.lastKeystrokeTimestampMs = 0;
      window.recentKeystrokeIntervalsMs = [];
      renderKeystrokeLatencyHeatmap();
      showToast('🧹 Reset Keystroke Rhythm & Finger-Latency Heatmap statistics.');
    }

export function recordKeystrokeLatencyForHeatmap(event, source = 'learning') {
      if (!event || !event.key) return;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(event.key)) return;

      const now = performance.now ? performance.now() : Date.now();
      let deltaMs = 0;
      if (window.lastKeystrokeTimestampMs > 0) {
        deltaMs = Math.round(now - window.lastKeystrokeTimestampMs);
      }
      window.lastKeystrokeTimestampMs = now;

      const isBs = event.key === 'Backspace' || event.key === 'Delete';
      if (isBs) return;
      if (deltaMs <= 15 || deltaMs > 2500) {
        deltaMs = 155;
      }

      const normKey = event.key === ' ' ? 'SPACE' : String(event.key).toUpperCase();
      if (!window.keystrokeLatencyStatsMap[normKey]) {
        window.keystrokeLatencyStatsMap[normKey] = { count: 0, totalMs: 0, minMs: deltaMs, maxMs: deltaMs };
      }
      const st = window.keystrokeLatencyStatsMap[normKey];
      st.count += 1;
      st.totalMs += deltaMs;
      if (deltaMs < st.minMs) st.minMs = deltaMs;
      if (deltaMs > st.maxMs) st.maxMs = deltaMs;

      window.recentKeystrokeIntervalsMs.push(deltaMs);
      if (window.recentKeystrokeIntervalsMs.length > 40) {
        window.recentKeystrokeIntervalsMs.shift();
      }

      if (window.isKeystrokeLatencyHeatmapEnabled) {
        renderKeystrokeLatencyHeatmap();
      }
    }

export function renderKeystrokeLatencyHeatmap() {
      if (!window.isKeystrokeLatencyHeatmapEnabled) return;
      const entries = Object.entries(window.keystrokeLatencyStatsMap || {}).map(([k, v]) => ({
        key: k,
        count: v.count,
        avgMs: Math.round(v.totalMs / Math.max(1, v.count))
      }));

      let overallAvg = 0;
      if (entries.length > 0) {
        const totalAllMs = Object.values(window.keystrokeLatencyStatsMap).reduce((acc, v) => acc + v.totalMs, 0);
        const totalAllCount = Object.values(window.keystrokeLatencyStatsMap).reduce((acc, v) => acc + v.count, 0);
        overallAvg = Math.round(totalAllMs / Math.max(1, totalAllCount));
      }

      let rhythmPct = 100;
      if (window.recentKeystrokeIntervalsMs.length >= 3) {
        const arr = window.recentKeystrokeIntervalsMs;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? (stdDev / mean) : 0;
        rhythmPct = Math.max(35, Math.min(100, Math.round((1 - Math.min(0.85, cv * 0.75)) * 100)));
      }

      const sortedBySlowest = [...entries].sort((a, b) => b.avgMs - a.avgMs);
      const sortedByFastest = [...entries].sort((a, b) => a.avgMs - b.avgMs);
      const slowestText = sortedBySlowest.slice(0, 3).map(i => `${i.key} (${i.avgMs}ms)`).join(', ') || 'None yet';
      const fastestText = sortedByFastest.slice(0, 3).map(i => `${i.key} (${i.avgMs}ms)`).join(', ') || 'None yet';
      const rhythmDesc = rhythmPct >= 85 ? `${rhythmPct}% Steady` : (rhythmPct >= 65 ? `${rhythmPct}% Moderate` : `${rhythmPct}% Uneven`);

      // Update Learning Studio Heatmap IDs
      const avgEl = document.getElementById('heatmap-avg-latency') || document.getElementById('heatmap-avg-latency-ms');
      const rhyEl = document.getElementById('heatmap-rhythm-score');
      const slowEl = document.getElementById('heatmap-slow-keys') || document.getElementById('heatmap-slowest-key');
      const fastEl = document.getElementById('heatmap-fast-keys');

      if (avgEl) avgEl.innerText = overallAvg > 0 ? `${overallAvg} ms` : '0 ms';
      if (rhyEl) rhyEl.innerText = rhythmDesc;
      if (slowEl) slowEl.innerText = slowestText;
      if (fastEl) fastEl.innerText = fastestText;

      // Update Active Test Modal Heatmap IDs
      const testAvgEl = document.getElementById('active-test-hm-latency') || document.getElementById('test-heatmap-avg-ms');
      const testRhyEl = document.getElementById('active-test-hm-rhythm') || document.getElementById('test-heatmap-rhythm-pct');
      const testSlowEl = document.getElementById('active-test-hm-slowest');
      if (testAvgEl) testAvgEl.innerText = overallAvg > 0 ? `${overallAvg} ms` : '0 ms';
      if (testRhyEl) testRhyEl.innerText = `${rhythmPct}%`;
      if (testSlowEl) testSlowEl.innerText = slowestText;

      const renderChipsHtml = (list) => {
        if (list.length === 0) {
          return `<span style="font-size: 11px; color: var(--text-muted);">Type to see per-key latency chips...</span>`;
        }
        return list.slice(0, 14).map(item => {
          const isFast = item.avgMs < 160;
          const isMid = item.avgMs >= 160 && item.avgMs <= 280;
          const bg = isFast ? 'rgba(16,185,129,0.14)' : (isMid ? 'rgba(245,158,11,0.16)' : 'rgba(239,68,68,0.16)');
          const border = isFast ? '#10b981' : (isMid ? '#f59e0b' : '#ef4444');
          const color = isFast ? '#059669' : (isMid ? '#d97706' : '#dc2626');
          return `<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:6px; font-size:10.5px; font-weight:800; background:${bg}; border:1px solid ${border}; color:${color};">
            <span>${item.key}</span>
            <span style="font-size:9.5px; opacity:0.9;">${item.avgMs}ms</span>
          </span>`;
        }).join('');
      };

      const learnChips = document.getElementById('learning-latency-key-chips');
      const testChips = document.getElementById('active-test-hm-mini-keys') || document.getElementById('test-latency-key-chips');
      if (learnChips) learnChips.innerHTML = renderChipsHtml(sortedBySlowest);
      if (testChips) testChips.innerHTML = renderChipsHtml(sortedBySlowest);

      const adaptiveHintEl = document.getElementById('adaptive-heatmap-suggestion-text');
      if (adaptiveHintEl && sortedBySlowest.length > 0) {
        const topWeakKeys = sortedBySlowest.slice(0, 5).map(k => k.key).join(', ');
        adaptiveHintEl.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles" style="color: #ea580c;"></i> <strong>Adaptive Lesson Generator:</strong> Detected high finger latency on <strong>[${topWeakKeys}]</strong>. Click <em>"Start Recommended Weak-Key Exercise"</em> to practice a targeted 2-minute drill!`;
      }

      entries.forEach(item => {
        const keyEl = document.getElementById(`vkey-${item.key}`);
        if (keyEl && keyEl.style.background !== 'var(--primary)') {
          if (item.avgMs < 160) {
            keyEl.style.background = 'rgba(16,185,129,0.18)';
          } else if (item.avgMs <= 280) {
            keyEl.style.background = 'rgba(245,158,11,0.20)';
          } else {
            keyEl.style.background = 'rgba(239,68,68,0.22)';
          }
        }
      });
    }

export function seedRichDemoDataIfNeeded() {
      if (!Array.isArray(portalState.materialsData)) portalState.materialsData = [];
      if (!Array.isArray(portalState.subtabsData)) portalState.subtabsData = [];
      if (!Array.isArray(portalState.allTestHistoryList)) portalState.allTestHistoryList = [];

      if (portalState.globalData) {
        if (!Array.isArray(portalState.globalData.materials)) portalState.globalData.materials = portalState.materialsData;
        if (!Array.isArray(portalState.globalData.subtabs)) portalState.globalData.subtabs = portalState.subtabsData;
        if (!Array.isArray(portalState.globalData.history)) portalState.globalData.history = portalState.allTestHistoryList;
        if (!Array.isArray(portalState.globalData.userHistory)) portalState.globalData.userHistory = portalState.allTestHistoryList;
        if (!Array.isArray(portalState.globalData.homework)) portalState.globalData.homework = [];
        if (!Array.isArray(portalState.globalData.announcements)) portalState.globalData.announcements = [];
        if (!Array.isArray(portalState.globalData.videos)) portalState.globalData.videos = [];
        if (!Array.isArray(portalState.globalData.adminContacts)) portalState.globalData.adminContacts = [];
      }

      if (!portalState.adminData || typeof portalState.adminData !== 'object') {
        portalState.adminData = {
          users: [],
          materials: portalState.materialsData,
          subtabs: portalState.subtabsData,
          history: portalState.allTestHistoryList,
          logs: [],
          feedback: [],
          banner: { enabled: false, startTime: '', stopTime: '', text: '' },
          evaluationRulesMap: portalState.allEvaluationRules
        };
      } else {
        if (!Array.isArray(portalState.adminData.users)) portalState.adminData.users = [];
        if (!Array.isArray(portalState.adminData.materials)) portalState.adminData.materials = portalState.materialsData;
        if (!Array.isArray(portalState.adminData.subtabs)) portalState.adminData.subtabs = portalState.subtabsData;
        if (!Array.isArray(portalState.adminData.history)) portalState.adminData.history = portalState.allTestHistoryList;
      }
    }

export const WORD_BANK_BY_LETTER = {
      A: ['administration', 'authority', 'amendment', 'allocation', 'accountability'],
      B: ['bureaucracy', 'beneficiary', 'benchmark', 'bilateral', 'budgetary'],
      C: ['commission', 'constitution', 'compliance', 'committee', 'consolidation'],
      D: ['department', 'directorate', 'deliberation', 'disbursement', 'documentary'],
      E: ['establishment', 'expenditure', 'enforcement', 'evaluation', 'efficiency'],
      F: ['formulation', 'federation', 'financial', 'framework', 'fundamental'],
      G: ['governance', 'gazette', 'guideline', 'grievance', 'government'],
      H: ['headquarters', 'harmonization', 'honourable', 'hierarchy', 'humanitarian'],
      I: ['implementation', 'infrastructure', 'institutional', 'investigation', 'initiative'],
      J: ['jurisdiction', 'judiciary', 'justification', 'jointly', 'judgment'],
      K: ['knowledge', 'keystroke', 'keeping', 'kilometer', 'kindness'],
      L: ['legislation', 'legitimate', 'litigation', 'livelihood', 'leadership'],
      M: ['memorandum', 'management', 'ministry', 'municipality', 'modernization'],
      N: ['notification', 'nomination', 'negotiation', 'national', 'necessary'],
      O: ['organization', 'ordinance', 'observation', 'operational', 'obligation'],
      P: ['parliamentary', 'proceedings', 'provisional', 'procurement', 'perspective'],
      Q: ['qualification', 'quantitative', 'questionnaire', 'quarterly', 'quorum'],
      R: ['recommendation', 'regulation', 'rehabilitation', 'representation', 'resolution'],
      S: ['secretariat', 'stenography', 'subordinate', 'supervision', 'statute'],
      T: ['transcription', 'tribunal', 'transparency', 'territorial', 'technology'],
      U: ['undertaking', 'utilization', 'unanimous', 'universally', 'upgradation'],
      V: ['verification', 'vigilance', 'vocabulary', 'validation', 'voluntary'],
      W: ['welfare', 'witness', 'workforce', 'withdrawal', 'whereabouts'],
      X: ['examination', 'executive', 'exemption', 'excellence', 'extraordinary'],
      Y: ['yesterday', 'yearly', 'yielding', 'youthful', 'yardstick'],
      Z: ['zonal', 'zeroed', 'zealously', 'zenith', 'organization']
    };

export function generateAdaptiveLatencyDrillText() {
      const entries = Object.entries(window.keystrokeLatencyStatsMap || {})
        .map(([k, v]) => ({ key: k, avgMs: Math.round(v.totalMs / Math.max(1, v.count)), count: v.count }))
        .filter(e => e.key && e.key.length === 1 && /[A-Z]/.test(e.key))
        .sort((a, b) => b.avgMs - a.avgMs);

      const topSlowKeys = entries.length >= 3
        ? entries.slice(0, 5).map(e => e.key)
        : ['Q', 'P', 'Z', 'X', 'B'];

      const bigramPairs = [];
      for (let i = 0; i < topSlowKeys.length; i++) {
        const k1 = topSlowKeys[i].toLowerCase();
        const k2 = topSlowKeys[(i + 1) % topSlowKeys.length].toLowerCase();
        bigramPairs.push(`${k1}${k2}${k1} ${k2}${k1}${k2}`);
      }

      const targetedWords = [];
      topSlowKeys.forEach(letter => {
        const pool = WORD_BANK_BY_LETTER[letter] || ['practice', 'precision', 'rhythm'];
        targetedWords.push(...pool.slice(0, 4));
      });

      const warmupLine = `Warmup Bigram Sprint (${topSlowKeys.join('-')}): ${bigramPairs.join(' ')} ${bigramPairs.join(' ')}.`;
      const precisionLine = `Targeted Finger-Zone Drill: ${targetedWords.join(' ')}.`;
      const masteryLine = `Rhythm & Speed Mastery: The committee reviewed ${targetedWords.slice(0, 8).join(', ')} to improve keystroke latency across ${topSlowKeys.join(', ')}.`;

      return {
        keys: topSlowKeys,
        passage: `${warmupLine} ${precisionLine} ${masteryLine}`
      };
    }

export function launchAdaptiveLatencyDrill(source = 'learning') {
      const generated = generateAdaptiveLatencyDrillText();
      const drillLabel = `⚡ 2-Min Slowest Keys Drill [${generated.keys.join(', ')}]`;

      if (source === 'modal' && document.getElementById('active-test-modal')?.style.display === 'flex') {
        cancelStenoTest();
      }

      navigateTo('learningtyping');
      setTimeout(() => {
        window._activeLearningSectionMode = 'none';
        switchLearningTypingSection('studio', document.getElementById('learning-tab-btn-studio'));
        window.currentLearningTargetText = generated.passage;
        portalState.learningStartTime = null;
        portalState.learningBackspaces = 0;
        if (portalState.learningTimerInterval) {
          clearInterval(portalState.learningTimerInterval);
          portalState.learningTimerInterval = null;
        }
        const elapsedEl = document.getElementById('learn-elapsed-time');
        if (elapsedEl) elapsedEl.innerText = '00:00';
        const inp = document.getElementById('learning-user-input');
        if (inp) {
          inp.value = '';
          inp.focus();
        }
        updateLearningDisplayAndKeyHighlight();
        showToast(`🎯 Generated 2-Minute Adaptive Drill targeting your slowest keys: ${generated.keys.join(', ')}`);
      }, 120);
    }

window.currentHindiKeymapLayout = 'inscript';

export const HINDI_KEYMAP_LAYOUTS = {
      inscript: {
        title: '🇮🇳 Mangal Inscript Standard Keymap (Government SSC / CPCT / High Court)',
        rows: [
          ['ौ (q)', 'ै (w)', 'ा (e)', 'ी (r)', 'ू (t)', 'ब (y)', 'ह (u)', 'ग (i)', 'द (o)', 'ज (p)', 'ड ([)', '़ (])'],
          ['ो (a)', 'े (s)', '् (d)', 'ि (f)', 'ु (g)', 'प (h)', 'र (j)', 'क (k)', 'त (l)', 'च (;)', 'ट (\')'],
          ['ं (z)', 'म (x)', 'न (c)', 'व (v)', 'ल (b)', 'स (n)', 'य (m)', ', (,)', '. (.)', 'य (/)']
        ]
      },
      krutidev: {
        title: '🇮🇳 KrutiDev 010 / Remington Traditional Keymap (UPSSSC / Rajasthan / Bihar Steno)',
        rows: [
          ['ु (q)', 'ू (w)', 'म (e)', 'त (r)', 'ज (t)', 'ल (y)', 'न (u)', 'प (i)', 'व (o)', 'च (p)', 'ख् ([)', ', (])'],
          ['ं (a)', 'े (s)', 'क (d)', 'ि (f)', 'ह (g)', 'ी (h)', 'र (j)', 'ा (k)', 'स (l)', 'य (;)', 'श् (\')'],
          ['्र (z)', 'ग (x)', 'ब (c)', 'अ (v)', 'इ (b)', 'द (n)', 'उ (m)', 'ए (,)', 'ण (.)', 'ध् (/)']
        ]
      },
      remington: {
        title: '🇮🇳 Remington Gail (Unicode) Keymap (SSC / AIIMS / Central Exams)',
        rows: [
          ['ु (q)', 'ू (w)', 'म (e)', 'त (r)', 'ज (t)', 'ल (y)', 'न (u)', 'प (i)', 'व (o)', 'च (p)', 'क्ष ([)', 'द्व (])'],
          ['ं (a)', 'े (s)', 'क (d)', 'ि (f)', 'ह (g)', 'ी (h)', 'र (j)', 'ा (k)', 'स (l)', 'य (;)', 'श (\')'],
          ['्र (z)', 'ग (x)', 'ब (c)', 'अ (v)', 'इ (b)', 'द (n)', 'उ (m)', 'ए (,)', 'ण (.)', 'ध (/)']
        ]
      }
    };

export function renderHindiKeymapOverlayBox(targetId) {
      const box = document.getElementById(targetId);
      if (!box) return;
      const layoutKey = window.currentHindiKeymapLayout || 'inscript';
      const layout = HINDI_KEYMAP_LAYOUTS[layoutKey] || HINDI_KEYMAP_LAYOUTS.inscript;

      box.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
          <strong style="font-size: 12px; color: #6d28d9;">${layout.title}</strong>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm ${layoutKey === 'inscript' ? 'btn-primary' : 'btn-secondary'}" style="padding: 2px 9px; font-size: 10.5px;" onclick="switchHindiKeymapLayout('inscript', '${targetId}')">Mangal Inscript</button>
            <button type="button" class="btn btn-sm ${layoutKey === 'krutidev' ? 'btn-primary' : 'btn-secondary'}" style="padding: 2px 9px; font-size: 10.5px;" onclick="switchHindiKeymapLayout('krutidev', '${targetId}')">KrutiDev 010</button>
            <button type="button" class="btn btn-sm ${layoutKey === 'remington' ? 'btn-primary' : 'btn-secondary'}" style="padding: 2px 9px; font-size: 10.5px;" onclick="switchHindiKeymapLayout('remington', '${targetId}')">Remington Gail</button>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 5px; align-items: center;">
          ${layout.rows.map(row => `
            <div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: center;">
              ${row.map(k => `<span style="padding: 4px 8px; border-radius: 6px; background: var(--background); border: 1px solid var(--border); font-size: 12px; font-weight: 800; color: var(--secondary); box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${k}</span>`).join('')}
            </div>
          `).join('')}
        </div>
      `;
    }

export function switchHindiKeymapLayout(layoutKey, targetId) {
      window.currentHindiKeymapLayout = layoutKey;
      ['learning-hindi-keymap-overlay', 'typingtest-hindi-keymap-overlay', 'modal-hindi-keymap-overlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.style.display !== 'none') renderHindiKeymapOverlayBox(id);
      });
      if (targetId) renderHindiKeymapOverlayBox(targetId);
    }

export function toggleHindiKeymapOverlay(context = 'learning') {
      const idMap = {
        learning: 'learning-hindi-keymap-overlay',
        typingtest: 'typingtest-hindi-keymap-overlay',
        modal: 'modal-hindi-keymap-overlay'
      };
      const targetId = idMap[context] || 'learning-hindi-keymap-overlay';
      const box = document.getElementById(targetId);
      if (!box) return;
      const isHidden = box.style.display === 'none' || !box.style.display;
      box.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        renderHindiKeymapOverlayBox(targetId);
        showToast('🇮🇳 Hindi Character Keymap Overlay enabled!');
      }
    }

'use strict';

window.playCardSelectChime = function() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!window.__rpCardAudioCtx) {
        window.__rpCardAudioCtx = new AudioCtx();
      }
      const ctx = window.__rpCardAudioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

window.__keystrokeLatencyStatsMap = {};

window.__lastLearningKeystrokeTs = 0;

window.renderKeystrokeRhythmHeatmap = function() {
    const grid = document.getElementById('keystroke-rhythm-heatmap-grid');
    if (!grid) return;
    const stats = window.__keystrokeLatencyStatsMap || {};
    const keys = Object.keys(stats);
    if (keys.length === 0) {
      grid.innerHTML = '<span style="color:var(--text-muted); font-size:11px;">Start typing in the Touch-Typing Studio box above to see your live per-key speed &amp; hesitation latency (ms)...</span>';
      return;
    }
    grid.innerHTML = keys.map(k => {
      const entry = stats[k];
      const avgMs = Math.round(entry.totalMs / Math.max(1, entry.count));
      let bg = 'rgba(16,185,129,0.14)';
      let border = 'rgba(16,185,129,0.4)';
      let col = '#059669';
      if (avgMs > 260) {
        bg = 'rgba(239,68,68,0.14)';
        border = 'rgba(239,68,68,0.4)';
        col = '#dc2626';
      } else if (avgMs >= 140) {
        bg = 'rgba(245,158,11,0.15)';
        border = 'rgba(245,158,11,0.4)';
        col = '#d97706';
      }
      const dispKey = k === ' ' ? 'SPACE' : k.toUpperCase();
      return `<span style="padding:3px 8px; border-radius:6px; background:${bg}; border:1px solid ${border}; color:${col}; font-weight:800; font-size:11px; font-family:monospace;">${dispKey}: ${avgMs}ms</span>`;
    }).join('');
  };

window.resetKeystrokeRhythmHeatmap = function() {
    window.__keystrokeLatencyStatsMap = {};
    window.__lastLearningKeystrokeTs = 0;
    window.renderKeystrokeRhythmHeatmap();
  };

document.addEventListener('keydown', function(e) {
    if (!e.target || e.target.id !== 'learning-user-input') return;
    if (e.key && e.key.length === 1) {
      const now = performance.now();
      if (window.__lastLearningKeystrokeTs > 0) {
        const delta = now - window.__lastLearningKeystrokeTs;
        if (delta > 15 && delta < 2500) {
          const k = e.key.toLowerCase();
          if (!window.__keystrokeLatencyStatsMap[k]) {
            window.__keystrokeLatencyStatsMap[k] = { totalMs: 0, count: 0 };
          }
          window.__keystrokeLatencyStatsMap[k].totalMs += delta;
          window.__keystrokeLatencyStatsMap[k].count += 1;
          window.renderKeystrokeRhythmHeatmap();
        }
      }
      window.__lastLearningKeystrokeTs = now;
    }
  });

export const FAKE_INJECTED_RULE_KEYS = [
    'typingtest_SSC_CGL_CHSL',
    'typingtest_High_Court_Civil_Court',
    'typingtest_High_Court_Typing',
    'typingtest_Bihar_Beltron_BSSC',
    'audio_SSC_Steno_Grade_C_D',
    'audio_High_Court_Steno',
    'pitman_Parliament_Reporter',
    'pitman_SSC_Steno_Shorthand'
  ];

export function purgeFakeInjectedRules() {
    if (typeof portalState.allEvaluationRules === 'object' && portalState.allEvaluationRules) {
      let modified = false;
      FAKE_INJECTED_RULE_KEYS.forEach(k => {
        if (portalState.allEvaluationRules[k]) {
          delete portalState.allEvaluationRules[k];
          modified = true;
        }
      });
      if (modified) {
        try {
          localStorage.setItem('steno_all_eval_rules', JSON.stringify(portalState.allEvaluationRules));
        } catch (e) {}
      }
    }
  }





window.seedSampleWeakWordsIfEmpty = function() {
    try {
      if (typeof window.getWeakOutlinesVault === 'function') {
        // getWeakOutlinesVault now automatically purges any legacy seeded entries
        window.getWeakOutlinesVault();
      }
      // Also purge any legacy demo polls or demo batch group messages
      const rawPolls = localStorage.getItem('rp_batch_polls_v1');
      if (rawPolls) {
        const arr = JSON.parse(rawPolls);
        if (Array.isArray(arr)) {
          const cleanPolls = arr.filter(p => p && !String(p.id || '').startsWith('POLL-DEFAULT') && !String(p.id || '').startsWith('seed-') && !String(p.id || '').startsWith('demo-'));
          if (cleanPolls.length !== arr.length) localStorage.setItem('rp_batch_polls_v1', JSON.stringify(cleanPolls));
        }
      }
    } catch (e) {}
  };

window.addCustomWordToWeakVault = async function() {
    const tabInput = document.getElementById('weak-vault-custom-word-input');
    const modalInput = document.getElementById('weak-outlines-search-input');
    const input = (tabInput && tabInput.value.trim()) ? tabInput : ((modalInput && modalInput.value.trim()) ? modalInput : (tabInput || modalInput));
    const raw = (input ? input.value : '').trim();
    if (!raw || raw.length < 2) {
      showToast('Please type a word or phrase (at least 2 letters) to add to your Weak Outlines Vault.');
      return;
    }
    const existingWord = typeof window.findExistingWordInWordsTabData === 'function'
      ? window.findExistingWordInWordsTabData(raw)
      : null;

    if (typeof window.recordWordsIntoWeakOutlinesVault === 'function') {
      window.recordWordsIntoWeakOutlinesVault([{ word: raw, typed: 'Manual Lookup', category: 'Custom Outline' }], 'Custom');
    }
    if (input) input.value = '';
    if (typeof window.inspectPitmanWordInVault === 'function') window.inspectPitmanWordInVault(raw, true);
    if (typeof window.renderDashboardWeakOutlinesVault === 'function') window.renderDashboardWeakOutlinesVault(true);
    if (typeof window.renderWeakOutlinesVaultModalList === 'function') window.renderWeakOutlinesVaultModalList();

    if (existingWord) {
      showToast(`Word "${raw}" is already available in Words & Outlines (${existingWord.Subtab || 'General'}) and added to your Vault.`);
    } else if (typeof window.checkAndSubmitWordOutlineRequest === 'function') {
      await window.checkAndSubmitWordOutlineRequest(raw, 'My Weak Outlines Vault');
    } else {
      showToast(`Added "${raw}" to your Weak Outlines Vault.`);
    }
  };
