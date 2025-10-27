import { nanoid } from 'nanoid';
import type { Db, WithId } from 'mongodb';

export type ConversationType = 'dm' | 'group';

export interface ConversationRecord {
  _id: string;
  tenantId: string;
  type: ConversationType;
  members: string[];
  metadata: Record<string, unknown>;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CreateConversationInput {
  type: ConversationType;
  members: string[];
  metadata?: Record<string, unknown>;
  name?: string | null;
}

export function toConversationResponse(record: ConversationRecord) {
  return {
    id: record._id,
    tenantId: record.tenantId,
    type: record.type,
    members: record.members,
    metadata: record.metadata,
    name: record.name,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    createdBy: record.createdBy
  };
}

export interface ConversationCreationResult {
  record: ConversationRecord;
  created: boolean;
}

export async function createConversation(
  db: Db,
  tenantId: string,
  creatorId: string,
  input: CreateConversationInput
): Promise<ConversationCreationResult> {
  const collection = db.collection<ConversationRecord>('conversations');
  const members = normalizeMembers([...input.members, creatorId]);

  if (input.type === 'dm') {
    if (members.length !== 2) {
      throw new Error('Direct messages must include exactly two participants (including the creator).');
    }

    const existing = await collection.findOne({
      tenantId,
      type: 'dm',
      members: { $all: members, $size: members.length }
    });

    if (existing) {
      return { record: existing, created: false };
    }
  }

  if (input.type === 'group' && members.length < 2) {
    throw new Error('Group conversations require at least two members.');
  }

  const now = new Date();
  const record: ConversationRecord = {
    _id: `conv_${nanoid(12)}`,
    tenantId,
    type: input.type,
    members,
    metadata: input.metadata ?? {},
    name: input.name?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    createdBy: creatorId
  };

  await collection.insertOne(record);
  return { record, created: true };
}

export async function listConversationsForMember(db: Db, tenantId: string, memberId: string): Promise<ConversationRecord[]> {
  const collection = db.collection<ConversationRecord>('conversations');
  const cursor = collection
    .find({ tenantId, members: memberId })
    .sort({ updatedAt: -1 })
    .limit(100);
  const records: WithId<ConversationRecord>[] = await cursor.toArray();
  return records.map((record) => ({ ...record }));
}

export async function getConversationById(db: Db, tenantId: string, id: string): Promise<ConversationRecord | null> {
  const collection = db.collection<ConversationRecord>('conversations');
  const record = await collection.findOne({ tenantId, _id: id });
  return record ? { ...record } : null;
}

export function normalizeMembers(members: string[]): string[] {
  const unique = Array.from(new Set(members.filter(Boolean)));
  unique.sort();
  return unique;
}
