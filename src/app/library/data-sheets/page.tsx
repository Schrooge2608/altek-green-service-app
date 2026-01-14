
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Power, Cpu, Cog, Droplets } from 'lucide-react';

const dataSheetCategories = [
  {
    title: 'VSD\'s',
    description: 'Find data sheets for Variable Speed Drives.',
    icon: Cpu,
  },
  {
    title: 'Protection',
    description: 'Data sheets for circuit breakers and relays.',
    icon: Shield,
  },
  {
    title: 'Motors',
    description: 'Electric motor specifications and data sheets.',
    icon: Cog,
  },
  {
    title: 'Pumps',
    description: 'Data sheets for various industrial pumps.',
    icon: Droplets,
  },
  {
    title: 'UPS/BTU\'s',
    description: 'Uninterruptible Power Supply technical data.',
    icon: Power,
  },
];

export default function DataSheetsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Data Sheets</h1>
        <p className="text-muted-foreground">
          Find technical specifications and data sheets by component type.
        </p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {dataSheetCategories.map((cat) => (
          <Card key={cat.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <cat.icon className="h-6 w-6 text-primary" />
                <span>{cat.title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{cat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
