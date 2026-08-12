'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Loader2, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Equipment } from '@/lib/types';

export function EditGeneralInfoForm({ equipment }: { equipment: Equipment }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [name, setName] = useState(equipment.name);
  const [location, setLocation] = useState(equipment.location);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: any = {
        name,
        location,
      };

      // Auto-update the MCC field if the location changes, so it appears in the correct plant's list
      if (location !== equipment.location && equipment.mcc && equipment.location) {
        updates.mcc = equipment.mcc.replace(equipment.location, location);
      }

      await updateDoc(doc(firestore, 'equipment', equipment.id), updates);
      toast({ title: "Updated", description: "General information has been saved." });
      setIsOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit General Info</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Equipment Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Location</Label>
            {equipment.plant === 'Mining' ? (
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MPA">MPA</SelectItem>
                  <SelectItem value="MPC">MPC</SelectItem>
                  <SelectItem value="MPD">MPD</SelectItem>
                  <SelectItem value="MPE">MPE</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input value={location} onChange={e => setLocation(e.target.value)} />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
