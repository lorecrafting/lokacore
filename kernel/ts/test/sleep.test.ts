// Toolbox row W9 on the compiled sleep sampler: a sleeper may only change position, look, wait or
// answer a modal; a Sleep beside a hostile hound provokes it; its hit doubles and wakes; after the
// hound's death a Rest in the fen dreams of hounds once. The player has 10 HP and strikes for a
// sure 1; the hound has 2 HP and bites for a sure 1; sleep_multiplier 2. Values are hand-counted.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { value } from '../src/mechanics/fact.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { positionOf } from '../src/mechanics/position/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-sleep-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/sleep_sampler', file], {
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
const S = 'sleep_sampler@0.0.1:';
const fact = (key: string) =>
  ({ cartridge_id: 'sleep_sampler', cartridge_version: '0.0.1', kind: 'fact', key }) as never;

let n = 0;
const play = (w: World, p: object) =>
  step(
    w,
    {
      id: `cccccccc-7777-4333-8444-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p },
    } as never,
    n,
  );
const ok = (r: { decision: { kind: string }; world: World }) => {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const act = (w: World, p: object) => ok(play(w, p));
const said = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'accepted' ? (r.decision.narration ?? []).map((x) => x.key as string) : [];
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' && r.decision.error.code;
const hound = (w: World) => w.entityIds[`${S}npc/hound`] as EntityId;
const stone = (w: World) => w.entityIds[`${S}item/stone`] as EntityId;
const hp = (w: World, e: EntityId) => level(w, e, resourceRef(w, 'hp'));
const fresh = () => {
  n = 0;
  return newWorld(content, '6e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f20' as never, [1, 2, 3, 4]);
};
const round = (w: World) => {
  const run_id = `aaaaaaaa-1111-4000-8000-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + 150];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return stepElapsed(w, { ...command, world_context_id: w.context } as never, n);
};
// The verbs the page offers the player, on itself and on the stone.
const verbs = (w: World) => {
  const v = gameView(w);
  return [...v.actions, ...v.entities.flatMap((e) => e.actions)].map((a) => a.action_key).sort();
};
// Attack the hound and fight it to death awake: the fen without a living hound.
const won = () => {
  let w = fresh();
  w = act(w, { type: 'attack', target_id: hound(w) });
  for (let i = 0; i < 3 && hp(w, hound(w))! > 0; i++) w = ok(round(w));
  assert.equal(hp(w, hound(w)), 0);
  return w;
};

// Breaks: the Sleep provocation (the PM's provisional answer, loka-kgd.119) is dropped, or Rest
// and Sit provoke too. Reverting that one `engage` call fails exactly this test.
test('a Sleep beside the hostile hound opens the fight with its engage line; Rest and Sit do not', () => {
  const r = play(fresh(), { type: 'sleep' });
  const w = ok(r);
  assert.ok(engaged(w, w.body), 'the encounter is open');
  assert.ok(said(r).includes('npc.hound.engage'), String(said(r)));
  assert.equal(w.state.clock, 0, 'Sleep passes no time');
  for (const type of ['rest', 'sit']) {
    const quiet = act(fresh(), { type });
    assert.equal(engaged(quiet, quiet.body), undefined, type);
  }
});

// Breaks: the sleep multiplier or the wake is lost on the provoked first round.
test("the provoked hound's first bite doubles on the sleeper and wakes it", () => {
  let w = ok(round(act(fresh(), { type: 'sleep' })));
  assert.equal(hp(w, w.body), 8, '10 - 1 x 2');
  assert.equal(positionOf(w, w.character), 'standing');
  w = ok(round(w));
  assert.equal(hp(w, w.body), 7, 'awake: 8 - 1');
  assert.equal(hp(w, hound(w)), 1, 'the player strikes from round 2');
});

// Breaks: the sleeper filter is missing (Take offered and accepted asleep) or drops a position
// verb, or a sleeper's refusal is not invalid_state.
test('a sleeper is offered only the position verbs and Move; Take and Move are invalid_state', () => {
  const asleep = act(won(), { type: 'sleep' });
  assert.equal(engaged(asleep, asleep.body), undefined, 'no living hound: no fight');
  assert.deepEqual(verbs(asleep), ['move', 'rest', 'sit', 'stand']);
  assert.equal(code(play(asleep, { type: 'take', item_id: stone(asleep) })), 'invalid_state');
  assert.equal(code(play(asleep, { type: 'move', direction: 'east' })), 'invalid_state');
  const awake = act(asleep, { type: 'stand' });
  act(awake, { type: 'take', item_id: stone(awake) });
});

// Breaks: the dream reaction is not gated on the kill, or not on dreaming once (a second Rest
// writes the dream again, silently).
test('after the hound dies a Rest in the fen dreams of hounds once', () => {
  const before = play(fresh(), { type: 'rest' });
  assert.ok(!said(before).includes('narration.hound_dream.applied'), 'no kill, no dream');
  const r = play(won(), { type: 'rest' });
  let w = ok(r);
  assert.ok(said(r).includes('narration.hound_dream.applied'), String(said(r)));
  assert.equal(value(w, w.character, fact('dreamt_of_hounds')), true);
  w = act(w, { type: 'stand' });
  const again = play(w, { type: 'rest' });
  const ops = again.decision.kind === 'accepted' ? again.decision.delta.ops : [];
  assert.equal(ops.filter((o) => o.op !== 'resource.adjust').length, 1, 'the position alone');
});
