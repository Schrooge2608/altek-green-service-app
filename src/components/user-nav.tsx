'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth, useUser, useMemoFirebase } from '@/firebase';
import { LogOut, User as UserIcon, LogIn, Settings } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import type { User } from '@/lib/types';
import Link from 'next/link';
import { useKiosk } from '@/components/kiosk/kiosk-provider';


export function UserNav() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { logoutKioskUser } = useKiosk();

  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData, isLoading: userDataLoading } = useDoc<User>(userRef);

  const handleSignOut = async () => {
    // 1. CLEAR FIRESTORE PERSISTENCE FIELDS BEFORE EXIT
    if (user) {
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        activeUserContext: null,
        kioskSession: null
      }).catch(() => {}); // Silent catch to ensure logout proceeds
    }
    
    // 2. CLEAR LOCAL STATE
    logoutKioskUser(); 
    auth.signOut();
  };

  if (isUserLoading || (user && userDataLoading)) {
    return (
        <div className="flex items-center gap-3 p-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
            </div>
        </div>
    );
  }

  if (!user) {
    return (
      <div className="p-2">
        <Link href="/auth/register" passHref>
            <Button className="w-full">
                <LogIn className="mr-2 h-4 w-4" />
                Login
            </Button>
        </Link>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-3 p-2 cursor-pointer hover:bg-sidebar-accent rounded-md">
          <Avatar>
            <AvatarImage src={userData?.avatarUrl || ''} />
            <AvatarFallback>
              {userData ? userData.name.substring(0, 2).toUpperCase() : '..'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col truncate">
            <span className="text-sm font-medium text-sidebar-foreground truncate">
              {userData?.name || 'Loading...'}
            </span>
            <span className="text-xs text-sidebar-foreground/70 truncate">
              {userData?.email || '...'}
            </span>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userData?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userData?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={`/profile/${user.uid}`}>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile/settings">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
