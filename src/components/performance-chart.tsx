'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

const chartConfig = {
  uptime: {
    label: 'Uptime (%)',
    color: 'hsl(var(--primary))',
  },
  power: {
    label: 'Power (MWh)',
    color: 'hsl(var(--accent))',
  },
};

export function PerformanceChart() {
  const firestore = useFirestore();
  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const { data: equipment, isLoading } = useCollection<Equipment>(equipmentQuery);

  const chartData = equipment?.map(eq => ({
      name: eq.name,
      uptime: eq.uptime,
      power: eq.powerConsumption / 1000
  })) || [];

  if (isLoading) {
      return <Skeleton className="h-[350px] w-full" />;
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
        <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                />
                <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
                />
                <ChartTooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                <Bar dataKey="uptime" fill="var(--color-uptime)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="power" fill="var(--color-power)" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    </ChartContainer>
  );
}
