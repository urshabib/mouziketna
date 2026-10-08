import React, { useEffect, useState, useMemo } from 'react';
import { useMusic } from '../context/MusicContext';
import { Track } from '../types';
import {
  WifiOff,
  Play,
  Shuffle,
  Download,
  Music2,
  HardDrive,
  Search,
  ListMusic,
  Trash2,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import {
  listDownloads,
  getTotalDownloadedSize,
  formatBytes,
  deleteDownload,
  getPersistentPlaylistCover,
} from '../services/storage';
import { PlaylistCover } from '../components/PlaylistCover';
import { TrackThumbImage } from '../services/useTrackThumb';

export const OfflineView: React.FC = () => {
  const {
    userProfile,
    playTrack,
    playWholeCollection,
    playShuffledCollection,
    playCollectionFromIndex,
    openCollection,
    downloadedSet,
    deletePlaylist,
    setModalConfirm,
    setActivePane,
    showToast,
    t,
  } = useMusic();

  const [downloadedTracks, setDownloadedTracks] = useState<Track[]>([]);
  const [downloadSize, setDownloadSize] = useState('0 MB');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'songs' | 'playlists'>('songs');
  const [loading, setLoading] = useState(true);

  // Load all offline downloaded tracks from IndexedDB
  const refreshDownloads = async () => {
    setLoading(true);
    try {
      const records = await listDownloads();
      const tracks: Track[] = records.map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artist,
        thumb: r.thumbLowRes ? URL.createObjectURL(r.thumbLowRes) : null,
        type: 'song',
      }));
      setDownloadedTracks(tracks);
      const totalBytes = await getTotalDownloadedSize();
      setDownloadSize(formatBytes(totalBytes));
    } catch {
      setDownloadedTracks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshDownloads();
  }, [downloadedSet]);

  // Filter downloaded songs based on search query
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return downloadedTracks;
    const q = searchQuery.toLowerCase().trim();
    return downloadedTracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    );
  }, [downloadedTracks, searchQuery]);

  // Offline playlists: User's custom playlists with downloaded tracks or all playlists
  const offlinePlaylists = useMemo(() => {
    return (userProfile.customPlaylists || []).map((pl) => {
      const availableTracks = pl.tracks.filter((t) => downloadedSet.has(t.id));
      return {
        ...pl,
        availableTracks,
        offlineCount: availableTracks.length,
      };
    });
  }, [userProfile.customPlaylists, downloadedSet]);

  const handlePlayAll = () => {
    if (downloadedTracks.length === 0) return;
    playWholeCollection(downloadedTracks);
    showToast(`Playing ${downloadedTracks.length} offline tracks`, true);
  };

  const handleShuffleAll = () => {
    if (downloadedTracks.length === 0) return;
    playShuffledCollection(downloadedTracks);
    showToast(`Shuffled ${downloadedTracks.length} offline tracks`, true);
  };

  const handleDeleteOfflineTrack = async (e: React.MouseEvent, trackId: string, trackTitle: string) => {
    e.stopPropagation();
    setModalConfirm({
      title: `Remove "${trackTitle}" from offline?`,
      text: 'This song audio file will be deleted from device storage.',
      onConfirm: async () => {
        await deleteDownload(trackId);
        showToast('Track removed from offline storage', true);
        refreshDownloads();
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-24 select-none animate-in fade-in duration-300">
      {/* 1. Offline Mode Dynamic Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/15 via-white/[0.03] to-black/60 border border-amber-500/30 p-5 sm:p-7 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner flex-shrink-0">
              <WifiOff className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest text-amber-400 uppercase bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  Offline Mode Active
                </span>
                <span className="text-[11px] text-white/40 font-semibold hidden sm:inline">
                  • Auto-switched
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                Your Offline Music Hub
              </h2>
              <p className="text-xs text-white/60 font-medium max-w-md mt-0.5">
                No internet connection detected. Playing directly from your device storage with instant audio & lyrics. Reconnects automatically when Wi-Fi is back.
              </p>
            </div>
          </div>

          {/* Quick Storage Stats & Manual Check */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-white/80">
              <HardDrive className="w-4 h-4 text-[var(--accent)]" />
              <span>{downloadedTracks.length} tracks • {downloadSize}</span>
            </div>
            <button
              onClick={() => {
                if (navigator.onLine) {
                  setActivePane('home');
                  showToast('Reconnected to online mode', true);
                } else {
                  showToast('Still offline • Keeping local storage mode', true);
                }
              }}
              className="flex items-center gap-1.5 text-[11px] font-bold text-white/50 hover:text-white px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Check Connection</span>
            </button>
          </div>
        </div>

        {/* Action Controls: Play All, Shuffle, Search */}
        <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-white/10">
          <button
            onClick={handlePlayAll}
            disabled={downloadedTracks.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent)] text-black font-black text-xs sm:text-sm shadow-lg hover:scale-105 active:scale-95 disabled:opacity-30 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>Play All ({downloadedTracks.length})</span>
          </button>

          <button
            onClick={handleShuffleAll}
            disabled={downloadedTracks.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm border border-white/10 hover:scale-105 active:scale-95 disabled:opacity-30 transition-all cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle</span>
          </button>

          {/* Search filter for offline songs */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search downloaded songs..."
              className="w-full bg-black/40 border border-white/10 rounded-full pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs (Downloaded Songs vs Playlists) */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('songs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            activeTab === 'songs'
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <Music2 className="w-4 h-4 text-[var(--accent)]" />
          <span>Downloaded Songs ({filteredTracks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('playlists')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            activeTab === 'playlists'
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <ListMusic className="w-4 h-4 text-[var(--accent)]" />
          <span>Offline Playlists ({offlinePlaylists.length})</span>
        </button>
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'songs' && (
        <section className="flex flex-col gap-2">
          {filteredTracks.length > 0 ? (
            <div className="playlist-tracks-container flex flex-col divide-y divide-white/[0.04] p-1 sm:p-2 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-xl">
              {filteredTracks.map((track, idx) => (
                <div
                  key={track.id}
                  onClick={() => playCollectionFromIndex(filteredTracks, idx)}
                  data-track-row="true"
                  className="track-row group flex items-center justify-between p-2 sm:p-2.5 rounded-lg hover:bg-white/[0.06] transition-all duration-150 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-5 text-center text-xs font-bold text-white/30 group-hover:text-[var(--accent)]">
                      {idx + 1}
                    </span>

                    <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-white/5 border border-white/5 flex-shrink-0">
                      <TrackThumbImage
                        track={track}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-white truncate group-hover:text-[var(--accent)] transition-colors">
                        {track.title}
                      </h4>
                      <p className="text-xs text-white/50 truncate mt-0.5">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-2 flex-shrink-0">
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 hidden sm:inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Ready</span>
                    </span>

                    <button
                      onClick={(e) => handleDeleteOfflineTrack(e, track.id, track.title)}
                      className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
                      title="Remove from offline"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-3xl bg-white/[0.02] border border-white/5">
              <Download className="w-12 h-12 text-white/20 mb-3" />
              <h3 className="text-base font-bold text-white">
                {searchQuery ? 'No matching offline songs' : 'No downloaded songs found'}
              </h3>
              <p className="text-xs text-white/40 max-w-sm mt-1">
                {searchQuery
                  ? 'Try searching with a different song title or artist.'
                  : 'When online, click the download button on any song or playlist to save it for offline listening.'}
              </p>
            </div>
          )}
        </section>
      )}

      {activeTab === 'playlists' && (
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {offlinePlaylists.map((pl) => {
            const customCover = (pl.id ? getPersistentPlaylistCover(pl.id) : null) || pl.customCover;
            return (
              <div
                key={pl.id}
                onClick={() => openCollection('custom-playlist', pl.id, pl.name, customCover, pl.tracks)}
                className="card-surface group relative flex flex-col p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all cursor-pointer shadow-sm"
              >
                <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-white/[0.04] border border-white/5 shadow-md group-hover:scale-105 transition-transform duration-300">
                  <PlaylistCover
                    cover={customCover}
                    tracks={pl.tracks}
                    sizeClass="w-full h-full"
                    roundedClass="rounded-xl"
                    alt={pl.name}
                  />

                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-bold text-white flex items-center gap-1">
                    <Download className="w-3 h-3 text-[var(--accent)]" />
                    <span>{pl.offlineCount} offline</span>
                  </div>
                </div>

                <h4 className="font-bold text-sm text-white truncate">{pl.name}</h4>
                <p className="text-xs text-white/50 truncate font-medium mt-0.5">
                  {pl.offlineCount} of {pl.tracks?.length || 0} tracks available
                </p>
              </div>
            );
          })}

          {offlinePlaylists.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center rounded-3xl bg-white/[0.02] border border-white/5">
              <ListMusic className="w-12 h-12 text-white/20 mb-3" />
              <h3 className="text-base font-bold text-white">No custom playlists found</h3>
              <p className="text-xs text-white/40 max-w-sm mt-1">
                Create playlists and download songs to enjoy your custom playlists offline anytime.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Bottom Clearance Spacer */}
      <div className="w-full h-24 flex-shrink-0" />
    </div>
  );
};
