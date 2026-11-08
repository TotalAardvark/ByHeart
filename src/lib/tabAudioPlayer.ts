import { isAsciiTabLine } from './chordUtils';
import { parseTabLinePrefixAndContent } from './tabAnalyzer';

const DEFAULT_6_STRING_MIDI = [64, 59, 55, 50, 45, 40]; // E4, B3, G3, D3, A2, E2
const DEFAULT_4_STRING_MIDI = [55, 50, 45, 40]; // G2, D2, A1, E1

const PITCH_CLASS_OFFSET: Record<string, number> = {
  c: 0,
  'c#': 1,
  db: 1,
  d: 2,
  'd#': 3,
  eb: 3,
  e: 4,
  f: 5,
  'f#': 6,
  gb: 6,
  g: 7,
  'g#': 8,
  ab: 8,
  a: 9,
  'a#': 10,
  bb: 10,
  b: 11,
};

function resolveStringBaseMidi(labels: string[]): number[] {
  const defaults =
    labels.length === 4 ? DEFAULT_4_STRING_MIDI : DEFAULT_6_STRING_MIDI;
  return labels.map((raw, idx) => {
    const baseMidi = defaults[idx] ?? Math.max(36, 64 - idx * 5);
    const cleaned = raw.trim().replace(/[0-9]/g, '').toLowerCase();
    const targetPc = PITCH_CLASS_OFFSET[cleaned];
    if (targetPc === undefined) return baseMidi;
    const defaultPc = ((baseMidi % 12) + 12) % 12;
    let diff = targetPc - defaultPc;
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;
    return baseMidi + diff;
  });
}

export interface ScheduledTabNote {
  timeSec: number;
  midi: number;
  durationSec: number;
}

/**
 * Extracts a time-ordered sequence of playable MIDI notes from an array of ASCII tab lines.
 */
export function extractPlayableNotesFromTabLines(
  rawLines: string[]
): ScheduledTabNote[] {
  const tabOnly = rawLines.filter((l) => isAsciiTabLine(l));
  if (tabOnly.length === 0) return [];

  // Group into staff systems of 4..6 strings
  const systems: { label: string; content: string }[][] = [];
  let current: { label: string; content: string }[] = [];

  for (const line of tabOnly) {
    const parsed = parseTabLinePrefixAndContent(line);
    if (!parsed) continue;
    if (
      current.length >= 4 &&
      (parsed.label === 'e' || (current.length >= 6 && parsed.label !== ''))
    ) {
      systems.push(current);
      current = [];
    }
    current.push(parsed);
  }
  if (current.length > 0) {
    systems.push(current);
  }

  const notes: ScheduledTabNote[] = [];
  let cursorTimeSec = 0.05;
  const secPerColumn = 0.055; // ~55ms per character column

  for (const sys of systems) {
    const numStrings = sys.length;
    const labels = sys.map((r) => r.label);
    const baseMidis = resolveStringBaseMidi(labels);
    const maxLen = Math.max(...sys.map((r) => r.content.length));
    const padded = sys.map((r) => r.content.padEnd(maxLen, '-'));

    const consumedUntilCol = new Array<number>(numStrings).fill(-1);
    let emptyRunCols = 0;

    for (let col = 0; col < maxLen; col++) {
      const midiAtCol: number[] = [];

      for (let s = 0; s < numStrings; s++) {
        if (col <= consumedUntilCol[s]) continue;
        const ch = padded[s][col];
        if (ch >= '0' && ch <= '9') {
          let fretStr = ch;
          if (
            col + 1 < maxLen &&
            padded[s][col + 1] >= '0' &&
            padded[s][col + 1] <= '9' &&
            Number(ch + padded[s][col + 1]) <= 24
          ) {
            fretStr += padded[s][col + 1];
            consumedUntilCol[s] = col + 1;
          } else {
            consumedUntilCol[s] = col;
          }
          const fret = Number(fretStr);
          midiAtCol.push(baseMidis[s] + fret);
        }
      }

      if (midiAtCol.length > 0) {
        // Advance time by accumulated empty columns (capped so large visual padding doesn't stall)
        if (emptyRunCols > 0) {
          cursorTimeSec += Math.min(emptyRunCols, 8) * secPerColumn;
          emptyRunCols = 0;
        }
        // Slight strum arpeggiation (12ms between simultaneous chord strings, low to high)
        const sortedMidis = midiAtCol.sort((a, b) => a - b);
        sortedMidis.forEach((midi, idx) => {
          notes.push({
            timeSec: cursorTimeSec + idx * 0.012,
            midi,
            durationSec: 0.65,
          });
        });
        cursorTimeSec += secPerColumn;
      } else {
        emptyRunCols++;
      }
    }

    cursorTimeSec += 0.22; // Brief pause between systems
  }

  return notes;
}

// Singleton playback state so only one chunk plays at a time
let activeAudioCtx: AudioContext | null = null;
let activeStopTimer: number | null = null;
let activePlayingId: string | null = null;
const listeners = new Set<(playingId: string | null) => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn(activePlayingId));
}

export function subscribeTabPlayback(
  listener: (playingId: string | null) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getActivePlayingId(): string | null {
  return activePlayingId;
}

export function stopTabPlayback(): void {
  if (activeStopTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(activeStopTimer);
    activeStopTimer = null;
  }
  if (activeAudioCtx) {
    try {
      activeAudioCtx.close();
    } catch {
      // ignore close errors
    }
    activeAudioCtx = null;
  }
  if (activePlayingId !== null) {
    activePlayingId = null;
    notifyListeners();
  }
}

/**
 * Toggles playback of an ASCII tab chunk using Web Audio API acoustic pluck synthesis.
 */
export function togglePlayTabLines(id: string, tabLines: string[]): void {
  if (activePlayingId === id) {
    stopTabPlayback();
    return;
  }

  stopTabPlayback();

  const scheduled = extractPlayableNotesFromTabLines(tabLines);
  if (scheduled.length === 0) return;

  const AudioCtx =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      : undefined;

  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  activeAudioCtx = ctx;
  activePlayingId = id;
  notifyListeners();

  const now = ctx.currentTime;

  for (const n of scheduled) {
    const startTime = now + n.timeSec;
    const freq = 440 * Math.pow(2, (n.midi - 69) / 12);

    // Warm plucked guitar synthesis: triangle fundamental + filtered harmonic overtone
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4.5, startTime);
    filter.frequency.exponentialRampToValueAtTime(
      freq * 1.4,
      startTime + n.durationSec
    );

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + n.durationSec);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + n.durationSec + 0.02);
    osc2.stop(startTime + n.durationSec + 0.02);
  }

  const totalDurationMs =
    Math.ceil(
      (scheduled[scheduled.length - 1].timeSec +
        scheduled[scheduled.length - 1].durationSec) *
        1000
    ) + 80;

  if (typeof window !== 'undefined') {
    activeStopTimer = window.setTimeout(() => {
      if (activePlayingId === id) {
        stopTabPlayback();
      }
    }, totalDurationMs);
  }
}
