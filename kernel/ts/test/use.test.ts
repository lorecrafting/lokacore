// Toolbox row G4 on the compiled use sampler: two use recipes keyed by properties, never by ids.
// quench: a held liquid_holding tool with water, on a target with an active burning status, cures
// it (status.cure). oil: a held tool with oil, on a target tagged metal, sets its entity fact oiled.
// Nobody authored the bucket-cart or oilcan-winch pair.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { currentStatus } from '../src/mechanics/status/shared.ts';
import { value } from '../src/mechanics/fact.ts';
import { encode } from '../src/foundation/canonical.ts';
import { check } from '../src/runtime/invariants.ts';
import { resolved } from '../src/commands/actions.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-use-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/use_sampler', file], {
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
const C = { cartridge_id: 'use_sampler', cartridge_version: '0.0.1' };
const burning = { ...C, kind: 'status', key: 'burning' } as never;
const oiled = { ...C, kind: 'fact', key: 'oiled' } as never;

let n = 0;
const id = () => `eeeeeeee-4444-4444-8444-${String(++n).padStart(12, '0')}` as never;
const play = (w: World, payload: object) =>
  step(
    w,
    {
      id: id(),
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
function ok(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
const e = (w: World, key: string) => w.entityIds[`use_sampler@0.0.1:item/${key}`]!;

/** In the yard holding the bucket, the oilcan and the torch; with `fire`, the torch dropped. */
function start(fire = true): World {
  n = 0;
  let w = newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e44' as never, [1, 2, 3, 4]);
  for (const k of ['bucket', 'oilcan', 'torch'])
    w = ok(play(w, { type: 'take', item_id: e(w, k) }));
  return fire ? ok(play(w, { type: 'drop', item_id: e(w, 'torch') })) : w;
}
/** The pairs the GameView offers on held `tool`: [action, target_ids, available]. */
const pairs = (w: World, tool: string) =>
  gameView(w)
    .inventory.find((i) => i.id === e(w, tool))!
    .actions.filter((a) => a.action_key === 'quench' || a.action_key === 'oil')
    .map((a) => [a.action_key, a.target_ids, a.available]);
/** The offered invocation as step's Command (commands/invocation.ts resolve). */
function invoke(w: World, action_key: string, target_ids: readonly string[]) {
  const i = identify('use-test', w.character, {
    invocation_id: 'bbbbbbbb-0000-4000-8000-000000000001',
    actor_id: w.character,
    action_key,
    target_ids,
    input: {},
  } as never);
  assert.equal(i.kind, 'identified');
  const command = resolve(w, i as never);
  assert.ok('payload' in command, JSON.stringify(command));
  return step(w, command, ++n);
}

// Breaks: the view pairs the wrong ids or order, the step refuses the offered pair, or the cure
// step writes nothing (the cart keeps burning).
test('water on the burning cart: offered on the bucket, invoked, and the fire is out', () => {
  const w = start();
  assert.ok(currentStatus(w, e(w, 'cart'), burning), 'the dropped torch set the cart burning');
  assert.deepEqual(pairs(w, 'bucket'), [['quench', [e(w, 'cart'), e(w, 'bucket')], true]]);
  const after = ok(invoke(w, 'quench', [e(w, 'cart'), e(w, 'bucket')]));
  assert.equal(currentStatus(after, e(w, 'cart'), burning), undefined);
  assert.deepEqual(pairs(after, 'bucket'), [], 'nothing burns: no offer');
  assert.equal(
    code(
      play(after, {
        type: 'perform',
        action: 'quench',
        target_id: e(w, 'cart'),
        item_id: e(w, 'bucket'),
      }),
    ),
    'invalid_state',
  );
});

// Breaks: the GameView invariant cannot find a use pair on the held tool, so an accepted offered
// pair reads as unlisted.
test('the offered quench agrees with admission (gameview_agrees_with_admission)', () => {
  const w = start();
  const ids = [e(w, 'cart'), e(w, 'bucket')];
  const r = invoke(w, 'quench', ids);
  const command = {
    payload: { type: 'perform', action: 'quench', target_id: ids[0], item_id: ids[1] },
  };
  const resolves = Object.fromEntries(
    Object.values(resolved(w, w.character)).map((a) => [a.key, a.command]),
  );
  const observation = { view: gameView(w), command, decision: r.decision, resolves };
  assert.ok(check('gameview_agrees_with_admission', observation));
});

// Breaks: a second cure of the same status in one sequence proposes a second transition from the
// already-ended row, so the decision faults instead of curing once.
test('curing twice in one sequence ends the status once', () => {
  const twice = structuredClone(content) as Cartridge & { recipes: Record<string, any> };
  const success = twice.recipes['use_sampler@0.0.1:recipe/quench'].outcomes.success;
  success.sequence = [success.sequence[0], success.sequence[0]];
  n = 0;
  let w = newWorld(twice, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e44' as never, [1, 2, 3, 4]);
  for (const k of ['bucket', 'torch']) w = ok(play(w, { type: 'take', item_id: e(w, k) }));
  w = ok(play(w, { type: 'drop', item_id: e(w, 'torch') }));
  const after = ok(invoke(w, 'quench', [e(w, 'cart'), e(w, 'bucket')]));
  assert.equal(currentStatus(after, e(w, 'cart'), burning), undefined);
});

// Breaks: an empty vessel still counts as holding water.
test('an empty bucket quenches nothing', () => {
  const w = start();
  const dry = structuredClone(w) as { state: { liquids: Record<string, object> } };
  dry.state.liquids[e(w, 'bucket')] = { kind: null, quantity: 0 }; // an emptied vessel's row
  const x = dry as unknown as World;
  assert.deepEqual(pairs(x, 'bucket'), []);
  const ids = { target_id: e(w, 'cart'), item_id: e(w, 'bucket') };
  assert.equal(code(play(x, { type: 'perform', action: 'quench', ...ids })), 'invalid_target');
});

// Breaks: a pair blocked by the recipe's cooldown is listed available (or dropped), or its reason
// differs from the rule's rejection.
test('a cooling-down oil pair is listed unavailable with the code the step returns', () => {
  const cooled = structuredClone(content) as Cartridge & { recipes: Record<string, any> };
  cooled.recipes['use_sampler@0.0.1:recipe/oil'].cooldown = 600;
  n = 0;
  let w = newWorld(cooled, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e44' as never, [1, 2, 3, 4]);
  w = ok(play(w, { type: 'take', item_id: e(w, 'oilcan') }));
  const ids = [e(w, 'winch'), e(w, 'oilcan')];
  w = ok(invoke(w, 'oil', ids));
  const shown = gameView(w)
    .inventory.find((i) => i.id === ids[1])!
    .actions.find((a) => a.action_key === 'oil')!;
  assert.deepEqual([shown.available, shown.target_ids], [false, ids]);
  assert.equal(shown.available === false && shown.reason.code, 'cooldown');
  assert.equal(code(invoke(w, 'oil', ids)), 'cooldown');
});

// Breaks: the tool's liquid or tag is not checked, the target's policy reads no target, or the
// fact lands on the actor instead of the target.
test('oil on the metal winch, never on the wooden cart; water never oils', () => {
  const w = start(false);
  assert.deepEqual(pairs(w, 'oilcan'), [['oil', [e(w, 'winch'), e(w, 'oilcan')], true]]);
  const use = (action: string, target: string, tool: string) =>
    play(w, { type: 'perform', action, target_id: e(w, target), item_id: e(w, tool) });
  const after = ok(use('oil', 'winch', 'oilcan'));
  assert.equal(value(after, w.character, oiled, e(w, 'winch')), true);
  assert.equal(value(after, w.character, oiled, e(w, 'cart')), false);
  assert.equal(code(use('oil', 'cart', 'oilcan')), 'invalid_state', 'the cart is not metal');
  assert.equal(code(use('oil', 'winch', 'bucket')), 'invalid_target', 'the bucket holds no oil');
  assert.equal(code(use('quench', 'cart', 'oilcan')), 'invalid_target', 'oil is not water');
});

// Breaks: a tool on the floor, a tool used on itself or a use without its tool is admitted.
test('the tool must be held, distinct from the target and named', () => {
  const w = start();
  const dropped = ok(play(w, { type: 'drop', item_id: e(w, 'bucket') }));
  const quench = (x: World, ids: object) =>
    code(play(x, { type: 'perform', action: 'quench', ...ids }));
  assert.equal(
    quench(dropped, { target_id: e(w, 'cart'), item_id: e(w, 'bucket') }),
    'not_present',
  );
  assert.equal(quench(w, { target_id: e(w, 'bucket'), item_id: e(w, 'bucket') }), 'invalid_target');
  assert.equal(quench(w, { target_id: e(w, 'cart') }), 'invalid_target');
});

// Breaks: the TS loader admits a use recipe below kernel_api 1.49, a status.cure on a detail
// recipe, or an opposed check on a use recipe, which has no detail rating (both kernels refuse
// them; content_use_test.exs).
test('loader: kernel_api 1.49, cures only on use recipes, no rating-opposed check', () => {
  const QUENCH = 'use_sampler@0.0.1:recipe/quench';
  const rows: [(c: Record<string, any>) => void, string, string][] = [
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.48'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c) => {
        // A status.cure on a detail recipe: a detail holds no status.
        const yard = { ...C, kind: 'room', key: 'yard' };
        for (const caps of [c.lock.capabilities, c.manifest.requires.capabilities])
          caps.inspectable_detail = 1;
        c.rooms['use_sampler@0.0.1:room/yard'].details = {
          pump: { aliases: ['pump'], description: 'room.yard.title' },
        };
        c.recipes[QUENCH].target = { kind: 'detail', room: yard, detail: 'pump' };
      },
      'SCHEMA_VIOLATION',
      `.cartridge.recipes[${JSON.stringify(QUENCH)}].outcomes.success.sequence[0].op`,
    ],
    [
      (c) => {
        const str = { ...C, kind: 'attribute', key: 'str' };
        for (const caps of [c.lock.capabilities, c.manifest.requires.capabilities])
          Object.assign(caps, { attributes: 1, check: 1 });
        c.attributes = { 'use_sampler@0.0.1:attribute/str': { key: 'str', start: 8 } };
        c.recipes[QUENCH].check = { key: 'q', kind: 'opposed', attribute: str };
        c.recipes[QUENCH].outcomes.failure = c.recipes[QUENCH].outcomes.success;
      },
      'SCHEMA_VIOLATION',
      `.cartridge.recipes[${JSON.stringify(QUENCH)}].check`,
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
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
