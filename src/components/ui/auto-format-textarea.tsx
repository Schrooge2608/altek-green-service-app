'use client';

import React, { useState } from 'react';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatText } from '@/ai/flows/format-text-flow';

interface AutoFormatTextareaProps extends Omit<TextareaProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

export function AutoFormatTextarea({ value, onChange, ...props }: AutoFormatTextareaProps) {
  const { toast } = useToast();
  const [isFormatting, setIsFormatting] = useState(false);

  const handleAutoFormat = async () => {
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
      if (result.formattedText) {
        onChange(result.formattedText);
        toast({
          title: 'Text Formatted',
          description: 'The notes have been rewritten by AI.',
        });
      }
    } catch (error: any) {
      console.error('AI formatting failed:', error);
      toast({
        variant: 'destructive',
        title: 'Formatting Failed',
        description: error.message || 'An unexpected error occurred.',
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
          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
          onClick={handleAutoFormat}
          disabled={isFormatting || props.disabled}
          title="Auto-format with AI"
        >
          {isFormatting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="sr-only">Auto-format with AI</span>
        </Button>
      </div>
    </div>
  );
}
