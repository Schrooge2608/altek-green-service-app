'use client';

import { Card } from '@/components/ui/card';

export function Vsd3MonthlyScopeDocument() {
  const title = "VSDs 3-Monthly Service Scope";

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background">
      <Card className="p-8 shadow-lg">
        <header className="mb-8">
          <h2 className="text-2xl font-bold text-primary">{title}</h2>
          <p className="text-muted-foreground">Service Document</p>
        </header>
        <div>
          <p>(Placeholder for 3-monthly scope content)</p>
        </div>
      </Card>
    </div>
  );
}
