'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ProcessBrainDumpInput {
  rawText: string;
  equipmentName?: string;
}

export interface ProcessBrainDumpOutput {
  findings?: string;
  actions?: string;
  rca?: string;
  recommendations?: string;
  error?: string;
  success: boolean;
}

export async function processBrainDump(input: ProcessBrainDumpInput): Promise<ProcessBrainDumpOutput> {
  if (!input.rawText || input.rawText.trim().length < 5) {
    return { success: false, error: "Text too short to process." };
  }

  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return { success: false, error: "AI API Key is missing from environment variables." };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      }
    });

    const prompt = `
You are a highly skilled Industrial Maintenance Engineering Assistant.
A technician has recorded a voice-to-text "brain dump" of their entire service job.
Your job is to read this unstructured text and intelligently split it out into the correct specific fields for their Field Service Report.

Equipment: ${input.equipmentName || "Unknown"}

Raw Notes from Technician:
"${input.rawText}"

INSTRUCTIONS:
1. "findings": Extract and format ONLY the observations, issues, and diagnostics they found into professional bullet points. Do not include actions here.
2. "actions": Extract and format ONLY the repairs, replacements, and corrective actions they performed into professional bullet points.
3. "rca": Generate a formal Root Cause Analysis (RCA) based on the notes. Format exactly as:
**Problem Statement:** [Brief summary]
**Root Cause:** [What caused it]
4. "recommendations": Extract any preventative recommendations or follow-up work they mentioned into professional bullet points. (Leave blank string if none mentioned).

CRITICAL: Do not use conversational filler. Provide ONLY the requested facts.

Return the data EXACTLY as a JSON object with these keys: "findings", "actions", "rca", "recommendations".
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      return { success: false, error: "AI returned empty content." };
    }

    const data = JSON.parse(text);

    return { 
      findings: data.findings || "",
      actions: data.actions || "",
      rca: data.rca || "",
      recommendations: data.recommendations || "",
      success: true 
    };
  } catch (error: any) {
    console.error("Brain Dump Error:", error);
    return { success: false, error: error.message || "Failed to process brain dump." };
  }
}
