import React from 'react';
import { useMusic } from '../context/MusicContext';
import { Track } from '../types';
import { Play, MoreVertical, Heart, Music2, Check, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { isDownloaded, getDownloadQuality } from '../services/storage';
import { canonicalThumbUrl, FALLBACK_ART } from '../services/api';
import { useTrackThumb } from '../services/useTrackThumb';
import { DownloadBadge } from './DownloadBadge';

interface TrackRowProps {
  track: Track;
  index?: number;
  onPlay?: () => void;
  collectionId?: string;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  dragHandleProps?: any;
  isReorderMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  onPlay,
  collectionId,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  dragHandleProps,
  isReorderMode = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}) => {
  const {
    activeTrack,
    isPlaying,
    playTrack,
    openCollection,
    toggleLikeTrack,
    userProfile,
    setActionSheetTrack,
    setActionSheetMeta,
  } = useMusic();

  const thumbSrc = useTrackThumb(track);
  const isCurrent = activeTrack?.id === track.id;
  const isLiked = userProfile.likedSongs?.some((s) => s.id === track.id);
  const downloaded = isDownloaded(track.id);
  const quality = getDownloadQuality(track.id);

  const handleRowClick = () => {
    if (isSelectMode) {
      if (onToggleSelect) onToggleSelect();
      return;
    }
    if (track.type === 'artist') {
      openCollection('artist', track.id, track.title, track.thumb);
    } else if (track.type === 'playlist') {
      openCollection('playlist', track.id, track.title, track.thumb);
    } else {
      if (onPlay) onPlay();
      else playTrack(track);
    }
  };

  const handleThumbError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = FALLBACK_ART;
  };

  return (
    <div
      onClick={handleRowClick}
      className={`group flex items-center gap-3.5 p-2 rounded-xl transition-all cursor-pointer select-none ${
        isSelected
          ? 'bg-white/15 border border-[#ff6b1a]/40 shadow-sm'
          : isCurrent
          ? 'bg-[#ff6b1a]/15 hover:bg-[#ff6b1a]/20'
          : 'hover:bg-white/[0.06]'
      }`}
    >
      {/* Select bubble or Drag handle or Index / EQ */}
      {isSelectMode ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleSelect) onToggleSelect();
          }}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
            isSelected
              ? 'bg-[#ff6b1a] text-black shadow-md scale-105'
              : 'border-2 border-white/40 hover:border-white/80 bg-black/20'
          }`}
          aria-label={isSelected ? 'Deselect track' : 'Select track'}
        >
          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>
      ) : dragHandleProps ? (
        <div
          {...dragHandleProps}
          className="w-5 text-white/30 hover:text-white/80 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>
      ) : (
        <div className="w-5 text-center flex items-center justify-center flex-shrink-0 text-xs font-bold text-white/40">
          {isCurrent && isPlaying ? (
            <div className="flex items-end gap-0.5 h-3.5">
              <span className="w-0.5 bg-[#ff6b1a] rounded-sm animate-eq-1" />
              <span className="w-0.5 bg-[#ff6b1a] rounded-sm animate-eq-2" />
              <span className="w-0.5 bg-[#ff6b1a] rounded-sm animate-eq-3" />
            </div>
          ) : (
            <span className="group-hover:hidden">{typeof index === 'number' ? index + 1 : ''}</span>
          )}
          <Play className="w-3.5 h-3.5 fill-white text-white hidden group-hover:block" />
        </div>
      )}

      {/* Art thumbnail */}
      <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-[#1f1f23] shadow-sm">
        <img
          src={thumbSrc}
          alt={track.title}
          onError={handleThumbError}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Title & Artist */}
      <div className="flex-1 min-w-0">
        <h4 className={`font-semibold text-sm truncate leading-snug ${isCurrent ? 'text-[#ff6b1a]' : 'text-white'}`}>
          {track.title}
        </h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          {downloaded && <DownloadBadge quality={quality} size={13} />}
          <p className="text-xs text-white/50 truncate font-medium">{track.artist}</p>
        </div>
      </div>

      {/* Actions */}
      {isReorderMode ? (
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}
            disabled={!canMoveUp}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center text-white transition-all shadow-sm"
            title="Move Up"
            aria-label="Move track up"
          >
            <ChevronUp className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}
            disabled={!canMoveDown}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center text-white transition-all shadow-sm"
            title="Move Down"
            aria-label="Move track down"
          >
            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      ) : !isSelectMode ? (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLikeTrack(track);
            }}
            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
              isLiked ? 'text-[#ff6b1a]' : 'text-white/40 hover:text-white'
            }`}
            title={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#ff6b1a]' : ''}`} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setActionSheetTrack(track);
              setActionSheetMeta({ collectionId });
            }}
            className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            title="More"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
};
