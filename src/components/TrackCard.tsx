import React, { useState, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import { Track } from '../types';
import { Play, Heart, Download, MoreVertical, Music2, Check } from 'lucide-react';
import { isDownloaded, getOfflineThumbUrl, getDownloadQuality } from '../services/storage';
import { canonicalThumbUrl } from '../services/api';
import { DownloadBadge } from './DownloadBadge';

interface TrackCardProps {
  track: Track;
  onPlay?: () => void;
  collectionId?: string;
}

export const TrackCard: React.FC<TrackCardProps> = ({ track, onPlay, collectionId }) => {
  const {
    activeTrack,
    isPlaying,
    playTrack,
    openCollection,
    toggleLikeTrack,
    userProfile,
    downloadTrack,
    removeDownload,
    setActionSheetTrack,
    setActionSheetMeta,
  } = useMusic();

  const [thumbSrc, setThumbSrc] = useState<string>(track.thumb || canonicalThumbUrl(track.id));
  const isCurrent = activeTrack?.id === track.id;
  const isLiked = userProfile.likedSongs?.some((s) => s.id === track.id);
  const downloaded = isDownloaded(track.id);

  useEffect(() => {
    let active = true;
    if (downloaded) {
      getOfflineThumbUrl(track.id).then((url) => {
        if (active && url) setThumbSrc(url);
      });
    } else if (track.thumb) {
      setThumbSrc(track.thumb);
    }
    return () => {
      active = false;
    };
  }, [track.id, track.thumb, downloaded]);

  const handleCardClick = () => {
    if (track.type === 'artist') {
      openCollection('artist', track.id, track.title, track.thumb);
    } else if (track.type === 'playlist') {
      openCollection('playlist', track.id, track.title, track.thumb);
    } else {
      if (onPlay) onPlay();
      else playTrack(track);
    }
  };

  const handleThumbError = async () => {
    if (downloaded) {
      const offline = await getOfflineThumbUrl(track.id);
      if (offline) {
        setThumbSrc(offline);
        return;
      }
    }
    setThumbSrc(canonicalThumbUrl(track.id));
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex flex-col p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-xl"
    >
      {/* Artwork container */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-[#18181b] shadow-md">
        <img
          src={thumbSrc}
          alt={track.title}
          onError={handleThumbError}
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
            track.type === 'artist' ? 'rounded-full' : ''
          }`}
        />

        {/* Play Overlay Button */}
        {track.type !== 'artist' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onPlay) onPlay();
              else playTrack(track);
            }}
            className="absolute right-2.5 bottom-2.5 w-11 h-11 rounded-full bg-[#ff6b1a] text-black flex items-center justify-center shadow-2xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-110 active:scale-95 transition-all duration-200 z-10"
            title="Play"
          >
            <Play className="w-5 h-5 fill-black ml-0.5" />
          </button>
        )}

        {/* Live EQ Indicator */}
        {isCurrent && (
          <div className="absolute left-2.5 bottom-2.5 flex items-end gap-0.5 h-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md">
            <span className="w-1 bg-[#ff6b1a] rounded-sm animate-eq-1" />
            <span className="w-1 bg-[#ff6b1a] rounded-sm animate-eq-2" />
            <span className="w-1 bg-[#ff6b1a] rounded-sm animate-eq-3" />
          </div>
        )}

        {/* Top actions: Like & 3-dot Menu */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLikeTrack(track);
            }}
            className={`w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white hover:scale-110 transition-all ${
              isLiked ? 'text-[#ff6b1a] !opacity-100' : ''
            }`}
            title={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#ff6b1a] text-[#ff6b1a]' : ''}`} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setActionSheetTrack(track);
              setActionSheetMeta({ collectionId });
            }}
            className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white hover:scale-110 transition-all"
            title="More"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col min-w-0">
        <h4 className={`font-bold text-sm truncate leading-snug ${isCurrent ? 'text-[#ff6b1a]' : 'text-white'}`}>
          {track.title}
        </h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          {downloaded && <DownloadBadge quality={getDownloadQuality(track.id)} size={13} />}
          <p className="text-xs text-white/50 truncate font-medium">
            {track.type === 'artist' ? 'Artist' : track.type === 'playlist' ? 'Playlist' : track.artist}
          </p>
        </div>
      </div>
    </div>
  );
};
