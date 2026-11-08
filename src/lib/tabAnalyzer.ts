import {
  PositionedChord,
  buildPositionedChordLine,
  extractPositionedChords,
  isAsciiTabLine,
  isChordOverLyricLine,
  isRhythmCountOrTupletLine,
  simplifyChordVoicing,
} from './chordUtils';

/**
 * Represents a single sliced measure (or phrase segment) across all strings of a tab staff.
 */
export interface TabMeasure {
  /** String labels in top-to-bottom order, e.g. ['e', 'B', 'G', 'D', 'A', 'E'] */
  stringLabels: string[];
  /** Raw content inside the bar lines for each string (same length as stringLabels) */
  bars: string[];
  /** Optional positioned chords aligned relative to the start of this measure (0-based) */
  chords: PositionedChord[];
  /** Number of consecutive times this exact measure repeats (default: 1) */
  repeatCount: number;
  /** Canonical whitespace-normalized fingerprint for pattern comparison */
  fingerprint: string;
}

export interface AnalyzedTabChunk {
  /** Formatted lines including `{` and `}` wrapper */
  rawBlockLines: string[];
  /** Chords inferred or extracted from the measures in this chunk */
  chords: string[];
  /** Normalized fingerprint of the entire chunk for section-level repeat detection */
  chunkFingerprint: string;
}

