// High-Performance Web Audio DSP Engine with Studio-Grade Multi-Stage Bass Booster,
// Hardware Dynamic Limiter / Compressor, 200% Volume Amplifier, and FFT Analyser.

export type BassBoostMode = 'off' | 'on' | 'boost';

const STORAGE_KEY_BASS = 'mouzika_bass_boost_mode';
const STORAGE_KEY_VOL_BOOST = 'mouzika_volume_boost_pct';

let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let bassLowShelf: BiquadFilterNode | null = null;
let subBassPeaking: BiquadFilterNode | null = null;
let punchBassPeaking: BiquadFilterNode | null = null;
let boostGainNode: GainNode | null = null;
let limiterNode: DynamicsCompressorNode | null = null;
let analyserNode: AnalyserNode | null = null;
let boundAudioElement: HTMLAudioElement | null = null;
let isConnected = false;

// Stored settings with safe defaults
let currentBassMode: BassBoostMode = 'off';
let currentVolumeBoost = 100; // 100% to 200%
let currentBaseVolume = 100; // 0% to 100%

// Listeners for UI state reactivity
type SettingsListener = (settings: { bassMode: BassBoostMode; volumeBoost: number }) => void;
const listeners = new Set<SettingsListener>();

function notifyListeners() {
  const payload = { bassMode: currentBassMode, volumeBoost: currentVolumeBoost };
  listeners.forEach((l) => {
    try {
      l(payload);
    } catch {}
  });
}

export function subscribeAudioEnhancer(listener: SettingsListener): () => void {
  listeners.add(listener);
  listener({ bassMode: currentBassMode, volumeBoost: currentVolumeBoost });
  return () => {
    listeners.delete(listener);
  };
}

// Load saved settings from cache
try {
  const savedBass = localStorage.getItem(STORAGE_KEY_BASS) as BassBoostMode;
  if (savedBass === 'off' || savedBass === 'on' || savedBass === 'boost') {
    currentBassMode = savedBass;
  }
  const savedVol = Number(localStorage.getItem(STORAGE_KEY_VOL_BOOST));
  if (savedVol >= 100 && savedVol <= 200) {
    currentVolumeBoost = savedVol;
  }
} catch {}

export function resumeAudioContext() {
  if (audioCtx && audioCtx.state !== 'running') {
    audioCtx.resume().catch(() => {});
  }
}

function applyFilters() {
  resumeAudioContext();

  if (bassLowShelf && subBassPeaking && punchBassPeaking && audioCtx) {
    const t = audioCtx.currentTime;
    if (currentBassMode === 'off') {
      bassLowShelf.gain.setTargetAtTime(0, t, 0.02);
      subBassPeaking.gain.setTargetAtTime(0, t, 0.02);
      punchBassPeaking.gain.setTargetAtTime(0, t, 0.02);
    } else if (currentBassMode === 'on') {
      // Powerful clean bass enhancement
      bassLowShelf.gain.setTargetAtTime(11, t, 0.02);
      subBassPeaking.gain.setTargetAtTime(7.5, t, 0.02);
      punchBassPeaking.gain.setTargetAtTime(4, t, 0.02);
    } else if (currentBassMode === 'boost') {
      // Extreme Android-style Sub-Woofer / Heavy Bass Punch
      bassLowShelf.gain.setTargetAtTime(20, t, 0.02);
      subBassPeaking.gain.setTargetAtTime(15, t, 0.02);
      punchBassPeaking.gain.setTargetAtTime(8.5, t, 0.02);
    }
  }

  if (boostGainNode && audioCtx) {
    const t = audioCtx.currentTime;
    const normalizedBase = Math.max(0, Math.min(100, currentBaseVolume)) / 100;
    const boostMultiplier = Math.max(100, Math.min(200, currentVolumeBoost)) / 100;
    const finalGain = normalizedBase * boostMultiplier;
    boostGainNode.gain.setTargetAtTime(finalGain, t, 0.02);
  }
}

export function ensureAudioGraph(audio: HTMLAudioElement) {
  if (isConnected && audioCtx) {
    resumeAudioContext();
    return;
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (!sourceNode && audio) {
      boundAudioElement = audio;
      audio.crossOrigin = 'anonymous';

      sourceNode = audioCtx.createMediaElementSource(audio);

      // 1. Multi-Stage Bass Equalizer
      // Stage A: Deep Sub-bass peaking filter (55Hz)
      subBassPeaking = audioCtx.createBiquadFilter();
      subBassPeaking.type = 'peaking';
      subBassPeaking.frequency.value = 55;
      subBassPeaking.Q.value = 1.3;

      // Stage B: Main Low-Shelf bass filter (90Hz)
      bassLowShelf = audioCtx.createBiquadFilter();
      bassLowShelf.type = 'lowshelf';
      bassLowShelf.frequency.value = 90;

      // Stage C: Punch / Chest thump peaking filter (160Hz)
      punchBassPeaking = audioCtx.createBiquadFilter();
      punchBassPeaking.type = 'peaking';
      punchBassPeaking.frequency.value = 160;
      punchBassPeaking.Q.value = 1.0;

      // 2. Hardware Gain Amplifier for up to 200% volume boost
      boostGainNode = audioCtx.createGain();

      // 3. Studio-Grade Limiter / Dynamic Compressor to prevent harsh digital clipping
      limiterNode = audioCtx.createDynamicsCompressor();
      limiterNode.threshold.value = -1.5;
      limiterNode.knee.value = 6;
      limiterNode.ratio.value = 18;
      limiterNode.attack.value = 0.003;
      limiterNode.release.value = 0.1;

      // 4. Fast High-Resolution Analyser for Dynamic Visualizer (fftSize 256 for rich 128 bins)
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.72;

      // Connect DSP chain:
      // source -> subBass -> bassLowShelf -> punchBass -> boostGain -> limiter -> analyser -> destination
      sourceNode.connect(subBassPeaking);
      subBassPeaking.connect(bassLowShelf);
      bassLowShelf.connect(punchBassPeaking);
      punchBassPeaking.connect(boostGainNode);
      boostGainNode.connect(limiterNode);
      limiterNode.connect(analyserNode);
      analyserNode.connect(audioCtx.destination);

      isConnected = true;
      applyFilters();
    }

    resumeAudioContext();
  } catch (err) {
    console.warn('AudioContext DSP setup notice:', err);
  }
}

