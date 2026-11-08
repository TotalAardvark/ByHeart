/**
 * Utilities for scraping raw chord sheets (plus Song Title & Artist on line 1)
 * from Ultimate Guitar and other chord sheet websites.
 */

import {
  ParsedGpScore,
  convertGpTrackToAsciiTab,
  parseGuitarProBytes,
} from './gpImporter';

export interface ScrapedChordSheet {
  /** Formatted raw chord sheet with "Song Title - Artist" on line 1 */
  rawText: string;
  /** Extracted short song title (if detected) */
  songTitle?: string;
  /** Extracted artist name (if detected) */
  artistName?: string;
  /** Combined "Song Title - Artist" header line (if detected) */
  titleAndArtist?: string;
  /** Present if the URL resolved to a multi-track Guitar Pro / Songsterr score */
  gpScore?: ParsedGpScore;
}

/**
 * Decodes HTML entities commonly found in Ultimate Guitar's `data-content` attribute
 * and `<pre>` chord blocks.
 */
export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '—')
    .replace(/&hellip;/gi, '...')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&amp;/g, '&');
}

/**
 * Strips Ultimate Guitar's `[tab]`, `[/tab]`, `[ch]`, and `[/ch]` markup tags
 * into clean monospaced chord-over-lyric text.
 */
export function cleanUGMarkup(ugContent: string): string {
  return decodeHtmlEntities(ugContent)
    .replace(/\r\n/g, '\n')
    .replace(/\[\/?tab\]/gi, '')
    .replace(/\[\/?ch\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses HTML string from Ultimate Guitar or generic chord sites to extract
 * the song title, artist, and raw chord sheet.
 */
export function parseChordSheetFromHtml(
  html: string,
  sourceUrl = ''
): ScrapedChordSheet {
  // 1. Try Ultimate Guitar's `<div class="js-store" data-content="...">` JSON payload
  const jsStoreMatch =
    html.match(/class=["'][^"']*js-store[^"']*["'][^>]*data-content=["']([^"']+)["']/i) ||
    html.match(/data-content=["']([^"']+)["'][^>]*class=["'][^"']*js-store[^"']*["']/i);

  if (jsStoreMatch && jsStoreMatch[1]) {
    try {
      const decodedJson = decodeHtmlEntities(jsStoreMatch[1]);
      const parsed = JSON.parse(decodedJson);
      const pageData = parsed?.store?.page?.data;
      const rawWikiContent: string | undefined =
        pageData?.tab_view?.wiki_tab?.content;
      const songTitle: string | undefined = pageData?.tab?.song_name?.trim();
      const artistName: string | undefined = pageData?.tab?.artist_name?.trim();

      if (rawWikiContent && rawWikiContent.trim()) {
        const cleanedChords = cleanUGMarkup(rawWikiContent);
        const titleAndArtist =
          songTitle && artistName
            ? `${songTitle} - ${artistName}`
            : songTitle || artistName || undefined;

        const rawText = titleAndArtist
          ? `${titleAndArtist}\n\n${cleanedChords}`
          : cleanedChords;

        return {
          rawText,
          songTitle,
          artistName,
          titleAndArtist,
        };
      }
    } catch {
      // Fall through to secondary extraction methods if JSON parsing fails
    }
  }

  // 2. Try inline JSON regex fallback if `wiki_tab.content` appears inside a script tag
  const wikiContentMatch = html.match(
    /"wiki_tab"\s*:\s*\{\s*"content"\s*:\s*"((?:\\.|[^"\\])*)"/
  );
  if (wikiContentMatch && wikiContentMatch[1]) {
    try {
      const rawWikiContent = JSON.parse(`"${wikiContentMatch[1]}"`);
      const songNameMatch = html.match(/"song_name"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const artistNameMatch = html.match(
        /"artist_name"\s*:\s*"((?:\\.|[^"\\])*)"/
      );
      const songTitle = songNameMatch
        ? JSON.parse(`"${songNameMatch[1]}"`).trim()
        : undefined;
      const artistName = artistNameMatch
        ? JSON.parse(`"${artistNameMatch[1]}"`).trim()
        : undefined;

      const cleanedChords = cleanUGMarkup(rawWikiContent);
      const titleAndArtist =
        songTitle && artistName
          ? `${songTitle} - ${artistName}`
          : songTitle || artistName || undefined;

      return {
        rawText: titleAndArtist
          ? `${titleAndArtist}\n\n${cleanedChords}`
          : cleanedChords,
        songTitle,
        artistName,
        titleAndArtist,
      };
    } catch {
      // Fall through
    }
  }

  // 3. Generic HTML `<pre>` / chord container extraction (E-Chords, Chordie, Cifra Club, etc.)
  const titleMatch =
    html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
    ) ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  let titleAndArtist: string | undefined;
  let songTitle: string | undefined;

  if (titleMatch && titleMatch[1]) {
    const rawPageTitle = decodeHtmlEntities(titleMatch[1])
      .replace(/\s+/g, ' ')
      .replace(
        /\s*(?:chords?\s*(?:&|and)?\s*tabs?|chords?|tabs?|ukulele\s*chords?|guitar\s*chords?)\s*(?:[-|•–—].*)?$/i,
        ''
      )
      .replace(/\s*[-|•–—]\s*(?:Ultimate[- ]Guitar|E-Chords|Cifra\s*Club|Chordie|AZChords).*$/i, '')
      .trim();

    if (rawPageTitle) {
      // Normalize "SONG CHORDS by Artist" -> "Song - Artist"
      const byMatch = rawPageTitle.match(/^(.+?)\s+by\s+(.+)$/i);
      if (byMatch) {
        songTitle = byMatch[1].replace(/\s+chords?$/i, '').trim();
        const artist = byMatch[2].trim();
        titleAndArtist = `${songTitle} - ${artist}`;
      } else {
        titleAndArtist = rawPageTitle;
        songTitle = rawPageTitle.split(/\s*[-–—]\s*/)[0]?.trim();
      }
    }
  }

  // Extract all <pre> blocks and pick the richest chord/lyric block
  const preRegex = /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi;
  const candidates: string[] = [];
  let preMatch: RegExpExecArray | null;
  while ((preMatch = preRegex.exec(html)) !== null) {
    const inner = decodeHtmlEntities(
      preMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(?:span|a|b|strong|i|em|u|font|div|p)\b[^>]*>/gi, '')
        .replace(/<[^>]+>/g, '')
    )
      .replace(/\r\n/g, '\n')
      .trim();

    if (inner.length > 40) {
      candidates.push(inner);
    }
  }

  if (candidates.length > 0) {
    // Pick the longest <pre> block
    candidates.sort((a, b) => b.length - a.length);
    const bestBody = cleanUGMarkup(candidates[0]);
    const rawText = titleAndArtist
      ? `${titleAndArtist}\n\n${bestBody}`
      : bestBody;
    return {
      rawText,
      songTitle,
      titleAndArtist,
    };
  }

  throw new Error(
    `Could not detect a chord sheet at ${
      sourceUrl || 'this URL'
    }. The site may require a CAPTCHA or use unsupported formatting.`
  );
}

