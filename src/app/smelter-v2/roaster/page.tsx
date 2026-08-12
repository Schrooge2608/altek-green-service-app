'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory, ArrowLeft, ArrowRight, MapPin, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function RoasterDashboard() {
  const mccs = [
    {
      name: 'Roaster MCC 1',
      route: '/smelter-v2/roaster/mcc1',
      description: 'Roaster MCC 1',
      icon: Zap,
      color: 'bg-orange-600'
    },
    {
      name: 'Roaster MCC 2',
      route: '/smelter-v2/roaster/mcc2',
      description: 'Roaster MCC 2',
      icon: Zap,
      color: 'bg-blue-600'
    },
    {
      name: 'Roaster MCC 3',
      route: '/smelter-v2/roaster/mcc3',
      description: 'Roaster MCC 3',
      icon: Zap,
      color: 'bg-emerald-600'
    },
    {
      name: 'Roaster MCC 4',
      route: '/smelter-v2/roaster/mcc4',
      description: 'Roaster MCC 4',
      icon: Zap,
      color: 'bg-indigo-600'
    },
    {
      name: 'Roaster MCC 5',
      route: '/smelter-v2/roaster/mcc5',
      description: 'Roaster MCC 5',
      icon: Zap,
      color: 'bg-red-600'
    }
  ];

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/smelter-v2/smelter">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Roaster</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
              <MapPin className="h-3 w-3 text-primary" />
              Smelter • Roaster
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mccs.map((mcc) => (
          <Card key={mcc.name} className="group relative overflow-hidden hover:shadow-xl transition-all duration-300 border-slate-200">
            <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-150", mcc.color)} />
            
            <CardHeader className="pb-4 relative z-10 space-y-1">
              <div className={cn("p-2 rounded-lg text-white w-fit shadow-md mb-2", mcc.color)}>
                <mcc.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">{mcc.name}</CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500 leading-relaxed">
                {mcc.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
              <Link href={mcc.route}>
                <Button className="w-full bg-slate-900 text-white hover:bg-primary group-hover:shadow-lg transition-all duration-300 font-bold uppercase text-[10px] tracking-[0.2em]">
                  View Equipment <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
