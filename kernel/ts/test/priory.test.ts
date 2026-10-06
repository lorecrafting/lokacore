import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, stepElapsed, newWorld } from '../src/index.ts';
import { value } from '../src/mechanics/fact.ts';
import { decide } from '../src/mechanics/readable/rule.ts';
import { resolve } from '../src/commands/target.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { runner } from './wisp_fixture.ts';
import { fresh, ids, ref, cartridge } from './priory_fixture.ts';

const topics = (r: ReturnType<typeof runner>) =>
  ['ward', 'bell'].map((name) =>
    value(r.world(), r.world().character, ref('fact', `topic_${name}_known`)),
  );
const books = ['ward_of_the_fen', 'bell_rites'];
const toBooks = (r: ReturnType<typeof runner>) =>
  r.move('north', 'north', 'north', 'north', 'north', 'north', 'west');

// Break: a new outward exit loses its return or gains a time/knowledge/bell/gear gate.
test('literal public Priory route returns safely under both child/bell outcomes at day and night', () => {
  const route = [
    ['north', 'chapel_steps'],
    ['north', 'chapel_nave'],
    ['west', 'prior_study'],
    ['east', 'chapel_nave'],
    ['up', 'bell_tower'],
    ['up', 'belfry'],
    ['up', 'spire'],
    ['down', 'belfry'],
    ['down', 'bell_tower'],
    ['down', 'chapel_nave'],
    ['north', 'cloister'],
    ['east', 'infirmary'],
    ['west', 'cloister'],
    ['west', 'scriptorium'],
    ['west', 'kitchen_garden'],
    ['east', 'scriptorium'],
    ['east', 'cloister'],
    ['south', 'chapel_nave'],
    ['south', 'chapel_steps'],
    ['south', 'north_gate'],
  ];
  for (const clock of [30000, 78000])
    for (const [child, bell] of [
      ['rescued', false],
      ['lost', true],
    ] as const) {
      const base = fresh(),
        w = newWorld(
          { ...cartridge, calendar: { ...cartridge.calendar!, start: clock } },
          base.context,
          [1, 2, 3, 4],
        ),
        facts = Object.fromEntries(
          (
            [
              ['village_child_status', child],
              ['chapel_bell_rung', bell],
            ] as const
          ).map(([fact, v]) => [
            key({
              kind: 'fact',
              fact: ref('fact', fact),
              scope: { kind: 'player', character_id: w.character },
            }),
            v as never,
          ]),
        );
      // Use the declared enum facts directly; route admission does not depend on their outcomes.
      const r = runner({
        ...w,
        state: {
          ...w.state,
          facts,
          containers: { ...w.state.containers, [w.body]: ids['room/north_gate'] },
        },
      });
      for (const [direction, room] of route) {
        r.move(direction);
        assert.equal(r.view().place.id, ids[`room/${room}`]);
      }
      assert.ok(r.world().entities[ids['npc/aldric']]);
      assert.equal(r.world().state.containers[ids['npc/aldric']], ids['room/chapel_nave']);
      assert.equal(r.world().state.containers[ids['npc/wick']], ids['room/infirmary']);
    }
});

// Break: Examine/Take teaches, Ward/Bell mapping is swapped, or reread grants twice.
test('only deliberate exact held Read teaches its declared topic and keeps time RNG and other membership', () => {
  for (const [book, expected] of [
    ['ward_of_the_fen', [true, false]],
    ['bell_rites', [false, true]],
  ] as const) {
    const r = runner(fresh());
    toBooks(r);
    const id = ids[`item/${book}`];
    r.ok('look', { target_id: id });
    assert.deepEqual(topics(r), [false, false]);
    assert.deepEqual(r.raw('read', { target_id: id }), {
      kind: 'rejected',
      error: { code: 'not_present' },
    });
    r.ok('take', { item_id: id });
    assert.deepEqual(topics(r), [false, false]);
    const before = r.world().state;
    const d = r.ok('read', { target_id: id });
    assert.equal(d.kind, 'accepted');
    if (d.kind !== 'accepted') continue;
    assert.deepEqual(d.narration, [{ key: `readable.${book}` }]);
    assert.deepEqual(topics(r), expected);
    assert.deepEqual(r.world().state.rng, before.rng);
    assert.equal(r.world().state.clock, before.clock);
    const again = r.ok('read', { target_id: id });
    if (again.kind === 'accepted') assert.deepEqual(again.delta.ops, []);
    r.ok('take', { item_id: ids[`item/${books.find((b) => b !== book)}`] });
    r.ok('read', { target_id: ids[`item/${books.find((b) => b !== book)}`] });
    assert.deepEqual(topics(r), [true, true]);
    r.move('east', 'south');
    assert.ok(
      r
        .view()
        .entities.find((e) => e.id === ids['npc/aldric'])!
        .actions.some((a) => a.action_key === 'c_aldric_ward' && a.available),
    );
  }
});

