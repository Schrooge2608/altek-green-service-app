
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
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

// Helper to convert slug back to title case
function slugToTitle(slug: string) {
    if (!slug) return '';
    return slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

// Config for Uptime chart
const uptimeChartConfig = {
    uptime: {
        label: 'Avg. Uptime (%)',
        color: 'hsl(var(--accent))',
    },
};

// Config for Power Consumption chart
const powerChartConfig = {
    power: {
        label: 'Total Power (MWh)',
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


export default function DivisionReportPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    
    const plantSlug = Array.isArray(params.plant) ? params.plant[0] : params.plant;
    const divisionSlug = Array.isArray(params.division) ? params.division[0] : params.division;

    const plantName = useMemo(() => slugToTitle(plantSlug), [plantSlug]);
    const divisionName = useMemo(() => slugToTitle(divisionSlug), [divisionSlug]);

    const pageTitle = useMemo(() => {
        if (!plantName || !divisionName) return 'Detailed Report';
        return `Report for: ${plantName} - ${divisionName}`;
    }, [plantName, divisionName]);

    const equipmentQuery = useMemoFirebase(() => {
        if (!plantName || !divisionName) return null;
        return query(
            collection(firestore, 'equipment'),
            where('plant', '==', plantName),
            where('division', '==', divisionName)
        );
    }, [firestore, plantName, divisionName]);

    const { data: equipment, isLoading } = useCollection<Equipment>(equipmentQuery);

    const handleBarClick = (data: any) => {
        if (data && data.activePayload && data.activePayload.length > 0) {
            const payload = data.activePayload[0].payload;
            const locationName = payload.name;
            // Create a URL-friendly slug from the location name, preserving case.
            const locationSlug = encodeURIComponent(locationName);
            
            router.push(`/reports/${plantSlug}/${divisionSlug}/${locationSlug}`);
        }
    };

    const locationSummary = useMemo(() => {
        if (!equipment) return [];
        
        const locations: { [key: string]: { totalUptime: number; totalPower: number; count: number } } = {};

        equipment.forEach(eq => {
            if (!eq.location) return;
            
            const key = eq.location;
            if (!locations[key]) {
                locations[key] = { totalUptime: 0, totalPower: 0, count: 0 };
            }
            
            locations[key].totalUptime += eq.uptime || 0;
            locations[key].totalPower += eq.powerConsumption || 0;
            locations[key].count += 1;
        });

        return Object.keys(locations).map(key => ({
            name: key,
            uptime: locations[key].count > 0 ? parseFloat((locations[key].totalUptime / locations[key].count).toFixed(2)) : 0,
            power: parseFloat((locations[key].totalPower / 1000).toFixed(2)), // Convert to MWh
        })).sort((a, b) => a.name.localeCompare(b.name));

    }, [equipment]);

    const showCharts = true;

    return (
        <div className="flex flex-col gap-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
                    <p className="text-muted-foreground">
                        Detailed performance breakdown by sub-location.
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
            </header>

            {showCharts ? (
                 <div className="grid gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Average Uptime by Sub-Location</CardTitle>
                            <CardDescription>Click any bar to view a detailed equipment performance chart for that location.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                                <ChartContainer config={uptimeChartConfig} className="min-h-[200px] w-full">
                                    <ResponsiveContainer width="100%" height={350}>
                                        <BarChart 
                                            accessibilityLayer 
                                            data={locationSummary} 
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
                                                {locationSummary.map((entry, index) => (
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
                            <CardTitle>Total Power Consumption by Sub-Location</CardTitle>
                            <CardDescription>Click any bar to view a detailed equipment performance chart for that location.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                                <ChartContainer config={powerChartConfig} className="min-h-[200px] w-full">
                                    <ResponsiveContainer width="100%" height={350}>
                                        <BarChart 
                                            accessibilityLayer 
                                            data={locationSummary} 
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
            ) : (
                <Card className="flex flex-col items-center justify-center text-center p-8 gap-4 min-h-[400px]">
                    <CardHeader>
                        <CardTitle>Detailed Charts Coming Soon</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground max-w-md">
                            Detailed performance charts for {slugToTitle(divisionSlug)} will be available in a future update.
                        </p>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
