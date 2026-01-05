'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { equipment } from '@/lib/data';

const chartData = equipment.map(eq => ({
    name: eq.name,
    uptime: eq.uptime,
    power: eq.powerConsumption / 1000
}));

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
