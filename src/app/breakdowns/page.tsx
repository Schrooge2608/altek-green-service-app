'use client';

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
import { PlusCircle, CheckCircle } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { Breakdown } from '@/lib/types';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';

export default function BreakdownsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const breakdownsQuery = useMemoFirebase(() => collection(firestore, 'breakdown_reports'), [firestore]);
  const { data: breakdowns, isLoading } = useCollection<Breakdown>(breakdownsQuery);

  const handleResolve = (breakdown: Breakdown) => {
    const breakdownRef = doc(firestore, 'breakdown_reports', breakdown.id);
    updateDocumentNonBlocking(breakdownRef, { resolved: true });
    toast({
        title: "Breakdown Resolved",
        description: `The issue for ${breakdown.equipmentName} has been marked as resolved.`,
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Breakdown Log</h1>
          <p className="text-muted-foreground">
            History of all reported equipment breakdowns.
          </p>
        </div>
        <Link href="/breakdowns/new" passHref>
          <Button variant="destructive">
              <PlusCircle className="mr-2 h-4 w-4" />
              Report New Breakdown
          </Button>
        </Link>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">Loading breakdowns...</TableCell>
                </TableRow>
              ) : breakdowns && breakdowns.length > 0 ? (
                breakdowns.map((b) => (
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
                    <TableCell className="text-right">
                      {!b.resolved && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="sm">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Resolve
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will mark the breakdown for <span className="font-semibold">{b.equipmentName}</span> as resolved. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleResolve(b)}>
                                Continue
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">No breakdowns found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
