
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, useFirestore, useMemoFirebase } from '@/firebase';
import type { User } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useParams, notFound } from 'next/navigation';

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
  );
}

function NotAuthenticated() {
  return (
    <Card className="flex flex-col items-center justify-center text-center p-8 gap-4">
      <ShieldAlert className="h-16 w-16 text-destructive" />
      <CardTitle>Authentication Required</CardTitle>
      <CardContent>
        <p className="text-muted-foreground">
          You must be logged in to view your profile.
        </p>
      </CardContent>
    </Card>
  );
}

function ProfileDetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-sm py-2 border-b">
      <span className="font-semibold text-muted-foreground w-48 shrink-0">
        {label}:
      </span>
      <span className="flex-1 break-words">
        {value || <span className="text-muted-foreground/70">Not set</span>}
      </span>
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userRef = useMemoFirebase(
    () => (id ? doc(firestore, 'users', id) : null),
    [firestore, id]
  );
  const { data: userData, isLoading: userDataLoading } = useDoc<User>(userRef);

  const isLoading = isUserLoading || userDataLoading;

  if (isLoading) {
    return <UserProfileSkeleton />;
  }

  if (!user) {
    return <NotAuthenticated />;
  }

  if (!userData) {
    notFound();
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{userData.name}'s Profile</h1>
        <p className="text-muted-foreground">
          Viewing user account details. Contact an administrator to make changes.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Official Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileDetailRow label="Name" value={userData?.name} />
          <ProfileDetailRow
            label="Email"
            value={userData?.email}
          />
          <ProfileDetailRow
            label="Role"
            value={
              userData && (
                <Badge
                  variant={
                    userData.role?.includes('Admin') ||
                    userData.role?.includes('Super')
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {userData.role}
                </Badge>
              )
            }
          />
          <ProfileDetailRow label="SAP Number" value={userData?.sapNumber} />
          <ProfileDetailRow
            label="Qualifications"
            value={userData?.qualifications}
          />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Contact &amp; Emergency Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
            <ProfileDetailRow label="Phone Number" value={userData?.phoneNumber} />
            <ProfileDetailRow label="Home Address" value={userData?.address} />
            <ProfileDetailRow label="Next of Kin Name" value={userData?.nextOfKinName} />
            <ProfileDetailRow label="Next of Kin Phone" value={userData?.nextOfKinPhone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>RBM Information</CardTitle>
          <CardDescription>
            Contract Start Date: 1 September 2025 | Contract End Date: 31 August 2028
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileDetailRow
            label="Designated Leader"
            value={userData?.designatedLeaderName}
          />
          <ProfileDetailRow
            label="Responsible Gen Manager"
            value={userData?.responsibleGenManager}
          />
          <ProfileDetailRow label="Department" value={userData?.department} />
          <ProfileDetailRow label="Section" value={userData?.section} />
          <ProfileDetailRow
            label="Purchase Order No."
            value={userData?.purchaseOrderNo}
          />
          <ProfileDetailRow
            label="Justification"
            value={userData?.justification}
          />
        </CardContent>
      </Card>

    </div>
  );
}
