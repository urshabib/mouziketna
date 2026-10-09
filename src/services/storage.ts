import { DownloadRecord, LyricsData, Track, UserProfile } from '../types';
import { generateLyricsPlusPlan } from './aiLyricsReel';

const DL_DB_NAME = 'mouzika-downloads';
const DL_DB_VERSION = 1;
const DL_STORE = 'songs';
export const downloadedIds = new Set<string>();
export const downloadedQualityMap = new Map<string, string>();

let dlDbPromise: Promise<IDBDatabase> | null = null;
let persistRequested = false;

export function openDownloadsDB(): Promise<IDBDatabase> {
  if (dlDbPromise) return dlDbPromise;
  dlDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(DL_DB_NAME, DL_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DL_STORE)) {
        db.createObjectStore(DL_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dlDbPromise;
}

async function dlTx(mode: IDBTransactionMode) {
  const db = await openDownloadsDB();
  return db.transaction(DL_STORE, mode).objectStore(DL_STORE);
}

export function isDownloaded(id: string | undefined | null): boolean {
  return !!id && downloadedIds.has(id);
}

export function getDownloadQuality(id: string | undefined | null): string | undefined {
  return id ? downloadedQualityMap.get(id) : undefined;
}

export async function initDownloadsRegistry(): Promise<void> {
  try {
    const store = await dlTx('readonly');
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => {
        downloadedIds.clear();
        downloadedQualityMap.clear();
        const records = (req.result || []) as DownloadRecord[];
        records.forEach((rec) => {
          if (rec.id) {
            downloadedIds.add(rec.id);
            downloadedQualityMap.set(rec.id, rec.quality || '320');
            if (rec.thumbLowRes && !offlineThumbCache.has(rec.id)) {
              try {
                offlineThumbCache.set(rec.id, URL.createObjectURL(rec.thumbLowRes));
              } catch {}
            }
          }
        });
        resolve();
      };
      req.onerror = () => resolve();
    });
  } catch {
    return Promise.resolve();
  }
}

export const downloadsRegistryReady = initDownloadsRegistry();

export async function ensurePersistentStorageOnce(): Promise<void> {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (navigator.storage?.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        await navigator.storage.persist();
      }
    }
  } catch {}
}

const offlineThumbCache = new Map<string, string | null>();

export function getOfflineThumbUrlSync(id: string): string | null {
  if (!id) return null;
  return offlineThumbCache.get(id) || null;
}

/**
 * Synchronously retrieves any known stored non-blob cover image URL for a given track id.
 * Checks:
 * 1. Synchronous offline thumbnail cache
 * 2. Active user's profile cache (recentlyPlayed, likedSongs, customPlaylists)
 * 3. All other cached profiles in localStorage
 */
export function getStoredCoverForTrack(id: string): string | null {
  if (!id) return null;
  const offThumb = offlineThumbCache.get(id);
  if (offThumb) return offThumb;

  try {
    // 1. Check last played track in localStorage
    const lastPlayedRaw = localStorage.getItem('mouzika_last_played_track');
    if (lastPlayedRaw) {
      try {
        const lastPlayed = JSON.parse(lastPlayedRaw);
        if (
          lastPlayed &&
          lastPlayed.id === id &&
          lastPlayed.thumb &&
          !lastPlayed.thumb.startsWith('blob:') &&
          lastPlayed.thumb.trim().length > 5
        ) {
          return lastPlayed.thumb;
        }
      } catch {}
    }

    const activeUser = localStorage.getItem('hub_active_user');
    const userKeys = activeUser ? ['mouzika_profile_cache_' + activeUser] : [];

    // Also scan any other profile cache keys in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mouzika_profile_cache_') && !userKeys.includes(key)) {
        userKeys.push(key);
      }
    }

    for (const key of userKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed) continue;

      // Check recentlyPlayed first (most recent track data)
      if (Array.isArray(parsed.recentlyPlayed)) {
        const found = parsed.recentlyPlayed.find((t: any) => t && t.id === id);
        if (found?.thumb && !found.thumb.startsWith('blob:') && found.thumb.length > 5) {
          return found.thumb;
        }
      }

      // Check likedSongs
      if (Array.isArray(parsed.likedSongs)) {
        const found = parsed.likedSongs.find((t: any) => t && t.id === id);
        if (found?.thumb && !found.thumb.startsWith('blob:') && found.thumb.length > 5) {
          return found.thumb;
        }
      }

      // Check customPlaylists
      if (Array.isArray(parsed.customPlaylists)) {
        for (const pl of parsed.customPlaylists) {
          if (Array.isArray(pl.tracks)) {
            const found = pl.tracks.find((t: any) => t && t.id === id);
            if (found?.thumb && !found.thumb.startsWith('blob:') && found.thumb.length > 5) {
              return found.thumb;
            }
          }
        }
      }
    }

    // Direct YouTube CDN fallback for any 11-char track ID
    if (id.length === 11) {
      return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  } catch {}

  return null;
}

