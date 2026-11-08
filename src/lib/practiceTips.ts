export type PracticeTipCategory =
  | 'self-love'
  | 'quote'
  | 'hygiene'
  | 'seam'
  | 'somatic'
  | 'expression';

export interface PracticeTip {
  id: string;
  category: PracticeTipCategory;
  text: string;
  /** Optional context affinity so chained steps surface transition/seam coaching more often */
  stepAffinity?: 'isolated' | 'concatenated' | 'any';
}

export const PRACTICE_TIPS: PracticeTip[] = [
  // Curated rotation weaving Practice as Self-Love, Mastery Mindset, Hygiene, Seams, Somatic, and Musicality
  {
    id: 'quote-amateurs-professionals',
    category: 'quote',
    text: '“Amateurs practice until they get it right; professionals practice until they can’t get it wrong.”',
    stepAffinity: 'any',
  },
  {
    id: 'self-love-kind-honest-coach',
    category: 'self-love',
    text: 'Be a kind but honest coach: if you had to guess the opening word, tap back and lock in the entry cue.',
    stepAffinity: 'any',
  },
  {
    id: 'hygiene-three-perfect-runs',
    category: 'hygiene',
    text: 'Practice until you feel totally comfortable — can you do 3 relaxed, perfect runs in a row?',
    stepAffinity: 'isolated',
  },
  {
    id: 'self-love-future-self',
    category: 'self-love',
    text: 'Stepping back a slide isn’t failing — it’s taking gentle, loving care of your future self on stage.',
    stepAffinity: 'any',
  },
  {
    id: 'seam-last-word-triggers-breath',
    category: 'seam',
    text: 'Focus on the seam: let the final word of one section automatically trigger the first breath of the next.',
    stepAffinity: 'concatenated',
  },
  {
    id: 'self-love-curiosity-not-frustration',
    category: 'self-love',
    text: 'Notice where you hesitated with curiosity, not frustration — every stumble is just a friendly signpost showing where to linger.',
    stepAffinity: 'any',
  },
  {
    id: 'quote-cant-forget',
    category: 'quote',
    text: '“Don’t practice until you remember it — practice until you can’t forget it.”',
    stepAffinity: 'any',
  },
  {
    id: 'self-love-permission-to-go-slow',
    category: 'self-love',
    text: 'You don’t have to force this into memory all at once. Give yourself permission to go slow until the phrase feels like home.',
    stepAffinity: 'isolated',
  },
  {
    id: 'somatic-shoulders-jaw-breath',
    category: 'somatic',
    text: 'Drop your shoulders, unclench your jaw, and take a slow breath before playing the first chord.',
    stepAffinity: 'any',
  },
  {
    id: 'self-love-deserve-peace-of-mind',
    category: 'self-love',
    text: 'Honest recall is an act of self-kindness: don’t settle for “mostly had it” when you deserve complete peace of mind.',
    stepAffinity: 'any',
  },
  {
    id: 'hygiene-one-lucky-three-memory',
    category: 'hygiene',
    text: '“One clean run can be luck; three unhurried runs in a row is true memory.”',
    stepAffinity: 'any',
  },
  {
    id: 'self-love-friend-introduction',
    category: 'self-love',
    text: 'Treat a shaky line like a friend who simply needs one more introduction — step back and greet it warmly.',
    stepAffinity: 'isolated',
  },
  {
    id: 'seam-no-border-pause',
    category: 'seam',
    text: 'Don’t pause at section borders — keep your internal pulse ticking steadily across every transition.',
    stepAffinity: 'concatenated',
  },
  {
    id: 'self-love-release-the-rush',
    category: 'self-love',
    text: 'Release the rush to reach the end of the song. Five unhurried minutes on one verse is worth ten anxious run-throughs.',
    stepAffinity: 'any',
  },
  {
    id: 'expression-slow-down-test',
    category: 'expression',
    text: 'Try delivering this pass 15% slower than normal — true memory doesn’t rely on muscle-memory momentum.',
    stepAffinity: 'isolated',
  },
  {
    id: 'self-love-forgive-the-slip',
    category: 'self-love',
    text: 'Forgive a slip the instant it happens, soften your hands, and give that phrase one more calm, deliberate pass.',
    stepAffinity: 'any',
  },
  {
    id: 'quote-slow-is-smooth',
    category: 'quote',
    text: '“Slow is smooth, and smooth is fast.”',
    stepAffinity: 'any',
  },
  {
    id: 'self-love-holding-breath-check',
    category: 'self-love',
    text: 'Check in with your body: are you holding your breath to get through this part? Exhale, soften, and begin again gently.',
    stepAffinity: 'any',
  },
  {
    id: 'somatic-eyes-closed-look-away',
    category: 'somatic',
    text: 'Close your eyes or look across the room for this entire blanked pass — trust your ears and hands.',
    stepAffinity: 'any',
  },
  {
    id: 'self-love-nervous-system-pause',
    category: 'self-love',
    text: 'Give yourself two quiet breaths between repetitions so your nervous system can absorb what you just learned.',
    stepAffinity: 'any',
  },
  {
    id: 'quote-free-your-mind',
    category: 'quote',
    text: '“The goal isn’t just to know the words — it’s to free your mind so you can feel them.”',
    stepAffinity: 'any',
  },
  {
    id: 'self-love-truth-without-judgment',
    category: 'self-love',
    text: 'Deep confidence comes from telling yourself the truth in the practice room — without ever judging yourself for needing another rep.',
    stepAffinity: 'any',
  },
  {
    id: 'hygiene-hesitation-loop',
    category: 'hygiene',
    text: 'If you hesitated mid-line, resist rushing ahead — isolate that single phrase and loop it 3 times cleanly.',
    stepAffinity: 'any',
  },
  {
    id: 'seam-hear-before-playing',
    category: 'seam',
    text: 'Hear the next chord and opening syllable in your head one full beat before your fingers move.',
    stepAffinity: 'any',
  },
  {
    id: 'self-love-fragile-to-sturdy',
    category: 'self-love',
    text: 'Patience is the shortest path to “by heart.” If a line still feels fragile, stay with it until it feels sturdy and calm.',
    stepAffinity: 'isolated',
  },
  {
    id: 'expression-story-across-room',
    category: 'expression',
    text: 'Now that the sheet is blanked, deliver these lines as if you’re telling a story to one person across the room.',
    stepAffinity: 'any',
  },
  {
    id: 'somatic-keep-the-groove',
    category: 'somatic',
    text: 'If a lyric flickers in the moment, never stop the rhythm — keep the groove alive and catch the next line.',
    stepAffinity: 'concatenated',
  },
  {
    id: 'quote-quiet-preparation',
    category: 'quote',
    text: '“Confidence under the lights is simply quiet preparation made audible.”',
    stepAffinity: 'any',
  },
  {
    id: 'hygiene-cold-start',
    category: 'hygiene',
    text: 'Can you start this section completely cold, without relying on a running start from the line before?',
    stepAffinity: 'isolated',
  },
  {
    id: 'somatic-soften-grip',
    category: 'somatic',
    text: 'Scan your hands and throat right now — can you play and sing this passage with 20% less physical effort?',
    stepAffinity: 'any',
  },
  {
    id: 'quote-conscious-effort',
    category: 'quote',
    text: '“True freedom in performance begins where conscious effort ends.”',
    stepAffinity: 'any',
  },
  {
    id: 'seam-bridge-two-bars',
    category: 'seam',
    text: 'Bridge the gap: play the last line of the previous part into the first line of the next three times seamlessly.',
    stepAffinity: 'concatenated',
  },
  {
    id: 'expression-tone-and-dynamics',
    category: 'expression',
    text: 'With the text out of sight, shift your attention to your tone, pocket, and dynamic contrast.',
    stepAffinity: 'any',
  },
  {
    id: 'quote-inhabiting-deeper',
    category: 'quote',
    text: '“Repetition isn’t about doing it again; it’s about inhabiting the song more deeply each time.”',
    stepAffinity: 'any',
  },
];

/**
 * Selects a practice tip / motivational quote for the current blanked step.
 * Uses stepIndex + cycleOffset so advancing through blanked steps or staying
 * on a blanked slide naturally rotates through quotes & tips.
 */
export function selectPracticeTipForStep(params: {
  stepIndex: number;
  stepType?: 'isolated' | 'concatenated';
  cycleOffset?: number;
}): PracticeTip {
  const { stepIndex, stepType = 'isolated', cycleOffset = 0 } = params;

  const matchingPool = PRACTICE_TIPS.filter(
    (tip) =>
      !tip.stepAffinity ||
      tip.stepAffinity === 'any' ||
      tip.stepAffinity === stepType
  );

  const pool = matchingPool.length > 0 ? matchingPool : PRACTICE_TIPS;
  const idx = Math.abs(stepIndex + cycleOffset) % pool.length;
  return pool[idx];
}
