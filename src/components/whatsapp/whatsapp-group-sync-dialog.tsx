'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare,
  Calendar,
  Loader2,
  CheckCircle2,
  Sparkles,
  CheckSquare,
  Square,
  QrCode,
  RefreshCw,
  Filter,
  Smartphone,
  Wifi,
  Unlink,
  ShieldCheck,
  Upload,
  FileText,
  Database,
  Wrench,
  Send,
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  addDoc,
  getDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  extractFsrFromChat,
  extractDailyDiaryFromChat,
  type ExtractFsrFromChatOutput,
  type ExtractDailyDiaryFromChatOutput,
} from '@/ai/flows/extract-fsr-from-chat-flow';
import type { Channel, FieldServiceReport, DailyDiary } from '@/lib/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface WhatsAppLiveGroup {
  jid: string;
  subject: string;
  participantsCount: number;
  messageCount: number;
  earliestDate: string | null;
  latestDate: string | null;
}

interface WhatsAppBufferedMessage {
  id: string;
  groupJid: string;
  groupName?: string;
  senderName: string;
  text: string;
  timestampMs: number;
  dateStr: string;
  timeStr: string;
}

interface WhatsAppSessionState {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'error';
  qrDataUrl: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  groupsCount: number;
  syncedMessagesCount: number;
  lastError: string | null;
  groups: WhatsAppLiveGroup[];
}

interface StoredWhatsAppGroup {
  id: string;
  name: string;
  whatsappJid?: string;
  earliestDate?: string;
  latestDate?: string;
  totalMessagesCount?: number;
  updatedAt?: any;
}

interface ParsedExportMessage {
  id: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  timestampMs: number;
  senderName: string;
  text: string;
}

interface EquipmentOption {
  id: string;
  name: string;
  fullLabel: string;
  oem: string;
  model: string;
  serialNo: string;
  rating: string;
  location: string;
  plant: 'Mining' | 'Smelter';
  mineArea: string;
  subsectionTags: string[];
}

const MINING_MINES = ['MPA', 'MPC', 'MPD', 'MPE', 'Pump Stations'] as const;
const MINING_SUBSECTIONS = [
  'Dredger',
  'Concentrator',
  'Boosters',
  'Tails Boosters',
  'Cons Boosters',
  'Surge Bin',
  'Dry Mining',
  "UPS/BTU's",
] as const;
const PUMP_STATION_SUBSECTIONS = ['Nhlabane', 'Mposa', 'Monzi', 'Return Water Boosters'] as const;
const SMELTER_SUBSECTIONS = [
  'MSP',
  'Roaster',
  'Char Plant',
  'Smelter',
  'Iron Injection',
  'Stripping Crane',
  'Slag Plant',
  'North Screen',
  "UPS/BTU's",
] as const;

function classifyEquipmentRecord(eq: any): {
  plant: 'Mining' | 'Smelter';
  mineArea: string;
  subsectionTags: string[];
} {
  const rawPlant = String(eq.plant || '').trim();
  const rawLocation = String(eq.location || '').trim();
  const rawDivision = String(eq.division || '').trim();
  const rawMcc = String(eq.mcc || '').trim();
  const rawName = String(eq.name || '').trim();
  const combined = `${rawPlant} ${rawLocation} ${rawDivision} ${rawMcc} ${rawName}`.toUpperCase();

  const isSmelter =
    rawPlant.toLowerCase() === 'smelter' ||
    (!rawPlant &&
      /\b(MSP|ROASTER|CHAR PLANT|IRON INJECTION|STRIPPING CRANE|SLAG PLANT|NORTH SCREEN|SMELTER)\b/.test(combined));

  const plant: 'Mining' | 'Smelter' = isSmelter ? 'Smelter' : 'Mining';

  let mineArea = 'Other';
  if (plant === 'Mining') {
    if (/\bMPA\b/.test(combined)) mineArea = 'MPA';
    else if (/\bMPB\b/.test(combined)) mineArea = 'MPB';
    else if (/\bMPC\b/.test(combined)) mineArea = 'MPC';
    else if (/\bMPD\b/.test(combined)) mineArea = 'MPD';
    else if (/\bMPE\b/.test(combined)) mineArea = 'MPE';
    else if (/\b(NHLABANE|MPOSA|MONZI|RETURN WATER|RWBS|PUMP STATION|PUMP STATIONS)\b/.test(combined)) {
      mineArea = 'Pump Stations';
    }
  } else {
    mineArea = 'Smelter';
  }

  const tags = new Set<string>();
  const structureText = `${rawDivision} ${rawMcc} ${rawLocation}`.toUpperCase();

  if (plant === 'Mining') {
    if (structureText.includes('DREDG') || combined.includes('DREDG')) tags.add('Dredger');
    if (
      structureText.includes('CONCENTRATOR') ||
      structureText.includes('CONS MCC') ||
      rawDivision === 'Concentrator Plant'
    ) {
      tags.add('Concentrator');
    }
    if (structureText.includes('SURGE BIN') || structureText.includes('SURGE')) {
      tags.add('Surge Bin');
    }
    if (structureText.includes('TAILS BOOSTER') || /\bTB\d+\b/.test(combined)) {
      tags.add('Tails Boosters');
      tags.add('Boosters');
    }
    if (structureText.includes('CONS BOOSTER') || /\bCB\d+\b/.test(combined)) {
      tags.add('Cons Boosters');
      tags.add('Boosters');
    }
    if (structureText.includes('BOOSTER') || combined.includes('BOOSTER')) {
      tags.add('Boosters');
    }
    if (structureText.includes('DRY MINING') || combined.includes('DRY MINING')) {
      tags.add('Dry Mining');
    }
    if (structureText.includes('UPS') || structureText.includes('BTU') || eq.equipmentProfile === 'UPS/BTU') {
      tags.add("UPS/BTU's");
    }
    if (combined.includes('NHLABANE')) tags.add('Nhlabane');
    if (combined.includes('MPOSA')) tags.add('Mposa');
    if (combined.includes('MONZI')) tags.add('Monzi');
    if (combined.includes('RETURN WATER') || combined.includes('RWBS')) {
      tags.add('Return Water Boosters');
      tags.add('Boosters');
    }
  } else {
    if (combined.includes('MSP')) tags.add('MSP');
    if (combined.includes('ROASTER')) tags.add('Roaster');
    if (combined.includes('CHAR')) tags.add('Char Plant');
    if (rawDivision.toLowerCase() === 'smelter' || combined.includes('FURNACE') || combined.includes('SMELTER')) {
      tags.add('Smelter');
    }
    if (combined.includes('IRON INJECTION')) tags.add('Iron Injection');
    if (combined.includes('STRIPPING CRANE')) tags.add('Stripping Crane');
    if (combined.includes('SLAG')) tags.add('Slag Plant');
    if (combined.includes('NORTH SCREEN')) tags.add('North Screen');
    if (combined.includes('UPS') || combined.includes('BTU') || eq.equipmentProfile === 'UPS/BTU') {
      tags.add("UPS/BTU's");
    }
  }

  return {
    plant,
    mineArea,
    subsectionTags: Array.from(tags),
  };
}

interface FsrSummaryOption {
  id: string;
  fsrReference: string;
  date: string;
  assetName: string;
  customer: string;
  status: string;
}

interface DailyDiarySummaryOption {
  id: string;
  date: string;
  area: string;
  workSummary: string;
}

function isOfficeHoursTime(timeStr?: string): boolean {
  if (!timeStr) return false;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0] || '', 10);
  const m = parseInt(parts[1] || '0', 10);
  if (isNaN(h)) return false;
  const totalMins = h * 60 + (isNaN(m) ? 0 : m);
  // 07:00 (420) to 16:00 (960) inclusive
  return totalMins >= 7 * 60 && totalMins <= 16 * 60;
}

/**
 * Returns true ONLY if the message is standalone "<video omitted>" / "<image omitted>" / "<Media omitted>"
 * (with optional "[Forwarded]" prefix) and has NO caption/text behind it.
 * If there is text behind "<image omitted>" or "<video omitted>" (e.g. "<image omitted> We got a permit..."),
 * returns false so that message stays ticked!
 */
function isStandaloneMediaOmittedMessage(text?: string): boolean {
  if (!text) return false;
  const cleaned = text.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '').trim();
  const hasMediaOmittedTag =
    /<\s*(image|video|media|audio|sticker|gif|document)\s+omitted\s*>/i.test(cleaned) ||
    /\b(image|video|media|audio|sticker|gif|document)\s+omitted\b/i.test(cleaned);
  if (!hasMediaOmittedTag) return false;

  const remainder = cleaned
    .replace(/\[\s*forwarded\s*\]/gi, '')
    .replace(/^forwarded\s*:?/gi, '')
    .replace(/<\s*(image|video|media|audio|sticker|gif|document)\s+omitted\s*>/gi, '')
    .replace(/\b(image|video|media|audio|sticker|gif|document)\s+omitted\b/gi, '')
    .trim();

  return remainder.length === 0;
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
 * Extracts text from a .txt file or a .zip archive exported by WhatsApp ("Without Media").
 */
async function extractTextFromUploadedFile(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return await file.text();
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;

    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameBytes = bytes.subarray(offset + 30, offset + 30 + fileNameLen);
    const entryName = new TextDecoder('utf-8').decode(nameBytes);
    const dataStart = offset + 30 + fileNameLen + extraLen;
    const dataEnd = dataStart + compressedSize;

    if (entryName.toLowerCase().endsWith('.txt') && dataEnd <= bytes.length) {
      const slice = bytes.subarray(dataStart, dataEnd);
      if (compression === 0) {
        return new TextDecoder('utf-8').decode(slice);
      } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(slice);
        writer.close();
        const decompressedBuf = await new Response(ds.readable).arrayBuffer();
        return new TextDecoder('utf-8').decode(decompressedBuf);
      }
    }

    offset = dataEnd;
  }

  throw new Error('Could not find a readable .txt file inside the .zip archive. Please unzip and select the .txt file.');
}

/**
 * Comprehensive WhatsApp .txt parser supporting Jan–Dec history across iOS & Android formats:
 * - "[1/12/26, 8:08:52 AM] You: Thank you..."
 * - "14/02/2026, 08:30 - Name: Message"
 * - "2026/02/14, 08:30 - Name: Message"
 */
