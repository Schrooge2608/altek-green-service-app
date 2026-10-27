import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

const firebaseConfig = {
  apiKey: 'AIzaSyCYugYlB7XHdQxB6GQ3omRv9a0n7fBG6Yg',
  projectId: 'studio-8966443065-8fafa',
  storageBucket: 'studio-8966443065-8fafa.firebasestorage.app',
  messagingSenderId: '1080999162704',
  appId: '1:1080999162704:web:7d15f613f892c50fc7f255',
};

function getServerFirestore() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

/**
 * Webhook receiver for WhatsApp Group messages (compatible with Green-API, Whapi.cloud, Waha, and custom Baileys bridge).
 * Automatically creates/updates the matching WhatsApp Group channel in `channels` and stores messages with `messageDate` & `timeStr`.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getServerFirestore();

    // Normalize payload across common WhatsApp gateway formats & our custom bridge
    const groupName =
      body.groupName ||
      body.chatName ||
      body.senderData?.chatName ||
      body.payload?.groupName ||
      'WhatsApp: Breakdown Group';

    const senderName =
      body.senderName ||
      body.senderData?.senderName ||
      body.from_name ||
      body.payload?.senderName ||
      'Technician';

    const text =
      body.text ||
      body.messageData?.textMessageData?.textMessage ||
      body.messageData?.extendedTextMessageData?.text ||
      body.text?.body ||
      body.payload?.body ||
      '';

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ status: 'ignored', reason: 'Empty or non-text message' });
    }

    const timestampMs = body.timestampMs
      ? Number(body.timestampMs)
      : body.timestamp
        ? Number(body.timestamp) * 1000
        : Date.now();

    const dt = new Date(timestampMs);
    const dateStr = format(dt, 'yyyy-MM-dd');
    const timeStr = format(dt, 'HH:mm');

    const channelName = groupName.startsWith('WhatsApp:') ? groupName : `WhatsApp: ${groupName}`;

    // Find or create the channel in Firestore
    const chanSnap = await getDocs(query(collection(db, 'channels'), where('name', '==', channelName)));
    let channelId = '';

    if (chanSnap.empty) {
      const created = await addDoc(collection(db, 'channels'), {
        name: channelName,
        type: 'whatsapp',
        participants: [],
        lastMessage: `${senderName}: ${text.slice(0, 80)}`,
        lastMessageTime: Timestamp.fromMillis(timestampMs),
        createdAt: Timestamp.now(),
        isArchived: false,
      });
      channelId = created.id;
    } else {
      channelId = chanSnap.docs[0].id;
      await updateDoc(doc(db, 'channels', channelId), {
        lastMessage: `${senderName}: ${text.slice(0, 80)}`,
        lastMessageTime: Timestamp.fromMillis(timestampMs),
      });
    }

    const msgId = body.messageId || `wa_${timestampMs}_${Math.random().toString(36).slice(2, 8)}`;
    await setDoc(
      doc(db, `channels/${channelId}/messages`, msgId),
      {
        text: text.trim(),
        senderId: `wa_${senderName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        senderName,
        createdAt: Timestamp.fromMillis(timestampMs),
        messageDate: dateStr,
        timeStr,
        source: 'whatsapp',
      },
      { merge: true }
    );

    return NextResponse.json({ status: 'ok', channelId, messageId: msgId });
  } catch (err: any) {
    console.error('WhatsApp webhook error:', err);
    return NextResponse.json({ error: err?.message || 'Webhook processing error' }, { status: 500 });
  }
}
