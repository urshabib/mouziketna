import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  Minimize2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FileText,
  Moon,
  Loader2,
  Smartphone,
} from 'lucide-react';
import { FALLBACK_ART } from '../services/api';
import { useTrackThumb } from '../services/useTrackThumb';
import { SyncedLyricsLine } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface StageThickScrubberProps {
  currentTime: number;
  duration: number;
  seekTo: (time: number) => void;
  shouldRotate: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const StageThickScrubber: React.FC<StageThickScrubberProps> = ({
  currentTime,
  duration,
  seekTo,
  shouldRotate,
  className = '',
  style = {},
}) => {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const calculateTimeFromCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!barRef.current || duration <= 0) return 0;
      const rect = barRef.current.getBoundingClientRect();
      let fraction = 0;
      if (shouldRotate) {
        // When rotated 90deg clockwise: visual horizontal progression moves downwards along physical Y!
        fraction = (clientY - rect.top) / rect.height;
      } else {
        // Normal horizontal progression along physical X
        fraction = (clientX - rect.left) / rect.width;
      }
      const clamped = Math.max(0, Math.min(1, fraction));
      return clamped * duration;
    },
    [shouldRotate, duration]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const targetTime = calculateTimeFromCoords(e.clientX, e.clientY);
    setIsScrubbing(true);
    setScrubTime(targetTime);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    e.preventDefault();
    e.stopPropagation();
    const targetTime = calculateTimeFromCoords(e.clientX, e.clientY);
    setScrubTime(targetTime);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    const finalTime = calculateTimeFromCoords(e.clientX, e.clientY);
    seekTo(finalTime);
    setIsScrubbing(false);
    setScrubTime(null);
  };

  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;
  const fillPct = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  return (
    <div
      ref={barRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={style}
      className={`relative h-3 sm:h-3.5 rounded-[5px] overflow-hidden bg-white/15 border border-white/10 flex items-center flex-shrink-0 select-none shadow-inner cursor-pointer touch-none ${className}`}
      title="Scrub track progress"
    >
      <div
        className="h-full bg-white rounded-[4px] transition-all duration-75 relative pointer-events-none"
        style={{ width: `${fillPct}%` }}
      />
    </div>
  );
};

