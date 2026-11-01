'use server';
/**
 * @fileOverview An AI flow for generating predictive weekly maintenance plans and equipment risk matrices
 * by cross-referencing historical Field Service Reports (FSRs), Daily Diaries, Breakdowns, and Asset registries.
 * Supports explicit 5-person team capacity management and client-suggested work prioritization.
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
  clientSuggestedWork: z.string().optional().describe('Client mandated or suggested tasks, e.g. for Monday and Tuesday'),
  customQuery: z.string().optional().describe('Specific focus, site, or technician instructions from Fritz Schroeder'),
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

Your role is to formulate a comprehensive, actionable, and forward-looking Weekly Maintenance Plan for Week {{{targetWeek}}} based on diagnostic lookback history, CLIENT-SUGGESTED WORK, and a STRICT 5-PERSON TEAM RESOURCE CONSTRAINT.

---
### 1. INPUT PARAMETERS:
- **Target Planning Week:** Week {{{targetWeek}}} ({{{targetStartDate}}} to {{{targetEndDate}}})
- **Diagnostic Lookback Window:** {{{lookbackStartDate}}} to {{{lookbackEndDate}}}
- **Team Size:** Exactly 5 Electrical Technicians in the field crew.
  *(Typical team members: David Sikhumbuzo Msane [Lead/Drive Specialist], Ntokozo Zulu, Thulani Mthembu, Buyani Mthembu, and 5th Technician / Assistant)*.

{{#if clientSuggestedWork}}
---
### 2. CLIENT-MANDATED / SUGGESTED WORK (PRIORITY #1):
The client has provided the following specific requests or requirements:
"{{{clientSuggestedWork}}}"

**CRITICAL CLIENT SCHEDULING DIRECTIVES:**
1. You MUST prioritize and lock in all client-mandated tasks for their specified days (e.g. if the client specified work for Monday and Tuesday, those MUST be assigned to Monday and Tuesday).
2. Assign the realistic team size required for the client's work (e.g. Full Team of 5 for a major crane/feeder shut, or 2-3 techs for VSD capacitor change).
3. If the client takes all 5 technicians on Monday, NO other routine tasks can be scheduled on Monday.
4. If the client takes 2 technicians on Tuesday, only the remaining 3 technicians are available for other tasks on Tuesday.
5. For the rest of the week (Wednesday, Thursday, Friday, and weekend stand-by), formulate Altek Green's proactive preventative maintenance program to address high-risk equipment and unaddressed FSR issues.
{{else}}
---
### 2. CLIENT WORK:
No client-mandated tasks were submitted. The entire 5-person team capacity is available for Altek Green's preventative and predictive maintenance program across Monday through Friday.
{{/if}}

{{#if customQuery}}
---
### 3. MANAGERIAL DIRECTIVES (FROM FRITZ SCHROEDER):
"{{{customQuery}}}"
{{/if}}

---
### 4. STRICT 5-PERSON TEAM RESOURCE ALLOCATION RULES:
1. **Total Daily Headcount Cap = 5:**
   The sum of technicians allocated across parallel scopes on ANY single day can NEVER exceed 5.
2. **Realistic Industrial Crew Sizes:**
   - **Full Team (All 5 Techs):** Major plant shutdowns, heavy crane drive replacements, large MCC overhauls, dredge power outages. When Full Team is assigned, no other work can happen on that day.
   - **Crew of 3 Techs:** Heavy inverter module rebuilds, large DC bus capacitor bank replacement, high-voltage cable testing, transformer isolations.
   - **Safety Pair (2 Techs - Standard):** Routine MCC maintenance, fault finding, live phase/voltage testing, motor meggering (mandatory 1 lead + 1 safety observer).
   - **Solo (1 Tech):** Low-risk work only: panel housekeeping, visual inspections, collecting spares/modules, or administrative permits.
3. **Table Column Requirement:**
   In the schedule table, the allocation column MUST explicitly state the crew size and names:
   e.g.:
   - \`Full Team (5 Techs): David Msane (Lead), Buyani Mthembu, Ntokozo Zulu, Thulani Mthembu, Tech 5\`
   - \`Pair (2 Techs): David Msane & Buyani Mthembu\`
   - \`Crew (3 Techs): Ntokozo Zulu (Lead), Thulani Mthembu, Tech 5\`
   - \`Solo (1 Tech): Buyani Mthembu (Panel Housekeeping)\`

---
### 5. LATENT ISSUES & PREDICTIVE LOOKBACK ANALYSIS:
- Cross-reference FSR diagnostics, RCA notes, technician findings, and diary scopes across the lookback period.
- Audit temporary bypasses and drives left running in "Local mode" without PLC automation (e.g., DeviceNet comms failure on Smelter S30 feeder).
- Track recurring earth faults, cable insulation degradation, IGBT blowouts, and capacitor lifecycle due dates.

---
### 6. CRITICAL MARKDOWN FORMATTING RULES:
1. Top heading must be:
   # Weekly Predictive Maintenance Plan
   **Prepared By:** Fritz Schroeder, Services Manager (KZN)  
   **Planning Period:** Week {{{targetWeek}}} ({{{targetStartDate}}} – {{{targetEndDate}}})  
   **Diagnostic Lookback Window:** {{{lookbackStartDate}}} to {{{lookbackEndDate}}}  
   **Field Team Capacity:** 5 Electrical Technicians (Strict Daily Limit)

2. Tables must follow strict GitHub-flavored Markdown:
   - Preceded by an empty blank line.
   - Header row immediately followed by delimiter row (\`|---|---|...|\`).
   - Every data row on its own separate line.
   - NEVER combine multiple rows onto one line.
   - Followed by an empty blank line before the next text.

---
### 7. REQUIRED DOCUMENT STRUCTURE:

# Weekly Predictive Maintenance Plan
**Prepared By:** Fritz Schroeder, Services Manager (KZN)  
**Planning Period:** Week {{{targetWeek}}} ({{{targetStartDate}}} – {{{targetEndDate}}})  
**Diagnostic Lookback Window:** {{{lookbackStartDate}}} to {{{lookbackEndDate}}}  
**Field Team Capacity:** 5 Electrical Technicians (Strict Daily Limit)

## 1. Plant Reliability & Operational Context
Write 2 clear, professional paragraphs providing a strategic overview of plant stability, key failure trends detected during the lookback period, and how team deployment balances client mandates with preventative maintenance for Week {{{targetWeek}}}. Do not use bullet points here.

## 2. Client-Mandated Priorities & Resource Commitment
{{#if clientSuggestedWork}}
Detail the client-requested work (e.g., Monday & Tuesday priorities), explaining the scope, why the allocated crew size (e.g. 2, 3, or all 5 techs) was chosen, and confirming compliance with client shut windows.
{{else}}
State: "No direct client-mandated shut tasks were registered for this period. 100% of the 5-man team capacity is scheduled for Altek Green proactive reliability interventions."
{{/if}}

## 3. Priority Risk Matrix & Critical Components at Risk
Extract all high-risk assets and degrading components strictly into this Markdown table:
| Site | Equipment / Asset | Component | Historical Symptom / Root Cause | Risk Level | Recommended Preventative Action | Required Crew |
|---|---|---|---|---|---|---|

*(Ensure Risk Level is categorized as P1 - CRITICAL, P2 - HIGH, P3 - MEDIUM, or P4 - ROUTINE).*

## 4. Unified Weekly Schedule (Week {{{targetWeek}}}: Monday – Sunday)
Structure the upcoming Monday–Sunday work program strictly into this Markdown table:
| Day | Origin / Type | Site | Asset / Drive | Scope of Work | Priority | Crew Size & Allocation |
|---|---|---|---|---|---|---|

*(Rules for table:
- **Origin / Type** MUST be either \`Client Mandate\` or \`Altek Predictive / PM\`.
- **Crew Size & Allocation** MUST specify crew count and technician names.
- Verify that on any given day, total technicians assigned across rows does NOT exceed 5).*

## 5. Balance-of-Week Focus & Latent Risk Mitigation
Detail the technical rationale for tasks scheduled on Wednesday–Friday (and weekend stand-by), showing how drives operating in Local mode, unaddressed FSR recommendations, and pending comms/interlocks are resolved.

## 6. Critical Spares, Tools & Pre-Work Requirements
Provide distinct bullet points detailing necessary spare modules, capacitors, fuses, thermal paste, test instruments (megger, multimeter, thermal imager), and access permits needed for Week {{{targetWeek}}}.

## 7. Safety, Isolation & Housekeeping Protocols
Include 3 standard Altek Green engineering compliance points:
- **Isolation & Zero Energy:** Strict verification of Lockout/Tagout (LOTO) and DC bus discharge verification prior to MCC panel entry (mandatory 2-man safety rule for energized areas).
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
