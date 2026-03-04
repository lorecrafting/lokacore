import type { Room } from '../types/game';

export const MOCK_ROOMS: Record<string, Room> = {
  awakening_clearing: {
    id: 'r1',
    key: 'awakening_clearing',
    name: 'Awakening Clearing',
    description:
      'Soft light filters through a canopy of silver leafed trees, casting dappled patterns across a carpet of luminescent moss. The air tastes faintly of copper and dew. A stone bench sits at the clearing\u2019s heart, its surface worn smooth by countless hands.',
    exits: [
      { direction: 'north', destination_key: 'heartwood_path' },
      { direction: 'east', destination_key: 'eastern_trail' },
      { direction: 'south', destination_key: 'stream_bank' },
    ],
    npcs: [
      { id: 'n1', key: 'thera', name: 'Thera', type: 'npc' },
      { id: 'n2', key: 'elder_maren', name: 'Elder Maren', type: 'npc' },
    ],
    items: [{ id: 'i1', key: 'worn_journal', name: 'a worn journal', type: 'item' }],
    players: [],
  },
  heartwood_path: {
    id: 'r2',
    key: 'heartwood_path',
    name: 'Heartwood Path',
    description:
      'Ancient roots arch overhead, forming a living tunnel that hums with deep resonance. Bioluminescent fungi trace veins of pale green light along the bark. The path narrows ahead, the trees pressing close as if listening.',
    exits: [
      { direction: 'south', destination_key: 'awakening_clearing' },
      { direction: 'north', destination_key: 'elder_tree_hollow' },
      { direction: 'west', destination_key: 'training_grove' },
    ],
    npcs: [{ id: 'n2', key: 'elder_maren', name: 'Elder Maren', type: 'npc' }],
    items: [],
    players: [],
  },
  eastern_trail: {
    id: 'r3',
    key: 'eastern_trail',
    name: 'Eastern Trail',
    description:
      'The trail winds between towering ferns whose fronds uncurl toward a pale sky. Somewhere ahead, the sound of running water mingles with birdsong that seems almost deliberate, as if rehearsed.',
    exits: [
      { direction: 'west', destination_key: 'awakening_clearing' },
      { direction: 'east', destination_key: 'stream_crossing' },
    ],
    npcs: [],
    items: [{ id: 'i2', key: 'smooth_stone', name: 'a smooth stone', type: 'item' }],
    players: [],
  },
  stream_bank: {
    id: 'r4',
    key: 'stream_bank',
    name: 'Stream Bank',
    description:
      'Cool water runs over polished stones, each one catching light from no visible source. The bank is soft with moss, and small creatures dart between the shallows. A faint metallic smell rises from the deeper pools.',
    exits: [
      { direction: 'north', destination_key: 'awakening_clearing' },
      { direction: 'east', destination_key: 'stream_crossing' },
    ],
    npcs: [{ id: 'n3', key: 'brennan', name: 'Brennan', type: 'npc' }],
    items: [],
    players: [],
  },
  elder_tree_hollow: {
    id: 'r5',
    key: 'elder_tree_hollow',
    name: 'Elder Tree Hollow',
    description:
      'The massive tree\u2019s interior opens into a cathedral of living wood. Shelves carved from the heartwood hold jars of preserved seeds and bundles of dried herbs. Light enters through gaps where branches meet, illuminating dust motes that drift like tiny stars.',
    exits: [{ direction: 'south', destination_key: 'heartwood_path' }],
    npcs: [],
    items: [{ id: 'i3', key: 'old_lantern', name: 'an old lantern', type: 'item' }],
    players: [],
  },
  training_grove: {
    id: 'r6',
    key: 'training_grove',
    name: 'Training Grove',
    description:
      'A circle of flattened earth surrounded by young trees bent into natural archways. Wooden training dummies stand at the edges, their surfaces scarred by countless practice strikes. The air smells of fresh sap and effort.',
    exits: [{ direction: 'east', destination_key: 'heartwood_path' }],
    npcs: [{ id: 'n4', key: 'tomas', name: 'Tomas', type: 'npc' }],
    items: [],
    players: [],
  },
  stream_crossing: {
    id: 'r7',
    key: 'stream_crossing',
    name: 'Stream Crossing',
    description:
      'Flat stones form a precarious bridge across the widening stream. The water here runs deeper, darker, carrying fragments of something that glints like broken glass. On the far bank, the trees thin and the light changes quality.',
    exits: [
      { direction: 'west', destination_key: 'eastern_trail' },
      { direction: 'north', destination_key: 'stream_bank' },
    ],
    npcs: [],
    items: [],
    players: [],
  },
};
