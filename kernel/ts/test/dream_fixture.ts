// Rest dream fragment: the frozen scene_sampler KAT (Ferry Landing, Bram, the bell_rung modal
// scene) plus an inline paid bed: Maud rents the Inn Rooms bed upstairs, and the first actual paid
// Rest there starts a presentation-only dream. Expected phases and resource answers are literal in
// the tests.
import assert from 'node:assert/strict';
import { value } from '../src/mechanics/fact.ts';
import { level } from '../src/mechanics/resource.ts';
import { step, type World } from '../src/index.ts';
import type { Command, Key } from '../src/contracts.gen.ts';
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/cartridge_scene_hash.json');
export const { prefix, ref } = f;
const always = () => ({ op: 'all', items: [] });
const flag = (key: string, meaning: string) => ({
  key,
  version: 1,
  value_type: { type: 'bool', default: false },
  scopes: ['player'],
  meaning,
});

function dreamSource(c: any) {
  const caps = { position: 1, death: 1, service: 1 };
  c.manifest.requires.kernel_api.at_least = '1.25';
  Object.assign(c.manifest.requires.capabilities, caps);
  Object.assign(c.lock.capabilities, caps);
  c.calendar.start = 0;
  c.resources[`${prefix}:resource/mv`].start = 51;
  c.resources[`${prefix}:resource/pennies`] = {
    key: 'pennies',
    minimum: 0,
    maximum: 1000,
    start: 20,
    gain: 0,
  };
  c.world = {
    movement: { cost: { resource: ref('resource', 'mv'), amount: 1 } },
    death: {
      player_corpse: ref('item', 'player_corpse'),
      npc_corpse: ref('item', 'npc_corpse'),
      shrine: ref('room', 'village_green'),
      restore: { hp: 10, mv: 82 },
    },
  };
  for (const key of ['player_corpse', 'npc_corpse'])
    c.items[`${prefix}:item/${key}`] = {
      key,
      keywords: ['corpse', key],
      name: 'item.corpse.short',
      room_line: 'item.corpse.room',
      description: 'item.corpse.description',
      location: { in: 'template' },
      mass_grams: 0,
      container: true,
    };
  c.rooms[`${prefix}:room/ferry_landing`].exits.up = { to: ref('room', 'inn_rooms') };
  c.rooms[`${prefix}:room/inn_rooms`] = {
    key: 'inn_rooms',
    name: 'room.inn_rooms.title',
    description: 'room.inn_rooms.description',
    exits: { down: { to: ref('room', 'ferry_landing') } },
    details: {
      bed: {
        aliases: ['bed'],
        description: 'detail.bed.free',
        bed: { entitlement: ref('fact', 'bed_paid'), title: 'detail.bed.title' },
        variants: [
          {
            description: 'detail.bed.paid',
            when: { op: 'fact_compare', fact: ref('fact', 'bed_paid'), equals: true },
          },
        ],
      },
    },
  };
  c.npcs[`${prefix}:npc/maud`] = {
    key: 'maud',
    keywords: ['maud'],
    name: 'npc.maud.short',
    room_line: 'npc.maud.room',
    description: 'npc.maud.description',
    room: ref('room', 'ferry_landing'),
    resource_starts: { pennies: 10 },
    services: [ref('service', 'bed_room')],
  };
  // Bram's ordinary choice opens without the lantern quest.
  c.dialogues[`${prefix}:dialogue/bram`].policy = always();
  c.services = {
    [`${prefix}:service/bed_room`]: {
      key: 'bed_room',
      provider: ref('npc', 'maud'),
      currency: ref('resource', 'pennies'),
      action: 'rent_room',
      name: 'service.room',
      narration: 'service.room.used',
      price: 3,
      benefit: { kind: 'entitlement', fact: ref('fact', 'bed_paid') },
    },
  };
  Object.assign(c.facts, {
    [`${prefix}:fact/position`]: {
      key: 'position',
      version: 1,
      value_type: {
        type: 'enum',
        values: ['standing', 'sitting', 'resting', 'sleeping'],
        default: 'standing',
      },
      scopes: ['player'],
      meaning: "The character's position (position@1): only its rule writes it.",
    },
    [`${prefix}:fact/bed_paid`]: flag('bed_paid', 'The player paid Maud for the bed.'),
    [`${prefix}:fact/slept_paid`]: flag('slept_paid', 'First actual paid Rest in the bed.'),
    [`${prefix}:fact/dream_seen`]: flag('dream_seen', 'Only the acknowledged dream end writes it.'),
    [`${prefix}:fact/scene_fen_dream`]: {
      key: 'scene_fen_dream',
      version: 1,
      value_type: { type: 'int', minimum: -1, maximum: 5, default: 0 },
      scopes: ['player'],
      meaning:
        "Scene fen_dream's line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it.",
    },
  });
  c.quests[`${prefix}:quest/a_room`] = {
    key: 'a_room',
    name: 'quest.room.title',
    objective: {
      evidence: 'current_state',
      policy: { op: 'fact_compare', fact: ref('fact', 'dream_seen'), equals: true },
    },
    journal: {
      active: 'quest.room.active',
      objectives_met: 'quest.room.resolved',
      resolved: 'quest.room.resolved',
      failed: 'quest.room.active',
      abandoned: 'quest.room.active',
    },
  };
  c.scenes[`${prefix}:scene/fen_dream`] = {
    key: 'fen_dream',
    control: 'presentation_only',
    name: 'dream.title',
    description: 'dream.description',
    on: {
      rest: {
        room: ref('room', 'inn_rooms'),
        detail: 'bed',
        entitlement: ref('fact', 'bed_paid'),
        credit: ref('fact', 'slept_paid'),
        quest: ref('quest', 'a_room'),
      },
    },
    steps: [
      { type: 'narrate', text: 'dream.opening' },
      { type: 'narrate', text: 'dream.fen' },
      { type: 'narrate', text: 'dream.fox' },
      {
        type: 'choice',
        key: 'fen_fork',
        prompt: 'dream.choice',
        choices: [
          { choice_id: 'follow_fox', label: 'dream.follow', text: 'dream.follow.final' },
          { choice_id: 'wake', label: 'dream.wake', text: 'dream.wake.final' },
        ],
      },
      { type: 'branch' },
      { type: 'await_ack' },
      { type: 'end' },
    ],
    on_end: {
      assign: [{ fact: ref('fact', 'dream_seen'), value: true }],
      quest: ref('quest', 'a_room'),
      outcome: 'acknowledged',
    },
  };
  const action = (key: string, command: string, input: string[], label: string, target: any) => ({
    key,
    command,
    target,
    input,
    name: label,
    priority: 0,
    policy: always(),
    accessibility: label,
  });
  c.actions = {
    ...c.actions,
    [`${prefix}:action/rent_room`]: action(
      'rent_room',
      'use_service',
      ['service', 'quoted_price'],
      'service.room',
      { kind: 'entity', scopes: ['room_occupants'] },
    ),
    [`${prefix}:action/dream_next`]: action(
      'dream_next',
      'continue',
      ['scene', 'line'],
      'action.continue',
      { kind: 'none' },
    ),
    [`${prefix}:action/dream_choose`]: action(
      'dream_choose',
      'choose',
      ['continuation_id', 'choice_id', 'dream'],
      'dream.choose',
      { kind: 'none' },
    ),
  };
  Object.assign(c.text, {
    'item.corpse.short': 'a corpse',
    'item.corpse.room': 'A corpse lies here.',
    'item.corpse.description': 'A corpse.',
    'room.inn_rooms.title': 'Inn Rooms',
    'room.inn_rooms.description': 'A narrow room under the eaves; a [bed](bed) by the wall.',
    'detail.bed.title': 'Bed',
    'detail.bed.free': 'A plain bed. Maud rents it downstairs.',
    'detail.bed.paid': 'You have paid for this bed.',
    'npc.maud.short': 'Maud',
    'npc.maud.room': 'Maud keeps the inn here.',
    'npc.maud.description': 'An innkeeper.',
    'service.room': 'Rent room',
    'service.room.used': 'Maud takes three pennies. The bed upstairs is yours.',
    'service.unaffordable': 'The exact penny payment is unavailable.',
    'service.already_paid': 'You have already paid for the bed.',
    'quest.room.title': 'A Room Upstairs',
    'quest.room.active': 'A dream waits at the bed; return there to resume it.',
    'quest.room.resolved': 'You acknowledged the fen dream.',
    'action.continue': 'Continue',
    'dream.title': 'The Fen Dream',
    'dream.description': 'A dream waiting at the bed.',
    'dream.opening': 'The room falls quiet around you.',
    'dream.fen': 'You stand among the reeds of the fen.',
    'dream.fox': 'A red fox steps onto the track.',
    'dream.choice': 'The fox waits at a fork in the reeds.',
    'dream.follow': 'Follow the fox',
    'dream.wake': 'Wake',
    'dream.choose': 'Choose',
    'dream.follow.final': 'You follow the fox to the water.',
    'dream.wake.final': 'You turn toward the window and wake.',
  });
}
const withDream =
  (change: (c: any) => void = () => {}) =>
  (c: any) => {
    dreamSource(c);
    change(c);
  };
