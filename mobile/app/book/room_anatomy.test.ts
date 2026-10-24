// The World page is the five parts and nothing else (book-ui.md, Room page anatomy; owner decision
// 2026-10-23): title, description with fixture links, people, items, the event log.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Game, GameView } from '../../packages/game-view/session.ts';
import { nodes, words } from './__tests__/polish-book.test.ts';
import { pressable } from './__tests__/control.test.ts';
import { group, type Page } from './model.ts';
import { presenter } from './presenter.ts';

const SAY: Record<string, string> = {
  'room.forge': 'Forge',
  'room.forge.d': 'Soot cakes the [hearth](hearth). A [sign](sign) is nailed up.',
  'room.yard': 'Yard',
  'npc.smith': 'the smith',
  'item.tongs': 'tongs',
  'detail.hearth': 'hearth',
  'detail.sign': 'sign',
  'detail.flyer': 'flyer',
  'detail.bed': 'cot',
  'detail.ferry': 'ferry',
  'detail.board': 'board',
  'action.look': 'Look',
  'action.read': 'Read',
  'action.gather_ash': 'Gather ash',
  'action.fish': 'Fish',
  'aside.place': 'The bellows wheeze.',
  'aside.npc': 'The smith grunts.',
  'cue.hammering': 'Hammering',
  'cue.heat': 'Heat beats out from the forge.',
  'warn.ice': 'The north path is iced.',
  'choice.prompt': 'Well?',
  'transport.ferry': 'Cross',
};
const none = { kind: 'none' } as const;
const action = (key: string, more: object = {}) => ({
  action_key: key,
  label: `action.${key}`,
  available: true,
  input: [],
  target: none,
  ...more,
});
const read = (id: string) =>
  action('read', {
    target: { kind: 'entity', scopes: ['inspectable_details'] },
    target_ids: [id],
  });
const detail = (key: string, more: object = {}) => ({
  id: key,
  key,
  title: `detail.${key}`,
  description: `detail.${key}`,
  ...more,
});
const forge = (more: object = {}) =>
  ({
    actor_id: 'me',
    place: {
      id: 'forge',
      title: { key: 'room.forge' },
      description: { key: 'room.forge.d' },
      asides: [{ key: 'aside.place' }],
    },
    actions: [
      action('look'),
      action('gather_ash'),
      action('fish', { available: false, reason: { code: 'cooldown' } }),
      read('sign'),
      read('flyer'),
    ],
    storylet: 'gather_ash',
    exits: [{ direction: 'north', available: true, warning: 'warn.ice' }],
    entities: [
      { id: 'smith', name: 'npc.smith', kind: 'npc', actions: [], asides: [{ key: 'aside.npc' }] },
      { id: 'tongs', name: 'item.tongs', kind: 'item', actions: [] },
    ],
    notices: [
      detail('hearth', { actions: [action('gather_ash')] }),
      detail('sign'),
      detail('flyer'),
      detail('bed', { bed: true }),
      detail('ferry', {
        transport: {
          route: { cartridge_id: 'c', cartridge_version: '1.0.0', kind: 'transport', key: 'r' },
          ...{ fare: 0, charge: 0, waived: false, label: 'transport.ferry' },
          action: action('use_transport'),
        },
      }),
    ],
    notice_boards: [detail('board', { notices: [detail('flyer2')] })],
    cues: [
      { sense: 'sound', text: 'cue.hammering', direction: 'east' },
      { sense: 'heat', text: 'cue.heat' },
    ],
    choice: {
      speaker_id: 'absent',
      prompt: { key: 'choice.prompt' },
      choices: [],
      closable: true,
      continuation_id: 'k',
    },
    inventory: [],
    journal: [],
    time: 0,
    ...more,
  }) as unknown as GameView;

const game = (current: () => GameView): Game => ({
  view: () => ({ view: current(), token: 't' }),
  invoke: () => ({ kind: 'stale_view' }),
  pending: () => false,
  pendingInvocation: () => undefined,
  subscribe: () => () => {},
  text: (key) => SAY[key],
  lastNarration: () => undefined,
});

