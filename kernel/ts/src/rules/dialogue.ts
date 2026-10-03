// dialogue@1 (capability_registry.json; 06 §17, §33, §37, §38, §43; 04 §5.3 Choice/continuation
// resolution; 21 §20): talk, choose and close_choice. talk: a target that is no dialogue's speaker
// is not_found; else it opens the first of its dialogues, in key order, whose own policy holds
// (enforced here, since a cartridge action with command talk (an alias) passes admission on its own
// policy): none, or a pending choice of the actor's, is invalid_state; else one choice.open of a
// new continuation (its id the command's IdSource ordinal 0: each talk is a distinct occurrence),
// beat the dialogue's key, each role bound to its EntityId in role-name order, the choice ids in
// key order, and its choice_opened. choose: a continuation that is not pending, not the actor's or
// does not offer choice_id is invalid_state (a resolved or closed one is never chosen again); then
// a bound NPC not in the actor's room not_present, then a bound item the actor's body does not hold
// not_owned (dialogue.ts blocked, the GameView's availability too); then the dialogue's quest
// resolves with outcome choice_id (quest.ts resolution on the world before this decision:
// invalid_state or quest_requirement), or the choice's accept activates its quest (quest.ts
// activation; invalid_state if the actor already has an instance: the talk-time policy may be
// stale). Accepted, outcome choice_id, in one decision: the hand_over (an entity.transfer of the
// bound item to the bound NPC and its item_acquired, as give), the choice's fact.assign steps
// (fact.ts assigned), the quest's transitions and quest_resolved (or its quest.activate and
// quest_activated), the choice.resolve at the revision its continuation was opened at, and
// choice_resolved; one narration line, its participants the actor's body and every bound role, read
// from the row (06 §43: never re-resolved by name); after choice_resolved, if a story point's
// outcome names this dialogue and choice, its story_point_reached (23 §3). close_choice: the
// actor's pending continuation (the ActionSet fills it) closes, nothing else changes (06 §37, §43);
// else invalid_state.
import type {
  CharacterId,
  DialogueChoice,
  DialogueDefinition,
  EntityId,
  Key,
} from '../contracts.gen.ts';
import { same } from '../compose.ts';
import {
  accepted,
  bodyOf,
  entries,
  event,
  has,
  rejected,
  values,
  type ChoiceRow,
  type Mint,
  type Rule,
  type Steps,
  type World,
} from '../decision.ts';
import {
  blocked,
  bind,
  choiceIds,
  continuationId,
  definition,
  pending,
  speaks,
  spokenBy,
} from '../dialogue.ts';
import { assigned } from '../fact.ts';
import { acceptRefused, activation, resolution } from '../quest.ts';

type Command<T> = Omit<Parameters<Rule<'dialogue'>>[1], 'payload'> & {
  readonly payload: Extract<Parameters<Rule<'dialogue'>>[1]['payload'], { type: T }>;
};

export const decide: Rule<'dialogue'> = (world, command, mint, steps = { n: 0 }) => {
  const p = command.payload;
  if (p.type === 'talk') return talk(world, { ...command, payload: p }, mint, steps);
  const choices = world.state.choices ?? {};
  const row = has(choices, p.continuation_id) ? choices[p.continuation_id] : undefined;
  if (!row || row.status !== 'pending' || row.actor_id !== p.actor_id)
    return rejected('invalid_state');
  if (p.type === 'choose') return choose(world, { ...command, payload: p }, mint, row, steps);
  const op = { op: 'choice.close', writer_group: 0, continuation_id: p.continuation_id } as const;
  return accepted(world, 'choice_closed', [op], []);
};

function talk(world: World, command: Command<'talk'>, mint: Mint, steps: Steps) {
  const p = command.payload;
  if (!speaks(world, p.target_id)) return rejected('not_found');
  const d = spokenBy(world, p.actor_id, p.target_id, steps);
  if (!d || pending(world, p.actor_id)) return rejected('invalid_state');
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

function choose(world: World, command: Command<'choose'>, mint: Mint, row: ChoiceRow, used: Steps) {
  const { actor_id, choice_id, continuation_id } = command.payload;
  if (!row.choice_ids.includes(choice_id)) return rejected('invalid_state');
  const code = blocked(world, row);
  if (code) return rejected(code);
  const d = definition(world, row.source);
  const option = d.choices[choice_id]!;
  const q = quest(world, actor_id, d, option, choice_id, mint, used);
  if (typeof q === 'string') return rejected(q);
  const body = bodyOf(world, actor_id)!;
  const given = handOver(world, command, mint, row, option, body);
  const start = { ops: given.ops, position: given.events.length, facts: {} };
  const run = (option.sequence ?? []).reduce((r, s) => assigned(world, actor_id, r, s), start);
  const quests = q ? [event(world, command, mint, run.position + 1, q.payload)] : [];
  const expected_revision = row.opened_revision;
  const op = {
    op: 'choice.resolve',
    writer_group: 0,
    continuation_id,
    choice_id,
    expected_revision,
  } as const;
  const chosen = { type: 'choice_resolved', continuation_id, choice_id } as const;
  const at = run.position + quests.length + 1;
  const resolvedChoice = event(world, command, mint, at, chosen);
  // Minted after choice_resolved, so the earlier ids stay put.
  const reached = storyPoints(world, command, mint, row, at + 1);
  const participants = row.roles.reduce((o, r) => ({ ...o, [r.role]: r.entity_id }), {
    actor: body,
  });
  return accepted(
    world,
    choice_id,
    [...run.ops, ...(q ? q.ops : []), op],
    [...given.events, ...quests, resolvedChoice, ...reached],
    [{ key: option.narration, participants }],
  );
}

// The dialogue's quest resolving with outcome `choice_id`, or the option's accept activating its
// quest: invalid_state when accept_quest would refuse it (quest.ts acceptRefused; the talk-time
// policy may be stale).
function quest(
  world: World,
  actor: CharacterId,
  d: DialogueDefinition,
  { accept }: DialogueChoice,
  choice_id: Key,
  mint: Mint,
  used: Steps,
) {
  if (d.quest) return resolution(world, actor, d.quest, choice_id, 0, used);
  if (!accept) return undefined;
  return acceptRefused(world, actor, accept, used) ?? activation(mint, actor, accept);
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

// The story_point_reached of the story point outcome whose trigger is this row's dialogue and
// choice (23 §3; the loader allows at most one).
function storyPoints(
  world: World,
  command: Command<'choose'>,
  mint: Mint,
  row: ChoiceRow,
  at: number,
) {
  const { choice_id } = command.payload;
  return values(world.cartridge.story_points ?? {}).flatMap(({ key, outcomes }) =>
    entries(outcomes)
      .filter(([, t]) => same(t.dialogue, row.source) && t.choice === choice_id)
      .map(([outcome]) => {
        const story_point = { ...row.source, kind: 'story_point', key };
        const payload = { type: 'story_point_reached', story_point, outcome } as const;
        return event(world, command, mint, at, payload);
      }),
  );
}