// Break: closed/foreign/worn custody or a stale former child bypasses held admission and teaches.
test('open held ancestors admit exactly the original book; closed ground foreign worn and departed children refuse', () => {
  const base = fresh(),
    book = ids['item/ward_of_the_fen'],
    box = ids['item/storage_chest'];
  const boxSpec = base.entities[box];
  assert.equal(boxSpec.kind, 'item');
  if (boxSpec.kind !== 'item') return;
  const make = (holder: string, lid: string) =>
    ({
      ...base,
      state: {
        ...base.state,
        containers: { ...base.state.containers, [box]: holder, [book]: box },
        barriers: { [key({ kind: 'barrier', barrier: boxSpec.barrier! })]: lid },
      },
    }) as any;
  const r = runner(make(base.body, 'open'));
  assert.ok(
    gameView(r.world())
      .inventory.find((e) => e.id === box)
      ?.contents?.find((e) => e.id === book)
      ?.actions.some((a) => a.command === 'read' && a.available),
  );
  r.ok('read', { target_id: book });
  assert.deepEqual(topics(r), [true, false]);
  for (const [holder, lid] of [
    [base.body, 'closed'],
    [base.body, 'locked'],
    [ids['room/scriptorium'], 'open'],
    [ids['npc/ash'], 'open'],
    [base.slots.cloak, 'open'],
  ]) {
    const w = make(holder, lid),
      rr = runner(w);
    assert.deepEqual(rr.raw('read', { target_id: book }), {
      kind: 'rejected',
      error: { code: 'not_present' },
    });
    assert.deepEqual(topics(rr), [false, false]);
  }
  const w = make(base.body, 'open');
  w.state.containers[book] = ids['room/scriptorium'];
  assert.deepEqual(runner(w).raw('read', { target_id: book }), {
    kind: 'rejected',
    error: { code: 'not_present' },
  });
  const actor = 'aaaaaaaa-0000-4000-8000-000000000099' as any;
  assert.deepEqual(
    decide(
      r.world(),
      {
        id: 'aaaaaaaa-0000-4000-8000-000000000098',
        world_context_id: base.context,
        payload: { type: 'read', actor_id: actor, target_id: book },
      } as any,
      () => '',
      { n: 0 },
    ),
    { kind: 'rejected', error: { code: 'not_present' } },
  );
});

// Break: two novice identities merge or schedule boundaries remove the authored 19:00 ambiguity.
test('literal novice schedules keep distinct cards and exact departure contexts', () => {
  let w = fresh();
  const at = (clock: number) => {
    const d = stepElapsed(
      w,
      {
        id: elapsedCommandId(
          'aaaaaaaa-0000-4000-8000-000000000010',
          w.context,
          w.state.clock,
          clock,
        ),
        world_context_id: w.context,
        payload: {
          type: 'elapsed',
          actor_id: w.character,
          run_id: 'aaaaaaaa-0000-4000-8000-000000000010',
          from: w.state.clock,
          until: clock,
        },
      } as any,
      1,
    );
    assert.equal(d.decision.kind, 'accepted', JSON.stringify(d.decision));
    w = d.world;
  };
  w = {
    ...w,
    state: { ...w.state, containers: { ...w.state.containers, [w.body]: ids['room/cloister'] } },
  };
  at(68400);
  assert.deepEqual(
    gameView(w)
      .entities.filter((e) => [ids['npc/ash'], ids['npc/hale']].includes(e.id))
      .map((e) => [e.id, e.name])
      .sort(),
    [
      [ids['npc/ash'], 'npc.ash.short'],
      [ids['npc/hale'], 'npc.hale.short'],
    ].sort(),
  );
  assert.deepEqual(resolve(w, w.character, 'novice'), {
    kind: 'ambiguous',
    candidate_ids: [ids['npc/ash'], ids['npc/hale']].sort(),
  });
  for (const name of ['ash', 'hale']) {
    const r = runner(w);
    const d = r.ok('talk', { target_id: ids[`npc/${name}`] });
    assert.deepEqual(r.view().choice?.prompt, { key: `dialogue.${name}.prompt` });
    const said = r.choose('leave');
    if (said.kind === 'accepted')
      assert.deepEqual(
        said.narration?.map((n) => n.key),
        [`dialogue.${name}.prompt`],
      );
  }
  at(72000);
  assert.equal(w.state.containers[ids['npc/ash']], ids['room/scriptorium']);
  assert.equal(w.state.containers[ids['npc/hale']], ids['room/cloister']);
  const before = runner(w);
  assert.equal(before.raw('talk', { target_id: ids['npc/ash'] }).kind, 'rejected');
  at(108000);
  assert.equal(w.state.containers[ids['npc/ash']], ids['room/scriptorium']);
  assert.equal(w.state.containers[ids['npc/hale']], ids['room/kitchen_garden']);
  at(129600);
  assert.equal(w.state.containers[ids['npc/ash']], ids['room/cloister']);
});

