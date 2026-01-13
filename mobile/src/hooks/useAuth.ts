/**
 * Authentication Hook for Loka
 *
 * Uses guest authentication tied to device ID.
 * Flow:
 * 1. On first launch, prompt for name
 * 2. Generate device ID (stored in SecureStore)
 * 3. Call /auth/guest with device_id and name
 * 4. Store token, player is logged in
 *
 * Features:
 * - Automatic token refresh before expiry
 * - Token validation on app resume
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { config } from '../config';
import { remoteLogger } from '../utils/remoteLogger';

const TOKEN_KEY = 'loka_auth_token';
const REFRESH_TOKEN_KEY = 'loka_refresh_token';
const PLAYER_KEY = 'loka_player';
const DEVICE_ID_KEY = 'loka_device_id';
const TOKEN_EXPIRY_KEY = 'loka_token_expiry';

const API_URL = config.apiUrl;

interface Player {
  id: string;
  name: string | null;
}

interface AuthState {
  token: string | null;
  player: Player | null;
  loading: boolean;
  needsName: boolean;
}

interface UseAuthReturn extends AuthState {
  createGuest: (name: string) => Promise<boolean>;
  updateName: (name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  error: string | null;
}

// Generate a unique device ID
async function getOrCreateDeviceId(): Promise<string> {
  // Try SecureStore first
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }
  } catch (e) {
    // SecureStore failed, try AsyncStorage fallback for Android emulators
    if (Platform.OS === 'android') {
      try {
        const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (existing) return existing;
      } catch {
        // Continue to generate new UUID
      }
    } else if (Platform.OS === 'web') {
      const existing = localStorage.getItem(DEVICE_ID_KEY);
      if (existing) return existing;
    }
  }

  // Generate new UUID
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  // Try to persist
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, uuid);
  } catch (e) {
    // SecureStore failed, use AsyncStorage fallback for Android
    if (Platform.OS === 'android') {
      try {
        await AsyncStorage.setItem(DEVICE_ID_KEY, uuid);
      } catch {
        // Silent fail - device ID will be regenerated next time
      }
    } else if (Platform.OS === 'web') {
      localStorage.setItem(DEVICE_ID_KEY, uuid);
    }
  }

  return uuid;
}

// Storage helpers that work on both native and web
// Uses SecureStore with AsyncStorage fallback for Android emulators
async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    // SecureStore failed, try AsyncStorage for Android
    if (Platform.OS === 'android') {
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    } else if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    // SecureStore failed, use AsyncStorage for Android
    if (Platform.OS === 'android') {
      try {
        await AsyncStorage.setItem(key, value);
      } catch {
        // Silent fail
      }
    } else if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    }
  }
}

async function deleteItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    if (Platform.OS === 'android') {
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        // Silent fail
      }
    } else if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    }
  }
}

export function useAuth(): UseAuthReturn {
  const [token, setToken] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsName, setNeedsName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Load stored auth on mount
  useEffect(() => {
    loadStoredAuth();

    // Set up app state listener for token refresh on resume
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Handle app state changes (background/foreground)
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App came to foreground - check if token needs refresh
      await checkAndRefreshToken();
    }
    appStateRef.current = nextAppState;
  };

  // Check if token is expired or about to expire
  const checkAndRefreshToken = async () => {
    const expiryStr = await getItem(TOKEN_EXPIRY_KEY);
    if (!expiryStr) return;

    const expiry = parseInt(expiryStr, 10);
    const now = Date.now();
    const threshold = config.tokenRefreshThreshold;

    if (now >= expiry - threshold) {
      await refreshTokenInternal();
    }
  };

  // Schedule token refresh
  const scheduleTokenRefresh = async (expiresIn: number) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Refresh 5 minutes before expiry
    const refreshIn = Math.max(0, expiresIn - config.tokenRefreshThreshold);

    refreshTimerRef.current = setTimeout(async () => {
      await refreshTokenInternal();
    }, refreshIn);
  };

  const loadStoredAuth = async () => {
    try {
      const storedToken = await getItem(TOKEN_KEY);
      const storedPlayer = await getItem(PLAYER_KEY);

      if (storedToken && storedPlayer) {
        // Verify token is still valid
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setToken(storedToken);
          setPlayer(data.player);
          setNeedsName(false);
        } else {
          // Token expired, need to re-auth as guest
          await tryAutoGuestLogin();
        }
      } else {
        // No stored auth, check if we have a device ID (returning guest without token)
        await tryAutoGuestLogin();
      }
    } catch (err) {
      console.error('Error loading stored auth:', err);
      setNeedsName(true);
    } finally {
      setLoading(false);
    }
  };

  const tryAutoGuestLogin = async () => {
    const deviceId = await getOrCreateDeviceId();

    try {
      const response = await fetch(`${API_URL}/auth/guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_id: deviceId }),
      });

      if (response.ok) {
        const data = await response.json();

        // If player has no name, they need to set one
        if (!data.player.name) {
          setNeedsName(true);
          // Store token temporarily so we can update name
          await setItem(TOKEN_KEY, data.token);
          setToken(data.token);
          setPlayer(data.player);
        } else {
          // Returning guest with name
          await setItem(TOKEN_KEY, data.token);
          await setItem(PLAYER_KEY, JSON.stringify(data.player));
          setToken(data.token);
          setPlayer(data.player);
          setNeedsName(false);
        }
      } else {
        setNeedsName(true);
      }
    } catch (err) {
      console.error('Error auto guest login:', err);
      setNeedsName(true);
    }
  };

  /**
   * Creates a new guest account with the given name.
   */
  const createGuest = useCallback(async (name: string): Promise<boolean> => {
    console.log('[useAuth] createGuest called with:', name);
    setError(null);
    setLoading(true);

    try {
      const deviceId = await getOrCreateDeviceId();
      console.log('[useAuth] createGuest: device_id =', deviceId);

      const response = await fetch(`${API_URL}/auth/guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_id: deviceId, name }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        await setItem(TOKEN_KEY, data.token);
        await setItem(PLAYER_KEY, JSON.stringify(data.player));

        // Store refresh token if provided
        if (data.refresh_token) {
          await setItem(REFRESH_TOKEN_KEY, data.refresh_token);
        }

        // Store token expiry (assume 1 hour if not provided)
        const expiresIn = data.expires_in || 3600 * 1000;
        const expiry = Date.now() + expiresIn;
        await setItem(TOKEN_EXPIRY_KEY, expiry.toString());

        setToken(data.token);
        setPlayer(data.player);
        setNeedsName(false);

        // Set player name for remote logging
        if (data.player?.name) {
          remoteLogger.setPlayerName(data.player.name);
        }

        // Schedule token refresh
        scheduleTokenRefresh(expiresIn);

        return true;
      } else {
        setError(data.error || 'Failed to create account');
        return false;
      }
    } catch (err) {
      console.error('Error creating guest:', err);
      setError('Failed to create account');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Updates the player's display name.
   */
  const updateName = useCallback(async (name: string): Promise<boolean> => {
    console.log('[useAuth] updateName called with:', name, 'token:', token ? 'present' : 'null');
    if (!token) {
      console.log('[useAuth] updateName: No token, returning false');
      setError('Not logged in');
      return false;
    }

    setError(null);
    setLoading(true);

    try {
      console.log('[useAuth] updateName: Making PUT request to', `${API_URL}/auth/name`);
      const response = await fetch(`${API_URL}/auth/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (response.ok) {
        const updatedPlayer = { ...player, ...data.player };
        await setItem(PLAYER_KEY, JSON.stringify(updatedPlayer));
        setPlayer(updatedPlayer);
        setNeedsName(false);
        return true;
      } else {
        setError(data.error || 'Failed to update name');
        return false;
      }
    } catch (err) {
      console.error('Error updating name:', err);
      setError('Failed to update name');
      return false;
    } finally {
      setLoading(false);
    }
  }, [token, player]);

  const logout = useCallback(async () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    await deleteItem(TOKEN_KEY);
    await deleteItem(REFRESH_TOKEN_KEY);
    await deleteItem(TOKEN_EXPIRY_KEY);
    await deleteItem(PLAYER_KEY);
    setToken(null);
    setPlayer(null);
    setNeedsName(true);
  }, []);

  /**
   * Refresh the access token using the refresh token
   */
  const refreshTokenInternal = async (): Promise<boolean> => {
    const refreshTokenValue = await getItem(REFRESH_TOKEN_KEY);
    if (!refreshTokenValue) {
      console.log('No refresh token available');
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        await setItem(TOKEN_KEY, data.token);
        setToken(data.token);

        // Store new refresh token if provided
        if (data.refresh_token) {
          await setItem(REFRESH_TOKEN_KEY, data.refresh_token);
        }

        // Store expiry time (assume 1 hour if not provided)
        const expiresIn = data.expires_in || 3600 * 1000;
        const expiry = Date.now() + expiresIn;
        await setItem(TOKEN_EXPIRY_KEY, expiry.toString());

        // Schedule next refresh
        scheduleTokenRefresh(expiresIn);

        console.log('Token refreshed successfully');
        return true;
      } else {
        console.error('Token refresh failed:', data.error);
        // Refresh failed - clear auth and require re-login
        await logout();
        return false;
      }
    } catch (err) {
      console.error('Error refreshing token:', err);
      return false;
    }
  };

  /**
   * Public method to manually trigger token refresh
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    return refreshTokenInternal();
  }, []);

  return {
    token,
    player,
    loading,
    needsName,
    error,
    createGuest,
    updateName,
    logout,
    refreshToken,
  };
}
