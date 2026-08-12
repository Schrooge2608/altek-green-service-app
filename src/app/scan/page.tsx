'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ScanLine, Upload, Check, AlertTriangle, FileText, FileSearch } from 'lucide-react';
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
      
      if (selectedFile.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(selectedFile);
        setFilePreview(previewUrl);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleScan = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'No File Selected', description: 'Please select an image or PDF first.' });
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedData(null);

    try {
      const imageDataUri = await fileToDataUri(file);
      const result = await extractScheduleData({ imageDataUri });
      setExtractedData(result);
      toast({ title: 'Recognition Complete', description: 'Document analyzed successfully.' });
    } catch (e: any) {
      console.error(e);
      setError('Failed to analyze the document. The AI could not process the file format or the contents were unreadable.');
      toast({ variant: 'destructive', title: 'Scan Failed', description: e.message || 'An unknown error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSave = async () => {
    if (!extractedData) return;

    setIsLoading(true);
    try {
        const schedulesRef = collection(firestore, 'completed_schedules');
        const newDoc = await addDocumentNonBlocking(schedulesRef, {
            ...extractedData,
            processedAt: new Date().toISOString(),
            processedBy: user?.uid
        });
        toast({ title: 'Document Saved', description: 'Record created in database.' });
        router.push(`/completed-docs/${newDoc.id}`);
    } catch (e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the recognized data.' });
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Smart Document Scanner</h1>
        <p className="text-muted-foreground">
          Upload any maintenance schedule, technical note, or PDF to recognize and extract data.
        </p>
      </header>

      <Card className="border-primary/20 bg-slate-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> 
            Upload File
          </CardTitle>
          <CardDescription>Supported formats: Images (JPG, PNG), PDF, Text.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="picture" className="font-bold">Select File</Label>
            <Input 
                id="picture" 
                type="file" 
                accept="image/*,application/pdf,text/plain" 
                onChange={handleFileChange} 
                disabled={isLoading || isClientManager}
                className="bg-white"
            />
          </div>
          
          {file && !filePreview && !file.type.startsWith('image/') && (
            <div className="flex items-center gap-3 p-4 bg-white border rounded-md">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                    <p className="text-sm font-bold">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
            </div>
          )}

          {filePreview && (
            <div className="w-full max-w-md border-4 border-white shadow-md rounded-md overflow-hidden relative aspect-video">
                <Image src={filePreview} alt="File preview" fill className="object-contain bg-slate-200" />
            </div>
          )}

          <Button 
            onClick={handleScan} 
            disabled={isLoading || !file || isClientManager}
            className="w-full md:w-auto"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
            {isLoading ? 'Recognizing Content...' : 'Run AI Recognition'}
          </Button>
        </CardContent>
      </Card>
      
      {error && (
         <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Recognition Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {extractedData && (
        <Card className="border-emerald-200 shadow-lg">
            <CardHeader className="bg-emerald-50 border-b border-emerald-100">
                <CardTitle className="flex items-center gap-2 text-emerald-800">
                    <Check className="h-5 w-5" /> AI Recognized Data
                </CardTitle>
                <CardDescription>Review and correct the extracted information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                
                {extractedData.summary && (
                    <div className="p-4 bg-slate-100 rounded-md border italic text-sm">
                        <strong>AI Summary:</strong> {extractedData.summary}
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-xs uppercase text-slate-400 font-bold">Equipment</Label>
                        <p className="font-bold border-b pb-1">{extractedData.equipmentName || 'Unknown'}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs uppercase text-slate-400 font-bold">Date</Label>
                        <p className="font-bold border-b pb-1">{extractedData.completionDate || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs uppercase text-slate-400 font-bold">Area</Label>
                        <p className="font-bold border-b pb-1">{extractedData.area || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs uppercase text-slate-400 font-bold">Maintenance Type</Label>
                        <p className="font-bold border-b pb-1">{extractedData.maintenanceType || 'N/A'}</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 font-bold">Checklist / Findings</Label>
                    <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-4 py-2 text-left">Task</th>
                                    <th className="px-4 py-2 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {extractedData.checklist?.map((item, idx) => (
                                    <tr key={idx} className="border-b last:border-0">
                                        <td className="px-4 py-2">{item.task}</td>
                                        <td className="px-4 py-2 text-center">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                item.status === 'checked' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                 <Button 
                    onClick={handleSave} 
                    disabled={isLoading || isClientManager}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Accept Results & Save Record
                </Button>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
