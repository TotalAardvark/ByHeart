import { describe, expect, it } from 'vitest';
import { compactChordSheet } from '../compactor';
import {
  appendCapoToShortName,
  extractCapoLabel,
  isChordToken,
  isRhythmCountOrTupletLine,
  simplifyChordVoicing,
} from '../chordUtils';
import { parseSongBody } from '../parser';
import { parseChordSheetFromHtml } from '../urlScraper';
import { buildGuidedChainSteps } from '../chaining';
import {
  COMPACTED_ROTTERDAM_BODY,
  RAW_ROTTERDAM_UG_SAMPLE,
  RAW_SHALLOW_UG_SAMPLE,
} from '../sampleSongs';
import { THEME_PALETTES, getThemePalette } from '../themes';
import {
  estimateItemCharWidth,
  estimateItemVisualWeight,
  selectOptimalColumnCount,
  splitIntoBalancedColumns,
  splitIntoTwoBalancedPages,
} from '../layoutUtils';

describe('Smart Ultimate Guitar Compactor', () => {
  it('compacts the raw Rotterdam UG sheet into clean By Heart notation with simplifyVoicings enabled (including dominant 7th simplification)', () => {
    const compacted = compactChordSheet(RAW_ROTTERDAM_UG_SAMPLE, {
      simplifyVoicings: true,
      suppressConsecutiveDuplicateChords: true,
      collapseRepeatedSections: true,
    });

    // 1. Verse 1 should have [ C - F ] and clean 4-line stanza with no redundant chords
    expect(compacted).toContain('1. Verse 1\n[ C - F ]\nAnd the women tug their hair');
    expect(compacted).toContain(
      "And the women tug their hair\nLike they're trying to prove it won't fall out\nAnd all the men are gargoyles\nDipped long in Irish stout"
    );

    // 2. Chorus should hoist [ Am - C ] (without x3 clutter) and simplify D7 G7 -> D G when simplifyVoicings is enabled
    expect(compacted).toContain('3. Chorus\n[ Am - C ]\nThis could be Rotterdam or anywhere');
    expect(compacted).toMatch(/D\s+G\n'Cause Rotterdam is anywhere, anywhere alone,/);

    // 3. Repeated Chorus at the end should collapse to an empty numbered header "6. Chorus"
    expect(compacted).toMatch(/6\. Chorus\s*$/);
  });

  it('preserves original chord voicings (e.g. Fmaj7, D7, G7) by default while still suppressing duplicates and collapsing repeats', () => {
    const compacted = compactChordSheet(RAW_ROTTERDAM_UG_SAMPLE);

    expect(compacted).toContain('3. Chorus\n[ Am - C ]\nThis could be Rotterdam or anywhere');
    expect(compacted).toMatch(/D7\s+G7\n'Cause Rotterdam is anywhere, anywhere alone,/);
    expect(compacted).toMatch(/6\. Chorus\s*$/);
  });

  it('handles UG 1-2-3-1 boundary-chord omission across lines', () => {
    const ugWithOmittedBoundaryChord = `[Verse 1]
C       G       Am      C
First line of the verse here
        G       Am      C
Second line omits the leading C chord
        G       Am      C
Third line also omits the leading C chord
        G       Am      C
Fourth line finishes the cycle`;

    const compacted = compactChordSheet(ugWithOmittedBoundaryChord);
    expect(compacted).toContain('1. Verse 1\n[ C - G - Am - C ]\nFirst line of the verse here\nSecond line omits the leading C chord');
  });

  it('compacts Shallow with 2-line couplet chord loops [ Em7 - D/F# - G | C - G - D ], preserves leading [ Em7 - D/F# - G ] vamp, silences preamble ((...)), strips rhythm counts, and wraps in-song TABs in {...}', () => {
    const compactedDefault = compactChordSheet(RAW_SHALLOW_UG_SAMPLE);

    // 1. Silences preamble metadata & chord voicing glossary in (( ... ))
    expect(compactedDefault).toContain('((\nStandard tuning.\nCapo 2');
    expect(compactedDefault).toContain('E|-0----2----3------------------------0--------------|\n))');

    // 2. Strips rhythm subdivision lines ("1 + 2 + 3 + 4 + etc.", "1 e + a...", "\ 3 /")
    expect(compactedDefault).not.toContain('1 + 2 + 3 + 4 +');
    expect(compactedDefault).not.toContain('1 e + a');
    expect(compactedDefault).not.toContain('\\ 3 /');

    // 3. Wraps in-song Intro TAB blocks in { ... } by default (when simplifyInlineTabs is false)
    expect(compactedDefault).toContain('1. Intro\n{\n   Em7             D/F#             G');

    // 4. Preserves the standalone [ Em7 - D/F# - G ] intro vamp before Verse 1 AND detects the 2-line couplet loop [ Em7 - D/F# - G | C - G - D ]
    expect(compactedDefault).toContain(
      '2. Verse 1\n[ Em7 - D/F# - G ]\n[ Em7 - D/F# - G | C - G - D ]\n  Tell me something, girl\n  Are you happy in this modern world?'
    );

    // 5. Detects the 2-line couplet loop [ Am - D/F# | G - D - Em ] on the Chorus and collapses the final repeated Chorus/Post-Chorus
    expect(compactedDefault).toContain(
      "6. Chorus\n[ Am - D/F# | G - D - Em ]\nI'm off the deep end, watch as I dive in"
    );
    expect(compactedDefault).toContain('9. Chorus\n\n10. Post-Chorus');

    // 6. When simplifyInlineTabs is true, collapses the Intro TAB into bracketed chord progressions instead of { ... }
    const compactedSimplifiedTabs = compactChordSheet(RAW_SHALLOW_UG_SAMPLE, {
      simplifyVoicings: false,
      suppressConsecutiveDuplicateChords: true,
      collapseRepeatedSections: true,
      simplifyInlineTabs: true,
      silencePreambleAndVoicings: true,
    });
    expect(compactedSimplifiedTabs).not.toContain('\n{\n');
    expect(compactedSimplifiedTabs).toContain(
      '1. Intro\n[ Em7 - D/F# - G ]\n[ C - G - D ]'
    );
  });

  it('extracts capo info and appends (capo N) to shorthand song names, and recognizes rhythm count lines', () => {
    expect(extractCapoLabel(RAW_SHALLOW_UG_SAMPLE)).toBe('capo 2');
    expect(extractCapoLabel('No capo\n[Verse 1]')).toBeNull();
    expect(extractCapoLabel('Capo on 4th fret')).toBe('capo 4');
    expect(appendCapoToShortName('Shallow', 'capo 2')).toBe('Shallow (capo 2)');
    expect(appendCapoToShortName('Shallow (capo 1)', 'capo 2')).toBe('Shallow (capo 2)');

    expect(isRhythmCountOrTupletLine('  1 + 2 + 3 + 4 + etc.')).toBe(true);
    expect(isRhythmCountOrTupletLine('1 e + a 2 e + a 3 e + a 4 e + a')).toBe(true);
    expect(isRhythmCountOrTupletLine('        \\ 3 /')).toBe(true);
    expect(isRhythmCountOrTupletLine('Tell me something girl')).toBe(false);
  });
});

describe('By Heart Notation Parser & Chaining Engine', () => {
  it('parses sections, bracketed loops, chord-over-lyric exceptions, and empty repeat sections', () => {
    const parsed = parseSongBody(COMPACTED_ROTTERDAM_BODY, 4);

    expect(parsed.preambleLines).toEqual([
      'Rotterdam (Or Anywhere) - The Beautiful South',
    ]);
    expect(parsed.sections).toHaveLength(6);

    // Section 0: 1. Verse 1
    expect(parsed.sections[0].fullHeader).toBe('1. Verse 1');
    expect(parsed.sections[0].lines[0].introducedProgression).toBe('C - F');
    expect(parsed.sections[0].lines[1].introducedProgression).toBeUndefined();
    expect(parsed.sections[0].lines[1].activeProgression).toBe('C - F');

    // Section 1: 2. Pre-Chorus (G on line 0, E on line 3)
    expect(parsed.sections[1].lines[0].chordOverLine).toBe('   G');
    expect(parsed.sections[1].lines[3].chordOverLine?.trim()).toBe('E');

    // Section 2: 3. Chorus ([ Am - C ] + D7 G7 on line 1)
    expect(parsed.sections[2].lines[0].introducedProgression).toBe('Am - C');
    expect(parsed.sections[2].lines[1].chordOverLine).toContain('D7');
    expect(parsed.sections[2].lines[1].chordOverLine).toContain('G7');

    // Section 4 ("5. Pre-Chorus") and Section 5 ("6. Chorus") are empty-body repeats
    expect(parsed.sections[4].isRepeatOfSectionIndex).toBe(1);
    expect(parsed.sections[5].isRepeatOfSectionIndex).toBe(2);
  });

  it('generates forward chaining steps and skips isolated steps for repeated sections', () => {
    const simpleSong = `1. Verse 1
[ C - F ]
Line 1
Line 2
Line 3
Line 4

2. Chorus
[ Am - C ]
Chorus line 1
Chorus line 2

3. Verse 2
Line 5
Line 6
Line 7
Line 8

4. Chorus
`;
    const parsed = parseSongBody(simpleSong, 4);
    const steps = buildGuidedChainSteps(parsed.chunkParts);

    // Expected flow for V1 (0), C1 (1), V2 (2), C2 (3 - repeat of 1):
    // Step 0: Learn V1 [0] -> pill 0 yellow
    // Step 1: Learn C1 [1] -> pill 0 green, pill 1 yellow
    // Step 2: Chain V1+C1 [0, 1] -> pills 0, 1 yellow
    // Step 3: Learn V2 [2] -> pills 0, 1 green, pill 2 yellow
    // Step 4: Chain V1+C1+V2 [0, 1, 2] -> pills 0, 1, 2 yellow
    // Step 5: Confirm V1+C1+V2+C2 [0, 1, 2, 3] (skips isolated C2!) -> pills 0, 1, 2, 3 yellow
    expect(steps.map((s) => s.visiblePartIndices)).toEqual([
      [0],
      [1],
      [0, 1],
      [2],
      [0, 1, 2],
      [0, 1, 2, 3],
    ]);

    expect(steps[0].pillStates).toEqual({ 0: 'yellow' });
    expect(steps[1].pillStates).toEqual({ 0: 'green', 1: 'yellow' });
    expect(steps[2].pillStates).toEqual({ 0: 'yellow', 1: 'yellow' });
    expect(steps[3].pillStates).toEqual({ 0: 'green', 1: 'green', 2: 'yellow' });
    expect(steps[4].pillStates).toEqual({
      0: 'yellow',
      1: 'yellow',
      2: 'yellow',
    });
    expect(steps[5].pillStates).toEqual({
      0: 'yellow',
      1: 'yellow',
      2: 'yellow',
      3: 'yellow',
    });
  });

  it('ignores (( ... )) silenced blocks, locks { ... } blocks as atomic chunks regardless of chunkSize, and separates preLineProgressions from introducedProgression', () => {
    const customSong = `Shallow - Lady Gaga & Bradley Cooper

((
Standard tuning.
Capo 2
   Em7  D/F#  G
e|(3)--(2)--(3)|
))

1. Intro
{
   Em7  D/F#  G
e|(3)--(2)--(3)--|
B|-3----3----3---|
G|-0----2----0---|
D|-2----0----0---|
A|-2---(0)--(2)--|
E|-0----2----3---|
}
{
   C    G     D
e|-0----3----2---|
B|-1----3----3---|
G|-0----0----2---|
D|-2----0----0---|
A|-3-------------|
E|------3--------|
}

2. Verse 1
[ Em7 - D/F# - G ]
[ Em7 - D/F# - G | C - G - D ]
Tell me something, girl
Are you happy in this modern world?
Or do you need more?
Is there something else you're searchin' for?
`;

    // Even with chunkSize = 2, each 6-line { ... } TAB block in 1. Intro stays intact as 1 atomic chunk!
    const parsed = parseSongBody(customSong, 2);

    // (( ... )) was completely ignored
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0].fullHeader).toBe('1. Intro');
    expect(parsed.sections[0].lines).toHaveLength(12);
    expect(parsed.sections[0].lines.every((l) => l.isTabLine)).toBe(true);

    // 1. Intro has 2 { ... } blocks -> 2 chunks (6 lines each), NOT 6 chunks of 2 lines!
    const introChunks = parsed.chunkParts.filter((p) => p.sectionIndex === 0);
    expect(introChunks).toHaveLength(2);
    expect(introChunks[0].lines).toHaveLength(6);
    expect(introChunks[0].lines[0].chordOverLine).toContain('Em7');
    expect(introChunks[1].lines).toHaveLength(6);
    expect(introChunks[1].lines[0].chordOverLine).toContain('C');

    // 2. Verse 1 has [ Em7 - D/F# - G ] in preLineProgressions and [ Em7 - D/F# - G | C - G - D ] in introducedProgression
    const verse1 = parsed.sections[1];
    expect(verse1.lines[0].preLineProgressions).toEqual(['Em7 - D/F# - G']);
    expect(verse1.lines[0].introducedProgression).toBe(
      'Em7 - D/F# - G | C - G - D'
    );
  });

  it('accurately tracks rawStartLine and rawEndLine for sections and chunks for in-place refining', () => {
    const rawSong = `A Song Title
Artist Name

1. Verse 1
[ G - D ]
Line 1
Line 2
Line 3
Line 4
Line 5
Line 6

2. Chorus
[ C - G ]
Chorus Line 1
Chorus Line 2
`;
    const parsed = parseSongBody(rawSong, 4);

    // Section 1: Verse 1 starts at line 3 ("1. Verse 1")
    const verse1 = parsed.sections[0];
    expect(verse1.rawStartLine).toBe(3);

    // Chunk 1a has lines 1-4: rawStartLine = 3 (includes section header & progression), rawEndLine = 8 ("Line 4")
    const chunk1a = parsed.chunkParts[0];
    expect(chunk1a.title).toContain('1. Verse 1 (A)');
    expect(chunk1a.rawStartLine).toBe(3);
    expect(chunk1a.rawEndLine).toBe(8);

    // Chunk 1b has lines 5-6: rawStartLine = 9 ("Line 5"), rawEndLine = 10 ("Line 6")
    const chunk1b = parsed.chunkParts[1];
    expect(chunk1b.title).toContain('1. Verse 1 (B)');
    expect(chunk1b.rawStartLine).toBe(9);
    expect(chunk1b.rawEndLine).toBe(10);

    // Section 2: Chorus starts at line 12 ("2. Chorus")
    const chorus = parsed.sections[1];
    expect(chorus.rawStartLine).toBe(12);
    const chorusChunk = parsed.chunkParts[2];
    expect(chorusChunk.title).toContain('2. Chorus');
    expect(chorusChunk.rawStartLine).toBe(12);
  });

  it('preserves line indexing when chord-over-lyric lines and locked chunks are parsed', () => {
    const rawSong = `1. Verse 1
   G          D
A line with chords
   Em         C
Second line with chords
{
Third line locked
Fourth line locked
}
Fifth line alone
`;
    const parsed = parseSongBody(rawSong, 2);
    expect(parsed.sections).toHaveLength(1);
    const sec = parsed.sections[0];
    expect(sec.rawStartLine).toBe(0);
    expect(sec.rawEndLine).toBe(10); // line 10 is the trailing line at end of string

    // First chunk has line 1 and line 2 (indices 0 to 4 in raw lines)
    const chunk1 = parsed.chunkParts[0];
    expect(chunk1.rawStartLine).toBe(0); // Starts at section header
    expect(chunk1.rawEndLine).toBe(4); // Ends after second lyric line

    // Second chunk is the { ... } locked block
    const chunk2 = parsed.chunkParts[1];
    expect(chunk2.rawStartLine).toBe(5); // Starts at "{"
    expect(chunk2.rawEndLine).toBe(7); // Ends at "Fourth line locked"

    // Third chunk is Fifth line alone
    const chunk3 = parsed.chunkParts[2];
    expect(chunk3.rawStartLine).toBe(9); // "Fifth line alone"
    expect(chunk3.rawEndLine).toBe(9);
  });
});

