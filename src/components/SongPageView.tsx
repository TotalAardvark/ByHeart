import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Printer,
  Pencil,
  ChevronDown,
  Link2,
  AlignLeft,
  Layers,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import { SongItem, PracticeMode } from '../types';
import { parseSongBody } from '../lib/parser';
import { ChunkSizePopover } from './ChunkSizePopover';
import { PrintPreviewModal } from './PrintPreviewModal';
import { usePopoverPosition } from '../lib/usePopoverPosition';

interface SongPageViewProps {
  song: SongItem;
  onExit: () => void;
  onEditSong: () => void;
  onChangeMode: (mode: PracticeMode) => void;
  onChangeChunkSize?: (newChunkSize: number) => void;
}

export const SongPageView: React.FC<SongPageViewProps> = ({
  song,
  onExit,
  onEditSong,
  onChangeMode,
  onChangeChunkSize,
}) => {
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isChunkPopoverOpen, setIsChunkPopoverOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const chunkButtonRef = useRef<HTMLButtonElement>(null);
  const modeButtonRef = useRef<HTMLButtonElement>(null);

  const chunkStyle = usePopoverPosition(isChunkPopoverOpen, chunkButtonRef, {
    popoverWidth: 320,
  });
  const modeStyle = usePopoverPosition(isModeDropdownOpen, modeButtonRef, {
    popoverWidth: 224,
  });

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setIsModeDropdownOpen(false);
        setIsChunkPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModeDropdownOpen(false);
        setIsChunkPopoverOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const parsed = useMemo(() => {
    return parseSongBody(song.body, song.chunkSize);
  }, [song.body, song.chunkSize]);

  const rawLines = useMemo(() => {
    return song.body.replace(/\r\n/g, '\n').split('\n');
  }, [song.body]);

  const handlePrint = () => {
    setIsPrintPreviewOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100 print:bg-white print:text-black">
      {/* Top Navigation Bar - Hidden on print */}
      <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur border-b border-stone-800 px-4 py-2.5 flex items-center justify-between gap-3 shadow-md print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer shrink-0"
            title="Back to Playlist"
            aria-label="Back to Playlist"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-stone-100 truncate flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{song.shortName}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 font-normal">
                Page View
              </span>
            </h1>
            {parsed.preambleLines.length > 0 && (
              <p className="text-xs text-stone-400 truncate">
                {parsed.preambleLines[0]}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div ref={menuContainerRef} className="flex items-center gap-2 shrink-0">
          {/* Chunk Size Popover Button */}
          {onChangeChunkSize && (
            <div className="relative">
              <button
                ref={chunkButtonRef}
                type="button"
                onClick={() => {
                  setIsModeDropdownOpen(false);
                  setIsChunkPopoverOpen((prev) => !prev);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-stone-700 bg-stone-800/80 hover:bg-stone-800 text-stone-200 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                title="Change chunk size"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>{song.chunkSize}L Chunks</span>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              {isChunkPopoverOpen && (
                <div style={chunkStyle} className="fixed z-50">
                  <ChunkSizePopover
                    songTitle={song.shortName}
                    songBody={song.body}
                    chunkSize={song.chunkSize}
                    onChange={(newSize) => {
                      onChangeChunkSize(newSize);
                    }}
                    onClose={() => setIsChunkPopoverOpen(false)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Mode Switcher Dropdown */}
          <div className="relative">
            <button
              ref={modeButtonRef}
              type="button"
              onClick={() => {
                setIsChunkPopoverOpen(false);
                setIsModeDropdownOpen((prev) => !prev);
              }}
              className="px-3 py-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 text-amber-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer hover:bg-amber-400/20"
              title="Switch Mode"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Page View</span>
              <ChevronDown className="w-3 h-3 opacity-75" />
            </button>

            {isModeDropdownOpen && (
              <div
                style={modeStyle}
                className="fixed w-56 rounded-xl bg-stone-900 border border-stone-700 shadow-2xl py-1.5 z-50"
              >
                <div className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-stone-400 border-b border-stone-800">
                  Switch Mode
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onChangeMode('chain');
                    setIsModeDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-stone-800 text-stone-200 text-xs font-medium cursor-pointer"
                >
                  <Link2 className="w-4 h-4 text-stone-400" />
                  <span>Chain & Loop</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeMode('scaffold');
                    setIsModeDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-stone-800 text-stone-200 text-xs font-medium cursor-pointer"
                >
                  <AlignLeft className="w-4 h-4 text-stone-400" />
                  <span>Word Scaffold</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeMode('flashcards');
                    setIsModeDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-stone-800 text-stone-200 text-xs font-medium cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-stone-400" />
                  <span>Flashcards</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeMode('page');
                    setIsModeDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 bg-stone-800/80 text-amber-300 text-xs font-medium cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Page View (Active)</span>
                </button>

                {/* Print Action inside Settings */}
                <div className="mt-1.5 pt-1.5 border-t border-stone-800 px-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModeDropdownOpen(false);
                      handlePrint();
                    }}
                    className="w-full p-2 rounded-lg border border-stone-800 hover:border-stone-700 bg-stone-950/60 hover:bg-stone-800 text-stone-300 hover:text-stone-100 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-300" />
                    <span>Print Song Sheet</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Direct Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-1.5 rounded-lg border border-stone-700 bg-stone-800 text-stone-300 hover:text-stone-100 transition cursor-pointer"
            title="Print Song Sheet"
            aria-label="Print Song Sheet"
          >
            <Printer className="w-4 h-4 text-amber-400" />
          </button>

          {/* Edit Song */}
          <button
            type="button"
            onClick={onEditSong}
            className="p-1.5 rounded-lg border border-stone-700 bg-stone-800 text-stone-300 hover:text-stone-100 transition cursor-pointer"
            title="Edit Song"
            aria-label="Edit Song"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Printable / Scrollable Stage View */}
      <main className="flex-1 flex justify-center p-3 sm:p-6 print:p-0">
        <div
          className="w-full max-w-4xl bg-stone-900 border border-stone-800 rounded-2xl shadow-xl overflow-hidden flex flex-col print:border-none print:shadow-none print:bg-white print:max-w-none print:rounded-none"
        >
          {/* Sheet Header */}
          <div className="px-6 py-4 border-b border-stone-800 bg-stone-900/80 flex items-center justify-between print:border-b-2 print:border-black print:px-0 print:py-2">
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-mono tracking-tight text-stone-100 print:text-black">
                {song.shortName}
              </h2>
              {parsed.preambleLines.length > 0 && (
                <p className="text-xs font-mono text-stone-400 print:text-stone-600 mt-0.5">
                  {parsed.preambleLines.join(' • ')}
                </p>
              )}
            </div>
            <div className="text-right text-xs font-mono text-stone-400 print:text-stone-600">
              <span>{parsed.sections.length} sections</span> •{' '}
              <span>{song.chunkSize}L chunks</span>
            </div>
          </div>

          {/* Scrollable Document Container with Gutter (Matching RefineChunkModal style) */}
          <div className="flex-1 overflow-x-auto overflow-y-auto p-4 sm:p-6 font-mono text-sm leading-6 print:overflow-visible print:p-0">
            <div className="min-w-full inline-block">
              {rawLines.map((line, idx) => {
                const lineNum = idx + 1;
                const isSectionHeader = /^\s*\d+\.\s+/.test(line);
                const isBracketProgression = /^\s*\[.*\]\s*$/.test(line);

                return (
                  <div
                    key={idx}
                    className={`flex items-start transition-colors print-break-inside-avoid ${
                      isSectionHeader
                        ? 'font-bold text-amber-300 mt-4 mb-1 print:text-black print:mt-3'
                        : isBracketProgression
                        ? 'text-amber-400/90 font-semibold print:text-stone-800'
                        : 'text-stone-200 print:text-black'
                    }`}
                  >
                    {/* Gutter / Line Number */}
                    <div className="w-10 sm:w-12 shrink-0 select-none text-right pr-4 text-stone-500 text-xs print:text-stone-400 print:w-8 print:pr-2">
                      {line.trim() ? lineNum : ''}
                    </div>

                    {/* Content */}
                    <div className="whitespace-pre flex-1 font-mono">
                      {line || '\u00A0'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Print Preview Modal */}
      <PrintPreviewModal
        song={song}
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
      />
    </div>
  );
};
