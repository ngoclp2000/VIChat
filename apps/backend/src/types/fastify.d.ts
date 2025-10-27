import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    messageEncryptionKey: Buffer;
  }
}
