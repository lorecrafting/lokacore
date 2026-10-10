import { chosen } from '../scene/sequence.ts';
import * as patrol from '../patrol/sequence.ts';
import { grant } from '../topics/shared.ts';
import { hub, wrongAnswer } from './behavior.ts';
import { acquire } from '../skills.ts';
import { exchangeRoles, contribution, exchangeDefinition, exchangeTransfers } from './exchange.ts';
import { questOf } from '../lookups.ts';
// Dialogue lowers bound choices, quest transitions and facts in one writer group.
import type {
  CharacterId,
  DefinitionRef,
  DialogueChoice,
  DialogueDefinition,
  EntityId,
  Key,
  RoleBinding,
} from '../../contracts.gen.ts';
import { transition as escortTransition } from '../escort/shared.ts';
import { same } from '../../foundation/compose.ts';
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
  refString,
} from '../../runtime/decision.ts';
import {
  blocked,
  answerFits,
  bind,
  choiceIds,
  continuationId,
  definition,
  leave,
  speaks,
  spokenBy,
  talking,
} from './shared.ts';
import { assigned, adjusted, type Assigned } from '../fact.ts';
import { acceptRefused, activation, boundActivation, resolution } from '../quest/lifecycle.ts';
import { choicePayment } from './payment.ts';

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
  if (row.source.kind === 'scene')
    return p.type === 'choose'
      ? chosen(world, { ...command, payload: p }, mint, steps)
      : rejected('invalid_state');
  if (p.type === 'choose' && p.dream !== undefined) return rejected('invalid_state');
  if (p.type === 'choose') return choose(world, { ...command, payload: p }, mint, row, steps);
  const op = { op: 'choice.close', writer_group: 0, continuation_id: p.continuation_id } as const;
  return accepted(world, 'choice_closed', [op], []);
};

function talk(world: World, command: Command<'talk'>, mint: Mint, steps: Steps) {
  const p = command.payload;
  if (!speaks(world, p.target_id)) return rejected('not_found');
  const d = spokenBy(world, p.actor_id, p.target_id, steps, p.dialogue);
  if (!d || talking(world, p.actor_id, p.target_id)) return rejected('invalid_state');
  const continuation_id = continuationId(mint);
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  const op = {
    op: 'choice.open',
    writer_group: 0,
    continuation_id,
    actor_id: p.actor_id,
    source: { cartridge_id, cartridge_version, kind: 'dialogue', key: d.key },
    beat: d.key,
    roles: [...bind(world, d), ...exchangeRoles(world, p.actor_id, d, steps)],
    ...(d.quest &&
      (d.riddle?.wrong_limit !== undefined || values(d.choices).some((o) => o.exchange)) && {
        quest_instance_id: questOf(world, p.actor_id, d.quest)?.[0],
      }),
    choice_ids: choiceIds(d),
    ...(d.riddle?.wrong_limit !== undefined && {
      attempts: { count: 0, limit: d.riddle.wrong_limit },
    }),
  } as const;
  const opened = { type: 'choice_opened', continuation_id } as const;
  const ops = [...leave(world, p.actor_id), op];
  return accepted(world, 'choice_opened', ops, [event(world, command, mint, 1, opened)]);
}

function choose(world: World, command: Command<'choose'>, mint: Mint, row: ChoiceRow, used: Steps) {
  const { actor_id, choice_id, continuation_id } = command.payload;
  if (!row.choice_ids.includes(choice_id)) return rejected('invalid_state');
  const d = definition(world, row.source);
  const option = d.choices[choice_id]!;
  const code = blocked(world, row, option, used, command.payload.patrol);
  if (code)
    return code === 'budget_exceeded' ||
      code === 'precondition_failed' ||
      code === 'containment_cycle'
      ? {
          kind: 'fault' as const,
          code,
        }
      : rejected(code);
  const participants = row.roles.reduce((o, r) => ({ ...o, [r.role]: r.entity_id }), {
    actor: bodyOf(world, actor_id)!,
  });
  const riddle = d.riddle?.choice_id === choice_id ? d.riddle : undefined;
  const answer = command.payload.answer;
  if (riddle ? answer === undefined || !answerFits(riddle.bank, answer) : answer !== undefined)
    return rejected('invalid_state');
  if (riddle && answer!.toLowerCase() !== riddle.answer)
    return wrongAnswer(world, command, row, riddle, participants);
  return hub(
    world,
    command,
    mint,
    row,
    d,
    option,
    applyChoice(world, command, mint, row, used, participants),
  );
}

