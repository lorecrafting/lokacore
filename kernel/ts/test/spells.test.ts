// Toolbox row 29a on the compiled spells sampler: a spell is a recipe cast by its typed word (the
// cast verb). lux costs 2 mana and 1 ash (a reagent pool, gathered at the hearth); ward needs the
// apprentice quest's word (ward_taught), level 2 and wis 11; noctis needs the word read in the
// grimoire. An unknown word and a barred spell are refused alike.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import { bodyOf, type Cartridge, type World } from '../src/runtime/decision.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { encode } from '../src/foundation/canonical.ts';
import { level } from '../src/mechanics/resource.ts';

function compiled(dir: string): Uint8Array {
  const scratch = mkdtempSync(join(tmpdir(), 'loka-spells-sampler-'));
  try {
    const file = join(scratch, 'artifact.json');
    execFileSync('mix', ['loka.compile', `cartridges/${dir}`, file], {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      stdio: 'pipe',
    });
    return readFileSync(file);
  } finally {
    rmSync(scratch, { recursive: true });
  }
}
const artifact = compiled('spells_sampler');
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const C = { cartridge_id: 'spells_sampler', cartridge_version: '0.0.1' };
const ref = (kind: string, key: string) => ({ ...C, kind, key }) as never;
const WIS = 'spells_sampler@0.0.1:attribute/wis';

let n = 0;
const id = () => `eeeeeeee-5555-4555-8555-${String(++n).padStart(12, '0')}` as never;
const play = (w: World, payload: object, key?: string) =>
  step(
    w,
    {
      id: id(),
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
    key as never,
  );
function ok(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
const narration = (r: ReturnType<typeof step>) =>
  ((r.decision as { narration?: { key: string }[] }).narration ?? []).map((t) => t.key);
const pools = (w: World) =>
  ['mana', 'ash'].map((k) => level(w, bodyOf(w, w.character)!, ref('resource', k)));
const cast = (w: World, word: string) => play(w, { type: 'cast', word }, 'cast');
const gather = (w: World) => ok(play(w, { type: 'perform', action: 'gather_ash' }));
/** The levelling row set to `experience` with one point in wis (level 2 at 20, wis 11). */
const levelled = (w: World, experience: number): World => ({
  ...w,
  state: {
    ...w.state,
    levelling: { ...w.state.levelling, [w.character]: { experience, allocated: { [WIS]: 1 } } },
  },
});

/** The sampler's artifact after `change`, as the loader's verdict: 'loaded' or [code, path]. */
function verdict(change: (c: Record<string, any>) => void) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
}

function fresh(): World {
  n = 0;
  return newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e55' as never, [1, 2, 3, 4]);
}

// Breaks: cast is offered in a cartridge without spells: Chapter 1's GameView gains it.
test('cast is not offered in Chapter 1, which has no spells', () => {
  const chapter = loadCartridge(compiled('ashmere_missing_child'), INSTALLED);
  assert.ok(chapter.ok);
  const w = newWorld(
    chapter.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1],
  );
  const view = gameView(ok(play(w, { type: 'choose_ancestry', ancestry: 'fen_born' })));
  assert.ok(view.actions.some((a) => a.action_key === 'look'));
  assert.ok(!view.actions.some((a) => a.action_key === 'cast'));
});

// Breaks: cast is not offered or its offered invocation (word input, any case) does not reach the
// spell; a spell's costs are not paid (mana 3 to 1, ash 1 to 0), or a cast its body cannot pay is
// not refused insufficient_resource before any change.
test('lux: the offered cast with LUX pays 2 mana and 1 ash; short of either it is refused', () => {
  const w = gather(fresh());
  assert.ok(gameView(w).actions.some((a) => a.action_key === 'cast' && a.available));
  const i = identify('spells-test', w.character, {
    invocation_id: 'bbbbbbbb-0000-4000-8000-000000000002',
    actor_id: w.character,
    action_key: 'cast',
    target_ids: [],
    input: { word: 'LUX' },
  } as never);
  assert.equal(i.kind, 'identified');
  const command = resolve(w, i as never);
  assert.ok('payload' in command, JSON.stringify(command));
  const lit = step(w, command, ++n, 'cast' as never);
  assert.deepEqual(narration(lit), ['narration.lux']);
  assert.deepEqual(pools(lit.world), [1, 0]);
  const noAsh = cast(lit.world, 'lux'); // mana 1, ash 0
  assert.equal(code(noAsh), 'insufficient_resource');
  assert.deepEqual(pools(noAsh.world), [1, 0]);
  assert.equal(code(cast(gather(lit.world), 'lux')), 'insufficient_resource'); // ash 1, mana 1
  assert.equal(code(cast(fresh(), 'lux')), 'insufficient_resource'); // mana 3, ash 0
});

