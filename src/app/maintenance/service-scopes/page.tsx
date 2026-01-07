
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

const serviceScopes = [
  {
    title: 'Weekly VSD Service',
    description: 'Standard scope of work for weekly VSD servicing.',
    href: '/maintenance/service-scopes/weekly',
  },
  {
    title: 'Monthly VSD Service',
    description: 'Standard scope of work for monthly VSD servicing.',
    href: '/maintenance/service-scopes/monthly',
  },
  {
    title: '3-Monthly VSD Service',
    description: 'Standard scope of work for quarterly VSD servicing.',
    href: '/maintenance/service-scopes/3-monthly',
  },
  {
    title: '6-Monthly VSD Service',
    description: 'Standard scope of work for bi-annual VSD servicing.',
    href: '/maintenance/service-scopes/6-monthly',
  },
  {
    title: 'Yearly VSD Service',
    description: 'Standard scope of work for annual VSD servicing.',
    href: '/maintenance/service-scopes/yearly',
  },
]

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
        {serviceScopes.map((scope) => (
            <Card key={scope.href}>
                <CardHeader>
                    <CardTitle>{scope.title}</CardTitle>
                    <CardDescription>
                        {scope.description}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href={scope.href} passHref>
                    <Button className="w-full">
                        <BookOpen className="mr-2 h-4 w-4" />
                        View Scope
                    </Button>
                    </Link>
                </CardContent>
            </Card>
        ))}
      </div>
    </div>
  );
}