function parseWhatsAppExportText(rawText: string): ParsedExportMessage[] {
  const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\u200e|\u200f|\u202a|\u202c/g, '');
  const lines = cleanText.split('\n');

  const headerRegex =
    /^\[?(\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:[\s\u202f\u00a0]*[AaPp]\.?[Mm]\.?)?)\]?(?:\s*[\-–—]\s*|\s+)(.*)$/;

  let preferMonthFirst = false;
  let foundDayOver12InFirst = false;
  let foundDayOver12InSecond = false;

  for (const line of lines) {
    const m = line.match(headerRegex);
    if (!m) continue;
    const parts = m[1].split(/[\/\-\.]/).map((n) => parseInt(n, 10));
    if (parts.length === 3 && parts[0] <= 31) {
      if (parts[0] > 12) foundDayOver12InFirst = true;
      if (parts[1] > 12) foundDayOver12InSecond = true;
    }
  }
  if (!foundDayOver12InFirst && foundDayOver12InSecond) {
    preferMonthFirst = true;
  }

  const parsed: ParsedExportMessage[] = [];
  const occurrenceCounter = new Map<string, number>();

  for (const line of lines) {
    const match = line.match(headerRegex);
    if (match) {
      const rawDate = match[1];
      const rawTime = match[2];
      const rest = match[3] || '';

      const colonIdx = rest.indexOf(':');
      if (colonIdx <= 0) continue;

      const senderName = rest.slice(0, colonIdx).trim();
      let msgText = rest
        .slice(colonIdx + 1)
        .replace(/<(?:Media|document|image|video|audio|sticker|GIF)\s+omitted>/gi, '')
        .trim();
      if (!msgText || msgText === 'image omitted' || msgText === 'video omitted' || msgText === 'document omitted') {
        continue;
      }

      const dParts = rawDate.split(/[\/\-\.]/).map((p) => parseInt(p, 10));
      if (dParts.length !== 3 || dParts.some(isNaN)) continue;

      let year: number;
      let month: number;
      let day: number;

      if (dParts[0] > 1900) {
        year = dParts[0];
        month = dParts[1];
        day = dParts[2];
      } else {
        year = dParts[2] < 100 ? 2000 + dParts[2] : dParts[2];
        if (preferMonthFirst) {
          month = dParts[0];
          day = dParts[1];
        } else {
          day = dParts[0];
          month = dParts[1];
        }
        if (month > 12 && day <= 12) {
          const tmp = month;
          month = day;
          day = tmp;
        }
      }

      if (month < 1 || month > 12 || day < 1 || day > 31) continue;

      const normTime = rawTime.replace(/[\u202f\u00a0]/g, ' ').trim();
      const amPmMatch = normTime.match(/([AaPp])\.?[Mm]\.?$/);
      const timeCore = normTime.replace(/\s*[AaPp]\.?[Mm]\.?$/, '').trim();
      const tParts = timeCore.split(':').map((p) => parseInt(p, 10));
      let hours = tParts[0] || 0;
      const minutes = tParts[1] || 0;
      const seconds = tParts[2] || 0;

      if (amPmMatch) {
        const isPm = amPmMatch[1].toUpperCase() === 'P';
        if (isPm && hours < 12) hours += 12;
        if (!isPm && hours === 12) hours = 0;
      }

      const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      const dt = new Date(year, month - 1, day, hours, minutes, seconds);
      const timestampMs = isNaN(dt.getTime()) ? Date.now() : dt.getTime();

      const baseSig = `${dateStr}_${timeStr}_${senderName}_${msgText}`;
      const baseHash = simpleHash(baseSig);
      const seq = (occurrenceCounter.get(baseHash) || 0) + 1;
      occurrenceCounter.set(baseHash, seq);

      parsed.push({
        id: `wa_txt_${dateStr.replace(/-/g, '')}_${timeStr.replace(':', '')}_${baseHash}_${seq}`,
        dateStr,
        timeStr,
        timestampMs,
        senderName,
        text: msgText,
      });
    } else if (parsed.length > 0 && line.trim()) {
      const prev = parsed[parsed.length - 1];
      prev.text += `\n${line.trim()}`;
      const baseSig = `${prev.dateStr}_${prev.timeStr}_${prev.senderName}_${prev.text}`;
      const baseHash = simpleHash(baseSig);
      prev.id = `wa_txt_${prev.dateStr.replace(/-/g, '')}_${prev.timeStr.replace(':', '')}_${baseHash}_1`;
    }
  }

  return parsed;
}

function groupNameToStoreDocId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/^whatsapp\s*chat\s*with\s*/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `wa_store_${slug || 'group'}`;
}

/** Section B (Export Ticked to FSR & Daily Diary) is hidden; flow is Comms Summary -> FSR -> Chat -> FSR. */
const SHOW_DIALOG_FSR_DD_EXPORT = false;

interface WhatsAppGroupSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'import' | 'sync' | 'qr';
  defaultDate?: string; // YYYY-MM-DD
  defaultChannelId?: string | null;
  forceSourceId?: string | null;
  equipmentName?: string;
  availableEquipmentNames?: string[];
  onExtractedToFsr?: (extracted: ExtractFsrFromChatOutput, rawTranscript: string) => void;
  onExtractedToDiary?: (extracted: ExtractDailyDiaryFromChatOutput, rawTranscript: string) => void;
  onChannelSynced?: (channelId: string) => void;
}

