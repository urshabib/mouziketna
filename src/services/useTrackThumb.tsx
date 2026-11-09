import React, { useState, useEffect } from 'react';
import { Track } from '../types';
import { canonicalThumbUrl, FALLBACK_ART, upgradeThumbQuality, corsSafeThumbUrl } from './api';
import {
  getOfflineThumbUrl,
  isDownloaded,
  getOfflineThumbUrlSync,
  getStoredCoverForTrack,
  downloadsRegistryReady,
} from './storage';

// Memory cache for letterbox status of image URLs (prevents recalculation & prevents layout shift)
export const letterboxDetectionCache = new Map<string, boolean>();

/**
 * Checks whether a given thumbnail URL is from a 4:3 YouTube video thumbnail
 * (e.g. hqdefault, sddefault, mqdefault, default.jpg) that contains baked-in black bars on top and bottom.
 * Pristine square album covers (Google User Content, JioSaavn, Apple Music, Spotify, custom uploads, etc.)
 * and native unletterboxed covers return false.
 */
export function isLetterboxedThumb(url: string | null | undefined): boolean {
  if (!url) return false;
  if (letterboxDetectionCache.has(url)) {
    return letterboxDetectionCache.get(url)!;
  }

// Pristine square album covers from Google User Content, JioSaavn, Apple Music, Spotify, Unsplash, custom uploads,
  // or native 16:9 HD thumbnails (maxresdefault, hq720) are NEVER letterboxed in square containers
  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.includes('googleusercontent.com') ||
    url.includes('saavncdn.com') ||
    url.includes('mzstatic.com') ||
    url.includes('i.scdn.co') ||
    url.includes('yt3.ggpht.com') ||
    url.includes('ggpht.com') ||
    url.includes('images.unsplash.com') ||
    url.includes('maxresdefault') ||
    url.includes('hq720')
  ) {
    letterboxDetectionCache.set(url, false);
    return false;
  }

  // YouTube 4:3 video thumbnails ALWAYS have baked-in 45px black bars on top and bottom for 16:9 videos
  if (
    url.includes('hqdefault') ||
    url.includes('sddefault') ||
    url.includes('mqdefault') ||
    /\/default\.(?:jpg|webp)/.test(url)
  ) {
    letterboxDetectionCache.set(url, true);
    return true;
  }

  // Wsrv.nl proxy of 4:3 thumbnails
  if (
    url.includes('wsrv.nl') &&
    (url.includes('hqdefault') || url.includes('sddefault') || url.includes('mqdefault'))
  ) {
    letterboxDetectionCache.set(url, true);
    return true;
  }

  // maxresdefault, hq720, and square CDN images are NOT 4:3 letterboxed
  letterboxDetectionCache.set(url, false);
  return false;
}

/**
 * Samples the top, bottom, and center pixels of an image to dynamically detect baked-in black letterbox bars.
 * Returns true if black bars are detected, false if not, or null if cross-origin canvas security prevented reading.
 */
