
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AltekLogo } from '@/components/altek-logo';
import { useFirebase, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function NewDailyDiaryPage() {
    const { firestore, auth } = useFirebase();
    const { user } = useUser();
    const { toast } = useToast();
    const router = useRouter();

    const saveNewDiaryEntry = async () => {
        try {
            const currentUser = auth.currentUser;

            // 1. SAFETY CHECK: Are we logged in?
            if (!currentUser) {
                toast({ variant: "destructive", title: "STOP", description: "You are not logged in. The app cannot save." });
                return;
            }
            
            toast({ title: "Debug Step 1", description: `User Found: ${currentUser.uid}` });

            // 2. PREPARE THE DATA (The "Key")
            const newDiaryData = {
                userId: currentUser.uid,       // <--- CRITICAL: Must match auth.uid
                isSignedOff: false,          // <--- CRITICAL: Must be false
                createdAt: serverTimestamp(), // <--- CRITICAL: Timestamp
                content: "New Entry",        // Placeholder content
                status: "Draft"
            };
            
            toast({ title: "Debug Step 2", description: `Sending this data: ${JSON.stringify(newDiaryData, null, 2)}` });

            // BB's requested check:
            const collectionName = 'daily_diaries';
            toast({ title: "BB CHECK", description: `Attempting to save to collection named: "${collectionName}"` });

            // BB's SPY code
            console.log("BB SPY: Connected to Project ID:", firestore.app.options.projectId);
            alert("BB SPY: Connected to Project ID: " + firestore.app.options.projectId);

            // 3. SEND TO FIREBASE
            await addDoc(collection(firestore, collectionName), newDiaryData);
            
            toast({ title: "SUCCESS!", description: "The document was saved." });
            router.push('/reports/diary-tracker');

        } catch (error: any) {
            console.error("SAVE FAILED:", error);
            toast({ variant: "destructive", title: "STILL FAILING", description: error.message });
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-background">
            <Card className="p-8 shadow-lg" id="diary-form">
                <header className="flex items-start justify-between mb-4 border-b pb-4">
                    <AltekLogo className="h-10" />
                    <div className="text-right">
                        <h1 className="text-2xl font-bold tracking-tight text-primary">DEBUG MODE: Daily Diary</h1>
                    </div>
                </header>
                <CardContent className="text-center">
                    <p className="mb-4">This page is in a temporary debug mode to solve the saving issue. Please click the button below to run the test.</p>
                    <Button onClick={saveNewDiaryEntry}>
                        Run Save Test
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
