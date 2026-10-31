// Word bar (docs/system/book-ui.md, Word bar): the say field, its known-word chips, the NPC
// page's Whisper and the Character page's Spells through the real authority and Book. Expected text is literal from cartridges/speech_sampler and
// cartridges/spells_sampler text.json; facts are the samplers' reaction facts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { CONTENTS } from './__tests__/control.test.ts';
import { book } from './__tests__/polish-book.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';
import { buttonsOf, castWords, WORDS } from './buttons.ts';
import { intentOf } from './model.ts';
import { LABEL } from './labels.ts';
import { spoken } from './words.ts';

const speech = compiled('cartridges/speech_sampler');
const spells = compiled('cartridges/spells_sampler');
const ward = compiled('cartridges/ward_sampler');
type Book = ReturnType<typeof book>;
const facts = (b: Book) =>
  Object.fromEntries(
    b.sql
      .prepare("SELECT key, value FROM state_row WHERE section='facts'")
      .all()
      .map((r: any) => [JSON.parse(r.key).fact.key, JSON.parse(r.value)]),
  );
const revision = (b: Book) => b.sql.prepare('SELECT revision FROM head').get()!.revision;
const type = (b: Book, word: string) => {
  const input = b.draw().find((n) => n.type === 'TextInput');
  assert.ok(input, 'no word input');
  assert.equal(input.props.allowFontScaling, false, 'the word input scales twice'); // reading.ts sizes it
  input.props.onChangeText(word);
  b.draw()
    .find((n) => n.type === 'TextInput')
    .props.onSubmitEditing();
};
// Says a word through the status line's say icon and field.
const say = (b: Book, word: string) => (b.tap(LABEL.sayToRoom), type(b, word));
// Sends a known word through the say field: open it, press the word's chip, press the send.
const send = (b: Book, word: string, how: string) => (
  b.tap(LABEL.sayToRoom),
  b.tap(word),
  b.tap(how)
);
// Breaks: word chips drawn on the page (the removed Word block), the known phrases not offered as
// chips under the open field, or a chip that sends instead of filling the field.
test('the open say field lists the known phrases as chips that fill it', () => {
  const b = book(speech as never);
  assert.ok(!b.labels().some((x) => /^\w+, (say|shout|cast|whisper)/.test(x)), 'no word chips');
  b.tap(LABEL.sayToRoom);
  const l = b.labels();
  assert.deepEqual(l.slice(l.indexOf(LABEL.shout) + 1, l.indexOf(LABEL.shout) + 4), [
    'ward',
    'help',
    'hello',
  ]);
  const before = revision(b);
  b.tap('ward');
  assert.equal(revision(b), before, 'a chip only fills the field');
  assert.equal(b.draw().find((n) => n.type === 'TextInput').props.value, 'ward');
});

// Breaks: a tap outside the open say field reaching what lies beneath (an exit, a card, the
// pools) or leaving the field open; a shield drawn under what it should cover.
test('a tap outside the open say field closes it unsent and presses nothing beneath', () => {
  const b = book(speech as never);
  b.tap(LABEL.sayToRoom);
  const drawn = b.draw();
  const shield = (n: any) => n.type === 'Pressable' && n.props.accessible === false;
  const shields = drawn.filter(shield);
  assert.equal(shields.length, 3, 'over the page, the footer and the status row');
  // A later sibling draws on top: each shield after what it covers, all before the field.
  const at = (f: (n: any) => boolean) => drawn.findIndex(f);
  const field = at((n) => n.type === 'TextInput');
  assert.ok(shields.every((s) => drawn.indexOf(s) < field));
  assert.ok(drawn.indexOf(shields[2]) > at((n) => n.props?.accessibilityLabel === LABEL.sayToRoom));
  const before = revision(b);
  shields[0].props.onPress();
  assert.equal(revision(b), before, 'nothing sent');
  assert.ok(!b.draw().some((n) => n.type === 'TextInput' || shield(n)), 'field and shields gone');
});

// Breaks: the say field reopening when the player returns to the room it was opened in (the
// stored room compared, never cleared).
test('leaving the room closes the say field, and returning does not reopen it', () => {
  const b = book(speech as never);
  const go = (d: string) =>
    b
      .draw()
      .find((n) => n.type.name === 'Footer')
      .props.go(d);
  const start = b.game.view().view.place.id;
  b.tap(LABEL.sayToRoom);
  go('east');
  assert.notEqual(b.game.view().view.place.id, start, 'no move');
  assert.ok(!b.draw().some((n) => n.type === 'TextInput'), 'open in the new room');
  go('west');
  assert.ok(!b.draw().some((n) => n.type === 'TextInput'), 'reopened on return');
});

