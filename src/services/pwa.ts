/**
 * PWA Helper utilities: Dynamic manifest generation, Custom App Naming, Logo Customization, and Installation helpers
 */

export const DEFAULT_APP_NAME = 'MOUZIKETNA';
const STORAGE_KEY = 'mouzika_app_name';
const LOGO_STORAGE_KEY = 'mouzika_app_logo';

// Preset Logo SVGs (sharp vector definitions)
export interface LogoPreset {
  id: string;
  name: string;
  description: string;
  bgColor: string;
  accentColor: string;
  svgDataUri: string;
}

function makePulseSvg(options: {
  bgFrom: string;
  bgMid: string;
  bgTo: string;
  pulseFrom: string;
  pulseMid: string;
  pulseTo: string;
  auraColor: string;
  borderColor?: string;
  borderWidth?: number;
}): string {
  const {
    bgFrom,
    bgMid,
    bgTo,
    pulseFrom,
    pulseMid,
    pulseTo,
    auraColor,
    borderColor = 'rgba(255,255,255,0.12)',
    borderWidth = 3,
  } = options;

  const svg = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="${bgFrom}"/>
      <stop offset="55%" stop-color="${bgMid}"/>
      <stop offset="100%" stop-color="${bgTo}"/>
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <linearGradient id="pulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${pulseFrom}"/>
      <stop offset="50%" stop-color="${pulseMid}"/>
      <stop offset="100%" stop-color="${pulseTo}"/>
    </linearGradient>
    <radialGradient id="aura" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${auraColor}" stop-opacity="0.32"/>
      <stop offset="60%" stop-color="${auraColor}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${auraColor}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#bgGlow)"/>
  <rect x="2" y="2" width="508" height="508" rx="113" stroke="${borderColor}" stroke-width="${borderWidth}"/>
  <circle cx="256" cy="256" r="180" fill="url(#aura)"/>
  <g transform="translate(94, 94) scale(13.5)" filter="url(#glow)">
    <path d="M9 7.53861L15 21.5386L18.6594 13H23V11H17.3406L15 16.4614L9 2.46143L5.3406 11H1V13H6.6594L9 7.53861Z" fill="url(#pulseGrad)"/>
  </g>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function makeSpotifySvg(): string {
  const svg = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="115" fill="#121212"/>
  <rect x="2" y="2" width="508" height="508" rx="113" stroke="rgba(255, 255, 255, 0.08)" stroke-width="3"/>
  <circle cx="256" cy="256" r="185" fill="#1ed760"/>
  <path fill="#121212" d="M371.4 233.8c-76.3-45.3-202.4-49.5-275.3-27.4-11.7 3.6-24.1-3-27.7-14.7-3.6-11.7 3-24.1 14.7-27.7 83.8-25.4 223-20.6 310.8 31.5 10.5 6.2 13.9 19.8 7.7 30.3-6.2 10.5-19.8 13.9-30.2 8zm-2.4 61.2c-5.8 9.5-18.1 12.5-27.6 6.7-63.5-39-160.3-50.3-235.4-27.5-10.7 3.3-22.1-2.7-25.4-13.4-3.3-10.7 2.7-22.1 13.4-25.4 86-26.1 192.6-13.4 266.3 32 9.5 5.8 12.5 18.1 6.7 27.6zm-24.7 59.8c-4.6 7.6-14.5 10-22.1 5.4-55.4-33.8-125.2-41.5-207.3-22.7-8.7 2-17.4-3.4-19.4-12.1-2-8.7 3.4-17.4 12.1-19.4 90.1-20.6 167.3-11.8 229.3 26.1 7.6 4.7 10 14.6 5.4 22.2z"/>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export const LOGO_PRESETS: LogoPreset[] = [
  {
    id: 'default',
    name: 'Flame Pulse (Original)',
    description: 'Obsidian black with the iconic fire-orange pulse waveform',
    bgColor: '#0e0a06',
    accentColor: '#ff6b1a',
    svgDataUri: makePulseSvg({
      bgFrom: '#24140b',
      bgMid: '#111113',
      bgTo: '#060607',
      pulseFrom: '#ff8c3c',
      pulseMid: '#ff6b1a',
      pulseTo: '#ff4f00',
      auraColor: '#ff6b1a',
      borderColor: 'rgba(255,255,255,0.12)',
    }),
  },
  {
    id: 'cyber',
    name: 'Cyber Emerald',
    description: 'Dark cyber aesthetic with neon emerald acoustic waveform',
    bgColor: '#07100b',
    accentColor: '#10b981',
    svgDataUri: makePulseSvg({
      bgFrom: '#071f12',
      bgMid: '#0d1711',
      bgTo: '#040806',
      pulseFrom: '#4ade80',
      pulseMid: '#10b981',
      pulseTo: '#059669',
      auraColor: '#10b981',
      borderColor: 'rgba(16,185,129,0.25)',
    }),
  },
  {
    id: 'violet',
    name: 'Cosmic Violet',
    description: 'Deep royal purple with ultraviolet electric waveform',
    bgColor: '#12091c',
    accentColor: '#a855f7',
    svgDataUri: makePulseSvg({
      bgFrom: '#250d36',
      bgMid: '#13091e',
      bgTo: '#07030c',
      pulseFrom: '#d8b4fe',
      pulseMid: '#a855f7',
      pulseTo: '#7e22ce',
      auraColor: '#a855f7',
      borderColor: 'rgba(168,85,247,0.25)',
    }),
  },
  {
    id: 'amber',
    name: 'Amber Gold',
    description: 'Rich dark amber with 24k liquid gold pulse waveform',
    bgColor: '#160e03',
    accentColor: '#f59e0b',
    svgDataUri: makePulseSvg({
      bgFrom: '#2b1b04',
      bgMid: '#160e03',
      bgTo: '#080501',
      pulseFrom: '#fde047',
      pulseMid: '#f59e0b',
      pulseTo: '#d97706',
      auraColor: '#f59e0b',
      borderColor: 'rgba(245,158,11,0.25)',
    }),
  },
  {
    id: 'white',
    name: 'Diamond Platinum',
    description: 'Clean luxury porcelain with graphite acoustic waveform',
    bgColor: '#ffffff',
    accentColor: '#121214',
    svgDataUri: makePulseSvg({
      bgFrom: '#ffffff',
      bgMid: '#f1f3f5',
      bgTo: '#e2e5e9',
      pulseFrom: '#09090b',
      pulseMid: '#27272a',
      pulseTo: '#3f3f46',
      auraColor: 'rgba(0,0,0,0.06)',
      borderColor: 'rgba(0,0,0,0.12)',
    }),
  },
  {
    id: 'spotify',
    name: 'Spotify Iconic',
    description: 'Authentic official Spotify green emblem and 3 arched waves',
    bgColor: '#121212',
    accentColor: '#1ed760',
    svgDataUri: makeSpotifySvg(),
  },
];

export function getStoredAppName(): string {
  try {
    const val = localStorage.getItem(STORAGE_KEY)?.trim();
    if (!val || val === 'MOUZIKA') return DEFAULT_APP_NAME;
    return val;
  } catch {
    return DEFAULT_APP_NAME;
  }
}

export function updatePwaManifest(appName: string, logoSrc: string): void {
  try {
    const manifestJson = {
      id: "mouzika-player",
      name: appName,
      short_name: appName,
      description: "Stream, search, and enjoy your music offline with synchronized lyrics.",
      start_url: "./",
      scope: "./",
      display: "standalone",
      display_override: ["standalone", "window-controls-overlay"],
      orientation: "portrait",
      background_color: "#000000",
      theme_color: "#000000",
      categories: ["music", "entertainment"],
      icons: [
        {
          src: logoSrc,
          sizes: "192x192 512x512",
          type: logoSrc.startsWith('data:image/svg') ? "image/svg+xml" : "image/png",
          purpose: "any"
        },
        {
          src: logoSrc,
          sizes: "192x192 512x512",
          type: logoSrc.startsWith('data:image/svg') ? "image/svg+xml" : "image/png",
          purpose: "maskable"
        }
      ]
    };

    const blob = new Blob([JSON.stringify(manifestJson, null, 2)], { type: 'application/manifest+json' });
    const blobUrl = URL.createObjectURL(blob);

    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute('href', blobUrl);
    } else {
      manifestLink = document.createElement('link');
      manifestLink.setAttribute('rel', 'manifest');
      manifestLink.setAttribute('href', blobUrl);
      document.head.appendChild(manifestLink);
    }
  } catch (e) {
    console.warn('[MOUZIKETNA] Dynamic manifest update notice:', e);
  }
}

export function applyCustomAppName(rawName: string): string {
  const name = rawName.trim() || DEFAULT_APP_NAME;

  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {}

  // 1. DO NOT touch document.title (preserve permanent website title MOUZIKETNA)
  // document.title remains unaltered

  // 2. Update Apple Mobile Web App Title for iOS Add to Home Screen
  let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleMeta) {
    appleMeta.setAttribute('content', name);
  } else {
    appleMeta = document.createElement('meta');
    appleMeta.setAttribute('name', 'apple-mobile-web-app-title');
    appleMeta.setAttribute('content', name);
    document.head.appendChild(appleMeta);
  }

  // 3. Update Web App Manifest so Chrome / Android uses this name on Home Screen
  const currentLogoSrc = getAppLogoSrc();
  updatePwaManifest(name, currentLogoSrc);

  return name;
}

