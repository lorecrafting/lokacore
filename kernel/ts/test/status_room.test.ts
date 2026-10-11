// Status reader 9 (loka-kgd.94): a room holds a status. On the compiled ward sampler (start in the
// hall; the shrine north, the den east with a troll), the shrine's entry reaction is rewritten to
// apply `gloom` (blind sight, -100 mv every 60 s for 120 s) to the den by name.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import { refString, type Cartridge, type World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { statusKey } from '../src/mechanics/status/shared.ts';
import { dark, visible } from '../src/mechanics/light/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-room-status-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/ward_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const C = { cartridge_id: 'ward_sampler', cartridge_version: '0.0.1' };
const S = (key: string) => `ward_sampler@0.0.1:status/${key}`;
const gloom = { ...C, kind: 'status', key: 'gloom' } as never;
const denRef = { ...C, kind: 'room', key: 'den' };
const shrine = (c: any) => c.reactions['ward_sampler@0.0.1:reaction/blessing'];

/** The sampler's artifact cartridge with the shrine applying gloom to the den (API 1.65). */
function edited(edit: (c: any) => void = () => {}) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  c.manifest.requires.kernel_api.at_least = '1.65';
  const { blocks: _, ...hushed } = c.statuses[S('hushed')];
  c.statuses[S('gloom')] = {
    ...hushed,
    key: 'gloom',
    resource: { ...C, kind: 'resource', key: 'mv' }, // a world pool: a room must not read it as its own
    per_tick: -100,
    perception: { sight: 'blind' },
  };
  delete c.resources['ward_sampler@0.0.1:resource/mv'].regen; // a pool a missing row reads as start
  shrine(c).apply = [{ op: 'status.apply', status: gloom, room: denRef }];
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
const loaded = edited();
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;

let n = 0;
const id = () => `eeeeeeee-9494-4949-8949-${String(++n).padStart(12, '0')}` as never;
function play(w: World, payload: object) {
  const command = {
    id: id(),
    world_context_id: w.context,
    payload: { actor_id: w.character, ...payload },
  };
  const r = step(w, command as never, n);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
function wait(w: World, by: number) {
  const run_id = `aaaaaaaa-9494-4949-8949-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + by];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  const r = stepElapsed(w, { ...command, world_context_id: w.context } as never, n);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const types: string[] = JSON.stringify(r.decision).match(/"type":"[a-z_]+"/g) ?? [];
  return { world: r.world, types, decision: JSON.stringify(r.decision) };
}
const hall = () => {
  n = 0;
  const w = newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e94' as never, [1, 2, 3, 4]);
  return play(play(w, { type: 'move', direction: 'north' }), { type: 'move', direction: 'south' });
};
const den = (w: World) => w.roomIds[refString(denRef as never)]!;
const row = (w: World) =>
  w.state.statuses?.[statusKey(den(w), gloom)] as { active: boolean } | undefined;
const troll = (w: World) => w.entityIds[refString({ ...C, kind: 'npc', key: 'troll' } as never)]!;

// Breaks: the step's `room` is ignored (no row on the den), or a room's tick reads the world pool
// (mv) as the room's own and writes a room resource row (with an hp pool, the fatal tick and death
// sequence on a room), or the room's tick emits no status_ticked, or expiry never comes.
test('a named room takes the status; its tick changes nothing and it expires', () => {
  const w = hall();
  assert.equal(row(w)?.active, true);
  const ticked = wait(w, 60);
  assert.ok(ticked.types.includes('"type":"status_ticked"'), ticked.decision);
  assert.ok(!ticked.types.includes('"type":"entity_died"'), ticked.decision);
  assert.ok(!ticked.decision.includes('"kind":"resource"'), ticked.decision);
  assert.equal(row(ticked.world)?.active, true);
  const expired = wait(ticked.world, 60);
  assert.ok(expired.types.includes('"type":"status_expired"'), expired.decision);
  assert.equal(row(expired.world)?.active, false);
  // The same 120 s in one advance: the crossed successor runs as a sub-step (loka-6ztc).
  const crossed = wait(w, 120);
  assert.ok(crossed.types.includes('"type":"status_ticked"'), crossed.decision);
  assert.ok(crossed.types.includes('"type":"status_expired"'), crossed.decision);
  assert.ok(!crossed.decision.includes('"kind":"resource"'), crossed.decision);
  assert.equal(row(crossed.world)?.active, false);
});

// Breaks: dark()/visible() read only the body's own statuses (the darkened den shows its troll), or
// the room's darkness reaches a body in another room (the hall), or it outlives the expiry.
test('a room holding a blind status is dark, and hides its NPC, only to whoever stands in it', () => {
  const w = hall();
  assert.equal(dark(w, w.character), false, 'the hall holds nothing');
  const inDen = play(w, { type: 'move', direction: 'east' });
  assert.equal(dark(inDen, inDen.character), true);
  assert.equal(visible(inDen, inDen.character, troll(inDen)), false);
  assert.ok(!JSON.stringify(gameView(inDen)).includes(troll(inDen)), 'the view hides the troll');
  const later = play(wait(wait(w, 60).world, 60).world, { type: 'move', direction: 'east' });
  assert.equal(dark(later, later.character), false, 'expired');
  assert.equal(visible(later, later.character, troll(later)), true);
  assert.ok(JSON.stringify(gameView(later)).includes(troll(later)));
});

// Breaks (twin of test/loka/content_status_readers_test.exs): a room step loads under API 1.64, a
// room beside an npc loads, or an unknown room loads.
test('loader: a room step needs API 1.65, stands alone and names a room of the cartridge', () => {
  const code = (r: ReturnType<typeof edited>) =>
    r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  const at = '.cartridge.reactions["ward_sampler@0.0.1:reaction/blessing"].apply[0]';
  assert.deepEqual(code(edited((c) => (c.manifest.requires.kernel_api.at_least = '1.64'))), [
    'KERNEL_API_RANGE_INVALID',
    '.cartridge.manifest.requires.kernel_api.at_least',
  ]);
  const npc = { ...C, kind: 'npc', key: 'troll' };
  assert.deepEqual(code(edited((c) => (shrine(c).apply[0].npc = npc))), [
    'SCHEMA_VIOLATION',
    `${at}.room`,
  ]);
  const nowhere = { ...denRef, key: 'nowhere' };
  assert.deepEqual(code(edited((c) => (shrine(c).apply[0].room = nowhere))), [
    'UNRESOLVED_REFERENCE',
    `${at}.room`,
  ]);
});
