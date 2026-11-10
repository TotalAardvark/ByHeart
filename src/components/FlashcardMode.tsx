import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Check,
  Repeat,
  CheckCircle2,
  Shuffle,
  Layers,
  Link2,
  AlignLeft,
  FileText,
  ChevronDown,
  Printer,
} from 'lucide-react';
import { ParsedLyricLine, PracticeMode, SongItem } from '../types';
import { parseSongBody } from '../lib/parser';
import { usePopoverPosition } from '../lib/usePopoverPosition';
import { PrintPreviewModal } from './PrintPreviewModal';

interface FlashcardModeProps {
  song: SongItem;
  onExit: () => void;
  onChangeMode?: (mode: PracticeMode) => void;
}

interface SongFlashcard {
  id: string;
  badge: string;
  promptTitle: string;
  precedingCue?: string;
  promptQuestion: string;
  answerProgression?: string;
  answerLines: ParsedLyricLine[];
}

function buildFlashcardsForSong(song: SongItem): SongFlashcard[] {
  const parsed = parseSongBody(song.body, song.chunkSize);
  const cards: SongFlashcard[] = [];

  parsed.chunkParts.forEach((part, idx) => {
    // Skip duplicate repeat sections that have no unique content to test
    if (part.isRepeatOfSectionIndex !== null) {
      return;
    }

    const prevPart = idx > 0 ? parsed.chunkParts[idx - 1] : null;
    const prevIsTabChunk = Boolean(
      prevPart && prevPart.lines.some((l) => l.isTabLine)
    );
    const prevLastLine =
      prevPart && prevPart.lines.length > 0 && !prevIsTabChunk
        ? prevPart.lines[prevPart.lines.length - 1].lyric
        : undefined;

    const isTabChunk = part.lines.some((l) => l.isTabLine);

    const activeProg =
      part.lines[0]?.introducedProgression ||
      part.lines[0]?.activeProgression ||
      part.standaloneProgressions[0];

    // 1. Entry & Chords Card for this Chunk/Section
    cards.push({
      id: `entry-${part.partIndex}`,
      badge: `Entry Trigger • ${part.pillLabel}`,
      promptTitle: part.title,
      precedingCue: prevIsTabChunk
        ? `After: ${prevPart!.title} (Guitar TAB)`
        : prevLastLine
        ? `After: “…${prevLastLine}”`
        : 'Start of Song / Piece',
      promptQuestion: isTabChunk
        ? 'Recall the guitar TAB / chord pattern for this part:'
        : activeProg
        ? 'Recall the chord pattern, turnaround chords & lyrics for this part:'
        : 'Recall the lines for this part:',
      answerProgression: activeProg,
      answerLines: part.lines,
    });

    // 2. If the chunk has >= 3 lyric lines (and is not a guitar TAB block), also create a Couple-Completion / Turnaround card
    //    (Prompting with the opening 1-2 lines and testing the closing lines + turnaround chords)
    if (part.lines.length >= 3 && !isTabChunk) {
      const splitIdx = Math.ceil(part.lines.length / 2);
      const cueLines = part.lines
        .slice(0, splitIdx)
        .map((l) => l.lyric)
        .join(' / ');
      const targetLines = part.lines.slice(splitIdx);

      cards.push({
        id: `turnaround-${part.partIndex}`,
        badge: `Phrase Completion • ${part.pillLabel}`,
        promptTitle: part.title,
        precedingCue: `“${cueLines}…”`,
        promptQuestion:
          'How does this stanza finish (lyrics & any pattern-breaker chords)?',
        answerProgression: activeProg,
        answerLines: targetLines,
      });
    }
  });

  return cards;
}

