/**
 * Remote Logger - Ships debug logs to Phoenix backend for LLM debugging
 *
 * Usage:
 *   import { remoteLogger } from '@/utils/remoteLogger';
 *
 *   // Initialize once at app start
 *   remoteLogger.init({ serverUrl: 'https://your-server.com' });
 *
 *   // Manual logging
 *   remoteLogger.info('User tapped button', { buttonId: 'submit' });
 *   remoteLogger.error('Failed to fetch', { error: err.message });
 *
 *   // Automatically captures console.* and crashes
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string | any[];
  context?: Record<string, any>;
  device_id?: string;
  session_id?: string;
  player_name?: string;
  app_version?: string;
  platform?: string;
}

interface LoggerConfig {
  serverUrl: string;
  enabled?: boolean;
  batchSize?: number;
  flushIntervalMs?: number;
  captureConsole?: boolean;
  captureCrashes?: boolean;
  minLevel?: 'debug' | 'info' | 'warn' | 'error';
}

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class RemoteLogger {
  private config: LoggerConfig = {
    serverUrl: '',
    enabled: true,
    batchSize: 10,
    flushIntervalMs: 5000,
    captureConsole: true,
    captureCrashes: true,
    minLevel: 'debug',
  };

  private logQueue: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private deviceId: string = '';
  private sessionId: string = '';
  private playerName: string = '';
  private appVersion: string = '';
  private platform: string = '';
  private initialized: boolean = false;
  private originalConsole: Record<string, Function> = {};
  private isLogging: boolean = false; // Prevent re-entrancy

  async init(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config };

    if (!this.config.serverUrl) {
      console.warn('[RemoteLogger] No serverUrl provided, logging disabled');
      this.config.enabled = false;
      return;
    }

    // Get device info
    this.deviceId = await this.getOrCreateDeviceId();
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.appVersion = Application.nativeApplicationVersion || 'unknown';
    this.platform = `${Platform.OS} ${Platform.Version}`;

    // Capture console methods
    if (this.config.captureConsole) {
      this.wrapConsoleMethods();
    }

    // Capture crashes
    if (this.config.captureCrashes) {
      this.setupCrashHandler();
    }

    // Start flush timer
    this.startFlushTimer();

    this.initialized = true;
    this.info('RemoteLogger initialized', {
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      appVersion: this.appVersion,
      platform: this.platform,
    });
  }

  private async getOrCreateDeviceId(): Promise<string> {
    try {
      const stored = await AsyncStorage.getItem('@device_id');
      if (stored) return stored;

      const newId = `device_${Device.modelName || 'unknown'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('@device_id', newId);
      return newId;
    } catch {
      return `device_${Date.now()}`;
    }
  }

  setPlayerName(name: string) {
    this.playerName = name;
  }

  private wrapConsoleMethods() {
    const methods: Array<'log' | 'info' | 'warn' | 'error' | 'debug'> = ['log', 'info', 'warn', 'error', 'debug'];

    methods.forEach((method) => {
      this.originalConsole[method] = console[method];
      console[method] = (...args: any[]) => {
        // Call original first
        this.originalConsole[method]?.apply(console, args);

        // Prevent infinite recursion if logging triggers more console calls
        if (this.isLogging) return;
        this.isLogging = true;

        try {
          // Map 'log' to 'info'
          const level = method === 'log' ? 'info' : method;
          this.addToQueue(level as any, args);
        } finally {
          this.isLogging = false;
        }
      };
    });
  }

  private setupCrashHandler() {
    const errorHandler = (error: Error, isFatal?: boolean) => {
      // Prevent re-entrancy (crash during crash handling)
      if (this.isLogging) return;
      this.isLogging = true;

      try {
        this.addToQueue('error', `${isFatal ? 'FATAL CRASH' : 'Unhandled Error'}: ${error.message}`, {
          stack: error.stack,
          name: error.name,
          isFatal,
        });
        // Flush immediately on crash
        this.flush();
      } finally {
        this.isLogging = false;
      }
    };

    // React Native error handler
    if (typeof ErrorUtils !== 'undefined') {
      const originalHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((error, isFatal) => {
        errorHandler(error, isFatal);
        originalHandler?.(error, isFatal);
      });
    }

    // Promise rejection handler
    if (typeof global !== 'undefined') {
      const originalRejectionHandler = (global as any).onunhandledrejection;
      (global as any).onunhandledrejection = (event: any) => {
        if (!this.isLogging) {
          this.isLogging = true;
          try {
            this.addToQueue('error', 'Unhandled Promise Rejection', {
              reason: event?.reason?.message || event?.reason || 'unknown',
              stack: event?.reason?.stack,
            });
          } finally {
            this.isLogging = false;
          }
        }
        originalRejectionHandler?.(event);
      };
    }
  }

  private startFlushTimer() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    if (!this.config.enabled) return false;
    const minLevel = this.config.minLevel || 'debug';
    return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
  }

  private addToQueue(level: 'debug' | 'info' | 'warn' | 'error', message: any, context?: Record<string, any>) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message: Array.isArray(message) ? message.map(this.serialize) : this.serialize(message),
      context,
      device_id: this.deviceId,
      session_id: this.sessionId,
      player_name: this.playerName,
      app_version: this.appVersion,
      platform: this.platform,
    };

    this.logQueue.push(entry);

    // Flush if queue is full
    if (this.logQueue.length >= (this.config.batchSize || 10)) {
      this.flush();
    }
  }

  private serialize(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (value instanceof Error) {
      return `${value.name}: ${value.message}\n${value.stack || ''}`;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  async flush() {
    if (this.logQueue.length === 0) return;
    if (!this.config.serverUrl) return;

    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    // Send each log entry (could batch, but individual is simpler for now)
    for (const log of logsToSend) {
      try {
        await fetch(`${this.config.serverUrl}/api/debug/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log),
        });
      } catch (err) {
        // Silent fail - don't want logging to crash the app
        // Put back in queue for retry
        this.logQueue.push(log);
      }
    }
  }

  // Public logging methods
  debug(message: string, context?: Record<string, any>) {
    this.addToQueue('debug', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.addToQueue('info', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.addToQueue('warn', message, context);
  }

  error(message: string, context?: Record<string, any>) {
    this.addToQueue('error', message, context);
  }

  // Force flush (call before app closes)
  async forceFlush() {
    await this.flush();
  }

  // Disable logging
  disable() {
    this.config.enabled = false;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // Re-enable logging
  enable() {
    this.config.enabled = true;
    this.startFlushTimer();
  }
}

export const remoteLogger = new RemoteLogger();

// Convenience export for quick setup
export function initRemoteLogger(serverUrl: string, options?: Partial<LoggerConfig>) {
  return remoteLogger.init({ serverUrl, ...options });
}
