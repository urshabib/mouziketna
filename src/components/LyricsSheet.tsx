import React, { useEffect, useRef, useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { ChevronDown, RefreshCw, Loader2, Music2, ArrowDownCircle, Sparkles } from 'lucide-react';
import { SyncedLyricsLine } from '../types';
import { LyricsPlus } from './AiLyricsReel';

export const LyricsSheet: React.FC = () => {
  const {
    activeTrack,
    currentTime,
    seekTo,
    isLyricsOpen,
    setIsLyricsOpen,
    currentLyrics,
    retryLyrics,
  } = useMusic();

  const bodyRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement | null>(null);

  // Lyrics+ mode toggle (default off, switches to ultra motion lyrics with embedded emojis)
  const [isLyricsPlusActive, setIsLyricsPlusActive] = useState<boolean>(false);

  const handleToggleLyricsPlus = () => {
    setIsLyricsPlusActive((prev) => !prev);
  };

  // User navigation state & 3s idle return timer
  const [isUserNavigating, setIsUserNavigating] = useState(false);
  const idleTimerRef = useRef<any>(null);

  // Top header swipe-down dismiss gesture
  const headerTouchStart = useRef<number | null>(null);
  const [headerDragY, setHeaderDragY] = useState(0);

  // Find active line index
  const activeLineIndex = React.useMemo(() => {
    if (currentLyrics.mode !== 'synced' || !Array.isArray(currentLyrics.lines)) {
      return -1;
    }
    const lines = currentLyrics.lines as SyncedLyricsLine[];
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [currentLyrics, currentTime]);

  // Smooth scroll active lyric line into view ONLY when not actively navigating
  useEffect(() => {
    if (!isUserNavigating && activeLineRef.current && isLyricsOpen) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex, isLyricsOpen, isUserNavigating]);

  // Register user scroll/swipe inside lyrics body
  const handleUserScroll = () => {
    setIsUserNavigating(true);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      setIsUserNavigating(false);
      if (activeLineRef.current) {
        activeLineRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 3000);
  };

  const resumeSyncNow = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    setIsUserNavigating(false);
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Header swipe down handlers (isolated to the top non-lyrics section)
  const handleHeaderTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    headerTouchStart.current = clientY;
  };

  const handleHeaderTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (headerTouchStart.current === null) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const diff = clientY - headerTouchStart.current;
    if (diff > 0) {
      setHeaderDragY(diff);
    }
  };

  const handleHeaderTouchEnd = () => {
    if (headerDragY > 70) {
      setIsLyricsOpen(false);
    }
    headerTouchStart.current = null;
    setHeaderDragY(0);
  };

  if (!isLyricsOpen || !activeTrack) return null;

  return (
    <div
      style={{
        transform: headerDragY > 0 ? `translateY(${headerDragY}px)` : undefined,
        transition: headerDragY === 0 ? 'transform 0.25s ease-out' : 'none',
      }}
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#1c1208] via-black to-black text-white px-5 sm:px-8 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] select-none"
    >
      {/* Top Header & Grab Section (Only section that handles swipe-down to dismiss) */}
      <div
        onTouchStart={handleHeaderTouchStart}
        onTouchMove={handleHeaderTouchMove}
        onTouchEnd={handleHeaderTouchEnd}
        onMouseDown={handleHeaderTouchStart}
        onMouseMove={handleHeaderTouchMove}
        onMouseUp={handleHeaderTouchEnd}
        className="w-full max-w-2xl mx-auto flex-shrink-0 cursor-grab active:cursor-grabbing pb-3 touch-none select-none border-b border-white/10"
      >
        {/* Swipe Handle Indicator */}
        <div className="flex justify-center pt-1 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-white/30" />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsLyricsOpen(false)}
            className="p-2 -ml-2 text-white/70 hover:text-white transition-colors"
            title="Close Lyrics"
          >
            <ChevronDown className="w-7 h-7" />
          </button>

          <div className="text-center min-w-0 flex-1 px-4">
            <h4 className="text-sm font-black text-white truncate">{activeTrack.title}</h4>
            <p className="text-xs text-white/50 truncate font-semibold mt-0.5">{activeTrack.artist}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Catchy, modern Lyrics+ Ultra Motion toggle */}
            <button
              type="button"
              onClick={handleToggleLyricsPlus}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm ${
                isLyricsPlusActive
                  ? 'bg-gradient-to-r from-[#ff6b1a] via-amber-500 to-orange-400 text-black shadow-[0_0_15px_rgba(255,107,26,0.6)] scale-105'
                  : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/10'
              }`}
              title={isLyricsPlusActive ? 'Switch to Standard Lyrics' : 'Switch to Lyrics+ Ultra Motion'}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isLyricsPlusActive ? 'fill-black text-black' : 'text-[#ff6b1a]'}`} />
              <span className="tracking-wide">Lyrics+</span>
              <span
                className={`text-[9px] px-1 py-0.5 rounded font-extrabold uppercase leading-none tracking-wider ${
                  isLyricsPlusActive ? 'bg-black/25 text-black' : 'bg-[#ff6b1a]/25 text-[#ff6b1a]'
                }`}
              >
                Ultra
              </span>
            </button>

            <button
              onClick={retryLyrics}
              className="p-2 text-white/50 hover:text-white transition-colors cursor-pointer"
              title="Refresh Lyrics"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Lyrics+ Ultra Motion Mode */}
      {isLyricsPlusActive ? (
        <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col relative overflow-hidden py-2">
          <LyricsPlus
            activeTrack={activeTrack}
            currentTime={currentTime}
            syncedLines={currentLyrics.mode === 'synced' && Array.isArray(currentLyrics.lines) ? currentLyrics.lines : []}
            onSeek={(time) => {
              seekTo(time);
              resumeSyncNow();
            }}
          />
        </div>
      ) : (
        /* Classic Lyrics Body (Protected from swipe dismiss so user can scroll up/down freely) */
        <div
          ref={bodyRef}
          onScroll={handleUserScroll}
          onTouchMove={handleUserScroll}
          onWheel={handleUserScroll}
          className="flex-1 overflow-y-auto max-w-2xl w-full mx-auto py-8 sm:py-12 px-2 flex flex-col gap-6 relative"
        >
        {currentLyrics.mode === 'loading' && (
          <div className="flex flex-col items-center justify-center my-auto gap-3 text-white/50">
            <Loader2 className="w-8 h-8 animate-spin text-[#ff6b1a]" />
            <p className="font-semibold text-sm">Synchronizing lyrics…</p>
          </div>
        )}

        {currentLyrics.mode === 'error' && (
          <div className="flex flex-col items-center justify-center my-auto gap-4 text-center">
            <p className="text-white/60 font-medium text-sm">Couldn't load lyrics right now.</p>
            <button
              onClick={retryLyrics}
              className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {currentLyrics.mode === 'none' && (
          <div className="flex flex-col items-center justify-center my-auto gap-4 text-center">
            <Music2 className="w-12 h-12 text-white/20" />
            <p className="text-white/50 font-medium text-sm">No lyrics found for this song.</p>
            <button
              onClick={retryLyrics}
              className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
            >
              Search Again
            </button>
          </div>
        )}

        {currentLyrics.mode === 'plain' && typeof currentLyrics.lines === 'string' && (
          <div
            style={{
              fontFamily: 'var(--lyrics-font, "Poppins", sans-serif)',
              fontSize: 'calc(1.125rem * var(--lyrics-font-scale, 1))',
              fontStyle: 'var(--lyrics-font-style, normal)',
              letterSpacing: 'var(--lyrics-letter-spacing, normal)',
            }}
            className="whitespace-pre-wrap font-semibold leading-relaxed text-white/80 py-6"
          >
            {currentLyrics.lines}
          </div>
        )}

        {currentLyrics.mode === 'synced' && Array.isArray(currentLyrics.lines) && (
          <div className="flex flex-col gap-5 py-8">
            {(currentLyrics.lines as SyncedLyricsLine[]).map((line, idx) => {
              const isActive = idx === activeLineIndex;
              const isPassed = idx < activeLineIndex;
              const isRtl = /[\u0600-\u06FF\u0750-\u077F]/.test(line.text);
              const words = (line.text || '♪').split(/\s+/).filter(Boolean);

              // Calculate word-by-word wipe if active
              const nextLineTime = (currentLyrics.lines as SyncedLyricsLine[])[idx + 1]?.time;
              const lineDur = (nextLineTime || line.time + 4) - line.time;
              const elapsedInLine = Math.max(0, currentTime - line.time);
              const lineProgress = Math.min(1, Math.max(0, elapsedInLine / Math.max(0.8, lineDur)));

              return (
                <p
                  key={idx}
                  ref={isActive ? (activeLineRef as any) : null}
                  onClick={() => {
                    seekTo(line.time);
                    resumeSyncNow();
                  }}
                  dir={isRtl ? 'rtl' : 'ltr'}
                  style={{
                    fontFamily: 'var(--lyrics-font, "Poppins", sans-serif)',
                    fontSize: 'calc(1em * var(--lyrics-font-scale, 1))',
                    fontStyle: 'var(--lyrics-font-style, normal)',
                    letterSpacing: 'var(--lyrics-letter-spacing, normal)',
                  }}
                  className={`lyric-line font-extrabold text-xl sm:text-2xl md:text-3xl leading-snug cursor-pointer transition-all duration-300 ${
                    isActive
                      ? 'active scale-[1.03] text-white opacity-100'
                      : isPassed
                      ? 'text-white/50 opacity-70'
                      : 'text-white/30 opacity-40 hover:opacity-75'
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
        )}

        {/* Source attribution */}
        <div className="text-center text-xs text-white/30 pt-8 pb-4">
          Lyrics powered by LRCLIB & Lyrics+
        </div>
      </div>
      )}

      {/* Synchronizing pill button appears while user is manually navigating */}
      {isUserNavigating && currentLyrics.mode === 'synced' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={resumeSyncNow}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#ff6b1a] text-black font-extrabold text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all animate-bounce"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Syncing in 3s (Tap to jump)</span>
          </button>
        </div>
      )}
    </div>
  );
};
