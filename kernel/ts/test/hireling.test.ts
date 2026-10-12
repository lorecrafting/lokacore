// Toolbox row 22a on the compiled hireling sampler: Hal is hired by dialogue (the hired pair fact,
// a group member) and takes the orders stay, follow, attack, hold and guard (the staying and
// fighting pair facts). He strikes for a sure 1, as does the player, against a 2 HP goblin that
// never hits. Expected values are hand-counted.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { value } from '../src/mechanics/fact.ts';
import { pending, talking } from '../src/mechanics/dialogue/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-hireling-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/hireling_sampler', file], {
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
const S = 'hireling_sampler@0.0.1:';
const fact = (key: string) =>
  ({ cartridge_id: 'hireling_sampler', cartridge_version: '0.0.1', kind: 'fact', key }) as never;

let n = 0;
const play = (w: World, p: object) =>
  step(
    w,
    {
      id: `cccccccc-5555-4333-8444-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p },
    } as never,
    n,
  );
const ok = (r: ReturnType<typeof step>) => {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const act = (w: World, p: object) => ok(play(w, p));
const npc = (w: World, k: string) => w.entityIds[`${S}npc/${k}`] as EntityId;
const room = (w: World, k: string) => w.roomIds[`${S}room/${k}`];
const where = (w: World, ...ks: string[]) => ks.map((k) => w.state.containers[npc(w, k)]);
// Pick `choice` with `who`, then leave the conversation.
const chat = (w: World, who: string, choice: string) => {
  const open = talking(w, w.character, npc(w, who));
  const talked = open ? w : act(w, { type: 'talk', target_id: npc(w, who) });
  const [continuation_id] = pending(talked, talked.character)!;
  const chosen = act(talked, { type: 'choose', choice_id: choice, continuation_id });
  const left = pending(chosen, chosen.character);
  return left ? act(chosen, { type: 'close_choice', continuation_id: left[0] }) : chosen;
};
const fresh = () => {
  n = 0;
  return newWorld(content, '5d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
};
const round = (w: World) => {
  const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + 150];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return stepElapsed(w, { ...command, world_context_id: w.context } as never, n);
};
const hp = (w: World, e: EntityId) => level(w, e, resourceRef(w, 'hp'));
const offered = (w: World) =>
  gameView(w).entities.flatMap((e) =>
    e.actions.some((x) => x.action_key === 'attack') ? [e.id] : [],
  );

const said = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'accepted' ? (r.decision.narration ?? []).map((x) => x.key as string) : [];

// Breaks: travel ignores the stay fact (Hal walks off after "stay") or the follow order does not
// clear it.
test('a hired Hal follows; stay keeps him in the yard; follow brings him along again', () => {
  let w = act(chat(fresh(), 'hal', 'hire'), { type: 'move', direction: 'north' });
  const [yard, road] = [room(w, 'yard'), room(w, 'road')];
  assert.deepEqual(where(w, 'hal'), [road], 'hired: follows north');
  w = act(chat(chat(fresh(), 'hal', 'hire'), 'hal', 'stay'), { type: 'move', direction: 'north' });
  assert.deepEqual(where(w, 'hal'), [yard], 'told to stay');
  w = act(chat(act(w, { type: 'move', direction: 'south' }), 'hal', 'follow'), {
    type: 'move',
    direction: 'north',
  });
  assert.deepEqual(where(w, 'hal'), [road], 'told to follow');
});

// Breaks: allyOf ignores the fight fact (Hal strikes while holding) or the attack order never
// lets him strike.
test('a hired Hal fights only on the attack order', () => {
  let w = chat(fresh(), 'hal', 'hire');
  const goblin = npc(w, 'goblin');
  let r = round(act(w, { type: 'attack', target_id: goblin }));
  assert.equal(hp(ok(r), goblin), 1, 'the player alone: 2 - 1');
  assert.ok(!said(r).includes('combat.ally_hit'), String(said(r)));

  w = chat(chat(fresh(), 'hal', 'hire'), 'hal', 'attack');
  r = round(act(w, { type: 'attack', target_id: goblin }));
  w = ok(r);
  assert.equal(hp(w, goblin), 0, "the player's 1 and Hal's 1");
  assert.ok(said(r).includes('combat.ally_hit'), String(said(r)));
  assert.equal(value(w, w.character, fact('goblin_slain')), true);
});

// Breaks: guard sets only one of the two facts (Hal walks north, or does not strike).
test('a guarding Hal holds the yard and fights there', () => {
  let w = act(chat(chat(fresh(), 'hal', 'hire'), 'hal', 'guard'), {
    type: 'move',
    direction: 'north',
  });
  const yard = room(w, 'yard');
  assert.deepEqual(where(w, 'hal'), [yard], 'stays while the player is on the road');
  w = act(w, { type: 'move', direction: 'south' });
  assert.deepEqual(where(w, 'hal'), [yard]);
  const goblin = npc(w, 'goblin');
  w = ok(round(act(w, { type: 'attack', target_id: goblin })));
  assert.equal(hp(w, goblin), 0, "the player's 1 and Hal's 1");
});

// Breaks: Attack admission or the GameView reads the fight fact instead of membership, so a
// holding hireling becomes a target.
test('a holding hireling is still no Attack target', () => {
  const w = chat(chat(fresh(), 'hal', 'hire'), 'hal', 'hold');
  const refused = play(w, { type: 'attack', target_id: npc(w, 'hal') }).decision;
  assert.equal(refused.kind === 'rejected' && refused.error.code, 'invalid_target');
  assert.deepEqual(offered(w), [npc(w, 'goblin')]);
});

// Breaks (twin of test/loka/content_group_test.exs): the loader admits stay or fight under API
// 1.72, an unknown stay fact or a fight fact that is not a pair fact.
test('the loader keeps stay and fight to API 1.73 and bool pair facts', () => {
  const reload = (edit: (c: any) => void) => {
    const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
    edit(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  const api = ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'];
  const cases: [(c: any) => void, unknown][] = [
    [() => {}, 'loaded'],
    [
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.72';
        delete c.world.group.fight;
      },
      api,
    ],
    [
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.72';
        delete c.world.group.stay;
      },
      api,
    ],
    [
      (c) => (c.world.group.stay.key = 'nobody'),
      ['UNRESOLVED_REFERENCE', '.cartridge.world.group.stay'],
    ],
    [
      (c) => (c.world.group.fight.key = 'goblin_slain'),
      ['SCHEMA_VIOLATION', '.cartridge.world.group.fight'],
    ],
  ];
  for (const [edit, expected] of cases) assert.deepEqual(reload(edit), expected);
});
