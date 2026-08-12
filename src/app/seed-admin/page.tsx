'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, UserPlus } from 'lucide-react';
import type { User } from '@/lib/types';

const ADMIN_EMAIL = 'superadmin@altek.com';
const ADMIN_PASSWORD = 'password123';

export default function SeedAdminPage() {
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeded, setIsSeeded] = useState(false);

  async function seedAdminUser() {
    setIsLoading(true);
    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      const newUser = userCredential.user;

      // Create user document in Firestore
      const userData: User = {
        id: newUser.uid,
        name: 'Super Admin',
        email: ADMIN_EMAIL,
        role: 'Superadmin',
      };
      await setDoc(doc(firestore, 'users', newUser.uid), userData);

      toast({
        title: 'Admin User Created',
        description: `Successfully created user with email: ${ADMIN_EMAIL}`,
      });
      setIsSeeded(true);
    } catch (error: any) {
      console.error('Error seeding admin user:', error);
      toast({
        variant: 'destructive',
        title: 'Error Seeding Admin',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Seed Superadmin</h1>
        <p className="text-muted-foreground">
          Create a new Superadmin user to test database connectivity.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Create Test Admin</CardTitle>
          <CardDescription>
            This will create a new user with the email <strong className="text-primary">{ADMIN_EMAIL}</strong> and password <strong className="text-primary">{ADMIN_PASSWORD}</strong>.
            Check both of your Firebase projects to see where this user is created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button onClick={seedAdminUser} disabled={isLoading || isSeeded}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {isSeeded ? 'Admin Created' : 'Create Superadmin User'}
            </Button>
            {isSeeded && (
                <p className="text-sm text-green-600">
                    Seeding complete. You can now try logging in with the new credentials.
                </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
