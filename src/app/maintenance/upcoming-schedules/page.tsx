'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const MINING_PONDS: Record<string, string[]> = {
  'MPA': ['Dredgers', 'Surge Bin', 'Concentrator Plant', 'Tail Boosters', 'Cons Boosters'],
  'MPB': [],
  'MPC': ['Dredgers', 'Surge Bin', 'Concentrator Plant', 'Tail Booster', 'Cons Boosters', 'MPC Dry Mining'],
  'MPD': ['Dredger', 'Surge Bin', 'Concentrator Plant', 'Tail Boosters', 'Cons Boosters'],
  'MPE': ['Dredge 1', 'Dredge 2', 'Surge Bin', 'Concentrator Plant', 'Tail Booster', 'Cons Booster', 'MPE Dry Mining']
};
const PUMP_STATIONS = ['Nhlabane', 'Pozzolan', 'Monzi', 'Return Water Boosters'];
const SMELTER_SECTIONS = ['MSP Roaster', 'Char Plant', 'Smelter', 'Iron Injection', 'Stripping Cranes', 'Slag Plant', 'North Screen'];

export default function UpcomingSchedulesPage() {
  return (
    <div className="flex flex-col gap-8 p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Upcoming Schedules</h1>
        <p className="text-muted-foreground mt-2">
          Manage upcoming maintenance schedules across plants.
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
                                      <AccordionContent className="px-4 py-2 text-muted-foreground text-xs">
                                        (Equipment schedules for {sub} will appear here)
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                                </Accordion>
                              ) : (
                                <span className="text-muted-foreground text-sm">(Equipment schedules for {pond} will appear here)</span>
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
                            <AccordionContent className="px-4 py-2 text-muted-foreground">
                              (Equipment schedules for {station} will appear here)
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
                      <AccordionContent className="px-4 py-2 text-muted-foreground">
                        (Equipment schedules for {section} will appear here)
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
