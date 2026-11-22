/**
 * Resilient CBT Mock Exam JSON & Plain-Text payload parser.
 * Supports bare question arrays, wrapped objects ({ questions / mcqs / data / items }),
 * sectioned structures ({ sections: [{ name, questions }] }), double-encoded JSON strings,
 * HTML-entity-escaped JSON, raw newlines inside strings, markdown code fences,
 * plain-text MCQ fallback, and remote JSON URL detection.
 */

export interface ParsedCbtPayload {
  questions: Record<string, unknown>[];
  remoteUrl: string | null;
}

function decodeBasicHtmlEntities(input: string): string {
  return input
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function cleanJsonString(input: string): string {
  let cleaned = input.replace(/^\uFEFF/, '').trim();
  // Strip optional markdown ```json ... ``` fences
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }
  if (cleaned.includes('&quot;') || cleaned.includes('&#34;')) {
    cleaned = decodeBasicHtmlEntities(cleaned).trim();
  }
  return cleaned;
}

function escapeNewlinesInsideJsonStrings(src: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function tryParseJsonForgiving(text: string): unknown {
  const candidates: string[] = [text];
  const smartFixed = text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
  candidates.push(smartFixed);
  candidates.push(escapeNewlinesInsideJsonStrings(smartFixed));

  // Try extracting an embedded JSON array or object if surrounded by notes/prose
  const firstBracket = smartFixed.indexOf('[');
  const lastBracket = smartFixed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const slice = smartFixed.slice(firstBracket, lastBracket + 1);
    candidates.push(slice);
    candidates.push(escapeNewlinesInsideJsonStrings(slice));
  }
  const firstBrace = smartFixed.indexOf('{');
  const lastBrace = smartFixed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = smartFixed.slice(firstBrace, lastBrace + 1);
    candidates.push(slice);
    candidates.push(escapeNewlinesInsideJsonStrings(slice));
  }

  for (const cand of candidates) {
    try {
      const parsed = JSON.parse(cand);
      if (parsed !== null && parsed !== undefined) return parsed;
    } catch {
      // continue to next candidate
    }
  }
  return null;
}

function isSingleQuestionObject(obj: Record<string, unknown>): boolean {
  return Boolean(
    (obj.qEn || obj.question || obj.q || obj.text || obj.prompt) &&
      (Array.isArray(obj.optionsEn) ||
        Array.isArray(obj.options) ||
        obj.optionA ||
        obj.a ||
        obj.A),
  );
}

function normalizeQuestionObject(q: Record<string, unknown>): Record<string, unknown> {
  // Support flat optionA/optionB/optionC/optionD or A/B/C/D style objects
  if (!Array.isArray(q.optionsEn) && !Array.isArray(q.options)) {
    const flatOpts = [
      q.optionA ?? q.option1 ?? q.optA ?? q.A ?? q.a,
      q.optionB ?? q.option2 ?? q.optB ?? q.B ?? q.b,
      q.optionC ?? q.option3 ?? q.optC ?? q.C ?? q.c,
      q.optionD ?? q.option4 ?? q.optD ?? q.D ?? q.d,
    ].filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
    if (flatOpts.length >= 2) {
      q = { ...q, options: flatOpts.map((v) => String(v)) };
    }
  }
  // Support letter answer like "A" / "B" / "C" / "D" or "1"-"4"
  if (typeof q.correctIndex !== 'number') {
    const ansRaw = q.correctIndex ?? q.correctOption ?? q.correct ?? q.answer ?? q.ans;
    if (typeof ansRaw === 'string') {
      const t = ansRaw.trim().toUpperCase();
      const letterIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(t);
      if (letterIdx >= 0) {
        q = { ...q, correctIndex: letterIdx };
      } else if (/^\d+$/.test(t)) {
        const n = parseInt(t, 10);
        q = { ...q, correctIndex: n >= 1 && n <= 4 ? n - 1 : n };
      }
    } else if (typeof ansRaw === 'number' && !isNaN(ansRaw)) {
      q = { ...q, correctIndex: ansRaw };
    }
  }
  return q;
}

