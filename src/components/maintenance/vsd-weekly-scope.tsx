'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const checklistItems = [
    { type: 'Acoustic Check', action: 'Listen for unusual noises.', lookFor: 'Grinding or clicking in cooling fans; humming or "singing" that sounds different than usual.' },
    { type: 'Visual Inspection', action: 'Check the exterior and environment.', lookFor: 'Excessive dust buildup on vents, signs of moisture/condensation, or any "burnt" smells.' },
    { type: 'Thermal Monitoring', action: 'Check the monitored temperature.', lookFor: "Ensure the internal temperature (available on the display) is within the manufacturer's spec." },
    { type: 'Environment Log', action: 'Record ambient conditions.', lookFor: 'Note the temperature and humidity of the room where the VSD is housed.' },
    { type: 'Electrical Logging', action: 'Record operating data.', lookFor: 'Log the DC Bus Voltage, Output Current, and Frequency. Sudden deviations can signal motor or capacitor issues.' },
    { type: 'Ventilation Check', action: 'Inspect airflow paths.', lookFor: 'Ensure that nothing is blocking the intake or exhaust of the drive cabinet.' },
];

export function VsdWeeklyScopeDocument() {
  const title = "VSDs Weekly Service Scope";

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background">
      <div className="flex justify-end mb-4 gap-2 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      <Card className="p-8 shadow-lg border-2 border-primary/20 bg-card">
        <header className="flex items-start justify-between mb-8">
          <div>
            <AltekLogo className="h-12 w-auto" />
            <p className="text-muted-foreground mt-2">VSD & Equipment Services</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-primary">{title}</h2>
            <p className="text-muted-foreground">Service Document</p>
          </div>
        </header>
        
        <div className="prose prose-sm max-w-none dark:prose-invert">
            <p className="lead">Maintaining a Variable Speed Drive (VSD)—also known as a Variable Frequency Drive (VFD)—on a weekly basis is primarily about monitoring and data logging.</p>
            <p>Because VSDs are sensitive electronic devices, weekly tasks focus on catching early warning signs (heat, noise, and vibration) before they lead to a system trip or component failure.</p>
        </div>

        <Separator className="my-8" />

        <h3 className="text-xl font-bold mb-4">Weekly Maintenance Checklist</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task Type</TableHead>
                <TableHead>Action Item</TableHead>
                <TableHead>What to Look For</TableHead>
                <TableHead className="text-center">Checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checklistItems.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.type}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell>{item.lookFor}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox aria-label={`Check task ${item.type}`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        
        <div className="mt-8 prose prose-sm max-w-none dark:prose-invert">
            <h3 className="text-xl font-bold mb-4">Pro-Tips for Weekly Upkeep</h3>
            <ul>
                <li><strong>The "Heat" Rule:</strong> For every 10°C rise in operating temperature, the lifespan of a VSD's capacitors is roughly halved. Weekly temperature logging is your best defense against premature aging.</li>
                <li><strong>Don't Open the Door (If Possible):</strong> For weekly checks, avoid opening the cabinet while the drive is energized unless you are wearing proper PPE and it is necessary for a reading. Most data can be pulled from the digital keypad/HMI.</li>
                <li><strong>Check the Fault History:</strong> Even if the drive hasn't tripped, check the fault log for "soft" warnings or auto-resets that happened during the week.</li>
            </ul>

            <h3 className="text-xl font-bold mt-6 mb-4">When to do more?</h3>
            <p>If your VSD is in a harsh environment (e.g., a sawmill with high dust or a pumping station with high humidity), you may need to move "Monthly" tasks like cleaning/replacing filters to your weekly schedule.</p>
        </div>
        
        <Separator className="my-8" />

        <h3 className="text-xl font-bold mb-4">Thermal Image Upload</h3>
        <Card>
            <CardContent className="pt-6">
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="thermal-image">Thermal Image of VSD</Label>
                        <Input id="thermal-image" type="file" className="file:text-foreground" />
                        <p className="text-xs text-muted-foreground">Upload a thermal image taken during the inspection.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="image-date">Date of Image</Label>
                        <Input id="image-date" type="date" />
                    </div>
                </div>
            </CardContent>
        </Card>


        <footer className="mt-16 text-xs text-muted-foreground text-center">
          <p>Altek Green - Confidential</p>
        </footer>
      </Card>
    </div>
  );
}