/**
 * Extracts Songsterr metadata and the CloudFront Guitar Pro source URL from a Songsterr HTML page.
 */
export function extractSongsterrInfoFromHtml(html: string): {
  sourceGpUrl: string;
  songTitle?: string;
  artistName?: string;
} | null {
  // 1. Check `<script id="state" type="application/json">`
  const stateMatch = html.match(
    /<script[^>]+id=["']state["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (stateMatch && stateMatch[1]) {
    try {
      const stateJson = JSON.parse(stateMatch[1].trim());
      const current = stateJson?.meta?.current;
      if (current && typeof current.source === 'string' && current.source) {
        return {
          sourceGpUrl: current.source,
          songTitle:
            typeof current.title === 'string' ? current.title.trim() : undefined,
          artistName:
            typeof current.artist === 'string'
              ? current.artist.trim()
              : undefined,
        };
      }
    } catch {
      // Fall through to regex search
    }
  }

  // 2. Fallback regex for `"source":"https://...cloudfront.net/...gp..."`
  const sourceRegexMatch = html.match(
    /"source"\s*:\s*"(https?:\/\/[^"]+\.(?:gp\d?|gpx)[^"]*)"/i
  );
  if (sourceRegexMatch && sourceRegexMatch[1]) {
    const sourceGpUrl = sourceRegexMatch[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
    const titleMatch = html.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/);
    const artistMatch = html.match(/"artist"\s*:\s*"((?:\\.|[^"\\])*)"/);
    return {
      sourceGpUrl,
      songTitle: titleMatch ? titleMatch[1].trim() : undefined,
      artistName: artistMatch ? artistMatch[1].trim() : undefined,
    };
  }

  return null;
}

