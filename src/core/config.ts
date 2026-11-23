/**
 * Portal environment & runtime configuration.
 * Backend API requests route via:
 * 1. Apps Script native bridge (when hosted inside Google Apps Script HtmlService)
 * 2. VITE_APPS_SCRIPT_URL environment variable (if set in .env)
 * 3. Same-origin /api/gas-proxy (when deployed behind a proxy)
 * 4. Standalone Google Apps Script Web App fallback endpoint
 */

const DEFAULT_STANDALONE_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbwl78VM_WN1YNH8uq2rq2AH1_Ys5O_aWC0tXwqXM9qF9ZCYVNUvT2MhXRffUPIckFMmCQ/exec';

export function resolveStandaloneBackendUrl(): string {
  const envUrl =
    typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_APPS_SCRIPT_URL;

  if (envUrl && /^https?:\/\//i.test(String(envUrl).trim())) {
    return String(envUrl).trim();
  }
  if (/^https?:\/\//i.test(DEFAULT_STANDALONE_ENDPOINT)) {
    return DEFAULT_STANDALONE_ENDPOINT;
  }
  return '';
}

export const PORTAL_CONFIG = {
  APP_NAME: 'RP Skill | Ranjan Pathshala',
  HISTORY_PER_PAGE: 30,
  ADMIN_FEEDBACK_PER_PAGE: 30,
  ADMIN_LEADERBOARD_PER_PAGE: 30,
  ADMIN_USERS_PER_PAGE: 30,
  ADMIN_LOGS_PER_PAGE: 50,
  MAINTENANCE_STORAGE_KEY: 'rp_skill_maintenance_config_v1',
  ADMIN_NOTIF_STORAGE_KEY: 'rp_admin_realtime_notifications_v1',
} as const;

export const ALL_STUDENT_PORTAL_TABS = [
  'dashboard',
  'livetests',
  'videocourse',
  'words',
  'pdf',
  'audio',
  'pitman',
  'learningtyping',
  'typingtest',
  'cbttest',
  'weak-vault',
  'batchhub',
  'cbt-revision',
  'batch-leaderboard',
  'attendance-matrix',
  'buy-plans',
  'test',
  'feedback',
  'profile',
] as const;

export type PortalTabId = (typeof ALL_STUDENT_PORTAL_TABS)[number] | 'admin' | 'auth';
