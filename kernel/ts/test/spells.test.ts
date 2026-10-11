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

const scratch = mkdtempSync(join(tmpdir(), 'loka-spells-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/spells_sampler', file], {
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

function fresh(): World {
  n = 0;
  return newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e55' as never, [1, 2, 3, 4]);
}

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
// words), a spell is offered or performed by its key, or reading the grimoire does not teach noctis.
test('an unknown word and unread noctis are refused alike; noctis works once read', () => {
  let w = fresh();
  assert.equal(code(cast(w, 'xyzzy')), 'invalid_state');
  assert.equal(code(cast(w, 'noctis')), 'invalid_state');
  assert.equal(code(play(w, { type: 'perform', action: 'noctis' })), 'not_found');
  const keys = gameView(w).actions.map((a) => a.action_key);
  assert.ok(!keys.some((k) => ['lux', 'ward', 'noctis'].includes(k)), String(keys));
  const book = w.entityIds['spells_sampler@0.0.1:item/grimoire']!;
  w = ok(play(w, { type: 'take', item_id: book }));
  w = ok(play(w, { type: 'read', target_id: book }));
  assert.deepEqual(narration(cast(w, 'Noctis')), ['narration.noctis']);
});

// Breaks: the TS loader admits a spell or a level_compare leaf below kernel_api 1.51, an opposed
// check on a spell (no detail rating), or two spells sharing one word (both kernels refuse them;
// content_spells_test.exs).
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
  ];
  for (const [change, diagnostic, path] of rows) {
    const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [diagnostic, path]);
  }
});
