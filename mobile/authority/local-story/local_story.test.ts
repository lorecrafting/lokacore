// The local Story authority on Node with real SQLite (node:sqlite), one connection per simulated
// process; a restart closes it and opens a new one on the same file (03 §§14-15; 07 §§8-9).
// Expected values are literals from the fixtures named beside them, never from the code under test.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/canonical.ts';
import type { RngState, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { INSTALLED } from '../../../kernel/ts/src/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Reply, type Saved } from './authority.ts';

const SCOPE = 'story/lineage-1/character-1';
const ACTOR = 'bd595711-ea5f-89a5-abb0-046cd349d2f9';
// ashmere_items ids (kernel/ts/test/invocation_cases.json): the satchel, the NPC, the body.
const SATCHEL = 'd530207e-b845-8be5-9d53-b44b2cf5d8a1';
const NPC = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2';
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157';

const world = (fixture: string, seed: readonly number[]) => {
  const kat = read(`protocol/fixtures/${fixture}`);
  const artifact = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok);
  const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
  return newWorld(loaded.cartridge as Cartridge, context, seed as RngState);
};
const items = world('cartridge_items_hash.json', [1, 2, 3, 4]);
// numeric-vectors.json rng_steps[3].state; its next draw fails pick_lock (invocation_cases.json).
const dusk = world('cartridge_dusk_hash.json', [27274249, 25704967, 31982592, 12605441]);

/** A process: one connection to the save at `path`, adapted to expo-sqlite's sync names. */
function processOn(path: string, fresh = items, pageSize = 0) {
  const sql = new DatabaseSync(path);
  if (pageSize) sql.exec(`PRAGMA page_size = ${pageSize}`);
  const db = {
    execSync: (s: string) => sql.exec(s),
    runSync: (s: string, ...p: (string | number | null)[]) => sql.prepare(s).run(...p),
    getFirstSync: <T>(s: string, ...p: (string | number | null)[]) =>
      (sql.prepare(s).get(...p) ?? null) as T | null,
    getAllSync: <T>(s: string, ...p: (string | number | null)[]) => sql.prepare(s).all(...p) as T[],
  };
  const one = (q: string) => Object.values(sql.prepare(q).get()!)[0];
  return { sql, story: openStory(db, fresh, SCOPE), one };
}
const save = () => join(mkdtempSync(join(tmpdir(), 'loka-s1-')), 'save.db');
const invocation = (n: number, action_key: string, target_ids: string[], token?: string) => ({
  invocation_id: `00000000-0000-4000-8000-00000000000${n}`,
  action_key,
  actor_id: ACTOR,
  target_ids,
  input: {},
  ...(token && { view_freshness_token: token }),
});
const take = invocation(1, 'take', [SATCHEL], 'view-1');
const outcome = (r: Reply) => (r as Saved).decision as { outcome: string };
const state = (p: { story: { world: () => { state: unknown } } }) =>
  encode(p.story.world().state as never);

// Breaks: load returning the fresh world, changed rows, clock or RNG not written, or the revision
// not persisted.
test('a tiny world survives a restart with the same state', () => {
  const path = save();
  const a = processOn(path);
  assert.equal((a.story.invoke(take) as Saved).revision, 1);
  const before = state(a);
  assert.ok(before.includes(`"${SATCHEL}":"${BODY}"`));
  a.sql.close();
  const b = processOn(path);
  assert.equal(state(b), before);
  assert.equal(b.one('SELECT revision FROM head'), 1);
});

// Breaks (03 §14): the receipt looked up after resolving against the current world (the satchel
// was given away), a replay that decides again or reports the current revision, the view token in
// the match, altered intent replayed or applied instead of refused, or a receipt of another
// intent_digest_version compared as if it were this one.
test('a retried consumed take replays its receipt; altered intent is a conflict', () => {
  const path = save();
  const a = processOn(path);
  const first = a.story.invoke(take);
  assert.equal(outcome(first).outcome, 'taken');
  a.sql.close();
  const b = processOn(path);
  const give = b.story.invoke(invocation(2, 'give', [SATCHEL, NPC]));
  assert.deepEqual([outcome(give).outcome, (give as Saved).revision], ['given', 2]);
  const before = b.story.world();
  const retry = b.story.invoke({ ...take, view_freshness_token: 'stale' });
  assert.deepEqual(retry, { ...first, replay: true });
  const altered = { ...invocation(1, 'give', [SATCHEL, NPC]) };
  assert.deepEqual(b.story.invoke(altered), { kind: 'conflict' });
  b.sql.exec("UPDATE receipt SET intent_digest_version = 'loka-intent-v0'");
  assert.deepEqual(b.story.invoke(take), { kind: 'conflict' });
  assert.equal(b.story.world(), before);
  assert.equal(b.one('SELECT count(*) FROM receipt'), 2);
  assert.equal(b.one('SELECT revision FROM head'), 2);
});

