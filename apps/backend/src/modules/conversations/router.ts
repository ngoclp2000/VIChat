import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyAccessToken } from '../auth/service';

const createConversationSchema = z.object({
  type: z.enum(['dm', 'group']),
  members: z.array(z.string()).min(1),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export async function registerConversationRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/conversations', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: 'Missing token' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verified = verifyAccessToken(token);

    const payload = createConversationSchema.parse(request.body);
    const id = `conv_${Date.now().toString(36)}`;

    const response = {
      id,
      tenantId: verified.tenantId,
      type: payload.type,
      members: payload.members,
      metadata: payload.metadata ?? {},
      createdAt: new Date().toISOString()
    };

    app.broadcastToTenant(verified.tenantId, {
      type: 'presence',
      payload: {
        conversationId: id,
        userId: verified.userId,
        state: 'online'
      }
    });

    return reply.status(201).send(response);
  });
}
