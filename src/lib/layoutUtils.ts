import { ParsedLyricLine } from '../types';

export interface WeighableItem {
  isRepeat: boolean;
  lines: ParsedLyricLine[];
  standaloneProgressions: string[];
  showHeader?: boolean;
  title?: string;
  sectionHeader?: string;
  repeatOfSectionHeader?: string | null;
}

/**
 * Estimates the vertical visual weight (in approximate line units) of a part or section
 * so we can split items into balanced columns in landscape mode.
 */
export function estimateItemVisualWeight(item: WeighableItem): number {
  if (item.isRepeat) {
    // Collapsed repeat badge is prominent (subheading-sized badge with padding)
    return 2.6;
  }

  let weight = item.showHeader !== false ? 1.5 : 0.4;
  weight += item.standaloneProgressions.length * 1.5;

  for (const line of item.lines) {
    weight += 1.0; // Lyric line itself
    if (line.chordOverLine) {
      weight += 0.75; // Inline chord line above lyric
    }
    if (line.preLineProgressions) {
      weight += line.preLineProgressions.length * 1.35;
    }
    if (line.introducedProgression) {
      weight += 1.35; // Bracketed progression pill
    }
  }

  return Math.max(1.5, weight);
}

/**
 * Estimates the unwrapped horizontal character width of a part or section.
 * Since text wrapping is strictly forbidden when rearranging columns, every column's
 * width is determined by its longest unwrapped line.
 */
export function estimateItemCharWidth(item: WeighableItem): number {
  if (item.isRepeat) {
    const hLen = (item.sectionHeader || item.title || '').length;
    const refLen = (item.repeatOfSectionHeader || '').length;
    return Math.max(26, hLen + refLen + 18);
  }

  let maxChars = 24;
  if (item.showHeader !== false) {
    const headerText = item.title || item.sectionHeader || '';
    const hasTabPlayButton = item.lines.some((l) => l.isTabLine);
    // Account for header text plus inline action/pencil icon spacing (~3 chars, or ~9 chars with Play button)
    maxChars = Math.max(
      maxChars,
      headerText.length + (hasTabPlayButton ? 9 : 3)
    );
  }

  for (const prog of item.standaloneProgressions) {
    maxChars = Math.max(maxChars, prog.length + 6);
  }

  for (const line of item.lines) {
    maxChars = Math.max(maxChars, line.lyric.length);
    if (line.chordOverLine) {
      maxChars = Math.max(maxChars, line.chordOverLine.length);
    }
    if (line.preLineProgressions) {
      for (const p of line.preLineProgressions) {
        maxChars = Math.max(maxChars, p.length + 6);
      }
    }
    if (line.introducedProgression) {
      maxChars = Math.max(maxChars, line.introducedProgression.length + 6);
    }
  }

  // Add 4 chars for left border and padding
  return maxChars + 4;
}

/**
 * Splits an array of items into [leftColumn, rightColumn] at the boundary index
 * that minimizes the height difference between the two pages.
 * Slightly favors Page 1 (left page) being >= Page 2 when weights are close.
 */
export function splitIntoTwoBalancedPages<T>(
  items: T[],
  getWeight: (item: T, index: number) => number
): [T[], T[]] {
  if (items.length <= 1) {
    return [items, []];
  }

  const weights = items.map((item, idx) => getWeight(item, idx));
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  let bestSplitIdx = 1;
  let bestScore = Infinity;
  let leftSum = 0;

  for (let splitIdx = 1; splitIdx < items.length; splitIdx++) {
    leftSum += weights[splitIdx - 1];
    const rightSum = totalWeight - leftSum;
    // Slight preference for Page 1 (left page) being fuller than or equal to Page 2 (like a natural book spread)
    const imbalance =
      Math.abs(leftSum - rightSum) + (rightSum > leftSum ? 2.5 : 0);
    if (imbalance < bestScore) {
      bestScore = imbalance;
      bestSplitIdx = splitIdx;
    }
  }

  return [items.slice(0, bestSplitIdx), items.slice(bestSplitIdx)];
}

