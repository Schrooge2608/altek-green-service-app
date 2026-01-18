'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BarChart2 } from 'lucide-react';
import React, { useMemo } from 'react';

// Helper to convert slug back to title case
function slugToTitle(slug: string) {
    if (!slug) return '';
    return slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

export default function DivisionReportPage() {
    const params = useParams();
    const router = useRouter();
    
    const plantSlug = Array.isArray(params.plant) ? params.plant[0] : params.plant;
    const divisionSlug = Array.isArray(params.division) ? params.division[0] : params.division;

    const pageTitle = useMemo(() => {
        if (!plantSlug || !divisionSlug) return 'Detailed Report';
        const plantName = slugToTitle(plantSlug);
        const divisionName = slugToTitle(divisionSlug);
        return `Report for: ${plantName} - ${divisionName}`;
    }, [plantSlug, divisionSlug]);

    return (
        <div className="flex flex-col gap-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
                    <p className="text-muted-foreground">
                        Detailed performance breakdown by sub-location.
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.push('/reports')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Main Reports
                </Button>
            </header>

            <Card className="flex flex-col items-center justify-center text-center p-8 gap-4 min-h-[400px]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-4">
                        <BarChart2 className="h-12 w-12 text-muted-foreground" />
                        Detailed Charts Coming Soon
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground max-w-md">
                        This page will soon display detailed performance charts for each location within the {slugToTitle(divisionSlug)} division, such as {plantSlug === 'mining' ? "Concentrator Boosters and Tailings Booster Pumps" : "Smelter Area 1 and Smelter Area 2"}.
                    </p>
                </CardContent>
            </Card>

        </div>
    );
}
