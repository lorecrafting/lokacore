import { useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';

export function usePageSound() {
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSound() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../../assets/audio/page_flip.m4a'),
          { shouldPlay: false },
        );
        if (mounted) {
          soundRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch (err) {
        // Sound loading is non-critical — game works without it
        console.warn('[usePageSound] Failed to load page flip sound:', err);
      }
    }

    void loadSound();

    return () => {
      mounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  const playFlip = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;

    try {
      // ±5% pitch variation for organic feel
      const rate = 0.95 + Math.random() * 0.1;
      await sound.setRateAsync(rate, true);
      await sound.replayAsync();
    } catch (err) {
      console.warn('[usePageSound] Failed to play page flip sound:', err);
    }
  }, []);

  return { playFlip };
}
