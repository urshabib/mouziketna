import { Track, LyricsData, SyncedLyricsLine, SongHighlight } from '../types';

/**
 * Intelligent Instagram-style highlight extractor that works 100% offline and online.
 * Analyzes synced lyrics for chorus repetition and musical structure,
 * or applies harmonic structure ratios to locate the most famous and listened-to parts.
 * Supports up to 4 key parts maximum.
 */
export function getSongHighlights(
  track: Track | null,
  lyrics: LyricsData | null,
  duration: number
): SongHighlight[] {
  if (!track) return [];

  // Use provided duration or fallback to track metadata or standard 180s for immediate offline rendering
  const effectiveDuration = duration > 0 ? duration : (track.duration && track.duration > 0 ? track.duration : 180);
  if (effectiveDuration <= 0) return [];

  const highlights: SongHighlight[] = [];

  // 1. Try extracting chorus and hooks from synced lyrics if available (online or offline cached)
  if (lyrics?.mode === 'synced' && Array.isArray(lyrics.lines) && lyrics.lines.length > 5) {
    const lines = lyrics.lines as SyncedLyricsLine[];
    const cleanLines = lines
      .map((l) => ({
        ...l,
        normalized: (l.text || '')
          .toLowerCase()
          .replace(/[^\w\s\u0600-\u06FF]/g, '')
          .trim(),
      }))
      .filter((l) => l.normalized.length >= 6);

    // Group repeating lines across the song that occur at least 20s apart
    const repetitionMap: { [key: string]: number[] } = {};
    cleanLines.forEach((line) => {
      if (!repetitionMap[line.normalized]) {
        repetitionMap[line.normalized] = [];
      }
      const existing = repetitionMap[line.normalized];
      if (existing.length === 0 || line.time - existing[existing.length - 1] > 20) {
        existing.push(line.time);
      }
    });

    // Find candidate repeating phrases (the hallmark of a chorus or hook)
    const candidates = Object.entries(repetitionMap)
      .filter(([_, times]) => times.length >= 2)
      .map(([text, times]) => ({
        text,
        occurrences: times,
      }))
      .sort((a, b) => b.occurrences.length - a.occurrences.length);

    if (candidates.length > 0) {
      const bestChorus = candidates[0];
      const occ = bestChorus.occurrences;

      // Map occurrences to distinct highlight parts (up to 4)
      occ.slice(0, 4).forEach((time, idx) => {
        const start = Math.max(0, Math.floor(time));
        const end = Math.min(effectiveDuration, start + 28);
        const labels = ['Chorus 1', 'Main Drop', 'Chorus 2', 'Climax'];
        highlights.push({
          id: `chorus-${idx + 1}`,
          label: labels[idx] || `Key Part ${idx + 1}`,
          startTime: start,
          endTime: end,
          type: idx === 1 ? 'drop' : 'chorus',
        });
      });
    }
  }

  // 2. Harmonic golden ratio fallback & complement for offline or songs without repeating lyrics
  // Standard song structure:
  // Part 1 (Hook / Pre-Chorus): ~22%
  // Part 2 (Main Chorus): ~42%
  // Part 3 (Peak Drop / Climax): ~65%
  // Part 4 (Final Chorus / Outro): ~82%
  const defaultRatios = [
    { ratio: 0.22, label: 'Intro Hook', type: 'hook' as const },
    { ratio: 0.42, label: 'Main Chorus', type: 'chorus' as const },
    { ratio: 0.65, label: 'Peak Drop', type: 'drop' as const },
    { ratio: 0.82, label: 'Final Climax', type: 'chorus' as const },
  ];

  if (highlights.length === 0) {
    // If no lyrics, generate up to 4 key parts based on duration
    const count = effectiveDuration > 170 ? 4 : effectiveDuration > 110 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const def = defaultRatios[i];
      const start = Math.round(effectiveDuration * def.ratio);
      highlights.push({
        id: `harmonic-${i + 1}`,
        label: def.label,
        startTime: start,
        endTime: Math.min(effectiveDuration, start + 25),
        type: def.type,
      });
    }
  } else if (highlights.length < 4) {
    // If lyrics gave 1 or 2 parts, complement with other key harmonic points that don't collide
    for (const def of defaultRatios) {
      if (highlights.length >= 4) break;
      const targetTime = Math.round(effectiveDuration * def.ratio);
      const isTooClose = highlights.some((h) => Math.abs(h.startTime - targetTime) < 25);
      if (!isTooClose) {
        highlights.push({
          id: `harmonic-${def.label.toLowerCase().replace(/\s+/g, '-')}`,
          label: def.label,
          startTime: targetTime,
          endTime: Math.min(effectiveDuration, targetTime + 25),
          type: def.type,
        });
      }
    }
  }

  // Sort chronologically and strictly cap at maximum 4 key parts
  return highlights
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, 4);
}
