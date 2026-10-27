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
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  waiters: Array<() => void>;
  cacheLoaded: boolean;
}

const AUTH_DIR = path.join(os.tmpdir(), 'altek-wa-auth');
const CACHE_FILE = path.join(os.tmpdir(), 'altek-wa-private-cache.json');

const globalForWa = globalThis as unknown as { __altekWaPrivateStore?: GlobalWhatsAppStore };

function hasSavedLinkedCreds(): { linked: boolean; phone: string | null; name: string | null } {
  try {
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    if (!fs.existsSync(credsPath)) return { linked: false, phone: null, name: null };
    const raw = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const meId: string = raw?.me?.id || '';
    if (!meId) return { linked: false, phone: null, name: null };
    const phone = meId.split(':')[0].split('@')[0] || null;
    const name = raw?.me?.name || phone;
    return { linked: true, phone, name };
  } catch {
    return { linked: false, phone: null, name: null };
  }
}

function saveCacheToDisk(store: GlobalWhatsAppStore) {
  try {
    const subjects: Record<string, { subject: string; participantsCount: number }> = {};
    for (const [k, v] of store.groupSubjectMap.entries()) {
      subjects[k] = v;
    }
    const messages: Record<string, WhatsAppBufferedMessage[]> = {};
    for (const [jid, mMap] of store.groupMessagesMap.entries()) {
      // Keep up to 1000 most recent messages per group in cache
      const arr = Array.from(mMap.values()).sort((a, b) => a.timestampMs - b.timestampMs).slice(-1000);
      messages[jid] = arr;
    }
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify({
        connectedPhone: store.state.connectedPhone,
        connectedName: store.state.connectedName,
        subjects,
        messages,
      }),
      'utf8'
    );
  } catch {
    // ignore disk cache write errors
  }
}

function loadCacheFromDisk(store: GlobalWhatsAppStore) {
  if (store.cacheLoaded) return;
  store.cacheLoaded = true;
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (raw?.subjects && typeof raw.subjects === 'object') {
        for (const [jid, meta] of Object.entries(raw.subjects)) {
          store.groupSubjectMap.set(jid, meta as any);
        }
      }
      if (raw?.messages && typeof raw.messages === 'object') {
        for (const [jid, arr] of Object.entries(raw.messages)) {
          if (Array.isArray(arr)) {
            const mMap = new Map<string, WhatsAppBufferedMessage>();
            for (const m of arr) {
              if (m?.id) mMap.set(m.id, m);
            }
            store.groupMessagesMap.set(jid, mMap);
          }
        }
      }
      if (raw?.connectedPhone && !store.state.connectedPhone) {
        store.state.connectedPhone = raw.connectedPhone;
      }
      if (raw?.connectedName && !store.state.connectedName) {
        store.state.connectedName = raw.connectedName;
      }
      rebuildGroupsList(store);
    }
  } catch {
    // ignore disk cache read errors
  }
}

