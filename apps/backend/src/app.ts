import Fastify from 'fastify';
import { getEnv } from './config/env';
import { registerRealtimeGateway } from './modules/realtime/gateway';
import { seedTenants } from './modules/tenants/store';
import { registerConversationRoutes } from './modules/conversations/router';
import { issueAccessToken, validateTokenRequest, verifyAccessToken } from './modules/auth/service';
import { connectMongo, closeMongo } from './config/mongo';
import { registerClientRoutes } from './modules/clients/router';
import { seedUsers } from './modules/users/store';
import { registerUserRoutes } from './modules/users/router';

export async function createApp() {
  const env = getEnv();
  const app = Fastify({
    logger: true
  });

  const mongo = await connectMongo();
  seedTenants();
  await seedUsers(mongo.db);

  app.decorate('verifyJwt', (token: string) => verifyAccessToken(token));
  app.decorate('mongo', mongo);

  app.addHook('onClose', async () => {
    await closeMongo();
  });

  app.addHook('onRequest', (request, reply, done) => {
    const origin = request.headers.origin ?? '*';
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Vary', 'Origin');
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header(
      'Access-Control-Allow-Headers',
      (request.headers['access-control-request-headers'] as string | undefined) ?? 'authorization,content-type'
    );
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

    if (request.method === 'OPTIONS') {
      reply.status(204).send();
      return;
    }

    done();
  });

  const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
  const rateLimitWindowMs = 60_000;
  const rateLimitMax = 1000;

  app.addHook('onRequest', (request, reply, done) => {
    const key = request.headers['x-tenant-id']?.toString() ?? request.ip ?? 'anonymous';
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
      reply.header('X-RateLimit-Limit', rateLimitMax);
      reply.header('X-RateLimit-Remaining', rateLimitMax - 1);
      reply.header('X-RateLimit-Reset', Math.ceil((now + rateLimitWindowMs) / 1000));
      done();
      return;
    }

    if (entry.count >= rateLimitMax) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      reply.header('Retry-After', retryAfterSeconds);
      reply.header('X-RateLimit-Limit', rateLimitMax);
      reply.header('X-RateLimit-Remaining', 0);
      reply.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
      reply.status(429).send({ message: 'Too many requests' });
      return;
    }

    entry.count += 1;
    reply.header('X-RateLimit-Limit', rateLimitMax);
    reply.header('X-RateLimit-Remaining', Math.max(0, rateLimitMax - entry.count));
    reply.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
    done();
  });

  registerRealtimeGateway(app);

  app.get('/healthz', async () => ({
    status: 'ok',
    realtime: env.REALTIME_PUBLIC_URL
  }));

  app.post('/v1/auth/token', async (request, reply) => {
    try {
      const parsed = validateTokenRequest(request.body);
      const token = await issueAccessToken(app.mongo.db, parsed);
      return reply.status(200).send(token);
    } catch (err) {
      request.log.error({ err }, 'Failed to issue token');
      return reply.status(400).send({ message: 'Invalid token request' });
    }
  });

  await registerConversationRoutes(app);
  await registerClientRoutes(app);
  await registerUserRoutes(app);

  return app;
}
