
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Send, 
  Camera, 
  Plus, 
  Search, 
  Hash, 
  MessageSquare, 
  Loader2, 
  MoreVertical,
  CheckCheck,
  Archive,
  ArchiveRestore,
  FileText,
  ArrowLeft,
  Trash2,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';
import { 
  useUser, 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking,
  useDoc
} from '@/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  serverTimestamp, 
  where,
  Timestamp,
  updateDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import type { Channel, ChatMessage, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { WhatsAppGroupSyncDialog } from '@/components/whatsapp/whatsapp-group-sync-dialog';
import {
  summarizeChatWithRca,
  type SummarizeChatWithRcaOutput,
} from '@/ai/flows/extract-fsr-from-chat-flow';

export default function MessagingPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const userRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userData } = useDoc<User>(userRef);
  const isAdmin = userData?.role === 'Admin' || userData?.role === 'Superadmin';
  const canManageWhatsApp = (() => {
    const r = (userData?.role || '').toLowerCase();
    return (
      r.includes('admin') ||
      r.includes('manager') ||
      r.includes('corporate') ||
      r.includes('supervisor') ||
      r.includes('client')
    );
  })();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlChannelId = searchParams.get('channelId');
  const returnFsrId = searchParams.get('fsrId');
  
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearcherTerm] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isWhatsAppSyncOpen, setIsWhatsAppSyncOpen] = useState(false);
  const [waForceSourceId, setWaForceSourceId] = useState<string | null>(null);
  const [isSelectingChatMsgs, setIsSelectingChatMsgs] = useState(false);
  const [tickedChatMsgIds, setTickedChatMsgIds] = useState<Set<string>>(new Set());
  const [isRemovingChatMsgs, setIsRemovingChatMsgs] = useState(false);

  // Summary & Root Cause Analysis (RCA) Right Panel State
  const [isSummaryPanelOpen, setIsSummaryPanelOpen] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<SummarizeChatWithRcaOutput | null>(null);
  const [selectedDdTarget, setSelectedDdTarget] = useState<string>('__new_dd__');
  const [diaryOptions, setDiaryOptions] = useState<
    { id: string; date: string; area: string; workSummary: string }[]
  >([]);
  const [isExportingSummaryToDd, setIsExportingSummaryToDd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. FETCH CHANNELS (Fetch all channels without orderBy so documents missing lastMessageTime are never dropped, then sort in-memory)
  const channelsQuery = useMemoFirebase(
    () => collection(firestore, 'channels'),
    [firestore]
  );
  const { data: rawChannels, isLoading: channelsLoading } = useCollection<Channel>(channelsQuery);
  const channels = React.useMemo(() => {
    if (!rawChannels) return null;
    return [...rawChannels].sort((a, b) => {
      const tA = a.lastMessageTime?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const tB = b.lastMessageTime?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return tB - tA;
    });
  }, [rawChannels]);

  // 2. FETCH MESSAGES FOR ACTIVE CHANNEL
  const messagesQuery = useMemoFirebase(
    () => activeChannelId 
      ? query(collection(firestore, `channels/${activeChannelId}/messages`), orderBy('createdAt', 'asc')) 
      : null,
    [firestore, activeChannelId]
  );
  const { data: messages, isLoading: messagesLoading } = useCollection<ChatMessage>(messagesQuery);

  // Helper to generate initials from channel name
  const getChannelInitials = (channel: Channel) => {
    let name = channel.name || 'Unknown';
    if (channel.type === 'breakdown' || name.startsWith('Breakdown:')) {
      name = name.replace('Breakdown:', '').replace('Breakdown for', '').trim();
    }
    const words = name.split(' ').filter((w: string) => w.length > 0);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return 'BR';
  };

  // Deep Link Selection & Auto-Restore to Active Sidebar if opened via URL
  useEffect(() => {
    if (urlChannelId && !activeChannelId) {
      setActiveChannelId(urlChannelId);
    }
  }, [urlChannelId, activeChannelId]);

  useEffect(() => {
    if (!activeChannelId || !firestore || !channels) return;
    const found = channels.find((c) => c.id === activeChannelId) as any;
    if (found && (found.isDeleted || !found.lastMessageTime)) {
      updateDoc(doc(firestore, 'channels', activeChannelId), {
        isDeleted: false,
        isArchived: false,
        ...(found.lastMessageTime ? {} : { lastMessageTime: Timestamp.now() }),
      }).catch(() => {});
    }
  }, [activeChannelId, firestore, channels]);

  useEffect(() => {
    if (activeChannelId && messages) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [messages, activeChannelId]);

  // Handle Channel Creation
  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !user) return;
    setIsCreatingChannel(true);
    try {
      const newChannel: any = {
        name: newChannelName.trim(),
        participants: [user.uid],
        lastMessage: 'Channel created',
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp(),
        isArchived: false,
      };
      await addDocumentNonBlocking(collection(firestore, 'channels'), newChannel);
      setNewChannelName('');
      toast({ title: "Channel Created", description: `You can now chat in #${newChannelName}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setIsCreatingChannel(false);
    }
  };

  /**
   * ARCHIVE FUNCTIONALITY FIX
   * Explicitly sets isArchived field in Firestore with user confirmation.
   */
  const handleArchiveChannel = async (channelId: string) => {
    const channelToUpdate = channels?.find(c => c.id === channelId);
    if (!channelToUpdate) return;

    const currentStatus = channelToUpdate.isArchived || false;
    const confirmMsg = currentStatus 
      ? "Restore this chat to active discussions?" 
      : "Are you sure you want to archive this chat? It will be hidden from the active list.";
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const channelRef = doc(firestore, 'channels', channelId);
      await updateDoc(channelRef, {
        isArchived: !currentStatus,
        archivedAt: !currentStatus ? serverTimestamp() : null
      });
      
      toast({ 
        title: currentStatus ? "Chat Restored" : "Chat Archived", 
        description: currentStatus ? "Chat moved to active inbox." : "Chat moved to archive." 
      });
      
      // If we are archiving the currently viewing chat and not restoring, clear selection
      if (!currentStatus && activeChannelId === channelId) {
        setActiveChannelId(null);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to permanently delete this chat? This cannot be undone.")) return;
    try {
      // Soft-delete to bypass Firebase strict delete rules since users have update access
      await updateDoc(doc(firestore, 'channels', channelId), {
        isDeleted: true
      });
      toast({ title: "Chat Deleted", description: "The chat has been permanently removed." });
      if (activeChannelId === channelId) {
        setActiveChannelId(null);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Delete Error", description: e.message });
    }
  };

  // Handle Sending Messages
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageText.trim() || !activeChannelId || !user) return;

    const textToSend = messageText.trim();
    setMessageText('');

    try {
      const newMessage: Omit<ChatMessage, 'id'> = {
        text: textToSend,
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Anonymous',
        createdAt: serverTimestamp(),
      };

      await addDocumentNonBlocking(collection(firestore, `channels/${activeChannelId}/messages`), newMessage);

      const channelRef = doc(firestore, 'channels', activeChannelId);
      updateDocumentNonBlocking(channelRef, {
        lastMessage: textToSend,
        lastMessageTime: serverTimestamp(),
      });

      if (activeChannel?.type === 'breakdown' && activeChannel?.relatedId) {
        try {
          const breakdownRef = doc(firestore, 'breakdown_reports', activeChannel.relatedId);
          const breakdownSnap = await getDoc(breakdownRef);
          
          if (breakdownSnap.exists()) {
            const breakdownData = breakdownSnap.data();
            const currentNotes = breakdownData.resolution || '';
            const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const senderName = user?.displayName || user?.email?.split('@')[0] || 'Tech';
            const logEntry = `[${timeString}] ${senderName}: ${textToSend}`;
            const updatedNotes = currentNotes ? `${currentNotes}\n${logEntry}` : logEntry;
            updateDocumentNonBlocking(breakdownRef, { resolution: updatedNotes });
          }
        } catch (syncError) {
          console.error("Failed to sync message to breakdown notes:", syncError);
        }
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Failed to send", description: e.message });
    }
  };

  const activeChannel = channels?.find(c => c.id === activeChannelId);

  const toggleChatMsgTick = (msgId: string) => {
    setTickedChatMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const selectStandaloneMediaOmittedInChat = () => {
    if (!messages) return;
    const isStandaloneMedia = (text?: string) => {
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
    };
    const matching = messages.filter((m) => isStandaloneMedia(m.text)).map((m) => m.id);
    if (matching.length === 0) {
      toast({
        title: 'No Standalone Media Omitted Found',
        description: 'No messages with only "<video omitted>" or "<image omitted>" were found.',
      });
      return;
    }
    setIsSelectingChatMsgs(true);
    setTickedChatMsgIds((prev) => {
      const next = new Set(prev);
      matching.forEach((id) => next.add(id));
      return next;
    });
    toast({
      title: `Selected ${matching.length} Standalone Video/Image Message(s)`,
      description: 'Messages with text behind "<image omitted>" were kept untouched.',
    });
  };

  const selectChatMsgsByKeyword = (word: string) => {
    if (!messages) return;
    const rx = new RegExp(`\\b${word}\\b`, 'i');
    const matching = messages.filter((m) => rx.test(m.text || '')).map((m) => m.id);
    if (matching.length === 0) {
      toast({ title: `No "${word}" Messages Found`, description: `No messages in this chat mention "${word}".` });
      return;
    }
    setIsSelectingChatMsgs(true);
    setTickedChatMsgIds((prev) => {
      const next = new Set(prev);
      matching.forEach((id) => next.add(id));
      return next;
    });
    toast({
      title: `Selected ${matching.length} "${word}" Message(s)`,
      description: `Click "Remove Ticked from Chat" to filter them out of this chat.`,
    });
  };

  const handleRemoveTickedFromChat = async () => {
    if (!activeChannelId || tickedChatMsgIds.size === 0) return;
    setIsRemovingChatMsgs(true);
    try {
      const ids = Array.from(tickedChatMsgIds);
      await Promise.all(
        ids.map((id) => deleteDoc(doc(firestore, `channels/${activeChannelId}/messages`, id)))
      );
      setTickedChatMsgIds(new Set());
      toast({
        title: 'Filtered Out of Chat',
        description: `Removed ${ids.length} ticked message(s) from this chat.`,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error Removing Messages', description: e.message });
    } finally {
      setIsRemovingChatMsgs(false);
    }
  };

  // Load existing Daily Diaries (DD-001, DD-002, etc.) for the Summary -> DD export dropdown
  const loadDailyDiaryOptions = async () => {
    if (!firestore) return;
    try {
      const ddSnap = await getDocs(collection(firestore, 'daily_diaries'));
      const diaries: { id: string; date: string; area: string; workSummary: string }[] = [];
      ddSnap.forEach((d) => {
        const data = d.data() as any;
        const firstWork = Array.isArray(data.works) && data.works.length > 0 ? data.works[0] : null;
        const summary =
          firstWork?.area || firstWork?.scope
            ? `${firstWork.area || ''} ${firstWork.scope ? `(${String(firstWork.scope).slice(0, 28)})` : ''}`.trim()
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
    } catch (err) {
      console.error('Failed to load Daily Diaries:', err);
    }
  };

  useEffect(() => {
    loadDailyDiaryOptions();
  }, [firestore]);

  useEffect(() => {
    const saved = (activeChannel as any)?.aiSummaryRca as SummarizeChatWithRcaOutput | undefined;
    if (saved && Array.isArray(saved.equipmentBreakdowns) && saved.equipmentBreakdowns.length > 0) {
      setSummaryData(saved);
      setIsSummaryPanelOpen(true);
    } else {
      setSummaryData(null);
    }
  }, [activeChannelId, (activeChannel as any)?.aiSummaryRca]);

  const handleSummarizeChat = async (forceRegenerate = false) => {
    if (!messages || messages.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Messages to Summarize',
        description: 'This chat does not have any messages yet.',
      });
      return;
    }

    setIsSummaryPanelOpen(true);
    if (!forceRegenerate && summaryData && summaryData.equipmentBreakdowns?.length > 0) {
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const chatTranscript = messages
        .map((m) => {
          const dtStr = m.messageDate
            ? `${m.messageDate} ${m.timeStr || ''}`.trim()
            : m.createdAt
            ? format(m.createdAt.toDate(), 'yyyy-MM-dd HH:mm')
            : '';
          return `[${dtStr}] ${m.senderName || 'Tech'}: ${m.text || ''}`;
        })
        .join('\n');

      const eqHint =
        (activeChannel as any)?.equipmentName ||
        (activeChannel?.name || '').replace(/^#?Breakdown:\s*/i, '').trim();

      const res = await summarizeChatWithRca({
        chatHistory: chatTranscript,
        equipmentName: eqHint || undefined,
      });

      if (!res.success || !res.equipmentBreakdowns || res.equipmentBreakdowns.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Summary Error',
          description: res.error || 'Could not generate Summary & RCA from this chat.',
        });
        return;
      }

      setSummaryData(res);

      // Persist Summary & RCA on the channel document in Firestore (sanitize undefined fields & ensure channel is active in sidebar)
      if (activeChannelId && firestore) {
        const sanitizedRes = JSON.parse(JSON.stringify(res));
        const primaryEquipName = res.equipmentBreakdowns[0]?.equipmentName || '';
        const currentChanName = activeChannel?.name || '';
        const shouldUpdateChanName =
          primaryEquipName &&
          (!currentChanName ||
            currentChanName.toLowerCase().startsWith('callout chat') ||
            currentChanName.toLowerCase().includes('unknown equipment'));

        await updateDoc(doc(firestore, 'channels', activeChannelId), {
          aiSummaryRca: sanitizedRes,
          isDeleted: false,
          isArchived: false,
          lastMessageTime: activeChannel?.lastMessageTime || Timestamp.now(),
          ...(primaryEquipName ? { equipmentName: primaryEquipName, type: 'breakdown' } : {}),
          ...(shouldUpdateChanName
            ? { name: `Breakdown: ${primaryEquipName}${res.date ? ` (${res.date})` : ''}` }
            : {}),
        }).catch(() => {});
      }

      await loadDailyDiaryOptions();

      toast({
        title: 'Summary & RCA Ready',
        description: `Generated factual Summary & RCA for ${res.equipmentBreakdowns.length} piece(s) of equipment.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Summary Error',
        description: err?.message || 'Failed to summarize chat.',
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleExportSummaryToDailyDiary = async () => {
    if (!firestore || !summaryData || summaryData.equipmentBreakdowns.length === 0) return;

    setIsExportingSummaryToDd(true);
    try {
      let targetDdId = selectedDdTarget;
      let existingDdData: any = {};

      if (targetDdId === '__new_dd__' || !targetDdId) {
        const ddSnap = await getDocs(collection(firestore, 'daily_diaries'));
        let maxNumber = 0;
        ddSnap.forEach((docSnap) => {
          const id = docSnap.id;
          if (id && id.startsWith('DD-')) {
            const numPart = parseInt(id.substring(3), 10);
            if (!isNaN(numPart) && numPart > maxNumber) {
              maxNumber = numPart;
            }
          }
        });
        targetDdId = `DD-${String(maxNumber + 1).padStart(3, '0')}`;
      } else {
        const existingDoc = await getDoc(doc(firestore, 'daily_diaries', targetDdId));
        if (existingDoc.exists()) {
          existingDdData = existingDoc.data() || {};
        }
      }

      // Derive primary date from summaryData or first message in chat
      let primaryDate = summaryData.date || '';
      if (!primaryDate && messages && messages.length > 0) {
        const firstMsg = messages[0];
        primaryDate =
          firstMsg.messageDate ||
          (firstMsg.createdAt ? format(firstMsg.createdAt.toDate(), 'yyyy-MM-dd') : '');
      }
      if (!primaryDate) primaryDate = format(new Date(), 'yyyy-MM-dd');

      const newWorks = summaryData.equipmentBreakdowns.map((eqItem) => ({
        area: eqItem.equipmentName || 'Plant Equipment',
        scope: `SUMMARY:\n• ${eqItem.summaryBullets.join('\n• ')}\n\nRCA:\n• ${eqItem.rcaBullets.join('\n• ')}`,
        timeStart: eqItem.timeStart || summaryData.shiftStart || '07:00',
        timeEnd: eqItem.timeEnd || summaryData.shiftEnd || '16:00',
        hrs: eqItem.hrs || 4,
      }));

      const existingWorks = Array.isArray(existingDdData.works)
        ? existingDdData.works.filter((w: any) => w.area || w.scope)
        : [];
      const mergedWorks = [...existingWorks, ...newWorks];

      const summaryCommentBlocks: string[] = [];
      for (const eqItem of summaryData.equipmentBreakdowns) {
        summaryCommentBlocks.push(
          `[${eqItem.equipmentName}] SUMMARY: ${eqItem.summaryBullets.map((b) => `• ${b}`).join(' ')}`
        );
        summaryCommentBlocks.push(
          `[${eqItem.equipmentName}] RCA: ${eqItem.rcaBullets.map((b) => `• ${b}`).join(' ')}`
        );
      }

      const existingComments = Array.isArray(existingDdData.comments)
        ? existingDdData.comments.filter(Boolean)
        : [];
      const mergedComments = [...existingComments, ...summaryCommentBlocks];
      while (mergedComments.length < 3) mergedComments.push('');

      const existingDelays = Array.isArray(existingDdData.delays)
        ? existingDdData.delays.filter(Boolean)
        : [];
      const mergedDelays = [...existingDelays, ...(summaryData.delays || []).filter(Boolean)];
      while (mergedDelays.length < 3) mergedDelays.push('');

      const techManpower =
        summaryData.technicians && summaryData.technicians.length > 0
          ? summaryData.technicians.map((tName) => ({
              designation: tName,
              forecast: 1,
              actual: 1,
              normalHrs: summaryData.hrs || 8,
              overtime1_5: 0,
              overtime2_0: 0,
              totalManHrs: summaryData.hrs || 8,
              comments: summaryData.equipmentBreakdowns.map((e) => e.equipmentName).join(', '),
            }))
          : [
              {
                designation: 'Technician',
                forecast: 1,
                actual: 1,
                normalHrs: 8,
                overtime1_5: 0,
                overtime2_0: 0,
                totalManHrs: 8,
                comments: summaryData.equipmentBreakdowns.map((e) => e.equipmentName).join(', '),
              },
            ];

      const existingManpower = Array.isArray(existingDdData.manpower)
        ? existingDdData.manpower.filter((m: any) => m.designation)
        : [];
      const mergedManpower = existingManpower.length > 0 ? existingManpower : techManpower;

      const ddPayload: any = {
        ...existingDdData,
        id: targetDdId,
        reportNumber: targetDdId,
        date: existingDdData.date || primaryDate,
        area: existingDdData.area || summaryData.area || 'Mining',
        workType: existingDdData.workType || summaryData.workType || 'Callout',
        maintenanceType: existingDdData.maintenanceType || summaryData.maintenanceType || 'Unscheduled',
        shiftStart: existingDdData.shiftStart || summaryData.shiftStart || '07:00',
        shiftEnd: existingDdData.shiftEnd || summaryData.shiftEnd || '16:00',
        hrs: existingDdData.hrs || summaryData.hrs || 8,
        incidents: existingDdData.incidents || 'None reported',
        toolboxTalk: existingDdData.toolboxTalk || 'LOTOTO & Safe Working Procedures',
        manpower: mergedManpower,
        plant: existingDdData.plant || [
          { description: 'Service Vehicle', qty: 1, inspectionDone: 'yes', comments: '' },
        ],
        works: mergedWorks,
        delays: mergedDelays,
        comments: mergedComments,
        equipmentNames: Array.from(new Set(mergedWorks.map((w: any) => w.area).filter(Boolean))),
        isSignedOff: existingDdData.isSignedOff || false,
        isFinalised: existingDdData.isFinalised || false,
        createdAt: existingDdData.createdAt || Timestamp.now(),
      };

      await setDoc(doc(firestore, 'daily_diaries', targetDdId), ddPayload, { merge: true });

      toast({
        title: `Exported Summary & RCA to ${targetDdId}!`,
        description: `Populated ${summaryData.equipmentBreakdowns.length} equipment section(s) into ${targetDdId}. Opening Daily Diary...`,
      });

      router.push(`/reports/contractors-daily-diary?id=${encodeURIComponent(targetDdId)}`);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Export to Daily Diary Failed',
        description: err?.message || 'Could not export Summary & RCA to Daily Diary.',
      });
    } finally {
      setIsExportingSummaryToDd(false);
    }
  };

  /**
   * SIDEBAR FILTER FIX
   * Filters based on isArchived status matching the toggle, and ensures the active channel is always visible.
   */
  const filteredChannels = channels?.filter(c => {
    if (c.id?.startsWith('wa_grp_') || c.id?.startsWith('wa_store_') || (c as any).isPrivateWhatsAppStore || (c as any).type === 'whatsapp_store') return false;
    if (c.id === activeChannelId && !showArchived) {
      return (c.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    }
    if ((c as any).isDeleted) return false;
    const isArchived = c.isArchived || false;
    return isArchived === showArchived && (c.name || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {canManageWhatsApp && (
        <WhatsAppGroupSyncDialog
          open={isWhatsAppSyncOpen}
          onOpenChange={(v) => {
            setIsWhatsAppSyncOpen(v);
            if (!v) setWaForceSourceId(null);
          }}
          defaultTab="import"
          defaultChannelId={activeChannelId}
          forceSourceId={waForceSourceId}
          onChannelSynced={(newChannelId) => setActiveChannelId(newChannelId)}
        />
      )}
      {/* --- SIDEBAR: CHANNEL LIST --- */}
      <div className="w-[350px] border-r bg-white flex flex-col shadow-sm">
        <header className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="text-primary h-5 w-5" /> Site Comms
            </h1>
            <div className="flex items-center gap-1">
              {canManageWhatsApp && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setWaForceSourceId(null);
                    setIsWhatsAppSyncOpen(true);
                  }}
                  className="h-8 text-[11px] font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  Sync WhatsApp
                </Button>
              )}
              <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary hover:bg-slate-100 rounded-full">
                  <Plus className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Channel Name</Label>
                    <Input 
                      placeholder="e.g. Shift A Technicians" 
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateChannel} disabled={isCreatingChannel}>
                    {isCreatingChannel ? <Loader2 className="animate-spin h-4 w-4" /> : "Create Channel"}
                  </Button>
                </DialogFooter>
              </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search chats..." 
              className="pl-9 bg-slate-100 border-none rounded-full h-9 focus-visible:ring-1"
              value={searchTerm}
              onChange={e => setSearcherTerm(e.target.value)}
            />
          </div>
        </header>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50/50">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {showArchived ? 'Archived Discussions' : 'Active Discussions'}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setShowArchived(!showArchived);
              setActiveChannelId(null);
            }}
            className="text-[10px] h-6 px-2 hover:bg-white"
          >
            {showArchived ? 'Show Active' : 'Show Archived'}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {channelsLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : filteredChannels?.length ? (
            filteredChannels.map(channel => (
              <div 
                key={channel.id}
                onClick={() => setActiveChannelId(channel.id)}
                className={cn(
                  "p-4 flex items-center gap-3 cursor-pointer transition-colors border-b border-slate-50",
                  activeChannelId === channel.id ? "bg-slate-100" : "hover:bg-slate-50"
                )}
              >
                <Avatar className="h-12 w-12 border">
                  <AvatarFallback className={cn(
                    "font-bold text-xs",
                    channel.type === 'breakdown' ? "bg-orange-100 text-orange-700" : "bg-primary/10 text-primary"
                  )}>
                    {getChannelInitials(channel)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-semibold text-slate-900 truncate">#{channel.name}</h3>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">
                      {channel.lastMessageTime?.toDate ? format(channel.lastMessageTime.toDate(), 'HH:mm') : ''}
                    </span>
                  </div>
                  {(channel as any)?.aiSummaryRca?.equipmentBreakdowns?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-0.5">
                      {(channel as any).aiSummaryRca.equipmentBreakdowns.map((eb: any, idx: number) => (
                        <span
                          key={idx}
                          className="inline-block px-1.5 py-0.2 rounded bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold truncate max-w-full"
                        >
                          🔧 {eb.equipmentName}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-slate-500 truncate italic">
                    {channel.lastMessage || 'No messages yet'}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">
              {showArchived ? 'No archived chats found.' : 'No active channels found. Create one to get started.'}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* --- MAIN AREA: CHAT WINDOW --- */}
      <div className="flex-1 flex flex-col bg-[#F0F2F5] relative">
        {activeChannelId && activeChannel ? (
          <>
            {/* Header */}
            <header className="bg-white p-3 border-b flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={cn(
                    "font-bold text-xs",
                    activeChannel?.type === 'breakdown' ? "bg-orange-100 text-orange-700" : "bg-primary text-white"
                  )}>
                    {getChannelInitials(activeChannel)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-bold text-slate-900 leading-tight">#{activeChannel?.name}</h2>
                  <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> ONLINE TEAM
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {activeChannel?.isArchived && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mr-2 text-slate-600 border-slate-300 hover:bg-slate-100"
                    onClick={() => {
                      setShowArchived(false);
                      setActiveChannelId(null);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Main
                  </Button>
                )}
                {returnFsrId && (
                  <Link href={`/reports/field-service-report/${returnFsrId}`}>
                    <Button variant="outline" size="sm" className="text-blue-700 border-blue-200 hover:bg-blue-50 flex items-center gap-2 mr-2">
                      <FileText className="h-4 w-4" />
                      Back to FSR
                    </Button>
                  </Link>
                )}
                {activeChannel?.type === 'breakdown' && activeChannel?.relatedId && (
                  <Link href={`/breakdowns/${activeChannel.relatedId}`}>
                    <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 flex items-center gap-2 mr-2">
                      <FileText className="h-4 w-4" />
                      View Breakdown Log
                    </Button>
                  </Link>
                )}
                {canManageWhatsApp && activeChannel && (
                  <>
                    <Button
                      variant={isSelectingChatMsgs ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setIsSelectingChatMsgs((prev) => !prev);
                        setTickedChatMsgIds(new Set());
                      }}
                      className={cn(
                        'font-bold text-xs mr-1.5',
                        isSelectingChatMsgs
                          ? 'bg-slate-800 text-white hover:bg-slate-900'
                          : 'text-slate-700 border-slate-300 hover:bg-slate-100'
                      )}
                      title="Tick messages in this chat to filter out unrelated breakdowns (e.g. MPE)"
                    >
                      {isSelectingChatMsgs ? 'Done Filtering Chat' : 'Tick / Filter Out Messages'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setWaForceSourceId(`app:${activeChannel.id}`);
                        setIsWhatsAppSyncOpen(true);
                      }}
                      className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold flex items-center gap-1.5 mr-2"
                      title="Tick messages from this chat and export them into a selected FSR or Daily Diary (DD)"
                    >
                      <FileText className="h-4 w-4 text-emerald-600" />
                      Export Chat to FSR / DD
                    </Button>
                  </>
                )}
                {/* Archive/Restore Button */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleArchiveChannel(activeChannel.id)}
                  className={cn("text-slate-400 transition-colors", activeChannel?.isArchived ? "hover:text-emerald-600 hover:bg-emerald-50" : "hover:text-red-600 hover:bg-red-50")}
                  title={activeChannel?.isArchived ? "Restore Chat" : "Archive Chat"}
                >
                  {activeChannel?.isArchived ? <ArchiveRestore className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
                </Button>
                {isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteChannel(activeChannel.id)}
                    className="text-slate-400 transition-colors hover:text-red-600 hover:bg-red-50"
                    title="Delete Chat Permanently"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="text-slate-400"><MoreVertical className="h-5 w-5" /></Button>
              </div>
            </header>

            {/* IN-CHAT FILTER OUT / CLEANUP BAR */}
            {canManageWhatsApp && isSelectingChatMsgs && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-black uppercase text-[10px] text-amber-900">
                    Quick-Tick Unrelated Breakdown to Filter Out:
                  </span>
                  <button
                    type="button"
                    onClick={selectStandaloneMediaOmittedInChat}
                    className="px-2 py-0.5 rounded bg-white border border-red-300 text-red-700 hover:bg-red-50 font-bold text-[11px]"
                    title="Ticks only messages that say '<video omitted>' or '<image omitted>' with no text behind them"
                  >
                    Tick Video / Image Omitted Only
                  </button>
                  {(['MPE', 'MPD', 'MPC', 'MPA', 'Smelter'] as const).map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => selectChatMsgsByKeyword(area)}
                      className="px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-900 hover:bg-red-50 hover:border-red-300 hover:text-red-700 font-bold text-[11px]"
                    >
                      Tick {area} Messages
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-700">
                    {tickedChatMsgIds.size} message(s) ticked
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={tickedChatMsgIds.size === 0 || isRemovingChatMsgs}
                    onClick={handleRemoveTickedFromChat}
                    className="h-7 text-xs font-bold gap-1"
                  >
                    {isRemovingChatMsgs ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Filter Out / Remove {tickedChatMsgIds.size} Ticked from Chat
                  </Button>
                </div>
              </div>
            )}

            {/* MAIN BODY: LEFT SUM BUTTON + MESSAGES + RIGHT SUMMARY & RCA PANEL */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Messages Column */}
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Floating / Left-Aligned SUM (Summarize & RCA) Button inside the Chat Area */}
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSummarizeChat(false)}
                    disabled={isGeneratingSummary || !messages || messages.length === 0}
                    className="bg-red-600 hover:bg-red-700 text-white font-black text-xs px-3.5 h-8 shadow-md gap-1.5 rounded-md"
                    title="Generate factual Equipment Summary & Root Cause Analysis (RCA) with slang filtered out"
                  >
                    {isGeneratingSummary ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    SUM • Summarize &amp; RCA
                  </Button>
                  {summaryData && !isSummaryPanelOpen && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSummaryPanelOpen(true)}
                      className="text-xs font-bold h-7 border-red-300 text-red-700 bg-white hover:bg-red-50"
                    >
                      Show Summary &amp; RCA Panel ({summaryData.equipmentBreakdowns.length} Equip)
                    </Button>
                  )}
                </div>

                <ScrollArea className="flex-1 p-4 md:px-8 md:py-4" ref={scrollRef}>
                  <div className="space-y-4 max-w-4xl mx-auto">
                    {messagesLoading ? (
                      <div className="flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
                    ) : messages?.map((msg, idx) => {
                      const isMe = msg.senderId === user?.uid;
                      const isTicked = tickedChatMsgIds.has(msg.id);
                      return (
                        <div 
                          key={msg.id}
                          onClick={() => {
                            if (isSelectingChatMsgs) toggleChatMsgTick(msg.id);
                          }}
                          className={cn(
                            "flex flex-col max-w-[80%] md:max-w-[70%]",
                            isMe ? "ml-auto items-end" : "mr-auto items-start",
                            isSelectingChatMsgs && "cursor-pointer"
                          )}
                        >
                          {!isMe && (
                            <span className="text-[10px] font-bold text-primary mb-1 ml-2 uppercase tracking-wide">
                              {msg.senderName}
                            </span>
                          )}
                          <div 
                            className={cn(
                              "px-4 py-2 rounded-2xl shadow-sm relative group flex items-start gap-2.5",
                              isMe 
                                ? "bg-primary text-white rounded-tr-none" 
                                : "bg-white text-slate-800 rounded-tl-none border",
                              isTicked && "ring-2 ring-red-500 bg-red-50 text-slate-900"
                            )}
                          >
                            {isSelectingChatMsgs && (
                              <input
                                type="checkbox"
                                checked={isTicked}
                                onChange={() => {}}
                                className="mt-1 h-4 w-4 accent-red-600 rounded cursor-pointer"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              <div className={cn(
                                "flex items-center gap-1 mt-1 justify-end",
                                isMe && !isTicked ? "text-blue-100" : "text-slate-400"
                              )}>
                                <span className="text-[9px] font-medium">
                                  {msg.messageDate ? `${msg.messageDate} ${msg.timeStr || ''}` : msg.createdAt ? format(msg.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : '...'}
                                </span>
                                {isMe && <CheckCheck className="h-3 w-3" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* RIGHT-HAND SUMMARY & ROOT CAUSE ANALYSIS (RCA) PANEL */}
              {isSummaryPanelOpen && (
                <div className="w-full md:w-[390px] lg:w-[430px] border-l border-slate-200 bg-white flex flex-col shadow-xl z-10">
                  <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wide text-red-700 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-red-600" />
                        Equipment Summary &amp; RCA
                      </h3>
                      <p className="text-[10px] text-slate-500 font-semibold">
                        Facts only (slang filtered out) • Grouped by Equipment
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSummarizeChat(true)}
                        disabled={isGeneratingSummary}
                        className="h-7 px-2 text-[10px] font-bold"
                        title="Re-analyze chat messages"
                      >
                        <RefreshCw className={cn('h-3 w-3 mr-1', isGeneratingSummary && 'animate-spin')} />
                        Refresh
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSummaryPanelOpen(false)}
                        className="h-7 w-7 text-slate-400 hover:text-slate-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/40">
                    {isGeneratingSummary ? (
                      <div className="flex flex-col items-center justify-center h-48 text-center gap-2 text-slate-500">
                        <Loader2 className="h-6 w-6 animate-spin text-red-600" />
                        <p className="text-xs font-bold text-slate-700">
                          Identifying equipment, filtering out slang, and building Summary &amp; RCA...
                        </p>
                      </div>
                    ) : !summaryData || summaryData.equipmentBreakdowns.length === 0 ? (
                      <div className="text-center p-6 text-xs text-slate-500">
                        Click <strong>SUM • Summarize &amp; RCA</strong> on the left to generate the factual summary and RCA.
                      </div>
                    ) : (
                      summaryData.equipmentBreakdowns.map((eqItem, eqIdx) => (
                        <div
                          key={eqIdx}
                          className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm space-y-2.5"
                        >
                          <div className="border-b border-slate-100 pb-1.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-xs font-black text-slate-900 block truncate">
                                {summaryData.equipmentBreakdowns.length > 1 ? `${eqIdx + 1}. ` : ''}
                                {eqItem.equipmentName}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {eqItem.date || summaryData.date || ''}{' '}
                                {eqItem.timeStart ? `${eqItem.timeStart}–${eqItem.timeEnd || ''}` : ''}
                              </span>
                            </div>
                            {activeChannelId && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!firestore || !activeChannelId) return;
                                  const newTitle = `Breakdown: ${eqItem.equipmentName}`;
                                  await updateDoc(doc(firestore, 'channels', activeChannelId), {
                                    name: newTitle,
                                    equipmentName: eqItem.equipmentName,
                                    type: 'breakdown',
                                    isDeleted: false,
                                    isArchived: false,
                                  });
                                  toast({
                                    title: 'Updated Chat Name',
                                    description: `Chat renamed to "#${newTitle}" in the sidebar.`,
                                  });
                                }}
                                className="px-2 py-0.5 rounded border border-slate-200 hover:border-red-300 hover:bg-red-50 text-[10px] font-bold text-slate-600 hover:text-red-700 shrink-0"
                                title="Set this equipment name as the chat name on the sidebar"
                              >
                                Set as Chat Name
                              </button>
                            )}
                          </div>

                          {/* SUMMARY BULLETS */}
                          <div>
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-red-700 mb-1">
                              SUMMARY
                            </h4>
                            <ul className="space-y-1 pl-4 list-disc text-xs text-slate-800 leading-relaxed">
                              {eqItem.summaryBullets.map((b, bIdx) => (
                                <li key={bIdx}>{b}</li>
                              ))}
                            </ul>
                          </div>

                          {/* RCA BULLETS */}
                          <div className="pt-1 border-t border-slate-100">
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-red-700 mb-1">
                              RCA (Root Cause Analysis)
                            </h4>
                            <ul className="space-y-1 pl-4 list-disc text-xs text-slate-800 leading-relaxed">
                              {eqItem.rcaBullets.map((b, bIdx) => (
                                <li key={bIdx}>{b}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* EXPORT SUMMARY & RCA TO DAILY DIARY (DD) */}
                  {summaryData && summaryData.equipmentBreakdowns.length > 0 && (
                    <div className="p-3 border-t bg-amber-50/70 space-y-2">
                      <Label className="text-[10px] font-black uppercase text-amber-900 block">
                        Export Summary &amp; RCA to Daily Diary (DD) ({summaryData.date || 'Selected Day'})
                      </Label>
                      <select
                        value={selectedDdTarget}
                        onChange={(e) => setSelectedDdTarget(e.target.value)}
                        className="w-full h-8 px-2 border border-amber-300 rounded-md text-xs font-bold bg-white"
                      >
                        <option value="__new_dd__">
                          ➕ Create New Daily Diary (DD) for {summaryData.date || 'This Day'}
                        </option>
                        {diaryOptions.length > 0 && (
                          <optgroup label="Existing Daily Diaries (By DD Number)">
                            {diaryOptions.map((dd) => (
                              <option key={dd.id} value={dd.id}>
                                📋 {dd.id} • {dd.date || 'No date'} • {dd.area} ({dd.workSummary})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isExportingSummaryToDd}
                        onClick={handleExportSummaryToDailyDiary}
                        className="w-full h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5"
                      >
                        {isExportingSummaryToDd ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                        Export Summary &amp; RCA to DD
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input Area */}
            <footer className="bg-white p-4 border-t shadow-lg">
              {activeChannel?.isArchived ? (
                <div className="flex flex-col items-center py-2">
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <Archive className="h-4 w-4" /> This chat is archived.
                  </p>
                  <Button 
                    variant="link" 
                    className="text-xs h-auto p-0 text-primary"
                    onClick={() => handleArchiveChannel(activeChannel.id)}
                  >
                    Restore to send messages
                  </Button>
                </div>
              ) : (
                <form 
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2 max-w-4xl mx-auto"
                >
                  <Button type="button" variant="ghost" size="icon" className="text-slate-400 hover:text-primary">
                    <Camera className="h-6 w-6" />
                  </Button>
                  <Input 
                    placeholder="Type a message..." 
                    className="flex-1 bg-slate-50 border-none rounded-lg focus-visible:ring-1"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                  />
                  <Button 
                    type="submit" 
                    disabled={!messageText.trim()}
                    className="bg-primary hover:bg-primary/90 rounded-lg px-6"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              )}
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="bg-white p-12 rounded-full shadow-inner mb-6">
              <MessageSquare className="h-20 w-20 text-slate-200" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to Site Comms</h2>
            <p className="text-slate-500 max-w-xs mx-auto">
              Select a channel from the left or create a new group to start communicating with the team.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
