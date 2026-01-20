
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wrench } from 'lucide-react';

export default function UpcomingSchedulesPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Upcoming Schedules</h1>
        <p className="text-muted-foreground">
          A list of tasks scheduled by technicians for the coming week.
        </p>
      </header>
      <Card className="flex flex-col items-center justify-center text-center p-8 gap-4 min-h-[400px]">
        <CardHeader>
            <CardTitle className="flex items-center gap-4"><Wrench className="h-12 w-12 text-muted-foreground" /> Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">This page will list all maintenance tasks that have been scheduled for the upcoming week.</p>
            <p className="text-sm text-muted-foreground mt-2">Functionality to schedule and resolve these tasks will be added next.</p>
        </CardContent>
      </Card>
    </div>
  );
}
