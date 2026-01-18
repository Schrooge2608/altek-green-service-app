
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
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
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

const getUptimeColor = (uptime: number) => {
    if (uptime < 80) {
      return 'hsl(var(--destructive))'; // Red for critical
    }
    if (uptime < 90) {
      return '#FFC000'; // Orange for warning
    }
    if (uptime < 95) {
      return '#FFFF00'; // Yellow for caution
    }
    if (uptime < 100) {
      return '#92D050'; // Light Green for good
    }
    return 'hsl(var(--accent))'; // Dark Green for excellent
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
    const locationName = useMemo(() => decodeURIComponent(locationSlug), [locationSlug]);

    const pageTitle = useMemo(() => {
        if (!plantName || !divisionName || !locationName) return 'Equipment Report';
        // For display purposes, uppercase short location names as they are likely acronyms.
        const displayLocation = locationName.length <= 4 ? locationName.toUpperCase() : locationName;
        return `Report for: ${displayLocation}`;
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
            id: eq.id,
            name: eq.name,
            uptime: eq.uptime || 0,
            power: parseFloat(((eq.powerConsumption || 0) / 1000).toFixed(2)), // Convert to MWh
        })).sort((a,b) => a.name.localeCompare(b.name));
    }, [equipmentList]);
    
    const handleBarClick = (data: any) => {
        if (data && data.activePayload && data.activePayload.length > 0) {
            const payload = data.activePayload[0].payload;
            const equipmentId = payload.id;
            if (equipmentId) {
                router.push(`/equipment/${equipmentId}`);
            }
        }
    };

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
                    Back
                </Button>
            </header>

            <div className="grid gap-8">
                 <Card>
                    <CardHeader>
                        <CardTitle>Equipment Uptime</CardTitle>
                        <CardDescription>Click a bar to view equipment details. Uptime percentage for each piece of equipment in {locationName.length <= 4 ? locationName.toUpperCase() : locationName}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart
                                        accessibilityLayer
                                        data={chartData}
                                        margin={{ top: 20, right: 20, bottom: 100, left: 20 }}
                                        onClick={handleBarClick}
                                        className="[&_.recharts-bar-rectangle]:cursor-pointer"
                                    >
                                        <XAxis
                                            dataKey="name"
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            angle={-45}
                                            textAnchor="end"
                                            interval={0}
                                            fontSize={12}
                                            stroke="hsl(var(--muted-foreground))"
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            fontSize={12}
                                            stroke="hsl(var(--muted-foreground))"
                                            domain={[0, 100]}
                                            ticks={[0, 20, 40, 60, 80, 85, 90, 95, 100]}
                                            tickFormatter={(value) => `${value}%`}
                                        />
                                        <ChartTooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                                        <Bar dataKey="uptime" radius={4}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={getUptimeColor(entry.uptime)} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Equipment Power Consumption</CardTitle>
                         <CardDescription>Click a bar to view equipment details. Total power consumption (MWh) for each piece of equipment in {locationName.length <= 4 ? locationName.toUpperCase() : locationName}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                           <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart
                                        accessibilityLayer
                                        data={chartData}
                                        margin={{ top: 20, right: 20, bottom: 100, left: 20 }}
                                        onClick={handleBarClick}
                                        className="[&_.recharts-bar-rectangle]:cursor-pointer"
                                    >
                                        <XAxis
                                            dataKey="name"
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            angle={-45}
                                            textAnchor="end"
                                            interval={0}
                                            fontSize={12}
                                            stroke="hsl(var(--muted-foreground))"
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            fontSize={12}
                                            stroke="hsl(var(--muted-foreground))"
                                            tickFormatter={(value) => `${value.toLocaleString()}`}
                                            label={{ value: 'MWh', position: 'insideLeft', angle: -90, dy: 0, dx: -10, fill: 'hsl(var(--muted-foreground))' }}
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
