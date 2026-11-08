import {
  ParsedLyricLine,
  ParsedPart,
  ParsedSection,
  ParsedSong,
  ParsedWord,
} from '../types';
import {
  isAsciiTabLine,
  isBracketedChordProgression,
  isChordOverLyricLine,
  isUGBracketedSectionHeader,
  normalizeSectionBaseName,
  parseNumberedSectionHeader,
} from './chordUtils';

/**
 * Tokenizes a lyric line into words while preserving exact leading whitespace for each word.
 */
export function tokenizeLyricWords(lyric: string): ParsedWord[] {
  const words: ParsedWord[] = [];
  const regex = /(\s*)(\S+)/g;
  let match: RegExpExecArray | null;
  let wordIndex = 0;
  while ((match = regex.exec(lyric)) !== null) {
    words.push({
      leadingWhitespace: match[1],
      text: match[2],
      wordIndex: wordIndex++,
    });
  }
  return words;
}

/**
 * Formats a bracketed progression line like "[ C - F ]" into a clean inner string "C - F".
 */
function cleanBracketedProgression(line: string): string {
  return line.trim().replace(/^\[|\]$/g, '').trim();
}

/**
 * Generates a concise pill label for a section or chunk.
 */
function makePillLabel(
  numberLabel: string,
  sectionName: string,
  chunkIdx: number,
  totalChunks: number
): string {
  const num = numberLabel.replace('.', '');
  const suffix =
    totalChunks > 1 ? String.fromCharCode(97 + chunkIdx) : ''; // 'a', 'b', 'c'...
  const shortName =
    sectionName.length > 14 ? sectionName.slice(0, 12).trim() + '…' : sectionName;
  return `${num}${suffix}. ${shortName}`;
}

/**
 * Partitions a section's lines into chunks of size `safeChunkSize` while strictly
 * respecting `{ ... }` locked chunk groups (`lockedChunkGroupId`).
 * Any lines sharing a `lockedChunkGroupId` are kept together as a single atomic chunk!
 */
function partitionSectionLinesIntoChunks(
  lines: ParsedLyricLine[],
  safeChunkSize: number
): ParsedLyricLine[][] {
  if (lines.length === 0) return [];

  const chunks: ParsedLyricLine[][] = [];
  let currentUnlockedSlice: ParsedLyricLine[] = [];

  const flushUnlockedSlice = () => {
    if (currentUnlockedSlice.length === 0) return;
    for (let i = 0; i < currentUnlockedSlice.length; i += safeChunkSize) {
      chunks.push(currentUnlockedSlice.slice(i, i + safeChunkSize));
    }
    currentUnlockedSlice = [];
  };

  let idx = 0;
  while (idx < lines.length) {
    const line = lines[idx];
    if (line.lockedChunkGroupId !== undefined) {
      flushUnlockedSlice();
      const groupId = line.lockedChunkGroupId;
      const lockedGroup: ParsedLyricLine[] = [];
      while (
        idx < lines.length &&
        lines[idx].lockedChunkGroupId === groupId
      ) {
        lockedGroup.push(lines[idx]);
        idx++;
      }
      chunks.push(lockedGroup);
    } else {
      currentUnlockedSlice.push(line);
      idx++;
    }
  }

  flushUnlockedSlice();
  return chunks;
}

/**
 * Parses a By Heart monospaced song/text body into structured Sections, Lines, and Chunks.
 */