export async function getOfflineThumbUrl(id: string): Promise<string | null> {
  if (!id) return null;
  if (offlineThumbCache.has(id)) return offlineThumbCache.get(id) || null;
  let url: string | null = null;
  try {
    const record = await getDownload(id);
    if (record?.thumbLowRes) {
      url = URL.createObjectURL(record.thumbLowRes);
    }
  } catch {}
  offlineThumbCache.set(id, url);
  return url;
}

export function invalidateOfflineThumbCache(id?: string) {
  if (id) {
    const prev = offlineThumbCache.get(id);
    if (prev) {
      try { URL.revokeObjectURL(prev); } catch {}
    }
    offlineThumbCache.delete(id);
  } else {
    offlineThumbCache.forEach((u) => {
      if (u) try { URL.revokeObjectURL(u); } catch {}
    });
    offlineThumbCache.clear();
  }
}

export async function saveDownload(record: DownloadRecord): Promise<DownloadRecord> {
  const store = await dlTx('readwrite');
  await new Promise((res, rej) => {
    const r = store.put(record);
    r.onsuccess = res;
    r.onerror = () => rej(r.error);
  });
  downloadedIds.add(record.id);
  downloadedQualityMap.set(record.id, record.quality || '320');
  invalidateOfflineThumbCache(record.id);
  return record;
}

