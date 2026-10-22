// The Reading size (docs/system/book-ui.md#world-and-status-entry): every type role scaled by
// min(step x the system font scale, cap); components read useType().
import type { Type } from './palette.ts';
import { reading, size, type } from './tokens.ts';

type Store = { getItemSync(key: string): string | null; setItemSync(key: string, v: string): void };
// The Reading size in the shell's key-value store (as model.ts hint). A value that
// is not a step (or a store that throws) reads Standard; a failed write keeps it for this session.
export type ReadingStep = 'standard' | 'large' | 'larger';
export type ReadingStore = ReturnType<typeof readingSize>;
export const steps: readonly ReadingStep[] = ['standard', 'large', 'larger'];
export function readingSize(store: Store, key: string) {
  return {
    get: (): ReadingStep => {
      try {
        const v = store.getItemSync(key);
        return steps.find((s) => s === v) ?? 'standard';
      } catch {
        return 'standard';
      }
    },
    set: (step: ReadingStep) => {
      try {
        store.setItemSync(key, step);
      } catch {} // ponytail: the next launch reads Standard
    },
  };
}

// The Book's Reading size: the step chosen on Settings and the type it gives.
export type Reading = { step: ReadingStep; choose: (step: ReadingStep) => void; type: Type };
export const readingFactor = (step: ReadingStep, fontScale: number) =>
  Math.min(reading[step] * fontScale, reading.cap);
const scale = <S extends { fontSize: number; lineHeight: number }>(s: S, f: number): S => ({
  ...s,
  fontSize: Math.round(s.fontSize * f),
  lineHeight: Math.round(s.lineHeight * f),
});
// Every role scales; the modifiers (named, italic) carry no size and pass through.
export const readingType = (f: number): Type =>
  Object.fromEntries(
    Object.entries(type).map(([k, s]) => [k, 'fontSize' in s ? scale(s, f) : s]),
  ) as Type;
// A Tap's vertical bleed: a reading line grown to a touch-sized target (BOOK-UI-COMPONENTS.md).
export const tapBleed = (lineHeight: number) => Math.max(0, (size.touch - lineHeight) / 2);
