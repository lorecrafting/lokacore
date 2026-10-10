// Toolbox row W3, rumour by co-presence (docs/system/mechanics.md "Rumour by co-presence"):
// cartridges/rumour_sampler, compiled by the Elixir compiler and loaded by the kernel.
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
import type { Policy } from '../src/contracts.gen.ts';
import { encode } from '../src/foundation/canonical.ts';
import { holds } from '../src/mechanics/policy.ts';
import { reactions } from '../src/content/cartridge_reactions.ts';
import type { Checks } from '../src/content/cartridge_refs.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-rumour-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/rumour_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
const C = 'rumour_sampler@0.0.1';
const ref = (kind: string, key: string) => ({
  cartridge_id: 'rumour_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
// `change` applied to a copy of the compiled cartridge, then loaded: the cartridge or the diagnostic.
function load(change: (c: any) => void = () => {}) {
  const c = structuredClone(source);
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
const fresh = () => {
  const r = load();
  assert.ok(r.ok, JSON.stringify(r));
  return newWorld(r.cartridge as Cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1]);
};
let n = 0;
function run(w: World, p: object) {
  n += 1;
  return step(
    w,
    {
      id: `eeeeeeee-3030-4030-8030-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
}
function play(w: World, p: object): World {
  const r = run(w, p);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const until = (hour: number, minute = 0) => ({ type: 'wait', until: hour * 3600 + minute * 60 });
const move = (direction: string) => ({ type: 'move', direction });
const knows = (w: World, npc: string) =>
  holds(w, w.character, {
    op: 'fact_compare',
    fact: ref('fact', 'knows_mill'),
    npc: ref('npc', npc),
    equals: true,
  } as Policy);
const talk = (w: World) => run(w, { type: 'talk', target_id: w.entityIds[`${C}:npc/innkeeper`] });

// Breaks: an NPC's schedule jump firing no entity_entered_room reaction (so nobody learns), the
// fact global rather than per NPC (the innkeeper would know at 16:30), or the dialogue ungated.
test('the innkeeper knows about the mill by evening because Ada walked through the inn at 17:00', () => {
  let w = play(fresh(), move('west')); // 15:00 in the inn: nothing to tell yet
  assert.notEqual(talk(w).decision.kind, 'accepted');
  w = play(play(w, move('east')), until(16, 30)); // Ada passed the mill at 16:00
  assert.deepEqual([knows(w, 'ada'), knows(w, 'innkeeper')], [true, false]);
  // Ada walked through the inn at 17:00, the player in the square (one wait per due hour: one wait
  // across two of Ada's hours faults nonfuture_job, Beads loka-qi0r).
  w = play(play(w, until(17, 30)), until(18, 30));
  assert.equal(knows(w, 'innkeeper'), true);
  assert.equal(talk(play(w, move('west'))).decision.kind, 'accepted');
});

// Breaks: the rumour spreads on anyone entering the inn while Ada knows, with Ada elsewhere (a
// trigger on the room alone), so co-presence is not required.
test('the player entering the inn while Ada is away carries nothing', () => {
  const w = play(play(fresh(), until(16, 30)), move('west')); // Ada knows, at the mill
  assert.deepEqual([knows(w, 'ada'), knows(w, 'innkeeper')], [true, false]);
});

const TELLS = `${C}:reaction/tells_innkeeper`;
// Row W2's own 1.47 uses removed, so only the entrant filter needs the floor.
const plain = (c: any) => {
  delete c.facts[`${C}:fact/knows_mill`].per_subject;
  delete c.reactions[TELLS].when.root.npc;
  delete c.reactions[TELLS].apply[0].npc;
  c.dialogues[`${C}:dialogue/innkeeper_mill`].policy.root = { op: 'all', items: [] };
  c.manifest.requires.kernel_api.at_least = '1.46';
};
// Breaks: the loader skips the entrant filter's reference (a misspelt NPC loads and the rule
// silently never fires) or loads it below kernel_api 1.47 (twin of content_rumour_test.exs).
test("the loader checks the entrant filter's NPC and its 1.47 floor", () => {
  const verdict = (change: (c: any) => void) => {
    const r = load(change);
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path, r.diagnostic.data];
  };
  assert.deepEqual(
    verdict((c) => (c.reactions[TELLS].on.npc.key = 'ghost')),
    [
      'UNRESOLVED_REFERENCE',
      `.cartridge.reactions[${JSON.stringify(TELLS)}].on.npc`,
      { target: `${C}:npc/ghost` },
    ],
  );
  assert.deepEqual(verdict(plain), [
    'KERNEL_API_RANGE_INVALID',
    '.cartridge.manifest.requires.kernel_api.at_least',
    {},
  ]);
  assert.equal(
    verdict((c) => {
      plain(c);
      delete c.reactions[TELLS].on.npc;
    }),
    'loaded',
  );
});

// Breaks: a consequence op's kernel_api floor dropped from FLOORS, so a cartridge below it loads
// and an older host faults at runtime (twin of content_rumour_test.exs). Called directly: any
// sampler below these floors trips other features' floors first. quest.activate's 1.8 has no
// row: its only legal trigger, quest_resolved, carries the same 1.8 floor.
test('each consequence op is refused just below its kernel_api floor', () => {
  const refused = (op: string, at_least: string) =>
    reactions(
      {
        manifest: { requires: { kernel_api: { at_least } } },
        reactions: { r: { on: { event: 'fact_changed' }, apply: [{ op }] } },
      },
      { named() {}, typedValue() {} } as unknown as Checks,
    ).some((d) => d.code === 'KERNEL_API_RANGE_INVALID');
  for (const [op, floor] of [
    ['quest.resolve', 12],
    ['quest.fail', 12],
    ['population.suppress', 35],
  ] as const)
    assert.deepEqual([refused(op, `1.${floor - 1}`), refused(op, `1.${floor}`)], [true, false], op);
});
