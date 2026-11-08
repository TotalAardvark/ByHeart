import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  X,
  Wand2,
  Save,
  Sparkles,
  ArrowRight,
  FileText,
  HelpCircle,
  Trash2,
  AlertTriangle,
  Globe,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { SongItem } from '../types';
import {
  CompactorOptions,
  DEFAULT_COMPACTOR_OPTIONS,
  compactChordSheet,
} from '../lib/compactor';
import { parseSongBody } from '../lib/parser';
import {
  appendCapoToShortName,
  extractCapoLabel,
  isUGBracketedSectionHeader,
  parseNumberedSectionHeader,
} from '../lib/chordUtils';
import {
  RAW_ROTTERDAM_UG_SAMPLE,
  RAW_SHALLOW_UG_SAMPLE,
} from '../lib/sampleSongs';
import { fetchChordSheetFromUrl } from '../lib/urlScraper';

interface SongEditorModalProps {
  song: SongItem;
  isNew?: boolean;
  onSave: (updated: SongItem) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

/**
 * Splits a full song body into:
 * - `description`: Line 1 preamble (title/artist/description before the first section)
 * - `sectionsBody`: The main song body starting at the first section
 */
function splitPreambleAndBody(rawBody: string): {
  description: string;
  sectionsBody: string;
} {
  const normalized = rawBody.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  // Find index of first non-empty line
  const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmptyIdx === -1) {
    return { description: '', sectionsBody: '' };
  }

  const firstLine = lines[firstNonEmptyIdx].trim();
  const isFirstLineSection =
    parseNumberedSectionHeader(firstLine) !== null ||
    isUGBracketedSectionHeader(firstLine) !== null;

  if (isFirstLineSection) {
    return {
      description: '',
      sectionsBody: lines.slice(firstNonEmptyIdx).join('\n'),
    };
  }

  // Check if there are numbered/bracketed sections after the first line
  const remainingLines = lines.slice(firstNonEmptyIdx + 1);
  const hasSectionsBelow = remainingLines.some((l) => {
    const t = l.trim();
    return (
      parseNumberedSectionHeader(t) !== null ||
      isUGBracketedSectionHeader(t) !== null
    );
  });

  if (hasSectionsBelow) {
    // Strip leading blank lines before the first section
    const firstBodyLineIdx = remainingLines.findIndex(
      (l) => l.trim().length > 0
    );
    return {
      description: firstLine,
      sectionsBody:
        firstBodyLineIdx !== -1
          ? remainingLines.slice(firstBodyLineIdx).join('\n')
          : '',
    };
  }

  return {
    description: '',
    sectionsBody: normalized,
  };
}

function combinePreambleAndBody(
  description: string,
  sectionsBody: string
): string {
  const cleanDesc = description.trim();
  const cleanSections = sectionsBody.replace(/^\n+/, '');
  if (cleanDesc && cleanSections) {
    return `${cleanDesc}\n\n${cleanSections}`;
  }
  if (cleanDesc) {
    return `${cleanDesc}\n`;
  }
  return cleanSections;
}

