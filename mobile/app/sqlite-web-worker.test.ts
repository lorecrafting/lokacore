import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { Worker } from 'node:worker_threads';
import ts from 'typescript';

const fixture = mkdtempSync(join(tmpdir(), 'loka-sqlite-worker-'));
after(() => rmSync(fixture, { recursive: true, force: true }));
const installed = dirname(createRequire(import.meta.url).resolve('expo-sqlite/package.json'));
const moduleRoot = join(fixture, 'node_modules/expo-sqlite');
mkdirSync(join(moduleRoot, 'web'), { recursive: true });
for (const name of ['WorkerChannel', 'Deferred', 'SyncSerializer']) {
  cpSync(join(installed, 'web', `${name}.ts`), join(moduleRoot, 'web', `${name}.ts`));
}
cpSync(join(installed, 'package.json'), join(moduleRoot, 'package.json'));
const patch = join(fixture, 'patch.cjs');
cpSync(join(import.meta.dirname, 'patch-sqlite-web.cjs'), patch);
execFileSync(process.execPath, [patch]);
// A reinstall/pretest may run the patch again; exercise that actual output too.
execFileSync(process.execPath, [patch]);
for (const name of ['WorkerChannel', 'Deferred', 'SyncSerializer']) {
  const source = readFileSync(join(moduleRoot, 'web', `${name}.ts`), 'utf8');
  writeFileSync(
    join(moduleRoot, 'web', `${name}.js`),
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  );
}
const channel = join(moduleRoot, 'web/WorkerChannel.js');

// Run the actual patched bridge off the test thread so an unbounded mutant can be killed.
// Each call asks the responder for `text` (or `size` bytes) after `delay` ms; null never replies.
type Call = { delay: number | null; text?: string; size?: number };
type Reply = { result?: string; error?: string; elapsed: number };
const invoke = `
  const { Worker, parentPort, workerData } = require('node:worker_threads');
  global.__DEV__ = false;
  if (workerData.pause && typeof Atomics.pause !== 'function') throw new Error('Pinned Node lacks Atomics.pause');
  if (!workerData.pause) Atomics.pause = undefined;
  const { invokeWorkerSync } = require(workerData.channel);
  const responder = new Worker(\`
    const { parentPort, workerData } = require('node:worker_threads');
    const { sendWorkerResult } = require(workerData.channel);
    parentPort.on('message', ({ id, data, lockBuffer, resultBuffer }) => {
      if (data.delay === null) return;
      setTimeout(() => sendWorkerResult({
        id, result: data.size ? 'x'.repeat(data.size) : data.text, error: null,
        syncTrait: { lockBuffer, resultBuffer },
      }), data.delay);
    });
    parentPort.postMessage('ready');
  \`, { eval: true, workerData });
  responder.once('message', () => {
    const replies = workerData.calls.map((call) => {
      const started = performance.now();
      let reply;
      try { reply = { result: invokeWorkerSync(responder, 'exec', call) }; }
      catch (error) { reply = { error: error.message }; }
      reply.elapsed = performance.now() - started;
      return reply;
    });
    responder.terminate().then(() => parentPort.postMessage(replies));
  });
`;

function replies(pause: boolean, calls: Call[]) {
  return new Promise<Reply[]>((resolve, reject) => {
    const worker = new Worker(invoke, { eval: true, workerData: { channel, pause, calls } });
    const watchdog = setTimeout(
      () => {
        void worker.terminate();
        reject(new Error('SQLite bridge did not stop in time'));
      },
      3_000 + 6_000 * calls.length,
    );
    worker.once('message', (value) => {
      clearTimeout(watchdog);
      void worker.terminate();
      resolve(value);
    });
    worker.once('error', (error) => {
      clearTimeout(watchdog);
      void worker.terminate();
      reject(error);
    });
  });
}

for (const pause of [true, false]) {
  // Breaks: a CPU iteration cap refuses a healthy delayed reply, or a silent worker hangs.
  test(`patched worker uses elapsed time with Atomics.pause ${pause ? 'enabled' : 'absent'}`, async () => {
    const [fast, slow, silent] = await replies(pause, [
      { delay: 100, text: 'healthy reply' },
      { delay: 250, text: 'healthy reply' },
      { delay: null },
    ]);
    for (const healthy of [fast, slow]) {
      assert.equal(healthy.error, undefined);
      assert.equal(healthy.result, 'healthy reply');
    }
    assert.equal(silent.result, undefined);
    assert.equal(silent.error, 'Sync operation timeout');
    assert.ok(silent.elapsed >= 4_900 && silent.elapsed < 7_500, `elapsed ${silent.elapsed}ms`);
  });
}

// Breaks: the reused result buffer stays at 1 MB, so a bigger result never arrives.
test('patched worker returns a result larger than the first buffer', async () => {
  const [small, large] = await replies(true, [
    { delay: 0, text: 'small' },
    { delay: 0, size: 2_000_000 },
  ]);
  assert.equal(small.result, 'small');
  assert.equal(large.error, undefined);
  assert.equal(large.result?.length, 2_000_000);
});

// Breaks: a timed-out call's late reply lands in the reused buffer and answers the next call.
test('patched worker never returns a timed-out reply to the next call', async () => {
  // The first reply caches the buffers the timed-out call then reuses.
  const [, timedOut, next] = await replies(true, [
    { delay: 0, text: 'first reply' },
    { delay: 5_500, text: 'late reply' },
    { delay: 1_500, text: 'next reply' },
  ]);
  assert.equal(timedOut.error, 'Sync operation timeout');
  assert.equal(next.result, 'next reply');
});
