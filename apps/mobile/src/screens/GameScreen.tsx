import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store/useStore';

export default function GameScreen() {
  const [command, setCommand] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const {
    player,
    game,
    isConnected,
    connectToGame,
    sendCommand,
    logout,
  } = useStore();

  useEffect(() => {
    if (!isConnected) {
      connectToGame().catch((error) => {
        Alert.alert('Connection Error', error.message);
      });
    }
  }, [isConnected, connectToGame]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [game.messages]);

  const handleSendCommand = () => {
    if (command.trim()) {
      sendCommand(command.trim());
      setCommand('');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ExMUD</Text>
        <View style={styles.headerRight}>
          <View style={[styles.statusDot, isConnected && styles.statusConnected]} />
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Room Info */}
      {game.room && (
        <View style={styles.roomInfo}>
          <Text style={styles.roomName}>{game.room.name}</Text>
          <Text style={styles.roomDescription}>{game.room.description}</Text>
          {game.room.exits.length > 0 && (
            <Text style={styles.exits}>
              Exits: {game.room.exits.join(', ')}
            </Text>
          )}
        </View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.messagesContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
        >
          {game.messages.length === 0 ? (
            <Text style={styles.welcomeText}>
              Welcome, {player?.email}!{'\n'}
              Type 'help' for a list of commands.
            </Text>
          ) : (
            game.messages.map((msg, index) => (
              <Text key={index} style={styles.message}>
                {msg}
              </Text>
            ))
          )}
        </ScrollView>

        {/* Command Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter command..."
            placeholderTextColor="#666"
            value={command}
            onChangeText={setCommand}
            onSubmitEditing={handleSendCommand}
            returnKeyType="send"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSendCommand}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        {['look', 'inventory', 'north', 'south', 'east', 'west'].map((cmd) => (
          <TouchableOpacity
            key={cmd}
            style={styles.quickButton}
            onPress={() => sendCommand(cmd)}
          >
            <Text style={styles.quickButtonText}>{cmd}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#16213e',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e94560',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f00',
  },
  statusConnected: {
    backgroundColor: '#0f0',
  },
  logoutText: {
    color: '#666',
    fontSize: 14,
  },
  roomInfo: {
    padding: 16,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  roomDescription: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 8,
  },
  exits: {
    color: '#e94560',
    fontSize: 12,
  },
  messagesContainer: {
    flex: 1,
  },
  messages: {
    flex: 1,
    padding: 16,
  },
  messagesContent: {
    flexGrow: 1,
  },
  welcomeText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  message: {
    color: '#ddd',
    fontSize: 14,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#16213e',
  },
  input: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#e94560',
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#16213e',
  },
  quickButton: {
    backgroundColor: '#0f3460',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  quickButtonText: {
    color: '#fff',
    fontSize: 12,
    textTransform: 'uppercase',
  },
});
