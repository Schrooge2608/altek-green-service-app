
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
import { doc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
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
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-6 w-24" />
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

function ProfileDetailRow({ label, value }: { label: string, value?: string | React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-sm py-2 border-b">
            <span className="font-semibold text-muted-foreground w-40">{label}:</span>
            <span className="flex-1">{value || <span className="text-muted-foreground/70">Not set</span>}</span>
        </div>
    )
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

  // The password change logic has been removed as per the new design.
  // The form and onSubmit function are kept for future use if needed, but are not active.
  
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
            <CardDescription>This is your personal information as it appears in the system. Please contact an admin to update it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
            <ProfileDetailRow label="Name" value={userData?.name} />
            <ProfileDetailRow label="Email" value={userData?.email} />
            <ProfileDetailRow label="Role" value={userData && <Badge variant={userData.role === 'Admin' ? 'destructive' : 'secondary'}>{userData.role}</Badge>} />
            <ProfileDetailRow label="Phone Number" value={userData?.phoneNumber} />
            <ProfileDetailRow label="Address" value={userData?.address} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Emergency Contact</CardTitle>
            <CardDescription>Next of kin information on file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
            <ProfileDetailRow label="Next of Kin Name" value={userData?.nextOfKinName} />
            <ProfileDetailRow label="Next of Kin Phone" value={userData?.nextOfKinPhone} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">If you've forgotten your password or wish to change it, you can request a reset link to be sent to your registered email address.</p>
            <Button type="button" variant="outline" onClick={handlePasswordReset}>
                Send Password Reset Email
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
