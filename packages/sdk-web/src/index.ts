import EventEmitter from 'eventemitter3';
import type {
  CallSignalEvent,
  ConversationDescriptor,
  DeviceInfo,
  MessagePayload,
  PresenceEvent,
  StickerPayload,
  SyncCursor,
  TypingEvent
} from '@vichat/shared';
import { createOutboxStorage, type QueuedMessage, type OutboxStorage } from './storage';
import { RealtimeClient, type ConnectionState } from './realtime';

export interface ChatKitInitOptions {
  tenantId: string;
  clientId: string;
  token: string;
  device: DeviceInfo;
  realtimeUrl?: string;
  media?: {
    turn?: string[];
    stun?: string[];
  };
  e2ee?: {
    protocol: 'signal' | 'mls';
    storage?: 'indexeddb' | 'memory';
  };
  presence?: boolean;
}

export interface ConversationHandle {
  id: string;
  descriptor: ConversationDescriptor;
  sendText(text: string, metadata?: Record<string, unknown>): Promise<MessagePayload>;
  sendSticker(sticker: StickerPayload, metadata?: Record<string, unknown>): Promise<MessagePayload>;
  on(event: 'message', listener: (message: MessagePayload) => void): this;
  on(event: 'typing', listener: (typing: TypingEvent) => void): this;
  off(event: 'message' | 'typing', listener: (...args: unknown[]) => void): this;
}

export interface ChatKitEvents {
  state: (state: ConnectionState) => void;
  message: (message: MessagePayload) => void;
  presence: (presence: PresenceEvent) => void;
  typing: (typing: TypingEvent) => void;
  call: (event: CallSignalEvent) => void;
  error: (error: Error) => void;
}

type MessageEnvelope = {
  type: 'message' | 'presence' | 'typing' | 'call' | 'ack';
  payload: unknown;
};

interface SendRequest {
  message: MessagePayload;
}

interface ConversationEvents {
  message: (message: MessagePayload) => void;
  typing: (typing: TypingEvent) => void;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `msg-${Math.random().toString(36).slice(2)}`;
}

export class ChatKit extends EventEmitter<ChatKitEvents> {
  private readonly options: ChatKitInitOptions;

  private readonly realtime: RealtimeClient;

  private readonly outbox: OutboxStorage<SendRequest>;

  private readonly conversations = new Map<string, EventEmitter<ConversationEvents>>();

  private readonly cursor: SyncCursor;

  private readonly userId: string;

  private constructor(
    options: ChatKitInitOptions,
    realtime: RealtimeClient,
    outbox: OutboxStorage<SendRequest>,
    userId: string
  ) {
    super();
    this.options = options;
    this.realtime = realtime;
    this.outbox = outbox;
    this.userId = userId;
    this.cursor = {
      updatedAt: new Date().toISOString()
    };

    this.realtime.on('message', (envelope) => this.handleMessage(envelope as MessageEnvelope));
    this.realtime.on('error', (evt) => {
      const error =
        evt instanceof Error
          ? evt
          : new Error(String((evt as { message?: unknown })?.message ?? evt));
      this.emit('error', error);
    });
    this.realtime.on('state', (state) => this.emit('state', state));
  }

  static async init(options: ChatKitInitOptions): Promise<ChatKit> {
    const outbox = await createOutboxStorage<SendRequest>();
    const realtime = new RealtimeClient({
      url: options.realtimeUrl ?? 'wss://api.vichat.local/realtime',
      token: options.token,
      autoReconnect: true
    });

    const userId = ChatKit.extractUserId(options.token);
    const kit = new ChatKit(options, realtime, outbox, userId);
    realtime.connect();
    await kit.flushOutbox();
    return kit;
  }

  async conversationsOpen(descriptor: ConversationDescriptor): Promise<ConversationHandle> {
    const emitter = new EventEmitter<ConversationEvents>();
    this.conversations.set(descriptor.id, emitter);

    const handle: ConversationHandle = {
      id: descriptor.id,
      descriptor,
      sendText: (text, metadata) => this.sendText(descriptor, text, metadata),
      sendSticker: (sticker, metadata) => this.sendSticker(descriptor, sticker, metadata),
      on: (event, listener) => {
        emitter.on(event, listener as never);
        return handle;
      },
      off: (event, listener) => {
        emitter.off(event, listener as never);
        return handle;
      }
    };

    return handle;
  }

