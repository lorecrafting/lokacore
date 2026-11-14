// The Facts table (docs/design/story-tooling.md F1 and W4) on a planted model: every expected
// value worked by hand from the design, never from the code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Story } from '../../../tools/author-panel/src/storylist.ts';
import * as F from '../../../tools/author-panel/src/storyfacts.ts';
import { factUsage } from '../play/reach.ts';

const ref = (kind: string, key: string) => `demo@1:${kind}/${key}`;
const [gold, seen, mood, ghost] = [
  ref('fact', 'gold'),
  ref('fact', 'seen'),
  ref('fact', 'mood'),
  ref('fact', 'ghost'),
];
const to = (r: string) => {
  const [id, kind] = r.split(':');
  const [cartridge_id, cartridge_version] = id!.split('@');
  const [k, key] = kind!.split('/');
  return { cartridge_id, cartridge_version, kind: k, key };
};

// gold: default 2, +5 twice and a -3 (ignored) in a `once` rule, +4 in a scene, so 16; a repeating
// rule adds 7, which L2a leaves out; read by a compare. seen: written, never read. mood: read, never written.
// ghost: nothing names it. position: the engine's, reserved by the lock.
const planted = {
  manifest: { id: 'demo', version: 1 },
  lock: { capabilities: { position: true } },
  scenes: {
    [ref('scene', 'mill')]: {
      control: 'leaveable',
      steps: [{ op: 'fact.adjust', fact: to(gold), amount: 4 }],
    },
  },
  story_points: {},
  skills: {},
  scripted_actions: {},
  world: {},
  topics: {},
  facts: {
    [gold]: {
      value_type: { type: 'int', default: 2, minimum: 0, maximum: 100 },
      scopes: ['story'],
    },
    [seen]: {
      value_type: { type: 'bool', default: false },
      scopes: ['story'],
      meaning: 'has seen the mill',
    },
    [mood]: { value_type: { type: 'int', default: 1, minimum: -5, maximum: 5 }, scopes: ['scene'] },
    [ghost]: { value_type: { type: 'int', default: 0 }, scopes: ['story'] },
    [ref('fact', 'position')]: { value_type: { type: 'int', default: 0 }, scopes: ['story'] },
  },
  reactions: {
    [ref('reaction', 'ring')]: {
      once: true,
      steps: [
        { op: 'fact.adjust', fact: to(gold), amount: 5 },
        { op: 'fact.adjust', fact: to(gold), amount: -3 },
        { op: 'fact.adjust', fact: to(gold), amount: 5 },
      ],
    },
    [ref('reaction', 'churn')]: {
      on: { event: 'action_used' },
      steps: [{ op: 'fact.adjust', fact: to(gold), amount: 7 }],
    },
    [ref('reaction', 'see')]: { steps: [{ op: 'fact.assign', fact: to(seen), value: true }] },
    [ref('reaction', 'look')]: { when: { op: 'fact_compare', fact: to(gold), value: 4 } },
    [ref('reaction', 'gate')]: { when: { op: 'fact_compare', fact: to(mood), value: 0 } },
  },
};

const rows = factUsage(planted as never);
const by = Object.fromEntries(rows.map((r) => [r.key, r]));

// Break: the sort puts a both-sides fact above an orphan, hiding the gap the table exists to show.
test('worst first: read only, write only, unused, then the rest by key', () => {
  assert.deepEqual(
    rows.map((r) => `${r.key} ${r.status} ${r.read}/${r.write}`),
    ['mood read_only 1/0', 'seen write_only 0/1', 'ghost unused 0/0', 'gold both 1/5'],
  );
});

// Break: W4's ceiling taken from the declared maximum (100), from every adjust including the
// negative (13), from a rule that may run again (23), or one that drops a scene's write (12),
// instead of the once-only positive ones (2 + 5 + 5 + 4 = 16). L2a's sum, so the lint and the
// table cannot disagree.
test('reach is the default plus the once-only positive adjusts; range is the minimum to it', () => {
  assert.equal(by.gold!.reach, 16);
  assert.equal(F.range(by.gold!), '0..16');
  assert.equal(F.range(by.mood!), '-5..1');
});

// Break: a fact with no declared minimum, or not an int, invents a range instead of showing none.
test('a fact without a declared minimum, or not an int, has no range to show', () => {
  assert.equal(F.range(by.ghost!), '');
  assert.equal(F.range(by.seen!), '');
});

