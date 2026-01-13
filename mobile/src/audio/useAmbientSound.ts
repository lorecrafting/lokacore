/**
 * useAmbientSound - Hook that orchestrates ambient audio playback
 *
 * Listens to SoundContext's soundState (from server) and manages:
 * - Crossfading between ambient sounds on room/phase changes
 * - Weather overlay sounds
 * - Light source sounds (torch crackling)
 *
 * Syncs crossfade duration with visual transitions from EnvironmentContext.
 */

import { useEffect, useRef } from 'react';
import { useSound } from './SoundContext';
import { useEnvironment } from '../components/EnvironmentContext';
import { AudioManager } from './AudioManager';

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

interface UseAmbientSoundOptions {
  enabled?: boolean;
}

/**
 * Hook to manage ambient sound playback based on server state
 *
 * Usage:
 *   useAmbientSound({ enabled: connected && !bardoState?.active });
 */
export function useAmbientSound(options: UseAmbientSoundOptions = {}): void {
  const { enabled = true } = options;
  const { soundState, settings, isReady } = useSound();
  const { isTransitioning, transition } = useEnvironment();

  // Track previous state for comparison
  const prevAmbientRef = useRef<string[]>([]);
  const prevWeatherRef = useRef<string[]>([]);
  const prevLightRef = useRef<string[]>([]);

  // Handle ambient sounds
  useEffect(() => {
    console.log('[useAmbientSound] Effect running:', {
      isReady,
      enabled,
      settingsEnabled: settings.enabled,
      ambient: soundState.ambient,
    });

    if (!isReady || !enabled || !settings.enabled) {
      console.log('[useAmbientSound] Skipping - not ready or disabled');
      // Stop all sounds if disabled
      if (prevAmbientRef.current.length > 0) {
        AudioManager.stopAll();
        prevAmbientRef.current = [];
        prevWeatherRef.current = [];
        prevLightRef.current = [];
      }
      return;
    }

    const newAmbient = soundState.ambient;
    const prevAmbient = prevAmbientRef.current;

    // Only crossfade if sounds changed
    if (!arraysEqual(newAmbient, prevAmbient)) {
      console.log('[useAmbientSound] Crossfading to:', newAmbient);
      // Determine crossfade duration based on transition state
      let duration = 2000; // Quick crossfade for room changes

      if (isTransitioning) {
        // Sync with visual transition duration
        if (transition === 'sunrise' || transition === 'sunset') {
          duration = 60000; // 60s for sunrise/sunset
        } else {
          duration = 30000; // 30s for other phase changes
        }
      }

      AudioManager.crossfadeAmbient(newAmbient, duration);
      prevAmbientRef.current = newAmbient;
    }
  }, [
    isReady,
    enabled,
    settings.enabled,
    soundState.ambient,
    isTransitioning,
    transition,
  ]);

  // Handle weather overlay sounds
  useEffect(() => {
    if (!isReady || !enabled || !settings.enabled) return;

    const newWeather = soundState.weather;
    const prevWeather = prevWeatherRef.current;

    if (!arraysEqual(newWeather, prevWeather)) {
      AudioManager.setWeatherSounds(newWeather);
      prevWeatherRef.current = newWeather;
    }
  }, [isReady, enabled, settings.enabled, soundState.weather]);

  // Handle light source sounds
  useEffect(() => {
    if (!isReady || !enabled || !settings.enabled) return;

    const newLight = soundState.light;
    const prevLight = prevLightRef.current;

    if (!arraysEqual(newLight, prevLight)) {
      AudioManager.setLightSounds(newLight);
      prevLightRef.current = newLight;
    }
  }, [isReady, enabled, settings.enabled, soundState.light]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      AudioManager.stopAll();
    };
  }, []);
}
