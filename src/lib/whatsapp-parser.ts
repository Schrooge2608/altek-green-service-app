export interface ParsedWhatsAppMessage {
  idHash: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  timestampMs: number;
  senderName: string;
  text: string;
}

const SYSTEM_PATTERNS = [
  /messages and calls are end-to-end encrypted/i,
  /created group/i,
  /changed the subject/i,
  /changed this group's icon/i,
  /changed the group description/i,
  /\badded\b.*\bto the group\b/i,
  /\bleft$/i,
  /\bjoined using this group's invite link/i,
  /^<media omitted>$/i,
  /^image omitted$/i,
  /^video omitted$/i,
  /^audio omitted$/i,
  /^document omitted$/i,
  /^sticker omitted$/i,
  /^this message was deleted\.?$/i,
  /^you deleted this message\.?$/i,
];

function parseDateParts(rawDate: string, rawTime: string): { dateStr: string; timeStr: string; timestampMs: number } | null {
  const cleanDate = rawDate.trim();
  const cleanTime = rawTime.trim();

  // Parse time (supports "14:30", "14:30:15", "2:30 PM", "2:30:15 pm")
  const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm|a\.m\.|p\.m\.)?$/);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
  const meridiem = timeMatch[4]?.toLowerCase();

  if (meridiem) {
    if (meridiem.startsWith('p') && hours < 12) hours += 12;
    if (meridiem.startsWith('a') && hours === 12) hours = 0;
  }

  // Parse date:
  // Format 1: YYYY/MM/DD or YYYY-MM-DD
  let year = 0;
  let month = 0;
  let day = 0;

  const ymdMatch = cleanDate.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    month = parseInt(ymdMatch[2], 10);
    day = parseInt(ymdMatch[3], 10);
  } else {
    // Format 2: DD/MM/YYYY or MM/DD/YYYY or DD/MM/YY
    const dmyMatch = cleanDate.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!dmyMatch) return null;
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    let p3 = parseInt(dmyMatch[3], 10);
    if (p3 < 100) p3 += 2000;
    year = p3;

    // In South Africa / UK, DD/MM/YYYY is standard unless p2 > 12 (which means MM/DD/YYYY)
    if (p2 > 12 && p1 <= 12) {
      month = p1;
      day = p2;
    } else {
      day = p1;
      month = p2;
    }
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dateObj = new Date(year, month - 1, day, hours, minutes, seconds);
  if (isNaN(dateObj.getTime())) return null;

  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hours).padStart(2, '0');
  const min = String(minutes).padStart(2, '0');

  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    timeStr: `${hh}:${min}`,
    timestampMs: dateObj.getTime(),
  };
}

function simpleHash(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Parses a WhatsApp Export (.txt) or copied WhatsApp group transcript into structured messages.
 * Preserves historical timestamps (including 1+ year old messages) and merges multi-line messages.
 */
export function parseWhatsAppTranscript(rawTranscript: string): ParsedWhatsAppMessage[] {
  if (!rawTranscript || !rawTranscript.trim()) return [];

  const lines = rawTranscript.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const parsed: ParsedWhatsAppMessage[] = [];

  // Matches both Android/Web:
  //   "2025/11/14, 18:42 - Fritz Schroeder: Pump 1 tripped on earth fault"
  //   "14/11/2025, 18:42 - Fritz Schroeder: Pump 1 tripped"
  // And iOS/Bracketed:
  //   "[2025/11/14, 18:42:10] Fritz Schroeder: Pump 1 tripped"
  //   "[18:42, 14/11/2025] Fritz Schroeder: Pump 1 tripped" (copied selection format)
  const lineRegexStandard = /^\[?(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\]?(?:\s*-\s*|\s+)([^:]+):\s*(.*)$/;
  const lineRegexCopiedSelection = /^\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?),\s*(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4})\]\s+([^:]+):\s*(.*)$/;

  for (const rawLine of lines) {
    // Strip invisible directional marks that WhatsApp inserts (\u200e, \u202a, etc.)
    const line = rawLine.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trimEnd();
    if (!line.trim()) continue;

    let datePart = '';
    let timePart = '';
    let senderName = '';
    let messageBody = '';
    let matched = false;

    const m1 = line.match(lineRegexStandard);
    if (m1) {
      datePart = m1[1];
      timePart = m1[2];
      senderName = m1[3].trim();
      messageBody = m1[4].trim();
      matched = true;
    } else {
      const m2 = line.match(lineRegexCopiedSelection);
      if (m2) {
        timePart = m2[1];
        datePart = m2[2];
        senderName = m2[3].trim();
        messageBody = m2[4].trim();
        matched = true;
      }
    }

    if (matched) {
      const dt = parseDateParts(datePart, timePart);
      if (dt) {
        if (SYSTEM_PATTERNS.some((rx) => rx.test(messageBody))) {
          continue;
        }
        const hash = `wa_${dt.dateStr}_${dt.timeStr}_${simpleHash(`${senderName}:${messageBody}`)}`;
        parsed.push({
          idHash: hash,
          dateStr: dt.dateStr,
          timeStr: dt.timeStr,
          timestampMs: dt.timestampMs,
          senderName,
          text: messageBody,
        });
        continue;
      }
    }

    // Continuation of previous multi-line message
    if (parsed.length > 0) {
      const prev = parsed[parsed.length - 1];
      prev.text = `${prev.text}\n${line.trim()}`;
      prev.idHash = `wa_${prev.dateStr}_${prev.timeStr}_${simpleHash(`${prev.senderName}:${prev.text}`)}`;
    }
  }

  return parsed;
}
