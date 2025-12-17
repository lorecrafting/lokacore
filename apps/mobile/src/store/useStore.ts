/**
 * Zustand store for global state management.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';
import socketService from '../services/socket';

interface Player {
  id: number;
  email: string;
}

interface GameState {
  room: {
    name: string;
    description: string;
    exits: string[];
    contents: string[];
  } | null;
  messages: string[];
  stats: Record<string, number> | null;
}

interface AppState {
  // Auth state
  token: string | null;
  player: Player | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Game state
  game: GameState;
  isConnected: boolean;

  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;

  // Game actions
  connectToGame: () => Promise<void>;
  disconnectFromGame: () => void;
  sendCommand: (command: string) => void;
  addMessage: (message: string) => void;
  updateRoom: (room: GameState['room']) => void;
  updateStats: (stats: GameState['stats']) => void;
}

const TOKEN_KEY = 'exmud_auth_token';

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  token: null,
  player: null,
  isLoading: true,
  isAuthenticated: false,
  game: {
    room: null,
    messages: [],
    stats: null,
  },
  isConnected: false,

  // Auth actions
  login: async (email: string, password: string) => {
    try {
      console.log('Attempting login...');
      const response = await api.login(email, password);
      console.log('Login successful, saving token...');
      await SecureStore.setItemAsync(TOKEN_KEY, response.token);
      api.setToken(response.token);
      set({
        token: response.token,
        player: response.player,
        isAuthenticated: true,
      });
      console.log('Login complete');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  register: async (email: string, password: string) => {
    try {
      console.log('Attempting registration...');
      const response = await api.register(email, password);
      console.log('Registration successful, saving token...');
      await SecureStore.setItemAsync(TOKEN_KEY, response.token);
      api.setToken(response.token);
      set({
        token: response.token,
        player: response.player,
        isAuthenticated: true,
      });
      console.log('Registration complete');
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    api.setToken(null);
    socketService.disconnect();
    set({
      token: null,
      player: null,
      isAuthenticated: false,
      isConnected: false,
      game: {
        room: null,
        messages: [],
        stats: null,
      },
    });
  },

  loadToken: async () => {
    try {
      console.log('Loading token from SecureStore...');
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      console.log('Token loaded:', token ? 'Found' : 'Not found');
      if (token) {
        api.setToken(token);
        const response = await api.me();
        set({
          token,
          player: response.player,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error loading token:', error);
      try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } catch (deleteError) {
        console.error('Error deleting token:', deleteError);
      }
      set({ isLoading: false });
    }
  },

  // Game actions
  connectToGame: async () => {
    const { token, player } = get();
    if (!token || !player) {
      throw new Error('Not authenticated');
    }

    await socketService.connect(token);
    const channel = await socketService.joinGame(player.id);

    // Set up event listeners
    channel.on('room_update', (payload) => {
      get().updateRoom(payload as GameState['room']);
    });

    channel.on('message', (payload) => {
      get().addMessage((payload as { text: string }).text);
    });

    channel.on('stats_update', (payload) => {
      get().updateStats(payload as GameState['stats']);
    });

    set({ isConnected: true });
  },

  disconnectFromGame: () => {
    socketService.disconnect();
    set({
      isConnected: false,
      game: {
        room: null,
        messages: [],
        stats: null,
      },
    });
  },

  sendCommand: (command: string) => {
    socketService.sendCommand(command);
    // Echo the command to messages
    get().addMessage(`> ${command}`);
  },

  addMessage: (message: string) => {
    set((state) => ({
      game: {
        ...state.game,
        messages: [...state.game.messages.slice(-99), message],
      },
    }));
  },

  updateRoom: (room: GameState['room']) => {
    set((state) => ({
      game: {
        ...state.game,
        room,
      },
    }));
  },

  updateStats: (stats: GameState['stats']) => {
    set((state) => ({
      game: {
        ...state.game,
        stats,
      },
    }));
  },
}));

export default useStore;
