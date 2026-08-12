'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory, ArrowLeft, ArrowRight, MapPin, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function CharPlantDashboard() {
  const mccs = [
    {
      name: 'Charplant Top MCC / E4',
      route: '/smelter-v2/char-plant/top-mcc',
      description: 'Charplant Top MCC / E4',
      icon: Zap,
      color: 'bg-yellow-600'
    },
    {
      name: 'Charplant Bottom MCC / E10',
      route: '/smelter-v2/char-plant/bottom-mcc',
      description: 'Charplant Bottom MCC / E10',
      icon: Zap,
      color: 'bg-amber-600'
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
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Char Plant</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
              <MapPin className="h-3 w-3 text-primary" />
              Smelter • Char Plant
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
