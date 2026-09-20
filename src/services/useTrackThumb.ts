import { useState, useEffect } from 'react';
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
    if (track.thumb) return track.thumb;
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

    if (downloaded || isOffline) {
      getOfflineThumbUrl(track.id).then((offUrl) => {
        if (active && offUrl) {
          setSrc(offUrl);
        } else if (active) {
          setSrc(track.thumb || canonicalThumbUrl(track.id));
        }
      });
    } else {
      setSrc(track.thumb || canonicalThumbUrl(track.id));
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
    imgElement.src = FALLBACK_ART;
  }
}
