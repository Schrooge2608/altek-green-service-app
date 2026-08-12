'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory, ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DryMill1Dashboard() {
  const mccs = [
    {
      name: 'DM 1 - WET MCC',
      route: '/smelter-v2/msp/dry-mill-1/wet-mcc',
      description: 'Wet MCC for Dry Mill 1',
      icon: Factory,
      color: 'bg-blue-500'
    },
    {
      name: 'DM 1 - DRY MCC',
      route: '/smelter-v2/msp/dry-mill-1/dry-mcc',
      description: 'Dry MCC for Dry Mill 1',
      icon: Factory,
      color: 'bg-emerald-500'
    }
  ];

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/smelter-v2/msp">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Dry Mill 1</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
              <MapPin className="h-3 w-3 text-primary" />
              Smelter • MSP • Dry Mill 1
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mccs.map((mcc) => (
          <Card key={mcc.name} className="group relative overflow-hidden border-slate-200 hover:border-primary/50 transition-all duration-300 hover:shadow-md">
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-150 ${mcc.color}`} />
            
            <CardHeader className="pb-4 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className={`p-3 rounded-xl ${mcc.color} bg-opacity-10 ring-1 ring-inset ring-${mcc.color}/20`}>
                  <mcc.icon className={`h-6 w-6 ${mcc.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
              <CardTitle className="text-xl font-bold text-slate-800 uppercase tracking-tight">
                {mcc.name}
              </CardTitle>
              <CardDescription className="text-sm font-medium text-slate-500">
                {mcc.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="relative z-10">
              <Link href={mcc.route}>
                <Button 
                  className={`w-full bg-slate-900 text-white hover:bg-primary group-hover:shadow-lg transition-all duration-300 font-bold uppercase text-[10px] tracking-[0.2em] ${mcc.route === '#' ? 'opacity-50 pointer-events-none' : ''}`} 
                >
                  View Equipment
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
