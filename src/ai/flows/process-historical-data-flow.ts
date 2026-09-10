'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const FsrScanOutputSchema = z.object({
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

const DailyDiaryScanOutputSchema = z.object({
  error: z.string().optional().describe('Error code if the document is illegible.'),
  diaryReference: z.string().optional(),
  contractTitle: z.string().optional(),
  contractNumber: z.string().optional(),
  workType: z.enum(['Normal', 'Callout']).optional(),
  purchaseOrderNumber: z.string().optional(),
  quotationNumber: z.string().optional(),
  area: z.enum(['Mining', 'Smelter']).optional(),
  date: z.string().optional().describe('Date in YYYY-MM-DD format'),
  shiftStart: z.string().optional().describe('Time in HH:mm format'),
  shiftEnd: z.string().optional().describe('Time in HH:mm format'),
  hrs: z.number().optional(),
  incidents: z.string().optional(),
  toolboxTalk: z.string().optional(),
  manpower: z.array(z.object({
    designation: z.string().optional(),
    forecast: z.number().optional(),
    actual: z.number().optional(),
    normalHrs: z.number().optional(),
    overtime1_5: z.number().optional(),
    overtime2_0: z.number().optional(),
    totalManHrs: z.number().optional(),
    comments: z.string().optional(),
  })).optional(),
  plant: z.array(z.object({
    description: z.string().optional(),
    qty: z.number().optional(),
    inspectionDone: z.enum(['yes', 'no', 'n/a']).optional(),
    comments: z.string().optional(),
  })).optional(),
  works: z.array(z.object({
    area: z.string().optional(),
    scope: z.string().optional(),
    timeStart: z.string().optional().describe('Time in HH:mm format'),
    timeEnd: z.string().optional().describe('Time in HH:mm format'),
    hrs: z.number().optional(),
  })).optional(),
  delays: z.array(z.string()).optional(),
  comments: z.array(z.string()).optional(),
});

const ProcessHistoricalDataInputSchema = z.object({
  rows: z.array(z.string()).describe("Array of text rows extracted from an Excel spreadsheet representing historical WhatsApp data."),
  defaultType: z.enum(['FSR', 'DIARY', 'AUTO']).default('AUTO'),
});

const ProcessHistoricalDataOutputSchema = z.object({
  fsrs: z.array(FsrScanOutputSchema).default([]),
  diaries: z.array(DailyDiaryScanOutputSchema).default([]),
});

export type ProcessHistoricalDataInput = z.infer<typeof ProcessHistoricalDataInputSchema>;
export type ProcessHistoricalDataOutput = z.infer<typeof ProcessHistoricalDataOutputSchema>;

export async function processHistoricalData(input: ProcessHistoricalDataInput): Promise<ProcessHistoricalDataOutput | { error: string }> {
  try {
    return await processHistoricalDataFlow(input);
  } catch (e: any) {
    console.error('processHistoricalData error:', e);
    return { error: e.message || 'An unknown error occurred on the server.' };
  }
}

const prompt = ai.definePrompt({
  name: 'processHistoricalDataPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: ProcessHistoricalDataInputSchema },
  output: { schema: ProcessHistoricalDataOutputSchema },
  config: {
    temperature: 0.2,
  },
  prompt: `You are an expert data entry specialist. Your task is to process a list of raw text rows (extracted from an Excel spreadsheet containing historical WhatsApp messages) and convert them into structured Field Service Reports (FSRs) and Daily Diaries.

Guidelines:
1. Read the provided rows of text.
2. If the user specifies a defaultType of 'FSR', try to map all rows to the 'fsrs' array.
3. If 'DIARY', try to map all rows to the 'diaries' array.
4. If 'AUTO', infer the type based on the content (e.g., "call-out after hours" implies FSR, "normal maintenance" implies DIARY).
5. Extract as much relevant information as possible into the corresponding schema fields. Missing fields should be left undefined.
6. Try to consolidate consecutive rows into a single report if they clearly belong to the same event/day.
7. DO NOT HALLUCINATE data.

Default Type: {{defaultType}}

Rows to process:
{{#each rows}}
- {{this}}
{{/each}}
`,
});

const processHistoricalDataFlow = ai.defineFlow(
  {
    name: 'processHistoricalDataFlow',
    inputSchema: ProcessHistoricalDataInputSchema,
    outputSchema: ProcessHistoricalDataOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("AI failed to process the historical data.");
    return output;
  }
);
