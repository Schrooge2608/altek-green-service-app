'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Plus, Trash2, Save, ArrowLeft, Loader2, Building2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useDoc, useCollection, useFirebase, updateDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import type { Client } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface QuoteItem {
  id: string;
  date: string;
  serviceMasterNumber: string;
  description: string;
  taxType: 'Standard' | 'Zero';
  qty: number;
  rate: number;
}

export default function EditQuotePage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const { firestore } = useFirebase();
  const quoteId = params.id as string;

  const [quoteNum, setQuoteNum] = useState('');
  const [quoteDate, setQuoteDate] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientRef, setClientRef] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch specific quote by ID
  const quoteRef = useMemoFirebase(
    () => (quoteId ? doc(firestore, 'quotations', quoteId) : null),
    [firestore, quoteId]
  );
  const { data: quote, isLoading: isQuoteLoading } = useDoc(quoteRef);

  // 2. Fetch Clients for dropdown
  const clientsQuery = useMemoFirebase(
    () => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')),
    [firestore]
  );
  const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsQuery);

  // 3. Fetch service rates for autocomplete
  const ratesQuery = useMemoFirebase(
    () => query(collection(firestore, 'service_rates'), orderBy('description', 'asc')),
    [firestore]
  );
  const { data: serviceRates } = useCollection(ratesQuery);

  // Initialize form with existing quote data
  useEffect(() => {
    if (quote) {
      setQuoteNum(quote.quoteNumber || '');
      setQuoteDate(quote.date || '');
      setClientAddress(quote.clientAddress || '');
      setClientRef(quote.clientRef || '');
      setItems(quote.items || []);
    }
  }, [quote]);

  const subtotal = items.reduce((sum, item) => sum + ((Number.isNaN(item.qty) ? 0 : item.qty) * (Number.isNaN(item.rate) ? 0 : item.rate)), 0);
  const taxTotal = items.reduce((sum, item) => item.taxType === 'Standard' ? sum + ((Number.isNaN(item.qty) ? 0 : item.qty) * (Number.isNaN(item.rate) ? 0 : item.rate) * 0.15) : sum, 0);
  const grandTotal = subtotal + taxTotal;

  const handleClientSelect = (clientId: string) => {
    const client = clients?.find(c => c.id === clientId);
    if (client) {
      const formatted = `${client.companyName}\n${client.billingAddress}\nAtt: ${client.contactPerson}\nEmail: ${client.email}\nVAT No: ${client.vatNumber || 'N/A'}`;
      setClientAddress(formatted);
      setClientRef(client.companyName);
    }
  };

  const addItem = () => setItems([...items, { 
    id: Date.now().toString(), 
    date: quoteDate, 
    serviceMasterNumber: '',
    description: '', 
    taxType: 'Standard', 
    qty: 1, 
    rate: 0 
  }]);

  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));

  const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        if (field === 'description' && serviceRates) {
          const rateMatch = serviceRates.find((r: any) => r.description === value);
          if (rateMatch) return { 
            ...item, 
            description: rateMatch.description, 
            rate: rateMatch.rate,
            serviceMasterNumber: rateMatch.serviceMasterNumber || ''
          };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleUpdate = async () => {
    if (!clientAddress) return alert("Please select client or enter address");
    if (!quoteRef) return;
    
    setIsSaving(true);
    try {
      const sanitizedItems = items.map(item => ({
        ...item,
        qty: Number.isNaN(item.qty) ? 0 : item.qty,
        rate: Number.isNaN(item.rate) ? 0 : item.rate
      }));

      updateDocumentNonBlocking(quoteRef, {
        quoteNumber: quoteNum,
        date: quoteDate,
        clientAddress,
        clientRef,
        items: sanitizedItems,
        subtotal,
        taxTotal,
        total: grandTotal,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Quote Updated", description: "Changes saved successfully." });
      router.push(`/admin/quotations/${quoteId}`);
    } catch (e: any) {
      console.error(e);
      alert("Error updating quote: " + e.message);
    }
    setIsSaving(false);
  };

  if (isQuoteLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!quote) return <div className="p-8 text-center">Quote not found.</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 bg-background">
      <style>{'@media print { @page { size: portrait; } }'}</style>
      <div className="flex justify-between items-center mb-6 no-print">
        <Button variant="outline" onClick={() => router.push(`/admin/quotations/${quoteId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
        </Button>
        <Button onClick={handleUpdate} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <div className="quote-container-wrapper">
        <div 
          className="bg-white p-10 border shadow-lg print:shadow-none print:border-none min-h-[29.7cm] print:min-h-0 text-slate-900 flex flex-col print:block print:h-auto" 
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          <div className="flex justify-between items-start mb-10">
            <div className="text-sm leading-tight font-bold">
              <h1 className="text-lg font-bold mb-1 text-slate-900">Altek Green</h1>
              <p className="text-[10px] text-slate-500 font-bold mb-1">Vendor Number: 11055342</p>
              <div className="font-normal text-xs text-slate-800 space-y-0.5">
                <p>Unit 6 Astro Place</p>
                <p>163 Van der Bijl Road, Meadowdale</p>
                <p>Gauteng 1609 ZAF</p>
                <p>+27875512620</p>
                <p>sales@altekgreen.com</p>
                <p>www.altekgreen.com</p>
                <p>VAT Registration No. 4660304447</p>
              </div>
            </div>
            <div className="w-64 flex justify-end">
              <Image src="/Altek-Logo.jpeg" width={200} height={100} alt="Altek Green" className="object-contain" />
            </div>
          </div>

          <h2 className="text-2xl text-slate-500 font-normal mb-8">Quote</h2>
          
          <div className="flex justify-between items-start mb-8 gap-8">
            <div className="w-1/2 space-y-4">
              <div className="no-print">
                <Label className="text-xs text-slate-400 uppercase font-bold block mb-1">SELECT CLIENT</Label>
                <Select onValueChange={handleClientSelect}>
                  <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                    <Building2 className="mr-2 h-4 w-4 text-slate-400" />
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsLoading ? (
                      <SelectItem value="loading" disabled>Loading clients...</SelectItem>
                    ) : (
                      clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">BILLING ADDRESS</Label>
                <Textarea 
                  value={clientAddress} 
                  onChange={e => setClientAddress(e.target.value)} 
                  placeholder="Select a client or enter address manually..."
                  className="text-sm leading-relaxed text-slate-900 bg-white border-slate-200 min-h-[120px] focus-visible:ring-primary"
                />
              </div>
            </div>
            <div className="w-1/3 text-right">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-400 uppercase font-bold text-right">QUOTE</span>
                <Input 
                  type="text"
                  value={quoteNum}
                  onChange={e => setQuoteNum(e.target.value)}
                  className="text-right border-0 p-0 h-auto focus-visible:ring-0 font-bold text-slate-900 w-full"
                  placeholder="Quote #"
                />
                <span className="text-slate-400 uppercase font-bold text-right">DATE</span>
                <Input 
                  type="date" 
                  value={quoteDate} 
                  onChange={e => setQuoteDate(e.target.value)} 
                  className="text-right border-0 p-0 h-auto focus-visible:ring-0 font-bold text-slate-900 w-full"
                />
              </div>
            </div>
          </div>

          <div className="mb-8 flex-grow print:flex-none print:mb-4">
            <Table>
              <TableHeader className="bg-slate-200">
                <TableRow className="border-none">
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[10%] pl-2">DATE</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[15%]">SERVICE MASTER #</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[35%]">DESCRIPTION</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[8%]">TAX</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[8%] text-right">QTY</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[12%] text-right">RATE</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[12%] text-right pr-2">AMOUNT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="border-b border-dashed border-slate-200 hover:bg-transparent">
                    <TableCell className="align-top py-2 pl-2">
                        <Input type="date" value={item.date} onChange={e => updateItem(item.id, 'date', e.target.value)} className="border-0 p-0 h-auto text-sm w-full focus-visible:ring-0"/>
                    </TableCell>
                    <TableCell className="align-top py-2">
                        <Input value={item.serviceMasterNumber} onChange={e => updateItem(item.id, 'serviceMasterNumber', e.target.value)} className="border-0 p-0 h-auto text-sm w-full focus-visible:ring-0 font-bold text-red-600" placeholder="Master #"/>
                    </TableCell>
                    <TableCell className="align-top py-2">
                      <Input list={`rates-${item.id}`} value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} className="border-0 p-0 h-auto text-sm w-full focus-visible:ring-0 font-medium whitespace-pre-wrap" placeholder="Description..."/>
                      <datalist id={`rates-${item.id}`}>
                        {serviceRates?.map((r: any) => <option key={r.id} value={r.description} />)}
                      </datalist>
                    </TableCell>
                    <TableCell className="align-top py-2 text-sm">{item.taxType}</TableCell>
                    <TableCell className="align-top py-2">
                      <Input 
                        type="number" 
                        value={Number.isNaN(item.qty) ? "" : item.qty} 
                        onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value))} 
                        className="text-right border-0 p-0 h-auto text-sm focus-visible:ring-0"
                      />
                    </TableCell>
                    <TableCell className="align-top py-2 text-right text-sm">
                        {(Number.isNaN(item.rate) ? 0 : item.rate).toLocaleString('en-ZA', {minimumFractionDigits: 2})}
                    </TableCell>
                    <TableCell className="align-top py-2 text-right text-sm font-bold pr-2">
                      {((Number.isNaN(item.qty) ? 0 : item.qty) * (Number.isNaN(item.rate) ? 0 : item.rate)).toLocaleString('en-ZA', {minimumFractionDigits: 2})}
                    </TableCell>
                    <TableCell className="no-print align-top py-2 w-[10px]">
                        <Trash2 className="h-4 w-4 text-red-300 cursor-pointer" onClick={() => removeItem(item.id)}/>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="no-print">
                  <TableCell colSpan={7}>
                    <Button variant="ghost" className="text-emerald-600 w-full justify-start pl-0 hover:bg-emerald-50" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-2"/> Add Line
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end mb-12 print:mb-6 print:break-inside-avoid">
            <div className="w-1/3">
              <div className="flex justify-between py-1 text-slate-500 text-sm">
                <span>SUBTOTAL</span>
                <span>{subtotal.toLocaleString('en-ZA', {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-500 text-sm">
                <span>TAX</span>
                <span>{taxTotal.toLocaleString('en-ZA', {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between py-2 mt-2 border-t border-slate-100">
                <span className="text-slate-400 font-bold text-sm uppercase">TOTAL</span>
                <span className="text-xl font-bold text-slate-900">ZAR {grandTotal.toLocaleString('en-ZA', {minimumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-slate-400 mt-auto pt-8 border-t border-slate-50 print:mt-4 print:break-inside-avoid">
            <div className="grid grid-cols-2 gap-12">
              <div className="space-y-4">
                <p className="text-slate-900 font-bold">Accepted By</p>
                <div className="border-b border-slate-200 w-full h-8"></div>
              </div>
              <div className="space-y-4">
                <p className="text-slate-900 font-bold">Accepted Date</p>
                <div className="border-b border-slate-200 w-full h-8"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
