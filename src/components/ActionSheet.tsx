import React from 'react';
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

  if (!actionSheetTrack) return null;

  const track = actionSheetTrack;
  const isLiked = userProfile.likedSongs?.some((s) => s.id === track.id);
  const downloaded = isDownloaded(track.id);
  const inCustomPl =
    actionSheetMeta?.collectionId && String(actionSheetMeta.collectionId).startsWith('pl_');
  const inLiked = actionSheetMeta?.collectionId === 'liked';

  const close = () => {
    setActionSheetTrack(null);
    setActionSheetMeta(null);
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

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#18181b] glass-panel border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl flex flex-col gap-1 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
      >
        {/* Grip pill for mobile */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4 sm:hidden" />

        {/* Track Preview Header */}
        <div className="flex items-center gap-3.5 pb-4 mb-2 border-b border-white/10">
          <img
            src={track.thumb || canonicalThumbUrl(track.id)}
            alt={track.title}
            className="w-14 h-14 rounded-xl object-cover shadow-md flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-base text-white truncate leading-snug">{track.title}</h4>
            <p className="text-xs text-white/50 truncate font-semibold mt-0.5">{track.artist}</p>
          </div>
          <button
            onClick={close}
            className="p-2 text-white/40 hover:text-white rounded-full transition-colors"
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
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors"
          >
            <Play className="w-5 h-5 text-white/70" />
            <span>Play Next</span>
          </button>

          <button
            onClick={() => {
              addToQueue(track, false);
              close();
            }}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors"
          >
            <ListPlus className="w-5 h-5 text-white/70" />
            <span>Add to Queue</span>
          </button>

          <button
            onClick={() => {
              toggleLikeTrack(track);
              close();
            }}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors"
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
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors"
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
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors"
          >
            <FolderPlus className="w-5 h-5 text-white/70" />
            <span>Add to Playlist</span>
          </button>

          <button
            onClick={() => {
              openCollection('artist', track.artist, track.artist);
              close();
            }}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors"
          >
            <User className="w-5 h-5 text-white/70" />
            <span>View Artist</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 text-white font-semibold text-sm transition-colors"
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
              className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-red-500/10 text-red-400 font-semibold text-sm transition-colors border-t border-white/5 mt-1"
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
              className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-red-500/10 text-red-400 font-semibold text-sm transition-colors border-t border-white/5 mt-1"
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
