import assert from 'node:assert/strict';
import { test } from 'node:test';
import { step, gameView, type World } from '../src/index.ts';
import { value } from '../src/mechanics/fact.ts';
import { refused } from '../src/mechanics/expedition/shared.ts';
import { fragment } from './fragment.ts';

const sampler = fragment('protocol/fixtures/expedition_sampler_hash.json');
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}` as never;
function setup(hour = 18, change?: (c: any) => void) {
  let world: World = sampler.genesis((c) => {
    c.calendar.start = hour * 3600;
    change?.(c);
  });
  let ordinal = 1;
  const command = (payload: object) => {
    const result = step(
      world,
      {
        id: id(ordinal),
        world_context_id: world.context,
        payload: { ...payload, actor_id: world.character },
      } as never,
      ordinal++,
    );
    world = result.world;
    return result.decision;
  };
  const view = () => gameView(world);
  const attempt = () => Object.values(world.state.expeditions ?? {})[0];
  const detail = (key: string) =>
    Object.entries(world.details).find(([, d]) => d.key === key)![0] as never;
  return { command, view, attempt, detail, world: () => world };
}

// Breaks: credit comes from the current room, a repeat, or a skipped edge instead of a fresh accepted transfer.
test('five ordered post-start entries alone resolve S27 and lower faction once', () => {
  const a = setup(18);
  const accepted = (payload: object) => {
    const decision = a.command(payload);
    assert.equal(
      decision.kind,
      'accepted',
      `${JSON.stringify(payload)}: ${JSON.stringify(decision)}`,
    );
  };
  accepted({ type: 'expedition', detail_id: a.detail('cairn'), transition: 'start' });
  assert.equal(a.attempt()?.cursor, 0);
  assert.ok(a.view().combat);
  // The trailhead's one exit makes Flee travel route[0].
  accepted({ type: 'flee' });
  assert.equal(a.attempt()?.cursor, 1);
  for (const [direction, cursor] of [
    ['west', 2],
    ['south', 3],
    ['north', 4],
    ['east', 5],
  ] as const) {
    accepted({ type: 'move', direction });
    assert.equal(a.attempt()?.cursor, cursor);
  }
  assert.equal(a.attempt()?.status, 'completed');
  assert.equal(a.view().journal.find((q) => q.quest.key === 'night_walk')?.state, 'resolved');
  const spec = Object.values(a.world().cartridge.quests ?? {}).find(
    (q) => q.expedition,
  )!.expedition!;
  assert.equal(value(a.world(), a.world().character, spec.survived_fact), true);
  assert.equal(value(a.world(), a.world().character, spec.faction), -1);
  assert.equal(a.view().time, 64800);
});

// Breaks: an outside-footprint exit retains old credit, or a stale prior attempt can use shelter after retry.
test('departure fails only the attempt and Restart immediately binds a new identity', () => {
  const a = setup(23);
  const start = a.command({
    type: 'expedition',
    detail_id: a.detail('cairn'),
    transition: 'start',
  });
  assert.equal(start.kind, 'accepted');
  const first = a.attempt()!.attempt_id;
  assert.equal(a.command({ type: 'flee' }).kind, 'accepted');
  assert.equal(a.attempt()?.cursor, 1);
  assert.equal(a.command({ type: 'move', direction: 'north' }).kind, 'accepted');
  assert.equal(a.attempt()?.status, 'failed');
  assert.equal(a.attempt()?.cursor, 0);
  // Use ordinary exits to regain the trailhead; no clock or hound replacement gate applies.
  assert.equal(a.command({ type: 'move', direction: 'south' }).kind, 'accepted');
  assert.equal(a.command({ type: 'move', direction: 'east' }).kind, 'accepted');
  const prior = a.attempt()!;
  const restart = a.command({
    type: 'expedition',
    detail_id: a.detail('cairn'),
    transition: 'restart',
    quest_instance_id: prior.quest_instance_id,
    attempt_id: first,
  });
  assert.equal(restart.kind, 'accepted', JSON.stringify(restart));
  assert.equal(a.attempt()?.cursor, 0);
  assert.notEqual(a.attempt()?.attempt_id, first);
  assert.equal(a.view().time, 82800);
});

// Breaks: the shelter cursor is the first route edge into shelter_room, not route[2] the loaders pin.
test('shelter is offered after route[2] even when an earlier edge enters shelter_room', () => {
  const a = setup(18);
  a.command({ type: 'expedition', detail_id: a.detail('cairn'), transition: 'start' });
  a.command({ type: 'flee' });
  a.command({ type: 'move', direction: 'west' });
  a.command({ type: 'move', direction: 'south' });
  const { quest_instance_id, attempt_id, cursor } = a.attempt()!;
  assert.equal(cursor, 3);
  const w = a.world();
  const [key, quest] = Object.entries(w.cartridge.quests!).find(([, q]) => q.expedition)!;
  const spec = quest.expedition!;
  const route = [{ ...spec.route[0]!, to: spec.shelter_room }, ...spec.route.slice(1)];
  const early = {
    ...w,
    cartridge: {
      ...w.cartridge,
      quests: { ...w.cartridge.quests, [key]: { ...quest, expedition: { ...spec, route } } },
    },
  } as World;
  const shelter = a.detail('lean_to');
  const offer = (c: number) =>
    refused(early, w.character, 'shelter', shelter, quest_instance_id, attempt_id, c);
  assert.equal(offer(3), undefined);
  assert.equal(offer(1), 'invalid_state');
  // Back in shelter_room after route[3]: a command quoting cursor 3 does not reopen shelter.
  a.command({ type: 'move', direction: 'north' });
  a.command({ type: 'move', direction: 'south' });
  assert.equal(a.attempt()?.cursor, 4);
  assert.equal(
    refused(a.world(), w.character, 'shelter', shelter, quest_instance_id, attempt_id, 3),
    'invalid_state',
  );
});

// Breaks: an entry into route[cursor].to from a room other than route[cursor].from earns credit.
test('entering the next edge target from another footprint room earns no credit', () => {
  const a = setup(18, (c) => {
    c.rooms['expedition_sampler@0.0.1:room/hollow'].exits.east = {
      to: sampler.ref('room', 'ford'),
    };
  });
  a.command({ type: 'expedition', detail_id: a.detail('cairn'), transition: 'start' });
  for (const move of [
    { type: 'flee' },
    ...['west', 'south', 'north', 'south', 'east'].map((direction) => ({
      type: 'move',
      direction,
    })),
  ])
    assert.equal(a.command(move).kind, 'accepted', JSON.stringify(move));
  // route[4] is glade to ford; this entry into ford came from hollow.
  assert.equal(a.attempt()?.cursor, 4);
  assert.equal(a.attempt()?.status, 'active');
});
