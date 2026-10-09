import { CustomPlaylist, LyricsData, SyncedLyricsLine, Track } from '../types';
import { getExplicitInterestedTracks, getExplicitNotInterestedTracks } from './storage';
import { sessionManager } from './sessionManager';

export const NEW_HUB_BACKEND =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('run.app') ||
    window.location.port === '3000')
    ? ''
    : 'https://new-music-space-api.urshabib.workers.dev';

export const STREAM_MIRRORS = [
  'https://invidious.schenkel.eti.br/api/v1/videos/',
  'https://invidious.kemonomimi.nl/api/v1/videos/',
  'https://yt.omada.cafe/api/v1/videos/',
  'https://invidious.no-logs.com/api/v1/videos/',
  'https://inv.tux.pizza/api/v1/videos/',
  'https://invidious.private.coffee/api/v1/videos/',
  'https://vid.priv.au/api/v1/videos/',
];

export const FALLBACK_ART = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300';
export const PLAYLIST_ART = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300';

// Stream cache in-memory for instant response (< 50ms) on skips / repeat
const streamUrlCache = new Map<string, { url: string; expires: number }>();

export function getCachedStreamUrl(trackId: string): string | null {
  const cached = streamUrlCache.get(trackId);
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }
  if (cached) streamUrlCache.delete(trackId);
  return null;
}

export function cacheStreamUrl(trackId: string, url: string, ttlMs = 25 * 60 * 1000) {
  streamUrlCache.set(trackId, { url, expires: Date.now() + ttlMs });
}

export async function fetchWithTimeout(url: string, ms = 8000, options: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  let onAbort: (() => void) | null = null;
  if (options.signal) {
    onAbort = () => ctrl.abort();
    if (options.signal.aborted) ctrl.abort();
    else options.signal.addEventListener('abort', onAbort, { once: true });
  }
  const next: RequestInit = { ...options, signal: ctrl.signal };
  return fetch(url, next).finally(() => {
    clearTimeout(t);
    if (options.signal && onAbort) {
      options.signal.removeEventListener('abort', onAbort);
    }
  });
}

export async function fetchJsonRetry<T>(url: string, tries = 3, delay = 500): Promise<T> {
  let lastErr: Error | null = null;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetchWithTimeout(url, 7000);
      if (res.ok) {
        const data = await res.json();
        return data as T;
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e as Error;
    }
    if (i < tries) await new Promise((r) => setTimeout(r, delay * i));
  }
  throw lastErr || new Error(`No data from ${url}`);
}

// Metadata cleaners
export function cleanTitle(item: any): string {
  if (!item) return 'Unknown Title';
  if (typeof item === 'string') return item;
  if (item.title) return item.title;
  if (item.name) return item.name;
  if (item.runs && item.runs.length > 0) return item.runs[0].text;
  return 'Unknown Title';
}

export function cleanArtistName(item: any): string {
  if (!item) return 'Various Artists';
  const cleanStr = (s: string) => {
    return s
      .replace(/\s*-\s*Topic\b/gi, '')
      .replace(/\s*vevo\b/gi, '')
      .replace(/\s*official\s*(?:video|audio|channel)?\b/gi, '')
      .replace(/\s*(?:records|recordings|entertainment)\b/gi, '')
      .trim();
  };
  if (typeof item === 'string') return cleanStr(item) || 'Various Artists';
  let runs = item.artists || item.author || item.artist;
  if (!runs) return 'Various Artists';
  if (typeof runs === 'string') return cleanStr(runs) || 'Various Artists';
  if (Array.isArray(runs)) {
    return runs
      .map((a) => cleanStr(typeof a === 'string' ? a : a.name || a.text || ''))
      .filter(Boolean)
      .join(', ') || 'Various Artists';
  }
  if (runs.runs && Array.isArray(runs.runs)) {
    return runs.runs.map((r: any) => cleanStr(r.text)).filter(Boolean).join(', ') || 'Various Artists';
  }
  if (runs.name) return cleanStr(runs.name) || 'Various Artists';
  return 'Various Artists';
}

