import { timingSafeEqual } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getEnv } from '../../config/env';
import { createTenant, getTenantById, listTenants } from '../tenants/store';
import { createTenantUser } from '../users/store';

const superAdminLoginSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128)
});

const limitsSchema = z
  .object({
    messagesPerMinute: z.number().min(1).max(10_000).optional(),
    callsPerMinute: z.number().min(0).max(1_000).optional()
  })
  .partial();

const createTenantSchema = z.object({
  id: z.string().min(3).max(64),
  name: z.string().min(1).max(120),
  clientId: z.string().min(3).max(64),
  apiKey: z.string().min(6).max(128),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
  limits: limitsSchema.optional()
});

const createTenantAdminSchema = z.object({
  userId: z.string().min(3).max(64),
  displayName: z.string().min(1).max(120),
  password: z.string().min(6).max(128)
});

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function registerSuperAdminRoutes(app: FastifyInstance): Promise<void> {
  const env = getEnv();
  const superToken = `Bearer ${env.SUPERADMIN_TOKEN}`;

  app.post('/v1/superadmin/login', async (request, reply) => {
    let parsed: z.infer<typeof superAdminLoginSchema>;
    try {
      parsed = superAdminLoginSchema.parse(request.body);
    } catch (err) {
      return reply.status(400).send({ message: 'Invalid payload', detail: (err as Error).message });
    }

    const usernameMatches = safeEqual(parsed.username, env.SUPERADMIN_USER);
    const passwordMatches = safeEqual(parsed.password, env.SUPERADMIN_PASSWORD);

    if (!usernameMatches || !passwordMatches) {
      return reply.status(401).send({ message: 'Sai thông tin đăng nhập superadmin.' });
    }

    return reply.status(200).send({ token: env.SUPERADMIN_TOKEN });
  });

  app.register(async (superApp) => {
    superApp.addHook('onRequest', (request, reply, done) => {
      if (request.headers.authorization !== superToken) {
        reply.status(401).send({ message: 'Unauthorized' });
        return;
      }
      done();
    });

    superApp.get('/v1/superadmin/tenants', async (_request, reply) => {
      return reply.send(listTenants());
    });

    superApp.post('/v1/superadmin/tenants', async (request, reply) => {
      let parsed: z.infer<typeof createTenantSchema>;
      try {
        parsed = createTenantSchema.parse(request.body);
      } catch (err) {
        return reply.status(400).send({ message: 'Invalid payload', detail: (err as Error).message });
      }

      try {
        const tenant = createTenant(parsed);
        return reply.status(201).send(tenant);
      } catch (err) {
        const message = (err as Error).message;
        if (message === 'TENANT_EXISTS') {
          return reply.status(409).send({ message: 'Tenant đã tồn tại' });
        }
        if (message === 'CLIENT_EXISTS') {
          return reply.status(409).send({ message: 'ClientId đã được sử dụng' });
        }
        if (message === 'TENANT_ID_REQUIRED' || message === 'CLIENT_ID_REQUIRED' || message === 'API_KEY_REQUIRED') {
          return reply.status(400).send({ message: 'Thiếu thông tin bắt buộc' });
        }

        request.log.error({ err }, 'Failed to create tenant');
        return reply.status(500).send({ message: 'Không thể tạo tenant' });
      }
    });

    superApp.post('/v1/superadmin/tenants/:tenantId/users', async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      let parsed: z.infer<typeof createTenantAdminSchema>;
      try {
        parsed = createTenantAdminSchema.parse(request.body);
      } catch (err) {
        return reply.status(400).send({ message: 'Invalid payload', detail: (err as Error).message });
      }

      const tenant = getTenantById(tenantId);
      if (!tenant) {
        return reply.status(404).send({ message: 'Tenant không tồn tại' });
      }

      try {
        const profile = await createTenantUser(app.mongo.db, tenantId, {
          ...parsed,
          roles: ['admin']
        });
        return reply.status(201).send(profile);
      } catch (err) {
        const message = (err as Error).message;
        if (message === 'USER_EXISTS') {
          return reply.status(409).send({ message: 'Tài khoản đã tồn tại' });
        }
        if (message === 'USER_ID_REQUIRED' || message === 'PASSWORD_REQUIRED') {
          return reply.status(400).send({ message: 'Thiếu thông tin bắt buộc' });
        }

        request.log.error({ err }, 'Failed to create tenant admin user');
        return reply.status(500).send({ message: 'Không thể tạo người dùng quản trị' });
      }
    });
  });
}
