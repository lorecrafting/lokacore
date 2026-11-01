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
        ],
      },
    },
  } as unknown as Cartridge;
  const rows = levels(c)!;
  assert.deepEqual(
    rows.map((r) => [r.level, r.experience, r.step, r.points, r.kills.map((k) => k.needed)]),
    [
      [2, 30, 30, 2, [2, null]],
      [3, 100, 70, 2, [4, null]],
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
  assert.match(run.stdout, /resource\/hp: 10 to 10, lowest 10, max 10; never empty in 1 days/);
  assert.match(run.stdout, /no levelling in this cartridge/);
  const diff = spawnSync('diff', ['-r', copy, join(ROOT, 'cartridges/needs_sampler')], {
    encoding: 'utf8',
  });
  assert.equal(diff.status, 0, diff.stdout);
});
