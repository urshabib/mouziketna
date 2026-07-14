/* =====================================================================
   MusicSpace — rebuilt client
   Sources kept identical to the original:
   - Own Cloudflare Worker proxies (search / suggestions / channel / similar)
   - fast-saavn.vercel.app + aac.saavncdn.com for primary streams
   - Invidious mirrors as stream fallback
   - wsrv.nl / i.ytimg.com for artwork
===================================================================== */
const NEW_HUB_BACKEND = "https://new-music-space-api.urshabib.workers.dev";
const STREAM_MIRRORS = [
    `${NEW_HUB_BACKEND}/api/stream-proxy/`, // free — our own InnerTube resolver, no third-party keys
    "https://yt.omada.cafe/api/v1/videos/",
    "https://invidious.schenkel.eti.br/api/v1/videos/",
    "https://invidious.kemonomimi.nl/api/v1/videos/"
];
const FALLBACK_ART = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300';
const PLAYLIST_ART = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300';

/* ---------- State ---------- */
let globalUser = localStorage.getItem("hub_active_user") || null;
let sessionSynced = false;   // true once executeLogin actually got a profile back from the server
let globalPass = localStorage.getItem("hub_active_pass") || null;
let userProfile = { username: "", likedSongs: [], customPlaylists: [], favouriteArtists: [], favouriteAlbums: [], recentlyPlayed: [], dataSaver: false, dataSaverLevel: 'off', downloadLyricsOffline: false, liquidGlass: true, theme: 'dark', accentColor: 'orange', lyricsColor: 'white', presetTint: 'none', activePreset: 'glass' };

let activeTrackData = null;
let activeBlobUrl = null; // object URL for the currently-playing downloaded track, revoked on track change
let isLoopingActive = false;
let isShuffleActive = false;
let playbackQueue = [];
let currentQueueIndex = -1;
let navigationOriginPane = "home";
let currentSearchQuery = "";
let currentSearchFilter = "all";
let playToken = 0;               // guards against stale stream resolutions
let pendingModalTrack = null;    // track being added to a playlist
let pendingResume = null;        // { track, resumeAt } restored from a previous session, loaded lazily on first Play
// Session-only ordered stack of every track actually played — this is what
// "Previous" walks back through. Separate from playbackQueue because
// algorithm/autoplay chains have no fixed queue, which is exactly the case the
// old Previous button couldn't handle (it just restarted the song).
let playedHistory = [];
let lastVolumeBeforeMute = 50;

let hasPrefetchedNext = false;
let prefetchedNextTrack = null;
let prefetchedQueueTrackId = null; // id of the queued track we've already resolved a stream URL for
let prefetchedQueueUrl = null;     // its resolved stream URL, consumed (and cleared) by initializeTrackStream

const audioEngine = document.getElementById('audio-engine');
const $ = id => document.getElementById(id);

/* ---------- Small utils ---------- */
function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatTime(secs) {
    if (isNaN(secs) || !isFinite(secs)) return "0:00";
    const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
}
function showToast(msg, gray = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (gray ? ' gray' : '');
    t.textContent = msg;
    $('toast-zone').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 2400);
}
function timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
}
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function fetchWithTimeout(url, ms, options = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(t));
}
/* Retry wrapper with exponential backoff — enough attempts to ride out a flaky
   mirror without the multi-second stalls of the old 8x1.5s loop. */
async function fetchJsonRetry(url, tries = 4, delay = 600) {
    let lastErr = null;
    for (let i = 1; i <= tries; i++) {
        try {
            const res = await fetchWithTimeout(url, 9000);
            if (res.ok) {
                const data = await res.json();
                const arr = Array.isArray(data) ? data : (data.items || data.contents || null);
                if ((arr && arr.length > 0) || (!arr && data)) return data;
                lastErr = new Error("Empty payload");
            } else {
                lastErr = new Error("HTTP " + res.status);
            }
        } catch (e) { lastErr = e; }
        if (i < tries) await new Promise(r => setTimeout(r, delay * i)); // 600, 1200, 1800…
    }
    throw lastErr || new Error("Endpoint gave no usable data: " + url);
}

/* ---------- Metadata normalizers (same behavior as before) ---------- */
function cleanTitle(item) {
    if (!item) return "Unknown Title";
    if (typeof item === 'string') return item;
    if (item.title) return item.title;
    if (item.name) return item.name;
    if (item.runs && item.runs.length > 0) return item.runs[0].text;
    return "Unknown Title";
}
function cleanArtistName(item) {
    if (!item) return "Various Artists";
    if (typeof item === 'string') return item.replace(' - Topic', '').trim();
    let runs = item.artists || item.author || item.artist;
    if (!runs) return "Various Artists";
    if (typeof runs === 'string') return runs.replace(' - Topic', '').trim();
    if (Array.isArray(runs)) return runs.map(a => typeof a === 'string' ? a : (a.name || a.text || "")).join(", ").replace(' - Topic', '').trim();
    if (runs.runs && Array.isArray(runs.runs)) return runs.runs.map(r => r.text).join(", ").replace(' - Topic', '').trim();
    if (runs.name) return runs.name.replace(' - Topic', '').trim();
    return "Various Artists";
}
function getTrackThumbnail(item) {
    if (!item) return FALLBACK_ART;
    if (typeof item === 'string' && (item.startsWith('http') || item.includes('googleusercontent') || item.includes('ytimg'))) return item;
    if (item.img && typeof item.img === 'string') {
        if (item.img.startsWith('http')) return item.img;
        if (item.img.startsWith('/')) return `https://wsrv.nl/?url=https://yt3.googleusercontent.com${item.img}`;
        // Bare YouTube video id — this is what ytify's playlist search results give
        // as "img" (see e.g. a playlist result's img:"6vAAGnF3PAw"). Proxy it into
        // an actual thumbnail URL instead of handing the raw id to <img src>.
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
function normalizeTrack(item, forcedType = null) {
    let type = forcedType || item.type || item.resultType || 'song';
    if (type === 'video') type = 'song';
    if (type === 'channel') type = 'artist';
    return {
        id: item.id || item.videoId || item.playlistId || item.browseId,
        title: cleanTitle(item),
        artist: cleanArtistName(item),
        thumb: getTrackThumbnail(item),
        type
    };
}

/* =====================================================================
   TRACK REGISTRY + EVENT DELEGATION
   The old build serialized track JSON into inline onclick attributes.
   Any title containing a quote broke the handler — one reason some
   songs never played. Cards now reference tracks by key.
===================================================================== */
const TRACK_REG = new Map();
let regCounter = 0;
function regTrack(track, meta = {}) {
    const key = 'k' + (++regCounter);
    TRACK_REG.set(key, { track, meta });
    return key;
}

// Small memoized cache of downloaded-track thumbnails as object URLs, built
// lazily the first time a card's live network image actually fails to load
// — most tracks never touch this, so there's no upfront IndexedDB scan.
const offlineThumbCache = new Map(); // id -> objectURL string | null
async function getOfflineThumbUrl(id) {
    if (!id) return null;
    if (offlineThumbCache.has(id)) return offlineThumbCache.get(id);
    let url = null;
    try {
        const record = await getDownload(id);
        if (record?.thumbLowRes) url = URL.createObjectURL(record.thumbLowRes);
    } catch (e) {}
    offlineThumbCache.set(id, url);
    return url;
}
// This cache was never invalidated when a download was added/removed, so a
// lookup that ran once — e.g. before a download finished saving, or before
// it existed at all — kept returning that same stale (often empty) answer
// forever, even after the song was re-downloaded or removed and re-added.
// saveDownload/deleteDownload/deleteAllDownloads all clear the relevant
// entry so the next card that needs it looks it up fresh.
function invalidateOfflineThumbCache(id) {
    if (offlineThumbCache.has(id)) {
        const prev = offlineThumbCache.get(id);
        if (prev) try { URL.revokeObjectURL(prev); } catch (e) {}
        offlineThumbCache.delete(id);
    }
}

// Shared <img onerror> handler for track artwork. The live thumbnail URL can
// go dead — or just be unreachable while offline — even for a song that's
// fully downloaded, because the compressed offline copy lives separately in
// IndexedDB and previously only the dedicated Downloads screen ever checked
// it. This tries that same offline copy first, so a downloaded song's art
// shows up everywhere it's used (home, library, "now playing"…), not just
// in the Downloads list.
//
// If there's no offline copy either (never downloaded, or downloaded without
// artwork), it falls back to the same canonical network thumbnail URL the
// rest of the app already derives from a track's id (see getTrackThumbnail /
// the wsrv.nl+i.ytimg.com pattern) — instead of just giving up. This is what
// was missing before: a stored thumb can go stale (e.g. a dead blob: URL left
// over from a download that's since been deleted) with no path back to a
// working image, which is exactly the "some songs show as a blank icon"
// symptom, most visible on Home's Recently Played since that's the one shelf
// that renders from a STORED thumb value instead of a freshly-fetched one.
async function handleThumbError(imgEl, id, fallbackClass) {
    if (!imgEl || !imgEl.isConnected) return;
    if (!imgEl.dataset.offlineTried) {
        imgEl.dataset.offlineTried = '1';
        if (isDownloaded(id)) {
            const url = await getOfflineThumbUrl(id);
            if (url && imgEl.isConnected) { imgEl.src = url; return; }
        }
    }
    if (!imgEl.dataset.networkTried && id) {
        imgEl.dataset.networkTried = '1';
        imgEl.src = canonicalThumbUrl(id); // one more real attempt before giving up
        return;
    }
    if (imgEl.isConnected) imgEl.outerHTML = `<div class="${fallbackClass}"><i class="ri-music-2-line"></i></div>`;
}
// The same fallback thumbnail URL this app already derives from a track id
// elsewhere (getTrackThumbnail's default, the playlist-import default, etc.)
// — reused here so a repaired thumbnail looks exactly like it would if the
// track had simply been fetched fresh, "like we do for all songs".
function canonicalThumbUrl(id) {
    return `https://wsrv.nl/?url=https://i.ytimg.com/vi_webp/${id}/mqdefault.webp`;
}

function createTrackCardHTML(track, opts = {}) {
    // opts: { collectionId, queueIndex }
    const key = regTrack(track, opts);
    let liked = false;
    if (track.type === 'artist') liked = userProfile.favouriteArtists?.some(a => a.id === track.id);
    else if (track.type === 'playlist') liked = userProfile.favouriteAlbums?.some(a => a.id === track.id);
    else liked = userProfile.likedSongs?.some(s => s.id === track.id);

    const isPlaying = activeTrackData && activeTrackData.id === track.id && track.type === 'song';
    const artClass = track.type === 'artist' ? 'round' : '';
    const art = track.thumb && track.thumb !== PLAYLIST_ART
        ? `<img class="${artClass}" src="${escapeHtml(track.thumb)}" loading="lazy" alt="" onerror="handleThumbError(this, '${escapeHtml(track.id || '')}', 'generic-cover ${artClass}')">`
        : `<div class="generic-cover ${artClass}"><i class="ri-${track.type === 'playlist' ? 'play-list-2' : 'music-2'}-line"></i></div>`;

    const trash = opts.collectionId && String(opts.collectionId).startsWith('pl_')
        ? `<button class="icon-btn trash" data-act="removefrompl" data-key="${key}" title="Remove from playlist"><i class="ri-delete-bin-line"></i></button>`
        : `<span></span>`;

    const downloaded = track.type !== 'artist' && track.type !== 'playlist' && isDownloaded(track.id);
    const dlBtn = track.type !== 'artist' && track.type !== 'playlist'
        ? `<button class="icon-btn dl-toggle ${downloaded ? 'downloaded' : ''}" data-act="download" data-key="${key}" title="${downloaded ? 'Remove download' : 'Download for offline'}">
             <i class="ri-download-2-${downloaded ? 'fill' : 'line'}"></i>
           </button>` : '';

    const playBtn = track.type === 'song'
        ? `<button class="hover-play" data-act="open" data-key="${key}" title="Play"><i class="ri-play-fill"></i></button>` : '';

    return `
    <div class="track-card ${isPlaying ? 'playing' : ''}" data-id="${escapeHtml(track.id || '')}" data-act="open" data-key="${key}">
        <div class="card-art-wrap">
            ${art}
            ${playBtn}
            ${isPlaying ? '<div class="eq-badge"><span></span><span></span><span></span></div>' : ''}
            <div class="card-icons">
                ${trash}
                ${dlBtn}
                <button class="icon-btn ${liked ? 'liked' : ''}" data-act="fav" data-key="${key}" title="Save">
                    <i class="ri-heart-${liked ? 'fill' : 'line'}"></i>
                </button>
            </div>
        </div>
        <h4>${downloaded ? '<i class="ri-download-2-fill dl-badge" title="Downloaded"></i>' : ''}${escapeHtml(track.title)}</h4>
        <p>${track.type === 'artist' ? 'Artist' : track.type === 'playlist' ? 'Playlist' : escapeHtml(track.artist)}</p>
    </div>`;
}

function skeletonCards(n = 6) {
    let out = '';
    for (let i = 0; i < n; i++) out += `<div class="track-card skel-card"><div class="skel art"></div><div class="skel line"></div><div class="skel line short"></div></div>`;
    return out;
}

/* Spotify-style list row for the collection/playlist view. Reuses the SAME
   regTrack key + data-act wiring as the cards, so play/like/remove all flow
   through the one delegated click handler — the row is purely a different
   presentation, not a different behaviour. */
function createTrackRowHTML(track, opts = {}) {
    const key = regTrack(track, opts);
    const isPlaying = activeTrackData && activeTrackData.id === track.id;
    const art = track.thumb && track.thumb !== PLAYLIST_ART
        ? `<img class="row-art" src="${escapeHtml(track.thumb)}" loading="lazy" alt="" onerror="handleThumbError(this, '${escapeHtml(track.id || '')}', 'row-art generic-cover')">`
        : `<div class="row-art generic-cover"><i class="ri-music-2-line"></i></div>`;
    const downloaded = isDownloaded(track.id);
    return `
    <div class="track-row ${isPlaying ? 'playing' : ''}" data-id="${escapeHtml(track.id || '')}" data-act="open" data-key="${key}">
        ${art}
        <div class="row-meta"><h4>${downloaded ? '<i class="ri-download-2-fill dl-badge" title="Downloaded"></i>' : ''}${escapeHtml(track.title)}</h4><p>${escapeHtml(track.artist || '')}</p></div>
        ${isPlaying ? '<div class="row-eq"><span></span><span></span><span></span></div>' : ''}
        <button class="row-menu-btn" data-act="rowmenu" data-key="${key}" title="More" aria-label="More options"><i class="ri-more-2-fill"></i></button>
    </div>`;
}

function skeletonRows(n = 6) {
    let out = '';
    for (let i = 0; i < n; i++) out += `<div class="track-row skel-card" style="pointer-events:none;"><div class="skel art" style="width:48px;height:48px;border-radius:5px;"></div><div style="flex:1;"><div class="skel line"></div><div class="skel line short"></div></div></div>`;
    return out;
}

// Same as createTrackRowHTML (art + title/artist + downloaded badge, tap to
// play) but WITHOUT the ⋮ menu button — used inside the compact home-screen
// carousels, where the row is small and the menu isn't needed there (the
// full menu is still one tap away from any other list in the app).
function createMiniTrackRowHTML(track, opts = {}) {
    const key = regTrack(track, opts);
    const isPlaying = activeTrackData && activeTrackData.id === track.id;
    const art = track.thumb && track.thumb !== PLAYLIST_ART
        ? `<img class="row-art" src="${escapeHtml(track.thumb)}" loading="lazy" alt="" onerror="handleThumbError(this, '${escapeHtml(track.id || '')}', 'row-art generic-cover')">`
        : `<div class="row-art generic-cover"><i class="ri-music-2-line"></i></div>`;
    const downloaded = isDownloaded(track.id);
    return `
    <div class="track-row mini-track-row ${isPlaying ? 'playing' : ''}" data-id="${escapeHtml(track.id || '')}" data-act="open" data-key="${key}">
        ${art}
        <div class="row-meta"><h4>${downloaded ? '<i class="ri-download-2-fill dl-badge" title="Downloaded"></i>' : ''}${escapeHtml(track.title)}</h4><p>${escapeHtml(track.artist || '')}</p></div>
        ${isPlaying ? '<div class="row-eq"><span></span><span></span><span></span></div>' : ''}
    </div>`;
}

// Chunks a list of tracks into horizontally swipeable "pages" of up to 4
// compact rows each — the YouTube-Music-style shelf layout (small square
// art, list of 4, swipe right for the next 4) instead of one long list or a
// grid of big cards.
function renderCarouselShelf(containerId, items, regTrackOpts = {}) {
    const perPage = 4;
    const el = $(containerId);
    if (!el) return;
    if (!items.length) { el.innerHTML = ''; return; }
    let html = '<div class="carousel-wrap">';
    for (let i = 0; i < items.length; i += perPage) {
        const page = items.slice(i, i + perPage);
        html += `<div class="carousel-page">${page.map(t => createMiniTrackRowHTML(t, regTrackOpts)).join('')}</div>`;
    }
    html += '</div>';
    el.innerHTML = html;
}

/* =====================================================================
   OFFLINE DOWNLOADS
   Audio is stored as a Blob in IndexedDB, keyed by track id — not Cache
   Storage, since Range-request seeking through Cache Storage is unreliable
   for <audio> scrubbing. Playback instead builds a Blob URL and hands that
   to the existing player/candidate machinery, so nothing about HOW a track
   plays changes — only WHERE the bytes come from.

   iOS reality check (not hidden from the user, see downloadsHelperNote()):
   there's no persistent file-handle API and no Files-app integration
   available to a website. An installed home-screen PWA gets a private
   storage bucket that isn't subject to Safari's 7-day tab eviction, but
   there's still no hard guarantee — navigator.storage.persist() is a
   best-effort ask, not a promise.
===================================================================== */
const DL_DB_NAME = 'mouzika-downloads';
const DL_DB_VERSION = 1;
const DL_STORE = 'songs';
let downloadedIds = new Set();      // fast, sync-friendly membership check
let dlDbPromise = null;
let persistRequested = false;

function openDownloadsDB() {
    if (dlDbPromise) return dlDbPromise;
    dlDbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DL_DB_NAME, DL_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(DL_STORE)) db.createObjectStore(DL_STORE, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dlDbPromise;
}

async function dlTx(mode) {
    const db = await openDownloadsDB();
    return db.transaction(DL_STORE, mode).objectStore(DL_STORE);
}

// Populate the in-memory id Set once at startup so isDownloaded() can be
// called synchronously from render code (card/row templates) without every
// track card awaiting IndexedDB.
// NOTE: this used to be fire-and-forget — the function was `async` but never
// actually awaited the IDBRequest, so it resolved immediately, before
// downloadedIds was populated. Anything that ran isDownloaded() during the
// first page paint (Recently Played, first thing rendered on launch) saw an
// empty registry and always got "not downloaded", which is why offline
// artwork only ever showed up after something else re-rendered the shelf
// later. It's now a real Promise that resolves only once the read finishes,
// so callers that need an accurate answer on first paint can await it.
function initDownloadsRegistry() {
    return new Promise(async (resolve) => {
        try {
            const store = await dlTx('readonly');
            const keysReq = store.getAllKeys();
            keysReq.onsuccess = () => { downloadedIds = new Set(keysReq.result); refreshAllDownloadBadges(); resolve(); };
            keysReq.onerror = () => resolve(); // IndexedDB unavailable (private mode etc.) — downloads just won't be offered
        } catch (e) { resolve(); }
    });
}
const downloadsRegistryReady = initDownloadsRegistry();

function isDownloaded(id) { return !!id && downloadedIds.has(id); }

async function ensurePersistentStorageOnce() {
    if (persistRequested) return;
    persistRequested = true;
    try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch (e) {}
}

function isInstalledStandalone() {
    return window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true;
}

// Downscale + re-encode artwork before storing it — a few KB per song
// instead of the full-resolution image. Drawing a Blob (not a cross-origin
// <img>) into the canvas avoids the CORS-taint that would otherwise block
// canvas.toBlob() on a third-party thumbnail host.
// Some thumb URLs (item.thumbnails[]/item.thumbnail from search results) are
// raw i.ytimg.com / googleusercontent links, not the wsrv.nl-wrapped ones
// getTrackThumbnail uses elsewhere — fine for an <img src>, but a plain
// fetch() for compression needs CORS headers those CDNs don't reliably send,
// so it was failing silently and every download ended up with no artwork.
// Routing through the same wsrv.nl proxy already used for other thumbnails
// in this app fixes that without changing how thumbnails are displayed.
function corsSafeThumbUrl(url) {
    if (!url) return url;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('wsrv.nl')) return url;
    return `https://wsrv.nl?url=${encodeURIComponent(url)}`;
}

// Data Saver off (default): keep the same artwork quality shown in the app —
// just fetch it as-is, no downscaling. Compression only kicks in when the
// user explicitly turns Data Saver on (see fetchAndCompressThumb below).
async function fetchThumbFullQuality(url) {
    if (!url) return null;
    try { return await (await fetch(url)).blob(); } catch (e) { return null; }
}

async function fetchAndCompressThumb(url) {
    if (!url) return null;
    const safeUrl = corsSafeThumbUrl(url);
    try {
        const srcBlob = await (await fetch(safeUrl)).blob();
        const bitmap = await createImageBitmap(srcBlob);
        const size = 200; // was 96 @ 0.55 — visibly soft; still only a few KB at this size/quality
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / bitmap.width, size / bitmap.height);
        const dw = bitmap.width * scale, dh = bitmap.height * scale;
        ctx.drawImage(bitmap, (size - dw) / 2, (size - dh) / 2, dw, dh);
        return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    } catch (e) {
        // Compression failed (e.g. no createImageBitmap support) — still better
        // to keep the original image offline than to have none at all.
        try { return await (await fetch(safeUrl)).blob(); } catch (e2) { return null; }
    }
}

/* ---- Custom playlist cover upload ----
   A standard <input type="file" accept="image/*"> opens the native photo
   picker/gallery on both Android and iOS with zero platform-specific code —
   this is not a mobile limitation to work around, it's just how file inputs
   already work everywhere. The chosen image is downscaled + re-encoded
   client-side (same canvas technique already used for download thumbnails)
   before being stored, so a full-resolution phone photo doesn't bloat the
   synced profile. */
let pendingCoverPlaylistId = null;
function triggerPlaylistCoverUpload(plId) {
    pendingCoverPlaylistId = plId;
    $('playlist-cover-input').click();
}
async function handlePlaylistCoverUpload(event) {
    const file = event.target.files?.[0];
    const plId = pendingCoverPlaylistId;
    pendingCoverPlaylistId = null;
    event.target.value = ''; // so choosing the same file again still fires 'change' next time
    if (!file || !plId) return;
    const pl = userProfile.customPlaylists.find(p => p.id === plId);
    if (!pl) return;
    showToast("Updating cover…", true);
    try {
        const dataUrl = await compressUploadedImageToDataUrl(file, 500, 0.82);
        if (!dataUrl) throw new Error("compress failed");
        pl.thumb = dataUrl;
        syncProfile();
        if ($('pane-collection').classList.contains('active')) openCollection('custom-playlist', plId);
        showToast("Playlist cover updated");
    } catch (e) {
        showToast("Couldn't update the cover — try a different image", true);
    }
}
async function compressUploadedImageToDataUrl(file, maxSize = 500, quality = 0.82) {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
        const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
        return canvas.toDataURL('image/jpeg', quality);
    } catch (e) { return null; }
}

async function saveDownload(track, audioBlob, thumbBlob, quality, lyricsData = null) {
    const record = {
        id: track.id, title: track.title, artist: track.artist || '',
        thumbLowRes: thumbBlob || null, audioBlob, quality: quality || '320',
        lyricsData: lyricsData || null,
        sizeBytes: (audioBlob?.size || 0) + (thumbBlob?.size || 0),
        downloadedAt: Date.now()
    };
    const store = await dlTx('readwrite');
    await new Promise((res, rej) => { const r = store.put(record); r.onsuccess = res; r.onerror = () => rej(r.error); });
    downloadedIds.add(track.id);
    invalidateOfflineThumbCache(track.id);
    return record;
}

function getDownload(id) {
    return new Promise(async (resolve, reject) => {
        const store = await dlTx('readonly');
        const r = store.get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
    });
}

async function deleteDownload(id) {
    const store = await dlTx('readwrite');
    await new Promise((res, rej) => { const r = store.delete(id); r.onsuccess = res; r.onerror = () => rej(r.error); });
    downloadedIds.delete(id);
    invalidateOfflineThumbCache(id);
    refreshDownloadBadges(id);
}

async function deleteAllDownloads() {
    const store = await dlTx('readwrite');
    await new Promise((res, rej) => { const r = store.clear(); r.onsuccess = res; r.onerror = () => rej(r.error); });
    const hadIds = [...downloadedIds];
    downloadedIds = new Set();
    hadIds.forEach(id => { invalidateOfflineThumbCache(id); refreshDownloadBadges(id); });
}