export const FlashcardMode: React.FC<FlashcardModeProps> = ({
  song,
  onExit,
  onChangeMode,
}) => {
  const initialDeck = useMemo(() => buildFlashcardsForSong(song), [song]);
  const [queue, setQueue] = useState<SongFlashcard[]>(initialDeck);
  const [masteredCount, setMasteredCount] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const modeButtonRef = useRef<HTMLButtonElement>(null);
  const modePopoverStyle = usePopoverPosition(isModeDropdownOpen, modeButtonRef, {
    popoverWidth: 208,
  });

  useEffect(() => {
    setQueue(initialDeck);
    setMasteredCount(0);
    setIsFlipped(false);
  }, [initialDeck]);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-flashcard-mode-dropdown]')) {
        setIsModeDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const currentCard = queue[0] || null;

  const handleGrade = useCallback(
    (gotIt: boolean) => {
      if (!currentCard) return;
      setIsFlipped(false);
      if (gotIt) {
        setMasteredCount((c) => c + 1);
        setQueue((prev) => prev.slice(1));
      } else {
        // Re-queue card at the back of the deck
        setQueue((prev) => [...prev.slice(1), prev[0]]);
      }
    },
    [currentCard]
  );

  const handleShuffle = () => {
    const shuffled = [...initialDeck].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setMasteredCount(0);
    setIsFlipped(false);
  };

  const handleReset = () => {
    setQueue(initialDeck);
    setMasteredCount(0);
    setIsFlipped(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentCard) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!isFlipped) {
          setIsFlipped(true);
        } else {
          handleGrade(true);
        }
      } else if (e.key === 'ArrowRight' || e.key === '2') {
        if (isFlipped) handleGrade(true);
        else setIsFlipped(true);
      } else if (e.key === 'ArrowLeft' || e.key === '1') {
        if (isFlipped) handleGrade(false);
      } else if (e.key === 'Escape') {
        if (isModeDropdownOpen) {
          setIsModeDropdownOpen(false);
          return;
        }
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, isFlipped, isModeDropdownOpen, handleGrade, onExit]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col select-none">
      {/* Header */}
      <header className="border-b border-stone-800/80 bg-stone-900/70 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-800 text-stone-300 hover:text-stone-100 border border-stone-700/60 transition cursor-pointer"
              title="Back to Playlist"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="font-bold text-base text-stone-100 mr-2">
                {song.shortName}
              </span>
              <span className="text-xs font-mono text-sky-300">
                Transition &amp; Entry Flashcards
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-stone-400 mr-1">
              Mastered {masteredCount}/{initialDeck.length}
            </span>
            <button
              onClick={handleShuffle}
              title="Shuffle deck"
              className="p-1.5 rounded-lg bg-stone-800/70 hover:bg-stone-800 text-stone-300 border border-stone-700/60 transition cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              title="Reset deck in song order"
              className="p-1.5 rounded-lg bg-stone-800/70 hover:bg-stone-800 text-stone-300 border border-stone-700/60 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Switch Mode Dropdown */}
            {onChangeMode && (
              <div className="relative" data-flashcard-mode-dropdown>
                <button
                  ref={modeButtonRef}
                  type="button"
                  onClick={() => setIsModeDropdownOpen((prev) => !prev)}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-700 bg-stone-800/80 hover:bg-stone-800 text-stone-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                  title="Switch Practice Mode"
                >
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Cards</span>
                  <ChevronDown className="w-3 h-3 text-stone-400" />
                </button>

                {isModeDropdownOpen && (
                  <div
                    style={modePopoverStyle}
                    className="fixed w-52 rounded-xl bg-stone-900 border border-stone-700 shadow-2xl py-1.5 z-50"
                  >
                    <div className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-stone-400 border-b border-stone-800">
                      Switch Mode
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModeDropdownOpen(false);
                        onChangeMode('chain');
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-stone-800 text-stone-200 text-xs font-medium cursor-pointer"
                    >
                      <Link2 className="w-4 h-4 text-stone-400" />
                      <span>Chain & Loop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModeDropdownOpen(false);
                        onChangeMode('scaffold');
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-stone-800 text-stone-200 text-xs font-medium cursor-pointer"
                    >
                      <AlignLeft className="w-4 h-4 text-stone-400" />
                      <span>Word Scaffold</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModeDropdownOpen(false);
                        onChangeMode('flashcards');
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 bg-stone-800/80 text-sky-300 text-xs font-medium cursor-pointer"
                    >
                      <Layers className="w-4 h-4 text-sky-400" />
                      <span>Flashcards (Active)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModeDropdownOpen(false);
                        onChangeMode('page');
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-stone-800 text-stone-200 text-xs font-medium cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span>Page View / Sheet</span>
                    </button>

                    {/* Print Action inside Settings */}
                    <div className="mt-1.5 pt-1.5 border-t border-stone-800 px-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsModeDropdownOpen(false);
                          setIsPrintPreviewOpen(true);
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
            )}
          </div>
        </div>
      </header>

      {/* Main Flashcard Stage */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center">
        {currentCard ? (
          <div className="w-full">
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden mb-6 border border-stone-800">
              <div
                className="h-full bg-sky-400 transition-all duration-300"
                style={{
                  width: `${
                    initialDeck.length > 0
                      ? (masteredCount / initialDeck.length) * 100
                      : 100
                  }%`,
                }}
              />
            </div>

            {/* Interactive Card */}
            <div
              onClick={() => !isFlipped && setIsFlipped(true)}
              className={`w-full min-h-[340px] rounded-2xl border p-6 sm:p-8 flex flex-col justify-between transition shadow-xl ${
                isFlipped
                  ? 'bg-stone-900 border-stone-700'
                  : 'bg-stone-900/70 hover:bg-stone-900 border-stone-800 hover:border-sky-500/40 cursor-pointer'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-mono font-semibold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    {currentCard.badge}
                  </span>
                  <span className="text-xs font-mono text-stone-500">
                    {queue.length} remaining
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-stone-100 mb-2">
                  {currentCard.promptTitle}
                </h2>

                {currentCard.precedingCue && (
                  <div className="px-3.5 py-2 rounded-xl bg-stone-950/80 border border-stone-800 text-stone-300 font-mono text-sm mb-4">
                    {currentCard.precedingCue}
                  </div>
                )}

                <p className="text-sm text-stone-400">
                  {currentCard.promptQuestion}
                </p>
              </div>

              {/* Answer Area (Revealed on Flip) */}
              {isFlipped ? (
                <div className="mt-6 pt-6 border-t border-stone-800 font-mono space-y-2 animate-slide-next overflow-x-auto">
                  {currentCard.answerLines[0]?.preLineProgressions?.map(
                    (preProg, pIdx) => (
                      <div key={`top-pre-${pIdx}`} className="mb-1.5">
                        <span className="inline-block whitespace-pre px-3 py-1 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-300 font-bold text-base">
                          [ {preProg} ]
                        </span>
                      </div>
                    )
                  )}

                  {currentCard.answerProgression && (
                    <div className="mb-2">
                      {currentCard.answerProgression.includes('|') &&
                      currentCard.answerProgression.length > 34 ? (
                        <span className="inline-flex flex-col whitespace-pre px-3 py-1 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-300 font-bold text-base leading-snug">
                          {currentCard.answerProgression
                            .split('|')
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((sub, i, arr) => (
                              <span key={i}>
                                {i === 0 ? '[ ' : '  '}
                                {sub}
                                {i === arr.length - 1 ? ' ]' : ''}
                              </span>
                            ))}
                        </span>
                      ) : (
                        <span className="inline-block whitespace-pre px-3 py-1 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-300 font-bold text-base">
                          [ {currentCard.answerProgression} ]
                        </span>
                      )}
                    </div>
                  )}

                  {currentCard.answerLines.map((line, lIdx) => {
                    const isTightTabLine =
                      Boolean(line.isTabLine) ||
                      line.lockedChunkGroupId !== undefined;
                    return (
                      <div
                        key={line.globalLineIndex}
                        className={isTightTabLine ? '!mt-0.5' : undefined}
                      >
                        {lIdx > 0 &&
                          line.preLineProgressions &&
                          line.preLineProgressions.map((preProg, pIdx) => (
                            <div key={pIdx} className="mb-1.5">
                              <span className="inline-block whitespace-pre px-3 py-0.5 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-300 font-bold text-base">
                                [ {preProg} ]
                              </span>
                            </div>
                          ))}
                        {line.chordOverLine && (
                          <div className="whitespace-pre text-sky-300 font-bold text-sm sm:text-base leading-none pt-1">
                            {line.chordOverLine}
                          </div>
                        )}
                        <div
                          className={`whitespace-pre text-stone-100 text-base sm:text-lg ${
                            isTightTabLine ? 'leading-tight' : 'leading-snug'
                          }`}
                        >
                          {line.lyric}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-8 pt-6 border-t border-stone-800/60 text-center">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-800 text-stone-200 text-xs font-mono">
                    Tap card or press Space to reveal answer
                  </span>
                </div>
              )}
            </div>

            {/* Grading Controls when Flipped */}
            {isFlipped && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleGrade(false)}
                  className="py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-300 font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Repeat className="w-4 h-4" />
                  <span>Again / Re-queue (1)</span>
                </button>
                <button
                  onClick={() => handleGrade(true)}
                  className="py-3 px-4 rounded-xl btn-secondary font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 transition cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Got It By Heart (Space / 2)</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Deck Completed State */
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-stone-100 mb-1">
              Deck Cleared!
            </h2>
            <p className="text-sm text-stone-400 mb-6">
              You recalled all {initialDeck.length} entry triggers and phrase
              completions for{' '}
              <strong className="text-stone-200">{song.shortName}</strong>.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleShuffle}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 transition cursor-pointer flex items-center gap-1.5"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle &amp; Go Again</span>
              </button>
              <button
                onClick={onExit}
                className="px-4 py-2 rounded-lg text-xs font-semibold btn-primary transition cursor-pointer"
              >
                Back to Playlist
              </button>
            </div>
          </div>
        )}
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
