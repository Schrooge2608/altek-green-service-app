'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExtractFsrFromChatInput {
  chatHistory: string;
  equipmentName: string;
}

export interface ExtractFsrFromChatOutput {
  findings?: string;
  actions?: string;
  rca?: string;
  recommendations?: string;
  error?: string;
  success: boolean;
}

export async function extractFsrFromChat(input: ExtractFsrFromChatInput): Promise<ExtractFsrFromChatOutput> {
  if (!input.chatHistory || input.chatHistory.trim().length < 5) {
    return { success: false, error: "Chat history too short to process." };
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
        temperature: 0.1,
        responseMimeType: "application/json",
      }
    });

    const prompt = `
You are an intelligent Assistant for Industrial Contractors.
A team has been discussing a breakdown and repairs in a chat room. 
Your job is to read this chat transcript and intelligently extract the relevant information to fill out a formal Field Service Report (FSR).

Equipment: ${input.equipmentName}

Chat Transcript:
${input.chatHistory}

INSTRUCTIONS:
1. "findings": Extract and format ONLY the observations, issues, and diagnostics they found into professional bullet points.
2. "actions": Extract and format ONLY the repairs, replacements, and corrective actions they performed into professional bullet points.
3. "rca": Generate a formal Root Cause Analysis (RCA) based on the discussion. Format exactly as:
**Problem Statement:** [Brief summary]
**Root Cause:** [What caused it]
4. "recommendations": Extract any preventative recommendations or follow-up work they mentioned into professional bullet points. (Leave blank string if none mentioned).

CRITICAL: Return the data EXACTLY as a JSON object with these keys: "findings", "actions", "rca", "recommendations". Do NOT include conversational filler.
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
    console.error("Chat Extract Error:", error);
    return { success: false, error: error.message || "Failed to process chat history." };
  }
}
