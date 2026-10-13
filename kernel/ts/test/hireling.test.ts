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
import { key } from '../src/foundation/compose.ts';
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

// The compiled sampler with `edit` applied, reloaded.
const edited = (edit: (c: any) => void) => {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
};
const reload = (edit: (c: any) => void) => {
  const r = edited(edit);
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
};
// Row 22b's wage and hire fee raise the floor to 1.75; drop both to test a lower floor.
const unpaid = (c: any) => {
  delete c.world.group.wage;
  delete c.dialogues[`${S}dialogue/hal_talk`].choices.hire.lesson_payment;
};

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
  const api = ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'];
  const cases: [(c: any) => void, unknown][] = [
    [() => {}, 'loaded'],
    [
      (c) => {
        unpaid(c);
        c.manifest.requires.kernel_api.at_least = '1.72';
        delete c.world.group.fight;
      },
      api,
    ],
    [
      (c) => {
        unpaid(c);
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

// Toolbox row 22b: a 3-coin hire fee and a wage of 3 coins every 86400 (player starts at 10,
// Hal at 0).
const coins = (w: World, e: EntityId) => level(w, e, resourceRef(w, 'coins'));
const hired = (w: World, who = 'hal') => value(w, w.character, fact('hired'), npc(w, who));
const elapse = (w: World, until: number) => {
  const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const from = w.state.clock;
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return ok(stepElapsed(w, { ...command, world_context_id: w.context } as never, n));
};
const withRow = (w: World, e: EntityId, res: string, v: number): World => {
  const at = key({ kind: 'resource', entity_id: e, resource: resourceRef(w, res) });
  const resources = { ...w.state.resources, [at]: { ...w.state.resources![at]!, value: v } };
  return { ...w, state: { ...w.state, resources } };
};
const hireRefusal = (w: World, who = 'hal') => {
  const talked = act(w, { type: 'talk', target_id: npc(w, who) });
  const [continuation_id] = pending(talked, talked.character)!;
  const r = play(talked, { type: 'choose', choice_id: 'hire', continuation_id }).decision;
  return r.kind === 'rejected' && r.error.code;
};
const DAY = 86400;

// Breaks: the fee is not paid, a broke player is hired anyway, or a clock-0 world births no
// player coins row (transfer then refuses every hire).
test('hiring Hal costs 3 coins; a player with 2 is refused', () => {
  let w = chat(fresh(), 'hal', 'hire');
  assert.deepEqual([coins(w, w.body), coins(w, npc(w, 'hal')), hired(w)], [7, 3, true]);
  w = withRow(fresh(), fresh().body, 'coins', 2);
  assert.equal(hireRefusal(w), 'insufficient_resource');
  assert.deepEqual([coins(w, w.body), hired(w)], [2, false]);
});

// Breaks: the wage is not paid, an unpaid member keeps member true (Hal follows north), or a
// wage runs once nobody is a member.
test('a daily wage settles each day; unpaid, Hal leaves and stays behind', () => {
  let w = chat(fresh(), 'hal', 'hire');
  const C0 = fresh().state.clock;
  const hal = npc(w, 'hal');
  w = elapse(w, C0 + DAY);
  assert.deepEqual([coins(w, w.body), coins(w, hal)], [4, 6], 'day 1');
  w = elapse(w, C0 + 2 * DAY);
  assert.deepEqual([coins(w, w.body), coins(w, hal)], [1, 9], 'day 2');
  w = elapse(w, C0 + 3 * DAY);
  assert.deepEqual([coins(w, w.body), coins(w, hal), hired(w)], [1, 9, false], 'day 3: unpaid');
  w = act(w, { type: 'move', direction: 'north' });
  assert.deepEqual(where(w, 'hal'), [room(w, 'yard')]);
  w = elapse(w, C0 + 4 * DAY);
  assert.deepEqual([coins(w, w.body), coins(w, hal), hired(w)], [1, 9, false], 'day 4');
  w = act(w, { type: 'move', direction: 'south' });
  assert.equal(hireRefusal(w), 'insufficient_resource', 're-hire with 1 coin');
});

// Breaks: the next wage is scheduled from the old due time's row rather than this run, or a due
// the same advance crosses is skipped or paid twice.
test('one delivery across two dues pays exactly two wages', () => {
  const C0 = fresh().state.clock;
  const w = elapse(chat(fresh(), 'hal', 'hire'), C0 + 2 * DAY);
  assert.deepEqual([coins(w, w.body), coins(w, npc(w, 'hal'))], [1, 9]);
});

// Breaks: a wage is paid with no member, or the job is not rescheduled on the world's grid.
test('never hired: two days pay nothing and the wage job stays pending', () => {
  const C0 = fresh().state.clock;
  const w = elapse(fresh(), C0 + 2 * DAY);
  assert.deepEqual([coins(w, w.body), coins(w, npc(w, 'hal'))], [10, 0]);
  const wage = Object.values(w.state.jobs!).filter(
    (j) => j.job.kind === 'wage' && j.status === 'pending',
  );
  assert.deepEqual(
    wage.map((j) => j.due_time),
    [C0 + 3 * DAY],
  );
});

// Breaks: a dead member is paid or dismissed.
test('a dead hireling is skipped: not paid, still hired', () => {
  let w = chat(fresh(), 'hal', 'hire');
  const C0 = fresh().state.clock;
  w = elapse(withRow(w, npc(w, 'hal'), 'hp', 0), C0 + DAY);
  assert.deepEqual([coins(w, w.body), hired(w)], [7, true]);
});

// Breaks: two transfers from one purse (each writes from the same value), the balance is not
// a running one, a member whose row is full does not end the paid prefix, or an exact purse
// minimum or row maximum is refused. Ivy is a clone of Hal with a higher EntityId.
test('two hirelings: a running balance pays an EntityId-order prefix', () => {
  const r = edited((c) => {
    c.npcs[`${S}npc/ivy`] = { ...c.npcs[`${S}npc/hal`], key: 'ivy' };
    const talk = structuredClone(c.dialogues[`${S}dialogue/hal_talk`]);
    talk.key = 'ivy_talk';
    talk.npc.key = 'ivy';
    talk.roles.hal.npc.key = 'ivy';
    c.dialogues[`${S}dialogue/ivy_talk`] = talk;
  });
  assert.ok(r.ok, JSON.stringify(r));
  n = 0;
  let w = newWorld(r.cartridge as Cartridge, fresh().context, [1, 2, 3, 4]);
  const C0 = w.state.clock;
  const [hal, ivyId] = [npc(w, 'hal'), npc(w, 'ivy')];
  assert.ok(hal < ivyId);
  w = withRow(chat(chat(w, 'hal', 'hire'), 'ivy', 'hire'), w.body, 'coins', 7);
  w = elapse(w, C0 + DAY);
  const state = () => [coins(w, w.body), coins(w, hal), coins(w, ivyId), hired(w), hired(w, 'ivy')];
  assert.deepEqual(state(), [1, 6, 6, true, true], '7 coins pay both');
  // Edges: 6 coins pay both down to the minimum 0; Hal at 97 fills to the maximum 100.
  w = withRow(withRow(w, w.body, 'coins', 6), hal, 'coins', 97);
  w = elapse(w, C0 + 2 * DAY);
  assert.deepEqual(state(), [0, 100, 9, true, true], 'exactly 6 coins; Hal exactly full');
  w = withRow(withRow(w, w.body, 'coins', 4), hal, 'coins', 6);
  w = elapse(w, C0 + 3 * DAY);
  assert.deepEqual(state(), [1, 9, 9, true, false], '4 coins pay Hal only');
  w = withRow(chat(withRow(w, w.body, 'coins', 10), 'ivy', 'hire'), hal, 'coins', 100);
  w = elapse(w, C0 + 4 * DAY);
  assert.deepEqual(state(), [7, 100, 12, false, false], 'a full Hal ends the paid prefix');
});

// Breaks (twin of test/loka/content_group_test.exs): the loader admits an unknown wage resource,
// one that gains or one that regenerates, a wage under API 1.74, or a skill-less hire fee under API 1.74.
test('the loader keeps the wage to API 1.75 and a conserved resource; a skill-less fee to 1.75', () => {
  const api = ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'];
  const at = '.cartridge.world.group.wage.resource';
  const hire = (c: any) => c.dialogues[`${S}dialogue/hal_talk`].choices.hire;
  const by_position = { standing: 1, sitting: 1, resting: 1, sleeping: 1 };
  const regen = { every: 3600, by_position };
  const cases: [(c: any) => void, unknown][] = [
    [(c) => (c.world.group.wage.resource.key = 'gold'), ['UNRESOLVED_REFERENCE', at]],
    [(c) => (c.world.group.wage.resource.key = 'hp'), ['SCHEMA_VIOLATION', at]],
    [(c) => (c.resources[`${S}resource/coins`].gain = 1), ['SCHEMA_VIOLATION', at]],
    [(c) => (c.resources[`${S}resource/coins`].regen = regen), ['SCHEMA_VIOLATION', at]],
    [
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.74';
        delete hire(c).lesson_payment;
      },
      api,
    ],
    [
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.74';
        delete c.world.group.wage;
      },
      api,
    ],
    [
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.74';
        unpaid(c);
      },
      'loaded',
    ],
  ];
  for (const [edit, expected] of cases) assert.deepEqual(reload(edit), expected);
});
