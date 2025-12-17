/**
 * Phoenix WebSocket service for real-time game communication.
 */
import { Socket, Channel } from 'phoenix';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:4000/socket';

class SocketService {
  private socket: Socket | null = null;
  private gameChannel: Channel | null = null;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new Socket(WS_URL, {
        params: { token },
      });

      this.socket.onOpen(() => {
        console.log('Socket connected');
        resolve();
      });

      this.socket.onError((error) => {
        console.error('Socket error:', error);
        reject(error);
      });

      this.socket.onClose(() => {
        console.log('Socket disconnected');
      });

      this.socket.connect();
    });
  }

  disconnect() {
    if (this.gameChannel) {
      this.gameChannel.leave();
      this.gameChannel = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinGame(playerId: number): Promise<Channel> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.gameChannel = this.socket.channel(`game:${playerId}`, {});

      this.gameChannel
        .join()
        .receive('ok', () => {
          console.log('Joined game channel');
          resolve(this.gameChannel!);
        })
        .receive('error', (error) => {
          console.error('Failed to join game channel:', error);
          reject(error);
        });
    });
  }

  sendCommand(command: string) {
    if (!this.gameChannel) {
      console.error('Not connected to game channel');
      return;
    }

    this.gameChannel.push('command', { input: command });
  }

  onGameEvent(event: string, callback: (payload: unknown) => void) {
    if (!this.gameChannel) {
      console.error('Not connected to game channel');
      return;
    }

    this.gameChannel.on(event, callback);
  }

  offGameEvent(event: string) {
    if (!this.gameChannel) {
      return;
    }

    this.gameChannel.off(event);
  }
}

export const socketService = new SocketService();
export default socketService;
