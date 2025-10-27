import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyAccessToken } from '../auth/service';
import {
  createConversation,
  getConversationById,
  listConversationsForMember,
  toConversationResponse
} from './store';

const createConversationSchema = z.object({
  type: z.enum(['dm', 'group']),
  members: z.array(z.string()).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
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

    try {
      const { record, created } = await createConversation(app.mongo.db, verified.tenantId, verified.userId, {
        type: payload.type,
        members: payload.members,
        metadata: payload.metadata,
        name: payload.name
      });

      const response = toConversationResponse(record);

      if (created) {
        app.broadcastToTenant(verified.tenantId, {
          type: 'conversation.created',
          payload: response
        });
      }

      return reply.status(created ? 201 : 200).send(response);
    } catch (err) {
      request.log.error({ err }, 'Failed to create conversation');
      return reply.status(400).send({ message: (err as Error).message });
    }
  });

  app.get('/v1/conversations', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: 'Missing token' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verified = verifyAccessToken(token);

    const member = (request.query as Record<string, string | undefined>)?.member ?? verified.userId;
    const records = await listConversationsForMember(app.mongo.db, verified.tenantId, member);
    return reply.send(records.map(toConversationResponse));
  });

  app.get('/v1/conversations/:id', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: 'Missing token' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verified = verifyAccessToken(token);
    const id = (request.params as { id: string }).id;
    const record = await getConversationById(app.mongo.db, verified.tenantId, id);
    if (!record) {
      return reply.status(404).send({ message: 'Conversation not found' });
    }

    return reply.send(toConversationResponse(record));
  });
}
