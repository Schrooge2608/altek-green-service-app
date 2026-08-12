'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Cpu, 
  ChevronRight, 
  ArrowLeft,
  ShieldCheck,
  MapPin
} from 'lucide-react';
import Link from 'next/link';

export default function MPCTailsBoostersNodesPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/mining/ponds/mpc">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">MPC: TAILS BOOSTERS</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
              <MapPin className="h-3 w-3 text-primary" />
              Area Control Nodes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Operational Integrity Active</span>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="group hover:shadow-xl transition-all duration-300 border-slate-200">
          <CardHeader className="pb-2 space-y-1">
            <div className="p-2 rounded-lg text-white w-fit shadow-md mb-2 bg-slate-700">
              <Cpu className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">MPC Tails Boosters MCC</CardTitle>
            <CardDescription className="text-xs font-medium text-slate-500 leading-relaxed">
              Main motor control center and switchgear for the tails boosters.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Link href="/mining/ponds/mpc/tails-boosters/mcc">
              <Button className="w-full bg-slate-900 hover:bg-primary group-hover:shadow-lg transition-all font-bold uppercase text-[10px] tracking-[0.2em]">
                View Sub-Systems <ChevronRight className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-12 pt-8 border-t border-dashed border-slate-200 text-center">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
          Altek Green (v2) Asset Register • Node Navigation
        </p>
      </footer>
    </div>
  );
}
