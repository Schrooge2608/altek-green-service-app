
'use server';
/**
 * @fileOverview An AI flow for generating client-facing reports.
 *
 * - generateReport - A function that handles report generation.
 * - ReportInput - The input type for the generateReport function.
 * - ReportOutput - The return type for the generateReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ReportInputSchema = z.object({
  equipmentName: z.string().describe('The name of the equipment.'),
  breakdownHistory: z.string().describe('A summary of the breakdown history for the equipment.'),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

const ReportOutputSchema = z.object({
  report: z.string().describe('The generated client-facing report in plain text.'),
});
export type ReportOutput = z.infer<typeof ReportOutputSchema>;

export async function generateReport(input: ReportInput): Promise<ReportOutput> {
  return generateReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateReportPrompt',
  input: { schema: ReportInputSchema },
  output: { schema: ReportOutputSchema },
  prompt: `You are an expert technical writer for an industrial maintenance company, Altek Green.
Your task is to create a professional, client-friendly summary report for a piece of equipment.
The report should be clear, concise, and written in plain language. Avoid overly technical jargon.

Use the provided information to draft the report.

Start the report with a clear subject line, for example: "Subject: Maintenance Summary Report for [Equipment Name]".

Structure the body of the report to summarize the maintenance and breakdown history provided.
If there is no breakdown history, state that the equipment has been operating reliably with no reported issues.
Conclude with a positive closing statement about ongoing monitoring and commitment to reliability.

Equipment Name: {{{equipmentName}}}
Breakdown & Maintenance History:
{{{breakdownHistory}}}
`,
});

const generateReportFlow = ai.defineFlow(
  {
    name: 'generateReportFlow',
    inputSchema: ReportInputSchema,
    outputSchema: ReportOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
