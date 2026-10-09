import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SyncedLyricsLine, Track } from '../types';
import {
  generateLyricsPlusPlan,
  getOfflineLyricsPlusPlan,
  ReelDirectorPlan,
  ReelWord,
} from '../services/aiLyricsReel';

interface LyricsPlusProps {
  activeTrack: Track;
  currentTime: number;
  syncedLines: SyncedLyricsLine[];
  onSeek: (time: number) => void;
  dominantColor?: { r: number; g: number; b: number };
}

/**
 * LYRICS+ ULTRA MOTION COMPONENT
 * Focused 100% on the lyrics experience:
 * - Ultra-responsive word-by-word synchronized kinetic typography
 * - Dynamic emojis placed right inside the lyrics text alongside the words
 * - Clean, distraction-free view (no background sketches, no dropping particles)
 * - 100% offline capability (works instantly anywhere without internet or AI keys)
 */
export const LyricsPlus: React.FC<LyricsPlusProps> = ({
  activeTrack,
  currentTime,
  syncedLines,
  onSeek,
  dominantColor,
}) => {
  const [plan, setPlan] = useState<ReelDirectorPlan | null>(null);
  const [resolvedColor, setResolvedColor] = useState<{ r: number; g: number; b: number }>(dominantColor || { r: 255, g: 107, b: 26 });

  useEffect(() => {
    if (dominantColor) {
      setResolvedColor(dominantColor);
      return;
    }
    try {
      const rgbStr = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
      if (rgbStr && rgbStr.includes(',')) {
        const [r, g, b] = rgbStr.split(',').map((v) => parseInt(v.trim(), 10));
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
          setResolvedColor({ r, g, b });
          return;
        }
      }
    } catch {}
    setResolvedColor({ r: 255, g: 107, b: 26 });
  }, [dominantColor]);

  // Generate or load offline plan instantly (0ms)
  useEffect(() => {
    if (!activeTrack || syncedLines.length === 0) {
      setPlan(null);
      return;
    }

    // Try offline cached plan first, then instant procedural plan
    const offlinePlan = getOfflineLyricsPlusPlan(activeTrack.id);
    if (offlinePlan) {
      setPlan(offlinePlan);
    } else {
      const generated = generateLyricsPlusPlan(activeTrack.id, syncedLines);
      setPlan(generated);
    }
  }, [activeTrack?.id, syncedLines]);

  // Find active line based on currentTime
  const currentLineIndex = useMemo(() => {
    if (!plan || plan.lines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < plan.lines.length; i++) {
      if (plan.lines[i].time <= currentTime) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [plan, currentTime]);

  const activeLine = currentLineIndex >= 0 && plan ? plan.lines[currentLineIndex] : null;

  // Find active word index inside the active line
  const activeWordIndex = useMemo(() => {
    if (!activeLine || activeLine.words.length === 0) return -1;
    let wIdx = 0;
    for (let i = 0; i < activeLine.words.length; i++) {
      if (currentTime >= activeLine.words[i].startTime) {
        wIdx = i;
      } else {
        break;
      }
    }
    return wIdx;
  }, [activeLine, currentTime]);

  // Snappy, Well-Timed CSS Animation presets (0.16s - 0.20s for tight, flawless sync with singing)
  const getAnimationClass = (anim: ReelWord['anim']) => {
    switch (anim) {
      case 'pop_bounce':
        return 'animate-[popBounce_0.18s_cubic-bezier(0.16,1,0.3,1)_both]';
      case 'pulse_heartbeat':
        return 'animate-[pulseHeartbeat_0.20s_ease-out_both]';
      case 'fire_flare':
        return 'animate-[fireFlare_0.20s_ease-out_both]';
      case 'strobe_flash':
        return 'animate-[strobeFlash_0.18s_ease-out_both]';
      case 'slam_shake':
        return 'animate-[slamShake_0.20s_ease-out_both]';
      case 'neon_glitch':
        return 'animate-[neonGlitch_0.18s_ease-out_both]';
      case 'slide_up':
        return 'animate-[slideUp_0.18s_cubic-bezier(0.16,1,0.3,1)_both]';
      case 'slide_down':
        return 'animate-[slideDown_0.18s_cubic-bezier(0.16,1,0.3,1)_both]';
      case 'slide_left':
        return 'animate-[slideLeft_0.18s_cubic-bezier(0.16,1,0.3,1)_both]';
      case 'slide_right':
        return 'animate-[slideRight_0.18s_cubic-bezier(0.16,1,0.3,1)_both]';
      case 'spin_in':
        return 'animate-[spinIn_0.18s_cubic-bezier(0.16,1,0.3,1)_both]';
      case 'tilt_wave':
        return 'animate-[tiltWave_0.20s_ease-out_both]';
      case 'zoom_shatter':
        return 'animate-[zoomShatter_0.20s_ease-out_both]';
      case 'float_drift':
        return 'animate-[floatDrift_1.6s_ease-in-out_infinite]';
      case 'elastic_drop':
        return 'animate-[elasticDrop_0.20s_cubic-bezier(0.16,1,0.3,1)_both]';
      case 'glow_burst':
        return 'animate-[glowBurst_0.20s_ease-out_both]';
      case 'rubber_band':
        return 'animate-[rubberBand_0.20s_ease-out_both]';
      case 'typewriter':
        return 'animate-[typewriterPop_0.16s_ease-out_both]';
      case 'swing_sway':
        return 'animate-[swingSway_0.20s_ease-out_both]';
      case 'spiral_pop':
        return 'animate-[spiralPop_0.20s_ease-out_both]';
      default:
        return 'animate-[popBounce_0.18s_ease-out_both]';
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none bg-transparent">
      {/* Keyframes for Pure Kinetic Typography (Snappy, instant attack, perfectly timed) */}
      <style>{`
        @keyframes popBounce {
          0% { transform: scale(0.82) rotate(var(--word-rot, 0deg)); opacity: 0.7; }
          45% { transform: scale(1.18) rotate(var(--word-rot, 0deg)); opacity: 1; }
          100% { transform: scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes pulseHeartbeat {
          0% { transform: scale(0.85) rotate(var(--word-rot, 0deg)); opacity: 0.7; }
          40% { transform: scale(1.22) rotate(var(--word-rot, 0deg)); opacity: 1; }
          100% { transform: scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes fireFlare {
          0% { transform: scale(0.85) translateY(6px); opacity: 0.7; }
          40% { transform: scale(1.20) translateY(-2px); opacity: 1; filter: drop-shadow(0 0 15px #ff5500); }
          100% { transform: scale(1.10) translateY(0); opacity: 1; }
        }
        @keyframes strobeFlash {
          0% { transform: scale(0.85); opacity: 0.7; }
          40% { transform: scale(1.20); opacity: 1; filter: brightness(1.5) drop-shadow(0 0 15px #ffffff); }
          100% { transform: scale(1.10); opacity: 1; }
        }
        @keyframes slamShake {
          0% { transform: scale(1.25) rotate(calc(var(--word-rot, 0deg) + 3deg)); opacity: 0.8; }
          50% { transform: scale(0.96) rotate(calc(var(--word-rot, 0deg) - 2deg)); opacity: 1; }
          100% { transform: scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes neonGlitch {
          0% { transform: scale(0.85); opacity: 0.7; }
          45% { transform: scale(1.18) skewX(2deg); opacity: 1; }
          100% { transform: scale(1.10) skewX(0); opacity: 1; }
        }
        @keyframes slideUp {
          0% { transform: translateY(16px) scale(0.9) rotate(var(--word-rot, 0deg)); opacity: 0.6; }
          100% { transform: translateY(0) scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes slideDown {
          0% { transform: translateY(-16px) scale(0.9) rotate(var(--word-rot, 0deg)); opacity: 0.6; }
          100% { transform: translateY(0) scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes slideLeft {
          0% { transform: translateX(20px) scale(0.9) rotate(var(--word-rot, 0deg)); opacity: 0.6; }
          100% { transform: translateX(0) scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes slideRight {
          0% { transform: translateX(-20px) scale(0.9) rotate(var(--word-rot, 0deg)); opacity: 0.6; }
          100% { transform: translateX(0) scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes spinIn {
          0% { transform: rotate(-8deg) scale(0.88); opacity: 0.7; }
          100% { transform: rotate(var(--word-rot, 0deg)) scale(1.10); opacity: 1; }
        }
        @keyframes tiltWave {
          0% { transform: rotate(-6deg) scale(0.9); opacity: 0.7; }
          50% { transform: rotate(4deg) scale(1.16); opacity: 1; }
          100% { transform: rotate(var(--word-rot, 0deg)) scale(1.10); opacity: 1; }
        }
        @keyframes zoomShatter {
          0% { transform: scale(0.75) rotate(var(--word-rot, 0deg)); opacity: 0.7; }
          50% { transform: scale(1.22) rotate(var(--word-rot, 0deg)); opacity: 1; }
          100% { transform: scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes floatDrift {
          0%, 100% { transform: translateY(0) rotate(var(--word-rot, 0deg)) scale(1.10); }
          50% { transform: translateY(-3px) rotate(calc(var(--word-rot, 0deg) + 1deg)) scale(1.10); }
        }
        @keyframes elasticDrop {
          0% { transform: translateY(-20px) scale(0.85) rotate(var(--word-rot, 0deg)); opacity: 0.7; }
          60% { transform: translateY(3px) scale(1.16) rotate(var(--word-rot, 0deg)); opacity: 1; }
          100% { transform: translateY(0) scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes glowBurst {
          0% { transform: scale(0.88) rotate(var(--word-rot, 0deg)); opacity: 0.7; }
          50% { transform: scale(1.18) rotate(var(--word-rot, 0deg)); opacity: 1; }
          100% { transform: scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes rubberBand {
          0% { transform: scale(0.85) rotate(var(--word-rot, 0deg)); opacity: 0.7; }
          40% { transform: scaleX(1.2) scaleY(0.85) rotate(var(--word-rot, 0deg)); opacity: 1; }
          100% { transform: scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes typewriterPop {
          0% { transform: scale(0.85); opacity: 0.6; }
          100% { transform: scale(1.10) rotate(var(--word-rot, 0deg)); opacity: 1; }
        }
        @keyframes swingSway {
          0% { transform: rotate(-8deg) scale(0.88); opacity: 0.7; }
          50% { transform: rotate(5deg) scale(1.16); opacity: 1; }
          100% { transform: rotate(var(--word-rot, 0deg)) scale(1.10); opacity: 1; }
        }
        @keyframes spiralPop {
          0% { transform: rotate(-45deg) scale(0.75); opacity: 0.7; }
          60% { transform: rotate(8deg) scale(1.18); opacity: 1; }
          100% { transform: rotate(var(--word-rot, 0deg)) scale(1.10); opacity: 1; }
        }
      `}</style>

      {/* Main Kinetic Canvas Area (Centered, clean, distraction-free, seamless background) */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 text-center max-w-2xl mx-auto w-full my-auto bg-transparent">
        {/* Previous Lyric Context (subtle preview) */}
        {currentLineIndex > 0 && plan && (
          <div
            dir={plan.lines[currentLineIndex - 1]?.isRtl ? 'rtl' : 'ltr'}
            className="text-white/30 text-sm sm:text-base font-semibold tracking-wide mb-6 transition-opacity duration-400 truncate max-w-md select-none"
            style={
              plan.lines[currentLineIndex - 1]?.isRtl
                ? { fontFamily: "system-ui, -apple-system, 'Segoe UI', 'Cairo', 'Amiri', sans-serif" }
                : undefined
            }
          >
            {plan.lines[currentLineIndex - 1]?.rawText}
          </div>
        )}

        {/* Active Lyric Display with Dynamic Word-by-Word Kinetic Animation & Embedded Emojis */}
        {activeLine && activeLine.words.length > 0 ? (
          <div
            dir={activeLine.isRtl ? 'rtl' : 'ltr'}
            className="flex flex-wrap items-center justify-center gap-x-3.5 sm:gap-x-5 gap-y-4 my-auto px-2 max-w-xl transition-all select-none"
            style={
              activeLine.isRtl
                ? {
                    fontFamily: "system-ui, -apple-system, 'Segoe UI', 'Cairo', 'Amiri', sans-serif",
                    lineHeight: '1.45',
                  }
                : undefined
            }
          >
            {activeLine.words.map((wordObj, idx) => {
              const isActive = idx === activeWordIndex;
              const isPast = idx < activeWordIndex;

              const animClass = isActive ? getAnimationClass(wordObj.anim) : '';
              const rotDegree = wordObj.rot || 0;

              return (
                <span
                  key={idx}
                  style={
                    {
                      '--word-rot': `${rotDegree}deg`,
                    } as React.CSSProperties
                  }
                  className={`relative inline-flex items-center gap-2.5 transition-all duration-150 ease-out select-none cursor-pointer ${
                    isActive
                      ? `scale-115 sm:scale-125 z-30 font-black text-white ${animClass}`
                      : isPast
                      ? 'scale-90 opacity-45 font-bold text-white/60 blur-[0.3px]'
                      : 'scale-95 opacity-25 font-bold text-white/30'
                  }`}
                  onClick={() => onSeek(wordObj.startTime)}
                >
                  {/* Glowing neon aura under active word */}
                  {isActive && (
                    <span
                      className="absolute inset-0 -m-3 rounded-2xl pointer-events-none opacity-80 blur-xl transition-opacity duration-150"
                      style={{
                        background: `radial-gradient(circle, rgba(${resolvedColor.r}, ${resolvedColor.g}, ${resolvedColor.b}, 0.85) 0%, transparent 70%)`,
                      }}
                    />
                  )}

                  {/* Word Text & Emoji right inside the lyrics */}
                  <span
                    className={`relative z-10 text-2xl sm:text-4xl md:text-5xl tracking-tight leading-none ${
                      isActive ? 'drop-shadow-[0_0_20px_rgba(255,255,255,0.9)] text-white' : ''
                    }`}
                    style={
                      isActive
                        ? {
                            textShadow: `0 0 15px rgba(${resolvedColor.r}, ${resolvedColor.g}, ${resolvedColor.b}, 0.95), 0 0 35px rgba(${resolvedColor.r}, ${resolvedColor.g}, ${resolvedColor.b}, 0.6)`,
                          }
                        : undefined
                    }
                  >
                    {wordObj.emoji ? (
                      <span className="inline-flex items-center gap-2.5">
                        <span className="text-3xl sm:text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
                          {wordObj.emoji}
                        </span>
                        <span>{wordObj.text}</span>
                      </span>
                    ) : (
                      wordObj.text
                    )}
                  </span>
                </span>
              );
            })}
          </div>
        ) : (
          <div className="my-auto flex flex-col items-center gap-3 text-white/40">
            <Sparkles className="w-10 h-10 text-[#ff6b1a] animate-pulse" />
            <p className="text-base font-bold">Listening for upcoming lyrics...</p>
          </div>
        )}

        {/* Next Lyric Preview */}
        {currentLineIndex >= 0 && plan && currentLineIndex < plan.lines.length - 1 && (
          <div
            dir={plan.lines[currentLineIndex + 1]?.isRtl ? 'rtl' : 'ltr'}
            className="text-white/25 text-sm sm:text-base font-semibold tracking-wide mt-6 transition-opacity duration-400 truncate max-w-md select-none"
            style={
              plan.lines[currentLineIndex + 1]?.isRtl
                ? { fontFamily: "system-ui, -apple-system, 'Segoe UI', 'Cairo', 'Amiri', sans-serif" }
                : undefined
            }
          >
            {plan.lines[currentLineIndex + 1]?.rawText}
          </div>
        )}
      </div>
    </div>
  );
};

// Backwards compatibility alias
export const AiLyricsReel = LyricsPlus;
