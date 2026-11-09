import React, { useState, useEffect } from 'react';
import {
  Heart,
  Sparkles,
  ArrowRight,
  ChevronDown,
  Eye,
  Wand2,
  Terminal,
  Music,
  Theater,
  Mic,
  BookOpen,
  Sliders,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  ThemeId,
  THEME_PALETTES,
  getThemePalette,
} from '../lib/themes';
import { compactChordSheet, DEFAULT_COMPACTOR_OPTIONS } from '../lib/compactor';
import { PRACTICE_TIPS } from '../lib/practiceTips';
import { RAW_ROTTERDAM_UG_SAMPLE } from '../lib/sampleSongs';

interface LandingPageProps {
  currentThemeId: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  onEnterApp: () => void;
}

interface SectionBadgeProps {
  children: React.ReactNode;
  colorClass?: string;
}

const SectionBadge: React.FC<SectionBadgeProps> = ({
  children,
  colorClass = 'text-amber-400',
}) => (
  <div className="flex justify-center mb-4 sm:mb-6">
    <span
      className={`inline-flex items-center text-sm sm:text-base font-mono uppercase tracking-wider px-4 py-1.5 sm:px-5 sm:py-2 rounded-md bg-stone-900 border border-stone-800 shadow-sm ${colorClass}`}
    >
      {children}
    </span>
  </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({
  currentThemeId,
  onSelectTheme,
  onEnterApp,
}) => {
  const activeTheme = getThemePalette(currentThemeId);

  // Quote Cycler State (Section 4)
  const selfLoveQuotes = PRACTICE_TIPS.filter(
    (t) => t.category === 'self-love' || t.category === 'quote'
  );
  const [quoteIndex, setQuoteIndex] = useState(1); // Default to "Stepping back a slide isn't failing..."

  // Hero Interactive Teaser State: 7-step sequence matching real app chaining
  const [heroStep, setHeroStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [heroIsPeeking, setHeroIsPeeking] = useState(false);

  // Live Demo 1: Word Scaffold Lab State
  const defaultScaffoldLines = [
    "Now I've heard there was a secret chord",
    "That David played, and it pleased the Lord",
    "But you don't really care for music, do you?",
    "It goes like this, the fourth, the fifth",
    "The minor fall, the major lift",
    "The baffled king composing Hallelujah",
  ];
  const [scaffoldLevel, setScaffoldLevel] = useState<'full' | 'first-word' | 'ghost'>('first-word');
  const [scaffoldPeeking, setScaffoldPeeking] = useState(false);
  const [customMaskedIndices, setCustomMaskedIndices] = useState<Set<string>>(new Set());

  // Live Demo 2: Smart Compactor Lab State
  const [compactorInput, setCompactorInput] = useState(RAW_ROTTERDAM_UG_SAMPLE);
  const [compactorOutput, setCompactorOutput] = useState<string>('');
  const [hasCompacted, setHasCompacted] = useState(false);
  const [simplifyVoicings, setSimplifyVoicings] = useState(true);
  const [suppressDuplicates, setSuppressDuplicates] = useState(true);

  // Run compactor when requested or options change
  const executeCompactor = (input: string, simplify: boolean, suppress: boolean) => {
    try {
      const result = compactChordSheet(input, {
        ...DEFAULT_COMPACTOR_OPTIONS,
        simplifyVoicings: simplify,
        suppressConsecutiveDuplicateChords: suppress,
      });
      setCompactorOutput(result);
      setHasCompacted(true);
    } catch {
      setCompactorOutput(input);
      setHasCompacted(true);
    }
  };

  useEffect(() => {
    // Pre-compact sample so it's ready when user taps compact
    executeCompactor(compactorInput, simplifyVoicings, suppressDuplicates);
  }, []);

  const toggleWordMask = (lineIdx: number, wordIdx: number) => {
    const key = `${lineIdx}-${wordIdx}`;
    setCustomMaskedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-400/30 selection:text-amber-200">
      {/* Sticky Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-stone-800 bg-stone-900/90 backdrop-blur-md shadow-lg">
        {/* Main Nav Strip */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo Badge & Branding */}
          <div className="flex items-center gap-3">
            <div
              style={{
                background: activeTheme.logo.badgeBackground,
                borderColor: activeTheme.logo.badgeBorder,
                boxShadow: activeTheme.logo.badgeShadow,
              }}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border-2 flex items-center justify-center shrink-0 shadow-md transition-all duration-300"
            >
              <Heart
                className="w-5 h-5 sm:w-6 sm:h-6 transition-colors duration-300"
                style={{
                  fill: activeTheme.logo.heartFill,
                  color: activeTheme.logo.heartStroke,
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-stone-100 font-serif">
                  By Heart
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-stone-800 text-amber-300 border border-stone-700">
                  v1.0
                </span>
              </div>
              <p className="hidden md:block text-xs text-stone-400">
                Cognitive recall studio for lyrics, poems & monologues
              </p>
            </div>
          </div>

          {/* Theme Switcher & Primary CTA */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real Studio Theme Switcher */}
            <div className="hidden lg:flex items-center gap-1.5 bg-stone-950/70 border border-stone-800 rounded-lg p-1.5 shadow-inner">
              <span className="text-[10px] font-mono uppercase text-stone-400 px-1 font-semibold">
                Theme:
              </span>
              {THEME_PALETTES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTheme(t.id)}
                  title={`Switch to ${t.name} Palette`}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                    currentThemeId === t.id
                      ? 'border-amber-400 ring-2 ring-amber-400/40 scale-110 shadow-sm'
                      : 'border-stone-700 hover:border-stone-500 opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${t.swatches[0]} 0%, ${t.swatches[1]} 50%, ${t.swatches[2]} 100%)`,
                  }}
                >
                  {currentThemeId === t.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                  )}
                </button>
              ))}
            </div>

            {/* Launch App Button */}
            <button
              onClick={onEnterApp}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-amber-400 hover:bg-amber-300 text-stone-950 border-t border-l border-amber-200 border-b-2 border-r-2 border-amber-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-[inset_2px_2px_2px_rgba(0,0,0,0.4)] flex items-center gap-2 transition cursor-pointer"
            >
              <span>Open By Heart Studio</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Landing Flow */}
      <main className="flex-1 flex flex-col">
        {/* ========================================================================= */}
        {/* [ SECTION 1: HERO - The Welcome & Interactive Teaser ]                     */}
        {/* ========================================================================= */}
        <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden border-b border-stone-800/80 bg-gradient-to-b from-stone-900/60 to-stone-950">
          {/* Subtle Ambient Background Elements */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-4xl mx-auto text-center relative z-10">
            {/* Retro Kitsch Pill Badge - Hidden in Portrait Mode per user request */}
            <div className="hidden sm:inline-flex portrait:hidden items-center gap-2 px-4 py-1.5 rounded-full bg-stone-900/90 border border-stone-700/80 text-xs sm:text-sm font-mono text-amber-300 shadow-md mb-8">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>COGNITIVE SCIENCE PRACTICING ENGINE</span>
              <span className="text-stone-500">•</span>
              <span className="text-stone-400">NO ACCOUNTS • 100% PRIVATE</span>
            </div>

            {/* Headline: Clean, Pure, Literary (Per User Directive) */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-serif font-normal tracking-tight text-stone-100 leading-[1.08] mb-6">
              Learn it by heart.
            </h1>

            {/* Sub-headline: Updated Per User Directive */}
            <p className="text-lg sm:text-xl md:text-2xl text-stone-300 font-sans font-light max-w-2xl mx-auto leading-relaxed mb-8">
              By Heart breaks songs, poems, and text into atomic cognitive chunks and seamlessly chains them together in your memory.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-14">
              <button
                onClick={onEnterApp}
                className="px-6 py-3.5 rounded-xl text-base font-semibold bg-amber-400 hover:bg-amber-300 text-stone-950 border-t border-l border-amber-200 border-b-2 border-r-2 border-amber-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.5),0_8px_20px_-4px_rgba(245,158,11,0.4)] active:translate-y-0.5 active:shadow-[inset_2px_2px_2px_rgba(0,0,0,0.4)] flex items-center gap-2.5 transition cursor-pointer"
              >
                <span>Open By Heart Studio (Free)</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>

              <button
                onClick={() => scrollToSection('section-problem')}
                className="px-5 py-3.5 rounded-xl text-sm font-medium bg-stone-900/90 hover:bg-stone-800 text-stone-300 border border-stone-700/80 shadow-md flex items-center gap-2 transition cursor-pointer"
              >
                <span>See How It Works</span>
                <ChevronDown className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            {/* 90s-Inspired Interactive Teaser Window Right Below Headline */}
            <div className="text-left max-w-2xl mx-auto rounded-xl border-2 border-stone-700/80 bg-stone-900 shadow-2xl overflow-hidden">
              {/* Window Title Bar */}
              <div className="bg-stone-800 border-b border-stone-700 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs text-stone-200">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold tracking-wider">STAGE_TEASER.EXE</span>
                  <span className="text-stone-500">—</span>
                  <span className="text-stone-400 text-[11px]">Forward Chaining & Active Recall</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-stone-400">
                  <span className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-700 text-emerald-400">
                    STAGE: ACTIVE
                  </span>
                </div>
              </div>

              {/* Interactive Teaser Stage Content */}
              <div className="p-5 sm:p-6 bg-stone-950/90 space-y-4">
                {/* Step Indicator Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-800 text-xs font-mono text-stone-400">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold">MODE:</span>
                    <span>Forward Chaining Flow</span>
                    <span className="text-stone-600">|</span>
                    <span className="text-stone-300">
                      {heroStep === 1 && 'Step 1 of 6: Learn Chunk 1'}
                      {heroStep === 2 && 'Step 2 of 6: Test Chunk 1'}
                      {heroStep === 3 && 'Step 3 of 6: Learn Chunk 2'}
                      {heroStep === 4 && 'Step 4 of 6: Test Chunk 2'}
                      {heroStep === 5 && 'Step 5 of 6: Learn Chain [ 1 + 2 ]'}
                      {heroStep === 6 && 'Step 6 of 6: Test Chain [ 1 + 2 ]'}
                      {heroStep === 7 && 'Complete!'}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {heroStep <= 2 && 'Chunk 1 (Lines 1–2)'}
                    {(heroStep === 3 || heroStep === 4) && 'Chunk 2 (Lines 3–4)'}
                    {(heroStep === 5 || heroStep === 6) && 'Chain Seam (Lines 1–4)'}
                    {heroStep === 7 && 'Mastery Reached'}
                  </div>
                </div>

                {/* Stanza Display with Automated Blanking for Steps 2, 4, 6 and Celebration for Step 7 */}
                <div className="min-h-[140px] flex flex-col justify-center py-3 px-4 rounded-lg bg-stone-900/50 border border-stone-800 font-serif text-lg sm:text-xl leading-relaxed text-stone-100">
                  {/* Step 1: Show Chunk 1 */}
                  {heroStep === 1 && (
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                        <span>1. Chunk 1 (Read & Internalize)</span>
                        <span className="text-stone-500 text-[10px]">Shakespeare • Sonnet 18</span>
                      </div>
                      <p>"Shall I compare thee to a summer's day?"</p>
                      <p>'Thou art more lovely and more temperate:'</p>
                    </div>
                  )}

                  {/* Step 2: Blank Chunk 1 */}
                  {heroStep === 2 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-amber-400 uppercase tracking-widest">
                          2. Blank Chunk 1 (Active Retrieval)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800/80 text-amber-300 text-[11px] font-semibold animate-pulse">
                          ⚡ Test yourself!
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p>
                          {heroIsPeeking ? (
                            "Shall I compare thee to a summer's day?"
                          ) : (
                            <span className="text-stone-400 font-mono text-base tracking-widest select-none">
                              Shall I _______ thee to a ________ day?
                            </span>
                          )}
                        </p>
                        <p>
                          {heroIsPeeking ? (
                            'Thou art more lovely and more temperate:'
                          ) : (
                            <span className="text-stone-400 font-mono text-base tracking-widest select-none">
                              Thou art more ______ and more __________:
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Show Chunk 2 */}
                  {heroStep === 3 && (
                    <div className="space-y-1">
                      <div className="text-xs font-mono text-sky-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                        <span>3. Chunk 2 (Read & Internalize)</span>
                        <span className="text-stone-500 text-[10px]">Shakespeare • Sonnet 18</span>
                      </div>
                      <p>'Rough winds do shake the darling buds of May,'</p>
                      <p>"And summer's lease hath all too short a date:"</p>
                    </div>
                  )}

                  {/* Step 4: Blank Chunk 2 */}
                  {heroStep === 4 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-sky-400 uppercase tracking-widest">
                          4. Blank Chunk 2 (Active Retrieval)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-sky-950/80 border border-sky-800/80 text-sky-300 text-[11px] font-semibold animate-pulse">
                          ⚡ Test yourself!
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p>
                          {heroIsPeeking ? (
                            'Rough winds do shake the darling buds of May,'
                          ) : (
                            <span className="text-stone-400 font-mono text-base tracking-widest select-none">
                              Rough _____ do _____ the darling ____ of May,
                            </span>
                          )}
                        </p>
                        <p>
                          {heroIsPeeking ? (
                            "And summer's lease hath all too short a date:"
                          ) : (
                            <span className="text-stone-400 font-mono text-base tracking-widest select-none">
                              And summer\'s _____ hath all too _____ a date:
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Show Chained Sequence [ 1 + 2 ] */}
                  {heroStep === 5 && (
                    <div className="space-y-2">
                      <div className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-1">
                        5. Weld Chunk 1 + Chunk 2 (Conditioning the Seam)
                      </div>
                      <div className="pl-3 border-l-2 border-amber-500/60 space-y-0.5 text-base sm:text-lg">
                        <p>"Shall I compare thee to a summer's day?"</p>
                        <p>'Thou art more lovely and more temperate:'</p>
                      </div>
                      <div className="pl-3 border-l-2 border-sky-500/60 space-y-0.5 text-base sm:text-lg">
                        <p>'Rough winds do shake the darling buds of May,'</p>
                        <p>"And summer's lease hath all too short a date:"</p>
                      </div>
                    </div>
                  )}

                  {/* Step 6: Blank Chained Sequence [ 1 + 2 ] */}
                  {heroStep === 6 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-emerald-400 uppercase tracking-widest">
                          6. Blank Chain [ 1 + 2 ] (The Final Seam Test)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-[11px] font-semibold animate-pulse">
                          ⚡ Test yourself!
                        </span>
                      </div>
                      <div className="space-y-1.5 text-base sm:text-lg">
                        <div className="pl-3 border-l-2 border-amber-500/40 space-y-0.5">
                          <p>
                            {heroIsPeeking ? (
                              "Shall I compare thee to a summer's day?"
                            ) : (
                              <span className="text-stone-400 font-mono text-sm sm:text-base tracking-wider select-none">
                                Shall I _______ thee to a ________ day?
                              </span>
                            )}
                          </p>
                          <p>
                            {heroIsPeeking ? (
                              'Thou art more lovely and more temperate:'
                            ) : (
                              <span className="text-stone-400 font-mono text-sm sm:text-base tracking-wider select-none">
                                Thou art more ______ and more __________:
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="pl-3 border-l-2 border-sky-500/40 space-y-0.5">
                          <p>
                            {heroIsPeeking ? (
                              'Rough winds do shake the darling buds of May,'
                            ) : (
                              <span className="text-stone-400 font-mono text-sm sm:text-base tracking-wider select-none">
                                Rough _____ do _____ the darling ____ of May,
                              </span>
                            )}
                          </p>
                          <p>
                            {heroIsPeeking ? (
                              "And summer's lease hath all too short a date:"
                            ) : (
                              <span className="text-stone-400 font-mono text-sm sm:text-base tracking-wider select-none">
                                And summer\'s _____ hath all too _____ a date:
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 7: Congratulations Celebration */}
                  {heroStep === 7 && (
                    <div className="py-2 text-center space-y-2">
                      <div className="text-2xl sm:text-3xl font-serif text-amber-300 font-normal">
                        🎉 Congratulations! Wasn't that easy?
                      </div>
                      <p className="text-sm text-stone-300 font-sans font-light max-w-md mx-auto">
                        In under 60 seconds, you just memorized and chained four lines of poetry using small brain-sized chunks and active recall.
                      </p>
                    </div>
                  )}
                </div>

                {/* Tactile Control Buttons (90s Software Feel, No manual blank toggle) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHeroStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7) : 1))}
                      disabled={heroStep === 1}
                      className="px-2.5 py-1.5 rounded text-xs font-mono bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-stone-200 border border-stone-600 shadow-sm cursor-pointer disabled:cursor-not-allowed"
                    >
                      ◀ Back
                    </button>

                    {heroStep < 7 ? (
                      <button
                        onClick={() => setHeroStep((prev) => ((prev + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7))}
                        className="px-3 py-1.5 rounded text-xs font-mono bg-amber-400 hover:bg-amber-300 text-stone-950 font-semibold border-t border-l border-amber-200 border-b-2 border-r-2 border-amber-600 shadow-sm cursor-pointer"
                      >
                        {heroStep === 1 && 'Next: Test Chunk 1 ▶'}
                        {heroStep === 2 && 'Next: Show Chunk 2 ▶'}
                        {heroStep === 3 && 'Next: Test Chunk 2 ▶'}
                        {heroStep === 4 && 'Next: Show Chain [1+2] ▶'}
                        {heroStep === 5 && 'Next: Test Chain [1+2] ▶'}
                        {heroStep === 6 && 'Complete Sequence ▶'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setHeroStep(1)}
                        className="px-3 py-1.5 rounded text-xs font-mono bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-600 shadow-sm cursor-pointer"
                      >
                        Restart Sequence ↺
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Hold to Peek available on blanked test steps (2, 4, 6) */}
                    {(heroStep === 2 || heroStep === 4 || heroStep === 6) && (
                      <button
                        onMouseDown={() => setHeroIsPeeking(true)}
                        onMouseUp={() => setHeroIsPeeking(false)}
                        onTouchStart={() => setHeroIsPeeking(true)}
                        onTouchEnd={() => setHeroIsPeeking(false)}
                        className="px-3 py-1.5 rounded text-xs font-mono bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-600 flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                        title="Hold mouse button down to peek at hidden text"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Hold to Peek</span>
                      </button>
                    )}

                    {heroStep === 7 && (
                      <button
                        onClick={onEnterApp}
                        className="px-3.5 py-1.5 rounded text-xs font-mono font-semibold bg-amber-400 hover:bg-amber-300 text-stone-950 flex items-center gap-1.5 cursor-pointer border border-amber-300"
                      >
                        <span>Open By Heart Studio</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[11px] font-mono text-stone-500 text-center pt-1">
                  💡 This is how By Heart's Chain Mode works: chunk small, test recall immediately, and weld the seams.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [ SECTION 2: THE PROBLEM - The Illusion of Competence ]                   */}
        {/* ========================================================================= */}
        <section
          id="section-problem"
          className="py-16 sm:py-24 px-4 sm:px-6 border-b border-stone-800/80 bg-stone-950 relative"
        >
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center">
              <SectionBadge colorClass="text-amber-400">
                Cognitive Science Diagnosis
              </SectionBadge>
              <h2 className="text-3xl sm:text-5xl font-serif text-stone-100 font-normal leading-tight mb-4 sm:mb-6">
                There is a fundamental problem with how we try to remember things.
              </h2>
              <p className="text-base sm:text-lg text-stone-400 font-light max-w-2xl mx-auto leading-relaxed">
                Most people attempt to memorize long-form material by simply staring at it until their eyes ache, a strategy known as &ldquo;massed passive review&rdquo;.
              </p>
            </div>

            {/* The Two Pitfalls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pitfall 1: Passive Review */}
              <div className="p-6 rounded-xl border border-stone-800 bg-stone-900/60 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-rose-400 uppercase tracking-wider font-semibold">
                      Diagnostic 01 // Passive Review
                    </span>
                  </div>
                  <h3 className="text-xl font-serif text-stone-200">
                    Passive Review
                  </h3>
                  <p className="text-sm text-stone-300 leading-relaxed font-light">
                    When we read a sixty-line lyric sheet top-to-bottom over and over, our eyes easily recognize the familiar typography on the page, creating what psychologists call the illusion of competence where visual recognition is mistaken for memory, leaving us stranded the moment we look away from the paper.
                  </p>
                </div>
                <div className="pt-3 border-t border-stone-800/80 text-sm sm:text-base font-semibold font-mono text-rose-300">
                  Result: Over-rehearsed beginnings, forgotten middles, stage anxiety.
                </div>
              </div>

              {/* Pitfall 2: Flashcards */}
              <div className="p-6 rounded-xl border border-stone-800 bg-stone-900/60 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-amber-400 uppercase tracking-wider font-semibold">
                      Diagnostic 02 // Flashcards
                    </span>
                  </div>
                  <h3 className="text-xl font-serif text-stone-200">
                    Flashcards
                  </h3>
                  <p className="text-sm text-stone-300 leading-relaxed font-light">
                    While single-concept flashcards work well for vocabulary, they shatter the musical and temporal momentum of performance by training phrases as isolated islands rather than training the end of one verse to trigger the breath and melody of the next.
                  </p>
                </div>
                <div className="pt-3 border-t border-stone-800/80 text-sm sm:text-base font-semibold font-mono text-amber-300">
                  Result: Knowing individual sections in theory, but choking on the transitions in practice.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [ SECTION 3: THREE INTEGRATED MODALITIES (Right after Cognitive Diagnosis) ]*/}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 border-b border-stone-800/80 bg-stone-900/50">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center">
              <SectionBadge colorClass="text-amber-400">
                <span>By Heart's Solution:</span>
                <span className="hidden sm:inline"> </span>
                <br className="portrait:block sm:hidden" />
                <span>Three Integrated Modalities</span>
              </SectionBadge>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-stone-100 font-normal leading-tight mb-4 sm:mb-6">
                Engineered for each stage of human memory consolidation.
              </h2>
              <p className="text-base sm:text-lg text-stone-300 font-light max-w-3xl mx-auto leading-relaxed">
                By Heart replaces passive review with strategies that mirror how the human brain actually encodes, sequences, and retrieves motor-cadence memory under performance conditions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Modality 1 */}
              <div className="p-6 rounded-xl border border-stone-800 bg-stone-900/80 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 font-bold font-mono">
                    01
                  </div>
                  <h3 className="text-xl font-serif text-stone-100">
                    Chain &amp; Loop Mode
                  </h3>
                  <p className="text-sm text-stone-300 leading-relaxed font-light">
                    Guides you through small brain-sized chunks, (1 → 2 → (1+2) → 3 → (1+2+3)), building up until you get the whole thing down.
                  </p>
                </div>

                <div className="pt-4 border-t border-stone-800 space-y-2 text-xs font-light text-stone-400">
                  <div className="font-mono text-[11px] text-amber-300 uppercase font-semibold">
                    Why it beats staring &amp; flashcards:
                  </div>
                  <p className="leading-relaxed">
                    Instead of over-rehearsing the opening and stumbling on transitions, forward chaining welds adjacent sections together into a continuous motor chain where the end of one phrase automatically cues the start of the next.
                  </p>
                </div>
              </div>

              {/* Modality 2 */}
              <div className="p-6 rounded-xl border border-stone-800 bg-stone-900/80 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-lg bg-sky-400/10 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold font-mono">
                    02
                  </div>
                  <h3 className="text-xl font-serif text-stone-100">
                    Word Scaffold Mode
                  </h3>
                  <p className="text-sm text-stone-300 leading-relaxed font-light">
                    An interactive vanishing-cue system that masks non-essential words while keeping first-word anchors and syllable counts so your brain reconstructs the phrase from memory.
                  </p>
                </div>

                <div className="pt-4 border-t border-stone-800 space-y-2 text-xs font-light text-stone-400">
                  <div className="font-mono text-[11px] text-sky-300 uppercase font-semibold">
                    Why it beats staring &amp; flashcards:
                  </div>
                  <p className="leading-relaxed">
                    Instead of your eyes leaning passively on printed text, word scaffolding strips away textual crutches while leaving just enough phonetic priming to prevent freezing.
                  </p>
                </div>
              </div>

              {/* Modality 3 */}
              <div className="p-6 rounded-xl border border-stone-800 bg-stone-900/80 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center text-emerald-400 font-bold font-mono">
                    03
                  </div>
                  <h3 className="text-xl font-serif text-stone-100">
                    Boundary Flashcards
                  </h3>
                  <p className="text-sm text-stone-300 leading-relaxed font-light">
                    Smart turnaround cards generated from your song’s structure, testing whether the final line of a verse triggers the entrance to the chorus cold.
                  </p>
                </div>

                <div className="pt-4 border-t border-stone-800 space-y-2 text-xs font-light text-stone-400">
                  <div className="font-mono text-[11px] text-emerald-300 uppercase font-semibold">
                    Why it beats staring &amp; flashcards:
                  </div>
                  <p className="leading-relaxed">
                    Instead of relying on starting from line one every time, boundary cards simulate live performance by training you to enter any section cold without hesitation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [ SECTION 4: LIVE STUDIO UTILITY - The Smart Compactor (After Modalities) ] */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 border-b border-stone-800/80 bg-stone-900/40 relative">
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="text-center max-w-3xl mx-auto">
              <SectionBadge colorClass="text-amber-400">
                Live Studio Utility // The Smart Compactor
              </SectionBadge>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-stone-100 font-normal leading-tight mb-4 sm:mb-6">
                Reformatting online chords into a layout optimized for the human brain.
              </h2>
              <p className="text-base sm:text-lg text-stone-300 font-light max-w-2xl mx-auto leading-relaxed">
                Musicians don&rsquo;t struggle with chords&mdash;they struggle with cluttered tabs that scatter identical letters over every line. By Heart extracts repeating chord cycles into clean, single rules so your brain only tracks the exceptions.
              </p>
            </div>

            {/* 90s-Kitsch Compactor Instrument */}
            <div className="rounded-xl border-2 border-stone-700 bg-stone-900 shadow-2xl overflow-hidden">
              {/* Compactor Header */}
              <div className="bg-stone-800 border-b border-stone-700 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-mono text-xs text-stone-200">
                  <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold tracking-wider">COMPACTOR_ENGINE.EXE</span>
                  <span className="text-stone-500">//</span>
                  <span className="text-stone-400 text-[11px]">Ultimate Guitar De-Ugly-Mator</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-stone-400">Sample:</span>
                  <span className="text-amber-300">Rotterdam (The Beautiful South)</span>
                </div>
              </div>

              {/* Compactor Controls & Split Stage */}
              <div className="p-6 bg-stone-950 space-y-6">
                {/* Action Bar with Tactile Push Button */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg bg-stone-900 border border-stone-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => executeCompactor(compactorInput, simplifyVoicings, suppressDuplicates)}
                      className="px-4 py-2 rounded-lg text-xs font-mono font-bold bg-amber-400 hover:bg-amber-300 text-stone-950 border-t border-l border-amber-200 border-b-2 border-r-2 border-amber-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.4)] active:translate-y-0.5 active:shadow-[inset_2px_2px_2px_rgba(0,0,0,0.4)] flex items-center gap-2 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>⚡ COMPACT RAW CHORD SHEET</span>
                    </button>

                    <button
                      onClick={() => {
                        setHasCompacted(!hasCompacted);
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-mono bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition cursor-pointer"
                    >
                      Toggle View: {hasCompacted ? 'Compacted Layout' : 'Raw Tab Layout'}
                    </button>
                  </div>

                  {/* Compactor Options Toggles */}
                  <div className="flex items-center gap-3 text-xs font-mono text-stone-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simplifyVoicings}
                        onChange={(e) => {
                          setSimplifyVoicings(e.target.checked);
                          executeCompactor(compactorInput, e.target.checked, suppressDuplicates);
                        }}
                        className="rounded border-stone-700 text-amber-500 focus:ring-0"
                      />
                      <span>Simplify Voicings</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={suppressDuplicates}
                        onChange={(e) => {
                          setSuppressDuplicates(e.target.checked);
                          executeCompactor(compactorInput, simplifyVoicings, e.target.checked);
                        }}
                        className="rounded border-stone-700 text-amber-500 focus:ring-0"
                      />
                      <span>Loop Compression</span>
                    </label>
                  </div>
                </div>

                {/* Before / After Split Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  {/* Left: Raw Tab */}
                  <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-4 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-800 text-[11px] text-stone-400">
                      <span className="text-rose-400 font-semibold">❌ RAW ONLINE TAB (16 Redundant Chords)</span>
                      <span>High Visual Noise</span>
                    </div>
                    <pre className="text-stone-400 leading-relaxed overflow-x-auto whitespace-pre font-mono text-[11px] max-h-64">
{`[Verse 1]
        C            Fmaj7
And the women tug their hair

            Cmaj7      Fmaj7
Like they're trying to prove it won't fall out

C  Fmaj7  Cmaj7  Fmaj7

   C              Fmaj7
And all the men are gargoyles

      Cmaj7     Fmaj7
Dipped long in Irish stout`}
                    </pre>
                  </div>

                  {/* Right: Compacted Brain Layout */}
                  <div className="rounded-lg border-2 border-amber-500/40 bg-stone-900/80 p-4 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-800 text-[11px] text-stone-200">
                      <span className="text-emerald-400 font-semibold">
                        ✅ BY HEART BRAIN NOTATION (1 Rule + 0 Exceptions)
                      </span>
                      <span className="text-amber-300 font-bold">100% Legible</span>
                    </div>
                    <div className="text-stone-200 leading-relaxed font-mono text-xs max-h-64 overflow-x-auto">
                      <div className="text-amber-400 font-bold">1. Verse 1</div>
                      <div className="inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 my-1 font-bold">
                        [ C - F ]
                      </div>
                      <div className="space-y-0.5 text-stone-100 font-sans text-sm mt-1">
                        <p>And the women tug their hair</p>
                        <p>Like they're trying to prove it won't fall out</p>
                        <p>And all the men are gargoyles</p>
                        <p>Dipped long in Irish stout</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs font-mono text-stone-500 text-center">
                  ✨ By Heart extracts harmonic cycles into single state badges <span className="text-amber-300 font-bold">[ C - F ]</span> and suppresses identical repetitions across verses.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [ SECTION 5: THE PHILOSOPHY - Practice as Self-Love ]                     */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 border-b border-stone-800/80 bg-gradient-to-b from-stone-950 to-stone-900/80 relative">
          <div className="max-w-3xl mx-auto space-y-8 sm:space-y-10 text-center">
            <SectionBadge colorClass="text-amber-400">
              The Guiding Philosophy
            </SectionBadge>

            {/* Interactive Quote Card */}
            <div className="p-8 sm:p-10 rounded-2xl border-2 border-stone-700 bg-stone-900/90 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-sky-500" />
              
              <blockquote className="text-xl sm:text-2xl md:text-3xl font-serif italic text-stone-100 leading-relaxed mb-6">
                "{selfLoveQuotes[quoteIndex].text}"
              </blockquote>

              <div className="flex items-center justify-between pt-4 border-t border-stone-800/80 text-xs font-mono text-stone-400">
                <span className="text-amber-300">
                  Practice as Self-Love • Quote {quoteIndex + 1} of {selfLoveQuotes.length}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setQuoteIndex((prev) =>
                        prev > 0 ? prev - 1 : selfLoveQuotes.length - 1
                      )
                    }
                    className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
                    title="Previous Quote"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setQuoteIndex((prev) =>
                        prev < selfLoveQuotes.length - 1 ? prev + 1 : 0
                      )
                    }
                    className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
                    title="Next Quote"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Philosophy Narrative: Single unhurried paragraph per user instruction */}
            <div className="text-stone-300 text-base sm:text-lg leading-relaxed font-light text-center max-w-2xl mx-auto">
              <p>
                By Heart approaches the craft of memory as an unhurried act of somatic kindness. Use By Heart to build knowledge, and experience yourself that learning doesn't have to be stressful as long as we have healthy structures and gentle patience.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [ SECTION 6: LIVE DEMO - Word Scaffolding & Vanishing Cues ]               */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 border-b border-stone-800/80 bg-stone-950 relative">
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="text-center max-w-3xl mx-auto">
              <SectionBadge colorClass="text-sky-400">
                Interactive Studio Lab // Word Scaffolding
              </SectionBadge>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-stone-100 font-normal leading-tight mb-4 sm:mb-6">
                Vanishing Cues: Training your brain to reconstruct, not just read.
              </h2>
              <p className="text-base sm:text-lg text-stone-400 font-light max-w-2xl mx-auto leading-relaxed">
                Drawn from Vygotsky’s zone of proximal development and neuropsychological research into the method of vanishing cues, By Heart replaces all-or-nothing memorization with progressive lexical scaffolding, providing just enough phonetic or rhythmic priming to activate your semantic recall network so that your mind learns to reconstruct full verses on its own without remaining tethered to a printed sheet.
              </p>
            </div>

            {/* 90s-Kitsch Interactive Scaffold Window */}
            <div className="rounded-xl border-2 border-stone-700 bg-stone-900 shadow-2xl overflow-hidden">
              {/* Window Chrome */}
              <div className="bg-stone-800 border-b border-stone-700 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-mono text-xs text-stone-200">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  <span className="font-semibold tracking-wider">WORD_SCAFFOLD_LAB.EXE</span>
                  <span className="text-stone-500">//</span>
                  <span className="text-stone-400 text-[11px]">Leonard Cohen — Hallelujah</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-stone-400">Scaffold Density:</span>
                  <span className="text-amber-400 uppercase font-bold">{scaffoldLevel}</span>
                </div>
              </div>

              {/* Lab Workspace */}
              <div className="p-6 bg-stone-950 space-y-6">
                {/* Density Mode Selector (90s Tactile Push Buttons) */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-lg bg-stone-900 border border-stone-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setScaffoldLevel('full');
                        setCustomMaskedIndices(new Set());
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-mono transition cursor-pointer ${
                        scaffoldLevel === 'full'
                          ? 'bg-amber-400 text-stone-950 font-bold border border-amber-300'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700'
                      }`}
                    >
                      [ Level 3: Full Text ]
                    </button>
                    <button
                      onClick={() => {
                        setScaffoldLevel('first-word');
                        setCustomMaskedIndices(new Set());
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-mono transition cursor-pointer ${
                        scaffoldLevel === 'first-word'
                          ? 'bg-amber-400 text-stone-950 font-bold border border-amber-300'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700'
                      }`}
                    >
                      [ Level 2: First-Word Anchors ]
                    </button>
                    <button
                      onClick={() => {
                        setScaffoldLevel('ghost');
                        setCustomMaskedIndices(new Set());
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-mono transition cursor-pointer ${
                        scaffoldLevel === 'ghost'
                          ? 'bg-amber-400 text-stone-950 font-bold border border-amber-300'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700'
                      }`}
                    >
                      [ Level 1: Ghost Cadence ]
                    </button>
                  </div>

                  {/* Hold to Peek */}
                  <button
                    onMouseDown={() => setScaffoldPeeking(true)}
                    onMouseUp={() => setScaffoldPeeking(false)}
                    onTouchStart={() => setScaffoldPeeking(true)}
                    onTouchEnd={() => setScaffoldPeeking(false)}
                    className="px-3.5 py-1.5 rounded text-xs font-mono bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>Hold to Peek</span>
                  </button>
                </div>

                {/* Interactive Word Surface (Click individual words to toggle mask) */}
                <div className="p-6 rounded-lg bg-stone-900/60 border border-stone-800 font-serif text-lg sm:text-xl leading-loose space-y-2">
                  {defaultScaffoldLines.map((line, lineIdx) => {
                    const words = line.split(' ');
                    return (
                      <div key={lineIdx} className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                        {words.map((word, wordIdx) => {
                          const isCustomToggled = customMaskedIndices.has(`${lineIdx}-${wordIdx}`);
                          let isVisible = true;

                          if (scaffoldLevel === 'first-word') {
                            // First word of line is visible; subsequent words masked unless toggled
                            isVisible = wordIdx === 0 ? !isCustomToggled : isCustomToggled;
                          } else if (scaffoldLevel === 'ghost') {
                            // All masked unless toggled
                            isVisible = isCustomToggled;
                          } else {
                            // Full text
                            isVisible = !isCustomToggled;
                          }

                          if (scaffoldPeeking) {
                            isVisible = true;
                          }

                          return (
                            <button
                              key={wordIdx}
                              onClick={() => toggleWordMask(lineIdx, wordIdx)}
                              className={`transition-all rounded px-1 -mx-0.5 cursor-pointer ${
                                isVisible
                                  ? 'text-stone-100 hover:bg-amber-400/20'
                                  : 'bg-stone-800 text-stone-600 hover:bg-stone-700 font-mono text-sm px-1.5 py-0.5 tracking-wider'
                              }`}
                              title="Click to toggle word visibility"
                            >
                              {isVisible ? word : '______'}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs font-mono text-stone-500 pt-1">
                  <span>💡 Try tapping any word above to reveal or mask it individually.</span>
                  <span>Click-and-Drag Word Painting supported in full studio</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [ SECTION 7: WHO BY HEART IS FOR ]                                         */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 border-b border-stone-800/80 bg-stone-900/30">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center max-w-2xl mx-auto">
              <SectionBadge colorClass="text-stone-300">
                Audience Profiles // Who By Heart Is For
              </SectionBadge>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-stone-100 font-normal leading-tight">
                Built for anyone who steps in front of an audience.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl border border-stone-800 bg-stone-900/60 flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-stone-800 text-amber-400 shrink-0">
                  <Music className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-semibold text-stone-200">Vocalists & Songwriters</h4>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Leave the awkward music stand and iPad off the stage so you can look your audience directly in the eye without fear of blanking out on verse three.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-stone-800 bg-stone-900/60 flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-stone-800 text-sky-400 shrink-0">
                  <Theater className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-semibold text-stone-200">Actors & Auditionees</h4>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Lock down intricate monologues, Shakespearean meter, and lightning-fast cue responses so your mind is completely liberated to inhabit the character.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-stone-800 bg-stone-900/60 flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-stone-800 text-emerald-400 shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-semibold text-stone-200">Keynote Speakers & Storytellers</h4>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Deliver twenty unhurried minutes of continuous ideas without ever needing to look down at palm cards or lose your rhythmic pacing.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-stone-800 bg-stone-900/60 flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-stone-800 text-purple-400 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-semibold text-stone-200">Poets & Students of Sacred Texts</h4>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Internalize beloved stanzas and ancient passages into resilient, permanent mental libraries that stay with you for decades.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* [ SECTION 8: FINALE / STAGE DOOR CALL TO ACTION ]                         */}
        {/* ========================================================================= */}
        <section className="py-20 sm:py-28 px-4 sm:px-6 bg-gradient-to-b from-stone-950 to-stone-900 text-center relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-8 relative z-10">
            <div
              style={{
                background: activeTheme.logo.badgeBackground,
                borderColor: activeTheme.logo.badgeBorder,
                boxShadow: activeTheme.logo.badgeShadow,
              }}
              className="w-16 h-16 rounded-2xl border-2 flex items-center justify-center mx-auto shadow-xl"
            >
              <Heart
                className="w-8 h-8"
                style={{
                  fill: activeTheme.logo.heartFill,
                  color: activeTheme.logo.heartStroke,
                }}
              />
            </div>

            <div className="space-y-4">
              <h2 className="text-4xl sm:text-5xl font-serif text-stone-100 font-normal">
                Ready to know your words by heart?
              </h2>
              <p className="text-stone-400 text-base sm:text-lg font-light leading-relaxed">
                Step inside the studio, paste your first song or monologue, and discover how gentle, systematic rehearsal transforms anxiety into serene mastery.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onEnterApp}
                className="px-8 py-4 rounded-xl text-lg font-semibold bg-amber-400 hover:bg-amber-300 text-stone-950 border-t border-l border-amber-200 border-b-2 border-r-2 border-amber-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.5),0_10px_25px_-5px_rgba(245,158,11,0.5)] active:translate-y-0.5 active:shadow-[inset_2px_2px_2px_rgba(0,0,0,0.4)] inline-flex items-center gap-3 transition cursor-pointer"
              >
                <span>Open By Heart Studio (Free)</span>
                <ArrowRight className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            <div className="text-xs font-mono text-stone-500 flex items-center justify-center gap-3 pt-2">
              <span>Instant In-Browser Studio</span>
              <span>•</span>
              <span>No Account Required</span>
              <span>•</span>
              <span>100% Free & Open</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-800 bg-stone-950 py-6 px-4 text-center text-xs font-mono text-stone-500">
        <p>By Heart Studio • Cognitive Science Driven Practice • Learn it by heart.</p>
      </footer>
    </div>
  );
};
