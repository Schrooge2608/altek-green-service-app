'use client';
import React, { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function DebugEquipmentPage() {
  const firestore = useFirestore();
  const eqQuery = useMemoFirebase(() => query(collection(firestore, 'equipment'), orderBy('name')), [firestore]);
  const { data: equipmentList, isLoading } = useCollection<any>(eqQuery);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = equipmentList?.filter(eq => 
    !searchTerm || 
    eq.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.mcc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.location?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY delete ghost equipment: ${name}?`)) return;
    try {
      await deleteDoc(doc(firestore, 'equipment', id));
      toast({ title: 'Deleted', description: `${name} has been removed.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Ghost Equipment Hunter</h1>
          <p className="text-muted-foreground">
            This temporary page shows EVERY single piece of equipment in your entire database across all plants and locations. 
            Use it to hunt down and delete duplicates.
          </p>
        </div>
      </div>

      <Input 
        placeholder="Search for 'Dredge 1 Ladder Winch' or 'RWBS'..." 
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <p>Loading database...</p>
      ) : (
        <div className="border rounded-md shadow-sm bg-white overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Equipment Name</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">MCC</th>
                <th className="px-6 py-4">Plant</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(eq => {
                const prefix = eq.mcc || eq.location || eq.division || '';
                const dropdownLabel = prefix ? `${prefix} - ${eq.name}` : eq.name;
                
                return (
                  <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{eq.name}</div>
                      <div className="text-xs text-gray-400 font-mono mt-1">ID: {eq.id}</div>
                      <div className="text-xs text-blue-500 mt-1">Dropdown Label: {dropdownLabel}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{eq.location || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{eq.mcc || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{eq.plant || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDelete(eq.id, dropdownLabel)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
              
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No equipment found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
