
'use client';

import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, PlusCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function AccessDenied() {
    return (
        <Card className="flex flex-col items-center justify-center text-center p-8 gap-4">
            <ShieldAlert className="h-16 w-16 text-destructive" />
            <CardTitle>Access Denied</CardTitle>
            <CardContent>
                <p className="text-muted-foreground">You do not have the required permissions to view this page.</p>
            </CardContent>
        </Card>
    );
}

export default function UserManagementPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userRole, isLoading: userRoleLoading } = useDoc<User>(userRoleRef);

    const usersQuery = useMemoFirebase(() => {
        // Only create the query if we have confirmed the user is an Admin
        if (userRole?.role === 'Admin') {
            return collection(firestore, 'users');
        }
        return null; // Return null if not an admin
    }, [firestore, userRole]);

    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);
    
    const isLoading = isUserLoading || userRoleLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2">Loading user data...</p>
            </div>
        );
    }

    if (userRole?.role !== 'Admin') {
        return <AccessDenied />;
    }

    return (
        <div className="flex flex-col gap-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground">
                        View and manage all registered users in the system.
                    </p>
                </div>
                <Link href="/auth/register" passHref>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add User
                    </Button>
                </Link>
            </header>
            <Card>
                 <CardHeader>
                    <CardTitle>Registered Users</CardTitle>
                    <CardDescription>A list of all users who have access to the application.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {usersLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">Loading users...</TableCell>
                                </TableRow>
                            ) : users && users.length > 0 ? (
                                users.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">{u.name}</TableCell>
                                        <TableCell>{u.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={u.role === 'Admin' ? 'destructive' : 'secondary'}>{u.role}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">No users found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
