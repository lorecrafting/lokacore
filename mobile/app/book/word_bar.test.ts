// Word bar (docs/system/book-ui.md, Word bar): no say icon or field in single-player (loka-evzt), the
// Character page's Spells, and the say machinery kept for the Realm (twins, echo, conversation turn)
// through the real authority and Book. Expected text is literal from cartridges/speech_sampler and
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
import { LABEL } from './labels.ts';
import { spoken } from './words.ts';
import { conversation } from './model.ts';

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
// No Book control sends speech in single-player: the Realm's opener will press the same wordless
// twin with the typed word; here the presenter does, and the Book redraws.
const speak = (b: Book, key: string, word: string) => {
  const twin = b.p.screen().buttons.find((x: any) => x.action_key === key && !('word' in x.input));
  assert.ok(twin, `no wordless ${key}`);
  b.p.press({ ...twin, input: { word } });
  b.draw();
};

// Breaks (loka-evzt): the say icon, its field or a Say or Shout control drawn in single-player while
// the engine offers say, shout and cast, or a speech twin leaking into the cards as `, say`.
test('single-player draws no say icon, field, Say or Shout while the engine offers them', () => {
  const b = book(speech as never);
  const offered = b.game.view().view.actions.map((a) => a.action_key);
  assert.ok(
    ['say', 'shout'].every((k) => offered.includes(k)),
    'the sampler offers speech',
  );
  const l = b.labels();
  for (const gone of ['Say to the room', LABEL.say, LABEL.shout, LABEL.cast])
    assert.ok(!l.includes(gone), gone);
  assert.ok(!l.some((x) => /^\w*, (say|shout|cast|whisper)/.test(x)), 'no speech card or chip');
  assert.ok(!b.draw().some((n) => n.type === 'TextInput'), 'no word field');
});

// Breaks: a word press not admitted (wrong input shape), or the Book's word turn not turning to the
// conversation it opens (the Realm's opener presses through it, as pressBook does).
test('saying ward opens the elder conversation and the word turn turns to it', async () => {
  const { wordTurn } = await import('./updates.ts'); // after book()'s .tsx loader
  const b = book(speech as never);
  const was = b.game.view().view;
  speak(b, 'say', 'ward');
  const now = b.game.view().view;
  assert.ok(now.choice, 'a conversation opens');
  assert.deepEqual(wordTurn([], 'say', was, now), [conversation(now)]);
  assert.deepEqual(wordTurn([], 'wave', was, now), [], 'only a word turns');
});

// Breaks: a shout sent as a say (the watchman next door would not hear it).
test('shouting help in the square alerts the watchman next door', () => {
  const b = book(speech as never);
  speak(b, 'shout', 'help');
  assert.deepEqual(facts(b), { elder_heard: true, watchman_alerted: true });
});

// Breaks (pass-1 R5): an accepted speech press with no narration leaving the page silent, echoed
// twice, or echoed with the wrong verb, word or listener.
test('a say or shout with no narration echoes once in ink', () => {
  const b = book(speech as never);
  const echoes = () => b.text().filter((t) => t.startsWith('You '));
  speak(b, 'say', 'hello');
  speak(b, 'shout', 'help');
  assert.deepEqual(echoes(), ['You say, "Hello."', 'You shout, "Help!"']);
  assert.equal(spoken('say', undefined), undefined); // a wordless retry falls back to OUTCOME
});

// Breaks: a refused spell word's reason missing from the Character page's Spells, a refused word
// drawn castable, a spell word offered where Cast is not, or a Spells card cast not admitted
// (mana unchanged).
test('spell words: refused ones list their reason under Spells; lux casts there once ash is gathered', () => {
  const b = book(spells as never);
  const spellsBlock = (refused: string) => {
    b.tap(CONTENTS);
    b.tap('Character');
    b.refuse(`${refused}, cast`);
    const t = b.text();
    b.tap(LABEL.backToContents);
    b.tap(LABEL.backToWorld);
    return t.slice(t.indexOf(LABEL.spells));
  };
  assert.ok(spellsBlock('lux').includes("lux, cast\nYou can't do that—need 1 ash."));
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
  assert.ok(spellsBlock('ward').includes('ward, cast\nNeeds level 2 and wisdom 11.'));
  b.tap('hearth, open');
  b.tap('Gather ash');
  b.tap(LABEL.leave);
  b.tap(CONTENTS);
  b.tap('Character');
  b.refuse('ward, cast'); // still refused: never the castable card
  b.tap('lux, cast');
  assert.ok(b.labels().includes('hearth, open'), 'back on World');
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
  // wordless twins, kept for the Realm (say, shout, cast, whisper per person)
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

// Breaks: a word press that settles later (its commit acknowledgement lost, then recovered by a
// pulse) not turning to the conversation it opens, as a press that settles at once does.
test('a word that settles later still turns to its conversation', () => {
  const a = elapsedHost(':memory:', undefined, speech as never);
  const b = book(speech as never, a);
  a.fault.kind = 'lost';
  a.fault.armed = true;
  speak(b, 'say', 'ward');
  assert.ok(b.game.pending());
  assert.ok(!b.labels().includes('Thank her'));
  a.fault.reads = false;
  b.game.pulse();
  assert.ok(b.labels().includes('Thank her'));
});

// Breaks (pass-1 R5): the echo shown beside a spoken press's own narration. Lost fixture: the
// showcase's spoken begone reaction became a card (loka-eyk7) and no cartridge has a spoken
// reaction whose receipt narrates; the PM decides between a sampler fixture and retiring this.
test.skip('a spoken press whose receipt narrates shows the narration, not the echo', () => {});
