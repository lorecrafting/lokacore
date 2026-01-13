/**
 * AudioManager - Core audio engine wrapping expo-av
 *
 * Handles:
 * - Sound loading and caching
 * - Multi-layer audio (ambient, weather, light, UI, events)
 * - Crossfading between ambient sounds
 * - Volume control per layer
 * - Background/foreground handling
 */

import { Audio, AVPlaybackSource, AVPlaybackStatus } from 'expo-av';
import { AppState, AppStateStatus } from 'react-native';

export type AudioLayer = 'ambient' | 'weather' | 'light' | 'ui' | 'event';

interface LoadedSound {
  sound: Audio.Sound;
  key: string;
  layer: AudioLayer;
  isPlaying: boolean;
  volume: number;
}

interface VolumeSettings {
  master: number;
  ambient: number;
  weather: number;
  ui: number;
  event: number;
}

class AudioManagerClass {
  private sounds: Map<string, LoadedSound> = new Map();
  private ambientSounds: Map<string, Audio.Sound> = new Map();
  private weatherSounds: Map<string, Audio.Sound> = new Map();
  private lightSounds: Map<string, Audio.Sound> = new Map();

  private isInitialized = false;
  private isBackgrounded = false;
  private volumes: VolumeSettings = {
    master: 1.0,
    ambient: 0.6,
    weather: 0.7,
    ui: 0.8,
    event: 0.8,
  };

  private currentAmbientKeys: string[] = [];
  private currentWeatherKeys: string[] = [];
  private currentLightKeys: string[] = [];

  // Sound asset mapping - will be populated by soundAssets.ts
  private soundAssets: Record<string, AVPlaybackSource> = {};

  /**
   * Initialize the audio system
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false, // Stop audio when backgrounded
        playsInSilentModeIOS: true, // Play even in silent mode
        shouldDuckAndroid: true, // Lower volume for notifications
        playThroughEarpieceAndroid: false,
      });

      // Listen for app state changes
      AppState.addEventListener('change', this.handleAppStateChange);

      this.isInitialized = true;
      console.log('[AudioManager] Initialized');
    } catch (error) {
      console.error('[AudioManager] Init failed:', error);
    }
  }

  /**
   * Register sound assets (called from soundAssets.ts)
   */
  registerAssets(assets: Record<string, AVPlaybackSource>): void {
    this.soundAssets = { ...this.soundAssets, ...assets };
    console.log(
      '[AudioManager] Registered',
      Object.keys(assets).length,
      'sound assets'
    );
  }

  /**
   * Set volume for a layer
   */
  setVolume(layer: keyof VolumeSettings, volume: number): void {
    this.volumes[layer] = Math.max(0, Math.min(1, volume));

    // Update currently playing sounds
    if (layer === 'master' || layer === 'ambient') {
      this.updateAmbientVolumes();
    }
    if (layer === 'master' || layer === 'weather') {
      this.updateWeatherVolumes();
    }
  }

  /**
   * Get current volume settings
   */
  getVolumes(): VolumeSettings {
    return { ...this.volumes };
  }

  /**
   * Crossfade to new ambient sounds
   */
  async crossfadeAmbient(
    newKeys: string[],
    durationMs: number = 2000
  ): Promise<void> {
    console.log('[AudioManager] crossfadeAmbient called:', {
      newKeys,
      isInitialized: this.isInitialized,
      isBackgrounded: this.isBackgrounded,
      registeredAssets: Object.keys(this.soundAssets),
    });

    if (!this.isInitialized || this.isBackgrounded) {
      console.log('[AudioManager] Skipping - not initialized or backgrounded');
      return;
    }

    const currentKeys = this.currentAmbientKeys;
    const keysToStop = currentKeys.filter((k) => !newKeys.includes(k));
    const keysToStart = newKeys.filter((k) => !currentKeys.includes(k));
    const keysToKeep = currentKeys.filter((k) => newKeys.includes(k));

    // Fade out sounds that are no longer needed
    const fadeOutPromises = keysToStop.map((key) =>
      this.fadeOutSound(key, 'ambient', durationMs)
    );

    // Fade in new sounds
    const fadeInPromises = keysToStart.map((key) =>
      this.fadeInSound(key, 'ambient', durationMs)
    );

    // Update volumes for sounds that continue
    keysToKeep.forEach((key) => {
      const sound = this.ambientSounds.get(key);
      if (sound) {
        const targetVolume = this.volumes.master * this.volumes.ambient;
        sound.setVolumeAsync(targetVolume);
      }
    });

    await Promise.all([...fadeOutPromises, ...fadeInPromises]);

    this.currentAmbientKeys = newKeys;
  }

