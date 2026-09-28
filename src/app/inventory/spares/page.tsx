'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Loader2, Upload, FileUp, Trash2, Camera, ScanLine, CheckCircle2 } from 'lucide-react';
import { useCollection, useFirestore, useUser, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, getDocs, getDoc } from 'firebase/firestore';
import type { SparePart, Equipment, VSD } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { scanSparePart } from '@/ai/flows/scan-spare-part-flow';
import * as XLSX from 'xlsx';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Helper to determine the super-category of a VSD Model
const getSuperCategory = (model: string) => {
    const lower = model.toLowerCase();
    if (lower.includes('gegelec') || lower.includes('cegelec') || lower.includes('rvs')) return 'GEGELEC';
    if (lower.includes('sami')) return 'Sami F spares';
    if (lower.includes('acs6') || lower.includes('acs 6') || lower.includes('acs 607') || lower.includes('acs607')) return 'ACS 600 spares';
    if (lower.includes('acs8') || lower.includes('acs 8') || lower.includes('acs 880') || lower.includes('acs880')) return 'ACS 800 spares';
    if (lower.includes('altistart') || lower.includes('ats')) return 'Altistart spares';
    if (lower.includes('sinamics') || lower.includes('siemens') || lower.includes('mentor')) return 'Sinamics G130/150';
    return 'Other';
};

