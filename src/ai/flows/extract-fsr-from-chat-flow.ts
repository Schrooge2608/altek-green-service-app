'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExtractFsrFromChatInput {
  chatHistory: string;
  equipmentName?: string;
  availableEquipmentNames?: string[];
}

export interface ExtractFsrFromChatOutput {
  date?: string;
  area?: 'Mining' | 'Smelter';
  customer?: string;
  site?: string;
  equipmentNames?: string[];
  timeCallOut?: string;
  timeArrival?: string;
  timeStart?: string;
  timeEnd?: string;
  timeDeparture?: string;
  customerFault?: string;
  findings?: string;
  actions?: string;
  rca?: string;
  recommendations?: string;
  parts?: {
    partNo?: string;
    description: string;
    qty: number;
    unit?: string;
  }[];
  personnel?: {
    name: string;
    role?: string;
    hrs?: number;
  }[];
  error?: string;
  success: boolean;
}

export async function extractFsrFromChat(input: ExtractFsrFromChatInput): Promise<ExtractFsrFromChatOutput> {
  if (!input.chatHistory || input.chatHistory.trim().length < 5) {
    return { success: false, error: 'Chat history too short to process.' };
  }

  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return { success: false, error: 'AI API Key is missing from environment variables.' };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const equipmentCatalogHint = input.availableEquipmentNames && input.availableEquipmentNames.length > 0
    ? `\nKnown Plant Equipment Names (match to these exact names if mentioned in the chat):\n${input.availableEquipmentNames.slice(0, 150).join(', ')}\n`
    : '';

  const prompt = `
You are an expert Industrial Maintenance Assistant for Altek Green.
A maintenance team has been communicating in a WhatsApp / Site Comms group chat regarding a breakdown or service job.
Read the group chat transcript below (which includes dates, times, sender names, and messages) and extract structured Field Service Report (FSR) details.

Target / Primary Equipment (if already selected): ${input.equipmentName || 'Auto-detect from chat'}
${equipmentCatalogHint}

Group Chat Transcript:
${input.chatHistory}

INSTRUCTIONS:
1. "date": The primary date of the job in YYYY-MM-DD format (infer from message timestamps or text).
2. "area": Either "Mining" or "Smelter" if clear from context (e.g. MPA, MPB, MPC, MPD, MPE, Nhlabane, Pozzolan, Monzi = "Mining"; Smelter, Roaster, MSP, Char Plant, Slag Plant, Furnace = "Smelter").
3. "site": Specific plant/area name if mentioned (e.g. "MPA", "MPC", "Smelter", etc.).
4. "customer": Maintenance Controller or Shift Supervisor name if mentioned.
5. "equipmentNames": Array of all equipment/asset names worked on during this job (if multiple pieces of equipment were worked on, list all of them). Match against Known Plant Equipment Names when possible.
6. "timeCallOut", "timeArrival", "timeStart", "timeEnd", "timeDeparture": 24-hour HH:mm times if mentioned in the text or inferable from the start/end timestamps of the breakdown messages.
7. "customerFault": Concise summary of the initial reported fault / reason for callout.
8. "findings": Extract and format ONLY the technical observations, fault diagnostics, and issues found into professional bullet points.
9. "actions": Extract and format ONLY the repairs, replacements, resets, testing, and corrective actions performed into professional bullet points.
10. "rca": Generate a formal Root Cause Analysis (RCA) based on the discussion:
Problem Statement: [Brief summary]
Root Cause: [What caused it]
11. "recommendations": Any follow-up work or preventative recommendations mentioned (or empty string if none).
12. "parts": Array of any spare parts or consumables used: [{ "partNo": "", "description": "Part name", "qty": 1, "unit": "EA" }].
13. "personnel": Array of technicians who attended/reported the work in the chat: [{ "name": "Full Name", "role": "Technician", "hrs": 0 }].

Return ONLY valid JSON matching those exact keys.
`;

  const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastError = 'Failed to process chat history.';

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      if (!text) continue;

      if (text.startsWith('```json')) {
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const data = JSON.parse(text);

      return {
        date: data.date || undefined,
        area: data.area === 'Mining' || data.area === 'Smelter' ? data.area : undefined,
        customer: data.customer || undefined,
        site: data.site || undefined,
        equipmentNames: Array.isArray(data.equipmentNames) ? data.equipmentNames.filter(Boolean) : undefined,
        timeCallOut: data.timeCallOut || undefined,
        timeArrival: data.timeArrival || undefined,
        timeStart: data.timeStart || undefined,
        timeEnd: data.timeEnd || undefined,
        timeDeparture: data.timeDeparture || undefined,
        customerFault: data.customerFault || undefined,
        findings: data.findings || '',
        actions: data.actions || '',
        rca: data.rca || '',
        recommendations: data.recommendations || '',
        parts: Array.isArray(data.parts) ? data.parts : [],
        personnel: Array.isArray(data.personnel) ? data.personnel : [],
        success: true,
      };
    } catch (err: any) {
      lastError = err?.message || lastError;
    }
  }

  return { success: false, error: lastError };
}

