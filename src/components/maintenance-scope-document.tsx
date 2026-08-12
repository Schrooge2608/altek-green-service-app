'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Printer, Plus, Trash2, Save, Loader2, Paperclip, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import React, { useState, useMemo, useEffect } from 'react';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import type { Equipment, User, ScheduledTask, MaintenanceTask, WorkCrewMember, ChecklistItem } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Textarea } from './ui/textarea';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { ImageUploader } from './image-uploader';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { SignaturePad } from '@/components/ui/signature-pad';
import { WhatsAppShare } from '@/components/ui/whatsapp-share';
import { RescheduleJobDialog } from './maintenance/reschedule-job-dialog';
import Image from 'next/image';


interface MaintenanceScopeDocumentProps {
  title: string;
  component: MaintenanceTask['component'];
  frequency: MaintenanceTask['frequency'];
  schedule?: ScheduledTask;
}

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
            <TableCell><Input placeholder="RTBS No..." value={member.rtbsNo || ''} onChange={(e) => onChange('rtbsNo', e.target.value)} disabled={disabled} /></TableCell>
            <TableCell className="w-[180px]">
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !member.date && "text-muted-foreground"
                        )}
                        disabled={disabled}
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
                {!disabled && (
                    <Button variant="ghost" size="icon" onClick={onRemove} className="print:hidden">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </TableCell>
        </TableRow>
    )
}

const getFrequencyPrefix = (frequency: MaintenanceTask['frequency']): string => {
    switch (frequency) {
        case 'Weekly': return 'WS';
        case 'Monthly': return 'MS';
        case '3-Monthly': return '3MS';
        case '6-Monthly': return '6MS';
        case 'Yearly': return 'YS';
        default: return 'TASK';
    }
};

const isImageUrl = (url: string) => /\.(jpeg|jpg|gif|png|webp)$/i.test(url);

const determineNextTaskType = (baseDate: Date, nextDate: Date): MaintenanceTask['frequency'] => {
  const monthDiff = (nextDate.getFullYear() - baseDate.getFullYear()) * 12 + (nextDate.getMonth() - baseDate.getMonth());
  
  if (monthDiff % 12 === 0) return 'Yearly';
  if (monthDiff % 6 === 0) return '6-Monthly';
  return '3-Monthly';
};

