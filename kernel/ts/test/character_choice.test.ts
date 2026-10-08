import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, newWorld, step, stepElapsed } from '../src/index.ts';
import { key } from '../src/foundation/compose.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { holds } from '../src/mechanics/policy.ts';
import { status } from '../src/mechanics/skills.ts';
import { sight } from '../src/mechanics/movement/rule.ts';
import { illuminated } from '../src/mechanics/light/shared.ts';
import type { Cartridge } from '../src/runtime/decision.ts';
import { read } from './read.ts';
import { createHash } from 'node:crypto';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';

const version = '0.0.35';
const ref = (kind: string, name: string) =>
  ({
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: version,
    kind,
    key: name,
  }) as never;
const named = (kind: string, name: string) => `ashmere_missing_child@${version}:${kind}/${name}`;
function fresh(seekDifficulty?: number) {
  const c = structuredClone(read('protocol/fixtures/missing_child_v035_hash.json').value);
  c.attributes[named('attribute', 'con')] = { key: 'con', start: 10 };
  c.attributes[named('attribute', 'spi')] = { key: 'spi', start: 10 };
  c.ancestries = {
    fen_born: {
      label: 'ancestry.fen_born.label',
      description: 'ancestry.fen_born.description',
      attribute: ref('attribute', 'per'),
      modifier: 1,
      skill: ref('skill', 'swim'),
      faction: { fact: ref('fact', 'priory_fen_axis'), value: -2 },
    },
    road_born: {
      label: 'ancestry.road_born.label',
      description: 'ancestry.road_born.description',
      attribute: ref('attribute', 'dex'),
      modifier: 1,
      skill: ref('skill', 'haggle'),
    },
    hill_folk: {
      label: 'ancestry.hill_folk.label',
      description: 'ancestry.hill_folk.description',
      attribute: ref('attribute', 'con'),
      modifier: 1,
      dark_sight: true,
    },
    fey_touched: {
      label: 'ancestry.fey_touched.label',
      description: 'ancestry.fey_touched.description',
      attribute: ref('attribute', 'spi'),
      modifier: 1,
      faction: { fact: ref('fact', 'priory_fen_axis'), value: -2 },
    },
  };
  if (seekDifficulty !== undefined)
    c.recipes[named('recipe', 'seek_wisp')].check.difficulty = seekDifficulty;
  return newWorld(c as Cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
}
const command = (w: ReturnType<typeof fresh>, type: string, ancestry?: string) =>
  ({
    id: '11111111-2222-4333-8444-555555555555',
    world_context_id: w.context,
    payload: { type, actor_id: w.character, ...(ancestry && { ancestry }) },
  }) as never;

// Breaks: trusted elapsed bypasses the D11 gate again (world time must start at selection), or
// the exit view gives a different refusal than player admission before selection.
test('trusted elapsed refuses before ancestry choice and drains the due job after it', () => {
  const w = fresh();
  const run = '6f6f6f6f-1111-4222-8333-444444444444';
  const until = 68400;
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
  const north = gameView(w).exits.find((exit) => exit.direction === 'north');
  assert.ok(north && !north.available);
  assert.equal(north.reason.code, 'invalid_state');
  const chosen = step(w, command(w, 'choose_ancestry', 'fen_born'), 1);
  assert.equal(chosen.decision.kind, 'accepted');
  const advanced = stepElapsed(chosen.world, span(), 2);
  assert.equal(advanced.decision.kind, 'accepted');
  assert.equal(advanced.world.state.clock, 68400);
  assert.equal(
    Object.values(advanced.world.state.jobs ?? {}).find(
      (job) => job.job.key === 'fen_hounds' && job.due_time === 68400,
    )?.status,
    'completed',
  );
});

// Breaks: a fresh actor can play without a choice, a choice writes only part of the character,
// or a second selection rerolls the six saved values and inherited effects.
test('one creation receipt saves the selected six values and effects exactly once', () => {
  const expected = [
    ['fen_born', [10, 10, 10, 10, 6, 10], 'swim', -2],
    ['road_born', [10, 11, 10, 10, 5, 10], 'haggle', 0],
    ['hill_folk', [10, 10, 11, 10, 5, 10], null, 0],
    ['fey_touched', [10, 10, 10, 10, 5, 11], null, -2],
  ] as const;
  for (const [ancestry, values, learned, faction] of expected) {
    const w = fresh();
    assert.equal(gameView(w).ancestry_choices?.length, 4);
    assert.deepEqual(
      step(
        w,
        {
          ...(command(w, 'move') as object),
          payload: { type: 'move', actor_id: w.character, direction: 'north' },
        } as never,
        1,
      ).decision,
      { kind: 'rejected', error: { code: 'invalid_state' } },
    );
    const selected = step(w, command(w, 'choose_ancestry', ancestry), 1);
    assert.equal(selected.decision.kind, 'accepted', ancestry);
    const saved = selected.world.state.characters?.[w.character];
    assert.equal(saved?.ancestry, ancestry);
    assert.deepEqual(
      ['str', 'dex', 'con', 'int', 'per', 'spi'].map(
        (a) => saved?.attributes[named('attribute', a)],
      ),
      values,
    );
    assert.equal(gameView(selected.world).ancestry, ancestry);
    assert.equal(gameView(selected.world).ancestry_choices, undefined);
    assert.equal(
      selected.decision.kind === 'accepted' &&
        selected.decision.delta.ops.filter((o) => o.op === 'character.select').length,
      1,
    );
    for (const skill of ['swim', 'haggle'])
      assert.equal(
        status(selected.world, w.character, ref('skill', skill), { n: 0 }).acquired,
        learned === skill,
      );
    const at = key({
      kind: 'fact',
      fact: ref('fact', 'priory_fen_axis'),
      scope: { kind: 'player', character_id: w.character },
    });
    assert.equal(selected.world.state.facts?.[at] ?? 0, faction);
    const second = step(selected.world, command(selected.world, 'choose_ancestry', 'fen_born'), 2);
    assert.deepEqual(second.decision, {
      kind: 'rejected',
      error: { code: 'unsupported_capability' },
    });
    assert.equal(second.world, selected.world);
  }
});

// Breaks: B6's direct attribute_threshold arm reads the static PER5 start after fen-born saved PER6.
test('real Seek at controlled difficulty six uses the chosen PER, without changing production difficulty', () => {
  for (const [ancestry, outcome] of [
    ['fen_born', 'success'],
    ['road_born', 'failure'],
  ] as const) {
    const w = fresh(6);
    const chosen = step(w, command(w, 'choose_ancestry', ancestry), 1).world;
    const room = chosen.roomIds[named('room', 'marsh_light')];
    const at = {
      ...chosen,
      state: { ...chosen.state, containers: { ...chosen.state.containers, [chosen.body]: room } },
    };
    const sought = step(
      at,
      {
        ...(command(at, 'perform') as object),
        id: '11111111-2222-4333-8444-555555555556',
        payload: { type: 'perform', actor_id: at.character, action: 'seek_wisp' },
      } as never,
      2,
    );
    assert.equal(sought.decision.kind, 'accepted', JSON.stringify(sought.decision));
    assert.equal(sought.decision.kind === 'accepted' && sought.decision.outcome, outcome);
    assert.deepEqual(sought.world.state.rng, [1, 2, 3, 4]);
  }
});

// Breaks: stat_compare still reads a definition start instead of the saved actor value.
test('saved PER6 passes a controlled PER6 policy while the other choices keep PER5', () => {
  for (const [ancestry, passed] of [
    ['fen_born', true],
    ['road_born', false],
  ] as const) {
    const w = fresh();
    const selected = step(w, command(w, 'choose_ancestry', ancestry), 1).world;
    assert.equal(
      holds(selected, w.character, {
        op: 'stat_compare',
        attribute: ref('attribute', 'per'),
        at_least: 6,
      } as never),
      passed,
    );
  }
});

// Breaks: inherited Swim or Haggle is displayed but the installed D6/D12 admission still treats
// the selected character as untrained.
test('fen-born enters real water and road-born buys at Peg’s qualified quote without lessons', () => {
  const start = fresh();
  const fen = step(start, command(start, 'choose_ancestry', 'fen_born'), 1).world;
  const shaft = fen.roomIds[named('room', 'well_shaft')];
  const atShaft = {
    ...fen,
    state: { ...fen.state, containers: { ...fen.state.containers, [fen.body]: shaft } },
  };
  const dive = step(
    atShaft,
    {
      ...(command(atShaft, 'move') as object),
      id: '11111111-2222-4333-8444-555555555556',
      payload: { type: 'move', actor_id: fen.character, direction: 'down' },
    } as never,
    2,
  );
  assert.equal(dive.decision.kind, 'accepted', JSON.stringify(dive.decision));
  assert.equal(dive.world.state.containers[fen.body], fen.roomIds[named('room', 'well_bottom')]);

  const road = step(start, command(start, 'choose_ancestry', 'road_born'), 1).world;
  const chandler = road.roomIds[named('room', 'chandler')];
  const atPeg = {
    ...road,
    state: { ...road.state, containers: { ...road.state.containers, [road.body]: chandler } },
  };
  const peg = road.entityIds[named('npc', 'peg')];
  const torch = road.entityIds[named('item', 'torch')];
  const quote = gameView(atPeg).entities.find((e) => e.id === peg)?.shop?.[0].buy.price;
  assert.equal(quote, 2);
  const bought = step(
    atPeg,
    {
      ...(command(atPeg, 'buy') as object),
      id: '11111111-2222-4333-8444-555555555557',
      payload: {
        type: 'buy',
        actor_id: road.character,
        provider_id: peg,
        item_id: torch,
        quoted_price: 2,
      },
    } as never,
    2,
  );
  assert.equal(bought.decision.kind, 'accepted', JSON.stringify(bought.decision));
  assert.equal(bought.world.state.containers[torch], road.body);
});

// Breaks: hill sight changes physical light, misses legal adjacent dark Scan, or crosses a barred exit.
test('hill-folk sees darkness locally and across a legal Scan while physical light stays off', () => {
  const base = fresh();
  const hill = step(base, command(base, 'choose_ancestry', 'hill_folk'), 1).world;
  const loft = hill.roomIds[named('room', 'mill_loft')];
  const mill = hill.roomIds[named('room', 'old_mill')];
  const cellar = hill.roomIds[named('room', 'mill_cellar')];
  const inLoft = {
    ...hill,
    state: { ...hill.state, containers: { ...hill.state.containers, [hill.body]: loft } },
  };
  assert.equal(gameView(inLoft).place.description.key, 'room.mill_loft.description');
  assert.equal(illuminated(inLoft, hill.character), false);
  assert.equal(holds(inLoft, hill.character, { op: 'light_off' } as never), true);
  const inMill = {
    ...hill,
    state: { ...hill.state, containers: { ...hill.state.containers, [hill.body]: mill } },
  };
  assert.equal(sight(inMill, hill.body).find((s) => s.direction === 'down')?.room, cellar);
  const blocked = {
    ...inMill,
    rooms: {
      ...inMill.rooms,
      [mill]: {
        ...inMill.rooms[mill],
        exits: {
          ...inMill.rooms[mill].exits,
          down: { ...inMill.rooms[mill].exits.down!, barrier: ref('barrier', 'controlled_gate') },
        },
      },
    },
    barrierInitial: {
      ...inMill.barrierInitial,
      [key(ref('barrier', 'controlled_gate'))]: 'closed' as const,
    },
  };
  assert.deepEqual(
    sight(blocked, hill.body).find((s) => s.direction === 'down'),
    { direction: 'down', code: 'exit_closed' },
  );
});

// Breaks: a syntactically valid ancestry with an unresolved attribute, wrong skill kind
// or unavailable description reaches creation without loader refusal.
test('loader independently refuses invalid authored ancestry bindings', () => {
  for (const [edit, code] of [
    [
      (c: any) => {
        c.ancestries.fen_born.attribute.key = 'missing';
      },
      'UNRESOLVED_REFERENCE',
    ],
    [
      (c: any) => {
        c.ancestries.fen_born.skill.kind = 'item';
      },
      'UNRESOLVED_REFERENCE',
    ],
    [
      (c: any) => {
        c.ancestries.hill_folk.description = 'missing';
      },
      'UNRESOLVED_REFERENCE',
    ],
  ] as const) {
    const c = structuredClone(read('protocol/fixtures/missing_child_v038_hash.json').value);
    edit(c);
    const canonical = encode(c),
      hash = createHash('sha256').update(canonical).digest('hex');
    const loaded = loadCartridge(
      new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash: hash })),
      INSTALLED,
    );
    assert.equal(loaded.ok, false);
    if (!loaded.ok) assert.equal(loaded.diagnostic.code, code);
  }
});
