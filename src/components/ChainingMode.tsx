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
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  SlidersHorizontal,
  Eye,
  EyeOff,
  ChevronDown,
  X,
  Check,
  Pencil,
  Play,
  Square,
} from 'lucide-react';
import { ChainingGranularity, ParsedPart, SongItem } from '../types';
import { parseSongBody } from '../lib/parser';
import {
  getActivePlayingId,
  stopTabPlayback,
  subscribeTabPlayback,
  togglePlayTabLines,
} from '../lib/tabAudioPlayer';
import {
  buildGuidedChainSteps,
  buildSlidingWindowSteps,
} from '../lib/chaining';
import {
  SectionLayoutOverridesMap,
  buildSectionLayoutKey,
  clampCustomScale,
  estimateItemCharWidth,
  estimateItemVisualWeight,
  loadSectionLayoutOverrides,
  saveSectionLayoutOverrides,
  selectOptimalColumnCount,
  splitIntoBalancedColumns,
  updateSectionLayoutOverride,
} from '../lib/layoutUtils';
import { selectPracticeTipForStep } from '../lib/practiceTips';
import {
  BlankingConfig,
  BlankingPopover,
  DEFAULT_BLANKING_CONFIG,
} from './BlankingPopover';
import { RefineChunkModal } from './RefineChunkModal';

interface ChainingModeProps {
  song: SongItem;
  onExit: () => void;
  onEditSong: () => void;
  onChangeChunkSize?: (newSize: number) => void;
  onSaveSong?: (updated: SongItem) => void;
}

type SequenceStrategy = 'guided' | 'window-2' | 'window-3' | 'custom-range';

