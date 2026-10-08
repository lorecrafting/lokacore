// Literals: protocol/fixtures/missing_child_v042_hash.json world, resources, services and liquids.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gameView, type World } from '../src/index.ts';
import type { Command, DecisionResult } from '../src/contracts.gen.ts';
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, type CaseHost } from './e1_case_host.ts';
import { witnessedObligations } from './e1_obligations.ts';
import { carryLimit, worldWitnesses } from './e1_world_witness.ts';
import { watchRounds } from './e1_watch_rounds.ts';
import { maudsCellar } from './e1_maud.ts';
import { lanternServices } from './e1_services.ts';
import { lanternDream } from './e1_optional_quests.ts';
import { REFUSALS } from './e1_refusals.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const loaded = admitCandidate(
  new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
);
const ID = 'ashmere_missing_child@0.0.42';
type Step = { before: World; after: World; command: Command; decision: DecisionResult };
type Accepted = Extract<DecisionResult, { kind: 'accepted' }>;

function record(recipe: (a: CaseHost) => unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-world-'));
  const a = caseHost(loaded, join(dir, 'save.db'));
  const steps: Step[] = [];
  try {
    a.watch((before, after, command, decision) => steps.push({ before, after, command, decision }));
    recipe(a);
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
  return steps;
}
const credits = (s: Step, path: string) =>
  worldWitnesses(s.before, s.after, s.command, s.decision, [], {}).includes(path);
// Each step's carry credit, the steps folded in order through one case's carry state.
const carryCredits = (steps: Step[]) => {
  const state = {};
  return steps.map((s) =>
    worldWitnesses(s.before, s.after, s.command, s.decision, [], state).includes('/world/carry'),
  );
};
// The service witness feeds the pool and cask clauses, as e1_case_host composes them.
const withServices = (s: Step) =>
  worldWitnesses(
    s.before,
    s.after,
    s.command,
    s.decision,
    witnessedObligations(s.before, s.after, s.command, s.decision),
    {},
  );
const witnessing = (steps: Step[], path: string) => steps.filter((s) => credits(s, path));
const mv = (w: World) => level(w, w.body, resourceRef(w, 'mv'));
const hp = (w: World) => level(w, w.body, resourceRef(w, 'hp'));
const ops = (s: Step) => (s.decision as Accepted).delta.ops;
const room = (w: World) => w.state.containers[w.body];
// The same step with the authored world settings replaced on both sides.
const authored = (s: Step, world: object): Step => {
  const swap = (w: World) => ({
    ...w,
    cartridge: { ...w.cartridge, world: { ...w.cartridge.world, ...world } },
  });
  return { ...s, before: swap(s.before), after: swap(s.after) };
};
const withoutOp = (s: Step, op: string): Step => ({
  ...s,
  decision: { ...(s.decision as Accepted), delta: { ops: ops(s).filter((o) => o.op !== op) } },
});
// The same step with each event of `type` rewritten.
const edited = <T extends string>(
  s: Step,
  type: T,
  f: (e: Extract<Accepted['events'][number]['payload'], { type: T }>) => object,
): Step => ({
  ...s,
  decision: {
    ...(s.decision as Accepted),
    events: (s.decision as Accepted).events.map((e) =>
      e.payload.type === type ? { ...e, payload: f(e.payload as never) } : e,
    ),
  } as never,
});
const refused: DecisionResult = { kind: 'rejected', error: { code: 'invalid_state' } } as never;
// Controls (b) before/after swap, (c) receipt op removed, (d) refused decision.
function controls(s: Step, path: string, op: string) {
  assert.equal(credits({ ...s, before: s.after }, path), false, `${path} after/after`);
  assert.equal(credits(withoutOp(s, op), path), false, `${path} without ${op}`);
  assert.equal(credits({ ...s, decision: refused }, path), false, `${path} refused`);
}

// Recorded lazily inside the first test that needs each, so a recipe fault names a test.
let carried: Step[] | undefined, watched: Step[] | undefined, fought: Step[] | undefined;
const carry = () => (carried ??= record(carryLimit));
const rounds = () => (watched ??= record(watchRounds));
const cellar = () => (fought ??= record(maudsCellar));

// Breaks: movement credits a move whose mv debit is not exactly the authored cost 1, or credits
// a water entry (cost 10) as an ordinary move.
test('movement is witnessed by a move debiting exactly cost 1 mv', () => {
  const moves = carry().filter((s) => s.command.payload.type === 'move');
  assert.deepEqual(
    carry().map((s) => credits(s, '/world/movement')),
    carry().map((s) => s.command.payload.type === 'move'),
  );
  for (const s of moves) assert.equal(mv(s.before)! - mv(s.after)!, 1);
  assert.equal(
    credits(
      authored(moves[0]!, {
        movement: { cost: { amount: 2, resource: resourceRef(moves[0]!.before, 'mv') } },
      }),
      '/world/movement',
    ),
    false,
  );
  controls(moves[0]!, '/world/movement', 'resource.adjust');
  const entries = witnessing(rounds(), '/world/water');
  assert.equal(entries.length, 1);
  assert.equal(credits(entries[0]!, '/world/movement'), false);
});

// Breaks: water credits a move without the entry cost 10, not from a route surface into its
// bottom, or without the committed water row ending at entry + 6000.
test('water is witnessed by entering a route bottom for exactly entry cost 10', () => {
  const [s] = witnessing(rounds(), '/world/water');
  assert.equal(mv(s!.before)! - mv(s!.after)!, 10);
  assert.equal(room(s!.after), s!.after.roomIds[`${ID}:room/well_bottom`]);
  const row = s!.after.state.water![s!.after.character]!;
  assert.equal(row.deadline! - row.entered_at!, 6000);
  const water = s!.before.cartridge.world!.water!;
  assert.equal(
    credits(authored(s!, { water: { ...water, entry_cost: 9 } }), '/world/water'),
    false,
  );
  assert.equal(
    credits(authored(s!, { water: { ...water, duration: 6001 } }), '/world/water'),
    false,
  );
  const fromBottom = water.routes.map((r) => ({ ...r, surface: r.bottom }));
  assert.equal(
    credits(authored(s!, { water: { ...water, routes: fromBottom } }), '/world/water'),
    false,
  );
  controls(s!, '/world/water', 'water.transition');
});

// Breaks: death credits a death whose victim is not the player body, or a player death without
// hp 10 restored.
test('death is witnessed by the player respawning at chapel_nave with hp 10 and mv 100', () => {
  const deaths = witnessing(rounds(), '/world/death');
  assert.equal(deaths.length, 1);
  const s = deaths[0]!;
  assert.equal(room(s.after), s.after.roomIds[`${ID}:room/chapel_nave`]);
  assert.deepEqual([hp(s.after), mv(s.after)], [10, 100]);
  const death = s.before.cartridge.world!.death!;
  assert.equal(
    credits(authored(s, { death: { ...death, restore: { hp: 9, mv: 100 } } }), '/world/death'),
    false,
  );
  controls(s, '/world/death', 'resource.adjust');
  const other = edited(s, 'entity_died', (d) => ({ ...d, victim_id: d.corpse_id }));
  assert.equal(credits(other, '/world/death'), false);
});

// Breaks: death_credit credits a kill not credited to the player, or without the named rat's
// fact turning true, or the wrong fact.
test('death_credit is witnessed by each cellar rat death turning its own fact true', () => {
  const kills = witnessing(cellar(), '/world/death_credit');
  const turned = kills.map((s) =>
    ops(s).flatMap((o) =>
      o.op === 'fact.assign' && /^rat_\d_killed$/.test(o.fact.key) ? [o.fact.key] : [],
    ),
  );
  assert.deepEqual(turned.flat().sort(), [
    'rat_1_killed',
    'rat_2_killed',
    'rat_3_killed',
    'rat_4_killed',
    'rat_5_killed',
  ]);
  const credit = kills[0]!.before.cartridge.world!.death_credit!;
  const shifted = credit.map((c, i) => ({ ...c, fact: credit[(i + 1) % credit.length]!.fact }));
  assert.equal(
    credits(authored(kills[0]!, { death_credit: shifted }), '/world/death_credit'),
    false,
  );
  controls(kills[0]!, '/world/death_credit', 'fact.assign');
  const uncredited = edited(kills[0]!, 'entity_died', (d) => ({
    ...d,
    credited_character_id: null,
  }));
  assert.equal(credits(uncredited, '/world/death_credit'), false);
});

// Breaks: combat credits a round the player does not attack in (an edited copy where the rat is
// the only attacker), or schedules the next round at other than +150.
test('combat is witnessed by a player attack round scheduling the next round 150 later', () => {
  const rounds150 = witnessing(cellar(), '/world/combat');
  assert.ok(rounds150.length > 0);
  for (const s of rounds150) {
    const due = ops(s).flatMap((o) =>
      o.op === 'job.schedule' && o.encounter_id ? [o.due_time] : [],
    );
    assert.ok(due.includes(s.after.state.clock + 150), JSON.stringify(due));
  }
  const combat = rounds150[0]!.before.cartridge.world!.combat!;
  assert.equal(
    credits(authored(rounds150[0]!, { combat: { ...combat, interval: 300 } }), '/world/combat'),
    false,
  );
  controls(rounds150[0]!, '/world/combat', 'job.schedule');
  const s = rounds150[0]!;
  const ratOnly = edited(s, 'attack_result', (e) =>
    e.attacker_id === s.before.body ? { ...e, attacker_id: e.target_id } : e,
  );
  assert.equal(credits(ratOnly, '/world/combat'), false);
});

// Breaks: bands credits an unchanged pool, or a label other than the authored band for hp's percent.
test('bands is witnessed by the authored hp band shown after an hp change', () => {
  const band = [
    'dying',
    'almost_dead',
    'leaking_guts',
    'covered_in_blood',
    'bleeding_freely',
    'many_nasty_wounds',
    'several_wounds',
    'some_cuts',
    'few_bruises',
    'slightly_scratched',
    'ready',
  ];
  const shown = witnessing(cellar(), '/world/bands');
  assert.ok(shown.some((s) => hp(s.before) !== hp(s.after)));
  for (const s of shown.filter((x) => hp(x.before) !== hp(x.after)))
    assert.equal(
      gameView(s.after).resources!.find((r) => r.resource.key === 'hp')!.band,
      band[hp(s.after)!],
    );
  const s = shown.find((x) => hp(x.before) !== hp(x.after))!;
  const bands = s.before.cartridge.world!.bands!;
  // The authored table (before) relabelled, while the GameView still shows the old label.
  const relabelled = authored(s, { bands: bands.map((b) => ({ ...b, key: 'ready' })) });
  assert.equal(credits({ ...relabelled, after: s.after }, '/world/bands'), false);
  assert.equal(credits({ ...s, before: s.after }, '/world/bands'), false);
  assert.equal(credits({ ...s, decision: refused }, '/world/bands'), false);
});

// Breaks: hp credits a level change without elapsed recovery, or other than min(old + 5, 10) per hour.
test('hp is witnessed by elapsed recovery of +5 per 3600 s up to 10', () => {
  const path = `/resources/${ID}:resource/hp`;
  const recovered = witnessing(cellar(), path);
  assert.deepEqual(
    recovered.map((s) => [hp(s.before), hp(s.after)]),
    [
      [2, 7],
      [7, 10],
      [8, 10],
      [8, 10],
    ],
  );
  controls(recovered[0]!, path, 'time.advance');
});

// Breaks: mv credits a rate other than the authored resting rate 36, or an unchanged rate.
test('mv is witnessed by rest setting the authored resting rate 36', () => {
  const path = `/resources/${ID}:resource/mv`;
  const [s, ...more] = witnessing(
    record((a) => lanternDream(a, 'wake')),
    path,
  );
  assert.equal(more.length, 0);
  assert.equal(s!.command.payload.type, 'rest');
  const target = key({
    kind: 'resource',
    resource: resourceRef(s!.after, 'mv'),
    entity_id: s!.after.body,
  });
  assert.deepEqual(
    [s!.before.state.resources?.[target]?.rate, s!.after.state.resources?.[target]?.rate],
    [18, 36],
  );
  controls(s!, path, 'resource.adjust');
});

// Breaks: bell_cue credits a step that does not ring the chapel bell in a listed room.
test('bell_cue is witnessed by ringing the bell in the belfry', () => {
  const recipe = REFUSALS.find(([name]) => name === 'refuse-aldric-resolved')![1];
  const rung = witnessing(record(recipe), '/world/bell_cue');
  assert.equal(rung.length, 1);
  assert.equal((rung[0]!.command.payload as { action: string }).action, 'ring_bell');
  assert.equal(room(rung[0]!.after), rung[0]!.after.roomIds[`${ID}:room/belfry`]);
  const cue = rung[0]!.before.cartridge.world!.bell_cue!;
  assert.equal(
    credits(authored(rung[0]!, { bell_cue: { ...cue, rooms: [] } }), '/world/bell_cue'),
    false,
  );
  assert.equal(credits({ ...rung[0]!, before: rung[0]!.after }, '/world/bell_cue'), false);
  assert.equal(credits({ ...rung[0]!, decision: refused }, '/world/bell_cue'), false);
});

// Breaks: carry credits a refusal alone, a 12000 g load reached without an accepted take (a
// forced transfer), a take or refusal load other than exactly 12000, or another refusal code.
test('carry is witnessed by a take landing on 12000 g and a later too_heavy refusal', () => {
  const steps = carry(),
    last = steps.length - 1,
    full = last - 3; // take apple_03, move east, move east, refused take
  const p = steps[full]!.command.payload as { type: string; item_id: string };
  assert.deepEqual(
    [p.type, p.item_id],
    ['take', steps[full]!.before.entityIds[`${ID}:item/apple_03`]],
  );
  assert.deepEqual(steps[last]!.decision, { kind: 'rejected', error: { code: 'too_heavy' } });
  assert.deepEqual(
    carryCredits(steps),
    steps.map((_, i) => i === last),
  );
  const at = (i: number, edit: (s: Step) => Step) =>
    carryCredits(steps.map((s, j) => (j === i ? edit(s) : s)))[last];
  const max = (max_grams: number) => (s: Step) => authored(s, { carry: { max_grams } });
  assert.deepEqual(
    [at(last, max(11999)), at(last, max(12001)), at(full, max(11995))],
    [false, false, false],
  );
  const forced = (s: Step): Step => ({
    ...s,
    command: {
      ...s.command,
      payload: {
        type: 'recover_corpse',
        actor_id: steps[full]!.before.character,
        corpse_id: p.item_id,
      },
    } as never,
  });
  assert.equal(at(full, forced), false);
  assert.deepEqual(carryCredits([steps[last]!]), [false]);
  const other = { kind: 'rejected', error: { code: 'invalid_state' } } as DecisionResult;
  assert.equal(
    at(last, (s) => ({ ...s, decision: other })),
    false,
  );
});

// Breaks: a pool or the cask is credited without its committed service debit, or the cask without
// its liquid.set (ale 4 -> 3); pennies debit differs from the price, meal stock from -1.
test('pennies, lantern_meals and the cask are witnessed by their committed services', () => {
  const [pennies, meals, cask] = [
    'resource/pennies',
    'resource/lantern_meals',
    'item/lantern_ale_cask',
  ].map((p) => `/${p.startsWith('item') ? 'items' : 'resources'}/${ID}:${p}`);
  const services = record(lanternServices).filter(
    (s) => s.command.payload.type === 'use_service' && s.decision.kind === 'accepted',
  );
  const price = { lantern_room: 3, lantern_meal: 2, lantern_ale: 1 };
  for (const s of services) {
    const p = s.command.payload as { service: { key: keyof typeof price } };
    const paths = withServices(s);
    assert.ok(paths.includes(pennies!));
    const debit = ops(s).find(
      (o) =>
        o.op === 'resource.adjust' && o.entity_id === s.before.body && o.resource.key === 'pennies',
    )!;
    assert.equal(debit.op === 'resource.adjust' && debit.from - debit.to, price[p.service.key]);
    assert.equal(paths.includes(meals!), p.service.key === 'lantern_meal');
    assert.equal(paths.includes(cask!), p.service.key === 'lantern_ale');
    if (p.service.key === 'lantern_meal')
      assert.ok(
        ops(s).some(
          (o) =>
            o.op === 'resource.adjust' && o.resource.key === 'lantern_meals' && o.from - o.to === 1,
        ),
      );
    if (p.service.key !== 'lantern_ale') continue;
    const vessel = s.before.entityIds[`${ID}:item/lantern_ale_cask`]!;
    assert.deepEqual(
      [s.before.state.liquids?.[vessel]?.quantity, s.after.state.liquids?.[vessel]?.quantity],
      [4, 3],
    );
    const dry = withoutOp(s, 'liquid.set');
    assert.equal(withServices(dry).includes(cask!), false);
  }
  assert.deepEqual(
    services.map((s) => (s.command.payload as { service: { key: string } }).service.key).sort(),
    ['lantern_ale', 'lantern_meal', 'lantern_room'],
  );
});
