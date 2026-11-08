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
    maxChars = Math.max(maxChars, headerText.length);
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
 * Dynamically determines the optimal number of columns (1..maxColumns) in landscape mode.
 * Expands from 1 -> 2 -> 3 -> ... columns when vertical height overflows and there is
 * empty horizontal space on the sides that allows more columns to achieve a larger
 * auto-fit scale without introducing any line wrapping.
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

  const currentMetrics = computeLayoutMetrics(currentColumns);
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

  for (let c = 2; c <= maxCandidateCols; c++) {
    const m = computeLayoutMetrics(c);
    const estH = pxPerWeight * m.maxColWeight;
    const estW = pxPerChar * m.totalChars;
    const candidateScale = Math.min(maxScale, availW / estW, availH / estH);

    if (c === 2) {
      // Transition 1 -> 2 columns whenever 1 column overflows vertically and 2 columns reduces height
      if (m.maxColWeight < bestMaxWeight && candidateScale >= bestScale * 0.95) {
        bestCols = 2;
        bestScale = candidateScale;
        bestMaxWeight = m.maxColWeight;
        bestEstH = estH;
      }
    } else {
      // Transition (c - 1) -> c columns (e.g. 2 -> 3 or 3 -> 4) when:
      // 1. The current best column count still overflows vertically at 100% scale (bestEstH > availH)
      // 2. Adding a column meaningfully reduces the tallest column height (at least ~8% shorter)
      // 3. There is enough empty space on the sides that adding a column increases the auto-fit scale!
      if (
        bestEstH > availH &&
        m.maxColWeight < bestMaxWeight * 0.92 &&
        candidateScale > bestScale * 1.02
      ) {
        bestCols = c;
        bestScale = candidateScale;
        bestMaxWeight = m.maxColWeight;
        bestEstH = estH;
      } else {
        break;
      }
    }
  }

  return bestCols;
}
