
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function ReportsPage() {
    const firestore = useFirestore();
    const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
    const { data: equipment, isLoading } = useCollection<Equipment>(equipmentQuery);

    const divisionSummary = useMemo(() => {
        if (!equipment) return [];
        
        const divisions: { [key: string]: { totalUptime: number; totalPower: number; count: number } } = {};

        equipment.forEach(eq => {
            if (!eq.division) return;
            
            const key = `${eq.plant} - ${eq.division}`;
            if (!divisions[key]) {
                divisions[key] = { totalUptime: 0, totalPower: 0, count: 0 };
            }
            
            divisions[key].totalUptime += eq.uptime || 0;
            divisions[key].totalPower += eq.powerConsumption || 0;
            divisions[key].count += 1;
        });

        return Object.keys(divisions).map(key => ({
            name: key,
            uptime: divisions[key].count > 0 ? parseFloat((divisions[key].totalUptime / divisions[key].count).toFixed(2)) : 0,
            power: parseFloat((divisions[key].totalPower / 1000).toFixed(2)), // Convert to MWh
        })).sort((a, b) => a.name.localeCompare(b.name));

    }, [equipment]);

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
                <p className="text-muted-foreground">
                    High-level performance and maintenance reports by division.
                </p>
            </header>

            <div className="grid gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Average Uptime by Division</CardTitle>
                        <CardDescription>Comparing the average equipment uptime percentage for each division.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                            <ChartContainer config={uptimeChartConfig} className="min-h-[200px] w-full">
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart accessibilityLayer data={divisionSummary} margin={{ top: 20, right: 20, bottom: 100, left: 20 }}>
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
                        <CardTitle>Total Power Consumption by Division</CardTitle>
                        <CardDescription>Comparing the total energy usage (in Megawatt-hours) for each division.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                            <ChartContainer config={powerChartConfig} className="min-h-[200px] w-full">
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart accessibilityLayer data={divisionSummary} margin={{ top: 20, right: 20, bottom: 100, left: 20 }}>
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