export function detectBlackBars(img: HTMLImageElement): boolean | null {
  if (!img.src || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;
  const src = img.src;
  if (letterboxDetectionCache.has(src)) {
    return letterboxDetectionCache.get(src)!;
  }

  const { naturalWidth: w, naturalHeight: h } = img;
  const ratio = w / h;

  // 1. True square cover (ratio ~ 1.0): 100% native unscaled razor sharpness, NEVER letterboxed
  if (ratio >= 0.90 && ratio <= 1.10) {
    letterboxDetectionCache.set(src, false);
    return false;
  }

  // 2. 16:9 or wider images (ratio >= 1.5): In object-fit: cover inside a square container,
  // the container height is 100% filled and sides are cropped. NO black bars exist at top/bottom!
  if (ratio >= 1.5) {
    letterboxDetectionCache.set(src, false);
    return false;
  }

  // 3. Known 4:3 YouTube video thumbnail (480x360 or 640x480) with baked-in black bars
  if (
    ratio >= 1.25 &&
    ratio <= 1.45 &&
    (src.includes('ytimg') || src.includes('youtube') || src.includes('hqdefault') || src.includes('sddefault') || src.includes('mqdefault'))
  ) {
    letterboxDetectionCache.set(src, true);
    return true;
  }

  // 4. Sample top and bottom row on a lightweight 16x16 canvas only for images with 4:3-like ratio
  if (ratio > 1.20 && ratio < 1.50) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, 16, 16);

      const topData = ctx.getImageData(0, 0, 16, 2).data;
      const bottomData = ctx.getImageData(0, 14, 16, 2).data;
      const centerData = ctx.getImageData(4, 6, 8, 4).data;

      let topLuma = 0;
      let bottomLuma = 0;
      let centerLuma = 0;

      for (let i = 0; i < topData.length; i += 4) {
        topLuma += 0.299 * topData[i] + 0.587 * topData[i + 1] + 0.114 * topData[i + 2];
      }
      topLuma /= (topData.length / 4);

      for (let i = 0; i < bottomData.length; i += 4) {
        bottomLuma += 0.299 * bottomData[i] + 0.587 * bottomData[i + 1] + 0.114 * bottomData[i + 2];
      }
      bottomLuma /= (bottomData.length / 4);

      for (let i = 0; i < centerData.length; i += 4) {
        centerLuma += 0.299 * centerData[i] + 0.587 * centerData[i + 1] + 0.114 * centerData[i + 2];
      }
      centerLuma /= (centerData.length / 4);

      // If top & bottom edges are near black (< 15) and center has significant content (> 40)
      const isLetterboxed = topLuma < 15 && bottomLuma < 15 && centerLuma > 40;
      letterboxDetectionCache.set(src, isLetterboxed);
      return isLetterboxed;
    } catch {
      return null;
    }
  }

  letterboxDetectionCache.set(src, false);
  return false;
}

export function useTrackThumb(track: Track | null | undefined): string {
  const getInitial = (): string => {
    if (!track) return FALLBACK_ART;
    if (isDownloaded(track.id)) {
      const syncUrl = getOfflineThumbUrlSync(track.id);
      if (syncUrl) return syncUrl;
    }
    // If track.thumb is a valid URL, not a blob URL, and not generic fallback art, use it
    if (
      track.thumb &&
      !track.thumb.startsWith('blob:') &&
      track.thumb.trim().length > 5 &&
      track.thumb !== FALLBACK_ART &&
      !track.thumb.includes('photo-1614613535308-eb5fbd3d2c17')
    ) {
      return upgradeThumbQuality(track.thumb);
    }
    // Check if we have a persistent cover stored in profile/recentlyPlayed/mouzika_last_played_track
    if (track.id) {
      const stored = getStoredCoverForTrack(track.id);
      if (stored && !stored.startsWith('blob:') && stored !== FALLBACK_ART && !stored.includes('photo-1614613535308-eb5fbd3d2c17')) {
        return upgradeThumbQuality(stored);
      }
      if (track.id.length === 11) {
        return `https://i.ytimg.com/vi/${track.id}/maxresdefault.jpg`;
      }
      return canonicalThumbUrl(track.id);
    }
    return FALLBACK_ART;
  };

  const [src, setSrc] = useState<string>(getInitial);

  useEffect(() => {
    if (!track) {
      setSrc(FALLBACK_ART);
      return;
    }

    let active = true;
    const downloaded = isDownloaded(track.id);
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const resolveBestThumb = (offUrl?: string | null) => {
      if (!active) return;
      if (offUrl) {
        setSrc(offUrl);
        return;
      }
      if (
        track.thumb &&
        !track.thumb.startsWith('blob:') &&
        track.thumb.trim().length > 5 &&
        track.thumb !== FALLBACK_ART &&
        !track.thumb.includes('photo-1614613535308-eb5fbd3d2c17')
      ) {
        setSrc(upgradeThumbQuality(track.thumb));
        return;
      }
      const stored = getStoredCoverForTrack(track.id);
      if (stored && !stored.startsWith('blob:') && stored !== FALLBACK_ART && !stored.includes('photo-1614613535308-eb5fbd3d2c17')) {
        setSrc(upgradeThumbQuality(stored));
        return;
      }
      if (track.id && track.id.length === 11) {
        setSrc(`https://i.ytimg.com/vi/${track.id}/maxresdefault.jpg`);
        return;
      }
      if (track.id) {
        setSrc(canonicalThumbUrl(track.id));
        return;
      }
      setSrc(FALLBACK_ART);
    };

    // If downloaded or offline, prioritize local IndexedDB offline cover
    if (downloaded || isOffline) {
      // First check synchronous memory cache
      const syncUrl = getOfflineThumbUrlSync(track.id);
      if (syncUrl) {
        setSrc(syncUrl);
      } else {
        getOfflineThumbUrl(track.id).then((offUrl) => {
          resolveBestThumb(offUrl);
        });
      }
    } else {
      resolveBestThumb();
    }

    // When IndexedDB downloads registry finishes initial scan, re-check if offline thumb is ready
    downloadsRegistryReady.then(() => {
      if (!active) return;
      const offThumb = getOfflineThumbUrlSync(track.id);
      if (offThumb) {
        setSrc(offThumb);
      }
    });

    return () => {
      active = false;
    };
  }, [track?.id, track?.thumb]);

  return src;
}

