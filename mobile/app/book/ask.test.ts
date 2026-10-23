// Toolbox row FD7 Book half (docs/system/book-ui.md, FD7 ask details): one "Ask about" card per
// known topic on the NPC's page, through the real authority and Book. Expected text is literal
// from cartridges/ask_sampler/text.json.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import { buttonsOf } from './buttons.ts';
import { LABEL } from './labels.ts';

const bundle = compiled('cartridges/ask_sampler');
const topic = (key: string) => ({
  cartridge_id: 'ask_sampler',
  cartridge_version: '0.0.1',
  kind: 'topic',
  key,
});
function smith() {
  const b = book(bundle as never);
  b.map();
  b.tap('Go north');
  b.tap('the smith'); // third in the room's sentence, so lower case
  return b;
}
const asks = (b: ReturnType<typeof book>) => b.labels().filter((l) => l.startsWith(LABEL.askAbout));

// Breaks: ask shows as one generic card (no per-topic expansion, or input {} so the kernel
// refuses it), topics out of projected order, a raw topic key instead of the DefinitionRef, or
// a card left when the actor knows no topic, or ask cards placed before the NPC's other cards.
test('the smith offers one Ask about card per known topic; no topic, no card', () => {
  const b = smith();
  assert.deepEqual(asks(b), [`${LABEL.askAbout} The mill`, `${LABEL.askAbout} The moon`]);
  const labels = b.labels();
  // the Whisper Control (opens the one-word field) follows the cards (book-ui.md, Word bar)
  assert.ok(labels.indexOf(LABEL.whisper) > labels.indexOf(`${LABEL.askAbout} The moon`));
  const talk = labels.findIndex((l) => l.startsWith('Talk'));
  assert.ok(talk >= 0 && talk < labels.indexOf(`${LABEL.askAbout} The mill`));
  const v = b.game.view().view;
  const id = v.entities.find((e) => e.name === 'npc.smith.short')!.id;
  const say = (k: string) => k;
  const pressed = buttonsOf(v, say, say).filter((p) => p.action_key === 'ask');
  assert.deepEqual(
    pressed.filter((p) => p.target_ids[0] === id).map((p) => p.input),
    [{ topic: topic('mill') }, { topic: topic('moon') }],
  );
  assert.deepEqual(
    buttonsOf({ ...v, topics: [] }, say, say).filter((p) => p.action_key === 'ask'),
    [],
  );
});

// Breaks: an ask press is refused (wrong target or input shape), its answer leaves the page or
// opens a conversation, or a granted topic's card waits for a page change. Every card the view
// offers on the smith is pressed, so this is the view-to-invocation check.
test('each Ask about card is admitted: the answer joins the page, a grant adds its card', () => {
  const b = smith();
  b.tap(`${LABEL.askAbout} The mill`);
  b.tap(`${LABEL.askAbout} The moon`);
  assert.deepEqual(asks(b), [
    `${LABEL.askAbout} The mill`,
    `${LABEL.askAbout} The moon`,
    `${LABEL.askAbout} The smugglers`,
  ]);
  b.tap(`${LABEL.askAbout} The smugglers`);
  const shown = b.text();
  const lines = shown.slice(shown.indexOf('A smith at her forge.') + 1, shown.indexOf(asks(b)[0]));
  assert.deepEqual(
    lines.filter((l) => !l.startsWith('Talk')),
    [
      '"The miller ships more than flour. Ask about the smugglers."',
      'The smith shrugs.',
      'The smith shrugs.',
    ],
  );
  assert.equal(shown[0], 'The smith');
  assert.ok(b.labels().includes(LABEL.leave) && !b.labels().includes(LABEL.leaveConversation));
});

// Breaks: an ask the GameView lists unavailable still shows its topic cards, or a hostile NPC
// with no authored refusal line shows no line (or shows it before it turns hostile).
test('the guard turned hostile by smugglers offers no Ask about card, only the fallback line', () => {
  const b = smith();
  b.tap(`${LABEL.askAbout} The mill`);
  b.tap(LABEL.leave);
  b.tap('The guard');
  const refusal = 'The guard will have nothing to do with you.';
  assert.ok(!b.text().includes(refusal));
  b.tap(`${LABEL.askAbout} The smugglers`);
  const v = b.game.view().view;
  const guard = v.entities.find((e) => e.name === 'npc.guard.short')!;
  assert.deepEqual(
    guard.actions.filter((a) => a.action_key === 'ask').map((a) => a.available),
    [false],
  );
  assert.deepEqual(b.text().slice(0, 1).concat(asks(b)), ['The guard']);
  assert.ok(b.text().includes(refusal), JSON.stringify(b.text()));
});
