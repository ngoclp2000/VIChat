declare module 'jsonwebtoken' {
  export interface SignOptions {
    issuer?: string;
    audience?: string;
    expiresIn?: number | string;
  }

  export interface VerifyOptions {
    issuer?: string;
    audience?: string;
  }

  export interface JwtPayload {
    [key: string]: unknown;
    sub?: string;
    tenantId?: string;
    scopes?: string[];
    clientId?: string;
    roles?: string[];
  }

  export function sign(
    payload: string | object,
    secretOrPrivateKey: string,
    options?: SignOptions
  ): string;
  export function verify(
    token: string,
    secretOrPublicKey: string,
    options?: VerifyOptions
  ): JwtPayload;
}
