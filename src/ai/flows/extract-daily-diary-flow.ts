'use server';
/**
 * @fileOverview AI flow for extracting structured data from digital PDF Daily Diaries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const DailyDiaryScanInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A PDF scan or photo of a paper Daily Diary, as a data URI. Expected format: 'data:<mimeType>;base64,<encoded_data>'."
    ),
});
export type DailyDiaryScanInput = z.infer<typeof DailyDiaryScanInputSchema>;

export const DailyDiaryScanOutputSchema = z.object({
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
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return { error: 'Google AI API key is missing. Please configure GOOGLE_GENAI_API_KEY in your environment.' };
  }

  // Parse data URI
  const matches = input.documentDataUri?.match(/^data:([^;]+);base64,(.+)$/s);
  if (!matches) {
    try {
      return await extractDailyDiaryFlow(input);
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

  const ext = mimeType === 'application/pdf' ? '.pdf' : mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : '.tmp';
  const tempFile = path.join(os.tmpdir(), `diary-scan-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  
  let fileManager: GoogleAIFileManager | null = null;
  let uploadResponse: any = null;

  try {
    fs.writeFileSync(tempFile, buffer);
    fileManager = new GoogleAIFileManager(apiKey);
    const genAI = new GoogleGenerativeAI(apiKey);

    uploadResponse = await fileManager.uploadFile(tempFile, {
      mimeType,
      displayName: `diary-scan-${Date.now()}`,
    });

    const promptText = `You are an expert industrial data entry specialist. Analyze the provided PDF scan or photo of a Daily Diary.
  
CRITICAL QUALITY CHECK:
If the scanned document is too blurry, illegible, or incomplete to extract data reliably, return exactly { "error": "DOCUMENT_UNCLEAR" }.

Otherwise, extract all handwritten and printed information into a structured JSON format matching this schema:
{
  "diaryReference": "string",
  "contractTitle": "string",
  "contractNumber": "string",
  "workType": "Normal | Callout",
  "purchaseOrderNumber": "string",
  "quotationNumber": "string",
  "area": "Mining | Smelter",
  "date": "YYYY-MM-DD",
  "shiftStart": "HH:mm",
  "shiftEnd": "HH:mm",
  "hrs": 0,
  "incidents": "string",
  "toolboxTalk": "string",
  "manpower": [
    {
      "designation": "string",
      "forecast": 0,
      "actual": 0,
      "normalHrs": 0,
      "overtime1_5": 0,
      "overtime2_0": 0,
      "totalManHrs": 0,
      "comments": "string"
    }
  ],
  "plant": [
    {
      "description": "string",
      "qty": 0,
      "inspectionDone": "yes | no | n/a",
      "comments": "string"
    }
  ],
  "works": [
    {
      "area": "string",
      "scope": "string",
      "timeStart": "HH:mm",
      "timeEnd": "HH:mm",
      "hrs": 0
    }
  ],
  "delays": ["string"],
  "comments": ["string"]
}

Key Guidelines:
1. HEADER: Extract diary reference, contract title/number, PO/Quotation, work type, area, date, and shift times.
2. MANPOWER: Extract all roles and hours worked.
3. PLANT/EQUIPMENT: Extract used plant details.
4. WORKS: Extract tasks completed with times and hours.
5. DELAYS & COMMENTS: Extract bulleted or numbered points into arrays of strings.

If a field is blank, omit it. Do not hallucinate data. Return ONLY valid JSON.`;

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
        return parsed as DailyDiaryScanOutput;
      } catch (err: any) {
        lastErr = err;
        console.warn(`Model ${modelName} extraction attempt error:`, err.message);
      }
    }
    throw lastErr;
  } catch (fileApiErr: any) {
    console.warn('File API attempt failed, attempting fallback to Genkit flow:', fileApiErr?.message);
    try {
      return await extractDailyDiaryFlow(input);
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
  name: 'extractDailyDiaryPrompt',
  model: 'googleai/gemini-3.8-flash',
  input: { schema: DailyDiaryScanInputSchema },
  output: { schema: DailyDiaryScanOutputSchema },
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
