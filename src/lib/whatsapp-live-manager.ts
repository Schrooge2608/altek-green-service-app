import path from 'path';
import os from 'os';
import fs from 'fs';
import QRCode from 'qrcode';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { format } from 'date-fns';

const firebaseConfig = {
  apiKey: 'AIzaSyCYugYlB7XHdQxB6GQ3omRv9a0n7fBG6Yg',
  projectId: 'studio-8966443065-8fafa',
  storageBucket: 'studio-8966443065-8fafa.firebasestorage.app',
  messagingSenderId: '1080999162704',
  appId: '1:1080999162704:web:7d15f613f892c50fc7f255',
};

function getServerDb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

export interface WhatsAppLiveGroup {
  jid: string;
  channelId: string;
  subject: string;
  participantsCount: number;
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
  groupSubjectMap: Map<string, string>;
  oldestMsgMap: Map<string, { key: any; timestampMs: number }>;
  isInitializing: boolean;
}

const globalForWa = globalThis as unknown as { __altekWaStore?: GlobalWhatsAppStore };

function getStore(): GlobalWhatsAppStore {
  if (!globalForWa.__altekWaStore) {
    globalForWa.__altekWaStore = {
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
      oldestMsgMap: new Map(),
      isInitializing: false,
    };
  }
  return globalForWa.__altekWaStore;
}

function jidToChannelDocId(jid: string): string {
  return `wa_grp_${jid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
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
  const num = typeof rawTs === 'object' && typeof rawTs.toNumber === 'function' ? rawTs.toNumber() : Number(rawTs);
  if (isNaN(num) || num <= 0) return Date.now();
  return num < 10000000000 ? num * 1000 : num;
}

async function persistGroupMessagesToFirestore(rawMessages: any[]) {
  const store = getStore();
  const db = getServerDb();

  const validGroupMsgs: {
    channelId: string;
    groupJid: string;
    msgId: string;
    senderName: string;
    text: string;
    timestampMs: number;
    dateStr: string;
    timeStr: string;
    rawKey: any;
  }[] = [];

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
    const senderName = m.pushName || phoneShort || 'Technician';
    const msgId = `wa_${m.key?.id || `${tsMs}_${Math.random().toString(36).slice(2, 7)}`}`;

    validGroupMsgs.push({
      channelId: jidToChannelDocId(jid),
      groupJid: jid,
      msgId,
      senderName,
      text,
      timestampMs: tsMs,
      dateStr: format(dt, 'yyyy-MM-dd'),
      timeStr: format(dt, 'HH:mm'),
      rawKey: m.key,
    });

    // Track oldest message per group so we can request deeper history on-demand
    const existingOldest = store.oldestMsgMap.get(jid);
    if (!existingOldest || tsMs < existingOldest.timestampMs) {
      store.oldestMsgMap.set(jid, { key: m.key, timestampMs: tsMs });
    }
  }

  if (validGroupMsgs.length === 0) return;

  // Write in chunks of 350 to stay well within Firestore's 500-op batch limit
  const chunkSize = 350;
  for (let i = 0; i < validGroupMsgs.length; i += chunkSize) {
    const chunk = validGroupMsgs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    const latestPerChannel = new Map<string, typeof chunk[0]>();

    for (const item of chunk) {
      const msgRef = doc(db, `channels/${item.channelId}/messages`, item.msgId);
      batch.set(
        msgRef,
        {
          text: item.text,
          senderId: `wa_${item.senderName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          senderName: item.senderName,
          createdAt: Timestamp.fromMillis(item.timestampMs),
          messageDate: item.dateStr,
          timeStr: item.timeStr,
          source: 'whatsapp',
        },
        { merge: true }
      );

      const prevLatest = latestPerChannel.get(item.channelId);
      if (!prevLatest || item.timestampMs >= prevLatest.timestampMs) {
        latestPerChannel.set(item.channelId, item);
      }
    }

    for (const [channelId, lastItem] of latestPerChannel.entries()) {
      const subject = store.groupSubjectMap.get(lastItem.groupJid) || lastItem.groupJid.split('@')[0];
      const chanRef = doc(db, 'channels', channelId);
      batch.set(
        chanRef,
        {
          name: `WhatsApp: ${subject}`,
          whatsappJid: lastItem.groupJid,
          type: 'whatsapp',
          lastMessage: `${lastItem.senderName}: ${lastItem.text.slice(0, 80)}`,
          lastMessageTime: Timestamp.fromMillis(lastItem.timestampMs),
          isArchived: false,
        },
        { merge: true }
      );
    }

    await batch.commit();
    store.state.syncedMessagesCount += chunk.length;
  }
}

