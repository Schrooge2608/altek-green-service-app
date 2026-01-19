'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, FileText, Copy } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Equipment, Breakdown } from '@/lib/types';
import { generateReport } from '@/ai/flows/generate-report-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function GenerateReportPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedReport, setGeneratedReport] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
    const { data: equipmentList, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

    const breakdownQuery = useMemoFirebase(() => {
        if (!selectedEquipmentId) return null;
        return query(collection(firestore, 'breakdown_reports'), where('equipmentId', '==', selectedEquipmentId));
    }, [firestore, selectedEquipmentId]);

    const { data: breakdowns } = useCollection<Breakdown>(breakdownQuery);

    const handleCopy = () => {
        if (!generatedReport) return;
        navigator.clipboard.writeText(generatedReport);
        toast({ title: 'Report Copied', description: 'The report text has been copied to your clipboard.' });
    };

    const handleGenerateReport = async () => {
        if (!selectedEquipmentId) {
            toast({ variant: 'destructive', title: 'No Equipment Selected', description: 'Please select a piece of equipment to generate a report.' });
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedReport('');

        try {
            const selectedEquipment = equipmentList?.find(e => e.id === selectedEquipmentId);
            if (!selectedEquipment) throw new Error('Selected equipment not found.');

            const breakdownHistory = breakdowns?.map(b => 
                `- On ${b.date}, an issue was reported: "${b.description}". It was ${b.resolved ? `resolved, spending ${b.normalHours || 0} normal hours and ${b.overtimeHours || 0} overtime hours.` : 'is still pending.'}`
            ).join('\n') || 'No breakdown history available.';

            const result = await generateReport({
                equipmentName: selectedEquipment.name,
                breakdownHistory: breakdownHistory,
            });

            setGeneratedReport(result.report);
            toast({ title: 'Report Generated', description: 'The client-facing report has been created below.' });
        } catch (e: any) {
            console.error(e);
            setError('Failed to generate the report. The AI model may be temporarily unavailable.');
            toast({ variant: 'destructive', title: 'Generation Failed', description: e.message || 'An unknown error occurred.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">AI Report Generator</h1>
                <p className="text-muted-foreground">
                    Generate a client-friendly summary report for a piece of equipment.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Report Details</CardTitle>
                    <CardDescription>Select the equipment to generate a report for.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Select onValueChange={setSelectedEquipmentId} value={selectedEquipmentId} disabled={equipmentLoading}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select equipment..." />
                        </SelectTrigger>
                        <SelectContent>
                            {equipmentLoading ? (
                                <SelectItem value="loading" disabled>Loading equipment...</SelectItem>
                            ) : (
                                equipmentList?.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)
                            )}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleGenerateReport} disabled={isLoading || !selectedEquipmentId}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isLoading ? 'Generating...' : 'Generate Report'}
                    </Button>
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {generatedReport && (
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2"><FileText /> Generated Report</CardTitle>
                            <CardDescription>Review the report below. You can copy it to your clipboard.</CardDescription>
                        </div>
                        <Button variant="outline" onClick={handleCopy}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Report
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 bg-muted rounded-md border font-mono text-sm whitespace-pre-wrap">
                            {generatedReport}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
