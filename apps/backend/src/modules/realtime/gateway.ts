import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import type { VerifiedToken } from '../auth/service';
import { saveMessage, toMessagePayload } from '../messages/store';
import { getConversationById, touchConversation } from '../conversations/store';

interface ConnectionContext {
  id: string;
  socket: WebSocket;
  token: VerifiedToken;
}

type UpgradeRequest = {
  url?: string | null;
  headers: Record<string, string | string[] | undefined>;
};

const mediaAttachmentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['image', 'video', 'audio', 'file']),
  size: z.number().nonnegative(),
  mimeType: z.string().min(1),
  key: z.string().min(1),
  digest: z.string().min(1)
});

const cipherEnvelopeSchema = z.object({
  ciphertext: z.string(),
  scheme: z.enum(['signal', 'mls']),
  keyId: z.string(),
  media: z.array(mediaAttachmentSchema).optional()
});

const stickerSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  name: z.string().optional(),
  pack: z.string().optional()
});

const messageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  senderDeviceId: z.string().min(1),
  senderId: z.string().optional(),
  sentAt: z
    .union([z.date(), z.string().datetime()])
    .transform((value) => (value instanceof Date ? value : new Date(value))),
  deliveredAt: z
    .union([z.date(), z.string().datetime()])
    .transform((value) => (value instanceof Date ? value : new Date(value)))
    .optional(),
  readAt: z
    .union([z.date(), z.string().datetime()])
    .transform((value) => (value instanceof Date ? value : new Date(value)))
    .optional(),
  type: z.enum(['text', 'media', 'system', 'sticker']),
  body: cipherEnvelopeSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  sticker: stickerSchema.optional()
});

export function registerRealtimeGateway(app: FastifyInstance): void {
  const connections = new Map<string, ConnectionContext>();
  const wss = new WebSocketServer({ noServer: true });

  app.server.on('upgrade', (request: IncomingMessage, socket: Socket, head: unknown) => {
    const normalized = normalizeUpgradeRequest(request);
    if (!shouldHandleUpgrade(normalized)) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket as unknown as any, head as unknown as any, (ws) => {
      wss.emit('connection', ws, request as UpgradeRequest);
    });
  });

  wss.on('connection', (socket, request) => {
    const upgradeRequest = normalizeUpgradeRequest(request as IncomingMessage | UpgradeRequest);
    const token = authenticate(app, socket, upgradeRequest);
    if (!token) {
      socket.close(4002, 'Invalid token');
      return;
    }

    const id = nanoid();
    const ctx: ConnectionContext = { id, socket, token };
    connections.set(id, ctx);
    app.log.info({ id, token }, 'Realtime connection established');

    socket.on('message', (data) => {
      void (async () => {
        try {
          const payload = JSON.parse(String(data));
          await handleMessage(app, ctx, payload);
        } catch (err) {
          app.log.error({ err }, 'Invalid message payload');
        }
      })();
    });

    socket.on('close', () => {
      connections.delete(id);
      app.log.info({ id }, 'Realtime connection closed');
    });
  });

  function broadcast(tenantId: string, message: unknown, allowedUsers?: Iterable<string>): void {
    const allowed = allowedUsers ? new Set(allowedUsers) : undefined;

    for (const ctx of connections.values()) {
      if (ctx.token.tenantId !== tenantId) continue;
      if (allowed && !allowed.has(ctx.token.userId)) continue;
      if (ctx.socket.readyState === ctx.socket.OPEN) {
        ctx.socket.send(JSON.stringify(message));
      }
    }
  }

  async function handleMessage(app: FastifyInstance, ctx: ConnectionContext, payload: any): Promise<void> {
    const { action, payload: data } = payload as { action: string; payload?: unknown };
    switch (action) {
      case 'envelope':
        await handleEnvelope(app, ctx, data);
        break;
      default:
        app.log.warn({ action }, 'Unknown realtime action');
    }
  }

  async function handleEnvelope(app: FastifyInstance, ctx: ConnectionContext, envelope: any): Promise<void> {
    if (!envelope || typeof envelope !== 'object') {
      app.log.warn('Invalid envelope payload');
      return;
    }

    const { type, payload } = envelope as { type: string; payload: unknown };

    switch (type) {
      case 'message':
        await handleMessageEnvelope(app, ctx, payload);
        break;
      case 'presence':
      case 'typing':
      case 'call':
      case 'ack':
        broadcast(ctx.token.tenantId, envelope);
        break;
      default:
        app.log.warn({ type }, 'Unknown envelope type');
    }
  }

  async function handleMessageEnvelope(app: FastifyInstance, ctx: ConnectionContext, payload: unknown): Promise<void> {
    try {
      const parsed = messageSchema.parse(payload);
      const conversation = await getConversationById(app.mongo.db, ctx.token.tenantId, parsed.conversationId);

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (!conversation.members.includes(ctx.token.userId)) {
        throw new Error('User is not a member of this conversation');
      }

      const messageRecord = await saveMessage(app.mongo.db, app.messageEncryptionKey, {
        id: parsed.id,
        tenantId: ctx.token.tenantId,
        conversationId: parsed.conversationId,
        senderId: ctx.token.userId,
        senderDeviceId: parsed.senderDeviceId,
        sentAt: parsed.sentAt instanceof Date ? parsed.sentAt : new Date(parsed.sentAt),
        deliveredAt: parsed.deliveredAt,
        readAt: parsed.readAt,
        type: parsed.type,
        body: parsed.body,
        metadata: parsed.metadata,
        sticker: parsed.sticker
      });

      await touchConversation(app.mongo.db, ctx.token.tenantId, parsed.conversationId, messageRecord.sentAt);

      const response = toMessagePayload(messageRecord);
      broadcast(ctx.token.tenantId, { type: 'message', payload: response }, conversation.members);
    } catch (err) {
      app.log.warn({ err }, 'Failed to process inbound message');
      if (ctx.socket.readyState === ctx.socket.OPEN) {
        ctx.socket.send(
          JSON.stringify({
            type: 'error',
            payload: {
              message: (err as Error).message ?? 'Unable to process message',
              reference: 'message'
            }
          })
        );
      }
    }
  }

  app.decorate('broadcastToTenant', (tenantId: string, message: unknown, allowedUsers?: Iterable<string>) => {
    broadcast(tenantId, message, allowedUsers);
  });
}

function normalizeUpgradeRequest(request: UpgradeRequest | IncomingMessage): UpgradeRequest {
  return {
    url: request.url ?? null,
    headers: request.headers as Record<string, string | string[] | undefined>
  };
}

function shouldHandleUpgrade(request: UpgradeRequest): boolean {
  if (!request.url) return false;
  try {
    const url = new URL(request.url, 'http://localhost');
    return url.pathname === '/realtime';
  } catch {
    return false;
  }
}

function authenticate(app: FastifyInstance, socket: WebSocket, request: UpgradeRequest): VerifiedToken | null {
  if (!request.url) return null;
  try {
    const url = new URL(request.url, 'http://localhost');
    const auth = url.searchParams.get('auth') ?? request.headers['sec-websocket-protocol'];
    if (typeof auth !== 'string') {
      socket.close(4001, 'Missing auth token');
      return null;
    }

    return app.verifyJwt(auth) as VerifiedToken;
  } catch (err) {
    app.log.warn({ err }, 'Failed to verify websocket token');
    return null;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    broadcastToTenant: (tenantId: string, message: unknown, allowedUsers?: Iterable<string>) => void;
    verifyJwt: (token: string) => VerifiedToken;
  }
}
