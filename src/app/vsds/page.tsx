'use client';

import Link from 'next/link';
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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { VSD } from '@/lib/types';

type StatusVariant = "default" | "secondary" | "destructive";

const statusVariantMap: Record<string, StatusVariant> = {
  active: 'default',
  maintenance: 'secondary',
  inactive: 'destructive',
};

export default function VsdsPage() {
  const firestore = useFirestore();
  const vsdsQuery = useMemoFirebase(() => collection(firestore, 'vsds'), [firestore]);
  const { data: vsds, isLoading } = useCollection<VSD>(vsdsQuery);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VSDs</h1>
          <p className="text-muted-foreground">
            Manage all Variable Speed Drives in the system.
          </p>
        </div>
        <Link href="/vsds/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New VSD
          </Button>
        </Link>
      </header>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial Number</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Linked Equipment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Installation Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">Loading VSDs...</TableCell>
                </TableRow>
              ) : vsds && vsds.length > 0 ? (
                vsds.map((vsd) => (
                  <TableRow key={vsd.id}>
                    <TableCell className="font-medium">{vsd.serialNumber}</TableCell>                  
                    <TableCell>{vsd.model}</TableCell>
                    <TableCell>
                      <Link href={`/equipment/${vsd.equipmentId}`} className="text-primary hover:underline">
                          {vsd.equipmentId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariantMap[vsd.status]}>
                        {vsd.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{vsd.installationDate}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">No VSDs found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
