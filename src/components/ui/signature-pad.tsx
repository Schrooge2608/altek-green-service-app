"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { CheckCircle2 } from 'lucide-react';

interface SignaturePadProps {
  onSave?: (signatureDataUrl: string) => void | Promise<void>;
  // Compatibility with profile settings page
  onSign?: (signatureDataUrl: string) => void | Promise<void>;
  onClear?: () => void;
  value?: string | null;
}

export function SignaturePad({ onSave, onSign, onClear, value }: SignaturePadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const isDirty = useRef(false);
  const [showSaved, setShowSaved] = useState(false);

  // Load existing signature on mount or value change
  useEffect(() => {
    if (value && sigCanvas.current) {
      sigCanvas.current.fromDataURL(value);
    }
  }, [value]);

  const handleSave = useCallback(async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty() || !isDirty.current) return;

    // HIGH-DENSITY EXPORT: Capture high-quality PNG for professional printing
    const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png', 1.0);
    
    if (dataUrl) {
      try {
        console.log("SignaturePad: Initiating save to database...");
        
        // Execute callbacks and wait for them to resolve (especially database writes)
        if (onSave) await Promise.resolve(onSave(dataUrl));
        if (onSign) await Promise.resolve(onSign(dataUrl));
        
        isDirty.current = false;
        
        // VISUAL CONFIRMATION: Only show after successful execution
        setShowSaved(true);
        console.log("SignaturePad: Save confirmed by server.");
        
        setTimeout(() => setShowSaved(false), 2000);
      } catch (err) {
        console.error("SignaturePad: Persistence Failure!", err);
        // Do not show the saved badge on failure
      }
    }
  }, [onSave, onSign]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // If we clicked outside the container and have unsaved changes, trigger save
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isDirty.current) {
          handleSave();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [handleSave]);

  return (
    <div ref={containerRef} className="w-full relative group touch-none">
      <div className="h-[120px] w-full border border-slate-200 bg-white rounded-md overflow-hidden relative shadow-sm touch-none">
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          // 1px thin stroke for precision printing
          minWidth={1}
          maxWidth={1}
          velocityFilterWeight={0.1}
          onBegin={() => { isDirty.current = true; }}
          canvasProps={{ 
            className: 'w-full h-full cursor-crosshair touch-none',
            style: { width: '100%', height: '100%', touchAction: 'none' }
          }}
        />
        
        {showSaved && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg animate-in fade-in zoom-in duration-300 pointer-events-none">
            <CheckCircle2 className="h-3 w-3" />
            SAVED
          </div>
        )}
      </div>
    </div>
  );
}
