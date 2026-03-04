import { Socket, Channel } from "phoenix";

const SOCKET_URL = process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:4000/socket/websocket";

class PhoenixClient {
  private socket: Socket | null = null;
  private channel: Channel | null = null;

  connect(token: string): void {
    this.socket = new Socket(SOCKET_URL, {
      params: { token },
    });
    this.socket.connect();
  }

  joinGame(): Promise<any> {
    if (!this.socket) {
      return Promise.reject(new Error("Socket not connected. Call connect() first."));
    }

    this.channel = this.socket.channel("game:lobby", {});

    return new Promise((resolve, reject) => {
      this.channel!
        .join()
        .receive("ok", (payload) => resolve(payload))
        .receive("error", (reason) => reject(new Error(`Failed to join channel: ${JSON.stringify(reason)}`)))
        .receive("timeout", () => reject(new Error("Channel join timed out")));
    });
  }

  disconnect(): void {
    if (this.channel) {
      this.channel.leave();
      this.channel = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onEvent(event: string, callback: (payload: any) => void): void {
    if (!this.channel) {
      throw new Error("Channel not joined. Call joinGame() first.");
    }
    this.channel.on(event, callback);
  }

  navigate(direction: string): void {
    this.push("navigate", { direction });
  }

  clickEntity(entityId: string): void {
    this.push("click_entity", { entity_id: entityId });
  }

  action(actionName: string, entityId?: string): void {
    this.push("action", { action: actionName, entity_id: entityId });
  }

  dialogueSelect(choiceIndex: number): void {
    this.push("dialogue_select", { choice: choiceIndex });
  }

  chat(mode: string, message: string): void {
    this.push("chat", { mode, message });
  }

  shopAction(action: string, itemIndex?: number): void {
    this.push("shop_action", { action, item_index: itemIndex });
  }

  shopClose(): void {
    this.push("shop_close", {});
  }

  containerAction(action: string, itemIndex?: number): void {
    this.push("container_action", { action, item_index: itemIndex });
  }

  containerClose(): void {
    this.push("container_close", {});
  }

  private push(event: string, payload: object): void {
    if (!this.channel) {
      console.warn(`PhoenixClient: attempted to push "${event}" but channel is not joined.`);
      return;
    }
    this.channel.push(event, payload);
  }
}

const phoenixClient = new PhoenixClient();
export default phoenixClient;
