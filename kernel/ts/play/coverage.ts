// `node kernel/ts/play/coverage.ts <artifact> [<transcript.jsonl> ...]`
// (docs/system/cartridge.md#transcript-coverage-loka-kgd1942): replays a cartridge's transcripts
// and prints the reactions, recipes, dialogue choices and quests none of them exercises, as one
// canonical JSON document. A report for authors, not a check.
import { existsSync, globSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { DecisionResult } from '../src/contracts.gen.ts';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { refString } from '../src/runtime/decision.ts';
import { line, ROOT } from './obs.ts';
import { replayRecords } from './replay.ts';
import { decideReplay, header, start } from './run.ts';

type Trace = ReturnType<typeof replayRecords>;
const MARK = /^coverage\.m(\d+)$/;

/**
 * A copy of `c` whose every reaction ends with a `narrate` of a key unique to it, and the map
 * back. No committed event names its reaction (mechanics/reaction.ts:144-146), but a narrate step
 * (reaction.ts:188) reaches the decision's narration (runtime/proposal.ts:242, :276) only when the
 * `when` held (:152) and the steps ran; narration never enters state (proposal_adopt.ts:39-51).
 */
export function marked(c: Cartridge) {
  const clash = Object.keys(c.text ?? {}).find((k) => MARK.test(k));
  if (clash) throw new Error(`authored text key ${clash} collides with a coverage marker`);
  const refs = Object.keys(c.reactions ?? {});
  const reactions = Object.fromEntries(
    refs.map((ref, i) => {
      const r = c.reactions![ref]!;
      return [ref, { ...r, apply: [...r.apply, { op: 'narrate', text: `coverage.m${i}` }] }];
    }),
  );
  const ruleOf = (key: string) => refs[Number(MARK.exec(key)?.[1] ?? NaN)];
  return { cartridge: { ...c, reactions } as Cartridge, ruleOf };
}

/**
 * Replays `trace` against `c` from the trace head's own ids, comparing the header and each
 * produced line with the recorded line at its ordinal; `each` sees the world before each step.
 * Stops before ordinal `upTo` without comparing it.
 */
export function replay(
  c: Cartridge,
  trace: Trace,
  each?: (before: World, d: DecisionResult, ordinal: number) => void,
  upTo?: number,
) {
  const { head, entries } = trace;
  const recorded = trace.file.split('\n');
  const r = start(
    c,
    head.ids.content_hash,
    head.ids.run_id,
    head.data.world_context_id,
    head.ids.seed,
    head.ids.kernel_version,
  );
  const differs = (n: number) => new Error(`replay differs at ordinal ${n}`);
  if (header(r) !== `${recorded[0]}\n`) throw differs(0);
  for (const e of entries) {
    if (e.data.ordinal === upTo) return;
    const before = r.world;
    const { trace: t, decision } = decideReplay(r, e.data.command);
    if (line(t) !== `${recorded[r.ordinal]}\n`) throw differs(r.ordinal);
    each?.(before, decision, r.ordinal);
  }
}

/** The definitions no trace exercises (cartridge.md Transcript coverage lists the evidence). */
export function coverage(c: Cartridge, traces: Trace[]) {
  const { cartridge, ruleOf } = marked(c);
  const seen = new Set<string>();
  const done = new Set<string>(); // completed recipe keys
  traces.forEach((t, i) => {
    try {
      replay(cartridge, t, (before, d, n) => {
        if (d.kind !== 'accepted') return;
        // closing() (mechanics/death/lines.ts:22) cuts narration to 64 lines: a cut marker is unknown
        if ((d.narration?.length ?? 0) >= 64)
          throw new Error(`narration cap reached at ordinal ${n}`);
        for (const n of d.narration ?? []) seen.add(ruleOf(n.key) ?? '');
        for (const { payload: p } of d.events) {
          // action_recipe/rule.ts:78 (action = recipe.key), :99-101 (none on failure)
          if (p.type === 'action_completed') done.add(p.action);
          if (p.type === 'quest_resolved') seen.add(refString(p.quest)); // quest/lifecycle.ts:261
          if (p.type !== 'choice_resolved') continue;
          // dialogue/rule.ts:53-57, :137-138: the row's source names its dialogue or scene
          const row = before.state.choices?.[p.continuation_id];
          if (row?.source.kind === 'dialogue') seen.add(`${refString(row.source)}#${p.choice_id}`);
        }
      });
    } catch (e) {
      throw new Error((e as Error).message, { cause: i });
    }
  });
  const unseen = (refs: string[]) => refs.filter((ref) => !seen.has(ref)).sort();
  return {
    cartridge: `${c.manifest.id}@${c.manifest.version}`,
    transcripts: traces.length,
    never: {
      reactions: unseen(Object.keys(c.reactions ?? {})),
      recipes: Object.entries(c.recipes ?? {})
        .flatMap(([ref, r]) => (done.has(r.key) ? [] : [ref]))
        .sort(),
      choices: choices(c).filter(({ dialogue, choice }) => !seen.has(`${dialogue}#${choice}`)),
      quests: unseen(Object.keys(c.quests ?? {})),
    },
  };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const choices = (c: Cartridge) =>
  Object.entries(c.dialogues ?? {})
    .flatMap(([dialogue, d]) => Object.keys(d.choices).map((choice) => ({ dialogue, choice })))
    .sort((a, b) => cmp(a.dialogue, b.dialogue) || cmp(a.choice, b.choice));

if (import.meta.main) {
  const [file, ...paths] = process.argv.slice(2);
  if (!file || !existsSync(file)) {
    console.error('usage: node kernel/ts/play/coverage.ts <artifact> [<transcript.jsonl> ...]');
    process.exit(2);
  }
  const loaded = loadCartridge(readFileSync(file), INSTALLED);
  if (!loaded.ok) {
    console.error(JSON.stringify(loaded.diagnostic));
    process.exit(1);
  }
  const c = loaded.cartridge as Cartridge;
  const own = `cartridges/${c.manifest.id}/transcripts/*.jsonl`;
  const files = paths.length
    ? paths
    : globSync(own, { cwd: ROOT })
        .sort()
        .map((p) => ROOT + p);
  try {
    const pin = (p: string) => JSON.parse(readFileSync(p, 'utf8').split('\n')[0]!).ids.content_hash;
    const traces = files.map((p, i) => {
      try {
        return replayRecords(p, pin(p));
      } catch (e) {
        throw new Error((e as Error).message, { cause: i });
      }
    });
    console.log(encode(coverage(c, traces) as unknown as Json));
  } catch (e) {
    const { message, cause } = e as Error;
    const at = typeof cause === 'number' ? `${relative(ROOT, files[cause]!)}: ` : '';
    console.error(`${at}${message}`.replaceAll(ROOT, ''));
    process.exit(1);
  }
}