// Breaks: Escape closing the field only from the text field, not from a send or a chip.
test('Escape anywhere in the open say field closes it unsent', () => {
  const b = book(speech as never);
  b.tap(LABEL.sayToRoom);
  const before = revision(b);
  const field = b.draw().find((n) => n.type === 'View' && n.props.onKeyDown);
  field.props.onKeyDown({ key: 'Escape', preventDefault() {} });
  assert.equal(revision(b), before, 'nothing sent');
  assert.ok(!b.draw().some((n) => n.type === 'TextInput'), 'field still open');
});

// Breaks: a word press not admitted (wrong input shape), the conversation it opens not turned to,
// or the say icon left showing while a conversation is open.
test('saying ward opens the elder conversation and hides the say icon', () => {
  const b = book(speech as never);
  say(b, 'ward');
  const shown = b.text();
  assert.ok(shown.includes('The elder leans close. "The ward fails at the new moon."'));
  assert.ok(b.labels().includes('Thank her'));
  assert.ok(!b.labels().includes(LABEL.sayToRoom));
});

// Breaks: a shout sent as a say (the watchman next door would not hear it).
test('shouting help in the square alerts the watchman next door', () => {
  const b = book(speech as never);
  send(b, 'help', LABEL.shout);
  assert.deepEqual(facts(b), { elder_heard: true, watchman_alerted: true });
});

// Breaks (pass-1 R5): an accepted speech press with no narration leaving the page silent, echoed
// twice, or echoed with the wrong verb, word or listener.
test('a say or shout with no narration echoes once in ink', () => {
  const b = book(speech as never);
  const echoes = () => b.text().filter((t) => t.startsWith('You '));
  say(b, 'hello');
  send(b, 'help', LABEL.shout);
  assert.deepEqual(echoes(), ['You say, "Hello."', 'You shout, "Help!"']);
  assert.equal(spoken('say', undefined), undefined); // a wordless retry falls back to OUTCOME
});

// Breaks: a typed word not sent as a Say (or sent with the token of a view that has moved on),
// a bad word sent to the kernel, no note on a bad word, or the typed word shown other than as
// its one Say echo (pass-1 R5).
test('a typed word is said like its chip, even after the view moves on, and echoed once', () => {
  const b = book(speech as never);
  const input = () => b.draw().find((n) => n.type === 'TextInput');
  b.tap(LABEL.sayToRoom);
  const before = revision(b);
  type(b, 'two words');
  assert.equal(revision(b), before);
  assert.ok(b.text().includes(LABEL.oneWord));
  input().props.onChangeText('Xyzzy'); // said as the kernel folds it, echoed as a sentence
  const stale = input(); // drawn before a background update, so its Say token is old
  const { view, token } = b.game.view();
  const hello = buttonsOf(view, String, String).find((x) => x.label === 'hello, shout')!;
  b.game.invoke(intentOf({ ...hello, token })); // not through the Book: no new generation
  const after = revision(b);
  stale.props.onSubmitEditing();
  assert.ok(revision(b) > after);
  assert.ok(!b.text().includes(LABEL.oneWord));
  assert.deepEqual(
    b.text().filter((t) => /xyzzy/i.test(t)),
    ['You say, "Xyzzy."'],
  );
});

// Breaks: a refused spell word's reason missing from the Character page's Spells, a refused word
// offered as a chip, a spell word offered where Cast is not, or a cast through the field not
// admitted (mana unchanged).
test('spell words: refused ones list their reason under Spells; lux casts once ash is gathered', () => {
  const b = book(spells as never);
  const spellsBlock = () => {
    b.tap(CONTENTS);
    b.tap('Character');
    const t = b.text();
    b.tap(LABEL.backToContents);
    b.tap(LABEL.backToWorld);
    return t.slice(t.indexOf(LABEL.spells));
  };
  assert.ok(spellsBlock().includes('lux, cast: need 1 ash'));
  const v = b.game.view().view;
  assert.deepEqual(
    castWords({ ...v, actions: v.actions.filter((x) => x.action_key !== 'cast') }),
    [],
  );
  // ponytail: a giverless quest offer has no Book control since the World verb lines went (open PM
  // question on PR #464); accept it through the game until the Book draws one.
  b.game.invoke({ action_key: 'apprentice', target_ids: [], input: {} } as never);
  b.tap('sigil, open');
  b.tap('Trace the sigil');
  b.tap(LABEL.leave);
  assert.ok(spellsBlock().includes('ward, cast: Needs level 2 and wisdom 11'));
  b.tap('hearth, open');
  b.tap('Gather ash');
  b.tap(LABEL.leave);
  b.tap(LABEL.sayToRoom);
  assert.ok(!b.labels().includes('ward'), 'a refused word is no chip');
  b.tap('lux');
  b.tap(LABEL.cast);
  const mana = b.game.view().view.resources.find((r) => r.resource.key === 'mana');
  assert.equal(mana?.current, 1);
  assert.ok(b.text().includes('The ash flares and a pale light hangs in the air.'));
});