export async function refreshParticipatingGroups(): Promise<WhatsAppLiveGroup[]> {
  const store = getStore();
  if (!store.sock || store.state.status !== 'connected') {
    return store.state.groups;
  }

  try {
    const db = getServerDb();
    const groupsObj = await store.sock.groupFetchAllParticipating();
    const groupList: WhatsAppLiveGroup[] = [];
    const entries = Object.values(groupsObj || {}) as any[];

    const chunkSize = 350;
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      for (const g of chunk) {
        if (!g?.id) continue;
        const subject = g.subject || g.id.split('@')[0];
        const channelId = jidToChannelDocId(g.id);
        store.groupSubjectMap.set(g.id, subject);

        groupList.push({
          jid: g.id,
          channelId,
          subject,
          participantsCount: Array.isArray(g.participants) ? g.participants.length : 0,
        });

        const chanRef = doc(db, 'channels', channelId);
        batch.set(
          chanRef,
          {
            name: `WhatsApp: ${subject}`,
            whatsappJid: g.id,
            type: 'whatsapp',
            participants: [],
            isArchived: false,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      }

      await batch.commit();
    }

    store.state.groups = groupList.sort((a, b) => a.subject.localeCompare(b.subject));
    store.state.groupsCount = groupList.length;
    return store.state.groups;
  } catch (err: any) {
    console.error('Error fetching WhatsApp groups:', err);
    return store.state.groups;
  }
}

export async function requestOlderGroupHistory(groupJid: string, count = 100): Promise<{ requested: boolean; message: string }> {
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
        message: 'Requested older message history from your linked WhatsApp phone.',
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
    syncedMessagesCount: store.state.syncedMessagesCount,
    lastError: null,
    groups: [],
  };
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

  if (store.isInitializing) {
    return store.state;
  }

  store.isInitializing = true;
  store.state.status = 'connecting';
  store.state.lastError = null;

  try {
    const baileys: any = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
    const useMultiFileAuthState = baileys.useMultiFileAuthState;
    const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
    const Browsers = baileys.Browsers;
    const DisconnectReason = baileys.DisconnectReason;

    const authDir = path.join(os.tmpdir(), 'altek-wa-auth');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
    let version: [number, number, number] = [2, 3000, 1015901307];
    try {
      if (typeof fetchLatestBaileysVersion === 'function') {
        const vRes = await fetchLatestBaileysVersion();
        if (vRes?.version) version = vRes.version;
      }
    } catch {
      // fallback to default version tuple
    }

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

    const sock = makeWASocket({
      version,
      auth: authState,
      printQRInTerminal: false,
      logger: silentLogger as any,
      browser: Browsers?.macOS ? Browsers.macOS('Desktop') : ['Altek Green Service App', 'Chrome', '120.0.0'],
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
        } catch (qrErr: any) {
          store.state.lastError = qrErr?.message || 'Failed to render QR code';
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

        // Immediately discover and sync all participating WhatsApp groups into Firestore
        await refreshParticipatingGroups();
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason?.loggedOut || statusCode === 401;

        store.sock = null;
        if (isLoggedOut) {
          await disconnectWhatsAppSession(true);
        } else {
          // Auto-reconnect on transient stream close (e.g. code 515 restartRequired right after scanning QR)
          store.state.status = 'connecting';
          setTimeout(() => {
            startWhatsAppSession(false).catch(() => {});
          }, 1500);
        }
      }
    });

    // Listen to initial full history push from phone (up to 1 year when syncFullHistory: true)
    sock.ev.on('messaging-history.set', async (historyData: any) => {
      try {
        const { chats, messages } = historyData || {};
        if (Array.isArray(chats)) {
          for (const c of chats) {
            if (c?.id?.endsWith('@g.us') && (c.name || c.subject)) {
              store.groupSubjectMap.set(c.id, c.name || c.subject);
            }
          }
        }
        if (Array.isArray(messages) && messages.length > 0) {
          await persistGroupMessagesToFirestore(messages);
        }
      } catch (e) {
        console.error('Error processing messaging-history.set:', e);
      }
    });

    // Listen to live messages and on-demand history batches
    sock.ev.on('messages.upsert', async (upsertData: any) => {
      try {
        const { messages } = upsertData || {};
        if (Array.isArray(messages) && messages.length > 0) {
          await persistGroupMessagesToFirestore(messages);
        }
      } catch (e) {
        console.error('Error processing messages.upsert:', e);
      }
    });

    return store.state;
  } catch (err: any) {
    store.isInitializing = false;
    store.state.status = 'error';
    store.state.lastError = err?.message || 'Failed to initialize WhatsApp connection';
    return store.state;
  }
}