function listDownloads() {
    return new Promise(async (resolve, reject) => {
        const store = await dlTx('readonly');
        const r = store.getAll();
        r.onsuccess = () => resolve((r.result || []).sort((a, b) => b.downloadedAt - a.downloadedAt));
        r.onerror = () => reject(r.error);
    });
}

async function getTotalDownloadedSize() {
    const all = await listDownloads();
    return all.reduce((sum, d) => sum + (d.sizeBytes || 0), 0);
}

function formatBytes(bytes) {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

// Flip every on-screen badge/icon for one track id to match its current
// downloaded state — same pattern highlightActiveTrackCard() already uses
// for the now-playing eq badge, just for the download icon instead.
function refreshDownloadBadges(id) {
    if (!id) return;
    const on = isDownloaded(id);
    document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(card => {
        const btn = card.querySelector('.icon-btn.dl-toggle');
        if (btn) { btn.classList.toggle('downloaded', on); btn.querySelector('i').className = `ri-download-2-${on ? 'fill' : 'line'}`; btn.title = on ? 'Remove download' : 'Download for offline'; }
        let badge = card.querySelector('.dl-badge');
        if (on && !badge) card.querySelector('h4, h5')?.insertAdjacentHTML('beforebegin', '<i class="ri-download-2-fill dl-badge" title="Downloaded"></i>');
        else if (!on && badge) badge.remove();
    });
}
function refreshAllDownloadBadges() { downloadedIds.forEach(refreshDownloadBadges); }

// Actually fetch + store one track. Reuses the exact same stream sources as
// live playback (fast-saavn first, Invidious mirrors as fallback) so nothing
// new is introduced server-side — just a lower bitrate tier for Data Saver.
// Off by default (see the toggle in Profile). Uses the exact same worker
// endpoint + LRC parsing as live playback, just fetched once up front and
// stored with the download instead of over the network every time.
async function fetchLyricsForDownload(track) {
    try {
        const cleanTitle = cleanTitleForLyrics(track.title) || track.title;
        const cleanArtist = deriveArtistForLyrics(track.title, track.artist);
        const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/lyrics-proxy?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`, 12000);
        const data = await res.json();
        if (data.found && data.synced) {
            const parsed = parseLRC(data.synced);
            if (parsed.length) return { mode: 'synced', lines: parsed };
        }
        if (data.found && data.plain) return { mode: 'plain', lines: data.plain };
    } catch (e) {}
    return null;
}

async function downloadTrackForOffline(track, opts = {}) {
    const { silent = false } = opts;
    if (!track?.id) return false;
    if (isDownloaded(track.id)) { if (!silent) showToast("Already downloaded"); return true; }
    ensurePersistentStorageOnce();
    if (!silent) showToast(`Downloading "${track.title}"…`);
    try {
        // 'off' -> 320kbps (full quality), 'saver' -> 96kbps, 'ultra' -> 48kbps
        // (JioSaavn's lowest standard-quality tier — still clearly listenable,
        // just the smallest file size available).
        const level = userProfile.dataSaverLevel || (userProfile.dataSaver ? 'saver' : 'off');
        const quality = level === 'ultra' ? '48' : level === 'saver' ? '96' : '320';
        const cleanedArtist = cleanArtistName(track.artist);
        let streamUrl = null;
        try { streamUrl = await resolveSaavnStream(cleanTitleForLyrics(track.title) || track.title, cleanedArtist, quality, track.title, track.artist); }
        catch (e) {
            const mirrors = await resolveMirrorStreams(track.id).catch(() => []);
            streamUrl = mirrors[0] || null; // mirrors have no quality tiers — Data Saver only applies via Saavn
        }
        if (!streamUrl) throw new Error("no source");
        const audioRes = await fetch(streamUrl);
        if (!audioRes.ok) throw new Error("audio fetch failed");
        const audioBlob = await audioRes.blob();
        const thumbBlob = level !== 'off' ? await fetchAndCompressThumb(track.thumb) : await fetchThumbFullQuality(track.thumb);
        const lyricsData = userProfile.downloadLyricsOffline ? await fetchLyricsForDownload(track) : null;
        await saveDownload(track, audioBlob, thumbBlob, quality, lyricsData);
        refreshDownloadBadges(track.id);
        if (!silent) showToast(`Downloaded "${track.title}"`);
        return true;
    } catch (e) {
        if (!silent) showToast(`Couldn't download "${track.title}" — try again`, true);
        return false;
    }
}

async function toggleTrackDownload(key) {
    const entry = TRACK_REG.get(key);
    if (!entry) return;
    const { track } = entry;
    if (isDownloaded(track.id)) { await deleteDownload(track.id); showToast("Download removed"); }
    else await downloadTrackForOffline(track);
}

// Concurrent batches of 4 (not fully parallel — that would hammer the
// backend/CDNs and device storage all at once with dozens of simultaneous
// requests) so a big playlist finishes much faster than strictly one-by-one,
// while still bounded. Progress is shown live in the triggering button.
const DOWNLOAD_BATCH_SIZE = 4;
// Global, persistent progress — NOT tied to the button that started the
// download. Previously progress was written straight into that specific
// button's innerHTML, so navigating away (the button gets torn down when its
// view unmounts) made progress invisible until you came back, and coming
// back rendered a brand-new button that had no idea a download was already
// running. The download itself was never actually interrupted — only the
// display was broken. This tracks progress globally so the topbar pill (and
// the button, if you're still looking at it) both stay live regardless.
let activeBulkDownload = null; // { done, total, token }
let bulkDownloadToken = 0;

function renderBulkDownloadProgress() {
    const pill = $('global-dl-pill'), pillText = $('global-dl-pill-text');
    if (!activeBulkDownload) { if (pill) pill.style.display = 'none'; return; }
    if (pill) pill.style.display = 'flex';
    if (pillText) pillText.textContent = `${activeBulkDownload.done}/${activeBulkDownload.total}`;
    // If the button that originally started this run is still on-screen
    // (user never navigated away, or came back to the same collection),
    // keep it in sync too — but only while a download is actually in flight;
    // once finished we set its final label directly (see below).
    const btn = $('pl-download-btn');
    if (btn && btn.isConnected) btn.innerHTML = `<i class="ri-loader-4-line animate-spin"></i> ${activeBulkDownload.done}/${activeBulkDownload.total}`;
}

async function downloadPlaylistTracks(tracks, buttonEl) {
    const todo = (tracks || []).filter(t => t?.id && !isDownloaded(t.id));
    if (!todo.length) { showToast("Everything here is already downloaded"); return; }
    const myToken = ++bulkDownloadToken; // starting a new bulk download supersedes any other in-flight one
    activeBulkDownload = { done: 0, total: todo.length, token: myToken };
    renderBulkDownloadProgress();
    for (let i = 0; i < todo.length; i += DOWNLOAD_BATCH_SIZE) {
        if (bulkDownloadToken !== myToken) return; // superseded — a newer bulk download took over
        const batch = todo.slice(i, i + DOWNLOAD_BATCH_SIZE);
        await Promise.all(batch.map(t => downloadTrackForOffline(t, { silent: true })));
        if (bulkDownloadToken !== myToken) return;
        activeBulkDownload.done += batch.length;
        renderBulkDownloadProgress();
    }
    if (bulkDownloadToken !== myToken) return;
    const finishedTotal = activeBulkDownload.total, finishedDone = activeBulkDownload.done;
    activeBulkDownload = null;
    renderBulkDownloadProgress();
    // Whichever button is currently on-screen for this collection (may not be
    // the same DOM node that kicked this off, if the view was re-rendered
    // after navigating away and back) gets the finished state.
    const btn = (buttonEl && buttonEl.isConnected) ? buttonEl : ($('pl-download-btn'));
    if (btn) {
        btn.innerHTML = `<i class="ri-checkbox-circle-fill"></i> Downloaded`;
        setTimeout(() => { if (btn.isConnected) btn.innerHTML = `<i class="ri-download-2-line"></i> Download`; }, 2200);
    }
    showToast(`Downloaded ${finishedDone}/${finishedTotal} track${finishedTotal === 1 ? '' : 's'}`);
}

/* ---- 3-dot bottom sheet (Like / Remove) ---- */
let rowSheetKey = null;
function openRowSheet(key) {
    const entry = TRACK_REG.get(key);
    if (!entry) return;
    rowSheetKey = key;
    const { track, meta } = entry;
    const liked = userProfile.likedSongs?.some(s => s.id === track.id);
    const art = track.thumb && track.thumb !== PLAYLIST_ART
        ? `<img src="${escapeHtml(track.thumb)}" alt="" onerror="this.outerHTML='<div class=&quot;generic-cover&quot;><i class=&quot;ri-music-2-line&quot;></i></div>'">`
        : `<div class="generic-cover"><i class="ri-music-2-line"></i></div>`;
    $('row-sheet-head').innerHTML = `${art}<div class="rsh-meta"><h5>${escapeHtml(track.title)}</h5><p>${escapeHtml(track.artist || '')}</p></div>`;

    // Remove is available inside a custom playlist (meta.collectionId = 'pl_…')
    // or the Liked collection; external playlists/albums aren't editable so it
    // is hidden there.
    const inCustomPl = meta && typeof meta.collectionId === 'string' && meta.collectionId.startsWith('pl_');
    const inLiked = meta && meta.collectionId === 'liked';
    let removeRow = '';
    if (inCustomPl) removeRow = `<div class="row-sheet-action danger" onclick="rowSheetRemove()"><i class="ri-delete-bin-line"></i> Remove from this playlist</div>`;
    else if (inLiked) removeRow = `<div class="row-sheet-action danger" onclick="rowSheetRemove()"><i class="ri-heart-fill"></i> Remove from Liked Songs</div>`;

    const downloaded = isDownloaded(track.id);
    $('row-sheet-body').innerHTML = `
        <div class="row-sheet-action ${liked ? 'on' : ''}" onclick="rowSheetToggleLike()">
            <i class="ri-heart-${liked ? 'fill' : 'line'}"></i> ${liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
        </div>
        <div class="row-sheet-action ${downloaded ? 'on' : ''}" onclick="rowSheetToggleDownload()">
            <i class="ri-download-2-${downloaded ? 'fill' : 'line'}"></i> ${downloaded ? 'Remove download' : 'Download for offline'}
        </div>
        <div class="row-sheet-action" onclick="rowSheetAddToPlaylist()"><i class="ri-play-list-add-line"></i> Add to a playlist</div>
        ${removeRow}`;

    $('row-sheet-backdrop').classList.add('open');
    $('row-sheet').classList.add('open');
}
function closeRowSheet() {
    $('row-sheet-backdrop').classList.remove('open');
    $('row-sheet').classList.remove('open');
    rowSheetKey = null;
}
function rowSheetToggleLike() {
    const entry = TRACK_REG.get(rowSheetKey);
    if (entry) toggleSaveItem(entry.track);
    closeRowSheet();
}
function rowSheetToggleDownload() {
    const key = rowSheetKey;
    closeRowSheet();
    if (key) toggleTrackDownload(key);
}
function rowSheetRemove() {
    const entry = TRACK_REG.get(rowSheetKey);
    if (!entry) { closeRowSheet(); return; }
    const { track, meta } = entry;
    if (meta && typeof meta.collectionId === 'string' && meta.collectionId.startsWith('pl_')) {
        removeSongFromCustomPlaylist(meta.collectionId, track.id);
    } else if (meta && meta.collectionId === 'liked') {
        userProfile.likedSongs = (userProfile.likedSongs || []).filter(s => s.id !== track.id);
        syncProfile();
        openCollection('liked');
        showToast("Removed from Liked Songs", true);
    }
    closeRowSheet();
}
function rowSheetAddToPlaylist() {
    const entry = TRACK_REG.get(rowSheetKey);
    if (entry) {
        if (!globalUser || globalUser === 'admin') { closeRowSheet(); switchPane('account'); showToast("Log in to use playlists", true); return; }
        pendingModalTrack = { ...entry.track, type: 'song' };
        $('modal-top-title').textContent = "Add to playlist";
        renderModalPlaylistList(true);
        $('add-playlist-modal').classList.add('open');
    }
    closeRowSheet();
}

/* One delegated click handler for every card action */
document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const entry = TRACK_REG.get(el.dataset.key);
    if (!entry) return;
    const { track, meta } = entry;
    const act = el.dataset.act;

    if (act === 'fav') {
        e.stopPropagation();
        toggleSaveItem(track, el);
        return;
    }
    if (act === 'removefrompl') {
        e.stopPropagation();
        removeSongFromCustomPlaylist(meta.collectionId, track.id);
        return;
    }
    if (act === 'download') {
        e.stopPropagation();
        toggleTrackDownload(el.dataset.key);
        return;
    }
    if (act === 'rowmenu') {
        e.stopPropagation();
        openRowSheet(el.dataset.key);
        return;
    }
    if (act === 'addsong') {
        e.stopPropagation();
        addSuggestionToPlaylist(meta.collectionId, track, el);
        return;
    }
    if (act === 'open') {
        e.stopPropagation();
        if (track.type === 'artist') exploreArtistSongs(track.id, track.title, track.thumb);
        else if (track.type === 'playlist') explorePlaylistOrAlbumSongs(track.id, track.title, track.thumb);
        else if (typeof meta.queueIndex === 'number' && meta.queueIndex > -1) playFromQueueContext(meta.queueIndex);
        else playSingleAndQueueSimilar(track);
    }
});

/* =====================================================================
   NAVIGATION
===================================================================== */
function switchPane(paneId) {
    if (paneId !== 'collection') navigationOriginPane = paneId;
    document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav li, .mobile-nav li').forEach(l => l.classList.remove('active'));
    $(`pane-${paneId}`).classList.add('active');
    const btn = $(`btn-${paneId}`); if (btn) btn.classList.add('active');
    const mbtn = $(`btn-m-${paneId}`); if (mbtn) mbtn.classList.add('active');
    $('main-scroller').scrollTop = 0;
    if (paneId === 'search') setTimeout(() => $('search-box-field').focus(), 60);
    if (paneId === 'admin') loadUserList();
}
function triggerPaneRollback() { switchPane(navigationOriginPane); }
function triggerGenreSearch(query) {
    switchPane('search');
    $('search-box-field').value = query;
    $('search-clear').style.display = 'block';
    justSearched = true;
    if (suggestAbort) { suggestAbort.abort(); suggestAbort = null; }
    $('suggestions-box').style.display = "none";
    setSearchIdle(false);
    currentSearchQuery = query;
    setSearchFilter('playlist');
}

/* =====================================================================
   AUTH
===================================================================== */
function showAuthGate() {
    const g = $('auth-gate');
    if (g) { g.classList.remove('hidden'); setTimeout(() => { const u = $('gate-username'); if (u) u.focus(); }, 60); }
}
function hideAuthGate() {
    const g = $('auth-gate'); if (g) g.classList.add('hidden');
}
// Lets someone in when there's no way to reach the login server — clears the
// gate (which is visible by default until a real login/failure hides it) and
// opens straight into whatever's usable without a network: downloads, liked
// songs already cached in this browser, and playback of anything downloaded.
// Nothing here requires the server, so it's safe to show even fully offline.
function enterOfflineMode() {
    applyIdentityUI(globalUser && globalUser !== 'admin' ? globalUser : null);
    hideAuthGate();
    populateLibraryUI();
    switchPane('library');
    showToast("Couldn't reach the server — showing your downloads", true);
}
async function gateLogin() {
    const user = $('gate-username').value.trim();
    const pass = $('gate-password').value.trim();
    const msg = $('gate-msg');
    if (!user || !pass) { msg.className = 'form-msg err'; msg.textContent = "Enter a username and password."; return; }
    const btn = $('gate-login-btn');
    btn.disabled = true;
    msg.className = 'form-msg'; msg.textContent = "Signing in…";
    // Mirror into the existing account-pane inputs so executeLogin's error
    // messages (which target #login-msg) and the rest of the flow work unchanged.
    $('friend-username').value = user;
    $('friend-password').value = pass;
    await executeLogin(user, pass);
    btn.disabled = false;
    // executeLogin sets globalUser on success; if still null, login failed.
    if (globalUser) { msg.textContent = ""; $('gate-password').value = ""; }
    else { msg.className = 'form-msg err'; msg.textContent = ($('login-msg').textContent || "Login failed."); }
}

async function authenticateFriend() {
    const user = $('friend-username').value.trim();
    const pass = $('friend-password').value.trim();
    const msg = $('login-msg');
    if (!user || !pass) { msg.className = 'form-msg err'; msg.textContent = "Enter a username and password."; return; }
    $('login-btn').disabled = true;
    msg.className = 'form-msg'; msg.textContent = "Signing in…";
    await executeLogin(user, pass);
    $('login-btn').disabled = false;
}

// auto=true means this is the automatic sign-in attempt on app launch (an
// already-saved session), not someone submitting the gate form by hand. It
// changes nothing about a normal login attempt/failure — it only controls
// what happens if the request can't reach the server at all: a manual
// attempt shows the error and lets them retry, but an automatic one (most
// likely just offline) drops straight into local/downloaded content instead
// of leaving the sign-in gate stuck on screen with no way to clear it.
async function executeLogin(user, pass, auto = false) {
    const msg = $('login-msg');
    try {
        const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/login`, 9000, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.error) {
            if (msg) { msg.className = 'form-msg err'; msg.textContent = data.error; }
            logoutFriend(true);
            return;
        }
        globalUser = user; globalPass = pass;
        localStorage.setItem("hub_active_user", user);
        localStorage.setItem("hub_active_pass", pass);
        if (msg) msg.textContent = "";
        hideAuthGate();
        sessionSynced = true;

        if (data.isAdmin) {
            $('btn-admin').style.display = "flex";
            applyIdentityUI('admin');
            switchPane('admin');
            showToast("Welcome back, admin");
        } else {
            $('btn-admin').style.display = "none";
            userProfile = {
                username: data.profile.username,
                likedSongs: data.profile.likedSongs || [],
                customPlaylists: data.profile.customPlaylists || [],
                favouriteArtists: data.profile.favouriteArtists || [],
                favouriteAlbums: data.profile.favouriteAlbums || [],
                recentlyPlayed: data.profile.recentlyPlayed || [],
                dataSaver: !!data.profile.dataSaver,
                dataSaverLevel: ['off', 'saver', 'ultra'].includes(data.profile.dataSaverLevel) ? data.profile.dataSaverLevel : (data.profile.dataSaver ? 'saver' : 'off'),
                downloadLyricsOffline: !!data.profile.downloadLyricsOffline,
                // undefined = this account has never touched the setting (brand new,
                // or predates it) -> use the new default (on). An explicit past
                // choice (true or false) is always respected either way.
                liquidGlass: data.profile.liquidGlass === undefined ? true : !!data.profile.liquidGlass,
                theme: data.profile.theme === 'light' ? 'light' : 'dark',
                accentColor: data.profile.accentColor || 'orange',
                lyricsColor: data.profile.lyricsColor || 'white',
                presetTint: data.profile.presetTint || 'none',
                activePreset: data.profile.activePreset === undefined ? 'glass' : data.profile.activePreset
            };
            // The server copy above can be stale (e.g. you toggled a setting
            // and refreshed before the debounced save reached it) — the
            // device's own settings always win over that for this device.
            loadDeviceSettings();
            applyIdentityUI(userProfile.username);
            applyLiquidGlassTheme();
            applyThemePreference();
            cacheProfileLocally();
            populateLibraryUI();
            loadHomeRecommendations();
            switchPane('home');
            if (data.surprise) {
                playSurprise(userProfile.username);
            } else {
                showToast(`Welcome, ${userProfile.username}`);
            }
        }
    } catch (e) {
        if (msg) { msg.className = 'form-msg err'; msg.textContent = "Can't reach the server. Is the backend running?"; }
        if (auto) enterOfflineMode();
    }
}

function applyIdentityUI(name) {
    const loggedIn = !!name;
    $('topbar-greeting').textContent = loggedIn ? `${timeGreeting()}, ${name}` : timeGreeting();
    $('user-chip-name').textContent = loggedIn ? name : "Log in";
    $('auth-portal-form').style.display = loggedIn ? "none" : "flex";
    $('active-profile-details').style.display = loggedIn ? "flex" : "none";
    if (loggedIn) {
        $('logged-in-name').textContent = name;
        $('profile-avatar-letter').textContent = name.charAt(0).toUpperCase();
        $('stat-liked').textContent = userProfile.likedSongs?.length || 0;
        $('stat-playlists').textContent = userProfile.customPlaylists?.length || 0;
        $('stat-artists').textContent = userProfile.favouriteArtists?.length || 0;
        const dsLevel = userProfile.dataSaverLevel || (userProfile.dataSaver ? 'saver' : 'off');
        document.querySelectorAll('.data-saver-option').forEach(b => b.classList.toggle('active', b.dataset.level === dsLevel));
        const lyToggle = $('lyrics-offline-toggle');
        if (lyToggle) lyToggle.classList.toggle('on', !!userProfile.downloadLyricsOffline);
        const lgToggle = $('liquid-glass-toggle');
        if (lgToggle) lgToggle.classList.toggle('on', !!userProfile.liquidGlass);
        const themeToggle = $('theme-mode-toggle');
        if (themeToggle) themeToggle.classList.toggle('on', userProfile.theme === 'light');
        document.querySelectorAll('.accent-swatch').forEach(sw => sw.classList.toggle('active', sw.dataset.accent === (userProfile.accentColor || 'orange')));
        document.querySelectorAll('.lyrics-color-swatch').forEach(sw => sw.classList.toggle('active', sw.dataset.lyricsColor === (userProfile.lyricsColor || 'white')));
        document.querySelectorAll('.preset-theme-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === userProfile.activePreset));
    }
}

function logoutFriend(silent = false) {
    localStorage.removeItem("hub_active_user");
    localStorage.removeItem("hub_active_pass");
    globalUser = null; globalPass = null;
    userProfile = { username: "", likedSongs: [], customPlaylists: [], favouriteArtists: [], favouriteAlbums: [], recentlyPlayed: [], dataSaver: false, dataSaverLevel: 'off', downloadLyricsOffline: false, liquidGlass: true, theme: 'dark', accentColor: 'orange', lyricsColor: 'white', presetTint: 'none', activePreset: 'glass' };
    loadDeviceSettings(); // these are device prefs, not account data — logging out shouldn't reset them
    applyLiquidGlassTheme();
    applyThemePreference();
    $('btn-admin').style.display = "none";
    $('friend-password').value = "";
    applyIdentityUI(null);
    populateLibraryUI();
    showAuthGate();
    if (!silent) { loadHomeRecommendations(); switchPane('account'); showToast("Logged out", true); }
}

async function adminCreateUser() {
    const user = $('new-username').value.trim();
    const pass = $('new-password').value.trim();
    const asAdmin = $('new-user-admin').checked;
    const withSurprise = $('new-user-surprise').checked;
    const msg = $('admin-msg');
    if (!user || !pass) { msg.className = 'form-msg err'; msg.textContent = "Provide a username and password."; return; }
    try {
        const res = await fetch(`${NEW_HUB_BACKEND}/api/create-user`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass, isAdmin: asAdmin, surprise: withSurprise })
        });
        const data = await res.json();
        if (data.error) { msg.className = 'form-msg err'; msg.textContent = data.error; }
        else {
            msg.className = 'form-msg ok'; msg.textContent = `User "${user}" created.`;
            $('new-username').value = ""; $('new-password').value = ""; $('new-user-admin').checked = false; $('new-user-surprise').checked = false;
            loadUserList();
        }
    } catch (e) { msg.className = 'form-msg err'; msg.textContent = "Server error."; }
}

async function loadUserList() {
    const body = $('user-list-body');
    if (!body) return;
    body.innerHTML = `<p class="status-note">Loading users…</p>`;
    try {
        const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/list-users`, 10000);
        const data = await res.json();
        const users = Array.isArray(data.users) ? data.users : [];
        if (!users.length) { body.innerHTML = `<p class="status-note">No users yet.</p>`; return; }
        // NOTE: handlers are attached via event delegation below (see the
        // one-time #user-list-body listener), NOT inline onchange/onclick.
        // The username is carried in data-user; escaping it for an HTML
        // attribute is safe, whereas embedding JSON.stringify(username) inside
        // an onchange="" attribute broke the attribute quoting and silently
        // killed the click — which is why nothing hit the network before.
        body.innerHTML = users.map(u => {
            const nameAttr = escapeHtml(u.username);
            return `
            <div class="user-row">
                <div class="user-row-avatar">${escapeHtml(u.username.charAt(0).toUpperCase())}</div>
                <div class="user-row-meta">
                    <h5>${escapeHtml(u.username)}</h5>
                    <p>${u.likedCount} liked · ${u.playlistCount} playlist${u.playlistCount === 1 ? '' : 's'}</p>
                </div>
                <label class="admin-toggle surprise-toggle" title="Show a one-time surprise welcome next time this user logs in">
                    <input type="checkbox" data-action="surprise" data-user="${nameAttr}" ${u.surprise ? 'checked' : ''}>
                    <span><i class="ri-gift-line"></i> Surprise</span>
                </label>
                <label class="admin-toggle">
                    <input type="checkbox" data-action="admin" data-user="${nameAttr}" ${u.isAdmin ? 'checked' : ''}>
                    <span>Admin</span>
                </label>
                <button class="user-row-delete" data-action="delete" data-user="${nameAttr}" title="Delete user">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>`;
        }).join('');
    } catch (e) {
        body.innerHTML = `<p class="status-note err">Couldn't load the user list. <span style="text-decoration:underline; cursor:pointer;" onclick="loadUserList()">Try again</span></p>`;
    }
}