describe('Color Palette Themes', () => {
  it('defines all 6 palettes with 4 color swatches and distinct Heart logo styling', () => {
    expect(THEME_PALETTES).toHaveLength(6);
    const ids = THEME_PALETTES.map((t) => t.id);
    expect(ids).toEqual([
      'ocean',
      'citrus',
      'sunset',
      'velvet',
      'sorbet',
      'canyon',
    ]);

    const heartFills = new Set<string>();
    for (const palette of THEME_PALETTES) {
      expect(palette.swatches).toHaveLength(4);
      expect(getThemePalette(palette.id).name).toBe(palette.name);
      expect(palette.logo.heartFill).toMatch(/^#[0-9a-fA-F]{6}$/);
      heartFills.add(palette.logo.heartFill);
    }
    // Every palette has a distinct Heart icon fill color matching its palette
    expect(heartFills.size).toBe(6);
  });
});

describe('Landscape Two-Page Spread Balancer', () => {
  it('splits Rotterdam parts into two balanced portrait pages with repeats flowing naturally at the end of Page 2', () => {
    const parsed = parseSongBody(COMPACTED_ROTTERDAM_BODY, 4);
    const [leftPage, rightPage] = splitIntoTwoBalancedPages(
      parsed.chunkParts,
      (part) =>
        estimateItemVisualWeight({
          isRepeat: part.isRepeatOfSectionIndex !== null,
          lines: part.lines,
          standaloneProgressions: part.standaloneProgressions,
          showHeader: true,
        })
    );

    // Page 1 gets Verse 1 + Pre-Chorus (~14.85 visual lines) and Page 2 gets Chorus + Verse 2 + the two enlarged repeat badges (~18.95 visual lines),
    // which is the closest balanced height split (diff 4.1 vs diff 7.6)
    expect(leftPage.map((p) => p.sectionHeader)).toEqual([
      '1. Verse 1',
      '2. Pre-Chorus',
    ]);
    expect(rightPage.map((p) => p.sectionHeader)).toEqual([
      '3. Chorus',
      '4. Verse 2',
      '5. Pre-Chorus',
      '6. Chorus',
    ]);
  });

  it('generalizes to 3+ balanced columns and dynamically expands to 3 columns in landscape mode when long text leaves side space', () => {
    const longSongBody = `Shallow - Lady Gaga & Bradley Cooper

1. Intro
[ Em7 - D/F# - G - C - Cadd9 - G - D ]
  1 + 2 + 3 + 4 + etc.
e + a 2 e + a 3 e + a 4 e + a
[ Em7 - D/F# - G ]
  1 + 2 + 3 + 4 +

2. Verse 1
Em7      D/F#     G
  Tell me something girl...
C                 G     D
  Are you happy in this modern world?
Em7      D/F#    G
  Or do you need more?
C                       G     D
  Is there something else you're searching for?

3. Verse 2
[ Em7 - D/F# - G ]
  I'm fall-in'
C                     G     D         Em7 D/F# G
  In all the good times I find myself longin' for change
C                    G     D    Em7  D/F# G
  And in the bad times I fear myself

4. Verse 3
Em7      D/F#     G
  Tell me something boy...
C                      G     D
  Aren't you tired tryin' to fill that void
Em7      D/F#    G
  Or do you need more?
C                  G     D
  Ain't it hard keeping it so hardcore

5. Verse 4
  I'm fall-ing
C                     G     D         Em7 D/F# G
  In all the good times I find myself longin' for change
C                    G     D
  And in the bad times I fear myself

6. Chorus
Am               D/F#
I'm off the deep end, watch as I dive in
G        D       Em
I'll never meet the ground
Am                    D/F#
Crash through the surface, where they can't hurt us
    G          D     Em
We're far from the shallow now

7. Post-Chorus
Am           D/F#
  In the sha-ha-sha-ha-low
G        D          Em
  In the sha-ha-sha-la-la-la-low
Am           D/F#
  In the sha-ha-sha-ha-ha-low
      G         D     Em
  We're far from the shallow now

8. Bridge
Bm  D
Wooaaaah
A   Em   Bm   D    A
Woaaaaaaaaaaaaaaaaaaaaahhhhh

9. Chorus

10. Post-Chorus
Am           D/F#
  In the sha-ha-sha-ha-low
G        D          Em
  In the sha-ha-sha-la-la-la-low
Am           D/F#
  In the sha-ha-sha-ha-ha-low
      G         D     Em
  We're far from the shallow now`;

    const parsed = parseSongBody(longSongBody, 4);
    const getWeight = (sec: (typeof parsed.sectionParts)[number]) =>
      estimateItemVisualWeight({
        isRepeat: sec.isRepeatOfSectionIndex !== null,
        lines: sec.lines,
        standaloneProgressions: sec.standaloneProgressions,
        showHeader: true,
      });
    const getCharWidth = (sec: (typeof parsed.sectionParts)[number]) =>
      estimateItemCharWidth({
        isRepeat: sec.isRepeatOfSectionIndex !== null,
        lines: sec.lines,
        standaloneProgressions: sec.standaloneProgressions,
        showHeader: true,
        title: sec.title,
        sectionHeader: sec.sectionHeader,
        repeatOfSectionHeader: sec.repeatOfSectionHeader,
      });

    const threeCols = splitIntoBalancedColumns(
      parsed.sectionParts,
      3,
      getWeight
    );
    expect(threeCols).toHaveLength(3);
    // All 10 sections are preserved in contiguous reading order across the 3 columns
    expect(threeCols.flat().map((s) => s.sectionHeader)).toEqual(
      parsed.sectionParts.map((s) => s.sectionHeader)
    );

    // On a standard landscape stage (e.g. 1280x640 available space), 1 column is very tall (~1900px) and narrow (~440px),
    // so selectOptimalColumnCount should automatically choose 3 columns to fill the horizontal space!
    const optimalCols = selectOptimalColumnCount({
      items: parsed.sectionParts,
      currentColumns: 1,
      maxColumns: 4,
      availW: 1280,
      availH: 640,
      naturalW: 440,
      naturalH: 1900,
      maxScale: 1.05,
      getWeight,
      getCharWidth,
    });
    expect(optimalCols).toBe(3);
  });
});

describe('Dynamic Chunk Size Configuration', () => {
  it('correctly re-chunks songs when chunk size is changed', () => {
    // Rotterdam has 4 lines in Verse 1, 4 lines in Pre-Chorus, 3 lines in Chorus, 4 lines in Verse 2, plus 2 repeated sections
    const size4 = parseSongBody(COMPACTED_ROTTERDAM_BODY, 4);
    const size2 = parseSongBody(COMPACTED_ROTTERDAM_BODY, 2);
    const size1 = parseSongBody(COMPACTED_ROTTERDAM_BODY, 1);
    const size8 = parseSongBody(COMPACTED_ROTTERDAM_BODY, 8);

    // Section parts remain invariant regardless of chunk size
    expect(size4.sectionParts.length).toBe(size2.sectionParts.length);
    expect(size4.sections.length).toBe(6);

    // With 4 lines/chunk:
    // Verse 1 (4 lines) -> 1 chunk
    // Pre-Chorus (4 lines) -> 1 chunk
    // Chorus (3 lines) -> 1 chunk
    // Verse 2 (4 lines) -> 1 chunk
    // 5. Pre-Chorus (repeat) -> 1 chunk
    // 6. Chorus (repeat) -> 1 chunk
    // Total = 6 chunks
    expect(size4.chunkParts).toHaveLength(6);

    // With 2 lines/chunk:
    // Verse 1 (4 lines) -> 2 chunks
    // Pre-Chorus (4 lines) -> 2 chunks
    // Chorus (3 lines) -> 2 chunks
    // Verse 2 (4 lines) -> 2 chunks
    // 2 repeats -> 2 chunks
    // Total = 10 chunks
    expect(size2.chunkParts).toHaveLength(10);

    // With 1 line/chunk:
    // 4 + 4 + 3 + 4 = 15 line chunks + 2 repeats = 17 chunks
    expect(size1.chunkParts).toHaveLength(17);

    // With 8 lines/chunk:
    // Each section has <= 4 lines, so each section is 1 chunk -> 6 chunks
    expect(size8.chunkParts).toHaveLength(6);
  });
});

describe('Comprehensive Chord Voicing Simplifier (Major, Minor, Diminished Only)', () => {
  const CHORD_TEST_CASES: Array<{ category: string; input: string; expected: string }> = [
    // 1. Major & Major 7th / 9th / 13th
    { category: 'Major & Maj7/9/13', input: 'C', expected: 'C' },
    { category: 'Major & Maj7/9/13', input: 'Cmaj7', expected: 'C' },
    { category: 'Major & Maj7/9/13', input: 'CM7', expected: 'C' },
    { category: 'Major & Maj7/9/13', input: 'Fmaj9', expected: 'F' },
    { category: 'Major & Maj7/9/13', input: 'Bbmaj13', expected: 'Bb' },
    { category: 'Major & Maj7/9/13', input: 'F#maj7#11', expected: 'F#' },

    // 2. Dominant 7th / 9th / 11th / 13th & Altered Dominants
    { category: 'Dominant & Altered', input: 'E7', expected: 'E' },
    { category: 'Dominant & Altered', input: 'G9', expected: 'G' },
    { category: 'Dominant & Altered', input: 'D11', expected: 'D' },
    { category: 'Dominant & Altered', input: 'A13', expected: 'A' },
    { category: 'Dominant & Altered', input: 'E7#9', expected: 'E' },
    { category: 'Dominant & Altered', input: 'G7b9', expected: 'G' },
    { category: 'Dominant & Altered', input: 'C7#5', expected: 'C' },
    { category: 'Dominant & Altered', input: 'B7b5', expected: 'B' },

    // 3. Suspended, Add, 6th, Power Chords
    { category: 'Sus / Add / 6th / 5th', input: 'Dsus2', expected: 'D' },
    { category: 'Sus / Add / 6th / 5th', input: 'Dsus4', expected: 'D' },
    { category: 'Sus / Add / 6th / 5th', input: 'Asus', expected: 'A' },
    { category: 'Sus / Add / 6th / 5th', input: 'G7sus4', expected: 'G' },
    { category: 'Sus / Add / 6th / 5th', input: 'Cadd9', expected: 'C' },
    { category: 'Sus / Add / 6th / 5th', input: 'Cadd2', expected: 'C' },
    { category: 'Sus / Add / 6th / 5th', input: 'C6', expected: 'C' },
    { category: 'Sus / Add / 6th / 5th', input: 'C6/9', expected: 'C' },
    { category: 'Sus / Add / 6th / 5th', input: 'G5', expected: 'G' },

    // 4. Augmented Chords (reduced to Major since only Major, Minor, Diminished are valid)
    { category: 'Augmented -> Major', input: 'Caug', expected: 'C' },
    { category: 'Augmented -> Major', input: 'C+', expected: 'C' },
    { category: 'Augmented -> Major', input: 'Eaug7', expected: 'E' },
    { category: 'Augmented -> Major', input: 'G+7', expected: 'G' },

    // 5. Minor & Extended Minor Chords
    { category: 'Minor & Extended Minor', input: 'Am', expected: 'Am' },
    { category: 'Minor & Extended Minor', input: 'Amin', expected: 'Am' },
    { category: 'Minor & Extended Minor', input: 'Am7', expected: 'Am' },
    { category: 'Minor & Extended Minor', input: 'Amin7', expected: 'Am' },
    { category: 'Minor & Extended Minor', input: 'Dm9', expected: 'Dm' },
    { category: 'Minor & Extended Minor', input: 'Em11', expected: 'Em' },
    { category: 'Minor & Extended Minor', input: 'F#m13', expected: 'F#m' },
    { category: 'Minor & Extended Minor', input: 'Gm6', expected: 'Gm' },
    { category: 'Minor & Extended Minor', input: 'Bmadd9', expected: 'Bm' },
    { category: 'Minor & Extended Minor', input: 'Cm(maj7)', expected: 'Cm' },
    { category: 'Minor & Extended Minor', input: 'CmMaj7', expected: 'Cm' },

    // 6. Diminished & Half-Diminished Chords
    { category: 'Diminished & Half-Dim', input: 'Bdim', expected: 'Bdim' },
    { category: 'Diminished & Half-Dim', input: 'Bdim7', expected: 'Bdim' },
    { category: 'Diminished & Half-Dim', input: 'C°', expected: 'Cdim' },
    { category: 'Diminished & Half-Dim', input: 'C#°7', expected: 'C#dim' },
    { category: 'Diminished & Half-Dim', input: 'Bø', expected: 'Bdim' },
    { category: 'Diminished & Half-Dim', input: 'Bø7', expected: 'Bdim' },
    { category: 'Diminished & Half-Dim', input: 'Bm7b5', expected: 'Bdim' },
    { category: 'Diminished & Half-Dim', input: 'F#m7-5', expected: 'F#dim' },
    { category: 'Diminished & Half-Dim', input: 'Amin7b5', expected: 'Adim' },

    // 7. Slash / Inversion Chords
    { category: 'Slash Chords', input: 'C/G', expected: 'C' },
    { category: 'Slash Chords', input: 'D/F#', expected: 'D' },
    { category: 'Slash Chords', input: 'G7/B', expected: 'G' },
    { category: 'Slash Chords', input: 'Cmaj7/E', expected: 'C' },
    { category: 'Slash Chords', input: 'Am/G', expected: 'Am' },
    { category: 'Slash Chords', input: 'Am7/E', expected: 'Am' },
    { category: 'Slash Chords', input: 'Bdim7/F', expected: 'Bdim' },
  ];

  it('recognizes all chord tokens and reduces every chord strictly to Major, Minor, or Diminished', () => {
    const validOutcomeRegex = /^[A-G][#b]?(?:m|dim)?$/;

    for (const tc of CHORD_TEST_CASES) {
      expect(isChordToken(tc.input), `isChordToken("${tc.input}")`).toBe(true);
      const actual = simplifyChordVoicing(tc.input);
      expect(actual, `${tc.input} -> ${actual} (expected ${tc.expected})`).toBe(tc.expected);
      expect(
        validOutcomeRegex.test(actual),
        `Output "${actual}" for "${tc.input}" must be Major, Minor, or Diminished`
      ).toBe(true);
    }
  });
});

describe('Chord URL HTML Scraper', () => {
  it('extracts song title, artist on line 1, and raw chords from Ultimate Guitar js-store HTML', () => {
    const mockUGPayload = JSON.stringify({
      store: {
        page: {
          data: {
            tab: {
              song_name: 'Rotterdam (Or Anywhere)',
              artist_name: 'The Beautiful South',
            },
            tab_view: {
              wiki_tab: {
                content:
                  '[Verse 1]\r\n[tab]        [ch]C[/ch]            [ch]Fmaj7[/ch]\r\nAnd the women tug their hair[/tab]',
              },
            },
          },
        },
      },
    })
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const mockHtml = `<!DOCTYPE html><html><body><div class="js-store" data-content="${mockUGPayload}"></div></body></html>`;
    const scraped = parseChordSheetFromHtml(mockHtml, 'tabs.ultimate-guitar.com');

    expect(scraped.songTitle).toBe('Rotterdam (Or Anywhere)');
    expect(scraped.artistName).toBe('The Beautiful South');
    expect(scraped.rawText.split('\n')[0]).toBe(
      'Rotterdam (Or Anywhere) - The Beautiful South'
    );
    expect(scraped.rawText).toContain(
      '[Verse 1]\n        C            Fmaj7\nAnd the women tug their hair'
    );

    // Compacting the scraped rawText should keep the title & artist on line 1
    const compacted = compactChordSheet(scraped.rawText);
    expect(compacted.split('\n')[0]).toBe(
      'Rotterdam (Or Anywhere) - The Beautiful South'
    );
  });
});
