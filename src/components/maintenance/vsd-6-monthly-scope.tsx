'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import {
  CalendarIcon,
  Printer,
  Plus,
  Trash2,
  AlertTriangle,
  Save,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import React, { useMemo, useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { useCollection, useFirestore, useMemoFirebase, useUser, addDocumentNonBlocking, updateDocumentNonBlocking, useFirebase } from '@/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import type { Equipment, User, ScheduledTask, MaintenanceTask, WorkCrewMember, ChecklistItem } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { SignaturePad } from '@/components/ui/signature-pad';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { ImageUploader } from '../image-uploader';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { RescheduleJobDialog } from './reschedule-job-dialog';

interface WorkCrewRowProps {
    member: Partial<WorkCrewMember> & { localId: number };
    onRemove: () => void;
    onChange: (field: keyof WorkCrewMember, value: string) => void;
    users: User[] | null;
    usersLoading: boolean;
    disabled?: boolean;
}

function WorkCrewRow({ member, onRemove, onChange, users, usersLoading, disabled }: WorkCrewRowProps) {
  return (
    <TableRow>
      <TableCell>
        <Select
            disabled={usersLoading || disabled}
            value={users?.find(u => u.name === member.name)?.id}
            onValueChange={(userId) => {
                const user = users?.find(u => u.id === userId);
                onChange('name', user?.name || '');
                if (user?.rtbsNumber) {
                    onChange('rtbsNo', user.rtbsNumber);
                }
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
      <TableCell>
        <Input placeholder="RTBS No..." value={member.rtbsNo || ''} onChange={(e) => onChange('rtbsNo', e.target.value)} disabled={disabled} />
      </TableCell>
      <TableCell className="w-[180px]">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={'outline'}
              className={cn(
                'w-full justify-start text-left font-normal',
                !member.date && 'text-muted-foreground'
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {member.date ? format(new Date(member.date), 'PPP') : <span>Pick a date</span>}
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
        {!disabled && (
            <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="print:hidden"
            >
            <Trash2 className="h-4 w-4" />
            </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

const qualityControlItems = [
    { text: "Inspect isolator handle/mechanism for correct operation, including preventing door from being opened when in ON or LOCKOUT position." },
    { text: "Check for correct alignment of doors and ensure latching mechanisms are all operational. Lubricate rotating door mechanism with good quality electrical penetration oil." },
    { text: "Wash all door filters if the washable type filters are installed. Filters must be 100% dry before being re-fitted. Replace where necessary." },
    { text: "Inspect all internal covers that prevent inadvertent contact with “Live” busbars for cracks or missing screws/bolts." },
    { text: "Vacuum clean entire cubicle or panel, take care not to disturb control and communication wiring." },
    { text: "Blow out VSD panels with blower only once vacuuming have been completed. Take care when blowing over delicate control wiring." },
    { text: "Inspect Power cable connections and bus bars for damage and hot connections (discoloration)." },
    { text: "Inspect condition of ribbon cables and make sure they are securely plugged in." },
    { text: "Check that ribbon cables are not resting on sharp edges or mains bus bars/terminations." },
    { text: "Inspect condition of control wiring cables and ensure they are not resting on sharp edges or bus bars/terminations." },
    { text: "Check all lugged terminals for loose connections and re-tighten where necessary." },
    { text: "Ensure that supply as well as the control fuses are of the correct ratings and located properly inside fuse holders." },
    { text: "Check cooling fan blades for cracks, free rotation and smooth bearing operation." },
];

const commissioningItems = [
    { text: "Ensure that no one is working on the equipment and de-isolate." },
    { text: "Ensure panel heaters are operational. Measure current or use IR gun (45-50°C)." },
    { text: "Test run VSD from control room. Make sure doors are latched during initial start." },
    { text: "Inspect digital displays, panel meters and indication lights. Replace faulty units." },
    { text: "Verify all VSD cooling fans are running and blowing in the correct direction." },
    { text: "Verify MCC pressurization ventilation system purging fan is operational." },
    { text: "Verify MCC pressurization ventilation system is blowing adequate air into MCC." },
    { text: "Verify MCC extraction ventilation system is operational." },
    { text: "Check AC temperature settings (not below 26°C)." },
    { text: "Leave area clean and tidy" },
];

const isImageUrl = (url: string) => /\.(jpeg|jpg|gif|png|webp)$/i.test(url);

const determineNextTaskType = (baseDate: Date, nextDate: Date): MaintenanceTask['frequency'] => {
  const monthDiff = (nextDate.getFullYear() - baseDate.getFullYear()) * 12 + (nextDate.getMonth() - baseDate.getMonth());
  if (monthDiff % 12 === 0) return 'Yearly';
  if (monthDiff % 6 === 0) return '6-Monthly';
  return '3-Monthly';
};

export function Vsd6MonthlyScopeDocument({ schedule }: { schedule?: ScheduledTask }) {
    const title = "VSDs 6-Monthly Service Scope";
    const [selectedEquipment, setSelectedEquipment] = React.useState<string | undefined>(schedule?.equipmentId);
    const [inspectionDate, setInspectionDate] = React.useState<Date | undefined>(schedule ? new Date(schedule.scheduledFor) : undefined);
    const [isSaving, setIsSaving] = React.useState(false);
    const { firestore, firebaseApp } = useFirebase();
    const { user } = useUser();
    const { toast } = useToast();
    const router = useRouter();

    const [take5Files, setTake5Files] = useState<File[]>([]);
    const [workOrderFiles, setWorkOrderFiles] = useState<File[]>([]);
    const [completionNotes, setCompletionNotes] = useState<string>(schedule?.completionNotes || '');
    const [comments, setComments] = useState<string>(schedule?.comments || '');

    // SIGNATURE STATES
    const [techName, setTechName] = useState("");
    const [techSignature, setTechSignature] = useState("");
    const [managerName, setManagerName] = useState("");
    const [managerSignature, setManagerSignature] = useState("");
    const [managerComments, setManagerComments] = useState("");

    const [crew, setCrew] = React.useState<(Partial<WorkCrewMember> & { localId: number })[]>(() =>
        (schedule?.workCrew && schedule.workCrew.length > 0)
        ? schedule.workCrew.map((m, i) => ({ ...m, localId: i }))
        : [{ localId: Date.now(), name: '', rtbsNo: '', date: '', signature: '' }]
    );

    const initialChecklist = React.useMemo(() => [
        ...qualityControlItems.map(item => ({ task: item.text, status: 'not-checked' as const, comments: '' })),
        ...commissioningItems.map(item => ({ task: item.text, status: 'not-checked' as const, comments: '' })),
    ], []);

    const [checklist, setChecklist] = React.useState<ChecklistItem[]>(() => {
        if (schedule?.checklist && schedule.checklist.length > 0) {
            return schedule.checklist;
        }
        return initialChecklist;
    });

    // Sync state if schedule prop updates (e.g. after Reschedule)
    useEffect(() => {
        if (schedule) {
            setTechName(schedule.techName || "");
            setTechSignature(schedule.techSignature || "");
            setManagerName(schedule.clientName || "");
            setManagerSignature(schedule.clientSignature || "");
            setManagerComments(schedule.managerComments || "");
            setInspectionDate(new Date(schedule.scheduledFor));
        }
    }, [schedule]);

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
    
    const isEditMode = !!schedule;
    const isAssignee = user?.uid === schedule?.assignedToId;
    const isReadOnly = (schedule?.status === 'Approved' || schedule?.status === 'Completed') || (isEditMode && !isAssignee);
    const docPrefix = "6MS";

    const isAdmin = !!(currentUserData?.role && (
        currentUserData.role.includes('Admin') || 
        currentUserData.role.includes('Superadmin') || 
        currentUserData.role.includes('Corporate Manager') || 
        currentUserData.role.includes('Services Manager') || 
        currentUserData.role.includes('Supervisor')
    ));

    const addCrewMember = () => {
        setCrew(c => [...c, { localId: Date.now() }]);
    };

    const removeCrewMember = (localId: number) => {
        setCrew(c => c.filter(member => member.localId !== localId));
    };
    
    const handleCrewChange = (index: number, field: keyof WorkCrewMember, value: string) => {
        setCrew(prevCrew => {
            const newCrew = [...prevCrew];
            (newCrew[index] as any)[field] = value;
            return newCrew;
        });
    };

    const handleDeleteScan = async (fileUrl: string, docType: 'take5Scans' | 'cccScans' | 'jhaScans' | 'ptwScans' | 'workOrderScans') => {
        if (!schedule || !firebaseApp) return;
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
            console.error(error);
            toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProgress = async () => {
        if (!schedule || !firebaseApp) return;
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
            const [newTake5Urls, newWorkOrderUrls] = await Promise.all([
                uploadScans(take5Files, 'take5'),
                uploadScans(workOrderFiles, 'work_order'),
            ]);

            const scheduleRef = doc(firestore, 'upcoming_schedules', schedule.id);
            const crewToSave = crew.map(({ localId, ...rest }) => rest);
            const updateData: Partial<ScheduledTask> = {
                workCrew: crewToSave,
                checklist,
                completionNotes,
                comments: comments,
                techName: techName || "",
                techSignature: techSignature || "",
                clientName: managerName || "",
                clientSignature: managerSignature || "",
                managerComments: managerComments || "",
                updatedAt: new Date().toISOString(),
            };

            if (newTake5Urls.length > 0) updateData.take5Scans = [...(schedule.take5Scans || []), ...newTake5Urls];
            if (newWorkOrderUrls.length > 0) updateData.workOrderScans = [...(schedule.workOrderScans || []), ...newWorkOrderUrls];

            await updateDoc(scheduleRef, updateData);
            toast({ title: 'Progress Saved', description: 'Your changes have been saved successfully.' });
            router.refresh();
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleTechnicianSign = async () => {
        if (!schedule || !techSignature || !techName) return;
        setIsSaving(true);
        const scheduleRef = doc(firestore, 'upcoming_schedules', schedule.id);
        const crewToSave = crew.map(({ localId, ...rest }) => rest);

        try {
            const updateData: Partial<ScheduledTask> = {
                status: 'Completed',
                workCrew: crewToSave,
                checklist,
                completionNotes,
                comments,
                techSignature: techSignature,
                techName: techName,
                techSignatureDate: format(new Date(), 'yyyy-MM-dd'),
                clientName: managerName,
                clientSignature: managerSignature,
                managerComments: managerComments,
                updatedAt: new Date().toISOString()
            };
            await updateDoc(scheduleRef, updateData);

            const equipmentRef = doc(firestore, 'equipment', schedule.equipmentId);
            const equipmentSnap = await getDoc(equipmentRef);
            if (equipmentSnap.exists()) {
                const equipmentData = equipmentSnap.data() as Equipment;
                const workDate = new Date(schedule.scheduledFor || new Date());
                const nextDueDate = new Date(workDate);
                nextDueDate.setMonth(workDate.getMonth() + 3);
                const baseDate = equipmentData?.installationDate ? new Date(equipmentData.installationDate) : new Date(schedule.scheduledFor);
                const nextType = determineNextTaskType(baseDate, nextDueDate);
                
                await addDocumentNonBlocking(collection(firestore, 'upcoming_schedules'), {
                    originalTaskId: `${schedule.equipmentId}-${nextType.toLowerCase()}-auto`,
                    equipmentId: schedule.equipmentId,
                    equipmentName: schedule.equipmentName,
                    task: `VSD ${nextType} Service`,
                    component: schedule.component,
                    frequency: nextType,
                    scheduledFor: format(nextDueDate, 'yyyy-MM-dd'),
                    status: 'Pending',
                    assignedToId: schedule.assignedToId,
                    assignedToName: schedule.assignedToName,
                });

                await updateDoc(equipmentRef, {
                    lastMaintenance: schedule.scheduledFor,
                    nextMaintenance: format(nextDueDate, 'yyyy-MM-dd'),
                    status: 'active'
                });
            }

            toast({ title: 'Task Completed', description: 'The maintenance task has been marked as complete.' });
            router.push('/maintenance/upcoming-schedules');
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not complete the task.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async () => {
        if (!schedule) return;
        if (!managerSignature) {
            toast({ variant: 'destructive', title: "Signature required" });
            return;
        }
        setIsSaving(true);
        try {
            const scheduleRef = doc(firestore, 'upcoming_schedules', schedule.id);
            await updateDoc(scheduleRef, {
                managerComments,
                clientName: managerName,
                clientSignature: managerSignature,
                clientSignatureDate: format(new Date(), 'yyyy-MM-dd'),
                status: 'Approved',
                updatedAt: new Date().toISOString()
            });
            toast({ title: "Document Approved!" });
            router.push('/maintenance/upcoming-schedules');
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Approval Failed", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background">
        <div className="flex justify-end mb-4 gap-2 print:hidden items-center">
            {schedule && <RescheduleJobDialog schedule={schedule} />}
            {isEditMode && !isReadOnly && (
                <Button onClick={handleSaveProgress} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Progress
                </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </Button>
            {isEditMode && !isReadOnly && (
                <Button onClick={handleTechnicianSign} disabled={isSaving || !techSignature} className="bg-green-600 hover:bg-green-700">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Mark as Complete
                </Button>
            )}
        </div>

        <Card className="p-8 shadow-lg border-2 border-primary/20 bg-card">
            <header className="flex items-start justify-between mb-8">
                <div>
                    <AltekLogo className="h-12 w-auto" />
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
                        <Input id="area" placeholder="e.g., MPA Pump Station" disabled={isReadOnly} />
                    </div>
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={'outline'}
                                className={cn(
                                    'w-full justify-start text-left font-normal',
                                    !inspectionDate && 'text-muted-foreground'
                                )}
                                disabled={isEditMode}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {inspectionDate ? format(inspectionDate, 'PPP') : <span>Pick a date</span>}
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

            <Card className="my-8">
                <CardHeader>
                    <CardTitle>Safety & Task Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h4 className="font-semibold text-muted-foreground mb-2">Take 5 Scan(s)</h4>
                        {schedule?.take5Scans && schedule.take5Scans.length > 0 && (
                            <div className="mb-4 space-y-2">
                                <div className="flex flex-col gap-2 rounded-md border p-2">
                                    {schedule.take5Scans.map((url, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                                                {isImageUrl(url) ? (<img src={url} alt={`Take 5 Scan ${i + 1}`} className="w-10 h-10 rounded-md object-cover" />) : (<Paperclip className="h-4 w-4 shrink-0" />)}
                                                <span className="text-sm text-primary group-hover:underline truncate">Take 5 Scan {i + 1}</span>
                                            </a>
                                            {!isReadOnly && <Button variant="ghost" size="icon" onClick={() => handleDeleteScan(url, 'take5Scans')}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!isReadOnly && <ImageUploader onImagesChange={setTake5Files} title="Take 5 Documents" />}
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold text-muted-foreground mb-2">Works Order Scan(s)</h4>
                        {schedule?.workOrderScans && schedule.workOrderScans.length > 0 && (
                            <div className="mb-4 space-y-2">
                                <div className="flex flex-col gap-2 rounded-md border p-2">
                                     {schedule.workOrderScans.map((url, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                                                {isImageUrl(url) ? (<img src={url} alt={`Works Order Scan ${i + 1}`} className="w-10 h-10 rounded-md object-cover" />) : (<Paperclip className="h-4 w-4 shrink-0" />)}
                                                <span className="text-sm text-primary group-hover:underline truncate">Works Order Scan {i + 1}</span>
                                            </a>
                                            {!isReadOnly && <Button variant="ghost" size="icon" onClick={() => handleDeleteScan(url, 'workOrderScans')}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!isReadOnly && <ImageUploader onImagesChange={setWorkOrderFiles} title="Works Order Documents" />}
                    </div>
                </CardContent>
            </Card>

            <div className="my-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Work Crew</h3>
                    {!isReadOnly && <Button variant="outline" size="sm" onClick={addCrewMember} className="print:hidden"><Plus className="mr-2 h-4 w-4" /> Add Crew Member</Button>}
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
                            <WorkCrewRow key={member.localId} member={member} onRemove={() => removeCrewMember(member.localId)} onChange={(field, value) => handleCrewChange(index, field, value)} users={users} usersLoading={usersLoading} disabled={isReadOnly} />
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Card className="mt-8">
                <CardHeader><CardTitle>VARIABLE SPEED DRIVE Quality Control Sheet</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Comments / Feedback</TableHead>
                                <TableHead className="text-center w-[150px]">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {qualityControlItems.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.text}</TableCell>
                                    <TableCell><Input placeholder="Comments..." value={checklist[index]?.comments || ''} onChange={(e) => handleChecklistChange(index, 'comments', e.target.value)} disabled={isReadOnly} /></TableCell>
                                    <TableCell>
                                        <Select value={checklist[index]?.status || 'not-checked'} onValueChange={(value) => handleChecklistChange(index, 'status', value)} disabled={isReadOnly}>
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
                </CardContent>
            </Card>

            <Card className="mt-8">
                <CardHeader><CardTitle>Commissioning</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Comments / Feedback</TableHead>
                                <TableHead className="text-center w-[150px]">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {commissioningItems.map((item, index) => {
                                const checklistIndex = qualityControlItems.length + index;
                                return (
                                <TableRow key={index}>
                                    <TableCell>{item.text}</TableCell>
                                    <TableCell><Input placeholder="Comments..." value={checklist[checklistIndex]?.comments || ''} onChange={(e) => handleChecklistChange(checklistIndex, 'comments', e.target.value)} disabled={isReadOnly} /></TableCell>
                                    <TableCell>
                                        <Select value={checklist[checklistIndex]?.status || 'not-checked'} onValueChange={(value) => handleChecklistChange(checklistIndex, 'status', value)} disabled={isReadOnly}>
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
                </CardContent>
            </Card>
            
            <div className="my-8">
                 <h3 className="text-xl font-bold mb-4">Completion Notes</h3>
                 <Textarea placeholder="Enter any notes..." value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} rows={6} disabled={isReadOnly} />
            </div>
            
            {/* --- SIGNATURE SECTION --- */}
            <div className="mt-8 pt-6 border-t border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* 1. TECHNICIAN SIGN-OFF */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="text-sm font-bold text-slate-700 uppercase mb-4 text-center">Technician Sign-Off</h4>
                        
                        <div className="mb-3">
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Technician Name</label>
                            <Input 
                                value={techName} 
                                onChange={(e) => setTechName(e.target.value)} 
                                placeholder="e.g. Fritz Schroeder" 
                                disabled={!!techSignature || isReadOnly} 
                                className="bg-white"
                            />
                        </div>
                        
                        {techSignature ? (
                            <div className="border border-slate-200 bg-white p-2 rounded-md text-center">
                                <img src={techSignature} alt="Technician Signature" className="max-h-24 w-auto mx-auto" />
                                {!isReadOnly && (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setTechSignature("")} className="text-red-500 mt-2 text-xs">
                                        Clear Signature
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <SignaturePad onSave={(data) => setTechSignature(data)} />
                        )}
                    </div>

                    {/* 2. MANAGER APPROVAL */}
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex flex-col h-full">
                        <h4 className="text-sm font-bold text-amber-800 uppercase mb-4 text-center">Manager Approval</h4>
                        
                        {!techSignature ? (
                            <div className="p-6 bg-white rounded border border-amber-200 text-amber-700 text-sm text-center flex flex-col items-center justify-center h-[200px]">
                                <span className="font-bold text-base mb-2">⚠️ Work In Progress</span>
                                <span>Technician must complete and sign this schedule before you can approve it.</span>
                            </div>
                        ) : (
                            <div className="flex flex-col flex-grow">
                                
                                {/* Manager Comments */}
                                <div className="mb-4">
                                    <label className="text-xs font-semibold text-amber-700 block mb-1">Manager Comments (Optional)</label>
                                    <Textarea 
                                        value={managerComments} 
                                        onChange={(e) => setManagerComments(e.target.value)} 
                                        placeholder="Add any final remarks or feedback here..." 
                                        disabled={!isAdmin} 
                                        className="bg-white resize-none text-sm"
                                        rows={3}
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="text-xs font-semibold text-amber-700 block mb-1">Manager Name</label>
                                    <Input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="e.g. John Manager" disabled={!isAdmin} className="bg-white" />
                                </div>
                                {managerSignature ? (
                                    <div className="border border-amber-200 bg-white p-2 rounded-md text-center mt-auto">
                                        <img src={managerSignature} alt="Manager Signature" className="max-h-24 w-auto mx-auto" />
                                        {!isReadOnly && <Button type="button" variant="ghost" size="sm" onClick={() => setManagerSignature("")} className="text-red-500 mt-2 text-xs">Clear Signature</Button>}
                                    </div>
                                ) : (
                                    <div className="mt-auto">
                                        <SignaturePad onSave={(data) => setManagerSignature(data)} />
                                    </div>
                                )}

                                {isAdmin && (
                                    <Button onClick={handleApprove} disabled={isSaving || !managerSignature} className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white">
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Approve & Save
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <footer className="mt-16 text-xs text-muted-foreground text-center"><p>Altek Green - Confidential</p></footer>
        </Card>
    </div>
  );
}
