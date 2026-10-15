// Toolbox row 16 on the compiled sneak sampler: hiding behind the lane's barrels (rating 0, skill
// stealth, growth [1, 2, 3]) applies `hidden` (pierced_by {stealth, alertness}); the gate's sentry
// (alertness 1) misses a stealth-1 player, the keep's captain (alertness 3) spots one, and the
// encounter it opens cures the concealment (mechanics.md "Sneak and hide").
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import { refString, type Cartridge, type World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { concealed, statusKey } from '../src/mechanics/status/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-sneak-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/sneak_sampler', file], {
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
const C = { cartridge_id: 'sneak_sampler', cartridge_version: '0.0.1' };
const HIDDEN = { ...C, kind: 'status', key: 'hidden' } as never;

let n = 0;
const id = () => `eeeeeeee-1616-4616-8616-${String(++n).padStart(12, '0')}` as never;
function play(w: World, payload: object) {
  const r = step(
    w,
    {
      id: id(),
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return { w: r.world, d: r.decision as Extract<typeof r.decision, { kind: 'accepted' }> };
}
const fresh = (c = content) => {
  n = 0;
  return newWorld(c, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e16' as never, [1, 2, 3, 4]);
};
const east = (w: World) => play(w, { type: 'move', direction: 'east' });
const hide = (w: World) => play(w, { type: 'perform', action: 'hide' });
const row = (w: World, body = w.body) => w.state.statuses?.[statusKey(body, HIDDEN)];
const opened = (d: ReturnType<typeof east>['d']) =>
  d.delta.ops.filter((o) => o.op === 'encounter.open').map((o) => (o as { npc_id: string }).npc_id);
const lines = (d: ReturnType<typeof east>['d']) => (d.narration ?? []).map((t) => t.key as string);
const npc = (w: World, key: string) => w.entityIds[refString({ ...C, kind: 'npc', key } as never)]!;

// Breaks: the sentry not hostile or its engage line lost (the control the hidden cases contrast).
test('an unhidden player entering the gate is engaged by the sentry', () => {
  const { w, d } = east(fresh());
  assert.deepEqual(opened(d), [npc(w, 'sentry')]);
  assert.ok(lines(d).includes('sentry.spots'));
});

// Breaks: the check not passing at rating 0, no use counted, the reaction not applying hidden, a
// wrong duration; then the strict comparison (sentry alertness 1 vs stealth 1 must stay hidden: `>=`
// engages), the pierce clause or the engage cure missing (the captain's alertness 3 must open an
// encounter and end the concealment in writer group 0), or the seer read with the player's value
// (0: the captain never pierces).
test('hidden passes the sentry, the captain sees through it and the encounter ends it', () => {
  const start = fresh();
  const { w: hid, d: hiding } = hide(start);
  assert.equal(hiding.outcome, 'success');
  assert.deepEqual(hiding.events[0]!.position, 1);
  assert.equal(hiding.events[0]!.payload.type, 'check_passed');
  const uses = Object.entries(hid.state.facts ?? {}).find(([k]) => k.includes('"uses_stealth"'));
  assert.equal(uses?.[1], 1);
  assert.deepEqual(row(hid), {
    ...row(hid),
    active: true,
    ends_at: hid.state.clock + 600,
  });
  assert.ok(lines(hiding).includes('narration.hidden.applied'));

  const { w: gate, d: past } = east(hid);
  assert.deepEqual(opened(past), []);
  assert.ok(!lines(past).includes('sentry.spots'));
  assert.equal(row(gate)?.active, true);

  const { w: keep, d: spotted } = east(gate);
  assert.deepEqual(opened(spotted), [npc(keep, 'captain')]);
  assert.ok(lines(spotted).includes('captain.spots'));
  assert.equal(row(keep)?.active, false);
  const cure = spotted.delta.ops.find(
    (o) => o.op === 'status.transition' && JSON.stringify(o).includes('"hidden"'),
  );
  assert.equal(cure?.writer_group, 0);
});

// Breaks: a holder without a character read as stealth level 0, so an alert player (alertness 5)
// would see through a hidden sentry; a hidden NPC is never pierced.
test('a hidden NPC stays concealed from an alert player', () => {
  const alertness = `${C.cartridge_id}@${C.cartridge_version}:attribute/alertness`;
  const c = {
    ...content,
    attributes: {
      ...content.attributes,
      [alertness]: { ...content.attributes![alertness]!, start: 5 },
    },
  } as Cartridge;
  let w = fresh(c);
  const sentry = npc(w, 'sentry');
  const hiddenRow = { [statusKey(sentry, HIDDEN)]: { generation: 1, active: true } };
  w = { ...w, state: { ...w.state, statuses: { ...w.state.statuses, ...hiddenRow } } } as World;
  assert.equal(concealed(w, sentry, w.body), true);
});

/** The sampler's artifact, edited and re-hashed, loaded: its first diagnostic's code and path. */
function reload(edit: (c: any) => void) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
}

// Breaks (twin of the row 16 case in test/loka/content_status_test.exs): pierced_by loading without
// a concealment, naming no skill or attribute, or under API 1.92; an entry reaction applying a
// concealment loading (the engage cure then faults conflicting_write on that move).
test('loader: pierced_by needs a concealment, a real skill and attribute, API 1.93, no entry concealment', () => {
  const S = `${C.cartridge_id}@${C.cartridge_version}:status/hidden`;
  const at = `.cartridge.statuses["${S}"].pierced_by`;
  assert.equal(
    reload(() => {}),
    'loaded',
  );
  assert.deepEqual(
    reload((c) => {
      delete c.statuses[S].concealment;
      c.statuses[S].per_tick = -1;
    }),
    ['SCHEMA_VIOLATION', at],
  );
  assert.deepEqual(
    reload(
      (c) => (c.statuses[S].pierced_by.skill = { ...c.statuses[S].pierced_by.skill, key: 'none' }),
    ),
    ['UNRESOLVED_REFERENCE', `${at}.skill`],
  );
  assert.deepEqual(
    reload(
      (c) =>
        (c.statuses[S].pierced_by.attribute = {
          ...c.statuses[S].pierced_by.attribute,
          key: 'none',
        }),
    ),
    ['UNRESOLVED_REFERENCE', `${at}.attribute`],
  );
  const R = `${C.cartridge_id}@${C.cartridge_version}:reaction/hide`;
  const keep = { ...C, kind: 'room', key: 'keep' };
  assert.deepEqual(
    reload((c) => (c.reactions[R].on = { event: 'entity_entered_room', room: keep })),
    ['OUTCOME_MISMATCH', `.cartridge.reactions["${R}"].apply[0].op`],
  );
  assert.deepEqual(
    reload((c) => (c.manifest.requires.kernel_api.at_least = '1.92')),
    ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
  );
});