// Breaks: any one of ward's three gates (the quest-taught word, level 2, wis 11) is not enforced,
// or the quest does not teach the word.
test('ward needs the quest-taught word, level 2 and wis 11', () => {
  let w = fresh();
  assert.equal(code(cast(w, 'ward')), 'invalid_state');
  w = ok(play(w, { type: 'accept_quest', quest: ref('quest', 'apprentice') }, 'apprentice'));
  w = ok(play(w, { type: 'perform', action: 'trace_sigil' }));
  assert.equal(gameView(w).levelling?.level, 2);
  assert.equal(code(cast(w, 'ward')), 'invalid_state'); // taught, level 2, wis 10
  w = ok(
    play(w, { type: 'raise_attribute', attribute: ref('attribute', 'wis') }, 'raise_attribute'),
  );
  const warded = cast(w, 'ward');
  assert.deepEqual(narration(warded), ['narration.ward']);
  assert.equal(code(cast(levelled(w, 0), 'ward')), 'invalid_state'); // taught, wis 11, level 1
  assert.equal(code(cast(levelled(fresh(), 20), 'ward')), 'invalid_state'); // level 2, wis 11, untaught
});

// Breaks: an unknown word is refused differently from a spell not yet learned (a probe tells real
// words; noctis has no policy, so only its learned fact refuses it), a spell is offered or
// performed by its key, or reading the grimoire does not teach noctis.
test('an unknown word and unread noctis are refused alike; noctis works once read', () => {
  let w = fresh();
  assert.equal(code(cast(w, 'xyzzy')), 'invalid_state');
  assert.deepEqual(cast(w, 'noctis').decision, cast(w, 'xyzzy').decision);
  assert.equal(code(play(w, { type: 'perform', action: 'noctis' })), 'not_found');
  const keys = gameView(w).actions.map((a) => a.action_key);
  assert.ok(!keys.some((k) => ['lux', 'ward', 'noctis'].includes(k)), String(keys));
  const book = w.entityIds['spells_sampler@0.0.1:item/grimoire']!;
  w = ok(play(w, { type: 'take', item_id: book }));
  w = ok(play(w, { type: 'read', target_id: book }));
  assert.deepEqual(narration(cast(w, 'Noctis')), ['narration.noctis']);
});

// Breaks: the TS loader admits a spell or a level_compare leaf below kernel_api 1.51, an opposed
// check on a spell (no detail rating), two spells sharing one word, or a room contribution naming
// a spell's key (both kernels refuse them; content_spells_test.exs).
test('loader: spells and the level_compare leaf need 1.51; spell words are unique', () => {
  const R = (key: string) => `spells_sampler@0.0.1:recipe/${key}`;
  const api = '.cartridge.manifest.requires.kernel_api.at_least';
  const below = (c: Record<string, any>) => (c.manifest.requires.kernel_api.at_least = '1.50');
  const LEVEL = { policy_version: 1, root: { op: 'level_compare', at_least: 1 } };
  const rows: [(c: Record<string, any>) => void, string, string][] = [
    [
      (c) => {
        below(c); // spells without a level_compare leaf
        c.recipes[R('ward')].policy = c.recipes[R('lux')].policy;
      },
      'KERNEL_API_RANGE_INVALID',
      api,
    ],
    [
      (c) => {
        below(c); // a level_compare leaf without spells
        for (const k of ['lux', 'ward', 'noctis']) delete c.recipes[R(k)];
        c.recipes[R('gather_ash')].policy = LEVEL;
      },
      'KERNEL_API_RANGE_INVALID',
      api,
    ],
    [
      (c) => {
        // An opposed check on a spell: no detail rating, and no npc named.
        for (const caps of [c.lock.capabilities, c.manifest.requires.capabilities]) caps.check = 1;
        const wis = { cartridge_id: 'spells_sampler', cartridge_version: '0.0.1' };
        c.recipes[R('ward')].check = {
          key: 'w',
          kind: 'opposed',
          attribute: { ...wis, kind: 'attribute', key: 'wis' },
        };
        c.recipes[R('ward')].outcomes.failure = c.recipes[R('ward')].outcomes.success;
      },
      'SCHEMA_VIOLATION',
      `.cartridge.recipes[${JSON.stringify(R('ward'))}].check`,
    ],
    [
      (c) => (c.recipes[R('noctis')].target.word = 'lux'),
      'DUPLICATE_DEFINITION',
      `.cartridge.recipes[${JSON.stringify(R('lux'))}].target.word`,
    ],
    [
      // A spell is cast by word, never by key: a room contribution naming one is unresolved.
      (c) =>
        (c.rooms['spells_sampler@0.0.1:room/tower'].actions = [{ op: 'union', actions: ['lux'] }]),
      'UNRESOLVED_REFERENCE',
      `.cartridge.rooms["spells_sampler@0.0.1:room/tower"].actions[0].actions[0]`,
    ],
  ];
  for (const [change, diagnostic, path] of rows)
    assert.deepEqual(verdict(change), [diagnostic, path]);
});

