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
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { User } from '@/lib/types';


const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  role: z.enum(['Technician', 'Site Supervisor', 'Services Manager', 'Corporate Manager']),
});

type UserFormValue = z.infer<typeof formSchema>;

export function UserAuthForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLogin, setIsLogin] = React.useState(false);

  const form = useForm<UserFormValue>({
    resolver: zodResolver(
        isLogin 
        ? formSchema.pick({ email: true, password: true }) 
        : formSchema
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
        if (isLogin) {
            await signInWithEmailAndPassword(auth, data.email, data.password);
            toast({ title: 'Login Successful', description: 'Welcome back!' });
        } else {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                data.email,
                data.password
            );
            const user = userCredential.user;

            const userData: User = {
                id: user.uid,
                name: data.name,
                email: data.email,
                role: data.role,
            };

            await setDoc(doc(firestore, 'users', user.uid), userData);

            toast({
                title: 'Registration Successful',
                description: 'Your account has been created.',
            });
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

  return (
    <>
      <div className={cn('grid gap-6')}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!isLogin && (
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
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             {!isLogin && (
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
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? 'Sign In' : 'Create account'}
            </Button>
          </form>
        </Form>
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
      </div>
    </>
  );
}
