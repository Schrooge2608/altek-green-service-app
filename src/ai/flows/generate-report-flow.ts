'use server';
/**
 * @fileOverview An AI flow for generating comprehensive weekly client reports from aggregated Firestore data.
 *
 * - generateReport - A function that handles the report generation.
 * - ReportInput - The input type for the generateReport function.
 * - ReportOutput - The return type for the generateReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

// Zod schemas matching the data structures from Firestore
const BreakdownReportSchema = z.object({
  id: z.string(),
  equipmentName: z.string(),
  component: z.string(),
  date: z.string(),
  resolved: z.boolean(),
  resolution: z.string().optional().nullable(),
  timeBackInService: z.string().optional().nullable(),
});

const CompletedScheduleSchema = z.object({
    id: z.string(),
    equipmentName: z.string(),
    area: z.string(),
    completionDate: z.string(),
    inspectedBy: z.string(),
    maintenanceType: z.string(),
    frequency: z.string(),
});

const DailyDiarySchema = z.object({
    id: z.string(),
    contractTitle: z.string(),
    date: z.string(),
    works: z.array(z.object({
        area: z.string().optional(),
        scope: z.string().optional(),
    })).optional(),
    beforeWorkImages: z.array(z.string()).optional(),
    afterWorkImages: z.array(z.string()).optional(),
});


const ReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the report period (e.g., yyyy-MM-dd).'),
  endDate: z.string().describe('The end date for the report period (e.g., yyyy-MM-dd).'),
  breakdowns: z.array(BreakdownReportSchema).describe("A list of all breakdown incidents reported during the period."),
  completedSchedules: z.array(CompletedScheduleSchema).describe("A list of all scheduled maintenance documents completed during the period."),
  dailyDiaries: z.array(DailyDiarySchema).describe("A list of all daily diaries, which may contain unscheduled work."),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

const ReportOutputSchema = z.object({
  report: z.string().describe('The generated professional, client-facing report in plain text format, using markdown for tables.'),
});
export type ReportOutput = z.infer<typeof ReportOutputSchema>;

export async function generateReport(
  input: ReportInput
): Promise<ReportOutput> {
  return generateReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWeeklyActivityReportPrompt',
  input: {schema: ReportInputSchema},
  output: {schema: ReportOutputSchema},
  prompt: `You are an expert technical writer for Altek Green, an industrial maintenance company.
Your task is to generate a professional and clear weekly summary report for a client based on the activity data provided for the period from {{{startDate}}} to {{{endDate}}}.

The report MUST have the following structure exactly. For each section, if no data is provided for that category, state 'No activity to report for this period.' and nothing else for that section.

**Subject Line:** "Weekly Operations & Maintenance Report: {{{startDate}}} to {{{endDate}}}"

**1. Executive Summary:**
A brief, high-level overview of the week's key activities based on the data provided below. Mention the total number of breakdowns, completed maintenance tasks, and any unscheduled work. Highlight any critical issues or notable successes.

---

**2. Breakdown Incidents:**
{{#if breakdowns}}
| Equipment Name      | Component  | Date Reported | Status   | Resolution Notes                  |
|---------------------|------------|---------------|----------|-------------------------------------|
{{#each breakdowns}}
| {{{this.equipmentName}}} | {{{this.component}}} | {{{this.date}}}      | {{#if this.resolved}}Resolved{{else}}Active{{/if}} | {{#if this.resolution}}{{this.resolution}}{{else}}N/A{{/if}} |
{{/each}}
{{else}}
No breakdown incidents to report for this period.
{{/if}}

---

**3. Completed Scheduled Maintenance:**
{{#if completedSchedules}}
| Equipment Name      | Maintenance Type  | Frequency | Completion Date | Inspected By      |
|---------------------|-------------------|-----------|-----------------|-------------------|
{{#each completedSchedules}}
| {{{this.equipmentName}}} | {{{this.maintenanceType}}} | {{{this.frequency}}} | {{{this.completionDate}}} | {{{this.inspectedBy}}} |
{{/each}}
{{else}}
No scheduled maintenance was completed during this period.
{{/if}}

---

**4. Unscheduled Work & Other Activities (from Daily Diaries):**
{{#if dailyDiaries}}
| Date       | Scope of Work                                |
|------------|----------------------------------------------|
{{#each dailyDiaries}}
{{#each this.works}}
{{#if this.scope}}
| {{{../date}}} | {{{this.scope}}} |
{{/if}}
{{/each}}
{{/each}}
{{else}}
No unscheduled work or other activities were logged in daily diaries for this period.
{{/if}}

{{#if dailyDiaries}}
{{#each dailyDiaries}}
{{#if this.beforeWorkImages}}

**Attached Images for Diary {{{this.id}}}:**
{{#each this.beforeWorkImages}}
- Before Work Image: {{{this}}}
{{/each}}
{{/if}}
{{#if this.afterWorkImages}}
{{#each this.afterWorkImages}}
- After Work Image: {{{this}}}
{{/each}}
{{/if}}
{{/each}}
{{/if}}

---

**5. Closing Remarks:**
A brief, positive closing statement about the commitment to reliability and proactive maintenance.
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
