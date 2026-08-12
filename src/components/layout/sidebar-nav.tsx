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
  SidebarMenuSubItem,
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
  MessageSquare,
  Archive,
  Library,
  Gauge,
  Store,
  ScanLine,
  Sparkles,
  History,
  Phone,
  Banknote,
  Cpu,
  Network,
  Briefcase,
  Clock,
  ShoppingCart,
  Users,
  PenTool,
  ClipboardCheck,
  Pencil,
  Settings2,
  Factory,
  Pickaxe,
  Droplets,
  Activity,
  Flame
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { UserNav } from '@/components/user-nav';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import React, { useState, useEffect } from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { User } from '@/lib/types';
import { doc, collection } from 'firebase/firestore';
import Link from 'next/link';

const mainLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/messages', label: 'Site Comms', icon: MessageSquare },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
  { href: '/meters', label: 'Meters', icon: Gauge, beta: true },
  { href: '/vendors', label: 'Vendors', icon: Store, beta: true },
];

const miningDivisions = [
    { href: '/equipment/mining/boosters', label: 'Boosters' },
    { href: '/equipment/mining/dredgers', label: 'Dredgers' },
    { href: '/equipment/mining/pump-stations', label: 'Pump Stations' },
    { href: '/equipment/mining/ups-btus', label: 'UPS/BTU\'s' },
];


const completedSchedulesCategories = [
    { href: '/maintenance/completed/protection', label: 'Protection' },
    { href: '/maintenance/completed/ups-btus', label: "UPS/BTU's" },
    { href: '/maintenance/completed/vsds', label: 'VSDs' },
    { href: '/maintenance/completed/motors', label: 'Motors' },
    { href: '/maintenance/completed/pumps', label: 'Pumps' },
];

