// The authored bell outcome must agree with its typed quest rows and original Ring receipt.
import type {
  Command,
  DecisionResult,
  DefinitionRef,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { questOf } from '../../../kernel/ts/src/mechanics/lookups.ts';
import { refString, type ChoiceRow, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db } from './store.ts';

const invalid = () => {
  throw new SyntaxError('malformed JSON: inconsistent bell return');
};

const ref = (world: World, kind: string, key: string) =>
  ({
    cartridge_id: world.cartridge.manifest.id,
    cartridge_version: world.cartridge.manifest.version,
    kind,
    key,
  }) as DefinitionRef;

export function bellSave(world: World, db: Db, scope: string, rows: [string, ChoiceRow][]) {
  if (!Object.values(world.cartridge.quests ?? {}).some((q) => q.key === 'bell_of_ashmere'))
    return false;
  const fact = (key: string) => value(world, world.character, ref(world, 'fact', key));
  const q3 = questOf(world, world.character, ref(world, 'quest', 'bell_of_ashmere'));
  const q2 = questOf(world, world.character, ref(world, 'quest', 'missing_child'));
  const rung = fact('chapel_bell_rung');
  const prior = fact('chapel_allegiance');
  const scene = fact('scene_bell_rung');
  const sceneType =
    world.cartridge.facts[refString(ref(world, 'fact', 'scene_bell_rung'))]?.value_type;
  if (
    sceneType?.type !== 'int' ||
    typeof scene !== 'number' ||
    !Number.isSafeInteger(scene) ||
    typeof sceneType.minimum !== 'number' ||
    typeof sceneType.maximum !== 'number' ||
    scene < sceneType.minimum ||
    scene > sceneType.maximum ||
    (q3 && !q2)
  )
    invalid();
  const lost = q2?.[1].state === 'failed' && q2[1].outcome === 'lost';
  if (rung) {
    if (
      prior !== 'prior' ||
      q3?.[1].state !== 'resolved' ||
      q3[1].outcome !== 'prior' ||
      scene === 0 ||
      !q2
    )
      invalid();
  } else if (prior !== 'unknown' || scene !== 0 || (q3 && q3[1].state !== 'active')) invalid();
  if (q3 && !['active', 'resolved'].includes(q3[1].state)) invalid();
  if (lost) {
    if (
      !rung ||
      fact('village_child_status') !== 'lost' ||
      fact('fen_wren_met') !== false ||
      fact('fen_return_branch') !== 'unselected' ||
      Object.keys(world.state.escorts ?? {}).length ||
      rows.some(
        ([, row]) =>
          row.status === 'resolved' &&
          world.cartridge.dialogues?.[refString(row.source)]?.choices[
            row.choice_id!
          ]?.sequence?.some(
            (s) => s.op === 'fact.assign' && s.fact.key === 'fen_wren_met' && s.value === true,
          ),
      )
    )
      invalid();
  } else if (
    fact('village_child_status') === 'lost' ||
    q2?.[1].state === 'failed' ||
    (rung && q2?.[1].state === 'active' && fact('fen_wren_met') === false)
  )
    invalid();
  if (rung && !ringReceipt(world, db, scope, q3![0], q2![0], lost)) invalid();
  return !!lost;
}

function ringReceipt(world: World, db: Db, scope: string, q3: string, q2: string, lost: boolean) {
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
    if (
      validate('Command', c).length ||
      c.id !== command_id ||
      actor_id !== world.character ||
      c.payload.type !== 'perform' ||
      c.payload.action !== 'ring_bell' ||
      c.payload.actor_id !== world.character ||
      c.world_context_id !== world.context ||
      world.details[c.payload.target_id!]?.key !== 'bell' ||
      world.details[c.payload.target_id!]?.room !==
        world.roomIds[refString(ref(world, 'room', 'belfry'))]
    )
      return false;
    const d: DecisionResult = JSON.parse(response);
    if (validate('DecisionResult', d).length || d.kind !== 'accepted') return false;
    const ops = d.delta.ops;
    const q2Changed = ops.some((o) => o.op === 'quest.transition' && o.instance_id === q2);
    const childChanged = ops.some(
      (o) => o.op === 'fact.assign' && same(o.fact, ref(world, 'fact', 'village_child_status')),
    );
    const assigned = (name: string, old: unknown, next: unknown, at: object) =>
      ops.some(
        (o) =>
          o.op === 'fact.assign' &&
          same(o.fact, ref(world, 'fact', name)) &&
          same(o.scope, at) &&
          same(o.expected, old) &&
          same(o.value, next),
      );
    const terminal = (id: string, from: string, to: string, outcome: string) =>
      ops.some(
        (o) =>
          o.op === 'quest.transition' &&
          o.instance_id === id &&
          o.from === from &&
          o.to === to &&
          o.outcome === outcome,
      );
    const changed = (name: string, old: unknown, next: unknown, at: object, cause: string) =>
      d.events.find(
        (e) =>
          e.payload.type === 'fact_changed' &&
          same(e.payload.fact, ref(world, 'fact', name)) &&
          same(e.scope, at) &&
          e.world_context_id === world.context &&
          e.causation_id === cause &&
          e.correlation_id === (c.id as string) &&
          same(e.payload.old, old) &&
          same(e.payload.new, next),
      );
    const bell = changed('chapel_bell_rung', false, true, player, c.id);
    const allegiance = changed('chapel_allegiance', 'unknown', 'prior', player, c.id);
    const resolved = d.events.find(
      (e) =>
        e.payload.type === 'quest_resolved' &&
        e.payload.instance_id === q3 &&
        same(e.payload.quest, ref(world, 'quest', 'bell_of_ashmere')) &&
        e.payload.outcome === 'prior' &&
        e.actor_id === world.character &&
        same(e.scope, player) &&
        e.world_context_id === world.context &&
        e.causation_id === (bell?.id as string | undefined) &&
        e.correlation_id === (c.id as string),
    );
    return (
      !!bell &&
      bell.actor_id === world.character &&
      !!allegiance &&
      allegiance.actor_id === world.character &&
      !!resolved &&
      assigned('chapel_bell_rung', false, true, player) &&
      assigned('chapel_allegiance', 'unknown', 'prior', player) &&
      assigned('scene_bell_rung', 0, 1, player) &&
      terminal(q3, 'objectives_complete', 'resolved', 'prior') &&
      q2Changed === lost &&
      childChanged === lost &&
      (lost
        ? terminal(q2, 'active', 'failed', 'lost') &&
          assigned('village_child_status', 'missing', 'lost', instance) &&
          !!changed('village_child_status', 'missing', 'lost', instance, bell.id)
        : true) &&
      !!changed('scene_bell_rung', 0, 1, player, resolved.id) &&
      !d.events.some((e) => e.payload.type === 'story_point_reached')
    );
  });
}
