// Message fragment: the frozen errand_sampler KAT (Bram at Ferry Landing, the lantern quest, the
// lantern on the Village Green north of it) plus an inline protected message: a courier on the
// green holds it (give_allowed false), a receive dialogue hands it to the player and sets the
// branch fact, and Bram's quest dialogue resolves the lantern quest by hand_over and sets delivered.
// A 1000g satchel (an always-open portable container) on the green fills the inline 1000g carry
// ceiling exactly.
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/cartridge_errand_hash.json');
export const { ref, prefix } = f;

const branch = (equals: string) => ({ op: 'fact_compare', fact: ref('fact', 'branch'), equals });
const role = (kind: string, key: string) => ({ role: kind, [kind]: ref(kind, key) });

export function messageSource(c: any) {
  c.manifest.requires.kernel_api.at_least = '1.10'; // the give_allowed floor
  for (const caps of [c.manifest.requires.capabilities, c.lock.capabilities])
    Object.assign(caps, { fact: 1, dialogue: 1 });
  c.world = { carry: { max_grams: 1000 } };
  c.items[`${prefix}:item/lantern`].mass_grams = 0; // a carry ceiling needs every item's mass
  const green = ref('room', 'village_green');
  c.npcs[`${prefix}:npc/courier`] = {
    key: 'courier',
    keywords: ['courier'],
    short: 'npc.courier.short',
    description: 'npc.courier.description',
    room_line: 'npc.courier.room',
    room: green,
  };
  Object.assign(c.items, {
    [`${prefix}:item/message`]: {
      key: 'message',
      keywords: ['message'],
      short: 'item.message.short',
      description: 'item.message.description',
      room_line: 'item.message.room',
      mass_grams: 20,
      location: { in: 'npc', npc: ref('npc', 'courier') },
      give_allowed: false,
    },
    [`${prefix}:item/satchel`]: {
      key: 'satchel',
      keywords: ['satchel'],
      short: 'item.satchel.short',
      description: 'item.satchel.description',
      room_line: 'item.satchel.room',
      mass_grams: 1000,
      location: { in: 'room', room: green },
      container: true,
    },
  });
  c.facts[`${prefix}:fact/branch`] = {
    key: 'branch',
    version: 1,
    value_type: { type: 'enum', values: ['unselected', 'carried'], default: 'unselected' },
    scopes: ['player'],
    meaning: 'Whether the player carries the courier message.',
  };
  c.facts[`${prefix}:fact/delivered`] = {
    key: 'delivered',
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    meaning: 'Bram has the courier message.',
  };
  const lantern = c.quests[`${prefix}:quest/lantern`];
  lantern.objective.policy = branch('carried');
  const active = { op: 'quest_state', quest: ref('quest', 'lantern'), state: 'active' };
  c.dialogues = {
    [`${prefix}:dialogue/courier`]: {
      key: 'courier',
      npc: ref('npc', 'courier'),
      prompt: 'dialogue.courier.prompt',
      policy: { op: 'all', items: [active, branch('unselected')] },
      roles: { courier: role('npc', 'courier'), message: role('item', 'message') },
      choices: {
        carry: {
          label: 'dialogue.courier.carry',
          narration: 'narration.courier.carry',
          receive: { item: 'message', from: 'courier' },
          sequence: [{ op: 'fact.assign', fact: ref('fact', 'branch'), value: 'carried' }],
        },
      },
    },
    [`${prefix}:dialogue/deliver`]: {
      key: 'deliver',
      npc: ref('npc', 'bram'),
      quest: ref('quest', 'lantern'),
      prompt: 'dialogue.deliver.prompt',
      policy: {
        op: 'all',
        items: [active, branch('carried'), { op: 'has_item', item: ref('item', 'message') }],
      },
      roles: { bram: role('npc', 'bram'), message: role('item', 'message') },
      choices: {
        deliver: {
          label: 'dialogue.deliver.deliver',
          narration: 'narration.deliver',
          hand_over: { item: 'message', to: 'bram' },
          sequence: [{ op: 'fact.assign', fact: ref('fact', 'delivered'), value: true }],
        },
      },
    },
  };
  Object.assign(c.text, {
    'npc.courier.short': 'a courier',
    'npc.courier.description': 'A courier.',
    'npc.courier.room': 'A courier waits here.',
    'item.message.short': 'a sealed message',
    'item.message.description': 'A sealed message.',
    'item.message.room': 'A sealed message lies here.',
    'item.satchel.short': 'a satchel',
    'item.satchel.description': 'A heavy satchel.',
    'item.satchel.room': 'A satchel lies here.',
    'dialogue.courier.prompt': 'Will you carry this to Bram?',
    'dialogue.courier.carry': 'Carry it',
    'narration.courier.carry': 'The courier hands you the sealed message.',
    'dialogue.deliver.prompt': 'Bram looks at the message.',
    'dialogue.deliver.deliver': 'Hand it over',
    'narration.deliver': 'Bram takes the sealed message.',
  });
}
const withMessage =
  (change: (c: any) => void = () => {}) =>
  (c: any) => {
    messageSource(c);
    change(c);
  };
export const bundle = (change?: (c: any) => void) => f.bundle(withMessage(change));
export const load = (change?: (c: any) => void) => f.load(withMessage(change));
export const genesis = (change?: (c: any) => void) => f.genesis(withMessage(change));
