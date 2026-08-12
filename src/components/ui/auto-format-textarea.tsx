'use client';

import React, { useState, useEffect } from 'react';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, CloudOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatText } from '@/ai/flows/format-text-flow';
import { cn } from '@/lib/utils';

interface AutoFormatTextareaProps extends Omit<TextareaProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * @fileOverview A textarea component with built-in AI formatting.
 * Hardened for offline resilience with network detection.
 */
export function AutoFormatTextarea({ value, onChange, ...props }: AutoFormatTextareaProps) {
  const { toast } = useToast();
  const [isFormatting, setIsFormatting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Monitor network status to protect cloud-only AI features
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAutoFormat = async () => {
    if (!isOnline) {
      toast({
        variant: 'destructive',
        title: 'Offline',
        description: 'AI formatting is unavailable while offline.',
      });
      return;
    }

    if (!value || value.trim().length < 10) {
      toast({
        variant: 'destructive',
        title: 'Not enough text',
        description: 'Please provide more detailed notes to format.',
      });
      return;
    }

    setIsFormatting(true);
    try {
      const result = await formatText({ text: value });
      
      if (result && result.success && result.formattedText) {
        onChange(result.formattedText);
        toast({
          title: 'Text Formatted',
          description: 'The notes have been rewritten by AI.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Formatting Failed',
          description: result?.error || 'AI service unavailable. Please try again later.',
        });
      }
    } catch (error: any) {
      console.error('AI formatting failed:', error);
      toast({
        variant: 'destructive',
        title: 'Formatting Failed',
        description: 'A network error occurred. Please try again when online.',
      });
    } finally {
      setIsFormatting(false);
    }
  };

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
        className="pr-12 min-h-[120px]"
      />
      <div className="absolute bottom-2 right-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 transition-colors",
            !isOnline ? "text-slate-300" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
          )}
          onClick={handleAutoFormat}
          disabled={isFormatting || props.disabled || !isOnline}
          title={isOnline ? "Auto-format with AI" : "AI Unavailable Offline"}
        >
          {isFormatting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !isOnline ? (
            <CloudOff className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="sr-only">Auto-format with AI</span>
        </Button>
      </div>
    </div>
  );
}
