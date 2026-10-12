// Toolbox row G8 on the compiled group sampler: Ada and Bram join and leave the player's group by
// dialogue (the in_group pair fact), members in the player's room move with the body, and Bram, a
// member who strikes for a sure 1, fights beside the player against a 2 HP goblin that never hits.
// Expected values are hand-counted.
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

const scratch = mkdtempSync(join(tmpdir(), 'loka-group-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/group_sampler', file], {
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
const S = 'group_sampler@0.0.1:';
const fact = (key: string) =>
  ({ cartridge_id: 'group_sampler', cartridge_version: '0.0.1', kind: 'fact', key }) as never;

let n = 0;
const play = (w: World, p: object) =>
  step(
    w,
    {
      id: `cccccccc-4444-4333-8444-${String(++n).padStart(12, '0')}`,
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

// Breaks: travel moves no member (the group walk is dropped) or ignores the fact's value (a
// member who left, or Cole who never joined, still follows).
test('two followers move with the leader; leaving the group stops the follow', () => {
  let w = chat(chat(fresh(), 'ada', 'join'), 'bram', 'join');
  w = act(w, { type: 'move', direction: 'north' });
  const [yard, road] = [room(w, 'yard'), room(w, 'road')];
  assert.deepEqual(where(w, 'ada', 'bram', 'cole'), [road, road, yard]);
  w = act(chat(w, 'ada', 'leave'), { type: 'move', direction: 'south' });
  assert.deepEqual(where(w, 'ada', 'bram', 'cole'), [road, yard, yard]);
});

// Breaks: the walk moves members who are not in the body's room, so the transfer's source is
// wrong and the Move faults.
test('a member elsewhere stays put and the Move is accepted', () => {
  const w = chat(fresh(), 'bram', 'join');
  const apart = {
    ...w,
    state: { ...w.state, containers: { ...w.state.containers, [npc(w, 'bram')]: room(w, 'road') } },
  };
  const r = play(apart, { type: 'move', direction: 'north' });
  const moved = ok(r);
  assert.deepEqual(where(moved, 'bram'), [room(w, 'road')]);
  const ops = r.decision.kind === 'accepted' ? r.decision.delta.ops : [];
  assert.equal(ops.filter((o) => o.op === 'entity.transfer').length, 1, 'the body alone');
});

// Breaks: allyOf ignores members (Bram never strikes) or picks one without an attack, his blow is narrated as a foe's, or
// Attack admission or the GameView ignores members (Bram is attacked or offered).
test('member Bram fights beside the player, credits the kill and is never an Attack target', () => {
  let alone = fresh();
  const [goblin, bram] = [npc(alone, 'goblin'), npc(alone, 'bram')];
  assert.deepEqual(offered(alone).sort(), [bram, goblin].sort(), 'Bram is a target before joining');
  alone = ok(round(act(alone, { type: 'attack', target_id: goblin })));
  assert.equal(hp(alone, goblin), 1, 'the player alone: 2 - 1');

  // Ada, a member without an attack, never takes the ally turn.
  let w = chat(chat(fresh(), 'ada', 'join'), 'bram', 'join');
  assert.deepEqual(offered(w), [goblin], 'no Attack on member Bram');
  const refused = play(w, { type: 'attack', target_id: bram }).decision;
  assert.equal(refused.kind === 'rejected' && refused.error.code, 'invalid_target');
  const r = round(act(w, { type: 'attack', target_id: goblin }));
  w = ok(r);
  assert.equal(hp(w, goblin), 0, "the player's 1 and Bram's 1");
  const said = r.decision.kind === 'accepted' ? r.decision.narration?.map((x) => x.key) : [];
  assert.ok(said?.includes('combat.ally_hit' as never), String(said));
  assert.equal(value(w, w.character, fact('goblin_slain')), true);
});

// Breaks (twin of test/loka/content_group_test.exs): the loader admits world.group under API
// 1.69, an unknown member fact or one that is not a bool pair fact at the player.
test('the loader keeps the group to API 1.70 and a bool pair member fact', () => {
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
  const member = ['SCHEMA_VIOLATION', '.cartridge.world.group.member'];
  const def = (c: any) => c.facts[`${S}fact/in_group`];
  const cases: [(c: any) => void, unknown][] = [
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.69'),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
    ],
    [(c) => (c.world.group.member.key = 'nobody'), ['UNRESOLVED_REFERENCE', member[1]]],
    [(c) => delete def(c).per_subject, member],
    [
      (c) => {
        def(c).value_type = { type: 'int', minimum: 0, maximum: 1, default: 0 };
        delete c.dialogues; // their bool assigns would fail first
      },
      member,
    ],
    [(c) => (def(c).scopes = ['instance']), member],
    [
      (c) => delete c.world.combat.narration.ally_hit,
      ['SCHEMA_VIOLATION', '.cartridge.world.combat.narration.ally_hit'],
    ],
  ];
  for (const [edit, expected] of cases) assert.deepEqual(reload(edit), expected);
});
