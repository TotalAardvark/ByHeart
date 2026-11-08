import React, { useMemo } from 'react';
import { SlidersHorizontal, X, Minus, Plus, Check } from 'lucide-react';
import { parseSongBody } from '../lib/parser';

interface ChunkSizePreset {
  lines: number;
  label: string;
  desc: string;
  isDefault?: boolean;
}

const PRESETS: ChunkSizePreset[] = [
  { lines: 1, label: '1 line', desc: 'Granular' },
  { lines: 2, label: '2 lines', desc: 'Couplets' },
  { lines: 3, label: '3 lines', desc: 'Triplets' },
  { lines: 4, label: '4 lines', desc: 'Standard', isDefault: true },
  { lines: 6, label: '6 lines', desc: 'Long verses' },
  { lines: 8, label: '8 lines', desc: 'Full stanzas' },
];

export interface ChunkSizePopoverProps {
  songTitle: string;
  songBody: string;
  chunkSize: number;
  onChange: (newSize: number) => void;
  onClose: () => void;
  align?: 'left' | 'right';
}

export const ChunkSizePopover: React.FC<ChunkSizePopoverProps> = ({
  songTitle,
  songBody,
  chunkSize,
  onChange,
  onClose,
  align = 'left',
}) => {
  // Precompute unique chunk counts for each preset
  const presetCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    PRESETS.forEach((p) => {
      const parsed = parseSongBody(songBody, p.lines);
      counts[p.lines] = parsed.chunkParts.filter(
        (part) => part.isRepeatOfSectionIndex === null
      ).length;
    });
    return counts;
  }, [songBody]);

  // Current active unique chunk count
  const currentParsed = useMemo(
    () => parseSongBody(songBody, chunkSize),
    [songBody, chunkSize]
  );
  const currentChunkCount = currentParsed.chunkParts.filter(
    (part) => part.isRepeatOfSectionIndex === null
  ).length;

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
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
              <span>🧠 Chunk Size</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {chunkSize}L
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
          aria-label="Close chunk size picker"
          className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-stone-400 mb-2.5 leading-snug">
        Lines grouped per learning chunk. Saved as default for this song:
      </p>

      {/* Preset Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map((p) => {
          const isSelected = p.lines === chunkSize;
          const count = presetCounts[p.lines] ?? 0;
          return (
            <button
              key={p.lines}
              type="button"
              onClick={() => onChange(p.lines)}
              className={`text-left px-2.5 py-2 rounded-lg border text-xs transition cursor-pointer flex items-center justify-between gap-1 ${
                isSelected
                  ? 'bg-amber-400/20 border-amber-400 text-amber-200 font-semibold ring-1 ring-amber-400/40 shadow-sm'
                  : 'bg-stone-950/60 hover:bg-stone-800/80 border-stone-800 text-stone-300 hover:border-stone-700'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="truncate">{p.label}</span>
                  {p.isDefault && (
                    <span className="text-[8px] uppercase tracking-wider px-1 py-0.2 rounded bg-stone-800 text-stone-400 font-mono">
                      Def
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-stone-500 truncate font-mono">
                  {count} {count === 1 ? 'chunk' : 'chunks'}
                </div>
              </div>
              {isSelected && (
                <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Stepper for custom / non-preset sizes */}
      <div className="mt-2.5 pt-2.5 border-t border-stone-800 flex items-center justify-between">
        <span className="text-[11px] text-stone-400 font-medium">
          Fine-tune lines:
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={chunkSize <= 1}
            onClick={() => onChange(Math.max(1, chunkSize - 1))}
            className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-stone-200 flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
            aria-label="Decrease chunk size"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-amber-300 min-w-[2.5rem] text-center">
            {chunkSize}L
          </span>
          <button
            type="button"
            disabled={chunkSize >= 16}
            onClick={() => onChange(Math.min(16, chunkSize + 1))}
            className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-stone-200 flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
            aria-label="Increase chunk size"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Footer Summary */}
      <div className="mt-2.5 pt-2 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
        <span className="font-mono text-[10px]">
          Total:{' '}
          <strong className="text-amber-200 font-semibold">
            {currentChunkCount} chunks
          </strong>
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