// Break: `set` not the write count, or an empty meaning dropped, so a row's words name a different
// column than the eye reads.
test('a row carries every column in order, its type and its joined scopes', () => {
  const s = { facts: rows } as unknown as Story;
  const row = (k: string) => F.factRows(s).find((r) => r.key === k)!;
  assert.equal(row('seen').write, 1);
  assert.equal(
    row('seen').label,
    'seen · bool · false · story · has seen the mill · 1 · 0 · write_only · ',
  );
  assert.equal(row('gold').label, 'gold · int · 2 · story ·  · 5 · 1 · both · 0..16');
  // `gold` has no meaning, so the join of nine cells puts the gap between two separators
  assert.deepEqual(row('gold').label.split(' · '), [
    'gold',
    'int',
    '2',
    'story',
    '',
    '5',
    '1',
    'both',
    '0..16',
  ]);
  assert.equal(row('gold').scopes.join(' '), 'story');
});

// Break: the table lists the cartridge's `facts` as written, so the engine's own reserved fact
// shows as an orphan the author cannot fix.
test('the fact the compiler reserves for the engine is left out of the table', () => {
  assert.equal(
    rows.some((r) => r.key === 'position'),
    false,
  );
});

// Break: the quest repeat rule inverted, so a repeatable quest's write inflates the ceiling and a
// one-shot quest's is dropped. L2a (`lib/loka/content/lint_facts.ex:76`) counts a quest's adjust
// only when it fires once, i.e. when `repeatable` is not true: `once` writes 10 to a default-1 fact
// and reaches 11; `again` writes the same 10 and stays 1.
test('a quest counts its adjust unless it is repeatable, as L2a does', () => {
  const quest = (repeatable?: true) => ({
    ...(repeatable ? { repeatable } : {}),
    steps: [{ op: 'fact.adjust', fact: to(mood), amount: 10 }],
  });
  const reach = (withQuests: object) =>
    factUsage({ ...planted, quests: withQuests } as never).find((r) => r.key === 'mood')!.reach;
  assert.equal(reach({ [ref('quest', 'once')]: quest() }), 11); // 1 + 10
  assert.equal(reach({ [ref('quest', 'again')]: quest(true) }), 1); // repeatable: no count
});

// Break: the reaction's one-shot-event rule inverted, so a one-shot quest's reaction stops counting
// toward the ceiling. L2a (`lib/loka/content/lint_facts.ex:103-114`) repeats a reaction on a `@once`
// event only when its quest exists and is repeatable; otherwise the write is once-only and counts.
// `ring` writes 10 to a default-1 fact: on a one-shot quest 1 + 10 = 11, on a repeatable one 1.
test('a reaction on a quest event counts unless that quest is repeatable', () => {
  const reaction = (quest?: string) => ({
    on: { event: 'quest_resolved', ...(quest ? { quest: to(quest) } : {}) },
    steps: [{ op: 'fact.adjust', fact: to(mood), amount: 10 }],
  });
  const reach = (reactions: object, withQuests: object) =>
    factUsage({ ...planted, quests: withQuests, reactions } as never).find((r) => r.key === 'mood')!
      .reach;
  const q = (repeatable?: true) => ({ ...(repeatable ? { repeatable } : {}), steps: [] });
  const once = ref('quest', 'once');
  const again = ref('quest', 'again');
  const ring = (quest?: string) => ({ [ref('reaction', 'ring')]: reaction(quest) });

  assert.equal(reach(ring(once), { [once]: q() }), 11); // one-shot quest: 1 + 10
  assert.equal(reach(ring(again), { [again]: q(true) }), 1); // repeatable quest: no count
  assert.equal(reach(ring(), {}), 11); // no quest named: once-only, still counts
  assert.equal(reach(ring('demo@1:quest/missing'), { [once]: q() }), 11); // missing quest
});

// The panel's view of a Story: `factRows` keeps `factUsage`'s order (worst first) and its range.
test('factRows keeps the sort and copies the range', () => {
  const s = { facts: rows } as unknown as Story;
  assert.deepEqual(
    F.factRows(s).map((r) => `${r.key} ${r.range}`),
    ['mood -5..1', 'seen ', 'ghost ', 'gold 0..16'],
  );
});
