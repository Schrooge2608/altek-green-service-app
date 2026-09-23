'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { LibraryDocument } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, BookOpen, Download, FileText, FileImage, Bot, Send, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { UploadDocumentDialog } from '@/components/library/upload-document-dialog';
import { useChat } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';

const DocumentList = ({ docs, emptyMsg }: { docs: LibraryDocument[], emptyMsg: string }) => (
  <div className="space-y-4">
    {docs.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
        {emptyMsg}
      </div>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map(doc => (
          <Card key={doc.id} className="overflow-hidden">
            <div className="p-4 flex items-start gap-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                {doc.type === 'Drawing' ? <FileImage className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate" title={doc.title}>{doc.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 truncate">{doc.fileName}</p>
                <p className="text-xs text-muted-foreground mt-1">By {doc.uploadedBy}</p>
              </div>
            </div>
            <div className="bg-muted/50 p-2 flex justify-end border-t">
              <Button variant="ghost" size="sm" className="gap-2 text-xs" asChild>
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-3 w-3" /> View / Download
                </a>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    )}
  </div>
);

export default function CategoryDetailsPage() {
  const pathname = usePathname();
  const slug = pathname.split('/').pop() || '';
  const categoryName = decodeURIComponent(slug).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const { firestore } = useFirebase();

  // Chat Setup
  const { messages, input, handleInputChange, handleSubmit, isLoading: chatLoading } = useChat({
    api: '/api/chat',
    body: { category: categoryName }
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!firestore || !slug) return;
    
    const q = query(
      collection(firestore, 'library_documents'),
      where('category', '==', slug)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LibraryDocument));
      // Manual sort since we might not have a composite index created yet
      docs.sort((a, b) => (b.uploadedAt?.toMillis() || 0) - (a.uploadedAt?.toMillis() || 0));
      setDocuments(docs);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching documents:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, slug]);

  const procedures = documents.filter(d => d.type === 'Procedure');
  const drawings = documents.filter(d => d.type === 'Drawing');

  // Document list moved outside

  return (
    <div className="flex flex-col gap-8 h-full max-h-screen">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
            <Link href="/library/data-sheets" className="hover:text-primary transition-colors">
              <ArrowLeft className="h-4 w-4 inline mr-1" /> Back to Categories
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{categoryName}</h1>
          <p className="text-muted-foreground">
            Technical documents, drawings, and AI troubleshooting for {categoryName}.
          </p>
        </div>
        <UploadDocumentDialog categorySlug={slug} categoryName={categoryName} />
      </header>

      <Tabs defaultValue="ai" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="ai" className="gap-2"><Bot className="h-4 w-4" /> AI Assistant</TabsTrigger>
          <TabsTrigger value="docs" className="gap-2"><BookOpen className="h-4 w-4" /> Document Library</TabsTrigger>
        </TabsList>
        
        {/* AI Assistant Tab */}
        <TabsContent value="ai" className="flex-1 flex flex-col min-h-0 mt-4 border rounded-xl overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                  <Bot className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">I'm your AI Troubleshooting Assistant</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
                    Ask me anything about {categoryName}. I can help you troubleshoot fault codes, find maintenance procedures, and diagnose issues.
                  </p>
                </div>
              </div>
            )}
            
            {messages.map((m: any) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-snug prose-pre:bg-black/10 prose-pre:text-foreground whitespace-pre-wrap">
                      {m.content}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            
            {chatLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t bg-muted/10">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input 
                value={input} 
                onChange={handleInputChange} 
                placeholder={`Ask a question about ${categoryName}...`} 
                className="flex-1"
                disabled={chatLoading}
              />
              <Button type="submit" disabled={chatLoading || !input.trim()}>
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* Document Library Tab */}
        <TabsContent value="docs" className="flex-1 overflow-y-auto mt-4 space-y-8 pr-2">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div>
                <h3 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Procedures & Manuals
                </h3>
                <DocumentList docs={procedures} emptyMsg="No procedures or manuals have been uploaded yet." />
              </div>

              <div>
                <h3 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
                  <FileImage className="h-5 w-5 text-primary" /> Drawings & Schematics
                </h3>
                <DocumentList docs={drawings} emptyMsg="No drawings or schematics have been uploaded yet." />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
