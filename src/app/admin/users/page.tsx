
'use client';

import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, PlusCircle, Loader2, Pencil, Trash2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';
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

function UserList() {
    const firestore = useFirestore();
    const { user } = useUser(); // We need user to ensure we don't query when logged out
    const { toast } = useToast();

    const usersQuery = useMemoFirebase(() => {
        // We can safely create this query because this component only renders for Admins who are logged in
        if (!user) return null;
        return collection(firestore, 'users');
    }, [firestore, user]);

    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

    const handleDeleteUser = (userToDelete: User) => {
        if (!userToDelete.id) {
            toast({
                variant: "destructive",
                title: 'Error',
                description: `User ID is missing, cannot delete.`,
            });
            return;
        }
        const userRef = doc(firestore, 'users', userToDelete.id);
        deleteDocumentNonBlocking(userRef);
        toast({
            title: 'User Deleted',
            description: `${userToDelete.name} has been removed from the database. Note: This does not remove them from Firebase Authentication.`,
        });
    }

    if (usersLoading) {
        return (
             <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2">Loading users...</p>
            </div>
        );
    }
    
    return (
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
                            <TableHead>Phone Number</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users && users.length > 0 ? (
                            users.map((u) => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-medium">{u.name}</TableCell>
                                    <TableCell>{u.email}</TableCell>
                                    <TableCell>{u.phoneNumber || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Badge variant={u.role?.includes('Admin') || u.role?.includes('Super') ? 'destructive' : 'secondary'}>{u.role}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/admin/users/${u.id}/edit`} passHref>
                                            <Button variant="ghost" size="icon">
                                                <Pencil className="h-4 w-4" />
                                                <span className="sr-only">Edit User</span>
                                            </Button>
                                        </Link>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                 <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" disabled={!u.id}>
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="sr-only">Delete User</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action will permanently delete the user record for <strong>{u.name}</strong> from the database. 
                                                        It will not remove the user from Firebase Authentication. This cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                                        onClick={() => handleDeleteUser(u)}
                                                    >
                                                        Yes, delete user
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">No users found.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}


export default function UserManagementPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userRole, isLoading: userRoleLoading } = useDoc<User>(userRoleRef);
    
    const isLoading = isUserLoading || userRoleLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2">Verifying permissions...</p>
            </div>
        );
    }
    
    const isKnownAdmin = user && userRole?.role && (userRole.role.includes('Admin') || userRole.role.includes('Super'));

    return (
        <div className="flex flex-col gap-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground">
                        View and manage all registered users in the system.
                    </p>
                </div>
                {isKnownAdmin && (
                    <div className='flex items-center gap-2'>
                        <Link href="/admin/seed" passHref>
                            <Button variant="outline">
                                <Database className="mr-2 h-4 w-4" />
                                Seed Data
                            </Button>
                        </Link>
                        <Link href="/admin/users/new" passHref>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add User
                            </Button>
                        </Link>
                    </div>
                )}
            </header>
            
            {isKnownAdmin ? (
                <UserList />
            ) : (
                <AccessDenied />
            )}
        </div>
    );
}
