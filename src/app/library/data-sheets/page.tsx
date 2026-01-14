
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Shield, Power, Cpu, Cog, Droplets, ArrowRight } from 'lucide-react';

const dataSheetCategories = [
  {
    title: 'VSD\'s',
    description: 'Find data sheets for Variable Speed Drives.',
    icon: Cpu,
    href: '#',
  },
  {
    title: 'Protection',
    description: 'Data sheets for circuit breakers and relays.',
    icon: Shield,
    href: '#',
  },
  {
    title: 'Motors',
    description: 'Electric motor specifications and data sheets.',
    icon: Cog,
    href: '#',
  },
  {
    title: 'Pumps',
    description: 'Data sheets for various industrial pumps.',
    icon: Droplets,
    href: '#',
  },
  {
    title: 'UPS/BTU\'s',
    description: 'Uninterruptible Power Supply technical data.',
    icon: Power,
    href: '#',
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
            <CardContent className="flex flex-col justify-between h-full">
              <p className="text-muted-foreground mb-4">{cat.description}</p>
              <Link href={cat.href} passHref>
                <Button variant={cat.href === '#' ? 'secondary' : 'default'} disabled={cat.href === '#'} className="w-full">
                  {cat.href === '#' ? 'Coming Soon' : 'View Data Sheets'}
                  {cat.href !== '#' && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
