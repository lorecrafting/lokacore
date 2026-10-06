import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, stepElapsed } from '../src/index.ts';
import { scopeOf } from '../src/mechanics/fact.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { describe } from '../src/mechanics/description_variant/rule.ts';
import { key } from '../src/foundation/compose.ts';
import { fresh, prefix, entity, ref, command } from './food_fixture.ts';
// Breaks: a public home exit becomes one-way, or an ordinary resident is stranded until an authored wait gate.
test('public homes are reciprocal and Gareth/Ada follow their ordinary day boundaries', () => {
  let w = fresh((c) => {
    c.entry.key = 'village_green';
    c.calendar.start = 64800;
  });
  const room = (name: string) => w.roomIds[`${prefix}:room/${name}`];
  for (const [direction, answer] of [
    ['west', 'smithy'],
    ['west', 'orchard'],
    ['east', 'smithy'],
    ['east', 'village_green'],
    ['north', 'north_gate'],
    ['west', 'elspeth_cottage'],
    ['east', 'north_gate'],
  ] as const) {
    const r = step(w, command(w, 1, { type: 'move', direction }), 1);
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    w = r.world;
    assert.equal(w.state.containers[w.body], room(answer));
  }
  const gareth = entity(w, 'npc', 'gareth'),
    ada = entity(w, 'npc', 'ada');
  assert.equal(w.state.containers[gareth], room('drowned_lantern'));
  assert.equal(w.state.containers[ada], room('elspeth_cottage'));
  for (const [clock, smith, helper] of [
    [79200, 'smithy', 'elspeth_cottage'],
    [111600, 'smithy', 'orchard'],
    [151200, 'drowned_lantern', 'elspeth_cottage'],
  ] as const) {
    while (w.state.clock < clock) {
      const until = Math.min(
        clock,
        ...Object.values(w.state.jobs ?? {})
          .filter((j) => j.status === 'pending')
          .map((j) => j.due_time),
      );
      const run_id = 'bbbbbbbb-0000-4000-8000-000000000001' as never;
      const r = stepElapsed(
        w,
        {
          id: elapsedCommandId(run_id, w.context, w.state.clock, until),
          world_context_id: w.context,
          payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
        } as never,
        until,
      );
      assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
      w = r.world;
    }
    assert.equal(w.state.containers[gareth], room(smith));
    assert.equal(w.state.containers[ada], room(helper));
  }
});

// Breaks: room/cot description reports homecoming for stays/lost/missing, or projection moves/duplicates Wren.
test('controlled committed child enum selects truthful home/cot/Green prose without any writer', () => {
  const base = fresh(),
    wren = entity(base, 'npc', 'wren'),
    status = ref('fact', 'village_child_status');
  const target = key({ kind: 'fact', fact: status, scope: scopeOf(base, base.character, status) });
  for (const [state, location, suffix] of [
    ['missing', 'fox_hollow', 'description'],
    ['rescued', 'ferry_landing', 'rescued'],
    ['stays', 'fox_hollow', 'stays'],
    ['lost', 'fox_hollow', 'lost'],
  ] as const) {
    for (const home of ['elspeth_cottage', 'village_green']) {
      const w = {
        ...base,
        state: {
          ...base.state,
          facts: { ...base.state.facts, [target]: state as never },
          containers: {
            ...base.state.containers,
            [base.body]: base.roomIds[`${prefix}:room/${home}`],
            [wren]: base.roomIds[`${prefix}:room/${location}`],
          },
        },
      };
      const before = JSON.stringify(w.state),
        v = gameView(w);
      assert.equal(v.place.description.key, `room.${home}.${suffix}`);
      if (home === 'elspeth_cottage') {
        const cot = Object.values(base.details).find((d) => d.key === 'cot')!;
        assert.equal(
          describe(w, w.character, cot, { n: 0 }),
          `detail.elspeth_cottage.cot.${suffix}`,
        );
        assert.ok(!v.entities.some((e) => e.id === wren));
      }
      assert.equal(JSON.stringify(w.state), before);
      assert.equal(w.state.containers[wren], base.roomIds[`${prefix}:room/${location}`]);
    }
  }
});
