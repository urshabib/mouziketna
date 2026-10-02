// Groq AI Lyrics Reel Director Service
// Coordinates with Groq Cloud API (https://api.groq.com/openai/v1) for ultra-fast,
// sub-second LPU inference to transform synced lyrics into cinematic, viral Reels
// with dynamic word animations, emoji substitutions, and animated sketch stickers.
// Fully supports English, Arabic (RTL), and French lyrics with max 1 emoji per line rule.

import { SyncedLyricsLine } from '../types';

export type ReelAnimationPreset =
  | 'pop_bounce'
  | 'pulse_heartbeat'
  | 'fire_flare'
  | 'slam_shake'
  | 'neon_glitch'
  | 'strobe_flash'
  | 'slide_up'
  | 'slide_down'
  | 'slide_left'
  | 'slide_right'
  | 'spin_in'
  | 'tilt_wave'
  | 'float_drift'
  | 'zoom_shatter'
  | 'elastic_drop'
  | 'glow_burst'
  | 'rubber_band'
  | 'typewriter'
  | 'swing_sway'
  | 'spiral_pop';

export type ReelSketchId =
  | 'fire'
  | 'zap'
  | 'sparkle'
  | 'heart'
  | 'disc'
  | 'mic'
  | 'radio'
  | 'dumbbell'
  | 'waves'
  | 'skull'
  | 'crown'
  | 'party'
  | 'crying'
  | 'broken_heart'
  | 'smile'
  | 'moon'
  | 'sun'
  | 'money'
  | 'ghost'
  | 'rose'
  | 'car'
  | 'star'
  | 'gem'
  | 'clock'
  | 'notes'
  | 'shield'
  | 'eyes'
  | 'wind'
  | 'planet'
  | 'rocket'
  | 'wings';

export type BackgroundThemeType =
  | 'floating_hearts'   // Romantic hearts bubbling upwards with pulses
  | 'rising_fire'       // Warm embers & flames convection rising from bottom
  | 'snow_drift'        // Snowflakes & winter crystals drifting down with sinusoidal wave sway
  | 'falling_rain_drop' // Many small versions of triggering emoji dropping like rain cascade
  | 'corner_swoop'      // Dynamic vehicle/rocket/wings swooping across screen from corners
  | 'stars_streak'      // Diagonal shooting stars & cosmic sparkle comets
  | 'cash_flutter'      // 3D tumbling banknotes & royal crowns
  | 'lightning_surge'   // Electric storm & high-energy thunderbolts flashing
  | 'party_confetti'    // Festive confetti fireworks & celebration disco
  | 'gothic_mist';      // Ethereal phantom spirits & skulls ascending in mist

export function getThemeForSketchOrEmoji(
  sketchId?: ReelSketchId,
  emoji?: string
): BackgroundThemeType {
  if (sketchId === 'heart' || sketchId === 'broken_heart') return 'floating_hearts';
  if (sketchId === 'fire' || sketchId === 'sun') return 'rising_fire';
  if (sketchId === 'crying' || sketchId === 'waves') return 'falling_rain_drop';
  if (sketchId === 'star' || sketchId === 'sparkle' || sketchId === 'moon' || sketchId === 'planet') return 'stars_streak';
  if (sketchId === 'money' || sketchId === 'crown' || sketchId === 'gem') return 'cash_flutter';
  if (sketchId === 'zap' || sketchId === 'dumbbell' || sketchId === 'shield') return 'lightning_surge';
  if (sketchId === 'car' || sketchId === 'rocket' || sketchId === 'wind' || sketchId === 'wings') return 'corner_swoop';
  if (sketchId === 'skull' || sketchId === 'ghost') return 'gothic_mist';
  if (
    sketchId === 'party' ||
    sketchId === 'smile' ||
    sketchId === 'disc' ||
    sketchId === 'notes' ||
    sketchId === 'mic' ||
    sketchId === 'radio'
  )
    return 'party_confetti';

  if (emoji) {
    if (['❤️', '💖', '💕', '💘', '💓', '🥰', '💔', '🥀', '😍', '😘', '💋'].includes(emoji)) return 'floating_hearts';
    if (['🔥', '☀️', '🌡️', '🌋', '💡'].includes(emoji)) return 'rising_fire';
    if (['❄️', '🥶', '🧊'].includes(emoji)) return 'snow_drift';
    if (['😭', '😢', '💧', '🌧️', '🌧', '🥺', '🌊'].includes(emoji)) return 'falling_rain_drop';
    if (['⭐', '✨', '🌟', '🌙', '🌕', '🪐', '🌌', '🪄'].includes(emoji)) return 'stars_streak';
    if (['💸', '💰', '💵', '🤑', '👑', '💎', '🪙', '💳'].includes(emoji)) return 'cash_flutter';
    if (['⚡', '⛈️', '🌩️', '💪', '🛡️'].includes(emoji)) return 'lightning_surge';
    if (['🏎️', '🚗', '🚀', '💨', '🌪️', '🪽', '🕊️', '✈️', '🏍️'].includes(emoji)) return 'corner_swoop';
    if (['💀', '☠️', '👻', '⚰️'].includes(emoji)) return 'gothic_mist';
    if (['🎉', '🥳', '🪩', '💃', '🕺', '🎵', '🎶', '🎤', '🔊', '😄', '😂', '😊', '😁', '🥂'].includes(emoji)) return 'party_confetti';
  }

  // Any other triggering emoji drops from the sky in many small versions!
  return 'falling_rain_drop';
}

export function getDefaultEmojiForSketch(sketchId?: ReelSketchId): string {
  switch (sketchId) {
    case 'fire':
      return '🔥';
    case 'zap':
      return '⚡';
    case 'heart':
      return '❤️';
    case 'broken_heart':
      return '💔';
    case 'moon':
      return '🌙';
    case 'sun':
      return '☀️';
    case 'star':
      return '⭐';
    case 'sparkle':
      return '✨';
    case 'crying':
      return '😭';
    case 'crown':
      return '👑';
    case 'money':
      return '💸';
    case 'party':
      return '🎉';
    case 'disc':
      return '💿';
    case 'waves':
      return '🌊';
    case 'skull':
      return '💀';
    case 'ghost':
      return '👻';
    case 'rose':
      return '🌹';
    case 'car':
      return '🏎️';
    case 'mic':
      return '🎤';
    case 'radio':
      return '📻';
    case 'dumbbell':
      return '💪';
    case 'smile':
      return '😊';
    case 'gem':
      return '💎';
    case 'clock':
      return '⏰';
    case 'notes':
      return '🎶';
    case 'shield':
      return '🛡️';
    case 'eyes':
      return '👀';
    case 'wind':
      return '💨';
    case 'planet':
      return '🪐';
    case 'rocket':
      return '🚀';
    case 'wings':
      return '🪽';
    default:
      return '✨';
  }
}

