'use client';

import { useSearchParams, notFound, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AltekLogo } from '@/components/altek-logo';
import { useDoc, useFirestore, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
import type { DailyDiary, User } from '@/lib/types';
import { Loader2, Printer, ArrowLeft, Archive } from 'lucide-react';
import Image from 'next/image';
import React, { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { PinSigner } from '@/components/auth/PinSigner';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { WhatsAppShare } from '@/components/ui/whatsapp-share';

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
    return (
        <div className="flex justify-between py-1.5 border-b border-dashed">
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium text-right">{value || 'N/A'}</span>
        </div>
    );
}

function ImageGallery({ title, images }: { title: string; images?: string[] }) {
    if (!images || images.length === 0) {
        return null;
    }

    return (
        <div className="mt-4">
            <h4 className="font-semibold text-muted-foreground">{title}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
                {images.map((url, index) => (
                    <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                        <div className="relative group aspect-square border rounded-md overflow-hidden">
                            <Image src={url} alt={`${title} image ${index + 1}`} fill className="object-cover transition-transform group-hover:scale-105" />
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}


export default function ViewDiaryPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = searchParams.get('id');
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();
    const [isSaving, setIsSaving] = useState(false);

    const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

    const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: currentUserData, isLoading: currentUserLoading } = useDoc<User>(userRoleRef);

    const diaryRef = useMemoFirebase(() => id ? doc(firestore, 'daily_diaries', id) : null, [firestore, id]);
    const { data: diary, isLoading: diaryLoading } = useDoc<DailyDiary>(diaryRef);

    const managerUsers = useMemo(() => {
        if (!users) return [];
        const managerRoles = ['Admin', 'Superadmin', 'Client Manager', 'Corporate Manager', 'Services Manager', 'Site Supervisor'];
        return users.filter(u => u.role && managerRoles.includes(u.role));
    }, [users]);

    const isManager = useMemo(() => {
        if (!currentUserData?.role) return false;
        const managerRoles = ['Admin', 'Superadmin', 'Client Manager', 'Corporate Manager', 'Services Manager', 'Site Supervisor'];
        return managerRoles.includes(currentUserData.role);
    }, [currentUserData]);

    const isLoading = diaryLoading || isUserLoading || usersLoading || currentUserLoading;
    
    const equipmentName = useMemo(() => {
        if (!diary?.works) return 'General Work';
        const workWithEquipment = diary.works.find(w => w.scope?.startsWith('Unscheduled work on: '));
        if (workWithEquipment?.scope) {
            return workWithEquipment.scope.replace('Unscheduled work on: ', '');
        }
        return 'General Work';
    }, [diary]);

    const statusText = diary?.isFinalised ? '✅ APPROVED' : diary?.isSignedOff ? 'REVIEW PENDING' : '⚠️ IN PROGRESS';

    const commentsPart = (diary?.comments && diary.comments.filter(c=>c.trim()).length > 0) ? `\n\n📝 *NOTES:*\n${diary.comments.filter(c=>c.trim()).join('\n')}` : '';

    const waMessage = `📢 *MAINTENANCE REPORT*
🆔 *Job ID:* ${diary?.id.slice(-6).toUpperCase() || 'N/A'}
👷 *Tech:* ${diary?.contractorName || 'N/A'}
📍 *Loc:* ${diary?.area || 'N/A'}
⚙️ *Equip:* ${equipmentName}

🔧 *WORK DONE:* ${diary?.works?.[0]?.scope || 'N/A'}${commentsPart}

*Status:* ${statusText}`.trim();

    const handleClientSign = async (signatureUrl: string | null, signerName: string | null) => {
        if (!id || !diary) {
            toast({ variant: 'destructive', title: 'Error', description: 'Diary data is not loaded.' });
            return;
        }

        try {
            const diaryRef = doc(firestore, 'daily_diaries', id);
            await updateDoc(diaryRef, {
                clientSignature: signatureUrl,
                clientName: signerName,
                clientDate: format(new Date(), 'yyyy-MM-dd'),
                isFinalised: true,
                isSignedOff: true,
            });
            toast({ title: 'Diary Approved', description: 'The daily diary has been successfully signed.' });
            router.refresh();
        } catch (error: any) {
            console.error('Failed to save signature:', error);
            toast({ variant: 'destructive', title: 'Signature Failed', description: error.message });
        }
    };
    
    const handleFinalize = async () => {
        if (!id) return;
        if (!confirm('Are you sure you want to finalize and archive this diary? This action cannot be undone.')) return;
        
        setIsSaving(true);
        try {
            const diaryRef = doc(firestore, 'daily_diaries', id);
            await updateDoc(diaryRef, {
                isFinalised: true,
            });
            toast({
                title: 'Diary Finalized',
                description: 'The diary has been archived and locked from further edits.',
            });
            router.push('/completed-work/unscheduled');
        } catch (error: any) {
            console.error("Failed to finalize diary:", error);
            toast({ variant: 'destructive', title: 'Finalization Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading document...
            </div>
        );
    }

    if (!id || !diary) {
        notFound();
        return null;
    }

    return (
         <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-background">
            <div className="flex justify-end mb-4 gap-2 print:hidden">
                <WhatsAppShare text={waMessage} label="Share Update" />
                <Button onClick={() => router.back()} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Tracker
                </Button>
                <Button onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
                 {isManager && !diary.isFinalised && (
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleFinalize}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                        Finalize & Archive
                    </Button>
                )}
            </div>
            <Card className="p-8 shadow-lg">
                <header className="flex items-start justify-between mb-4 border-b pb-4">
                    <AltekLogo className="h-10" />
                    <div className="text-right">
                        <h1 className="text-2xl font-bold tracking-tight text-primary">DAILY DIARY</h1>
                        <p className="text-sm text-muted-foreground font-mono">ID: {diary.id}</p>
                    </div>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Diary Details</CardTitle>
                    </CardHeader>
                     <CardContent className="grid md:grid-cols-3 gap-6 text-sm">
                        <DetailRow label="Contract Title" value={diary.contractTitle} />
                        <DetailRow label="Contract Number" value={diary.contractNumber} />
                        <DetailRow label="Date" value={diary.date as string} />
                        <DetailRow label="Area" value={diary.area} />
                        <DetailRow label="Shift Start" value={diary.shiftStart} />
                        <DetailRow label="Shift End" value={diary.shiftEnd} />
                        <DetailRow label="Total Hours" value={diary.hrs} />
                    </CardContent>
                </Card>
                
                 <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>HSE</CardTitle>
                    </CardHeader>
                     <CardContent className="space-y-4 text-sm">
                        <div>
                            <h4 className="font-semibold text-muted-foreground">Incidents/Accidents/Injuries</h4>
                            <p>{diary.incidents || 'None reported.'}</p>
                        </div>
                         <div>
                            <h4 className="font-semibold text-muted-foreground">Toolbox Talk</h4>
                            <p>{diary.toolboxTalk || 'None reported.'}</p>
                        </div>
                        <ImageGallery title="HSE Documentation" images={diary.hseDocumentationScans} />
                    </CardContent>
                </Card>

                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>SECTION B: MANPOWER AND PLANT</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <h4 className="font-semibold text-muted-foreground">Manpower</h4>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Forecast</TableHead>
                                    <TableHead>Actual</TableHead>
                                    <TableHead>Normal</TableHead>
                                    <TableHead>1.5 OT</TableHead>
                                    <TableHead>2.0 OT</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Comments</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {diary.manpower?.length ? diary.manpower.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{item.designation}</TableCell>
                                        <TableCell>{item.forecast}</TableCell>
                                        <TableCell>{item.actual}</TableCell>
                                        <TableCell>{item.normalHrs}</TableCell>
                                        <TableCell>{item.overtime1_5}</TableCell>
                                        <TableCell>{item.overtime2_0}</TableCell>
                                        <TableCell>{item.totalManHrs}</TableCell>
                                        <TableCell>{item.comments}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={8} className="text-center">No manpower entries.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                        <Separator />
                        <h4 className="font-semibold text-muted-foreground">Plant</h4>
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead>Plant description</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Daily Inspection Done</TableHead>
                                    <TableHead>Comments</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {diary.plant?.length ? diary.plant.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{item.description}</TableCell>
                                        <TableCell>{item.qty}</TableCell>
                                        <TableCell>{item.inspectionDone}</TableCell>
                                        <TableCell>{item.comments}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={4} className="text-center">No plant entries.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="mt-4">
                    <CardHeader><CardTitle>SECTION C: DESCRIPTION OF WORKS</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Area of Work</TableHead>
                                    <TableHead>Scope of Work</TableHead>
                                    <TableHead>Time Start</TableHead>
                                    <TableHead>Time End</TableHead>
                                    <TableHead>Hrs</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {diary.works?.length ? diary.works.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{item.area}</TableCell>
                                        <TableCell>{item.scope}</TableCell>
                                        <TableCell>{item.timeStart}</TableCell>
                                        <TableCell>{item.timeEnd}</TableCell>
                                        <TableCell>{item.hrs}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={5} className="text-center">No work entries.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4 mt-4">
                    <Card>
                        <CardHeader><CardTitle>SECTION D: DELAYS</CardTitle></CardHeader>
                        <CardContent>
                            <ul className="list-disc pl-5">
                                {diary.delays?.length && diary.delays.some(d => d) ? diary.delays.map((item, index) => (
                                    item && <li key={index}>{item}</li>
                                )) : <li>No delays reported.</li>}
                            </ul>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle>SECTION E: COMMENTS</CardTitle></CardHeader>
                        <CardContent>
                             <ul className="list-disc pl-5">
                                {diary.comments?.length && diary.comments.some(c => c) ? diary.comments.map((item, index) => (
                                    item && <li key={index}>{item}</li>
                                )) : <li className="list-none">No comments.</li>}
                            </ul>
                        </CardContent>
                    </Card>
                </div>


                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>Gallery</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ImageGallery title="Before Work" images={diary.beforeWorkImages} />
                        <ImageGallery title="After Work" images={diary.afterWorkImages} />
                        {(!diary.beforeWorkImages || diary.beforeWorkImages.length === 0) && (!diary.afterWorkImages || diary.afterWorkImages.length === 0) && (
                            <p className="text-sm text-muted-foreground">No images were uploaded for this diary entry.</p>
                        )}
                    </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                    <Card>
                         <CardHeader className="p-4">
                            <CardTitle className="text-base text-center">CONTRACTOR</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <DetailRow label="Name" value={diary.contractorName} />
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Signature:</p>
                                {diary.contractorSignature ? <Image src={diary.contractorSignature} alt="Contractor Signature" width={200} height={100} className="border rounded-md" /> : <p>Not signed.</p>}
                            </div>
                             <DetailRow label="Date" value={diary.contractorDate} />
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="p-4">
                            <CardTitle className="text-base text-center">CLIENT / MANAGER</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {diary.clientSignature ? (
                                <>
                                    <DetailRow label="Name" value={diary.clientName} />
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Signature:</p>
                                        <Image src={diary.clientSignature} alt="Client Signature" width={200} height={100} className="border rounded-md" />
                                    </div>
                                    <DetailRow label="Date" value={diary.clientDate} />
                                </>
                            ) : (
                                <>
                                {diary.contractorSignature && isManager ? (
                                    <div className="mt-2">
                                        <p className="text-sm text-emerald-600 font-medium mb-2 text-center">Ready for Manager Approval</p>
                                        <PinSigner
                                            label="Sign Approval"
                                            users={managerUsers}
                                            onSigned={handleClientSign}
                                            disabled={diary.isFinalised}
                                        />
                                    </div>
                                ) : (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded text-center">
                                        <p className="text-amber-700 font-bold mb-1">Work In Progress</p>
                                        <p className="text-xs text-amber-800">The contractor must sign this diary before a manager can approve it.</p>
                                    </div>
                                )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </Card>
        </div>
    );
}
