// The haptic module (book-ui.md, Effects, sound and haptics). Device: silent until loka-k5ci brings
// expo-haptics; haptic.web.ts is the browser's.
import type { haptic as tokens } from './tokens.ts';

export type HapticKind = Exclude<keyof typeof tokens, 'gap'>;
export const haptic = (_kind: HapticKind) => {};
export const hapticsOn = (_on: boolean) => {};
export const onPulse = (_show: (kind: HapticKind) => void) => () => {};
