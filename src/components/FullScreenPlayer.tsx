import React, { useState, useRef, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Repeat,
  Repeat1,
  Shuffle,
  Heart,
  FileText,
  ListMusic,
  Moon,
  Plus,
  Loader2,
  Maximize2,
  Disc,
  SlidersHorizontal,
  RotateCcw as ResetIcon,
  Sparkles,
  Zap,
  Waves,
  Mic,
} from 'lucide-react';
import { FALLBACK_ART } from '../services/api';
import { useTrackThumb } from '../services/useTrackThumb';
import { getSongHighlights } from '../services/songHighlights';
import { TrackProgressBar } from './TrackProgressBar';
import { motion, AnimatePresence } from 'motion/react';
import { NvsVisualizer } from './NvsVisualizer';
import {
  setBassBoostMode,
  setVolumeBoostPercent,
  resetBoostSettings,
  toggleVocalClarity,
  subscribeAudioEnhancer,
  getAudioBoosterState,
  BassBoostMode,
} from '../services/audioEnhancer';

export type PlayerViewMode = 'square' | 'cd' | 'spectrum' | 'waveform';

export const FullScreenPlayer: React.FC = () => {
  const {
    activeTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    isLooping,
    isShuffle,
    togglePlay,
    seekTo,
    seekBy,
    toggleLoop,
    toggleShuffle,
    playNext,
    playPrevious,
    toggleLikeTrack,
    userProfile,
    isFullScreenOpen,
    setIsFullScreenOpen,
    setIsLandscapeStageOpen,
    setIsLyricsOpen,
    setIsQueueOpen,
    setModalAddToPlaylistTrack,
    currentLyrics,
    sleepTimerRemaining,
    setSleepTimerMinutes,
    setSleepTimerEndOfSong,
    cancelSleepTimer,
    t,
  } = useMusic();

  const thumbSrc = useTrackThumb(activeTrack);
  const [isSleepMenuOpen, setIsSleepMenuOpen] = useState(false);
  const [isBoosterMenuOpen, setIsBoosterMenuOpen] = useState(false);

  const handleToggleBooster = () => {
    setIsBoosterMenuOpen((prev) => !prev);
    setIsSleepMenuOpen(false);
  };

  // Audio Booster Settings state
  const [boosterSettings, setBoosterSettings] = useState(() => getAudioBoosterState());

  useEffect(() => {
    return subscribeAudioEnhancer((settings) => {
      setBoosterSettings(settings);
    });
  }, []);

  // View modes: 'square' | 'cd' | 'visualizer'
  const [viewMode, setViewMode] = useState<PlayerViewMode>(() => {
    try {
      const saved = localStorage.getItem('mouzika_player_view_mode') as PlayerViewMode;
      if (saved === 'square' || saved === 'cd' || saved === 'spectrum' || saved === 'waveform') {
        return saved;
      }
      if ((saved as any) === 'visualizer') return 'spectrum';
      // Migrate from old CD setting
      if (localStorage.getItem('mouzika_player_cd_view') === 'true') {
        return 'cd';
      }
    } catch {}
    return 'square';
  });

  const cycleViewMode = () => {
    setViewMode((prev) => {
      let next: PlayerViewMode = 'square';
      if (prev === 'square') next = 'cd';
      else if (prev === 'cd') next = 'spectrum';
      else if (prev === 'spectrum') next = 'waveform';
      else if (prev === 'waveform') next = 'square';

      try {
        localStorage.setItem('mouzika_player_view_mode', next);
      } catch {}
      return next;
    });
  };

  // Compute Instagram-style famous highlights
  const highlights = React.useMemo(() => {
    return getSongHighlights(activeTrack, currentLyrics, duration);
  }, [activeTrack?.id, currentLyrics.mode, currentLyrics.lines, duration]);

  // Gesture states
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [swipeHint, setSwipeHint] = useState<'next' | 'prev' | 'lyrics' | 'dismiss' | null>(null);

  const startCoords = useRef<{ x: number; y: number } | null>(null);
  const startTime = useRef<number>(0);
  const activeDirection = useRef<'horizontal' | 'vertical-down' | 'vertical-up' | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const isDismissingRef = useRef<boolean>(false);

  useEffect(() => {
    if (isFullScreenOpen) {
      isDismissingRef.current = false;
      setDragY(0);
      setDragX(0);
    }
  }, [isFullScreenOpen]);

  if (!activeTrack) return null;

  const isLiked = userProfile.likedSongs?.some((s) => s.id === activeTrack.id);

  // Touch & Pointer Gesture Handlers for Swipe-to-Skip, Swipe-Down-to-Dismiss, and Swipe-Up-for-Lyrics
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isDismissingRef.current) return;
    const isTouch = 'touches' in e;
    if (isTouch) {
      lastTouchTimeRef.current = Date.now();
    } else if (Date.now() - lastTouchTimeRef.current < 700) {
      // Discard synthetic mouse event generated right after touch
      return;
    }

    const target = e.target as HTMLElement;
    if (target.closest('input, button, a, .no-swipe, .popover-menu')) return;

    const clientX = isTouch ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    startCoords.current = { x: clientX, y: clientY };
    startTime.current = Date.now();
    activeDirection.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (isDismissingRef.current || !startCoords.current) return;
    const isTouch = 'touches' in e;
    if (isTouch) {
      lastTouchTimeRef.current = Date.now();
    } else if (Date.now() - lastTouchTimeRef.current < 700) {
      return;
    }

    const clientX = isTouch ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const diffX = clientX - startCoords.current.x;
    const diffY = clientY - startCoords.current.y;

    if (!activeDirection.current) {
      if (Math.abs(diffX) > 12 && Math.abs(diffX) > Math.abs(diffY)) {
        activeDirection.current = 'horizontal';
      } else if (diffY > 12 && diffY > Math.abs(diffX)) {
        activeDirection.current = 'vertical-down';
      } else if (diffY < -12 && Math.abs(diffY) > Math.abs(diffX)) {
        activeDirection.current = 'vertical-up';
      }
    }

    if (activeDirection.current === 'horizontal') {
      setDragX(diffX * 0.85);
      if (diffX < -40) setSwipeHint('next');
      else if (diffX > 40) setSwipeHint('prev');
      else setSwipeHint(null);
    } else if (activeDirection.current === 'vertical-down') {
      if (diffY > 0) {
        setDragY(diffY);
        setSwipeHint('dismiss');
      }
    } else if (activeDirection.current === 'vertical-up') {
      if (diffY < 0) {
        setDragY(diffY * 0.45);
        setSwipeHint('lyrics');
      }
    }
  };

  const handleTouchEnd = (e?: React.TouchEvent | React.MouseEvent) => {
    if (isDismissingRef.current) return;
    if (e) {
      const isTouch = 'changedTouches' in e;
      if (isTouch) {
        lastTouchTimeRef.current = Date.now();
      } else if (Date.now() - lastTouchTimeRef.current < 700) {
        return;
      }
    }

    const durationMs = Math.max(1, Date.now() - startTime.current);
    const velocityY = dragY / durationMs;
    const isFlickDismiss = activeDirection.current === 'vertical-down' && (dragY > 70 || (dragY > 25 && velocityY > 0.28));

    if (activeDirection.current === 'horizontal') {
      if (dragX < -55) {
        playNext();
      } else if (dragX > 55) {
        playPrevious();
      }
      setDragX(0);
    } else if (isFlickDismiss) {
      // Mark dismissing and trigger smooth exit animation without snapping back to top
      isDismissingRef.current = true;
      setIsFullScreenOpen(false);
      setTimeout(() => {
        setDragY(0);
        isDismissingRef.current = false;
      }, 400);
    } else if (activeDirection.current === 'vertical-up' || dragY < -45) {
      setIsLyricsOpen(true);
      setDragY(0);
    } else {
      setDragY(0);
    }

    // Reset gesture trackers
    startCoords.current = null;
    activeDirection.current = null;
    setSwipeHint(null);
  };

  return (
    <AnimatePresence>
      {isFullScreenOpen && (
        <>
          {/* Soft backdrop scrim when swiping down */}
          {dragY > 0 && (
            <div
              className="fixed inset-0 z-40 bg-black/60 pointer-events-none transition-opacity"
              style={{ opacity: Math.max(0, 1 - dragY / 300) }}
            />
          )}

          <motion.div
            key="fullscreen-player"
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: dragY > 0 ? dragY : 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseMove={handleTouchMove}
            onMouseUp={handleTouchEnd}
            className="fixed inset-0 z-50 flex flex-col justify-between bg-[#08080a] text-white px-5 sm:px-10 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto select-none touch-none rounded-t-[32px] sm:rounded-t-[40px] shadow-[0_-12px_45px_rgba(0,0,0,0.85)] border-t border-white/10"
          >
            {/* Dynamic seamless extended ambient glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
              <div
                className="absolute -inset-24 opacity-60 blur-3xl scale-125 transition-all duration-700 pointer-events-none"
                style={{
                  backgroundImage: `url(${thumbSrc})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/45 to-black/85" />
            </div>

            {/* Top Grab / Swipe Bar */}
            <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-1 flex-shrink-0" />

            {/* Top Header Bar */}
          <div className="flex items-center justify-between w-full max-w-md mx-auto mb-1 sm:mb-2 flex-shrink-0">
            <button
              onClick={() => setIsFullScreenOpen(false)}
              className="p-1.5 sm:p-2 -ml-1 text-white/70 hover:text-white transition-colors active:scale-95 cursor-pointer"
              title="Minimize"
            >
              <ChevronDown className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            <div className="flex flex-col items-center min-w-0 px-2 max-w-[200px] sm:max-w-xs text-center">
              <span className="text-[10px] sm:text-[11px] font-black tracking-widest text-white/50 uppercase truncate">
                Now Playing
              </span>
              <span className="text-xs sm:text-sm font-bold text-white/90 truncate">
                {activeTrack.album || 'MOUZIKETNA'}
              </span>
              {swipeHint && (
                <span className="text-[9px] sm:text-[10px] font-bold text-[var(--accent)] animate-pulse truncate">
                  {swipeHint === 'next'
                    ? 'Swipe for Next Track ❯'
                    : swipeHint === 'prev'
                    ? '❮ Swipe for Previous Track'
                    : swipeHint === 'lyrics'
                    ? '▲ Swipe up for Lyrics'
                    : '▼ Swipe down to close'}
                </span>
              )}
            </div>

            {/* Action icons */}
            <div className="flex items-center gap-0.5 sm:gap-1.5 relative">
              {/* Full Screen Rotate Landscape Mode */}
              <button
                type="button"
                onClick={() => {
                  setIsLandscapeStageOpen(true);
                }}
                className="p-1.5 sm:p-2 text-white/70 hover:text-white transition-all active:scale-95 cursor-pointer"
                title="Full Screen Landscape Mode"
              >
                <Maximize2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </button>

              {/* Lyrics button */}
              <button
                onClick={() => setIsLyricsOpen(true)}
                className="p-1.5 sm:p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Lyrics"
              >
                <FileText className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </button>

              {/* BASS BOOSTER & VOLUME BOOSTER BUTTON */}
              <div className="relative">
                <button
                  type="button"
                  onClick={handleToggleBooster}
                  className={`p-1.5 sm:p-2 transition-colors relative active:scale-95 cursor-pointer ${
                    boosterSettings.bassMode !== 'off' || boosterSettings.volumeBoost > 100
                      ? 'text-[var(--accent)]'
                      : 'text-white/70 hover:text-white'
                  }`}
                  title="Bass & Volume Booster"
                >
                  <SlidersHorizontal className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </button>

                {/* Bass Boost & Volume Booster Popover */}
                {isBoosterMenuOpen && (
                  <>
                    {/* Backdrop to close on outside click */}
                    <div
                      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
                      onClick={() => setIsBoosterMenuOpen(false)}
                    />
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="popover-menu fixed z-50 top-16 right-3 left-3 sm:left-auto sm:right-6 sm:w-80 max-w-[340px] mx-auto sm:mx-0 max-h-[calc(100vh-80px)] overflow-y-auto bg-[#19191d]/98 backdrop-blur-2xl rounded-3xl sm:rounded-2xl p-4 sm:p-5 border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col gap-4 text-sm font-semibold select-none animate-in fade-in zoom-in-95 duration-200"
                      style={{ overscrollBehavior: 'contain' }}
                    >
                    {/* Header with Title and Reset Button */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-xs uppercase font-extrabold tracking-wider text-white">
                          Audio Booster
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={resetBoostSettings}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                        title="Reset to default settings"
                      >
                        <ResetIcon className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    </div>

                    {/* Section 1: Bass Boost (off, on, on+ boost) */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white/80">Bass Enhancement</span>
                        <span className="text-[11px] font-extrabold text-[var(--accent)] uppercase tracking-wide">
                          {boosterSettings.bassMode === 'off'
                            ? 'Studio Bypass'
                            : boosterSettings.bassMode === 'on'
                            ? 'Clear Bass'
                            : 'Deep Sub-Bass'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/60 rounded-xl border border-white/10">
                        {(['off', 'on', 'boost'] as BassBoostMode[]).map((mode) => {
                          const isActive = boosterSettings.bassMode === mode;
                          const label =
                            mode === 'off' ? 'Off' : mode === 'on' ? 'Clear Bass' : 'Deep Bass';
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setBassBoostMode(mode)}
                              className={`py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-[var(--accent)] text-black shadow-lg scale-[1.02]'
                                  : 'text-white/60 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-white/45 leading-tight">
                        {boosterSettings.bassMode === 'off'
                          ? 'Pure uncompressed master audio. 100% transparent and neutral.'
                          : boosterSettings.bassMode === 'on'
                          ? 'Tight 70Hz punch + 28Hz subsonic cut. Lyrics & vocal clarity are 100% protected.'
                          : 'Deep physical sub rumble with active vocal intelligibility compensation.'}
                      </p>
                    </div>

                    {/* Section 2: Vocal & Lyric Intelligibility Booster */}
                    <div
                      className={`flex flex-col gap-1.5 pt-2 border-t border-white/10 transition-all ${
                        boosterSettings.bassMode === 'off'
                          ? 'opacity-40 pointer-events-none select-none grayscale'
                          : 'opacity-100 pointer-events-auto'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Mic
                            className={`w-3.5 h-3.5 transition-colors ${
                              boosterSettings.bassMode === 'off'
                                ? 'text-zinc-500'
                                : boosterSettings.vocalClarity
                                ? 'text-[var(--accent)]'
                                : 'text-white/60'
                            }`}
                          />
                          <span
                            className={`text-xs font-bold transition-colors ${
                              boosterSettings.bassMode === 'off' ? 'text-zinc-400' : 'text-white/90'
                            }`}
                          >
                            Voice & Lyric Clarity
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={boosterSettings.bassMode === 'off'}
                          onClick={toggleVocalClarity}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                            boosterSettings.bassMode === 'off'
                              ? boosterSettings.vocalClarity
                                ? 'bg-zinc-800 text-zinc-400 border border-zinc-700/60 cursor-not-allowed'
                                : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                              : boosterSettings.vocalClarity
                              ? 'bg-[var(--accent)] text-black shadow-sm'
                              : 'bg-white/10 text-white/50 hover:bg-white/15 hover:text-white'
                          }`}
                        >
                          {boosterSettings.vocalClarity ? 'ON' : 'OFF'}
                        </button>
                      </div>
                      <p className={`text-[10px] leading-snug transition-colors ${boosterSettings.bassMode === 'off' ? 'text-zinc-500' : 'text-white/40'}`}>
                        {boosterSettings.bassMode === 'off'
                          ? 'Grayed out while Bass Boost is off. Turn on Clear Bass or Deep Bass to re-enable.'
                          : 'Lifts singer vocals and consonants (3.2kHz) for crystal-clear lyrics when bass is boosted.'}
                      </p>
                    </div>

                    {/* Section 3: Volume Booster (100% to 200%) */}
                    <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white/80">Volume Booster</span>
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-md ${
                            boosterSettings.volumeBoost > 100
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30'
                              : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {boosterSettings.volumeBoost}% {boosterSettings.volumeBoost === 200 ? 'MAX' : ''}
                        </span>
                      </div>

                      {/* Slider 100% to 200% */}
                      <input
                        type="range"
                        min="100"
                        max="200"
                        step="1"
                        value={boosterSettings.volumeBoost}
                        onChange={(e) => setVolumeBoostPercent(Number(e.target.value))}
                        className="w-full accent-[var(--accent)] bg-white/20 h-1.5 rounded-lg cursor-pointer"
                      />

                      {/* Quick Presets Underneath */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {[100, 130, 160, 200].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setVolumeBoostPercent(pct)}
                            className={`py-1 rounded-lg text-[11px] font-bold transition-all ${
                              boosterSettings.volumeBoost === pct
                                ? 'bg-[var(--accent)] text-black font-extrabold'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {pct}%{pct === 100 ? ' (Def)' : pct === 200 ? ' (Max)' : ''}
                          </button>
                        ))}
                      </div>

                      <p className="text-[10px] text-white/40 pt-1 leading-snug">
                        Amplifies audio output up to 200% via hardware DSP with safety peak limiter.
                      </p>
                    </div>
                  </div>
                  </>
                )}
              </div>

              {/* Sleep Timer Popover */}
              <div className="relative">
                <button
                  onClick={() => {
                    setIsSleepMenuOpen(!isSleepMenuOpen);
                    setIsBoosterMenuOpen(false);
                  }}
                  className={`p-2 transition-colors relative ${
                    sleepTimerRemaining !== null ? 'text-[var(--accent)]' : 'text-white/70 hover:text-white'
                  }`}
                  title="Sleep Timer"
                >
                  <Moon className="w-5 h-5" />
                  {sleepTimerRemaining !== null && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-black text-[9px] font-extrabold flex items-center justify-center">
                      {Math.ceil(sleepTimerRemaining / 60)}m
                    </span>
                  )}
                </button>

                {isSleepMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="popover-menu fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-11 max-w-[260px] mx-auto sm:mx-0 bg-[#1f1f23]/98 backdrop-blur-2xl rounded-2xl p-2 border border-white/15 shadow-2xl z-50 flex flex-col gap-1 text-sm font-semibold"
                  >
                    <span className="text-[10px] uppercase font-bold text-white/40 px-3 py-1">{t('player.sleepTimer', 'Sleep Timer')}</span>
                    <button
                      onClick={() => { setSleepTimerMinutes(5); setIsSleepMenuOpen(false); }}
                      className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                    >
                      5 {t('account.minutes', 'minutes')}
                    </button>
                    <button
                      onClick={() => { setSleepTimerMinutes(15); setIsSleepMenuOpen(false); }}
                      className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                    >
                      15 {t('account.minutes', 'minutes')}
                    </button>
                    <button
                      onClick={() => { setSleepTimerMinutes(30); setIsSleepMenuOpen(false); }}
                      className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                    >
                      30 {t('account.minutes', 'minutes')}
                    </button>
                    <button
                      onClick={() => { setSleepTimerMinutes(60); setIsSleepMenuOpen(false); }}
                      className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                    >
                      1 {t('account.hours', 'hour')}
                    </button>
                    <button
                      onClick={() => { setSleepTimerEndOfSong(); setIsSleepMenuOpen(false); }}
                      className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                    >
                      {t('player.endOfSong', 'End of current song')}
                    </button>
                    {sleepTimerRemaining !== null && (
                      <button
                        onClick={() => { cancelSleepTimer(); setIsSleepMenuOpen(false); }}
                        className="px-3 py-2 text-left text-red-400 hover:bg-red-500/10 rounded-xl border-t border-white/5 mt-1"
                      >
                        {t('player.turnOff', 'Turn off')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsQueueOpen(true)}
                className="p-1.5 sm:p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Queue"
              >
                <ListMusic className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Center Artwork with Horizontal Swipe Motion & Lifted Higher */}
          <div className="flex-1 min-h-0 flex items-center justify-center w-full max-w-md mx-auto pt-0 pb-1 sm:pt-1 sm:pb-2">
            <motion.div
              style={{
                aspectRatio: '1 / 1',
                width: 'min(88vw, 360px)',
                height: 'min(88vw, 360px)',
                maxHeight: 'calc(100dvh - 330px)',
                maxWidth: 'calc(100dvh - 330px)',
                x: dragX,
                rotate: dragX * 0.04,
                scale: 1 - Math.min(Math.abs(dragX) / 1000, 0.1),
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`w-full aspect-square ${
                viewMode !== 'square' ? 'rounded-full' : 'rounded-3xl'
              } relative group cursor-grab active:cursor-grabbing mx-auto select-none shadow-[0_20px_60px_rgba(0,0,0,0.85)]`}
            >
              {viewMode === 'spectrum' ? (
                /* 3. Spicetify / NCS Circular Spectrum Visualizer */
                <NvsVisualizer
                  thumbSrc={thumbSrc}
                  trackTitle={activeTrack.title}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  mode="ncs"
                  onNextView={() => {
                    if (Math.abs(dragX) < 8 && Math.abs(dragY) < 8) {
                      cycleViewMode();
                    }
                  }}
                />
              ) : viewMode === 'waveform' ? (
                /* 4. Fluid Waveform Visualizer */
                <NvsVisualizer
                  thumbSrc={thumbSrc}
                  trackTitle={activeTrack.title}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  mode="wave"
                  onNextView={() => {
                    if (Math.abs(dragX) < 8 && Math.abs(dragY) < 8) {
                      cycleViewMode();
                    }
                  }}
                />
              ) : viewMode === 'cd' ? (
                /* 2. Realistic Vinyl CD Rotating Disc */
                <div
                  onClick={() => {
                    if (Math.abs(dragX) < 8 && Math.abs(dragY) < 8) {
                      cycleViewMode();
                    }
                  }}
                  className="w-full h-full rounded-full relative overflow-hidden bg-[#0c0c0e] flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.95)] border-2 border-zinc-700/60 cursor-pointer"
                  style={{
                    background: 'radial-gradient(circle, #1c1c1f 0%, #0a0a0c 65%, #040404 100%)',
                  }}
                  title="Click to switch to NVS Visualizer"
                >
                  {/* Concentric Vinyl Grooves */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none opacity-35"
                    style={{
                      background:
                        'repeating-radial-gradient(circle, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 1.5px, transparent 2px, transparent 5px)',
                    }}
                  />

                  {/* Spinning Disc Body synced with isPlaying */}
                  <div
                    className={`w-full h-full rounded-full flex items-center justify-center ${
                      isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''
                    }`}
                    style={{
                      animationPlayState: isPlaying ? 'running' : 'paused',
                    }}
                  >
                    {/* Vinyl Center Art Label */}
                    <div className="w-[76%] h-[76%] rounded-full overflow-hidden relative shadow-2xl border-4 border-black/95 flex items-center justify-center">
                      <img
                        src={thumbSrc}
                        alt={activeTrack.title}
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_ART;
                        }}
                        className="w-full h-full object-cover rounded-full pointer-events-none select-none"
                        draggable={false}
                      />
                      {/* Center Spindle Hole */}
                      <div className="absolute w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#0d0905] border-[3px] border-zinc-400 shadow-inner flex items-center justify-center z-10">
                        <div className="w-3 h-3 rounded-full bg-black shadow-inner" />
                      </div>
                    </div>
                  </div>

                  {/* Realistic Glossy Sheen Overlay */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      background:
                        'conic-gradient(from 45deg, transparent 0deg, rgba(255,255,255,0.13) 40deg, transparent 80deg, transparent 180deg, rgba(255,255,255,0.13) 220deg, transparent 260deg)',
                    }}
                  />
                </div>
              ) : (
                /* 1. Classic Square Cover */
                <div
                  onClick={() => {
                    if (Math.abs(dragX) < 8 && Math.abs(dragY) < 8) {
                      cycleViewMode();
                    }
                  }}
                  className="w-full h-full rounded-3xl overflow-hidden relative cursor-pointer shadow-2xl"
                  title="Click to switch to spinning Vinyl CD view"
                >
                  <img
                    src={thumbSrc}
                    alt={activeTrack.title}
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_ART;
                    }}
                    className="w-full h-full object-cover rounded-3xl select-none pointer-events-none"
                    style={{ aspectRatio: '1 / 1' }}
                    draggable={false}
                  />
                </div>
              )}
            </motion.div>
          </div>

          {/* Bottom Track Meta, Timeline & Controls (Positioned closer up to the artwork) */}
          <div className="w-full max-w-md mx-auto flex flex-col gap-2.5 sm:gap-3.5 mt-1 sm:mt-2 mb-1 flex-shrink-0">
            {/* Title & Actions Row (Matching reference layout) */}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-3">
                <h2 className="text-xl sm:text-2xl font-black text-white truncate leading-tight">
                  {activeTrack.title}
                </h2>
                <p className="text-sm sm:text-base text-white/60 truncate font-semibold mt-0.5">
                  {activeTrack.artist}
                </p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setModalAddToPlaylistTrack(activeTrack)}
                  className="p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
                  title="Add to Playlist"
                >
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <button
                  onClick={() => toggleLikeTrack(activeTrack)}
                  className="p-2 text-white/70 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                  title={isLiked ? 'Unlike' : 'Like'}
                >
                  <Heart
                    className={`w-6 h-6 sm:w-7 sm:h-7 ${
                      isLiked ? 'fill-[var(--accent)] text-[var(--accent)]' : 'text-white/60'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Progress Scrubber */}
            <TrackProgressBar
              currentTime={currentTime}
              duration={duration}
              highlights={highlights}
              seekTo={seekTo}
            />

            {/* Main Playback Controls */}
            <div className="flex items-center justify-between px-1 sm:px-2 no-swipe">
              <button
                onClick={toggleShuffle}
                className={`p-2 transition-colors cursor-pointer ${
                  isShuffle ? 'text-[var(--accent)]' : 'text-white/40 hover:text-white'
                }`}
                title="Shuffle"
              >
                <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              <button
                onClick={playPrevious}
                className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Previous (Swipe right)"
              >
                <SkipBack className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
              </button>

              <button
                onClick={togglePlay}
                disabled={isBuffering}
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-90 transition-all cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isBuffering ? (
                  <Loader2 className="w-8 h-8 animate-spin text-black" />
                ) : isPlaying ? (
                  <Pause className="w-8 h-8 fill-black text-black" />
                ) : (
                  <Play className="w-8 h-8 fill-black text-black ml-1" />
                )}
              </button>

              <button
                onClick={playNext}
                className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Next (Swipe left)"
              >
                <SkipForward className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
              </button>

              <button
                onClick={toggleLoop}
                className={`p-2 transition-colors cursor-pointer ${
                  isLooping ? 'text-[var(--accent)]' : 'text-white/40 hover:text-white'
                }`}
                title={isLooping ? 'Repeat One' : 'Repeat Off'}
              >
                {isLooping ? <Repeat1 className="w-5 h-5 sm:w-6 sm:h-6" /> : <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>
          </div>
        </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
