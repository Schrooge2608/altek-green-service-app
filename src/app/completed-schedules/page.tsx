'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronRight, Wrench, Shield, CircuitBoard, Droplets } from 'lucide-react';

const categories = [
    { name: 'VSDs', slug: 'vsds', description: 'Variable Speed Drives', icon: CircuitBoard },
    { name: 'Protection', slug: 'protection', description: 'Circuit Breakers & Relays', icon: Shield },
    { name: 'Motors', slug: 'motors', description: 'Electric Motors', icon: Wrench },
    { name: 'Pumps', slug: 'pumps', description: 'Fluid Pumps', icon: Droplets },
];

export default function CompletedSchedulesLandingPage() {
    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Completed Maintenance</h1>
                <p className="text-muted-foreground">
                    Browse completed service documents by equipment discipline.
                </p>
            </header>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {categories.map(category => (
                    <Card key={category.slug}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <category.icon className="h-6 w-6 text-primary" />
                                {category.name}
                            </CardTitle>
                            <CardDescription>{category.description}</CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Link href={`/completed-schedules/${category.slug}`} passHref>
                                <Button variant="outline">
                                    View Documents
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
