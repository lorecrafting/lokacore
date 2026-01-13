/**
 * Welcome/Name Screen
 * Prompts guest players for their name before entering the game.
 * Matches the "Living Ebook" aesthetic.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import { colors, fonts, spacing } from '../src/theme';

export default function WelcomeScreen() {
  const { token, player, loading, needsName, error, createGuest, updateName } = useAuth();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Navigate to game when authenticated with a name
  useEffect(() => {
    if (token && player?.name && !needsName && !loading) {
      router.replace('/game');
    }
  }, [token, player, needsName, loading]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    console.log('[WelcomeScreen] handleSubmit called, name:', trimmedName);
    console.log('[WelcomeScreen] token:', token ? 'present' : 'null', 'player?.name:', player?.name);
    if (!trimmedName || submitting) return;

    setSubmitting(true);

    // If we already have a token but need a name, update it
    // Otherwise create a new guest with the name
    let success: boolean;
    if (token && !player?.name) {
      console.log('[WelcomeScreen] Calling updateName');
      success = await updateName(trimmedName);
    } else {
      console.log('[WelcomeScreen] Calling createGuest');
      success = await createGuest(trimmedName);
    }

    console.log('[WelcomeScreen] Result:', success);
    if (success) {
      router.replace('/game');
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Loka</Text>
          <ActivityIndicator size="large" color={colors.text} style={styles.loader} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Loka</Text>
        <Text style={styles.subtitle}>A Living Story</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.prose}>
          <Text style={styles.description}>
            A world of adventure awaits.
          </Text>
          <Text style={styles.description}>
            What shall we call you?
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            testID="name-input"
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={50}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
            editable={!submitting}
          />

          <Pressable
            testID="enter-button"
            accessibilityLabel="Enter the World"
            accessibilityRole="button"
            style={styles.enterButton}
            onPress={handleSubmit}
            disabled={!name.trim() || submitting}
          >
            {({ pressed }) => (
              <Text
                style={[
                  styles.enter,
                  pressed && styles.enterPressed,
                  (!name.trim() || submitting) && styles.enterDisabled,
                ]}
              >
                {submitting ? 'Entering...' : 'Enter the World'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 48,
    fontWeight: '400',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    fontStyle: 'italic',
    color: colors.textMuted,
    marginBottom: spacing.xxl,
  },
  loader: {
    marginTop: spacing.xl,
  },
  error: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  prose: {
    maxWidth: 280,
    marginBottom: spacing.xl,
  },
  description: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  form: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  input: {
    width: '100%',
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  enterButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  enter: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  enterPressed: {
    opacity: 0.6,
  },
  enterDisabled: {
    color: colors.textMuted,
    textDecorationLine: 'none',
  },
});
