import {
  PositionedChord,
  buildPositionedChordLine,
  extractChordsFromLine,
  extractPositionedChords,
  isAsciiTabLine,
  isBracketedChordProgression,
  isChordOverLyricLine,
  isPreambleMetadataLine,
  isRhythmCountOrTupletLine,
  isUGBracketedSectionHeader,
  normalizeSectionBaseName,
  parseNumberedSectionHeader,
  simplifyChordVoicing,
} from './chordUtils';
import {
  analyzeTabBlockIntoChunks,
  splitTabSystemIntoMeasures,
} from './tabAnalyzer';

export interface CompactorOptions {
  /** Simplify maj7/add9/sus voicings to clean triads (e.g. Cmaj7 -> C, Fmaj7 -> F) */
  simplifyVoicings: boolean;
  /** Also strip dominant 7ths (e.g. E7 -> E) when simplifying voicings */
  stripDominant7?: boolean;
  /** Suppress consecutive duplicate chords across adjacent lines (e.g. repeated G on lines 1, 2, 3) */
  suppressConsecutiveDuplicateChords: boolean;
  /** Collapse duplicate sections with the same name/lyrics into an empty numbered header (e.g. "5. Chorus") */
  collapseRepeatedSections: boolean;
  /**
   * Simplify in-line/in-song ASCII TAB blocks into clean bracketed chord loops `[ ... ]` when true,
   * or wrap contiguous in-song TAB blocks in `{ ... }` locked chunks when false (default: false).
   */
  simplifyInlineTabs?: boolean;
  /**
   * Wrap pre-section preamble metadata & chord voicing diagrams in `(( ... ))` silence tags
   * so they remain readable in the editor without cluttering the practice stage (default: true).
   */
  silencePreambleAndVoicings?: boolean;
  /**
   * Legacy alias for backward compatibility in tests: when set, controls both preamble silencing and tab simplification
   * unless `simplifyInlineTabs` / `silencePreambleAndVoicings` are explicitly provided.
   */
  stripTabAndMetadata?: boolean;
}

export const DEFAULT_COMPACTOR_OPTIONS: CompactorOptions = {
  simplifyVoicings: false,
  stripDominant7: true,
  suppressConsecutiveDuplicateChords: true,
  collapseRepeatedSections: true,
  simplifyInlineTabs: false,
  silencePreambleAndVoicings: true,
};

interface RawLinePair {
  chords: PositionedChord[];
  lyric: string;
  isStandaloneChordLine?: boolean;
  /** If this item is a preserved verbatim block (e.g. `{ ... }` tab block or `(( ... ))` silenced block) */
  rawBlockLines?: string[];
}

interface RawSectionBlock {
  headerName: string | null;
  pairs: RawLinePair[];
}

/**
 * Checks whether a candidate chord array `cycle` is simply a shorter sub-cycle repeated multiple times
 * (e.g. `[C, F, C, F]` is `[C, F]` x 2, or `[Em, D, G, Em, D, G]` is `[Em, D, G]` x 2).
 */
function isReducibleSubCycle(candidate: string[]): boolean {
  const n = candidate.length;
  for (let subLen = 1; subLen <= Math.floor(n / 2); subLen++) {
    if (n % subLen !== 0) continue;
    let matchesSub = true;
    for (let i = 0; i < n; i++) {
      if (candidate[i] !== candidate[i % subLen]) {
        matchesSub = false;
        break;
      }
    }
    if (matchesSub) return true;
  }
  return false;
}

/**
 * Attempts to detect a repeating chord cycle starting at the beginning of a stanza's chords,
 * supporting both single-line loops (length 2..4) and 2-line couplet loops (up to length 8,
 * e.g. `[ Em7 - D/F# - G | C - G - D ]` in "Shallow"), as well as Ultimate Guitar's "1-2-3-1"
 * boundary-chord omission.
 */
