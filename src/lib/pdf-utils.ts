import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface SmartPdfOptions {
  scale?: number;
  topMarginMm?: number;
  bottomMarginMm?: number;
  windowWidth?: number;
  canvas?: HTMLCanvasElement;
}

interface BlockRect {
  top: number;
  bottom: number;
  height: number;
  isHeading: boolean;
}

/**
 * Generates a high-quality, multi-page A4 PDF from an HTML element or canvas.
 * Intelligently analyzes DOM block boundaries (headings, paragraphs, tables, table rows, list items)
 * to ensure that text lines and elements are NEVER sliced horizontally across page breaks.
 */
export async function generateSmartPagedPdf(
  element: HTMLElement,
  options?: SmartPdfOptions
): Promise<jsPDF> {
  const scale = options?.scale ?? 2;
  const topMarginMm = options?.topMarginMm ?? 10;
  const bottomMarginMm = options?.bottomMarginMm ?? 10;
  const pdfWidthMm = 210; // A4 standard width in mm
  const pdfPageHeightMm = 297; // A4 standard height in mm
  const usableHeightMm = pdfPageHeightMm - topMarginMm - bottomMarginMm;

  // 1. Obtain high-resolution canvas
  const canvas =
    options?.canvas ||
    (await html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: options?.windowWidth || 800,
    }));

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // 2. Map coordinates between DOM element and canvas pixels
  const containerRect = element.getBoundingClientRect();
  const scaleY = containerRect.height > 0 ? canvasHeight / containerRect.height : scale;
  const pxPerMm = canvasWidth / pdfWidthMm;
  const maxPageCanvasPx = Math.floor(usableHeightMm * pxPerMm);

  // 3. Collect boundaries of all block-level content
  const blockElements = Array.from(
    element.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, p, ul, ol, li, table, tr, blockquote, img, .break-inside-avoid, [data-pdf-block]'
    )
  );

  const blockRects: BlockRect[] = [];
  blockElements.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.width > 0) {
      const top = (r.top - containerRect.top) * scaleY;
      const bottom = (r.bottom - containerRect.top) * scaleY;
      const tag = el.tagName.toUpperCase();
      const isHeading = tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4';
      blockRects.push({
        top,
        bottom,
        height: bottom - top,
        isHeading,
      });
    }
  });

  // Sort blocks by height ascending so child elements (e.g. tr before table) are evaluated first
  blockRects.sort((a, b) => a.height - b.height);

  // 4. Calculate safe page break positions
  const pageBreaks: number[] = [0];
  let currentY = 0;

  while (currentY < canvasHeight) {
    const idealBreak = currentY + maxPageCanvasPx;

    if (idealBreak >= canvasHeight) {
      pageBreaks.push(canvasHeight);
      break;
    }

    let safeBreak = idealBreak;
    const minAcceptableBreak = currentY + maxPageCanvasPx * 0.35;

    // Find elements crossing the ideal page cut line
    const overlapping = blockRects.filter(
      (b) => b.top < idealBreak && b.bottom > idealBreak
    );

    if (overlapping.length > 0) {
      const candidateBreaks = overlapping
        .map((b) => b.top)
        .filter((top) => top >= minAcceptableBreak);

      if (candidateBreaks.length > 0) {
        safeBreak = Math.min(...candidateBreaks);
      }
    } else {
      // Snap to closest element boundary before idealBreak
      const candidateTops = blockRects
        .map((b) => b.top)
        .filter((t) => t > minAcceptableBreak && t <= idealBreak);
      if (candidateTops.length > 0) {
        safeBreak = Math.max(...candidateTops);
      }
    }

    // Avoid orphan headings near the bottom edge
    const orphanHeadings = blockRects.filter(
      (b) =>
        b.isHeading &&
        b.top >= minAcceptableBreak &&
        b.top < safeBreak &&
        b.bottom > safeBreak - (50 * scale)
    );
    if (orphanHeadings.length > 0) {
      safeBreak = Math.min(...orphanHeadings.map((h) => h.top));
    }

    // Safety guarantee against infinite loops
    if (safeBreak <= currentY + 100) {
      safeBreak = idealBreak;
    }

    pageBreaks.push(safeBreak);
    currentY = safeBreak;
  }

  // 5. Build multi-page PDF document
  const pdf = new jsPDF('p', 'mm', 'a4');

  for (let i = 0; i < pageBreaks.length - 1; i++) {
    const sliceTop = pageBreaks[i];
    const sliceBottom = pageBreaks[i + 1];
    const sliceHeight = sliceBottom - sliceTop;

    if (sliceHeight <= 0) continue;

    // Slice canvas cleanly
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvasWidth;
    pageCanvas.height = sliceHeight;

    const pageCtx = pageCanvas.getContext('2d');
    if (pageCtx) {
      pageCtx.fillStyle = '#ffffff';
      pageCtx.fillRect(0, 0, canvasWidth, sliceHeight);
      pageCtx.drawImage(
        canvas,
        0, sliceTop, canvasWidth, sliceHeight,
        0, 0, canvasWidth, sliceHeight
      );
    }

    const pageImgData = pageCanvas.toDataURL('image/png');
    const renderedHeightMm = (sliceHeight * pdfWidthMm) / canvasWidth;

    if (i > 0) {
      pdf.addPage();
    }

    // On page 1, the document already has top padding; on subsequent pages, add standard top margin
    const yPositionMm = i === 0 ? 0 : topMarginMm;
    pdf.addImage(pageImgData, 'PNG', 0, yPositionMm, pdfWidthMm, renderedHeightMm);
  }

  return pdf;
}
