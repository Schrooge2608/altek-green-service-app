'use server';
/**
 * @fileOverview An AI flow for reformatting technical notes into a structured format.
 *
 * - formatText - A function that takes rough notes and returns a formatted version.
 * - FormatTextInput - The input type for the formatText function.
 * - FormatTextOutput - The return type for the formatText function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const FormatTextInputSchema = z.object({
  text: z.string().describe('The raw, unstructured text to be formatted.'),
});
export type FormatTextInput = z.infer<typeof FormatTextInputSchema>;

const FormatTextOutputSchema = z.object({
  formattedText: z.string().describe('The formatted, structured text.'),
});
export type FormatTextOutput = z.infer<typeof FormatTextOutputSchema>;

export async function formatText(input: FormatTextInput): Promise<FormatTextOutput> {
  return formatTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'formatTextPrompt',
  input: { schema: FormatTextInputSchema },
  output: { schema: FormatTextOutputSchema },
  prompt: `You are a professional maintenance planner. Rewrite the following rough notes into clear, structured, technical bullet points. If applicable, use headings like 'Issue', 'Cause', 'Action', and 'Result'. Keep it concise and professional.

Rough notes:
"{{{text}}}"
`,
});

const formatTextFlow = ai.defineFlow(
  {
    name: 'formatTextFlow',
    inputSchema: FormatTextInputSchema,
    outputSchema: FormatTextOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
