export type PracticeMode = 'chain' | 'scaffold' | 'flashcards';

export type ChainingGranularity = 'chunk' | 'section';

export interface SongItem {
  id: string;
  /** Short name displayed in the playlist (independently editable) */
  shortName: string;
  /** Monospaced body using By Heart notation */
  body: string;
  /** Optional raw Ultimate Guitar input for re-running or comparing compaction */
  rawSource?: string;
  /** Remembers the last selected practice modality for this song */
  lastMode: PracticeMode;
  /** Number of lyric lines per chunk (default: 4) */
  chunkSize: number;
  /** Custom highlighted word keys in format `${sectionIdx}:${lineIdx}:${wordIdx}` */
  customHighlights: string[];
  /** Auto-scaffold first word of every N lines (2, 4, or 0 for manual-only) */
  scaffoldEveryNLines: 0 | 2 | 4;
  updatedAt: number;
}

export interface ParsedWord {
  text: string;
  wordIndex: number;
  leadingWhitespace: string;
}

export interface ParsedLyricLine {
  /** 0-based index within the section */
  lineIndexInSection: number;
  /** 0-based global lyric line index across the song */
  globalLineIndex: number;
  /** The lyric text itself */
  lyric: string;
  /** Tokenized words for Scaffold mode click/drag highlighting */
  words: ParsedWord[];
  /**
   * Optional monospaced chord exception line positioned directly above this lyric line
   * (e.g. "   G" or "                                D7        G7")
   */
  chordOverLine?: string;
  /**
   * Bracketed chord progression introduced right before this line (e.g. "C - F" from "[ C - F ]").
   * Only set on the exact line where the new progression appears!
   */
  introducedProgression?: string;
  /**
   * Any standalone instrumental bracketed progressions (e.g. an intro vamp `[ Em7 - D/F# - G ]`)
   * appearing immediately above this line before its `introducedProgression`.
   */
  preLineProgressions?: string[];
  /**
   * The active background chord progression in effect at this line (inherited if not introduced here).
   */
  activeProgression?: string;
  /**
   * If this line is inside a `{ ... }` locked chunk block, all lines in that `{ ... }` block
   * share the same `lockedChunkGroupId` so the chunker never splits them apart.
   */
  lockedChunkGroupId?: number;
  /**
   * True if this line is an ASCII guitar/bass/ukulele tablature line (e.g. `e|---3---|`)
   * so Scaffold mode keeps it unmasked and Stage views render it with tight line-height.
   */
  isTabLine?: boolean;
}

export interface ParsedSection {
  sectionIndex: number;
  /** e.g. "1.", "2." */
  numberLabel: string;
  /** e.g. "Verse 1", "Pre-Chorus", "Chorus" */
  name: string;
  /** Full header text e.g. "1. Verse 1" */
  fullHeader: string;
  /** Normalized base section name for repeat matching, e.g. "chorus" */
  canonicalName: string;
  /**
   * If this section is an empty-body reference (like "5. Chorus") or identical repeat of an earlier
   * section, this points to the earlier sectionIndex.
   */
  isRepeatOfSectionIndex: number | null;
  /** Lyric lines (with attached chord loops and chord-over-lyric exceptions) */
  lines: ParsedLyricLine[];
  /** Trailing bracketed progression if section has only chords and no lyrics (e.g. instrumental intro) */
  standaloneProgressions: string[];
}

export interface ParsedPart {
  /** 0-based index in the flattened parts array (either chunks or sections) */
  partIndex: number;
  /** Short pill label, e.g. "1. V1a", "1. V1b", "2. Pre", "3. Ch" */
  pillLabel: string;
  /** Full descriptive title, e.g. "1. Verse 1 (Part 1/2)" or "2. Pre-Chorus" */
  title: string;
  sectionIndex: number;
  sectionHeader: string;
  /** True if this part is the very first chunk of its parent section */
  isFirstChunkOfSection: boolean;
  /** Chunk index within the section (0-based) */
  chunkIndexInSection: number;
  totalChunksInSection: number;
  /** If the parent section is a repeat of an earlier section (e.g. "5. Chorus") */
  isRepeatOfSectionIndex: number | null;
  repeatOfSectionHeader?: string;
  lines: ParsedLyricLine[];
  standaloneProgressions: string[];
}

export interface ParsedSong {
  /** Optional title/artist preamble lines appearing before the first numbered section */
  preambleLines: string[];
  sections: ParsedSection[];
  /** Parts when grouped by N-line chunks (default 4 lines) */
  chunkParts: ParsedPart[];
  /** Parts when grouped by whole numbered sections */
  sectionParts: ParsedPart[];
}

export interface ChainStep {
  stepIndex: number;
  /**
   * 'isolated': Learning a single new part (e.g. Part 2 alone)
   * 'concatenated': Chaining from Part 1 up to Part k (e.g. Parts 1+2 or Parts 1..5)
   */
  type: 'isolated' | 'concatenated';
  /** Indices of parts displayed on screen during this step */
  visiblePartIndices: number[];
  /** The highest part index reached so far (0-based) */
  targetPartIndex: number;
  /**
   * Status of every part pill up to targetPartIndex for the top progress bar:
   * - 'yellow': currently being learned or actively tested in concatenation
   * - 'green': banked/confirmed while learning a new isolated part
   */
  pillStates: Record<number, 'yellow' | 'green'>;
  /** Human-readable description of the step */
  label: string;
}
