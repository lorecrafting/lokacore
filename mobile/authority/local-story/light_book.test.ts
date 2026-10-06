import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fresh, entity, room } from '../../../kernel/ts/test/light_fixture.ts';
import { gameView, step } from '../../../kernel/ts/src/index.ts';
import { buttonsOf, group } from '../../app/book/model.ts';
// Break: Book drops Refuel's exact supply target or stops offering Douse when the torch is worn.
test('Book binds the exact oil bottle and keeps worn torch controls on the item', () => {
  const torch = entity('torch'),
    oil = entity('lamp_oil');
  const w = {
    ...fresh,
    state: {
      ...fresh.state,
      containers: {
        ...fresh.state.containers,
        [fresh.body]: room('well_shaft'),
        [torch]: fresh.slots.light,
        [oil]: fresh.body,
      },
      fuel: { ...fresh.state.fuel, [torch]: { remaining: 7197, at: 64800, lit: true } },
    },
  };
  const view = gameView(w);
  const buttons = buttonsOf(
    view,
    (k) => fresh.cartridge.text[k],
    (k) => fresh.cartridge.text[k],
  );
  const on = group(buttons as never).on(torch);
  assert.deepEqual(on.find((b) => b.action_key === 'refuel')?.target_ids, [torch, oil]);
  assert.ok(
    !group(buttons as never)
      .on(oil)
      .some((b) => b.action_key === 'refuel'),
  );
  assert.equal(
    on.find((b) => b.action_key === 'refuel')?.label,
    'Refuel a torch from a flask of lamp oil',
  );
  assert.ok(on.some((b) => b.action_key === 'douse'));
  assert.ok(!on.some((b) => b.action_key === 'ignite'));
  const unlit = step(
    w,
    {
      id: 'bbbbbbbb-0000-4000-8000-000000000001',
      world_context_id: w.context,
      payload: { type: 'douse', actor_id: w.character, item_id: torch },
    } as never,
    1,
  );
  assert.equal(unlit.decision.kind, 'accepted');
  assert.equal(gameView(unlit.world).place.description.key, 'room.well_shaft.dark');
  assert.deepEqual(gameView(unlit.world).equipment!.find((s) => s.slot === 'light')!.item!.fuel, {
    remaining: 7197,
    capacity: 7200,
    lit: false,
  });
});
