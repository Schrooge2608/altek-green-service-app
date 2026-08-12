'use client';

import React from 'react';
import { DivisionPerformanceDashboard } from '@/components/division-performance-dashboard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Factory, Pickaxe, Building, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * @fileOverview Plants Dashboard
 * Provides a high-level operational overview of the two primary sites: Mining and Smelter.
 */
export default function PlantsPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <Factory className="h-8 w-8 text-primary" />
            PLANT OPERATIONS
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1">
            Site-wide Performance & Asset Summary
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MINING PLANT CARD */}
        <Card className="hover:shadow-lg transition-all border-emerald-100 group">
          <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 pb-4">
            <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold flex items-center gap-3 text-emerald-900">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <Pickaxe className="h-5 w-5 text-emerald-600" />
                    </div>
                    Mining Plant
                </CardTitle>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Monitors heavy-duty equipment including Boosters, Dredgers, and remote Pump Stations across the mining operation area.
            </p>
            <Link href="/equipment">
              <Button variant="outline" className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold group-hover:border-emerald-500">
                Manage Mining Assets <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* SMELTER PLANT CARD */}
        <Card className="hover:shadow-lg transition-all border-blue-100 group">
          <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
            <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold flex items-center gap-3 text-blue-900">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Building className="h-5 w-5 text-blue-600" />
                    </div>
                    Smelter Plant
                </CardTitle>
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Tracking performance for MSP, Roaster, Char Plant, and the core Smelter furnace operations and products area.
            </p>
            <Link href="/equipment/smelter/smelter">
              <Button variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 font-bold group-hover:border-blue-500">
                Manage Smelter Assets <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* DETAILED PERFORMANCE SECTION */}
      <div className="space-y-12 mt-4">
        <div>
            <h2 className="text-lg font-bold text-slate-800 border-l-4 border-emerald-500 pl-3 mb-6 uppercase tracking-tight">Mining Division Performance</h2>
            <DivisionPerformanceDashboard plantName="Mining" />
        </div>

        <div>
            <h2 className="text-lg font-bold text-slate-800 border-l-4 border-blue-500 pl-3 mb-6 uppercase tracking-tight">Smelter Division Performance</h2>
            <DivisionPerformanceDashboard plantName="Smelter" />
        </div>
      </div>
    </div>
  );
}
