import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export async function POST(req: Request) {
  const { messages, category } = await req.json();

  let systemPrompt = `You are a highly skilled industrial maintenance assistant for Altek Green. `;
  
  if (category) {
    systemPrompt += `You are currently advising a technician on the ${category.toUpperCase()} system.
Focus your answers on troubleshooting, maintenance best practices, and diagnostic steps related to ${category}.
`;
  }
  
  systemPrompt += `
Guidelines:
1. Provide concise, step-by-step troubleshooting instructions.
2. Use markdown formatting (bolding, lists) to make instructions easy to read.
3. Prioritize safety (e.g., Lockout/Tagout, verify zero energy) before recommending physical intervention.
4. If a fault code is mentioned, explain what it means and how to clear/fix it.
5. You are speaking to trained technicians. Do not be condescending, but do remind them of critical safety checks.
`;

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    messages,
  });

  return result.toTextStreamResponse();
}
