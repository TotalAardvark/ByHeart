import React, { useState, useEffect, useRef } from 'react';
import { PracticeMode, SongItem } from './types';
import { exportLibraryJson, loadSongs, saveSongs } from './lib/storage';
import {
  ThemeId,
  applyThemeToDocument,
  loadThemeId,
  saveThemeId,
} from './lib/themes';
import {
  ActiveProfile,
  loadActiveProfile,
  saveActiveProfile,
  syncProfileToCloud,
  subscribeToCloudProfile,
} from './lib/cloudSync';
import { PlaylistView } from './components/PlaylistView';
import { SongEditorModal } from './components/SongEditorModal';
import { ChainingMode } from './components/ChainingMode';
import { ScaffoldMode } from './components/ScaffoldMode';
import { FlashcardMode } from './components/FlashcardMode';
import { CloudProfileModal } from './components/CloudProfileModal';

export const App: React.FC = () => {
  const [songs, setSongs] = useState<SongItem[]>(() => loadSongs());
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const initial = loadThemeId();
    applyThemeToDocument(initial);
    return initial;
  });
  const [activeProfile, setActiveProfile] = useState<ActiveProfile | null>(() => loadActiveProfile());
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | undefined>(() => activeProfile?.lastSyncedAt);

  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [editingSong, setEditingSong] = useState<{
    song: SongItem;
    isNew: boolean;
  } | null>(null);

  const isRemoteUpdateRef = useRef(false);

  useEffect(() => {
    saveSongs(songs);
  }, [songs]);

  useEffect(() => {
    applyThemeToDocument(themeId);
    saveThemeId(themeId);
  }, [themeId]);

  // Real-time Cloud Subscription: listen to remote profile changes
  useEffect(() => {
    if (!activeProfile) return;

    const unsubscribe = subscribeToCloudProfile(activeProfile.id, (remoteData) => {
      if (!remoteData) return;

      // Only update local state if remote data has newer or different songs/theme
      isRemoteUpdateRef.current = true;
      if (Array.isArray(remoteData.songs)) {
        setSongs(remoteData.songs);
      }
      if (remoteData.themeId) {
        setThemeId(remoteData.themeId);
      }
      if (remoteData.updatedAt) {
        setLastSyncedAt(remoteData.updatedAt);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeProfile?.id]);

  // Real-time Cloud Auto-Sync: automatically pushes local song or theme edits to cloud
  useEffect(() => {
    if (!activeProfile) return;

    // Skip pushing back if the state update came directly from a remote snapshot
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSyncing(true);
        const syncedTime = await syncProfileToCloud(
          activeProfile.id,
          activeProfile.displayName,
          songs,
          themeId,
          activeProfile.authProvider
        );
        setLastSyncedAt(syncedTime);
      } catch (err) {
        console.error('Cloud auto-sync error:', err);
      } finally {
        setIsSyncing(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [songs, themeId, activeProfile]);

  const handleProfileActivated = (
    profile: ActiveProfile,
    activatedSongs: SongItem[],
    activatedThemeId: ThemeId
  ) => {
    isRemoteUpdateRef.current = true;
    setActiveProfile(profile);
    setSongs(activatedSongs);
    setThemeId(activatedThemeId);
    setLastSyncedAt(profile.lastSyncedAt);
    saveActiveProfile(profile);
  };

  const handleProfileDisconnected = () => {
    setActiveProfile(null);
    saveActiveProfile(null);
  };

  const handleManualSyncNow = async () => {
    if (!activeProfile) return;
    try {
      setIsSyncing(true);
      const syncedTime = await syncProfileToCloud(
        activeProfile.id,
        activeProfile.displayName,
        songs,
        themeId,
        activeProfile.authProvider
      );
      setLastSyncedAt(syncedTime);
    } catch (err) {
      console.error('Manual sync error:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const activeSong = songs.find((s) => s.id === activeSongId) || null;

  const handleRenameSong = (id: string, newShortName: string) => {
    setSongs((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, shortName: newShortName, updatedAt: Date.now() }
          : s
      )
    );
  };

  const handleChangeMode = (id: string, mode: PracticeMode) => {
    setSongs((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, lastMode: mode, updatedAt: Date.now() } : s
      )
    );
  };

  const handleChangeChunkSize = (id: string, newChunkSize: number) => {
    const safeSize = Math.max(1, Math.min(32, newChunkSize));
    setSongs((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, chunkSize: safeSize, updatedAt: Date.now() } : s
      )
    );
  };

  const handleUpdateScaffold = (
    id: string,
    customHighlights: string[],
    scaffoldEveryNLines: 0 | 2 | 4
  ) => {
    setSongs((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              customHighlights,
              scaffoldEveryNLines,
              updatedAt: Date.now(),
            }
          : s
      )
    );
  };

  const handleAddSong = () => {
    const newSong: SongItem = {
      id: `song-${Date.now()}`,
      shortName: 'New Song',
      body: '',
      lastMode: 'chain',
      chunkSize: 4,
      customHighlights: [],
      scaffoldEveryNLines: 2,
      updatedAt: Date.now(),
    };
    setEditingSong({ song: newSong, isNew: true });
  };

  const handleSaveEditor = (updated: SongItem) => {
    setSongs((prev) => {
      const exists = prev.some((s) => s.id === updated.id);
      if (exists) {
        return prev.map((s) => (s.id === updated.id ? updated : s));
      }
      return [updated, ...prev];
    });
    setEditingSong(null);
  };

  const handleDeleteSong = (id: string) => {
    setSongs((prev) => prev.filter((s) => s.id !== id));
    if (activeSongId === id) {
      setActiveSongId(null);
    }
    setEditingSong(null);
  };

  return (
    <>
      {activeSong ? (
        activeSong.lastMode === 'chain' ? (
          <ChainingMode
            song={activeSong}
            onExit={() => setActiveSongId(null)}
            onEditSong={() =>
              setEditingSong({ song: activeSong, isNew: false })
            }
            onChangeChunkSize={(newSize) =>
              handleChangeChunkSize(activeSong.id, newSize)
            }
            onSaveSong={handleSaveEditor}
          />
        ) : activeSong.lastMode === 'scaffold' ? (
          <ScaffoldMode
            song={activeSong}
            onUpdateScaffold={(highlights, everyN) =>
              handleUpdateScaffold(activeSong.id, highlights, everyN)
            }
            onExit={() => setActiveSongId(null)}
          />
        ) : (
          <FlashcardMode
            song={activeSong}
            onExit={() => setActiveSongId(null)}
          />
        )
      ) : (
        <PlaylistView
          songs={songs}
          themeId={themeId}
          activeProfile={activeProfile}
          onChangeTheme={setThemeId}
          onRenameSong={handleRenameSong}
          onChangeMode={handleChangeMode}
          onChangeChunkSize={handleChangeChunkSize}
          onEditSong={(song) => setEditingSong({ song, isNew: false })}
          onPlaySong={(song) => setActiveSongId(song.id)}
          onAddSong={handleAddSong}
          onExportJson={() => exportLibraryJson(songs)}
          onImportJson={(imported) => setSongs(imported)}
          onOpenCloudModal={() => setIsCloudModalOpen(true)}
        />
      )}

      <CloudProfileModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        activeProfile={activeProfile}
        currentSongs={songs}
        currentThemeId={themeId}
        onProfileActivated={handleProfileActivated}
        onProfileDisconnected={handleProfileDisconnected}
        onSyncNow={handleManualSyncNow}
        isSyncing={isSyncing}
        lastSyncedAt={lastSyncedAt}
      />

      {editingSong && (
        <SongEditorModal
          song={editingSong.song}
          isNew={editingSong.isNew}
          onSave={handleSaveEditor}
          onDelete={handleDeleteSong}
          onClose={() => setEditingSong(null)}
        />
      )}
    </>
  );
};

export default App;
