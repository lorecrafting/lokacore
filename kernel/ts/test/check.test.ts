// `bin/loka check` (docs/system/cartridge.md#author-preview): real compile, real replay, literal
// report. mise is stubbed as CI has none (as author.test.ts); mix comes from PATH.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { ROOT } from '../play/obs.ts';

const tmp = mkdtempSync(join(tmpdir(), 'loka-check-test-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const bin = join(tmp, 'bin');
mkdirSync(bin);
writeFileSync(join(bin, 'mise'), '#!/bin/sh\nshift 2\nexec "$@"\n');
chmodSync(join(bin, 'mise'), 0o755);

/** A copy of the sampler to edit. */
function sampler(name: string, from = 'rooms_sampler') {
  const dir = join(tmp, name);
  cpSync(join(ROOT, 'cartridges', from), dir, { recursive: true });
  return dir;
}
const write = (dir: string, file: string, content: string) =>
  writeFileSync(join(dir, 'checkpoints', file), content);
const NORTH = { intent: { action_key: 'move', target_ids: [], input: { direction: 'north' } } };

/** Runs the command with stdin left open, so a prompt would hang until the timeout kills it. */
function run(...args: string[]) {
  return new Promise<{ code: number | null; out: string }>((done) => {
    const child = spawn(join(ROOT, 'bin/loka'), ['check', ...args], {
      cwd: ROOT,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 90_000,
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('close', (code) => done({ code, out }));
  });
}

// Break: the gate stops replaying through the preview's path, or fails a good checkpoint.
test('a checkpoint the cartridge accepts prints ok and exits 0', async () => {
  assert.deepEqual(await run(join(ROOT, 'cartridges/rooms_sampler')), {
    code: 0,
    out: 'to_the_well: ok\n',
  });
});

// Break: a refusal exits 0, is not named, or a bad checkpoint ends the run before the others report.
test('an edit that refuses a step names it and exits 1; each checkpoint still reports', async () => {
  const dir = sampler('refused');
  const room = join(dir, 'rooms/ferry_landing.json');
  const data = JSON.parse(readFileSync(room, 'utf8')) as { exits: Record<string, unknown> };
  delete data.exits['north'];
  writeFileSync(room, JSON.stringify(data));
  write(dir, 'a_no_steps.json', '{}');
  write(dir, 'a_empty.json', '{"steps":[]}');
  write(dir, 'b_back_clock.json', '{"steps":[{"advance":-1}]}');
  write(
    dir,
    'to_the_boathouse.json',
    JSON.stringify({ steps: [{ intent: { ...NORTH.intent, input: { direction: 'west' } } }] }),
  );
  assert.deepEqual(await run(dir), {
    code: 1,
    out:
      'a_empty: not replayed (a checkpoint is {"steps": [...]} with at least one step)\n' +
      'a_no_steps: not replayed (a checkpoint is {"steps": [...]} with at least one step)\n' +
      'b_back_clock: step 1 (advance -1): not whole milliseconds\n' +
      'to_the_boathouse: ok\n' +
      'to_the_well: step 1 (move): rejected not_found\n',
  });
});

// Break: a session carries over between checkpoints instead of the start over the preview's jump
// does, or a jump's path reaches a prompt: the run would hang on the open stdin.
test('each checkpoint starts over without a prompt', async () => {
  const dir = sampler('twice');
  write(dir, 'again.json', JSON.stringify({ steps: [NORTH] }));
  assert.deepEqual(await run(dir), {
    code: 0,
    out: 'again: ok\nto_the_well: ok\n',
  });
});

// Break: an advance step does not reach the game: the clock stays put or the time is not delivered,
// so a door that opens only in hours 2 to 4 of the world's day stays shut (6000 ms is hour 3 at rate 50).
test('an advance moves the world for the next step', async () => {
  const dir = sampler('later', 'time_sampler');
  mkdirSync(join(dir, 'checkpoints'));
  const manifest = join(dir, 'cartridge.json');
  const data = JSON.parse(readFileSync(manifest, 'utf8')) as object;
  writeFileSync(
    manifest,
    JSON.stringify({
      ...data,
      time_policy: { profile: 'real_elapsed', rate: 50, recap_after_minutes: 30 },
    }),
  );
  const open = { intent: { action_key: 'open', target_ids: [], input: { direction: 'east' } } };
  write(dir, 'at_once.json', JSON.stringify({ steps: [open] }));
  write(dir, 'later.json', JSON.stringify({ steps: [{ advance: 6000 }, open] }));
  assert.deepEqual(await run(dir), {
    code: 1,
    out: 'at_once: step 1 (open): rejected invalid_state\nlater: ok\n',
  });
});

// Break: a gate with nothing to replay passes, or a broken cartridge replays anyway.
test('no checkpoints and a failed compile each exit 1', async () => {
  const none = sampler('none');
  rmSync(join(none, 'checkpoints'), { recursive: true });
  assert.deepEqual(await run(none), {
    code: 1,
    out: `no checkpoints in ${join(none, 'checkpoints')}\n`,
  });
  const broken = sampler('broken');
  writeFileSync(join(broken, 'cartridge.json'), '{');
  const { code, out } = await run(broken);
  assert.equal(code, 1);
  assert.match(out, /^not compiled: (?!compile failed)/); // the compiler's own words
});

// Break: a machine without mise reads as a bare "compile failed", with no cause.
test('a compiler that cannot start says why', () => {
  const r = spawnSync(
    process.execPath,
    [join(ROOT, 'kernel/ts/play/check.ts'), sampler('nomise')],
    {
      env: { PATH: '' },
      encoding: 'utf8',
    },
  );
  assert.equal(r.status, 1);
  assert.equal(r.stdout, 'not compiled: spawnSync mise ENOENT\n');
});

// Break: a mistyped command replays the wrong thing or reads as a gate failure (exit 1).
test('a command without exactly one cartridge is a usage error', async () => {
  assert.deepEqual(await run(), { code: 2, out: '' });
  assert.deepEqual(await run('a', 'b'), { code: 2, out: '' });
});
