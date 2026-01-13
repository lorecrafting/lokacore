/**
 * Force Update Overlay
 * Displays a blocking modal when the app version is too old to connect to the server.
 * Guides users to update the app.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { config } from '../config';

interface ForceUpdateOverlayProps {
  visible: boolean;
  minVersion: string | null;
  onRetry?: () => void;
}

// App store URLs - update these with your actual app store listings
const APP_STORE_URL = 'https://apps.apple.com/app/loka/id123456789'; // Replace with real URL
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.loka.app'; // Replace with real URL

export function ForceUpdateOverlay({
  visible,
  minVersion,
  onRetry,
}: ForceUpdateOverlayProps): React.ReactElement | null {
  if (!visible) return null;

  const handleUpdate = async () => {
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        console.warn('Cannot open store URL:', url);
      }
    } catch (error) {
      console.error('Error opening store URL:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.icon}>&#x2191;</Text>

          <Text style={styles.title}>Update Required</Text>

          <Text style={styles.message}>
            A new version of Loka is available. Please update to continue your adventure.
          </Text>

          <View style={styles.versionInfo}>
            <Text style={styles.versionLabel}>Your version</Text>
            <Text style={styles.versionValue}>{config.clientVersion}</Text>
          </View>

          <View style={styles.versionInfo}>
            <Text style={styles.versionLabel}>Required version</Text>
            <Text style={styles.versionValue}>{minVersion || 'Unknown'}</Text>
          </View>

          <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>

          {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.footnote}>
            New features and improvements await!
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: {
    maxWidth: 360,
    width: '100%',
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  versionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  versionLabel: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
  },
  versionValue: {
    fontFamily: fonts.serif,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  updateButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.text,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  updateButtonText: {
    fontFamily: fonts.serif,
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  retryButtonText: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  footnote: {
    marginTop: spacing.xl,
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.textFaint,
    textAlign: 'center',
  },
});
