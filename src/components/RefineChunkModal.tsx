import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  X,
  Save,
  Wand2,
  AlertTriangle,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { SongItem, ParsedPart, ChainingGranularity } from '../types';
import { parseSongBody } from '../lib/parser';

interface RefineChunkModalProps {
  song: SongItem;
  targetPart: ParsedPart;
  granularity?: ChainingGranularity;
  onSave: (updated: SongItem) => void;
  onOpenFullEditor: () => void;
  onClose: () => void;
}

export const RefineChunkModal: React.FC<RefineChunkModalProps> = ({
  song,
  targetPart,
  granularity = 'chunk',
  onSave,
  onOpenFullEditor,
  onClose,
}) => {
  const [body, setBody] = useState<string>(song.body);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const isDirty = body !== song.body;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Split lines for line numbers and layout measurement
  const lines = useMemo(() => {
    return body.replace(/\r\n/g, '\n').split('\n');
  }, [body]);

  // Compute max character length across all lines so unwrapped text / ASCII TABs expand horizontally without clipping
  const maxLineChars = useMemo(() => {
    let max = 40;
    for (const line of lines) {
      if (line.length > max) max = line.length;
    }
    return max;
  }, [lines]);

  // Dynamically track the target chunk's or section's start and end line ranges as user edits
  const parsed = useMemo(() => {
    return parseSongBody(body, song.chunkSize);
  }, [body, song.chunkSize]);

  const activeChunkRange = useMemo(() => {
    // When refining in Sections mode (or a whole-section part), match against parsed.sectionParts
    if (granularity === 'section' || targetPart.totalChunksInSection === 1) {
      const matchingSection = parsed.sectionParts.find(
        (p) => p.sectionIndex === targetPart.sectionIndex
      );
      if (matchingSection && matchingSection.rawStartLine !== undefined) {
        return {
          startLine: matchingSection.rawStartLine,
          endLine: matchingSection.rawEndLine ?? matchingSection.rawStartLine,
        };
      }
    }

    // Attempt to locate the exact same section and chunk in the parsed tree
    const matching = parsed.chunkParts.find(
      (p) =>
        p.sectionIndex === targetPart.sectionIndex &&
        p.chunkIndexInSection === targetPart.chunkIndexInSection
    );
    if (matching && matching.rawStartLine !== undefined) {
      return {
        startLine: matching.rawStartLine,
        endLine: matching.rawEndLine ?? matching.rawStartLine,
      };
    }
    // Fallback to targetPart line indices
    return {
      startLine: targetPart.rawStartLine ?? 0,
      endLine: targetPart.rawEndLine ?? targetPart.rawStartLine ?? 0,
    };
  }, [parsed, targetPart, granularity]);

  // Center scroll on the target chunk on initial modal mount
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Line height is 24px (leading-6), top padding is 16px (py-4)
    const lineHeight = 24;
    const paddingOffset = 16;
    const midLine = (activeChunkRange.startLine + activeChunkRange.endLine) / 2;
    const chunkCenterPx = midLine * lineHeight + paddingOffset;
    const targetScroll = Math.max(0, chunkCenterPx - el.clientHeight / 2);

    el.scrollTop = targetScroll;
  }, []);

  const handleSave = useCallback(() => {
    onSave({
      ...song,
      body,
      updatedAt: Date.now(),
    });
  }, [onSave, song, body]);

  const handleAttemptClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Keyboard shortcuts (Cmd/Ctrl+Enter = Save, Escape = Close/Discard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
          return;
        }
        handleAttemptClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleAttemptClose, showDiscardConfirm]);

  // Jump to repeated source section if this chunk is a repeat reference
  const handleScrollToRepeatSource = () => {
    if (targetPart.isRepeatOfSectionIndex === null) return;
    const sourceSection = parsed.sections[targetPart.isRepeatOfSectionIndex];
    if (sourceSection && sourceSection.rawStartLine !== undefined) {
      const el = scrollContainerRef.current;
      if (!el) return;
      const targetScroll = Math.max(
        0,
        sourceSection.rawStartLine * 24 + 16 - 60
      );
      el.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-stone-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-stone-900 border border-stone-700/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800 bg-stone-900/95">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base sm:text-lg font-bold text-stone-100 truncate">
              Refine Chunk
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40 truncate">
              {targetPart.title}
            </span>
            {isDirty && (
              <span className="text-xs text-amber-400/80 font-medium hidden sm:inline">
                (unsaved edits)
              </span>
            )}
          </div>
          <button
            onClick={handleAttemptClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational repeat banner if applicable */}
        {targetPart.isRepeatOfSectionIndex !== null && (
          <div className="flex items-center justify-between px-5 py-2 bg-stone-950/60 border-b border-stone-800/80 text-xs text-stone-300">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                This chunk repeats{' '}
                <strong className="text-amber-300">
                  {targetPart.repeatOfSectionHeader}
                </strong>
                .
              </span>
            </span>
            <button
              onClick={handleScrollToRepeatSource}
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold underline cursor-pointer"
            >
              Scroll to source
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Editor Container (Gutter + Highlight Overlay + Textarea) */}
        <div
          ref={scrollContainerRef}
          className="relative flex-1 overflow-auto bg-stone-950 font-mono text-sm leading-6"
        >
          <div className="relative flex min-h-full min-w-full w-max">
            {/* Theme-tinted chunk highlight strip spanning full scrollable content width */}
            <div
              style={{
                top: `${activeChunkRange.startLine * 24 + 16}px`,
                height: `${
                  Math.max(
                    1,
                    activeChunkRange.endLine - activeChunkRange.startLine + 1
                  ) * 24
                }px`,
              }}
              className="absolute inset-x-0 bg-amber-400/12 border-y border-amber-400/30 border-l-4 border-l-amber-400 pointer-events-none transition-all duration-150"
            >
              <div className="sticky right-4 top-2 float-right mr-3 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-400/25 text-amber-300 border border-amber-400/40 select-none shadow-sm flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Current Chunk
              </div>
            </div>

            {/* Gutter with line numbers */}
            <div className="select-none py-4 px-3 text-right text-stone-600 bg-stone-950/90 border-r border-stone-800/80 sticky left-0 z-10 font-mono text-xs leading-6 min-w-[3rem]">
              {lines.map((_, i) => {
                const isActive =
                  i >= activeChunkRange.startLine &&
                  i <= activeChunkRange.endLine;
                return (
                  <div
                    key={i}
                    className={
                      isActive
                        ? 'text-amber-400 font-bold transition-colors'
                        : 'text-stone-600 transition-colors'
                    }
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>

            {/* Monospaced Editable Textarea */}
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
              wrap="off"
              className="flex-1 py-4 px-4 bg-transparent text-stone-100 font-mono text-sm leading-6 resize-none outline-none overflow-hidden whitespace-pre selection:bg-amber-400/30 selection:text-amber-200"
              style={{
                minHeight: `${Math.max(lines.length * 24 + 48, 280)}px`,
                minWidth: `calc(${maxLineChars}ch + 3rem)`,
              }}
            />
          </div>
        </div>

        {/* Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-stone-800 bg-stone-900/95">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (isDirty) {
                  onSave({
                    ...song,
                    body,
                    updatedAt: Date.now(),
                  });
                }
                onOpenFullEditor();
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-300 hover:text-stone-100 bg-stone-800/80 hover:bg-stone-800 border border-stone-700/80 transition cursor-pointer"
              title="Open full song editor with Ultimate Guitar scraper and compactor tools"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Full Song Editor</span>
            </button>
            <span className="text-[11px] text-stone-500 hidden md:inline">
              ⌘/Ctrl + Enter to save • Esc to cancel
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleAttemptClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save & Keep Practicing</span>
            </button>
          </div>
        </div>
      </div>

      {/* Discard Edits Confirmation Alert */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm">
          <div className="max-w-sm w-full p-6 rounded-2xl bg-stone-900 border border-stone-700 shadow-2xl text-center">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-stone-100 text-base sm:text-lg mb-1">
              Discard unsaved changes?
            </h4>
            <p className="text-xs sm:text-sm text-stone-400 mb-5 leading-relaxed">
              You have unsaved changes in this chunk. Are you sure you want to
              exit without saving?
            </p>
            <div className="flex items-center justify-center gap-2.5">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 transition cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                onClick={() => {
                  setShowDiscardConfirm(false);
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
  );
};