const world = async (view: GameView, opened: Page[] = [], pressed: string[] = []) => {
  const { Body } = await import('./Body.tsx');
  const screen = presenter(game(() => view)).screen();
  const press = (b: { action_key: string }) => pressed.push(b.action_key);
  const nop = () => {};
  return nodes(
    Body({
      screen,
      g: group(screen.buttons),
      press,
      open: (page: Page) => opened.push(page),
      ...{ startOver: nop, chapterDone: nop, world: nop, back: nop, talkOn: nop },
    } as never),
  );
};

// Breaks: any removed block restored (World verb lines, the refused note, the storylet card, the
// unlinked notice, board, bed and ferry entries, the cue block, an aside drawn on the page).
test('the World page draws only title, linked prose, people, items and log', async () => {
  const drawn = await world(forge());
  assert.deepEqual(
    drawn.filter(pressable).map((n) => n.props.accessibilityLabel),
    [
      'Forge, look',
      'hearth, open',
      'sign, open',
      'The smith, open',
      'Tongs, open',
      // Still open (loka-x6t.127 follow-ups): the Continue conversation control.
      'Continue conversation',
    ],
  );
  const page = drawn
    .filter((n) => n.type === 'Text')
    .map(words)
    .join('\n');
  for (const gone of [
    'Gather ash',
    'Fish',
    'not yet',
    'flyer',
    'cot',
    'ferry',
    'board',
    'The bellows wheeze.',
    'The smith grunts.',
  ])
    assert.ok(!page.includes(gone), `${gone} is drawn on World`);
  // A cue is a log line only: a restored cue block would draw it twice.
  for (const cue of ['Hammering', 'Heat beats'])
    assert.equal(page.split(cue).length - 1, 1, `${cue} drawn once`);
  // Still open (loka-x6t.127 follow-ups): the exit warning note.
  assert.ok(page.includes('The north path is iced.'));
});

// Breaks: an unlinked bed or ferry stays unreachable from its prose link, or a bed's link sleeps
// (presses its offer) instead of only opening its page; a readable link stops reading.
test('a linked notice, bed and board open from the prose; only a readable reads', async () => {
  const opened: Page[] = [];
  const pressed: string[] = [];
  const linked = forge({
    place: {
      id: 'forge',
      title: { key: 'room.forge' },
      description: { key: 'room.linked' },
    },
  });
  SAY['room.linked'] = 'A [sign](sign), a [cot](bed) and a [board](board).';
  const drawn = await world(linked, opened, pressed);
  for (const name of ['sign', 'cot', 'board'])
    drawn
      .find((n) => pressable(n) && n.props.accessibilityLabel === `${name}, open`)
      .props.onPress();
  assert.deepEqual(opened, [
    { kind: 'notice', id: 'sign' },
    { kind: 'notice', id: 'bed' },
    { kind: 'board', id: 'board' },
  ]);
  assert.deepEqual(pressed, ['read']);
});

// Breaks: a cue not logged, logged twice in one visit (re-render, a cue that stops and returns),
// logged before the room's narration and arrivals, or not logged anew on the next visit.
test('each sense cue is one log line, once per room visit, after the narration', async () => {
  const here = (more: object = {}) => forge({ choice: undefined, ...more }); // narration goes to World
  let view = here();
  let narration: object | undefined = {
    command_id: 'c1',
    lines: [{ key: 'room.forge' }, { key: 'You step in.' }],
  };
  let token = 0; // each update is a new projection, else the presenter skips it
  const g = {
    ...game(() => view),
    view: () => ({ view, token: String(token) }),
    lastNarration: () => narration,
  } as Game;
  const p = presenter(g);
  const show = (next: GameView) => {
    view = next;
    token += 1;
    p.update({ kind: 'state', projection: g.view(), status: { kind: 'ready' } } as never);
    return [...p.screen().log];
  };
  const cues = ['Hammering from the east', 'Heat beats out from the forge.'];
  assert.deepEqual(p.screen().log, ['You step in.', ...cues]);
  narration = undefined;
  assert.deepEqual(show(here()), ['You step in.', ...cues]);
  assert.deepEqual(show(here({ cues: undefined })), ['You step in.', ...cues]);
  assert.deepEqual(show(here()), ['You step in.', ...cues]);
  const yard = here({ place: { id: 'yard', title: { key: 'room.yard' } }, cues: undefined });
  assert.deepEqual(show(yard), []);
  assert.deepEqual(show(here()), cues);
});
