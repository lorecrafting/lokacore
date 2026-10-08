// E2 S4: the pure-kernel rows of families 4, 6 and 7 on the frozen synthetic cartridge (the
// durable scenarios are mobile/authority/local-story/r9c_creatures_transport.test.ts). Literals
// cite content under cartridges/r9c_interactions/ (owner decision (d): update in place).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { World } from '../src/index.ts';
import type { DefinitionRef } from '../src/contracts.gen.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { read } from './read.ts';

const pin = read('protocol/fixtures/r9c_interactions_hash.json');
const ID: Record<string, string> = read('protocol/fixtures/r9c_interactions_ids.json');
const ref = (kind: string, name: string) =>
  ({
    cartridge_id: 'r9c_interactions',
    cartridge_version: '0.0.1',
    kind,
    key: name,
  }) as unknown as DefinitionRef;
const run_id = 'bbbbbbbb-0000-4000-8000-000000000004';

// A fey_touched character (DEX 10, attributes.json) engaged with the first hound in hound_run.
function engaged(seed: number[]) {
  const hash = createHash('sha256').update(pin.canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${hash}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  let w: World = newWorld(
    loaded.cartridge as never,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    seed as never,
  );
  let n = 0;
  const invoke = (world: World, action_key: string, target_ids: string[], input: object) => {
    const id = identify('s4', world.character, {
      invocation_id: `cccccccc-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: world.character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(id.kind, 'identified');
    const command = resolve(world, id as never);
    return 'kind' in command
      ? { world, decision: command }
      : step(world, command as never, n, action_key as never);
  };
  const press = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const r = invoke(w, action_key, target_ids, input);
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    w = r.world;
  };
  press('choose_ancestry', [], { ancestry: 'fey_touched' });
  // ferry_landing (cartridge.json entry) south, south, east: hound_run.
  for (const direction of ['south', 'south', 'east']) press('move', [], { direction });
  press('attack', [ID['population/fen_hounds/slot1/member']!]);
  const elapse = (world: World, until: number) => {
    const from = world.state.clock;
    return stepElapsed(
      world,
      {
        id: elapsedCommandId(run_id, world.context, from, until) as never,
        world_context_id: world.context,
        payload: { type: 'elapsed', actor_id: world.character, run_id, from, until },
      },
      ++n,
    );
  };
  return { w, invoke, elapse };
}

// xoshiro128 state advance, written from the published algorithm (protocol RNG), not the kernel.
const next = ([a, b, c, d]: number[]) => {
  const t = (b! << 9) >>> 0;
  c! ^= a!;
  d! ^= b!;
  b! ^= c!;
  a! ^= d!;
  c! ^= t;
  return [a! >>> 0, b! >>> 0, c! >>> 0, ((d! << 11) | (d! >>> 21)) >>> 0];
};

// Breaks: a refused input during the hound fight consumes RNG, or the round draws for damage
// after a missed accuracy roll (mechanics.md combat@1: uniform(100) per eligible attack; only a
// hit with variable damage draws again; fixed damage draws nothing). Focused rows:
// combat_flee.test.ts:39/:62; this is the standing r9c integration row.
test('family 4: a refused move draws nothing; a missed round draws once per attack', () => {
  // Regression pin: seed [1, 2654435761, 3, 4] gives a player miss in the first round.
  const { w, invoke, elapse } = engaged([1, 2654435761, 3, 4]);
  assert.deepEqual(w.state.rng, [1, 2654435761, 3, 4]); // Attack itself draws nothing
  const refused = invoke(w, 'move', [], { direction: 'west' });
  assert.equal(refused.decision.kind, 'rejected');
  assert.equal(refused.world, w);
  // Round 1 at 64950 (interval 150): player miss (1 draw, 75% for 1-2), hound hit for fixed 1
  // (1 draw, fen_hound.json chance 80 damage 1..1).
  const round = elapse(w, 64950);
  assert.equal(round.decision.kind, 'accepted');
  if (round.decision.kind !== 'accepted') return;
  assert.deepEqual(
    round.decision.events
      .filter((e) => e.payload.type === 'attack_result')
      .map((e: any) => [e.payload.attacker_id === w.body, e.payload.hit]),
    [
      [true, false],
      [false, true],
    ],
  );
  assert.deepEqual(round.world.state.rng, next(next(w.state.rng)));
  assert.deepEqual(round.world.state.rng, [3150818550, 1861444101, 2654436790, 3601469743]);
});

// Breaks: Bandage admission checks only that the skill was learned, not its current DEX
// qualification (skills/bandage.json dex at_least 10), so an unqualified actor spends the item.
// r9c content cannot lower DEX (PM ruling 2026-10-08), so this state is set in the test.
test('family 4: a learned but DEX-9 actor cannot Bandage; at DEX 10 the same item cures', () => {
  const { w, invoke, elapse } = engaged([19, 2, 3, 4]);
  const first = elapse(w, 64950).world; // regression pin: this round's hound hit bleeds
  const body = first.body,
    bandage = ID['item/bandage_01']!;
  const generation = first.state.bleeds![body]!.generation;
  const dex = (value: number) =>
    ({
      ...first,
      state: {
        ...first.state,
        containers: { ...first.state.containers, [bandage]: body },
        facts: {
          ...first.state.facts,
          [key({
            kind: 'fact',
            fact: ref('fact', 'skill_bandage'),
            scope: { kind: 'player', character_id: first.character },
          } as never)]: true,
        },
        characters: {
          [first.character]: {
            ...first.state.characters![first.character]!,
            attributes: {
              ...first.state.characters![first.character]!.attributes,
              'r9c_interactions@0.0.1:attribute/dex': value,
            },
          },
        },
      },
    }) as World;
  const offer = (world: World) =>
    gameView(world)
      .inventory.find((e) => e.id === bandage)
      ?.actions.find((a) => a.action_key === 'bandage')?.available;
  const low = dex(9);
  assert.equal(offer(low), undefined); // in the fight, an unusable Bandage is not offered
  const refused = invoke(low, 'bandage', [bandage], { effect_generation: generation });
  assert.equal(refused.decision.kind, 'rejected');
  assert.equal(refused.world.state, low.state);
  // Control: the identical state at DEX 10 is offered and consumes exactly this bandage.
  const ok = dex(10);
  assert.equal(offer(ok), true);
  const cured = invoke(ok, 'bandage', [bandage], { effect_generation: generation });
  assert.equal(cured.decision.kind, 'accepted', JSON.stringify(cured.decision));
  assert.equal(cured.world.state.containers[bandage as never], first.consumed);
  assert.deepEqual(cured.world.state.rng, first.state.rng);
});
