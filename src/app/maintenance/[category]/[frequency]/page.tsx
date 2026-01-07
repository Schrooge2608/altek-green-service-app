
'use client';

import { useParams, notFound } from 'next/navigation';
import { MaintenanceScopeDocument } from '@/components/maintenance-scope-document';

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

  const title = `${category} ${frequency} Service Scope`;

  return <MaintenanceScopeDocument title={title} />;
}
