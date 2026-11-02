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

/**
 * Parses markdown table rows back into editable MaintenanceTaskItems.
 * Enables loading and amending previously compiled or saved plans seamlessly.
 */
export function parseMarkdownTableToTasks(markdown: string): MaintenanceTaskItem[] {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const tasks: MaintenanceTaskItem[] = [];
  let inTable = false;
  let headerIndexMap: { [key: string]: number } = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) {
      if (inTable && line.length > 0 && !line.startsWith('#')) {
        // Table ended
        inTable = false;
      }
      continue;
    }

    const cells = line
      .split('|')
      .map(c => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    // Identify header row
    if (cells.some(c => /day/i.test(c)) && cells.some(c => /asset|equipment|drive/i.test(c))) {
      inTable = true;
      headerIndexMap = {};
      cells.forEach((c, idx) => {
        const lower = c.toLowerCase();
        if (lower.includes('day')) headerIndexMap['day'] = idx;
        else if (lower.includes('origin') || lower.includes('type')) headerIndexMap['origin'] = idx;
        else if (lower.includes('site')) headerIndexMap['site'] = idx;
        else if (lower.includes('asset') || lower.includes('equipment') || lower.includes('drive')) headerIndexMap['asset'] = idx;
        else if (lower.includes('scope')) headerIndexMap['scope'] = idx;
        else if (lower.includes('priority')) headerIndexMap['priority'] = idx;
        else if (lower.includes('crew') || lower.includes('allocation')) headerIndexMap['crew'] = idx;
      });
      continue;
    }

    // Skip separator line (|---|---|)
    if (line.includes('---')) continue;

    if (inTable && cells.length >= 3) {
      const getVal = (key: string, fallback: string = '') => {
        const idx = headerIndexMap[key];
        return (idx !== undefined && cells[idx] !== undefined) ? cells[idx] : fallback;
      };

      const dayVal = getVal('day', cells[0] || 'Monday');
      const originVal = getVal('origin', cells[1] || 'Altek Predictive / PM');
      const siteVal = getVal('site', cells[2] || 'MPE');
      const assetVal = getVal('asset', cells[3] || 'Plant Equipment');
      const scopeVal = getVal('scope', cells[4] || 'Scheduled maintenance and diagnostic testing.');
      const priorityVal = getVal('priority', cells[5] || 'P2 - HIGH');
      const crewVal = getVal('crew', cells[6] || 'Pair (2 Techs)');

      // Ignore placeholder/empty row
      if (assetVal.toLowerCase().includes('no specific work orders') || scopeVal.toLowerCase().includes('no specific work orders')) {
        continue;
      }

      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const normalizedDay = validDays.find(d => d.toLowerCase() === dayVal.toLowerCase()) || 'Monday';

      tasks.push({
        id: `parsed-task-${Date.now()}-${tasks.length}`,
        day: normalizedDay,
        origin: originVal.toLowerCase().includes('client') ? 'Client Mandate' : 'Altek Predictive / PM',
        site: siteVal || 'MPE',
        asset: assetVal,
        scope: scopeVal,
        priority: priorityVal || 'P2 - HIGH',
        crewAllocation: crewVal || 'Pair (2 Techs)',
        included: true,
      });
    }
  }

  return tasks;
}

/**
 * Extracts sections from markdown report text if structuredPlan is not stored.
 */
export function parseMarkdownSections(markdown: string): Partial<MaintenancePlanOutput> {
  if (!markdown) return {};

  const extractSection = (headingRegex: RegExp, nextHeadingRegex: RegExp): string => {
    const match = markdown.match(headingRegex);
    if (!match || match.index === undefined) return '';
    const startIdx = match.index + match[0].length;
    const rest = markdown.slice(startIdx);
    const nextMatch = rest.match(nextHeadingRegex);
    const endIdx = nextMatch && nextMatch.index !== undefined ? nextMatch.index : rest.length;
    return rest.slice(0, endIdx).trim();
  };

  const overview = extractSection(/## 1\.[^\n]*/i, /## 2\.[^\n]*/i);
  const clientSection = extractSection(/## 2\.[^\n]*/i, /## 3\.[^\n]*/i);
  const riskMatrix = extractSection(/## 3\.[^\n]*/i, /## 4\.[^\n]*/i);
  const latentIssues = extractSection(/## 5\.[^\n]*/i, /## 6\.[^\n]*/i);
  const sparesRequirements = extractSection(/## 6\.[^\n]*/i, /## 7\.[^\n]*/i);
  const safetyProtocols = extractSection(/## 7\.[^\n]*/i, /## 8\.[^\n]*|$/i);

  return {
    overview: overview || undefined,
    clientSection: clientSection || undefined,
    riskMatrix: riskMatrix || undefined,
    latentIssues: latentIssues || undefined,
    sparesRequirements: sparesRequirements || undefined,
    safetyProtocols: safetyProtocols || undefined,
  };
}
