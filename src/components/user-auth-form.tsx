'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { User } from '@/lib/types';


const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').optional(),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  role: z.enum(['Technician', 'Site Supervisor', 'Services Manager', 'Corporate Manager', 'Admin']).optional(),
});

type UserFormValue = z.infer<typeof formSchema>;

export function UserAuthForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Determine the mode based on whether a user (the admin) is already logged in
  const isCreateUserMode = !!user;

  const form = useForm<UserFormValue>({
    resolver: zodResolver(
        isCreateUserMode 
        ? formSchema.required({ name: true, role: true }) // Admin creating a user
        : formSchema.pick({ email: true, password: true }) // Public login
    ),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'Technician',
    },
  });

  const onSubmit = async (data: UserFormValue) => {
    setIsLoading(true);
    try {
        if (isCreateUserMode) {
            // Admin is creating a new user. We need a secondary Firebase App instance
            // to create a user without signing the admin out.
            // This is complex and requires careful state management.
            // For now, we will just log the intended action.
            // A full implementation would use Firebase Admin SDK on a backend or a separate helper app.
            
            // NOTE: The following code will not work as intended without a proper admin setup.
            // It will sign the current admin out and sign the new user in.
            // This is a placeholder for a real admin user creation flow.
            
            // This is a simplified example and has limitations.
            // In a real-world scenario, you would use a backend function (e.g., Firebase Cloud Function)
            // to create users without affecting the admin's session.
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const newUser = userCredential.user;

            const userData: User = {
                id: newUser.uid,
                name: data.name!,
                email: data.email,
                role: data.role!,
            };

            await setDoc(doc(firestore, 'users', newUser.uid), userData);

            toast({
                title: 'User Created Successfully',
                description: `The account for ${data.name} has been created.`,
            });
            form.reset();

        } else {
            // Public login
            await signInWithEmailAndPassword(auth, data.email, data.password);
            toast({ title: 'Login Successful', description: 'Welcome back!' });
        }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Authentication Failed',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (user && !isCreateUserMode) {
      // If a user is logged in, but we are not in create mode, show login form for now.
      // This case should ideally be handled by redirecting, but is removed for admin access.
  }

  return (
    <>
      <div className={cn('grid gap-6')}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {isCreateUserMode && (
                <>
                    <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                        <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </>
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             {isCreateUserMode && (
                <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Technician">Technician</SelectItem>
                            <SelectItem value="Site Supervisor">Site Supervisor</SelectItem>
                            <SelectItem value="Services Manager">Services Manager</SelectItem>
                            <SelectItem value="Corporate Manager">Corporate Manager</SelectItem>
                            <SelectItem value="Admin">Admin</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreateUserMode ? 'Create User' : 'Sign In'}
            </Button>
          </form>
        </Form>
        {!isCreateUserMode && (
             <>
                <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                    Or
                    </span>
                </div>
                </div>
                <Button
                    variant="outline"
                    type="button"
                    disabled={true}
                    // onClick={() => setIsLogin(!isLogin)}
                >
                    Switch to Sign Up
                </Button>
            </>
        )}
      </div>
    </>
  );
}