export const LandscapeStagePlayer: React.FC = () => {
  const {
    activeTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    togglePlay,
    seekTo,
    playNext,
    playPrevious,
    userProfile,
    isLandscapeStageOpen,
    setIsLandscapeStageOpen,
    currentLyrics,
    sleepTimerRemaining,
    setSleepTimerMinutes,
    setSleepTimerEndOfSong,
    cancelSleepTimer,
  } = useMusic();

  const thumbSrc = useTrackThumb(activeTrack);
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Landscape Stage local settings (separated from normal player)
  const [stageLyricsOn, setStageLyricsOn] = useState(true);
  const [isSleepMenuOpen, setIsSleepMenuOpen] = useState(false);
  const [manualRotate, setManualRotate] = useState<boolean | null>(null);
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Swipe gesture state on album art matching FullScreenPlayer
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const startCoords = useRef<{ x: number; y: number } | null>(null);
  const activeDirection = useRef<'horizontal' | 'vertical' | null>(null);

  // Track window size and orientation changes
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const isPortrait = windowDimensions.height > windowDimensions.width;
  // Automatically rotate website 90deg on phones held vertically in portrait
  const shouldRotate = manualRotate !== null ? manualRotate : isPortrait;

  // Native browser fullscreen helpers (Windows F11/Android/iOS standalone)
  const enterNativeFullscreen = () => {
    try {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } catch {}
  };

  const exitNativeFullscreen = () => {
    try {
      const doc = document as any;
      if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      }
    } catch {}
  };

  // Reset stage settings, enter native fullscreen and prevent window body scrolling when opened
  useEffect(() => {
    if (isLandscapeStageOpen) {
      setStageLyricsOn(true);
      setManualRotate(null);
      enterNativeFullscreen();
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.scrollTo(0, 0);
      return () => {
        document.body.style.overflow = originalOverflow;
        exitNativeFullscreen();
      };
    }
  }, [isLandscapeStageOpen]);

  // Determine active synced lyrics line
  const activeLineIndex = useMemo(() => {
    if (currentLyrics.mode !== 'synced' || !Array.isArray(currentLyrics.lines)) return -1;
    const lines = currentLyrics.lines as SyncedLyricsLine[];
    let active = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime + 0.25) {
        active = i;
      } else {
        break;
      }
    }
    return active;
  }, [currentLyrics, currentTime]);

  // Smoothly auto-scroll lyrics container directly so active line stays vertically centered WITHOUT scrolling window/body
  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current && stageLyricsOn) {
      const container = lyricsContainerRef.current;
      const line = activeLineRef.current;
      const lineTop = line.offsetTop;
      const lineHeight = line.offsetHeight;
      const containerHeight = container.clientHeight;
      const targetScroll = lineTop - containerHeight / 2 + lineHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [activeLineIndex, stageLyricsOn]);

  // Keyboard navigation inside stage
  useEffect(() => {
    if (!isLandscapeStageOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        playPrevious();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        playNext();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        setStageLyricsOn((prev) => !prev);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        setIsLandscapeStageOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLandscapeStageOpen, togglePlay, playNext, playPrevious, setIsLandscapeStageOpen]);

  if (!isLandscapeStageOpen || !activeTrack) return null;

  const hasLyrics =
    (currentLyrics.mode === 'synced' && Array.isArray(currentLyrics.lines) && currentLyrics.lines.length > 0) ||
    (currentLyrics.mode === 'plain' && typeof currentLyrics.lines === 'string' && currentLyrics.lines.trim().length > 0);
  const showLyrics = stageLyricsOn && hasLyrics;

  // Touch & Pointer Gesture Handlers on Album Cover (Swipe to skip, swipe down to dismiss)
  const handleArtTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    startCoords.current = { x: clientX, y: clientY };
    activeDirection.current = null;
  };

  const handleArtTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!startCoords.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const rawDiffX = clientX - startCoords.current.x;
    const rawDiffY = clientY - startCoords.current.y;

    // When website is rotated 90deg clockwise on mobile portrait:
    // Visual X (right/left) corresponds to Screen Y
    // Visual Y (down/up) corresponds to Screen -X
    const diffX = shouldRotate ? rawDiffY : rawDiffX;
    const diffY = shouldRotate ? -rawDiffX : rawDiffY;

    if (!activeDirection.current) {
      if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
        activeDirection.current = 'horizontal';
      } else if (diffY > 10 && diffY > Math.abs(diffX)) {
        activeDirection.current = 'vertical';
      }
    }

    if (activeDirection.current === 'horizontal') {
      setDragX(diffX * 0.85);
      setDragY(0);
    } else if (activeDirection.current === 'vertical') {
      if (diffY > 0) {
        setDragY(diffY * 0.85);
        setDragX(0);
      }
    }
  };

  const handleArtTouchEnd = () => {
    if (activeDirection.current === 'horizontal') {
      if (dragX < -40) {
        playNext();
      } else if (dragX > 40) {
        playPrevious();
      }
    } else if (activeDirection.current === 'vertical') {
      if (dragY > 55) {
        setIsLandscapeStageOpen(false);
        setManualRotate(null);
      }
    }
    startCoords.current = null;
    activeDirection.current = null;
    setDragX(0);
    setDragY(0);
  };

  // Dimensions & rotation style: Inner container rotates 90deg centered on screen on mobile portrait
  const innerStageStyle: React.CSSProperties = shouldRotate
    ? {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: `${windowDimensions.height}px`,
        height: `${windowDimensions.width}px`,
        transform: 'translate(-50%, -50%) rotate(90deg)',
        overflow: 'hidden',
      }
    : {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      };

  // Stage effective viewport dimensions
  const stageH = shouldRotate ? windowDimensions.width : windowDimensions.height;
  const stageW = shouldRotate ? windowDimensions.height : windowDimensions.width;

  // Split-screen Case 1 (Left column cube calculation - scaled ~20% larger):
  const leftColWidth = Math.min(340, Math.max(190, Math.floor(stageW * 0.38)));
  const availableVerticalForCube = Math.max(60, stageH - 150);
  const availableWidthForCube = Math.max(60, leftColWidth - 24);
  // Capped at 155px (+23% larger) so image, title, controls & rectangular bar are prominent
  const cubeSize = Math.floor(Math.min(availableWidthForCube * 0.85, availableVerticalForCube * 0.78, 155));

  // Centered Case 2 (no lyrics - scaled ~20% larger):
  const centerAvailableVertical = Math.max(60, stageH - 150);
  const centerAvailableWidth = Math.max(60, stageW - 48);
  // Capped at 165px (+25% larger)
  const centerCubeSize = Math.floor(Math.min(centerAvailableWidth * 0.30, centerAvailableVertical * 0.78, 165));

  return (
    <AnimatePresence>
      {isLandscapeStageOpen && (
        <motion.div
          key="landscape-stage-player"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 w-full h-full z-[9999] overflow-hidden bg-[#09090b] text-white select-none pointer-events-auto"
        >
          <div
            style={innerStageStyle}
            className="flex flex-col overflow-hidden select-none bg-[#09090b]"
          >
            {/* Ambient blurred colorful cinematic background directly matching album art */}
            <div
              className="absolute inset-0 opacity-40 blur-3xl pointer-events-none -z-10 transition-all duration-1000 scale-125"
              style={{
                backgroundImage: `url(${thumbSrc})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/85 pointer-events-none -z-10" />

            {/* MINIMAL TOP BAR */}
            <header className="flex-shrink-0 h-10 px-4 sm:px-6 flex items-center justify-between border-b border-white/5 backdrop-blur-md bg-black/30 z-20">
            {/* Left: Exit Full Screen */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsLandscapeStageOpen(false);
                  setManualRotate(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white transition-all text-xs font-bold cursor-pointer"
                title="Exit Full Screen"
              >
                <Minimize2 className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">Exit</span>
              </button>

              {/* In-app orientation toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = !shouldRotate;
                  setManualRotate(next);
                }}
                className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                title="Switch Horizontal Rotation"
              >
                <Smartphone className="w-3 h-3 rotate-90" />
              </button>
            </div>

            {/* Right Actions: Stage Lyrics Toggle + Sleep Timer */}
            <div className="flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => {
                  if (!hasLyrics) return;
                  setStageLyricsOn((prev) => !prev);
                }}
                disabled={!hasLyrics}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  showLyrics
                    ? 'bg-white text-black shadow-md scale-105'
                    : hasLyrics
                    ? 'bg-white/10 text-white/70 hover:text-white hover:bg-white/15'
                    : 'bg-white/5 text-white/30 opacity-40 cursor-not-allowed'
                }`}
                title={showLyrics ? 'Hide Stage Lyrics' : 'Show Stage Lyrics'}
              >
                <FileText className="w-3 h-3" />
                <span className="hidden sm:inline">Lyrics</span>
              </button>

              {/* Sleep timer */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSleepMenuOpen(!isSleepMenuOpen)}
                  className={`p-1 rounded-full transition-colors relative cursor-pointer ${
                    sleepTimerRemaining !== null ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  title="Sleep Timer"
                >
                  <Moon className="w-3.5 h-3.5" />
                  {sleepTimerRemaining !== null && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white text-black text-[7px] font-black flex items-center justify-center">
                      {Math.ceil(sleepTimerRemaining / 60)}
                    </span>
                  )}
                </button>

                {isSleepMenuOpen && (
                  <div className="absolute right-0 top-8 w-40 bg-[#18181b] rounded-2xl p-2 border border-white/15 shadow-2xl z-50 flex flex-col gap-1 text-xs font-semibold backdrop-blur-xl">
                    <span className="text-[9px] uppercase font-bold text-white/40 px-2.5 py-0.5">Sleep Timer</span>
                    {[5, 15, 30, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => { setSleepTimerMinutes(mins); setIsSleepMenuOpen(false); }}
                        className="px-2.5 py-1.5 text-left hover:bg-white/10 rounded-xl cursor-pointer"
                      >
                        {mins} minutes
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setSleepTimerEndOfSong(); setIsSleepMenuOpen(false); }}
                      className="px-2.5 py-1.5 text-left hover:bg-white/10 rounded-xl cursor-pointer"
                    >
                      End of song
                    </button>
                    {sleepTimerRemaining !== null && (
                      <button
                        type="button"
                        onClick={() => { cancelSleepTimer(); setIsSleepMenuOpen(false); }}
                        className="px-2.5 py-1.5 text-left text-red-400 hover:bg-red-500/10 rounded-xl border-t border-white/5 mt-0.5 cursor-pointer"
                      >
                        Turn off timer
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* MAIN STAGE CONTENT (Matching Image Layout) */}
          <main className="flex-1 flex overflow-hidden p-2 sm:p-4 gap-0">
            {showLyrics ? (
              /* CASE 1: Split Screen Layout (Left ~38%: Album Cube + Title + 3 Controls + Scrubber | Right ~62%: Centered Lyrics) */
              <div className="w-full h-full flex overflow-hidden">
                {/* Left Column: Cube Art + Title + Controls + Scrubber */}
                <div
                  style={{ width: `${leftColWidth}px` }}
                  className="h-full flex flex-col justify-center items-center px-2 sm:px-3 py-1 overflow-hidden flex-shrink-0 gap-1 sm:gap-1.5"
                >
                  {/* Perfect Cube Album Cover with Horizontal Swipe & Visual Feedback */}
                  <div className="w-full flex items-center justify-center flex-shrink-0 pt-1">
                    <motion.div
                      onTouchStart={handleArtTouchStart}
                      onTouchMove={handleArtTouchMove}
                      onTouchEnd={handleArtTouchEnd}
                      onMouseDown={handleArtTouchStart}
                      onMouseMove={handleArtTouchMove}
                      onMouseUp={handleArtTouchEnd}
                      style={{
                        width: `${cubeSize}px`,
                        height: `${cubeSize}px`,
                        minWidth: `${cubeSize}px`,
                        minHeight: `${cubeSize}px`,
                        maxWidth: `${cubeSize}px`,
                        maxHeight: `${cubeSize}px`,
                        aspectRatio: '1 / 1',
                        x: dragX,
                        y: dragY,
                        rotate: dragX * 0.04,
                        scale: 1 - Math.min(Math.abs(dragX) / 1000, 0.08),
                      }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      className="aspect-square rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-white/15 relative group cursor-grab active:cursor-grabbing mx-auto flex-shrink-0"
                      title="Swipe left/right to skip tracks, swipe down to exit"
                    >
                      <img
                        src={thumbSrc}
                        alt={activeTrack.title}
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_ART;
                        }}
                        className="w-full h-full object-cover aspect-square select-none pointer-events-none rounded-2xl"
                        style={{ aspectRatio: '1 / 1' }}
                        draggable={false}
                      />

                      {/* Visual Swipe Feedback Pill (Horizontal Skip or Vertical Exit) */}
                      {(dragX !== 0 || dragY > 0) && (
                        <div
                          className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${
                            Math.abs(dragX) > 20 || dragY > 20 ? 'bg-black/50' : 'opacity-0'
                          }`}
                        >
                          <div className="bg-black/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 shadow-2xl">
                            {dragY > 20 ? (
                              <>
                                <Minimize2 className="w-3.5 h-3.5 text-white" />
                                <span>Exit Full Screen</span>
                              </>
                            ) : dragX < 0 ? (
                              <>
                                <span>Next</span>
                                <SkipForward className="w-3.5 h-3.5 text-white" />
                              </>
                            ) : (
                              <>
                                <SkipBack className="w-3.5 h-3.5 text-white" />
                                <span>Previous</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </div>

                  {/* Title & Artist aligned under Cover Cube with neat proportions */}
                  <div
                    style={{ maxWidth: `${Math.max(cubeSize * 1.35, 200)}px` }}
                    className="text-center w-full px-1 flex flex-col items-center flex-shrink-0 mx-auto mt-3 sm:mt-3.5"
                  >
                    <h2 className="text-sm sm:text-base font-bold text-white truncate leading-tight w-full tracking-tight">
                      {activeTrack.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-white/50 font-medium truncate mt-0.5 w-full">
                      {activeTrack.artist}
                    </p>
                  </div>

                  {/* Minimal 3-Button Controls Deck: ONLY Previous, Play/Pause, Next */}
                  <div
                    style={{ maxWidth: `${Math.max(cubeSize * 1.35, 200)}px` }}
                    className="flex items-center justify-center gap-4 sm:gap-5 w-full flex-shrink-0 py-0.5 mt-2 sm:mt-2.5 mx-auto"
                  >
                    <button
                      type="button"
                      onClick={playPrevious}
                      className="p-1.5 text-white/70 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="Previous"
                    >
                      <SkipBack className="w-4 h-4 fill-current" />
                    </button>

                    {/* Circular White Play/Pause Button - prominent and sleek */}
                    <button
                      type="button"
                      onClick={togglePlay}
                      disabled={isBuffering}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white text-black flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer flex-shrink-0"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isBuffering ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="w-4 h-4 fill-black" />
                      ) : (
                        <Play className="w-4 h-4 fill-black ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={playNext}
                      className="p-1.5 text-white/70 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="Next"
                    >
                      <SkipForward className="w-4 h-4 fill-current" />
                    </button>
                  </div>

                  {/* Thick Rectangular Scrubber with subtle soft curve (No timestamps, no key points) */}
                  <StageThickScrubber
                    currentTime={currentTime}
                    duration={duration}
                    seekTo={seekTo}
                    shouldRotate={shouldRotate}
                    style={{ width: `${Math.min(Math.max(cubeSize * 1.25, 175), 235)}px` }}
                    className="mt-1.5 sm:mt-2"
                  />
                </div>

                {/* Right Column: Flowing Lyrics with generous top/bottom breathing room */}
                <div
                  ref={lyricsContainerRef}
                  className="flex-1 h-full overflow-y-auto pl-4 sm:pl-8 pr-4 sm:pr-8 scrollbar-none flex flex-col py-20 sm:py-28"
                  style={{
                    maskImage: 'linear-gradient(to bottom, transparent 0%, transparent 8%, black 25%, black 75%, transparent 92%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, transparent 8%, black 25%, black 75%, transparent 92%, transparent 100%)',
                  }}
                >
                  {currentLyrics.mode === 'synced' && Array.isArray(currentLyrics.lines) ? (
                    <div className="flex flex-col gap-3.5 sm:gap-4.5 py-12 text-left">
                      {(currentLyrics.lines as SyncedLyricsLine[]).map((line, idx) => {
                        const isActive = idx === activeLineIndex;
                        const isPassed = idx < activeLineIndex;
                        const isRtl = /[\u0600-\u06FF\u0750-\u077F]/.test(line.text);
                        const words = (line.text || '♪').split(/\s+/).filter(Boolean);

                        const nextLineTime = (currentLyrics.lines as SyncedLyricsLine[])[idx + 1]?.time;
                        const lineDur = (nextLineTime || line.time + 4) - line.time;
                        const elapsedInLine = Math.max(0, currentTime - line.time);
                        const lineProgress = Math.min(1, Math.max(0, elapsedInLine / Math.max(0.8, lineDur)));

                        return (
                          <p
                            key={idx}
                            ref={isActive ? activeLineRef : null}
                            onClick={() => seekTo(line.time)}
                            dir={isRtl ? 'rtl' : 'ltr'}
                            style={{
                              fontFamily: 'var(--lyrics-font, "Poppins", sans-serif)',
                              fontSize: 'calc(1.08em * var(--lyrics-font-scale, 1))',
                              fontStyle: 'var(--lyrics-font-style, normal)',
                              letterSpacing: 'var(--lyrics-letter-spacing, normal)',
                            }}
                            className={`lyric-line font-black text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed cursor-pointer transition-all duration-300 ${
                              isActive
                                ? 'active scale-[1.03] text-white opacity-100'
                                : isPassed
                                ? 'text-white/40 opacity-60'
                                : 'text-white/20 opacity-35 hover:opacity-75'
                            }`}
                          >
                            {words.map((word, wIdx) => {
                              let wordWipe = 0;
                              if (isPassed) wordWipe = 1;
                              else if (isActive) {
                                const wordStart = wIdx / words.length;
                                const wordEnd = (wIdx + 1) / words.length;
                                if (lineProgress >= wordEnd) wordWipe = 1;
                                else if (lineProgress <= wordStart) wordWipe = 0;
                                else wordWipe = (lineProgress - wordStart) / (wordEnd - wordStart);
                              }

                              return (
                                <span
                                  key={wIdx}
                                  className="lyric-word inline-block mr-2"
                                  style={{ '--w': wordWipe.toFixed(3) } as any}
                                >
                                  {word}
                                </span>
                              );
                            })}
                          </p>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontFamily: 'var(--lyrics-font, "Poppins", sans-serif)',
                        fontSize: 'calc(1.05rem * var(--lyrics-font-scale, 1))',
                      }}
                      className="whitespace-pre-wrap font-bold text-sm sm:text-base md:text-lg leading-relaxed text-white/80 py-12 my-auto"
                    >
                      {typeof currentLyrics.lines === 'string' ? currentLyrics.lines : 'Lyrics loading...'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* CASE 2: Centered Layout (No Lyrics or Lyrics Toggled Off) */
              <div className="w-full h-full flex flex-col items-center justify-center p-2 sm:p-3 mx-auto overflow-hidden">
                {/* Cube Cover in center */}
                <div className="w-full flex items-center justify-center flex-shrink-0">
                  <motion.div
                    onTouchStart={handleArtTouchStart}
                    onTouchMove={handleArtTouchMove}
                    onTouchEnd={handleArtTouchEnd}
                    onMouseDown={handleArtTouchStart}
                    onMouseMove={handleArtTouchMove}
                    onMouseUp={handleArtTouchEnd}
                    style={{
                      width: `${centerCubeSize}px`,
                      height: `${centerCubeSize}px`,
                      minWidth: `${centerCubeSize}px`,
                      minHeight: `${centerCubeSize}px`,
                      maxWidth: `${centerCubeSize}px`,
                      maxHeight: `${centerCubeSize}px`,
                      aspectRatio: '1 / 1',
                      x: dragX,
                      y: dragY,
                      rotate: dragX * 0.04,
                      scale: 1 - Math.min(Math.abs(dragX) / 1000, 0.08),
                    }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="aspect-square rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/20 flex-shrink-0 cursor-grab active:cursor-grabbing mx-auto relative"
                    title="Swipe left/right to skip tracks, swipe down to exit"
                  >
                    <img
                      src={thumbSrc}
                      alt={activeTrack.title}
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_ART;
                      }}
                      className="w-full h-full object-cover aspect-square select-none pointer-events-none rounded-2xl"
                      style={{ aspectRatio: '1 / 1' }}
                      draggable={false}
                    />

                    {/* Visual Swipe Feedback Pill (Horizontal Skip or Vertical Exit) */}
                    {(dragX !== 0 || dragY > 0) && (
                      <div
                        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${
                          Math.abs(dragX) > 20 || dragY > 20 ? 'bg-black/50' : 'opacity-0'
                        }`}
                      >
                        <div className="bg-black/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 shadow-2xl">
                          {dragY > 20 ? (
                            <>
                              <Minimize2 className="w-3.5 h-3.5 text-white" />
                              <span>Exit Full Screen</span>
                            </>
                          ) : dragX < 0 ? (
                            <>
                              <span>Next</span>
                              <SkipForward className="w-3.5 h-3.5 text-white" />
                            </>
                          ) : (
                            <>
                              <SkipBack className="w-3.5 h-3.5 text-white" />
                              <span>Previous</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Title & Artist under Cover Cube with neat proportions */}
                <div
                  style={{ maxWidth: `${Math.max(centerCubeSize * 1.4, 230)}px` }}
                  className="text-center mt-3 sm:mt-3.5 px-2 flex flex-col items-center w-full flex-shrink-0"
                >
                  <h2 className="text-sm sm:text-base font-bold text-white truncate leading-tight w-full">
                    {activeTrack.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-white/50 font-medium mt-0.5 truncate w-full">
                    {activeTrack.artist}
                  </p>
                </div>

                {/* Minimal 3 Controls under the title: Previous, Play/Pause, Next */}
                <div
                  style={{ maxWidth: `${Math.max(centerCubeSize * 1.4, 230)}px` }}
                  className="flex items-center justify-center gap-4 sm:gap-5 w-full mt-2 sm:mt-2.5 flex-shrink-0"
                >
                  <button
                    type="button"
                    onClick={playPrevious}
                    className="p-1.5 text-white/70 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    title="Previous"
                  >
                    <SkipBack className="w-4 h-4 fill-current" />
                  </button>

                  <button
                    type="button"
                    onClick={togglePlay}
                    disabled={isBuffering}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white text-black flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer flex-shrink-0"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isBuffering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-4 h-4 fill-black" />
                    ) : (
                      <Play className="w-4 h-4 fill-black ml-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={playNext}
                    className="p-1.5 text-white/70 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    title="Next"
                  >
                    <SkipForward className="w-4 h-4 fill-current" />
                  </button>
                </div>

                {/* Thick Rectangular Scrubber with subtle soft curve (No timestamps, no key points) */}
                <StageThickScrubber
                  currentTime={currentTime}
                  duration={duration}
                  seekTo={seekTo}
                  shouldRotate={shouldRotate}
                  style={{ width: `${Math.min(Math.max(centerCubeSize * 1.25, 185), 250)}px` }}
                  className="mt-2 sm:mt-2.5"
                />
              </div>
            )}
          </main>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
