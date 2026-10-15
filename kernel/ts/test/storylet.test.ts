// Toolbox row FD3 on the compiled storylet sampler (mechanics.md Storylet deck). Expected draws
// are computed outside the kernel: printf '<actor>:<room key>:<hour index>' | shasum -a 256, the
// first 8 hex digits modulo the holding weights (pickpocket 1, stranger_beckons 3 while the
// stranger's window holds, hours 0 to 2), walked in key order (r 0 pickpocket, 1..3 stranger).
//   market:0 0d1b735c -> 0 pickpocket    market:1 ee565cd2 -> 2 stranger_beckons
//   market:10 7120170e -> 2 stranger_beckons (clock 1000: absolute hour 10, not hour of day 0)
//   lane:1 48d6ef8f -> 3 (stranger_beckons only if its rooms were ignored)
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-storylet-sampler-'));
let artifact: any;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/storylet_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = JSON.parse(readFileSync(file, 'utf8'));
} finally {
  rmSync(scratch, { recursive: true });
}
const sorted = (v: any): any =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted(v[k])]),
        )
      : v;
// The sampler, mutated by f and re-hashed over sorted-key JSON (never by the kernel).
const load = (f: (c: any) => void = () => {}) => {
  const c = structuredClone(artifact.cartridge);
  f(c);
  const text = JSON.stringify(sorted(c));
  const h = createHash('sha256').update(text).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`),
    INSTALLED,
  );
};
const loaded = load();
assert.ok(loaded.ok, JSON.stringify(loaded));
const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '6c8e0a2b-4d6f-4b8c-8e0a-5b7d9f1a3c5e' as never,
  [1, 2, 3, 4],
);
const ACTOR = '8ac2b4bc-3128-8362-b1ef-133a080388da';
assert.equal(fresh.character, ACTOR); // the pinned hashes above name this actor
const at = (clock: number, w: World = fresh): World => ({ ...w, state: { ...w.state, clock } });
let n = 0;
function run(w: World, payload: object) {
  const id = `aaaaaaaa-0707-4007-8007-${String(++n).padStart(12, '0')}`;
  const r = step(
    w,
    { id, world_context_id: w.context, payload: { actor_id: ACTOR, ...payload } } as never,
    0,
  );
  return { world: r.world, decision: r.decision as any };
}
const storylets = ['old_friend', 'pickpocket', 'stranger_beckons'];
// The drawn card and the storylets the place lists.
const drawn = (w: World) => {
  const v = gameView(w, ACTOR as never) as any;
  return [v.storylet, v.actions.filter((a: any) => storylets.includes(a.action_key))];
};

// Breaks: the pick ignores weight or the hour index (hour of day instead), the view lists every
// holding storylet, or the rooms filter is dropped.
test('one card per actor, room and hour index; the view lists only it', () => {
  for (const [clock, key] of [
    [0, 'pickpocket'],
    [100, 'stranger_beckons'],
    [300, 'pickpocket'], // the stranger's window is hours 0 to 2: the deck is pickpocket alone
    [1000, 'stranger_beckons'],
  ] as const) {
    const [card, listed] = drawn(at(clock));
    assert.equal(card, key, `clock ${clock}`);
    assert.deepEqual(
      listed.map((a: any) => [a.action_key, a.available]),
      [[key, true]],
    );
  }
  const lane = run(at(100), { type: 'move', direction: 'east' });
  assert.equal(lane.decision.kind, 'accepted');
  assert.equal(drawn(lane.world)[0], 'pickpocket');
});

// Breaks: a perform of a storylet that is not the pick (or names a target) is accepted, or
// accepting the pick does not start the storylet's scene through its action start.
test('only the drawn storylet is performed; it starts its scene and leads to the quest', () => {
  const w = at(100);
  assert.deepEqual(run(w, { type: 'perform', action: 'pickpocket' }).decision, {
    kind: 'rejected',
    error: { code: 'invalid_state' },
  });
  const named = run(w, { type: 'perform', action: 'stranger_beckons', target_id: ACTOR });
  assert.deepEqual(named.decision.error, { code: 'invalid_target' });
  let r = run(w, { type: 'perform', action: 'stranger_beckons' });
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const v = gameView(r.world, ACTOR as never) as any;
  assert.equal(v.scene.scene.key, 'stranger');
  assert.equal(v.storylet, undefined); // the modal scene hides the place's actions
  for (let i = 0; i < 3 && r.decision.kind === 'accepted'; i++) {
    const shown = (gameView(r.world, ACTOR as never) as any).scene;
    if (shown) r = run(r.world, { type: 'continue', scene: shown.scene, line: shown.index });
  }
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const after = gameView(r.world, ACTOR as never) as any;
  assert.equal(after.scene, undefined);
  assert.equal(after.storylet, 'pickpocket'); // the stranger's scene fact now refuses it
  assert.ok(after.actions.some((a: any) => a.action_key === 'stranger_errand' && a.available));
});

const PICK = '.cartridge.recipes["storylet_sampler@0.0.1:recipe/pickpocket"]';
const refused = (f: (c: any) => void) => {
  const r = load(f) as any;
  assert.equal(r.ok, false);
  return [r.diagnostic.code, r.diagnostic.path];
};
// Breaks (twin of content_storylet_test.exs): the loader accepts a storylet below 1.92, a storylet
// room that names no room, a storylet target outside its schema bounds, or a scene action start naming one of room and detail.
test('the loader refuses storylets below 1.92, unknown rooms, weight 0 and half-placed starts', () => {
  const pick = (c: any) => c.recipes['storylet_sampler@0.0.1:recipe/pickpocket'];
  assert.deepEqual(
    refused((c) => (c.manifest.requires.kernel_api.at_least = '1.91')),
    ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
  );
  assert.deepEqual(
    refused((c) => pick(c).target.rooms.push({ ...pick(c).target.rooms[0], key: 'nowhere' })),
    ['UNRESOLVED_REFERENCE', `${PICK}.target.rooms[2]`],
  );
  // Each RecipeTarget storylet bound (action.schema.json): weight 1..100, rooms 1..16, no extra key.
  for (const [f, code] of [
    [(t: any) => (t.weight = 0), 'SCHEMA_VIOLATION'],
    [(t: any) => (t.weight = 101), 'SCHEMA_VIOLATION'],
    [(t: any) => (t.rooms = []), 'SCHEMA_VIOLATION'],
    [(t: any) => (t.rooms = Array(17).fill(t.rooms[0])), 'SCHEMA_VIOLATION'],
    [(t: any) => (t.room = t.rooms[0]), 'UNKNOWN_FIELD'],
  ] as const)
    assert.equal(refused((c) => f(pick(c).target))[0], code, String(f));
  const scene = 'storylet_sampler@0.0.1:scene/stranger';
  assert.deepEqual(
    refused((c) => (c.scenes[scene].on.detail = 'stall')),
    ['SCHEMA_VIOLATION', `.cartridge.scenes["${scene}"].on`],
  );
});

// Breaks: the view drops a drawn storylet on cooldown instead of listing it unavailable (ruling E).
test('a drawn storylet on cooldown is listed unavailable', () => {
  const c = load((c) => (c.recipes['storylet_sampler@0.0.1:recipe/pickpocket'].cooldown = 500));
  assert.ok(c.ok, JSON.stringify(c));
  const w = newWorld(c.cartridge as Cartridge, fresh.context, [1, 2, 3, 4]);
  const r = run(w, { type: 'perform', action: 'pickpocket' });
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const [card, listed] = drawn(r.world);
  assert.equal(card, 'pickpocket');
  assert.deepEqual(
    listed.map((a: any) => [a.action_key, a.available]),
    [['pickpocket', false]],
  );
});