function detectLeadingLoopCycle(
  flatChords: string[],
  lineChordArrays: string[][] = []
): { cycle: string[]; consumedCount: number; formattedLoop: string } | null {
  if (flatChords.length < 4) return null;

  const firstLineChords = lineChordArrays[0] || [];
  const secondLineChords = lineChordArrays[1] || [];

  // 1. Priority check for UG's classic "1-2-3-1" boundary-chord omission on single-line loops:
  // If the first line has 3 or 4 chords that start and end on the same chord (e.g. [C, G, Am, C]),
  // check if subsequent chords follow that 1-2-3-1 cycle (with or without the omitted leading chord).
  if (
    (firstLineChords.length === 3 || firstLineChords.length === 4) &&
    firstLineChords[0] === firstLineChords[firstLineChords.length - 1] &&
    new Set(firstLineChords).size >= 2
  ) {
    const len = firstLineChords.length;
    const candidate = firstLineChords;
    let pos = len;
    let repetitions = 1;
    let omittedBoundaryMatchCount = 0;

    while (pos < flatChords.length) {
      if (
        pos + len <= flatChords.length &&
        candidate.every((c, idx) => flatChords[pos + idx] === c)
      ) {
        pos += len;
        repetitions++;
        continue;
      }
      const tailLen = len - 1;
      if (
        flatChords[pos - 1] === candidate[0] &&
        pos + tailLen <= flatChords.length &&
        candidate.slice(1).every((c, idx) => flatChords[pos + idx] === c)
      ) {
        pos += tailLen;
        repetitions++;
        omittedBoundaryMatchCount++;
        continue;
      }
      break;
    }

    if (repetitions >= 2 && omittedBoundaryMatchCount >= 1) {
      return {
        cycle: candidate,
        consumedCount: pos,
        formattedLoop: `[ ${candidate.join(' - ')} ]`,
      };
    }
  }

  // 2. Build candidate cycle lengths to test:
  // Always test 2, 3, 4; plus if Line 1 + Line 2 together form a 2-line couplet of length 4..8, include that length!
  const coupletLen =
    firstLineChords.length > 0 && secondLineChords.length > 0
      ? firstLineChords.length + secondLineChords.length
      : 0;

  const candidateLengths = [2, 3, 4];
  if (
    coupletLen >= 4 &&
    coupletLen <= 8 &&
    !candidateLengths.includes(coupletLen)
  ) {
    candidateLengths.push(coupletLen);
  }

  let bestResult: {
    cycle: string[];
    consumedCount: number;
    cycleRepetitions: number;
  } | null = null;

  for (const len of candidateLengths) {
    if (flatChords.length < len) continue;
    const candidate = flatChords.slice(0, len);

    // Ensure the candidate isn't just the same single chord repeated [G, G] or a reducible sub-cycle [C, F, C, F]
    const uniqueInCandidate = new Set(candidate);
    if (uniqueInCandidate.size < 2) continue;
    if (isReducibleSubCycle(candidate)) continue;

    let pos = len;
    let repetitions = 1;

    while (pos < flatChords.length) {
      // A. Standard full cycle match: candidate[0..len-1]
      let fullMatch = false;
      if (pos + len <= flatChords.length) {
        fullMatch = candidate.every((c, idx) => flatChords[pos + idx] === c);
      }
      if (fullMatch) {
        pos += len;
        repetitions++;
        continue;
      }

      // B. UG "1-2-3-1" boundary omission match (only for single-line cycles up to 4 chords)
      const tailLen = len - 1;
      const prevChord = flatChords[pos - 1];
      if (
        len <= 4 &&
        tailLen >= 2 &&
        prevChord === candidate[0] &&
        pos + tailLen <= flatChords.length
      ) {
        const tailMatch = candidate
          .slice(1)
          .every((c, idx) => flatChords[pos + idx] === c);
        if (tailMatch) {
          pos += tailLen;
          repetitions++;
          continue;
        }
      }

      break;
    }

    // Check if there is also a partial cycle match at the very end only if the ENTIRE section is purely this loop
    if (pos < flatChords.length && repetitions >= 2) {
      const remaining = flatChords.length - pos;
      if (remaining < len) {
        const isPurePrefixOfCycle = flatChords
          .slice(pos)
          .every((c, idx) => c === candidate[idx]);
        if (isPurePrefixOfCycle) {
          pos = flatChords.length;
        }
      }
    }

    if (repetitions >= 2) {
      if (
        !bestResult ||
        pos > bestResult.consumedCount ||
        (pos === bestResult.consumedCount && len < bestResult.cycle.length)
      ) {
        bestResult = {
          cycle: candidate,
          consumedCount: pos,
          cycleRepetitions: repetitions,
        };
      }
    }
  }

  if (!bestResult) return null;

  // Format the detected loop:
  // Check if this cycle cleanly spans 2 lyric lines (a 2-line couplet loop like [ Em7 - D/F# - G | C - G - D ])
  let formattedLoop = `[ ${bestResult.cycle.join(' - ')} ]`;
  if (
    firstLineChords.length > 0 &&
    secondLineChords.length > 0 &&
    bestResult.cycle.length ===
      firstLineChords.length + secondLineChords.length &&
    bestResult.cycle.length > firstLineChords.length
  ) {
    // Verify that the next repetition on lines 3 & 4 also splits across two lines in the same ratio (or at least doesn't contradict it)
    const part1 = bestResult.cycle.slice(0, firstLineChords.length);
    const part2 = bestResult.cycle.slice(firstLineChords.length);
    formattedLoop = `[ ${part1.join(' - ')} | ${part2.join(' - ')} ]`;
  }

  return {
    cycle: bestResult.cycle,
    consumedCount: bestResult.consumedCount,
    formattedLoop,
  };
}

