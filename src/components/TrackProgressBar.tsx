import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import { Flame } from 'lucide-react';
import { SongHighlight } from '../types';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

interface TrackProgressBarProps {
  currentTime: number;
  duration: number;
  highlights: SongHighlight[];
  seekTo: (time: number) => void;
  className?: string;
  isLandscape?: boolean;
  inlineTimestamps?: boolean;
  hideBadges?: boolean;
}

export const TrackProgressBar: React.FC<TrackProgressBarProps> = ({
  currentTime,
  duration,
  highlights,
  seekTo,
  className = '',
  isLandscape = false,
  inlineTimestamps = false,
  hideBadges = false,
}) => {
  const { userProfile, isPlaying } = useMusic();
  const style = userProfile.progressBarStyle || 'default';
  const keyPartsMode = userProfile.keyPartsDisplay || 'dots';
  const barColor = userProfile.customProgressBarHex || userProfile.progressBarColor || '#ffffff';

  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const lastCommitTimeRef = useRef(0);
  const lastCommittedValueRef = useRef<number | null>(null);
  const isPointerDownRef = useRef(false);

  const displayTime = isDragging && dragValue !== null ? dragValue : currentTime;
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  const commitSeek = (targetSec: number) => {
    const now = Date.now();
    setIsDragging(false);
    setDragValue(null);
    isPointerDownRef.current = false;
    // Strictly deduplicate seek invocations within 350ms
    if (
      lastCommittedValueRef.current !== null &&
      Math.abs(lastCommittedValueRef.current - targetSec) < 0.35 &&
      now - lastCommitTimeRef.current < 350
    ) {
      return;
    }
    lastCommitTimeRef.current = now;
    lastCommittedValueRef.current = targetSec;
    seekTo(targetSec);
  };

  const handlePointerDown = () => {
    isPointerDownRef.current = true;
    setIsDragging(true);
  };

  const handleSliderInput = (e: React.FormEvent<HTMLInputElement>) => {
    isPointerDownRef.current = true;
    setIsDragging(true);
    setDragValue(Number((e.target as HTMLInputElement).value));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    // If pointer is already up or this was keyboard/discrete change, commit
    if (!isPointerDownRef.current) {
      commitSeek(val);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    const val = Number((e.target as HTMLInputElement).value);
    isPointerDownRef.current = false;
    commitSeek(val);
  };

  // Smooth Wavy Slider animation using direct SVG DOM ref updates (zero React re-render lag)
  const wavePathRef = useRef<SVGPathElement>(null);
  const waveUnplayedPathRef = useRef<SVGPathElement>(null);
  const phaseRef = useRef(0);

  // Wavy geometry: smooth, flowing sine waves
  const width = 300;
  const height = 28;
  const midY = height / 2;
  const wavelength = 34;
  const amplitude = 8;

  useEffect(() => {
    if (style !== 'wave') return;

    let animId: number;
    let lastTime = performance.now();

    const renderWave = (currentPhase: number) => {
      const playedW = (progressPct / 100) * width;

      // Draw played animated sine wave with flowing crests, seamlessly tapering to baseline at playhead
      let d = `M 0 ${midY.toFixed(1)}`;
      const step = 2;
      for (let x = 0; x <= playedW; x += step) {
        const leadTaper = x < 8 ? x / 8 : 1;
        const tailTaper = playedW - x < 12 ? Math.max(0, (playedW - x) / 12) : 1;
        const env = leadTaper * tailTaper;
        const y = midY + Math.sin((x / wavelength) * Math.PI * 2 - currentPhase) * amplitude * env;
        d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      // Guarantee exact baseline connection at playedW
      d += ` L ${playedW.toFixed(1)} ${midY.toFixed(1)}`;

      if (wavePathRef.current) {
        wavePathRef.current.setAttribute('d', d);
      }

      if (waveUnplayedPathRef.current) {
        const unplayedD = `M ${playedW.toFixed(1)} ${midY.toFixed(1)} L ${width} ${midY.toFixed(1)}`;
        waveUnplayedPathRef.current.setAttribute('d', unplayedD);
      }
    };

    // Initial render
    renderWave(phaseRef.current);

    if (!isPlaying) return;

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      phaseRef.current = (phaseRef.current + dt * 4.2) % (Math.PI * 2);
      renderWave(phaseRef.current);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [style, isPlaying, progressPct]);

  const progressBarTrack = (
    <div className="relative w-full flex items-center h-7">
      {/* Style 1: Default / Classic Slim */}
      {style === 'default' && (
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={displayTime}
          step={0.1}
          onPointerDown={handlePointerDown}
          onInput={handleSliderInput}
          onChange={handleSliderChange}
          onPointerUp={handlePointerUp}
          className="custom-slider w-full show-thumb cursor-pointer"
          style={{
            height: '3.5px',
            background: `linear-gradient(to right, ${barColor} ${progressPct}%, rgba(255, 255, 255, 0.22) ${progressPct}%)`,
          }}
        />
      )}

      {/* Style 2: Block / Thick Rectangular with subtle crisp rounded corners */}
      {style === 'block' && (
        <div className="relative w-full h-4.5 bg-white/15 rounded-md overflow-hidden flex items-center cursor-pointer shadow-inner border border-white/10">
          <div
            className="h-full rounded-sm transition-all duration-75 relative shadow-[0_0_12px_rgba(255,255,255,0.25)]"
            style={{
              width: `${progressPct}%`,
              backgroundColor: barColor,
            }}
          >
            {/* Front crisp leading edge */}
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/40 rounded-r-sm shadow-sm" />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={displayTime}
            step={0.1}
            onPointerDown={handlePointerDown}
            onInput={handleSliderInput}
            onChange={handleSliderChange}
            onPointerUp={handlePointerUp}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
          />
        </div>
      )}

      {/* Style 3: Wave / Big Animated Sine Wave (No playhead dot - position purely via wave progress) */}
      {style === 'wave' && (
        <div className="relative w-full h-7 flex items-center cursor-pointer">
          <svg
            viewBox="0 0 300 28"
            preserveAspectRatio="none"
            className="w-full h-full pointer-events-none overflow-visible"
          >
            {/* Unplayed straight baseline */}
            <path
              ref={waveUnplayedPathRef}
              d={`M ${(progressPct / 100) * width} ${midY} L ${width} ${midY}`}
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Played flowing sine wave */}
            <path
              ref={wavePathRef}
              d={`M 0 ${midY}`}
              fill="none"
              stroke={barColor}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 6px ${barColor}80)` }}
            />
          </svg>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={displayTime}
            step={0.1}
            onPointerDown={handlePointerDown}
            onInput={handleSliderInput}
            onChange={handleSliderChange}
            onPointerUp={handlePointerUp}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
          />
        </div>
      )}

      {/* Style 4: Neon / Aurora Liquid Glow Enhanced with Ultra-Vibrant Shine */}
      {(style === 'aurora' || style === 'neon') && (
        <div className="relative w-full h-3.5 bg-black/60 rounded-full overflow-hidden flex items-center cursor-pointer backdrop-blur-md border border-white/20 shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]">
          <div
            className="h-full rounded-full transition-all duration-75 relative"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${barColor}80, ${barColor}, #ffffff)`,
              boxShadow: `0 0 16px ${barColor}, 0 0 30px ${barColor}80`,
            }}
          >
            {/* Luminous Glowing Pulse Head */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 -mr-1 rounded-full bg-white flex items-center justify-center"
              style={{
                boxShadow: `0 0 12px #ffffff, 0 0 24px ${barColor}`,
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: barColor }}
              />
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={displayTime}
            step={0.1}
            onPointerDown={handlePointerDown}
            onInput={handleSliderInput}
            onChange={handleSliderChange}
            onPointerUp={handlePointerUp}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
          />
        </div>
      )}

      {/* BUILT-IN KEY MOMENTS PREVIEW (Miniature progress milestone indicator) */}
      {style === 'default' &&
        keyPartsMode !== 'off' &&
        duration > 0 &&
        highlights.map((hl) => {
          const leftPct = (hl.startTime / duration) * 100;
          return (
            <div
              key={hl.id}
              style={{ left: `${leftPct}%` }}
              className="group absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center"
            >
              {/* Miniature Milestone Indicator Bar */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  seekTo(hl.startTime);
                }}
                className="w-2.5 h-3.5 rounded-sm bg-white/70 hover:bg-white active:scale-125 hover:shadow-[0_0_8px_rgba(255,255,255,0.9)] cursor-pointer transition-all border border-black/40 flex items-center justify-center"
                title={`${hl.label} (${formatTime(hl.startTime)})`}
              >
                <div className="w-0.5 h-2 bg-black/60 rounded-full" />
              </button>

              {/* Mini hover milestone pill */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1 px-1.5 py-0.5 rounded bg-black/90 text-[8px] font-bold text-white border border-white/20 whitespace-nowrap pointer-events-none shadow-lg">
                {hl.label} {formatTime(hl.startTime)}
              </div>
            </div>
          );
        })}
    </div>
  );

  return (
    <div className={`w-full flex flex-col gap-0.5 select-none no-swipe ${className}`}>
      {/* Optional Top Key Moment Pills (Strictly shown ONLY on default classic progress bar) */}
      {!hideBadges && style === 'default' && keyPartsMode === 'full' && highlights.length > 0 && (
        <div className="flex items-center justify-center gap-1 overflow-x-auto scrollbar-none py-0.5 mb-0.5">
          <span className="text-[8px] uppercase font-bold text-white/40 flex items-center gap-0.5 flex-shrink-0 mr-0.5">
            <Flame className="w-2.5 h-2.5 text-white/70 fill-white/70" />
            <span>Key:</span>
          </span>
          {highlights.map((hl) => (
            <button
              key={hl.id}
              type="button"
              onClick={() => {
                seekTo(hl.startTime);
              }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-[8px] font-bold transition-all cursor-pointer flex-shrink-0"
            >
              <span>{hl.label}</span>
              <span className="opacity-50 font-mono">({formatTime(hl.startTime)})</span>
            </button>
          ))}
        </div>
      )}

      {/* Inline layout (for desktop PlayerBar) vs Vertical Stack (for full screen) */}
      {inlineTimestamps ? (
        <div className="w-full flex items-center gap-3 text-xs font-semibold text-white/40 tabular-nums">
          <span className="w-9 text-right flex-shrink-0">{formatTime(currentTime)}</span>
          <div className="relative flex-1 flex items-center">{progressBarTrack}</div>
          <span className="w-9 text-left flex-shrink-0">{formatTime(duration)}</span>
        </div>
      ) : (
        <>
          {progressBarTrack}
          {/* Timestamps beneath */}
          <div className="flex justify-between text-[10px] font-semibold text-white/50 tabular-nums px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </>
      )}
    </div>
  );
};
