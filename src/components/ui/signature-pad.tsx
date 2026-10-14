"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { CheckCircle2, RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onSave?: (signatureDataUrl: string) => void | Promise<void>;
  // Compatibility with profile settings page
  onSign?: (signatureDataUrl: string) => void | Promise<void>;
  onClear?: () => void;
  value?: string | null;
  width?: number | string;
  height?: number | string;
}

export function SignaturePad({ onSave, onSign, onClear, value, height }: SignaturePadProps) {
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

  const containerHeight = height ? (typeof height === 'number' ? `${height}px` : height) : '120px';

  return (
    <div ref={containerRef} className="w-full relative group touch-none">
      <div 
        style={{ height: containerHeight }} 
        className="w-full border border-slate-200 bg-white rounded-md overflow-hidden relative shadow-sm touch-none"
      >
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          minWidth={1.5}
          maxWidth={3}
          velocityFilterWeight={0.2}
          onBegin={() => { isDirty.current = true; }}
          onEnd={() => { 
            isDirty.current = true; 
            handleSave(); 
          }}
          canvasProps={{ 
            className: 'w-full h-full cursor-crosshair touch-none',
            style: { width: '100%', height: '100%', touchAction: 'none' }
          }}
        />
        
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            sigCanvas.current?.clear();
            isDirty.current = false;
            if (onClear) onClear();
          }}
          className="absolute top-1 right-1 text-slate-400 hover:text-red-500 bg-white/90 hover:bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-xs z-20 flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
          title="Clear Signature"
        >
          <RotateCcw className="w-3 h-3" />
          <span className="text-[9px] font-bold">Clear</span>
        </button>

        {showSaved && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg animate-in fade-in zoom-in duration-300 pointer-events-none z-30">
            <CheckCircle2 className="h-3 w-3" />
            SAVED
          </div>
        )}
      </div>
    </div>
  );
}
