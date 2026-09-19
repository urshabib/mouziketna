/**
 * PWA Helper utilities: Dynamic manifest generation, Custom App Naming, and Installation helpers
 */

const DEFAULT_APP_NAME = 'MOUZIKA';
const STORAGE_KEY = 'mouzika_app_name';

let activeBlobUrl: string | null = null;

export function getStoredAppName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || DEFAULT_APP_NAME;
  } catch {
    return DEFAULT_APP_NAME;
  }
}

export function applyCustomAppName(rawName: string): string {
  const name = rawName.trim() || DEFAULT_APP_NAME;
  const shortName = name.length > 12 ? name.slice(0, 12) : name;

  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {}

  // 1. Update Document Title
  document.title = name;

  // 2. Update Apple Mobile Web App Title
  let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleMeta) {
    appleMeta.setAttribute('content', name);
  } else {
    appleMeta = document.createElement('meta');
    appleMeta.setAttribute('name', 'apple-mobile-web-app-title');
    appleMeta.setAttribute('content', name);
    document.head.appendChild(appleMeta);
  }

  // 3. Update OG Title
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', name);

  // 4. Update Dynamic Manifest Blob for Chrome / Android / Desktop
  try {
    const manifestData = {
      id: './',
      name: name,
      short_name: shortName,
      description: 'Stream, search, and enjoy your music offline with synchronized lyrics.',
      start_url: './',
      scope: './',
      display: 'standalone',
      display_override: ['standalone', 'window-controls-overlay'],
      orientation: 'portrait',
      background_color: '#000000',
      theme_color: '#000000',
      categories: ['music', 'entertainment'],
      icons: [
        {
          src: './icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: './icon-maskable-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: './icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: './icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    };

    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
    }

    const blob = new Blob([JSON.stringify(manifestData, null, 2)], {
      type: 'application/manifest+json',
    });
    activeBlobUrl = URL.createObjectURL(blob);

    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute('href', activeBlobUrl);
    } else {
      manifestLink = document.createElement('link');
      manifestLink.setAttribute('rel', 'manifest');
      manifestLink.setAttribute('href', activeBlobUrl);
      document.head.appendChild(manifestLink);
    }
  } catch (e) {
    console.warn('Dynamic manifest creation failed:', e);
  }

  return name;
}

// Automatically apply stored app name on initial bundle evaluation
if (typeof window !== 'undefined') {
  const saved = getStoredAppName();
  if (saved && saved !== DEFAULT_APP_NAME) {
    applyCustomAppName(saved);
  }
}
