'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  LayoutGrid, 
  MapPin,
  ShieldCheck,
  Factory
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const mspLocations = [
  {
    name: 'TTP',
    route: '/smelter-v2/msp/ttp',
    description: 'TTP Area',
    icon: Factory,
    color: 'bg-red-500',
    buttonText: 'Select Area'
  },
  {
    name: 'FPA\\B',
    route: '/smelter-v2/msp/fpa-b',
    description: 'FPA\\B Area',
    icon: Factory,
    color: 'bg-orange-500',
    buttonText: 'View Equipment'
  },
  {
    name: 'FPC',
    route: '/smelter-v2/msp/fpc',
    description: 'FPC Area',
    icon: Factory,
    color: 'bg-yellow-500',
    buttonText: 'View Equipment'
  },
  {
    name: 'Calcium Rejection',
    route: '/smelter-v2/msp/calcium-rejection',
    description: 'Calcium Rejection',
    icon: Factory,
    color: 'bg-green-600',
    buttonText: 'View Equipment'
  },
  {
    name: 'RWPH',
    route: '/smelter-v2/msp/rwph',
    description: 'RWPH Area',
    icon: Factory,
    color: 'bg-blue-600',
    buttonText: 'View Equipment'
  },
  {
    name: 'Cone Settler',
    route: '/smelter-v2/msp/cone-settler',
    description: 'Cone Settler',
    icon: Factory,
    color: 'bg-purple-600',
    buttonText: 'View Equipment'
  },
  {
    name: 'Dry Mill 1',
    route: '/smelter-v2/msp/dry-mill-1',
    description: 'Dry Mill 1',
    icon: Factory,
    color: 'bg-stone-500',
    buttonText: 'Select Area'
  },
  {
    name: 'Dry Mill 2',
    route: '/smelter-v2/msp/dry-mill-2',
    description: 'Dry Mill 2',
    icon: Factory,
    color: 'bg-zinc-500',
    buttonText: 'Select Area'
  },
  {
    name: 'NZTP',
    route: '/smelter-v2/msp/nztp',
    description: 'NZTP Area',
    icon: Factory,
    color: 'bg-indigo-500',
    buttonText: 'Select Area'
  },
  {
    name: 'Pilot Plant',
    route: '/smelter-v2/msp/pilot-plant',
    description: 'Pilot Plant',
    icon: Factory,
    color: 'bg-teal-500',
    buttonText: 'View Equipment'
  }
];

export default function MSPDashboardPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary rounded-xl shadow-lg">
            <LayoutGrid className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">MSP Area</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              Strategic Area Selection Dashboard
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {mspLocations.map((loc) => (
          <Card key={loc.route} className="group hover:shadow-xl transition-all duration-300 border-slate-200 overflow-hidden">
            <CardHeader className="pb-2 space-y-1">
              <div className="flex justify-between items-start">
                <div className={cn("p-2 rounded-lg text-white shadow-md", loc.color)}>
                  <loc.icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase opacity-60">Site Access</Badge>
              </div>
              <CardTitle className="text-xl font-black text-slate-800 pt-2">{loc.name}</CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {loc.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Link href={loc.route}>
                <Button className="w-full bg-slate-900 hover:bg-primary group-hover:shadow-lg transition-all font-bold uppercase text-[10px] tracking-widest">
                  {loc.buttonText || 'Select Area'} <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
