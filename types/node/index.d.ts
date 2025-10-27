declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }

  interface Process {
    env: ProcessEnv;
    exit(code?: number): never;
  }
}

declare const process: NodeJS.Process;

interface Buffer extends Uint8Array {
  toString(encoding?: string): string;
}

declare const Buffer: {
  from(data: string | number[] | ArrayBuffer, encoding?: string): Buffer;
  alloc(size: number): Buffer;
  byteLength(input: string, encoding?: string): number;
};

declare const __dirname: string;

declare module 'path' {
  export function resolve(...segments: string[]): string;
}

declare module 'http' {
  export interface IncomingMessage {
    url?: string | null;
    method?: string;
    headers: Record<string, string | string[] | undefined>;
  }

  export interface ServerResponse {
    writeHead(statusCode: number, headers?: Record<string, string>): void;
    end(data?: unknown): void;
  }
}

declare module 'http2' {
  export interface Http2ServerRequest {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
  }

  export interface Http2ServerResponse {
    end(data?: unknown): void;
  }
}

declare module 'net' {
  export interface Socket {
    destroy(error?: Error): void;
  }
}

declare module 'tls' {
  export interface TLSSocket {
    destroy(error?: Error): void;
  }
}

declare module 'stream' {
  export interface Readable {
    pipe<T>(destination: T, options?: { end?: boolean }): T;
  }
}

declare module 'crypto' {
  interface ScryptOptions {
    N?: number;
    r?: number;
    p?: number;
    maxmem?: number;
  }

  export function randomBytes(size: number): Buffer;
  export function scryptSync(
    password: string | Buffer,
    salt: string | Buffer,
    keylen: number,
    options?: ScryptOptions
  ): Buffer;
  export function timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean;
}
