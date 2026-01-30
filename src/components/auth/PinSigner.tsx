'use client';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { User } from '@/lib/types';
import { Loader2, Trash2 } from 'lucide-react';
import Image from 'next/image';

interface PinSignerProps {
  label: string;
  users: User[];
  onSigned: (signatureUrl: string | null, signerName: string | null) => void;
  initialSignatureUrl?: string | null;
  initialSignerName?: string | null;
  disabled?: boolean;
}

export function PinSigner({ label, users, onSigned, initialSignatureUrl, initialSignerName, disabled }: PinSignerProps) {
  const firestore = useFirestore();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signedData, setSignedData] = useState<{name: string; url: string} | null>(null);

  useEffect(() => {
    if (initialSignatureUrl && initialSignerName) {
        setSignedData({ url: initialSignatureUrl, name: initialSignerName });
    } else {
        setSignedData(null);
    }
  }, [initialSignatureUrl, initialSignerName]);

  const handleVerify = async () => {
    if (!selectedUserId || pin.length < 4) return;
    setLoading(true);
    setError('');

    try {
      const userRef = doc(firestore, 'users', selectedUserId);
      const snap = await getDoc(userRef);
      
      if (snap.exists()) {
        const data = snap.data();
        
        if (data.signingPin === pin) {
          if (data.signatureUrl) {
            const result = { name: data.name, url: data.signatureUrl };
            setSignedData(result);
            onSigned(result.url, result.name);
          } else {
            setError('User has no signature image saved in their profile.');
          }
        } else {
          setError('Incorrect PIN.');
        }
      } else {
          setError('User not found.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during verification.');
    } finally {
      setLoading(false);
      setPin(''); // Clear PIN for security
    }
  };

  const handleClear = () => {
    setSignedData(null);
    onSigned(null, null);
    setSelectedUserId('');
  }

  if (signedData) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="relative border rounded-md p-4 bg-white flex flex-col items-center">
            <Image src={signedData.url} alt={`${signedData.name}'s signature`} width={200} height={100} className="object-contain h-24" />
            <p className="text-sm font-medium mt-2">{signedData.name}</p>
            {!disabled && (
                <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-1 right-1 h-6 w-6 p-0 text-red-500 hover:bg-red-50" 
                    onClick={handleClear}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
        <Label>{label}</Label>
        <div className="space-y-3 p-4 border-2 border-dashed rounded-md bg-slate-50">
            <Select onValueChange={setSelectedUserId} disabled={disabled}>
            <SelectTrigger className="bg-white">
                <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
                {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                ))}
            </SelectContent>
            </Select>
            
            {selectedUserId && (
            <div className="flex gap-2">
                <Input 
                type="password" 
                placeholder="Enter PIN" 
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="bg-white"
                />
                <Button type="button" onClick={handleVerify} disabled={loading || pin.length < 4}>
                {loading ? <Loader2 className="animate-spin" /> : 'Sign'}
                </Button>
            </div>
            )}
            
            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
        </div>
    </div>
  );
}
