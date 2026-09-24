import React from 'react';
import { Track } from '../types';
import { Music2 } from 'lucide-react';
import { FALLBACK_ART } from '../services/api';

interface PlaylistCoverProps {
  cover?: string | null;
  tracks?: Track[];
  sizeClass?: string;
  className?: string;
  roundedClass?: string;
  alt?: string;
}

export const PlaylistCover: React.FC<PlaylistCoverProps> = ({
  cover,
  tracks = [],
  sizeClass = 'w-full h-full',
  className = '',
  roundedClass = 'rounded-xl',
  alt = 'Playlist cover',
}) => {
  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = FALLBACK_ART;
  };

  // 1. Explicit custom cover uploaded or assigned (persisted cover or data/blob URL)
  const isCustomUploaded = Boolean(
    cover &&
      (cover.startsWith('data:') ||
        cover.startsWith('blob:') ||
        (tracks.length >= 4 && cover !== tracks[0]?.thumb))
  );

  if (isCustomUploaded && cover) {
    return (
      <div className={`relative overflow-hidden bg-[#18181b] ${sizeClass} ${roundedClass} ${className}`}>
        <img
          src={cover}
          alt={alt}
          onError={handleImgError}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // 2. Dynamic 2x2 Grid Collage when >= 4 tracks available (YouTube Music style)
  if (tracks.length >= 4) {
    const collageFour = tracks.slice(0, 4);
    return (
      <div
        className={`relative overflow-hidden bg-[#18181b] grid grid-cols-2 grid-rows-2 ${sizeClass} ${roundedClass} ${className}`}
        aria-label="2x2 Playlist collage"
      >
        {collageFour.map((t, idx) => (
          <div key={t.id || idx} className="relative w-full h-full overflow-hidden bg-[#242426]">
            <img
              src={t.thumb || FALLBACK_ART}
              alt={t.title || 'Track art'}
              onError={handleImgError}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    );
  }

  // 3. Fall back gracefully to displaying the cover image of the first track (< 4 tracks)
  const fallbackThumb = (tracks.length > 0 && tracks[0].thumb) || (cover && !cover.startsWith('data:') ? cover : null);
  if (fallbackThumb) {
    return (
      <div className={`relative overflow-hidden bg-[#18181b] ${sizeClass} ${roundedClass} ${className}`}>
        <img
          src={fallbackThumb}
          alt={tracks[0]?.title || alt}
          onError={handleImgError}
          loading="lazy"
          className="w-full h-full object-cover"
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
