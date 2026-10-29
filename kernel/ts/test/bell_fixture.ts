// Bell fragment: the showcase KAT (the only frozen pack population, goblins at Goblin Pit) plus an
// inline bell: a targetless Ring on a Drill Yard detail sets bell_rung, which is audible in Goblin
// Pit and Drill Yard and suppresses the goblins for two days. Entry Drill Yard at 18:00.
import type { World } from '../src/index.ts';
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/toolbox_showcase_hash.json');
export const { ref, prefix } = f;
export const room = (w: World, name: string) => w.roomIds[`${prefix}:room/${name}`];
export const SUPPRESSION = 172800;
export const START = 64800;

export function bellSource(c: any) {
  c.entry = ref('room', 'drill_yard');
  c.calendar.start = START;
  const goblins = c.populations[`${prefix}:population/goblins`];
  goblins.replacement_delay = 86400;
  goblins.wander_interval = 3600;
  const fact = ref('fact', 'bell_rung');
  c.facts[`${prefix}:fact/bell_rung`] = {
    key: 'bell_rung',
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    meaning: 'The player rang the yard bell.',
  };
  c.rooms[`${prefix}:room/drill_yard`].details.bell = {
    aliases: ['bell'],
    description: 'detail.bell',
  };
  c.scripted_actions[`${prefix}:action/ring_bell`] = {
    key: 'ring_bell',
    aliases: ['ring'],
    name: 'actions.ring_bell',
    priority: 10,
    policy: { op: 'all', items: [] },
    target: { kind: 'detail', detail: 'bell', room: ref('room', 'drill_yard') },
    outcomes: {
      success: {
        narration: { actor: 'narration.ring_bell' },
        sequence: [{ op: 'fact.assign', fact, value: true }],
      },
    },
  };
  c.reactions[`${prefix}:reaction/bell_suppress_goblins`] = {
    key: 'bell_suppress_goblins',
    on: { event: 'fact_changed', fact },
    apply: [
      { op: 'population.suppress', plan: ref('population', 'goblins'), duration: SUPPRESSION },
    ],
  };
  c.world.bell_cue = {
    fact,
    rooms: [ref('room', 'goblin_pit'), ref('room', 'drill_yard')],
    text: 'narration.bell_cue',
  };
  Object.assign(c.text, {
    'detail.bell': 'A bell on a post.',
    'actions.ring_bell': 'Ring',
    'narration.ring_bell': 'You ring the bell.',
    'narration.bell_cue': 'The bell carries over the yard.',
  });
}

export const bundle = (change: (c: any) => void = () => {}) =>
  f.bundle((c) => (bellSource(c), change(c)));
export const load = (change: (c: any) => void = () => {}) =>
  f.load((c) => (bellSource(c), change(c)));
export const genesis = (change: (c: any) => void = () => {}) =>
  f.genesis((c) => (bellSource(c), change(c)));
