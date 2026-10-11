// Status readers 4 and 5 on the compiled ward sampler: the shrine (north of the hall) applies
// `warded` (physical 50) and `hushed` (blocks say, shout, whisper, cast; 120 s) to whoever enters;
// in the den (east) a troll (8 HP, physical 50 of its own, a sure physical hit for 2) is soaked
// (physical -100) by a spoken "drench". The player always hits for 2, physical.
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
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { permits } from '../src/mechanics/status/shared.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { resolved } from '../src/commands/actions.ts';
import { check } from '../src/runtime/invariants.ts';
import { ALWAYS } from '../src/mechanics/policy.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-ward-sampler-'));
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
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const S = (key: string) => `ward_sampler@0.0.1:status/${key}`;

let n = 0;
const id = () => `eeeeeeee-5454-4545-8545-${String(++n).padStart(12, '0')}` as never;
const send = (w: World, payload: object) =>
  step(
    w,
    {
      id: id(),
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
function play(w: World, payload: object) {
  const r = send(w, payload);
  assert.equal(code(r), 'accepted', JSON.stringify(r.decision));
  return r.world;
}
function round(w: World, by = 150) {
  const run_id = `aaaaaaaa-5454-4545-8545-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + by];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  const r = stepElapsed(w, { ...command, world_context_id: w.context } as never, n);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const hp = (w: World, e: string) => level(w, e as never, resourceRef(w, 'hp'));
const troll = (w: World) => w.entityIds[refString({ ...C, kind: 'npc', key: 'troll' } as never)]!;
const C = { cartridge_id: 'ward_sampler', cartridge_version: '0.0.1' };

/** A new game on `c`, in the shrine (warded and hushed). */
function shrine(c = content) {
  n = 0;
  const w = newWorld(c, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e54' as never, [1, 2, 3, 4]);
  return play(w, { type: 'move', direction: 'north' });
}
/** `c` with status `key`'s reader fields replaced by `fields`. */
const as = (key: string, fields: object, c = content): Cartridge => {
  const { blocks: _, allows: __, resistances: ___, ...rest } = c.statuses![S(key)]!;
  return { ...c, statuses: { ...c.statuses, [S(key)]: { ...rest, ...fields } } } as Cartridge;
};
/** One round of the player attacking the troll in the den, after `before` there: [player, troll] HP. */
function fight(w: World, before = (v: World) => v) {
  const den = before(play(w, { type: 'move', direction: 'east' }));
  const after = round(play(den, { type: 'attack', target_id: troll(den) }));
  return [hp(after, after.body), hp(after, troll(after))];
}
const fresh = () => {
  n = 0;
  return newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e54' as never, [1, 2, 3, 4]);
};
const south = (w: World) => play(w, { type: 'move', direction: 'south' });

// Breaks: dealt() reads no status for the player (warded hits for 2), or drops a status's entry from
// the troll's sum (drench changes nothing), or takes the larger entry instead of the sum
// (max(50, -100) = 50: the troll takes 1, not 3).
test('status resistances join the G2 sum, for the player and for an NPC', () => {
  assert.deepEqual(fight(fresh()), [8, 7], 'troll hits 2; its own 50% halves the 2 to 1');
  assert.deepEqual(fight(south(shrine())), [9, 7], 'warded 50% halves the troll hit to 1');
  const drench = (v: World) => play(v, { type: 'say', word: 'drench' });
  assert.deepEqual(fight(fresh(), drench), [8, 5], '50 - 100 = -50: the player hits for 3');
});

// Breaks: the action set is not filtered (a hushed say is accepted), a block is refused with
// unsupported_capability rather than invalid_state, the view still lists the blocked verbs, or the
// block outlives its status.
test('hushed: speech is refused invalid_state and unlisted, until the status ends', () => {
  const w = shrine();
  for (const payload of [
    { type: 'say', word: 'hello' },
    { type: 'shout', word: 'hello' },
  ])
    assert.equal(code(send(w, payload)), 'invalid_state', payload.type);
  const listed = gameView(w).actions.map((a) => a.action_key);
  assert.ok(listed.includes('look' as never) && !listed.includes('say' as never), String(listed));
  assert.equal(code(send(round(w, 120), { type: 'say', word: 'hello' })), 'accepted');
});

// Breaks: allows is ignored, two allows lists are united instead of intersected, a block on move
// leaves the exit shown available, or a blocked status traps a modal answer (choose, continue).
test('allows lists intersect; a blocked move shows the exit unavailable with the same code', () => {
  const berserk = shrine(as('hushed', { allows: ['move', 'look'] }));
  assert.equal(code(send(berserk, { type: 'scan' })), 'invalid_state');
  assert.equal(code(send(berserk, { type: 'move', direction: 'south' })), 'accepted');
  const both = shrine(
    as('warded', { allows: ['look'] }, as('hushed', { allows: ['move', 'look'] })),
  );
  assert.equal(code(send(both, { type: 'move', direction: 'south' })), 'invalid_state');
  assert.equal(code(send(both, { type: 'look' })), 'accepted');
  assert.deepEqual(['choose', 'close_choice', 'continue', 'say'].map(permits(both, both.body)), [
    true,
    true,
    true,
    false,
  ]);
  const rooted = shrine(as('hushed', { blocks: ['move'] }));
  assert.deepEqual(
    gameView(rooted).exits.map((e) => [e.direction, e.available, e.reason?.code]),
    [['south', false, 'invalid_state']],
  );
  assert.equal(code(send(rooted, { type: 'move', direction: 'south' })), 'invalid_state');
});

// Breaks: an authored alias of a blocked command (chant -> say) stays offered or invocable while
// hushed, so the view and admission disagree; or the alias is withheld when nothing blocks it.
test('an alias of a blocked command is withheld from view and invocation alike', () => {
  const chant = {
    key: 'chant',
    label: 'action.chant',
    target: { kind: 'none' },
    input: ['word'],
    priority: 0,
    policy: ALWAYS,
    command: 'say',
  };
  const c = { ...content, actions: { ...content.actions, chant } } as unknown as Cartridge;
  const invoke = (w: World) => {
    const i = identify('ward-test', w.character, {
      invocation_id: 'bbbbbbbb-0000-4000-8000-000000000054',
      actor_id: w.character,
      action_key: 'chant',
      target_ids: [],
      input: { word: 'hello' },
    });
    assert.equal(i.kind, 'identified');
    return resolve(w, i as never);
  };
  const hushed = shrine(c);
  const offered = (w: World) => gameView(w).actions.some((a) => a.action_key === 'chant');
  assert.equal(offered(hushed), false);
  assert.deepEqual(invoke(hushed), { kind: 'rejected', error: { code: 'unsupported_capability' } });
  const command = { payload: { type: 'say', actor_id: hushed.character, word: 'hello' } };
  const resolves = Object.fromEntries(
    Object.values(resolved(hushed, hushed.character)).map((a) => [a.key, a.command]),
  );
  const decision = send(hushed, command.payload).decision;
  const observation = { view: gameView(hushed), command, decision, resolves };
  assert.ok(check('gameview_agrees_with_admission', observation));
  const free = round(hushed, 120);
  assert.equal(offered(free), true);
  assert.ok('payload' in invoke(free));
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

// Breaks (twin of test/loka/content_status_readers_test.exs): one reader field (each alone) loads
// under API 1.53, a blocks or allows entry naming no command (or the authority-internal elapsed)
// loads, or a reader status without per_tick (the sampler's three) is refused.
test('loader: reader fields need API 1.54 and name player commands', () => {
  assert.equal(
    reload(() => {}),
    'loaded',
  );
  const keys = ['warded', 'hushed', 'soaked'];
  for (const [key, field, value] of [
    ['warded', 'resistances', { fire: 10 }],
    ['hushed', 'blocks', ['say']],
    ['hushed', 'allows', ['look']],
  ] as const)
    assert.deepEqual(
      reload((c) => {
        c.manifest.requires.kernel_api.at_least = '1.53';
        for (const k of keys) {
          const { blocks: _, allows: __, resistances: ___, ...plain } = c.statuses[S(k)];
          c.statuses[S(k)] = { ...plain, per_tick: -1 };
        }
        c.statuses[S(key)][field] = value;
      }),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
      field,
    );
  for (const [field, name] of [
    ['blocks', 'fly'],
    ['allows', 'elapsed'],
  ])
    assert.deepEqual(
      reload((c) => (c.statuses[S('hushed')][field] = ['say', name])),
      ['UNKNOWN_COMMAND', `.cartridge.statuses["${S('hushed')}"].${field}[1]`],
    );
});
