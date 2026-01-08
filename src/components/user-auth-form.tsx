
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth, useFirestore } from '@/firebase';
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

interface UserAuthFormProps {
    mode: 'public' | 'createUser';
}

export function UserAuthForm({ mode }: UserAuthFormProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLogin, setIsLogin] = React.useState(true); // State to toggle between login and sign up for public users

  const isCreateUserMode = mode === 'createUser';
  const isPublicSignUp = mode === 'public' && !isLogin;

  const getFormSchema = () => {
    if (isCreateUserMode) {
      return formSchema.required({ name: true, role: true }); // Admin creating user
    }
    if (isPublicSignUp) {
      return formSchema.required({ name: true, role: true }); // Public user signing up
    }
    return formSchema.pick({ email: true, password: true }); // Public login
  };

  const form = useForm<UserFormValue>({
    resolver: zodResolver(getFormSchema()),
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
      if (isLogin && !isCreateUserMode) {
        // Public login
        await signInWithEmailAndPassword(auth, data.email, data.password);
        toast({ title: 'Login Successful', description: 'Welcome back!' });
      } else {
        // Create user (either by admin or public sign-up)
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        const newUser = userCredential.user;

        const userData: User = {
            id: newUser.uid,
            name: data.name!,
            email: data.email,
            // For public sign up, default to Technician. Admin can set the role.
            role: isCreateUserMode ? data.role! : 'Technician',
        };

        await setDoc(doc(firestore, 'users', newUser.uid), userData);

        toast({
            title: 'Account Created Successfully',
            description: `The account for ${data.name} has been created.`,
        });
        form.reset();
        
        if (isPublicSignUp) {
            // After public signup, you might want to log them in automatically (which firebase does)
            // and perhaps redirect them. For now, just show a success message.
            setIsLogin(true); // Switch back to login view
        }
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
  
  const title = isCreateUserMode ? 'Create a new user account' : (isLogin ? 'Sign in to your account' : 'Create a new account');
  const description = isCreateUserMode ? 'Enter the details for the new user below.' : (isLogin ? 'Enter your credentials to access your dashboard.' : 'Enter your details to get started.');
  const buttonText = isCreateUserMode ? 'Create User' : (isLogin ? 'Sign In' : 'Sign Up');

  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className={cn('grid gap-6')}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {(isCreateUserMode || isPublicSignUp) && (
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
             {(isCreateUserMode || isPublicSignUp) && (
                <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!isCreateUserMode}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Technician">Technician</SelectItem>
                            {isCreateUserMode && (
                                <>
                                    <SelectItem value="Site Supervisor">Site Supervisor</SelectItem>
                                    <SelectItem value="Services Manager">Services Manager</SelectItem>
                                    <SelectItem value="Corporate Manager">Corporate Manager</SelectItem>
                                    <SelectItem value="Admin">Admin</SelectItem>
                                </>
                            )}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {buttonText}
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
                    disabled={isLoading}
                    onClick={() => setIsLogin(!isLogin)}
                >
                    {isLogin ? 'Switch to Sign Up' : 'Switch to Sign In'}
                </Button>
            </>
        )}
      </div>
    </>
  );
}
