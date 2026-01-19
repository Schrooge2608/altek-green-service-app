'use server';
/**
 * @fileOverview An AI flow for generating comprehensive weekly client reports from detailed technical data.
 *
 * - generateReport - A function that handles the report generation.
 * - ReportInput - The input type for the generateReport function.
 * - ReportOutput - The return type for the generateReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

// Define schemas for each technical section
const VsdInputSchema = z.object({
  include: z.boolean(),
  avgTemp: z.number().optional(),
  maxCurrent: z.number().optional(),
  filtersCleaned: z.boolean().optional(),
  tripHistory: z.string().optional(),
}).describe("Data for the VSD section. Null if not included.");

const UpsInputSchema = z.object({
  include: z.boolean(),
  load: z.string().optional().describe("Load percentage for L1/L2/L3, e.g., '80/82/81'"),
  outputVoltage: z.number().optional(),
  roomTemp: z.number().optional(),
  visualOk: z.boolean().optional(),
  terminalsClean: z.boolean().optional(),
}).describe("Data for the UPS Systems section. Null if not included.");

const BtuInputSchema = z.object({
  include: z.boolean(),
  floatVoltage: z.number().optional(),
  loadCurrent: z.number().optional(),
  earthFaultStatus: z.enum(['Healthy', 'Positive Fault', 'Negative Fault']).optional(),
}).describe("Data for the BTU (DC System) section. Null if not included.");

const ProtectionRelayInputSchema = z.object({
  include: z.boolean(),
  lastTripEvent: z.string().optional(),
  lastTestDate: z.string().optional().describe("Date in yyyy-MM-dd format."),
}).describe("Data for the Protection Relays section. Null if not included.");

export const ReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the report period (e.g., yyyy-MM-dd).'),
  endDate: z.string().describe('The end date for the report period (e.g., yyyy-MM-dd).'),
  vsds: VsdInputSchema.nullable(),
  upsSystems: UpsInputSchema.nullable(),
  btus: BtuInputSchema.nullable(),
  protectionRelays: ProtectionRelayInputSchema.nullable(),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

export const ReportOutputSchema = z.object({
  report: z.string().describe('The generated professional, client-facing report in plain text format, using markdown for tables.'),
});
export type ReportOutput = z.infer<typeof ReportOutputSchema>;

export async function generateReport(
  input: ReportInput
): Promise<ReportOutput> {
  return generateReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWeeklyTechnicalReportPrompt',
  input: {schema: ReportInputSchema},
  output: {schema: ReportOutputSchema},
  prompt: `You are an expert technical writer for Altek Green, an industrial maintenance company.
Your task is to generate a professional and clear weekly summary report for a client based on the technical data provided for the period from {{{startDate}}} to {{{endDate}}}.

The report MUST have the following structure exactly. For each section, if the data is not provided (null), state 'No data submitted for this period.' Otherwise, format the provided data into a clear and professional markdown table.

**Subject Line:** "Weekly Technical Operations Report: {{{startDate}}} to {{{endDate}}}"

**Executive Summary:**
A brief, high-level overview of the week's key findings based on the data provided below. Highlight any anomalies or important maintenance actions.

---

### **VSDs (Variable Speed Drives)**
{{#if vsds}}
| Parameter                 | Value                               |
|---------------------------|-------------------------------------|
| Avg. Operating Temp (°C)  | {{#if vsds.avgTemp}}{{vsds.avgTemp}}{{else}}N/A{{/if}}          |
| Max Current (Amps)        | {{#if vsds.maxCurrent}}{{vsds.maxCurrent}}{{else}}N/A{{/if}}      |
| Fan Filters Cleaned       | {{#if vsds.filtersCleaned}}Yes{{else}}No{{/if}}          |
| **Trip History / Notes**      |                                     |
|                           | {{#if vsds.tripHistory}}{{vsds.tripHistory}}{{else}}No trips recorded.{{/if}} |
{{else}}
No data submitted for this period.
{{/if}}

---

### **UPS Systems**
{{#if upsSystems}}
| Parameter                 | Value                               |
|---------------------------|-------------------------------------|
| Load % (L1/L2/L3)         | {{#if upsSystems.load}}{{upsSystems.load}}{{else}}N/A{{/if}}          |
| Output Voltage (V)        | {{#if upsSystems.outputVoltage}}{{upsSystems.outputVoltage}}{{else}}N/A{{/if}} |
| Room Temp (°C)            | {{#if upsSystems.roomTemp}}{{upsSystems.roomTemp}}{{else}}N/A{{/if}}        |
| Visual Inspection OK      | {{#if upsSystems.visualOk}}Yes{{else}}No{{/if}}             |
| Terminals Clean           | {{#if upsSystems.terminalsClean}}Yes{{else}}No{{/if}}           |
{{else}}
No data submitted for this period.
{{/if}}

---

### **BTUs (Battery Tripping Units - DC System)**
{{#if btus}}
| Parameter                 | Value                               |
|---------------------------|-------------------------------------|
| Float Voltage (V)         | {{#if btus.floatVoltage}}{{btus.floatVoltage}}{{else}}N/A{{/if}}    |
| Load Current (A)          | {{#if btus.loadCurrent}}{{btus.loadCurrent}}{{else}}N/A{{/if}}      |
| Earth Fault Status        | {{#if btus.earthFaultStatus}}{{btus.earthFaultStatus}}{{else}}N/A{{/if}} |
{{else}}
No data submitted for this period.
{{/if}}

---

### **Protection Relays**
{{#if protectionRelays}}
| Parameter                      | Value                                       |
|--------------------------------|---------------------------------------------|
| Last Trip Event (Feeder)       | {{#if protectionRelays.lastTripEvent}}{{protectionRelays.lastTripEvent}}{{else}}None{{/if}} |
| Secondary Injection Test Date  | {{#if protectionRelays.lastTestDate}}{{protectionRelays.lastTestDate}}{{else}}N/A{{/if}}      |
{{else}}
No data submitted for this period.
{{/if}}

---

**Closing Remarks:**
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
