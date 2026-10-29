// Toolbox row G9 on the compiled speech sampler: mill -east- lane -east- square -east- watchhouse.
// The elder and the smith are in the square, the watchman one room east, the miller two rooms
// west. The elder's dialogue elder_ward has keyword "ward"; reactions on spoken set elder_heard
// (any word the elder hears), watchman_alerted (a shout of "help") and miller_heard.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { DefinitionRef, EntityId } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';
import { parse } from '../play/text.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { ctx, reload } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-speech-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/speech_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'speech_sampler', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
const id = (w: World, key: string) => w.entityIds[`speech_sampler@0.0.1:npc/${key}`] as EntityId;
const fact = (w: World, key: string) => value(w, w.character, ref('fact', key));

let n = 0;
const fresh = (c: Cartridge = content) =>
  newWorld(c, ctx('7e1f0c2a-5d3b-4c8e-9a6f-000000000009'), [1, 2, 3, 4]);
function play(w: World, p: object) {
  n += 1;
  return step(
    w,
    {
      id: `dddddddd-6666-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
}
const accepted = (w: World, p: object) => {
  const r = play(w, p);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r as typeof r & { decision: { kind: 'accepted' } };
};
const heard = (r: ReturnType<typeof accepted>) =>
  r.decision.events.flatMap((e) => (e.payload.type === 'spoken' ? [e.payload] : []));

// Breaks: the word compared without case-folding (WARD finds no keyword), a keyword dialogue
// offered as a plain talk (its keyword bypassed), or a hearer missing from the room's events.
test("saying a keyword in any case opens the speaker's keyed dialogue; talk never offers it", () => {
  const w = fresh();
  const elder = gameView(w).entities?.find((e) => e.id === id(w, 'elder'));
  assert.deepEqual(
    elder?.actions?.map((a) => a.action_key),
    ['whisper'],
  );
  assert.equal(play(w, { type: 'talk', target_id: id(w, 'elder') }).decision.kind, 'rejected');
  const r = accepted(w, { type: 'say', word: 'WARD' });
  assert.equal(r.decision.outcome, 'choice_opened');
  assert.equal(gameView(r.world).choice?.prompt.key, 'dialogue.elder_ward.prompt');
  assert.deepEqual(
    new Set(heard(r).map((p) => p.entity_id)),
    new Set([id(w, 'elder'), id(w, 'smith')]),
  );
  assert.ok(heard(r).every((p) => p.loudness === 'say' && p.word === 'ward'));
  assert.equal(fact(r.world, 'elder_heard'), true);
});

// Breaks: an unauthored word echoed into the event (free text past the trust boundary), a
// malformed or missing word (a space, a non-ASCII letter, 33 letters, none: RegExp.test reads a
// missing word as "undefined") accepted or thrown on when the host skips the schema, or the
// 32-letter bound cut short.
test('an unauthored word reaches no event; a malformed or missing word is refused', () => {
  accepted(fresh(), { type: 'say', word: 'a'.repeat(32) });
  const r = accepted(fresh(), { type: 'say', word: 'Hello' });
  assert.equal(r.decision.outcome, 'spoken');
  assert.equal(heard(r).length, 2);
  assert.ok(heard(r).every((p) => !('word' in p)));
  const said = ['wa rd', 'wörd', 'a'.repeat(33)].map((word) => ({ type: 'say', word }));
  for (const p of [...said, { type: 'say' }, { type: 'shout' }])
    assert.deepEqual(play(fresh(), p).decision, {
      kind: 'rejected',
      error: { code: 'invalid_state' },
    });
});

// Breaks: a whisper heard by the whole room (the elder's reaction fires) or a keyword whispered to
// another NPC opening the elder's dialogue, or the offered whisper resolving without its NPC
// (TARGETS in commands/invocation.ts lacks whisper: every Book whisper unsupported_capability).
test('a whisper reaches only its addressee', () => {
  const w = fresh();
  const offered = gameView(w)
    .entities?.find((e) => e.id === id(w, 'smith'))
    ?.actions?.find((a) => a.action_key === 'whisper');
  assert.ok(offered, 'whisper offered on the smith');
  const i = identify('speech-test', w.character, {
    invocation_id: 'bbbbbbbb-0000-4000-8000-000000000003',
    actor_id: w.character,
    action_key: offered.action_key,
    target_ids: [id(w, 'smith')],
    input: { word: 'ward' },
  } as never);
  const command = resolve(w, i as never);
  assert.deepEqual('payload' in command && command.payload, {
    type: 'whisper',
    actor_id: w.character,
    target_id: id(w, 'smith'),
    word: 'ward',
  });
  const r = accepted(w, { type: 'whisper', target_id: id(w, 'smith'), word: 'ward' });
  assert.equal(r.decision.outcome, 'spoken');
  assert.deepEqual(
    heard(r).map((p) => [p.entity_id, p.loudness]),
    [[id(w, 'smith'), 'whisper']],
  );
  assert.equal(fact(r.world, 'elder_heard'), false);
  assert.equal(gameView(r.world).choice, undefined);
  assert.deepEqual(
    play(w, { type: 'whisper', target_id: id(w, 'watchman'), word: 'ward' }).decision,
    { kind: 'rejected', error: { code: 'not_present' } },
  );
});

// Breaks: a dead NPC whose body stays in the room still hearing a say (its spoken reaction
// fires, its keyword dialogue opens) or taking a whisper.
test('a dead NPC hears nothing', () => {
  const r = reload(content, (c) => {
    c.npcs['speech_sampler@0.0.1:npc/elder'].hp = { minimum: 0, maximum: 6, start: 0, gain: 0 };
  });
  assert.ok(r.ok, JSON.stringify(r));
  const w = fresh(r.cartridge as Cartridge);
  const said = accepted(w, { type: 'say', word: 'ward' });
  assert.equal(said.decision.outcome, 'spoken');
  assert.deepEqual(
    heard(said).map((p) => p.entity_id),
    [id(w, 'smith')],
  );
  assert.equal(fact(said.world, 'elder_heard'), false);
  assert.deepEqual(play(w, { type: 'whisper', target_id: id(w, 'elder'), word: 'ward' }).decision, {
    kind: 'rejected',
    error: { code: 'not_present' },
  });
});

// Breaks: a shout that stays in the room (the watchman misses it), skips the actor's own room (the
// elder and smith miss it), carries two rooms (the miller hears it), or opens a conversation; a
// word filter ignored (any shout alerts the watchman).
test('a shout reaches the next room, not two rooms away, and its word filters reactions', () => {
  const w = fresh();
  const help = accepted(w, { type: 'shout', word: 'help' });
  assert.equal(help.decision.outcome, 'spoken');
  assert.equal(fact(help.world, 'watchman_alerted'), true);
  assert.equal(fact(help.world, 'miller_heard'), false);
  assert.deepEqual(
    heard(help)
      .map((p) => p.entity_id)
      .sort(),
    [id(w, 'elder'), id(w, 'smith'), id(w, 'watchman')].sort(),
  );
  assert.equal(accepted(w, { type: 'shout', word: 'ward' }).decision.outcome, 'spoken');
  const hello = accepted(w, { type: 'shout', word: 'hello' });
  assert.equal(fact(hello.world, 'watchman_alerted'), false);
  const walked = accepted(w, { type: 'move', direction: 'west' }).world;
  assert.equal(
    fact(accepted(walked, { type: 'shout', word: 'hello' }).world, 'miller_heard'),
    true,
  );
});

// Breaks: hearers' dialogues tried in EntityId order (the elder's id sorts before the smith's), so
// which of two dialogues keyed by one word opens would not follow the authored keys.
test('of two dialogues keyed by one word, a say opens the first by key', () => {
  const r = reload(content, (c) => {
    const d = structuredClone(c.dialogues['speech_sampler@0.0.1:dialogue/elder_ward']) as Obj;
    const smith = ref('npc', 'smith');
    Object.assign(d, {
      key: 'a_smith_ward',
      npc: smith,
      roles: { smith: { role: 'npc', npc: smith } },
    });
    c.dialogues['speech_sampler@0.0.1:dialogue/a_smith_ward'] = d;
  });
  assert.ok(r.ok, JSON.stringify(r));
  const w = fresh(r.cartridge as Cartridge);
  assert.ok(id(w, 'elder') < id(w, 'smith'));
  const opened = accepted(w, { type: 'say', word: 'ward' }).world;
  assert.equal(Object.values(opened.state.choices ?? {})[0]?.source.key, 'a_smith_ward');
});

// Breaks: a talk that opens a keyword dialogue (the elder's elder_ward sorts before her plain
// elder_yarn), or an unnamed reaction step not landing on the hearer (the spoken subject).
test('talk opens the plain dialogue; an unnamed reaction step lands on each hearer', () => {
  const r = reload(content, (c) => {
    const d = structuredClone(c.dialogues['speech_sampler@0.0.1:dialogue/elder_ward']) as Obj;
    delete d.keyword;
    c.dialogues['speech_sampler@0.0.1:dialogue/elder_yarn'] = { ...d, key: 'elder_yarn' };
    c.facts['speech_sampler@0.0.1:fact/heard'] = {
      ...c.facts['speech_sampler@0.0.1:fact/elder_heard'],
      key: 'heard',
      per_subject: true,
    };
    const hears = c.reactions['speech_sampler@0.0.1:reaction/elder_hears'];
    hears.on = { event: 'spoken' };
    hears.apply = [{ op: 'fact.assign', fact: ref('fact', 'heard'), value: true }];
  });
  assert.ok(r.ok, JSON.stringify(r));
  const w = fresh(r.cartridge as Cartridge);
  const talked = accepted(w, { type: 'talk', target_id: id(w, 'elder') }).world;
  assert.equal(Object.values(talked.state.choices ?? {})[0]?.source.key, 'elder_yarn');
  const said = accepted(w, { type: 'say', word: 'hello' }).world;
  const heard = (npc: string) => value(said, said.character, ref('fact', 'heard'), id(w, npc));
  assert.deepEqual([heard('elder'), heard('smith'), heard('watchman')], [true, true, false]);
});

// Breaks (loka-j2mo): a spoken reaction without an npc filter, heard by the elder and the smith,
// writing one instance fact twice in one decision faults conflicting_write instead of committing.
test('two hearers of one say write one shared fact and the step commits', () => {
  const r = reload(content, (c) => {
    c.reactions['speech_sampler@0.0.1:reaction/elder_hears'].on = { event: 'spoken' };
  });
  assert.ok(r.ok, JSON.stringify(r));
  const said = accepted(fresh(r.cartridge as Cartridge), { type: 'say', word: 'hello' });
  assert.equal(heard(said).length, 2);
  assert.equal(fact(said.world, 'elder_heard'), true);
});

// Breaks: speech offered or accepted while a conversation is open (a say would close it, unlike
// any saved row allows); the view and the step must agree.
test('speech is neither offered nor accepted while a conversation is open', () => {
  const open = accepted(fresh(), { type: 'say', word: 'ward' }).world;
  const view = gameView(open);
  const keys = [
    ...(view.actions ?? []),
    ...(view.entities ?? []).flatMap((e) => e.actions ?? []),
  ].map((a) => a.action_key);
  assert.deepEqual(
    keys.filter((k) => ['say', 'whisper', 'shout'].includes(k)),
    [],
  );
  assert.deepEqual(play(open, { type: 'shout', word: 'help' }).decision, {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
});

// Breaks (ADR-075 §6 A5): `loka play` turning a token that is not a Word into a say Command, which
// the record schema then rejects and the CLI crashes on.
test('loka play makes a say or shout Command only from a word of letters', () => {
  assert.deepEqual(parse('SAY Ward'), { type: 'say', word: 'ward' });
  assert.equal(parse('say x9'), 'One word of 1 to 32 letters.');
  assert.equal(parse(`shout ${'a'.repeat(33)}`), 'One word of 1 to 32 letters.');
});

// Breaks: the loader accepts a keyword dialogue or a spoken reaction below kernel_api 1.48 (a
// keyword on a riddle is the compiler's: content_speech_test.exs).
test('the loader refuses keywords and spoken reactions below 1.48', () => {
  const load = (change: (c: Obj) => void) => {
    const r = reload(content, change);
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path.split('.').pop()];
  };
  const elder = (c: Obj) => Object.values(c.dialogues as Obj)[0] as Obj;
  const floor = ['KERNEL_API_RANGE_INVALID', 'at_least'];
  const below = (c: Obj) => (c.manifest.requires.kernel_api.at_least = '1.47');
  assert.deepEqual(
    load((c) => (below(c), (c.reactions = {}))),
    floor,
  );
  assert.deepEqual(
    load((c) => (below(c), delete elder(c).keyword)),
    floor,
  );
});

// Breaks (word bar S2): the GameView drops or reorders the cartridge's speech.phrases, lists them
// when none are authored, or the TS loader admits a phrase that is not a Word, an empty list,
// phrases below kernel_api 1.98 or without speech@1 (content_speech_test.exs).
test('phrases: the authored speech.phrases, Words only, from 1.98 with speech@1', () => {
  assert.deepEqual(gameView(fresh()).phrases, ['ward', 'help', 'hello']);
  const none = reload(content, (c) => delete c.speech);
  assert.ok(none.ok, JSON.stringify(none));
  assert.equal(gameView(fresh(none.cartridge as Cartridge)).phrases, undefined);
  const refused = (change: (c: Obj) => void) => {
    const r = reload(content, change);
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  assert.deepEqual(
    refused((c) => (c.speech.phrases = ['ward', 'Help!'])),
    ['SCHEMA_VIOLATION', '.cartridge.speech.phrases[1]'],
  );
  assert.deepEqual(
    refused((c) => (c.speech.phrases = [])),
    ['SCHEMA_VIOLATION', '.cartridge.speech.phrases'],
  );
  assert.deepEqual(
    refused((c) => (c.manifest.requires.kernel_api.at_least = '1.97')),
    ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
  );
  assert.deepEqual(
    refused((c) => {
      delete c.manifest.requires.capabilities.speech;
      delete c.lock.capabilities.speech;
      c.reactions = {};
      for (const d of Object.values(c.dialogues as Obj)) delete (d as Obj).keyword;
    }),
    ['UNDECLARED_CAPABILITY', '.cartridge.speech.phrases'],
  );
});
