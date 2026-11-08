import React from 'react';
import { EyeOff, Eye, X, Check } from 'lucide-react';

export type BlankingTarget = 'both' | 'lyrics-only' | 'chords-only';
export type BlankingStepFilter = 'every-step' | 'isolated-only';

export interface BlankingConfig {
  enabled: boolean;
  target: BlankingTarget;
  stepFilter: BlankingStepFilter;
}

export const DEFAULT_BLANKING_CONFIG: BlankingConfig = {
  enabled: true,
  target: 'both',
  stepFilter: 'every-step',
};

const TARGET_OPTIONS: {
  id: BlankingTarget;
  label: string;
  desc: string;
}[] = [
  {
    id: 'both',
    label: 'Lyrics & Chords',
    desc: 'Keep section header only',
  },
  {
    id: 'lyrics-only',
    label: 'Lyrics Only',
    desc: 'Keep chords visible',
  },
  {
    id: 'chords-only',
    label: 'Chords Only',
    desc: 'Keep lyrics visible',
  },
];

const STEP_FILTER_OPTIONS: {
  id: BlankingStepFilter;
  label: string;
  desc: string;
}[] = [
  {
    id: 'every-step',
    label: 'Every Step',
    desc: 'Blank isolated + chained steps',
  },
  {
    id: 'isolated-only',
    label: 'New Parts Only',
    desc: 'Skip blanking on 1+2 chains',
  },
];

export interface BlankingPopoverProps {
  config: BlankingConfig;
  onChange: (next: BlankingConfig) => void;
  onClose: () => void;
  align?: 'left' | 'right';
}

export const BlankingPopover: React.FC<BlankingPopoverProps> = ({
  config,
  onChange,
  onClose,
  align = 'right',
}) => {
  const { enabled, target, stepFilter } = config;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-stone-900 border border-stone-700 shadow-2xl p-3.5 sm:p-4 text-stone-100 z-50 animate-in fade-in zoom-in-95 duration-150 ${
        align === 'right' ? 'origin-top-right' : 'origin-top-left'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 shrink-0">
            {enabled ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
              <span>Blanking Recall Stage</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                  enabled
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-stone-800 text-stone-400 border-stone-700'
                }`}
              >
                {enabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="text-[10px] text-stone-400 truncate">
              Immediate recall before advancing
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close blanking options"
          className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Explanation */}
      <p className="text-[11px] text-stone-400 mb-3 leading-snug">
        After a chunk or section is shown, advancing adds a stage on the same
        part where the text is blanked so you can recite it from memory.
      </p>

      {/* Large Primary On/Off Toggle Slider */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange({ ...config, enabled: !enabled })}
        className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 transition cursor-pointer ${
          enabled
            ? 'bg-amber-400/15 border-amber-400/50 text-stone-100 shadow-sm'
            : 'bg-stone-950/80 border-stone-800 text-stone-300 hover:border-stone-700'
        }`}
      >
        <div className="text-left">
          <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
            <span>{enabled ? 'Blanking Enabled' : 'Blanking Disabled'}</span>
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">
            {enabled
              ? 'Read part → Blank recall → Next part'
              : 'Advance directly to next part'}
          </div>
        </div>

        {/* Visual Slider Switch */}
        <div
          className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center shrink-0 ${
            enabled
              ? 'bg-amber-400 justify-end'
              : 'bg-stone-700 justify-start'
          }`}
        >
          <span
            className={`w-5 h-5 rounded-full shadow-md transition-transform ${
              enabled ? 'bg-stone-950' : 'bg-stone-300'
            }`}
          />
        </div>
      </button>

      {/* Divider + Optional Secondary Controls */}
      <div
        className={`mt-3 pt-2.5 border-t border-stone-800 transition-opacity ${
          enabled ? 'opacity-100' : 'opacity-45 pointer-events-none'
        }`}
      >
        <div className="text-[10px] italic text-stone-400 mb-2">optional:</div>

        {/* Option Group A: What to Blank */}
        <div className="mb-2.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1">
            What to Blank
          </div>
          <div className="grid grid-cols-3 gap-1">
            {TARGET_OPTIONS.map((opt) => {
              const isSelected = target === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ ...config, target: opt.id })}
                  title={opt.desc}
                  className={`px-2 py-1.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-400/20 border-amber-400 text-amber-200 font-semibold'
                      : 'bg-stone-950/60 hover:bg-stone-800/80 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="text-[10px] leading-tight">{opt.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Option Group B: When to Blank */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1">
            When to Blank
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {STEP_FILTER_OPTIONS.map((opt) => {
              const isSelected = stepFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ ...config, stepFilter: opt.id })}
                  className={`px-2 py-1.5 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-1 ${
                    isSelected
                      ? 'bg-amber-400/20 border-amber-400 text-amber-200 font-semibold'
                      : 'bg-stone-950/60 hover:bg-stone-800/80 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] leading-tight truncate">
                      {opt.label}
                    </div>
                    <div className="text-[9px] text-stone-500 truncate mt-0.5">
                      {opt.desc}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-3 h-3 text-amber-300 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-stone-800 flex items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 rounded-md text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium transition cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};
