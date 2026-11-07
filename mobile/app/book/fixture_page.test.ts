// A fixture the room description links opens its page (book-ui.md fixture rule, Notice-board
// details; loka-x6t.120). Hand view: the hearth with a Gather ash offer and no Read.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes, words } from './__tests__/polish-book.test.ts';
import { buttonsOf } from './buttons.ts';
import { group, intentOf } from './model.ts';

const TEXT: Record<string, string> = {
  'room.loft.title': 'Loft',
  'room.loft.description': 'A low loft. A [hearth](hearth) smokes in the corner.',
  'detail.hearth.title': 'The hearth',
  'detail.hearth.description': 'A cold hearth, grey with ash.',
  'actions.gather_ash': 'Gather ash',
};
const draw = async (
  offer: object = {},
  prose = TEXT['room.loft.description'],
  actions: object[] = [],
) => {
  const text = (key: string) => (key === 'room.loft.description' ? prose : (TEXT[key] ?? key));
  const { RoomPage } = await import('./Body.tsx');
  const { NoticePage, proseLinks } = await import('./notices.tsx');
  const view = {
    place: { title: { key: 'room.loft.title' }, description: { key: 'room.loft.description' } },
    exits: [],
    entities: [],
    inventory: [],
    actions,
    notices: [
      {
        id: 'n1',
        key: 'hearth',
        title: 'detail.hearth.title',
        description: 'detail.hearth.description',
        actions: [
          {
            action_key: 'gather_ash',
            label: 'actions.gather_ash',
            target: { kind: 'none' },
            input: [],
            available: true,
            ...offer,
          },
        ],
      },
    ],
  } as any;
  const done: unknown[] = [];
  const p = {
    screen: {
      view,
      text,
      label: text,
      buttons: buttonsOf(view, text, text),
      detail: () => [],
    },
    open: (page: unknown) => done.push(page),
    press: (b: any) => {
      const { action_key, target_ids, input } = intentOf(b);
      done.push({ action_key, target_ids, input });
    },
    world: () => done.push('world'),
  } as any;
  const room = nodes(
    RoomPage({
      view,
      text,
      log: [],
      g: { place: [], door: () => [] },
      press: () => {},
      open: () => {},
      links: proseLinks(p),
    } as any),
  );
  const page = nodes(NoticePage({ ...p, page: { kind: 'notice', id: 'n1' } }));
  return { room, page, done };
};

// Breaks: the link presses the fixture's first offer (it sent gather_ash on tap), the prose does
// not link the fixture, or its page card does not send the offer or leaves the page.
test('a linked fixture opens its page on tap and its card sends the offer', async () => {
  const { room, page, done } = await draw();
  const link = room.find((n) => n.props?.accessibilityLabel === 'hearth, open');
  assert.ok(link, 'no hearth link in the prose');
  link.props.onKeyDown({ key: 'Enter', preventDefault: () => {} });
  assert.deepEqual(done, [{ kind: 'notice', id: 'n1' }]);
  const shown = page.filter((n) => n.type === 'Text').map(words);
  assert.ok(shown.includes('The hearth') && shown.includes('A cold hearth, grey with ash.'));
  page.find((n) => n.props?.accessibilityLabel === 'Gather ash').props.onPress();
  assert.deepEqual(done.slice(1), [{ action_key: 'gather_ash', target_ids: [], input: {} }]);
});

// Break: a refused offer on the page reads `label: reason`, is not exposed as disabled, or is
// dropped with its reason (book-ui.md, Unavailable actions).
test('a refused fixture offer is an unavailable card under its plain label, its reason its hint', async () => {
  const { page } = await draw({ available: false, reason: { code: 'insufficient_resource' } });
  const card = page.find((n) => n.props?.accessibilityLabel === 'Gather ash');
  assert.deepEqual(card?.props.accessibilityState, { disabled: true });
  assert.equal(card.props.accessibilityHint, 'You are too exhausted.');
  assert.ok(!page.some((n) => n.type === 'Text' && words(n).includes(':')));
});

// Break (PR #464 ruling 4): a refused Read on a linked notice opens its page with no reason shown.
test('a refused Read draws its reason on the notice page', async () => {
  const read = {
    action_key: 'read',
    label: 'Read',
    available: false,
    reason: { code: 'x', message: { key: 'Too dark to read.' } },
    target: { kind: 'entity', scopes: ['inspectable_details'] },
    input: [],
    target_ids: ['n1'],
  };
  const { page } = await draw({}, undefined, [read]);
  const card = page.find((n) => n.props?.accessibilityLabel === 'Read');
  assert.equal(card?.props.accessibilityHint, 'Too dark to read.');
});

// Break (loka-vx2v): a quest offer on an NPC missing from the NPC's page, labelled with the NPC's
// name, drawn on the World card, or sending the NPC as a target.
test('a quest offer naming an NPC is a card on that page under its authored label', () => {
  const offer = {
    action_key: 'lantern',
    label: 'quest.lantern.accept',
    target: { kind: 'entity', scopes: ['room_occupants'] },
    target_ids: [],
    input: [],
    available: true,
  };
  const view = {
    exits: [],
    actions: [],
    inventory: [],
    entities: [{ id: 'bram', kind: 'npc', name: { key: 'npc.bram' }, actions: [offer] }],
  } as any;
  const text = (key: string) => (key === 'quest.lantern.accept' ? 'Carry the lantern' : 'Bram');
  const books = group(buttonsOf(view, text, text) as any);
  const [card] = books.on('bram');
  assert.equal(card?.label, 'Carry the lantern');
  assert.equal(books.place.length, 0);
  assert.deepEqual(intentOf(card!), { action_key: 'lantern', target_ids: [], input: {} });
});
