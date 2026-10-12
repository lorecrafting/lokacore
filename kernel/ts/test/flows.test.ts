// Measured flows (cartridge.md "Measured flows (balance tool 2)"; kernel/ts/play/flows.ts) on the
// compiled standing sampler. Expected values are hand-read from cartridges/standing_sampler:
// Peg sells bread for 4 and buys it back for 1 (npcs/peg.json), her half-price discount is for
// friends only, and the player starts with nothing in hand.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { flows, worker, type Policy } from '../play/flows.ts';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, newWorld, step, type Cartridge } from '../src/index.ts';
import { gameView } from '../src/runtime/world.ts';
import { read } from './read.ts';
import { gen, loaded as artifactOf } from './sim.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-flows-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
const file = join(scratch, 'standing.json');
execFileSync('mix', ['loka.compile', 'cartridges/standing_sampler', file], {
  cwd: fileURLToPath(new URL('../../../', import.meta.url)),
  stdio: 'pipe',
});
const loaded = loadCartridge(readFileSync(file), INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const CLI = fileURLToPath(new URL('../play/flows.ts', import.meta.url));

// Buys Peg's bread at step 1, sells it back at step 2, waits one game hour, then stops.
const trade = (): Policy => {
  let i = 0;
  return function trade(w, view) {
    const peg = view.entities.find((e) => e.shop)!;
    const item_id = peg.shop![0]!.item_id;
    const steps = [
      { type: 'buy', provider_id: peg.id, item_id, quoted_price: 4 },
      { type: 'sell', provider_id: peg.id, item_id, quoted_price: 1 },
      { type: 'wait', until: w.state.clock + 3600 },
    ];
    return steps.slice(i, ++i);
  };
};

// Breaks: in and out swapped, coin read from every body (Peg's purse moves the other way), a step
// labelled by its type alone, the rate over the wrong hours, or the supply's player and purses
// mixed up. The player starts with 10 pennies (resources.json), Peg with 0 (npcs/peg.json): after
// the trade and one hour the player holds 10 - 4 + 1 = 7 and Peg 4 - 1 = 3, a net -3 in one hour.
test('a bought and resold bread shows as 4 out under buy and 1 in under sell', () => {
  const r = flows(content, { seeds: 1, days: 1, policy: trade() });
  assert.deepEqual(r.coin.by_source, { 'buy:bread': { out: 4 }, 'sell:bread': { in: 1 } });
  assert.deepEqual(r.items.by_source, { 'buy:bread': { in: 1 }, 'sell:bread': { out: 1 } });
  assert.deepEqual(r.coin.per_hour, { min: '-3.00', median: '-3.00', max: '-3.00' });
  assert.deepEqual(r.coin.supply, [
    { hour: 0, player: 10, purses: 0 },
    { hour: 1, player: 7, purses: 3 },
  ]);
});

// Breaks: a command repeated within the game hour, so an always-accepted scan that passes no time
// spends the whole step cap and the day is never reached; or the skip never reset at the next hour,
// so the scan runs once per run (25 calls), not once per hour. standing_sampler's calendar sets no
// units (3600 per hour, 24 hours): each hour is one scan and one wait, 2 calls, 48 in the day.
test('a command already played this game hour is skipped until the next hour', () => {
  let calls = 0;
  const idle: Policy = (w) => {
    calls++;
    return [{ type: 'scan' }, { type: 'wait', until: w.state.clock + 3600 }];
  };
  const r = flows(content, { seeds: 1, days: 1, policy: idle });
  assert.equal(r.coin.supply.at(-1)!.hour, 24);
  assert.equal(calls, 48);
});

// Breaks: the worker's rank dropped or reordered, so a talk or a take is tried before a sale.
test('the worker tries a sale before a take or a talk', () => {
  const w0 = newWorld(content, '1e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f2a' as never, [1, 2, 3, 4]);
  const peg = gameView(w0).entities.find((e) => e.shop)!;
  const item_id = peg.shop![0]!.item_id;
  const buy = {
    type: 'buy',
    actor_id: w0.character,
    provider_id: peg.id,
    item_id,
    quoted_price: 4,
  };
  const cid = 'dddddddd-5555-4333-8444-000000000001';
  const s = step(w0, { id: cid, world_context_id: w0.context, payload: buy } as never, 1);
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  for (let seed = 1; seed <= 8; seed++) {
    const types = worker(s.world, gameView(s.world), gen(seed), {}).map((p) => p.type);
    assert.ok(types.includes('talk') && types.includes('take'), types.join());
    assert.equal(types[0], 'sell', `seed ${seed}: ${types.join()}`);
  }
});

// Breaks: anything nondeterministic in the run (time, Math.random, host iteration order), or the
// CLI ignoring --seeds or --days.
// On the showcase, where the seed's generator decides which of its many offers come first. Also
// breaks: populations read from the wrong field, so no plan shows (its two plans each hold 2 at
// the start: cap and day_target 2 in cartridges/toolbox_showcase/populations); or the worker never
// passing the day (hours 0-24), because a refused Wait in this real-elapsed world or a repeatable
// conversation ends or spends its run.
test('the CLI prints the same canonical report as the same run in this process', () => {
  const kat = read('protocol/fixtures/toolbox_showcase_hash.json');
  const showcase = join(scratch, 'showcase.json');
  const text = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
  writeFileSync(showcase, text);
  const r = spawnSync('node', [CLI, showcase, '--seeds', '3', '--days', '1'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const here = flows(artifactOf(text).cartridge, { seeds: 3, days: 1 });
  assert.equal(r.stdout, `${encode(here as unknown as Json)}\n`);
  const plan = (key: string) => `toolbox_showcase@0.0.1:population/${key}`;
  const living = { [plan('goblins')]: 2, [plan('tilt_goblins')]: 2 };
  assert.deepEqual(here.populations[0], { hour: 0, living });
  assert.equal(here.coin.supply.at(-1)!.hour, 24);
});

// Breaks: a refused artifact played anyway, or refused without its diagnostic.
test('the CLI exits 1 with the diagnostic on a refused artifact', () => {
  const forged = join(scratch, 'forged.json');
  const artifact = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(forged, JSON.stringify({ ...artifact, content_hash: '0'.repeat(64) }));
  const r = spawnSync('node', [CLI, forged], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stderr).code, 'CONTENT_HASH_MISMATCH');
});
