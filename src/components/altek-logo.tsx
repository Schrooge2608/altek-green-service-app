import React from 'react';
import { cn } from '@/lib/utils';

interface AltekLogoProps {
  className?: string;
  unoptimized?: boolean;
}

export const AltekLogo = ({ className }: AltekLogoProps) => (
  <div className={cn("flex items-center h-10", className)}>
    {/* This points directly to your Altek-Logo.png file in the public folder */}
    <img 
      src="/Altek-Logo.jpeg" 
      alt="Altek Green Logo" 
      className="h-full w-auto object-contain"
    />
  </div>
);