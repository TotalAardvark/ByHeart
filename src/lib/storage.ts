import { SongItem } from '../types';
import { SAMPLE_SONGS } from './sampleSongs';

const STORAGE_KEY = 'by_heart_songs_v2';
const LEGACY_STORAGE_KEY = 'by_heart_songs_v1';
const BUILTIN_SAMPLE_IDS = new Set([
  'song-rotterdam',
  'song-shallow',
  'song-knockin',
  'text-ozymandias',
  'text-sonnet-18',
]);

export function loadSongs(): SongItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Preserve any custom user-created songs from v1 when upgrading to v2 sample repertoire
      let migratedSongs: SongItem[] = SAMPLE_SONGS;
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        try {
          const legacyParsed = JSON.parse(legacyRaw);
          if (Array.isArray(legacyParsed)) {
            const customUserSongs = legacyParsed.filter(
              (s: SongItem) => s && s.id && !BUILTIN_SAMPLE_IDS.has(s.id)
            );
            if (customUserSongs.length > 0) {
              migratedSongs = [...customUserSongs, ...SAMPLE_SONGS];
            }
          }
        } catch {
          // Ignore malformed legacy storage
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedSongs));
      return migratedSongs;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return SAMPLE_SONGS;
    }
    return parsed;
  } catch {
    return SAMPLE_SONGS;
  }
}

export function saveSongs(songs: SongItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  } catch (err) {
    console.error('Failed to save songs to localStorage:', err);
  }
}

export function exportLibraryJson(songs: SongItem[]): void {
  const payload = {
    app: 'By Heart',
    version: 1,
    exportedAt: new Date().toISOString(),
    songs,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `by-heart-library-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
