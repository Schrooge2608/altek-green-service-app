'use server';
/**
 * @fileOverview AI logic for generating Root Cause Analysis (RCA) from breakdown logs.
 * Bypasses Genkit flows to use the stable native Google Generative AI SDK.
 *
 * - generateRca - A function that synthesizes raw logs into a formal RCA report.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GenerateRcaInput {
  resolutionNotes: string;
  equipmentName: string;
}

export interface GenerateRcaOutput {
  rca?: string;
  error?: string;
  success: boolean;
}

/**
 * Uses the native Google Generative AI SDK to synthesize technical logs into a professional RCA report.
 * Hardened to return structured error objects for better UI resilience.
 */
export async function generateRca(input: GenerateRcaInput): Promise<GenerateRcaOutput> {
  // Step 1: Add an Input Safety Check
  if (!input.resolutionNotes || input.resolutionNotes.trim().length < 10) {
    return { success: false, error: "Validation Error: Resolution notes are empty or too short to analyze." };
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
      }
    });

    const prompt = `
You are an expert Industrial Maintenance Engineer. 
Review the following raw timeline and chat logs from a breakdown on the equipment: ${input.equipmentName}.

Raw Logs:
"${input.resolutionNotes}"

Please synthesize these logs into a formal, concise Root Cause Analysis (RCA) report using the following format:

**Problem Statement:** (Brief summary of the fault)
**Root Cause:** (What actually caused the failure)
**Actions Taken:** (Bullet points of the repair steps)
**Preventative Recommendations:** (How to stop it happening again)

Do not invent information. If a section cannot be determined from the logs, state "Insufficient data provided in logs."
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      return { success: false, error: "AI returned empty content." };
    }

    return { rca: text, success: true };
  } catch (error: any) {
    console.error("Native SDK RCA Error Details:", error);
    return { success: false, error: error?.message || "Unknown API Error" };
  }
}
