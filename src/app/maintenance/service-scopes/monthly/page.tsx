
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function MonthlyServiceScopePage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between print:hidden">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">MONTHLY VARIABLE SPEED DRIVE SERVICE</h1>
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
            The following tasks should be performed during the monthly service.
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <p>
            This document is a placeholder. You can start adding your service scope details here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
