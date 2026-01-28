'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench } from 'lucide-react';

export default function ToolsAndEquipmentPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Tools &amp; Equipment</h1>
        <p className="text-muted-foreground">
          Manage and track tools and other equipment.
        </p>
      </header>
      <Card className="flex flex-col items-center justify-center text-center p-8 gap-4 min-h-[400px]">
        <CardHeader>
            <CardTitle className="flex items-center gap-4"><Wrench className="h-12 w-12 text-muted-foreground" /> Ready to Build</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">This page is ready for content.</p>
        </CardContent>
      </Card>
    </div>
  );
}
