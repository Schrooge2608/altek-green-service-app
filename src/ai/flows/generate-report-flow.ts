'use server';
/**
 * @fileOverview An AI flow for generating comprehensive weekly client reports.
 *
 * - generateReport - A function that handles the report generation.
 * - ReportInput - The input type for the generateReport function.
 * - ReportOutput - The return type for the generateReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const SectionInputSchema = z.object({
  breakdownDetails: z.string().optional().describe("Details of any breakdowns that occurred."),
  pmCompleted: z.string().optional().describe("Details of any preventative maintenance that was completed."),
  technicianNotes: z.string().optional().describe("Any additional notes from the technician."),
});

const ReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the report period (e.g., yyyy-MM-dd).'),
  endDate: z.string().describe('The end date for the report period (e.g., yyyy-MM-dd).'),
  vsds: SectionInputSchema.nullable().describe("Report section for VSDs. Null if nothing to report."),
  upsSystems: SectionInputSchema.nullable().describe("Report section for UPS Systems. Null if nothing to report."),
  btus: SectionInputSchema.nullable().describe("Report section for BTUs. Null if nothing to report."),
  protectionUnits: SectionInputSchema.nullable().describe("Report section for Protection Units. Null if nothing to report."),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

const ReportOutputSchema = z.object({
  report: z.string().describe('The generated professional, client-facing report in plain text format.'),
});
export type ReportOutput = z.infer<typeof ReportOutputSchema>;

export async function generateReport(
  input: ReportInput
): Promise<ReportOutput> {
  return generateReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWeeklyReportPrompt',
  input: {schema: ReportInputSchema},
  output: {schema: ReportOutputSchema},
  prompt: `You are an expert technical writer for Altek Green, an industrial maintenance company.
Your task is to generate a professional and clear weekly summary report for a client based on the data provided for the period from {{{startDate}}} to {{{endDate}}}.

The report MUST have the following structure exactly. For each section, use the provided details. If a section has no data (i.e., 'Nothing to report' was checked), state that clearly.

1.  **Subject Line:** "Weekly Maintenance & Operations Report: {{{startDate}}} to {{{endDate}}}"

2.  **Executive Summary:** A brief, high-level overview of the week's activities based on the details provided below.

3.  **VSDs (Variable Speed Drives)**
{{#if vsds}}
    - **Breakdowns:** {{{vsds.breakdownDetails}}}
    - **Preventative Maintenance:** {{{vsds.pmCompleted}}}
    - **Technician Notes:** {{{vsds.technicianNotes}}}
{{else}}
    Nothing to report for this period.
{{/if}}

4.  **UPS Systems**
{{#if upsSystems}}
    - **Breakdowns:** {{{upsSystems.breakdownDetails}}}
    - **Preventative Maintenance:** {{{upsSystems.pmCompleted}}}
    - **Technician Notes:** {{{upsSystems.technicianNotes}}}
{{else}}
    Nothing to report for this period.
{{/if}}

5.  **BTUs (Battery Tripping Units)**
{{#if btus}}
    - **Breakdowns:** {{{btus.breakdownDetails}}}
    - **Preventative Maintenance:** {{{btus.pmCompleted}}}
    - **Technician Notes:** {{{btus.technicianNotes}}}
{{else}}
    Nothing to report for this period.
{{/if}}

6.  **Protection Units**
{{#if protectionUnits}}
    - **Breakdowns:** {{{protectionUnits.breakdownDetails}}}
    - **Preventative Maintenance:** {{{protectionUnits.pmCompleted}}}
    - **Technician Notes:** {{{protectionUnits.technicianNotes}}}
{{else}}
    Nothing to report for this period.
{{/if}}

7.  **Closing Remarks:** A brief, positive closing statement about the commitment to reliability and proactive maintenance.
`,
});

const generateReportFlow = ai.defineFlow(
  {
    name: 'generateReportFlow',
    inputSchema: ReportInputSchema,
    outputSchema: ReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
