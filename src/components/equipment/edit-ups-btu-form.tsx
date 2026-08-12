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
import { ScrollArea } from '@/components/ui/scroll-area';

export function EditUpsBtuForm({ equipment }: { equipment: Equipment }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [upsType, setUpsType] = useState<string>(equipment.upsType || 'UPS');
  const [upsBrand, setUpsBrand] = useState(equipment.upsBrand || '');
  const [batteryType, setBatteryType] = useState(equipment.batteryType || '');
  const [batteryQuantity, setBatteryQuantity] = useState(equipment.batteryQuantity?.toString() || '');
  const [batteryExpiryDate, setBatteryExpiryDate] = useState(equipment.batteryExpiryDate || '');
  const [lastBatteryReplacement, setLastBatteryReplacement] = useState(equipment.lastBatteryReplacement || '');
  const [upsSerialNumber, setUpsSerialNumber] = useState(equipment.upsSerialNumber || '');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'equipment', equipment.id), {
        upsType,
        upsBrand,
        batteryType,
        batteryQuantity: batteryQuantity ? parseInt(batteryQuantity, 10) : null,
        batteryExpiryDate,
        lastBatteryReplacement,
        upsSerialNumber,
      });
      toast({ title: "Updated", description: "UPS/BTU details have been saved." });
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
      <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Edit UPS/BTU Details</DialogTitle></DialogHeader>
        <ScrollArea className="flex-grow">
          <div className="grid gap-4 py-4 pr-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={upsType} onValueChange={setUpsType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="BTU">BTU</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label>Brand</Label>
              <Input value={upsBrand} onChange={e => setUpsBrand(e.target.value)} placeholder="e.g. APC, Mecer, etc." />
            </div>

            <div className="grid gap-2">
              <Label>Battery Type</Label>
              <Input value={batteryType} onChange={e => setBatteryType(e.target.value)} placeholder="e.g. Lead Acid" />
            </div>

            <div className="grid gap-2">
              <Label>Battery Quantity</Label>
              <Input type="number" value={batteryQuantity} onChange={e => setBatteryQuantity(e.target.value)} placeholder="0" />
            </div>

            <div className="grid gap-2">
              <Label>Date of Expiry (Battery)</Label>
              <Input type="date" value={batteryExpiryDate} onChange={e => setBatteryExpiryDate(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Date Replaced (Battery)</Label>
              <Input type="date" value={lastBatteryReplacement} onChange={e => setLastBatteryReplacement(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Serial Number</Label>
              <Input value={upsSerialNumber} onChange={e => setUpsSerialNumber(e.target.value)} />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="mt-4">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
