import React, { useEffect } from 'react';
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
import { motion, AnimatePresence } from 'motion/react';

const AppShell: React.FC = () => {
  const {
    activePane,
    setActivePane,
    userProfile,
    toasts,
    isInstallModalOpen,
    setIsInstallModalOpen,
    isFullScreenOpen,
    setIsFullScreenOpen,
    isLyricsOpen,
    setIsLyricsOpen,
    isQueueOpen,
    setIsQueueOpen,
    actionSheetTrack,
    setActionSheetTrack,
    goBack,
  } = useMusic();

  const themeClass = userProfile.theme === 'light' ? 'light-mode' : '';
  const glassClass = userProfile.liquidGlass ? 'liquid-glass' : '';
  const tintClass =
    userProfile.presetTint && userProfile.presetTint !== 'none'
      ? `tint-${userProfile.presetTint}`
      : '';

  // Universal Hardware Back / Popstate History Sync
  useEffect(() => {
    // Whenever an overlay opens or activePane changes, push history state
    const isAnyOverlayOpen =
      isFullScreenOpen ||
      isLyricsOpen ||
      isQueueOpen ||
      !!actionSheetTrack ||
      isInstallModalOpen;

    const stateObj = {
      pane: activePane,
      hasOverlay: isAnyOverlayOpen,
      time: Date.now(),
    };

    window.history.pushState(stateObj, '');

    const handlePopState = () => {
      if (isInstallModalOpen) {
        setIsInstallModalOpen(false);
        return;
      }
      if (actionSheetTrack) {
        setActionSheetTrack(null);
        return;
      }
      if (isLyricsOpen) {
        setIsLyricsOpen(false);
        return;
      }
      if (isQueueOpen) {
        setIsQueueOpen(false);
        return;
      }
      if (isFullScreenOpen) {
        setIsFullScreenOpen(false);
        return;
      }
      if (activePane !== 'home') {
        goBack();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [
    activePane,
    isFullScreenOpen,
    isLyricsOpen,
    isQueueOpen,
    actionSheetTrack,
    isInstallModalOpen,
    goBack,
    setIsFullScreenOpen,
    setIsLyricsOpen,
    setIsQueueOpen,
    setActionSheetTrack,
    setIsInstallModalOpen,
  ]);

  // Universal Touch Edge-Swipe Back Gesture for iOS & Android
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isEdgeSwipe = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;

      // Check if gesture started near screen edges (iOS/Android gesture boundary)
      const screenWidth = window.innerWidth;
      const isLeftEdge = startX <= 45;
      const isRightEdge = startX >= screenWidth - 45;
      const isOverlayActive =
        isFullScreenOpen || isLyricsOpen || isQueueOpen || !!actionSheetTrack || isInstallModalOpen;

      isEdgeSwipe = isLeftEdge || isRightEdge || (isOverlayActive && startX <= screenWidth * 0.3);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isEdgeSwipe || e.changedTouches.length !== 1) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      // Minimum swipe distance and horizontal direction dominance
      const isHorizontalSwipe = Math.abs(deltaX) > 55 && Math.abs(deltaX) > 1.6 * Math.abs(deltaY);

      if (isHorizontalSwipe) {
        // Left-to-right swipe (standard back gesture)
        if (deltaX > 0) {
          if (isInstallModalOpen) setIsInstallModalOpen(false);
          else if (actionSheetTrack) setActionSheetTrack(null);
          else if (isLyricsOpen) setIsLyricsOpen(false);
          else if (isQueueOpen) setIsQueueOpen(false);
          else if (isFullScreenOpen) setIsFullScreenOpen(false);
          else if (activePane !== 'home') goBack();
        }
        // Right-to-left swipe from right edge (Android right-edge back gesture)
        else if (startX >= window.innerWidth - 45 && deltaX < -55) {
          if (isInstallModalOpen) setIsInstallModalOpen(false);
          else if (actionSheetTrack) setActionSheetTrack(null);
          else if (isLyricsOpen) setIsLyricsOpen(false);
          else if (isQueueOpen) setIsQueueOpen(false);
          else if (isFullScreenOpen) setIsFullScreenOpen(false);
          else if (activePane !== 'home') goBack();
        }
      }
      isEdgeSwipe = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [
    activePane,
    isFullScreenOpen,
    isLyricsOpen,
    isQueueOpen,
    actionSheetTrack,
    isInstallModalOpen,
    goBack,
    setIsFullScreenOpen,
    setIsLyricsOpen,
    setIsQueueOpen,
    setActionSheetTrack,
    setIsInstallModalOpen,
  ]);

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
          <AnimatePresence mode="wait">
            <motion.div
              key={activePane}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="w-full h-full"
            >
              {activePane === 'home' && <HomeView />}
              {activePane === 'search' && <SearchView />}
              {activePane === 'library' && <LibraryView />}
              {activePane === 'collection' && <CollectionView />}
              {activePane === 'settings' && <SettingsView />}
              {activePane === 'account' && <AccountView />}
              {activePane === 'admin' && <AdminView />}
            </motion.div>
          </AnimatePresence>
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
