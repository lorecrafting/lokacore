// Content reports (cartridge.md Content reports; kernel/ts/play/reach.ts): the content graph and
// static reachability report on hand-written cartridge literals holding only the fields the tool
// reads. Expected lists are hand-derived from each literal.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentGraph, reachReport } from '../play/reach.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

const R = (kind: string, key: string) => ({ cartridge_id: 'f', cartridge_version: '1', kind, key });
const defs = (kind: string, d: Obj) =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [`f@1:${kind}/${k}`, v]));
const read = (key: string) => ({ op: 'fact_compare', fact: R('fact', key), equals: true });
const base = { manifest: { id: 'f', version: '1' }, lock: { capabilities: {} } };

// hall (entry) east to yard; yard north to vault through the locked door (key: the key, in the
// yard); attic has no way in. The guard (yard) sells the arrow and holds bread; the hermit is in
// the attic and holds the pearl.
const fixture = (keyIn = 'yard', hermit: Obj = {}) => ({
  ...base,
  entry: R('room', 'hall'),
  rooms: defs('room', {
    hall: { exits: { east: { to: R('room', 'yard') } } },
    yard: {
      exits: {
        west: { to: R('room', 'hall') },
        north: { to: R('room', 'vault'), barrier: R('barrier', 'door') },
      },
    },
    vault: { exits: { south: { to: R('room', 'yard'), barrier: R('barrier', 'door') } } },
    attic: { exits: {} },
  }),
  barriers: defs('barrier', { door: { initial: 'locked', key_item: R('item', 'key') } }),
  items: defs('item', {
    key: { location: { in: 'room', room: R('room', keyIn) } },
    coin: { location: { in: 'room', room: R('room', 'vault') } },
    gem: { location: { in: 'room', room: R('room', 'attic') } },
    bread: { location: { in: 'npc', npc: R('npc', 'guard') } },
    pearl: { location: { in: 'npc', npc: R('npc', 'hermit') } },
    spare: { location: { in: 'template' } },
    arrow: { location: { in: 'template' } },
  }),
  npcs: defs('npc', {
    guard: { room: R('room', 'yard'), shop: { offers: [{ item: R('item', 'arrow') }] } },
    hermit: { room: R('room', 'attic'), ...hermit },
  }),
  dialogues: defs('dialogue', {
    talk_guard: {
      npc: R('npc', 'guard'),
      roles: {},
      policy: { root: read('f_rw') },
      choices: {
        yes: {
          sequence: [
            { op: 'quest.accept', quest: R('quest', 'q1') },
            { op: 'fact.assign', fact: R('fact', 'f_rw'), value: true },
            { op: 'fact.assign', fact: R('fact', 'f_wo'), value: true },
          ],
        },
      },
    },
    talk_hermit: {
      npc: R('npc', 'hermit'),
      roles: {},
      policy: { root: read('f_ro') },
      choices: { yes: { sequence: [{ op: 'quest.accept', quest: R('quest', 'q2') }] } },
    },
  }),
  quests: defs('quest', { q1: {}, q2: {} }),
  facts: defs('fact', { f_rw: {}, f_wo: {}, f_ro: {}, f_none: {} }),
});

test('the report lists what the entry never reaches, what a lock holds back and the orphans', () => {
  assert.deepEqual(reachReport(fixture()), {
    unreachable: {
      rooms: ['f@1:room/attic'],
      items: ['f@1:item/gem', 'f@1:item/pearl'],
      npcs: ['f@1:npc/hermit'],
      dialogues: ['f@1:dialogue/talk_hermit'],
      quests: ['f@1:quest/q2'],
    },
    behind_lock: { rooms: ['f@1:room/vault'], items: ['f@1:item/coin'] },
    orphan_items: ['f@1:item/spare'],
    orphan_facts: {
      unused: ['f@1:fact/f_none'],
      write_only: ['f@1:fact/f_wo'],
      read_only: ['f@1:fact/f_ro'],
    },
  });
});

test('a key behind its own lock leaves the vault unreachable, as BARRIER_UNREACHABLE_KEY says', () => {
  const report = reachReport(fixture('vault'));
  assert.deepEqual(report.unreachable.rooms, ['f@1:room/attic', 'f@1:room/vault']);
  assert.deepEqual(report.behind_lock, { rooms: [], items: [] });
});

test('an NPC whose schedule visits a reached room is reachable', () => {
  const hermit = { daily_schedule: { '8': R('room', 'yard') } };
  assert.deepEqual(reachReport(fixture('yard', hermit)).unreachable.npcs, []);
});

test('a quest a reached room names is reachable', () => {
  const c: Obj = fixture();
  c.rooms['f@1:room/yard'].variants = [
    { when: { root: { op: 'quest_state', quest: R('quest', 'q2') } } },
  ];
  assert.deepEqual(reachReport(c).unreachable.quests, []);
});

test('a quest with its own offer and no dialogue is reachable', () => {
  const c: Obj = fixture();
  c.quests['f@1:quest/q2'].offer = { policy: { root: { op: 'all', items: [] } } };
  assert.deepEqual(reachReport(c).unreachable.quests, []);
});

test('the graph holds every DefinitionRef with its path, and the op of the step holding it', () => {
  const { nodes, edges } = contentGraph(fixture());
  assert.deepEqual(nodes[0], { ref: 'f@1:room/hall', kind: 'room' });
  assert.ok(edges.some((e) => e.from === 'entry' && e.to === 'f@1:room/hall' && e.path === ''));
  const exit = edges.find((e) => e.from === 'f@1:room/hall' && e.to === 'f@1:room/yard');
  assert.equal(exit?.path, '.exits.east.to');
  assert.deepEqual(
    edges.filter((e) => e.to === 'f@1:fact/f_wo'),
    [
      {
        from: 'f@1:dialogue/talk_guard',
        to: 'f@1:fact/f_wo',
        path: '.choices.yes.sequence[2].fact',
        op: 'fact.assign',
      },
    ],
  );
});

// A cartridge without rooms or an entry (ashmere_hello). Each fact is read by the policy; the
// engine writes it at a site with no op, or owns it (skill_blade under skills@1, a patrol's
// trust); the topic's fact is also read by the codex. None is read_only or write_only.
test('engine write sites and engine-owned facts are not reported read_only', () => {
  const c = {
    ...base,
    skills: defs('skill', { blade: { key: 'blade' } }),
    world: { death_credit: [{ fact: R('fact', 'slain') }] },
    topics: defs('topic', { mill: { fact: R('fact', 'known') } }),
    scenes: defs('scene', { end: { on_end: { assign: [{ fact: R('fact', 'ended') }] } } }),
    quests: defs('quest', {
      trip: { expedition: { survived_fact: R('fact', 'survived') } },
      walk: { patrol: { trust_fact: R('fact', 'trust') } },
    }),
    policies: defs('policy', {
      p: {
        root: {
          op: 'all',
          items: ['slain', 'ended', 'survived', 'trust', 'skill_blade'].map(read),
        },
      },
    }),
    facts: defs('fact', {
      slain: {},
      known: {},
      ended: {},
      survived: {},
      trust: {},
      skill_blade: {},
    }),
  };
  assert.deepEqual(reachReport(c).orphan_facts, { unused: [], write_only: [], read_only: [] });
});
