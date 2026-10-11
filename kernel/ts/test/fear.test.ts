// Toolbox row W21 on the compiled fear sampler: two goblins of one pack plan (6 HP, a sure hit for
// 1, flight below 25%) in the den, a burrow east inside their area; the player (10 HP) always hits
// for 2. A shout of "begone" applies `afraid` (a fear status) to each goblin that hears it.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import { refString, type Cartridge, type World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { activeStatuses } from '../src/mechanics/status/shared.ts';
import { sequence } from '../src/mechanics/reaction.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-fear-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/fear_sampler', file], {
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
const id = () => `eeeeeeee-2121-4121-8121-${String(++n).padStart(12, '0')}` as never;
function ok(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const play = (w: World, payload: object) =>
  ok(
    step(
      w,
      {
        id: id(),
        world_context_id: w.context,
        payload: { actor_id: w.character, ...payload },
      } as never,
      n,
    ),
  );
function round(w: World, by = 150) {
  const run_id = `aaaaaaaa-2121-4121-8121-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + by];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return ok(stepElapsed(w, { ...command, world_context_id: w.context } as never, n));
}
const hp = (w: World, e: string) => level(w, e as never, resourceRef(w, 'hp'));
const room = (w: World, e: string) => w.rooms[w.state.containers[e]!]?.title;
const npc = (w: World, key: string) => {
  const { id: cartridge_id, version: cartridge_version } = w.cartridge.manifest;
  return w.entityIds[refString({ cartridge_id, cartridge_version, kind: 'npc', key } as never)]!;
};
const fearful = (w: World, e: string) => activeStatuses(w, e as never).length > 0;
const slay = (w: World) => round(play(w, { type: 'attack', target_id: npc(w, 'chief') }));

/** A new game, moved into the den, and its two goblins in EntityId order. */
function den(c: Cartridge) {
  n = 0;
  const w = play(newWorld(c, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]), {
    type: 'move',
    direction: 'east',
  });
  const here = w.state.containers[w.body];
  const [a, b] = Object.keys(w.state.created ?? {})
    .filter((e) => w.state.created![e].origin.kind === 'spawned' && w.state.containers[e] === here)
    .sort();
  assert.ok(a && b, 'two goblins in the den');
  return { w, a, b };
}

/** Two rounds of a fight on the lower-id goblin, after `before` in the den. */
function fight(before: (w: World) => World, c = content) {
  const { w, a, b } = den(c);
  return { w: round(round(play(before(w), { type: 'attack', target_id: a }))), a, b };
}

// Breaks: combat behaviour ignores the fear status (the goblins fight on), reads it only below the
// hp threshold, or a feared goblin skips its turn instead of fleeing.
test('afraid goblins flee on their next turns; without fear they fight', () => {
  const calm = fight((w) => w);
  assert.deepEqual(
    [hp(calm.w, calm.w.body), hp(calm.w, calm.a), room(calm.w, calm.a), room(calm.w, calm.b)],
    [8, 2, 'room.den.title', 'room.den.title'],
    'each goblin strikes once; the player hits the first twice',
  );
  const { w, a, b } = fight((v) => play(v, { type: 'shout', word: 'begone' }));
  assert.deepEqual(
    [hp(w, w.body), hp(w, a), hp(w, b), room(w, a), room(w, b)],
    [10, 4, 6, 'room.burrow.title', 'room.burrow.title'],
    'round 1: hit, the first goblin flees; round 2: the second flees before the player strikes',
  );
  assert.deepEqual(
    Object.values(w.state.encounters ?? {}).map((e) => e.status),
    ['closed'],
  );
});

// Breaks: the leader's entity_died reaction lands on the dead victim (co_present ignored), on no
// one, or only on the goblin the player attacks next.
test('the chief falls: both goblins flee on their next turns; without the reaction they fight', () => {
  const reactions = Object.entries(content.reactions!).filter(([, r]) => r.key !== 'leader_fell');
  assert.equal(reactions.length, 1);
  const calm = fight(slay, { ...content, reactions: Object.fromEntries(reactions) });
  assert.deepEqual(
    [hp(calm.w, calm.w.body), hp(calm.w, calm.a), room(calm.w, calm.a), room(calm.w, calm.b)],
    [8, 2, 'room.den.title', 'room.den.title'],
  );
  const { w, a, b } = fight(slay);
  assert.equal(hp(w, npc(w, 'chief')), 0, 'one blow fells the chief before it strikes');
  assert.deepEqual(
    [hp(w, w.body), hp(w, a), hp(w, b), room(w, a), room(w, b)],
    [10, 4, 6, 'room.burrow.title', 'room.burrow.title'],
  );
});

// Breaks: co_present reaches the player's body (any holder kind, not NPCs only) or an NPC that
// declares the status immune (the guard: how an ally opts out).
test('the chief falls: the player and the immune guard are not afraid', () => {
  const { w, a, b } = fight(slay);
  assert.deepEqual(
    [w.body, npc(w, 'guard'), a, b].map((e) => fearful(w, e)),
    [false, false, true, true],
  );
});

// The writer-group edge (docs/system/mechanics.md, writer groups; writer_groups.test.ts): a shout
// frightens the goblins at T; the chief falls in a round at T+650 in the same wait as their afraid
// expiry at T+600, so the reaction rewrites rows that expiry wrote. Breaks: a co_present holder
// does not join the group its status rows already hold in the advance (the wait faults
// conflicting_write), or the one wait differs from the same play split at T+600.
test("the chief falls in the wait that ends the goblins' fear: one wait equals two", () => {
  const after = (split: boolean) => {
    const { w: shouted, a, b } = den(content);
    const T = shouted.state.clock;
    let w = play(round(play(shouted, { type: 'shout', word: 'begone' }), 500), {
      type: 'attack',
      target_id: npc(shouted, 'chief'),
    });
    w = split ? round(round(w, 100), 50) : round(w, 150);
    return [w.state.clock - T, ...[npc(w, 'chief'), a, b].map((e) => [hp(w, e), fearful(w, e)])];
  };
  assert.deepEqual(after(false), [650, [0, false], [6, true], [6, true]]);
  assert.deepEqual(after(true), after(false));
});

// Breaks: with no room (a status_expired on an unplaced holder) co_present matches every NPC that
// has no container (here the chief, unplaced) instead of none, so the delivery writes its row.
test('co_present with no room frightens no one', () => {
  const placed = den(content).w;
  const { [npc(placed, 'chief')]: _, ...containers } = placed.state.containers;
  const w = { ...placed, state: { ...placed.state, containers } } as World;
  const rule = { ...Object.values(content.reactions!).find((r) => r.key === 'leader_fell')! };
  const status = (rule.apply[0] as unknown as { status: never }).status;
  const on = { event: 'status_expired' } as const;
  const payload = {
    type: 'status_expired',
    body_id: 'ffffffff-0000-4000-8000-000000000000',
    status,
  };
  const cause = { id: 'c', logical_time: w.state.clock, payload } as never;
  const r = sequence(
    w,
    w.character,
    { ...rule, on } as never,
    cause,
    1,
    { n: 0 },
    () => 'j' as never,
  );
  assert.deepEqual(r && r.kind === 'accepted' ? r.delta.ops : r, []);
});

/** The sampler's artifact, edited and re-hashed, loaded: its first diagnostic's code and path. */
function reload(edit: (c: any) => void) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
}
const api = ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'];
const afraid = (c: any) => c.statuses['fear_sampler@0.0.1:status/afraid'];
const leader = '.cartridge.reactions["fear_sampler@0.0.1:reaction/leader_fell"]';
const fell = (c: any) => c.reactions['fear_sampler@0.0.1:reaction/leader_fell'].apply[0];

// Breaks (twin of test/loka/content_fear_test.exs): the loader admits a fear status or a
// co_present step (each alone) under API 1.49, or a co_present step that also names its holder.
// The sampler's load above fails if one without per_tick is refused.
test('fear and co_present need API 1.50; co_present names no holder', () => {
  const at149 = (c: any) => (c.manifest.requires.kernel_api.at_least = '1.49');
  assert.deepEqual(
    reload((c) => {
      at149(c);
      delete c.reactions['fear_sampler@0.0.1:reaction/leader_fell'];
    }),
    api,
  );
  assert.deepEqual(
    reload((c) => {
      at149(c);
      delete afraid(c).fear;
      afraid(c).per_tick = -1;
    }),
    api,
  );
  for (const [field, key] of [
    ['npc', 'guard'],
    ['item', 'ear'],
  ])
    assert.deepEqual(
      reload((c) => (fell(c)[field] = { ...fell(c).status, kind: field, key })),
      ['SCHEMA_VIOLATION', `${leader}.apply[0].${field}`],
    );
});
