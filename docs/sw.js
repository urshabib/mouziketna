// Service Worker for MOUZIKA PWA
const CACHE_NAME = 'mouzika-pwa-v7';
const BRANDING_CACHE = 'mouzika-branding-cache-v1';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Install event - precache core shell & activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[MOUZIKA SW] Precache partial error:', err);
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

// Activate event - claim clients immediately and clean all outdated caches
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

// Fetch event - network-first with offline fallback
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
        const customMatch =
          (await brandingCache.match(filename)) ||
          (await brandingCache.match('./' + filename)) ||
          (await brandingCache.match('/' + filename)) ||
          (await brandingCache.match(event.request));

        if (customMatch) {
          return customMatch;
        }

        // Fall back to normal network/cache flow
        return fetch(event.request).catch(() => caches.match(event.request));
      })
    );
    return;
  }

  // Audio streams / media / dynamic APIs shouldn't break if offline or caching fails
  const isAudioOrStream = event.request.destination === 'audio' ||
                          url.pathname.includes('.mp3') ||
                          url.pathname.includes('.m4a') ||
                          url.pathname.includes('/api/');

  if (isAudioOrStream) {
    // Pass audio and API requests through to network
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // Network-First with cache fallback for everything else
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache valid 200 responses for static assets
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // If network fails (offline), try direct cache match
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // If navigation request (e.g. opening PWA offline), return cached index.html
        if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
          const fallbackIndex =
            (await caches.match('./index.html')) ||
            (await caches.match('./')) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (fallbackIndex) return fallbackIndex;
        }

        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
