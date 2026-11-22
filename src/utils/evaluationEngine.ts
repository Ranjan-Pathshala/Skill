/**
 * Pure Stenography & Typing Evaluation Engine.
 *
 * Implements commission-standard (SSC / Court / DSSSB) evaluation math:
 * - LCS word alignment & diff token generation
 * - Homophone confusion detection for shorthand transcription review
 * - 5-stroke (5 key depressions = 1 word) vs 1-space word-count speed formulas
 * - Commission full/half mistake weighting, error %, accuracy %, and net WPM
 */

export const HOMOPHONE_GROUPS: readonly (readonly string[])[] = [
  ['their', 'there', "they're"],
  ['to', 'too', 'two'],
  ['your', "you're"],
  ['its', "it's"],
  ['hear', 'here'],
  ['right', 'write', 'rite'],
  ['council', 'counsel'],
  ['principal', 'principle'],
  ['stationary', 'stationery'],
  ['affect', 'effect'],
  ['accept', 'except'],
  ['adopt', 'adapt'],
  ['peace', 'piece'],
  ['bare', 'bear'],
  ['break', 'brake'],
  ['coarse', 'course'],
  ['complement', 'compliment'],
  ['desert', 'dessert'],
  ['dual', 'duel'],
  ['ensure', 'insure', 'assure'],
  ['fair', 'fare'],
  ['hear', 'here'],
  ['loose', 'lose'],
  ['passed', 'past'],
  ['plain', 'plane'],
  ['precede', 'proceed'],
  ['quiet', 'quite'],
  ['sight', 'site', 'cite'],
  ['weather', 'whether'],
  ['whose', "who's"],
];

const HOMOPHONE_LOOKUP = new Map<string, Set<string>>();
for (const group of HOMOPHONE_GROUPS) {
  const set = new Set(group);
  for (const w of group) {
    const existing = HOMOPHONE_LOOKUP.get(w);
    if (existing) {
      for (const x of group) existing.add(x);
    } else {
      HOMOPHONE_LOOKUP.set(w, new Set(set));
    }
  }
}

export function normalizeWordToken(word: string): string {
  return String(word || '')
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
}

export function areHomophones(expectedWord: string, typedWord: string): boolean {
  const a = normalizeWordToken(expectedWord);
  const b = normalizeWordToken(typedWord);
  if (!a || !b || a === b) return false;
  const set = HOMOPHONE_LOOKUP.get(a);
  return Boolean(set && set.has(b));
}

export interface DiffPair {
  type: 'match' | 'substitution' | 'omission' | 'addition';
  expected?: string;
  typed?: string;
  isHomophone?: boolean;
}

/**
 * Computes word-level LCS diff between reference passage and typed passage.
 */
export function computeWordDiff(referenceText: string, typedText: string): DiffPair[] {
  const refWords = String(referenceText || '').trim().split(/\s+/).filter(Boolean);
  const typedWords = String(typedText || '').trim().split(/\s+/).filter(Boolean);
  const m = refWords.length;
  const n = typedWords.length;

  // Build DP table using flat Int32Array for memory efficiency
  const cols = n + 1;
  const dp = new Int32Array((m + 1) * cols);

  for (let i = m - 1; i >= 0; i--) {
    const rw = refWords[i];
    for (let j = n - 1; j >= 0; j--) {
      if (rw === typedWords[j]) {
        dp[i * cols + j] = 1 + dp[(i + 1) * cols + (j + 1)];
      } else {
        const down = dp[(i + 1) * cols + j];
        const right = dp[i * cols + (j + 1)];
        dp[i * cols + j] = down >= right ? down : right;
      }
    }
  }

  const ops: DiffPair[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (refWords[i] === typedWords[j]) {
      ops.push({ type: 'match', expected: refWords[i], typed: typedWords[j] });
      i++;
      j++;
    } else if (dp[(i + 1) * cols + j] > dp[i * cols + (j + 1)]) {
      ops.push({ type: 'omission', expected: refWords[i] });
      i++;
    } else if (dp[i * cols + (j + 1)] > dp[(i + 1) * cols + j]) {
      ops.push({ type: 'addition', typed: typedWords[j] });
      j++;
    } else {
      // Equal LCS continuation — treat as substitution pair
      ops.push({
        type: 'substitution',
        expected: refWords[i],
        typed: typedWords[j],
        isHomophone: areHomophones(refWords[i], typedWords[j]),
      });
      i++;
      j++;
    }
  }
  while (i < m) {
    ops.push({ type: 'omission', expected: refWords[i++] });
  }
  while (j < n) {
    ops.push({ type: 'addition', typed: typedWords[j++] });
  }

  return ops;
}

export interface HomophoneMatch {
  expected: string;
  typed: string;
}

export function detectHomophoneErrors(diffs: readonly DiffPair[]): HomophoneMatch[] {
  return diffs
    .filter((d) => d.type === 'substitution' && d.isHomophone && d.expected && d.typed)
    .map((d) => ({ expected: d.expected as string, typed: d.typed as string }));
}

export interface TypingMetricsInput {
  referenceWords: number;
  typedWords: number;
  typedKeystrokes: number;
  durationMinutes: number;
  fullMistakes: number;
  halfMistakes: number;
  wordCountMode?: '5-stroke' | '1-space';
  penaltyPerErrorWord?: number;
}

export interface TypingMetricsResult {
  effectiveWords: number;
  totalErrors: number;
  grossWpm: number;
  netWpm: number;
  errorPercent: number;
  accuracyPercent: number;
}

export function calculateTypingMetrics(input: TypingMetricsInput): TypingMetricsResult {
  const mins = Math.max(input.durationMinutes, 1 / 60);
  const mode = input.wordCountMode ?? '5-stroke';
  const effectiveWords =
    mode === '5-stroke'
      ? Number((Math.max(0, input.typedKeystrokes) / 5).toFixed(2))
      : Math.max(0, input.typedWords);

  const totalErrors = Number(
    (Math.max(0, input.fullMistakes) + Math.max(0, input.halfMistakes) * 0.5).toFixed(2),
  );
  const penalty = input.penaltyPerErrorWord ?? 1;
  const grossWpm = Number((effectiveWords / mins).toFixed(2));
  const netWords = Math.max(0, effectiveWords - totalErrors * penalty);
  const netWpm = Number((netWords / mins).toFixed(2));

  const denom = Math.max(1, input.referenceWords || effectiveWords);
  const errorPercent = Number(((totalErrors / denom) * 100).toFixed(2));
  const accuracyPercent = Number(Math.max(0, Math.min(100, 100 - errorPercent)).toFixed(2));

  return {
    effectiveWords,
    totalErrors,
    grossWpm,
    netWpm,
    errorPercent,
    accuracyPercent,
  };
}
