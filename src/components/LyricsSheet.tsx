import React, { useEffect, useRef } from 'react';
import { useMusic } from '../context/MusicContext';
import { ChevronDown, RefreshCw, Loader2, Music2 } from 'lucide-react';
import { SyncedLyricsLine } from '../types';

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

  // Smooth scroll active lyric line into view
  useEffect(() => {
    if (activeLineRef.current && isLyricsOpen) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex, isLyricsOpen]);

  if (!isLyricsOpen || !activeTrack) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#1c1208] via-black to-black text-white px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom-6 duration-300 select-none">
      {/* Header */}
      <div className="flex items-center justify-between max-w-2xl w-full mx-auto pb-4 border-b border-white/10">
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

        <button
          onClick={retryLyrics}
          className="p-2 text-white/50 hover:text-white transition-colors"
          title="Refresh Lyrics"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Lyrics Body */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto max-w-2xl w-full mx-auto py-12 px-2 flex flex-col gap-6"
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
                  onClick={() => seekTo(line.time)}
                  dir={isRtl ? 'rtl' : 'ltr'}
                  style={{
                    fontFamily: 'var(--lyrics-font, "Poppins", sans-serif)',
                    fontSize: 'calc(1em * var(--lyrics-font-scale, 1))',
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
                    // Estimated per-word wipe
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
    </div>
  );
};
