// A controlled pack over the frozen toolbox_showcase KAT goblins: every asserted number is set here
// or in the test. Six slots (day 4, night 6), hourly wander, 8 hp, sure 1-damage blows on both sides.
import { step, stepElapsed, type World } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { resourceRef } from '../src/mechanics/resource.ts';
import { fact } from '../src/mechanics/position/shared.ts';
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/toolbox_showcase_hash.json');
export const { prefix, ref } = f;
export const run = 'bbbbbbbb-0000-4000-8000-000000000001' as never;

function base(c: any, start = 64800, wander_interval = 3600) {
  c.calendar.start = start;
  const plan = c.populations[`${prefix}:population/goblins`];
  c.populations = {
    [`${prefix}:population/goblins`]: {
      ...plan,
      cap: 6,
      day_target: 4,
      night_target: 6,
      wander_interval,
      replacement_delay: 86400,
    },
  };
  c.npcs[`${prefix}:npc/goblin`].hp = { minimum: 0, maximum: 8, start: 8, gain: 0 };
  c.npcs[`${prefix}:npc/goblin`].attack = { chance: 100, damage_min: 1, damage_max: 1 };
  const combat = c.world.combat;
  combat.interval = 5;
  combat.player_attack = { chance: 100, damage_min: 1, damage_max: 1 };
  delete combat.allies;
}

/** The controlled goblins as a plain population: no pack block, 150-second combat rounds. */
export const unpacked = (c: any) => {
  delete c.populations[`${prefix}:population/goblins`].pack;
  c.world.combat.interval = 150;
};

/** The controlled world, optionally changed further (an inline area, bundle roles). */
export const genesis = (change: (c: any) => void = () => {}, start?: number, wander?: number) =>
  f.genesis((c) => {
    base(c, start, wander);
    change(c);
  });

/** The controlled cartridge, changed further, encoded with its content hash (a host artifact). */
export const bundle = (change: (c: any) => void = () => {}) =>
  f.bundle((c) => {
    base(c);
    change(c);
  });

/** The controlled cartridge, changed further, through the installed loader. */
export const load = (change: (c: any) => void) =>
  f.load((c) => {
    base(c);
    change(c);
  });

/** The generation-1 entity of `slot` with spawn `role` (the member role or the loot role). */
export const spawned = (w: World, slot: number, role = 'hound') =>
  Object.keys(w.state.created ?? {}).find((e) => {
    const o = w.state.created![e]!.origin;
    return o.kind === 'spawned' && o.slot === slot && o.role === role && o.generation === 1;
  }) as never;

const plain = genesis();
export const h1 = spawned(plain, 1);
export const h2 = spawned(plain, 2);
export const home = plain.roomIds[`${prefix}:room/goblin_pit`] as never;
export const nest = plain.roomIds[`${prefix}:room/drill_yard`] as never;
export const shrine = plain.roomIds[`${prefix}:room/crossroads_inn`] as never;

export function fixture(start?: number, wander_interval?: number) {
  const w = genesis(undefined, start, wander_interval);
  return {
    ...w,
    state: {
      ...w.state,
      containers: {
        ...w.state.containers,
        [w.body]: home,
        [h1]: home,
        [h2]: home,
        ...(start === undefined && { [spawned(w, 3)]: nest, [spawned(w, 4)]: nest }),
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
