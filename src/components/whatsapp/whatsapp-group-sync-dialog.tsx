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
import type { Channel, ChatMessage } from '@/lib/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface WhatsAppSessionState {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'error';
  qrDataUrl: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  groupsCount: number;
  syncedMessagesCount: number;
  lastError: string | null;
  groups: { jid: string; channelId: string; subject: string; participantsCount: number }[];
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
  onChannelSynced,
}: WhatsAppGroupSyncDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'import' | 'sync'>(defaultTab);
  const [channels, setChannels] = useState<(Channel & { whatsappJid?: string })[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Live WhatsApp QR Session state
  const [waSession, setWaSession] = useState<WhatsAppSessionState | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isRefreshingGroups, setIsRefreshingGroups] = useState(false);
  const [isRequestingOlder, setIsRequestingOlder] = useState(false);

  // Import by Date Range state
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState<string>(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [channelMessages, setChannelMessages] = useState<(ChatMessage & { resolvedDateStr: string; resolvedTimeStr: string })[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [keywordFilter, setKeywordFilter] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const loadChannels = useCallback(async () => {
    if (!firestore) return;
    setLoadingChannels(true);
    try {
      const snap = await getDocs(query(collection(firestore, 'channels'), orderBy('lastMessageTime', 'desc')));
      const list: (Channel & { whatsappJid?: string })[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (!data.isDeleted) {
          list.push({ id: d.id, ...data });
        }
      });

      // Also include any WhatsApp channels that don't have a lastMessageTime yet
      const allSnap = await getDocs(collection(firestore, 'channels'));
      const existingIds = new Set(list.map((c) => c.id));
      allSnap.forEach((d) => {
        if (!existingIds.has(d.id)) {
          const data = d.data() as any;
          if (!data.isDeleted) {
            list.push({ id: d.id, ...data });
          }
        }
      });

      // Sort WhatsApp groups to top, then alphabetically
      list.sort((a, b) => {
        const aIsWa = a.type === 'whatsapp' || a.name?.startsWith('WhatsApp:') ? 0 : 1;
        const bIsWa = b.type === 'whatsapp' || b.name?.startsWith('WhatsApp:') ? 0 : 1;
        if (aIsWa !== bIsWa) return aIsWa - bIsWa;
        return (a.name || '').localeCompare(b.name || '');
      });

      setChannels(list);

      if (defaultChannelId && list.some((c) => c.id === defaultChannelId)) {
        setSelectedChannelId(defaultChannelId);
      } else if (!selectedChannelId && list.length > 0) {
        const waChan = list.find((c) => c.type === 'whatsapp' || c.name?.toLowerCase().includes('whatsapp'));
        setSelectedChannelId(waChan ? waChan.id : list[0].id);
      }
    } catch (e: any) {
      console.error('Error loading channels:', e);
    } finally {
      setLoadingChannels(false);
    }
  }, [firestore, defaultChannelId, selectedChannelId]);

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
      loadChannels();
      fetchWaStatus().then((st) => {
        if (st && st.status !== 'connected' && defaultTab === 'sync') {
          setActiveTab('sync');
        }
      });
    }
  }, [open, defaultDate, defaultTab, loadChannels, fetchWaStatus]);

  // Poll WhatsApp session status while dialog is open and connecting / waiting for QR scan / syncing
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(async () => {
      const prevStatus = waSession?.status;
      const prevGroupsCount = waSession?.groupsCount || 0;
      const st = await fetchWaStatus();
      if (st) {
        if (
          (prevStatus !== 'connected' && st.status === 'connected') ||
          (st.groupsCount > prevGroupsCount)
        ) {
          await loadChannels();
          if (prevStatus !== 'connected' && st.status === 'connected') {
            toast({
              title: 'WhatsApp Connected!',
              description: `Linked to ${st.connectedName || st.connectedPhone}. Found ${st.groupsCount} WhatsApp groups.`,
            });
          }
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [open, waSession?.status, waSession?.groupsCount, fetchWaStatus, loadChannels, toast]);

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
      const data = await res.json();
      setWaSession(data);
      await loadChannels();
      toast({
        title: 'WhatsApp Groups Refreshed',
        description: `Synced ${data.groupsCount || 0} WhatsApp groups from your phone.`,
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
      toast({ title: 'WhatsApp Disconnected', description: 'You can link a new device anytime.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const loadSelectedChannelMessages = useCallback(async () => {
    if (!selectedChannelId || !firestore) return;
    setLoadingMessages(true);
    try {
      const msgsSnap = await getDocs(
        query(collection(firestore, `channels/${selectedChannelId}/messages`), orderBy('createdAt', 'asc'))
      );

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
    } catch (e) {
      console.error('Failed to load channel messages:', e);
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedChannelId, firestore]);

  useEffect(() => {
    if (open && selectedChannelId) {
      loadSelectedChannelMessages();
    }
  }, [open, selectedChannelId, loadSelectedChannelMessages]);

  const selectedChannelObj = useMemo(
    () => channels.find((c) => c.id === selectedChannelId),
    [channels, selectedChannelId]
  );

  const handleRequestOlderHistoryFromPhone = async () => {
    const groupJid = selectedChannelObj?.whatsappJid;
    if (!groupJid) {
      toast({
        variant: 'destructive',
        title: 'Not a Live Linked Group',
        description: 'Please connect WhatsApp in Tab 2 and select a WhatsApp group first.',
      });
      return;
    }

    setIsRequestingOlder(true);
    try {
      const res = await fetch('/api/whatsapp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch_older', groupJid, count: 150 }),
      });
      const data = await res.json();
      toast({
        title: 'Syncing Older Messages from Phone...',
        description: data?.historyRequest?.message || 'Fetching older group history from your phone.',
      });
      setTimeout(() => {
        loadSelectedChannelMessages();
      }, 3000);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'History Sync Error', description: err.message });
    } finally {
      setIsRequestingOlder(false);
    }
  };

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

  const channelDateSpan = useMemo(() => {
    if (channelMessages.length === 0) return null;
    const dates = channelMessages.map((m) => m.resolvedDateStr).filter(Boolean).sort();
    if (dates.length === 0) return null;
    return { earliest: dates[0], latest: dates[dates.length - 1], count: channelMessages.length };
  }, [channelMessages]);

  const isWaConnected = waSession?.status === 'connected';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              Live WhatsApp Group Integration
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
                ? `WhatsApp Live (${waSession?.connectedName || waSession?.connectedPhone}) • ${waSession?.groupsCount || 0} Groups`
                : 'WhatsApp Not Linked Yet'}
            </Badge>
          </div>
          <DialogDescription>
            Link your WhatsApp once via QR code (just like WhatsApp Web), then select any WhatsApp Group and Date Range to import directly into your Field Service Report.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'import' | 'sync')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="gap-2 font-bold">
              <Calendar className="h-4 w-4 text-emerald-600" />
              1. Select WhatsApp Group & Date Range
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2 font-bold">
              <QrCode className="h-4 w-4 text-blue-600" />
              2. Link Live WhatsApp (QR Code)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SELECT WHATSAPP GROUP + DATE RANGE -> IMPORT INTO FSR */}
          <TabsContent value="import" className="flex-1 flex flex-col gap-3 overflow-hidden mt-3">
            {!isWaConnected && channels.filter((c) => c.type === 'whatsapp' || c.name?.startsWith('WhatsApp:')).length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-4">
                <div className="text-xs text-amber-900">
                  <p className="font-bold">Your WhatsApp account is not linked yet.</p>
                  <p className="text-amber-700">Click the button on the right to scan a WhatsApp QR code once and load all your WhatsApp groups automatically.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-1.5 font-bold"
                  onClick={() => {
                    setActiveTab('sync');
                    handleStartLiveWhatsApp(false);
                  }}
                >
                  <QrCode className="h-4 w-4" />
                  Link WhatsApp Now
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="md:col-span-5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-slate-500">Select WhatsApp Group</Label>
                  <button
                    type="button"
                    onClick={() => loadSelectedChannelMessages()}
                    className="text-[10px] text-emerald-700 hover:underline font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="h-2.5 w-2.5" /> Refresh
                  </button>
                </div>
                <select
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  className="w-full h-9 mt-1 px-2.5 border border-slate-300 rounded-md text-xs font-bold bg-white"
                >
                  {loadingChannels ? (
                    <option value="">Loading WhatsApp groups...</option>
                  ) : channels.length === 0 ? (
                    <option value="">No WhatsApp groups linked yet — click Tab 2</option>
                  ) : (
                    channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
                {channelDateSpan && (
                  <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                    Synced: {channelDateSpan.count} msgs ({channelDateSpan.earliest} → {channelDateSpan.latest})
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
                  Select All ({selectedMsgIds.size} of {filteredMessages.length} messages)
                </Button>

                {isWaConnected && selectedChannelObj?.whatsappJid && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRequestingOlder}
                    onClick={handleRequestOlderHistoryFromPhone}
                    className="h-7 text-[11px] gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    {isRequestingOlder ? <Loader2 className="h-3 w-3 animate-spin" /> : <History className="h-3 w-3" />}
                    Fetch Older History from Phone
                  </Button>
                )}
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading WhatsApp group messages...
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-slate-500 text-xs gap-3 p-4">
                  <p>
                    No messages found in <strong>{selectedChannelObj?.name || 'this group'}</strong> between{' '}
                    <strong>{fromDate || 'start'}</strong> and <strong>{toDate || 'end'}</strong>.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {channelDateSpan && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFromDate(channelDateSpan.earliest);
                          setToDate(channelDateSpan.latest);
                        }}
                        className="text-xs h-8 font-bold"
                      >
                        Show All Synced Dates ({channelDateSpan.earliest} → {channelDateSpan.latest})
                      </Button>
                    )}
                    {isWaConnected && selectedChannelObj?.whatsappJid && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isRequestingOlder}
                        onClick={handleRequestOlderHistoryFromPhone}
                        className="text-xs h-8 border-blue-300 text-blue-700 font-bold gap-1.5"
                      >
                        <History className="h-3.5 w-3.5" />
                        Pull Older Messages from Phone
                      </Button>
                    )}
                    {!isWaConnected && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setActiveTab('sync');
                          handleStartLiveWhatsApp(false);
                        }}
                        className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Connect WhatsApp via QR Code
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
                      WhatsApp Connected in Real Time
                    </h3>
                    <p className="text-xs text-slate-600">
                      Linked Account: <strong>{waSession?.connectedName || waSession?.connectedPhone}</strong> •{' '}
                      <strong>{waSession?.groupsCount || 0} WhatsApp Groups</strong> discovered •{' '}
                      <strong>{waSession?.syncedMessagesCount || 0} messages</strong> synced in session
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
                      Refresh Groups & Go to Selector
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDisconnectWhatsApp}
                      className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 text-xs"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      Disconnect WhatsApp
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
                      3. Point your phone camera at this QR code. Your WhatsApp groups will load automatically!
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
                <div className="py-10 flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                  <p className="text-sm font-bold text-slate-700">Connecting to WhatsApp Server & Generating QR Code...</p>
                  <p className="text-xs text-slate-500">This takes about 3–5 seconds.</p>
                </div>
              ) : (
                <>
                  <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Smartphone className="h-7 w-7" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-base font-bold text-slate-900">
                      Link Your WhatsApp Groups Directly to the App
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Click the button below to display a live WhatsApp QR code. Once you scan it with your phone (just like WhatsApp Web), all of your WhatsApp groups and their conversations will sync automatically—no file exports or uploads needed.
                    </p>
                    {waSession?.lastError && (
                      <p className="text-xs text-red-600 font-semibold mt-2">Error: {waSession.lastError}</p>
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
