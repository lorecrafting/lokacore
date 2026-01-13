/**
 * App Configuration
 * Centralized configuration for the Loka mobile app
 *
 * VERSION POLICY:
 * - Bump PATCH (1.0.x) for bug fixes
 * - Bump MINOR (1.x.0) for new features (backwards compatible)
 * - Bump MAJOR (x.0.0) for breaking changes
 *
 * When bumping MAJOR, coordinate with server's min_client_version
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

// Client version - MUST match server compatibility requirements
// This is sent to the server on channel join for version negotiation
export const CLIENT_VERSION = '1.0.0';

/**
 * Get the development server host IP from Expo.
 * When running in Expo Go on a physical device, this extracts the LAN IP
 * that Expo is using to serve the bundle.
 */
const getExpoHostIp = (): string | null => {
  try {
    // Try to get debugger host from Expo constants
    // This contains the IP:port of the Metro bundler (e.g., "192.168.1.100:8081")
    const debuggerHost =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest?.debuggerHost ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

    if (debuggerHost) {
      // Extract just the IP/hostname (remove port)
      const host = debuggerHost.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }
  } catch (e) {
    // Ignore errors - fall back to default
  }
  return null;
};

// Server configuration
// Auto-detects the correct URL based on platform and device type
const getServerUrl = (): string => {
  // Check for environment variable first (Expo public env vars)
  const envUrl = process.env.EXPO_PUBLIC_SERVER_URL;
  if (envUrl) {
    return envUrl;
  }

  // Fallback based on environment
  if (__DEV__) {
    // Web always uses localhost
    if (Platform.OS === 'web') {
      return 'http://localhost:4000';
    }

    // Android Emulator uses special IP
    if (Platform.OS === 'android' && !Device.isDevice) {
      return 'http://10.0.2.2:4000';
    }

    // Physical device (Expo Go) - extract LAN IP from Expo's host
    if (Device.isDevice) {
      const lanIp = getExpoHostIp();
      if (lanIp) {
        console.log(`[Config] Physical device detected, using LAN IP: ${lanIp}`);
        return `http://${lanIp}:4000`;
      }
      // Fallback warning - user needs to set env var
      console.warn(
        '[Config] Physical device detected but could not auto-detect LAN IP. ' +
        'Set EXPO_PUBLIC_SERVER_URL=http://YOUR_IP:4000'
      );
    }

    // iOS Simulator / default - localhost works
    return 'http://localhost:4000';
  }

  // Production URL
  return 'https://loka.fly.dev';
};

const getSocketUrl = (): string => {
  const serverUrl = getServerUrl();
  const protocol = serverUrl.startsWith('https') ? 'wss' : 'ws';
  const host = serverUrl.replace(/^https?:\/\//, '');
  return `${protocol}://${host}/socket`;
};

// Export server URL directly for convenience
export const API_BASE_URL = getServerUrl();

export const config = {
  // Client version (for server compatibility checking)
  clientVersion: CLIENT_VERSION,

  // Server URLs
  serverUrl: getServerUrl(),
  socketUrl: getSocketUrl(),
  apiUrl: `${getServerUrl()}/api/v1`,

  // Token configuration
  tokenRefreshThreshold: 5 * 60 * 1000, // Refresh 5 minutes before expiry
  tokenCheckInterval: 60 * 1000, // Check token every minute

  // WebSocket configuration
  reconnectInitialDelay: 1000, // 1 second
  reconnectMaxDelay: 30000, // 30 seconds
  reconnectMaxAttempts: 10,

  // Game configuration
  maxEvents: 50, // Maximum events to keep in history
  eventCleanupInterval: 30000, // Clean up old events every 30s
} as const;

export type Config = typeof config;
