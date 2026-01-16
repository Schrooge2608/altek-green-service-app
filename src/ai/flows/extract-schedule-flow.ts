'use server';
/**
 * @fileOverview An AI flow for extracting data from a maintenance schedule document image.
 *
 * - extractScheduleData - A function that handles the data extraction process.
 * - DocumentScanInput - The input type for the extractScheduleData function.
 * - DocumentScanOutput - The return type for the extractScheduleData function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const DocumentScanInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of a maintenance schedule document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type DocumentScanInput = z.infer<typeof DocumentScanInputSchema>;

export const DocumentScanOutputSchema = z.object({
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
  })).describe('A list of all work crew members, their RTBS numbers, and the date they signed.'),
  checklist: z.array(z.object({
    task: z.string().describe('The description of the checklist task.'),
    status: z.enum(['checked', 'not-checked', 'n/a']).describe('The status of the checklist item. Infer "n/a" if it is not applicable.'),
    comments: z.string().describe('Any handwritten or typed comments for the checklist item.'),
  })).describe('All items from the service checklist.'),
});
export type DocumentScanOutput = z.infer<typeof DocumentScanOutputSchema>;


export async function extractScheduleData(input: DocumentScanInput): Promise<DocumentScanOutput> {
  return extractScheduleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractSchedulePrompt',
  input: { schema: DocumentScanInputSchema },
  output: { schema: DocumentScanOutputSchema },
  prompt: `You are an expert document analyst specializing in industrial maintenance reports. Analyze the provided image of a completed service schedule.
Carefully extract all the required information based on the output schema.
Pay close attention to handwritten notes, signatures, and checkbox statuses.
For checklist items, determine if they are checked, not checked, or not applicable. Extract any handwritten comments associated with each item.
For the work crew, extract each person's name, RTBS number, and the date they signed. Do not attempt to extract the signature itself.
Return the data in the specified JSON format.

Image to analyze: {{media url=imageDataUri}}`,
});

const extractScheduleFlow = ai.defineFlow(
  {
    name: 'extractScheduleFlow',
    inputSchema: DocumentScanInputSchema,
    outputSchema: DocumentScanOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
