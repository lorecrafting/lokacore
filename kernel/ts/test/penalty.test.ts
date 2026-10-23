// Death penalties (toolbox row 47; docs/system/mechanics.md, Death penalties) on penalty_sampler's
// pinned artifact: thresholds [30, 100], rats grant 10, penalty 10% told as `death.penalty`; the
// brute in the yard (south of the hall) kills in one blow; the tail lies in the pit (east).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { resolve } from '../src/commands/invocation.ts';
import { hydrate } from '../src/runtime/created.ts';
import { levelUp, lose } from '../src/mechanics/levelling/shared.ts';

const kat = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/penalty_sampler_hash.json', import.meta.url),
    'utf8',
  ),
);
const P = 'penalty_sampler@0.0.1';
const penalty = (c: any) => c.world.death.penalty;

/** The pinned artifact, edited and re-hashed, loaded. */
function load(edit: (c: any) => void = () => {}) {
  const c = structuredClone(kat.value);
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
const refused = (edit: (c: any) => void) => {
  const r = load(edit);
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
};

let n = 0;
/** A new game in the hall at `experience` (no row at 0) on the artifact edited by `edit`. */
function hall(experience: number, edit?: (c: any) => void) {
  const r = load(edit);
  assert.ok(r.ok, JSON.stringify(r));
  n = 0;
  const w = newWorld(
    r.cartridge as Cartridge,
    '4b3a2c1d-5e6f-4a1b-8c2d-3e4f5a6b7c47' as never,
    [1, 2, 3, 4],
  );
  const row = { experience, allocated: {} };
  return experience ? { ...w, state: { ...w.state, levelling: { [w.character]: row } } } : w;
}
const id = () => `eeeeeeee-4747-4b4b-8b4b-${String(++n).padStart(12, '0')}` as never;
function act(w: World, p: object, action?: string) {
  const command = {
    id: id(),
    world_context_id: w.context,
    payload: { actor_id: w.character, ...p },
  };
  const r = step(w, command as never, n, action as never);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
function wait(w: World, seconds: number) {
  const run_id = `aaaaaaaa-4747-4000-8000-${String(++n).padStart(12, '0')}`;
  const until = w.state.clock + seconds;
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
    } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
/** Walk to the yard, attack the brute and wait out the round: the killing step. */
function die(w: World) {
  w = act(w, { type: 'move', direction: 'south' }).world;
  return wait(act(w, { type: 'attack', target_id: w.entityIds[`${P}:npc/brute`] }).world, 150);
}
type Step = ReturnType<typeof wait>;
const narration = (r: Step) =>
  ((r.decision as { narration?: { key: string }[] }).narration ?? []).map((t) => t.key);
const sets = (r: Step) =>
  (r.decision as any).delta.ops.flatMap((o: any) =>
    o.op === 'levelling.set' ? [[o.expected.experience, o.value.experience]] : [],
  );
const xp = (w: World) => w.state.levelling?.[w.character]?.experience;
const room = (w: World, entity: string) => w.rooms[w.state.containers[entity]!]?.key;

// Breaks: the loss ignores the level floor (27), compares the threshold with < instead of <=,
// writes when nothing is lost, tells the line without a loss, or disturbs the return to the shrine.
test('a loss that would cross the level floor leaves experience at the threshold, untold', () => {
  const r = die(hall(30));
  assert.deepEqual(sets(r), []);
  assert.equal(xp(r.world), 30);
  assert.ok(narration(r).includes('combat.player_died'), narration(r).join());
  assert.ok(!narration(r).includes('death.penalty'));
  assert.equal(room(r.world, r.world.body), 'hall');
});

// Breaks: the floor clamps a partial loss to nothing, or the line is untold when the floor cuts the loss short.
test('a loss cut short by the level floor writes the threshold and is told', () => {
  for (const [at, to] of [
    [32, 30],
    [101, 100],
  ]) {
    const r = die(hall(at));
    assert.deepEqual(sets(r), [[at, to]]);
    assert.ok(narration(r).includes('death.penalty'), narration(r).join());
  }
});

/** The raise_attribute invocation from the GameView, resolved and stepped (levelling.test.ts). */
function raise(w: World, key: string) {
  const offered = gameView(w).actions.find((a) => a.action_key === 'raise_attribute');
  assert.ok(offered, 'raise_attribute offered');
  const attribute = {
    cartridge_id: 'penalty_sampler',
    cartridge_version: '0.0.1',
    kind: 'attribute',
    key,
  };
  const invocation = {
    invocation_id: id(),
    actor_id: w.character,
    action_key: offered.action_key,
    target_ids: [],
    input: { attribute },
  };
  const command = resolve(w, { invocation, command_id: id() } as never);
  assert.ok(!('kind' in command), JSON.stringify(command));
  return act(w, command.payload, offered.action_key);
}
const levelling = (w: World) => {
  const view = gameView(w);
  assert.deepEqual(validate('GameView', view), []);
  return view.levelling;
};

// Breaks: the loss is not written (or /10 instead of /100), the old composer guard refuses a fall
// (precondition_failed), the loss strips an allocated point, the line is missing, repeated or
// told before player_died, a write that keeps experience (the raise) tells the line, or a cold
// reopen loses the lowered row.
test('a death at 50 lowers experience to 45 once, keeps the spent point, and survives a reopen', () => {
  const raised = raise(hall(50), 'str');
  assert.ok(!narration(raised).includes('death.penalty'));
  const r = die(raised.world);
  assert.deepEqual(sets(r), [[50, 45]]);
  assert.deepEqual(r.world.state.levelling?.[r.world.character]?.allocated, {
    [`${P}:attribute/str`]: 1,
  });
  const told = narration(r);
  assert.deepEqual(told.slice(told.indexOf('combat.player_died')), [
    'combat.player_died',
    'death.penalty',
  ]);
  // Breaks (loka-3w3q): the waking line is told before the penalty, or not at all.
  const woke = narration(
    die(
      hall(50, (c) => {
        c.manifest.requires.kernel_api.at_least = '1.117';
        c.text['death.woke'] = 'You wake.';
        c.world.death.narration = { woke: 'death.woke' };
      }),
    ),
  );
  assert.deepEqual(woke.slice(woke.indexOf('combat.player_died')), [
    'combat.player_died',
    'death.penalty',
    'death.woke',
  ]);
  // Breaks (loka-3w3q): the death lines push the receipt past its 64 lines, or are the ones cut.
  const full = die(
    hall(50, (c) => {
      c.manifest.requires.kernel_api.at_least = '1.117';
      c.text['death.woke'] = 'You wake.';
      c.text['death.mourn'] = 'Someone mourns.';
      c.world.death.narration = { woke: 'death.woke' };
      const mourn = { op: 'narrate', text: 'death.mourn' };
      c.reactions[`${P}:reaction/mourn`] = {
        key: 'mourn',
        on: { event: 'entity_died' },
        apply: Array(64).fill(mourn),
      };
    }),
  );
  assert.deepEqual(narration(full).slice(-3), ['death.mourn', 'death.penalty', 'death.woke']);
  assert.equal(narration(full).length, 64);
  assert.deepEqual(validate('DecisionResult', full.decision), []);
  const reopened = hydrate(hall(0), JSON.parse(JSON.stringify(r.world.state)), true);
  assert.ok(reopened);
  assert.deepEqual(levelling(reopened), { level: 2, experience: 45, next: 100, unspent: 0 });
  assert.deepEqual(levelling(die(hall(50)).world), {
    level: 2,
    experience: 45,
    next: 100,
    unspent: 1,
  });
});

// Breaks: a fall in a cartridge with no experience penalty throws or tells an undefined key.
test('a fall with no experience penalty declared tells nothing', () => {
  const w = hall(50, (c) => delete penalty(c).experience);
  assert.deepEqual(levelUp(w, w.character, lose(w, w.character, 10, 0)), []);
});

// Breaks: percent 100 empties the row past the floor, a 0 loss still writes, or a death with no
// row writes one.
test('percent bounds: 100 stops at the floor, 1 of 50 and a row-less death write nothing', () => {
  const at = (percent: number, experience: number) =>
    sets(die(hall(experience, (c) => (penalty(c).experience.percent = percent))));
  assert.deepEqual([at(100, 50), at(1, 50), at(10, 0)], [[[50, 30]], [], []]);
});

// Breaks: a same-step grant reads the pre-death row (70), the loss and grant land as two writes
// (oneWrite skipped), or the line is told although the stored row did not fall.
test('a reaction grant in the death step builds on the loss in one write, untold', () => {
  const r = die(
    hall(50, (c) => {
      c.reactions[`${P}:reaction/died_reward`] = {
        key: 'died_reward',
        on: { event: 'entity_died' },
        apply: [{ op: 'experience.grant', amount: 20 }],
      };
    }),
  );
  assert.deepEqual(sets(r), [[50, 65]]);
  assert.ok(!narration(r).includes('death.penalty'));
  assert.ok(!narration(r).includes('levelling.level_up'));
});

// Breaks: kept items still move to the corpse (or the default no longer does), the corpse is no
// longer made in the death room, or entity_died changes with the setting.
test('items kept: the body keeps the tail in the hall and the corpse in the yard is empty', () => {
  const carried = (edit?: (c: any) => void) => {
    let w = act(hall(0, edit), { type: 'move', direction: 'east' }).world;
    const tail = w.entityIds[`${P}:item/tail`]!;
    w = act(w, { type: 'take', item_id: tail }).world;
    const r = die(act(w, { type: 'move', direction: 'west' }).world);
    const died = (r.decision as any).events.find((e: any) => e.payload.type === 'entity_died');
    const { containers } = r.world.state;
    const corpse = died.payload.corpse_id;
    const inside = Object.keys(containers).filter((e) => containers[e] === corpse);
    const holder =
      containers[tail] === r.world.body ? 'body' : containers[tail] === corpse && 'corpse';
    return {
      holder,
      at: room(r.world, r.world.body),
      corpse: room(r.world, corpse),
      inside: inside.length,
      died: died.payload,
    };
  };
  const kept = carried((c) => (penalty(c).items = 'kept'));
  const corpse = carried();
  assert.deepEqual(kept, {
    holder: 'body',
    at: 'hall',
    corpse: 'yard',
    inside: 0,
    died: corpse.died,
  });
  assert.deepEqual(corpse, {
    holder: 'corpse',
    at: 'hall',
    corpse: 'yard',
    inside: 1,
    died: corpse.died,
  });
  // Breaks: kept also applies to an NPC victim, so the rat's tail never reaches its corpse.
  let w = hall(0, (c) => {
    penalty(c).items = 'kept';
    c.items[`${P}:item/tail`].location = {
      in: 'npc',
      npc: {
        cartridge_id: 'penalty_sampler',
        cartridge_version: '0.0.1',
        kind: 'npc',
        key: 'rat_a',
      },
    };
  });
  w = act(w, { type: 'move', direction: 'east' }).world;
  const r = wait(act(w, { type: 'attack', target_id: w.entityIds[`${P}:npc/rat_a`] }).world, 150);
  const died = (r.decision as any).events.find((e: any) => e.payload.type === 'entity_died');
  assert.equal(r.world.state.containers[w.entityIds[`${P}:item/tail`]!], died.payload.corpse_id);
});

// Breaks: the loader admits a penalty below kernel_api 1.109, an experience loss without
// levelling, an unknown narration key, or a percent or items value outside the schema.
test('the loader refuses each malformed penalty', () => {
  const at = (path: string) => ['SCHEMA_VIOLATION', `.cartridge.world.death.penalty${path}`];
  assert.deepEqual(
    [
      refused((c) => (c.manifest.requires.kernel_api.at_least = '1.108')),
      refused((c) => {
        delete c.world.levelling;
        delete c.reactions[`${P}:reaction/cull_reward`];
      }),
      refused((c) => (penalty(c).experience.narration = 'death.nope')),
      refused((c) => (penalty(c).experience.percent = 0)),
      refused((c) => (penalty(c).experience.percent = 101)),
      refused((c) => (penalty(c).items = 'bag')),
      refused((c) => (penalty(c).items = 'kept')),
    ],
    [
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
      at('.experience'),
      ['UNRESOLVED_REFERENCE', '.cartridge.world.death.penalty.experience.narration'],
      at('.experience.percent'),
      at('.experience.percent'),
      at('.items'),
      'loaded',
    ],
  );
});

// Breaks (loka-3w3q): the loader admits death narration below kernel_api 1.117, or a fall or
// waking line naming no text key.
test('the loader refuses each malformed death narration', () => {
  const lines =
    (narration: object, api = '1.117') =>
    (c: any) => {
      c.manifest.requires.kernel_api.at_least = api;
      c.world.death.narration = narration;
    };
  const path = (f: string) => `.cartridge.world.death.narration.${f}`;
  assert.deepEqual(
    [
      refused(lines({ woke: 'combat.player_died' }, '1.116')),
      refused(lines({ woke: 'death.nope' })),
      refused(lines({ player_died: 'death.nope' })),
      refused(lines({ player_died: 'combat.player_died', woke: 'death.penalty' })),
    ],
    [
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
      ['UNRESOLVED_REFERENCE', path('woke')],
      ['UNRESOLVED_REFERENCE', path('player_died')],
      'loaded',
    ],
  );
});
