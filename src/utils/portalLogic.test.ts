import test from 'node:test';
import assert from 'node:assert/strict';

import {
  escapeHtml,
  rpSanitizeUrl,
  formatLocalDate,
  getLocalDateString,
  parseMediaClipTimeSec,
  formatMediaClipSec,
  countPassageWords,
  countPassageStrokes,
} from './formatting.ts';
import {
  areHomophones,
  computeWordDiff,
  detectHomophoneErrors,
  calculateTypingMetrics,
} from './evaluationEngine.ts';
import {
  normalizeBatchList,
  evaluateMemberBatchAccess,
  evaluateMaintenanceWindow,
} from './permissions.ts';
import {
  computeDiscountedFee,
  computeInstallmentSchedule,
  buildUpiPaymentUri,
  daysUntilExpiry,
} from './feeMath.ts';
import { extractHardWordsFromPassage, buildPitmanStrokeSvg } from './pitman.ts';
import { portalHooks } from '../core/hooks.ts';

test('formatting utilities escape HTML, sanitize URLs, format dates & clip timestamps', () => {
  assert.equal(escapeHtml(`<script>"a"&'b'</script>`), '&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/script&gt;');
  assert.equal(escapeHtml(null), '');

  assert.equal(rpSanitizeUrl('https://ranjanpathshala.in/file.pdf'), 'https://ranjanpathshala.in/file.pdf');
  assert.equal(rpSanitizeUrl('upi://pay?pa=test@upi'), 'upi://pay?pa=test@upi');
  assert.equal(rpSanitizeUrl('javascript:alert(1)'), '');
  assert.equal(rpSanitizeUrl('data:text/html,<script>alert(1)</script>'), '');

  assert.equal(formatLocalDate('2026-05-14T10:22:00.000Z'), '2026-05-14');
  assert.equal(formatLocalDate('2026-05-14 08:30:00'), '2026-05-14');
  assert.equal(formatLocalDate('2026-05-14'), '2026-05-14');
  assert.equal(getLocalDateString(new Date(2026, 0, 5)), '2026-01-05');

  assert.equal(parseMediaClipTimeSec('02:35'), 155);
  assert.equal(parseMediaClipTimeSec('1:02:05'), 3725);
  assert.equal(parseMediaClipTimeSec('90'), 90);
  assert.equal(parseMediaClipTimeSec('invalid'), null);
  assert.equal(formatMediaClipSec(155), '02:35');
  assert.equal(formatMediaClipSec(3725), '01:02:05');

  assert.equal(countPassageWords('  The quick   brown fox  '), 4);
  assert.equal(countPassageStrokes('hello\r\nworld'), 11);
});

test('evaluationEngine computes LCS diff, homophones, and 5-stroke vs 1-space typing metrics', () => {
  assert.equal(areHomophones('their', 'there'), true);
  assert.equal(areHomophones('Council', 'counsel.'), true);
  assert.equal(areHomophones('court', 'bench'), false);

  const diffs = computeWordDiff(
    'The principal addressed their council yesterday',
    'The principle addressed there counsel',
  );
  const homophones = detectHomophoneErrors(diffs);
  assert.equal(homophones.length, 3);
  assert.deepEqual(homophones[0], { expected: 'principal', typed: 'principle' });
  assert.deepEqual(homophones[1], { expected: 'their', typed: 'there' });
  assert.deepEqual(homophones[2], { expected: 'council', typed: 'counsel' });

  const omissions = diffs.filter((d) => d.type === 'omission');
  assert.equal(omissions.length, 1);
  assert.equal(omissions[0].expected, 'yesterday');

  const fiveStroke = calculateTypingMetrics({
    referenceWords: 400,
    typedWords: 380,
    typedKeystrokes: 2000,
    durationMinutes: 10,
    fullMistakes: 8,
    halfMistakes: 4,
    wordCountMode: '5-stroke',
  });
  assert.equal(fiveStroke.effectiveWords, 400);
  assert.equal(fiveStroke.totalErrors, 10);
  assert.equal(fiveStroke.grossWpm, 40);
  assert.equal(fiveStroke.netWpm, 39);
  assert.equal(fiveStroke.errorPercent, 2.5);
  assert.equal(fiveStroke.accuracyPercent, 97.5);

  const oneSpace = calculateTypingMetrics({
    referenceWords: 400,
    typedWords: 380,
    typedKeystrokes: 2000,
    durationMinutes: 10,
    fullMistakes: 5,
    halfMistakes: 2,
    wordCountMode: '1-space',
  });
  assert.equal(oneSpace.effectiveWords, 380);
  assert.equal(oneSpace.totalErrors, 6);
  assert.equal(oneSpace.grossWpm, 38);
});

