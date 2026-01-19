

"use client";

import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './button';
import { Card } from './card';
import { cn } from '@/lib/utils';
import { Eraser, Pen } from 'lucide-react';
import Image from 'next/image';

interface SignaturePadProps {
    value?: string | null;
    onSign: (dataUrl: string) => void;
    onClear: () => void;
}

export function SignaturePad({ value, onSign, onClear }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [isEditing, setIsEditing] = useState(!value);

  useEffect(() => {
    setIsEditing(!value);
  }, [value]);

  const handleSign = () => {
    if (sigCanvas.current) {
        if(sigCanvas.current.isEmpty()) {
            // Don't show an alert, just call onSign with an empty string
            onSign('');
            setIsEditing(false);
            return;
        }
        const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
        onSign(dataUrl);
        setIsEditing(false);
    }
  };

  const handleClear = () => {
      if (sigCanvas.current) {
          sigCanvas.current.clear();
      }
      onClear();
  }
  
  const handleEdit = () => {
      onClear();
      setIsEditing(true);
  }

  if (!isEditing && value) {
    return (
        <div className="relative group w-full h-full min-h-[50px]">
            <Image src={value} alt="signature" width={100} height={50} className="w-full h-auto" />
            <Button variant="ghost" size="icon" onClick={handleEdit} className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                <Pen className="h-4 w-4" />
            </Button>
        </div>
    )
  }

  return (
    <div>
        <Card className="relative w-full aspect-[2/1] border-dashed">
            <SignatureCanvas
                ref={sigCanvas}
                penColor="black"
                canvasProps={{ className: 'w-full h-full rounded-lg' }}
            />
        </Card>
      <div className="flex justify-end gap-2 mt-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={handleClear}>
            <Eraser className="mr-2 h-4 w-4" />
            Clear
        </Button>
        <Button variant="outline" size="sm" onClick={handleSign}>
            <Pen className="mr-2 h-4 w-4" />
            Sign
        </Button>
      </div>
    </div>
  );
}

    