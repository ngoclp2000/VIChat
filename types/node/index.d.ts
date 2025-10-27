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
