// The consumed narration→scene choice→selected final acknowledgement sequence.
import type {
  CommandPayload,
  Command,
  ContinuationId,
  SceneDefinition,
} from '../../contracts.gen.ts';
import {
  accepted,
  event,
  rejected,
  type Mint,
  type Rule,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { assigned, type Assigned } from '../fact.ts';
import { fact } from './shared.ts';
import { options, roles, reference, continueQuery, chooseQuery, line } from './dream_shared.ts';
import { questOf } from '../lookups.ts';
import { resolution } from '../quest/lifecycle.ts';
import { apply } from '../../runtime/apply.ts';
import { leave } from '../dialogue/selection.ts';

type Continue = Command & { payload: Extract<CommandPayload, { type: 'continue' }> };
type Choose = Command & { payload: Extract<CommandPayload, { type: 'choose' }> };
export function continued(
  world: World,
  command: Continue,
  mint: Mint,
  steps: Steps,
): ReturnType<Rule<'scene'>> {
  const p = command.payload,
    found = continueQuery(world, p, steps);
  if (typeof found === 'string')
    return found === 'budget_exceeded' ? { kind: 'fault', code: found } : rejected(found);
  const { scene, index, count } = found,
    ended = index === count;
  const run = assigned(
    world,
    p.actor_id,
    { ops: [...leave(world, p.actor_id)], position: 0, facts: {} }, // dialogue@1: Continue leaves first
    { fact: fact(world, scene), value: ended ? -1 : index + 1 },
    'scene',
  );
  if (ended) return ending(world, command, mint, steps, scene, run);
  if (scene.steps[index].type === 'choice') return opening(world, command, mint, scene, index, run);
  return accepted(
    world,
    'continued',
    run.ops,
    [],
    [{ key: line(world, p.actor_id, scene, index)! }],
  );
}

function opening(
  world: World,
  command: Continue,
  mint: Mint,
  scene: Extract<SceneDefinition, { control: 'presentation_only' }>,
  index: number,
  run: Assigned,
) {
  const next = options(scene)!,
    p = command.payload,
    continuation_id = mint() as ContinuationId;
  return accepted(
    world,
    'continued',
    [
      ...run.ops,
      {
        op: 'choice.open',
        writer_group: 0,
        continuation_id,
        actor_id: p.actor_id,
        source: reference(world, scene),
        beat: next.key,
        roles: roles(world, p.actor_id, scene),
        choice_ids: next.choices.map((c) => c.choice_id),
        quest_instance_id: questOf(world, p.actor_id, scene.on.rest.quest)![0],
      },
    ],
    [event(world, command, mint, run.position + 1, { type: 'choice_opened', continuation_id })],
    [{ key: line(world, p.actor_id, scene, index)! }],
  );
}

function ending(
  world: World,
  command: Continue,
  mint: Mint,
  steps: Steps,
  scene: Extract<SceneDefinition, { control: 'presentation_only' }>,
  initial: ReturnType<typeof assigned>,
) {
  let run = initial;
  for (const assign of scene.on_end.assign)
    run = assigned(world, command.payload.actor_id, run, assign, 'scene');
  const applied = apply(world, run.ops);
  if ('fault' in applied) return { kind: 'fault' as const, code: 'precondition_failed' as const };
  const end = resolution(
    { ...world, state: applied.state as World['state'] },
    command.payload.actor_id,
    scene.on_end.quest,
    scene.on_end.outcome,
    0,
    steps,
  );
  if (typeof end === 'string') return rejected(end);
  return accepted(
    world,
    'ended',
    [...run.ops, ...end.ops],
    [
      event(world, command, mint, run.position + 1, {
        type: 'scene_ended',
        scene: command.payload.scene,
      }),
      event(world, command, mint, run.position + 2, end.payload),
    ],
    [{ key: line(world, command.payload.actor_id, scene, scene.steps.length - 2)! }],
  );
}

export function chosen(
  world: World,
  command: Choose,
  mint: Mint,
  steps: Steps,
): ReturnType<Rule<'dialogue'>> {
  const p = command.payload,
    found = chooseQuery(world, p, steps);
  if (typeof found === 'string')
    return found === 'budget_exceeded' ? { kind: 'fault', code: found } : rejected(found);
  const run = assigned(
    world,
    p.actor_id,
    { ops: [], position: 0, facts: {} },
    { fact: fact(world, found.scene), value: p.dream!.line + 1 },
    'scene',
  );
  const op = {
    op: 'choice.resolve' as const,
    writer_group: 0,
    continuation_id: p.continuation_id,
    expected_revision: p.dream!.expected_revision,
    choice_id: p.choice_id,
  };
  return accepted(
    world,
    'choice_resolved',
    [op, ...run.ops],
    [
      event(world, command, mint, run.position + 1, {
        type: 'choice_resolved',
        continuation_id: p.continuation_id,
        choice_id: p.choice_id,
      }),
    ],
    [{ key: options(found.scene)!.choices.find((c) => c.choice_id === p.choice_id)!.label }],
  );
}
