import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { ParchmentText } from '../components/ui/ParchmentText';
import { useAuth } from '../hooks/useAuth';
import { colors, fonts, fontSizes, spacing } from '../theme/colors';

export function LoginScreen() {
  const { login, guestLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guest name — pre-filled and visible by default
  const [guestName, setGuestName] = useState('Wanderer');

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Parent (App.tsx) will navigate to game when token is set in store
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGuestLogin() {
    const name = guestName.trim();
    if (!name) {
      setError('Please enter a name to enter as guest.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await guestLogin(name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Guest login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleBlock}>
          <ParchmentText variant="title" style={styles.mainTitle}>
            Loka
          </ParchmentText>
          <ParchmentText variant="italic" color={colors.secondary} style={styles.subtitle}>
            A Living World
          </ParchmentText>
        </View>

        <View style={styles.spacer} />

        {/* Error message */}
        {error ? (
          <ParchmentText variant="small" color={colors.action} style={styles.errorText}>
            {error}
          </ParchmentText>
        ) : null}

        {/* Email input */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.separator}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        {/* Password input */}
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.separator}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        {/* Enter button */}
        <TouchableOpacity
          onPress={handleLogin}
          activeOpacity={0.6}
          style={[styles.button, loading && styles.buttonDisabled]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.barActive} />
          ) : (
            <ParchmentText variant="small" color={colors.barActive} style={styles.buttonText}>
              [Enter]
            </ParchmentText>
          )}
        </TouchableOpacity>

        {/* Separator */}
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <ParchmentText variant="small" color={colors.separator} style={styles.orText}>
            or
          </ParchmentText>
          <View style={styles.orLine} />
        </View>

        {/* Guest section — name pre-filled, one tap to enter */}
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={colors.separator}
          value={guestName}
          onChangeText={setGuestName}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!loading}
        />
        <TouchableOpacity
          onPress={handleGuestLogin}
          activeOpacity={0.6}
          style={[styles.button, loading && styles.buttonDisabled]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.barActive} />
          ) : (
            <ParchmentText variant="small" color={colors.barActive} style={styles.buttonText}>
              [Enter as Guest]
            </ParchmentText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.pagePaddingH,
    paddingTop: 64,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 48,
    textAlign: 'center',
    letterSpacing: 2,
    lineHeight: 56,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 28,
    marginTop: 4,
  },
  spacer: {
    height: 40,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.parchmentDark,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
    fontFamily: fonts.regular,
    fontSize: fontSizes.body,
    color: colors.body,
  },
  button: {
    borderWidth: 1,
    borderColor: colors.barActive,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    letterSpacing: 0.5,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    marginBottom: 14,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.separator,
  },
  orText: {
    marginHorizontal: 12,
    lineHeight: 20,
  },
});
