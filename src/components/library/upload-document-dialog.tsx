'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/use-user';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FileUp, Loader2 } from 'lucide-react';
import { LibraryDocument } from '@/lib/types';

interface UploadDocumentDialogProps {
  categorySlug: string;
  categoryName: string;
  onSuccess?: () => void;
}

export function UploadDocumentDialog({ categorySlug, categoryName, onSuccess }: UploadDocumentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<'Procedure' | 'Drawing'>('Procedure');
  const [file, setFile] = useState<File | null>(null);

  const { firestore, storage } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ variant: 'destructive', title: 'File required', description: 'Please select a file to upload.' });
      return;
    }
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title required', description: 'Please enter a title for the document.' });
      return;
    }

    setIsUploading(true);
    try {
      // 1. Upload file to Storage
      const storageRef = ref(storage, `library_documents/${categorySlug}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(snapshot.ref);

      // 2. Save metadata to Firestore
      const docData: Omit<LibraryDocument, 'id'> = {
        category: categorySlug,
        type: docType,
        title: title.trim(),
        fileUrl,
        fileName: file.name,
        uploadedBy: user?.displayName || user?.email || 'Unknown User',
        uploadedAt: serverTimestamp(),
      };

      await addDoc(collection(firestore, 'library_documents'), docData);

      toast({ title: 'Success', description: 'Document uploaded successfully.' });
      setIsOpen(false);
      setTitle('');
      setFile(null);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message || 'Could not upload document.' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <FileUp className="h-4 w-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleUpload}>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a new procedure, manual, or drawing for {categoryName}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Document Title</Label>
              <Input
                id="title"
                placeholder="e.g., Siemens SINAMICS V20 Manual"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Document Type</Label>
              <Select value={docType} onValueChange={(val: 'Procedure' | 'Drawing') => setDocType(val)}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Procedure">Procedure / Manual</SelectItem>
                  <SelectItem value="Drawing">Drawing / Schematic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isUploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
