// Toolbox rows W15 and FD9 on the compiled identity sampler (mechanics.md "Recognition and earned
// titles"): the square's hooded stranger gives its name when asked (a knows_name pair fact), a
// notice to tear (wanted) and a cloak rack (disguised for two game hours); the den grants the
// Houndbane title on entry; the gate guard engages a wanted, undisguised character.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { pending } from '../src/mechanics/dialogue/shared.ts';
import { value } from '../src/mechanics/fact.ts';
import { cartridgeOf, ctx, reload } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-identity-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/identity_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'identity_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'identity_sampler', cartridge_version: '0.0.1', kind, key }) as never;

const built = cartridgeOf(artifact);
const diagnostic = (edit: (c: any) => void) => {
  const r = reload(built, edit);
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
};
let n = 0;
function fresh(edit?: (c: any) => void) {
  const r = reload(built, edit);
  assert.ok(r.ok, JSON.stringify(r));
  n = 0;
  return newWorld(r.cartridge as Cartridge, ctx('4e5f6a7b-3f1b-4c2a-9e7d-6b5a4c3d2e44'), [1]);
}
function play(w: World, payload: object) {
  const id = `eeeeeeee-4444-4044-8044-${String(++n).padStart(12, '0')}`;
  const r = step(
    w,
    { id, world_context_id: w.context, payload: { actor_id: w.character, ...payload } } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return { w: r.world, d: r.decision as Extract<typeof r.decision, { kind: 'accepted' }> };
}
const go = (w: World, ...dirs: string[]) =>
  dirs.reduce((at, direction) => play(at, { type: 'move', direction }).w, w);
const perform = (w: World, action: string) => play(w, { type: 'perform', action }).w;
function wait(w: World, seconds: number) {
  const run_id = 'aaaaaaaa-0000-4000-8000-000000000097';
  const until = w.state.clock + seconds;
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
    } as never,
    ++n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const npc = (w: World, k: string) => w.entityIds[`${S}:npc/${k}`]!;
const names = (w: World, k: string) => {
  const v = gameView(w);
  return [
    v.entities.find((e) => e.id === npc(w, k))?.name,
    v.known_npcs?.find((e) => e.id === npc(w, k))?.name,
  ];
};
// Realm seam 1: a second character in the same world, with none of the player's facts or body.
const OTHER = 'char:other' as never;
const wanted = (w: World) => value(w, w.character, ref('fact', 'wanted'));
const lines = (d: { narration?: readonly { key: unknown }[] }) =>
  (d.narration ?? []).map((l) => l.key);

// Breaks: an NPC name read without the actor's facts (knownNpcs or the room list showing the base
// short after the stranger is named, also seen through an exit), a name read for world.character
// instead of the viewer (realm seam 1), or the pair fact written at the wrong subject.
test('the stranger is unnamed until it gives its name', () => {
  let w = fresh();
  assert.equal(gameView(w).actor_name, 'identity.name');
  assert.deepEqual(names(w, 'stranger'), ['npc.stranger.short', 'npc.stranger.short']);
  w = play(w, { type: 'talk', target_id: npc(w, 'stranger') }).w;
  const [continuation_id] = pending(w, w.character)!;
  const r = play(w, { type: 'choose', choice_id: 'ask_name', continuation_id });
  const changed = r.d.events.find((e: any) => e.payload.type === 'fact_changed')!.payload as any;
  assert.equal(changed.subject_id, npc(w, 'stranger'));
  assert.deepEqual(names(r.w, 'stranger'), [
    'npc.stranger.short_named',
    'npc.stranger.short_named',
  ]);
  const beyond = gameView(go(r.w, 'north')).exits.find((x) => x.direction === 'south')!.sight!;
  assert.equal(
    beyond.entities.find((e) => e.id === npc(w, 'stranger'))!.name,
    'npc.stranger.short_named',
  );
  // The other character also met the stranger (its own observation row) but never asked its name.
  const met = Object.values(r.w.state.observed_npcs!).find((o) => o.npc_id === npc(w, 'stranger'))!;
  const both = { ...r.w.state.observed_npcs, other: { ...met, actor_id: OTHER } };
  const other = gameView({ ...r.w, state: { ...r.w.state, observed_npcs: both } }, OTHER);
  assert.deepEqual(
    other.known_npcs?.map((e) => e.name),
    ['npc.stranger.short'],
  );
});

// Breaks: the title not granted on entry, variants read last-match (the title over the disguise),
// displayedName reading a status without the actor's body as target, actor_name read for
// world.character instead of the viewer (realm seam 1), or the status not expiring.
test('the den earns a title; a hood hides it for two game hours', () => {
  let w = go(fresh(), 'north');
  assert.equal(gameView(w).actor_name, 'identity.name_houndbane');
  w = perform(go(w, 'south'), 'don_hood');
  assert.equal(gameView(w).actor_name, 'identity.name_hooded');
  assert.equal(gameView(w, OTHER).actor_name, 'identity.name');
  w = wait(w, 7200);
  assert.equal(gameView(w).actor_name, 'identity.name_houndbane');
});

// Breaks: the guard's hostility ignoring the disguise (engages anyway) or the wanted check (engages
// an innocent), or the disguise clearing the wanted fact.
test('the guard collars a wanted character unless disguised', () => {
  const torn = perform(fresh(), 'tear_notice');
  const at = play(torn, { type: 'move', direction: 'east' }).d;
  const open = at.delta.ops.find((o) => o.op === 'encounter.open') as any;
  assert.equal(open?.npc_id, npc(torn, 'guard'));
  assert.ok(lines(at).includes('guard.collars'));
  const hooded = perform(perform(fresh(), 'tear_notice'), 'don_hood');
  const past = play(hooded, { type: 'move', direction: 'east' });
  assert.equal(
    past.d.delta.ops.some((o) => o.op === 'encounter.open'),
    false,
  );
  assert.equal(wanted(past.w), true);
  assert.equal(
    play(fresh(), { type: 'move', direction: 'east' }).d.delta.ops.some(
      (o) => o.op === 'encounter.open',
    ),
    false,
  );
});

// Breaks: a target-subject fact read in a variant whose target is the character's own body.
test('world.identity loader refusals', () => {
  assert.deepEqual(
    diagnostic((c) =>
      Object.assign(c.world.identity.name_variants[1].when.root, {
        fact: ref('fact', 'knows_name'),
        subject: 'target',
      }),
    ),
    ['FACT_SCOPE_UNSUPPORTED', '.cartridge.world.identity.name_variants[1].when.root.subject'],
  );
  assert.deepEqual(
    diagnostic((c) => delete c.world.identity),
    'loaded',
  );
  assert.equal(gameView(fresh((c) => delete c.world.identity)).actor_name, undefined);
});
