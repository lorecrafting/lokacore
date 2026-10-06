// Read-only anchored checkpoints and exact scene-owned choice admission.
import {
  LIMITS,
  type CharacterId,
  type ContinuationId,
  type CommandPayload,
  type DefinitionRef,
  type DreamDraw,
  type ErrorCode,
  type Key,
  type SceneDefinition,
} from '../../contracts.gen.ts';
import {
  bodyOf,
  refString,
  type ChoiceRow,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { same } from '../../foundation/compose.ts';
import { value } from '../fact.ts';
import { level, resourceRef } from '../resource.ts';
import { engaged } from '../combat/shared.ts';
import { pending } from '../dialogue/selection.ts';
import { fact, running } from './shared.ts';
import { questOf } from '../lookups.ts';

export type Dream = Extract<SceneDefinition, { control: 'presentation_only' }>;
export const definition = (world: World, ref: DefinitionRef) => {
  const scene = world.cartridge.scenes?.[refString(ref)];
  return scene?.control === 'presentation_only' ? scene : undefined;
};
export const reference = (world: World, scene: Dream): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: 'scene',
  key: scene.key,
});
export const options = (scene: Dream) => {
  const step = scene.steps[3];
  return step.type === 'choice' ? step : undefined;
};
export const choice = (world: World, actor: CharacterId, scene: Dream) =>
  Object.entries(world.state.choices ?? {}).find(
    ([, row]) => row.actor_id === actor && same(row.source, reference(world, scene)),
  ) as [ContinuationId, ChoiceRow] | undefined;
export const roles = (world: World, actor: CharacterId, scene: Dream) => [
  { role: 'body' as Key, entity_id: bodyOf(world, actor)! },
  { role: 'anchor' as Key, entity_id: world.roomIds[refString(scene.on.rest.room)] },
];
export const draw = (
  world: World,
  actor: CharacterId,
  scene: Dream,
  row: ChoiceRow,
): DreamDraw => ({
  scene: reference(world, scene),
  line: 4,
  body_id: bodyOf(world, actor)!,
  room_id: world.roomIds[refString(scene.on.rest.room)],
  expected_revision: row.opened_revision,
});

export function safe(
  world: World,
  actor: CharacterId,
  scene: Dream,
  steps: Steps,
): ErrorCode | undefined {
  if (++steps.n > LIMITS.query_steps) return 'budget_exceeded';
  const body = bodyOf(world, actor);
  if (!body || (level(world, body, resourceRef(world, 'hp')) ?? 0) <= 0) return 'invalid_state';
  if (world.state.containers[body] !== world.roomIds[refString(scene.on.rest.room)])
    return 'not_present';
  if (engaged(world, body) || running(world, actor) || pending(world, actor))
    return 'invalid_state';
}

export function bound(world: World, actor: CharacterId, scene: Dream, row: ChoiceRow) {
  const step = options(scene),
    quest = questOf(world, actor, scene.on.rest.quest);
  return (
    !!step &&
    !!quest &&
    row.actor_id === actor &&
    same(row.source, reference(world, scene)) &&
    row.beat === step.key &&
    same(row.roles, roles(world, actor, scene)) &&
    row.quest_instance_id === quest[0] &&
    same(
      row.choice_ids,
      step.choices.map((c) => c.choice_id),
    ) &&
    Number.isSafeInteger(row.opened_revision) &&
    row.opened_revision >= 0 &&
    row.attempts === undefined
  );
}

export function continueQuery(
  world: World,
  p: Extract<CommandPayload, { type: 'continue' }>,
  steps: Steps,
) {
  const scene = definition(world, p.scene);
  if (!scene) return 'invalid_state' as const;
  const code = safe(world, p.actor_id, scene, steps);
  if (code) return code;
  const index = value(world, p.actor_id, fact(world, scene)),
    count = scene.steps.length - 2;
  if (index !== p.line || index < 1 || index > count || scene.steps[index - 1].type === 'choice')
    return 'invalid_state' as const;
  const selected = choice(world, p.actor_id, scene);
  if (
    index === count &&
    (!selected ||
      selected[1].status !== 'resolved' ||
      !bound(world, p.actor_id, scene, selected[1]) ||
      !options(scene)?.choices.some((c) => c.choice_id === selected[1].choice_id))
  )
    return 'invalid_state' as const;
  return { scene, index, count, selected };
}

export function chooseQuery(
  world: World,
  p: Extract<CommandPayload, { type: 'choose' }>,
  steps: Steps,
) {
  const row = world.state.choices?.[p.continuation_id],
    scene = row && definition(world, row.source);
  if (!scene || !row || !p.dream || p.answer !== undefined || p.patrol !== undefined)
    return 'invalid_state' as const;
  const code = safe(world, p.actor_id, scene, steps);
  if (code) return code;
  if (
    value(world, p.actor_id, fact(world, scene)) !== p.dream.line ||
    row.status !== 'pending' ||
    !bound(world, p.actor_id, scene, row) ||
    !same(p.dream, draw(world, p.actor_id, scene, row)) ||
    !row.choice_ids.includes(p.choice_id)
  )
    return 'invalid_state' as const;
  return { scene, row };
}

export function line(world: World, actor: CharacterId, scene: Dream, index: number) {
  const step = scene.steps[index - 1];
  if (step?.type === 'narrate') return step.text;
  if (step?.type === 'choice') return step.prompt;
  const selected = choice(world, actor, scene)?.[1].choice_id;
  return options(scene)?.choices.find((c) => c.choice_id === selected)?.text;
}
