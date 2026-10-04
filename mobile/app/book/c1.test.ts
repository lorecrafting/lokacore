// C1 presenter regressions on controlled GameView inputs; device layout proof is separate.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Game, GameView } from '../../packages/game-view/session.ts';
import { bandPhrase, group, pagesAfter, said, type Page, type Pool } from './model.ts';
import { presenter } from './presenter.ts';

const action = (action_key: string, available = true) => ({
  action_key,
  available,
  label: `action.${action_key}`,
  input: [],
  target: { kind: 'none' },
});
const item = (id: string, actions: unknown[] = [], extra = {}) => ({
  id,
  name: `item.${id}`,
  kind: 'item',
  actions,
  ...extra,
});
const room = (extra = {}) =>
  ({
    actor_id: 'actor',
    place: { id: 'room', title: { key: 'room.title' } },
    actions: [],
    exits: [],
    entities: [],
    inventory: [],
    journal: [],
    time: 0,
    ...extra,
  }) as unknown as GameView;
const game = (view: GameView): Game => ({
  view: () => ({ view, token: 'view:drawn' }),
  invoke: () => ({ kind: 'stale_view' }),
  pending: () => false,
  pendingInvocation: () => undefined,
  subscribe: () => () => {},
  text: (key) => ({ 'door.gate': 'the gate', 'item.coat': 'a coat' })[key],
  lastNarration: () => undefined,
});

// Breaks: treating a directional door control as a move, losing its direction or targeting an item.
test('exit door actions keep their direction and remain separate from walking', () => {
  const p = presenter(
    game(
      room({
        exits: [
          {
            direction: 'north',
            available: true,
            door: {
              name: 'door.gate',
              state: 'open',
              actions: [action('close'), action('lock', false)],
            },
          },
        ],
      }),
    ),
  );
  const g = group(p.screen().buttons);
  assert.deepEqual(
    g.exits.map((e) => e.button.label),
    ['Go north'],
  );
  assert.deepEqual(
    g.door('north').map((b) => b.label),
    ['Close the gate (north)'],
  );
  assert.deepEqual(g.place, []);
});

// Breaks: wear/remove or nested take omitted because only room entities and loose inventory are read.
test('worn items and reachable nested contents offer actions on their own ids', () => {
  const p = presenter(
    game(
      room({
        entities: [
          item('chest', [action('open')], {
            contents: [item('letter', [action('take')], { container_id: 'chest' })],
          }),
        ],
        inventory: [item('coat', [action('wear')])],
        equipment: [{ slot: 'head', item: item('hat', [action('remove')]) }],
      }),
    ),
  );
  assert.deepEqual(
    p.screen().buttons.map((b) => [b.action_key, b.target_ids]),
    [
      ['open', ['chest']],
      ['take', ['letter']],
      ['wear', ['coat']],
      ['remove', ['hat']],
    ],
  );
});

// Breaks: opening a container or wearing an item loses its page; closing its ancestor leaves a stale page.
test('same-room actions retain projected item pages and remove pages hidden by a closed lid', () => {
  const stack: Page[] = [
    { kind: 'carrying' },
    { kind: 'thing', id: 'chest' },
    { kind: 'thing', id: 'letter' },
  ];
  const open = room({
    inventory: [item('chest', [], { contents: [item('letter', [], { container_id: 'chest' })] })],
  });
  assert.deepEqual(pagesAfter(stack, open, open), stack);
  assert.deepEqual(pagesAfter(stack, open, room({ inventory: [item('chest')] })), [
    { kind: 'carrying' },
    { kind: 'thing', id: 'chest' },
  ]);
  assert.deepEqual(
    pagesAfter(
      [{ kind: 'thing', id: 'coat' }],
      room({ inventory: [item('coat')] }),
      room({ equipment: [{ slot: 'body', item: item('coat') }] }),
    ),
    [{ kind: 'thing', id: 'coat' }],
  );
  assert.deepEqual(pagesAfter(stack, open, room({ place: { id: 'elsewhere' } })), []);
});

// Breaks: ordinary views repeat a dismissed title or scene continuations drop the queued new chapter.
test('chapter changes queue one title which survives scene lines and acknowledgement', () => {
  const before = room({ chapter: { index: 0, title: 'chapter.first' } });
  const line1 = room({ chapter: { index: 1, title: 'chapter.second' }, scene: { index: 1 } });
  const title = pagesAfter([], before, line1);
  assert.deepEqual(title, [{ kind: 'chapter' }]);
  const line2 = room({ chapter: { index: 1, title: 'chapter.second' }, scene: { index: 2 } });
  assert.deepEqual(pagesAfter(title, line1, line2), [{ kind: 'chapter' }]);
  const ended = room({ chapter: { index: 1, title: 'chapter.second' } });
  assert.deepEqual(pagesAfter(title, line2, ended), [{ kind: 'chapter' }]);
  assert.deepEqual(pagesAfter([], ended, ended), []);
});

// Breaks: a custom band is displayed as its internal key; the Character accessibility label ignores prose.
test('band phrases and the hp accessibility label use the cartridge catalog', () => {
  const hp = {
    resource: { key: 'hp' },
    current: 4,
    maximum: 10,
    band: 'winded',
    tone: 'danger',
  } as Pool;
  const text = (key: string) => (key === 'band.winded' ? 'needs a breath' : key);
  assert.equal(bandPhrase(hp, text), 'needs a breath');
  assert.equal(said([hp], text), 'Character, hp 4 of 10, needs a breath');
  assert.equal(
    bandPhrase(hp, () => undefined),
    'winded',
  );
});

// Breaks: Continue or position controls also appear as ordinary room actions, duplicating controls.
test('scene Continue and position verbs have dedicated groups', () => {
  const buttons = ['continue', 'stand', 'sleep'].map((action_key) => ({
    label: action_key,
    action_key,
    target_ids: [],
    input: {},
  }));
  const g = group(buttons);
  assert.equal(g.continue?.action_key, 'continue');
  assert.deepEqual(
    g.position.map((b) => b.action_key),
    ['stand', 'sleep'],
  );
  assert.deepEqual(g.place, []);
});