export function upgradeThumbQuality(url: string | null | undefined): string {
  if (!url) return FALLBACK_ART;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  
  // High-res YouTube Music / Google User Content covers (upgrade to pristine 800x800)
  if (url.includes('googleusercontent.com') || url.includes('yt3.ggpht.com') || url.includes('ggpht.com')) {
    if (/=w\d+-h\d+/.test(url)) {
      return url.replace(/=w\d+-h\d+[^?&]*/, '=w800-h800-l90-rj');
    }
    if (/=s\d+/.test(url)) {
      return url.replace(/=s\d+[^?&]*/, '=s800-c-k-c0x00ffffff-no-rj');
    }
    return `${url}=w800-h800-l90-rj`;
  }

  // JioSaavn thumbnails upgrade to 500x500 HD
  if (url.includes('saavncdn.com')) {
    return url.replace(/150x150\.jpg/g, '500x500.jpg').replace(/50x50\.jpg/g, '500x500.jpg');
  }

  // High-res YouTube Video Thumbnails (upgrade to maxresdefault with hqdefault fallback 800x800)
  if (url.includes('ytimg.com')) {
    const idMatch = url.match(/\/vi(?:_webp)?\/([A-Za-z0-9_-]{11})\//);
    if (idMatch && idMatch[1]) {
      return canonicalThumbUrl(idMatch[1]);
    }
    return url.replace(/\/(?:mqdefault|default)\.(?:webp|jpg)/, '/maxresdefault.jpg');
  }

  // Wsrv.nl URLs - bump to 800x800
  if (url.includes('wsrv.nl/?url=')) {
    return url.replace(/w=\d+/, 'w=800').replace(/h=\d+/, 'h=800').replace(/q=\d+/, 'q=90');
  }

  return url;
}

export function getTrackThumbnail(item: any): string {
  if (!item) return FALLBACK_ART;
  if (typeof item === 'string') {
    if (item.startsWith('http') || item.includes('googleusercontent') || item.includes('ytimg')) {
      return upgradeThumbQuality(item);
    }
  }
  if (item.img && typeof item.img === 'string') {
    if (item.img.startsWith('http')) return upgradeThumbQuality(item.img);
    if (item.img.startsWith('/')) {
      return `https://lh3.googleusercontent.com${item.img}=w800-h800-l90-rj`;
    }
    return canonicalThumbUrl(item.img);
  }
  if (item.thumbnails && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
    // Sort to pick the highest resolution thumbnail
    const sorted = [...item.thumbnails].sort((a, b) => {
      const aArea = (a.width || 0) * (a.height || 0);
      const bArea = (b.width || 0) * (b.height || 0);
      return bArea - aArea;
    });
    const bestUrl = sorted[0]?.url || item.thumbnails[item.thumbnails.length - 1].url;
    if (bestUrl) return upgradeThumbQuality(bestUrl);
  }
  if (item.thumbnail && typeof item.thumbnail === 'string') return upgradeThumbQuality(item.thumbnail);
  const targetId = item.id || item.playlistId || item.videoId || item.browseId;
  if (typeof targetId === 'string' && targetId.length > 0) {
    if (targetId.startsWith('/')) return `https://lh3.googleusercontent.com${targetId}=w800-h800-l90-rj`;
    if (targetId.startsWith('PL') || targetId.startsWith('OL') || targetId.startsWith('RD')) return PLAYLIST_ART;
    return canonicalThumbUrl(targetId);
  }
  return FALLBACK_ART;
}

export function canonicalThumbUrl(id: string): string {
  if (!id || id.length !== 11) {
    return FALLBACK_ART;
  }
  return `https://wsrv.nl/?url=https://i.ytimg.com/vi/${id}/maxresdefault.jpg&default=https://i.ytimg.com/vi/${id}/hqdefault.jpg&w=800&h=800&fit=cover&q=90&output=webp`;
}

export function corsSafeThumbUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('wsrv.nl')) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
}

export async function fetchArtworkBlob(
  trackId: string,
  thumbUrl: string | null,
  quality: 'low' | 'medium' | 'high' | 'original' = 'low'
): Promise<Blob | null> {
  const dim =
    quality === 'low'
      ? { w: 150, h: 150, q: 70 }
      : quality === 'medium'
      ? { w: 300, h: 300, q: 80 }
      : quality === 'high'
      ? { w: 500, h: 500, q: 85 }
      : null;

  const candidateUrls: string[] = [];

  // 1. If thumbUrl exists
  if (thumbUrl) {
    if (thumbUrl.startsWith('blob:') || thumbUrl.startsWith('data:')) {
      try {
        const res = await fetch(thumbUrl);
        if (res.ok) return await res.blob();
      } catch {}
    }

    if (dim) {
      candidateUrls.push(
        `https://wsrv.nl/?url=${encodeURIComponent(thumbUrl)}&w=${dim.w}&h=${dim.h}&fit=cover&q=${dim.q}&output=webp`
      );
    }
    candidateUrls.push(corsSafeThumbUrl(thumbUrl) || thumbUrl);
  }

  // 2. YouTube canonical fallbacks
  if (trackId && trackId.length === 11) {
    const ytUrl = `https://i.ytimg.com/vi/${trackId}/mqdefault.jpg`;
    if (dim) {
      candidateUrls.push(
        `https://wsrv.nl/?url=${encodeURIComponent(ytUrl)}&w=${dim.w}&h=${dim.h}&fit=cover&q=${dim.q}&output=webp`
      );
    }
    candidateUrls.push(`https://wsrv.nl/?url=${encodeURIComponent(ytUrl)}`);
  }

  // Attempt each candidate
  for (const url of candidateUrls) {
    try {
      const res = await fetchWithTimeout(url, 8000);
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 500) {
          return blob;
        }
      }
    } catch {}
  }

  return null;
}

export function normalizeTrack(item: any, forcedType: Track['type'] | null = null): Track {
  let type = forcedType || item.type || item.resultType || 'song';
  if (type === 'video') type = 'song';
  if (type === 'channel') type = 'artist';
  return {
    id: item.id || item.videoId || item.playlistId || item.browseId || '',
    title: cleanTitle(item),
    artist: cleanArtistName(item),
    thumb: getTrackThumbnail(item),
    type: type as Track['type'],
  };
}

export function decodeHtmlEntities(s: string): string {
  if (!s) return '';
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
}

const LYRICS_JUNK_WORDS = /\b(official|officiel|oficial|music|video|videoclip|audio|lyric[s]?|lyric\s*video|visuali[sz]er|mv|hd|hq|4k|8k|remaster(?:ed)?|explicit|clip|prod\.?|prod\s+by|color(?:ed)?\s*coded|sub\s*español|legendado)\b/gi;

export function cleanTitleForLyrics(title: string): string {
  if (!title) return '';
  let t = decodeHtmlEntities(String(title)).trim();
  if (/[|•·]/.test(t)) {
    const segs = t.split(/\s*[|•·]\s*/).map((s) => s.trim()).filter(Boolean);
    if (segs.length > 1) {
      const latin = segs.filter((s) => /[a-z]/i.test(s));
      const pool = latin.length ? latin : segs;
      t = pool.sort((a, b) => b.replace(/[^a-z]/gi, '').length - a.replace(/[^a-z]/gi, '').length)[0];
    }
  }
  t = t.replace(/\s*[\(\[\{][^)\]\}]*[\)\]\}]\s*/g, ' ');
  const dash = t.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) t = dash.slice(1).join(' - ');
  t = t
    .replace(/\b(feat\.?|ft\.?|featuring)\b.*$/i, '')
    .replace(LYRICS_JUNK_WORDS, ' ')
    .replace(/["'"'']/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—•·:]+|[\s\-–—•·:]+$/g, '')
    .trim();
  if (t.length < 2) {
    t = decodeHtmlEntities(String(title))
      .replace(/\s*[\(\[\{][^)\]\}]*[\)\]\}]\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return t;
}

