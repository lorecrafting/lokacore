// The codex_sampler KAT with inline content its Read tests need: a readable plaque in the entry
// hall, a readable note on the study desk, and a lidded chest in the study.
import { fragment } from './fragment.ts';

export const codex = fragment('protocol/fixtures/codex_sampler_hash.json');
const { prefix, ref } = codex;
export const PLAQUE = 'Travellers may rest in the hall until dusk.';
export const DESK_NOTE = 'Return every ledger to its shelf by nightfall.';

export function notices(c: any) {
  c.rooms[`${prefix}:room/hall`].details = {
    ...c.rooms[`${prefix}:room/hall`].details,
    plaque: {
      aliases: ['plaque', 'hall_plaque'],
      description: 'detail.plaque',
      readable: { label: 'actions.read_plaque', text: 'readable.plaque' },
    },
  };
  c.rooms[`${prefix}:room/study`].details.desk.readable = {
    label: 'actions.read_desk',
    text: 'readable.desk',
  };
  Object.assign(c.text, {
    'detail.plaque': 'A brass plaque beside the door.',
    'actions.read_plaque': 'Read the plaque',
    'actions.read_desk': 'Read the desk note',
    'readable.plaque': PLAQUE,
    'readable.desk': DESK_NOTE,
  });
}

// Real elapsed time at 50 game seconds per wall second from 64800 (codex has no calendar).
export function realElapsed(c: any) {
  c.calendar = { start: 64800 };
  c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
  c.manifest.requires.capabilities.calendar = 1;
  c.lock.capabilities.calendar = 1;
}

/** A portable chest in the study whose lid starts `initial` and needs no key. */
export const chest =
  (initial: 'open' | 'closed' = 'open') =>
  (c: any) => {
    c.items[`${prefix}:item/chest`] = {
      key: 'chest',
      keywords: ['chest'],
      name: 'item.chest.short',
      room_line: 'item.chest.room',
      description: 'item.chest.description',
      mass_grams: 8000,
      capacity: 12,
      location: { in: 'room', room: ref('room', 'study') },
      barrier: ref('barrier', 'chest_lid'),
      container: true,
    };
    c.barriers = {
      ...c.barriers,
      [`${prefix}:barrier/chest_lid`]: {
        key: 'chest_lid',
        keywords: ['lid', 'chest_lid'],
        name: 'barrier.chest_lid.short',
        initial,
      },
    };
    c.manifest.requires.capabilities.barrier = 1;
    c.lock.capabilities.barrier = 1;
    Object.assign(c.text, {
      'item.chest.short': 'a chest',
      'item.chest.room': 'A [chest](chest) stands by the desk.',
      'item.chest.description': 'A plain wooden chest.',
      'barrier.chest_lid.short': 'the chest lid',
    });
  };
