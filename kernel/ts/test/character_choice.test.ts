// Ancestry choice (attributes@1 character creation) on the derived sampler, with the optional
// ancestry fields (skill, faction, dark_sight) added inline. Expected values are hand-computed
// from the sampler's starts (str 5, dex 10, con 10) and modifiers (strong +10, nimble +5, hardy +6).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { dark, illuminated } from '../src/mechanics/light/shared.ts';
import { sight } from '../src/mechanics/movement/rule.ts';
import { holds } from '../src/mechanics/policy.ts';
import { status } from '../src/mechanics/skills.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { ancestrySource as source } from './derived_fixture.ts';
import { ctx } from './harness.ts';

const ref = (kind: string, name: string) =>
  ({ cartridge_id: 'derived_sampler', cartridge_version: '0.0.1', kind, key: name }) as never;
const named = (kind: string, name: string) => `derived_sampler@0.0.1:${kind}/${name}`;

const load = (c: object) => {
  const canonical = encode(c as never);
  const hash = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${hash}"}`),
    INSTALLED,
  );
};
const loaded = load(source());
assert.ok(loaded.ok, JSON.stringify(loaded));
const fresh = () =>
  newWorld(
    loaded.cartridge as Cartridge,
    ctx('0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'),
    [1, 2, 3, 4],
  );
const command = (w: World, payload: object) =>
  ({
    id: '11111111-2222-4333-8444-555555555555',
    world_context_id: w.context,
    payload: { actor_id: w.character, ...payload },
  }) as never;
const choose = (w: World, ancestry: string) =>
  step(w, command(w, { type: 'choose_ancestry', ancestry }), 1);

// Breaks: trusted elapsed bypasses the D11 gate (world time must start at selection), or the exit
// view gives a different refusal than player admission before selection.
test('trusted elapsed refuses before ancestry choice and advances the clock after it', () => {
  const w = fresh();
  const run = '6f6f6f6f-1111-4222-8333-444444444444';
  const until = w.state.clock + 60;
  const span = (context = w.context) =>
    ({
      id: elapsedCommandId(run, context, w.state.clock, until),
      world_context_id: context,
      payload: { type: 'elapsed', actor_id: w.character, run_id: run, from: w.state.clock, until },
    }) as never;
  const early = stepElapsed(w, span(), 1);
  assert.deepEqual(early.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(early.world, w);
  const forged = { ...(span() as object), id: '00000000-0000-4000-8000-000000000002' } as never;
  assert.deepEqual(stepElapsed(w, forged, 1).decision, {
    kind: 'rejected',
    error: { code: 'permission_denied' },
  });
  const foreign = '00000000-0000-4000-8000-000000000001' as never;
  assert.deepEqual(stepElapsed(w, span(foreign), 1).decision, {
    kind: 'rejected',
    error: { code: 'not_found' },
  });
  const exit = gameView(w).exits[0];
  assert.ok(exit && !exit.available);
  assert.equal(exit.reason.code, 'invalid_state');
  const chosen = choose(w, 'strong');
  assert.equal(chosen.decision.kind, 'accepted');
  const advanced = stepElapsed(chosen.world, span(), 2);
  assert.equal(advanced.decision.kind, 'accepted', JSON.stringify(advanced.decision));
  assert.equal(advanced.world.state.clock, until);
});

// Breaks: a fresh actor can play without a choice, a choice writes only part of the character,
// or a second selection rerolls the saved values and inherited effects.
test('one creation receipt saves the selected values and effects exactly once', () => {
  const expected = [
    ['strong', [15, 10, 10], true, -2],
    ['nimble', [5, 15, 10], false, 0],
    ['hardy', [5, 10, 16], false, 0],
  ] as const;
  for (const [ancestry, values, learned, standing] of expected) {
    const w = fresh();
    assert.equal(gameView(w).ancestry_choices?.length, 3);
    const direction = gameView(w).exits[0].direction;
    assert.deepEqual(step(w, command(w, { type: 'move', direction }), 1).decision, {
      kind: 'rejected',
      error: { code: 'invalid_state' },
    });
    const selected = choose(w, ancestry);
    assert.equal(selected.decision.kind, 'accepted', ancestry);
    const saved = selected.world.state.characters?.[w.character];
    assert.equal(saved?.ancestry, ancestry);
    assert.deepEqual(
      ['str', 'dex', 'con'].map((a) => saved?.attributes[named('attribute', a)]),
      values,
    );
    assert.equal(gameView(selected.world).ancestry, ancestry);
    assert.equal(gameView(selected.world).ancestry_choices, undefined);
    assert.equal(
      selected.decision.kind === 'accepted' &&
        selected.decision.delta.ops.filter((o) => o.op === 'character.select').length,
      1,
    );
    assert.equal(
      status(selected.world, w.character, ref('skill', 'swim'), { n: 0 }).acquired,
      learned,
    );
    const at = key({
      kind: 'fact',
      fact: ref('fact', 'standing'),
      scope: { kind: 'player', character_id: w.character },
    });
    assert.equal(selected.world.state.facts?.[at] ?? 0, standing);
    const second = choose(selected.world, 'strong');
    assert.deepEqual(second.decision, {
      kind: 'rejected',
      error: { code: 'unsupported_capability' },
    });
    assert.equal(second.world, selected.world);
  }
});

// Breaks: stat_compare reads the definition start (str 5) instead of the saved actor value.
test('saved str 15 passes a str 15 policy while nimble keeps str 5', () => {
  for (const [ancestry, passed] of [
    ['strong', true],
    ['nimble', false],
  ] as const) {
    const w = fresh();
    const policy = { op: 'stat_compare', attribute: ref('attribute', 'str'), at_least: 15 };
    assert.equal(holds(choose(w, ancestry).world, w.character, policy as never), passed);
  }
});

// Breaks: ancestry dark sight is ignored (hardy stays dark), granted to every ancestry, turned
// into physical light, or not applied to the sight of an adjacent dark room.
test('hardy sees a dark room locally and next door while physical light stays off', () => {
  const darkened = (w: World) =>
    ({
      ...w,
      rooms: Object.fromEntries(
        Object.entries(w.rooms).map(([id, r]) => [
          id,
          { ...r, dark_description: 'ancestry.hardy.label' },
        ]),
      ),
    }) as World;
  const yard = fresh().roomIds[named('room', 'yard')];
  const seen = ['hardy', 'nimble'].map((ancestry) => {
    const w = darkened(choose(fresh(), ancestry).world);
    const east = sight(w, w.body).find((s) => s.direction === 'east');
    return [dark(w, w.character), illuminated(w, w.character), east?.room === yard];
  });
  assert.deepEqual(seen, [
    [false, false, true],
    [true, false, false],
  ]);
});

// Breaks: a syntactically valid ancestry with an unresolved attribute, wrong skill kind
// or unavailable description reaches creation without loader refusal.
test('loader refuses invalid authored ancestry bindings', () => {
  const refused = (edit: (c: any) => void) => {
    const c = source();
    edit(c);
    const r = load(c);
    return r.ok ? 'loaded' : r.diagnostic.code;
  };
  assert.deepEqual(
    [
      () => {},
      (c: any) => (c.ancestries.strong.attribute.key = 'missing'),
      (c: any) => (c.ancestries.strong.skill.kind = 'item'),
      (c: any) => (c.ancestries.hardy.description = 'missing'),
    ].map(refused),
    ['loaded', 'UNRESOLVED_REFERENCE', 'UNRESOLVED_REFERENCE', 'UNRESOLVED_REFERENCE'],
  );
});
