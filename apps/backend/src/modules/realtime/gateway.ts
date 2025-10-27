import type { IncomingMessage } from 'http';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import type { VerifiedToken } from '../auth/service';

interface ConnectionContext {
  id: string;
  socket: WebSocket;
  token: VerifiedToken;
}

export function registerRealtimeGateway(app: FastifyInstance): void {
  const connections = new Map<string, ConnectionContext>();
  const wss = new WebSocketServer({ noServer: true });

  app.server.on('upgrade', (request, socket, head) => {
    if (!shouldHandleUpgrade(request)) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (socket, request) => {
    const token = authenticate(app, socket, request);
    if (!token) {
      socket.close(4002, 'Invalid token');
      return;
    }

    const id = nanoid();
    const ctx: ConnectionContext = { id, socket, token };
    connections.set(id, ctx);
    app.log.info({ id, token }, 'Realtime connection established');

    socket.on('message', (data) => {
      try {
        const payload = JSON.parse(String(data));
        handleMessage(app, ctx, payload);
      } catch (err) {
        app.log.error({ err }, 'Invalid message payload');
      }
    });

    socket.on('close', () => {
      connections.delete(id);
      app.log.info({ id }, 'Realtime connection closed');
    });
  });

  function broadcast(tenantId: string, message: unknown): void {
    for (const ctx of connections.values()) {
      if (ctx.token.tenantId !== tenantId) continue;
      if (ctx.socket.readyState === ctx.socket.OPEN) {
        ctx.socket.send(JSON.stringify(message));
      }
    }
  }

  function handleMessage(app: FastifyInstance, ctx: ConnectionContext, payload: any): void {
    const { action, payload: data } = payload as { action: string; payload?: unknown };
    switch (action) {
      case 'envelope':
        broadcast(ctx.token.tenantId, data);
        break;
      default:
        app.log.warn({ action }, 'Unknown realtime action');
    }
  }

  app.decorate('broadcastToTenant', (tenantId: string, message: unknown) => {
    broadcast(tenantId, message);
  });
}

function shouldHandleUpgrade(request: IncomingMessage): boolean {
  if (!request.url) return false;
  try {
    const url = new URL(request.url, 'http://localhost');
    return url.pathname === '/realtime';
  } catch {
    return false;
  }
}

function authenticate(app: FastifyInstance, socket: WebSocket, request: IncomingMessage): VerifiedToken | null {
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
    broadcastToTenant: (tenantId: string, message: unknown) => void;
    verifyJwt: (token: string) => VerifiedToken;
  }
}
