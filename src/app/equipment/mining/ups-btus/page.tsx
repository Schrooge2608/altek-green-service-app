
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from "@/components/ui/alert-dialog";

const btuData = [
  {
    name: "BTU's (Silicon, Electrical Manufacturing - 10amp)",
    amount: 10,
    assignedTo: 'N/A',
    breakdownStatus: 'None',
    uptime: '100%',
    power: '0 kWh',
  }
];

const upsData = [
  {
    name: "UPS's (Riello HPS, MPM, MPS - 10kva to 20kva)",
    amount: 40,
    assignedTo: 'N/A',
    breakdownStatus: 'None',
    uptime: '100%',
    power: '0 kWh',
  }
];

export default function UpsBtusPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRoleRef);
  const canDelete = userData?.role && ['Admin', 'Superadmin'].includes(userData.role);
  const isClientManager = userData?.role === 'Client Manager';

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipment: UPS/BTU's</h1>
          <p className="text-muted-foreground">
            All monitored UPS and BTU units in the Mining plant.
          </p>
        </div>
        {!isClientManager && (
          <Link href="/equipment/new" passHref>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Equipment
            </Button>
          </Link>
        )}
      </header>

      <Accordion type="multiple" className="w-full" defaultValue={['item-btus', 'item-ups']}>
        <AccordionItem value="item-btus">
          <AccordionTrigger className="text-xl font-semibold">
            BTU's ({btuData.length})
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Breakdown Status</TableHead>
                      <TableHead className="text-right">Uptime</TableHead>
                      <TableHead className="text-right">Power (kWh)</TableHead>
                      {canDelete && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {btuData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.amount}</TableCell>
                        <TableCell>{item.assignedTo}</TableCell>
                        <TableCell><Badge variant="outline">{item.breakdownStatus}</Badge></TableCell>
                        <TableCell className="text-right"><Badge variant="default">{item.uptime}</Badge></TableCell>
                        <TableCell className="text-right">{item.power}</TableCell>
                        {canDelete && (
                          <TableCell className="text-right">
                             <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" disabled>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="item-ups">
          <AccordionTrigger className="text-xl font-semibold">
            UPS's ({upsData.length})
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Breakdown Status</TableHead>
                      <TableHead className="text-right">Uptime</TableHead>
                      <TableHead className="text-right">Power (kWh)</TableHead>
                      {canDelete && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upsData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.amount}</TableCell>
                        <TableCell>{item.assignedTo}</TableCell>
                        <TableCell><Badge variant="outline">{item.breakdownStatus}</Badge></TableCell>
                        <TableCell className="text-right"><Badge variant="default">{item.uptime}</Badge></TableCell>
                        <TableCell className="text-right">{item.power}</TableCell>
                        {canDelete && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" disabled>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