export interface ExtractDailyDiaryFromChatOutput {
  date?: string;
  area?: 'Mining' | 'Smelter';
  workType?: 'Normal' | 'Callout';
  maintenanceType?: 'Scheduled' | 'Unscheduled' | 'Both';
  shiftStart?: string;
  shiftEnd?: string;
  hrs?: number;
  incidents?: string;
  toolboxTalk?: string;
  manpower?: {
    designation: string;
    forecast: number;
    actual: number;
    normalHrs: number;
    overtime1_5: number;
    overtime2_0: number;
    totalManHrs: number;
    comments: string;
  }[];
  works?: {
    area: string;
    scope: string;
    timeStart: string;
    timeEnd: string;
    hrs: number;
  }[];
  delays?: string[];
  comments?: string[];
  locationTags?: string[];
  equipmentNames?: string[];
  error?: string;
  success: boolean;
}

export async function extractDailyDiaryFromChat(
  input: ExtractFsrFromChatInput
): Promise<ExtractDailyDiaryFromChatOutput> {
  if (!input.chatHistory || input.chatHistory.trim().length < 5) {
    return { success: false, error: 'Chat history too short to process.' };
  }

  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'AI API Key is missing from environment variables.' };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const equipmentCatalogHint =
    input.availableEquipmentNames && input.availableEquipmentNames.length > 0
      ? `\nKnown Plant Equipment Names:\n${input.availableEquipmentNames.slice(0, 150).join(', ')}\n`
      : '';

  const prompt = `
You are an expert Industrial Maintenance Assistant for Altek Green.
Read the group chat transcript below (especially day-shift / office-hours 07:00–16:00 maintenance and inspection updates, or call-out work) and extract structured Contractors Daily Diary (DD) details.

Target / Primary Equipment (if already selected): ${input.equipmentName || 'Auto-detect from chat'}
${equipmentCatalogHint}

Group Chat Transcript:
${input.chatHistory}

INSTRUCTIONS:
1. "date": Primary date in YYYY-MM-DD format.
2. "area": Either "Mining" or "Smelter" (MPA, MPB, MPC, MPD, MPE, Nhlabane, Mposa, Monzi = "Mining"; MSP, Roaster, Char Plant, Smelter, Slag Plant, North Screen = "Smelter").
3. "workType": "Normal" (if during 07:00-16:00 office hours / routine maintenance) or "Callout" (if after-hours breakdown).
4. "maintenanceType": "Scheduled", "Unscheduled", or "Both".
5. "shiftStart": 24h HH:mm (default "07:00" for normal shift or earliest timestamp).
6. "shiftEnd": 24h HH:mm (default "16:00" for normal shift or latest timestamp).
7. "hrs": Total shift hours (e.g. 9 for 07:00-16:00, or calculated duration).
8. "incidents": Any safety incidents mentioned, or "None reported".
9. "toolboxTalk": Brief safety topic relevant to the work (e.g. "LOTOTO, VSD Isolation & Safe Working Procedures").
10. "manpower": Array of technicians who reported or worked in the chat:
    [{ "designation": "Technician Name", "forecast": 1, "actual": 1, "normalHrs": 8, "overtime1_5": 0, "overtime2_0": 0, "totalManHrs": 8, "comments": "Maintenance / Inspection" }]
11. "works": Array of distinct maintenance tasks / scopes of work performed (each row has "area" set to the Equipment/Plant name like "MPA - Final Tails" or "MPA Concentrator", "scope" set to a clear description of maintenance/work done, "timeStart", "timeEnd", and "hrs").
12. "delays": Array of any plant/permit/standby delays mentioned (or empty strings).
13. "comments": Array of key technical observations, follow-ups, or handovers mentioned.

Return ONLY valid JSON matching those exact keys.
`;

  const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastError = 'Failed to process chat history for Daily Diary.';

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      if (!text) continue;

      if (text.startsWith('```json')) {
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const data = JSON.parse(text);
      return {
        date: data.date || undefined,
        area: data.area === 'Smelter' ? 'Smelter' : 'Mining',
        workType: data.workType === 'Callout' ? 'Callout' : 'Normal',
        maintenanceType:
          data.maintenanceType === 'Scheduled' || data.maintenanceType === 'Both'
            ? data.maintenanceType
            : 'Unscheduled',
        shiftStart: data.shiftStart || '07:00',
        shiftEnd: data.shiftEnd || '16:00',
        hrs: typeof data.hrs === 'number' ? data.hrs : 9,
        incidents: data.incidents || 'None reported',
        toolboxTalk: data.toolboxTalk || 'Safe Working Procedures & Isolation',
        manpower: Array.isArray(data.manpower) ? data.manpower : [],
        works: Array.isArray(data.works) ? data.works : [],
        delays: Array.isArray(data.delays) ? data.delays : [],
        comments: Array.isArray(data.comments) ? data.comments : [],
        success: true,
      };
    } catch (err: any) {
      lastError = err?.message || lastError;
    }
  }

  return { success: false, error: lastError };
}

