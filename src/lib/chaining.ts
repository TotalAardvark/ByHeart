import { ChainStep, ParsedPart } from '../types';

/**
 * Generates the serial forward chaining sequence for a list of parts:
 * - Part 1 (pt1 yellow)
 * - Part 2 (pt1 green, pt2 yellow)
 * - Parts 1+2 (pt1..2 yellow)
 * - Part 3 (pt1..2 green, pt3 yellow)
 * - Parts 1+2+3 (pt1..3 yellow)
 *
 * Automatically skips the isolated learning step for repeated sections (e.g. Chorus 2),
 * jumping straight to the concatenated confirmation step (e.g. v1+c1+v2+c2).
 */
export function buildGuidedChainSteps(parts: ParsedPart[]): ChainStep[] {
  if (parts.length === 0) return [];

  const steps: ChainStep[] = [];

  // Step 0: First part
  steps.push({
    stepIndex: 0,
    type: 'isolated',
    visiblePartIndices: [0],
    targetPartIndex: 0,
    pillStates: { 0: 'yellow' },
    label: `Learn ${parts[0].pillLabel}`,
  });

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const isRepeat = part.isRepeatOfSectionIndex !== null;

    // 1. Isolated step for the new part (skipped if this section is a repeat of an earlier section!)
    if (!isRepeat) {
      const isolatedPills: Record<number, 'yellow' | 'green'> = {};
      for (let k = 0; k < i; k++) {
        isolatedPills[k] = 'green';
      }
      isolatedPills[i] = 'yellow';

      steps.push({
        stepIndex: steps.length,
        type: 'isolated',
        visiblePartIndices: [i],
        targetPartIndex: i,
        pillStates: isolatedPills,
        label: `Learn ${part.pillLabel}`,
      });
    }

    // 2. Concatenated step from 0..i
    const concatPills: Record<number, 'yellow' | 'green'> = {};
    const visibleIndices: number[] = [];
    for (let k = 0; k <= i; k++) {
      concatPills[k] = 'yellow';
      visibleIndices.push(k);
    }

    steps.push({
      stepIndex: steps.length,
      type: 'concatenated',
      visiblePartIndices: visibleIndices,
      targetPartIndex: i,
      pillStates: concatPills,
      label: isRepeat
        ? `Confirm 1–${i + 1} (with ${part.pillLabel})`
        : `Chain 1–${i + 1}`,
    });
  }

  return steps;
}

/**
 * Generates sliding-window steps for a fixed window size W (e.g., 2-section window:
 * [V1 + C1] -> [C1 + V2] -> [V2 + C2] ...).
 */
export function buildSlidingWindowSteps(
  parts: ParsedPart[],
  windowSize: number
): ChainStep[] {
  if (parts.length === 0) return [];
  const w = Math.max(1, Math.min(windowSize, parts.length));
  const steps: ChainStep[] = [];

  for (let start = 0; start <= parts.length - w; start++) {
    const end = start + w - 1;
    const visiblePartIndices: number[] = [];
    const pillStates: Record<number, 'yellow' | 'green'> = {};

    for (let k = 0; k <= end; k++) {
      if (k < start) {
        pillStates[k] = 'green';
      } else {
        pillStates[k] = 'yellow';
        visiblePartIndices.push(k);
      }
    }

    const rangeLabel =
      w === 1
        ? parts[start].pillLabel
        : `${parts[start].pillLabel} → ${parts[end].pillLabel}`;

    steps.push({
      stepIndex: steps.length,
      type: w === 1 ? 'isolated' : 'concatenated',
      visiblePartIndices,
      targetPartIndex: end,
      pillStates,
      label: `Window: ${rangeLabel}`,
    });
  }

  return steps;
}
