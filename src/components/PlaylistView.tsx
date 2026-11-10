import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pencil,
  Link2,
  AlignLeft,
  Layers,
  FileText,
  ChevronDown,
  Plus,
  Download,
  Upload,
  Heart,
  Check,
  Sparkles,
  Palette,
  X,
  Cloud,
  Info,
} from 'lucide-react';
import { PracticeMode, SongItem } from '../types';
import { parseSongBody } from '../lib/parser';
import {
  THEME_PALETTES,
  ThemeId,
  getThemePalette,
} from '../lib/themes';
import { ActiveProfile } from '../lib/cloudSync';
import { ChunkSizePopover } from './ChunkSizePopover';
import { SectionOutlinePopover } from './SectionOutlinePopover';

interface PlaylistViewProps {
  songs: SongItem[];
  themeId: ThemeId;
  activeProfile: ActiveProfile | null;
  onChangeTheme: (id: ThemeId) => void;
  onRenameSong: (id: string, newShortName: string) => void;
  onChangeMode: (id: string, mode: PracticeMode) => void;
  onChangeChunkSize: (id: string, newChunkSize: number) => void;
  onEditSong: (song: SongItem) => void;
  onPlaySong: (song: SongItem) => void;
  onAddSong: () => void;
  onExportJson: () => void;
  onImportJson: (songs: SongItem[]) => void;
  onOpenCloudModal: () => void;
  onOpenLanding?: () => void;
}

export const MODE_META: Record<
  PracticeMode,
  {
    label: string;
    shortLabel: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    badgeClass: string;
  }
