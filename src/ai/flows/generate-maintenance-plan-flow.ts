'use server';
/**
 * @fileOverview An AI flow for generating predictive weekly maintenance plans and equipment risk matrices
 * by cross-referencing historical Field Service Reports (FSRs), Daily Diaries, Breakdowns, and Asset registries.
 * Strictly limits schedule to Monday through Friday (excluding weekends) and returns structured tasks for editing.
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

export const MaintenanceTaskItemSchema = z.object({
  id: z.string().optional().default(''),
  day: z.string().describe('Monday, Tuesday, Wednesday, Thursday, or Friday ONLY. NEVER Saturday or Sunday.'),
  origin: z.string().describe('Client Mandate or Altek Predictive / PM'),
  site: z.string().describe('Site code, e.g. MPE, MPC, MPD, MPA, Smelter'),
  asset: z.string().describe('Equipment, drive, or asset name'),
  scope: z.string().describe('Specific scope of work and diagnostics to perform'),
  priority: z.string().describe('P1 - CRITICAL, P2 - HIGH, P3 - MEDIUM, or P4 - ROUTINE'),
  crewAllocation: z.string().describe('Exact crew size and technician names (e.g. Full Team (5 Techs), Pair (2 Techs): David & Buyani, Crew (3 Techs), or Solo (1 Tech))'),
  included: z.boolean().optional().default(true),
});
export type MaintenanceTaskItem = z.infer<typeof MaintenanceTaskItemSchema>;

const MaintenancePlanInputSchema = z.object({
  lookbackStartDate: z.string().describe('The start date of the diagnostic lookback window (yyyy-MM-dd)'),
  lookbackEndDate: z.string().describe('End date of the diagnostic lookback window (yyyy-MM-dd)'),
  targetWeek: z.number().describe('The target ISO week number (e.g. 45)'),
  targetStartDate: z.string().describe('Start date of the target maintenance week (Monday, yyyy-MM-dd)'),
  targetEndDate: z.string().describe('End date of the target maintenance week (Friday, yyyy-MM-dd)'),
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

export const MaintenancePlanOutputSchema = z.object({
  overview: z.string().describe('Executive plant reliability overview (2 flowing professional paragraphs, no bullet points)'),
  clientSection: z.string().describe('Summary of client-mandated priorities and shut window coordination'),
  riskMatrix: z.string().describe('Markdown table for Priority Risk Matrix & Critical Components at Risk with headers: | Site | Equipment / Asset | Component | Historical Symptom / Root Cause | Risk Level | Recommended Preventative Action | Required Crew |'),
  proposedTasks: z.array(MaintenanceTaskItemSchema).describe('List of scheduled tasks for Monday to Friday ONLY. Must NOT include Saturday or Sunday.'),
  latentIssues: z.string().describe('Bullet points of latent issues, drives operating in local mode, and unresolved FSR recommendations'),
  sparesRequirements: z.string().describe('Bullet points of critical spares, modules, capacitors, and test instruments required'),
  safetyProtocols: z.string().describe('Standard safety, LOTO, zero energy verification, and dust control compliance points'),
});
export type MaintenancePlanOutput = z.infer<typeof MaintenancePlanOutputSchema>;

export interface PlanGenerationResult {
  structured: MaintenancePlanOutput;
  compiledMarkdown: string;
}

/**
 * Compiles a formal Altek Green Markdown Report from the structured sections and ticked tasks.
 */
