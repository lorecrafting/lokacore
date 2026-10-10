// Toolbox row W8 on the compiled scars sampler: every hit leaves a permanent scar; the wolf's bites
// kill the player, who returns to the hall still scarred, and the healer's salve cures it.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { sequence } from '../src/mechanics/reaction.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { artifact as derived, MIGHT } from './derived_fixture.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-scars-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/scars_sampler', file], {
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
const SCAR = 'scars_sampler@0.0.1:status/scar';

let n = 0;
function accepted(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const play = (w: World, payload: object) =>
  accepted(
    step(
      w,
      {
        id: `eeeeeeee-8888-4888-8888-${String(++n).padStart(12, '0')}`,
        world_context_id: w.context,
        payload: { actor_id: w.character, ...payload },
      } as never,
      n,
    ),
  );
// One combat round (interval 150 s): the player strikes, then the wolf bites.
function round(w: World) {
  const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + 150];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return accepted(stepElapsed(w, { ...command, world_context_id: w.context } as never, n));
}
const hp = (w: World) => level(w, w.body, resourceRef(w, 'hp'));
const conditions = (w: World) => gameView(w).conditions;
const wolfName = (w: World) =>
  gameView(w).entities.find((e) => e.id === w.entityIds['scars_sampler@0.0.1:npc/wolf'])?.name;
// The bite reaction's op count and narration when the player is hit (proposal.ts does not yet deliver it).
const bitten = (w: World) => {
  const rule = Object.values(content.reactions!)[0]!;
  const cause = { payload: { type: 'attack_result', target_id: w.body, hit: true } };
  const d = sequence(
    w,
    w.character,
    rule,
    cause as never,
    1,
    { n: 0 },
    () => 'dddddddd-0000-4000-8000-000000000001',
  );
  return d?.kind === 'accepted' ? [d.delta.ops.length, d.narration] : d;
};
const SCARRED = [{ label: 'condition.scarred', resource: 'hp', tick_every: 60 }];

// Breaks: a permanent status gets an end or an expiry job, refreshes or re-narrates on a later
// hit, is cleared by the same-body return, is not cured by `cures`, is not seen by W6's
// status_active, or opens silently (the applied line keyed on a job).
test('a wolf bite leaves a scar that survives death and return, and the salve cures it', () => {
  let w = newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  assert.deepEqual(bitten(w), [1, [{ key: 'narration.scar.applied' }]]);
  w = play(w, { type: 'move', direction: 'east' });
  w = play(w, { type: 'attack', target_id: w.entityIds['scars_sampler@0.0.1:npc/wolf'] });
  w = round(w);
  assert.equal(hp(w), 6);
  assert.deepEqual(conditions(w), SCARRED);
  assert.equal(wolfName(w), 'npc.wolf.short_scarred');
  assert.deepEqual(bitten(w), [0, undefined]); // scarred already: no write, no line
  const pending = Object.values(w.state.jobs ?? {}).filter((j) => j.status === 'pending');
  assert.ok(!pending.some((j) => j.job.kind === 'status'), 'a permanent status schedules no job');
  w = round(w);
  w = round(w); // the third bite takes hp 2 to 0
  assert.equal(w.state.containers[w.body], w.roomIds['scars_sampler@0.0.1:room/hall']);
  assert.equal(hp(w), 10);
  assert.deepEqual(conditions(w), SCARRED);
  const salve = w.entityIds['scars_sampler@0.0.1:item/salve']!;
  w = play(w, { type: 'take', item_id: salve });
  w = play(w, { type: 'eat', item_id: salve });
  assert.equal(conditions(w), undefined);
  assert.deepEqual(
    Object.values(w.state.statuses ?? {}).filter((r) => !r.active),
    [{ active: false, generation: 1 }],
  );
});

// Breaks: the loader lets a permanent status tick, slip under the 1.48 floor, or modify an
// attribute the derived hp maximum reads (loka-kgd.50).
test('the loader refuses each unsound permanent status', () => {
  const read = (a: Uint8Array) => JSON.parse(new TextDecoder().decode(a)).cartridge;
  const scar = `.cartridge.statuses[${JSON.stringify(SCAR)}]`;
  const rows: [Uint8Array, (c: any) => void, string, string][] = [
    [
      artifact,
      (c) => (c.manifest.requires.kernel_api.at_least = '1.47'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [artifact, (c) => (c.statuses[SCAR].per_tick = -1), 'SCHEMA_VIOLATION', `${scar}.per_tick`],
    [
      derived,
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.48';
        c.statuses[MIGHT].duration = 'permanent';
        c.statuses[MIGHT].modifies[0].attribute.key = 'con';
      },
      'SCHEMA_VIOLATION',
      `.cartridge.statuses[${JSON.stringify(MIGHT)}].modifies[0].attribute`,
    ],
  ];
  for (const [base, change, code, path] of rows) {
    const c = read(base);
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
