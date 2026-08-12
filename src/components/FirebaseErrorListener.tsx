'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

/**
 * @fileOverview A background component that listens for global Firebase errors
 * and triggers user-friendly toast notifications.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: any) => {
      console.error("Global Permission Error:", error);
      toast({
        variant: 'destructive',
        title: "Access Restricted",
        description: "You do not have the required site permissions for this action. Please contact your supervisor.",
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => errorEmitter.off('permission-error', handlePermissionError);
  }, [toast]);

  return null;
}