export interface EquipmentSummaryAndRcaItem {
  equipmentName: string;
  area?: 'Mining' | 'Smelter';
  date?: string;
  timeStart?: string;
  timeEnd?: string;
  hrs?: number;
  summaryBullets: string[];
  rcaBullets: string[];
}

export interface SummarizeChatWithRcaOutput {
  date?: string;
  area?: 'Mining' | 'Smelter';
  workType?: 'Normal' | 'Callout';
  maintenanceType?: 'Scheduled' | 'Unscheduled' | 'Both';
  shiftStart?: string;
  shiftEnd?: string;
  hrs?: number;
  technicians?: string[];
  equipmentBreakdowns: EquipmentSummaryAndRcaItem[];
  delays?: string[];
  error?: string;
  success: boolean;
}

function buildFallbackSummaryWithRca(input: ExtractFsrFromChatInput): SummarizeChatWithRcaOutput {
  const lines = input.chatHistory
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let detectedDate = '';
  let earliestTime = '';
  let latestTime = '';
  const senderSet = new Set<string>();
  const factualLines: { equipmentHint: string; text: string }[] = [];

  const slangOnlyRegex =
    /^(ok|okay|sharp|100%|copy|noted|thanks|thank you|yes|no|ja|yebo|good morning|morning|afternoon|evening|hi|hello|on our way|we are on our way|👍|👌|\s)+$/i;

  for (const line of lines) {
    const dtMatch = line.match(/\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\]\s*([^:]+):\s*(.+)$/);
    const rawMsg = dtMatch ? dtMatch[4] : line;
    if (dtMatch) {
      if (!detectedDate) detectedDate = dtMatch[1];
      const t = dtMatch[2];
      if (!earliestTime || t < earliestTime) earliestTime = t;
      if (!latestTime || t > latestTime) latestTime = t;
      const sender = dtMatch[3].trim();
      if (sender && sender.toUpperCase() !== 'YOU') senderSet.add(sender);
    }

    const cleaned = rawMsg
      .replace(/\[\s*forwarded\s*\]/gi, '')
      .replace(/<\s*(image|video|media|audio|sticker|gif|document)\s+omitted\s*>/gi, '')
      .trim();

    if (!cleaned || cleaned.length < 6 || slangOnlyRegex.test(cleaned)) continue;

    // Detect equipment mention in this message
    const eqMatch = cleaned.match(
      /\b(MPA|MPB|MPC|MPD|MPE|Smelter|Roaster|MSP|Char Plant)\b[^.,;\n]{0,40}/i
    );
    const eqHint = eqMatch ? eqMatch[0].trim() : input.equipmentName || 'Plant Equipment';
    factualLines.push({ equipmentHint: eqHint, text: cleaned });
  }

  const primaryEq = input.equipmentName || factualLines[0]?.equipmentHint || 'Plant Equipment';
  const summaryBullets = factualLines.slice(0, 10).map((f) => f.text);
  const rcaBullets = factualLines
    .filter((f) => /\b(fuse|blown|trip|fault|cause|damaged|burnt|igbt|short|overload|permit|replace|kit|abb|acs)\b/i.test(f.text))
    .slice(0, 6)
    .map((f) => f.text);

  return {
    date: detectedDate || undefined,
    area: /\b(smelter|roaster|msp|furnace|slag|char)\b/i.test(input.chatHistory) ? 'Smelter' : 'Mining',
    workType: 'Callout',
    maintenanceType: 'Unscheduled',
    shiftStart: earliestTime || '07:00',
    shiftEnd: latestTime || '16:00',
    hrs: 8,
    technicians: Array.from(senderSet),
    equipmentBreakdowns: [
      {
        equipmentName: primaryEq,
        area: 'Mining',
        date: detectedDate || undefined,
        timeStart: earliestTime || '07:00',
        timeEnd: latestTime || '16:00',
        hrs: 8,
        summaryBullets:
          summaryBullets.length > 0 ? summaryBullets : ['Technical discussion recorded in Site Comms chat.'],
        rcaBullets:
          rcaBullets.length > 0
            ? rcaBullets
            : ['Investigated fault conditions reported in chat and verified drive/equipment components.'],
      },
    ],
    delays: [],
    success: true,
  };
}

