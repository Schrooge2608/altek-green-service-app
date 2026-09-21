'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Car, Fuel, Loader2, Trash2, MapPin } from 'lucide-react';
import { useCollection, useFirestore, useUser, deleteDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, updateDoc, serverTimestamp, doc } from 'firebase/firestore';
import type { VehicleTravelLog, VehicleExpense, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const VEHICLES = ['Vehicle 1', 'Vehicle 2', 'Vehicle 3'];
const EXPENSE_TYPES = ['Fuel', 'Maintenance', 'Tolls', 'Other'];

export default function VehiclesPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    // Queries
    const travelQuery = useMemoFirebase(() => query(collection(firestore, 'vehicle_travel_logs'), orderBy('createdAt', 'desc')), [firestore]);
    const { data: travelLogs, isLoading: loadingTravel } = useCollection<VehicleTravelLog>(travelQuery);

    const expenseQuery = useMemoFirebase(() => query(collection(firestore, 'vehicle_expenses'), orderBy('createdAt', 'desc')), [firestore]);
    const { data: expenses, isLoading: loadingExpenses } = useCollection<VehicleExpense>(expenseQuery);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('name', 'asc')), [firestore]);
    const { data: usersList } = useCollection<User>(usersQuery);

    const currentUserProfile = usersList?.find(u => u.id === user?.uid);
    const canViewGPS = currentUserProfile?.role === 'Altek Green Manager' || currentUserProfile?.role === 'Admin' || currentUserProfile?.role === 'Superadmin';

    // State for Travel Log Dialog
    const [isTravelDialogOpen, setIsTravelDialogOpen] = useState(false);
    const [travelForm, setTravelForm] = useState({
        vehicleName: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        technicianId: '',
        startKm: '',
        endKm: '',
        destination: '',
        reason: ''
    });
    const [isSubmittingTravel, setIsSubmittingTravel] = useState(false);

    // State for Expense Dialog
    const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        vehicleName: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        expenseType: '',
        amount: '',
        description: ''
    });
    const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

    // State for Closing Travel Log
    const [closingLog, setClosingLog] = useState<VehicleTravelLog | null>(null);
    const [closeEndKm, setCloseEndKm] = useState('');

    const getCurrentLocation = async (): Promise<{lat: number, lng: number} | null> => {
        if (!navigator.geolocation) return null;
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
            });
            return { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (e) {
            console.warn('Geolocation error:', e);
            return null;
        }
    };

    const handleCloseLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!closingLog) return;
        setIsSubmittingTravel(true);
        try {
            const end = parseFloat(closeEndKm);
            const distance = end - closingLog.startKm;

            if (distance < 0) {
                toast({ variant: 'destructive', title: 'Invalid KMs', description: 'End KM cannot be less than Start KM.' });
                setIsSubmittingTravel(false);
                return;
            }
            
            toast({ description: 'Acquiring GPS location...' });
            const endLoc = await getCurrentLocation();

            await updateDoc(doc(firestore, 'vehicle_travel_logs', closingLog.id), {
                endKm: end,
                distance: distance,
                status: 'Completed',
                endLocation: endLoc,
                updatedAt: serverTimestamp()
            });

            toast({ title: 'Success', description: 'Travel log completed.' });
            setClosingLog(null);
            setCloseEndKm('');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to close log.' });
        } finally {
            setIsSubmittingTravel(false);
        }
    };

    const handleTravelSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingTravel(true);
        try {
            const start = parseFloat(travelForm.startKm);
            let end = null;
            let distance = null;
            let status = 'In Progress';
            
            toast({ description: 'Acquiring GPS location...' });
            const startLoc = await getCurrentLocation();
            let endLoc = null;

            if (travelForm.endKm && travelForm.endKm.trim() !== '') {
                end = parseFloat(travelForm.endKm);
                distance = end - start;
                if (distance < 0) {
                    toast({ variant: 'destructive', title: 'Invalid KMs', description: 'End KM cannot be less than Start KM.' });
                    setIsSubmittingTravel(false);
                    return;
                }
                status = 'Completed';
                endLoc = startLoc; // if completed immediately, end location is the same
            }

            const tech = usersList?.find(u => u.id === travelForm.technicianId);

            await addDoc(collection(firestore, 'vehicle_travel_logs'), {
                vehicleName: travelForm.vehicleName,
                date: travelForm.date,
                technicianId: travelForm.technicianId,
                technicianName: tech ? tech.name : 'Unknown',
                startKm: start,
                endKm: end,
                distance: distance,
                destination: travelForm.destination,
                reason: travelForm.reason,
                status: status,
                startLocation: startLoc,
                endLocation: endLoc,
                createdAt: serverTimestamp(),
                createdBy: user?.uid
            });

            toast({ title: 'Success', description: 'Travel log saved successfully.' });
            setIsTravelDialogOpen(false);
            setTravelForm({
                vehicleName: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                technicianId: '',
                startKm: '',
                endKm: '',
                destination: '',
                reason: ''
            });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save travel log.' });
        } finally {
            setIsSubmittingTravel(false);
        }
    };

    const handleExpenseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingExpense(true);
        try {
            await addDoc(collection(firestore, 'vehicle_expenses'), {
                vehicleName: expenseForm.vehicleName,
                date: expenseForm.date,
                expenseType: expenseForm.expenseType,
                amount: parseFloat(expenseForm.amount),
                description: expenseForm.description,
                createdAt: serverTimestamp(),
                createdBy: user?.uid
            });

            toast({ title: 'Success', description: 'Expense saved successfully.' });
            setIsExpenseDialogOpen(false);
            setExpenseForm({
                vehicleName: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                expenseType: '',
                amount: '',
                description: ''
            });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save expense.' });
        } finally {
            setIsSubmittingExpense(false);
        }
    };

    const handleDelete = async (collectionName: string, id: string) => {
        if (confirm('Are you sure you want to delete this record?')) {
            await deleteDocumentNonBlocking(doc(firestore, collectionName, id));
            toast({ title: 'Deleted', description: 'Record has been removed.' });
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vehicle Logbook</h1>
                    <p className="text-muted-foreground">Manage site vehicle travel logs and expenses.</p>
                </div>
            </header>

            <Tabs defaultValue="travel" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="travel">Travel Logs</TabsTrigger>
                    <TabsTrigger value="expenses">Expenses</TabsTrigger>
                </TabsList>

                {/* TRAVEL LOGS TAB */}
                <TabsContent value="travel" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Travel History</CardTitle>
                                <CardDescription>Record of all vehicle trips.</CardDescription>
                            </div>
                            <Dialog open={isTravelDialogOpen} onOpenChange={setIsTravelDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2"><Car className="h-4 w-4" /> Log Travel</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Log Vehicle Travel</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleTravelSubmit} className="space-y-4 py-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Vehicle</Label>
                                                <Select value={travelForm.vehicleName} onValueChange={(val) => setTravelForm({...travelForm, vehicleName: val})} required>
                                                    <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                                                    <SelectContent>
                                                        {VEHICLES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Date</Label>
                                                <Input type="date" value={travelForm.date} onChange={(e) => setTravelForm({...travelForm, date: e.target.value})} required />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Technician / Driver</Label>
                                            <Select value={travelForm.technicianId} onValueChange={(val) => setTravelForm({...travelForm, technicianId: val})} required>
                                                <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                                                <SelectContent>
                                                    {usersList?.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Start KM</Label>
                                                <Input type="number" step="0.1" value={travelForm.startKm} onChange={(e) => setTravelForm({...travelForm, startKm: e.target.value})} required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>End KM (Optional)</Label>
                                                <Input type="number" step="0.1" value={travelForm.endKm} onChange={(e) => setTravelForm({...travelForm, endKm: e.target.value})} placeholder="Leave blank if in progress" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Destination</Label>
                                            <Input value={travelForm.destination} onChange={(e) => setTravelForm({...travelForm, destination: e.target.value})} required placeholder="e.g. Site A, Supplier X" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Reason for Travel</Label>
                                            <Textarea value={travelForm.reason} onChange={(e) => setTravelForm({...travelForm, reason: e.target.value})} required placeholder="e.g. Collect spares, site maintenance" />
                                        </div>
                                        <DialogFooter>
                                            <Button type="button" variant="outline" onClick={() => setIsTravelDialogOpen(false)}>Cancel</Button>
                                            <Button type="submit" disabled={isSubmittingTravel}>
                                                {isSubmittingTravel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                                Save Travel Log
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Vehicle</TableHead>
                                        <TableHead>Driver</TableHead>
                                        <TableHead>Destination</TableHead>
                                        <TableHead>Distance (KM)</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingTravel ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                                    ) : travelLogs && travelLogs.length > 0 ? (
                                        travelLogs.map(log => (
                                            <TableRow key={log.id}>
                                                <TableCell>{log.date}</TableCell>
                                                <TableCell className="font-medium">{log.vehicleName}</TableCell>
                                                <TableCell>{log.technicianName}</TableCell>
                                                <TableCell>
                                                    <div>{log.destination}</div>
                                                    <div className="text-xs text-muted-foreground line-clamp-1">{log.reason}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {log.status === 'Completed' ? (
                                                        <>
                                                            <div className="font-medium">{log.distance} km</div>
                                                            <div className="text-xs text-muted-foreground">{log.startKm} - {log.endKm}</div>
                                                        </>
                                                    ) : (
                                                        <div className="font-medium text-orange-500">In Progress (Start: {log.startKm} km)</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right flex items-center justify-end gap-2">
                                                    {canViewGPS && log.startLocation && (
                                                        <a href={`https://www.google.com/maps/search/?api=1&query=${log.startLocation.lat},${log.startLocation.lng}`} target="_blank" rel="noopener noreferrer">
                                                            <Button variant="ghost" size="icon" title="View Start Location">
                                                                <MapPin className="h-4 w-4 text-blue-500" />
                                                            </Button>
                                                        </a>
                                                    )}
                                                    {log.status !== 'Completed' && (
                                                        <Dialog open={closingLog?.id === log.id} onOpenChange={(open) => !open && setClosingLog(null)}>
                                                            <DialogTrigger asChild>
                                                                <Button variant="outline" size="sm" onClick={() => setClosingLog(log)}>Close Log</Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-sm">
                                                                <DialogHeader>
                                                                    <DialogTitle>Complete Travel Log</DialogTitle>
                                                                </DialogHeader>
                                                                <form onSubmit={handleCloseLog} className="space-y-4 py-4">
                                                                    <div className="space-y-2">
                                                                        <Label>Final End KM</Label>
                                                                        <Input type="number" step="0.1" value={closeEndKm} onChange={e => setCloseEndKm(e.target.value)} required autoFocus />
                                                                        <p className="text-xs text-muted-foreground">Start KM was: {log.startKm}</p>
                                                                    </div>
                                                                    <DialogFooter>
                                                                        <Button type="button" variant="ghost" onClick={() => setClosingLog(null)}>Cancel</Button>
                                                                        <Button type="submit" disabled={isSubmittingTravel}>
                                                                            {isSubmittingTravel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                                            Save & Close
                                                                        </Button>
                                                                    </DialogFooter>
                                                                </form>
                                                            </DialogContent>
                                                        </Dialog>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('vehicle_travel_logs', log.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No travel logs recorded yet.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* EXPENSES TAB */}
                <TabsContent value="expenses" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Vehicle Expenses</CardTitle>
                                <CardDescription>Track fuel, maintenance, and toll costs.</CardDescription>
                            </div>
                            <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2"><Fuel className="h-4 w-4" /> Log Expense</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Log Vehicle Expense</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleExpenseSubmit} className="space-y-4 py-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Vehicle</Label>
                                                <Select value={expenseForm.vehicleName} onValueChange={(val) => setExpenseForm({...expenseForm, vehicleName: val})} required>
                                                    <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                                                    <SelectContent>
                                                        {VEHICLES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Date</Label>
                                                <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})} required />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Expense Type</Label>
                                                <Select value={expenseForm.expenseType} onValueChange={(val) => setExpenseForm({...expenseForm, expenseType: val})} required>
                                                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                                                    <SelectContent>
                                                        {EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Amount (R)</Label>
                                                <Input type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} required placeholder="e.g. 500.00" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Description</Label>
                                            <Textarea value={expenseForm.description} onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} required placeholder="e.g. Filled up tank at Shell" />
                                        </div>
                                        <DialogFooter>
                                            <Button type="button" variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>Cancel</Button>
                                            <Button type="submit" disabled={isSubmittingExpense}>
                                                {isSubmittingExpense ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                                Save Expense
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Vehicle</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingExpenses ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                                    ) : expenses && expenses.length > 0 ? (
                                        expenses.map(expense => (
                                            <TableRow key={expense.id}>
                                                <TableCell>{expense.date}</TableCell>
                                                <TableCell className="font-medium">{expense.vehicleName}</TableCell>
                                                <TableCell>{expense.expenseType}</TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={expense.description}>{expense.description}</TableCell>
                                                <TableCell className="text-right font-medium">R {expense.amount.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('vehicle_expenses', expense.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No expenses recorded yet.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
