'use server';
/**
 * @fileOverview AI flow for extracting consumable data from procurement documents (PO, Delivery Notes, Invoices).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DeliveryNoteInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo or PDF of a procurement document (PO, Delivery Note, Invoice), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type DeliveryNoteInput = z.infer<typeof DeliveryNoteInputSchema>;

const ConsumableItemSchema = z.object({
  name: z.string().describe('The name of the consumable item.'),
  description: z.string().optional().describe('A brief description or specification.'),
  quantity: z.number().describe('The quantity requested or delivered.'),
  unit: z.string().describe('The unit of measure (e.g., KG, Liters, Units).'),
  category: z.string().describe('The category (e.g., Lubricants, Fasteners).'),
});

const DeliveryNoteOutputSchema = z.object({
  items: z.array(ConsumableItemSchema).describe('The list of consumable items extracted.'),
});
export type DeliveryNoteOutput = z.infer<typeof DeliveryNoteOutputSchema>;

export async function extractConsumablesData(input: DeliveryNoteInput): Promise<DeliveryNoteOutput> {
  return extractConsumablesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractConsumablesPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: DeliveryNoteInputSchema },
  output: { schema: DeliveryNoteOutputSchema },
  config: {
    temperature: 0.2,
  },
  prompt: `You are an expert industrial inventory specialist. Analyze the provided procurement document.
This document could be a Purchase Order (PO), a Delivery Note (DN), an Invoice, or a Warehouse Receipt.

Your primary task is to identify and extract line items that represent products, consumables, or spare parts.

Guidelines for extraction:
1. Name: Use the standard product name, part description, or SKU.
2. Quantity: 
   - If this is a Purchase Order, use the 'Quantity Ordered' or 'Qty'.
   - If this is a Delivery Note, use 'Quantity Delivered' or 'Actual Qty'.
   - If this is an Invoice, use the billed quantity.
3. Unit: Identify the unit (e.g., KG, L, Units, EA, Rolls). Default to 'Units' if none is specified.
4. Category: Assign one of these categories: 'Lubricants', 'Tools', 'PPE', 'Electrical', 'Hardware', or 'General'.

Important: 
- Focus only on the line items.
- Ignore company headers, totals, tax amounts, and payment terms.
- Even if the document is titled 'Purchase Order' or 'Invoice', still extract the line items as consumables for inventory loading.

Document to analyze: {{media url=imageDataUri}}`,
});

const extractConsumablesFlow = ai.defineFlow(
  {
    name: 'extractConsumablesFlow',
    inputSchema: DeliveryNoteInputSchema,
    outputSchema: DeliveryNoteOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output || !output.items || output.items.length === 0) {
      throw new Error("AI could not find any recognizable line items in this document. Please ensure it is a clear scan of a PO, Invoice, or Delivery Note.");
    }
    return output;
  }
);