  async sendText(conversation: ConversationDescriptor, text: string, metadata?: Record<string, unknown>): Promise<MessagePayload> {
    const id = randomId();
    const message: MessagePayload = {
      id,
      conversationId: conversation.id,
      senderId: this.userId,
      senderDeviceId: this.options.device.id,
      sentAt: new Date().toISOString(),
      type: 'text',
      body: {
        ciphertext: text,
        scheme: this.options.e2ee?.protocol ?? 'signal',
        keyId: `${conversation.id}:${this.options.device.id}`
      },
      metadata
    };

    const queued: QueuedMessage<SendRequest> = {
      id,
      createdAt: Date.now(),
      payload: {
        message
      }
    };

    await this.outbox.put(queued);
    void this.trySendQueued();
    return message;
  }

  async sendSticker(
    conversation: ConversationDescriptor,
    sticker: StickerPayload,
    metadata?: Record<string, unknown>
  ): Promise<MessagePayload> {
    const id = randomId();
    const message: MessagePayload = {
      id,
      conversationId: conversation.id,
      senderId: this.userId,
      senderDeviceId: this.options.device.id,
      sentAt: new Date().toISOString(),
      type: 'sticker',
      body: {
        ciphertext: '',
        scheme: this.options.e2ee?.protocol ?? 'signal',
        keyId: `${conversation.id}:${this.options.device.id}`
      },
      metadata,
      sticker
    };

    const queued: QueuedMessage<SendRequest> = {
      id,
      createdAt: Date.now(),
      payload: { message }
    };

    await this.outbox.put(queued);
    void this.trySendQueued();
    return message;
  }

  async startCall(conversationId: string, constraints: MediaStreamConstraints): Promise<CallSignalEvent> {
    const payload: CallSignalEvent = {
      conversationId,
      type: 'offer',
      payload: { constraints }
    };
    this.sendEnvelope({ type: 'call', payload });
    return payload;
  }

  joinRoom(conversationId: string): void {
    this.sendEnvelope({
      type: 'presence',
      payload: {
        conversationId,
        action: 'join'
      }
    });
  }

  setTyping(conversationId: string, isTyping: boolean): void {
    const payload: TypingEvent = {
      conversationId,
      userId: this.userId,
      isTyping
    };
    this.sendEnvelope({ type: 'typing', payload });
  }

  private async trySendQueued(): Promise<void> {
    const batch = await this.outbox.take(10);
    if (!batch.length) return;

    for (const item of batch) {
      this.sendEnvelope({
        type: 'message',
        payload: item.payload.message
      });
    }

    await this.outbox.delete(batch.map((item) => item.id));
  }

  private async flushOutbox(): Promise<void> {
    await this.trySendQueued();
  }

  private handleMessage(envelope: MessageEnvelope): void {
    switch (envelope.type) {
      case 'message': {
        const payload = envelope.payload as MessagePayload | { message: MessagePayload };
        const message =
          typeof payload === 'object' && payload && 'message' in payload
            ? (payload.message as MessagePayload)
            : (payload as MessagePayload);
        const emitter = this.conversations.get(message.conversationId);
        emitter?.emit('message', message);
        this.emit('message', message);
        break;
      }
      case 'presence':
        this.emit('presence', envelope.payload as PresenceEvent);
        break;
      case 'typing': {
        const typing = envelope.payload as TypingEvent;
        const emitter = this.conversations.get(typing.conversationId);
        emitter?.emit('typing', typing);
        this.emit('typing', typing);
        break;
      }
      case 'call':
        this.emit('call', envelope.payload as CallSignalEvent);
        break;
      case 'ack':
        this.cursor.lastAckMessageId = (envelope.payload as SyncCursor).lastAckMessageId;
        this.cursor.updatedAt = new Date().toISOString();
        break;
      default:
        console.warn('[ChatKit] Unknown envelope type', envelope.type);
    }
  }

  private sendEnvelope(envelope: MessageEnvelope): void {
    try {
      this.realtime.send({ action: 'envelope', payload: envelope });
    } catch (err) {
      this.emit('error', err as Error);
    }
  }

  private static extractUserId(token: string): string {
    try {
      const segments = token.split('.');
      if (segments.length < 2) {
        throw new Error('Malformed JWT');
      }

      const payloadSegment = segments[1] ?? '';
      const decodedPayload = ChatKit.decodeBase64Url(payloadSegment);
      const decoded = JSON.parse(decodedPayload) as { sub?: string };
      const userId = decoded.sub;
      if (!userId) {
        throw new Error('Missing subject claim');
      }
      return userId;
    } catch (err) {
      throw new Error(`Failed to decode access token: ${(err as Error).message ?? err}`);
    }
  }

  private static decodeBase64Url(segment: string): string {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(padded);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maybeBuffer = (globalThis as any).Buffer as { from?: (value: string, encoding: string) => { toString: (encoding: string) => string } } | undefined;
    if (maybeBuffer?.from) {
      return maybeBuffer.from(padded, 'base64').toString('utf8');
    }

    throw new Error('No base64 decoder available');
  }
}

export default ChatKit;
