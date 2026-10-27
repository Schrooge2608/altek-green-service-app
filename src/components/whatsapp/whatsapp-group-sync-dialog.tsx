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
  History,
  ShieldCheck,
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  getDocs,
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
}: WhatsAppGroupSyncDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'import' | 'sync'>(defaultTab);
  const [appChannels, setAppChannels] = useState<Channel[]>([]);

  // Live WhatsApp QR Session state (private in-memory session)
  const [waSession, setWaSession] = useState<WhatsAppSessionState | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isRefreshingGroups, setIsRefreshingGroups] = useState(false);
  const [isRequestingOlder, setIsRequestingOlder] = useState(false);

  // Selected source: either `wa:<jid>` (private WhatsApp group) or `app:<channelId>` (internal app channel)
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [groupSearchFilter, setGroupSearchFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState<string>(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [loadedMessages, setLoadedMessages] = useState<WhatsAppBufferedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [keywordFilter, setKeywordFilter] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const loadAppChannels = useCallback(async () => {
    if (!firestore) return;
    try {
      const snap = await getDocs(query(collection(firestore, 'channels'), orderBy('lastMessageTime', 'desc')));
      const list: Channel[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        // Exclude any old auto-synced wa_grp_ documents so personal groups never appear in shared channels
        if (!data.isDeleted && !d.id.startsWith('wa_grp_')) {
          list.push({ id: d.id, ...data });
        }
      });
      setAppChannels(list);
    } catch (e) {
      console.error('Error loading app channels:', e);
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
      loadAppChannels();
      fetchWaStatus().then((st) => {
        if (st?.status === 'connected' && st.groups.length > 0 && !selectedSourceId) {
          setSelectedSourceId(`wa:${st.groups[0].jid}`);
        } else if (defaultChannelId && !selectedSourceId) {
          setSelectedSourceId(`app:${defaultChannelId}`);
        }
      });
    }
  }, [open, defaultDate, defaultChannelId, loadAppChannels, fetchWaStatus, selectedSourceId]);

  // Poll WhatsApp status while dialog is open
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(async () => {
      const prevStatus = waSession?.status;
      const st = await fetchWaStatus();
      if (st) {
        if (prevStatus !== 'connected' && st.status === 'connected') {
          if (st.groups.length > 0 && (!selectedSourceId || selectedSourceId.startsWith('app:'))) {
            setSelectedSourceId(`wa:${st.groups[0].jid}`);
          }
          toast({
            title: 'WhatsApp Linked Privately!',
            description: `Connected as ${st.connectedName || st.connectedPhone}. Your groups are ready to select (nothing is saved to the app until you import).`,
          });
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [open, waSession?.status, fetchWaStatus, selectedSourceId, toast]);

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

  const handleRefreshLiveGroups = async () => {
    setIsRefreshingGroups(true);
    try {
      const res = await fetch('/api/whatsapp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh_groups' }),
      });
      const data: WhatsAppSessionState = await res.json();
      setWaSession(data);
      if (data.groups?.length > 0 && !selectedSourceId.startsWith('wa:')) {
        setSelectedSourceId(`wa:${data.groups[0].jid}`);
      }
      toast({
        title: 'WhatsApp Groups Refreshed',
        description: `Found ${data.groupsCount || 0} WhatsApp groups on your phone.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Refresh Error', description: err.message });
    } finally {
      setIsRefreshingGroups(false);
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
      setLoadedMessages([]);
      toast({ title: 'WhatsApp Unlinked', description: 'Private session cleared from server memory.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  // Load messages ONLY for the selected group
  const loadMessagesForSelectedSource = useCallback(async () => {
    if (!selectedSourceId) {
      setLoadedMessages([]);
      return;
    }

    setLoadingMessages(true);
    try {
      if (selectedSourceId.startsWith('wa:')) {
        const groupJid = selectedSourceId.slice(3);
        const res = await fetch('/api/whatsapp/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_group_messages', groupJid }),
        });
        const data = await res.json();
        setLoadedMessages(Array.isArray(data.messages) ? data.messages : []);
      } else if (selectedSourceId.startsWith('app:') && firestore) {
        const channelId = selectedSourceId.slice(4);
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
              const dt = typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(data.createdAt);
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
      }
    } catch (e) {
      console.error('Failed to load group messages:', e);
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedSourceId, firestore]);

  useEffect(() => {
    if (open && selectedSourceId) {
      loadMessagesForSelectedSource();
    }
  }, [open, selectedSourceId, loadMessagesForSelectedSource]);

  const selectedWaGroup = useMemo(() => {
    if (!selectedSourceId.startsWith('wa:')) return null;
    const jid = selectedSourceId.slice(3);
    return waSession?.groups?.find((g) => g.jid === jid) || null;
  }, [selectedSourceId, waSession?.groups]);

  const handleRequestOlderHistoryFromPhone = async () => {
    if (!selectedSourceId.startsWith('wa:')) return;
    const groupJid = selectedSourceId.slice(3);

    setIsRequestingOlder(true);
    try {
      const res = await fetch('/api/whatsapp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch_older', groupJid, count: 150 }),
      });
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setLoadedMessages(data.messages);
      }
      toast({
        title: 'Fetching Older Messages from Phone...',
        description: data?.historyRequest?.message || 'Pulling older messages for this group only.',
      });
      setTimeout(() => {
        loadMessagesForSelectedSource();
      }, 2500);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'History Sync Error', description: err.message });
    } finally {
      setIsRequestingOlder(false);
    }
  };

  // Filter group dropdown options by optional search box so personal groups can be easily skipped
  const filteredWaGroups = useMemo(() => {
    const groups = waSession?.groups || [];
    if (!groupSearchFilter.trim()) return groups;
    const q = groupSearchFilter.toLowerCase();
    return groups.filter((g) => g.subject.toLowerCase().includes(q));
  }, [waSession?.groups, groupSearchFilter]);

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

  const isWaConnected = waSession?.status === 'connected';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              Selective WhatsApp Group Import (Admin / Manager Only)
            </DialogTitle>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-bold px-2.5 py-0.5 flex items-center gap-1.5',
                isWaConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', isWaConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
              {isWaConnected
                ? `WhatsApp Linked (${waSession?.connectedName || waSession?.connectedPhone})`
                : 'WhatsApp Not Linked Yet'}
            </Badge>
          </div>
          <DialogDescription className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50/80 border border-emerald-200 rounded-md px-2.5 py-1.5 mt-1">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Privacy Protected:</strong> Your WhatsApp groups and personal messages are <strong>never</strong> downloaded into the app&apos;s shared chat or visible to other users. Only the specific group &amp; ticked messages you select below are imported into this FSR.
            </span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'import' | 'sync')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="gap-2 font-bold">
              <Calendar className="h-4 w-4 text-emerald-600" />
              1. Select Group, Dates &amp; Messages
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2 font-bold">
              <QrCode className="h-4 w-4 text-blue-600" />
              2. Link Live WhatsApp (QR Code)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SELECT GROUP + DATE RANGE + SPECIFIC MESSAGES */}
          <TabsContent value="import" className="flex-1 flex flex-col gap-3 overflow-hidden mt-3">
            {!isWaConnected && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-4">
                <div className="text-xs text-amber-900">
                  <p className="font-bold">Link your WhatsApp to select a WhatsApp group directly.</p>
                  <p className="text-amber-700">Click the button on the right to scan a quick QR code (takes ~2 seconds to generate).</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-1.5 font-bold"
                  onClick={() => {
                    setActiveTab('sync');
                    handleStartLiveWhatsApp(true);
                  }}
                >
                  <QrCode className="h-4 w-4" />
                  Link WhatsApp QR
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="md:col-span-5 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-slate-500">Select Specific Group</Label>
                  <button
                    type="button"
                    onClick={() => loadMessagesForSelectedSource()}
                    className="text-[10px] text-emerald-700 hover:underline font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="h-2.5 w-2.5" /> Reload
                  </button>
                </div>
                {isWaConnected && (waSession?.groups?.length || 0) > 5 && (
                  <Input
                    placeholder="Type to filter group name..."
                    value={groupSearchFilter}
                    onChange={(e) => setGroupSearchFilter(e.target.value)}
                    className="h-7 text-xs bg-white mb-1"
                  />
                )}
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-md text-xs font-bold bg-white"
                >
                  <option value="">-- Choose a Group to Inspect --</option>
                  {filteredWaGroups.length > 0 && (
                    <optgroup label="Your Live WhatsApp Groups (Private — Only Visible Here)">
                      {filteredWaGroups.map((g) => (
                        <option key={`wa:${g.jid}`} value={`wa:${g.jid}`}>
                          🟢 {g.subject} ({g.messageCount} msgs)
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
                    Available in this group: {messageDateSpan.count} msgs ({messageDateSpan.earliest} → {messageDateSpan.latest})
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
                  title="Show all dates in this selected group"
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
                  Tick / Untick All ({selectedMsgIds.size} of {filteredMessages.length} selected)
                </Button>

                {isWaConnected && selectedWaGroup && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRequestingOlder}
                    onClick={handleRequestOlderHistoryFromPhone}
                    className="h-7 text-[11px] gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    {isRequestingOlder ? <Loader2 className="h-3 w-3 animate-spin" /> : <History className="h-3 w-3" />}
                    Pull Older Messages for This Group
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading messages for selected group...
                </div>
              ) : !selectedSourceId ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-slate-500 text-xs gap-2 p-4">
                  <p className="font-semibold">Select a specific WhatsApp Group from the dropdown above to view and tick the messages you want to import.</p>
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
                        Show All Dates in Group ({messageDateSpan.earliest} → {messageDateSpan.latest})
                      </Button>
                    )}
                    {isWaConnected && selectedWaGroup && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isRequestingOlder}
                        onClick={handleRequestOlderHistoryFromPhone}
                        className="text-xs h-8 border-blue-300 text-blue-700 font-bold gap-1.5"
                      >
                        <History className="h-3.5 w-3.5" />
                        Pull Older History for This Group
                      </Button>
                    )}
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

          {/* TAB 2: LIVE WHATSAPP WEB QR-CODE LINKER */}
          <TabsContent value="sync" className="flex-1 flex flex-col gap-4 overflow-y-auto mt-3 pr-1">
            <div className="border-2 border-emerald-200 bg-emerald-50/40 rounded-xl p-6 flex flex-col items-center text-center space-y-4">
              {isWaConnected ? (
                <>
                  <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm">
                    <Wifi className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-slate-900 flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      WhatsApp Connected (Private Admin Session)
                    </h3>
                    <p className="text-xs text-slate-600">
                      Linked Account: <strong>{waSession?.connectedName || waSession?.connectedPhone}</strong> •{' '}
                      <strong>{waSession?.groupsCount || 0} WhatsApp Groups</strong> available in your selector
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        handleRefreshLiveGroups();
                        setActiveTab('import');
                      }}
                      disabled={isRefreshingGroups}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                    >
                      {isRefreshingGroups ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Refresh Groups &amp; Go to Selector
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDisconnectWhatsApp}
                      className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 text-xs"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      Unlink &amp; Clear Session
                    </Button>
                  </div>
                </>
              ) : waSession?.status === 'qr_ready' && waSession.qrDataUrl ? (
                <>
                  <div className="bg-white p-4 rounded-xl shadow-md border-2 border-emerald-500">
                    <img
                      src={waSession.qrDataUrl}
                      alt="WhatsApp Link QR Code"
                      className="w-60 h-60 object-contain mx-auto"
                    />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-sm font-black text-slate-900">
                      Scan this QR Code with WhatsApp on Your Phone
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      1. Open <strong>WhatsApp</strong> on your phone<br />
                      2. Tap <strong>Menu (⋮) or Settings → Linked Devices → Link a Device</strong><br />
                      3. Point your phone camera at this QR code.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleStartLiveWhatsApp(true)}
                    className="text-xs gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Generate Fresh QR Code
                  </Button>
                </>
              ) : waSession?.status === 'connecting' || isStartingSession ? (
                <div className="py-8 flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                  <p className="text-sm font-bold text-slate-700">Generating WhatsApp QR Code...</p>
                  <p className="text-xs text-slate-500">Connecting to WhatsApp Web...</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleStartLiveWhatsApp(true)}
                    className="mt-2 text-xs gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reset &amp; Force New QR Code
                  </Button>
                </div>
              ) : (
                <>
                  <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Smartphone className="h-7 w-7" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-base font-bold text-slate-900">
                      Link Your WhatsApp Privately (Admin / Manager Only)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Scan a live QR code with your phone. Your personal chats and groups are <strong>never</strong> uploaded to the app database—you simply pick which work group and which specific messages to pull into your FSR.
                    </p>
                    {waSession?.lastError && (
                      <p className="text-xs text-red-600 font-semibold mt-2">{waSession.lastError}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleStartLiveWhatsApp(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 px-6"
                  >
                    <QrCode className="h-4 w-4" />
                    Generate WhatsApp QR Code
                  </Button>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
