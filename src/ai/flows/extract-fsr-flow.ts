'use server';
/**
 * @fileOverview AI flow for extracting structured data from digital PDF Field Service Reports (AG-FSR-001).
 * 
 * - extractFsrData - Handles PDF parsing and structured extraction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const FsrScanInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A PDF scan or photo of a paper Field Service Report, as a data URI. Expected format: 'data:<mimeType>;base64,<encoded_data>'."
    ),
});
export type FsrScanInput = z.infer<typeof FsrScanInputSchema>;

export const FsrScanOutputSchema = z.object({
  error: z.string().optional().describe('Error code if the document is illegible.'),
  date: z.string().optional().describe('Date in YYYY-MM-DD format'),
  customer: z.string().optional(),
  site: z.string().optional(),
  poNumber: z.string().optional(),
  serviceEntryNo: z.string().optional(),
  contactPerson: z.string().optional(),
  contactNumber: z.string().optional(),
  city: z.string().optional(),
  email: z.string().optional(),
  assetName: z.string().optional(),
  tagNo: z.string().optional(),
  serialNo: z.string().optional(),
  location: z.string().optional(),
  oem: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  rating: z.string().optional(),
  timeCallOut: z.string().optional().describe('Time in HH:mm format'),
  timeArrival: z.string().optional().describe('Time in HH:mm format'),
  timeStart: z.string().optional().describe('Time in HH:mm format'),
  timeEnd: z.string().optional().describe('Time in HH:mm format'),
  timeDeparture: z.string().optional().describe('Time in HH:mm format'),
  ntHours: z.number().optional(),
  otHours: z.number().optional(),
  dtHours: z.number().optional(),
  travelKmTo: z.number().optional(),
  travelKmReturn: z.number().optional(),
  customerFault: z.string().optional(),
  techFindings: z.string().optional(),
  rca: z.string().optional(),
  correctiveActions: z.string().optional(),
  recommendations: z.string().optional(),
  parts: z.array(z.object({
    partNo: z.string().optional(),
    description: z.string().optional(),
    qty: z.number().optional(),
    unit: z.string().optional(),
    suppliedBy: z.string().optional(),
  })).optional(),
  personnel: z.array(z.object({
    name: z.string().optional(),
    role: z.string().optional(),
    hrs: z.number().optional(),
  })).optional(),
});
export type FsrScanOutput = z.infer<typeof FsrScanOutputSchema>;

export async function extractFsrData(input: FsrScanInput): Promise<FsrScanOutput> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return { error: 'Google AI API key is missing. Please configure GOOGLE_GENAI_API_KEY in your environment.' };
  }

  // Parse data URI
  const matches = input.documentDataUri?.match(/^data:([^;]+);base64,(.+)$/s);
  if (!matches) {
    try {
      return await extractFsrFlow(input);
    } catch (e: any) {
      return { error: e.message || 'Failed to process document data.' };
    }
  }

  let mimeType = matches[1]?.toLowerCase() || 'application/pdf';
  const base64Data = matches[2];
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch (err: any) {
    return { error: 'Corrupt or invalid document data received.' };
  }

  if (buffer.length === 0) {
    return { error: 'The uploaded file is empty (0 bytes). Please upload a valid document.' };
  }

  // Auto-detect real MIME type if generic or mismatched
  if (!mimeType || mimeType === 'application/octet-stream') {
    if (buffer.subarray(0, 4).toString() === '%PDF') {
      mimeType = 'application/pdf';
    } else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      mimeType = 'image/jpeg';
    } else if (buffer.subarray(0, 4).toString('hex') === '89504e47') {
      mimeType = 'image/png';
    } else if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') {
      mimeType = 'image/webp';
    } else {
      mimeType = 'application/pdf';
    }
  }

  // Use GoogleAIFileManager to eliminate inlineData payload size constraints and prevent 400 Bad Request
  const ext = mimeType === 'application/pdf' ? '.pdf' : mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : '.tmp';
  const tempFile = path.join(os.tmpdir(), `fsr-scan-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  
  let fileManager: GoogleAIFileManager | null = null;
  let uploadResponse: any = null;

  try {
    fs.writeFileSync(tempFile, buffer);
    fileManager = new GoogleAIFileManager(apiKey);
    const genAI = new GoogleGenerativeAI(apiKey);

    uploadResponse = await fileManager.uploadFile(tempFile, {
      mimeType,
      displayName: `fsr-scan-${Date.now()}`,
    });

    const promptText = `You are an expert industrial data entry specialist. Analyze the provided Field Service Report (AG-FSR-001) document or scan.
  
CRITICAL QUALITY CHECK:
If the scanned document is too blurry, illegible, or incomplete to extract data reliably, return exactly: { "error": "DOCUMENT_UNCLEAR" }.

Otherwise, extract all handwritten and printed information into structured JSON format with this structure:
{
  "date": "YYYY-MM-DD",
  "customer": "Customer Name",
  "site": "Site/Plant Name",
  "poNumber": "PO or Contract No",
  "serviceEntryNo": "Service Entry No",
  "contactPerson": "Contact Person",
  "contactNumber": "Contact Number",
  "city": "City",
  "email": "Email",
  "assetName": "Equipment/Asset Name",
  "tagNo": "Tag No",
  "serialNo": "Serial No",
  "location": "Location",
  "oem": "Manufacturer / OEM",
  "model": "Model",
  "year": "Year",
  "rating": "Rating / Capacity",
  "timeCallOut": "HH:mm",
  "timeArrival": "HH:mm",
  "timeStart": "HH:mm",
  "timeEnd": "HH:mm",
  "timeDeparture": "HH:mm",
  "otHours": 0,
  "travelKmTo": 0,
  "travelKmReturn": 0,
  "customerFault": "Customer Reported Fault",
  "techFindings": "Findings & Observations",
  "rca": "Root Cause Analysis",
  "correctiveActions": "Corrective Actions & Repairs",
  "recommendations": "Recommendations",
  "parts": [
    {
      "partNo": "Part No",
      "description": "Description",
      "qty": 1,
      "unit": "Unit",
      "suppliedBy": "Client/Altek"
    }
  ],
  "personnel": [
    {
      "name": "Tech Name",
      "role": "Role",
      "hrs": 8
    }
  ]
}

Key Guidelines:
1. CUSTOMER INFO: Extract name, site, and PO number.
2. EQUIPMENT: Extract asset name, serial numbers, and technical ratings.
3. TIMES: Extract the duty times (Callout, Arrival, Start, End, Departure). Ensure format is HH:mm.
4. LABOUR & TRAVEL: Extract OT hours and Kilometers.
5. TECHNICAL: Synthesize the fault, findings, root cause (RCA), and corrective actions.
6. TABLES: Extract all line items from the 'Parts & Materials' and 'Personnel' tables.

Omit blank or non-existent fields. Return ONLY valid JSON.`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
    let lastErr: any = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        });

        const result = await model.generateContent([
          {
            fileData: {
              mimeType: uploadResponse.file.mimeType,
              fileUri: uploadResponse.file.uri,
            },
          },
          { text: promptText },
        ]);

        let text = result.response.text().trim();
        if (text.startsWith('```json')) {
          text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (text.startsWith('```')) {
          text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        const parsed = JSON.parse(text);
        return parsed as FsrScanOutput;
      } catch (err: any) {
        lastErr = err;
        console.warn(`Model ${modelName} extraction attempt error:`, err.message);
      }
    }
    throw lastErr;
  } catch (fileApiErr: any) {
    console.warn('File API attempt failed, attempting fallback to Genkit flow:', fileApiErr?.message);
    try {
      return await extractFsrFlow(input);
    } catch (genkitErr: any) {
      console.error('All extraction attempts failed:', genkitErr);
      const rawMsg = genkitErr?.message || fileApiErr?.message || '';
      if (rawMsg.includes('INVALID_ARGUMENT') || rawMsg.includes('400')) {
        return {
          error: 'The uploaded file could not be parsed by the AI. Please verify that the PDF or image is not corrupted, password-protected, and is under 25MB.',
        };
      }
      return {
        error: genkitErr?.message || fileApiErr?.message || 'An unknown error occurred during document extraction.',
      };
    }
  } finally {
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }
    if (fileManager && uploadResponse?.file?.name) {
      try { await fileManager.deleteFile(uploadResponse.file.name); } catch (e) {}
    }
  }
}

const prompt = ai.definePrompt({
  name: 'extractFsrPrompt',
  model: 'googleai/gemini-3.8-flash',
  input: { schema: FsrScanInputSchema },
  output: { schema: FsrScanOutputSchema },
  prompt: `You are an expert industrial data entry specialist. Analyze the provided PDF scan of an AG-FSR-001 Field Service Report.
  
CRITICAL QUALITY CHECK:
If the scanned PDF is too blurry, illegible, or incomplete to extract data reliably, return exactly { "error": "DOCUMENT_UNCLEAR" }.

Otherwise, extract all handwritten and printed information into a structured JSON format. 

Key Guidelines:
1. CUSTOMER INFO: Extract name, site, and PO number.
2. EQUIPMENT: Extract asset name, serial numbers, and technical ratings.
3. TIMES: Extract the duty times (Callout, Arrival, Start, End, Departure). Ensure format is HH:mm.
4. LABOUR & TRAVEL: Extract NT/OT/DT hours and Kilometers.
5. TECHNICAL: Synthesize the fault, findings, root cause (RCA), and corrective actions.
6. TABLES: Extract all line items from the 'Parts & Materials' and 'Personnel' tables.

If a field is blank, omit it. Do not hallucinate data.

FSR PDF Document: {{media url=documentDataUri}}`,
});

const extractFsrFlow = ai.defineFlow(
  {
    name: 'extractFsrFlow',
    inputSchema: FsrScanInputSchema,
    outputSchema: FsrScanOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("AI failed to process the PDF document.");
    return output;
  }
);

