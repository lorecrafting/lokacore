// World-setting, resource-pool and ale-cask witnesses (architecture.md#e1-exact-candidate-proof-policy,
// pm-decision-e1-batch-f-world-witness-2026-10-07.md), plus the fixed v042 carry-limit route.
import assert from 'node:assert/strict';
import { gameView, type World } from '../src/index.ts';
import type { Command, DecisionResult, DefinitionRef, EntityId } from '../src/contracts.gen.ts';
import { encode } from '../src/foundation/canonical.ts';
import { key, same } from '../src/foundation/compose.ts';
import { refString } from '../src/runtime/decision.ts';
import { value } from '../src/mechanics/fact.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { positionOf } from '../src/mechanics/position/shared.ts';
import { load } from '../src/mechanics/containment/shared.ts';
import { bellCue } from '../src/mechanics/bell/cue.ts';
import type { CaseHost } from './e1_case_host.ts';

/** Paths this step witnesses; `credited` is the step's other witnessed paths (services). */
export function worldWitnesses(
  before: World,
  after: World,
  command: Command,
  decision: DecisionResult,
  credited: readonly string[],
): string[] {
  const w = before.cartridge.world ?? {},
    p = command.payload,
    body = before.body,
    me = before.character;
  if (decision.kind !== 'accepted') {
    const item = p.type === 'take' ? before.entities[p.item_id] : undefined;
    const limited =
      w.carry &&
      p.type === 'take' &&
      decision.kind === 'rejected' &&
      decision.error.code === 'too_heavy' &&
      encode(before.state as never) === encode(after.state as never) &&
      load(before, body, { n: 0 }) === w.carry.max_grams &&
      item?.kind === 'item' &&
      (item.mass_grams ?? 0) > 0;
    return limited ? ['/world/carry'] : [];
  }
  const ops = decision.delta.ops,
    events = decision.events,
    paths: string[] = [],
    room = (b: World) => b.state.containers[b.body],
    adjusts = (ref: DefinitionRef) =>
      ops.flatMap((op) =>
        op.op === 'resource.adjust' && op.entity_id === body && same(op.resource, ref) ? [op] : [],
      );
  // Exactly one adjust of `ref` on the body, by `by`, from its before level to its after level.
  const paid = (ref: DefinitionRef, by: number) => {
    const [op, ...more] = adjusts(ref),
      old = level(before, body, ref);
    return (
      !!op &&
      !more.length &&
      op.from === old &&
      op.to === level(after, body, ref) &&
      op.to === old! + by
    );
  };
  if (p.type === 'move' && w.movement && paid(w.movement.cost.resource, -w.movement.cost.amount))
    paths.push('/world/movement');
  const water = w.water;
  if (
    p.type === 'move' &&
    water?.routes.some(
      (r) =>
        before.roomIds[refString(r.surface)] === room(before) &&
        before.roomIds[refString(r.bottom)] === room(after),
    ) &&
    paid(resourceRef(before, 'mv'), -water.entry_cost) &&
    ops.some(
      (op) =>
        op.op === 'water.transition' &&
        op.actor_id === me &&
        op.value?.room_id === room(after) &&
        op.value.deadline === op.value.entered_at! + water.duration &&
        encode(op.value as never) === encode(after.state.water?.[me] as never),
    )
  )
    paths.push('/world/water');
  const died = events.flatMap((e) => (e.payload.type === 'entity_died' ? [e.payload] : []));
  const hp = resourceRef(before, 'hp');
  if (
    w.death &&
    died.some((d) => d.victim_id === body && d.room_id === room(before)) &&
    room(after) === after.roomIds[refString(w.death.shrine)] &&
    adjusts(hp).at(-1)?.to === w.death.restore.hp &&
    level(after, body, hp) === w.death.restore.hp
  )
    paths.push('/world/death');
  const credit = (w.death_credit ?? []).some(
    (c) =>
      died.some(
        (d) =>
          d.victim_id === before.entityIds[refString(c.npc)] &&
          d.room_id === before.roomIds[refString(c.room)] &&
          d.credited_character_id === me,
      ) &&
      value(before, me, c.fact) === false &&
      value(after, me, c.fact) === true &&
      ops.some(
        (op) =>
          op.op === 'fact.assign' &&
          same(op.fact, c.fact) &&
          op.expected === false &&
          op.value === true,
      ),
  );
  if (credit) paths.push('/world/death_credit');
  const interval = w.combat?.interval;
  if (
    events.some(
      (e) =>
        e.payload.type === 'attack_result' &&
        e.payload.attacker_id === body &&
        ops.some((op) => {
          const job = op.op === 'job.complete' ? before.state.jobs?.[op.job_id] : undefined;
          return (
            job?.status === 'pending' &&
            job.due_time === e.logical_time &&
            job.encounter_id === (e.payload as { encounter_id: string }).encounter_id
          );
        }) &&
        ops.some(
          (op) =>
            op.op === 'job.schedule' &&
            op.encounter_id === (e.payload as { encounter_id: string }).encounter_id &&
            op.due_time === e.logical_time + interval!,
        ),
    )
  )
    paths.push('/world/combat');
  const cue = w.bell_cue;
  if (
    cue &&
    value(before, me, cue.fact) === false &&
    value(after, me, cue.fact) === true &&
    events.some((e) => bellCue(after, e, command.id, me, room(after))?.key === cue.text)
  )
    paths.push('/world/bell_cue');
  const advance = ops.find((op) => op.op === 'time.advance');
  let view: ReturnType<typeof gameView> | undefined;
  for (const spec of Object.values(before.cartridge.resources ?? {})) {
    const ref = resourceRef(before, spec.key),
      old = level(before, body, ref)!,
      next = level(after, body, ref)!,
      path = `/resources/${refString(ref)}`;
    if (old === undefined || next === undefined) continue;
    const band = (w.bands ?? []).find(
      (b) => 100 * (next - spec.minimum) === b.at_percent * (spec.maximum - spec.minimum),
    );
    if (!spec.bands && band && old !== next) {
      view ??= gameView(after);
      if (view.resources?.find((r) => same(r.resource, ref))?.band === band.key)
        paths.push('/world/bands');
    }
    if (spec.regen) {
      const [op, ...more] = adjusts(ref),
        row = (b: World) =>
          b.state.resources?.[key({ kind: 'resource', resource: ref, entity_id: body })];
      const rate =
        spec.regen.by_position[positionOf(after, me) as keyof typeof spec.regen.by_position];
      if (
        op &&
        !more.length &&
        op.from === old &&
        op.to === next &&
        op.next_rate === rate &&
        row(after)?.rate === rate &&
        row(before)?.rate !== rate
      )
        paths.push(path);
    } else if (spec.gain > 0 && advance?.op === 'time.advance') {
      const every = spec.gain_every ?? 3600,
        ticks = Math.floor(advance.to / every) - Math.floor(advance.from / every);
      if (
        advance.from === before.state.clock &&
        advance.to === after.state.clock &&
        !adjusts(ref).length &&
        next > old &&
        next === Math.min(old + spec.gain * ticks, spec.maximum)
      )
        paths.push(path);
    }
  }
  for (const path of credited) {
    const service = before.cartridge.services?.[path.replace(/^\/services\//, '')];
    if (!service || !path.startsWith('/services/')) continue;
    const benefit = service.benefit;
    paths.push(`/resources/${refString(service.currency)}`);
    if (benefit.kind === 'meal') paths.push(`/resources/${refString(benefit.stock)}`);
    if (benefit.kind === 'drink') paths.push(`/items/${refString(benefit.vessel)}`);
  }
  return [...new Set(paths)];
}

/** Fresh route to a load of exactly 12000 g (cartridges/ashmere_missing_child/items/*.json masses). */
export function carryLimit(a: CaseHost) {
  const take = (item: string, expected?: string) =>
      a.invoke('take', [a.entity('item', item)], {}, expected),
    carried = () => {
      const world = a.story.world();
      return load(world, world.body, { n: 0 });
    };
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('north', 'west');
  take('leather_boots'); // 600
  a.move('east', 'east', 'up');
  for (const item of ['brass_key', 'wool_cloak', 'storage_chest']) take(item); // 100 + 3000 + 8000
  a.move('down', 'west', 'north', 'west', 'west');
  for (const item of ['apple_01', 'apple_02', 'apple_03']) take(item); // 3 x 100
  assert.equal(carried(), 12000);
  a.move('east', 'east');
  take('fox_drawing', 'too_heavy'); // 20 g over
  assert.equal(carried(), 12000);
  return { load: carried(), refused: 'fox_drawing' };
}
