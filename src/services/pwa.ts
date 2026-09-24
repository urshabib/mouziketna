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
  <circle cx="256" cy="256" r="200" fill="#1ED760"/>
  <g transform="translate(96, 96) scale(13.33333)">
    <path fill="#121212" d="M17.485 17.305c-.215.353-.674.467-1.027.252-2.812-1.718-6.352-2.107-10.521-1.154-.403.092-.806-.16-.898-.562-.092-.403.16-.806.562-.898 4.566-1.044 8.49-.602 11.632 1.335.353.215.467.674.252 1.027zm1.464-3.26c-.27.441-.849.582-1.29.312-3.218-1.978-8.124-2.551-11.93-1.394-.494.15-1.02-.133-1.17-.627-.15-.494.133-1.02.627-1.17 4.354-1.321 9.775-.684 13.451 1.576.441.27.582.849.312 1.303zm.135-3.398c-3.858-2.291-10.222-2.503-13.899-1.387-.591.18-1.218-.162-1.398-.753-.18-.591.162-1.218.753-1.398 4.229-1.284 11.265-1.036 15.698 1.597.531.315.706 1.002.391 1.533-.315.531-1.002.706-1.545.408z"/>
  </g>
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

export const BRANDING_CACHE_NAME = 'mouzika-branding-cache-v1';

let cachedPng192: string | null = null;
let cachedPng512: string | null = null;

export function getStoredAppName(): string {
  try {
    const val = localStorage.getItem(STORAGE_KEY)?.trim();
    if (!val || val === 'MOUZIKA') return DEFAULT_APP_NAME;
    return val;
  } catch {
    return DEFAULT_APP_NAME;
  }
}

/**
 * Rasterizes any image source (SVG preset, data URI, or cropped upload)
 * into an exact raster PNG (data URL + Blob) with high-quality smoothing.
 * This is crucial because Chrome Android / WebAPK installer rejects SVG icons.
 */
export async function rasterizeToPng(
  src: string,
  width: number,
  height: number
): Promise<{ dataUrl: string; blob: Blob | null }> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { dataUrl: src, blob: null };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrlToRevoke: string | null = null;

    if (src.startsWith('data:image/svg+xml')) {
      try {
        const svgContent = decodeURIComponent(
          src.replace(/^data:image\/svg\+xml;utf8,/, '').replace(/^data:image\/svg\+xml;base64,/, (m) => m)
        );
        if (!src.includes('base64,')) {
          const blob = new Blob([svgContent], { type: 'image/svg+xml' });
          objectUrlToRevoke = URL.createObjectURL(blob);
          img.src = objectUrlToRevoke;
        } else {
          img.src = src;
        }
      } catch {
        img.src = src;
      }
    } else {
      img.src = src;
    }

    img.onload = () => {
      try {
        if (objectUrlToRevoke) {
          URL.revokeObjectURL(objectUrlToRevoke);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: src, blob: null });
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        canvas.toBlob((blob) => {
          resolve({ dataUrl, blob });
        }, 'image/png');
      } catch (err) {
        console.warn('Canvas rasterization error:', err);
        resolve({ dataUrl: src, blob: null });
      }
    };

    img.onerror = (err) => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
      console.warn('Image rasterization error on load:', err);
      resolve({ dataUrl: src, blob: null });
    };
  });
}

export async function updatePwaManifest(
  appName: string,
  _png192Src?: string,
  _png512Src?: string
): Promise<void> {
  try {
    const timestamp = Date.now();
    const shortName = appName.length > 12 ? appName.substring(0, 12) : appName;
    const manifestJson = {
      id: "mouzika-player",
      name: appName,
      short_name: shortName,
      description: "Stream, search, and enjoy your music offline with synchronized lyrics.",
      start_url: "./",
      scope: "./",
      display: "standalone",
      display_override: ["standalone", "window-controls-overlay"],
      orientation: "portrait",
      background_color: "#000000",
      theme_color: "#000000",
      prefer_related_applications: false,
      categories: ["music", "entertainment"],
      icons: [
        {
          src: `./icon-192.png?t=${timestamp}`,
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: `./icon-maskable-192.png?t=${timestamp}`,
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable"
        },
        {
          src: `./icon-512.png?t=${timestamp}`,
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: `./icon-maskable-512.png?t=${timestamp}`,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        }
      ]
    };

    const manifestStr = JSON.stringify(manifestJson, null, 2);
    const blob = new Blob([manifestStr], { type: 'application/manifest+json; charset=utf-8' });

    // CRITICAL for WebAPK & Android Chrome:
    // DO NOT set link[rel="manifest"] href to a blob: URL!
    // WebAPK generators on Google cloud fail when attempting to fetch local blob: URLs,
    // which causes Chrome to downgrade the PWA to a simple bookmark shortcut with a browser badge.
    // Instead, keep href="./manifest.json" and let the Service Worker serve the customized response.
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.setAttribute('rel', 'manifest');
      manifestLink.setAttribute('href', './manifest.json');
      document.head.appendChild(manifestLink);
    } else if (manifestLink.getAttribute('href')?.startsWith('blob:')) {
      manifestLink.setAttribute('href', './manifest.json');
    }

    // Cache manifest in branding cache so Service Worker answers fetch requests
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const brandingCache = await caches.open(BRANDING_CACHE_NAME);
        const manifestResp = new Response(blob, {
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'no-cache, must-revalidate',
          },
        });
        await brandingCache.put('manifest.json', manifestResp.clone());
        await brandingCache.put('./manifest.json', manifestResp.clone());
        await brandingCache.put('/manifest.json', manifestResp.clone());
      } catch {}
    }
  } catch (e) {
    console.warn('[MOUZIKETNA] Dynamic manifest update notice:', e);
  }
}