const words = (w: World, actor = w.character) =>
  (gameView(w, actor).spell_words ?? []).map((s) => [
    s.word,
    s.available ? 'available' : s.reason.code,
  ]);

// Breaks (word bar S2): spell_words lists a spell the viewer has not learned (ward before the
// quest, noctis before the grimoire), reads learned for world.character instead of the viewer
// (realm seam 1), or its availability differs from cast's own refusal (lux short of ash, ward at
// level 1); or an unlearned spell's cast is told apart from an unknown word.
test('spell_words lists learned spells only, with cast admission as availability', () => {
  let w = fresh();
  assert.deepEqual(words(w), [['lux', 'insufficient_resource']]);
  assert.deepEqual(words(gather(w)), [['lux', 'available']]);
  assert.deepEqual(cast(fresh(), 'ward').decision, cast(fresh(), 'xyzzy').decision);
  w = ok(play(w, { type: 'accept_quest', quest: ref('quest', 'apprentice') }, 'apprentice'));
  w = ok(play(w, { type: 'perform', action: 'trace_sigil' }));
  w = ok(
    play(w, { type: 'raise_attribute', attribute: ref('attribute', 'wis') }, 'raise_attribute'),
  );
  assert.deepEqual(words(w), [
    ['lux', 'insufficient_resource'],
    ['ward', 'available'],
  ]);
  assert.deepEqual(words(levelled(w, 0)), [
    ['lux', 'insufficient_resource'],
    ['ward', 'invalid_state'],
  ]);
  const other = 'char:other' as never;
  assert.deepEqual(
    words(w, other).map(([word]) => word),
    ['lux'],
  );
});

