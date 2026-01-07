
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MaintenancePage() {
  const serviceScopes = [
    { title: 'Weekly Service Scope', frequency: 'Weekly' },
    { title: 'Monthly Service Scope', frequency: 'Monthly' },
    { title: '3-Monthly Service Scope', frequency: '3-Monthly' },
    { title: '6-Monthly Service Scope', frequency: '6-Monthly' },
    { title: 'Yearly Service Scope', frequency: 'Yearly' },
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

      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">VSD'S</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
            {serviceScopes.map(scope => (
                <Card key={scope.frequency}>
                    <CardHeader>
                        <CardTitle className="text-lg">{scope.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button disabled className="w-full">
                            View Service Scope
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-4 mt-8">Protection</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
            {serviceScopes.map(scope => (
                <Card key={`protection-${scope.frequency}`}>
                    <CardHeader>
                        <CardTitle className="text-lg">{scope.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button disabled className="w-full">
                            View Service Scope
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-4 mt-8">Motors</h2>
      </div>
    </div>
  );
}
