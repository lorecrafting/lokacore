// Toolbox row G9 on the compiled speech sampler: mill -east- lane -east- square -east- watchhouse.
// The elder and the smith are in the square, the watchman one room east, the miller two rooms
// west. The elder's dialogue elder_ward has keyword "ward"; reactions on spoken set elder_heard
// (any word the elder hears), watchman_alerted (a shout of "help") and miller_heard.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { DefinitionRef, EntityId } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { encode } from '../src/foundation/canonical.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';
import { parse } from '../play/text.ts';

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

// The sampler changed by `change`, loaded again.
function reload(change: (c: Obj) => void) {
  const c = structuredClone(content) as unknown as Obj;
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}

let n = 0;
const fresh = (c: Cartridge = content) =>
  newWorld(c, '7e1f0c2a-5d3b-4c8e-9a6f-000000000009' as never, [1, 2, 3, 4]);
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
// another NPC opening the elder's dialogue.
test('a whisper reaches only its addressee', () => {
  const w = fresh();
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
  const r = reload((c) => {
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

// Breaks: a shout that stays in the room (the watchman misses it), carries two rooms (the miller
// hears it), or opens a conversation; a word filter ignored (any shout alerts the watchman).
test('a shout reaches the next room, not two rooms away, and its word filters reactions', () => {
  const w = fresh();
  const help = accepted(w, { type: 'shout', word: 'help' });
  assert.equal(help.decision.outcome, 'spoken');
  assert.equal(fact(help.world, 'watchman_alerted'), true);
  assert.equal(fact(help.world, 'miller_heard'), false);
  assert.ok(heard(help).some((p) => p.entity_id === id(w, 'watchman')));
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
  const r = reload((c) => {
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
  const r = reload((c) => {
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
  const r = reload((c) => {
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
  assert.equal(parse('say x9'), 'Just one word.');
  assert.equal(parse(`shout ${'a'.repeat(33)}`), 'Just one word.');
});

// Breaks: the loader accepts a keyword dialogue or a spoken reaction below kernel_api 1.48, a
// keyword without speech@1, or a keyword on a riddle (whose save proof needs a talk receipt).
test('the loader refuses keywords and spoken reactions below 1.48, without speech or on a riddle', () => {
  const load = (change: (c: Obj) => void) => {
    const r = reload(change);
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
  assert.deepEqual(
    load((c) => {
      delete c.manifest.requires.capabilities.speech;
      delete c.lock.capabilities.speech;
      c.reactions = {};
    }),
    ['UNDECLARED_CAPABILITY', 'keyword'],
  );
  const wrong = 'narration.elder_ward.thank';
  const bank = ['W', 'A', 'R', 'D'];
  const riddle = { choice_id: 'thank', answer: 'ward', bank, wrong };
  assert.deepEqual(
    load((c) => (elder(c).riddle = riddle)),
    ['OUTCOME_MISMATCH', 'keyword'],
  );
});
