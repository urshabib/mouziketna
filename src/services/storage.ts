import { DownloadRecord, Track, UserProfile } from '../types';

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

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

// Device settings storage
const DEVICE_SETTINGS_KEY = 'mouzika_device_settings';

export function saveDeviceSettings(profile: Partial<UserProfile>) {
  try {
    localStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify({
      dataSaver: !!profile.dataSaver,
      dataSaverLevel: profile.dataSaverLevel || 'off',
      downloadLyricsOffline: !!profile.downloadLyricsOffline,
      autoCachePlayed: profile.autoCachePlayed !== false,
      liquidGlass: !!profile.liquidGlass,
      theme: profile.theme === 'light' ? 'light' : 'dark',
      accentColor: profile.accentColor || 'orange',
      lyricsColor: profile.lyricsColor || 'white',
      presetTint: profile.presetTint || 'none',
      activePreset: profile.activePreset || null,
    }));
  } catch {}
}

export function loadDeviceSettings(): Partial<UserProfile> | null {
  try {
    const raw = localStorage.getItem(DEVICE_SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function cacheProfileLocally(username: string, profile: UserProfile) {
  if (!username || username === 'admin') return;
  try {
    localStorage.setItem('mouzika_profile_cache_' + username, JSON.stringify(profile));
  } catch {}
}

export function restoreProfileFromCache(username: string): Partial<UserProfile> | null {
  if (!username || username === 'admin') return null;
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

export function tasteEvent(kind: 'play' | 'complete' | 'like' | 'skip' | 'unlike', track: Track) {
  if (!track || !track.title) return;
  const weights = { play: 1, complete: 2, like: 3, skip: -2, unlike: -3 };
  const w = weights[kind];
  if (!w) return;
  const t = loadTasteProfile();
  const aKey = tasteArtistKey(track.artist);
  if (aKey && aKey !== 'various artists') {
    t.artists[aKey] = Math.max(-12, Math.min(30, (t.artists[aKey] || 0) + w));
  }
  if (track.id) {
    t.tracks[track.id] = Math.max(-6, Math.min(12, (t.tracks[track.id] || 0) + w));
  }
  saveTasteProfile(t);
}

export function rememberListen(track: Track) {
  tasteEvent('play', track);
}

export function tasteArtistScore(artist: string): number {
  const t = loadTasteProfile();
  return t.artists[tasteArtistKey(artist)] || 0;
}

export function tasteSkippedArtists(): Set<string> {
  const t = loadTasteProfile();
  return new Set(Object.keys(t.artists).filter((a) => t.artists[a] <= -3));
}

export function tasteTopSeeds(likedSongs: Track[] = [], n = 3, excludeId: string | null = null): Track[] {
  let hist: Track[] = [];
  try {
    hist = JSON.parse(localStorage.getItem('taste_profile_history') || '[]');
  } catch {}
  const pool = [...likedSongs, ...hist].filter((t) => t && t.id && t.title && t.id !== excludeId);
  const skipped = tasteSkippedArtists();
  const scored = pool
    .map((t) => ({
      t,
      score:
        tasteArtistScore(t.artist) +
        (likedSongs.some((s) => s.id === t.id) ? 3 : 0) +
        Math.random() * 2.5,
    }))
    .filter((x) => !skipped.has(tasteArtistKey(x.t.artist)));

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
