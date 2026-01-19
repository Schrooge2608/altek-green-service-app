'use server';
/**
 * @fileOverview An AI flow for generating comprehensive weekly client reports.
 *
 * - generateReport - A function that handles the report generation.
 * - ReportInput - The input type for the generateReport function.
 * - ReportOutput - The return type for the generateReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BreakdownInfoSchema = z.object({
  equipmentName: z.string(),
  date: z.string(),
  description: z.string(),
  status: z.string(),
});

const CompletedScheduleInfoSchema = z.object({
  equipmentName: z.string(),
  maintenanceType: z.string(),
  frequency: z.string(),
  completionDate: z.string(),
});

const UnscheduledWorkInfoSchema = z.object({
  scope: z.string(),
  date: z.string(),
});

const ReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the report period (e.g., yyyy-MM-dd).'),
  endDate: z.string().describe('The end date for the report period (e.g., yyyy-MM-dd).'),
  breakdowns: z.array(BreakdownInfoSchema).describe('A list of all breakdowns that occurred during the week.'),
  completedSchedules: z.array(CompletedScheduleInfoSchema).describe('A list of all scheduled maintenance tasks that were completed.'),
  unscheduledWork: z.array(UnscheduledWorkInfoSchema).describe('A list of all unscheduled work or interventions.'),
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

The report MUST have the following structure exactly. If a section has no data, state that clearly and positively as instructed.

1.  **Subject Line:** "Weekly Maintenance & Operations Report: {{{startDate}}} to {{{endDate}}}"
2.  **Executive Summary:** A brief, high-level overview of the week's activities. Mention the number of breakdowns, completed maintenances, and any major highlights or concerns.
3.  **Breakdown Incidents:**
{{#if breakdowns}}
A list of all equipment breakdowns. For each, clearly state the equipment name, the date it was reported, and the issue.
{{else}}
No breakdown incidents were reported during this period, indicating excellent equipment stability.
{{/if}}
4.  **Completed Scheduled Maintenance:**
{{#if completedSchedules}}
A list of all planned maintenance tasks that were successfully completed.
{{else}}
No scheduled maintenance was completed during this reporting period.
{{/if}}
5.  **Unscheduled Work & Interventions:**
{{#if unscheduledWork}}
A summary of any work performed outside of the regular schedule.
{{else}}
No unscheduled work or interventions were required this week.
{{/if}}
6.  **Closing Remarks:** A brief, positive closing statement about the commitment to reliability and proactive maintenance.

**CRITICAL INSTRUCTIONS:**
- Do not just list the raw data. Synthesize it into readable sentences.
- Maintain a professional and client-friendly tone throughout.
- Do not invent any information not present in the data below.

**DATA FOR REPORT:**

**Breakdowns:**
{{#each breakdowns}}
- Equipment: {{{this.equipmentName}}}, Date: {{{this.date}}}, Description: {{{this.description}}}, Status: {{{this.status}}}
{{/each}}

**Completed Scheduled Maintenance:**
{{#each completedSchedules}}
- Equipment: {{{this.equipmentName}}}, Type: {{{this.maintenanceType}}}, Frequency: {{{this.frequency}}}, Completed On: {{{this.completionDate}}}
{{/each}}

**Unscheduled Work:**
{{#each unscheduledWork}}
- Scope: {{{this.scope}}}, Date: {{{this.date}}}
{{/each}}

Now, generate the final report based on these instructions and data.
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
