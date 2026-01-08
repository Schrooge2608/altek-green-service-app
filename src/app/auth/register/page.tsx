
'use client';

import { UserAuthForm } from '@/components/user-auth-form';
import { AltekLogo } from '@/components/altek-logo';
import { useUser } from '@/firebase';
import Link from 'next/link';

export default function RegisterPage() {
    const { user } = useUser();
    
    // We determine the mode based on whether an admin is logged in.
    // The UserAuthForm component itself will handle the toggle between login/signup for public users.
    const mode = user ? 'createUser' : 'public';

    return (
        <div className="container relative h-svh flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
             {mode === 'createUser' && (
                <Link
                    href="/admin/users"
                    className="absolute right-4 top-4 md:right-8 md:top-8"
                >
                    Back to User Management
                </Link>
             )}
            <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
                <div
                    className="absolute inset-0 bg-cover"
                    style={{
                        backgroundImage:
                        'url(https://images.unsplash.com/photo-1562813531-529ab21a43a8?q=80&w=1974&auto=format&fit=crop)',
                    }}
                />
                 <div className="relative z-20 flex items-center text-lg font-medium">
                    <AltekLogo className="h-12 w-auto" />
                </div>
                 <div className="relative z-20 mt-auto">
                    <blockquote className="space-y-2">
                    <p className="text-lg">
                        &ldquo;This platform has streamlined our entire maintenance workflow, saving us countless hours and preventing costly breakdowns.&rdquo;
                    </p>
                    <footer className="text-sm">Lead Site Supervisor</footer>
                    </blockquote>
                </div>
            </div>
            <div className="lg:p-8">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                    <UserAuthForm mode={mode} />
                    <p className="px-8 text-center text-sm text-muted-foreground">
                        By clicking continue, you agree to our{' '}
                        <a
                            href="/terms"
                            className="underline underline-offset-4 hover:text-primary"
                        >
                            Terms of Service
                        </a>{' '}
                        and{' '}
                        <a
                            href="/privacy"
                            className="underline underline-offset-4 hover:text-primary"
                        >
                            Privacy Policy
                        </a>
                        .
                    </p>
                </div>
            </div>
        </div>
    );
}
