
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface MaintenanceScopeDocumentProps {
  title: string;
}

export function MaintenanceScopeDocument({ title }: MaintenanceScopeDocumentProps) {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background">
        <div className="flex justify-end mb-4 gap-2 print:hidden">
            <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </Button>
        </div>

        <Card className="p-8 shadow-lg border-2 border-primary/20 bg-card">
            <header className="flex items-start justify-between mb-8">
                <div>
                    <AltekLogo className="h-12 w-auto" />
                    <p className="text-muted-foreground mt-2">VSD & Equipment Services</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-primary">{title}</h2>
                    <p className="text-muted-foreground">Service Document</p>
                </div>
            </header>

            <Separator className="my-8" />

            <div className="prose prose-sm max-w-none">
              <p>This document outlines the scope of work for the {title.toLowerCase()}.</p>
              <p className="mt-4 text-muted-foreground">(Placeholder content - details for this service scope will be added here.)</p>
            </div>
            
            <footer className="mt-16 text-xs text-muted-foreground text-center">
               <p>Altek Green - Confidential</p>
            </footer>
        </Card>
    </div>
  );
}
