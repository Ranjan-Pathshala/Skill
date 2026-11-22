/**
 * Centralized Reactive Portal State Store.
 *
 * All cross-module mutable state lives in a single authoritative object so
 * domain ES modules never suffer from isolated module-local `let` divergence
 * or ES-module `Assignment to constant variable` errors.
 */

export interface PortalUser {
  userId?: string;
  name?: string;
  email?: string;
  mobile?: string;
  role?: string;
  batch?: string;
  batches?: string[];
  allowedTabs?: string[];
  [key: string]: unknown;
}

export interface PortalGlobalData {
  announcements: unknown[];
  homework: unknown[];
  stats: unknown[];
  banner: unknown[];
  materials: unknown[];
  history: unknown[];
  [key: string]: unknown;
}

export interface PortalAdminData {
  users: unknown[];
  logs: unknown[];
  feedback: unknown[];
  materials: unknown[];
  subtabs: unknown[];
  history: unknown[];
  [key: string]: unknown;
}

export interface PortalState {
  currentUser: PortalUser | null;
  activeTab: string;
  globalData: PortalGlobalData;
  materialsData: unknown[];
  subtabsData: unknown[];
  adminData: PortalAdminData;
  allTestHistoryList: unknown[];
  cachedTestHistory: unknown[];
  allEvaluationRules: Record<string, unknown>;
  currentHistoryPage: number;
  currentAdminFeedbackPage: number;
  currentAdminLeaderboardPage: number;
  currentAdminUserPage: number;
  currentAdminMaterialPage: number;
  currentAdminSubtabPage: number;
  currentFeedbackPage: number;
  currentEvalRulesPage: number;
  announcementPage: number;
  logsPage: number;
  selectedAlphabet: string;
  selectedCategoryFilter: string;
  currentSubtabFilter: string;
  testPhotoZoom: number;
  testBackspaces: number;
  testStartTime: number | null;
  currentExamName: string;
  testDurationMinutes: number;
  testTimerInterval: ReturnType<typeof setInterval> | null;
  currentReferenceText: string;
  activeTestSubtabKey: string;
  isTestPaused: boolean;
  secondsRemainingGlobal: number;
  isTypingTimerStarted: boolean;
  selectedTypingMedium: string;
  selectedTypingExam: string;
  selectedTypingDate: string;
  selectedTypingPassage: unknown;
  currentTypingPassagesCache: unknown[];
  deferredPwaPrompt: unknown;
  isLaptopMenuUserHidden: boolean;
  editingMaterialId: string | null;
  activeCbtTest: unknown;
  activeCbtQIndex: number;
  activeCbtLang: string;
  cbtUserResponses: Record<string, unknown>;
  cbtQuestionStatus: Record<string, unknown>;
  cbtTimerInterval: ReturnType<typeof setInterval> | null;
  cbtSecondsLeft: number;
  activeCbtCategoryFilter: string;
  cbtSectionTimersMap: Record<string, number>;
  activeCbtSectionName: string;
  cbtQuestionConfidenceMap: Record<string, string>;
  cbtQuestionTimeSpentSecMap: Record<string, number>;
  cbtCurrentQuestionEnteredAtMs: number;
  [key: string]: unknown;
}

function loadInitialUser(): PortalUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem('steno_user');
    if (saved && saved !== 'undefined') {
      return JSON.parse(saved) as PortalUser;
    }
  } catch {
    try {
      window.localStorage.removeItem('steno_user');
    } catch {
      // Ignore
    }
  }
  return null;
}

function loadInitialEvaluationRules(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = window.localStorage.getItem('steno_all_eval_rules');
    if (saved && saved !== 'undefined') {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore
  }
  return {};
}

export const portalState: PortalState = {
  currentUser: loadInitialUser(),
  activeTab: 'dashboard',
  globalData: { announcements: [], homework: [], stats: [], banner: [], materials: [], history: [] },
  materialsData: [],
  subtabsData: [],
  adminData: { users: [], logs: [], feedback: [], materials: [], subtabs: [], history: [] },
  allTestHistoryList: [],
  cachedTestHistory: [],
  allEvaluationRules: loadInitialEvaluationRules(),
  currentHistoryPage: 1,
  currentAdminFeedbackPage: 1,
  currentAdminLeaderboardPage: 1,
  currentAdminUserPage: 1,
  currentAdminMaterialPage: 1,
  currentAdminSubtabPage: 1,
  currentFeedbackPage: 1,
  currentEvalRulesPage: 1,
  announcementPage: 1,
  logsPage: 1,
  selectedAlphabet: 'ALL',
  selectedCategoryFilter: 'ALL',
  currentSubtabFilter: 'ALL',
  testPhotoZoom: 1,
  testBackspaces: 0,
  testStartTime: null,
  currentExamName: '',
  testDurationMinutes: 10,
  testTimerInterval: null,
  currentReferenceText: '',
  activeTestSubtabKey: '',
  isTestPaused: false,
  secondsRemainingGlobal: 0,
  isTypingTimerStarted: false,
  selectedTypingMedium: '',
  selectedTypingExam: '',
  selectedTypingDate: '',
  selectedTypingPassage: null,
  currentTypingPassagesCache: [],
  deferredPwaPrompt: null,
  isLaptopMenuUserHidden: false,
  editingMaterialId: null,
  activeCbtTest: null,
  activeCbtQIndex: 0,
  activeCbtLang: 'EN',
  cbtUserResponses: {},
  cbtQuestionStatus: {},
  cbtTimerInterval: null,
  cbtSecondsLeft: 0,
  activeCbtCategoryFilter: 'ALL',
  cbtSectionTimersMap: {},
  activeCbtSectionName: '',
  cbtQuestionConfidenceMap: {},
  cbtQuestionTimeSpentSecMap: {},
  cbtCurrentQuestionEnteredAtMs: 0,
};

/**
 * Sync live state descriptors onto `window` for backward compatibility with
 * inline DOM handlers and DevTools inspection.
 */
export function bindStateToWindow(): void {
  if (typeof window === 'undefined') return;
  const props: Array<[string, keyof PortalState]> = [
    ['currentUser', 'currentUser'],
    ['activeTab', 'activeTab'],
    ['globalData', 'globalData'],
    ['materialsData', 'materialsData'],
    ['subtabsData', 'subtabsData'],
    ['adminData', 'adminData'],
    ['allTestHistoryList', 'allTestHistoryList'],
    ['userTestHistory', 'allTestHistoryList'],
    ['allEvaluationRules', 'allEvaluationRules'],
  ];
  for (const [winKey, stateKey] of props) {
    try {
      Object.defineProperty(window, winKey, {
        get: () => portalState[stateKey],
        set: (v: unknown) => {
          portalState[stateKey] = v;
        },
        configurable: true,
      });
    } catch {
      // Ignore non-configurable
    }
  }
}
