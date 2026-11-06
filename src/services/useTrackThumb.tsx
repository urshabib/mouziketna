import React, { useState, useEffect } from 'react';
import { Track } from '../types';
import { canonicalThumbUrl, FALLBACK_ART, upgradeThumbQuality } from './api';
import {
  getOfflineThumbUrl,
  isDownloaded,
  getOfflineThumbUrlSync,
  getStoredCoverForTrack,
  downloadsRegistryReady,
} from './storage';

/**
 * Checks whether a given thumbnail URL is from YouTube or a letterboxed 4:3/16:9 source
 * that contains baked-in black bars on top and bottom.
 */
export function isLetterboxedThumb(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('ytimg.com') ||
    url.includes('youtube.com') ||
    url.includes('hqdefault') ||
    url.includes('sddefault') ||
    url.includes('mqdefault') ||
    url.includes('maxresdefault') ||
    url.includes('/vi/') ||
    url.includes('wsrv.nl')
  );
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
        return `https://i.ytimg.com/vi/${track.id}/sddefault.jpg`;
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
        setSrc(`https://i.ytimg.com/vi/${track.id}/sddefault.jpg`);
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
    const wsrv = `https://wsrv.nl/?url=https://i.ytimg.com/vi/${trackId}/sddefault.jpg&w=500&h=500&fit=cover&q=88&output=webp`;
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
  zoomScale = 1.35,
  style,
  onLoad,
  onError,
  ...props
}) => {
  const thumbSrc = useTrackThumb(track);
  const [currentSrc, setCurrentSrc] = useState(thumbSrc);
  const [errorStep, setErrorStep] = useState(0);
  const [isLetterboxed, setIsLetterboxed] = useState(() => isLetterboxedThumb(thumbSrc));

  useEffect(() => {
    setCurrentSrc(thumbSrc);
    setErrorStep(0);
    setIsLetterboxed(isLetterboxedThumb(thumbSrc));
  }, [thumbSrc]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const ratio = img.naturalWidth / img.naturalHeight;
      // 4:3 (1.33) or 16:9 (1.77) has black letterbox bars in YouTube video thumbnails
      if (ratio > 1.15) {
        setIsLetterboxed(true);
      } else if (ratio >= 0.95 && ratio <= 1.05 && !isLetterboxedThumb(img.src)) {
        setIsLetterboxed(false);
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
        return;
      }
    }

    // Step 2: Persistent stored cover from profile cache
    if (nextStep <= 2) {
      const stored = getStoredCoverForTrack(track.id);
      if (stored && stored !== currentSrc && !stored.includes('photo-1614613535308-eb5fbd3d2c17')) {
        setCurrentSrc(stored);
        return;
      }
    }

    // Step 3: Direct YouTube CDN sddefault.jpg (640x480 - 500px+ HD quality)
    if (nextStep <= 3 && track.id.length === 11) {
      const sd = `https://i.ytimg.com/vi/${track.id}/sddefault.jpg`;
      if (sd !== currentSrc) {
        setCurrentSrc(sd);
        setIsLetterboxed(true);
        return;
      }
    }

    // Step 4: Direct YouTube CDN hqdefault.jpg
    if (nextStep <= 4 && track.id.length === 11) {
      const hq = `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
      if (hq !== currentSrc) {
        setCurrentSrc(hq);
        setIsLetterboxed(true);
        return;
      }
    }

    // Step 5: Direct YouTube CDN mqdefault.jpg
    if (nextStep <= 5 && track.id.length === 11) {
      const mq = `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`;
      if (mq !== currentSrc) {
        setCurrentSrc(mq);
        setIsLetterboxed(true);
        return;
      }
    }

    // Step 6: 500px High-Quality WebP CORS proxy via wsrv.nl
    if (nextStep <= 6 && track.id.length === 11) {
      const wsrv = `https://wsrv.nl/?url=https://i.ytimg.com/vi/${track.id}/sddefault.jpg&w=500&h=500&fit=cover&q=88&output=webp`;
      if (wsrv !== currentSrc) {
        setCurrentSrc(wsrv);
        setIsLetterboxed(true);
        return;
      }
    }

    // Step 6: Canonical high-res
    if (nextStep <= 6) {
      const canonical = canonicalThumbUrl(track.id);
      if (canonical && canonical !== currentSrc && !canonical.includes('photo-1614613535308-eb5fbd3d2c17')) {
        setCurrentSrc(canonical);
        setIsLetterboxed(true);
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
        transition: 'transform 0.25s ease-out',
        ...style,
        ...(zoomTransform ? { transform: style?.transform ? `${zoomTransform} ${style.transform}` : zoomTransform } : {}),
      }}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      {...props}
    />
  );
};