/* One delegated listener for the whole user list — survives re-renders and
   avoids any inline-attribute quoting pitfalls. Attached once. */
(function wireUserListDelegation() {
    const body = document.getElementById('user-list-body');
    if (!body) return;
    body.addEventListener('change', (e) => {
        const el = e.target;
        if (el.dataset.action === 'surprise') toggleUserSurprise(el.dataset.user, el.checked);
        else if (el.dataset.action === 'admin') toggleUserAdmin(el.dataset.user, el.checked);
    });
    body.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="delete"]');
        if (btn) confirmDeleteUser(btn.dataset.user);
    });
})();

async function toggleUserAdmin(username, isAdmin) {
    try {
        const res = await fetch(`${NEW_HUB_BACKEND}/api/set-admin`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, isAdmin })
        });
        if (res.status === 404) {
            showToast("Server needs redeploy: run 'wrangler deploy' in the worker folder", true);
            loadUserList();
            return;
        }
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast(isAdmin ? `${username} is now an admin` : `${username} is no longer an admin`);
        loadUserList();
    } catch (e) {
        showToast("Couldn't update that user — try refreshing the list", true);
        loadUserList();
    }
}

async function toggleUserSurprise(username, surprise) {
    try {
        const res = await fetch(`${NEW_HUB_BACKEND}/api/set-surprise`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, surprise })
        });
        if (res.status === 404) {
            // The deployed Worker doesn't have this endpoint yet — almost always
            // means it hasn't been redeployed since the surprise feature was added.
            showToast("Server needs redeploy: run 'wrangler deploy' in the worker folder", true);
            loadUserList();
            return;
        }
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast(surprise ? `Surprise armed for ${username} 🎁` : `Surprise turned off for ${username}`);
        // Re-read from the server so the checkbox always reflects what truly persisted
        loadUserList();
    } catch (e) {
        showToast("Couldn't update that user — try refreshing the list", true);
        loadUserList();
    }
}

function confirmDeleteUser(username) {
    openConfirmModal(
        `Delete "${username}"?`,
        "This permanently removes the user account and everything saved to it — liked songs, playlists, all of it. This can't be undone.",
        () => deleteUser(username)
    );
}

async function deleteUser(username) {
    try {
        const res = await fetch(`${NEW_HUB_BACKEND}/api/delete-user`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        if (res.status === 404) {
            showToast("Server needs redeploy: run 'wrangler deploy' in the worker folder", true);
            loadUserList();
            return;
        }
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast(`Deleted ${username}`, true);
        loadUserList();
    } catch (e) {
        showToast("Couldn't delete that user — try again", true);
        loadUserList();
    }
}

/* ---- Device-level settings (separate from the account-synced profile) ----
   These 5 toggles are saved to a dedicated localStorage key that has NOTHING
   to do with login at all — no network round-trip, no debounce, no account.
   Previously they only lived inside userProfile, which meant: toggle a
   setting -> refresh before the debounced /api/save-profile finishes ->
   login re-fetches the OLD server copy and silently overwrites the toggle
   you just made. This store can never lose that race, because nothing about
   applying it depends on login succeeding, or even being attempted. Account
   sync still happens too (via syncProfile, further down) so settings follow
   you to another device when that works — but THIS device always wins for
   THIS device, instantly, regardless of network. */
const DEVICE_SETTINGS_KEY = 'mouzika_device_settings';
function saveDeviceSettings() {
    try {
        localStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify({
            dataSaver: !!userProfile.dataSaver,
            dataSaverLevel: userProfile.dataSaverLevel || 'off',
            downloadLyricsOffline: !!userProfile.downloadLyricsOffline,
            liquidGlass: !!userProfile.liquidGlass,
            theme: userProfile.theme === 'light' ? 'light' : 'dark',
            accentColor: userProfile.accentColor || 'orange',
            lyricsColor: userProfile.lyricsColor || 'white',
            presetTint: userProfile.presetTint || 'none',
            activePreset: userProfile.activePreset || null
        }));
    } catch (e) {}
}
function loadDeviceSettings() {
    try {
        const raw = localStorage.getItem(DEVICE_SETTINGS_KEY);
        if (!raw) return false;
        const s = JSON.parse(raw);
        if (!s || typeof s !== 'object') return false;
        userProfile.dataSaver = !!s.dataSaver;
        userProfile.dataSaverLevel = ['off', 'saver', 'ultra'].includes(s.dataSaverLevel) ? s.dataSaverLevel : (s.dataSaver ? 'saver' : 'off');
        userProfile.downloadLyricsOffline = !!s.downloadLyricsOffline;
        userProfile.liquidGlass = !!s.liquidGlass;
        userProfile.theme = s.theme === 'light' ? 'light' : 'dark';
        userProfile.accentColor = s.accentColor || 'orange';
        userProfile.lyricsColor = s.lyricsColor || 'white';
        userProfile.presetTint = s.presetTint || 'none';
        userProfile.activePreset = s.activePreset || null;
        return true;
    } catch (e) { return false; }
}

function setDataSaverLevel(level) {
    if (!['off', 'saver', 'ultra'].includes(level)) return;
    userProfile.dataSaverLevel = level;
    userProfile.dataSaver = level !== 'off'; // kept in sync for any older code/account data still reading the boolean
    document.querySelectorAll('.data-saver-option').forEach(b => b.classList.toggle('active', b.dataset.level === level));
    const labels = { off: "Data Saver off — downloads use full quality", saver: "Data Saver on — smaller downloads", ultra: "Ultra Data Saver on — smallest possible downloads" };
    showToast(labels[level]);
    saveDeviceSettings();
    syncProfile();
}
// Kept so nothing that still calls the old boolean toggle breaks.
function toggleDataSaver() {
    setDataSaverLevel((userProfile.dataSaverLevel || 'off') === 'off' ? 'saver' : 'off');
}

function toggleLyricsOffline() {
    userProfile.downloadLyricsOffline = !userProfile.downloadLyricsOffline;
    const el = $('lyrics-offline-toggle');
    if (el) el.classList.toggle('on', userProfile.downloadLyricsOffline);
    showToast(userProfile.downloadLyricsOffline ? "New downloads will also save lyrics for offline" : "Lyrics won't be saved with new downloads");
    saveDeviceSettings();
    syncProfile();
}

function toggleLiquidGlass() {
    userProfile.liquidGlass = !userProfile.liquidGlass;
    userProfile.activePreset = null; // hand-toggling a single dimension means "no preset" anymore
    const el = $('liquid-glass-toggle');
    if (el) el.classList.toggle('on', userProfile.liquidGlass);
    applyLiquidGlassTheme();
    refreshActivePresetButton();
    saveDeviceSettings();
    syncProfile();
}
function applyLiquidGlassTheme() {
    document.body.classList.toggle('liquid-glass', !!userProfile.liquidGlass);
}

/* ---- Appearance: light/dark mode + accent color ----
   Both are pure CSS-variable overrides keyed off attributes on <html>, so
   every existing component (which already reads var(--bg)/var(--accent)/etc
   throughout) picks them up automatically with no per-component changes. */
function applyThemePreference() {
    document.documentElement.setAttribute('data-theme', userProfile.theme === 'light' ? 'light' : 'dark');
    document.documentElement.setAttribute('data-accent', userProfile.accentColor || 'orange');
    document.documentElement.setAttribute('data-lyrics-color', userProfile.lyricsColor || 'white');
    document.documentElement.setAttribute('data-preset-tint', userProfile.presetTint || 'none');
}
function toggleThemeMode() {
    userProfile.theme = userProfile.theme === 'light' ? 'dark' : 'light';
    userProfile.activePreset = null;
    const el = $('theme-mode-toggle');
    if (el) el.classList.toggle('on', userProfile.theme === 'light');
    applyThemePreference();
    refreshActivePresetButton();
    showToast(userProfile.theme === 'light' ? "Light mode on" : "Dark mode on");
    saveDeviceSettings();
    syncProfile();
}
function setAccentColor(key) {
    userProfile.accentColor = key;
    userProfile.activePreset = null;
    document.querySelectorAll('.accent-swatch').forEach(sw => sw.classList.toggle('active', sw.dataset.accent === key));
    applyThemePreference();
    refreshActivePresetButton();
    saveDeviceSettings();
    syncProfile();
}
function setLyricsColor(key) {
    userProfile.lyricsColor = key;
    userProfile.activePreset = null;
    document.querySelectorAll('.lyrics-color-swatch').forEach(sw => sw.classList.toggle('active', sw.dataset.lyricsColor === key));
    applyThemePreference();
    refreshActivePresetButton();
    saveDeviceSettings();
    syncProfile();
}
function applyPresetTheme(preset) {
    // One-tap bundles across every appearance dimension at once. Each pairs
    // an accent, a matching lyrics-highlight color, and (for the new ones) a
    // subtle signature background tint, so it reads as one deliberately
    // designed look rather than just a different-colored dot.
    const presets = {
        classic:   { liquidGlass: false, accentColor: 'orange',  lyricsColor: 'white',   theme: 'dark',  presetTint: 'none'    },
        glass:     { liquidGlass: true,  accentColor: 'orange',  lyricsColor: 'white',   theme: 'dark',  presetTint: 'none'    },
        monochrome:{ liquidGlass: false, accentColor: 'mono',    lyricsColor: 'mono',    theme: 'dark',  presetTint: 'none'    },
        daylight:  { liquidGlass: false, accentColor: 'blue',    lyricsColor: 'white',   theme: 'light', presetTint: 'none'    },
        gold:      { liquidGlass: false, accentColor: 'gold',    lyricsColor: 'gold',    theme: 'dark',  presetTint: 'gold'    },
        midnight:  { liquidGlass: true,  accentColor: 'purple',  lyricsColor: 'purple',  theme: 'dark',  presetTint: 'purple'  },
        ocean:     { liquidGlass: false, accentColor: 'ocean',   lyricsColor: 'ocean',   theme: 'dark',  presetTint: 'ocean'   },
        emerald:   { liquidGlass: false, accentColor: 'emerald', lyricsColor: 'emerald', theme: 'dark',  presetTint: 'emerald' },
        crimson:   { liquidGlass: true,  accentColor: 'crimson', lyricsColor: 'crimson', theme: 'dark',  presetTint: 'crimson' },
        sunset:    { liquidGlass: false, accentColor: 'sunset',  lyricsColor: 'sunset',  theme: 'dark',  presetTint: 'sunset'  }
    };
    const p = presets[preset];
    if (!p) return;
    userProfile.liquidGlass = p.liquidGlass;
    userProfile.accentColor = p.accentColor;
    userProfile.lyricsColor = p.lyricsColor;
    userProfile.theme = p.theme;
    userProfile.presetTint = p.presetTint;
    userProfile.activePreset = preset;
    applyLiquidGlassTheme();
    applyThemePreference();
    applyIdentityUI(globalUser === 'admin' ? 'admin' : (userProfile.username || null));
    refreshActivePresetButton();
    saveDeviceSettings();
    syncProfile();
    showToast(`"${preset[0].toUpperCase() + preset.slice(1)}" theme applied`);
}
// Highlights whichever preset button matches the CURRENT combination of
// settings — including "none of them" if the user has since hand-picked an
// accent/lyrics-color/glass combo that no longer matches any preset exactly.
function refreshActivePresetButton() {
    document.querySelectorAll('.preset-theme-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === userProfile.activePreset));
}

function confirmClearSettings() {
    openConfirmModal("Reset settings?", "Data Saver, offline lyrics, Liquid Glass, and the theme/accent will go back to their defaults. Your liked songs, playlists, and downloads are not affected.", () => {
        userProfile.dataSaver = false;
        userProfile.dataSaverLevel = 'off';
        userProfile.downloadLyricsOffline = false;
        userProfile.liquidGlass = false;
        userProfile.theme = 'dark';
        userProfile.accentColor = 'orange';
        userProfile.lyricsColor = 'white';
        userProfile.presetTint = 'none';
        userProfile.activePreset = 'classic';
        applyLiquidGlassTheme();
        applyThemePreference();
        applyIdentityUI(globalUser === 'admin' ? 'admin' : (userProfile.username || null));
        refreshActivePresetButton();
        saveDeviceSettings();
        syncProfile();
        showToast("Settings reset to default", true);
    });
}

let profileSyncTimer = null;
// Cached alongside the server copy so playlists/likes are available the
// INSTANT the app opens — even fully offline, before (or instead of) the
// network login round-trip. Keyed per-account so switching users on the same
// device doesn't cross-contaminate data. (The 5 appearance/download settings
// above are handled separately via DEVICE_SETTINGS_KEY — see the comment on
// saveDeviceSettings — since those need to survive independently of login.)
function cacheProfileLocally() {
    if (!globalUser || globalUser === 'admin') return;
    try { localStorage.setItem('mouzika_profile_cache_' + globalUser, JSON.stringify(userProfile)); } catch (e) {}
}
function restoreProfileFromCache(username) {
    if (!username || username === 'admin') return false;
    try {
        const cached = localStorage.getItem('mouzika_profile_cache_' + username);
        if (!cached) return false;
        const parsed = JSON.parse(cached);
        if (!parsed || typeof parsed !== 'object') return false;
        userProfile = { ...userProfile, ...parsed };
        return true;
    } catch (e) { return false; }
}
let profileSaveErrorShown = false; // gates the "couldn't save" toast to once per outage, not once per action
function syncProfile() {
    populateLibraryUI();
    applyIdentityUI(globalUser === 'admin' ? 'admin' : (userProfile.username || null));
    if (!globalUser || globalUser === 'admin') return;
    cacheProfileLocally();
    // Debounced so rapid like/unlike doesn't spam the Worker (KV writes are slow)
    clearTimeout(profileSyncTimer);
    profileSyncTimer = setTimeout(() => {
        fetch(`${NEW_HUB_BACKEND}/api/save-profile`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userProfile)
        }).then(() => { profileSaveErrorShown = false; }) // back online / working again — a later outage should still get one fresh notice
          .catch(() => {
              if (profileSaveErrorShown) return; // already told the user this session — every play/like/etc. shouldn't re-announce it
              profileSaveErrorShown = true;
              showToast("Couldn't save to your profile — check the server", true);
          });
    }, 600);
}

/* =====================================================================
   SEARCH
===================================================================== */
const searchField = $('search-box-field');
let typeaheadTimer = null;
let suggestAbort = null;
let justSearched = false; // set right after a search runs — stops a late-arriving suggestion popping the box back open

// Whether the search field is idle (nothing typed): the genre browse grid only
// shows then, and steps aside once there's a query or results.
function setSearchIdle(isIdle) {
    const browse = $('search-browse'); if (browse) browse.style.display = isIdle ? '' : 'none';
}

searchField.addEventListener('input', function () {
    $('search-clear').style.display = this.value ? 'block' : 'none';
    justSearched = false; // the user is typing again — suggestions welcome once more
    setSearchIdle(!this.value.trim());
    handleLiveTyping(this.value);
});
searchField.addEventListener('focus', function () {
    if (!this.value.trim()) showSearchHistory();
});
function isVideoLink(str) {
    return /(?:music\.youtube\.com|youtube\.com|youtu\.be)\//i.test(str);
}

searchField.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(typeaheadTimer);
        if (suggestAbort) { suggestAbort.abort(); suggestAbort = null; } // kill any in-flight suggestion so it can't pop after we search
        justSearched = true;
        $('suggestions-box').style.display = "none";
        const q = this.value.trim();
        if (!q) return;
        currentSearchQuery = q;
        if (isVideoLink(q)) {
            resolveAndShowLinkResult(q);
        } else {
            rememberSearchTerm(q);
            executeSearch(q);
        }
    }
    if (e.key === 'Escape') $('suggestions-box').style.display = "none";
});
document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) $('suggestions-box').style.display = "none";
});

/* Old-website-style behavior: pasting a song link opens it directly
   instead of running a text search against it. */
