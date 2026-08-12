
'use client';

import { UserAuthForm } from '@/components/user-auth-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function NewUserPage() {
    const router = useRouter();

    const handleSuccess = () => {
        router.push('/admin/users');
    };

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Add New User</h1>
                <p className="text-muted-foreground">
                    Create a new user account and assign them a role.
                </p>
            </header>
            <Card>
                <CardHeader>
                    <CardTitle>User Details</CardTitle>
                    <CardDescription>
                        The user will be created in Firebase Authentication, and their profile will be stored in Firestore.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
                        <UserAuthForm mode="createUser" onSuccess={handleSuccess} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
