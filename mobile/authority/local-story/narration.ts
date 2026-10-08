// Committed narration and its routing (cue, combat lines, detail), read back from receipts.
import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { detailOf } from '../../../kernel/ts/src/commands/actions.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { bellCue } from '../../../kernel/ts/src/mechanics/bell/cue.ts';
import { engaged } from '../../../kernel/ts/src/mechanics/combat/shared.ts';
import { bodyOf, refString } from '../../../kernel/ts/src/runtime/decision.ts';
import type { NarrationRecord } from '../../packages/game-view/session.ts';
import { defenseEvidence } from './combat-receipt.ts';
import { dialogueDetail } from './dialogue-receipt.ts';
import { dreamDetail } from './dream-receipt.ts';
import { eatReceipt } from './food-receipt.ts';
import { scope, type Story } from './save.ts';

type Accepted = Extract<DecisionResult, { kind: 'accepted' }>;

/**
 * The latest committed narration in this story's receipts, shown again on reopen after a crash
 * before display (06 §43): read from storage, never memory; no acknowledgement is stored. None
 * while a transaction is open (an unknown COMMIT whose ROLLBACK failed).
 */
type NarrationRow = { revision: number; command_id: string; command: string; response: string };

export function narration(s: Story, command_id?: string): NarrationRecord | undefined {
  if (s.db.isInTransactionSync()) return undefined; // its rows may be uncommitted (03 §15)
  let before: number | null = null;
  while (true) {
    const r = latest(s, command_id, before);
    if (!r) return undefined;
    const d = JSON.parse(r.response) as Accepted;
    if (!Array.isArray(d.events) || d.events.some((e) => typeof e?.payload?.type !== 'string'))
      throw new Error('malformed JSON: invalid committed event evidence');
    defenseEvidence(d.events);
    const lines = d.narration ?? [];
    const combat_lines = combatLines(s, d, lines);
    const pickup = corpsePickup(s, r, d);
    if (!lines.length && !pickup) {
      if (command_id) return undefined;
      before = r.revision;
      continue;
    }
    const detail_id = pickup?.corpse_id ?? receiptDetail(s, r, d);
    const cue = receiptBellCue(s, r, d);
    return {
      command_id: r.command_id,
      lines,
      ...(cue && { cue }),
      ...(combat_lines.length && { combat_lines }),
      ...(detail_id && { detail_id }),
      ...(pickup && { pickup_name: s.world.entities[pickup.item_id].short }),
    } as NarrationRecord;
  }
}

const latest = (s: Story, command_id: string | undefined, before: number | null) =>
  s.db.getFirstSync<NarrationRow>(
    `SELECT revision, command_id, command, response FROM receipt WHERE scope = ?
     AND (json_array_length(response, '$.narration') > 0
       OR json_extract(response, '$.outcome') = 'taken')
     AND (? IS NULL OR command_id = ?)
     AND (? IS NULL OR revision < ?) ORDER BY revision DESC LIMIT 1`,
    scope(s),
    command_id ?? null,
    command_id ?? null,
    before,
    before,
  );

// The narration lines that belong to combat: an encounter root, attack, pack or engaged bleed.
function combatLines(s: Story, d: Accepted, lines: NonNullable<Accepted['narration']>) {
  const root =
    ['engaged', 'fled'].includes(d.outcome) &&
    d.delta.ops.some(
      (o) => o.writer_group === 0 && (o.op === 'encounter.open' || o.op === 'encounter.close'),
    );
  const keys = d.events.some((e) => e.payload.type === 'attack_result')
    ? Object.values(s.world.cartridge.world?.combat?.narration ?? {})
    : [];
  const packKeys = Object.values(s.world.cartridge.populations ?? {}).flatMap((plan) => {
    const n = plan.pack?.narration;
    return n
      ? [n.helper_joined, n.primary_changed, n.pack_withdrew, ...Object.values(n.enemy_fled)]
      : [];
  });
  const bleedKeys = Object.values(s.world.cartridge.bleeds ?? {}).flatMap((bleed) =>
    Object.values(bleed.narration),
  );
  return lines.flatMap((line, i) =>
    root ||
    keys.includes(line?.key) ||
    packKeys.includes(line?.key) ||
    (bleedKeys.includes(line?.key) && !!engaged(s.world, s.world.body)) ||
    (d.outcome === 'bandaged' && d.encounter_id === engaged(s.world, s.world.body)?.id)
      ? [i]
      : [],
  );
}

function receiptBellCue(s: Story, r: { command_id: string; command: string }, d: Accepted) {
  if (!s.world.cartridge.world?.bell_cue) return;
  const c = JSON.parse(r.command) as Command;
  if (c?.payload?.type !== 'perform' || c.payload.action !== 'ring_bell') return;
  const { action, actor_id } = c.payload;
  if (validate('Command', c).length || c.id !== r.command_id || actor_id !== s.world.character)
    throw new Error('malformed JSON: invalid committed bell cue');
  const recipe = Object.values(s.world.cartridge.recipes ?? {}).find((a) => a.key === action);
  if (!recipe) throw new Error('malformed JSON: missing bell cue source');
  const room_id = s.world.roomIds[refString(recipe.target.room)];
  if (!room_id) throw new Error('malformed JSON: missing bell cue room');
  const cues = d.events.flatMap((e) => {
    const projected = bellCue(s.world, e, c.id, actor_id, room_id);
    return projected ? [projected] : [];
  });
  if (cues.length !== 1) throw new Error('malformed JSON: inconsistent committed bell cue');
  return cues[0];
}

