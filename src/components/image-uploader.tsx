'use client';

import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Plus, X, Loader2, Camera } from 'lucide-react';
import Image from 'next/image';

interface ImageUploaderProps {
  onImagesChange: (files: File[]) => void;
  title?: string;
}

/**
 * @fileOverview Core Image Upload component for maintenance and safety documentation.
 * Handles local preview and multi-file selection.
 */
export function ImageUploader({ onImagesChange, title }: ImageUploaderProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);
    onImagesChange(newFiles);

    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    
    setSelectedFiles(newFiles);
    setPreviews(newPreviews);
    onImagesChange(newFiles);
  };

  return (
    <div className="space-y-4">
      {title && <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">{title}</h4>}
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {previews.map((url, idx) => (
          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border bg-slate-100">
            <Image src={url} alt="Preview" fill className="object-cover" />
            <button
              type="button"
              onClick={() => removeImage(idx)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors text-slate-400"
        >
          <Camera className="h-8 w-8 mb-2" />
          <span className="text-[10px] font-bold uppercase">Add Photo</span>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            multiple 
            onChange={handleFileChange} 
          />
        </div>
      </div>
    </div>
  );
}
