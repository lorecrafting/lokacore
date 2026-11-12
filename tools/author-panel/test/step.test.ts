// The Step tab's report logic (docs/design/story-tooling.md §D1), unit-level: which changes it
// reports between two views, which reactions it lists, and how a failing rule reads.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changedFacts, changedQuests, looked, lookedLine, pairViews, type Report } from '../src/step.ts';

// Breaks: a declared fact whose value is set for the first time reads as "unchanged" because the
// before view already carries its default row, so the step that set it says nothing.
test('a fact set for the first time is a change from its default', () => {
  const before = { facts: [{ row: 'r1', key: 'door_open', value: false, set: false }] };
  const after = { facts: [{ row: 'r1', key: 'door_open', value: true, set: true }] };
  assert.deepEqual(changedFacts(before, after), [{ key: 'door_open', from: false, to: true }]);
});

// Breaks: every fact in the after view is reported, so a step lists the whole book of facts.
test('only the facts whose value differs are reported', () => {
  const before = {
    facts: [
      { row: 'a', key: 'a', value: 1, set: true },
      { row: 'b', key: 'b', value: 2, set: true },
    ],
  };
  const after = {
    facts: [
      { row: 'a', key: 'a', value: 1, set: true },
      { row: 'b', key: 'b', value: 3, set: true },
    ],
  };
  assert.deepEqual(changedFacts(before, after), [{ key: 'b', from: 2, to: 3 }]);
});

// Breaks: a row that exists only in the after view (a subject-scoped fact the step created) is
// reported as a change from null, which reads as a value that moved when nothing did.
test('a row the before view does not have is not a change', () => {
  const before = { facts: [] as { row: string; key: string; value?: unknown; set?: boolean }[] };
  const after = { facts: [{ row: 'new', key: 'scoped', value: 1, set: true }] };
  assert.deepEqual(changedFacts(before, after), []);
});

// Breaks: an unset fact (null after) and a default row (false, unset) are compared as different
// values, so clearing a fact to unset reads as a change to its default.
test('an unset fact is not a change to its declared default', () => {
  const before = { facts: [{ row: 'r', key: 'open', value: false, set: false }] };
  assert.deepEqual(changedFacts(before, before), []);
});

// Breaks: quests are listed in full each step, or a resolved quest keeps the state it had.
test('a quest that changed state is reported, one that did not is not', () => {
  const before = {
    quests: [
      { quest: 'carry_letter', state: 'active' },
      { quest: 'reach_town', state: 'active' },
    ],
  };
  const after = {
    quests: [
      { quest: 'carry_letter', state: 'resolved' },
      { quest: 'reach_town', state: 'active' },
    ],
  };
  assert.deepEqual(changedQuests(before, after), [
    { quest: 'carry_letter', from: 'active', to: 'resolved' },
  ]);
});

const rule = (over: Partial<Report['reactions'][number]> = {}): Report['reactions'][number] => ({
  rule: 'door_opens',
  causes: [],
  fired: false,
  ...over,
});

// Breaks: every reaction the explainer lists is shown, so a step's panel names rules whose trigger
// never matched — the spec says a rule that matched no trigger is not listed.
test('a reaction that matched no trigger is not listed', () => {
  const report: Report = {
    ordinal: 3,
    command: 'look',
    outcome: 'accepted',
    reactions: [rule({ causes: [] }), rule({ rule: 'lamp_lights', causes: [{ event: 'looked' }], fired: true })],
  };
  assert.deepEqual(
    looked(report).map((x) => x.rule),
    ['lamp_lights'],
  );
});

// Breaks: a rule that matched but did not fire reads as fired, hiding the failing leaf.
test('a matched rule that did not fire names the first leaf that did not hold', () => {
  const line = lookedLine(
    rule({
      causes: [{ event: 'looked' }],
      fired: false,
      when: {
        op: 'all',
        held: false,
        items: [
          { op: 'light_off', held: true },
          { op: 'fact_compare', held: false, fact: { key: 'lamp_oil' }, equals: 'full' },
        ],
      },
    }),
  );
  assert.equal(line.ok, false);
  assert.match(line.text, /lamp_oil/);
});

// Breaks: a rule that fired reports a leaf instead of the word the panel keys its styling off.
test('a rule that fired reads as fired', () => {
  assert.deepEqual(lookedLine(rule({ causes: [{ event: 'x' }], fired: true })), {
    text: 'fired',
    ok: true,
    depth: 0,
  });
});

// Breaks: every `state` message is taken as a new step, so the before view is always the after view
// of the SAME step and no change is ever reported (the Book posts on every update, not per step).
test('a second state at the same step does not move after to before', () => {
  const a = { facts: [{ row: 'r', key: 'open', value: false }] };
  const b = { facts: [{ row: 'r', key: 'open', value: true }] };
  const first = pairViews({}, 'h:1', a);
  const again = pairViews(first, 'h:1', a); // a redraw of the same step
  assert.deepEqual(again.before, undefined);
  const next = pairViews(again, 'h:2', b);
  assert.deepEqual(next.before, a, 'the step before must be the view before the new step');
  assert.deepEqual(next.after, b);
  assert.deepEqual(changedFacts(next.before, next.after), [{ key: 'open', from: false, to: true }]);
});

// Breaks: a different artifact's step 3 pairs with the old artifact's step 3, reporting changes that
// never happened because the hash is what separates two runs' ordinals.
test('a step at a new artifact starts a new pair', () => {
  const a = { facts: [{ row: 'r', key: 'open', value: true }] };
  const b = { facts: [{ row: 'r', key: 'open', value: false }] };
  const one = pairViews({}, 'h1:3', a);
  const two = pairViews(one, 'h2:3', b);
  assert.deepEqual(two.before, a);
  assert.deepEqual(two.after, b);
});
