// Numbers (cartridge.md#author-preview; kernel/ts/play/sim.ts). Expected values are hand-read from
// cartridges/needs_sampler: hunger starts at 10 and the hungry status takes 1 an hour; below 100%
// is peckish, below 50% starving. hp has no drain and a minimum of 1.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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
import { cellRow, hours, verdict, type Cell } from '../play/numbers.ts';
import { ROOT } from '../play/obs.ts';
import { levels, pools } from '../play/sim.ts';
import { INSTALLED, loadCartridge, type Cartridge } from '../src/index.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-sim-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
const file = join(scratch, 'needs.json');
execFileSync('mix', ['loka.compile', 'cartridges/needs_sampler', file], {
  cwd: ROOT,
  stdio: 'pipe',
});
const loaded = loadCartridge(readFileSync(file), INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const needs = loaded.cartridge as Cartridge;

test('pools: when a pool crosses each band and empties, and null for one that never does', () => {
  // Break: a band dated at its last sighting, an hour counted from clock zero or in the wrong unit,
  // a seed count of runs rather than of runs that emptied, or a never-empty pool reported as hour 0.
  const report = pools(needs, { seeds: 2, days: 1 });
  const row = (name: string) => report.pools.find((p) => p.pool.endsWith(`resource/${name}`));
  assert.equal(report.hours_played, 24);
  assert.deepEqual(row('hunger'), {
    pool: 'needs_sampler@0.0.1:resource/hunger',
    maximum: 10,
    start: 10,
    end: 0,
    lowest: 0,
    bands: [
      { band: 'fed', seeds: 2, hour: 0 },
      { band: 'peckish', seeds: 2, hour: 1 },
      { band: 'starving', seeds: 2, hour: 6 },
    ],
    empty: { seeds: 2, hour: 10 },
  });
  assert.equal(row('hp')?.empty, null);
});

test('levels: the step and the kills that pay for it; a foe worth no XP pays for nothing', () => {
  // Break: dividing the running total rather than this level's step, flooring so the kills fall
  // short, or dividing by a zero XP foe (Infinity encodes as nothing a writer can read).
  const npc = (key: string) => ({ cartridge: 'c', version: '1', kind: 'npc', key });
  const c = {
    world: {
      levelling: {
        thresholds: [30, 100],
        points_per_level: 2,
        kills: [
          { npc: npc('rat'), experience: 20 },
          { npc: npc('ghost'), experience: 0 },
          { npc: npc('mouse'), experience: 1 },
        ],
      },
    },
  } as unknown as Cartridge;
  const rows = levels(c)!;
  assert.deepEqual(
    rows.map((r) => [r.level, r.experience, r.step, r.points, r.kills.map((k) => k.needed)]),
    [
      [2, 30, 30, 2, [2, null, 30]],
      [3, 100, 70, 2, [4, null, 70]],
    ],
  );
  assert.equal(levels({ world: {} } as unknown as Cartridge), null);
});

test('bin/loka sim prints the numbers and leaves the cartridge as it was', () => {
  // Break: compiling next to the source, or a CLI that prints 0 where the cartridge has no levelling.
  const bin = join(scratch, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'mise'), '#!/bin/sh\nshift 2\nexec "$@"\n');
  chmodSync(join(bin, 'mise'), 0o755);
  const copy = join(scratch, 'copy');
  cpSync(join(ROOT, 'cartridges/needs_sampler'), copy, { recursive: true });
  const run = spawnSync(join(ROOT, 'bin/loka'), ['sim', copy, '--seeds', '1', '--days', '1'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /resource\/hunger: 10 to 0, lowest 0, max 10; empty h10 \(1\/1\)/);
  assert.match(
    run.stdout,
    /resource\/hp: 10 to 10, lowest 10, max 10; never empty in the 24 hours played/,
  );
  assert.match(run.stdout, /no levelling in this cartridge/);
  const diff = spawnSync('diff', ['-r', copy, join(ROOT, 'cartridges/needs_sampler')], {
    encoding: 'utf8',
  });
  assert.equal(diff.status, 0, diff.stdout);
});

test('fights: an unborn run is no fight, and a refusal is not a loss', () => {
  // Break: unborn runs counted as lost fights, so a foe nobody met reads "no level wins half" and a
  // half-born plan's rates fall by half; a refused foe reads as unbeaten; or the verdict takes a
  // cell that wins under half, or the wrong level.
  const cell = (level: number, n: number, wins: number, unborn?: number): Cell => ({
    level,
    build: 'none',
    n,
    wins,
    deaths: n - wins - (unborn ?? 0),
    fleds: 0,
    timeouts: 0,
    ...(unborn !== undefined && { unborn }),
  });
  const of = (...cells: Cell[]) => verdict({ cells });
  const refused: Cell = { level: 1, build: 'none', refused: 'not_visible' };

  assert.equal(of(cell(1, 8, 0, 8)), 'No fight happened: no member was born in 8 runs.');
  assert.deepEqual(cellRow(cell(1, 8, 0, 8)).slice(0, 3), [
    'level 1',
    'no fight: 8 of 8 unborn',
    '',
  ]);
  assert.equal(
    of(cell(1, 8, 2, 4)),
    'Wins half from level 1 (build none). 4 of 8 runs left out: no member born.',
  );
  assert.deepEqual(cellRow(cell(1, 8, 2, 4)), [
    'level 1 (4 unborn)',
    '50.00%',
    '50.00%',
    '0.00%',
    '0',
    'no win',
    'no win',
  ]);
  assert.equal(of(cell(1, 8, 3), cell(2, 8, 4)), 'Wins half from level 2 (build none).');
  assert.equal(of(cell(1, 8, 3)), 'No level wins half with any build.');
  // A cell with no fight cannot be the first win, however its zero compares.
  assert.equal(
    of(cell(1, 8, 0, 8), cell(2, 8, 4)).split('.')[0],
    'Wins half from level 2 (build none)',
  );
  assert.equal(of(refused, refused), 'Refused (not_visible): no fight was measured.');
  assert.equal(of(refused, cell(2, 8, 8)), 'Wins half from level 2 (build none).');
  assert.deepEqual(cellRow(refused).slice(0, 2), ['level 1', 'refused: not_visible']);
  assert.deepEqual(
    cellRow({ ...cell(1, 2, 2), rounds: { median: 7, min: 6, max: 8 } }).slice(5, 6),
    ['7'],
  );
  assert.deepEqual([hours(1), hours(24), hours(null)], ['1 hour', '24 hours', 'no hours']);
});

const sim = (...args: string[]) =>
  spawnSync(join(ROOT, 'bin/loka'), ['sim', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${join(scratch, 'bin')}:${process.env.PATH}` },
  });

test('bin/loka sim refuses bad flags and a bad cartridge in plain words', () => {
  // Break: a zero, a non-number or a stray argument run anyway; a failed compile read as an artifact;
  // a roomless cartridge ending in a stack trace.
  const copy = join(ROOT, 'cartridges/needs_sampler');
  for (const bad of [
    [copy, '--seeds', '0'],
    [copy, '--days', 'x'],
    [copy, '--seeds', '1.5'],
    [copy, 'stray'],
    [],
  ]) {
    const run = sim(...bad);
    assert.equal(run.status, 2, bad.join(' '));
    assert.match(run.stderr, /^usage: bin\/loka sim/);
  }
  // Break: the documented defaults drift from what the usage and the guide promise.
  const plain = sim(copy);
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stdout, /^pools: 8 seeds of 3 game days/);
  const broken = join(scratch, 'broken');
  cpSync(copy, broken, { recursive: true });
  writeFileSync(join(broken, 'cartridge.json'), '{');
  const failed = sim(broken);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /^not compiled: /);
  const roomless = sim(join(ROOT, 'cartridges/hello_sampler'));
  assert.equal(roomless.status, 1, roomless.stderr);
  assert.match(roomless.stderr, /no rooms/);
  assert.doesNotMatch(roomless.stderr, /TypeError/);
});
