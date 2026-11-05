'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { 
  Wrench, 
  Loader2, 
  CheckCircle2, 
  ArrowRight, 
  AlertTriangle, 
  RefreshCw,
  FileText,
  Search,
  Check
} from 'lucide-react';
import { 
  planFsrAlignment, 
  migrateSingleFsrDocument, 
  normalizeFsrId,
  type FsrAlignmentPlanItem 
} from '@/lib/fsr-id-utils';

interface FsrAlignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function FsrAlignDialog({ open, onOpenChange, onSuccess }: FsrAlignDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [alignmentItems, setAlignmentItems] = useState<FsrAlignmentPlanItem[]>([]);
  const [filterSearch, setFilterSearch] = useState('');
  const [progress, setProgress] = useState<{ current: number; total: number; activeItem?: string } | null>(null);
  const [migratedCount, setMigratedCount] = useState<number | null>(null);

  // Scan and load unaligned documents when dialog opens
  const loadPlan = async () => {
    if (!firestore) return;
    setIsLoadingPlan(true);
    setMigratedCount(null);
    setProgress(null);
    setFilterSearch('');
    try {
      const items = await planFsrAlignment(firestore);
      setAlignmentItems(items);
    } catch (e: any) {
      console.error('Error scanning FSR IDs:', e);
      toast({
        variant: 'destructive',
        title: 'Scan Failed',
        description: e.message || 'Could not scan FSR documents in Firestore.',
      });
    } finally {
      setIsLoadingPlan(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadPlan();
    }
  }, [open, firestore]);

  const handleUpdateTargetId = (oldId: string, newTargetId: string) => {
    setAlignmentItems(prev => prev.map(item => {
      if (item.oldId === oldId) {
        return {
          ...item,
          targetId: newTargetId,
          isExactMatch: normalizeFsrId(item.currentReference)?.toUpperCase() === newTargetId.trim().toUpperCase(),
        };
      }
      return item;
    }));
  };

  const filteredItems = useMemo(() => {
    if (!filterSearch.trim()) return alignmentItems;
    const q = filterSearch.toLowerCase().trim();
    return alignmentItems.filter(item => 
      item.currentReference?.toLowerCase().includes(q) ||
      item.targetId.toLowerCase().includes(q) ||
      item.customer?.toLowerCase().includes(q) ||
      item.assetName?.toLowerCase().includes(q) ||
      item.oldId.toLowerCase().includes(q)
    );
  }, [alignmentItems, filterSearch]);

  // Check for duplicate target IDs
  const duplicateTargetIds = useMemo(() => {
    const counts = new Map<string, number>();
    alignmentItems.forEach(item => {
      const tid = item.targetId.trim().toUpperCase();
      counts.set(tid, (counts.get(tid) || 0) + 1);
    });
    const dupes = new Set<string>();
    counts.forEach((count, tid) => {
      if (count > 1) dupes.add(tid);
    });
    return dupes;
  }, [alignmentItems]);

  const handleExecuteMigration = async () => {
    if (!firestore || alignmentItems.length === 0) return;

    if (duplicateTargetIds.size > 0) {
      toast({
        variant: 'destructive',
        title: 'Duplicate Target IDs Detected',
        description: `Multiple documents share the same target ID: ${Array.from(duplicateTargetIds).join(', ')}. Please assign unique IDs before proceeding.`,
      });
      return;
    }

    setIsMigrating(true);
    setProgress({ current: 0, total: alignmentItems.length });
    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < alignmentItems.length; i++) {
      const item = alignmentItems[i];
      const finalTargetId = normalizeFsrId(item.targetId) || item.targetId.trim();
      
      setProgress({
        current: i + 1,
        total: alignmentItems.length,
        activeItem: `${item.oldId} ➔ ${finalTargetId}`,
      });

      try {
        await migrateSingleFsrDocument(firestore, item.oldId, finalTargetId, item.rawDocData);
        successCount++;
      } catch (err: any) {
        console.error(`Failed to migrate ${item.oldId}:`, err);
        errors.push(`${item.oldId}: ${err.message}`);
      }
    }

    setIsMigrating(false);
    setMigratedCount(successCount);
    setAlignmentItems([]);

    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Alignment Finished with Warnings',
        description: `Successfully aligned ${successCount} FSRs, but ${errors.length} failed.`,
      });
    } else {
      toast({
        title: 'All FSR IDs Successfully Aligned!',
        description: `Migrated ${successCount} documents so their Firestore document keys match their FSR numbers.`,
      });
    }

    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-700">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Align FSR Document IDs with FSR Numbers
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 mt-1">
                Converts documents with random 20-character auto-IDs into clean document keys (e.g. <code className="bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded text-[11px] font-mono font-bold">FSR-0190</code>) matching the actual FSR number.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {isLoadingPlan ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              <p className="text-sm font-medium">Scanning Firestore for unaligned FSR document IDs...</p>
            </div>
          ) : isMigrating ? (
            <div className="py-16 flex flex-col items-center justify-center gap-4 text-center px-6">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  Aligning Document IDs ({progress?.current} of {progress?.total})...
                </h4>
                <p className="text-xs text-slate-600 font-mono">
                  {progress?.activeItem}
                </p>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 max-w-md overflow-hidden">
                <div
                  className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${progress ? Math.round((progress.current / progress.total) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Copying data to clean FSR-XXXX keys and removing temporary auto-IDs. Please keep this window open.
              </p>
            </div>
          ) : migratedCount !== null ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3 bg-emerald-50/50 rounded-xl border border-emerald-200 p-6">
              <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-lg font-bold text-emerald-950">
                Migration Complete!
              </h3>
              <p className="text-xs text-emerald-800 max-w-md">
                Successfully aligned <strong>{migratedCount}</strong> Field Service Report documents. In your Firestore console, every document key now matches its actual <code className="font-mono font-bold">FSR-XXXX</code> reference.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="mt-2 bg-white text-xs border-emerald-300 text-emerald-900 hover:bg-emerald-50"
              >
                Close Window
              </Button>
            </div>
          ) : alignmentItems.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3 bg-slate-50 rounded-xl border border-slate-200 p-6">
              <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                All FSR Document IDs Are Already Clean!
              </h4>
              <p className="text-xs text-slate-600 max-w-md">
                No random auto-generated IDs were found in Firestore. Every document in <code className="font-mono font-semibold">field_service_reports</code> already matches its clean <code className="font-mono font-bold text-emerald-700">FSR-XXXX</code> number.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPlan}
                className="mt-2 text-xs bg-white border-slate-300"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Re-Scan Firestore
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-semibold">
                    Found {alignmentItems.length} FSR document{alignmentItems.length > 1 ? 's' : ''} with random Firestore auto-IDs.
                  </p>
                  <p className="text-amber-800 leading-normal">
                    Each document&apos;s clean <code className="font-mono font-bold">FSR-XXXX</code> key has been pre-matched directly to its actual report reference (e.g. <strong className="font-mono text-emerald-800">FSR-0190</strong>). You can also edit any target ID manually if needed.
                  </p>
                </div>
              </div>

              {/* Items Preview Table */}
              <div className="border rounded-lg overflow-hidden shadow-xs">
                <div className="bg-slate-100 px-3 py-2 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-slate-800">
                  <div className="flex items-center gap-2">
                    <span>Documents to be Migrated ({filteredItems.length} of {alignmentItems.length})</span>
                    <Badge variant="outline" className="bg-white text-[11px] font-normal text-slate-600">
                      Preserves Report Reference
                    </Badge>
                  </div>
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Filter by ref, asset, customer..."
                      value={filterSearch}
                      onChange={e => setFilterSearch(e.target.value)}
                      className="h-7 text-xs pl-8 bg-white"
                    />
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const isDupe = duplicateTargetIds.has(item.targetId.trim().toUpperCase());
                    return (
                      <div
                        key={item.oldId}
                        className={`p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                          isDupe ? 'bg-red-50/70' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-900 truncate">
                              {item.customer} • {item.assetName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                            <span>Date: {item.date}</span>
                            <span>•</span>
                            <span>Current Ref: <strong className="text-slate-800 font-mono">{item.currentReference}</strong></span>
                            {item.isExactMatch && (
                              <span className="inline-flex items-center text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-medium border border-emerald-200">
                                <Check className="h-3 w-3 mr-0.5" /> Matches Ref
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                          <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 line-through text-[10px]" title={item.oldId}>
                            {item.oldId.slice(0, 10)}...
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                          <div className="flex items-center gap-1">
                            <Input
                              value={item.targetId}
                              onChange={(e) => handleUpdateTargetId(item.oldId, e.target.value)}
                              className={`h-7 w-28 text-xs font-mono font-bold text-center px-1.5 py-0.5 ${
                                isDupe 
                                  ? 'border-red-500 bg-red-100 text-red-900 focus-visible:ring-red-400' 
                                  : 'border-emerald-300 bg-emerald-50 text-emerald-900 focus-visible:ring-emerald-400'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {duplicateTargetIds.size > 0 && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>
                    Duplicate target IDs detected ({Array.from(duplicateTargetIds).join(', ')}). Please ensure each target ID is unique.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t pt-3 flex flex-row items-center justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isMigrating}
            onClick={() => onOpenChange(false)}
            className="text-xs text-slate-600"
          >
            Cancel
          </Button>

          {alignmentItems.length > 0 && !isMigrating && migratedCount === null && (
            <Button
              type="button"
              size="sm"
              disabled={duplicateTargetIds.size > 0}
              onClick={handleExecuteMigration}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
            >
              <Wrench className="mr-1.5 h-3.5 w-3.5" />
              Execute Alignment ({alignmentItems.length} Reports)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
