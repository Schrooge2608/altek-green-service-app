'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import type { Message, User } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Send } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

function ComposeMessage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSending, setIsSending] = useState(false);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [recipients, setRecipients] = useState<string[]>([]);

    const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

    const userOptions = useMemo(() => {
        return users ? users.map(u => ({ label: u.name, value: u.id })) : [];
    }, [users]);
    
    const handleSend = async () => {
        if (!user || !user.displayName) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to send messages.' });
            return;
        }
        if (recipients.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select at least one recipient.' });
            return;
        }
        if (!subject.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Subject cannot be empty.' });
            return;
        }

        setIsSending(true);
        const messagesRef = collection(firestore, 'messages');
        const newMessage: Omit<Message, 'id'> = {
            senderId: user.uid,
            senderName: user.displayName,
            recipientIds: recipients,
            subject,
            body,
            timestamp: new Date().toISOString(),
            readBy: [],
        };

        await addDocumentNonBlocking(messagesRef, newMessage);
        
        toast({ title: 'Message Sent', description: 'Your message has been successfully sent.' });
        setSubject('');
        setBody('');
        setRecipients([]);
        setIsSending(false);
    };

    const handleRecipientChange = (value: string) => {
        setRecipients(prev => {
            if (prev.includes(value)) {
                return prev.filter(r => r !== value);
            } else {
                return [...prev, value];
            }
        });
    };

    return (
        <CardContent>
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium">To:</label>
                    <div className="flex flex-wrap gap-2 items-center mt-2 p-2 border rounded-md">
                         {recipients.map(rId => {
                            const recipientUser = users?.find(u => u.id === rId);
                            return (
                                <Badge key={rId} variant="secondary" className="flex items-center gap-2">
                                    {recipientUser?.name || rId}
                                    <button onClick={() => handleRecipientChange(rId)} className="font-bold">&times;</button>
                                </Badge>
                            );
                        })}
                        <Combobox 
                            options={userOptions}
                            value={''}
                            onChange={handleRecipientChange}
                            placeholder="Add recipients..."
                            searchPlaceholder="Search users..."
                            noResultsMessage="No users found."
                        />
                    </div>
                </div>
                <Input
                    placeholder="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                />
                <Textarea
                    placeholder="Type your message here..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                />
                <Button onClick={handleSend} disabled={isSending}>
                    {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send Message
                </Button>
            </div>
        </CardContent>
    );
}


function MessageList({ boxType }: { boxType: 'inbox' | 'sent' }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

    const messagesQuery = useMemoFirebase(() => {
        if (!user) return null;
        const q = boxType === 'inbox'
            ? query(collection(firestore, 'messages'), where('recipientIds', 'array-contains', user.uid), orderBy('timestamp', 'desc'))
            : query(collection(firestore, 'messages'), where('senderId', '==', user.uid), orderBy('timestamp', 'desc'));
        return q;
    }, [firestore, user, boxType]);

    const { data: messages, isLoading } = useCollection<Message>(messagesQuery);
    
    const handleSelectMessage = (message: Message) => {
        setSelectedMessage(message);
        // Mark as read if it's in the inbox and not already read
        if (boxType === 'inbox' && user && !message.readBy.includes(user.uid)) {
            const messageRef = doc(firestore, 'messages', message.id);
            const updatedReadBy = [...message.readBy, user.uid];
            updateDoc(messageRef, { readBy: updatedReadBy });
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>{boxType === 'inbox' ? 'Inbox' : 'Sent Items'}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[60vh]">
                            {isLoading && <div className="p-4 text-center">Loading messages...</div>}
                            {!isLoading && (!messages || messages.length === 0) && (
                                <div className="p-4 text-center text-muted-foreground">No messages found.</div>
                            )}
                            <div className="flex flex-col">
                                {messages?.map((msg) => {
                                    const isUnread = boxType === 'inbox' && user && !msg.readBy.includes(user.uid);
                                    return (
                                        <button
                                            key={msg.id}
                                            onClick={() => handleSelectMessage(msg)}
                                            className={cn(
                                                'text-left p-4 border-b hover:bg-muted/50',
                                                selectedMessage?.id === msg.id && 'bg-muted',
                                                isUnread && 'font-bold'
                                            )}
                                        >
                                            <div className="flex justify-between items-start">
                                                <p className="truncate">{boxType === 'inbox' ? msg.senderName : `To: ${msg.recipientIds.join(', ')}`}</p>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatDistanceToNow(parseISO(msg.timestamp), { addSuffix: true })}
                                                </span>
                                            </div>
                                            <p className={cn("truncate", !isUnread && 'text-muted-foreground')}>{msg.subject}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-2">
                <Card className="h-full">
                    <CardContent className="p-6 h-full">
                        {selectedMessage ? (
                            <div className="flex flex-col h-full">
                                <h2 className="text-2xl font-semibold">{selectedMessage.subject}</h2>
                                <div className="text-sm text-muted-foreground mt-2 border-b pb-4 mb-4">
                                    <p><strong>From:</strong> {selectedMessage.senderName}</p>
                                    <p><strong>To:</strong> {selectedMessage.recipientIds.join(', ')}</p>
                                    <p><strong>Date:</strong> {new Date(selectedMessage.timestamp).toLocaleString()}</p>
                                </div>
                                <ScrollArea className="flex-grow">
                                    <p className="whitespace-pre-wrap">{selectedMessage.body}</p>
                                </ScrollArea>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Select a message to read it.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function MessagesPage() {
    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
                <p className="text-muted-foreground">
                    Communicate with other users in the system.
                </p>
            </header>
            <Tabs defaultValue="inbox" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="inbox">Inbox</TabsTrigger>
                    <TabsTrigger value="sent">Sent</TabsTrigger>
                    <TabsTrigger value="compose">Compose</TabsTrigger>
                </TabsList>
                <TabsContent value="inbox">
                    <MessageList boxType="inbox" />
                </TabsContent>
                <TabsContent value="sent">
                    <MessageList boxType="sent" />
                </TabsContent>
                <TabsContent value="compose">
                    <Card>
                        <CardHeader>
                            <CardTitle>New Message</CardTitle>
                        </CardHeader>
                        <ComposeMessage />
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