export function getStoredAppLogo(): string {
  try {
    return localStorage.getItem(LOGO_STORAGE_KEY) || 'default';
  } catch {
    return 'default';
  }
}

export function getAppLogoSrc(logoKeyOrDataUrl?: string | null): string {
  const rawKey = logoKeyOrDataUrl || getStoredAppLogo();
  const key = rawKey === 'green' ? 'cyber' : rawKey;

  if (key.startsWith('data:') || key.startsWith('blob:') || key.startsWith('http')) {
    return key;
  }
  const preset = LOGO_PRESETS.find((p) => p.id === key);
  return preset ? preset.svgDataUri : LOGO_PRESETS[0].svgDataUri;
}

export function applyCustomAppLogo(logoKeyOrDataUrl: string): void {
  try {
    localStorage.setItem(LOGO_STORAGE_KEY, logoKeyOrDataUrl);
  } catch {}

  const logoSrc = getAppLogoSrc(logoKeyOrDataUrl);

  // 1. Dynamically update head favicons & touch icons for iOS and browser
  try {
    const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
    rels.forEach((rel) => {
      const links = document.querySelectorAll(`link[rel="${rel}"]`);
      links.forEach((l) => {
        l.setAttribute('href', logoSrc);
      });
    });

    // Also update og:image meta tag
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute('content', logoSrc);
  } catch {}

  // 2. Update Web App Manifest so Chrome / Android uses this icon on Home Screen
  const currentAppName = getStoredAppName();
  updatePwaManifest(currentAppName, logoSrc);

  // Dispatch event for reactive UI update across components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mouzika-logo-changed', { detail: logoKeyOrDataUrl }));
  }
}

