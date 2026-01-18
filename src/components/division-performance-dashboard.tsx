'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Building, Pickaxe } from 'lucide-react';

const uptimeChartConfig = {
    uptime: {
        label: 'Avg. Uptime (%)',
    },
};

const powerChartConfig = {
    power: {
        label: 'Total Power (MWh)',
        color: 'hsl(var(--primary))',
    },
};

const getUptimeColor = (uptime: number) => {
    if (uptime < 60) return '#C00000';
    if (uptime < 80) return '#EE0000';
    if (uptime < 90) return '#FFC000';
    if (uptime < 95) return '#FFFF00';
    if (uptime < 100) return '#92D050';
    return 'hsl(var(--accent))';
};

interface DivisionPerformanceDashboardProps {
    plantName: 'Mining' | 'Smelter';
}

export function DivisionPerformanceDashboard({ plantName }: DivisionPerformanceDashboardProps) {
    const firestore = useFirestore();
    const router = useRouter();

    const equipmentQuery = useMemoFirebase(() => {
        return query(collection(firestore, 'equipment'), where('plant', '==', plantName));
    }, [firestore, plantName]);

    const { data: equipment, isLoading } = useCollection<Equipment>(equipmentQuery);

    const divisionSummary = useMemo(() => {
        if (!equipment) return [];
        
        const divisions: { [key: string]: { totalUptime: number; totalPower: number; count: number } } = {};

        equipment.forEach(eq => {
            if (!eq.division) return;
            
            const key = eq.division; // Only group by division now
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

    const handleBarClick = (data: any) => {
        if (data && data.activePayload && data.activePayload.length > 0) {
            const payload = data.activePayload[0].payload;
            const division = payload.name;
            
            const plantSlug = plantName.toLowerCase();
            const divisionSlug = division.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
            
            router.push(`/reports/${plantSlug}/${divisionSlug}`);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {plantName === 'Mining' ? <Pickaxe className="h-6 w-6 text-primary" /> : <Building className="h-6 w-6 text-primary" />}
                    {plantName} Plant Performance
                </CardTitle>
                <CardDescription>
                    Performance overview by division. Click a bar to see a detailed report.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Average Uptime by Division</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                            <ChartContainer config={uptimeChartConfig} className="min-h-[200px] w-full">
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart 
                                        accessibilityLayer 
                                        data={divisionSummary} 
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
                                            {divisionSummary.map((entry, index) => (
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
                        <CardTitle>Total Power Consumption by Division</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                            <ChartContainer config={powerChartConfig} className="min-h-[200px] w-full">
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart 
                                        accessibilityLayer 
                                        data={divisionSummary} 
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
            </CardContent>
        </Card>
    )
}