function getStore(): GlobalWhatsAppStore {
  if (!globalForWa.__altekWaPrivateStore) {
    const saved = hasSavedLinkedCreds();
    globalForWa.__altekWaPrivateStore = {
      sock: null,
      state: {
        status: saved.linked ? 'connected' : 'disconnected',
        qrDataUrl: null,
        connectedPhone: saved.phone,
        connectedName: saved.name,
        groupsCount: 0,
        syncedMessagesCount: 0,
        lastError: null,
        groups: [],
      },
      groupSubjectMap: new Map(),
      groupMessagesMap: new Map(),
      oldestMsgMap: new Map(),
      isInitializing: false,
      reconnectTimer: null,
      reconnectAttempts: 0,
      waiters: [],
      cacheLoaded: false,
    };
    loadCacheFromDisk(globalForWa.__altekWaPrivateStore);
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
 * Buffers group messages ONLY in private server memory + private temp cache.
 * Never writes personal or unapproved WhatsApp groups/messages to the shared Firestore database.
 */
function bufferGroupMessagesInMemory(rawMessages: any[]) {
  const store = getStore();
  let addedAny = false;

  for (const m of rawMessages) {
    const jid: string = m?.key?.remoteJid || '';
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
    saveCacheToDisk(store);
  }
}

export async function refreshParticipatingGroups(): Promise<WhatsAppLiveGroup[]> {
  const store = getStore();
  if (!store.sock) {
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
    saveCacheToDisk(store);
    return store.state.groups;
  } catch {
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
  if (!store.sock) {
    // Wake socket if linked
    const saved = hasSavedLinkedCreds();
    if (saved.linked) {
      await startWhatsAppSession(false);
    }
  }

  if (!store.sock) {
    return { requested: false, message: 'WhatsApp is reconnecting—please try again in a moment.' };
  }

  const oldest = store.oldestMsgMap.get(groupJid);
  if (!oldest || !oldest.key) {
    return {
      requested: false,
      message: 'Waiting for initial messages from this group before pulling older history.',
    };
  }

  try {
    if (typeof store.sock.fetchMessageHistory === 'function') {
      await store.sock.fetchMessageHistory(count, oldest.key, oldest.timestampMs);
      return {
        requested: true,
        message: 'Requested older messages for this group from your phone.',
      };
    }
    return { requested: false, message: 'On-demand history fetch not supported by socket.' };
  } catch (err: any) {
    return { requested: false, message: err?.message || 'Failed to request older history.' };
  }
}

export async function getWhatsAppStatus(): Promise<WhatsAppSessionState> {
  const store = getStore();
  const saved = hasSavedLinkedCreds();

  // If credentials are linked on disk, keep status 'connected' and silently ensure socket is alive
  if (saved.linked) {
    store.state.status = 'connected';
    store.state.qrDataUrl = null;
    if (!store.state.connectedPhone) store.state.connectedPhone = saved.phone;
    if (!store.state.connectedName) store.state.connectedName = saved.name;

    if (!store.sock && !store.isInitializing && !store.reconnectTimer) {
      startWhatsAppSession(false).catch(() => {});
    }
  }

  return store.state;
}

export async function disconnectWhatsAppSession(clearAuth = false): Promise<WhatsAppSessionState> {
  const store = getStore();
  if (store.reconnectTimer) {
    clearTimeout(store.reconnectTimer);
    store.reconnectTimer = null;
  }
  try {
    if (store.sock) {
      const sockToClose = store.sock;
      store.sock = null;
      if (clearAuth && typeof sockToClose.logout === 'function') {
        await sockToClose.logout().catch(() => {});
      }
      if (typeof sockToClose.end === 'function') {
        sockToClose.end(undefined);
      }
    }
    if (clearAuth) {
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
      if (fs.existsSync(CACHE_FILE)) {
        fs.rmSync(CACHE_FILE, { force: true });
      }
      store.groupSubjectMap.clear();
      store.groupMessagesMap.clear();
      store.oldestMsgMap.clear();
    }
  } catch {
    // ignore
  }
  store.isInitializing = false;
  store.reconnectAttempts = 0;
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

  if (store.sock && store.state.status === 'connected') {
    return store.state;
  }

  if (store.sock && store.state.status === 'qr_ready' && store.state.qrDataUrl && !forceNewQr) {
    return store.state;
  }

  if (store.isInitializing) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 4000);
      store.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
    return store.state;
  }

  if (store.reconnectTimer) {
    clearTimeout(store.reconnectTimer);
    store.reconnectTimer = null;
  }

  store.isInitializing = true;
  const savedBefore = hasSavedLinkedCreds();
  // Only set status to 'connecting' if not already linked—if already linked, keep 'connected' so UI never flickers!
  if (!savedBefore.linked) {
    store.state.status = 'connecting';
  } else {
    store.state.status = 'connected';
    store.state.connectedPhone = store.state.connectedPhone || savedBefore.phone;
    store.state.connectedName = store.state.connectedName || savedBefore.name;
  }
  store.state.lastError = null;

  try {
    const baileys: any = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
    const useMultiFileAuthState = baileys.useMultiFileAuthState;
    const DisconnectReason = baileys.DisconnectReason;

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

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

    // Keep syncFullHistory: false so initial pairing doesn't flood Cloud Run memory/socket with all personal chats.
    // Recent group history still arrives automatically, and older group history is fetched per-group on demand.
    const sock = makeWASocket({
      auth: authState,
      printQRInTerminal: false,
      logger: silentLogger as any,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      keepAliveIntervalMs: 15000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 500,
    });

    store.sock = sock;
    store.isInitializing = false;

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      const nowSaved = hasSavedLinkedCreds();
      if (nowSaved.linked) {
        store.state.status = 'connected';
        store.state.qrDataUrl = null;
        store.state.connectedPhone = nowSaved.phone;
        store.state.connectedName = nowSaved.name;
      }
    });

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
        store.reconnectAttempts = 0;
        const meId: string = sock.user?.id || '';
        const phone = meId ? meId.split(':')[0].split('@')[0] : null;
        store.state.status = 'connected';
        store.state.qrDataUrl = null;
        store.state.connectedPhone = phone || store.state.connectedPhone;
        store.state.connectedName = sock.user?.name || phone || store.state.connectedName;
        store.state.lastError = null;
        notifyWaiters(store);

        await refreshParticipatingGroups();
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason?.loggedOut || statusCode === 401;
        const isRestartRequired = statusCode === DisconnectReason?.restartRequired || statusCode === 515;
        const savedAfter = hasSavedLinkedCreds();

        if (store.sock === sock) {
          store.sock = null;
        }

        if (isLoggedOut) {
          await disconnectWhatsAppSession(true);
        } else if (savedAfter.linked || isRestartRequired || store.state.status === 'connected') {
          // Keep status 'connected' if we have linked credentials so the UI never flickers or loses connection!
          if (savedAfter.linked) {
            store.state.status = 'connected';
            store.state.qrDataUrl = null;
            store.state.connectedPhone = store.state.connectedPhone || savedAfter.phone;
            store.state.connectedName = store.state.connectedName || savedAfter.name;
          }
          const delayMs = isRestartRequired ? 500 : Math.min(1000 * Math.pow(1.5, store.reconnectAttempts), 8000);
          store.reconnectAttempts += 1;
          if (store.reconnectTimer) clearTimeout(store.reconnectTimer);
          store.reconnectTimer = setTimeout(() => {
            store.reconnectTimer = null;
            startWhatsAppSession(false).catch(() => {});
          }, delayMs);
        } else {
          store.state.status = 'disconnected';
          store.state.qrDataUrl = null;
          store.state.lastError = 'QR code expired. Click Generate WhatsApp QR Code to scan again.';
          notifyWaiters(store);
        }
      }
    });

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
          saveCacheToDisk(store);
        }
      } catch (e) {
        console.error('Error processing messaging-history.set:', e);
      }
    });

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

    if (!savedBefore.linked) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5000);
        store.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    return store.state;
  } catch (err: any) {
    store.isInitializing = false;
    if (!savedBefore.linked) {
      store.state.status = 'error';
      store.state.lastError = err?.message || 'Failed to initialize WhatsApp connection';
    }
    notifyWaiters(store);
    return store.state;
  }
}
