import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateUsername,
  normalizeUsernameToDocId,
  mergeSongs,
  loadActiveProfile,
  saveActiveProfile,
  ActiveProfile,
  ACTIVE_PROFILE_KEY,
} from '../cloudSync';
import { SongItem } from '../../types';

describe('Cloud Sync & Profiles Engine', () => {
  describe('Username Validation & Sanitization', () => {
    it('accepts standard usernames, spaces, numbers, and emojis', () => {
      expect(validateUsername('pablo')).toEqual({
        isValid: true,
        illegalCharsDetected: false,
      });

      expect(validateUsername('stage-guitarist_99')).toEqual({
        isValid: true,
        illegalCharsDetected: false,
      });

      expect(validateUsername('Acoustic Set 2026')).toEqual({
        isValid: true,
        illegalCharsDetected: false,
      });

      expect(validateUsername('🎸 Rocker')).toEqual({
        isValid: true,
        illegalCharsDetected: false,
      });
    });

    it('rejects forward slashes and backslashes and flags illegal characters', () => {
      const resSlash = validateUsername('my/profile');
      expect(resSlash.isValid).toBe(false);
      expect(resSlash.illegalCharsDetected).toBe(true);
      expect(resSlash.error).toContain('Forward slash');

      const resBackslash = validateUsername('my\\profile');
      expect(resBackslash.isValid).toBe(false);
      expect(resBackslash.illegalCharsDetected).toBe(true);
      expect(resBackslash.error).toContain('backslash');
    });

    it('rejects line breaks and tabs and flags illegal characters', () => {
      const resNewline = validateUsername('pablo\nstage');
      expect(resNewline.isValid).toBe(false);
      expect(resNewline.illegalCharsDetected).toBe(true);
      expect(resNewline.error).toContain('Line breaks and tabs');

      const resTab = validateUsername('pablo\tstage');
      expect(resTab.isValid).toBe(false);
      expect(resTab.illegalCharsDetected).toBe(true);
    });

    it('rejects standalone period and double period (including with whitespace) and flags illegal characters', () => {
      const resDot = validateUsername('.');
      expect(resDot.isValid).toBe(false);
      expect(resDot.illegalCharsDetected).toBe(true);

      const resDotDot = validateUsername('..');
      expect(resDotDot.isValid).toBe(false);
      expect(resDotDot.illegalCharsDetected).toBe(true);

      const resSpacedDot = validateUsername('  .  ');
      expect(resSpacedDot.isValid).toBe(false);
      expect(resSpacedDot.illegalCharsDetected).toBe(true);

      const resSpacedDotDot = validateUsername('  ..  ');
      expect(resSpacedDotDot.isValid).toBe(false);
      expect(resSpacedDotDot.illegalCharsDetected).toBe(true);
    });

    it('rejects double underscore reserved pattern (__...__) and flags illegal characters', () => {
      const res = validateUsername('__internal__');
      expect(res.isValid).toBe(false);
      expect(res.illegalCharsDetected).toBe(true);
      expect(res.error).toContain('double underscores');
    });

    it('rejects reserved oauth_ prefix and flags illegal characters', () => {
      const res = validateUsername('oauth_guitarist');
      expect(res.isValid).toBe(false);
      expect(res.illegalCharsDetected).toBe(true);
      expect(res.error).toContain('oauth_');
    });

    it('rejects empty input without flagging illegal characters (so UI does not pop up false warning)', () => {
      const resEmpty = validateUsername('');
      expect(resEmpty.isValid).toBe(false);
      expect(resEmpty.illegalCharsDetected).toBe(false);

      const resSpaces = validateUsername('   ');
      expect(resSpaces.isValid).toBe(false);
      expect(resSpaces.illegalCharsDetected).toBe(false);
    });

    it('rejects usernames exceeding 100 characters', () => {
      const longName = 'a'.repeat(101);
      const res = validateUsername(longName);
      expect(res.isValid).toBe(false);
      expect(res.illegalCharsDetected).toBe(true);
    });

    it('normalizes username to lowercase trimmed Firestore doc ID', () => {
      expect(normalizeUsernameToDocId('  Pablo_Stage  ')).toBe('pablo_stage');
      expect(normalizeUsernameToDocId('Guitarist123')).toBe('guitarist123');
    });
  });

  describe('Intelligent Song Merging (Replace vs. Merge)', () => {
    const makeSong = (id: string, shortName: string, updatedAt: number): SongItem => ({
      id,
      shortName,
      body: 'test body',
      lastMode: 'chain',
      chunkSize: 4,
      customHighlights: [],
      scaffoldEveryNLines: 2,
      updatedAt,
    });

    it('preserves unique songs from both local and cloud', () => {
      const localSongs = [makeSong('song-1', 'Local Only', 100)];
      const cloudSongs = [makeSong('song-2', 'Cloud Only', 200)];

      const merged = mergeSongs(localSongs, cloudSongs);
      expect(merged).toHaveLength(2);
      expect(merged.some((s) => s.id === 'song-1')).toBe(true);
      expect(merged.some((s) => s.id === 'song-2')).toBe(true);
    });

    it('chooses the newer version when a song exists in both local and cloud', () => {
      const localSongNewer = makeSong('song-1', 'Local Newer Edit', 500);
      const cloudSongOlder = makeSong('song-1', 'Cloud Older Edit', 200);

      const merged1 = mergeSongs([localSongNewer], [cloudSongOlder]);
      expect(merged1).toHaveLength(1);
      expect(merged1[0].shortName).toBe('Local Newer Edit');
      expect(merged1[0].updatedAt).toBe(500);

      const localSongOlder = makeSong('song-2', 'Local Older Edit', 100);
      const cloudSongNewer = makeSong('song-2', 'Cloud Newer Edit', 900);

      const merged2 = mergeSongs([localSongOlder], [cloudSongNewer]);
      expect(merged2).toHaveLength(1);
      expect(merged2[0].shortName).toBe('Cloud Newer Edit');
      expect(merged2[0].updatedAt).toBe(900);
    });
  });

  describe('Active Profile Local Storage', () => {
    class LocalStorageMock {
      private store: Record<string, string> = {};
      getItem(key: string) {
        return this.store[key] || null;
      }
      setItem(key: string, value: string) {
        this.store[key] = String(value);
      }
      removeItem(key: string) {
        delete this.store[key];
      }
      clear() {
        this.store = {};
      }
    }

    beforeEach(() => {
      globalThis.localStorage = new LocalStorageMock() as unknown as Storage;
    });

    it('saves and loads active profile correctly', () => {
      expect(loadActiveProfile()).toBeNull();

      const profile: ActiveProfile = {
        id: 'pablo-stage',
        displayName: 'Pablo Stage',
        authProvider: 'username',
        lastSyncedAt: 123456789,
      };

      saveActiveProfile(profile);
      expect(loadActiveProfile()).toEqual(profile);

      saveActiveProfile(null);
      expect(loadActiveProfile()).toBeNull();
    });
  });
});
