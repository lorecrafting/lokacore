// Toolbox row 46 on the compiled codex sampler: a badge from visit counts (reactions, no counter
// row), read books in the lore topics, and the GameView deduction offer from two known topics.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-codex-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/codex_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const fresh = () =>
  newWorld(content, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
let n = 0;
const act = (w: World, p: object) => {
  n += 1;
  const id = `cccccccc-4646-4333-8444-${String(n).padStart(12, '0')}`;
  const r = step(
    w,
    { id, world_context_id: w.context, payload: { actor_id: w.character, ...p } } as never,
    n,
  );
  return r;
};
const ok = (w: World, p: object) => {
  const r = act(w, p);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const walk = (w: World, ...dirs: string[]) =>
  dirs.reduce((at, direction) => ok(at, { type: 'move', direction }), w);
const known = (w: World) => (gameView(w).topics ?? []).map((t) => t.label);
const read = (w: World, k: string) => {
  const id = w.entityIds[`codex_sampler@0.0.1:item/${k}`];
  return ok(ok(w, { type: 'take', item_id: id }), { type: 'read', target_id: id });
};

// Breaks: the badge granted before the fifth room (a missing visited_count clause), or never
// (the reaction's when reading the visits before the entry it reacts to).
test('the wanderer badge appears on entering the fifth room, not before', () => {
  const four = walk(fresh(), 'north', 'south', 'east', 'west', 'south', 'north');
  assert.deepEqual(known(four), []);
  assert.deepEqual(known(walk(four, 'west')), ['topic.wanderer']);
});

// Breaks: a deduction offered before both topics are known, offered again once its topic is
// known, its sources unlisted, or the recipe repeatable.
test('reading two books offers the smugglers deduction, granted once', () => {
  const study = walk(fresh(), 'south');
  const one = walk(read(study, 'carters_note'), 'north', 'west');
  assert.deepEqual(known(one), ['topic.missing_cart']);
  assert.equal(gameView(one).deductions, undefined);
  const both = read(one, 'mill_ledger');
  assert.deepEqual(known(both), ['topic.mill', 'topic.missing_cart']);
  assert.deepEqual(gameView(both).deductions, [
    {
      action: 'deduce_smugglers',
      label: 'actions.deduce_smugglers',
      from: ['topic.mill', 'topic.missing_cart'],
    },
  ]);
  const solved = ok(both, { type: 'perform', action: 'deduce_smugglers' });
  assert.deepEqual(known(solved), ['topic.mill', 'topic.missing_cart', 'topic.smugglers']);
  assert.equal(gameView(solved).deductions, undefined);
  assert.equal(
    act(solved, { type: 'perform', action: 'deduce_smugglers' }).decision.kind,
    'rejected',
  );
});
