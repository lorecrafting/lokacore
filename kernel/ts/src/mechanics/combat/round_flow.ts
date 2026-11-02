// Pack round orchestration and successor rows; round.ts owns the ordinary occurrence.
import type {
  Command,
  DeltaOp,
  EncounterId,
  EncounterRow,
  EntityId,
  JobId,
  Text,
  TextKey,
} from '../../contracts.gen.ts';
import { accepted, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { add, mul } from '../../foundation/int.ts';
import { encode } from '../../foundation/canonical.ts';
import { level, resourceRef, resourceSpec } from '../resource.ts';
import { describeEntity } from '../description_variant/rule.ts';
import { living } from '../death/shared.ts';
import { standing } from '../position/shared.ts';
import { ally, allyOf, npcRef, participantsPresent } from './shared.ts';
import { afraid, eligible, flight, next, packPlan } from './behavior.ts';
import { attack, playerFirst, prefix } from './round_attack.ts';
import { statusAllows } from '../status/bars.ts';
import type { CombatEvent, Round } from './round.ts';

type PackContext = {
  world: World;
  command: Pick<Command, 'id'>;
  job: JobRow;
  row: EncounterRow;
  encounter_id: EncounterId;
  r: Round;
  close: DeltaOp;
  mint: Mint;
  selected: EntityId;
  current: EncounterRow;
  settings: NonNullable<ReturnType<typeof packPlan>>;
};

export function packRound(
  world: World,
  command: Pick<Command, 'id'>,
  job: JobRow,
  row: EncounterRow,
  encounter_id: EncounterId,
  r: Round,
  close: DeltaOp,
  mint: Mint,
) {
  const present = row.active_ids!.filter((id) => eligible(world, row, id));
  const selected = selectedFrom(present, row.next_opponent_id!);
  const primary = present.includes(row.npc_id) ? row.npc_id : present[0];
  const current = { ...row, npc_id: primary };
  if (!selected) {
    r.ops.push(close);
    const settings = packPlan(world, row.npc_id);
    if (settings) r.notes.push({ key: settings.narration.pack_withdrew });
  } else if (!participantsPresent(world, { ...current, npc_id: selected })) {
    r.ops.push(close);
  } else {
    const settings = packPlan(world, selected)!;
    const ctx: PackContext = {
      world,
      command,
      job,
      row,
      encounter_id,
      r,
      close,
      mint,
      selected,
      current,
      settings,
    };
    resolvePack(ctx);
  }
  return packResult(world, row, job, r);
}

function resolvePack(ctx: PackContext) {
  if (ctx.current.npc_id !== ctx.row.npc_id)
    ctx.r.notes.push({
      key: ctx.settings.narration.primary_changed,
      participants: { enemy: ctx.current.npc_id },
    });
  packTurns(ctx);
  finishPack(ctx);
}

function selectedFrom(present: readonly EntityId[], cursor: EntityId) {
  return present.includes(cursor) ? cursor : present.length ? next(present, cursor) : undefined;
}

function packResult(world: World, row: EncounterRow, job: JobRow, r: Round) {
  const timed = r.ops.map((op) => (op.op === 'resource.adjust' ? { ...op, at: job.due_time } : op));
  return accepted(world, 'job_ran', timed, r.events, told(world, row, r), r.rng);
}

function packTurns({
  world,
  command,
  job,
  row,
  encounter_id,
  r,
  close,
  mint,
  selected,
  current,
  settings,
}: PackContext) {
  const helper = allyOf(world, row);
  const order = playerFirst(world, row, r) ? [row.body_id, selected] : [selected, row.body_id];
  for (const attacker of helper ? [...order, helper] : order) {
    const at = prefix(world, r.ops, r.due_time);
    const target =
      attacker !== selected
        ? eligible(at, row, current.npc_id)
          ? current.npc_id
          : row.active_ids!.find((id) => eligible(at, row, id))
        : selected;
    if (
      at.state.encounters![encounter_id].status !== 'open' ||
      !target ||
      !eligible(at, row, target) ||
      !living(at, row.body_id)
    )
      continue;
    if (attacker === row.body_id && !standing(at, row.character_id)) continue;
    if (attacker === selected && (r.shot || maybeFlight(at, selected, job, r, settings))) continue;
    attack(at, command, mint, encounter_id, { ...current, npc_id: target }, attacker, r, close);
  }
}

function maybeFlight(
  at: World,
  selected: EntityId,
  job: JobRow,
  r: Round,
  settings: NonNullable<ReturnType<typeof packPlan>>,
) {
  const origin = at.state.created?.[selected]?.origin;
  const maximum =
    origin?.kind === 'spawned' ? at.populationSpecs[encode(origin.by)]?.hp.maximum : undefined;
  const current = level(at, selected, resourceRef(at, 'hp'))!;
  const leaving =
    statusAllows(at, selected)('flee') && // status reader 4: entangled, it stays
    (afraid(at, selected) ||
      (maximum !== undefined && mul(current, 100) < mul(maximum, settings.flight_below_percent)))
      ? flight(at, selected, job.due_time, r.steps)
      : undefined;
  if (!leaving) return false;
  r.ops.push(...leaving.ops);
  r.notes.push({
    key: settings.narration.enemy_fled[leaving.direction]!,
    participants: { enemy: selected },
  });
  return true;
}

function finishPack({
  world,
  job,
  row,
  encounter_id,
  r,
  close,
  mint,
  selected,
  current,
  settings,
}: PackContext) {
  const at = prefix(world, r.ops, r.due_time);
  if (at.state.encounters![encounter_id].status === 'open') {
    const active = row.active_ids!.filter((id) => eligible(at, row, id));
    if (!active.length) {
      r.ops.push(close);
      r.notes.push({ key: settings.narration.pack_withdrew });
    } else {
      const primary = active.includes(current.npc_id) ? current.npc_id : active[0];
      const cursor = next(active, selected);
      r.ops.push(...successor(world, row, job, mint, active, primary, cursor));
      if (active.length !== row.active_ids!.length && primary !== current.npc_id)
        r.notes.push({ key: settings.narration.primary_changed, participants: { enemy: primary } });
    }
  } else if (living(at, row.body_id)) r.notes.push({ key: settings.narration.pack_withdrew });
}

export function successor(
  world: World,
  row: EncounterRow,
  job: JobRow,
  mint: Mint,
  active?: readonly EntityId[],
  primary?: EntityId,
  cursor?: EntityId,
): DeltaOp[] {
  const next_job_id = mint() as JobId;
  const encounter_id = job.encounter_id!;
  return [
    {
      op: 'encounter.advance',
      writer_group: 0,
      encounter_id,
      job_id: row.job_id,
      round: row.round,
      next_job_id,
      ...(active && {
        expected: row,
        active_ids: active,
        npc_id: primary!,
        next_opponent_id: cursor!,
      }),
    },
    {
      op: 'job.schedule',
      writer_group: 0,
      job_id: next_job_id,
      job: primary ? npcRef(world, primary)! : job.job,
      encounter_id,
      due_time: add(job.due_time, world.cartridge.world!.combat!.interval),
    },
  ];
}

/** A round's lines (loka-kgd.197 names, tiers and the foe's condition when declared), then its notes. */
export function told(world: World, row: EncounterRow, r: Round): Text[] {
  const combat = world.cartridge.world!.combat!;
  const words = combat.narration;
  const hp = resourceRef(world, 'hp');
  const named = naming(world, row, r);
  const striker = (attacker: EntityId) =>
    attacker === row.body_id
      ? r.shot
        ? 'shot'
        : 'player'
      : ally(world, row.character_id, attacker)
        ? 'ally'
        : 'npc';
  const lines: Text[] = r.events.map(({ payload: e }) => {
    if (e.type === 'entity_died')
      return {
        key: words[e.victim_id === row.body_id ? 'player_died' : 'npc_died'],
        ...named(e.killer_id, e.victim_id),
      };
    const s = striker(e.attacker_id);
    const max = resourceSpec(world, e.target_id, hp).maximum;
    // a miss or a fully resisted hit loses 0, below every cut (at_percent >= 1)
    const tier = combat.tiers?.find((t) => t[`${s}_hit`] && 100 * e.loss >= t.at_percent * max);
    return {
      key:
        'prevented_by' in e && e.prevented_by
          ? words[e.prevented_by]!
          : (tier?.[`${s}_hit`] ?? words[`${s}_${e.hit ? 'hit' : 'miss'}`]!),
      ...named(e.attacker_id, e.target_id),
    };
  });
  const state = condition(world, row, r);
  if (state) {
    const died = r.events.findIndex((e) => e.payload.type === 'entity_died');
    const target = describeEntity(world, row.character_id, state.foe, 'short', r.steps) as TextKey;
    lines.splice(died < 0 ? lines.length : died, 0, { key: state.text, bindings: { target } });
  }
  return [...lines, ...r.notes];
}

// Diku rounds (loka-kgd.197): a line's {attacker}/{target} bind each non-player participant's short name.
function naming(world: World, row: EncounterRow, r: Round) {
  const name = (id: EntityId | null) =>
    world.cartridge.world!.combat!.initiative && id && id !== row.body_id
      ? describeEntity(world, row.character_id, id, 'short', r.steps)
      : undefined;
  return (attacker: EntityId | null, target: EntityId | null) => {
    const bindings = Object.fromEntries(
      Object.entries({ attacker: name(attacker), target: name(target) }).filter(([, v]) => v),
    ) as Record<string, TextKey>;
    return Object.keys(bindings).length ? { bindings } : {};
  };
}

// The condition row, after a round with an attack, of the round's starting foe (the one the player
// struck), not a pack's next member; a dead foe sits at its minimum, below every cut
// (at_percent >= 1), so it gets none.
function condition(world: World, row: EncounterRow, r: Round) {
  const rows = world.cartridge.world!.combat!.conditions;
  if (!rows || !r.events.some((e) => e.payload.type === 'attack_result')) return undefined;
  const end = prefix(world, r.ops, r.due_time);
  const foe = row.npc_id;
  const hp = resourceRef(end, 'hp');
  const { minimum, maximum } = resourceSpec(end, foe, hp);
  const current = level(end, foe, hp)!;
  const cut = rows.find((c) => 100 * (current - minimum) >= c.at_percent * (maximum - minimum));
  return cut && { text: cut.text, foe };
}
