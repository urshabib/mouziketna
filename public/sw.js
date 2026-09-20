// Service Worker for MOUZIKA PWA
const CACHE_NAME = 'mouzika-pwa-v5';
const BRANDING_CACHE = 'mouzika-branding-cache-v1';

// Install event - activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Skip waiting message listener from force refresh
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate event - claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== BRANDING_CACHE).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch event - network-first with cache fallback
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

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache valid 200 responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // If HTML page request failed, return root
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html') || caches.match('./');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});
