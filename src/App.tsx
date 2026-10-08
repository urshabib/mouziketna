import React, { useEffect } from 'react';
import { MusicProvider, useMusic } from './context/MusicContext';
import { Sidebar, MobileNav, TopBar } from './components/Navigation';
import { PlayerBar, MiniPlayer } from './components/PlayerBar';
import { FullScreenPlayer } from './components/FullScreenPlayer';
import { LandscapeStagePlayer } from './components/LandscapeStagePlayer';
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
import { OfflineView } from './views/OfflineView';
import { motion, AnimatePresence } from 'motion/react';
import { checkForAppUpdates, forceAppUpdateAndRefresh } from './services/pwa';

const AppShell: React.FC = () => {
  const {
    activePane,
    setActivePane,
    userProfile,
    toasts,
    showToast,
    isInstallModalOpen,
    setIsInstallModalOpen,
    isFullScreenOpen,
    setIsFullScreenOpen,
    isLandscapeStageOpen,
    setIsLandscapeStageOpen,
    isLyricsOpen,
    setIsLyricsOpen,
    isQueueOpen,
    setIsQueueOpen,
    actionSheetTrack,
    setActionSheetTrack,
    goBack,
    activeTrack,
    isMiniPlayerDismissed,
  } = useMusic();

  const hasActiveMiniPlayer = !!activeTrack && !isMiniPlayerDismissed;

  const isUltraGlass = userProfile.liquidGlassLevel === 'ultra';
  const isMediumGlass = userProfile.liquidGlass && !isUltraGlass && userProfile.liquidGlassLevel !== 'off';
  const glassClass = isUltraGlass
    ? 'liquid-glass-ultra'
    : isMediumGlass
    ? 'liquid-glass'
    : '';
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
      if (isLandscapeStageOpen) {
        setIsLandscapeStageOpen(false);
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
    isLandscapeStageOpen,
    isLyricsOpen,
    isQueueOpen,
    actionSheetTrack,
    isInstallModalOpen,
    goBack,
    setIsFullScreenOpen,
    setIsLandscapeStageOpen,
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
        isLandscapeStageOpen || isFullScreenOpen || isLyricsOpen || isQueueOpen || !!actionSheetTrack || isInstallModalOpen;

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
          else if (isLandscapeStageOpen) setIsLandscapeStageOpen(false);
          else if (actionSheetTrack) setActionSheetTrack(null);
          else if (isLyricsOpen) setIsLyricsOpen(false);
          else if (isQueueOpen) setIsQueueOpen(false);
          else if (isFullScreenOpen) setIsFullScreenOpen(false);
          else if (activePane !== 'home') goBack();
        }
        // Right-to-left swipe from right edge (Android right-edge back gesture)
        else if (startX >= window.innerWidth - 45 && deltaX < -55) {
          if (isInstallModalOpen) setIsInstallModalOpen(false);
          else if (isLandscapeStageOpen) setIsLandscapeStageOpen(false);
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
    isLandscapeStageOpen,
    isLyricsOpen,
    isQueueOpen,
    actionSheetTrack,
    isInstallModalOpen,
    goBack,
    setIsFullScreenOpen,
    setIsLandscapeStageOpen,
    setIsLyricsOpen,
    setIsQueueOpen,
    setActionSheetTrack,
    setIsInstallModalOpen,
  ]);

  // Automatic Multi-Tier Update Detector with Single-Shot Loop Guard
  useEffect(() => {
    // 1. If we just completed an update reload, display confirmation and STOP!
    const justUpdated = sessionStorage.getItem('mouzika_just_updated');
    if (justUpdated) {
      sessionStorage.removeItem('mouzika_just_updated');
      showToast('✓ App updated to latest version!', true);
      try {
        const cleanUrl = new URL(window.location.href);
        if (cleanUrl.searchParams.has('_v') || cleanUrl.searchParams.has('_bust')) {
          cleanUrl.searchParams.delete('_v');
          cleanUrl.searchParams.delete('_bust');
          window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
        }
      } catch {}
      return; // Do not run any automatic checks on this session mount
    }

    let isUpdating = false;

    const triggerRefresh = async (msg = '⚡ New update found! Refreshing app...', targetSha?: string) => {
      if (isUpdating) return;
      isUpdating = true;
      showToast(msg, true);
      setTimeout(async () => {
        await forceAppUpdateAndRefresh(targetSha);
      }, 1000);
    };

    const runUpdateCheck = async () => {
      if (isUpdating) return;
      await checkForAppUpdates({
        onUpdateFound: (result) => {
          const detail = result.latestVersion ? ` (${result.latestVersion})` : '';
          triggerRefresh(`⚡ Update detected${detail}! Applying latest version...`, result.latestSha);
        },
      });
    };

    // 2. Run background check after a gentle 20s delay so user can use the app without disruption
    const initialTimer = setTimeout(() => {
      runUpdateCheck();
    }, 20000);

    // 3. Periodic check every 10 minutes
    const interval = setInterval(() => {
      runUpdateCheck();
    }, 10 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [showToast]);

  // Auto-switch to Offline View when connection drops & auto-restore when Wi-Fi returns
  const lastOnlinePaneRef = React.useRef<any>('home');
  const activePaneRef = React.useRef<any>(activePane);

  useEffect(() => {
    activePaneRef.current = activePane;
    if (activePane !== 'offline') {
      lastOnlinePaneRef.current = activePane;
    }
    const mainEl = document.getElementById('main-scroll-container');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activePane]);

  // Initial check on app launch if started without network connection
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (activePaneRef.current !== 'offline' && activePaneRef.current !== 'collection') {
        lastOnlinePaneRef.current = activePaneRef.current || 'home';
        setActivePane('offline');
      }
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      showToast('Back Online • Restoring cloud connection', true);
      // Auto-restore previous online pane if currently stuck on offline landing view
      if (activePaneRef.current === 'offline') {
        const restorePane =
          lastOnlinePaneRef.current && lastOnlinePaneRef.current !== 'offline'
            ? lastOnlinePaneRef.current
            : 'home';
        setActivePane(restorePane);
      }
    };

    const handleOffline = () => {
      if (activePaneRef.current !== 'offline') {
        lastOnlinePaneRef.current = activePaneRef.current;
      }
      showToast('Offline Mode Active • Playing downloaded music', true);
      // Only redirect to offline hub if on online-only tabs (home, search, admin)
      // Allow user to remain in collection view (playlists/downloads/liked) or settings
      if (activePaneRef.current === 'home' || activePaneRef.current === 'search' || activePaneRef.current === 'admin') {
        setActivePane('offline');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setActivePane, showToast]);

  // Handle widget launcher query parameter (?widget=nowplaying or ?widget=topsongs)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pane = params.get('pane');
      if (pane && ['home', 'search', 'library', 'account', 'settings', 'admin', 'offline'].includes(pane)) {
        setActivePane(pane as any);
      }
    } catch {}
  }, [setActivePane]);

  return (
    <div
      className={`relative flex h-screen w-screen overflow-hidden text-[#f5f5f7] font-['Plus_Jakarta_Sans',sans-serif] ${
        isUltraGlass ? 'bg-black/30' : isMediumGlass ? 'bg-[#0a0a0d]/60' : 'bg-[#0c0906]'
      } ${glassClass} ${tintClass}`}
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
          className={`flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-6 transition-all duration-200 ${
            hasActiveMiniPlayer ? 'pb-56 md:pb-32' : 'pb-28 md:pb-24'
          }`}
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
              {activePane === 'offline' && <OfflineView />}
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
      <LandscapeStagePlayer />
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

      {/* Toast Notification Container (Suppressed in full screen stage mode so it never gets in the way) */}
      {!isLandscapeStageOpen && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-none px-4 py-2 rounded-full text-xs font-semibold shadow-2xl flex items-center justify-center text-center transition-all animate-in fade-in slide-in-from-top-4 duration-200 ${
                toast.isGray
                  ? 'bg-neutral-900/90 text-white backdrop-blur-xl border border-white/10'
                  : 'bg-[var(--accent)] text-black font-bold'
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
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