async function resolveAndShowLinkResult(link) {
    const grid = $('search-output-grid');
    $('search-filters').style.display = "none";
    $('results-heading').style.display = "flex";
    $('artist-top-result').innerHTML = "";
    setSearchIdle(false);
    grid.innerHTML = skeletonCards(1);
    try {
        const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/resolve-video-proxy?url=${encodeURIComponent(link)}`, 10000);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.error) throw new Error(data?.error || "Couldn't open that link.");
        grid.innerHTML = createTrackCardHTML({ id: data.id, title: data.title, artist: data.artist, thumb: data.thumb, type: 'song' });
    } catch (e) {
        grid.innerHTML = `<p class="status-note err" style="grid-column:1/-1;">${escapeHtml(e.message || "Couldn't open that link.")}</p>`;
    }
}

function clearSearch() {
    searchField.value = ""; searchField.focus();
    $('search-clear').style.display = 'none';
    justSearched = false;
    setSearchIdle(true);
    showSearchHistory();
}

// Dedicated key for the search box's recent-terms list — kept separate from
// taste_profile_history (which holds played TRACK objects for recommendations)
// so search terms no longer pollute the taste/recently-played data.
function rememberSearchTerm(q) {
    q = String(q || '').trim();
    if (!q) return;
    let hist = JSON.parse(localStorage.getItem('recent_searches') || '[]');
    hist = hist.filter(t => t.toLowerCase() !== q.toLowerCase());
    hist.unshift(q);
    localStorage.setItem('recent_searches', JSON.stringify(hist.slice(0, 12)));
}

// Shown when the field is focused/empty and nothing's been typed yet — the last
// four searches, one tap away. Replaced by live suggestions the moment the user
// types, and suppressed right after a completed search.
function showSearchHistory() {
    if (justSearched) return;
    const box = $('suggestions-box');
    const hist = JSON.parse(localStorage.getItem('recent_searches') || '[]').slice(0, 4);
    if (!hist.length) { box.style.display = "none"; return; }
    box.innerHTML = "";
    hist.forEach(text => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `<i class="ri-history-line"></i>${escapeHtml(text)}`;
        div.onclick = () => selectSuggestion(text);
        box.appendChild(div);
    });
    box.style.display = "block";
}

function handleLiveTyping(val) {
    clearTimeout(typeaheadTimer);
    const box = $('suggestions-box');
    if (val.trim().length < 2) {
        if (!val.trim()) showSearchHistory(); else box.style.display = "none";
        return;
    }
    typeaheadTimer = setTimeout(async () => {
        try {
            if (suggestAbort) suggestAbort.abort();
            const ac = new AbortController();
            suggestAbort = ac;
            const res = await fetch(`${NEW_HUB_BACKEND}/api/suggestions-proxy?q=${encodeURIComponent(val)}`, { signal: ac.signal });
            const list = await res.json();
            if (suggestAbort !== ac) return; // a newer keystroke/search superseded this
            if (justSearched) return;        // the search already completed while this was in flight — don't pop it
            box.innerHTML = "";
            if (list && list.length > 0) {
                box.style.display = "block";
                list.slice(0, 6).forEach(text => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerHTML = `<i class="ri-search-line"></i>${escapeHtml(text)}`;
                    div.onclick = () => selectSuggestion(text);
                    box.appendChild(div);
                });
            } else box.style.display = "none";
        } catch (e) {}
    }, 220);
}

function selectSuggestion(text) {
    searchField.value = text;
    if (suggestAbort) { suggestAbort.abort(); suggestAbort = null; }
    justSearched = true;
    $('suggestions-box').style.display = "none";
    currentSearchQuery = text;
    rememberSearchTerm(text);
    executeSearch(text);
}

function setSearchFilter(filter) {
    currentSearchFilter = filter;
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    $(`pill-${filter}`).classList.add('active');
    if (currentSearchQuery) executeSearch(currentSearchQuery);
}

let searchToken = 0;
async function executeSearch(keyword, silentRound = 0) {
    const grid = $('search-output-grid');
    const myToken = silentRound === 0 ? ++searchToken : searchToken;
    if (silentRound === 0) {
        justSearched = true;
        if (suggestAbort) { suggestAbort.abort(); suggestAbort = null; }
        $('suggestions-box').style.display = "none";
        setSearchIdle(false);
        $('search-filters').style.display = "flex";
        $('results-heading').style.display = "flex";
        $('artist-top-result').innerHTML = "";
        grid.innerHTML = skeletonCards(8);
    }
    try {
        const apiFilter = currentSearchFilter === 'artist' ? 'artists' : currentSearchFilter;
        const results = await fetchJsonRetry(`${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(keyword)}&f=${apiFilter}`);
        if (myToken !== searchToken) return; // a newer search took over

        let items = Array.isArray(results) ? results : (results.items || results.contents || []);

        if (currentSearchFilter === 'playlist') {
            items = items.filter(t => t.type === 'playlist' || t.resultType === 'playlist' || String(t.id || t.playlistId || '').startsWith('PL') || String(t.id || t.playlistId || '').startsWith('RD'));
        }
        if (currentSearchFilter === 'song') {
            items = items.filter(t => (t.type || t.resultType || 'song') === 'song' || t.type === 'video' || t.videoId);
        }
        if (!items.length) throw new Error("empty");

        // Artist banner (All / Artists views)
        if (currentSearchFilter === 'all' || currentSearchFilter === 'artist') {
            const channel = items.find(it => (it.type === 'channel' || it.resultType === 'artist') && (it.name || it.title || it.artist));
            if (channel) {
                const cName = cleanTitle(channel);
                const cId = channel.id || channel.browseId;
                const artistObj = { id: cId, title: cName, artist: cName, thumb: getTrackThumbnail(channel), type: 'artist' };
                const openKey = regTrack(artistObj);
                const isFollowed = userProfile.favouriteArtists?.some(a => a.id === cId);
                const favKey = regTrack(artistObj);
                $('artist-top-result').innerHTML = `
                    <div class="collection-hero" style="align-items:center;">
                        <img class="hero-art round" src="${escapeHtml(getTrackThumbnail(channel))}" alt="" style="cursor:pointer;" data-act="open" data-key="${openKey}" onerror="this.style.display='none'">
                        <div class="hero-info">
                            <span class="kicker">Artist</span>
                            <h2 style="font-size:2.3rem; cursor:pointer;" data-act="open" data-key="${openKey}">${escapeHtml(cName)}</h2>
                            <div class="hero-actions">
                                <button class="btn-outline" data-act="fav" data-key="${favKey}">
                                    <i class="ri-heart-${isFollowed ? 'fill' : 'line'}" style="${isFollowed ? 'color:var(--accent);' : ''}"></i> ${isFollowed ? 'Following' : 'Follow'}
                                </button>
                            </div>
                        </div>
                    </div>`;
            }
        }

        grid.innerHTML = "";
        items.filter(it => it.type !== 'channel' && it.resultType !== 'artist')
            .forEach(it => { grid.insertAdjacentHTML('beforeend', createTrackCardHTML(normalizeTrack(it))); });
    } catch (e) {
        if (myToken !== searchToken) return;
        // Auto-retry a few rounds in the background before bothering the user with an error
        if (silentRound < 3) {
            grid.innerHTML = skeletonCards(8);
            await new Promise(r => setTimeout(r, 1000 + silentRound * 600));
            if (myToken !== searchToken) return;
            return executeSearch(keyword, silentRound + 1);
        }
        grid.innerHTML = `<p class="status-note err" style="grid-column:1/-1;">Nothing came back for "${escapeHtml(keyword)}". <span style="text-decoration:underline; cursor:pointer;" onclick="executeSearch(${JSON.stringify(keyword)})">Search again</span></p>`;
    }
}

/* =====================================================================
   COLLECTIONS (artist / playlist / library)
===================================================================== */
async function exploreArtistSongs(channelId, artistName, thumb = null) {
    switchPane('collection');
    const header = $('collection-header');
    const grid = $('collection-tracks-grid');
    grid.className = 'music-grid';
    const oldSugg = $('collection-suggest'); if (oldSugg) oldSugg.remove();
    const cleanName = cleanArtistName(artistName) === "Various Artists" ? String(artistName) : cleanArtistName(artistName);
    grid.innerHTML = skeletonCards(8);

    const artistObj = { id: channelId, title: cleanName, artist: cleanName, thumb: thumb || FALLBACK_ART, type: 'artist' };
    const favKey = regTrack(artistObj);
    const isFollowed = userProfile.favouriteArtists?.some(a => a.id === channelId);
    const avatar = thumb
        ? `<img class="hero-art round" src="${escapeHtml(thumb)}" alt="" onerror="this.outerHTML='<div class=&quot;hero-art round&quot;><i class=&quot;ri-user-3-fill&quot;></i></div>'">`
        : `<div class="hero-art round"><i class="ri-user-3-fill"></i></div>`;
    header.innerHTML = `
        ${avatar}
        <div class="hero-info">
            <span class="kicker">Artist</span>
            <h2>${escapeHtml(cleanName)}</h2>
            <div class="hero-actions">
                <button class="btn-play-big" onclick="playWholeCollection()"><i class="ri-play-fill"></i> Play</button>
                <button class="btn-outline" onclick="playShuffledCollection()"><i class="ri-shuffle-line"></i> Shuffle</button>
                <button class="btn-outline" data-act="fav" data-key="${favKey}">
                    <i class="ri-heart-${isFollowed ? 'fill' : 'line'}" style="${isFollowed ? 'color:var(--accent);' : ''}"></i> ${isFollowed ? 'Following' : 'Follow'}
                </button>
            </div>
        </div>`;
    try {
        let tracks = [];
        try {
            const channelData = await fetchJsonRetry(`${NEW_HUB_BACKEND}/api/channel-proxy?id=${encodeURIComponent(channelId)}`, 2);
            tracks = channelData.items || (Array.isArray(channelData) ? channelData : []);
        } catch (e) {}
        if (!tracks.length) {
            const fb = await fetchJsonRetry(`${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(cleanName)}&f=song`);
            tracks = (Array.isArray(fb) ? fb : (fb.items || [])).slice(0, 15);
        }
        if (!tracks.length) { grid.innerHTML = `<p class="status-note" style="grid-column:1/-1;">No tracks found for this artist.</p>`; return; }
        grid.innerHTML = ""; playbackQueue = [];
        tracks.forEach((t, i) => {
            const nt = { id: t.id || t.videoId, title: cleanTitle(t), artist: cleanName, thumb: getTrackThumbnail(t), type: 'song' };
            playbackQueue.push(nt);
            grid.insertAdjacentHTML('beforeend', createTrackCardHTML(nt, { queueIndex: i }));
        });
    } catch (e) { grid.innerHTML = `<p class="status-note err" style="grid-column:1/-1;">Couldn't load this artist right now. <span style="text-decoration:underline; cursor:pointer;" onclick="exploreArtistSongs('${channelId}', ${JSON.stringify(cleanName)}, ${JSON.stringify(thumb)})">Try again</span></p>`; }
}

async function explorePlaylistOrAlbumSongs(id, title, thumb = null, silentRound = 0) {
    if (silentRound === 0) switchPane('collection');
    const header = $('collection-header');
    const grid = $('collection-tracks-grid');
    const hasRealArt = thumb && thumb !== PLAYLIST_ART && thumb !== FALLBACK_ART;

    if (silentRound === 0) {
        grid.className = 'track-list';
        const oldSugg = $('collection-suggest'); if (oldSugg) oldSugg.remove();
        grid.innerHTML = skeletonRows(8);
        const isFav = userProfile.favouriteAlbums?.some(a => a.id === id);
        const favKey = regTrack({ id, title, artist: title, thumb: thumb || PLAYLIST_ART, type: 'playlist' });
        const art = hasRealArt
            ? `<img class="hero-art" id="collection-hero-img" src="${escapeHtml(thumb)}" alt="" onerror="this.outerHTML='<div class=&quot;hero-art&quot; id=&quot;collection-hero-img&quot;><i class=&quot;ri-play-list-2-line&quot;></i></div>'">`
            : `<div class="hero-art" id="collection-hero-img"><i class="ri-play-list-2-line"></i></div>`;
        header.innerHTML = `
            ${art}
            <div class="hero-info">
                <span class="kicker">Playlist</span>
                <h2>${escapeHtml(title)}</h2>
                <div class="hero-actions">
                    <button class="btn-play-big" onclick="playWholeCollection()"><i class="ri-play-fill"></i> Play</button>
                    <button class="btn-outline" onclick="playShuffledCollection()"><i class="ri-shuffle-line"></i> Shuffle</button>
                    <button class="btn-outline" data-act="fav" data-key="${favKey}">
                        <i class="ri-heart-${isFav ? 'fill' : 'line'}" style="${isFav ? 'color:var(--accent);' : ''}"></i> ${isFav ? 'Saved' : 'Save'}
                    </button>
                </div>
            </div>`;
    }
    try {
        // Same resolution trick as the old build: resolve playlist contents through search
        const res = await fetchJsonRetry(`${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(title + " playlist songs")}&f=song`);
        const items = (Array.isArray(res) ? res : (res.items || res.contents || [])).slice(0, 18);
        if (!items.length) throw new Error("empty");
        grid.innerHTML = ""; playbackQueue = [];
        items.forEach((t, i) => {
            const nt = normalizeTrack(t, 'song');
            playbackQueue.push(nt);
            grid.insertAdjacentHTML('beforeend', createTrackRowHTML(nt, { queueIndex: i }));
        });
        // No real cover art was available up front — borrow the first track's artwork instead of a bare icon
        if (!hasRealArt && playbackQueue[0]?.thumb) {
            const heroImg = $('collection-hero-img');
            if (heroImg) heroImg.outerHTML = `<img class="hero-art" id="collection-hero-img" src="${escapeHtml(playbackQueue[0].thumb)}" alt="" onerror="this.outerHTML='<div class=&quot;hero-art&quot;><i class=&quot;ri-play-list-2-line&quot;></i></div>'">`;
        }
    } catch (e) {
        if (silentRound < 3) {
            await new Promise(r => setTimeout(r, 1000 + silentRound * 600));
            return explorePlaylistOrAlbumSongs(id, title, thumb, silentRound + 1);
        }
        grid.innerHTML = `<p class="status-note err" style="grid-column:1/-1;">This playlist wouldn't resolve. <span style="text-decoration:underline; cursor:pointer;" onclick="explorePlaylistOrAlbumSongs(${JSON.stringify(id)}, ${JSON.stringify(title)}, ${JSON.stringify(thumb)})">Try again</span></p>`;
    }
}

async function openCollection(type, id = null) {
    switchPane('collection');
    const header = $('collection-header');
    const grid = $('collection-tracks-grid');
    grid.className = 'track-list';
    grid.innerHTML = ""; playbackQueue = [];
    const suggWrap = $('collection-suggest'); if (suggWrap) suggWrap.remove();

    if (type === 'liked') {
        const n = userProfile.likedSongs.length;
        header.innerHTML = `
            <div class="hero-art liked-grad"><i class="ri-heart-fill"></i></div>
            <div class="hero-info">
                <span class="kicker">Playlist</span><h2>Liked Songs</h2>
                <span class="sub">${n} track${n === 1 ? '' : 's'}</span>
                <div class="hero-actions"><button class="btn-play-big" onclick="playWholeCollection()"><i class="ri-play-fill"></i> Play</button>
                <button class="btn-outline" onclick="playShuffledCollection()"><i class="ri-shuffle-line"></i> Shuffle</button></div>
            </div>`;
        if (!n) { grid.innerHTML = `<p class="status-note" style="grid-column:1/-1;">Songs you like will show up here. Tap the heart on any track.</p>`; return; }
        userProfile.likedSongs.forEach((t, i) => {
            playbackQueue.push(t);
            grid.insertAdjacentHTML('beforeend', createTrackRowHTML(t, { collectionId: 'liked', queueIndex: i }));
        });
    } else if (type === 'downloads') {
        const all = await listDownloads();
        const totalSize = all.reduce((s, d) => s + (d.sizeBytes || 0), 0);
        const installNote = isInstalledStandalone()
            ? ''
            : `<p class="dl-progress-note"><i class="ri-information-line"></i> Add MOUZIKA to your home screen first — downloads kept in a regular browser tab are more likely to get cleared by the browser.</p>`;
        header.innerHTML = `
            <div class="hero-art" style="background:#000; color:var(--accent); display:flex; align-items:center; justify-content:center;"><i class="ri-download-2-fill"></i></div>
            <div class="hero-info">
                <span class="kicker">Playlist</span><h2>Downloaded</h2>
                <span class="sub">${all.length} track${all.length === 1 ? '' : 's'} · ${formatBytes(totalSize)}</span>
                <div class="hero-actions">
                    ${all.length ? `<button class="btn-play-big" onclick="playWholeCollection()"><i class="ri-play-fill"></i> Play</button>
                    <button class="btn-outline" onclick="playShuffledCollection()"><i class="ri-shuffle-line"></i> Shuffle</button>
                    <button class="btn-outline" onclick="confirmDeleteAllDownloads()"><i class="ri-delete-bin-line"></i> Delete all</button>` : ''}
                </div>
                ${installNote}
            </div>`;
        if (!all.length) { grid.innerHTML = `<p class="status-note" style="grid-column:1/-1;">Nothing downloaded yet. Use the download icon on any song, or the Download button on a playlist.</p>`; return; }
        all.forEach((d, i) => {
            const t = { id: d.id, title: d.title, artist: d.artist, thumb: d.thumbLowRes ? URL.createObjectURL(d.thumbLowRes) : null, type: 'song' };
            playbackQueue.push(t);
            grid.insertAdjacentHTML('beforeend', createTrackRowHTML(t, { collectionId: 'downloads', queueIndex: i }));
        });
    } else if (type === 'custom-playlist') {
        const pl = userProfile.customPlaylists.find(p => p.id === id);
        if (!pl) return;
        const coverSrc = pl.thumb || pl.tracks?.[0]?.thumb || null;
        const art = coverSrc
            ? `<img class="hero-art" src="${escapeHtml(coverSrc)}" alt="" onerror="this.outerHTML='<div class=&quot;hero-art&quot;><i class=&quot;ri-music-2-line&quot;></i></div>'">`
            : `<div class="hero-art"><i class="ri-music-2-line"></i></div>`;
        header.innerHTML = `
            <div class="hero-art-wrap">
                ${art}
                <button class="cover-edit-btn" title="Change cover" onclick="triggerPlaylistCoverUpload('${pl.id}')"><i class="ri-pencil-fill"></i></button>
            </div>
            <div class="hero-info">
                <span class="kicker">Playlist${pl.source ? ' · ' + escapeHtml(pl.source) : ''}</span><h2>${escapeHtml(pl.name)}</h2>
                <span class="sub">${pl.tracks.length} track${pl.tracks.length === 1 ? '' : 's'}</span>
                <div class="hero-actions">
                    <button class="btn-play-big" onclick="playWholeCollection()"><i class="ri-play-fill"></i> Play</button>
                    <button class="btn-outline" onclick="playShuffledCollection()"><i class="ri-shuffle-line"></i> Shuffle</button>
                    <button class="btn-outline" id="pl-download-btn" onclick="downloadPlaylistTracks(userProfile.customPlaylists.find(p => p.id === '${pl.id}')?.tracks, $('pl-download-btn'))"><i class="ri-download-2-line"></i> Download</button>
                    <button class="btn-outline" onclick="openAddLinkModal('${pl.id}')"><i class="ri-link"></i> Add by link</button>
                    <button class="btn-outline" onclick="removeCustomPlaylist('${pl.id}')"><i class="ri-delete-bin-line"></i> Delete</button>
                </div>
            </div>`;
        if (!pl.tracks.length) {
            grid.innerHTML = `<p class="status-note" style="grid-column:1/-1;">This playlist is empty. Add songs from the player, any card, or by pasting a link above.</p>`;
        } else {
            pl.tracks.forEach((t, i) => {
                playbackQueue.push(t);
                grid.insertAdjacentHTML('beforeend', createTrackRowHTML(t, { collectionId: id, queueIndex: i }));
            });
        }
        // Suggestions block (only for the user's own playlists)
        renderPlaylistSuggestions(id);
    }
}

/* =====================================================================
   LIBRARY RENDERING (main pane + sidebar)
===================================================================== */
function populateLibraryUI() {
    const libPls = $('library-playlists-grid');
    const libArtists = $('library-artists-grid');
    const sideList = $('sidebar-lib-list');

    const likedCount = userProfile.likedSongs?.length || 0;

    libPls.innerHTML = `
        <div class="track-card" onclick="openCollection('liked')">
            <div class="card-art-wrap"><div class="generic-cover" style="background:linear-gradient(135deg,var(--accent),#6b2600); color:#fff;"><i class="ri-heart-fill"></i></div></div>
            <h4>Liked Songs</h4><p>${likedCount} track${likedCount === 1 ? '' : 's'}</p>
        </div>
        <div class="track-card" onclick="openCollection('downloads')">
            <div class="card-art-wrap"><div class="generic-cover" style="background:linear-gradient(135deg,#2c2c2c,#000); color:var(--accent);"><i class="ri-download-2-fill"></i></div></div>
            <h4>Downloaded</h4><p id="downloads-count-label">…</p>
        </div>`;

    sideList.innerHTML = `
        <div class="side-lib-item" onclick="openCollection('liked')">
            <div class="thumb liked-grad"><i class="ri-heart-fill"></i></div>
            <div class="meta"><h5>Liked Songs</h5><p>Playlist · ${likedCount} tracks</p></div>
        </div>
        <div class="side-lib-item" onclick="openCollection('downloads')">
            <div class="thumb" style="background:#000; color:var(--accent); display:flex; align-items:center; justify-content:center;"><i class="ri-download-2-fill"></i></div>
            <div class="meta"><h5>Downloaded</h5><p id="downloads-count-label-side">…</p></div>
        </div>`;
    refreshDownloadsCountLabels();

    (userProfile.customPlaylists || []).forEach(pl => {
        const coverSrc = pl.thumb || pl.tracks?.[0]?.thumb || null;
        const art = coverSrc
            ? `<img src="${escapeHtml(coverSrc)}" loading="lazy" alt="" onerror="this.outerHTML='<div class=&quot;generic-cover&quot;><i class=&quot;ri-music-2-line&quot;></i></div>'">`
            : `<div class="generic-cover"><i class="ri-music-2-line"></i></div>`;
        const sourceBadge = pl.source ? `<span class="type-tag">${escapeHtml(pl.source)}</span>` : '';
        libPls.insertAdjacentHTML('beforeend', `
            <div class="track-card" onclick="openCollection('custom-playlist', '${pl.id}')">
                <div class="card-art-wrap">
                    ${art}
                    <div class="card-icons"><button class="icon-btn trash" onclick="event.stopPropagation(); removeCustomPlaylist('${pl.id}')" title="Delete playlist"><i class="ri-delete-bin-line"></i></button><span></span></div>
                </div>
                <h4>${escapeHtml(pl.name)}</h4><p>${sourceBadge}${pl.tracks.length} track${pl.tracks.length === 1 ? '' : 's'}</p>
            </div>`);
        sideList.insertAdjacentHTML('beforeend', `
            <div class="side-lib-item" onclick="openCollection('custom-playlist', '${pl.id}')">
                ${coverSrc ? `<img class="thumb" src="${escapeHtml(coverSrc)}" onerror="this.outerHTML='<div class=&quot;thumb&quot;><i class=&quot;ri-music-2-line&quot;></i></div>'">` : `<div class="thumb"><i class="ri-music-2-line"></i></div>`}
                <div class="meta"><h5>${escapeHtml(pl.name)}</h5><p>Playlist · ${pl.tracks.length} tracks</p></div>
            </div>`);
    });

    // External playlists/albums the user saved from search now live in the same shelf as custom ones
    (userProfile.favouriteAlbums || []).forEach(al => {
        libPls.insertAdjacentHTML('beforeend', createTrackCardHTML(al));
    });

    (userProfile.favouriteArtists || []).forEach(a => {
        sideList.insertAdjacentHTML('beforeend', `
            <div class="side-lib-item" data-act="open" data-key="${regTrack(a)}">
                <img class="thumb" src="${escapeHtml(a.thumb || '')}" style="border-radius:50%;" onerror="this.outerHTML='<div class=&quot;thumb&quot; style=&quot;border-radius:50%;&quot;><i class=&quot;ri-user-3-line&quot;></i></div>'">
                <div class="meta"><h5>${escapeHtml(a.title)}</h5><p>Artist</p></div>
            </div>`);
    });

    libArtists.innerHTML = (userProfile.favouriteArtists?.length)
        ? userProfile.favouriteArtists.map(a => createTrackCardHTML(a)).join('')
        : `<p class="status-note" style="grid-column:1/-1;">Artists you follow will show up here. Open any artist and tap follow.</p>`;
}

async function refreshDownloadsCountLabels() {
    try {
        const all = await listDownloads();
        const label = `${all.length} track${all.length === 1 ? '' : 's'} · ${formatBytes(all.reduce((s, d) => s + (d.sizeBytes || 0), 0))}`;
        const a = $('downloads-count-label'), b = $('downloads-count-label-side'), c = $('settings-downloads-size');
        if (a) a.textContent = label;
        if (b) b.textContent = `Playlist · ${label}`;
        if (c) c.textContent = label;
    } catch (e) {}
}

/* =====================================================================
   LIKES / SAVES
===================================================================== */
function toggleSaveItem(item, el = null) {
    if (!globalUser || globalUser === 'admin') { switchPane('account'); showToast("Log in to save music", true); return; }
    let list, label;
    if (item.type === 'artist') { list = userProfile.favouriteArtists; label = "artists"; }
    else if (item.type === 'playlist') { list = userProfile.favouriteAlbums; label = "playlists"; }
    else { list = userProfile.likedSongs; label = "Liked Songs"; }

    const idx = list.findIndex(x => x.id === item.id);
    const added = idx === -1;
    if (added) list.push(item); else list.splice(idx, 1);
    if (item.type !== 'artist' && item.type !== 'playlist') tasteEvent(added ? 'like' : 'unlike', item);

    if (el) {
        const icon = el.querySelector('i') || el;
        icon.className = `ri-heart-${added ? 'fill' : 'line'}`;
        icon.style.color = added ? 'var(--accent)' : '';
        el.classList.toggle('liked', added);
        // Buttons with a trailing label ("Follow"/"Save") get their text swapped too
        if (el.classList.contains('btn-outline')) {
            const words = item.type === 'artist' ? ['Follow', 'Following'] : ['Save', 'Saved'];
            const label = el.querySelector('i').nextSibling;
            const newText = ' ' + (added ? words[1] : words[0]);
            if (label && label.nodeType === Node.TEXT_NODE) label.textContent = newText;
            else el.appendChild(document.createTextNode(newText));
        }
    }
    if (activeTrackData && activeTrackData.id === item.id) refreshHeartIcons();
    showToast(added ? `Added to ${label}` : `Removed from ${label}`, !added);
    syncProfile();
}

function togglePlayerHeart(event) {
    if (event) event.stopPropagation();
    if (!activeTrackData) return;
    toggleSaveItem(activeTrackData);
}

function refreshHeartIcons() {
    const liked = activeTrackData && userProfile.likedSongs?.some(s => s.id === activeTrackData.id);
    ['pb-heart', 'mini-heart'].forEach(id => {
        const b = $(id); if (!b) return;
        b.classList.toggle('active', !!liked);
        b.innerHTML = `<i class="ri-heart-${liked ? 'fill' : 'line'}"></i>`;
    });
    const fs = $('fs-heart');
    fs.className = `ri-heart-${liked ? 'fill' : 'line'}${liked ? ' active' : ''}`;
}

/* =====================================================================
   PLAYER ENGINE
   Streams resolve exactly like the old build: fast-saavn first
   (aac.saavncdn.com 320kbps), then the Invidious mirrors in parallel.
   Fix: the mirror race now starts at the same time as the saavn lookup
   instead of after it fails, so fallback playback starts seconds sooner.
===================================================================== */
function setPlayIcons(state) { // 'play' | 'pause' | 'loading'
    const map = { play: 'ri-play-fill', pause: 'ri-pause-fill', loading: 'ri-loader-4-line animate-spin' };
    $('pb-play-icon').className = map[state];
    $('mini-play-icon').className = map[state];
    $('fs-play-icon').className = (state === 'play' ? 'ri-play-circle-fill' : state === 'pause' ? 'ri-pause-circle-fill' : 'ri-loader-4-line animate-spin') + ' fs-play';
}

function updateNowPlayingUI() {
    if (!activeTrackData) return;
    const t = activeTrackData;
    $('pb-title').textContent = t.title;   $('pb-artist').textContent = t.artist;
    $('mini-title').textContent = t.title; $('mini-artist').textContent = t.artist;
    $('fs-title').textContent = t.title;   $('fs-artist').textContent = t.artist;
    $('lyrics-head-title').textContent = t.title; $('lyrics-head-artist').textContent = t.artist;
    setNowPlayingArt(t);
    refreshHeartIcons();
    highlightActiveTrackCard();
    document.title = `${t.title} · ${t.artist} — MusicSpace`;
    if (videoModeActive) initYtPlayerForCurrentTrack();
}

// Same offline-thumb-first idea as handleThumbError, but for the persistent
// player-bar/mini-player/full-screen images: those elements are looked up by
// id and reused for every track (never replaced), so on failure this sets
// .src to a safe fallback instead of swapping outerHTML like the cards do.
function setNowPlayingArt(t) {
    ['pb-image', 'mini-image', 'fs-image'].forEach(id => {
        const img = $(id);
        if (!img) return;
        delete img.dataset.offlineTried;
        img.onerror = async () => {
            if (img.dataset.offlineTried) { img.onerror = null; img.src = FALLBACK_ART; return; }
            img.dataset.offlineTried = '1';
            if (isDownloaded(t.id)) {
                const url = await getOfflineThumbUrl(t.id);
                if (url) { img.src = url; return; }
            }
            img.onerror = null;
            img.src = FALLBACK_ART;
        };
        img.src = t.thumb || FALLBACK_ART;
    });
}

function highlightActiveTrackCard() {
    document.querySelectorAll('.track-card.playing').forEach(c => { c.classList.remove('playing'); c.querySelector('.eq-badge')?.remove(); });
    document.querySelectorAll('.track-row.playing').forEach(r => { r.classList.remove('playing'); r.querySelector('.row-eq')?.remove(); });
    if (activeTrackData?.id) {
        const id = CSS.escape(activeTrackData.id);
        document.querySelectorAll(`.track-card[data-id="${id}"]`).forEach(c => {
            c.classList.add('playing');
            if (!audioEngine.paused) c.querySelector('.card-art-wrap')?.insertAdjacentHTML('beforeend', '<div class="eq-badge"><span></span><span></span><span></span></div>');
        });
        document.querySelectorAll(`.track-row[data-id="${id}"]`).forEach(r => {
            r.classList.add('playing');
            // Row layout puts the badge right before the ⋮ menu button, matching
            // how createTrackRowHTML places it when a row is rendered fresh.
            if (!audioEngine.paused && !r.querySelector('.row-eq')) {
                const menuBtn = r.querySelector('.row-menu-btn');
                const badge = document.createElement('div');
                badge.className = 'row-eq';
                badge.innerHTML = '<span></span><span></span><span></span>';
                if (menuBtn) r.insertBefore(badge, menuBtn); else r.appendChild(badge);
            }
        });
    }
}

function updateMediaSession(t) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title, artist: t.artist,
        artwork: [{ src: t.thumb, sizes: '512x512', type: 'image/png' }, { src: t.thumb, sizes: '128x128', type: 'image/png' }]
    });
    navigator.mediaSession.setActionHandler('play', togglePlayback);
    navigator.mediaSession.setActionHandler('pause', togglePlayback);
    navigator.mediaSession.setActionHandler('nexttrack', playNextTrack);
    navigator.mediaSession.setActionHandler('previoustrack', playPrevTrack);
    try { navigator.mediaSession.setActionHandler('seekto', d => { if (d.seekTime != null) audioEngine.currentTime = d.seekTime; }); } catch (e) {}
}

function rememberListen(t) {
    // Never persist a blob: URL as an artwork reference. Those come from
    // URL.createObjectURL() on a downloaded track's offline copy — valid
    // only for the current browser session — so saving one into history
    // means the very next time the app opens, Recently Played is left
    // pointing at a link that no longer resolves to anything. Store null
    // instead; the card renderer resolves a fresh offline thumbnail by id
    // for any downloaded track at render time.
    const persistThumb = (t.thumb && t.thumb.startsWith('blob:')) ? null : t.thumb;
    let hist = JSON.parse(localStorage.getItem('taste_profile_history') || '[]');
    hist = hist.filter(x => x.id !== t.id);
    hist.unshift({ ...t, thumb: persistThumb, type: 'song' });
    localStorage.setItem('taste_profile_history', JSON.stringify(hist.slice(0, 15)));
    tasteEvent('play', t);
    // Account-based recently-played: mirror the listen onto the user's profile
    // (server-synced) so it follows them across devices, not just this browser.
    if (globalUser && globalUser !== 'admin') {
        const slim = { id: t.id, title: t.title, artist: t.artist, thumb: persistThumb, type: 'song' };
        userProfile.recentlyPlayed = [slim, ...(userProfile.recentlyPlayed || []).filter(x => x.id !== t.id)].slice(0, 30);
        syncProfile();
    }
    renderRecentlyPlayed();
}

