// Escort fragment: the frozen cellar_sampler KAT (death to the chapel shrine, combat, rats in the
// Lantern Cellar) plus an inline escort quest: a keeper at Ferry Landing, a child and a same-kind
// decoy on Village Green, and start, rejoin and complete dialogues.
import type { World } from '../src/index.ts';
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/cartridge_sampler_hash.json');
export const { ref, prefix } = f;
export const entity = (w: World, kind: string, name: string) =>
  w.entityIds[`${prefix}:${kind}/${name}`];
export const room = (w: World, name: string) => w.roomIds[`${prefix}:room/${name}`];

const quest = ref('quest', 'homeward');
const npcRole = (key: string) => ({ role: 'npc', npc: ref('npc', key) });
const policy = (...items: object[]) => ({ op: 'all', items });
const active = { op: 'quest_state', quest, state: 'active' };
const escortIs = (state: string) => ({ op: 'escort_state', quest, state });

export function escortSource(c: any) {
  c.lock.capabilities.escort = 1;
  c.manifest.requires.capabilities.escort = 1;
  c.manifest.requires.kernel_api.at_least = '1.37';
  // The escort capability's kernel floor requires corpse templates and lidded items to be containers.
  for (const k of ['player_corpse', 'rat_corpse', 'storage_chest', 'trunk'])
    c.items[`${prefix}:item/${k}`].container = true;
  for (const [key, room] of [
    ['keeper', 'ferry_landing'],
    ['child', 'village_green'],
    ['stranger', 'village_green'],
  ]) {
    c.npcs[`${prefix}:npc/${key}`] = {
      key,
      keywords: [key],
      short: `npc.${key}.short`,
      description: `npc.${key}.description`,
      room_line: `npc.${key}.room`,
      room: ref('room', room),
    };
    Object.assign(c.text, {
      [`npc.${key}.short`]: key,
      [`npc.${key}.description`]: `A ${key}.`,
      [`npc.${key}.room`]: `A ${key} is here.`,
    });
  }
  c.facts[`${prefix}:fact/homeward_started`] = {
    key: 'homeward_started',
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    meaning: 'The child agreed to walk home.',
  };
  c.quests[`${prefix}:quest/homeward`] = {
    key: 'homeward',
    title: 'quest.homeward.title',
    objective: { evidence: 'current_state', policy: policy() },
    journal: {
      active: 'quest.homeward.active',
      active_variants: [{ text: 'quest.homeward.separated', when: policy(escortIs('separated')) }],
      objectives_met: 'quest.homeward.met',
      resolved: 'quest.homeward.resolved',
      failed: 'quest.homeward.failed',
      abandoned: 'quest.homeward.abandoned',
      outcomes: { home: 'quest.homeward.home' },
    },
  };
  const dialogue = (key: string, npc: string, body: object) =>
    (c.dialogues[`${prefix}:dialogue/${key}`] = {
      key,
      npc: ref('npc', npc),
      prompt: `dialogue.${key}.prompt`,
      ...body,
    });
  const choice = (id: string, extra: object) => ({
    [id]: { label: `dialogue.${id}.label`, narration: `narration.${id}`, ...extra },
  });
  dialogue('keeper_offer', 'keeper', {
    policy: { op: 'not', item: active },
    roles: { keeper: npcRole('keeper') },
    choices: choice('accept', { accept: quest }),
  });
  dialogue('child_escort', 'child', {
    policy: policy(active, {
      op: 'fact_compare',
      fact: ref('fact', 'homeward_started'),
      equals: false,
    }),
    roles: { child: npcRole('child'), stranger: npcRole('stranger') },
    choices: choice('rescue', {
      escort: { npc: 'child', quest, transition: 'start' },
      sequence: [{ op: 'fact.assign', fact: ref('fact', 'homeward_started'), value: true }],
    }),
  });
  dialogue('child_rejoin', 'child', {
    policy: policy(active, escortIs('separated')),
    roles: { child: npcRole('child') },
    choices: choice('rejoin', { escort: { npc: 'child', quest, transition: 'rejoin' } }),
  });
  dialogue('keeper_home', 'keeper', {
    quest,
    policy: policy(active, escortIs('following')),
    roles: { keeper: npcRole('keeper'), child: npcRole('child') },
    choices: choice('home', { escort: { npc: 'child', quest, transition: 'complete' } }),
  });
  Object.assign(c.text, {
    'quest.homeward.title': 'Homeward',
    'quest.homeward.active': 'Walk the child home.',
    'quest.homeward.separated': 'The child waits where you fell.',
    'quest.homeward.met': 'Bring the child to the keeper.',
    'quest.homeward.resolved': 'Home.',
    'quest.homeward.failed': 'Lost.',
    'quest.homeward.abandoned': 'Abandoned.',
    'quest.homeward.home': 'The child is home.',
    'dialogue.keeper_offer.prompt': 'The keeper asks for help.',
    'dialogue.child_escort.prompt': 'The child is lost.',
    'dialogue.child_rejoin.prompt': 'The child waits.',
    'dialogue.keeper_home.prompt': 'The keeper waits.',
    'dialogue.accept.label': 'Help',
    'dialogue.rescue.label': 'Walk home together',
    'dialogue.rejoin.label': 'Walk on together',
    'dialogue.home.label': 'Hand the child over',
    'narration.accept': 'You agree to help.',
    'narration.rescue': 'The child joins you for the walk to Ferry Landing.',
    'narration.rejoin': 'The child steps beside you again.',
    'narration.home': 'The child runs to the keeper.',
  });
}
const withEscort =
  (change: (c: any) => void = () => {}) =>
  (c: any) => {
    escortSource(c);
    change(c);
  };
export const bundle = (change?: (c: any) => void) => f.bundle(withEscort(change));
export const genesis = (change?: (c: any) => void) => f.genesis(withEscort(change));