export interface ReelWord {
  text: string;
  originalWord: string;
  startTime: number;
  endTime: number;
  anim: ReelAnimationPreset;
  rot: number; // degrees -10 to +10
  pos: 'center' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'dramatic_zoom';
  emoji?: string;
  sketch?: ReelSketchId;
  glowColor?: string;
}

export interface ReelLine {
  time: number;
  endTime: number;
  rawText: string;
  isRtl: boolean;
  words: ReelWord[];
}

export interface ReelDirectorPlan {
  trackId: string;
  source: 'lyrics_plus' | 'smart_director';
  lines: ReelLine[];
}

const STORAGE_KEY_LYRICS_PLUS_ENABLED = 'mouzika_lyrics_plus_enabled';

export function getIsLyricsPlusEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_LYRICS_PLUS_ENABLED) === 'true';
  } catch {
    return false;
  }
}

export function setIsLyricsPlusEnabled(val: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_LYRICS_PLUS_ENABLED, String(val));
  } catch {}
}

export const getIsAiReelEnabled = getIsLyricsPlusEnabled;
export const setIsAiReelEnabled = setIsLyricsPlusEnabled;

// In-memory cache for instant 0ms loads
const directorCache = new Map<string, ReelDirectorPlan>();

/**
 * Normalizes lyric words across English, Arabic, and French.
 * Handles Arabic alef variants, taa marbuta, and French accents while keeping unicode letters.
 */
export function normalizeLyricWord(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    // normalize Arabic alef variants & common letters
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    // strip diacritics / harakat for Arabic
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // normalize French accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // strip non-letters
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(text);
}

// ---------------------------------------------------------------------------
// MASSIVE MULTILINGUAL EMOJI & SKETCH DICTIONARIES
// Covers English, Arabic, and French lyric emotions
// ---------------------------------------------------------------------------

interface EmotionMatch {
  emoji: string;
  sketch?: ReelSketchId;
  weight: number; // Higher weight = higher priority if multiple words in a line match
}

