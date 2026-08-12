
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  KeyRound, 
  Search, 
  Loader2, 
  LogOut, 
  TriangleAlert, 
  Clock, 
  LayoutGrid,
  ChevronRight,
  ShieldCheck,
  Delete
} from 'lucide-react';
import { 
  useCollection, 
  useFirebase, 
  useMemoFirebase,
  useUser
} from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { useKiosk } from '@/components/kiosk/kiosk-provider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AltekLogo } from '@/components/altek-logo';

export default function KioskPage() {
  const { firestore } = useFirebase();
  const { user: masterUser } = useUser();
  const { toast } = useToast();
  const { activeKioskUser, loginKioskUser, logoutKioskUser } = useKiosk();

  // Hydration safeguard
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTech, setSelectedTech] = useState<AppUser | null>(null);
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch all users for the grid - AUTH GUARDED
  const usersQuery = useMemoFirebase(
    () => {
      if (!firestore || !masterUser) return null;
      return query(collection(firestore, 'users'), orderBy('name', 'asc'));
    },
    [firestore, masterUser]
  );
  const { data: allUsers, isLoading } = useCollection<AppUser>(usersQuery);

  const technicians = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.role?.includes('Technician') || 
      u.role?.includes('Engineer') || 
      u.role?.includes('Technologist') ||
      u.role?.includes('specialist')
    );
  }, [allUsers]);

  const filteredTechs = useMemo(() => {
    return technicians.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [technicians, searchTerm]);

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const verifyPin = async () => {
    if (!selectedTech || pin.length !== 4) return;
    
    setIsVerifying(true);
    // Secure verification against cached user data
    if (selectedTech.signingPin === pin) {
      loginKioskUser(selectedTech);
      toast({ title: `Welcome, ${selectedTech.name}`, description: "Terminal session started." });
      setPin('');
      setSelectedTech(null);
    } else {
      toast({ variant: 'destructive', title: "Invalid PIN", description: "The access code entered is incorrect." });
      setPin('');
    }
    setIsVerifying(false);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  // If already logged in, show the Kiosk Dashboard
  if (activeKioskUser) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 md:p-12 flex flex-col items-center">
        <header className="w-full max-w-4xl flex justify-between items-center mb-12">
          <AltekLogo className="h-12 w-auto invert brightness-0" />
          <div className="text-right">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Active Technician</p>
            <h2 className="text-xl font-black">{activeKioskUser.name}</h2>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          <Link href="/reports/field-service-report/new" className="group">
            <Card className="bg-slate-800 border-slate-700 hover:border-red-500 transition-all cursor-pointer h-full">
              <CardContent className="p-10 flex flex-col items-center text-center gap-6">
                <div className="p-6 bg-red-500/10 rounded-full group-hover:bg-red-500/20 transition-colors">
                  <TriangleAlert className="h-16 w-16 text-red-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-black mb-2">Report Breakdown</h3>
                  <p className="text-slate-400 text-sm">Log an equipment failure or emergency immediately.</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/time-attendance" className="group">
            <Card className="bg-slate-800 border-slate-700 hover:border-emerald-500 transition-all cursor-pointer h-full">
              <CardContent className="p-10 flex flex-col items-center text-center gap-6">
                <div className="p-6 bg-emerald-500/10 rounded-full group-hover:bg-emerald-500/20 transition-colors">
                  <Clock className="h-16 w-16 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-black mb-2">Clock In / Out</h3>
                  <p className="text-slate-400 text-sm">Log your shift hours and verify your location via GPS.</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/reports/contractors-daily-diary" className="group">
            <Card className="bg-slate-800 border-slate-700 hover:border-blue-500 transition-all cursor-pointer h-full">
              <CardContent className="p-8 flex items-center gap-6">
                <div className="p-4 bg-blue-500/10 rounded-lg">
                  <LayoutGrid className="h-10 w-10 text-blue-500" />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold">Daily Diary</h3>
                  <p className="text-slate-400 text-xs">Submit your shift work report.</p>
                </div>
                <ChevronRight className="ml-auto h-6 w-6 text-slate-600" />
              </CardContent>
            </Card>
          </Link>

          <Button 
            variant="ghost" 
            onClick={logoutKioskUser}
            className="h-full border-2 border-dashed border-slate-700 text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/50"
          >
            <LogOut className="mr-2 h-6 w-6" />
            Finish Session / Switch User
          </Button>
        </div>

        <footer className="mt-auto pt-12 text-center opacity-30 text-[10px] uppercase tracking-[0.3em]">
          Altek Green Shared Tablet Interface • Terminal: {masterUser?.email || 'OFFLINE'}
        </footer>
      </div>
    );
  }

  // Login View
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden">
      
      {/* Left: User Selection */}
      <div className="w-full md:w-1/2 flex flex-col p-6 md:p-12">
        <header className="mb-8">
          <AltekLogo className="h-10 w-auto mb-6" />
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kiosk Login</h1>
          <p className="text-slate-500">Select your name to begin your session.</p>
        </header>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input 
            placeholder="Search your name..." 
            className="pl-10 h-12 text-lg bg-white border-slate-200 shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-2">
          {isLoading ? (
            <div className="col-span-full py-20 text-center">
              <Loader2 className="animate-spin h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs text-slate-400 mt-2">Connecting to site database...</p>
            </div>
          ) : filteredTechs.length > 0 ? (
            filteredTechs.map(tech => (
              <Button 
                key={tech.id}
                variant={selectedTech?.id === tech.id ? "default" : "outline"}
                className={cn(
                  "h-16 justify-start text-left px-4 border-2 transition-all",
                  selectedTech?.id === tech.id ? "border-primary ring-4 ring-primary/10" : "bg-white hover:border-primary/50"
                )}
                onClick={() => { setSelectedTech(tech); setPin(''); }}
              >
                <Users className="h-5 w-5 mr-3 shrink-0 opacity-50" />
                <div className="truncate">
                  <p className="font-bold text-sm leading-none mb-1">{tech.name}</p>
                  <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">{tech.role}</p>
                </div>
              </Button>
            ))
          ) : (
            <div className="col-span-full py-20 text-center text-slate-400 italic">
              No technicians found matching your search.
            </div>
          )}
        </div>
      </div>

      {/* Right: PIN Pad */}
      <div className={cn(
        "w-full md:w-1/2 bg-slate-900 flex flex-col items-center justify-center p-12 transition-all duration-500",
        !selectedTech && "opacity-20 pointer-events-none grayscale"
      )}>
        <div className="max-w-xs w-full space-y-8">
          <div className="text-center space-y-2">
            <KeyRound className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-white text-2xl font-bold">Enter Access PIN</h2>
            <p className="text-slate-400 text-sm">Security verification for {selectedTech?.name}</p>
          </div>

          <div className="flex justify-center gap-4">
            {[0, 1, 2, 3].map(i => (
              <div 
                key={i} 
                className={cn(
                  "w-12 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-all",
                  pin.length > i ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" : "border-slate-700 bg-slate-800 text-slate-600"
                )}
              >
                {pin.length > i ? "•" : ""}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0"].map((digit, i) => (
              digit ? (
                <Button 
                  key={digit}
                  onClick={() => handlePinInput(digit)}
                  className="h-16 text-2xl font-black bg-slate-800 hover:bg-slate-700 border-slate-700 text-white"
                >
                  {digit}
                </Button>
              ) : i === 9 ? (
                <Button 
                  key="clear"
                  onClick={() => setPin('')}
                  variant="ghost"
                  className="h-16 text-slate-500 hover:text-white"
                >
                  CLR
                </Button>
              ) : null
            ))}
            <Button 
              onClick={handleBackspace}
              className="h-16 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-500"
            >
              <Delete className="h-6 w-6" />
            </Button>
          </div>

          <Button 
            onClick={verifyPin} 
            disabled={pin.length !== 4 || isVerifying}
            className="w-full h-16 text-xl font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-900/20"
          >
            {isVerifying ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="mr-2 h-6 w-6" />}
            Unlock Terminal
          </Button>
        </div>
      </div>
    </div>
  );
}