export function deriveArtistForLyrics(rawTitle: string, rawArtist: string): string {
  let artist = cleanArtistName(rawArtist);
  if (rawTitle && /\s+[-–—]\s+/.test(rawTitle)) {
    const left = decodeHtmlEntities(rawTitle.split(/\s+[-–—]\s+/)[0])
      .replace(/\s*[\(\[\{][^)\]\}]*[\)\]\}]\s*/g, ' ')
      .replace(/\s*\b(?:feat|ft|featuring)\b\.?\s*/gi, ', ')
      .replace(/\s*[x×&]\s*/gi, ', ')
      .replace(/\s{2,}/g, ' ')
      .replace(/[,\s]+$/, '')
      .trim();
    if (left && left.length <= 60) {
      const baseFirst = (artist || '').split(',')[0].trim().toLowerCase();
      const leftLower = left.toLowerCase();
      if (
        !artist ||
        artist === 'Various Artists' ||
        (baseFirst && (leftLower.includes(baseFirst) || baseFirst.includes(leftLower)))
      ) {
        artist = left;
      }
    }
  }
  return cleanArtistName(artist || 'Various Artists');
}

export function parseLRC(lrcText: string): SyncedLyricsLine[] {
  const timeTag = /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;
  const out: SyncedLyricsLine[] = [];
  lrcText.split(/\r?\n/).forEach((line) => {
    const tags = [...line.matchAll(timeTag)];
    if (!tags.length) return;
    const text = line.replace(timeTag, '').trim();
    tags.forEach((m) => {
      out.push({
        time: parseInt(m[1], 10) * 60 + parseFloat(m[2]),
        text,
      });
    });
  });
  return out.sort((a, b) => a.time - b.time);
}

// Stream resolvers
export async function resolveSaavnStream(
  title: string,
  artist: string,
  quality = '320',
  rawTitle: string | null = null,
  rawArtist: string | null = null
): Promise<string> {
  const attempts: [string, string][] = [];
  const seen = new Set<string>();
  const add = (t: string, a: string) => {
    t = (t || '').trim();
    a = (a || '').trim();
    if (!t || !a) return;
    const key = `${t.toLowerCase()}|${a.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push([t, a]);
  };

  const cleanT = cleanTitleForLyrics(title) || title;
  const cleanA = cleanArtistName(artist);
  add(cleanT, cleanA);

  if (rawTitle) {
    const derivedArtist = deriveArtistForLyrics(rawTitle, rawArtist ?? artist);
    const cleanRaw = cleanTitleForLyrics(rawTitle);
    if (cleanRaw) add(cleanRaw, cleanA);
    if (derivedArtist) {
      add(cleanT, derivedArtist);
      if (cleanRaw) add(cleanRaw, derivedArtist);
    }

    // Split on dash if formatted as "Artist - Title" or "Title - Artist"
    if (/\s+[-–—]\s+/.test(rawTitle)) {
      const parts = rawTitle.split(/\s+[-–—]\s+/).map((p) => p.trim());
      if (parts.length >= 2) {
        const left = cleanTitleForLyrics(parts[0]) || parts[0];
        const right = cleanTitleForLyrics(parts.slice(1).join(' - ')) || parts.slice(1).join(' - ');
        add(right, cleanArtistName(parts[0]));
        add(left, cleanArtistName(parts.slice(1).join(' - ')));
        add(right, cleanA);
        add(left, cleanA);
      }
    }
  }

  // Primary artist alone (strip featured artists)
  const firstArtist = cleanA.split(/[,&]|\bfeat\.?\b|\bft\.?\b/i)[0].trim();
  if (firstArtist && firstArtist !== cleanA) {
    add(cleanT, firstArtist);
  }

  // Raw title fallback if clean stripped too much
  if (rawTitle && rawTitle !== cleanT) {
    add(rawTitle.replace(/\s*[\(\[][^)\]]*[\)\]]/g, '').trim(), cleanA);
  }

  const looksLikeSaavnId = (txt: string) =>
    txt &&
    txt.length >= 6 &&
    txt.length <= 80 &&
    !/\s/.test(txt) &&
    !/error|not[\s_-]?found|missing|parameter|invalid|no\s*results?/i.test(txt);

  // Parallel probe across all candidate title/artist cleanings
  const candidateList = attempts.slice(0, 8);
  const probePromises = candidateList.map(async ([t, a]) => {
    const res = await fetchWithTimeout(
      `https://fast-saavn.vercel.app/api?title=${encodeURIComponent(t)}&artist=${encodeURIComponent(a)}`,
      7500
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = (await res.text()).trim();
    if (looksLikeSaavnId(txt)) {
      return `https://aac.saavncdn.com/${txt}_${quality}.mp4`;
    }
    throw new Error('saavn miss: ' + txt.slice(0, 80));
  });

  try {
    return await Promise.any(probePromises);
  } catch {
    throw new Error('No match found on primary Saavn resolver');
  }
}