  /**
   * Set weather overlay sounds
   */
  async setWeatherSounds(keys: string[]): Promise<void> {
    if (!this.isInitialized || this.isBackgrounded) return;

    const currentKeys = this.currentWeatherKeys;
    const keysToStop = currentKeys.filter((k) => !keys.includes(k));
    const keysToStart = keys.filter((k) => !currentKeys.includes(k));

    // Fade out old weather sounds
    const fadeOutPromises = keysToStop.map((key) =>
      this.fadeOutSound(key, 'weather', 2000)
    );

    // Fade in new weather sounds
    const fadeInPromises = keysToStart.map((key) =>
      this.fadeInSound(key, 'weather', 2000)
    );

    await Promise.all([...fadeOutPromises, ...fadeInPromises]);

    this.currentWeatherKeys = keys;
  }

  /**
   * Set light source sounds
   */
  async setLightSounds(keys: string[]): Promise<void> {
    if (!this.isInitialized || this.isBackgrounded) return;

    const currentKeys = this.currentLightKeys;
    const keysToStop = currentKeys.filter((k) => !keys.includes(k));
    const keysToStart = keys.filter((k) => !currentKeys.includes(k));

    // Fade out old light sounds
    const fadeOutPromises = keysToStop.map((key) =>
      this.fadeOutSound(key, 'light', 1000)
    );

    // Fade in new light sounds
    const fadeInPromises = keysToStart.map((key) =>
      this.fadeInSound(key, 'light', 1000)
    );

    await Promise.all([...fadeOutPromises, ...fadeInPromises]);

    this.currentLightKeys = keys;
  }

  /**
   * Play a one-shot sound (UI, events)
   */
  async playOneShot(key: string, layer: 'ui' | 'event' = 'ui'): Promise<void> {
    if (!this.isInitialized || this.isBackgrounded) return;

    const asset = this.soundAssets[key];
    if (!asset) {
      console.warn(`[AudioManager] Sound not found: ${key}`);
      return;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(asset, {
        volume: this.volumes.master * this.volumes[layer],
        shouldPlay: true,
      });

      // Clean up after playback
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error(`[AudioManager] Failed to play ${key}:`, error);
    }
  }

  /**
   * Stop all sounds
   */
  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    // Stop ambient sounds
    this.ambientSounds.forEach((sound) => {
      stopPromises.push(
        sound.stopAsync().then(() => sound.unloadAsync()).then(() => {})
      );
    });
    this.ambientSounds.clear();
    this.currentAmbientKeys = [];

    // Stop weather sounds
    this.weatherSounds.forEach((sound) => {
      stopPromises.push(
        sound.stopAsync().then(() => sound.unloadAsync()).then(() => {})
      );
    });
    this.weatherSounds.clear();
    this.currentWeatherKeys = [];

    // Stop light sounds
    this.lightSounds.forEach((sound) => {
      stopPromises.push(
        sound.stopAsync().then(() => sound.unloadAsync()).then(() => {})
      );
    });
    this.lightSounds.clear();
    this.currentLightKeys = [];

