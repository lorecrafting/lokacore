// The editor's worlds (POST /world, write.ts; author.ts restarts on the chosen one): which names
// reach mix, and that the restarted watcher writes only into the world it switched to.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { editing } from '../play/editing.ts';
import { serve } from '../play/live.ts';
import { sha256 } from '../play/guard.ts';
import { ROOT } from '../play/obs.ts';
import { read } from './read.ts';

const ROOM = '{\n  "name": "room.start",\n  "exits": {}\n}\n';

/** worlds/a and worlds/b (b titled "Bee"), a `mise` stub on PATH: a compile copies the known-answer
 * artifact; `mix loka.new` logs its arguments, waits 0.5 s, and makes a cartridge at its 6th. */
function worlds(t: TestContext) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-world-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [name, title] of [
    ['a', 'A'],
    ['b', 'Bee'],
    ['c', '~'],
    ['Big', 'Big'], // not a name mix loka.new takes: not listed
    ['lantern_proof', 'Lantern'], // the frozen fixture: not listed
  ]) {
    mkdirSync(join(dir, 'worlds', name, 'rooms'), { recursive: true });
    writeFileSync(join(dir, 'worlds', name, 'cartridge.json'), JSON.stringify({ id: name, title }));
    writeFileSync(join(dir, 'worlds', name, 'rooms/start.json'), ROOM);
  }
  mkdirSync(join(dir, 'worlds', 'loose')); // no cartridge.json: not a world
  symlinkSync(join(dir, 'worlds', 'b'), join(dir, 'worlds', 'linked')); // a link: not a world
  const kat = read('protocol/fixtures/cartridge_rooms_hash.json');
  const good = join(dir, 'good.json');
  writeFileSync(good, `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`);
  writeFileSync(
    join(dir, 'mise'),
    `#!/bin/sh\n[ "$4" = loka.lint ] && exit 0\n[ "$4" = loka.compile ] && exec cp "${good}" "$6"\n` +
      `shift 3; echo "$@" >> "${dir}/new.log"; case $3 in */no) echo 'mix: refused' >&2; exit 1;; esac\n` +
      `sleep 0.5; mkdir "$3"; echo {} > "$3/cartridge.json"\n`,
  );
  chmodSync(join(dir, 'mise'), 0o755);
  return { dir, a: join(dir, 'worlds/a'), env: { PATH: `${dir}:${process.env.PATH}` } };
}

const ask = async (port: number, path: string, sent?: unknown) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: sent === undefined ? 'GET' : 'POST',
    headers: { host: `localhost:${port}` },
    ...(sent !== undefined && { body: JSON.stringify(sent) }),
  });
  return { status: response.status, body: await response.json() };
};

test('/world lists real worlds, refuses names that are paths, and makes one as bin/loka new does', async (t) => {
  const { dir, a, env } = worlds(t);
  const path = process.env.PATH;
  process.env.PATH = env.PATH;
  t.after(() => (process.env.PATH = path));
  const left: string[] = [];
  const live = serve(0, a, join(dir, 'none.json'), { leave: (world) => left.push(world) });
  t.after(() => live.close());
  const port = await live.port;
  // Break: a link, a folder with no cartridge.json or the frozen lantern_proof listed; a `~` title
  // shown instead of the name.
  const list = [
    { name: 'a', title: 'A' },
    { name: 'b', title: 'Bee' },
    { name: 'c', title: 'c' },
  ];
  assert.deepEqual(await ask(port, '/world'), {
    status: 200,
    body: { current: 'a', worlds: list },
  });
  // Break: a name that climbs out of worlds/, a link, or a folder that is no cartridge, opened or made.
  for (const [status, sent] of [
    [400, { name: '../worlds/b' }],
    [404, { name: 'linked' }],
    [404, { name: 'loose' }],
    [404, { name: 'e', new: 'yes' }], // only new: true makes a world
    [400, { name: '../x', new: true }],
    [400, { name: 'x.y', new: true }],
    [400, { name: '1x', new: true }],
    [400, { name: 'x'.repeat(33), new: true }], // mix loka.new's cap is 32
    [409, { name: 'b', new: true }],
    [400, { name: 'x', new: true, from: '../worlds/b' }],
    [404, { name: 'x', new: true, from: 'linked' }],
  ] as const)
    assert.equal((await ask(port, '/world', sent)).status, status, JSON.stringify(sent));
  assert.equal(existsSync(join(dir, 'new.log')), false);
  assert.deepEqual(left, []);
  // Break: mix's refusal not passed on, or the server left busy after it.
  assert.deepEqual(await ask(port, '/world', { name: 'no', new: true }), {
    status: 400,
    body: 'mix: refused',
  });
  rmSync(join(dir, 'new.log'));
  // Break: the route runs mix with other arguments than `bin/loka new cartridge <path> --from <path>`.
  const making = ask(port, '/world', { name: 'd', new: true, from: 'b' });
  await new Promise((r) => setTimeout(r, 200));
  // Break: a switch, or an edit, while the new world is being made.
  assert.equal((await ask(port, '/world', { name: 'b' })).status, 409);
  const put = { method: 'PUT', headers: { host: `localhost:${port}` }, body: '{"steps": []}' };
  const saved = await fetch(`http://127.0.0.1:${port}/checkpoints/c`, put);
  assert.equal(saved.status, 409, 'a checkpoint saved into the snapshot diff');
  assert.equal(existsSync(join(a, 'checkpoints')), false);
  assert.deepEqual(await making, { status: 200, body: { world: 'd' } });
  const worlds_ = join(dir, 'worlds');
  assert.equal(
    readFileSync(join(dir, 'new.log'), 'utf8'),
    `loka.new cartridge ${worlds_}/d --from ${worlds_}/b\n`,
  );
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(left, [`${worlds_}/d`]);
  // Break: a second switch (or an edit) accepted while the watcher is leaving for d.
  assert.equal((await ask(port, '/world', { name: 'b' })).status, 409);
  assert.deepEqual(left, [`${worlds_}/d`]);
});

