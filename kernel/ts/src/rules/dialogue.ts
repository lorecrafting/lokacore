// dialogue@1 (capability_registry.json; 06 §17, §33, §37, §38, §43; 04 §5.3 Choice/continuation
// resolution; 21 §20): talk, choose and close_choice. talk: a target that is no dialogue's speaker
// is not_found; else the dialogue's policy is enforced here, since a cartridge action with command
// talk (an alias) passes admission on its own policy: failing it, or a pending choice of the
// actor's, is invalid_state; else one choice.open of a new
// continuation (its id the command's IdSource ordinal 0: each talk is a distinct occurrence),
// beat the dialogue's key, each role bound to its EntityId in role-name order, the choice ids in
// key order, and its choice_opened. choose: a continuation that is not pending, not the actor's or
// does not offer choice_id is invalid_state (a resolved or closed one is never chosen again);
// then a bound NPC not in the actor's room not_present, then a bound item the actor's body does
// not hold not_owned (dialogue.ts blocked, the GameView's availability too); then the dialogue's
// quest resolves with outcome choice_id (quest.ts resolution on the world before this decision:
// invalid_state or quest_requirement). Accepted, outcome choice_id, in one decision: the hand_over
// (an entity.transfer of the bound item to the bound NPC and its item_acquired, as give), the
// choice's fact.assign steps (fact.ts assigned), the quest's transitions and quest_resolved, the
// choice.resolve at the revision its continuation was opened at, and choice_resolved; one
// narration line, its participants the actor's body and every bound role, read from the row
// (06 §43: never re-resolved by name). close_choice: the actor's pending continuation (the
// ActionSet fills it) closes, nothing else changes (06 §37, §43); else invalid_state.
import type { DialogueChoice, EntityId } from '../contracts.gen.ts';
import {
  accepted,
  bodyOf,
  event,
  has,
  rejected,
  values,
  refString,
  type ChoiceRow,
  type Mint,
  type Rule,
  type World,
} from '../decision.ts';
import { blocked, bind, choiceIds, continuationId, definition, pending } from '../dialogue.ts';
import { assigned } from '../fact.ts';
import { holds } from '../policy.ts';
import { resolution } from '../quest.ts';

type Command<T> = Omit<Parameters<Rule<'dialogue'>>[1], 'payload'> & {
  readonly payload: Extract<Parameters<Rule<'dialogue'>>[1]['payload'], { type: T }>;
};

export const decide: Rule<'dialogue'> = (world, command, mint) => {
  const p = command.payload;
  if (p.type === 'talk') return talk(world, { ...command, payload: p }, mint);
  const choices = world.state.choices ?? {};
  const row = has(choices, p.continuation_id) ? choices[p.continuation_id] : undefined;
  if (!row || row.status !== 'pending' || row.actor_id !== p.actor_id)
    return rejected('invalid_state');
  if (p.type === 'choose') return choose(world, { ...command, payload: p }, mint, row);
  const op = { op: 'choice.close', writer_group: 0, continuation_id: p.continuation_id } as const;
  return accepted(world, 'choice_closed', [op], []);
};

function talk(world: World, command: Command<'talk'>, mint: Mint) {
  const p = command.payload;
  const d = values(world.cartridge.dialogues ?? {}).find(
    (x) => world.entityIds[refString(x.npc)] === p.target_id,
  );
  if (!d) return rejected('not_found');
  if (!holds(world, p.actor_id, d.policy.root)) return rejected('invalid_state');
  if (pending(world, p.actor_id)) return rejected('invalid_state');
  const continuation_id = continuationId(mint);
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  const op = {
    op: 'choice.open',
    writer_group: 0,
    continuation_id,
    actor_id: p.actor_id,
    source: { cartridge_id, cartridge_version, kind: 'dialogue', key: d.key },
    beat: d.key,
    roles: bind(world, d),
    choice_ids: choiceIds(d),
  } as const;
  const opened = { type: 'choice_opened', continuation_id } as const;
  return accepted(world, 'choice_opened', [op], [event(world, command, mint, 1, opened)]);
}

function choose(world: World, command: Command<'choose'>, mint: Mint, row: ChoiceRow) {
  const { actor_id, choice_id, continuation_id } = command.payload;
  if (!row.choice_ids.includes(choice_id)) return rejected('invalid_state');
  const code = blocked(world, row);
  if (code) return rejected(code);
  const d = definition(world, row.source);
  const option = d.choices[choice_id]!;
  const resolved = d.quest && resolution(world, actor_id, d.quest, choice_id, 0);
  if (typeof resolved === 'string') return rejected(resolved);
  const body = bodyOf(world, actor_id)!;
  const given = handOver(world, command, mint, row, option, body);
  const start = { ops: given.ops, position: given.events.length, facts: {} };
  const run = (option.sequence ?? []).reduce((r, s) => assigned(world, actor_id, r, s), start);
  const quest = resolved ? [event(world, command, mint, run.position + 1, resolved.payload)] : [];
  const expected_revision = row.opened_revision;
  const op = {
    op: 'choice.resolve',
    writer_group: 0,
    continuation_id,
    choice_id,
    expected_revision,
  } as const;
  const chosen = { type: 'choice_resolved', continuation_id, choice_id } as const;
  const participants = row.roles.reduce((o, r) => ({ ...o, [r.role]: r.entity_id }), {
    actor: body,
  });
  return accepted(
    world,
    choice_id,
    [...run.ops, ...(resolved ? resolved.ops : []), op],
    [
      ...given.events,
      ...quest,
      event(world, command, mint, run.position + quest.length + 1, chosen),
    ],
    [{ key: option.narration, participants }],
  );
}

// The option's hand_over: the bound item from the body to the bound NPC and its item_acquired.
function handOver(
  world: World,
  command: Command<'choose'>,
  mint: Mint,
  row: ChoiceRow,
  { hand_over: h }: DialogueChoice,
  body: EntityId,
) {
  if (!h) return { ops: [], events: [] };
  const bound = (role: string) => row.roles.find((r) => r.role === role)!.entity_id;
  const [item_id, holder_id] = [bound(h.item), bound(h.to)];
  const op = {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: item_id,
    source_id: body,
    destination_id: holder_id,
  } as const;
  const acquired = { type: 'item_acquired', item_id, holder_id } as const;
  return { ops: [op], events: [event(world, command, mint, 1, acquired)] };
}
