// `bin/loka check` (docs/system/cartridge.md#author-preview): real compile, real replay, literal
// report. mise is stubbed as CI has none (as author.test.ts); mix comes from PATH.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
function sampler(name: string) {
  const dir = join(tmp, name);
  cpSync(join(ROOT, 'cartridges/rooms_sampler'), dir, { recursive: true });
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
  write(dir, 'b_back_clock.json', '{"steps":[{"advance":-1}]}');
  write(
    dir,
    'to_the_boathouse.json',
    JSON.stringify({ steps: [{ intent: { ...NORTH.intent, input: { direction: 'west' } } }] }),
  );
  assert.deepEqual(await run(dir), {
    code: 1,
    out:
      'a_no_steps: malformed (a checkpoint is {"steps": [...]})\n' +
      'b_back_clock: malformed (advance -1 is not whole milliseconds)\n' +
      'to_the_boathouse: ok\n' +
      'to_the_well: step 1 (move): rejected not_found\n',
  });
});

// Break: a session carries over between checkpoints instead of the start over the preview's jump
// does, or a jump's path reaches a prompt: the run would hang on the open stdin.
test('each checkpoint starts over without a prompt', async () => {
  const dir = sampler('twice');
  write(dir, 'again.json', JSON.stringify({ steps: [NORTH] }));
  write(dir, 'no_wait.json', '{"steps":[{"advance":0}]}'); // a zero advance is whole milliseconds
  assert.deepEqual(await run(dir), {
    code: 0,
    out: 'again: ok\nno_wait: ok\nto_the_well: ok\n',
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

// Break: a mistyped command replays the wrong thing or reads as a gate failure (exit 1).
test('a command without exactly one cartridge is a usage error', async () => {
  assert.deepEqual(await run(), { code: 2, out: '' });
  assert.deepEqual(await run('a', 'b'), { code: 2, out: '' });
});
