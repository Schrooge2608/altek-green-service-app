'use server';
/**
 * @fileOverview AI flow for extracting structured data from digital PDF Field Service Reports (AG-FSR-001).
 * 
 * - extractFsrData - Handles PDF parsing and structured extraction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const FsrScanInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A PDF scan of a paper Field Service Report, as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type FsrScanInput = z.infer<typeof FsrScanInputSchema>;

const FsrScanOutputSchema = z.object({
  error: z.string().optional().describe('Error code if the document is illegible.'),
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
  try {
    return await extractFsrFlow(input);
  } catch (e: any) {
    console.error('extractFsrData error:', e);
    return { error: e.message || 'An unknown error occurred on the server.' };
  }
}

const prompt = ai.definePrompt({
  name: 'extractFsrPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: FsrScanInputSchema },
  output: { schema: FsrScanOutputSchema },
  config: {
    temperature: 0.1,
  },
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
