import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error';
  message: string;
}

const logs: LogEntry[] = [];
let logUpdateCallback: (() => void) | null = null;

// Override console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

const addLog = (level: 'log' | 'warn' | 'error', args: any[]) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');

  logs.push({
    timestamp: new Date().toLocaleTimeString(),
    level,
    message,
  });

  // Keep only last 100 logs
  if (logs.length > 100) {
    logs.shift();
  }

  if (logUpdateCallback) {
    logUpdateCallback();
  }
};

console.log = (...args) => {
  originalConsole.log(...args);
  addLog('log', args);
};

console.warn = (...args) => {
  originalConsole.warn(...args);
  addLog('warn', args);
};

console.error = (...args) => {
  originalConsole.error(...args);
  addLog('error', args);
};

export default function DebugLogger() {
  const [visible, setVisible] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    logUpdateCallback = () => forceUpdate(n => n + 1);
    return () => {
      logUpdateCallback = null;
    };
  }, []);

  if (!visible) {
    return (
      <TouchableOpacity
        style={styles.trigger}
        onLongPress={() => setVisible(true)}
      >
        <Text style={styles.triggerText}>🐛</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug Logs ({logs.length})</Text>
        <TouchableOpacity onPress={() => setVisible(false)}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.logContainer}>
        {logs.map((log, index) => (
          <View key={index} style={styles.logEntry}>
            <Text style={styles.timestamp}>{log.timestamp}</Text>
            <Text style={[
              styles.logText,
              log.level === 'error' && styles.errorText,
              log.level === 'warn' && styles.warnText,
            ]}>
              {log.message}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  triggerText: {
    fontSize: 24,
  },
  container: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    bottom: 100,
    backgroundColor: '#000',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e94560',
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  logContainer: {
    flex: 1,
  },
  logEntry: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  timestamp: {
    color: '#888',
    fontSize: 10,
    marginBottom: 2,
  },
  logText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  errorText: {
    color: '#ff6b6b',
  },
  warnText: {
    color: '#ffd93d',
  },
});