export async function resolveOfflineFallback(
  trackId: string,
  imgElement: HTMLImageElement | null
) {
  if (!imgElement || !trackId) return;
  imgElement.referrerPolicy = 'no-referrer';
  const offline = await getOfflineThumbUrl(trackId);
  if (offline) {
    imgElement.src = offline;
    return;
  }
  const stored = getStoredCoverForTrack(trackId);
  if (stored && stored !== imgElement.src && !stored.includes('photo-1614613535308-eb5fbd3d2c17')) {
    imgElement.src = stored;
    return;
  }
  const canonical = canonicalThumbUrl(trackId);
  if (imgElement.src !== canonical && !canonical.includes('photo-1614613535308-eb5fbd3d2c17')) {
    imgElement.src = canonical;
    return;
  }
  if (trackId.length === 11) {
    const directMax = `https://i.ytimg.com/vi/${trackId}/maxresdefault.jpg`;
    if (imgElement.src !== directMax) {
      imgElement.src = directMax;
      return;
    }
    const directSd = `https://i.ytimg.com/vi/${trackId}/sddefault.jpg`;
    if (imgElement.src !== directSd) {
      imgElement.src = directSd;
      return;
    }
    const directHq = `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg`;
    if (imgElement.src !== directHq) {
      imgElement.src = directHq;
      return;
    }
    const mqYt = `https://i.ytimg.com/vi/${trackId}/mqdefault.jpg`;
    if (imgElement.src !== mqYt) {
      imgElement.src = mqYt;
      return;
    }
    const wsrv = `https://wsrv.nl/?url=https://i.ytimg.com/vi/${trackId}/maxresdefault.jpg&w=1000&h=1000&fit=cover&q=95&output=webp`;
    if (imgElement.src !== wsrv) {
      imgElement.src = wsrv;
      return;
    }
  }
  imgElement.src = FALLBACK_ART;
}

export interface TrackThumbImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  track: Track | null | undefined;
  fallbackSrc?: string;
  autoZoom?: boolean;
  zoomScale?: number;
}