// Breaks (04 §5.0; 03 §14): a failed attempt not committing its draw, a rejection advancing the
// revision or getting no receipt, a replay drawing again, or the receipt without its intent
// digest version, or the clock not saved. The draw leaves numeric-vectors.json rng_steps[4].state.
test('a failed attempt and a rejection persist; their retries draw nothing', () => {
  const path = save();
  const after = [15224335, 29364750, 272377353, 1125134346];
  const pick = invocation(2, 'pick_lock', []);
  const dance = invocation(3, 'dance', []);
  const a = processOn(path, dusk);
  const failed = a.story.invoke(pick);
  assert.deepEqual([(failed as Saved).revision, outcome(failed).outcome], [1, 'failure']);
  const rejected = a.story.invoke(dance);
  assert.deepEqual(rejected, {
    kind: 'saved',
    replay: false,
    revision: 1,
    decision: { kind: 'rejected', error: { code: 'unsupported_capability' } },
  });
  const before = state(a);
  a.sql.close();
  const b = processOn(path, dusk);
  assert.equal(state(b), before);
  assert.deepEqual(b.story.world().state.rng, after);
  assert.equal(b.story.world().state.clock, dusk.state.clock + 600); // pick_lock's duration
  assert.deepEqual(b.story.invoke(pick), { ...failed, replay: true });
  assert.deepEqual(b.story.invoke(dance), { ...rejected, replay: true });
  assert.deepEqual(b.story.world().state.rng, after);
  assert.equal(b.one('SELECT rng FROM head'), JSON.stringify(after));
  assert.equal(b.one('SELECT DISTINCT intent_digest_version FROM receipt'), 'loka-intent-v1');
});

// Breaks (03 §15; ADR-072): memory adopted before COMMIT, a partial write surviving the failed
// transaction, or saved success reported. A 512-byte page makes the receipt need new pages, which
// max_page_count forbids: a real SQLITE_FULL (storage lessons). Lifting it, the same id commits
// as NEW, since a definite rollback left no receipt.
test('a definite write failure leaves memory and storage at the prior revision', () => {
  const p = processOn(save(), items, 512);
  const before = p.story.world();
  const rows = p.one('SELECT group_concat(key || value) FROM state_row ORDER BY key');
  p.sql.exec(`PRAGMA max_page_count = ${p.one('PRAGMA page_count')}`);
  assert.throws(() => p.story.invoke(take), { errcode: 13 }); // SQLITE_FULL
  assert.equal(p.story.world(), before);
  assert.equal(p.one('SELECT count(*) FROM receipt'), 0);
  assert.equal(p.one('SELECT revision FROM head'), 0);
  assert.equal(p.one('SELECT group_concat(key || value) FROM state_row ORDER BY key'), rows);
  p.sql.exec('PRAGMA max_page_count = 1000000');
  const retry = p.story.invoke(take) as { replay: boolean; revision: number };
  assert.deepEqual(
    [retry.replay, retry.revision, p.one('SELECT revision FROM head')],
    [false, 1, 1],
  );
});

// Breaks (04 §5.2 step 7; ADR-075 §4): a fault receipted, which would replay it forever, or its
// proposal adopted. The bell's ring_bell assigns a value its FactSpec does not allow
// (invocation.test.ts), which faults precondition_failed.
test('a fault changes nothing and gets no receipt', () => {
  const ok = world('cartridge_bell_hash.json', [1, 2, 3, 4]);
  const cartridge = structuredClone(ok.cartridge) as any;
  cartridge.recipes['ashmere_bell@0.0.1:recipe/ring_bell'].outcomes.success.sequence[0].value =
    'yes';
  const p = processOn(save(), { ...ok, cartridge });
  const before = p.story.world();
  const ring = invocation(4, 'ring_bell', []);
  assert.deepEqual(p.story.invoke(ring), { kind: 'fault', code: 'precondition_failed' });
  assert.equal(p.story.world(), before);
  assert.equal(p.one('SELECT count(*) FROM receipt'), 0);
});
