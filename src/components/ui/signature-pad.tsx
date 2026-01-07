"use client";

import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './button';
import { Card } from './card';
import { cn } from '@/lib/utils';
import { Eraser, Pen } from 'lucide-react';

export function SignaturePad() {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [dataURL, setDataURL] = useState<string | null>(null);

  const clear = () => {
    sigCanvas.current?.clear();
    setIsSigned(false);
    setDataURL(null);
  };

  const sign = () => {
    if (sigCanvas.current) {
        if(sigCanvas.current.isEmpty()) {
            alert("Please provide a signature first.");
            return;
        }
        setDataURL(sigCanvas.current.getTrimmedCanvas().toDataURL('image/png'));
        setIsSigned(true);
    }
  };

  return (
    <div>
        {isSigned && dataURL ? (
             <div className="flex justify-center items-center">
                <img src={dataURL} alt="signature" className="max-w-full h-auto" />
             </div>
        ) : (
            <Card className="relative w-full aspect-[2/1] border-dashed">
                <SignatureCanvas
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{ className: 'w-full h-full rounded-lg' }}
                />
            </Card>
        )}
      <div className={cn("flex justify-end gap-2 mt-2", isSigned && "hidden")}>
        <Button variant="ghost" size="sm" onClick={clear}>
            <Eraser className="mr-2 h-4 w-4" />
            Clear
        </Button>
        <Button variant="outline" size="sm" onClick={sign}>
            <Pen className="mr-2 h-4 w-4" />
            Sign
        </Button>
      </div>
    </div>
  );
}
