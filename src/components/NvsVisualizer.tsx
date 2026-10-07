import React, { useEffect, useRef, useState } from 'react';
import {
  getFrequencyData,
  getTimeDomainData,
  getAudioAnalysis,
  getVibrationIntensity,
  resumeAudioContext,
} from '../services/audioEnhancer';
import { FALLBACK_ART } from '../services/api';
import { Waves, Disc3, Sparkles } from 'lucide-react';

export type VisualizerStyle = 'ncs' | 'wave' | 'pulse' | 'circular';

interface NvsVisualizerProps {
  thumbSrc: string;
  trackTitle: string;
  isPlaying: boolean;
  mode?: 'ncs' | 'wave' | 'circular';
  onNextView: () => void;
  currentTime?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export const NvsVisualizer: React.FC<NvsVisualizerProps> = ({
  thumbSrc,
  trackTitle,
  isPlaying,
  mode = 'ncs',
  onNextView,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const centerDiscRef = useRef<HTMLDivElement | null>(null);
  const [dominantColor, setDominantColor] = useState<{ r: number; g: number; b: number }>({
    r: 255,
    g: 107,
    b: 26,
  });

  const visStyle = mode;

  // Extract vibrant dominant color from the cover image
  useEffect(() => {
    if (!thumbSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = thumbSrc;
    img.onload = () => {
      try {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 32;
        offCanvas.height = 32;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          const pr = data[i];
          const pg = data[i + 1];
          const pb = data[i + 2];
          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          if (max > 45 && min < 230) {
            r += pr;
            g += pg;
            b += pb;
            count++;
          }
        }
        if (count > 0) {
          setDominantColor({
            r: Math.round(r / count),
            g: Math.round(g / count),
            b: Math.round(b / count),
          });
        }
      } catch {}
    };
  }, [thumbSrc]);

  // Real-time canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: Particle[] = [];
    const maxParticles = 36;
    let smoothedBass = 0;
    let smoothedVol = 0;
    let angleOffset = 0;
    let wavePhase = 0;

    const freqBuffer = new Uint8Array(64);

    const render = () => {
      animId = requestAnimationFrame(render);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dynamic center with subtle organic tilt/leak towards the left
      const centerX = width * 0.48;
      const centerY = height * 0.50;
      const baseRadius = Math.min(width, height) * 0.28;

      let hasRealAudio = false;
      let rawBass = 0;
      let rawVol = 0;

      if (isPlaying) {
        hasRealAudio = getFrequencyData(freqBuffer);
        const vib = getVibrationIntensity();
        rawBass = vib.bass;
        rawVol = vib.volume;
      }

      // Smooth ambient pulse fallback when paused or loading stream
      if (!hasRealAudio || (rawBass === 0 && rawVol === 0)) {
        if (isPlaying) {
          const t = Date.now() / 1000;
          rawBass = 0.4 + Math.sin(t * 3) * 0.22;
          rawVol = 0.35 + Math.sin(t * 3.5) * 0.18;
          for (let i = 0; i < 64; i++) {
            freqBuffer[i] = Math.max(0, Math.sin(t * 3.2 + i * 0.3) * 130 + 90);
          }
        } else {
          rawBass = 0;
          rawVol = 0;
        }
      }

      smoothedBass += (rawBass - smoothedBass) * 0.22;
      smoothedVol += (rawVol - smoothedVol) * 0.22;

      const { r, g, b } = dominantColor;
      const primaryNeon = `rgb(${r}, ${g}, ${b})`;
      const secondaryNeon = `rgb(${Math.min(255, r + 55)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 75)})`;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Soft Glowing Neon Aura leaking prominently to the left
      const auraRadius = baseRadius * (1.15 + smoothedBass * 0.2);
      const auraGrad = ctx.createRadialGradient(
        centerX - width * 0.06,
        centerY,
        baseRadius * 0.6,
        centerX,
        centerY,
        auraRadius * 1.55
      );
      auraGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.45 * (0.6 + smoothedBass * 0.5)})`);
      auraGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${0.18 * (0.6 + smoothedBass * 0.5)})`);
      auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, auraRadius * 1.55, 0, Math.PI * 2);
      ctx.fill();

      // 2. Render Chosen Visualizer Style
      if (visStyle === 'wave') {
        // --- MULTI-LAYER ROTATING FLUID ACOUSTIC WAVEFORM (Leaking Left) ---
        wavePhase += isPlaying ? 0.045 : 0.01;
        angleOffset += isPlaying ? 0.005 : 0.001;

        const numRings = 3;
        for (let ring = 0; ring < numRings; ring++) {
          const ringRadius = baseRadius * (1.06 + ring * 0.14);
          const ringColor = ring === 0 ? primaryNeon : ring === 1 ? secondaryNeon : 'rgba(255, 255, 255, 0.75)';
          const ringWidth = ring === 0 ? 3.2 : ring === 1 ? 2.2 : 1.5;

          ctx.beginPath();
          ctx.lineWidth = ringWidth;
          ctx.strokeStyle = ringColor;
          ctx.shadowColor = primaryNeon;
          ctx.shadowBlur = ring === 0 ? 10 : 6;

          const points = 72;
          for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2 + angleOffset * (ring % 2 === 0 ? 1 : -1.2);
            const freqIdx = Math.floor(Math.abs(Math.sin(angle * 2 + wavePhase)) * (freqBuffer.length - 1));
            const binVal = (freqBuffer[freqIdx] || 0) / 255;

            // Organic leftward expansion & rotation wave
            const leftBias = 1.0 + Math.max(0, -Math.cos(angle)) * 0.45;
            const waveDelta = Math.sin(angle * 6 + wavePhase + ring * 1.2) * (14 + binVal * 32 * (1 + smoothedBass * 0.5)) * leftBias;

            const rCurr = ringRadius + waveDelta;
            const px = centerX + Math.cos(angle) * rCurr;
            const py = centerY + Math.sin(angle) * rCurr;

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      } else {
        // --- NCS / SPICETIFY CIRCULAR EQUALIZER SPECTRUM (Leaking Left & Rotating Layers) ---
        const numBars = 64;
        angleOffset += isPlaying ? 0.0045 : 0.001;

        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';

        // Inner orbital energy ring
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
        ctx.arc(centerX, centerY, baseRadius * 1.03, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < numBars; i++) {
          const angle = (i / numBars) * Math.PI * 2 + angleOffset;
          const freqIdx = Math.floor(Math.abs(i - numBars / 2) * (freqBuffer.length / (numBars / 2)));
          const val = freqBuffer[Math.min(freqIdx, freqBuffer.length - 1)] || 0;
          const normalizedVal = val / 255;

          // Asymmetric acoustic expansion leaking to the left (angle near PI)
          const leftBias = 1.0 + Math.max(0, -Math.cos(angle)) * 0.42;

          const barLength = Math.max(
            5,
            normalizedVal * (baseRadius * 0.85) * (0.85 + smoothedBass * 0.5) * leftBias
          );
          const rStart = baseRadius * 1.04;
          const rEnd = rStart + barLength;

          const x1 = centerX + Math.cos(angle) * rStart;
          const y1 = centerY + Math.sin(angle) * rStart;
          const x2 = centerX + Math.cos(angle) * rEnd;
          const y2 = centerY + Math.sin(angle) * rEnd;

          const barGrad = ctx.createLinearGradient(x1, y1, x2, y2);
          barGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          barGrad.addColorStop(0.35, primaryNeon);
          barGrad.addColorStop(1, secondaryNeon);

          ctx.strokeStyle = barGrad;
          ctx.shadowColor = primaryNeon;
          ctx.shadowBlur = (7 + smoothedBass * 5) * normalizedVal;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Glowing tip bead for energetic audio peaks
          if (normalizedVal > 0.45) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x2, y2, 2.0 + normalizedVal * 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
      }

      // 3. Floating Ambient Neon Embers drifting with leftward momentum
      if (isPlaying && particles.length < maxParticles && Math.random() < 0.3) {
        const pAngle = Math.random() * Math.PI * 2;
        const pDist = baseRadius * (1.05 + Math.random() * 0.25);
        const speed = 0.6 + Math.random() * 1.4;
        particles.push({
          x: centerX + Math.cos(pAngle) * pDist,
          y: centerY + Math.sin(pAngle) * pDist,
          vx: Math.cos(pAngle) * speed - (Math.random() * 0.6), // slight leftward drift
          vy: Math.sin(pAngle) * speed,
          size: 1.6 + Math.random() * 2.2,
          alpha: 0.9,
          life: 0,
          maxLife: 45 + Math.random() * 35,
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const lifeFraction = p.life / p.maxLife;
        p.alpha = Math.max(0, (1 - lifeFraction) * 0.8);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - lifeFraction * 0.5), 0, Math.PI * 2);
        ctx.fill();

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      ctx.restore();
    };

    const handleResize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [dominantColor, isPlaying, visStyle]);

  return (
    <div
      ref={containerRef}
      onClick={onNextView}
      className="w-full h-full relative flex items-center justify-center cursor-pointer select-none"
      title="Spicetify / NCS Audio Visualizer - Click to return to classic artwork"
    >
      {/* 60fps Audio Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Center Vibrating Disc with Cover Art and Glowing Border */}
      <div
        className="relative z-10 w-[56%] h-[56%] rounded-full overflow-hidden shadow-2xl flex items-center justify-center transition-transform duration-75"
        style={{
          border: `3.5px solid rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.9)`,
          boxShadow: `0 0 40px rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.55), inset 0 0 25px rgba(0,0,0,0.85)`,
        }}
      >
        <img
          src={thumbSrc}
          alt={trackTitle}
          onError={(e) => {
            e.currentTarget.src = FALLBACK_ART;
          }}
          className={`w-full h-full object-cover rounded-full pointer-events-none select-none ${
            isPlaying ? 'animate-[spin_24s_linear_infinite]' : ''
          }`}
          style={{
            animationPlayState: isPlaying ? 'running' : 'paused',
          }}
          draggable={false}
        />

        {/* Center glowing badge indicator */}
        <div
          className="absolute w-8 h-8 rounded-full border-2 border-white/70 flex items-center justify-center backdrop-blur-md shadow-2xl"
          style={{
            background: `radial-gradient(circle, rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, 0.95) 0%, rgba(0,0,0,0.9) 80%)`,
          }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_white]" />
        </div>
      </div>
    </div>
  );
};
