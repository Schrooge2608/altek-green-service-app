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
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import React from 'react';

const mainLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/maintenance', label: 'Maintenance', icon: Calendar },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/breakdowns', label: 'Breakdowns', icon: TriangleAlert },
];

const miningDivisions = [
    { href: '/equipment/mining/boosters', label: 'Boosters' },
]

const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');

export function SidebarNav() {
  const pathname = usePathname();
  const isEquipmentPath = pathname.startsWith('/equipment');
  const [isMiningOpen, setIsMiningOpen] = React.useState(isEquipmentPath);
  const [isSmelterOpen, setIsSmelterOpen] = React.useState(false);

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
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <Separator className="my-1" />
        <div className="flex items-center gap-3 p-2">
          <Avatar>
            {userAvatar && <AvatarImage src={userAvatar.imageUrl} data-ai-hint={userAvatar.imageHint} />}
            <AvatarFallback>AU</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-sidebar-foreground">
              Admin User
            </span>
            <span className="text-xs text-sidebar-foreground/70">
              admin@altek.com
            </span>
          </div>
        </div>
      </SidebarFooter>
    </>
  );
}
