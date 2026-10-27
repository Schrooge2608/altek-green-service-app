'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { extractFsrFromChat, type ExtractFsrFromChatOutput } from '@/ai/flows/extract-fsr-from-chat-flow';
import type { Channel } from '@/lib/types';
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

interface WhatsAppGroupSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'import' | 'sync' | 'qr';
  defaultDate?: string; // YYYY-MM-DD
  defaultChannelId?: string | null;
  equipmentName?: string;
  availableEquipmentNames?: string[];
  onExtractedToFsr?: (extracted: ExtractFsrFromChatOutput, rawTranscript: string) => void;
  onChannelSynced?: (channelId: string) => void;
}

export function WhatsAppGroupSyncDialog({
  open,
  onOpenChange,
  defaultTab = 'import',
  defaultDate,
  defaultChannelId,
  equipmentName,
  availableEquipmentNames,
  onExtractedToFsr,
}: WhatsAppGroupSyncDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'import' | 'sync' | 'qr'>(defaultTab);
  const [storedGroups, setStoredGroups] = useState<StoredWhatsAppGroup[]>([]);
  const [appChannels, setAppChannels] = useState<Channel[]>([]);

  // Tab 2: .txt / .zip Upload & Group Selector state
  // Value can be `store:<docId>`, `wa:<jid>`, or `__custom__`
  const [targetGroupSelection, setTargetGroupSelection] = useState<string>('');
  const [customGroupName, setCustomGroupName] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [rawExportText, setRawExportText] = useState<string>('');
  const [isSavingToStore, setIsSavingToStore] = useState<boolean>(false);
  const [isSyncingLiveToStore, setIsSyncingLiveToStore] = useState<boolean>(false);

  // Tab 3: Live QR Session state
  const [waSession, setWaSession] = useState<WhatsAppSessionState | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);

  // Tab 1: Selected source (`store:<id>`, `wa:<jid>`, or `app:<channelId>`)
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState<string>(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [loadedMessages, setLoadedMessages] = useState<WhatsAppBufferedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [keywordFilter, setKeywordFilter] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const loadChannelsAndStores = useCallback(async () => {
    if (!firestore) return [];
    try {
      const allSnap = await getDocs(collection(firestore, 'channels'));
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
      return stores;
    } catch (e) {
      console.error('Error loading stored WhatsApp groups:', e);
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
      if (defaultDate) {
        setFromDate(defaultDate);
        setToDate(defaultDate);
      }
      Promise.all([loadChannelsAndStores(), fetchWaStatus()]).then(([stores, wa]) => {
        if (!selectedSourceId) {
          if (stores.length > 0) {
            setSelectedSourceId(`store:${stores[0].id}`);
          } else if (wa?.groups && wa.groups.length > 0) {
            setSelectedSourceId(`wa:${wa.groups[0].jid}`);
          } else if (defaultChannelId) {
            setSelectedSourceId(`app:${defaultChannelId}`);
          }
        }
        if (!targetGroupSelection) {
          if (stores.length > 0) {
            setTargetGroupSelection(`store:${stores[0].id}`);
          } else if (wa?.groups && wa.groups.length > 0) {
            // Default to Altek Green/RBM Group if present, otherwise first live WhatsApp group
            const rbm = wa.groups.find((g) => g.subject.toLowerCase().includes('altek') || g.subject.toLowerCase().includes('rbm'));
            setTargetGroupSelection(`wa:${(rbm || wa.groups[0]).jid}`);
          } else {
            setTargetGroupSelection('__custom__');
            setCustomGroupName('Altek Green/RBM Group');
          }
        }
      });
    }
  }, [open, defaultDate, defaultChannelId, loadChannelsAndStores, fetchWaStatus, selectedSourceId, targetGroupSelection]);

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

  /**
   * Resolves the target store document ID, display name, and optional live WhatsApp JID
   * from the user's selection in Tab 2.
   */
  const resolveTargetGroupInfo = useCallback(() => {
    if (targetGroupSelection.startsWith('store:')) {
      const storeId = targetGroupSelection.slice(6);
      const found = storedGroups.find((g) => g.id === storeId);
      // Also check if a live group has the same subject so we link its whatsappJid automatically
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
      // Check if we already have a store for this JID or group name
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

  /**
   * Saves or incrementally updates a Stored WhatsApp Group in Firestore (`channels/wa_store_<slug>`)
   * AND also merges any live messages from the matching WhatsApp group if connected!
   */
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
        // 1. Fetch existing message IDs in this group store so we only write NEW messages
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

        // Also pull any live-buffered messages for this WhatsApp group if linked
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
            // ignore live merge error
          }
        }

        // Deduplicate within combinedMessages and against existingIds
        const seenInBatch = new Set<string>();
        const newMessages: ParsedExportMessage[] = [];
        for (const m of combinedMessages) {
          if (!existingIds.has(m.id) && !seenInBatch.has(m.id)) {
            seenInBatch.add(m.id);
            newMessages.push(m);
          }
        }

        // 2. Write new messages in chunks of 400
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

        // 3. Update parent store metadata document
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

        await loadChannelsAndStores();
        setSelectedSourceId(`store:${storeDocId}`);
        setTargetGroupSelection(`store:${storeDocId}`);
        setRawExportText('');
        setUploadedFileName('');
        // Automatically switch to Tab 1 so user immediately sees their messages filtered by their From/To Dates!
        setActiveTab('import');

        toast({
          title: `Synced "${groupName}" Store!`,
          description: `Saved ${newMessages.length.toLocaleString()} new messages (${totalAfter.toLocaleString()} total stored from ${minDate} to ${maxDate}). Now filtering by your selected dates!`,
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
    [firestore, resolveTargetGroupInfo, loadChannelsAndStores, toast]
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

      // Immediately save into the selected WhatsApp Group Store and switch to Tab 1!
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

  /**
   * Syncs any new messages from the Live QR session into the currently selected Stored Group!
   */
  const handleSyncLiveIntoSelectedStore = useCallback(
    async (storeGroup: StoredWhatsAppGroup, silent = false) => {
      if (!firestore) return;
      // Find matching live group by JID or by subject name
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
            toast({
              title: 'Up to Date',
              description: 'No new live messages waiting to be added.',
            });
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

          await loadChannelsAndStores();
        }

        if (!silent) {
          toast({
            title: toAdd.length > 0 ? `Added ${toAdd.length} New Live Message(s)!` : 'Store Already Up to Date',
            description: `"${storeGroup.name}" store covers ${minDate} → ${maxDate} (${existingIds.size} total messages).`,
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
    [firestore, waSession?.groups, loadChannelsAndStores, toast]
  );

  // Load messages for the selected source in Tab 1
  const loadMessagesForSelectedSource = useCallback(async () => {
    if (!selectedSourceId) {
      setLoadedMessages([]);
      return;
    }

    setLoadingMessages(true);
    try {
      if ((selectedSourceId.startsWith('store:') || selectedSourceId.startsWith('app:')) && firestore) {
        const channelId = selectedSourceId.startsWith('store:')
          ? selectedSourceId.slice(6)
          : selectedSourceId.slice(4);

        // If this is a Stored Group and Live QR is connected, silently top up any new live messages first!
        if (selectedSourceId.startsWith('store:') && waSession?.status === 'connected') {
          const stGrp = storedGroups.find((g) => g.id === channelId);
          if (stGrp) {
            await handleSyncLiveIntoSelectedStore(stGrp, true);
          }
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
  }, [selectedSourceId, firestore, waSession?.status, storedGroups, handleSyncLiveIntoSelectedStore]);

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

  // Filter messages by From Date -> To Date and optional keyword
  const filteredMessages = useMemo(() => {
    return loadedMessages.filter((m) => {
      if (fromDate && m.dateStr && m.dateStr < fromDate) return false;
      if (toDate && m.dateStr && m.dateStr > toDate) return false;
      if (keywordFilter.trim()) {
        const kw = keywordFilter.toLowerCase();
        const matchText = m.text?.toLowerCase().includes(kw);
        const matchSender = m.senderName?.toLowerCase().includes(kw);
        if (!matchText && !matchSender) return false;
      }
      return true;
    });
  }, [loadedMessages, fromDate, toDate, keywordFilter]);

  useEffect(() => {
    setSelectedMsgIds(new Set(filteredMessages.map((m) => m.id)));
  }, [filteredMessages]);

  const toggleMessageSelection = (id: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    if (selectedMsgIds.size === filteredMessages.length) {
      setSelectedMsgIds(new Set());
    } else {
      setSelectedMsgIds(new Set(filteredMessages.map((m) => m.id)));
    }
  };

  const handleExtractIntoFsr = async () => {
    if (!onExtractedToFsr) return;
    const selectedMsgs = filteredMessages.filter((m) => selectedMsgIds.has(m.id));
    if (selectedMsgs.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Messages Selected',
        description: 'Please tick at least one message to import into the FSR.',
      });
      return;
    }

    setIsExtracting(true);
    try {
      const transcript = selectedMsgs
        .map((m) => `[${m.dateStr} ${m.timeStr}] ${m.senderName}: ${m.text}`)
        .join('\n');

      const res = await extractFsrFromChat({
        chatHistory: transcript,
        equipmentName,
        availableEquipmentNames,
      });

      if (!res.success) {
        toast({
          variant: 'destructive',
          title: 'AI Extraction Error',
          description: res.error || 'Could not extract FSR details from selected messages.',
        });
        return;
      }

      onExtractedToFsr(res, transcript);
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Extraction Error', description: err.message });
    } finally {
      setIsExtracting(false);
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
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              WhatsApp Group Store &amp; FSR Import (Admin / Manager)
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
          <DialogDescription className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50/80 border border-emerald-200 rounded-md px-2.5 py-1.5 mt-1">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>How It Works:</strong> Upload your exported `.txt` file once in <strong>Tab 2</strong> and link it to your WhatsApp group name (e.g. <strong>Altek Green/RBM Group</strong>). It automatically saves the full Jan–Oct history into the store and switches you to <strong>Tab 1</strong> to filter by date!
            </span>
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
              1. Select Group &amp; Dates
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

          {/* TAB 1: SELECT STORED WHATSAPP GROUP + DATE RANGE + SPECIFIC MESSAGES */}
          <TabsContent value="import" className="flex-1 flex flex-col gap-3 overflow-hidden mt-3">
            {storedGroups.length === 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-4">
                <div className="text-xs text-blue-900">
                  <p className="font-bold">Step 1: Upload your initial WhatsApp `.txt` history into the store.</p>
                  <p className="text-blue-700">
                    Click the button on the right, pick your WhatsApp group name (e.g. <strong>Altek Green/RBM Group</strong>), and select your `.txt` file. It will automatically save and bring you right back here!
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 gap-1.5 font-bold"
                  onClick={() => setActiveTab('sync')}
                >
                  <Upload className="h-4 w-4" />
                  Upload .txt File Now
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="md:col-span-5 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-slate-500">Select Stored WhatsApp Group</Label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSourceId.startsWith('store:')) {
                        setTargetGroupSelection(selectedSourceId);
                      }
                      setActiveTab('sync');
                    }}
                    className="text-[10px] text-blue-700 hover:underline font-bold flex items-center gap-1"
                  >
                    <Upload className="h-2.5 w-2.5" /> + Upload / Top-Up .txt
                  </button>
                </div>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-md text-xs font-bold bg-white"
                >
                  <option value="">-- Choose a Stored Group --</option>
                  {storedGroups.length > 0 && (
                    <optgroup label="Stored WhatsApp Groups (Full History + Live Updates)">
                      {storedGroups.map((g) => (
                        <option key={`store:${g.id}`} value={`store:${g.id}`}>
                          📁 {g.name} ({g.totalMessagesCount || 0} msgs • {g.earliestDate || '?'} → {g.latestDate || '?'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {(waSession?.groups?.length || 0) > 0 && (
                    <optgroup label="Live QR Groups (Not Yet Linked to .txt Store)">
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
                    Stored Range: {messageDateSpan.count.toLocaleString()} msgs ({messageDateSpan.earliest} → {messageDateSpan.latest})
                  </p>
                )}
              </div>

              <div className="md:col-span-3">
                <Label className="text-[10px] font-black uppercase text-slate-500">From Date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9 mt-1 text-xs font-mono bg-white"
                />
              </div>

              <div className="md:col-span-3">
                <Label className="text-[10px] font-black uppercase text-slate-500">To Date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9 mt-1 text-xs font-mono bg-white"
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
                  className="h-9 w-full text-[10px] font-bold px-1"
                >
                  All
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleAllFiltered}
                  className="h-7 px-2 text-xs font-bold text-slate-700"
                >
                  {selectedMsgIds.size === filteredMessages.length && filteredMessages.length > 0 ? (
                    <CheckSquare className="h-4 w-4 mr-1.5 text-emerald-600" />
                  ) : (
                    <Square className="h-4 w-4 mr-1.5 text-slate-400" />
                  )}
                  Tick / Untick All ({selectedMsgIds.size} of {filteredMessages.length} messages in date range)
                </Button>

                {selectedStoreGroup && isWaConnected && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSyncingLiveToStore}
                    onClick={async () => {
                      await handleSyncLiveIntoSelectedStore(selectedStoreGroup, false);
                      await loadMessagesForSelectedSource();
                    }}
                    className="h-7 text-[11px] gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold"
                  >
                    {isSyncingLiveToStore ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Sync Newest Live Messages
                  </Button>
                )}
              </div>

              <div className="relative w-56">
                <Filter className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Filter messages by keyword..."
                  value={keywordFilter}
                  onChange={(e) => setKeywordFilter(e.target.value)}
                  className="h-7 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="flex-1 min-h-[220px] max-h-[320px] overflow-y-auto border rounded-lg bg-slate-50/60 p-3 space-y-2">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-xs gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading group messages for selected dates...
                </div>
              ) : !selectedSourceId ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-slate-500 text-xs gap-2 p-4">
                  <p className="font-semibold">
                    Select a Stored WhatsApp Group above, or click Tab 2 to upload your exported WhatsApp `.txt` file.
                  </p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-slate-500 text-xs gap-3 p-4">
                  <p>
                    No messages found in this group between <strong>{fromDate || 'start'}</strong> and{' '}
                    <strong>{toDate || 'end'}</strong>.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {messageDateSpan && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFromDate(messageDateSpan.earliest);
                          setToDate(messageDateSpan.latest);
                        }}
                        className="text-xs h-8 font-bold"
                      >
                        Show Full Stored Range ({messageDateSpan.earliest} → {messageDateSpan.latest})
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setActiveTab('sync')}
                      className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload .txt History File
                    </Button>
                  </div>
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isChecked = selectedMsgIds.has(msg.id);
                  return (
                    <div
                      key={msg.id}
                      onClick={() => toggleMessageSelection(msg.id)}
                      className={cn(
                        'p-2.5 rounded-lg border text-xs cursor-pointer transition-colors flex items-start gap-2.5',
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
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-bold text-slate-900">{msg.senderName}</span>
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

            {onExtractedToFsr && (
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isExtracting || selectedMsgIds.size === 0}
                  onClick={handleExtractIntoFsr}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing {selectedMsgIds.size} Ticked Messages into FSR...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Import {selectedMsgIds.size} Ticked Messages into FSR
                    </>
                  )}
                </Button>
              </DialogFooter>
            )}
          </TabsContent>

          {/* TAB 2: UPLOAD / INCREMENTAL UPDATE WHATSAPP .TXT STORE */}
          <TabsContent value="sync" className="flex-1 flex flex-col gap-4 overflow-y-auto mt-3 pr-1">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-5">
              {/* STEP 1: PICK EXACT WHATSAPP GROUP NAME */}
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

              {/* STEP 2: UPLOAD .TXT OR .ZIP FILE -> AUTO-SAVES & SWITCHES TO TAB 1 */}
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
                        As soon as you select the file (e.g. <strong>chat AG.txt</strong>), the system will <strong>automatically index all messages by date</strong>, save them into <strong>{resolveTargetGroupInfo().groupName}</strong>, and switch you straight to <strong>Tab 1 (Select Group &amp; Dates)</strong>!
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