export async function resolveWorkerStream(id: string): Promise<string | null> {
  if (!id || id.length < 5) return null;
  try {
    const devId = sessionManager.getDeviceId();
    const token = sessionManager.getSessionToken();
    const query = new URLSearchParams({
      deviceId: devId,
      ...(token ? { sessionToken: token } : {}),
    }).toString();
    const r = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/stream-proxy/${id}?${query}`, 5500, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (r.ok) {
      const j = await r.json();
      const audio = (j?.adaptiveFormats || []).filter((f: any) => f.type && f.type.startsWith('audio'));
      if (audio.length) {
        audio.sort((a: any, b: any) => parseInt(b.bitrate || 0) - parseInt(a.bitrate || 0));
        return audio[0].url;
      }
    }
  } catch {}
  return null;
}

export async function resolveMirrorStreams(id: string): Promise<string[]> {
  if (!id || id.length < 5) return [];
  const settled = await Promise.allSettled(
    STREAM_MIRRORS.map(async (base) => {
      let r: Response | null = null;
      try {
        r = await fetchWithTimeout(base + id, 5000);
      } catch {
        // Fallback through CORS proxy if direct connection had CORS or transport blocks
        try {
          r = await fetchWithTimeout(`https://corsproxy.io/?url=${encodeURIComponent(base + id)}`, 5500);
        } catch {}
      }
      if (!r || !r.ok) throw new Error('bad');
      const j = await r.json();
      if (!j || !j.adaptiveFormats) throw new Error('no formats');
      const audio = j.adaptiveFormats.filter((f: any) => f.type && f.type.startsWith('audio'));
      if (!audio.length) throw new Error('no audio');
      audio.sort((a: any, b: any) => parseInt(b.bitrate || 0) - parseInt(a.bitrate || 0));

      let streamUrl = audio[0].url;
      try {
        const mirrorUrl = new URL(base);
        if (streamUrl.startsWith('/')) {
          streamUrl = mirrorUrl.origin + streamUrl;
        } else {
          const parsedStream = new URL(streamUrl);
          if (parsedStream.hostname.includes('googlevideo.com')) {
            streamUrl = mirrorUrl.origin + parsedStream.pathname + parsedStream.search;
          }
        }
      } catch {}
      return streamUrl;
    })
  );
  return settled.filter((r) => r.status === 'fulfilled').map((r: any) => r.value);
}

export async function resolveBestStreamUniversal(track: Track, quality = '320'): Promise<string | null> {
  if (!track) return null;
  const trackId = track.id;
  const title = track.title;
  const artist = track.artist;

  if (trackId) {
    const cached = getCachedStreamUrl(trackId);
    if (cached) return cached;
  }

  const tasks: Promise<string>[] = [];

  if (trackId && trackId.length === 11) {
    tasks.push(
      resolveWorkerStream(trackId).then((url) => {
        if (!url) throw new Error('worker null');
        return url;
      })
    );
    for (const mirror of STREAM_MIRRORS) {
      tasks.push(
        (async () => {
          try {
            const r = await fetchWithTimeout(mirror + trackId, 4500);
            if (!r.ok) throw new Error('bad');
            const j = await r.json();
            const audio = (j?.adaptiveFormats || []).filter((f: any) => f.type && f.type.startsWith('audio'));
            if (!audio.length) throw new Error('no audio');
            audio.sort((a: any, b: any) => parseInt(b.bitrate || 0) - parseInt(a.bitrate || 0));
            let sUrl = audio[0].url;
            const parsed = new URL(mirror);
            if (sUrl.startsWith('/')) sUrl = parsed.origin + sUrl;
            return sUrl;
          } catch {
            throw new Error('mirror fail');
          }
        })()
      );
    }
  }

  if (title && title !== 'Loading...') {
    tasks.push(
      resolveSaavnStream(
        cleanTitleForLyrics(title) || title,
        cleanArtistName(artist),
        quality,
        title,
        artist
      )
    );
  }

  if (title && title !== 'Loading...') {
    tasks.push(
      (async () => {
        const query = `${title} ${cleanArtistName(artist)}`.trim();
        const found = await searchTracks(query, 'song').catch(() => []);
        for (const f of found.slice(0, 3)) {
          if (!f.id || f.id === trackId) continue;
          const wUrl = await resolveWorkerStream(f.id).catch(() => null);
          if (wUrl) return wUrl;
        }
        throw new Error('search fallback miss');
      })()
    );
  }

  if (tasks.length === 0) return null;

  try {
    const winningUrl = await Promise.any(tasks);
    if (winningUrl && winningUrl.startsWith('http')) {
      if (trackId) cacheStreamUrl(trackId, winningUrl);
      return winningUrl;
    }
  } catch {}

  try {
    const saavnFallback = await resolveSaavnStream(title || 'song', cleanArtistName(artist), quality);
    if (saavnFallback) {
      if (trackId) cacheStreamUrl(trackId, saavnFallback);
      return saavnFallback;
    }
  } catch {}

  return null;
}
export function probeStreamPlayable(url: string, timeoutMs = 3500): Promise<string | null> {
  return new Promise((resolve) => {
    const probe = new Audio();
    probe.preload = 'auto';
    probe.muted = true;
    probe.volume = 0;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      probe.removeEventListener('canplay', onOk);
      probe.removeEventListener('loadedmetadata', onOk);
      probe.removeEventListener('error', onErr);
      probe.removeEventListener('stalled', onErr);
      clearTimeout(timer);
      try {
        probe.src = '';
        probe.load();
      } catch {}
      resolve(ok ? url : null);
    };
    const onOk = () => finish(true);
    const onErr = () => finish(false);
    probe.addEventListener('canplay', onOk, { once: true });
    probe.addEventListener('loadedmetadata', onOk, { once: true });
    probe.addEventListener('error', onErr, { once: true });
    probe.addEventListener('stalled', onErr, { once: true });
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      probe.src = url;
      probe.load();
    } catch {
      finish(false);
    }
  });
}

