// Toolbox row FD4 on the compiled rivals sampler: an npc_pair fact written by a reaction at the
// event's subject toward its named `with` NPC, read by fact_compare and a W6 room line variant;
// facts_typed on pair rows; the loader's 1.89 floor and site checks. Expected values hand-written.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import { holds as invariant } from '../src/runtime/world.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId, Policy } from '../src/contracts.gen.ts';
import { decode, encode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import { holds } from '../src/mechanics/policy.ts';
import { room } from '../play/text.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-pair-facts-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/rivals_sampler', file], {
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
const source = (decode(new TextDecoder().decode(artifact)) as { cartridge: any }).cartridge;
const S = 'rivals_sampler@0.0.1';
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const ref = (kind: string, k: string) => ({
  cartridge_id: 'rivals_sampler',
  cartridge_version: '0.0.1',
  kind,
  key: k,
});
const id = (w: World, k: string) => w.entityIds[`${S}:${k}`] as EntityId;
const gloats = (w: World, npc: string, other: string) =>
  holds(
    w,
    w.character,
    {
      op: 'fact_compare',
      fact: ref('fact', 'gloats'),
      npc: ref('npc', npc),
      with: ref('npc', other),
      equals: true,
    } as Policy,
    { steps: { n: 0 } },
  );
let n = 0;
const act = (w: World, p: object) => {
  n += 1;
  const s = step(
    w,
    {
      id: `cccccccc-4444-4333-8444-${String(n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p },
    } as never,
    n,
  );
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  return s.world;
};
const gift = () => {
  let w = newWorld(content, CONTEXT as never, [1, 2, 3, 4]);
  const apple = id(w, 'item/apple');
  w = act(w, { type: 'take', item_id: apple });
  return act(w, { type: 'give', item_id: apple, recipient_id: id(w, 'npc/smith') });
};

// Breaks: the step drops `with` (one row per subject) or swaps the two NPCs, the reaction writes
// at the body, fact_compare ignores `with`, or the room line variant does not read the pair.
test('the smith given the apple before the miller gloats over him, one ordered row', () => {
  const before = newWorld(content, CONTEXT as never, [1, 2, 3, 4]);
  assert.doesNotMatch(room(content, before), /polishes her apple/);
  const w = gift();
  assert.equal(gloats(w, 'smith', 'miller'), true);
  assert.equal(gloats(w, 'miller', 'smith'), false);
  assert.match(room(content, w), /The smith polishes her apple where the miller can see\./);
  const rows = Object.keys(w.state.facts ?? {}).map((k) => JSON.parse(JSON.stringify(decode(k))));
  assert.deepEqual(
    rows.map((r) => [r.fact.key, r.scope, r.subject_id, r.with_id]),
    [
      [
        'gloats',
        { kind: 'instance', world_context_id: CONTEXT },
        id(w, 'npc/smith'),
        id(w, 'npc/miller'),
      ],
    ],
  );
  assert.ok(invariant('facts_typed', w));
});

// Breaks: facts_typed admits a pair row naming a non-NPC, one NPC twice, or no with_id.
test('facts_typed refuses a pair row without two distinct NPCs', () => {
  const w = gift();
  const smith = id(w, 'npc/smith');
  const miller = id(w, 'npc/miller');
  const at = (subject_id: EntityId, with_id?: EntityId) =>
    key({
      kind: 'fact',
      fact: ref('fact', 'gloats'),
      scope: { kind: 'instance', world_context_id: CONTEXT },
      subject_id,
      ...(with_id && { with_id }),
    } as never);
  for (const k of [at(smith, id(w, 'item/apple')), at(smith, smith), at(miller)])
    assert.equal(
      invariant('facts_typed', { ...w, state: { ...w.state, facts: { [k]: true } } }),
      false,
      k,
    );
});

// Breaks (the first site reported is the smith's variant): the loader admits row FD4 below 1.89, a pair fact outside instance scope, `with` on
// another fact, a pair fact read without `with` (or with an item), or `with` a spawn template.
test('row FD4 needs 1.89, instance scope and a with NPC at each pair site', () => {
  const smith = `${S}:npc/smith`;
  const rootAt = `.cartridge.npcs[${JSON.stringify(smith)}].room_line_variants[0].when.root`;
  const root = (c: any) => c.npcs[smith].room_line_variants[0].when.root;
  const rows: [(c: any) => void, string, string][] = [
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.88'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c) => (c.facts[`${S}:fact/gloats`].scopes = ['player']),
      'FACT_SCOPE_UNSUPPORTED',
      `.cartridge.facts[${JSON.stringify(`${S}:fact/gloats`)}].npc_pair`,
    ],
    [
      (c) => delete c.facts[`${S}:fact/gloats`].npc_pair,
      'FACT_SCOPE_UNSUPPORTED',
      `${rootAt}.with`,
    ],
    [(c) => delete root(c).with, 'FACT_SCOPE_UNSUPPORTED', `${rootAt}.with`],
    [(c) => (root(c).item = ref('item', 'apple')), 'FACT_SCOPE_UNSUPPORTED', `${rootAt}.item`],
    [
      (c) => (c.npcs[`${S}:npc/miller`].spawn_template = true),
      'FACT_SCOPE_UNSUPPORTED',
      `${rootAt}.with`,
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = structuredClone(source);
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
