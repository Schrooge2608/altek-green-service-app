
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default function TimeAttendancePage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Time & Attendance</h1>
        <p className="text-muted-foreground">
          Track daily sign-ins and sign-outs for your team.
        </p>
      </header>
      <Card className="flex flex-col items-center justify-center text-center p-8 gap-4 min-h-[400px]">
        <CardHeader>
            <CardTitle className="flex items-center gap-4"><Clock className="h-12 w-12 text-muted-foreground" /> Feature In Progress</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">This page is being developed. We'll start building the timesheet functionality here next.</p>
        </CardContent>
      </Card>
    </div>
  );
}