export async function summarizeChatWithRca(
  input: ExtractFsrFromChatInput
): Promise<SummarizeChatWithRcaOutput> {
  if (!input.chatHistory || input.chatHistory.trim().length < 5) {
    return { success: false, equipmentBreakdowns: [], error: 'Chat history too short to summarize.' };
  }

  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return buildFallbackSummaryWithRca(input);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const equipmentCatalogHint =
    input.availableEquipmentNames && input.availableEquipmentNames.length > 0
      ? `\nKnown Plant Equipment Names (match to these when applicable):\n${input.availableEquipmentNames.slice(0, 150).join(', ')}\n`
      : '';

  const prompt = `
You are a Senior Reliability & VSD Maintenance Engineer for Altek Green.
Analyze the WhatsApp / Site Comms chat transcript below and generate a structured, strictly factual SUMMARY and ROOT CAUSE ANALYSIS (RCA) per piece of equipment discussed.

Channel / Default Equipment Name: ${input.equipmentName || 'Auto-detect from chat'}
${equipmentCatalogHint}

Chat Transcript:
${input.chatHistory}

CRITICAL RULES:
1. IDENTIFY ALL EQUIPMENT DISCUSSED:
   - Look up the identity of each distinct piece of equipment mentioned in the chat (e.g., "MPE - Dredge 2 Main Pump", "MPA - Final Tails Transfer VSD", "MPE Pump 1", etc.).
   - If ONLY ONE piece of equipment is discussed, return 1 object in "equipmentBreakdowns".
   - If TWO OR MORE pieces of equipment are discussed in the same day/date range, create a SEPARATE object in "equipmentBreakdowns" for EACH piece of equipment so each equipment gets its own Equipment Name, its own SUMMARY bullets, and its own RCA bullets!
2. FILTER OUT ALL SLANG & CHIT-CHAT:
   - Completely remove all slang, greetings ("Morning", "Sharp", "Okay", "100%", "Copy", "Noted", "Thanks"), vague questions where the person doesn't know ("I am not sure"), and "<image omitted>" / "<video omitted>" tags.
   - Present ONLY verified engineering/maintenance FACTS in professional, concise bullet points.
3. FOR EACH PIECE OF EQUIPMENT IN "equipmentBreakdowns", PROVIDE:
   - "equipmentName": Clear, specific equipment identity (e.g. "MPE Dredge 2 Main Pump (ACS600)" or "MPA Final Tails Transfer VSD").
   - "area": "Mining" or "Smelter".
   - "date": YYYY-MM-DD date of the work.
   - "timeStart": HH:mm start time for this equipment.
   - "timeEnd": HH:mm end time for this equipment.
   - "hrs": Numeric duration in hours (minimum 1).
   - "summaryBullets": Array of clean factual bullet strings (chronological facts: call-out reason, permits obtained, spares/parts checked or ordered with part numbers, inspections done, repairs/actions completed).
   - "rcaBullets": Array of clean bullet strings covering the Root Cause Analysis (Symptom/Fault observed, Technical Root Cause e.g. blown inverter fuses / IGBT failure / fiber optic / overload, Contributing factors, and Corrective / Preventative actions required).
4. TOP-LEVEL FIELDS:
   - "date": Primary YYYY-MM-DD date from the chat.
   - "area": "Mining" or "Smelter".
   - "workType": "Callout" or "Normal".
   - "maintenanceType": "Unscheduled", "Scheduled", or "Both".
   - "shiftStart": Earliest HH:mm.
   - "shiftEnd": Latest HH:mm.
   - "hrs": Total hours.
   - "technicians": Array of Altek Green technician names who attended/reported in the chat.
   - "delays": Array of any delays mentioned (e.g. waiting for barge, missing fuses in store, waiting for permit).

Return ONLY valid JSON matching those exact keys.
`;

  const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      if (!text) continue;

      if (text.startsWith('```json')) {
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const data = JSON.parse(text);
      const breakdowns: EquipmentSummaryAndRcaItem[] = Array.isArray(data.equipmentBreakdowns)
        ? data.equipmentBreakdowns.map((item: any) => ({
            equipmentName: item.equipmentName || input.equipmentName || 'Plant Equipment',
            area: item.area === 'Smelter' ? 'Smelter' : 'Mining',
            date: item.date || data.date || undefined,
            timeStart: item.timeStart || data.shiftStart || '07:00',
            timeEnd: item.timeEnd || data.shiftEnd || '16:00',
            hrs: typeof item.hrs === 'number' && item.hrs > 0 ? item.hrs : 4,
            summaryBullets: Array.isArray(item.summaryBullets)
              ? item.summaryBullets.map((s: any) => String(s).trim()).filter(Boolean)
              : [],
            rcaBullets: Array.isArray(item.rcaBullets)
              ? item.rcaBullets.map((s: any) => String(s).trim()).filter(Boolean)
              : [],
          }))
        : [];

      if (breakdowns.length === 0) continue;

      return {
        date: data.date || undefined,
        area: data.area === 'Smelter' ? 'Smelter' : 'Mining',
        workType: data.workType === 'Normal' ? 'Normal' : 'Callout',
        maintenanceType:
          data.maintenanceType === 'Scheduled' || data.maintenanceType === 'Both'
            ? data.maintenanceType
            : 'Unscheduled',
        shiftStart: data.shiftStart || '07:00',
        shiftEnd: data.shiftEnd || '16:00',
        hrs: typeof data.hrs === 'number' ? data.hrs : 8,
        technicians: Array.isArray(data.technicians) ? data.technicians.filter(Boolean) : [],
        equipmentBreakdowns: breakdowns,
        delays: Array.isArray(data.delays) ? data.delays.filter(Boolean) : [],
        success: true,
      };
    } catch {
      // Try next candidate model
    }
  }

  return buildFallbackSummaryWithRca(input);
}