async function fetchBinaryBytesWithFallback(targetUrl: string): Promise<Uint8Array> {
  const endpoints = [
    targetUrl,
    `/api/scrape-url?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 32) {
        return new Uint8Array(buf);
      }
    } catch {
      // try next endpoint
    }
  }
  throw new Error('Could not download the Guitar Pro tab binary stream.');
}

/**
 * Fetches a chord or tab URL via local dev middleware or public CORS proxies and parses
 * the raw chord sheet or Songsterr / Guitar Pro tab (including song title and artist on line 1).
 */
export async function fetchChordSheetFromUrl(
  rawUrl: string
): Promise<ScrapedChordSheet> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Please enter a valid URL.');
  }

  const normalizedUrl = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error(
      'Please enter a valid web URL (e.g. https://tabs.ultimate-guitar.com/... or https://www.songsterr.com/...).'
    );
  }

  // Direct link to a .gp / .gp3 / .gp4 / .gp5 / .gpx file
  if (/\.(?:gp[345x]?)$/i.test(parsedUrl.pathname)) {
    const bytes = await fetchBinaryBytesWithFallback(parsedUrl.toString());
    const gpScore = parseGuitarProBytes(bytes);
    const rawText = convertGpTrackToAsciiTab(gpScore, gpScore.defaultTrackIndex);
    return {
      rawText,
      songTitle: gpScore.title || undefined,
      artistName: gpScore.artist || undefined,
      titleAndArtist:
        gpScore.title && gpScore.artist
          ? `${gpScore.title} - ${gpScore.artist}`
          : gpScore.title || undefined,
      gpScore,
    };
  }

  const endpoints = [
    `/api/scrape-url?url=${encodeURIComponent(parsedUrl.toString())}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(parsedUrl.toString())}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(parsedUrl.toString())}`,
    `https://corsproxy.io/?${encodeURIComponent(parsedUrl.toString())}`,
  ];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();

      // Skip if Vite SPA fallback returned our own index.html for `/api/scrape-url`
      if (
        endpoint.startsWith('/api/scrape-url') &&
        text.includes('<title>By Heart') &&
        !text.includes('js-store')
      ) {
        continue;
      }

      let htmlPayload = text;
      if (
        contentType.includes('application/json') &&
        text.trim().startsWith('{')
      ) {
        try {
          const json = JSON.parse(text);
          if (typeof json.contents === 'string') {
            htmlPayload = json.contents;
          } else if (typeof json.html === 'string') {
            htmlPayload = json.html;
          }
        } catch {
          // Not a wrapper JSON, continue to HTML parser
        }
      }

      // Check if this is a Songsterr page with an embedded Guitar Pro source URL!
      const songsterrInfo = extractSongsterrInfoFromHtml(htmlPayload);
      if (songsterrInfo) {
        const bytes = await fetchBinaryBytesWithFallback(
          songsterrInfo.sourceGpUrl
        );
        const gpScore = parseGuitarProBytes(bytes);
        if (!gpScore.title && songsterrInfo.songTitle) {
          gpScore.title = songsterrInfo.songTitle;
        }
        if (!gpScore.artist && songsterrInfo.artistName) {
          gpScore.artist = songsterrInfo.artistName;
        }
        const rawText = convertGpTrackToAsciiTab(
          gpScore,
          gpScore.defaultTrackIndex
        );
        return {
          rawText,
          songTitle: gpScore.title || songsterrInfo.songTitle,
          artistName: gpScore.artist || songsterrInfo.artistName,
          titleAndArtist:
            gpScore.title && gpScore.artist
              ? `${gpScore.title} - ${gpScore.artist}`
              : gpScore.title || undefined,
          gpScore,
        };
      }

      if (htmlPayload && htmlPayload.length > 100) {
        return parseChordSheetFromHtml(htmlPayload, parsedUrl.hostname);
      }
    } catch (err) {
      if (err instanceof Error) {
        lastError = err;
      }
    }
  }

  throw (
    lastError ||
    new Error(
      'Unable to fetch chord sheet or tab from URL. The site may be blocking automated requests or behind a CAPTCHA.'
    )
  );
}
