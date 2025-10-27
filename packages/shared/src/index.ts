export type TenantScopedId = string;

export interface DeviceInfo {
  id: string;
  platform: 'web' | 'ios' | 'android' | 'desktop';
  appVersion?: string;
}

export type PresenceState = 'online' | 'offline' | 'away' | 'busy';

export interface ConversationDescriptor {
  id: string;
  type: 'dm' | 'group';
  tenantId: TenantScopedId;
  members: string[];
}

export interface MessagePayload {
  id: string;
  conversationId: string;
  senderId: string;
  senderDeviceId: string;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
  body: CipherEnvelope;
  type: 'text' | 'media' | 'system';
  metadata?: Record<string, unknown>;
}

export interface CipherEnvelope {
  ciphertext: string;
  scheme: 'signal' | 'mls';
  keyId: string;
  media?: MediaAttachment[];
}

export interface MediaAttachment {
  id: string;
  kind: 'image' | 'video' | 'audio' | 'file';
  size: number;
  mimeType: string;
  key: string;
  digest: string;
}

export interface PresenceEvent {
  userId: string;
  deviceId: string;
  state: PresenceState;
  lastSeen: string;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface CallSignalEvent {
  conversationId: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup';
  payload: unknown;
}

export interface SyncCursor {
  lastAckMessageId?: string;
  lastReadMessageId?: string;
  updatedAt: string;
}
