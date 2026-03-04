declare module "phoenix" {
  export class Socket {
    constructor(endPoint: string, opts?: Record<string, any>);
    connect(): void;
    disconnect(): void;
    channel(topic: string, params?: Record<string, any>): Channel;
    onOpen(callback: () => void): void;
    onClose(callback: () => void): void;
    onError(callback: (error: any) => void): void;
  }

  export class Channel {
    join(): Push;
    leave(): Push;
    on(event: string, callback: (payload: any) => void): number;
    off(event: string, ref?: number): void;
    push(event: string, payload: Record<string, any>): Push;
  }

  export class Push {
    receive(status: string, callback: (response: any) => void): Push;
  }
}
