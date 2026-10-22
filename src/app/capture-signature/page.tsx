'use client';

import { useUser, useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { SignaturePinCard } from '@/components/profile/signature-pin-card';
import { Loader2 } from 'lucide-react';

export default function CaptureSignaturePage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading } = useDoc<User>(userDocRef);

  if (isUserLoading || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-muted-foreground">
        Please log in to configure your digital signature and 4-digit signing PIN.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Signature &amp; Security PIN</h1>
        <p className="text-muted-foreground">
          Draw your digital signature and set your 4-digit PIN for accepting IPR consumables and signing site documents.
        </p>
      </div>

      <SignaturePinCard targetUserId={user.uid} userData={userData} canEdit={true} />
    </div>
  );
}
