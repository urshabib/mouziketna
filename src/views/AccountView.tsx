import React, { useRef } from 'react';
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
} from 'lucide-react';

export const AccountView: React.FC = () => {
  const {
    globalUser,
    userProfile,
    syncProfile,
    setActivePane,
    openCollection,
    logout,
    setIsAuthGateOpen,
    showToast,
    downloadedSet,
  } = useMusic();

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

  return (
    <div className="flex flex-col gap-8 max-w-2xl pb-24 select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* User Hero */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 rounded-3xl bg-white/[0.03] glass-panel border border-white/5">
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-[#ff6b1a] to-[#7a2c00] flex items-center justify-center text-white text-3xl font-black shadow-xl">
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
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
            <Camera className="w-6 h-6" />
          </div>
        </div>

        <div className="flex flex-col items-center sm:items-start gap-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-white">{username}</h2>
            {isAdmin && (
              <span className="px-2 py-0.5 rounded-full bg-[#ff6b1a]/20 text-[#ff6b1a] border border-[#ff6b1a]/30 text-[10px] font-extrabold uppercase">
                Admin
              </span>
            )}
          </div>
          <p className="text-xs text-white/50 font-medium">
            {globalUser ? 'Signed in & synced' : 'Using guest offline mode'}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {globalUser ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs transition-colors border border-white/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthGateOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff6b1a] text-black font-extrabold text-xs transition-transform hover:scale-105 active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setActivePane('admin')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs transition-colors border border-white/10"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-[#ff6b1a]" />
                <span>Admin Console</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
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

      {/* Quick Links */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setActivePane('settings')}
          className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-colors text-left"
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
