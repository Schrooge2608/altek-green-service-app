'use client';

import React from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { DailyDiary } from '@/lib/types';
import Link from 'next/link';
import { format, addMonths } from 'date-fns';
import { FileText } from 'lucide-react';

const MINING_PONDS: Record<string, string[]> = {
  'MPA': ['Dredgers', 'Surge Bin', 'Concentrator Plant', 'Tail Boosters', 'Cons Boosters'],
  'MPB': [],
  'MPC': ['Dredgers', 'Surge Bin', 'Concentrator Plant', 'Tail Booster', 'Cons Boosters', 'MPC Dry Mining'],
  'MPD': ['Dredger', 'Surge Bin', 'Concentrator Plant', 'Tail Boosters', 'Cons Boosters'],
  'MPE': ['Dredge 1', 'Dredge 2', 'Surge Bin', 'Concentrator Plant', 'Tail Booster', 'Cons Booster', 'MPE Dry Mining']
};
const PUMP_STATIONS = ['Nhlabane', 'Pozzolan', 'Monzi', 'Return Water Boosters'];
const SMELTER_SECTIONS = ['MSP Roaster', 'Char Plant', 'Smelter', 'Iron Injection', 'Stripping Cranes', 'Slag Plant', 'North Screen'];

function DiaryList({ diaries, locationTag, equipmentFilter }: { diaries: DailyDiary[] | null, locationTag: string, equipmentFilter?: string }) {
    if (!diaries) return <div className="text-sm text-muted-foreground p-2">Loading...</div>;
    
    interface WorkItemRow {
        id: string;
        diaryId: string;
        date: Date;
        area: string;
        scope: string;
    }
    
    const workItems: WorkItemRow[] = [];
    
    diaries.forEach(d => {
        if (!d.locationTags?.includes(locationTag)) return;
        
        (d.works || []).forEach((w, i) => {
            if (!w.area || !w.scope) return;
            
            if (equipmentFilter && !w.area.toLowerCase().includes(equipmentFilter.toLowerCase())) {
                return;
            }

            const scopeLower = w.scope.toLowerCase();
            const areaLower = w.area.toLowerCase();
            
            const maintenanceKeywords = ["maintenance", "replace", "rebuild", "service", "repair", "fix", "install"];
            const isMaintenance = maintenanceKeywords.some(k => scopeLower.includes(k) || areaLower.includes(k));
            
            const transportKeywords = ["collect", "transport", "deliver", "move"];
            const isTransport = transportKeywords.some(k => scopeLower.includes(k));
            
            if (!isMaintenance && isTransport) return;
            
            workItems.push({
                id: `${d.id}-${i}`,
                diaryId: d.id,
                date: new Date(d.date),
                area: w.area,
                scope: w.scope
            });
        });
    });

    if (workItems.length === 0) {
        return <div className="text-sm text-muted-foreground italic p-2">No maintenance work recorded for this equipment.</div>;
    }

    workItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
        <div className="overflow-x-auto w-full">
            <Table className="text-xs w-full bg-white border border-slate-200">
                <TableHeader className="bg-slate-100">
                    <TableRow>
                        <TableHead>Equipment / Area</TableHead>
                        <TableHead>Scope of Work</TableHead>
                        <TableHead className="w-28">Service Date</TableHead>
                        <TableHead className="w-32">Next Service Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {workItems.map(item => {
                        const nextService = addMonths(item.date, 3);
                        return (
                            <TableRow key={item.id} className="hover:bg-slate-50">
                                <TableCell className="font-medium max-w-[200px] truncate">
                                    <Link href={`/reports/contractors-daily-diary?id=${item.diaryId}`} className="text-primary hover:underline" title="View Diary">
                                        {item.area}
                                    </Link>
                                </TableCell>
                                <TableCell>{item.scope}</TableCell>
                                <TableCell>{format(item.date, "yyyy/MM/dd")}</TableCell>
                                <TableCell className="font-bold text-emerald-700">{format(nextService, "yyyy/MM/dd")}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

export default function UnscheduledHistoryPage() {
  const { firestore } = useFirebase();
  const diariesQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      // We do not order by date here because it requires a composite index if filtered by maintenanceType. 
      // We will just filter by type and sort in memory.
      return query(collection(firestore, 'daily_diaries'), where('maintenanceType', '==', 'Unscheduled'));
  }, [firestore]);
  
  const { data: rawDiaries } = useCollection<DailyDiary>(diariesQuery);
  const diaries = React.useMemo(() => {
      if (!rawDiaries) return null;
      return [...rawDiaries]
          .filter(d => d.isFinalised)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawDiaries]);

  return (
    <div className="flex flex-col gap-8 p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Unscheduled Work (History)</h1>
        <p className="text-muted-foreground mt-2">
          View all unscheduled maintenance history across plants, extracted from Daily Diaries.
        </p>
      </header>

      <Accordion type="multiple" className="w-full space-y-4" defaultValue={['Mining', 'Smelter']}>
        {/* MINING SECTION */}
        <AccordionItem value="Mining" className="border-b-0">
          <Card>
            <AccordionTrigger className="p-6 text-xl font-bold hover:no-underline">
              <CardHeader className="p-0">
                <CardTitle>Mining Plant</CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent className="p-0">
              <div className="px-6 pb-6">
                <Accordion type="multiple" className="w-full space-y-4">
                  {/* Mining Ponds */}
                  <AccordionItem value="MiningPonds" className="border rounded-md">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline font-semibold">
                      Mining Ponds
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <Accordion type="multiple" className="w-full space-y-2">
                        {Object.entries(MINING_PONDS).map(([pond, subsections]) => (
                          <AccordionItem key={pond} value={pond} className="border rounded-md">
                            <AccordionTrigger className="px-4 py-2 hover:no-underline text-sm font-medium">
                              {pond}
                            </AccordionTrigger>
                            <AccordionContent className="px-4 py-2">
                              {subsections.length > 0 ? (
                                <Accordion type="multiple" className="w-full space-y-2">
                                  {subsections.map(sub => (
                                    <AccordionItem key={sub} value={`${pond}-${sub}`} className="border rounded-md">
                                      <AccordionTrigger className="px-4 py-2 hover:no-underline text-xs font-medium">
                                        {sub}
                                      </AccordionTrigger>
                                      <AccordionContent className="px-4 py-2">
                                          <DiaryList diaries={diaries} locationTag={pond} equipmentFilter={sub} />
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                                </Accordion>
                              ) : (
                                <DiaryList diaries={diaries} locationTag={pond} />
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Pump Stations */}
                  <AccordionItem value="PumpStations" className="border rounded-md">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline font-semibold">
                      Pump Stations
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <Accordion type="multiple" className="w-full space-y-2">
                        {PUMP_STATIONS.map(station => (
                          <AccordionItem key={station} value={station} className="border rounded-md">
                            <AccordionTrigger className="px-4 py-2 hover:no-underline text-sm font-medium">
                              {station}
                            </AccordionTrigger>
                            <AccordionContent className="px-4 py-2">
                                <DiaryList diaries={diaries} locationTag={station} />
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* SMELTER SECTION */}
        <AccordionItem value="Smelter" className="border-b-0">
          <Card>
            <AccordionTrigger className="p-6 text-xl font-bold hover:no-underline">
              <CardHeader className="p-0">
                <CardTitle>Smelter Plant</CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent className="p-0">
              <div className="px-6 pb-6">
                <Accordion type="multiple" className="w-full space-y-2">
                  {SMELTER_SECTIONS.map(section => (
                    <AccordionItem key={section} value={section} className="border rounded-md">
                      <AccordionTrigger className="px-4 py-2 hover:no-underline font-medium">
                        {section}
                      </AccordionTrigger>
                      <AccordionContent className="px-4 py-2">
                          <DiaryList diaries={diaries} locationTag={section} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
