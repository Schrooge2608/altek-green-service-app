
'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AltekLogo } from '@/components/altek-logo';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { DailyDiary } from '@/lib/types';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

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
                            <Image src={url} alt={`${title} image ${index + 1}`} layout="fill" className="object-cover transition-transform group-hover:scale-105" />
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}


export default function ViewDailyDiaryPage() {
    const params = useParams();
    const router = useRouter();
    const id = typeof params.id === 'string' ? params.id : '';
    const firestore = useFirestore();

    const diaryRef = useMemoFirebase(() => doc(firestore, 'daily_diaries', id), [firestore, id]);
    const { data: diary, isLoading } = useDoc<DailyDiary>(diaryRef);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading document...
            </div>
        );
    }

    if (!diary) {
        notFound();
        return null;
    }

    return (
         <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-background">
            <div className="flex justify-end mb-4 gap-2 print:hidden">
                <Button onClick={() => router.back()} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Tracker
                </Button>
                <Button onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
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
                        <DetailRow label="Date" value={diary.date} />
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
                    </CardContent>
                </Card>

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
                
                 <div className="grid grid-cols-2 gap-8 mt-8">
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
                            <CardTitle className="text-base text-center">CLIENT</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <DetailRow label="Name" value={diary.clientName} />
                             <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Signature:</p>
                                {diary.clientSignature ? <Image src={diary.clientSignature} alt="Client Signature" width={200} height={100} className="border rounded-md" /> : <p>Not signed.</p>}
                            </div>
                            <DetailRow label="Date" value={diary.clientDate} />
                        </CardContent>
                    </Card>
                </div>
            </Card>
        </div>
    );
}
