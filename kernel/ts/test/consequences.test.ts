// C1 (docs/design/story-tooling.md §2): a choice's consequences, the edge fields a preview needs
// (reach.ts's `value`/`leaf`, story.ts's `choice`), and why_words' annotated sentences. Hand-written
// cartridges holding only what each function reads, so every pin names the break it catches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consequences, type Model } from '../play/consequences.ts';
import { contentGraph, reachReport } from '../play/reach.ts';
import { links } from '../play/story.ts';
import { sentences } from '../play/why_words.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

const R = (kind: string, key: string) => ({ cartridge_id: 'f', cartridge_version: '1', kind, key });
const defs = (kind: string, d: Obj) =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [`f@1:${kind}/${k}`, v]));
const base = { manifest: { id: 'f', version: '1' }, lock: { capabilities: {} } };
const ref = (kind: string, key: string) => `f@1:${kind}/${key}`;
const fact = (key: string, value: unknown) => ({ op: 'fact.assign', fact: R('fact', key), value });
const compare = (key: string, extra: Obj = {}) => ({
  op: 'fact_compare',
  fact: R('fact', key),
  equals: true,
  ...extra,
});

// bram's `ask` writes two facts and starts a quest; `keep` reads `asked` and writes `silent`;
// `other` reads a fact nothing writes. The reaction `heard` names `ask`. ghost reads apples only.
const cartridge = (): Obj => ({
  ...base,
  rooms: defs('room', { yard: {}, attic: {} }),
  npcs: defs('npc', { bram: { room: R('room', 'yard') }, ghost: { room: R('room', 'attic') } }),
  quests: defs('quest', { find_lamp: {} }),
  dialogues: defs('dialogue', {
    bram_talk: {
      npc: R('npc', 'bram'),
      roles: {},
      choices: {
        ask: {
          steps: [
            fact('asked', true),
            { op: 'quest.activate', quest: R('quest', 'find_lamp') },
            fact('silent', true),
          ],
        },
        keep: { steps: [fact('silent', true)], policy: compare('asked') },
        other: { policy: compare('elsewhere') },
      },
    },
  }),
  reactions: defs('reaction', {
    heard: { on: { event: 'choice_resolved', choice: 'ask' }, steps: [fact('heard_it', true)] },
    // a trigger-side reader of `asked`: a scene whose `when` compares it
    lamp: { on: { event: 'quest_activated', quest: R('quest', 'find_lamp') }, steps: [] },
  }),
  facts: defs('fact', { asked: {}, silent: {}, elsewhere: {}, heard_it: {} }),
});

/** The Story model as story.ts serves it (`GET /story`): reach.ts's graph plus its dialogue links. */
const model = (c: Obj = cartridge()): Model => {
  const graph = contentGraph(c);
  graph.edges.push(...links(c));
  return { graph, report: reachReport(c) };
};
const bram = ref('dialogue', 'bram_talk');

test('reach turns a fact step into an edge carrying the value it writes', () => {
  const edge = contentGraph(cartridge()).edges.find(
    (e) => e.path === '.choices.ask.steps[0].fact',
  )!;
  assert.deepEqual([edge.to, edge.set, edge.value], [ref('fact', 'asked'), true, true]);
});

test('reach names the policy object a fact_compare reads, so a gate can be shown in words', () => {
  const edge = contentGraph(cartridge()).edges.find((e) => e.leaf)!;
  assert.deepEqual(edge.leaf, compare('asked'));
  assert.equal(edge.to, ref('fact', 'asked')); // it is still a read
});

// Break: a choice_resolved link that drops the name it filtered on, so a preview cannot say which
// choice sets it off.
test("story's choice_resolved link carries the choice it named", () => {
  const link = links(cartridge()).find((e) => e.op === 'choice_resolved')!;
  assert.deepEqual([link.from, link.to, link.choice], [bram, ref('reaction', 'heard'), 'ask']);
});

