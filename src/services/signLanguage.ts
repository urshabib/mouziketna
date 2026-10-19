/**
 * SIGN LANGUAGE SERVICE FOR MOUZIKETNA
 * Provides 100% offline, lightweight (< 50KB) ASL (American Sign Language) &
 * universal sign language representations for lyrics kinetic typography.
 *
 * Maps high-frequency song words (English, French, Arabic phonetics) to iconic
 * sign handshapes and emojis, and provides fingerspelling handshape fallbacks
 * for unknown or custom words.
 */

export interface SignLanguageInfo {
  word: string;
  cleanWord: string;
  handSign: string;
  label?: string;
  isFingerspelled: boolean;
  fingerspellingGlyphs?: string[];
}

// ASL Alphabet Fingerspelling Handshapes
export const ASL_ALPHABET_HANDS: Record<string, string> = {
  a: '✊', // Closed fist with thumb on side
  b: '✋', // Open four fingers, thumb tucked
  c: '🤏', // Curved C cup
  d: '👆', // Index straight up, thumb touching middle/ring
  e: '✊', // Curled fingers over thumb
  f: '👌', // OK sign: index and thumb circle, 3 fingers up
  g: '👈', // Index and thumb parallel pointing sideways
  h: '✌️', // Index and middle pointing sideways
  i: '🤙', // Pinky extended up
  j: '🤙', // Pinky tracing J
  k: '✌️', // Index up, middle forward, thumb between
  l: '👆', // L-shape thumb and index
  m: '✊', // Three fingers tucked over thumb
  n: '✊', // Two fingers tucked over thumb
  o: '⭕', // O-shape all fingers touching thumb
  p: '✌️', // K pointing downwards
  q: '👇', // G pointing downwards
  r: '🤞', // Crossed index and middle
  s: '✊', // Fist with thumb across front
  t: '✊', // Thumb tucked under index
  u: '✌️', // Index and middle together pointing up
  v: '✌️', // Peace / V-sign
  w: '🖐️', // Three fingers (W) pointing up
  x: '☝️', // Hooked index finger
  y: '🤙', // Thumb and pinky extended (horns/hang-loose)
  z: '☝️', // Index finger tracing Z
};

