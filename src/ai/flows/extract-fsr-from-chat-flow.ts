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