/* =====================================================================
   TASTE PROFILE
   A lightweight per-device profile of what the listener actually enjoys,
   built from real signals instead of just "same artist as current song":
     +1  played a song            +2  listened to (almost) the end
     +3  liked / saved            -2  skipped early        -3  un-liked
   Scores are tracked per artist (and lightly per track) and used to pick
   suggestion seeds, rank candidates, and filter out artists the listener
   keeps skipping.
===================================================================== */
const TASTE_KEY = 'taste_profile_v2';
function loadTasteProfile() {
    try {
        const t = JSON.parse(localStorage.getItem(TASTE_KEY) || 'null');
        if (t && t.artists) return t;
    } catch (e) {}
    return { artists: {}, tracks: {} };
}
function saveTasteProfile(t) {
    try {
        // Keep it bounded: only the 120 strongest artist signals survive.
        const entries = Object.entries(t.artists);
        if (entries.length > 120) {
            entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
            t.artists = Object.fromEntries(entries.slice(0, 120));
        }
        const trackEntries = Object.entries(t.tracks);
        if (trackEntries.length > 200) t.tracks = Object.fromEntries(trackEntries.slice(-200));
        localStorage.setItem(TASTE_KEY, JSON.stringify(t));
    } catch (e) {}
}
function tasteArtistKey(artist) {
    // First credited artist, normalized — "A, B" and "A feat. B" both key on A.
    return cleanArtistName(artist).split(',')[0].split(/\bfeat\.?\b|\bft\.?\b/i)[0].trim().toLowerCase();
}
function tasteEvent(kind, track) {
    if (!track || !track.title) return;
    const weights = { play: 1, complete: 2, like: 3, skip: -2, unlike: -3 };
    const w = weights[kind]; if (!w) return;
    const t = loadTasteProfile();
    const aKey = tasteArtistKey(track.artist);
    if (aKey && aKey !== 'various artists') {
        t.artists[aKey] = Math.max(-12, Math.min(30, (t.artists[aKey] || 0) + w));
    }
    if (track.id) t.tracks[track.id] = Math.max(-6, Math.min(12, (t.tracks[track.id] || 0) + w));
    saveTasteProfile(t);
}
function tasteArtistScore(artist) {
    const t = loadTasteProfile();
    return t.artists[tasteArtistKey(artist)] || 0;
}
function tasteSkippedArtists() {
    const t = loadTasteProfile();
    return new Set(Object.keys(t.artists).filter(a => t.artists[a] <= -3));
}
/* Pick up to n seed tracks the listener demonstrably likes, from liked
   songs + listen history, weighted by artist affinity, one per artist. */
function tasteTopSeeds(n = 3, excludeId = null) {
    const hist = JSON.parse(localStorage.getItem('taste_profile_history') || '[]');
    const pool = [...(userProfile.likedSongs || []), ...hist]
        .filter(t => t && t.id && t.title && t.id !== excludeId);
    const skipped = tasteSkippedArtists();
    const scored = pool.map(t => ({
        t,
        score: tasteArtistScore(t.artist)
              + (userProfile.likedSongs?.some(s => s.id === t.id) ? 3 : 0)
              + Math.random() * 2.5   // keep it from being the same seeds every time
    })).filter(x => !skipped.has(tasteArtistKey(x.t.artist)));
    scored.sort((a, b) => b.score - a.score);
    const out = [], seenArtists = new Set();
    for (const { t } of scored) {
        const a = tasteArtistKey(t.artist);
        if (seenArtists.has(a)) continue;
        seenArtists.add(a);
        out.push(t);
        if (out.length >= n) break;
    }
    return out;
}

/* =====================================================================
   LYRICS — synced lyrics via LRCLIB (through the /api/lyrics-proxy Worker
   route), rendered in a dedicated overlay with line-by-line highlighting
   and click-to-seek. Falls back to plain (unsynced) text, then to a
   friendly "not found" message. Cached per title+artist for the session.
===================================================================== */
let lyricsCache = new Map();
let lyricsToken = 0;
let lyricsAbort = null;          // AbortController for the single in-flight lyrics request
let currentLyricsLines = null;   // array of {time, text} for synced, or a string for plain
let currentLyricsMode = 'none';  // 'loading' | 'synced' | 'plain' | 'none' | 'error'
let lastHighlightedLyricIndex = -1;

function parseLRC(lrcText) {
    const timeTag = /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;
    const out = [];
    lrcText.split(/\r?\n/).forEach(line => {
        const tags = [...line.matchAll(timeTag)];
        if (!tags.length) return;
        const text = line.replace(timeTag, '').trim();
        tags.forEach(m => out.push({ time: parseInt(m[1], 10) * 60 + parseFloat(m[2]), text }));
    });
    return out.sort((a, b) => a.time - b.time);
}

/* YouTube titles carry a lot of noise ("(Official Video)", "(Lyrics)",
   "[4K]", "- Official Audio"...) that a lyrics database won't recognize
   as part of the song name. Stripping it before querying meaningfully
   improves match rate. */
// Decode the handful of HTML entities YouTube titles actually contain.
function decodeHtmlEntities(s) {
    if (!s) return '';
    return String(s)
        .replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
}
const LYRICS_JUNK_WORDS = /\b(official|officiel|oficial|music|video|videoclip|audio|lyric[s]?|lyric\s*video|visuali[sz]er|mv|hd|hq|4k|8k|remaster(?:ed)?|explicit|clip|prod\.?|prod\s+by|color(?:ed)?\s*coded|sub\s*español|legendado)\b/gi;

// Turn a messy YouTube video title ("Sanfara ft. Nordo - Nbet Nhareb (Clip
// Officiel) | نبات نحارب") into the clean song title a lyrics API expects
// ("Nbet Nhareb"). This is the whole reason lyrics were failing: the raw
// title carried the artist, features, a "(Clip Officiel)" tag and an
// Arabic-script duplicate, so nothing ever matched.
function cleanTitleForLyrics(title) {
    if (!title) return '';
    let t = decodeHtmlEntities(String(title)).trim();
    // 1) If split by | • ·, keep the segment richest in Latin letters
    //    (usually the romanized song title, which is what LRCLIB/KPoe index).
    if (/[|•·]/.test(t)) {
        const segs = t.split(/\s*[|•·]\s*/).map(s => s.trim()).filter(Boolean);
        if (segs.length > 1) {
            const latin = segs.filter(s => /[a-z]/i.test(s));
            const pool = latin.length ? latin : segs;
            t = pool.sort((a, b) => b.replace(/[^a-z]/gi, '').length - a.replace(/[^a-z]/gi, '').length)[0];
        }
    }
    // 2) Drop bracketed groups: (Official Video), [Audio], {Prod. X}
    t = t.replace(/\s*[\(\[\{][^)\]\}]*[\)\]\}]\s*/g, ' ');
    // 3) "Artist - Title" -> keep the part after the first spaced dash
    const dash = t.split(/\s+[-–—]\s+/);
    if (dash.length >= 2) t = dash.slice(1).join(' - ');
    // 4) Cut featured clauses and strip leftover junk keywords
    t = t.replace(/\b(feat\.?|ft\.?|featuring)\b.*$/i, '')
         .replace(LYRICS_JUNK_WORDS, ' ')
         .replace(/["'"'']/g, '')
         .replace(/\s{2,}/g, ' ')
         .replace(/^[\s\-–—•·:]+|[\s\-–—•·:]+$/g, '')
         .trim();
    // Guard: if we over-trimmed to nothing, fall back to just bracket removal.
    if (t.length < 2) {
        t = decodeHtmlEntities(String(title)).replace(/\s*[\(\[\{][^)\]\}]*[\)\]\}]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    }
    return t;
}

// Derive the best artist string for a lyrics lookup. YouTube's channel name
// (track.artist) is often just the lead artist ("Sanfara"); the title's left
// side usually lists everyone ("Sanfara ft. Nordo" -> "Sanfara, Nordo"),
// which matches how these lyric DBs store the credit. Lyrics-only helper.
function deriveArtistForLyrics(rawTitle, rawArtist) {
    let artist = cleanArtistName(rawArtist);
    if (rawTitle && /\s+[-–—]\s+/.test(rawTitle)) {
        let left = decodeHtmlEntities(rawTitle.split(/\s+[-–—]\s+/)[0])
            .replace(/\s*[\(\[\{][^)\]\}]*[\)\]\}]\s*/g, ' ')
            .replace(/\s*\b(?:feat|ft|featuring)\b\.?\s*/gi, ', ')
            .replace(/\s*[x×&]\s*/gi, ', ')
            .replace(/\s{2,}/g, ' ').replace(/[,\s]+$/, '').trim();
        if (left && left.length <= 60) {
            const baseFirst = (artist || '').split(',')[0].trim().toLowerCase();
            if (!artist || artist === 'Various Artists' || (baseFirst && left.toLowerCase().includes(baseFirst))) {
                artist = left;
            }
        }
    }
    return (artist || 'Various Artists').replace(/\s*-\s*Topic$/i, '').trim();
}

async function loadLyricsForTrack(track, opts = {}) {
    // Back-compat: older call sites passed a bare boolean for "force".
    if (typeof opts === 'boolean') opts = { force: opts };
    const { force = false, userOpened = false } = opts;

    if (!track || !track.title) return;

    // Offline-first: if this track was downloaded with lyrics attached, use
    // those straight away — no network involved, works with no connection.
    if (isDownloaded(track.id)) {
        try {
            const record = await getDownload(track.id);
            if (record?.lyricsData) {
                currentLyricsMode = record.lyricsData.mode;
                currentLyricsLines = record.lyricsData.lines;
                renderLyricsOverlay();
                return;
            }
        } catch (e) { /* fall through to normal network lookup below */ }
    }

    const cleanTitle = cleanTitleForLyrics(track.title) || track.title;
    const cleanArtist = deriveArtistForLyrics(track.title, track.artist);
    const key = `${cleanTitle}|${cleanArtist}`.toLowerCase();
    const myToken = ++lyricsToken;

    // Cancel any request still in flight so it can't land late, double up, or
    // poison state. (Its catch sees AbortError and bails out cleanly.)
    if (lyricsAbort) { try { lyricsAbort.abort(); } catch (e) {} lyricsAbort = null; }

    if (force) lyricsCache.delete(key);

    if (lyricsCache.has(key)) {
        const cached = lyricsCache.get(key);
        const isMiss = cached.mode === 'none' || cached.mode === 'error';
        const stale = isMiss && (Date.now() - (cached.at || 0) > 3 * 60 * 1000);
        // If the user explicitly opened the panel and all we have cached is a
        // miss, give them a fresh attempt — the miss was very likely just a
        // momentarily rate-limited provider. Otherwise trust the cache.
        const refetchMiss = userOpened && isMiss;
        if (!stale && !refetchMiss) {
            currentLyricsMode = cached.mode;
            currentLyricsLines = cached.lines;
            renderLyricsOverlay();
            return;
        }
        lyricsCache.delete(key);
    }

    currentLyricsMode = 'loading';
    currentLyricsLines = null;
    renderLyricsOverlay();

    const ac = new AbortController();
    lyricsAbort = ac;
    const timeoutId = setTimeout(() => { try { ac.abort(); } catch (e) {} }, 20000);
    try {
        const durationParam = (audioEngine.duration && isFinite(audioEngine.duration)) ? `&duration=${Math.round(audioEngine.duration)}` : '';
        // Secondary title candidate for the worker to try if the primary misses:
        // brackets removed but NO artist/dash split and NO script preference — so
        // it covers cases where the aggressive clean guessed wrong (e.g. the real
        // title contains a dash, or the other-script side is the indexed one).
        const lightTitle = decodeHtmlEntities(track.title || '')
            .replace(/\s*[\(\[\{][^)\]\}]*[\)\]\}]\s*/g, ' ')
            .split(/\s*[|•·]\s*/).map(s => s.trim()).filter(Boolean).sort((a, b) => b.length - a.length)[0] || (track.title || '');
        const altParam = (lightTitle && lightTitle !== cleanTitle) ? `&alt=${encodeURIComponent(lightTitle)}` : '';
        // Plain channel/uploader artist (what we always used to send, before the
        // title-derived collab guess was added). Lyrics DBs often only credit the
        // billed/primary artist even when the video title lists a collab, so the
        // derived guess ("Drake, 21 Savage") can miss where the plain one
        // ("Drake") would've hit. Send both — the Worker tries both, no more
        // silently losing the fallback that used to work.
        const plainArtist = cleanArtistName(track.artist);
        const artist2Param = (plainArtist && plainArtist.toLowerCase() !== cleanArtist.toLowerCase()) ? `&artist2=${encodeURIComponent(plainArtist)}` : '';

        // ONE request only. The Worker already falls back internally (duration →
        // no-duration, LRCLIB → geeked.wtf → search), so a second client call
        // here just duplicated work and created the racing/cancelled requests.
        const res = await fetch(`${NEW_HUB_BACKEND}/api/lyrics-proxy?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}${durationParam}${altParam}${artist2Param}`, { signal: ac.signal });
        const data = await res.json();

        if (myToken !== lyricsToken) return; // a newer track/attempt already took over

        let mode = 'none', lines = null;
        if (data.found && data.synced) {
            const parsed = parseLRC(data.synced);
            if (parsed.length) { mode = 'synced'; lines = parsed; }
            else if (data.plain) { mode = 'plain'; lines = data.plain; }
        } else if (data.found && data.plain) {
            mode = 'plain'; lines = data.plain;
        }
        lyricsCache.set(key, { mode, lines, at: Date.now() });
        currentLyricsMode = mode;
        currentLyricsLines = lines;
        renderLyricsOverlay();
    } catch (e) {
        // Aborted (superseded by a new track / new attempt) is NOT a failure —
        // leave the UI and cache untouched so the newer attempt owns the state.
        if (e && e.name === 'AbortError') return;
        if (myToken !== lyricsToken) return;
        currentLyricsMode = 'error';
        currentLyricsLines = null;
        lyricsCache.set(key, { mode: 'error', lines: null, at: Date.now() });
        renderLyricsOverlay();
    } finally {
        clearTimeout(timeoutId);
        if (lyricsAbort === ac) lyricsAbort = null;
    }
}

function retryLyrics() {
    if (activeTrackData) loadLyricsForTrack(activeTrackData, { force: true });
}

function renderLyricsOverlay() {
    const body = $('lyrics-body');
    if (!body) return;
    lastHighlightedLyricIndex = -1;
    if (currentLyricsMode === 'loading') {
        body.innerHTML = `<p class="status-note" style="text-align:center; margin-top:60px;">Finding lyrics…</p>`;
    } else if (currentLyricsMode === 'error') {
        body.innerHTML = `<p class="status-note err" style="text-align:center; margin-top:60px;">Couldn't load lyrics right now.<br><span style="text-decoration:underline; cursor:pointer; color:#fff;" onclick="retryLyrics()">Try again</span></p>`;
    } else if (currentLyricsMode === 'plain' && currentLyricsLines) {
        body.innerHTML = `<pre class="lyrics-plain">${escapeHtml(currentLyricsLines)}</pre>`;
    } else if (currentLyricsMode === 'synced' && currentLyricsLines) {
        body.innerHTML = currentLyricsLines.map((l, i) => {
            const words = (l.text || '♪').split(/\s+/).filter(Boolean);
            const wordsHtml = words.map(w => `<span class="lyric-word">${escapeHtml(w)}</span>`).join(' ');
            const isRtl = /[\u0600-\u06FF\u0750-\u077F]/.test(l.text || ''); // Arabic/Arabic-supplement script
            return `<p class="lyric-line" dir="${isRtl ? 'rtl' : 'ltr'}" data-idx="${i}" onclick="seekToLyric(${i})">${wordsHtml}</p>`;
        }).join('');
        activeWordSpans = null;
    } else {
        body.innerHTML = `<p class="status-note" style="text-align:center; margin-top:60px;">No lyrics found for this song.<br><span style="text-decoration:underline; cursor:pointer; color:#fff;" onclick="retryLyrics()">Search again</span></p>`;
    }
}

function seekToLyric(i) {
    if (!Array.isArray(currentLyricsLines) || !currentLyricsLines[i]) return;
    if (!audioEngine.src && pendingResume) togglePlayback(); // resuming a restored session first
    audioEngine.currentTime = currentLyricsLines[i].time;
}

let activeWordSpans = null; // [{el, start, dur}] for the currently active line — driven each frame by lyricsWordFrame()

// Estimate a per-word start/duration inside a line by spreading the line's
// on-screen time proportionally across its words (weighted by word length,
// since LRCLIB only gives us line-level timestamps, not real word timing —
// this is the same estimation trick most lyric clones use to still get a
// convincing word-by-word wipe out of plain LRC data).
function computeActiveWordSpans(lineEl, line, nextTime) {
    const spans = Array.from(lineEl.querySelectorAll('.lyric-word'));
    if (!spans.length) return null;
    const weights = spans.map(s => Math.max(1, s.textContent.length));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const rawDur = (typeof nextTime === 'number' ? nextTime : line.time + 4) - line.time;
    // Cap so long instrumental gaps don't crawl forever — the wipe finishes
    // at a natural reading pace and the line just sits fully lit after that.
    const dur = Math.max(0.4, Math.min(rawDur, spans.length * 0.62 + 1.4));
    let cumulative = 0;
    return spans.map((el, i) => {
        const wStart = line.time + (cumulative / totalWeight) * dur;
        const wDur = (weights[i] / totalWeight) * dur;
        cumulative += weights[i];
        return { el, start: wStart, dur: wDur };
    });
}

function updateLyricsHighlight() {
    if (currentLyricsMode !== 'synced' || !Array.isArray(currentLyricsLines)) return;
    if (!$('lyrics-overlay').classList.contains('open')) return;
    const t = audioEngine.currentTime;
    let idx = -1;
    for (let i = 0; i < currentLyricsLines.length; i++) {
        if (currentLyricsLines[i].time <= t) idx = i; else break;
    }
    if (idx === lastHighlightedLyricIndex) return;
    lastHighlightedLyricIndex = idx;
    const body = $('lyrics-body');
    body.querySelectorAll('.lyric-line').forEach(el => {
        const i = +el.dataset.idx;
        el.classList.toggle('active', i === idx);
    });
    activeWordSpans = null;
    if (idx >= 0) {
        const el = body.querySelector(`.lyric-line[data-idx="${idx}"]`);
        if (el) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            activeWordSpans = computeActiveWordSpans(el, currentLyricsLines[idx], currentLyricsLines[idx + 1]?.time);
        }
    }
}

// Smooth per-frame wipe for the active line's words — timeupdate alone only
// fires a few times a second, too choppy for the karaoke gradient to feel
// synced to the words rather than just the sentence.
function lyricsWordFrame() {
    requestAnimationFrame(lyricsWordFrame);
    if (!activeWordSpans || currentLyricsMode !== 'synced') return;
    const overlay = $('lyrics-overlay');
    if (!overlay || !overlay.classList.contains('open')) return;
    const t = audioEngine.currentTime;
    for (const s of activeWordSpans) {
        const w = s.dur > 0 ? Math.min(1, Math.max(0, (t - s.start) / s.dur)) : (t >= s.start ? 1 : 0);
        s.el.style.setProperty('--w', w.toFixed(3));
    }
}
requestAnimationFrame(lyricsWordFrame);

function toggleLyricsOverlay() {
    if (!activeTrackData) { showToast("Play a song first", true); return; }
    const overlay = $('lyrics-overlay');
    overlay.classList.toggle('open');
    if (overlay.classList.contains('open')) {
        lastHighlightedLyricIndex = -1;
        // Guarantee an attempt whenever the panel is opened without lyrics on
        // screen. A cached miss or a half-finished attempt must NOT silently
        // show "no lyrics" — that was why the first tap seemed to do nothing.
        const haveLyrics = (currentLyricsMode === 'synced' || currentLyricsMode === 'plain') && currentLyricsLines;
        const alreadyLoading = currentLyricsMode === 'loading' && lyricsAbort; // an in-flight preload will fill it in
        if (!haveLyrics && !alreadyLoading) {
            loadLyricsForTrack(activeTrackData, { userOpened: true });
        }
        updateLyricsHighlight();
    } else {
        activeWordSpans = null;
    }
}
audioEngine.addEventListener('timeupdate', updateLyricsHighlight);

/* ---- "keep my place" session persistence ----
   Saves just enough to restore the player bar and progress position after a
   refresh: the track, its queue, loop/shuffle state, and playhead position.
   Restoring does NOT start network requests or audio — browsers block
   autoplay on load anyway — it just paints the UI so the song is sitting
   there ready, and the actual stream is resolved on the next Play tap. */
let lastSessionSaveAt = 0;
function saveSessionState(force = false) {
    if (!activeTrackData) return;
    const now = Date.now();
    if (!force && now - lastSessionSaveAt < 4000) return;
    lastSessionSaveAt = now;
    try {
        localStorage.setItem('hub_session_state', JSON.stringify({
            track: activeTrackData,
            queue: playbackQueue,
            queueIndex: currentQueueIndex,
            currentTime: audioEngine.currentTime || 0,
            isLooping: isLoopingActive,
            isShuffle: isShuffleActive
        }));
    } catch (e) {}
}

function restoreSessionState() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('hub_session_state') || 'null'); } catch (e) {}
    if (!saved || !saved.track || !saved.track.id) return;

    activeTrackData = saved.track;
    playbackQueue = Array.isArray(saved.queue) ? saved.queue : [];
    currentQueueIndex = typeof saved.queueIndex === 'number' ? saved.queueIndex : -1;
    isLoopingActive = !!saved.isLooping;
    isShuffleActive = !!saved.isShuffle;
    pendingResume = { track: activeTrackData, resumeAt: saved.currentTime || 0 };

    updateNowPlayingUI();
    setPlayIcons('play');
    loadLyricsForTrack(activeTrackData);

    $('pb-loop').classList.toggle('on', isLoopingActive);
    $('pb-loop-icon').className = isLoopingActive ? 'ri-repeat-one-line' : 'ri-repeat-line';
    $('fs-loop').classList.toggle('on', isLoopingActive);
    $('fs-loop').classList.toggle('ri-repeat-one-line', isLoopingActive);
    $('fs-loop').classList.toggle('ri-repeat-line', !isLoopingActive);
    $('pb-shuffle').classList.toggle('on', isShuffleActive);
    $('fs-shuffle').classList.toggle('on', isShuffleActive);

    if (saved.currentTime > 0) {
        const t = formatTime(saved.currentTime);
        $('pb-current-time').textContent = t;
        $('fs-current-time').textContent = t;
    }
}
window.addEventListener('beforeunload', () => saveSessionState(true));

/* ---- stream resolvers ----
   fast-saavn's search is a simple fuzzy title/artist match against their
   catalog, so a single "too rich" pairing (extra featured artists still
   attached, a YouTube channel name that isn't the real artist, a leftover
   dash fragment) can miss even when the song IS in their catalog — that's
   the "works for one song I retyped, fails for the others" pattern. Instead
   of sending one fixed pairing, try a short list of variants, most specific
   first, and take the first one that actually resolves. rawTitle/rawArtist
   (the untouched track fields, before any cleaning) are optional — pass
   them when available so the derived-artist variant (same logic already
   used for lyrics matching) can be built.
   NOTE: the API requires BOTH title and artist — an empty/missing one gets
   back the plain-text reply "Missing title or artist parameters", which
   doesn't contain the words "error"/"not found"/"results", so it used to
   slip past the old check and get treated as a real (bogus) track id. Every
   attempt below always sends a non-empty artist, and the success check now
   also requires res.ok plus a response shaped like an actual id (no spaces,
   no error-y words) instead of just an absence of specific phrases. */
