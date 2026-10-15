// Built rooms S2 and S3 (mechanics.md Built rooms; save.md Built rooms): build_sampler's carpenter
// takes two timber and raises the hut north of the lane 7200 s after the order, once the plot is
// bought; the room is derived from its identity row on every hydrate, and a forged row refuses the load.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { targetOf, value } from '../src/mechanics/fact.ts';
import { key } from '../src/foundation/compose.ts';
import { built as due, unbuildable } from '../src/mechanics/service/build.ts';
import { LIMITS } from '../src/contracts.gen.ts';
import { encode } from '../src/foundation/canonical.ts';
import { hydrate } from '../src/runtime/created.ts';
import { invariants } from '../src/mechanics/movement/rule.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';

const kat = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/build_sampler_hash.json', import.meta.url),
    'utf8',
  ),
);
function sampler(edit: (c: any) => void = () => {}) {
  const c = structuredClone(kat.value);
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.ok(r.ok, JSON.stringify(r));
  return r.cartridge as Cartridge;
}
const S = 'build_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'build_sampler', cartridge_version: '0.0.1', kind, key }) as never;
const fresh = (content = sampler()) =>
  newWorld(content, '6a1c2e3d-4b5f-4a6e-8c7d-9e0f1a2b3c4d' as never, [1, 2, 3, 4]);