/**
 * Generalizable contiguous k-column balancer:
 * Partitions `items` into `numColumns` (1..N) contiguous non-empty columns
 * minimizing the tallest column height and inter-column height imbalance,
 * with a slight book-spread preference for earlier columns being >= later columns.
 */
export function splitIntoBalancedColumns<T>(
  items: T[],
  numColumns: number,
  getWeight: (item: T, index: number) => number
): T[][] {
  if (items.length === 0) {
    return [[]];
  }
  const k = Math.min(Math.max(1, Math.floor(numColumns)), items.length);
  if (k === 1) {
    return [items];
  }
  if (k === 2) {
    const [left, right] = splitIntoTwoBalancedPages(items, getWeight);
    return right.length > 0 ? [left, right] : [left];
  }

  const n = items.length;
  const weights = items.map((item, idx) => getWeight(item, idx));
  const prefixSums = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    prefixSums[i + 1] = prefixSums[i] + weights[i];
  }

  const totalWeight = prefixSums[n];
  const idealMean = totalWeight / k;

  let bestSplits: number[] = [];
  let bestScore = Infinity;
  const currentSplits = new Array<number>(k - 1).fill(0);

  const search = (
    colIdx: number,
    prevIdx: number,
    currentMaxCol: number,
    currentImbalance: number,
    currentOrderPenalty: number,
    prevColWeight: number
  ) => {
    if (colIdx === k - 1) {
      // Last column takes prevIdx..n
      const lastWeight = prefixSums[n] - prefixSums[prevIdx];
      const maxCol = Math.max(currentMaxCol, lastWeight);
      const imbalance = currentImbalance + Math.abs(lastWeight - idealMean);
      const orderPenalty =
        currentOrderPenalty + (lastWeight > prevColWeight ? 2.5 : 0);
      const score = maxCol * 2.0 + imbalance + orderPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestSplits = [...currentSplits];
      }
      return;
    }

    const remainingColsAfterThis = k - 1 - colIdx;
    const maxEndIdx = n - remainingColsAfterThis;

    for (let splitIdx = prevIdx + 1; splitIdx <= maxEndIdx; splitIdx++) {
      const colWeight = prefixSums[splitIdx] - prefixSums[prevIdx];
      const nextMaxCol = Math.max(currentMaxCol, colWeight);
      const nextImbalance = currentImbalance + Math.abs(colWeight - idealMean);
      const nextOrderPenalty =
        currentOrderPenalty +
        (colIdx > 0 && colWeight > prevColWeight ? 2.5 : 0);

      // Branch-and-bound pruning
      if (
        nextMaxCol * 2.0 + nextImbalance + nextOrderPenalty >=
        bestScore
      ) {
        continue;
      }

      currentSplits[colIdx] = splitIdx;
      search(
        colIdx + 1,
        splitIdx,
        nextMaxCol,
        nextImbalance,
        nextOrderPenalty,
        colWeight
      );
    }
  };

  search(0, 0, 0, 0, 0, Infinity);

  if (bestSplits.length === 0) {
    // Fallback to even index distribution
    const result: T[][] = [];
    for (let c = 0; c < k; c++) {
      const start = Math.floor((c * n) / k);
      const end = Math.floor(((c + 1) * n) / k);
      result.push(items.slice(start, end));
    }
    return result.filter((col) => col.length > 0);
  }

  const columns: T[][] = [];
  let startIdx = 0;
  for (const splitIdx of bestSplits) {
    columns.push(items.slice(startIdx, splitIdx));
    startIdx = splitIdx;
  }
  columns.push(items.slice(startIdx));
  return columns;
}

/**
 * Computes the fraction of the available viewport area (0..1) covered by a scaled
 * layout bounding box, so `1 - fillRatio` represents the negative space fraction.
 */
