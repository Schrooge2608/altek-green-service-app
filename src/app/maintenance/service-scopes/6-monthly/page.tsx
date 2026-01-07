
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function SixMonthlyServiceScopePage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between print:hidden">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">6 MONTHLY VARIABLE SPEED DRIVE SERVICE</h1>
            <p className="text-muted-foreground">
                Standard scope of work.
            </p>
        </div>
        <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Service Scope Details</CardTitle>
          <CardDescription>
            The following tasks should be performed during the 6-monthly service.
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <p>
            This document is a placeholder. You can start adding your service scope details here.
            You can use standard JSX to format your content, such as lists, paragraphs, and tables.
          </p>
          
          <h3 className="font-bold mt-6">1. Visual Inspection</h3>
          <ul>
            <li>Check for any signs of physical damage to the VSD enclosure.</li>
            <li>Inspect cooling fans for proper operation and cleanliness.</li>
            <li>Verify that all connections are secure and free of corrosion.</li>
          </ul>

          <h3 className="font-bold mt-6">2. Electrical Checks</h3>
          <ul>
            <li>Measure and record input and output voltage and current.</li>
            <li>Perform an insulation resistance test on the motor and cables.</li>
          </ul>

          <p className="mt-8 text-muted-foreground">
            More sections can be added as needed to fully detail the service scope.
          </p>

        </CardContent>
      </Card>
    </div>
  );
}
