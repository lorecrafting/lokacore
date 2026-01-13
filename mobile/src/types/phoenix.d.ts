/**
 * Type declarations for phoenix WebSocket library
 */

declare module 'phoenix' {
  export class Socket {
    constructor(endPoint: string, opts?: SocketOptions);
    connect(): void;
    disconnect(callback?: () => void, code?: number, reason?: string): void;
    onOpen(callback: () => void): void;
    onClose(callback: (event: CloseEvent) => void): void;
    onError(callback: (error: unknown) => void): void;
    channel(topic: string, params?: object): Channel;
    isConnected(): boolean;
  }

  export interface SocketOptions {
    params?: object | (() => object);
    transport?: new (endpoint: string) => object;
    timeout?: number;
    heartbeatIntervalMs?: number;
    reconnectAfterMs?: (tries: number) => number;
    rejoinAfterMs?: (tries: number) => number;
    longpollerTimeout?: number;
    encode?: (payload: object, callback: (encoded: string) => void) => void;
    decode?: (payload: string, callback: (decoded: object) => void) => void;
    logger?: (kind: string, msg: string, data: unknown) => void;
    vsn?: string;
  }

  export class Channel {
    constructor(topic: string, params: object, socket: Socket);
    join(timeout?: number): Push;
    leave(timeout?: number): Push;
    push(event: string, payload?: object, timeout?: number): Push;
    on<T = unknown>(event: string, callback: (payload: T) => void): number;
    off(event: string, ref?: number): void;
    onClose(callback: () => void): void;
    onError(callback: (reason?: string) => void): void;
  }

  export class Push {
    receive<T = unknown>(status: string, callback: (response: T) => void): Push;
  }

  export class Presence {
    constructor(channel: Channel, opts?: PresenceOptions);
    onJoin(callback: (key: string, currentPresence: unknown, newPresence: unknown) => void): void;
    onLeave(callback: (key: string, currentPresence: unknown, leftPresence: unknown) => void): void;
    onSync(callback: () => void): void;
    list<T>(by?: (key: string, presence: unknown) => T): T[];
    inPendingSyncState(): boolean;
  }

  export interface PresenceOptions {
    events?: {
      state: string;
      diff: string;
    };
  }
}