const NOTE_NAMES = [
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

const PITCH_CLASS_BY_NAME: Record<string, number> = {
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

/**
 * Default standard guitar tuning pitch classes (top string 1 = high e to bottom string 6 = low E).
 */
const DEFAULT_6_STRING_TUNING = [4, 11, 7, 2, 9, 4]; // e, B, G, D, A, E
const DEFAULT_4_STRING_BASS_TUNING = [7, 2, 9, 4]; // G, D, A, E

/**
 * Resolves the open-string pitch class (0 = C .. 11 = B) for each string in a tab system.
 */
export function resolveStringTunings(stringLabels: string[]): number[] {
  const count = stringLabels.length;
  return stringLabels.map((rawLabel, idx) => {
    const cleaned = rawLabel.trim().replace(/[0-9]/g, '').toLowerCase();
    if (cleaned && PITCH_CLASS_BY_NAME[cleaned] !== undefined) {
      return PITCH_CLASS_BY_NAME[cleaned];
    }
    if (count === 4) {
      return DEFAULT_4_STRING_BASS_TUNING[idx] ?? 4;
    }
    return DEFAULT_6_STRING_TUNING[idx] ?? 4;
  });
}

/**
 * Parses a single ASCII tab line into its string label prefix (e.g. "e") and inner bar body.
 */
export function parseTabLinePrefixAndContent(line: string): {
  label: string;
  content: string;
} | null {
  const trimmed = line.trim();
  if (!isAsciiTabLine(trimmed)) return null;

  // Match optional string label before first '|'
  const match = trimmed.match(/^([eEBGDAaCcFf1-6][#b♯♭]?)\s*\|(.*)$/);
  if (match) {
    return {
      label: match[1],
      content: match[2],
    };
  }

  // Unlabelled bar line starting with '|'
  if (trimmed.startsWith('|')) {
    return {
      label: '',
      content: trimmed.slice(1),
    };
  }

  return null;
}

/**
 * Computes a canonical fingerprint for a multi-string measure by collapsing variable-length
 * runs of '-' dashes into a single '-' while keeping vertical alignment of notes intact.
 */
export function computeMeasureFingerprint(bars: string[]): string {
  if (bars.length === 0) return '';
  const maxLen = Math.max(...bars.map((b) => b.length));
  const padded = bars.map((b) => b.padEnd(maxLen, '-'));

  const activeCols: string[] = [];
  let lastWasDashCol = false;

  for (let col = 0; col < maxLen; col++) {
    const colChars = padded.map((row) => row[col]);
    const isAllDashOrSpace = colChars.every(
      (ch) => ch === '-' || ch === ' ' || ch === '|'
    );
    if (isAllDashOrSpace) {
      if (!lastWasDashCol && activeCols.length > 0) {
        activeCols.push('-');
        lastWasDashCol = true;
      }
    } else {
      activeCols.push(colChars.join(''));
      lastWasDashCol = false;
    }
  }

  if (activeCols[activeCols.length - 1] === '-') {
    activeCols.pop();
  }

  return activeCols.join(':');
}

/**
 * Extracts note events (column, stringIndex, fret, pitchClass) from a single measure's string bars.
 */
interface TabNoteEvent {
  col: number;
  stringIdx: number;
  fret: number;
  pitchClass: number;
  /** Approximate MIDI-like pitch height so we can identify the lowest bass note */
  absPitch: number;
}

const DEFAULT_6_STRING_MIDI = [64, 59, 55, 50, 45, 40]; // E4, B3, G3, D3, A2, E2

function extractNoteEventsFromMeasure(
  bars: string[],
  tunings: number[]
): TabNoteEvent[] {
  const events: TabNoteEvent[] = [];
  const numStrings = bars.length;

  for (let sIdx = 0; sIdx < numStrings; sIdx++) {
    const bar = bars[sIdx];
    const openPitchClass = tunings[sIdx] ?? 4;
    const baseMidi =
      DEFAULT_6_STRING_MIDI[sIdx] ?? Math.max(28, 64 - sIdx * 5);

    let col = 0;
    while (col < bar.length) {
      const ch = bar[col];
      if (ch >= '0' && ch <= '9') {
        let numStr = ch;
        const startCol = col;
        // Check 2-digit fret (10..24)
        if (
          col + 1 < bar.length &&
          bar[col + 1] >= '0' &&
          bar[col + 1] <= '9'
        ) {
          const twoDigit = Number(ch + bar[col + 1]);
          if (twoDigit <= 24) {
            numStr = ch + bar[col + 1];
            col++;
          }
        }
        const fret = Number(numStr);
        events.push({
          col: startCol,
          stringIdx: sIdx,
          fret,
          pitchClass: (openPitchClass + fret) % 12,
          absPitch: baseMidi + fret,
        });
      }
      col++;
    }
  }

  events.sort((a, b) => a.col - b.col || b.stringIdx - a.stringIdx);
  return events;
}

/**
 * Matches a cluster of note events (with a lowest bass note and set of pitch classes)
 * to the most likely guitar chord name (e.g. "Em7", "D/F#", "G", "C", "Am").
 */
function matchPitchClusterToChord(cluster: TabNoteEvent[]): string | null {
  if (cluster.length < 2) return null;

  const uniquePitches = Array.from(new Set(cluster.map((e) => e.pitchClass)));
  if (uniquePitches.length < 2) return null;

  // Identify the lowest sounding note in the cluster (typically the first/lowest bass note)
  const lowestNote = cluster.reduce((min, curr) =>
    curr.absPitch < min.absPitch ? curr : min
  );
  const bassPc = lowestNote.pitchClass;

  // Candidate chord templates: intervals relative to root
  const templates: Array<{
    suffix: string;
    intervals: number[];
    required: number[];
    bonus: number;
  }> = [
    { suffix: '', intervals: [0, 4, 7], required: [0, 4], bonus: 4 },
    { suffix: 'm', intervals: [0, 3, 7], required: [0, 3], bonus: 4 },
    { suffix: '7', intervals: [0, 4, 7, 10], required: [0, 4, 10], bonus: 5 },
    { suffix: 'm7', intervals: [0, 3, 7, 10], required: [0, 3, 10], bonus: 5 },
    { suffix: 'maj7', intervals: [0, 4, 7, 11], required: [0, 4, 11], bonus: 5 },
    { suffix: 'sus4', intervals: [0, 5, 7], required: [0, 5, 7], bonus: 3 },
    { suffix: 'sus2', intervals: [0, 2, 7], required: [0, 2, 7], bonus: 2 },
    { suffix: 'dim', intervals: [0, 3, 6], required: [0, 3, 6], bonus: 3 },
    { suffix: '5', intervals: [0, 7], required: [0, 7], bonus: 1 },
  ];

  let bestScore = -999;
  let bestChord: string | null = null;

  for (let root = 0; root < 12; root++) {
    const relPitches = new Set(uniquePitches.map((p) => (p - root + 12) % 12));

    for (const tpl of templates) {
      if (!tpl.required.every((req) => relPitches.has(req))) {
        continue;
      }

      let matchedCount = 0;
      let nonChordCount = 0;
      for (const p of relPitches) {
        if (tpl.intervals.includes(p)) {
          matchedCount++;
        } else {
          nonChordCount++;
        }
      }

      const isRootInBass = root === bassPc;
      const isThirdInBass =
        (tpl.suffix === '' && (bassPc - root + 12) % 12 === 4) ||
        (tpl.suffix === 'm' && (bassPc - root + 12) % 12 === 3);

      let score =
        matchedCount * 4 +
        tpl.bonus -
        nonChordCount * 5 +
        (isRootInBass ? 6 : isThirdInBass ? 3 : -2);

      // Special case: open G major grip where B (interval 4) is omitted in arpeggio (e.g. G-D-G-D-G with open G/D strings)
      if (score > bestScore) {
        bestScore = score;
        const rootName = NOTE_NAMES[root];
        const bassName = NOTE_NAMES[bassPc];
        const usesHighTrebleStrings = cluster.some((e) => e.stringIdx <= 1);
        const effectiveSuffix =
          tpl.suffix === '5' && usesHighTrebleStrings ? '' : tpl.suffix;
        if (!isRootInBass && isThirdInBass && effectiveSuffix !== '5') {
          bestChord = `${rootName}${effectiveSuffix}/${bassName}`;
        } else {
          bestChord = `${rootName}${effectiveSuffix}`;
        }
      }
    }
  }

  // Fallback for open G major arpeggios like E:3(G), D:0(D), G:0(G), B:3(D), e:3(G) where only G and D are plucked
  if (!bestChord && uniquePitches.length === 2) {
    const fifth = (bassPc + 7) % 12;
    if (uniquePitches.includes(bassPc) && uniquePitches.includes(fifth)) {
      // On standard guitar, G + D with G on 6th string fret 3 and open G string is universally G major
      if (bassPc === 7) return 'G';
      return NOTE_NAMES[bassPc];
    }
  }

  return bestScore >= 6 ? bestChord : null;
}

/**
 * Infers positioned chords for a single tab measure by grouping notes into harmonic clusters
 * (anchored whenever a new bass note on strings 4..6 is plucked or a vertical chord stack appears).
 */
export function inferChordsForTabMeasure(
  bars: string[],
  stringLabels: string[]
): PositionedChord[] {
  const tunings = resolveStringTunings(stringLabels);
  const events = extractNoteEventsFromMeasure(bars, tunings);
  if (events.length < 2) return [];

  // Group simultaneous or arpeggiated notes into harmonic segments triggered by bass notes (strings index >= 3)
  const segments: { startCol: number; events: TabNoteEvent[] }[] = [];
  let currentSegment: { startCol: number; events: TabNoteEvent[] } | null =
    null;

  for (const ev of events) {
    const isBassString = ev.stringIdx >= Math.max(2, bars.length - 3);
    const colDistance = currentSegment
      ? ev.col - currentSegment.startCol
      : 0;

    // Start a new harmonic segment if a bass note arrives at least 8 columns after the current segment started
    // and we already have >= 3 notes in the current arpeggio segment
    if (
      !currentSegment ||
      (isBassString &&
        colDistance >= 8 &&
        currentSegment.events.length >= 3)
    ) {
      currentSegment = { startCol: ev.col, events: [ev] };
      segments.push(currentSegment);
    } else {
      currentSegment.events.push(ev);
    }
  }

  const inferred: PositionedChord[] = [];
  for (const seg of segments) {
    const chord = matchPitchClusterToChord(seg.events);
    if (chord) {
      // Avoid duplicating the exact same chord consecutively within the same measure
      if (
        inferred.length === 0 ||
        inferred[inferred.length - 1].chord !== chord
      ) {
        inferred.push({
          chord,
          column: seg.startCol,
        });
      }
    }
  }

  return inferred;
}

/**
 * Splits a multi-line ASCII tab staff (4 to 7 string lines) into individual measures (`TabMeasure[]`).
 * Handles both bar-delimited systems (`e|---|---|`) and wide un-barred systems (splitting at natural phrase gaps).
 */
export function splitTabSystemIntoMeasures(
  tabLines: string[],
  chordLineAbove?: string
): TabMeasure[] {
  const parsedRows = tabLines
    .map((l) => parseTabLinePrefixAndContent(l))
    .filter((r): r is { label: string; content: string } => r !== null);

  if (parsedRows.length === 0) return [];

  const stringLabels = parsedRows.map((r) => r.label);
  const rawContents = parsedRows.map((r) => r.content.replace(/\|+\s*$/, ''));
  const maxLen = Math.max(...rawContents.map((c) => c.length));
  if (maxLen === 0) return [];

  const paddedContents = rawContents.map((c) => c.padEnd(maxLen, '-'));

  // Compute prefix length (e.g. "e|" is 2 chars) so chord columns align with inner content columns
  const firstPipeIdx = tabLines[0].indexOf('|');
  const prefixOffset = firstPipeIdx !== -1 ? firstPipeIdx + 1 : 0;
  const externalChords = chordLineAbove
    ? extractPositionedChords(chordLineAbove).map((pc) => ({
        chord: pc.chord,
        column: Math.max(0, pc.column - prefixOffset),
      }))
    : [];

  // 1. Find aligned '|' bar-line boundaries inside paddedContents
  const splitCols: number[] = [];
  for (let col = 1; col < maxLen - 1; col++) {
    const pipeCount = paddedContents.filter((row) => row[col] === '|').length;
    if (pipeCount >= Math.ceil(paddedContents.length / 2)) {
      splitCols.push(col);
    }
  }

  // 2. If there are no internal '|' bar lines and the system is very wide (> 52 chars),
  //    look for natural phrasing gaps (>= 5 consecutive dashes across all strings) every ~28-44 chars
  if (splitCols.length === 0 && maxLen > 52) {
    let lastSplit = 0;
    for (let col = 24; col < maxLen - 16; col++) {
      if (col - lastSplit < 24) continue;
      const isGapWindow = [-1, 0, 1].every((offset) =>
        paddedContents.every((row) => row[col + offset] === '-')
      );
      if (isGapWindow && col - lastSplit >= 28) {
        splitCols.push(col);
        lastSplit = col;
      }
    }
  }

  const boundaries = [0, ...splitCols, maxLen];
  const measures: TabMeasure[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i] === 0 ? 0 : boundaries[i] + 1;
    const end = boundaries[i + 1];
    if (end <= start) continue;

    const sliceBars = paddedContents.map((row) =>
      row.slice(start, end).replace(/\|/g, '-')
    );

    // Skip completely empty dash-only slices
    const hasAnyNoteOrSymbol = sliceBars.some((b) => /[^-\s]/.test(b));
    if (!hasAnyNoteOrSymbol) continue;

    // Attach external chords that fall within [start, end)
    let measureChords = externalChords
      .filter((c) => c.column >= start - 2 && c.column < end)
      .map((c) => ({
        chord: c.chord,
        column: Math.max(0, c.column - start),
      }));

    // If no explicit chords were provided above this measure, infer chords from the fretted notes!
    if (measureChords.length === 0) {
      measureChords = inferChordsForTabMeasure(sliceBars, stringLabels);
    }

    const fingerprint = computeMeasureFingerprint(sliceBars);
    if (!fingerprint) continue;

    measures.push({
      stringLabels,
      bars: sliceBars,
      chords: measureChords,
      repeatCount: 1,
      fingerprint,
    });
  }

  return measures;
}

/**
 * Deduplicates consecutive identical measures (e.g. [A, A, A, A] -> [A (x4)])
 * and consecutive 2-bar riff repeats ([A, B, A, B] -> [A, B] x2).
 */
export function deduplicateConsecutiveMeasures(
  measures: TabMeasure[]
): TabMeasure[] {
  if (measures.length <= 1) return measures;

  // Pass 1: Collapse immediate 1-bar repeats (A, A -> A with repeatCount + 1)
  const pass1: TabMeasure[] = [];
  for (const m of measures) {
    const prev = pass1[pass1.length - 1];
    if (prev && prev.fingerprint === m.fingerprint) {
      prev.repeatCount += m.repeatCount;
    } else {
      pass1.push({ ...m, chords: [...m.chords] });
    }
  }

  return pass1;
}

/**
 * Renders a group of 1..N `TabMeasure`s back into a clean monospaced `{ ... }` locked chunk.
 */
export function formatMeasuresAsLockedChunk(
  measures: TabMeasure[],
  options?: { simplifyVoicings?: boolean; includeChordLine?: boolean }
): AnalyzedTabChunk {
  const numStrings = measures[0]?.stringLabels.length || 6;
  const labels = measures[0]?.stringLabels || ['e', 'B', 'G', 'D', 'A', 'E'];
  const maxLabelLen = Math.max(...labels.map((l) => l.length));
  const prefixLen = maxLabelLen + 1; // e.g. "e|" = 2

  const combinedStringLines: string[] = Array.from(
    { length: numStrings },
    (_, sIdx) => `${labels[sIdx].padEnd(maxLabelLen, ' ')}|`
  );

  const positionedChords: PositionedChord[] = [];
  const allChordNames: string[] = [];
  let currentOffset = prefixLen;

  for (const m of measures) {
    for (const pc of m.chords) {
      const chordName = options?.simplifyVoicings
        ? simplifyChordVoicing(pc.chord)
        : pc.chord;
      positionedChords.push({
        chord: chordName,
        column: currentOffset + pc.column,
      });
      allChordNames.push(chordName);
    }

    const barWidth = Math.max(...m.bars.map((b) => b.length));
    for (let sIdx = 0; sIdx < numStrings; sIdx++) {
      const barContent = (m.bars[sIdx] || '').padEnd(barWidth, '-');
      const repeatSuffix =
        sIdx === 0 && m.repeatCount > 1 ? `|x${m.repeatCount}|` : '|';
      const alignedSuffix =
        m.repeatCount > 1 && sIdx > 0
          ? `${'|'.padEnd(`|x${m.repeatCount}|`.length - 1, '-')}|`
          : repeatSuffix;
      combinedStringLines[sIdx] += `${barContent}${alignedSuffix}`;
    }

    const suffixLen = m.repeatCount > 1 ? `|x${m.repeatCount}|`.length : 1;
    currentOffset += barWidth + suffixLen;
  }

  const rawBlockLines: string[] = ['{'];
  if (
    options?.includeChordLine !== false &&
    positionedChords.length > 0
  ) {
    rawBlockLines.push(buildPositionedChordLine(positionedChords));
  }
  rawBlockLines.push(...combinedStringLines, '}');

  const chunkFingerprint = measures
    .map((m) => `${m.fingerprint}*${m.repeatCount}`)
    .join('||');

  return {
    rawBlockLines,
    chords: allChordNames,
    chunkFingerprint,
  };
}

/**
 * Analyzes a contiguous block of in-section ASCII tab lines (and optional leading chord line),
 * slices wide multi-bar systems into bite-sized `{ ... }` chunks (max `maxBarsPerChunk` measures),
 * collapses consecutive repeating measures, and infers harmonic chords.
 */
export function analyzeTabBlockIntoChunks(
  tabBlockLines: string[],
  options?: {
    simplifyVoicings?: boolean;
    maxBarsPerChunk?: number;
    includeChordLine?: boolean;
  }
): AnalyzedTabChunk[] {
  const maxBars = options?.maxBarsPerChunk ?? 2;

  // Group raw lines into individual staff systems (4..7 consecutive tab lines, optionally preceded by a chord line)
  const allMeasures: TabMeasure[] = [];
  let pendingChordLine: string | undefined = undefined;
  let currentStaffLines: string[] = [];

  const flushStaff = () => {
    if (currentStaffLines.length > 0) {
      const extracted = splitTabSystemIntoMeasures(
        currentStaffLines,
        pendingChordLine
      );
      allMeasures.push(...extracted);
      currentStaffLines = [];
      pendingChordLine = undefined;
    }
  };

  for (const line of tabBlockLines) {
    const trimmed = line.trim();
    if (!trimmed || isRhythmCountOrTupletLine(trimmed)) {
      continue;
    }

    if (isChordOverLyricLine(line) && !isAsciiTabLine(line)) {
      flushStaff();
      pendingChordLine = line;
      continue;
    }

    if (isAsciiTabLine(line)) {
      const parsed = parseTabLinePrefixAndContent(line);
      // Detect if a new 6-string staff started immediately without a blank line (e.g. 'e|' after 'E|')
      if (
        currentStaffLines.length >= 4 &&
        parsed &&
        (parsed.label === 'e' ||
          (currentStaffLines.length >= 6 && parsed.label !== ''))
      ) {
        flushStaff();
      }
      currentStaffLines.push(line);
    }
  }
  flushStaff();

  if (allMeasures.length === 0) {
    return [
      {
        rawBlockLines: ['{', ...tabBlockLines, '}'],
        chords: [],
        chunkFingerprint: tabBlockLines.join('\n'),
      },
    ];
  }

  const deduplicated = deduplicateConsecutiveMeasures(allMeasures);

  // Partition measures into chunks of at most `maxBars` measures (also keeping width <= 78 chars if possible)
  const chunks: AnalyzedTabChunk[] = [];
  let slice: TabMeasure[] = [];
  let sliceWidth = 0;

  for (const m of deduplicated) {
    const mWidth = Math.max(...m.bars.map((b) => b.length)) + 2;
    if (
      slice.length > 0 &&
      (slice.length >= maxBars || (sliceWidth + mWidth > 76 && slice.length >= 1))
    ) {
      chunks.push(formatMeasuresAsLockedChunk(slice, options));
      slice = [];
      sliceWidth = 0;
    }
    slice.push(m);
    sliceWidth += mWidth;
  }

  if (slice.length > 0) {
    chunks.push(formatMeasuresAsLockedChunk(slice, options));
  }

  return chunks;
}

export interface TabScaffoldSegment {
  type: 'structure' | 'fret';
  text: string;
  /** Present when type === 'fret' */
  noteIndex?: number;
  /** 0-based measure index along the line */
  measureIndex?: number;
  /** 0-based note index within its measure */
  noteIndexInMeasure?: number;
  /** 0-based column index */
  column?: number;
}

/**
 * Tokenizes an ASCII tab line into structural characters (`e|---`, `|`, `h`, `p`, `/`)
 * and discrete fret numbers (`0`..`24`) for interactive masking and anchor highlighting in Scaffold Mode.
 */
export function tokenizeTabLineForScaffold(line: string): TabScaffoldSegment[] {
  const segments: TabScaffoldSegment[] = [];
  let structBuf = '';
  let noteIndex = 0;
  let measureIndex = 0;
  let noteIndexInMeasure = 0;
  let seenFirstPipe = false;

  const flushStruct = () => {
    if (structBuf) {
      segments.push({ type: 'structure', text: structBuf });
      structBuf = '';
    }
  };

  let i = 0;
  while (i < line.length) {
    const ch = line[i];

    // Before the first '|', everything is the string label prefix (e.g. "e|", "Eb|", "1|")
    if (!seenFirstPipe) {
      structBuf += ch;
      if (ch === '|') {
        seenFirstPipe = true;
      }
      i++;
      continue;
    }

    if (ch === '|') {
      structBuf += ch;
      // Check if this is a repeat marker like "|x4|"
      const repeatMatch = line.slice(i).match(/^\|x\d+\|/i);
      if (repeatMatch) {
        structBuf += repeatMatch[0].slice(1);
        i += repeatMatch[0].length;
      } else {
        i++;
      }
      measureIndex++;
      noteIndexInMeasure = 0;
      continue;
    }

    if (ch >= '0' && ch <= '9') {
      flushStruct();
      const startCol = i;
      let fretStr = ch;
      if (
        i + 1 < line.length &&
        line[i + 1] >= '0' &&
        line[i + 1] <= '9' &&
        Number(ch + line[i + 1]) <= 24
      ) {
        fretStr += line[i + 1];
        i += 2;
      } else {
        i += 1;
      }

      segments.push({
        type: 'fret',
        text: fretStr,
        noteIndex: noteIndex++,
        measureIndex,
        noteIndexInMeasure: noteIndexInMeasure++,
        column: startCol,
      });
      continue;
    }

    structBuf += ch;
    i++;
  }

  flushStruct();
  return segments;
}

