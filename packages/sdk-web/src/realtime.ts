import EventEmitter from 'eventemitter3';
import WebSocket from 'isomorphic-ws';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected';

export interface RealtimeOptions {
  url: string;
  token: string;
  protocols?: string[];
  autoReconnect?: boolean;
  retryDelays?: number[];
}

export interface OutgoingMessage {
  action: string;
  payload?: unknown;
}

interface RealtimeEvents {
  open: () => void;
  close: (event: WebSocket.CloseEvent) => void;
  error: (event: WebSocket.ErrorEvent) => void;
  message: (data: unknown) => void;
  state: (state: ConnectionState) => void;
}

export class RealtimeClient extends EventEmitter<RealtimeEvents> {
  private ws?: WebSocket;

  private readonly options: RealtimeOptions;

  private state: ConnectionState = 'idle';

  private retryAttempt = 0;

  private readonly retryDelays: number[];

  constructor(options: RealtimeOptions) {
    super();
    this.options = options;
    this.retryDelays = options.retryDelays ?? [1000, 2500, 5000, 10000];
  }

  connect(): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.setState('connecting');
    const { url, token, protocols } = this.options;
    const authUrl = new URL(url);
    authUrl.searchParams.set('auth', token);

    this.ws = new WebSocket(authUrl.toString(), protocols);
    this.ws.onopen = () => {
      this.retryAttempt = 0;
      this.setState('connected');
      this.emit('open');
    };
    this.ws.onclose = (event) => {
      this.setState('disconnected');
      this.emit('close', event);
      if (this.options.autoReconnect !== false) {
        this.scheduleReconnect();
      }
    };
    this.ws.onerror = (event) => {
      this.emit('error', event as WebSocket.ErrorEvent);
    };
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data));
        this.emit('message', data);
      } catch (err) {
        console.error('[ChatKit] Invalid message payload', err);
      }
    };
  }

  send(message: OutgoingMessage): void {
    if (!this.ws || this.state !== 'connected') {
      throw new Error('Realtime connection not established');
    }

    this.ws.send(JSON.stringify(message));
  }

  disconnect(): void {
    this.options.autoReconnect = false;
    this.ws?.close();
    this.ws = undefined;
    this.setState('disconnected');
  }

  private scheduleReconnect(): void {
    const delay = this.retryDelays[Math.min(this.retryAttempt, this.retryDelays.length - 1)];
    this.retryAttempt += 1;
    setTimeout(() => this.connect(), delay);
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.emit('state', next);
  }
}
