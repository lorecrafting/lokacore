// A skill's one line and its sound, and the `gained` fill (book-ui.md, Skill tree details); expected values by hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '../../packages/game-view/session.ts';
import { cuesOf } from './cues.ts';
import { skillEvents } from './received.ts';
import { lineWords } from './words.ts';
import { words } from './__tests__/polish-book.test.ts';

const { Professions, SkillDetails } = await import('./skills.tsx');

const base = {
  actor_id: 'a',
  place: { id: 'p', title: 't', description: 'd' },
  exits: [],
  actions: [],
  entities: [],
  inventory: [],
  journal: [],
  time: 0,
} as unknown as GameView;
const s = (acquired: boolean, level?: number, more: object = {}) => ({
  skill: { key: 'k', kind: 'skill' },
  label: 'label',
  acquired,
  level,
  ...more,
});
const view = (skill?: object) => ({ ...base, ...(skill && { skills: [skill] }) }) as GameView;
const rank = { rank: { label: 'r', reached: 'reached' } };
const say = (k: string) => k;

// Each row: skill before (none: not shown), skill after, the one line, the one sound.
// Breaks, by row: teach-plus-rise says two lines; the key is read before `learned`; an untaught
// rise tones or composes; a newly shown untaught skill speaks; a rise on a taught skill ignores `reached`.
const ROWS: [string, object | undefined, object, string | undefined, string | undefined][] = [
  [
    'taught: learned',
    s(false),
    s(true, 1, { learned: 'learned', ...rank }),
    'learned',
    'skill_learned',
  ],
  ['taught: reached', s(false), s(true, 1, rank), 'reached', 'skill_learned'],
  ['taught: composed', s(false), s(true, 1), 'You learn label.', 'skill_learned'],
  ['taught, first shown', undefined, s(true, 1), 'You learn label.', 'skill_learned'],
  [
    'taught and risen, once',
    s(false, 1),
    s(true, 2, { learned: 'learned', ...rank }),
    'learned',
    'skill_learned',
  ],
  ['rise taught: reached', s(true, 1), s(true, 2, rank), 'reached', 'skill_up'],
  ['rise taught: composed', s(true, 1), s(true, 2), 'Your label improves.', 'skill_up'],
  ['rise untaught: reached', s(false, 1), s(false, 2, rank), 'reached', 'skill_up'],
  ['rise untaught: nothing', s(false, 1), s(false, 2), undefined, undefined],
  ['first shown untaught', undefined, s(false, 3, rank), undefined, undefined],
  ['no change', s(true, 2, rank), s(true, 2, rank), undefined, undefined],
];
for (const [name, was, now, line, cue] of ROWS) {
  test(`skill line and sound agree: ${name}`, () => {
    assert.deepEqual(
      skillEvents(view(was), view(now), say),
      line ? [{ text: line, event: true, gilt: true }] : [],
    );
    assert.deepEqual(
      cuesOf(view(now), view(was)).map((c) => c.name),
      cue ? [cue] : [],
    );
  });
}

// Breaks: skills of two kinds sharing a key read as one.
test('a skill matches on key and kind', () => {
  const other = { ...s(true, 5), skill: { key: 'k', kind: 'other' } };
  assert.deepEqual(
    skillEvents(view(other), view(s(true, 5)), say).map((l) => l.text),
    ['You learn label.'],
  );
});

const line = (bindings?: object) =>
  lineWords(
    { key: 'gained', bindings } as never,
    (k) => (k === 'gained' ? 'Gain {amount} of {x}.' : k),
    base,
  );

// Breaks: the bound slot stays raw, or an unbound brace is erased (authored text is shown as written).
test('a bound slot fills and an unbound one stays literal', () => {
  assert.match(line({ amount: 3 }) ?? '', /Gain 3 of \{x\}\./);
});

// Breaks: a ranked row keeps ", level N", or an unranked row loses it.
test('a ranked row reads its rank in place of the level', () => {
  const row = (more: object) => ({ ...s(true, 2, more), profession: 'p' });
  const profession = (skill: object) =>
    words(Professions({ view: view(skill), text: say }) as never);
  assert.match(profession(row(rank)), /label — r — /);
  assert.doesNotMatch(profession(row(rank)), /level 2/);
  assert.match(profession(row({})), /label, level 2 — /);
  assert.match(
    words(SkillDetails({ view: view(s(true, 2, rank)), text: say }) as never),
    /label — r — /,
  );
});
