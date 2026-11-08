import { SongItem } from '../types';
import { SAMPLE_SONGS } from './sampleSongs';

const STORAGE_KEY = 'by_heart_songs_v1';

export function loadSongs(): SongItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_SONGS));
      return SAMPLE_SONGS;
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
