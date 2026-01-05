import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { maintenanceTasks } from '@/lib/data';
import { MaintenanceSchedule } from '@/components/maintenance-schedule';

export default function MaintenancePage() {
  const weeklyTasks = maintenanceTasks.filter(t => t.frequency === 'Weekly');
  const monthlyTasks = maintenanceTasks.filter(t => t.frequency === 'Monthly');
  const quarterlyTasks = maintenanceTasks.filter(t => t.frequency === '3-Monthly');

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Maintenance Schedule</h1>
        <p className="text-muted-foreground">
          Generate and view maintenance tasks for all equipment.
        </p>
      </header>
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="weekly">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="quarterly">3-Monthly</TabsTrigger>
            </TabsList>
            <TabsContent value="weekly">
              <MaintenanceSchedule title="Weekly Tasks" tasks={weeklyTasks} />
            </TabsContent>
            <TabsContent value="monthly">
              <MaintenanceSchedule title="Monthly Tasks" tasks={monthlyTasks} />
            </TabsContent>
            <TabsContent value="quarterly">
              <MaintenanceSchedule title="3-Monthly Tasks" tasks={quarterlyTasks} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
