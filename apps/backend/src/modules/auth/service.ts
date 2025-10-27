import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getEnv } from '../../config/env';
import { getTenantByClientId } from '../tenants/store';

const tokenRequestSchema = z.object({
  clientId: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  scopes: z.array(z.string()).default([])
});

export type TokenRequest = z.infer<typeof tokenRequestSchema>;

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

export function validateTokenRequest(payload: unknown): TokenRequest {
  return tokenRequestSchema.parse(payload);
}

export function issueAccessToken(request: TokenRequest): TokenResponse {
  const env = getEnv();
  const tenant = getTenantByClientId(request.clientId);
  if (!tenant || tenant.id !== request.tenantId) {
    throw new Error('Invalid tenant or clientId');
  }

  const expiresInSeconds = 60 * 15;
  const token = jwt.sign(
    {
      sub: request.userId,
      tenantId: request.tenantId,
      scopes: request.scopes,
      clientId: request.clientId
    },
    env.JWT_SECRET,
    {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: expiresInSeconds
    }
  );

  return {
    accessToken: token,
    expiresIn: expiresInSeconds
  };
}

export interface VerifiedToken {
  tenantId: string;
  userId: string;
  scopes: string[];
  clientId: string;
}

export function verifyAccessToken(token: string): VerifiedToken {
  const env = getEnv();
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE
  }) as jwt.JwtPayload;

  return {
    tenantId: decoded.tenantId as string,
    userId: decoded.sub as string,
    scopes: (decoded.scopes as string[]) ?? [],
    clientId: decoded.clientId as string
  };
}
