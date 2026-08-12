'use server';
/**
 * @fileOverview An AI flow for reformatting technical notes into a structured format.
 * Bypasses Genkit's AI wrappers to use the stable native Google Generative AI SDK.
 *
 * - formatText - A function that takes rough notes and returns a formatted version.
 * - FormatTextInput - The input type for the formatText function.
 * - FormatTextOutput - The return type for the formatText function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { GoogleGenerativeAI } from '@google/generative-ai';

const FormatTextInputSchema = z.object({
  text: z.string().describe('The raw, unstructured text to be formatted.'),
});
export type FormatTextInput = z.infer<typeof FormatTextInputSchema>;

const FormatTextOutputSchema = z.object({
  formattedText: z.string().optional().describe('The formatted, structured text.'),
  error: z.string().optional(),
  success: z.boolean(),
});
export type FormatTextOutput = z.infer<typeof FormatTextOutputSchema>;

/**
 * A Genkit flow that uses the native Google Generative AI SDK to format technical text.
 * Hardened to return structured errors instead of crashing during network drops.
 */
const formatTextFlow = ai.defineFlow(
  {
    name: 'formatTextFlow',
    inputSchema: FormatTextInputSchema,
    outputSchema: FormatTextOutputSchema,
  },
  async (input) => {
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

      const promptText = `You are a professional maintenance planner. Rewrite the following rough notes into clear, structured, technical bullet points. If applicable, use headings like 'Issue', 'Cause', 'Action', and 'Result'. Keep it concise and professional.

Rough notes:
"${input.text}"
`;

      const result = await model.generateContent(promptText);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        return { success: false, error: "AI returned empty content." };
      }

      return { formattedText: text, success: true };
    } catch (error: any) {
      console.error("Native SDK Formatting Error:", error);
      return { success: false, error: error.message || "Network error or API failure." };
    }
  }
);

export async function formatText(input: FormatTextInput): Promise<FormatTextOutput> {
  return formatTextFlow(input);
}
