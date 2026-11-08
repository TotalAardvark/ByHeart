import React, { useState, useEffect } from 'react';
import {
  Cloud,
  X,
  UserPlus,
  LogIn,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  LogOut,
  GitMerge,
  Layers,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { SongItem } from '../types';
import { ThemeId } from '../lib/themes';
import {
  ActiveProfile,
  CloudProfileData,
  validateUsername,
  createUsernameProfile,
  loadUsernameProfileDoc,
  signInWithGoogleAuth,
  signInWithAppleAuth,
  disconnectProfile,
  mergeSongs,
  syncProfileToCloud,
} from '../lib/cloudSync';

interface CloudProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile: ActiveProfile | null;
  currentSongs: SongItem[];
  currentThemeId: ThemeId;
  onProfileActivated: (profile: ActiveProfile, songs: SongItem[], themeId: ThemeId) => void;
  onProfileDisconnected: () => void;
  onSyncNow: () => Promise<void>;
  isSyncing: boolean;
  lastSyncedAt?: number;
}

export const CloudProfileModal: React.FC<CloudProfileModalProps> = ({
  isOpen,
  onClose,
  activeProfile,
  currentSongs,
  currentThemeId,
  onProfileActivated,
  onProfileDisconnected,
  onSyncNow,
  isSyncing,
  lastSyncedAt,
}) => {
  const [expandedSection, setExpandedSection] = useState<'create' | 'load' | null>(null);
  const [createUsernameInput, setCreateUsernameInput] = useState('');
  const [loadUsernameInput, setLoadUsernameInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Conflict resolution state (Replace vs Merge)
  const [pendingResolution, setPendingResolution] = useState<{
    profile: ActiveProfile;
    remoteData: CloudProfileData;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingResolution) {
          setPendingResolution(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, pendingResolution]);

  if (!isOpen) return null;

  // Real-time validation for illegal characters only
  const createValidation = validateUsername(createUsernameInput);
  const showCreateWarning = createUsernameInput.length > 0 && createValidation.illegalCharsDetected;

  const loadValidation = validateUsername(loadUsernameInput);
  const showLoadWarning = loadUsernameInput.length > 0 && loadValidation.illegalCharsDetected;

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validation = validateUsername(createUsernameInput);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Please enter a valid username.');
      return;
    }

    try {
      setLoadingAction('create');
      const profile = await createUsernameProfile(
        createUsernameInput,
        currentSongs,
        currentThemeId
      );
      setSuccessMessage(`Profile "@${profile.displayName}" created and real-time sync is now active!`);
      setCreateUsernameInput('');
      setExpandedSection(null);
      onProfileActivated(profile, currentSongs, currentThemeId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create profile.';
      setErrorMessage(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLoadProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validation = validateUsername(loadUsernameInput);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Please enter a valid username.');
      return;
    }

    try {
      setLoadingAction('load');
      const { profile, data } = await loadUsernameProfileDoc(loadUsernameInput);

      // Prompt Replace vs Merge
      setPendingResolution({ profile, remoteData: data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load profile.';
      setErrorMessage(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      setLoadingAction('google');
      const { profile, existingData, isNew } = await signInWithGoogleAuth();

      if (isNew || !existingData) {
        // Initialize and push new cloud profile with current local songs & theme
        await syncProfileToCloud(
          profile.id,
          profile.displayName,
          currentSongs,
          currentThemeId,
          'google'
        );
        onProfileActivated(profile, currentSongs, currentThemeId);
        setSuccessMessage(`Signed in as ${profile.displayName}. Cloud profile created and sync is active!`);
      } else {
        // Prompt Replace vs Merge with existing remote songs
        setPendingResolution({ profile, remoteData: existingData });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.';
      setErrorMessage(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAppleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      setLoadingAction('apple');
      const { profile, existingData, isNew } = await signInWithAppleAuth();

      if (isNew || !existingData) {
        // Initialize and push new cloud profile with current local songs & theme
        await syncProfileToCloud(
          profile.id,
          profile.displayName,
          currentSongs,
          currentThemeId,
          'apple'
        );
        onProfileActivated(profile, currentSongs, currentThemeId);
        setSuccessMessage(`Signed in as ${profile.displayName}. Cloud profile created and sync is active!`);
      } else {
        setPendingResolution({ profile, remoteData: existingData });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Apple sign-in was cancelled or failed.';
      setErrorMessage(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResolveReplace = () => {
    if (!pendingResolution) return;
    const { profile, remoteData } = pendingResolution;
    onProfileActivated(
      profile,
      remoteData.songs || [],
      remoteData.themeId || currentThemeId
    );
    setSuccessMessage(`Loaded profile "@${profile.displayName}". Local library replaced with cloud repertoire.`);
    setPendingResolution(null);
    setLoadUsernameInput('');
    setExpandedSection(null);
  };

  const handleResolveMerge = async () => {
    if (!pendingResolution) return;
    const { profile, remoteData } = pendingResolution;
    const merged = mergeSongs(currentSongs, remoteData.songs || []);
    const themeToUse = remoteData.themeId || currentThemeId;

    try {
      setLoadingAction('merge');
      await syncProfileToCloud(
        profile.id,
        profile.displayName,
        merged,
        themeToUse,
        profile.authProvider
      );
      onProfileActivated(profile, merged, themeToUse);
      setSuccessMessage(
        `Loaded profile "@${profile.displayName}". Repertoire merged (${merged.length} songs total) and synced to cloud!`
      );
      setPendingResolution(null);
      setLoadUsernameInput('');
      setExpandedSection(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to merge and sync profile to cloud.';
      setErrorMessage(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDisconnect = async () => {
    await disconnectProfile();
    onProfileDisconnected();
    setSuccessMessage('Profile disconnected. Local library remains intact on this device.');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-stone-900 border border-stone-700 shadow-2xl p-5 my-8 relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-400/15 text-amber-300 border border-amber-400/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold text-stone-100 flex items-center gap-2">
                Cloud Sync &amp; Profiles
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Sync your repertoire and theme across all your devices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
            aria-label="Close cloud sync modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Notifications */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-snug">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2.5">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-snug">{successMessage}</div>
          </div>
        )}

        {/* Conflict Resolution Screen: Replace vs. Merge */}
        {pendingResolution ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
              <div className="font-semibold text-sm text-stone-100 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Profile Found: @{pendingResolution.profile.displayName}
              </div>
              <p className="text-stone-300 leading-relaxed">
                Cloud has <strong>{pendingResolution.remoteData.songs?.length || 0} songs</strong>. This device currently has{' '}
                <strong>{currentSongs.length} songs</strong>. How would you like to load this profile?
              </p>
            </div>

            <div className="space-y-2.5">
              {/* Option A: Replace */}
              <button
                type="button"
                onClick={handleResolveReplace}
                className="w-full p-3.5 rounded-xl bg-stone-950/70 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-400/50 text-left transition cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-amber-400/15 text-amber-300 border border-amber-400/30 shrink-0 mt-0.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-stone-100">
                    Replace Local Library
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">
                    Overwrites songs and theme on this device with the cloud profile version.
                  </p>
                </div>
              </button>

              {/* Option B: Merge */}
              <button
                type="button"
                onClick={handleResolveMerge}
                disabled={loadingAction === 'merge'}
                className="w-full p-3.5 rounded-xl bg-stone-950/70 hover:bg-stone-800/80 border border-stone-800 hover:border-emerald-400/50 text-left transition cursor-pointer flex items-start gap-3 disabled:opacity-50"
              >
                <div className="p-2 rounded-lg bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 shrink-0 mt-0.5">
                  {loadingAction === 'merge' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <GitMerge className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-stone-100 flex items-center gap-2">
                    <span>Merge Libraries</span>
                    {loadingAction === 'merge' && (
                      <span className="text-[10px] text-amber-300 font-mono">Merging &amp; Syncing...</span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">
                    Combines cloud and local songs together so nothing is lost. Newer edits win.
                  </p>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPendingResolution(null)}
              className="w-full py-2 text-xs text-stone-400 hover:text-stone-200 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Profile Status Bar (if connected) */}
            {activeProfile && (
              <div className="p-3.5 rounded-xl bg-stone-950/80 border border-amber-500/30 shadow-inner flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-xs text-stone-400">Active Profile:</span>
                    <span className="text-xs font-bold text-amber-300 truncate font-mono">
                      @{activeProfile.displayName}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700 capitalize">
                    {activeProfile.authProvider}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-400 border-t border-stone-800/80 pt-2">
                  <span>
                    {isSyncing ? (
                      <span className="text-amber-300 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Syncing...
                      </span>
                    ) : lastSyncedAt ? (
                      `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    ) : (
                      'Real-time auto-sync on'
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setErrorMessage(null);
                          await onSyncNow();
                          setSuccessMessage('Library successfully synced with cloud!');
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : 'Sync failed.';
                          setErrorMessage(msg);
                        }
                      }}
                      disabled={isSyncing}
                      className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 transition flex items-center gap-1 cursor-pointer text-[10px]"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sync Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition flex items-center gap-1 cursor-pointer text-[10px]"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Accordion 1: CREATE NEW PROFILE */}
            <div className="rounded-xl border border-stone-800 bg-stone-950/50 overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setExpandedSection(expandedSection === 'create' ? null : 'create')
                }
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-stone-800/40 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-400/10 text-amber-300 border border-amber-400/20">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-semibold text-stone-100">
                      Create New Profile
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Pick any username to start zero-friction cloud sync
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-stone-400 transition-transform ${
                    expandedSection === 'create' ? 'rotate-180 text-amber-300' : ''
                  }`}
                />
              </button>

              {expandedSection === 'create' && (
                <form
                  onSubmit={handleCreateProfile}
                  className="p-3.5 border-t border-stone-800/80 bg-stone-900/40 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Choose a Username
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={createUsernameInput}
                      onChange={(e) => setCreateUsernameInput(e.target.value)}
                      placeholder="e.g. pablo-repertoire or stage-guitarist"
                      className="w-full bg-stone-950 border border-stone-700 focus:border-amber-400 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none transition"
                    />

                    {/* Pop up warning text ONLY if illegal characters are detected */}
                    {showCreateWarning && (
                      <p className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1.5 leading-tight">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{createValidation.error}</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loadingAction === 'create' || showCreateWarning || !createUsernameInput.trim()}
                    className="w-full py-2 px-3 rounded-lg btn-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingAction === 'create' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking &amp; Creating...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Create &amp; Sync Profile</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Accordion 2: LOAD EXISTING PROFILE */}
            <div className="rounded-xl border border-stone-800 bg-stone-950/50 overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setExpandedSection(expandedSection === 'load' ? null : 'load')
                }
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-stone-800/40 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-400/10 text-sky-300 border border-sky-400/20">
                    <LogIn className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-semibold text-stone-100">
                      Load Existing Profile
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Load and sync an existing username on this device
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-stone-400 transition-transform ${
                    expandedSection === 'load' ? 'rotate-180 text-amber-300' : ''
                  }`}
                />
              </button>

              {expandedSection === 'load' && (
                <form
                  onSubmit={handleLoadProfile}
                  className="p-3.5 border-t border-stone-800/80 bg-stone-900/40 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">
                      Enter Profile Username
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={loadUsernameInput}
                      onChange={(e) => setLoadUsernameInput(e.target.value)}
                      placeholder="e.g. pablo-repertoire"
                      className="w-full bg-stone-950 border border-stone-700 focus:border-amber-400 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none transition"
                    />

                    {/* Pop up warning text ONLY if illegal characters are detected */}
                    {showLoadWarning && (
                      <p className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1.5 leading-tight">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{loadValidation.error}</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loadingAction === 'load' || showLoadWarning || !loadUsernameInput.trim()}
                    className="w-full py-2 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold text-xs flex items-center justify-center gap-1.5 border border-stone-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingAction === 'load' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Searching Profile...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Find &amp; Load Profile</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Separator / Social OAuth options */}
            <div className="pt-2">
              <div className="relative flex items-center justify-center mb-3">
                <div className="border-t border-stone-800 w-full" />
                <span className="bg-stone-900 px-2 text-[10px] uppercase font-mono tracking-wider text-stone-500 shrink-0">
                  Or Sign In With Account
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Google Sign-In */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={!!loadingAction}
                  className="p-2.5 rounded-xl bg-stone-950/60 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 text-stone-200 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.2 8.9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.1-2 .4-2.7L1.6 6.4C.6 8.3 0 10.4 0 12.7s.6 4.4 1.6 6.3l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.2-6.7-5.3L1.6 16.4C3.5 20.3 7.4 23.5 12 23.5z"
                    />
                  </svg>
                  <span>Google</span>
                </button>

                {/* Apple Sign-In */}
                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  disabled={!!loadingAction}
                  className="p-2.5 rounded-xl bg-stone-950/60 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 text-stone-200 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.8c.62-.77 1.05-1.84.93-2.92-.93.04-2.07.63-2.73 1.4-.58.67-1.09 1.77-.95 2.83 1.05.08 2.12-.54 2.75-1.31z" />
                  </svg>
                  <span>Apple</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
