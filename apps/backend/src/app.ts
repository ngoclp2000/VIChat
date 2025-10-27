import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from 'fastify-rate-limit';
import { getEnv } from './config/env';
import { registerRealtimeGateway } from './modules/realtime/gateway';
import { seedTenants } from './modules/tenants/store';
import { registerConversationRoutes } from './modules/conversations/router';
import { issueAccessToken, validateTokenRequest, verifyAccessToken } from './modules/auth/service';

export async function createApp() {
  const env = getEnv();
  const app = Fastify({
    logger: true
  });

  seedTenants();

  app.decorate('verifyJwt', (token: string) => verifyAccessToken(token));

  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.headers['x-tenant-id']?.toString() ?? request.ip
  });
  await app.register(websocket);

  registerRealtimeGateway(app);

  app.get('/healthz', async () => ({
    status: 'ok',
    realtime: env.REALTIME_PUBLIC_URL
  }));

  app.post('/v1/auth/token', async (request, reply) => {
    try {
      const parsed = validateTokenRequest(request.body);
      const token = issueAccessToken(parsed);
      return reply.status(200).send(token);
    } catch (err) {
      request.log.error({ err }, 'Failed to issue token');
      return reply.status(400).send({ message: 'Invalid token request' });
    }
  });

  await registerConversationRoutes(app);

  return app;
}
