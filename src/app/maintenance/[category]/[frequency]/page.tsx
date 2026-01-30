
'use client';

import { useParams, notFound } from 'next/navigation';
import { MaintenanceScopeDocument } from '@/components/maintenance-scope-document';
import { VsdWeeklyScopeDocument } from '@/components/maintenance/vsd-weekly-scope';
import { VsdMonthlyScopeDocument } from '@/components/maintenance/vsd-monthly-scope';
import { Vsd3MonthlyScopeDocument } from '@/components/maintenance/vsd-3-monthly-scope';
import { Vsd6MonthlyScopeDocument } from '@/components/maintenance/vsd-6-monthly-scope';
import { VsdYearlyScopeDocument } from '@/components/maintenance/vsd-yearly-scope';
import { Protection6MonthlyScopeDocument } from '@/components/maintenance/protection-6-monthly-scope';
import type { MaintenanceTask } from '@/lib/types';

const validCategories: Record<string, string> = {
  vsds: 'VSDs',
  protection: 'Protection',
  motors: 'Motors',
  pumps: 'Pumps',
  'ups-btus': "UPS/BTU's",
};

const validFrequencies: Record<string, string> = {
  '3-monthly': '3-Monthly',
  '6-monthly': '6-Monthly',
  yearly: 'Yearly',
};

const slugToComponentMap: Record<string, MaintenanceTask['component']> = {
    'vsds': 'VSD',
    'protection': 'Protection',
    'motors': 'Motor',
    'pumps': 'Pump',
    'ups-btus': 'UPS',
};

export default function MaintenanceScopePage() {
  const params = useParams();
  const categorySlug = params.category as string;
  const frequencySlug = params.frequency as string;

  const category = validCategories[categorySlug];
  const frequency = validFrequencies[frequencySlug] as MaintenanceTask['frequency'];
  const component = slugToComponentMap[categorySlug];

  if (!category || !frequency || !component) {
    notFound();
    return null;
  }

  // Specific component for VSD 3-Monthly Scope
  if (categorySlug === 'vsds' && frequencySlug === '3-monthly') {
    return <Vsd3MonthlyScopeDocument />;
  }
  
  // Specific component for VSD 6-Monthly Scope
  if (categorySlug === 'vsds' && frequencySlug === '6-monthly') {
    return <Vsd6MonthlyScopeDocument />;
  }

  // Specific component for VSD Yearly Scope
  if (categorySlug === 'vsds' && frequencySlug === 'yearly') {
    return <VsdYearlyScopeDocument />;
  }

  // Specific component for Protection 6-Monthly Scope
  if (categorySlug === 'protection' && frequencySlug === '6-monthly') {
    return <Protection6MonthlyScopeDocument />;
  }

  const title = `${category} ${frequency} Service Scope`;

  return <MaintenanceScopeDocument title={title} component={component} frequency={frequency} />;
}