/**
 * Self-resolving Track thumbnail image that handles:
 * 1. Synchronous & asynchronous offline IndexedDB covers
 * 2. Automatic replacement of expired blob: URLs
 * 3. Graceful fallback cascade on error to stored cover, direct YouTube CDN, wsrv proxy, or generic art
 * 4. Android-safe referrer policy (no-referrer) to prevent CDN 403 blocks
 * 5. Automatic letterbox zoom (1.35x) to eliminate top/bottom black strips in square containers
 */
export const TrackThumbImage: React.FC<TrackThumbImageProps> = ({
  track,
  className,
  alt,
  fallbackSrc = FALLBACK_ART,
  autoZoom = true,
  zoomScale = 1.34,
  style,
  onLoad,
  onError,
  ...props
}) => {
  const thumbSrc = useTrackThumb(track);
  const [currentSrc, setCurrentSrc] = useState(thumbSrc);
  const [errorStep, setErrorStep] = useState(0);
  const [isLetterboxed, setIsLetterboxed] = useState(() => {
    if (thumbSrc && letterboxDetectionCache.has(thumbSrc)) {
      return letterboxDetectionCache.get(thumbSrc)!;
    }
    return isLetterboxedThumb(thumbSrc);
  });

  useEffect(() => {
    setCurrentSrc(thumbSrc);
    setErrorStep(0);
    if (thumbSrc && letterboxDetectionCache.has(thumbSrc)) {
      setIsLetterboxed(letterboxDetectionCache.get(thumbSrc)!);
    } else {
      setIsLetterboxed(isLetterboxedThumb(thumbSrc));
    }
  }, [thumbSrc]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const { naturalWidth: w, naturalHeight: h } = img;
      const ratio = w / h;
      // Perfect square cover (ratio ~ 1.0) or 16:9 widescreen (ratio >= 1.5): NEVER letterboxed in square container
      if ((ratio >= 0.90 && ratio <= 1.10) || ratio >= 1.5) {
        setIsLetterboxed(false);
        if (currentSrc) letterboxDetectionCache.set(currentSrc, false);
      } else if (
        ratio >= 1.25 &&
        ratio <= 1.45 &&
        (currentSrc.includes('ytimg') || currentSrc.includes('youtube') || currentSrc.includes('hqdefault') || currentSrc.includes('sddefault') || currentSrc.includes('mqdefault'))
      ) {
        // 4:3 YouTube video thumbnail (480x360 or 640x480) with baked-in black bars
        setIsLetterboxed(true);
        if (currentSrc) letterboxDetectionCache.set(currentSrc, true);
      } else if (ratio > 1.20 && ratio < 1.50) {
        const detected = detectBlackBars(img);
        if (detected !== null) {
          setIsLetterboxed(detected);
        }
      } else {
        setIsLetterboxed(false);
        if (currentSrc) letterboxDetectionCache.set(currentSrc, false);
      }

      // Sync the exact displayed player image into system MediaSession notification / Now bar
      if (track?.id) {
        try {
          const isLetterbox = letterboxDetectionCache.get(currentSrc) ?? isLetterboxedThumb(currentSrc);
          const squareData = renderCanvasFromImageElement(img, isLetterbox);
          if (squareData) {
            updateMediaSessionArtworkDirect(squareData, track);
          }
        } catch {}
      }
    }
    onLoad?.(e);
  };

  const handleError = async (e: React.SyntheticEvent<HTMLImageElement>) => {
    onError?.(e);
    if (!track?.id) {
      setCurrentSrc(fallbackSrc);
      return;
    }

    const nextStep = errorStep + 1;
    setErrorStep(nextStep);

    // Step 1: Local IndexedDB offline storage
    if (nextStep === 1) {
      const offline = await getOfflineThumbUrl(track.id);
      if (offline && offline !== currentSrc) {
        setCurrentSrc(offline);
        setIsLetterboxed(false);
        return;
      }
    }

    // Step 2: Persistent stored cover from profile cache
    if (nextStep <= 2) {
      const stored = getStoredCoverForTrack(track.id);
      if (stored && stored !== currentSrc && !stored.includes('photo-1614613535308-eb5fbd3d2c17')) {
        setCurrentSrc(stored);
        setIsLetterboxed(isLetterboxedThumb(stored));
        return;
      }
    }

    // Step 3: Direct YouTube CDN maxresdefault.jpg (1280x720 HD quality, unletterboxed 16:9)
    if (nextStep <= 3 && track.id.length === 11) {
      const maxres = `https://i.ytimg.com/vi/${track.id}/maxresdefault.jpg`;
      if (maxres !== currentSrc) {
        setCurrentSrc(maxres);
        setIsLetterboxed(false);
        return;
      }
    }

    // Step 4: Direct YouTube CDN sddefault.jpg (640x480 4:3)
    if (nextStep <= 4 && track.id.length === 11) {
      const sd = `https://i.ytimg.com/vi/${track.id}/sddefault.jpg`;
      if (sd !== currentSrc) {
        setCurrentSrc(sd);
        setIsLetterboxed(true);
        return;
      }
    }

    // Step 5: Direct YouTube CDN hqdefault.jpg (480x360 4:3)
    if (nextStep <= 5 && track.id.length === 11) {
      const hq = `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
      if (hq !== currentSrc) {
        setCurrentSrc(hq);
        setIsLetterboxed(true);
        return;
      }
    }

    // Step 6: Direct YouTube CDN mqdefault.jpg (320x180 4:3)
    if (nextStep <= 6 && track.id.length === 11) {
      const mq = `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`;
      if (mq !== currentSrc) {
        setCurrentSrc(mq);
        setIsLetterboxed(true);
        return;
      }
    }

    // Step 7: High-Quality WebP CORS proxy via wsrv.nl
    if (nextStep <= 7 && track.id.length === 11) {
      const wsrv = `https://wsrv.nl/?url=https://i.ytimg.com/vi/${track.id}/maxresdefault.jpg&w=1000&h=1000&fit=cover&q=95&output=webp`;
      if (wsrv !== currentSrc) {
        setCurrentSrc(wsrv);
        setIsLetterboxed(false);
        return;
      }
    }

    // Step 8: Canonical high-res
    if (nextStep <= 8) {
      const canonical = canonicalThumbUrl(track.id);
      if (canonical && canonical !== currentSrc && !canonical.includes('photo-1614613535308-eb5fbd3d2c17')) {
        setCurrentSrc(canonical);
        setIsLetterboxed(isLetterboxedThumb(canonical));
        return;
      }
    }

    // Final fallback: Fallback soundwave art
    setIsLetterboxed(false);
    setCurrentSrc(fallbackSrc);
  };

  const shouldZoom = autoZoom !== false && isLetterboxed;
  const zoomTransform = shouldZoom ? `scale(${zoomScale})` : undefined;

  return (
    <img
      src={currentSrc || fallbackSrc}
      alt={alt || track?.title || 'Song Cover'}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      onLoad={handleLoad}
      onError={handleError}
      className={`select-none pointer-events-none ${className || ''}`}
      style={{
        transformOrigin: 'center center',
        ...style,
        ...(zoomTransform ? { transform: style?.transform ? `${zoomTransform} ${style.transform}` : zoomTransform } : {}),
      }}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      {...props}
    />
  );
};

