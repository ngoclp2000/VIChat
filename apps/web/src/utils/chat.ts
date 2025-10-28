import type { ConversationDescriptor, MessagePayload } from '@vichat/shared';

import type { ConversationView } from '../types/app';

export function sortConversations(list: ConversationView[]): ConversationView[] {
  return list
    .slice()
    .sort((left, right) => {
      const l = left.lastMessageAt ?? left.updatedAt ?? left.createdAt ?? '';
      const r = right.lastMessageAt ?? right.updatedAt ?? right.createdAt ?? '';
      return r.localeCompare(l);
    });
}

export function messageToSnippet(message: MessagePayload): string {
  if (message.type === 'sticker' && message.sticker) {
    return message.sticker.name ? `Nhãn dán: ${message.sticker.name}` : 'Đã gửi nhãn dán';
  }

  const ciphertext = message.body?.ciphertext ?? '';
  return ciphertext || 'Tin nhắn mới';
}

export function truncate(text: string, maxLength = 60): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

export function getConversationInitials(conversation: ConversationDescriptor): string {
  if (conversation.name) {
    const parts = conversation.name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
    }
    return conversation.name.slice(0, 2).toUpperCase();
  }

  return conversation.id.slice(-2).toUpperCase();
}

export function formatTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