export function parseSongBody(body: string, chunkSize = 4): ParsedSong {
  const safeChunkSize = Math.max(1, chunkSize || 4);
  const rawLines = body.replace(/\r\n/g, '\n').split('\n');

  const preambleLines: string[] = [];
  const sections: ParsedSection[] = [];

  let currentSection: ParsedSection | null = null;
  let activeProgression: string | undefined = undefined;
  let pendingBracketedProgressions: string[] = [];
  let pendingChordOverLine: string | undefined = undefined;
  let pendingTokenStartLine: number | null = null;
  let globalLineIndex = 0;

  let isInsideSilencedBlock = false;
  let activeLockedChunkGroupId: number | undefined = undefined;
  let nextLockedChunkGroupId = 1;

  const ensureDefaultSection = (lineIdx: number) => {
    if (!currentSection) {
      currentSection = {
        sectionIndex: sections.length,
        numberLabel: `${sections.length + 1}.`,
        name: `Section ${sections.length + 1}`,
        fullHeader: `${sections.length + 1}. Section ${sections.length + 1}`,
        canonicalName: `section`,
        isRepeatOfSectionIndex: null,
        lines: [],
        standaloneProgressions: [],
        rawStartLine: lineIdx,
        rawEndLine: lineIdx,
      };
      sections.push(currentSection);
    }
  };

  const flushDanglingTokensToSection = () => {
    pendingTokenStartLine = null;
    if (!currentSection) return;
    if (pendingBracketedProgressions.length > 0) {
      currentSection.standaloneProgressions.push(
        ...pendingBracketedProgressions
      );
      pendingBracketedProgressions = [];
    }
    if (pendingChordOverLine) {
      // A chord line at the end of a section with no lyric below it
      currentSection.standaloneProgressions.push(pendingChordOverLine.trim());
      pendingChordOverLine = undefined;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    let rawLine = rawLines[i];
    let trimmed = rawLine.trim();

    // 0A. Handle `(( ... ))` Silenced blocks (ignored completely by practice modes)
    if (isInsideSilencedBlock) {
      const closeIdx = rawLine.indexOf('))');
      if (closeIdx !== -1) {
        isInsideSilencedBlock = false;
        rawLine = rawLine.slice(closeIdx + 2);
        trimmed = rawLine.trim();
        if (!trimmed) continue;
      } else {
        continue;
      }
    }

    if (trimmed.startsWith('((')) {
      const closeIdx = trimmed.indexOf('))', 2);
      if (closeIdx !== -1) {
        // Inline `(( ... ))` on a single line
        rawLine =
          trimmed.slice(0, 0) + trimmed.slice(closeIdx + 2);
        trimmed = rawLine.trim();
        if (!trimmed) continue;
      } else {
        isInsideSilencedBlock = true;
        continue;
      }
    }

    // Strip any inline `(( ... ))` comment within a line
    if (rawLine.includes('((') && rawLine.includes('))')) {
      rawLine = rawLine.replace(/\(\([\s\S]*?\)\)/g, '');
      trimmed = rawLine.trim();
      if (!trimmed) continue;
    }

    // 0B. Handle `{ ... }` Locked Chunk blocks
    if (trimmed === '{') {
      activeLockedChunkGroupId = nextLockedChunkGroupId++;
      if (pendingTokenStartLine === null) {
        pendingTokenStartLine = i;
      }
      continue;
    }
    if (trimmed === '}') {
      if (activeLockedChunkGroupId !== undefined && currentSection) {
        const lastLine = currentSection.lines[currentSection.lines.length - 1];
        if (lastLine && lastLine.lockedChunkGroupId === activeLockedChunkGroupId) {
          lastLine.rawEndLine = i;
          currentSection.rawEndLine = i;
        }
      }
      activeLockedChunkGroupId = undefined;
      pendingTokenStartLine = null;
      continue;
    }

    let closeLockedGroupAfterThisLine = false;
    if (trimmed.startsWith('{') && activeLockedChunkGroupId === undefined) {
      activeLockedChunkGroupId = nextLockedChunkGroupId++;
      if (pendingTokenStartLine === null) {
        pendingTokenStartLine = i;
      }
      rawLine = rawLine.replace(/^\s*\{\s?/, '');
      trimmed = rawLine.trim();
      if (trimmed.endsWith('}')) {
        rawLine = rawLine.replace(/\s*\}\s*$/, '');
        trimmed = rawLine.trim();
        closeLockedGroupAfterThisLine = true;
      }
      if (!trimmed) {
        if (closeLockedGroupAfterThisLine) {
          activeLockedChunkGroupId = undefined;
          pendingTokenStartLine = null;
        }
        continue;
      }
    } else if (
      trimmed.endsWith('}') &&
      activeLockedChunkGroupId !== undefined
    ) {
      rawLine = rawLine.replace(/\s*\}\s*$/, '');
      trimmed = rawLine.trim();
      closeLockedGroupAfterThisLine = true;
      if (!trimmed) {
        if (currentSection) {
          const lastLine = currentSection.lines[currentSection.lines.length - 1];
          if (
            lastLine &&
            lastLine.lockedChunkGroupId === activeLockedChunkGroupId
          ) {
            lastLine.rawEndLine = i;
            currentSection.rawEndLine = i;
          }
        }
        activeLockedChunkGroupId = undefined;
        pendingTokenStartLine = null;
        continue;
      }
    }

    if (!trimmed) {
      continue;
    }

    // 1. Check for numbered section header: "1. Verse 1", "2. Pre-Chorus", "5. Chorus"
    const numberedHeader = parseNumberedSectionHeader(trimmed);
    const ugSectionHeader = !numberedHeader
      ? isUGBracketedSectionHeader(trimmed)
      : null;

    if (numberedHeader || ugSectionHeader) {
      flushDanglingTokensToSection();
      activeLockedChunkGroupId = undefined;
      pendingTokenStartLine = null;

      const numberLabel = numberedHeader
        ? numberedHeader.numberLabel
        : `${sections.length + 1}.`;
      const name = numberedHeader ? numberedHeader.name : ugSectionHeader!;

      currentSection = {
        sectionIndex: sections.length,
        numberLabel,
        name,
        fullHeader: `${numberLabel} ${name}`,
        canonicalName: normalizeSectionBaseName(name),
        isRepeatOfSectionIndex: null,
        lines: [],
        standaloneProgressions: [],
        rawStartLine: i,
        rawEndLine: i,
      };
      sections.push(currentSection);
      continue;
    }

    // 2. Check for bracketed chord progression: "[ C - F ]" or "[ Em7 - D/F# - G | C - G - D ]"
    if (isBracketedChordProgression(trimmed)) {
      ensureDefaultSection(i);
      const prog = cleanBracketedProgression(trimmed);
      activeProgression = prog;
      pendingBracketedProgressions.push(prog);
      if (pendingTokenStartLine === null) {
        pendingTokenStartLine = i;
      }
      if (currentSection) {
        currentSection.rawEndLine = i;
      }
      if (closeLockedGroupAfterThisLine) {
        activeLockedChunkGroupId = undefined;
      }
      continue;
    }

    // 3. Check for chord-over-lyric exception line: "   G" or "                          E"
    if (isChordOverLyricLine(rawLine) && !isAsciiTabLine(rawLine)) {
      ensureDefaultSection(i);
      if (pendingChordOverLine) {
        // Previous chord line had no lyric line beneath it; treat it as standalone progression
        currentSection!.standaloneProgressions.push(pendingChordOverLine.trim());
      }
      pendingChordOverLine = rawLine.replace(/\s+$/, '');
      if (pendingTokenStartLine === null) {
        pendingTokenStartLine = i;
      }
      if (currentSection) {
        currentSection.rawEndLine = i;
      }
      if (closeLockedGroupAfterThisLine) {
        activeLockedChunkGroupId = undefined;
      }
      continue;
    }

    // 4. Check if this is preamble title/artist text at the top before the first numbered section
    if (!currentSection && sections.length === 0) {
      // Look ahead to see if the document uses numbered sections later
      const hasNumberedSectionsBelow = rawLines
        .slice(i + 1)
        .some(
          (l) =>
            parseNumberedSectionHeader(l.trim()) !== null ||
            isUGBracketedSectionHeader(l.trim()) !== null
        );
      if (hasNumberedSectionsBelow) {
        preambleLines.push(trimmed);
        continue;
      }
    }

    // 5. Regular lyric line (or ASCII TAB line inside a section)
    ensureDefaultSection(i);
    const lyricText = rawLine.trimEnd();
    const isTab = isAsciiTabLine(lyricText);

    // If multiple `[ ... ]` bracketed progressions were queued before this line (e.g.
    // `[ Em7 - D/F# - G ]` intro vamp followed by `[ Em7 - D/F# - G | C - G - D ]` stanza loop),
    // the last one is the stanza's `introducedProgression` and any preceding ones are `preLineProgressions`!
    const introducedProg =
      pendingBracketedProgressions.length > 0
        ? pendingBracketedProgressions[pendingBracketedProgressions.length - 1]
        : undefined;
    const preLineProgs =
      pendingBracketedProgressions.length > 1
        ? pendingBracketedProgressions.slice(0, -1)
        : undefined;

    const lineStartLine =
      pendingTokenStartLine !== null ? pendingTokenStartLine : i;
    const lineEndLine = i;

    const lineObj: ParsedLyricLine = {
      lineIndexInSection: currentSection!.lines.length,
      globalLineIndex: globalLineIndex++,
      lyric: lyricText,
      words: tokenizeLyricWords(lyricText),
      chordOverLine: pendingChordOverLine,
      introducedProgression: introducedProg,
      preLineProgressions: preLineProgs,
      activeProgression,
      lockedChunkGroupId: activeLockedChunkGroupId,
      isTabLine: isTab || undefined,
      rawStartLine: lineStartLine,
      rawEndLine: lineEndLine,
    };

    currentSection!.lines.push(lineObj);
    currentSection!.rawEndLine = i;
    pendingChordOverLine = undefined;
    pendingBracketedProgressions = [];
    pendingTokenStartLine = null;

    if (closeLockedGroupAfterThisLine) {
      activeLockedChunkGroupId = undefined;
    }
  }

  flushDanglingTokensToSection();
  if (currentSection) {
    currentSection.rawEndLine = Math.max(
      currentSection.rawStartLine ?? 0,
      rawLines.length - 1
    );
  }

  // Resolve repeated sections:
  // Case A: An empty section like "5. Chorus" matches an earlier section with the same canonicalName ("3. Chorus").
  // Case B: A section with the same canonicalName and identical lyric lines to an earlier section.
  const firstSectionByCanonicalName = new Map<string, ParsedSection>();

  for (const sec of sections) {
    const key = sec.canonicalName;
    if (!key) continue;

    const earlier = firstSectionByCanonicalName.get(key);
    if (!earlier) {
      if (sec.lines.length > 0 || sec.standaloneProgressions.length > 0) {
        firstSectionByCanonicalName.set(key, sec);
      }
      continue;
    }

    const isEmptyBody =
      sec.lines.length === 0 && sec.standaloneProgressions.length === 0;
    const isIdenticalLyrics =
      sec.lines.length > 0 &&
      sec.lines.length === earlier.lines.length &&
      sec.lines.every(
        (l, idx) =>
          l.lyric.trim().toLowerCase() ===
          earlier.lines[idx].lyric.trim().toLowerCase()
      );

    if (isEmptyBody || isIdenticalLyrics) {
      sec.isRepeatOfSectionIndex = earlier.sectionIndex;
      if (isEmptyBody) {
        // Clone lines from the earlier section so Scaffold/Expand views can still inspect them if desired
        sec.lines = earlier.lines.map((l) => ({
          ...l,
          words: l.words.map((w) => ({ ...w })),
        }));
        sec.standaloneProgressions = [...earlier.standaloneProgressions];
      }
    }
  }

  // Build sectionParts (1 part per section) and chunkParts (N lyric lines per chunk, respecting `{ ... }` locked groups)
  const sectionParts: ParsedPart[] = [];
  const chunkParts: ParsedPart[] = [];

  for (const sec of sections) {
    const repeatHeader =
      sec.isRepeatOfSectionIndex !== null
        ? sections[sec.isRepeatOfSectionIndex]?.fullHeader
        : undefined;

    const lastSectionLine = sec.lines[sec.lines.length - 1];
    const cleanSectionEndLine =
      sec.isRepeatOfSectionIndex !== null
        ? sec.rawEndLine
        : (lastSectionLine?.rawEndLine ?? sec.rawEndLine);

    // 1. Whole-section part
    sectionParts.push({
      partIndex: sectionParts.length,
      pillLabel: makePillLabel(sec.numberLabel, sec.name, 0, 1),
      title: sec.fullHeader,
      sectionIndex: sec.sectionIndex,
      sectionHeader: sec.fullHeader,
      isFirstChunkOfSection: true,
      chunkIndexInSection: 0,
      totalChunksInSection: 1,
      isRepeatOfSectionIndex: sec.isRepeatOfSectionIndex,
      repeatOfSectionHeader: repeatHeader,
      lines: sec.lines,
      standaloneProgressions: sec.standaloneProgressions,
      rawStartLine: sec.rawStartLine,
      rawEndLine: cleanSectionEndLine,
    });

    // 2. Chunk parts (default 4 lines per chunk, keeping `{ ... }` groups locked together)
    const partitionedSlices =
      sec.isRepeatOfSectionIndex !== null
        ? [sec.lines]
        : partitionSectionLinesIntoChunks(sec.lines, safeChunkSize);

    if (
      sec.isRepeatOfSectionIndex !== null ||
      partitionedSlices.length <= 1
    ) {
      chunkParts.push({
        partIndex: chunkParts.length,
        pillLabel: makePillLabel(sec.numberLabel, sec.name, 0, 1),
        title: sec.fullHeader,
        sectionIndex: sec.sectionIndex,
        sectionHeader: sec.fullHeader,
        isFirstChunkOfSection: true,
        chunkIndexInSection: 0,
        totalChunksInSection: 1,
        isRepeatOfSectionIndex: sec.isRepeatOfSectionIndex,
        repeatOfSectionHeader: repeatHeader,
        lines: sec.lines,
        standaloneProgressions: sec.standaloneProgressions,
        rawStartLine: sec.rawStartLine,
        rawEndLine: cleanSectionEndLine,
      });
    } else {
      const totalChunks = partitionedSlices.length;
      for (let c = 0; c < totalChunks; c++) {
        const slice = partitionedSlices[c];
        const suffix = String.fromCharCode(97 + c); // a, b, c...
        const firstLine = slice[0];
        const lastLine = slice[slice.length - 1];
        const chunkStartLine =
          c === 0 && sec.rawStartLine !== undefined
            ? sec.rawStartLine
            : (firstLine?.rawStartLine ?? sec.rawStartLine);
        const chunkEndLine = lastLine?.rawEndLine ?? sec.rawEndLine;

        chunkParts.push({
          partIndex: chunkParts.length,
          pillLabel: makePillLabel(sec.numberLabel, sec.name, c, totalChunks),
          title: `${sec.fullHeader} (${suffix.toUpperCase()})`,
          sectionIndex: sec.sectionIndex,
          sectionHeader: sec.fullHeader,
          isFirstChunkOfSection: c === 0,
          chunkIndexInSection: c,
          totalChunksInSection: totalChunks,
          isRepeatOfSectionIndex: null,
          lines: slice,
          standaloneProgressions: c === 0 ? sec.standaloneProgressions : [],
          rawStartLine: chunkStartLine,
          rawEndLine: chunkEndLine,
        });
      }
    }
  }

  return {
    preambleLines,
    sections,
    chunkParts,
    sectionParts,
  };
}
