import { NextResponse } from 'next/server';
import {
  getWhatsAppStatus,
  startWhatsAppSession,
  refreshParticipatingGroups,
  requestOlderGroupHistory,
  disconnectWhatsAppSession,
} from '@/lib/whatsapp-live-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const state = await getWhatsAppStatus();
    return NextResponse.json(state);
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', lastError: err?.message || 'Failed to read WhatsApp session status' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'start';

    if (action === 'start') {
      const state = await startWhatsAppSession(Boolean(body.forceNewQr));
      return NextResponse.json(state);
    }

    if (action === 'refresh_groups') {
      await refreshParticipatingGroups();
      const state = await getWhatsAppStatus();
      return NextResponse.json(state);
    }

    if (action === 'fetch_older') {
      const groupJid = body.groupJid;
      if (!groupJid) {
        return NextResponse.json({ error: 'Missing groupJid' }, { status: 400 });
      }
      const res = await requestOlderGroupHistory(groupJid, Number(body.count) || 100);
      const state = await getWhatsAppStatus();
      return NextResponse.json({ ...state, historyRequest: res });
    }

    if (action === 'disconnect') {
      const state = await disconnectWhatsAppSession(true);
      return NextResponse.json(state);
    }

    const state = await getWhatsAppStatus();
    return NextResponse.json(state);
  } catch (err: any) {
    console.error('Error in /api/whatsapp/session:', err);
    return NextResponse.json(
      { status: 'error', lastError: err?.message || 'WhatsApp session action failed' },
      { status: 500 }
    );
  }
}
