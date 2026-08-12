'use client';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react'; 

interface WhatsAppShareProps { 
  text: string; 
  label?: string; 
}

export function WhatsAppShare({ text, label = 'Share Update' }: WhatsAppShareProps) { 
  const handleShare = () => { 
    const encodedText = encodeURIComponent(text); 
    window.open(`https://wa.me/?text=${encodedText}`, '_blank'); 
  };

  return (
    <Button onClick={handleShare} className="bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold border-none" size="sm">
      <MessageCircle className="mr-2 h-4 w-4" />
      {label}
    </Button>
  ); 
}
