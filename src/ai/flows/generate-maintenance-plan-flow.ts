'use server';
/**
 * @fileOverview An AI flow for generating predictive weekly maintenance plans and equipment risk matrices
 * by cross-referencing historical Field Service Reports (FSRs), Daily Diaries, Breakdowns, and Asset registries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BreakdownReportSchema = z.object({
  id: z.string(),
  equipmentName: z.string().optional().default('Unknown'),
  component: z.string().optional().default('Other'),
  date: z.string().optional().default('N/A'),
  resolved: z.boolean().optional().default(false),
  resolution: z.string().optional().nullable(),
  timeBackInService: z.string().optional().nullable(),
});

const CompletedScheduleSchema = z.object({
  id: z.string(),
  equipmentName: z.string().optional().default('Unknown'),
  area: z.string().optional().default('N/A'),
  completionDate: z.string().optional().default('N/A'),
  inspectedBy: z.string().optional().default('N/A'),
  maintenanceType: z.string().optional().default('N/A'),
  frequency: z.string().optional().default('N/A'),
});

const DailyDiarySchema = z.object({
  id: z.string(),
  contractTitle: z.string().optional().default('N/A'),
  contractorName: z.string().optional().default(''),
  date: z.string().optional().default('N/A'),
  area: z.string().optional().default(''),
  works: z.array(z.object({
    area: z.string().optional(),
    scope: z.string().optional(),
  })).optional(),
});

const toSafeString = (val: any): string => {
  if (!val) return '';
  if (Array.isArray(val)) {
    return val.filter(Boolean).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('\n');
  }
  if (typeof val === 'string') return val;
  return String(val);
};

const safeStringSchema = z.union([
  z.string(),
  z.array(z.any()),
  z.null(),
  z.undefined()
]).transform(val => toSafeString(val)).default('');

const FieldServiceReportSchema = z.object({
  id: z.string().optional(),
  fsrReference: safeStringSchema,
  date: safeStringSchema,
  customer: safeStringSchema,
  site: safeStringSchema,
  location: safeStringSchema,
  assetName: safeStringSchema,
  status: safeStringSchema,
  customerFault: safeStringSchema,
  techFindings: safeStringSchema,
  rca: safeStringSchema,
  correctiveActions: safeStringSchema,
  recommendations: safeStringSchema,
});

const EquipmentSchema = z.object({
  name: safeStringSchema,
  serialNumber: safeStringSchema,
  plant: safeStringSchema,
  division: safeStringSchema,
  status: safeStringSchema,
  location: safeStringSchema,
  vsdId: safeStringSchema,
  flag: safeStringSchema,
}).passthrough();

const MaintenancePlanInputSchema = z.object({
  lookbackStartDate: z.string().describe('The start date of the diagnostic lookback window (yyyy-MM-dd)'),
  lookbackEndDate: z.string().describe('The end date of the diagnostic lookback window (yyyy-MM-dd)'),
  targetWeek: z.number().describe('The target ISO week number (e.g. 45)'),
  targetStartDate: z.string().describe('Start date of the target maintenance week (yyyy-MM-dd)'),
  targetEndDate: z.string().describe('End date of the target maintenance week (yyyy-MM-dd)'),
  customQuery: z.string().optional().describe('Specific focus, site, or technician instructions'),
  newBreakdowns: z.array(BreakdownReportSchema),
  closedBreakdowns: z.array(BreakdownReportSchema),
  completedSchedules: z.array(CompletedScheduleSchema),
  dailyDiaries: z.array(DailyDiarySchema),
  fieldServiceReports: z.array(FieldServiceReportSchema),
  equipment: z.array(EquipmentSchema),
});

export type MaintenancePlanInput = z.infer<typeof MaintenancePlanInputSchema>;

const MaintenancePlanOutputSchema = z.object({
  plan: z.string().describe('The predictive maintenance plan in clean GitHub-flavored markdown with strict table formatting.'),
});
export type MaintenancePlanOutput = z.infer<typeof MaintenancePlanOutputSchema>;

export async function generateMaintenancePlan(
  input: any
): Promise<{ success: boolean; data?: MaintenancePlanOutput; error?: string }> {
  try {
    const safeInput = JSON.parse(JSON.stringify(input));

    // Sanitize FSR fields
    if (Array.isArray(safeInput.fieldServiceReports)) {
      safeInput.fieldServiceReports = safeInput.fieldServiceReports.map((f: any) => ({
        ...f,
        id: String(f.id || ''),
        fsrReference: toSafeString(f.fsrReference || 'N/A'),
        date: toSafeString(f.date || 'N/A'),
        customer: toSafeString(f.customer || 'N/A'),
        site: toSafeString(f.site || 'N/A'),
        location: toSafeString(f.location || ''),
        assetName: toSafeString(f.assetName || 'N/A'),
        status: toSafeString(f.status || 'N/A'),
        customerFault: toSafeString(f.customerFault),
        techFindings: toSafeString(f.techFindings),
        rca: toSafeString(f.rca),
        correctiveActions: toSafeString(f.correctiveActions),
        recommendations: toSafeString(f.recommendations),
      }));
    }

    // Sanitize daily diaries
    if (Array.isArray(safeInput.dailyDiaries)) {
      safeInput.dailyDiaries = safeInput.dailyDiaries.map((d: any) => ({
        ...d,
        id: String(d.id || ''),
        contractTitle: toSafeString(d.contractTitle || 'N/A'),
        contractorName: toSafeString(d.contractorName || ''),
        date: toSafeString(d.date || 'N/A'),
        area: toSafeString(d.area || ''),
        works: Array.isArray(d.works) ? d.works.map((w: any) => ({
          area: toSafeString(w?.area || ''),
          scope: toSafeString(w?.scope || ''),
        })) : [],
      }));
    }

    const result = await generateMaintenancePlanFlow(safeInput);
    return { success: true, data: result };
  } catch (e: any) {
    console.error("AI Maintenance Planner Error:", e);
    return { success: false, error: e.message || String(e) };
  }
}

const planPrompt = ai.definePrompt({
  name: 'generateMaintenancePlanPrompt',
  model: 'googleai/gemini-3.1-pro-preview',
  input: { schema: MaintenancePlanInputSchema },
  output: { schema: MaintenancePlanOutputSchema },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `You are the Principal Electrical & Instrumentation Reliability Engineer and Maintenance Planner for Altek Green (KZN), servicing heavy mining and smelting operations (including RBM MPE, MPC, MPD, MPA, and Smelter sites).

Your role is to formulate a comprehensive, actionable, and forward-looking Weekly Predictive Maintenance Plan for the upcoming week based on diagnostic lookback history.

---
### INPUT PARAMETERS:
- **Target Planning Week:** Week {{{targetWeek}}} ({{{targetStartDate}}} to {{{targetEndDate}}})
- **Diagnostic Lookback Window:** {{{lookbackStartDate}}} to {{{lookbackEndDate}}}
{{#if customQuery}}
- **Special Managerial Directives / Focus Area:** "{{{customQuery}}}"
{{/if}}

---
### REASONING & PREDICTIVE MAINTENANCE DIRECTIVES:
1. **Analyze Latent Failure Modes & Repeat Incidents:**
   - Cross-reference FSR diagnostics, RCA notes, technician findings, and diary scopes across the lookback period.
   - Look for recurring earth faults, cable insulation breakdowns (e.g. abnormal megger or phase imbalance readings), loose terminations, contactor sticking, and IGBT/inverter failures.
2. **Audit Temporary Bypasses & "Local Mode" Units:**
   - Pay critical attention to equipment operating in temporary or local mode due to PLC communication dropouts (e.g. DeviceNet, Profibus) or bypassed interlocks. These represent immediate operational risk.
3. **Preventative Lifecycle Renewals:**
   - Review DC bus capacitor banks, VSD cooling fans, UPS batteries, and softstarters due for scheduled maintenance (3-monthly, 6-monthly).
4. **Formulate an Actionable Day-by-Day Schedule for Upcoming Week {{{targetWeek}}}:**
   - Distribute tasks logically across Monday to Friday (with weekend stand-by/urgent shut windows if applicable).
   - Assign appropriate sites (MPE, MPC, MPD, MPA, Smelter) and technician skillsets (e.g. David Msane, Buyani Mthembu, Ntokozo Zulu, Thulani Mthembu).

---
### CRITICAL MARKDOWN FORMATTING RULES:
1. Top heading must be:
   # Weekly Predictive Maintenance Plan
   **Prepared By:** Fritz Schroeder, Services Manager (KZN)  
   **Planning Period:** Week {{{targetWeek}}} ({{{targetStartDate}}} – {{{targetEndDate}}})  
   **Diagnostic Lookback Window:** {{{lookbackStartDate}}} to {{{lookbackEndDate}}}

2. Tables must follow strict GitHub-flavored Markdown:
   - Preceded by an empty blank line.
   - Header row immediately followed by delimiter row (\`|---|---|...|\`).
   - Every data row on its own separate line.
   - NEVER combine multiple rows onto one line.
   - Followed by an empty blank line before the next text.

---
### REQUIRED DOCUMENT STRUCTURE:

# Weekly Predictive Maintenance Plan
**Prepared By:** Fritz Schroeder, Services Manager (KZN)  
**Planning Period:** Week {{{targetWeek}}} ({{{targetStartDate}}} – {{{targetEndDate}}})  
**Diagnostic Lookback Window:** {{{lookbackStartDate}}} to {{{lookbackEndDate}}}

## 1. Plant Reliability & Critical Risk Overview
Write 2 clear, professional paragraphs providing a strategic overview of plant stability, key failure trends detected during the lookback period, and primary operational priorities for Week {{{targetWeek}}}. Do not use bullet points here.

## 2. Priority Risk Matrix & Critical Components at Risk
Extract all high-risk assets and degrading components strictly into this Markdown table:
| Site | Equipment / Asset | Component | Historical Symptom / Root Cause | Risk Level | Recommended Preventative Action |
|---|---|---|---|---|---|

*(Ensure Risk Level is categorized as P1 - CRITICAL, P2 - HIGH, P3 - MEDIUM, or P4 - ROUTINE).*

## 3. Recommended Upcoming Weekly Schedule (Week {{{targetWeek}}})
Structure the upcoming Monday–Sunday work program strictly into this Markdown table:
| Day | Site | Asset / Drive | Scope of Work | Priority | Suggested Allocation |
|---|---|---|---|---|---|

## 4. Latent Issues, Local-Mode Drives & Incomplete Actions
Provide distinct, detailed bullet points highlighting equipment currently operating in local mode, unresolved communication faults, or pending corrective actions from previous FSRs.

## 5. Critical Spares & Pre-Work Requirements
Provide distinct bullet points detailing necessary spare modules, capacitors, fuses, thermal paste, test instruments (megger, multimeter, thermal imager), and access permits needed for Week {{{targetWeek}}}.

## 6. Safety, Isolation & Housekeeping Protocols
Include 3 standard Altek Green engineering compliance points:
- **Isolation & Zero Energy:** Strict verification of Lockout/Tagout (LOTO) and DC bus discharge verification prior to MCC panel entry.
- **Environmental Shielding & Dust Control:** Proactive cleaning of heat sinks, cooling fan intakes, and panel sealing against sand and moisture ingress.
- **Real-Time Digital Compliance:** Mandatory completion of digital FSRs, daily diaries, and departure logs via the Altek Green mobile app.

---
### HISTORICAL DIAGNOSTIC DATA CONTEXT:

Field Service Reports (FSRs) logged in window:
{{#each fieldServiceReports}}
- Ref: {{this.fsrReference}}, Customer: {{this.customer}}, Site: {{this.site}}{{#if this.location}} ({{this.location}}){{/if}}, Asset: {{this.assetName}}, Date: {{this.date}}, Status: {{this.status}}
  {{#if this.customerFault}}* Customer Fault: {{this.customerFault}}{{/if}}
  {{#if this.techFindings}}* Tech Findings: {{this.techFindings}}{{/if}}
  {{#if this.rca}}* RCA: {{this.rca}}{{/if}}
  {{#if this.correctiveActions}}* Corrective Actions: {{this.correctiveActions}}{{/if}}
  {{#if this.recommendations}}* Recommendations: {{this.recommendations}}{{/if}}
{{/each}}

Daily Diaries in window:
{{#each dailyDiaries}}
- Date: {{this.date}}, Title: {{this.contractTitle}}{{#if this.contractorName}} (Technician: {{this.contractorName}}){{/if}}{{#if this.area}} [Area: {{this.area}}]{{/if}}
  {{#each this.works}}
  * Scope: {{this.scope}}{{#if this.area}} (Area: {{this.area}}){{/if}}
  {{/each}}
{{/each}}

New Breakdowns in window:
{{#each newBreakdowns}}
- Eq: {{this.equipmentName}}, Comp: {{this.component}}, Date: {{this.date}}, Resolved: {{this.resolved}}
{{/each}}

Resolved Breakdowns in window:
{{#each closedBreakdowns}}
- Eq: {{this.equipmentName}}, Comp: {{this.component}}, Date: {{this.date}}, Res: {{this.resolution}}
{{/each}}

Completed Maintenance Schedules in window:
{{#each completedSchedules}}
- Eq: {{this.equipmentName}}, Type: {{this.maintenanceType}}, Freq: {{this.frequency}}, Date: {{this.completionDate}}
{{/each}}

Equipment Master List:
{{#each equipment}}
- Name: {{this.name}}, SN: {{this.serialNumber}}, Plant: {{this.plant}}, Div: {{this.division}}, Status: {{this.status}}, Loc: {{this.location}}
{{/each}}
`,
});

const generateMaintenancePlanFlow = ai.defineFlow(
  {
    name: 'generateMaintenancePlanFlow',
    inputSchema: MaintenancePlanInputSchema,
    outputSchema: MaintenancePlanOutputSchema,
  },
  async (input) => {
    const { output } = await planPrompt(input);
    if (!output) {
      throw new Error('The AI failed to generate the predictive maintenance plan. Please verify the input range and try again.');
    }
    return output;
  }
);
