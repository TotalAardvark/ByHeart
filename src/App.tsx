import React, { useState, useEffect } from 'react';
import { PracticeMode, SongItem } from './types';
import { exportLibraryJson, loadSongs, saveSongs } from './lib/storage';
import {
  ThemeId,
  applyThemeToDocument,
  loadThemeId,
  saveThemeId,
} from './lib/themes';
import { PlaylistView } from './components/PlaylistView';
import { SongEditorModal } from './components/SongEditorModal';
import { ChainingMode } from './components/ChainingMode';
import { ScaffoldMode } from './components/ScaffoldMode';
import { FlashcardMode } from './components/FlashcardMode';

export const App: React.FC = () => {
  const [songs, setSongs] = useState<SongItem[]>(() => loadSongs());
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const initial = loadThemeId();
    applyThemeToDocument(initial);
    return initial;
  });
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [editingSong, setEditingSong] = useState<{
    song: SongItem;
    isNew: boolean;
  } | null>(null);

  useEffect(() => {
    saveSongs(songs);
  }, [songs]);

  useEffect(() => {
    applyThemeToDocument(themeId);
    saveThemeId(themeId);
  }, [themeId]);

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
          onChangeTheme={setThemeId}
          onRenameSong={handleRenameSong}
          onChangeMode={handleChangeMode}
          onChangeChunkSize={handleChangeChunkSize}
          onEditSong={(song) => setEditingSong({ song, isNew: false })}
          onPlaySong={(song) => setActiveSongId(song.id)}
          onAddSong={handleAddSong}
          onExportJson={() => exportLibraryJson(songs)}
          onImportJson={(imported) => setSongs(imported)}
        />
      )}

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
