'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import React, { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

// Helper to convert slug back to title case
function slugToTitle(slug: string) {
    if (!slug) return '';
    return decodeURIComponent(slug)
        .replace(/-/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

const chartConfig = {
    uptime: {
        label: 'Uptime (%)',
        color: 'hsl(var(--accent))',
    },
    power: {
        label: 'Power (MWh)',
        color: 'hsl(var(--primary))',
    },
};

export default function EquipmentReportPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    
    const plantSlug = Array.isArray(params.plant) ? params.plant[0] : params.plant;
    const divisionSlug = Array.isArray(params.division) ? params.division[0] : params.division;
    const locationSlug = Array.isArray(params.location) ? params.location[0] : params.location;

    const plantName = useMemo(() => slugToTitle(plantSlug), [plantSlug]);
    const divisionName = useMemo(() => slugToTitle(divisionSlug), [divisionSlug]);
    const locationName = useMemo(() => slugToTitle(locationSlug), [locationSlug]);

    const pageTitle = useMemo(() => {
        if (!plantName || !divisionName || !locationName) return 'Equipment Report';
        return `Report for: ${locationName}`;
    }, [plantName, divisionName, locationName]);

    const equipmentQuery = useMemoFirebase(() => {
        if (!plantName || !divisionName || !locationName) return null;
        return query(
            collection(firestore, 'equipment'),
            where('plant', '==', plantName),
            where('division', '==', divisionName),
            where('location', '==', locationName)
        );
    }, [firestore, plantName, divisionName, locationName]);

    const { data: equipmentList, isLoading } = useCollection<Equipment>(equipmentQuery);

    const chartData = useMemo(() => {
        if (!equipmentList) return [];
        return equipmentList.map(eq => ({
            name: eq.name,
            uptime: eq.uptime || 0,
            power: parseFloat(((eq.powerConsumption || 0) / 1000).toFixed(2)), // Convert to MWh
        })).sort((a,b) => a.name.localeCompare(b.name));
    }, [equipmentList]);

    return (
        <div className="flex flex-col gap-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
                    <p className="text-muted-foreground">
                        Performance breakdown for each piece of equipment.
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Division Report
                </Button>
            </header>

            <div className="grid gap-8">
                 <Card>
                    <CardHeader>
                        <CardTitle>Equipment Uptime</CardTitle>
                        <CardDescription>Uptime percentage for each piece of equipment in {locationName}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                                <ResponsiveContainer width="100%" height={Math.max(350, chartData.length * 25)}>
                                    <BarChart 
                                        accessibilityLayer 
                                        data={chartData} 
                                        layout="vertical"
                                        margin={{ top: 5, right: 20, bottom: 5, left: 150 }}
                                    >
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            width={150}
                                            interval={0}
                                            fontSize={12}
                                            stroke="hsl(var(--muted-foreground))"
                                        />
                                        <XAxis
                                            type="number"
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            fontSize={12}
                                            stroke="hsl(var(--muted-foreground))"
                                            domain={[dataMin => (Math.max(0, dataMin - 5)), 100]}
                                        />
                                        <ChartTooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                                        <Bar dataKey="uptime" fill="var(--color-uptime)" radius={4} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Equipment Power Consumption</CardTitle>
                         <CardDescription>Total power consumption (MWh) for each piece of equipment in {locationName}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                           <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                                <ResponsiveContainer width="100%" height={Math.max(350, chartData.length * 25)}>
                                    <BarChart 
                                        accessibilityLayer 
                                        data={chartData} 
                                        layout="vertical"
                                        margin={{ top: 5, right: 20, bottom: 5, left: 150 }}
                                    >
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            width={150}
                                            interval={0}
                                            fontSize={12}
                                            stroke="hsl(var(--muted-foreground))"
                                        />
                                        <XAxis
                                            type="number"
                                            tickLine={false} 
                                            axisLine={false} 
                                            tickMargin={8} 
                                            fontSize={12} 
                                            stroke="hsl(var(--muted-foreground))" 
                                            tickFormatter={(value) => `${value.toLocaleString()}`}
                                        />
                                        <ChartTooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                                        <Bar dataKey="power" fill="var(--color-power)" radius={4} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
