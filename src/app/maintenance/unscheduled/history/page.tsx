'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { DailyDiary } from '@/lib/types';
import Link from 'next/link';
import { format } from 'date-fns';
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

function DiaryList({ diaries, locationTag }: { diaries: DailyDiary[] | null, locationTag: string }) {
    if (!diaries) return <div className="text-sm text-muted-foreground">Loading...</div>;
    const filtered = diaries.filter(d => d.locationTags?.includes(locationTag));
    if (filtered.length === 0) return <div className="text-sm text-muted-foreground italic">No unscheduled work recorded for {locationTag}.</div>;

    return (
        <ul className="space-y-2 mt-2">
            {filtered.map(diary => (
                <li key={diary.id}>
                    <Link href={`/reports/contractors-daily-diary/${diary.id}`} className="flex items-center gap-2 text-sm text-primary hover:underline group">
                        <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        <span>{format(new Date(diary.date), 'MMM d, yyyy')} - {diary.contractTitle} ({diary.id})</span>
                    </Link>
                </li>
            ))}
        </ul>
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
      return [...rawDiaries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
                                          <DiaryList diaries={diaries} locationTag={pond} />
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
