'use client';

import React, { useState } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Printer, MessageCircle, Mail } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { GeneratedReport } from '@/lib/types';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useToast } from '@/hooks/use-toast';

export default function ViewReportPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const [isSharing, setIsSharing] = useState(false);
    
    const id = typeof params.id === 'string' ? params.id : '';
    const firestore = useFirestore();

    const reportRef = useMemoFirebase(() => doc(firestore, 'generated_reports', id), [firestore, id]);
    const { data: report, isLoading } = useDoc<GeneratedReport>(reportRef);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading report...
            </div>
        );
    }

    if (!report) {
        notFound();
        return null;
    }
    
    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        if (timestamp.seconds) {
            return format(new Date(timestamp.seconds * 1000), 'yyyy-MM-dd HH:mm');
        }
        return 'Invalid Date';
    }

    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareText = `Report generated for period ${report.startDate} to ${report.endDate}\n${shareUrl}`;

    const handleSharePDF = async (method: 'whatsapp' | 'email') => {
        try {
            const element = document.getElementById('report-content');
            if (!element) return;
            
            setIsSharing(true);
            toast({ title: 'Generating PDF...', description: 'Please wait while we prepare the document.' });
            
            const originalClass = element.className;
            element.className = originalClass + " print-mode-for-canvas";
            
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
            element.className = originalClass; // restore
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            let heightLeft = pdfHeight;
            let position = 0;
            
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;
            
            while (heightLeft > 0) {
              position -= pageHeight;
              pdf.addPage();
              pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
              heightLeft -= pageHeight;
            }
            
            const pdfBlob = pdf.output('blob');
            const fileName = `Report_${report.startDate}_to_${report.endDate}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
               await navigator.share({
                 files: [file],
                 title: `Report ${report.startDate} to ${report.endDate}`,
                 text: `Please find the attached Report for the period ${report.startDate} to ${report.endDate}.`
               });
            } else {
               pdf.save(fileName);
               toast({ 
                 title: 'PDF Downloaded', 
                 description: 'Direct file sharing is unsupported on this browser. The PDF was downloaded—opening app so you can attach it.' 
               });
               
               const text = encodeURIComponent(`Please find the downloaded Report attached.`);
               if (method === 'whatsapp') {
                   window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
               } else {
                   window.open(`mailto:?subject=Report generated for period ${report.startDate} to ${report.endDate}&body=${text}`, '_blank');
               }
            }
          } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Share failed', description: 'Failed to generate and share the PDF.' });
          } finally {
            setIsSharing(false);
          }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8">
            <style>{'@media print { @page { size: portrait; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden { display: none !important; } }'}</style>
            <div className="flex flex-wrap justify-end mb-4 gap-2 print:hidden">
                 <Button onClick={() => router.back()} variant="outline" disabled={isSharing}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to History
                </Button>
                
                <Button 
                  variant="outline" 
                  className="gap-2"
                  disabled={isSharing}
                  onClick={() => handleSharePDF('whatsapp')}
                >
                  {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4 text-green-600" />}
                  WhatsApp
                </Button>

                <Button 
                  variant="outline" 
                  className="gap-2"
                  disabled={isSharing}
                  onClick={() => handleSharePDF('email')}
                >
                  {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 text-blue-600" />}
                  Email
                </Button>

                <Button 
                  variant="default" 
                  className="gap-2"
                  disabled={isSharing}
                  onClick={(e) => {
                    e.preventDefault(); 
                    window.print();
                  }}
                >
                  <Printer className="h-4 w-4" />
                  Save as PDF / Print
                </Button>
            </div>
            <Card className="shadow-lg border-0 print:shadow-none bg-transparent">
                <CardHeader className="print:hidden bg-white border rounded-t-xl mb-4">
                    <CardTitle>Report generated for period {report.startDate} to {report.endDate}</CardTitle>
                    <CardDescription>
                        Generated by {report.generatedByUserName} on {formatDate(report.generatedAt)}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div id="report-content" className="bg-white p-8 md:p-12 border shadow-sm print:shadow-none print:border-none min-h-[29.7cm] mx-auto max-w-[21cm]">
                        <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-8">
                            <div className="w-1/3">
                            <img src="/Altek-Logo.jpeg" alt="Altek Green Logo" className="h-20 w-auto object-contain" />
                            </div>
                            <div className="text-right text-[10px] text-slate-600 space-y-1 font-sans">
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">ALTEK GREEN (PTY) LTD</h2>
                            <div className="space-y-0">
                                <p>9A Langwa Street, Strijdom Park</p>
                                <p>Randburg, 2194</p>
                            </div>
                            </div>
                        </div>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            className="space-y-6 font-sans text-slate-800 leading-relaxed"
                            components={{
                            h1: () => null,
                            h2: ({ node, ...props }) => (
                                <h2 className="text-lg font-bold text-slate-900 mt-8 mb-4 border-b border-slate-300 pb-1 break-after-avoid" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                                <h3 className="text-base font-bold text-slate-800 mt-6 mb-2 underline decoration-slate-400 underline-offset-4" {...props} />
                            ),
                            ul: ({ node, ...props }) => (
                                <ul className="list-disc list-outside pl-6 space-y-2 mb-4 text-slate-700 text-sm" {...props} />
                            ),
                            p: ({ node, ...props }) => (
                                <p className="mb-4 text-justify text-xs md:text-sm" {...props} />
                            ),
                            table: ({ node, ...props }) => (
                                <div className="overflow-x-auto my-6 border rounded-lg">
                                <table className="min-w-full border-collapse text-[10px] md:text-xs" {...props} />
                                </div>
                            ),
                            thead: ({ node, ...props }) => <thead className="bg-slate-100" {...props} />,
                            th: ({ node, ...props }) => (
                                <th className="border-b border-slate-300 px-4 py-2 text-left font-bold text-slate-900 uppercase tracking-wider" {...props} />
                            ),
                            td: ({ node, ...props }) => (
                                <td className="border-b border-slate-200 px-4 py-2 text-slate-700 align-top" {...props} />
                            ),
                            }}
                        >
                            {report.reportText}
                        </ReactMarkdown>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
