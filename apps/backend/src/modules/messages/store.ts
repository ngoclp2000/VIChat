import type { Db } from 'mongodb';
import type { CipherEnvelope, MessagePayload, StickerPayload } from '@vichat/shared';
import { decryptMessagePayload, encryptMessagePayload, type EncryptedMessagePayload } from './crypto';

export interface MessageRecord {
  _id: string;
  tenantId: string;
  conversationId: string;
  senderId: string;
  senderDeviceId: string;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  type: MessagePayload['type'];
  body: CipherEnvelope;
  metadata?: Record<string, unknown>;
  sticker?: StickerPayload;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageDocument {
  _id: string;
  tenantId: string;
  conversationId: string;
  senderId: string;
  senderDeviceId: string;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  type: MessagePayload['type'];
  encryptedPayload: EncryptedMessagePayload;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveMessageInput {
  id: string;
  tenantId: string;
  conversationId: string;
  senderId: string;
  senderDeviceId: string;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  type: MessagePayload['type'];
  body: CipherEnvelope;
  metadata?: Record<string, unknown>;
  sticker?: StickerPayload;
}

export interface ListMessagesOptions {
  limit?: number;
  before?: Date;
}

export async function saveMessage(db: Db, encryptionKey: Buffer, input: SaveMessageInput): Promise<MessageRecord> {
  const collection = db.collection<MessageDocument>('messages');
  const now = new Date();
  const encryptedPayload = encryptMessagePayload(
    {
      body: input.body,
      metadata: input.metadata,
      sticker: input.sticker
    },
    encryptionKey
  );

  const record: MessageDocument = {
    _id: input.id,
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    senderId: input.senderId,
    senderDeviceId: input.senderDeviceId,
    sentAt: input.sentAt,
    deliveredAt: input.deliveredAt,
    readAt: input.readAt,
    type: input.type,
    encryptedPayload,
    createdAt: now,
    updatedAt: now
  };

  await collection.updateOne(
    { _id: record._id },
    {
      $setOnInsert: { createdAt: now },
      $set: {
        tenantId: record.tenantId,
        conversationId: record.conversationId,
        senderId: record.senderId,
        senderDeviceId: record.senderDeviceId,
        sentAt: record.sentAt,
        deliveredAt: record.deliveredAt,
        readAt: record.readAt,
        type: record.type,
        encryptedPayload: record.encryptedPayload,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const persisted = await collection.findOne({ _id: record._id });
  if (!persisted) {
    return toMessageRecord(record, encryptionKey);
  }

  return toMessageRecord(persisted, encryptionKey);
}

export async function listMessagesForConversation(
  db: Db,
  encryptionKey: Buffer,
  tenantId: string,
  conversationId: string,
  options: ListMessagesOptions = {}
): Promise<MessageRecord[]> {
  const collection = db.collection<MessageDocument>('messages');
  const query: Record<string, unknown> = {
    tenantId,
    conversationId
  };

  if (options.before) {
    query.sentAt = { $lt: options.before };
  }

  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));

  const records = await collection
    .find(query)
    .sort({ sentAt: -1 })
    .limit(limit)
    .toArray();

  return records.reverse().map((record) => toMessageRecord(record, encryptionKey));
}

export function toMessagePayload(record: MessageRecord): MessagePayload {
  return {
    id: record._id,
    conversationId: record.conversationId,
    senderId: record.senderId,
    senderDeviceId: record.senderDeviceId,
    sentAt: record.sentAt.toISOString(),
    deliveredAt: record.deliveredAt?.toISOString(),
    readAt: record.readAt?.toISOString(),
    type: record.type,
    body: record.body,
    metadata: record.metadata,
    sticker: record.sticker
  };
}

function toMessageRecord(document: MessageDocument, encryptionKey: Buffer): MessageRecord {
  const decrypted = decryptMessagePayload(document.encryptedPayload, encryptionKey);

  return {
    _id: document._id,
    tenantId: document.tenantId,
    conversationId: document.conversationId,
    senderId: document.senderId,
    senderDeviceId: document.senderDeviceId,
    sentAt: document.sentAt,
    deliveredAt: document.deliveredAt,
    readAt: document.readAt,
    type: document.type,
    body: decrypted.body,
    metadata: decrypted.metadata,
    sticker: decrypted.sticker,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}
