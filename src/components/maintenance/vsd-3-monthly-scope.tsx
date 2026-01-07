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
        <div className="prose prose-sm max-w-none dark:prose-invert">
            <p>A 3-month (Quarterly) service schedule is often considered the "sweet spot" for industrial maintenance. It bridges the gap between simple visual checks and the major annual shutdown.</p>
            <p>At the 3-month mark, the goal is proactive prevention—catching the "silent killers" like loose terminals and parameter drift before they cause a breakdown.</p>
        </div>
      </Card>
    </div>
  );
}
