import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { DeviceInfo } from '@vichat/shared';
import { verifyAccessToken } from '../auth/service';
import { createConversation, listConversationsForMember, toConversationResponse } from '../conversations/store';
import { assertUsersBelongToTenant } from '../users/store';

interface ClientDocument {
  _id: ObjectId;
  tenantId: string;
  userId: string;
  displayName: string;
  devices: Array<DeviceInfo & { lastSeenAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const deviceSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(['web', 'ios', 'android', 'desktop']),
  appVersion: z.string().optional()
});

const bootstrapConversationSchema = z.object({
  type: z.enum(['dm', 'group']),
  members: z.array(z.string()).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  name: z.string().min(1).max(120).optional()
});

const initClientSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  device: deviceSchema,
  bootstrapConversations: z.array(bootstrapConversationSchema).optional()
});

export async function registerClientRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/clients/init', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ message: 'Missing token' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verified = verifyAccessToken(token);
    const payload = initClientSchema.parse(request.body);

    const clients = app.mongo.db.collection<ClientDocument>('clients');
    const now = new Date();
    const existing = await clients.findOne({ tenantId: verified.tenantId, userId: verified.userId });

    const deviceEntry = { ...payload.device, lastSeenAt: now };
    let clientDoc: ClientDocument;

    if (existing) {
      const otherDevices = existing.devices.filter(
        (device: ClientDocument['devices'][number]) => device.id !== deviceEntry.id
      );
      clientDoc = {
        ...existing,
        displayName: payload.displayName ?? existing.displayName ?? verified.userId,
        devices: [...otherDevices, deviceEntry],
        updatedAt: now
      };
      await clients.updateOne(
        { _id: existing._id },
        {
          $set: {
            displayName: clientDoc.displayName,
            devices: clientDoc.devices,
            updatedAt: now
          }
        }
      );
    } else {
      clientDoc = {
        _id: new ObjectId(),
        tenantId: verified.tenantId,
        userId: verified.userId,
        displayName: payload.displayName ?? verified.userId,
        devices: [deviceEntry],
        createdAt: now,
        updatedAt: now
      };
      await clients.insertOne(clientDoc);
    }

    if (payload.bootstrapConversations?.length) {
      for (const conversation of payload.bootstrapConversations) {
        try {
          await assertUsersBelongToTenant(app.mongo.db, verified.tenantId, conversation.members);
          await createConversation(app.mongo.db, verified.tenantId, verified.userId, conversation);
        } catch (err) {
          request.log.warn({ err }, 'Failed to bootstrap conversation');
        }
      }
    }

    const conversations = await listConversationsForMember(app.mongo.db, verified.tenantId, verified.userId);

    return reply.send({
      user: {
        id: verified.userId,
        tenantId: verified.tenantId,
        displayName: clientDoc.displayName,
        roles: verified.roles,
        devices: clientDoc.devices.map((device) => ({
          id: device.id,
          platform: device.platform,
          appVersion: device.appVersion,
          lastSeenAt: device.lastSeenAt.toISOString()
        }))
      },
      conversations: conversations.map(toConversationResponse)
    });
  });
}
