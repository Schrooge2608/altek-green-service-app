
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
import { Building, Pickaxe, Cpu, Shield, Power, Activity, Zap } from 'lucide-react';

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
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const totalHoursInMonth = daysInMonth * 24;

        equipment.forEach(eq => {
            if (!eq.division) return;
            
            const key = eq.division;
            if (!divisions[key]) {
                divisions[key] = { totalUptime: 0, totalPower: 0, count: 0 };
            }

            const downtimeHours = eq.totalDowntimeHours || 0;
            const uptimeHours = totalHoursInMonth - downtimeHours;
            const currentUptime = Math.max(0, (uptimeHours / totalHoursInMonth) * 100);

            const runningHours = totalHoursInMonth - downtimeHours;
            const currentPowerConsumption = (eq.motorPower || 0) * runningHours;

            divisions[key].totalUptime += currentUptime;
            divisions[key].totalPower += currentPowerConsumption;
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

    const totalVSDs = equipment?.length ?? 0;
    const totalProtection = equipment?.filter(eq => eq.breakerAssetNumber).length ?? 0;
    const totalUps = equipment?.filter(eq => eq.upsModel).length ?? 0;

    const avgUptime = useMemo(() => {
        if (!equipment || equipment.length === 0) return 0;
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const totalHoursInMonth = daysInMonth * 24;

        const total = equipment.reduce((acc, eq) => {
            const downtimeHours = eq.totalDowntimeHours || 0;
            const uptimeHours = totalHoursInMonth - downtimeHours;
            const currentUptime = Math.max(0, (uptimeHours / totalHoursInMonth) * 100);
            return acc + currentUptime;
        }, 0);
        return total / equipment.length;
    }, [equipment]);
    
    const totalPowerConsumption = useMemo(() => {
        if (!equipment) return 0;
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const totalHoursInMonth = daysInMonth * 24;
        
        return equipment.reduce((acc, eq) => {
            const downtimeHours = eq.totalDowntimeHours || 0;
            const runningHours = totalHoursInMonth - downtimeHours;
            const currentPowerConsumption = (eq.motorPower || 0) * runningHours;
            return acc + currentPowerConsumption;
        }, 0);
    }, [equipment]);

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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total VSDs</CardTitle>
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-6 w-12" /> : <div className="text-2xl font-bold">{totalVSDs}</div>}
                            <p className="text-xs text-muted-foreground">Monitored controllers</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Protection</CardTitle>
                            <Shield className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-6 w-12" /> : <div className="text-2xl font-bold">{totalProtection}</div>}
                            <p className="text-xs text-muted-foreground">Protected units</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">UPS/BTUs</CardTitle>
                            <Power className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-6 w-12" /> : <div className="text-2xl font-bold">{totalUps}</div>}
                            <p className="text-xs text-muted-foreground">Backup units</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Avg. Uptime</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-6 w-20" /> : <div className="text-2xl font-bold">{avgUptime.toFixed(2)}%</div>}
                            <p className="text-xs text-muted-foreground">Across all units</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Power</CardTitle>
                            <Zap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-6 w-24" /> : <div className="text-2xl font-bold">{(totalPowerConsumption / 1000).toFixed(2)} MWh</div>}
                            <p className="text-xs text-muted-foreground">Consumed this month</p>
                        </CardContent>
                    </Card>
                </div>

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