async function resolveSaavnStream(title, artist, quality = '320', rawTitle = null, rawArtist = null) {
    const attempts = [];
    const seen = new Set();
    const add = (t, a) => {
        t = (t || '').trim(); a = (a || '').trim();
        if (!t || !a) return; // API 400s on a missing title or artist — never send either empty
        const key = `${t.toLowerCase()}|${a.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        attempts.push([t, a]);
    };

    add(title, artist);
    if (rawTitle) {
        try { add(title, deriveArtistForLyrics(rawTitle, rawArtist ?? artist)); } catch (e) {}
    }
    add(title, (artist || '').split(',')[0].trim()); // lead artist only, no featured names
    if (rawTitle && rawTitle !== title) add(cleanTitleForLyrics(rawTitle) || title, artist);
    if (rawArtist && rawArtist !== artist) add(title, cleanArtistName(rawArtist)); // raw/unstripped artist as a last resort

    const looksLikeSaavnId = (txt) => txt && txt.length >= 6 && txt.length <= 80 && !/\s/.test(txt) && !/error|not[\s_-]?found|missing|parameter|invalid|no\s*results?/i.test(txt);

    let lastErr = new Error("saavn miss");
    for (let i = 0; i < attempts.length; i++) {
        const [t, a] = attempts[i];
        try {
            const res = await fetchWithTimeout(`https://fast-saavn.vercel.app/api?title=${encodeURIComponent(t)}&artist=${encodeURIComponent(a)}`, i === 0 ? 9500 : 6000);
            if (!res.ok) { lastErr = new Error("HTTP " + res.status); continue; }
            const txt = (await res.text()).trim();
            if (looksLikeSaavnId(txt)) {
                return `https://aac.saavncdn.com/${txt}_${quality}.mp4`;
            }
            lastErr = new Error("saavn miss: " + txt.slice(0, 80));
        } catch (e) { lastErr = e; }
    }
    throw lastErr;
}

async function resolveMirrorStreams(id) {
    const settled = await Promise.allSettled(STREAM_MIRRORS.map(base =>
        fetchWithTimeout(base + id, 8500).then(async r => {
            if (!r.ok) throw new Error("bad");
            const j = await r.json();
            if (!j || !j.adaptiveFormats) throw new Error("no formats");
            const audio = j.adaptiveFormats.filter(f => f.type && f.type.startsWith('audio'));
            if (!audio.length) throw new Error("no audio");
            audio.sort((a, b) => parseInt(b.bitrate) - parseInt(a.bitrate));
            
            let streamUrl = audio[0].url;
            
            // The origin-rewrite below only makes sense for Invidious-style
            // mirrors, which proxy the actual media bytes through their own
            // domain at the same path/query — so pointing the <audio> tag at
            // "mirror origin + googlevideo path" works. Our own stream-proxy
            // endpoint (added above) is different: it hands back a real,
            // direct googlevideo.com URL meant to be used as-is (playback
            // doesn't need CORS, only reading raw bytes does), and doesn't
            // proxy media bytes itself — rewriting it here would point at a
            // path our worker doesn't serve and 404 instead of playing.
            const isOwnBackend = base.startsWith(NEW_HUB_BACKEND);
            try {
                if (!isOwnBackend) {
                    const mirrorUrl = new URL(base);
                    const parsedStream = new URL(streamUrl);
                    if (parsedStream.hostname.includes('googlevideo.com')) {
                        streamUrl = mirrorUrl.origin + parsedStream.pathname + parsedStream.search;
                    }
                }
            } catch(e) {}
            
            return streamUrl;
        })
    ));
    return settled.filter(r => r.status === 'fulfilled').map(r => r.value);
}

// Quickly checks whether a candidate stream URL actually starts buffering,
// using a separate throwaway <audio> probe. Browsers don't need CORS
// headers to buffer/play media (only to read its raw bytes via WebAudio or
// canvas) — so unlike a fetch()-based HEAD check, this doesn't get blocked
// by CORS against googlevideo.com / Invidious / Saavn's CDN, which don't
// send Access-Control-Allow-Origin for arbitrary sites.
function probeStreamPlayable(url, timeoutMs = 6000) {
    return new Promise(resolve => {
        const probe = new Audio();
        probe.preload = 'auto';
        probe.muted = true;
        probe.volume = 0;
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            probe.removeEventListener('canplay', onOk);
            probe.removeEventListener('loadedmetadata', onOk);
            probe.removeEventListener('error', onErr);
            probe.removeEventListener('stalled', onErr);
            clearTimeout(timer);
            try { probe.src = ''; probe.load(); } catch (e) {}
            resolve(ok ? url : null);
        };
        const onOk = () => finish(true);
        const onErr = () => finish(false);
        probe.addEventListener('canplay', onOk, { once: true });
        probe.addEventListener('loadedmetadata', onOk, { once: true });
        probe.addEventListener('error', onErr, { once: true });
        probe.addEventListener('stalled', onErr, { once: true });
        const timer = setTimeout(() => finish(false), timeoutMs);
        try { probe.src = url; probe.load(); } catch (e) { finish(false); }
    });
}

// Races every candidate's liveness probe AT ONCE instead of trying them one
// at a time against the real <audio> element with a full ~9s wait each —
// that sequential wait per dead link was the actual cause of the freezes.
// Whichever candidates prove playable get tried against the real audio
// element in the order they responded; if a "winner" turns out to be a
// false positive once real playback starts, this falls through to the next
// one instead of giving up (same safety net as before, just much faster).
async function tryPlayCandidates(candidates, myToken, resumeAt) {
    if (!candidates.length) return false;
    if (myToken !== playToken) return false;

    const ranked = await new Promise(resolveRanked => {
        const order = [];
        let remaining = candidates.length;
        candidates.forEach(url => {
            probeStreamPlayable(url).then(result => {
                if (result) order.push(result);
                remaining--;
                if (remaining === 0) resolveRanked(order);
            });
        });
    });

    // If literally none passed the probe, still try the original candidates
    // in order — a slow-but-real source beats giving up outright.
    const playOrder = ranked.length ? ranked : candidates;

    for (const url of playOrder) {
        if (myToken !== playToken) return false;
        const ok = await new Promise(resolve => {
            let settled = false;
            const finish = (result) => {
                if (settled) return;
                settled = true;
                audioEngine.removeEventListener('playing', onPlaying);
                audioEngine.removeEventListener('error', onError);
                audioEngine.removeEventListener('stalled', onError);
                clearTimeout(watchdog);
                resolve(result);
            };
            const onPlaying = () => finish(true);
            const onError = () => finish(false);
            // This candidate already proved it can buffer, so a much shorter
            // watchdog is enough here — no more stacked 9s waits per source.
            const watchdog = setTimeout(() => finish(false), 5000);

            audioEngine.addEventListener('playing', onPlaying, { once: true });
            audioEngine.addEventListener('error', onError, { once: true });
            audioEngine.addEventListener('stalled', onError, { once: true });

            audioEngine.pause();
            audioEngine.removeAttribute('src');
            audioEngine.load();
            audioEngine.src = url;

            if (resumeAt > 0) {
                const onMeta = () => { audioEngine.currentTime = resumeAt; audioEngine.removeEventListener('loadedmetadata', onMeta); };
                audioEngine.addEventListener('loadedmetadata', onMeta);
            }
            const p = audioEngine.play();
            if (p) p.catch(() => finish(false));
        });
        if (ok) return true;
    }
    return false;
}

async function initializeTrackStream(track, opts = {}) {
    if (!track || !track.id || !track.title) return;
    const { autoplay = true, resumeAt = 0, fromHistory = false } = opts;
    pendingResume = null; 
    
    // Reset prefetched track state
    hasPrefetchedNext = false;
    prefetchedNextTrack = null;
    let readyPrefetchedUrl = null;
    if (prefetchedQueueTrackId === track.id && prefetchedQueueUrl) readyPrefetchedUrl = prefetchedQueueUrl;
    prefetchedQueueTrackId = null;
    prefetchedQueueUrl = null;

    // Record the track we're LEAVING so Previous can return to it — unless we
    // got here BY walking back through history (fromHistory), which would
    // otherwise re-push it and make Previous loop in place.
    if (!fromHistory && activeTrackData && activeTrackData.id && activeTrackData.id !== track.id) {
        playedHistory.push({ ...activeTrackData });
        if (playedHistory.length > 60) playedHistory.shift();
    }

    const myToken = ++playToken;
    activeTrackData = { id: track.id, title: track.title, artist: track.artist, thumb: track.thumb };
    if (activeBlobUrl) { URL.revokeObjectURL(activeBlobUrl); activeBlobUrl = null; }

    updateNowPlayingUI();
    updateMediaSession(activeTrackData);
    rememberListen(activeTrackData);
    saveSessionState(true);
    loadLyricsForTrack(activeTrackData); 
    setPlayIcons('loading');

    audioEngine.pause();
    audioEngine.loop = isLoopingActive;

    // Offline-first: a downloaded track plays straight from IndexedDB, no
    // network involved at all, and skips the Saavn/mirror lookups entirely.
    if (isDownloaded(track.id)) {
        try {
            const record = await getDownload(track.id);
            if (record?.audioBlob) {
                activeBlobUrl = URL.createObjectURL(record.audioBlob);
                if (myToken !== playToken) return;
                if (!autoplay) {
                    audioEngine.src = activeBlobUrl;
                    if (resumeAt > 0) {
                        const onMeta = () => { audioEngine.currentTime = resumeAt; audioEngine.removeEventListener('loadedmetadata', onMeta); };
                        audioEngine.addEventListener('loadedmetadata', onMeta);
                    }
                    setPlayIcons('play');
                    return true;
                }
                const ok = await tryPlayCandidates([activeBlobUrl], myToken, resumeAt);
                if (myToken !== playToken) return false;
                if (!ok) { setPlayIcons('play'); showToast("Couldn't play the downloaded copy — try streaming it instead", true); }
                return ok;
            }
        } catch (e) { /* fall through to normal network resolution below */ }
    }

    const cleanedArtist = cleanArtistName(track.artist);
    const mirrorPromise = readyPrefetchedUrl ? Promise.resolve([]) : resolveMirrorStreams(track.id);
    mirrorPromise.catch(() => {});

    const candidates = [];
    if (readyPrefetchedUrl) candidates.push(readyPrefetchedUrl);

    if (myToken !== playToken) return;

    if (!readyPrefetchedUrl) {
        try { candidates.push(await resolveSaavnStream(cleanTitleForLyrics(track.title) || track.title, cleanedArtist, '320', track.title, track.artist)); } catch (e) {}
        if (myToken !== playToken) return;
    }

    try { candidates.push(...(await mirrorPromise)); } catch (e) {}
    if (myToken !== playToken) return;

    if (!candidates.length) {
        setPlayIcons('play');
        showToast("Couldn't stream this track — sources are down, try another", true);
        return false;
    }

    if (!autoplay) {
        audioEngine.src = candidates[0];
        if (resumeAt > 0) {
            const onMeta = () => { audioEngine.currentTime = resumeAt; audioEngine.removeEventListener('loadedmetadata', onMeta); };
            audioEngine.addEventListener('loadedmetadata', onMeta);
        }
        setPlayIcons('play');
        return true;
    }

    const ok = await tryPlayCandidates(candidates, myToken, resumeAt);
    if (myToken !== playToken) return false;
    if (!ok) {
        setPlayIcons('play');
        showToast(`Couldn't play this track — tried ${candidates.length} source${candidates.length === 1 ? '' : 's'}, all failed`, true);
    }
    return ok;
}

/* ---- queue logic ---- */
function playFromQueueContext(index) {
    if (index >= 0 && index < playbackQueue.length) {
        currentQueueIndex = index;
        initializeTrackStream(playbackQueue[index]);
    }
}
function playSingleAndQueueSimilar(track) {
    playbackQueue = []; currentQueueIndex = -1;
    initializeTrackStream(track);
}
function playWholeCollection() {
    if (!playbackQueue.length) return;
    currentQueueIndex = 0;
    initializeTrackStream(playbackQueue[0]);
}
function playShuffledCollection() {
    if (!playbackQueue.length) return;
    if (!isShuffleActive) toggleShuffle();
    currentQueueIndex = Math.floor(Math.random() * playbackQueue.length);
    initializeTrackStream(playbackQueue[currentQueueIndex]);
}
function playNextTrack(shuffleRetries = 0) {
    // Taste signal: leaving a song early is a skip; finishing (or nearly
    // finishing) it is a completion. Only counted once per advance.
    if (shuffleRetries === 0 && activeTrackData && isFinite(audioEngine.duration) && audioEngine.duration > 0) {
        const progress = audioEngine.currentTime / audioEngine.duration;
        if (progress >= 0.85) tasteEvent('complete', activeTrackData);
        else if (audioEngine.currentTime > 2 && progress < 0.4) tasteEvent('skip', activeTrackData);
    }
    if (playbackQueue.length > 0) {
        if (isShuffleActive) {
            if (shuffleRetries >= playbackQueue.length) { playNextAlgorithmSong(); return; }
            currentQueueIndex = Math.floor(Math.random() * playbackQueue.length);
            initializeTrackStream(playbackQueue[currentQueueIndex]).then(ok => { if (!ok) playNextTrack(shuffleRetries + 1); });
        } else if (currentQueueIndex < playbackQueue.length - 1) {
            currentQueueIndex++;
            initializeTrackStream(playbackQueue[currentQueueIndex]).then(ok => { if (!ok) playNextTrack(); });
        } else playNextAlgorithmSong();
    } else playNextAlgorithmSong();
}
function playPrevTrack() {
    // Spotify behavior: >3s into the song, Previous restarts it. Only a fresh
    // tap within the first 3s actually goes back a track.
    if (audioEngine.currentTime > 3) { audioEngine.currentTime = 0; return; }
    if (playedHistory.length > 0) {
        const prev = playedHistory.pop();
        // Keep the fixed-queue index in sync if that track is part of the
        // current album/playlist, so Next continues correctly from here.
        const qi = playbackQueue.findIndex(t => t.id === prev.id);
        if (qi >= 0) currentQueueIndex = qi;
        initializeTrackStream(prev, { fromHistory: true });
        return;
    }
    audioEngine.currentTime = 0; // nothing behind us this session — just restart
}

/* When a song ends (or Next is pressed with nothing queued) the app picks
   something to keep playing. */
let autoPlayHistory = []; 

async function gatherAlgorithmicCandidates(seedTrack) {
    const jobs = [
        fetchJsonRetry(`${NEW_HUB_BACKEND}/api/similar-proxy?title=${encodeURIComponent(seedTrack.title)}&artist=${encodeURIComponent(seedTrack.artist)}`, 2, 500).catch(() => [])
    ];
    // Seed from the taste profile: songs by artists the listener actually
    // rates, not a random grab from history.
    const altSeeds = tasteTopSeeds(2, seedTrack.id)
        .filter(t => tasteArtistKey(t.artist) !== tasteArtistKey(seedTrack.artist));
    altSeeds.forEach(altSeed => {
        jobs.push(fetchJsonRetry(`${NEW_HUB_BACKEND}/api/similar-proxy?title=${encodeURIComponent(altSeed.title)}&artist=${encodeURIComponent(altSeed.artist)}`, 2, 500).catch(() => []));
    });
    jobs.push(fetchJsonRetry(`${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(seedTrack.artist)}&f=song`, 2, 500).catch(() => []));

    const responses = await Promise.all(jobs);
    const skipped = tasteSkippedArtists();
    const recentIds = new Set(JSON.parse(localStorage.getItem('taste_profile_history') || '[]').slice(0, 6).map(t => t.id));
    const seen = new Set();
    const out = [];
    responses.forEach(r => {
        const arr = Array.isArray(r) ? r : (r.items || r.contents || []);
        arr.forEach(raw => {
            const t = normalizeTrack(raw, 'song');
            if (!t.id || !t.title) return;
            if (t.id === seedTrack.id || seen.has(t.id) || autoPlayHistory.includes(t.id)) return;
            if (recentIds.has(t.id)) return;                          // just played it
            if (skipped.has(tasteArtistKey(t.artist))) return;        // artist they keep skipping
            seen.add(t.id);
            out.push(t);
        });
    });
    return out;
}

function pickDiverseCandidate(candidates, seedTrack) {
    const seedArtist = tasteArtistKey(seedTrack.artist);
    const lastArtists = new Set(
        JSON.parse(localStorage.getItem('taste_profile_history') || '[]')
            .slice(0, 3).map(t => tasteArtistKey(t.artist))
    );
    // Weighted pick: taste affinity pulls a candidate up, repeating the same
    // artist (seed or the last few played) pulls it down — so it follows the
    // listener's vibe without turning into an artist-radio loop.
    const scored = candidates.map(c => {
        const aKey = tasteArtistKey(c.artist);
        let w = 3 + Math.max(-2, Math.min(8, tasteArtistScore(c.artist)));
        if (aKey === seedArtist) w -= 2.5;
        if (lastArtists.has(aKey)) w -= 1.5;
        return { c, w: Math.max(0.25, w) };
    });
    const total = scored.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    for (const x of scored) { r -= x.w; if (r <= 0) return x.c; }
    return scored.length ? scored[scored.length - 1].c : candidates[Math.floor(Math.random() * candidates.length)];
}

// Resolves (and stashes) the next queued track's stream URL ahead of time,
// so when it actually starts we can skip straight to playback instead of
// waiting on Saavn/mirror lookups right at the handoff moment.
async function prefetchQueueTrack(track) {
    if (!track || !track.id || prefetchedQueueTrackId === track.id) return;
    if (isDownloaded(track.id)) return; // already instant from IndexedDB, nothing to prefetch
    try {
        const cleanedArtist = cleanArtistName(track.artist);
        const url = await resolveSaavnStream(cleanTitleForLyrics(track.title) || track.title, cleanedArtist, '320', track.title, track.artist);
        prefetchedQueueTrackId = track.id;
        prefetchedQueueUrl = url;
    } catch (e) { /* mirror fallback still runs fresh at handoff time — no big loss */ }
}

async function prefetchNextAlgorithmSong() {
    if (!activeTrackData || prefetchedNextTrack) return;
    try {
        let pool = await gatherAlgorithmicCandidates(activeTrackData);
        if (pool.length) {
            prefetchedNextTrack = pickDiverseCandidate(pool, activeTrackData);
        }
    } catch(e) {}
}

async function playNextAlgorithmSong() {
    if (!activeTrackData) return;
    const seed = activeTrackData; 
    setPlayIcons('loading');
    try {
        let pool = [];
        let chosen = prefetchedNextTrack;
        
        // Reset prefetch states immediately for the new sequence
        prefetchedNextTrack = null;
        hasPrefetchedNext = false;

        if (!chosen) {
            pool = await gatherAlgorithmicCandidates(seed);
            if (!pool.length) { setPlayIcons('play'); showToast("Couldn't find a suggestion right now", true); return; }
        }

        let attempts = 0;
        while ((chosen || pool.length) && attempts < 4) {
            if (!chosen) {
                chosen = pickDiverseCandidate(pool, seed);
                pool = pool.filter(c => c.id !== chosen.id);
            }
            attempts++;

            autoPlayHistory.unshift(chosen.id);
            autoPlayHistory = autoPlayHistory.slice(0, 8);
            playbackQueue = []; currentQueueIndex = -1;

            const ok = await initializeTrackStream(chosen);
            if (ok) return;
            
            // if failed, prepare to loop again without current selection
            chosen = null;
        }
        setPlayIcons('play');
        showToast("Couldn't find a track that would actually play — try skipping again", true);
    } catch (e) { setPlayIcons('play'); }
}

function togglePlayback() {
    if (!audioEngine.src) {
        if (pendingResume) {
            const { track, resumeAt } = pendingResume;
            pendingResume = null;
            initializeTrackStream(track, { autoplay: true, resumeAt });
        }
        return;
    }
    if (audioEngine.paused) audioEngine.play().catch(() => {});
    else audioEngine.pause();
}
function toggleAudioLoop() {
    isLoopingActive = !isLoopingActive;
    audioEngine.loop = isLoopingActive;
    $('pb-loop').classList.toggle('on', isLoopingActive);
    $('pb-loop-icon').className = isLoopingActive ? 'ri-repeat-one-line' : 'ri-repeat-line';
    $('fs-loop').classList.toggle('on', isLoopingActive);
    $('fs-loop').classList.toggle('ri-repeat-one-line', isLoopingActive);
    $('fs-loop').classList.toggle('ri-repeat-line', !isLoopingActive);
    saveSessionState(true);
}
function toggleShuffle() {
    isShuffleActive = !isShuffleActive;
    $('pb-shuffle').classList.toggle('on', isShuffleActive);
    $('fs-shuffle').classList.toggle('on', isShuffleActive);
    saveSessionState(true);
}
function toggleFullScreenPlayer() {
    const overlay = $('full-player-overlay');
    const wasActive = overlay.classList.contains('active');
    overlay.classList.toggle('active');
    if (wasActive && landscapeModeActive) exitLandscapeFullscreen();
}

/* ============ VIDEO MODE ============
   A chromeless, muted YouTube iframe (same video id as the audio track,
   since that id IS the YouTube video id already) laid over the album art.
   It never provides sound — audioEngine stays the single source of audio —
   it's just kept in step with it, so seeking/pausing the audio drives the
   video too. */
let ytPlayer = null;
let ytApiReady = false;
let ytApiLoading = false;
let videoModeActive = false;
let ytSyncInterval = null;

function loadYouTubeIframeAPI() {
    if (window.YT && window.YT.Player) { ytApiReady = true; return; }
    if (ytApiLoading) return;
    ytApiLoading = true;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
}
window.onYouTubeIframeAPIReady = function () {
    ytApiReady = true;
    if (videoModeActive && activeTrackData) initYtPlayerForCurrentTrack();
};

function initYtPlayerForCurrentTrack() {
    if (!activeTrackData || !activeTrackData.id) return;
    if (!ytApiReady) { loadYouTubeIframeAPI(); return; }
    if (ytPlayer && ytPlayer.loadVideoById) {
        try { ytPlayer.loadVideoById(activeTrackData.id); ytPlayer.mute(); } catch (e) {}
        return;
    }
    if (ytPlayer) return; // already constructing
    ytPlayer = new YT.Player('yt-video-player', {
        videoId: activeTrackData.id,
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, fs: 0, iv_load_policy: 3, playsinline: 1, mute: 1 },
        events: {
            onReady: (e) => { e.target.mute(); populateQualityOptions(); startVideoSyncLoop(); },
            onStateChange: () => { try { ytPlayer.mute(); } catch (e) {} }
        }
    });
}

function startVideoSyncLoop() {
    clearInterval(ytSyncInterval);
    ytSyncInterval = setInterval(() => {
        if (!videoModeActive || !ytPlayer || !ytPlayer.getCurrentTime || typeof ytPlayer.getPlayerState !== 'function') return;
        try {
            const audioT = audioEngine.currentTime;
            const videoT = ytPlayer.getCurrentTime();
            if (Math.abs(audioT - videoT) > 0.4) ytPlayer.seekTo(audioT, true);
            const state = ytPlayer.getPlayerState();
            if (audioEngine.paused) { if (state === YT.PlayerState.PLAYING) ytPlayer.pauseVideo(); }
            else { if (state !== YT.PlayerState.PLAYING) ytPlayer.playVideo(); }
        } catch (e) {}
    }, 500);
}

function toggleVideoMode() {
    if (!activeTrackData) { showToast("Play a song first", true); return; }
    videoModeActive = !videoModeActive;
    $('fs-video-toggle').classList.toggle('on', videoModeActive);
    $('fs-video-wrap').classList.toggle('active', videoModeActive);
    $('fs-art-wrap').classList.toggle('video-active', videoModeActive);
    $('fs-quality-wrap').style.display = videoModeActive ? 'flex' : 'none';
    if (videoModeActive) {
        loadYouTubeIframeAPI();
        if (ytApiReady) initYtPlayerForCurrentTrack();
    } else {
        clearInterval(ytSyncInterval);
        if (ytPlayer && ytPlayer.pauseVideo) { try { ytPlayer.pauseVideo(); } catch (e) {} }
        $('fs-quality-popup').classList.remove('open');
    }
}

const YT_QUALITY_LABELS = { hd2160: '2160p (4K)', hd1440: '1440p', hd1080: '1080p', hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p', auto: 'Auto' };
function populateQualityOptions() {
    if (!ytPlayer || !ytPlayer.getAvailableQualityLevels) return;
    const box = $('fs-quality-popup');
    const levels = ytPlayer.getAvailableQualityLevels() || [];
    if (!levels.length) { box.innerHTML = '<div class="quality-title">Video quality</div><button disabled>Auto</button>'; return; }
    const current = ytPlayer.getPlaybackQuality ? ytPlayer.getPlaybackQuality() : null;
    box.innerHTML = '<div class="quality-title">Video quality</div>' + levels.map(l =>
        `<button data-q="${l}" class="${l === current ? 'active' : ''}" onclick="setVideoQuality('${l}')">${YT_QUALITY_LABELS[l] || l}</button>`
    ).join('');
}
function setVideoQuality(level) {
    if (!ytPlayer) return;
    try { ytPlayer.setPlaybackQuality(level); } catch (e) {}
    $('fs-quality-popup').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.q === level));
    $('fs-quality-popup').classList.remove('open');
}
function toggleQualityPopup(e) {
    e.stopPropagation();
    $('fs-quality-popup').classList.toggle('open');
}
document.addEventListener('click', e => {
    if (!e.target.closest('.fs-quality-wrap')) { const p = $('fs-quality-popup'); if (p) p.classList.remove('open'); }
});

