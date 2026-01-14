
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, updateDocumentNonBlocking, useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Equipment } from '@/lib/types';
import { Loader2, Pencil, Upload } from 'lucide-react';
import React, { useState } from 'react';

const formSchema = z.object({
  image: z.instanceof(File).refine(file => file.size > 0, 'Please select an image file.'),
});

interface EditImageFormProps {
    equipment: Equipment;
}

export function EditImageForm({ equipment }: EditImageFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { firebaseApp } = useFirebase();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const fileRef = form.register("image");

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsUploading(true);
    const storage = getStorage(firebaseApp);
    const imageFile = values.image;
    const storagePath = `equipment_images/${equipment.id}/${imageFile.name}`;
    const storageRef = ref(storage, storagePath);
    
    try {
        // Upload file to Firebase Storage
        const snapshot = await uploadBytes(storageRef, imageFile);
        
        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Update Firestore document
        const equipmentRef = doc(firestore, 'equipment', equipment.id);
        updateDocumentNonBlocking(equipmentRef, { imageUrl: downloadURL });

        toast({
            title: 'Image Updated',
            description: `The image for ${equipment.name} has been successfully updated.`,
        });
        setIsOpen(false);
        form.reset();
    } catch (error: any) {
        console.error("Image upload failed:", error);
        toast({
            variant: "destructive",
            title: "Upload Failed",
            description: error.message || "Could not upload the image.",
        });
    } finally {
        setIsUploading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
            <Button variant="outline" size="sm">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
                <DialogTitle>Update Equipment Image</DialogTitle>
                <DialogDescription>
                    Select a new image for {equipment.name}. This will replace the current image.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid gap-4 py-4">
                        <FormField
                            control={form.control}
                            name="image"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>New Image File</FormLabel>
                                <FormControl>
                                <Input type="file" accept="image/png, image/jpeg, image/gif" {...fileRef} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isUploading}>
                            {isUploading ? (
                                <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                                </>
                            ) : (
                                <>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload Image
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
  );
}