test("a choice's consequences list what it writes, then who reads it", () => {
  const c = consequences(model(), `${bram}#ask`);
  assert.deepEqual(
    c.hop1.map((e) => `${e.key} ${e.label}`),
    ['asked sets', 'find_lamp quest.activate', 'silent sets'],
  );
  assert.deepEqual(c.hop1[0]!.what, true);
  // `keep` reads `asked`; the reaction `lamp` starts on the quest it activated; `silent` has no
  // reader but its own write; the reaction that named this choice links in last
  assert.deepEqual(
    c.hop2.map((r) => `${r.key} via ${r.via}`),
    ['bram_talk#keep via asked', 'lamp via find_lamp', 'heard via choice_resolved'],
  );
  assert.equal(c.more, 0);
  // `asked` is read by `keep`, so only `silent` is a write nothing reads — a break that called every
  // write never-read would name both
  assert.deepEqual(c.neverRead, ['silent']);
});

test('a gate hop 1 settles says holds or fails, a gate on anything else is only a hint', () => {
  const c = consequences(model(), `${bram}#ask`);
  const keep = c.hop2.find((r) => r.key === 'bram_talk#keep')!;
  // `keep` runs after `ask` wrote asked = true, so its gate holds — the break is reporting a settled
  // gate as a hint (or the other way round)
  assert.deepEqual(keep.gates, [{ text: 'fact asked on the target needs true', ok: true }]);
  // the reaction reads no fact, so it shows no gate
  assert.deepEqual(c.hop2.find((r) => r.key === 'heard')!.gates, []);
});

test('a gate on a fact hop 1 never wrote is a hint, never a verdict', () => {
  const c: Obj = {
    ...base,
    rooms: defs('room', { yard: {} }),
    npcs: defs('npc', { bram: { room: R('room', 'yard') } }),
    dialogues: defs('dialogue', {
      t: {
        npc: R('npc', 'bram'),
        roles: {},
        choices: { go: { steps: [fact('wrote_one', true)] } },
      },
      u: { npc: R('npc', 'bram'), roles: {}, policy: compare('never_written') },
    }),
    facts: defs('fact', { wrote_one: {}, never_written: {} }),
  };
  // the reader's gate is on a fact nothing here wrote, so it is dashed; the fact `go` did write has
  // no reader, which is the never-read row
  const { hop1, hop2, neverRead } = consequences(model(c), 'f@1:dialogue/t#go');
  assert.deepEqual(
    hop1.map((e) => e.key),
    ['wrote_one'],
  );
  assert.deepEqual(neverRead, ['wrote_one']);
  // `u` is not a reader of `wrote_one`, so it is absent: the walk shows readers, not gates
  assert.deepEqual(hop2, []);
});

test('a read of the same fact twice is one row, and a `not` gate reads the value written', () => {
  const c: Obj = {
    ...base,
    rooms: defs('room', { yard: {} }),
    npcs: defs('npc', { bram: { room: R('room', 'yard') } }),
    dialogues: defs('dialogue', {
      t: {
        npc: R('npc', 'bram'),
        roles: {},
        choices: {
          go: { steps: [fact('door_open', true)], policy: compare('door_open') },
          shut: { policy: { op: 'not', item: compare('door_open') } },
        },
      },
    }),
    facts: defs('fact', { door_open: {} }),
  };
  const go = consequences(model(c), 'f@1:dialogue/t#go');
  assert.deepEqual(
    go.hop1.map((e) => `${e.key} ${e.label}`),
    ['door_open sets'],
  );
  // `shut` needs door_open not true; the write stores true, so its gate fails
  assert.deepEqual(
    go.hop2.map((r) => [r.key, r.gates]),
    [['t#shut', [{ text: 'fact door_open on the target needs not true', ok: false }]]],
  );
  // a choice that writes nothing has no hop 1 of its own to report
  assert.deepEqual(consequences(model(c), 'f@1:dialogue/t#shut').hop1, []);
});

