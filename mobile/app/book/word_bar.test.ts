// Word bar S3 (docs/system/book-ui.md, Word bar): the World page's Word block through the real
// authority and Book. Expected text is literal from cartridges/speech_sampler and
// cartridges/spells_sampler text.json; facts are the samplers' reaction facts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';
import { buttonsOf, WORDS } from './buttons.ts';
import { intentOf } from './model.ts';
import { LABEL } from './labels.ts';

const speech = compiled('cartridges/speech_sampler');
const spells = compiled('cartridges/spells_sampler');
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
  input.props.onChangeText(word);
  b.draw()
    .find((n) => n.type === 'TextInput')
    .props.onSubmitEditing();
};

// Breaks: a chip row missing or out of order, whisper chips not one row per NPC, the a11y names
// not "<word>, <how>", or the keyboard control missing while Say is offered.
test('the square offers Say, a Whisper row per NPC, Shout and the keyboard', () => {
  const b = book(speech as never);
  const words = (how: string) => ['ward', 'help', 'hello'].map((w) => `${w}, ${how}`);
  const l = b.labels();
  assert.deepEqual(l.slice(l.indexOf('ward, say'), l.indexOf(LABEL.typeAWord) + 1), [
    ...words('say'),
    ...words('whisper to the elder'),
    ...words('whisper to the smith'),
    ...words('shout'),
    LABEL.typeAWord,
  ]);
});

// Breaks: a word press not admitted (wrong input shape), the conversation it opens not turned to,
// or the Word block left showing while a conversation is open.
test('saying ward opens the elder conversation and hides the Word block', () => {
  const b = book(speech as never);
  b.tap('ward, say');
  const shown = b.text();
  assert.ok(shown.includes('The elder leans close. "The ward fails at the new moon."'));
  assert.ok(b.labels().includes('Thank her'));
  assert.ok(!shown.includes(LABEL.word) && !b.labels().some((l) => l.endsWith(', say')));
});

// Breaks: a whisper sent as a say (everyone in the room hears), or to the wrong target.
test('a word whispered to the smith is not heard by the elder', () => {
  const b = book(speech as never);
  b.tap('ward, whisper to the smith');
  assert.deepEqual(facts(b), {});
  b.tap('hello, say');
  assert.deepEqual(facts(b), { elder_heard: true });
});

// Breaks: a shout sent as a say (the watchman next door would not hear it).
test('shouting help in the square alerts the watchman next door', () => {
  const b = book(speech as never);
  b.tap('help, shout');
  assert.deepEqual(facts(b), { elder_heard: true, watchman_alerted: true });
});

// Breaks: a typed word not sent as a Say (or sent with the token of a view that has moved on),
// a bad word sent to the kernel, no note on a bad word, or the typed word echoed into the page.
test('a typed word is said like its chip, even after the view moves on, and never shown', () => {
  const b = book(speech as never);
  const input = () => b.draw().find((n) => n.type === 'TextInput');
  b.tap(LABEL.typeAWord);
  const before = revision(b);
  type(b, 'two words');
  assert.equal(revision(b), before);
  assert.ok(b.text().includes(LABEL.oneWord));
  input().props.onChangeText('xyzzy');
  const stale = input(); // drawn before a background update, so its Say token is old
  const { view, token } = b.game.view();
  const hello = buttonsOf(view, String, String).find((x) => x.label === 'hello, say')!;
  b.game.invoke(intentOf({ ...hello, token })); // not through the Book: no new generation
  const after = revision(b);
  stale.props.onSubmitEditing();
  assert.ok(revision(b) > after);
  assert.ok(!b.text().includes(LABEL.oneWord));
  assert.ok(!b.text().some((t) => t.includes('xyzzy')));
});

// Breaks: a refused spell word hidden or pressable, its reason missing, a learned word not shown,
// or a cast press not admitted (mana unchanged).
test('spell words: refused ones carry their reason; lux casts once ash is gathered', () => {
  const b = book(spells as never);
  const castRow = (t: string[]) => t.slice(t.indexOf(LABEL.cast), t.indexOf(LABEL.cast) + 3);
  assert.deepEqual(castRow(b.text()), [LABEL.cast, 'lux', 'lux, cast: too exhausted']);
  b.tap('Take up the apprenticeship');
  b.tap('Trace the sigil');
  assert.ok(b.text().includes('ward, cast: not now'));
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
  assert.equal(words(v).length, 12);
  assert.ok(
    words(v).every((p) => /^[a-zA-Z]{1,32}$/.test((p.input as { word?: string }).word ?? '')),
  );
  assert.deepEqual(words({ ...v, phrases: [] }), []);
  const open = (f: string) =>
    JSON.parse(readFileSync(new URL(`../stories/views/${f}.json`, import.meta.url), 'utf8')).view;
  assert.deepEqual(words({ ...v, combat: open('combat-one-foe').combat }), [], 'combat');
  assert.deepEqual(words({ ...v, scene: open('scene').scene }), [], 'scene');
  assert.deepEqual(words({ ...v, choice: open('npc-choice').choice }), [], 'conversation');
});
