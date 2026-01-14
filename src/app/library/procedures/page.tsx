'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Shield, Power, Cpu, Cog, Droplets, ArrowRight } from 'lucide-react';

const procedureCategories = [
  {
    title: 'VSD\'s',
    description: 'Procedures for Variable Speed Drives.',
    icon: Cpu,
    href: '/maintenance/completed/vsds',
  },
  {
    title: 'Protection',
    description: 'Circuit breaker and protection relay procedures.',
    icon: Shield,
    href: '/maintenance/completed/protection',
  },
  {
    title: 'Motors',
    description: 'Electric motor maintenance and testing guides.',
    icon: Cog,
    href: '/maintenance/completed/motors',
  },
  {
    title: 'Pumps',
    description: 'Procedures for various types of industrial pumps.',
    icon: Droplets,
    href: '/maintenance/completed/pumps',
  },
  {
    title: 'UPS/BTU\'s',
    description: 'Uninterruptible Power Supply and battery maintenance.',
    icon: Power,
    href: '#', // Placeholder link
  },
];

export default function ProceduresPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Maintenance Procedures</h1>
        <p className="text-muted-foreground">
          Find standard operating procedures and maintenance guides by component type.
        </p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {procedureCategories.map((cat) => (
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
                  {cat.href === '#' ? 'Coming Soon' : 'View Procedures'}
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
