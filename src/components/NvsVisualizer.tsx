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

      const centerX = width / 2;
      const centerY = height / 2;
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
          rawBass = 0.35 + Math.sin(t * 3) * 0.18;
          rawVol = 0.3 + Math.sin(t * 3.5) * 0.15;
          for (let i = 0; i < 64; i++) {
            freqBuffer[i] = Math.max(0, Math.sin(t * 3 + i * 0.25) * 120 + 80);
          }
        } else {
          rawBass = 0;
          rawVol = 0;
        }
      }

      smoothedBass += (rawBass - smoothedBass) * 0.18;
      smoothedVol += (rawVol - smoothedVol) * 0.18;

      const { r, g, b } = dominantColor;
      const primaryNeon = `rgb(${r}, ${g}, ${b})`;
      const secondaryNeon = `rgb(${Math.min(255, r + 45)}, ${Math.min(255, g + 35)}, ${Math.min(255, b + 65)})`;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Soft Glowing Neon Aura
      const auraRadius = baseRadius * (1.1 + smoothedBass * 0.15);
      const auraGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.7,
        centerX,
        centerY,
        auraRadius * 1.45
      );
      auraGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.35 * (0.5 + smoothedBass * 0.5)})`);
      auraGrad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${0.12 * (0.5 + smoothedBass * 0.5)})`);
      auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, auraRadius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // 2. Render Chosen Visualizer Style
      if (visStyle === 'wave') {
        // --- MULTI-LAYER FLUID ACOUSTIC WAVEFORM ---
        wavePhase += isPlaying ? 0.035 : 0.008;
        const waveLayers = [
          { freqMult: 1.0, ampMult: 1.0, alpha: 0.85, color: primaryNeon, width: 3.0 },
          { freqMult: 1.4, ampMult: 0.7, alpha: 0.55, color: secondaryNeon, width: 2.2 },
          { freqMult: 0.7, ampMult: 1.1, alpha: 0.35, color: '#ffffff', width: 1.6 },
        ];

        waveLayers.forEach((layer) => {
          ctx.beginPath();
          ctx.lineWidth = layer.width;
          ctx.strokeStyle = layer.color;
          ctx.shadowColor = layer.color;
          ctx.shadowBlur = 8;

          const points = 48;
          for (let i = 0; i <= points; i++) {
            const x = (i / points) * width;
            const normX = i / points;
            const freqIdx = Math.floor(Math.abs(normX - 0.5) * 2 * (freqBuffer.length - 1));
            const binVal = (freqBuffer[freqIdx] || 0) / 255;

            const envelope = Math.sin(normX * Math.PI); // Pin nicely to left & right edges
            const waveY =
              centerY +
              Math.sin(normX * 8 * layer.freqMult + wavePhase) *
                (28 * layer.ampMult + binVal * 38) *
                envelope;

            if (i === 0) ctx.moveTo(x, waveY);
            else ctx.lineTo(x, waveY);
          }
          ctx.stroke();
        });
        ctx.shadowBlur = 0;
      } else {
        // --- NCS / SPICETIFY CIRCULAR EQUALIZER SPECTRUM ---
        const numBars = 56;
        angleOffset += isPlaying ? 0.003 : 0.0008;

        ctx.lineWidth = 3.0;
        ctx.lineCap = 'round';

        for (let i = 0; i < numBars; i++) {
          const angle = (i / numBars) * Math.PI * 2 + angleOffset;
          const freqIdx = Math.floor(Math.abs(i - numBars / 2) * (freqBuffer.length / (numBars / 2)));
          const val = freqBuffer[Math.min(freqIdx, freqBuffer.length - 1)] || 0;
          const normalizedVal = val / 255;

          const barLength = Math.max(4, normalizedVal * (baseRadius * 0.75) * (0.8 + smoothedBass * 0.4));
          const rStart = baseRadius * 1.04;
          const rEnd = rStart + barLength;

          const x1 = centerX + Math.cos(angle) * rStart;
          const y1 = centerY + Math.sin(angle) * rStart;
          const x2 = centerX + Math.cos(angle) * rEnd;
          const y2 = centerY + Math.sin(angle) * rEnd;

          const barGrad = ctx.createLinearGradient(x1, y1, x2, y2);
          barGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          barGrad.addColorStop(0.4, primaryNeon);
          barGrad.addColorStop(1, secondaryNeon);

          ctx.strokeStyle = barGrad;
          ctx.shadowColor = primaryNeon;
          ctx.shadowBlur = 6 * normalizedVal;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          if (normalizedVal > 0.5) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x2, y2, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
      }

      // 3. Floating Ambient Neon Embers
      if (isPlaying && particles.length < maxParticles && Math.random() < 0.25) {
        const pAngle = Math.random() * Math.PI * 2;
        const pDist = baseRadius * (1.05 + Math.random() * 0.2);
        const speed = 0.5 + Math.random() * 1.2;
        particles.push({
          x: centerX + Math.cos(pAngle) * pDist,
          y: centerY + Math.sin(pAngle) * pDist,
          vx: Math.cos(pAngle) * speed,
          vy: Math.sin(pAngle) * speed,
          size: 1.5 + Math.random() * 2.0,
          alpha: 0.85,
          life: 0,
          maxLife: 40 + Math.random() * 30,
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
