// Polish batch 5 layout rules over controlled inputs (the harness: __tests__/polish-book.test.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes, words } from './__tests__/polish-book.test.ts';

const room = (description: string) => ({
  view: {
    place: { title: { key: 'Room' }, description: { key: description } },
    exits: [],
    entities: [],
    actions: [],
  },
  text: (key: string) => key,
  log: [],
  g: { place: [], door: () => [] },
  press: () => {},
  open: () => {},
});

// Breaks: a blank line in the authored description is shown as one run of text (the split dropped),
// a single line break splits a paragraph in two, or a trailing line break draws a blank line.
test('a blank line in the room description starts a new paragraph; a line break does not', async () => {
  const { RoomPage } = await import('./Body.tsx');
  const { Text } = await import('./Text.tsx');
  const paragraphs = (description: string) =>
    nodes(RoomPage(room(description) as any))
      .filter(
        (n) => n.type === 'View' && [n.props.children].flat().every((c: any) => c?.type === Text),
      )
      .map((n) => [n.props.children].flat().map(words));
  assert.deepEqual(paragraphs('The nave is cold.\n\nA bell rope hangs.\n'), [
    ['The nave is cold.', 'A bell rope hangs.'],
  ]);
  assert.deepEqual(paragraphs('The nave is cold.\nA bell rope hangs.'), [
    ['The nave is cold.\nA bell rope hangs.'],
  ]);
});

// Breaks (loka-x6t.105; book-ui.md Room page anatomy): a description's link to a readable notice
// stays plain words, draws a World line too, or reads without opening the page; the prose links an
// unmatched key; or a refused Read leaves the linked notice unreachable or presses the Read.
test('a readable notice the description links is a prose link and no World line', async () => {
  const { RoomPage } = await import('./Body.tsx');
  const { proseLinks } = await import('./notices.tsx');
  const draw = (description: string, notice: object, available = true) => {
    const done: unknown[] = [];
    const read = {
      action_key: 'read',
      available,
      reason: { code: 'x', message: { key: 'Too dark to read.' } },
      target: { kind: 'entity', scopes: ['inspectable_details'] },
      input: [],
      target_ids: ['n1'],
    };
    const view = {
      place: { title: { key: 'Green' }, description: { key: description } },
      exits: [],
      entities: [],
      actions: [read],
      notices: [{ id: 'n1', key: 'sign_social', title: 'The sign', ...notice }],
    };
    const p = {
      screen: {
        view,
        text: (key: string) => key,
        buttons: [{ action_key: 'read', detail_id: 'n1', target_ids: ['n1'] }],
      },
      open: (page: unknown) => done.push(page),
      press: (_b: unknown, id?: string) => done.push(id),
    } as any;
    const shown = nodes(
      RoomPage({
        ...room(description),
        view,
        links: proseLinks(p),
      } as any),
    );
    const link = shown.find((n) => n.props?.accessibilityLabel === 'signpost, open');
    return { shown, link, done, text: shown.filter((n) => n.type === 'Text').map(words) };
  };
  const linked = 'A green with a [signpost](sign_social).';
  const yes = draw(linked, {});
  assert.ok(yes.text.includes('A green with a signpost.'));
  assert.equal(
    yes.text.some((t) => t.includes('The sign')),
    false,
  );
  yes.link.props.onKeyDown({ key: 'Enter', preventDefault: () => {} });
  assert.deepEqual(yes.done, [{ kind: 'notice', id: 'n1' }, 'n1']);
  for (const description of [linked.replace('sign_social', 'sign_hub'), 'A green.']) {
    const no = draw(description, {});
    assert.equal(no.link, undefined, `${description} linked`);
    assert.equal(
      no.text.some((t) => t.includes('The sign')),
      false,
    );
  }
  const refused = draw(linked, {}, false);
  refused.link.props.onKeyDown({ key: 'Enter', preventDefault: () => {} });
  assert.deepEqual(refused.done, [{ kind: 'notice', id: 'n1' }]);
});