function sequence(
  world: World,
  actor: CharacterId,
  option: DialogueChoice,
  boundReceive: boolean,
  quest?: DefinitionRef,
) {
  let run: Assigned = {
    ops: [],
    position: boundReceive ? 2 : option.receive || option.hand_over ? 1 : 0,
    facts: {},
  };
  for (const step of option.sequence ?? []) {
    const next =
      step.op === 'topic.grant'
        ? grant(world, actor, run, step.topic)
        : step.op === 'skill.acquire'
          ? acquire(world, actor, run, step.skill)
          : step.op === 'fact.adjust'
            ? adjusted(world, actor, run, step)
            : assigned(world, actor, run, step);
    if (!next) return undefined;
    run = next;
  }
  return option.exchange && quest
    ? contribution(world, actor, quest, {
        ...run,
        position: exchangeDefinition(world, quest)!.quantity * 2,
      })
    : run;
}

// size: allow 60, one choice lowers its bound quest, custody, payment and events atomically
function applyChoice(
  world: World,
  command: Command<'choose'>,
  mint: Mint,
  row: ChoiceRow,
  used: Steps,
  participants: Record<string, EntityId>,
) {
  const { actor_id, choice_id, continuation_id } = command.payload;
  const d = definition(world, row.source);
  const option = d.choices[choice_id]!;
  const q = quest(world, actor_id, d, option, choice_id, mint, used, row.roles);
  if (typeof q === 'string') return rejected(q);
  const body = bodyOf(world, actor_id)!;
  const boundReceive = !!(option.accept && option.receive);
  const run = sequence(world, actor_id, option, boundReceive, d.quest);
  if (!run) return { kind: 'fault' as const, code: 'precondition_failed' as const };
  const given =
    option.exchange && d.quest
      ? exchangeTransfers(world, command, mint, row, body)
      : handOver(world, command, mint, row, option, body, boundReceive ? 2 : 1);
  const quests = q
    ? [event(world, command, mint, boundReceive ? 1 : run.position + 1, q.payload)]
    : [];
  const paid = choicePayment(world, row, option, body);
  if ((option.payment || option.lesson_payment) && !paid) return rejected('insufficient_resource');
  const watched = patrol.choice(world, command, row, q?.payload, mint, used);
  const op = {
    op: 'choice.resolve',
    writer_group: 0,
    continuation_id,
    choice_id,
    expected_revision: row.opened_revision,
  } as const;
  const chosen = { type: 'choice_resolved', continuation_id, choice_id } as const;
  const at = run.position + quests.length + watched.events.length + 1;
  const resolvedChoice = event(world, command, mint, at, chosen);
  return accepted(
    world,
    choice_id,
    [
      ...(boundReceive && q ? q.ops : []),
      ...given.ops,
      ...run.ops,
      ...(paid?.ops ?? []),
      ...escortTransition(world, row, option, continuation_id, choice_id),
      ...(!boundReceive && q ? q.ops : []),
      ...watched.ops,
      op,
    ],
    [
      ...(boundReceive ? quests : given.events),
      ...(boundReceive ? given.events : quests),
      ...watched.events,
      resolvedChoice,
      ...storyPoints(world, command, mint, row, at + 1),
    ],
    [{ key: option.narration, participants }],
  );
}

// The dialogue's quest resolving with outcome `choice_id`, or the option's accept activating its
// quest: invalid_state when accept_quest would refuse it (mechanics/quest/lifecycle.ts acceptRefused; the talk-time
// policy may be stale).
function quest(
  world: World,
  actor: CharacterId,
  d: DialogueDefinition,
  option: DialogueChoice,
  choice_id: Key,
  mint: Mint,
  used: Steps,
  bindings: readonly RoleBinding[],
) {
  if (d.quest) return resolution(world, actor, d.quest, choice_id, 0, used);
  const { accept } = option;
  if (!accept) return undefined;
  return (
    acceptRefused(world, actor, accept, used) ??
    (option.receive || world.cartridge.quests![refString(accept)].exchange
      ? boundActivation(world, mint, actor, accept, bindings)
      : activation(mint, actor, accept))
  );
}

// The bound transfer: outgoing hand_over or incoming receive, with the actual acquisition holder.
function handOver(
  world: World,
  command: Command<'choose'>,
  mint: Mint,
  row: ChoiceRow,
  { hand_over: h, receive: r }: DialogueChoice,
  body: EntityId,
  position: number,
) {
  if (!h && !r) return { ops: [], events: [] };
  const bound = (role: string) => row.roles.find((r) => r.role === role)!.entity_id;
  const item_id = bound((r ?? h)!.item);
  const holder_id = r ? body : bound(h!.to);
  const op = {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: item_id,
    source_id: r ? bound(r.from) : body,
    destination_id: holder_id,
  } as const;
  const acquired = { type: 'item_acquired', item_id, holder_id } as const;
  return { ops: [op], events: [event(world, command, mint, position, acquired)] };
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
