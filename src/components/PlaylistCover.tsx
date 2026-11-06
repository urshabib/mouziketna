import React, { useState } from 'react';
import { Track } from '../types';
import { Music2 } from 'lucide-react';
import { FALLBACK_ART } from '../services/api';
import { getStoredCoverForTrack } from '../services/storage';

interface PlaylistCoverProps {
  cover?: string | null;
  customCover?: string | null;
  tracks?: Track[];
  sizeClass?: string;
  className?: string;
  roundedClass?: string;
  alt?: string;
}

const CollageCell: React.FC<{ track: Track; index: number }> = ({ track, index }) => {
  const getInitialArt = (): string => {
    if (track.thumb && track.thumb !== FALLBACK_ART && !track.thumb.startsWith('blob:')) {
      return track.thumb;
    }
    if (track.id) {
      const stored = getStoredCoverForTrack(track.id);
      if (stored && stored !== FALLBACK_ART && !stored.startsWith('blob:')) {
        return stored;
      }
      if (track.id.length === 11) {
        return `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
      }
    }
    return FALLBACK_ART;
  };

  const [src, setSrc] = useState<string>(getInitialArt);
  const [triedAlt, setTriedAlt] = useState<boolean>(false);

  const handleError = () => {
    if (!triedAlt && track.id && track.id.length === 11) {
      setTriedAlt(true);
      const stored = getStoredCoverForTrack(track.id);
      if (stored && stored !== src && stored !== FALLBACK_ART) {
        setSrc(stored);
        return;
      }
      setSrc(`https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`);
      return;
    }
    setSrc(FALLBACK_ART);
  };

  return (
    <div key={track.id ? `${track.id}_${index}` : index} className="relative w-full h-full overflow-hidden bg-[#18181b] p-0 m-0 border-0">
      <img
        src={src}
        alt={track.title || 'Track art'}
        onError={handleError}
        loading="lazy"
        className="w-full h-full object-cover block p-0 m-0 border-0 pointer-events-none select-none"
      />
    </div>
  );
};

export const PlaylistCover: React.FC<PlaylistCoverProps> = ({
  cover,
  customCover,
  tracks = [],
  sizeClass = 'w-full h-full',
  className = '',
  roundedClass = 'rounded-xl',
  alt = 'Playlist cover',
}) => {
  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = FALLBACK_ART;
  };

  // 1. Explicit user-uploaded custom cover takes absolute priority (base64 data URL or customCover property)
  const isExplicitCustomCover = Boolean(
    (customCover && customCover !== FALLBACK_ART && !customCover.startsWith('blob:')) ||
    (cover && (cover.startsWith('data:') || (cover.startsWith('blob:') && tracks.length === 0)))
  );
  const userCoverUrl = (customCover && customCover !== FALLBACK_ART) ? customCover : cover;

  if (isExplicitCustomCover && userCoverUrl) {
    return (
      <div className={`relative overflow-hidden bg-[#18181b] ${sizeClass} ${roundedClass} ${className}`}>
        <img
          src={userCoverUrl}
          alt={alt}
          onError={handleImgError}
          loading="lazy"
          className="w-full h-full object-cover pointer-events-none"
        />
      </div>
    );
  }

  // 2. Dynamic 2x2 Grid Collage when >= 4 tracks available (Seamless, per-cell error resilient)
  if (tracks.length >= 4) {
    const collageFour = tracks.slice(0, 4);
    return (
      <div
        className={`relative overflow-hidden bg-[#18181b] grid grid-cols-2 grid-rows-2 gap-0 p-0 m-0 border-0 leading-none ${sizeClass} ${roundedClass} ${className}`}
        aria-label="2x2 Playlist collage"
      >
        {collageFour.map((t, idx) => (
          <CollageCell key={t.id ? `${t.id}_${idx}` : idx} track={t} index={idx} />
        ))}
      </div>
    );
  }

  // 3. Fall back gracefully to displaying the cover image of the first track (< 4 tracks)
  const firstTrackThumb = tracks[0] ? (
    (tracks[0].thumb && tracks[0].thumb !== FALLBACK_ART && !tracks[0].thumb.startsWith('blob:'))
      ? tracks[0].thumb
      : (tracks[0].id ? (getStoredCoverForTrack(tracks[0].id) || (tracks[0].id.length === 11 ? `https://i.ytimg.com/vi/${tracks[0].id}/hqdefault.jpg` : null)) : null)
  ) : null;
  const fallbackThumb = firstTrackThumb || (userCoverUrl && !userCoverUrl.startsWith('data:') && userCoverUrl !== FALLBACK_ART ? userCoverUrl : null);
  if (fallbackThumb) {
    return (
      <div className={`relative overflow-hidden bg-[#18181b] ${sizeClass} ${roundedClass} ${className}`}>
        <img
          src={fallbackThumb}
          alt={tracks[0]?.title || alt}
          onError={handleImgError}
          loading="lazy"
          className="w-full h-full object-cover pointer-events-none"
        />
      </div>
    );
  }

  // 4. Default placeholder when empty
  return (
    <div
      className={`relative overflow-hidden bg-[#1f1f23] border border-white/5 flex items-center justify-center text-white/30 ${sizeClass} ${roundedClass} ${className}`}
    >
      <Music2 className="w-1/3 h-1/3 text-white/30" />
    </div>
  );
};

