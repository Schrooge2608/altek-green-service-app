
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
  Archive,
  Library,
  Gauge,
  Store,
  Database,
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
  { href: '/breakdowns', label: 'Breakdowns', icon: TriangleAlert },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/messages', label: 'Messages', icon: Mail },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
  { href: '/meters', label: 'Meters', icon: Gauge },
  { href: '/vendors', label: 'Vendors', icon: Store },
];

const miningDivisions = [
    { href: '/equipment/mining/boosters', label: 'Boosters' },
    { href: '/equipment/mining/dredgers', label: 'Dredgers' },
    { href: '/equipment/mining/pump-stations', label: 'Pump Stations' },
    { href: '/equipment/mining/ups-btus', label: 'UPS/BTU\'s' },
]

const completedSchedulesCategories = [
    { href: '/maintenance/completed/vsds', label: 'VSDs' },
    { href: '/maintenance/completed/protection', label: 'Protection' },
    { href: '/maintenance/completed/motors', label: 'Motors' },
    { href: '/maintenance/completed/pumps', label: 'Pumps' },
]

const inventorySubMenu = [
    { href: '/inventory/parts', label: 'Parts' },
    { href: '/inventory/needs-restock', label: 'Needs Restock' },
    { href: '/inventory/part-types', label: 'Part Types' },
    { href: '/inventory/location', label: 'Location' },
    { href: '/inventory/asset', label: 'Asset' },
    { href: '/inventory/vendor', label: 'Vendor' },
    { href: '/inventory/area', label: 'Area' },
]

const librarySubMenu = [
    { href: '/library/work-orders', label: 'Works Orders' },
    { href: '/library/procedures', label: 'Procedures' },
]

const maintenanceSubMenu = [
    { href: '/maintenance', label: 'Schedule' },
    { href: '/maintenance/work-orders', label: 'Work Orders' },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRoleRef);
  
  const usersQuery = useMemoFirebase(() => (user ? collection(firestore, 'users') : null), [firestore, user]);
  const { data: allUsers } = useCollection<User>(usersQuery);

  const isManager = userData?.role && ['Site Supervisor', 'Services Manager', 'Corporate Manager'].includes(userData.role);


  const isEquipmentPath = pathname.startsWith('/equipment') || pathname.startsWith('/smelter');
  const [isAssetsOpen, setIsAssetsOpen] = React.useState(isEquipmentPath);
  const [isMiningOpen, setIsMiningOpen] = React.useState(pathname.startsWith('/equipment/mining'));
  const [isSmelterOpen, setIsSmelterOpen] = React.useState(pathname.startsWith('/smelter'));
  const [isAdminOpen, setIsAdminOpen] = React.useState(pathname.startsWith('/admin'));
  const [isCompletedOpen, setIsCompletedOpen] = React.useState(pathname.startsWith('/maintenance/completed'));
  const [isTeamOpen, setIsTeamOpen] = React.useState(pathname.startsWith('/team'));
  const [isInventoryOpen, setIsInventoryOpen] = React.useState(pathname.startsWith('/inventory'));
  const [isLibraryOpen, setIsLibraryOpen] = React.useState(pathname.startsWith('/library'));
  const [isMaintenanceOpen, setIsMaintenanceOpen] = React.useState(pathname.startsWith('/maintenance') && !pathname.startsWith('/maintenance/completed'));

  React.useEffect(() => {
    if (isEquipmentPath) {
      setIsAssetsOpen(true);
    }
  }, [isEquipmentPath]);

  const dashboardLink = mainLinks.find(link => link.label === 'Dashboard');
  const breakdownLink = mainLinks.find(link => link.label === 'Breakdowns');
  const reportsLink = mainLinks.find(link => link.label === 'Reports');
  const messagesLink = mainLinks.find(link => link.label === 'Messages');
  const otherLinks = mainLinks.filter(link => !['Dashboard', 'Breakdowns', 'Reports', 'Messages'].includes(link.label));


  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <div className="border-2 border-accent rounded-md p-1">
            <AltekLogo className="w-auto h-9" />
          </div>
          <div className="flex-1" />
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {dashboardLink && (
            <SidebarMenuItem key={dashboardLink.href}>
              <Link href={dashboardLink.href}>
                <SidebarMenuButton
                  isActive={pathname === dashboardLink.href}
                  tooltip={dashboardLink.label}
                >
                  <dashboardLink.icon />
                  <span>{dashboardLink.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          )}

           <Collapsible open={isAssetsOpen} onOpenChange={setIsAssetsOpen}>
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Assets" isActive={isEquipmentPath}>
                            <Archive />
                            <span>Assets</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                    <SidebarMenuSub>
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
                    </SidebarMenuSub>
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
            
           <Collapsible open={isMaintenanceOpen} onOpenChange={setIsMaintenanceOpen}>
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Maintenance" isActive={pathname.startsWith('/maintenance') && !pathname.startsWith('/maintenance/completed')}>
                            <Calendar />
                            <span>Maintenance</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {maintenanceSubMenu.map((item) => (
                            <SidebarMenuItem key={item.href}>
                                <Link href={item.href} passHref>
                                    <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                                    <span>{item.label}</span>
                                    </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
           </Collapsible>
           
          {breakdownLink && (
            <SidebarMenuItem key={breakdownLink.href}>
              <Link href={breakdownLink.href}>
                <SidebarMenuButton
                  isActive={pathname === breakdownLink.href}
                  tooltip={breakdownLink.label}
                >
                  <breakdownLink.icon />
                  <span>{breakdownLink.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          )}

          {reportsLink && (
            <SidebarMenuItem key={reportsLink.href}>
              <Link href={reportsLink.href}>
                <SidebarMenuButton
                  isActive={pathname === reportsLink.href}
                  tooltip={reportsLink.label}
                >
                  <reportsLink.icon />
                  <span>{reportsLink.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          )}

          {messagesLink && (
            <SidebarMenuItem key={messagesLink.href}>
              <Link href={messagesLink.href}>
                <SidebarMenuButton
                  isActive={pathname === messagesLink.href}
                  tooltip={messagesLink.label}
                >
                  <messagesLink.icon />
                  <span>{messagesLink.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          )}

           <Collapsible open={isInventoryOpen} onOpenChange={setIsInventoryOpen}>
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Parts Inventory" isActive={pathname.startsWith('/inventory')}>
                            <Archive />
                            <span>Parts Inventory</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {inventorySubMenu.map((item) => (
                            <SidebarMenuItem key={item.href}>
                                <Link href={item.href} passHref>
                                    <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                                    <span>{item.label}</span>
                                    </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
             <Collapsible open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Library" isActive={pathname.startsWith('/library')}>
                            <Library />
                            <span>Library</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {librarySubMenu.map((item) => (
                            <SidebarMenuItem key={item.href}>
                                <Link href={item.href} passHref>
                                    <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                                    <span>{item.label}</span>
                                    </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
            
            {otherLinks.map((link) => (
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
                         <SidebarMenuItem>
                            <Link href="/seed-admin" passHref>
                                <SidebarMenuSubButton asChild isActive={pathname === '/seed-admin'}>
                                  <span>Seed Admin</span>
                                </SidebarMenuSubButton>
                            </Link>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <Link href="/admin/seed" passHref>
                                <SidebarMenuSubButton asChild isActive={pathname === '/admin/seed'}>
                                  <span>Seed Data</span>
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
