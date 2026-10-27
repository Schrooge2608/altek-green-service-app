'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare,
  Calendar,
  Loader2,
  Upload,
  CheckCircle2,
  Sparkles,
  CheckSquare,
  Square,
  QrCode,
  RefreshCw,
  Filter,
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { parseWhatsAppTranscript } from '@/lib/whatsapp-parser';
import { extractFsrFromChat, type ExtractFsrFromChatOutput } from '@/ai/flows/extract-fsr-from-chat-flow';
import type { Channel, ChatMessage } from '@/lib/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface WhatsAppGroupSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'import' | 'sync';
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
  onChannelSynced,
}: WhatsAppGroupSyncDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'import' | 'sync'>(defaultTab);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Import by Date Range state
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState<string>(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [channelMessages, setChannelMessages] = useState<(ChatMessage & { resolvedDateStr: string; resolvedTimeStr: string })[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [keywordFilter, setKeywordFilter] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  // Sync WhatsApp Group Archive state
  const [targetSyncChannelId, setTargetSyncChannelId] = useState<string>('NEW');
  const [newGroupName, setNewGroupName] = useState<string>('WhatsApp: Altek Breakdowns');
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const [isSyncingArchive, setIsSyncingArchive] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string>('');

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      if (defaultDate) {
        setFromDate(defaultDate);
        setToDate(defaultDate);
      }
      loadChannels();
    }
  }, [open, defaultTab, defaultDate]);

  const loadChannels = async () => {
    if (!firestore) return;
    setLoadingChannels(true);
    try {
      const snap = await getDocs(query(collection(firestore, 'channels'), orderBy('lastMessageTime', 'desc')));
      const list: Channel[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (!data.isDeleted) {
          list.push({ id: d.id, ...data });
        }
      });
      setChannels(list);

      if (defaultChannelId && list.some((c) => c.id === defaultChannelId)) {
        setSelectedChannelId(defaultChannelId);
      } else if (!selectedChannelId && list.length > 0) {
        // Prefer WhatsApp or Breakdown channels first
        const waChan = list.find((c) => c.name?.toLowerCase().includes('whatsapp') || (c as any).type === 'whatsapp');
        setSelectedChannelId(waChan ? waChan.id : list[0].id);
      }
    } catch (e: any) {
      console.error('Error loading channels:', e);
    } finally {
      setLoadingChannels(false);
    }
  };

  // Load messages whenever selectedChannelId changes
  useEffect(() => {
    if (!open || !selectedChannelId || !firestore) return;
    let isCancelled = false;

    async function fetchChannelMessages() {
      setLoadingMessages(true);
      try {
        const msgsSnap = await getDocs(
          query(collection(firestore, `channels/${selectedChannelId}/messages`), orderBy('createdAt', 'asc'))
        );
        if (isCancelled) return;

        const loaded: (ChatMessage & { resolvedDateStr: string; resolvedTimeStr: string })[] = [];
        msgsSnap.forEach((d) => {
          const data = d.data() as ChatMessage;
          let resolvedDateStr = data.messageDate || '';
          let resolvedTimeStr = data.timeStr || '';

          if ((!resolvedDateStr || !resolvedTimeStr) && data.createdAt) {
            try {
              const dt = typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(data.createdAt);
              if (!isNaN(dt.getTime())) {
                if (!resolvedDateStr) resolvedDateStr = format(dt, 'yyyy-MM-dd');
                if (!resolvedTimeStr) resolvedTimeStr = format(dt, 'HH:mm');
              }
            } catch {
              // ignore
            }
          }

          loaded.push({
            ...data,
            id: d.id,
            resolvedDateStr,
            resolvedTimeStr,
          });
        });

        setChannelMessages(loaded);

        // If defaultDate has no messages in this channel, automatically widen date range to show the channel's latest date window
        if (loaded.length > 0) {
          const hasInCurrentWindow = loaded.some(
            (m) => (!fromDate || m.resolvedDateStr >= fromDate) && (!toDate || m.resolvedDateStr <= toDate)
          );
          if (!hasInCurrentWindow) {
            const dates = loaded.map((m) => m.resolvedDateStr).filter(Boolean).sort();
            if (dates.length > 0) {
              const lastDate = dates[dates.length - 1];
              setFromDate(lastDate);
              setToDate(lastDate);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load channel messages:', e);
      } finally {
        if (!isCancelled) setLoadingMessages(false);
      }
    }

    fetchChannelMessages();
    return () => {
      isCancelled = true;
    };
  }, [open, selectedChannelId, firestore]);

  // Filter messages by From Date -> To Date and optional keyword
  const filteredMessages = useMemo(() => {
    return channelMessages.filter((m) => {
      if (fromDate && m.resolvedDateStr && m.resolvedDateStr < fromDate) return false;
      if (toDate && m.resolvedDateStr && m.resolvedDateStr > toDate) return false;
      if (keywordFilter.trim()) {
        const kw = keywordFilter.toLowerCase();
        const matchText = m.text?.toLowerCase().includes(kw);
        const matchSender = m.senderName?.toLowerCase().includes(kw);
        if (!matchText && !matchSender) return false;
      }
      return true;
    });
  }, [channelMessages, fromDate, toDate, keywordFilter]);

  // Auto-select all filtered messages when the filter window changes
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setRawPasteText(text);
      // Auto-populate group name from filename if creating new (e.g. "WhatsApp Chat with Altek Breakdowns.txt")
      const cleanFileName = file.name
        .replace(/\.txt$/i, '')
        .replace(/^WhatsApp Chat with\s+/i, '')
        .trim();
      if (cleanFileName && targetSyncChannelId === 'NEW') {
        setNewGroupName(`WhatsApp: ${cleanFileName}`);
      }
      const parsedPreview = parseWhatsAppTranscript(text);
      toast({
        title: 'WhatsApp File Loaded',
        description: `Detected ${parsedPreview.length} historical messages ready to sync.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Read Error', description: err.message });
    } finally {
      e.target.value = '';
    }
  };

  const handleSyncWhatsAppHistory = async () => {
    if (!firestore || !user) return;
    const parsed = parseWhatsAppTranscript(rawPasteText);
    if (parsed.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Valid WhatsApp Messages Found',
        description: 'Make sure the file or pasted text is a standard WhatsApp chat export (with dates, times, and sender names).',
      });
      return;
    }

    setIsSyncingArchive(true);
    setSyncProgress(`Preparing ${parsed.length} messages...`);

    try {
      let channelId = targetSyncChannelId;

      if (channelId === 'NEW') {
        const nameToUse = newGroupName.trim() || 'WhatsApp: Breakdown Group';
        const lastMsg = parsed[parsed.length - 1];
        const newChanRef = await addDoc(collection(firestore, 'channels'), {
          name: nameToUse,
          type: 'whatsapp',
          participants: [user.uid],
          lastMessage: `${lastMsg.senderName}: ${lastMsg.text.slice(0, 80)}`,
          lastMessageTime: Timestamp.fromMillis(lastMsg.timestampMs),
          createdAt: Timestamp.now(),
          isArchived: false,
        });
        channelId = newChanRef.id;
      }

      // Batch write in chunks of 400 (Firestore batch limit is 500) using deterministic doc IDs (idHash) so re-syncing never duplicates!
      const chunkSize = 400;
      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize);
        const batch = writeBatch(firestore);

        chunk.forEach((msg) => {
          const msgRef = doc(firestore, `channels/${channelId}/messages`, msg.idHash);
          batch.set(
            msgRef,
            {
              text: msg.text,
              senderId: `wa_${msg.senderName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              senderName: msg.senderName,
              createdAt: Timestamp.fromMillis(msg.timestampMs),
              messageDate: msg.dateStr,
              timeStr: msg.timeStr,
              source: 'whatsapp',
            },
            { merge: true }
          );
        });

        await batch.commit();
        setSyncProgress(`Synced ${Math.min(i + chunk.length, parsed.length)} of ${parsed.length} messages...`);
      }

      const lastMsg = parsed[parsed.length - 1];
      await updateDoc(doc(firestore, 'channels', channelId), {
        lastMessage: `${lastMsg.senderName}: ${lastMsg.text.slice(0, 80)}`,
        lastMessageTime: Timestamp.fromMillis(lastMsg.timestampMs),
      });

      const minDate = parsed[0].dateStr;
      const maxDate = parsed[parsed.length - 1].dateStr;

      toast({
        title: 'WhatsApp Group History Synced!',
        description: `Saved ${parsed.length} messages (${minDate} to ${maxDate}) into Site Comms.`,
      });

      setRawPasteText('');
      await loadChannels();
      setSelectedChannelId(channelId);
      setFromDate(maxDate);
      setToDate(maxDate);

      if (onChannelSynced) {
        onChannelSynced(channelId);
      }

      if (onExtractedToFsr) {
        setActiveTab('import');
      } else {
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      toast({ variant: 'destructive', title: 'Sync Failed', description: err.message });
    } finally {
      setIsSyncingArchive(false);
      setSyncProgress('');
    }
  };

  const handleExtractIntoFsr = async () => {
    if (!onExtractedToFsr) return;
    const selectedMsgs = filteredMessages.filter((m) => selectedMsgIds.has(m.id));
    if (selectedMsgs.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Messages Selected',
        description: 'Please select at least one message in the date range to import into the FSR.',
      });
      return;
    }

    setIsExtracting(true);
    try {
      const transcript = selectedMsgs
        .map((m) => `[${m.resolvedDateStr} ${m.resolvedTimeStr}] ${m.senderName}: ${m.text}`)
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

  // Compute date range bounds available in the selected channel so user can see how far back history goes (e.g. 1 year)
  const channelDateSpan = useMemo(() => {
    if (channelMessages.length === 0) return null;
    const dates = channelMessages.map((m) => m.resolvedDateStr).filter(Boolean).sort();
    if (dates.length === 0) return null;
    return { earliest: dates[0], latest: dates[dates.length - 1], count: channelMessages.length };
  }, [channelMessages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MessageSquare className="h-5 w-5 text-emerald-600" />
            WhatsApp & Group Comms Integration
          </DialogTitle>
          <DialogDescription>
            Select a synced WhatsApp / Site Comms group and date range (including historical chats over a year old) to import straight into your Field Service Report.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'import' | 'sync')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="gap-2 font-bold">
              <Calendar className="h-4 w-4 text-emerald-600" />
              1. Select Group & Date Range
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2 font-bold">
              <RefreshCw className="h-4 w-4 text-blue-600" />
              2. Sync / Link WhatsApp Group
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SELECT GROUP + DATE RANGE -> IMPORT INTO FSR */}
          <TabsContent value="import" className="flex-1 flex flex-col gap-4 overflow-hidden mt-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="md:col-span-5">
                <Label className="text-[10px] font-black uppercase text-slate-500">WhatsApp / Comms Group</Label>
                <select
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  className="w-full h-9 mt-1 px-2.5 border border-slate-300 rounded-md text-xs font-bold bg-white"
                >
                  {loadingChannels ? (
                    <option value="">Loading groups...</option>
                  ) : channels.length === 0 ? (
                    <option value="">No groups synced yet — use Tab 2 to sync</option>
                  ) : (
                    channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))
                  )}
                </select>
                {channelDateSpan && (
                  <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                    Archive: {channelDateSpan.count} msgs ({channelDateSpan.earliest} → {channelDateSpan.latest})
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
                  title="Show all dates in this group"
                  onClick={() => {
                    if (channelDateSpan) {
                      setFromDate(channelDateSpan.earliest);
                      setToDate(channelDateSpan.latest);
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

            <div className="flex items-center justify-between gap-2 px-1">
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
                  Select All ({selectedMsgIds.size} of {filteredMessages.length} messages)
                </Button>
              </div>
              <div className="relative w-56">
                <Filter className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Filter by equipment or tech..."
                  value={keywordFilter}
                  onChange={(e) => setKeywordFilter(e.target.value)}
                  className="h-7 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="flex-1 min-h-[220px] max-h-[320px] overflow-y-auto border rounded-lg bg-slate-50/60 p-3 space-y-2">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-xs gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading group messages...
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-slate-400 text-xs gap-2 p-4">
                  <p>No messages found in this group between <strong>{fromDate || 'start'}</strong> and <strong>{toDate || 'end'}</strong>.</p>
                  {channelDateSpan ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFromDate(channelDateSpan.earliest);
                        setToDate(channelDateSpan.latest);
                      }}
                      className="text-xs h-7"
                    >
                      Show Full Group History ({channelDateSpan.earliest} to {channelDateSpan.latest})
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('sync')}
                      className="text-xs h-7 border-emerald-300 text-emerald-700"
                    >
                      Sync WhatsApp Group Archive in Tab 2
                    </Button>
                  )}
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
                            {msg.resolvedDateStr} {msg.resolvedTimeStr}
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
                      Extracting {selectedMsgIds.size} Messages into FSR...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Import {selectedMsgIds.size} Selected Messages into FSR
                    </>
                  )}
                </Button>
              </DialogFooter>
            )}
          </TabsContent>

          {/* TAB 2: SYNC FULL 1-YEAR+ WHATSAPP GROUP ARCHIVE OR LINK LIVE BRIDGE */}
          <TabsContent value="sync" className="flex-1 flex flex-col gap-4 overflow-y-auto mt-3 pr-1">
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                How 1-Year+ Historical & Ongoing Sync Works
              </p>
              <p>
                • <strong>For messages up to 1+ years old:</strong> In WhatsApp, tap <em>Group Info → Export Chat → Without Media</em> once and upload the <code>.txt</code> file below. All historical messages are stored permanently in Firebase with their exact original dates so you can query any date range on any FSR without ever uploading again.
              </p>
              <p>
                • <strong>For live ongoing messages:</strong> Run <code>npm run whatsapp:bridge</code> (scan the WhatsApp QR code once like WhatsApp Web) or point a WhatsApp gateway webhook to <code>/api/whatsapp/webhook</code> so every new group message syncs automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Target Site Comms Group</Label>
                <select
                  value={targetSyncChannelId}
                  onChange={(e) => setTargetSyncChannelId(e.target.value)}
                  className="w-full h-9 mt-1 px-2.5 border rounded-md text-xs font-bold bg-white"
                >
                  <option value="NEW">+ Create New WhatsApp Group Channel</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      Sync into existing: #{c.name}
                    </option>
                  ))}
                </select>
              </div>

              {targetSyncChannelId === 'NEW' && (
                <div>
                  <Label className="text-xs font-bold">New Group Channel Name</Label>
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. WhatsApp: Altek Breakdowns"
                    className="h-9 mt-1 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">Upload WhatsApp Export (.txt) or Paste Messages</Label>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('wa-txt-upload')?.click()}
                    className="h-7 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Choose WhatsApp .txt File
                  </Button>
                  <input
                    id="wa-txt-upload"
                    type="file"
                    accept=".txt,text/plain"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              <Textarea
                value={rawPasteText}
                onChange={(e) => setRawPasteText(e.target.value)}
                placeholder={'Example:\n2025/11/14, 18:30 - Fritz Schroeder: Callout received for MPA Pump 1 & Pump 2 VSD fault\n2025/11/14, 19:05 - Fritz Schroeder: Arrived on site, found earth fault on ACS880 drive...'}
                className="min-h-[150px] font-mono text-xs"
              />
            </div>

            <DialogFooter className="flex items-center justify-between pt-2">
              <span className="text-xs text-emerald-700 font-semibold">{syncProgress}</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  type="button"
                  disabled={isSyncingArchive || !rawPasteText.trim()}
                  onClick={handleSyncWhatsAppHistory}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {isSyncingArchive ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Syncing History...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Sync Messages to Database
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
