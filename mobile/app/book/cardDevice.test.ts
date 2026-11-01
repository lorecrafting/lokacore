// The real device seam, on a stub react-native whose reader always says yes, as react-native-web does.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

const g = globalThis as any;
const native =
  'export const AccessibilityInfo={isScreenReaderEnabled:async()=>true},' +
  'AppState={get currentState(){return globalThis.appState},addEventListener:(_,f)=>{globalThis.appChange=f;return {remove(){globalThis.appChange=undefined}}}};';
registerHooks({
  resolve: (s, c, next) =>
    s === 'react-native'
      ? { url: `data:text/javascript,${encodeURIComponent(native)}`, shortCircuit: true }
      : next(s === './screenReader' ? './screenReader.ts' : s, c),
});
const { screenReaderOn, isForeground, onForeground } = await import('./cardDevice.ts');
const web = await import('./screenReader.web.ts');

// Breaks: react-native-web's constant yes reaches the card, and nobody on the web gets the auto-turn.
test('the web answers no screen reader; a device answers what it is told', async () => {
  assert.equal(await web.screenReaderOn(), false);
  assert.equal(await screenReaderOn(), true);
});

// Breaks: an inactive app (a call, the switcher) counts as foreground, or the listener leaks.
test('only an active app is in the foreground', () => {
  g.appState = 'inactive';
  assert.equal(isForeground(), false);
  g.appState = 'active';
  assert.equal(isForeground(), true);
  const seen: boolean[] = [];
  const stop = onForeground((a) => seen.push(a));
  g.appChange('background');
  g.appChange('active');
  assert.deepEqual(seen, [false, true]);
  stop();
  assert.equal(g.appChange, undefined);
});
