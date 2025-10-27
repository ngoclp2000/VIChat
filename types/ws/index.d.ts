declare module 'ws' {
  type EventHandler<T = unknown> = (data: T) => void;

  export default class WebSocket {
    static readonly OPEN: number;
    readonly OPEN: number;
    readonly readyState: number;
    onopen: (() => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    constructor(url: string, protocols?: string | string[]);
    send(data: string): void;
    close(code?: number, reason?: string): void;
    on(event: 'message', listener: EventHandler): this;
    on(event: 'close', listener: EventHandler): this;
    on(event: 'error', listener: EventHandler): this;
  }

  export interface WebSocketServerOptions {
    noServer?: boolean;
  }

  export class WebSocketServer {
    constructor(options?: WebSocketServerOptions);
    handleUpgrade(request: unknown, socket: any, head: ArrayBuffer, callback: (socket: WebSocket) => void): void;
    on(event: 'connection', listener: (socket: WebSocket, request: unknown) => void): this;
    emit(event: 'connection', socket: WebSocket, request: unknown): boolean;
  }
}
