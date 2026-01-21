'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, Camera, Video, AlertTriangle, RefreshCw, X, FileText } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

interface ImageUploaderProps {
  onImagesChange: (files: File[]) => void;
  title: string;
}

export function ImageUploader({ onImagesChange, title }: ImageUploaderProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; name: string; type: string }[]>([]);
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateParent = (newFiles: File[]) => {
      setFiles(newFiles);
      onImagesChange(newFiles);
      
      // Revoke old object URLs to prevent memory leaks
      previews.forEach(p => URL.revokeObjectURL(p.url));

      const newPreviews = newFiles.map(file => ({
          url: URL.createObjectURL(file),
          name: file.name,
          type: file.type,
      }));

      setPreviews(newPreviews);
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const newFiles = Array.from(e.target.files);

    const processFile = (file: File): Promise<File> => {
      return new Promise((resolve) => {
        // Don't compress PDFs or GIFs
        if (!file.type.startsWith('image/') || file.type === 'image/gif') {
          return resolve(file);
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          if (!event.target?.result) return resolve(file); // Fallback

          const img = new window.Image();
          img.src = event.target.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1920; // Max width for resized image

            if (img.width <= MAX_WIDTH) {
              return resolve(file); // Don't upscale small images
            }
            
            const scale = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(file); // Fallback

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              if (!blob) return resolve(file); // Fallback

              const newFileName = file.name.substring(0, file.name.lastIndexOf('.')) + '.jpg';
              const compressedFile = new File([blob], newFileName, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }, 'image/jpeg', 0.8); // 80% quality
          };
          img.onerror = () => resolve(file); // Fallback if image fails to load
        };
        reader.onerror = () => resolve(file); // Fallback if reader fails
      });
    };

    const processedFiles = await Promise.all(newFiles.map(processFile));
    updateParent([...files, ...processedFiles]);
  };


  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    updateParent(newFiles);
  };

  const stopCameraStream = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const getCameraPermission = useCallback(async () => {
    if (isCameraActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      setIsCameraActive(true);
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
  }, [isCameraActive, toast]);

  useEffect(() => {
    return () => {
      previews.forEach(p => URL.revokeObjectURL(p.url));
      stopCameraStream();
    }
  }, [previews, stopCameraStream]);
  
  const handleTakePicture = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
        stopCameraStream();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    getCameraPermission();
  };

  const handleAcceptAndAdd = async () => {
    if (capturedImage) {
        const blob = await (await fetch(capturedImage)).blob();
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        updateParent([...files, file]);
        setCapturedImage(null);
    }
  };

  const handleTabsChange = (value: string) => {
    if (value === 'camera') {
        getCameraPermission();
    } else {
        stopCameraStream();
    }
  };


  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs defaultValue="upload" onValueChange={handleTabsChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4" /> Upload</TabsTrigger>
            <TabsTrigger value="camera"><Camera className="mr-2 h-4 w-4" /> Camera</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <div className="space-y-4 pt-4">
              <Label htmlFor={`file-upload-${title}`}>Add images or PDFs by uploading files</Label>
              <Input id={`file-upload-${title}`} ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple onChange={handleFileChange} />
            </div>
          </TabsContent>
          <TabsContent value="camera">
            <div className="space-y-4 pt-4">
              <canvas ref={canvasRef} className="hidden" />
              <div className="overflow-hidden rounded-md border aspect-video relative bg-muted flex items-center justify-center">
                {capturedImage ? (
                  <Image src={capturedImage} alt="Captured" layout="fill" objectFit="contain" />
                ) : (
                  <>
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                    {hasCameraPermission === false && (
                      <Alert variant="destructive" className="absolute w-auto m-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Camera Denied</AlertTitle>
                      </Alert>
                    )}
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2">
                {capturedImage ? (
                  <>
                    <Button variant="outline" onClick={handleRetake}>Retake</Button>
                    <Button onClick={handleAcceptAndAdd}>Add to Gallery</Button>
                  </>
                ) : (
                  <Button onClick={handleTakePicture} disabled={!isCameraActive}>Take Picture</Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        {previews.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2 text-sm text-muted-foreground">File Previews</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {previews.map((preview, index) => (
                <div key={index} className="relative group aspect-square">
                  {preview.type.startsWith('image/') ? (
                     <Image src={preview.url} alt={`Preview ${index}`} layout="fill" className="rounded-md object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-muted rounded-md p-2 text-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground mt-2 break-all">{preview.name}</span>
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
