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
} from '@/components/ui/sidebar';
import { AltekLogo } from '@/components/altek-logo';
import {
  LayoutDashboard,
  Database,
  Wrench,
  Calendar,
  FileText,
  TriangleAlert,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/equipment', label: 'Equipment', icon: Wrench },
  { href: '/maintenance', label: 'Maintenance', icon: Calendar },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/breakdowns', label: 'Breakdowns', icon: TriangleAlert },
];

const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');

export function SidebarNav() {
  const pathname = usePathname();

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
          {links.map((link) => (
            <SidebarMenuItem key={link.href}>
              <Link href={link.href}>
                <SidebarMenuButton
                  isActive={pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))}
                  tooltip={link.label}
                >
                  <link.icon />
                  <span>{link.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
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
