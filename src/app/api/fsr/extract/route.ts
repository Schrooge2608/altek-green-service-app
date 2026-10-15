import { NextResponse } from 'next/server';
import { extractFsrData } from '@/ai/flows/extract-fsr-flow';

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

    const result = await extractFsrData({ documentDataUri });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/fsr/extract:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process document extraction.' },
      { status: 500 }
    );
  }
}
