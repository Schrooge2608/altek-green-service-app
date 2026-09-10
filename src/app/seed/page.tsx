'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { processHistoricalData } from '@/ai/flows/process-historical-data-flow';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, setDoc, doc, serverTimestamp, where } from 'firebase/firestore';

export default function SeedPage() {
    const { firestore } = useFirebase();
    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [workbookData, setWorkbookData] = useState<Record<string, string[][]>>({});
    const [rawRows, setRawRows] = useState<string[]>([]);
    const [offset, setOffset] = useState<number>(0);
    const [limit, setLimit] = useState<number>(10);
    const [structuredData, setStructuredData] = useState<any | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<string>('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
            readExcel(selected);
        }
    };

    const readExcel = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            
            const parsedData: Record<string, string[][]> = {};
            workbook.SheetNames.forEach(name => {
                parsedData[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });
            });
            
            setSheets(workbook.SheetNames);
            setWorkbookData(parsedData);
            
            const defaultSheet = workbook.SheetNames.length > 3 ? workbook.SheetNames[3] : workbook.SheetNames[0];
            
            // Auto-detect offset by looking for a row starting with '1'
            let detectedOffset = 0;
            const json = parsedData[defaultSheet] || [];
            const rowsAsStrings = json.map(row => row.join(' | '));
            const startIdx = rowsAsStrings.findIndex(row => row.trim().startsWith('1 |'));
            if (startIdx !== -1) {
                detectedOffset = startIdx;
                setOffset(startIdx);
            }

            selectSheet(defaultSheet, parsedData, detectedOffset, limit);
        };
        reader.readAsBinaryString(file);
    };

    const selectSheet = (sheetName: string, data = workbookData, currentOffset = offset, currentLimit = limit) => {
        setSelectedSheet(sheetName);
        const json = data[sheetName] || [];
        const rowsAsStrings = json
            .map(row => row.join(' | '))
            .filter(row => row.trim().length > 0);
        
        const chunk = rowsAsStrings.slice(currentOffset, currentOffset + currentLimit);
        setRawRows(chunk);
        setStatus(`Showing ${chunk.length} rows (from row ${currentOffset + 1}) in sheet: ${sheetName}`);
    };

    // Re-run slicing when offset or limit changes
    React.useEffect(() => {
        if (selectedSheet && workbookData[selectedSheet]) {
            selectSheet(selectedSheet, workbookData, offset, limit);
        }
    }, [offset, limit]);

    const handleProcess = async () => {
        if (rawRows.length === 0) return;
        setIsProcessing(true);
        setStatus('Sending to AI for processing...');
        try {
            const result = await processHistoricalData({ rows: rawRows, defaultType: 'FSR' });
            if ('error' in result) {
                setStatus(`AI Error: ${result.error}`);
            } else {
                setStructuredData(result);
                setStatus('AI Processing Complete! Review the data below.');
            }
        } catch (error: any) {
            setStatus(`Error: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const getNextFsrId = async () => {
        const q = query(collection(firestore, 'field_service_reports'), where('id', '>=', 'FSR-000'), where('id', '<=', 'FSR-9999'));
        const snapshot = await getDocs(q);
        const validNumbers = snapshot.docs
            .map(d => parseInt(d.data().id.replace('FSR-', ''), 10))
            .filter(n => !isNaN(n));
        
        let nextNumber = 1;
        if (validNumbers.length > 0) {
            nextNumber = Math.max(...validNumbers) + 1;
        }
        return nextNumber;
    };

    const handleSave = async () => {
        if (!structuredData || !structuredData.fsrs) return;
        setIsSaving(true);
        setStatus('Saving to Firestore...');
        try {
            let nextIdNumber = await getNextFsrId();

            for (const fsr of structuredData.fsrs) {
                const idString = `FSR-${String(nextIdNumber).padStart(3, '0')}`;
                
                const finalData = {
                    ...fsr,
                    id: idString,
                    version: 'v2',
                    isFinalised: true,
                    isSignedOff: true,
                    createdAt: serverTimestamp(),
                };

                await setDoc(doc(firestore, 'field_service_reports', idString), finalData);
                nextIdNumber++;
            }
            setStatus('Successfully saved all records to live database!');
            setStructuredData(null);
            setRawRows([]);
        } catch (error: any) {
            setStatus(`Save Error: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto flex flex-col gap-6">
            <h1 className="text-2xl font-bold">Historical Data Bulk Upload (Temporary)</h1>
            <p className="text-gray-600">This page is for seeding data from Excel locally. Uploading will save directly to your live Firebase database.</p>
            
            <div className="border p-4 rounded-md flex flex-col gap-4">
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
                
                {sheets.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold">Select Sheet:</label>
                        <select 
                            className="border p-2 rounded-md" 
                            value={selectedSheet} 
                            onChange={(e) => setSelectedSheet(e.target.value)}
                        >
                            {sheets.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        
                        <div className="flex gap-4 mt-2">
                            <div className="flex flex-col flex-1">
                                <label className="text-sm font-semibold">Skip Rows (Offset):</label>
                                <input 
                                    type="number" 
                                    className="border p-2 rounded-md" 
                                    value={offset} 
                                    onChange={(e) => setOffset(parseInt(e.target.value) || 0)} 
                                />
                            </div>
                            <div className="flex flex-col flex-1">
                                <label className="text-sm font-semibold">Number of Rows to Process:</label>
                                <input 
                                    type="number" 
                                    className="border p-2 rounded-md" 
                                    value={limit} 
                                    onChange={(e) => setLimit(parseInt(e.target.value) || 10)} 
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {status && (
                <div className="p-4 bg-blue-100 text-blue-800 rounded-md font-medium">
                    {status}
                </div>
            )}

            {rawRows.length > 0 && (
                <div className="border p-4 rounded-md">
                    <h2 className="text-xl font-bold mb-2">Raw Rows to Process (First 10)</h2>
                    <ul className="list-disc pl-5">
                        {rawRows.map((row, i) => (
                            <li key={i} className="text-sm">{row}</li>
                        ))}
                    </ul>
                    <Button onClick={handleProcess} disabled={isProcessing} className="mt-4">
                        {isProcessing ? 'Processing with AI...' : 'Process with AI'}
                    </Button>
                </div>
            )}

            {structuredData && (
                <div className="border p-4 rounded-md">
                    <h2 className="text-xl font-bold mb-4">AI Extraction Results</h2>
                    
                    <div className="flex flex-col gap-4 mb-4 max-h-[500px] overflow-auto">
                        {structuredData.fsrs?.map((fsr: any, idx: number) => (
                            <div key={idx} className="p-4 border rounded bg-white shadow-sm">
                                <h3 className="font-bold text-lg mb-2">
                                    FSR for {fsr.date || 'Unknown Date'} - {fsr.location || fsr.site || 'Unknown Site'}
                                </h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><span className="font-semibold">Personnel:</span> {fsr.personnel?.map((p:any)=>p.name).join(', ') || 'N/A'}</div>
                                    <div><span className="font-semibold">Asset:</span> {fsr.assetName || fsr.model || 'N/A'}</div>
                                    <div><span className="font-semibold">Fault:</span> {fsr.customerFault || 'N/A'}</div>
                                    <div><span className="font-semibold">Action Taken:</span> {fsr.correctiveActions || fsr.techFindings || 'N/A'}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Button onClick={handleSave} disabled={isSaving} className="mt-4 bg-green-600 hover:bg-green-700 w-full py-6 text-lg">
                        {isSaving ? 'Saving to Database...' : 'Approve & Save to Database'}
                    </Button>
                </div>
            )}
        </div>
    );
}