test('a switch whose client is gone before the 200 flushes still restarts', async (t) => {
  // Breaks: leave waiting for 'finish', which a closed connection never sends: busy stays raised.
  const { dir, a } = worlds(t);
  const left: string[] = [];
  const route = editing(a, { push() {}, tell() {} }, () => {}, {
    leave: (world) => left.push(world),
  }).route;
  const request = Object.assign(Readable.from([JSON.stringify({ name: 'b' })]), {
    method: 'POST',
    url: '/world',
  });
  const response = Object.assign(new EventEmitter(), { writeHead: () => response, end() {} });
  assert.equal(
    await route(request as unknown as IncomingMessage, response as unknown as ServerResponse),
    true,
  );
  response.emit('close'); // no 'finish'
  assert.deepEqual(left, [join(dir, 'worlds/b')]);
});

test('after a switch the restarted watcher writes into the new world only', async (t) => {
  const { dir, a, env } = worlds(t);
  const port = 20000 + Math.floor(Math.random() * 12000);
  // bin/loka dev itself, so its restart on 75 with the remembered world is under test too; opened
  // through a link, so the restart must take the checked (real) path, not the link's.
  symlinkSync(join(dir, 'worlds'), join(dir, 'via'));
  const dev = spawn(`${ROOT}bin/loka`, ['dev', join(dir, 'via/a'), '--watch'], {
    env: { ...env, LOKA_DEV_CARTRIDGE: join(dir, 'out/current.json'), LOKA_AUTHOR_PORT: `${port}` },
    detached: true,
  });
  t.after(() => process.kill(-dev.pid!));
  const current = () =>
    ask(port, '/world').then(
      (r) => (r.body as { current: string }).current,
      () => undefined,
    );
  const now = async (name: string) => {
    for (let i = 0; i < 200; i++)
      if ((await current()) === name) return;
      else await new Promise((r) => setTimeout(r, 50));
    assert.fail(`never on ${name}`);
  };
  await now('a');
  assert.equal((await ask(port, '/world', { name: 'b' })).status, 200);
  await now('b');
  assert.equal(readFileSync(join(dir, 'out/world'), 'utf8'), join(dir, 'worlds/b'));
  // Break: the guard still rooted at a (in-process state carried over): a's file changes.
  const change = { file: 'rooms/start.json', was: sha256(ROOM), ops: [{ path: ['x'], value: 1 }] };
  assert.equal((await ask(port, '/change', change)).status, 200);
  assert.equal(
    (await ask(port, '/change', { ...change, file: '../a/rooms/start.json' })).status,
    400,
  );
  assert.equal(readFileSync(join(a, 'rooms/start.json'), 'utf8'), ROOM);
  assert.notEqual(readFileSync(join(dir, 'worlds/b/rooms/start.json'), 'utf8'), ROOM);
});

// Break: with no remembered world, `--watch` is taken for the cartridge folder; a stray argument run.
test('bin/loka dev --watch with no remembered world prints the usage', (t) => {
  const { dir, a } = worlds(t);
  for (const args of [['--watch'], [a, '--x'], [a, '--watch', 'x']]) {
    const run = spawnSync(`${ROOT}bin/loka`, ['dev', ...args], {
      env: {
        ...process.env,
        LOKA_DEV_CARTRIDGE: join(dir, 'out/current.json'),
        LOKA_AUTHOR_PORT: '0',
      },
      encoding: 'utf8',
      timeout: 20_000, // a dev that starts watching fails here instead of hanging
    });
    assert.equal(run.status, 2, `${args} ${run.stderr}`);
  }
});
