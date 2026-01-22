
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import { Printer, AlertTriangle, CalendarIcon, Plus, Trash2, Save, Loader2, Paperclip } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import React, { useState, useMemo } from 'react';
import { Input } from '../ui/input';
import { useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import type { Equipment, User, ScheduledTask, MaintenanceTask, WorkCrewMember, ChecklistItem } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { ImageUploader } from '../image-uploader';


const monthlyChecklistItems = [
    { task: 'Filter Inspection', action: 'If your VSD cabinet has air filters, check for clogs. A clogged filter is the #1 cause of over-temperature trips.' },
    { task: 'Cleaning', action: 'Use a vacuum (not compressed air, which can push conductive dust deeper into circuits) to remove dust from the heat sink fins.' },
    { task: 'Check Connections', action: 'Visually inspect power and control wiring for any signs of discoloration or pitting, which indicates loose connections causing heat.' },
    { task: 'Fan Operation', action: 'Verify that the internal cooling fans are moving air effectively and aren\'t wobbling.' },
];

const annualChecklistItems = [
    { component: 'Terminal Torque', action: 'Retighten all power connections to spec.', reason: 'Vibrations over time loosen screws, leading to arcing.' },
    { component: 'Capacitor Check', action: 'Look for bulging or leaking electrolyte.', reason: 'DC bus capacitors have a finite life (usually 5–10 years).' },
    { component: 'Voltage Balance', action: 'Measure input voltage phase-to-phase.', reason: 'Imbalance > 2% can cause significant internal heating.' },
    { component: 'Insulation Test', action: 'Perform a Megger test on the motor cables.', reason: 'Ensures the cable insulation hasn\'t degraded due to harmonics.' },
    { component: 'Software/Firmware', action: 'Check for manufacturer updates.', reason: 'Updates often include better motor control algorithms or bug fixes.' },
];

function WorkCrewRow({ member, onRemove, onChange, users, usersLoading }: { member: Partial<WorkCrewMember> & { localId: number }, onRemove: () => void, onChange: (field: keyof WorkCrewMember, value: string) => void, users: User[] | null, usersLoading: boolean }) {
    return (
        <TableRow>
            <TableCell>
                <Select
                    disabled={usersLoading}
                    value={users?.find(u => u.name === member.name)?.id}
                    onValueChange={(userId) => {
                        const user = users?.find(u => u.id === userId);
                        onChange('name', user?.name || '');
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select crew member..." />
                    </SelectTrigger>
                    <SelectContent>
                    {usersLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                        users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)
                    )}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell><Input placeholder="RTBS No..." value={member.rtbsNo || ''} onChange={(e) => onChange('rtbsNo', e.target.value)}/></TableCell>
            <TableCell className="w-[180px]">
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !member.date && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {member.date ? format(new Date(member.date), "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                        mode="single"
                        selected={member.date ? new Date(member.date) : undefined}
                        onSelect={(date) => onChange('date', date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </TableCell>
            <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={onRemove} className="print:hidden">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </TableCell>
        </TableRow>
    )
}

const isImageUrl = (url: string) => /\.(jpeg|jpg|gif|png|webp)$/i.test(url);

export function VsdMonthlyScopeDocument({ schedule }: { schedule?: ScheduledTask }) {
  const title = "VSDs Monthly & Annual Service Scope";
  const [selectedEquipment, setSelectedEquipment] = React.useState<string | undefined>(schedule?.equipmentId);
  const [inspectionDate, setInspectionDate] = React.useState<Date | undefined>(schedule ? new Date(schedule.scheduledFor) : undefined);
  const [isSaving, setIsSaving] = React.useState(false);
  const { firestore, firebaseApp } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [take5Files, setTake5Files] = useState<File[]>([]);
  const [cccFiles, setCccFiles] = useState<File[]>([]);
  const [jhaFiles, setJhaFiles] = useState<File[]>([]);
  const [ptwFiles, setPtwFiles] = useState<File[]>([]);
  const [workOrderFiles, setWorkOrderFiles] = useState<File[]>([]);

  const [crew, setCrew] = React.useState<(Partial<WorkCrewMember> & { localId: number })[]>(() =>
    (schedule?.workCrew && schedule.workCrew.length > 0)
    ? schedule.workCrew.map((m, i) => ({ ...m, localId: i }))
    : [{ localId: Date.now(), name: '', rtbsNo: '', date: '', signature: '' }]
  );

  const initialChecklist = React.useMemo(() => [
      ...monthlyChecklistItems.map(item => ({ task: item.task, status: 'not-checked' as const, comments: '' })),
      ...annualChecklistItems.map(item => ({ task: item.component, status: 'not-checked' as const, comments: '' })),
  ], []);

  const [checklist, setChecklist] = React.useState<ChecklistItem[]>(() => {
      if (schedule?.checklist && schedule.checklist.length > 0) {
          return schedule.checklist;
      }
      return initialChecklist;
  });

  const handleChecklistChange = (index: number, field: keyof ChecklistItem, value: string) => {
      const newChecklist = [...checklist];
      (newChecklist[index] as any)[field] = value;
      setChecklist(newChecklist);
  };

  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

  const usersQuery = useMemoFirebase(() => (user ? collection(firestore, 'users') : null), [firestore, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const currentUserData = useMemo(() => {
    if (!user || !users) return null;
    return users.find(u => u.id === user.uid);
  }, [user, users]);

  const addCrewMember = () => {
    setCrew(c => [...c, { localId: Date.now() }]);
  };

  const removeCrewMember = (localId: number) => {
    setCrew(c => c.filter(member => member.localId !== localId));
  };
  
  const handleCrewChange = (index: number, field: keyof WorkCrewMember, value: string) => {
    const newCrew = [...crew];
    (newCrew[index] as any)[field] = value;
    setCrew(newCrew);
  };

  const handleDeleteScan = async (fileUrl: string, docType: 'take5Scans' | 'cccScans' | 'jhaScans' | 'ptwScans' | 'workOrderScans') => {
      if (!schedule || !firebaseApp) {
          toast({ variant: "destructive", title: "Error", description: "Cannot delete file." });
          return;
      }
      setIsSaving(true);
      try {
          const storage = getStorage(firebaseApp);
          const fileRef = ref(storage, fileUrl);
          await deleteObject(fileRef);
          const scheduleRef = doc(firestore, 'upcoming_schedules', schedule.id);
          const updatedScans = (schedule[docType] || []).filter(url => url !== fileUrl);
          await updateDoc(scheduleRef, { [docType]: updatedScans });
          toast({ title: "File Deleted", description: "The selected document has been removed." });
          router.refresh();
      } catch (error: any) {
          console.error("Error deleting file:", error);
          toast({
              variant: "destructive",
              title: "Deletion Failed",
              description: error.code === 'storage/object-not-found' 
                  ? "File not found. Removing from record."
                  : error.message || "An unexpected error occurred.",
          });
          if(error.code === 'storage/object-not-found'){
              const scheduleRef = doc(firestore, 'upcoming_schedules', schedule.id);
              const updatedScans = (schedule[docType] || []).filter(url => url !== fileUrl);
              await updateDoc(scheduleRef, { [docType]: updatedScans });
              router.refresh();
          }
      } finally {
          setIsSaving(false);
      }
  };


  const handleSaveToUpcoming = async () => {
    if (!selectedEquipment || !inspectionDate || !currentUserData || !user) {
        toast({
            variant: 'destructive',
            title: 'Missing Information',
            description: 'Please select an equipment and date before saving. You must be logged in.'
        });
        return;
    }
    setIsSaving(true);

    const equipmentData = equipment?.find(e => e.id === selectedEquipment);

    if (!equipmentData) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not find selected equipment.' });
        setIsSaving(false);
        return;
    }

    const newScheduledTask: Omit<ScheduledTask, 'id' | 'updatedAt'> = {
        originalTaskId: `${equipmentData.id}-vsd-monthly`,
        equipmentId: equipmentData.id,
        equipmentName: equipmentData.name,
        task: 'VSD Monthly Service',
        scheduledFor: format(inspectionDate, 'yyyy-MM-dd'),
        status: 'Pending',
        assignedToId: user.uid,
        assignedToName: currentUserData.name,
        completionNotes: '',
        component: 'VSD',
        frequency: 'Monthly',
        workCrew: [],
        checklist: initialChecklist,
    };

    try {
        const schedulesRef = collection(firestore, 'upcoming_schedules');
        const docRef = await addDocumentNonBlocking(schedulesRef, newScheduledTask);
        await setDoc(doc(schedulesRef, docRef.id), { id: docRef.id }, { merge: true });

        const scheduleId = docRef.id;
        const uploadScans = async (files: File[], docType: 'take5' | 'ccc' | 'jha' | 'ptw' | 'work_order'): Promise<string[]> => {
            if (!firebaseApp || files.length === 0) return [];
            const storage = getStorage(firebaseApp);
            const uploadPromises = files.map(async file => {
                const storagePath = `scheduled_tasks/${scheduleId}/${docType}_scans/${file.name}_${Date.now()}`;
                const storageRef = ref(storage, storagePath);
                const snapshot = await uploadBytes(storageRef, file);
                return getDownloadURL(snapshot.ref);
            });
            return Promise.all(uploadPromises);
        };

        const [newTake5Urls, newCccUrls, newJhaUrls, newPtwUrls, newWorkOrderUrls] = await Promise.all([
            uploadScans(take5Files, 'take5'),
            uploadScans(cccFiles, 'ccc'),
            uploadScans(jhaFiles, 'jha'),
            uploadScans(ptwFiles, 'ptw'),
            uploadScans(workOrderFiles, 'work_order'),
        ]);

        if (newTake5Urls.length > 0 || newCccUrls.length > 0 || newJhaUrls.length > 0 || newPtwUrls.length > 0 || newWorkOrderUrls.length > 0) {
            await updateDoc(docRef, { 
                take5Scans: newTake5Urls,
                cccScans: newCccUrls,
                jhaScans: newJhaUrls,
                ptwScans: newPtwUrls,
                workOrderScans: newWorkOrderUrls,
            });
        }
        
        toast({
            title: 'Schedule Saved',
            description: 'The task has been added to the upcoming schedules list.'
        });
        router.push('/maintenance/upcoming-schedules');
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'Could not save the schedule.' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleSaveProgress = async () => {
      if (!schedule || !firebaseApp) {
          toast({ variant: 'destructive', title: 'Error', description: 'Cannot save progress without a schedule context or Firebase App instance.' });
          return;
      }

      setIsSaving(true);
      
      const uploadScans = async (files: File[], docType: 'take5' | 'ccc' | 'jha' | 'ptw' | 'work_order'): Promise<string[]> => {
            if (!files.length) return [];
            const storage = getStorage(firebaseApp);
            const uploadPromises = files.map(async file => {
                const storagePath = `scheduled_tasks/${schedule.id}/${docType}_scans/${file.name}_${Date.now()}`;
                const storageRef = ref(storage, storagePath);
                const snapshot = await uploadBytes(storageRef, file);
                return getDownloadURL(snapshot.ref);
            });
            return Promise.all(uploadPromises);
        };

      try {
          const [newTake5Urls, newCccUrls, newJhaUrls, newPtwUrls, newWorkOrderUrls] = await Promise.all([
              uploadScans(take5Files, 'take5'),
              uploadScans(cccFiles, 'ccc'),
              uploadScans(jhaFiles, 'jha'),
              uploadScans(ptwFiles, 'ptw'),
              uploadScans(workOrderFiles, 'work_order'),
          ]);
          
          const scheduleRef = doc(firestore, 'upcoming_schedules', schedule.id);
          const crewToSave = crew.map(({ localId, ...rest }) => rest);

          const updateData: Partial<ScheduledTask> = {
              workCrew: crewToSave,
              checklist,
          };
          
          if (newTake5Urls.length > 0) updateData.take5Scans = [...(schedule.take5Scans || []), ...newTake5Urls];
          if (newCccUrls.length > 0) updateData.cccScans = [...(schedule.cccScans || []), ...newCccUrls];
          if (newJhaUrls.length > 0) updateData.jhaScans = [...(schedule.jhaScans || []), ...newJhaUrls];
          if (newPtwUrls.length > 0) updateData.ptwScans = [...(schedule.ptwScans || []), ...newPtwUrls];
          if (newWorkOrderUrls.length > 0) updateData.workOrderScans = [...(schedule.workOrderScans || []), ...newWorkOrderUrls];

          updateData.updatedAt = new Date().toISOString(); 
          await updateDoc(scheduleRef, updateData);

          toast({ title: 'Progress Saved', description: 'Your changes have been saved successfully.' });
          
          if (newTake5Urls.length > 0) setTake5Files([]);
          if (newCccUrls.length > 0) setCccFiles([]);
          if (newJhaUrls.length > 0) setJhaFiles([]);
          if (newPtwUrls.length > 0) setPtwFiles([]);
          if (newWorkOrderUrls.length > 0) setWorkOrderFiles([]);
          
          router.refresh();
      } catch (error: any) {
          console.error("Error saving progress:", error);
          toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
      } finally {
          setIsSaving(false);
      }
  };

  const isEditMode = !!schedule;
  const docPrefix = "MS";

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background">
      <div className="flex justify-end mb-4 gap-2 print:hidden">
        {isEditMode ? (
            <Button onClick={handleSaveProgress} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Progress
            </Button>
        ) : (
             <Button variant="outline" onClick={handleSaveToUpcoming} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save to Upcoming Schedule List'}
            </Button>
        )}
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      <Card className="p-8 shadow-lg border-2 border-primary/20 bg-card">
        <header className="flex items-start justify-between mb-8">
          <div>
            <AltekLogo className="h-12 w-auto" unoptimized />
            <p className="text-muted-foreground mt-2">VSD & Equipment Services</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-primary">{title}</h2>
            <p className="text-muted-foreground">Service Document</p>
            {isEditMode && <p className="text-xs text-muted-foreground font-mono mt-1">Doc #: AG-RBM-{docPrefix}-{schedule.id.slice(-6).toUpperCase()}</p>}
          </div>
        </header>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Equipment Selection</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
                <Label htmlFor="equipment-select">Select Equipment for Inspection</Label>
                <Select onValueChange={setSelectedEquipment} value={selectedEquipment} disabled={equipmentLoading || isEditMode}>
                    <SelectTrigger id="equipment-select">
                        <SelectValue placeholder="Select the equipment..." />
                    </SelectTrigger>
                    <SelectContent>
                    {equipmentLoading ? (
                        <SelectItem value="loading" disabled>Loading equipment...</SelectItem>
                    ) : (
                        equipment?.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.id})</SelectItem>)
                    )}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="area">Area</Label>
                <Input id="area" placeholder="e.g., MPA Pump Station" />
            </div>
            <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !inspectionDate && "text-muted-foreground"
                        )}
                        disabled={isEditMode}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {inspectionDate ? format(inspectionDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                        mode="single"
                        selected={inspectionDate}
                        onSelect={setInspectionDate}
                        initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-2">
                <Label htmlFor="inspected-by">Inspected By</Label>
                 <Input id="inspected-by" value={currentUserData?.name || (isEditMode ? schedule.assignedToName : 'Loading...')} disabled />
            </div>
          </CardContent>
        </Card>

        <div className="prose prose-sm max-w-none dark:prose-invert mt-8 space-y-6">
            <div>
                <h3 className="text-lg font-bold">1. PURPOSE</h3>
                <p>Mandatory inspections and services are needed to be carried out in order to identify, report and repair any unsafe conditions as well as to ensure reliable operation of electrical equipment.</p>
            </div>
            <div>
                <h3 className="text-lg font-bold">2. DOCUMENTATION REQUIRED</h3>
                <ul className="list-disc pl-5">
                    <li>Approved Risk Assessment (JHA)</li>
                    <li>RBM Take 5 Assessment Sheet</li>
                    <li>Critical Control Checklists (CCC) as identified by Risk Assessment</li>
                </ul>
            </div>
             <div>
                <h3 className="text-lg font-bold">3. JOB SPECIFIC SAFETY INFORMATION</h3>
                <ul className="list-disc pl-5">
                    <li>Complete Take 5 and CCC’s.</li>
                    <li>Obtain permit to work.</li>
                    <li>Isolate units as per RBM isolation procedure.</li>
                    <li>Carry out service/inspection/test as per Quality Control Sheet below.</li>
                    <li>Cancel work permit after work completion.</li>
                </ul>
            </div>
        </div>

        <Alert variant="destructive" className="my-8">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Safety Warning</AlertTitle>
            <AlertDescription>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Always make sure you identify any control voltages that might be present inside the VSD panel.</li>
                    <li>A lethally dangerous voltage is present in the VSD even after isolation. Ensure that the VSD is safe to work on by applying the “test before touch” principle. The capacitors might need time to completely discharge to zero potential.</li>
                    <li>Live voltages in VSD’s once switched on pose a flash over risk. Arc rated PPE (Minimum Cat 2) and only insulated tools must be used.</li>
                    <li>During the cleaning process excessive dust, pose a risk. To mitigate in cases of excessive dust, wear a dust mask.</li>
                    <li>During the cleaning process when making use of an electrical blower loose flying objects, pose a risk. Use correct safety glasses/goggles to mitigate against eye injury.</li>
                    <li>Do not brush or blow dust into protection relays, control equipment or switchgear mechanisms.</li>
                </ul>
            </AlertDescription>
        </Alert>

        <Card className="my-8">
            <CardHeader>
                <CardTitle>Safety Documentation</CardTitle>
                <CardDescription>Upload scans of the completed safety documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h4 className="font-semibold text-muted-foreground mb-2">Take 5 Assessment Scan(s)</h4>
                    {schedule?.take5Scans && schedule.take5Scans.length > 0 && (
                        <div className="mb-4 space-y-2">
                            <Label>Uploaded Documents</Label>
                            <div className="flex flex-col gap-2 rounded-md border p-2">
                                {schedule.take5Scans.map((url, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                                            {isImageUrl(url) ? (
                                                <img src={url} alt={`Take 5 Scan ${i + 1}`} className="w-10 h-10 rounded-md object-cover" />
                                            ) : (
                                                <Paperclip className="h-4 w-4 shrink-0" />
                                            )}
                                            <span className="text-sm text-primary group-hover:underline truncate">Take 5 Scan {i + 1}</span>
                                        </a>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDeleteScan(url, 'take5Scans')}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <ImageUploader onImagesChange={setTake5Files} title="Take 5 Documents" />
                </div>
                <Separator />
                <div>
                    <h4 className="font-semibold text-muted-foreground mb-2">Critical Control Checklist (CCC) Scan(s)</h4>
                      {schedule?.cccScans && schedule.cccScans.length > 0 && (
                        <div className="mb-4 space-y-2">
                            <Label>Uploaded Documents</Label>
                            <div className="flex flex-col gap-2 rounded-md border p-2">
                                {schedule.cccScans.map((url, i) => (
                                     <div key={i} className="flex items-center justify-between">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                                            {isImageUrl(url) ? (
                                                <img src={url} alt={`CCC Scan ${i + 1}`} className="w-10 h-10 rounded-md object-cover" />
                                            ) : (
                                                <Paperclip className="h-4 w-4 shrink-0" />
                                            )}
                                            <span className="text-sm text-primary group-hover:underline truncate">CCC Scan {i + 1}</span>
                                        </a>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDeleteScan(url, 'cccScans')}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <ImageUploader onImagesChange={setCccFiles} title="CCC Documents" />
                </div>
                 <Separator />
                <div>
                    <h4 className="font-semibold text-muted-foreground mb-2">Job Hazard Analysis (JHA) Scan(s)</h4>
                    {schedule?.jhaScans && schedule.jhaScans.length > 0 && (
                        <div className="mb-4 space-y-2">
                            <Label>Uploaded Documents</Label>
                            <div className="flex flex-col gap-2 rounded-md border p-2">
                                 {schedule.jhaScans.map((url, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                                            {isImageUrl(url) ? (
                                                <img src={url} alt={`JHA Scan ${i + 1}`} className="w-10 h-10 rounded-md object-cover" />
                                            ) : (
                                                <Paperclip className="h-4 w-4 shrink-0" />
                                            )}
                                            <span className="text-sm text-primary group-hover:underline truncate">JHA Scan {i + 1}</span>
                                        </a>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDeleteScan(url, 'jhaScans')}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <ImageUploader onImagesChange={setJhaFiles} title="JHA Documents" />
                </div>
            </CardContent>
        </Card>

        <Card className="my-8">
            <CardHeader>
                <CardTitle>Task Documents</CardTitle>
                <CardDescription>Upload scans of the Permit to Work and Work Order.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h4 className="font-semibold text-muted-foreground mb-2">Permit to Work Scan(s)</h4>
                    {schedule?.ptwScans && schedule.ptwScans.length > 0 && (
                        <div className="mb-4 space-y-2">
                            <Label>Uploaded Documents</Label>
                            <div className="flex flex-col gap-2 rounded-md border p-2">
                                {schedule.ptwScans.map((url, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                                            {isImageUrl(url) ? (<img src={url} alt={`Permit to Work Scan ${i + 1}`} className="w-10 h-10 rounded-md object-cover" />) : (<Paperclip className="h-4 w-4 shrink-0" />)}
                                            <span className="text-sm text-primary group-hover:underline truncate">Permit to Work Scan {i + 1}</span>
                                        </a>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDeleteScan(url, 'ptwScans')}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <ImageUploader onImagesChange={setPtwFiles} title="Permit to Work Documents" />
                </div>
                <Separator />
                <div>
                    <h4 className="font-semibold text-muted-foreground mb-2">Works Order Scan(s)</h4>
                    {schedule?.workOrderScans && schedule.workOrderScans.length > 0 && (
                        <div className="mb-4 space-y-2">
                            <Label>Uploaded Documents</Label>
                            <div className="flex flex-col gap-2 rounded-md border p-2">
                                 {schedule.workOrderScans.map((url, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                                            {isImageUrl(url) ? (<img src={url} alt={`Works Order Scan ${i + 1}`} className="w-10 h-10 rounded-md object-cover" />) : (<Paperclip className="h-4 w-4 shrink-0" />)}
                                            <span className="text-sm text-primary group-hover:underline truncate">Works Order Scan {i + 1}</span>
                                        </a>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDeleteScan(url, 'workOrderScans')}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <ImageUploader onImagesChange={setWorkOrderFiles} title="Works Order Documents" />
                </div>
            </CardContent>
        </Card>

        <div className="my-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Work Crew</h3>
                <Button variant="outline" size="sm" onClick={addCrewMember} className="print:hidden">
                    <Plus className="mr-2 h-4 w-4" /> Add Crew Member
                </Button>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>WORK CREW - NAME</TableHead>
                        <TableHead>RTBS NO.</TableHead>
                        <TableHead>DATE</TableHead>
                        <TableHead className="w-[50px] print:hidden"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {crew.map((member, index) => (
                        <WorkCrewRow key={member.localId} onRemove={() => removeCrewMember(member.localId)} onChange={(field, value) => handleCrewChange(index, field, value)} users={users} usersLoading={usersLoading} member={member}/>
                    ))}
                </TableBody>
            </Table>
        </div>

        <h3 className="text-xl font-bold mb-4">Monthly Maintenance: "The Deep Clean"</h3>
        <p className="text-sm text-muted-foreground mb-4">Monthly tasks focus on the physical health of the drive and ensuring that the cooling systems are actually working, not just spinning.</p>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[75px]">Task</TableHead>
                <TableHead className="w-[350px]">Action</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead className="text-center w-[150px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyChecklistItems.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.task}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell>
                    <Input placeholder="Comments..." value={checklist[index]?.comments || ''} onChange={(e) => handleChecklistChange(index, 'comments', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Select value={checklist[index]?.status || 'not-checked'} onValueChange={(value) => handleChecklistChange(index, 'status', value)}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="checked">Checked</SelectItem>
                            <SelectItem value="not-checked">Not Checked</SelectItem>
                            <SelectItem value="n/a">N/A</SelectItem>
                        </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Separator className="my-8" />

        <h3 className="text-xl font-bold mb-4">Annual Maintenance: "The Technical Audit"</h3>
        <p className="text-sm text-muted-foreground mb-4">Once a year, the drive should be powered down (following strict Lockout/Tagout procedures) for a detailed health check.</p>
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[150px]">Component</TableHead>
                        <TableHead className="w-[250px]">Action</TableHead>
                        <TableHead className="w-[250px]">Reason</TableHead>
                        <TableHead>Comments</TableHead>
                        <TableHead className="text-center w-[150px]">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {annualChecklistItems.map((item, index) => {
                        const checklistIndex = monthlyChecklistItems.length + index;
                        return (
                        <TableRow key={index}>
                            <TableCell className="font-medium">{item.component}</TableCell>
                            <TableCell>{item.action}</TableCell>
                            <TableCell>{item.reason}</TableCell>
                            <TableCell>
                               <Input placeholder="Comments..." value={checklist[checklistIndex]?.comments || ''} onChange={(e) => handleChecklistChange(checklistIndex, 'comments', e.target.value)} />
                            </TableCell>
                            <TableCell>
                                <Select value={checklist[checklistIndex]?.status || 'not-checked'} onValueChange={(value) => handleChecklistChange(checklistIndex, 'status', value)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="checked">Checked</SelectItem>
                                        <SelectItem value="not-checked">Not Checked</SelectItem>
                                        <SelectItem value="n/a">N/A</SelectItem>
                                    </SelectContent>
                                </Select>
                            </TableCell>
                        </TableRow>
                    )})}
                </TableBody>
            </Table>
        </Card>
        <footer className="mt-16 text-xs text-muted-foreground text-center">
          <p>Altek Green - Confidential</p>
        </footer>
      </Card>
    </div>
  );
}
