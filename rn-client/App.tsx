import React from 'react';
import { View, SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useGameStore } from './src/store/gameStore';
import { LoginScreen } from './src/screens/LoginScreen';
import { GameScreen } from './src/screens/GameScreen';
import { SkyBackground } from './src/components/SkyBackground';
import { colors } from './src/theme/colors';

// Keep the native splash screen visible while fonts load.
// expo-splash-screen is bundled with expo SDK 54.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Silently ignore if splash screen API is unavailable in the build env.
});

export default function App() {
  const token = useGameStore((s) => s.token);

  const [fontsLoaded] = useFonts({
    'Cardo-Regular': require('./assets/fonts/Cardo-Regular.ttf'),
    'Cardo-Bold': require('./assets/fonts/Cardo-Bold.ttf'),
    'Cardo-Italic': require('./assets/fonts/Cardo-Italic.ttf'),
  });

  // Hide the splash screen once fonts have loaded.
  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {
        // Ignore if not available.
      });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    // Native splash is still visible; render nothing until fonts are ready.
    return null;
  }

  const isAuthenticated = token !== null;

  return (
    <View style={styles.root}>
      {/* Sky canvas lives behind everything; visible in safe-area inset strips */}
      {isAuthenticated && <SkyBackground />}
      <StatusBar hidden />
      <SafeAreaView
        style={[
          styles.safeArea,
          isAuthenticated && styles.safeAreaGame,
        ]}
      >
        {isAuthenticated ? <GameScreen /> : <LoginScreen />}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Transparent so the SkyBackground canvas shows in the inset areas.
    // The parchment colour is applied by the SafeAreaView / book content below.
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  // When in-game, let the book fill edge-to-edge; sky peeks through the insets.
  safeAreaGame: {
    marginTop: 0,
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
});