/**
 * Compacts a single section block into By Heart notation lines.
 */
function compactSectionPairs(
  pairs: RawLinePair[],
  options: CompactorOptions
): { bracketedLoop: string | null; bodyLines: string[] } {
  // 1. Apply optional chord simplification first so Cmaj7/Fmaj7/E7 unify to C/F/E if enabled
  const normalizedPairs: RawLinePair[] = pairs.map((pair) => {
    if (pair.rawBlockLines) {
      if (!options.simplifyVoicings) return pair;
      // Also simplify chord lines inside { ... } tab blocks if simplifyVoicings is checked!
      return {
        ...pair,
        rawBlockLines: pair.rawBlockLines.map((rawLine) => {
          if (isChordOverLyricLine(rawLine) && !isAsciiTabLine(rawLine)) {
            const positioned = extractPositionedChords(rawLine).map((pc) => ({
              ...pc,
              chord: simplifyChordVoicing(pc.chord),
            }));
            return buildPositionedChordLine(positioned);
          }
          return rawLine;
        }),
      };
    }
    return {
      ...pair,
      chords: pair.chords.map((c) => ({
        ...c,
        chord: options.simplifyVoicings
          ? simplifyChordVoicing(c.chord)
          : c.chord,
      })),
    };
  });

  // 2. Separate leading standalone instrumental/tab blocks (before the first sung lyric line)
  //    so an intro vamp (like `[ Em7 - D/F# - G ]` at the top of Shallow's Verse 1) is preserved
  //    explicitly and doesn't block couplet loop detection on the sung stanza!
  const firstLyricPairIdx = normalizedPairs.findIndex(
    (p) => !p.isStandaloneChordLine && !p.rawBlockLines
  );

  // If the section has NO sung lyric lines (e.g. a pure instrumental Intro section),
  // we still want to compact consecutive identical standalone chord lines if possible.
  const loopStartPairIdx = firstLyricPairIdx !== -1 ? firstLyricPairIdx : 0;

  const flatChordRefs: {
    pairIndex: number;
    chordIndex: number;
    chord: string;
  }[] = [];
  const lineChordArrays: string[][] = [];

  for (let pIdx = loopStartPairIdx; pIdx < normalizedPairs.length; pIdx++) {
    const pair = normalizedPairs[pIdx];
    if (pair.rawBlockLines) continue;
    if (pair.chords.length > 0) {
      lineChordArrays.push(pair.chords.map((c) => c.chord));
    }
    pair.chords.forEach((c, cIdx) => {
      flatChordRefs.push({ pairIndex: pIdx, chordIndex: cIdx, chord: c.chord });
    });
  }

  const flatChords = flatChordRefs.map((r) => r.chord);

  // 3. Detect if there is a repeating loop cycle starting at loopStartPairIdx
  const loopDetection = detectLeadingLoopCycle(flatChords, lineChordArrays);

  const consumedSet = new Set<string>();
  const stanzaBracketedLoop: string | null = loopDetection
    ? loopDetection.formattedLoop
    : null;

  if (loopDetection) {
    for (let i = 0; i < loopDetection.consumedCount; i++) {
      const ref = flatChordRefs[i];
      consumedSet.add(`${ref.pairIndex}:${ref.chordIndex}`);
    }

    // Also check if any leading standalone chord line immediately before `loopStartPairIdx`
    // is literally the exact same chord cycle as `loopDetection.cycle` — if so, absorb it
    // into the loop rather than duplicating the identical bracket twice!
    for (let pIdx = 0; pIdx < loopStartPairIdx; pIdx++) {
      const prePair = normalizedPairs[pIdx];
      if (
        prePair.isStandaloneChordLine &&
        !prePair.rawBlockLines &&
        prePair.chords.length === loopDetection.cycle.length &&
        prePair.chords.every((c, idx) => c.chord === loopDetection.cycle[idx])
      ) {
        prePair.chords.forEach((_, cIdx) => {
          consumedSet.add(`${pIdx}:${cIdx}`);
        });
      }
    }
  }

  // 4. Filter out consumed loop chords and drop standalone instrumental turnaround lines
  //    whose chords were completely absorbed by the loop
  const remainingPairs: Array<RawLinePair & { originalPairIndex: number }> = [];
  for (let pIdx = 0; pIdx < normalizedPairs.length; pIdx++) {
    const pair = normalizedPairs[pIdx];
    if (pair.rawBlockLines) {
      remainingPairs.push({ ...pair, originalPairIndex: pIdx });
      continue;
    }

    const remainingChords = pair.chords.filter(
      (_, cIdx) => !consumedSet.has(`${pIdx}:${cIdx}`)
    );

    if (pair.isStandaloneChordLine) {
      if (remainingChords.length === 0) {
        continue;
      }
    }

    remainingPairs.push({
      ...pair,
      chords: remainingChords,
      originalPairIndex: pIdx,
    });
  }

  // 5. Suppress consecutive duplicate chords across sung lyric lines if enabled
  //    (e.g. Pre-Chorus where line 1 starts with G, line 2 starts with G, line 3 starts with G)
  if (options.suppressConsecutiveDuplicateChords) {
    let lastActiveChord: string | null =
      loopDetection && loopDetection.cycle.length > 0
        ? loopDetection.cycle[loopDetection.cycle.length - 1]
        : null;

    for (const pair of remainingPairs) {
      if (pair.rawBlockLines || pair.isStandaloneChordLine) {
        continue;
      }
      const filtered: PositionedChord[] = [];
      for (const pc of pair.chords) {
        if (lastActiveChord && pc.chord === lastActiveChord) {
          continue;
        }
        filtered.push(pc);
        lastActiveChord = pc.chord;
      }
      pair.chords = filtered;
    }
  }

  // 6. Render compacted body lines, inserting `stanzaBracketedLoop` right at `loopStartPairIdx`
  const bodyLines: string[] = [];
  let hasInsertedStanzaLoop = false;

  for (const pair of remainingPairs) {
    if (
      stanzaBracketedLoop &&
      !hasInsertedStanzaLoop &&
      pair.originalPairIndex >= loopStartPairIdx
    ) {
      bodyLines.push(stanzaBracketedLoop);
      hasInsertedStanzaLoop = true;
    }

    if (pair.rawBlockLines) {
      bodyLines.push(...pair.rawBlockLines);
      continue;
    }

    if (pair.isStandaloneChordLine) {
      if (pair.chords.length > 0) {
        bodyLines.push(`[ ${pair.chords.map((c) => c.chord).join(' - ')} ]`);
      }
      continue;
    }

    if (pair.chords.length > 0) {
      bodyLines.push(buildPositionedChordLine(pair.chords));
    }
    bodyLines.push(pair.lyric);
  }

  if (stanzaBracketedLoop && !hasInsertedStanzaLoop) {
    bodyLines.push(stanzaBracketedLoop);
  }

  return { bracketedLoop: null, bodyLines };
}

