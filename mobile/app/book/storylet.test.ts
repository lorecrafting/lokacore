// FD3 storylet card (book-ui.md, Storylet card details): controlled Room pages, then the real Book
// over the compiled storylet sampler.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { control } from './__tests__/control.test.ts';
import { book, nodes, words } from './__tests__/polish-book.test.ts';

const verb = { label: 'Look', action_key: 'look', target_ids: [], input: {} };
const card = { label: 'A stranger beckons', action_key: 'beckons', target_ids: [], input: {} };
const room = (actions: unknown[], place: unknown[]) => ({
  view: {
    place: { title: { key: 'Room' }, description: { key: 'Stalls.' } },
    exits: [],
    entities: [],
    actions,
    storylet: 'beckons',
  },
  text: (key: string) => key,
  label: (key: string) => (key === 'action.beckons' ? 'A stranger beckons' : key),
  log: [],
  g: { place },
  press: () => {},
  open: () => {},
  openChoice: () => {},
  details: { type: 'Text', props: { children: 'DETAILS' } },
});
const blocks = async (r: ReturnType<typeof room>) => {
  const { RoomPage } = await import('./pages.tsx');
  return nodes(RoomPage(r as any));
};

// Breaks: the pick drawn as a verb line (or twice), or its card placed after the verb lines or
// before the details.
test('the offered storylet is one Action card after the details, before the verb lines', async () => {
  const drawn = await blocks(room([], [verb, card]));
  const at = (label: string) =>
    drawn.findIndex((n) => n.type === 'Pressable' && n.props.accessibilityLabel === label);
  const details = drawn.findIndex((n) => words(n) === 'DETAILS');
  const cards = drawn.filter((n) => n.props?.accessibilityLabel === card.label);
  assert.equal(cards.length, 1);
  assert.ok(cards[0].props.style.borderRadius > 0, 'an Action card, not a verb line');
  assert.ok(details < at(card.label) && at(card.label) < at('Look'));
});

// Breaks: an unavailable pick dropped, drawn as a disabled card, or without its reason; an
// available pick with no Button drawn as an unavailable note; its label read as a raw key (loka-x6t.53).
test('an unavailable storylet is the label: reason note, not a pressable', async () => {
  const listed = {
    action_key: 'beckons',
    label: 'action.beckons',
    available: false,
    target: { kind: 'none' },
    input: [],
    reason: { code: 'precondition_failed', message: { key: 'Not at night.' } },
  };
  const drawn = await blocks(room([listed], [verb]));
  assert.ok(
    drawn.some((n) => n.type === 'Text' && words(n) === 'A stranger beckons: Not at night.'),
  );
  assert.ok(!drawn.some((n) => n.props?.accessibilityLabel === 'A stranger beckons'));
  // Listed available but given no Button (say, it takes input): no note that reads as unavailable.
  const unpressable = await blocks(room([{ ...listed, available: true }], [verb]));
  assert.ok(!unpressable.some((n) => words(n).startsWith('A stranger beckons')));
});

const bundle = compiled('cartridges/storylet_sampler');
const said = JSON.parse(
  readFileSync(new URL('../../../cartridges/storylet_sampler/text.json', import.meta.url), 'utf8'),
);

// Breaks: the card sends another action, drops the drawn freshness token, adds targets or input,
// the press is refused (the Book's invocation disagrees with what the authority admits), or the
// started scene does not open.
test('pressing the card sends the offered invocation and the authority admits it', (t) => {
  const b = book(bundle);
  t.after(() => b.sql.close());
  const { view, token } = b.game.view();
  const key = view.storylet ?? assert.fail('the sampler draws a storylet at the start');
  const offered = view.actions.find((a) => a.action_key === key)!;
  assert.ok(offered.available);
  const sent: unknown[] = [];
  const invoke = b.game.invoke;
  b.game.invoke = (intent) => {
    sent.push(intent);
    return invoke(intent);
  };
  const revision = b.sql.prepare('SELECT revision FROM head').get()!.revision;
  b.tap(said[offered.label]);
  assert.deepEqual(sent, [
    {
      action_key: key,
      target_ids: offered.target_ids ?? [],
      input: {},
      view_freshness_token: token,
    },
  ]);
  assert.ok(b.sql.prepare('SELECT revision FROM head').get()!.revision > revision);
  // The sampler's beckoning stranger starts a scene: it opens as any scene does.
  assert.ok(b.text().includes(said['scene.stranger.hood']), 'the started scene opens');
});

// Breaks: a card drawn before the hour changed is rebound to the new view's token (or sent with a
// fresh one), so the authority runs a pick it no longer offers instead of answering stale_view; or
// the Book keeps the old card after the refusal instead of redrawing the new pick.
test('a card pressed after the hour changes the pick is refused as stale and redrawn', (t) => {
  const b = book(bundle);
  t.after(() => b.sql.close());
  const old = control(b.draw(), said['actions.stranger_beckons']);
  const { token } = b.game.view();
  // Elsewhere the clock passes hour 2 (100 units an hour), where the stranger stops beckoning.
  b.game.invoke({
    action_key: 'wait',
    target_ids: [],
    input: { until: 300 },
    view_freshness_token: token,
  });
  assert.equal(b.game.view().view.storylet, 'pickpocket');
  const replies: unknown[] = [];
  const invoke = b.game.invoke;
  b.game.invoke = (intent) => {
    const reply = invoke(intent);
    replies.push([intent.view_freshness_token, reply.kind]);
    return reply;
  };
  old.props.onPress();
  assert.deepEqual(replies, [[token, 'stale_view']]);
  assert.equal(b.p.screen().log.at(-1), 'The page had changed; here it is again.');
  const shown = b.labels();
  assert.ok(shown.includes(said['actions.pickpocket']), JSON.stringify(shown));
  assert.ok(!shown.includes(said['actions.stranger_beckons']));
});
