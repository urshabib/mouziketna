import React from 'react';
import { MusicProvider, useMusic } from './context/MusicContext';
import { Sidebar, MobileNav, TopBar } from './components/Navigation';
import { PlayerBar, MiniPlayer } from './components/PlayerBar';
import { FullScreenPlayer } from './components/FullScreenPlayer';
import { LyricsSheet } from './components/LyricsSheet';
import { QueueDrawer } from './components/QueueDrawer';
import { ActionSheet } from './components/ActionSheet';
import { Modals } from './components/Modals';
import { InstallModal } from './components/InstallModal';
import { HomeView } from './views/HomeView';
import { SearchView } from './views/SearchView';
import { LibraryView } from './views/LibraryView';
import { CollectionView } from './views/CollectionView';
import { SettingsView } from './views/SettingsView';
import { AccountView } from './views/AccountView';
import { AdminView } from './views/AdminView';

const AppShell: React.FC = () => {
  const { activePane, userProfile, toasts, isInstallModalOpen, setIsInstallModalOpen } = useMusic();

  const themeClass = userProfile.theme === 'light' ? 'light-mode' : '';
  const glassClass = userProfile.liquidGlass ? 'liquid-glass' : '';
  const tintClass = userProfile.presetTint && userProfile.presetTint !== 'none'
    ? `tint-${userProfile.presetTint}`
    : '';

  return (
    <div
      className={`relative flex h-screen w-screen overflow-hidden bg-[#0d0905] text-[#f5f5f7] font-['Plus_Jakarta_Sans',sans-serif] ${themeClass} ${glassClass} ${tintClass}`}
    >
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Bar Header */}
        <TopBar />

        {/* Scrollable View Content */}
        <main
          id="main-scroll-container"
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-6 pb-36 md:pb-28"
        >
          {activePane === 'home' && <HomeView />}
          {activePane === 'search' && <SearchView />}
          {activePane === 'library' && <LibraryView />}
          {activePane === 'collection' && <CollectionView />}
          {activePane === 'settings' && <SettingsView />}
          {activePane === 'account' && <AccountView />}
          {activePane === 'admin' && <AdminView />}
        </main>

        {/* Desktop Fixed Bottom Player Dock */}
        <PlayerBar />

        {/* Mobile Floating Mini Player */}
        <MiniPlayer />

        {/* Mobile Fixed Bottom Navigation Bar */}
        <MobileNav />
      </div>

      {/* Fullscreen Overlays & Sheets */}
      <FullScreenPlayer />
      <LyricsSheet />
      <QueueDrawer />
      <ActionSheet />
      <Modals />
      {isInstallModalOpen && (
        <InstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
        />
      )}

      {/* Toast Notification Container */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-full text-xs font-bold shadow-2xl flex items-center justify-center text-center transition-all animate-in fade-in slide-in-from-top-4 duration-200 ${
              toast.isGray
                ? 'bg-white/10 text-white backdrop-blur-xl border border-white/10'
                : 'bg-[#ff6b1a] text-black'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <MusicProvider>
      <AppShell />
    </MusicProvider>
  );
}
