
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignaturePad } from '@/components/ui/signature-pad';
import { useUser, useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, KeyRound, Image as ImageIcon } from 'lucide-react';
import type { User } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';

export default function CaptureSignaturePage() {
    const { user } = useUser();
    const { firestore, firebaseApp } = useFirebase();
    const { toast } = useToast();
    
    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userData } = useDoc<User>(userDocRef);
    
    const [signature, setSignature] = useState<string | null>(null);
    const [pin, setPin] = useState('');
    const [isSavingPin, setIsSavingPin] = useState(false);
    const [isSavingSig, setIsSavingSig] = useState(false);

    useEffect(() => {
        if (userData) {
            setSignature(userData.signatureUrl || null);
            setPin(userData.signingPin || '');
        }
    }, [userData]);

    const handleSaveSignature = async () => {
        if (!user || !signature || !firestore || !firebaseApp) return;

        if (signature === userData?.signatureUrl) {
            toast({ title: "No Changes", description: "This signature is already saved." });
            return;
        }

        setIsSavingSig(true);
        try {
            let finalUrl = signature;
            
            if (signature.startsWith('data:image')) {
                const storage = getStorage(firebaseApp);
                const storageRef = ref(storage, `users/${user.uid}/signature.png`);
                await uploadString(storageRef, signature, 'data_url');
                finalUrl = await getDownloadURL(storageRef);
                setSignature(finalUrl);
            }

            const userRef = doc(firestore, 'users', user.uid);
            await updateDoc(userRef, { signatureUrl: finalUrl });

            toast({ title: "Success", description: "Your digital signature has been saved." });
        } catch (error: any) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save signature." });
        } finally {
            setIsSavingSig(false);
        }
    };
    
    const handleSavePin = async () => {
        if (!user) return;
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            toast({ variant: "destructive", title: "Invalid PIN", description: 'PIN must be exactly 4 digits.' });
            return;
        }
        setIsSavingPin(true);
        try {
            await updateDoc(doc(firestore, 'users', user.uid), { signingPin: pin });
            toast({ title: "Security PIN Updated", description: 'Your new PIN has been saved successfully.' });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: 'There was a problem saving your PIN.' });
        } finally {
            setIsSavingPin(false);
        }
    };
    
    const handleClearSignature = () => {
        setSignature(null);
    }

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">My Profile Settings</h1>
            <p className="text-muted-foreground mb-8">Manage your digital signature and security PIN for signing documents.</p>

            <Tabs defaultValue="signature" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="signature"><ImageIcon className="mr-2 h-4 w-4" /> My Signature</TabsTrigger>
                    <TabsTrigger value="pin"><KeyRound className="mr-2 h-4 w-4" /> My Security PIN</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signature" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Digital Signature</CardTitle>
                            <CardDescription>
                                Draw your signature below. This image will be stamped on documents when you enter your PIN.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="space-y-2">
                                <Label className="text-sm font-semibold">Signature Pad</Label>
                                <div className="border rounded-xl overflow-hidden shadow-sm min-h-[200px] flex items-center justify-center p-4 bg-slate-50">
                                    {signature && !signature.startsWith('data:') ? (
                                        <div className="relative">
                                            <Image src={signature} alt="Saved Signature" width={300} height={150} className="object-contain" />
                                        </div>
                                    ) : (
                                        <SignaturePad 
                                            value={signature} 
                                            onSign={setSignature} 
                                            onClear={() => setSignature(null)} 
                                        />
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <Button 
                                    className="w-full" 
                                    onClick={handleSaveSignature} 
                                    disabled={isSavingSig || !signature || (signature === userData?.signatureUrl)}
                                >
                                    {isSavingSig ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                                    {isSavingSig ? 'Saving...' : 'Save Signature'}
                                </Button>
                                {signature && (
                                     <Button 
                                        variant="destructive"
                                        className="w-full" 
                                        onClick={handleClearSignature}
                                    >
                                        <Trash2 className="mr-2 h-5 w-5" />
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="pin" className="mt-6">
                     <Card>
                        <CardHeader>
                            <CardTitle>Manage Signing PIN</CardTitle>
                            <CardDescription>
                                Create a 4-digit PIN. You will use this code to securely sign documents.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col space-y-2 max-w-xs">
                                <Label htmlFor="pin-input">Enter 4-Digit PIN</Label>
                                <Input 
                                    id="pin-input"
                                    type="password" 
                                    className="text-2xl tracking-[0.5em] text-center" 
                                    maxLength={4}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                    autoComplete="new-password"
                                />
                            </div>
                            <Button onClick={handleSavePin} disabled={isSavingPin}>
                                {isSavingPin ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {isSavingPin ? 'Saving...' : 'Update PIN'}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

    