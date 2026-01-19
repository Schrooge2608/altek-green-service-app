

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
        <div className="relative group w-full h-full min-h-[40px] flex items-center">
            <Image src={value} alt="signature" width={100} height={40} className="w-full h-auto" />
            <Button variant="ghost" size="icon" onClick={handleEdit} className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                <Pen className="h-3 w-3" />
            </Button>
        </div>
    )
  }

  return (
    <div>
        <Card className="relative w-full h-14 border-dashed">
            <SignatureCanvas
                ref={sigCanvas}
                penColor="black"
                canvasProps={{ className: 'w-full h-full rounded-lg' }}
            />
        </Card>
      <div className="flex justify-end gap-1 mt-1 print:hidden">
        <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 px-2 text-xs">
            <Eraser className="mr-1 h-3 w-3" />
            Clear
        </Button>
        <Button variant="outline" size="sm" onClick={handleSign} className="h-7 px-2 text-xs">
            <Pen className="mr-1 h-3 w-3" />
            Sign
        </Button>
      </div>
    </div>
  );
}