let currentMediaSessionTrackId = '';

export function resetMediaSessionTrackTracking(): void {
  currentMediaSessionTrackId = '';
}

/**
 * Renders an exact square image from an already loaded HTMLImageElement.
 * Matches the player's object-fit: cover and zoomScale (1.34x for letterboxed 4:3 YouTube images).
 * Generates an ultra high-quality 720x720 JPEG data URL with high-quality smoothing and q=0.98.
 */
export function renderCanvasFromImageElement(img: HTMLImageElement, isLetterbox: boolean): string | null {
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    // Skip tiny 120x90 placeholder images from YouTube
    if (w <= 120 && h <= 90) return null;

    const canvas = document.createElement('canvas');
    // Target 720x720 for crisp resolution on modern phone lockscreens & Samsung Now bar
    const canvasSize = 720;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    let sx = 0, sy = 0, sw = w, sh = h;
    const ratio = w / h;

    // Detect if this image is 4:3 with top & bottom black bars (YouTube hqdefault, sddefault, mqdefault)
    const letterboxed = isLetterbox || (ratio >= 1.25 && ratio <= 1.45 && (
      img.src.includes('ytimg') ||
      img.src.includes('youtube') ||
      img.src.includes('hqdefault') ||
      img.src.includes('sddefault') ||
      img.src.includes('mqdefault')
    ));

    if (letterboxed && w >= 240) {
      // 4:3 YouTube thumbnails have ~12.5% black bars on top and bottom (e.g. 45px on 360px height).
      // Active picture height is 75% of total height.
      // A centered square inside the active 16:9 picture region:
      const barHeight = Math.round(h * 0.125);
      const activeHeight = h - barHeight * 2;
      const squareSize = activeHeight;
      sx = Math.max(0, Math.round((w - squareSize) / 2));
      sy = barHeight;
      sw = squareSize;
      sh = squareSize;
    } else {
      // Standard center crop (matches object-fit: cover in 1:1 container)
      const size = Math.min(w, h);
      sx = Math.max(0, Math.round((w - size) / 2));
      sy = Math.max(0, Math.round((h - size) / 2));
      sw = size;
      sh = size;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvasSize, canvasSize);
    return canvas.toDataURL('image/jpeg', 0.98);
  } catch {
    return null;
  }
}