/* ============ FULL-SCREEN LANDSCAPE VIEW ============
   Locks the device to landscape via the Screen Orientation API and puts the
   now-playing overlay into a desktop-style horizontal layout (art on one
   side, transport on the other). The orientation lock is best-effort — it's
   only available on some mobile browsers and typically requires the page to
   already be in the Fullscreen API's fullscreen state — so this also falls
   back to a CSS `orientation: landscape` media query that kicks in whenever
   the phone is physically turned sideways, lock or no lock. */
let landscapeModeActive = false;
async function toggleLandscapeFullscreen() {
    if (landscapeModeActive) { exitLandscapeFullscreen(); return; }
    const overlay = $('full-player-overlay');
    try {
        if (overlay.requestFullscreen) await overlay.requestFullscreen();
        else if (overlay.webkitRequestFullscreen) overlay.webkitRequestFullscreen();
    } catch (e) { /* fullscreen denied/unsupported — CSS orientation query still applies the layout */ }
    try {
        if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch (e) { /* lock unsupported/blocked on this device */ }
    overlay.classList.add('landscape-mode');
    landscapeModeActive = true;
    $('fs-landscape-btn').classList.add('on');
}
function exitLandscapeFullscreen() {
    landscapeModeActive = false;
    $('fs-landscape-btn').classList.remove('on');
    $('full-player-overlay').classList.remove('landscape-mode');
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
}
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && landscapeModeActive) exitLandscapeFullscreen();
});

/* ============ LISTEN TO IDENTIFY (Shazam-style, via AudD.io) ============
   Records a short mic sample and sends it to AudD's recognition API.
   Get a free API token at https://dashboard.audd.io and paste it below —
   without one this clearly tells the person to add it, instead of silently
   failing. */
const AUDD_API_TOKEN = "YOUR_AUDD_API_TOKEN"; // <-- put your AudD.io token here
let listenMediaRecorder = null;
let listenChunks = [];
let listenStream = null;

async function openAudioRecognition() {
    $('audio-recognition-modal').classList.add('open');
    const pulse = $('listen-pulse');
    pulse.className = 'listen-pulse';
    pulse.innerHTML = '<i class="ri-mic-fill"></i>';
    $('listen-status-title').textContent = 'Listening…';
    const sub = $('listen-status-sub');
    sub.style.display = 'block';
    sub.textContent = 'Hold your phone near the music source';
    const box = $('listen-result-box');
    box.style.display = 'none'; box.innerHTML = '';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        failAudioRecognition("Microphone access isn't supported in this browser.");
        return;
    }
    try {
        listenStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
        failAudioRecognition("Microphone permission was denied.");
        return;
    }
    listenChunks = [];
    let mimeType = '';
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
    try {
        listenMediaRecorder = new MediaRecorder(listenStream, mimeType ? { mimeType } : undefined);
    } catch (e) {
        failAudioRecognition("Recording isn't supported on this device.");
        if (listenStream) { listenStream.getTracks().forEach(t => t.stop()); listenStream = null; }
        return;
    }
    listenMediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) listenChunks.push(e.data); };
    listenMediaRecorder.onstop = onListenRecordingStop;
    listenMediaRecorder.start();
    setTimeout(() => { if (listenMediaRecorder && listenMediaRecorder.state === 'recording') listenMediaRecorder.stop(); }, 6000);
}

function closeAudioRecognitionModal() {
    $('audio-recognition-modal').classList.remove('open');
    if (listenMediaRecorder && listenMediaRecorder.state === 'recording') { try { listenMediaRecorder.stop(); } catch (e) {} }
    if (listenStream) { listenStream.getTracks().forEach(t => t.stop()); listenStream = null; }
}

async function onListenRecordingStop() {
    if (listenStream) { listenStream.getTracks().forEach(t => t.stop()); listenStream = null; }
    if (!$('audio-recognition-modal').classList.contains('open')) return; // cancelled mid-recording
    const pulse = $('listen-pulse');
    pulse.classList.add('thinking');
    pulse.innerHTML = '<i class="ri-loader-4-line"></i>';
    $('listen-status-title').textContent = 'Identifying…';
    $('listen-status-sub').textContent = "Matching against AudD's catalog";

    if (!listenChunks.length) { failAudioRecognition("Didn't catch any audio — try again closer to the source."); return; }
    if (!AUDD_API_TOKEN || AUDD_API_TOKEN === "YOUR_AUDD_API_TOKEN") {
        failAudioRecognition("Add your AudD.io API token in script.js (AUDD_API_TOKEN) to enable recognition.");
        return;
    }
    try {
        const blob = new Blob(listenChunks, { type: listenChunks[0].type || 'audio/webm' });
        const form = new FormData();
        form.append('api_token', AUDD_API_TOKEN);
        form.append('file', blob, 'sample.webm');
        form.append('return', 'spotify');
        const res = await fetchWithTimeout('https://api.audd.io/', 15000, { method: 'POST', body: form });
        const data = await res.json();
        if (data && data.status === 'success' && data.result) {
            showAudioRecognitionResult(data.result);
        } else {
            failAudioRecognition("Couldn't recognize that — try getting closer to the speaker.");
        }
    } catch (e) {
        failAudioRecognition("Recognition service is unreachable right now.");
    }
}

function failAudioRecognition(msg) {
    const pulse = $('listen-pulse');
    pulse.className = 'listen-pulse err';
    pulse.innerHTML = '<i class="ri-error-warning-line"></i>';
    $('listen-status-title').textContent = "No match";
    $('listen-status-sub').textContent = msg;
}

function showAudioRecognitionResult(result) {
    const pulse = $('listen-pulse');
    pulse.className = 'listen-pulse done';
    pulse.innerHTML = '<i class="ri-check-line"></i>';
    $('listen-status-title').textContent = 'Got it!';
    $('listen-status-sub').style.display = 'none';
    const box = $('listen-result-box');
    box.style.display = 'block';
    const title = result.title || 'Unknown title';
    const artist = result.artist || 'Unknown artist';
    box.innerHTML = `<div class="listen-result-card" onclick="searchAndPlayRecognized(${JSON.stringify(title)}, ${JSON.stringify(artist)})">
        <div class="listen-result-meta"><h5>${escapeHtml(title)}</h5><p>${escapeHtml(artist)}</p></div>
        <i class="ri-play-circle-fill"></i>
    </div>`;
}

function searchAndPlayRecognized(title, artist) {
    closeAudioRecognitionModal();
    switchPane('search');
    const q = `${title} ${artist}`.trim();
    $('search-box-field').value = q;
    executeSearch(q);
}

function paintSlider(slider, pct) {
    slider.value = pct;
    if (slider.classList.contains('vertical')) {
        slider.style.background = `linear-gradient(to top, var(--accent) ${pct}%, #4d4d4d ${pct}%)`;
    } else {
        slider.style.background = `linear-gradient(to right, var(--accent) ${pct}%, #4d4d4d ${pct}%)`;
    }
}
let userIsScrubbing = false;

function updateProgressUI() {
    const dur = audioEngine.duration;
    const cur = audioEngine.currentTime;
    const curTxt = formatTime(cur);
    $('pb-current-time').textContent = curTxt;
    $('fs-current-time').textContent = curTxt;
    if (isNaN(dur) || !isFinite(dur)) {
        $('pb-total-duration').textContent = "–:––";
        $('fs-total-duration').textContent = "–:––";
        return;
    }
    $('pb-total-duration').textContent = formatTime(dur);
    $('fs-total-duration').textContent = formatTime(dur);
    if (!userIsScrubbing) {
        const pct = (cur / dur) * 100;
        paintSlider($('pb-seek'), pct);
        paintSlider($('fs-seek'), pct);
        $('mini-progress-fill').style.width = pct + "%";

        // Prefetch ~10s before this track ends, so the handoff to the next
        // one is instant instead of waiting on the network right at the end.
        // A fixed time window (not a percentage) means it triggers at the same
        // "10 seconds left" point whether the song is 2 minutes or 8.
        if (!hasPrefetchedNext && !isLoopingActive && dur > 20 && (dur - cur) <= 10) {
            hasPrefetchedNext = true;
            if (!isShuffleActive && playbackQueue.length > 0 && currentQueueIndex < playbackQueue.length - 1) {
                // There's an actual next track queued (playlist/album/search results) —
                // resolve its stream now instead of waiting for it to start.
                prefetchQueueTrack(playbackQueue[currentQueueIndex + 1]);
            } else if (playbackQueue.length === 0 || currentQueueIndex >= playbackQueue.length - 1) {
                // Nothing queued next — fall back to the algorithmic pick, same as before.
                if (!isShuffleActive) prefetchNextAlgorithmSong();
            }
        }
    }
}
audioEngine.addEventListener('timeupdate', updateProgressUI);
audioEngine.addEventListener('timeupdate', () => saveSessionState(false));
audioEngine.addEventListener('loadedmetadata', updateProgressUI);
audioEngine.addEventListener('play', () => setPlayIcons('pause'));
audioEngine.addEventListener('pause', () => { setPlayIcons('play'); saveSessionState(true); });
audioEngine.addEventListener('waiting', () => setPlayIcons('loading'));
audioEngine.addEventListener('playing', () => setPlayIcons('pause'));
audioEngine.addEventListener('ended', () => {
    if (isLoopingActive) { audioEngine.currentTime = 0; audioEngine.play(); }
    else playNextTrack();
});

['pb-seek', 'fs-seek'].forEach(id => {
    const s = $(id);
    s.addEventListener('input', () => {
        userIsScrubbing = true;
        paintSlider(s, s.value);
        if (!isNaN(audioEngine.duration) && isFinite(audioEngine.duration)) {
            $('pb-current-time').textContent = formatTime((s.value / 100) * audioEngine.duration);
            $('fs-current-time').textContent = formatTime((s.value / 100) * audioEngine.duration);
        }
    });
    s.addEventListener('change', () => {
        userIsScrubbing = false;
        if (!audioEngine.src || isNaN(audioEngine.duration) || !isFinite(audioEngine.duration)) return;
        audioEngine.currentTime = (s.value / 100) * audioEngine.duration;
    });
});

const volSlider = $('volume-slider');
const fsVolSlider = $('fs-volume-slider');
function applyVolume(val, save = true) {
    val = Math.max(0, Math.min(100, Number(val)));
    audioEngine.volume = val / 100;
    paintSlider(volSlider, val);
    paintSlider(fsVolSlider, val);
    $('vol-pct').textContent = val + "%";
    $('fs-vol-pct').textContent = val + "%";
    const iconClass = val === 0 ? 'ri-volume-mute-line' : val < 50 ? 'ri-volume-down-line' : 'ri-volume-up-line';
    $('vol-icon').className = iconClass;
    $('fs-vol-icon').className = iconClass;
    if (save) localStorage.setItem('hub_volume', String(val));
}
volSlider.addEventListener('input', () => applyVolume(volSlider.value));
fsVolSlider.addEventListener('input', () => applyVolume(fsVolSlider.value));
function toggleMute() {
    const cur = Math.round(audioEngine.volume * 100);
    if (cur > 0) { lastVolumeBeforeMute = cur; applyVolume(0); }
    else applyVolume(lastVolumeBeforeMute || 50);
}

function toggleFsVolumePopup(event) {
    if (event) event.stopPropagation();
    $('fs-vol-popup').classList.toggle('open');
}
document.addEventListener('click', e => {
    if (!e.target.closest('.fs-vol-wrap')) $('fs-vol-popup').classList.remove('open');
});

/* ---------- Quick seek ±10s ---------- */
function seekBy(delta) {
    if (!audioEngine.src || isNaN(audioEngine.duration)) return;
    const dur = audioEngine.duration;
    let t = (audioEngine.currentTime || 0) + delta;
    t = Math.max(0, t);
    if (isFinite(dur)) t = Math.min(dur - 0.25, t);
    audioEngine.currentTime = t;
    updateProgressUI();
}

/* ---------- Sleep timer ---------- */
let sleepTimerId = null, sleepTimerEnd = 0, sleepBadgeInterval = null, sleepEndOfTrack = false;
function toggleSleepMenu(event) {
    if (event) event.stopPropagation();
    $('fs-sleep-popup').classList.toggle('open');
}
function markSleepChoice(label) {
    document.querySelectorAll('#fs-sleep-popup button').forEach(b => {
        b.classList.toggle('active-choice', !!label && b.textContent.trim() === label);
    });
}
function setSleepTimer(minutes) {
    cancelSleepTimer(false);
    sleepTimerEnd = Date.now() + minutes * 60000;
    sleepTimerId = setTimeout(fireSleepTimer, minutes * 60000);
    $('fs-sleep-icon').classList.add('on');
    startSleepBadge();
    markSleepChoice(minutes === 60 ? '1 hour' : `${minutes} minutes`);
    $('fs-sleep-popup').classList.remove('open');
    showToast(`Sleep timer: ${minutes === 60 ? '1 hour' : minutes + ' min'}`, true);
}
function setSleepTimerEndOfTrack() {
    cancelSleepTimer(false);
    sleepEndOfTrack = true;
    $('fs-sleep-icon').classList.add('on');
    const badge = $('fs-sleep-badge');
    badge.textContent = '♪'; badge.classList.add('show');
    markSleepChoice('End of song');
    $('fs-sleep-popup').classList.remove('open');
    showToast('Sleep at end of song', true);
}
function fireSleepTimer() {
    try { audioEngine.pause(); } catch (e) {}
    cancelSleepTimer(false);
    showToast('Sleep timer ended', true);
}
function cancelSleepTimer(userAction) {
    if (sleepTimerId) { clearTimeout(sleepTimerId); sleepTimerId = null; }
    if (sleepBadgeInterval) { clearInterval(sleepBadgeInterval); sleepBadgeInterval = null; }
    sleepTimerEnd = 0; sleepEndOfTrack = false;
    const icon = $('fs-sleep-icon'); if (icon) icon.classList.remove('on');
    const badge = $('fs-sleep-badge'); if (badge) { badge.classList.remove('show'); badge.textContent = ''; }
    markSleepChoice(null);
    if (userAction) { $('fs-sleep-popup').classList.remove('open'); showToast('Sleep timer off', true); }
}
function startSleepBadge() {
    const badge = $('fs-sleep-badge');
    const upd = () => {
        const remMs = sleepTimerEnd - Date.now();
        if (remMs <= 0) { badge.classList.remove('show'); return; }
        badge.textContent = Math.ceil(remMs / 60000) + 'm';
        badge.classList.add('show');
    };
    upd();
    sleepBadgeInterval = setInterval(upd, 15000);
}
// "End of song": pause just before the current track finishes (so it doesn't auto-advance).
audioEngine.addEventListener('timeupdate', () => {
    if (sleepEndOfTrack && audioEngine.duration && isFinite(audioEngine.duration)
        && audioEngine.currentTime >= audioEngine.duration - 0.5) {
        try { audioEngine.pause(); } catch (e) {}
        cancelSleepTimer(false);
        showToast('Sleep timer ended', true);
    }
});
document.addEventListener('click', e => {
    if (!e.target.closest('.fs-timer-wrap')) $('fs-sleep-popup').classList.remove('open');
});

document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlayback(); }
    if (e.code === 'ArrowRight' && audioEngine.src) audioEngine.currentTime = Math.min(audioEngine.currentTime + 5, audioEngine.duration || 0);
    if (e.code === 'ArrowLeft' && audioEngine.src) audioEngine.currentTime = Math.max(audioEngine.currentTime - 5, 0);
});

/* =====================================================================
   PLAYLIST MODALS
   (These functions were referenced in the old HTML but never defined,
   so playlist creation from the UI silently did nothing.)
===================================================================== */
function openCreatePlaylistModal() {
    if (!globalUser || globalUser === 'admin') { switchPane('account'); showToast("Log in to create playlists", true); return; }
    pendingModalTrack = null;
    $('modal-top-title').textContent = "Create playlist";
    renderModalPlaylistList(false);
    $('add-playlist-modal').classList.add('open');
    setTimeout(() => $('new-pl-input').focus(), 80);
}
function openPlaylistModalFromPlayer() {
    if (event) event.stopPropagation();
    if (!globalUser || globalUser === 'admin') { switchPane('account'); showToast("Log in to use playlists", true); return; }
    if (!activeTrackData) { showToast("Play a song first", true); return; }
    pendingModalTrack = { ...activeTrackData, type: 'song' };
    $('modal-top-title').textContent = "Add to playlist";
    renderModalPlaylistList(true);
    $('add-playlist-modal').classList.add('open');
}
function renderModalPlaylistList(clickable) {
    const list = $('modal-playlist-list');
    const pls = userProfile.customPlaylists || [];
    if (!pls.length) {
        list.innerHTML = `<p class="status-note">No playlists yet — create one below.</p>`;
        return;
    }
    list.innerHTML = "";
    pls.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'modal-item';
        div.innerHTML = `<i class="ri-music-2-line"></i>${escapeHtml(pl.name)} <span style="margin-left:auto; color:var(--dim); font-size:0.8rem;">${pl.tracks.length}</span>`;
        if (clickable) div.onclick = () => addPendingTrackToPlaylist(pl.id);
        else div.style.cursor = 'default';
        list.appendChild(div);
    });
}
function addPendingTrackToPlaylist(plId) {
    const pl = userProfile.customPlaylists.find(p => p.id === plId);
    if (!pl || !pendingModalTrack) return;
    if (pl.tracks.some(t => t.id === pendingModalTrack.id)) { showToast("Already in that playlist", true); return; }
    pl.tracks.push(pendingModalTrack);
    syncProfile();
    closeModals();
    showToast(`Added to "${pl.name}"`);
}
function createAndAddToPlaylist() {
    const name = $('new-pl-input').value.trim();
    if (!name) { showToast("Give the playlist a name", true); return; }
    const pl = { id: 'pl_' + Date.now(), name, tracks: [] };
    if (pendingModalTrack) pl.tracks.push(pendingModalTrack);
    userProfile.customPlaylists.push(pl);
    $('new-pl-input').value = "";
    syncProfile();
    closeModals();
    showToast(`Playlist "${name}" created`);
}
function removeCustomPlaylist(plId) {
    const pl = userProfile.customPlaylists.find(p => p.id === plId);
    if (!pl) return;
    openConfirmModal(`Delete "${pl.name}"?`, "The playlist and its track list will be removed from your profile.", () => {
        userProfile.customPlaylists = userProfile.customPlaylists.filter(p => p.id !== plId);
        syncProfile();
        if ($('pane-collection').classList.contains('active')) switchPane('library');
        showToast("Playlist deleted", true);
    });
}
function confirmDeleteAllDownloads() {
    openConfirmModal("Delete all downloads?", "Every downloaded song will be removed from this device. You can re-download anytime.", async () => {
        await deleteAllDownloads();
        openCollection('downloads');
        showToast("All downloads removed", true);
    });
}
function removeSongFromCustomPlaylist(plId, trackId) {
    const pl = userProfile.customPlaylists.find(p => p.id === plId);
    if (!pl) return;
    pl.tracks = pl.tracks.filter(t => t.id !== trackId);
    syncProfile();
    openCollection('custom-playlist', plId);
    showToast("Removed from playlist", true);
}

/* ---- Playlist suggestions (bottom of a custom playlist) ----
   Seeds off the playlist's own tracks plus the listener's taste profile, then
   shows 5 songs not already in the playlist, each with an instant "add" button
   and a refresh control. Reuses gatherAlgorithmicCandidates so it follows the
   same taste logic as the home recommendations. */
let plSuggestToken = 0;
async function renderPlaylistSuggestions(plId, forceRefresh = false) {
    const pl = userProfile.customPlaylists.find(p => p.id === plId);
    if (!pl) return;
    const grid = $('collection-tracks-grid');
    const main = grid.parentElement;
    // Build (or reuse) the suggestions container placed after the track list.
    let wrap = $('collection-suggest');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'collection-suggest';
        wrap.className = 'pl-suggest';
        main.appendChild(wrap);
    }
    wrap.innerHTML = `
        <div class="pl-suggest-head">
            <h3>Suggested for this playlist</h3>
            <button class="refresh-sugg" onclick="renderPlaylistSuggestions('${plId}', true)"><i class="ri-refresh-line" id="pl-sugg-refresh-ico"></i> Refresh</button>
        </div>
        <div class="track-list" id="pl-suggest-list">${skeletonRows(5)}</div>`;
    const refIco = $('pl-sugg-refresh-ico'); if (refIco) refIco.classList.add('spin');

    const myToken = ++plSuggestToken;
    try {
        // Seed from the playlist's own songs (most recent first), padded with
        // the listener's strongest taste seeds so even small playlists work.
        const seeds = [...pl.tracks].slice(-3).reverse();
        if (seeds.length < 2) seeds.push(...tasteTopSeeds(2));
        if (!seeds.length) { renderPlSuggestList(plId, []); return; }

        const inPlaylist = new Set(pl.tracks.map(t => t.id));
        const seenSug = new Set();
        const pool = [];
        for (const seed of seeds) {
            if (!seed || !seed.title) continue;
            const cands = await gatherAlgorithmicCandidates(seed).catch(() => []);
            for (const c of cands) {
                if (!c.id || inPlaylist.has(c.id) || seenSug.has(c.id)) continue;
                seenSug.add(c.id);
                pool.push(c);
            }
            if (pool.length >= 20) break;
        }
        if (myToken !== plSuggestToken) return; // a newer refresh/collection took over

        // Shuffle a little so Refresh actually varies the picks.
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        renderPlSuggestList(plId, pool.slice(0, 5));
    } catch (e) {
        if (myToken !== plSuggestToken) return;
        renderPlSuggestList(plId, []);
    }
}

function renderPlSuggestList(plId, songs) {
    const list = $('pl-suggest-list');
    const refIco = $('pl-sugg-refresh-ico'); if (refIco) refIco.classList.remove('spin');
    if (!list) return;
    if (!songs.length) {
        list.innerHTML = `<p class="status-note" style="padding:14px 4px; color:var(--dim);">No suggestions right now — play a few songs or hit Refresh.</p>`;
        return;
    }
    list.innerHTML = songs.map(t => {
        const key = regTrack(t, { collectionId: plId, suggestion: true });
        const art = t.thumb && t.thumb !== PLAYLIST_ART
            ? `<img class="row-art" src="${escapeHtml(t.thumb)}" loading="lazy" alt="" onerror="this.outerHTML='<div class=&quot;row-art generic-cover&quot;><i class=&quot;ri-music-2-line&quot;></i></div>'">`
            : `<div class="row-art generic-cover"><i class="ri-music-2-line"></i></div>`;
        return `
        <div class="track-row" data-id="${escapeHtml(t.id || '')}" data-act="open" data-key="${key}">
            ${art}
            <div class="row-meta"><h4>${escapeHtml(t.title)}</h4><p>${escapeHtml(t.artist || '')}</p></div>
            <button class="row-add-btn" data-act="addsong" data-key="${key}" title="Add to playlist" aria-label="Add to playlist"><i class="ri-add-line"></i></button>
        </div>`;
    }).join('');
}

function addSuggestionToPlaylist(plId, track, btnEl) {
    const pl = userProfile.customPlaylists.find(p => p.id === plId);
    if (!pl) return;
    if (pl.tracks.some(t => t.id === track.id)) { showToast("Already in this playlist", true); return; }
    pl.tracks.push({ id: track.id, title: track.title, artist: track.artist, thumb: track.thumb, type: 'song' });
    syncProfile();
    // Instant visual feedback: mark the button as added and update the count.
    if (btnEl) {
        btnEl.classList.add('added');
        btnEl.innerHTML = '<i class="ri-check-line"></i>';
        btnEl.setAttribute('data-act', 'noop');
    }
    const sub = document.querySelector('#collection-header .sub');
    if (sub) sub.textContent = `${pl.tracks.length} track${pl.tracks.length === 1 ? '' : 's'}`;
    showToast(`Added to "${pl.name}"`);
}
function closeModals() { $('add-playlist-modal').classList.remove('open'); pendingModalTrack = null; }

/* =====================================================================
   IMPORT PLAYLIST
   YouTube Music: full track list via a new backend endpoint (see index.js).
   Spotify: no public track-list API without server credentials, so this
   only pulls the playlist's name + cover via Spotify's open oEmbed
   endpoint and creates an empty playlist shell — the user's own
   Spotify → YouTube Music converter (copy_playlists.py) produces a YTM
   link that can then be imported here for the real tracks.
===================================================================== */
function openImportPlaylistModal() {
    if (!globalUser || globalUser === 'admin') { switchPane('account'); showToast("Log in to import playlists", true); return; }
    $('import-url-input').value = "";
    $('import-msg').className = 'form-msg';
    $('import-msg').textContent = "";
    $('import-playlist-modal').classList.add('open');
    setTimeout(() => $('import-url-input').focus(), 80);
}
function closeImportModal() { $('import-playlist-modal').classList.remove('open'); }

