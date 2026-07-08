// MOUZIKA — minimal service worker.
// This intentionally does NOT cache audio, search results, or API calls —
// music streaming needs live network requests every time. Its only job is
// to satisfy the browser's installability checklist (a fetch handler is
// required for "Add to Home Screen" to count this as a real PWA on
// Android), which noticeably improves background-playback survival.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass every request straight through to the network — no caching layer.
  event.respondWith(fetch(event.request));
});