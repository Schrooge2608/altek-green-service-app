'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  useUser, 
  useFirebase, 
  useDoc, 
  useMemoFirebase,
  updateDocumentNonBlocking
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { updatePassword, getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Save, 
  User as UserIcon, 
  Mail, 
  Phone, 
  Shield, 
  Camera,
  Upload,
  BadgeCheck,
  AlertCircle,
  Video,
  Check,
  RefreshCw,
  X,
  Plus,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import type { User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';

export default function ProfileSettingsPage() {
  const { user } = useUser();
  const { firestore, firebaseApp } = useFirebase();
  const { toast } = useToast();

  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData, isLoading } = useDoc<User>(userRef);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // Camera States
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
  });
  
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name || '',
        email: userData.email || '',
        phoneNumber: userData.phoneNumber || '',
      });
    }
  }, [userData]);

  const stopCameraStream = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const getCameraPermission = useCallback(async () => {
    try {
      // Primary target: Rear/Environment camera with native continuous focus
      const constraints = { 
        video: { 
          facingMode: "environment", 
          advanced: [{ focusMode: "continuous" }] 
        } 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints as any);
      
      // Secondary attempt: force focus on the track if possible
      try {
        const track = stream.getVideoTracks()[0];
        if (track && track.applyConstraints) {
          await track.applyConstraints({
            advanced: [{ focusMode: "continuous" }]
          } as any);
        }
      } catch (e) {
        console.warn("Autofocus API not supported on this device/browser:", e);
      }

      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      // Fallback: Try any available video device
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackError) {
        console.error('Error accessing camera:', fallbackError);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to take a selfie.',
        });
      }
    }
  }, [toast]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userRef) return;

    setIsSaving(true);
    try {
      updateDocumentNonBlocking(userRef, {
        ...formData,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: "Profile Updated", description: "Your changes have been saved." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Update Failed", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) return;
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({ variant: 'destructive', title: "Password Mismatch", description: "Passwords do not match." });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(currentUser, passwords.newPassword);
      toast({ title: "Password Updated", description: "Your security credentials have been refreshed." });
      setPasswords({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error(error);
      toast({ 
        variant: 'destructive', 
        title: "Update Failed", 
        description: error.code === 'auth/requires-recent-login' 
          ? "For security, you must log out and back in before changing your password." 
          : error.message 
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const uploadAvatar = async (blob: Blob) => {
    if (!user || !userRef) return;
    setIsUploading(true);
    try {
      const storage = getStorage(firebaseApp);
      const storagePath = `users/${user.uid}/profile_pictures/${Date.now()}_avatar.jpg`;
      const storageRef = ref(storage, storagePath);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      updateDocumentNonBlocking(userRef, { avatarUrl: downloadURL });
      toast({ title: "Photo Updated", description: "Your profile picture has been changed." });
      setCapturedImage(null);
      stopCameraStream();
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Upload Failed", description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAvatar(file);
    }
  };

  const handleTakePicture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
        stopCameraStream();
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    getCameraPermission();
  };

  const handleAcceptAndUpload = async () => {
    if (capturedImage) {
      const blob = await (await fetch(capturedImage)).blob();
      await uploadAvatar(blob);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 pb-20">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Account Settings</h1>
        <p className="text-muted-foreground">Manage your personal profile and digital identity.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Photo */}
        <div className="lg:col-span-1 space-y-8">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-sm uppercase tracking-widest text-slate-500 font-bold">Profile Photo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6 pt-6">
              <div className="relative">
                <Avatar className="h-32 w-32 border-4 border-white shadow-xl">
                  <AvatarImage src={userData?.avatarUrl || ''} />
                  <AvatarFallback className="bg-slate-100 text-slate-400 text-3xl font-bold">
                    {userData?.name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                    <Loader2 className="animate-spin text-white h-8 w-8" />
                  </div>
                )}
              </div>

              <Tabs defaultValue="upload" className="w-full" onValueChange={(val) => { if (val !== 'camera') stopCameraStream(); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload" className="gap-2 text-xs">
                    <Upload className="h-3 w-3" /> Upload
                  </TabsTrigger>
                  <TabsTrigger value="camera" className="gap-2 text-xs" onClick={getCameraPermission}>
                    <Camera className="h-3 w-3" /> Selfie
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload" className="pt-4">
                  <Label 
                    htmlFor="avatar-upload" 
                    className="flex items-center justify-center gap-2 w-full h-10 border rounded-md cursor-pointer hover:bg-slate-50 transition-colors text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" /> Select File
                  </Label>
                  <Input 
                    id="avatar-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileChange}
                    disabled={isUploading}
                  />
                </TabsContent>

                <TabsContent value="camera" className="pt-4 space-y-4">
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="relative aspect-square rounded-lg border overflow-hidden bg-slate-100 flex items-center justify-center">
                    {capturedImage ? (
                      <Image src={capturedImage} alt="Selfie" fill className="object-cover" />
                    ) : (
                      <>
                        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        {hasCameraPermission === false && (
                          <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
                            <p className="text-xs text-red-500 font-medium">Camera access required.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {capturedImage ? (
                      <>
                        <Button variant="outline" size="sm" className="flex-1" onClick={handleRetake} disabled={isUploading}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Retake
                        </Button>
                        <Button size="sm" className="flex-1" onClick={handleAcceptAndUpload} disabled={isUploading}>
                          {isUploading ? <Loader2 className="animate-spin h-3 w-3" /> : <Check className="h-3 w-3 mr-1" />}
                          Save
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" className="w-full" onClick={handleTakePicture} disabled={isUploading || !hasCameraPermission}>
                        <Camera className="h-3 w-3 mr-1" /> Capture
                      </Button>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Forms */}
        <div className="lg:col-span-2 space-y-8">
          {/* General Information */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <CardDescription>Update your contact details and display name.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-slate-400" /> Full Name
                    </Label>
                    <Input 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter your name..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" /> Official Email
                    </Label>
                    <Input 
                      type="email"
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      placeholder="name@altekgreen.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" /> Contact Number
                    </Label>
                    <Input 
                      value={formData.phoneNumber} 
                      onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                      placeholder="+27..."
                    />
                  </div>

                  <Separator className="my-2" />

                  <div className="space-y-2 relative">
                    <Label className="flex items-center gap-2 text-slate-500">
                      <Shield className="h-4 w-4" /> Position (Read-Only)
                    </Label>
                    <div className="relative">
                      <Input 
                        value={userData?.role || 'N/A'} 
                        disabled 
                        className="bg-slate-100 border-slate-200 text-slate-500 font-bold pr-10"
                      />
                      <BadgeCheck className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex items-center gap-2 mt-2 px-1">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <p className="text-[11px] text-amber-700 font-medium italic">
                        To change your position, please contact your administrator.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 min-w-[140px]">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security & Password */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-lg">Security & Credentials</CardTitle>
              <CardDescription>Update your account password. For security, characters are hidden by default.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleUpdatePassword} className="space-y-6">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-slate-400" /> New Password
                    </Label>
                    <div className="relative">
                      <Input 
                        type={showNewPassword ? "text" : "password"} 
                        value={passwords.newPassword}
                        onChange={e => setPasswords({...passwords, newPassword: e.target.value})}
                        placeholder="••••••••"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-slate-400"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-slate-400" /> Confirm New Password
                    </Label>
                    <Input 
                      type={showNewPassword ? "text" : "password"} 
                      value={passwords.confirmPassword}
                      onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button type="submit" variant="destructive" disabled={isUpdatingPassword || !passwords.newPassword} className="min-w-[140px]">
                    {isUpdatingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
