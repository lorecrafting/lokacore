// Word bar S3 (docs/system/book-ui.md, Word bar): the World page's Word block through the real
// authority and Book. Expected text is literal from cartridges/speech_sampler and
// cartridges/spells_sampler text.json; facts are the samplers' reaction facts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
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

// Breaks: a chip row missing or out of order, whisper chips not one row per NPC, the a11y names
// not "<word>, <how>", a Say chip drawn, or the say icon missing while Say is offered.
test('the square offers a Whisper row per NPC, Shout and the say icon', () => {
  const b = book(speech as never);
  const words = (how: string) => ['ward', 'help', 'hello'].map((w) => `${w}, ${how}`);
  const l = b.labels();
  const first = l.indexOf('ward, whisper to the elder');
  assert.deepEqual(l.slice(first, first + 9), [
    ...words('whisper to the elder'),
    ...words('whisper to the smith'),
    ...words('shout'),
  ]);
  assert.ok(!l.some((x) => x.endsWith(', say')));
  assert.ok(l.indexOf(LABEL.sayToRoom) > first + 8, 'the say icon sits on the status line');
});

// Breaks: a word press not admitted (wrong input shape), the conversation it opens not turned to,
// or the Word block left showing while a conversation is open.
test('saying ward opens the elder conversation and hides the Word block', () => {
  const b = book(speech as never);
  say(b, 'ward');
  const shown = b.text();
  assert.ok(shown.includes('The elder leans close. "The ward fails at the new moon."'));
  assert.ok(b.labels().includes('Thank her'));
  assert.ok(!shown.includes(LABEL.word) && !b.labels().includes(LABEL.sayToRoom));
});

// Breaks: a whisper sent as a say (everyone in the room hears), or to the wrong target.
test('a word whispered to the smith is not heard by the elder', () => {
  const b = book(speech as never);
  b.tap('ward, whisper to the smith');
  assert.deepEqual(facts(b), {});
  say(b, 'hello');
  assert.deepEqual(facts(b), { elder_heard: true });
});

// Breaks: a shout sent as a say (the watchman next door would not hear it).
test('shouting help in the square alerts the watchman next door', () => {
  const b = book(speech as never);
  b.tap('help, shout');
  assert.deepEqual(facts(b), { elder_heard: true, watchman_alerted: true });
});

// Breaks (pass-1 R5): an accepted speech press with no narration leaving the page silent, echoed
// twice, or echoed with the wrong verb, word or listener.
test('a say, whisper or shout with no narration echoes once in ink', () => {
  const b = book(speech as never);
  const echoes = () => b.text().filter((t) => t.startsWith('You '));
  say(b, 'hello');
  for (const chip of ['help, shout', 'ward, whisper to the smith']) b.tap(chip);
  assert.deepEqual(echoes(), [
    'You say "hello".',
    'You shout "help".',
    'You whisper "ward" to the smith.',
  ]);
  assert.equal(spoken('say', undefined), undefined); // a wordless retry falls back to OUTCOME
});

// Breaks (pass-1 UA): the World log drawn after the Word block, so a press's result sits below
// the chip rows.
test('the latest result shows before the Word block', () => {
  const b = book(speech as never);
  say(b, 'hello');
  const shown = b.text();
  assert.ok(shown.indexOf('You say "hello".') >= 0, JSON.stringify(shown));
  assert.ok(shown.indexOf('You say "hello".') < shown.indexOf(LABEL.word), JSON.stringify(shown));
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
  input().props.onChangeText('Xyzzy'); // said, and echoed, as the kernel folds it
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
    ['You say "xyzzy".'],
  );
});

// Breaks: a refused spell word hidden or pressable, its reason missing, a learned word not shown,
// a spell word shown where Cast is not offered, or a cast press not admitted (mana unchanged).
test('spell words: refused ones carry their reason; lux casts once ash is gathered', () => {
  const b = book(spells as never);
  const castRow = (t: string[]) => t.slice(t.indexOf(LABEL.cast), t.indexOf(LABEL.cast) + 3);
  assert.deepEqual(castRow(b.text()), [LABEL.cast, 'lux', 'lux, cast: need 1 ash']);
  const v = b.game.view().view;
  assert.deepEqual(
    castWords({ ...v, actions: v.actions.filter((x) => x.action_key !== 'cast') }),
    [],
  );
  b.tap('Take up the apprenticeship');
  b.tap('Trace the sigil');
  assert.ok(b.text().includes('ward, cast: Needs level 2 and wisdom 11'));
  assert.ok(!b.labels().some((l) => l.endsWith(', cast')));
  b.tap('Gather ash');
  b.tap('lux, cast');
  const mana = b.game.view().view.resources.find((r) => r.resource.key === 'mana');
  assert.equal(mana?.current, 1);
  assert.ok(b.text().includes('The ash flares and a pale light hangs in the air.'));
});

// Breaks: a chip the view offers that the kernel refuses (wrong input shape or target): every
// word chip on the square is pressed in a fresh Book and must advance the game.
test('every word chip on the square is admitted', () => {
  for (const label of book(speech as never)
    .labels()
    .filter((l) => /^\w+, /.test(l))) {
    const b = book(speech as never);
    const before = revision(b);
    b.tap(label);
    assert.ok(revision(b) > before, label);
  }
});

// Breaks: a word press emitted without one word (the kernel refuses it), or chips offered while a
// combat, scene or conversation is open (the square's own view with one of them set).
test('no word press without a word, nor in combat, a scene or a conversation', () => {
  const v = book(speech as never).game.view().view;
  const say = (k: string) => k;
  const words = (w: GameView) => buttonsOf(w, say, say).filter((p) => WORDS.includes(p.action_key));
  const [keyboard, ...chips] = words(v); // the keyboard's Say is never drawn as a chip
  assert.deepEqual([keyboard.action_key, keyboard.input], ['say', {}]);
  assert.equal(chips.length, 9);
  assert.ok(chips.every((p) => /^[a-zA-Z]{1,32}$/.test((p.input as { word?: string }).word ?? '')));
  assert.deepEqual(words({ ...v, phrases: [] }), [keyboard]);
  const open = (f: string) =>
    JSON.parse(readFileSync(new URL(`../stories/views/${f}.json`, import.meta.url), 'utf8')).view;
  assert.deepEqual(words({ ...v, combat: open('combat-one-foe').combat }), [], 'combat');
  assert.deepEqual(words({ ...v, scene: open('scene').scene }), [], 'scene');
  assert.deepEqual(words({ ...v, choice: open('npc-choice').choice }), [], 'conversation');
});

// Breaks: the Word block or its keyboard gated on phrases (ward_sampler offers Say with none, so
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
  b.tap(LABEL.sayToRoom);
  b.draw()
    .find((n) => n.type === 'TextInput')
    .props.onChangeText('xyzzy');
  a.fault.kind = 'lost';
  a.fault.armed = true;
  b.tap('hello, shout');
  assert.ok(b.game.pending());
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
  b.tap('begone, shout');
  const shown = b.text();
  const cowers = 'The goblin cowers, eyeing the way out.';
  assert.equal(shown.filter((t) => t === cowers).length, 2, JSON.stringify(shown));
  assert.ok(!shown.some((t) => t.startsWith('You shout')), JSON.stringify(shown));
});