test('permissions normalize batch lists, enforce batch scoping, and evaluate maintenance windows', () => {
  assert.deepEqual(normalizeBatchList('RP-Trail, SSC-2026; rp-trail | Court'), [
    'RP-Trail',
    'SSC-2026',
    'Court',
  ]);

  assert.equal(
    evaluateMemberBatchAccess({ userRole: 'admin', materialBatch: 'VIP-Only' }),
    true,
  );
  assert.equal(
    evaluateMemberBatchAccess({ userRole: 'student', userBatches: 'RP-Trail', materialBatch: 'ALL' }),
    true,
  );
  assert.equal(
    evaluateMemberBatchAccess({
      userRole: 'student',
      userBatches: 'RP-Trail, SSC-Steno',
      materialBatch: 'SSC-Steno',
    }),
    true,
  );
  assert.equal(
    evaluateMemberBatchAccess({
      userRole: 'student',
      userBatches: 'RP-Trail',
      materialBatch: 'High-Court-Pro',
    }),
    false,
  );

  const now = Date.parse('2026-05-14T12:00:00Z');
  assert.equal(
    evaluateMaintenanceWindow(
      {
        enabled: true,
        siteWide: false,
        lockedTabs: ['cbttest'],
        startIso: '2026-05-14T11:00:00Z',
        endIso: '2026-05-14T13:00:00Z',
        message: 'CBT maintenance',
      },
      'cbttest',
      'student',
      now,
    ).blocked,
    true,
  );
  assert.equal(
    evaluateMaintenanceWindow(
      { enabled: true, siteWide: true },
      'dashboard',
      'superadmin',
      now,
    ).blocked,
    false,
  );
});

test('feeMath computes coupon discounts, installments, UPI URI, and expiry countdowns', () => {
  const pct = computeDiscountedFee(1000, {
    code: 'STENO20',
    type: 'percent',
    value: 20,
    maxDiscount: 150,
  });
  assert.equal(pct.discountAmount, 150);
  assert.equal(pct.finalAmount, 850);
  assert.equal(pct.appliedCode, 'STENO20');

  const expired = computeDiscountedFee(
    1000,
    { code: 'OLD', type: 'flat', value: 100, expiresAt: '2025-01-01T00:00:00Z' },
    Date.parse('2026-01-01T00:00:00Z'),
  );
  assert.equal(expired.discountAmount, 0);
  assert.ok(expired.error);

  assert.deepEqual(computeInstallmentSchedule(1000, 3), [334, 333, 333]);
  assert.ok(
    buildUpiPaymentUri({ upiId: 'rp@upi', payeeName: 'Ranjan Pathshala', amount: 499 }).includes(
      'am=499.00',
    ),
  );
  assert.equal(
    daysUntilExpiry('2026-05-20T00:00:00Z', Date.parse('2026-05-15T00:00:00Z')),
    5,
  );
});

test('pitman extracts hard words and generates deterministic SVG outlines', () => {
  const words = extractHardWordsFromPassage(
    'Parliamentary stenographers transcribe constitutional deliberations accurately.',
    4,
  );
  assert.equal(words.length, 4);
  assert.equal(words[0], 'constitutional');

  const svg = buildPitmanStrokeSvg('parliament');
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.includes('</svg>'));
});

test('portalHooks executes listeners in order, supports unsubscribe/once, and isolates listener errors', () => {
  portalHooks.clear();
  const seen: string[] = [];

  const off = portalHooks.on('afterNavigate', (tab) => {
    seen.push(`first:${tab}`);
  });
  portalHooks.on('afterNavigate', () => {
    throw new Error('non-fatal listener error');
  });
  portalHooks.once('afterNavigate', (tab) => {
    seen.push(`once:${tab}`);
  });

  portalHooks.emit('afterNavigate', 'dashboard');
  portalHooks.emit('afterNavigate', 'audio');
  off();
  portalHooks.emit('afterNavigate', 'profile');

  assert.deepEqual(seen, ['first:dashboard', 'once:dashboard', 'first:audio']);
  portalHooks.clear();
});
