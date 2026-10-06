// Bed-local projection; eligibility is shared with direct invocation and never runs a decision.
import type { AdvertisedAction, CommandPayload, DreamView, Key } from '../contracts.gen.ts';
import { refusal, resolved, type Offered } from '../commands/actions.ts';
import { KernelError } from '../foundation/error.ts';
import { refString, type World, type Steps } from '../runtime/decision.ts';
import { value } from '../mechanics/fact.ts';
import { fact } from '../mechanics/scene/shared.ts';
import {
  safe,
  choice,
  options,
  draw,
  line,
  reference,
  continueQuery,
  chooseQuery,
  type Dream,
} from '../mechanics/scene/dream_shared.ts';

export function dreamView(
  world: World,
  detail: World['details'][string],
  steps: Steps,
): DreamView | undefined {
  const scene = Object.values(world.cartridge.scenes ?? {}).find(
    (s): s is Dream =>
      s.control === 'presentation_only' &&
      world.roomIds[refString(s.on.rest.room)] === detail.room &&
      s.on.rest.detail === detail.key,
  );
  if (!scene) return;
  const index = value(world, world.character, fact(world, scene));
  if (typeof index !== 'number' || index === 0) return;
  const shown = line(world, world.character, scene, index);
  if (!shown) throw new KernelError('precondition_failed');
  const code = safe(world, world.character, scene, steps);
  if (code === 'budget_exceeded') throw new KernelError(code);
  const row = choice(world, world.character, scene)?.[1];
  const view = {
    scene: reference(world, scene),
    title: scene.title,
    description: scene.description,
    index,
    count: scene.steps.length - 2,
    line: shown,
    available: !code && index > 0,
    ...(row?.choice_id && { branch: row.choice_id }),
    ...(code && { reason: { code } }),
  };
  if (code || index < 0) return view;
  return { ...view, ...controls(world, scene, index, steps) };
}

function controls(world: World, scene: Dream, index: number, steps: Steps) {
  const set = Object.values(resolved(world, world.character));
  if (index !== 4) {
    const action = set.find((a) => a.command === 'continue');
    if (!action) return {};
    const p = {
      type: 'continue',
      actor_id: world.character,
      scene: reference(world, scene),
      line: index,
    } as const;
    return { action: offered(world, action, p, steps) };
  }
  return choices(world, scene, set, steps);
}

function choices(world: World, scene: Dream, set: Offered[], steps: Steps) {
  const selected = choice(world, world.character, scene),
    action = set.find((a) => a.command === 'choose' && a.input.includes('dream'));
  if (!selected || !action) return {};
  const current = draw(world, world.character, scene, selected[1]);
  return {
    choice: {
      continuation_id: selected[0],
      prompt: { key: options(scene)!.prompt },
      closable: false,
      choices: options(scene)!.choices.map((option) => {
        const p = {
          type: 'choose',
          actor_id: world.character,
          continuation_id: selected[0],
          choice_id: option.choice_id,
          dream: current,
        } as const;
        const result = offered(world, action, p, steps);
        return {
          choice_id: option.choice_id,
          label: option.label,
          action_key: action.key,
          dream: current,
          ...(result.available
            ? { available: true as const }
            : { available: false as const, reason: result.reason }),
        };
      }),
    },
  };
}

function offered(
  world: World,
  action: Offered,
  p: Extract<CommandPayload, { type: 'continue' | 'choose' }>,
  steps: Steps,
): AdvertisedAction {
  const blocked = refusal(world, p, steps, action.key);
  const queried =
    blocked ??
    (p.type === 'continue' ? continueQuery(world, p, steps) : chooseQuery(world, p, steps));
  const code = typeof queried === 'string' ? queried : undefined;
  if (code === 'budget_exceeded' || code === 'precondition_failed') throw new KernelError(code);
  const base = {
    action_key: action.key,
    command: action.command,
    label: action.label,
    target: action.target,
    target_ids: [],
    input: action.input,
  };
  return code ? { ...base, available: false, reason: { code } } : { ...base, available: true };
}
