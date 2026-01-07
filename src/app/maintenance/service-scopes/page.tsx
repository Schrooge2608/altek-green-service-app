
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Download } from 'lucide-react';

export default function ServiceScopesPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Service Scopes</h1>
        <p className="text-muted-foreground">
          Official documentation for standard maintenance procedures.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>6-Monthly VSD Service</CardTitle>
            <CardDescription>
              The standard scope of work for the bi-annual servicing of Variable Speed Drives.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/documents/6-monthly-service-scope.pdf" passHref target="_blank" rel="noopener noreferrer">
              <Button className="w-full">
                <Download className="mr-2 h-4 w-4" />
                View Document
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* You can add more cards here for other service scopes as needed */}
        {/*
        <Card>
          <CardHeader>
            <CardTitle>Annual Motor Inspection</CardTitle>
            <CardDescription>
              The standard scope of work for the annual inspection of electric motors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/documents/annual-motor-inspection.pdf" passHref target="_blank" rel="noopener noreferrer">
              <Button className="w-full">
                <Download className="mr-2 h-4 w-4" />
                View Document
              </Button>
            </Link>
          </CardContent>
        </Card>
        */}

      </div>
    </div>
  );
}
