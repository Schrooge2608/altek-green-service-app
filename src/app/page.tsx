'use client';

import { PlantDashboard } from '@/components/plant-dashboard';

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the Altek Green VSD Data Base.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8">
        <PlantDashboard plantName="Mining" divisionName="Boosters" />
        <PlantDashboard plantName="Mining" divisionName="Pump Stations" />
        <PlantDashboard plantName="Smelter" />
      </div>
    </div>
  );
}