// Breaks (loka-j64e): the authored reason is dropped from spell_words or the offered action, the
// cast refusal and spell_words read different admissions, or an unlearned ward leaks its reason.
test("a failed recipe policy carries the recipe's reason in the GameView; the command refuses alike", () => {
  let w = fresh();
  w = ok(play(w, { type: 'accept_quest', quest: ref('quest', 'apprentice') }, 'apprentice'));
  w = ok(play(w, { type: 'perform', action: 'trace_sigil' }));
  w = levelled(w, 0); // taught, wis 11, level 1
  const ward = gameView(w).spell_words?.find((s) => s.word === 'ward');
  const reason = { code: 'invalid_state', message: { key: 'reason.ward' } };
  assert.deepEqual(ward, { word: 'ward', available: false, reason });
  assert.equal(code(cast(w, 'ward')), 'invalid_state');
  assert.deepEqual(cast(fresh(), 'ward').decision, cast(fresh(), 'xyzzy').decision);
  const key = 'spells_sampler@0.0.1:recipe/trace_sigil';
  const trace = { ...content.recipes![key as never]!, reason: 'reason.ward' as never };
  const recipes = { ...content.recipes, [key]: trace } as Cartridge['recipes'];
  const v = newWorld({ ...content, recipes }, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e55' as never, [1]);
  const offer = gameView(v).actions.find((a) => a.label === 'actions.trace_sigil');
  assert.deepEqual(offer && !offer.available && offer.reason, reason);
  assert.equal(code(play(v, { type: 'perform', action: 'trace_sigil' })), 'invalid_state');
});

// Breaks: an entry listed available whose cast (its word, through the offered cast action) is
// refused, so the word bar would offer a chip that fails.
test('every available spell_words entry casts', () => {
  let w = gather(fresh());
  w = ok(play(w, { type: 'accept_quest', quest: ref('quest', 'apprentice') }, 'apprentice'));
  w = ok(play(w, { type: 'perform', action: 'trace_sigil' }));
  w = ok(
    play(w, { type: 'raise_attribute', attribute: ref('attribute', 'wis') }, 'raise_attribute'),
  );
  const available = gameView(w).spell_words!.filter((s) => s.available);
  assert.deepEqual(
    available.map((s) => s.word),
    ['lux', 'ward'],
  );
  for (const s of available) ok(cast(w, s.word));
});

// Breaks: the TS loader admits a spell without learned, naming a fact this cartridge lacks, a
// non-bool fact, a per_subject one or an instance-scoped one, or a spell below kernel_api 1.98 (content_spells_test.exs).
test('loader: a spell learned names a bool player fact; spells need 1.98', () => {
  const at = `.cartridge.recipes[${JSON.stringify('spells_sampler@0.0.1:recipe/ward')}]`;
  const fact = (c: Record<string, any>, key: string, spec: object) => {
    const taught = c.facts['spells_sampler@0.0.1:fact/ward_taught'];
    c.facts[`spells_sampler@0.0.1:fact/${key}`] = { ...taught, key, ...spec };
    c.recipes['spells_sampler@0.0.1:recipe/ward'].target.learned = ref('fact', key);
  };
  const rows: [(c: Record<string, any>) => void, string, string][] = [
    [
      (c) => delete c.recipes['spells_sampler@0.0.1:recipe/ward'].target.learned,
      'SCHEMA_VIOLATION',
      `${at}.target.learned`,
    ],
    [
      (c) => fact(c, 'count', { value_type: { type: 'int', default: 0 } }),
      'FACT_TYPE_MISMATCH',
      `${at}.target.learned`,
    ],
    [
      (c) => (c.recipes['spells_sampler@0.0.1:recipe/ward'].target.learned = ref('fact', 'nope')),
      'UNRESOLVED_REFERENCE',
      `${at}.target.learned`,
    ],
    [
      (c) =>
        fact(c, 'pair', {
          value_type: { type: 'bool', default: false },
          scopes: ['player'],
          per_subject: true,
        }),
      'FACT_SCOPE_UNSUPPORTED',
      `${at}.target.learned`,
    ],
    [
      (c) =>
        fact(c, 'world', { value_type: { type: 'bool', default: false }, scopes: ['instance'] }),
      'FACT_SCOPE_UNSUPPORTED',
      `${at}.target.learned`,
    ],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.97'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
  ];
  for (const [change, diagnostic, path] of rows)
    assert.deepEqual(verdict(change), [diagnostic, path]);
});

// Breaks (loka-j64e): a recipe reason is not resolved in the catalog, its 1.100 floor is missing,
// or kernel_api compares as text ('1.99' > '1.100'), refusing 1.100 or admitting 1.99.
test('loader: a recipe reason resolves and needs 1.100, which is above 1.99', () => {
  const ward = (c: Record<string, any>) => c.recipes['spells_sampler@0.0.1:recipe/ward'];
  const at = `.cartridge.recipes[${JSON.stringify('spells_sampler@0.0.1:recipe/ward')}]`;
  assert.equal(
    verdict(() => {}),
    'loaded',
  );
  assert.deepEqual(
    verdict((c) => (ward(c).reason = 'reason.nope')),
    ['UNRESOLVED_REFERENCE', `${at}.reason`],
  );
  assert.deepEqual(
    verdict((c) => (c.manifest.requires.kernel_api.at_least = '1.99')),
    ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
  );
  const plain = (c: Record<string, any>) => {
    delete ward(c).reason;
    c.manifest.requires.kernel_api.at_least = '1.99';
  };
  assert.equal(verdict(plain), 'loaded');
});
