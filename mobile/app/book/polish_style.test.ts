// Polish batch 5 layout rules over controlled inputs (the harness: __tests__/polish-book.test.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes, words } from './__tests__/polish-book.test.ts';

const room = (description: string) => ({
  view: {
    place: { title: { key: 'Room' }, description: { key: description } },
    exits: [],
    entities: [],
  },
  text: (key: string) => key,
  log: [],
  g: { place: [] },
  press: () => {},
  open: () => {},
  openChoice: () => {},
  details: null,
});

// Breaks: a blank line in the authored description is shown as one run of text (the split dropped),
// a single line break splits a paragraph in two, or a trailing line break draws a blank line.
test('a blank line in the room description starts a new paragraph; a line break does not', async () => {
  const { RoomPage } = await import('./pages.tsx');
  const paragraphs = (description: string) =>
    nodes(RoomPage(room(description) as any))
      .filter(
        (n) => n.type === 'View' && [n.props.children].flat().every((c: any) => c?.type === 'Text'),
      )
      .map((n) => [n.props.children].flat().map(words));
  assert.deepEqual(paragraphs('The nave is cold.\n\nA bell rope hangs.\n'), [
    ['The nave is cold.', 'A bell rope hangs.'],
  ]);
  assert.deepEqual(paragraphs('The nave is cold.\nA bell rope hangs.'), [
    ['The nave is cold.\nA bell rope hangs.'],
  ]);
});

// Breaks (toolbox row FD2, book-ui.md Aside details): an aside is dropped, reordered, pressable,
// shows link markup, or moves off its place (World: after the prose, before the exit warnings;
// a notice: straight after the description, before its item state).
test('asides show as quiet lines after the description, in projected order', async () => {
  const { RoomPage } = await import('./pages.tsx');
  const { NoticePage } = await import('./notices.tsx');
  const asides = [{ key: 'You know these [runes](runes).' }, { key: 'A mason marked this.' }];
  const { Note } = await import('./lines.tsx');
  const quiet = JSON.stringify(Note({ children: 'x' }).props.style);
  // A Note-styled line shows as `~line`, so an aside drawn in prose style no longer matches.
  const flow = (page: any) =>
    nodes(page)
      .filter((n) => n.type === 'Text' || n.type === 'Pressable')
      .map((n) =>
        n.type === 'Pressable'
          ? 'TAP'
          : (JSON.stringify(n.props.style) === quiet ? '~' : '') + words(n),
      );
  const world = (place: object) => {
    const r = room('The hall is cold.');
    const view = { ...r.view, place: { ...r.view.place, ...place } };
    const exit = { direction: 'north', warning: 'Water roars to the north.' };
    return flow(RoomPage({ ...r, view: { ...view, exits: [exit] } } as any));
  };
  const shown = world({ asides });
  const at = shown.indexOf('The hall is cold.');
  assert.deepEqual(shown.slice(at, at + 4), [
    'The hall is cold.',
    '~You know these runes.',
    '~A mason marked this.',
    '~Water roars to the north.',
  ]);
  assert.deepEqual(world({}).slice(at, at + 2), [
    'The hall is cold.',
    '~Water roars to the north.',
  ]);
  const notice = (extra: object) =>
    flow(
      NoticePage({
        screen: {
          view: { notices: [{ id: 'd', title: 'Door', description: 'A door.', ...extra }] },
          text: (key: string) => key,
          detail: () => [],
        },
        page: { kind: 'notice', id: 'd' },
        open: () => {},
        press: () => {},
        world: () => {},
      } as any),
    );
  assert.deepEqual(notice({ asides, remaining: 2 }).slice(0, 5), [
    'Door',
    'A door.',
    '~You know these runes.',
    '~A mason marked this.',
    '~Remaining: 2',
  ]);
  assert.deepEqual(notice({ remaining: 2 }).slice(0, 3), ['Door', 'A door.', '~Remaining: 2']);
});
