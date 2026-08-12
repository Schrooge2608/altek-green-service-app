'use server';
/**
 * @fileOverview An AI flow for extracting data from various document types (Images, PDFs, Text).
 * 
 * - extractScheduleData - Handles document analysis and data extraction.
 * - DocumentScanInput - Supports image, pdf, or text data URIs.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DocumentScanInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A document file (Image or PDF) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type DocumentScanInput = z.infer<typeof DocumentScanInputSchema>;

const DocumentScanOutputSchema = z.object({
  equipmentName: z.string().describe('The name of the equipment being serviced.'),
  area: z.string().describe('The area or location where the service took place.'),
  completionDate: z.string().describe('The date the service was completed, in yyyy-MM-dd format.'),
  inspectedBy: z.string().describe('The name of the primary inspector.'),
  maintenanceType: z.string().describe('The type of maintenance (e.g., VSDs, Protection).'),
  frequency: z.string().describe('The service frequency (e.g., Weekly, Monthly).'),
  workCrew: z.array(z.object({
    name: z.string().describe('The name of a crew member.'),
    rtbsNo: z.string().describe('The RTBS number for the crew member.'),
    date: z.string().describe('The date signed by the crew member.'),
  })).describe('A list of all work crew members.'),
  checklist: z.array(z.object({
    task: z.string().describe('The description of the checklist task.'),
    status: z.enum(['checked', 'not-checked', 'n/a']).describe('The status of the checklist item.'),
    comments: z.string().describe('Any handwritten or tonight comments.'),
  })).describe('All items from the service checklist.'),
  summary: z.string().optional().describe('A brief AI-generated summary of the document contents if it is not a standard schedule.'),
});
export type DocumentScanOutput = z.infer<typeof DocumentScanOutputSchema>;

export async function extractScheduleData(input: DocumentScanInput): Promise<DocumentScanOutput> {
  return extractScheduleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractSchedulePrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: DocumentScanInputSchema },
  output: { schema: DocumentScanOutputSchema },
  config: {
    temperature: 0.2,
  },
  prompt: `You are an expert industrial document analyst. Analyze the provided document (which may be an image, a PDF scan, or a text file).
  
If this is a Maintenance Schedule or Service Report:
1. Extract all structured fields according to the schema.
2. Pay close attention to handwritten marks (ticks, crosses) and handwritten text.
3. For work crew, identify names and RTBS numbers clearly.

If this is a general technical document or note:
1. Extract any identifiable Equipment Names, Dates, and Locations.
2. Provide a concise summary of the document in the 'summary' field.
3. Map any 'tasks' or 'actions' found to the checklist array.

Document Content: {{media url=imageDataUri}}`,
});

const extractScheduleFlow = ai.defineFlow(
  {
    name: 'extractScheduleFlow',
    inputSchema: DocumentScanInputSchema,
    outputSchema: DocumentScanOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("AI failed to recognize document content.");
    return output;
  }
);
