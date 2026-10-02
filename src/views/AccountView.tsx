import React, { useRef, useState } from 'react';
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
} from 'lucide-react';
import { TrackThumbImage } from '../services/useTrackThumb';
import { Track } from '../types';

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
  } = useMusic();

  const [activeTab, setActiveTab] = useState<'songs' | 'artists' | 'overview'>('songs');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const username = globalUser || userProfile.username || 'Guest';
  const isAdmin = userProfile.isAdmin || globalUser === 'habib' || false;

  const stats = userProfile.stats || {
    totalMinutesListened: 0,
    totalTracksPlayed: 0,
    topSongs: [],
    topArtists: [],
  };

  const formatHoursAndMinutes = (totalMins: number) => {
    if (!totalMins || totalMins <= 0) return '0 mins';
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours === 0) return `${mins} mins`;
    if (mins === 0) return `${hours} hrs`;
    return `${hours}h ${mins}m`;
  };

  const topSongs = stats.topSongs || [];
  const topArtists = stats.topArtists || [];
  const topSong = topSongs[0];
  const topArtist = topArtists[0];

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
            {globalUser ? 'Profile & Statistics synced to Cloud Server' : 'Using guest offline mode'}
          </p>

          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center sm:justify-start">
            {globalUser ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs transition-colors border border-white/10 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthGateOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff6b1a] text-black font-black text-xs transition-transform hover:scale-105 active:scale-95 shadow-md shadow-[#ff6b1a]/25 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Sync</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setActivePane('admin')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs transition-colors border border-white/10 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-[#ff6b1a]" />
                <span>Admin Console</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spicetify / Spotify-Style Listening Statistics Hero Tiles */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#ff6b1a]" />
            <h3 className="text-lg font-black text-white">Listening Statistics</h3>
          </div>
          <span className="text-[11px] font-bold text-white/40">Cloud Server Synchronized</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Total Hours Listened */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-1 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <Clock className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                Time
              </span>
            </div>
            <span className="text-2xl sm:text-3xl font-black text-white mt-1.5 tracking-tight">
              {formatHoursAndMinutes(stats.totalMinutesListened || 0)}
            </span>
            <span className="text-xs text-white/50 font-semibold">Total Listened</span>
          </div>

          {/* Total Tracks Played */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-1 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <Flame className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                Plays
              </span>
            </div>
            <span className="text-2xl sm:text-3xl font-black text-white mt-1.5 tracking-tight">
              {stats.totalTracksPlayed || 0}
            </span>
            <span className="text-xs text-white/50 font-semibold">Songs Played</span>
          </div>

          {/* Top Song */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-1 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <Award className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                #1 Track
              </span>
            </div>
            <span className="text-sm font-black text-white mt-2 truncate">
              {topSong?.title || 'No plays yet'}
            </span>
            <span className="text-xs text-white/50 font-semibold truncate">
              {topSong ? `${topSong.playCount || 1} plays` : 'Start listening'}
            </span>
          </div>

          {/* Top Artist */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-1 shadow-lg relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <Sparkles className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                #1 Artist
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

      {/* Tabs Filter (Top Songs | Top Artists | Library Overview) */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('songs')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'songs'
                ? 'bg-[#ff6b1a] text-black shadow-md shadow-[#ff6b1a]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            Top Listened Songs ({topSongs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('artists')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'artists'
                ? 'bg-[#ff6b1a] text-black shadow-md shadow-[#ff6b1a]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            Top Artists ({topArtists.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#ff6b1a] text-black shadow-md shadow-[#ff6b1a]/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            Collections
          </button>
        </div>

        {/* Tab 1: Top Listened Songs Ranked List */}
        {activeTab === 'songs' && (
          <div className="flex flex-col gap-2">
            {topSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 rounded-3xl bg-white/[0.02] border border-white/5 text-center gap-3">
                <Disc className="w-10 h-10 text-white/20" />
                <p className="text-sm font-bold text-white/60">No track statistics recorded yet.</p>
                <p className="text-xs text-white/40 max-w-sm">
                  Play songs in the app to automatically build your listening statistics dashboard!
                </p>
              </div>
            ) : (
              topSongs.map((song, idx) => {
                const rank = idx + 1;
                const isTop3 = rank <= 3;
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
                    onClick={() => playTrack(trackObj)}
                    className="flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all cursor-pointer group"
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
                        {song.playCount || 1} {song.playCount === 1 ? 'play' : 'plays'}
                      </span>
                      <span className="text-[11px] font-semibold text-white/40">
                        {formatHoursAndMinutes(song.minutesListened || 1)}
                      </span>
                    </div>

                    {/* Like Action */}
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
              topArtists.map((artist, idx) => (
                <div
                  key={artist.name}
                  onClick={() => openCollection('artist', artist.name, artist.name, artist.thumb)}
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
                      {formatHoursAndMinutes(artist.minutesListened || 1)} listened
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
              <span className="text-xs text-white/40 font-semibold">Liked Songs</span>
            </div>

            <div
              onClick={() => setActivePane('library')}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <Music2 className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-2xl font-black text-white mt-2">
                {userProfile.customPlaylists?.length || 0}
              </span>
              <span className="text-xs text-white/40 font-semibold">Playlists</span>
            </div>

            <div
              onClick={() => setActivePane('library')}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <User className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-2xl font-black text-white mt-2">
                {userProfile.favouriteArtists?.length || 0}
              </span>
              <span className="text-xs text-white/40 font-semibold">Favorite Artists</span>
            </div>

            <div
              onClick={() => openCollection('downloads')}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <Download className="w-5 h-5 text-[#ff6b1a]" />
              <span className="text-2xl font-black text-white mt-2">{downloadedSet.size}</span>
              <span className="text-xs text-white/40 font-semibold">Downloads</span>
            </div>
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
            <span className="text-sm font-bold text-white">Audio & App Settings</span>
          </div>
          <span className="text-xs text-white/40 font-semibold">Open</span>
        </button>
      </div>
    </div>
  );
};
