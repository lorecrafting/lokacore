import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { motion } from './tokens.ts';

// Reanimated needs React Native; these curves stand in for its Easing (names only matter here).
const curves = 'export const Easing={bezier:()=>({}),inOut:f=>f,quad:t=>t,linear:t=>t};';
registerHooks({
  resolve: (specifier, context, next) =>
    specifier === 'react-native-reanimated'
      ? { url: `data:text/javascript,${curves}`, shortCircuit: true }
      : next(specifier, context),
});
const { easing } = await import('./easing.ts');

// Breaks: a motion token names a curve the page-turn driver does not know (motion.quick's 'ease'
// once did), or an unknown name falls back silently instead of failing
// (BOOK-UI-COMPONENTS.md#page-turn, Timing).
test('every motion easing is a curve the driver knows; an unknown name is an error', () => {
  for (const [token, { easing: name }] of Object.entries(motion))
    assert.doesNotThrow(() => easing(name), token);
  assert.throws(() => easing('bounce'), /unknown easing bounce/);
});
