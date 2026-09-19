import React, { useState, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  Home,
  Search,
  Library,
  Settings,
  ShieldAlert,
  Plus,
  Heart,
  Download,
  Music,
  User,
  Loader2,
  Smartphone,
} from 'lucide-react';
import { NavigationPane } from '../types';
import { InstallModal } from './InstallModal';

export const Sidebar: React.FC = () => {
  const {
    activePane,
    setActivePane,
    openCollection,
    userProfile,
    globalUser,
    setModalCreatePlaylistOpen,
  } = useMusic();

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const check =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(check);
  }, []);

  const likedCount = userProfile.likedSongs?.length || 0;
  const customPlaylists = userProfile.customPlaylists || [];
  const followedArtists = userProfile.favouriteArtists || [];

  return (
    <aside className="hidden md:flex w-64 flex-col gap-2 p-3 flex-shrink-0 select-none">
      {/* Brand & Nav */}
      <div className="bg-[#121212] glass-panel rounded-2xl p-5 border border-white/5">
        <button
          onClick={() => setActivePane('home')}
          className="logo hover:opacity-90 transition-opacity text-left mb-6"
        >
          <i className="ri-pulse-fill"></i>
          <span className="logo-textblock">
            MOUZIKETNA
            <span className="logo-signature">by habib</span>
          </span>
        </button>

        <nav className="flex flex-col gap-1">
          <button
            onClick={() => setActivePane('home')}
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activePane === 'home'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home className="w-5 h-5" /> Home
          </button>
          <button
            onClick={() => setActivePane('search')}
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activePane === 'search'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Search className="w-5 h-5" /> Search
          </button>
          <button
            onClick={() => setActivePane('settings')}
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activePane === 'settings'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-5 h-5" /> Settings
          </button>

          <button
            id="sidebar-install-app-btn"
            onClick={() => setShowInstallModal(true)}
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-bold text-sm text-[#ff6b1a] hover:bg-[#ff6b1a]/10 transition-all border border-[#ff6b1a]/20"
          >
            <Smartphone className="w-5 h-5 text-[#ff6b1a]" /> Install App
          </button>

          {globalUser === 'admin' && (
            <button
              onClick={() => setActivePane('admin')}
              className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activePane === 'admin'
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-red-400/80 hover:text-red-400 hover:bg-red-500/10'
              }`}
            >
              <ShieldAlert className="w-5 h-5" /> Admin
            </button>
          )}
        </nav>
      </div>

      {/* Library Shelf */}
      <div className="bg-[#121212] glass-panel rounded-2xl p-4 flex-1 flex flex-col min-h-0 border border-white/5">
        <div className="flex items-center justify-between pb-3 border-b border-white/5 px-1">
          <button
            onClick={() => setActivePane('library')}
            className="flex items-center gap-2 text-white/70 hover:text-white font-bold text-sm transition-colors"
          >
            <Library className="w-4 h-4" /> Your Library
          </button>
          <button
            onClick={() => setModalCreatePlaylistOpen(true)}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all"
            title="Create Playlist"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 mt-2 pr-1">
          {/* Liked Songs */}
          <div
            onClick={() => openCollection('liked')}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff6b1a] to-[#7a2c00] flex items-center justify-center flex-shrink-0 text-white shadow-md">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="text-sm font-semibold truncate text-white group-hover:text-[#ff6b1a] transition-colors">
                Liked Songs
              </h5>
              <p className="text-xs text-white/50 truncate">Playlist • {likedCount} tracks</p>
            </div>
          </div>

          {/* Downloaded Songs */}
          <div
            onClick={() => openCollection('downloads')}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#1c1c1e] flex items-center justify-center flex-shrink-0 text-[#ff6b1a] shadow-md border border-white/5">
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="text-sm font-semibold truncate text-white group-hover:text-[#ff6b1a] transition-colors">
                Downloaded
              </h5>
              <p className="text-xs text-white/50 truncate">Offline music</p>
            </div>
          </div>

          {/* Custom Playlists */}
          {customPlaylists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => openCollection('custom-playlist', pl.id, pl.name, pl.thumb)}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors"
            >
              {pl.thumb ? (
                <img src={pl.thumb} alt={pl.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#242426] flex items-center justify-center flex-shrink-0 text-white/40">
                  <Music className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h5 className="text-sm font-semibold truncate text-white group-hover:text-[#ff6b1a] transition-colors">
                  {pl.name}
                </h5>
                <p className="text-xs text-white/50 truncate">
                  Playlist • {pl.tracks?.length || 0} tracks
                </p>
              </div>
            </div>
          ))}

          {/* Followed Artists */}
          {followedArtists.map((artist) => (
            <div
              key={artist.id}
              onClick={() => openCollection('artist', artist.id, artist.title, artist.thumb)}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors"
            >
              {artist.thumb ? (
                <img src={artist.thumb} alt={artist.title} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#242426] flex items-center justify-center flex-shrink-0 text-white/40">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h5 className="text-sm font-semibold truncate text-white group-hover:text-[#ff6b1a] transition-colors">
                  {artist.title}
                </h5>
                <p className="text-xs text-white/50 truncate">Artist</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showInstallModal && (
        <InstallModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
        />
      )}
    </aside>
  );
};

export const MobileNav: React.FC = () => {
  const { activePane, setActivePane } = useMusic();

  const navItems: { id: NavigationPane; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'search', label: 'Search', icon: <Search className="w-5 h-5" /> },
    { id: 'library', label: 'Library', icon: <Library className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-t border-white/10 px-6 py-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex justify-between items-center select-none">
      {navItems.map((item) => {
        const isActive = activePane === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActivePane(item.id)}
            className={`flex flex-col items-center gap-1 transition-all ${
              isActive ? 'text-[#ff6b1a] scale-105' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export const TopBar: React.FC = () => {
  const {
    userProfile,
    globalUser,
    setActivePane,
    bulkDownloadState,
    openCollection,
    setIsAuthGateOpen,
  } = useMusic();

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const check =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(check);
  }, []);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-black/60 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center gap-3.5">
        <button
          onClick={() => setActivePane('home')}
          className="logo hover:opacity-90 transition-opacity text-left"
        >
          <i className="ri-pulse-fill"></i>
          <span className="logo-textblock">
            MOUZIKETNA
            <span className="logo-signature">by habib</span>
          </span>
        </button>

        <span className="hidden sm:inline text-white/20">|</span>

        <h2 className="hidden md:block font-semibold text-sm text-white/70">
          {getGreeting()}{userProfile.username ? `, ${userProfile.username}` : ''}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Install App Button */}
        {!isStandalone && (
          <button
            id="topbar-install-btn"
            onClick={() => setShowInstallModal(true)}
            className="flex items-center gap-1.5 bg-[#ff6b1a]/20 hover:bg-[#ff6b1a]/30 active:scale-95 text-[#ff6b1a] px-3 py-1.5 rounded-full border border-[#ff6b1a]/40 font-bold text-xs transition-all shadow-sm"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Install</span> App
          </button>
        )}

        {/* Bulk Download Indicator */}
        {bulkDownloadState.inProgress && (
          <button
            onClick={() => openCollection('downloads')}
            className="flex items-center gap-2 bg-[#ff6b1a]/20 text-[#ff6b1a] text-xs font-bold px-3 py-1.5 rounded-full border border-[#ff6b1a]/30 animate-pulse"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{bulkDownloadState.done}/{bulkDownloadState.total}</span>
          </button>
        )}

        {/* Profile Chip */}
        <button
          onClick={() => {
            if (globalUser) setActivePane('account');
            else setIsAuthGateOpen(true);
          }}
          className="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-full border border-white/10 transition-colors"
        >
          {userProfile.avatarUrl ? (
            <img
              src={userProfile.avatarUrl}
              alt="Avatar"
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[#ff6b1a] text-black font-bold text-xs flex items-center justify-center">
              {userProfile.username ? userProfile.username.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
            </div>
          )}
          <span className="text-xs font-bold text-white max-w-[100px] truncate">
            {userProfile.username || 'Sign In'}
          </span>
        </button>
      </div>

      {showInstallModal && (
        <InstallModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
        />
      )}
    </header>
  );
};
