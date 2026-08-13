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
import type { VSD } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

export function EditVsdForm({ vsd }: { vsd: VSD }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [model, setModel] = useState(vsd.model || '');
  const [serial, setSerial] = useState(vsd.serialNumber || '');
  const [dsuLeft, setDsuLeft] = useState(vsd.dsuLeftSerialNumber || '');
  const [dsuRight, setDsuRight] = useState(vsd.dsuRightSerialNumber || '');
  const [invLeft, setInvLeft] = useState(vsd.inverterLeftSerialNumber || '');
  const [invRight, setInvRight] = useState(vsd.inverterRightSerialNumber || '');
  const [modL1, setModL1] = useState(vsd.moduleLeft1SerialNumber || '');
  const [modL2, setModL2] = useState(vsd.moduleLeft2SerialNumber || '');
  const [modL3, setModL3] = useState(vsd.moduleLeft3SerialNumber || '');
  const [modR1, setModR1] = useState(vsd.moduleRight1SerialNumber || '');
  const [modR2, setModR2] = useState(vsd.moduleRight2SerialNumber || '');
  const [modR3, setModR3] = useState(vsd.moduleRight3SerialNumber || '');
  const [capDate, setCapDate] = useState(vsd.capacitorChangeDate || '');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'vsds', vsd.id), {
        model,
        serialNumber: serial,
        dsuLeftSerialNumber: dsuLeft,
        dsuRightSerialNumber: dsuRight,
        inverterLeftSerialNumber: invLeft,
        inverterRightSerialNumber: invRight,
        moduleLeft1SerialNumber: modL1,
        moduleLeft2SerialNumber: modL2,
        moduleLeft3SerialNumber: modL3,
        moduleRight1SerialNumber: modR1,
        moduleRight2SerialNumber: modR2,
        moduleRight3SerialNumber: modR3,
        capacitorChangeDate: capDate,
      });
      toast({ title: "Updated", description: "VSD details have been saved." });
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
        <DialogHeader><DialogTitle>Edit VSD Details</DialogTitle></DialogHeader>
        <ScrollArea className="flex-grow">
          <div className="grid gap-4 py-4 pr-4">
            <div className="grid gap-2">
              <Label>Model</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Serial Number</Label>
              <Input value={serial} onChange={e => setSerial(e.target.value)} />
            </div>
            
            {(model.includes('800') || model.includes('880')) && (
              <>
                <div className="grid gap-2">
                  <Label>DSU Left Serial Number</Label>
                  <Input value={dsuLeft} onChange={e => setDsuLeft(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>DSU Right Serial Number</Label>
                  <Input value={dsuRight} onChange={e => setDsuRight(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Inverter Left Serial Number</Label>
                  <Input value={invLeft} onChange={e => setInvLeft(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Inverter Right Serial Number</Label>
                  <Input value={invRight} onChange={e => setInvRight(e.target.value)} />
                </div>
              </>
            )}

            {model.includes('600') && (
              <>
                <div className="grid gap-2">
                  <Label>Capacitor Change Date</Label>
                  <Input type="date" value={capDate} onChange={e => setCapDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Module Left 1 Serial</Label>
                    <Input value={modL1} onChange={e => setModL1(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Module Right 1 Serial</Label>
                    <Input value={modR1} onChange={e => setModR1(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Module Left 2 Serial</Label>
                    <Input value={modL2} onChange={e => setModL2(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Module Right 2 Serial</Label>
                    <Input value={modR2} onChange={e => setModR2(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Module Left 3 Serial</Label>
                    <Input value={modL3} onChange={e => setModL3(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Module Right 3 Serial</Label>
                    <Input value={modR3} onChange={e => setModR3(e.target.value)} />
                  </div>
                </div>
              </>
            )}
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
