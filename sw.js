// Service Worker for MOUZIKA PWA
const CACHE_NAME = 'mouzika-pwa-v9';
const BRANDING_CACHE = 'mouzika-branding-cache-v1';

// Precache static shell assets (including predictable production bundles)
const PRECACHE_ASSETS = [
  './manifest.json',
  './favicon.png',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './assets/index.css',
  './assets/index.js'
];

// Install event - precache core shell & activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[MOUZIKA SW] Precache partial notice:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Skip waiting message listener from force refresh
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate event - claim clients immediately and purge outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== BRANDING_CACHE).map((key) => {
          console.log('[MOUZIKA SW] Purging old cache:', key);
          return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch event - network-first for HTML & dynamic assets, cache fallback for offline
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and http/https schemes
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  const url = new URL(event.request.url);
  const pathname = url.pathname;

  // Intercept PWA manifest and icon requests so Chrome/Android and iOS get the custom selected/uploaded logo
  const isBrandingRequest =
    pathname.endsWith('icon-192.png') ||
    pathname.endsWith('icon-512.png') ||
    pathname.endsWith('icon-maskable-192.png') ||
    pathname.endsWith('icon-maskable-512.png') ||
    pathname.endsWith('apple-touch-icon.png') ||
    pathname.endsWith('favicon.png') ||
    pathname.endsWith('manifest.json');

  if (isBrandingRequest) {
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    event.respondWith(
      caches.open(BRANDING_CACHE).then(async (brandingCache) => {
        try {
          const customMatch =
            (await brandingCache.match(filename)) ||
            (await brandingCache.match('./' + filename)) ||
            (await brandingCache.match('/' + filename)) ||
            (await brandingCache.match(event.request));

          if (customMatch) {
            return customMatch;
          }
        } catch {}

        // Fall back to normal network/cache flow
        return fetch(event.request).catch(() => caches.match(event.request));
      })
    );
    return;
  }

  // Audio streams / media / dynamic APIs shouldn't break if offline or caching fails
  const isAudioOrStream = event.request.destination === 'audio' ||
                          pathname.includes('.mp3') ||
                          pathname.includes('.m4a') ||
                          pathname.includes('/api/');

  if (isAudioOrStream) {
    // Pass audio and API requests straight through to network
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // HTML / Navigation requests: ALWAYS Network-First with cache: 'no-cache'
  // This guarantees newly deployed GitHub Pages builds never show a white screen from stale HTML hashes
  const isNav = event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html');

  if (isNav) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, respClone).catch(() => {});
            }).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          // If offline, use cached index.html
          const cached =
            (await caches.match(event.request)) ||
            (await caches.match('./index.html')) ||
            (await caches.match('./')) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (cached) return cached;
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
    );
    return;
  }

  // Static Assets (JS, CSS, images, fonts): Network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful GET responses safely
        if (response && response.status === 200 && response.type !== 'opaque') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          }).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        // Offline fallback from cache
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('Offline Asset Unavailable', { status: 404, statusText: 'Not Found' });
      })
  );
});
