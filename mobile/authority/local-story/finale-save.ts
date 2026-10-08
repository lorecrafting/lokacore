// A3's five immutable Green outcomes must be evidenced by the original Begin and bound
// Continue receipts before their fact rows and local report can be admitted on cold open.
import type {
  Command,
  DecisionResult,
  StoryPointReport,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { questOf } from '../../../kernel/ts/src/mechanics/lookups.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import {
  checkBegin,
  checkBell,
  checkScene,
  invalid,
  ref,
  type Ctx,
  type Receipt,
  type Row,
} from './finale-receipts.ts';
import type { Db, Meta } from './store.ts';

const rows = [
  ['rescued', 'prior', 'stilled'],
  ['rescued', 'fox', 'free'],
  ['stays', 'prior', 'stilled'],
  ['stays', 'fox', 'free'],
  ['lost', 'prior', 'stilled'],
] as const;

const activeRows = ({ fact }: Ctx) => {
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
  return active;
};

const completions = (db: Db, meta: Meta) => {
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
  return reports.flatMap((r) => {
    const report = JSON.parse(r.report) as StoryPointReport;
    if (validate('StoryPointReport', report).length) invalid();
    return report.run_id === meta.run_id && report.story_point === 'prologue_completed'
      ? [{ ...r, report }]
      : [];
  });
};

const acceptedReceipts = (db: Db, scope: string, actor: string): Receipt[] => {
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
  return receiptRows.flatMap((r) => {
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
};

const checkQuests = ({ world, actor, fact }: Ctx, selected: Row) => {
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
      Object.values(world.state.choices ?? {}).some(
        (c) => c.source.kind === 'dialogue' && c.status === 'pending',
      ) ||
      Object.values(world.state.encounters ?? {}).some((e) => e.status === 'open'))
  )
    invalid();
};

const checkOrder = (proof: Receipt[], head: number) => {
  if (
    proof.some(
      (receipt, i) =>
        !Number.isSafeInteger(receipt.revision) ||
        receipt.revision < 1 ||
        receipt.revision > head ||
        (i > 0 && receipt.revision <= proof[i - 1]!.revision),
    )
  )
    invalid();
};

type Completion = ReturnType<typeof completions>;

const checkCompletion = (
  meta: Meta,
  selected: Row,
  outcome: string,
  marker: unknown,
  memories: unknown[],
  completion: Completion,
  last: Receipt,
) => {
  if (selected.line === -1) {
    if (
      marker !== outcome ||
      !same(memories, [selected.child, selected.fox, selected.bell]) ||
      completion.length !== 1 ||
      completion[0]!.lineage_id !== meta.lineage_id ||
      completion[0]!.binding !== meta.binding ||
      completion[0]!.report_id !== completion[0]!.report.report_id ||
      completion[0]!.report.run_id !== meta.run_id ||
      completion[0]!.report.observed_revision !== last.revision ||
      completion[0]!.report.outcome !== outcome ||
      completion[0]!.report.release.cartridge_id !== meta.pin.cartridge_id ||
      completion[0]!.report.release.cartridge_version !== meta.pin.cartridge_version ||
      completion[0]!.report.release.cartridge_hash !== meta.pin.content_hash
    )
      invalid();
  } else if (marker !== 'unreached' || memories.some((m) => m !== 'unreached') || completion.length)
    invalid();
};

export function finaleSave(world: World, db: Db, meta: Meta, head: number) {
  if (
    !Object.values(world.cartridge.story_points ?? {}).some((p) => p.key === 'prologue_completed')
  )
    return;
  const actor = world.character;
  const fact = (name: string) => value(world, actor, ref(world, 'fact', name));
  const ctx: Ctx = { world, actor, fact };
  const marker = fact('story_point_prologue_completed');
  const memories = [
    fact('memory_village_ending'),
    fact('memory_fox_fate'),
    fact('memory_chapter_1_guild_tilt'),
  ];
  const active = activeRows(ctx);
  const completion = completions(db, meta);
  const receipts = acceptedReceipts(db, `story/${meta.lineage_id}/${actor}`, actor);
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
  checkQuests(ctx, selected);
  const begin = checkBegin(ctx, selected, finaleBegins);
  const bell = checkBell(ctx, selected, receipts);
  const continues = checkScene(ctx, selected, receipts, outcome);
  checkOrder([...bell, begin, ...continues], head);
  checkCompletion(meta, selected, outcome, marker, memories, completion, continues[2]!);
}
