// The original Ring or Silence receipt that resolved the bell quest, with its exact facts.
import type {
  Command,
  DecisionResult,
  DefinitionRef,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { detailOf } from '../../../kernel/ts/src/commands/actions.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db } from './store.ts';

export const ref = (world: World, kind: string, key: string) =>
  ({
    cartridge_id: world.cartridge.manifest.id,
    cartridge_version: world.cartridge.manifest.version,
    kind,
    key,
  }) as DefinitionRef;

type Bell = {
  world: World;
  c: Command;
  d: Extract<DecisionResult, { kind: 'accepted' }>;
  q2: string;
  q3: string;
  lost: boolean;
  choice: 'prior' | 'fox';
  player: object;
  instance: object;
};

export function choiceReceipt(
  world: World,
  db: Db,
  scope: string,
  q3: string,
  q2: string,
  lost: boolean,
  choice: 'prior' | 'fox',
) {
  const rows = db.getAllSync<{
    command_id: string;
    actor_id: string;
    command: string;
    response: string;
  }>(
    'SELECT command_id, actor_id, command, response FROM receipt WHERE scope=? ORDER BY revision',
    scope,
  );
  const player = { kind: 'player', character_id: world.character };
  const instance = { kind: 'instance', world_context_id: world.context };
  return rows.some(({ command_id, actor_id, command, response }) => {
    const c: Command = JSON.parse(command);
    if (!bellCommand(world, c, command_id, actor_id, choice)) return false;
    const d: DecisionResult = JSON.parse(response);
    if (validate('DecisionResult', d).length || d.kind !== 'accepted') return false;
    return bellProof({ world, c, d, q2, q3, lost, choice, player, instance });
  });
}

function bellCommand(
  world: World,
  c: Command,
  command_id: string,
  actor_id: string,
  choice: 'prior' | 'fox',
) {
  const action = c.payload?.type === 'perform' ? c.payload.action : undefined;
  const recipe = Object.values(world.cartridge.recipes ?? {}).find((r) => r.key === action);
  const target = recipe && detailOf(world, recipe.target);
  return !(
    validate('Command', c).length ||
    c.id !== command_id ||
    actor_id !== world.character ||
    c.payload.type !== 'perform' ||
    c.payload.action !== (choice === 'prior' ? 'ring_bell' : 'silence_bell') ||
    c.payload.actor_id !== world.character ||
    c.world_context_id !== world.context ||
    !target ||
    (c.payload.target_id !== undefined && c.payload.target_id !== target) ||
    world.details[target]?.key !== 'bell' ||
    world.details[target]?.room !== world.roomIds[refString(ref(world, 'room', 'belfry'))]
  );
}

const assignedCount = ({ world, d }: Bell, name: string) =>
  d.delta.ops.filter((o) => o.op === 'fact.assign' && same(o.fact, ref(world, 'fact', name)))
    .length;
const assigned = ({ world, d }: Bell, name: string, old: unknown, next: unknown, at: object) =>
  d.delta.ops.some(
    (o) =>
      o.op === 'fact.assign' &&
      same(o.fact, ref(world, 'fact', name)) &&
      same(o.scope, at) &&
      same(o.expected, old) &&
      same(o.value, next),
  );
const terminal = ({ d }: Bell, id: string, from: string, to: string, outcome: string) =>
  d.delta.ops.some(
    (o) =>
      o.op === 'quest.transition' &&
      o.instance_id === id &&
      o.from === from &&
      o.to === to &&
      o.outcome === outcome,
  );
const changed = (
  { world, c, d }: Bell,
  name: string,
  old: unknown,
  next: unknown,
  at: object,
  cause: string,
) =>
  d.events.find(
    (e) =>
      e.payload.type === 'fact_changed' &&
      same(e.payload.fact, ref(world, 'fact', name)) &&
      same(e.scope, at) &&
      (e.actor_id === undefined
        ? name !== 'chapel_bell_rung' && name !== 'chapel_allegiance'
        : e.actor_id === world.character) &&
      e.world_context_id === world.context &&
      e.causation_id === cause &&
      e.correlation_id === (c.id as string) &&
      same(e.payload.old, old) &&
      same(e.payload.new, next),
  );

function bellProof(b: Bell) {
  const { world, c, d, q2, q3, lost, choice, player } = b;
  const q2Changed = d.delta.ops.some((o) => o.op === 'quest.transition' && o.instance_id === q2);
  const childChanged = d.delta.ops.some(
    (o) => o.op === 'fact.assign' && same(o.fact, ref(world, 'fact', 'village_child_status')),
  );
  const bell =
    choice === 'prior' ? changed(b, 'chapel_bell_rung', false, true, player, c.id) : undefined;
  const allegiance = changed(b, 'chapel_allegiance', 'unknown', choice, player, c.id);
  const resolved = resolvedEvent(b, bell?.id, allegiance?.id);
  return (
    (choice === 'fox' || (!!bell && bell.actor_id === world.character)) &&
    !!allegiance &&
    allegiance.actor_id === world.character &&
    !!resolved &&
    (choice === 'fox' || assigned(b, 'chapel_bell_rung', false, true, player)) &&
    assigned(b, 'chapel_allegiance', 'unknown', choice, player) &&
    assigned(b, choice === 'prior' ? 'scene_bell_rung' : 'scene_bell_silenced', 0, 1, player) &&
    terminal(b, q3, 'objectives_complete', 'resolved', choice) &&
    q2Changed === lost &&
    childChanged === lost &&
    (choice === 'prior' || silencedOnly(b)) &&
    lostProof(b, bell?.id) &&
    !!changed(
      b,
      choice === 'prior' ? 'scene_bell_rung' : 'scene_bell_silenced',
      0,
      1,
      player,
      resolved.id,
    ) &&
    !d.events.some((e) => e.payload.type === 'story_point_reached')
  );
}

const resolvedEvent = (
  { world, c, d, q3, choice, player }: Bell,
  bell: string | undefined,
  allegiance: string | undefined,
) =>
  d.events.find(
    (e) =>
      e.payload.type === 'quest_resolved' &&
      e.payload.instance_id === q3 &&
      same(e.payload.quest, ref(world, 'quest', 'bell_of_ashmere')) &&
      e.payload.outcome === choice &&
      e.actor_id === world.character &&
      same(e.scope, player) &&
      e.world_context_id === world.context &&
      e.causation_id === ((choice === 'prior' ? bell : allegiance) as string) &&
      e.correlation_id === (c.id as string),
  );

// Silencing assigns only the allegiance and its scene; it never rings or starts the rung scene.
const silencedOnly = (b: Bell) =>
  assignedCount(b, 'chapel_bell_rung') === 0 &&
  assignedCount(b, 'scene_bell_rung') === 0 &&
  assignedCount(b, 'chapel_allegiance') === 1 &&
  assignedCount(b, 'scene_bell_silenced') === 1 &&
  !b.d.events.some(
    (e) =>
      e.payload.type === 'fact_changed' &&
      (same(e.payload.fact, ref(b.world, 'fact', 'chapel_bell_rung')) ||
        same(e.payload.fact, ref(b.world, 'fact', 'scene_bell_rung'))),
  ) &&
  b.d.events.filter(
    (e) =>
      e.payload.type === 'fact_changed' &&
      same(e.payload.fact, ref(b.world, 'fact', 'scene_bell_silenced')),
  ).length === 1;

const lostProof = (b: Bell, bell: string | undefined) =>
  b.lost
    ? terminal(b, b.q2, 'active', 'failed', 'lost') &&
      assigned(b, 'village_child_status', 'missing', 'lost', b.instance) &&
      !!changed(b, 'village_child_status', 'missing', 'lost', b.instance, bell!)
    : true;
