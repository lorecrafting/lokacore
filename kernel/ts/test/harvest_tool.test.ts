// Toolbox row 19 on the compiled harvest sampler: the mine's ore seam (two lumps of ore) declares
// harvest.tool {tag: sharp}. Mining needs a held sharp item: the pickaxe (metal, sharp), not the
// wooden stick and not the pickaxe on the floor; the seam depletes after two lumps.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import { acquisition } from '../src/mechanics/skills.ts';
import { check } from '../src/runtime/invariants.ts';
import { resolved } from '../src/commands/actions.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-harvest-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/harvest_sampler', file], {
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

let n = 0;
const play = (w: World, payload: object) =>
  step(
    w,
    {
      id: `eeeeeeee-4444-4444-8444-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
const C = { cartridge_id: 'harvest_sampler', cartridge_version: '0.0.1' };
const item = (w: World, key: string) => w.entityIds[`harvest_sampler@0.0.1:item/${key}`]!;
const seam = (w: World) => Object.keys(w.details)[0];
const take = (w: World, key: string) => {
  const r = play(w, { type: 'take', item_id: item(w, key) });
  assert.equal(r.decision.kind, 'accepted');
  return r.world;
};
const mine = (w: World) => play(w, { type: 'harvest', target_id: seam(w) });
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
// The `action` entry (the seam's Harvest by default) in the GameView, wherever it is listed.
const offer = (w: World, action = 'harvest') => {
  let found: { available: boolean; reason?: { code: string } } | undefined;
  JSON.stringify(gameView(w), (_, v) => (v?.action_key === action ? (found = v) : v));
  assert.ok(found, `${action} offered`);
  return found;
};
const ore = (w: World) => ['ore_01', 'ore_02'].map((k) => w.state.containers[item(w, k)]);
const fresh = () =>
  newWorld(content, '2c6e1a9b-7d3f-4e5a-8b1c-0f2e4d6a8c1b' as never, [1, 2, 3, 4]);
const held = () => take(fresh(), 'pickaxe');
const wear = (w: World, k: string) => play(w, { type: 'wear', item_id: item(w, k) }).world;
const sacked = () => {
  const w = take(held(), 'sack');
  return play(w, { type: 'put', item_id: item(w, 'pickaxe'), container_id: item(w, 'sack') }).world;
};
const whittle = (w: World) =>
  play(w, {
    type: 'perform',
    action: 'whittle',
    item_id: item(w, 'pickaxe'),
    target_id: item(w, 'stick'),
  });

// Breaks: the tool gate is skipped (empty hands, the stick or the pickaxe on the floor mine ore),
// or the offer's code differs from the one step returns.
test('without a held sharp tool the seam refuses, with the same code offered, and keeps its ore', () => {
  const w = fresh();
  const room = w.state.containers[w.body];
  for (const x of [w, take(w, 'stick')]) {
    assert.equal(code(mine(x)), 'invalid_state');
    assert.equal(offer(x).reason?.code, 'invalid_state');
    assert.equal(x.state.containers[item(x, 'pickaxe')], room);
    assert.deepEqual(ore(x), [room, room]);
  }
});

// Breaks: a held pickaxe is refused, mining takes no item or the wrong one, or the seam never
// depletes (a third lump appears).
test('with the pickaxe held the seam yields each lump once, then is empty', () => {
  let w = take(fresh(), 'pickaxe');
  const room = w.state.containers[w.body];
  assert.equal(offer(w).available, true);
  let r = mine(w);
  assert.equal(r.decision.kind, 'accepted');
  w = r.world;
  assert.deepEqual(ore(w), [w.body, room]);
  w = mine(w).world;
  assert.deepEqual(ore(w), [w.body, w.body]);
  r = mine(w);
  assert.equal(code(r), 'not_found');
  assert.equal(offer(w).reason?.code, 'not_found');
});

// Breaks: careful harvest skips the gate (the mutant `!method && detail.harvest.tool`), or its
// offer shows another code; the positive control shows the gate, not the skill, refused.
test('careful harvest of the gated seam is refused without the tool, accepted with it', () => {
  const learned = (w: World): World => {
    const fact = acquisition({ ...C, kind: 'skill', key: 'mining' } as never);
    const at = key({ kind: 'fact', fact, scope: { kind: 'player', character_id: w.character } });
    return { ...w, state: { ...w.state, facts: { ...w.state.facts, [at]: true } } };
  };
  const careful = (w: World) => play(w, { type: 'harvest', target_id: seam(w), method: 'careful' });
  const w = learned(fresh());
  assert.equal(code(careful(w)), 'invalid_state');
  assert.equal(offer(w, 'mine_carefully').reason?.code, 'invalid_state');
  const r = careful(take(w, 'pickaxe'));
  assert.equal(r.decision.kind, 'accepted');
  assert.deepEqual(ore(r.world), [r.world.body, r.world.body]);
});

// Breaks: the held-tool rule (lookups.ts toolHeld) refuses a wielded pickaxe (in a slot holder,
// which reach refuses) or one in a carried open sack, for the harvest gate or for the G4 whittle
// recipe (tool {tag: sharp}) on the stick; or a wielded tool lacks its whittle offer.
test('a wielded pickaxe, or one in a carried open sack, mines and whittles', () => {
  for (const w of [wear(held(), 'pickaxe'), sacked()]) {
    assert.notEqual(w.state.containers[item(w, 'pickaxe')], w.body);
    assert.equal(mine(w).decision.kind, 'accepted');
    assert.equal(code(whittle(w)), 'accepted');
  }
  assert.equal(offer(wear(held(), 'pickaxe'), 'whittle').available, true);
});

// Breaks: a tool in a worn sack counts as held (PM decision, loka-kgd.84): step would accept a
// whittle the GameView never lists (worn entries list no contents), which the invariant refuses.
test('a pickaxe in a worn sack is not held: refused, unlisted, and the view agrees', () => {
  const w = wear(sacked(), 'sack');
  assert.equal(code(mine(w)), 'invalid_state');
  const r = whittle(w);
  assert.equal(code(r), 'not_present');
  const resolves = Object.fromEntries(
    Object.values(resolved(w, w.character)).map((a) => [a.key, a.command]),
  );
  const command = {
    payload: {
      type: 'perform',
      action: 'whittle',
      item_id: item(w, 'pickaxe'),
      target_id: item(w, 'stick'),
    },
  };
  const observation = { view: gameView(w), command, decision: r.decision, resolves };
  assert.ok(check('gameview_agrees_with_admission', observation));
});

// Breaks: the loader admits a tool gate under kernel_api 1.51 or without tags@1 (twin of
// test/loka/content_harvest_tool_test.exs).
test('loader: a harvest tool needs kernel_api 1.52 and tags@1', () => {
  const reload = (edit: (c: any) => void) => {
    const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
    edit(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  const at = '.cartridge.rooms["harvest_sampler@0.0.1:room/mine"].details.seam.harvest';
  assert.deepEqual(
    reload((c) => (c.manifest.requires.kernel_api.at_least = '1.51')),
    ['KERNEL_API_RANGE_INVALID', at],
  );
  assert.deepEqual(
    reload((c) => {
      delete c.manifest.requires.capabilities.tags;
      delete c.lock.capabilities.tags;
      for (const k of ['pickaxe', 'stick']) delete c.items[`harvest_sampler@0.0.1:item/${k}`].tags;
      delete c.recipes['harvest_sampler@0.0.1:recipe/whittle']; // its has_tag would fault first
    }),
    ['UNDECLARED_CAPABILITY', `${at}.tool`],
  );
});