export function computeViewportFillRatio(
  estW: number,
  estH: number,
  availW: number,
  availH: number,
  scale: number
): number {
  const safeAvailArea = Math.max(1, availW * availH);
  const renderedW = Math.min(availW, Math.max(0, estW * scale));
  const renderedH = Math.min(availH, Math.max(0, estH * scale));
  return (renderedW * renderedH) / safeAvailArea;
}

/**
 * Dynamically determines the optimal number of columns (1..maxColumns) in landscape mode.
 * Expands from 1 -> 2 -> 3 -> ... columns when vertical height overflows and there is
 * empty horizontal space on the sides that allows more columns to achieve a larger
 * auto-fit scale and minimize negative space without introducing any line wrapping.
 */
export function selectOptimalColumnCount<T>(params: {
  items: T[];
  currentColumns: number;
  maxColumns?: number;
  availW: number;
  availH: number;
  naturalW: number;
  naturalH: number;
  maxScale: number;
  getWeight: (item: T, index: number) => number;
  getCharWidth: (item: T, index: number) => number;
}): number {
  const {
    items,
    currentColumns,
    maxColumns = 4,
    availW,
    availH,
    naturalW,
    naturalH,
    maxScale,
    getWeight,
    getCharWidth,
  } = params;

  const maxCandidateCols = Math.min(maxColumns, items.length);
  if (maxCandidateCols <= 1) {
    return 1;
  }

  // Helper to compute the tallest column's visual height weight and total horizontal character width for `c` columns
  const computeLayoutMetrics = (c: number) => {
    const cols = splitIntoBalancedColumns(items, c, getWeight);
    let maxColWeight = 0;
    let totalChars = 0;
    let runningIdx = 0;

    for (const col of cols) {
      let colWeight = Math.max(0, col.length - 1) * 1.2; // Inter-item vertical spacing
      let colMaxChars = 26;
      for (let i = 0; i < col.length; i++) {
        const globalIdx = runningIdx + i;
        colWeight += getWeight(col[i], globalIdx);
        colMaxChars = Math.max(colMaxChars, getCharWidth(col[i], globalIdx));
      }
      runningIdx += col.length;
      maxColWeight = Math.max(maxColWeight, colWeight);
      totalChars += colMaxChars;
    }

    // Add inter-column gap + border padding in character units
    const gapCharsPerBoundary = c === 2 ? 7 : 5;
    totalChars += Math.max(0, cols.length - 1) * gapCharsPerBoundary;

    return {
      maxColWeight: Math.max(1, maxColWeight),
      totalChars: Math.max(1, totalChars),
    };
  };

  const safeCurrentCols = Math.min(
    maxCandidateCols,
    Math.max(1, Math.floor(currentColumns))
  );
  const currentMetrics = computeLayoutMetrics(safeCurrentCols);
  const pxPerWeight = naturalH / currentMetrics.maxColWeight;
  const pxPerChar = naturalW / currentMetrics.totalChars;

  const metrics1 = computeLayoutMetrics(1);
  const estH1 = pxPerWeight * metrics1.maxColWeight;
  const estW1 = pxPerChar * metrics1.totalChars;

  // If 1 single centered column fits within the available vertical height at 100% scale, keep 1 column!
  if (estH1 <= availH) {
    return 1;
  }

  let bestCols = 1;
  let bestScale = Math.min(maxScale, availW / estW1, availH / estH1);
  let bestMaxWeight = metrics1.maxColWeight;
  let bestEstH = estH1;
  let bestFill = computeViewportFillRatio(
    estW1,
    estH1,
    availW,
    availH,
    bestScale
  );

  for (let c = 2; c <= maxCandidateCols; c++) {
    const m = computeLayoutMetrics(c);
    const estH = pxPerWeight * m.maxColWeight;
    const estW = pxPerChar * m.totalChars;
    const candidateScale = Math.min(maxScale, availW / estW, availH / estH);
    const candidateFill = computeViewportFillRatio(
      estW,
      estH,
      availW,
      availH,
      candidateScale
    );

    if (c === 2) {
      // Transition 1 -> 2 columns whenever 1 column overflows vertically and 2 columns reduces height
      // without severely crushing horizontal scale (eliminating the tall vertical 1-column strip in landscape)
      if (
        m.maxColWeight < bestMaxWeight &&
        (candidateScale >= bestScale * 0.88 || candidateFill > bestFill * 1.25)
      ) {
        bestCols = 2;
        bestScale = candidateScale;
        bestMaxWeight = m.maxColWeight;
        bestEstH = estH;
        bestFill = candidateFill;
      }
    } else {
      // Transition to c columns (e.g. 2 -> 3 or 3 -> 4) when:
      // 1. The current best column count still overflows vertically at 100% scale (bestEstH > availH)
      // 2. Adding a column meaningfully reduces the tallest column height (at least ~8% shorter)
      // 3. Adding a column increases the auto-fit scale OR maintains comparable scale while significantly reducing negative space
      const improvesScale = candidateScale > bestScale * 1.02;
      const reducesNegativeSpaceAtSimilarScale =
        candidateScale >= bestScale * 0.96 && candidateFill > bestFill * 1.12;

      if (
        bestEstH > availH &&
        m.maxColWeight < bestMaxWeight * 0.92 &&
        (improvesScale || reducesNegativeSpaceAtSimilarScale)
      ) {
        bestCols = c;
        bestScale = candidateScale;
        bestMaxWeight = m.maxColWeight;
        bestEstH = estH;
        bestFill = candidateFill;
      }
    }
  }

  return bestCols;
}

