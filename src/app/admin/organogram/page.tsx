'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Building, 
  User as UserIcon, 
  Shield, 
  Briefcase, 
  Wrench, 
  Cpu, 
  Loader2,
  Mail,
  Phone,
  Settings2,
  Users,
  Save
} from 'lucide-react';
import { 
  useCollection, 
  useUser, 
  useFirestore, 
  useMemoFirebase, 
  useDoc,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { User, OrganogramPosition } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

// Helper to get initials
const getInitials = (name?: string) => {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

// Map roles to icons for visual variety
const getRoleIcon = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('director') || t.includes('manager')) return Shield;
  if (t.includes('admin')) return Users;
  if (t.includes('tech')) return Wrench;
  if (t.includes('vsd') || t.includes('support')) return Cpu;
  return UserIcon;
};

export default function OrganogramPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // 1. STATE & PERMISSIONS
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPosition, setEditingPosition] = useState<OrganogramPosition | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [roleTitle, setRoleTitle] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [tier, setTier] = useState<number>(1);

  // Permission Check
  const currentUserRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: currentUserData } = useDoc<User>(currentUserRef);
  const isAdmin = currentUserData?.role === 'Admin' || currentUserData?.role === 'Superadmin';

  // 2. DATA FETCHING
  // Fetch Positions
  const organogramQuery = useMemoFirebase(() => query(collection(firestore, 'organogram'), orderBy('tier', 'asc')), [firestore]);
  const { data: positions, isLoading: positionsLoading } = useCollection<OrganogramPosition>(organogramQuery);

  // Fetch All Users (for assignee dropdown)
  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('name', 'asc')), [firestore]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  // 3. GROUPING LOGIC
  const groupedPositions = useMemo(() => {
    if (!positions) return {};
    const groups = positions.reduce((acc, pos) => {
      const t = pos.tier || 1;
      if (!acc[t]) acc[t] = [];
      acc[t].push(pos);
      return acc;
    }, {} as Record<number, OrganogramPosition[]>);
    return groups;
  }, [positions]);

  const sortedTiers = useMemo(() => {
    return Object.keys(groupedPositions).map(Number).sort((a, b) => a - b);
  }, [groupedPositions]);

  // 4. HANDLERS
  const handleOpenEdit = (pos?: OrganogramPosition) => {
    if (pos) {
      setEditingPosition(pos);
      setRoleTitle(pos.roleTitle);
      setSelectedUserId(pos.userId || 'unassigned');
      setTier(pos.tier);
    } else {
      setEditingPosition(null);
      setRoleTitle('');
      setSelectedUserId('unassigned');
      setTier(sortedTiers.length > 0 ? Math.max(...sortedTiers) + 1 : 1);
    }
    setIsModalOpen(true);
  };

  const handleSavePosition = async () => {
    if (!roleTitle || !tier) {
      toast({ variant: 'destructive', title: "Validation Error", description: "Role Title and Tier are required." });
      return;
    }

    setIsSaving(true);
    try {
      const positionData = {
        roleTitle,
        userId: selectedUserId === 'unassigned' ? null : selectedUserId,
        tier: Number(tier),
      };

      if (editingPosition) {
        updateDocumentNonBlocking(doc(firestore, 'organogram', editingPosition.id), positionData);
        toast({ title: "Position Updated" });
      } else {
        await addDocumentNonBlocking(collection(firestore, 'organogram'), positionData);
        toast({ title: "Position Added" });
      }
      setIsModalOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Save Failed", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePosition = (id: string) => {
    if (!confirm("Remove this position from the organogram?")) return;
    deleteDocumentNonBlocking(doc(firestore, 'organogram', id));
    toast({ title: "Position Deleted" });
  };

  const handleCardClick = (userId: string | null) => {
    if (isEditMode || !userId) return;
    const found = allUsers?.find(u => u.id === userId);
    if (found) setViewingUser(found);
  };

  if (positionsLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left space-y-2">
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <Building className="h-3 w-3" /> Altek Green
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Company Structure</h1>
            <p className="text-slate-500 max-w-md">
              Operational hierarchy and team assignments for site logistics.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
            {isAdmin && (
              <div className="flex items-center space-x-2 border-r pr-4 mr-2">
                <Settings2 className="h-4 w-4 text-slate-400" />
                <Label htmlFor="edit-mode" className="text-xs font-bold uppercase text-slate-500">Edit Mode</Label>
                <Switch id="edit-mode" checked={isEditMode} onCheckedChange={setIsEditMode} />
              </div>
            )}
            {isEditMode && (
              <Button onClick={() => handleOpenEdit()} className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" /> Add Position
              </Button>
            )}
          </div>
        </header>

        {/* ORGANOGRAM GRID */}
        <div className="flex flex-col items-center gap-0">
          {sortedTiers.map((tierNum, idx) => (
            <React.Fragment key={tierNum}>
              {/* Vertical Connector (except for the first row) */}
              {idx > 0 && <div className="w-px h-12 bg-slate-300" />}
              
              <div className="w-full flex flex-col items-center">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Tier {tierNum}</h2>
                <div className="flex flex-wrap justify-center gap-6 w-full">
                  {groupedPositions[tierNum].map((pos) => {
                    const assignedUser = allUsers?.find(u => u.id === pos.userId);
                    const Icon = getRoleIcon(pos.roleTitle);
                    
                    return (
                      <Card 
                        key={pos.id} 
                        onClick={() => handleCardClick(pos.userId)}
                        className={cn(
                          "relative overflow-hidden border-none shadow-md transition-all min-w-[260px] max-w-[300px]",
                          !isEditMode && pos.userId && "hover:shadow-lg hover:-translate-y-1 cursor-pointer",
                          tierNum === 1 ? "bg-slate-900 text-white" : "bg-white text-slate-900"
                        )}
                      >
                        {/* Status Bar */}
                        <div className={cn(
                          "absolute top-0 left-0 w-full h-1",
                          tierNum === 1 ? "bg-emerald-500" : "bg-emerald-600"
                        )} />
                        
                        <CardContent className="p-5 flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-full flex-shrink-0",
                            tierNum === 1 ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-100 text-slate-600"
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm leading-tight truncate">
                              {assignedUser?.name || 'Vacant Position'}
                            </p>
                            <p className={cn(
                              "text-[10px] font-bold uppercase tracking-wider mt-1 truncate",
                              tierNum === 1 ? "text-slate-400" : "text-emerald-600"
                            )}>
                              {pos.roleTitle}
                            </p>
                          </div>

                          {/* Admin Controls */}
                          {isEditMode && (
                            <div className="flex flex-col gap-1 ml-2">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary" onClick={(e) => { e.stopPropagation(); handleOpenEdit(pos); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeletePosition(pos.id); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </React.Fragment>
          ))}

          {(!positions || positions.length === 0) && (
            <div className="p-20 text-center border-2 border-dashed rounded-3xl bg-white/50">
              <Users className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 italic">No positions mapped yet. Enable Edit Mode to build the structure.</p>
            </div>
          )}
        </div>

        <footer className="pt-12 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Confidential - Altek Green Internal Hierarchy
          </p>
        </footer>
      </div>

      {/* EDIT MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[95vh] flex flex-col p-0 overflow-hidden sm:max-w-[425px]">
          <div className="p-6 pb-2 shrink-0 border-b bg-background">
            <DialogHeader>
              <DialogTitle>{editingPosition ? 'Edit Position' : 'Add New Position'}</DialogTitle>
              <DialogDescription>Define the role, level, and assignee for the company chart.</DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label>Role Title</Label>
              <Input placeholder="e.g. Senior Technician" value={roleTitle} onChange={e => setRoleTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Assign Member</Label>
              <select 
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
              >
                <option value="unassigned">Unassigned / Vacant</option>
                {allUsers?.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tier Level (1 = Top)</Label>
              <Input type="number" min={1} value={tier} onChange={e => setTier(Number(e.target.value))} />
            </div>
          </div>
          
          <div className="p-6 pt-4 shrink-0 border-t bg-slate-50/50">
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
              <Button onClick={handleSavePosition} disabled={isSaving} className="bg-primary">
                {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                Save Position
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIEW PROFILE MODAL */}
      <Dialog open={!!viewingUser} onOpenChange={(open) => !open && setViewingUser(null)}>
        <DialogContent className="sm:max-w-[400px]">
          {viewingUser && (
            <>
              <DialogHeader className="items-center pb-4 border-b">
                <div className="h-20 w-20 rounded-full bg-emerald-600 text-white flex items-center justify-center text-3xl font-black mb-4 shadow-lg border-4 border-white">
                  {getInitials(viewingUser.name)}
                </div>
                <DialogTitle className="text-xl font-black">{viewingUser.name}</DialogTitle>
                <Badge variant="secondary" className="mt-1">{viewingUser.role}</Badge>
              </DialogHeader>
              <div className="space-y-4 py-6">
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-2 bg-slate-100 rounded-md"><Mail className="h-4 w-4 text-slate-500" /></div>
                  <span className="font-medium text-slate-700">{viewingUser.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-2 bg-slate-100 rounded-md"><Phone className="h-4 w-4 text-slate-500" /></div>
                  <span className="font-medium text-slate-700">{viewingUser.phoneNumber || 'No phone listed'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-2 bg-slate-100 rounded-md"><Wrench className="h-4 w-4 text-slate-500" /></div>
                  <span className="font-medium text-slate-700">RTBS: {viewingUser.rtbsNumber || 'Pending'}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="w-full" onClick={() => setViewingUser(null)}>Close Profile</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}