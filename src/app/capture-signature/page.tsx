
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Save, Eraser } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

export default function CaptureSignaturePage() {
  const { toast } = useToast();
  const [signature, setSignature] = useState<string | null>(null);

  const handleSave = () => {
    if (signature) {
      // In a real app, this would be saved to a database or used in a document.
      // For this demo, we just log it and show a confirmation.
      console.log('Captured Signature Data URL:', signature);
      toast({
        title: 'Signature Captured',
        description: 'The signature image data has been logged to the console.',
      });
    }
  };

  const handleClear = () => {
    setSignature(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Capture Signature</h1>
        <p className="text-muted-foreground">
          Use the pad below to capture and save a signature.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Signature Pad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="mx-auto w-full max-w-md">
            <SignaturePad value={signature} onSign={setSignature} onClear={handleClear} />
          </div>
          <div className="flex justify-center gap-4">
             <Button onClick={handleSave} disabled={!signature}>
              <Save className="mr-2 h-4 w-4" />
              Save Signature
            </Button>
             <Button variant="outline" onClick={handleClear} disabled={!signature}>
                <Eraser className="mr-2 h-4 w-4" />
                Clear
            </Button>
          </div>
           {signature && (
            <div className="mt-4 p-4 border rounded-md max-w-md mx-auto">
                <h3 className="font-semibold mb-2">Captured Signature Preview:</h3>
                <Image src={signature} alt="Captured Signature" width={400} height={150} style={{ objectFit: 'contain' }} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