const MULTILINGUAL_EMOTIONS: Record<string, EmotionMatch> = {
  // === ARABIC ===
  // Love & Romance
  حب: { emoji: '❤️', sketch: 'heart', weight: 10 },
  بحبك: { emoji: '💖', sketch: 'heart', weight: 10 },
  حبيبي: { emoji: '🥰', sketch: 'heart', weight: 10 },
  حبيبتي: { emoji: '🥰', sketch: 'heart', weight: 10 },
  حبي: { emoji: '💖', sketch: 'heart', weight: 9 },
  قلب: { emoji: '❤️', sketch: 'heart', weight: 10 },
  قلبي: { emoji: '💖', sketch: 'heart', weight: 10 },
  قلوب: { emoji: '💕', sketch: 'heart', weight: 9 },
  عشق: { emoji: '💘', sketch: 'heart', weight: 10 },
  عاشق: { emoji: '😍', sketch: 'heart', weight: 9 },
  غرام: { emoji: '🌹', sketch: 'rose', weight: 9 },
  روحي: { emoji: '✨', sketch: 'sparkle', weight: 9 },
  روح: { emoji: '✨', sketch: 'sparkle', weight: 8 },
  عمري: { emoji: '💖', sketch: 'heart', weight: 9 },
  حياتي: { emoji: '💖', sketch: 'heart', weight: 9 },
  بوسه: { emoji: '💋', weight: 8 },
  شوق: { emoji: '🥺', weight: 8 },
  مشتاق: { emoji: '🥺', weight: 8 },
  حنين: { emoji: '💭', weight: 8 },
  حلو: { emoji: '🍭', weight: 7 },
  جميل: { emoji: '✨', sketch: 'sparkle', weight: 7 },
  غالي: { emoji: '💎', sketch: 'star', weight: 8 },
  ورد: { emoji: '🌹', sketch: 'rose', weight: 8 },
  ورود: { emoji: '💐', sketch: 'rose', weight: 8 },
  ياسمين: { emoji: '🌸', sketch: 'rose', weight: 8 },

  // Fire, Energy & Power (Arabic)
  نار: { emoji: '🔥', sketch: 'fire', weight: 10 },
  لهيب: { emoji: '🔥', sketch: 'fire', weight: 9 },
  شعلة: { emoji: '🔥', sketch: 'fire', weight: 9 },
  حريق: { emoji: '🔥', sketch: 'fire', weight: 9 },
  ولع: { emoji: '🔥', sketch: 'fire', weight: 9 },
  مولع: { emoji: '🔥', sketch: 'fire', weight: 9 },
  حراره: { emoji: '🌡️', sketch: 'fire', weight: 8 },
  كهربا: { emoji: '⚡', sketch: 'zap', weight: 9 },
  برق: { emoji: '⚡', sketch: 'zap', weight: 9 },
  رعد: { emoji: '⚡', sketch: 'zap', weight: 8 },
  قوه: { emoji: '💪', sketch: 'dumbbell', weight: 8 },
  قوي: { emoji: '💪', sketch: 'dumbbell', weight: 8 },
  طاقه: { emoji: '⚡', sketch: 'zap', weight: 8 },
  بطل: { emoji: '🏆', sketch: 'crown', weight: 8 },
  صاروخ: { emoji: '🚀', sketch: 'rocket', weight: 10 },

  // Night, Moon, Stars & Sky (Arabic)
  ليل: { emoji: '🌙', sketch: 'moon', weight: 9 },
  ليله: { emoji: '🌙', sketch: 'moon', weight: 9 },
  ليالي: { emoji: '🌙', sketch: 'moon', weight: 9 },
  سهر: { emoji: '🌌', sketch: 'moon', weight: 8 },
  سهران: { emoji: '🌙', sketch: 'moon', weight: 8 },
  قمر: { emoji: '🌕', sketch: 'moon', weight: 10 },
  بدر: { emoji: '🌕', sketch: 'moon', weight: 9 },
  نجم: { emoji: '⭐', sketch: 'star', weight: 9 },
  نجوم: { emoji: '✨', sketch: 'sparkle', weight: 9 },
  سماء: { emoji: '🌌', weight: 7 },
  غيوم: { emoji: '☁️', weight: 7 },
  ظلام: { emoji: '🌑', weight: 7 },
  شمس: { emoji: '☀️', sketch: 'sun', weight: 9 },
  صبح: { emoji: '🌅', sketch: 'sun', weight: 8 },
  صباح: { emoji: '☀️', sketch: 'sun', weight: 8 },
  نور: { emoji: '💡', sketch: 'sun', weight: 8 },
  ضياء: { emoji: '✨', sketch: 'sparkle', weight: 7 },

  // Sadness, Tears & Heartbreak (Arabic)
  دمع: { emoji: '💧', sketch: 'crying', weight: 10 },
  دموع: { emoji: '😭', sketch: 'crying', weight: 10 },
  بكاء: { emoji: '😭', sketch: 'crying', weight: 10 },
  ابكي: { emoji: '😢', sketch: 'crying', weight: 9 },
  تبكي: { emoji: '😢', sketch: 'crying', weight: 9 },
  حزن: { emoji: '🥺', sketch: 'crying', weight: 9 },
  حزين: { emoji: '😔', sketch: 'crying', weight: 9 },
  زعل: { emoji: '😤', weight: 8 },
  وجع: { emoji: '💔', sketch: 'broken_heart', weight: 10 },
  موجوع: { emoji: '💔', sketch: 'broken_heart', weight: 10 },
  جرح: { emoji: '💔', sketch: 'broken_heart', weight: 9 },
  مجروح: { emoji: '💔', sketch: 'broken_heart', weight: 9 },
  مكسور: { emoji: '💔', sketch: 'broken_heart', weight: 9 },
  فراق: { emoji: '🥀', sketch: 'broken_heart', weight: 9 },
  وحدي: { emoji: '🚶', weight: 8 },
  وحيد: { emoji: '👤', weight: 8 },
  موت: { emoji: '💀', sketch: 'skull', weight: 10 },
  ميت: { emoji: '💀', sketch: 'skull', weight: 9 },
  قبر: { emoji: '⚰️', sketch: 'skull', weight: 8 },

  // Party, Joy, Music & Dance (Arabic)
  فرح: { emoji: '🎉', sketch: 'party', weight: 9 },
  فرحان: { emoji: '😃', sketch: 'smile', weight: 8 },
  سعيد: { emoji: '😊', sketch: 'smile', weight: 8 },
  مبسوط: { emoji: '😁', sketch: 'smile', weight: 8 },
  ضحك: { emoji: '😂', sketch: 'smile', weight: 8 },
  ابتسم: { emoji: '😊', sketch: 'smile', weight: 8 },
  رقص: { emoji: '💃', sketch: 'party', weight: 9 },
  ارقص: { emoji: '🕺', sketch: 'party', weight: 9 },
  حفله: { emoji: '🎉', sketch: 'party', weight: 9 },
  سهرة: { emoji: '🥂', sketch: 'party', weight: 8 },
  طرب: { emoji: '🎶', sketch: 'disc', weight: 9 },
  مزاج: { emoji: '😎', weight: 8 },
  موسيقى: { emoji: '🎵', sketch: 'disc', weight: 9 },
  اغنيه: { emoji: '🎶', sketch: 'disc', weight: 8 },
  صوت: { emoji: '🎤', sketch: 'mic', weight: 9 },
  غناء: { emoji: '🎤', sketch: 'mic', weight: 9 },
  نغم: { emoji: '🎼', sketch: 'waves', weight: 8 },

  // Wealth & Royalty (Arabic)
  فلوس: { emoji: '💸', sketch: 'money', weight: 10 },
  مال: { emoji: '💰', sketch: 'money', weight: 9 },
  مصاري: { emoji: '💵', sketch: 'money', weight: 9 },
  ذهب: { emoji: '🪙', sketch: 'crown', weight: 9 },
  الماس: { emoji: '💎', sketch: 'star', weight: 9 },
  غني: { emoji: '🤑', sketch: 'money', weight: 8 },
  كاش: { emoji: '💳', sketch: 'money', weight: 8 },
  ملك: { emoji: '👑', sketch: 'crown', weight: 10 },
  ملكه: { emoji: '👑', sketch: 'crown', weight: 10 },
  سلطان: { emoji: '👑', sketch: 'crown', weight: 9 },
  تاج: { emoji: '👑', sketch: 'crown', weight: 9 },
  زعيم: { emoji: '🦁', sketch: 'crown', weight: 8 },
  سياره: { emoji: '🏎️', sketch: 'car', weight: 8 },
  سريع: { emoji: '💨', sketch: 'car', weight: 8 },
  طير: { emoji: '🕊️', weight: 8 },
  طيران: { emoji: '✈️', weight: 8 },
  بحر: { emoji: '🌊', sketch: 'waves', weight: 8 },
  موج: { emoji: '🌊', sketch: 'waves', weight: 8 },
  مطر: { emoji: '🌧️', sketch: 'crying', weight: 9 },
  امطار: { emoji: '🌧️', sketch: 'crying', weight: 9 },
  ثلج: { emoji: '❄️', sketch: 'crying', weight: 10 },
  جليد: { emoji: '❄️', sketch: 'crying', weight: 9 },
  برد: { emoji: '🥶', sketch: 'crying', weight: 9 },
  شتاء: { emoji: '❄️', sketch: 'crying', weight: 8 },

  // === FRENCH ===
  // Love & Romance
  amour: { emoji: '💖', sketch: 'heart', weight: 10 },
  aimer: { emoji: '❤️', sketch: 'heart', weight: 9 },
  aime: { emoji: '❤️', sketch: 'heart', weight: 9 },
  coeur: { emoji: '💖', sketch: 'heart', weight: 10 },
  coeurs: { emoji: '💕', sketch: 'heart', weight: 9 },
  bebe: { emoji: '👶', weight: 8 },
  cheri: { emoji: '🥰', sketch: 'heart', weight: 8 },
  cherie: { emoji: '🥰', sketch: 'heart', weight: 8 },
  bisou: { emoji: '💋', weight: 8 },
  baiser: { emoji: '💋', weight: 8 },
  embrasser: { emoji: '😘', weight: 8 },
  doux: { emoji: '🍭', weight: 7 },
  douce: { emoji: '🌸', weight: 7 },
  passion: { emoji: '🔥', sketch: 'fire', weight: 8 },
  yeux: { emoji: '👀', weight: 8 },
  regard: { emoji: '👁️', weight: 7 },
  rose: { emoji: '🌹', sketch: 'rose', weight: 8 },
  roses: { emoji: '💐', sketch: 'rose', weight: 8 },
  fleur: { emoji: '🌸', sketch: 'rose', weight: 7 },
  fleurs: { emoji: '🌺', sketch: 'rose', weight: 7 },

  // Fire & Energy (French)
  feu: { emoji: '🔥', sketch: 'fire', weight: 10 },
  flamme: { emoji: '🔥', sketch: 'fire', weight: 9 },
  flammes: { emoji: '🔥', sketch: 'fire', weight: 9 },
  brule: { emoji: '🔥', sketch: 'fire', weight: 9 },
  bruler: { emoji: '🔥', sketch: 'fire', weight: 9 },
  chaud: { emoji: '🌡️', sketch: 'fire', weight: 8 },
  eclair: { emoji: '⚡', sketch: 'zap', weight: 9 },
  foudre: { emoji: '⚡', sketch: 'zap', weight: 9 },
  force: { emoji: '💪', sketch: 'dumbbell', weight: 8 },
  puissant: { emoji: '💥', sketch: 'zap', weight: 8 },

  // Night & Stars (French)
  nuit: { emoji: '🌙', sketch: 'moon', weight: 9 },
  nuits: { emoji: '🌙', sketch: 'moon', weight: 9 },
  soir: { emoji: '🌆', sketch: 'moon', weight: 7 },
  minuit: { emoji: '🕛', sketch: 'moon', weight: 8 },
  lune: { emoji: '🌕', sketch: 'moon', weight: 10 },
  etoile: { emoji: '⭐', sketch: 'star', weight: 9 },
  etoiles: { emoji: '✨', sketch: 'sparkle', weight: 9 },
  briller: { emoji: '✨', sketch: 'sparkle', weight: 8 },
  soleil: { emoji: '☀️', sketch: 'sun', weight: 9 },
  matin: { emoji: '🌅', sketch: 'sun', weight: 7 },
  jour: { emoji: '☀️', sketch: 'sun', weight: 7 },
  ciel: { emoji: '🌌', weight: 7 },
  reve: { emoji: '💭', weight: 8 },
  rever: { emoji: '💭', weight: 8 },

  // Sadness & Pain (French)
  larme: { emoji: '💧', sketch: 'crying', weight: 10 },
  larmes: { emoji: '😭', sketch: 'crying', weight: 10 },
  pleure: { emoji: '😢', sketch: 'crying', weight: 9 },
  pleurer: { emoji: '😭', sketch: 'crying', weight: 9 },
  triste: { emoji: '🥺', sketch: 'crying', weight: 9 },
  tristesse: { emoji: '😔', sketch: 'crying', weight: 9 },
  douleur: { emoji: '💔', sketch: 'broken_heart', weight: 9 },
  peine: { emoji: '🥀', sketch: 'broken_heart', weight: 8 },
  blessure: { emoji: '🩹', sketch: 'broken_heart', weight: 8 },
  brise: { emoji: '💔', sketch: 'broken_heart', weight: 9 },
  casse: { emoji: '💔', sketch: 'broken_heart', weight: 8 },
  seul: { emoji: '🚶', weight: 7 },
  solitude: { emoji: '👤', weight: 7 },
  mort: { emoji: '💀', sketch: 'skull', weight: 10 },
  mourir: { emoji: '💀', sketch: 'skull', weight: 9 },
  tombe: { emoji: '⚰️', sketch: 'skull', weight: 8 },

  // Joy & Music (French)
  joie: { emoji: '😄', sketch: 'smile', weight: 8 },
  sourire: { emoji: '😊', sketch: 'smile', weight: 8 },
  rire: { emoji: '😂', sketch: 'smile', weight: 8 },
  fete: { emoji: '🎉', sketch: 'party', weight: 9 },
  feter: { emoji: '🥳', sketch: 'party', weight: 8 },
  danser: { emoji: '💃', sketch: 'party', weight: 9 },
  danse: { emoji: '🕺', sketch: 'party', weight: 9 },
  musique: { emoji: '🎵', sketch: 'disc', weight: 9 },
  chanter: { emoji: '🎤', sketch: 'mic', weight: 9 },
  voix: { emoji: '🎤', sketch: 'mic', weight: 8 },
  chanson: { emoji: '🎶', sketch: 'disc', weight: 8 },
  son: { emoji: '🔊', sketch: 'radio', weight: 8 },

  // Wealth (French)
  argent: { emoji: '💸', sketch: 'money', weight: 10 },
  sous: { emoji: '💰', sketch: 'money', weight: 9 },
  riche: { emoji: '🤑', sketch: 'money', weight: 9 },
  or: { emoji: '🪙', sketch: 'crown', weight: 9 },
  diamant: { emoji: '💎', sketch: 'star', weight: 9 },
  roi: { emoji: '👑', sketch: 'crown', weight: 10 },
  reine: { emoji: '👑', sketch: 'crown', weight: 10 },
  couronne: { emoji: '👑', sketch: 'crown', weight: 9 },
  voiture: { emoji: '🏎️', sketch: 'car', weight: 8 },
  rouler: { emoji: '🚗', sketch: 'car', weight: 7 },
  vite: { emoji: '💨', sketch: 'car', weight: 8 },
  voler: { emoji: '🕊️', weight: 8 },
  mer: { emoji: '🌊', sketch: 'waves', weight: 8 },
  vague: { emoji: '🌊', sketch: 'waves', weight: 8 },
  pluie: { emoji: '🌧️', sketch: 'crying', weight: 9 },
  pleuvoir: { emoji: '🌧️', sketch: 'crying', weight: 9 },
  neige: { emoji: '❄️', sketch: 'crying', weight: 10 },
  froid: { emoji: '🥶', sketch: 'crying', weight: 9 },
  glace: { emoji: '❄️', sketch: 'crying', weight: 9 },
  hiver: { emoji: '❄️', sketch: 'crying', weight: 8 },
  monde: { emoji: '🌍', weight: 8 },

  // === ENGLISH ===
  // Love & Romance
  love: { emoji: '💖', sketch: 'heart', weight: 10 },
  loving: { emoji: '💖', sketch: 'heart', weight: 9 },
  loved: { emoji: '❤️', sketch: 'heart', weight: 8 },
  heart: { emoji: '❤️', sketch: 'heart', weight: 10 },
  hearts: { emoji: '💕', sketch: 'heart', weight: 9 },
  baby: { emoji: '👶', weight: 8 },
  babe: { emoji: '🥰', weight: 8 },
  kiss: { emoji: '💋', weight: 8 },
  kisses: { emoji: '💋', weight: 8 },
  kissing: { emoji: '😘', weight: 8 },
  lips: { emoji: '👄', weight: 7 },
  sweet: { emoji: '🍭', weight: 7 },
  honey: { emoji: '🍯', weight: 7 },
  darling: { emoji: '🥰', sketch: 'heart', weight: 8 },
  flower: { emoji: '🌸', sketch: 'rose', weight: 7 },
  flowers: { emoji: '🌺', sketch: 'rose', weight: 7 },
  eyes: { emoji: '👀', sketch: 'eyes', weight: 9 },
  look: { emoji: '👀', sketch: 'eyes', weight: 8 },
  see: { emoji: '👁️', sketch: 'eyes', weight: 8 },

  // Fire & Energy (English)
  fire: { emoji: '🔥', sketch: 'fire', weight: 10 },
  flame: { emoji: '🔥', sketch: 'fire', weight: 9 },
  flames: { emoji: '🔥', sketch: 'fire', weight: 9 },
  burn: { emoji: '🔥', sketch: 'fire', weight: 9 },
  burning: { emoji: '🔥', sketch: 'fire', weight: 9 },
  lit: { emoji: '🔥', sketch: 'fire', weight: 8 },
  hot: { emoji: '🔥', sketch: 'fire', weight: 8 },
  blaze: { emoji: '🔥', sketch: 'fire', weight: 9 },
  power: { emoji: '⚡', sketch: 'zap', weight: 9 },
  lightning: { emoji: '⚡', sketch: 'zap', weight: 9 },
  thunder: { emoji: '⚡', sketch: 'zap', weight: 8 },
  electric: { emoji: '⚡', sketch: 'zap', weight: 9 },
  energy: { emoji: '⚡', sketch: 'zap', weight: 8 },
  strong: { emoji: '💪', sketch: 'dumbbell', weight: 8 },
  workout: { emoji: '🏋️', sketch: 'dumbbell', weight: 8 },
  heavy: { emoji: '🏋️', sketch: 'dumbbell', weight: 8 },
  champion: { emoji: '🏆', sketch: 'crown', weight: 9 },
  winner: { emoji: '🏆', weight: 8 },
  win: { emoji: '🏆', weight: 8 },
  rocket: { emoji: '🚀', sketch: 'rocket', weight: 10 },

  // Night, Stars, Sky & Nature (English)
  night: { emoji: '🌙', sketch: 'moon', weight: 9 },
  nights: { emoji: '🌙', sketch: 'moon', weight: 9 },
  midnight: { emoji: '🕛', sketch: 'moon', weight: 8 },
  moon: { emoji: '🌕', sketch: 'moon', weight: 10 },
  moonlight: { emoji: '🌕', sketch: 'moon', weight: 9 },
  star: { emoji: '⭐', sketch: 'star', weight: 9 },
  stars: { emoji: '✨', sketch: 'sparkle', weight: 9 },
  shine: { emoji: '✨', sketch: 'sparkle', weight: 8 },
  shining: { emoji: '✨', sketch: 'sparkle', weight: 8 },
  glow: { emoji: '✨', sketch: 'sparkle', weight: 8 },
  glowing: { emoji: '✨', sketch: 'sparkle', weight: 8 },
  spark: { emoji: '✨', sketch: 'sparkle', weight: 8 },
  magic: { emoji: '🪄', sketch: 'sparkle', weight: 8 },
  sun: { emoji: '☀️', sketch: 'sun', weight: 9 },
  sunny: { emoji: '☀️', sketch: 'sun', weight: 8 },
  morning: { emoji: '🌅', sketch: 'sun', weight: 7 },
  light: { emoji: '💡', sketch: 'sun', weight: 7 },
  sky: { emoji: '🌌', weight: 7 },
  clouds: { emoji: '☁️', weight: 7 },
  cloud: { emoji: '☁️', weight: 7 },
  rain: { emoji: '🌧️', sketch: 'crying', weight: 9 },
  raining: { emoji: '🌧️', sketch: 'crying', weight: 9 },
  snow: { emoji: '❄️', sketch: 'crying', weight: 10 },
  snowing: { emoji: '❄️', sketch: 'crying', weight: 10 },
  cold: { emoji: '🥶', sketch: 'crying', weight: 9 },
  ice: { emoji: '❄️', sketch: 'crying', weight: 9 },
  freeze: { emoji: '❄️', sketch: 'crying', weight: 9 },
  freezing: { emoji: '❄️', sketch: 'crying', weight: 9 },
  winter: { emoji: '❄️', sketch: 'crying', weight: 8 },
  storm: { emoji: '⛈️', sketch: 'zap', weight: 8 },
  wind: { emoji: '💨', weight: 7 },
  sea: { emoji: '🌊', sketch: 'waves', weight: 8 },
  ocean: { emoji: '🌊', sketch: 'waves', weight: 8 },
  wave: { emoji: '🌊', sketch: 'waves', weight: 8 },
  waves: { emoji: '🌊', sketch: 'waves', weight: 8 },
  dream: { emoji: '💭', weight: 8 },
  dreams: { emoji: '💭', weight: 8 },
  dreaming: { emoji: '💭', weight: 8 },
  sleep: { emoji: '😴', weight: 7 },

  // Sadness, Tears & Pain (English)
  cry: { emoji: '😭', sketch: 'crying', weight: 10 },
  crying: { emoji: '😭', sketch: 'crying', weight: 10 },
  tears: { emoji: '💧', sketch: 'crying', weight: 10 },
  tear: { emoji: '💧', sketch: 'crying', weight: 9 },
  sad: { emoji: '🥺', sketch: 'crying', weight: 9 },
  hurt: { emoji: '💔', sketch: 'broken_heart', weight: 9 },
  broken: { emoji: '💔', sketch: 'broken_heart', weight: 10 },
  break: { emoji: '💔', sketch: 'broken_heart', weight: 8 },
  breaking: { emoji: '💔', sketch: 'broken_heart', weight: 8 },
  pain: { emoji: '🩹', sketch: 'broken_heart', weight: 8 },
  alone: { emoji: '🚶', weight: 8 },
  lonely: { emoji: '🥺', weight: 8 },
  dead: { emoji: '💀', sketch: 'skull', weight: 10 },
  die: { emoji: '💀', sketch: 'skull', weight: 9 },
  dying: { emoji: '💀', sketch: 'skull', weight: 9 },
  kill: { emoji: '☠️', sketch: 'skull', weight: 9 },
  grave: { emoji: '⚰️', sketch: 'skull', weight: 8 },
  ghost: { emoji: '👻', sketch: 'ghost', weight: 9 },

  // Joy, Party, Dance & Music (English)
  smile: { emoji: '😊', sketch: 'smile', weight: 8 },
  smiling: { emoji: '😊', sketch: 'smile', weight: 8 },
  happy: { emoji: '😄', sketch: 'smile', weight: 8 },
  laugh: { emoji: '😂', sketch: 'smile', weight: 8 },
  laughing: { emoji: '🤣', sketch: 'smile', weight: 8 },
  party: { emoji: '🎉', sketch: 'party', weight: 9 },
  celebrate: { emoji: '🥳', sketch: 'party', weight: 9 },
  club: { emoji: '🪩', sketch: 'party', weight: 8 },
  dance: { emoji: '💃', sketch: 'party', weight: 9 },
  dancing: { emoji: '🕺', sketch: 'party', weight: 9 },
  music: { emoji: '🎵', sketch: 'disc', weight: 9 },
  song: { emoji: '🎶', sketch: 'disc', weight: 8 },
  beat: { emoji: '🎧', sketch: 'waves', weight: 8 },
  bass: { emoji: '🔊', sketch: 'waves', weight: 8 },
  dj: { emoji: '🎧', sketch: 'disc', weight: 9 },
  vinyl: { emoji: '💿', sketch: 'disc', weight: 9 },
  spin: { emoji: '🔄', sketch: 'disc', weight: 8 },
  sing: { emoji: '🎤', sketch: 'mic', weight: 9 },
  singing: { emoji: '🎤', sketch: 'mic', weight: 9 },
  rap: { emoji: '🎤', sketch: 'mic', weight: 9 },
  voice: { emoji: '🎙️', sketch: 'mic', weight: 8 },
  radio: { emoji: '📻', sketch: 'radio', weight: 8 },
  rock: { emoji: '🎸', sketch: 'skull', weight: 8 },
  guitar: { emoji: '🎸', weight: 8 },

  // Wealth, Royalty, Speed (English)
  money: { emoji: '💸', sketch: 'money', weight: 10 },
  cash: { emoji: '💰', sketch: 'money', weight: 9 },
  rich: { emoji: '🤑', sketch: 'money', weight: 9 },
  dollar: { emoji: '💵', sketch: 'money', weight: 9 },
  dollars: { emoji: '💵', sketch: 'money', weight: 9 },
  gold: { emoji: '🪙', sketch: 'crown', weight: 9 },
  diamond: { emoji: '💎', sketch: 'star', weight: 9 },
  diamonds: { emoji: '💎', sketch: 'star', weight: 9 },
  king: { emoji: '👑', sketch: 'crown', weight: 10 },
  queen: { emoji: '👑', sketch: 'crown', weight: 10 },
  crown: { emoji: '👑', sketch: 'crown', weight: 9 },
  boss: { emoji: '😎', sketch: 'crown', weight: 8 },
  car: { emoji: '🏎️', sketch: 'car', weight: 8 },
  cars: { emoji: '🚗', sketch: 'car', weight: 8 },
  drive: { emoji: '🚗', sketch: 'car', weight: 8 },
  driving: { emoji: '🏎️', sketch: 'car', weight: 8 },
  ride: { emoji: '🏍️', sketch: 'car', weight: 8 },
  fast: { emoji: '💨', sketch: 'car', weight: 8 },
  speed: { emoji: '⚡', sketch: 'car', weight: 8 },
  run: { emoji: '🏃', weight: 7 },
  running: { emoji: '🏃', weight: 7 },
  flying: { emoji: '✈️', weight: 8 },
  world: { emoji: '🌍', weight: 8 },
  earth: { emoji: '🌎', weight: 8 },
  game: { emoji: '🎮', weight: 7 },
  phone: { emoji: '📱', weight: 7 },
  call: { emoji: '📞', weight: 7 },
  ring: { emoji: '💍', weight: 8 },
  time: { emoji: '⏳', sketch: 'clock', weight: 8 },
  clock: { emoji: '⏰', sketch: 'clock', weight: 8 },
  forever: { emoji: '♾️', weight: 8 },
  gem: { emoji: '💎', sketch: 'gem', weight: 9 },
  crystal: { emoji: '🔮', sketch: 'gem', weight: 8 },
  planet: { emoji: '🪐', sketch: 'planet', weight: 9 },
  universe: { emoji: '🌌', sketch: 'planet', weight: 9 },
  space: { emoji: '🚀', sketch: 'rocket', weight: 9 },
  wings: { emoji: '🪽', sketch: 'wings', weight: 9 },
  angel: { emoji: '👼', sketch: 'wings', weight: 9 },
  shield: { emoji: '🛡️', sketch: 'shield', weight: 9 },
  protect: { emoji: '🛡️', sketch: 'shield', weight: 8 },
  safe: { emoji: '🔒', sketch: 'shield', weight: 7 },
  tornado: { emoji: '🌪️', sketch: 'wind', weight: 9 },
  harmony: { emoji: '🎵', sketch: 'notes', weight: 8 },
  // Arabic additions for new sketches
  ساعة: { emoji: '⏰', sketch: 'clock', weight: 8 },
  وقت: { emoji: '⏳', sketch: 'clock', weight: 8 },
  جوهرة: { emoji: '💎', sketch: 'gem', weight: 9 },
  كوكب: { emoji: '🪐', sketch: 'planet', weight: 9 },
  فضاء: { emoji: '🚀', sketch: 'rocket', weight: 9 },
  جناح: { emoji: '🪽', sketch: 'wings', weight: 9 },
  اجنحة: { emoji: '🪽', sketch: 'wings', weight: 9 },
  ملاك: { emoji: '👼', sketch: 'wings', weight: 9 },
  درع: { emoji: '🛡️', sketch: 'shield', weight: 9 },
  حماية: { emoji: '🛡️', sketch: 'shield', weight: 8 },
  عاصفة: { emoji: '🌪️', sketch: 'wind', weight: 9 },
  نغمات: { emoji: '🎶', sketch: 'notes', weight: 9 },
  الحان: { emoji: '🎵', sketch: 'notes', weight: 8 },
  // French additions for new sketches
  heure: { emoji: '⏰', sketch: 'clock', weight: 8 },
  temps: { emoji: '⏳', sketch: 'clock', weight: 8 },
  bijou: { emoji: '💎', sketch: 'gem', weight: 9 },
  planete: { emoji: '🪐', sketch: 'planet', weight: 9 },
  espace: { emoji: '🚀', sketch: 'rocket', weight: 9 },
  fusee: { emoji: '🚀', sketch: 'rocket', weight: 10 },
  ailes: { emoji: '🪽', sketch: 'wings', weight: 9 },
  ange: { emoji: '👼', sketch: 'wings', weight: 9 },
  bouclier: { emoji: '🛡️', sketch: 'shield', weight: 9 },
  tempete: { emoji: '🌪️', sketch: 'wind', weight: 9 },
  melodie: { emoji: '🎶', sketch: 'notes', weight: 9 },

  // --- Expanded Arabic Everyday & Poetic Words ---
  احبك: { emoji: '❤️', sketch: 'heart', weight: 10 },
  اعشقك: { emoji: '💘', sketch: 'heart', weight: 10 },
  هوانا: { emoji: '💖', sketch: 'heart', weight: 9 },
  عيون: { emoji: '👀', sketch: 'eyes', weight: 9 },
  عيوني: { emoji: '👀', sketch: 'eyes', weight: 9 },
  حنان: { emoji: '🥰', sketch: 'heart', weight: 8 },
  شاعل: { emoji: '🔥', sketch: 'fire', weight: 9 },
  ولعان: { emoji: '🔥', sketch: 'fire', weight: 9 },
  جمر: { emoji: '🔥', sketch: 'fire', weight: 9 },
  شرار: { emoji: '✨', sketch: 'sparkle', weight: 9 },
  رصاص: { emoji: '💥', sketch: 'zap', weight: 8 },
  بارود: { emoji: '💥', sketch: 'zap', weight: 9 },
  حديد: { emoji: '💪', sketch: 'dumbbell', weight: 8 },
  وحش: { emoji: '🦁', sketch: 'crown', weight: 8 },
  صقر: { emoji: '🦅', sketch: 'wings', weight: 8 },
  اسد: { emoji: '🦁', sketch: 'crown', weight: 8 },
  عتمة: { emoji: '🌑', sketch: 'moon', weight: 8 },
  ضاوية: { emoji: '💡', sketch: 'sun', weight: 8 },
  ضاي: { emoji: '💡', sketch: 'sun', weight: 8 },
  شتي: { emoji: '🌧️', sketch: 'crying', weight: 9 },
  صقيع: { emoji: '🥶', sketch: 'crying', weight: 9 },
  وداع: { emoji: '🥀', sketch: 'broken_heart', weight: 9 },
  غياب: { emoji: '💔', sketch: 'broken_heart', weight: 8 },
  عذاب: { emoji: '💔', sketch: 'broken_heart', weight: 8 },
  ندم: { emoji: '🥺', sketch: 'crying', weight: 8 },
  قصر: { emoji: '🏰', sketch: 'crown', weight: 9 },
  ملايين: { emoji: '💸', sketch: 'money', weight: 10 },
  طيارة: { emoji: '✈️', sketch: 'wings', weight: 8 },
  طبل: { emoji: '🪘', sketch: 'party', weight: 8 },
  عود: { emoji: '🪕', sketch: 'notes', weight: 8 },
  صقف: { emoji: '👏', sketch: 'party', weight: 8 },
  فرحة: { emoji: '🎉', sketch: 'party', weight: 9 },
  سافر: { emoji: '✈️', sketch: 'wings', weight: 8 },
  طار: { emoji: '🕊️', sketch: 'wings', weight: 8 },
  ريح: { emoji: '💨', sketch: 'wind', weight: 8 },

  // --- Expanded French Modern & Poetic Words ---
  taime: { emoji: '❤️', sketch: 'heart', weight: 10 },
  adore: { emoji: '🥰', sketch: 'heart', weight: 9 },
  adorer: { emoji: '🥰', sketch: 'heart', weight: 9 },
  calin: { emoji: '🫂', sketch: 'heart', weight: 8 },
  calins: { emoji: '🫂', sketch: 'heart', weight: 8 },
  princesse: { emoji: '👑', sketch: 'crown', weight: 9 },
  enfer: { emoji: '🔥', sketch: 'fire', weight: 9 },
  etincelle: { emoji: '✨', sketch: 'sparkle', weight: 9 },
  etincelles: { emoji: '✨', sketch: 'sparkle', weight: 9 },
  explosion: { emoji: '💥', sketch: 'fire', weight: 9 },
  volcan: { emoji: '🌋', sketch: 'fire', weight: 9 },
  lumiere: { emoji: '💡', sketch: 'sun', weight: 8 },
  lumieres: { emoji: '💡', sketch: 'sun', weight: 8 },
  aube: { emoji: '🌅', sketch: 'sun', weight: 8 },
  orage: { emoji: '⛈️', sketch: 'zap', weight: 9 },
  orages: { emoji: '⛈️', sketch: 'zap', weight: 9 },
  souffrir: { emoji: '💔', sketch: 'broken_heart', weight: 9 },
  souffrance: { emoji: '💔', sketch: 'broken_heart', weight: 9 },
  adieu: { emoji: '🥀', sketch: 'broken_heart', weight: 9 },
  disparu: { emoji: '🕊️', sketch: 'ghost', weight: 8 },
  fantome: { emoji: '👻', sketch: 'ghost', weight: 9 },
  cercueil: { emoji: '⚰️', sketch: 'skull', weight: 9 },
  millions: { emoji: '💸', sketch: 'money', weight: 10 },
  billets: { emoji: '💵', sketch: 'money', weight: 9 },
  tresor: { emoji: '💎', sketch: 'gem', weight: 9 },
  chateau: { emoji: '🏰', sketch: 'crown', weight: 8 },
  luxe: { emoji: '👑', sketch: 'crown', weight: 8 },
  rythme: { emoji: '🥁', sketch: 'notes', weight: 8 },
  refrain: { emoji: '🎶', sketch: 'notes', weight: 8 },
  ambiance: { emoji: '🎉', sketch: 'party', weight: 9 },
  folie: { emoji: '🥳', sketch: 'party', weight: 8 },
  rapide: { emoji: '⚡', sketch: 'car', weight: 8 },
  bolide: { emoji: '🏎️', sketch: 'car', weight: 9 },
  moteur: { emoji: '🏎️', sketch: 'car', weight: 8 },
  souffle: { emoji: '💨', sketch: 'wind', weight: 8 },

  // --- Expanded English Modern & Chart-Topping Words ---
  lover: { emoji: '🥰', sketch: 'heart', weight: 9 },
  lovers: { emoji: '🥰', sketch: 'heart', weight: 9 },
  romance: { emoji: '💖', sketch: 'heart', weight: 9 },
  embrace: { emoji: '🫂', sketch: 'heart', weight: 8 },
  beautiful: { emoji: '✨', sketch: 'sparkle', weight: 8 },
  gorgeous: { emoji: '✨', sketch: 'sparkle', weight: 8 },
  inferno: { emoji: '🔥', sketch: 'fire', weight: 10 },
  blast: { emoji: '💥', sketch: 'fire', weight: 9 },
  explode: { emoji: '💥', sketch: 'fire', weight: 9 },
  galaxy: { emoji: '🌌', sketch: 'planet', weight: 9 },
  galaxies: { emoji: '🌌', sketch: 'planet', weight: 9 },
  cosmic: { emoji: '🪐', sketch: 'planet', weight: 9 },
  sunrise: { emoji: '🌅', sketch: 'sun', weight: 8 },
  sunset: { emoji: '🌇', sketch: 'sun', weight: 8 },
  weep: { emoji: '😭', sketch: 'crying', weight: 10 },
  weeping: { emoji: '😭', sketch: 'crying', weight: 10 },
  blizzard: { emoji: '❄️', sketch: 'crying', weight: 10 },
  frost: { emoji: '❄️', sketch: 'crying', weight: 9 },
  heartbreak: { emoji: '💔', sketch: 'broken_heart', weight: 10 },
  heartbroken: { emoji: '💔', sketch: 'broken_heart', weight: 10 },
  poison: { emoji: '☠️', sketch: 'skull', weight: 9 },
  coffin: { emoji: '⚰️', sketch: 'skull', weight: 9 },
  racks: { emoji: '💸', sketch: 'money', weight: 9 },
  bands: { emoji: '💸', sketch: 'money', weight: 9 },
  throne: { emoji: '👑', sketch: 'crown', weight: 10 },
  empire: { emoji: '👑', sketch: 'crown', weight: 9 },
  groove: { emoji: '🎶', sketch: 'notes', weight: 8 },
  vibe: { emoji: '🎶', sketch: 'notes', weight: 8 },
  vibes: { emoji: '🎶', sketch: 'notes', weight: 8 },
  cheer: { emoji: '🎉', sketch: 'party', weight: 8 },
  cheering: { emoji: '🎉', sketch: 'party', weight: 8 },
  race: { emoji: '🏎️', sketch: 'car', weight: 9 },
  racing: { emoji: '🏎️', sketch: 'car', weight: 9 },
  rush: { emoji: '💨', sketch: 'car', weight: 8 },
  breeze: { emoji: '💨', sketch: 'wind', weight: 8 },
};

