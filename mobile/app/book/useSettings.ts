// The Settings the Book holds: the player's Reading size and effect settings.
import { useEffect, useState } from 'react';
import { hapticsOn } from './haptic';
import {
  effects,
  readingFactor,
  readingType,
  type Effect,
  type Effects,
  type EffectStores,
  type Reading,
  type ReadingStep,
  type ReadingStore,
} from './reading.ts';
import { setMuted } from './sound';

export type SettingStores = {
  reading?: ReadingStore & { fontScale: () => number }; // and the system font scale
  effects?: EffectStores;
};

// The Reading size the player chose on Settings, scaled by the system font scale.
function useReading(shell: SettingStores): Reading {
  const [step, setStep] = useState(() => shell.reading?.get() ?? 'standard');
  const choose = (s: ReadingStep) => (setStep(s), shell.reading?.set(s));
  return { step, choose, type: readingType(readingFactor(step, shell.reading?.fontScale() ?? 1)) };
}

// The effect settings: each read at launch and given to its module, so a stored Off holds at once.
function useEffects(shell: SettingStores): Effects {
  const [on, setOn] = useState(
    () =>
      Object.fromEntries(
        effects.map((e) => [e, shell.effects?.[e].get() ?? true]),
      ) as Effects['on'],
  );
  useEffect(() => {
    setMuted('sound', !on.sound);
    setMuted('music', !on.music);
    hapticsOn(on.haptics);
  }, [on]);
  const choose = (e: Effect, value: boolean) => {
    setOn((o) => ({ ...o, [e]: value }));
    shell.effects?.[e].set(value);
  };
  return { on, choose };
}

export const useSettings = (shell: SettingStores) => ({
  reading: useReading(shell),
  effects: useEffects(shell),
});
