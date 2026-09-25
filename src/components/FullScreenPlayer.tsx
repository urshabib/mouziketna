import React, { useState, useRef, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  ChevronDown,
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
  Flame,
} from 'lucide-react';
import { canonicalThumbUrl, FALLBACK_ART } from '../services/api';
import { useTrackThumb } from '../services/useTrackThumb';
import { getSongHighlights } from '../services/songHighlights';
import { TrackProgressBar } from './TrackProgressBar';
import { motion, AnimatePresence } from 'motion/react';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

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
    isLyricsOpen,
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

  // Compute Instagram-style famous highlights
  const highlights = React.useMemo(() => {
    return getSongHighlights(activeTrack, currentLyrics, duration);
  }, [activeTrack?.id, currentLyrics.mode, currentLyrics.lines, duration]);
  
  // Gesture states
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeHint, setSwipeHint] = useState<'next' | 'prev' | null>(null);

  const startCoords = useRef<{ x: number; y: number } | null>(null);
  const activeDirection = useRef<'horizontal' | 'vertical' | null>(null);

  if (!isFullScreenOpen || !activeTrack) return null;

  const isLiked = userProfile.likedSongs?.some((s) => s.id === activeTrack.id);
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Touch & Pointer Gesture Handlers for Swipe-to-Skip and Swipe-Down-to-Dismiss
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    // Avoid intercepting slider or button taps
    const target = e.target as HTMLElement;
    if (target.closest('input, button, a, .no-swipe')) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    startCoords.current = { x: clientX, y: clientY };
    activeDirection.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!startCoords.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const diffX = clientX - startCoords.current.x;
    const diffY = clientY - startCoords.current.y;

    if (!activeDirection.current) {
      if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
        activeDirection.current = 'horizontal';
      } else if (diffY > 10 && diffY > Math.abs(diffX)) {
        activeDirection.current = 'vertical';
      }
    }

    if (activeDirection.current === 'horizontal') {
      setDragX(diffX * 0.85);
      if (diffX < -40) setSwipeHint('next');
      else if (diffX > 40) setSwipeHint('prev');
      else setSwipeHint(null);
    } else if (activeDirection.current === 'vertical') {
      if (diffY > 0) {
        setDragY(diffY);
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
    } else if (activeDirection.current === 'vertical') {
      if (dragY > 120) {
        setIsFullScreenOpen(false);
      }
    }

    // Reset
    startCoords.current = null;
    activeDirection.current = null;
    setDragX(0);
    setDragY(0);
    setIsSwiping(false);
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
          <div className="flex items-center justify-between w-full max-w-lg mx-auto mb-1.5 sm:mb-3 flex-shrink-0">
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
                  {swipeHint === 'next' ? 'Swipe for Next Track ❯' : '❮ Swipe for Previous Track'}
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
                <Maximize2 className="w-5 h-5 text-white/70 hover:text-white" />
              </button>

              <button
                onClick={() => setIsLyricsOpen(true)}
                className="p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
                title="Lyrics"
              >
                <FileText className="w-5 h-5" />
              </button>

              {/* Sleep Timer Popover */}
              <div className="relative">
                <button
                  onClick={() => setIsSleepMenuOpen(!isSleepMenuOpen)}
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
                  <div className="absolute right-0 top-10 w-44 bg-[#1f1f23] rounded-2xl p-2 border border-white/10 shadow-2xl z-50 flex flex-col gap-1 text-sm font-semibold">
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

          {/* Center Artwork with Horizontal Swipe Motion & Spring Dynamics */}
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
              className="w-full aspect-square rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] bg-[#18181b] border border-white/10 relative group cursor-grab active:cursor-grabbing mx-auto"
            >
              <img
                src={thumbSrc}
                alt={activeTrack.title}
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_ART;
                }}
                className="w-full h-full object-cover aspect-square select-none pointer-events-none rounded-3xl"
                style={{ aspectRatio: '1 / 1' }}
                draggable={false}
              />

              {/* Visual swipe indicator overlay */}
              {(dragX !== 0 || dragY > 20) && (
                <div
                  className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${
                    Math.abs(dragX) > 25 || dragY > 25 ? 'bg-black/40' : 'opacity-0'
                  }`}
                >
                  <div className="bg-black/85 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-xs font-bold text-white flex items-center gap-2 shadow-2xl">
                    {dragY > 25 ? (
                      <>
                        <ChevronDown className="w-4 h-4 text-white" />
                        <span>Swipe down to close</span>
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

            {/* Progress Scrubber (supports all 4 styles & key parts rectangles) */}
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
