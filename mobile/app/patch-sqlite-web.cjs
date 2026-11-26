// expo-sqlite 57.0.3 truncates sync lengths, loses Error messages, times out by CPU speed and
// allocates a 1 MB SharedArrayBuffer per sync call (Chrome runs out of array-buffer memory in play).
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
  [
    'let hasWarnedSync = false;\n\n',
    `let hasWarnedSync = false;
// Sync calls block the main thread, so one lock and one result buffer per worker serve them all.
const syncBuffers = new WeakMap<Worker, { lockBuffer: SharedArrayBuffer; resultBuffer: SharedArrayBuffer }>();

`,
  ],
  [
    `  const lockBuffer = new SharedArrayBuffer(4);
  const lock = new Int32Array(lockBuffer);
  const resultBuffer = new SharedArrayBuffer(1024 * 1024);
`,
    `  const buffers = syncBuffers.get(worker) ?? {
    lockBuffer: new SharedArrayBuffer(4),
    // ponytail: a result over 64 MB still times out, as one over 1 MB did upstream.
    resultBuffer: new SharedArrayBuffer(1024 * 1024, { maxByteLength: 64 * 1024 * 1024 }),
  };
  // Cached again only after a reply, so a timed-out call's late reply cannot answer the next call.
  syncBuffers.delete(worker);
  const { lockBuffer, resultBuffer } = buffers;
  const lock = new Int32Array(lockBuffer);
`,
  ],
  [
    `  }

  const length = new Uint32Array(resultArray.buffer, 0, 1)[0];`,
    `  }
  syncBuffers.set(worker, buffers);

  const length = new Uint32Array(resultArray.buffer, 0, 1)[0];`,
  ],
  [
    `    const length = resultBytes.length;
    resultArray.set(`,
    `    const length = resultBytes.length;
    // The main thread cannot receive a bigger buffer while it waits, so the worker grows the shared one.
    if (length + 4 > resultBuffer.byteLength) resultBuffer.grow(length + 4);
    resultArray.set(`,
  ],
]) {
  const oldCount = patched.split(before).length - 1;
  const newCount = patched.split(after).length - 1;
  if (oldCount + newCount !== 1) throw new Error('Review the SQLite web worker upstream');
  if (oldCount) patched = patched.replace(before, after);
}
if (patched !== source) fs.writeFileSync(file, patched);

// WebKit grants a sync access handle's write capacity through the page's main thread, which a sync
// call keeps busy: a write that grows a file waits out the timeout (loka-hcnlh.19.2). So on WebKit
// each pool handle takes headroom while the open is still async, then truncates back to its size.
const pool = path.join(moduleRoot, 'web/wa-sqlite/AccessHandlePoolVFS.js');
const poolSource = fs.readFileSync(pool, 'utf8');
const open = 'await handle.createSyncAccessHandle()';
const warm = `
// loka-hcnlh.19.2 warm-up
// ponytail: 32 MB of growth past a file's size at open. A save that outgrows it in one session
// stalls on that write (the open's Try again does not cover play): the player reloads, which warms
// again from the new size.
const WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrome\\//.test(navigator.userAgent);
function warmed(accessHandle) {
  if (!WEBKIT) return accessHandle; // Chromium grants growth in the worker; skip the 32 MB write
  const size = accessHandle.getSize();
  try {
    accessHandle.write(new Uint8Array(1), { at: size + 32 * 1024 * 1024 });
  } catch {} // no headroom granted: the save still opens, as it did before
  accessHandle.truncate(size);
  return accessHandle;
}
`;
if (!poolSource.endsWith(warm)) {
  if (poolSource.includes('warmed('))
    throw new Error('Reinstall expo-sqlite: an older warm-up is patched in');
  if (poolSource.split(open).length - 1 !== 2)
    throw new Error('Review the SQLite web pool upstream');
  fs.writeFileSync(pool, poolSource.replaceAll(open, `warmed(${open})`) + warm);
}

// A page kept in the back/forward cache keeps its worker, and the pool keeps every save file's OPFS
// handle until the worker ends (closing the database does not free them): the Book opened again
// reads "already open in another tab" (loka-hcnlh.19.5). So the leaving page ends its worker, and a
// page restored from the cache reloads rather than call a worker that is gone. Every save call is
// synchronous, so pagehide never runs inside a transaction.
const webModule = path.join(moduleRoot, 'web/SQLiteModule.ts');
const moduleSource = fs.readFileSync(webModule, 'utf8');
const create = "    worker = new Worker(new URL('./worker', window.location.href));\n";
const release = `${create}    // loka-hcnlh.19.5 release
    window.addEventListener('pagehide', () => {
      worker?.terminate();
      worker = null;
    });
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) window.location.reload();
    });
`;
if (!moduleSource.includes(release)) {
  if (moduleSource.split(create).length - 1 !== 1)
    throw new Error('Review the SQLite web module upstream');
  fs.writeFileSync(webModule, moduleSource.replace(create, release));
}
