
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SignaturePad } from '@/components/ui/signature-pad';
import { useUser, useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2, ArrowLeft } from 'lucide-react';
import { AltekLogo } from '@/components/altek-logo';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';

export default function CaptureSignaturePage() {
    const { user } = useUser();
    const { firestore, firebaseApp } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    
    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userData } = useDoc<User>(userDocRef);
    
    const [signature, setSignature] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Load existing signature from profile on mount
    useEffect(() => {
        if (userData?.signatureUrl) {
            setSignature(userData.signatureUrl);
        }
    }, [userData]);

    const handleSave = async () => {
        if (!user || !signature || !firestore || !firebaseApp) return;

        setIsSaving(true);
        try {
            let finalUrl = signature;
            
            // If it's a new drawing (starts with 'data:image'), upload it to Storage
            if (signature.startsWith('data:image')) {
                const storage = getStorage(firebaseApp);
                // Save as a consistent filename so it overwrites the old one to save space
                const storageRef = ref(storage, `users/${user.uid}/signature.png`);
                await uploadString(storageRef, signature, 'data_url');
                finalUrl = await getDownloadURL(storageRef);
            }

            // Save the URL to the User Profile in Firestore
            const userRef = doc(firestore, 'users', user.uid);
            await updateDoc(userRef, { signatureUrl: finalUrl });

            toast({ title: "Success", description: "Your digital signature has been saved." });
        } catch (error: any) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save signature." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-8">
            <Card className="shadow-lg">
                <CardHeader className="text-center border-b pb-6 bg-muted/20">
                    <div className="flex justify-center mb-4"><AltekLogo className="h-10 w-auto" /></div>
                    <CardTitle className="text-2xl">My Digital Signature</CardTitle>
                    <p className="text-muted-foreground text-sm">Create your signature once. Use it on all forms.</p>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    
                    {/* DISPLAY AREA */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold tracking-wide text-foreground/70 uppercase">Current Signature</label>
                            {signature && (
                                <Button variant="ghost" size="sm" onClick={() => setSignature(null)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="mr-2 h-4 w-4" /> Clear & Redraw
                                </Button>
                            )}
                        </div>

                        {/* LOGIC: Show Image if saved, Show Pad if empty/drawing */}
                        {signature && !signature.startsWith('data:') ? (
                            <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-8 bg-slate-50 flex flex-col items-center justify-center min-h-[200px]">
                                <img src={signature} alt="Saved Signature" className="h-24 object-contain" />
                                <div className="absolute bottom-2 right-2 text-xs text-green-600 font-medium flex items-center bg-green-100 px-2 py-1 rounded">
                                    <span className="h-2 w-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                                    Saved & Ready
                                </div>
                            </div>
                        ) : (
                            <div className="border rounded-xl overflow-hidden shadow-sm">
                                <SignaturePad 
                                    value={signature} 
                                    onSign={setSignature} 
                                    onClear={() => setSignature(null)} 
                                />
                            </div>
                        )}
                    </div>

                    {/* SAVE BUTTON */}
                    <div className="flex items-center gap-2">
                         <Button 
                            variant="outline"
                            className="w-full h-12 text-lg" 
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="mr-2 h-5 w-5" />
                            Back
                        </Button>
                        <Button 
                            className="w-full h-12 text-lg" 
                            onClick={handleSave} 
                            disabled={isSaving || !signature || (signature === userData?.signatureUrl)}
                        >
                            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                            {isSaving ? 'Saving...' : 'Save Signature'}
                        </Button>
                    </div>

                    <p className="text-xs text-center text-muted-foreground">
                        By clicking save, you agree that this digital signature carries the same weight as your physical signature on Altek Green documents.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