export async function compileMaintenanceReportMarkdown(params: {
  targetWeek: number;
  targetStartDate: string;
  targetEndDate: string;
  lookbackStartDate: string;
  lookbackEndDate: string;
  overview: string;
  clientSection: string;
  riskMatrix: string;
  tasks: Array<{
    id?: string;
    day: string;
    origin: string;
    site: string;
    asset: string;
    scope: string;
    priority: string;
    crewAllocation: string;
    included?: boolean;
  }>;
  latentIssues: string;
  sparesRequirements: string;
  safetyProtocols: string;
}): Promise<string> {
  const activeTasks = (params.tasks || []).filter(t => t.included !== false);

  let scheduleTable = `| Day | Origin / Type | Site | Asset / Drive | Scope of Work | Priority | Crew Size & Allocation |\n|---|---|---|---|---|---|---|`;

  if (activeTasks.length === 0) {
    scheduleTable += `\n| Monday – Friday | Altek Predictive / PM | All Sites | Plant-Wide Maintenance | No specific work orders selected for this period. | P4 - ROUTINE | Standby Team |`;
  } else {
    const dayOrder: Record<string, number> = {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
    };

    const sorted = [...activeTasks].sort((a, b) => {
      const dayA = dayOrder[a.day] || 99;
      const dayB = dayOrder[b.day] || 99;
      return dayA - dayB;
    });

    sorted.forEach(t => {
      const cleanScope = (t.scope || '').replace(/\|/g, '-').replace(/\n/g, ' ').trim();
      const cleanAsset = (t.asset || '').replace(/\|/g, '-').trim();
      const cleanCrew = (t.crewAllocation || '').replace(/\|/g, '-').trim();
      const cleanSite = (t.site || '').replace(/\|/g, '-').trim();
      const cleanOrigin = (t.origin || 'Altek Predictive / PM').replace(/\|/g, '-').trim();
      const cleanPriority = (t.priority || 'P2 - HIGH').replace(/\|/g, '-').trim();
      scheduleTable += `\n| ${t.day} | ${cleanOrigin} | ${cleanSite} | ${cleanAsset} | ${cleanScope} | ${cleanPriority} | ${cleanCrew} |`;
    });
  }

  return `# Weekly Predictive Maintenance Plan
**Prepared By:** Fritz Schroeder, Services Manager (KZN)  
**Planning Period:** Week ${params.targetWeek} (${params.targetStartDate} – ${params.targetEndDate})  
**Diagnostic Lookback Window:** ${params.lookbackStartDate} to ${params.lookbackEndDate}  
**Field Team Capacity:** 5 Electrical Technicians (Strict Daily Limit: Monday – Friday)

## 1. Plant Reliability & Operational Context
${params.overview.trim()}

## 2. Client-Mandated Priorities & Resource Commitment
${params.clientSection.trim()}

## 3. Priority Risk Matrix & Critical Components at Risk
${params.riskMatrix.trim()}

## 4. Finalized Weekly Schedule (Week ${params.targetWeek}: Monday – Friday)
${scheduleTable}

## 5. Balance-of-Week Focus & Latent Risk Mitigation
${params.latentIssues.trim()}

## 6. Critical Spares, Tools & Pre-Work Requirements
${params.sparesRequirements.trim()}

## 7. Safety, Isolation & Housekeeping Protocols
${params.safetyProtocols.trim()}
`;
}

