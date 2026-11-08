import React from 'react';
import { AlignLeft, X, Repeat, Music } from 'lucide-react';
import { ParsedSection } from '../types';

export interface SectionOutlinePopoverProps {
  songTitle: string;
  sections: ParsedSection[];
  onClose: () => void;
}

export const SectionOutlinePopover: React.FC<SectionOutlinePopoverProps> = ({
  songTitle,
  sections,
  onClose,
}) => {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-stone-900 border border-stone-700 shadow-2xl p-3.5 sm:p-4 text-stone-100 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 shrink-0">
            <AlignLeft className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
              <span>Section Roadmap</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {sections.filter((s) => s.isRepeatOfSectionIndex === null).length} unique
              </span>
            </div>
            <div className="text-[10px] text-stone-400 truncate">
              {songTitle}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sections outline"
          className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-stone-400 mb-2 leading-snug">
        Structure &amp; sections in this piece:
      </p>

      {/* Section List */}
      <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {sections.map((sec, idx) => {
          const isRepeat = sec.isRepeatOfSectionIndex !== null;
          return (
            <div
              key={idx}
              className="px-2.5 py-1.5 rounded-lg bg-stone-950/60 border border-stone-800/80 flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="font-semibold text-stone-200 truncate">
                  {sec.fullHeader}
                </span>
                {sec.standaloneProgressions.length > 0 && (
                  <span className="text-[10px] text-amber-300/80 font-mono flex items-center gap-0.5">
                    <Music className="w-2.5 h-2.5" />
                    <span>[{sec.standaloneProgressions[0]}]</span>
                  </span>
                )}
              </div>
              <div className="shrink-0 text-[10px] font-mono">
                {isRepeat ? (
                  <span className="text-emerald-400/90 flex items-center gap-0.5 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                    <Repeat className="w-2.5 h-2.5" />
                    <span>Repeat</span>
                  </span>
                ) : (
                  <span className="text-stone-400 bg-stone-800 px-1.5 py-0.2 rounded">
                    {sec.lines.length} lines
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-2.5 pt-2 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
        <span className="text-[10px] text-stone-400">
          Switch to <strong className="text-stone-300">Sections</strong> in practice to chain by section
        </span>
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
