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
  } = useMusic();

  const thumbSrc = useTrackThumb(activeTrack);
  const [isSleepMenuOpen, setIsSleepMenuOpen] = useState(false);
  const [isBoosterMenuOpen, setIsBoosterMenuOpen] = useState(false);

  // Once clicked, remove the new booster notification badge permanently
  const [hasSeenBooster, setHasSeenBooster] = useState(() => {
    try {
      return localStorage.getItem('mouzika_audio_booster_seen') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleBooster = () => {
    setIsBoosterMenuOpen((prev) => !prev);
    setIsSleepMenuOpen(false);
    if (!hasSeenBooster) {
      setHasSeenBooster(true);
      try {
        localStorage.setItem('mouzika_audio_booster_seen', 'true');
      } catch {}
    }
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
  const activeDirection = useRef<'horizontal' | 'vertical-down' | 'vertical-up' | null>(null);

  if (!isFullScreenOpen || !activeTrack) return null;

  const isLiked = userProfile.likedSongs?.some((s) => s.id === activeTrack.id);

  // Touch & Pointer Gesture Handlers for Swipe-to-Skip, Swipe-Down-to-Dismiss, and Swipe-Up-for-Lyrics
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, a, .no-swipe, .popover-menu')) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    startCoords.current = { x: clientX, y: clientY };
    activeDirection.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!startCoords.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

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

  const handleTouchEnd = () => {
    if (activeDirection.current === 'horizontal') {
      if (dragX < -55) {
        playNext();
      } else if (dragX > 55) {
        playPrevious();
      }
    } else if (activeDirection.current === 'vertical-down') {
      if (dragY > 110) {
        setIsFullScreenOpen(false);
      }
    } else if (activeDirection.current === 'vertical-up' || dragY < -45) {
      setIsLyricsOpen(true);
    }

    // Reset gesture states
    startCoords.current = null;
    activeDirection.current = null;
    setDragX(0);
    setDragY(0);
    setSwipeHint(null);
  };

  return (
    <AnimatePresence>
      {isFullScreenOpen && (
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
          className="fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-[#2a1708] via-[#120b05] to-black text-white px-5 sm:px-12 pt-3 pb-6 sm:pb-8 overflow-y-auto select-none touch-none"
        >
          {/* Dynamic blurred ambient glow behind art */}
          <div
            className="absolute inset-0 opacity-40 blur-3xl pointer-events-none -z-10 transition-all duration-700"
            style={{
              backgroundImage: `url(${thumbSrc})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />

          {/* Top Header Bar */}
          <div className="flex items-center justify-between w-full max-w-lg mx-auto mb-1 sm:mb-2 flex-shrink-0">
            <button
              onClick={() => setIsFullScreenOpen(false)}
              className="p-2 -ml-2 text-white/70 hover:text-white transition-colors active:scale-95"
              title="Minimize"
            >
              <ChevronDown className="w-7 h-7" />
            </button>

            <div className="flex flex-col items-center">
              <span className="text-[11px] font-black tracking-widest text-white/50 uppercase">
                Now Playing
              </span>
              {swipeHint && (
                <span className="text-[10px] font-bold text-white/80 animate-pulse">
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
            <div className="flex items-center gap-1.5 relative">
              {/* Full Screen Rotate Landscape Mode */}
              <button
                type="button"
                onClick={() => {
                  setIsLandscapeStageOpen(true);
                }}
                className="p-2 text-white/70 hover:text-white transition-all active:scale-95 cursor-pointer"
                title="Full Screen Landscape Mode"
              >
                <Maximize2 className="w-5 h-5" />
              </button>

              {/* Lyrics button */}
              <button
                onClick={() => setIsLyricsOpen(true)}
                className="p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Lyrics"
              >
                <FileText className="w-5 h-5" />
              </button>

              {/* BASS BOOSTER & VOLUME BOOSTER BUTTON WITH ATTENTION BADGE */}
              <div className="relative">
                <button
                  type="button"
                  onClick={handleToggleBooster}
                  className={`p-2 transition-all relative rounded-full active:scale-95 cursor-pointer ${
                    boosterSettings.bassMode !== 'off' || boosterSettings.volumeBoost > 100
                      ? 'text-[#ff6b1a] bg-[#ff6b1a]/20 shadow-[0_0_12px_rgba(255,107,26,0.4)]'
                      : 'text-white/70 hover:text-white'
                  }`}
                  title="Bass & Volume Booster"
                >
                  <SlidersHorizontal className="w-5 h-5" />
                  {/* Static clean orange notification badge until clicked the first time */}
                  {!hasSeenBooster && (
                    <span className="absolute top-1 right-1 flex h-2 w-2 items-center justify-center">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff6b1a] shadow-sm" />
                    </span>
                  )}
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
                        <Zap className="w-4 h-4 text-[#ff6b1a]" />
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
                        <span className="text-xs font-bold text-white/80">Bass Boost</span>
                        <span className="text-[11px] font-extrabold text-[#ff6b1a] uppercase tracking-wide">
                          {boosterSettings.bassMode === 'off'
                            ? 'Off'
                            : boosterSettings.bassMode === 'on'
                            ? 'On'
                            : 'On+ Boost'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/60 rounded-xl border border-white/10">
                        {(['off', 'on', 'boost'] as BassBoostMode[]).map((mode) => {
                          const isActive = boosterSettings.bassMode === mode;
                          const label = mode === 'off' ? 'Off' : mode === 'on' ? 'On' : 'On+ Boost';
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setBassBoostMode(mode)}
                              className={`py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                                isActive
                                  ? 'bg-[#ff6b1a] text-black shadow-lg scale-[1.02]'
                                  : 'text-white/60 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 2: Volume Booster (100% to 200%) */}
                    <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white/80">Volume Booster</span>
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-md ${
                            boosterSettings.volumeBoost > 100
                              ? 'bg-[#ff6b1a]/20 text-[#ff6b1a] border border-[#ff6b1a]/30'
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
                        className="w-full accent-[#ff6b1a] bg-white/20 h-1.5 rounded-lg cursor-pointer"
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
                                ? 'bg-[#ff6b1a] text-black font-extrabold'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {pct}%{pct === 100 ? ' (Def)' : pct === 200 ? ' (Max)' : ''}
                          </button>
                        ))}
                      </div>

                      <p className="text-[10px] text-white/40 pt-1 leading-snug">
                        Amplifies audio output up to 200% via hardware DSP. Saved in cache.
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
                    sleepTimerRemaining !== null ? 'text-[#ff6b1a]' : 'text-white/70 hover:text-white'
                  }`}
                  title="Sleep Timer"
                >
                  <Moon className="w-5 h-5" />
                  {sleepTimerRemaining !== null && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff6b1a] text-black text-[9px] font-extrabold flex items-center justify-center">
                      {Math.ceil(sleepTimerRemaining / 60)}m
                    </span>
                  )}
                </button>

                {isSleepMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="popover-menu fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-11 max-w-[260px] mx-auto sm:mx-0 bg-[#1f1f23]/98 backdrop-blur-2xl rounded-2xl p-2 border border-white/15 shadow-2xl z-50 flex flex-col gap-1 text-sm font-semibold"
                  >
                    <span className="text-[10px] uppercase font-bold text-white/40 px-3 py-1">Sleep Timer</span>
                    <button
                      onClick={() => { setSleepTimerMinutes(5); setIsSleepMenuOpen(false); }}
                      className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                    >
                      5 minutes
                    </button>
                    <button
                      onClick={() => { setSleepTimerMinutes(15); setIsSleepMenuOpen(false); }}
                      className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                    >
                      15 minutes
                    </button>
                    <button
                      onClick={() => { setSleepTimerMinutes(30); setIsSleepMenuOpen(false); }}
                      className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                    >
                      30 minutes
                    </button>
                    <button
                      onClick={() => { setSleepTimerMinutes(60); setIsSleepMenuOpen(false); }}
                      className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                    >
                      1 hour
                    </button>
                    <button
                      onClick={() => { setSleepTimerEndOfSong(); setIsSleepMenuOpen(false); }}
                      className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                    >
                      End of current song
                    </button>
                    {sleepTimerRemaining !== null && (
                      <button
                        onClick={() => { cancelSleepTimer(); setIsSleepMenuOpen(false); }}
                        className="px-3 py-2 text-left text-red-400 hover:bg-red-500/10 rounded-xl border-t border-white/5 mt-1"
                      >
                        Turn off
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsQueueOpen(true)}
                className="p-2 text-white/70 hover:text-white transition-colors"
                title="Queue"
              >
                <ListMusic className="w-5 h-5" />
              </button>

              <button
                onClick={() => setModalAddToPlaylistTrack(activeTrack)}
                className="p-2 text-white/70 hover:text-white transition-colors"
                title="Add to Playlist"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Artwork with Horizontal Swipe Motion & Spring Dynamics (Tap to cycle: Square -> CD -> NVS Visualizer) */}
          <div className="flex-1 flex items-center justify-center w-full max-w-sm sm:max-w-md mx-auto px-2 py-1 flex-shrink-0">
            <motion.div
              style={{
                aspectRatio: '1 / 1',
                maxHeight: 'min(78vw, 360px, calc(100vh - 280px))',
                maxWidth: 'min(78vw, 360px, calc(100vh - 280px))',
                x: dragX,
                rotate: dragX * 0.04,
                scale: 1 - Math.min(Math.abs(dragX) / 1000, 0.1),
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`w-full aspect-square ${
                viewMode !== 'square' ? 'rounded-full' : 'rounded-3xl'
              } shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] relative group cursor-grab active:cursor-grabbing mx-auto select-none`}
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

              {/* Visual swipe indicator overlay */}
              {(dragX !== 0 || Math.abs(dragY) > 20) && (
                <div
                  className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${
                    Math.abs(dragX) > 25 || Math.abs(dragY) > 25 ? 'bg-black/40' : 'opacity-0'
                  }`}
                >
                  <div className="bg-black/85 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-xs font-bold text-white flex items-center gap-2 shadow-2xl">
                    {dragY > 25 ? (
                      <>
                        <ChevronDown className="w-4 h-4 text-white" />
                        <span>Swipe down to close</span>
                      </>
                    ) : dragY < -25 ? (
                      <>
                        <ChevronUp className="w-4 h-4 text-white" />
                        <span>Swipe up for Lyrics</span>
                      </>
                    ) : dragX < 0 ? (
                      <>
                        <span>Next Track</span>
                        <SkipForward className="w-4 h-4 text-white" />
                      </>
                    ) : (
                      <>
                        <SkipBack className="w-4 h-4 text-white" />
                        <span>Previous Track</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Bottom Track Meta, Timeline & Controls */}
          <div className="w-full max-w-lg mx-auto flex flex-col gap-3.5 sm:gap-5 mt-2 sm:mt-3 flex-shrink-0">
            {/* Title & Like */}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white truncate leading-tight">
                  {activeTrack.title}
                </h2>
                <p className="text-sm sm:text-base text-white/60 truncate font-semibold mt-0.5">
                  {activeTrack.artist}
                </p>
              </div>

              <button
                onClick={() => toggleLikeTrack(activeTrack)}
                className="p-3 text-white/70 hover:text-white hover:scale-110 active:scale-95 transition-all"
                title={isLiked ? 'Unlike' : 'Like'}
              >
                <Heart
                  className={`w-7 h-7 ${
                    isLiked ? 'fill-[#ff6b1a] text-[#ff6b1a]' : 'text-white/60'
                  }`}
                />
              </button>
            </div>

            {/* Progress Scrubber */}
            <TrackProgressBar
              currentTime={currentTime}
              duration={duration}
              highlights={highlights}
              seekTo={seekTo}
            />

            {/* Main Controls */}
            <div className="flex items-center justify-between px-2 no-swipe">
              <button
                onClick={toggleShuffle}
                className={`p-2 transition-colors ${
                  isShuffle ? 'text-[#ff6b1a]' : 'text-white/40 hover:text-white'
                }`}
                title="Shuffle"
              >
                <Shuffle className="w-6 h-6" />
              </button>

              <button
                onClick={playPrevious}
                className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all"
                title="Previous (Swipe right)"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </button>

              <button
                onClick={() => seekBy(-10)}
                className="p-2 text-white/60 hover:text-white active:scale-90 transition-all relative"
                title="Back 10s"
              >
                <RotateCcw className="w-6 h-6" />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black pointer-events-none">
                  10
                </span>
              </button>

              <button
                onClick={togglePlay}
                disabled={isBuffering}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-90 transition-all"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isBuffering ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-8 h-8 fill-black" />
                ) : (
                  <Play className="w-8 h-8 fill-black ml-1" />
                )}
              </button>

              <button
                onClick={() => seekBy(10)}
                className="p-2 text-white/60 hover:text-white active:scale-90 transition-all relative"
                title="Forward 10s"
              >
                <RotateCw className="w-6 h-6" />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black pointer-events-none">
                  10
                </span>
              </button>

              <button
                onClick={playNext}
                className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all"
                title="Next (Swipe left)"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </button>

              <button
                onClick={toggleLoop}
                className={`p-2 transition-colors ${
                  isLooping ? 'text-[#ff6b1a]' : 'text-white/40 hover:text-white'
                }`}
                title={isLooping ? 'Repeat One' : 'Repeat Off'}
              >
                {isLooping ? <Repeat1 className="w-6 h-6" /> : <Repeat className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
