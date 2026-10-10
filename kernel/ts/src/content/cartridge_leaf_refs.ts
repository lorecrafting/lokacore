// Each policy leaf's reference fields, each mapped to its definition kind; twin of
// Loka.Content.LeafRefs, checked in tags.test.ts (mechanics.md policy leaf set).
export const LEAF_REFS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  fact_compare: { fact: 'fact' },
  has_item: { item: 'item' },
  quest_state: { quest: 'quest' },
  escort_state: { quest: 'quest' },
  barrier_state: { barrier: 'barrier' },
  stat_compare: { attribute: 'attribute' },
  resource_compare: { resource: 'resource' },
  has_tag: { item: 'item', barrier: 'barrier', room: 'room' },
  visited_count: { room: 'room' },
};
