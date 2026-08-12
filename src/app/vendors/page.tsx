
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, ShieldAlert, Loader2 } from 'lucide-react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User } from '@/lib/types';


function AccessDenied() {
    return (
        <Card className="flex flex-col items-center justify-center text-center p-8 gap-4 min-h-[400px]">
             <CardHeader>
                <CardTitle className="flex items-center gap-4"><ShieldAlert className="h-12 w-12 text-destructive" /> Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">You do not have permission to view this page. This feature is currently in beta.</p>
            </CardContent>
        </Card>
    );
}

export default function VendorsPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userData, isLoading: userRoleLoading } = useDoc<User>(userRoleRef);

    const isLoading = isUserLoading || userRoleLoading;

    if (isLoading) {
        return (
             <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2">Verifying permissions...</p>
            </div>
        )
    }

    const canViewBeta = userData?.role && ['Admin', 'Superadmin', 'Beta Tester'].includes(userData.role);

    if (!canViewBeta) {
        return (
             <div className="flex flex-col gap-8">
                <header>
                    <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
                    <p className="text-muted-foreground">
                        Manage all your vendors and suppliers.
                    </p>
                </header>
                <AccessDenied />
            </div>
        )
    }
    
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
        <p className="text-muted-foreground">
          Manage all your vendors and suppliers.
        </p>
      </header>
      <Card className="flex flex-col items-center justify-center text-center p-8 gap-4 min-h-[400px]">
        <CardHeader>
            <CardTitle className="flex items-center gap-4"><Store className="h-12 w-12 text-muted-foreground" /> Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">This feature is currently under construction.</p>
        </CardContent>
      </Card>
    </div>
  );
}
