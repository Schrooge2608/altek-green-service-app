'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { scanNameplate } from '@/ai/flows/scan-nameplate-flow';
import { useToast } from '@/hooks/use-toast';

export function NameplateScanner({ onDataExtracted }: { onDataExtracted: (data: any) => void }) {
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUri = reader.result as string;
        const result = await scanNameplate({ imageDataUri: dataUri });
        
        if (result.success) {
          onDataExtracted(result);
          toast({ title: "Scan Successful", description: "Technical data extracted by AI." });
        } else {
          toast({ variant: 'destructive', title: "Scan Failed", description: result.error });
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button 
        type="button" 
        variant="outline" 
        className="border-primary text-primary hover:bg-primary/5 gap-2"
        disabled={isScanning}
        onClick={() => document.getElementById('nameplate-upload')?.click()}
      >
        {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {isScanning ? 'Analyzing...' : 'Scan Nameplate with AI'}
      </Button>
      <input 
        id="nameplate-upload"
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleFileChange} 
      />
    </div>
  );
}
