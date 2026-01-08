
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText } from 'lucide-react';

export default function MaintenancePage() {
  const serviceScopes = [
    { title: 'Weekly Service Scope', frequency: 'weekly', enabled: true },
    { title: 'Monthly Service Scope', frequency: 'monthly', enabled: true },
    { title: '3-Monthly Service Scope', frequency: '3-monthly', enabled: true },
    { title: '6-Monthly Service Scope', frequency: '6-monthly', enabled: true },
    { title: 'Yearly Service Scope', frequency: 'yearly', enabled: true },
  ];

  const categories = [
    { name: 'VSDs', slug: 'vsds' },
    { name: 'Protection', slug: 'protection' },
    { name: 'Motors', slug: 'motors' },
    { name: 'Pumps', slug: 'pumps' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Maintenance Schedule</h1>
            <p className="text-muted-foreground">
            Generate and view maintenance tasks for all equipment.
            </p>
        </div>
      </header>

      {categories.map(category => (
        <div key={category.slug}>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-2xl font-semibold tracking-tight">{category.name.toUpperCase()}</h2>
            <Link href={`/maintenance/completed/${category.slug}`} passHref>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <FileText className="mr-2 h-4 w-4" />
                View Completed
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
              {serviceScopes.map(scope => (
                  <Card key={`${category.slug}-${scope.frequency}`}>
                      <CardHeader>
                          <CardTitle className="text-lg">{scope.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2">
                        <Link href={`/maintenance/${category.slug}/${scope.frequency}`}>
                          <Button className="w-full whitespace-normal h-auto py-2" disabled={!scope.enabled}>
                              View Service Scope
                          </Button>
                        </Link>
                      </CardContent>
                  </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