export const ChainingMode: React.FC<ChainingModeProps> = ({
  song,
  onExit,
  onEditSong,
  onChangeChunkSize,
  onSaveSong,
}) => {
  const [granularity, setGranularity] =
    useState<ChainingGranularity>('chunk');
  const [strategy, setStrategy] = useState<SequenceStrategy>('guided');
  const [stepIndex, setStepIndex] = useState(0);
  const [refiningPart, setRefiningPart] = useState<ParsedPart | null>(null);
  const [blankingConfig, setBlankingConfig] = useState<BlankingConfig>(() => {
    try {
      const saved = localStorage.getItem('by_heart_blanking_config_v1');
      if (saved) {
        return { ...DEFAULT_BLANKING_CONFIG, ...JSON.parse(saved) };
      }
      const legacy = localStorage.getItem('by_heart_blanking_v1');
      if (legacy !== null) {
        return { ...DEFAULT_BLANKING_CONFIG, enabled: Boolean(JSON.parse(legacy)) };
      }
      return DEFAULT_BLANKING_CONFIG;
    } catch {
      return DEFAULT_BLANKING_CONFIG;
    }
  });
  const [isBlankedStage, setIsBlankedStage] = useState(false);
  const [tipCycleOffset, setTipCycleOffset] = useState(0);
  const [isTipVisible, setIsTipVisible] = useState(true);
  const [isBlankingPopoverOpen, setIsBlankingPopoverOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');
  const [animKey, setAnimKey] = useState(0);
  const [isCompletedModal, setIsCompletedModal] = useState(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.innerHeight > window.innerWidth || window.innerWidth < 720
      : false
  );
  const [granularityToast, setGranularityToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Gentle 15-second auto-cycling of motivational & practice-hygiene quotes during blanked stage
  useEffect(() => {
    if (!isBlankedStage || isCompletedModal) {
      setIsTipVisible(true);
      return;
    }

    setIsTipVisible(true);
    let fadeTimeoutId: number | null = null;

    const intervalId = window.setInterval(() => {
      setIsTipVisible(false);
      fadeTimeoutId = window.setTimeout(() => {
        setTipCycleOffset((c) => c + 1);
        setIsTipVisible(true);
      }, 650);
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
      if (fadeTimeoutId !== null) {
        window.clearTimeout(fadeTimeoutId);
      }
    };
  }, [isBlankedStage, isCompletedModal, stepIndex]);

  const handleSelectGranularity = (nextGranularity: ChainingGranularity) => {
    const isChanging = nextGranularity !== granularity;
    setGranularity(nextGranularity);
    setStepIndex(0);
    setIsBlankedStage(false);

    if (isChanging) {
      try {
        const key = 'by_heart_granularity_toast_count_v1';
        const usedCount = Number(localStorage.getItem(key) || '0');
        if (usedCount < 3) {
          localStorage.setItem(key, String(usedCount + 1));
          setGranularityToast(
            nextGranularity === 'chunk'
              ? 'Learn by Chunks: Activated'
              : 'Learn by Sections: Activated'
          );
          if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
          }
          toastTimerRef.current = window.setTimeout(() => {
            setGranularityToast(null);
          }, 2200);
        }
      } catch {
        // ignore storage errors
      }
    }
  };

  const handleUpdateBlankingConfig = (next: BlankingConfig) => {
    setBlankingConfig(next);
    try {
      localStorage.setItem('by_heart_blanking_config_v1', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
    if (!next.enabled) {
      setIsBlankedStage(false);
    } else if (
      next.stepFilter === 'isolated-only' &&
      currentStep?.type !== 'isolated'
    ) {
      setIsBlankedStage(false);
    }
  };

  // Custom range selection (if user clicks pills directly to set a custom [start, end] window)
  const [customRange, setCustomRange] = useState<[number, number]>([0, 0]);
  const [showWindowMenu, setShowWindowMenu] = useState(false);

  // Track expanded repeat badges if the user taps a collapsed "5. Chorus ↻" badge to peek
  const [expandedRepeatParts, setExpandedRepeatParts] = useState<
    Record<number, boolean>
  >({});
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

  const parsed = useMemo(
    () => parseSongBody(song.body, song.chunkSize),
    [song.body, song.chunkSize]
  );

  const parts: ParsedPart[] =
    granularity === 'chunk' ? parsed.chunkParts : parsed.sectionParts;

  const steps = useMemo(() => {
    if (strategy === 'window-2') {
      return buildSlidingWindowSteps(parts, 2);
    }
    if (strategy === 'window-3') {
      return buildSlidingWindowSteps(parts, 3);
    }
    if (strategy === 'custom-range') {
      const [start, end] = [
        Math.min(customRange[0], customRange[1]),
        Math.max(customRange[0], customRange[1]),
      ];
      const visible: number[] = [];
      const pillStates: Record<number, 'yellow' | 'green'> = {};
      for (let i = 0; i < parts.length; i++) {
        if (i >= start && i <= end) {
          visible.push(i);
          pillStates[i] = 'yellow';
        } else if (i < start) {
          pillStates[i] = 'green';
        }
      }
      return [
        {
          stepIndex: 0,
          type: visible.length === 1 ? ('isolated' as const) : ('concatenated' as const),
          visiblePartIndices: visible,
          targetPartIndex: end,
          pillStates,
          label: `Custom Range (${parts[start]?.pillLabel} – ${parts[end]?.pillLabel})`,
        },
      ];
    }
    return buildGuidedChainSteps(parts);
  }, [parts, strategy, customRange]);

  const safeStepIndex = Math.min(
    Math.max(0, stepIndex),
    Math.max(0, steps.length - 1)
  );
  const currentStep = steps[safeStepIndex];

  const shouldBlankStep = useCallback(
    (stepType?: 'isolated' | 'concatenated') => {
      if (!blankingConfig.enabled) return false;
      if (blankingConfig.stepFilter === 'isolated-only') {
        return stepType === 'isolated';
      }
      return true;
    },
    [blankingConfig.enabled, blankingConfig.stepFilter]
  );

  const goNext = useCallback(() => {
    if (isCompletedModal) return;

    // When Blanking is enabled for this step type, advancing from the shown stage enters the blanked stage on the same step
    if (shouldBlankStep(currentStep?.type) && !isBlankedStage) {
      setIsBlankedStage(true);
      return;
    }

    if (strategy === 'custom-range') {
      // In custom range mode, advancing shifts the custom window forward by 1 part!
      const [start, end] = [
        Math.min(customRange[0], customRange[1]),
        Math.max(customRange[0], customRange[1]),
      ];
      if (end + 1 < parts.length) {
        setSlideDirection('next');
        setAnimKey((k) => k + 1);
        setCustomRange([start + 1, end + 1]);
        setIsBlankedStage(false);
      } else {
        setIsBlankedStage(false);
      }
      return;
    }

    if (safeStepIndex + 1 < steps.length) {
      setSlideDirection('next');
      setAnimKey((k) => k + 1);
      setStepIndex(safeStepIndex + 1);
      setIsBlankedStage(false);
      setIsCompletedModal(false);
    } else {
      setIsCompletedModal(true);
    }
  }, [
    isCompletedModal,
    shouldBlankStep,
    currentStep?.type,
    isBlankedStage,
    strategy,
    customRange,
    parts.length,
    safeStepIndex,
    steps.length,
  ]);

  const goPrev = useCallback(() => {
    if (isCompletedModal) {
      setIsCompletedModal(false);
      return;
    }
    if (isBlankedStage) {
      setIsBlankedStage(false);
      return;
    }
    if (strategy === 'custom-range') {
      const [start, end] = [
        Math.min(customRange[0], customRange[1]),
        Math.max(customRange[0], customRange[1]),
      ];
      if (start > 0) {
        setSlideDirection('prev');
        setAnimKey((k) => k + 1);
        setCustomRange([start - 1, end - 1]);
        setIsBlankedStage(shouldBlankStep(currentStep?.type));
      }
      return;
    }

    if (safeStepIndex > 0) {
      const prevStep = steps[safeStepIndex - 1];
      setSlideDirection('prev');
      setAnimKey((k) => k + 1);
      setStepIndex(safeStepIndex - 1);
      setIsBlankedStage(shouldBlankStep(prevStep?.type));
    }
  }, [
    isCompletedModal,
    isBlankedStage,
    shouldBlankStep,
    currentStep?.type,
    strategy,
    customRange,
    safeStepIndex,
    steps,
  ]);

  // Outside-click listener for blanking and strategy popovers
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-chain-blanking-popover]')) {
        setIsBlankingPopoverOpen(false);
      }
      if (!target.closest('[data-chain-strategy-popover]')) {
        setShowWindowMenu(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard navigation (Space / Right Arrow = Next, Left Arrow / Backspace = Prev)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        refiningPart !== null
      ) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        if (isBlankingPopoverOpen) {
          setIsBlankingPopoverOpen(false);
          return;
        }
        if (showWindowMenu) {
          setShowWindowMenu(false);
          return;
        }
        if (isCompletedModal) {
          setIsCompletedModal(false);
          return;
        }
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    goNext,
    goPrev,
    onExit,
    isBlankingPopoverOpen,
    showWindowMenu,
    isCompletedModal,
    refiningPart,
  ]);

  // Touch / Mouse Swipe & Tap handling on the buttonless stage canvas
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore clicks on interactive badges inside the stage
    if ((e.target as HTMLElement).closest('[data-no-stage-advance]')) {
      return;
    }
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current) return;
    if ((e.target as HTMLElement).closest('[data-no-stage-advance]')) {
      pointerStartRef.current = null;
      return;
    }

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    pointerStartRef.current = null;

    // Horizontal swipe detection (threshold 45px)
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) {
        // Swipe from right to left (page forward) -> Next step
        goNext();
      } else {
        // Swipe from left to right (page back) -> Previous step
        goPrev();
      }
      return;
    }

    // Simple Tap anywhere on stage -> Next step (or left 10% edge to go back)
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      if (relX < 0.1) {
        goPrev();
      } else {
        goNext();
      }
    }
  };

  // Visible parts for the current step
  const visibleParts = useMemo(() => {
    if (!currentStep) return [];
    return currentStep.visiblePartIndices
      .map((idx) => parts[idx])
      .filter(Boolean);
  }, [currentStep, parts]);

  // Single-Screen Auto-Fit Scaling & Dynamic Multi-Column Landscape Spread Hook
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [columnCount, setColumnCount] = useState(1);
  const [underneathTopPx, setUnderneathTopPx] = useState<number | null>(null);
  const evaluatedLayoutKeyRef = useRef<string>('');
  const [layoutOverrides, setLayoutOverrides] =
    useState<SectionLayoutOverridesMap>(() => loadSectionLayoutOverrides());
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInputText, setZoomInputText] = useState('');

  const sectionLayoutKey = useMemo(
    () =>
      buildSectionLayoutKey(
        song.id,
        granularity,
        currentStep?.visiblePartIndices ?? []
      ),
    [song.id, granularity, currentStep?.visiblePartIndices]
  );

  const currentSectionOverride = layoutOverrides[sectionLayoutKey];
  const manualColumns = currentSectionOverride?.columns;
  const manualScale = currentSectionOverride?.scale;
  const hasCustomLayoutOverride =
    manualColumns !== undefined || manualScale !== undefined;

  const applySectionLayoutPatch = useCallback(
    (patch: { scale?: number; columns?: number } | null) => {
      setLayoutOverrides((prev) => {
        const next = updateSectionLayoutOverride(prev, sectionLayoutKey, patch);
        saveSectionLayoutOverrides(next);
        return next;
      });
    },
    [sectionLayoutKey]
  );

  const handleAdjustZoom = useCallback(
    (delta: number) => {
      const nextScale = clampCustomScale(scale + delta);
      applySectionLayoutPatch({ scale: nextScale });
    },
    [scale, applySectionLayoutPatch]
  );

  const handleCycleSectionColumns = useCallback(() => {
    const maxCols = Math.min(4, Math.max(1, visibleParts.length));
    if (maxCols <= 1) return;
    const nextCols = (columnCount % maxCols) + 1;
    // Clear any manual scale lock when changing column count so the new spread auto-fits cleanly
    applySectionLayoutPatch({ columns: nextCols, scale: undefined });
  }, [visibleParts.length, columnCount, applySectionLayoutPatch]);

  const handleResetSectionLayout = useCallback(() => {
    evaluatedLayoutKeyRef.current = '';
    setIsEditingZoom(false);
    applySectionLayoutPatch(null);
  }, [applySectionLayoutPatch]);

  const handleCommitZoomInput = useCallback(() => {
    setIsEditingZoom(false);
    const parsedPct = Number.parseFloat(zoomInputText);
    if (!Number.isFinite(parsedPct) || parsedPct <= 0) return;
    const nextScale = clampCustomScale(parsedPct / 100);
    applySectionLayoutPatch({ scale: nextScale });
  }, [zoomInputText, applySectionLayoutPatch]);

  const getPartWeight = useCallback(
    (part: ParsedPart) => {
      const isCollapsedRepeat =
        part.isRepeatOfSectionIndex !== null &&
        !expandedRepeatParts[part.partIndex];
      return estimateItemVisualWeight({
        isRepeat: isCollapsedRepeat,
        lines: part.lines,
        standaloneProgressions: part.standaloneProgressions,
        showHeader: true,
      });
    },
    [expandedRepeatParts]
  );

  const getPartCharWidth = useCallback(
    (part: ParsedPart) => {
      const isCollapsedRepeat =
        part.isRepeatOfSectionIndex !== null &&
        !expandedRepeatParts[part.partIndex];
      return estimateItemCharWidth({
        isRepeat: isCollapsedRepeat,
        lines: part.lines,
        standaloneProgressions: part.standaloneProgressions,
        showHeader: true,
        title: part.title,
        sectionHeader: part.sectionHeader,
        repeatOfSectionHeader: part.repeatOfSectionHeader,
      });
    },
    [expandedRepeatParts]
  );

  const isCurrentStepBlankable = shouldBlankStep(currentStep?.type);

  const recomputeScale = useCallback(() => {
    const stageEl = stageRef.current;
    const contentEl = contentRef.current;
    if (!stageEl || !contentEl) return;

    const stageW = stageEl.clientWidth;
    const stageH = stageEl.clientHeight;
    const isLandscape = stageW > stageH * 1.1;

    // Reserve extra breathing room underneath only when Blanking is actively shown on the stage
    const isActivelyBlanked = isBlankedStage && isCurrentStepBlankable;
    const coachingReserveY = isActivelyBlanked ? 64 : 0;

    const padX = isLandscape ? 48 : 32;
    const bottomBreathingSpace = Math.max(24, Math.round(stageH * 0.035));
    const padY = 28 + bottomBreathingSpace + coachingReserveY;

    const availW = Math.max(100, stageW - padX);
    const availH = Math.max(100, stageH - padY);

    // offsetWidth and offsetHeight are unaffected by CSS transform: scale()
    const naturalW = Math.max(1, contentEl.offsetWidth);
    const naturalH = Math.max(1, contentEl.offsetHeight);

    if (!isLandscape || visibleParts.length < 2) {
      evaluatedLayoutKeyRef.current = '';
      if (columnCount !== 1) {
        setColumnCount(1);
        return;
      }
    } else if (manualColumns !== undefined) {
      const clampedManualCols = Math.min(
        4,
        Math.min(visibleParts.length, Math.max(1, manualColumns))
      );
      evaluatedLayoutKeyRef.current = '';
      if (columnCount !== clampedManualCols) {
        setColumnCount(clampedManualCols);
        return;
      }
    } else {
      const layoutKey = `${Math.round(availW / 8)}x${Math.round(availH / 8)}:${safeStepIndex}:${granularity}:${strategy}:${customRange.join('-')}:${visibleParts.length}:${Object.keys(expandedRepeatParts).filter((k) => expandedRepeatParts[Number(k)]).join(',')}`;
      if (evaluatedLayoutKeyRef.current !== layoutKey) {
        const optimalCols = selectOptimalColumnCount({
          items: visibleParts,
          currentColumns: columnCount,
          maxColumns: 4,
          availW,
          availH,
          naturalW,
          naturalH,
          maxScale: 1.05,
          getWeight: getPartWeight,
          getCharWidth: getPartCharWidth,
        });
        evaluatedLayoutKeyRef.current = layoutKey;
        if (optimalCols !== columnCount) {
          setColumnCount(optimalCols);
          return;
        }
      }
    }

    const ratioW = availW / naturalW;
    const ratioH = availH / naturalH;
    const maxScale = columnCount > 1 ? 1.05 : 1.12;
    const rawScale = Math.min(maxScale, ratioW, ratioH);
    const autoScale = Math.max(0.18, Number(rawScale.toFixed(3)));
    const finalScale =
      manualScale !== undefined ? clampCustomScale(manualScale) : autoScale;
    setScale(finalScale);

    // Compute exact Y position right underneath the scaled shape so the quote/tip sits gracefully below it
    // without ever clamping above visualBottomY and overlapping text on low-height viewports
    const stageCenterOffsetRatio = isActivelyBlanked ? 0.46 : 0.4875;
    const visualBottomY =
      stageH * stageCenterOffsetRatio + (naturalH * finalScale) / 2;
    const desiredTop = Math.round(visualBottomY + 10);
    const clampedTop = Math.max(
      Math.round(visualBottomY + 4),
      Math.min(Math.max(120, stageH - 76), desiredTop)
    );
    setUnderneathTopPx(clampedTop);
  }, [
    isBlankedStage,
    isCurrentStepBlankable,
    columnCount,
    visibleParts,
    safeStepIndex,
    granularity,
    strategy,
    customRange,
    expandedRepeatParts,
    manualColumns,
    manualScale,
    getPartWeight,
    getPartCharWidth,
  ]);

  useLayoutEffect(() => {
    recomputeScale();
  }, [
    recomputeScale,
    columnCount,
    safeStepIndex,
    granularity,
    strategy,
    customRange,
    expandedRepeatParts,
    song.body,
  ]);

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

  // Growing Pill Bar logic:
  // In Guided mode, the pill bar grows as your memory progresses (showing parts 0..targetPartIndex).
  // In Sliding Window / Custom Range mode, we show all pills so you can see/click the window across the song.
  const displayedPillCount =
    strategy === 'guided' && currentStep
      ? currentStep.targetPartIndex + 1
      : parts.length;

  const handlePillClick = (
    partIdx: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    if (e.shiftKey) {
      // Shift+Click sets a custom range window from current target to clicked pill
      const anchor = currentStep?.visiblePartIndices[0] ?? 0;
      setStrategy('custom-range');
      setCustomRange([Math.min(anchor, partIdx), Math.max(anchor, partIdx)]);
      setIsBlankedStage(false);
      return;
    }

    if (strategy === 'custom-range') {
      setCustomRange([partIdx, partIdx]);
      setIsBlankedStage(false);
      return;
    }

    // In guided or window mode, clicking a pill jumps to the isolated (or first) step for that part
    const targetStepIdx = steps.findIndex(
      (s) =>
        (s.type === 'isolated' && s.targetPartIndex === partIdx) ||
        s.targetPartIndex === partIdx
    );
    if (targetStepIdx !== -1) {
      setSlideDirection(targetStepIdx >= safeStepIndex ? 'next' : 'prev');
      setAnimKey((k) => k + 1);
      setStepIndex(targetStepIdx);
      setIsBlankedStage(false);
      setIsCompletedModal(false);
    }
  };

  // Track the last shown chord progression across the visible parts on screen so we ONLY render
  // a [ Chord Loop ] header when a new chord pattern appears (and never repeat it redundantly on
  // subsequent 4-line chunks that continue the same loop!)
  let lastDisplayedProgressionOnScreen: string | undefined = undefined;

  // When in Landscape multi-column spread mode, split visibleParts into N balanced columns
  const activeColumns = useMemo(() => {
    if (columnCount <= 1 || visibleParts.length < 2) {
      return [visibleParts];
    }
    return splitIntoBalancedColumns(visibleParts, columnCount, getPartWeight);
  }, [columnCount, visibleParts, getPartWeight]);

  const activePracticeTip = useMemo(
    () =>
      selectPracticeTipForStep({
        stepIndex: safeStepIndex,
        stepType: currentStep?.type,
        cycleOffset: tipCycleOffset,
      }),
    [safeStepIndex, currentStep?.type, tipCycleOffset]
  );

  const renderPartItem = (part: ParsedPart, isVeryFirstOnScreen: boolean) => {
    const isRepeatPart = part.isRepeatOfSectionIndex !== null;
    const isExpanded = Boolean(expandedRepeatParts[part.partIndex]);
    const blankChords =
      isBlankedStage &&
      (blankingConfig.target === 'both' ||
        blankingConfig.target === 'chords-only');
    const blankLyrics =
      isBlankedStage &&
      (blankingConfig.target === 'both' ||
        blankingConfig.target === 'lyrics-only');

    // Render Prominent Subheading-Sized Reference Badge by default for repeated sections (e.g. "5. Chorus")
    if (isRepeatPart && !isExpanded) {
      return (
        <div key={part.partIndex} className="pt-1.5 w-max">
          <div
            data-no-stage-advance
            onClick={(e) => {
              e.stopPropagation();
              setExpandedRepeatParts((prev) => ({
                ...prev,
                [part.partIndex]: true,
              }));
            }}
            className="inline-flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-stone-900/95 border-2 border-stone-700/90 hover:border-amber-400/70 text-stone-200 shadow-lg transition cursor-pointer whitespace-nowrap"
            title="Click to peek at expanded lyrics"
          >
            <span className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-amber-300">
              {part.sectionHeader}
            </span>
            <span className="text-xs sm:text-sm px-3 py-1 rounded-full bg-stone-800/90 border border-stone-700 text-stone-300 font-semibold flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              {isBlankedStage ? (
                <span className="text-stone-600">
                  Same as {'─'.repeat((part.repeatOfSectionHeader || '').length)}
                </span>
              ) : (
                <>Same as {part.repeatOfSectionHeader}</>
              )}
            </span>
            <Eye className="w-4 h-4 text-stone-400" />
            <button
              data-no-stage-advance
              onClick={(e) => {
                e.stopPropagation();
                setRefiningPart(part);
              }}
              className="pencil-faded p-1.5 rounded-lg ml-0.5 hover:scale-110 active:scale-95 cursor-pointer"
              title="Refine chunk in song editor"
              aria-label="Refine chunk"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    // Determine if the first line of this part needs an inherited progression badge
    // (Only if this is the very first visible part on screen AND it inherited a progression
    // from an earlier hidden chunk without introducing its own, AND this part doesn't already
    // have its own inline chords on every line)
    const firstLine = part.lines[0];
    const allLinesHaveInlineChords =
      part.lines.length > 0 &&
      part.lines.every((l) => Boolean(l.chordOverLine) || Boolean(l.isTabLine));

    const inheritedProgressionAtTop =
      isVeryFirstOnScreen &&
      firstLine &&
      !firstLine.introducedProgression &&
      firstLine.activeProgression &&
      !allLinesHaveInlineChords
        ? firstLine.activeProgression
        : undefined;

    if (inheritedProgressionAtTop) {
      lastDisplayedProgressionOnScreen = inheritedProgressionAtTop;
    }

    const renderProgressionPill = (prog: string, sizeClass = 'text-lg sm:text-xl py-0.5') => {
      const shouldWrapTwoLine =
        prog.includes('|') &&
        (isPortrait || columnCount >= 2 || prog.length > 34);

      if (shouldWrapTwoLine) {
        const subLines = prog
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
        return (
          <span
            className={`inline-flex flex-col whitespace-pre px-3 py-1 rounded-lg border font-bold ${sizeClass} tracking-wide leading-snug ${
              blankChords
                ? 'bg-stone-900/50 border-stone-800 text-stone-700'
                : 'bg-amber-400/15 border-amber-400/40 text-amber-300'
            }`}
          >
            {subLines.map((sub, i) => {
              const prefix = i === 0 ? '[ ' : '  ';
              const suffix = i === subLines.length - 1 ? ' ]' : '';
              return (
                <span key={i}>
                  {prefix}
                  {blankChords ? '─'.repeat(sub.length) : sub}
                  {suffix}
                </span>
              );
            })}
          </span>
        );
      }

      return (
        <span
          className={`inline-block whitespace-pre px-3 rounded-lg border font-bold ${sizeClass} tracking-wide ${
            blankChords
              ? 'bg-stone-900/50 border-stone-800 text-stone-700'
              : 'bg-amber-400/15 border-amber-400/40 text-amber-300'
          }`}
        >
          [ {blankChords ? '─'.repeat(prog.length) : prog} ]
        </span>
      );
    };

    const partTabLines = part.lines
      .filter((l) => l.isTabLine)
      .map((l) => l.lyric);
    const partPlayId = `chain-part-${part.partIndex}`;
    const isPlayingThisPart = playingAudioId === partPlayId;

    return (
      <div
        key={part.partIndex}
        className="border-l-2 border-stone-800 pl-4 py-0.5 w-max"
      >
        {/* Section / Chunk Header with Refine Pencil & Contextual Tab Audio Play Button */}
        {part.isFirstChunkOfSection || visibleParts.length === 1 ? (
          <div className="flex items-center gap-2 mb-1.5 whitespace-nowrap">
            <span className="text-xs uppercase tracking-widest font-bold text-stone-400">
              {part.title}
            </span>
            <button
              data-no-stage-advance
              onClick={(e) => {
                e.stopPropagation();
                setRefiningPart(part);
              }}
              className="pencil-faded p-1 rounded-md hover:scale-110 active:scale-95 cursor-pointer"
              title={`Refine ${part.title}`}
              aria-label={`Refine ${part.title}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {partTabLines.length > 0 && (
              <button
                type="button"
                data-no-stage-advance
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayTabLines(partPlayId, partTabLines);
                }}
                title={
                  isPlayingThisPart
                    ? 'Stop tab audio preview'
                    : 'Play tab chunk audio preview'
                }
                className={`px-1.5 py-0.5 rounded-md border text-[10px] font-mono inline-flex items-center gap-1 transition cursor-pointer ${
                  isPlayingThisPart
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                    : 'bg-stone-900 hover:bg-stone-800 border-stone-700/80 text-stone-400 hover:text-amber-300'
                }`}
              >
                {isPlayingThisPart ? (
                  <Square className="w-2.5 h-2.5 fill-current" />
                ) : (
                  <Play className="w-2.5 h-2.5 fill-current" />
                )}
                <span>{isPlayingThisPart ? 'Stop' : 'Play'}</span>
              </button>
            )}
            {isRepeatPart && isExpanded && (
              <button
                data-no-stage-advance
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedRepeatParts((prev) => ({
                    ...prev,
                    [part.partIndex]: false,
                  }));
                }}
                className="text-[11px] px-2 py-0.5 rounded bg-stone-800 text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Collapse ↻
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-1.5 whitespace-nowrap">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-500">
              {part.title}
            </span>
            <button
              data-no-stage-advance
              onClick={(e) => {
                e.stopPropagation();
                setRefiningPart(part);
              }}
              className="pencil-faded p-1 rounded-md hover:scale-110 active:scale-95 cursor-pointer"
              title={`Refine ${part.title}`}
              aria-label={`Refine ${part.title}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {partTabLines.length > 0 && (
              <button
                type="button"
                data-no-stage-advance
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayTabLines(partPlayId, partTabLines);
                }}
                title={
                  isPlayingThisPart
                    ? 'Stop tab audio preview'
                    : 'Play tab chunk audio preview'
                }
                className={`px-1.5 py-0.5 rounded-md border text-[10px] font-mono inline-flex items-center gap-1 transition cursor-pointer ${
                  isPlayingThisPart
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                    : 'bg-stone-900 hover:bg-stone-800 border-stone-700/80 text-stone-400 hover:text-amber-300'
                }`}
              >
                {isPlayingThisPart ? (
                  <Square className="w-2.5 h-2.5 fill-current" />
                ) : (
                  <Play className="w-2.5 h-2.5 fill-current" />
                )}
                <span>{isPlayingThisPart ? 'Stop' : 'Play'}</span>
              </button>
            )}
          </div>
        )}

        {/* Standalone instrumental progressions if any */}
        {part.standaloneProgressions.map((prog, idx) => (
          <div key={idx} className="mb-2">
            {renderProgressionPill(prog, 'text-lg py-1')}
          </div>
        ))}

        {/* Inherited chord loop if viewing a middle chunk in isolation */}
        {inheritedProgressionAtTop && (
          <div className="mb-2">
            {renderProgressionPill(inheritedProgressionAtTop, 'text-lg py-1')}
          </div>
        )}

        {/* Lyric lines with introduced [ Bracketed Loops ] and inline Chord-Over-Lyric pattern breakers */}
        <div className="space-y-1.5">
          {part.lines.map((line) => {
            const shouldShowIntroducedLoop =
              line.introducedProgression &&
              line.introducedProgression !== lastDisplayedProgressionOnScreen;

            if (line.introducedProgression) {
              lastDisplayedProgressionOnScreen = line.introducedProgression;
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
                    <div key={pIdx} className="mt-1 mb-1.5">
                      {renderProgressionPill(preProg)}
                    </div>
                  ))}

                {shouldShowIntroducedLoop && line.introducedProgression && (
                  <div className="mt-1 mb-1.5">
                    {renderProgressionPill(line.introducedProgression)}
                  </div>
                )}

                {line.chordOverLine && (
                  <div
                    className={`whitespace-pre font-bold text-base sm:text-lg leading-none pt-1 ${
                      blankChords ? 'text-stone-800' : 'text-sky-300'
                    }`}
                  >
                    {blankChords
                      ? line.chordOverLine.replace(/\S/g, '─')
                      : line.chordOverLine}
                  </div>
                )}

                <div
                  className={`whitespace-pre text-lg sm:text-xl ${
                    isTightTabLine ? 'leading-tight' : 'leading-snug'
                  } tracking-tight ${
                    (line.isTabLine ? blankChords : blankLyrics)
                      ? 'text-stone-800'
                      : 'text-stone-100'
                  }`}
                >
                  {(line.isTabLine ? blankChords : blankLyrics)
                    ? '─'.repeat(line.lyric.length)
                    : line.lyric}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-stone-950 text-stone-100 flex flex-col select-none">
      {/* Compact Top Navigation & Growing Yellow/Green Pill Bar */}
      <header className="shrink-0 border-b border-stone-800/80 bg-stone-900/70 backdrop-blur-md px-3 sm:px-5 py-2.5 z-20">
        <div className="max-w-6xl mx-auto flex flex-col gap-2">
          {/* Row 1: Back, Song Title, Step Indicator, & Window/Granularity Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={onExit}
                className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-800 text-stone-300 hover:text-stone-100 border border-stone-700/60 transition cursor-pointer"
                title="Back to Playlist (Esc)"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="truncate flex items-baseline gap-2.5 min-w-0">
                <span className="font-bold text-lg sm:text-xl tracking-tight text-stone-100 truncate">
                  {song.shortName}
                </span>
                <span className="text-xs font-mono text-amber-300/90 shrink-0 hidden xs:inline">
                  {currentStep?.label}
                </span>
                {isBlankedStage && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-400/20 border border-amber-400/40 text-amber-300 shrink-0">
                    <EyeOff className="w-3 h-3" />
                    <span className="hidden sm:inline">Blanked</span>
                  </span>
                )}
              </div>
            </div>

            {/* Granularity & Window Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Blanking Mode Popover Trigger (Icon-only in Portrait to maximize Title space) */}
              <div className="relative" data-chain-blanking-popover>
                <button
                  type="button"
                  onClick={() => {
                    setShowWindowMenu(false);
                    setIsBlankingPopoverOpen((prev) => !prev);
                  }}
                  title={
                    blankingConfig.enabled
                      ? 'Blanking enabled — Click to configure blanking options'
                      : 'Blanking disabled — Click to enable or configure blanking'
                  }
                  aria-label="Configure Blanking"
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition cursor-pointer ${
                    blankingConfig.enabled
                      ? 'bg-amber-400/15 border-amber-400/50 text-amber-300 font-semibold shadow-sm shadow-amber-500/10'
                      : 'bg-stone-800/70 border-stone-700/70 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                >
                  {blankingConfig.enabled ? (
                    <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-stone-400" />
                  )}
                  {!isPortrait && (
                    <>
                      <span>Blanking</span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full transition ${
                          blankingConfig.enabled
                            ? 'bg-amber-400'
                            : 'bg-stone-600'
                        }`}
                      />
                      <ChevronDown className="w-3 h-3 opacity-70" />
                    </>
                  )}
                </button>

                {isBlankingPopoverOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50">
                    <BlankingPopover
                      config={blankingConfig}
                      onChange={handleUpdateBlankingConfig}
                      onClose={() => setIsBlankingPopoverOpen(false)}
                      align="right"
                    />
                  </div>
                )}
              </div>

              {/* Clean Unit Toggle: Chunks vs Sections (with 3-time onboarding toast) */}
              <div className="relative">
                <div className="inline-flex rounded-lg bg-stone-950 p-0.5 border border-stone-800 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => handleSelectGranularity('chunk')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      granularity === 'chunk'
                        ? 'bg-stone-800 text-amber-300 font-semibold'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Chunks
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectGranularity('section')}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      granularity === 'section'
                        ? 'bg-stone-800 text-amber-300 font-semibold'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Sections
                  </button>
                </div>

                {granularityToast && (
                  <div className="absolute right-0 top-full mt-2 z-50 pointer-events-none whitespace-nowrap px-3 py-1.5 rounded-lg bg-stone-900 border border-amber-400/50 text-amber-300 text-xs font-mono font-semibold shadow-xl animate-in fade-in zoom-in-95 duration-150">
                    {granularityToast}
                  </div>
                )}
              </div>

              {/* Sliding Window / Strategy Selector */}
              <div className="relative" data-chain-strategy-popover>
                <button
                  type="button"
                  onClick={() => {
                    setIsBlankingPopoverOpen(false);
                    setShowWindowMenu((prev) => !prev);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition cursor-pointer ${
                    strategy !== 'guided'
                      ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                      : 'bg-stone-800/70 border-stone-700/70 text-stone-300 hover:bg-stone-800'
                  }`}
                  title="Configure Chaining Strategy"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {strategy === 'guided'
                      ? 'Cumulative Chain'
                      : strategy === 'window-2'
                      ? '2-Part Window'
                      : strategy === 'window-3'
                      ? '3-Part Window'
                      : 'Custom Window'}
                  </span>
                </button>

                {showWindowMenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-stone-900 border border-stone-700 shadow-2xl p-3.5 sm:p-4 text-stone-100 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 shrink-0">
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-100">
                            Chaining Strategy
                          </div>
                          <div className="text-[10px] text-stone-400 truncate">
                            How parts link together as you advance
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowWindowMenu(false)}
                        aria-label="Close strategy menu"
                        className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Strategy Option Cards */}
                    <div className="space-y-1.5">
                      {(
                        [
                          {
                            id: 'guided' as const,
                            title: 'Cumulative Chain',
                            badge: '1 → 2 → 1+2 → 3 → 1..3',
                            desc: 'Links every new part back to the start of the song',
                            isDefault: true,
                          },
                          {
                            id: 'window-2' as const,
                            title: '2-Part Sliding Window',
                            badge: '[1 + 2] → [2 + 3] → [3 + 4]',
                            desc: 'Focuses on transitions between adjacent pairs',
                          },
                          {
                            id: 'window-3' as const,
                            title: '3-Part Sliding Window',
                            badge: '[1..3] → [2..4] → [3..5]',
                            desc: 'Chains 3 consecutive parts at a time across long pieces',
                          },
                        ] as const
                      ).map((opt) => {
                        const isSelected = strategy === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setStrategy(opt.id);
                              setStepIndex(0);
                              setIsBlankedStage(false);
                              setShowWindowMenu(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2 ${
                              isSelected
                                ? 'bg-amber-400/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/40 shadow-sm'
                                : 'bg-stone-950/60 hover:bg-stone-800/80 border-stone-800 text-stone-300 hover:border-stone-700'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-stone-100">
                                  {opt.title}
                                </span>
                                {'isDefault' in opt && opt.isDefault && (
                                  <span className="text-[8px] uppercase tracking-wider px-1 py-0.2 rounded bg-stone-800 text-stone-400 font-mono">
                                    Def
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-stone-900/90 border border-stone-700/80 text-amber-300">
                                {opt.badge}
                              </div>
                              <div className="text-[10px] text-stone-400 mt-1 leading-snug">
                                {opt.desc}
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Footer Tip */}
                    <div className="mt-3 pt-2.5 border-t border-stone-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-stone-400 leading-snug">
                        <strong className="text-stone-300">Tip:</strong>{' '}
                        Shift+Click any two pills in the bar for a custom range.
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowWindowMenu(false)}
                        className="px-2.5 py-1 rounded-md text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium transition cursor-pointer shrink-0"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setSlideDirection('prev');
                  setAnimKey((k) => k + 1);
                  setStepIndex(0);
                  setIsBlankedStage(false);
                  setIsCompletedModal(false);
                }}
                title="Restart chain from Part 1"
                className="p-1.5 rounded-lg bg-stone-800/70 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-700/60 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: Growing Yellow / Green Pill Bar */}
          <div className="flex items-center gap-1.5 flex-wrap py-0.5">
            {parts.slice(0, displayedPillCount).map((part) => {
              const pillColor = currentStep?.pillStates[part.partIndex];
              const isYellow = pillColor === 'yellow';
              const isGreen = pillColor === 'green';

              return (
                <button
                  key={part.partIndex}
                  onClick={(e) => handlePillClick(part.partIndex, e)}
                  title={`${part.title} — Click to jump, Shift+Click to select custom window`}
                  className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer shadow-sm ${
                    isYellow
                      ? 'btn-primary ring-2 ring-amber-300/60 shadow-amber-500/20 scale-[1.02]'
                      : isGreen
                      ? 'btn-secondary opacity-90 hover:opacity-100'
                      : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
                  }`}
                >
                  <span>{part.pillLabel}</span>
                  {part.isRepeatOfSectionIndex !== null && (
                    <RefreshCw className="w-3 h-3 opacity-75" />
                  )}
                </button>
              );
            })}

            {/* Subtle counter & interactive per-section Spread / Auto-fit zoom controls */}
            <div className="ml-auto flex items-center gap-1.5 text-[11px] font-mono text-stone-500 shrink-0">
              <span>
                Step {safeStepIndex + 1}/{steps.length}
              </span>
              {isBlankedStage && (
                <span className="text-amber-300/80">• Blanked</span>
              )}
              {visibleParts.length >= 2 && (
                <>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleCycleSectionColumns}
                    title="Click to cycle column spread (saved for this section)"
                    className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                      manualColumns !== undefined
                        ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                        : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                    }`}
                  >
                    {activeColumns.length === 1
                      ? '1-Column'
                      : activeColumns.length === 2
                      ? '2-Page Spread'
                      : `${activeColumns.length}-Column Spread`}
                  </button>
                </>
              )}
              <span>•</span>
              <div className="inline-flex items-center gap-0.5 bg-stone-900/60 border border-stone-800 rounded px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => handleAdjustZoom(-0.05)}
                  title="Zoom out (-5%, saved for this section)"
                  aria-label="Zoom out"
                  className="px-1 text-stone-400 hover:text-stone-100 transition cursor-pointer font-bold"
                >
                  −
                </button>
                {isEditingZoom ? (
                  <input
                    type="number"
                    min={20}
                    max={150}
                    step={1}
                    autoFocus
                    value={zoomInputText}
                    onChange={(e) => setZoomInputText(e.target.value)}
                    onBlur={handleCommitZoomInput}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        handleCommitZoomInput();
                      } else if (e.key === 'Escape') {
                        setIsEditingZoom(false);
                      }
                    }}
                    className="w-11 bg-stone-950 border border-amber-400/60 rounded px-1 text-center text-[11px] text-amber-200 focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setZoomInputText(String(Math.round(scale * 100)));
                      setIsEditingZoom(true);
                    }}
                    title="Click to type a custom zoom % (saved for this section)"
                    className={`px-1 rounded transition cursor-pointer ${
                      manualScale !== undefined
                        ? 'text-amber-300 font-semibold'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {manualScale !== undefined ? 'Zoom' : 'Auto-fit'}{' '}
                    {Math.round(scale * 100)}%
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAdjustZoom(0.05)}
                  title="Zoom in (+5%, saved for this section)"
                  aria-label="Zoom in"
                  className="px-1 text-stone-400 hover:text-stone-100 transition cursor-pointer font-bold"
                >
                  +
                </button>
                {hasCustomLayoutOverride && (
                  <button
                    type="button"
                    onClick={handleResetSectionLayout}
                    title="Reset this section to automatic column & zoom fit"
                    className="ml-0.5 px-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] text-amber-300/90 transition cursor-pointer"
                  >
                    Auto
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Buttonless Tap / Swipe Stage Canvas (Auto-Fits 100% Inside Screen With Zero Scrolling) */}
      <div
        ref={stageRef}
        onPointerDown={handleStagePointerDown}
        onPointerUp={handleStagePointerUp}
        className={`flex-1 w-full h-full overflow-hidden flex items-center justify-center relative cursor-pointer ${
          isBlankedStage && isCurrentStepBlankable ? 'pb-[8vh]' : 'pb-[2.5vh]'
        }`}
      >
        <div
          key={animKey}
          className={`flex items-center justify-center ${
            slideDirection === 'next'
              ? 'animate-slide-next'
              : 'animate-slide-prev'
          }`}
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
                {activeColumns.map((colParts, colIdx) => (
                  <div
                    key={colIdx}
                    className={`space-y-5 shrink-0 w-max min-w-[240px] ${
                      colIdx > 0
                        ? `border-l border-stone-800/60 ${
                            activeColumns.length >= 3
                              ? 'pl-6 xl:pl-9'
                              : 'pl-8 xl:pl-12'
                          }`
                        : ''
                    }`}
                  >
                    {colParts.map((part, idx) =>
                      renderPartItem(part, colIdx === 0 && idx === 0)
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-5 font-mono w-max">
                {visibleParts.map((part, visibleIdx) =>
                  renderPartItem(part, visibleIdx === 0)
                )}
              </div>
            )}
          </div>
        </div>

        {/* Serene Italic Motivational & Self-Love Coaching Prompt Underneath the Blanked Shape */}
        {isBlankedStage && activePracticeTip && (
          <div
            style={
              underneathTopPx !== null
                ? { top: `${underneathTopPx}px` }
                : undefined
            }
            className="absolute left-0 right-0 flex justify-center px-6 pointer-events-none z-10 animate-quote-fade"
          >
            <p
              className={`max-w-xl text-center font-serif italic text-stone-400/90 text-base sm:text-lg leading-relaxed tracking-wide transition-all duration-700 ease-in-out ${
                isTipVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-1.5'
              }`}
            >
              {activePracticeTip.text}
            </p>
          </div>
        )}

        {/* Subtle non-intrusive gesture hint at bottom right */}
        <div className="absolute bottom-2.5 right-4 pointer-events-none text-[11px] font-mono text-stone-600 flex items-center gap-3">
          <span>Tap / Swipe Left / Space → Next</span>
          <span>•</span>
          <span>Swipe Right / ← Prev</span>
        </div>

        {/* End-of-Chain Completion Overlay */}
        {isCompletedModal && (
          <div
            data-no-stage-advance
            className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-30"
          >
            <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-stone-100 mb-1">
                Full Chain Completed!
              </h2>
              <p className="text-sm text-stone-400 mb-5">
                You chained all {parts.length}{' '}
                {granularity === 'chunk' ? 'chunks' : 'sections'} of{' '}
                <strong className="text-stone-200">{song.shortName}</strong> By
                Heart.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  onClick={() => {
                    setIsBlankedStage(false);
                    setIsCompletedModal(false);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 transition cursor-pointer"
                >
                  Keep Reviewing Full Sheet
                </button>
                <button
                  onClick={() => {
                    setStepIndex(0);
                    setIsBlankedStage(false);
                    setIsCompletedModal(false);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-stone-800 hover:bg-stone-700 text-amber-300 transition cursor-pointer"
                >
                  Restart Chain
                </button>
                <button
                  onClick={onExit}
                  className="px-4 py-2 rounded-lg text-xs font-semibold btn-primary transition cursor-pointer"
                >
                  Back to Playlist
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Edit "Refine Chunk" Modal */}
      {refiningPart && (
        <RefineChunkModal
          song={song}
          targetPart={refiningPart}
          granularity={granularity}
          onSave={(updated) => {
            if (onSaveSong) {
              onSaveSong(updated);
            }
            setRefiningPart(null);
          }}
          onOpenFullEditor={() => {
            setRefiningPart(null);
            onEditSong();
          }}
          onClose={() => setRefiningPart(null)}
        />
      )}
    </div>
  );
};
