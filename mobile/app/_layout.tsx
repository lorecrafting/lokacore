/**
 * Root Layout for Loka Mobile
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { colors } from '../src/theme';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { initRemoteLogger } from '../src/utils/remoteLogger';
import { API_BASE_URL } from '../src/config';
import { SoundProvider, registerSoundAssets, AudioManager } from '../src/audio';

export default function RootLayout() {
  useEffect(() => {
    // Initialize remote logger for LLM debugging
    initRemoteLogger(API_BASE_URL, {
      enabled: __DEV__ || true, // Enable in both dev and prod
      captureConsole: true,
      captureCrashes: true,
      minLevel: 'debug',
    });

    // Initialize audio system and register sound assets
    const initAudio = async () => {
      await AudioManager.init();
      registerSoundAssets();
      console.log('[Audio] Audio system initialized, assets registered');
    };
    initAudio();
  }, []);

  return (
    <ErrorBoundary>
      <SoundProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </SoundProvider>
    </ErrorBoundary>
  );
}
