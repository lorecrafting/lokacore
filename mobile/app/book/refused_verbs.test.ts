// Pass-1 R2 (book-ui.md, World and status entry): a place action the GameView lists unavailable
// draws after the available verb lines as the Action card's `label: reason` note, never dropped.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book, nodes, words } from './__tests__/polish-book.test.ts';

const verb = { label: 'Look about', action_key: 'gaze', target_ids: [], input: {} };
const refused = (action_key: string, label: string, code: string, extra = {}) => ({
  available: false,
  action_key,
  label,
  target: { kind: 'none' },
  input: [],
  reason: { code },
  ...extra,
});
const blocks = async (actions: unknown[], place: unknown[], more = {}) => {
  const { RoomPage } = await import('./pages.tsx');
  const view = {
    place: { title: { key: 'Glade' }, description: { key: 'Oaks.' } },
    exits: [],
    entities: [],
    actions,
    ...more,
  };
  const page = { view, text: (k: string) => k, log: [], g: { place }, press: () => {} };
  return nodes(RoomPage({ ...page, open: () => {}, openChoice: () => {}, details: null } as any));
};
const lines = (drawn: any[]) =>
  drawn.flatMap((n) =>
    n.props?.onPress ? [`button ${words(n)}`] : n.type === 'Text' ? [words(n)] : [],
  );

// Breaks: a refused verb dropped, an available one also drawn as a note, drawn as a pressable, drawn before the available verbs, or read as
// a code ("over load", "cooldown") instead of the reason word.
test('refused place verbs follow the available verb as label: reason notes', async () => {
  const shown = lines(
    await blocks(
      [
        { ...refused('gaze', 'Look about', 'none'), available: true, reason: undefined },
        refused('chop', 'Chop wood', 'over_load'),
        refused('fish', 'Fish in', 'cooldown'),
      ],
      [verb],
    ),
  );
  assert.deepEqual(shown.slice(-4), [
    'button Look about',
    'Look about',
    'Chop wood: more than you can carry',
    'Fish in: not yet',
  ]);
});

// Breaks: a refused action that belongs to another control (Sleep, the hold scan), takes typed input
// (Inscribe), is the Word block's (Shout), aims at an entity it does not name (Take), is the storylet
// (its own block) or a notice's (its notice page) drawn as a World verb note.
test('refused actions owned by another control draw no verb note', async () => {
  const drawn = lines(
    await blocks(
      [
        refused('sleep', 'Sleep', 'invalid_state'),
        refused('scan', 'Scan', 'invalid_state'),
        refused('shout', 'Shout', 'invalid_state'),
        { ...refused('take', 'Take', 'invalid_state'), target: { kind: 'entity' } },
        { ...refused('inscribe', 'Inscribe', 'invalid_state'), input: [{ key: 'text' }] },
        refused('beckons', 'A stranger beckons', 'invalid_state'),
        refused('tear', 'Tear the notice', 'invalid_state', { target_ids: ['n1'] }),
      ],
      [verb],
      { storylet: 'beckons', notices: [{ id: 'n1' }] },
    ),
  );
  assert.deepEqual(
    drawn.filter((l) => /Sleep|Scan|Inscribe|Shout|Take|Tear/.test(l)),
    [],
  );
  assert.equal(drawn.filter((l) => l.startsWith('A stranger beckons')).length, 1);
});

// Breaks: the real Book drops the Glade's refused Chop wood (no axe), as before pass-1 R2.
test('glade without an axe: the real Book shows "Chop wood: not now"', (t) => {
  const b = book(compiled('cartridges/toolbox_showcase') as never);
  t.after(() => b.sql.close());
  for (const d of ['north', 'west', 'south', 'west']) {
    b.map();
    b.tap(`Go ${d}`);
  }
  assert.ok(b.text().includes('Chop wood: not now'), JSON.stringify(b.text().slice(-8)));
});
