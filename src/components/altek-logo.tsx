import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export const AltekLogo = ({ className }: { className?: string }) => (
  <div className={cn("relative", className)}>
    <Image 
        src="/Altek-Logo.jpeg" 
        alt="Altek Green"
        width={160}
        height={40}
        className="object-contain"
    />
  </div>
);

// To use your own logo, you can replace the src property in the Image component.
// For example: src="/your-logo.jpg" if the logo is in the public folder,
// or src="https://your-cdn.com/your-logo.jpg" for an external logo.
// Remember to add the hostname to next.config.ts if you use an external URL.