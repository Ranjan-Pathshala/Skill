/**
 * Pure string, date, URL, media-clip time, and passage word/stroke utilities.
 */

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function rpSanitizeUrl(url: unknown): string {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  if (/^(javascript|data:text\/html|vbscript):/i.test(raw)) return '';
  if (/^(https?:\/\/|\/|#|mailto:|tel:|upi:\/\/|blob:|data:image\/|data:audio\/|data:application\/pdf)/i.test(raw)) {
    return raw;
  }
  return '';
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLocalDate(dateInput: unknown): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim();
    if (!cleanStr) return '';
    if (cleanStr.includes('T')) return cleanStr.split('T')[0];
    if (cleanStr.includes(' ')) return cleanStr.split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;
  }
  const d = new Date(dateInput as string | number | Date);
  if (Number.isNaN(d.getTime())) {
    return String(dateInput).split('T')[0];
  }
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a clip timestamp string ("MM:SS", "HH:MM:SS", or numeric seconds) into seconds.
 * Returns null if blank or invalid.
 */
export function parseMediaClipTimeSec(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const sec = Number(raw);
    return Number.isFinite(sec) && sec >= 0 ? Math.floor(sec) : null;
  }
  const parts = raw.split(':').map((p) => p.trim());
  if (parts.length === 2 || parts.length === 3) {
    const nums = parts.map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
    if (nums.length === 2) return Math.floor(nums[0] * 60 + nums[1]);
    return Math.floor(nums[0] * 3600 + nums[1] * 60 + nums[2]);
  }
  return null;
}

export function formatMediaClipSec(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '00:00';
  }
  const secs = Math.floor(totalSeconds);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function countPassageWords(text: string): number {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function countPassageStrokes(text: string): number {
  return String(text || '').replace(/\r\n/g, '\n').length;
}
