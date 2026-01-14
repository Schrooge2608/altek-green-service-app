
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
import { useAuth, useFirestore, useUser } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { User } from '@/lib/types';
import backendConfig from '@/docs/backend.json';
import { useRouter } from 'next/navigation';


const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').optional(),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  role: z.string().min(1, 'Role is required.').optional(),
});

type UserFormValue = z.infer<typeof formSchema>;

interface UserAuthFormProps {
    mode: 'login' | 'createUser';
    onSuccess?: () => void;
}

export function UserAuthForm({ mode, onSuccess }: UserAuthFormProps) {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();
  
  const roleOptions = (backendConfig.entities.User.properties.role.enum || []).map(role => ({
    label: role,
    value: role,
  }));

  const getFormSchema = () => {
    if (mode === 'createUser') {
      return formSchema.required({ name: true, role: true });
    }
    return formSchema.pick({ email: true, password: true }); // Login mode
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
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, data.email, data.password);
        toast({ title: 'Login Successful', description: 'Welcome back!' });
        router.push('/');
        if(onSuccess) onSuccess();
      } else { // createUser mode
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        const newUser = userCredential.user;

        const userData: User = {
            id: newUser.uid,
            name: data.name!,
            email: data.email,
            role: data.role as User['role'],
        };
        await setDoc(doc(firestore, 'users', newUser.uid), userData);

        toast({
            title: 'Account Created',
            description: `The account for ${data.name} has been created. Please sign in.`,
        });

        // Sign the new user out so they can log in themselves
        await auth.signOut();
        
        if (onSuccess) {
            onSuccess();
        } else {
            // This might not be necessary if the page redirects, but good practice
            form.reset(); 
            // Potentially switch to login tab or redirect
        }
      }
    } catch (error: any) {
      let description = error.message;
      toast({
        variant: 'destructive',
        title: mode === 'createUser' ? 'Account Creation Failed' : 'Authentication Failed',
        description: description,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const title = mode === 'createUser' ? 'Create an account' : 'Sign in to your account';
  const description = mode === 'createUser' ? 'Enter your details below to create your account.' : 'Enter your credentials to access your dashboard.';
  const buttonText = mode === 'createUser' ? 'Create Account' : 'Sign In';

  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className={cn('grid gap-6')}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {mode === 'createUser' && (
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Full Name</FormLabel>
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
             {mode === 'createUser' && (
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
                            {roleOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
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
      </div>
    </>
  );
}
