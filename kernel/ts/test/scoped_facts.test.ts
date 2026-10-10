// Toolbox row W2 on the compiled scoped facts sampler: pair facts (times met, trust) keyed by the
// speaker, an entity fact set by a reaction on its event's subject, read by fact_compare at a
// subject; and the loader's floor and site checks. Expected values are hand-counted.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId, Policy } from '../src/contracts.gen.ts';
import { decode, encode } from '../src/foundation/canonical.ts';
import { holds } from '../src/mechanics/policy.ts';
import { scopeSites } from '../src/content/cartridge_scoped_facts.ts';
import { pending, talking } from '../src/mechanics/dialogue/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-scoped-facts-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/scoped_facts_sampler', file], {
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
const S = 'scoped_facts_sampler@0.0.1';
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const fact = (key: string) => ({
  cartridge_id: 'scoped_facts_sampler',
  cartridge_version: '0.0.1',
  kind: 'fact' as const,
  key,
});
const npc = (w: World, k: string) => w.entityIds[`${S}:npc/${k}`] as EntityId;
let n = 0;
const act = (w: World, p: object) => {
  n += 1;
  const id = `cccccccc-4444-4333-8444-${String(n).padStart(12, '0')}`;
  const s = step(
    w,
    { id, world_context_id: w.context, payload: { actor_id: w.character, ...p } } as never,
    n,
  );
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  return s.world;
};
// Pick `choice` in the conversation with `who`, talking first unless already in it.
const chat = (w: World, who: string, choice: string) => {
  const open = talking(w, w.character, npc(w, who));
  const talked = open ? w : act(w, { type: 'talk', target_id: npc(w, who) });
  const [continuation_id] = pending(talked, talked.character)!;
  return act(talked, { type: 'choose', choice_id: choice, continuation_id });
};
const compare = (w: World, key: string, equals: number | boolean, subject: object) =>
  holds(w, w.character, { op: 'fact_compare', fact: fact(key), equals, ...subject } as Policy, {
    target: (subject as { at?: EntityId }).at,
    steps: { n: 0 },
  });
const at = (w: World, who: string, key: string, equals: number) =>
  compare(w, key, equals, { subject: 'target', at: npc(w, who) });

// Breaks: a pair fact ignores its subject (one shared row, so the smith's count reaches the miller
// or the stranger), or a read at the target falls back to the actor's scope.
test('two NPCs remember the player separately; a stranger does not', () => {
  let w = newWorld(content, CONTEXT as never, [1, 2, 3, 4]);
  w = chat(chat(chat(w, 'smith', 'greet'), 'smith', 'greet'), 'smith', 'help');
  w = chat(w, 'miller', 'greet');
  for (const [who, met, trust] of [
    ['smith', 2, 1],
    ['miller', 1, 0],
    ['stranger', 0, 0],
  ] as const) {
    assert.ok(at(w, who, 'times_met', met), `${who} met ${met}`);
    assert.ok(at(w, who, 'trust', trust), `${who} trust ${trust}`);
  }
  // Only changed facts have rows: two for the smith, one for the miller, none for the stranger.
  const rows = Object.keys(w.state.facts ?? {}).map((k) => JSON.parse(JSON.stringify(decode(k))));
  assert.deepEqual(
    rows.map((r) => [r.fact.key, r.scope, r.subject_id]).sort(),
    [
      ['times_met', { kind: 'player', character_id: w.character }, npc(w, 'miller')],
      ['times_met', { kind: 'player', character_id: w.character }, npc(w, 'smith')],
      ['trust', { kind: 'player', character_id: w.character }, npc(w, 'smith')],
    ].sort(),
  );
});

// Breaks: a reaction's entity fact lands on the actor's body or a fixed row instead of the event's
// subject (the NPC given the apple) or the step's named npc, or fact_compare ignores its named npc.
test('an apple given to the smith marks her fed (or the named miller), at the instance scope', () => {
  const named = structuredClone(content) as any;
  const ref = { cartridge_id: 'scoped_facts_sampler', cartridge_version: '0.0.1', kind: 'npc' };
  named.reactions[`${S}:reaction/fed`].apply[0].npc = { ...ref, key: 'miller' };
  for (const [c, fed, hungry] of [
    [content, 'smith', 'miller'],
    [named, 'miller', 'smith'],
  ] as const) {
    let w = newWorld(c, CONTEXT as never, [1, 2, 3, 4]);
    const apple = w.entityIds[`${S}:item/apple`];
    w = act(w, { type: 'take', item_id: apple });
    w = act(w, { type: 'give', item_id: apple, recipient_id: npc(w, 'smith') });
    assert.ok(compare(w, 'fed', true, { npc: { ...ref, key: fed } }), fed);
    assert.ok(compare(w, 'fed', false, { npc: { ...ref, key: hungry } }), hungry);
    const rows = Object.keys(w.state.facts ?? {}).map((k) => JSON.parse(JSON.stringify(decode(k))));
    assert.deepEqual(
      rows.map((r) => [r.scope, r.subject_id]),
      [[{ kind: 'instance', world_context_id: CONTEXT }, npc(w, fed)]],
    );
  }
});

// Breaks: the loader admits a per_subject fact below 1.47, or one named where no subject is known
// (it would be read or written without one), a subject on another fact, a fact_compare of one
// fact without a subject, or a leaf naming two subjects.
test('row W2 needs 1.47 and a known subject, at fact sites only', () => {
  const met = `${S}:fact/times_met`;
  const smith = `${S}:dialogue/smith_talk`;
  const leaf = (extra: object) => (c: any) =>
    (c.dialogues[smith].policy.root = {
      op: 'fact_compare',
      fact: c.facts[met] && fact('times_met'),
      equals: 0,
      ...extra,
    });
  const npcRef = { cartridge_id: 'scoped_facts_sampler', cartridge_version: '0.0.1', kind: 'npc' };
  const root = `.cartridge.dialogues[${JSON.stringify(smith)}].policy.root`;
  const rows: [(c: any) => void, string, string][] = [
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.46'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [leaf({}), 'FACT_SCOPE_UNSUPPORTED', root],
    [
      leaf({ subject: 'target', npc: { ...npcRef, key: 'miller' } }),
      'FACT_SCOPE_UNSUPPORTED',
      `${root}.npc`,
    ],
    [
      (c) => {
        delete c.facts[met].per_subject;
        leaf({ subject: 'target' })(c);
      },
      'FACT_SCOPE_UNSUPPORTED',
      `${root}.subject`,
    ],
    [
      (c) =>
        (c.rooms[`${S}:room/square`].exits.north = {
          to: { ...npcRef, kind: 'room', key: 'square' },
          hidden_until: { fact: fact('times_met'), equals: 1 },
        }),
      'FACT_SCOPE_UNSUPPORTED',
      `.cartridge.rooms[${JSON.stringify(`${S}:room/square`)}].exits.north.hidden_until.fact`,
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

// Breaks: a per_subject fact written by a choice whose save recovery reconciles its facts without
// a subject (a hand_over, a riddle answer with a wrong_limit, a legacy deadline quest's dialogue)
// loads, and that save would not reopen; or one whose receipt recovery checks at the speaker (a
// payment, a riddle without a wrong_limit) is refused; or subject "target" loads in a reaction,
// quest, barrier or skill, which has no target.
test('a per_subject fact in a reconciled choice is FACT_SCOPE_UNSUPPORTED', () => {
  const smith = `${S}:dialogue/smith_talk`;
  const at = (k: string) =>
    `.cartridge.dialogues[${JSON.stringify(smith)}].choices.${k}.sequence[0].fact`;
  const variant = (change: (d: any, c: any) => void) => {
    const c = structuredClone(source);
    change(c.dialogues[smith], c);
    return scopeSites(c).map((d) => d.path);
  };
  const quest = { cartridge_id: 'scoped_facts_sampler', cartridge_version: '0.0.1', kind: 'quest' };
  const refused: [(d: any, c: any) => void, string[]][] = [
    [(d) => (d.choices.help.hand_over = { item: 'apple', to: 'smith' }), [at('help')]],
    [(d) => (d.riddle = { choice_id: 'help', wrong_limit: 1 }), [at('help')]],
    [
      (d, c) => {
        d.quest = { ...quest, key: 'errand' };
        c.quests = { [`${S}:quest/errand`]: { deadline: { fact: fact('errand_done') } } };
      },
      [at('greet'), at('help')],
    ],
  ];
  for (const [change, paths] of refused) assert.deepEqual(variant(change), paths);
  for (const change of [
    (d: any) => (d.choices.help.payment = { from: 'smith', amount: 1 }),
    (d: any) => (d.riddle = { choice_id: 'help' }),
  ])
    assert.deepEqual(variant(change), []);
  const fed = `${S}:reaction/fed`;
  const root = { op: 'fact_compare', fact: fact('trust'), equals: 0, subject: 'target' };
  const when = variant((_, c) => (c.reactions[fed].when = { policy_version: 1, root }));
  assert.deepEqual(when, [`.cartridge.reactions[${JSON.stringify(fed)}].when.root.subject`]);
  for (const kind of ['quests', 'barriers', 'skills']) {
    const k = `${S}:${kind}/x`;
    const paths = variant((_, c) => (c[kind] = { [k]: { policy: { policy_version: 1, root } } }));
    assert.deepEqual(paths, [`.cartridge.${kind}[${JSON.stringify(k)}].policy.root.subject`]);
  }
  assert.deepEqual(scopeSites(source), []);
});

// Breaks (policy.ts compared): a subject "target" read with no target faults (evaluator_error)
// instead of reading false, in any policy evaluated without one.
test('fact_compare at subject target with no target reads false', () => {
  const w = newWorld(content, CONTEXT as never, [1, 2, 3, 4]);
  assert.equal(compare(w, 'trust', 0, { subject: 'target' }), false);
});