// Rich offline sign language dictionary for high-frequency song lyrics
// Format: word -> [Primary Hand Sign, Clean Sign Label]
const SIGN_DICTIONARY: Record<string, [string, string]> = {
  // Love & Emotion
  love: ['🤟', 'Love'],
  loved: ['🤟', 'Love'],
  loves: ['🤟', 'Love'],
  loving: ['🤟', 'Love'],
  heart: ['🫶', 'Heart'],
  hearts: ['🫶', 'Heart'],
  amour: ['🤟', 'Love'],
  hob: ['🤟', 'Love'],
  habibi: ['🫶', 'My Love'],
  habib: ['🫶', 'Beloved'],
  nhebek: ['🤟', 'Love You'],
  feel: ['🫱', 'Feel'],
  feeling: ['🫱', 'Feel'],
  feels: ['🫱', 'Feel'],
  happy: ['😊👋', 'Happy'],
  smile: ['😁✌️', 'Smile'],
  cry: ['😢👇', 'Cry'],
  crying: ['😢👇', 'Cry'],
  tears: ['💧👇', 'Tears'],
  hurt: ['🤕✊', 'Hurt'],
  pain: ['🤕✊', 'Pain'],
  dream: ['💭👆', 'Dream'],
  dreams: ['💭👆', 'Dream'],
  hope: ['🤞', 'Hope'],
  soul: ['✨🤲', 'Soul'],
  mind: ['🧠👆', 'Mind'],
  think: ['🧠👆', 'Think'],
  thinking: ['🧠👆', 'Think'],
  passion: ['🔥🫶', 'Passion'],

  // Pronouns & Identity
  you: ['🫵', 'You'],
  your: ['🫵', 'Your'],
  yours: ['🫵', 'Yours'],
  me: ['👈', 'Me'],
  my: ['👈', 'My'],
  mine: ['👈', 'Mine'],
  i: ['👈', 'I'],
  we: ['👐', 'We'],
  us: ['👐', 'Us'],
  our: ['👐', 'Our'],
  they: ['👉', 'They'],
  them: ['👉', 'Them'],
  he: ['👉', 'He'],
  she: ['👉', 'She'],
  him: ['👉', 'Him'],
  her: ['👉', 'Her'],
  who: ['❓👆', 'Who'],
  what: ['🤷👐', 'What'],
  where: ['📍👉', 'Where'],
  when: ['⏱️👆', 'When'],
  why: ['❓👉', 'Why'],
  how: ['🤝', 'How'],
  toi: ['🫵', 'You'],
  moi: ['👈', 'Me'],
  ana: ['👈', 'Me'],
  enta: ['🫵', 'You'],
  ahna: ['👐', 'We'],

  // People & Relations
  baby: ['👶🤲', 'Baby'],
  girl: ['👧🫱', 'Girl'],
  boy: ['👦🫱', 'Boy'],
  friend: ['🤝', 'Friend'],
  friends: ['🤝', 'Friends'],
  brother: ['🧑✌️', 'Brother'],
  sister: ['🧑✌️', 'Sister'],
  mama: ['👩✋', 'Mother'],
  mother: ['👩✋', 'Mother'],
  papa: ['👨✋', 'Father'],
  father: ['👨✋', 'Father'],
  people: ['👥👐', 'People'],
  ami: ['🤝', 'Friend'],
  saheb: ['🤝', 'Friend'],

  // Music, Dance & Party
  music: ['🎶👐', 'Music'],
  song: ['🎵👐', 'Song'],
  sing: ['🎤👉', 'Sing'],
  singing: ['🎤👉', 'Sing'],
  dance: ['💃✌️', 'Dance'],
  dancing: ['💃✌️', 'Dance'],
  beat: ['🥁👊', 'Beat'],
  rhythm: ['🎶✌️', 'Rhythm'],
  sound: ['🔊✋', 'Sound'],
  voice: ['🗣️👉', 'Voice'],
  rock: ['🤘', 'Rock'],
  party: ['🎉🙌', 'Party'],
  vibe: ['✨🤙', 'Vibe'],
  vibes: ['✨🤙', 'Vibes'],
  loud: ['📢👐', 'Loud'],
  quiet: ['🤫👆', 'Quiet'],
  silent: ['🤫👆', 'Silent'],
  silence: ['🤫👆', 'Silence'],
  listen: ['👂✋', 'Listen'],
  hear: ['👂✋', 'Hear'],
  dj: ['🎧🫳', 'DJ'],
  radio: ['📻✋', 'Radio'],

  // Motion & Actions
  go: ['👉', 'Go'],
  going: ['👉', 'Go'],
  come: ['🫳', 'Come'],
  coming: ['🫳', 'Come'],
  stop: ['✋', 'Stop'],
  wait: ['✋', 'Wait'],
  stay: ['✋', 'Stay'],
  run: ['🏃💨', 'Run'],
  running: ['🏃💨', 'Run'],
  fly: ['🕊️👐', 'Fly'],
  flying: ['🕊️👐', 'Fly'],
  fall: ['🍂👇', 'Fall'],
  falling: ['🍂👇', 'Fall'],
  hold: ['✊', 'Hold'],
  holding: ['✊', 'Hold'],
  touch: ['🫳', 'Touch'],
  kiss: ['💋🤲', 'Kiss'],
  kissing: ['💋🤲', 'Kiss'],
  call: ['🤙', 'Call'],
  calling: ['🤙', 'Call'],
  leave: ['👋', 'Leave'],
  look: ['👁️✌️', 'Look'],
  see: ['👁️✌️', 'See'],
  watch: ['👁️✌️', 'Watch'],
  speak: ['🗣️👉', 'Speak'],
  say: ['🗣️👉', 'Say'],
  tell: ['🗣️👉', 'Tell'],
  take: ['🫳', 'Take'],
  give: ['🤲', 'Give'],
  bring: ['🤲', 'Bring'],
  fight: ['👊', 'Fight'],
  break: ['⚡✊', 'Break'],
  breathe: ['🫁🤲', 'Breathe'],
  alive: ['🌱🤲', 'Alive'],

  // Time & Cosmos
  time: ['⏱️👆', 'Time'],
  now: ['👇👇', 'Now'],
  today: ['👇👇', 'Today'],
  tonight: ['🌙👇', 'Tonight'],
  night: ['🌙🫲', 'Night'],
  nights: ['🌙🫲', 'Nights'],
  day: ['☀️🖐️', 'Day'],
  days: ['☀️🖐️', 'Days'],
  morning: ['🌅🖐️', 'Morning'],
  sun: ['☀️🖐️', 'Sun'],
  moon: ['🌙🫲', 'Moon'],
  star: ['⭐👆', 'Star'],
  stars: ['⭐👆', 'Stars'],
  sky: ['☁️👆', 'Sky'],
  world: ['🌐👐', 'World'],
  light: ['💡🖐️', 'Light'],
  lights: ['💡🖐️', 'Lights'],
  dark: ['🌑✋', 'Dark'],
  darkness: ['🌑✋', 'Dark'],
  fire: ['🔥🖐️', 'Fire'],
  flame: ['🔥🖐️', 'Flame'],
  rain: ['🌧️👐', 'Rain'],
  wind: ['💨👐', 'Wind'],
  forever: ['♾️🤙', 'Forever'],
  always: ['🔄👆', 'Always'],
  never: ['🙅✋', 'Never'],

  // Qualifiers & Words
  yes: ['✊', 'Yes'],
  no: ['🤏', 'No'],
  good: ['👍', 'Good'],
  bad: ['👎', 'Bad'],
  peace: ['✌️', 'Peace'],
  free: ['🕊️👐', 'Free'],
  freedom: ['🕊️👐', 'Freedom'],
  high: ['👆', 'High'],
  low: ['👇', 'Low'],
  up: ['👆', 'Up'],
  down: ['👇', 'Down'],
  hello: ['👋', 'Hello'],
  hi: ['👋', 'Hi'],
  hey: ['👋', 'Hey'],
  bye: ['👋', 'Bye'],
  goodbye: ['👋', 'Goodbye'],
  please: ['🙏', 'Please'],
  thanks: ['🙏', 'Thanks'],
  thank: ['🙏', 'Thank'],
  money: ['🤌', 'Money'],
  gold: ['🪙✨', 'Gold'],
  king: ['👑👆', 'King'],
  queen: ['👑👆', 'Queen'],
  hero: ['🦸✊', 'Hero'],
  strong: ['💪', 'Strong'],
  power: ['⚡✊', 'Power'],
  crazy: ['🤪🤙', 'Crazy'],
  wild: ['🦁👐', 'Wild'],
};

