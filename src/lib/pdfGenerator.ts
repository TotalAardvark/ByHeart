import { SongItem, ParsedSection } from '../types';
import { parseSongBody } from './parser';
import {
  splitIntoBalancedColumns,
  estimateItemVisualWeight,
  estimateItemCharWidth,
} from './layoutUtils';

const A4_PORTRAIT_WIDTH = 595.28;
const A4_PORTRAIT_HEIGHT = 841.89;
const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;

function escapePdfText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/•/g, '\\225')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[\xA0-\xFF]/g, (ch) => `\\${ch.charCodeAt(0).toString(8).padStart(3, '0')}`)
    .replace(/[^\x20-\x7E]/g, ' ');
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

export interface GeneratePdfOptions {
  song: SongItem;
  columns: number;
  fontScale?: number;
}

export function generateSongPdfBlob(options: GeneratePdfOptions): Blob {
  const { song, columns } = options;
  const parsed = parseSongBody(song.body, song.chunkSize);
  const isPortrait = columns <= 1;

  const pageWidth = isPortrait ? A4_PORTRAIT_WIDTH : A4_LANDSCAPE_WIDTH;
  const pageHeight = isPortrait ? A4_PORTRAIT_HEIGHT : A4_LANDSCAPE_HEIGHT;

  // Calculate layout
  const balancedColumns = isPortrait
    ? [parsed.sections]
    : splitIntoBalancedColumns(parsed.sections, columns, (sec) =>
        getSectionWeight(sec)
      );

  // Compute font scaling
  let scale = 1.0;
  if (!isPortrait) {
    const marginY = 48;
    const headerH = 46;
    const footerH = 24;
    const usableH = pageHeight - marginY - headerH - footerH;

    const marginX = 56;
    const colGap = columns === 2 ? 24 : 18;
    const usableW = pageWidth - marginX - (columns - 1) * colGap;
    const colW = usableW / columns;

    let maxWeight = 1;
    let maxChars = 24;
    for (const col of balancedColumns) {
      let colWgt = Math.max(0, col.length - 1) * 0.9;
      let colCh = 24;
      for (const sec of col) {
        colWgt += getSectionWeight(sec);
        colCh = Math.max(colCh, getSectionCharWidth(sec));
      }
      maxWeight = Math.max(maxWeight, colWgt);
      maxChars = Math.max(maxChars, colCh);
    }

    const baseLineH = 13.0;
    const baseCharW = 5.7; // Courier at 9.5pt has width 9.5 * 0.6 = 5.7pt

    const estH = maxWeight * baseLineH;
    const estW = maxChars * baseCharW;

    const scaleY = usableH / Math.max(1, estH);
    const scaleX = colW / Math.max(1, estW);

    scale = Math.max(0.55, Math.min(1.05, Math.min(scaleY, scaleX)));
  }

  if (options.fontScale) {
    scale = (options.fontScale / 100);
  }

  // Partition pages
  let pagesData: ParsedSection[][][] = []; // [pageIdx][columnIdx][sectionIdx]

  if (!isPortrait) {
    // Single landscape page containing all balanced columns
    pagesData = [balancedColumns];
  } else {
    // Multi-page portrait partitioning
    const marginY = 56;
    const footerH = 24;
    const baseLineH = 13.0 * scale;

    const page1HeaderH = 54;
    const page1UsableH = pageHeight - marginY - page1HeaderH - footerH;
    const page1Budget = Math.max(15, page1UsableH / baseLineH);

    const laterHeaderH = 28;
    const laterUsableH = pageHeight - marginY - laterHeaderH - footerH;
    const laterBudget = Math.max(18, laterUsableH / baseLineH);

    const pages: ParsedSection[][] = [];
    let curPage: ParsedSection[] = [];
    let curWeight = 0;

    for (const sec of parsed.sections) {
      const secW = getSectionWeight(sec) + (curPage.length > 0 ? 0.9 : 0);
      const budget = pages.length === 0 ? page1Budget : laterBudget;

      if (curPage.length > 0 && curWeight + secW > budget) {
        pages.push(curPage);
        curPage = [sec];
        curWeight = getSectionWeight(sec);
      } else {
        curPage.push(sec);
        curWeight += secW;
      }
    }
    if (curPage.length > 0) {
      pages.push(curPage);
    }

    pagesData = pages.map((p) => [p]);
  }

  const totalPages = pagesData.length;

  // Build PDF streams
  const pageStreams: string[] = [];

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const pageCols = pagesData[pIdx];
    const pageNum = pIdx + 1;
    const isFirstPage = pIdx === 0;

    const streamCommands: string[] = [];

    // Helper to draw text
    const drawText = (
      font: 'F1' | 'F2' | 'F3' | 'F4',
      size: number,
      x: number,
      y: number,
      text: string
    ) => {
      streamCommands.push(
        `BT /${font} ${size.toFixed(2)} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`
      );
    };

    // Helper to draw horizontal line
    const drawLine = (x1: number, y1: number, x2: number, y2: number, width = 0.5) => {
      streamCommands.push(
        `q ${width.toFixed(2)} w 0 0 0 RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`
      );
    };

    let contentTopY = pageHeight - 32;

    if (isPortrait) {
      const marginX = 36;
      const rightX = pageWidth - marginX;

      if (isFirstPage) {
        // Full Header
        drawText('F4', 18, marginX, pageHeight - 44, song.shortName);
        if (parsed.preambleLines.length > 0) {
          drawText(
            'F3',
            8.5,
            marginX,
            pageHeight - 57,
            parsed.preambleLines.join('  •  ')
          );
        }
        drawText('F4', 8.5, rightX - 95, pageHeight - 44, 'By Heart Lead Sheet');

        drawLine(marginX, pageHeight - 64, rightX, pageHeight - 64, 0.75);
        contentTopY = pageHeight - 78;
      } else {
        // Compact continuation header
        drawText('F4', 9.5, marginX, pageHeight - 38, `${song.shortName} (cont.)`);
        drawText(
          'F3',
          8.5,
          rightX - 60,
          pageHeight - 38,
          `Page ${pageNum} of ${totalPages}`
        );
        drawLine(marginX, pageHeight - 44, rightX, pageHeight - 44, 0.5);
        contentTopY = pageHeight - 56;
      }

      // Render 1 column
      let curY = contentTopY;
      const fontSize = 9.5 * scale;
      const lineH = 13.0 * scale;
      const headerFontSize = 9.0 * scale;
      const colWidth = rightX - marginX;
      const maxChars = Math.max(10, Math.floor(colWidth / (fontSize * 0.6)));
      const maxHeaderChars = Math.max(10, Math.floor(colWidth / (headerFontSize * 0.6)));
      const fitText = (str: string, max: number = maxChars) =>
        str.length > max ? str.slice(0, max) : str;

      for (const sec of pageCols[0]) {
        // Section Header
        drawText('F2', headerFontSize, marginX, curY, fitText(sec.fullHeader, maxHeaderChars));
        if (sec.isRepeatOfSectionIndex !== null) {
          const refHeader =
            parsed.sections[sec.isRepeatOfSectionIndex]?.fullHeader || 'earlier';
          const headerLen = fitText(sec.fullHeader, maxHeaderChars).length * (headerFontSize * 0.6);
          drawText(
            'F1',
            headerFontSize * 0.85,
            marginX + headerLen + 8,
            curY,
            fitText(`(Same as ${refHeader})`, Math.max(5, maxHeaderChars - sec.fullHeader.length))
          );
        }
        curY -= lineH * 1.15;

        // Lines
        for (const line of sec.lines) {
          if (line.preLineProgressions) {
            for (const prog of line.preLineProgressions) {
              drawText('F2', fontSize * 0.9, marginX, curY, fitText(`[ ${prog} ]`));
              curY -= lineH;
            }
          }
          if (line.introducedProgression) {
            drawText('F2', fontSize * 0.9, marginX, curY, fitText(`[ ${line.introducedProgression} ]`));
            curY -= lineH;
          }
          if (line.chordOverLine) {
            drawText('F2', fontSize, marginX, curY, fitText(line.chordOverLine));
            curY -= lineH * 0.95;
          }
          if (line.isTabLine) {
            drawText('F1', fontSize * 0.9, marginX, curY, fitText(line.lyric));
            curY -= lineH * 0.95;
          } else if (line.lyric) {
            drawText('F1', fontSize, marginX, curY, fitText(line.lyric));
            curY -= lineH;
          }
        }

        if (sec.standaloneProgressions) {
          for (const prog of sec.standaloneProgressions) {
            drawText('F2', fontSize * 0.9, marginX, curY, fitText(`[ ${prog} ]`));
            curY -= lineH;
          }
        }

        curY -= lineH * 0.6; // Inter-section spacing
      }

      // Footer
      const footerY = 28;
      drawLine(marginX, footerY + 12, rightX, footerY + 12, 0.5);
      drawText(
        'F3',
        7.5,
        marginX,
        footerY,
        `${song.shortName} • Page ${pageNum} of ${totalPages} • 1 Column (Portrait)`
      );
      drawText('F3', 7.5, rightX - 80, footerY, 'Printed via By Heart');
    } else {
      // Landscape Single Page
      const marginX = 40;
      const rightX = pageWidth - marginX;

      // Header
      drawText('F4', 16, marginX, pageHeight - 38, song.shortName);
      if (parsed.preambleLines.length > 0) {
        drawText(
          'F3',
          8,
          marginX,
          pageHeight - 49,
          parsed.preambleLines.join('  •  ')
        );
      }
      drawText('F4', 8.5, rightX - 95, pageHeight - 38, 'By Heart Lead Sheet');
      drawLine(marginX, pageHeight - 54, rightX, pageHeight - 54, 0.75);

      contentTopY = pageHeight - 68;

      const numCols = pageCols.length;
      const colGap = numCols === 2 ? 26 : 18;
      const usableW = rightX - marginX - (numCols - 1) * colGap;
      const colWidth = usableW / numCols;

      const fontSize = 9.0 * scale;
      const lineH = 12.5 * scale;
      const headerFontSize = 8.5 * scale;

      const maxChars = Math.max(10, Math.floor(colWidth / (fontSize * 0.6)));
      const maxHeaderChars = Math.max(10, Math.floor(colWidth / (headerFontSize * 0.6)));
      const minContentY = 38; // Footer line is at 34, footer text at 24
      const fitText = (str: string, max: number = maxChars) =>
        str.length > max ? str.slice(0, max) : str;

      for (let cIdx = 0; cIdx < numCols; cIdx++) {
        const colSecs = pageCols[cIdx];
        const colStartX = marginX + cIdx * (colWidth + colGap);
        let curY = contentTopY;

        for (const sec of colSecs) {
          if (curY < minContentY) break;

          // Section Header
          drawText('F2', headerFontSize, colStartX, curY, fitText(sec.fullHeader, maxHeaderChars));
          if (sec.isRepeatOfSectionIndex !== null) {
            const refHeader =
              parsed.sections[sec.isRepeatOfSectionIndex]?.fullHeader || 'earlier';
            const headerLen = fitText(sec.fullHeader, maxHeaderChars).length * (headerFontSize * 0.6);
            drawText(
              'F1',
              headerFontSize * 0.85,
              colStartX + headerLen + 6,
              curY,
              fitText(`(Same as ${refHeader})`, Math.max(5, maxHeaderChars - sec.fullHeader.length))
            );
          }
          curY -= lineH * 1.1;

          // Lines
          for (const line of sec.lines) {
            if (curY < minContentY) break;

            if (line.preLineProgressions) {
              for (const prog of line.preLineProgressions) {
                if (curY < minContentY) break;
                drawText('F2', fontSize * 0.9, colStartX, curY, fitText(`[ ${prog} ]`));
                curY -= lineH;
              }
            }
            if (line.introducedProgression) {
              if (curY < minContentY) break;
              drawText('F2', fontSize * 0.9, colStartX, curY, fitText(`[ ${line.introducedProgression} ]`));
              curY -= lineH;
            }
            if (line.chordOverLine) {
              if (curY < minContentY) break;
              drawText('F2', fontSize, colStartX, curY, fitText(line.chordOverLine));
              curY -= lineH * 0.92;
            }
            if (line.isTabLine) {
              if (curY < minContentY) break;
              drawText('F1', fontSize * 0.9, colStartX, curY, fitText(line.lyric));
              curY -= lineH * 0.92;
            } else if (line.lyric) {
              if (curY < minContentY) break;
              drawText('F1', fontSize, colStartX, curY, fitText(line.lyric));
              curY -= lineH;
            }
          }

          if (sec.standaloneProgressions) {
            for (const prog of sec.standaloneProgressions) {
              if (curY < minContentY) break;
              drawText('F2', fontSize * 0.9, colStartX, curY, fitText(`[ ${prog} ]`));
              curY -= lineH;
            }
          }

          curY -= lineH * 0.5;
        }
      }

      // Footer
      const footerY = 24;
      drawLine(marginX, footerY + 10, rightX, footerY + 10, 0.5);
      drawText(
        'F3',
        7.5,
        marginX,
        footerY,
        `${song.shortName} • ${numCols} Columns (Single-Page A4 Landscape Spread)`
      );
      drawText('F3', 7.5, rightX - 80, footerY, 'Printed via By Heart');
    }

    pageStreams.push(streamCommands.join('\n'));
  }

  // Assemble PDF Objects
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Courier)
  // 4: Font F2 (Courier-Bold)
  // 5: Font F3 (Helvetica)
  // 6: Font F4 (Helvetica-Bold)
  // For each page:
  // Page Obj, Content Stream Obj

  const objects: string[] = [];

  const catalogObjNum = 1;
  const pagesObjNum = 2;
  const fontF1ObjNum = 3;
  const fontF2ObjNum = 4;
  const fontF3ObjNum = 5;
  const fontF4ObjNum = 6;

  const pageKidsRefs: string[] = [];
  let nextObjNum = 7;

  const pageObjNums: { pageNum: number; streamNum: number }[] = [];

  for (let i = 0; i < totalPages; i++) {
    const pageObjNum = nextObjNum++;
    const streamObjNum = nextObjNum++;
    pageObjNums.push({ pageNum: pageObjNum, streamNum: streamObjNum });
    pageKidsRefs.push(`${pageObjNum} 0 R`);
  }

  // 1: Catalog
  objects[catalogObjNum] = `<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`;

  // 2: Pages
  objects[pagesObjNum] = `<< /Type /Pages /Kids [ ${pageKidsRefs.join(' ')} ] /Count ${totalPages} >>`;

  // 3-6: Fonts
  objects[fontF1ObjNum] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`;
  objects[fontF2ObjNum] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>`;
  objects[fontF3ObjNum] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objects[fontF4ObjNum] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  // Page and Stream objects
  for (let i = 0; i < totalPages; i++) {
    const { pageNum, streamNum } = pageObjNums[i];
    const streamContent = pageStreams[i];
    const streamBytes = new TextEncoder().encode(streamContent);

    objects[pageNum] = `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [ 0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)} ] /Contents ${streamNum} 0 R /Resources << /Font << /F1 ${fontF1ObjNum} 0 R /F2 ${fontF2ObjNum} 0 R /F3 ${fontF3ObjNum} 0 R /F4 ${fontF4ObjNum} 0 R >> >> >>`;

    objects[streamNum] = `<< /Length ${streamBytes.length} >>\nstream\n${streamContent}\nendstream`;
  }

  // Serialize PDF with XRef
  let pdfString = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [0]; // obj 0 offset

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = new TextEncoder().encode(pdfString).length;
    pdfString += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const startXref = new TextEncoder().encode(pdfString).length;
  pdfString += `xref\n0 ${objects.length}\n`;
  pdfString += '0000000000 65535 f \n';

  for (let i = 1; i < objects.length; i++) {
    const offsetStr = String(offsets[i]).padStart(10, '0');
    pdfString += `${offsetStr} 00000 n \n`;
  }

  pdfString += `trailer\n<< /Size ${objects.length} /Root ${catalogObjNum} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const binaryData = new TextEncoder().encode(pdfString);
  return new Blob([binaryData], { type: 'application/pdf' });
}

/**
 * Triggers PDF export:
 * - On iOS/tablets with Web Share API file support: opens the native share sheet.
 * - On desktop or where file sharing is unsupported: triggers an immediate direct download.
 */
export async function downloadOrShareSongPdf(options: GeneratePdfOptions): Promise<void> {
  const blob = generateSongPdfBlob(options);
  const cleanName = options.song.shortName.replace(/[/\\?%*:|"<>]/g, '_');
  const fileName = `${cleanName} - By Heart Lead Sheet.pdf`;

  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
        });
        return;
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        // User cancelled share dialog, do not fallback to download
        return;
      }
      // If file share fails, fall through to browser download
    }
  }

  // Desktop or fallback direct download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