/**
 * Force Refresh & Update website from network without affecting user data:
 * - Unregisters/updates active service workers
 * - Deletes browser CacheStorage (HTTP assets: HTML/JS/CSS)
 * - DOES NOT touch IndexedDB or localStorage (downloaded songs, playlists, lyrics, account remain 100% safe)
 * - Reloads with a cache-busting timestamp
 */
export async function forceAppUpdateAndRefresh(): Promise<void> {
  try {
    // 1. Trigger Service Worker update checks
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          try {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          } catch {}
        }
      } catch {}
    }

    // 2. Clear browser CacheStorage (HTML, CSS, JS bundles)
    // NOTE: This ONLY purges HTTP file caches.
    // It DOES NOT touch IndexedDB or localStorage, preserving all downloaded songs & user credentials!
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((name) => caches.delete(name).catch(() => false))
        );
      } catch {}
    }

    // 3. Make a network request with cache: 'reload'
    try {
      await fetch(`/?_ts=${Date.now()}`, { cache: 'reload' });
    } catch {}

    // 4. Force hard reload from the server bypassing cache
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('_refresh', Date.now().toString());
    window.location.replace(currentUrl.toString());
  } catch (err) {
    console.error('Failed to force refresh:', err);
    window.location.reload();
  }
}

// Automatically apply stored app name & logo on initial bundle evaluation
if (typeof window !== 'undefined') {
  const savedName = getStoredAppName();
  if (savedName) {
    applyCustomAppName(savedName);
  }
  const savedLogo = getStoredAppLogo();
  if (savedLogo && savedLogo !== 'default') {
    applyCustomAppLogo(savedLogo);
  }
}
