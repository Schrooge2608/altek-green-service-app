'use server';
/**
 * @fileOverview AI flow for extracting spare part numbers and details from photos.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SparePartScanInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of a spare part, its label, or its packaging, as a base64 data URI."
    ),
});
export type SparePartScanInput = z.infer<typeof SparePartScanInputSchema>;

const SparePartScanOutputSchema = z.object({
  rbmNumber: z.string().optional().describe('The RBM number, usually an 8-digit code (e.g. 41484221).'),
  oemPartNumber: z.string().optional().describe('The OEM part number or ABB sparecode (e.g. 68569591).'),
  type: z.string().optional().describe('The type or model of the component (e.g. FS450R17KE3).'),
  name: z.string().optional().describe('The name or description of the part (e.g. IGBT MODULE).'),
  success: z.boolean().optional(),
  error: z.string().optional(),
});
export type SparePartScanOutput = z.infer<typeof SparePartScanOutputSchema>;

export async function scanSparePart(input: SparePartScanInput): Promise<SparePartScanOutput> {
  return scanSparePartFlow(input);
}

const scanSparePartFlow = ai.defineFlow(
  {
    name: 'scanSparePartFlow',
    inputSchema: SparePartScanInputSchema,
    outputSchema: SparePartScanOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await ai.generate({
        model: 'googleai/gemini-3.8-flash',
        output: { schema: SparePartScanOutputSchema },
        system: `You are an industrial maintenance data specialist. 
Analyze the provided image of a spare part or its label.

Extract the following technical details into a structured format:
1. RBM Number: Look for an 8-digit code or something labeled RBM.
2. OEM Part Number: Look for 'Part No', 'P/N', 'Code', or an ABB sparecode.
3. Type: Look for the specific model or type designation of the component.
4. Name: Look for a plain English description of what the part is (e.g., I/O Board, Fan, IGBT Module).

If a value is not clearly visible, omit it from the output. Do not hallucinate data.`,
        messages: [
            { role: 'user', content: [{ media: { url: input.imageDataUri } }] }
        ]
      });
      if (!output) {
        return { 
          success: false, 
          error: "AI failed to extract any recognizable data from the part. Please try a clearer photo." 
        };
      }
      return { ...output, success: true };
    } catch (error: any) {
      console.error("Spare Part Scan Flow Error Details:", error);
      
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