export const SongEditorModal: React.FC<SongEditorModalProps> = ({
  song,
  isNew = false,
  onSave,
  onDelete,
  onClose,
}) => {
  const initialSplit = useMemo(
    () => splitPreambleAndBody(song.body),
    [song.body]
  );

  const [shortName, setShortName] = useState(song.shortName);
  const [description, setDescription] = useState(initialSplit.description);
  const [sectionsBody, setSectionsBody] = useState(initialSplit.sectionsBody);
  const [rawSource, setRawSource] = useState(song.rawSource || '');
  const [chunkSize, setChunkSize] = useState<number>(song.chunkSize || 4);
  const isAlreadyCompacted = Boolean(song.body && song.body.trim().length > 0);

  // Default view: OPEN for a brand new uncompacted song, CLOSED if the song has already been compacted
  const [showCompactorPane, setShowCompactorPane] = useState<boolean>(
    isNew && !isAlreadyCompacted
  );

  useEffect(() => {
    const alreadyHasBody = Boolean(song.body && song.body.trim().length > 0);
    setShowCompactorPane(isNew && !alreadyHasBody);
  }, [song.id, isNew]);

  const [compactorOptions, setCompactorOptions] = useState<CompactorOptions>(
    DEFAULT_COMPACTOR_OPTIONS
  );

  // In landscape mode, collapse the Syntax cheat-sheet section by default
  const [isSyntaxCollapsed, setIsSyntaxCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.innerWidth > window.innerHeight && window.innerWidth >= 720
      : true
  );

  useEffect(() => {
    const handleOrientationResize = () => {
      const landscape =
        window.innerWidth > window.innerHeight && window.innerWidth >= 720;
      setIsSyntaxCollapsed(landscape);
    };
    window.addEventListener('orientationchange', handleOrientationResize);
    return () =>
      window.removeEventListener('orientationchange', handleOrientationResize);
  }, []);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [pendingCompactorRun, setPendingCompactorRun] = useState<{
    sourceText: string;
    opts: CompactorOptions;
    scrapedTitle?: string;
  } | null>(null);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [urlScrapeError, setUrlScrapeError] = useState<string | null>(null);

  const combinedBody = useMemo(
    () => combinePreambleAndBody(description, sectionsBody),
    [description, sectionsBody]
  );

  const hasUnsavedChanges = useMemo(() => {
    const initialCombined = combinePreambleAndBody(
      initialSplit.description,
      initialSplit.sectionsBody
    );
    return (
      shortName.trim() !== song.shortName.trim() ||
      combinedBody.trim() !== initialCombined.trim() ||
      rawSource.trim() !== (song.rawSource || '').trim() ||
      chunkSize !== (song.chunkSize || 4)
    );
  }, [
    shortName,
    song.shortName,
    combinedBody,
    initialSplit,
    rawSource,
    song.rawSource,
    chunkSize,
    song.chunkSize,
  ]);

  const requestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setIsDiscardConfirmOpen(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isUrlModalOpen) {
          if (!isScrapingUrl) {
            setIsUrlModalOpen(false);
            setUrlScrapeError(null);
          }
          return;
        }
        if (pendingCompactorRun) {
          setPendingCompactorRun(null);
          return;
        }
        if (isDeleteConfirmOpen) {
          setIsDeleteConfirmOpen(false);
          return;
        }
        if (isDiscardConfirmOpen) {
          setIsDiscardConfirmOpen(false);
          return;
        }
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isUrlModalOpen,
    isScrapingUrl,
    pendingCompactorRun,
    isDeleteConfirmOpen,
    isDiscardConfirmOpen,
    requestClose,
  ]);

  const parsedPreview = useMemo(
    () => parseSongBody(combinedBody, chunkSize),
    [combinedBody, chunkSize]
  );

  const uniqueSectionCount = useMemo(
    () =>
      parsedPreview.sections.filter((s) => s.isRepeatOfSectionIndex === null)
        .length,
    [parsedPreview]
  );

  const compactionLineStats = useMemo(() => {
    const countNonEmptyLines = (text: string) =>
      text
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0).length;

    const afterLines = countNonEmptyLines(sectionsBody);
    const beforeLines = rawSource.trim()
      ? countNonEmptyLines(rawSource)
      : afterLines;

    return { beforeLines, afterLines };
  }, [rawSource, sectionsBody]);

  const hasExistingUserTabContent = useMemo(
    () => sectionsBody.trim().length > 0 || description.trim().length > 0,
    [sectionsBody, description]
  );

  const executeCompactor = (
    sourceText: string,
    opts: CompactorOptions,
    scrapedTitle?: string
  ) => {
    if (!sourceText.trim()) return;
    const detectedCapo = extractCapoLabel(sourceText);

    // Determine base shorthand name from scrapedTitle or first line of sourceText if still "New Song" / empty
    let nextShortName = shortName.trim();
    if (
      scrapedTitle &&
      (!nextShortName || nextShortName === 'New Song')
    ) {
      nextShortName = scrapedTitle;
    } else if (!nextShortName || nextShortName === 'New Song') {
      const firstLine = sourceText
        .replace(/\r\n/g, '\n')
        .split('\n')[0]
        ?.trim();
      if (
        firstLine &&
        !firstLine.startsWith('[') &&
        !/^\d+\./.test(firstLine)
      ) {
        const candidateTitle = firstLine.split(/\s*[-–—]\s*/)[0]?.trim();
        if (candidateTitle && candidateTitle.length <= 36) {
          nextShortName = candidateTitle;
        }
      }
    }

    if (detectedCapo && nextShortName) {
      nextShortName = appendCapoToShortName(nextShortName, detectedCapo);
    }

    if (nextShortName && nextShortName !== shortName) {
      setShortName(nextShortName);
    }

    const compacted = compactChordSheet(sourceText, opts);
    const split = splitPreambleAndBody(compacted);
    if (split.description) {
      setDescription(split.description);
    }
    setSectionsBody(split.sectionsBody);
  };

  const requestRunCompactor = (
    sourceText = rawSource,
    opts = compactorOptions,
    scrapedTitle?: string
  ) => {
    if (!sourceText.trim()) return;
    // If there is already content in the user/compacted chords, warn before overwriting custom tabs!
    if (hasExistingUserTabContent) {
      setPendingCompactorRun({ sourceText, opts, scrapedTitle });
      return;
    }
    executeCompactor(sourceText, opts, scrapedTitle);
  };

  const handleScrapeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || isScrapingUrl) return;
    setIsScrapingUrl(true);
    setUrlScrapeError(null);
    try {
      const scraped = await fetchChordSheetFromUrl(urlInput);
      setRawSource(scraped.rawText);
      setIsUrlModalOpen(false);
      setUrlInput('');
      requestRunCompactor(scraped.rawText, compactorOptions, scraped.songTitle);
    } catch (err) {
      setUrlScrapeError(
        err instanceof Error
          ? err.message
          : 'Could not fetch chords from that URL.'
      );
    } finally {
      setIsScrapingUrl(false);
    }
  };

  const handleToggleSimplify = () => {
    const nextSimplify = !compactorOptions.simplifyVoicings;
    const next: CompactorOptions = {
      ...compactorOptions,
      simplifyVoicings: nextSimplify,
      stripDominant7: true,
      suppressConsecutiveDuplicateChords: true,
      collapseRepeatedSections: true,
    };
    setCompactorOptions(next);
    if (rawSource.trim()) {
      requestRunCompactor(rawSource, next);
    }
  };

  const handleToggleSimplifyInlineTabs = () => {
    const nextSimplifyTabs = !Boolean(compactorOptions.simplifyInlineTabs);
    const next: CompactorOptions = {
      ...compactorOptions,
      simplifyInlineTabs: nextSimplifyTabs,
    };
    setCompactorOptions(next);
    if (rawSource.trim()) {
      requestRunCompactor(rawSource, next);
    }
  };

  const handleToggleSilencePreamble = () => {
    const nextSilence = compactorOptions.silencePreambleAndVoicings === false;
    const next: CompactorOptions = {
      ...compactorOptions,
      silencePreambleAndVoicings: nextSilence,
    };
    setCompactorOptions(next);
    if (rawSource.trim()) {
      requestRunCompactor(rawSource, next);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = shortName.trim() || 'Untitled';
    onSave({
      ...song,
      shortName: finalName,
      body: combinedBody,
      rawSource: rawSource.trim() ? rawSource : undefined,
      chunkSize: Math.max(1, chunkSize || 4),
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 overscroll-contain">
      <div className="bg-stone-900 border border-stone-700/80 rounded-2xl w-full max-w-6xl h-[94vh] sm:h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Top Modal Header */}
        <div className="shrink-0 px-3.5 py-3 sm:px-5 sm:py-3.5 border-b border-stone-800 bg-stone-900/95 flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
          {/* Top Bar on Mobile/Portrait (Actions + Compactor Toggle) / Right Side on Desktop */}
          <div className="flex items-center justify-between gap-2 lg:order-2">
            <button
              type="button"
              onClick={() => setShowCompactorPane(!showCompactorPane)}
              className={`lg:hidden h-8 sm:h-9 px-3 sm:px-3.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                showCompactorPane
                  ? 'bg-amber-400/20 hover:bg-amber-400/25 text-amber-300'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Compactor</span>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              {!isNew && onDelete && (
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  title="Delete song"
                  aria-label={`Delete ${song.shortName}`}
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-800/60 transition cursor-pointer flex items-center justify-center mr-0.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={requestClose}
                className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-lg text-xs sm:text-sm font-medium bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer flex items-center gap-1 shrink-0"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="h-8 sm:h-9 px-3.5 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold btn-primary shadow-md shadow-amber-500/10 transition cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Save Song</span>
              </button>
            </div>
          </div>

          {/* Song Metadata Fields (2-column grid on mobile/portrait, inline row on desktop) */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2.5 sm:gap-4 lg:order-1">
            <div className="min-w-0">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1 truncate">
                Playlist Shorthand Name
              </label>
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. Rotterdam"
                className="h-8 sm:h-9 w-full sm:w-56 bg-stone-950 border border-stone-700 focus:border-amber-400 rounded-lg px-3 text-sm font-semibold text-stone-100 focus:outline-none"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1 truncate">
                🧠 Chunk Size (Lines)
              </label>
              <select
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="h-8 sm:h-9 w-full sm:w-auto bg-stone-950 border border-stone-700 focus:border-amber-400 rounded-lg px-2.5 text-xs sm:text-sm font-mono text-stone-200 focus:outline-none cursor-pointer"
              >
                <option value={1}>1 line / chunk</option>
                <option value={2}>2 lines / chunk</option>
                <option value={3}>3 lines / chunk</option>
                <option value={4}>4 lines / chunk (Default)</option>
                <option value={6}>6 lines / chunk</option>
                <option value={8}>8 lines / chunk</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowCompactorPane(!showCompactorPane)}
              className={`hidden lg:flex h-8 sm:h-9 px-3.5 rounded-lg text-xs sm:text-sm font-medium items-center gap-1.5 transition cursor-pointer ${
                showCompactorPane
                  ? 'bg-amber-400/20 hover:bg-amber-400/25 text-amber-300'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Compactor</span>
            </button>
          </div>
        </div>

        {/* Main Split or Single Editor Area (Scrollable container in portrait/single-col, side-by-side split on lg) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain lg:overflow-hidden flex flex-col lg:grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-stone-800">
          {/* Left Pane: Smart Ultimate Guitar Compactor */}
          {showCompactorPane && (
            <div className="shrink-0 lg:shrink lg:col-span-5 flex flex-col lg:min-h-0 bg-stone-950/60 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-amber-300">
                  <Wand2 className="w-3.5 h-3.5 shrink-0" />
                  <span>RAW CHORDS (Ultimate Guitar, etc)</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setUrlScrapeError(null);
                      setIsUrlModalOpen(true);
                    }}
                    className="h-[26px] min-w-[78px] text-[11px] font-normal px-2.5 py-1 rounded-md bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-stone-200 border border-stone-700/70 flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap"
                  >
                    <Globe className="w-3 h-3 text-amber-300/80 shrink-0" />
                    <span>Add URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const demoWithHeader = RAW_SHALLOW_UG_SAMPLE;
                      setRawSource(demoWithHeader);
                      requestRunCompactor(demoWithHeader, compactorOptions);
                    }}
                    className="h-[26px] min-w-[78px] text-[11px] font-normal px-2.5 py-1 rounded-md bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-stone-200 border border-stone-700/70 flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap"
                  >
                    <span>Load Demo</span>
                  </button>
                </div>
              </div>

              {/* Warning Banner when User / Compacted Chords already have content */}
              {hasExistingUserTabContent && (
                <div className="mb-2.5 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[11px] leading-snug flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-semibold text-amber-300">
                      Custom tab protection:
                    </strong>{' '}
                    Edits to your compacted tab take precedence. Activating{' '}
                    <strong>Compact</strong> will overwrite your custom tabs.
                  </span>
                </div>
              )}

              {/* Compactor Rule Toggles */}
              <div className="mb-2.5 px-3 py-2 rounded-xl bg-stone-900/90 border border-stone-800 text-xs text-stone-300 flex flex-col gap-1.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={compactorOptions.simplifyVoicings}
                    onChange={handleToggleSimplify}
                    className="accent-amber-400 rounded w-3.5 h-3.5 shrink-0"
                  />
                  <span>
                    Simplify chords{' '}
                    <span className="text-stone-400 font-mono text-[11px]">
                      (only major, minor, and diminished chords.)
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(compactorOptions.simplifyInlineTabs)}
                    onChange={handleToggleSimplifyInlineTabs}
                    className="accent-amber-400 rounded w-3.5 h-3.5 shrink-0"
                  />
                  <span>
                    Simplify in-song TABs to chord loops{' '}
                    <span className="text-stone-400 font-mono text-[11px]">
                      (otherwise lock TAB blocks in &#123; ... &#125;.)
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={compactorOptions.silencePreambleAndVoicings !== false}
                    onChange={handleToggleSilencePreamble}
                    className="accent-amber-400 rounded w-3.5 h-3.5 shrink-0"
                  />
                  <span>
                    Silence preamble &amp; chord diagrams{' '}
                    <span className="text-stone-400 font-mono text-[11px]">
                      (wrap tuning/voicings in (( ... )) during practice.)
                    </span>
                  </span>
                </label>
              </div>

              <textarea
                value={rawSource}
                onChange={(e) => setRawSource(e.target.value)}
                placeholder={`Paste raw Ultimate Guitar chords & lyrics here (or click Add URL)...\n\nExample:\nSong Title - Artist\n\n[Verse 1]\n        C            Fmaj7\nAnd the women tug their hair\n            Cmaj7      Fmaj7\nLike they're trying to prove it won't fall out...`}
                className="min-h-[170px] sm:min-h-[200px] lg:min-h-0 lg:flex-1 w-full bg-stone-950 border border-stone-800 focus:border-amber-400/60 rounded-xl p-3 font-mono text-xs sm:text-sm text-stone-300 leading-relaxed resize-y lg:resize-none focus:outline-none"
                spellCheck={false}
              />

              {/* Right-justified Compact Action Button below textarea */}
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => requestRunCompactor()}
                  disabled={!rawSource.trim()}
                  className="text-xs px-3.5 py-1.5 rounded-lg btn-primary disabled:opacity-40 font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Compact</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* Right Pane: By Heart Monospaced Notation Editor (Split into 1-line Description + Main Body) */}
          <div
            className={`${
              showCompactorPane ? 'lg:col-span-7' : 'lg:col-span-12'
            } shrink-0 lg:shrink flex flex-col lg:min-h-0 p-3.5 sm:p-4 bg-stone-900`}
          >
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-amber-300 mb-2">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>By Heart Monospaced Notation (Review &amp; Edit)</span>
            </div>

            {/* Centered Green Diagnostic Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-2.5">
              <span className="px-3 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono">
                {uniqueSectionCount} unique section
                {uniqueSectionCount === 1 ? '' : 's'} detected
              </span>
              <span className="px-3 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono">
                {compactionLineStats.beforeLines} lines =&gt;{' '}
                {compactionLineStats.afterLines}
              </span>
            </div>

            {/* 1-Line Form for Title / Description (Line 1 of stored song.body) */}
            <div className="mb-2.5">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="TITLE OR DESCRIPTION (e.g. Full Song Title - Artist, shown underneath song name in playlist)"
                className="w-full bg-stone-950 border border-stone-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2 font-mono text-xs sm:text-sm text-stone-200 placeholder:text-stone-600 focus:outline-none"
                spellCheck={false}
              />
            </div>

            {/* Larger Form for Song Sections & Lyrics Body (Line 3+ of stored song.body; extended by +30% in portrait mode) */}
            <textarea
              value={sectionsBody}
              onChange={(e) => setSectionsBody(e.target.value)}
              placeholder={`1. Verse 1\n[ C - F ]\nAnd the women tug their hair\nLike they're trying to prove it won't fall out\nAnd all the men are gargoyles\nDipped long in Irish stout\n\n2. Pre-Chorus\n   G\nThe whole place is pickled...`}
              className="min-h-[340px] sm:min-h-[420px] lg:min-h-0 flex-1 w-full bg-stone-950 border border-stone-700/80 focus:border-amber-400 rounded-xl p-3.5 sm:p-4 font-mono text-sm sm:text-base text-stone-100 leading-relaxed resize-y lg:resize-none focus:outline-none"
              spellCheck={false}
            />

            {/* Notation Syntax Cheat-Sheet Footer (Collapsible; collapsed by default in landscape mode) */}
            <div className="mt-2.5 rounded-xl bg-stone-950/80 border border-stone-800/80 text-[11px] text-stone-400 overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setIsSyntaxCollapsed((prev) => !prev)}
                className="w-full px-3.5 py-2 flex items-center justify-between text-stone-300 font-semibold hover:bg-stone-900/60 transition cursor-pointer"
                aria-expanded={!isSyntaxCollapsed}
              >
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Syntax</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-150 ${
                    !isSyntaxCollapsed ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {!isSyntaxCollapsed && (
                <ul className="space-y-1 px-3.5 pb-2.5 pl-4 pt-2 border-t border-stone-800/60 leading-relaxed">
                  <li>
                    • <code className="text-amber-300">1. Verse 1</code>: Create
                    section headers with a number.
                  </li>
                  <li>
                    • <code className="text-emerald-300">2. Chorus (empty body)</code>: A
                    repeat label with no body repeats the previous section with
                    the same label.
                  </li>
                  <li>
                    • <code className="text-amber-300">[ C - F ]</code>: Create a
                    repeating chord loop for that section and every subsequent
                    section until you create a new chord loop.
                  </li>
                  <li>
                    • <code className="text-sky-300">G... E...</code>: Add chords
                    above lyrics in a new line if the pattern changes (does not
                    override Repeating Chord Loops).
                  </li>
                  <li>
                    • Click{' '}
                    <strong className="text-stone-200">&quot;Load Demo&quot;</strong>{' '}
                    in the Raw Chords section to see an example song.
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Compactor Overwrite Warning Modal */}
        {pendingCompactorRun && (
          <div
            onClick={() => setPendingCompactorRun(null)}
            className="absolute inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-stone-900 border border-stone-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-stone-100 mb-1">
                Overwrite custom tabs?
              </h3>
              <p className="text-xs sm:text-sm text-stone-400 mb-5 leading-relaxed">
                There is already content in your compacted chords editor.
                Activating the Compactor will overwrite your current custom tabs
                and edits.
              </p>
              <div className="flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPendingCompactorRun(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 transition cursor-pointer"
                >
                  Keep Custom Tabs
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { sourceText, opts, scrapedTitle } =
                      pendingCompactorRun;
                    setPendingCompactorRun(null);
                    executeCompactor(sourceText, opts, scrapedTitle);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition cursor-pointer"
                >
                  Overwrite Tabs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add URL Scraper Popup Modal */}
        {isUrlModalOpen && (
          <div
            onClick={() => {
              if (!isScrapingUrl) {
                setIsUrlModalOpen(false);
                setUrlScrapeError(null);
              }
            }}
            className="absolute inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <form
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleScrapeUrl}
              className="bg-stone-900 border border-stone-700 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-stone-800">
                <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-stone-100">
                  <Globe className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>Import Chords from URL</span>
                </div>
                <button
                  type="button"
                  disabled={isScrapingUrl}
                  onClick={() => {
                    setIsUrlModalOpen(false);
                    setUrlScrapeError(null);
                  }}
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer disabled:opacity-40"
                  aria-label="Close URL modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-stone-400 mb-3 leading-relaxed">
                Paste a link to an Ultimate Guitar (or other chord sheet) page.
                We&apos;ll extract the song title, artist, and raw chords into
                the input box.
              </p>

              <input
                type="url"
                value={urlInput}
                autoFocus
                disabled={isScrapingUrl}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (urlScrapeError) setUrlScrapeError(null);
                }}
                placeholder="https://tabs.ultimate-guitar.com/tab/..."
                className="w-full bg-stone-950 border border-stone-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-stone-100 placeholder:text-stone-600 focus:outline-none mb-3"
              />

              {urlScrapeError && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs leading-snug">
                  {urlScrapeError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isScrapingUrl}
                  onClick={() => {
                    setIsUrlModalOpen(false);
                    setUrlScrapeError(null);
                  }}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!urlInput.trim() || isScrapingUrl}
                  className="px-4 py-2 rounded-lg text-xs font-semibold btn-primary disabled:opacity-40 flex items-center gap-1.5 transition cursor-pointer"
                >
                  {isScrapingUrl ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Fetching Chords...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>Fetch Chords</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteConfirmOpen && onDelete && (
          <div
            onClick={() => setIsDeleteConfirmOpen(false)}
            className="absolute inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-stone-900 border border-stone-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-stone-100 mb-1">
                Delete “{song.shortName}”?
              </h3>
              <p className="text-xs sm:text-sm text-stone-400 mb-5">
                This will permanently remove this song from your repertoire
                playlist.
              </p>
              <div className="flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    onDelete(song.id);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition cursor-pointer"
                >
                  Delete Song
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unsaved Changes Confirmation Modal (on Esc / Cancel) */}
        {isDiscardConfirmOpen && (
          <div
            onClick={() => setIsDiscardConfirmOpen(false)}
            className="absolute inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-stone-900 border border-stone-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-stone-100 mb-1">
                Discard unsaved changes?
              </h3>
              <p className="text-xs sm:text-sm text-stone-400 mb-5">
                You have unsaved edits to{' '}
                <strong className="text-stone-200">
                  {shortName || song.shortName}
                </strong>
                . Are you sure you want to leave without saving?
              </p>
              <div className="flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDiscardConfirmOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 transition cursor-pointer"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDiscardConfirmOpen(false);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition cursor-pointer"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
