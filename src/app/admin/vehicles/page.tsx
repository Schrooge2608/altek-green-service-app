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
import { Plus, Car, Fuel, Loader2, Trash2, MapPin, Pencil } from 'lucide-react';
import { useCollection, useFirestore, useUser, deleteDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, updateDoc, serverTimestamp, doc } from 'firebase/firestore';
import type { VehicleTravelLog, VehicleExpense, User, Vehicle } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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

    const vehiclesQuery = useMemoFirebase(() => query(collection(firestore, 'vehicles'), orderBy('name', 'asc')), [firestore]);
    const { data: vehiclesList, isLoading: loadingVehicles } = useCollection<Vehicle>(vehiclesQuery);

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
        liters: '',
        description: ''
    });
    const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

    // State for Vehicle Dialog
    const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [vehicleForm, setVehicleForm] = useState({
        name: '',
        registration: '',
        makeModel: '',
        year: '',
        status: 'Active'
    });
    const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);

    // State for Closing Travel Log
    const [closingLog, setClosingLog] = useState<VehicleTravelLog | null>(null);
    const [closeEndKm, setCloseEndKm] = useState('');

    // State for Travel History Tab
    const [selectedHistoryVehicle, setSelectedHistoryVehicle] = useState<Vehicle | null>(null);

    // State for Expense History Tab
    const [selectedExpenseVehicle, setSelectedExpenseVehicle] = useState<Vehicle | null>(null);

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

    const globalStats = {
        totalDistance: travelLogs?.filter(l => l.status === 'Completed' && l.distance).reduce((acc, log) => acc + (log.distance || 0), 0) || 0,
        totalCost: expenses?.reduce((acc, e) => acc + e.amount, 0) || 0
    };

    const calculateVehicleStats = (vehicleName: string) => {
        const vLogs = travelLogs?.filter(l => l.vehicleName === vehicleName && l.status === 'Completed' && l.distance) || [];
        const vExpenses = expenses?.filter(e => e.vehicleName === vehicleName) || [];
        const totalDistance = vLogs.reduce((acc, log) => acc + (log.distance || 0), 0);
        const totalFuelExpenses = vExpenses.filter(e => e.expenseType === 'Fuel' && e.liters);
        const totalLiters = totalFuelExpenses.reduce((acc, e) => acc + (e.liters || 0), 0);
        const totalCost = vExpenses.reduce((acc, e) => acc + e.amount, 0);
        const kmPerLiter = totalLiters > 0 ? (totalDistance / totalLiters).toFixed(2) : '0.00';
        return { totalDistance, totalLiters, kmPerLiter, totalCost };
    };

    const handleVehicleChange = (val: string) => {
        let latestEndKm = '';
        if (travelLogs) {
            const vehicleLogs = travelLogs.filter(log => log.vehicleName === val);
            const lastCompletedLog = vehicleLogs.find(log => log.endKm !== undefined && log.endKm !== null);
            if (lastCompletedLog && lastCompletedLog.endKm !== null) {
                latestEndKm = lastCompletedLog.endKm.toString();
            }
        }
        
        setTravelForm(prev => ({
            ...prev,
            vehicleName: val,
            startKm: latestEndKm
        }));
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
            const amount = parseFloat(expenseForm.amount);
            let liters = null;
            let rate = null;
            if (expenseForm.expenseType === 'Fuel' && expenseForm.liters) {
                liters = parseFloat(expenseForm.liters);
                if (liters > 0) {
                    rate = amount / liters;
                }
            }

            const data: any = {
                vehicleName: expenseForm.vehicleName,
                date: expenseForm.date,
                expenseType: expenseForm.expenseType,
                amount: amount,
                description: expenseForm.description,
                createdAt: serverTimestamp(),
                createdBy: user?.uid
            };

            if (liters) {
                data.liters = liters;
                data.rate = rate;
            }

            await addDoc(collection(firestore, 'vehicle_expenses'), data);

            toast({ title: 'Success', description: 'Expense saved successfully.' });
            setIsExpenseDialogOpen(false);
            setExpenseForm({
                vehicleName: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                expenseType: '',
                amount: '',
                liters: '',
                description: ''
            });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save expense.' });
        } finally {
            setIsSubmittingExpense(false);
        }
    };

    const handleVehicleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingVehicle(true);
        try {
            if (editingVehicle) {
                await updateDoc(doc(firestore, 'vehicles', editingVehicle.id), {
                    name: vehicleForm.name,
                    registration: vehicleForm.registration,
                    makeModel: vehicleForm.makeModel,
                    year: vehicleForm.year,
                    status: vehicleForm.status,
                    updatedAt: serverTimestamp(),
                    updatedBy: user?.uid
                });
                toast({ title: 'Success', description: 'Vehicle updated successfully.' });
            } else {
                await addDoc(collection(firestore, 'vehicles'), {
                    name: vehicleForm.name,
                    registration: vehicleForm.registration,
                    makeModel: vehicleForm.makeModel,
                    year: vehicleForm.year,
                    status: vehicleForm.status,
                    createdAt: serverTimestamp(),
                    createdBy: user?.uid
                });
                toast({ title: 'Success', description: 'Vehicle saved successfully.' });
            }

            setIsVehicleDialogOpen(false);
            setEditingVehicle(null);
            setVehicleForm({
                name: '',
                registration: '',
                makeModel: '',
                year: '',
                status: 'Active'
            });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save vehicle.' });
        } finally {
            setIsSubmittingVehicle(false);
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
                <TabsList className={`grid w-full ${canViewGPS ? 'grid-cols-4 max-w-[800px]' : 'grid-cols-3 max-w-[600px]'}`}>
                    <TabsTrigger value="travel">Travel Logs</TabsTrigger>
                    <TabsTrigger value="history">Travel History</TabsTrigger>
                    <TabsTrigger value="expenses">Expenses</TabsTrigger>
                    {canViewGPS && <TabsTrigger value="fleet">Fleet Management</TabsTrigger>}
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
                                                <Select value={travelForm.vehicleName} onValueChange={handleVehicleChange} required>
                                                    <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                                                    <SelectContent>
                                                        {vehiclesList?.map(v => <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>)}
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

                {/* TRAVEL HISTORY TAB */}
                <TabsContent value="history" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {selectedHistoryVehicle ? (
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedHistoryVehicle(null)}>← Back</Button>
                                        History for {selectedHistoryVehicle.name}
                                    </div>
                                ) : 'Vehicle History'}
                            </CardTitle>
                            <CardDescription>
                                {selectedHistoryVehicle ? 'Detailed travel logs for this vehicle.' : 'Select a vehicle to view its complete log sheet.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!selectedHistoryVehicle ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {vehiclesList?.map(v => (
                                        <Card key={v.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedHistoryVehicle(v)}>
                                            <CardContent className="p-6 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-primary/10 p-3 rounded-full">
                                                        <Car className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold">{v.name}</h3>
                                                        <p className="text-sm text-muted-foreground">{v.registration || 'No Reg'}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    {!vehiclesList?.length && !loadingVehicles && (
                                        <div className="col-span-full text-center py-8 text-muted-foreground">No vehicles found.</div>
                                    )}
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Driver</TableHead>
                                            <TableHead>Destination & Reason</TableHead>
                                            <TableHead>Distance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {travelLogs?.filter(log => log.vehicleName === selectedHistoryVehicle.name).length ? (
                                            travelLogs.filter(log => log.vehicleName === selectedHistoryVehicle.name).map(log => (
                                                <TableRow key={log.id}>
                                                    <TableCell>{log.date}</TableCell>
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
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No travel logs found for this vehicle.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* EXPENSES TAB */}
                <TabsContent value="expenses" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>
                                    {selectedExpenseVehicle ? (
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedExpenseVehicle(null)}>← Back</Button>
                                            Expenses for {selectedExpenseVehicle.name}
                                        </div>
                                    ) : 'Vehicle Expenses'}
                                </CardTitle>
                                <CardDescription>
                                    {selectedExpenseVehicle ? 'Cost and consumption tracking for this vehicle.' : 'Select a vehicle to view its expense history.'}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-6">
                                {!selectedExpenseVehicle && (
                                    <div className="hidden md:flex gap-6 items-center px-4 bg-muted/30 p-2 rounded-lg border">
                                        <div className="text-right">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Fleet Distance</div>
                                            <div className="text-lg font-bold text-primary">{globalStats.totalDistance.toFixed(1)} km</div>
                                        </div>
                                        <div className="h-8 w-px bg-border"></div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Fleet Expenses</div>
                                            <div className="text-lg font-bold text-destructive">R {globalStats.totalCost.toFixed(2)}</div>
                                        </div>
                                    </div>
                                )}
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
                                                        {vehiclesList?.map(v => <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>)}
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
                                        {expenseForm.expenseType === 'Fuel' && (
                                            <div className="space-y-2">
                                                <Label>Liters (Optional)</Label>
                                                <Input type="number" step="0.01" value={expenseForm.liters} onChange={(e) => setExpenseForm({...expenseForm, liters: e.target.value})} placeholder="e.g. 50.5" />
                                                {expenseForm.amount && expenseForm.liters && parseFloat(expenseForm.liters) > 0 && (
                                                    <p className="text-xs text-muted-foreground mt-1">Calculated Rate: R {(parseFloat(expenseForm.amount) / parseFloat(expenseForm.liters)).toFixed(2)} / Liter</p>
                                                )}
                                            </div>
                                        )}
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
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!selectedExpenseVehicle ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {vehiclesList?.map(v => (
                                        <Card key={v.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedExpenseVehicle(v)}>
                                            <CardContent className="p-6 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-primary/10 p-3 rounded-full">
                                                        <Car className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold">{v.name}</h3>
                                                        <p className="text-sm text-muted-foreground">{v.registration || 'No Reg'}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    {!vehiclesList?.length && !loadingVehicles && (
                                        <div className="col-span-full text-center py-8 text-muted-foreground">No vehicles found.</div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Stats Summary */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="text-sm text-muted-foreground">Total Distance</div>
                                                <div className="text-xl font-bold">{calculateVehicleStats(selectedExpenseVehicle.name).totalDistance.toFixed(1)} km</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="text-sm text-muted-foreground">Total Fuel</div>
                                                <div className="text-xl font-bold">{calculateVehicleStats(selectedExpenseVehicle.name).totalLiters.toFixed(2)} L</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="text-sm text-muted-foreground">Consumption</div>
                                                <div className="text-xl font-bold">{calculateVehicleStats(selectedExpenseVehicle.name).kmPerLiter} km/L</div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="text-sm text-muted-foreground">Total Cost</div>
                                                <div className="text-xl font-bold">R {calculateVehicleStats(selectedExpenseVehicle.name).totalCost.toFixed(2)}</div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Expenses Table */}
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loadingExpenses ? (
                                                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                                            ) : expenses && expenses.filter(e => e.vehicleName === selectedExpenseVehicle.name).length > 0 ? (
                                                expenses.filter(e => e.vehicleName === selectedExpenseVehicle.name).map(expense => (
                                                    <TableRow key={expense.id}>
                                                        <TableCell>{expense.date}</TableCell>
                                                        <TableCell>{expense.expenseType}</TableCell>
                                                        <TableCell className="max-w-[200px] truncate" title={expense.description}>{expense.description}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="font-medium">R {expense.amount.toFixed(2)}</div>
                                                            {expense.expenseType === 'Fuel' && expense.liters && (
                                                                <div className="text-xs text-muted-foreground">{expense.liters} L @ R {(expense.amount / expense.liters).toFixed(2)}/L</div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('vehicle_expenses', expense.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No expenses recorded for this vehicle.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* FLEET MANAGEMENT TAB */}
                {canViewGPS && (
                    <TabsContent value="fleet" className="mt-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Fleet Vehicles</CardTitle>
                                    <CardDescription>Manage available vehicles for logging.</CardDescription>
                                </div>
                                <Dialog open={isVehicleDialogOpen} onOpenChange={setIsVehicleDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="gap-2" onClick={() => {
                                            setEditingVehicle(null);
                                            setVehicleForm({
                                                name: '',
                                                registration: '',
                                                makeModel: '',
                                                year: '',
                                                status: 'Active'
                                            });
                                        }}>
                                            <Plus className="h-4 w-4" /> Add Vehicle
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleVehicleSubmit} className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Name / Alias</Label>
                                                <Input value={vehicleForm.name} onChange={(e) => setVehicleForm({...vehicleForm, name: e.target.value})} required placeholder="e.g. NP 200, Hilux" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Registration Number</Label>
                                                <Input value={vehicleForm.registration} onChange={(e) => setVehicleForm({...vehicleForm, registration: e.target.value})} required placeholder="e.g. NUR 12345" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Make & Model</Label>
                                                <Input value={vehicleForm.makeModel} onChange={(e) => setVehicleForm({...vehicleForm, makeModel: e.target.value})} required placeholder="e.g. Nissan NP200" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Year (Optional)</Label>
                                                    <Input value={vehicleForm.year} onChange={(e) => setVehicleForm({...vehicleForm, year: e.target.value})} placeholder="e.g. 2021" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Status</Label>
                                                    <Select value={vehicleForm.status} onValueChange={(val) => setVehicleForm({...vehicleForm, status: val})} required>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Active">Active</SelectItem>
                                                            <SelectItem value="Maintenance">Maintenance</SelectItem>
                                                            <SelectItem value="Inactive">Inactive</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button type="button" variant="outline" onClick={() => setIsVehicleDialogOpen(false)}>Cancel</Button>
                                                <Button type="submit" disabled={isSubmittingVehicle}>
                                                    {isSubmittingVehicle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                                    Save Vehicle
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
                                            <TableHead>Name / Alias</TableHead>
                                            <TableHead>Registration</TableHead>
                                            <TableHead>Make & Model</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingVehicles ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                                        ) : vehiclesList && vehiclesList.length > 0 ? (
                                            vehiclesList.map(vehicle => (
                                                <TableRow key={vehicle.id}>
                                                    <TableCell className="font-medium">{vehicle.name}</TableCell>
                                                    <TableCell>{vehicle.registration}</TableCell>
                                                    <TableCell>{vehicle.makeModel} {vehicle.year && `(${vehicle.year})`}</TableCell>
                                                    <TableCell>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                            vehicle.status === 'Active' ? 'bg-green-100 text-green-700' :
                                                            vehicle.status === 'Maintenance' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {vehicle.status}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => {
                                                            setEditingVehicle(vehicle);
                                                            setVehicleForm({
                                                                name: vehicle.name,
                                                                registration: vehicle.registration,
                                                                makeModel: vehicle.makeModel,
                                                                year: vehicle.year || '',
                                                                status: vehicle.status || 'Active'
                                                            });
                                                            setIsVehicleDialogOpen(true);
                                                        }}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('vehicles', vehicle.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No vehicles registered yet.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