// Prefetches next track stream and caches in memory
export async function prefetchTrackStream(track: Track, quality = '320'): Promise<string | null> {
  if (!track || !track.id) return null;
  const cached = getCachedStreamUrl(track.id);
  if (cached) return cached;

  try {
    const workerUrl = await resolveWorkerStream(track.id);
    if (workerUrl) {
      cacheStreamUrl(track.id, workerUrl);
      return workerUrl;
    }
  } catch {}

  try {
    const mirrors = await resolveMirrorStreams(track.id);
    if (mirrors.length > 0) {
      cacheStreamUrl(track.id, mirrors[0]);
      return mirrors[0];
    }
  } catch {}

  const cleanedArtist = cleanArtistName(track.artist);
  try {
    const saavnUrl = await resolveSaavnStream(
      cleanTitleForLyrics(track.title) || track.title,
      cleanedArtist,
      quality,
      track.title,
      track.artist
    );
    if (saavnUrl) {
      cacheStreamUrl(track.id, saavnUrl);
      return saavnUrl;
    }
  } catch {}

  return null;
}

// Invidious & Piped playlist fallback mirrors
const INVIDIOUS_PLAYLIST_MIRRORS = [
  'https://yt.omada.cafe/api/v1/playlists/',
  'https://invidious.schenkel.eti.br/api/v1/playlists/',
  'https://invidious.kemonomimi.nl/api/v1/playlists/',
  'https://api.piped.video/playlists/',
];

export function extractYtmPlaylistId(url: string): string | null {
  const m = url.match(/[?&]list=([\w-]+)/);
  return m ? m[1] : null;
}

export function extractSpotifyPlaylistUrl(url: string): string | null {
  return /open\.spotify\.com\/playlist\//.test(url) ? url.split('?')[0] : null;
}

export async function importPlaylistFromSpotify(urlOrId: string): Promise<CustomPlaylist> {
  const match = urlOrId.match(/(?:playlist\/|spotify:playlist:)([a-zA-Z0-9]+)/);
  const spId = match ? match[1] : urlOrId.trim();
  if (!spId || spId.length < 10) {
    throw new Error('Please provide a valid Spotify playlist link.');
  }

  const embedUrl = `https://open.spotify.com/embed/playlist/${spId}`;
  let html = '';

  // Try direct fetch first
  try {
    const res = await fetchWithTimeout(embedUrl, 5000);
    if (res.ok) {
      html = await res.text();
    }
  } catch {}

  // Fallback to CORS proxy
  if (!html || !html.includes('__NEXT_DATA__')) {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(embedUrl)}`;
    try {
      const pRes = await fetchWithTimeout(proxyUrl, 8000);
      if (pRes.ok) {
        html = await pRes.text();
      }
    } catch {}
  }

  if (!html || !html.includes('__NEXT_DATA__')) {
    try {
      const pRes2 = await fetchWithTimeout(`https://corsproxy.io/?url=${encodeURIComponent(embedUrl)}`, 8000);
      if (pRes2.ok) {
        html = await pRes2.text();
      }
    } catch {}
  }

  const dataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (!dataMatch) {
    throw new Error("Could not extract tracks from this Spotify playlist. Make sure it is public.");
  }

  const data = JSON.parse(dataMatch[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;
  if (!entity) {
    throw new Error("Could not read Spotify playlist data.");
  }

  const name = entity.name || entity.title || 'Imported Spotify Playlist';
  const rawTracks = entity.trackList || [];
  const coverUrl = entity.coverArt?.sources?.[0]?.url || null;

  const tracks: Track[] = rawTracks.map((t: any, idx: number) => {
    const trackId = t.uri ? t.uri.replace('spotify:track:', 'sp_') : `sp_${spId}_${idx}`;
    const artist = t.subtitle || (Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(', ') : 'Various Artists');
    return {
      id: trackId,
      title: t.title || 'Unknown Track',
      artist: cleanArtistName(artist),
      thumb: coverUrl,
      type: 'song' as const,
    };
  });

  if (tracks.length === 0) {
    throw new Error('No tracks found in this Spotify playlist.');
  }

  return {
    id: 'pl_' + Date.now(),
    name,
    tracks,
    source: 'Spotify',
    thumb: coverUrl,
  };
}

export async function importPlaylistFromYoutube(urlOrId: string): Promise<CustomPlaylist> {
  const listId = extractYtmPlaylistId(urlOrId) || urlOrId.trim();
  if (!listId) throw new Error('Please provide a valid YouTube / YouTube Music playlist link or ID.');

  if (/^RD/i.test(listId) && !/^RDCLAK/i.test(listId)) {
    throw new Error("That's a radio/mix link, not a playlist. Open the actual playlist page and copy that link instead.");
  }

  // Tier 1: Try Cloudflare Worker backend
  try {
    const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/playlist-import-proxy?id=${encodeURIComponent(listId)}`, 12000);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        const tracks: Track[] = data.items.map((t: any) => ({
          id: t.id,
          title: t.title || 'Unknown Title',
          artist: t.artist || 'Various Artists',
          thumb: t.thumb || canonicalThumbUrl(t.id),
          type: 'song',
        }));
        return {
          id: 'pl_' + Date.now(),
          name: data.title || 'Imported playlist',
          tracks,
          source: 'YouTube Music',
          thumb: tracks[0]?.thumb || null,
        };
      }
    }
  } catch {}

  // Tier 2: Try Invidious & Piped mirrors directly (CORS friendly!)
  for (const mirror of INVIDIOUS_PLAYLIST_MIRRORS) {
    try {
      const res = await fetchWithTimeout(`${mirror}${encodeURIComponent(listId)}`, 6000);
      if (res.ok) {
        const data = await res.json();
        const rawVideos = data.videos || data.relatedStreams || data.items || [];
        if (Array.isArray(rawVideos) && rawVideos.length > 0) {
          const tracks: Track[] = rawVideos
            .filter((v: any) => v.videoId || v.id)
            .map((v: any) => {
              const vid = v.videoId || v.id;
              const title = v.title || 'Unknown Title';
              const artist = v.author || v.uploaderName || v.uploader || 'Various Artists';
              const thumb = v.videoThumbnails?.[0]?.url || canonicalThumbUrl(vid);
              return {
                id: vid,
                title,
                artist: cleanArtistName(artist),
                thumb,
                type: 'song',
              };
            });
          if (tracks.length > 0) {
            return {
              id: 'pl_' + Date.now(),
              name: data.title || data.name || 'Imported playlist',
              tracks,
              source: 'YouTube Music',
              thumb: tracks[0]?.thumb || null,
            };
          }
        }
      }
    } catch {}
  }

  throw new Error("Couldn't import this playlist. Make sure it is public (not unlisted/private) and contains tracks.");
}

export async function resolveSingleSongLink(link: string): Promise<Track> {
  const idMatch = link.match(/(?:v=|\/watch\?v=|youtu\.be\/|\/shorts\/)([\w-]{11})/) || link.match(/^([\w-]{11})$/);
  const videoId = idMatch ? idMatch[1] : null;
  if (!videoId) {
    throw new Error("That doesn't look like a valid YouTube / YouTube Music song link.");
  }

  try {
    const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/resolve-video-proxy?url=${encodeURIComponent(link)}`, 6000);
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        return {
          id: data.id,
          title: data.title,
          artist: data.artist,
          thumb: data.thumb,
          type: 'song',
        };
      }
    }
  } catch {}

  // Fallback via Invidious video info
  for (const mirror of ['https://yt.omada.cafe/api/v1/videos/', 'https://invidious.kemonomimi.nl/api/v1/videos/']) {
    try {
      const res = await fetchWithTimeout(`${mirror}${videoId}`, 4000);
      if (res.ok) {
        const data = await res.json();
        return {
          id: videoId,
          title: data.title || 'Unknown Title',
          artist: cleanArtistName(data.author || 'Various Artists'),
          thumb: canonicalThumbUrl(videoId),
          type: 'song',
        };
      }
    } catch {}
  }

  return {
    id: videoId,
    title: 'YouTube Track',
    artist: 'YouTube',
    thumb: canonicalThumbUrl(videoId),
    type: 'song',
  };
}

