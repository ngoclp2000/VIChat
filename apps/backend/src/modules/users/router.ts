import type { FastifyInstance } from 'fastify';
import { verifyAccessToken } from '../auth/service';
import { listTenantUsers } from './store';

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/tenants/:tenantId/users', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: 'Missing token' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verified = verifyAccessToken(token);
    const { tenantId } = request.params as { tenantId: string };

    if (tenantId !== verified.tenantId) {
      return reply.status(403).send({ message: 'Forbidden' });
    }

    const users = await listTenantUsers(app.mongo.db, tenantId);
    return reply.send(users);
  });
}
