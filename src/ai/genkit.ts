import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY}),
  ],
  model: 'googleai/gemini-3.8-flash',
});

// Flows are imported directly into Server Actions or components. 
// Do not import them here to avoid circular dependencies with Next.js Turbopack.