export async function generateMaintenancePlan(
  input: any
): Promise<{ success: boolean; data?: PlanGenerationResult; error?: string }> {
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

    const structuredOutput = await generateMaintenancePlanFlow(safeInput);

    // Ensure all proposed tasks have unique IDs and default included = true
    const tasksWithIds = (structuredOutput.proposedTasks || []).map((t, idx) => ({
      ...t,
      id: t.id || `task-${Date.now()}-${idx}`,
      included: true,
      day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(t.day) ? t.day : 'Monday',
    }));

    structuredOutput.proposedTasks = tasksWithIds;

    const compiledMarkdown = await compileMaintenanceReportMarkdown({
      targetWeek: safeInput.targetWeek,
      targetStartDate: safeInput.targetStartDate,
      targetEndDate: safeInput.targetEndDate,
      lookbackStartDate: safeInput.lookbackStartDate,
      lookbackEndDate: safeInput.lookbackEndDate,
      overview: structuredOutput.overview,
      clientSection: structuredOutput.clientSection,
      riskMatrix: structuredOutput.riskMatrix,
      tasks: tasksWithIds,
      latentIssues: structuredOutput.latentIssues,
      sparesRequirements: structuredOutput.sparesRequirements,
      safetyProtocols: structuredOutput.safetyProtocols,
    });

    return {
      success: true,
      data: {
        structured: structuredOutput,
        compiledMarkdown,
      },
    };
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
### 1. CRITICAL SCHEDULE RULES & WEEKEND EXCLUSION:
- **Planning Window:** Monday {{{targetStartDate}}} to Friday {{{targetEndDate}}} (Week {{{targetWeek}}}).
- **STRICT WEEKEND EXCLUSION:** The Altek Green team DOES NOT work on Saturdays and Sundays. You MUST NOT schedule any tasks for Saturday or Sunday. All proposed tasks MUST be strictly assigned to: Monday, Tuesday, Wednesday, Thursday, or Friday.
- **Team Size:** Exactly 5 Electrical Technicians in the field crew.
  *(Typical team members: David Sikhumbuzo Msane [Lead/Drive Specialist], Ntokozo Zulu, Thulani Mthembu, Buyani Mthembu, and 5th Technician / Assistant)*.
- **Daily Headcount Cap:** The sum of technicians across all tasks on ANY given day can NEVER exceed 5.

{{#if clientSuggestedWork}}
---
### 2. CLIENT-MANDATED / SUGGESTED WORK (PRIORITY #1):
The client has provided the following specific requests or requirements:
"{{{clientSuggestedWork}}}"

**CLIENT SCHEDULING DIRECTIVES:**
1. Prioritize and lock in all client-mandated tasks for their specified days (e.g. if the client specified work for Monday and Tuesday, those MUST be assigned to Monday and Tuesday).
2. Assign the realistic crew size required for the client's work (e.g. Full Team of 5 for a major crane/feeder shut, or 2-3 techs for VSD capacitor change).
3. If the client takes all 5 technicians on Monday, NO other routine tasks can be scheduled on Monday.
4. If the client takes 2 technicians on Tuesday, only the remaining 3 technicians are available for other tasks on Tuesday.
5. For Wednesday, Thursday, and Friday, formulate Altek Green's proactive preventative maintenance program to address high-risk equipment and unaddressed FSR issues.
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
### 4. REALISTIC CREW SIZING (MAX 5 TECHS DAILY):
- **Full Team (All 5 Techs):** Major plant shutdowns, heavy crane drive replacements, large MCC overhauls. (When scheduled, no other work occurs on that day).
- **Crew of 3 Techs:** Heavy inverter module rebuilds, large DC bus capacitor bank replacement, high-voltage cable testing.
- **Safety Pair (2 Techs - Standard):** Routine MCC maintenance, fault finding, live phase/voltage testing, motor meggering (mandatory 1 lead + 1 safety observer).
- **Solo (1 Tech):** Low-risk work only: panel housekeeping, visual inspections, collecting spares/modules.

---
### 5. OUTPUT SPECIFICATIONS:
You must return structured data conforming to the output schema:
1. **overview:** 2 flowing professional paragraphs summarizing plant reliability, critical failure trends detected during the lookback period, and how the team is deployed for Week {{{targetWeek}}}.
2. **clientSection:** Detail the client-requested work (or state none were submitted) and explain how the team satisfies the client's window.
3. **riskMatrix:** A strict Markdown table with columns:
   | Site | Equipment / Asset | Component | Historical Symptom / Root Cause | Risk Level | Recommended Preventative Action | Required Crew |
   (Categorize Risk Level as P1 - CRITICAL, P2 - HIGH, P3 - MEDIUM, or P4 - ROUTINE).
4. **proposedTasks:** An array of task objects for **Monday to Friday ONLY**.
   - \`day\`: Monday, Tuesday, Wednesday, Thursday, or Friday. (NEVER Saturday or Sunday).
   - \`origin\`: 'Client Mandate' or 'Altek Predictive / PM'.
   - \`site\`: e.g. MPE, MPC, MPD, MPA, Smelter.
   - \`asset\`: Equipment / drive name.
   - \`scope\`: Clear scope of work and diagnostic action.
   - \`priority\`: 'P1 - CRITICAL', 'P2 - HIGH', 'P3 - MEDIUM', or 'P4 - ROUTINE'.
   - \`crewAllocation\`: e.g., 'Full Team (5 Techs): David Msane, Buyani Mthembu, Ntokozo Zulu, Thulani Mthembu, Tech 5' or 'Pair (2 Techs): David Msane & Buyani Mthembu'.
5. **latentIssues:** Bullet points of drives running in Local mode, unaddressed FSR recommendations, and pending comms/interlocks.
6. **sparesRequirements:** Bullet points of capacitors, IGBT modules, fuses, thermal paste, test meters, and permits needed for Week {{{targetWeek}}}.
7. **safetyProtocols:** Standard 3 points: Isolation & zero energy verification (2-man safety rule), MCC dust/moisture mitigation, and real-time app logging.

---
### HISTORICAL DIAGNOSTIC DATA CONTEXT (Lookback: {{{lookbackStartDate}}} to {{{lookbackEndDate}}}):

Field Service Reports (FSRs):
{{#each fieldServiceReports}}
- Ref: {{this.fsrReference}}, Customer: {{this.customer}}, Site: {{this.site}}{{#if this.location}} ({{this.location}}){{/if}}, Asset: {{this.assetName}}, Date: {{this.date}}, Status: {{this.status}}
  {{#if this.customerFault}}* Customer Fault: {{this.customerFault}}{{/if}}
  {{#if this.techFindings}}* Tech Findings: {{this.techFindings}}{{/if}}
  {{#if this.rca}}* RCA: {{this.rca}}{{/if}}
  {{#if this.correctiveActions}}* Corrective Actions: {{this.correctiveActions}}{{/if}}
  {{#if this.recommendations}}* Recommendations: {{this.recommendations}}{{/if}}
{{/each}}

Daily Diaries:
{{#each dailyDiaries}}
- Date: {{this.date}}, Title: {{this.contractTitle}}{{#if this.contractorName}} (Technician: {{this.contractorName}}){{/if}}{{#if this.area}} [Area: {{this.area}}]{{/if}}
  {{#each this.works}}
  * Scope: {{this.scope}}{{#if this.area}} (Area: {{this.area}}){{/if}}
  {{/each}}
{{/each}}

New Breakdowns:
{{#each newBreakdowns}}
- Eq: {{this.equipmentName}}, Comp: {{this.component}}, Date: {{this.date}}, Resolved: {{this.resolved}}
{{/each}}

Resolved Breakdowns:
{{#each closedBreakdowns}}
- Eq: {{this.equipmentName}}, Comp: {{this.component}}, Date: {{this.date}}, Res: {{this.resolution}}
{{/each}}

Completed Schedules:
{{#each completedSchedules}}
- Eq: {{this.equipmentName}}, Type: {{this.maintenanceType}}, Freq: {{this.frequency}}, Date: {{this.completionDate}}
{{/each}}

Equipment Master:
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
