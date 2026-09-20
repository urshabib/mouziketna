/**
 * PWA Helper utilities: Dynamic manifest generation, Custom App Naming, and Installation helpers
 */

const DEFAULT_APP_NAME = 'MOUZIKA';
const STORAGE_KEY = 'mouzika_app_name';

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

  // 4. Ensure Web App Manifest always points to the valid static manifest
  // Note: Chromium security standards forbid blob: URLs for manifests and disable PWA installation if a blob URL is used.
  try {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink && manifestLink.getAttribute('href')?.startsWith('blob:')) {
      manifestLink.setAttribute('href', './manifest.json');
    }
  } catch (e) {
    console.warn('[MOUZIKA] Manifest verification warning:', e);
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