export interface SectionLayoutOverride {
  scale?: number;
  columns?: number;
}

export type SectionLayoutOverridesMap = Record<string, SectionLayoutOverride>;

const LAYOUT_OVERRIDES_STORAGE_KEY = 'by_heart_section_layout_overrides_v1';

/**
 * Builds a deterministic key for saving layout tweaks (zoom scale and/or column count)
 * per song, granularity, and active section window.
 */
export function buildSectionLayoutKey(
  songId: string,
  granularity: 'chunk' | 'section',
  visiblePartIndices: number[]
): string {
  return `${songId}:${granularity}:${visiblePartIndices.join(',')}`;
}

/**
 * Clamps a user-specified zoom scale between 20% (0.20) and 150% (1.50), rounded to 2 decimal places.
 */
export function clampCustomScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Number(Math.min(1.5, Math.max(0.2, scale)).toFixed(2));
}

/**
 * Pure state updater for per-section layout overrides.
 * Passing `null` or an empty override object deletes the key so the section returns to Auto-fit.
 */
export function updateSectionLayoutOverride(
  currentMap: SectionLayoutOverridesMap,
  key: string,
  patch: Partial<SectionLayoutOverride> | null
): SectionLayoutOverridesMap {
  const next = { ...currentMap };
  if (!patch) {
    delete next[key];
    return next;
  }

  const merged: SectionLayoutOverride = {
    ...next[key],
    ...patch,
  };

  if (merged.scale === undefined) {
    delete merged.scale;
  } else {
    merged.scale = clampCustomScale(merged.scale);
  }

  if (merged.columns === undefined) {
    delete merged.columns;
  } else {
    merged.columns = Math.min(4, Math.max(1, Math.round(merged.columns)));
  }

  if (merged.scale === undefined && merged.columns === undefined) {
    delete next[key];
  } else {
    next[key] = merged;
  }

  return next;
}

export function loadSectionLayoutOverrides(): SectionLayoutOverridesMap {
  try {
    const raw = localStorage.getItem(LAYOUT_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SectionLayoutOverridesMap;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveSectionLayoutOverrides(
  overrides: SectionLayoutOverridesMap
): void {
  try {
    localStorage.setItem(
      LAYOUT_OVERRIDES_STORAGE_KEY,
      JSON.stringify(overrides)
    );
  } catch {
    // ignore storage quota errors
  }
}
