/**
 * @fileOverview Client & Server utility functions and types for AI Maintenance Planner.
 */

export interface MaintenanceTaskItem {
  id?: string;
  day: string;
  origin: string;
  site: string;
  asset: string;
  scope: string;
  priority: string;
  crewAllocation: string;
  included?: boolean;
}

export interface MaintenancePlanOutput {
  overview: string;
  clientSection: string;
  riskMatrix: string;
  proposedTasks: MaintenanceTaskItem[];
  latentIssues: string;
  sparesRequirements: string;
  safetyProtocols: string;
}

export interface PlanGenerationResult {
  structured: MaintenancePlanOutput;
  compiledMarkdown: string;
}

/**
 * Compiles a formal Altek Green Markdown Report from the structured sections and ticked tasks.
 */
export function compileMaintenanceReportMarkdown(params: {
  targetWeek: number;
  targetStartDate: string;
  targetEndDate: string;
  lookbackStartDate: string;
  lookbackEndDate: string;
  overview?: string;
  clientSection?: string;
  riskMatrix?: string;
  tasks: MaintenanceTaskItem[];
  latentIssues?: string;
  sparesRequirements?: string;
  safetyProtocols?: string;
}): string {
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

  const overviewText = (params.overview || 'Plant stability was monitored across the reporting period.').trim();
  const clientText = (params.clientSection || 'Client-mandated tasks coordinated with site operational windows.').trim();
  const riskText = (params.riskMatrix || '| Site | Equipment | Component | Symptom | Risk Level | Action | Crew |\n|---|---|---|---|---|---|---|').trim();
  const latentText = (params.latentIssues || '- All active equipment monitored for anomalous behavior.').trim();
  const sparesText = (params.sparesRequirements || '- Standard technician toolkits and safety consumables.').trim();
  const safetyText = (params.safetyProtocols || '- Zero Energy verification and LOTO prior to MCC entry.').trim();

  return `# Weekly Predictive Maintenance Plan
**Prepared By:** Fritz Schroeder, Services Manager (KZN)  
**Planning Period:** Week ${params.targetWeek} (${params.targetStartDate} – ${params.targetEndDate})  
**Diagnostic Lookback Window:** ${params.lookbackStartDate} to ${params.lookbackEndDate}  
**Field Team Capacity:** 5 Electrical Technicians (Strict Daily Limit: Monday – Friday)

## 1. Plant Reliability & Operational Context
${overviewText}

## 2. Client-Mandated Priorities & Resource Commitment
${clientText}

## 3. Priority Risk Matrix & Critical Components at Risk
${riskText}

## 4. Finalized Weekly Schedule (Week ${params.targetWeek}: Monday – Friday)
${scheduleTable}

## 5. Balance-of-Week Focus & Latent Risk Mitigation
${latentText}

## 6. Critical Spares, Tools & Pre-Work Requirements
${sparesText}

## 7. Safety, Isolation & Housekeeping Protocols
${safetyText}
`;
}
