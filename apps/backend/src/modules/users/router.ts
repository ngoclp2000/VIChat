import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyAccessToken } from '../auth/service';
import { getTenantByClientId } from '../tenants/store';
import { createTenantUser, listPublicTenantUsers, listTenantUsers } from './store';

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

  const createUserSchema = z.object({
    userId: z.string().min(3).max(64),
    displayName: z.string().min(1).max(120),
    password: z.string().min(6).max(128),
    roles: z.array(z.string().min(1)).optional()
  });

  app.post('/v1/tenants/:tenantId/users', async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const authHeader = request.headers.authorization;
    let authorized = false;
    let canAssignRoles = false;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const verified = verifyAccessToken(token);

        if (tenantId !== verified.tenantId) {
          return reply.status(403).send({ message: 'Forbidden' });
        }

        authorized = true;
        canAssignRoles = true;
      } catch {
        return reply.status(401).send({ message: 'Invalid token' });
      }
    } else {
      const { clientId } = request.query as { clientId?: string };
      if (!clientId) {
        return reply.status(401).send({ message: 'Missing credentials' });
      }

      const tenant = getTenantByClientId(clientId);
      if (!tenant || tenant.id !== tenantId) {
        return reply.status(403).send({ message: 'Forbidden' });
      }

      authorized = true;
    }

    if (!authorized) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    let parsed: z.infer<typeof createUserSchema>;
    try {
      parsed = createUserSchema.parse(request.body);
    } catch (err) {
      return reply.status(400).send({ message: 'Invalid payload', detail: (err as Error).message });
    }

    try {
      const created = await createTenantUser(app.mongo.db, tenantId, {
        ...parsed,
        roles: canAssignRoles ? parsed.roles : undefined
      });
      return reply.status(201).send(created);
    } catch (err) {
      const message = (err as Error).message;
      if (message === 'USER_EXISTS') {
        return reply.status(409).send({ message: 'Tài khoản đã tồn tại' });
      }

      if (message === 'USER_ID_REQUIRED' || message === 'PASSWORD_REQUIRED') {
        return reply.status(400).send({ message: 'Thiếu thông tin bắt buộc' });
      }

      request.log.error({ err }, 'Failed to create tenant user');
      return reply.status(500).send({ message: 'Không thể tạo người dùng' });
    }
  });
}
