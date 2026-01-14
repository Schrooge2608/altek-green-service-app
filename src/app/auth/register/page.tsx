
'use client';

import { UserAuthForm } from '@/components/user-auth-form';
import { AltekLogo } from '@/components/altek-logo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function RegisterPage() {
    return (
        <div className="container relative h-svh flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
            <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
                <div
                    className="absolute inset-0 bg-cover"
                    style={{
                        backgroundImage:
                        'url(/Pump.jpg)',
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
                     <Tabs defaultValue="login" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Sign In</TabsTrigger>
                        <TabsTrigger value="createUser">Create Account</TabsTrigger>
                      </TabsList>
                      <TabsContent value="login">
                        <UserAuthForm mode="login" />
                      </TabsContent>
                      <TabsContent value="createUser">
                        <UserAuthForm mode="createUser" />
                      </TabsContent>
                    </Tabs>
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
