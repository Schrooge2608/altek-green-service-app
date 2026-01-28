'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';
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
  Cpu,
  Cog,
  Droplets,
  Power,
  ScanLine,
  Sparkles,
  History,
  Pen,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { UserNav } from '@/components/user-nav';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import React from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import type { User } from '@/lib/types';
import { collection, doc } from 'firebase/firestore';
import Link from 'next/link';


const mainLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/breakdowns', label: 'Breakdowns', icon: TriangleAlert },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/messages', label: 'Messages', icon: Mail, beta: true },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, beta: true },
  { href: '/meters', label: 'Meters', icon: Gauge, beta: true },
  { href: '/vendors', label: 'Vendors', icon: Store, beta: true },
];

const miningDivisions = [
    { href: '/equipment/mining/boosters', label: 'Boosters' },
    { href: '/equipment/mining/dredgers', label: 'Dredgers' },
    { href: '/equipment/mining/pump-stations', label: 'Pump Stations' },
    { href: '/equipment/mining/ups-btus', label: 'UPS/BTU\'s' },
]

const smelterDivisions = [
    { href: '/equipment/smelter/msp', label: 'MSP' },
    { href: '/equipment/smelter/roaster', label: 'Roaster' },
    { href: '/equipment/smelter/char-plant', label: 'Char Plant' },
    { href: '/equipment/smelter/smelter', label: 'Smelter' },
    { href: '/equipment/smelter/iron-injection', label: 'Iron Injection' },
    { href: '/equipment/smelter/stripping-crane', label: 'Stripping Crane' },
    { href: '/equipment/smelter/slag-plant', label: 'Slag Plant' },
    { href: '/equipment/smelter/north-screen', label: 'North Screen' },
    { href: '/equipment/smelter/ups-btus', label: "UPS/BTU's" },
]

const completedSchedulesCategories = [
    { href: '/maintenance/completed/protection', label: 'Protection' },
    { href: '/maintenance/completed/ups-btus', label: "UPS/BTU's" },
    { href: '/maintenance/completed/vsds', label: 'VSDs' },
    { href: '/maintenance/completed/motors', label: 'Motors' },
    { href: '/maintenance/completed/pumps', label: 'Pumps' },
]

const vsdProcedureSubMenu = [
    { href: '/maintenance/vsds/3-monthly', label: '3-Monthly' },
    { href: '/maintenance/vsds/6-monthly', label: '6-Monthly' },
    { href: '/maintenance/vsds/yearly', label: 'Yearly' },
];

