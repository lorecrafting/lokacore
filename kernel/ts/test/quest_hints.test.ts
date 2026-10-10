// Toolbox row W23 on the compiled quest sampler (rate 50 logical seconds per real second, so one
// real minute is 3000 logical units): the active stage hints at 10 and 20 real minutes, the
// objectives_met stage at 10 minutes after the key is taken.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-quest-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/quest_sampler', file], {
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
const MINUTE = 3000;
const quest = {
  cartridge_id: 'quest_sampler',
  cartridge_version: '0.0.1',
  kind: 'quest',
  key: 'find_key',
};
let n = 0;
const play = (w: World, p: object): World => run(w, p).world;
function run(w: World, p: object) {
  n += 1;
  const r = step(
    w,
    {
      id: `eeeeeeee-2323-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
function wait(w: World, minutes: number): World {
  n += 1;
  const run_id = 'aaaaaaaa-2323-4000-8000-000000000010';
  const until = w.state.clock + minutes * MINUTE;
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: {
        type: 'elapsed',
        actor_id: w.character,
        run_id,
        from: w.state.clock,
        until,
      } as never,
    },
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const hint = (w: World) => gameView(w).journal[0]?.hint;
const fresh = () =>
  newWorld(content, '2e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f23' as never, [4, 3, 2, 1]);

// Breaks: started_at not written at activation (no hint ever), the first hint instead of the last
// passed one (the look hint at twenty), minutes read as logical units (a hint at once), the
// objectives_complete transition not re-stamping started_at (the return hint at once) or a stage's
// hints read for the other stage.
test('a stage hints at ten and twenty real minutes; the next stage counts from its own start', () => {
  let w = wait(play(fresh(), { type: 'accept_quest', quest }), 9);
  assert.equal(hint(w), undefined);
  w = wait(w, 1);
  assert.equal(hint(w), 'quest.find_key.hint_look');
  w = wait(w, 10);
  assert.equal(hint(w), 'quest.find_key.hint_take');
  w = play(w, { type: 'take', item_id: w.entityIds['quest_sampler@0.0.1:item/key'] });
  assert.equal(gameView(w).journal[0]!.state, 'objectives_complete');
  assert.equal(hint(w), undefined);
  w = wait(w, 10);
  assert.equal(hint(w), 'quest.find_key.hint_return');
});

// Break: the stage read back from the shown text, so a journal reusing one key for active and
// objectives_met shows the objectives_met hint while the objective is still unmet.
test('the hint stage follows the instance, not the shown text key', () => {
  const same = structuredClone(content);
  const j = same.quests!['quest_sampler@0.0.1:quest/find_key']!.journal!;
  (j as { objectives_met: string }).objectives_met = j.active;
  const w = newWorld(same, '2e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f23' as never, [4, 3, 2, 1]);
  assert.equal(
    hint(wait(play(w, { type: 'accept_quest', quest }), 10)),
    'quest.find_key.hint_look',
  );
});

// Break: a row without started_at (a save from before API 1.46) read as started at time 0.
test('an instance row without started_at shows no hint', () => {
  const w = wait(play(fresh(), { type: 'accept_quest', quest }), 30);
  const [[i, row]] = Object.entries(w.state.quests!);
  const { started_at: _, ...old } = row!;
  assert.equal(hint({ ...w, state: { ...w.state, quests: { [i!]: old } } }), undefined);
});

// Breaks (loader twin of test/loka/content_quest_hints_test.exs): hints out of order or an empty
// hints object accepted, hints without real_elapsed time (real minutes undefined) or below kernel_api 1.46 accepted.
test('the loader refuses unordered hints, hints without real time and hints below 1.46', () => {
  const hints = `.cartridge.quests["quest_sampler@0.0.1:quest/find_key"].journal.hints`;
  const q = (c: Obj) => c.quests['quest_sampler@0.0.1:quest/find_key'];
  const rows: [(c: Obj) => void, string, string][] = [
    [(c) => (q(c).journal.hints.active[1].after = 10), 'SCHEMA_VIOLATION', `${hints}.active`],
    [(c) => (q(c).journal.hints = {}), 'SCHEMA_VIOLATION', hints],
    [(c) => delete c.manifest.time_policy, 'INVALID_TIME_POLICY', hints],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.45'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = structuredClone(content) as unknown as Obj;
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path]);
  }
});

// Breaks (action tip): the tip shown on every perform (seen_tip_ never read or never assigned),
// never shown, or shown before the outcome's own line.
test('a recipe tip is read once, on the first perform, after its narration', () => {
  const lines = (r: ReturnType<typeof run>) =>
    r.decision.kind === 'accepted' ? r.decision.narration?.map((l) => l.key) : r.decision;
  const first = run(fresh(), { type: 'perform', action: 'search_floor' });
  assert.deepEqual(lines(first), ['narration.search_floor', 'tip.search_floor']);
  const again = run(first.world, { type: 'perform', action: 'search_floor' });
  assert.deepEqual(lines(again), ['narration.search_floor']);
});

// Break: the tip skipped (or its fact left unassigned) when a checked perform fails.
test('a failed checked perform still shows the tip once and assigns seen_tip_', () => {
  const checked = structuredClone(content);
  const recipe = checked.recipes!['quest_sampler@0.0.1:recipe/search_floor']! as Obj;
  recipe.check = { key: 'search_floor', kind: 'luck', chance: 1 };
  recipe.outcomes.failure = { sequence: [], narration: { actor: 'narration.search_floor' } };
  const w = newWorld(checked, '2e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f23' as never, [4, 3, 2, 1]);
  const r = run(w, { type: 'perform', action: 'search_floor' });
  assert.ok(r.decision.kind === 'accepted' && r.decision.outcome === 'failure');
  assert.deepEqual(
    r.decision.narration?.map((l) => l.key),
    ['narration.search_floor', 'tip.search_floor'],
  );
  assert.deepEqual(
    r.decision.events.map((e) => {
      const p = e.payload as { type: string; fact?: { key: string } };
      return p.fact ? `${p.type}:${p.fact.key}` : p.type;
    }),
    ['check_failed', 'fact_changed:seen_tip_search_floor'],
  );
});

// Breaks (loader twin of test/loka/content_quest_hints_test.exs): an artifact whose recipe writes
// the engine's seen_tip_<key>, lacks its FactSpec, has an unresolved tip, or a tip below 1.46 or
// without fact@1, loads (a key too long for seen_tip_ fails the schema at its FactSpec).
test('the loader checks a recipe tip like the compiler', () => {
  const R = 'quest_sampler@0.0.1:recipe/search_floor';
  const recipe = `.cartridge.recipes["${R}"]`;
  const seen = 'quest_sampler@0.0.1:fact/seen_tip_search_floor';
  const rows: [(c: Obj) => void, string, string][] = [
    [
      (c) => {
        const step = c.recipes[R].outcomes.success.sequence[0];
        step.fact = { ...step.fact, key: 'seen_tip_search_floor' };
      },
      'RESERVED_FACT',
      `${recipe}.outcomes.success.sequence[0].fact`,
    ],
    [(c) => delete c.facts[seen], 'RESERVED_FACT', `.cartridge.facts["${seen}"]`],
    [(c) => (c.recipes[R].tip = 'tip.nope'), 'UNRESOLVED_REFERENCE', `${recipe}.tip`],
    [
      (c) => {
        delete c.quests['quest_sampler@0.0.1:quest/find_key'].journal.hints;
        c.manifest.requires.kernel_api.at_least = '1.45';
      },
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c) => {
        delete c.manifest.requires.capabilities.fact;
        delete c.lock.capabilities.fact;
        c.recipes[R].outcomes.success.sequence = [{ op: 'event.emit', event: 'searched' }];
        // The W24 deadline content's other fact writers.
        delete c.recipes['quest_sampler@0.0.1:recipe/hang_key'];
        delete c.reactions;
      },
      'UNDECLARED_CAPABILITY',
      `${recipe}.tip`,
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = structuredClone(content) as unknown as Obj;
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path]);
  }
});
