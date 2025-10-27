import { config as loadEnv } from 'dotenv';

loadEnv();

export interface Env {
  PORT: number;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_SECRET: string;
  REALTIME_PUBLIC_URL: string;
}

export function getEnv(): Env {
  return {
    PORT: Number(process.env.PORT ?? 4000),
    JWT_ISSUER: process.env.JWT_ISSUER ?? 'vichat',
    JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? 'chatkit',
    JWT_SECRET: process.env.JWT_SECRET ?? 'local-dev-secret',
    REALTIME_PUBLIC_URL: process.env.REALTIME_PUBLIC_URL ?? 'ws://localhost:4000/realtime'
  };
}
