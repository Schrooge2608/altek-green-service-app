
'use client';

import { useFirestore, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Database, ShieldAlert } from 'lucide-react';
import React from 'react';
import { seedDatabase } from '@/lib/seed-data';

export default function SeedDataPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const handleSeed = () => {
    seedDatabase(firestore);
  };

  // For simplicity, we assume anyone who can access this page is an admin.
  // Proper role-based access control should be added.
  if (!user) {
    return (
      <Card className="flex flex-col items-center justify-center text-center p-8 gap-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <CardTitle>Access Denied</CardTitle>
        <CardContent>
          <p className="text-muted-foreground">
            You must be an administrator to access this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Seed Database
        </h1>
        <p className="text-muted-foreground">
          Populate the Firestore database with initial equipment data.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Seed Equipment Data</CardTitle>
          <CardDescription>
            This action will add a predefined list of equipment and VSDs to your
            database. This should only be done once on a new project.
            Running it again may overwrite existing data if IDs match.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start gap-4">
            <p>Click the button below to start the seeding process.</p>
            <Button onClick={handleSeed}>
              <Database className="mr-2 h-4 w-4" />
              Seed Database
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
