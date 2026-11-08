import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
} from 'firebase/auth';
import { db, auth } from './firebase';
import { SongItem } from '../types';
import { ThemeId } from './themes';

export const ACTIVE_PROFILE_KEY = 'by_heart_active_profile_v1';
export const PROFILES_COLLECTION = 'byheart_profiles';

export interface CloudProfileData {
  username: string;
  songs: SongItem[];
  themeId: ThemeId;
  updatedAt: number;
  authProvider: 'username' | 'google' | 'apple';
  userId?: string;
}

export interface ActiveProfile {
  id: string; // Document ID in 'profiles' collection
  displayName: string;
  authProvider: 'username' | 'google' | 'apple';
  lastSyncedAt?: number;
}

export interface UsernameValidation {
  isValid: boolean;
  illegalCharsDetected: boolean;
  error?: string;
}

/**
 * Validates a profile username according to Firestore Document ID rules.
 * Flags illegal characters specifically so UI can show warning text only when illegal characters are typed.
 */
export function validateUsername(input: string): UsernameValidation {
  const hasSlash = input.includes('/') || input.includes('\\');
  const hasControlChars = /[\n\r\t]/.test(input);
  const trimmed = input.trim();
  const isDotOrDotDot = trimmed === '.' || trimmed === '..';
  const hasReservedDunder = /^__.*__$/.test(trimmed);
  const isReservedOAuth = trimmed.toLowerCase().startsWith('oauth_');

  if (hasSlash) {
    return {
      isValid: false,
      illegalCharsDetected: true,
      error: 'Forward slash (/) and backslash (\\) are not allowed in profile names.',
    };
  }
  if (hasControlChars) {
    return {
      isValid: false,
      illegalCharsDetected: true,
      error: 'Line breaks and tabs are not allowed in profile names.',
    };
  }
  if (isDotOrDotDot) {
    return {
      isValid: false,
      illegalCharsDetected: true,
      error: 'Profile name cannot be "." or "..".',
    };
  }
  if (hasReservedDunder) {
    return {
      isValid: false,
      illegalCharsDetected: true,
      error: 'Names starting and ending with double underscores (__...__) are reserved by Firebase.',
    };
  }
  if (isReservedOAuth) {
    return {
      isValid: false,
      illegalCharsDetected: true,
      error: 'Profile names starting with "oauth_" are reserved for Google and Apple accounts.',
    };
  }

  if (!trimmed) {
    return {
      isValid: false,
      illegalCharsDetected: false,
      error: 'Profile name cannot be empty.',
    };
  }
  if (trimmed.length > 100) {
    return {
      isValid: false,
      illegalCharsDetected: true,
      error: 'Profile name must be 100 characters or fewer.',
    };
  }

  return {
    isValid: true,
    illegalCharsDetected: false,
  };
}

export function normalizeUsernameToDocId(username: string): string {
  return username.trim().toLowerCase();
}

export function loadActiveProfile(): ActiveProfile | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveActiveProfile(profile: ActiveProfile | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!profile) {
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
    } else {
      localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
    }
  } catch (err) {
    console.error('Failed to save active profile to localStorage:', err);
  }
}

/**
 * Check if a Firestore profile document exists
 */
export async function fetchProfileDoc(docId: string): Promise<{ exists: boolean; data?: CloudProfileData }> {
  const docRef = doc(db, PROFILES_COLLECTION, docId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { exists: true, data: snap.data() as CloudProfileData };
  }
  return { exists: false };
}

/**
 * Creates a brand-new username profile in Firestore.
 * Blocks if the username already exists.
 */
export async function createUsernameProfile(
  username: string,
  songs: SongItem[],
  themeId: ThemeId
): Promise<ActiveProfile> {
  const validation = validateUsername(username);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid profile name.');
  }

  const docId = normalizeUsernameToDocId(username);
  const existing = await fetchProfileDoc(docId);
  if (existing.exists) {
    throw new Error(
      `The profile name "${username.trim()}" is already taken. Please choose another name, or choose "Load Existing Profile" if it's yours.`
    );
  }

  const now = Date.now();
  // Strip any undefined fields (e.g. rawSource: undefined) so Firestore setDoc does not throw
  const sanitizedSongs = JSON.parse(JSON.stringify(songs));
  const profileData: CloudProfileData = {
    username: username.trim(),
    songs: sanitizedSongs,
    themeId,
    updatedAt: now,
    authProvider: 'username',
  };
  if (auth.currentUser) {
    profileData.userId = auth.currentUser.uid;
  }

  await setDoc(doc(db, PROFILES_COLLECTION, docId), profileData);

  const active: ActiveProfile = {
    id: docId,
    displayName: username.trim(),
    authProvider: 'username',
    lastSyncedAt: now,
  };
  saveActiveProfile(active);
  return active;
}

/**
 * Loads an existing username profile doc.
 */
