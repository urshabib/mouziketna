import React, { useMemo, useRef, useState } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  User,
  Camera,
  Heart,
  Music2,
  Download,
  ShieldAlert,
  Settings,
  LogOut,
  LogIn,
  Clock,
  Play,
  Flame,
  Award,
  BarChart3,
  Sparkles,
  Disc,
  RefreshCw,
  Loader2,
  RotateCcw,
  Trash2,
  Ban,
  ThumbsUp,
  EyeOff,
  Eye,
  Info,
} from 'lucide-react';
import { TrackThumbImage } from '../services/useTrackThumb';
import { Track, SongPlayStat } from '../types';

export const AccountView: React.FC = () => {
  const {
    globalUser,
    userProfile,
    syncProfile,
    setActivePane,
    openCollection,
    playTrack,
    toggleLikeTrack,
    logout,
    setIsAuthGateOpen,
    showToast,
    downloadedSet,
    forceProfileServerSync,
    clearListeningStats,
    hideSongFromStats,
    unhideSongFromStats,
    isSyncingToServer,
    lastServerSyncTime,
    getInterestedTracks,
    getNotInterestedTracks,
    removeTrackFromTaste,
    t,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<'songs' | 'artists' | 'taste' | 'overview' | 'hidden'>('songs');
  const [isConfirmResetStatsOpen, setIsConfirmResetStatsOpen] = useState(false);
  const [isClearingStats, setIsClearingStats] = useState(false);
  const [songToHideConfirm, setSongToHideConfirm] = useState<SongPlayStat | null>(null);
  const [songToUnhideConfirm, setSongToUnhideConfirm] = useState<SongPlayStat | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  // Auto-sync profile stats when opening profile view
  React.useEffect(() => {
    if (globalUser && globalUser !== 'admin') {
      forceProfileServerSync().catch(() => {});
    }
  }, [globalUser]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      syncProfile({ ...userProfile, avatarUrl: dataUrl });
      showToast('Avatar updated');
    };
    reader.readAsDataURL(file);
  };

  const username = globalUser || userProfile.username || t('account.guest', 'Guest');
  const isAdmin = userProfile.isAdmin || globalUser === 'habib' || false;

  const stats = userProfile.stats || {
    totalMinutesListened: 0,
    totalTracksPlayed: 0,
    topSongs: [],
    topArtists: [],
  };

  const hiddenSongs = userProfile.hiddenStatsSongs || [];
  const hiddenSongIds = useMemo(() => new Set(hiddenSongs.map((s) => s.id)), [hiddenSongs]);

  const formatHoursAndMinutes = (totalMins: number) => {
    if (!totalMins || totalMins <= 0) return `0 ${t('common.minutes', 'mins')}`;
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours === 0) return `${mins} ${t('common.minutes', 'mins')}`;
    if (mins === 0) return `${hours} ${t('common.hours', 'hrs')}`;
    return `${hours}h ${mins}m`;
  };

  // Strictly filter out hidden songs from top songs
  const topSongs = useMemo(() => {
    return (stats.topSongs || []).filter((s) => !hiddenSongIds.has(s.id));
  }, [stats.topSongs, hiddenSongIds]);

  // Derive top artists strictly from visible (non-hidden) songs so hiding top song never leaves old artist stuck
  const topArtists = useMemo(() => {
    const artistMap = new Map<string, { name: string; playCount: number; minutesListened: number; thumb?: string | null }>();
    topSongs.forEach((song: SongPlayStat) => {
      const art = (song.artist || 'Unknown').trim();
      if (!art || art.toLowerCase() === 'various artists') return;
      const key = art.toLowerCase();
      const existing = artistMap.get(key);
      if (existing) {
        existing.playCount += song.playCount || 1;
        existing.minutesListened += song.minutesListened || 0;
        if (!existing.thumb && song.thumb) existing.thumb = song.thumb;
      } else {
        artistMap.set(key, {
          name: art,
          playCount: song.playCount || 1,
          minutesListened: song.minutesListened || 0,
          thumb: song.thumb,
        });
      }
    });

    const list = Array.from(artistMap.values()).sort(
      (a, b) => ((b.minutesListened || 0) * 3 + (b.playCount || 0) * 2) - ((a.minutesListened || 0) * 3 + (a.playCount || 0) * 2)
    );
    return list;
  }, [topSongs]);

  const topSong = topSongs[0];
  const topArtist = topArtists[0];
  const interestedTracks = getInterestedTracks();
  const dislikedTracks = getNotInterestedTracks();

  const startSongLongPress = (song: SongPlayStat) => {
    isLongPressTriggeredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
      setSongToHideConfirm(song);
    }, 500);
  };

  const cancelSongLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-3xl pb-28 select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* User Hero Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 rounded-3xl bg-white/[0.03] glass-panel border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#ff6b1a]/15 rounded-full blur-3xl pointer-events-none" />

        <div
          className="relative group cursor-pointer flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-[#ff6b1a] to-[#802a00] flex items-center justify-center text-white text-3xl font-black shadow-2xl border-2 border-white/20">
            {userProfile.avatarUrl ? (
              <img
                src={userProfile.avatarUrl}
                alt={username}
                className="w-full h-full object-cover"
              />
            ) : (
              username.charAt(0).toUpperCase()
            )}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
            <Camera className="w-6 h-6" />
          </div>
        </div>

        <div className="flex flex-col items-center sm:items-start gap-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {username}
            </h2>
            {isAdmin && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#ff6b1a]/20 text-[#ff6b1a] border border-[#ff6b1a]/30 text-[10px] font-black uppercase tracking-wider">
                Admin
              </span>
            )}
          </div>

          <p className="text-xs text-white/50 font-medium">
            {globalUser
              ? `${t('account.syncedCloudflare', 'Profile & Statistics synced to Cloudflare Server')}${
                  lastServerSyncTime
                    ? ` • ${t('settings.lastSynced', 'Last synced')} ${new Date(lastServerSyncTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : ''
                }`
              : t('account.signInPrompt', 'Please sign in with your account to access Cloudflare sync')}
          </p>

          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center sm:justify-start">
            {globalUser && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await forceProfileServerSync();
                  if (ok) showToast('All statistics & playlists synced to Cloudflare!');
                  else showToast('Changes saved locally');
                }}
                disabled={isSyncingToServer}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-bold text-xs transition-colors border border-white/10 cursor-pointer disabled:opacity-50"
                title="Synchronize profile data, playlists, and listening statistics with Cloudflare"
              >
                {isSyncingToServer ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff6b1a]" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-[#ff6b1a]" />
                )}
                <span>{isSyncingToServer ? t('settings.syncing', 'Syncing...') : t('account.syncCloudflare', 'Sync to Cloudflare')}</span>
              </button>
            )}

            {globalUser ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs transition-colors border border-white/10 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('account.signOut', 'Log Out')}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthGateOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff6b1a] text-black font-black text-xs transition-transform hover:scale-105 active:scale-95 shadow-md shadow-[#ff6b1a]/25 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t('account.signIn', 'Sign In')}</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setActivePane('admin')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs transition-colors border border-white/10 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-[#ff6b1a]" />
                <span>{t('account.adminConsole', 'Admin Console')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spicetify / Spotify-Style Listening Statistics Hero Tiles */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#ff6b1a]" />
            <h3 className="text-lg font-black text-white">{t('account.title', 'Listening Statistics')}</h3>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold text-white/40">{t('account.syncedCloudflare', 'Cloud Synchronized')}</span>
            <button
              type="button"
              onClick={() => setIsConfirmResetStatsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-red-500/15 text-white/60 hover:text-red-400 border border-white/10 text-[11px] font-bold transition-all cursor-pointer"
              title="Reset listening statistics to 0 and sync with cloud"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('account.resetStats', 'Reset Stats')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Total Hours Listened */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-1 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <Clock className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                {t('account.time', 'Time')}
              </span>
            </div>
            <span className="text-2xl sm:text-3xl font-black text-white mt-1.5 tracking-tight">
              {formatHoursAndMinutes(stats.totalMinutesListened || 0)}
            </span>
            <span className="text-xs text-white/50 font-semibold">{t('account.totalListened', 'Total Listened')}</span>
          </div>

          {/* Total Tracks Played */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-1 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <Flame className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                {t('account.plays', 'Plays')}
              </span>
            </div>
            <span className="text-2xl sm:text-3xl font-black text-white mt-1.5 tracking-tight">
              {stats.totalTracksPlayed || 0}
            </span>
            <span className="text-xs text-white/50 font-semibold">{t('account.songsPlayed', 'Songs Played')}</span>
          </div>

          {/* Top Song */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-1 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <Award className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                {t('account.top1Track', '#1 Track')}
              </span>
            </div>
            <span className="text-sm font-black text-white mt-2 truncate">
              {topSong?.title || 'No plays yet'}
            </span>
            <span className="text-xs text-white/50 font-semibold truncate">
              {topSong ? `${topSong.playCount || 1} ${t('account.playsCount', 'plays')}` : 'Start listening'}
            </span>
          </div>

          {/* Top Artist */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-1 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <Sparkles className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                {t('account.top1Artist', '#1 Artist')}
              </span>
            </div>
            <span className="text-sm font-black text-white mt-2 truncate">
              {topArtist?.name || 'No plays yet'}
            </span>
            <span className="text-xs text-white/50 font-semibold truncate">
              {topArtist ? formatHoursAndMinutes(topArtist.minutesListened) : 'Start listening'}
            </span>
          </div>
        </div>
      </section>

      {/* Tabs Filter (Top Songs | Top Artists | Music Taste | Collections | Hidden Songs) */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('songs')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
              activeTab === 'songs'
                ? 'bg-[#ff6b1a] text-black shadow-md shadow-[#ff6b1a]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            {t('account.topSongs', 'Top Listened Songs')} ({topSongs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('artists')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
              activeTab === 'artists'
                ? 'bg-[#ff6b1a] text-black shadow-md shadow-[#ff6b1a]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            {t('account.topArtists', 'Top Artists')} ({topArtists.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('taste')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'taste'
                ? 'bg-[#ff6b1a] text-black shadow-md shadow-[#ff6b1a]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('account.musicTaste', 'Music Taste')} ({interestedTracks.length + dislikedTracks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
              activeTab === 'overview'
                ? 'bg-[#ff6b1a] text-black shadow-md shadow-[#ff6b1a]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            {t('account.collections', 'Collections')}
          </button>

          {/* Hidden Songs Tab (On the right of Collections) */}
          <button
            type="button"
            onClick={() => setActiveTab('hidden')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'hidden'
                ? 'bg-[#ff6b1a] text-black shadow-md shadow-[#ff6b1a]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>{t('account.hiddenSongs', 'Hidden Songs')} ({hiddenSongs.length})</span>
          </button>
        </div>

        {/* Tab 1: Top Listened Songs Ranked List */}
        {activeTab === 'songs' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 text-[11px] text-white/40 pb-1">
              <span>{t('account.longPressToHide', 'Tip: Long press any song to hide it from your listening statistics')}</span>
            </div>

            {topSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 rounded-3xl bg-white/[0.02] border border-white/5 text-center gap-3">
                <Disc className="w-10 h-10 text-white/20" />
                <p className="text-sm font-bold text-white/60">No track statistics recorded yet.</p>
                <p className="text-xs text-white/40 max-w-sm">
                  Play songs in the app to automatically build your listening statistics dashboard!
                </p>
              </div>
            ) : (
              topSongs.map((song: SongPlayStat, idx: number) => {
                const rank = idx + 1;
                const badgeColor =
                  rank === 1
                    ? 'bg-amber-400 text-black border-amber-300'
                    : rank === 2
                    ? 'bg-zinc-300 text-black border-zinc-200'
                    : rank === 3
                    ? 'bg-amber-700 text-white border-amber-600'
                    : 'bg-white/10 text-white/70 border-white/10';

                const trackObj: Track = {
                  id: song.id,
                  title: song.title,
                  artist: song.artist,
                  thumb: song.thumb || null,
                  type: 'song',
                };

                return (
                  <div
                    key={song.id}
                    onPointerDown={() => startSongLongPress(song)}
                    onPointerUp={cancelSongLongPress}
                    onPointerLeave={cancelSongLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSongToHideConfirm(song);
                    }}
                    onClick={() => {
                      if (!isLongPressTriggeredRef.current) {
                        playTrack(trackObj);
                      }
                    }}
                    className="flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all cursor-pointer group select-none"
                    title={t('account.longPressToHide', 'Long press to hide from statistics')}
                  >
                    {/* Rank Badge */}
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border flex-shrink-0 shadow-sm ${badgeColor}`}
                    >
                      {rank}
                    </span>

                    {/* Thumbnail */}
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 shadow-md">
                      <TrackThumbImage
                        track={trackObj}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>

                    {/* Track Info */}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-sm text-white truncate group-hover:text-[#ff6b1a] transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-xs text-white/50 font-medium truncate mt-0.5">
                        {song.artist}
                      </p>
                    </div>

                    {/* Metrics Badge */}
                    <div className="flex flex-col items-end flex-shrink-0 pl-2">
                      <span className="text-xs font-black text-[#ff6b1a]">
                        {song.playCount || 1} {song.playCount === 1 ? t('account.playCountSingle', 'play') : t('account.playsCount', 'plays')}
                      </span>
                      <span className="text-[11px] font-semibold text-white/40">
                        {formatHoursAndMinutes(song.minutesListened || 1)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSongToHideConfirm(song);
                        }}
                        className="p-2 text-white/30 hover:text-white hover:bg-white/10 transition-colors rounded-full"
                        title={t('account.hideSongTitle', 'Hide from stats')}
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLikeTrack(trackObj);
                        }}
                        className="p-2 text-white/40 hover:text-[#ff6b1a] transition-colors rounded-full"
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            userProfile.likedSongs?.some((s) => s.id === song.id)
                              ? 'fill-[#ff6b1a] text-[#ff6b1a]'
                              : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Top Artists List */}
        {activeTab === 'artists' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topArtists.length === 0 ? (
              <div className="col-span-2 flex flex-col items-center justify-center py-12 px-4 rounded-3xl bg-white/[0.02] border border-white/5 text-center gap-3">
                <User className="w-10 h-10 text-white/20" />
                <p className="text-sm font-bold text-white/60">No artist statistics recorded yet.</p>
              </div>
            ) : (
              topArtists.map((artist: { name: string; playCount: number; minutesListened: number; thumb?: string | null }, idx: number) => (
                <div
                  key={artist.name}
                  onClick={() => openCollection('artist', artist.name, artist.name, artist.thumb || undefined)}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all cursor-pointer group"
                >
                  <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-black text-white/70 flex-shrink-0">
                    {idx + 1}
                  </span>

                  <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-900 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-md">
                    {artist.thumb ? (
                      <img src={artist.thumb} alt={artist.name} className="w-full h-full object-cover" />
                    ) : (
                      artist.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-sm text-white truncate group-hover:text-[#ff6b1a] transition-colors">
                      {artist.name}
                    </h4>
                    <p className="text-xs text-white/40 font-semibold mt-0.5">
                      {formatHoursAndMinutes(artist.minutesListened || 1)} {t('account.totalListened', 'listened')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Collection Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => openCollection('liked')}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <Heart className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-2xl font-black text-white mt-2">
                {userProfile.likedSongs?.length || 0}
              </span>
              <span className="text-xs text-white/40 font-semibold">{t('library.likedSongs', 'Liked Songs')}</span>
            </div>

            <div
              onClick={() => setActivePane('library')}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <Music2 className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-2xl font-black text-white mt-2">
                {userProfile.customPlaylists?.length || 0}
              </span>
              <span className="text-xs text-white/40 font-semibold">{t('library.playlists', 'Playlists')}</span>
            </div>

            <div
              onClick={() => setActivePane('library')}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <User className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-2xl font-black text-white mt-2">
                {userProfile.favouriteArtists?.length || 0}
              </span>
              <span className="text-xs text-white/40 font-semibold">{t('library.favoriteArtists', 'Favorite Artists')}</span>
            </div>

            <div
              onClick={() => openCollection('downloads')}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <Download className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-2xl font-black text-white mt-2">{downloadedSet.size}</span>
              <span className="text-xs text-white/40 font-semibold">{t('library.downloads', 'Downloads')}</span>
            </div>
          </div>
        )}

        {/* Tab 4: Music Taste Tuning (Interested & Not Interested) */}
        {activeTab === 'taste' && (
          <div className="flex flex-col gap-6">
            {/* Informational Hero Card */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ff6b1a]/15 border border-[#ff6b1a]/30 flex items-center justify-center text-[#ff6b1a] flex-shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">{t('account.tasteProfile', 'Your Music Taste Profile')}</h4>
                  <p className="text-xs text-white/50">
                    {t('account.tasteDesc', 'Tunes your smart recommendations and next-track discovery.')}
                  </p>
                </div>
              </div>
              <div className="text-[11px] text-white/40">
                Use the <strong>⋮</strong> menu on any track to tune your taste
              </div>
            </div>

            {/* Section 1: Interested Tracks (Prioritized) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-[#ff6b1a]" />
                  <h4 className="font-extrabold text-sm text-white">{t('account.interestedSongs', 'Interested Songs')} ({interestedTracks.length})</h4>
                </div>
                <span className="text-[11px] font-bold text-white/40">Prioritized in discovery & mixes</span>
              </div>

              {interestedTracks.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center flex flex-col items-center gap-2">
                  <Sparkles className="w-8 h-8 text-white/20" />
                  <p className="text-xs font-bold text-white/60">{t('account.noInterested', 'No interested songs yet')}</p>
                  <p className="text-[11px] text-white/40 max-w-xs">
                    Tap the ⋮ menu on songs you love and select "{t('modal.markInterested', 'Add to Music Taste (Interested)')}".
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {interestedTracks.map((tTrack) => (
                    <div
                      key={tTrack.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all group"
                    >
                      <div
                        onClick={() => playTrack(tTrack)}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                          <TrackThumbImage track={tTrack} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate group-hover:text-[#ff6b1a] transition-colors">{tTrack.title}</p>
                          <p className="text-[11px] text-white/50 truncate font-semibold">{tTrack.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pl-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => playTrack(tTrack)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-[#ff6b1a] text-white hover:text-black transition-colors cursor-pointer"
                          title="Play song"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTrackFromTaste(tTrack.id)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove from interested taste"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Not Interested Tracks (Filtered out) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-red-400" />
                  <h4 className="font-extrabold text-sm text-white">{t('account.notInterestedSongs', 'Not Interested / Muted')} ({dislikedTracks.length})</h4>
                </div>
                <span className="text-[11px] font-bold text-white/40">Excluded from autoplay & recommendations</span>
              </div>

              {dislikedTracks.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center flex flex-col items-center gap-2">
                  <Ban className="w-8 h-8 text-white/20" />
                  <p className="text-xs font-bold text-white/60">{t('account.noMuted', 'No muted songs')}</p>
                  <p className="text-[11px] text-white/40 max-w-xs">
                    Tap the ⋮ menu on songs you don't like and select "{t('modal.markNotInterested', 'Not Interested (Less like this)')}".
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {dislikedTracks.map((tTrack) => (
                    <div
                      key={tTrack.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all opacity-80 hover:opacity-100"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0">
                          <Ban className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white/80 truncate line-through decoration-red-400/50">{tTrack.title}</p>
                          <p className="text-[11px] text-white/40 truncate font-semibold">{tTrack.artist}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeTrackFromTaste(tTrack.id)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-colors cursor-pointer flex-shrink-0"
                        title="Unmute and remove from excluded list"
                      >
                        {t('account.unmute', 'Unmute')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Hidden Songs from Listening Stats */}
        {activeTab === 'hidden' && (
          <div className="flex flex-col gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#ff6b1a] flex-shrink-0">
                  <EyeOff className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">{t('account.hiddenSongs', 'Hidden Songs')}</h4>
                  <p className="text-xs text-white/50">{t('account.hiddenSongsDesc', 'Songs hidden from your top listening statistics')}</p>
                </div>
              </div>
            </div>

            {hiddenSongs.length === 0 ? (
              <div className="p-10 rounded-2xl bg-white/[0.02] border border-white/5 text-center flex flex-col items-center gap-2.5">
                <EyeOff className="w-8 h-8 text-white/20" />
                <p className="text-xs font-bold text-white/60">{t('account.noHiddenSongs', 'No hidden songs yet')}</p>
                <p className="text-[11px] text-white/40 max-w-sm">
                  {t('account.longPressToHide', 'Long press any song in Top Listened Songs to hide it from your profile statistics.')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {hiddenSongs.map((song) => {
                  const trackObj: Track = {
                    id: song.id,
                    title: song.title,
                    artist: song.artist,
                    thumb: song.thumb || null,
                    type: 'song',
                  };

                  return (
                    <div
                      key={song.id}
                      className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all group"
                    >
                      <div
                        onClick={() => playTrack(trackObj)}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                          <TrackThumbImage track={trackObj} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-sm text-white truncate group-hover:text-[#ff6b1a] transition-colors">
                            {song.title}
                          </h4>
                          <p className="text-xs text-white/50 font-medium truncate mt-0.5">
                            {song.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pl-2 flex-shrink-0">
                        <div className="flex flex-col items-end text-right hidden sm:flex">
                          <span className="text-xs font-black text-white/70">
                            {song.playCount || 1} {song.playCount === 1 ? t('account.playCountSingle', 'play') : t('account.playsCount', 'plays')}
                          </span>
                          <span className="text-[11px] font-semibold text-white/40">
                            {formatHoursAndMinutes(song.minutesListened || 1)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSongToUnhideConfirm(song)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff6b1a]/20 hover:bg-[#ff6b1a] text-[#ff6b1a] hover:text-black font-extrabold text-xs transition-colors border border-[#ff6b1a]/30 cursor-pointer"
                          title={t('account.unhideDesc', 'Restore to listening stats')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{t('account.unhide', 'Unhide')}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Settings Navigation Link */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setActivePane('settings')}
          className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-white/70" />
            <span className="text-sm font-bold text-white">{t('settings.appSettings', 'Audio & App Settings')}</span>
          </div>
          <span className="text-xs text-white/40 font-semibold">{t('common.open', 'Open')}</span>
        </button>
      </div>

      {/* In-App Confirmation Modal for Hiding a Song from Stats */}
      {songToHideConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#141416] border border-white/10 p-6 flex flex-col gap-4 shadow-2xl relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#ff6b1a]/15 border border-[#ff6b1a]/20 flex items-center justify-center text-[#ff6b1a] flex-shrink-0">
                <EyeOff className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">{t('account.hideSongTitle', 'Hide from Listening Stats?')}</h4>
                <p className="text-xs text-white/50 truncate max-w-[200px]">{songToHideConfirm.title}</p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              {t('account.hideSongDesc', 'Hide this song from your top listened tracks? Its minutes and play count will be deducted from your total stats.')}
            </p>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-white/50 flex items-center gap-2">
              <Info className="w-4 h-4 text-[#ff6b1a] flex-shrink-0" />
              <span>You can restore this song anytime from the <strong>Hidden Songs</strong> tab.</span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSongToHideConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                {t('modal.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  hideSongFromStats(songToHideConfirm.id);
                  showToast(t('account.songHidden', 'Song hidden from listening stats'));
                  setSongToHideConfirm(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#ff6b1a] hover:bg-[#ff7d33] active:scale-95 text-black font-black text-xs transition-all shadow-md shadow-[#ff6b1a]/25 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>{t('modal.confirm', 'Confirm')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal for Unhiding a Song to Stats */}
      {songToUnhideConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#141416] border border-white/10 p-6 flex flex-col gap-4 shadow-2xl relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-green-500/15 border border-green-500/20 flex items-center justify-center text-green-400 flex-shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">{t('account.unhideConfirmTitle', 'Restore Song to Stats?')}</h4>
                <p className="text-xs text-white/50 truncate max-w-[200px]">{songToUnhideConfirm.title}</p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              {t('account.unhideConfirmDesc', 'Restore this song back to your top listened tracks? Its minutes and play count will be added back to your total stats.')}
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSongToUnhideConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                {t('modal.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  unhideSongFromStats(songToUnhideConfirm.id);
                  showToast(t('account.songRestored', 'Song restored to listening stats'));
                  setSongToUnhideConfirm(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 active:scale-95 text-black font-black text-xs transition-all shadow-md shadow-green-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{t('account.unhide', 'Unhide')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Resetting Stats */}
      {isConfirmResetStatsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-[#141416] border border-white/10 p-6 flex flex-col gap-4 shadow-2xl relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">{t('account.resetStatsTitle', 'Reset Listening Stats?')}</h4>
                <p className="text-xs text-white/50">{t('account.resetStatsDesc', 'Start fresh from 0 minutes')}</p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              {t('account.resetStatsDesc', 'This will reset your minutes listened, track count, and top songs/artists to 0 and sync the clean state with the cloud server.')}
            </p>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-white/50">
              {t('account.resetStatsNote', 'Note: Your playlists, liked songs, and recently played tracks will NOT be deleted.')}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmResetStatsOpen(false)}
                disabled={isClearingStats}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('modal.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsClearingStats(true);
                  try {
                    await clearListeningStats();
                    showToast('Listening statistics reset to 0 and synced with cloud');
                    setIsConfirmResetStatsOpen(false);
                  } finally {
                    setIsClearingStats(false);
                  }
                }}
                disabled={isClearingStats}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white font-black text-xs transition-all shadow-md shadow-red-500/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isClearingStats ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>{isClearingStats ? t('account.clearing', 'Clearing...') : t('account.clearAndReset', 'Clear & Reset')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
