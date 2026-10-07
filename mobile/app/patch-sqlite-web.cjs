// expo-sqlite 57.0.3 truncates sync lengths, loses Error messages and times out by CPU speed.
// Keep these exact guards until the installed SDK fixes them upstream.
const fs = require('node:fs');
const path = require('node:path');

const moduleRoot = path.dirname(require.resolve('expo-sqlite/package.json'));
const version = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'package.json'), 'utf8')).version;
if (version !== '57.0.3') throw new Error(`Review the SQLite web patch for version ${version}`);
const file = path.join(moduleRoot, 'web/WorkerChannel.ts');
const source = fs.readFileSync(file, 'utf8');
let patched = source;
for (const [before, after] of [
  [
    'resultArray.set(new Uint32Array([length]), 0);',
    'resultArray.set(new Uint8Array(new Uint32Array([length]).buffer), 0);',
  ],
  ['serialize({ error })', 'serialize({ error: error.message })'],
  ['self.postMessage({ id, error });', 'self.postMessage({ id, error: error?.message });'],
  [
    `  let i = 0;
  // @ts-expect-error: Remove this when TypeScript supports Atomics.pause
  const useAtomicsPause = typeof Atomics.pause === 'function';
  while (Atomics.load(lock, 0) === PENDING) {
    ++i;

    if (useAtomicsPause) {
      if (i > 1_000_000) {
        throw new Error('Sync operation timeout');
      }
      // @ts-expect-error: Remove this when TypeScript supports Atomics.pause
      Atomics.pause();
    } else {
      // NOTE(kudo): Unfortunate for the busy loop,
      // because we don't have a way for main thread to yield its execution to other callbacks.
      if (i > 1000_000_000) {
        throw new Error('Sync operation timeout');
      }
    }
  }`,
    `  const deadline = performance.now() + 5_000;
  let i = 0;
  // @ts-expect-error: Remove this when TypeScript supports Atomics.pause
  const useAtomicsPause = typeof Atomics.pause === 'function';
  // Without Atomics.pause, the main thread still needs the SDK's busy-loop fallback.
  while (Atomics.load(lock, 0) === PENDING) {
    // Read the monotonic clock every 4096 spins, rather than on every poll.
    if ((++i & 0xfff) === 0 && performance.now() >= deadline) {
      throw new Error('Sync operation timeout');
    }
    if (useAtomicsPause) {
      // @ts-expect-error: Remove this when TypeScript supports Atomics.pause
      Atomics.pause();
    }
  }`,
  ],
]) {
  const oldCount = patched.split(before).length - 1;
  const newCount = patched.split(after).length - 1;
  if (oldCount + newCount !== 1) throw new Error('Review the SQLite web worker upstream');
  if (oldCount) patched = patched.replace(before, after);
}
if (patched !== source) fs.writeFileSync(file, patched);