test('the bare node walks its own steps and leaves other choices alone', () => {
  const c: Obj = {
    ...base,
    dialogues: defs('dialogue', {
      t: { npc: R('npc', 'bram'), roles: {}, on_end: { assign: [fact('ended', true)] } },
    }),
    npcs: defs('npc', { bram: { room: R('room', 'yard') } }),
    rooms: defs('room', { yard: {} }),
    facts: defs('fact', { ended: {} }),
  };
  const m = model(c);
  // a scene's or dialogue's `on_end` is the bare ref's own step, a choice's steps never are
  assert.deepEqual(
    consequences(m, 'f@1:dialogue/t').hop1.map((e) => `${e.key} ${e.label}`),
    ['ended sets'],
  );
  assert.deepEqual(consequences(m, 'f@1:dialogue/t#nope').hop1, []);
});

test('a fact hop 1 writes that nothing reads is named', () => {
  const c: Obj = {
    ...base,
    rooms: defs('room', { yard: {} }),
    npcs: defs('npc', { bram: { room: R('room', 'yard') } }),
    dialogues: defs('dialogue', {
      t: { npc: R('npc', 'bram'), roles: {}, choices: { go: { steps: [fact('lonely', true)] } } },
    }),
    facts: defs('fact', { lonely: {} }),
  };
  const { neverRead, hop2 } = consequences(model(c), 'f@1:dialogue/t#go');
  assert.deepEqual([neverRead, hop2], [['lonely'], []]);
});

test('a settled gate reads the value written, not the mere fact of a write', () => {
  const c: Obj = {
    ...base,
    rooms: defs('room', { yard: {} }),
    npcs: defs('npc', { bram: { room: R('room', 'yard') } }),
    dialogues: defs('dialogue', {
      t: { npc: R('npc', 'bram'), roles: {}, choices: { go: { steps: [fact('flag', false)] } } },
      u: { npc: R('npc', 'bram'), roles: {}, policy: compare('flag') },
    }),
    facts: defs('fact', { flag: {} }),
  };
  // the write stores false, so the reader's `equals: true` fails — a preview that read the write as
  // "true" because a write happened would say it holds
  assert.deepEqual(consequences(model(c), 'f@1:dialogue/t#go').hop2, [
    {
      ref: 'f@1:dialogue/u',
      key: 'u',
      via: 'flag',
      gates: [{ text: 'fact flag on the target needs true', ok: false }],
    },
  ]);
});

test('why_words reads an annotated leaf as a verdict, and an unannotated one as no verdict at all', () => {
  const one = (holds?: boolean | 'depends') =>
    sentences({ policy: { ...compare('asked'), ...(holds !== undefined && { holds }) } })[0];
  // the break: a leaf without `holds` reported as met, or an annotated one reported as a hint
  assert.deepEqual(one(true), { text: 'fact asked on the target needs true', ok: true, depth: 0 });
  assert.deepEqual(one('depends'), {
    text: 'fact asked on the target needs true',
    ok: 'depends',
    depth: 0,
  });
  assert.deepEqual(one(undefined), {
    text: 'fact asked on the target needs true',
    ok: false,
    depth: 0,
  });
});

// Break: a story point a choice reaches shows in hop 1 but hop 2 never asks who listens for it, so
// the scene that fires on the point looks like nothing follows.
test('a choice that reaches a story point fans out to the scenes and reactions on it', () => {
  const c: Obj = {
    ...base,
    rooms: defs('room', { yard: {} }),
    npcs: defs('npc', { bram: { room: R('room', 'yard') } }),
    scenes: defs('scene', {
      ash: { on: { story_point: R('story_point', 'fate'), outcome: 'burn' }, steps: [] },
    }),
    reactions: defs('reaction', {
      heard: { on: { event: 'story_point_reached', story_point: R('story_point', 'fate') } },
    }),
    dialogues: defs('dialogue', {
      t: {
        npc: R('npc', 'bram'),
        roles: {},
        choices: { burn: { story_point: R('story_point', 'fate') } },
      },
    }),
  };
  const { hop1, hop2 } = consequences(model(c), 'f@1:dialogue/t#burn');
  assert.deepEqual(
    hop1.map((e) => e.key),
    ['fate'],
  );
  assert.deepEqual(
    hop2.map((r) => `${r.key} via ${r.via}`),
    ['ash via fate', 'heard via fate'],
  );
});

