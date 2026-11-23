import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

const DRIVE_ID_RE = /^[a-zA-Z0-9_-]{10,120}$/;

function isPrivateOrBlockedHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) {
    return true;
  }
  if (h === '::1' || h === '[::1]' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) {
    return true;
  }
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

function buildDriveCandidateUrls(driveId: string, kind: string): string[] {
  const encId = encodeURIComponent(driveId);
  if (kind === 'image') {
    return [
      `https://lh3.googleusercontent.com/d/${encId}=s1600`,
      `https://drive.usercontent.google.com/download?id=${encId}&export=view`,
      `https://drive.google.com/uc?export=view&id=${encId}`,
    ];
  }
  if (kind === 'doc') {
    return [
      `https://docs.google.com/document/d/${encId}/export?format=pdf`,
      `https://drive.usercontent.google.com/download?id=${encId}&export=download&confirm=t`,
    ];
  }
  if (kind === 'slides') {
    return [
      `https://docs.google.com/presentation/d/${encId}/export/pdf`,
      `https://drive.usercontent.google.com/download?id=${encId}&export=download&confirm=t`,
    ];
  }
  if (kind === 'sheets') {
    return [
      `https://docs.google.com/spreadsheets/d/${encId}/export?format=pdf`,
      `https://drive.usercontent.google.com/download?id=${encId}&export=download&confirm=t`,
    ];
  }
  return [
    `https://drive.usercontent.google.com/download?id=${encId}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&confirm=t&id=${encId}`,
    `https://docs.google.com/uc?export=download&id=${encId}`,
  ];
}

function extractDriveConfirmUrlFromHtml(html: string, driveId: string): string | null {
  const actionMatch = html.match(/action="(https:\/\/drive\.usercontent\.google\.com\/download[^"]*)"/i);
  const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i);
  const confirmMatch = html.match(/name="confirm"\s+value="([^"]+)"/i) || html.match(/confirm=([0-9A-Za-z_-]+)/i);
  const atMatch = html.match(/name="at"\s+value="([^"]+)"/i);

  const base = actionMatch && actionMatch[1]
    ? actionMatch[1].replace(/&amp;/g, '&')
    : 'https://drive.usercontent.google.com/download';
  const u = new URL(base);
  u.searchParams.set('id', driveId);
  u.searchParams.set('export', 'download');
  u.searchParams.set('confirm', (confirmMatch && confirmMatch[1]) ? confirmMatch[1] : 't');
  if (uuidMatch && uuidMatch[1]) u.searchParams.set('uuid', uuidMatch[1]);
  if (atMatch && atMatch[1]) u.searchParams.set('at', atMatch[1]);
  return u.toString();
}

async function fetchAnonymously(targetUrl: string, rangeHeader?: string): Promise<globalThis.Response> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (rangeHeader) {
    headers.Range = rangeHeader;
  }
  return fetch(targetUrl, {
    method: 'GET',
    headers,
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
  });
}

function inferContentType(upstreamType: string | null, kind: string, targetUrl: string): string {
  const ct = (upstreamType || '').split(';')[0].trim().toLowerCase();
  if (ct && ct !== 'application/octet-stream' && ct !== 'binary/octet-stream' && ct !== 'text/plain') {
    return ct;
  }
  if (kind === 'pdf' || kind === 'doc' || kind === 'slides' || kind === 'sheets' || /\.pdf(\?|$)/i.test(targetUrl)) {
    return 'application/pdf';
  }
  if (kind === 'image') return 'image/jpeg';
  if (kind === 'audio') {
    if (/\.wav(\?|$)/i.test(targetUrl)) return 'audio/wav';
    if (/\.ogg(\?|$)/i.test(targetUrl)) return 'audio/ogg';
    if (/\.m4a(\?|$)/i.test(targetUrl)) return 'audio/mp4';
    return 'audio/mpeg';
  }
  if (kind === 'video') {
    if (/\.webm(\?|$)/i.test(targetUrl)) return 'video/webm';
    return 'video/mp4';
  }
  return ct || 'application/octet-stream';
}

