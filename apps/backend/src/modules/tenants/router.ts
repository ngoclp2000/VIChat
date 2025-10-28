import type { FastifyInstance } from 'fastify';
import { listTenants } from './store';

export async function registerTenantRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/tenants', async (_request, reply) => {
    const tenants = listTenants().map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      clientId: tenant.clientId
    }));

    reply.send(tenants);
  });
}
