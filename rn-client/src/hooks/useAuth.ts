import { useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import authClient from "../services/authClient";
import { useGameStore } from "../store/gameStore";

const SECURE_STORE_TOKEN_KEY = "loka_token";
const SECURE_STORE_REFRESH_TOKEN_KEY = "loka_refresh_token";
const SECURE_STORE_PLAYER_NAME_KEY = "loka_player_name";

function generateDeviceId(): string {
  return "device-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useAuth() {
  const setAuth = useGameStore((s) => s.setAuth);
  const clearAuth = useGameStore((s) => s.clearAuth);

  useEffect(() => {
    async function restoreSession() {
      try {
        const storedRefreshToken = await SecureStore.getItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY);
        if (!storedRefreshToken) return;

        const { token, refresh_token } = await authClient.refreshToken(storedRefreshToken);

        const me = await authClient.getMe(token);

        await SecureStore.setItemAsync(SECURE_STORE_TOKEN_KEY, token);
        await SecureStore.setItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY, refresh_token);

        setAuth(token, me.email);
      } catch {
        // Refresh failed — session expired or revoked; leave user logged out
        await SecureStore.deleteItemAsync(SECURE_STORE_TOKEN_KEY);
        await SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(SECURE_STORE_PLAYER_NAME_KEY);
      }
    }

    restoreSession();
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const { token, refresh_token, player } = await authClient.login(email, password);

    await SecureStore.setItemAsync(SECURE_STORE_TOKEN_KEY, token);
    await SecureStore.setItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY, refresh_token);
    await SecureStore.setItemAsync(SECURE_STORE_PLAYER_NAME_KEY, player.email);

    setAuth(token, player.email);
  }

  async function guestLogin(name: string): Promise<void> {
    let deviceId = await SecureStore.getItemAsync("loka_device_id");
    if (!deviceId) {
      deviceId = generateDeviceId();
      await SecureStore.setItemAsync("loka_device_id", deviceId);
    }

    try {
      const { token, refresh_token } = await authClient.guestLogin(deviceId, name);

      await SecureStore.setItemAsync(SECURE_STORE_TOKEN_KEY, token);
      await SecureStore.setItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY, refresh_token);
      await SecureStore.setItemAsync(SECURE_STORE_PLAYER_NAME_KEY, name);

      setAuth(token, name);
    } catch {
      // Server unreachable — use a dev token so the app can run with mock data
      const devToken = "dev-" + deviceId;
      await SecureStore.setItemAsync(SECURE_STORE_TOKEN_KEY, devToken);
      await SecureStore.setItemAsync(SECURE_STORE_PLAYER_NAME_KEY, name);

      setAuth(devToken, name);
    }
  }

  async function logout(): Promise<void> {
    await SecureStore.deleteItemAsync(SECURE_STORE_TOKEN_KEY);
    await SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(SECURE_STORE_PLAYER_NAME_KEY);

    clearAuth();
  }

  return { login, guestLogin, logout };
}