function extractYtmPlaylistId(url) {
    const m = url.match(/[?&]list=([\w-]+)/);
    return m ? m[1] : null;
}
function extractSpotifyPlaylistUrl(url) {
    return /open\.spotify\.com\/playlist\//.test(url) ? url.split('?')[0] : null;
}

async function submitImportPlaylist() {
    const url = $('import-url-input').value.trim();
    const msg = $('import-msg');
    if (!url) { msg.className = 'form-msg err'; msg.textContent = "Paste a playlist link first."; return; }

    const ytmId = extractYtmPlaylistId(url);
    const spotifyUrl = extractSpotifyPlaylistUrl(url);
    if (!ytmId && !spotifyUrl) {
        msg.className = 'form-msg err';
        msg.textContent = "That doesn't look like a YouTube Music or Spotify playlist link.";
        return;
    }

    const btn = $('import-submit-btn');
    btn.disabled = true;
    msg.className = 'form-msg'; msg.textContent = "Importing…";

    try {
        if (ytmId) await importFromYoutubeMusic(ytmId);
        else await importFromSpotify(spotifyUrl);
    } catch (e) {
        msg.className = 'form-msg err';
        msg.textContent = e.message || "Couldn't import that playlist.";
        btn.disabled = false;
        return;
    }
    btn.disabled = false;
}

async function importFromYoutubeMusic(listId) {
    const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/playlist-import-proxy?id=${encodeURIComponent(listId)}`, 18000);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error || "Couldn't reach the playlist importer.");
    if (data.error) {
        // Surface exactly which strategy failed and why (Data API / InnerTube /
        // HTML scrape) instead of a single opaque message — this is what
        // actually lets a failure get diagnosed and fixed for good, instead of
        // guessing again next time.
        const d = data.diagnostics;
        const detail = d ? `\n\n(Data API: ${d.dataApi}\nInnerTube: ${d.innerTube}\nScrape: ${d.scrape})` : '';
        throw new Error(data.error + detail);
    }

    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) throw new Error("This playlist looks empty, private, or couldn't be read.");

    const plName = data.title || "Imported playlist";
    const tracks = items.filter(t => t.id && t.title).map(t => ({
        id: t.id, title: t.title, artist: t.artist || "Unknown Artist",
        thumb: t.thumb || `https://wsrv.nl?url=https://i.ytimg.com/vi_webp/${t.id}/mqdefault.webp`,
        type: 'song'
    }));
    const pl = { id: 'pl_' + Date.now(), name: plName, tracks, source: 'YouTube Music', thumb: tracks[0]?.thumb || null };
    userProfile.customPlaylists.push(pl);
    syncProfile();
    closeImportModal();
    showToast(`Imported "${plName}" — ${tracks.length} track${tracks.length === 1 ? '' : 's'}`);
}

async function importFromSpotify(playlistUrl) {
    let meta = null;
    try {
        const res = await fetchWithTimeout(`https://open.spotify.com/oembed?url=${encodeURIComponent(playlistUrl)}`, 8000);
        if (res.ok) meta = await res.json();
    } catch (e) {}

    const plName = meta?.title || "Imported Spotify playlist";
    const pl = { id: 'pl_' + Date.now(), name: plName, tracks: [], source: 'Spotify', thumb: meta?.thumbnail_url || null };
    userProfile.customPlaylists.push(pl);
    syncProfile();
    closeImportModal();
    showToast(`Added "${plName}" — convert it to YouTube Music and import that link to fill in tracks`, true);
}

/* Add a single song to a specific playlist by pasting its link — the
   one-by-one alternative to full playlist import, using the same
   oEmbed-backed resolver as pasting a link into search. */
let addLinkTargetPlaylistId = null;
function openAddLinkModal(plId) {
    addLinkTargetPlaylistId = plId;
    $('add-link-input').value = "";
    $('add-link-msg').className = 'form-msg';
    $('add-link-msg').textContent = "";
    $('add-link-modal').classList.add('open');
    setTimeout(() => $('add-link-input').focus(), 80);
}
function closeAddLinkModal() { $('add-link-modal').classList.remove('open'); addLinkTargetPlaylistId = null; }

async function submitAddSongByLink() {
    const link = $('add-link-input').value.trim();
    const msg = $('add-link-msg');
    if (!link) { msg.className = 'form-msg err'; msg.textContent = "Paste a song link first."; return; }

    const btn = $('add-link-submit-btn');
    btn.disabled = true;
    msg.className = 'form-msg'; msg.textContent = "Resolving…";
    try {
        const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/resolve-video-proxy?url=${encodeURIComponent(link)}`, 10000);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.error) throw new Error(data?.error || "Couldn't resolve that link.");

        const pl = userProfile.customPlaylists.find(p => p.id === addLinkTargetPlaylistId);
        if (!pl) throw new Error("That playlist no longer exists.");
        const track = { id: data.id, title: data.title, artist: data.artist, thumb: data.thumb, type: 'song' };
        if (pl.tracks.some(t => t.id === track.id)) { msg.className = 'form-msg err'; msg.textContent = "Already in this playlist."; btn.disabled = false; return; }

        pl.tracks.push(track);
        syncProfile();
        closeAddLinkModal();
        if ($('pane-collection').classList.contains('active')) openCollection('custom-playlist', pl.id);
        showToast(`Added "${track.title}"`);
    } catch (e) {
        msg.className = 'form-msg err';
        msg.textContent = e.message || "Couldn't add that song.";
    }
    btn.disabled = false;
}

let confirmCb = null;
function openConfirmModal(title, text, cb) {
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    confirmCb = cb;
    $('confirm-modal').classList.add('open');
    $('confirm-action-btn').onclick = () => { if (confirmCb) confirmCb(); closeConfirmModal(); };
}
function closeConfirmModal() { $('confirm-modal').classList.remove('open'); confirmCb = null; }
document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) { closeModals(); closeConfirmModal(); closeImportModal(); closeAddLinkModal(); } }));
$('import-url-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitImportPlaylist(); });
$('add-link-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitAddSongByLink(); });
$('new-pl-input').addEventListener('keydown', e => { if (e.key === 'Enter') createAndAddToPlaylist(); });

/* =====================================================================
   HOME: RECENTLY PLAYED + RECOMMENDATIONS
   Fixes for "only works after refresh":
   1. The init crash (see player section) meant login — and therefore
      your liked-songs seeds — never loaded on page open.
   2. Recommendations now render instantly from a cached copy of the
      last result, then refresh silently in the background.
   3. All seed lookups run in parallel instead of sequentially.
===================================================================== */
async function renderRecentlyPlayed() {
    // Otherwise, on a fresh page load this runs before downloadedIds is
    // populated (see initDownloadsRegistry above) and every downloaded
    // track's isDownloaded() check below comes back false, so the offline
    // artwork never even gets looked up on the first paint.
    await downloadsRegistryReady;

    // Prefer the account-synced list when logged in (follows the user across
    // devices); fall back to this device's local history for guests/admin.
    let hist;
    if (globalUser && globalUser !== 'admin' && Array.isArray(userProfile.recentlyPlayed) && userProfile.recentlyPlayed.length) {
        hist = userProfile.recentlyPlayed.filter(t => t && t.id && t.title);
    } else {
        hist = JSON.parse(localStorage.getItem('taste_profile_history') || '[]').filter(t => t && t.id && t.title);
    }
    const shelf = $('shelf-recent');
    if (!hist.length) { shelf.style.display = 'none'; return; }
    shelf.style.display = 'block';

    const items = hist.slice(0, 6).map(t => ({ ...t }));
    // A history entry's thumb can be missing, or a dead blob: URL left over
    // from a download that's since been deleted (blob: URLs don't survive a
    // page reload even when the download is still around, and definitely
    // don't resolve to anything once it's gone) — this is why Recently
    // Played specifically could show a blank icon for a song that displays
    // fine everywhere else: every other view either renders a freshly
    // resolved thumb from a live lookup, or is the Downloads screen itself
    // reading straight from IndexedDB, while this shelf renders from a
    // STORED thumb value that can go stale between plays.
    // Fix: for a broken/missing thumb, try the offline copy first if the
    // track is still downloaded, and if that's not available either — not
    // downloaded (anymore), or downloaded without artwork — fall back to
    // the same canonical network thumbnail URL every other song list uses,
    // instead of leaving it broken until (or unless) onerror ever fires.
    await Promise.all(items.map(async t => {
        if (t.thumb && !t.thumb.startsWith('blob:')) return; // already has a normal, presumably-live URL
        if (isDownloaded(t.id)) {
            const url = await getOfflineThumbUrl(t.id);
            if (url) { t.thumb = url; return; }
        }
        t.thumb = canonicalThumbUrl(t.id);
    }));
    $('recent-grid').className = 'home-carousel';
    renderCarouselShelf('recent-grid', items.map(t => ({ ...t, type: 'song' })));
}

function renderRecGrids(songs, playlists) {
    $('recommended-songs-grid').className = 'home-carousel';
    renderCarouselShelf('recommended-songs-grid', songs.slice(0, 12));
    $('recommended-playlists-grid').innerHTML = playlists.slice(0, 6).map(t => createTrackCardHTML(t)).join('');
    highlightActiveTrackCard();
}

let recsToken = 0;
async function loadHomeRecommendations(manual = false) {
    const myToken = ++recsToken;

    // 1) Instant paint from cache (or skeletons on first ever visit)
    const cached = JSON.parse(localStorage.getItem('home_recs_cache') || 'null');
    if (cached && cached.songs?.length && !manual) {
        renderRecGrids(cached.songs, cached.playlists || []);
    } else {
        $('recommended-songs-grid').className = 'home-carousel';
        $('recommended-songs-grid').innerHTML = `<div class="carousel-wrap"><div class="carousel-page">${skeletonRows(4)}</div></div>`;
        $('recommended-playlists-grid').innerHTML = skeletonCards(4);
    }

    // 2) Fresh fetch in the background
    try {
        const { songs, playlists } = await buildRecommendations();
        if (myToken !== recsToken) return;
        renderRecGrids(songs, playlists);
        localStorage.setItem('home_recs_cache', JSON.stringify({ songs: songs.slice(0, 12), playlists: playlists.slice(0, 8), at: Date.now() }));
        if (manual) showToast("Recommendations refreshed");
    } catch (e) {
        if (myToken !== recsToken) return;
        if (!cached) {
            $('recommended-songs-grid').innerHTML = `<p class="status-note err" style="grid-column:1/-1;">Couldn't reach the music mirrors. Hit Refresh to retry.</p>`;
            $('recommended-playlists-grid').innerHTML = "";
        }
    }
}

async function buildRecommendations() {
    // Seeds: the taste profile's strongest picks (liked + finished songs by
    // artists you rate), padded with random history so new accounts still work.
    const hist = JSON.parse(localStorage.getItem('taste_profile_history') || '[]');
    let seeds = tasteTopSeeds(3);
    if (seeds.length < 3) {
        const filler = shuffleArray([...(userProfile.likedSongs || []), ...hist.filter(t => t && t.id && t.title)])
            .filter(t => !seeds.some(s => s.id === t.id));
        seeds = [...seeds, ...filler].slice(0, 3);
    }

    const jobs = [];
    seeds.forEach(s => {
        jobs.push(fetchJsonRetry(`${NEW_HUB_BACKEND}/api/similar-proxy?title=${encodeURIComponent(s.title)}&artist=${encodeURIComponent(s.artist)}`, 2, 500).catch(() => []));
        jobs.push(fetchJsonRetry(`${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(s.artist + " playlist mix")}&f=playlist`, 2, 500).catch(() => []));
    });
    // Global fallbacks run in the SAME parallel batch (old code awaited them serially)
    jobs.push(fetchJsonRetry(`${NEW_HUB_BACKEND}/api/search-proxy?q=Tunisian+Rap+Arabic+Pop&f=song`, 2, 500).catch(() => []));
    jobs.push(fetchJsonRetry(`${NEW_HUB_BACKEND}/api/search-proxy?q=Top+Arabic+Hits&f=playlist`, 2, 500).catch(() => []));

    const responses = await Promise.all(jobs);
    let songPool = [], plPool = [];
    responses.forEach((res, idx) => {
        const arr = Array.isArray(res) ? res : (res.items || res.contents || []);
        const isSongJob = (idx < seeds.length * 2) ? (idx % 2 === 0) : (idx === responses.length - 2);
        if (isSongJob) songPool = songPool.concat(arr.filter(t => (t.id || t.videoId) && (t.title || t.name)));
        else plPool = plPool.concat(arr.filter(t => t.type !== 'channel' && t.resultType !== 'artist'));
    });

    songPool = shuffleArray(songPool); plPool = shuffleArray(plPool);

    const skipped = tasteSkippedArtists();
    const songs = [], seenS = new Set();
    songPool.forEach(t => {
        const id = t.id || t.videoId;
        if (id && !seenS.has(id)) {
            const norm = normalizeTrack(t, 'song');
            if (skipped.has(tasteArtistKey(norm.artist))) return; // don't resurface artists you keep skipping
            seenS.add(id); songs.push(norm);
        }
    });
    // Rank the shelf by taste affinity (with jitter so it stays fresh)
    songs.sort((a, b) => (tasteArtistScore(b.artist) + Math.random() * 3) - (tasteArtistScore(a.artist) + Math.random() * 3));
    const playlists = [], seenP = new Set();
    plPool.forEach(t => {
        const id = t.id || t.playlistId || t.browseId;
        if (id && !seenP.has(id) && String(id).length > 5) { seenP.add(id); playlists.push(normalizeTrack(t, 'playlist')); }
    });

    if (!songs.length && !playlists.length) throw new Error("No recommendation data");
    return { songs, playlists };
}

/* =====================================================================
   SURPRISE ANIMATION
   A one-time welcome: watercolor tulip draws itself, petals rain down,
   sparkles pop, and a handwritten message types out with a soft synth
   chime per word. Entirely self-contained — no external audio/image
   assets. The server-side flag is cleared as soon as it starts so it
   never plays twice unless an admin re-arms it.
===================================================================== */
const SURPRISE_MESSAGE = "Thought these flowers were pretty, but then I remembered you  rahmouchtyyy";
const SURPRISE_SIGN = "habibㅤ♡";

function playSurprise(username) {
    // Clear the flag immediately (fire-and-forget) so it's genuinely one-time
    if (username) {
        fetch(`${NEW_HUB_BACKEND}/api/clear-surprise`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        }).catch(() => {});
    }

    const overlay = $('surprise-overlay');
    // Freeze the flower animations until the overlay is actually visible, then
    // release them so the whole garden blooms from zero in front of the user.
    overlay.classList.add('not-ready');
    overlay.style.display = 'block';
    requestAnimationFrame(() => {
        overlay.classList.add('show');
        // next frame: let the bloom begin
        requestAnimationFrame(() => overlay.classList.remove('not-ready'));
    });

    sprinkleSparkles();

    // The garden finishes blooming around ~3s; type the message just after so
    // it lands once the flowers are open, then reveal the button.
    setTimeout(() => typeSurpriseMessage(), 3200);
}

function typeSurpriseMessage() {
    const el = $('surprise-text');
    const full = SURPRISE_MESSAGE;

    // Build word-by-word: each word's letters live in a .word span
    // (inline-block, never splits), words separated by real breakable
    // spaces — so lines can only wrap BETWEEN words, never mid-word.
    const words = full.split(' ');
    let html = '';
    words.forEach((word, wi) => {
        html += '<span class="word">';
        for (const ch of word) html += `<span class="ch">${escapeHtml(ch)}</span>`;
        html += '</span>';
        if (wi < words.length - 1) html += '<span class="ch space"> </span>';
    });
    html += `<span class="sig">&mdash; <span class="ch">${escapeHtml(SURPRISE_SIGN)}</span></span>`;
    el.innerHTML = html;

    const chars = el.querySelectorAll('.ch');
    let audioCtx = null;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}

    let i = 0;
    const reveal = () => {
        if (i >= chars.length) {
            setTimeout(() => $('surprise-close').classList.add('show'), 500);
            return;
        }
        chars[i].classList.add('on');
        if (audioCtx && !chars[i].classList.contains('space') && i % 2 === 0) penTick(audioCtx);
        i++;
        const isSig = chars[i - 1] && chars[i - 1].closest('.sig');
        setTimeout(reveal, isSig ? 400 : 55);
    };
    reveal();
}

/* short, soft synthesized "pen stroke" tick - no audio files needed */
function penTick(ctx) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 420 + Math.random() * 260;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.1);
}

function sprinkleSparkles() {
    const layer = $('surprise-sparkles');
    layer.innerHTML = '';
    let n = 0;
    const timer = setInterval(() => {
        if (n++ > 80 || !$('surprise-overlay').classList.contains('show')) { clearInterval(timer); return; }
        const s = document.createElement('div');
        s.className = 'spark';
        s.textContent = Math.random() > 0.5 ? '\u2726' : '\u2727';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.fontSize = (0.7 + Math.random() * 1.3) + 'rem';
        layer.appendChild(s);
        setTimeout(() => s.remove(), 1600);
    }, 200);
}

function dismissSurprise() {
    const overlay = $('surprise-overlay');
    overlay.classList.remove('show');
    setTimeout(() => {
        overlay.style.display = 'none';
        showToast(`Welcome, ${userProfile.username || ''}`.trim());
    }, 800);
}

/* =====================================================================
   BACK BUTTON + SWIPE-DOWN GESTURES
   1. Hardware/browser Back (Android back button, iOS edge-swipe) now acts
      as an in-app "back": it closes the topmost thing that's open —
      lyrics → fullscreen player → any modal → collection view → back to
      Home — and never exits the site. Implemented with a single history
      "guard" entry that is re-armed after every pop, so no existing
      open/close function needed to change.
   2. The fullscreen player and the lyrics sheet can be dragged/swiped
      down to dismiss, like every native music app.
===================================================================== */
function handleInAppBack() {
    // Close things in visual stacking order (topmost first).
    const rowSheet = $('row-sheet');
    if (rowSheet && rowSheet.classList.contains('open')) { closeRowSheet(); return true; }

    const lyrics = $('lyrics-overlay');
    if (lyrics && lyrics.classList.contains('open')) { lyrics.classList.remove('open'); return true; }

    const volPopup = $('fs-vol-popup');
    if (volPopup && volPopup.classList.contains('open')) { volPopup.classList.remove('open'); return true; }

    const sleepPopup = $('fs-sleep-popup');
    if (sleepPopup && sleepPopup.classList.contains('open')) { sleepPopup.classList.remove('open'); return true; }

    const fs = $('full-player-overlay');
    if (fs && fs.classList.contains('active')) { fs.classList.remove('active'); return true; }

    const openModal = document.querySelector('.modal-overlay.open');
    if (openModal) {
        closeModals(); closeConfirmModal(); closeImportModal(); closeAddLinkModal();
        return true;
    }

    const suggBox = $('suggestions-box');
    if (suggBox && suggBox.style.display === 'block') { suggBox.style.display = 'none'; return true; }

    const collection = $('pane-collection');
    if (collection && collection.classList.contains('active')) { triggerPaneRollback(); return true; }

    const home = $('pane-home');
    if (home && !home.classList.contains('active')) { switchPane('home'); return true; }

    return false; // already at Home with nothing open
}

function initBackButtonHandling() {
    try {
        // One guard entry sits on top of the real history. Every Back press
        // pops it, we do our in-app back action, then immediately re-arm it —
        // so Back always works and never leaves the app.
        history.replaceState({ msRoot: true }, '', location.href);
        history.pushState({ msGuard: true }, '', location.href);
        window.addEventListener('popstate', () => {
            handleInAppBack(); // even when false (home, nothing open) we stay put
            history.pushState({ msGuard: true }, '', location.href);
        });
    } catch (e) { /* history API unavailable — nothing breaks, just no back handling */ }
}

/* ---- swipe-down to dismiss ---- */
function makeSwipeDismissable(el, opts) {
    const { canStart, close } = opts;
    let startY = 0, startX = 0, startT = 0, dy = 0, dragging = false, committed = false;

    function snapBack() {
        el.style.transition = 'transform .25s cubic-bezier(.3,.8,.3,1)';
        el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; }, 270);
    }
    function animateOut() {
        el.style.transition = 'transform .22s cubic-bezier(.3,.8,.3,1)';
        el.style.transform = 'translateY(100vh)';
        setTimeout(() => {
            // Remove the open class while transitions are off, so the overlay
            // doesn't visibly re-animate from its dragged position.
            el.style.transition = 'none';
            close();
            el.style.transform = '';
            requestAnimationFrame(() => { el.style.transition = ''; });
        }, 230);
    }

    el.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        if (canStart && !canStart(e)) { dragging = false; return; }
        dragging = true; committed = false;
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        startT = Date.now();
        dy = 0;
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
        if (!dragging) return;
        const t = e.touches[0];
        dy = t.clientY - startY;
        const dx = t.clientX - startX;
        if (!committed) {
            // Only take over once it's clearly a downward vertical drag.
            if (dy > 14 && dy > Math.abs(dx) * 1.4) committed = true;
            else if (Math.abs(dx) > 26 || dy < -14) { dragging = false; return; }
            else return;
        }
        if (dy < 0) dy = 0;
        e.preventDefault(); // we're handling this drag; don't scroll behind it
        el.style.transition = 'none';
        el.style.transform = `translateY(${dy}px)`;
    }, { passive: false });

    el.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false;
        if (!committed) return;
        const elapsed = Math.max(1, Date.now() - startT);
        const velocity = dy / elapsed; // px per ms
        const threshold = Math.min(180, window.innerHeight * 0.24);
        if (dy > threshold || velocity > 0.55) animateOut();
        else snapBack();
        committed = false; dy = 0;
    }, { passive: true });

    el.addEventListener('touchcancel', () => {
        if (dragging && committed) snapBack();
        dragging = false; committed = false; dy = 0;
    }, { passive: true });
}

function initSwipeGestures() {
    const fs = $('full-player-overlay');
    if (fs) makeSwipeDismissable(fs, {
        // Don't hijack seek/volume slider drags or the volume popup.
        canStart: (e) => !e.target.closest('input, .fs-vol-popup, .fs-sleep-popup, .fs-timer-wrap, .fs-quality-wrap, .fs-video-wrap'),
        close: () => fs.classList.remove('active')
    });

    const lyrics = $('lyrics-overlay');
    if (lyrics) makeSwipeDismissable(lyrics, {
        // Start from the header always; from the lyrics body only when it's
        // scrolled to the very top (otherwise the drag is a normal scroll).
        canStart: (e) => {
            if (e.target.closest('.lyrics-head')) return true;
            const body = $('lyrics-body');
            return body && body.scrollTop <= 0;
        },
        close: () => lyrics.classList.remove('open')
    });
}

/* =====================================================================
   INIT — order matters; everything is defined above this point.
===================================================================== */
(function init() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    $('topbar-greeting').textContent = timeGreeting();
    applyVolume(Number(localStorage.getItem('hub_volume') ?? 50), false);
    paintSlider($('pb-seek'), 0);
    paintSlider($('fs-seek'), 0);

    // Device-level settings (Data Saver, offline lyrics, Liquid Glass, theme,
    // accent/lyrics color) load FIRST and unconditionally — no login, no
    // network, no online/offline branching involved at all. This is what
    // makes them survive an immediate refresh no matter what.
    loadDeviceSettings();
    applyLiquidGlassTheme();
    applyThemePreference();

    // Restore whatever was last synced for this account (likes/playlists) so
    // the library isn't empty offline — settings themselves are already
    // handled above regardless of this succeeding.
    if (globalUser && globalUser !== 'admin') restoreProfileFromCache(globalUser);
    loadDeviceSettings(); // re-assert: the per-account cache above must never override the device's own settings
    refreshActivePresetButton();

    populateLibraryUI();
    renderRecentlyPlayed();
    initBackButtonHandling();             // hardware/browser Back = in-app back, never exits
    initSwipeGestures();                  // swipe down to close the player / lyrics sheets
    restoreSessionState();                // bring back the last song + position, ready to resume on Play

    // Offline at launch: don't even attempt the network sign-in — it would
    // just sit behind the gate for up to 9s before timing out. Go straight
    // into downloaded/local content instead.
    if (navigator.onLine === false) {
        enterOfflineMode();
    } else {
        loadHomeRecommendations();            // paints instantly from cache, refreshes in background
        if (globalUser && globalPass) {
            executeLogin(globalUser, globalPass, true); // auto=true: falls back to offline mode instead of leaving the gate stuck if this fails
        } else {
            applyIdentityUI(null);
            showAuthGate();
        }
    }

    // Covers the connection dropping mid-session (gate wasn't stuck, but
    // shouldn't become impossible to clear if it opens while offline later)
    // and coming back after a cold start that missed it.
    window.addEventListener('offline', () => {
        const g = $('auth-gate');
        if (g && !g.classList.contains('hidden')) enterOfflineMode();
    });
    window.addEventListener('online', () => {
        if (globalUser && globalPass && !sessionSynced) executeLogin(globalUser, globalPass, true);
    });
})();