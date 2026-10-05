// A3's five immutable Green outcomes must be evidenced by the original Begin and bound
// Continue receipts before their fact rows and local report can be admitted on cold open.
import type {
  Command,
  DecisionResult,
  DefinitionRef,
  StoryPointReport,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { questOf } from '../../../kernel/ts/src/mechanics/lookups.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db, Meta } from './store.ts';

const rows = [
  ['rescued', 'prior', 'stilled'],
  ['rescued', 'fox', 'free'],
  ['stays', 'prior', 'stilled'],
  ['stays', 'fox', 'free'],
  ['lost', 'prior', 'stilled'],
] as const;
const invalid = (): never => {
  throw new SyntaxError('malformed JSON: inconsistent Green finale');
};
const ref = (world: World, kind: string, key: string) =>
  ({
    cartridge_id: world.cartridge.manifest.id,
    cartridge_version: world.cartridge.manifest.version,
    kind,
    key,
  }) as DefinitionRef;

export function finaleSave(world: World, db: Db, meta: Meta) {
  if (
    !Object.values(world.cartridge.story_points ?? {}).some((p) => p.key === 'prologue_completed')
  )
    return;
  const actor = world.character;
  const fact = (name: string) => value(world, actor, ref(world, 'fact', name));
  const marker = fact('story_point_prologue_completed');
  const memories = [
    fact('memory_village_ending'),
    fact('memory_fox_fate'),
    fact('memory_chapter_1_guild_tilt'),
  ];
  const active = rows.flatMap(([child, bell, fox]) => {
    const name = `epilogue_${child}_${bell}`;
    const line = fact(`scene_${name}`);
    if (
      typeof line !== 'number' ||
      !Number.isInteger(line) ||
      (line !== -1 && (line < 0 || line > 3))
    )
      invalid();
    return line === 0 ? [] : [{ child, bell, fox, name, line: line as number }];
  });
  if (active.length > 1) invalid();
  const scope = `story/${meta.lineage_id}/${actor}`;
  const reports = db.getAllSync<{
    report_id: string;
    lineage_id: string;
    binding: string | null;
    report: string;
    disposition: string;
  }>(
    'SELECT report_id,lineage_id,binding,report,disposition FROM report WHERE lineage_id=?',
    meta.lineage_id,
  );
  const completion = reports.flatMap((r) => {
    const report = JSON.parse(r.report) as StoryPointReport;
    if (validate('StoryPointReport', report).length) invalid();
    return report.run_id === meta.run_id && report.story_point === 'prologue_completed'
      ? [{ ...r, report }]
      : [];
  });
  const receiptRows = db.getAllSync<{
    command_id: string;
    actor_id: string;
    revision: number;
    command: string;
    response: string;
  }>(
    'SELECT command_id,actor_id,revision,command,response FROM receipt WHERE scope=? ORDER BY revision',
    scope,
  );
  const receipts = receiptRows.flatMap((r) => {
    if (r.command === 'null') return [];
    const command = JSON.parse(r.command) as Command;
    const decision = JSON.parse(r.response) as DecisionResult;
    if (
      validate('Command', command).length ||
      validate('DecisionResult', decision).length ||
      command.id !== r.command_id ||
      r.actor_id !== actor
    )
      invalid();
    return decision.kind === 'accepted' ? [{ command, decision, revision: r.revision }] : [];
  });
  const finaleBegins = receipts.filter(
    ({ command: c }) =>
      c.payload.type === 'perform' && c.payload.action?.startsWith('begin_epilogue_'),
  );
  if (!active.length) {
    if (
      marker !== 'unreached' ||
      memories.some((m) => m !== 'unreached') ||
      completion.length ||
      finaleBegins.length
    )
      invalid();
    return;
  }
  const selected = active[0]!;
  const outcome = `${selected.child}_${selected.bell}`;
  const q2 = questOf(world, actor, ref(world, 'quest', 'missing_child'))?.[1];
  const q3 = questOf(world, actor, ref(world, 'quest', 'bell_of_ashmere'))?.[1];
  if (
    q2?.state !== (selected.child === 'lost' ? 'failed' : 'resolved') ||
    q2.outcome !== selected.child ||
    q3?.state !== 'resolved' ||
    q3.outcome !== selected.bell ||
    fact('village_child_status') !== selected.child ||
    fact('chapel_allegiance') !== selected.bell ||
    fact('chapel_bell_rung') !== (selected.bell === 'prior') ||
    fact(`scene_bell_${selected.bell === 'prior' ? 'rung' : 'silenced'}`) !== -1
  )
    invalid();
  if (
    selected.line > 0 &&
    (world.state.containers[world.body] !==
      world.roomIds[refString(ref(world, 'room', 'village_green'))] ||
      Object.values(world.state.choices ?? {}).some((c) => c.status === 'pending') ||
      Object.values(world.state.encounters ?? {}).some((e) => e.status === 'open'))
  )
    invalid();
  const named = (name: string) => ref(world, 'fact', name);
  const assignment = (
    d: DecisionResult & { kind: 'accepted' },
    name: string,
    old: unknown,
    next: unknown,
  ) =>
    d.delta.ops.filter(
      (o) =>
        o.op === 'fact.assign' &&
        same(o.fact, named(name)) &&
        same(o.scope, { kind: 'player', character_id: actor }) &&
        same(o.expected, old) &&
        same(o.value, next),
    ).length === 1;
  const noExport = (d: DecisionResult & { kind: 'accepted' }) =>
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
    !assignment(begin.decision, `scene_${selected.name}`, 0, 1) ||
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
      command.payload.actor_id !== actor ||
      command.world_context_id !== world.context ||
      command.payload.line !== i + 1 ||
      !assignment(decision, `scene_${selected.name}`, i + 1, i === 2 ? -1 : i + 2)
    )
      invalid();
    if (i < 2 && !noExport(decision)) invalid();
    if (i === 2) {
      if (
        !assignment(decision, 'memory_village_ending', 'unreached', selected.child) ||
        !assignment(decision, 'memory_fox_fate', 'unreached', selected.fox) ||
        !assignment(decision, 'memory_chapter_1_guild_tilt', 'unreached', selected.bell) ||
        !assignment(decision, 'story_point_prologue_completed', 'unreached', outcome) ||
        decision.events.filter(
          (e) => e.payload.type === 'scene_ended' && same(e.payload.scene, scene),
        ).length !== 1 ||
        decision.events.filter(
          (e) =>
            e.payload.type === 'story_point_reached' &&
            same(e.payload.story_point, ref(world, 'story_point', 'prologue_completed')) &&
            e.payload.outcome === outcome,
        ).length !== 1
      )
        invalid();
    }
  }
  if (selected.line === -1) {
    if (
      marker !== outcome ||
      !same(memories, [selected.child, selected.fox, selected.bell]) ||
      completion.length !== 1 ||
      completion[0]!.lineage_id !== meta.lineage_id ||
      completion[0]!.binding !== meta.binding ||
      completion[0]!.report_id !== completion[0]!.report.report_id ||
      completion[0]!.report.run_id !== meta.run_id ||
      completion[0]!.report.observed_revision !== continues[2]!.revision ||
      completion[0]!.report.outcome !== outcome ||
      completion[0]!.report.release.cartridge_id !== meta.pin.cartridge_id ||
      completion[0]!.report.release.cartridge_version !== meta.pin.cartridge_version ||
      completion[0]!.report.release.cartridge_hash !== meta.pin.content_hash
    )
      invalid();
  } else if (marker !== 'unreached' || memories.some((m) => m !== 'unreached') || completion.length)
    invalid();
}
