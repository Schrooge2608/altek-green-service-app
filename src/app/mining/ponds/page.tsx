'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Droplets, 
  ArrowRight, 
  Activity, 
  Waves, 
  Pickaxe, 
  Zap, 
  LayoutGrid, 
  MapPin,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const locations = [
  {
    name: 'MPA',
    route: '/mining/ponds/mpa',
    description: 'Mining Pond A Area',
    icon: Droplets,
    color: 'bg-blue-500'
  },
  {
    name: 'MPC',
    route: '/mining/ponds/mpc',
    description: 'Mining Pond C Area',
    icon: Droplets,
    color: 'bg-blue-600'
  },

  {
    name: 'MPD',
    route: '/mining/ponds/mpd',
    description: 'Mining Pond D Area',
    icon: Droplets,
    color: 'bg-blue-700'
  },
  {
    name: 'MPE',
    route: '/mining/ponds/mpe',
    description: 'Mining Pond E Area',
    icon: Droplets,
    color: 'bg-blue-800'
  },
];

export default function MiningPondsV2Page() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary rounded-xl shadow-lg">
            <LayoutGrid className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Mining Ponds (v2)</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              Strategic Area Selection Dashboard
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {locations.map((loc) => (
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
                  Select Area <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
        <CardContent className="p-12 text-center space-y-4">
           <div className="bg-white p-4 rounded-full w-fit mx-auto shadow-sm border">
              <Activity className="h-10 w-10 text-slate-400" />
           </div>
           <div className="space-y-1">
             <h3 className="text-lg font-bold text-slate-800">Operational Integrity</h3>
             <p className="text-sm text-slate-500 max-w-lg mx-auto">
               This v2 dashboard is designed for high-precision asset tracking. Select an area above to view the detailed equipment hierarchy for that pond station.
             </p>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
