/**
 * Zero-Footprint Media Proxy & Anti-New-Tab Utilities.
 *
 * Routes Google Drive / Docs / Googleusercontent and external study material URLs
 * through the server-side cookie-less `/api/media-proxy` endpoint so user Google
 * accounts never touch Drive directly (preventing "Shared with me" / "Recent"
 * footprints) and materials cannot be popped out or opened in another browser tab.
 */

export type ProtectedMediaKind = 'pdf' | 'image' | 'audio' | 'video' | 'file' | 'doc' | 'slides' | 'sheets';

const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,120}$/;

export function isGoogleDriveOrDocsUrl(rawUrl: string): boolean {
  const s = String(rawUrl || '').trim().toLowerCase();
  if (!s) return false;
  return (
    s.includes('drive.google.com') ||
    s.includes('docs.google.com') ||
    s.includes('drive.usercontent.google.com') ||
    s.includes('googleusercontent.com/d/')
  );
}

export function extractGoogleDriveFileId(rawUrl: string): string {
  const s = String(rawUrl || '').trim();
  if (!s) return '';
  if (!isGoogleDriveOrDocsUrl(s)) return '';
  const match =
    s.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1] && DRIVE_ID_PATTERN.test(match[1])) {
    return match[1];
  }
  return '';
}

export function detectProtectedDriveKind(rawUrl: string, fallbackKind: ProtectedMediaKind = 'file'): ProtectedMediaKind {
  const low = String(rawUrl || '').trim().toLowerCase();
  if (low.includes('docs.google.com/document/')) return 'doc';
  if (low.includes('docs.google.com/presentation/')) return 'slides';
  if (low.includes('docs.google.com/spreadsheets/')) return 'sheets';
  return fallbackKind;
}

export function buildProtectedMediaProxyUrl(rawUrl: string, kind: ProtectedMediaKind = 'file'): string {
  const s = String(rawUrl || '').trim();
  if (!s || s === '-') return '';
  if (s.startsWith('/api/media-proxy') || s.startsWith('./api/media-proxy')) return s;
  if (s.startsWith('data:') || s.startsWith('blob:')) return s;

  const driveId = extractGoogleDriveFileId(s);
  if (driveId) {
    const resolvedKind = detectProtectedDriveKind(s, kind);
    return `/api/media-proxy?driveId=${encodeURIComponent(driveId)}&kind=${encodeURIComponent(resolvedKind)}`;
  }

  let normalized = s;
  if (normalized.includes('github.com') && normalized.includes('/blob/')) {
    normalized = normalized.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }

  if (/^https?:\/\//i.test(normalized)) {
    const low = normalized.toLowerCase();
    // Leave YouTube URLs untouched so YouTube player handles them
    if (low.includes('youtube.com') || low.includes('youtu.be') || low.includes('img.youtube.com')) {
      return normalized;
    }
    return `/api/media-proxy?url=${encodeURIComponent(normalized)}&kind=${encodeURIComponent(kind)}`;
  }

  return normalized;
}

const PROTECTED_VIEWER_SELECTOR = [
  '#reader-modal',
  '#embedded-image-modal',
  '#reference-video-modal',
  '#universal-media-modal',
  '#view-pdf',
  '#view-words',
  '#view-videocourse',
  '#view-audio',
  '#view-pitman',
  '#active-test-modal',
].join(', ');

let _antiNewTabInstalled = false;

export function installAntiNewTabMaterialGuards(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || _antiNewTabInstalled) return;
  _antiNewTabInstalled = true;

  // Block dragging protected images/videos/canvases into the browser tab strip
  document.addEventListener(
    'dragstart',
    (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(PROTECTED_VIEWER_SELECTOR)) {
        const tag = target.tagName;
        if (tag === 'IMG' || tag === 'VIDEO' || tag === 'AUDIO' || tag === 'CANVAS' || tag === 'A') {
          e.preventDefault();
        }
      }
    },
    true,
  );

  // Block right-click "Open image/video/link in new tab" inside protected material viewers
  document.addEventListener(
    'contextmenu',
    (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const inModalViewer = target.closest('#reader-modal, #embedded-image-modal, #reference-video-modal, #universal-media-modal');
      const isMediaEl = Boolean(target.closest('img, video, audio, canvas, iframe, .card-thumb'));
      if (inModalViewer || (isMediaEl && target.closest(PROTECTED_VIEWER_SELECTOR))) {
        e.preventDefault();
      }
    },
    true,
  );

  // Block middle-click and Ctrl/Cmd/Shift + click on links/media inside protected material areas
  document.addEventListener(
    'auxclick',
    (e: MouseEvent) => {
      if (e.button !== 1) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest(PROTECTED_VIEWER_SELECTOR)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );

  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if ((e.ctrlKey || e.metaKey || e.shiftKey) && target.closest(PROTECTED_VIEWER_SELECTOR)) {
        const linkOrMedia = target.closest('a, img, video, audio, .card, .card-thumb');
        if (linkOrMedia) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
      // Also prevent any stray <a target="_blank"> inside protected material viewers from escaping to a new tab
      const anchor = target.closest('a[target="_blank"]') as HTMLAnchorElement | null;
      if (anchor && anchor.closest(PROTECTED_VIEWER_SELECTOR)) {
        const href = anchor.getAttribute('href') || '';
        if (href && (isGoogleDriveOrDocsUrl(href) || href.includes('/api/media-proxy'))) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    true,
  );
}
