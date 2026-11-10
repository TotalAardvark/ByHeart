import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import {
  X,
  Printer,
  Share2,
  Copy,
  Check,
  Columns,
  FileText,
  ChevronDown,
  Download,
  Loader2,
} from 'lucide-react';
import { SongItem, ParsedSection } from '../types';
import { parseSongBody } from '../lib/parser';
import {
  splitIntoBalancedColumns,
  estimateItemVisualWeight,
  estimateItemCharWidth,
} from '../lib/layoutUtils';
import { usePopoverPosition } from '../lib/usePopoverPosition';
import { downloadOrShareSongPdf } from '../lib/pdfGenerator';

export interface PrintPreviewModalProps {
  song: SongItem;
  isOpen: boolean;
  onClose: () => void;
  initialColumns?: number;
}

const getSectionWeight = (sec: ParsedSection): number => {
  return estimateItemVisualWeight({
    isRepeat: sec.isRepeatOfSectionIndex !== null,
    lines: sec.lines,
    standaloneProgressions: sec.standaloneProgressions || [],
    showHeader: true,
    sectionHeader: sec.fullHeader,
  });
};

const getSectionCharWidth = (sec: ParsedSection): number => {
  return estimateItemCharWidth({
    isRepeat: sec.isRepeatOfSectionIndex !== null,
    lines: sec.lines,
    standaloneProgressions: sec.standaloneProgressions || [],
    showHeader: true,
    sectionHeader: sec.fullHeader,
  });
};

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  song,
  isOpen,
  onClose,
  initialColumns = 1,
}) => {
  const [columns, setColumns] = useState<number>(() =>
    Math.min(3, Math.max(1, initialColumns))
  );
  const [manualFontScale, setManualFontScale] = useState<number | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isColDropdownOpen, setIsColDropdownOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const isMobileOrTablet = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  const colButtonRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoZoomScale, setAutoZoomScale] = useState<number>(1);
  const [contentHeight, setContentHeight] = useState<number>(800);

  const colDropdownStyle = usePopoverPosition(isColDropdownOpen, colButtonRef, {
    popoverWidth: 190,
    align: 'center',
  });

  const parsed = useMemo(() => {
    return parseSongBody(song.body, song.chunkSize);
  }, [song.body, song.chunkSize]);

  // Target paper dimensions based on standard A4 paper ratio (210mm x 297mm = 1 : 1.4142)
  const targetPaperWidth = columns === 1 ? 680 : 1050;
  const a4PageHeight = Math.round(
    columns === 1
      ? targetPaperWidth * (297 / 210) // Portrait height: ~962px for 680px width
      : targetPaperWidth * (210 / 297) // Landscape height: ~742px for 1050px width
  );

  // Compute balanced contiguous columns for multi-column mode using layoutUtils
  const balancedColumns = useMemo(() => {
    if (columns <= 1) {
      return [parsed.sections];
    }
    return splitIntoBalancedColumns(
      parsed.sections,
      columns,
      (sec) => getSectionWeight(sec)
    );
  }, [parsed.sections, columns]);

  // Compute auto-fit scale for 2 & 3 column landscape single-page fitting
  const autoLandscapeScalePct = useMemo(() => {
    if (columns <= 1) return 100;

    const paperHeight = a4PageHeight; // ~742px
    const paddingY = 48; // 24px top + 24px bottom
    const headerHeight = 52;
    const footerHeight = 26;
    const usableHeight = paperHeight - paddingY - headerHeight - footerHeight; // ~616px

    const paddingX = 64; // 32px left + 32px right
    const colGap = columns === 2 ? 32 : 24;
    const usableWidth = targetPaperWidth - paddingX - (columns - 1) * colGap;
    const colWidth = usableWidth / columns;

    let maxColWeight = 1;
    let maxColChars = 24;
    for (const col of balancedColumns) {
      let colW = Math.max(0, col.length - 1) * 0.9;
      let colChars = 24;
      for (const sec of col) {
        colW += getSectionWeight(sec);
        colChars = Math.max(colChars, getSectionCharWidth(sec));
      }
      maxColWeight = Math.max(maxColWeight, colW);
      maxColChars = Math.max(maxColChars, colChars);
    }

    // 0.85rem (~13.6px) font gives ~18.5px line-height and ~8.2px character width
    const baseLineHeight = 18.5;
    const baseCharWidth = 8.16;

    const estColHeight = maxColWeight * baseLineHeight;
    const estColWidth = maxColChars * baseCharWidth;

    const scaleY = usableHeight / Math.max(1, estColHeight);
    const scaleX = colWidth / Math.max(1, estColWidth);

    const fitScale = Math.min(scaleY, scaleX);
    // Clamp between 55% and 105%
    return Math.round(Math.max(0.55, Math.min(1.05, fitScale)) * 100);
  }, [columns, a4PageHeight, targetPaperWidth, balancedColumns]);

  const effectiveFontScale = manualFontScale ?? (columns === 1 ? 100 : autoLandscapeScalePct);

  // Compute multi-page partitioning for 1-column portrait view based on A4 proportions
  const portraitPages = useMemo(() => {
    if (columns > 1) {
      return [parsed.sections];
    }

    const scaleFactor = effectiveFontScale / 100;
    const baseLineHeight = 18.5 * scaleFactor;
    const paddingY = 64;
    const footerHeight = 26;

    // Page 1 includes the full header
    const page1HeaderHeight = 64;
    const page1UsableHeight = a4PageHeight - paddingY - page1HeaderHeight - footerHeight;
    const page1Budget = Math.max(15, page1UsableHeight / baseLineHeight);

    // Later pages have only a compact continuation header
    const laterHeaderHeight = 32;
    const laterUsableHeight = a4PageHeight - paddingY - laterHeaderHeight - footerHeight;
    const laterBudget = Math.max(18, laterUsableHeight / baseLineHeight);

    const pages: ParsedSection[][] = [];
    let currentPage: ParsedSection[] = [];
    let currentPageWeight = 0;

    for (const sec of parsed.sections) {
      const secWeight = getSectionWeight(sec) + (currentPage.length > 0 ? 0.9 : 0);
      const budget = pages.length === 0 ? page1Budget : laterBudget;

      if (currentPage.length > 0 && currentPageWeight + secWeight > budget) {
        pages.push(currentPage);
        currentPage = [sec];
        currentPageWeight = getSectionWeight(sec);
      } else {
        currentPage.push(sec);
        currentPageWeight += secWeight;
      }
    }

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages;
  }, [columns, effectiveFontScale, a4PageHeight, parsed.sections]);

  useEffect(() => {
    if (isOpen) {
      setColumns(Math.min(3, Math.max(1, initialColumns)));
      setManualFontScale(null);
      setIsColDropdownOpen(false);
    }
  }, [isOpen, initialColumns]);

  // Handle Escape key and outside click for column dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isColDropdownOpen) {
          setIsColDropdownOpen(false);
        } else {
          onClose();
        }
      }
    };
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-col-dropdown]') && !target.closest('[data-col-dropdown-menu]')) {
        setIsColDropdownOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, isColDropdownOpen, onClose]);

  // Compute stage zoom scale so landscape or portrait sheet fits on narrow screens
  useLayoutEffect(() => {
    if (!isOpen) return;

    const computeScale = () => {
      if (stageRef.current) {
        const availW = Math.max(100, stageRef.current.clientWidth - 32);
        if (availW < targetPaperWidth) {
          setAutoZoomScale(Math.min(1, Math.max(0.2, availW / targetPaperWidth)));
        } else {
          setAutoZoomScale(1);
        }
      }
      if (containerRef.current) {
        setContentHeight(containerRef.current.offsetHeight);
      }
    };

    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [isOpen, columns, effectiveFontScale, targetPaperWidth]);

  const handleExportPdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await downloadOrShareSongPdf({
        song,
        columns,
        fontScale: effectiveFontScale,
      });
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleNativePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: song.shortName,
          text: song.body,
        });
      } catch {
        // User cancelled or share failed silently
      }
    } else {
      handleCopyText();
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(song.body);
      setCopiedToast(true);
      window.setTimeout(() => setCopiedToast(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const renderSectionItem = (sec: ParsedSection) => (
    <div
      key={sec.sectionIndex}
      className="break-inside-avoid print-break-inside-avoid space-y-1 overflow-hidden min-w-0"
    >
      {/* Section Header */}
      <div className="flex items-baseline gap-2 pt-1 pb-0.5 overflow-hidden whitespace-nowrap min-w-0">
        <span className="font-extrabold text-[0.88em] uppercase tracking-wider text-black truncate shrink-0">
          {sec.fullHeader}
        </span>
        {sec.isRepeatOfSectionIndex !== null && (
          <span className="text-[0.75em] text-black font-normal italic truncate">
            (Same as{' '}
            {parsed.sections[sec.isRepeatOfSectionIndex]?.fullHeader || 'earlier'})
          </span>
        )}
      </div>

      {/* Section Lines */}
      <div className="space-y-0.5 text-[0.85em] leading-relaxed overflow-hidden min-w-0">
        {sec.lines.map((line, lIdx) => (
          <div key={lIdx} className="space-y-0.25 overflow-hidden min-w-0">
            {/* Pre-line progressions */}
            {line.preLineProgressions &&
              line.preLineProgressions.map((prog, pIdx) => (
                <div key={pIdx} className="font-bold text-[0.85em] text-black whitespace-pre overflow-hidden">
                  [ {prog} ]
                </div>
              ))}

            {/* Introduced progression */}
            {line.introducedProgression && (
              <div className="font-bold text-[0.85em] text-black whitespace-pre overflow-hidden">
                [ {line.introducedProgression} ]
              </div>
            )}

            {/* Chord Over Lyric */}
            {line.chordOverLine && (
              <div className="font-bold text-black whitespace-pre leading-none pt-0.5 overflow-hidden">
                {line.chordOverLine}
              </div>
            )}

            {/* Lyric or Tab Line */}
            {line.isTabLine ? (
              <div className="font-mono text-black whitespace-pre leading-none py-0.5 overflow-hidden">
                {line.lyric}
              </div>
            ) : (
              <div className="text-black whitespace-pre leading-snug overflow-hidden">
                {line.lyric || '\u00A0'}
              </div>
            )}
          </div>
        ))}

        {/* Standalone progressions */}
        {sec.standaloneProgressions &&
          sec.standaloneProgressions.map((prog, pIdx) => (
            <div key={pIdx} className="font-bold text-[0.85em] text-black pt-1 whitespace-pre overflow-hidden">
              [ {prog} ]
            </div>
          ))}
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div
      id="print-preview-modal-root"
      role="dialog"
      aria-modal="true"
      aria-label="Print Sheet Preview"
      className="fixed inset-0 z-50 flex flex-col bg-stone-950/90 backdrop-blur-md overflow-hidden animate-in fade-in duration-150 print:bg-white print:p-0 print:m-0 print:static print:inset-auto"
    >
      {/* Dynamic @page & print isolation styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: ${columns === 1 ? 'portrait' : 'landscape'};
                margin: 10mm;
              }
              html, body {
                visibility: hidden !important;
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                overflow: visible !important;
              }
              #print-preview-modal-root {
                visibility: visible !important;
                position: static !important;
                inset: auto !important;
                width: 100% !important;
                height: auto !important;
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
              }
              #print-preview-modal-root * {
                visibility: visible !important;
              }
              .no-print,
              header {
                display: none !important;
              }
              #print-stage-scroll {
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
              }
              #print-sheet-wrapper {
                height: auto !important;
                display: block !important;
                transform: none !important;
              }
              .print-page-sheet {
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: none !important;
                min-height: auto !important;
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
                transform: none !important;
                page-break-after: always !important;
                break-after: page !important;
              }
              .print-page-sheet:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
              .page-divider-marker {
                display: none !important;
              }
              .break-inside-avoid {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            }
          `,
        }}
      />

      {/* Top Controls Toolbar - Hidden on Print */}
      <header className="bg-stone-900 border-b border-stone-800 px-2 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3 shadow-lg shrink-0 print:hidden no-print w-full flex-nowrap overflow-hidden">
        {/* Title info with icon: hidden on mobile/phone screens, visible on iPad/laptop/desktop */}
        <div className="hidden md:flex items-center gap-2 min-w-0 shrink">
          <div className="p-1.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-stone-100 truncate">
              Print Sheet Pre-viz • {song.shortName}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-stone-400 truncate">
              {columns === 1
                ? `1 Col (Portrait) • ${portraitPages.length} Page${portraitPages.length > 1 ? 's' : ''}`
                : `${columns} Col (Single-Page A4 Landscape Spread)`}{' '}
              • {parsed.sections.length} sections
            </p>
          </div>
        </div>

        {/* Toolbar Center / Right Controls - always stay within one row on mobile and desktop */}
        <div className="flex items-center justify-between md:justify-end gap-1 sm:gap-2 w-full md:w-auto shrink-0 flex-nowrap">
          {/* Column Layout Compact Dropdown */}
          <div className="relative shrink-0" data-col-dropdown>
            <button
              ref={colButtonRef}
              type="button"
              onClick={() => setIsColDropdownOpen((prev) => !prev)}
              className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-stone-700 bg-stone-800/90 hover:bg-stone-800 text-stone-200 text-xs font-mono font-medium flex items-center gap-1 sm:gap-1.5 transition cursor-pointer"
              title="Select Column Layout"
              aria-label="Select Column Layout"
            >
              <Columns className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{columns === 1 ? '1 Col' : columns === 2 ? '2 Col' : '3 Col'}</span>
              <ChevronDown className="w-3 h-3 text-stone-400 opacity-80 shrink-0" />
            </button>

            {isColDropdownOpen && (
              <div
                data-col-dropdown-menu
                style={colDropdownStyle}
                className="fixed z-50 w-52 rounded-xl bg-stone-900 border border-stone-700 shadow-2xl py-1 text-stone-100 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-stone-400 border-b border-stone-800">
                  Paper Layout
                </div>
                {[
                  { count: 1, label: '1 Col', desc: 'Portrait Multi-Page' },
                  { count: 2, label: '2 Col', desc: 'Single-Page Landscape' },
                  { count: 3, label: '3 Col', desc: 'Single-Page Landscape' },
                ].map((opt) => (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => {
                      setColumns(opt.count);
                      setManualFontScale(null);
                      setIsColDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs font-mono cursor-pointer transition ${
                      columns === opt.count
                        ? 'bg-amber-400/15 text-amber-300 font-semibold'
                        : 'text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{opt.label}</div>
                      <div className="text-[10px] text-stone-400 font-sans">{opt.desc}</div>
                    </div>
                    {columns === opt.count && <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text Size Scale - minimal -/+ on phone aspect, A-/A+ with % on larger screens */}
          <div className="inline-flex items-center gap-0.5 sm:gap-1 bg-stone-950 border border-stone-800 rounded-lg px-1 sm:px-1.5 py-1 text-xs font-mono text-stone-300 shrink-0">
            <button
              type="button"
              onClick={() => setManualFontScale(Math.max(50, effectiveFontScale - 5))}
              className="text-stone-400 hover:text-stone-100 px-1 py-0.5 font-bold cursor-pointer transition flex items-center justify-center"
              title="Shrink text"
              aria-label="Shrink text"
            >
              <span className="sm:hidden font-bold text-xs leading-none">−</span>
              <span className="hidden sm:inline font-bold">A−</span>
            </button>
            <span className="hidden sm:inline text-[10px] text-stone-400 min-w-[32px] text-center">
              {effectiveFontScale}%
            </span>
            <button
              type="button"
              onClick={() => setManualFontScale(Math.min(150, effectiveFontScale + 5))}
              className="text-stone-400 hover:text-stone-100 px-1 py-0.5 font-bold cursor-pointer transition flex items-center justify-center"
              title="Enlarge text"
              aria-label="Enlarge text"
            >
              <span className="sm:hidden font-bold text-xs leading-none">+</span>
              <span className="hidden sm:inline font-bold">A+</span>
            </button>
          </div>

          {/* Copy Lead Sheet */}
          <button
            type="button"
            onClick={handleCopyText}
            className="p-1.5 sm:p-2 rounded-lg border border-stone-700 bg-stone-800/80 hover:bg-stone-800 text-stone-300 hover:text-stone-100 text-xs transition cursor-pointer shrink-0"
            title="Copy full song notation to clipboard"
            aria-label="Copy song text"
          >
            {copiedToast ? (
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>

          {/* Direct Print to Physical Printer */}
          <button
            type="button"
            onClick={handleNativePrint}
            className="p-1.5 sm:p-2 rounded-lg border border-stone-700 bg-stone-800/80 hover:bg-stone-800 text-stone-300 hover:text-stone-100 text-xs transition cursor-pointer shrink-0"
            title="Print directly via system dialog (Cmd+P / Ctrl+P)"
            aria-label="Print via system dialog"
          >
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* PDF Generate, Download or Share Primary Button */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isGeneratingPdf}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg btn-primary text-xs font-semibold flex items-center gap-1 sm:gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-60 shrink-0"
            title={
              isMobileOrTablet
                ? 'Generate and share PDF file'
                : 'Generate and download PDF file'
            }
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isMobileOrTablet ? (
              <Share2 className="w-3.5 h-3.5" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isGeneratingPdf
                ? 'Generating...'
                : isMobileOrTablet
                ? 'Share PDF'
                : 'Download PDF'}
            </span>
            <span className="sm:hidden">
              {isGeneratingPdf ? '...' : 'PDF'}
            </span>
          </button>

          {/* Close Modal */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition cursor-pointer shrink-0"
            aria-label="Close Print Preview"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* Main Preview Canvas */}
      <main
        id="print-stage-scroll"
        ref={stageRef}
        className="flex-1 overflow-auto p-3 sm:p-6 flex justify-center items-start print:p-0 print:overflow-visible"
      >
        <div
          id="print-sheet-wrapper"
          className="w-full flex justify-center items-start transition-all"
          style={{
            height: autoZoomScale < 1 ? `${contentHeight * autoZoomScale}px` : undefined,
          }}
        >
          <div
            ref={containerRef}
            style={{
              transform: autoZoomScale < 1 ? `scale(${autoZoomScale})` : undefined,
              transformOrigin: 'top center',
            }}
            className="flex flex-col items-center gap-8 transition-transform duration-100"
          >
            {/* 1-Column Layout: Multi-Page Portrait A4 Sheets with Page Breaks */}
            {columns === 1 ? (
              portraitPages.map((pageSecs, pIdx) => {
                const isFirstPage = pIdx === 0;
                const pageNumber = pIdx + 1;
                const totalPages = portraitPages.length;

                return (
                  <React.Fragment key={pIdx}>
                    {/* Visual Page Divider in Preview */}
                    {!isFirstPage && (
                      <div className="page-divider-marker no-print flex items-center gap-3 text-xs font-mono text-stone-400 w-full max-w-[680px]">
                        <div className="h-px bg-stone-700/80 flex-1 border-t border-dashed border-stone-600" />
                        <span className="bg-stone-900 border border-stone-700 px-2 py-0.5 rounded text-[11px] text-stone-300">
                          Page {pageNumber} of {totalPages} (A4 Portrait Break)
                        </span>
                        <div className="h-px bg-stone-700/80 flex-1 border-t border-dashed border-stone-600" />
                      </div>
                    )}

                    <div
                      className="print-page-sheet bg-white text-black shadow-2xl rounded-sm font-mono p-8 sm:p-10 shrink-0 flex flex-col justify-between overflow-hidden print:shadow-none print:p-0 print:rounded-none"
                      style={{
                        width: `${targetPaperWidth}px`,
                        height: `${a4PageHeight}px`,
                        maxHeight: `${a4PageHeight}px`,
                        fontSize: `${(effectiveFontScale / 100) * 0.85}rem`,
                      }}
                    >
                      {/* Top Header: Full on Page 1, compact on Page 2+ */}
                      {isFirstPage ? (
                        <div className="pb-3 mb-4 flex items-baseline justify-between gap-4 border-b border-black">
                          <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black font-mono">
                              {song.shortName}
                            </h1>
                            {parsed.preambleLines.length > 0 && (
                              <p className="text-xs text-black mt-1">
                                {parsed.preambleLines.join('  •  ')}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-[11px] text-black font-mono shrink-0">
                            <span className="font-semibold text-black">By Heart</span> Lead Sheet
                          </div>
                        </div>
                      ) : (
                        <div className="pb-2 mb-3 flex items-baseline justify-between gap-4 border-b border-black text-xs font-mono text-black">
                          <span className="font-bold">{song.shortName} (cont.)</span>
                          <span>
                            Page {pageNumber} of {totalPages}
                          </span>
                        </div>
                      )}

                      {/* Sections for this Page */}
                      <div className="space-y-4 flex-1 overflow-hidden min-h-0">
                        {pageSecs.map(renderSectionItem)}
                      </div>

                      {/* Sheet Footer */}
                      <div className="mt-6 pt-2 text-[10px] text-black flex items-center justify-between border-t border-black/40">
                        <span>
                          {song.shortName} • Page {pageNumber} of {totalPages} • 1 Column (Portrait)
                        </span>
                        <span>Printed via By Heart</span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            ) : (
              /* 2 & 3 Column Layout: Single-Page Balanced A4 Landscape Spread */
              <div
                className="print-page-sheet bg-white text-black shadow-2xl rounded-sm font-mono p-6 sm:p-8 shrink-0 flex flex-col justify-between overflow-hidden print:shadow-none print:p-0 print:rounded-none"
                style={{
                  width: `${targetPaperWidth}px`,
                  height: `${a4PageHeight}px`,
                  maxHeight: `${a4PageHeight}px`,
                  fontSize: `${(effectiveFontScale / 100) * 0.85}rem`,
                }}
              >
                {/* Landscape Header */}
                <div className="pb-2.5 mb-3 flex items-baseline justify-between gap-4 border-b border-black">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-black font-mono">
                      {song.shortName}
                    </h1>
                    {parsed.preambleLines.length > 0 && (
                      <p className="text-[11px] text-black mt-0.5">
                        {parsed.preambleLines.join('  •  ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-black font-mono shrink-0">
                    <span className="font-semibold text-black">By Heart</span> Lead Sheet
                  </div>
                </div>

                {/* Contiguous Balanced Columns */}
                <div
                  className={`grid gap-6 sm:gap-8 flex-1 overflow-hidden min-h-0 ${
                    columns === 2 ? 'grid-cols-2' : 'grid-cols-3'
                  }`}
                >
                  {balancedColumns.map((colSecs, colIdx) => (
                    <div key={colIdx} className="space-y-3 min-w-0 overflow-hidden">
                      {colSecs.map(renderSectionItem)}
                    </div>
                  ))}
                </div>

                {/* Landscape Footer */}
                <div className="mt-4 pt-2 text-[10px] text-black flex items-center justify-between border-t border-black/40">
                  <span>
                    {song.shortName} • {columns} Columns (Single-Page A4 Landscape Spread)
                  </span>
                  <span>Printed via By Heart</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