// Lyrics API with memory cache
const lyricsCache = new Map<string, LyricsData>();

export async function fetchLyricsForTrack(track: Track, duration?: number): Promise<LyricsData> {
  const cleanTitleStr = cleanTitleForLyrics(track.title) || track.title;
  const cleanArtistStr = deriveArtistForLyrics(track.title, track.artist);
  const key = `${cleanTitleStr}|${cleanArtistStr}`.toLowerCase();

  if (lyricsCache.has(key)) {
    return lyricsCache.get(key)!;
  }

  const durationParam = duration && isFinite(duration) ? `&duration=${Math.round(duration)}` : '';
  const plainArtist = cleanArtistName(track.artist);
  const artist2Param = plainArtist.toLowerCase() !== cleanArtistStr.toLowerCase() ? `&artist2=${encodeURIComponent(plainArtist)}` : '';

  try {
    const res = await fetchWithTimeout(
      `${NEW_HUB_BACKEND}/api/lyrics-proxy?title=${encodeURIComponent(cleanTitleStr)}&artist=${encodeURIComponent(cleanArtistStr)}${durationParam}${artist2Param}`,
      9000
    );
    if (res.ok) {
      const data = await res.json();
      if (data.found && data.synced) {
        const parsed = parseLRC(data.synced);
        if (parsed.length > 0) {
          const result: LyricsData = { mode: 'synced', lines: parsed, source: data.source || 'LRCLIB' };
          lyricsCache.set(key, result);
          return result;
        }
      }
      if (data.found && data.plain) {
        const result: LyricsData = { mode: 'plain', lines: data.plain, source: data.source || 'Plain Text' };
        lyricsCache.set(key, result);
        return result;
      }
    }
  } catch {}

  // Direct LRCLIB fallback if worker fails
  try {
    const lrcRes = await fetchWithTimeout(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitleStr)}&artist_name=${encodeURIComponent(cleanArtistStr)}${durationParam}`,
      4000
    );
    if (lrcRes.ok) {
      const data = await lrcRes.json();
      if (data.syncedLyrics) {
        const parsed = parseLRC(data.syncedLyrics);
        if (parsed.length > 0) {
          const result: LyricsData = { mode: 'synced', lines: parsed, source: 'LRCLIB' };
          lyricsCache.set(key, result);
          return result;
        }
      }
      if (data.plainLyrics) {
        const result: LyricsData = { mode: 'plain', lines: data.plainLyrics, source: 'LRCLIB' };
        lyricsCache.set(key, result);
        return result;
      }
    }
  } catch {}

  const noneResult: LyricsData = { mode: 'none' };
  lyricsCache.set(key, noneResult);
  return noneResult;
}

// In-memory search & suggestion caching for instant responses
const searchCache = new Map<string, Track[]>();
const suggestionsCache = new Map<string, string[]>();

export async function searchTracks(keyword: string, filter = 'all'): Promise<Track[]> {
  const cacheKey = `${keyword}|${filter}`.toLowerCase();
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  const apiFilter = filter === 'artist' ? 'artists' : filter;
  const res = await fetchWithTimeout(
    `${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(keyword)}&f=${apiFilter}`,
    6500
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  let items = Array.isArray(data) ? data : data.items || data.contents || [];

  if (filter === 'playlist') {
    items = items.filter(
      (t: any) =>
        t.type === 'playlist' ||
        t.resultType === 'playlist' ||
        String(t.id || t.playlistId || '').startsWith('PL') ||
        String(t.id || t.playlistId || '').startsWith('RD')
    );
  } else if (filter === 'song') {
    items = items.filter((t: any) => (t.type || t.resultType || 'song') === 'song' || t.type === 'video' || t.videoId);
  }

  const tracks: Track[] = items
    .filter((it: any) => it.type !== 'channel' && it.resultType !== 'artist')
    .map((it: any) => normalizeTrack(it));

  searchCache.set(cacheKey, tracks);
  return tracks;
}

export async function getSearchSuggestions(query: string): Promise<string[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (suggestionsCache.has(q)) {
    return suggestionsCache.get(q)!;
  }
  try {
    const res = await fetchWithTimeout(
      `${NEW_HUB_BACKEND}/api/suggestions-proxy?q=${encodeURIComponent(query)}`,
      2500
    );
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        const top = list.slice(0, 7);
        suggestionsCache.set(q, top);
        return top;
      }
    }
  } catch {}
  return [];
}

// ---------------------------------------------------------------------------
// Real Global Trending Tracks & Verification
// ---------------------------------------------------------------------------
let trendingTracksCache: Track[] | null = null;
let trendingCacheTime = 0;

export async function fetchTrendingTracks(forceRefresh = false): Promise<Track[]> {
  const now = Date.now();
  if (!forceRefresh && trendingTracksCache && now - trendingCacheTime < 30 * 60 * 1000) {
    return trendingTracksCache;
  }

  // Tier 1: YouTube Official Top 50 Global chart playlist
  try {
    const res = await fetchWithTimeout(
      `${NEW_HUB_BACKEND}/api/playlist-import-proxy?id=PLgzTt0k8mXzEk586ze4BjvDXR7c-TUSnx`,
      8000
    );
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.items) && data.items.length >= 10) {
        const tracks: Track[] = data.items.map((it: any) => ({
          id: it.id,
          title: cleanTitle(it.title),
          artist: cleanArtistName(it.artist),
          thumb: it.thumb || canonicalThumbUrl(it.id),
          type: 'song' as const,
        }));
        trendingTracksCache = tracks;
        trendingCacheTime = now;
        return tracks;
      }
    }
  } catch {}

  // Tier 2: Real Verified Billboard & Global Viral Songs
  const CURATED_TRENDING_QUERIES = [
    'Lady Gaga Bruno Mars Die With A Smile',
    'Billie Eilish Birds of a Feather',
    'Sabrina Carpenter Espresso',
    'Sabrina Carpenter Taste',
    'Chappell Roan Good Luck Babe',
    'Kendrick Lamar Not Like Us',
    'Benson Boone Beautiful Things',
    'Teddy Swims Lose Control',
    'Shaboozey A Bar Song Tipsy',
    'Post Malone Morgan Wallen I Had Some Help',
    'Rose Bruno Mars APT',
    'The Weeknd Playboi Carti Timeless',
    'Tommy Richman MILLION DOLLAR BABY',
    'FloyyMenor Cris Mj Gata Only',
  ];

  try {
    const promises = CURATED_TRENDING_QUERIES.slice(0, 10).map((q) =>
      searchTracks(q, 'song').catch(() => [])
    );
    const results = await Promise.all(promises);
    const pooled: Track[] = [];
    const seen = new Set<string>();

    for (const r of results) {
      if (r && r.length > 0) {
        const top = r[0];
        if (top && !seen.has(top.id)) {
          seen.add(top.id);
          pooled.push(top);
        }
      }
    }

    if (pooled.length >= 6) {
      trendingTracksCache = pooled;
      trendingCacheTime = now;
      return pooled;
    }
  } catch {}

  return trendingTracksCache || [];
}

// ---------------------------------------------------------------------------
// Authentic Track-to-Track Recommendations via Invidious / YouTube Radio
// ---------------------------------------------------------------------------
const relatedCache = new Map<string, Track[]>();

export async function getRelatedTracks(seedTrackId: string): Promise<Track[]> {
  if (!seedTrackId || seedTrackId.length < 5) return [];
  if (relatedCache.has(seedTrackId)) {
    return relatedCache.get(seedTrackId)!;
  }

  const candidateMirrors = [
    'https://yt.omada.cafe/api/v1/videos/',
    'https://invidious.schenkel.eti.br/api/v1/videos/',
    'https://invidious.kemonomimi.nl/api/v1/videos/',
  ];

  for (const mirror of candidateMirrors) {
    try {
      const res = await fetchWithTimeout(`${mirror}${encodeURIComponent(seedTrackId)}`, 4500);
      if (res.ok) {
        const data = await res.json();
        const recommended = data?.recommendedVideos;
        if (Array.isArray(recommended) && recommended.length > 0) {
          const list: Track[] = recommended
            .filter((v: any) => {
              if (!v.videoId || !v.title) return false;
              const tLower = v.title.toLowerCase();
              const aLower = (v.author || '').toLowerCase();
              // Filter out noise: type beats, reaction, tutorial, or title matching artist name
              if (tLower === aLower) return false;
              if (tLower.includes('type beat') || tLower.includes('instrumental') || tLower.includes('reaction')) return false;
              return true;
            })
            .map((v: any) => ({
              id: v.videoId,
              title: cleanTitle(v.title),
              artist: cleanArtistName(v.author || 'Various Artists'),
              thumb: v.videoThumbnails?.[0]?.url || canonicalThumbUrl(v.videoId),
              type: 'song' as const,
            }));

          if (list.length > 0) {
            relatedCache.set(seedTrackId, list);
            return list;
          }
        }
      }
    } catch {}
  }

  return [];
}

// ---------------------------------------------------------------------------
// Robust Taste-Profile Recommendation Engine (No artist-name-in-song-title bugs!)
// ---------------------------------------------------------------------------
export async function getTasteProfileRecommendations(
  userProfile: any,
  excludeIds: Set<string> = new Set(),
  limit = 12
): Promise<Track[]> {
  try {
    const explicitInterested = getExplicitInterestedTracks();
    const explicitDislikedIds = new Set(getExplicitNotInterestedTracks().map((t) => t.id));
    const combinedExclude = new Set([...excludeIds, ...explicitDislikedIds]);

    // 1. Collect real seed songs from user profile and explicit music taste
    const songWeights = new Map<string, { track: Track; weight: number }>();

    // Weight from Explicit Interested tracks (highest priority: weight 10)
    explicitInterested.forEach((t: Track) => {
      if (!t.id || combinedExclude.has(t.id)) return;
      const prev = songWeights.get(t.id)?.weight || 0;
      songWeights.set(t.id, { track: t, weight: prev + 10 });
    });

    // Weight from Liked Songs (priority: weight 5)
    (userProfile?.likedSongs || []).forEach((t: Track) => {
      if (!t.id || combinedExclude.has(t.id)) return;
      const prev = songWeights.get(t.id)?.weight || 0;
      songWeights.set(t.id, { track: t, weight: prev + 5 });
    });

    // Weight from Recently Played (recency priority: weight 3)
    (userProfile?.recentlyPlayed || []).forEach((t: Track, idx: number) => {
      if (!t.id || combinedExclude.has(t.id)) return;
      const recencyBonus = Math.max(1, 5 - Math.floor(idx / 3));
      const prev = songWeights.get(t.id)?.weight || 0;
      songWeights.set(t.id, { track: t, weight: prev + recencyBonus });
    });

    // Weight from Custom Playlists (weight 2)
    (userProfile?.customPlaylists || []).forEach((pl: any) => {
      (pl.tracks || []).forEach((t: Track) => {
        if (!t.id || combinedExclude.has(t.id)) return;
        const prev = songWeights.get(t.id)?.weight || 0;
        songWeights.set(t.id, { track: t, weight: prev + 2 });
      });
    });

    const rankedSeeds = Array.from(songWeights.values())
      .sort((a, b) => b.weight - a.weight)
      .map((item) => item.track);

    // If user has history, use YouTube recommendation algorithm for top 3 diverse seeds
    if (rankedSeeds.length > 0) {
      // Pick 2-3 diverse seed songs (different artists)
      const pickedSeeds: Track[] = [];
      const seenSeedArtists = new Set<string>();
      for (const t of rankedSeeds) {
        const art = (t.artist || '').toLowerCase().trim();
        if (!seenSeedArtists.has(art)) {
          seenSeedArtists.add(art);
          pickedSeeds.push(t);
          if (pickedSeeds.length >= 3) break;
        }
      }

      // Fetch related tracks for picked seed tracks
      const relatedPromises = pickedSeeds.map((s) => getRelatedTracks(s.id));
      const relatedResults = await Promise.all(relatedPromises);

      const candidateTracks: Track[] = [];
      const seenIds = new Set<string>(combinedExclude);
      const artistCounts = new Map<string, number>();

      relatedResults.forEach((tracks) => {
        tracks.forEach((t) => {
          if (!t.id || seenIds.has(t.id) || explicitDislikedIds.has(t.id)) return;
          const artKey = (t.artist || '').toLowerCase().trim();
          const titleKey = (t.title || '').toLowerCase().trim();

          // Reject if title is identical to artist
          if (artKey === titleKey) return;
          if (titleKey.includes('type beat') || titleKey.includes('instrumental')) return;

          // Diversity: max 1 song per artist in recommendations
          const count = artistCounts.get(artKey) || 0;
          if (count < 1) {
            seenIds.add(t.id);
            artistCounts.set(artKey, count + 1);
            candidateTracks.push(t);
          }
        });
      });

      // Prioritize candidate tracks matching explicit interested artists
      const interestedArtists = new Set(explicitInterested.map((t) => (t.artist || '').toLowerCase().trim()));
      candidateTracks.sort((a, b) => {
        const aBoost = (interestedArtists.has((a.artist || '').toLowerCase().trim()) ? 5 : 0) +
                       (explicitInterested.some((it) => it.id === a.id) ? 10 : 0);
        const bBoost = (interestedArtists.has((b.artist || '').toLowerCase().trim()) ? 5 : 0) +
                       (explicitInterested.some((it) => it.id === b.id) ? 10 : 0);
        return bBoost - aBoost;
      });

      if (candidateTracks.length >= limit) {
        return candidateTracks.slice(0, limit);
      }

      // If needed, top off with trending tracks (excluding already seen)
      const trending = await fetchTrendingTracks();
      trending.forEach((t) => {
        if (candidateTracks.length >= limit) return;
        if (!t.id || seenIds.has(t.id)) return;
        const artKey = (t.artist || '').toLowerCase().trim();
        const count = artistCounts.get(artKey) || 0;
        if (count < 1) {
          seenIds.add(t.id);
          artistCounts.set(artKey, count + 1);
          candidateTracks.push(t);
        }
      });

      if (candidateTracks.length > 0) {
        return candidateTracks.slice(0, limit);
      }
    }

    // Default cold-start: return top trending verified tracks
    const fallbackTrending = await fetchTrendingTracks();
    return fallbackTrending.filter((t) => !excludeIds.has(t.id)).slice(0, limit);
  } catch {
    return [];
  }
}
