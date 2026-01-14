
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function DataSheetsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Data Sheets</h1>
        <p className="text-muted-foreground">
          Find and manage all equipment data sheets.
        </p>
      </header>
      <Card className="flex flex-col items-center justify-center text-center p-8 gap-4 min-h-[400px]">
        <CardHeader>
            <CardTitle className="flex items-center gap-4"><FileText className="h-12 w-12 text-muted-foreground" /> Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">This feature is currently under construction.</p>
        </CardContent>
      </Card>
    </div>
  );
}
