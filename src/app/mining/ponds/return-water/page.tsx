'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Waves, 
  Zap, 
  ChevronRight, 
  ArrowLeft,
  ShieldCheck,
  MapPin,
  Activity
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const stations = [
  {
    name: 'Return water booster station No 1',
    description: 'Primary RWBS unit 1 - Water recovery and pressure management.',
    icon: Zap,
    color: 'bg-cyan-600'
  },
  {
    name: 'Return water booster station No 2',
    description: 'Primary RWBS unit 2 - Water recovery and pressure management.',
    icon: Zap,
    color: 'bg-cyan-700'
  }
];

export default function RWBSDashboardPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/mining/ponds">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">RWBS: Return Water Booster Station</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
              <MapPin className="h-3 w-3 text-primary" />
              Strategic Water Management
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Operational Integrity Active</span>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl">
        {stations.map((station) => (
          <Card key={station.name} className="group hover:shadow-xl transition-all duration-300 border-slate-200">
            <CardHeader className="pb-2 space-y-1">
              <div className={cn("p-2 rounded-lg text-white w-fit shadow-md mb-2", station.color)}>
                <station.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">{station.name}</CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500 leading-relaxed">
                {station.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button className="w-full bg-slate-900 hover:bg-primary group-hover:shadow-lg transition-all font-bold uppercase text-[10px] tracking-[0.2em]">
                Drive Rooms <ChevronRight className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-50 border-dashed border-2 border-slate-200 mt-8">
        <CardContent className="p-8 text-center space-y-4">
          <div className="bg-white p-3 rounded-full w-fit mx-auto shadow-sm border">
            <Waves className="h-8 w-8 text-cyan-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">System Overview</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Monitoring high-volume return water flows. Select a specific booster station above to manage individual pump and drive nodes.
            </p>
          </div>
        </CardContent>
      </Card>

      <footer className="mt-12 pt-8 border-t border-dashed border-slate-200 text-center">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
          Altek Green (v2) Asset Register • RWBS Operations
        </p>
      </footer>
    </div>
  );
}
