'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenuSub,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { AltekLogo } from '@/components/altek-logo';
import {
  LayoutDashboard,
  Wrench,
  Calendar,
  FileText,
  TriangleAlert,
  ChevronDown,
  Shield,
  User as UserIcon,
  Users,
  ShoppingCart,
  Mail,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { UserNav } from '@/components/user-nav';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import React from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import type { User } from '@/lib/types';
import { collection, doc } from 'firebase/firestore';


const mainLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/maintenance', label: 'Maintenance', icon: Calendar },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/breakdowns', label: 'Breakdowns', icon: TriangleAlert },
  { href: '/messages', label: 'Messages', icon: Mail },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
];

const miningDivisions = [
    { href: '/equipment/mining/boosters', label: 'Boosters' },
]

const completedSchedulesCategories = [
    { href: '/maintenance/completed/vsds', label: 'VSDs' },
    { href: '/maintenance/completed/protection', label: 'Protection' },
    { href: '/maintenance/completed/motors', label: 'Motors' },
    { href: '/maintenance/completed/pumps', label: 'Pumps' },
]

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRoleRef);
  
  const usersQuery = useMemoFirebase(() => (user ? collection(firestore, 'users') : null), [firestore, user]);
  const { data: allUsers } = useCollection<User>(usersQuery);

  const isManager = userData?.role && ['Site Supervisor', 'Services Manager', 'Corporate Manager'].includes(userData.role);


  const isEquipmentPath = pathname.startsWith('/equipment');
  const [isMiningOpen, setIsMiningOpen] = React.useState(isEquipmentPath);
  const [isSmelterOpen, setIsSmelterOpen] = React.useState(false);
  const [isAdminOpen, setIsAdminOpen] = React.useState(pathname.startsWith('/admin'));
  const [isCompletedOpen, setIsCompletedOpen] = React.useState(pathname.startsWith('/maintenance/completed'));
  const [isTeamOpen, setIsTeamOpen] = React.useState(pathname.startsWith('/team'));

  React.useEffect(() => {
    if (isEquipmentPath) {
      setIsMiningOpen(true);
    }
  }, [isEquipmentPath]);


  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <AltekLogo className="w-auto h-9" />
          <div className="flex-1" />
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {mainLinks.map((link) => (
            <SidebarMenuItem key={link.href}>
              <Link href={link.href}>
                <SidebarMenuButton
                  isActive={pathname === link.href}
                  tooltip={link.label}
                >
                  <link.icon />
                  <span>{link.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
           <Collapsible open={isMiningOpen} onOpenChange={setIsMiningOpen}>
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Mining Equipment" isActive={pathname.startsWith('/equipment/mining')}>
                        <Wrench />
                        <span>Mining Equipment</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
                <SidebarMenuSub>
                    {miningDivisions.map((division) => (
                         <SidebarMenuItem key={division.href}>
                            <Link href={division.href} passHref>
                                <SidebarMenuSubButton asChild isActive={pathname === division.href}>
                                  <span>{division.label}</span>
                                </SidebarMenuSubButton>
                            </Link>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenuSub>
            </CollapsibleContent>
           </Collapsible>
            <Collapsible open={isSmelterOpen} onOpenChange={setIsSmelterOpen}>
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Smelter Equipment" isActive={pathname.startsWith('/smelter')}>
                            <Wrench />
                            <span>Smelter Equipment</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                    {/* Smelter sub-items will go here */}
                </CollapsibleContent>
            </Collapsible>
            <Collapsible open={isCompletedOpen} onOpenChange={setIsCompletedOpen}>
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Completed Schedules" isActive={pathname.startsWith('/maintenance/completed')}>
                            <FileText />
                            <span>Completed Schedules</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                     <SidebarMenuSub>
                        {completedSchedulesCategories.map((category) => (
                            <SidebarMenuItem key={category.href}>
                                <Link href={category.href} passHref>
                                    <SidebarMenuSubButton asChild isActive={pathname === category.href}>
                                    <span>{category.label}</span>
                                    </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
             {userData?.role === 'Admin' && (
              <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Admin" isActive={pathname.startsWith('/admin')}>
                          <Shield />
                          <span>Admin</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                      </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        <SidebarMenuItem>
                            <Link href="/admin/users" passHref>
                                <SidebarMenuSubButton asChild isActive={pathname === '/admin/users'}>
                                  <span>User Management</span>
                                </SidebarMenuSubButton>
                            </Link>
                        </SidebarMenuItem>
                    </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            )}
             {isManager && (
              <Collapsible open={isTeamOpen} onOpenChange={setIsTeamOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Team/Users" isActive={pathname.startsWith('/team')}>
                          <Users />
                          <span>Team/Users</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                      </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                    <SidebarMenuSub>
                         {allUsers?.map((u) => (
                            <SidebarMenuItem key={u.id}>
                                <Link href={`/profile/${u.id}`} passHref>
                                    <SidebarMenuSubButton asChild isActive={pathname === `/profile/${u.id}`}>
                                        <span>{u.name}</span>
                                    </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <Separator className="my-1" />
        <UserNav />
      </SidebarFooter>
    </>
  );
}
