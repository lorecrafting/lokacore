import { newWorld, step, stepElapsed, type Cartridge } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { read } from './read.ts';
import { key } from '../src/foundation/compose.ts';
import { resourceRef } from '../src/mechanics/resource.ts';
import { fact } from '../src/mechanics/position/shared.ts';

const pin = read('protocol/fixtures/missing_child_v029_hash.json');
export const ids = read('protocol/fixtures/missing_child_v029_ids.json');
const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never;
export const run = 'bbbbbbbb-0000-4000-8000-000000000001' as never;
export const h1 = ids['population/fen_hounds/slot1/member'] as never;
export const h2 = ids['population/fen_hounds/slot2/member'] as never;
export const home = ids['room/hound_run'] as never;
export const nest = ids['room/adder_nest'] as never;

export function fixture(start?: number) {
  const c = structuredClone(pin.value) as Cartridge;
  if (start !== undefined) (c.calendar as { start: number }).start = start;
  const populations = Object.fromEntries(
    Object.entries(c.populations!).map(([k, plan]) => [
      k,
      {
        ...plan,
        pack: {
          flight_below_percent: 25,
          flight_fare: 0 as const,
          narration: {
            helper_joined: 'hound.pack.helper',
            enemy_fled: { east: 'hound.pack.fled_east', west: 'hound.pack.fled_west' },
            primary_changed: 'hound.pack.primary',
            pack_withdrew: 'hound.pack.withdrew',
          },
        },
      },
    ]),
  ) as unknown as Cartridge['populations'];
  const world = { ...c.world!, combat: { ...c.world!.combat!, interval: 5 } };
  const w = newWorld({ ...c, populations, world }, context, [1, 2, 3, 4]);
  return {
    ...w,
    state: {
      ...w.state,
      containers: {
        ...w.state.containers,
        [w.body]: home,
        [h1]: home,
        [h2]: home,
        ...(start === undefined && {
          [ids['population/fen_hounds/slot3/member']]: nest,
          [ids['population/fen_hounds/slot4/member']]: nest,
        }),
      },
    },
  };
}

export function wounded(w: ReturnType<typeof fixture>, value: number) {
  const hpKey = key({ kind: 'resource', entity_id: h2, resource: resourceRef(w, 'hp') });
  return {
    ...w,
    state: {
      ...w.state,
      resources: { ...w.state.resources, [hpKey]: { value, at: w.state.clock } },
    },
  };
}

export function begun(w: ReturnType<typeof fixture>) {
  return step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000001' as never,
      world_context_id: w.context,
      payload: { type: 'attack', actor_id: w.character, target_id: h2 },
    },
    1,
  ).world;
}

export function due(w: ReturnType<typeof fixture>) {
  return stepElapsed(
    w,
    {
      id: elapsedCommandId(run, w.context, 64800, 64805) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id: run, from: 64800, until: 64805 },
    },
    2,
  );
}

export function seated(w: ReturnType<typeof fixture>) {
  const position = key({
    kind: 'fact',
    fact: fact(w),
    scope: { kind: 'player', character_id: w.character },
  });
  return {
    ...w,
    state: { ...w.state, facts: { ...w.state.facts, [position]: 'sitting' as never } },
  };
}
