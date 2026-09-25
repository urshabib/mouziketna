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

  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const displayTime = isDragging && dragValue !== null ? dragValue : currentTime;
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  const handleSliderInput = (e: React.FormEvent<HTMLInputElement>) => {
    setIsDragging(true);
    setDragValue(Number((e.target as HTMLInputElement).value));
  };

  const handleSliderCommit = (e: React.ChangeEvent<HTMLInputElement> | React.PointerEvent<HTMLInputElement>) => {
    const val = Number((e.target as HTMLInputElement).value);
    seekTo(val);
    setIsDragging(false);
    setDragValue(null);
  };

  // Ultra-smooth 60fps/120fps Wavy Slider animation using direct SVG DOM ref updates (zero React re-render lag)
  const wavePathRef = useRef<SVGPathElement>(null);
  const waveUnplayedPathRef = useRef<SVGPathElement>(null);
  const waveThumbRef = useRef<SVGCircleElement>(null);
  const phaseRef = useRef(0);

  // Wavy geometry: big, smooth, circular loops inspired by Mahozad's wavy-slider / Android 13
  const width = 300;
  const height = 28;
  const midY = height / 2;
  const wavelength = 38; // Wide, circular crests and troughs
  const amplitude = 8; // Prominent large wave loops

  useEffect(() => {
    if (style !== 'wave') return;

    let animId: number;
    let lastTime = performance.now();

    const renderWave = (currentPhase: number) => {
      const playedW = (progressPct / 100) * width;

      // Draw played animated sine wave with prominent circular crests
      let d = `M 0 ${midY.toFixed(1)}`;
      const step = 2;
      for (let x = 0; x <= playedW; x += step) {
        const y = midY + Math.sin((x / wavelength) * Math.PI * 2 - currentPhase) * amplitude;
        d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      if (playedW > 0) {
        const endY = midY + Math.sin((playedW / wavelength) * Math.PI * 2 - currentPhase) * amplitude;
        d += ` L ${playedW.toFixed(1)} ${endY.toFixed(1)}`;
      }

      if (wavePathRef.current) {
        wavePathRef.current.setAttribute('d', d);
      }

      if (waveUnplayedPathRef.current) {
        const unplayedD = `M ${playedW.toFixed(1)} ${midY.toFixed(1)} L ${width} ${midY.toFixed(1)}`;
        waveUnplayedPathRef.current.setAttribute('d', unplayedD);
      }

      if (waveThumbRef.current) {
        const thumbY =
          playedW > 0
            ? midY + Math.sin((playedW / wavelength) * Math.PI * 2 - currentPhase) * amplitude
            : midY;
        waveThumbRef.current.setAttribute('cx', playedW.toFixed(1));
        waveThumbRef.current.setAttribute('cy', thumbY.toFixed(1));
      }
    };

    // Initial render
    renderWave(phaseRef.current);

    if (!isPlaying) return;

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      // Smooth continuous velocity
      phaseRef.current = (phaseRef.current + dt * 5.2) % (Math.PI * 2);
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
          onInput={handleSliderInput}
          onChange={handleSliderCommit}
          onPointerUp={handleSliderCommit}
          className="custom-slider w-full show-thumb cursor-pointer"
          style={{
            height: '3px',
            background: `linear-gradient(to right, #ffffff ${progressPct}%, rgba(255, 255, 255, 0.22) ${progressPct}%)`,
          }}
        />
      )}

      {/* Style 2: Block / Modern Capsule Thick Bar */}
      {style === 'block' && (
        <div className="relative w-full h-3 bg-white/20 rounded-full overflow-hidden flex items-center cursor-pointer shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-white/90 to-white rounded-full transition-all duration-75 relative"
            style={{ width: `${progressPct}%` }}
          >
            {/* Front leading edge */}
            <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-white rounded-r-full" />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={displayTime}
            step={0.1}
            onInput={handleSliderInput}
            onChange={handleSliderCommit}
            onPointerUp={handleSliderCommit}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
          />
        </div>
      )}

      {/* Style 3: Wave / Big Animated Sine Wave Squiggle (Android 13 / Apple Music style) */}
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
              stroke="rgba(255, 255, 255, 0.28)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Played big circular sine wave */}
            <path
              ref={wavePathRef}
              d={`M 0 ${midY}`}
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Prominent circular thumb riding on top of the wave */}
            <circle
              ref={waveThumbRef}
              cx={(progressPct / 100) * width}
              cy={midY}
              r="6.5"
              fill="#ffffff"
              className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            />
          </svg>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={displayTime}
            step={0.1}
            onInput={handleSliderInput}
            onChange={handleSliderCommit}
            onPointerUp={handleSliderCommit}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
          />
        </div>
      )}

      {/* Style 4: Neon Laser / Glowing Radiant Beam */}
      {style === 'neon' && (
        <div className="relative w-full h-2.5 bg-white/15 rounded-full overflow-hidden flex items-center cursor-pointer">
          <div
            className="h-full bg-gradient-to-r from-white/70 via-white to-white rounded-full transition-all duration-75 relative"
            style={{ width: `${progressPct}%` }}
          >
            {/* Laser head */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 -mr-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={displayTime}
            step={0.1}
            onInput={handleSliderInput}
            onChange={handleSliderCommit}
            onPointerUp={handleSliderCommit}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
          />
        </div>
      )}

      {/* BUILT-IN KEY MOMENTS MARKERS (Clean, subtle, non-glowy, semi-transparent rectangles embedded into the track) */}
      {keyPartsMode !== 'off' &&
        duration > 0 &&
        highlights.map((hl) => {
          const leftPct = (hl.startTime / duration) * 100;
          return (
            <button
              key={hl.id}
              type="button"
              style={{ left: `${leftPct}%` }}
              onClick={(e) => {
                e.stopPropagation();
                seekTo(hl.startTime);
              }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-3 rounded-[1.5px] bg-white/40 hover:bg-white/80 active:bg-white cursor-pointer transition-colors z-20 pointer-events-auto shadow-none border-none outline-none"
              title={`${hl.label} (${formatTime(hl.startTime)})`}
            />
          );
        })}
    </div>
  );

  return (
    <div className={`w-full flex flex-col gap-0.5 select-none no-swipe ${className}`}>
      {/* Optional Top Key Moment Pills (only if setting is 'full' and not hidden) */}
      {!hideBadges && keyPartsMode === 'full' && highlights.length > 0 && (
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
