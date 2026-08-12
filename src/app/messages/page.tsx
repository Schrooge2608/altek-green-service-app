
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
  FileText
} from 'lucide-react';
import { 
  useUser, 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking 
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
  getDoc
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
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function MessagingPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const urlChannelId = searchParams.get('channelId');
  
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearcherTerm] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. FETCH CHANNELS
  const channelsQuery = useMemoFirebase(
    () => query(collection(firestore, 'channels'), orderBy('lastMessageTime', 'desc')),
    [firestore]
  );
  const { data: channels, isLoading: channelsLoading } = useCollection<Channel>(channelsQuery);

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

  // Deep Link Selection
  useEffect(() => {
    if (urlChannelId && !activeChannelId) {
      setActiveChannelId(urlChannelId);
    }
  }, [urlChannelId, activeChannelId]);

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

  /**
   * SIDEBAR FILTER FIX
   * Filters based on isArchived status matching the toggle.
   */
  const filteredChannels = channels?.filter(c => {
    const isArchived = c.isArchived || false;
    return isArchived === showArchived && c.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* --- SIDEBAR: CHANNEL LIST --- */}
      <div className="w-[350px] border-r bg-white flex flex-col shadow-sm">
        <header className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="text-primary h-5 w-5" /> Site Comms
            </h1>
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
                      {channel.lastMessageTime ? format(channel.lastMessageTime.toDate(), 'HH:mm') : ''}
                    </span>
                  </div>
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
                {activeChannel?.type === 'breakdown' && activeChannel?.relatedId && (
                  <Link href={`/breakdowns/${activeChannel.relatedId}`}>
                    <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 flex items-center gap-2 mr-2">
                      <FileText className="h-4 w-4" />
                      View Breakdown Log
                    </Button>
                  </Link>
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
                <Button variant="ghost" size="icon" className="text-slate-400"><MoreVertical className="h-5 w-5" /></Button>
              </div>
            </header>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4 md:p-8" ref={scrollRef}>
              <div className="space-y-4 max-w-4xl mx-auto">
                {messagesLoading ? (
                  <div className="flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : messages?.map((msg, idx) => {
                  const isMe = msg.senderId === user?.uid;
                  return (
                    <div 
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[80%] md:max-w-[70%]",
                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      {!isMe && (
                        <span className="text-[10px] font-bold text-primary mb-1 ml-2 uppercase tracking-wide">
                          {msg.senderName}
                        </span>
                      )}
                      <div 
                        className={cn(
                          "px-4 py-2 rounded-2xl shadow-sm relative group",
                          isMe 
                            ? "bg-primary text-white rounded-tr-none" 
                            : "bg-white text-slate-800 rounded-tl-none border"
                        )}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <div className={cn(
                          "flex items-center gap-1 mt-1 justify-end",
                          isMe ? "text-blue-100" : "text-slate-400"
                        )}>
                          <span className="text-[9px] font-medium">
                            {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm') : '...'}
                          </span>
                          {isMe && <CheckCheck className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

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