const protectionProcedureSubMenu = [
    { href: '/maintenance/protection/6-monthly', label: '6-Monthly' },
];


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
    { href: '/library/procedures', label: 'Schedule Procedures' },
    { href: '/library/data-sheets', label: 'Data Sheets' },
    { href: '/scan', label: 'Scan Document', icon: ScanLine },
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
  const canViewBeta = userData?.role && (userData.role.includes('(Beta)') || userData.role.includes('Admin') || userData.role.includes('Superadmin'));
  const isAdmin = userData?.role && ['Admin', 'Superadmin'].includes(userData.role);
  const isClientManager = userData?.role === 'Client Manager';
  const isTechnician = userData?.role?.includes('Technician');
  const isTechnologist = userData?.role?.includes('Technologist');


  const isAssetsPath = pathname.startsWith('/equipment') || pathname.startsWith('/smelter') || pathname.startsWith('/assets');
  const [isAssetsOpen, setIsAssetsOpen] = React.useState(isAssetsPath);
  const [isMiningOpen, setIsMiningOpen] = React.useState(pathname.startsWith('/equipment/mining'));
  const [isSmelterOpen, setIsSmelterOpen] = React.useState(pathname.startsWith('/equipment/smelter'));
  const [isAdminOpen, setIsAdminOpen] = React.useState(pathname.startsWith('/admin') || pathname.startsWith('/time-attendance'));
  const [isCompletedOpen, setIsCompletedOpen] = React.useState(pathname.startsWith('/maintenance/completed'));
  const [isTeamOpen, setIsTeamOpen] = React.useState(pathname.startsWith('/team'));
  const [isInventoryOpen, setIsInventoryOpen] = React.useState(pathname.startsWith('/inventory'));
  const [isLibraryOpen, setIsLibraryOpen] = React.useState(pathname.startsWith('/library') || pathname === '/scan');
  const [isMaintenanceOpen, setIsMaintenanceOpen] = React.useState(pathname.startsWith('/maintenance'));
  const [isScheduleOpen, setIsScheduleOpen] = React.useState(pathname.startsWith('/maintenance/upcoming-schedules') || pathname === '/maintenance');
  const [isProceduresOpen, setIsProceduresOpen] = React.useState(pathname.startsWith('/maintenance/vsds') || pathname.startsWith('/maintenance/protection'));
  const [isReportsOpen, setIsReportsOpen] = React.useState(pathname.startsWith('/reports'));

  React.useEffect(() => {
    if (isAssetsPath) {
      setIsAssetsOpen(true);
    }
  }, [isAssetsPath]);

  const dashboardLink = mainLinks.find(link => link.label === 'Dashboard');
  const breakdownLink = mainLinks.find(link => link.label === 'Breakdowns');
  const otherMainLinks = mainLinks.filter(link => !['Dashboard', 'Breakdowns', 'Reports'].includes(link.label));


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
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === dashboardLink.href} tooltip={dashboardLink.label}>
                <Link href={dashboardLink.href}>
                    <dashboardLink.icon />
                    <span>{dashboardLink.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

           <Collapsible open={isAssetsOpen} onOpenChange={setIsAssetsOpen}>
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Assets" isActive={isAssetsPath}>
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
                                            <SidebarMenuSubButton asChild isActive={pathname === division.href}>
                                                <Link href={division.href}>{division.label}</Link>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenuSub>
                            </CollapsibleContent>
                        </Collapsible>
                        <Collapsible open={isSmelterOpen} onOpenChange={setIsSmelterOpen}>
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton tooltip="Smelter Equipment" isActive={pathname.startsWith('/equipment/smelter')}>
                                        <Wrench />
                                        <span>Smelter Equipment</span>
                                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                            </SidebarMenuItem>
                            <CollapsibleContent>
                                <SidebarMenuSub>
                                    {smelterDivisions.map((division) => (
                                        <SidebarMenuItem key={division.href}>
                                             <SidebarMenuSubButton asChild isActive={pathname === division.href}>
                                                <Link href={division.href}>{division.label}</Link>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenuSub>
                            </CollapsibleContent>
                        </Collapsible>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive={pathname === '/assets/tools-equipment'} tooltip="Tools &amp; Equipment">
                                <Link href="/assets/tools-equipment">
                                    <Wrench />
                                    <span>Tools &amp; Equipment</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenuSub>
                </CollapsibleContent>
           </Collapsible>

           {(isAdmin || isManager || isClientManager || isTechnician || isTechnologist) && (
                <Collapsible open={isReportsOpen} onOpenChange={setIsReportsOpen}>
                    <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip="Reports" isActive={pathname.startsWith('/reports')}>
                                <FileText />
                                <span>Reports</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                        <SidebarMenuSub>
                            {(isAdmin || isManager) && (
                                <SidebarMenuItem>
                                    <SidebarMenuSubButton asChild isActive={pathname === '/reports'}>
                                        <Link href="/reports">
                                            <span>Performance Reports</span>
                                        </Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuItem>
                            )}
                            {(isAdmin || isManager || isClientManager) && (
                                <SidebarMenuItem>
                                    <SidebarMenuSubButton asChild isActive={pathname === '/reports/generate'}>
                                        <Link href="/reports/generate">
                                            <Sparkles />
                                            <span>AI Report Generator</span>
                                        </Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuItem>
                            )}
                            {(isAdmin || isManager || isClientManager) && (
                                <SidebarMenuItem>
                                    <SidebarMenuSubButton asChild isActive={pathname.startsWith('/reports/history')}>
                                        <Link href="/reports/history">
                                            <History />
                                            <span>Report History</span>
                                        </Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuItem>
                            )}
                            <Collapsible>
                                 <SidebarMenuItem>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton isActive={pathname.startsWith('/reports/contractors-daily-diary') || pathname === '/reports/diary-tracker'}>
                                            <Image src="/RBM.png" alt="RBM Logo" width={16} height={16} />
                                            <span>Daily Diary</span>
                                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                </SidebarMenuItem>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {!isClientManager && (
                                            <SidebarMenuItem>
                                                <SidebarMenuSubButton asChild isActive={pathname === '/reports/contractors-daily-diary'}>
                                                    <Link href="/reports/contractors-daily-diary">New Diary</Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuItem>
                                        )}
                                        <SidebarMenuItem>
                                            <SidebarMenuSubButton asChild isActive={pathname === '/reports/diary-tracker'}>
                                                <Link href="/reports/diary-tracker">Diary Tracker</Link>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuItem>
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </Collapsible>
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </Collapsible>
            )}

           <Collapsible open={isMaintenanceOpen} onOpenChange={setIsMaintenanceOpen}>
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Maintenance" isActive={pathname.startsWith('/maintenance')}>
                            <Calendar />
                            <span>Maintenance</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        <Collapsible open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton tooltip="Schedule" isActive={pathname === '/maintenance' || pathname.startsWith('/maintenance/upcoming-schedules')}>
                                        <Calendar />
                                        <span>Schedule</span>
                                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                            </SidebarMenuItem>
                            <CollapsibleContent>
                                <SidebarMenuSub>
                                    {!isClientManager && (
                                        <SidebarMenuItem>
                                            <SidebarMenuSubButton asChild isActive={pathname === '/maintenance'}>
                                                <Link href="/maintenance">View All</Link>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuItem>
                                    )}
                                    <SidebarMenuItem>
                                        <SidebarMenuSubButton asChild isActive={pathname === '/maintenance/upcoming-schedules'}>
                                            <Link href="/maintenance/upcoming-schedules">Upcoming</Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuItem>
                                </SidebarMenuSub>
                            </CollapsibleContent>
                        </Collapsible>
                         <SidebarMenuItem>
                            <SidebarMenuSubButton asChild isActive={pathname === '/maintenance/work-orders'}>
                                <Link href="/maintenance/work-orders">Work Orders</Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <SidebarMenuSubButton asChild isActive={pathname === '/maintenance/permit-to-work'}>
                                <Link href="/maintenance/permit-to-work">Permit to Work</Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuItem>
                    </SidebarMenuSub>
                </CollapsibleContent>
           </Collapsible>

            <Collapsible open={isCompletedOpen} onOpenChange={setIsCompletedOpen}>
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Completed Work" isActive={pathname.startsWith('/maintenance/completed')}>
                            <FileText />
                            <span>Completed Work</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                     <SidebarMenuSub>
                        {completedSchedulesCategories.map((category) => (
                            <SidebarMenuItem key={category.href}>
                                <SidebarMenuSubButton asChild isActive={pathname === category.href}>
                                    <Link href={category.href}>{category.label}</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
            
           {!isClientManager && (
            <Collapsible open={isProceduresOpen} onOpenChange={setIsProceduresOpen}>
                    <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip="Maintenance Procedures" isActive={pathname.startsWith('/maintenance/vsds') || pathname.startsWith('/maintenance/protection')}>
                                <FileText />
                                <span>Maint. Procedures</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                        <SidebarMenuSub>
                            <Collapsible open={pathname.startsWith('/maintenance/vsds')} onOpenChange={(isOpen) => setIsProceduresOpen(isOpen)}>
                                <SidebarMenuItem>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton tooltip="VSD Procedures" isActive={pathname.startsWith('/maintenance/vsds')}>
                                            <Cpu />
                                            <span>VSDs</span>
                                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                </SidebarMenuItem>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                    {vsdProcedureSubMenu.map((item) => (
                                        <SidebarMenuItem key={item.href}>
                                            <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                                                <Link href={item.href}>{item.label}</Link>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuItem>
                                    ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </Collapsible>
                            <Collapsible open={pathname.startsWith('/maintenance/protection')} onOpenChange={(isOpen) => setIsProceduresOpen(isOpen)}>
                                <SidebarMenuItem>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton tooltip="Protection Procedures" isActive={pathname.startsWith('/maintenance/protection')}>
                                            <Shield />
                                            <span>Protection</span>
                                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                </SidebarMenuItem>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                    {protectionProcedureSubMenu.map((item) => (
                                        <SidebarMenuItem key={item.href}>
                                            <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                                                <Link href={item.href}>{item.label}</Link>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuItem>
                                    ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </Collapsible>
                        </SidebarMenuSub>
                    </CollapsibleContent>
            </Collapsible>
           )}
           
          {breakdownLink && (
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === breakdownLink.href} tooltip={breakdownLink.label}>
                    <Link href={breakdownLink.href}>
                        <breakdownLink.icon />
                        <span>{breakdownLink.label}</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
          )}

            {!isClientManager && (
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
                                    <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                                        <Link href={item.href}>{item.label}</Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </Collapsible>
            )}
             {!isClientManager && (
                <Collapsible open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
                    <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip="Library" isActive={pathname.startsWith('/library') || pathname === '/scan'}>
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
                                    <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                                        <Link href={item.href}>
                                            {item.icon && <item.icon />}
                                            <span>{item.label}</span>
                                        </Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </Collapsible>
             )}
            
            {otherMainLinks.map((link) => {
                if (link.beta && !canViewBeta) {
                    return null;
                }
                return (
                    <SidebarMenuItem key={link.href}>
                        <SidebarMenuButton asChild isActive={pathname === link.href} tooltip={link.label}>
                            <Link href={link.href}>
                                <link.icon />
                                <span>{link.label}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )
            })}

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
                                <SidebarMenuSubButton asChild isActive={pathname === `/profile/${u.id}`}>
                                    <Link href={`/profile/${u.id}`}>{u.name}</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            )}

              <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Administration" isActive={pathname.startsWith('/admin') || pathname.startsWith('/time-attendance') || pathname === '/capture-signature'}>
                          <Shield />
                          <span>Administration</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                      </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {!isClientManager && (
                            <SidebarMenuItem>
                                <SidebarMenuSubButton asChild isActive={pathname === '/time-attendance'}>
                                    <Link href="/time-attendance">
                                        <span>Time &amp; Attendance</span>
                                    </Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuItem>
                        )}
                        <SidebarMenuItem>
                            <SidebarMenuSubButton asChild isActive={pathname === '/capture-signature'}>
                                <Link href="/capture-signature">
                                    <Pen />
                                    <span>Capture Signature</span>
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuItem>
                        {isAdmin && (
                            <>
                                <SidebarMenuItem>
                                    <SidebarMenuSubButton asChild isActive={pathname === '/admin/users'}>
                                        <Link href="/admin/users">User Management</Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuSubButton asChild isActive={pathname === '/seed-admin'}>
                                        <Link href="/seed-admin">Seed Admin</Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem>
                                    <SidebarMenuSubButton asChild isActive={pathname === '/admin/seed'}>
                                        <Link href="/admin/seed">Seed Data</Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuItem>
                            </>
                        )}
                    </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <Separator className="my-1" />
        <UserNav />
      </SidebarFooter>
    </>
    );
}
