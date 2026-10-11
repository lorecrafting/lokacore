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
import { permits } from '../src/mechanics/status/permits.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { resolved } from '../src/commands/actions.ts';
import { check } from '../src/runtime/invariants.ts';
import { ALWAYS } from '../src/mechanics/policy.ts';
import { statusKey } from '../src/mechanics/status/shared.ts';
import { sight } from '../src/mechanics/movement/rule.ts';
import { visible } from '../src/mechanics/light/shared.ts';
import { key } from '../src/foundation/compose.ts';
import { fresh as wispWorld, ref as wispRef } from './wisp_fixture.ts';

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
const fresh = (c = content) => {
  n = 0;
  return newWorld(c, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e54' as never, [1, 2, 3, 4]);
};
const south = (w: World) => play(w, { type: 'move', direction: 'south' });

// Breaks: dealt() reads no status for the player (warded hits for 2), or drops a status's entry from
// the troll's sum (drench changes nothing), or takes the larger entry instead of the sum
// (max(50, -100) = 50: the troll takes 1, not 3), or adds status entries outside the one clamp
// (a -100 troll soaked: -200 must clamp to -100, so the 2 doubles to 4, not triples to 6). A shield
// sum past +100 cannot show here: a negative hit on a full-HP body is capped away.
test('status resistances join the G2 sum, for the player and for an NPC', () => {
  assert.deepEqual(fight(fresh()), [8, 7], 'troll hits 2; its own 50% halves the 2 to 1');
  assert.deepEqual(fight(south(shrine())), [9, 7], 'warded 50% halves the troll hit to 1');
  const drench = (v: World) => play(v, { type: 'say', word: 'drench' });
  assert.deepEqual(fight(fresh(), drench), [8, 5], '50 - 100 = -50: the player hits for 3');
  const brittle = (v: World) => {
    const t = v.entities[troll(v)]!;
    return drench({
      ...v,
      entities: { ...v.entities, [troll(v)]: { ...t, resistances: { physical: -100 } } },
    } as World);
  };
  assert.deepEqual(fight(fresh(), brittle), [8, 4], '-100 - 100 clamps to -100: the player hits 4');
});

// Breaks (loka-kgd.98): a combat turn ignores the NPC's statuses (the stunned troll still clubs for
// 2), or the skip outlives the stun's 200 s.
test('a stunned troll skips its blows until the stun ends', () => {
  const den = play(play(fresh(), { type: 'move', direction: 'east' }), {
    type: 'say',
    word: 'thunder',
  });
  const one = round(play(den, { type: 'attack', target_id: troll(den) }));
  assert.deepEqual([hp(one, one.body), hp(one, troll(one))], [10, 7], 'round at 150 s: no blow');
  const two = round(one);
  assert.deepEqual([hp(two, two.body), hp(two, troll(two))], [8, 6], 'round at 300 s: it clubs');
});

// Breaks (loka-kgd.98): the player's round blow skips the attack bar (a player stunned mid-fight
// still hits the troll for 1).
test("a player stunned mid-fight takes no blow; the troll's still lands", () => {
  const status = (key: string) => ({ ...C, kind: 'status', key });
  const dazing = {
    key: 'dazing',
    on: { event: 'status_expired', status: status('hushed') },
    apply: [{ op: 'status.apply', status: status('stunned') }],
  };
  const c = {
    ...content,
    reactions: { ...content.reactions, [`${S('').replace('status/', 'reaction/')}dazing`]: dazing },
  } as unknown as Cartridge;
  // Hushed (120 s) ends before the round at 150 s and stuns the player for 200 s.
  assert.deepEqual(fight(south(shrine(c))), [9, 8], 'warded halves the troll hit to 1');
});

// Breaks: the action set is not filtered (a hushed say is accepted), a block is refused with
// unsupported_capability rather than invalid_state, a blocked type the cartridge never offers (cast:
// no spell) reads invalid_state, the view still lists the blocked verbs, or the block outlives its
// status.
test('hushed: speech is refused invalid_state and unlisted, until the status ends', () => {
  const w = shrine();
  for (const payload of [
    { type: 'say', word: 'hello' },
    { type: 'shout', word: 'hello' },
  ])
    assert.equal(code(send(w, payload)), 'invalid_state', payload.type);
  const caps = { ...content.lock.capabilities, action_recipe: 1 }; // cast locked, no spell offered
  const spellless = shrine({
    ...content,
    lock: { ...content.lock, capabilities: caps },
  } as Cartridge);
  assert.equal(code(send(spellless, { type: 'cast', word: 'lux' })), 'unsupported_capability');
  const listed = gameView(w).actions.map((a) => a.action_key);
  assert.ok(listed.includes('look' as never) && !listed.includes('say' as never), String(listed));
  assert.equal(code(send(round(w, 120), { type: 'say', word: 'hello' })), 'accepted');
});

// Breaks: allows is ignored, two allows lists are united instead of intersected, a block on move
// leaves the exit shown available, or a status traps a modal answer (choose, continue) or wait.
test('allows lists intersect; a blocked move shows the exit unavailable with the same code', () => {
  const berserk = shrine(as('hushed', { allows: ['move', 'look'] }));
  assert.equal(code(send(berserk, { type: 'scan' })), 'invalid_state');
  assert.equal(code(send(berserk, { type: 'move', direction: 'south' })), 'accepted');
  const both = shrine(
    as('warded', { allows: ['look'] }, as('hushed', { allows: ['move', 'look'] })),
  );
  assert.equal(code(send(both, { type: 'move', direction: 'south' })), 'invalid_state');
  assert.equal(code(send(both, { type: 'look' })), 'accepted');
  assert.deepEqual(
    ['choose', 'close_choice', 'continue', 'wait', 'say'].map(permits(both, both.body)),
    [true, true, true, true, false],
  );
  const rooted = shrine(as('hushed', { blocks: ['move'] }));
  assert.deepEqual(
    gameView(rooted).exits.map((e) => [
      e.direction,
      e.available,
      e.available ? undefined : e.reason.code,
    ]),
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

// Status readers 6 and 8, with fields swapped in by `as`: warded and hushed (the shrine) carry the
// player's senses or concealment, soaked (a spoken "drench" in the den) the troll's.
const den = (w: World) => play(w, { type: 'move', direction: 'east' });
const drench = (w: World) => play(w, { type: 'say', word: 'drench' });
const blessed = (c: Cartridge) => den(south(shrine(c)));
/** `c` with the den unlit (a dark_description and no light). */
const unlit = (c = content): Cartridge => {
  const R = `${S('').replace('status/', 'room/')}den`;
  const rooms = { ...c.rooms, [R]: { ...c.rooms[R], dark_description: 'room.den.description' } };
  return { ...c, rooms } as Cartridge;
};
/** Whether the player sees the troll: the view names it exactly when an attack on it is admitted. */
function sees(w: World) {
  const listed = JSON.stringify(gameView(w)).includes(troll(w));
  const attack = code(send(w, { type: 'attack', target_id: troll(w) }));
  assert.equal(listed, attack === 'accepted', `view ${listed}, attack ${attack}`);
  return listed;
}

// Breaks: blind read only in a room with a dark_description (the lit den stays seen), a dark_sight
// status ignored (the unlit den stays dark), or dark sight beating blindness.
test('blind darkens every room; a dark_sight status sees in the dark, unless also blind', () => {
  const blind = { perception: { sight: 'blind' } },
    night = { perception: { sight: 'dark_sight' } };
  assert.deepEqual(
    [
      blessed(content),
      blessed(as('warded', blind)),
      blessed(unlit()),
      blessed(as('warded', night, unlit())),
      blessed(as('hushed', blind, as('warded', night, unlit()))),
    ].map(sees),
    [true, false, false, true, false],
  );
});

// Breaks: blindness read only through dark(), so a discovered NPC (the wisp, by its perception
// fact) or a self-luminous detail (the marsh glow) stays seen by a blind player.
test('a blind player sees neither a discovered NPC nor a glowing detail', () => {
  const w0 = wispWorld();
  const marsh = w0.roomIds['ashmere_missing_child@0.0.23:room/marsh_light']!;
  const wisp = w0.entityIds['ashmere_missing_child@0.0.23:npc/wisp']!;
  const glow = Object.keys(w0.details).find(
    (d) => w0.details[d].key === 'glow' && w0.details[d].room === marsh,
  )!;
  const blind = wispRef('status', 'blind');
  const statuses = { [refString(blind)]: { key: 'blind', perception: { sight: 'blind' } } };
  const at = (blinded: boolean) =>
    ({
      ...w0,
      factDefaults: { ...w0.factDefaults, [key(wispRef('fact', 'fen_wisp_discovered'))]: true },
      cartridge: { ...w0.cartridge, statuses: { ...w0.cartridge.statuses, ...statuses } },
      state: {
        ...w0.state,
        containers: { ...w0.state.containers, [w0.body]: marsh, [wisp]: marsh },
        statuses: blinded ? { [statusKey(w0.body, blind)]: { generation: 1, active: true } } : {},
      },
    }) as World;
  assert.deepEqual(
    [false, true].map((b) => [wisp, glow].map((id) => visible(at(b), w0.character, id))),
    [
      [true, true],
      [false, false],
    ],
  );
});

// Breaks: concealment not read by visible() (the invisible troll is listed and attackable),
// see_invisible ignored, see_invisible also revealing hidden, or scan from the hall still showing
// the invisible troll in the den.
test('an invisible troll is unseen and unlisted by scan unless the player sees invisible', () => {
  const seer = (c: Cartridge) => as('hushed', { perception: { sight: 'see_invisible' } }, c);
  const invisible = as('soaked', { concealment: 'invisible' });
  const hidden = as('soaked', { concealment: 'hidden' });
  const out = drench(den(fresh(invisible)));
  assert.deepEqual(
    [out, drench(blessed(seer(invisible))), drench(blessed(seer(hidden)))].map(sees),
    [false, true, false],
  );
  const scan = (w: World) => sight(w, w.body).find((v) => v.direction === 'east')!.entities;
  const hall = (w: World) => play(w, { type: 'move', direction: 'west' });
  assert.deepEqual(scan(hall(out)), []);
  assert.deepEqual(scan(hall(drench(blessed(seer(invisible))))), [troll(out)]);
});

// Breaks: engage ignores the player's concealment (a hostile troll fights an invisible player), or
// ignores the troll's see_invisible, or treats hidden as yielding to see_invisible.
test('a hostile troll does not engage a concealed player unless it sees invisible', () => {
  const T = `${S('').replace('status/', 'npc/')}troll`;
  const hostile = (c: Cartridge): Cartridge =>
    ({
      ...c,
      npcs: {
        ...c.npcs,
        [T]: { ...c.npcs![T], disposition: { hostile: ALWAYS, engage: 'npc.troll.room' } },
      },
    }) as Cartridge;
  const fights = (c: Cartridge, trollSees = false) => {
    let w = south(shrine(hostile(c)));
    if (trollSees) {
      const row = {
        [statusKey(troll(w), { ...C, kind: 'status', key: 'soaked' } as never)]: {
          generation: 1,
          active: true,
        },
      };
      w = { ...w, state: { ...w.state, statuses: { ...w.state.statuses, ...row } } } as World;
    }
    return Object.keys(den(w).state.encounters ?? {}).length > 0;
  };
  const sees = as('soaked', { perception: { sight: 'see_invisible' } });
  assert.deepEqual(
    [
      fights(content),
      fights(as('warded', { concealment: 'invisible' })),
      fights(as('warded', { concealment: 'invisible' }, sees), true),
      fights(as('warded', { concealment: 'hidden' }, sees), true),
    ],
    [true, false, true, false],
  );
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
// loads, or a reader status without per_tick (the sampler's four) is refused.
test('loader: reader fields need API 1.54 and name player commands', () => {
  assert.equal(
    reload(() => {}),
    'loaded',
  );
  const keys = ['warded', 'hushed', 'soaked', 'stunned'];
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

// Breaks (twin of test/loka/content_status_readers_test.exs): a perception or a concealment (each
// alone) loads under API 1.60, such a status without per_tick is refused, or an empty perception
// loads.
test('loader: perception and concealment need API 1.61 and stand in for per_tick', () => {
  const at = (api: string, fields: object) =>
    reload((c) => {
      c.manifest.requires.kernel_api.at_least = api;
      const { resistances: _, ...plain } = c.statuses[S('warded')];
      c.statuses[S('warded')] = { ...plain, ...fields };
    });
  for (const fields of [{ perception: { hearing: 'deaf' } }, { concealment: 'hidden' }]) {
    assert.deepEqual(at('1.61', fields), 'loaded');
    assert.deepEqual(
      at('1.60', fields),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
      JSON.stringify(fields),
    );
  }
  assert.deepEqual(at('1.61', { perception: {} }), [
    'SCHEMA_VIOLATION',
    `.cartridge.statuses["${S('warded')}"].perception`,
  ]);
});
