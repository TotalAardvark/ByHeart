import { describe, expect, it } from 'vitest';
import {
  analyzeTabBlockIntoChunks,
  inferChordsForTabMeasure,
  splitTabSystemIntoMeasures,
  tokenizeTabLineForScaffold,
} from '../tabAnalyzer';
import {
  convertGpTrackToAsciiTab,
  parseGuitarProBytes,
} from '../gpImporter';
import { compactChordSheet } from '../compactor';
import { extractSongsterrInfoFromHtml } from '../urlScraper';
import { extractPlayableNotesFromTabLines } from '../tabAudioPlayer';

describe('ASCII Tab Pattern Analyzer & Chunker', () => {
  it('infers chords (Em7, D/F#, G) directly from unannotated arpeggiated tab fret numbers', () => {
    const shallowIntroBarsWithoutChords = [
      '---------------3----------------2----------------3-------------------------',
      '---------3---3---3--------3---3---3--------3---3---3-----------------------',
      '-------0---0------------2---2------------0---0-----------------------------',
      '-----2----------------0----------------0-----------------------------------',
      '---2-----------------------------------------------------------------------',
      '-0------------------2----------------3-------------------------------------',
    ];
    const labels = ['e', 'B', 'G', 'D', 'A', 'E'];

    const inferred = inferChordsForTabMeasure(
      shallowIntroBarsWithoutChords,
      labels
    );
    const chordNames = inferred.map((c) => c.chord);
    expect(chordNames).toEqual(['Em7', 'D/F#', 'G']);
  });

  it('slices a wide 4-bar ASCII tab system at bar lines into 2-bar { ... } locked chunks and deduplicates consecutive identical bars with |xN|', () => {
    const fourBarTabWithRepeat = [
      'e|---0---2---3---|---0---2---3---|---3---2---0---|---0---0---0---|',
      'B|---0---3---0---|---0---3---0---|---1---3---1---|---1---1---1---|',
      'G|---0---2---0---|---0---2---0---|---0---2---2---|---2---2---2---|',
      'D|---2---0---0---|---2---0---0---|---2---0---2---|---2---2---2---|',
      'A|---2-------2---|---2-------2---|---3-------0---|---0---0---0---|',
      'E|-0---------3---|-0---------3---|---------------|---------------|',
    ];

    const measures = splitTabSystemIntoMeasures(fourBarTabWithRepeat);
    expect(measures).toHaveLength(4);
    // Bar 0 and Bar 1 have identical fingerprints
    expect(measures[0].fingerprint).toBe(measures[1].fingerprint);

    const chunks = analyzeTabBlockIntoChunks(fourBarTabWithRepeat, {
      maxBarsPerChunk: 2,
    });
    // 4 bars with Bar 1 == Bar 2 deduplicate to 3 unique bars -> 2 chunks (2 bars in chunk 1, 1 bar in chunk 2)
    expect(chunks).toHaveLength(2);
    expect(chunks[0].rawBlockLines.join('\n')).toContain('|x2|');
  });

  it('auto-segments a headerless pure-tab sheet into named Riff sections and collapses recurring riffs', () => {
    const rawHeaderlessTab = `
e|---0---0---0---|
B|---1---1---1---|
G|---2---2---2---|
D|---2---2---2---|
A|-0-------------|
E|---------------|

e|---3---3---3---|
B|---0---0---0---|
G|---0---0---0---|
D|---0---0---0---|
A|---2---2---2---|
E|-3-------------|

e|---0---0---0---|
B|---1---1---1---|
G|---2---2---2---|
D|---2---2---2---|
A|-0-------------|
E|---------------|
`;

    const compacted = compactChordSheet(rawHeaderlessTab);
    expect(compacted).toContain('1. Riff A');
    expect(compacted).toContain('2. Riff B');
    // Section 3 is identical to Riff A, so it collapses into an empty repeat header "3. Riff A"
    expect(compacted).toMatch(/3\. Riff A\s*$/);
  });

  it('tokenizes tab lines into structural framing and maskable fret numbers for Scaffold Mode', () => {
    const tokens = tokenizeTabLineForScaffold('e|---3---12h14---|---0---|');
    const fretTokens = tokens.filter((t) => t.type === 'fret');
    expect(fretTokens.map((f) => f.text)).toEqual(['3', '12', '14', '0']);
    expect(fretTokens[0].measureIndex).toBe(0);
    expect(fretTokens[0].noteIndexInMeasure).toBe(0);
    expect(fretTokens[3].measureIndex).toBe(1);
    expect(fretTokens[3].noteIndexInMeasure).toBe(0);
  });

  it('extracts playable MIDI note schedules from ASCII tab lines for Web Audio preview', () => {
    const tabLines = [
      'e|---0---3---|',
      'B|---1---0---|',
      'G|---0---0---|',
      'D|---2---0---|',
      'A|---3---2---|',
      'E|-------3---|',
    ];
    const scheduled = extractPlayableNotesFromTabLines(tabLines);
    // 5 notes in C chord + 6 notes in G chord = 11 scheduled note events
    expect(scheduled).toHaveLength(11);
    expect(scheduled[0].midi).toBe(48); // C3 (A string 3rd fret = 45 + 3)
  });
});

describe('Guitar Pro Importer & Songsterr URL Extractor', () => {
  it('parses an alphaTex/Guitar Pro score buffer and converts the primary track into sectioned ASCII tab', () => {
    const alphaTexBuffer = Buffer.from(
      '\\title "Nothing Else Matters" \\artist "Metallica"\n' +
        '\\section "Intro"\n' +
        '0.6.4 0.3.4 0.2.4 0.1.4 | 0.6.4 0.3.4 0.2.4 0.1.4 |'
    );

    const parsedGp = parseGuitarProBytes(new Uint8Array(alphaTexBuffer));
    expect(parsedGp.title).toBe('Nothing Else Matters');
    expect(parsedGp.artist).toBe('Metallica');
    expect(parsedGp.tracks.length).toBeGreaterThanOrEqual(1);

    const ascii = convertGpTrackToAsciiTab(parsedGp, 0);
    expect(ascii).toContain('Nothing Else Matters - Metallica');
    expect(ascii).toContain('[Intro]');
    expect(ascii).toContain('e|');
    expect(ascii).toContain('E|');

    // Compacting the converted GP tab deduplicates the two identical open Em arpeggio bars into |x2|
    const compacted = compactChordSheet(ascii);
    expect(compacted).toContain('1. Intro');
    expect(compacted).toContain('|x2|');
  });

  it('extracts Songsterr CloudFront Guitar Pro source URL and metadata from Songsterr HTML', () => {
    const mockSongsterrHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <script id="state" type="application/json">
            {"meta":{"current":{"title":"Blackbird","artist":"The Beatles","source":"https://d12drcwhcokzqv.cloudfront.net/12345.gp5"}}}
          </script>
        </body>
      </html>
    `;
    const info = extractSongsterrInfoFromHtml(mockSongsterrHtml);
    expect(info).toEqual({
      sourceGpUrl: 'https://d12drcwhcokzqv.cloudfront.net/12345.gp5',
      songTitle: 'Blackbird',
      artistName: 'The Beatles',
    });
  });
});
