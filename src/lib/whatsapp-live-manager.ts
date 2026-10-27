import path from 'path';
import os from 'os';
import fs from 'fs';
import QRCode from 'qrcode';
import { format } from 'date-fns';

export interface WhatsAppLiveGroup {
  jid: string;
  subject: string;
  participantsCount: number;
  messageCount: number;
  earliestDate: string | null;
  latestDate: string | null;
}

export interface WhatsAppBufferedMessage {
  id: string;
  groupJid: string;
  senderName: string;
  text: string;
  timestampMs: number;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
}

export interface WhatsAppSessionState {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'error';
  qrDataUrl: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  groupsCount: number;
  syncedMessagesCount: number;
  lastError: string | null;
  groups: WhatsAppLiveGroup[];
}

interface GlobalWhatsAppStore {
  sock: any;
  state: WhatsAppSessionState;
  groupSubjectMap: Map<string, { subject: string; participantsCount: number }>;
  groupMessagesMap: Map<string, Map<string, WhatsAppBufferedMessage>>;
  oldestMsgMap: Map<string, { key: any; timestampMs: number }>;
  isInitializing: boolean;
  waiters: Array<() => void>;
}

const globalForWa = globalThis as unknown as { __altekWaPrivateStore?: GlobalWhatsAppStore };

function getStore(): GlobalWhatsAppStore {
  if (!globalForWa.__altekWaPrivateStore) {
    globalForWa.__altekWaPrivateStore = {
      sock: null,
      state: {
        status: 'disconnected',
        qrDataUrl: null,
        connectedPhone: null,
        connectedName: null,
        groupsCount: 0,
        syncedMessagesCount: 0,
        lastError: null,
        groups: [],
      },
      groupSubjectMap: new Map(),
      groupMessagesMap: new Map(),
      oldestMsgMap: new Map(),
      isInitializing: false,
      waiters: [],
    };
  }
  return globalForWa.__altekWaPrivateStore;
}

function notifyWaiters(store: GlobalWhatsAppStore) {
  while (store.waiters.length > 0) {
    const fn = store.waiters.shift();
    if (fn) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  }
}

function extractMessageText(message: any): string {
  if (!message) return '';
  const inner =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.documentWithCaptionMessage?.message ||
    message;

  return (
    inner.conversation ||
    inner.extendedTextMessage?.text ||
    inner.imageMessage?.caption ||
    inner.videoMessage?.caption ||
    inner.documentMessage?.caption ||
    ''
  ).trim();
}

function extractTimestampMs(rawTs: any): number {
  if (!rawTs) return Date.now();
  const num =
    typeof rawTs === 'object' && typeof rawTs.toNumber === 'function'
      ? rawTs.toNumber()
      : Number(rawTs);
  if (isNaN(num) || num <= 0) return Date.now();
  return num < 10000000000 ? num * 1000 : num;
}

function rebuildGroupsList(store: GlobalWhatsAppStore) {
  const allJids = new Set<string>([
    ...store.groupSubjectMap.keys(),
    ...store.groupMessagesMap.keys(),
  ]);

  const list: WhatsAppLiveGroup[] = [];
  let totalMessages = 0;

  for (const jid of allJids) {
    if (!jid.endsWith('@g.us')) continue;
    const meta = store.groupSubjectMap.get(jid);
    const msgMap = store.groupMessagesMap.get(jid);
    const msgs = msgMap ? Array.from(msgMap.values()) : [];
    totalMessages += msgs.length;

    let earliestDate: string | null = null;
    let latestDate: string | null = null;
    for (const m of msgs) {
      if (!earliestDate || m.dateStr < earliestDate) earliestDate = m.dateStr;
      if (!latestDate || m.dateStr > latestDate) latestDate = m.dateStr;
    }

    list.push({
      jid,
      subject: meta?.subject || jid.split('@')[0],
      participantsCount: meta?.participantsCount || 0,
      messageCount: msgs.length,
      earliestDate,
      latestDate,
    });
  }

  list.sort((a, b) => a.subject.localeCompare(b.subject));
  store.state.groups = list;
  store.state.groupsCount = list.length;
  store.state.syncedMessagesCount = totalMessages;
}

/**
 * Buffers group messages ONLY in private server memory.
 * Never writes personal or unapproved WhatsApp groups/messages to the shared Firestore database.
 */
