import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY}),
  ],
  model: 'googleai/gemini-2.5-flash',
});

// Flows will be imported for their side effects in this file.
import './flows/extract-schedule-flow';
import './flows/generate-report-flow';
import './flows/format-text-flow';
import './flows/extract-consumables-flow';
import './flows/generate-rca-flow';
import './flows/scan-nameplate-flow';
import './flows/extract-fsr-flow';
import './flows/scan-odometer-flow';
