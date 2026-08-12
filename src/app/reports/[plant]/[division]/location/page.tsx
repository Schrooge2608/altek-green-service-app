'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * This page is a literal segment redirect to resolve conflicts with the dynamic [location] route.
 */
export default function LocationLiteralRedirectPage() {
    const router = useRouter();
    const params = useParams();

    useEffect(() => {
        const plant = params.plant as string;
        const division = params.division as string;
        
        // Redirect to the dynamic handler if literal segment parameters are present
        if (plant && division) {
            router.replace(`/reports/${plant}/${division}/general`);
        }
    }, [router, params]);

    return (
        <div className="flex h-screen items-center justify-center">
            <div className="text-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground animate-pulse">Resolving location report...</p>
            </div>
        </div>
    );
}