async function handleMediaProxy(req: Request, res: Response): Promise<void> {
  // Block direct top-level browser tab navigation so materials cannot be opened in a separate tab
  const fetchMode = String(req.headers['sec-fetch-mode'] || '').toLowerCase();
  const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
  if (fetchMode === 'navigate' && fetchDest === 'document') {
    res.status(403).setHeader('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Protected Portal Material</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;text-align:center;">
  <div style="max-width:420px;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:24px;">
    <h2 style="margin:0 0 8px 0;font-size:18px;">Protected Study Material</h2>
    <p style="margin:0;font-size:13.5px;color:#cbd5e1;line-height:1.6;">Direct opening in a new browser tab is disabled. Please view this material inside the portal viewer.</p>
  </div>
</body>
</html>`);
    return;
  }

  const rawDriveId = String(req.query.driveId || '').trim();
  const rawUrl = String(req.query.url || '').trim();
  const kind = String(req.query.kind || 'file').trim().toLowerCase();
  const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;

  const candidateUrls: string[] = [];

  if (rawDriveId) {
    if (!DRIVE_ID_RE.test(rawDriveId)) {
      res.status(400).json({ error: 'Invalid driveId parameter' });
      return;
    }
    candidateUrls.push(...buildDriveCandidateUrls(rawDriveId, kind));
  } else if (rawUrl) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid url parameter' });
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      res.status(400).json({ error: 'Unsupported URL protocol' });
      return;
    }
    if (isPrivateOrBlockedHost(parsed.hostname)) {
      res.status(403).json({ error: 'Blocked host' });
      return;
    }
    // If a Google Drive/Docs URL was passed via ?url=..., extract its ID and handle anonymously
    if (parsed.hostname.includes('drive.google.com') || parsed.hostname.includes('docs.google.com') || parsed.hostname.includes('googleusercontent.com')) {
      const idMatch = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1] && DRIVE_ID_RE.test(idMatch[1])) {
        let inferredKind = kind;
        if (rawUrl.includes('docs.google.com/document/')) inferredKind = 'doc';
        else if (rawUrl.includes('docs.google.com/presentation/')) inferredKind = 'slides';
        else if (rawUrl.includes('docs.google.com/spreadsheets/')) inferredKind = 'sheets';
        candidateUrls.push(...buildDriveCandidateUrls(idMatch[1], inferredKind));
      } else {
        candidateUrls.push(parsed.toString());
      }
    } else {
      let normalized = parsed.toString();
      if (normalized.includes('github.com') && normalized.includes('/blob/')) {
        normalized = normalized.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }
      candidateUrls.push(normalized);
    }
  } else {
    res.status(400).json({ error: 'Missing driveId or url parameter' });
    return;
  }

  let finalResp: globalThis.Response | null = null;
  let finalUrl = candidateUrls[0] || '';

  for (const candidate of candidateUrls) {
    try {
      let resp = await fetchAnonymously(candidate, rangeHeader);
      const cType = String(resp.headers.get('content-type') || '').toLowerCase();

      // Handle Google Drive virus-scan confirmation interstitial HTML automatically on server
      if (resp.ok && cType.includes('text/html') && rawDriveId && kind !== 'file') {
        const htmlText = await resp.text();
        if (/download-form|confirm=|uc-download-link|virus scan/i.test(htmlText)) {
          const confirmUrl = extractDriveConfirmUrlFromHtml(htmlText, rawDriveId);
          if (confirmUrl) {
            resp = await fetchAnonymously(confirmUrl, rangeHeader);
          }
        } else {
          // Not the actual media binary — try next candidate URL
          continue;
        }
      }

      const finalCt = String(resp.headers.get('content-type') || '').toLowerCase();
      if ((resp.ok || resp.status === 206) && !(finalCt.includes('text/html') && (kind === 'pdf' || kind === 'image' || kind === 'audio' || kind === 'video'))) {
        finalResp = resp;
        finalUrl = candidate;
        break;
      }
    } catch {
      // Try next candidate
    }
  }

  if (!finalResp || !finalResp.body) {
    res.status(502).json({ error: 'Unable to stream protected media from upstream source.' });
    return;
  }

  const contentType = inferContentType(finalResp.headers.get('content-type'), kind, finalUrl);
  res.status(finalResp.status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Accept-Ranges', finalResp.headers.get('accept-ranges') || 'bytes');

  const contentLength = finalResp.headers.get('content-length');
  if (contentLength) res.setHeader('Content-Length', contentLength);
  const contentRange = finalResp.headers.get('content-range');
  if (contentRange) res.setHeader('Content-Range', contentRange);

  const nodeStream = Readable.fromWeb(finalResp.body as Parameters<typeof Readable.fromWeb>[0]);
  nodeStream.on('error', () => {
    if (!res.headersSent) {
      res.status(502).end();
    } else {
      res.end();
    }
  });
  res.on('close', () => {
    nodeStream.destroy();
  });
  nodeStream.pipe(res);
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/media-proxy', (req: Request, res: Response) => {
    handleMediaProxy(req, res).catch(() => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Media proxy error' });
      }
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RP Skill Portal server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
