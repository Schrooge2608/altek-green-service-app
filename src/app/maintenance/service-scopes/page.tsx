
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

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
            <Link href="/maintenance/service-scopes/6-monthly" passHref>
              <Button className="w-full">
                <BookOpen className="mr-2 h-4 w-4" />
                View Scope
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* You can add more cards here for other service scopes as needed */}

      </div>
    </div>
  );
}
