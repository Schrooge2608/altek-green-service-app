'use client';

import { useParams, notFound } from 'next/navigation';
import { MaintenanceScopeDocument } from '@/components/maintenance-scope-document';
import { VsdWeeklyScopeDocument } from '@/components/maintenance/vsd-weekly-scope';
import { VsdMonthlyScopeDocument } from '@/components/maintenance/vsd-monthly-scope';
import { Vsd3MonthlyScopeDocument } from '@/components/maintenance/vsd-3-monthly-scope';
import { Vsd6MonthlyScopeDocument } from '@/components/maintenance/vsd-6-monthly-scope';
import { VsdYearlyScopeDocument } from '@/components/maintenance/vsd-yearly-scope';

const validCategories: Record<string, string> = {
  vsds: 'VSDs',
  protection: 'Protection',
  motors: 'Motors',
  pumps: 'Pumps',
};

const validFrequencies: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  '3-monthly': '3-Monthly',
  '6-monthly': '6-Monthly',
  yearly: 'Yearly',
};

export default function MaintenanceScopePage() {
  const params = useParams();
  const categorySlug = Array.isArray(params.category) ? params.category[0] : params.category;
  const frequencySlug = Array.isArray(params.frequency) ? params.frequency[0] : params.frequency;

  const category = validCategories[categorySlug];
  const frequency = validFrequencies[frequencySlug];

  if (!category || !frequency) {
    notFound();
    return null;
  }

  // Specific component for VSD Weekly Scope
  if (categorySlug === 'vsds' && frequencySlug === 'weekly') {
    return <VsdWeeklyScopeDocument />;
  }

  // Specific component for VSD Monthly Scope
  if (categorySlug === 'vsds' && frequencySlug === 'monthly') {
    return <VsdMonthlyScopeDocument />;
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

  const title = `${category} ${frequency} Service Scope`;

  return <MaintenanceScopeDocument title={title} />;
}
