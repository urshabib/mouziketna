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
  Edit3,
} from 'lucide-react';
import {
  listDownloads,
  formatBytes,
  deleteAllDownloads,
  savePersistentPlaylistCover,
  getPersistentPlaylistCover,
} from '../services/storage';
import {
  fetchJsonRetry,
  NEW_HUB_BACKEND,
  normalizeTrack,
  PLAYLIST_ART,
  FALLBACK_ART,
  getRelatedTracks,
  getTasteProfileRecommendations,
} from '../services/api';
import { PlaylistCover } from '../components/PlaylistCover';

const playlistSuggestionsCache = new Map<string, { trackIdsHash: string; suggestions: Track[] }>();

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
    renamePlaylist,
    addTrackToPlaylist,
    updatePlaylistTracks,
    addMultipleTracksToPlaylist,
    removeMultipleDownloads,
    syncProfile,
    showToast,
    t,
  } = useMusic();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadSize, setDownloadSize] = useState('0 MB');
  const [suggestions, setSuggestions] = useState<Track[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameInput, setNameInput] = useState('');
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
  const touchHoldTimerRef = useRef<any>(null);
  const touchActiveReorderIndexRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const [reorderingTrackIndex, setReorderingTrackIndex] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (touchHoldTimerRef.current) clearTimeout(touchHoldTimerRef.current);
    };
  }, []);

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
      if (target.id === 'music-taste') {
        const { getExplicitInterestedTracks } = await import('../services/storage');
        setTracks(getExplicitInterestedTracks());
        setLoading(false);
        return;
      }
      if (target.id === 'music-taste-excluded') {
        const { getExplicitNotInterestedTracks } = await import('../services/storage');
        setTracks(getExplicitNotInterestedTracks());
        setLoading(false);
        return;
      }
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

  const loadPlaylistSuggestions = async (plTracks: Track[], force = false) => {
    const cacheKey = target.id || 'custom';
    const trackIdsHash = plTracks.map((t) => t.id).join(',');

    if (!force && playlistSuggestionsCache.has(cacheKey)) {
      const cached = playlistSuggestionsCache.get(cacheKey)!;
      if (cached.trackIdsHash === trackIdsHash && cached.suggestions.length > 0) {
        setSuggestions(cached.suggestions);
        return;
      }
    }

    setLoadingSuggestions(true);
    try {
      const plIds = new Set(plTracks.map((t) => t.id));

      if (plTracks.length > 0) {
        // Pick up to 3 random seed tracks from this specific playlist
        const shuffled = [...plTracks].sort(() => Math.random() - 0.5);
        const seeds = shuffled.slice(0, 3);

        const relatedPromises = seeds.map((s) => getRelatedTracks(s.id));
        const relatedResults = await Promise.all(relatedPromises);

        const candidateList: Track[] = [];
        const seenIds = new Set<string>(plIds);
        const artistCap = new Map<string, number>();

        relatedResults.forEach((tracks) => {
          tracks.forEach((t: Track) => {
            if (!t.id || seenIds.has(t.id)) return;
            // Strictly require song type (never playlist/album/collection)
            if (t.type && t.type !== 'song') return;
            const artKey = (t.artist || '').toLowerCase().trim();
            const titleKey = (t.title || '').toLowerCase().trim();

            // Strict sanity filter: Never suggest a song titled identically to its artist!
            if (artKey === titleKey) return;
            if (
              titleKey.includes('type beat') ||
              titleKey.includes('instrumental') ||
              titleKey.includes('reaction') ||
              titleKey.includes('playlist') ||
              titleKey.includes('full album') ||
              titleKey.includes('compilation')
            ) {
              return;
            }

            const curCount = artistCap.get(artKey) || 0;
            // Diversity: maximum 1 track per artist
            if (curCount < 1) {
              seenIds.add(t.id);
              artistCap.set(artKey, curCount + 1);
              candidateList.push({ ...t, type: 'song' });
            }
          });
        });

        let finalSuggestions: Track[] = [];
        if (candidateList.length >= 6) {
          finalSuggestions = candidateList.sort(() => Math.random() - 0.5).slice(0, 6);
        } else {
          // Top off with taste profile recommendations if needed
          const tasteRecs = await getTasteProfileRecommendations(userProfile, seenIds, 6 - candidateList.length);
          const validSongsOnly = tasteRecs.filter((r) => !r.type || r.type === 'song').map((r) => ({ ...r, type: 'song' as const }));
          candidateList.push(...validSongsOnly);
          finalSuggestions = candidateList.slice(0, 6);
        }
        setSuggestions(finalSuggestions);
        playlistSuggestionsCache.set(cacheKey, { trackIdsHash, suggestions: finalSuggestions });
      } else {
        // Empty playlist: use full multi-factor taste profile recommendations
        const suggestions = await getTasteProfileRecommendations(userProfile, plIds, 6);
        const validSongsOnly = suggestions.filter((r) => !r.type || r.type === 'song').map((r) => ({ ...r, type: 'song' as const }));
        setSuggestions(validSongsOnly);
        playlistSuggestionsCache.set(cacheKey, { trackIdsHash, suggestions: validSongsOnly });
      }
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
        pl.customCover = dataUrl;
        pl.thumb = dataUrl;
        savePersistentPlaylistCover(target.id!, dataUrl);
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
  };

  const checkAutoScroll = (clientY: number) => {
    const threshold = 100;
    const scrollStep = 15;
    if (clientY < threshold) {
      window.scrollBy({ top: -scrollStep, behavior: 'auto' });
    } else if (window.innerHeight - clientY < threshold) {
      window.scrollBy({ top: scrollStep, behavior: 'auto' });
    }
  };

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
    touchActiveReorderIndexRef.current = null;

    const touch = e.touches[0];
    if (!touch) return;
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    // Responsive 500ms (0.5s) hold on the 6-dots button to unlock reordering
    // Once 0.5s has elapsed, reordering is permanently active until finger is released
    touchHoldTimerRef.current = setTimeout(() => {
      touchActiveReorderIndexRef.current = index;
      touchStartIndexRef.current = index;
      touchCurrentIndexRef.current = index;
      setDraggedIndex(index);
      setDragOverIndex(index);
      setReorderingTrackIndex(index);
      if (navigator.vibrate) {
        try {
          navigator.vibrate([35, 30, 35]);
        } catch {}
      }
    }, 500);

    const onGlobalTouchMove = (moveEvt: TouchEvent) => {
      const curTouch = moveEvt.touches[0];
      if (!curTouch) return;

      // If hold hasn't triggered yet (under 0.5s):
      if (touchActiveReorderIndexRef.current === null) {
        if (touchStartPosRef.current) {
          const dx = Math.abs(curTouch.clientX - touchStartPosRef.current.x);
          const dy = Math.abs(curTouch.clientY - touchStartPosRef.current.y);
          // Finger moved > 25px before 0.5s hold: user is scrolling page
          if (dx > 25 || dy > 25) {
            if (touchHoldTimerRef.current) {
              clearTimeout(touchHoldTimerRef.current);
              touchHoldTimerRef.current = null;
            }
          }
        }
        return;
      }

      // 0.5s+ elapsed: user held the grip and is now dragging
      if (moveEvt.cancelable) moveEvt.preventDefault();
      checkAutoScroll(curTouch.clientY);

      // Locate destination row using reliable bounding client rects
      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-track-index]'));
      let detectedIdx = -1;
      for (const r of rows) {
        const rect = r.getBoundingClientRect();
        if (curTouch.clientY >= rect.top && curTouch.clientY <= rect.bottom) {
          const parsed = parseInt(r.getAttribute('data-track-index') || '', 10);
          if (!isNaN(parsed)) {
            detectedIdx = parsed;
            break;
          }
        }
      }

      if (detectedIdx === -1 && rows.length > 0) {
        const firstRect = rows[0].getBoundingClientRect();
        const lastRect = rows[rows.length - 1].getBoundingClientRect();
        if (curTouch.clientY < firstRect.top) detectedIdx = 0;
        else if (curTouch.clientY > lastRect.bottom) detectedIdx = rows.length - 1;
      }

      if (detectedIdx >= 0 && detectedIdx !== touchCurrentIndexRef.current) {
        touchCurrentIndexRef.current = detectedIdx;
        setDragOverIndex(detectedIdx);
        if (navigator.vibrate) {
          try {
            navigator.vibrate(15);
          } catch {}
        }
      }
    };

    const onGlobalTouchEnd = () => {
      window.removeEventListener('touchmove', onGlobalTouchMove);
      window.removeEventListener('touchend', onGlobalTouchEnd);
      window.removeEventListener('touchcancel', onGlobalTouchEnd);

      if (touchHoldTimerRef.current) {
        clearTimeout(touchHoldTimerRef.current);
        touchHoldTimerRef.current = null;
      }

      if (touchActiveReorderIndexRef.current !== null && touchCurrentIndexRef.current !== null) {
        const from = touchActiveReorderIndexRef.current;
        const to = touchCurrentIndexRef.current;
        if (from !== to && from >= 0 && to >= 0 && from < tracks.length && to < tracks.length) {
          const updated = [...tracks];
          const [moved] = updated.splice(from, 1);
          updated.splice(to, 0, moved);
          setTracks(updated);
          if (target.type === 'custom-playlist' && target.id) {
            updatePlaylistTracks(target.id, updated);
          }
          if (navigator.vibrate) {
            try {
              navigator.vibrate(25);
            } catch {}
          }
        }
      }
      touchActiveReorderIndexRef.current = null;
      touchStartIndexRef.current = null;
      touchCurrentIndexRef.current = null;
      touchStartPosRef.current = null;
      setDraggedIndex(null);
      setDragOverIndex(null);
      setReorderingTrackIndex(null);
    };

    window.addEventListener('touchmove', onGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', onGlobalTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onGlobalTouchEnd, { passive: true });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Handled seamlessly by window touchmove listener
    if (touchActiveReorderIndexRef.current !== null && e.cancelable) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    // Handled seamlessly by window touchend listener
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    checkAutoScroll(e.clientY);
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
  };

  const getHeroArt = () => {
    if (target.type === 'liked') {
      return (
        <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[#401500] flex items-center justify-center text-white shadow-2xl flex-shrink-0">
          <Heart className="w-20 h-20 fill-white" />
        </div>
      );
    }
    if (target.type === 'downloads') {
      return (
        <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-2xl bg-[#1c1c1e] border border-white/10 flex items-center justify-center text-[var(--accent)] shadow-2xl flex-shrink-0">
          <Download className="w-20 h-20" />
        </div>
      );
    }
    if (target.type === 'custom-playlist') {
      const pl = userProfile.customPlaylists.find((p) => p.id === target.id);
      const customCover = (target.id ? getPersistentPlaylistCover(target.id) : null) || pl?.customCover;
      return (
        <div className="relative group w-40 h-40 sm:w-52 sm:h-52 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0">
          <PlaylistCover
            cover={customCover}
            tracks={tracks}
            sizeClass="w-full h-full"
            roundedClass="rounded-2xl"
            alt={getTitle()}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-white text-xs font-bold transition-opacity cursor-pointer z-10"
          >
            <Camera className="w-6 h-6" />
            <span>{t('collection.changeCover', 'Change Cover')}</span>
          </button>
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
        </div>
      );
    }
    return (
      <div className="relative group w-40 h-40 sm:w-52 sm:h-52 rounded-2xl bg-[#1f1f23] border border-white/10 flex items-center justify-center text-white/40 shadow-2xl flex-shrink-0">
        <Play className="w-16 h-16" />
      </div>
    );
  };

  const getTitle = () => {
    if (target.type === 'liked') return t('library.likedSongs', 'Liked Songs');
    if (target.type === 'downloads') return t('library.downloads', 'Downloaded Music');
    return target.title || t('common.playlist', 'Collection');
  };

  const getSubtitle = () => {
    if (target.type === 'downloads') return `${tracks.length} ${t('common.tracks', 'tracks')} • ${downloadSize}`;
    return `${tracks.length} ${t('common.tracks', 'tracks')}`;
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
          {isRenaming && target.type === 'custom-playlist' && target.id ? (
            <div className="flex items-center gap-2 max-w-lg">
              <input
                type="text"
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (nameInput.trim()) {
                      renamePlaylist(target.id!, nameInput.trim());
                      setIsRenaming(false);
                    }
                  } else if (e.key === 'Escape') {
                    setIsRenaming(false);
                  }
                }}
                className="w-full bg-[#1c1c1e] border border-[var(--accent)] rounded-xl px-3 py-2 text-2xl sm:text-3xl font-black text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (nameInput.trim()) {
                    renamePlaylist(target.id!, nameInput.trim());
                    setIsRenaming(false);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-black font-extrabold text-sm hover:scale-105 active:scale-95 transition-all"
              >
                {t('common.save', 'Save')}
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="p-2.5 rounded-xl bg-white/10 text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center sm:justify-start gap-2.5 group/title">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-none break-words">
                {getTitle()}
              </h2>
              {target.type === 'custom-playlist' && target.id && (
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(getTitle());
                    setIsRenaming(true);
                  }}
                  className="p-2 text-white/40 hover:text-[var(--accent)] hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                  title="Rename Playlist"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
          <p className="text-sm font-semibold text-white/50">{getSubtitle()}</p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
            {tracks.length > 0 && !isSelectMode && (
              <>
                <button
                  onClick={() => playWholeCollection(tracks)}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--accent)] text-black font-extrabold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>{t('collection.playAll', 'Play')}</span>
                </button>

                <button
                  onClick={() => playShuffledCollection(tracks)}
                  className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>{t('collection.shuffle', 'Shuffle')}</span>
                </button>
              </>
            )}

            {/* Reorder Mode Toggle (Custom Playlists) */}
            {target.type === 'custom-playlist' && target.id && tracks.length > 1 && !isSelectMode && (
              <button
                id="toggle-reorder-mode-btn"
                onClick={() => setIsReorderMode(!isReorderMode)}
                className={`flex items-center gap-2 px-4 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${
                  isReorderMode
                    ? 'bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent-soft)] scale-105'
                    : 'bg-white/10 hover:bg-white/15 text-white/80 hover:text-white'
                }`}
                title="Reorder songs in playlist"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span>{isReorderMode ? t('collection.done', 'Done') : t('collection.reorder', 'Reorder')}</span>
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
                className={`flex items-center gap-2 px-4 py-3 rounded-full font-bold text-sm transition-all cursor-pointer ${
                  isSelectMode
                    ? 'bg-[var(--accent)] text-black shadow-md'
                    : 'bg-white/10 hover:bg-white/15 text-white/80 hover:text-white'
                }`}
              >
                <ListCheck className="w-4 h-4" />
                <span>{isSelectMode ? t('collection.done', 'Done') : t('collection.select', 'Select')}</span>
              </button>
            )}

            {/* Download all collection songs */}
            {target.type !== 'downloads' && tracks.length > 0 && !isSelectMode && (
              <button
                onClick={() => downloadPlaylist(tracks)}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                title={t('collection.downloadAll', 'Download All')}
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Custom Playlist specific actions */}
            {target.type === 'custom-playlist' && target.id && !isSelectMode && (
              <>
                <button
                  onClick={() => setModalAddSongByLinkPlId(target.id!)}
                  className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                  title="Add song by link"
                >
                  <Link className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setModalConfirm({
                      title: `${t('collection.deletePlaylist', 'Delete')} "${target.title}"?`,
                      text: 'The playlist will be permanently removed.',
                      onConfirm: () => deletePlaylist(target.id!),
                    });
                  }}
                  className="p-3 rounded-full bg-white/5 hover:bg-red-500/10 text-white/70 hover:text-red-400 transition-colors cursor-pointer"
                  title={t('collection.deletePlaylist', 'Delete Playlist')}
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
                className="flex items-center gap-2 px-4 py-3 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-sm transition-colors border border-red-500/20 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('account.clearAndReset', 'Delete All')}</span>
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
                  <CheckSquare className="w-4 h-4 text-[var(--accent)]" />
                  <span>{t('collection.deselectAll', 'Deselect All')}</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-white/60" />
                  <span>{t('collection.selectAll', 'Select All')}</span>
                </>
              )}
            </button>
            <span className="text-sm font-semibold text-white/70">
              {selectedIds.length} {t('common.of', 'of')} {tracks.length} {t('common.selected', 'selected')}
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
                  <FolderPlus className="w-4 h-4 text-[var(--accent)]" />
                  <span>{t('collection.addToPlaylist', 'Add to Playlist')}</span>
                </button>

                {showAddToPlaylistMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-[#252528] rounded-xl border border-white/15 shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <p className="px-3 py-2 text-[11px] font-bold text-white/40 uppercase tracking-wider">
                      {t('collection.addTo', 'Add to')}:
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
                title={t('collection.download', 'Download')}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{t('collection.download', 'Download')}</span>
              </button>
            )}

            {/* Delete/Remove selected */}
            {(target.type === 'custom-playlist' || target.type === 'downloads' || target.type === 'liked') && (
              <button
                onClick={handleDeleteSelected}
                disabled={selectedIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 disabled:opacity-40 disabled:pointer-events-none text-red-400 text-xs font-bold transition-colors border border-red-500/20"
                title={t('collection.remove', 'Remove')}
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">{t('collection.remove', 'Remove')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reorder Mode Sticky Toolbar */}
      {isReorderMode && (
        <div className="sticky top-16 z-30 flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--accent-soft)] backdrop-blur-xl border border-[var(--accent)]/40 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <ArrowUpDown className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
            <span>{t('collection.reorderHelp', 'Hold handle 0.5s or tap ▲/▼ to reorder songs.')}</span>
          </div>
          <button
            onClick={() => setIsReorderMode(false)}
            className="px-3.5 py-1.5 rounded-xl bg-[var(--accent)] hover:opacity-90 text-black text-xs font-black transition-colors shadow-md flex-shrink-0 cursor-pointer"
          >
            {t('collection.done', 'Done')}
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
            <p className="text-base font-bold">{t('collection.emptyPlaylist', 'This playlist has no songs yet.')}</p>
            <p className="text-xs">{t('collection.emptyPlaylistSubtitle', 'Add songs using search, ⋮ menus, or by link.')}</p>
          </div>
        ) : (
          tracks.map((t, idx) => (
            <div
              key={`${t.id}-${idx}`}
              data-track-index={idx}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              className={`transition-all rounded-xl ${
                dragOverIndex === idx ? 'border-t-2 border-[var(--accent)] bg-[var(--accent-soft)]' : ''
              } ${
                reorderingTrackIndex === idx
                  ? 'ring-2 ring-[var(--accent)] shadow-2xl bg-[var(--accent-soft)] scale-[1.02] z-20'
                  : ''
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
                  target.type === 'custom-playlist' && isReorderMode && !isSelectMode
                    ? {
                        draggable: true,
                        onDragStart: (e: any) => handleDragStart(e, idx),
                        onTouchStart: (e: any) => handleTouchStart(e, idx),
                        onTouchMove: (e: any) => handleTouchMove(e),
                        onTouchEnd: () => handleTouchEnd(),
                        onTouchCancel: () => handleTouchEnd(),
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
                {t('collection.recommendedForPlaylist', 'Recommended for this playlist')}
              </h3>
              <p className="text-xs text-white/50">{t('collection.recommendedSubtitle', 'Click any song to preview/listen before adding')}</p>
            </div>
            <button
              onClick={() => loadPlaylistSuggestions(tracks, true)}
              disabled={loadingSuggestions}
              className="flex items-center gap-1 text-xs font-bold text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSuggestions ? 'animate-spin' : ''}`} />
              <span>{t('collection.refreshRecommendations', 'Refresh')}</span>
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
                    isSugActive ? 'bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]' : 'hover:bg-white/[0.06]'
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
                          isSugActive ? 'text-[var(--accent)]' : 'text-white'
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
                    className="p-2 rounded-full border border-white/20 text-white hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all hover:scale-110 active:scale-95 ml-2 flex-shrink-0"
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
