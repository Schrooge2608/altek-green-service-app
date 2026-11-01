import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Checks if a URL points to a PDF document.
 */
export const isPdfUrl = (url: string) => {
  if (!url) return false;
  return url.toLowerCase().includes('.pdf') || url.includes('application/pdf');
};

/**
 * Extracts a readable filename from a Firebase Storage URL or path.
 */
export const getFileNameFromUrl = (url: string) => {
  if (!url) return 'Document';
  try {
    const decoded = decodeURIComponent(url);
    const pathPart = decoded.split('?')[0];
    const parts = pathPart.split('/');
    const rawName = parts[parts.length - 1];
    // Remove the timestamp prefix often used in our uploads
    return rawName.includes('_') ? rawName.split('_').slice(1).join('_') : rawName;
  } catch {
    return 'Document.pdf';
  }
};

/**
 * Fallback UUID generator that works on non-secure contexts (HTTP/mobile).
 */
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-HTTPS dev environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Normalizes and formats AI-generated Markdown text, ensuring that Markdown tables
 * are properly structured with newlines before the table, between each row, and after the table.
 * Fixes issues where the LLM collapses table rows onto a single line (e.g. "| col | |---|" or "| row1 | | row2 |").
 */
export function formatMarkdownTables(markdown: string): string {
  if (!markdown) return '';
  let text = markdown
    .replace(/\\n/g, '\n')
    .replace(/^"|"$/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])\s*•\s+/g, '$1\n\n• ');

  const lines = text.split('\n');
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line contains table cells (at least 2 pipes)
    if (trimmed.includes('|') && (trimmed.match(/\|/g) || []).length >= 2) {
      // 1. Separate leading text if text precedes the table on the same line
      let prefixText = '';
      let tablePart = trimmed;
      const firstPipeIdx = trimmed.indexOf('|');
      if (firstPipeIdx > 0) {
        prefixText = trimmed.slice(0, firstPipeIdx).trim();
        tablePart = trimmed.slice(firstPipeIdx).trim();
      }

      // 2. Separate trailing text if text follows the table on the same line
      let suffixText = '';
      const lastPipeIdx = tablePart.lastIndexOf('|');
      if (lastPipeIdx < tablePart.length - 1) {
        suffixText = tablePart.slice(lastPipeIdx + 1).trim();
        tablePart = tablePart.slice(0, lastPipeIdx + 1).trim();
      }

      if (prefixText) {
        processedLines.push(prefixText);
        processedLines.push('');
      } else if (
        processedLines.length > 0 &&
        processedLines[processedLines.length - 1].trim() !== '' &&
        !processedLines[processedLines.length - 1].trim().startsWith('|')
      ) {
        processedLines.push('');
      }

      // If line contains multiple rows separated by '| |' or '|  |'
      if (/\|\s*\|/.test(tablePart)) {
        const normalizedTable = tablePart.replace(/\|\s*\|/g, '|\n|');
        const splitRows = normalizedTable.split('\n');
        for (const r of splitRows) {
          const rTrim = r.trim();
          if (rTrim) {
            processedLines.push(rTrim);
          }
        }
      } else {
        processedLines.push(tablePart);
      }

      if (suffixText) {
        processedLines.push('');
        processedLines.push(suffixText);
      } else {
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
        if (!nextLine.startsWith('|') && nextLine !== '') {
          processedLines.push('');
        }
      }
      continue;
    }

    processedLines.push(line);
  }

  let result = processedLines.join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
}
