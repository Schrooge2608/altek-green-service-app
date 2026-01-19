
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

const plantDivisionMap = {
    mining: {
        'boosters': 'Boosters',
        'dredgers': 'Dredgers',
        'pump-stations': 'Pump Stations',
        'ups-btus': "UPS/BTU's",
    },
    smelter: {
        'msp': 'MSP',
        'roaster': 'Roaster',
        'char-plant': 'Char Plant',
        'smelter': 'Smelter',
        'iron-injection': 'Iron injection',
        'stripping-crane': 'Stripping Crane',
        'slag-plant': 'Slag plant',
        'north-screen': 'North Screen',
        'ups-btus': "UPS/BTU's",
    }
} as const;


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
    if (uptime < 60) return '#C00000';
    if (uptime < 80) return '#EE0000';
    if (uptime < 90) return '#FFC000';
    if (uptime < 95) return '#FFFF00';
    if (uptime < 100) return '#92D050';
    return 'hsl(var(--accent))';
};

export default function EquipmentReportPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    
    const plantSlug = Array.isArray(params.plant) ? params.plant[0] : params.plant;
    const divisionSlug = Array.isArray(params.division) ? params.division[0] : params.division;
    const locationSlug = Array.isArray(params.location) ? params.location[0] : params.location;

    const plantName = useMemo(() => {
        if (plantSlug !== 'mining' && plantSlug !== 'smelter') return '';
        return plantSlug.charAt(0).toUpperCase() + plantSlug.slice(1);
    }, [plantSlug]);

    const divisionName = useMemo(() => {
        if (plantSlug !== 'mining' && plantSlug !== 'smelter') return '';
        const divisions = plantDivisionMap[plantSlug as keyof typeof plantDivisionMap];
        type DivisionSlug = keyof typeof divisions;
        if (divisionSlug in divisions) {
            return divisions[divisionSlug as DivisionSlug];
        }
        return '';
    }, [plantSlug, divisionSlug]);

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
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const totalHoursInMonth = daysInMonth * 24;

        return equipmentList.map(eq => {
            const downtimeHours = eq.totalDowntimeHours || 0;
            const uptimeHours = totalHoursInMonth - downtimeHours;
            const currentUptime = Math.max(0, (uptimeHours / totalHoursInMonth) * 100);

            const runningHours = totalHoursInMonth - downtimeHours;
            const currentPowerConsumption = (eq.motorPower || 0) * runningHours;

            return {
                id: eq.id,
                name: eq.name,
                uptime: parseFloat(currentUptime.toFixed(2)),
                power: parseFloat((currentPowerConsumption / 1000).toFixed(2)), // Convert to MWh
            };
        }).sort((a,b) => a.name.localeCompare(b.name));
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
