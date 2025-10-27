import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { Db } from 'mongodb';
import { getEnv } from '../../config/env';
import { getTenantByClientId } from '../tenants/store';
import { verifyTenantUserSecret } from '../users/store';

export class AuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const tokenRequestSchema = z.object({
  clientId: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  userSecret: z.string().min(6),
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

export async function issueAccessToken(db: Db, request: TokenRequest): Promise<TokenResponse> {
  const env = getEnv();
  const tenant = getTenantByClientId(request.clientId);
  if (!tenant || tenant.id !== request.tenantId) {
    throw new AuthError('Không tìm thấy tenant hoặc ứng dụng phù hợp.', 400);
  }

  const user = await verifyTenantUserSecret(db, request.tenantId, request.userId, request.userSecret);
  if (!user) {
    throw new AuthError('Sai thông tin đăng nhập hoặc mật khẩu.', 401);
  }

  const user = await verifyTenantUserSecret(db, request.tenantId, request.userId, request.userSecret);
  if (!user) {
    throw new Error('Invalid user credentials');
  }

  const expiresInSeconds = 60 * 15;
  const token = jwt.sign(
    {
      sub: user.userId,
      tenantId: request.tenantId,
      scopes: request.scopes,
      clientId: request.clientId,
      roles: user.roles
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
  roles: string[];
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
    clientId: decoded.clientId as string,
    roles: (decoded.roles as string[]) ?? []
  };
}