/**
 * Splits a headerless list of chord/lyric pairs into logical sections when the user pastes
 * an Ultimate Guitar excerpt that lacks explicit [Verse] / [Chorus] tags (such as the Rotterdam screenshot).
 */
function inferSectionsFromHeaderlessPairs(
  pairs: RawLinePair[],
  _options: CompactorOptions
): RawSectionBlock[] {
  const tabPairs = pairs.filter((p) =>
    Boolean(p.rawBlockLines && p.rawBlockLines.some((l) => isAsciiTabLine(l)))
  );
  const lyricPairsCount = pairs.filter(
    (p) => !p.isStandaloneChordLine && !p.rawBlockLines
  ).length;

  // If this is a headerless pure-tab sheet (no sung lyrics, multiple tab chunks),
  // group tab chunks into named Riff sections and match recurring riff fingerprints!
  if (lyricPairsCount === 0 && tabPairs.length > 1) {
    const blocks: RawSectionBlock[] = [];
    const riffNameByFingerprint = new Map<string, string>();
    let nextRiffLetterCode = 65; // 'A', 'B', 'C'...

    for (const pair of pairs) {
      if (!pair.rawBlockLines) continue;
      const tabOnlyLines = pair.rawBlockLines.filter((l) => isAsciiTabLine(l));
      const measures = splitTabSystemIntoMeasures(tabOnlyLines);
      const fp =
        measures.map((m) => `${m.fingerprint}*${m.repeatCount}`).join('||') ||
        tabOnlyLines.join('\n');

      let riffName = riffNameByFingerprint.get(fp);
      if (!riffName) {
        const letter = String.fromCharCode(
          Math.min(90, nextRiffLetterCode++)
        );
        riffName = `Riff ${letter}`;
        riffNameByFingerprint.set(fp, riffName);
      }

      blocks.push({
        headerName: riffName,
        pairs: [pair],
      });
    }

    if (blocks.length > 0) {
      return blocks;
    }
  }

  // Drop pure standalone chord lines when grouping into 4-line lyric stanzas,
  // or attach them to the current stanza if they match its chords.
  if (lyricPairsCount <= 4) {
    return [{ headerName: 'Section 1', pairs }];
  }

  const blocks: RawSectionBlock[] = [];
  let currentPairs: RawLinePair[] = [];
  let currentLyricCount = 0;

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    currentPairs.push(pair);
    if (!pair.isStandaloneChordLine) {
      currentLyricCount++;
    }

    // Look ahead: if we have collected 4 lyric lines (one standard stanza),
    // consume any immediately following standalone turnaround chord line and close the stanza
    // if the harmonic palette changes on the next lyric line!
    if (currentLyricCount >= 4) {
      while (
        i + 1 < pairs.length &&
        pairs[i + 1].isStandaloneChordLine
      ) {
        currentPairs.push(pairs[i + 1]);
        i++;
      }

      blocks.push({
        headerName: `Section ${blocks.length + 1}`,
        pairs: currentPairs,
      });
      currentPairs = [];
      currentLyricCount = 0;
    }
  }

  if (currentPairs.length > 0) {
    // If the trailing fragment is just 1 line (like "G7 / Anywhere alone" at the end of Rotterdam's chorus),
    // keep it attached to the preceding block!
    const trailingLyrics = currentPairs.filter((p) => !p.isStandaloneChordLine).length;
    if (trailingLyrics <= 1 && blocks.length > 0) {
      blocks[blocks.length - 1].pairs.push(...currentPairs);
    } else {
      blocks.push({
        headerName: `Section ${blocks.length + 1}`,
        pairs: currentPairs,
      });
    }
  }

  return blocks;
}

