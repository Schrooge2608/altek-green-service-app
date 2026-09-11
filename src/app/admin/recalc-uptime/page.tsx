'use client';
import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RecalcUptimePage() {
    const [status, setStatus] = useState('Ready');
    const [loading, setLoading] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleRecalculate = async () => {
        setLoading(true);
        setStatus('Fetching all breakdowns...');
        console.clear();
        console.log("--- STARTING UPTIME RECALCULATION ---");

        try {
            // 1. Get all equipment first to reset everything
            const eqSnap = await getDocs(collection(firestore, 'equipment'));
            const equipmentIds = eqSnap.docs.map(doc => doc.id);
            const totals: Record<string, number> = {};
            
            // Initialize all equipment to 0 downtime
            equipmentIds.forEach(id => {
                totals[id] = 0;
            });

            // 2. Get all breakdowns
            const breakdownsSnap = await getDocs(collection(firestore, 'breakdown_reports'));
            console.log(`Found ${breakdownsSnap.size} breakdown reports.`);

            // 3. Sum up hours
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            breakdownsSnap.docs.forEach((snap) => {
                const data = snap.data();
                if (data.equipmentId && data.timeReported) {
                    try {
                        const reportDate = new Date(data.timeReported);
                        if (reportDate.getMonth() === currentMonth && reportDate.getFullYear() === currentYear) {
                            if (data.timeBackInService) {
                                const end = new Date(data.timeBackInService).getTime();
                                const start = reportDate.getTime();
                                if (!isNaN(start) && !isNaN(end) && end > start) {
                                    const hours = (end - start) / (1000 * 60 * 60);
                                    if (totals[data.equipmentId] === undefined) {
                                        totals[data.equipmentId] = 0;
                                    }
                                    totals[data.equipmentId] += hours;
                                }
                            } else {
                                const start = reportDate.getTime();
                                const end = now.getTime();
                                if (!isNaN(start) && end > start) {
                                    const hours = (end - start) / (1000 * 60 * 60);
                                    if (totals[data.equipmentId] === undefined) {
                                        totals[data.equipmentId] = 0;
                                    }
                                    totals[data.equipmentId] += hours;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn(`Could not parse dates for breakdown ${snap.id}`);
                    }
                }
            });
            
            // 4. Batch Update Equipment
            setStatus('Updating equipment records...');
            let batch = writeBatch(firestore);
            let count = 0;
            
            for (const [eqId, totalHours] of Object.entries(totals)) {
                console.log(`Queueing update for ${eqId}: ${totalHours.toFixed(2)} hours downtime`);
                const ref = doc(firestore, 'equipment', eqId);
                batch.update(ref, { totalDowntimeHours: totalHours });
                count++;
                
                // Firestore batches are limited to 500 operations
                if (count % 450 === 0) {
                     await batch.commit();
                     console.log(`Committed batch of 450...`);
                     batch = writeBatch(firestore);
                }
            }

            if (count > 0) {
                await batch.commit();
                setStatus(`Success! Recalculated uptime for ${count} machines.`);
                toast({
                    title: "Recalculation Complete",
                    description: `Successfully updated downtime for ${count} pieces of equipment.`,
                });
            } else {
                setStatus("No downtime found in breakdown history.");
                 toast({
                    title: "No Data",
                    description: "No valid downtime periods were found in the breakdown history.",
                });
            }
        } catch (error: any) {
            console.error("Uptime recalculation failed:", error);
            setStatus("Error recalculating. See console for details.");
            toast({
                variant: 'destructive',
                title: 'Recalculation Failed',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Recalculate Uptime</h1>
                <p className="text-muted-foreground">
                    A one-time tool to fix historical uptime data based on breakdown logs.
                </p>
            </header>
            <Card>
                <CardHeader>
                    <CardTitle>Bulk Uptime Calculation</CardTitle>
                    <CardDescription>
                        This will scan all breakdown reports, calculate total downtime for each piece of equipment, and update the master equipment records.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-start space-y-4">
                        <Button onClick={handleRecalculate} disabled={loading}>
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Zap className="mr-2 h-4 w-4" />
                            )}
                            {loading ? 'Calculating...' : 'Start Recalculation'}
                        </Button>
                        <p className="text-sm text-muted-foreground">
                            Status: <span className="font-medium text-foreground">{status}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                            This can take a moment. Check the browser console (F12) for detailed progress.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