const vsdProcedureSubMenu = [
    { href: '/maintenance/vsds/3-monthly', label: '3-Monthly' },
    { href: '/maintenance/vsds/6-monthly', label: '6-Monthly' },
    { href: '/maintenance/vsds/yearly', label: 'Yearly' },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRoleRef);

  const isManager = userData?.role && ['Site Supervisor', 'Services Manager', 'Corporate Manager', 'Admin', 'Superadmin', 'Data Admin'].includes(userData.role);
  const isAdmin = userData?.role && ['Admin', 'Superadmin'].includes(userData.role);
  const isClientManager = userData?.role === 'Client Manager';
  
  const isTechnician = userData?.role && (
    userData.role.includes('Technician') || 
    userData.role.includes('Technologist') || 
    userData.role.includes('engineer') || 
    userData.role.includes('specialist') ||
    userData.role.includes('Site Supervisor')
  );

  const canAccessFinancials = userData?.role && (
    userData.role.includes('Admin') || 
    userData.role.includes('Superadmin') || 
    userData.role.includes('Corporate Manager') || 
    userData.role.includes('Services Manager') || 
    userData.role === 'Client Manager'
  );

  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [isMiningOpen, setIsMiningOpen] = useState(false);
  const [isSmelterOpen, setIsSmelterOpen] = useState(false);
  const [isSmelterV2Open, setIsSmelterV2Open] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isProceduresOpen, setIsProceduresOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isBreakdownsOpen, setIsBreakdownsOpen] = useState(false);

  useEffect(() => {
    if (!pathname) return;
    setIsTimeOpen(pathname.startsWith('/time-attendance'));
    setIsAssetsOpen(pathname.startsWith('/equipment') || pathname.startsWith('/smelter') || pathname.startsWith('/assets') || pathname.startsWith('/mining'));
    setIsMiningOpen(pathname.startsWith('/mining'));
    setIsSmelterOpen(pathname.startsWith('/equipment/smelter'));
    setIsSmelterV2Open(pathname.startsWith('/smelter-v2'));
    setIsAdminOpen(pathname.startsWith('/admin'));
    setIsCompletedOpen(pathname.startsWith('/maintenance/completed') || pathname.startsWith('/completed-work'));
    setIsInventoryOpen(pathname.startsWith('/inventory'));
    setIsLibraryOpen(pathname.startsWith('/library') || pathname === '/scan');
    setIsMaintenanceOpen(pathname.startsWith('/maintenance'));
    setIsScheduleOpen(pathname === '/maintenance' || pathname.startsWith('/maintenance/upcoming-schedules'));
    setIsProceduresOpen(pathname.startsWith('/maintenance/vsds') || pathname.startsWith('/maintenance/protection'));
    setIsReportsOpen(pathname.startsWith('/reports'));
  }, [pathname]);

  const dashboardLink = mainLinks.find(link => link.label === 'Dashboard');
  const commsLink = mainLinks.find(link => link.label === 'Site Comms');

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
                <Link href={dashboardLink.href} prefetch={true}>
                    <dashboardLink.icon />
                    <span>{dashboardLink.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {!isClientManager && (
            <SidebarMenuItem>
              <Collapsible open={isTimeOpen} onOpenChange={setIsTimeOpen} className="group/ta">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Time & Attendance" isActive={pathname.startsWith('/time-attendance')}>
                    <Clock />
                    <span>Time & Attendance</span>
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/ta:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {isTechnician && (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === '/time-attendance'}>
                          <Link href="/time-attendance" prefetch={true}>My Timesheet</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )}
                    {isManager && !userData?.role?.includes('Site Supervisor') && (
                      <>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={pathname === '/time-attendance'}>
                            <Link href="/time-attendance" prefetch={true}>Review Timesheets</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={pathname === '/time-attendance/ot-summary'}>
                            <Link href="/time-attendance/ot-summary" prefetch={true}>Team OT Summary</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </>
                    )}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenuItem>
          )}

          {commsLink && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === commsLink.href} tooltip={commsLink.label}>
                <Link href={commsLink.href} prefetch={true}>
                    <commsLink.icon />
                    <span>{commsLink.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

           <SidebarMenuItem>
                <Collapsible open={isAssetsOpen} onOpenChange={setIsAssetsOpen} className="group/collapsible">
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Assets" isActive={pathname.startsWith('/equipment') || pathname.startsWith('/smelter') || pathname.startsWith('/assets') || pathname.startsWith('/mining')}>
                            <Archive />
                            <span>Assets</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <SidebarMenuSub>
                            <SidebarMenuSubItem>
                                <Collapsible open={isMiningOpen} onOpenChange={setIsMiningOpen} className="group/v2">
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuSubButton tooltip="Mining" isActive={pathname.startsWith('/mining')}>
                                            <Pickaxe className="h-4 w-4 mr-2" />
                                            <span>Mining</span>
                                            <ChevronDown className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/v2:rotate-180" />
                                        </SidebarMenuSubButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            <SidebarMenuSubItem>
                                                <SidebarMenuSubButton asChild isActive={pathname === '/mining/ponds'}>
                                                    <Link href="/mining/ponds" prefetch={true}>
                                                        <Droplets className="h-4 w-4 mr-2" />
                                                        <span>Mining Ponds</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                            <SidebarMenuSubItem>
                                                <SidebarMenuSubButton asChild isActive={pathname === '/mining/pump-stations'}>
                                                    <Link href="/mining/pump-stations" prefetch={true}>
                                                        <Activity className="h-4 w-4 mr-2" />
                                                        <span>Pump Stations</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </Collapsible>
                            </SidebarMenuSubItem>

                            
                            {/* Smelter Equipment Parallel Category - NESTED IN ASSETS */}
                            <SidebarMenuSubItem>
                                <Collapsible open={isSmelterV2Open} onOpenChange={setIsSmelterV2Open} className="group/smelterv2">
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuSubButton tooltip="Smelter" isActive={pathname.startsWith('/smelter-v2')}>
                                            <Factory className="h-4 w-4 mr-2" />
                                            <span>Smelter</span>
                                            <ChevronDown className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/smelterv2:rotate-180" />
                                        </SidebarMenuSubButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            <SidebarMenuSubItem>
                                                <SidebarMenuSubButton asChild isActive={pathname === '/smelter-v2/smelter'}>
                                                    <Link href="/smelter-v2/smelter" prefetch={true}>
                                                        <Factory className="h-4 w-4 mr-2" />
                                                        <span>Smelter Plant</span>
                                                    </Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </Collapsible>
                            </SidebarMenuSubItem>

                            {!isClientManager && (
                                <SidebarMenuSubItem>
                                    <SidebarMenuSubButton asChild isActive={pathname === '/assets/tools-equipment'}>
                                        <Link href="/assets/tools-equipment" prefetch={true}>
                                            <Wrench className="h-4 w-4 mr-2" />
                                            <span>Tools & Equipment</span>
                                        </Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            )}
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </Collapsible>
           </SidebarMenuItem>

           <SidebarMenuItem>
                <Collapsible open={isBreakdownsOpen} onOpenChange={setIsBreakdownsOpen} className="group/breakdowns">
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Breakdown FSRs" isActive={pathname.startsWith('/reports/field-service-report')}>
                            <TriangleAlert />
                            <span>Breakdown FSRs</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/breakdowns:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <SidebarMenuSub>
                            <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild isActive={pathname.startsWith('/reports/field-service-report')}>
                                    <Link href="/reports/field-service-report" prefetch={true}>
                                        <PenTool className="mr-2 h-4 w-4" />
                                        <span>Field Service Report</span>
                                    </Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </Collapsible>
           </SidebarMenuItem>
           {(isAdmin || isManager || isTechnician) && !isClientManager && (
                <SidebarMenuItem>
                    <Collapsible open={isReportsOpen} onOpenChange={setIsReportsOpen} className="group/reports">
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip="Reports" isActive={pathname.startsWith('/reports')}>
                                <FileText />
                                <span>Reports</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/reports:rotate-180" />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <SidebarMenuSub>
                                {(isAdmin || isManager) && (
                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild isActive={pathname === '/reports'}>
                                            <Link href="/reports" prefetch={true}>
                                                <span>Performance Reports</span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                )}
                                {(isAdmin || isManager) && (
                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild isActive={pathname === '/reports/generate'}>
                                            <Link href="/reports/generate" prefetch={true}>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                <span>AI Report Generator</span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                )}
                                {(isAdmin || isManager) && (
                                    <SidebarMenuSubItem>
                                        <SidebarMenuSubButton asChild isActive={pathname.startsWith('/reports/history')}>
                                            <Link href="/reports/history" prefetch={true}>
                                                <History className="mr-2 h-4 w-4" />
                                                <span>Report History</span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                )}

                                <SidebarMenuSubItem>
                                    <Collapsible className="group/diary">
                                        <CollapsibleTrigger asChild>
                                            <SidebarMenuSubButton isActive={pathname.startsWith('/reports/contractors-daily-diary') || pathname.startsWith('/reports/diary-tracker')}>
                                                <Image src="/RBM.png" alt="RBM Logo" width={16} height={16} className="mr-2" />
                                                <span>Daily Diary</span>
                                                <ChevronDown className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/diary:rotate-180" />
                                            </SidebarMenuSubButton>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <SidebarMenuSub>
                                                {!isClientManager && (
                                                    <SidebarMenuSubItem>
                                                        <SidebarMenuSubButton asChild isActive={pathname === '/reports/contractors-daily-diary'}>
                                                            <Link href="/reports/contractors-daily-diary" prefetch={true}>New Diary</Link>
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                )}
                                                <SidebarMenuSubItem>
                                                    <SidebarMenuSubButton asChild isActive={pathname === '/reports/diary-tracker'}>
                                                        <Link href="/reports/diary-tracker" prefetch={true}>Diary Tracker</Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            </SidebarMenuSub>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </SidebarMenuSubItem>
                            </SidebarMenuSub>
                        </CollapsibleContent>
                    </Collapsible>
                </SidebarMenuItem>
            )}

           <SidebarMenuItem>
                <Collapsible open={isMaintenanceOpen} onOpenChange={setIsMaintenanceOpen} className="group/maintenance">
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Maintenance" isActive={pathname.startsWith('/maintenance')}>
                            <Calendar />
                            <span>Maintenance</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/maintenance:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <SidebarMenuSub>
                            <SidebarMenuSubItem>
                                <Collapsible open={isScheduleOpen} onOpenChange={setIsScheduleOpen} className="group/schedule">
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuSubButton tooltip="Schedule" isActive={pathname === '/maintenance' || pathname.startsWith('/maintenance/upcoming-schedules')}>
                                            <Calendar className="h-4 w-4 mr-2" />
                                            <span>Schedule</span>
                                            <ChevronDown className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/schedule:rotate-180" />
                                        </SidebarMenuSubButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            {!isClientManager && (
                                                <SidebarMenuSubItem>
                                                    <SidebarMenuSubButton asChild isActive={pathname === '/maintenance'}>
                                                        <Link href="/maintenance" prefetch={true}>View All</Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            )}
                                            <SidebarMenuSubItem>
                                                <SidebarMenuSubButton asChild isActive={pathname === '/maintenance/upcoming-schedules'}>
                                                    <Link href="/maintenance/upcoming-schedules" prefetch={true}>Upcoming</Link>
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </Collapsible>
                            </SidebarMenuSubItem>
                             <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild isActive={pathname === '/maintenance/permit-to-work'}>
                                    <Link href="/maintenance/permit-to-work" prefetch={true}>Permit to Work</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </Collapsible>
           </SidebarMenuItem>

            <SidebarMenuItem>
                <Collapsible open={isCompletedOpen} onOpenChange={setIsCompletedOpen} className="group/completed">
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Completed Work" isActive={pathname.startsWith('/maintenance/completed') || pathname.startsWith('/completed-work')}>
                            <FileText />
                            <span>Completed Work</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/completed:rotate-180" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                         <SidebarMenuSub>
                            {completedSchedulesCategories.map((category) => (
                                <SidebarMenuSubItem key={category.href}>
                                    <SidebarMenuSubButton asChild isActive={pathname === category.href}>
                                        <Link href={category.href} prefetch={true}>{category.label}</Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            ))}
                            <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild isActive={pathname === '/completed-work/unscheduled'}>
                                    <Link href="/completed-work/unscheduled" prefetch={true}>All Completed Unscheduled Work</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </Collapsible>
            </SidebarMenuItem>
            
           {!isClientManager && (
            <SidebarMenuItem>
                <Collapsible open={isProceduresOpen} onOpenChange={setIsProceduresOpen} className="group/procedures">
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip="Maintenance Procedures" isActive={pathname.startsWith('/maintenance/vsds') || pathname.startsWith('/maintenance/protection')}>
                                <FileText />
                                <span>Maint. Procedures</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/procedures:rotate-180" />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <SidebarMenuSub>
                                <SidebarMenuSubItem>
                                    <Collapsible open={pathname.startsWith('/maintenance/vsds')} className="group/vsds">
                                        <CollapsibleTrigger asChild>
                                            <SidebarMenuSubButton tooltip="VSD Procedures" isActive={pathname.startsWith('/maintenance/vsds')}>
                                                <Cpu className="h-4 w-4 mr-2" />
                                                <span>VSDs</span>
                                                <ChevronDown className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/vsds:rotate-180" />
                                            </SidebarMenuSubButton>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <SidebarMenuSub>
                                            {vsdProcedureSubMenu.map((item) => (
                                                <SidebarMenuSubItem key={item.href}>
                                                    <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                                                        <Link href={item.href} prefetch={true}>{item.label}</Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            ))}
                                            </SidebarMenuSub>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </SidebarMenuSubItem>
                            </SidebarMenuSub>
                        </CollapsibleContent>
                </Collapsible>
            </SidebarMenuItem>
           )}
           
            {!isClientManager && (
                <SidebarMenuItem>
                    <Collapsible open={isInventoryOpen} onOpenChange={setIsInventoryOpen} className="group/inventory">
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip="Parts Inventory" isActive={pathname.startsWith('/inventory')}>
                                <Archive />
                                <span>Parts Inventory</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/inventory:rotate-180" />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <SidebarMenuSub>
                                <SidebarMenuSubItem>
                                    <SidebarMenuSubButton asChild isActive={pathname === '/inventory/consumables'}>
                                        <Link href="/inventory/consumables" prefetch={true}>Consumables</Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            </SidebarMenuSub>
                        </CollapsibleContent>
                    </Collapsible>
                </SidebarMenuItem>
            )}

             {!isClientManager && (
                <SidebarMenuItem>
                    <Collapsible open={isLibraryOpen} onOpenChange={setIsLibraryOpen} className="group/library">
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip="Library" isActive={pathname.startsWith('/library') || pathname === '/scan'}>
                                <Library />
                                <span>Library</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/library:rotate-180" />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <SidebarMenuSub>
                                <SidebarMenuSubItem>
                                    <SidebarMenuSubButton asChild isActive={pathname === '/library/procedures'}>
                                        <Link href="/library/procedures" prefetch={true}>Schedule Procedures</Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                                <SidebarMenuSubItem>
                                    <SidebarMenuSubButton asChild isActive={pathname === '/library/data-sheets'}>
                                        <Link href="/library/data-sheets" prefetch={true}>Data Sheets and Drawings</Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                                <SidebarMenuSubItem>
                                    <SidebarMenuSubButton asChild isActive={pathname === '/scan'}>
                                        <Link href="/scan" prefetch={true}>
                                            <ScanLine className="mr-2 h-4 w-4" />
                                            <span>Scan Document</span>
                                        </Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            </SidebarMenuSub>
                        </CollapsibleContent>
                    </Collapsible>
                </SidebarMenuItem>
             )}
            
            {!userData?.role?.includes('Site Supervisor') && (
              <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/purchase-orders'} tooltip="Purchase Orders">
                      <Link href="/purchase-orders" prefetch={true}>
                          <ShoppingCart />
                          <span>Purchase Orders</span>
                      </Link>
                  </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/meters'} tooltip="Meters">
                    <Link href="/meters" prefetch={true}>
                        <Gauge />
                        <span>Meters</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/vendors'} tooltip="Vendors">
                    <Link href="/vendors" prefetch={true}>
                        <Store />
                        <span>Vendors</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>

             {(isAdmin || isManager) && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/users')} tooltip="User Management">
                    <Link href="/admin/users" prefetch={true}>
                        <Users />
                        <span>Team Management</span>
                    </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

              <SidebarMenuItem>
                <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen} className="group/admin">
                  <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Administration" isActive={pathname.startsWith('/admin')}>
                          <Shield />
                          <span>Administration</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/admin:rotate-180" />
                      </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                      <SidebarMenuSub>
                          <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={pathname === '/admin/standby-roster'}>
                                  <Link href="/admin/standby-roster" prefetch={true}>
                                      <Phone className="mr-2 h-4 w-4" />
                                      <span>Standby Roster</span>
                                  </Link>
                              </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          
                          <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={pathname === '/admin/safety-meetings'}>
                                  <Link href="/admin/safety-meetings" prefetch={true}>
                                      <ClipboardCheck className="mr-2 h-4 w-4" />
                                      <span>Safety Meetings</span>
                                  </Link>
                              </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          
                          <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={pathname === '/admin/organogram'}>
                                  <Link href="/admin/organogram" prefetch={true}>
                                      <Network className="mr-2 h-4 w-4" />
                                      <span>Organogram</span>
                                  </Link>
                              </SidebarMenuSubButton>
                          </SidebarMenuSubItem>

                          {(isAdmin || (isManager && !userData?.role?.includes('Site Supervisor'))) && (
                              <SidebarMenuSubItem>
                                  <SidebarMenuSubButton asChild isActive={pathname === '/admin/clients'}>
                                      <Link href="/admin/clients" prefetch={true}>
                                          <Briefcase className="mr-2 h-4 w-4" />
                                          <span>Client Management</span>
                                      </Link>
                                  </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                          )}

                          {canAccessFinancials && !userData?.role?.includes('Site Supervisor') && (
                              <SidebarMenuSubItem>
                                  <SidebarMenuSubButton asChild isActive={pathname === '/admin/quotations'}>
                                      <Link href="/admin/quotations" prefetch={true}>
                                          <FileText className="mr-2 h-4 w-4" />
                                          <span>Quotation Tracker</span>
                                      </Link>
                                  </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                          )}

                          {isAdmin && (
                              <SidebarMenuSubItem>
                                  <SidebarMenuSubButton asChild isActive={pathname === '/admin/rates'}>
                                      <Link href="/admin/rates" prefetch={true}>
                                          <Banknote className="mr-2 h-4 w-4" />
                                          <span>Service Rates</span>
                                      </Link>
                                  </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                          )}
                      </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <Separator className="my-1" />
        <UserNav />
      </SidebarFooter>
    </>
    );
}
