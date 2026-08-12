'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface PinSignerProps {
  label: string;
  users: User[];
  onSigned: (signatureUrl: string | null, signerName: string | null) => Promise<void>;
  disabled?: boolean;
}

export function PinSigner({ label, users, onSigned, disabled }: PinSignerProps) {
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const handleSign = async () => {
    if (pin.length !== 4) return;
    
    setIsVerifying(true);
    const matchedUser = users.find(u => u.signingPin === pin);

    if (matchedUser) {
      await onSigned(matchedUser.signatureUrl || null, matchedUser.name);
      setPin('');
    } else {
      toast({ variant: 'destructive', title: "Invalid PIN", description: "The 4-digit code is incorrect." });
    }
    setIsVerifying(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input 
          type="password" 
          maxLength={4} 
          placeholder="Enter 4-Digit PIN..." 
          className="pl-9 h-12 text-lg tracking-[0.5em] font-black"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          disabled={disabled || isVerifying}
        />
      </div>
      <Button 
        type="button" 
        className="bg-emerald-600 hover:bg-emerald-700"
        onClick={handleSign}
        disabled={disabled || isVerifying || pin.length !== 4}
      >
        {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
        {label}
      </Button>
    </div>
  );
}
