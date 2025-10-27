import type { FastifyInstance } from 'fastify';
import { verifyAccessToken } from '../auth/service';
import { getTenantByClientId } from '../tenants/store';
import { listPublicTenantUsers, listTenantUsers } from './store';

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/tenants/:tenantId/users', async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const authHeader = request.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const verified = verifyAccessToken(token);

        if (tenantId !== verified.tenantId) {
          return reply.status(403).send({ message: 'Forbidden' });
        }

        const users = await listTenantUsers(app.mongo.db, tenantId);
        return reply.send(users);
      } catch {
        return reply.status(401).send({ message: 'Invalid token' });
      }
    }

    const { clientId } = request.query as { clientId?: string };
    if (!clientId) {
      return reply.status(401).send({ message: 'Missing credentials' });
    }

    const tenant = getTenantByClientId(clientId);
    if (!tenant || tenant.id !== tenantId) {
      return reply.status(403).send({ message: 'Forbidden' });
    }

    const users = await listPublicTenantUsers(app.mongo.db, tenantId);
    return reply.send(users);
  });
}
