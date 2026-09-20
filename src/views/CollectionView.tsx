import React, { useEffect, useState, useRef } from 'react';
import { useMusic } from '../context/MusicContext';
import { Track } from '../types';
import { TrackRow } from '../components/TrackRow';
import {
  ArrowLeft,
  Play,
  Pause,
  Shuffle,
  Download,
  Link,
  Trash2,
  Heart,
  Plus,
  Camera,
  RefreshCw,
  Loader2,
  Check,
  CheckSquare,
  Square,
  ListCheck,
  FolderPlus,
  ArrowUpDown,
  X,
} from 'lucide-react';
import {
  listDownloads,
  formatBytes,
  deleteAllDownloads,
} from '../services/storage';
import {
  fetchJsonRetry,
  NEW_HUB_BACKEND,
  normalizeTrack,
  PLAYLIST_ART,
  FALLBACK_ART,
} from '../services/api';

export const CollectionView: React.FC = () => {
  const {
    collectionTarget,
    goBack,
    userProfile,
    activeTrack,
    isPlaying,
    playTrack,
    togglePlay,
    playWholeCollection,
    playShuffledCollection,
    playCollectionFromIndex,
    downloadPlaylist,
    setModalAddSongByLinkPlId,
    setModalConfirm,
    deletePlaylist,
    addTrackToPlaylist,
    updatePlaylistTracks,
    addMultipleTracksToPlaylist,
    removeMultipleDownloads,
    syncProfile,
    showToast,
  } = useMusic();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadSize, setDownloadSize] = useState('0 MB');
  const [suggestions, setSuggestions] = useState<Track[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select & Drag-and-drop state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showAddToPlaylistMenu, setShowAddToPlaylistMenu] = useState(false);
  const touchStartIndexRef = useRef<number | null>(null);
  const touchCurrentIndexRef = useRef<number | null>(null);

  const target = collectionTarget;
  if (!target) return null;

  useEffect(() => {
    loadCollectionTracks();
  }, [target.type, target.id]);

  const loadCollectionTracks = async () => {
    setLoading(true);
    if (target.type === 'liked') {
      setTracks(userProfile.likedSongs || []);
      setLoading(false);
    } else if (target.type === 'downloads') {
      const allDl = await listDownloads();
      setTracks(
        allDl.map((d) => ({
          id: d.id,
          title: d.title,
          artist: d.artist,
          thumb: d.thumbLowRes ? URL.createObjectURL(d.thumbLowRes) : null,
          type: 'song',
        }))
      );
      const totalBytes = allDl.reduce((s, d) => s + (d.sizeBytes || 0), 0);
      setDownloadSize(formatBytes(totalBytes));
      setLoading(false);
    } else if (target.type === 'custom-playlist') {
      const pl = userProfile.customPlaylists.find((p) => p.id === target.id);
      setTracks(pl?.tracks || []);
      setLoading(false);
      loadPlaylistSuggestions(pl?.tracks || []);
    } else if (target.type === 'artist') {
      try {
        const res = await fetchJsonRetry<any>(
          `${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(target.title || '')}&f=song`,
          2
        );
        const items = Array.isArray(res) ? res : res.items || [];
        setTracks(items.slice(0, 20).map((it: any) => normalizeTrack(it, 'song')));
      } catch {
        setTracks([]);
      } finally {
        setLoading(false);
      }
    } else if (target.type === 'playlist') {
      try {
        const res = await fetchJsonRetry<any>(
          `${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(target.title || '')}&f=song`,
          2
        );
        const items = Array.isArray(res) ? res : res.items || [];
        setTracks(items.slice(0, 25).map((it: any) => normalizeTrack(it, 'song')));
      } catch {
        setTracks([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const loadPlaylistSuggestions = async (plTracks: Track[]) => {
    setLoadingSuggestions(true);
    try {
      const seed = plTracks.length > 0 ? plTracks[plTracks.length - 1] : null;
      const seedQuery = seed ? seed.artist : 'Top Hits';
      const res = await fetchJsonRetry<any>(
        `${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(seedQuery)}&f=song`,
        2
      );
      const items = Array.isArray(res) ? res : res.items || [];
      const plIds = new Set(plTracks.map((t) => t.id));
      const filtered = items
        .map((it: any) => normalizeTrack(it, 'song'))
        .filter((t: Track) => !plIds.has(t.id))
        .slice(0, 5);
      setSuggestions(filtered);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || target.type !== 'custom-playlist' || !target.id) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const pl = userProfile.customPlaylists.find((p) => p.id === target.id);
      if (pl) {
        pl.thumb = dataUrl;
        syncProfile();
        showToast('Playlist cover updated');
      }
    };
    reader.readAsDataURL(file);
  };

  // Multi-select handlers
  const handleToggleSelect = (trackId: string) => {
    setSelectedIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === tracks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tracks.map((t) => t.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    setModalConfirm({
      title: `Remove ${count} selected ${count === 1 ? 'song' : 'songs'}?`,
      text:
        target.type === 'downloads'
          ? 'These offline audio files will be deleted from device storage.'
          : 'These songs will be removed from this collection.',
      onConfirm: async () => {
        if (target.type === 'custom-playlist' && target.id) {
          const remaining = tracks.filter((t) => !selectedIds.includes(t.id));
          updatePlaylistTracks(target.id, remaining);
          setTracks(remaining);
        } else if (target.type === 'downloads') {
          await removeMultipleDownloads(selectedIds);
          setTracks((prev) => prev.filter((t) => !selectedIds.includes(t.id)));
          const allDl = await listDownloads();
          const totalBytes = allDl.reduce((s, d) => s + (d.sizeBytes || 0), 0);
          setDownloadSize(formatBytes(totalBytes));
        } else if (target.type === 'liked') {
          const newLiked = (userProfile.likedSongs || []).filter((t) => !selectedIds.includes(t.id));
          syncProfile({ ...userProfile, likedSongs: newLiked });
          setTracks(newLiked);
        }
        setSelectedIds([]);
        setIsSelectMode(false);
        showToast(`Removed ${count} ${count === 1 ? 'song' : 'songs'}`);
      },
    });
  };

  const handleAddSelectedToPlaylist = (plId: string) => {
    const selectedTracks = tracks.filter((t) => selectedIds.includes(t.id));
    if (selectedTracks.length === 0) return;
    addMultipleTracksToPlaylist(plId, selectedTracks);
    setShowAddToPlaylistMenu(false);
    setIsSelectMode(false);
    setSelectedIds([]);
    const pl = userProfile.customPlaylists.find((p) => p.id === plId);
    showToast(`Added ${selectedTracks.length} songs to "${pl?.name || 'playlist'}"`);
  };

  const handleDownloadSelected = async () => {
    const selectedTracks = tracks.filter((t) => selectedIds.includes(t.id));
    if (selectedTracks.length === 0) return;
    setIsSelectMode(false);
    setSelectedIds([]);
    downloadPlaylist(selectedTracks);
  };

  // Reordering handlers (Buttons, Touch drag, Desktop drag)
  const moveTrack = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= tracks.length) return;
    const updated = [...tracks];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setTracks(updated);
    if (target.type === 'custom-playlist' && target.id) {
      updatePlaylistTracks(target.id, updated);
    }
    showToast(`Moved "${moved.title}" ${direction === 'up' ? 'up' : 'down'}`);
  };

  const handleTouchStart = (index: number) => {
    touchStartIndexRef.current = index;
    touchCurrentIndexRef.current = index;
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartIndexRef.current === null) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const row = el.closest('[data-track-index]');
    if (row) {
      const newIdx = parseInt(row.getAttribute('data-track-index') || '', 10);
      if (!isNaN(newIdx) && newIdx !== dragOverIndex) {
        setDragOverIndex(newIdx);
        touchCurrentIndexRef.current = newIdx;
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStartIndexRef.current !== null && touchCurrentIndexRef.current !== null) {
      const from = touchStartIndexRef.current;
      const to = touchCurrentIndexRef.current;
      if (from !== to && from >= 0 && to >= 0 && from < tracks.length && to < tracks.length) {
        const updated = [...tracks];
        const [moved] = updated.splice(from, 1);
        updated.splice(to, 0, moved);
        setTracks(updated);
        if (target.type === 'custom-playlist' && target.id) {
          updatePlaylistTracks(target.id, updated);
        }
        showToast('Playlist reordered');
      }
    }
    touchStartIndexRef.current = null;
    touchCurrentIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...tracks];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, moved);
    setTracks(updated);
    if (target.type === 'custom-playlist' && target.id) {
      updatePlaylistTracks(target.id, updated);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    showToast('Playlist reordered');
  };

  const getHeroArt = () => {
    if (target.type === 'liked') {
      return (
        <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-2xl bg-gradient-to-br from-[#ff6b1a] to-[#6b2600] flex items-center justify-center text-white shadow-2xl flex-shrink-0">
          <Heart className="w-20 h-20 fill-white" />
        </div>
      );
    }
    if (target.type === 'downloads') {
      return (
        <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-2xl bg-[#1c1c1e] border border-white/10 flex items-center justify-center text-[#ff6b1a] shadow-2xl flex-shrink-0">
          <Download className="w-20 h-20" />
        </div>
      );
    }
    if (target.thumb) {
      return (
        <div className="relative group w-40 h-40 sm:w-52 sm:h-52 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0">
          <img
            src={target.thumb}
            alt={target.title || 'Collection'}
            className="w-full h-full object-cover"
          />
          {target.type === 'custom-playlist' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-white text-xs font-bold transition-opacity"
            >
              <Camera className="w-6 h-6" />
              <span>Change Cover</span>
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="relative group w-40 h-40 sm:w-52 sm:h-52 rounded-2xl bg-[#1f1f23] border border-white/10 flex items-center justify-center text-white/40 shadow-2xl flex-shrink-0">
        <Play className="w-16 h-16" />
        {target.type === 'custom-playlist' && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-white text-xs font-bold transition-opacity"
          >
            <Camera className="w-6 h-6" />
            <span>Upload Cover</span>
          </button>
        )}
      </div>
    );
  };

  const getTitle = () => {
    if (target.type === 'liked') return 'Liked Songs';
    if (target.type === 'downloads') return 'Downloaded Music';
    return target.title || 'Collection';
  };

  const getSubtitle = () => {
    if (target.type === 'downloads') return `${tracks.length} tracks • ${downloadSize}`;
    return `${tracks.length} track${tracks.length === 1 ? '' : 's'}`;
  };

  return (
    <div className="flex flex-col gap-8 pb-20 select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoverUpload}
        className="hidden"
      />

      {/* Back Button */}
      <button
        onClick={goBack}
        className="self-start flex items-center gap-2 p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 text-center sm:text-left">
        {getHeroArt()}

        <div className="flex flex-col gap-3 min-w-0 flex-1">
          <span className="text-xs font-black uppercase tracking-widest text-white/50">
            {target.type === 'artist' ? 'Artist' : 'Playlist'}
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-none break-words">
            {getTitle()}
          </h2>
          <p className="text-sm font-semibold text-white/50">{getSubtitle()}</p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
            {tracks.length > 0 && !isSelectMode && (
              <>
                <button
                  onClick={() => playWholeCollection(tracks)}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#ff6b1a] text-black font-extrabold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Play</span>
                </button>

                <button
                  onClick={() => playShuffledCollection(tracks)}
                  className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-all hover:scale-105 active:scale-95"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Shuffle</span>
                </button>
              </>
            )}

            {/* Reorder Mode Toggle (Custom Playlists) */}
            {target.type === 'custom-playlist' && target.id && tracks.length > 1 && !isSelectMode && (
              <button
                id="toggle-reorder-mode-btn"
                onClick={() => setIsReorderMode(!isReorderMode)}
                className={`flex items-center gap-2 px-4 py-3 rounded-full font-bold text-sm transition-all ${
                  isReorderMode
                    ? 'bg-[#ff6b1a] text-black shadow-lg shadow-[#ff6b1a]/20 scale-105'
                    : 'bg-white/10 hover:bg-white/15 text-white/80 hover:text-white'
                }`}
                title="Reorder songs in playlist"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span>{isReorderMode ? 'Done Reorder' : 'Reorder'}</span>
              </button>
            )}

            {/* Select Mode Toggle */}
            {tracks.length > 0 && !isReorderMode && (
              <button
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  setSelectedIds([]);
                  setShowAddToPlaylistMenu(false);
                }}
                className={`flex items-center gap-2 px-4 py-3 rounded-full font-bold text-sm transition-all ${
                  isSelectMode
                    ? 'bg-[#ff6b1a] text-black shadow-md'
                    : 'bg-white/10 hover:bg-white/15 text-white/80 hover:text-white'
                }`}
              >
                <ListCheck className="w-4 h-4" />
                <span>{isSelectMode ? 'Done' : 'Select'}</span>
              </button>
            )}

            {/* Download all collection songs */}
            {target.type !== 'downloads' && tracks.length > 0 && !isSelectMode && (
              <button
                onClick={() => downloadPlaylist(tracks)}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                title="Download all for offline"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Custom Playlist specific actions */}
            {target.type === 'custom-playlist' && target.id && !isSelectMode && (
              <>
                <button
                  onClick={() => setModalAddSongByLinkPlId(target.id!)}
                  className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Add song by link"
                >
                  <Link className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setModalConfirm({
                      title: `Delete "${target.title}"?`,
                      text: 'The playlist will be permanently removed.',
                      onConfirm: () => deletePlaylist(target.id!),
                    });
                  }}
                  className="p-3 rounded-full bg-white/5 hover:bg-red-500/10 text-white/70 hover:text-red-400 transition-colors"
                  title="Delete playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Clear all downloads button */}
            {target.type === 'downloads' && tracks.length > 0 && !isSelectMode && (
              <button
                onClick={() => {
                  setModalConfirm({
                    title: 'Delete all downloads?',
                    text: 'All offline music files will be removed from your device storage.',
                    onConfirm: async () => {
                      await deleteAllDownloads();
                      loadCollectionTracks();
                      showToast('All downloads cleared', true);
                    },
                  });
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-sm transition-colors border border-red-500/20"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Select Mode Sticky Toolbar */}
      {isSelectMode && (
        <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/15 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              {selectedIds.length === tracks.length ? (
                <>
                  <CheckSquare className="w-4 h-4 text-[#ff6b1a]" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-white/60" />
                  <span>Select All</span>
                </>
              )}
            </button>
            <span className="text-sm font-semibold text-white/70">
              {selectedIds.length} of {tracks.length} selected
            </span>
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Add to Playlist button & dropdown */}
            {userProfile.customPlaylists.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowAddToPlaylistMenu(!showAddToPlaylistMenu)}
                  disabled={selectedIds.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold transition-colors"
                >
                  <FolderPlus className="w-4 h-4 text-[#ff6b1a]" />
                  <span>Add to Playlist</span>
                </button>

                {showAddToPlaylistMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-[#252528] rounded-xl border border-white/15 shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <p className="px-3 py-2 text-[11px] font-bold text-white/40 uppercase tracking-wider">
                      Add {selectedIds.length} songs to:
                    </p>
                    <div className="max-h-48 overflow-y-auto">
                      {userProfile.customPlaylists.map((pl) => (
                        <button
                          key={pl.id}
                          onClick={() => handleAddSelectedToPlaylist(pl.id)}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 rounded-lg transition-colors truncate"
                        >
                          {pl.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Download selected */}
            {target.type !== 'downloads' && (
              <button
                onClick={handleDownloadSelected}
                disabled={selectedIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold transition-colors"
                title="Download selected"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            {/* Delete/Remove selected */}
            {(target.type === 'custom-playlist' || target.type === 'downloads' || target.type === 'liked') && (
              <button
                onClick={handleDeleteSelected}
                disabled={selectedIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 disabled:opacity-40 disabled:pointer-events-none text-red-400 text-xs font-bold transition-colors border border-red-500/20"
                title="Remove selected"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reorder Mode Sticky Toolbar */}
      {isReorderMode && (
        <div className="sticky top-16 z-30 flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#ff6b1a]/20 backdrop-blur-xl border border-[#ff6b1a]/40 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <ArrowUpDown className="w-4 h-4 text-[#ff6b1a] flex-shrink-0" />
            <span>Tap ▲ or ▼ to move songs up/down, or drag the handle.</span>
          </div>
          <button
            onClick={() => setIsReorderMode(false)}
            className="px-3.5 py-1.5 rounded-xl bg-[#ff6b1a] hover:bg-[#ff7d33] text-black text-xs font-black transition-colors shadow-md flex-shrink-0 cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

      {/* Track List */}
      <div className="flex flex-col gap-1 mt-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-white/40 gap-2">
            <p className="text-base font-bold">This playlist has no songs yet.</p>
            <p className="text-xs">Add songs using search, ⋮ menus, or by link.</p>
          </div>
        ) : (
          tracks.map((t, idx) => (
            <div
              key={`${t.id}-${idx}`}
              data-track-index={idx}
              draggable={target.type === 'custom-playlist' && !isSelectMode}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              className={`transition-all rounded-xl ${
                dragOverIndex === idx ? 'border-t-2 border-[#ff6b1a] bg-[#ff6b1a]/10' : ''
              }`}
            >
              <TrackRow
                track={t}
                index={idx}
                collectionId={target.id || target.type}
                isSelectMode={isSelectMode}
                isSelected={selectedIds.includes(t.id)}
                onToggleSelect={() => handleToggleSelect(t.id)}
                onPlay={() => playCollectionFromIndex(tracks, idx)}
                isReorderMode={isReorderMode}
                canMoveUp={idx > 0}
                canMoveDown={idx < tracks.length - 1}
                onMoveUp={() => moveTrack(idx, 'up')}
                onMoveDown={() => moveTrack(idx, 'down')}
                dragHandleProps={
                  target.type === 'custom-playlist' && !isSelectMode
                    ? {
                        draggable: true,
                        onDragStart: (e: any) => handleDragStart(e, idx),
                        onTouchStart: () => handleTouchStart(idx),
                        onTouchMove: (e: any) => handleTouchMove(e),
                        onTouchEnd: () => handleTouchEnd(),
                      }
                    : undefined
                }
              />
            </div>
          ))
        )}
      </div>

      {/* Suggested for this Playlist (for custom playlists) */}
      {target.type === 'custom-playlist' && target.id && (
        <section className="flex flex-col gap-4 mt-8 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Recommended for this playlist
              </h3>
              <p className="text-xs text-white/50">Click any song to preview/listen before adding</p>
            </div>
            <button
              onClick={() => loadPlaylistSuggestions(tracks)}
              disabled={loadingSuggestions}
              className="flex items-center gap-1 text-xs font-bold text-white/50 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSuggestions ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {suggestions.map((sug) => {
              const isSugActive = activeTrack?.id === sug.id;
              const isSugPlaying = isSugActive && isPlaying;
              return (
                <div
                  key={sug.id}
                  onClick={() => {
                    if (isSugActive) {
                      togglePlay();
                    } else {
                      playTrack(sug);
                    }
                  }}
                  className={`group flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer select-none ${
                    isSugActive ? 'bg-[#ff6b1a]/15 hover:bg-[#ff6b1a]/20' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                      <img
                        src={sug.thumb || FALLBACK_ART}
                        alt={sug.title}
                        className="w-full h-full object-cover"
                      />
                      <div
                        className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                          isSugActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isSugPlaying ? (
                          <Pause className="w-4 h-4 fill-white text-white" />
                        ) : (
                          <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5
                        className={`text-sm font-semibold truncate ${
                          isSugActive ? 'text-[#ff6b1a]' : 'text-white'
                        }`}
                      >
                        {sug.title}
                      </h5>
                      <p className="text-xs text-white/50 truncate">{sug.artist}</p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addTrackToPlaylist(target.id!, sug);
                      setSuggestions((prev) => prev.filter((s) => s.id !== sug.id));
                      showToast(`Added "${sug.title}" to playlist`);
                    }}
                    className="p-2 rounded-full border border-white/20 text-white hover:border-[#ff6b1a] hover:text-[#ff6b1a] transition-all hover:scale-110 active:scale-95 ml-2 flex-shrink-0"
                    title="Add to Playlist"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
