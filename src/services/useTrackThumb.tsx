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
      track.thumb !== FALLBACK_ART
    ) {
      return upgradeThumbQuality(track.thumb);
    }
    // Check if we have a persistent cover stored in profile/recentlyPlayed/mouzika_last_played_track
    if (track.id) {
      const stored = getStoredCoverForTrack(track.id);
      if (stored && !stored.startsWith('blob:') && stored !== FALLBACK_ART) {
        return upgradeThumbQuality(stored);
      }
      if (track.id.length === 11) {
        return `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
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
        track.thumb !== FALLBACK_ART
      ) {
        setSrc(upgradeThumbQuality(track.thumb));
        return;
      }
      const stored = getStoredCoverForTrack(track.id);
      if (stored && !stored.startsWith('blob:') && stored !== FALLBACK_ART) {
        setSrc(upgradeThumbQuality(stored));
        return;
      }
      if (track.id && track.id.length === 11) {
        setSrc(`https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`);
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
  const offline = await getOfflineThumbUrl(trackId);
  if (offline) {
    imgElement.src = offline;
    return;
  }
  const stored = getStoredCoverForTrack(trackId);
  if (stored && stored !== imgElement.src) {
    imgElement.src = stored;
    return;
  }
  const canonical = canonicalThumbUrl(trackId);
  if (imgElement.src !== canonical) {
    imgElement.src = canonical;
    return;
  }
  if (trackId.length === 11) {
    const directYt = `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg`;
    if (imgElement.src !== directYt) {
      imgElement.src = directYt;
      return;
    }
  }
  imgElement.src = FALLBACK_ART;
}

interface TrackThumbImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  track: Track | null | undefined;
}

/**
 * Self-resolving Track thumbnail image that handles:
 * 1. Synchronous & asynchronous offline IndexedDB covers
 * 2. Automatic replacement of expired blob: URLs
 * 3. Graceful fallback on error to persistent stored cover, canonical cover, or direct YouTube CDN
 */
export const TrackThumbImage: React.FC<TrackThumbImageProps> = ({
  track,
  className,
  alt,
  ...props
}) => {
  const thumbSrc = useTrackThumb(track);
  const [currentSrc, setCurrentSrc] = useState(thumbSrc);

  useEffect(() => {
    setCurrentSrc(thumbSrc);
  }, [thumbSrc]);

  return (
    <img
      src={currentSrc || FALLBACK_ART}
      alt={alt || track?.title || 'Song Cover'}
      onError={async () => {
        if (track?.id) {
          // 1. Check local IndexedDB offline storage
          const offline = await getOfflineThumbUrl(track.id);
          if (offline && offline !== currentSrc) {
            setCurrentSrc(offline);
            return;
          }
          // 2. Check stored persistent cover from recentlyPlayed / profile cache
          const stored = getStoredCoverForTrack(track.id);
          if (stored && stored !== currentSrc && stored !== FALLBACK_ART) {
            setCurrentSrc(stored);
            return;
          }
          // 3. Check direct YouTube CDN (always available for any 11-char video)
          if (track.id.length === 11) {
            const direct = `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
            if (direct !== currentSrc) {
              setCurrentSrc(direct);
              return;
            }
          }
          // 4. Check canonical high-res image
          const canonical = canonicalThumbUrl(track.id);
          if (canonical && canonical !== currentSrc && canonical !== FALLBACK_ART) {
            setCurrentSrc(canonical);
            return;
          }
        }
        setCurrentSrc(FALLBACK_ART);
      }}
      className={className}
      {...props}
    />
  );
};