export const bundle = (change?: (c: any) => void) => f.bundle(withDream(change));
export const fresh = (change?: (c: any) => void) => f.genesis(withDream(change));
export const entity = (w: World, kind: string, key: string) =>
  w.entityIds[`${prefix}:${kind}/${key}`];
export const sceneRef = ref('scene', 'fen_dream');
export const phase = (w: World) => ({
  slept: value(w, w.character, ref('fact', 'slept_paid')),
  seen: value(w, w.character, ref('fact', 'dream_seen')),
  cursor: value(w, w.character, ref('fact', 'scene_fen_dream')),
  quest: Object.values(w.state.quests ?? {}).find((q) => q.quest.key === 'a_room')?.state ?? null,
});
export const mv = (w: World) => level(w, w.body, ref('resource', 'mv'));
export function command(w: World, n: number, payload: object): Command {
  return {
    id: `cccccccc-2222-4333-8444-${String(n).padStart(12, '0')}`,
    world_context_id: w.context,
    payload: { actor_id: w.character, ...payload },
  } as Command;
}
export function route(w: World) {
  let n = 100;
  const invoke = (p: any, key?: string) => {
    const result = step(w, command(w, ++n, p), n, key as Key | undefined);
    assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    w = result.world;
    return result;
  };
  invoke(
    {
      type: 'use_service',
      provider_id: entity(w, 'npc', 'maud'),
      service: ref('service', 'bed_room'),
      quoted_price: 3,
    },
    'rent_room',
  );
  invoke({ type: 'move', direction: 'up' }, 'move');
  return {
    get world() {
      return w;
    },
    invoke,
  };
}
