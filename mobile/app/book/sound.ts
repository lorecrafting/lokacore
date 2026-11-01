// The sound module (book-ui.md, Effects, sound and haptics). Device: silent until loka-k5ci brings
// expo-audio; sound.web.ts is the browser's.
import type { sound } from './tokens.ts';

export type SoundName = keyof typeof sound;
export const sources = (_urls: Partial<Record<SoundName, string[]>>) => {};
export const play = (_name: SoundName, _tier?: string) => {};
export const fight = (_event: 'open' | 'resume' | 'won' | 'away' | 'cut') => {};
export const setMuted = (_group: 'sound' | 'music', _muted: boolean) => {};
