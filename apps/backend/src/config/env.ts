import { config as loadEnv } from 'dotenv';

loadEnv();

export interface Env {
  PORT: number;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_SECRET: string;
  REALTIME_PUBLIC_URL: string;
  MONGODB_URI: string;
  MONGODB_DB: string;
  MESSAGE_ENCRYPTION_KEY: string;
  SUPERADMIN_TOKEN: string;
}

export function getEnv(): Env {
  return {
    PORT: Number(process.env.PORT ?? 4000),
    JWT_ISSUER: process.env.JWT_ISSUER ?? 'vichat',
    JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? 'chatkit',
    JWT_SECRET: process.env.JWT_SECRET ?? 'local-dev-secret',
    REALTIME_PUBLIC_URL: process.env.REALTIME_PUBLIC_URL ?? 'ws://localhost:4000/realtime',
    MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017',
    MONGODB_DB: process.env.MONGODB_DB ?? 'vichat',
    MESSAGE_ENCRYPTION_KEY:
      process.env.MESSAGE_ENCRYPTION_KEY ?? 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    SUPERADMIN_TOKEN: process.env.SUPERADMIN_TOKEN ?? 'superadmin-secret'
  };
}