let n = 0;
function send(w: World, payload: object) {
  const id = `eeeeeeee-1091-4091-8091-${String(++n).padStart(12, '0')}`;
  return step(
    w,
    { id, world_context_id: w.context, payload: { actor_id: w.character, ...payload } } as never,
    n,
  );
}
function play(w: World, payload: object) {
  const r = send(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const npc = (w: World, k: string) => w.entityIds[`${S}:npc/${k}`]!;
const use = (provider: string, service: string, quoted_price: number) => (w: World) => ({
  type: 'use_service',
  provider_id: npc(w, provider),
  service: ref('service', service),
  quoted_price,
});
const buy = use('seller', 'buy_plot', 10);
const raise = use('carpenter', 'raise_hut', 5);
const cancel = use('carpenter', 'cancel_hut', 1);
const mend = use('carpenter', 'mend_hut', 3);
const pennies = (w: World) => level(w, w.body, resourceRef(w, 'pennies'));
const take = (w: World, ...ks: string[]) =>
  ks.reduce((x, k) => play(x, { type: 'take', item_id: x.entityIds[`${S}:item/timber_${k}`] }), w);
const elapse = (w: World, until: number) => {
  const run_id = `aaaaaaaa-1091-4091-8091-${String(++n).padStart(12, '0')}`;
  const from = w.state.clock;
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  const r = stepElapsed(w, { ...command, world_context_id: w.context } as never, n);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
// The shipped flow: two timber taken, the hut ordered, and the order's 7200 s elapsed.
const raised = (w: World) => {
  w = play(take(w, 'a', 'b'), raise(w));
  return elapse(w, w.state.clock + 7200);
};
const ordered = (w: World) => value(w, w.character, ref('fact', 'hut_ordered'));
const held = (w: World, holder: string) =>
  Object.values(w.state.containers).filter((c) => c === holder).length;
const built = (w: World) =>
  Object.keys(w.state.created ?? {}).filter((id) => w.state.created![id].origin.kind === 'built');
// The offer's refusal and the press's are the same code (view-to-invocation); the press carries
// only the code, the offer also the reason's text key (none for a failing policy).
function refused(w: World, code: string, key?: string, [use, i] = [raise, 0] as const) {
  const offer = gameView(w).entities.find((e) => e.id === npc(w, 'carpenter'))!.services![i];
  const r = send(w, use(w));
  assert.deepEqual(r.decision, { kind: 'rejected', error: { code } });
  assert.deepEqual((offer.action as { reason?: unknown }).reason, {
    code,
    ...(key && { message: { key } }),
  });
  assert.equal(r.world, w);
}

// Breaks: the build benefit not gated by the plot, no room minted or no site exit written, the
// room's title not the blueprint's, the way back missing, a second build on the same site taken,
// the minted id not deterministic, or the room lost on reopen.
test('buy the plot, raise the hut, walk north into it and back; the room survives reopen', () => {
  n = 0;
  let w = fresh();
  const lane = w.state.containers[w.body];
  refused(w, 'invalid_state'); // owns_plot policy fails (actions.ts refusal: invalid_state)
  w = play(w, buy(w));
  assert.equal(pennies(w), 20);
  w = raised(w);
  assert.equal(pennies(w), 15);
  const [hut] = built(w);
  assert.ok(
    gameView(w).exits.some((e) => e.direction === 'north'),
    'north is offered',
  );
  w = play(w, { type: 'move', direction: 'north' });
  assert.equal(w.state.containers[w.body], hut);
  assert.equal(gameView(w).place.title.key, 'blueprint.hut.title');
  for (const id of ['exits_resolve', 'player_in_one_room']) assert.ok(invariants[id](w), id);
  w = play(w, { type: 'move', direction: 'south' });
  assert.equal(w.state.containers[w.body], lane);
  refused(w, 'invalid_state', 'service.site_taken');

  const reopened = hydrate(fresh(), JSON.parse(JSON.stringify(w.state)), true)!;
  const key = `built_${hut.replaceAll('-', '_')}`;
  assert.deepEqual(JSON.parse(JSON.stringify([reopened.roomIds, reopened.rooms[hut].exits])), [
    {
      [`${S}:room/lane`]: lane,
      [`${S}:room/yard`]: w.roomIds[`${S}:room/yard`],
      [`${S}:room/${key}`]: hut,
    },
    { south: { to: ref('room', 'lane') } },
  ]);
  assert.deepEqual({ ...reopened.rooms[lane].exits }, { north: { to: ref('room', key) } });
  n = 1; // the same command ids as above: the refused raise was command 1
  let again = fresh();
  again = raised(play(again, buy(again)));
  assert.deepEqual(built(again), [hut], 'replay mints the same id');
});

// Breaks: the max_total cap not counted over the built rows (a second site direction is built
// past world.construction.max_total 1), or (Built rooms S3) the blueprint's max_per_owner not
// counted over the owner's rows (max_total 2: the order would get as far as missing_inputs).
test('a second structure past max_total, or past max_per_owner, is refused', () => {
  const wider = (max_total: number, cap?: number) =>
    sampler((c) => {
      c.rooms[`${S}:room/lane`].site.directions.push('east');
      c.services[`${S}:service/raise_hut`].benefit.direction = 'east';
      c.world.construction.max_total = max_total;
      if (!cap) delete c.blueprints[`${S}:blueprint/hut`].max_per_owner;
    });
  n = 0;
  let w = fresh();
  w = raised(play(w, buy(w)));
  refused(hydrate(fresh(wider(1)), w.state, true)!, 'invalid_state', 'service.construction_full');
  refused(
    hydrate(fresh(wider(2, 1)), w.state, true)!,
    'invalid_state',
    'service.construction_full',
  );
});

// Breaks: hydrate admitting a built row whose direction the site does not declare, two rows on
// one site direction (max_total 2), more rows than max_total (a second direction), an owner no
// body has, an id other than its row key, an unknown blueprint, a
// blueprint the site does not list, or an unknown site.
test('a forged built row refuses the load', () => {
  n = 0;
  let w = fresh();
  w = raised(play(w, buy(w)));
  const [hut] = built(w);
  const other = '00000000-0000-4000-8000-0000000000b2';
  const two = sampler((c) => (c.world.construction.max_total = 2));
  const east = sampler((c) => c.rooms[`${S}:room/lane`].site.directions.push('east'));
  const shed = sampler(
    (c) =>
      (c.blueprints[`${S}:blueprint/shed`] = {
        ...c.blueprints[`${S}:blueprint/hut`],
        key: 'shed',
      }),
  );
  const twin = (direction: string) => (s: any) =>
    (s.created[other] = {
      ...s.created[hut],
      id: other,
      origin: { ...s.created[hut].origin, direction },
    });
  for (const [content, mutate] of [
    [sampler(), (s: any) => (s.created[hut].origin.direction = 'east')],
    [two, twin('north')],
    [east, twin('east')],
    [sampler(), (s: any) => (s.created[hut].origin.owner = other)],
    [sampler(), (s: any) => (s.created[hut].id = other)],
    [shed, (s: any) => (s.created[hut].definition.key = 'shed')],
    [sampler(), (s: any) => (s.created[hut].definition.key = 'nowhere')],
    [sampler(), (s: any) => (s.created[hut].origin.site.key = 'nowhere')],
  ] as const) {
    const state = JSON.parse(JSON.stringify(w.state));
    assert.ok(hydrate(fresh(content), state, true), 'the unforged state loads');
    mutate(state);
    assert.equal(hydrate(fresh(content), state, true), undefined, String(mutate));
  }
});

// Breaks: the map leaving a built room out (no position from its site), placing it on the wrong
// axis or sign (north is -y), or linking only one way.
test('the map places the hut one step north of the lane and links both ways', () => {
  const mapped = sampler((c) => {
    c.map_positions = [
      { room: ref('room', 'lane'), x: 2, y: 5, z: 0 },
      { room: ref('room', 'yard'), x: 9, y: 9, z: 0 },
    ];
    c.lock.capabilities.knowledge = 1;
    c.manifest.requires.capabilities.knowledge = 1;
  });
  n = 0;
  let w = fresh(mapped);
  const lane = w.state.containers[w.body];
  w = raised(play(w, buy(w)));
  const [hut] = built(w);
  w = play(play(w, { type: 'move', direction: 'north' }), { type: 'move', direction: 'south' });
  const { rooms, links } = gameView(w).map!;
  assert.deepEqual(
    rooms.map(({ id, x, y, z }) => [id, x, y, z]).sort(),
    [
      [hut, 2, 4, 0],
      [lane, 2, 5, 0],
    ].sort(),
  );
  assert.deepEqual(
    links.map(({ from, to, direction }) => [from, to, direction]).sort(),
    [
      [hut, lane, 'south'],
      [lane, hut, 'north'],
    ].sort(),
  );
});

// Built rooms S3. Breaks: the order taking fewer than two timber or not refusing one, the timber
// not moved to the yard, the hut raised at order time or before 7200 s, the framing variant not
// read while ordered, the order left open after completion, or a reopen between order and
// completion minting a different room id (the job's owner or id lost in the save).
test('two timber and 7200 s raise the hut; a reopen between order and completion mints the same id', () => {
  n = 0;
  let w = play(fresh(), buy(fresh()));
  w = take(w, 'a');
  refused(w, 'not_owned', 'service.missing_inputs');
  w = play(take(w, 'b'), raise(w));
  const yard = w.roomIds[`${S}:room/yard`]!;
  assert.deepEqual([held(w, yard), held(w, w.body), ordered(w), built(w)], [2, 0, true, []]);
  assert.equal(gameView(w).place.description.key, 'room.lane.framing');
  const t0 = w.state.clock;
  const reopened = hydrate(fresh(), JSON.parse(JSON.stringify(w.state)), true)!;
  const mark = n;
  w = elapse(w, t0 + 7199);
  assert.deepEqual(built(w), []);
  w = elapse(w, t0 + 7200);
  assert.deepEqual([held(w, yard), ordered(w), built(w).length], [2, false, 1]);
  assert.equal(gameView(w).place.description.key, 'room.lane.description');
  n = mark;
  const again = elapse(elapse(reopened, t0 + 7199), t0 + 7200);
  assert.deepEqual(built(again), built(w));
});

// Breaks (20b cancel on a build commission): cancel not returning the timber or refunding the
// fee, the order left open, or the cancelled order's job still raising the hut.
test('cancel before due returns the timber, keeps the fee, and raises nothing', () => {
  n = 0;
  let w = play(fresh(), buy(fresh()));
  w = play(take(w, 'a', 'b'), raise(w));
  w = play(w, cancel(w));
  assert.deepEqual([held(w, w.body), pennies(w), ordered(w)], [2, 14, false]);
  w = elapse(w, w.state.clock + 7200);
  assert.deepEqual(built(w), []);
});

// Break: the cancelled order's job raising the hut at its own due time (before the reorder's),
// or neither job raising it.
test('order, cancel, reorder: only the reorder raises the hut, at its own due time', () => {
  n = 0;
  let w = play(fresh(), buy(fresh()));
  w = play(take(w, 'a', 'b'), raise(w));
  const t0 = w.state.clock;
  w = elapse(play(w, cancel(w)), t0 + 3600);
  w = play(w, raise(w));
  w = elapse(w, t0 + 7200);
  assert.deepEqual([built(w), ordered(w)], [[], true]);
  w = elapse(w, t0 + 10800);
  assert.deepEqual([built(w).length, ordered(w)], [1, false]);
});

// Break (design call, PM question): a commission whose site was taken by another order meanwhile
// raising a second room on it, or keeping its timber instead of returning it.
test('a second commission due on a taken site returns its timber instead', () => {
  const both = sampler((c) => {
    const s = `${S}:service/raise_hut`;
    c.facts[`${S}:fact/hut_ordered_2`] = {
      ...c.facts[`${S}:fact/hut_ordered`],
      key: 'hut_ordered_2',
    };
    c.services[`${s}_2`] = structuredClone(c.services[s]);
    Object.assign(c.services[`${s}_2`], { key: 'raise_hut_2' });
    c.services[`${s}_2`].benefit.fact.key = 'hut_ordered_2';
    for (const k of ['', '_2']) c.services[`${s}${k}`].benefit.escrow.quantity = 1;
    c.npcs[`${S}:npc/carpenter`].services.push(ref('service', 'raise_hut_2'));
  });
  n = 0;
  let w = fresh(both);
  w = play(take(play(w, buy(w)), 'a', 'b'), raise(w));
  const t0 = w.state.clock;
  w = elapse(w, t0 + 1);
  w = play(w, use('carpenter', 'raise_hut_2', 5)(w));
  w = elapse(w, t0 + 7200);
  assert.equal(built(w).length, 1);
  assert.equal(held(w, w.body), 0);
  w = elapse(w, t0 + 7201);
  assert.deepEqual([built(w).length, held(w, w.body)], [1, 1]);
  assert.equal(value(w, w.character, ref('fact', 'hut_ordered_2')), false);
});

// Breaks: the owner taken from world.character instead of the job's actor_id (the room, the fact
// closed or the cap counted for the wrong character), max_per_owner counted over every owner's
// rows, a refund to an owner with no body here closing the order with the timber lost, or a
// refund past the query budget closing it with the timber stranded (both must fault instead).
test('a commission raises for its job owner, caps per owner, and an unrefundable one faults', () => {
  n = 0;
  let w = play(take(play(fresh(), buy(fresh())), 'a', 'b'), raise(fresh()));
  const [id, row] = Object.entries(w.state.jobs ?? {}).find(([, r]) => r.job.kind === 'order')!;
  const other = '0000000f-0000-4000-8000-000000000000' as never;
  const fact = ref('fact', 'hut_ordered');
  const own = (x: World) => ({
    ...x,
    state: { ...x.state, facts: { ...x.state.facts, [key(targetOf(x, other, fact))]: true } },
  });
  const mint = () => 'eeeeeeee-0000-4000-8000-00000000000f';
  const ops = due(own(w), id as never, { ...row, actor_id: other }, mint, { n: 0 }) as any[];
  assert.equal(ops[0].identity.origin.owner, other);
  // The created row, its weathering status and job (S4), then the owner's order fact closed.
  assert.deepEqual(
    ops.map((o) => o.op),
    ['entity.create', 'status.transition', 'job.schedule', 'fact.assign'],
  );
  assert.match(JSON.stringify(ops[3]), new RegExp(other));

  w = elapse(w, w.state.clock + 7200);
  const b = { ...w.cartridge.services![`${S}:service/raise_hut`].benefit, direction: 'east' };
  const wide = { ...w.cartridge.world!, construction: { max_total: 2 } };
  const capped = { ...w, cartridge: { ...w.cartridge, world: wide } } as World;
  assert.equal(unbuildable(capped, b as never, other), undefined);
  assert.equal(
    unbuildable(capped, b as never, w.character)?.message.key,
    'service.construction_full',
  );

  // A second order on the taken site: its refund faults for a bodiless owner and past the budget.
  const again = own({ ...w, state: { ...w.state, jobs: { ...w.state.jobs, [id]: row } } });
  assert.equal(
    due(again, id as never, { ...row, actor_id: other }, mint, { n: 0 }),
    'precondition_failed',
  );
  // Through orderReady: elapsing past that order's due time faults and changes nothing.
  const pending = { ...row, actor_id: other, due_time: w.state.clock + 1 };
  const stray = own({ ...w, state: { ...w.state, jobs: { ...w.state.jobs, [id]: pending } } });
  const from = stray.state.clock;
  const run_id = 'aaaaaaaa-1091-4091-8091-0000000000ff';
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until: from + 2 };
  const command = { id: elapsedCommandId(run_id, w.context, from, from + 2), payload };
  const r = stepElapsed(stray, { ...command, world_context_id: w.context } as never, 99);
  assert.deepEqual(r.decision, { kind: 'fault', code: 'precondition_failed' });
  assert.equal(r.world, stray);
  const mine = {
    ...again,
    state: {
      ...again.state,
      facts: { ...again.state.facts, [key(targetOf(w, w.character, fact))]: true },
    },
  };
  const at = LIMITS.query_steps - (b as any).escrow.items.length; // one step per escrow item
  assert.equal(due(mine, id as never, row, mint, { n: at + 1 }), 'budget_exceeded');
  assert.ok(
    (due(mine, id as never, row, mint, { n: at }) as any[]).some((o) => o.op === 'entity.transfer'),
  );
});

// Built rooms S4 (mechanics.md Built rooms, S4). Breaks: weathering not applied at completion,
// ruin not reacted onto the room (or onto the player instead), the ruin variant read against the
// actor's body rather than the room (policy status_active subject room), or ruin changing the
// hut's exits or trapping the player inside.
test('600 s after completion the hut reads in ruin, its exits unchanged, and the player can leave', () => {
  n = 0;
  let w = fresh();
  w = raised(play(w, buy(w)));
  const lane = w.state.containers[w.body];
  w = play(w, { type: 'move', direction: 'north' });
  const [hut] = built(w);
  const exits = gameView(w).exits;
  assert.equal(gameView(w).place.description.key, 'blueprint.hut.description.owned');
  w = elapse(w, w.state.clock + 599);
  assert.equal(gameView(w).place.description.key, 'blueprint.hut.description.owned');
  w = elapse(w, w.state.clock + 1);
  assert.equal(gameView(w).place.description.key, 'blueprint.hut.description.ruin');
  const ruin = Object.entries(w.state.statuses ?? {}).filter(([, r]) => r.active);
  assert.deepEqual(
    ruin.map(([at]) => [JSON.parse(at).body_id, JSON.parse(at).status.key]),
    [[hut, 'ruin']],
  );
  assert.deepEqual(gameView(w).exits, exits);
  w = play(w, { type: 'move', direction: 'south' });
  assert.equal(w.state.containers[w.body], lane);
});

// Built rooms S4 mend (mechanics.md Built rooms, S4). Breaks: a mend admitted on a sound hut, the
// mend not curing ruin, the timber or price not taken, or weathering not applied again from the mend.
test('mend is refused on a sound hut; on a ruin it cures it for 3 pennies and a timber, and weathering restarts', () => {
  n = 0;
  let w = take(raised(play(fresh(), buy(fresh()))), 'c');
  const yard = w.roomIds[`${S}:room/yard`]!;
  refused(w, 'invalid_state', 'service.nothing_to_mend', [mend, 2]);
  w = elapse(w, w.state.clock + 600);
  const [before, held0] = [pennies(w), held(w, yard)];
  w = play(w, mend(w));
  assert.deepEqual([before - pennies(w), held(w, yard) - held0, held(w, w.body)], [3, 1, 0]);
  w = play(w, { type: 'move', direction: 'north' });
  assert.equal(gameView(w).place.description.key, 'blueprint.hut.description.owned');
  w = elapse(w, w.state.clock + 599);
  assert.equal(gameView(w).place.description.key, 'blueprint.hut.description.owned');
  w = elapse(w, w.state.clock + 1);
  assert.equal(gameView(w).place.description.key, 'blueprint.hut.description.ruin');
});
