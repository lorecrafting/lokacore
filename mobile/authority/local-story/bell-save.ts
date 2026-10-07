// The authored bell outcome must agree with its typed quest rows and original choice receipt.
import type {
  Command,
  DecisionResult,
  DefinitionRef,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { detailOf } from '../../../kernel/ts/src/commands/actions.ts';
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
  const allegiance = fact('chapel_allegiance');
  const scene = (name: string) => {
    const line = fact(name);
    const type = world.cartridge.facts[refString(ref(world, 'fact', name))]?.value_type;
    if (
      type?.type !== 'int' ||
      typeof line !== 'number' ||
      !Number.isSafeInteger(line) ||
      typeof type.minimum !== 'number' ||
      typeof type.maximum !== 'number' ||
      line < type.minimum ||
      line > type.maximum
    )
      invalid();
    return line as number;
  };
  const rungScene = scene('scene_bell_rung');
  const silentScene = scene('scene_bell_silenced');
  if (q3 && !q2) invalid();
  const lost = q2?.[1].state === 'failed' && q2[1].outcome === 'lost';
  if (rung) {
    if (
      allegiance !== 'prior' ||
      q3?.[1].state !== 'resolved' ||
      q3[1].outcome !== 'prior' ||
      rungScene === 0 ||
      silentScene !== 0 ||
      !q2
    )
      invalid();
  } else if (allegiance === 'fox') {
    if (
      q3?.[1].state !== 'resolved' ||
      q3[1].outcome !== 'fox' ||
      q2?.[1].state !== 'resolved' ||
      !['rescued', 'stays'].includes(q2[1].outcome ?? '') ||
      fact('village_child_status') !== q2[1].outcome ||
      rungScene !== 0 ||
      silentScene === 0
    )
      invalid();
  } else if (
    allegiance !== 'unknown' ||
    rungScene !== 0 ||
    silentScene !== 0 ||
    (q3 && q3[1].state !== 'active')
  )
    invalid();
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
  if (rung && !choiceReceipt(world, db, scope, q3![0], q2![0], lost, 'prior')) invalid();
  if (allegiance === 'fox' && !choiceReceipt(world, db, scope, q3![0], q2![0], false, 'fox'))
    invalid();
  return !!lost;
}

function choiceReceipt(
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
    const action = c.payload?.type === 'perform' ? c.payload.action : undefined;
    const recipe = Object.values(world.cartridge.recipes ?? {}).find((r) => r.key === action);
    const target = recipe && detailOf(world, recipe.target);
    if (
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
    )
      return false;
    const d: DecisionResult = JSON.parse(response);
    if (validate('DecisionResult', d).length || d.kind !== 'accepted') return false;
    const ops = d.delta.ops;
    const q2Changed = ops.some((o) => o.op === 'quest.transition' && o.instance_id === q2);
    const childChanged = ops.some(
      (o) => o.op === 'fact.assign' && same(o.fact, ref(world, 'fact', 'village_child_status')),
    );
    const assignedCount = (name: string) =>
      ops.filter((o) => o.op === 'fact.assign' && same(o.fact, ref(world, 'fact', name))).length;
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
          (e.actor_id === undefined
            ? name !== 'chapel_bell_rung' && name !== 'chapel_allegiance'
            : e.actor_id === world.character) &&
          e.world_context_id === world.context &&
          e.causation_id === cause &&
          e.correlation_id === (c.id as string) &&
          same(e.payload.old, old) &&
          same(e.payload.new, next),
      );
    const bell =
      choice === 'prior' ? changed('chapel_bell_rung', false, true, player, c.id) : undefined;
    const allegiance = changed('chapel_allegiance', 'unknown', choice, player, c.id);
    const resolved = d.events.find(
      (e) =>
        e.payload.type === 'quest_resolved' &&
        e.payload.instance_id === q3 &&
        same(e.payload.quest, ref(world, 'quest', 'bell_of_ashmere')) &&
        e.payload.outcome === choice &&
        e.actor_id === world.character &&
        same(e.scope, player) &&
        e.world_context_id === world.context &&
        e.causation_id === ((choice === 'prior' ? bell?.id : allegiance?.id) as string) &&
        e.correlation_id === (c.id as string),
    );
    return (
      (choice === 'fox' || (!!bell && bell.actor_id === world.character)) &&
      !!allegiance &&
      allegiance.actor_id === world.character &&
      !!resolved &&
      (choice === 'fox' || assigned('chapel_bell_rung', false, true, player)) &&
      assigned('chapel_allegiance', 'unknown', choice, player) &&
      assigned(choice === 'prior' ? 'scene_bell_rung' : 'scene_bell_silenced', 0, 1, player) &&
      terminal(q3, 'objectives_complete', 'resolved', choice) &&
      q2Changed === lost &&
      childChanged === lost &&
      (choice === 'prior' ||
        (assignedCount('chapel_bell_rung') === 0 &&
          assignedCount('scene_bell_rung') === 0 &&
          assignedCount('chapel_allegiance') === 1 &&
          assignedCount('scene_bell_silenced') === 1 &&
          !d.events.some(
            (e) =>
              e.payload.type === 'fact_changed' &&
              (same(e.payload.fact, ref(world, 'fact', 'chapel_bell_rung')) ||
                same(e.payload.fact, ref(world, 'fact', 'scene_bell_rung'))),
          ) &&
          d.events.filter(
            (e) =>
              e.payload.type === 'fact_changed' &&
              same(e.payload.fact, ref(world, 'fact', 'scene_bell_silenced')),
          ).length === 1)) &&
      (lost
        ? terminal(q2, 'active', 'failed', 'lost') &&
          assigned('village_child_status', 'missing', 'lost', instance) &&
          !!changed('village_child_status', 'missing', 'lost', instance, bell!.id)
        : true) &&
      !!changed(
        choice === 'prior' ? 'scene_bell_rung' : 'scene_bell_silenced',
        0,
        1,
        player,
        resolved.id,
      ) &&
      !d.events.some((e) => e.payload.type === 'story_point_reached')
    );
  });
}