> = {
  chain: {
    label: 'Chain & Loop',
    shortLabel: 'Chain',
    description: 'Progressive 1 → 2 → 1+2 → 3 → 1+2+3 forward chaining',
    icon: Link2,
    badgeClass:
      'bg-stone-800/80 hover:bg-stone-800 text-stone-200 hover:text-stone-100 border-stone-700/70',
  },
  scaffold: {
    label: 'Word Scaffold',
    shortLabel: 'Scaffold',
    description: '1st-word anchors + click-drag custom word highlights',
    icon: AlignLeft,
    badgeClass:
      'bg-stone-800/80 hover:bg-stone-800 text-stone-200 hover:text-stone-100 border-stone-700/70',
  },
  flashcards: {
    label: 'Flashcards',
    shortLabel: 'Cards',
    description: 'Section entry triggers, chord loops & transition prompts',
    icon: Layers,
    badgeClass:
      'bg-stone-800/80 hover:bg-stone-800 text-stone-200 hover:text-stone-100 border-stone-700/70',
  },
  page: {
    label: 'Page View',
    shortLabel: 'Sheet',
    description: 'Full scrolling song sheet with line numbers & print format',
    icon: FileText,
    badgeClass:
      'bg-stone-800/80 hover:bg-stone-800 text-stone-200 hover:text-stone-100 border-stone-700/70',
  },
};

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  songs,
  themeId,
  activeProfile,
  onChangeTheme,
  onRenameSong,
  onChangeMode,
  onChangeChunkSize,
  onEditSong,
  onPlaySong,
  onAddSong,
  onExportJson,
  onImportJson,
  onOpenCloudModal,
  onOpenLanding,
}) => {
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [activeChunkPopoverSongId, setActiveChunkPopoverSongId] = useState<string | null>(null);
  const [activeSectionPopoverSongId, setActiveSectionPopoverSongId] = useState<string | null>(null);
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.innerHeight > window.innerWidth || window.innerWidth < 720
      : false
  );
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('by_heart_tutorial_open_v1');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTheme = getThemePalette(themeId);

  useEffect(() => {
    const updateOrientation = () => {
      setIsPortrait(
        window.innerHeight > window.innerWidth || window.innerWidth < 720
      );
    };
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  const handleToggleTutorial = () => {
    setIsTutorialOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('by_heart_tutorial_open_v1', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-mode-dropdown]')) {
        setOpenDropdownId(null);
      }
      if (!target.closest('[data-chunk-popover]')) {
        setActiveChunkPopoverSongId(null);
      }
      if (!target.closest('[data-section-popover]')) {
        setActiveSectionPopoverSongId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsThemePickerOpen(false);
        setIsBackupModalOpen(false);
        setOpenDropdownId(null);
        setActiveChunkPopoverSongId(null);
        setActiveSectionPopoverSongId(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const startRenaming = (song: SongItem) => {
    setEditingNameId(song.id);
    setNameDraft(song.shortName);
  };

  const commitRename = (id: string) => {
    const trimmed = nameDraft.trim();
    if (trimmed) {
      onRenameSong(id, trimmed);
    }
    setEditingNameId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const list = Array.isArray(parsed) ? parsed : parsed.songs;
        if (Array.isArray(list) && list.length > 0) {
          onImportJson(list);
        }
      } catch (err) {
        alert('Could not parse JSON backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-stone-800/80 bg-stone-900/40 backdrop-blur-sm relative z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div
              style={{
                background: activeTheme.logo.badgeBackground,
                borderColor: activeTheme.logo.badgeBorder,
                boxShadow: activeTheme.logo.badgeShadow,
              }}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex items-center justify-center shrink-0 transition-all duration-300"
              title={`By Heart — ${activeTheme.name} Theme`}
            >
              <Heart
                className="w-7 h-7 sm:w-8 sm:h-8 transition-colors duration-300"
                style={{
                  fill: activeTheme.logo.heartFill,
                  color: activeTheme.logo.heartStroke,
                }}
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-100 flex items-center gap-2">
                By Heart
                <span className="text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-stone-800 text-amber-300 border border-stone-700">
                  v1.0
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
                Research-backed memory strategies for speeches, text, poems, or songs, with built-in Ultimate Guitar Chord De-Ugly-Mator. Learn it By Heart!
              </p>
            </div>
          </div>

          {/* Action Row: [ADD SONG] - [IMPORT/EXPORT] - [THEME] */}
          <div className="flex items-center gap-2">
            {/* 1. ADD SONG */}
            <button
              onClick={onAddSong}
              className="px-4 py-2 rounded-lg text-sm font-semibold btn-primary shadow-md shadow-amber-500/10 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Song / Text</span>
            </button>

            {/* 2. BACKUP & CLOUD SYNC BUTTON (Faded grey cloud when disconnected, active theme color when connected) */}
            <button
              onClick={() => setIsBackupModalOpen(true)}
              title={
                activeProfile
                  ? `Cloud Sync Active: @${activeProfile.displayName} (Click for Library Backup & Profiles)`
                  : 'Library Backup & Cloud Sync'
              }
              aria-label="Open library backup and cloud sync options"
              style={
                activeProfile
                  ? {
                      borderColor: activeTheme.logo.badgeBorder,
                      boxShadow: `0 0 12px -2px ${activeTheme.logo.badgeBorder}40`,
                    }
                  : undefined
              }
              className={`px-3 py-2 rounded-lg text-xs font-medium bg-stone-900 hover:bg-stone-800 border flex items-center gap-1.5 transition cursor-pointer ${
                activeProfile ? '' : 'text-stone-400 border-stone-800'
              }`}
            >
              <Cloud
                className="w-4 h-4 transition-colors"
                style={
                  activeProfile
                    ? { color: activeTheme.logo.heartStroke }
                    : { color: '#78716c' }
                }
              />
              {activeProfile ? (
                <span
                  className="hidden sm:inline font-mono text-[11px] font-semibold truncate max-w-[120px]"
                  style={{ color: activeTheme.logo.heartStroke }}
                >
                  @{activeProfile.displayName}
                </span>
              ) : (
                <span className="hidden sm:inline text-stone-400">Sync</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* 3. THEME PICKER BUTTON */}
            <button
              onClick={() => setIsThemePickerOpen(true)}
              title={`Change color theme (Current: ${activeTheme.name})`}
              aria-label="Open theme color palette picker"
              className="px-3 py-2 rounded-lg text-xs font-medium bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 flex items-center gap-2 transition cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="hidden sm:inline">{activeTheme.name}</span>
              {/* Mini 4-stripe swatch icon matching the selected palette */}
              <span className="w-4 h-4 rounded overflow-hidden flex flex-col border border-stone-700/80 shrink-0">
                {activeTheme.swatches.map((hex, idx) => (
                  <span
                    key={idx}
                    className="flex-1 w-full"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </span>
            </button>

            {/* 4. TOUR & ABOUT BYHEART BUTTON */}
            {onOpenLanding && (
              <button
                onClick={onOpenLanding}
                title="Explore By Heart cognitive science tour and marketing page"
                aria-label="Open By Heart tour and marketing page"
                className="px-3 py-2 rounded-lg text-xs font-medium bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="hidden sm:inline">Tour &amp; Science</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Small Import / Export Library Modal */}
      {isBackupModalOpen && (
        <div
          onClick={() => setIsBackupModalOpen(false)}
          className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-stone-900 border border-stone-700 shadow-2xl p-4 sm:p-5"
          >
            <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-stone-800">
              <div>
                <div className="text-sm sm:text-base font-bold text-stone-100">
                  Library Backup &amp; Restore
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  Import or export your repertoire playlist (.json)
                </p>
              </div>
              <button
                onClick={() => setIsBackupModalOpen(false)}
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                aria-label="Close import/export modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsBackupModalOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full text-left p-3.5 rounded-xl bg-stone-950/70 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-400/50 transition cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-amber-400/15 text-amber-300 border border-amber-400/30 shrink-0 mt-0.5">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-stone-100">
                    Import Library from File
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">
                    Load a saved <code className="text-stone-300">.json</code> backup file from your device into By Heart.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBackupModalOpen(false);
                  onExportJson();
                }}
                className="w-full text-left p-3.5 rounded-xl bg-stone-950/70 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-400/50 transition cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 shrink-0 mt-0.5">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-stone-100">
                    Export Library to File
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">
                    Download your current songs and settings as a <code className="text-stone-300">.json</code> backup file.
                  </p>
                </div>
              </button>

              {/* 3. CLOUD SYNC & PROFILES OPTION */}
              <button
                type="button"
                onClick={() => {
                  setIsBackupModalOpen(false);
                  onOpenCloudModal();
                }}
                className="w-full text-left p-3.5 rounded-xl bg-stone-950/70 hover:bg-stone-800/80 border border-stone-800 hover:border-sky-400/50 transition cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-sky-400/15 text-sky-300 border border-sky-400/30 shrink-0 mt-0.5">
                  <Cloud className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-stone-100 flex items-center justify-between">
                    <span>Cloud Sync &amp; Profiles</span>
                    {activeProfile && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-400/10 text-emerald-300 border border-emerald-400/30">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">
                    {activeProfile
                      ? `Active profile @${activeProfile.displayName}. Real-time auto-sync enabled.`
                      : 'Sync repertoire and color themes across devices with a username profile.'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Centered Theme Picker Popup Modal */}
      {isThemePickerOpen && (
        <div
          onClick={() => setIsThemePickerOpen(false)}
          className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md sm:max-w-lg rounded-2xl bg-stone-900 border border-stone-700 shadow-2xl p-4 sm:p-5"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-800">
              <div>
                <div className="text-sm sm:text-base font-bold text-stone-100 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-amber-300" />
                  <span>Choose Color Palette</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  High-contrast themes with matching Heart badge
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 border border-stone-700/70">
                  {activeTheme.mode === 'dark' ? 'Dark Stage' : 'Warm Paper'}
                </span>
                <button
                  onClick={() => setIsThemePickerOpen(false)}
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                  aria-label="Close theme picker"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {THEME_PALETTES.map((palette) => {
                const isSelected = palette.id === themeId;
                return (
                  <button
                    key={palette.id}
                    onClick={() => {
                      onChangeTheme(palette.id);
                      setIsThemePickerOpen(false);
                    }}
                    className={`group/card text-left rounded-xl p-2.5 border transition cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-stone-800/90 border-amber-400 ring-2 ring-amber-400/40'
                        : 'bg-stone-950/60 hover:bg-stone-800/60 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    {/* 4 Horizontal Stripes Card + Mini Matching Heart Badge */}
                    <div className="relative w-full h-20 rounded-lg overflow-hidden flex flex-col shadow-inner border border-black/10">
                      {palette.swatches.map((hex, i) => (
                        <div
                          key={i}
                          className="flex-1 w-full"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                      {/* Mini Heart Logo Preview in bottom-right corner */}
                      <div
                        style={{
                          background: palette.logo.badgeBackground,
                          borderColor: palette.logo.badgeBorder,
                        }}
                        className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-lg border flex items-center justify-center shadow-md"
                      >
                        <Heart
                          className="w-4 h-4"
                          style={{
                            fill: palette.logo.heartFill,
                            color: palette.logo.heartStroke,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1 px-0.5">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-stone-100 truncate">
                          {palette.name}
                        </div>
                        <div className="text-[10px] text-stone-400 truncate">
                          {palette.mode === 'dark' ? 'Dark' : 'Light'} •{' '}
                          {palette.tagline}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-amber-300 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Playlist Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-2.5">
          {songs.map((song) => {
            const parsed = parseSongBody(song.body, song.chunkSize);
            const fullSubtitle = parsed.preambleLines[0] || '';
            const uniqueSectionCount = parsed.sections.filter(
              (s) => s.isRepeatOfSectionIndex === null
            ).length;
            const uniqueChunkCount = parsed.chunkParts.filter(
              (p) => p.isRepeatOfSectionIndex === null
            ).length;
            const modeInfo = MODE_META[song.lastMode] || MODE_META.chain;
            const ModeIcon = modeInfo.icon;
            const isDropdownOpen = openDropdownId === song.id;
            const isChunkPopoverOpen = activeChunkPopoverSongId === song.id;
            const isSectionPopoverOpen = activeSectionPopoverSongId === song.id;
            const isAnyMenuOpen =
              isDropdownOpen || isChunkPopoverOpen || isSectionPopoverOpen;

            return (
              <div
                key={song.id}
                className={`group relative bg-stone-900/80 hover:bg-stone-900 border border-stone-800/90 hover:border-stone-700 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3 transition shadow-sm ${
                  isAnyMenuOpen ? 'z-30' : 'z-10'
                }`}
              >
                {/* Left Side: Portrait 3-Line Stack vs Landscape 2-Line Stack + Taller Tags */}
                <div
                  className={`min-w-0 flex-1 pr-2 ${
                    isPortrait
                      ? 'flex flex-col items-start gap-1.5'
                      : 'flex items-center gap-3.5'
                  }`}
                >
                  {editingNameId === song.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={nameDraft}
                        autoFocus
                        onChange={(e) => setNameDraft(e.target.value)}
                        onBlur={() => commitRename(song.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(song.id);
                          if (e.key === 'Escape') setEditingNameId(null);
                        }}
                        className="bg-stone-950 border border-amber-400/70 rounded-lg px-2.5 py-1 text-base font-semibold text-stone-100 focus:outline-none w-full max-w-xs"
                        placeholder="Short playlist name..."
                      />
                      <button
                        onClick={() => commitRename(song.id)}
                        className="p-1.5 rounded-lg btn-primary"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col min-w-0 max-w-full">
                      <button
                        onClick={() => startRenaming(song)}
                        title="Click to edit playlist shorthand name"
                        className="text-left text-base sm:text-lg font-semibold text-stone-100 hover:text-amber-300 transition truncate cursor-pointer leading-tight"
                      >
                        {song.shortName}
                      </button>
                      {fullSubtitle && (
                        <span className="truncate text-xs text-stone-500 mt-0.5 leading-snug">
                          {fullSubtitle}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Interactive [# sec] and [# chunks] Pills (Line 3 in Portrait, Side-by-Side Taller in Landscape) */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* 1. UNIQUE SECTIONS PILL */}
                    <div className="relative" data-section-popover>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChunkPopoverSongId(null);
                          setActiveSectionPopoverSongId(
                            isSectionPopoverOpen ? null : song.id
                          );
                        }}
                        title="Unique sections (repeats counted once) — Click to view section roadmap"
                        className={`font-mono border transition cursor-pointer flex items-center gap-1 ${
                          isPortrait
                            ? 'text-[11px] leading-snug px-2 py-0.5 rounded-md'
                            : 'text-xs px-3 py-2 rounded-lg gap-1.5'
                        } ${
                          isSectionPopoverOpen
                            ? 'bg-stone-800 text-amber-300 border-amber-500/50 shadow-sm'
                            : 'bg-stone-800/80 hover:bg-stone-800 text-stone-300 hover:text-stone-100 border-stone-700/60'
                        }`}
                      >
                        <span className="font-semibold">{uniqueSectionCount}</span>
                        <span>{uniqueSectionCount === 1 ? 'section' : 'sections'}</span>
                      </button>

                      {isSectionPopoverOpen && (
                        <div className="absolute left-0 top-full mt-1.5 z-50">
                          <SectionOutlinePopover
                            songTitle={song.shortName}
                            sections={parsed.sections}
                            onClose={() =>
                              setActiveSectionPopoverSongId(null)
                            }
                          />
                        </div>
                      )}
                    </div>

                    {/* 2. UNIQUE CHUNKS PILL (Clickable -> Opens quick chunk size change popup) */}
                    <div className="relative" data-chunk-popover>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSectionPopoverSongId(null);
                          setActiveChunkPopoverSongId(
                            isChunkPopoverOpen ? null : song.id
                          );
                        }}
                        title={`Chunk size: ${song.chunkSize} lines/chunk (${uniqueChunkCount} unique chunks). Click to adjust`}
                        className={`font-mono border transition cursor-pointer flex items-center ${
                          isPortrait
                            ? 'text-[11px] leading-snug px-2 py-0.5 rounded-md gap-1'
                            : 'text-xs px-3 py-2 rounded-lg gap-1.5'
                        } ${
                          isChunkPopoverOpen
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                            : 'bg-stone-800/80 hover:bg-amber-500/15 text-stone-300 hover:text-amber-200 border-stone-700/60 hover:border-amber-500/40'
                        }`}
                      >
                        <span className="font-semibold">{uniqueChunkCount}</span>
                        <span>chunks</span>
                        <span
                          className={`font-semibold text-amber-300/90 bg-amber-400/10 rounded border border-amber-400/20 ${
                            isPortrait
                              ? 'text-[10px] px-1 py-0'
                              : 'text-[10px] px-1.5 py-0.5'
                          }`}
                        >
                          {song.chunkSize}L
                        </span>
                        <ChevronDown className="w-3 h-3 opacity-60" />
                      </button>

                      {isChunkPopoverOpen && (
                        <div className="absolute left-0 top-full mt-1.5 z-50">
                          <ChunkSizePopover
                            songTitle={song.shortName}
                            songBody={song.body}
                            chunkSize={song.chunkSize}
                            onChange={(newSize) => {
                              onChangeChunkSize(song.id, newSize);
                            }}
                            onClose={() =>
                              setActiveChunkPopoverSongId(null)
                            }
                            align="left"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side Controls Row: [Edit] [Mode Dropdown] [Play] */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* 1. EDIT BUTTON ICON (Borderless faded theme icon like trash icon in edit modal) */}
                  <button
                    onClick={() => onEditSong(song)}
                    title="Edit song notation & Smart Compactor"
                    className="p-2 rounded-lg text-stone-500 hover:text-stone-200 hover:bg-stone-800/60 transition cursor-pointer flex items-center justify-center"
                    aria-label={`Edit ${song.shortName}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {/* 2. PRACTICE MODALITY DROPDOWN (remembers last choice, equal height to Play button) */}
                  <div className="relative" data-mode-dropdown>
                    <button
                      onClick={() =>
                        setOpenDropdownId(isDropdownOpen ? null : song.id)
                      }
                      title={`Practice modality: ${modeInfo.label} (click to change)`}
                      className={`h-9 sm:h-10 px-3 rounded-lg border text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition cursor-pointer ${modeInfo.badgeClass}`}
                      aria-label={`Change practice mode for ${song.shortName}`}
                    >
                      <ModeIcon className="w-4 h-4 shrink-0" />
                      <span className="hidden xs:inline">{modeInfo.shortLabel}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-75" />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-64 rounded-xl bg-stone-900 border border-stone-700 shadow-2xl py-1.5 z-30">
                        <div className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-stone-400 border-b border-stone-800">
                          Select Practice Mode
                        </div>
                        {(Object.keys(MODE_META) as PracticeMode[]).map((m) => {
                          const meta = MODE_META[m];
                          const Icon = meta.icon;
                          const isSelected = song.lastMode === m;
                          return (
                            <button
                              key={m}
                              onClick={() => {
                                onChangeMode(song.id, m);
                                setOpenDropdownId(null);
                                onPlaySong({ ...song, lastMode: m });
                              }}
                              className={`w-full px-3 py-2.5 text-left flex items-start gap-2.5 hover:bg-stone-800/80 transition cursor-pointer ${
                                isSelected ? 'bg-stone-800/50' : ''
                              }`}
                            >
                              <Icon
                                className={`w-4 h-4 mt-0.5 shrink-0 ${
                                  isSelected
                                    ? 'text-amber-300'
                                    : 'text-stone-400'
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-stone-100 flex items-center justify-between">
                                  <span>{meta.label}</span>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-amber-400" />
                                  )}
                                </div>
                                <p className="text-[11px] text-stone-400 leading-snug mt-0.5">
                                  {meta.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 3. PLAY BUTTON (Equal height to Practice Mode button) */}
                  <button
                    onClick={() => onPlaySong(song)}
                    title={`Practice "${song.shortName}" in ${modeInfo.label} mode`}
                    className="h-9 sm:h-10 px-4 rounded-lg btn-primary font-semibold text-sm flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 transition cursor-pointer"
                    aria-label={`Play ${song.shortName}`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span className="hidden sm:inline">Play</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Collapsible 8-Card Notation & Memory Strategy Guide */}
        <div className="mt-8 rounded-2xl border border-stone-800/80 bg-stone-900/30 p-4 sm:p-5">
          <button
            type="button"
            onClick={handleToggleTutorial}
            aria-expanded={isTutorialOpen}
            className="w-full flex items-center justify-between gap-2 text-xs font-mono uppercase tracking-wider text-amber-300/90 cursor-pointer select-none"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>How By Heart Works</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 text-stone-400 transition-transform duration-200 ${
                isTutorialOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isTutorialOpen && (
            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs text-stone-400 leading-relaxed">
              <div className="bg-stone-950/60 border border-stone-800/70 rounded-xl p-3.5">
                <div className="font-semibold text-stone-200 mb-1">
                  1. 🧠 Chunk Size: Your #1 Memory Tool
                </div>
                <p>
                  Working memory holds only a few lines at once. Click the{' '}
                  <code className="text-amber-300">chunks</code> pill on any song
                  to dial lines-per-chunk to fit your memory.
                </p>
              </div>

              <div className="bg-stone-950/60 border border-stone-800/70 rounded-xl p-3.5">
                <div className="font-semibold text-stone-200 mb-1">
                  2. Start Short → Build Longer
                </div>
                <p>
                  Memorize tough lyrics fastest by chaining{' '}
                  <strong>1–2 line chunks</strong> first, then stepping up to{' '}
                  <strong>4-line chunks</strong> and finally{' '}
                  <strong>Whole Sections</strong>.
                </p>
              </div>

              <div className="bg-stone-950/60 border border-stone-800/70 rounded-xl p-3.5">
                <div className="font-semibold text-stone-200 mb-1">
                  3. Forward Chaining &amp; Blanking (<code className="text-amber-300">Chain</code>)
                </div>
                <p>
                  Step through{' '}
                  <code className="text-amber-300">1 → 2 → (1+2) → 3 → (1+2+3)</code>{' '}
                  and see the song grow in your mind! Enable{' '}
                  <strong>Blanking</strong> to test each part against a blank
                  silhouette before advancing.
                </p>
              </div>

              <div className="bg-stone-950/60 border border-stone-800/70 rounded-xl p-3.5">
                <div className="font-semibold text-stone-200 mb-1">
                  4. First-Word Anchors (<code className="text-emerald-300">Scaffold</code>)
                </div>
                <p>
                  Masks every word except the <strong>1st word of every 2 or 4 lines</strong>
                  —plus click or drag across any words to highlight custom memory
                  triggers.
                </p>
              </div>

              <div className="bg-stone-950/60 border border-stone-800/70 rounded-xl p-3.5">
                <div className="font-semibold text-stone-200 mb-1">
                  5. Non-Sequential Recall (<code className="text-sky-300">Cards</code>)
                </div>
                <p>
                  Shuffles your chunks into flashcards prompted by the preceding
                  line, training you to enter any verse or chorus cold without
                  starting from line 1.
                </p>
              </div>

              <div className="bg-stone-950/60 border border-stone-800/70 rounded-xl p-3.5">
                <div className="font-semibold text-stone-200 mb-1">
                  6. Numbered Sections (<code className="text-amber-300">1.</code>, <code className="text-amber-300">2.</code>)
                </div>
                <p>
                  Number each section (for example,{' '}
                  <code className="text-amber-300">1. Verse 1</code> or{' '}
                  <code className="text-amber-300">2. Chorus</code>). For repeat
                  sections later, write just{' '}
                  <code className="text-emerald-300">5. Chorus</code> with an
                  empty body to auto-link and skip re-learning.
                </p>
              </div>

              <div className="bg-stone-950/60 border border-stone-800/70 rounded-xl p-3.5">
                <div className="font-semibold text-stone-200 mb-1">
                  7. Chord Loops (<code className="text-amber-300">[ C - F ]</code> &amp; <code className="text-amber-300">|</code>)
                </div>
                <p>
                  Write repeating chord loops once (single-line{' '}
                  <code className="text-amber-300">[ C - F ]</code> or 2-line couplets{' '}
                  <code className="text-amber-300">[ Em7 - D/F# - G | C - G - D ]</code>)
                  and they attach to every following section until changed.
                </p>
              </div>

              <div className="bg-stone-950/60 border border-stone-800/70 rounded-xl p-3.5">
                <div className="font-semibold text-stone-200 mb-1">
                  8. Pattern Breakers (<code className="text-sky-300">G ... E</code>)
                </div>
                <p>
                  If there&apos;s a short break in the pattern, you can add a new
                  line and insert chords above lyrics without affecting the
                  active chord loop.
                </p>
              </div>

              <div className="bg-stone-950/60 border border-stone-800/70 rounded-xl p-3.5 sm:col-span-2 lg:col-span-2">
                <div className="font-semibold text-stone-200 mb-1">
                  9. Locked Chunks &amp; Guitar TABs (<code className="text-amber-300">&#123; ... &#125;</code>)
                </div>
                <p>
                  Wrap multi-line guitar TABs or custom stanzas inside{' '}
                  <code className="text-amber-300">&#123; ... &#125;</code> so all
                  lines inside stay locked together as a single indivisible chunk
                  (automatically added when keeping in-song TABs).
                </p>
              </div>

              <div className="bg-stone-950/60 border border-stone-800/70 rounded-xl p-3.5 sm:col-span-2 lg:col-span-2">
                <div className="font-semibold text-stone-200 mb-1">
                  10. Silenced Reference Notes (<code className="text-stone-300">(( ... ))</code>)
                </div>
                <p>
                  Preamble tuning notes and chord voicing diagrams are wrapped in{' '}
                  <code className="text-stone-300">(( ... ))</code> by the
                  compactor so they stay saved in your editor for reference
                  without cluttering the practice stage.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