export async function applyCustomAppName(rawName: string): Promise<string> {
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
  const png192 = cachedPng192 || getAppLogoSrc();
  const png512 = cachedPng512 || getAppLogoSrc();
  await updatePwaManifest(name, png192, png512);

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

/**
 * Applies custom logo for installed PWA / Home Screen:
 * - Rasterizes to true 192x192 and 512x512 PNGs
 * - Populates Service Worker cache so Chrome/Android icon fetch grabs the new image
 * - Updates dynamic Web App Manifest
 * - Updates Apple Touch Icon for iOS
 * - DOES NOT modify the website brand header or sidebar
 */
export async function applyCustomAppLogo(logoKeyOrDataUrl: string): Promise<string> {
  try {
    localStorage.setItem(LOGO_STORAGE_KEY, logoKeyOrDataUrl);
  } catch {}

  const rawLogoSrc = getAppLogoSrc(logoKeyOrDataUrl);

  // Dispatch event immediately so local previews in Install Modal update right away
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mouzika-logo-changed', { detail: logoKeyOrDataUrl }));
  }

  // 1. Generate real raster PNGs (192x192 and 512x512)
  const [raster192, raster512] = await Promise.all([
    rasterizeToPng(rawLogoSrc, 192, 192),
    rasterizeToPng(rawLogoSrc, 512, 512),
  ]);

  cachedPng192 = raster192.dataUrl;
  cachedPng512 = raster512.dataUrl;

  // 2. Put both PNG Blobs into Service Worker Cache Storage
  // When Chrome installs the app, requests for icon-192.png and icon-512.png
  // are intercepted by sw.js and served with these custom images!
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const brandingCache = await caches.open(BRANDING_CACHE_NAME);
      if (raster192.blob) {
        const r192 = new Response(raster192.blob, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, must-revalidate',
          },
        });
        await brandingCache.put('icon-192.png', r192.clone());
        await brandingCache.put('./icon-192.png', r192.clone());
        await brandingCache.put('/icon-192.png', r192.clone());
        await brandingCache.put('icon-maskable-192.png', r192.clone());
        await brandingCache.put('./icon-maskable-192.png', r192.clone());
        await brandingCache.put('/icon-maskable-192.png', r192.clone());
        await brandingCache.put('apple-touch-icon.png', r192.clone());
        await brandingCache.put('./apple-touch-icon.png', r192.clone());
        await brandingCache.put('/apple-touch-icon.png', r192.clone());
        await brandingCache.put('favicon.png', r192.clone());
      }
      if (raster512.blob) {
        const r512 = new Response(raster512.blob, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, must-revalidate',
          },
        });
        await brandingCache.put('icon-512.png', r512.clone());
        await brandingCache.put('./icon-512.png', r512.clone());
        await brandingCache.put('/icon-512.png', r512.clone());
        await brandingCache.put('icon-maskable-512.png', r512.clone());
        await brandingCache.put('./icon-maskable-512.png', r512.clone());
        await brandingCache.put('/icon-maskable-512.png', r512.clone());
      }
    } catch (e) {
      console.warn('Error updating brandingCache:', e);
    }
  }

  // 3. Update apple-touch-icon & head favicons for iOS & mobile browsers
  try {
    const iconRels = ['apple-touch-icon', 'apple-touch-icon-precomposed', 'icon', 'shortcut icon'];
    iconRels.forEach((rel) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (link) {
        link.setAttribute('href', raster192.dataUrl);
      } else {
        link = document.createElement('link');
        link.setAttribute('rel', rel);
        link.setAttribute('href', raster192.dataUrl);
        document.head.appendChild(link);
      }
    });
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute('content', raster512.dataUrl);
  } catch {}

  // 4. Update the Web App Manifest with both relative URLs and base64 PNG data URLs
  const currentAppName = getStoredAppName();
  await updatePwaManifest(currentAppName, raster192.dataUrl, raster512.dataUrl);

  return raster192.dataUrl;
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

export function hasPwaInstallPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { __deferredPrompt?: unknown }).__deferredPrompt);
}

export async function promptPwaInstall(): Promise<{ outcome: 'accepted' | 'dismissed' | 'unavailable' }> {
  if (typeof window === 'undefined') return { outcome: 'unavailable' };
  const promptEvent = (
    window as unknown as {
      __deferredPrompt?: {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
      };
    }
  ).__deferredPrompt;

  if (!promptEvent) {
    return { outcome: 'unavailable' };
  }

  try {
    await promptEvent.prompt();
    const result = await promptEvent.userChoice;
    if (result.outcome === 'accepted') {
      (window as unknown as { __deferredPrompt?: unknown }).__deferredPrompt = null;
      window.dispatchEvent(new CustomEvent('pwa-installed'));
    }
    return result;
  } catch (err) {
    console.warn('PWA prompt execution error:', err);
    return { outcome: 'unavailable' };
  }
}

// Automatically apply stored app name & logo on initial bundle evaluation
if (typeof window !== 'undefined') {
  const savedName = getStoredAppName();
  if (savedName) {
    applyCustomAppName(savedName);
  }
  const savedLogo = getStoredAppLogo();
  if (savedLogo) {
    applyCustomAppLogo(savedLogo);
  }
}