export function setBassBoostMode(mode: BassBoostMode) {
  currentBassMode = mode;
  try {
    localStorage.setItem(STORAGE_KEY_BASS, mode);
  } catch {}
  if (boundAudioElement) ensureAudioGraph(boundAudioElement);
  applyFilters();
  notifyListeners();
}

export function setVolumeBoostPercent(percent: number) {
  const clamped = Math.max(100, Math.min(200, Math.round(percent)));
  currentVolumeBoost = clamped;
  try {
    localStorage.setItem(STORAGE_KEY_VOL_BOOST, String(clamped));
  } catch {}
  if (boundAudioElement) ensureAudioGraph(boundAudioElement);
  applyFilters();
  notifyListeners();
}

export function setBaseAudioVolume(vol: number) {
  currentBaseVolume = Math.max(0, Math.min(100, vol));
  applyFilters();
}

export function resetBoostSettings() {
  currentBassMode = 'off';
  currentVolumeBoost = 100;
  try {
    localStorage.setItem(STORAGE_KEY_BASS, 'off');
    localStorage.setItem(STORAGE_KEY_VOL_BOOST, '100');
  } catch {}
  applyFilters();
  notifyListeners();
}

export function getAudioBoosterState() {
  return {
    bassMode: currentBassMode,
    volumeBoost: currentVolumeBoost,
  };
}

export function getFrequencyData(buffer: Uint8Array): boolean {
  if (!analyserNode) return false;
  analyserNode.getByteFrequencyData(buffer as any);
  return true;
}

export function getTimeDomainData(buffer: Uint8Array): boolean {
  if (!analyserNode) return false;
  analyserNode.getByteTimeDomainData(buffer as any);
  return true;
}

export function getAudioAnalysis(): {
  hasRealSignal: boolean;
  volume: number;
  bass: number;
  mid: number;
  treble: number;
  peak: number;
} {
  if (!analyserNode) {
    return { hasRealSignal: false, volume: 0, bass: 0, mid: 0, treble: 0, peak: 0 };
  }
  const buffer = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(buffer as any);

  let sum = 0;
  let bassSum = 0;
  let midSum = 0;
  let trebSum = 0;
  let peak = 0;

  const len = buffer.length;
  const bassEnd = Math.max(1, Math.floor(len * 0.2));
  const midEnd = Math.max(bassEnd + 1, Math.floor(len * 0.6));

  for (let i = 0; i < len; i++) {
    const val = buffer[i];
    sum += val;
    if (val > peak) peak = val;
    if (i < bassEnd) bassSum += val;
    else if (i < midEnd) midSum += val;
    else trebSum += val;
  }

  const bassCount = bassEnd;
  const midCount = midEnd - bassEnd;
  const trebCount = len - midEnd;

  // Signal is real if non-trivial energy exists
  const hasRealSignal = sum > 80 && peak > 15;

  return {
    hasRealSignal,
    volume: sum / (len * 255),
    bass: bassSum / (bassCount * 255),
    mid: midSum / (midCount * 255),
    treble: trebSum / (trebCount * 255),
    peak: peak / 255,
  };
}

export function getVibrationIntensity(): { volume: number; bass: number; mid: number; treble: number } {
  if (!analyserNode) {
    return { volume: 0, bass: 0, mid: 0, treble: 0 };
  }
  const buffer = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(buffer as any);

  let sum = 0;
  let bassSum = 0;
  let midSum = 0;
  let trebSum = 0;

  const len = buffer.length;
  const bassEnd = Math.floor(len * 0.25);
  const midEnd = Math.floor(len * 0.65);

  for (let i = 0; i < len; i++) {
    const val = buffer[i];
    sum += val;
    if (i < bassEnd) bassSum += val;
    else if (i < midEnd) midSum += val;
    else trebSum += val;
  }

  const bassCount = bassEnd || 1;
  const midCount = (midEnd - bassEnd) || 1;
  const trebCount = (len - midEnd) || 1;

  return {
    volume: sum / (len * 255),
    bass: bassSum / (bassCount * 255),
    mid: midSum / (midCount * 255),
    treble: trebSum / (trebCount * 255),
  };
}
