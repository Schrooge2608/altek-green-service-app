import { NextRequest, NextResponse } from 'next/server';
import {
  getWhatsAppStatus,
  startWhatsAppSession,
  disconnectWhatsAppSession,
  refreshParticipatingGroups,
  requestOlderGroupHistory,
  getPrivateGroupMessages,
} from '@/lib/whatsapp-live-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const status = await getWhatsAppStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', lastError: err?.message || 'Failed to read WhatsApp session state' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    if (action === 'get_group_messages') {
      const groupJid = String(body.groupJid || '');
      const fromDate = body.fromDate ? String(body.fromDate) : undefined;
      const toDate = body.toDate ? String(body.toDate) : undefined;
      const messages = getPrivateGroupMessages(groupJid, fromDate, toDate);
      return NextResponse.json({ messages });
    }

    if (action === 'fetch_older') {
      const groupJid = String(body.groupJid || '');
      const count = Number(body.count) || 150;
      const res = await requestOlderGroupHistory(groupJid, count);
      const messages = getPrivateGroupMessages(groupJid);
      const state = await getWhatsAppStatus();
      return NextResponse.json({ ...state, historyRequest: res, messages });
    }

    if (action === 'disconnect') {
      const state = await disconnectWhatsAppSession(true);
      return NextResponse.json(state);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', lastError: err?.message || 'WhatsApp session action failed' },
      { status: 500 }
    );
  }
}
