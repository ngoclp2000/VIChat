import { MongoClient, type Db } from 'mongodb';
import { getEnv } from './env';

let cachedClient: MongoClient | null = null;

export async function connectMongo(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient) {
    const env = getEnv();
    return { client: cachedClient, db: cachedClient.db(env.MONGODB_DB) };
  }

  const env = getEnv();
  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return { client, db: client.db(env.MONGODB_DB) };
}

export async function getMongoDb(): Promise<Db> {
  const { db } = await connectMongo();
  return db;
}

export async function closeMongo(): Promise<void> {
  if (!cachedClient) return;
  await cachedClient.close();
  cachedClient = null;
}

declare module 'fastify' {
  interface FastifyInstance {
    mongo: {
      client: MongoClient;
      db: Db;
    };
  }
}
