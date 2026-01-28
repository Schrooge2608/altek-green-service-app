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

const EquipmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  plant: z.string().optional(),
  division: z.string().optional(),
  vsdId: z.string(),
  lastMaintenance: z.string().optional(),
  nextMaintenance: z.string().optional(),
  imageUrl: z.string().optional(),
  motorModel: z.string().optional(),
  motorPower: z.number().optional(),
  motorVoltage: z.number().optional(),
  motorSerialNumber: z.string().optional(),
  motorFrameType: z.string().optional(),
  motorInstallationDate: z.string().optional(),
  motorAssignedToId: z.string().optional(),
  motorAssignedToName: z.string().optional(),
  totalDowntimeHours: z.number().optional(),
  breakerAssetNumber: z.string().optional(),
  breakerLocationHierarchy: z.string().optional(),
  breakerServiceDescription: z.string().optional(),
  breakerManufacturer: z.string().optional(),
  breakerModelRange: z.string().optional(),
  breakerType: z.string().optional(),
  breakerRatedVoltage: z.number().optional(),
  breakerFrameSize: z.number().optional(),
  breakerBreakingCapacity: z.number().optional(),
  breakerNumberOfPoles: z.number().optional(),
  breakerTripUnitType: z.string().optional(),
  breakerOverloadSetting: z.number().optional(),
  breakerShortCircuitSetting: z.number().optional(),
  breakerInstantaneousSetting: z.number().optional(),
  breakerGroundFaultSetting: z.string().optional(),
  breakerOperationMechanism: z.string().optional(),
  breakerMotorVoltage: z.number().optional(),
  breakerShuntTripVoltage: z.number().optional(),
  breakerUndervoltageRelease: z.string().optional(),
  breakerAuxiliaryContacts: z.string().optional(),
  protectionInstallationDate: z.string().optional(),
  protectionAssignedToId: z.string().optional(),
  protectionAssignedToName: z.string().optional(),
  assignedToId: z.string().optional(),
  assignedToName: z.string().optional(),
  upsModel: z.string().optional(),
  upsSerialNumber: z.string().optional(),
  batteryType: z.string().optional(),
  upsInstallationDate: z.string().optional(),
  lastBatteryReplacement: z.string().optional(),
  upsAssignedToId: z.string().optional(),
  upsAssignedToName: z.string().optional(),
  pumpHead: z.number().optional(),
  flowRate: z.number().optional(),
  pumpType: z.string().optional(),
  pumpBrand: z.string().optional(),
  pumpSerialNumber: z.string().optional(),
  pumpManufacturer: z.string().optional(),
  pumpImpellerDiameter: z.number().optional(),
  pumpCommissionDate: z.string().optional(),
  pumpFlangeSizeIn: z.number().optional(),
  pumpFlangeSizeOutlet: z.number().optional(),
  pumpFrameSize: z.string().optional(),
  pumpFrameType: z.string().optional(),
  pumpAssignedToId: z.string().optional(),
  pumpAssignedToName: z.string().optional(),
  gearboxModel: z.string().optional(),
  gearboxBrand: z.string().optional(),
  gearboxRatio: z.string().optional(),
  gearboxSerialNumber: z.string().optional(),
  gearboxOilType: z.string().optional(),
  gearboxOilCapacityLiters: z.number().optional(),
  gearboxAssignedToId: z.string().optional(),
  gearboxAssignedToName: z.string().optional(),
  fanType: z.string().optional(),
  fanBrand: z.string().optional(),
  fanModel: z.string().optional(),
  fanSerialNumber: z.string().optional(),
  fanAirflowCFM: z.number().optional(),
  fanBladeDiameter: z.number().optional(),
  fanAssignedToId: z.string().optional(),
  fanAssignedToName: z.string().optional(),
  valveType: z.string().optional(),
  valveBrand: z.string().optional(),
  valveModel: z.string().optional(),
  valveSerialNumber: z.string().optional(),
  valveSizeInches: z.number().optional(),
  valveActuatorType: z.string().optional(),
  valveAssignedToId: z.string().optional(),
  valveAssignedToName: z.string().optional(),
  breakdownStatus: z.string().optional(),
  status: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  installationDate: z.string().optional(),
  powerConsumption: z.number().optional(),
});


const ReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the report period (e.g., yyyy-MM-dd).'),
  endDate: z.string().describe('The end date for the report period (e.g., yyyy-MM-dd).'),
  customQuery: z.string().optional().describe("A specific question to answer about the data."),
  newBreakdowns: z.array(BreakdownReportSchema).describe("A list of all breakdown incidents reported during the period."),
  closedBreakdowns: z.array(BreakdownReportSchema).describe("A list of all breakdown incidents resolved during the period."),
  completedSchedules: z.array(CompletedScheduleSchema).describe("A list of all scheduled maintenance documents completed during the period."),
  dailyDiaries: z.array(DailyDiarySchema).describe("A list of all daily diaries, which may contain unscheduled work."),
  equipment: z.array(EquipmentSchema).describe("A complete list of all equipment assets in the database."),
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
  prompt: `{{#if customQuery}}
You are a Maintenance Analyst. Your task is to answer the user's question based on the provided JSON data. Be precise and answer only the question asked.

User Question: "{{{customQuery}}}"

---
DATA CONTEXT
The data covers the period from {{{startDate}}} to {{{endDate}}}.

Equipment Data (JSON Array):
{{{json equipment}}}

New Breakdowns (JSON Array):
{{{json newBreakdowns}}}

Resolved Breakdowns (JSON Array):
{{{json closedBreakdowns}}}

Completed Schedules (JSON Array):
{{{json completedSchedules}}}

Daily Diaries (JSON Array):
{{{json dailyDiaries}}}
---

{{else}}
You are an expert technical writer for Altek Green, an industrial maintenance company.
Your task is to generate a professional and clear weekly summary report for a client based on the activity data provided for the period from {{{startDate}}} to {{{endDate}}}.

The report MUST have the following structure exactly. For each section, if the data array for that category (e.g., Breakdowns, Schedules, Diaries) is empty, you MUST state 'No activity to report for this period.' and nothing else. Do not hallucinate or invent data if a section is empty.

**Subject Line:** "Weekly Operations & Maintenance Report: {{{startDate}}} to {{{endDate}}}"

**1. Executive Summary:**
A brief, high-level overview of the week's key activities based on the data provided below. Mention the total number of new and resolved breakdowns, completed maintenance tasks, and any unscheduled work. Highlight any critical issues or notable successes.

---

**2. Newly Reported Breakdowns:**
{{#if newBreakdowns}}
| Equipment Name      | Component  | Date Reported | Status   |
|---------------------|------------|---------------|----------|
{{#each newBreakdowns}}
| {{{this.equipmentName}}} | {{{this.component}}} | {{{this.date}}}      | {{#if this.resolved}}Resolved{{else}}Active{{/if}} |
{{/each}}
{{else}}
No new breakdown incidents were reported for this period.
{{/if}}

---

**3. Resolved Breakdowns:**
{{#if closedBreakdowns}}
| Equipment Name      | Component  | Date Reported | Resolution Notes                  |
|---------------------|------------|---------------|-------------------------------------|
{{#each closedBreakdowns}}
| {{{this.equipmentName}}} | {{{this.component}}} | {{{this.date}}}      | {{#if this.resolution}}{{this.resolution}}{{else}}Work completed.{{/if}} |
{{/each}}
{{else}}
No breakdown incidents were resolved during this period.
{{/if}}

---

**4. Completed Scheduled Maintenance:**
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

**5. Unscheduled Work & Other Activities (from Daily Diaries):**
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

---

**6. Closing Remarks:**
A brief, positive closing statement about the commitment to reliability and proactive maintenance.
{{/if}}
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
