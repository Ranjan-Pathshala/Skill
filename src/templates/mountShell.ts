/**
 * Modular HTML Shell, View & Modal Template Mounter.
 *
 * Keeps index.html lean (~50 lines) while loading each of the 18 portal views
 * and both modal suites from dedicated HTML partial files via Vite raw imports.
 */

import shellHtml from './shell.html?raw';
import coreModalsHtml from './modals/core-modals.html?raw';
import enterpriseModalsHtml from './modals/enterprise-modals.html?raw';

import authViewHtml from './views/auth.html?raw';
import dashboardViewHtml from './views/dashboard.html?raw';
import batchLeaderboardViewHtml from './views/batch-leaderboard.html?raw';
import attendanceMatrixViewHtml from './views/attendance-matrix.html?raw';
import plannerGoalsViewHtml from './views/planner-goals.html?raw';
import livetestsViewHtml from './views/livetests.html?raw';
import videocourseViewHtml from './views/videocourse.html?raw';
import wordsViewHtml from './views/words.html?raw';
import pdfViewHtml from './views/pdf.html?raw';
import audioViewHtml from './views/audio.html?raw';
import pitmanViewHtml from './views/pitman.html?raw';
import learningtypingViewHtml from './views/learningtyping.html?raw';
import typingtestViewHtml from './views/typingtest.html?raw';
import cbttestViewHtml from './views/cbttest.html?raw';
import testViewHtml from './views/test.html?raw';
import feedbackViewHtml from './views/feedback.html?raw';
import buyPlansViewHtml from './views/buy-plans.html?raw';
import profileViewHtml from './views/profile.html?raw';
import adminViewHtml from './views/admin.html?raw';

export const PORTAL_VIEWS: ReadonlyArray<{ id: string; html: string }> = [
  { id: 'auth', html: authViewHtml },
  { id: 'dashboard', html: dashboardViewHtml },
  { id: 'batch-leaderboard', html: batchLeaderboardViewHtml },
  { id: 'attendance-matrix', html: attendanceMatrixViewHtml },
  { id: 'planner-goals', html: plannerGoalsViewHtml },
  { id: 'livetests', html: livetestsViewHtml },
  { id: 'videocourse', html: videocourseViewHtml },
  { id: 'words', html: wordsViewHtml },
  { id: 'pdf', html: pdfViewHtml },
  { id: 'audio', html: audioViewHtml },
  { id: 'pitman', html: pitmanViewHtml },
  { id: 'learningtyping', html: learningtypingViewHtml },
  { id: 'typingtest', html: typingtestViewHtml },
  { id: 'cbttest', html: cbttestViewHtml },
  { id: 'test', html: testViewHtml },
  { id: 'feedback', html: feedbackViewHtml },
  { id: 'buy-plans', html: buyPlansViewHtml },
  { id: 'profile', html: profileViewHtml },
  { id: 'admin', html: adminViewHtml },
];

/**
 * Mounts the modular shell, all 18 portal views, and both modal suites into #app-root.
 * Safe to call once on app boot; idempotent if already mounted.
 */
export function mountPortalShell(): void {
  const root = document.getElementById('app-root');
  if (!root || root.dataset.rpMounted === '1') return;

  root.innerHTML = shellHtml;

  const viewport = document.getElementById('app-viewport');
  if (viewport) {
    viewport.innerHTML = PORTAL_VIEWS.map((v) => v.html).join('\n');
  }

  const coreModalsHost = document.getElementById('rp-core-modals-root');
  if (coreModalsHost) {
    coreModalsHost.outerHTML = `${coreModalsHtml}\n${enterpriseModalsHtml}`;
  }

  root.dataset.rpMounted = '1';
}
