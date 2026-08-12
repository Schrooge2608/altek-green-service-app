'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox } from '@/components/ui/combobox';
import { 
  Loader2, 
  Save, 
  Printer, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ShieldCheck,
  FileText,
  Paperclip,
  ScanLine,
  Camera,
  AlertTriangle
} from 'lucide-react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { useUser, useFirebase, useDoc, useMemoFirebase, deleteDocumentNonBlocking, useCollection } from '@/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from '@/components/ui/signature-pad';
import { AltekLogo } from '@/components/altek-logo';
import { cn } from '@/lib/utils';
import type { FieldServiceReport, FSRPart, FSRPersonnel, User } from '@/lib/types';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { extractFsrData } from '@/ai/flows/extract-fsr-flow';

/**
 * @fileOverview High-fidelity digital replica of the AG-FSR-001 paper form.
 * Optimized for A4 aspect ratio and high-density technical data entry.
 */

const SectionHeader = ({ number, title }: { number: string; title: string }) => (
  <div className="bg-[#1b5e20] text-white px-2 py-1 flex items-center gap-3 mb-0 border-x border-t border-black">
    <span className="font-black text-sm">{number}</span>
    <h2 className="font-bold text-[11px] uppercase tracking-tight">{title}</h2>
  </div>
);

const DenseLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <Label className={cn("text-[8px] font-black uppercase text-slate-500 leading-none mb-1 block", className)}>
    {children}
  </Label>
);

