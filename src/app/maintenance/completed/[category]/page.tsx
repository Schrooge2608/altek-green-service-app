'use client';

import { useParams, notFound } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { ScheduledTask } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, Search, Package, Loader2, Filter } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const validCategories: Record<string, string> = {
  vsds: 'VSD',
  protection: 'Protection',
  motors: 'Motor',
  pumps: 'Pump',
  'ups-btus': 'UPS'
};

const displayNames: Record<string, string> = {
  vsds: 'VSDs',
  protection: 'Protection',
  motors: 'Motors',
  pumps: 'Pumps',
  'ups-btus': "UPS/BTU's"
};

export default function CompletedSchedulesByCategoryPage() {
  const params = useParams();
  const categorySlug = params.category as string;
  const componentType = validCategories[categorySlug];
  const displayName = displayNames[categorySlug];

  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch 'Approved' tasks for this component
  const schedulesQuery = useMemoFirebase(() => {
    if (!componentType) return null;
    return query(
        collection(firestore, 'upcoming_schedules'), 
        where('component', '==', componentType),
        where('status', '==', 'Approved'),
        orderBy('scheduledFor', 'desc')
    );
  }, [firestore, componentType]);

  const { data: schedules, isLoading } = useCollection<ScheduledTask>(schedulesQuery);

  // 2. Group by Equipment Name
  const groupedByEquipment = useMemo(() => {
    if (!schedules) return {};
    return schedules.reduce((acc, schedule) => {
      const eqName = schedule.equipmentName || 'Unspecified Equipment';
      if (!acc[eqName]) acc[eqName] = [];
      acc[eqName].push(schedule);
      return acc;
    }, {} as Record<string, ScheduledTask[]>);
  }, [schedules]);

  // 3. Filter keys based on search term
  const filteredEquipmentNames = useMemo(() => {
    return Object.keys(groupedByEquipment)
      .filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort();
  }, [groupedByEquipment, searchTerm]);

  if (!componentType) {
    notFound();
    return null;
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Archive: {displayName}</h1>
          <p className="text-muted-foreground italic">
            Historical maintenance records grouped by asset.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search equipment..." 
            className="pl-9 bg-white shadow-sm border-slate-200"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p className="text-xs font-bold uppercase tracking-widest">Opening file cabinet...</p>
        </div>
      ) : filteredEquipmentNames.length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-4">
          {filteredEquipmentNames.map((eqName) => {
            const records = groupedByEquipment[eqName];
            return (
              <AccordionItem key={eqName} value={eqName} className="border rounded-xl bg-white overflow-hidden shadow-sm px-4 border-slate-200 transition-all hover:border-primary/20">
                <AccordionTrigger className="hover:no-underline py-5 group">
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-primary/5 transition-colors">
                      <Package className="h-5 w-5 text-primary opacity-60" />
                    </div>
                    <div>
                      <span className="text-lg font-black text-slate-800 tracking-tight">{eqName}</span>
                      <p className="text-[9px] text-slate-400 uppercase font-black tracking-[0.1em] mt-0.5">
                        {records[0].area || 'General Site Location'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-600 border-none font-black text-[10px]">
                      {records.length} {records.length === 1 ? 'Record' : 'Records'}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2 pb-6">
                    <Table>
                      <TableHeader className="bg-slate-50 rounded-md">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-black text-[9px] uppercase tracking-wider text-slate-500">Service Task</TableHead>
                          <TableHead className="font-black text-[9px] uppercase tracking-wider text-slate-500">Completion Date</TableHead>
                          <TableHead className="font-black text-[9px] uppercase tracking-wider text-slate-500">Technician</TableHead>
                          <TableHead className="text-right font-black text-[9px] uppercase tracking-wider text-slate-500">Audit Link</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {records.map(record => (
                          <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                            <TableCell className="font-bold text-slate-700 text-sm">{record.task}</TableCell>
                            <TableCell className="font-mono text-xs text-slate-500">{record.scheduledFor}</TableCell>
                            <TableCell className="text-sm font-medium text-slate-600">{record.assignedToName}</TableCell>
                            <TableCell className="text-right">
                              <Link href={`/maintenance/resolve/${record.id}`}>
                                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5 font-bold">
                                  <FileText className="h-4 w-4 mr-2" /> View PDF
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <div className="p-20 text-center border-2 border-dashed rounded-3xl bg-slate-50/50 border-slate-200">
          <Filter className="h-12 w-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 italic">No approved records found matching "{searchTerm}".</p>
        </div>
      )}
    </div>
  );
}