// Room sentences from cartridge name words (book-ui.md "Below the description", loka-6qi). Breaks:
// the article is written on every name, is not written again after a proper name or a change of
// word ("an wooden bench") or between two equal names without a plural, a name without words is
// dropped or loses its text, a plural group is not one link, opens a later member, says "is", or
// counts 10 as a word.
test('the room sentence shows bare names, shares an article per run and collapses plurals', async () => {
  const { Here } = await import('./lines.tsx');
  const SAY: Record<string, string> = {
    crow: 'crow',
    crows: 'crows',
    crows2: 'crows',
    'npc.tam.short': 'Tam, the miller',
  };
  const e = (id: string, article?: string, kind = 'npc', name = `${kind}.${id}.short`) => ({
    id,
    kind,
    name,
    actions: [],
    words: { bare: id.replace(/\d+$/, ''), ...(article && { article }) },
  });
  const crows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      ...e(`crow${i}`, 'a', 'item'), // each its own name key, as the showcase's egg_01..06
      words: { bare: 'crow', article: 'a', plural: i === 1 ? 'crows2' : 'crows' },
    }));
  const opened: string[] = [];
  const said = (entities: object[]) => {
    const drawn = nodes(
      Here({ view: { entities } as any, text: (k) => SAY[k] ?? k, open: (id) => opened.push(id) }),
    );
    return drawn
      .filter(
        (n) =>
          n.type === 'Text' &&
          !n.props.onPress &&
          nodes(n.props.children).some((c) => c.props?.onPress),
      )
      .map((n) => {
        const links = nodes(n.props.children).filter((c) => c.props?.onPress);
        return [words(n), ...links.map((l) => l.props.accessibilityLabel)].join(' | ');
      });
  };
  assert.deepEqual(
    said([e('Aldous'), e('Bess'), e('carpenter', 'the'), e('chandler', 'the'), e('cook', 'the')]),
    [
      'Aldous, Bess, the carpenter, chandler, and cook are here. | Aldous, open | Bess, open | carpenter, open | chandler, open | cook, open',
    ],
  );
  assert.deepEqual(said([e('carpenter', 'the'), e('Aldous'), e('cook', 'the')]), [
    'The carpenter, Aldous, and the cook are here. | carpenter, open | Aldous, open | cook, open',
  ]);
  const tam = { id: 'tam', kind: 'npc', name: 'npc.tam.short', actions: [] };
  assert.deepEqual(said([e('carpenter', 'the'), tam, e('cook', 'the')]), [
    'The carpenter, Tam, the miller, and the cook are here. | carpenter, open | Tam, the miller, open | cook, open',
  ]);
  const item = (id: string, article: string) => e(id, article, 'item');
  assert.deepEqual(said([item('wooden bench', 'a'), item('knife', 'a'), item('orange', 'an')]), [
    'A wooden bench, knife, and an orange are here. | wooden bench, open | knife, open | orange, open',
  ]);
  assert.deepEqual(
    said([
      item('apple', 'an'),
      item('axe', 'an'),
      item('wooden bench', 'a'),
      item('iron anvil', 'an'),
    ]),
    [
      'An apple, axe, a wooden bench, and an iron anvil are here. | apple, open | axe, open | wooden bench, open | iron anvil, open',
    ],
  );
  assert.deepEqual(said([item('stick1', 'a'), item('stick2', 'a')]), [
    'A stick and a stick are here. | stick, open | stick, open',
  ]);
  assert.deepEqual(said(crows(2)), ['Two crows are here. | Two crows, open']);
  assert.deepEqual(said([...crows(3), item('hen', 'a')]), [
    'Three crows and a hen are here. | Three crows, open | hen, open',
  ]);
  assert.deepEqual(said(crows(1)), ['A crow is here. | crow, open']);
  assert.deepEqual(said(crows(9)), ['Nine crows are here. | Nine crows, open']);
  assert.deepEqual(said(crows(10)), ['10 crows are here. | 10 crows, open']);
  opened.length = 0;
  const [sentence] = nodes(
    Here({
      view: { entities: crows(2) } as any,
      text: (k) => SAY[k] ?? k,
      open: (id) => opened.push(id),
    }),
  );
  nodes(sentence)
    .find((c) => c.props?.onPress)
    .props.onPress();
  assert.deepEqual(opened, ['crow0']); // the collapsed link opens the first member
});
