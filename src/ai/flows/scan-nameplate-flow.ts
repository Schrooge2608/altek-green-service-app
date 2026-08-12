
'use server';
/**
 * @fileOverview AI flow for extracting technical specifications from equipment nameplate photos.
 * 
 * - scanNameplate - A function that analyzes an image and returns structured equipment data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const NameplateScanInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of an industrial equipment nameplate, as a base64 data URI."
    ),
});
export type NameplateScanInput = z.infer<typeof NameplateScanInputSchema>;

const NameplateScanOutputSchema = z.object({
  manufacturer: z.string().optional().describe('The manufacturer of the equipment (e.g., WEG, SEW, ABB).'),
  model: z.string().optional().describe('The model or type designation.'),
  serialNumber: z.string().optional().describe('The unique serial number.'),
  motorPower: z.number().optional().describe('The power rating in kW.'),
  motorVoltage: z.number().optional().describe('The rated voltage in Volts.'),
  motorFrameType: z.string().optional().describe('The frame size or type (e.g., 132M).'),
  success: z.boolean().optional(),
  error: z.string().optional(),
});
export type NameplateScanOutput = z.infer<typeof NameplateScanOutputSchema>;

export async function scanNameplate(input: NameplateScanInput): Promise<NameplateScanOutput> {
  return scanNameplateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanNameplatePrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: NameplateScanInputSchema },
  output: { schema: NameplateScanOutputSchema },
  config: {
    temperature: 0.1,
  },
  prompt: `You are an industrial maintenance data specialist. 
Analyze the provided image of an equipment nameplate (motor, VSD, or pump).

Extract the following technical details into a structured format:
1. Manufacturer: Look for brand names.
2. Model: Look for 'Type', 'Model', or 'Model No'.
3. Serial Number: Look for 'S/N', 'Serial No', or a unique alphanumeric code.
4. Motor Power: Extract the value in kW. Return only the number.
5. Motor Voltage: Extract the voltage (V). Return only the number.
6. Frame Type: Look for 'Frame' or 'Size' (e.g., 160L, IEC 132).

If a value is not clearly visible, omit it from the output.

Nameplate Image: {{media url=imageDataUri}}`,
});

const scanNameplateFlow = ai.defineFlow(
  {
    name: 'scanNameplateFlow',
    inputSchema: NameplateScanInputSchema,
    outputSchema: NameplateScanOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        return { 
          success: false, 
          error: "AI failed to extract any recognizable data from the nameplate. Please try a clearer photo." 
        };
      }
      return { ...output, success: true };
    } catch (error: any) {
      // LOG FULL ERROR OBJECT FOR DEBUGGING
      console.error("Nameplate Scan Flow Error Details:", error);
      
      // Check for 503 (Service Unavailable) or 429 (Too Many Requests)
      const errorMsg = error?.message?.toLowerCase() || "";
      const isOverloaded = errorMsg.includes('503') || errorMsg.includes('429') || errorMsg.includes('overloaded') || errorMsg.includes('unavailable');
      
      if (isOverloaded) {
        return {
          success: false,
          error: "The AI service is currently experiencing high traffic. Please try your scan again in a few moments."
        };
      }

      // EXPOSE REAL ERROR MESSAGE TO THE UI
      return {
        success: false,
        error: `AI Error: ${error.message || "An unexpected error occurred during the AI scan."}`
      };
    }
  }
);
