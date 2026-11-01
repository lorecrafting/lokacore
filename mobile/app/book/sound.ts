// The sound module (book-ui.md, Effects, sound and haptics). Device: silent until loka-k5ci brings
// expo-audio; sound.web.ts is the browser's.
import type { sound } from './tokens.ts';

export type SoundName = keyof typeof sound;
export const sources = (
  _urls: Partial<Record<SoundName, string[]>>,
  _rooms?: { beds?: Record<string, string>; pieces?: Record<string, string> },
) => {};
export const ambience = (
  _tag: string | undefined,
  _weather: string | undefined,
  _exposed: boolean,
) => {};
export const thunder = (_muffled: boolean) => {};
export const play = (_name: SoundName) => {};
export const fight = (_event: 'open' | 'resume' | 'won' | 'away' | 'cut') => {};
export const setMuted = (_group: 'sound' | 'music', _muted: boolean) => {};