// Break: a scene's own `on.story_point` is a trigger, not a write; reading it as one listed the
// scene as writing a point it only listens for.
test('a scene triggered by a story point does not write it', () => {
  const c: Obj = {
    ...base,
    scenes: defs('scene', {
      ash: { on: { story_point: R('story_point', 'fate'), outcome: 'burn' }, steps: [] },
    }),
  };
  assert.deepEqual(consequences(model(c), 'f@1:scene/ash').hop1, []);
});

// Break: gatesOf keeping only fact_compare leaves drops a reader's npc_present gate entirely, so a
// reaction that only fires with bram present looks unconditional.
test('every policy leaf a reader holds shows, and a leaf hop 1 cannot settle is only a hint', () => {
  const c: Obj = {
    ...base,
    rooms: defs('room', { yard: {} }),
    npcs: defs('npc', { bram: { room: R('room', 'yard') } }),
    dialogues: defs('dialogue', {
      t: {
        npc: R('npc', 'bram'),
        roles: {},
        choices: { go: { steps: [fact('flag', true)] } },
      },
      u: {
        npc: R('npc', 'bram'),
        roles: {},
        policy: {
          op: 'all',
          items: [compare('flag'), { op: 'npc_present', npc: R('npc', 'bram') }],
        },
      },
    }),
    facts: defs('fact', { flag: {} }),
  };
  assert.deepEqual(consequences(model(c), 'f@1:dialogue/t#go').hop2[0]!.gates, [
    { text: 'fact flag on the target needs true', ok: true },
    { text: 'npc bram is here', ok: 'depends' },
  ]);
});

// Break: treating fact.adjust as a write whose value is known settles a gate hop 1 cannot settle —
// `count` is 0 plus an amount only play computes, so a `count == 0` reader is not visibly out.
test('a fact.adjust write leaves its readers undecided, not settled false', () => {
  const c: Obj = {
    ...base,
    rooms: defs('room', { yard: {} }),
    npcs: defs('npc', { bram: { room: R('room', 'yard') } }),
    dialogues: defs('dialogue', {
      t: {
        npc: R('npc', 'bram'),
        roles: {},
        choices: {
          poke: { steps: [{ op: 'fact.adjust', fact: R('fact', 'count'), amount: 1 }] },
        },
      },
      u: { npc: R('npc', 'bram'), roles: {}, policy: compare('count') },
    }),
    facts: defs('fact', { count: {} }),
  };
  const { hop1, hop2 } = consequences(model(c), 'f@1:dialogue/t#poke');
  assert.deepEqual(
    hop1.map((e) => [e.key, e.what]),
    [['count', undefined]],
  );
  assert.deepEqual(hop2[0]!.gates, [
    { text: 'fact count on the target needs true', ok: 'depends' },
  ]);
});

// Break: a reader of two writes listed once per write, so the same scene appears twice with the same
// gates; and a fact written twice by one choice listed twice as never read.
test('a reader of two effects is one row naming both, and a repeated write is one never-read row', () => {
  const c: Obj = {
    ...base,
    rooms: defs('room', { yard: {} }),
    npcs: defs('npc', { bram: { room: R('room', 'yard') } }),
    scenes: defs('scene', {
      both: {
        variants: [{ when: { op: 'all', items: [compare('a'), compare('b')] }, description: 'x' }],
      },
    }),
    dialogues: defs('dialogue', {
      t: {
        npc: R('npc', 'bram'),
        roles: {},
        choices: {
          go: {
            steps: [fact('a', true), fact('b', true), fact('lonely', true), fact('lonely', true)],
          },
        },
      },
    }),
    facts: defs('fact', { a: {}, b: {}, lonely: {} }),
  };
  const { hop1, hop2, neverRead } = consequences(model(c), 'f@1:dialogue/t#go');
  assert.equal(hop1.length, 4); // hop 1 stays the authored steps, one row each
  assert.deepEqual(
    hop2.map((r) => [r.key, r.via]),
    [['both', 'a, b']],
  );
  assert.deepEqual(neverRead, ['lonely']);
});