export default function FieldServiceReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();
  const reportId = params.id as string;

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isFinishing, setIsFinishing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const reportRef = useMemoFirebase(() => (reportId ? doc(firestore, 'field_service_reports', reportId) : null), [firestore, reportId]);
  const { data: report, isLoading: reportLoading } = useDoc<FieldServiceReport>(reportRef);

  const { user: authUser } = useUser();
  const { firestore: db } = useFirebase();
  const { data: userData } = useDoc<User>(
    useMemoFirebase(() => authUser ? doc(db, 'users', authUser.uid) : null, [db, authUser])
  );
  
  const equipmentQuery = useMemoFirebase(() => query(collection(db, 'equipment'), orderBy('name', 'asc')), [db]);
  const { data: equipmentList } = useCollection<any>(equipmentQuery);

  const form = useForm<FieldServiceReport>({
    defaultValues: {
      fsrReference: '',
      date: '',
      customer: '',
      site: '',
      poNumber: '',
      serviceEntryNo: '',
      contactPerson: '',
      contactNumber: '',
      city: '',
      email: '',
      jobCategory: 'Planned',
      assetName: '',
      tagNo: '',
      serialNo: '',
      location: '',
      oem: '',
      model: '',
      year: '',
      rating: '',
      timeCallOut: '',
      timeArrival: '',
      timeStart: '',
      timeEnd: '',
      timeDeparture: '',
      ntHours: 0,
      otHours: 0,
      dtHours: 0,
      travelKmTo: 0,
      travelKmReturn: 0,
      totalHours: 0,
      totalKm: 0,
      customerFault: '',
      techFindings: '',
      rca: '',
      correctiveActions: '',
      recommendations: '',
      techName: '',
      techEmpNo: '',
      techSignature: null,
      clientName: '',
      clientDesignation: '',
      clientSignature: null,
      status: 'Draft',
      parts: [],
      personnel: [],
      images: [],
      hse: {
        ppe: 'NA',
        riskAssessment: 'NA',
        permit: 'NA',
        incidents: 'NA',
        areaCleaned: 'NA',
        environmentalImpact: 'NA',
        observations: ''
      }
    }
  });

  const { fields: partFields, append: appendPart, remove: removePart } = useFieldArray({ control: form.control, name: "parts" });
  const { fields: personFields, append: appendPerson, remove: removePerson } = useFieldArray({ control: form.control, name: "personnel" });

  const watchedNT = useWatch({ control: form.control, name: 'ntHours' });
  const watchedArea = useWatch({ control: form.control, name: 'area' });

  const equipmentOptions = useMemo(() => {
    if (!equipmentList) return [];
    return Array.from(new Set(
        equipmentList
            .filter(eq => !watchedArea || eq.plant === watchedArea || eq.area === watchedArea)
            .map(eq => {
                const prefix = eq.mcc || eq.location || eq.division || '';
                return prefix ? `${prefix} - ${eq.name}` : eq.name;
            })
    )).map(name => ({ value: name, label: name }));
  }, [equipmentList, watchedArea]);
  const watchedOT = useWatch({ control: form.control, name: 'otHours' });
  const watchedDT = useWatch({ control: form.control, name: 'dtHours' });
  const watchedKmTo = useWatch({ control: form.control, name: 'travelKmTo' });
  const watchedKmRet = useWatch({ control: form.control, name: 'travelKmReturn' });

  useEffect(() => {
    const totalH = (Number(watchedNT) || 0) + (Number(watchedOT) || 0) + (Number(watchedDT) || 0);
    form.setValue('totalHours', totalH);
  }, [watchedNT, watchedOT, watchedDT, form]);

  useEffect(() => {
    const totalK = (Number(watchedKmTo) || 0) + (Number(watchedKmRet) || 0);
    form.setValue('totalKm', totalK);
  }, [watchedKmTo, watchedKmRet, form]);

  useEffect(() => {
    if (report) {
      form.reset({
        ...report,
        ntHours: report.ntHours ?? 0,
        otHours: report.otHours ?? 0,
        dtHours: report.dtHours ?? 0,
        travelKmTo: report.travelKmTo ?? 0,
        travelKmReturn: report.travelKmReturn ?? 0,
        totalHours: report.totalHours ?? 0,
        totalKm: report.totalKm ?? 0,
        parts: report.parts ?? [],
        personnel: report.personnel ?? [],
        images: report.images ?? []
      });
    }
  }, [report, form]);

  const isFinalized = report?.status === 'Finalized';
  const isAdmin = userData?.role && ['Admin', 'Superadmin'].includes(userData.role);
  const isManagerOrAdmin = userData?.role && [
    'Admin', 'Superadmin', 'Corporate Manager', 'Corporate Manager (Beta)', 'Services Manager', 'Services Manager (Beta)', 'Client Manager'
  ].includes(userData.role);

  const handleAutosave = useCallback(async (overrides: any = {}) => {
    if (!reportId || !firestore || isFinalized) return;
    setSaveStatus('saving');
    try {
      const data = form.getValues();
      const payload = {
        ...data,
        ...overrides,
        updatedAt: serverTimestamp()
      };

      const sanitized = Object.fromEntries(
        Object.entries(payload).filter(([_, v]) => 
          v !== undefined && (typeof v !== 'number' || !Number.isNaN(v))
        )
      );

      await updateDoc(doc(firestore, 'field_service_reports', reportId), sanitized);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 3000);
    } catch (e) {
      setSaveStatus('idle');
    }
  }, [firestore, reportId, isFinalized, form]);

  const handlePaperScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUri = reader.result as string;
        const result = await extractFsrData({ documentDataUri: dataUri });
        
        if (result.error === "DOCUMENT_UNCLEAR") {
          toast({ 
            variant: 'destructive', 
            title: "Scan Unclear", 
            description: "The document is illegible. Please ensure a high-quality scan and upload again." 
          });
          return;
        }

        // Merge extracted data into current form
        form.reset({
          ...form.getValues(),
          ...result,
          parts: [...(form.getValues('parts') || []), ...(result.parts || [])],
          personnel: [...(form.getValues('personnel') || []), ...(result.personnel || [])]
        });

        toast({ title: "Extraction Complete", description: "FSR fields have been auto-populated from the PDF scan." });
        handleAutosave();
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Scan Failed", description: error.message });
    } finally {
      setIsScanning(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleManualSave = async () => {
    await handleAutosave();
    toast({ title: "Saved", description: "Report has been successfully saved." });
    router.push('/reports/field-service-report');
  }

  const handleFinalize = async () => {
    if (!confirm("Finalizing will lock this report for audit. Proceed?")) return;
    setIsFinishing(true);
    try {
      await handleAutosave({ status: 'Finalized' });
      toast({ title: "Report Finalized", description: "This FSR is now locked and archived." });
      router.push('/reports/field-service-report');
    } finally {
      setIsFinishing(false);
    }
  };

  const handleDeleteReport = () => {
    if (!reportRef) return;
    deleteDocumentNonBlocking(reportRef);
    toast({ title: "Report Deleted", description: "The Field Service Report has been permanently removed." });
    router.push('/reports/field-service-report');
  };

  if (reportLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="min-h-screen bg-slate-100/50 p-4 md:p-8 pb-32">
      <style>{'@media print { @page { size: portrait; } }'}</style>
      <header className="max-w-[21cm] mx-auto flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/reports/field-service-report')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono">FSR EDIT MODE</h1>
            {saveStatus === 'saving' && <span className="text-[10px] text-muted-foreground animate-pulse">Syncing...</span>}
            {saveStatus === 'saved' && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!isFinalized && (
            <div className="relative">
              <Button 
                variant="outline" 
                className="border-primary text-primary hover:bg-primary/5 gap-2"
                disabled={isScanning}
                onClick={() => document.getElementById('paper-fsr-upload')?.click()}
              >
                {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                {isScanning ? 'Extracting FSR data...' : 'Scan PDF Copy'}
              </Button>
              <input 
                id="paper-fsr-upload" 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                onChange={handlePaperScan} 
              />
            </div>
          )}
          
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" /> Delete FSR
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete this Field Service Report from the database. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteReport} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    Confirm Permanent Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print PDF</Button>
          {!isFinalized && (
            <Button variant="outline" onClick={handleManualSave} disabled={saveStatus === 'saving'} className="border-slate-300">
               <Save className="h-4 w-4 mr-2" /> Save FSR
            </Button>
          )}
          {!isFinalized && isManagerOrAdmin && (
            <Button onClick={handleFinalize} disabled={isFinishing} className="bg-emerald-600 hover:bg-emerald-700">
              {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Finalize & Lock
            </Button>
          )}
        </div>
      </header>

      <div className="overflow-x-auto flex justify-center">
        <div className="bg-white shadow-2xl min-h-[29.7cm] w-[21cm] p-8 border border-slate-300 flex flex-col print:shadow-none print:border-none print:p-0">
          
          <Form {...form}>
            <form className="space-y-0 text-slate-900" style={{ fontFamily: 'Arial, sans-serif' }}>
              <fieldset disabled={isFinalized} className="space-y-0">
                
                {/* 00: HEADER */}
                <div className="grid grid-cols-12 border-2 border-black mb-0">
                  <div className="col-span-4 p-4 border-r border-black flex items-center justify-center">
                    <AltekLogo className="h-16 w-auto" />
                  </div>
                  <div className="col-span-5 p-4 border-r border-black flex flex-col items-center justify-center text-center relative">
                    <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">Field Service Report</h1>
                    <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-widest italic">Technical Documentation • Customer Sign-Off Required</p>
                    <FormField control={form.control} name="area" render={({ field }) => (
                        <div className="flex items-center gap-4 mt-2 justify-center">
                            <div className="flex items-center gap-1 font-bold text-[10px] cursor-pointer" onClick={() => {field.onChange('Mining'); handleAutosave();}}>
                                <div className="w-3 h-3 border border-black flex items-center justify-center">{field.value === 'Mining' && '✓'}</div>
                                MINING
                            </div>
                            <div className="flex items-center gap-1 font-bold text-[10px] cursor-pointer" onClick={() => {field.onChange('Smelter'); handleAutosave();}}>
                                <div className="w-3 h-3 border border-black flex items-center justify-center">{field.value === 'Smelter' && '✓'}</div>
                                SMELTER
                            </div>
                        </div>
                    )} />
                  </div>
                  <div className="col-span-3 p-2 flex flex-col justify-between bg-slate-50/50">
                    <div className="space-y-1 text-right flex flex-col items-end">
                      <DenseLabel>FSR Reference</DenseLabel>
                      <FormField control={form.control} name="fsrReference" render={({ field }) => (
                         <div className="flex items-center text-xs font-black text-red-600 font-mono w-24 justify-end">
                           <span className="mr-1">#</span>
                           <Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-5 text-xs font-black text-red-600 font-mono border-none p-0 bg-transparent focus-visible:ring-0 text-right w-full" placeholder="FSR-XXXX" />
                         </div>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 gap-1 border-t border-black/10 pt-1">
                      <FormField control={form.control} name="date" render={({ field }) => (
                        <div className="flex justify-between items-center">
                          <DenseLabel className="mb-0">Date:</DenseLabel>
                          <Input type="date" {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-5 text-[10px] border-none p-0 text-right bg-transparent focus-visible:ring-0 font-bold" />
                        </div>
                      )} />
                    </div>
                  </div>
                </div>

                {/* 01: CUSTOMER & JOB INFORMATION */}
                <SectionHeader number="01" title="Customer & Job Information" />
                <div className="border-2 border-black p-2 grid grid-cols-12 gap-x-2 gap-y-2 mb-0">
                  <FormField control={form.control} name="customer" render={({ field }) => (<div className="col-span-4"><DenseLabel>Maintenance Controller / Shift Supervisor Name</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-7 text-[10px] border-black/20" /></div>)} />
                  <FormField control={form.control} name="site" render={({ field }) => (<div className="col-span-4"><DenseLabel>Site / Plant Name</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-7 text-[10px] border-black/20" /></div>)} />
                  <FormField control={form.control} name="poNumber" render={({ field }) => (<div className="col-span-4"><DenseLabel>PO / Contract No</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-7 text-[10px] border-black/20 font-mono" /></div>)} />
                  
                  <FormField control={form.control} name="contactPerson" render={({ field }) => (<div className="col-span-6"><DenseLabel>Contact Person</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-7 text-[10px] border-black/20" /></div>)} />
                  <FormField control={form.control} name="contactNumber" render={({ field }) => (<div className="col-span-6"><DenseLabel>Contact Number</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-7 text-[10px] border-black/20" /></div>)} />
                </div>

                {/* 02: EQUIPMENT DETAILS */}
                <SectionHeader number="02" title="Equipment Details" />
                <div className="border-2 border-black p-2 grid grid-cols-12 gap-x-2 gap-y-2 mb-0">
                  <FormField control={form.control} name="assetName" render={({ field }) => (
                    <div className="col-span-4 flex flex-col justify-end">
                      <DenseLabel>Equipment / Asset Name</DenseLabel>
                      <div className="print-hidden pt-1">
                        <Combobox 
                          options={equipmentOptions} 
                          value={field.value || ''} 
                          onChange={(val) => {
                            field.onChange(val);
                            const eq = equipmentList?.find(e => {
                                const prefix = e.mcc || e.location || e.division || '';
                                const label = prefix ? `${prefix} - ${e.name}` : e.name;
                                return label === val;
                            });
                            if (eq) {
                                if (eq.oem) form.setValue('oem', eq.oem);
                                if (eq.model) form.setValue('model', eq.model);
                                if (eq.serialNo) form.setValue('serialNo', eq.serialNo);
                                if (eq.rating || eq.motorPower) form.setValue('rating', String(eq.rating || (eq.motorPower ? `${eq.motorPower}kW` : '')));
                            }
                            handleAutosave();
                          }} 
                          creatable={true} 
                          placeholder="" 
                          className="h-7 text-[10px] border-black/20" 
                        />
                      </div>
                      <div className="hidden print:flex h-7 border border-black/20 text-[10px] px-3 items-center">{field.value}</div>
                    </div>
                  )} />
                  <FormField control={form.control} name="oem" render={({ field }) => (<div className="col-span-4"><DenseLabel>Manufacturer / OEM</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-7 text-[10px] border-black/20" /></div>)} />
                  <FormField control={form.control} name="model" render={({ field }) => (<div className="col-span-4"><DenseLabel>Model</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-7 text-[10px] border-black/20" /></div>)} />
                  
                  <FormField control={form.control} name="serialNo" render={({ field }) => (<div className="col-span-6"><DenseLabel>Serial No</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-7 text-[10px] border-black/20" /></div>)} />
                  <FormField control={form.control} name="rating" render={({ field }) => (<div className="col-span-6"><DenseLabel>Rating / Capacity</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-7 text-[10px] border-black/20" /></div>)} />
                </div>

                {/* 03: CALL-OUT, TIME TRACKING & TRAVEL */}
                <SectionHeader number="03" title="Call-Out, Time Tracking & Travel" />
                <div className="border-2 border-black mb-0 overflow-hidden">
                  <div className="grid grid-cols-6 divide-x divide-black border-b border-black bg-slate-50">
                    {['timeCallOut', 'timeArrival', 'timeStart', 'timeEnd', 'timeDeparture'].map((t, idx) => (
                      <FormField key={t} control={form.control} name={t as any} render={({ field }) => (
                        <div className="p-1 flex flex-col items-center">
                          <DenseLabel className="text-[7px]">{t.replace('time', '').replace(/([A-Z])/g, ' $1').trim()}</DenseLabel>
                          <Input type="time" {...field} value={field.value ?? ''} onChange={(e) => { field.onChange(e.target.value); handleAutosave(); }} className="h-6 text-[10px] border-none text-center bg-transparent focus-visible:ring-0" />
                        </div>
                      )} />
                    ))}
                    <div className="p-1 flex flex-col items-center bg-slate-200">
                      <DenseLabel className="text-[7px]">Total Duty</DenseLabel>
                      <p className="text-[10px] font-black">{form.getValues('totalHours') ?? 0}H</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 divide-x divide-black h-10">
                    <FormField control={form.control} name="ntHours" render={({ field }) => (<div className="bg-emerald-50 p-1 flex flex-col items-center"><DenseLabel>NT Hrs</DenseLabel><Input type="number" {...field} value={field.value ?? 0} onChange={e => { field.onChange(parseFloat(e.target.value)); handleAutosave(); }} className="h-5 text-center border-none text-[10px] bg-transparent font-bold" /></div>)} />
                    <FormField control={form.control} name="otHours" render={({ field }) => (<div className="bg-amber-50 p-1 flex flex-col items-center"><DenseLabel>OT (1.5x)</DenseLabel><Input type="number" {...field} value={field.value ?? 0} onChange={e => { field.onChange(parseFloat(e.target.value)); handleAutosave(); }} className="h-5 text-center border-none text-[10px] bg-transparent font-bold" /></div>)} />
                    <FormField control={form.control} name="dtHours" render={({ field }) => (<div className="bg-red-50 p-1 flex flex-col items-center"><DenseLabel>DT (2x)</DenseLabel><Input type="number" {...field} value={field.value ?? 0} onChange={e => { field.onChange(parseFloat(e.target.value)); handleAutosave(); }} className="h-5 text-center border-none text-[10px] bg-transparent font-bold" /></div>)} />
                    <div className="p-1 flex flex-col items-center border-r-2 border-black"><DenseLabel>Total Duty</DenseLabel><p className="text-[10px] font-black">{form.getValues('totalHours') ?? 0}</p></div>
                    <FormField control={form.control} name="travelKmTo" render={({ field }) => (<div className="p-1 flex flex-col items-center"><DenseLabel>KM (To)</DenseLabel><Input type="number" {...field} value={field.value ?? 0} onChange={e => { field.onChange(parseFloat(e.target.value)); handleAutosave(); }} className="h-5 text-center border-none text-[10px]" /></div>)} />
                    <FormField control={form.control} name="travelKmReturn" render={({ field }) => (<div className="p-1 flex flex-col items-center"><DenseLabel>KM (Ret)</DenseLabel><Input type="number" {...field} value={field.value ?? 0} onChange={e => { field.onChange(parseFloat(e.target.value)); handleAutosave(); }} className="h-5 text-center border-none text-[10px]" /></div>)} />
                    <div className="p-1 flex flex-col items-center bg-blue-50/50"><DenseLabel>Total KM</DenseLabel><p className="text-[10px] font-black">{form.getValues('totalKm') ?? 0}</p></div>
                  </div>
                </div>

                {/* 04 & 05: FAULT DESCRIPTION & WORK PERFORMED */}
                <div className="grid grid-cols-2 mb-0">
                  <div className="border-l-2 border-b-2 border-r border-black flex flex-col">
                    <SectionHeader number="04" title="Fault Description & Root Cause" />
                    <FormField control={form.control} name="customerFault" render={({ field }) => (<div className="p-2 border-b border-black"><DenseLabel>Customer Reported Fault</DenseLabel><Textarea {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="min-h-[40px] text-[10px] border-none p-0 resize-none focus-visible:ring-0" /></div>)} />
                    <FormField control={form.control} name="techFindings" render={({ field }) => (<div className="p-2 border-b border-black bg-slate-50/30"><DenseLabel>Findings & Observations</DenseLabel><Textarea {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="min-h-[80px] text-[10px] border-none p-0 resize-none bg-transparent focus-visible:ring-0" /></div>)} />
                    <FormField control={form.control} name="rca" render={({ field }) => (<div className="p-2"><DenseLabel>Root Cause Analysis</DenseLabel><Textarea {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="min-h-[40px] text-[10px] border-none p-0 resize-none focus-visible:ring-0" /></div>)} />
                  </div>
                  <div className="border-r-2 border-b-2 border-black flex flex-col">
                    <SectionHeader number="05" title="Work Performed / Corrective Action" />
                    <FormField control={form.control} name="correctiveActions" render={({ field }) => (<div className="p-2 flex-1 border-b border-black"><DenseLabel>Corrective Actions & Repairs</DenseLabel><Textarea {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="min-h-[140px] text-[10px] border-none p-0 resize-none focus-visible:ring-0" /></div>)} />
                    <FormField control={form.control} name="recommendations" render={({ field }) => (<div className="p-2 h-20"><DenseLabel>Recommendations</DenseLabel><Textarea {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="min-h-[40px] text-[10px] border-none p-0 resize-none focus-visible:ring-0" /></div>)} />
                  </div>
                </div>

                {/* 06: PARTS & MATERIALS */}
                <SectionHeader number="06" title="Parts & Materials Used" />
                <div className="border-2 border-black mb-0 overflow-hidden">
                  <Table className="border-none">
                    <TableHeader className="bg-[#263238] border-none">
                      <TableRow className="h-6 border-none hover:bg-transparent">
                        <TableHead className="text-[8px] font-black text-white p-1 text-center w-8">#</TableHead>
                        <TableHead className="text-[8px] font-black text-white p-1">Part No</TableHead>
                        <TableHead className="text-[8px] font-black text-white p-1">Description</TableHead>
                        <TableHead className="text-[8px] font-black text-white p-1 w-12 text-center">Qty</TableHead>
                        <TableHead className="text-[8px] font-black text-white p-1 w-12">Unit</TableHead>
                        <TableHead className="text-[8px] font-black text-white p-1">Supplied By</TableHead>
                        <TableHead className="text-[8px] font-black text-white p-1 print:hidden w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partFields.map((field, idx) => (
                        <TableRow key={field.id} className="h-7 border-t border-black/10 hover:bg-transparent">
                          <TableCell className="p-1 text-[9px] text-center font-bold">{idx + 1}</TableCell>
                          <TableCell className="p-0 border-x border-black/10"><Input className="h-7 border-none text-[9px] rounded-none focus-visible:ring-0 px-1" {...form.register(`parts.${idx}.partNo`)} onBlur={() => handleAutosave()} /></TableCell>
                          <TableCell className="p-0 border-r border-black/10"><Input className="h-7 border-none text-[9px] rounded-none focus-visible:ring-0 px-1" {...form.register(`parts.${idx}.description`)} onBlur={() => handleAutosave()} /></TableCell>
                          <TableCell className="p-0 border-r border-black/10"><Input type="number" className="h-7 border-none text-[9px] rounded-none focus-visible:ring-0 px-1 text-center" {...form.register(`parts.${idx}.qty`)} onBlur={() => handleAutosave()} /></TableCell>
                          <TableCell className="p-0 border-r border-black/10"><Input className="h-7 border-none text-[9px] rounded-none focus-visible:ring-0 px-1" {...form.register(`parts.${idx}.unit`)} onBlur={() => handleAutosave()} /></TableCell>
                          <TableCell className="p-0 border-r border-black/10"><Input className="h-7 border-none text-[9px] rounded-none focus-visible:ring-0 px-1" {...form.register(`parts.${idx}.suppliedBy`)} onBlur={() => handleAutosave()} /></TableCell>
                          <TableCell className="p-0 text-center print:hidden"><Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => { removePart(idx); handleAutosave(); }}><Trash2 className="h-3 w-3" /></Button></TableCell>
                        </TableRow>
                      ))}
                      {!isFinalized && (
                        <TableRow className="h-8 border-t border-black print:hidden">
                          <TableCell colSpan={7} className="p-0 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                            <Button type="button" variant="ghost" size="sm" onClick={() => appendPart({ partNo: '', description: '', qty: 1, unit: 'EA', suppliedBy: 'Altek', remarks: '' })} className="w-full h-8 text-[9px] font-bold"><Plus className="h-3 w-3 mr-1" /> Add Part</Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* 07 & 08: PERSONNEL & HSE */}
                <div className="grid grid-cols-2 mb-0">
                  <div className="border-l-2 border-b-2 border-r border-black flex flex-col">
                    <SectionHeader number="07" title="Personnel on Site" />
                    <Table className="border-none">
                      <TableHeader className="bg-[#263238]">
                        <TableRow className="h-6 border-none hover:bg-transparent">
                          <TableHead className="text-[8px] font-black text-white p-1 text-center w-8">#</TableHead>
                          <TableHead className="text-[8px] font-black text-white p-1">Full Name</TableHead>
                          <TableHead className="text-[8px] font-black text-white p-1 w-20">Role</TableHead>
                          <TableHead className="text-[8px] font-black text-white p-1 w-10 text-center">Hrs</TableHead>
                          <TableHead className="text-[8px] font-black text-white p-1 print:hidden w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {personFields.map((field, idx) => (
                          <TableRow key={field.id} className="h-7 border-t border-black/10 hover:bg-transparent">
                            <TableCell className="p-1 text-[9px] text-center">{idx + 1}</TableCell>
                            <TableCell className="p-0 border-x border-black/10"><Input className="h-7 border-none text-[9px] rounded-none focus-visible:ring-0 px-1" {...form.register(`personnel.${idx}.name`)} onBlur={() => handleAutosave()} /></TableCell>
                            <TableCell className="p-0 border-r border-black/10"><Input className="h-7 border-none text-[9px] rounded-none focus-visible:ring-0 px-1" {...form.register(`personnel.${idx}.role`)} onBlur={() => handleAutosave()} /></TableCell>
                            <TableCell className="p-0 border-r border-black/10"><Input type="number" className="h-7 border-none text-[9px] rounded-none focus-visible:ring-0 px-1 text-center" {...form.register(`personnel.${idx}.hrs`)} onBlur={() => handleAutosave()} /></TableCell>
                            <TableCell className="p-0 text-center print:hidden"><Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => { removePerson(idx); handleAutosave(); }}><Trash2 className="h-3 w-3" /></Button></TableCell>
                          </TableRow>
                        ))}
                        {!isFinalized && (
                          <TableRow className="h-8 border-t border-black print:hidden">
                            <TableCell colSpan={5} className="p-0 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                              <Button type="button" variant="ghost" size="sm" onClick={() => appendPerson({ name: '', role: '', hrs: 0, ot: 0 })} className="w-full h-8 text-[9px] font-bold"><Plus className="h-3 w-3 mr-1" /> Add Member</Button>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="border-r-2 border-b-2 border-black flex flex-col bg-slate-50/30">
                    <SectionHeader number="08" title="HSE Compliance" />
                    <div className="p-2 space-y-1">
                      {[
                        { name: 'hse.ppe', label: 'PPE worn throughout job?' },
                        { name: 'hse.riskAssessment', label: 'Risk Assessment / JBA completed?' },
                        { name: 'hse.permit', label: 'Permit to Work obtained?' },
                        { name: 'hse.incidents', label: 'Incident occurred?' },
                        { name: 'hse.areaCleaned', label: 'Area made safe?' },
                        { name: 'hse.environmentalImpact', label: 'Env impact addressed?' },
                      ].map(check => (
                        <FormField key={check.name} control={form.control} name={check.name as any} render={({ field }) => (
                          <div className="flex justify-between items-center border-b border-black/5 pb-1">
                            <Label className="text-[8px] font-bold text-slate-600">{check.label}</Label>
                            <RadioGroup onValueChange={(val) => { field.onChange(val); handleAutosave(); }} value={field.value ?? 'NA'} className="flex gap-2">
                              <div className="flex items-center space-x-1"><RadioGroupItem value="Yes" className="h-3 w-3" /><span className="text-[7px] font-bold">Y</span></div>
                              <div className="flex items-center space-x-1"><RadioGroupItem value="No" className="h-3 w-3" /><span className="text-[7px] font-bold">N</span></div>
                              <div className="flex items-center space-x-1"><RadioGroupItem value="NA" className="h-3 w-3" /><span className="text-[7px] font-bold opacity-30">NA</span></div>
                            </RadioGroup>
                          </div>
                        )} />
                      ))}
                      <FormField control={form.control} name="hse.observations" render={({ field }) => (
                        <div className="mt-2">
                          <DenseLabel className="text-[7px]">HSE Observations</DenseLabel>
                          <Textarea {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="min-h-[30px] text-[9px] border-none p-0 resize-none bg-transparent focus-visible:ring-0" placeholder="Type observations..." />
                        </div>
                      )} />
                    </div>
                  </div>
                </div>

                {/* ATTACHMENTS SECTION */}
                <SectionHeader number="+" title="Attachments & Documentation" />
                <div className="border-x-2 border-b-2 border-black p-4 bg-white">
                  <FormField
                    control={form.control}
                    name="images"
                    render={({ field }) => (
                      <div className="space-y-4">
                        <ImageUpload 
                          value={field.value || []} 
                          onChange={(urls) => { field.onChange(urls); handleAutosave({ images: urls }); }} 
                          onRemove={(url) => { 
                            const updated = (field.value || []).filter(u => u !== url); 
                            field.onChange(updated); 
                            handleAutosave({ images: updated }); 
                          }} 
                          disabled={isFinalized}
                          relatedId={reportId}
                        />
                        <div className="flex items-center gap-2 text-slate-400 mt-2">
                          <Paperclip className="h-3 w-3" />
                          <p className="text-[8px] font-bold uppercase italic">Upload site photos, safety permits, or technical diagrams (Images and PDFs supported).</p>
                        </div>
                      </div>
                    )}
                  />
                </div>

                {/* 09: SIGN-OFF & CUSTOMER ACCEPTANCE */}
                <SectionHeader number="09" title="Sign-Off & Customer Acceptance" />
                <div className="border-x-2 border-b-2 border-black grid grid-cols-2 divide-x-2 divide-black bg-white">
                  <div className="p-3 space-y-3 flex flex-col">
                    <h3 className="text-[10px] font-black uppercase text-white bg-[#37474f] px-2 py-0.5 text-center">Altek Green Technician</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField control={form.control} name="techName" render={({ field }) => (<div><DenseLabel>Full Name</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-6 text-[10px] border-none border-b border-black/10 rounded-none px-0 focus-visible:ring-0" /></div>)} />
                      <FormField control={form.control} name="techEmpNo" render={({ field }) => (<div><DenseLabel>Employee No</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-6 text-[10px] border-none border-b border-black/10 rounded-none px-0 focus-visible:ring-0" /></div>)} />
                    </div>
                    <div className="h-20 border rounded bg-slate-50/50 relative">
                      {form.getValues('techSignature') ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <img src={form.getValues('techSignature')!} alt="Tech Sig" className="max-h-16 object-contain" />
                          {!isFinalized && <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-5 w-5 text-red-400" onClick={() => { form.setValue('techSignature', null); handleAutosave({ techSignature: null }); }}><Trash2 className="h-3 w-3" /></Button>}
                        </div>
                      ) : <SignaturePad onSave={(data) => { form.setValue('techSignature', data); handleAutosave({ techSignature: data, techSignDate: new Date().toISOString() }); }} />}
                    </div>
                  </div>
                  <div className="p-3 space-y-3 flex flex-col">
                    <h3 className="text-[10px] font-black uppercase text-white bg-[#37474f] px-2 py-0.5 text-center">Representative</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField control={form.control} name="clientName" render={({ field }) => (<div><DenseLabel>Full Name</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-6 text-[10px] border-none border-b border-black/10 rounded-none px-0 focus-visible:ring-0" /></div>)} />
                      <FormField control={form.control} name="clientDesignation" render={({ field }) => (<div><DenseLabel>ID / Designation</DenseLabel><Input {...field} value={field.value ?? ''} onBlur={() => handleAutosave()} className="h-6 text-[10px] border-none border-b border-black/10 rounded-none px-0 focus-visible:ring-0" /></div>)} />
                    </div>
                    <div className="h-20 border rounded bg-slate-50/50 relative">
                      {form.getValues('clientSignature') ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <img src={form.getValues('clientSignature')!} alt="Client Sig" className="max-h-16 object-contain" />
                          {!isFinalized && <Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0 h-5 w-5 text-red-400" onClick={() => { form.setValue('clientSignature', null); handleAutosave({ clientSignature: null }); }}><Trash2 className="h-3 w-3" /></Button>}
                        </div>
                      ) : <SignaturePad onSave={(data) => { form.setValue('clientSignature', data); handleAutosave({ clientSignature: data, clientSignDate: new Date().toISOString() }); }} />}
                    </div>
                  </div>
                </div>

                <footer className="bg-[#1b5e20] text-white p-1 px-4 flex justify-between items-center mt-0 border-x border-b border-black">
                  <div className="text-[7px] font-black uppercase tracking-widest leading-none">
                    <p>Altek Green Pty Ltd • Unit 26, 87 Alumina Allee Street, Richards Bay 3900 • Tel: +27 63 640 9209 • Email: info@altekgreen.com • www.altekgreen.com • CONFIDENTIAL</p>
                  </div>
                  <div className="text-[7px] font-black uppercase tracking-tight">
                    DOC: AG-FSR-001 • REV 1.0 • © 2026 ALTEK GREEN
                  </div>
                </footer>

              </fieldset>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