export function MaintenanceScopeDocument({ title, component, frequency, schedule }: MaintenanceScopeDocumentProps) {
    const [selectedEquipment, setSelectedEquipment] = useState<string | undefined>(schedule?.equipmentId);
    const [inspectionDate, setInspectionDate] = useState<Date | undefined>(schedule ? new Date(schedule.scheduledFor) : undefined);
    const [area, setArea] = useState<string>(schedule?.area || '');
    const [completionNotes, setCompletionNotes] = useState<string>(schedule?.completionNotes || '');
    const [comments, setComments] = useState<string>(schedule?.comments || '');

    // SIGNATURE STATES
    const [techName, setTechName] = useState("");
    const [techSignature, setTechSignature] = useState("");
    const [managerName, setManagerName] = useState("");
    const [managerSignature, setManagerSignature] = useState("");
    const [managerComments, setManagerComments] = useState("");

    const [crew, setCrew] = useState<(Partial<WorkCrewMember> & { localId: number })[]>(() =>
        (schedule?.workCrew && schedule.workCrew.length > 0)
        ? schedule.workCrew.map((m, i) => ({ ...m, localId: i }))
        : [{ localId: Date.now(), name: '', rtbsNo: '', date: '', signature: '' }]
    );

    const [isSaving, setIsSaving] = useState(false);
    const { firestore, firebaseApp } = useFirebase();
    const { user } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    
    const [take5Files, setTake5Files] = useState<File[]>([]);
    const [cccFiles, setCccFiles] = useState<File[]>([]);
    const [jhaFiles, setJhaFiles] = useState<File[]>([]);
    const [ptwFiles, setPtwFiles] = useState<File[]>([]);
    const [workOrderFiles, setWorkOrderFiles] = useState<File[]>([]);

    // Sync state if schedule prop updates (e.g. after Reschedule)
    useEffect(() => {
        if (schedule) {
            setTechName(schedule.techName || "");
            setTechSignature(schedule.techSignature || "");
            setManagerName(schedule.clientName || "");
            setManagerSignature(schedule.clientSignature || "");
            setManagerComments(schedule.managerComments || "");
            setInspectionDate(new Date(schedule.scheduledFor));
            setArea(schedule.area || '');
        } else if (user) {
            getDoc(doc(firestore, 'users', user.uid)).then(snap => {
                if (snap.exists()) setTechName(snap.data().name);
            });
        }
    }, [schedule, user, firestore]);

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
    const isFormLocked = (schedule?.status === 'Approved' || schedule?.status === 'Completed') || (isEditMode && !isAssignee);
    const isReadOnly = isFormLocked;

    const isAdmin = !!(currentUserData?.role && (
        currentUserData.role.includes('Admin') || 
        currentUserData.role.includes('Superadmin') || 
        currentUserData.role.includes('Corporate Manager') || 
        currentUserData.role.includes('Services Manager') || 
        currentUserData.role.includes('Supervisor')
    ));

    useEffect(() => {
        if (!isEditMode && selectedEquipment && equipment) {
            const eq = equipment.find(e => e.id === selectedEquipment);
            if (eq) setArea(eq.location);
        }
    }, [selectedEquipment, equipment, isEditMode]);

    const addCrewMember = () => {
        setCrew(c => [...c, { localId: Date.now(), name: '', rtbsNo: '', date: '', signature: '' }]);
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
                description: error.message || "An unexpected error occurred.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProgress = async () => {
        if (!schedule || !firebaseApp) {
            toast({ variant: 'destructive', title: 'Error', description: 'Cannot save progress without a schedule context.' });
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
                area,
                workCrew: crewToSave,
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
            if (newCccUrls.length > 0) updateData.cccScans = [...(schedule.cccScans || []), ...newCccUrls];
            if (newJhaUrls.length > 0) updateData.jhaScans = [...(schedule.jhaScans || []), ...newJhaUrls];
            if (newPtwUrls.length > 0) updateData.ptwScans = [...(schedule.ptwScans || []), ...newPtwUrls];
            if (newWorkOrderUrls.length > 0) updateData.workOrderScans = [...(schedule.workOrderScans || []), ...newWorkOrderUrls];

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


    const handleSaveToUpcoming = async () => {
        if (!selectedEquipment || !inspectionDate || !user || !currentUserData) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please select an equipment and date before saving.'
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

        const newScheduledTask: Omit<ScheduledTask, 'id' | 'updatedAt'> & { comments?: string } = {
            originalTaskId: `${equipmentData.id}-${title.toLowerCase().replace(/ /g, '-')}`,
            equipmentId: equipmentData.id,
            equipmentName: equipmentData.name,
            area: area || equipmentData.location,
            task: title,
            scheduledFor: format(inspectionDate, 'yyyy-MM-dd'),
            status: 'Pending',
            assignedToId: user.uid,
            assignedToName: currentUserData.name,
            completionNotes: '',
            comments: comments,
            component: component,
            frequency: frequency,
            techName: techName || "",
            techSignature: techSignature || "",
            clientName: managerName || "",
            clientSignature: managerSignature || "",
            managerComments: managerComments || "",
        };

        try {
            const schedulesRef = collection(firestore, 'upcoming_schedules');
            const docRef = await addDoc(schedulesRef, newScheduledTask);
            await updateDoc(doc(schedulesRef, docRef.id), { id: docRef.id });
            
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
    
    const handleTechnicianSign = async () => {
        if (!schedule || !techSignature || !techName) return;

        setIsSaving(true);
        const scheduleRef = doc(firestore, 'upcoming_schedules', schedule.id);
        const crewToSave = crew.map(({ localId, ...rest }) => rest);

        try {
            const updateData: Partial<ScheduledTask> = {
                status: 'Completed',
                area,
                workCrew: crewToSave,
                checklist: schedule.checklist,
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
                
                const nextTaskData: Omit<ScheduledTask, 'id' | 'updatedAt'> = {
                    originalTaskId: `${schedule.equipmentId}-${nextType.toLowerCase()}-auto`,
                    equipmentId: schedule.equipmentId,
                    equipmentName: schedule.equipmentName,
                    area: area || equipmentData.location,
                    task: `${schedule.component} ${nextType} Service`,
                    component: schedule.component,
                    frequency: nextType,
                    scheduledFor: format(nextDueDate, 'yyyy-MM-dd'),
                    status: 'Pending',
                    assignedToId: schedule.assignedToId,
                    assignedToName: schedule.assignedToName,
                };

                await addDoc(collection(firestore, 'upcoming_schedules'), nextTaskData);

                await updateDoc(equipmentRef, {
                    lastMaintenance: schedule.scheduledFor,
                    nextMaintenance: format(nextDueDate, 'yyyy-MM-dd'),
                    status: 'active'
                });
            }

            toast({ title: 'Task Completed', description: 'The maintenance task has been marked as complete.' });
            router.push('/maintenance/upcoming-schedules');
        } catch (error: any) {
            console.error("Completion Failed:", error);
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

    const docPrefix = getFrequencyPrefix(frequency);
    
    const waScheduleMsg = schedule ? `
  *📅 SCHEDULED TASK UPDATE*
  ---------------------------
  🗓️ *Date:* ${schedule.scheduledFor}
  👤 *Tech:* ${schedule.assignedToName}
  ⚙️ *Equip:* ${schedule.equipmentName}
  📝 *Task:* ${schedule.task}
  🔁 *Freq:* ${schedule.frequency}
  
  Status: *${schedule.status}*
  `.trim() : '';


  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background">
        <div className="flex justify-end mb-4 gap-2 print:hidden items-center">
            {schedule && <WhatsAppShare text={waScheduleMsg} label="Share Update" />}
            {schedule && <RescheduleJobDialog schedule={schedule} />}
            {isEditMode && !isReadOnly && (
                <Button onClick={handleSaveProgress} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Progress
                </Button>
            )}
            {!isEditMode && (
                 <Button variant="outline" onClick={handleSaveToUpcoming} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSaving ? 'Saving...' : 'Save to Upcoming Schedule List'}
                </Button>
            )}
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={(e) => {
                e.preventDefault();
                window.print();
              }}
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </Button>
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
                        <Input id="area" placeholder="e.g., MPA Pump Station" value={area} onChange={e => setArea(e.target.value)} disabled={isFormLocked} />
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
                                disabled={isEditMode || isFormLocked}
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
                        <Label>Inspected By</Label>
                        <Input 
                            value={schedule ? schedule.assignedToName : currentUserData?.name || 'Loading...'}
                            disabled={true}
                            className="bg-slate-100 font-bold text-slate-700"
                        />
                    </div>
                </CardContent>
            </Card>

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
                                                {isImageUrl(url) ? (<img src={url} alt={`Take 5 Scan ${i + 1}`} className="w-10 h-10 rounded-md object-cover" />) : (<Paperclip className="h-4 w-4 shrink-0" />)}
                                                <span className="text-sm text-primary group-hover:underline truncate">Take 5 Scan {i + 1}</span>
                                            </a>
                                            {!isFormLocked && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDeleteScan(url, 'take5Scans')}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!isFormLocked && <ImageUploader onImagesChange={setTake5Files} title="Take 5 Documents" />}
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
                                            {!isFormLocked && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDeleteScan(url, 'workOrderScans')}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!isFormLocked && <ImageUploader onImagesChange={setWorkOrderFiles} title="Works Order Documents" />}
                    </div>
                </CardContent>
            </Card>

            <div className="my-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Work Crew</h3>
                    {!isFormLocked && (
                        <Button variant="outline" size="sm" onClick={addCrewMember} className="print:hidden">
                            <Plus className="mr-2 h-4 w-4" /> Add Crew Member
                        </Button>
                    )}
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
                            <WorkCrewRow
                                key={member.localId}
                                member={member}
                                onRemove={() => removeCrewMember(member.localId)}
                                onChange={(field, value) => handleCrewChange(index, field, value)}
                                users={users}
                                usersLoading={usersLoading}
                                disabled={isFormLocked}
                            />
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="my-8">
                <h3 className="text-xl font-bold mb-4">Completion Notes</h3>
                <Textarea
                    placeholder="Enter any notes about the work performed, issues found, or follow-up actions required..."
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    rows={6}
                    disabled={isFormLocked}
                />
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
                                    <Button 
                                        type="button" variant="ghost" size="sm" 
                                        onClick={() => setTechSignature("")} 
                                        className="text-red-500 mt-2 text-xs"
                                    >
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
                                    <Input 
                                        value={managerName} 
                                        onChange={(e) => setManagerName(e.target.value)} 
                                        placeholder="e.g. John Manager" 
                                        disabled={!isAdmin} 
                                        className="bg-white" 
                                    />
                                </div>
                                
                                {managerSignature ? (
                                    <div className="border border-amber-200 bg-white p-2 rounded-md text-center mt-auto">
                                        <img src={managerSignature} alt="Manager Signature" className="max-h-24 w-auto mx-auto" />
                                        {!isReadOnly && (
                                            <Button 
                                                type="button" variant="ghost" size="sm" 
                                                onClick={() => setManagerSignature("")} 
                                                className="text-red-500 mt-2 text-xs"
                                            >
                                                Clear Signature
                                            </Button>
                                        )}
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

            {isEditMode && !isReadOnly && (
                <div className="mt-8 flex justify-end">
                    <Button onClick={handleTechnicianSign} disabled={isSaving || !techSignature} className="bg-green-600 hover:bg-green-700">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Submit Completed Schedule
                    </Button>
                </div>
            )}
            
            <footer className="mt-16 text-xs text-muted-foreground text-center">
               <p>Altek Green - Confidential</p>
            </footer>
        </Card>
    </div>
  );
}
