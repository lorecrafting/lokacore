// The Settings the Book holds: the player's Reading size and effect settings.
import { useState } from 'react';
import { flashesOn } from './cues.ts';
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
import './samples';
import { play, setMuted } from './sound';

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

// Each setting reaches its module before any effect runs, so a cue at launch or a preview in choose sees it.
const applyEffect: Record<Effect, (on: boolean) => void> = {
  sound: (on) => setMuted('sound', !on),
  music: (on) => setMuted('music', !on),
  haptics: hapticsOn,
  flashes: flashesOn,
};

// The effect settings: each read at launch and given to its module.
function useEffects(shell: SettingStores): Effects {
  const [on, setOn] = useState(() => {
    const read = (e: Effect) => {
      const value = shell.effects?.[e].get() ?? true;
      applyEffect[e](value);
      return [e, value];
    };
    return Object.fromEntries(effects.map(read)) as Effects['on'];
  });
  const choose = (e: Effect, value: boolean) => {
    applyEffect[e](value); // first: turning Sound off previews silently, and the chip's haptic, after this, obeys Haptics
    if (e === 'sound' && on[e] !== value) play('pageTurn');
    setOn((o) => ({ ...o, [e]: value }));
    shell.effects?.[e].set(value);
  };
  return { on, choose };
}

export const useSettings = (shell: SettingStores) => ({
  reading: useReading(shell),
  effects: useEffects(shell),
});
