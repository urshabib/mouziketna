// Service Worker for MOUZIKETNA PWA
const CACHE_NAME = 'mouzika-pwa-1791553686089';
const BRANDING_CACHE = 'mouzika-branding-cache-v1';

// Precache static shell assets
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './version.json',
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
      return Promise.all(
        PRECACHE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('[MOUZIKETNA SW] Precache partial asset warning:', asset, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Skip waiting & cache purge message listeners
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
    if (event.data.type === 'PURGE_CACHE') {
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key !== BRANDING_CACHE).map((key) => caches.delete(key))
        )
      );
    }
  }
});

// Activate event - claim clients immediately and purge outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== BRANDING_CACHE).map((key) => {
          console.log('[MOUZIKETNA SW] Purging old cache:', key);
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

  // version.json is ALWAYS fresh from network - never cached
  if (pathname.endsWith('version.json') || url.searchParams.has('_t') || url.searchParams.has('_bust')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request)));
    return;
  }

  // Intercept PWA manifest and icon requests so Chrome/Android and iOS get custom selected/uploaded logo
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
          if (pathname.includes('/assets/manifest.json')) {
            const assetManifest = await brandingCache.match('assets/manifest.json');
            if (assetManifest) return assetManifest;
          }

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
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // HTML / Navigation requests: ALWAYS Network-First with cache: 'no-cache'
  // Prevents white screen and guarantees fresh index.html
  const isNav = event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html');

  if (isNav) {
    // If navigation request ends with /assets or /assets/ (from an outdated PWA shortcut), redirect to app root!
    if (pathname.endsWith('/assets') || pathname.endsWith('/assets/')) {
      const rootUrl = url.href.replace(/\/assets\/?$/, '/');
      event.respondWith(
        Response.redirect(rootUrl, 302)
      );
      return;
    }

    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, respClone).catch(() => {});
            }).catch(() => {});
            return response;
          }
          // If server returns 404 on navigation (e.g. GitHub Pages SPA routing or /assets navigation), serve index.html
          if (!response || response.status === 404) {
            return caches.match('./index.html')
              .then((cached) => cached || caches.match('index.html'))
              .then((cached) => cached || caches.match('/index.html'))
              .then((cached) => cached || response);
          }
          return response;
        })
        .catch(async () => {
          // If offline, use cached index.html
          const cached =
            (await caches.match(event.request, { ignoreSearch: true })) ||
            (await caches.match('./index.html')) ||
            (await caches.match('./')) ||
            (await caches.match('index.html')) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (cached) return cached;
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
    );
    return;
  }

  // Static JavaScript and CSS code assets: Network-First with cache: 'no-cache'
  // Revalidates with server, preventing mobile browsers from keeping stale disk cache
  const isCodeAsset = pathname.endsWith('.js') || pathname.endsWith('.css');
  if (isCodeAsset) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch(() => {});
            }).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response('Offline Asset Unavailable', { status: 404, statusText: 'Not Found' });
        })
    );
    return;
  }

  // Static Assets (images, fonts): Network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          }).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('Offline Asset Unavailable', { status: 404, statusText: 'Not Found' });
      })
  );
});
