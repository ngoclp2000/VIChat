import type { ConversationDescriptor, MessagePayload, StickerPayload } from '@vichat/shared';

export interface TenantUserProfile {
  userId: string;
  displayName: string;
  roles: string[];
  status: 'active' | 'disabled';
  lastLoginAt?: string | null;
}

export interface TenantUserDirectoryEntry {
  userId: string;
  displayName: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  clientId: string;
  apiKey: string;
  plan: 'free' | 'pro' | 'enterprise';
  limits: {
    messagesPerMinute: number;
    callsPerMinute: number;
  };
}

export interface TenantDirectorySummary {
  id: string;
  name: string;
  clientId: string;
}

export interface UserOption {
  value: string;
  label: string;
  roles: string[];
  status: 'active' | 'disabled';
  lastLoginAt?: string | null;
  [key: string]: unknown;
}

export interface TenantOption {
  value: string;
  label: string;
  clientId: string;
}

export type ConversationView = ConversationDescriptor & {
  unreadCount: number;
  lastMessageSnippet?: string;
  lastMessageAt?: string;
};

export interface StoredSession {
  token: string;
  expiresAt: number;
  tenant: {
    id: string;
    name: string;
    clientId: string;
  };
  user: {
    userId: string;
    displayName: string;
    roles: string[];
  };
}

export type LoginMode = 'tenant' | 'superadmin';

export type AppTheme = 'light' | 'dark';

export type ConversationSelectHandler = (conversation: ConversationView) => void;

export type MessageList = MessagePayload[];

export type StickerList = StickerPayload[];
