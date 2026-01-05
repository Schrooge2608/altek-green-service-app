import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { breakdowns } from '@/lib/data';
import Link from 'next/link';

export default function BreakdownsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Breakdown Log</h1>
          <p className="text-muted-foreground">
            History of all reported equipment breakdowns.
          </p>
        </div>
        <Button variant="destructive">
            <PlusCircle className="mr-2 h-4 w-4" />
            Report New Breakdown
        </Button>
      </header>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdowns.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.date}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/equipment/${b.equipmentId}`} className="hover:underline text-primary">
                        {b.equipmentName}
                    </Link>
                  </TableCell>
                  <TableCell>{b.description}</TableCell>
                  <TableCell>
                    <Badge variant={b.resolved ? 'default' : 'destructive'}>
                      {b.resolved ? 'Resolved' : 'Pending'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