function extractQuestionsFromParsed(parsed: unknown): Record<string, unknown>[] {
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    return parsed
      .filter((q): q is Record<string, unknown> => Boolean(q && typeof q === 'object'))
      .map(normalizeQuestionObject);
  }
  if (typeof parsed !== 'object') return [];

  const obj = parsed as Record<string, unknown>;

  // Direct array properties
  const arrayKeys = ['questions', 'mcqs', 'items', 'data', 'list', 'testQuestions', 'quiz', 'records'];
  for (const key of arrayKeys) {
    if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
      return (obj[key] as unknown[])
        .filter((q): q is Record<string, unknown> => Boolean(q && typeof q === 'object'))
        .map(normalizeQuestionObject);
    }
  }

  // Nested exam object e.g. { exam: { questions: [...] } }
  if (obj.exam && typeof obj.exam === 'object') {
    const nested = extractQuestionsFromParsed(obj.exam);
    if (nested.length > 0) return nested;
  }

  // Sectioned format e.g. { sections: [{ name: 'English', questions: [...] }] }
  if (Array.isArray(obj.sections)) {
    const flattened: Record<string, unknown>[] = [];
    for (let i = 0; i < obj.sections.length; i++) {
      const sec = obj.sections[i];
      if (!sec || typeof sec !== 'object') continue;
      const secObj = sec as Record<string, unknown>;
      const secName = String(
        secObj.name || secObj.title || secObj.section || `Section ${i + 1}`,
      ).trim();
      const secQuestions = extractQuestionsFromParsed(secObj);
      for (const q of secQuestions) {
        flattened.push({
          ...q,
          section: q.section || secName,
        });
      }
    }
    if (flattened.length > 0) return flattened;
  }

  // Single question object fallback
  if (isSingleQuestionObject(obj)) {
    return [normalizeQuestionObject(obj)];
  }

  return [];
}

function parsePlainTextMcqs(text: string): Record<string, unknown>[] {
  const blocks = text
    .split(/\n(?=(?:Q(?:uestion)?\s*\d+|\d+\s*[.)])\s)/i)
    .map((b) => b.trim())
    .filter(Boolean);
  const results: Record<string, unknown>[] = [];
  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 3) continue;
    const qLine = lines[0].replace(/^(?:Q(?:uestion)?\s*\d*\s*[:.)-]|\d+\s*[.):-])\s*/i, '').trim();
    const options: string[] = [];
    let correctIndex = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const optMatch = line.match(/^(?:\(?([A-Da-d])\)|([A-Da-d])[.):-])\s+(.+)$/);
      if (optMatch) {
        options.push(optMatch[3].trim());
        continue;
      }
      const ansMatch = line.match(/^(?:Ans(?:wer)?|Correct)\s*[:=-]?\s*\(?([A-Da-d1-4])\)?/i);
      if (ansMatch) {
        const token = ansMatch[1].toUpperCase();
        const idx = ['A', 'B', 'C', 'D'].indexOf(token);
        if (idx >= 0) correctIndex = idx;
        else correctIndex = Math.max(0, parseInt(token, 10) - 1);
      }
    }
    if (qLine && options.length >= 2) {
      results.push({
        qEn: qLine,
        optionsEn: options,
        correctIndex,
      });
    }
  }
  return results;
}

export function parseCbtQuestionsPayload(raw: unknown): ParsedCbtPayload {
  if (!raw) return { questions: [], remoteUrl: null };

  if (Array.isArray(raw) || typeof raw === 'object') {
    return { questions: extractQuestionsFromParsed(raw), remoteUrl: null };
  }

  const text = cleanJsonString(String(raw));
  if (!text || text === '-') return { questions: [], remoteUrl: null };

  // Detect remote HTTP(S) JSON link (e.g. GitHub raw, Google Drive, CDN)
  if (/^https?:\/\/\S+$/i.test(text)) {
    return { questions: [], remoteUrl: text };
  }

  let parsed = tryParseJsonForgiving(text);
  // Unwrap double-encoded JSON strings (e.g. stored in Sheets with outer quotes)
  if (typeof parsed === 'string') {
    const inner = cleanJsonString(parsed);
    if (/^https?:\/\/\S+$/i.test(inner)) {
      return { questions: [], remoteUrl: inner };
    }
    parsed = tryParseJsonForgiving(inner);
  }

  const extracted = extractQuestionsFromParsed(parsed);
  if (extracted.length > 0) {
    return { questions: extracted, remoteUrl: null };
  }

  // Fallback for plain-text Q&A formatted CBT materials
  const plainMcqs = parsePlainTextMcqs(text);
  if (plainMcqs.length > 0) {
    return { questions: plainMcqs, remoteUrl: null };
  }

  return { questions: [], remoteUrl: null };
}
