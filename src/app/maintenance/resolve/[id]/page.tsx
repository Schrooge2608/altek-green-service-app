'use client';

import { useParams, notFound } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { ScheduledTask } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { VsdWeeklyScopeDocument } from '@/components/maintenance/vsd-weekly-scope';
import { VsdMonthlyScopeDocument } from '@/components/maintenance/vsd-monthly-scope';
import { Vsd3MonthlyScopeDocument } from '@/components/maintenance/vsd-3-monthly-scope';
import { Vsd6MonthlyScopeDocument } from '@/components/maintenance/vsd-6-monthly-scope';
import { VsdYearlyScopeDocument } from '@/components/maintenance/vsd-yearly-scope';
import { Protection6MonthlyScopeDocument } from '@/components/maintenance/protection-6-monthly-scope';
import { MaintenanceScopeDocument } from '@/components/maintenance-scope-document';

export default function ResolveSchedulePage() {
    const params = useParams();
    const id = typeof params.id === 'string' ? params.id : '';
    const firestore = useFirestore();

    const scheduleRef = useMemoFirebase(() => doc(firestore, 'upcoming_schedules', id), [firestore, id]);
    const { data: schedule, isLoading } = useDoc<ScheduledTask>(scheduleRef);

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2">Loading schedule...</p>
            </div>
        );
    }

    if (!schedule) {
        notFound();
        return null;
    }

    const { component, frequency } = schedule;

    // Specific component mappings, now passing the full schedule object
    if (component === 'VSD' && frequency === 'Weekly') {
        return <VsdWeeklyScopeDocument schedule={schedule} />;
    }
    if (component === 'VSD' && frequency === 'Monthly') {
        return <VsdMonthlyScopeDocument schedule={schedule} />;
    }
    if (component === 'VSD' && frequency === '3-Monthly') {
        return <Vsd3MonthlyScopeDocument schedule={schedule} />;
    }
    if (component === 'VSD' && frequency === '6-Monthly') {
        return <Vsd6MonthlyScopeDocument schedule={schedule} />;
    }
    if (component === 'VSD' && frequency === 'Yearly') {
        return <VsdYearlyScopeDocument schedule={schedule} />;
    }
    if (component === 'Protection' && frequency === '6-Monthly') {
        return <Protection6MonthlyScopeDocument schedule={schedule} />;
    }

    // Fallback to the generic document, passing the schedule data
    const title = `${component} ${frequency} Service Scope`;
    return <MaintenanceScopeDocument title={title} component={component} frequency={frequency} schedule={schedule} />;
}
