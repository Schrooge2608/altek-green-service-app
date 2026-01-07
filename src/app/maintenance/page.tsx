
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function MaintenancePage() {
  const serviceScopes = [
    { title: 'Weekly Service Scope', frequency: 'weekly' },
    { title: 'Monthly Service Scope', frequency: 'monthly' },
    { title: '3-Monthly Service Scope', frequency: '3-monthly' },
    { title: '6-Monthly Service Scope', frequency: '6-monthly' },
    { title: 'Yearly Service Scope', frequency: 'yearly' },
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
          <h2 className="text-2xl font-semibold tracking-tight mb-4 mt-8">{category.name.toUpperCase()}</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
              {serviceScopes.map(scope => (
                  <Card key={`${category.slug}-${scope.frequency}`}>
                      <CardHeader>
                          <CardTitle className="text-lg">{scope.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Link href={`/maintenance/${category.slug}/${scope.frequency}`} passHref>
                          <Button className="w-full">
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