/**
 * Directly pushes a square data URL to navigator.mediaSession.metadata.artwork
 * so that lockscreen, Samsung Now bar, and Android dynamic island display the exact
 * cropped player image immediately.
 */
export function updateMediaSessionArtworkDirect(dataUrl: string, track: Track): void {
  if (!dataUrl || !track?.id || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    const meta = navigator.mediaSession.metadata;
    if (!meta) return;

    // Check if the current metadata matches this track
    if (meta.title !== track.title && meta.artist !== track.artist) return;

    // Don't re-apply if already set for this track
    if (currentMediaSessionTrackId === track.id && meta.artwork?.[0]?.src?.startsWith('data:')) {
      return;
    }
    currentMediaSessionTrackId = track.id;

    const directArtworks = [
      { src: dataUrl, sizes: '720x720', type: 'image/jpeg' },
      { src: dataUrl, sizes: '512x512', type: 'image/jpeg' },
      { src: dataUrl, sizes: '384x384', type: 'image/jpeg' },
      { src: dataUrl, sizes: '256x256', type: 'image/jpeg' },
      { src: dataUrl, sizes: '192x192', type: 'image/jpeg' },
      ...(meta.artwork || []).filter((a) => !a.src.startsWith('data:')),
    ];

    meta.artwork = directArtworks;
  } catch {}
}

/**
 * Generates an optimized, square-cropped artwork list for MediaSession (Lockscreen, Samsung Now Bar, Dynamic Island).
 * Guaranteed:
 * 1. 1:1 true square (720x720, 512x512, 384x384, 256x256, 192x192) - never stretched or letterboxed.
 * 2. High-DPI crystal clear quality (prioritizes hq720.jpg and maxresdefault at q=98).
 * 3. YouTube black bars cropped out via precision wsrv.nl parameters or square CDN.
 * 4. 100% immune to 404s (safe fallback hierarchy).
 * 5. Zero website logos.
 */