// Breaks: a send that carries a word of its own (the field adds the typed one), or sends offered
// while a combat, scene or conversation is open (the square's own view with one of them set).
test('no word press without a word, nor in combat, a scene or a conversation', () => {
  const v = book(speech as never).game.view().view;
  const say = (k: string) => k;
  const words = (w: GameView) => buttonsOf(w, say, say).filter((p) => WORDS.includes(p.action_key));
  // wordless twins are the field's sends (say, shout, cast, whisper per person)
  const keyboard = words(v);
  assert.deepEqual(
    keyboard.map((p) => [p.action_key, p.input]),
    [
      ['say', {}],
      ['shout', {}],
      ['whisper', {}],
      ['whisper', {}],
    ], // two people here
  );
  const open = (f: string) =>
    JSON.parse(readFileSync(new URL(`../stories/views/${f}.json`, import.meta.url), 'utf8')).view;
  assert.deepEqual(words({ ...v, combat: open('combat-one-foe').combat }), [], 'combat');
  assert.deepEqual(words({ ...v, scene: open('scene').scene }), [], 'scene');
  assert.deepEqual(words({ ...v, choice: open('npc-choice').choice }), [], 'conversation');
});

// Breaks: the say field gated on phrases (ward_sampler offers Say with none, so
// "drench" was unsayable), or the keyboard's wordless Say drawn as a chip.
test('Say without phrases still offers the keyboard, and a typed word is heard', () => {
  const b = book(ward as never);
  say(b, 'drench');
  assert.ok(!b.draw().some((n) => n.type === 'TextInput'), 'a sent word closes the field');
  const said = b.sql.prepare('SELECT command FROM receipt').all();
  assert.deepEqual(
    said.map((r: any) => JSON.parse(r.command).payload.word),
    ['drench'],
  );
});

// Breaks: Enter sending while a press is pending (the presenter would retry the pending press).
test('Enter while a press is pending sends nothing', () => {
  const a = elapsedHost(':memory:', undefined, speech as never);
  const b = book(speech as never, a);
  a.fault.kind = 'lost';
  a.fault.armed = true;
  send(b, 'hello', LABEL.shout);
  assert.ok(b.game.pending());
  b.tap(LABEL.sayToRoom);
  b.draw()
    .find((n) => n.type === 'TextInput')
    .props.onChangeText('xyzzy');
  assert.ok(b.draw().find((n) => n.props.accessibilityLabel === LABEL.say).props.disabled);
  let sent = 0;
  const invoke = b.game.invoke;
  b.game.invoke = (i) => (sent++, invoke(i));
  b.draw()
    .find((n) => n.type === 'TextInput')
    .props.onSubmitEditing();
  assert.equal(sent, 0);
});

// Breaks: a word press that settles later (its commit acknowledgement lost, then recovered by a
// pulse) not turning to the conversation it opens, as a press that settles at once does.
test('a word that settles later still turns to its conversation', () => {
  const a = elapsedHost(':memory:', undefined, speech as never);
  const b = book(speech as never, a);
  a.fault.kind = 'lost';
  a.fault.armed = true;
  say(b, 'ward');
  assert.ok(b.game.pending());
  assert.ok(!b.labels().includes('Thank her'));
  a.fault.reads = false;
  b.game.pulse();
  assert.ok(b.labels().includes('Thank her'));
});

// Breaks (pass-1 R5): the echo shown beside a spoken press's own narration (the den's begone
// shout, toolbox_showcase reactions/begone.json, frightens both goblins).
test('a shout whose receipt narrates shows the narration, not the echo', () => {
  const b = book(compiled('cartridges/toolbox_showcase') as never);
  for (const d of ['west', 'down', 'north', 'north']) (b.map(), b.tap(`Go ${d}`));
  send(b, 'begone', LABEL.shout);
  const shown = b.text();
  const cowers = 'The goblin cowers, eyeing the way out.';
  assert.equal(shown.filter((t) => t === cowers).length, 2, JSON.stringify(shown));
  assert.ok(!shown.some((t) => t.startsWith('You shout')), JSON.stringify(shown));
});