export async function loadUsernameProfileDoc(
  username: string
): Promise<{ profile: ActiveProfile; data: CloudProfileData }> {
  const validation = validateUsername(username);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid profile name.');
  }

  const docId = normalizeUsernameToDocId(username);
  const existing = await fetchProfileDoc(docId);
  if (!existing.exists || !existing.data) {
    throw new Error(
      `Profile "${username.trim()}" was not found. Please check your spelling or create a new profile.`
    );
  }

  const active: ActiveProfile = {
    id: docId,
    displayName: existing.data.username || username.trim(),
    authProvider: 'username',
    lastSyncedAt: existing.data.updatedAt || Date.now(),
  };

  return { profile: active, data: existing.data };
}

/**
 * Google Sign-In via popup
 */
export async function signInWithGoogleAuth(): Promise<{
  profile: ActiveProfile;
  existingData?: CloudProfileData;
  isNew: boolean;
}> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  const user = credential.user;
  const docId = `oauth_${user.uid}`;
  const displayName = user.displayName || user.email || 'Google User';

  const existing = await fetchProfileDoc(docId);

  const active: ActiveProfile = {
    id: docId,
    displayName,
    authProvider: 'google',
    lastSyncedAt: existing.data?.updatedAt || Date.now(),
  };

  return {
    profile: active,
    existingData: existing.data,
    isNew: !existing.exists,
  };
}

/**
 * Apple Sign-In via popup
 */
export async function signInWithAppleAuth(): Promise<{
  profile: ActiveProfile;
  existingData?: CloudProfileData;
  isNew: boolean;
}> {
  const provider = new OAuthProvider('apple.com');
  const credential = await signInWithPopup(auth, provider);
  const user = credential.user;
  const docId = `oauth_${user.uid}`;
  const displayName = user.displayName || user.email || 'Apple User';

  const existing = await fetchProfileDoc(docId);

  const active: ActiveProfile = {
    id: docId,
    displayName,
    authProvider: 'apple',
    lastSyncedAt: existing.data?.updatedAt || Date.now(),
  };

  return {
    profile: active,
    existingData: existing.data,
    isNew: !existing.exists,
  };
}

/**
 * Disconnects the active profile and signs out of Firebase Auth if signed in.
 */
export async function disconnectProfile(): Promise<void> {
  saveActiveProfile(null);
  try {
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch (err) {
    console.warn('Error signing out of Firebase Auth:', err);
  }
}

/**
 * Intelligently merges local and cloud songs by ID and updatedAt timestamp.
 * - Songs existing in both: newer updatedAt wins.
 * - Songs existing only in local or only in cloud: preserved.
 */
export function mergeSongs(localSongs: SongItem[], cloudSongs: SongItem[]): SongItem[] {
  const map = new Map<string, SongItem>();

  // Add all cloud songs first
  for (const song of cloudSongs) {
    map.set(song.id, song);
  }

  // Merge or add local songs
  for (const localSong of localSongs) {
    const existing = map.get(localSong.id);
    if (!existing) {
      map.set(localSong.id, localSong);
    } else {
      // Pick the more recently updated song
      if ((localSong.updatedAt || 0) >= (existing.updatedAt || 0)) {
        map.set(localSong.id, localSong);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Pushes songs and theme updates to the Firestore profile document.
 */
export async function syncProfileToCloud(
  profileId: string,
  displayName: string,
  songs: SongItem[],
  themeId: ThemeId,
  authProvider: 'username' | 'google' | 'apple'
): Promise<number> {
  const now = Date.now();
  // Strip any undefined fields (e.g. rawSource: undefined) so Firestore setDoc does not throw
  const sanitizedSongs = JSON.parse(JSON.stringify(songs));
  const profileData: CloudProfileData = {
    username: displayName,
    songs: sanitizedSongs,
    themeId,
    updatedAt: now,
    authProvider,
  };
  if (auth.currentUser) {
    profileData.userId = auth.currentUser.uid;
  }
  await setDoc(doc(db, PROFILES_COLLECTION, profileId), profileData, { merge: true });
  return now;
}

/**
 * Subscribes to real-time updates for an active profile.
 * Ignores pending local writes to prevent echo loops.
 */
export function subscribeToCloudProfile(
  profileId: string,
  onRemoteChange: (data: CloudProfileData) => void,
  onError?: (err: Error) => void
): () => void {
  const docRef = doc(db, PROFILES_COLLECTION, profileId);
  return onSnapshot(
    docRef,
    (snapshot) => {
      // If the change originates from the local client's pending writes, ignore it
      if (snapshot.metadata.hasPendingWrites) {
        return;
      }
      if (snapshot.exists()) {
        const data = snapshot.data() as CloudProfileData;
        onRemoteChange(data);
      }
    },
    (err) => {
      console.warn(`Cloud sync listener error for profile "${profileId}":`, err);
      onError?.(err);
    }
  );
}
