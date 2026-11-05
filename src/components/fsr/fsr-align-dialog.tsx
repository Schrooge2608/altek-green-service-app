'use client';

import React, { useState, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { 
  Wrench, 
  Loader2, 
  CheckCircle2, 
  ArrowRight, 
  AlertTriangle, 
  RefreshCw,
  FileText
} from 'lucide-react';
import { 
  planFsrAlignment, 
  migrateSingleFsrDocument, 
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
  const [progress, setProgress] = useState<{ current: number; total: number; activeItem?: string } | null>(null);
  const [migratedCount, setMigratedCount] = useState<number | null>(null);

  // Scan and load unaligned documents when dialog opens
  const loadPlan = async () => {
    if (!firestore) return;
    setIsLoadingPlan(true);
    setMigratedCount(null);
    setProgress(null);
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

  const handleExecuteMigration = async () => {
    if (!firestore || alignmentItems.length === 0) return;

    setIsMigrating(true);
    setProgress({ current: 0, total: alignmentItems.length });
    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < alignmentItems.length; i++) {
      const item = alignmentItems[i];
      setProgress({
        current: i + 1,
        total: alignmentItems.length,
        activeItem: `${item.oldId} ➔ ${item.targetId}`,
      });

      try {
        await migrateSingleFsrDocument(firestore, item.oldId, item.targetId, item.rawDocData);
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
        description: `Migrated ${successCount} documents so their Firestore document key matches their FSR number.`,
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
                Converts documents with random 20-character auto-IDs (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">HO2BXUgSf...</code>) into clean document keys (e.g. <code className="bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded text-[11px] font-mono font-bold">FSR-0022</code>) matching the actual FSR number.
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
                    Clicking <strong>&ldquo;Execute Alignment&rdquo;</strong> will move each document to its clean <code className="font-mono font-bold">FSR-XXXX</code> document key, update the internal ID, and delete the random 20-character document.
                  </p>
                </div>
              </div>

              {/* Items Preview Table */}
              <div className="border rounded-lg overflow-hidden shadow-xs">
                <div className="bg-slate-100 px-3 py-2 border-b flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Documents to be Migrated ({alignmentItems.length})</span>
                  <Badge variant="outline" className="bg-white text-[11px] font-normal">
                    Safe Non-Destructive Copy
                  </Badge>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {alignmentItems.map((item) => (
                    <div
                      key={item.oldId}
                      className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-900">
                            {item.customer} • {item.assetName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          <span>Date: {item.date}</span>
                          <span className="mx-2">•</span>
                          <span>Current Ref: <strong>{item.currentReference}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                        <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 line-through">
                          {item.oldId.slice(0, 10)}...
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                        <span className="bg-emerald-100 text-emerald-900 font-bold px-2.5 py-0.5 rounded border border-emerald-300">
                          {item.targetId}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
