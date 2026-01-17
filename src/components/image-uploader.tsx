
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, Camera, Video, AlertTriangle, RefreshCw, X } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

interface ImageUploaderProps {
  onImagesChange: (files: File[]) => void;
  title: string;
}

export function ImageUploader({ onImagesChange, title }: ImageUploaderProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateParent = (newFiles: File[]) => {
      setFiles(newFiles);
      onImagesChange(newFiles);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      // Revoke old object URLs to prevent memory leaks
      previews.forEach(url => URL.revokeObjectURL(url));
      setPreviews(newPreviews);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      updateParent([...files, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
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
      previews.forEach(url => URL.revokeObjectURL(url));
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
              <Label htmlFor={`file-upload-${title}`}>Add images by uploading files</Label>
              <Input id={`file-upload-${title}`} ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} />
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
            <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Image Previews</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {previews.map((src, index) => (
                <div key={index} className="relative group aspect-square">
                  <Image src={src} alt={`Preview ${index}`} layout="fill" className="rounded-md object-cover" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(index)}
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
