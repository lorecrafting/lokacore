import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { runner } from './wisp_fixture.ts';
import { fresh, ref, room, entity, prefix } from './transport_fixture.ts';

const start = (c: any) => {
  c.entry = ref('room', 'ferry_landing');
  c.calendar.start = 64800;
};
// Break: a mill edge loses its reciprocal or a dark stair becomes light-gated, stranding the public route.
test('literal Western Ashmere route visits all five rooms and returns through the preserved east exit', () => {
  const r = runner(fresh(start));
  for (const [direction, name] of [
    ['west', 'boathouse'],
    ['south', 'old_mill'],
    ['up', 'mill_loft'],
    ['down', 'old_mill'],
    ['down', 'mill_cellar'],
    ['up', 'old_mill'],
    ['south', 'empty_cottage'],
    ['up', 'cottage_loft'],
    ['down', 'empty_cottage'],
    ['north', 'old_mill'],
    ['north', 'boathouse'],
    ['east', 'ferry_landing'],
  ]) {
    r.move(direction);
    assert.equal(r.view().place.id, room(r.world(), name));
    if (name === 'boathouse') assert.ok(r.view().notices!.find((n) => n.transport));
    if (['mill_loft', 'mill_cellar'].includes(name)) {
      assert.equal(r.view().place.description.key, `room.${name}.dark`);
      assert.deepEqual(r.view().entities, []);
      assert.deepEqual(r.view().notices ?? [], []);
    }
  }
});
// Break: Hob starts in the day room, moves at the wrong boundary, clones, or remains a present speaker after leaving.
test('original Hob starts at dusk in the loft and alternates at literal next-day schedule boundaries', () => {
  let w = fresh((c) => {
    start(c);
    c.items[`${prefix}:item/torch`].location = { in: 'room', room: ref('room', 'ferry_landing') };
    c.items[`${prefix}:item/torch`].fuel.capacity = 100000;
    c.items[`${prefix}:item/torch`].fuel.initial = 100000;
    c.npcs[`${prefix}:npc/peg`].shop.offers = c.npcs[`${prefix}:npc/peg`].shop.offers.filter(
      (o: any) => o.item.key !== 'torch',
    );
  });
  const hob = entity(w, 'npc', 'hob');
  assert.equal(w.state.containers[hob], room(w, 'mill_loft'));
  assert.equal(Object.values(w.state.jobs!).find((j) => j.job?.key === 'hob')!.due_time, 108000);
  const to = (until: number) => {
    while (w.state.clock < until) {
      const due = Object.values(w.state.jobs!)
        .filter((j) => j.status === 'pending' && j.due_time > w.state.clock)
        .map((j) => j.due_time);
      const boundary = Math.min(until, ...due);
      const run = 'aaaaaaaa-0000-4000-8000-000000000010' as never;
      const out = stepElapsed(
        w,
        {
          id: elapsedCommandId(run, w.context, w.state.clock, boundary) as never,
          world_context_id: w.context,
          payload: {
            type: 'elapsed',
            actor_id: w.character,
            run_id: run,
            from: w.state.clock,
            until: boundary,
          },
        },
        1,
      );
      assert.equal(out.decision.kind, 'accepted', JSON.stringify(out.decision));
      w = out.world;
    }
  };
  const r = runner(w);
  r.ok('take', { item_id: entity(w, 'item', 'torch') });
  r.ok('ignite', { item_id: entity(w, 'item', 'torch') });
  r.move('west', 'south', 'up');
  r.ok('talk', { target_id: hob });
  w = r.world();
  to(108000);
  assert.equal(w.state.containers[hob], room(w, 'old_mill'));
  assert.equal(
    gameView(w).entities.some((e) => e.id === hob),
    false,
  );
  const departed = runner(w);
  departed.ok('close_choice', { continuation_id: gameView(w).choice!.continuation_id });
  assert.equal(departed.raw('talk', { target_id: hob }).kind, 'rejected');
  w = departed.world();
  to(151200);
  assert.equal(w.state.containers[hob], room(w, 'mill_loft'));
  assert.equal(Object.values(w.entities).filter((e) => e.short === 'npc.hob.short').length, 1);
  const dawn = fresh((c) => {
    start(c);
    c.calendar.start = 21600;
    c.npcs[`${prefix}:npc/hob`].room = ref('room', 'old_mill');
  });
  assert.equal(dawn.state.containers[entity(dawn, 'npc', 'hob')], room(dawn, 'old_mill'));
  assert.equal(Object.values(dawn.state.jobs!).find((j) => j.job?.key === 'hob')!.due_time, 64800);
  w = dawn;
  to(64800);
  assert.equal(w.state.containers[entity(w, 'npc', 'hob')], room(w, 'mill_loft'));
});

// Break: descriptive Mill Cellar rat holes accidentally gain a live rat beyond the five original S1 actors.
test('illuminated Mill Cellar has no new NPC or rat population', () => {
  const w = fresh((c) => {
    start(c);
    c.entry = ref('room', 'old_mill');
    c.items[`${prefix}:item/torch`].location = { in: 'room', room: ref('room', 'old_mill') };
    c.npcs[`${prefix}:npc/peg`].shop.offers = c.npcs[`${prefix}:npc/peg`].shop.offers.filter(
      (o: any) => o.item.key !== 'torch',
    );
  });
  const r = runner(w);
  r.ok('take', { item_id: entity(w, 'item', 'torch') });
  r.ok('ignite', { item_id: entity(w, 'item', 'torch') });
  r.move('down');
  assert.equal(r.view().place.description.key, 'room.mill_cellar.description');
  assert.deepEqual(
    r.view().entities.filter((e) => e.kind === 'npc'),
    [],
  );
});