/**
 * Normalizes text to extract cleanly matched keyword
 */
export function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

/**
 * Returns sign language info for any given lyric word.
 * 1. Checks curated high-frequency dictionary
 * 2. If not matched, generates real ASL fingerspelling representation
 */
export function getSignLanguageForWord(rawWord: string): SignLanguageInfo {
  const clean = normalizeWord(rawWord);

  if (!clean) {
    return {
      word: rawWord,
      cleanWord: '',
      handSign: '✋',
      isFingerspelled: false,
    };
  }

  // 1. Direct dictionary match
  if (SIGN_DICTIONARY[clean]) {
    const [handSign, label] = SIGN_DICTIONARY[clean];
    return {
      word: rawWord,
      cleanWord: clean,
      handSign,
      label,
      isFingerspelled: false,
    };
  }

  // 2. Singular / stem match (e.g. "falling" -> "fall", "loves" -> "love")
  if (clean.endsWith('ing') && SIGN_DICTIONARY[clean.slice(0, -3)]) {
    const [handSign, label] = SIGN_DICTIONARY[clean.slice(0, -3)];
    return {
      word: rawWord,
      cleanWord: clean,
      handSign,
      label,
      isFingerspelled: false,
    };
  }
  if (clean.endsWith('s') && SIGN_DICTIONARY[clean.slice(0, -1)]) {
    const [handSign, label] = SIGN_DICTIONARY[clean.slice(0, -1)];
    return {
      word: rawWord,
      cleanWord: clean,
      handSign,
      label,
      isFingerspelled: false,
    };
  }

  // 3. Fallback: ASL Fingerspelling for initial letter + letter glyphs
  const firstLetter = clean.charAt(0);
  const primaryHand = ASL_ALPHABET_HANDS[firstLetter] || '✋';
  const glyphs: string[] = [];

  for (let i = 0; i < Math.min(clean.length, 5); i++) {
    const ch = clean.charAt(i);
    glyphs.push(ASL_ALPHABET_HANDS[ch] || '✋');
  }

  return {
    word: rawWord,
    cleanWord: clean,
    handSign: primaryHand,
    label: clean.length <= 4 ? clean.toUpperCase() : clean.slice(0, 3).toUpperCase(),
    isFingerspelled: true,
    fingerspellingGlyphs: glyphs,
  };
}
