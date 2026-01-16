'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define SpeechRecognition type for broader browser support
const SpeechRecognition =
  (typeof window !== 'undefined' && (window.SpeechRecognition || (window as any).webkitSpeechRecognition)) || undefined;

interface VoiceTextareaProps extends Omit<TextareaProps, 'onChange' | 'value'> {
    value: string;
    onChange: (value: string) => void;
}

export function VoiceTextarea({ value, onChange, ...props }: VoiceTextareaProps) {
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null); // Use 'any' for SpeechRecognition instance

  useEffect(() => {
    if (!SpeechRecognition) {
      // Feature is not supported, do not initialize.
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      
      if (finalTranscript) {
          onChange(value ? `${value} ${finalTranscript.trim()}` : finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      // Ignore common, non-critical errors like no speech detected, user aborting, or network issues.
      if (['no-speech', 'aborted', 'network'].includes(event.error)) {
        setIsListening(false);
        return;
      }
      
      console.error('Speech recognition error', event.error);
      toast({
        variant: 'destructive',
        title: 'Voice Recognition Error',
        description: `An error occurred: ${event.error}. Please check microphone permissions.`,
      });
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    }

    recognitionRef.current = recognition;
    
    // Cleanup function to stop recognition when the component unmounts
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [value, onChange, toast]);
  
  const handleToggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
        toast({
            variant: 'destructive',
            title: 'Unsupported Feature',
            description: 'Your browser does not support voice recognition.',
        });
        return;
    }
    
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        recognition.start();
        setIsListening(true);
      } catch (error) {
        console.error("Could not start recognition: ", error);
        toast({
            variant: 'destructive',
            title: 'Could not start voice recognition',
            description: 'Please ensure your microphone is enabled and permissions are granted.',
        });
      }
    }
  };
  
  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
        className="pr-12"
      />
      {SpeechRecognition && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
            onClick={handleToggleListening}
          >
            {isListening ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
            <span className="sr-only">{isListening ? 'Stop listening' : 'Start listening'}</span>
          </Button>
      )}
    </div>
  );
}
