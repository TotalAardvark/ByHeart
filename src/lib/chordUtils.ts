/**
 * Utilities for recognizing musical chords, chord lines, bracketed progressions,
 * and section headers in both By Heart notation and raw Ultimate Guitar sheets.
 */

const CHORD_TOKEN_REGEX =
  /^[A-G][#b♯♭]?(?:m|[mM]aj|[mM]in|[dD]im|[aA]ug|[sS]us|[aA]dd|M|°|ø|\+)?\d*(?:\/9)?(?:\(?(?:[sS]us|[aA]dd|[mM]aj|[mM]in|[dD]im|[aA]ug|M|#|\+|b|-)\d*\)?)*(?:\/[A-G][#b♯♭]?)?$/;

const IGNORED_PROGRESSION_TOKENS = new Set([
  '|',
  '||',
  '-',
  '–',
  '—',
  '/',
  '%',
  '•',
  ',',
  'nc',
  'n.c.',
]);

const REPEAT_TOKEN_REGEX = /^\(?x\d+\)?$/i;

const SECTION_KEYWORD_REGEX =
  /^(?:intro|verse|pre[-\s]?chorus|chorus|post[-\s]?chorus|bridge|outro|solo|guitar\s+solo|instrumental|interlude|refrain|hook|coda|tag|link|break|part|stanza|v\d+|c\d+)\b/i;

/**
 * Checks whether a single token (trimmed of surrounding parens/brackets/pipes) is a valid chord.
 */
export function isChordToken(rawToken: string): boolean {
  const token = rawToken.trim().replace(/^[([|]+|[)\]|,]+$/g, '');
  if (!token) return false;
  return CHORD_TOKEN_REGEX.test(token);
}

/**
 * Extracts ordered chord names from a chord line or bracketed progression string,
 * ignoring bar lines, dashes, and repeat markers like x2.
 */
export function extractChordsFromLine(line: string): string[] {
  const inner = line.trim().replace(/^\[|\]$/g, '');
  const rawTokens = inner
    .replace(/\|/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const chords: string[] = [];
  for (const tok of rawTokens) {
    const lower = tok.toLowerCase();
    if (IGNORED_PROGRESSION_TOKENS.has(lower)) continue;
    if (REPEAT_TOKEN_REGEX.test(tok)) continue;
    const cleaned = tok.replace(/^[([|]+|[)\]|,]+$/g, '');
    if (isChordToken(cleaned)) {
      chords.push(cleaned);
    }
  }
  return chords;
}

/**
 * Extracts chords along with their 0-based character column positions in a monospaced chord line.
 */
export interface PositionedChord {
  chord: string;
  column: number;
}

export function extractPositionedChords(line: string): PositionedChord[] {
  const result: PositionedChord[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    const tok = match[0];
    const lower = tok.toLowerCase();
    if (IGNORED_PROGRESSION_TOKENS.has(lower) || REPEAT_TOKEN_REGEX.test(tok)) {
      continue;
    }
    const cleaned = tok.replace(/^[([|]+|[)\]|,]+$/g, '');
    if (isChordToken(cleaned)) {
      result.push({
        chord: cleaned,
        column: match.index,
      });
    }
  }
  return result;
}

/**
 * Rebuilds a monospaced chord-above-lyric line from positioned chords.
 */
export function buildPositionedChordLine(chords: PositionedChord[]): string {
  if (chords.length === 0) return '';
  const sorted = [...chords].sort((a, b) => a.column - b.column);
  let line = '';
  for (const item of sorted) {
    const targetCol = Math.max(line.length, item.column);
    const padding = ' '.repeat(targetCol - line.length);
    line += padding + item.chord + ' ';
  }
  return line.trimEnd();
}

/**
 * Determines if an unbracketed line is a chord-over-lyric line (e.g. "   C        Fmaj7").
 */
export function isChordOverLyricLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return false;
  if (/^\d+\.\s+/.test(trimmed)) return false;

  const rawTokens = trimmed
    .replace(/\|/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (rawTokens.length === 0) return false;

  let chordCount = 0;
  for (const tok of rawTokens) {
    const lower = tok.toLowerCase();
    if (IGNORED_PROGRESSION_TOKENS.has(lower) || REPEAT_TOKEN_REGEX.test(tok)) {
      continue;
    }
    const cleaned = tok.replace(/^[([|]+|[)\]|,]+$/g, '');
    if (!isChordToken(cleaned)) {
      return false;
    }
    chordCount++;
  }

  if (chordCount === 0) return false;

  // Guard against a lyric line consisting of a single English word "A" or "Am" with punctuation
  if (chordCount === 1 && /^[A-Za-z]+[.!?,;:]$/.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Determines if a bracketed line "[ ... ]" is a By Heart chord progression (e.g. "[ C - F ]")
 * rather than a raw Ultimate Guitar section header (e.g. "[Verse 1]" or "[Intro and Verse 1]").
 */
export function isBracketedChordProgression(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return false;

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return false;

  // If it explicitly matches a section header keyword like "Verse 1", "Pre-Chorus", "Intro and Verse 1"
  if (SECTION_KEYWORD_REGEX.test(inner)) {
    return false;
  }

  const rawTokens = inner
    .replace(/\|/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (rawTokens.length === 0) return false;

  let chordCount = 0;
  for (const tok of rawTokens) {
    const lower = tok.toLowerCase();
    if (IGNORED_PROGRESSION_TOKENS.has(lower) || REPEAT_TOKEN_REGEX.test(tok)) {
      continue;
    }
    const cleaned = tok.replace(/^[([|]+|[)\]|,]+$/g, '');
    if (!isChordToken(cleaned)) {
      return false;
    }
    chordCount++;
  }

  return chordCount > 0;
}

/**
 * Determines if a line is a raw Ultimate Guitar bracketed section header like "[Verse 1]" or "[Pre-Chorus]".
 */
export function isUGBracketedSectionHeader(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  if (isBracketedChordProgression(trimmed)) return null;
  const inner = trimmed.slice(1, -1).trim();
  return inner || null;
}

/**
 * Determines if a line is a By Heart numbered section header like "1. Verse 1" or "5. Chorus".
 */
export function parseNumberedSectionHeader(
  line: string
): { numberLabel: string; name: string } | null {
  const match = line.match(/^\s*(\d+\.)\s*(.+?)\s*$/);
  if (!match) return null;
  return {
    numberLabel: match[1],
    name: match[2],
  };
}

/**
 * Simplifies any chord voicing so the outcome is strictly one of:
 * - Major triad: `${root}` (e.g. Cmaj7 -> C, E7 -> E, Dsus4 -> D, Caug -> C, G/B -> G)
 * - Minor triad: `${root}m` (e.g. Am7 -> Am, F#min9 -> F#m, Cm(maj7) -> Cm, Dm/F -> Dm)
 * - Diminished triad: `${root}dim` (e.g. Bdim7 -> Bdim, C°7 -> Cdim, Bø7 -> Bdim, Bm7b5 -> Bdim)
 */
export function simplifyChordVoicing(chord: string): string {
  const trimmed = chord.trim().replace(/^[([|]+|[)\]|,]+$/g, '');
  const match = trimmed.match(/^([A-G][#b♯♭]?)(.*)$/);
  if (!match) return chord;

  const root = match[1].replace('♯', '#').replace('♭', 'b');
  // Strip slash bass note (e.g. "/G", "/F#") before inspecting chord quality
  const rest = match[2].replace(/\/[A-G][#b♯♭]?$/, '');

  if (!rest) {
    return root;
  }

  // 1. Diminished & Half-Diminished (dim, dim7, °, °7, ø, ø7, m7b5, m7-5, min7b5) -> `${root}dim`
  if (
    /^(?:dim|°|ø)/i.test(rest) ||
    /^(?:min|m)7?(?:b5|-5|\(b5\)| in5)/i.test(rest)
  ) {
    return `${root}dim`;
  }

  // 2. Minor (m, min, m7, m9, m11, m13, m6, madd9, m(maj7), mMaj7, etc., excluding "maj" and uppercase "M7" major shorthand) -> `${root}m`
  if (/^(?:[Mm]in|m(?![aA][jJ]))/.test(rest)) {
    return `${root}m`;
  }

  // 3. Everything else (Major, Dominant 7/9/11/13, maj7/maj9/M7, sus2/sus4/7sus4, add9/6/6/9, aug/+, power 5) -> `${root}`
  return root;
}

/**
 * Normalizes a section name so that "Chorus 1", "Chorus 2", and "Chorus" all normalize to "chorus"
 * when checking for repeated sections.
 */
export function normalizeSectionBaseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\d+\b/g, '')
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

/**
 * Determines if a line is an ASCII guitar/bass/ukulele tablature string line
 * (e.g. `e|(3)--(2)--|`, `E|---0---2---|`, `G|-0-0-0-|`, `|---3---5---|`)
 * or a chord-diagram fret legend line (e.g. `Em7   022033` or `D/F#  2x0232`).
 */
export function isAsciiTabLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // 1. Standard string-prefixed tab line: e|---, B|---, G|---, D|---, A|---, E|---, Eb|---, C#|---, 1|---
  if (
    /^[eEBGDAaCcFf1-6][#b♯♭]?\s*\|[-0-9hHpPbBrRsS/\\~xX()*|\s.[\]<>]{3,}$/.test(
      trimmed
    )
  ) {
    return /[-|]{2,}/.test(trimmed);
  }

  // 2. Unprefixed ASCII tab bar: |---3---5---| or |--0--2--|
  if (/^\|[-0-9hHpPbBrRsS/\\~xX()*|\s.[\]<>]{4,}\|$/.test(trimmed)) {
    const dashCount = (trimmed.match(/-/g) || []).length;
    if (dashCount >= 3) return true;
  }

  // 3. Inline chord voicing diagram definition line: e.g. "Em7: 022030" or "D/F#  200232" or "Cadd9 x32033"
  if (
    /^[A-G][#b♯♭]?[^\s:]*[\s:=]+[xX0-9]{5,6}(?:\s+[A-G][#b♯♭]?[^\s:]*[\s:=]+[xX0-9]{5,6})*$/.test(
      trimmed
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Determines if a line is a rhythm / beat-count subdivision line or tuplet marker
 * commonly placed beneath or above ASCII TAB bars (e.g. `1 + 2 + 3 + 4 + etc.`,
 * `1 e + a 2 e + a 3 e + a 4 e + a`, `1 & 2 & 3 & 4 &`, `\ 3 /`).
 */
export function isRhythmCountOrTupletLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // 1. Tuplet bracket line: e.g. "\ 3 /", "/ 3 \", "|--3--|"
  if (/^(?:[\\/]\s*\d+\s*[\\/]\s*)+$/.test(trimmed)) {
    return true;
  }

  // 2. Beat subdivision count line: e.g. "1 + 2 + 3 + 4 + etc." or "1 e + a 2 e + a 3 e + a 4 e + a"
  const withoutEtc = trimmed.replace(/\betc\.?$/i, '').trim();
  if (!withoutEtc) return false;

  const tokens = withoutEtc.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return false;

  const hasSubdivisionMarker = tokens.some(
    (t) => t === '+' || t === '&' || t.toLowerCase() === 'e' || t.toLowerCase() === 'a'
  );
  const hasBeatNumber = tokens.some((t) => /^[1-8]$/.test(t));

  if (!hasSubdivisionMarker || !hasBeatNumber) return false;

  return tokens.every((t) =>
    /^(?:[1-8]|\+|&|e|a|d|\||[\\/]|[()[\]]|-)+$/i.test(t)
  );
}

/**
 * Extracts a normalized capo label (e.g. "capo 2") from raw chord sheet text if present.
 * Returns null if no capo or "no capo" is specified.
 */
export function extractCapoLabel(rawText: string): string | null {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n').slice(0, 35);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/\bno\s+capo\b/i.test(trimmed)) return null;

    // Match e.g. "Capo 2", "Capo: 2", "Capo on 2nd fret", "Capo 4th fret", "Capo: II"
    const numericMatch = trimmed.match(
      /\bcapo\s*(?:on\s*|:\s*|=\s*)?(?:the\s*)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*fret)?\b/i
    );
    if (numericMatch) {
      const fret = Number(numericMatch[1]);
      if (fret >= 1 && fret <= 15) {
        return `capo ${fret}`;
      }
    }

    const romanMatch = trimmed.match(
      /\bcapo\s*(?:on\s*|:\s*|=\s*)?(I{1,3}|IV|V|VI{1,3}|IX|X)\b/i
    );
    if (romanMatch) {
      const romanMap: Record<string, number> = {
        I: 1,
        II: 2,
        III: 3,
        IV: 4,
        V: 5,
        VI: 6,
        VII: 7,
        VIII: 8,
        IX: 9,
        X: 10,
      };
      const fret = romanMap[romanMatch[1].toUpperCase()];
      if (fret) return `capo ${fret}`;
    }
  }
  return null;
}

/**
 * Appends ` (capo N)` to a shorthand song name if not already present.
 */
export function appendCapoToShortName(
  shortName: string,
  capoLabel: string | null | undefined
): string {
  const cleanName = shortName.trim();
  if (!cleanName || !capoLabel) return cleanName;
  if (/\(\s*capo\s+\d+\s*\)/i.test(cleanName)) {
    return cleanName.replace(/\(\s*capo\s+\d+\s*\)/i, `(${capoLabel})`);
  }
  return `${cleanName} (${capoLabel})`;
}

/**
 * Determines if a line is top-of-sheet metadata/commentary (tuning, capo, key, tempo,
 * strumming pattern, chord glossary header, or quoted song title) that often precedes
 * the actual song sections on Ultimate Guitar.
 */
export function isPreambleMetadataLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (
    /^(?:standard\s+tuning|tuning\s*:?|capo\s*(?:on|:|\d)|no\s+capo|key\s*:|tempo\s*:|bpm\s*:|time\s+signature\s*:|strumming(?:\s+pattern)?\s*:|chords?\s+used\s*:?|tabbed\s+by|transcribed\s+by|arranged\s+by|artist\s*:|song\s*:|album\s*:|difficulty\s*:|author\s*:|half[-\s]step\s+down|drop\s+[dD]\b|dadgad\b)/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // Quoted title line in preamble, e.g. `"Shallow"`
  if (/^["'“”‘’][^"'“”‘’]{1,70}["'“”‘’]$/.test(trimmed)) {
    return true;
  }

  return false;
}