function bufferGroupMessagesInMemory(rawMessages: any[]) {
  const store = getStore();
  let addedAny = false;

  for (const m of rawMessages) {
    const jid: string = m?.key?.remoteJid || '';
    // Strictly ignore all 1-on-1 personal chats and status broadcasts
    if (!jid.endsWith('@g.us')) continue;

    const text = extractMessageText(m.message);
    if (!text) continue;

    const tsMs = extractTimestampMs(m.messageTimestamp);
    const dt = new Date(tsMs);
    if (isNaN(dt.getTime())) continue;

    const participant = m.key?.participant || m.participant || '';
    const phoneShort = participant ? participant.split('@')[0] : 'Member';
    const senderName = m.pushName || phoneShort || 'Member';
    const msgId = `wa_${m.key?.id || `${tsMs}_${Math.random().toString(36).slice(2, 7)}`}`;

    let groupMap = store.groupMessagesMap.get(jid);
    if (!groupMap) {
      groupMap = new Map();
      store.groupMessagesMap.set(jid, groupMap);
    }

    groupMap.set(msgId, {
      id: msgId,
      groupJid: jid,
      senderName,
      text,
      timestampMs: tsMs,
      dateStr: format(dt, 'yyyy-MM-dd'),
      timeStr: format(dt, 'HH:mm'),
    });
    addedAny = true;

    const existingOldest = store.oldestMsgMap.get(jid);
    if (!existingOldest || tsMs < existingOldest.timestampMs) {
      store.oldestMsgMap.set(jid, { key: m.key, timestampMs: tsMs });
    }
  }

  if (addedAny) {
    rebuildGroupsList(store);
  }
}

export async function refreshParticipatingGroups(): Promise<WhatsAppLiveGroup[]> {
  const store = getStore();
  if (!store.sock || store.state.status !== 'connected') {
    return store.state.groups;
  }

  try {
    const groupsObj = await store.sock.groupFetchAllParticipating();
    const entries = Object.values(groupsObj || {}) as any[];

    for (const g of entries) {
      if (!g?.id || !g.id.endsWith('@g.us')) continue;
      const subject = g.subject || g.id.split('@')[0];
      store.groupSubjectMap.set(g.id, {
        subject,
        participantsCount: Array.isArray(g.participants) ? g.participants.length : 0,
      });
    }

    rebuildGroupsList(store);
    return store.state.groups;
  } catch (err: any) {
    console.error('Error fetching WhatsApp groups:', err);
    return store.state.groups;
  }
}

export function getPrivateGroupMessages(
  groupJid: string,
  fromDate?: string,
  toDate?: string
): WhatsAppBufferedMessage[] {
  const store = getStore();
  const groupMap = store.groupMessagesMap.get(groupJid);
  if (!groupMap) return [];

  const all = Array.from(groupMap.values()).sort((a, b) => a.timestampMs - b.timestampMs);
  return all.filter((m) => {
    if (fromDate && m.dateStr < fromDate) return false;
    if (toDate && m.dateStr > toDate) return false;
    return true;
  });
}

export async function requestOlderGroupHistory(
  groupJid: string,
  count = 150
): Promise<{ requested: boolean; message: string }> {
  const store = getStore();
  if (!store.sock || store.state.status !== 'connected') {
    return { requested: false, message: 'WhatsApp is not connected.' };
  }

  const oldest = store.oldestMsgMap.get(groupJid);
  if (!oldest || !oldest.key) {
    return {
      requested: false,
      message: 'Initial history sync is still in progress for this group.',
    };
  }

  try {
    if (typeof store.sock.fetchMessageHistory === 'function') {
      await store.sock.fetchMessageHistory(count, oldest.key, oldest.timestampMs);
      return {
        requested: true,
        message: 'Requested older messages for this specific group from your phone.',
      };
    }
    return { requested: false, message: 'On-demand history fetch not supported by socket.' };
  } catch (err: any) {
    return { requested: false, message: err?.message || 'Failed to request older history.' };
  }
}

export async function getWhatsAppStatus(): Promise<WhatsAppSessionState> {
  return getStore().state;
}

export async function disconnectWhatsAppSession(clearAuth = false): Promise<WhatsAppSessionState> {
  const store = getStore();
  try {
    if (store.sock) {
      if (clearAuth && typeof store.sock.logout === 'function') {
        await store.sock.logout().catch(() => {});
      }
      if (typeof store.sock.end === 'function') {
        store.sock.end(undefined);
      }
      store.sock = null;
    }
    if (clearAuth) {
      const authDir = path.join(os.tmpdir(), 'altek-wa-auth');
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
      }
      store.groupSubjectMap.clear();
      store.groupMessagesMap.clear();
      store.oldestMsgMap.clear();
    }
  } catch {
    // ignore
  }
  store.isInitializing = false;
  store.state = {
    status: 'disconnected',
    qrDataUrl: null,
    connectedPhone: null,
    connectedName: null,
    groupsCount: 0,
    syncedMessagesCount: 0,
    lastError: null,
    groups: [],
  };
  notifyWaiters(store);
  return store.state;
}

