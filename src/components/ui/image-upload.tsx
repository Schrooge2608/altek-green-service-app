'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button } from './button';
import { Trash, Plus, Loader2, CloudOff, FileText } from 'lucide-react';
import Image from 'next/image';
import { useFirebase } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { queueImageForSync } from '@/lib/offline-storage';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { isPdfUrl, getFileNameFromUrl } from '@/lib/utils';

interface ImageUploadProps {
  value: string[];
  onChange: (value: string[]) => void;
  onRemove: (url: string) => void;
  disabled?: boolean;
  relatedId?: string; // Optional: ID of the Firestore document (e.g. breakdown ID)
}

export function ImageUpload({ value, onChange, onRemove, disabled, relatedId }: ImageUploadProps) {
  const { firebaseApp, firestore } = useFirebase();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !firebaseApp) return;

    setLoading(true);
    const newUrls = [...value];

    try {
      for (const file of Array.from(files)) {
        if (!navigator.onLine && relatedId) {
          // OFFLINE MODE: Store in IndexedDB
          await queueImageForSync({
            id: `${relatedId}_${Date.now()}`,
            blob: file,
            fileName: file.name,
            field: 'images',
            createdAt: Date.now()
          });
          toast({ title: "Offline: Queued", description: "Document saved locally and will sync when online." });
        } else if (navigator.onLine) {
          // ONLINE MODE: Direct Upload
          const storage = getStorage(firebaseApp);
          const storagePath = `breakdown_reports/uploads/${Date.now()}_${file.name}`;
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          newUrls.push(url);
        }
      }
      if (newUrls.length > value.length) {
        onChange(newUrls);
        toast({ title: "Upload Successful", description: "Attachments added successfully." });
      }
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Upload Failed", description: error.message });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {value.map((url) => {
          const isDocument = isPdfUrl(url);
          const fileName = getFileNameFromUrl(url);

          return (
            <div key={url} className="relative aspect-video rounded-md overflow-hidden border group bg-slate-100">
              {isDocument ? (
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex flex-col items-center justify-center h-full bg-slate-50 p-2 text-center hover:bg-slate-100 transition-colors"
                >
                  <FileText className="h-8 w-8 text-red-500 mb-1" />
                  <span className="text-[9px] font-black text-slate-600 truncate w-full px-2">
                    {fileName}
                  </span>
                  <span className="text-[7px] uppercase font-bold text-slate-400">View PDF</span>
                </a>
              ) : (
                <a href={url} target="_blank" rel="noopener noreferrer" className="block relative w-full h-full">
                  <Image src={url} alt="Job attachment" fill className="object-cover" />
                </a>
              )}
              
              {!disabled && (
                <Button
                  type="button"
                  onClick={() => onRemove(url)}
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
        
        {!disabled && (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="aspect-video rounded-md border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors bg-white text-slate-400 min-h-[100px]"
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : isOffline ? (
              <CloudOff className="h-6 w-6 mb-1 text-amber-500" />
            ) : (
              <Plus className="h-6 w-6 mb-1" />
            )}
            <span className="text-[10px] font-black uppercase tracking-wider">
              {loading ? 'Processing...' : isOffline ? 'Queue File' : 'Add Image/PDF'}
            </span>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,application/pdf" 
              multiple 
              onChange={handleUpload} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
