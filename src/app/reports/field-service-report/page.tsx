'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  FileText, 
  Loader2, 
  Search, 
  ArrowRight,
  ClipboardList,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { FieldServiceReport } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function FSRTrackerPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = React.useState('');

  const currentMonthStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const [expandedMonths, setExpandedMonths] = React.useState<Record<string, boolean>>({
    [currentMonthStr]: true
  });

  const toggleMonth = (monthStr: string) => {
    setExpandedMonths(prev => ({ ...prev, [monthStr]: !prev[monthStr] }));
  };

  const fsrQuery = useMemoFirebase(
    () => query(collection(firestore, 'field_service_reports'), orderBy('date', 'desc')),
    [firestore]
  );
  const { data: reports, isLoading } = useCollection<FieldServiceReport>(fsrQuery);

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter(r => 
      r.fsrReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.assetName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [reports, searchTerm]);

  const groupedReports = useMemo(() => {
    const groups: { monthStr: string, reports: FieldServiceReport[] }[] = [];
    filteredReports.forEach(r => {
      const dateObj = new Date(r.date || r.createdAt);
      if (isNaN(dateObj.getTime())) return;
      const monthStr = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      let group = groups.find(g => g.monthStr === monthStr);
      if (!group) {
        group = { monthStr, reports: [] };
        groups.push(group);
      }
      group.reports.push(r);
    });
    return groups;
  }, [filteredReports]);

  const handleCreateNew = async () => {
    if (!user) return;
    
    const refId = ''; // User will manually type the FSR reference from the hard copy book
    
    try {
      const newReport: Partial<FieldServiceReport> = {
        userId: user.uid,
        fsrReference: refId,
        date: new Date().toISOString().split('T')[0],
        status: 'Draft',
        createdAt: new Date().toISOString(),
        customer: '',
        parts: [],
        personnel: [],
        hse: {
          ppe: 'NA',
          riskAssessment: 'NA',
          permit: 'NA',
          incidents: 'NA',
          areaCleaned: 'NA',
          environmentalImpact: 'NA',
          observations: ''
        }
      };
      const docRef = await addDocumentNonBlocking(collection(firestore, 'field_service_reports'), newReport);
      router.push(`/reports/field-service-report/${docRef.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Field Service Reports</h1>
          <p className="text-muted-foreground italic">Manage official AG-FSR-001 digital reports.</p>
        </div>
        <Button onClick={handleCreateNew} className="bg-primary">
          <PlusCircle className="mr-2 h-4 w-4" /> New Field Report
        </Button>
      </header>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" /> Service Log
            </CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search Reference, Customer..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="pl-6 font-bold">Reference</TableHead>
                <TableHead className="font-bold">Customer / Site</TableHead>
                <TableHead className="font-bold">PO Number</TableHead>
                <TableHead className="font-bold">Equipment</TableHead>
                <TableHead className="font-bold">Date</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right pr-6 font-bold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6 text-slate-300" /></TableCell></TableRow>
              ) : groupedReports.length > 0 ? (
                groupedReports.map(group => {
                  const isExpanded = expandedMonths[group.monthStr] ?? false;
                  return (
                  <React.Fragment key={group.monthStr}>
                    <TableRow 
                      className="bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
                      onClick={() => toggleMonth(group.monthStr)}
                    >
                      <TableCell colSpan={7} className="font-bold text-slate-800 py-2 pl-6 shadow-[inset_0_1px_0_rgba(0,0,0,0.05),inset_0_-1px_0_rgba(0,0,0,0.05)]">
                        <div className="flex items-center gap-2 select-none">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {group.monthStr}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && group.reports.map(report => (
                      <TableRow key={report.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono font-bold text-primary pl-6">{report.fsrReference || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800">{report.customer || '---'}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">{report.site || 'N/A'}</div>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-slate-600">{report.poNumber || '---'}</TableCell>
                        <TableCell className="text-sm font-medium">{report.assetName || '---'}</TableCell>
                        <TableCell className="text-xs text-slate-500 font-mono">{report.date}</TableCell>
                        <TableCell>
                          <Badge variant={report.status === 'Finalized' ? 'default' : 'secondary'} className={cn(
                            report.status === 'Draft' ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                          )}>
                            {report.status === 'Draft' ? <Clock className="h-3 w-3 mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {report.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Link href={`/reports/field-service-report/${report.id}`}>
                            <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5">
                              Open Report <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-400 italic">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 opacity-20" />
                      <p>No field service reports found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}