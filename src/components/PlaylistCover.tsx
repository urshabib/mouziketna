import React from 'react';
import { Track } from '../types';
import { Music2 } from 'lucide-react';
import { FALLBACK_ART } from '../services/api';

interface PlaylistCoverProps {
  cover?: string | null;
  customCover?: string | null;
  tracks?: Track[];
  sizeClass?: string;
  className?: string;
  roundedClass?: string;
  alt?: string;
}

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

  // 1. User-uploaded custom cover always takes priority
  const activeCustomCover = customCover || cover;
  const isCustomUploaded = Boolean(
    activeCustomCover &&
      (activeCustomCover.startsWith('data:') ||
        activeCustomCover.startsWith('blob:') ||
        activeCustomCover.startsWith('http://') ||
        activeCustomCover.startsWith('https://')) &&
      (!tracks[0]?.thumb || activeCustomCover !== tracks[0]?.thumb)
  );

  if (isCustomUploaded && activeCustomCover) {
    return (
      <div className={`relative overflow-hidden bg-[#18181b] ${sizeClass} ${roundedClass} ${className}`}>
        <img
          src={activeCustomCover}
          alt={alt}
          onError={handleImgError}
          loading="lazy"
          className="w-full h-full object-cover pointer-events-none"
        />
      </div>
    );
  }

  // 2. Dynamic 2x2 Grid Collage when >= 4 tracks available (Seamless, no black borders)
  if (tracks.length >= 4) {
    const collageFour = tracks.slice(0, 4);
    return (
      <div
        className={`relative overflow-hidden bg-[#18181b] grid grid-cols-2 grid-rows-2 gap-0 p-0 m-0 border-0 leading-none ${sizeClass} ${roundedClass} ${className}`}
        aria-label="2x2 Playlist collage"
      >
        {collageFour.map((t, idx) => (
          <div key={t.id ? `${t.id}_${idx}` : idx} className="relative w-full h-full overflow-hidden bg-[#18181b] p-0 m-0 border-0">
            <img
              src={t.thumb || FALLBACK_ART}
              alt={t.title || 'Track art'}
              onError={handleImgError}
              loading="lazy"
              className="w-full h-full object-cover block p-0 m-0 border-0 pointer-events-none"
            />
          </div>
        ))}
      </div>
    );
  }

  // 3. Fall back gracefully to displaying the cover image of the first track (< 4 tracks)
  const fallbackThumb = (tracks.length > 0 && tracks[0].thumb) || (activeCustomCover && !activeCustomCover.startsWith('data:') ? activeCustomCover : null);
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

