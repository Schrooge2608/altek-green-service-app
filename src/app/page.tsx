
'use client';

import { PlantDashboard } from '@/components/plant-dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { LogIn } from 'lucide-react';
import Link from 'next/link';

function AuthenticatedDashboard() {
  return (
    <div className="grid grid-cols-1 gap-8">
      <PlantDashboard plantName="Mining" divisionName="Boosters" />
      <PlantDashboard plantName="Mining" divisionName="Dredgers" />
      <PlantDashboard plantName="Mining" divisionName="Pump Stations" />
      <PlantDashboard plantName="Smelter" />
    </div>
  );
}

function UnauthenticatedDashboard() {
    return (
        <Card className="flex flex-col items-center justify-center text-center p-8 gap-4">
            <CardTitle>Welcome to the Altek Green VSD Data Base</CardTitle>
            <CardContent>
                <p className="text-muted-foreground mb-4">Please log in to view the dashboard and manage your equipment.</p>
                <Link href="/auth/register" passHref>
                    <Button>
                        <LogIn className="mr-2 h-4 w-4" />
                        Login or Register
                    </Button>
                </Link>
            </CardContent>
        </Card>
    );
}


export default function Home() {
  const { user, isUserLoading } = useUser();
  
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        {!isUserLoading && !user && (
            <p className="text-muted-foreground">
                Please log in to continue.
            </p>
        )}
        {!isUserLoading && user && (
            <p className="text-muted-foreground">
                Welcome back! Here's an overview of your operations.
            </p>
        )}
      </header>

      {isUserLoading ? (
        <p>Loading...</p>
      ) : user ? (
        <AuthenticatedDashboard />
      ) : (
        <UnauthenticatedDashboard />
      )}
    </div>
  );
}