/**
 * Converts a raw Ultimate Guitar chord sheet (or mixed chord/lyric text) into
 * clean By Heart monospaced notation.
 */
export function compactChordSheet(
  rawText: string,
  options: CompactorOptions = DEFAULT_COMPACTOR_OPTIONS
): string {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');

  // Resolve options with backward compatibility for legacy `stripTabAndMetadata`
  const shouldSilencePreamble =
    options.silencePreambleAndVoicings !== undefined
      ? options.silencePreambleAndVoicings
      : options.stripTabAndMetadata !== false;

  const shouldSimplifyInlineTabs =
    options.simplifyInlineTabs !== undefined
      ? options.simplifyInlineTabs
      : options.stripTabAndMetadata !== undefined
      ? options.stripTabAndMetadata
      : false;

  // Check up front whether the sheet contains explicit section headers (e.g. [Intro], [Verse 1], 1. Verse)
  const sheetHasAnyExplicitHeader = lines.some((l) => {
    const t = l.trim();
    return (
      isUGBracketedSectionHeader(t) !== null ||
      parseNumberedSectionHeader(t) !== null
    );
  });

  const preambleLines: string[] = [];
  const silencedPreambleLines: string[] = [];
  const rawBlocks: RawSectionBlock[] = [];
  let currentBlock: RawSectionBlock = { headerName: null, pairs: [] };
  let hasExplicitHeaders = false;

  let pendingChordLine: PositionedChord[] | null = null;
  let pendingRawChordLineText: string | null = null;
  let pendingChordAttachedToTab = false;
  let activeInSectionTabLines: string[] = [];

  const flushActiveInSectionTabBlock = () => {
    if (activeInSectionTabLines.length === 0) return;

    if (shouldSimplifyInlineTabs) {
      // If there was no explicit chord line above this tab system, infer chords from the tab notes!
      if (!pendingChordLine) {
        const analyzed = analyzeTabBlockIntoChunks(activeInSectionTabLines, {
          simplifyVoicings: options.simplifyVoicings,
        });
        for (const chunk of analyzed) {
          if (chunk.chords.length > 0) {
            currentBlock.pairs.push({
              chords: chunk.chords.map((c, idx) => ({
                chord: c,
                column: idx * 4,
              })),
              lyric: '',
              isStandaloneChordLine: true,
            });
          }
        }
      }
      activeInSectionTabLines = [];
      return;
    }

    const firstLineIsChord =
      isChordOverLyricLine(activeInSectionTabLines[0]) &&
      !isAsciiTabLine(activeInSectionTabLines[0]);
    const tabOnly = firstLineIsChord
      ? activeInSectionTabLines.slice(1)
      : activeInSectionTabLines;
    const measures = splitTabSystemIntoMeasures(
      tabOnly,
      firstLineIsChord ? activeInSectionTabLines[0] : undefined
    );

    // Preserve single-bar tab blocks that already have an explicit chord header verbatim
    if (firstLineIsChord && measures.length <= 1 && tabOnly.length <= 6) {
      currentBlock.pairs.push({
        chords: [],
        lyric: '',
        rawBlockLines: ['{', ...activeInSectionTabLines, '}'],
      });
      activeInSectionTabLines = [];
      return;
    }

    // Otherwise run full pattern analysis: slice multi-bar systems into bite-sized { ... } chunks,
    // deduplicate consecutive identical bars (|xN|), and infer chord names above unannotated bars!
    const analyzedChunks = analyzeTabBlockIntoChunks(activeInSectionTabLines, {
      simplifyVoicings: options.simplifyVoicings,
      maxBarsPerChunk: 2,
    });
    for (const chunk of analyzedChunks) {
      currentBlock.pairs.push({
        chords: [],
        lyric: '',
        rawBlockLines: chunk.rawBlockLines,
      });
    }
    activeInSectionTabLines = [];
  };

  const flushPendingChordAsStandalone = () => {
    if (pendingChordLine && pendingChordLine.length > 0) {
      // If this chord line sat strictly above an ASCII TAB diagram before any named section started
      // (and the sheet has explicit section headers below), it's a chord-voicing glossary diagram
      if (
        shouldSilencePreamble &&
        pendingChordAttachedToTab &&
        !hasExplicitHeaders &&
        currentBlock.headerName === null &&
        sheetHasAnyExplicitHeader
      ) {
        pendingChordLine = null;
        pendingRawChordLineText = null;
        pendingChordAttachedToTab = false;
        return;
      }

      currentBlock.pairs.push({
        chords: pendingChordLine,
        lyric: '',
        isStandaloneChordLine: true,
      });
      pendingChordLine = null;
      pendingRawChordLineText = null;
      pendingChordAttachedToTab = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 0. Preserve existing user `(( ... ))` or `{ ... }` blocks in raw input
    if (trimmed.startsWith('((') || trimmed === '{') {
      flushPendingChordAsStandalone();
      flushActiveInSectionTabBlock();
      const isSilence = trimmed.startsWith('((');
      const closeToken = isSilence ? '))' : '}';
      const blockLines: string[] = [line.trimEnd()];
      if (!(trimmed.length > (isSilence ? 2 : 1) && trimmed.endsWith(closeToken))) {
        while (i + 1 < lines.length) {
          i++;
          blockLines.push(lines[i].trimEnd());
          if (lines[i].trim().endsWith(closeToken)) {
            break;
          }
        }
      }
      currentBlock.pairs.push({
        chords: [],
        lyric: '',
        rawBlockLines: blockLines,
      });
      continue;
    }

    // 1. Blank line
    if (!trimmed) {
      if (activeInSectionTabLines.length > 0) {
        flushActiveInSectionTabBlock();
      }
      if (pendingChordLine) {
        flushPendingChordAsStandalone();
      }
      continue;
    }

    // 2. Check for explicit section header: either "[Verse 1]" or "1. Verse 1"
    const ugHeader = isUGBracketedSectionHeader(trimmed);
    const numHeader = parseNumberedSectionHeader(trimmed);
    if (ugHeader || numHeader) {
      flushActiveInSectionTabBlock();
      flushPendingChordAsStandalone();

      // If we are encountering our first explicit section header, handle any pre-section lines
      if (!hasExplicitHeaders && currentBlock.headerName === null) {
        if (shouldSilencePreamble) {
          // Move any collected pre-section pairs into `silencedPreambleLines`
          for (const p of currentBlock.pairs) {
            if (p.rawBlockLines) {
              const inner = p.rawBlockLines.filter(
                (l) => l.trim() !== '{' && l.trim() !== '}'
              );
              silencedPreambleLines.push(...inner);
            } else {
              if (p.chords.length > 0) {
                silencedPreambleLines.push(buildPositionedChordLine(p.chords));
              }
              if (p.lyric) {
                silencedPreambleLines.push(p.lyric);
              }
            }
          }
          currentBlock = { headerName: null, pairs: [] };
        } else if (currentBlock.pairs.length > 0) {
          currentBlock.headerName = 'Preamble';
          rawBlocks.push(currentBlock);
        }
      } else if (
        currentBlock.headerName !== null ||
        currentBlock.pairs.length > 0
      ) {
        rawBlocks.push(currentBlock);
      }

      hasExplicitHeaders = true;
      const headerName = ugHeader ?? numHeader!.name;
      currentBlock = { headerName, pairs: [] };
      continue;
    }

    // 3. Check for ASCII TAB lines (e.g. "e|---3---|") or rhythm subdivision count lines ("1 + 2 + 3 + 4 +")
    const isTab = isAsciiTabLine(line);
    const isRhythmCount = isRhythmCountOrTupletLine(line);

    if (isTab || isRhythmCount) {
      const isInPreambleBeforeAnySection =
        !hasExplicitHeaders &&
        currentBlock.headerName === null &&
        sheetHasAnyExplicitHeader;

      if (isInPreambleBeforeAnySection) {
        if (shouldSilencePreamble) {
          if (pendingRawChordLineText) {
            silencedPreambleLines.push(pendingRawChordLineText);
            pendingChordLine = null;
            pendingRawChordLineText = null;
          }
          if (!isRhythmCount) {
            silencedPreambleLines.push(line.trimEnd());
          }
          pendingChordAttachedToTab = true;
          continue;
        }
      }

      // Inside a section (or when preamble silencing is off):
      // Rhythm count lines (`1 + 2 + 3 + 4 +`, `1 e + a...`, `\ 3 /`) are always stripped as requested!
      if (isRhythmCount) {
        if (pendingChordLine) {
          pendingChordAttachedToTab = true;
        }
        continue;
      }

      // It's an ASCII TAB line (`e|---|` etc.)
      if (shouldSimplifyInlineTabs) {
        // Simplify in-song tabs: strip the ASCII tab lines and keep the pending chord line as a standalone progression
        // (or collect tab lines to infer chords if no explicit chord line was above it!)
        if (pendingChordLine) {
          pendingChordAttachedToTab = true;
        } else {
          activeInSectionTabLines.push(line.trimEnd());
        }
        continue;
      } else {
        // Keep in-song tabs and wrap contiguous tab systems in `{ ... }`!
        if (pendingRawChordLineText) {
          activeInSectionTabLines.push(pendingRawChordLineText);
          pendingChordLine = null;
          pendingRawChordLineText = null;
          pendingChordAttachedToTab = false;
        }
        activeInSectionTabLines.push(line.trimEnd());
        continue;
      }
    }

    // If we were collecting an in-section `{ ... }` tab block and hit a non-tab line, flush the `{ ... }` block now
    if (activeInSectionTabLines.length > 0) {
      flushActiveInSectionTabBlock();
    }

    // 4. Check for preamble metadata lines (e.g. "Standard tuning.", "Capo 2", "\"Shallow\"") before any section/chords
    if (
      !hasExplicitHeaders &&
      currentBlock.headerName === null &&
      currentBlock.pairs.length === 0 &&
      !pendingChordLine &&
      i > 0 &&
      sheetHasAnyExplicitHeader &&
      isPreambleMetadataLine(trimmed)
    ) {
      if (shouldSilencePreamble) {
        silencedPreambleLines.push(line.trimEnd());
        continue;
      }
    }

    // 5. Check if it's already a By Heart bracketed progression "[ C - F ]" or "[ Em7 - D/F# - G | C - G - D ]"
    if (isBracketedChordProgression(trimmed)) {
      flushPendingChordAsStandalone();
      // If it already contains `|`, preserve it as a raw line so its `|` split isn't lost
      if (trimmed.includes('|')) {
        const innerParts = trimmed
          .slice(1, -1)
          .split('|')
          .map((part) => {
            const chords = extractChordsFromLine(part).map((c) =>
              options.simplifyVoicings ? simplifyChordVoicing(c) : c
            );
            return chords.join(' - ');
          })
          .filter(Boolean);
        currentBlock.pairs.push({
          chords: [],
          lyric: '',
          rawBlockLines: [`[ ${innerParts.join(' | ')} ]`],
        });
        continue;
      }

      const chords = extractChordsFromLine(trimmed).map((c, idx) => ({
        chord: c,
        column: idx * 4,
      }));
      currentBlock.pairs.push({
        chords,
        lyric: '',
        isStandaloneChordLine: true,
      });
      continue;
    }

    // 6. Check if it's a chord-over-lyric line
    if (isChordOverLyricLine(line)) {
      if (pendingChordLine) {
        flushPendingChordAsStandalone();
      }
      pendingChordLine = extractPositionedChords(line);
      pendingRawChordLineText = line.replace(/\s+$/, '');
      pendingChordAttachedToTab = false;
      continue;
    }

    // If a pending chord line was attached to an ASCII TAB block and now we hit a normal lyric line,
    // flush the TAB's chord line as a standalone progression first so its chords aren't merged onto this lyric line!
    if (pendingChordLine && pendingChordAttachedToTab) {
      flushPendingChordAsStandalone();
    }

    // 7. Check inline ChordPro tags like "[Am]Hello [G]world"
    if (/\[[A-G][#b♯♭]?[^\]]*\]/.test(line)) {
      flushPendingChordAsStandalone();
      const positioned: PositionedChord[] = [];
      let lyricOnly = '';
      let lastIdx = 0;
      const regex = /\[([A-G][#b♯♭]?[^\]]*)\]/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        lyricOnly += line.slice(lastIdx, match.index);
        positioned.push({
          chord: match[1].trim(),
          column: lyricOnly.length,
        });
        lastIdx = match.index + match[0].length;
      }
      lyricOnly += line.slice(lastIdx);
      currentBlock.pairs.push({
        chords: positioned,
        lyric: lyricOnly,
      });
      continue;
    }

    // 8. Regular lyric line (or preamble title/artist line if on line 1 before any chords/sections)
    if (
      !hasExplicitHeaders &&
      rawBlocks.length === 0 &&
      currentBlock.pairs.length === 0 &&
      !pendingChordLine &&
      i === 0 &&
      lines.length > 1 &&
      (!lines[1].trim() ||
        isUGBracketedSectionHeader(lines[1].trim()) !== null ||
        parseNumberedSectionHeader(lines[1].trim()) !== null)
    ) {
      // Title & artist line at the very top of the raw chord sheet
      preambleLines.push(trimmed);
      continue;
    }

    currentBlock.pairs.push({
      chords: pendingChordLine ?? [],
      lyric: line.trimEnd(),
    });
    pendingChordLine = null;
    pendingRawChordLineText = null;
    pendingChordAttachedToTab = false;
  }

  flushActiveInSectionTabBlock();
  flushPendingChordAsStandalone();
  if (currentBlock.headerName !== null || currentBlock.pairs.length > 0) {
    rawBlocks.push(currentBlock);
  }

  // If there were no explicit section headers, infer stanza sections automatically
  const finalBlocks: RawSectionBlock[] =
    !hasExplicitHeaders && rawBlocks.length === 1 && rawBlocks[0].headerName === null
      ? inferSectionsFromHeaderlessPairs(rawBlocks[0].pairs, options)
      : rawBlocks;

  // Render numbered sections and handle repeated section collapse
  const outputLines: string[] = [];
  if (preambleLines.length > 0) {
    outputLines.push(...preambleLines, '');
  }

  if (shouldSilencePreamble && silencedPreambleLines.length > 0) {
    outputLines.push('((', ...silencedPreambleLines, '))', '');
  }

  const seenSectionsByBaseName = new Map<string, string>();

  finalBlocks.forEach((block, idx) => {
    const sectionNumber = idx + 1;
    const sectionName = block.headerName || `Section ${sectionNumber}`;
    const baseName = normalizeSectionBaseName(sectionName);

    const { bracketedLoop, bodyLines } = compactSectionPairs(block.pairs, options);
    const fullSectionBody = [
      ...(bracketedLoop ? [bracketedLoop] : []),
      ...bodyLines,
    ]
      .join('\n')
      .trim();

    outputLines.push(`${sectionNumber}. ${sectionName}`);

    // If the section in UG was already empty (e.g. "[Chorus]" reference) or matches an earlier section with same baseName
    if (!fullSectionBody) {
      outputLines.push('');
      return;
    }

    if (
      options.collapseRepeatedSections &&
      baseName &&
      seenSectionsByBaseName.has(baseName) &&
      seenSectionsByBaseName.get(baseName) === fullSectionBody
    ) {
      // Collapse duplicate section body into an empty reference header!
      outputLines.push('');
      return;
    }

    if (baseName && !seenSectionsByBaseName.has(baseName)) {
      seenSectionsByBaseName.set(baseName, fullSectionBody);
    }

    if (bracketedLoop) {
      outputLines.push(bracketedLoop);
    }
    outputLines.push(...bodyLines);
    outputLines.push('');
  });

  return outputLines.join('\n').trim() + '\n';
}
