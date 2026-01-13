/**
 * SoundContext - Global audio state provider
 *
 * Follows the same pattern as EnvironmentContext.
 * Provides:
 * - Sound state from server (ambient, weather, light sounds)
 * - Volume settings with persistence
 * - Sound enable/disable toggle
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioManager } from './AudioManager';

// Types matching server's serialize_sound_state
export interface SoundState {
  ambient: string[];
  weather: string[];
  light: string[];
  is_indoor: boolean;
  phase: 'dawn' | 'day' | 'dusk' | 'night';
}

export interface SoundSettings {
  enabled: boolean;
  masterVolume: number;
  ambientVolume: number;
  weatherVolume: number;
  uiVolume: number;
  eventVolume: number;
}

interface SoundContextValue {
  // State from server
  soundState: SoundState;
  setSoundState: (state: SoundState) => void;

  // User settings
  settings: SoundSettings;
  isReady: boolean;

  // Volume controls
  setMasterVolume: (volume: number) => void;
  setAmbientVolume: (volume: number) => void;
  setWeatherVolume: (volume: number) => void;
  setUIVolume: (volume: number) => void;
  setEventVolume: (volume: number) => void;
  toggleSound: () => void;

  // Playback controls
  playUISound: (key: string) => void;
  playEventSound: (key: string) => void;
}

const STORAGE_KEY = 'loka_sound_settings';

const defaultSoundState: SoundState = {
  ambient: [],
  weather: [],
  light: [],
  is_indoor: false,
  phase: 'day',
};

const defaultSettings: SoundSettings = {
  enabled: true,
  masterVolume: 0.8,
  ambientVolume: 0.6,
  weatherVolume: 0.7,
  uiVolume: 0.8,
  eventVolume: 0.8,
};

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundState, setSoundState] = useState<SoundState>(defaultSoundState);
  const [settings, setSettings] = useState<SoundSettings>(defaultSettings);
  const [isReady, setIsReady] = useState(false);

  // Initialize audio system and load settings
  useEffect(() => {
    async function init() {
      try {
        // Load saved settings
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings((prev) => ({ ...prev, ...parsed }));
        }

        // Initialize AudioManager
        await AudioManager.init();

        setIsReady(true);
        console.log('[SoundContext] Initialized');
      } catch (error) {
        console.error('[SoundContext] Init failed:', error);
        setIsReady(true); // Continue even if init fails
      }
    }

    init();
  }, []);

  // Sync volumes to AudioManager when settings change
  useEffect(() => {
    if (!isReady) return;

    AudioManager.setVolume('master', settings.masterVolume);
    AudioManager.setVolume('ambient', settings.ambientVolume);
    AudioManager.setVolume('weather', settings.weatherVolume);
    AudioManager.setVolume('ui', settings.uiVolume);
    AudioManager.setVolume('event', settings.eventVolume);
  }, [isReady, settings]);

  // Save settings when they change
  const saveSettings = useCallback(async (newSettings: SoundSettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('[SoundContext] Failed to save settings:', error);
    }
  }, []);

  const updateSettings = useCallback(
    (updates: Partial<SoundSettings>) => {
      setSettings((prev) => {
        const newSettings = { ...prev, ...updates };
        saveSettings(newSettings);
        return newSettings;
      });
    },
    [saveSettings]
  );

  const setMasterVolume = useCallback(
    (volume: number) => updateSettings({ masterVolume: volume }),
    [updateSettings]
  );

  const setAmbientVolume = useCallback(
    (volume: number) => updateSettings({ ambientVolume: volume }),
    [updateSettings]
  );

  const setWeatherVolume = useCallback(
    (volume: number) => updateSettings({ weatherVolume: volume }),
    [updateSettings]
  );

  const setUIVolume = useCallback(
    (volume: number) => updateSettings({ uiVolume: volume }),
    [updateSettings]
  );

  const setEventVolume = useCallback(
    (volume: number) => updateSettings({ eventVolume: volume }),
    [updateSettings]
  );

  const toggleSound = useCallback(() => {
    updateSettings({ enabled: !settings.enabled });
    if (settings.enabled) {
      // Currently enabled, will be disabled - stop all sounds
      AudioManager.stopAll();
    }
  }, [settings.enabled, updateSettings]);

  const playUISound = useCallback(
    (key: string) => {
      if (settings.enabled) {
        AudioManager.playOneShot(key, 'ui');
      }
    },
    [settings.enabled]
  );

  const playEventSound = useCallback(
    (key: string) => {
      if (settings.enabled) {
        AudioManager.playOneShot(key, 'event');
      }
    },
    [settings.enabled]
  );

  const value: SoundContextValue = {
    soundState,
    setSoundState,
    settings,
    isReady,
    setMasterVolume,
    setAmbientVolume,
    setWeatherVolume,
    setUIVolume,
    setEventVolume,
    toggleSound,
    playUISound,
    playEventSound,
  };

  return (
    <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
  );
}

export function useSound(): SoundContextValue {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}
