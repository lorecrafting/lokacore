// The authored bell outcome must agree with its typed quest rows and original Ring receipt.
import type {
  Command,
  DecisionResult,
  DefinitionRef,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { questOf } from '../../../kernel/ts/src/mechanics/lookups.ts';
import { refString, type ChoiceRow, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db } from './store.ts';

const invalid = () => {
  throw new SyntaxError('malformed JSON: inconsistent bell return');
};

export function bellSave(world: World, db: Db, scope: string, rows: [string, ChoiceRow][]) {
  if (!Object.values(world.cartridge.quests ?? {}).some((q) => q.key === 'bell_of_ashmere'))
    return false;
  const ref = (kind: string, key: string) =>
    ({
      cartridge_id: world.cartridge.manifest.id,
      cartridge_version: world.cartridge.manifest.version,
      kind,
      key,
    }) as DefinitionRef;
  const fact = (key: string) => value(world, world.character, ref('fact', key));
  const q3 = questOf(world, world.character, ref('quest', 'bell_of_ashmere'));
  const q2 = questOf(world, world.character, ref('quest', 'missing_child'));
  const rung = fact('chapel_bell_rung');
  const prior = fact('chapel_allegiance');
  const scene = fact('scene_bell_rung');
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
  if (rung && !ringReceipt(world, db, scope, q3![0], lost ? q2![0] : undefined)) invalid();
  return !!lost;
}

function ringReceipt(world: World, db: Db, scope: string, q3: string, q2?: string) {
  const rows = db.getAllSync<{ command: string; response: string }>(
    'SELECT command, response FROM receipt WHERE scope=? ORDER BY revision',
    scope,
  );
  return rows.some(({ command, response }) => {
    const c: Command = JSON.parse(command);
    if (
      validate('Command', c).length ||
      c.payload.type !== 'perform' ||
      c.payload.action !== 'ring_bell' ||
      c.payload.actor_id !== world.character ||
      c.world_context_id !== world.context
    )
      return false;
    const d: DecisionResult = JSON.parse(response);
    if (validate('DecisionResult', d).length || d.kind !== 'accepted') return false;
    const ops = d.delta.ops;
    const assigned = (name: string, next: unknown) =>
      ops.some((o) => o.op === 'fact.assign' && o.fact.key === name && o.value === next);
    const terminal = (id: string, to: string, outcome: string) =>
      ops.some(
        (o) =>
          o.op === 'quest.transition' &&
          o.instance_id === id &&
          o.to === to &&
          o.outcome === outcome,
      );
    return (
      assigned('chapel_bell_rung', true) &&
      assigned('chapel_allegiance', 'prior') &&
      assigned('scene_bell_rung', 1) &&
      terminal(q3, 'resolved', 'prior') &&
      (q2 ? terminal(q2, 'failed', 'lost') && assigned('village_child_status', 'lost') : true) &&
      d.events.some(
        (e) =>
          e.payload.type === 'quest_resolved' &&
          e.payload.instance_id === q3 &&
          e.payload.outcome === 'prior',
      ) &&
      !d.events.some((e) => e.payload.type === 'story_point_reached')
    );
  });
}
