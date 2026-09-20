import { CustomPlaylist, LyricsData, SyncedLyricsLine, Track } from '../types';

export const NEW_HUB_BACKEND = 'https://new-music-space-api.urshabib.workers.dev';

export const STREAM_MIRRORS = [
  `${NEW_HUB_BACKEND}/api/stream-proxy/`,
  'https://yt.omada.cafe/api/v1/videos/',
  'https://invidious.schenkel.eti.br/api/v1/videos/',
  'https://invidious.kemonomimi.nl/api/v1/videos/',
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
  if (typeof item === 'string') return item.replace(' - Topic', '').trim();
  let runs = item.artists || item.author || item.artist;
  if (!runs) return 'Various Artists';
  if (typeof runs === 'string') return runs.replace(' - Topic', '').trim();
  if (Array.isArray(runs)) {
    return runs
      .map((a) => (typeof a === 'string' ? a : a.name || a.text || ''))
      .join(', ')
      .replace(' - Topic', '')
      .trim();
  }
  if (runs.runs && Array.isArray(runs.runs)) {
    return runs.runs.map((r: any) => r.text).join(', ').replace(' - Topic', '').trim();
  }
  if (runs.name) return runs.name.replace(' - Topic', '').trim();
  return 'Various Artists';
}

export function getTrackThumbnail(item: any): string {
  if (!item) return FALLBACK_ART;
  if (typeof item === 'string' && (item.startsWith('http') || item.includes('googleusercontent') || item.includes('ytimg'))) {
    return item;
  }
  if (item.img && typeof item.img === 'string') {
    if (item.img.startsWith('http')) return item.img;
    if (item.img.startsWith('/')) return `https://wsrv.nl/?url=https://yt3.googleusercontent.com${item.img}`;
    return `https://wsrv.nl/?url=https://i.ytimg.com/vi_webp/${item.img}/default.webp`;
  }
  if (item.thumbnails && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
    return item.thumbnails[item.thumbnails.length - 1].url || item.thumbnails[0].url;
  }
  if (item.thumbnail && typeof item.thumbnail === 'string') return item.thumbnail;
  const targetId = item.id || item.playlistId || item.videoId || item.browseId;
  if (typeof targetId === 'string' && targetId.length > 0) {
    if (targetId.startsWith('/')) return `https://wsrv.nl/?url=https://yt3.googleusercontent.com${targetId}`;
    if (targetId.startsWith('PL') || targetId.startsWith('OL') || targetId.startsWith('RD')) return PLAYLIST_ART;
    return `https://wsrv.nl/?url=https://i.ytimg.com/vi_webp/${targetId}/mqdefault.webp`;
  }
  return FALLBACK_ART;
}

export function canonicalThumbUrl(id: string): string {
  return `https://wsrv.nl/?url=https://i.ytimg.com/vi_webp/${id}/mqdefault.webp`;
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
      if (!artist || artist === 'Various Artists' || (baseFirst && left.toLowerCase().includes(baseFirst))) {
        artist = left;
      }
    }
  }
  return (artist || 'Various Artists').replace(/\s*-\s*Topic$/i, '').trim();
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

  add(title, artist);
  if (rawTitle) {
    try {
      add(title, deriveArtistForLyrics(rawTitle, rawArtist ?? artist));
    } catch {}
  }
  add(title, (artist || '').split(',')[0].trim());
  if (rawTitle && rawTitle !== title) add(cleanTitleForLyrics(rawTitle) || title, artist);
  if (rawArtist && rawArtist !== artist) add(title, cleanArtistName(rawArtist));

  const looksLikeSaavnId = (txt: string) =>
    txt &&
    txt.length >= 6 &&
    txt.length <= 80 &&
    !/\s/.test(txt) &&
    !/error|not[\s_-]?found|missing|parameter|invalid|no\s*results?/i.test(txt);

  let lastErr = new Error('saavn miss');
  for (let i = 0; i < attempts.length; i++) {
    const [t, a] = attempts[i];
    try {
      const res = await fetchWithTimeout(
        `https://fast-saavn.vercel.app/api?title=${encodeURIComponent(t)}&artist=${encodeURIComponent(a)}`,
        i === 0 ? 6000 : 3500
      );
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const txt = (await res.text()).trim();
      if (looksLikeSaavnId(txt)) {
        return `https://aac.saavncdn.com/${txt}_${quality}.mp4`;
      }
      lastErr = new Error('saavn miss: ' + txt.slice(0, 80));
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr;
}

export async function resolveMirrorStreams(id: string): Promise<string[]> {
  const settled = await Promise.allSettled(
    STREAM_MIRRORS.map((base) =>
      fetchWithTimeout(base + id, 6000).then(async (r) => {
        if (!r.ok) throw new Error('bad');
        const j = await r.json();
        if (!j || !j.adaptiveFormats) throw new Error('no formats');
        const audio = j.adaptiveFormats.filter((f: any) => f.type && f.type.startsWith('audio'));
        if (!audio.length) throw new Error('no audio');
        audio.sort((a: any, b: any) => parseInt(b.bitrate) - parseInt(a.bitrate));

        let streamUrl = audio[0].url;
        const isOwnBackend = base.startsWith(NEW_HUB_BACKEND);
        try {
          if (!isOwnBackend) {
            const mirrorUrl = new URL(base);
            const parsedStream = new URL(streamUrl);
            if (parsedStream.hostname.includes('googlevideo.com')) {
              streamUrl = mirrorUrl.origin + parsedStream.pathname + parsedStream.search;
            }
          }
        } catch {}
        return streamUrl;
      })
    )
  );
  return settled.filter((r) => r.status === 'fulfilled').map((r: any) => r.value);
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

  try {
    const mirrors = await resolveMirrorStreams(track.id);
    if (mirrors.length > 0) {
      cacheStreamUrl(track.id, mirrors[0]);
      return mirrors[0];
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
