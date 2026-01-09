
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

// Conditionally import the seed function
let seedDatabase: ((firestore: any) => void) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const seedModule = require('@/lib/seed-data');
  if (seedModule && typeof seedModule.seedDatabase === 'function') {
    seedDatabase = seedModule.seedDatabase;
  }
} catch (error) {
  // This is expected when the file doesn't exist.
  console.log('No seed-data file found. Seeding will be disabled.');
}


export default function SeedDataPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const handleSeed = () => {
    if (seedDatabase && firestore) {
      seedDatabase(firestore);
    } else {
        alert("No seed data is available to load.");
    }
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

  const isSeedDataAvailable = seedDatabase !== null;

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
            {isSeedDataAvailable 
              ? "A new data file is ready to be loaded. This action will add its contents to your database."
              : "No new data is available to seed. Please provide a new equipment list to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start gap-4">
             {isSeedDataAvailable 
              ? <p>Click the button below to start the seeding process.</p>
              : <p className="text-muted-foreground">The seed button is disabled because no data file was found.</p>}
            <Button onClick={handleSeed} disabled={!isSeedDataAvailable}>
              <Database className="mr-2 h-4 w-4" />
              Seed Database
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
