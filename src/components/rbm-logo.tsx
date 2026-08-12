
import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export const RbmLogo = ({ className }: { className?: string }) => (
  <div className={cn("relative", className)}>
    <Image 
        src="/rbm-logo.png" 
        alt="Richards Bay Minerals"
        width={160}
        height={40}
        className="object-contain"
        unoptimized
    />
  </div>
);