    await Promise.all(stopPromises);
  }

  /**
   * Pause all looping sounds (for backgrounding)
   */
  async pauseAllLoops(): Promise<void> {
    const pausePromises: Promise<void>[] = [];

    this.ambientSounds.forEach((sound) => {
      pausePromises.push(sound.pauseAsync().then(() => {}).catch(() => {}));
    });

    this.weatherSounds.forEach((sound) => {
      pausePromises.push(sound.pauseAsync().then(() => {}).catch(() => {}));
    });

    this.lightSounds.forEach((sound) => {
      pausePromises.push(sound.pauseAsync().then(() => {}).catch(() => {}));
    });

    await Promise.all(pausePromises);
  }

  /**
   * Resume all looping sounds (for foregrounding)
   */
  async resumeAllLoops(): Promise<void> {
    const resumePromises: Promise<void>[] = [];

    this.ambientSounds.forEach((sound) => {
      resumePromises.push(sound.playAsync().then(() => {}).catch(() => {}));
    });

    this.weatherSounds.forEach((sound) => {
      resumePromises.push(sound.playAsync().then(() => {}).catch(() => {}));
    });

    this.lightSounds.forEach((sound) => {
      resumePromises.push(sound.playAsync().then(() => {}).catch(() => {}));
    });

    await Promise.all(resumePromises);
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  private handleAppStateChange = (state: AppStateStatus): void => {
    if (state === 'background' || state === 'inactive') {
      this.isBackgrounded = true;
      this.pauseAllLoops();
    } else if (state === 'active') {
      this.isBackgrounded = false;
      this.resumeAllLoops();
    }
  };

  private async fadeInSound(
    key: string,
    layer: 'ambient' | 'weather' | 'light',
    durationMs: number
  ): Promise<void> {
    console.log(`[AudioManager] fadeInSound: ${key} (${layer})`);
    const asset = this.soundAssets[key];
    if (!asset) {
      console.warn(`[AudioManager] Sound asset not found: ${key}`);
      console.warn('[AudioManager] Available assets:', Object.keys(this.soundAssets));
      return;
    }

    const soundMap = this.getSoundMap(layer);
    if (soundMap.has(key)) {
      console.log(`[AudioManager] ${key} already playing`);
      // Already playing, just ensure volume
      return;
    }

    try {
      console.log(`[AudioManager] Creating sound for ${key}`);
      const { sound } = await Audio.Sound.createAsync(asset, {
        isLooping: true,
        volume: 0, // Start silent
        shouldPlay: true,
      });

      console.log(`[AudioManager] Sound created for ${key}, starting fade in`);
      soundMap.set(key, sound);

      // Fade in
      const targetVolume = this.getLayerVolume(layer);
      await this.animateVolume(sound, 0, targetVolume, durationMs);
    } catch (error) {
      console.error(`[AudioManager] Failed to fade in ${key}:`, error);
    }
  }

  private async fadeOutSound(
    key: string,
    layer: 'ambient' | 'weather' | 'light',
    durationMs: number
  ): Promise<void> {
    const soundMap = this.getSoundMap(layer);
    const sound = soundMap.get(key);
    if (!sound) return;

    try {
      // Fade out
      const status = await sound.getStatusAsync();
      const currentVolume = status.isLoaded ? status.volume : 0;
      await this.animateVolume(sound, currentVolume, 0, durationMs);

      // Stop and unload
      await sound.stopAsync();
      await sound.unloadAsync();
      soundMap.delete(key);
    } catch (error) {
      console.error(`[AudioManager] Failed to fade out ${key}:`, error);
      soundMap.delete(key);
    }
  }

  private async animateVolume(
    sound: Audio.Sound,
    from: number,
    to: number,
    durationMs: number
  ): Promise<void> {
    const steps = Math.ceil(durationMs / 50); // 50ms per step
    const stepDuration = durationMs / steps;
    const volumeStep = (to - from) / steps;

    for (let i = 0; i <= steps; i++) {
      const volume = from + volumeStep * i;
      try {
        await sound.setVolumeAsync(Math.max(0, Math.min(1, volume)));
      } catch {
        break; // Sound may have been unloaded
      }
      if (i < steps) {
        await new Promise((resolve) => setTimeout(resolve, stepDuration));
      }
    }
  }

  private getSoundMap(
    layer: 'ambient' | 'weather' | 'light'
  ): Map<string, Audio.Sound> {
    switch (layer) {
      case 'ambient':
        return this.ambientSounds;
      case 'weather':
        return this.weatherSounds;
      case 'light':
        return this.lightSounds;
    }
  }

  private getLayerVolume(layer: 'ambient' | 'weather' | 'light'): number {
    const layerVolume = layer === 'light' ? this.volumes.ambient * 0.5 : this.volumes[layer === 'ambient' ? 'ambient' : 'weather'];
    return this.volumes.master * layerVolume;
  }

  private updateAmbientVolumes(): void {
    const targetVolume = this.volumes.master * this.volumes.ambient;
    this.ambientSounds.forEach((sound) => {
      sound.setVolumeAsync(targetVolume).catch(() => {});
    });
    // Light sounds use ambient volume
    const lightVolume = targetVolume * 0.5;
    this.lightSounds.forEach((sound) => {
      sound.setVolumeAsync(lightVolume).catch(() => {});
    });
  }

  private updateWeatherVolumes(): void {
    const targetVolume = this.volumes.master * this.volumes.weather;
    this.weatherSounds.forEach((sound) => {
      sound.setVolumeAsync(targetVolume).catch(() => {});
    });
  }
}

// Export singleton instance
export const AudioManager = new AudioManagerClass();
