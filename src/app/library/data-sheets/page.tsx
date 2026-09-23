'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Power, Cpu, Cog, Droplets } from 'lucide-react';

const dataSheetCategories = [
  {
    title: 'Protection',
    description: 'Data sheets for circuit breakers and relays.',
    icon: Shield,
  },
  {
    title: 'UPS/BTU\'s',
    description: 'Uninterruptible Power Supply technical data.',
    icon: Power,
  },
  {
    title: 'VSD\'s',
    description: 'Find data sheets for Variable Speed Drives.',
    icon: Cpu,
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
];

import Link from 'next/link';

export default function DataSheetsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Data Sheets and Drawings</h1>
        <p className="text-muted-foreground">
          Find technical specifications and data sheets by component type.
        </p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {dataSheetCategories.map((cat) => (
          <Link key={cat.title} href={`/library/data-sheets/${encodeURIComponent(cat.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`} className="block transition-transform hover:scale-[1.02]">
            <Card className="h-full hover:border-primary/50 cursor-pointer">
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
          </Link>
        ))}
      </div>
    </div>
  );
}