export function WhatsAppGroupSyncDialog({
  open,
  onOpenChange,
  defaultTab = 'import',
  defaultDate,
  defaultChannelId,
  forceSourceId,
  equipmentName,
  availableEquipmentNames,
  onExtractedToFsr,
  onExtractedToDiary,
  onChannelSynced,
}: WhatsAppGroupSyncDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'import' | 'sync' | 'qr'>(defaultTab);
  const [storedGroups, setStoredGroups] = useState<StoredWhatsAppGroup[]>([]);
  const [appChannels, setAppChannels] = useState<Channel[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>([]);
  const [fsrOptions, setFsrOptions] = useState<FsrSummaryOption[]>([]);
  const [diaryOptions, setDiaryOptions] = useState<DailyDiarySummaryOption[]>([]);

  // Tab 2: .txt / .zip Upload & Group Selector state
  const [targetGroupSelection, setTargetGroupSelection] = useState<string>('');
  const [customGroupName, setCustomGroupName] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [rawExportText, setRawExportText] = useState<string>('');
  const [isSavingToStore, setIsSavingToStore] = useState<boolean>(false);
  const [isSyncingLiveToStore, setIsSyncingLiveToStore] = useState<boolean>(false);

  // Tab 3: Live QR Session state
  const [waSession, setWaSession] = useState<WhatsAppSessionState | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);

  // Tab 1: Selected source (`store:__all__`, `store:<id>`, `wa:<jid>`, or `app:<channelId>`)
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState<string>(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [loadedMessages, setLoadedMessages] = useState<WhatsAppBufferedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [keywordFilter, setKeywordFilter] = useState('');
  const [excludedAreasFilter, setExcludedAreasFilter] = useState<string[]>([]);
  const [excludeKeyword, setExcludeKeyword] = useState('');
  const [hoursFilterMode, setHoursFilterMode] = useState<'all' | 'office_dd' | 'after_hours_fsr'>('all');
  const [untickMediaOmittedOnly, setUntickMediaOmittedOnly] = useState<boolean>(false);

  // Export Destination 1: Site Comms Chat + Equipment Link + Cascading Tick-Box Filters
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<'' | 'Mining' | 'Smelter'>('');
  const [selectedMinesFilter, setSelectedMinesFilter] = useState<string[]>([]);
  const [selectedSubsectionsFilter, setSelectedSubsectionsFilter] = useState<string[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [equipmentSearch, setEquipmentSearch] = useState<string>('');
  const [targetChatName, setTargetChatName] = useState<string>('');
  const [isExportingToChat, setIsExportingToChat] = useState<boolean>(false);

  // Export Destination 2: FSR & Daily Diary (DD) Selection
  const [selectedFsrTarget, setSelectedFsrTarget] = useState<string>(
    onExtractedToFsr ? '__current_fsr__' : '__new_fsr__'
  );
  const [selectedDiaryTarget, setSelectedDiaryTarget] = useState<string>(
    onExtractedToDiary ? '__current_dd__' : '__new_dd__'
  );
  const [isExtractingToFsr, setIsExtractingToFsr] = useState<boolean>(false);
  const [isExtractingToDiary, setIsExtractingToDiary] = useState<boolean>(false);

  const loadChannelsStoresEquipmentAndFsrs = useCallback(async () => {
    if (!firestore) return [];
    try {
      const [allSnap, eqSnap, vsdSnap, fsrSnap, ddSnap] = await Promise.all([
        getDocs(collection(firestore, 'channels')),
        getDocs(query(collection(firestore, 'equipment'), orderBy('name', 'asc'))),
        getDocs(collection(firestore, 'vsds')),
        getDocs(collection(firestore, 'field_service_reports')),
        getDocs(collection(firestore, 'daily_diaries')),
      ]);

      const stores: StoredWhatsAppGroup[] = [];
      const internalChannels: Channel[] = [];

      allSnap.forEach((d) => {
        const data = d.data() as any;
        if (data.isDeleted) return;

        if (d.id.startsWith('wa_store_') || data.isPrivateWhatsAppStore || data.type === 'whatsapp_store') {
          stores.push({
            id: d.id,
            name: (data.name || d.id).replace(/^WhatsApp Store:\s*/i, ''),
            whatsappJid: data.whatsappJid || undefined,
            earliestDate: data.earliestDate,
            latestDate: data.latestDate,
            totalMessagesCount: data.totalMessagesCount || 0,
            updatedAt: data.updatedAt || data.lastMessageTime,
          });
        } else if (!d.id.startsWith('wa_grp_')) {
          internalChannels.push({ id: d.id, ...data });
        }
      });

      stores.sort((a, b) => a.name.localeCompare(b.name));
      internalChannels.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      setStoredGroups(stores);
      setAppChannels(internalChannels);

      // Build Equipment list with VSD details
      const vsdMap = new Map<string, any>();
      vsdSnap.forEach((v) => vsdMap.set(v.id, v.data()));

      const eqList: EquipmentOption[] = [];
      eqSnap.forEach((d) => {
        const eq = d.data() as any;
        const prefix = eq.mcc || eq.location || eq.division || '';
        const fullLabel = prefix ? `${prefix} - ${eq.name}` : eq.name || d.id;
        let finalOem = eq.oem || eq.manufacturer || '';
        let finalModel = eq.model || '';
        let finalSerial = eq.serialNo && eq.serialNo !== 'Pending' ? eq.serialNo : '';
        if (eq.vsdId && vsdMap.has(eq.vsdId)) {
          const vsd = vsdMap.get(eq.vsdId);
          if (!finalOem) finalOem = vsd.manufacturer || vsd.oem || '';
          if (!finalModel) finalModel = vsd.model || '';
          if (!finalSerial) finalSerial = vsd.serialNumber || vsd.serialNo || '';
        }
        const finalRating = eq.rating || (eq.motorPower ? `${eq.motorPower}kW` : '');
        const classified = classifyEquipmentRecord(eq);
        eqList.push({
          id: d.id,
          name: eq.name || d.id,
          fullLabel,
          oem: finalOem,
          model: finalModel,
          serialNo: finalSerial,
          rating: String(finalRating || ''),
          location: prefix,
          plant: classified.plant,
          mineArea: classified.mineArea,
          subsectionTags: classified.subsectionTags,
        });
      });
      eqList.sort((a, b) => a.fullLabel.localeCompare(b.fullLabel));
      setEquipmentOptions(eqList);

      // Build FSR summary list sorted by FSR reference descending / date descending
      const fsrs: FsrSummaryOption[] = [];
      fsrSnap.forEach((d) => {
        const data = d.data() as any;
        fsrs.push({
          id: d.id,
          fsrReference: data.fsrReference || `Draft (${d.id.slice(0, 6)})`,
          date: data.date || '',
          assetName: data.assetName || 'Unassigned Equipment',
          customer: data.customer || '',
          status: data.status || 'Draft',
        });
      });
      fsrs.sort((a, b) => {
        const refCmp = (b.fsrReference || '').localeCompare(a.fsrReference || '');
        if (refCmp !== 0) return refCmp;
        return (b.date || '').localeCompare(a.date || '');
      });
      setFsrOptions(fsrs);

      // Build Daily Diary summary list sorted by DD number / date descending
      const diaries: DailyDiarySummaryOption[] = [];
      ddSnap.forEach((d) => {
        const data = d.data() as any;
        const firstWork = Array.isArray(data.works) && data.works.length > 0 ? data.works[0] : null;
        const summary =
          firstWork?.area || firstWork?.scope
            ? `${firstWork.area || ''} ${firstWork.scope ? `(${String(firstWork.scope).slice(0, 30)})` : ''}`.trim()
            : data.area || 'Daily Diary';
        diaries.push({
          id: d.id,
          date: typeof data.date === 'string' ? data.date : '',
          area: data.area || 'Mining',
          workSummary: summary,
        });
      });
      diaries.sort((a, b) => {
        const idCmp = (b.id || '').localeCompare(a.id || '');
        if (idCmp !== 0) return idCmp;
        return (b.date || '').localeCompare(a.date || '');
      });
      setDiaryOptions(diaries);

      return stores;
    } catch (e) {
      console.error('Error loading dialog data:', e);
      return [];
    }
  }, [firestore]);

  const fetchWaStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/session', { cache: 'no-store' });
      if (!res.ok) return null;
      const data: WhatsAppSessionState = await res.json();
      setWaSession(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (open) {
      if (forceSourceId) {
        setSelectedSourceId(forceSourceId);
        setFromDate('');
        setToDate('');
      } else if (defaultDate) {
        setFromDate(defaultDate);
        setToDate(defaultDate);
      }
      if (onExtractedToFsr) {
        setSelectedFsrTarget('__current_fsr__');
      }
      if (onExtractedToDiary) {
        setSelectedDiaryTarget('__current_dd__');
      }
      if (equipmentName && !targetChatName) {
        setTargetChatName(`Breakdown: ${equipmentName}`);
      }
      Promise.all([loadChannelsStoresEquipmentAndFsrs(), fetchWaStatus()]).then(([stores, wa]) => {
        if (!selectedSourceId && !forceSourceId) {
          if (stores.length > 1) {
            setSelectedSourceId('store:__all__');
          } else if (stores.length === 1) {
            setSelectedSourceId(`store:${stores[0].id}`);
          } else if (defaultChannelId && !defaultChannelId.startsWith('wa_store_')) {
            setSelectedSourceId(`app:${defaultChannelId}`);
          } else if (wa?.groups && wa.groups.length > 0) {
            setSelectedSourceId(`wa:${wa.groups[0].jid}`);
          }
        }
        if (!targetGroupSelection) {
          if (stores.length > 0) {
            setTargetGroupSelection(`store:${stores[0].id}`);
          } else if (wa?.groups && wa.groups.length > 0) {
            const rbm = wa.groups.find(
              (g) => g.subject.toLowerCase().includes('altek') || g.subject.toLowerCase().includes('rbm')
            );
            setTargetGroupSelection(`wa:${(rbm || wa.groups[0]).jid}`);
          } else {
            setTargetGroupSelection('__custom__');
            setCustomGroupName('Altek Green/RBM Group');
          }
        }
      });
    }
  }, [
    open,
    defaultDate,
    defaultChannelId,
    forceSourceId,
    equipmentName,
    targetChatName,
    onExtractedToFsr,
    onExtractedToDiary,
    loadChannelsStoresEquipmentAndFsrs,
    fetchWaStatus,
    selectedSourceId,
    targetGroupSelection,
  ]);

  // When user selects an Equipment in the Export bar, auto-populate the Chat Name
  const handleSelectEquipment = (eqId: string) => {
    setSelectedEquipmentId(eqId);
    if (!eqId) return;
    const eq = equipmentOptions.find((e) => e.id === eqId);
    if (eq) {
      setTargetChatName(`Breakdown: ${eq.fullLabel} (${fromDate})`);
    }
  };

  const togglePlantTick = (plant: 'Mining' | 'Smelter') => {
    setSelectedPlantFilter((prev) => {
      const next = prev === plant ? '' : plant;
      setSelectedMinesFilter([]);
      setSelectedSubsectionsFilter([]);
      setSelectedEquipmentId('');
      return next;
    });
  };

  const toggleMineTick = (mine: string) => {
    setSelectedMinesFilter((prev) => {
      const next = prev.includes(mine) ? prev.filter((m) => m !== mine) : [...prev, mine];
      if (next.length === 0) {
        setSelectedSubsectionsFilter([]);
      }
      setSelectedEquipmentId('');
      return next;
    });
  };

  const toggleSubsectionTick = (sub: string) => {
    setSelectedSubsectionsFilter((prev) => {
      const next = prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub];
      setSelectedEquipmentId('');
      return next;
    });
  };

  // Available Level 3 subsections based on currently ticked Plant + Mine(s)
  const availableSubsectionsForSelection = useMemo(() => {
    if (selectedPlantFilter === 'Smelter') {
      return [...SMELTER_SUBSECTIONS];
    }
    if (selectedPlantFilter === 'Mining' && selectedMinesFilter.length > 0) {
      const list: string[] = [];
      const hasPond = selectedMinesFilter.some((m) => ['MPA', 'MPB', 'MPC', 'MPD', 'MPE'].includes(m));
      const hasPumpStation = selectedMinesFilter.includes('Pump Stations');
      if (hasPond) {
        list.push(...MINING_SUBSECTIONS);
      }
      if (hasPumpStation) {
        for (const ps of PUMP_STATION_SUBSECTIONS) {
          if (!list.includes(ps)) list.push(ps);
        }
      }
      return list;
    }
    return [];
  }, [selectedPlantFilter, selectedMinesFilter]);

  const filteredEquipmentOptions = useMemo(() => {
    return equipmentOptions.filter((e) => {
      if (selectedPlantFilter && e.plant !== selectedPlantFilter) {
        return false;
      }
      if (selectedPlantFilter === 'Mining' && selectedMinesFilter.length > 0) {
        const matchesMine = selectedMinesFilter.some(
          (m) => e.mineArea === m || e.fullLabel.toUpperCase().includes(m.toUpperCase())
        );
        if (!matchesMine) return false;
      }
      if (selectedSubsectionsFilter.length > 0) {
        const matchesSub = selectedSubsectionsFilter.some(
          (sub) =>
            e.subsectionTags.includes(sub) ||
            e.fullLabel.toUpperCase().includes(sub.toUpperCase())
        );
        if (!matchesSub) return false;
      }
      if (equipmentSearch.trim()) {
        const q = equipmentSearch.toLowerCase();
        if (!e.fullLabel.toLowerCase().includes(q) && !e.name.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [
    equipmentOptions,
    selectedPlantFilter,
    selectedMinesFilter,
    selectedSubsectionsFilter,
    equipmentSearch,
  ]);

  const parsedUploadPreview = useMemo(() => {
    if (!rawExportText.trim()) return [];
    return parseWhatsAppExportText(rawExportText);
  }, [rawExportText]);

  const parsedUploadDateSpan = useMemo(() => {
    if (parsedUploadPreview.length === 0) return null;
    const dates = parsedUploadPreview.map((m) => m.dateStr).sort();
    return {
      earliest: dates[0],
      latest: dates[dates.length - 1],
      count: parsedUploadPreview.length,
    };
  }, [parsedUploadPreview]);

  const resolveTargetGroupInfo = useCallback(() => {
    if (targetGroupSelection.startsWith('store:')) {
      const storeId = targetGroupSelection.slice(6);
      const found = storedGroups.find((g) => g.id === storeId);
      const matchingLive = waSession?.groups?.find(
        (lg) => lg.jid === found?.whatsappJid || lg.subject.toLowerCase() === (found?.name || '').toLowerCase()
      );
      return {
        storeDocId: storeId,
        groupName: found?.name || storeId,
        whatsappJid: found?.whatsappJid || matchingLive?.jid,
      };
    }

    if (targetGroupSelection.startsWith('wa:')) {
      const jid = targetGroupSelection.slice(3);
      const liveGrp = waSession?.groups?.find((g) => g.jid === jid);
      const groupName = liveGrp?.subject || customGroupName.trim() || 'WhatsApp Group';
      const existingStore = storedGroups.find(
        (s) => s.whatsappJid === jid || s.name.toLowerCase() === groupName.toLowerCase()
      );
      return {
        storeDocId: existingStore ? existingStore.id : groupNameToStoreDocId(groupName),
        groupName,
        whatsappJid: jid,
      };
    }

    const name = customGroupName.trim() || 'Altek Green/RBM Group';
    const matchingLive = waSession?.groups?.find((lg) => lg.subject.toLowerCase() === name.toLowerCase());
    const existingStore = storedGroups.find((s) => s.name.toLowerCase() === name.toLowerCase());
    return {
      storeDocId: existingStore ? existingStore.id : groupNameToStoreDocId(name),
      groupName: name,
      whatsappJid: existingStore?.whatsappJid || matchingLive?.jid,
    };
  }, [targetGroupSelection, storedGroups, waSession?.groups, customGroupName]);

  const saveParsedMessagesToStore = useCallback(
    async (messagesToSave: ParsedExportMessage[]) => {
      if (!firestore || messagesToSave.length === 0) return;

      const { storeDocId, groupName, whatsappJid } = resolveTargetGroupInfo();
      if (!groupName) {
        toast({
          variant: 'destructive',
          title: 'Group Name Required',
          description: 'Please select or enter the WhatsApp Group name first.',
        });
        return;
      }

      setIsSavingToStore(true);
      try {
        const existingSnap = await getDocs(collection(firestore, `channels/${storeDocId}/messages`));
        const existingIds = new Set<string>();
        const dates = messagesToSave.map((m) => m.dateStr).sort();
        let minDate = dates[0] || '';
        let maxDate = dates[dates.length - 1] || '';

        existingSnap.forEach((d) => {
          existingIds.add(d.id);
          const data = d.data() as any;
          if (data.messageDate) {
            if (!minDate || data.messageDate < minDate) minDate = data.messageDate;
            if (!maxDate || data.messageDate > maxDate) maxDate = data.messageDate;
          }
        });

        const combinedMessages = [...messagesToSave];
        if (whatsappJid) {
          try {
            const liveRes = await fetch('/api/whatsapp/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'get_group_messages', groupJid: whatsappJid }),
            });
            const liveData = await liveRes.json();
            if (Array.isArray(liveData.messages)) {
              for (const lm of liveData.messages) {
                const sig = `${lm.dateStr}_${lm.timeStr}_${lm.senderName}_${lm.text}`;
                const id = `wa_txt_${lm.dateStr.replace(/-/g, '')}_${lm.timeStr.replace(':', '')}_${simpleHash(sig)}_1`;
                combinedMessages.push({
                  id,
                  dateStr: lm.dateStr,
                  timeStr: lm.timeStr,
                  timestampMs: lm.timestampMs,
                  senderName: lm.senderName,
                  text: lm.text,
                });
                if (!minDate || lm.dateStr < minDate) minDate = lm.dateStr;
                if (!maxDate || lm.dateStr > maxDate) maxDate = lm.dateStr;
              }
            }
          } catch {
            // ignore
          }
        }

        const seenInBatch = new Set<string>();
        const newMessages: ParsedExportMessage[] = [];
        for (const m of combinedMessages) {
          if (!existingIds.has(m.id) && !seenInBatch.has(m.id)) {
            seenInBatch.add(m.id);
            newMessages.push(m);
          }
        }

        const chunkSize = 400;
        for (let i = 0; i < newMessages.length; i += chunkSize) {
          const chunk = newMessages.slice(i, i + chunkSize);
          const batch = writeBatch(firestore);
          for (const msg of chunk) {
            const msgRef = doc(firestore, `channels/${storeDocId}/messages`, msg.id);
            batch.set(msgRef, {
              text: msg.text,
              senderId: `wa_${msg.senderName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              senderName: msg.senderName,
              createdAt: Timestamp.fromMillis(msg.timestampMs),
              messageDate: msg.dateStr,
              timeStr: msg.timeStr,
              source: 'whatsapp_txt_store',
            });
          }
          await batch.commit();
        }

        const totalAfter = existingIds.size + newMessages.length;
        const latestMsg = combinedMessages[combinedMessages.length - 1];

        await setDoc(
          doc(firestore, 'channels', storeDocId),
          {
            name: groupName,
            ...(whatsappJid ? { whatsappJid } : {}),
            type: 'whatsapp_store',
            isPrivateWhatsAppStore: true,
            isArchived: true,
            earliestDate: minDate,
            latestDate: maxDate,
            totalMessagesCount: totalAfter,
            lastMessage: latestMsg ? `${latestMsg.senderName}: ${latestMsg.text.slice(0, 80)}` : '',
            lastMessageTime: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );

        await loadChannelsStoresEquipmentAndFsrs();
        setSelectedSourceId(`store:${storeDocId}`);
        setTargetGroupSelection(`store:${storeDocId}`);
        setRawExportText('');
        setUploadedFileName('');
        setActiveTab('import');

        toast({
          title: `Synced "${groupName}" Store!`,
          description: `Saved ${newMessages.length.toLocaleString()} new messages (${totalAfter.toLocaleString()} total stored from ${minDate} to ${maxDate}).`,
        });
      } catch (err: any) {
        console.error('Failed to save WhatsApp .txt store:', err);
        toast({
          variant: 'destructive',
          title: 'Store Save Error',
          description: err?.message || 'Failed to save messages to the store.',
        });
      } finally {
        setIsSavingToStore(false);
      }
    },
    [firestore, resolveTargetGroupInfo, loadChannelsStoresEquipmentAndFsrs, toast]
  );

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadedFileName(file.name);
      const text = await extractTextFromUploadedFile(file);
      setRawExportText(text);

      const parsed = parseWhatsAppExportText(text);
      if (parsed.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No WhatsApp Timestamps Found',
          description: 'Could not detect WhatsApp messages in this file.',
        });
        return;
      }

      await saveParsedMessagesToStore(parsed);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'File Read Error',
        description: err?.message || 'Could not read the selected file.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleSyncLiveIntoSelectedStore = useCallback(
    async (storeGroup: StoredWhatsAppGroup, silent = false) => {
      if (!firestore) return;
      const matchingLive = waSession?.groups?.find(
        (lg) =>
          (storeGroup.whatsappJid && lg.jid === storeGroup.whatsappJid) ||
          lg.subject.toLowerCase() === storeGroup.name.toLowerCase()
      );
      const jidToSync = storeGroup.whatsappJid || matchingLive?.jid;
      if (!jidToSync) {
        if (!silent) {
          toast({
            variant: 'destructive',
            title: 'Live WhatsApp Group Not Found',
            description: `Make sure Live QR is connected in Tab 3 and your group name matches "${storeGroup.name}".`,
          });
        }
        return;
      }

      setIsSyncingLiveToStore(true);
      try {
        const res = await fetch('/api/whatsapp/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_group_messages', groupJid: jidToSync }),
        });
        const data = await res.json();
        const liveMsgs: WhatsAppBufferedMessage[] = Array.isArray(data.messages) ? data.messages : [];
        if (liveMsgs.length === 0) {
          if (!silent) {
            toast({ title: 'Up to Date', description: 'No new live messages waiting to be added.' });
          }
          return;
        }

        const existingSnap = await getDocs(collection(firestore, `channels/${storeGroup.id}/messages`));
        const existingIds = new Set<string>();
        let minDate = storeGroup.earliestDate || '';
        let maxDate = storeGroup.latestDate || '';
        existingSnap.forEach((d) => {
          existingIds.add(d.id);
          const md = (d.data() as any).messageDate;
          if (md) {
            if (!minDate || md < minDate) minDate = md;
            if (!maxDate || md > maxDate) maxDate = md;
          }
        });

        const toAdd: ParsedExportMessage[] = [];
        for (const lm of liveMsgs) {
          const sig = `${lm.dateStr}_${lm.timeStr}_${lm.senderName}_${lm.text}`;
          const id = `wa_txt_${lm.dateStr.replace(/-/g, '')}_${lm.timeStr.replace(':', '')}_${simpleHash(sig)}_1`;
          if (!existingIds.has(id)) {
            existingIds.add(id);
            toAdd.push({
              id,
              dateStr: lm.dateStr,
              timeStr: lm.timeStr,
              timestampMs: lm.timestampMs,
              senderName: lm.senderName,
              text: lm.text,
            });
            if (!minDate || lm.dateStr < minDate) minDate = lm.dateStr;
            if (!maxDate || lm.dateStr > maxDate) maxDate = lm.dateStr;
          }
        }

        if (toAdd.length > 0) {
          const batch = writeBatch(firestore);
          for (const msg of toAdd.slice(0, 400)) {
            const msgRef = doc(firestore, `channels/${storeGroup.id}/messages`, msg.id);
            batch.set(msgRef, {
              text: msg.text,
              senderId: `wa_${msg.senderName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              senderName: msg.senderName,
              createdAt: Timestamp.fromMillis(msg.timestampMs),
              messageDate: msg.dateStr,
              timeStr: msg.timeStr,
              source: 'whatsapp_live_topup',
            });
          }
          await batch.commit();

          await setDoc(
            doc(firestore, 'channels', storeGroup.id),
            {
              whatsappJid: jidToSync,
              earliestDate: minDate,
              latestDate: maxDate,
              totalMessagesCount: existingIds.size,
              updatedAt: Timestamp.now(),
            },
            { merge: true }
          );

          await loadChannelsStoresEquipmentAndFsrs();
        }

        if (!silent) {
          toast({
            title: toAdd.length > 0 ? `Added ${toAdd.length} New Live Message(s)!` : 'Store Already Up to Date',
            description: `"${storeGroup.name}" store covers ${minDate} → ${maxDate}.`,
          });
        }
      } catch (err: any) {
        if (!silent) {
          toast({ variant: 'destructive', title: 'Live Sync Error', description: err.message });
        }
      } finally {
        setIsSyncingLiveToStore(false);
      }
    },
    [firestore, waSession?.groups, loadChannelsStoresEquipmentAndFsrs, toast]
  );

  const loadMessagesForSelectedSource = useCallback(async () => {
    if (!selectedSourceId) {
      setLoadedMessages([]);
      return;
    }

    setLoadingMessages(true);
    try {
      if (selectedSourceId === 'store:__all__' && firestore) {
        if (waSession?.status === 'connected') {
          for (const stGrp of storedGroups) {
            await handleSyncLiveIntoSelectedStore(stGrp, true);
          }
        }

        const allSnaps = await Promise.all(
          storedGroups.map(async (stGrp) => {
            const snap = await getDocs(
              query(collection(firestore, `channels/${stGrp.id}/messages`), orderBy('createdAt', 'asc'))
            );
            return { stGrp, snap };
          })
        );

        const combinedList: WhatsAppBufferedMessage[] = [];
        const seenSigs = new Set<string>();

        for (const { stGrp, snap } of allSnaps) {
          snap.forEach((d) => {
            const data = d.data() as any;
            let dateStr = data.messageDate || '';
            let timeStr = data.timeStr || '';
            let tsMs = Date.now();
            if (data.createdAt) {
              try {
                const dt =
                  typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(data.createdAt);
                if (!isNaN(dt.getTime())) {
                  tsMs = dt.getTime();
                  if (!dateStr) dateStr = format(dt, 'yyyy-MM-dd');
                  if (!timeStr) timeStr = format(dt, 'HH:mm');
                }
              } catch {
                // ignore
              }
            }
            const text = data.text || '';
            const senderName = data.senderName || 'Technician';
            const dedupKey = `${dateStr}_${timeStr}_${senderName}_${text}`;
            if (seenSigs.has(dedupKey)) return;
            seenSigs.add(dedupKey);

            combinedList.push({
              id: `${stGrp.id}__${d.id}`,
              groupJid: stGrp.id,
              groupName: stGrp.name,
              senderName,
              text,
              timestampMs: tsMs,
              dateStr,
              timeStr,
            });
          });
        }

        combinedList.sort((a, b) => a.timestampMs - b.timestampMs);
        setLoadedMessages(combinedList);
      } else if ((selectedSourceId.startsWith('store:') || selectedSourceId.startsWith('app:')) && firestore) {
        const channelId = selectedSourceId.startsWith('store:')
          ? selectedSourceId.slice(6)
          : selectedSourceId.slice(4);

        const stGrp = storedGroups.find((g) => g.id === channelId);
        const appCh = appChannels.find((c) => c.id === channelId);
        const resolvedGroupName = stGrp?.name || appCh?.name || channelId;

        if (selectedSourceId.startsWith('store:') && waSession?.status === 'connected' && stGrp) {
          await handleSyncLiveIntoSelectedStore(stGrp, true);
        }

        const msgsSnap = await getDocs(
          query(collection(firestore, `channels/${channelId}/messages`), orderBy('createdAt', 'asc'))
        );
        const list: WhatsAppBufferedMessage[] = [];
        msgsSnap.forEach((d) => {
          const data = d.data() as any;
          let dateStr = data.messageDate || '';
          let timeStr = data.timeStr || '';
          let tsMs = Date.now();
          if (data.createdAt) {
            try {
              const dt =
                typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(data.createdAt);
              if (!isNaN(dt.getTime())) {
                tsMs = dt.getTime();
                if (!dateStr) dateStr = format(dt, 'yyyy-MM-dd');
                if (!timeStr) timeStr = format(dt, 'HH:mm');
              }
            } catch {
              // ignore
            }
          }
          list.push({
            id: d.id,
            groupJid: channelId,
            groupName: resolvedGroupName,
            senderName: data.senderName || 'Technician',
            text: data.text || '',
            timestampMs: tsMs,
            dateStr,
            timeStr,
          });
        });
        setLoadedMessages(list);
      } else if (selectedSourceId.startsWith('wa:')) {
        const groupJid = selectedSourceId.slice(3);
        const res = await fetch('/api/whatsapp/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_group_messages', groupJid }),
        });
        const data = await res.json();
        setLoadedMessages(Array.isArray(data.messages) ? data.messages : []);
      }
    } catch (e) {
      console.error('Failed to load group messages:', e);
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedSourceId, firestore, waSession?.status, storedGroups, appChannels, handleSyncLiveIntoSelectedStore]);

  useEffect(() => {
    if (open && selectedSourceId) {
      loadMessagesForSelectedSource();
    }
  }, [open, selectedSourceId, loadMessagesForSelectedSource]);

  const handleStartLiveWhatsApp = async (forceNewQr = false) => {
    setIsStartingSession(true);
    try {
      const res = await fetch('/api/whatsapp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', forceNewQr }),
      });
      const data = await res.json();
      setWaSession(data);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Connection Error', description: err.message });
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      const res = await fetch('/api/whatsapp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      const data = await res.json();
      setWaSession(data);
      toast({
        title: 'WhatsApp Device Unlinked',
        description: 'Logged out and freed the Linked Device slot on your phone.',
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const toggleExcludeArea = (areaCode: string) => {
    setExcludedAreasFilter((prev) =>
      prev.includes(areaCode) ? prev.filter((a) => a !== areaCode) : [...prev, areaCode]
    );
  };

  const filteredMessages = useMemo(() => {
    return loadedMessages.filter((m) => {
      if (fromDate && m.dateStr && m.dateStr < fromDate) return false;
      if (toDate && m.dateStr && m.dateStr > toDate) return false;

      const upperText = (m.text || '').toUpperCase();

      // Exclude specific Mine / Area breakdowns (e.g. Filter out MPE)
      if (excludedAreasFilter.length > 0) {
        const hasExcludedArea = excludedAreasFilter.some((code) => {
          const rx = new RegExp(`\\b${code.toUpperCase()}\\b`, 'i');
          return rx.test(upperText);
        });
        if (hasExcludedArea) return false;
      }

      // Custom exclude keyword
      if (excludeKeyword.trim()) {
        const exParts = excludeKeyword
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (exParts.some((ex) => (m.text || '').toLowerCase().includes(ex))) {
          return false;
        }
      }

      // Office Hours (07:00 - 16:00) / Maintenance vs After-Hours Callout filter
      if (hoursFilterMode === 'office_dd') {
        const inOffice = isOfficeHoursTime(m.timeStr);
        const mentionsMaint = /\b(MAINT|INSPECT|SERVICE|PM|CLEAN|CHECK|SCHEDULE|DAILY)\b/i.test(m.text || '');
        if (!inOffice && !mentionsMaint) return false;
      } else if (hoursFilterMode === 'after_hours_fsr') {
        const inOffice = isOfficeHoursTime(m.timeStr);
        const mentionsBreakdown = /\b(CALL\s*OUT|CALLOUT|TRIP|FAULT|BREAKDOWN|ALARM|DOWN)\b/i.test(m.text || '');
        if (inOffice && !mentionsBreakdown) return false;
      }

      if (keywordFilter.trim()) {
        const kw = keywordFilter.toLowerCase();
        const matchText = m.text?.toLowerCase().includes(kw);
        const matchSender = m.senderName?.toLowerCase().includes(kw);
        if (!matchText && !matchSender) return false;
      }
      return true;
    });
  }, [
    loadedMessages,
    fromDate,
    toDate,
    excludedAreasFilter,
    excludeKeyword,
    hoursFilterMode,
    keywordFilter,
  ]);

  const standaloneMediaMsgIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of filteredMessages) {
      if (isStandaloneMediaOmittedMessage(m.text)) {
        ids.add(m.id);
      }
    }
    return ids;
  }, [filteredMessages]);

  useEffect(() => {
    if (untickMediaOmittedOnly) {
      setSelectedMsgIds(
        new Set(filteredMessages.filter((m) => !isStandaloneMediaOmittedMessage(m.text)).map((m) => m.id))
      );
    } else {
      setSelectedMsgIds(new Set(filteredMessages.map((m) => m.id)));
    }
  }, [filteredMessages, untickMediaOmittedOnly]);

  const toggleUntickMediaOmittedOnly = () => {
    setUntickMediaOmittedOnly((prev) => {
      const nextVal = !prev;
      setSelectedMsgIds((currentSelected) => {
        const nextSet = new Set(currentSelected);
        for (const m of filteredMessages) {
          if (isStandaloneMediaOmittedMessage(m.text)) {
            if (nextVal) {
              nextSet.delete(m.id);
            } else {
              nextSet.add(m.id);
            }
          }
        }
        return nextSet;
      });
      return nextVal;
    });
  };

  const toggleMessageSelection = (id: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const targetMessages = untickMediaOmittedOnly
      ? filteredMessages.filter((m) => !isStandaloneMediaOmittedMessage(m.text))
      : filteredMessages;
    if (selectedMsgIds.size === targetMessages.length && targetMessages.length > 0) {
      setSelectedMsgIds(new Set());
    } else {
      setSelectedMsgIds(new Set(targetMessages.map((m) => m.id)));
    }
  };

  /**
   * ACTION 1: EXPORT TICKED MESSAGES TO A SITE COMMS CHAT (LINKED TO EQUIPMENT OR CUSTOM NAME)
   */
  const handleExportTickedToChat = async (
    keepDialogOpen = false,
    overrideEquipmentLabel?: string
  ): Promise<string | null> => {
    if (!firestore) return null;
    const selectedMsgs = filteredMessages.filter((m) => selectedMsgIds.has(m.id));
    if (selectedMsgs.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Messages Ticked',
        description: 'Please tick at least one message to export to Site Comms Chat.',
      });
      return null;
    }

    const chosenEq = equipmentOptions.find((e) => e.id === selectedEquipmentId);
    const effectiveEqLabel = chosenEq?.fullLabel || overrideEquipmentLabel || '';
    const finalChatName =
      targetChatName.trim() ||
      (effectiveEqLabel ? `Breakdown: ${effectiveEqLabel}` : `Callout Chat (${fromDate})`);

    setIsExportingToChat(true);
    try {
      // Find existing internal chat with this exact name (or matching equipmentName), or create a new one
      const existingChan = appChannels.find(
        (c) =>
          (c.name || '').toLowerCase() === finalChatName.toLowerCase() ||
          (effectiveEqLabel &&
            (c.name || '').toLowerCase() === `breakdown: ${effectiveEqLabel} (${fromDate})`.toLowerCase())
      );
      let channelId = existingChan?.id || '';

      const lastMsg = selectedMsgs[selectedMsgs.length - 1];

      if (!channelId) {
        const newRef = await addDoc(collection(firestore, 'channels'), {
          name: finalChatName,
          type: effectiveEqLabel ? 'breakdown' : 'general',
          relatedId: chosenEq ? chosenEq.id : null,
          equipmentName: effectiveEqLabel || null,
          participants: user ? [user.uid] : [],
          isArchived: false,
          isDeleted: false,
          isPrivateWhatsAppStore: false,
          lastMessage: `${lastMsg.senderName}: ${lastMsg.text.slice(0, 80)}`,
          lastMessageTime: Timestamp.fromMillis(lastMsg.timestampMs),
          createdAt: Timestamp.now(),
        });
        channelId = newRef.id;
      } else {
        await setDoc(
          doc(firestore, 'channels', channelId),
          {
            name: finalChatName,
            lastMessage: `${lastMsg.senderName}: ${lastMsg.text.slice(0, 80)}`,
            lastMessageTime: Timestamp.fromMillis(lastMsg.timestampMs),
            isArchived: false,
            isDeleted: false,
            isPrivateWhatsAppStore: false,
            ...(effectiveEqLabel
              ? {
                  ...(chosenEq ? { relatedId: chosenEq.id } : {}),
                  equipmentName: effectiveEqLabel,
                  type: 'breakdown',
                }
              : {}),
          },
          { merge: true }
        );
      }

      // Write ticked messages into channels/{channelId}/messages
      const chunkSize = 400;
      for (let i = 0; i < selectedMsgs.length; i += chunkSize) {
        const chunk = selectedMsgs.slice(i, i + chunkSize);
        const batch = writeBatch(firestore);
        for (const msg of chunk) {
          const msgRef = doc(firestore, `channels/${channelId}/messages`, msg.id);
          batch.set(
            msgRef,
            {
              text: `[${msg.dateStr} ${msg.timeStr}] ${msg.text}`,
              senderId: `wa_${msg.senderName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              senderName: msg.senderName,
              createdAt: Timestamp.fromMillis(msg.timestampMs),
              messageDate: msg.dateStr,
              timeStr: msg.timeStr,
              source: 'whatsapp_export',
            },
            { merge: true }
          );
        }
        await batch.commit();
      }

      await loadChannelsStoresEquipmentAndFsrs();

      if (onChannelSynced) {
        onChannelSynced(channelId);
      }

      toast({
        title: 'Exported to Site Comms Chat!',
        description: `Exported ${selectedMsgs.length} ticked messages into "${finalChatName}".`,
      });

      if (!keepDialogOpen) {
        onOpenChange(false);
      }
      return channelId;
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Chat Export Error',
        description: err?.message || 'Failed to export messages to chat.',
      });
      return null;
    } finally {
      setIsExportingToChat(false);
    }
  };

  /**
   * Resolves equipment metadata by name from our loaded equipmentOptions
   */
  const resolveEquipmentDetailsByName = useCallback(
    (rawName: string) => {
      const clean = rawName.trim().toLowerCase();
      const eq = equipmentOptions.find(
        (e) =>
          e.fullLabel.toLowerCase() === clean ||
          e.name.toLowerCase() === clean ||
          e.fullLabel.toLowerCase().includes(clean) ||
          clean.includes(e.name.toLowerCase())
      );
      if (!eq) {
        return {
          equipmentId: null,
          assetName: rawName.trim(),
          oem: '',
          model: '',
          serialNo: '',
          rating: '',
        };
      }
      return {
        equipmentId: eq.id,
        assetName: eq.fullLabel,
        oem: eq.oem,
        model: eq.model,
        serialNo: eq.serialNo,
        rating: eq.rating,
      };
    },
    [equipmentOptions]
  );

  /**
   * ACTION 2: EXPORT TICKED MESSAGES TO FSR (CURRENT OPEN FSR, SELECTED EXISTING FSR, OR NEW FSR)
   */
  const handleExportTickedToFsr = async (alsoExportToChat = false) => {
    if (!firestore) return;
    const selectedMsgs = filteredMessages.filter((m) => selectedMsgIds.has(m.id));
    if (selectedMsgs.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Messages Ticked',
        description: 'Please tick at least one message to export to the FSR.',
      });
      return;
    }

    setIsExtractingToFsr(true);
    try {
      const chosenEq = equipmentOptions.find((e) => e.id === selectedEquipmentId);
      const effectiveEqName = chosenEq?.fullLabel || equipmentName || undefined;
      const allEqNames =
        availableEquipmentNames && availableEquipmentNames.length > 0
          ? availableEquipmentNames
          : equipmentOptions.map((e) => e.fullLabel);

      const transcript = selectedMsgs
        .map((m) => `[${m.dateStr} ${m.timeStr}] ${m.senderName}: ${m.text}`)
        .join('\n');

      const res = await extractFsrFromChat({
        chatHistory: transcript,
        equipmentName: effectiveEqName,
        availableEquipmentNames: allEqNames,
      });

      if (!res.success) {
        toast({
          variant: 'destructive',
          title: 'AI Extraction Error',
          description: res.error || 'Could not extract FSR details from ticked messages.',
        });
        return;
      }

      const firstDetectedEq =
        Array.isArray(res.equipmentNames) && res.equipmentNames.length > 0
          ? resolveEquipmentDetailsByName(res.equipmentNames[0]).assetName
          : '';
      const resolvedChatEqLabel = chosenEq?.fullLabel || equipmentName || firstDetectedEq || undefined;

      if (alsoExportToChat) {
        await handleExportTickedToChat(true, resolvedChatEqLabel);
      }

      // Case A: User is currently inside an FSR and chose "__current_fsr__"
      if (selectedFsrTarget === '__current_fsr__' && onExtractedToFsr) {
        onExtractedToFsr(res, transcript);
        onOpenChange(false);
        return;
      }

      // Case B: Export to a Selected Existing FSR or Create New FSR in Firestore
      let targetFsrId = selectedFsrTarget;
      let existingFsrData: Partial<FieldServiceReport> = {};

      if (targetFsrId === '__new_fsr__' || targetFsrId === '__current_fsr__') {
        const newFsrPayload: Partial<FieldServiceReport> = {
          userId: user?.uid || '',
          fsrReference: '',
          date: res.date || fromDate || new Date().toISOString().split('T')[0],
          status: 'Draft',
          createdAt: new Date().toISOString(),
          customer: res.customer || 'Richards Bay Minerals',
          site: res.site || 'RBM',
          area: res.area || chosenEq?.location || '',
          jobCategory: 'Call-Out',
          equipmentId: chosenEq?.id || null,
          assetName: chosenEq?.fullLabel || '',
          equipmentIds: chosenEq ? [chosenEq.id] : [],
          assetNames: chosenEq ? [chosenEq.fullLabel] : [],
          additionalEquipment: [],
          parts: [],
          personnel: [],
          hse: {
            ppe: 'NA',
            riskAssessment: 'NA',
            permit: 'NA',
            incidents: 'NA',
            areaCleaned: 'NA',
            environmentalImpact: 'NA',
            observations: '',
          },
        };
        const createdRef = await addDoc(collection(firestore, 'field_service_reports'), newFsrPayload);
        targetFsrId = createdRef.id;
        existingFsrData = newFsrPayload;
      } else {
        const fsrSnap = await getDoc(doc(firestore, 'field_service_reports', targetFsrId));
        if (fsrSnap.exists()) {
          existingFsrData = fsrSnap.data() as Partial<FieldServiceReport>;
        }
      }

      // Build merged update payload for the target FSR document
      const updatePayload: Record<string, any> = {};
      if (!existingFsrData.date && (res.date || fromDate)) {
        updatePayload.date = res.date || fromDate;
      }
      if (res.area && !existingFsrData.area) updatePayload.area = res.area;
      if (res.customer && !existingFsrData.customer) updatePayload.customer = res.customer;
      if (res.site && !existingFsrData.site) updatePayload.site = res.site;

      // Equipment resolution: prioritize explicitly selected equipment in dropdown, then AI-detected equipment
      const detectedEqItems = Array.isArray(res.equipmentNames)
        ? res.equipmentNames.map((n) => resolveEquipmentDetailsByName(n))
        : [];
      if (chosenEq) {
        detectedEqItems.unshift({
          equipmentId: chosenEq.id,
          assetName: chosenEq.fullLabel,
          oem: chosenEq.oem,
          model: chosenEq.model,
          serialNo: chosenEq.serialNo,
          rating: chosenEq.rating,
        });
      }

      if (detectedEqItems.length > 0) {
        const currentPrimary = existingFsrData.assetName || '';
        if (!currentPrimary) {
          const first = detectedEqItems[0];
          updatePayload.equipmentId = first.equipmentId;
          updatePayload.assetName = first.assetName;
          if (first.oem) updatePayload.oem = first.oem;
          if (first.model) updatePayload.model = first.model;
          if (first.serialNo) updatePayload.serialNo = first.serialNo;
          if (first.rating) updatePayload.rating = first.rating;
          if (detectedEqItems.length > 1) {
            const existingAdd = existingFsrData.additionalEquipment || [];
            updatePayload.additionalEquipment = [...existingAdd, ...detectedEqItems.slice(1)];
          }
        } else {
          const existingAdd = existingFsrData.additionalEquipment || [];
          const newOnes = detectedEqItems.filter((item) => item.assetName !== currentPrimary);
          if (newOnes.length > 0) {
            updatePayload.additionalEquipment = [...existingAdd, ...newOnes];
          }
        }
      }

      if (res.timeCallOut && !existingFsrData.timeCallOut) updatePayload.timeCallOut = res.timeCallOut;
      if (res.timeArrival && !existingFsrData.timeArrival) updatePayload.timeArrival = res.timeArrival;
      if (res.timeStart && !existingFsrData.timeStart) updatePayload.timeStart = res.timeStart;
      if (res.timeEnd && !existingFsrData.timeEnd) updatePayload.timeEnd = res.timeEnd;
      if (res.timeDeparture && !existingFsrData.timeDeparture) updatePayload.timeDeparture = res.timeDeparture;

      if (res.customerFault) updatePayload.customerFault = res.customerFault;
      if (res.findings) updatePayload.techFindings = res.findings;
      if (res.actions) updatePayload.correctiveActions = res.actions;
      if (res.rca) updatePayload.rca = res.rca;
      if (res.recommendations) updatePayload.recommendations = res.recommendations;

      if (Array.isArray(res.parts) && res.parts.length > 0) {
        const currentParts = existingFsrData.parts || [];
        const mappedParts = res.parts.map((p: any) => ({
          partNo: p.partNo || '',
          description: p.description || '',
          qty: Number(p.qty) || 1,
          unit: p.unit || 'EA',
          suppliedBy: 'Altek',
          remarks: '',
        }));
        updatePayload.parts = [...currentParts, ...mappedParts];
      }

      if (Array.isArray(res.personnel) && res.personnel.length > 0) {
        const currentPersonnel = existingFsrData.personnel || [];
        const existingNames = new Set(currentPersonnel.map((p: any) => (p.name || '').toLowerCase()));
        const newPersonnel = res.personnel
          .filter((p: any) => p.name && !existingNames.has(p.name.toLowerCase()))
          .map((p: any) => ({
            name: p.name,
            role: p.role || 'Technician',
            hrs: Number(p.hrs) || 0,
            ot: 0,
          }));
        if (newPersonnel.length > 0) {
          updatePayload.personnel = [...currentPersonnel, ...newPersonnel];
        }
      }

      await setDoc(doc(firestore, 'field_service_reports', targetFsrId), updatePayload, { merge: true });

      const targetLabel =
        fsrOptions.find((f) => f.id === targetFsrId)?.fsrReference || `FSR (${targetFsrId.slice(0, 6)})`;

      toast({
        title: 'Exported to Field Service Report!',
        description: `Populated ${targetLabel} from ${selectedMsgs.length} ticked messages. Opening FSR now...`,
      });

      onOpenChange(false);
      router.push(`/reports/field-service-report/${targetFsrId}`);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'FSR Export Error',
        description: err?.message || 'Failed to export messages to FSR.',
      });
    } finally {
      setIsExtractingToFsr(false);
    }
  };

  /**
   * ACTION 3: EXPORT TICKED MESSAGES TO CONTRACTORS DAILY DIARY (DD)
   */
  const handleExportTickedToDailyDiary = async (alsoExportToChat = false) => {
    if (!firestore) return;
    const selectedMsgs = filteredMessages.filter((m) => selectedMsgIds.has(m.id));
    if (selectedMsgs.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Messages Ticked',
        description: 'Please tick at least one message to export to the Daily Diary (DD).',
      });
      return;
    }

    setIsExtractingToDiary(true);
    try {
      if (alsoExportToChat) {
        await handleExportTickedToChat(true);
      }

      const chosenEq = equipmentOptions.find((e) => e.id === selectedEquipmentId);
      const effectiveEqName = chosenEq?.fullLabel || equipmentName || undefined;
      const allEqNames =
        availableEquipmentNames && availableEquipmentNames.length > 0
          ? availableEquipmentNames
          : equipmentOptions.map((e) => e.fullLabel);

      const transcript = selectedMsgs
        .map((m) => `[${m.dateStr} ${m.timeStr}] ${m.senderName}: ${m.text}`)
        .join('\n');

      const res = await extractDailyDiaryFromChat({
        chatHistory: transcript,
        equipmentName: effectiveEqName,
        availableEquipmentNames: allEqNames,
      });

      if (!res.success) {
        toast({
          variant: 'destructive',
          title: 'Daily Diary Extraction Error',
          description: res.error || 'Could not extract Daily Diary details from ticked messages.',
        });
        return;
      }

      if (selectedDiaryTarget === '__current_dd__' && onExtractedToDiary) {
        onExtractedToDiary(res, transcript);
        onOpenChange(false);
        return;
      }

      let targetDdId = selectedDiaryTarget;
      let existingDdData: Partial<DailyDiary> = {};

      if (targetDdId === '__new_dd__' || targetDdId === '__current_dd__') {
        let nextNum = 1;
        const nums = diaryOptions
          .map((d) => parseInt(String(d.id || '').replace(/^DD-/i, ''), 10))
          .filter((n) => !isNaN(n));
        if (nums.length > 0) {
          nextNum = Math.max(...nums) + 1;
        }
        targetDdId = `DD-${String(nextNum).padStart(3, '0')}`;
      } else {
        const ddSnap = await getDoc(doc(firestore, 'daily_diaries', targetDdId));
        if (ddSnap.exists()) {
          existingDdData = ddSnap.data() as Partial<DailyDiary>;
        }
      }

      const extractedWorks = Array.isArray(res.works) && res.works.length > 0
        ? res.works.map((w) => ({
            area: w.area || chosenEq?.fullLabel || selectedMinesFilter[0] || 'Mining',
            scope: w.scope || 'Maintenance & inspection completed',
            timeStart: w.timeStart || res.shiftStart || '07:00',
            timeEnd: w.timeEnd || res.shiftEnd || '16:00',
            hrs: Number(w.hrs) || 8,
          }))
        : [
            {
              area: chosenEq?.fullLabel || selectedMinesFilter[0] || 'Mining',
              scope: selectedMsgs.map((m) => `${m.senderName}: ${m.text}`).join(' | ').slice(0, 300),
              timeStart: res.shiftStart || '07:00',
              timeEnd: res.shiftEnd || '16:00',
              hrs: Number(res.hrs) || 8,
            },
          ];

      const mergedWorks = [
        ...(Array.isArray(existingDdData.works)
          ? existingDdData.works.filter((w) => w.area || w.scope)
          : []),
        ...extractedWorks,
      ];

      const extractedManpower = Array.isArray(res.manpower) && res.manpower.length > 0
        ? res.manpower.map((m) => ({
            designation: m.designation || 'Technician',
            forecast: Number(m.forecast) || 1,
            actual: Number(m.actual) || 1,
            normalHrs: Number(m.normalHrs) || 8,
            overtime1_5: Number(m.overtime1_5) || 0,
            overtime2_0: Number(m.overtime2_0) || 0,
            totalManHrs: Number(m.totalManHrs) || Number(m.normalHrs) || 8,
            comments: m.comments || 'Maintenance',
          }))
        : [];

      const existingManpower = Array.isArray(existingDdData.manpower)
        ? existingDdData.manpower.filter((m) => m.designation)
        : [];
      const mergedManpower = [...existingManpower, ...extractedManpower];
      if (mergedManpower.length === 0) {
        mergedManpower.push({
          designation: selectedMsgs[0]?.senderName || 'Technician',
          forecast: 1,
          actual: 1,
          normalHrs: 8,
          overtime1_5: 0,
          overtime2_0: 0,
          totalManHrs: 8,
          comments: 'Maintenance',
        });
      }

      const safeDelays = [
        ...(Array.isArray(existingDdData.delays) ? existingDdData.delays.filter(Boolean) : []),
        ...(Array.isArray(res.delays) ? res.delays.filter(Boolean) : []),
      ];
      while (safeDelays.length < 5) safeDelays.push('');

      const safeComments = [
        ...(Array.isArray(existingDdData.comments) ? existingDdData.comments.filter(Boolean) : []),
        ...(Array.isArray(res.comments) ? res.comments.filter(Boolean) : []),
      ];
      while (safeComments.length < 5) safeComments.push('');

      const locationTags = Array.from(
        new Set(
          mergedWorks
            .map((w) => {
              const s = `${w.area || ''} ${w.scope || ''}`.toLowerCase();
              const tags: string[] = [];
              if (s.includes('mpa')) tags.push('MPA');
              if (s.includes('mpb')) tags.push('MPB');
              if (s.includes('mpc')) tags.push('MPC');
              if (s.includes('mpd')) tags.push('MPD');
              if (s.includes('mpe')) tags.push('MPE');
              if (s.includes('nhlabane')) tags.push('Nhlabane');
              if (s.includes('mposa')) tags.push('Mposa');
              if (s.includes('monzi')) tags.push('Monzi');
              if (s.includes('return water')) tags.push('Return Water Boosters');
              if (s.includes('msp') || s.includes('roaster')) tags.push('MSP Roaster');
              if (s.includes('char')) tags.push('Char Plant');
              if (s.includes('smelter')) tags.push('Smelter');
              if (s.includes('iron')) tags.push('Iron Injection');
              if (s.includes('crane')) tags.push('Stripping Cranes');
              if (s.includes('slag')) tags.push('Slag Plant');
              if (s.includes('north screen')) tags.push('North Screen');
              return tags;
            })
            .flat()
        )
      );

      const ddPayload: Record<string, any> = {
        id: targetDdId,
        version: 'v2',
        userId: existingDdData.userId || user?.uid || '',
        contractTitle: existingDdData.contractTitle || 'VSD MAINTENANCE',
        contractNumber: existingDdData.contractNumber || 'CW 22038313',
        area: existingDdData.area || chosenEq?.plant || res.area || 'Mining',
        workType: existingDdData.workType || res.workType || 'Normal',
        maintenanceType: existingDdData.maintenanceType || res.maintenanceType || 'Scheduled',
        date: existingDdData.date || res.date || fromDate || format(new Date(), 'yyyy-MM-dd'),
        shiftStart: existingDdData.shiftStart || res.shiftStart || '07:00',
        shiftEnd: existingDdData.shiftEnd || res.shiftEnd || '16:00',
        hrs: existingDdData.hrs || res.hrs || 9,
        incidents: existingDdData.incidents || res.incidents || 'None reported',
        toolboxTalk: existingDdData.toolboxTalk || res.toolboxTalk || 'LOTOTO & Safe Working Procedures',
        manpower: mergedManpower,
        plant: existingDdData.plant || [{ description: 'Service Vehicle', qty: 1, inspectionDone: 'yes', comments: '' }],
        works: mergedWorks,
        delays: safeDelays,
        comments: safeComments,
        locationTags,
        equipmentNames: Array.from(new Set(mergedWorks.map((w) => w.area).filter(Boolean))),
        isSignedOff: existingDdData.isSignedOff || false,
        isFinalised: existingDdData.isFinalised || false,
        createdAt: existingDdData.createdAt || Timestamp.now(),
      };

      await setDoc(doc(firestore, 'daily_diaries', targetDdId), ddPayload, { merge: true });

      toast({
        title: 'Exported to Contractors Daily Diary (DD)!',
        description: `Populated ${targetDdId} from ${selectedMsgs.length} ticked messages. Opening Daily Diary now...`,
      });

      onOpenChange(false);
      router.push(`/reports/contractors-daily-diary?id=${encodeURIComponent(targetDdId)}`);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Daily Diary Export Error',
        description: err?.message || 'Failed to export messages to Daily Diary.',
      });
    } finally {
      setIsExtractingToDiary(false);
    }
  };

  const messageDateSpan = useMemo(() => {
    if (loadedMessages.length === 0) return null;
    const dates = loadedMessages.map((m) => m.dateStr).filter(Boolean).sort();
    if (dates.length === 0) return null;
    return { earliest: dates[0], latest: dates[dates.length - 1], count: loadedMessages.length };
  }, [loadedMessages]);

  const selectedStoreGroup = useMemo(() => {
    if (!selectedSourceId.startsWith('store:')) return null;
    const id = selectedSourceId.slice(6);
    return storedGroups.find((g) => g.id === id) || null;
  }, [selectedSourceId, storedGroups]);

  const isWaConnected = waSession?.status === 'connected';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col overflow-hidden p-5">
        <DialogHeader className="pb-1">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              WhatsApp Group Store → Export to Chat, FSR &amp; Daily Diary (DD)
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] font-bold px-2.5 py-0.5 flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-300"
              >
                <Database className="h-3 w-3 text-emerald-600" />
                {storedGroups.length} Stored Group{storedGroups.length === 1 ? '' : 's'}
              </Badge>
              {isWaConnected && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-300"
                >
                  Live QR Active
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-600">
            Searches across <strong>both stored WhatsApp folders</strong> (Altek Green + Industrial Elect) by date, lets you filter out unrelated breakdowns (e.g. MPE) or filter 07:00–16:00 maintenance, and exports to <strong>Site Comms Chat</strong>, <strong>FSR</strong>, and <strong>Daily Diary (DD)</strong>.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'import' | 'sync' | 'qr')}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="import" className="gap-1.5 font-bold text-xs">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              1. Select Group, Dates &amp; Export
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-1.5 font-bold text-xs">
              <Upload className="h-3.5 w-3.5 text-blue-600" />
              2. Upload / Update .txt Store
            </TabsTrigger>
            <TabsTrigger value="qr" className="gap-1.5 font-bold text-xs">
              <QrCode className="h-3.5 w-3.5 text-slate-500" />
              3. Live QR Top-Up
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SELECT STORED WHATSAPP GROUP + DATE RANGE + EXPORT TO CHAT / FSR / DD */}
          <TabsContent value="import" className="flex-1 flex flex-col gap-2 overflow-hidden mt-2">
            {/* TOP FILTER BAR: GROUP + FROM DATE + TO DATE */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="md:col-span-5 space-y-0.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-slate-500">Select WhatsApp Group Folder(s)</Label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSourceId.startsWith('store:') && selectedSourceId !== 'store:__all__') {
                        setTargetGroupSelection(selectedSourceId);
                      }
                      setActiveTab('sync');
                    }}
                    className="text-[10px] text-blue-700 hover:underline font-bold flex items-center gap-1"
                  >
                    <Upload className="h-2.5 w-2.5" /> + Update .txt File
                  </button>
                </div>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className="w-full h-8 px-2 border border-slate-300 rounded-md text-xs font-bold bg-white"
                >
                  <option value="">-- Choose a Stored Group --</option>
                  {storedGroups.length > 0 && (
                    <optgroup label="Stored WhatsApp Groups (Full History + Live Updates)">
                      {storedGroups.length > 1 && (
                        <option value="store:__all__">
                          📚 All Stored Folders Combined ({storedGroups.map((g) => g.name).join(' + ')})
                        </option>
                      )}
                      {storedGroups.map((g) => (
                        <option key={`store:${g.id}`} value={`store:${g.id}`}>
                          📁 {g.name} ({g.totalMessagesCount || 0} msgs • {g.earliestDate || '?'} → {g.latestDate || '?'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {(waSession?.groups?.length || 0) > 0 && (
                    <optgroup label="Live QR Groups">
                      {waSession!.groups.map((g) => (
                        <option key={`wa:${g.jid}`} value={`wa:${g.jid}`}>
                          🟢 {g.subject} ({g.messageCount} live msgs)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {appChannels.length > 0 && (
                    <optgroup label="Internal App Site Comms Channels">
                      {appChannels.map((c) => (
                        <option key={`app:${c.id}`} value={`app:${c.id}`}>
                          💬 {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {messageDateSpan && (
                  <p className="text-[10px] text-emerald-700 font-semibold">
                    {selectedSourceId === 'store:__all__'
                      ? `Combined Across Both Folders: ${messageDateSpan.count.toLocaleString()} msgs (${messageDateSpan.earliest} → ${messageDateSpan.latest})`
                      : `Stored History: ${messageDateSpan.count.toLocaleString()} msgs (${messageDateSpan.earliest} → ${messageDateSpan.latest})`}
                  </p>
                )}
              </div>

              <div className="md:col-span-3">
                <Label className="text-[10px] font-black uppercase text-slate-500">From Date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 mt-0.5 text-xs font-mono bg-white"
                />
              </div>

              <div className="md:col-span-3">
                <Label className="text-[10px] font-black uppercase text-slate-500">To Date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 mt-0.5 text-xs font-mono bg-white"
                />
              </div>

              <div className="md:col-span-1 flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  title="Show all dates stored in this group"
                  onClick={() => {
                    if (messageDateSpan) {
                      setFromDate(messageDateSpan.earliest);
                      setToDate(messageDateSpan.latest);
                    } else {
                      setFromDate('');
                      setToDate('');
                    }
                  }}
                  className="h-8 w-full text-[10px] font-bold px-1"
                >
                  All
                </Button>
              </div>
            </div>

            {/* TICK / UNTICK ALL + SHIFT HOURS FILTER + EXCLUDE OTHER MINE BREAKDOWNS */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllFiltered}
                    className="h-6 px-2 text-[11px] font-bold text-slate-800"
                  >
                    {selectedMsgIds.size > 0 &&
                    selectedMsgIds.size >=
                      (untickMediaOmittedOnly
                        ? filteredMessages.length - standaloneMediaMsgIds.size
                        : filteredMessages.length) ? (
                      <CheckSquare className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    ) : (
                      <Square className="h-3.5 w-3.5 mr-1 text-slate-400" />
                    )}
                    Tick / Untick All ({selectedMsgIds.size} of {filteredMessages.length} selected)
                  </Button>

                  <label
                    onClick={(e) => {
                      e.preventDefault();
                      toggleUntickMediaOmittedOnly();
                    }}
                    title="De-selects messages that ONLY say '<video omitted>' or '<image omitted>'. Messages with text behind '<image omitted>' stay ticked!"
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[11px] font-bold cursor-pointer select-none transition-colors',
                      untickMediaOmittedOnly
                        ? 'bg-red-600 text-white border-red-700 shadow-sm'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-red-50 hover:border-red-300'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={untickMediaOmittedOnly}
                      onChange={() => {}}
                      className="h-3.5 w-3.5 accent-red-600 rounded cursor-pointer"
                    />
                    <span>
                      Video / Image Omitted
                      {standaloneMediaMsgIds.size > 0 ? ` (${standaloneMediaMsgIds.size})` : ''}
                    </span>
                  </label>

                  <div className="flex items-center gap-1 border-l border-slate-300 pl-2">
                    <button
                      type="button"
                      onClick={() => setHoursFilterMode('all')}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold border transition-colors',
                        hoursFilterMode === 'all'
                          ? 'bg-slate-800 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                      )}
                    >
                      All Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoursFilterMode('office_dd')}
                      title="Show messages sent between 07:00 and 16:00 or mentioning maintenance for Daily Diary (DD)"
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold border transition-colors',
                        hoursFilterMode === 'office_dd'
                          ? 'bg-amber-600 text-white border-amber-700'
                          : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                      )}
                    >
                      ☀️ 07:00–16:00 Maint (For DD)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoursFilterMode('after_hours_fsr')}
                      title="Show after-hours call-out and breakdown messages for FSR"
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold border transition-colors',
                        hoursFilterMode === 'after_hours_fsr'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                      )}
                    >
                      🌙 Call-Out Hrs (For FSR)
                    </button>
                  </div>
                </div>

                <div className="relative w-48">
                  <Filter className="h-3 w-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Keep keyword..."
                    value={keywordFilter}
                    onChange={(e) => setKeywordFilter(e.target.value)}
                    className="h-6 pl-6 text-[11px] bg-white"
                  />
                </div>
              </div>

              {/* EXCLUDE OTHER BREAKDOWNS IN SAME TIMESTAMP (e.g. MPE) */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-200/80">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[9px] font-black uppercase text-red-700">
                    Filter Out Other Breakdown in Same Time:
                  </span>
                  {(['MPA', 'MPC', 'MPD', 'MPE', 'Smelter'] as const).map((areaCode) => {
                    const isExcluded = excludedAreasFilter.includes(areaCode);
                    return (
                      <button
                        key={areaCode}
                        type="button"
                        onClick={() => toggleExcludeArea(areaCode)}
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors',
                          isExcluded
                            ? 'bg-red-600 text-white border-red-700'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-red-50 hover:text-red-700'
                        )}
                      >
                        {isExcluded ? `🚫 Filtered Out ${areaCode}` : `Exclude ${areaCode}`}
                      </button>
                    );
                  })}
                </div>

                <Input
                  placeholder="Exclude word (e.g. MPE)..."
                  value={excludeKeyword}
                  onChange={(e) => setExcludeKeyword(e.target.value)}
                  className="h-6 w-48 text-[11px] bg-white border-red-200"
                />
              </div>
            </div>

            {/* MESSAGE LIST WITH CHECKBOXES */}
            <div className="flex-1 min-h-[140px] max-h-[210px] overflow-y-auto border rounded-lg bg-slate-50/60 p-2 space-y-1.5">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32 text-slate-400 text-xs gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading group messages across stored folders...
                </div>
              ) : !selectedSourceId ? (
                <div className="flex flex-col items-center justify-center h-32 text-center text-slate-500 text-xs gap-2 p-4">
                  <p className="font-semibold">
                    Select a Stored WhatsApp Group above, or click Tab 2 to upload your exported WhatsApp `.txt` file.
                  </p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center text-slate-500 text-xs gap-2 p-4">
                  <p>
                    No messages found between <strong>{fromDate || 'start'}</strong> and{' '}
                    <strong>{toDate || 'end'}</strong> with the active filters.
                  </p>
                  {messageDateSpan && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFromDate(messageDateSpan.earliest);
                        setToDate(messageDateSpan.latest);
                        setHoursFilterMode('all');
                        setExcludedAreasFilter([]);
                        setExcludeKeyword('');
                      }}
                      className="text-xs h-7 font-bold"
                    >
                      Reset Filters &amp; Show Full Range ({messageDateSpan.earliest} → {messageDateSpan.latest})
                    </Button>
                  )}
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isChecked = selectedMsgIds.has(msg.id);
                  const isOfficeHrs = isOfficeHoursTime(msg.timeStr);
                  return (
                    <div
                      key={msg.id}
                      onClick={() => toggleMessageSelection(msg.id)}
                      className={cn(
                        'p-2 rounded-lg border text-xs cursor-pointer transition-colors flex items-start gap-2.5',
                        isChecked
                          ? 'bg-emerald-50/70 border-emerald-300'
                          : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 h-4 w-4 accent-emerald-600 rounded cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{msg.senderName}</span>
                            {msg.groupName && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[9px] font-bold">
                                📁 {msg.groupName}
                              </span>
                            )}
                            <span
                              className={cn(
                                'px-1.5 py-0.2 rounded text-[9px] font-bold',
                                isOfficeHrs
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-purple-100 text-purple-800'
                              )}
                            >
                              {isOfficeHrs ? '☀️ 07:00–16:00 (DD)' : '🌙 Call-Out Hrs (FSR)'}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">
                            {msg.dateStr} {msg.timeStr}
                          </span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* BOTTOM EXPORT BAR: 1) EXPORT TO CHAT (WITH EQUIPMENT / NAME) AND 2) EXPORT TO FSR (WITH FSR DROPDOWN) */}
            <div className="grid grid-cols-1 gap-3 bg-slate-100/90 border border-slate-300 rounded-xl p-3"
              {/* LEFT CARD: EXPORT TO SITE COMMS CHAT */}
              <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-blue-800 flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5 text-blue-600" />
                    A. Export Ticked to Site Comms Chat
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">{selectedMsgIds.size} ticked</span>
                </div>

                {/* CASCADING EQUIPMENT FILTER TICK-BOXES */}
                <div className="bg-slate-50 border border-slate-200 rounded-md p-2 space-y-1.5">
                  {/* LEVEL 1: PLANT (MINING / SMELTER) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-black uppercase text-slate-500">1. Filter Plant:</span>
                    {(['Mining', 'Smelter'] as const).map((plant) => {
                      const checked = selectedPlantFilter === plant;
                      return (
                        <label
                          key={plant}
                          onClick={(e) => {
                            e.preventDefault();
                            togglePlantTick(plant);
                          }}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer select-none transition-colors',
                            checked
                              ? 'bg-blue-600 text-white border-blue-700'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="h-3 w-3 accent-white pointer-events-none"
                          />
                          {plant}
                        </label>
                      );
                    })}
                    {(selectedPlantFilter || selectedMinesFilter.length > 0 || selectedSubsectionsFilter.length > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlantFilter('');
                          setSelectedMinesFilter([]);
                          setSelectedSubsectionsFilter([]);
                          setSelectedEquipmentId('');
                        }}
                        className="text-[9px] text-slate-500 hover:text-red-600 underline font-semibold ml-auto"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>

                  {/* LEVEL 2: MINE AREA (OPENS WHEN MINING IS TICKED) */}
                  {selectedPlantFilter === 'Mining' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/80">
                      <span className="text-[9px] font-black uppercase text-blue-700">Mine:</span>
                      {MINING_MINES.map((mine) => {
                        const checked = selectedMinesFilter.includes(mine);
                        return (
                          <label
                            key={mine}
                            onClick={(e) => {
                              e.preventDefault();
                              toggleMineTick(mine);
                            }}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer select-none transition-colors',
                              checked
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              className="h-3 w-3 accent-white pointer-events-none"
                            />
                            {mine}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* LEVEL 3: SUBSECTION (OPENS WHEN A MINE IS TICKED OR SMELTER IS TICKED) */}
                  {availableSubsectionsForSelection.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/80">
                      <span className="text-[9px] font-black uppercase text-emerald-800">Section:</span>
                      {availableSubsectionsForSelection.map((sub) => {
                        const checked = selectedSubsectionsFilter.includes(sub);
                        return (
                          <label
                            key={sub}
                            onClick={(e) => {
                              e.preventDefault();
                              toggleSubsectionTick(sub);
                            }}
                            className={cn(
                              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold cursor-pointer select-none transition-colors',
                              checked
                                ? 'bg-amber-600 text-white border-amber-700'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              className="h-3 w-3 accent-white pointer-events-none"
                            />
                            {sub}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[9px] font-bold uppercase text-slate-500">
                      2. Select Filtered Equipment ({filteredEquipmentOptions.length} match{filteredEquipmentOptions.length === 1 ? '' : 'es'})
                    </Label>
                    <select
                      value={selectedEquipmentId}
                      onChange={(e) => handleSelectEquipment(e.target.value)}
                      className="w-full h-7 mt-0.5 px-2 border border-slate-300 rounded text-[11px] font-semibold bg-white"
                    >
                      <option value="">
                        -- Select Equipment ({filteredEquipmentOptions.length} options) --
                      </option>
                      {filteredEquipmentOptions.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.fullLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <Label className="text-[9px] font-bold uppercase text-slate-500">3. Chat Name in Site Comms</Label>
                    <Input
                      placeholder="e.g. Breakdown: MPA Final Tails Drive"
                      value={targetChatName}
                      onChange={(e) => setTargetChatName(e.target.value)}
                      className="h-7 mt-0.5 text-[11px] font-semibold bg-white"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  disabled={isExportingToChat || selectedMsgIds.size === 0}
                  onClick={() => handleExportTickedToChat(false)}
                  className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5"
                >
                  {isExportingToChat ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Exporting to Chat...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Export {selectedMsgIds.size} Ticked to Chat
                    </>
                  )}
                </Button>
              </div>

              {/* RIGHT CARD: EXPORT TO FIELD SERVICE REPORT (FSR) & DAILY DIARY (DD)
                  Hidden: workflow is now Site Comms Summary -> FSR/DD, FSR -> Export to Chat, Chat -> Export Summary to FSR. */}
              {SHOW_DIALOG_FSR_DD_EXPORT && (
              <div className="bg-white border border-emerald-200 rounded-lg p-2.5 space-y-2 shadow-sm flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-emerald-800 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-emerald-600" />
                      B. Export Ticked to FSR &amp; Daily Diary (DD)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700">AI Auto-Fill</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div>
                      <Label className="text-[9px] font-bold uppercase text-slate-500">
                        Target FSR (Breakdown / Call-Out)
                      </Label>
                      <select
                        value={selectedFsrTarget}
                        onChange={(e) => setSelectedFsrTarget(e.target.value)}
                        className="w-full h-7 mt-0.5 px-1.5 border border-emerald-300 rounded text-[11px] font-bold bg-white"
                      >
                        {onExtractedToFsr && (
                          <option value="__current_fsr__">
                            📌 Current Open FSR
                          </option>
                        )}
                        <option value="__new_fsr__">
                          ➕ Create New FSR
                        </option>
                        {fsrOptions.length > 0 && (
                          <optgroup label="Select Existing FSR by Number">
                            {fsrOptions.map((fsr) => (
                              <option key={fsr.id} value={fsr.id}>
                                📄 {fsr.fsrReference} • {fsr.date || 'No date'} • {fsr.assetName}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div>
                      <Label className="text-[9px] font-bold uppercase text-amber-800">
                        Target Daily Diary (07:00–16:00 Maint)
                      </Label>
                      <select
                        value={selectedDiaryTarget}
                        onChange={(e) => setSelectedDiaryTarget(e.target.value)}
                        className="w-full h-7 mt-0.5 px-1.5 border border-amber-300 rounded text-[11px] font-bold bg-white"
                      >
                        {onExtractedToDiary && (
                          <option value="__current_dd__">
                            📌 Current Open Daily Diary
                          </option>
                        )}
                        <option value="__new_dd__">
                          ➕ Create New Daily Diary (DD)
                        </option>
                        {diaryOptions.length > 0 && (
                          <optgroup label="Select Existing Daily Diary by Number">
                            {diaryOptions.map((dd) => (
                              <option key={dd.id} value={dd.id}>
                                📘 {dd.id} • {dd.date || 'No date'} • {dd.workSummary}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  {/* ROW 1: FSR BUTTONS */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isExtractingToFsr || isExtractingToDiary || selectedMsgIds.size === 0}
                      onClick={() => handleExportTickedToFsr(false)}
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold gap-1 px-2"
                    >
                      {isExtractingToFsr ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Export to FSR
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      disabled={isExtractingToFsr || isExtractingToDiary || isExportingToChat || selectedMsgIds.size === 0}
                      onClick={() => handleExportTickedToFsr(true)}
                      className="h-8 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold gap-1 px-2"
                      title="Saves the ticked messages into the Equipment Chat AND populates the selected FSR at the same time"
                    >
                      {isExtractingToFsr ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                      Export to Chat &amp; FSR
                    </Button>
                  </div>

                  {/* ROW 2: DAILY DIARY (DD) BUTTONS */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isExtractingToDiary || isExtractingToFsr || selectedMsgIds.size === 0}
                      onClick={() => handleExportTickedToDailyDiary(false)}
                      className="h-8 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold gap-1 px-2"
                      title="Populates the Contractors Daily Diary (DD) from the ticked messages"
                    >
                      {isExtractingToDiary ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Export to DD
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      disabled={isExtractingToDiary || isExtractingToFsr || isExportingToChat || selectedMsgIds.size === 0}
                      onClick={() => handleExportTickedToDailyDiary(true)}
                      className="h-8 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold gap-1 px-2"
                      title="Saves the ticked messages into the Equipment Chat AND populates the selected Daily Diary (DD) at the same time"
                    >
                      {isExtractingToDiary ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                      )}
                      Export to Chat &amp; DD
                    </Button>
                  </div>
                </div>
              </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: UPLOAD / INCREMENTAL UPDATE WHATSAPP .TXT STORE */}
          <TabsContent value="sync" className="flex-1 flex flex-col gap-4 overflow-y-auto mt-3 pr-1">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-slate-700">
                  Step 1: Select Which WhatsApp Group This History Belongs To
                </Label>
                <p className="text-[11px] text-slate-500">
                  Pick your existing Stored Group or select your live WhatsApp Group name so the uploaded `.txt` history and live updates stay linked under the exact same group.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={targetGroupSelection}
                    onChange={(e) => setTargetGroupSelection(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-md text-xs font-bold bg-white"
                  >
                    {storedGroups.length > 0 && (
                      <optgroup label="Existing Stored WhatsApp Groups">
                        {storedGroups.map((g) => (
                          <option key={`store:${g.id}`} value={`store:${g.id}`}>
                            📁 {g.name} ({g.totalMessagesCount || 0} msgs stored)
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {(waSession?.groups?.length || 0) > 0 && (
                      <optgroup label="Your WhatsApp Groups (Match Exact Group Name)">
                        {waSession!.groups.map((g) => (
                          <option key={`wa:${g.jid}`} value={`wa:${g.jid}`}>
                            🟢 {g.subject}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="__custom__">➕ Type / Confirm WhatsApp Group Name Manually</option>
                  </select>

                  {targetGroupSelection === '__custom__' && (
                    <Input
                      placeholder="e.g. Altek Green/RBM Group"
                      value={customGroupName}
                      onChange={(e) => setCustomGroupName(e.target.value)}
                      className="h-10 text-xs bg-white font-bold"
                    />
                  )}
                </div>
              </div>

              <div className="border-2 border-dashed border-emerald-400 bg-emerald-50/40 rounded-xl p-6 flex flex-col items-center text-center gap-3">
                {isSavingToStore ? (
                  <>
                    <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900">
                        Indexing &amp; Saving {parsedUploadDateSpan?.count.toLocaleString() || ''} Messages by Date...
                      </p>
                      <p className="text-xs text-slate-600">
                        Linking to <strong>{resolveTargetGroupInfo().groupName}</strong> ({parsedUploadDateSpan?.earliest} → {parsedUploadDateSpan?.latest}). You will be taken to Tab 1 automatically!
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <FileText className="h-9 w-9 text-emerald-600" />
                    <div className="space-y-1 max-w-lg">
                      <p className="text-sm font-black text-slate-900">
                        Step 2: Choose Your Exported WhatsApp `.txt` (or `.zip`) File
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        As soon as you select the file, the system will <strong>automatically index all messages by date</strong>, save them into <strong>{resolveTargetGroupInfo().groupName}</strong>, and switch you straight to <strong>Tab 1</strong>!
                      </p>
                    </div>
                    <label className="mt-1 inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-md transition-colors">
                      <Upload className="h-4 w-4" />
                      {uploadedFileName ? `Uploaded: ${uploadedFileName}` : 'Select WhatsApp .txt or .zip File & Sync Now'}
                      <input
                        type="file"
                        accept=".txt,.zip,text/plain,application/zip"
                        onChange={handleFileSelected}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: LIVE WHATSAPP QR LINK FOR CONTINUOUS UPDATES */}
          <TabsContent value="qr" className="flex-1 flex flex-col gap-4 overflow-y-auto mt-3 pr-1">
            <div className="border-2 border-slate-200 bg-slate-50/50 rounded-xl p-6 flex flex-col items-center text-center space-y-4">
              {isWaConnected ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Wifi className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-900">
                      Live QR Connected ({waSession?.connectedName || waSession?.connectedPhone})
                    </h3>
                    <p className="text-xs text-slate-600 max-w-md">
                      Your initial history is stored via Tab 2, and this live connection automatically tops up your stored group with the latest incoming messages!
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDisconnectWhatsApp}
                      className="text-red-600 border-red-300 hover:bg-red-50 font-bold gap-1.5 text-xs"
                    >
                      <Unlink className="h-4 w-4" />
                      Unlink Device &amp; Free Phone Slot
                    </Button>
                  </div>
                </>
              ) : waSession?.status === 'qr_ready' && waSession.qrDataUrl ? (
                <>
                  <div className="bg-white p-4 rounded-xl shadow-md border-2 border-emerald-500">
                    <img
                      src={waSession.qrDataUrl}
                      alt="WhatsApp Link QR Code"
                      className="w-56 h-56 object-contain mx-auto"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartLiveWhatsApp(true)}
                      className="text-xs gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Fresh QR
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnectWhatsApp}
                      className="text-xs text-red-600 border-red-200"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Smartphone className="h-8 w-8 text-slate-400" />
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-sm font-bold text-slate-900">
                      Live QR Continuous Top-Up
                    </h3>
                    <p className="text-xs text-slate-600">
                      Once your full history is uploaded in Tab 2, you can connect Live QR here anytime to automatically top up your stored group with the latest messages.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isStartingSession}
                      onClick={() => handleStartLiveWhatsApp(false)}
                      className="text-xs gap-1.5"
                    >
                      {isStartingSession ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                      Connect Live QR
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
