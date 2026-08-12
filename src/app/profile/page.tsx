
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import type { User } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { redirect } from 'next/navigation';

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

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
      return <UserProfileSkeleton />
  }

  if (user) {
    redirect(`/profile/${user.uid}`);
  }

  return <NotAuthenticated />;
}
