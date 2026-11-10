import { describe, it, expect } from 'vitest';
import { generateSongPdfBlob } from '../pdfGenerator';
import { SongItem } from '../../types';

const mockSong: SongItem = {
  id: 'test-song-1',
  shortName: 'Shallow (capo 2)',
  body: `Shallow - Lady Gaga & Bradley Cooper

1. Intro
e|---------3--------2--------3---|
B|-----3-3-3------3-3-3----3-3-3-|
G|---0-0--------2-2------0-0-----|
D|--2----------0--------0--------|
A|-2-----------------------------|
E|0-----------2--------3---------|

2. Verse 1
[ Em7 - D/F# - G ]
Tell me something, girl
Are you happy in this modern world?
Or do you need more?
Is there something else you're searchin' for?

3. Refrain
[ Em7 - D/F# - G | C - G - D ]
I'm fallin'
In all the good times I find myself longin' for change
And in the bad times I fear myself

4. Verse 2
[ Em7 - D/F# - G | C - G - D ]
Tell me something, boy
Aren't you tired tryin' to fill that void?
Or do you need more?
Ain't it hard keepin' it so hardcore?

5. Refrain
(Same as 3. Refrain)

6. Chorus
[ Am - D/F# | G - D - Em ]
I'm off the deep end, watch as I dive in
I'll never meet the ground
Crash through the surface, where they can't hurt us
We're far from the shallow now

7. Post-Chorus
[ Am - D/F# | G - D - Em ]
In the sha-ha, shallow
In the sha-ha-sha-la-la-la-low

8. Bridge
[ Bm - D | A - Em ]
Oh, ha-ah-ah, ah
Oh-ah, ha-ah-ah-ah

9. Chorus
(Same as 6. Chorus)

10. Post-Chorus
(Same as 7. Post-Chorus)
`,
  chunkSize: 4,
  lastMode: 'chain',
  customHighlights: [],
  scaffoldEveryNLines: 4,
  updatedAt: Date.now(),
};

describe('generateSongPdfBlob', () => {
  it('generates a valid PDF blob for 1-column portrait view with multiple pages', async () => {
    const blob = generateSongPdfBlob({
      song: mockSong,
      columns: 1,
      fontScale: 100,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(500);

    const text = await blob.text();
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('%%EOF');
    expect(text).toContain('/MediaBox [ 0 0 595.28 841.89 ]'); // A4 portrait
    expect(text).toContain('Shallow \\(capo 2\\)');
    expect(text).toContain('By Heart Lead Sheet');
    expect(text).toContain('1. Intro');
    expect(text).toContain('10. Post-Chorus');
  });

  it('generates a valid PDF blob for 2-column landscape view fitting on a single page', async () => {
    const blob = generateSongPdfBlob({
      song: mockSong,
      columns: 2,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');

    const text = await blob.text();
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('%%EOF');
    expect(text).toContain('/MediaBox [ 0 0 841.89 595.28 ]'); // A4 landscape
    expect(text).toContain('/Count 1'); // Exactly 1 landscape page
    expect(text).toContain('Shallow \\(capo 2\\)');
    expect(text).toContain('2 Columns \\(Single-Page A4 Landscape Spread\\)');
  });

  it('generates a valid PDF blob for 3-column landscape view', async () => {
    const blob = generateSongPdfBlob({
      song: mockSong,
      columns: 3,
    });

    const text = await blob.text();
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/MediaBox [ 0 0 841.89 595.28 ]');
    expect(text).toContain('/Count 1');
    expect(text).toContain('3 Columns \\(Single-Page A4 Landscape Spread\\)');
  });

  it('supports 150% font scale and truncates long lines at column bounds in multi-column mode', async () => {
    const longLineSong: SongItem = {
      ...mockSong,
      body: `Long Song\n\n1. Verse\nThis is an exceptionally long line that would normally overflow across into adjacent columns if not truncated at column boundaries`,
    };

    const blob = generateSongPdfBlob({
      song: longLineSong,
      columns: 3,
      fontScale: 150,
    });

    const text = await blob.text();
    expect(text).toContain('/MediaBox [ 0 0 841.89 595.28 ]');
    // At fontScale 150, fontSize is 9 * 1.5 = 13.5. Char width is 13.5 * 0.6 = 8.1pt.
    // Usable col width is ~240pt, so maxChars is ~29 chars.
    // The full 131-character string should be truncated to prevent overlapping adjacent columns:
    expect(text).not.toContain('truncated at column boundaries');
    expect(text).toContain('This is an exceptionally');
  });
});
