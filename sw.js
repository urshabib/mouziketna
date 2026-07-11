// MOUZIKA — service worker.
// Live data (audio streams, search, suggestions, any /api call) is still NEVER
// cached — music streaming needs a real network request every time, and
// Range-request seeking through Cache Storage is unreliable for <audio>
// anyway. Only the static app shell (the files below) is cache-first, so the
// installed home-screen app still opens and renders its UI with no network
// at all — it just won't have live search results, streams, or suggestions
// until the connection comes back. Downloaded songs for offline playback are
// handled separately, in IndexedDB, straight from the page's own JS.
const SHELL_CACHE = 'mouzika-shell-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => {}) // a missing/renamed asset shouldn't block install
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== SHELL_CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

function isShellRequest(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false; // never touch cross-origin (audio/CDNs/APIs)
  return SHELL_ASSETS.some((asset) => url.pathname.endsWith(asset.replace('./', '/')));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!isShellRequest(request)) {
    // Everything else — audio, search-proxy, suggestions, lyrics, save-profile,
    // fast-saavn, mirrors, artwork — passes straight through, exactly as before.
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first for the shell itself, with a network refresh in the
  // background so an update ships next load instead of staying stale forever.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});