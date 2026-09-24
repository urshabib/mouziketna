import React, { useState, useEffect } from 'react';
import { Track } from '../types';
import { canonicalThumbUrl, FALLBACK_ART } from './api';
import { getOfflineThumbUrl, isDownloaded, getOfflineThumbUrlSync } from './storage';

export function useTrackThumb(track: Track | null | undefined): string {
  const getInitial = (): string => {
    if (!track) return FALLBACK_ART;
    if (isDownloaded(track.id)) {
      const syncUrl = getOfflineThumbUrlSync(track.id);
      if (syncUrl) return syncUrl;
    }
    // If track.thumb is a dead blob URL from a previous session, do not use it
    if (track.thumb && !track.thumb.startsWith('blob:')) {
      return track.thumb;
    }
    return canonicalThumbUrl(track.id);
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

    // If downloaded or offline, prioritize local IndexedDB offline cover
    if (downloaded || isOffline) {
      // First check synchronous memory cache
      const syncUrl = getOfflineThumbUrlSync(track.id);
      if (syncUrl) {
        setSrc(syncUrl);
        return;
      }

      getOfflineThumbUrl(track.id).then((offUrl) => {
        if (active && offUrl) {
          setSrc(offUrl);
        } else if (active) {
          const cleanThumb = track.thumb && !track.thumb.startsWith('blob:') ? track.thumb : null;
          setSrc(cleanThumb || canonicalThumbUrl(track.id));
        }
      });
    } else {
      const cleanThumb = track.thumb && !track.thumb.startsWith('blob:') ? track.thumb : null;
      setSrc(cleanThumb || canonicalThumbUrl(track.id));
    }

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
  } else {
    // If remote URL failed, try canonical URL before fallback
    const canonical = canonicalThumbUrl(trackId);
    if (imgElement.src !== canonical) {
      imgElement.src = canonical;
    } else {
      imgElement.src = FALLBACK_ART;
    }
  }
}

interface TrackThumbImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  track: Track;
}

/**
 * Self-resolving Track thumbnail image that handles:
 * 1. Synchronous & asynchronous offline IndexedDB covers
 * 2. Automatic replacement of expired blob: URLs
 * 3. Graceful fallback on error to canonical cover or offline store
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
      alt={alt || track.title}
      onError={async () => {
        if (track?.id) {
          const offline = await getOfflineThumbUrl(track.id);
          if (offline && offline !== currentSrc) {
            setCurrentSrc(offline);
            return;
          }
          const canonical = canonicalThumbUrl(track.id);
          if (canonical !== currentSrc) {
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
