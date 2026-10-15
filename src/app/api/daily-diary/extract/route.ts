import { NextResponse } from 'next/server';
import { extractDailyDiaryData } from '@/ai/flows/extract-daily-diary-flow';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { documentDataUri } = body;

    if (!documentDataUri) {
      return NextResponse.json(
        { error: 'No document data provided. Please upload a valid document.' },
        { status: 400 }
      );
    }

    const result = await extractDailyDiaryData({ documentDataUri });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/daily-diary/extract:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process document extraction.' },
      { status: 500 }
    );
  }
}
