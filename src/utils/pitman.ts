/**
 * Pure Pitman Shorthand Outline SVG Generator & Hard-Word Extractor.
 */

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'were', 'been',
  'they', 'their', 'there', 'which', 'would', 'could', 'should', 'about', 'after',
  'before', 'being', 'between', 'under', 'where', 'while', 'shall', 'other',
]);

export function extractHardWordsFromPassage(passage: string, limit: number = 50): string[] {
  const safeLimit = Math.max(1, limit);
  const allTokens = String(passage || '')
    .split(/[^A-Za-z'-]+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, '').trim())
    .filter((w) => w.length >= 5 && !STOP_WORDS.has(w.toLowerCase()));

  const uniqueLong = new Map<string, string>();
  const uniqueMed = new Map<string, string>();
  for (const w of allTokens) {
    const key = w.toLowerCase();
    if (w.length >= 6) {
      if (!uniqueLong.has(key)) uniqueLong.set(key, w);
    } else if (!uniqueLong.has(key) && !uniqueMed.has(key)) {
      uniqueMed.set(key, w);
    }
  }

  const longSorted = Array.from(uniqueLong.values()).sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  );
  if (longSorted.length >= safeLimit) {
    return longSorted.slice(0, safeLimit);
  }

  const medSorted = Array.from(uniqueMed.values()).sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  );
  return [...longSorted, ...medSorted].slice(0, safeLimit);
}

/**
 * Generates a deterministic Pitman-style phonetic stroke preview SVG for a word.
 */
export function buildPitmanStrokeSvg(word: string): string {
  const clean = String(word || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!clean) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 56"></svg>';
  }

  const strokes: string[] = [];
  let x = 14;
  let y = 28;

  for (let i = 0; i < Math.min(clean.length, 8); i++) {
    const ch = clean[i];
    const heavy = 'bdgjvz'.includes(ch);
    const sw = heavy ? 3.2 : 1.8;
    let dx = 12;
    let dy = 0;
    let curved = false;

    if ('pb'.includes(ch)) { dx = 8; dy = 14; }
    else if ('td'.includes(ch)) { dx = 0; dy = 15; }
    else if ('cj'.includes(ch)) { dx = -7; dy = 14; }
    else if ('kg'.includes(ch)) { dx = 15; dy = 0; }
    else if ('fvszmnlr'.includes(ch)) { dx = 12; dy = ch === 'l' || ch === 'r' ? -10 : 8; curved = true; }
    else { continue; }

    const nx = Math.max(8, Math.min(112, x + dx));
    const ny = Math.max(8, Math.min(48, y + dy));
    if (curved) {
      const cx = (x + nx) / 2 + 4;
      const cy = (y + ny) / 2 - 4;
      strokes.push(`<path d="M${x},${y} Q${cx},${cy} ${nx},${ny}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round"/>`);
    } else {
      strokes.push(`<line x1="${x}" y1="${y}" x2="${nx}" y2="${ny}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round"/>`);
    }
    x = nx;
    y = ny;
  }

  if (strokes.length === 0) {
    strokes.push('<line x1="20" y1="28" x2="100" y2="28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>');
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 56" role="img" aria-label="Pitman outline for ${clean}">${strokes.join('')}</svg>`;
}
