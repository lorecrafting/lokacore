// The original Begin, bell and finale Continue receipts that a Green outcome must be bound to.
import type {
  Command,
  DecisionResult,
  DefinitionRef,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';

export const invalid = (): never => {
  throw new SyntaxError('malformed JSON: inconsistent Green finale');
};
export const ref = (world: World, kind: string, key: string) =>
  ({
    cartridge_id: world.cartridge.manifest.id,
    cartridge_version: world.cartridge.manifest.version,
    kind,
    key,
  }) as DefinitionRef;

export type Accepted = DecisionResult & { kind: 'accepted' };
export type Receipt = { command: Command; decision: Accepted; revision: number };
export type Row = { child: string; bell: string; fox: string; name: string; line: number };
export type Ctx = { world: World; actor: World['character']; fact: (name: string) => unknown };

const assignment = (
  { world, actor }: Ctx,
  d: Accepted,
  name: string,
  old: unknown,
  next: unknown,
) =>
  d.delta.ops.filter(
    (o) =>
      o.op === 'fact.assign' &&
      same(o.fact, ref(world, 'fact', name)) &&
      same(o.scope, { kind: 'player', character_id: actor }) &&
      same(o.expected, old) &&
      same(o.value, next),
  ).length === 1;
const noExport = (d: Accepted) =>
  !d.delta.ops.some(
    (o) =>
      o.op === 'fact.assign' &&
      [
        'memory_village_ending',
        'memory_fox_fate',
        'memory_chapter_1_guild_tilt',
        'story_point_prologue_completed',
      ].includes(o.fact.key),
  ) && !d.events.some((e) => e.payload.type === 'story_point_reached');

export const checkBegin = (ctx: Ctx, selected: Row, finaleBegins: Receipt[]) => {
  const { world, actor } = ctx;
  const action = `begin_${selected.name}`;
  if (
    finaleBegins.length !== 1 ||
    finaleBegins[0]!.command.payload.type !== 'perform' ||
    finaleBegins[0]!.command.payload.action !== action
  )
    invalid();
  const begin = finaleBegins[0]!;
  const detail = Object.keys(world.details).find(
    (id) =>
      world.details[id].key === 'market_cross' &&
      world.details[id].room === world.roomIds[refString(ref(world, 'room', 'village_green'))],
  );
  if (
    !detail ||
    begin.command.world_context_id !== world.context ||
    begin.command.payload.type !== 'perform' ||
    begin.command.payload.actor_id !== actor ||
    (begin.command.payload.target_id !== undefined && begin.command.payload.target_id !== detail) ||
    !assignment(ctx, begin.decision, `scene_${selected.name}`, 0, 1) ||
    !noExport(begin.decision) ||
    !begin.decision.events.some(
      (e) =>
        e.payload.type === 'action_completed' &&
        e.payload.action === action &&
        e.payload.subject_id === detail &&
        e.actor_id === actor &&
        (e.correlation_id as string) === begin.command.id,
    )
  )
    invalid();
  return begin;
};

const checkBellLines = (ctx: Ctx, continues: Receipt[], name: string, count: number) => {
  for (let i = 0; i < count; i++) {
    const { command, decision } = continues[i]!;
    if (
      command.payload.type !== 'continue' ||
      command.payload.actor_id !== ctx.actor ||
      command.world_context_id !== ctx.world.context ||
      command.payload.line !== i + 1 ||
      !assignment(ctx, decision, `scene_${name}`, i + 1, i === count - 1 ? -1 : i + 2)
    )
      invalid();
  }
};

export const checkBell = (ctx: Ctx, selected: Row, receipts: Receipt[]) => {
  const { world, actor } = ctx;
  const bellName = selected.bell === 'prior' ? 'bell_rung' : 'bell_silenced';
  const bellScene = ref(world, 'scene', bellName);
  const bellAction = selected.bell === 'prior' ? 'ring_bell' : 'silence_bell';
  const bellStarts = receipts.filter(
    ({ command: c }) => c.payload.type === 'perform' && c.payload.action === bellAction,
  );
  const bellContinues = receipts.filter(
    ({ command: c }) => c.payload.type === 'continue' && same(c.payload.scene, bellScene),
  );
  const bellLines = selected.bell === 'prior' ? 3 : 2;
  if (
    bellStarts.length !== 1 ||
    !assignment(ctx, bellStarts[0]!.decision, `scene_${bellName}`, 0, 1) ||
    bellContinues.length !== bellLines
  )
    invalid();
  checkBellLines(ctx, bellContinues, bellName, bellLines);
  if (
    bellContinues[bellLines - 1]!.decision.events.filter(
      (e) =>
        e.payload.type === 'scene_ended' &&
        same(e.payload.scene, bellScene) &&
        e.actor_id === actor &&
        e.world_context_id === world.context &&
        e.correlation_id === (bellContinues[bellLines - 1]!.command.id as string),
    ).length !== 1
  )
    invalid();
  return [bellStarts[0]!, ...bellContinues];
};

export const checkScene = (ctx: Ctx, selected: Row, receipts: Receipt[], outcome: string) => {
  const { world } = ctx;
  const scene = ref(world, 'scene', selected.name);
  const continues = receipts.filter(
    ({ command: c }) => c.payload.type === 'continue' && same(c.payload.scene, scene),
  );
  const count = selected.line === -1 ? 3 : selected.line - 1;
  if (continues.length !== count) invalid();
  for (let i = 0; i < count; i++) {
    const { command, decision } = continues[i]!;
    if (
      command.payload.type !== 'continue' ||
      command.payload.actor_id !== ctx.actor ||
      command.world_context_id !== world.context ||
      command.payload.line !== i + 1 ||
      !assignment(ctx, decision, `scene_${selected.name}`, i + 1, i === 2 ? -1 : i + 2)
    )
      invalid();
    if (i < 2 && !noExport(decision)) invalid();
    if (i === 2) checkExport(ctx, selected, decision, scene, outcome);
  }
  return continues;
};

const checkExport = (
  ctx: Ctx,
  selected: Row,
  decision: Accepted,
  scene: DefinitionRef,
  outcome: string,
) => {
  if (
    !assignment(ctx, decision, 'memory_village_ending', 'unreached', selected.child) ||
    !assignment(ctx, decision, 'memory_fox_fate', 'unreached', selected.fox) ||
    !assignment(ctx, decision, 'memory_chapter_1_guild_tilt', 'unreached', selected.bell) ||
    !assignment(ctx, decision, 'story_point_prologue_completed', 'unreached', outcome) ||
    decision.events.filter((e) => e.payload.type === 'scene_ended' && same(e.payload.scene, scene))
      .length !== 1 ||
    decision.events.filter(
      (e) =>
        e.payload.type === 'story_point_reached' &&
        same(e.payload.story_point, ref(ctx.world, 'story_point', 'prologue_completed')) &&
        e.payload.outcome === outcome,
    ).length !== 1
  )
    invalid();
};
