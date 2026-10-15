// Built rooms S2 (mechanics.md Built rooms; save.md Built rooms): build_sampler's carpenter raises
// the hut north of the lane once the plot is bought; the room is derived from its identity row on
// every hydrate, and a forged row refuses the load.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
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
const pennies = (w: World) => level(w, w.body, resourceRef(w, 'pennies'));
const built = (w: World) =>
  Object.keys(w.state.created ?? {}).filter((id) => w.state.created![id].origin.kind === 'built');
// The offer's refusal and the press's are the same code (view-to-invocation); the press carries
// only the code, the offer also the reason's text key (none for a failing policy).
function refused(w: World, code: string, key?: string) {
  const offer = gameView(w).entities.find((e) => e.id === npc(w, 'carpenter'))!.services![0];
  const r = send(w, raise(w));
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
  w = play(w, raise(w));
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
    { [`${S}:room/lane`]: lane, [`${S}:room/${key}`]: hut },
    { south: { to: ref('room', 'lane') } },
  ]);
  assert.deepEqual({ ...reopened.rooms[lane].exits }, { north: { to: ref('room', key) } });
  n = 1; // the same command ids as above: the refused raise was command 1
  let again = fresh();
  again = play(play(again, buy(again)), raise(again));
  assert.deepEqual(built(again), [hut], 'replay mints the same id');
});

// Break: the max_total cap not counted over the built rows (a second site direction is built
// past world.construction.max_total 1).
test('a second structure past max_total is refused', () => {
  const wider = sampler((c) => {
    c.rooms[`${S}:room/lane`].site.directions.push('east');
    c.services[`${S}:service/raise_hut`].benefit.direction = 'east';
  });
  n = 0;
  let w = fresh();
  w = play(play(w, buy(w)), raise(w));
  const reopened = hydrate(fresh(wider), w.state, true)!;
  refused(reopened, 'invalid_state', 'service.construction_full');
});

// Breaks: hydrate admitting a built row whose direction the site does not declare, two rows on
// one site direction (max_total 2), more rows than max_total (a second direction), an owner no
// body has, an id other than its row key, an unknown blueprint or an unknown site.
test('a forged built row refuses the load', () => {
  n = 0;
  let w = fresh();
  w = play(play(w, buy(w)), raise(w));
  const [hut] = built(w);
  const other = '00000000-0000-4000-8000-0000000000b2';
  const two = sampler((c) => (c.world.construction.max_total = 2));
  const east = sampler((c) => c.rooms[`${S}:room/lane`].site.directions.push('east'));
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
    [sampler(), (s: any) => (s.created[hut].definition.key = 'shed')],
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
    c.map_positions = [{ room: ref('room', 'lane'), x: 2, y: 5, z: 0 }];
    c.lock.capabilities.knowledge = 1;
    c.manifest.requires.capabilities.knowledge = 1;
  });
  n = 0;
  let w = fresh(mapped);
  const lane = w.state.containers[w.body];
  w = play(play(w, buy(w)), raise(w));
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
