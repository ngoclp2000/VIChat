import type { FastifyInstance } from 'fastify';
import type { FastifyWebsocketOptions } from '@fastify/websocket';
import type WebSocket from 'ws';
import { nanoid } from 'nanoid';
import type { VerifiedToken } from '../auth/service';

interface ConnectionContext {
  id: string;
  socket: WebSocket;
  token: VerifiedToken;
}

export function registerRealtimeGateway(app: FastifyInstance): void {
  const connections = new Map<string, ConnectionContext>();

  const options: FastifyWebsocketOptions = {
    options: {
      clientTracking: false
    }
  };

  app.get('/realtime', { websocket: options }, (connection, request) => {
    const query = request.query as { auth?: string };
    const auth = query?.auth ?? request.headers['sec-websocket-protocol'];
    if (typeof auth !== 'string') {
      connection.socket.close(4001, 'Missing auth token');
      return;
    }

    let token: VerifiedToken;
    try {
      token = app.verifyJwt(auth) as VerifiedToken;
    } catch (err) {
      connection.socket.close(4002, 'Invalid token');
      app.log.warn({ err }, 'Failed to verify websocket token');
      return;
    }

    const id = nanoid();
    const ctx: ConnectionContext = {
      id,
      socket: connection.socket,
      token
    };

    connections.set(id, ctx);
    app.log.info({ id, token }, 'Realtime connection established');

    connection.socket.on('message', (data) => {
      try {
        const payload = JSON.parse(String(data));
        handleMessage(app, ctx, payload);
      } catch (err) {
        app.log.error({ err }, 'Invalid message payload');
      }
    });

    connection.socket.on('close', () => {
      connections.delete(id);
      app.log.info({ id }, 'Realtime connection closed');
    });
  });

  function broadcast(tenantId: string, message: unknown): void {
    for (const ctx of connections.values()) {
      if (ctx.token.tenantId !== tenantId) continue;
      ctx.socket.send(JSON.stringify(message));
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

declare module 'fastify' {
  interface FastifyInstance {
    broadcastToTenant: (tenantId: string, message: unknown) => void;
    verifyJwt: (token: string) => VerifiedToken;
  }
}
