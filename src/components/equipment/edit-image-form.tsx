'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Loader2, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Equipment } from '@/lib/types';

export function EditImageForm({ equipment }: { equipment: Equipment }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [url, setUrl] = useState(equipment.imageUrl || '');
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'equipment', equipment.id), { imageUrl: url });
      toast({ title: "Updated" });
      setIsOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Image URL</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4"><div className="grid gap-2"><Label>Image URL</Label><Input value={url} onChange={e => setUrl(e.target.value)} /></div></div>
        <DialogFooter><Button onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
