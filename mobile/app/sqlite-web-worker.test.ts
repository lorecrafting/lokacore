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
const invoke = `
  const { Worker, parentPort, workerData } = require('node:worker_threads');
  global.__DEV__ = false;
  if (workerData.pause && typeof Atomics.pause !== 'function') throw new Error('Pinned Node lacks Atomics.pause');
  if (!workerData.pause) Atomics.pause = undefined;
  const { invokeWorkerSync } = require(workerData.channel);
  const responder = new Worker(\`
    const { parentPort, workerData } = require('node:worker_threads');
    const { sendWorkerResult } = require(workerData.channel);
    parentPort.on('message', ({ id, lockBuffer, resultBuffer }) => {
      if (workerData.delay === null) return;
      setTimeout(() => sendWorkerResult({
        id, result: 'healthy reply', error: null, syncTrait: { lockBuffer, resultBuffer },
      }), workerData.delay);
    });
    parentPort.postMessage('ready');
  \`, { eval: true, workerData });
  responder.once('message', () => {
    const started = performance.now();
    let reply;
    try { reply = { result: invokeWorkerSync(responder, 'exec', {}) }; }
    catch (error) { reply = { error: error.message }; }
    reply.elapsed = performance.now() - started;
    responder.terminate().then(() => parentPort.postMessage(reply));
  });
`;

function reply(pause: boolean, delay: number | null) {
  return new Promise<{ result?: string; error?: string; elapsed: number }>((resolve, reject) => {
    const worker = new Worker(invoke, { eval: true, workerData: { channel, pause, delay } });
    const watchdog = setTimeout(() => {
      void worker.terminate();
      reject(new Error('SQLite bridge did not stop within eight seconds'));
    }, 8_000);
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
    for (const delay of [100, 250]) {
      const healthy = await reply(pause, delay);
      assert.equal(healthy.error, undefined);
      assert.equal(healthy.result, 'healthy reply');
    }
    const silent = await reply(pause, null);
    assert.equal(silent.result, undefined);
    assert.equal(silent.error, 'Sync operation timeout');
    assert.ok(silent.elapsed >= 4_900 && silent.elapsed < 7_500, `elapsed ${silent.elapsed}ms`);
  });
}