export async function getDownload(id: string): Promise<DownloadRecord | null> {
  const store = await dlTx('readonly');
  return new Promise((resolve, reject) => {
    const r = store.get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

export async function deleteDownload(id: string): Promise<void> {
  const store = await dlTx('readwrite');
  await new Promise((res, rej) => {
    const r = store.delete(id);
    r.onsuccess = res;
    r.onerror = () => rej(r.error);
  });
  downloadedIds.delete(id);
  downloadedQualityMap.delete(id);
  invalidateOfflineThumbCache(id);
}

export async function deleteAllDownloads(): Promise<void> {
  const store = await dlTx('readwrite');
  await new Promise((res, rej) => {
    const r = store.clear();
    r.onsuccess = res;
    r.onerror = () => rej(r.error);
  });
  downloadedIds.clear();
  downloadedQualityMap.clear();
  invalidateOfflineThumbCache();
}

export async function listDownloads(): Promise<DownloadRecord[]> {
  try {
    const store = await dlTx('readonly');
    return new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(((r.result || []) as DownloadRecord[]).sort((a, b) => b.downloadedAt - a.downloadedAt));
      r.onerror = () => reject(r.error);
    });
  } catch {
    return [];
  }
}

export async function getTotalDownloadedSize(): Promise<number> {
  const all = await listDownloads();
  return all.reduce((sum, d) => sum + (d.sizeBytes || 0), 0);
}

export async function getDownloadedLyrics(id: string): Promise<LyricsData | null> {
  if (!id) return null;
  try {
    const record = await getDownload(id);
    if (record && record.lyricsData && record.lyricsData.mode && record.lyricsData.mode !== 'none') {
      return record.lyricsData;
    }
  } catch {}
  return null;
}

export async function saveDownloadLyrics(id: string, lyrics: LyricsData): Promise<void> {
  if (!id || !lyrics || lyrics.mode === 'none' || lyrics.mode === 'loading' || lyrics.mode === 'error') return;
  try {
    const record = await getDownload(id);
    if (record) {
      record.lyricsData = lyrics;
      await saveDownload(record);
    }
    // Also pre-generate and cache the animated Lyrics+ plan for 100% offline availability
    if (lyrics.mode === 'synced' && Array.isArray(lyrics.lines)) {
      try {
        generateLyricsPlusPlan(id, lyrics.lines);
      } catch {}
    }
  } catch {}
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

// Device settings storage
const DEVICE_SETTINGS_KEY = 'mouzika_device_settings';
const PROGRESS_BAR_STYLE_KEY = 'mouzika_progress_bar_style';

export function saveProgressBarStyle(style: string) {
  if (!style) return;
  try {
    localStorage.setItem(PROGRESS_BAR_STYLE_KEY, style);
  } catch {}
}

export function loadProgressBarStyle(): string | null {
  try {
    return localStorage.getItem(PROGRESS_BAR_STYLE_KEY);
  } catch {
    return null;
  }
}

export function saveDeviceSettings(profile: Partial<UserProfile>) {
  try {
    const style = profile.progressBarStyle || loadProgressBarStyle() || 'default';
    if (profile.progressBarStyle) {
      saveProgressBarStyle(profile.progressBarStyle);
    }
    localStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify({
      dataSaver: !!profile.dataSaver,
      dataSaverLevel: profile.dataSaverLevel || 'off',
      downloadQuality: profile.downloadQuality || 'stable',
      downloadArtOffline: profile.downloadArtOffline !== false,
      artQualityOffline: profile.artQualityOffline || 'low',
      customAppName: profile.customAppName || undefined,
      appLogo: profile.appLogo || 'default',
      downloadLyricsOffline: profile.downloadLyricsOffline !== false,
      autoCachePlayed: !!profile.autoCachePlayed,
      autoCacheQuality: profile.autoCacheQuality || 'stable',
      liquidGlass: profile.liquidGlass !== undefined ? !!profile.liquidGlass : true,
      liquidGlassLevel: profile.liquidGlassLevel || 'medium',
      language: profile.language || 'en',
      theme: profile.theme === 'light' ? 'light' : 'dark',
      accentColor: profile.accentColor || 'orange',
      customAccentHex: profile.customAccentHex || undefined,
      lyricsColor: profile.lyricsColor || 'white',
      customLyricsHex: profile.customLyricsHex || undefined,
      lyricsFont: profile.lyricsFont || undefined,
      lyricsGlow: profile.lyricsGlow || 'default',
      presetTint: profile.presetTint || 'none',
      uiScale: profile.uiScale || 'default',
      activePreset: profile.activePreset || null,
      progressBarStyle: style,
      progressBarColor: profile.progressBarColor || '#ffffff',
      customProgressBarHex: profile.customProgressBarHex || undefined,
      keyPartsDisplay: profile.keyPartsDisplay || 'dots',
      displayName: profile.displayName || undefined,
      avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : undefined,
    }));
  } catch {}
}

export function loadDeviceSettings(): Partial<UserProfile> | null {
  try {
    const raw = localStorage.getItem(DEVICE_SETTINGS_KEY);
    const dedicatedStyle = loadProgressBarStyle();
    if (!raw) {
      return dedicatedStyle ? { progressBarStyle: dedicatedStyle as any } : null;
    }
    const parsed = JSON.parse(raw);
    if (dedicatedStyle && (!parsed.progressBarStyle || parsed.progressBarStyle === 'default')) {
      parsed.progressBarStyle = dedicatedStyle;
    }
    return parsed;
  } catch {
    const dedicatedStyle = loadProgressBarStyle();
    return dedicatedStyle ? { progressBarStyle: dedicatedStyle as any } : null;
  }
}

export function cacheProfileLocally(username: string, profile: UserProfile) {
  if (!username) return;
  try {
    localStorage.setItem('mouzika_profile_cache_' + username, JSON.stringify(profile));
  } catch {}
}

export function restoreProfileFromCache(username: string): Partial<UserProfile> | null {
  if (!username) return null;
  try {
    const cached = localStorage.getItem('mouzika_profile_cache_' + username);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

// Taste profile
const TASTE_KEY = 'taste_profile_v2';
interface TasteProfileData {
  artists: Record<string, number>;
  tracks: Record<string, number>;
}

export function loadTasteProfile(): TasteProfileData {
  try {
    const t = JSON.parse(localStorage.getItem(TASTE_KEY) || 'null');
    if (t && t.artists) return t;
  } catch {}
  return { artists: {}, tracks: {} };
}

export function saveTasteProfile(t: TasteProfileData) {
  try {
    const entries = Object.entries(t.artists);
    if (entries.length > 120) {
      entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      t.artists = Object.fromEntries(entries.slice(0, 120));
    }
    const trackEntries = Object.entries(t.tracks);
    if (trackEntries.length > 200) t.tracks = Object.fromEntries(trackEntries.slice(-200));
    localStorage.setItem(TASTE_KEY, JSON.stringify(t));
  } catch {}
}

export function tasteArtistKey(artist: string | undefined): string {
  if (!artist) return '';
  return artist
    .replace(/\s*-\s*Topic$/i, '')
    .split(',')[0]
    .split(/\bfeat\.?\b|\bft\.?\b/i)[0]
    .trim()
    .toLowerCase();
}

export const EXPLICIT_INTERESTED_KEY = 'mouzika_explicit_interested';
export const EXPLICIT_NOT_INTERESTED_KEY = 'mouzika_explicit_not_interested';

export function tasteEvent(
  kind: 'play' | 'complete' | 'like' | 'skip' | 'unlike' | 'interested' | 'not_interested',
  track: Track
) {
  if (!track || !track.title) return;
  const weights: Record<string, number> = {
    play: 1,
    complete: 2,
    like: 4,
    skip: -2,
    unlike: -4,
    interested: 15,
    not_interested: -25,
  };
  const w = weights[kind];
  if (!w) return;
  const t = loadTasteProfile();
  const aKey = tasteArtistKey(track.artist);
  if (aKey && aKey !== 'various artists') {
    t.artists[aKey] = Math.max(-30, Math.min(45, (t.artists[aKey] || 0) + w));
  }
  if (track.id) {
    t.tracks[track.id] = Math.max(-20, Math.min(30, (t.tracks[track.id] || 0) + w));
  }
  saveTasteProfile(t);
}

export function getExplicitInterestedTracks(): Track[] {
  try {
    const raw = localStorage.getItem(EXPLICIT_INTERESTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getExplicitNotInterestedTracks(): Track[] {
  try {
    const raw = localStorage.getItem(EXPLICIT_NOT_INTERESTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isExplicitInterested(trackId: string): boolean {
  if (!trackId) return false;
  return getExplicitInterestedTracks().some((t) => t.id === trackId);
}

export function isExplicitNotInterested(trackId: string): boolean {
  if (!trackId) return false;
  return getExplicitNotInterestedTracks().some((t) => t.id === trackId);
}

export function addExplicitInterested(track: Track) {
  if (!track || !track.id) return;
  removeExplicitNotInterested(track.id);
  const current = getExplicitInterestedTracks().filter((t) => t.id !== track.id);
  current.unshift(track);
  try {
    localStorage.setItem(EXPLICIT_INTERESTED_KEY, JSON.stringify(current.slice(0, 80)));
  } catch {}
  tasteEvent('interested', track);
}

export function removeExplicitInterested(trackId: string) {
  if (!trackId) return;
  const current = getExplicitInterestedTracks().filter((t) => t.id !== trackId);
  try {
    localStorage.setItem(EXPLICIT_INTERESTED_KEY, JSON.stringify(current));
  } catch {}
}

export function addExplicitNotInterested(track: Track) {
  if (!track || !track.id) return;
  removeExplicitInterested(track.id);
  const current = getExplicitNotInterestedTracks().filter((t) => t.id !== track.id);
  current.unshift(track);
  try {
    localStorage.setItem(EXPLICIT_NOT_INTERESTED_KEY, JSON.stringify(current.slice(0, 100)));
  } catch {}
  tasteEvent('not_interested', track);
}

export function removeExplicitNotInterested(trackId: string) {
  if (!trackId) return;
  const current = getExplicitNotInterestedTracks().filter((t) => t.id !== trackId);
  try {
    localStorage.setItem(EXPLICIT_NOT_INTERESTED_KEY, JSON.stringify(current));
  } catch {}
}

export function rememberListen(track: Track) {
  if (!track || !track.id) return;
  tasteEvent('play', track);
  try {
    const raw = localStorage.getItem('taste_profile_history');
    let hist: Track[] = raw ? JSON.parse(raw) : [];
    hist = [track, ...hist.filter((t) => t.id !== track.id)].slice(0, 30);
    localStorage.setItem('taste_profile_history', JSON.stringify(hist));
  } catch {}
}

export function tasteArtistScore(artist: string): number {
  const t = loadTasteProfile();
  return t.artists[tasteArtistKey(artist)] || 0;
}

export function tasteSkippedArtists(): Set<string> {
  const t = loadTasteProfile();
  return new Set(Object.keys(t.artists).filter((a) => t.artists[a] <= -3));
}

// Multi-factor taste profile system: combines playback history, saved songs, and playlist content
export function tasteTopSeeds(
  likedSongs: Track[] = [],
  n = 4,
  excludeId: string | null = null,
  recentlyPlayed: Track[] = [],
  playlistSongs: Track[] = []
): Track[] {
  let hist: Track[] = [];
  try {
    hist = JSON.parse(localStorage.getItem('taste_profile_history') || '[]');
  } catch {}

  const explicitInterested = getExplicitInterestedTracks();
  const explicitDislikedIds = new Set(getExplicitNotInterestedTracks().map((t) => t.id));

  const combinedRecent = [...recentlyPlayed, ...hist];
  const pool = [...explicitInterested, ...likedSongs, ...combinedRecent, ...playlistSongs].filter(
    (t) => t && t.id && t.title && t.id !== excludeId && !explicitDislikedIds.has(t.id)
  );
  const skipped = tasteSkippedArtists();

  // Multi-factor weighting:
  // - Explicit user interest: +15 points
  // - Recently played: up to +5 points for newest listens
  // - Liked songs: +4 points
  // - Custom playlist tracks: +2 points
  // - Taste profile artist affinity: dynamic score
  const scored = pool
    .map((t) => {
      const isExplicit = explicitInterested.some((e) => e.id === t.id);
      const recentIndex = combinedRecent.findIndex((r) => r.id === t.id);
      const isLiked = likedSongs.some((s) => s.id === t.id);
      const isPlaylist = playlistSongs.some((p) => p.id === t.id);

      const explicitWeight = isExplicit ? 15 : 0;
      const recentWeight = recentIndex >= 0 ? Math.max(0, 5 - recentIndex * 0.25) : 0;
      const likedWeight = isLiked ? 4 : 0;
      const playlistWeight = isPlaylist ? 2 : 0;
      const artistAffinity = tasteArtistScore(t.artist);

      return {
        t,
        score: explicitWeight + artistAffinity + recentWeight + likedWeight + playlistWeight + Math.random() * 1.5,
      };
    })
    .filter((x) => !skipped.has(tasteArtistKey(x.t.artist)) && !explicitDislikedIds.has(x.t.id));

  scored.sort((a, b) => b.score - a.score);
  const out: Track[] = [];
  const seenArtists = new Set<string>();
  for (const { t } of scored) {
    const a = tasteArtistKey(t.artist);
    if (seenArtists.has(a)) continue;
    seenArtists.add(a);
    out.push(t);
    if (out.length >= n) break;
  }
  return out;
}

// Persistent Custom Playlist Cover Storage
const PL_COVER_PREFIX = 'mouzika_pl_cover_';

export function savePersistentPlaylistCover(playlistId: string, base64Data: string) {
  try {
    localStorage.setItem(`${PL_COVER_PREFIX}${playlistId}`, base64Data);
    ensurePersistentStorageOnce();
  } catch {}
}

export function getPersistentPlaylistCover(playlistId: string): string | null {
  try {
    return localStorage.getItem(`${PL_COVER_PREFIX}${playlistId}`);
  } catch {
    return null;
  }
}

export function deletePersistentPlaylistCover(playlistId: string) {
  try {
    localStorage.removeItem(`${PL_COVER_PREFIX}${playlistId}`);
  } catch {}
}