// Break: readable books evade their ordinary 100g carrying contribution at an exact ceiling.
test('one 100g book fills a 11900g held load and the second Take refuses unchanged', () => {
  const w = fresh(),
    ballast = ids['item/torch'],
    room = ids['room/scriptorium'];
  const r = runner({
    ...w,
    entities: { ...w.entities, [ballast]: { ...w.entities[ballast], mass_grams: 11900 } },
    state: { ...w.state, containers: { ...w.state.containers, [w.body]: room, [ballast]: w.body } },
  } as any);
  r.ok('take', { item_id: ids['item/ward_of_the_fen'] });
  const before = r.world().state;
  assert.deepEqual(r.raw('take', { item_id: ids['item/bell_rites'] }), {
    kind: 'rejected',
    error: { code: 'too_heavy' },
  });
  assert.deepEqual(r.world().state, before);
});

// Break: existing B6 completion overwrites book Ward, or pre-known Ward prevents the public consumer.
test('Wisp completion and held Ward Read compose in both acquisition orders', () => {
  for (const bookFirst of [false, true]) {
    const w = fresh(),
      book = ids['item/ward_of_the_fen'];
    const r = runner({
      ...w,
      state: { ...w.state, containers: { ...w.state.containers, [book]: w.body } },
    });
    if (bookFirst) r.ok('read', { target_id: book });
    r.move('south', 'south', 'south', 'east');
    r.seek();
    r.ok('talk', { target_id: ids['npc/wisp'] });
    r.choose('accept');
    r.ok('talk', { target_id: ids['npc/wisp'] });
    const grant = r.choose('answer', 'TIDE');
    assert.equal(grant.kind, 'accepted');
    const again = r.ok('read', { target_id: book });
    if (again.kind === 'accepted') assert.deepEqual(again.delta.ops, []);
    assert.deepEqual(topics(r), [true, false]);
    r.move('west', 'north', 'north', 'north', 'north', 'north', 'north', 'north', 'north');
    const aldric = r.view().entities.find((e) => e.id === ids['npc/aldric'])!;
    assert.ok(aldric.actions.some((a) => a.action_key === 'c_aldric_ward' && a.available));
    r.ok(
      'talk',
      { target_id: ids['npc/aldric'], dialogue: ref('dialogue', 'c_aldric_ward') },
      'c_aldric_ward',
    );
    assert.deepEqual(r.view().choice!.prompt, { key: 'dialogue.aldric.ward' });
  }
});

// Break: adding declared book topics leaks a grant into ordinary room-notice Read.
test('ordinary notice Read remains eventless and teaches no topic in the active book cartridge', () => {
  const r = runner(fresh()),
    before = r.world().state,
    d = r.ok('read', { target_id: ids['detail/ferry_landing/notice'] });
  if (d.kind !== 'accepted') assert.fail('Read');
  assert.deepEqual(d.narration, [{ key: 'readable.notice' }]);
  assert.deepEqual(d.delta.ops, []);
  assert.deepEqual(d.events, []);
  assert.deepEqual(r.world().state, before);
  assert.deepEqual(topics(r), [false, false]);
});
