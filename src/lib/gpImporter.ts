import { importer, Settings, model } from '@coderline/alphatab';

export interface GpTrackInfo {
  index: number;
  name: string;
  stringCount: number;
  isPercussion: boolean;
  capo: number;
  tuningLabels: string[];
}

export interface ParsedGpScore {
  title: string;
  artist: string;
  tracks: GpTrackInfo[];
  defaultTrackIndex: number;
  score: model.Score;
}

const MIDI_PITCH_CLASS_NAMES = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

/**
 * Converts a MIDI tuning array (ordered highest string first, e.g. [64, 59, 55, 50, 45, 40])
 * into standard ASCII tab string labels (e.g. ['e', 'B', 'G', 'D', 'A', 'E']).
 */
export function midiTuningsToLabels(tunings: number[]): string[] {
  if (!tunings || tunings.length === 0) {
    return ['e', 'B', 'G', 'D', 'A', 'E'];
  }
  return tunings.map((midi, idx) => {
    const pc = ((midi % 12) + 12) % 12;
    const name = MIDI_PITCH_CLASS_NAMES[pc];
    // Conventionally, the highest E string (string 1, idx 0) is lowercase 'e'
    if (idx === 0 && name === 'E' && tunings.length >= 6) {
      return 'e';
    }
    return name;
  });
}

/**
 * Parses a Guitar Pro file byte buffer (.gp, .gp3, .gp4, .gp5, .gpx) into a structured
 * `ParsedGpScore` with track metadata and default playable guitar/bass track selection.
 */
export function parseGuitarProBytes(bytes: Uint8Array): ParsedGpScore {
  const settings = new Settings();
  const score = importer.ScoreLoader.loadScoreFromBytes(bytes, settings);

  const tracks: GpTrackInfo[] = [];
  score.tracks.forEach((track, idx) => {
    const primaryStaff = track.staves[0];
    const isPercussion = Boolean(primaryStaff?.isPercussion);
    const rawTunings = primaryStaff?.stringTuning?.tunings ?? [];
    const stringCount = isPercussion ? 0 : rawTunings.length || 6;
    const capo = primaryStaff?.capo ?? 0;

    tracks.push({
      index: idx,
      name: track.name?.trim() || `Track ${idx + 1}`,
      stringCount,
      isPercussion,
      capo,
      tuningLabels: midiTuningsToLabels(rawTunings),
    });
  });

  // Pick the best default track: prefer non-percussion 6-string guitar track with notes
  let defaultTrackIndex = 0;
  const nonPercussion = tracks.filter((t) => !t.isPercussion && t.stringCount >= 4);
  if (nonPercussion.length > 0) {
    const sixString = nonPercussion.find((t) => t.stringCount === 6);
    defaultTrackIndex = (sixString ?? nonPercussion[0]).index;
  }

  return {
    title: score.title?.trim() || '',
    artist: score.artist?.trim() || '',
    tracks,
    defaultTrackIndex,
    score,
  };
}

/**
 * Serializes a selected track from a `ParsedGpScore` into clean, bar-aligned ASCII tablature
 * with section headers (`[Intro]`, `[Verse]`, etc.), capo/tuning metadata, and chord annotations.
 */
