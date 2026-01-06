'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PerformanceChart } from '@/components/performance-chart';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

const chartConfig = {
    kWh: {
        label: 'kWh',
        color: 'hsl(var(--accent))',
    },
};

export default function ReportsPage() {
    const firestore = useFirestore();
    const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
    const { data: equipment, isLoading } = useCollection<Equipment>(equipmentQuery);

    const powerConsumptionData = equipment?.map(e => ({ name: e.name, kWh: e.powerConsumption })) || [];

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
                <p className="text-muted-foreground">
                    Detailed performance and maintenance reports.
                </p>
            </header>

            <div className="grid gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Overall Equipment Performance</CardTitle>
                        <CardDescription>Uptime vs. Power consumption across all units.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PerformanceChart />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Power Consumption by Equipment</CardTitle>
                        <CardDescription>Comparing the energy usage of individual units.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart accessibilityLayer data={powerConsumptionData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <XAxis
                                            dataKey="name"
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            fontSize={12}
                                            stroke="hsl(var(--muted-foreground))"
                                        />
                                        <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                                        <ChartTooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                                        <Bar dataKey="kWh" fill="var(--color-kWh)" radius={4} />
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
