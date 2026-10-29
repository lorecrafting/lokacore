// Patrol fragment: the frozen cellar_sampler KAT (death to the chapel shrine, combat, rats in the
// Lantern Cellar) plus an inline watch patrol: a Watch Post east of North Gate, an East Gate east of
// Village Green, a leader at the post and a six-leg route with four checkpoints.
import assert from 'node:assert/strict';
import { step, type World } from '../src/index.ts';
import type { Command } from '../src/contracts.gen.ts';
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/cartridge_sampler_hash.json');
const { prefix } = f;
const r = (kind: string, key: string) => f.ref(kind, key);

export function patrolSource(c: any) {
  c.lock.capabilities.patrol = 1;
  c.manifest.requires.capabilities.patrol = 1;
  // A composed source runs after this and may raise the floor (escort is 1.37).
  c.manifest.requires.kernel_api.at_least = '1.22';
  // At 1.22 corpse templates and lidded items must be containers (as in escort_fixture.ts).
  for (const k of ['player_corpse', 'rat_corpse', 'storage_chest', 'trunk'])
    c.items[`${prefix}:item/${k}`].container = true;
  const room = (key: string, exits: Record<string, string>) =>
    (c.rooms[`${prefix}:room/${key}`] = {
      key,
      title: `room.${key}.title`,
      description: `room.${key}.description`,
      exits: Object.fromEntries(Object.entries(exits).map(([d, to]) => [d, { to: r('room', to) }])),
    });
  room('watch_post', { west: 'north_gate' });
  room('east_gate', { west: 'village_green' });
  c.rooms[`${prefix}:room/north_gate`].exits.east = { to: r('room', 'watch_post') };
  c.rooms[`${prefix}:room/village_green`].exits.east = { to: r('room', 'east_gate') };
  c.npcs[`${prefix}:npc/tobin`] = {
    key: 'tobin',
    keywords: ['tobin', 'guard'],
    short: 'npc.tobin.short',
    room_line: 'npc.tobin.room',
    description: 'npc.tobin.description',
    room: r('room', 'watch_post'),
  };
  c.facts[`${prefix}:fact/watch_gate_trusts_player`] = {
    key: 'watch_gate_trusts_player',
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    meaning: 'Only a completed patrol writes it.',
  };
  const quest = r('quest', 'watch_rounds');
  const rooms = (...keys: string[]) => keys.map((k) => r('room', k));
  c.quests[`${prefix}:quest/watch_rounds`] = {
    key: 'watch_rounds',
    title: 'quest.watch_rounds.title',
    objective: { evidence: 'patrol' },
    patrol: {
      npc: r('npc', 'tobin'),
      route: rooms(
        'watch_post',
        'north_gate',
        'village_green',
        'east_gate',
        'village_green',
        'north_gate',
      ),
      initial_cursor: 0,
      checkpoints: rooms('north_gate', 'village_green', 'east_gate', 'watch_post'),
      required: 4,
      trust_fact: r('fact', 'watch_gate_trusts_player'),
      narration: 'watch.completed',
    },
    journal: {
      active: 'watch.active',
      objectives_met: 'watch.completed',
      resolved: 'watch.completed',
      failed: 'watch.active',
      abandoned: 'watch.active',
    },
  };
  const choice = (transition: string, extra: object = {}) => ({
    label: `watch.${transition}`,
    narration: `watch.${transition}.narration`,
    patrol: { npc: 'leader', quest, transition },
    ...extra,
  });
  c.dialogues[`${prefix}:dialogue/tobin_watch`] = {
    key: 'tobin_watch',
    npc: r('npc', 'tobin'),
    roles: { leader: { role: 'npc', npc: r('npc', 'tobin') } },
    policy: { op: 'all', items: [] },
    prompt: 'watch.prompt',
    label: 'watch.talk',
    choices: {
      start: choice('start', { accept: quest }),
      continue: choice('continue'),
      rejoin: choice('rejoin'),
      restart: choice('restart'),
    },
  };
  Object.assign(c.text, {
    'room.watch_post.title': 'Watch Post',
    'room.watch_post.description': 'A post by the north gate.',
    'room.east_gate.title': 'East Gate',
    'room.east_gate.description': 'The east gate.',
    'npc.tobin.short': 'Tobin',
    'npc.tobin.room': 'Tobin keeps watch here.',
    'npc.tobin.description': 'A guard.',
    'quest.watch_rounds.title': 'Watch Rounds',
    'watch.active': 'Walk the rounds with Tobin.',
    'watch.completed': 'The watch trusts you.',
    'watch.prompt': 'Tobin waits.',
    'watch.talk': 'Talk to Tobin',
    'watch.start': 'Walk the rounds',
    'watch.continue': 'Go on',
    'watch.rejoin': 'Rejoin',
    'watch.restart': 'Start again',
    'watch.start.narration': 'You fall in beside Tobin.',
    'watch.continue.narration': 'Tobin walks on.',
    'watch.rejoin.narration': 'You walk with Tobin again.',
    'watch.restart.narration': 'Tobin starts the rounds again.',
  });
}
const withPatrol =
  (change: (c: any) => void = () => {}) =>
  (c: any) => {
    patrolSource(c);
    change(c);
  };
export const bundle = (change?: (c: any) => void) => f.bundle(withPatrol(change));
export const genesis = (change?: (c: any) => void) => f.genesis(withPatrol(change));
export { prefix };
export const fresh = genesis();
export const ref = (_w: World, kind: string, key: string) => r(kind, key);
export const room = (w: World, key: string) => w.roomIds[`${prefix}:room/${key}`];
export const npc = (w: World, key = 'tobin') => w.entityIds[`${prefix}:npc/${key}`];
export const patrol = (w: World) => Object.values(w.state.patrols ?? {})[0];
export function journey(world = fresh) {
  let w = world,
    n = 0;
  const run = (p: object, accept = true) => {
    const command = {
      id: `abababab-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p },
    } as Command;
    const result = step(w, command, n);
    if (accept) assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    w = result.world;
    return result;
  };
  const move = (direction: string) => run({ type: 'move', direction });
  const choice = (choice_id: string, input?: object) => {
    run({ type: 'talk', target_id: npc(w), dialogue: ref(w, 'dialogue', 'tobin_watch') });
    const row = Object.entries(w.state.choices!).find(([, c]) => c.status === 'pending')!;
    const p = patrol(w);
    return run({
      type: 'choose',
      continuation_id: row[0],
      choice_id,
      ...(p && {
        patrol: {
          quest_instance_id: p.quest_instance_id,
          attempt_id: p.attempt_id,
          cursor: p.cursor,
          status: p.status,
        },
      }),
      ...input,
    });
  };
  const start = () => {
    for (const d of ['north', 'north', 'north', 'east']) move(d);
    choice('start');
  };
  return {
    run,
    move,
    choice,
    start,
    get world() {
      return w;
    },
  };
}