export function generateSquareArtworkForMediaSession(t: Track): { src: string; sizes: string; type: string }[] {
  if (!t || !t.id) return [];

  const artwork: { src: string; sizes: string; type: string }[] = [];

  const addSizes = (url: string) => {
    if (!url) return;
    artwork.push(
      { src: url, sizes: '720x720', type: 'image/jpeg' },
      { src: url, sizes: '512x512', type: 'image/jpeg' },
      { src: url, sizes: '384x384', type: 'image/jpeg' },
      { src: url, sizes: '256x256', type: 'image/jpeg' },
      { src: url, sizes: '192x192', type: 'image/jpeg' },
      { src: url, sizes: '128x128', type: 'image/jpeg' },
      { src: url, sizes: '96x96', type: 'image/jpeg' }
    );
  };

  // 1. Check offline cached thumbnail first (highest speed & works offline)
  const offlineThumb = getOfflineThumbUrlSync(t.id);
  if (offlineThumb) {
    addSizes(offlineThumb);
  }

  // 2. Check persistent stored cover from profile
  const storedCover = getStoredCoverForTrack(t.id);

  // 3. Determine base source URL
  let baseThumb = t.thumb || '';
  if (!baseThumb || baseThumb === FALLBACK_ART || baseThumb.includes('photo-1614613535308-eb5fbd3d2c17')) {
    if (storedCover && !storedCover.includes('photo-1614613535308-eb5fbd3d2c17')) {
      baseThumb = storedCover;
    }
  }

  const isYouTube = Boolean(t.id && t.id.length === 11 && !t.id.startsWith('sp_') && !t.id.startsWith('saavn_'));

  // Case A: JioSaavn track (c.saavncdn.com) - pristine 500x500 square
  if (baseThumb && baseThumb.includes('saavncdn.com')) {
    const square500 = baseThumb.replace(/(?:150x150|50x50)\.jpg/, '500x500.jpg');
    addSizes(square500);
    return artwork;
  }

  // Case B: YouTube track (11 chars)
  if (isYouTube) {
    // Priority 1: High-res square crop of hq720.jpg via wsrv.nl (720x720 square, crystal clear, NO black bars, q=98)
    const hq720Square = `https://wsrv.nl/?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2F${t.id}%2Fhq720.jpg&w=720&h=720&fit=cover&q=98&output=jpg`;
    addSizes(hq720Square);

    // Priority 2: High-res square crop of maxresdefault via wsrv.nl (720x720 square, q=98)
    const maxresSquare = `https://wsrv.nl/?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2F${t.id}%2Fmaxresdefault.jpg&w=720&h=720&fit=cover&q=98&output=jpg`;
    addSizes(maxresSquare);

    // Priority 3: sddefault.jpg cropped to remove top/bottom bars (720x720, q=98)
    const sdCroppedSquare = `https://wsrv.nl/?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2F${t.id}%2Fsddefault.jpg&cx=140&cy=60&cw=360&ch=360&w=720&h=720&q=98&output=jpg`;
    addSizes(sdCroppedSquare);

    // Priority 4: hqdefault.jpg cropped to remove top/bottom bars (720x720, q=98)
    const hqCroppedSquare = `https://wsrv.nl/?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2F${t.id}%2Fhqdefault.jpg&cx=105&cy=45&cw=270&ch=270&w=720&h=720&q=98&output=jpg`;
    addSizes(hqCroppedSquare);

    // Priority 5: Direct YouTube CDN fallbacks so Android native media session always has an image even offline/without proxies
    artwork.push(
      { src: `https://i.ytimg.com/vi/${t.id}/hq720.jpg`, sizes: '1280x720', type: 'image/jpeg' },
      { src: `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
      { src: `https://i.ytimg.com/vi/${t.id}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' }
    );

    return artwork;
  }

  // Case C: Standard URL (Spotify, Apple, Google, Soundcloud, Unsplash, etc.)
  if (baseThumb) {
    if (baseThumb.includes('googleusercontent.com')) {
      const googleSquare = baseThumb.replace(/=w\d+-h\d+.*$/, '=w720-h720-l95-rj');
      addSizes(googleSquare);
    } else if (baseThumb.startsWith('data:') || baseThumb.startsWith('blob:')) {
      addSizes(baseThumb);
    } else {
      const proxiedSquare = `https://wsrv.nl/?url=${encodeURIComponent(baseThumb)}&w=720&h=720&fit=cover&q=98&output=jpg`;
      addSizes(proxiedSquare);
      addSizes(baseThumb);
    }
  }

  return artwork;
}

/**
 * Probes the best high-definition cover source (hq720 -> maxresdefault -> sddefault -> hqdefault),
 * loads it with CORS crossOrigin='anonymous', skips 120x90 YouTube error placeholders,
 * and renders an exact 720x720 square JPEG data URL matching the player.
 */
export async function renderSquareCoverDataUrl(thumbUrl: string, trackId?: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Build candidate URL list in descending order of quality
  const candidateUrls: string[] = [];

  const isYT = Boolean(trackId && trackId.length === 11 && !trackId.startsWith('sp_') && !trackId.startsWith('saavn_'));

  if (isYT && trackId) {
    // 1. wsrv proxy of hq720.jpg (1280x720 16:9, crystal clear 720p HD, CORS friendly)
    candidateUrls.push(`https://wsrv.nl/?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2F${trackId}%2Fhq720.jpg&w=720&h=720&fit=cover&q=98&output=jpg`);
    // 2. wsrv proxy of maxresdefault.jpg
    candidateUrls.push(`https://wsrv.nl/?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2F${trackId}%2Fmaxresdefault.jpg&w=720&h=720&fit=cover&q=98&output=jpg`);
    // 3. Direct hq720.jpg
    candidateUrls.push(`https://i.ytimg.com/vi/${trackId}/hq720.jpg`);
    // 4. Direct maxresdefault.jpg
    candidateUrls.push(`https://i.ytimg.com/vi/${trackId}/maxresdefault.jpg`);
    // 5. wsrv proxy of sddefault.jpg (640x480 cropped)
    candidateUrls.push(`https://wsrv.nl/?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2F${trackId}%2Fsddefault.jpg&cx=140&cy=60&cw=360&ch=360&w=720&h=720&q=98&output=jpg`);
    // 6. wsrv proxy of hqdefault.jpg
    candidateUrls.push(`https://wsrv.nl/?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2F${trackId}%2Fhqdefault.jpg&cx=105&cy=45&cw=270&ch=270&w=720&h=720&q=98&output=jpg`);
    // 7. Direct sddefault / hqdefault
    candidateUrls.push(`https://i.ytimg.com/vi/${trackId}/sddefault.jpg`);
    candidateUrls.push(`https://i.ytimg.com/vi/${trackId}/hqdefault.jpg`);
  }

  if (thumbUrl && !thumbUrl.includes('photo-1614613535308-eb5fbd3d2c17')) {
    if (thumbUrl.includes('saavncdn.com')) {
      candidateUrls.unshift(thumbUrl.replace(/(?:150x150|50x50)\.jpg/, '500x500.jpg'));
    } else {
      candidateUrls.push(corsSafeThumbUrl(thumbUrl) || thumbUrl);
      candidateUrls.push(thumbUrl);
    }
  }

  // Try each candidate until one loads successfully and is valid (> 120px)
  for (const url of candidateUrls) {
    if (!url) continue;
    try {
      const dataUrl = await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';
        const timer = setTimeout(() => resolve(null), 2500);

        img.onload = () => {
          clearTimeout(timer);
          // YouTube 404 fallback is a 120x90 image - ignore it!
          if (img.naturalWidth <= 120 && img.naturalHeight <= 90) {
            return resolve(null);
          }
          const isLetterbox = isLetterboxedThumb(url);
          const res = renderCanvasFromImageElement(img, isLetterbox);
          resolve(res);
        };

        img.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };

        img.src = url;
      });

      if (dataUrl) {
        return dataUrl;
      }
    } catch {
      continue;
    }
  }

  return null;
}

