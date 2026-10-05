import assert from 'node:assert/strict';
import { read } from './read.ts';
import {
  loadCartridge,
  INSTALLED,
  newWorld,
  step,
  stepElapsed,
  type Cartridge,
  type World,
} from '../src/index.ts';
import type { Command, CommandPayload, EntityId, Key, StoryRunId } from '../src/contracts.gen.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { fact } from '../src/mechanics/position/shared.ts';
import { resourceRef } from '../src/mechanics/resource.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'];
const RUN = '6f6f6f6f-1111-4222-8333-444444444444' as StoryRunId;
export const bundle = read('protocol/fixtures/cartridge_sampler_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
export const cartridge = loaded.cartridge as Cartridge;
export const fresh = newWorld(cartridge, CONTEXT, [1, 2, 3, 4]);
export const ref = (w: World, kind: string, name: string) =>
  `${w.cartridge.manifest.id}@${w.cartridge.manifest.version}:${kind}/${name}`;
export const rat = (w: World, n = 1) => w.entityIds[ref(w, 'npc', `cellar_rat_${n}`)];
export const room = (w: World, name: string) => w.roomIds[ref(w, 'room', name)];
export function combatWorld(production = false, start = 0): World {
  const c = structuredClone(cartridge);
  const resources = Object.fromEntries(
    Object.entries(c.resources ?? {}).map(([k, s]) => [
      k,
      production
        ? s
        : {
            ...s,
            gain: 0,
            ...(s.regen && {
              regen: {
                ...s.regen,
                by_position: { standing: 0, sitting: 0, resting: 0, sleeping: 0 },
              },
            }),
          },
    ]),
  );
  const w = newWorld({ ...c, resources, calendar: { start } }, CONTEXT, [1, 2, 3, 4]);
  return {
    ...w,
    state: {
      ...w.state,
      containers: { ...w.state.containers, [w.body]: room(w, 'lantern_cellar') },
    },
  };
}
export function hp(w: World, entity_id: EntityId, value: number): World {
  return {
    ...w,
    state: {
      ...w.state,
      resources: {
        ...w.state.resources,
        [key({ kind: 'resource', resource: resourceRef(w, 'hp'), entity_id })]: {
          value,
          at: w.state.clock,
        },
      },
    },
  };
}
export function command(w: World, payload: CommandPayload, n = 1): Command {
  return {
    id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}` as Command['id'],
    world_context_id: w.context,
    payload,
  };
}
export function attack(w: World, n = 1) {
  return step(w, command(w, { type: 'attack', actor_id: w.character, target_id: rat(w, n) }, n), 1);
}
export function elapsed(w: World, until: number, revision = 2) {
  const from = w.state.clock;
  return stepElapsed(
    w,
    {
      id: elapsedCommandId(RUN, w.context, from, until) as Command['id'],
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id: RUN, from, until },
    },
    revision,
  );
}

// Controlled frozen encounter states; these fixtures have zero position recovery rates.
export function positioned(
  w: World,
  position: 'standing' | 'sitting' | 'resting' | 'sleeping',
): World {
  return {
    ...w,
    state: {
      ...w.state,
      facts: {
        ...w.state.facts,
        [key({
          kind: 'fact',
          fact: fact(w),
          scope: { kind: 'player', character_id: w.character },
        })]: position as Key,
      },
    },
  };
}