export function convertGpTrackToAsciiTab(
  parsed: ParsedGpScore,
  trackIndex = parsed.defaultTrackIndex,
  barsPerSystem = 2
): string {
  const { score, tracks } = parsed;
  const track = score.tracks[trackIndex] || score.tracks[0];
  if (!track || track.staves.length === 0) {
    return '';
  }

  const trackInfo = tracks[trackIndex] || tracks[0];
  const staff = track.staves[0];
  const stringLabels =
    trackInfo?.tuningLabels.length >= 4
      ? trackInfo.tuningLabels
      : ['e', 'B', 'G', 'D', 'A', 'E'];
  const numStrings = stringLabels.length;
  const maxLabelLen = Math.max(...stringLabels.map((l) => l.length));

  const lines: string[] = [];

  // 1. Title & Artist header
  const titleAndArtist =
    parsed.title && parsed.artist
      ? `${parsed.title} - ${parsed.artist}`
      : parsed.title || parsed.artist || track.name || 'Imported Tab';
  lines.push(titleAndArtist, '');

  // 2. Preamble metadata (Capo & Tuning)
  const isStandardTuning =
    stringLabels.join('-') === 'e-B-G-D-A-E' ||
    stringLabels.join('-') === 'G-D-A-E';
  lines.push(
    isStandardTuning
      ? 'Standard tuning.'
      : `Tuning: ${[...stringLabels].reverse().join(' ')}`
  );
  if (staff.capo && staff.capo > 0) {
    lines.push(`Capo ${staff.capo}`);
  }
  lines.push('');

  interface RenderedBar {
    sectionHeader?: string;
    stringSlices: string[];
    chords: { chord: string; col: number }[];
    hasNotes: boolean;
  }

  const renderedBars: RenderedBar[] = [];

  for (let bIdx = 0; bIdx < staff.bars.length; bIdx++) {
    const bar = staff.bars[bIdx];
    const masterBar = score.masterBars[bIdx];
    const sectionText = masterBar?.section?.text?.trim() || undefined;

    // Collect beats from primary voice (and any secondary voice with notes)
    const activeBeats: model.Beat[] = [];
    for (const voice of bar.voices) {
      if (!voice || voice.isEmpty) continue;
      for (const beat of voice.beats) {
        if (!beat.isEmpty) {
          activeBeats.push(beat);
        }
      }
      if (activeBeats.length > 0) break; // Primary voice takes precedence for clean ASCII tab
    }

    const stringCols: string[][] = Array.from({ length: numStrings }, () => [
      '-',
    ]);
    const barChords: { chord: string; col: number }[] = [];
    let hasNotes = false;

    for (const beat of activeBeats) {
      const colStart = stringCols[0].length;

      // Check if beat has an associated chord name in staff.chords
      if (beat.chordId && staff.chords && staff.chords.has(beat.chordId)) {
        const chordObj = staff.chords.get(beat.chordId);
        if (chordObj?.name) {
          barChords.push({ chord: chordObj.name.trim(), col: colStart });
        }
      }

      // Map notes on this beat by row index (rowIndex = numStrings - note.string)
      const noteTextsByRow = new Map<number, string>();
      for (const note of beat.notes) {
        if (note.isTieDestination) continue;
        const rowIdx = numStrings - note.string;
        if (rowIdx < 0 || rowIdx >= numStrings) continue;

        let token = note.isDead ? 'x' : String(Math.max(0, note.fret));
        if (note.isHammerPullOrigin) {
          token += 'h';
        } else if (note.slideOutType !== undefined && note.slideOutType !== 0) {
          token += '/';
        } else if (note.bendType !== undefined && note.bendType !== 0) {
          token += 'b';
        }
        noteTextsByRow.set(rowIdx, token);
        hasNotes = true;
      }

      // Compute width needed for this beat column + spacing based on beat duration
      const maxTokenLen = Math.max(
        1,
        ...Array.from(noteTextsByRow.values()).map((t) => t.length)
      );
      // Duration enum in alphaTab: Whole=1, Half=2, Quarter=4, Eighth=8, Sixteenth=16
      const dur = Number(beat.duration) || 8;
      const trailingDashes = dur <= 2 ? 4 : dur === 4 ? 3 : dur === 8 ? 2 : 1;
      const totalBeatWidth = maxTokenLen + trailingDashes;

      for (let r = 0; r < numStrings; r++) {
        const tok = noteTextsByRow.get(r) || '';
        const padded = tok.padEnd(totalBeatWidth, '-');
        for (const ch of padded) {
          stringCols[r].push(ch);
        }
      }
    }

    const stringSlices = stringCols.map((cols) => cols.join(''));
    const repeatTimes =
      masterBar && masterBar.repeatCount > 1
        ? Math.min(8, masterBar.repeatCount)
        : 1;

    for (let rep = 0; rep < repeatTimes; rep++) {
      renderedBars.push({
        sectionHeader: rep === 0 ? sectionText : undefined,
        stringSlices: [...stringSlices],
        chords: barChords.map((c) => ({ ...c })),
        hasNotes,
      });
    }
  }

  // Filter out trailing empty rest bars, and group bars by section into systems of `barsPerSystem`
  let currentSystemBars: RenderedBar[] = [];
  let hasEmittedAnySection = false;

  const flushSystem = () => {
    if (currentSystemBars.length === 0) return;
    // Skip systems that consist solely of empty rest measures
    if (!currentSystemBars.some((b) => b.hasNotes)) {
      currentSystemBars = [];
      return;
    }

    const prefixLen = maxLabelLen + 1;
    const systemRows = stringLabels.map(
      (lbl) => `${lbl.padEnd(maxLabelLen, ' ')}|`
    );
    let chordLine = '';
    let colOffset = prefixLen;

    for (const b of currentSystemBars) {
      for (const c of b.chords) {
        const targetCol = colOffset + c.col;
        if (targetCol >= chordLine.length) {
          chordLine += ' '.repeat(targetCol - chordLine.length) + c.chord + ' ';
        }
      }
      const width = b.stringSlices[0]?.length || 4;
      for (let r = 0; r < numStrings; r++) {
        systemRows[r] += `${(b.stringSlices[r] || '').padEnd(width, '-')}|`;
      }
      colOffset += width + 1;
    }

    if (chordLine.trim()) {
      lines.push(chordLine.trimEnd());
    }
    lines.push(...systemRows, '');
    currentSystemBars = [];
  };

  for (const bar of renderedBars) {
    if (bar.sectionHeader) {
      flushSystem();
      lines.push(`[${bar.sectionHeader}]`);
      hasEmittedAnySection = true;
    } else if (!hasEmittedAnySection && bar.hasNotes) {
      lines.push('[Section 1]');
      hasEmittedAnySection = true;
    }

    if (!bar.hasNotes && currentSystemBars.length === 0) {
      continue;
    }

    currentSystemBars.push(bar);
    if (currentSystemBars.length >= barsPerSystem) {
      flushSystem();
    }
  }

  flushSystem();

  return lines.join('\n').trim() + '\n';
}
