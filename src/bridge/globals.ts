/**
 * Typed Inline DOM Handler Bridge.
 *
 * Exposes all modular portal handlers onto `window` in one explicit, auditable
 * registration pass so inline HTML `onclick`/`onchange`/`oninput` attributes
 * work seamlessly with strict Vite ES modules and zero duplicate overrides.
 */

import { resolveStandaloneBackendUrl } from '../core/config.ts';
import { escapeHtml, rpSanitizeUrl, getLocalDateString, formatLocalDate } from '../utils/formatting.ts';
import * as apiAndCoreMod from '../features/apiAndCore.js';
import * as authAndNavigationMod from '../features/authAndNavigation.js';
import * as dashboardAndProfileMod from '../features/dashboardAndProfile.js';
import * as typingAndEvaluationMod from '../features/typingAndEvaluation.js';
import * as adminPanelMod from '../features/adminPanel.js';
import * as mediaAndDictationMod from '../features/mediaAndDictation.js';
import * as videoAndTutorMod from '../features/videoAndTutor.js';
import * as cbtArenaMod from '../features/cbtArena.js';
import * as weakVaultAndPlannerMod from '../features/weakVaultAndPlanner.js';
import * as communityAndAnalyticsMod from '../features/communityAndAnalytics.js';
import * as feesAndBillingMod from '../features/feesAndBilling.js';

export function bindPortalGlobals(): void {
  if (typeof window === 'undefined') return;
  const exportsMap: Record<string, unknown> = {
  resolveStandaloneBackendUrl,
  escapeHtml,
  rpSanitizeUrl,
  getLocalDateString,
  formatLocalDate,
  ...apiAndCoreMod,
  ...authAndNavigationMod,
  ...dashboardAndProfileMod,
  ...typingAndEvaluationMod,
  ...adminPanelMod,
  ...mediaAndDictationMod,
  ...videoAndTutorMod,
  ...cbtArenaMod,
  ...weakVaultAndPlannerMod,
  ...communityAndAnalyticsMod,
  ...feesAndBillingMod,
  };

  const win = window as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(exportsMap)) {
    if (typeof value === 'function') {
      // Do not clobber authoritative window.* assignments defined inside domain modules
      if (typeof win[key] !== 'function') {
        win[key] = value;
      }
    }
  }
}