function corpsePickup(s: Story, r: { command_id: string; command: string }, d: Accepted) {
  if (d.kind !== 'accepted' || d.outcome !== 'taken') return;
  const command = JSON.parse(r.command) as Command;
  const p = command?.payload;
  if (validate('Command', command).length || command.id !== r.command_id || p.type !== 'take')
    throw new Error('malformed JSON: invalid committed Take');
  const transfer = d.delta.ops.find((o) => o.op === 'entity.transfer' && o.entity_id === p.item_id);
  if (transfer?.op !== 'entity.transfer' || !transfer.source_id) return;
  const corpse = s.world.state.created?.[transfer.source_id];
  if (corpse?.origin.kind !== 'death') return;
  const body = bodyOf(s.world, p.actor_id);
  if (
    transfer.destination_id !== body ||
    !d.events.some(
      (e) =>
        e.causation_id === r.command_id &&
        e.payload.type === 'item_acquired' &&
        e.payload.item_id === p.item_id &&
        e.payload.holder_id === body,
    )
  )
    throw new Error('malformed JSON: invalid corpse pickup evidence');
  return { corpse_id: transfer.source_id, item_id: p.item_id };
}

// Routing belongs to this receipt's committed command/evidence, never text or current room.
function receiptDetail(s: Story, r: { command_id: string; command: string }, d: Accepted) {
  const command = JSON.parse(r.command) as Command | null;
  const dream = dreamDetail(s, command);
  if (dream) return dream;
  if (
    command?.payload?.type === 'choose' ||
    d.outcome === 'riddle_wrong' ||
    d.events.some((e) => e.causation_id === r.command_id && e.payload.type === 'choice_resolved')
  )
    return dialogueDetail(s, r.command_id, command!, d);
  if (command?.payload?.type === 'buy' || command?.payload?.type === 'sell') {
    if (validate('Command', command).length || command.id !== r.command_id)
      throw new Error('malformed JSON: invalid committed shop exchange');
    return command.payload.provider_id;
  }
  if (command?.payload?.type === 'use_transport' || command?.payload?.type === 'use_service')
    return travelDetail(r, command, d);
  if (command?.payload?.type === 'eat') return eatReceipt(s.world, command, r.command_id, d);
  if (command?.payload?.type === 'bandage') return bandaged(s, r, command, command.payload, d);
  if (d.outcome === 'harvested' && command?.payload?.type === 'harvest')
    return command.payload.target_id;
  const p = command?.payload;
  if (p?.type === 'fill' || p?.type === 'pour' || p?.type === 'drink') {
    if (validate('Command', command).length || command?.id !== r.command_id)
      throw new Error('malformed JSON: invalid committed liquid action');
    return p.type === 'drink' ? p.vessel_id : p.source_id;
  }
  return readableDetail(s, r, command, d);
}

function travelDetail(r: { command_id: string }, command: Command, d: Accepted) {
  if (command?.payload?.type === 'use_transport') {
    if (
      validate('Command', command).length ||
      command.id !== r.command_id ||
      d.outcome !== 'transport_used'
    )
      throw new Error('malformed JSON: invalid committed transport');
    return command.payload.endpoint_id;
  }
  if (command?.payload?.type === 'use_service') {
    if (
      validate('Command', command).length ||
      command.id !== r.command_id ||
      d.outcome !== 'service_used'
    )
      throw new Error('malformed JSON: invalid committed service');
    return command.payload.provider_id;
  }
}

function bandaged(
  s: Story,
  r: { command_id: string },
  command: Command,
  p: Extract<Command['payload'], { type: 'bandage' }>,
  d: Accepted,
) {
  const item = s.world.entities[p.item_id];
  if (
    validate('Command', command).length ||
    command.id !== r.command_id ||
    d.outcome !== 'bandaged' ||
    d.item_id !== p.item_id ||
    d.effect_generation !== p.effect_generation ||
    item?.kind !== 'item' ||
    !item.bandage ||
    d.narration?.length !== 1 ||
    d.narration[0].key !== item.bandage.narration
  )
    throw new Error('malformed JSON: invalid committed bandage');
  return undefined;
}

function readableDetail(s: Story, r: { command_id: string }, command: Command | null, d: Accepted) {
  if (!['read', 'performed', 'success'].includes(d.outcome)) return;
  if (d.outcome === 'read') {
    if (
      validate('Command', command).length ||
      command?.id !== r.command_id ||
      command.payload.type !== 'read'
    )
      throw new Error('malformed JSON: invalid committed Read');
    return command.payload.target_id;
  }
  return recipeDetail(s, r, command, d);
}

function recipeDetail(s: Story, r: { command_id: string }, command: Command | null, d: Accepted) {
  const completed = d.events.filter(
    (e) => e.payload.type === 'action_completed' && e.causation_id === r.command_id,
  );
  const action = command?.payload?.type === 'perform' ? command.payload.action : undefined;
  const recipe = Object.values(s.world.cartridge.recipes ?? {}).find((r) => r.key === action);
  const subject = recipe && detailOf(s.world, recipe.target);
  const readable = subject && s.world.details[subject]?.readable;
  const readableEvidence = completed.some(
    (e) => e.payload.type === 'action_completed' && s.world.details[e.payload.subject_id]?.readable,
  );
  if (!readable && !readableEvidence) return;
  const event = completed[0];
  if (
    validate('Command', command).length ||
    command?.id !== r.command_id ||
    !readable ||
    completed.length !== 1 ||
    event.payload.type !== 'action_completed' ||
    event.payload.action !== action ||
    event.payload.subject_id !== subject ||
    (command?.payload?.type === 'perform' && event.actor_id !== command.payload.actor_id) ||
    (command?.payload?.type === 'perform' &&
      command.payload.target_id !== undefined &&
      command.payload.target_id !== subject)
  )
    throw new Error('malformed JSON: invalid readable recipe receipt');
  return subject;
}
