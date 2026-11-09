import React, {
  useState,
  useMemo,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
} from 'react';
import {
  ArrowLeft,
  Highlighter,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Play,
  Square,
} from 'lucide-react';
import { ParsedSection, SongItem } from '../types';
import { parseSongBody } from '../lib/parser';
import {
  estimateItemCharWidth,
  estimateItemVisualWeight,
  selectOptimalColumnCount,
  splitIntoBalancedColumns,
} from '../lib/layoutUtils';
import { tokenizeTabLineForScaffold } from '../lib/tabAnalyzer';
import {
  getActivePlayingId,
  stopTabPlayback,
  subscribeTabPlayback,
  togglePlayTabLines,
} from '../lib/tabAudioPlayer';

interface ScaffoldModeProps {
  song: SongItem;
  onUpdateScaffold: (
    customHighlights: string[],
    scaffoldEveryNLines: 0 | 2 | 4
  ) => void;
  onExit: () => void;
}

export const ScaffoldMode: React.FC<ScaffoldModeProps> = ({
  song,
  onUpdateScaffold,
  onExit,
}) => {
  const [viewMode, setViewMode] = useState<'practice' | 'edit'>('practice');
  const [everyNLines, setEveryNLines] = useState<0 | 2 | 4>(
    song.scaffoldEveryNLines ?? 2
  );
  const [highlights, setHighlights] = useState<Set<string>>(
    () => new Set(song.customHighlights || [])
  );
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(() =>
    getActivePlayingId()
  );

  useEffect(() => {
    const unsub = subscribeTabPlayback((id) => setPlayingAudioId(id));
    return () => {
      unsub();
      stopTabPlayback();
    };
  }, []);

  // Track click-drag word painting state
  const dragPaintModeRef = useRef<'add' | 'remove' | null>(null);

  const parsed = useMemo(
    () => parseSongBody(song.body, song.chunkSize),
    [song.body, song.chunkSize]
  );

  const commitHighlights = useCallback(
    (nextSet: Set<string>, nextN = everyNLines) => {
      onUpdateScaffold(Array.from(nextSet), nextN);
    },
    [onUpdateScaffold, everyNLines]
  );

  useEffect(() => {
    const handlePointerUpGlobal = () => {
      if (dragPaintModeRef.current !== null) {
        dragPaintModeRef.current = null;
      }
    };
    window.addEventListener('pointerup', handlePointerUpGlobal);
    return () => window.removeEventListener('pointerup', handlePointerUpGlobal);
  }, []);

  const handleWordPointerDown = (
    wordKey: string,
    e: React.PointerEvent<HTMLSpanElement>
  ) => {
    e.preventDefault();
    const isCurrentlyHighlighted = highlights.has(wordKey);
    const mode: 'add' | 'remove' = isCurrentlyHighlighted ? 'remove' : 'add';
    dragPaintModeRef.current = mode;

    setHighlights((prev) => {
      const next = new Set(prev);
      if (mode === 'add') {
        next.add(wordKey);
      } else {
        next.delete(wordKey);
      }
      commitHighlights(next);
      return next;
    });
  };

  const handleWordPointerEnter = (wordKey: string) => {
    const mode = dragPaintModeRef.current;
    if (!mode) return;

    setHighlights((prev) => {
      if (mode === 'add' && prev.has(wordKey)) return prev;
      if (mode === 'remove' && !prev.has(wordKey)) return prev;
      const next = new Set(prev);
      if (mode === 'add') {
        next.add(wordKey);
      } else {
        next.delete(wordKey);
      }
      commitHighlights(next);
      return next;
    });
  };

  const handleChangeEveryN = (val: 0 | 2 | 4) => {
    setEveryNLines(val);
    commitHighlights(highlights, val);
  };

  const handleClearCustomHighlights = () => {
    const empty = new Set<string>();
    setHighlights(empty);
    commitHighlights(empty);
  };

  // Single-Screen Auto-Fit Scaling & Dynamic Multi-Column Landscape Spread Hook
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [columnCount, setColumnCount] = useState(1);
  const evaluatedLayoutKeyRef = useRef<string>('');

  const getSectionWeight = useCallback(
    (sec: ParsedSection) =>
      estimateItemVisualWeight({
        isRepeat: sec.isRepeatOfSectionIndex !== null,
        lines: sec.lines,
        standaloneProgressions: sec.standaloneProgressions,
        showHeader: true,
      }),
    []
  );

  const getSectionCharWidth = useCallback(
    (sec: ParsedSection) => {
      const refHeader =
        sec.isRepeatOfSectionIndex !== null
          ? parsed.sections[sec.isRepeatOfSectionIndex]?.fullHeader
          : undefined;
      return estimateItemCharWidth({
        isRepeat: sec.isRepeatOfSectionIndex !== null,
        lines: sec.lines,
        standaloneProgressions: sec.standaloneProgressions,
        showHeader: true,
        sectionHeader: sec.fullHeader,
        repeatOfSectionHeader: refHeader,
      });
    },
    [parsed.sections]
  );

  const recomputeScale = useCallback(() => {
    const stageEl = stageRef.current;
    const contentEl = contentRef.current;
    if (!stageEl || !contentEl) return;

    const stageW = stageEl.clientWidth;
    const stageH = stageEl.clientHeight;
    const isLandscape = stageW > stageH * 1.1;

    const padX = isLandscape ? 48 : 36;
    const bottomBreathingSpace = Math.max(24, Math.round(stageH * 0.035));
    const padY = 32 + bottomBreathingSpace;

    const availW = Math.max(100, stageW - padX);
    const availH = Math.max(100, stageH - padY);

    const naturalW = Math.max(1, contentEl.offsetWidth);
    const naturalH = Math.max(1, contentEl.offsetHeight);

    if (!isLandscape || parsed.sections.length < 2) {
      evaluatedLayoutKeyRef.current = '';
      if (columnCount !== 1) {
        setColumnCount(1);
        return;
      }
    } else {
      const layoutKey = `${Math.round(availW / 8)}x${Math.round(availH / 8)}:${parsed.sections.length}:${viewMode}:${song.body.length}`;
      if (evaluatedLayoutKeyRef.current !== layoutKey) {
        const optimalCols = selectOptimalColumnCount({
          items: parsed.sections,
          currentColumns: columnCount,
          maxColumns: 4,
          availW,
          availH,
          naturalW,
          naturalH,
          maxScale: 1.05,
          getWeight: getSectionWeight,
          getCharWidth: getSectionCharWidth,
        });
        evaluatedLayoutKeyRef.current = layoutKey;
        if (optimalCols !== columnCount) {
          setColumnCount(optimalCols);
          return;
        }
      }
    }

    const maxScale = columnCount > 1 ? 1.05 : 1.08;
    const rawScale = Math.min(maxScale, availW / naturalW, availH / naturalH);
    setScale(Math.max(0.22, Number(rawScale.toFixed(3))));
  }, [
    columnCount,
    parsed.sections,
    viewMode,
    song.body.length,
    getSectionWeight,
    getSectionCharWidth,
  ]);

  useLayoutEffect(() => {
    recomputeScale();
  }, [recomputeScale, columnCount, song.body, viewMode]);

  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const ro = new ResizeObserver(() => recomputeScale());
    ro.observe(stageEl);
    window.addEventListener('resize', recomputeScale);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recomputeScale);
    };
  }, [recomputeScale]);

  let lastDisplayedProgression: string | undefined = undefined;

  const activeColumns = useMemo(() => {
    if (columnCount <= 1 || parsed.sections.length < 2) {
      return [parsed.sections];
    }
    return splitIntoBalancedColumns(
      parsed.sections,
      columnCount,
      getSectionWeight
    );
  }, [columnCount, parsed.sections, getSectionWeight]);

  const renderProgressionPill = (prog: string, sizeClass = 'text-base sm:text-lg py-0.5') => {
    const shouldWrapTwoLine =
      prog.includes('|') && (columnCount >= 2 || prog.length > 34);

    if (shouldWrapTwoLine) {
      const subLines = prog
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      return (
        <span
          className={`inline-flex flex-col whitespace-pre px-2.5 py-0.5 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-300 font-bold ${sizeClass} leading-snug`}
        >
          {subLines.map((sub, i) => {
            const prefix = i === 0 ? '[ ' : '  ';
            const suffix = i === subLines.length - 1 ? ' ]' : '';
            return (
              <span key={i}>
                {prefix}
                {sub}
                {suffix}
              </span>
            );
          })}
        </span>
      );
    }

    return (
      <span
        className={`inline-block whitespace-pre px-2.5 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-300 font-bold ${sizeClass}`}
      >
        [ {prog} ]
      </span>
    );
  };

  const renderSectionItem = (sec: ParsedSection) => {
    const isRepeat = sec.isRepeatOfSectionIndex !== null;

    if (isRepeat) {
      const refHeader =
        parsed.sections[sec.isRepeatOfSectionIndex!]?.fullHeader;
      return (
        <div key={sec.sectionIndex} className="pt-1.5 w-max">
          <div className="inline-flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-stone-900/95 border-2 border-stone-700/90 text-stone-200 shadow-lg whitespace-nowrap">
            <span className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-amber-300">
              {sec.fullHeader}
            </span>
            <span className="text-xs sm:text-sm px-3 py-1 rounded-full bg-stone-800/90 border border-stone-700 text-stone-300 font-semibold flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              Same as {refHeader}
            </span>
          </div>
        </div>
      );
    }

    const sectionTabLines = sec.lines
      .filter((l) => l.isTabLine)
      .map((l) => l.lyric);
    const sectionPlayId = `scaffold-sec-${sec.sectionIndex}`;
    const isPlayingThisSection = playingAudioId === sectionPlayId;

    return (
      <div
        key={sec.sectionIndex}
        className="border-l-2 border-stone-800 pl-4 py-0.5 w-max"
      >
        <div className="flex items-center gap-2 mb-1 whitespace-nowrap">
          <span className="text-xs uppercase tracking-widest font-bold text-stone-400">
            {sec.fullHeader}
          </span>
          {sectionTabLines.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayTabLines(sectionPlayId, sectionTabLines);
              }}
              title={
                isPlayingThisSection
                  ? 'Stop tab audio preview'
                  : 'Play tab chunk audio preview'
              }
              className={`px-1.5 py-0.5 rounded-md border text-[10px] font-mono inline-flex items-center gap-1 transition cursor-pointer ${
                isPlayingThisSection
                  ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                  : 'bg-stone-900 hover:bg-stone-800 border-stone-700/80 text-stone-400 hover:text-amber-300'
              }`}
            >
              {isPlayingThisSection ? (
                <Square className="w-2.5 h-2.5 fill-current" />
              ) : (
                <Play className="w-2.5 h-2.5 fill-current" />
              )}
              <span>{isPlayingThisSection ? 'Stop' : 'Play'}</span>
            </button>
          )}
        </div>

        {sec.standaloneProgressions.map((prog, idx) => (
          <div key={idx} className="mb-1.5">
            {renderProgressionPill(prog, 'text-base py-0.5')}
          </div>
        ))}

        <div className="space-y-1">
          {sec.lines.map((line) => {
            const isAutoFirstWordLine =
              !line.isTabLine &&
              everyNLines > 0 &&
              line.lineIndexInSection % everyNLines === 0;

            const showProg =
              line.introducedProgression &&
              line.introducedProgression !== lastDisplayedProgression;

            if (line.introducedProgression) {
              lastDisplayedProgression = line.introducedProgression;
            }

            const isTightTabLine =
              Boolean(line.isTabLine) || line.lockedChunkGroupId !== undefined;

            return (
              <div
                key={line.globalLineIndex}
                className={isTightTabLine ? '!mt-0.5' : undefined}
              >
                {line.preLineProgressions &&
                  line.preLineProgressions.map((preProg, pIdx) => (
                    <div key={pIdx} className="mt-1 mb-1">
                      {renderProgressionPill(preProg)}
                    </div>
                  ))}

                {showProg && line.introducedProgression && (
                  <div className="mt-1 mb-1">
                    {renderProgressionPill(line.introducedProgression)}
                  </div>
                )}

                {line.chordOverLine && (
                  <div className="whitespace-pre text-sky-300 font-bold text-sm sm:text-base leading-none pt-0.5">
                    {line.chordOverLine}
                  </div>
                )}

                {line.isTabLine ? (
                  <div className="whitespace-pre text-stone-300 text-base sm:text-lg leading-tight">
                    {tokenizeTabLineForScaffold(line.lyric).map((seg, sIdx) => {
                      if (seg.type === 'structure') {
                        return (
                          <span key={sIdx} className="text-stone-400">
                            {seg.text}
                          </span>
                        );
                      }
                      const noteKey = `${sec.sectionIndex}:${line.lineIndexInSection}:${seg.noteIndex}`;
                      const isCustomHighlighted = highlights.has(noteKey);
                      const isAutoOpeningNote =
                        everyNLines > 0 &&
                        seg.noteIndexInMeasure === 0 &&
                        (everyNLines === 2 || (seg.measureIndex ?? 0) % 2 === 0);
                      const isVisibleAnchor =
                        isCustomHighlighted || isAutoOpeningNote;
                      const maskedFret = '─'.repeat(seg.text.length);

                      return (
                        <span
                          key={sIdx}
                          onPointerDown={(e) =>
                            handleWordPointerDown(noteKey, e)
                          }
                          onPointerEnter={() => handleWordPointerEnter(noteKey)}
                          title="Click or drag across fret numbers to toggle custom scaffold anchor"
                          className={`inline-block rounded px-0.5 -mx-0.5 transition cursor-pointer ${
                            isCustomHighlighted
                              ? 'bg-amber-400/25 text-amber-200 font-bold ring-1 ring-amber-400/50'
                              : isAutoOpeningNote
                              ? 'bg-emerald-500/20 text-emerald-200 font-semibold ring-1 ring-emerald-500/40'
                              : viewMode === 'edit'
                              ? 'text-stone-200 hover:bg-stone-800/70'
                              : 'text-stone-700 hover:text-stone-400 bg-stone-900/50'
                          }`}
                        >
                          {isVisibleAnchor || viewMode === 'edit'
                            ? seg.text
                            : maskedFret}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className={`whitespace-pre text-base sm:text-lg ${
                      isTightTabLine ? 'leading-tight' : 'leading-snug'
                    }`}
                  >
                    {line.words.map((word) => {
                      const wordKey = `${sec.sectionIndex}:${line.lineIndexInSection}:${word.wordIndex}`;
                      const isCustomHighlighted = highlights.has(wordKey);
                      const isAutoFirstWord =
                        isAutoFirstWordLine && word.wordIndex === 0;
                      const isVisibleAnchor =
                        isCustomHighlighted || isAutoFirstWord;

                      // Mask non-anchor words in Practice View while preserving exact monospaced character count!
                      const maskedChars = '─'.repeat(word.text.length);

                      return (
                        <React.Fragment key={word.wordIndex}>
                          <span>{word.leadingWhitespace}</span>
                          <span
                            onPointerDown={(e) =>
                              handleWordPointerDown(wordKey, e)
                            }
                            onPointerEnter={() => handleWordPointerEnter(wordKey)}
                            title="Click or click-drag across words to toggle custom scaffold highlight"
                            className={`inline-block rounded px-0.5 -mx-0.5 transition cursor-pointer ${
                              isCustomHighlighted
                                ? 'bg-amber-400/25 text-amber-200 font-bold ring-1 ring-amber-400/50'
                                : isAutoFirstWord
                                ? 'bg-emerald-500/20 text-emerald-200 font-semibold ring-1 ring-emerald-500/40'
                                : viewMode === 'edit'
                                ? 'text-stone-400/55 hover:text-stone-200 hover:bg-stone-800/70'
                                : 'text-stone-800 hover:text-stone-400 bg-stone-900/50'
                            }`}
                          >
                            {isVisibleAnchor || viewMode === 'edit'
                              ? word.text
                              : maskedChars}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-stone-950 text-stone-100 flex flex-col select-none">
      {/* Top Toolbar */}
      <header className="shrink-0 border-b border-stone-800/80 bg-stone-900/70 backdrop-blur-md px-3 sm:px-5 py-2.5 z-20">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onExit}
              className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-800 text-stone-300 hover:text-stone-100 border border-stone-700/60 transition cursor-pointer"
              title="Back to Playlist"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="truncate">
              <span className="font-bold text-sm sm:text-base text-stone-100 mr-2">
                {song.shortName}
              </span>
              <span className="text-xs font-mono text-emerald-300">
                Word Scaffold Mode
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Auto First-Word Frequency Selector */}
            <div className="inline-flex items-center rounded-lg bg-stone-950 p-0.5 border border-stone-800 text-[11px] font-mono">
              <span className="px-2 text-stone-500 hidden md:inline">
                Auto 1st Word:
              </span>
              {([2, 4, 0] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => handleChangeEveryN(n)}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    everyNLines === n
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {n === 0 ? 'Manual Only' : `Every ${n}L`}
                </button>
              ))}
            </div>

            {/* Practice vs Edit Highlights Toggle */}
            <button
              onClick={() =>
                setViewMode(viewMode === 'practice' ? 'edit' : 'practice')
              }
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'edit'
                  ? 'btn-primary border-amber-300 shadow-md shadow-amber-500/10'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
              }`}
              title="Toggle between masked Practice View and readable Edit Highlights view"
            >
              {viewMode === 'edit' ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Done Editing Anchors</span>
                </>
              ) : (
                <>
                  <Highlighter className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit Highlights ({highlights.size})</span>
                </>
              )}
            </button>

            {highlights.size > 0 && (
              <button
                onClick={handleClearCustomHighlights}
                title="Clear custom highlighted words"
                className="p-1.5 rounded-lg bg-stone-800/70 hover:bg-stone-800 text-stone-400 hover:text-rose-400 border border-stone-700/60 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auto-Fitted Scaffold Canvas */}
      <div
        ref={stageRef}
        className="flex-1 w-full h-full overflow-hidden flex items-center justify-center pb-[2.5vh] relative"
      >
        <div
          ref={contentRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
          className="px-6 pt-4 pb-7 w-max transition-transform duration-150 ease-out"
        >
          {activeColumns.length > 1 ? (
            <div
              className={`flex items-start w-max font-mono ${
                activeColumns.length >= 3
                  ? 'gap-7 xl:gap-10'
                  : 'gap-10 xl:gap-14'
              }`}
            >
              {activeColumns.map((colSections, colIdx) => (
                <div
                  key={colIdx}
                  className={`space-y-4 shrink-0 w-max min-w-[240px] ${
                    colIdx > 0
                      ? `border-l border-stone-800/60 ${
                          activeColumns.length >= 3
                            ? 'pl-6 xl:pl-9'
                            : 'pl-8 xl:pl-12'
                        }`
                      : ''
                  }`}
                >
                  {colSections.map((sec) => renderSectionItem(sec))}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 font-mono w-max">
              {parsed.sections.map((sec) => renderSectionItem(sec))}
            </div>
          )}
        </div>

        {/* Bottom Legend */}
        <div className="absolute bottom-2.5 right-4 pointer-events-none text-[11px] font-mono text-stone-500 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Auto 1st-word anchor
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Click or drag any words to highlight
          </span>
        </div>
      </div>
    </div>
  );
};