export default function SparesInventoryPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    const sparesQuery = useMemoFirebase(() => query(collection(firestore, 'spare_parts'), orderBy('createdAt', 'desc')), [firestore]);
    const { data: sparesList, isLoading } = useCollection<SparePart>(sparesQuery);
    
    const vsdsCol = useMemoFirebase(() => collection(firestore, 'vsds'), [firestore]);
    const { data: vsds } = useCollection<VSD>(vsdsCol);
    
    const equipmentCol = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
    const { data: equipment } = useCollection<Equipment>(equipmentCol);

    const [searchQuery, setSearchQuery] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('GEGELEC');
    
    const [form, setForm] = useState({
        rbmNumber: '',
        rtbsNumber: '',
        oemPartNumber: '',
        name: '',
        type: '',
        manufacturer: '',
        category: 'Control Board',
        compatibleModels: '',
        stockLevel: '0',
        price: '0'
    });

    const categories = ['Control Board', 'IGBT', 'Thyristor', 'Diode', 'Fan', 'Fuse', 'Capacitor', 'Contactor', 'Relay', 'Power Supply', 'Other'];

    const filteredSpares = sparesList?.filter(spare => {
        const q = searchQuery.toLowerCase();
        return (
            spare.rbmNumber?.toLowerCase().includes(q) ||
            spare.rtbsNumber?.toLowerCase().includes(q) ||
            spare.oemPartNumber?.toLowerCase().includes(q) ||
            spare.name?.toLowerCase().includes(q) ||
            spare.type?.toLowerCase().includes(q) ||
            spare.manufacturer?.toLowerCase().includes(q) ||
            spare.compatibleModels?.some(m => m.toLowerCase().includes(q))
        );
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const modelsArray = form.compatibleModels.split(',').map(m => m.trim()).filter(m => m);
            await addDoc(collection(firestore, 'spare_parts'), {
                rbmNumber: form.rbmNumber,
                rtbsNumber: form.rtbsNumber,
                oemPartNumber: form.oemPartNumber,
                name: form.name,
                type: form.type,
                manufacturer: form.manufacturer,
                category: form.category,
                compatibleModels: modelsArray,
                stockLevel: parseInt(form.stockLevel) || 0,
                price: parseFloat(form.price) || 0,
                createdAt: serverTimestamp(),
                createdBy: user?.uid
            });
            toast({ title: 'Success', description: 'Spare part added successfully.' });
            setIsAddDialogOpen(false);
            setForm({ rbmNumber: '', rtbsNumber: '', oemPartNumber: '', name: '', type: '', manufacturer: '', category: 'Control Board', compatibleModels: '', stockLevel: '0', price: '0' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to add spare part.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this part?')) {
            await deleteDocumentNonBlocking(doc(firestore, 'spare_parts', id));
            toast({ title: 'Deleted', description: 'Part removed from inventory.' });
        }
    };

    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importStatus, setImportStatus] = useState<string | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportStatus('Reading file...');
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);

            setImportStatus('Fetching current equipment from database...');
            const eqSnap = await getDocs(collection(firestore, 'equipment'));
            const allEquipment = eqSnap.docs.map(d => ({ id: d.id, ...d.data() } as Equipment));
            
            // Phase 1: Equipment Mapping
            const eqSheets = ['MPA', 'MPC', 'MPD', 'MPE', 'Boosters'];
            let matchedEqCount = 0;

            for (const sheetName of eqSheets) {
                if (!workbook.Sheets[sheetName]) continue;
                setImportStatus(`Mapping VSDs from ${sheetName}...`);
                const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1 });
                
                // Find header row
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(10, rows.length); i++) {
                    if (rows[i] && rows[i].includes('Plant Location Description')) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx !== -1) {
                    const headers = rows[headerRowIdx];
                    const descIdx = headers.indexOf('Plant Location Description');
                    const partIdx = headers.indexOf('Part number');
                    
                    let currentPrefix = '';

                    for (let i = headerRowIdx + 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0) continue;

                        const desc = row[descIdx]?.toString().trim();
                        const partNumber = row[partIdx]?.toString().trim();

                        if (!desc) continue;

                        // If there is a description but NO part number, this is a section header (e.g., "Dredge 1")
                        if (desc && !partNumber) {
                            currentPrefix = desc;
                            continue;
                        }

                        // If we have both, try to find the equipment
                        if (desc && partNumber) {
                            const rawName = desc.toLowerCase();
                            const prefixedName = `${currentPrefix} ${desc}`.toLowerCase();

                            const eq = allEquipment.find(e => {
                                const eqName = e.name.trim().toLowerCase();
                                return eqName === rawName || eqName === prefixedName;
                            });

                            if (eq) {
                                const cleanModel = partNumber.toString().replace(/\s+/g, ''); // Remove ALL spaces (e.g. ACS 800 -> ACS800)
                                
                                if (eq.vsdId) {
                                    // Update existing VSD
                                    await updateDoc(doc(firestore, 'vsds', eq.vsdId), { model: cleanModel });
                                } else {
                                    // Create new VSD document and link it
                                    const newVsdRef = await addDoc(collection(firestore, 'vsds'), {
                                        equipmentId: eq.id,
                                        model: cleanModel,
                                        status: 'active',
                                        driveType: 'VSD',
                                        manufacturer: 'ABB',
                                        installationDate: new Date().toISOString().split('T')[0]
                                    });
                                    // Link to equipment
                                    await updateDoc(doc(firestore, 'equipment', eq.id), { vsdId: newVsdRef.id });
                                }
                                matchedEqCount++;
                            }
                        }
                    }
                }
            }

            // Phase 2: Spares Import
            setImportStatus('Fetching existing Spares for deduplication...');
            const sparesSnap = await getDocs(collection(firestore, 'spare_parts'));
            const existingSpares = sparesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SparePart));
            
            setImportStatus('Importing Spare Parts...');
            let importedSparesCount = 0;
            let updatedSparesCount = 0;
            
            // Strict whitelist of VSD Model prefixes to completely avoid junk sheets
            const validModelPrefixes = ['acs', 'sami', 'siemens', 'mentor', 'ats', 'rvs', 'sinamics'];

            for (const sheetName of workbook.SheetNames) {
                const normalizedSheet = sheetName.trim().toLowerCase();
                
                // Must start with or contain one of the valid VSD model prefixes
                const isValidModel = validModelPrefixes.some(prefix => normalizedSheet.includes(prefix));
                if (!isValidModel) continue;
                
                // Additional hard-coded ignores for sheets that contain a valid prefix but aren't models
                if (normalizedSheet.includes('recommended') || normalizedSheet.includes('replacement') || normalizedSheet.includes('est') || normalizedSheet.includes('list') || normalizedSheet.includes('spares for')) continue;
                
                // Assume this is a Spares sheet. VSD Model is the sheet name with spaces removed
                const compatibleModel = sheetName.replace(/\s+/g, '');
                
                const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1 });
                if (rows.length === 0) continue;

                // Find header row (the one containing 'Name' or 'Type' or 'RBM' or 'Item')
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(10, rows.length); i++) {
                    const rowStr = (rows[i] || []).join(' ').toLowerCase();
                    if (rowStr.includes('name') || rowStr.includes('type') || rowStr.includes('rbm') || rowStr.includes('item')) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx !== -1) {
                    const headers = Array.from(rows[headerRowIdx] || []);
                    const normH = headers.map((h: any) => {
                        if (!h) return '';
                        return h.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                    });
                    
                    const rbmIdx = normH.findIndex((h: string) => h && h.includes('rbm'));
                    const rtbsIdx = normH.findIndex((h: string) => h && h.includes('rtbs'));
                    const oemIdx = normH.findIndex((h: string) => h && (h.includes('abb') || h.includes('oem') || h.includes('sparecode')));
                    const nameIdx = normH.findIndex((h: string) => h === 'name' || (h && h.includes('description')));
                    const typeIdx = normH.findIndex((h: string) => h === 'type' || (h && h.includes('model')));

                    for (let i = headerRowIdx + 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0) continue;
                        
                        // Break if we hit the footer tables
                        if (row.includes('Index sheet') || row.includes('Plants used') || row.includes('Additional spares')) {
                            break;
                        }
                        
                        const name = row[nameIdx]?.toString().trim();
                        const type = typeIdx !== -1 ? row[typeIdx]?.toString().trim() : '';
                        const rbm = row[rbmIdx]?.toString().trim();
                        const oem = row[oemIdx]?.toString().trim();
                        
                        // We need at least an RBM, OEM, or Name to identify it
                        if (!name && !type && !rbm && !oem) continue;

                        // Deduplication Check
                        const existing = existingSpares.find(s => {
                            if (rbm && s.rbmNumber === rbm) return true;
                            if (oem && s.oemPartNumber === oem) return true;
                            if (name && s.name === name) return true;
                            return false;
                        });

                        if (existing) {
                            let updates: any = {};
                            if (!existing.compatibleModels) existing.compatibleModels = [];
                            if (!existing.compatibleModels.includes(compatibleModel)) {
                                existing.compatibleModels.push(compatibleModel);
                                updates.compatibleModels = existing.compatibleModels;
                            }
                            
                            // Patch missing data if the old record was corrupted/empty
                            if (!existing.rbmNumber && rbm) updates.rbmNumber = rbm;
                            if (!existing.oemPartNumber && oem) updates.oemPartNumber = oem;
                            if (!existing.rtbsNumber && rtbsIdx !== -1 && row[rtbsIdx]) updates.rtbsNumber = row[rtbsIdx].toString().trim();
                            if (!existing.type && type) updates.type = type;

                            if (Object.keys(updates).length > 0) {
                                await updateDoc(doc(firestore, 'spare_parts', existing.id), updates);
                                updatedSparesCount++;
                            }
                        } else {
                            const spareData = {
                                rbmNumber: rbm || '',
                                rtbsNumber: rtbsIdx !== -1 ? row[rtbsIdx]?.toString().trim() || '' : '',
                                oemPartNumber: oem || '',
                                name: name || '',
                                type: type || '',
                                manufacturer: 'ABB',
                                category: 'Component',
                                compatibleModels: [compatibleModel],
                                stockLevel: 0,
                                createdAt: serverTimestamp(),
                                createdBy: user?.uid
                            };

                            const newDoc = await addDoc(collection(firestore, 'spare_parts'), spareData);
                            existingSpares.push({ id: newDoc.id, ...spareData } as SparePart);
                            importedSparesCount++;
                        }
                    }
                }
            }

            setImportStatus(null);
            setIsImportOpen(false);
            toast({ title: 'Migration Complete!', description: `Imported ${importedSparesCount} new parts and updated ${updatedSparesCount} existing parts with new VSD mappings!` });

        } catch (error) {
            console.error(error);
            setImportStatus(null);
            toast({ variant: 'destructive', title: 'Import Failed', description: 'There was an error processing the Excel file.' });
        }
        
        e.target.value = '';
    };

    const [isScanningPart, setIsScanningPart] = useState(false);
    const handleScanPart = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanningPart(true);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const imageDataUri = reader.result as string;
                const result = await scanSparePart({ imageDataUri });
                
                if (result.success) {
                    toast({ title: 'AI Scan Complete', description: 'Found part details in image.' });
                    
                    // Populate search query to immediately find it
                    if (result.oemPartNumber || result.rbmNumber) {
                        setSearchQuery(result.oemPartNumber || result.rbmNumber || '');
                    }

                    // Also pre-fill the form in case they want to add it
                    setForm(prev => ({
                        ...prev,
                        oemPartNumber: result.oemPartNumber || prev.oemPartNumber,
                        rbmNumber: result.rbmNumber || prev.rbmNumber,
                        name: result.name || prev.name,
                        type: result.type || prev.type,
                    }));
                } else {
                    toast({ variant: 'destructive', title: 'Scan Failed', description: result.error });
                }
                setIsScanningPart(false);
            };
            reader.onerror = () => {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to read image.' });
                setIsScanningPart(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Scan failed.' });
            setIsScanningPart(false);
        }
        
        // Reset input
        e.target.value = '';
    };



    // The 7 explicit headings requested by the user
    const userHeadings = [
        "GEGELEC",
        "Sami F",
        "ACS 600",
        "ACS 800",
        "ACS880",
        "Altistart",
        "Sinamics G130/150"
    ];

    // First group spares by their VSD Model, then bucket those Models into Super Categories
    const superCategories = React.useMemo(() => {
        const struct: Record<string, Record<string, SparePart[]>> = {};
        userHeadings.forEach(h => struct[h] = {});
        struct['Other'] = {};

        // Pre-populate ACS 600 subheadings as requested by the user
        const acs600Subheadings = [
            "ACS 607-120-6", "ACS 607-170-5", "ACS 607-210-6", "ACS 607-255-6",
            "ACS 607-260-6", "ACS 607-320-5", "ACS 607-320-6", "ACS 607-375-6",
            "ACS 607-400-6", "ACS 607-610-6", "ACS 607-760-5", "ACS 607-760-6",
            "ACS 607-1040-6", "ACS 607-1380-6", "ACS 607-1710-6", "ACS 607-2120-6"
        ];
        acs600Subheadings.forEach(sub => struct['ACS 600'][sub] = []);

        if (!filteredSpares) return struct;
        
        filteredSpares.forEach(spare => {
            if (!spare.compatibleModels || spare.compatibleModels.length === 0) {
                if (!struct['Other']['Uncategorized']) struct['Other']['Uncategorized'] = [];
                struct['Other']['Uncategorized'].push(spare);
            } else {
                spare.compatibleModels.forEach(model => {
                    // Find the right category by looking at our hardcoded ones first
                    let superCat = 'Other';
                    if (acs600Subheadings.includes(model)) superCat = 'ACS 600';
                    
                    if (!struct[superCat][model]) struct[superCat][model] = [];
                    struct[superCat][model].push(spare);
                });
            }
        });
        
        // Remove empty super categories for clean UI EXCEPT the 6 main ones
        Object.keys(struct).forEach(k => {
            if (Object.keys(struct[k]).length === 0 && !userHeadings.includes(k)) delete struct[k];
        });
        
        return struct;
    }, [filteredSpares]);

    // Map each VSD model to a list of divisions/locations where it is installed
    const modelLocations = React.useMemo(() => {
        if (!vsds || !equipment) return {};
        const mapping: Record<string, Set<string>> = {};
        
        vsds.forEach(vsd => {
            if (!vsd.model) return;
            const eq = equipment.find(e => e.id === vsd.equipmentId);
            if (eq) {
                const loc = eq.division || eq.plant || eq.location;
                if (loc) {
                    if (!mapping[vsd.model]) mapping[vsd.model] = new Set();
                    mapping[vsd.model].add(loc);
                }
            }
        });
    
        const result: Record<string, string> = {};
        for (const [model, locSet] of Object.entries(mapping)) {
            result[model] = Array.from(locSet).sort().join(', ');
        }
        return result;
    }, [vsds, equipment]);

    return (
        <div className="flex flex-col gap-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Spare Parts Inventory</h1>
                    <p className="text-muted-foreground">Manage VSD components, boards, IGBTs, and other electronic spares.</p>
                </div>
                <div className="flex gap-2">
                    <Label className="cursor-pointer">
                        <Button variant="secondary" className="gap-2" asChild disabled={isScanningPart}>
                            <span>
                                {isScanningPart ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                AI Scan Part
                            </span>
                        </Button>
                        <Input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanPart} disabled={isScanningPart} />
                    </Label>

                    {(user?.role === 'Admin' || user?.role === 'Superadmin') && (
                        <Button variant="outline" className="gap-2" onClick={async () => {
                            const confirmSeed = window.confirm("Seed ACS 607-2120-6 parts?");
                            if (!confirmSeed) return;
                            try {
                                const partsData = [
                                    { rbm: "8433033", oem: "10001773", type: "630A 1000-1250V 170M6205 Din 1", name: "Eaton Bussmann Class aR semiconductor protection fuse", rtbs: "41481087" },
                                    { rbm: "8433167", oem: "64015178", type: "NAMC-03 SP KIT AS1A", name: "Application and Motor Controller board", rtbs: "" },
                                    { rbm: "8433154", oem: "61487883", type: "NXPP-03 MD KIT", name: "Matching / Control Distribution Board", rtbs: "41472879" },
                                    { rbm: "8433131", oem: "10016771", type: "ES 500-9647 1000A+/-24V", name: "closed-loop current transducer.", rtbs: "41475174" },
                                    { rbm: "8433135", oem: "10030820", type: "D4E225-CC01-ZX(30) 230 VAC+ /- 10 %", name: "EBM Papst D4E225-CC01-30 centrifugal blower — the main cabinet cooling fan", rtbs: "41479201" },
                                    { rbm: "8433140", oem: "58920011", type: "NGDR-03 SP KIT", name: "Gate Circuit Card", rtbs: "41479203" },
                                    { rbm: "8433147", oem: "61433601", type: "NGPS - 11 MD KIT", name: "Gate Driver Power Supply Board", rtbs: "40624299" },
                                    { rbm: "8433217", oem: "61488049", type: "IGBT 180A MD R12 SP6 KIT", name: "IGBT Power Module Kit", rtbs: "" },
                                    { rbm: "8433216", oem: "61487981", type: "IGBT 180A MD R12 SP5 KIT", name: "IGBT Power Module Kit", rtbs: "" },
                                    { rbm: "8433155", oem: "61488006/64513605", type: "NINT-70 MD KIT/ NINT 73C MD KIT", name: "complete Phase Module Kit", rtbs: "41472886" },
                                    { rbm: "8433218", oem: "61512900", type: "PHASE MODULE ACN 64410456 - MD - KIT SP5", name: "complete Phase Module Kit", rtbs: "41479212" },
                                    { rbm: "8433219", oem: "61512918", type: "PHASE MODULE ACN 64410456 - MD - KIT SP6", name: "complete Phase Module Kit", rtbs: "41473250" },
                                    { rbm: "8433283", oem: "64422375", type: "PHASE MODULE ACN 64410456 - MD - KIT SPL6", name: "complete Phase Module Kit", rtbs: "41479218" },
                                    { rbm: "8433287", oem: "64422367", type: "PHASE MODULE ACN 64410456 - MD - KIT SPL5", name: "complete Phase Module Kit", rtbs: "41479219" },
                                    { rbm: "8433142", oem: "58976601", type: "NPOW-62 sp kit", name: "Power Supply Board", rtbs: "40624302" },
                                    { rbm: "8433146", oem: "61433503", type: "NPBU - 41 MD KIT", name: "PPCS (Parallel Control System) Branching Unit", rtbs: "41472819" },
                                    { rbm: "8433169", oem: "58919128", type: "NIOC-01 SP KIT", name: "I/O (Input/Output)", rtbs: "41484221" },
                                    { rbm: "8433141", oem: "58926451", type: "NRED-61 , 16328", name: "DC bus voltage divider resistor module", rtbs: "41484222" },
                                    { rbm: "8433161", oem: "61513485", type: "5SDD 51L2800 MD KIT", name: "hockey-puck rectifier diode", rtbs: "41475183" },
                                    { rbm: "8433149", oem: "61433635", type: "NDSC - 01 MD KIT", name: "DSU (Diode Supply Unit) Control Board", rtbs: "41472894" },
                                    { rbm: "8433156", oem: "61510524", type: "GR31M 2DK 3F2R 525-690V", name: "cooling fan assembly", rtbs: "41475179" },
                                    { rbm: "8433150", oem: "61434429", type: "AC POW -1 MD KIT", name: "Power Supply Board for the Diode Supply Unit (DSU", rtbs: "41472298" },
                                    { rbm: "8433190", oem: "61066859", type: "p33ab 3asd566301b1", name: "Pressure Switch", rtbs: "41475190" },
                                    { rbm: "8433136", oem: "10032636", type: "170M6149 1100A  1250V", name: "Eaton Bussmann Class aR semiconductor protection fuse", rtbs: "41472731" },
                                    { rbm: "8433133", oem: "10012139", type: "KTY 10-6-M4", name: "KTY84/100 silicon PTC temperature sensor with an M4 threaded connector", rtbs: "41475176" },
                                    { rbm: "8433162", oem: "61513515", type: "5STP 27L 1800 MD KIT", name: "Phase Control Thyristor (SCR)", rtbs: "41475184" },
                                    { rbm: "8433191", oem: "58919217", type: "NDNA module", name: "DeviceNet Adapter Module", rtbs: "41475191" },
                                    { rbm: "8433192", oem: "58919195", type: "NDIO module", name: "Digital I/O Extension Module", rtbs: "41472882" },
                                    { rbm: "8433220", oem: "58975931", type: "CDP 312", name: "Control Panel (Keypad + Display)", rtbs: "41482472" },
                                    { rbm: "8341596", oem: "", type: "ACS 600 - K-80 Relay Timer", name: "project-specific tag/label for a time-delay relay", rtbs: "41472462" }
                                ];
                                
                                let added = 0;
                                let updated = 0;
                                
                                const snap = await getDocs(collection(firestore, 'spare_parts'));
                                const existingSpares = snap.docs.map(d => ({ id: d.id, ...d.data() } as SparePart));

                                for (const p of partsData) {
                                    const existing = existingSpares.find(s => s.rbmNumber === p.rbm);
                                    if (existing) {
                                        if (!existing.compatibleModels?.includes("ACS 607-2120-6")) {
                                            await updateDoc(doc(firestore, 'spare_parts', existing.id), {
                                                compatibleModels: [...(existing.compatibleModels || []), "ACS 607-2120-6"],
                                                rtbsNumber: p.rtbs || existing.rtbsNumber // update RTBS if provided
                                            });
                                            updated++;
                                        }
                                    } else {
                                        await addDoc(collection(firestore, 'spare_parts'), {
                                            rbmNumber: p.rbm,
                                            rtbsNumber: p.rtbs,
                                            oemPartNumber: p.oem,
                                            name: p.name,
                                            type: p.type,
                                            manufacturer: "ABB",
                                            category: "Component",
                                            compatibleModels: ["ACS 607-2120-6"],
                                            stockLevel: 0,
                                            createdAt: serverTimestamp(),
                                            createdBy: user?.uid || "seed"
                                        });
                                        added++;
                                    }
                                }
                                toast({ title: "Seed Complete", description: `Added ${added} new parts, updated ${updated} existing parts for ACS 607-2120-6.` });
                            } catch (e: any) {
                                console.error(e);
                                toast({ variant: 'destructive', title: 'Error', description: e.message });
                            }
                        }}>
                            <FileUp className="h-4 w-4" /> Seed File
                        </Button>
                    )}

                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Part</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>Add New Spare Part</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                                {/* ... form fields ... */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>RBM Number</Label>
                                        <Input required value={form.rbmNumber} onChange={e => setForm({...form, rbmNumber: e.target.value})} placeholder="e.g. 41484221" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>RTBS Number</Label>
                                        <Input value={form.rtbsNumber} onChange={e => setForm({...form, rtbsNumber: e.target.value})} placeholder="e.g. RTBS 1234" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Name</Label>
                                        <Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. IGBT MODULE" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Type</Label>
                                        <Input required value={form.type} onChange={e => setForm({...form, type: e.target.value})} placeholder="e.g. FS450R17KE3" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>ABB / OEM Sparecode</Label>
                                    <Input value={form.oemPartNumber} onChange={e => setForm({...form, oemPartNumber: e.target.value})} placeholder="e.g. 68569591" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Manufacturer</Label>
                                        <Input required value={form.manufacturer} onChange={e => setForm({...form, manufacturer: e.target.value})} placeholder="e.g. ABB, Siemens" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Compatible VSD Models (Comma separated)</Label>
                                    <Input value={form.compatibleModels} onChange={e => setForm({...form, compatibleModels: e.target.value})} placeholder="e.g. ACS 800, ACS 607-1380-6" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Stock Level</Label>
                                        <Input type="number" min="0" value={form.stockLevel} onChange={e => setForm({...form, stockLevel: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Price / Value (Optional)</Label>
                                        <Input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Part'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            <div className="flex items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by part number, description, or VSD model..."
                        className="pl-8 bg-background"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : searchQuery.trim() !== '' ? (
                <div className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="pl-6">RBM No.</TableHead>
                                <TableHead>OEM Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Compatible Models</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                                <TableHead className="text-right pr-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSpares && filteredSpares.length > 0 ? filteredSpares.map(spare => (
                                <TableRow key={spare.id}>
                                    <TableCell className="pl-6 font-medium">{spare.rbmNumber}</TableCell>
                                    <TableCell>{spare.oemPartNumber}</TableCell>
                                    <TableCell className="max-w-xs">
                                        <div className="font-medium truncate" title={spare.name}>{spare.name}</div>
                                        <div className="text-xs text-muted-foreground truncate" title={spare.type}>{spare.type}</div>
                                    </TableCell>
                                    <TableCell className="max-w-xs">
                                        <div className="flex flex-wrap gap-1">
                                            {spare.compatibleModels?.map(m => (
                                                <span key={m} className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5 rounded border">
                                                    {m}
                                                </span>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">{spare.stockLevel}</TableCell>
                                    <TableCell className="text-right pr-6">
                                        {(user?.role === 'Admin' || user?.role === 'Superadmin') && (
                                            <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDelete(spare.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No matching parts found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            ) : Object.keys(superCategories).length > 0 ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="mb-4 flex flex-wrap h-auto bg-transparent border-b rounded-none p-0">
                        {Object.keys(superCategories).sort().map(cat => (
                            <TabsTrigger 
                                key={cat} 
                                value={cat}
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3"
                            >
                                {cat}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    
                    {Object.entries(superCategories).map(([cat, modelGroups]) => (
                        <TabsContent key={cat} value={cat}>
                            <Accordion type="multiple" className="w-full space-y-4">
                                {Object.entries(modelGroups).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([model, parts]) => (
                                    <AccordionItem key={model} value={model} className="border rounded-lg bg-card text-card-foreground shadow-sm">
                                        <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-slate-50/50">
                                            <div className="flex items-center gap-4 text-left">
                                                <h2 className="text-lg font-bold whitespace-nowrap">{model}</h2>
                                                <span className="bg-primary/10 text-primary text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                                                    {parts.length} {parts.length === 1 ? 'part' : 'parts'}
                                                </span>
                                                {modelLocations[model] && (
                                                    <span className="text-xs text-muted-foreground font-normal ml-2 hidden md:inline-block truncate">
                                                        (Installed at: {modelLocations[model]})
                                                    </span>
                                                )}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-0 pb-0">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead className="pl-6">RBM No.</TableHead>
                                                        <TableHead>RTBS No.</TableHead>
                                                        <TableHead>OEM Code</TableHead>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead>Type</TableHead>
                                                        <TableHead>Category</TableHead>
                                                        <TableHead className="text-right">Stock</TableHead>
                                                        <TableHead className="text-right pr-6">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {[...parts].sort((a, b) => a.rbmNumber.localeCompare(b.rbmNumber, undefined, { numeric: true })).map(spare => (
                                                        <TableRow key={spare.id}>
                                                            <TableCell className="pl-6 font-medium">{spare.rbmNumber}</TableCell>
                                                            <TableCell>{spare.rtbsNumber}</TableCell>
                                                            <TableCell>{spare.oemPartNumber}</TableCell>
                                                            <TableCell className="max-w-xs truncate" title={spare.name}>{spare.name}</TableCell>
                                                            <TableCell className="max-w-xs truncate" title={spare.type}>{spare.type}</TableCell>
                                                            <TableCell>{spare.category}</TableCell>
                                                            <TableCell className="text-right font-medium">{spare.stockLevel}</TableCell>
                                                            <TableCell className="text-right pr-6">
                                                                {(user?.role === 'Admin' || user?.role === 'Superadmin') && (
                                                                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDelete(spare.id)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </TabsContent>
                    ))}
                </Tabs>
            ) : (
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                    No spare parts found.
                </div>
            )}
        </div>
    );
}
