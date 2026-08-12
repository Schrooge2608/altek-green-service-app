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
