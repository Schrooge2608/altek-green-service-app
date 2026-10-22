'use client';

import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useFirebase, useUser } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Save,
  Trash2,
  KeyRound,
  PenTool,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import type { User } from '@/lib/types';

interface SignaturePinCardProps {
  targetUserId: string;
  userData?: User | null;
  canEdit?: boolean;
}

export function SignaturePinCard({ targetUserId, userData, canEdit = true }: SignaturePinCardProps) {
  const { user } = useUser();
  const { firestore, firebaseApp } = useFirebase();
  const { toast } = useToast();

  const sigCanvasRef = useRef<SignatureCanvas>(null);

  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [draftSignature, setDraftSignature] = useState<string | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [isSavingSig, setIsSavingSig] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);

  useEffect(() => {
    if (userData) {
      const existingSig = userData.signatureUrl || null;
      setSavedSignature(existingSig);
      setIsDrawingMode(!existingSig);
      setPin(userData.signingPin || '');
    }
  }, [userData]);

  const handleStrokeEnd = () => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) return;
    try {
      const dataUrl = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png', 1.0);
      setDraftSignature(dataUrl);
    } catch {
      const dataUrl = sigCanvasRef.current.toDataURL('image/png');
      setDraftSignature(dataUrl);
    }
  };

  const handleClearPad = () => {
    sigCanvasRef.current?.clear();
    setDraftSignature(null);
  };

  const handleSaveSignature = async () => {
    if (!targetUserId || !firestore || !firebaseApp) return;

    let sigToSave = draftSignature;
    if (!sigToSave && sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      try {
        sigToSave = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png', 1.0);
      } catch {
        sigToSave = sigCanvasRef.current.toDataURL('image/png');
      }
    }

    if (!sigToSave) {
      toast({
        variant: 'destructive',
        title: 'No Signature Drawn',
        description: 'Please sign inside the signature box before saving.',
      });
      return;
    }

    setIsSavingSig(true);
    try {
      let finalUrl = sigToSave;

      // Upload to Firebase Storage if the signed-in user is updating their own profile;
      // fall back to storing the data URL directly in Firestore if Storage rules block admin cross-user upload.
      if (sigToSave.startsWith('data:image') && user?.uid === targetUserId) {
        try {
          const storage = getStorage(firebaseApp);
          const storageRef = ref(storage, `users/${targetUserId}/signature.png`);
          await uploadString(storageRef, sigToSave, 'data_url');
          finalUrl = await getDownloadURL(storageRef);
        } catch (storageErr) {
          console.warn('Storage upload fallback to data URL:', storageErr);
          finalUrl = sigToSave;
        }
      }

      const userRef = doc(firestore, 'users', targetUserId);
      const updatePayload: Record<string, any> = {
        signatureUrl: finalUrl,
        updatedAt: new Date().toISOString(),
      };

      // If user also typed a valid 4-digit PIN that hasn't been saved yet, save it together
      if (pin && /^\d{4}$/.test(pin) && pin !== userData?.signingPin) {
        updatePayload.signingPin = pin;
      }

      await updateDoc(userRef, updatePayload);
      setSavedSignature(finalUrl);
      setDraftSignature(null);
      setIsDrawingMode(false);

      toast({
        title: 'Digital Signature Saved',
        description: updatePayload.signingPin
          ? 'Signature and 4-digit PIN have been saved.'
          : 'Your signature is now linked to your 4-digit PIN for IPR consumables and document sign-offs.',
      });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Failed to Save Signature',
        description: error.message || 'Could not save signature.',
      });
    } finally {
      setIsSavingSig(false);
    }
  };

  const handleSavePin = async () => {
    if (!targetUserId || !firestore) return;
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast({
        variant: 'destructive',
        title: 'Invalid PIN',
        description: 'Signing PIN must be exactly 4 digits (e.g. 1234).',
      });
      return;
    }

    setIsSavingPin(true);
    try {
      const userRef = doc(firestore, 'users', targetUserId);
      await updateDoc(userRef, {
        signingPin: pin,
        updatedAt: new Date().toISOString(),
      });
      toast({
        title: '4-Digit PIN Saved',
        description: 'Your security PIN has been updated for IPR consumables and document sign-off.',
      });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Failed to Save PIN',
        description: error.message || 'There was a problem saving the PIN.',
      });
    } finally {
      setIsSavingPin(false);
    }
  };

  return (
    <Card className="border-emerald-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-emerald-50/50 border-b border-emerald-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
              <PenTool className="h-5 w-5 text-emerald-600" />
              Digital Signature &amp; 4-Digit Signing PIN
            </CardTitle>
            <CardDescription>
              Used when accepting IPR consumables and signing off site documents with your 4-digit PIN.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {savedSignature ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Signature Saved
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 gap-1">
                <AlertCircle className="h-3 w-3" /> No Signature
              </Badge>
            )}
            {userData?.signingPin ? (
              <Badge className="bg-blue-600 hover:bg-blue-600 gap-1">
                <KeyRound className="h-3 w-3" /> PIN Set
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 gap-1">
                <AlertCircle className="h-3 w-3" /> No PIN
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 grid gap-8 md:grid-cols-2">
        {/* LEFT: ON-SCREEN SIGNATURE PAD */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <PenTool className="h-4 w-4 text-emerald-600" />
              1. On-Screen Signature
            </Label>
            {savedSignature && !isDrawingMode && canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraftSignature(null);
                  setIsDrawingMode(true);
                }}
                className="h-7 text-xs gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Re-sign
              </Button>
            )}
          </div>

          {savedSignature && !isDrawingMode ? (
            <div className="border-2 border-emerald-200 rounded-xl bg-white p-4 flex flex-col items-center justify-center min-h-[160px] space-y-2">
              <img
                src={savedSignature}
                alt="Saved Digital Signature"
                className="max-h-28 w-auto object-contain"
              />
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Active signature on file
              </span>
            </div>
          ) : canEdit ? (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden relative h-[160px] shadow-inner touch-none">
                <SignatureCanvas
                  ref={sigCanvasRef}
                  penColor="black"
                  minWidth={1.2}
                  maxWidth={2.2}
                  velocityFilterWeight={0.2}
                  onEnd={handleStrokeEnd}
                  canvasProps={{
                    className: 'w-full h-full cursor-crosshair touch-none',
                    style: { width: '100%', height: '100%', touchAction: 'none' },
                  }}
                />
                <div className="absolute bottom-2 left-3 pointer-events-none text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Sign inside box above
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleSaveSignature}
                  disabled={isSavingSig}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSavingSig ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isSavingSig ? 'Saving...' : 'Save Signature'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearPad}
                  disabled={isSavingSig}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Clear
                </Button>
                {savedSignature && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setDraftSignature(null);
                      setIsDrawingMode(false);
                    }}
                    disabled={isSavingSig}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="border rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-400 italic min-h-[160px] flex items-center justify-center">
              No digital signature saved yet.
            </div>
          )}
        </div>

        {/* RIGHT: 4-DIGIT SIGNING PIN */}
        <div className="space-y-4 flex flex-col justify-between bg-slate-50 p-5 rounded-xl border border-slate-200">
          <div className="space-y-3">
            <Label htmlFor="signing-pin-input" className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <KeyRound className="h-4 w-4 text-blue-600" />
              2. 4-Digit Security PIN
            </Label>
            <p className="text-xs text-slate-500 leading-relaxed">
              Enter a 4-digit numeric code. When consumables are issued on an IPR (or when signing site documents), entering this 4-digit PIN will automatically stamp your saved signature.
            </p>

            {canEdit ? (
              <div className="relative max-w-[240px] pt-1">
                <Input
                  id="signing-pin-input"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="text-2xl tracking-[0.5em] text-center font-mono font-black h-12 bg-white pr-10 border-slate-300"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-700"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-600">
                {userData?.signingPin ? '•••• (PIN is configured)' : 'No PIN configured'}
              </p>
            )}
          </div>

          {canEdit && (
            <Button
              type="button"
              onClick={handleSavePin}
              disabled={isSavingPin || pin.length !== 4}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isSavingPin ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSavingPin ? 'Saving PIN...' : 'Save 4-Digit PIN'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
