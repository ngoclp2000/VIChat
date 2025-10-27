import EventEmitter from 'eventemitter3';
import type {
  CallSignalEvent,
  ConversationDescriptor,
  DeviceInfo,
  MessagePayload,
  PresenceEvent,
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
  conversationId: string;
  message: Omit<MessagePayload, 'sentAt' | 'deliveredAt' | 'readAt'>;
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

  private constructor(options: ChatKitInitOptions, realtime: RealtimeClient, outbox: OutboxStorage<SendRequest>) {
    super();
    this.options = options;
    this.realtime = realtime;
    this.outbox = outbox;
    this.cursor = {
      updatedAt: new Date().toISOString()
    };

    this.realtime.on('message', (envelope) => this.handleMessage(envelope as MessageEnvelope));
    this.realtime.on('error', (evt) => this.emit('error', new Error(String((evt as Error).message ?? evt))));
    this.realtime.on('state', (state) => this.emit('state', state));
  }

  static async init(options: ChatKitInitOptions): Promise<ChatKit> {
    const outbox = await createOutboxStorage<SendRequest>();
    const realtime = new RealtimeClient({
      url: options.realtimeUrl ?? 'wss://api.vichat.local/realtime',
      token: options.token,
      autoReconnect: true
    });

    const kit = new ChatKit(options, realtime, outbox);
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
      senderId: this.options.device.id,
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
        conversationId: conversation.id,
        message: {
          ...message,
          body: message.body
        }
      }
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
      userId: this.options.device.id,
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
        payload: item.payload
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
        const message = envelope.payload as MessagePayload;
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
}

export default ChatKit;
