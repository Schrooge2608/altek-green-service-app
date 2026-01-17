
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ScanLine, Upload, Check, AlertTriangle } from 'lucide-react';
import { extractScheduleData, type DocumentScanOutput } from '@/ai/flows/extract-schedule-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { User as AppUser } from '@/lib/types';

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ScanPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  const { user } = useUser();

  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<DocumentScanOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userRole } = useDoc<AppUser>(userRoleRef);
  const isClientManager = userRole?.role === 'Client Manager';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractedData(null);
      setError(null);
      const previewUrl = URL.createObjectURL(selectedFile);
      setFilePreview(previewUrl);
    }
  };

  const handleScan = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'No File Selected', description: 'Please upload an image first.' });
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedData(null);

    try {
      const imageDataUri = await fileToDataUri(file);
      const result = await extractScheduleData({ imageDataUri });
      setExtractedData(result);
      toast({ title: 'Scan Complete', description: 'Review the extracted data below and save.' });
    } catch (e: any) {
      console.error(e);
      setError('Failed to analyze the document. The AI model could not process the image. Please try a clearer image.');
      toast({ variant: 'destructive', title: 'Scan Failed', description: e.message || 'An unknown error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSave = async () => {
    if (!extractedData) {
        toast({ variant: 'destructive', title: 'No Data', description: 'There is no extracted data to save.' });
        return;
    }

    setIsLoading(true);
    try {
        const schedulesRef = collection(firestore, 'completed_schedules');
        const newDoc = await addDocumentNonBlocking(schedulesRef, extractedData);
        toast({ title: 'Document Saved', description: 'The new completed schedule has been added to the database.' });
        router.push(`/completed-docs/${newDoc.id}`);
    } catch (e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the document to the database.' });
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Scan Maintenance Document</h1>
        <p className="text-muted-foreground">
          Upload an image of a completed schedule to auto-populate a new document.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Upload Document Image</CardTitle>
          <CardDescription>Select a clear photo or screenshot of the maintenance form.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="picture">Document Image</Label>
            <Input id="picture" type="file" accept="image/*" onChange={handleFileChange} disabled={isLoading || isClientManager} />
          </div>
          {filePreview && (
            <div className="w-full max-w-md border p-2 rounded-md">
                <Image src={filePreview} alt="File preview" width={400} height={400} className="w-full h-auto object-contain" />
            </div>
          )}
          <Button onClick={handleScan} disabled={isLoading || !file || isClientManager}>
            {isLoading && !extractedData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
            {isLoading && !extractedData ? 'Analyzing...' : 'Scan Document'}
          </Button>
        </CardContent>
      </Card>
      
      {error && (
         <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Analysis Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {extractedData && (
        <Card>
            <CardHeader>
                <CardTitle>Extracted Data</CardTitle>
                <CardDescription>Review the information extracted by the AI. You can edit this before saving.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 {/* This would be a form to edit the extractedData state */}
                <pre className="p-4 bg-muted rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(extractedData, null, 2)}
                </pre>
                 <Button onClick={handleSave} disabled={isLoading || isClientManager}>
                    {isLoading && extractedData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    {isLoading && extractedData ? 'Saving...' : 'Accept and Save'}
                </Button>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
