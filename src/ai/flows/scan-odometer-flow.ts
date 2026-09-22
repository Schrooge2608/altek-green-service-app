'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const OdometerScanInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe("A photo of a vehicle dashboard/odometer, as a base64 data URI."),
});
export type OdometerScanInput = z.infer<typeof OdometerScanInputSchema>;

const OdometerScanOutputSchema = z.object({
  kilometers: z.number().optional().describe('The odometer reading in kilometers.'),
  success: z.boolean().optional(),
  error: z.string().optional(),
});
export type OdometerScanOutput = z.infer<typeof OdometerScanOutputSchema>;

export async function scanOdometer(input: OdometerScanInput): Promise<OdometerScanOutput> {
  return scanOdometerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanOdometerPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: OdometerScanInputSchema },
  output: { schema: OdometerScanOutputSchema },
  config: {
    temperature: 0.1,
  },
  prompt: `You are a fleet management data assistant.
Analyze the provided image of a vehicle's dashboard or odometer.

Extract the total distance/mileage/odometer reading.
Ensure you return only the numeric value in kilometers (or the primary distance unit shown).
Ignore trip meters if they are distinguishable from the main odometer.
Return only the numeric value. If you cannot determine the reading, omit it.

Odometer Image: {{media url=imageDataUri}}`,
});

const scanOdometerFlow = ai.defineFlow(
  {
    name: 'scanOdometerFlow',
    inputSchema: OdometerScanInputSchema,
    outputSchema: OdometerScanOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        return { 
          success: false, 
          error: "AI failed to extract the reading from the dashboard. Please try a clearer photo." 
        };
      }
      return { ...output, success: true };
    } catch (error: any) {
      console.error("Odometer Scan Flow Error Details:", error);
      
      const errorMsg = error?.message?.toLowerCase() || "";
      const isOverloaded = errorMsg.includes('503') || errorMsg.includes('429') || errorMsg.includes('overloaded') || errorMsg.includes('unavailable');
      
      if (isOverloaded) {
        return {
          success: false,
          error: "The AI service is currently experiencing high traffic. Please try your scan again in a few moments."
        };
      }

      return {
        success: false,
        error: `AI Error: ${error.message || "An unexpected error occurred during the AI scan."}`
      };
    }
  }
);