const ANIMATION_ROTATIONS = [-7, -5, -3, -1, 1, 3, 5, 7, 0];
const ANIMATION_PRESETS: ReelAnimationPreset[] = [
  'pop_bounce',
  'pulse_heartbeat',
  'fire_flare',
  'slam_shake',
  'neon_glitch',
  'strobe_flash',
  'slide_up',
  'slide_down',
  'slide_left',
  'slide_right',
  'spin_in',
  'tilt_wave',
  'float_drift',
  'zoom_shatter',
  'elastic_drop',
  'glow_burst',
  'rubber_band',
  'typewriter',
  'swing_sway',
  'spiral_pop',
];

/**
 * Intelligent Multilingual Smart Procedural Reel Director (runs in 0ms)
 * Used as instant preview, fallback, and offline choreographer.
 * STRICTLY ENFORCES MAX 1 EMOJI / SKETCH PER PHRASE.
 */
export function generateSmartReelPlan(
  trackId: string,
  syncedLines: SyncedLyricsLine[]
): ReelDirectorPlan {
  const lines: ReelLine[] = [];

  for (let i = 0; i < syncedLines.length; i++) {
    const line = syncedLines[i];
    const nextLine = syncedLines[i + 1];
    const lineStartTime = line.time;
    const lineEndTime = nextLine ? nextLine.time : lineStartTime + 4.5;
    const duration = Math.max(1.2, lineEndTime - lineStartTime);

    const isRtl = isArabicText(line.text || '');

    // Split words preserving punctuation on raw words
    const rawWords = (line.text || '').trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) continue;

    const wordDuration = duration / rawWords.length;

    // STEP 1: Find all candidate emotion matches in this line
    interface Candidate {
      wordIdx: number;
      match: EmotionMatch;
    }
    const candidates: Candidate[] = [];

    rawWords.forEach((word, wIdx) => {
      const norm = normalizeLyricWord(word);
      const match = MULTILINGUAL_EMOTIONS[norm];
      if (match) {
        candidates.push({ wordIdx: wIdx, match });
      }
    });

    // STEP 2: Choose AT MOST ONE (MAX 1) best emoji/sketch for the whole line
    // ONLY if the candidate has a strong, unambiguous emotional keyword (weight >= 9)
    let bestCandidateIdx = -1;
    let highestWeight = 8; // Threshold: only genuine strong emotion/thematic keywords

    candidates.forEach((c) => {
      if (c.match.weight > highestWeight) {
        highestWeight = c.match.weight;
        bestCandidateIdx = c.wordIdx;
      }
    });

    // STEP 3: Build words for the line with dynamic kinetic typography
    const words: ReelWord[] = [];

    rawWords.forEach((word, wIdx) => {
      const isBestWord = wIdx === bestCandidateIdx;
      const match = isBestWord ? candidates.find((c) => c.wordIdx === wIdx)?.match : undefined;

      const emoji = match?.emoji;
      const sketch = match?.sketch;

      // Dynamic rotation angle
      const rot = ANIMATION_ROTATIONS[(i * 3 + wIdx * 2) % ANIMATION_ROTATIONS.length];

      // Assign punchy animation preset
      let anim: ReelAnimationPreset = 'pop_bounce';
      if (emoji || sketch) {
        if (sketch === 'heart' || sketch === 'broken_heart') {
          anim = 'pulse_heartbeat';
        } else if (sketch === 'fire' || sketch === 'sun') {
          anim = 'fire_flare';
        } else if (sketch === 'zap' || sketch === 'sparkle' || sketch === 'star') {
          anim = 'strobe_flash';
        } else {
          anim = wIdx % 2 === 0 ? 'slam_shake' : 'zoom_shatter';
        }
      } else if (wIdx === 0) {
        anim = 'slide_up';
      } else if (wIdx === rawWords.length - 1) {
        anim = 'pop_bounce';
      } else {
        anim = ANIMATION_PRESETS[(wIdx + i) % ANIMATION_PRESETS.length];
      }

      // Varied layout positioning
      let pos: ReelWord['pos'] = 'center';
      if (emoji || sketch) {
        pos = 'dramatic_zoom';
      } else if (wIdx % 4 === 1) {
        pos = isRtl ? 'top_right' : 'top_left';
      } else if (wIdx % 4 === 2) {
        pos = isRtl ? 'bottom_left' : 'bottom_right';
      } else if (wIdx % 4 === 3) {
        pos = isRtl ? 'top_left' : 'top_right';
      }

      words.push({
        text: word,
        originalWord: word,
        startTime: lineStartTime + wIdx * wordDuration,
        endTime: lineStartTime + (wIdx + 1) * wordDuration,
        anim,
        rot: isRtl ? -rot : rot,
        pos,
        emoji,
        sketch,
      });
    });

    lines.push({
      time: lineStartTime,
      endTime: lineEndTime,
      rawText: line.text,
      isRtl,
      words,
    });
  }

  const finalPlan: ReelDirectorPlan = {
    trackId,
    source: 'lyrics_plus',
    lines,
  };

  // Cache in-memory for instant 0ms access
  directorCache.set(trackId, finalPlan);

  // Persist to localStorage so downloaded/offline tracks are 100% ready with animated lyrics
  try {
    localStorage.setItem(`mouzika_lyrics_plus_${trackId}`, JSON.stringify(finalPlan));
  } catch {}

  return finalPlan;
}

export const generateLyricsPlusPlan = generateSmartReelPlan;

// Retrieve offline plan if available
export function getOfflineLyricsPlusPlan(trackId: string): ReelDirectorPlan | null {
  if (!trackId) return null;
  const inMem = directorCache.get(trackId);
  if (inMem) return inMem;
  try {
    const raw = localStorage.getItem(`mouzika_lyrics_plus_${trackId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.lines)) {
        directorCache.set(trackId, parsed);
        return parsed;
      }
    }
  } catch {}
  return null;
}
