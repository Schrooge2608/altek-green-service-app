
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
import { Loader2, Pencil, Upload, Camera, Video, AlertTriangle, RefreshCw, Check } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import Image from 'next/image';

const formSchema = z.object({
  image: z
    .custom<FileList>()
    .refine((files) => files?.length === 1, 'An image is required.')
    .transform((files) => files[0]),
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
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const fileRef = form.register("image");

  useEffect(() => {
    if (isOpen) {
        // Reset state when dialog opens
        setHasCameraPermission(null);
        setCapturedImage(null);
    } else {
        // Stop camera stream when dialog closes
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    }
  }, [isOpen]);

  const getCameraPermission = async () => {
    if (hasCameraPermission !== null) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings.',
      });
    }
  };

  const uploadBlob = async (blob: Blob, fileName: string) => {
    setIsUploading(true);
    const storage = getStorage(firebaseApp);
    const storagePath = `equipment_images/${equipment.id}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    try {
        const snapshot = await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(snapshot.ref);

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
        toast({ variant: "destructive", title: "Upload Failed", description: error.message || "Could not upload the image." });
    } finally {
        setIsUploading(false);
    }
  };

  async function onFileSubmit(values: z.infer<typeof formSchema>) {
    await uploadBlob(values.image, values.image.name);
  }

  const handleTakePicture = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        setCapturedImage(canvas.toDataURL('image/jpeg'));
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleAcceptAndUpload = async () => {
    if (capturedImage) {
        const blob = await (await fetch(capturedImage)).blob();
        await uploadBlob(blob, `capture-${Date.now()}.jpg`);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
            <Button variant="outline" size="sm">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle>Update Equipment Image</DialogTitle>
                <DialogDescription>
                    Choose to upload a file or use your device's camera to update the image for {equipment.name}.
                </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="upload">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4" /> Upload File</TabsTrigger>
                    <TabsTrigger value="camera" onClick={getCameraPermission}><Video className="mr-2 h-4 w-4" /> Use Camera</TabsTrigger>
                </TabsList>
                <TabsContent value="upload">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onFileSubmit)} className="space-y-4 pt-4">
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
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isUploading}>
                                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    {isUploading ? 'Uploading...' : 'Upload Image'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </TabsContent>
                <TabsContent value="camera">
                    <div className="space-y-4 pt-4">
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="overflow-hidden rounded-md border aspect-video relative bg-muted flex items-center justify-center">
                           {capturedImage ? (
                                <Image src={capturedImage} alt="Captured photo" layout="fill" objectFit="contain" />
                            ) : (
                                <>
                                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                                    {hasCameraPermission === false && (
                                        <Alert variant="destructive" className="absolute w-auto m-4">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>Camera Access Denied</AlertTitle>
                                            <AlertDescription>Enable permissions to use this feature.</AlertDescription>
                                        </Alert>
                                    )}
                                </>
                           )}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                            {capturedImage ? (
                                <>
                                    <Button variant="outline" onClick={handleRetake} disabled={isUploading}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Retake
                                    </Button>
                                    <Button onClick={handleAcceptAndUpload} disabled={isUploading}>
                                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                        {isUploading ? 'Uploading...' : 'Accept & Upload'}
                                    </Button>
                                </>
                            ) : (
                                <Button onClick={handleTakePicture} disabled={isUploading || hasCameraPermission !== true}>
                                    <Camera className="mr-2 h-4 w-4" />
                                    Take Picture
                                </Button>
                            )}
                        </DialogFooter>
                    </div>
                </TabsContent>
            </Tabs>
        </DialogContent>
    </Dialog>
  );
}
