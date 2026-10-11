// Service Worker for MOUZIKETNA PWA
const CACHE_NAME = 'mouzika-pwa-1791752491382';
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

  // Audio streams & media requests (including Range headers)
  // Let the browser's native network engine handle media streaming natively
  const isAudioOrMedia =
    event.request.destination === 'audio' ||
    event.request.headers.has('range') ||
    pathname.includes('.mp3') ||
    pathname.includes('.m4a') ||
    pathname.includes('.mp4');

  if (isAudioOrMedia) {
    return;
  }

  // Dynamic APIs
  if (pathname.includes('/api/')) {
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
            return caches.match('./index.html', { ignoreSearch: true })
              .then((cached) => cached || caches.match('index.html', { ignoreSearch: true }))
              .then((cached) => cached || caches.match('/index.html', { ignoreSearch: true }))
              .then((cached) => cached || response);
          }
          return response;
        })
        .catch(async () => {
          // If offline, use cached index.html
          const cached =
            (await caches.match(event.request, { ignoreSearch: true })) ||
            (await caches.match('./index.html', { ignoreSearch: true })) ||
            (await caches.match('./', { ignoreSearch: true })) ||
            (await caches.match('index.html', { ignoreSearch: true })) ||
            (await caches.match('/index.html', { ignoreSearch: true })) ||
            (await caches.match('/', { ignoreSearch: true }));
          if (cached) return cached;

          // Fallback styled HTML page so it never renders a raw black page with "Offline" text!
          const offlineHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MOUZIKETNA • Offline</title>
  <style>
    body { margin: 0; background-color: #0c0906; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 24px; box-sizing: border-box; }
    .card { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(245, 158, 11, 0.3); padding: 32px 24px; border-radius: 28px; max-width: 400px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
    .icon { width: 56px; height: 56px; margin: 0 auto 16px; color: #f59e0b; }
    h1 { font-size: 22px; font-weight: 900; margin: 0 0 8px; tracking: -0.02em; }
    p { font-size: 13px; color: rgba(255, 255, 255, 0.6); margin: 0 0 24px; line-height: 1.5; }
    .btn { background: #f59e0b; color: #000; font-weight: 800; font-size: 13px; border: none; padding: 12px 28px; border-radius: 9999px; cursor: pointer; transition: transform 0.15s; }
    .btn:active { transform: scale(0.95); }
  </style>
</head>
<body>
  <div class="card">
    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 1.415a3 3 0 004.243 0m-4.243 0L3 3" /></svg>
    <h1>Offline Mode Active</h1>
    <p>You are currently offline. Open MOUZIKETNA again or tap below to load your downloaded offline music hub.</p>
    <button class="btn" onclick="window.location.reload()">Reload App</button>
  </div>
</body>
</html>`;
          return new Response(offlineHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
        })
    );
    return;
  }

  // Static JavaScript and CSS code assets: Network-First with cache: 'no-cache'
  // Revalidates with server, preventing mobile browsers from keeping stale disk cache
  const isCodeAsset =
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.tsx') ||
    pathname.endsWith('.ts') ||
    pathname.endsWith('.jsx') ||
    pathname.includes('/src/') ||
    pathname.includes('node_modules');

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
          const cached =
            (await caches.match(event.request, { ignoreSearch: true })) ||
            (await caches.match(pathname, { ignoreSearch: true }));
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
