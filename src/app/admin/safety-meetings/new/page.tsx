
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  Users, 
  ClipboardCheck, 
  Calendar as CalendarIcon, 
  User as UserIcon,
  ShieldAlert,
  CheckCircle2,
  ArrowLeft,
  X,
  AlertTriangle,
  Upload,
  ExternalLink,
  FileText,
  FileCheck
} from 'lucide-react';
import { 
  useCollection, 
  useUser, 
  useFirestore, 
  useMemoFirebase, 
  useDoc,
  useFirebase
} from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, setDoc, addDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { User, SafetyMeeting } from '@/lib/types';
import { SignaturePad } from '@/components/ui/signature-pad';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * @fileOverview Creation workflow for recording a new Monthly Safety Meeting.
 * Supports a "Draft vs Finalize" workflow for continuous editing.
 * Now handles loading existing drafts via the 'id' search parameter.
 */
export default function NewSafetyMeetingPage() {
  const { user } = useUser();
  const { firestore, firebaseApp } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get('id');

  // Document State
  const [docId, setDocId] = useState<string | null>(urlId);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [conductorName, setConductorName] = useState('');
  
  const [newTopic, setNewTopic] = useState('');
  const [agendaTopics, setAgendaTopics] = useState<string[]>([]);
  
  const [orangeBanners, setOrangeBanners] = useState<{ name: string; url: string }[]>([]);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [conductorSignature, setConductorSignature] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Permissions & User Data
  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRef);
  
  const isManager = useMemo(() => {
    if (!userData?.role) return false;
    return ['Admin', 'Superadmin', 'Services Manager', 'Site Supervisor', 'Corporate Manager'].includes(userData.role);
  }, [userData]);

  // 2. Fetch Technicians for Attendance Registry
  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('name', 'asc')), [firestore]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const technicians = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.role?.includes('Technician') || 
      u.role?.includes('Engineer') || 
      u.role?.includes('Technologist') ||
      u.role?.includes('specialist')
    );
  }, [allUsers]);

  // 3. LOAD EXISTING DRAFT DATA
  const existingDocRef = useMemoFirebase(() => (docId ? doc(firestore, 'safety_meetings', docId) : null), [firestore, docId]);
  const { data: existingMeeting, isLoading: isFetchingExisting } = useDoc<SafetyMeeting>(existingDocRef);

  useEffect(() => {
    if (existingMeeting && docId) {
      setDate(existingMeeting.date);
      setTime(existingMeeting.time);
      setConductorName(existingMeeting.conductorName);
      setAgendaTopics(existingMeeting.agendaTopics || []);
      setOrangeBanners(existingMeeting.orangeBanners || []);
      setConductorSignature(existingMeeting.conductorSignature);
      
      const attMap: Record<string, boolean> = {};
      existingMeeting.attendance.forEach(a => {
        attMap[a.userId] = a.isPresent;
      });
      setAttendance(attMap);
    }
  }, [existingMeeting, docId]);

  useEffect(() => {
    if (userData && !conductorName && !docId) {
      setConductorName(userData.name || '');
    }
  }, [userData, conductorName, docId]);

  const handleAddTopic = (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    const cleanTopic = newTopic.trim();
    if (cleanTopic && !agendaTopics.includes(cleanTopic)) {
      setAgendaTopics([...agendaTopics, cleanTopic]);
      setNewTopic('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseApp) return;

    setIsUploadingBanner(true);
    try {
      const storage = getStorage(firebaseApp);
      const storagePath = `safety_meetings/orange_banners/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      
      setOrangeBanners(prev => [...prev, { name: file.name, url: downloadUrl }]);
      toast({ title: "Document Uploaded", description: "Orange Banner incident added." });
    } catch (error: any) {
      console.error("Storage Upload Error:", error);
      toast({ variant: 'destructive', title: "Upload Failed", description: error.message });
    } finally {
      setIsUploadingBanner(false);
      e.target.value = '';
    }
  };

  const toggleAttendance = (userId: string) => {
    setAttendance(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleSaveMeeting = async (finalStatus: 'draft' | 'finalized') => {
    if (!isManager || !user) return;
    
    if (finalStatus === 'finalized' && !conductorSignature) {
      toast({ variant: 'destructive', title: "Signature Required", description: "Conductor must sign to finalize the record." });
      return;
    }

    setIsSaving(true);
    try {
      const meetingData: any = {
        date,
        time,
        conductorName,
        conductorId: user.uid,
        conductorSignature,
        agendaTopics,
        orangeBanners,
        status: finalStatus,
        attendance: technicians.map(tech => ({
          userId: tech.id,
          userName: tech.name,
          role: tech.role,
          isPresent: !!attendance[tech.id]
        })),
        updatedAt: serverTimestamp()
      };

      if (!docId) {
        // NEW DOCUMENT
        meetingData.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(firestore, 'safety_meetings'), meetingData);
        setDocId(docRef.id);
        toast({ title: finalStatus === 'draft' ? "Draft Created" : "Meeting Finalized" });
      } else {
        // UPDATE EXISTING
        await updateDoc(doc(firestore, 'safety_meetings', docId), meetingData);
        toast({ title: finalStatus === 'draft' ? "Draft Updated" : "Meeting Finalized" });
      }

      if (finalStatus === 'finalized') {
        router.push(`/admin/safety-meetings`);
      }
    } catch (e: any) {
      console.error("Safety Meeting Save Failed:", e);
      toast({ variant: 'destructive', title: "Save Failed", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isManager && userData) {
    return <div className="p-8 text-center text-muted-foreground">Access Restricted to Conductor-level accounts.</div>;
  }

  if (isFetchingExisting) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8 max-w-5xl mx-auto pb-32">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" type="button" onClick={() => router.push('/admin/safety-meetings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="p-3 bg-emerald-600 rounded-xl shadow-lg">
            <ClipboardCheck className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Safety Briefing Builder</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> 
              {docId ? `Editing Record: ${docId.slice(-6).toUpperCase()}` : 'New Compliance Document'}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: MEETING METADATA */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" /> Meeting Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Time</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Conductor Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                  <Input 
                    value={conductorName} 
                    onChange={e => setConductorName(e.target.value)} 
                    className="pl-9"
                    placeholder="Enter full name..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ORANGE BANNER INCIDENTS (DOCUMENTS) */}
          <Card className="shadow-md border-orange-200 border-2 overflow-hidden bg-orange-50/20">
            <CardHeader className="bg-orange-50 border-b border-orange-100">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-orange-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Orange Banner Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <Label className="flex items-center gap-2 cursor-pointer bg-white border-2 border-dashed border-orange-200 p-4 rounded-lg hover:bg-orange-100 transition-colors text-orange-700 font-bold text-xs uppercase text-center justify-center">
                {isUploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isUploadingBanner ? 'Uploading...' : 'Upload Safety Flash (PDF/Image)'}
                <Input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} disabled={isUploadingBanner} />
              </Label>
              
              <div className="space-y-2 min-h-[100px]">
                {orangeBanners.length === 0 ? (
                  <p className="text-xs text-orange-400 italic text-center py-8">No critical documents uploaded.</p>
                ) : (
                  orangeBanners.map((banner, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded border border-orange-200 text-sm font-black text-slate-900 shadow-sm border-l-4 border-l-orange-500 animate-in slide-in-from-left-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-orange-600 shrink-0" />
                        <span className="truncate">{banner.name}</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => setOrangeBanners(orangeBanners.filter((_, idx) => idx !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* AGENDA TOPICS */}
          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Plus className="h-4 w-4" /> Agenda Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="General topic..." 
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                />
                <Button type="button" onClick={handleAddTopic} size="sm" variant="secondary">Add</Button>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {agendaTopics.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">No standard topics added.</p>
                ) : (
                  agendaTopics.map((topic, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-sm text-slate-700">
                      <span>• {topic}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => setAgendaTopics(agendaTopics.filter(t => t !== topic))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: ATTENDANCE TRACKER */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Personnel Attendance
                </CardTitle>
              </div>
              <Badge variant="outline" className="bg-white">
                {Object.values(attendance).filter(v => v).length} / {technicians.length} Present
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="pl-6 font-bold text-[10px] uppercase text-slate-400">Technician Name</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase text-slate-400">Designation</TableHead>
                    <TableHead className="text-right pr-6 font-bold text-[10px] uppercase text-slate-400">Attendance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow><TableCell colSpan={3} className="h-32 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : technicians.length > 0 ? (
                    technicians.map(tech => (
                      <TableRow key={tech.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="pl-6 font-bold text-slate-700">{tech.name}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px] px-2 py-0">{tech.role}</Badge></TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-3">
                            <span className={cn("text-[10px] font-black uppercase tracking-tighter", attendance[tech.id] ? "text-emerald-600" : "text-slate-300")}>
                              {attendance[tech.id] ? 'Present' : 'Absent'}
                            </span>
                            <Switch 
                              checked={!!attendance[tech.id]} 
                              onCheckedChange={() => toggleAttendance(tech.id)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-400 italic">No technicians found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* SIGN-OFF SECTION */}
          <Card className="shadow-lg border-emerald-100 border-2">
            <CardHeader className="bg-emerald-50 border-b border-emerald-100">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-emerald-800 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Conductor Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed italic">
                  I, the undersigned, hereby certify that the above personnel were present for the safety briefing on the topics listed.
                </p>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Digitally Signing As:</Label>
                  <p className="text-lg font-black text-slate-900 border-b-2 border-emerald-500 pb-1 w-fit">{conductorName || '...'}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400">Conductor Signature</Label>
                <div className="border rounded-md bg-white overflow-hidden shadow-inner h-[120px]">
                  {conductorSignature ? (
                    <div className="relative group p-2 flex flex-col items-center justify-center h-full">
                      <img src={conductorSignature} alt="Conductor Sig" className="h-20 object-contain mx-auto" />
                      <Button type="button" variant="ghost" size="sm" className="text-red-500 mt-2 text-xs h-6" onClick={() => setConductorSignature(null)}>Clear</Button>
                    </div>
                  ) : (
                    <SignaturePad onSave={(data) => setConductorSignature(data)} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4">
            <Button variant="ghost" type="button" onClick={() => router.push('/admin/safety-meetings')}>Cancel</Button>
            
            <Button 
              variant="outline"
              className="border-primary text-primary hover:bg-primary/5 min-w-[140px]"
              disabled={isSaving}
              onClick={() => handleSaveMeeting('draft')}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Draft
            </Button>

            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 min-w-[200px] shadow-xl" 
              disabled={isSaving || !conductorSignature || (agendaTopics.length === 0 && orangeBanners.length === 0)}
              onClick={() => handleSaveMeeting('finalized')}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-2 h-4 w-4" />}
              Finalize & Lock
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