export async function startWhatsAppSession(forceNewQr = false): Promise<WhatsAppSessionState> {
  const store = getStore();

  if (forceNewQr) {
    await disconnectWhatsAppSession(true);
  }

  if (store.state.status === 'connected' && store.sock) {
    return store.state;
  }

  if (store.state.status === 'qr_ready' && store.state.qrDataUrl && store.sock && !forceNewQr) {
    return store.state;
  }

  if (store.isInitializing) {
    // Wait up to 4s for current initialization to produce a QR code or connection
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 4000);
      store.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
    return store.state;
  }

  store.isInitializing = true;
  store.state.status = 'connecting';
  store.state.lastError = null;

  try {
    const baileys: any = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
    const useMultiFileAuthState = baileys.useMultiFileAuthState;
    const DisconnectReason = baileys.DisconnectReason;

    const authDir = path.join(os.tmpdir(), 'altek-wa-auth');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);

    const silentLogger = {
      level: 'silent',
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
      child: () => silentLogger,
    };

    // Use Baileys' built-in default browser and version so WhatsApp Web handshakes in ~1.5s without 428 rejection
    const sock = makeWASocket({
      auth: authState,
      printQRInTerminal: false,
      logger: silentLogger as any,
      syncFullHistory: true,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    });

    store.sock = sock;
    store.isInitializing = false;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 1 });
          store.state.qrDataUrl = dataUrl;
          store.state.status = 'qr_ready';
          store.state.lastError = null;
          notifyWaiters(store);
        } catch (qrErr: any) {
          store.state.lastError = qrErr?.message || 'Failed to render QR code';
          notifyWaiters(store);
        }
      }

      if (connection === 'open') {
        const meId: string = sock.user?.id || '';
        const phone = meId ? meId.split(':')[0].split('@')[0] : null;
        store.state.status = 'connected';
        store.state.qrDataUrl = null;
        store.state.connectedPhone = phone;
        store.state.connectedName = sock.user?.name || phone;
        store.state.lastError = null;
        notifyWaiters(store);

        await refreshParticipatingGroups();
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason?.loggedOut || statusCode === 401;
        const isRestartRequired = statusCode === DisconnectReason?.restartRequired || statusCode === 515;

        store.sock = null;
        if (isLoggedOut) {
          await disconnectWhatsAppSession(true);
        } else if (isRestartRequired || store.state.status === 'connected') {
          // Reconnect after QR scan pairing (515 restartRequired) or transient drop
          store.state.status = 'connecting';
          setTimeout(() => {
            startWhatsAppSession(false).catch(() => {});
          }, 1000);
        } else {
          // If closed before pairing (e.g. QR timeout), reset cleanly so user can click Generate Fresh QR
          store.state.status = 'disconnected';
          store.state.qrDataUrl = null;
          store.state.lastError = 'QR code expired or connection closed. Click Generate WhatsApp QR Code to try again.';
          notifyWaiters(store);
        }
      }
    });

    // Listen to initial history sync from phone — keep ONLY in private memory, never write to Firestore
    sock.ev.on('messaging-history.set', async (historyData: any) => {
      try {
        const { chats, messages } = historyData || {};
        if (Array.isArray(chats)) {
          for (const c of chats) {
            if (c?.id?.endsWith('@g.us') && (c.name || c.subject)) {
              const existing = store.groupSubjectMap.get(c.id);
              store.groupSubjectMap.set(c.id, {
                subject: c.name || c.subject,
                participantsCount: existing?.participantsCount || 0,
              });
            }
          }
        }
        if (Array.isArray(messages) && messages.length > 0) {
          bufferGroupMessagesInMemory(messages);
        } else {
          rebuildGroupsList(store);
        }
      } catch (e) {
        console.error('Error processing messaging-history.set:', e);
      }
    });

    // Listen to live messages and on-demand history batches — keep ONLY in private memory
    sock.ev.on('messages.upsert', async (upsertData: any) => {
      try {
        const { messages } = upsertData || {};
        if (Array.isArray(messages) && messages.length > 0) {
          bufferGroupMessagesInMemory(messages);
        }
      } catch (e) {
        console.error('Error processing messages.upsert:', e);
      }
    });

    // Wait up to 5 seconds for QR code or open connection so the very first HTTP call returns the QR code directly
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 5000);
      store.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });

    return store.state;
  } catch (err: any) {
    store.isInitializing = false;
    store.state.status = 'error';
    store.state.lastError = err?.message || 'Failed to initialize WhatsApp connection';
    notifyWaiters(store);
    return store.state;
  }
}
