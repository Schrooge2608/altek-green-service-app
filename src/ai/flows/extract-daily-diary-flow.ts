'use server';
/**
 * @fileOverview AI flow for extracting structured data from digital PDF Daily Diaries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DailyDiaryScanInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A PDF scan of a paper Daily Diary, as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type DailyDiaryScanInput = z.infer<typeof DailyDiaryScanInputSchema>;

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
export type DailyDiaryScanOutput = z.infer<typeof DailyDiaryScanOutputSchema>;

export async function extractDailyDiaryData(input: DailyDiaryScanInput): Promise<DailyDiaryScanOutput> {
  try {
    return await extractDailyDiaryFlow(input);
  } catch (e: any) {
    console.error('extractDailyDiaryData error:', e);
    return { error: e.message || 'An unknown error occurred on the server.' };
  }
}

const prompt = ai.definePrompt({
  name: 'extractDailyDiaryPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: DailyDiaryScanInputSchema },
  output: { schema: DailyDiaryScanOutputSchema },
  config: {
    temperature: 0.1,
  },
  prompt: `You are an expert industrial data entry specialist. Analyze the provided PDF scan of a Daily Diary.
  
CRITICAL QUALITY CHECK:
If the scanned PDF is too blurry, illegible, or incomplete to extract data reliably, return exactly { "error": "DOCUMENT_UNCLEAR" }.

Otherwise, extract all handwritten and printed information into a structured JSON format. 

Key Guidelines:
1. HEADER: Extract diary reference, contract title/number, PO/Quotation, work type, area, date, and shift times.
2. MANPOWER: Extract all roles and hours worked.
3. PLANT/EQUIPMENT: Extract used plant details.
4. WORKS: Extract tasks completed with times and hours.
5. DELAYS & COMMENTS: Extract bulleted or numbered points into arrays of strings.

If a field is blank, omit it. Do not hallucinate data.

Daily Diary Document: {{media url=documentDataUri}}`,
});

const extractDailyDiaryFlow = ai.defineFlow(
  {
    name: 'extractDailyDiaryFlow',
    inputSchema: DailyDiaryScanInputSchema,
    outputSchema: DailyDiaryScanOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("AI failed to process the PDF document.");
    return output;
  }
);
