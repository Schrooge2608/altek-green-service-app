'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Printer, Plus, Trash2, Save, Loader2, Paperclip } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import React, { useState } from 'react';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from './ui/calendar';
import { useCollection, useMemoFirebase, useUser, addDocumentNonBlocking, useFirebase } from '@/firebase';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import type { Equipment, User, ScheduledTask, MaintenanceTask, WorkCrewMember } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { SignaturePad } from './ui/signature-pad';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Textarea } from './ui/textarea';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ImageUploader } from './image-uploader';


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
}

function WorkCrewRow({ member, onRemove, onChange, users, usersLoading }: WorkCrewRowProps) {
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
            <TableCell><Input placeholder="RTBS No..." value={member.rtbsNo || ''} onChange={(e) => onChange('rtbsNo', e.target.value)} /></TableCell>
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
            <TableCell className="w-[250px]"><SignaturePad value={member.signature} onSign={(sig) => onChange('signature', sig)} onClear={() => onChange('signature', '')} /></TableCell>
            <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={onRemove} className="print:hidden">
                    <Trash2 className="h-4 w-4" />
                </Button>
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

export function MaintenanceScopeDocument({ title, component, frequency, schedule }: MaintenanceScopeDocumentProps) {
    const [selectedEquipment, setSelectedEquipment] = useState<string | undefined>(schedule?.equipmentId);
    const [inspectionDate, setInspectionDate] = useState<Date | undefined>(schedule ? new Date(schedule.scheduledFor) : undefined);
    const [inspectedById, setInspectedById] = useState<string | undefined>(schedule?.assignedToId);
    const [completionNotes, setCompletionNotes] = useState<string>(schedule?.completionNotes || '');

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

    const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
    const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

    const usersQuery = useMemoFirebase(() => (user ? collection(firestore, 'users') : null), [firestore, user]);
    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

    const addCrewMember = () => {
        setCrew(c => [...c, { localId: Date.now(), name: '', rtbsNo: '', date: '', signature: '' }]);
    };

    const removeCrewMember = (localId: number) => {
        setCrew(c => c.filter(member => member.localId !== localId));
    };

    const handleCrewChange = (index: number, field: keyof WorkCrewMember, value: string) => {
        const newCrew = [...crew];
        (newCrew[index] as any)[field] = value;
        setCrew(newCrew);
    };

    const handleSaveProgress = async () => {
        if (!schedule || !firebaseApp) {
            toast({ variant: 'destructive', title: 'Error', description: 'Cannot save progress without a schedule context or Firebase App instance.' });
            return;
        }

        setIsSaving(true);
        
        const uploadScans = async (files: File[], docType: 'take5' | 'ccc'): Promise<string[]> => {
            if (!files.length) return [];
            const storage = getStorage(firebaseApp);
            const uploadPromises = files.map(async file => {
                const storagePath = `scheduled_tasks/${schedule.id}/${docType}_scans/${file.name}`;
                const storageRef = ref(storage, storagePath);
                
                const uploadPromise = uploadBytes(storageRef, file);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Upload timed out after 2 minutes.')), 120000)
                );

                const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as Awaited<typeof uploadPromise>;
                return getDownloadURL(snapshot.ref);
            });
            return Promise.all(uploadPromises);
        };

        try {
            const [newTake5Urls, newCccUrls] = await Promise.all([
                uploadScans(take5Files, 'take5'),
                uploadScans(cccFiles, 'ccc'),
            ]);

            const scheduleRef = doc(firestore, 'upcoming_schedules', schedule.id);
            const crewToSave = crew.map(({ localId, ...rest }) => rest);

            const updateData: Partial<ScheduledTask> = {
                workCrew: crewToSave,
                completionNotes,
            };

            if (newTake5Urls.length > 0) {
                updateData.take5Scans = [...(schedule.take5Scans || []), ...newTake5Urls];
            }
            if (newCccUrls.length > 0) {
                updateData.cccScans = [...(schedule.cccScans || []), ...newCccUrls];
            }

            await updateDoc(scheduleRef, updateData);
            toast({ title: 'Progress Saved', description: 'Your changes have been saved successfully.' });
            
            if (newTake5Urls.length > 0) setTake5Files([]);
            if (newCccUrls.length > 0) setCccFiles([]);
            
            router.refresh();

        } catch (error: any) {
            console.error("Error saving progress:", error);
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsSaving(false);
        }
    };


    const handleSaveToUpcoming = async () => {
        if (!selectedEquipment || !inspectionDate || !inspectedById) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please select an equipment, date, and inspector before saving.'
            });
            return;
        }
        setIsSaving(true);

        const equipmentData = equipment?.find(e => e.id === selectedEquipment);
        const inspectorData = users?.find(u => u.id === inspectedById);

        if (!equipmentData || !inspectorData) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find selected equipment or user.' });
            setIsSaving(false);
            return;
        }

        const newScheduledTask: Omit<ScheduledTask, 'id'> = {
            originalTaskId: `${equipmentData.id}-${title.toLowerCase().replace(/ /g, '-')}`,
            equipmentId: equipmentData.id,
            equipmentName: equipmentData.name,
            task: title,
            scheduledFor: format(inspectionDate, 'yyyy-MM-dd'),
            status: 'Pending',
            assignedToId: inspectorData.id,
            assignedToName: inspectorData.name,
            completionNotes: '',
            component: component,
            frequency: frequency,
        };

        try {
            const schedulesRef = collection(firestore, 'upcoming_schedules');
            const docRef = await addDocumentNonBlocking(schedulesRef, newScheduledTask);
            await setDoc(doc(schedulesRef, docRef.id), { id: docRef.id }, { merge: true });

            const scheduleId = docRef.id;
            const uploadScans = async (files: File[], docType: 'take5' | 'ccc'): Promise<string[]> => {
                if (!firebaseApp || files.length === 0) return [];
                const storage = getStorage(firebaseApp);
                const uploadPromises = files.map(async file => {
                    const storagePath = `scheduled_tasks/${scheduleId}/${docType}_scans/${file.name}`;
                    const storageRef = ref(storage, storagePath);

                    const uploadPromise = uploadBytes(storageRef, file);
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Upload timed out after 2 minutes.')), 120000)
                    );
                    
                    const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as Awaited<typeof uploadPromise>;
                    return getDownloadURL(snapshot.ref);
                });
                return Promise.all(uploadPromises);
            };

            const [newTake5Urls, newCccUrls] = await Promise.all([
                uploadScans(take5Files, 'take5'),
                uploadScans(cccFiles, 'ccc'),
            ]);

            if (newTake5Urls.length > 0 || newCccUrls.length > 0) {
                await updateDoc(docRef, { 
                    take5Scans: newTake5Urls,
                    cccScans: newCccUrls,
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

    const isEditMode = !!schedule;
    const docPrefix = getFrequencyPrefix(frequency);


  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background">
        <div className="flex justify-end mb-4 gap-2 print:hidden">
            {isEditMode ? (
                <Button onClick={handleSaveProgress} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSaving ? 'Saving...' : 'Save Progress'}
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
                        <Select onValueChange={setInspectedById} value={inspectedById} disabled={usersLoading || !user || isEditMode}>
                            <SelectTrigger id="inspected-by">
                                <SelectValue placeholder="Select technician..." />
                            </SelectTrigger>
                            <SelectContent>
                            {usersLoading ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : (
                                users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)
                            )}
                            </SelectContent>
                        </Select>
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

            <Card className="my-8">
                <CardHeader>
                    <CardTitle>Safety Documentation</CardTitle>
                    <CardDescription>Upload scans of the completed Take 5 and CCC documents.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h4 className="font-semibold text-muted-foreground mb-2">Take 5 Assessment Scan(s)</h4>
                        {schedule?.take5Scans && schedule.take5Scans.length > 0 && (
                            <div className="mb-4 space-y-2">
                                <Label>Uploaded Documents</Label>
                                <div className="flex flex-wrap gap-2 rounded-md border p-2">
                                    {schedule.take5Scans.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                                            <Paperclip className="h-3 w-3" />
                                            Take 5 Scan {i + 1}
                                        </a>
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
                                <div className="flex flex-wrap gap-2 rounded-md border p-2">
                                    {schedule.cccScans.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                                            <Paperclip className="h-3 w-3" />
                                            CCC Scan {i + 1}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                        <ImageUploader onImagesChange={setCccFiles} title="CCC Documents" />
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
                            <TableHead>SIGNATURE</TableHead>
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
                                usersLoading={usersLoading} />
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
                    disabled={!isEditMode}
                 />
            </div>


            <Separator className="my-8" />

            <footer className="mt-16 text-xs text-muted-foreground text-center">
               <p>Altek Green - Confidential</p>
            </footer>
        </Card>
    </div>
  );
}
