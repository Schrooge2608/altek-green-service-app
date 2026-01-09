
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
import { useAuth, useUser, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import type { User } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';

const profileFormSchema = z.object({
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
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
            <span className="font-semibold text-muted-foreground w-48">{label}:</span>
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

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      phoneNumber: '',
      address: '',
      nextOfKinName: '',
      nextOfKinPhone: '',
    },
  });

  useEffect(() => {
    if (userData) {
      form.reset({
        phoneNumber: userData.phoneNumber || '',
        address: userData.address || '',
        nextOfKinName: userData.nextOfKinName || '',
        nextOfKinPhone: userData.nextOfKinPhone || '',
      });
    }
  }, [userData, form]);
  
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

  function onSubmit(values: z.infer<typeof profileFormSchema>) {
    if (!userRef) return;
    updateDocumentNonBlocking(userRef, values);
    toast({
      title: 'Profile Updated',
      description: 'Your contact and emergency information has been saved.',
    });
    form.reset(values); // Keep form values after successful submission
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
          View your account details and update your contact information.
        </p>
      </header>
        
      <Card>
        <CardHeader>
            <CardTitle>Official Information</CardTitle>
            <CardDescription>This information is managed by your administrator and cannot be changed here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
            <ProfileDetailRow label="Name" value={userData?.name} />
            <ProfileDetailRow label="Email" value={userData?.email} />
            <ProfileDetailRow label="Role" value={userData && <Badge variant={userData.role?.includes('Admin') || userData.role?.includes('Super') ? 'destructive' : 'secondary'}>{userData.role}</Badge>} />
            <ProfileDetailRow label="SAP Number" value={userData?.sapNumber} />
            <ProfileDetailRow label="Qualifications" value={userData?.qualifications} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>RBM Information</CardTitle>
          <CardDescription>This information is managed by your administrator.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileDetailRow label="Designated Leader" value={userData?.designatedLeaderName} />
          <ProfileDetailRow label="Responsible Gen Manager" value={userData?.responsibleGenManager} />
          <ProfileDetailRow label="Department" value={userData?.department} />
          <ProfileDetailRow label="Section" value={userData?.section} />
          <ProfileDetailRow label="Purchase Order No." value={userData?.purchaseOrderNo} />
          <ProfileDetailRow label="Starting Date" value={userData?.startingDate} />
          <ProfileDetailRow label="End Date" value={userData?.endDate} />
          <ProfileDetailRow label="Justification" value={userData?.justification} />
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>My Contact Information</CardTitle>
                    <CardDescription>You can update your personal contact details here.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., +27 12 345 6789" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <div className="md:col-span-2">
                        <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Home Address</FormLabel>
                            <FormControl>
                                <Textarea placeholder="e.g., 123 Industrial Way, Factory Town" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Emergency Contact</CardTitle>
                    <CardDescription>Update your next of kin information.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                     <FormField
                        control={form.control}
                        name="nextOfKinName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Next of Kin Name</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Jane Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="nextOfKinPhone"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Next of Kin Phone</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., +27 98 765 4321" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
                <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save My Info
                </Button>
            </div>
        </form>
      </Form>
      
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
