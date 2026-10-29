// Exchange/contribution quest fragment on the frozen harvest_sampler KAT: a 3000 g carry ceiling,
// a six-ore seam, a healer holding six bandages and a repeatable two-for-two exchange (docs/system/mechanics.md).
import assert from 'node:assert/strict';
import { step, gameView, type World } from '../src/index.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { fragment } from './fragment.ts';

export const sampler = fragment('protocol/fixtures/harvest_sampler_hash.json');
export const { ref, prefix } = sampler;
const named = (kind: string, k: string) => `${prefix}:${kind}/${k}`;
const n6 = [1, 2, 3, 4, 5, 6].map((i) => String(i).padStart(2, '0'));
const healer = ref('npc', 'healer'),
  quest = ref('quest', 'herbs');
const active = (state: string) => ({ op: 'quest_state', quest, state });
const accepting = { op: 'any', items: [active('active'), active('objectives_complete')] };
export const infirmary = (c: any) => {
  for (const cap of ['quest', 'dialogue'])
    c.manifest.requires.capabilities[cap] = c.lock.capabilities[cap] = 1;
  c.world = { carry: { max_grams: 3000 } };
  c.items[named('item', 'stick')].mass_grams = 100; // a carry ceiling needs every mass
  for (const i of n6.slice(2))
    c.items[named('item', `ore_${i}`)] = {
      ...c.items[named('item', 'ore_01')],
      key: `ore_${i}`,
      keywords: ['ore', `ore_${i}`],
    };
  c.rooms[named('room', 'mine')].details.seam.harvest.items = n6.map((i) =>
    ref('item', `ore_${i}`),
  );
  for (const i of n6)
    c.items[named('item', `bandage_${i}`)] = {
      key: `bandage_${i}`,
      keywords: ['bandage', `bandage_${i}`],
      name: 'item.bandage.short',
      room_line: 'item.bandage.room',
      description: 'item.bandage.description',
      mass_grams: 10,
      location: { in: 'npc', npc: healer },
    };
  c.npcs = {
    [named('npc', 'healer')]: {
      key: 'healer',
      keywords: ['healer'],
      name: 'npc.healer.short',
      room_line: 'npc.healer.room',
      description: 'npc.healer.description',
      room: ref('room', 'mine'),
    },
  };
  const int = (key: string, minimum: number, maximum: number) => ({
    key,
    version: 1,
    value_type: { type: 'int', minimum, maximum, default: 0 },
    scopes: ['player'],
    meaning: `Fragment fact ${key}.`,
  });
  c.facts[named('fact', 'axis')] = int('axis', -10, 10);
  c.facts[named('fact', 'contribution')] = int('contribution', 0, 2);
  c.quests = {
    [named('quest', 'herbs')]: {
      key: 'herbs',
      name: 'quest.herbs.title',
      repeatable: true,
      objective: {
        evidence: 'current_state',
        policy: { op: 'all', items: [] },
      },
      exchange: {
        npc: healer,
        outgoing: n6.map((i) => ref('item', `ore_${i}`)),
        incoming: n6.map((i) => ref('item', `bandage_${i}`)),
        quantity: 2,
        contribution: ref('fact', 'contribution'),
        faction: ref('fact', 'axis'),
        increment: 1,
      },
      journal: Object.fromEntries(
        ['active', 'objectives_met', 'resolved', 'failed', 'abandoned'].map((s) => [
          s,
          'quest.herbs.journal',
        ]),
      ),
    },
  };
  const dialogue = (key: string, policy: object, choices: object, extra = {}) => ({
    key,
    npc: healer,
    policy: policy,
    prompt: 'dialogue.healer.prompt',
    roles: { healer: { role: 'npc', npc: healer } },
    choices,
    ...extra,
  });
  c.dialogues = {
    [named('dialogue', 'a_offer')]: dialogue(
      'a_offer',
      { op: 'not', item: accepting },
      {
        accept: { label: 'quest.herbs.accept', narration: 'narration.healer', accept: quest },
      },
    ),
    [named('dialogue', 'b_turn_in')]: dialogue(
      'b_turn_in',
      accepting,
      { exchange: { label: 'quest.herbs.turn_in', narration: 'narration.healer', exchange: true } },
      { quest },
    ),
  };
  Object.assign(c.text, {
    'item.bandage.short': 'a bandage',
    'item.bandage.room': 'A [bandage] lies here.',
    'item.bandage.description': 'A clean linen bandage.',
    'npc.healer.short': 'the healer',
    'npc.healer.room': 'A [healer] waits by the seam.',
    'npc.healer.description': 'A healer who trades bandages for ore.',
    'quest.herbs.title': 'Ore for bandages',
    'quest.herbs.journal': 'The healer trades two bandages for two lumps of ore.',
    'quest.herbs.accept': 'Offer ore',
    'quest.herbs.turn_in': 'Trade the ore',
    'dialogue.healer.prompt': 'The healer looks up.',
    'narration.healer': 'The healer nods.',
  });
};
export const fresh = sampler.genesis(infirmary);
export const id = (kind: string, k: string) => fresh.entityIds[named(kind, k)] as EntityId;
export const herbs = n6.map((i) => id('item', `ore_${i}`)).sort();
export const bandages = n6.map((i) => id('item', `bandage_${i}`)).sort();
export const wick = id('npc', 'healer'),
  patch = Object.keys(fresh.details)[0] as EntityId, // the seam, the only detail
  ledger = id('item', 'stick');
/** The body holds `held` and the stick, weighing `mass` grams. */
export const standing = (held: readonly string[] = [], mass = 0): World => ({
  ...fresh,
  entities: {
    ...fresh.entities,
    [ledger]: { ...fresh.entities[ledger], mass_grams: mass } as never,
  },
  state: {
    ...fresh.state,
    containers: {
      ...fresh.state.containers,
      [ledger]: fresh.body,
      ...Object.fromEntries(held.map((h) => [h, fresh.body])),
    },
  },
});
export function driver(initial: World) {
  let world = initial,
    n = 0;
  const run = (payload: object, expected = 'accepted') => {
    const result = step(
      world,
      {
        id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}` as never,
        world_context_id: world.context,
        payload: { actor_id: world.character, ...payload } as never,
      },
      n,
    );
    const d = result.decision;
    assert.equal(
      d.kind === 'accepted' ? 'accepted' : d.kind === 'rejected' ? d.error.code : d.code,
      expected,
      JSON.stringify(d),
    );
    if (expected !== 'accepted') assert.equal(result.world, world);
    world = result.world;
    return d;
  };
  const talk = () => run({ type: 'talk', target_id: wick });
  const choose = (choice_id: string) =>
    run({ type: 'choose', continuation_id: gameView(world).choice!.continuation_id, choice_id });
  return {
    run,
    talk,
    choose,
    world: () => world,
    replace: (w: World) => {
      world = w;
    },
    accept: () => {
      talk();
      choose('accept');
    },
    exchange: () => {
      talk();
      choose('exchange');
    },
    axis: () => value(world, world.character, ref('fact', 'axis')),
    contribution: () => value(world, world.character, ref('fact', 'contribution')),
  };
}
