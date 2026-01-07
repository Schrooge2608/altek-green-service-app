
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, useFirestore, useMemoFirebase } from '@/firebase';
import type { User } from '@/lib/types';
import { doc, setDoc } from 'firebase/firestore';
import { updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const passwordFormSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters.'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});


function UserProfileSkeleton() {
    return (
        <div className="space-y-8">
            <header>
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-4 w-1/3 mt-2" />
            </header>
            <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-1/4" />
                    <Skeleton className="h-4 w-1/2 mt-1" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-4">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-40" />
                    </div>
                     <div className="flex items-center space-x-4">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-48" />
                    </div>
                     <div className="flex items-center space-x-4">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-6 w-24" />
                    </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-1/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-32" />
                </CardContent>
            </Card>
        </div>
    )
}

function NotAuthenticated() {
     return (
        <Card className="flex flex-col items-center justify-center text-center p-8 gap-4">
            <ShieldAlert className="h-16 w-16 text-destructive" />
            <CardTitle>Authentication Required</CardTitle>
            <CardContent>
                <p className="text-muted-foreground">You must be logged in to view your profile.</p>
            </CardContent>
        </Card>
    );
}

export default function ProfilePage() {
  const { toast } = useToast();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData, isLoading: userDataLoading } = useDoc<User>(userRef);

  const form = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
        newPassword: '',
        confirmPassword: '',
    },
  });
  
  const handlePasswordReset = async () => {
    if (user?.email) {
        try {
            await sendPasswordResetEmail(auth, user.email);
            toast({
                title: 'Password Reset Email Sent',
                description: `A password reset link has been sent to ${user.email}.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error Sending Reset Email',
                description: error.message,
            });
        }
    }
  }

  async function onSubmit(values: z.infer<typeof passwordFormSchema>) {
    if (!user) {
        toast({ variant: 'destructive', title: 'Not authenticated' });
        return;
    }

    try {
        await updatePassword(user, values.newPassword);
        toast({ title: 'Password Updated', description: 'Your password has been changed successfully.' });
        form.reset();
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error updating password',
            description: error.message,
        });
    }
  }
  
  const isLoading = isUserLoading || userDataLoading;

  if(isLoading) {
      return <UserProfileSkeleton />
  }

  if(!user) {
      return <NotAuthenticated />;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">
          View and manage your account details.
        </p>
      </header>
        
      <Card>
        <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>This is your personal information as it appears in the system.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center space-x-4 text-sm">
                <span className="font-semibold text-muted-foreground w-20">Name:</span>
                <span>{userData?.name}</span>
            </div>
             <div className="flex items-center space-x-4 text-sm">
                <span className="font-semibold text-muted-foreground w-20">Email:</span>
                <span>{userData?.email}</span>
            </div>
             <div className="flex items-center space-x-4 text-sm">
                <span className="font-semibold text-muted-foreground w-20">Role:</span>
                {userData && <Badge variant={userData.role === 'Admin' ? 'destructive' : 'secondary'}>{userData.role}</Badge>}
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="newPassword"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                            <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                            <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <div className="flex justify-between items-center">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Password
                        </Button>
                         <Button type="button" variant="link" onClick={handlePasswordReset}>
                            Forgot password?
                        </Button>
                    </div>
                </form>
            </Form>
        </CardContent>
      </Card>
    </div>
  );
}

