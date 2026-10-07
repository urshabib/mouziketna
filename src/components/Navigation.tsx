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
import { getAppLogoSrc } from '../services/pwa';
import { PlaylistCover } from './PlaylistCover';

export const Sidebar: React.FC = () => {
  const {
    activePane,
    setActivePane,
    openCollection,
    userProfile,
    globalUser,
    setModalCreatePlaylistOpen,
    setIsInstallModalOpen,
    t,
  } = useMusic();

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
          className="logo hover:opacity-90 transition-opacity text-left mb-6 flex items-center gap-2.5 cursor-pointer"
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
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activePane === 'home'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home className="w-5 h-5" /> {t('nav.home', 'Home')}
          </button>
          <button
            onClick={() => setActivePane('search')}
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activePane === 'search'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Search className="w-5 h-5" /> {t('nav.search', 'Search')}
          </button>
          <button
            onClick={() => setActivePane('settings')}
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activePane === 'settings'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-5 h-5" /> {t('nav.settings', 'Settings')}
          </button>

          <button
            id="sidebar-install-app-btn"
            onClick={() => setIsInstallModalOpen(true)}
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-bold text-sm text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all border border-[var(--accent)]/20 cursor-pointer"
          >
            <Download className="w-5 h-5 text-[var(--accent)]" /> {t('modal.installApp', 'Install App')}
          </button>

          {(globalUser === 'admin' || userProfile.isAdmin) && (
            <button
              onClick={() => setActivePane('admin')}
              className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                activePane === 'admin'
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-red-400/80 hover:text-red-400 hover:bg-red-500/10'
              }`}
            >
              <ShieldAlert className="w-5 h-5" /> {t('nav.admin', 'Admin')}
            </button>
          )}
        </nav>
      </div>

      {/* Library Shelf */}
      <div className="bg-[#121212] glass-panel rounded-2xl p-4 flex-1 flex flex-col min-h-0 border border-white/5">
        <div className="flex items-center justify-between pb-3 border-b border-white/5 px-1">
          <button
            onClick={() => setActivePane('library')}
            className="flex items-center gap-2 text-white/70 hover:text-white font-bold text-sm transition-colors cursor-pointer"
          >
            <Library className="w-4 h-4" /> {t('library.title', 'Your Library')}
          </button>
          <button
            onClick={() => setModalCreatePlaylistOpen(true)}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
            title={t('library.createPlaylist', 'Create Playlist')}
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
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--accent)] to-black/80 flex items-center justify-center flex-shrink-0 text-white shadow-md">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="text-sm font-semibold truncate text-white group-hover:text-[var(--accent)] transition-colors">
                {t('library.likedSongs', 'Liked Songs')}
              </h5>
              <p className="text-xs text-white/50 truncate">
                {t('common.playlist', 'Playlist')} • {likedCount} {t('common.tracks', 'tracks')}
              </p>
            </div>
          </div>

          {/* Downloaded Songs */}
          <div
            onClick={() => openCollection('downloads')}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#1c1c1e] flex items-center justify-center flex-shrink-0 text-[var(--accent)] shadow-md border border-white/5">
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="text-sm font-semibold truncate text-white group-hover:text-[var(--accent)] transition-colors">
                {t('library.downloads', 'Downloaded')}
              </h5>
              <p className="text-xs text-white/50 truncate">{t('common.offline', 'Offline music')}</p>
            </div>
          </div>

          {/* Custom Playlists */}
          {customPlaylists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => openCollection('custom-playlist', pl.id, pl.name, pl.thumb)}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors"
            >
              <PlaylistCover
                cover={pl.thumb}
                tracks={pl.tracks}
                sizeClass="w-10 h-10"
                roundedClass="rounded-lg"
                alt={pl.name}
                className="flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h5 className="text-sm font-semibold truncate text-white group-hover:text-[var(--accent)] transition-colors">
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
                <h5 className="text-sm font-semibold truncate text-white group-hover:text-[var(--accent)] transition-colors">
                  {artist.title}
                </h5>
                <p className="text-xs text-white/50 truncate">Artist</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export const MobileNav: React.FC = () => {
  const { activePane, setActivePane, t } = useMusic();

  const navItems: { id: NavigationPane; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: t('nav.home', 'Home'), icon: <Home className="w-5 h-5" /> },
    { id: 'search', label: t('nav.search', 'Search'), icon: <Search className="w-5 h-5" /> },
    { id: 'library', label: t('nav.library', 'Library'), icon: <Library className="w-5 h-5" /> },
    { id: 'settings', label: t('nav.settings', 'Settings'), icon: <Settings className="w-5 h-5" /> },
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
              isActive ? 'text-[var(--accent)] scale-105' : 'text-white/50 hover:text-white/80'
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
    setIsInstallModalOpen,
    t,
  } = useMusic();

  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const check =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(check);
  }, []);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('home.goodMorning', 'Good morning');
    if (h < 18) return t('home.goodAfternoon', 'Good afternoon');
    return t('home.goodEvening', 'Good evening');
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3.5 bg-black/60 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center gap-3.5">
        <button
          onClick={() => setActivePane('home')}
          className="logo hover:opacity-90 transition-opacity text-left flex items-center gap-2.5 cursor-pointer"
        >
          <i className="ri-pulse-fill"></i>
          <span className="logo-textblock">
            MOUZIKETNA
            <span className="logo-signature">by habib</span>
          </span>
        </button>

        <span className="hidden sm:inline text-white/20">|</span>

        <h2 className="hidden md:block font-semibold text-sm text-white/70 max-w-[180px] lg:max-w-[280px] truncate overflow-hidden whitespace-nowrap text-ellipsis">
          {getGreeting()}{userProfile.username ? `, ${userProfile.username}` : ''}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Install App Button */}
        {!isStandalone && (
          <button
            id="topbar-install-btn"
            onClick={() => setIsInstallModalOpen(true)}
            className="flex items-center justify-center gap-1.5 bg-[var(--accent)] hover:brightness-110 active:scale-95 text-black p-2 sm:px-3.5 sm:py-1.5 rounded-full font-black text-xs transition-all shadow-md shadow-[var(--accent)]/25 flex-shrink-0 cursor-pointer"
            title={t('modal.installApp', 'Install App')}
            aria-label={t('modal.installApp', 'Install App')}
          >
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{t('modal.installApp', 'Install App')}</span>
          </button>
        )}

        {/* Bulk Download Indicator */}
        {bulkDownloadState.inProgress && (
          <button
            onClick={() => openCollection('downloads')}
            className="flex items-center gap-2 bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold px-3 py-1.5 rounded-full border border-[var(--accent)]/30 animate-pulse"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{bulkDownloadState.done}/{bulkDownloadState.total}</span>
          </button>
        )}

        {/* Profile Chip */}
        <button
          onClick={() => setActivePane('account')}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-2.5 sm:px-3 py-1.5 rounded-full border border-white/10 transition-colors max-w-[120px] sm:max-w-[170px] cursor-pointer"
          title="View Listening Statistics & Profile"
        >
          {userProfile.avatarUrl ? (
            <img
              src={userProfile.avatarUrl}
              alt="Avatar"
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-black font-bold text-xs flex items-center justify-center flex-shrink-0">
              {userProfile.username ? userProfile.username.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
            </div>
          )}
          <span className="text-xs font-bold text-white truncate overflow-hidden whitespace-nowrap text-ellipsis">
            {userProfile.username || t('nav.account', 'Profile')}
          </span>
        </button>
      </div>
    </header>
  );
};
