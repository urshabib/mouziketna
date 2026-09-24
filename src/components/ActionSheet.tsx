import React, { useState, useRef, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  Play,
  Heart,
  Download,
  ListPlus,
  FolderPlus,
  Trash2,
  Share2,
  User,
  X,
  Check,
} from 'lucide-react';
import { isDownloaded } from '../services/storage';
import { canonicalThumbUrl } from '../services/api';

export const ActionSheet: React.FC = () => {
  const {
    actionSheetTrack,
    setActionSheetTrack,
    actionSheetMeta,
    setActionSheetMeta,
    addToQueue,
    playTrack,
    toggleLikeTrack,
    userProfile,
    downloadTrack,
    removeDownload,
    setModalAddToPlaylistTrack,
    removeTrackFromPlaylist,
    openCollection,
    showToast,
  } = useMusic();

  const [isClosing, setIsClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const currentDragYRef = useRef(0);
  const hasMovedRef = useRef(false);
  const trackCacheRef = useRef(actionSheetTrack);

  if (actionSheetTrack) {
    trackCacheRef.current = actionSheetTrack;
  }

  const track = actionSheetTrack || trackCacheRef.current;

  // Reset state when a new track is opened
  useEffect(() => {
    if (actionSheetTrack) {
      setIsClosing(false);
      setDragY(0);
      setIsDragging(false);
      currentDragYRef.current = 0;
    }
  }, [actionSheetTrack]);

  if (!track || (!actionSheetTrack && !isClosing)) return null;

  const isLiked = userProfile.likedSongs?.some((s) => s.id === track.id);
  const downloaded = isDownloaded(track.id);
  const inCustomPl =
    actionSheetMeta?.collectionId && String(actionSheetMeta.collectionId).startsWith('pl_');
  const inLiked = actionSheetMeta?.collectionId === 'liked';

  const close = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setActionSheetTrack(null);
      setActionSheetMeta(null);
      setIsClosing(false);
      setDragY(0);
      currentDragYRef.current = 0;
    }, 240);
  };

  const handleShare = async () => {
    const url = `https://music.youtube.com/watch?v=${track.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: track.title,
          text: `Listen to ${track.title} by ${track.artist} on MOUZIKA`,
          url,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
      showToast('Track link copied to clipboard');
    }
    close();
  };

  // Gesture handling for the Android top bar and header
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;
    if (Math.abs(diff) > 4) {
      hasMovedRef.current = true;
    }
    if (diff > 0) {
      // Direct 1:1 pull down tracking
      currentDragYRef.current = diff;
      setDragY(diff);
    } else {
      // Elastic rubber band resistance for upward drag
      const resisted = diff * 0.15;
      currentDragYRef.current = resisted;
      setDragY(resisted);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (currentDragYRef.current > 70) {
      if (navigator.vibrate) {
        try {
          navigator.vibrate(15);
        } catch {}
      }
      close();
    } else {
      setDragY(0);
      currentDragYRef.current = 0;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startYRef.current = e.clientY;
    hasMovedRef.current = false;
    setIsDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientY - startYRef.current;
      if (Math.abs(diff) > 4) hasMovedRef.current = true;
      if (diff > 0) {
        currentDragYRef.current = diff;
        setDragY(diff);
      } else {
        const resisted = diff * 0.15;
        currentDragYRef.current = resisted;
        setDragY(resisted);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);
      if (currentDragYRef.current > 70) {
        close();
      } else {
        setDragY(0);
        currentDragYRef.current = 0;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onClick={close}
      style={{
        opacity: isClosing ? 0 : Math.max(0.15, 1 - Math.max(0, dragY) / 350),
      }}
      className={`fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center select-none transition-opacity duration-200 ${
        isClosing ? 'pointer-events-none' : ''
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: isClosing
            ? 'translateY(100%)'
            : dragY !== 0
            ? `translateY(${Math.max(0, dragY)}px)`
            : 'translateY(0px)',
          transition: isDragging
            ? 'none'
            : 'transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 200ms ease',
          opacity: isClosing ? 0 : 1,
        }}
        className="w-full sm:max-w-md bg-[#18181b] glass-panel border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl flex flex-col gap-1 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
      >
        {/* Android Gesture Grab Bar at the top */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onClick={(e) => {
            e.stopPropagation();
            if (!hasMovedRef.current) {
              close();
            }
          }}
          className="w-full flex flex-col items-center justify-center py-2 -mt-1 cursor-grab active:cursor-grabbing touch-none select-none group"
          title="Drag down or tap to close"
        >
          <div className="w-12 h-1.5 rounded-full bg-white/30 group-hover:bg-white/60 group-active:bg-[#ff6b1a] transition-all duration-150" />
        </div>

        {/* Track Preview Header (also draggable down) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          className="flex items-center gap-3.5 pb-4 mb-2 border-b border-white/10 cursor-grab active:cursor-grabbing select-none"
        >
          <img
            src={track.thumb || canonicalThumbUrl(track.id)}
            alt={track.title}
            className="w-14 h-14 rounded-xl object-cover shadow-md flex-shrink-0 pointer-events-none"
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-base text-white truncate leading-snug">{track.title}</h4>
            <p className="text-xs text-white/50 truncate font-semibold mt-0.5">{track.artist}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className="p-2 text-white/40 hover:text-white rounded-full transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions list */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => {
              addToQueue(track, true);
              close();
            }}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            <Play className="w-5 h-5 text-white/70" />
            <span>Play Next</span>
          </button>

          <button
            onClick={() => {
              addToQueue(track, false);
              close();
            }}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            <ListPlus className="w-5 h-5 text-white/70" />
            <span>Add to Queue</span>
          </button>

          <button
            onClick={() => {
              toggleLikeTrack(track);
              close();
            }}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-[#ff6b1a] text-[#ff6b1a]' : 'text-white/70'}`} />
            <span>{isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}</span>
          </button>

          <button
            onClick={() => {
              if (downloaded) removeDownload(track.id);
              else downloadTrack(track);
              close();
            }}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            {downloaded ? (
              <>
                <Trash2 className="w-5 h-5 text-red-400" />
                <span className="text-red-400">Remove Download</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5 text-white/70" />
                <span>Download for Offline</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setModalAddToPlaylistTrack(track);
              close();
            }}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            <FolderPlus className="w-5 h-5 text-white/70" />
            <span>Add to Playlist</span>
          </button>

          <button
            onClick={() => {
              openCollection('artist', track.artist, track.artist);
              close();
            }}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            <User className="w-5 h-5 text-white/70" />
            <span>View Artist</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors cursor-pointer"
          >
            <Share2 className="w-5 h-5 text-white/70" />
            <span>Share Song</span>
          </button>

          {/* Remove from custom playlist if opened from within one */}
          {inCustomPl && actionSheetMeta?.collectionId && (
            <button
              onClick={() => {
                removeTrackFromPlaylist(actionSheetMeta.collectionId!, track.id);
                close();
              }}
              className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-red-500/10 text-red-400 font-semibold text-sm transition-colors border-t border-white/5 mt-1 cursor-pointer"
            >
              <Trash2 className="w-5 h-5" />
              <span>Remove from this Playlist</span>
            </button>
          )}

          {/* Remove from liked if opened in liked view */}
          {inLiked && (
            <button
              onClick={() => {
                toggleLikeTrack(track);
                close();
              }}
              className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-red-500/10 text-red-400 font-semibold text-sm transition-colors border-t border-white/5 mt-1 cursor-pointer"
            >
              <Trash2 className="w-5 h-5" />
              <span>Remove from Liked Songs</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
