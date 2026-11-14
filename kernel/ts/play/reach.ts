// `node kernel/ts/play/reach.ts <artifact>` (docs/system/cartridge.md#content-reports): loads a
// `mix loka.compile` artifact and prints its content graph and static reachability report as one
// canonical JSON document. A report for authors, not a check: nothing reads its output.
import { readFileSync } from 'node:fs';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { CAPABILITY_OWNERS } from '../src/contracts.gen.ts';
import { reach } from '../src/content/cartridge_barriers.ts';
import { engineWrittenRefs, expectedFacts } from '../src/content/cartridge_position.ts';
import { isObj, step, type Obj } from '../src/content/cartridge_refs.ts';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { refString } from '../src/runtime/decision.ts';
import type { FactUsage } from './fact_usage.ts';
import { reads } from './reads.ts';

type Edge = {
  from: string;
  to: string;
  path: string;
  op?: string;
  set?: true;
  cleared?: true;
  value?: unknown;
  leaf?: Obj;
};

/** A fact's row in F1's table: its source spec as declared, its edges' counts, which side is
 * missing, and W4's relief: the highest value its once-only writes reach (L2a's sum). */
export type { FactUsage };

const REF = /^[^@]+@[^:]+:([a-z_]+)\/[^/]+$/; // DefinitionRefString
const kindOf = (ref: string) => REF.exec(ref)?.[1];
// A fact write: a fact.assign or fact.adjust step, or an engine write site with no op, by the
// enclosing definition's kind or section (cartridge.md Content reports lists them).
const SITES: [string, RegExp][] = [
  ['world', /^\.death_credit\[\d+\]\.fact$/],
  ['topic', /^\.fact$/],
  ['scene', /^\.(on_end\.assign\[\d+\]\.fact|on\.rest\.credit)$/],
  [
    'quest',
    /^\.(expedition\.(survived_fact|faction)|exchange\.(contribution|faction)|deadline\.(fact|trust_fact))$/,
  ],
  ['ancestries', /^\.[a-z0-9_]+\.faction\.fact$/],
  ['item', /^\.weapon\.durability\.fact$/],
  ['service', /^\.benefit\.(fact|account)$/],
];
const isWrite = (e: Edge) =>
  e.op === 'fact.assign' ||
  e.op === 'fact.adjust' ||
  e.op === 'fact.stamp' ||
  SITES.some(([at, path]) => (kindOf(e.from) ?? e.from) === at && path.test(e.path));
const isRead = (e: Edge) => reads(isWrite(e), kindOf(e.from));
// A policy leaf's own object (why_words has a sentence for every one); all/any/not are the combiners
const LEAF = new Set(
  Object.keys(CAPABILITY_OWNERS.policy).filter((op) => !['all', 'any', 'not'].includes(op)),
);

/** Nodes: every definition of a map keyed by DefinitionRefString; edges: every DefinitionRef in it. */
export function contentGraph(c: Obj): { nodes: { ref: string; kind: string }[]; edges: Edge[] } {
  const nodes: { ref: string; kind: string }[] = [];
  const edges: Edge[] = [];
  // op: the `op` of the object directly holding this value (through arrays), when it has one; at: that object (not through arrays); neg: an odd number of `not` wrappers above it
  const walk = (v: unknown, from: string, path: string, op?: string, at?: Obj, neg = false) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, from, `${path}[${i}]`, op, at, neg));
    if (!isObj(v)) return;
    if (typeof v.cartridge_id === 'string' && typeof v.kind === 'string') {
      const e: Edge = { from, to: refString(v as never), path, ...(op && { op }) };
      const cleared = op === 'fact.assign' && at?.value === false; // Knowledge: a false assign does not make it known
      // `value` what a write writes and `leaf` the policy leaf a gate sits on (`neg` when a `not`
      // wraps it), for consequences.ts: named sites carrying them would bloat the model for readers
      const extra =
        at === undefined
          ? {}
          : {
              ...('value' in at && { value: at.value }),
              ...(typeof at.op === 'string' && LEAF.has(at.op) && { leaf: at }),
              ...(typeof at.op === 'string' && LEAF.has(at.op) && neg && { neg: true as const }),
            };
      return void edges.push(
        isWrite(e)
          ? { ...e, ...extra, set: true, ...(cleared && { cleared }) }
          : { ...e, ...extra },
      ); // `set`: the edge writes its fact
    }
    const flipped = neg !== (v.op === 'not');
    for (const [k, x] of Object.entries(v)) walk(x, from, `${path}${step(k)}`, v.op, v, flipped);
  };
  for (const [section, v] of Object.entries(c)) {
    const keys = isObj(v) ? Object.keys(v) : [];
    if (!keys.length || !keys.every((k) => REF.test(k))) walk(v, section, '');
    else
      for (const ref of keys) {
        nodes.push({ ref, kind: kindOf(ref)! });
        walk(v[ref], ref, '');
      }
  }
  return { nodes, edges };
}

// A quest with its own offer can start through it (quest@1) if its target can be reached; the offer's policy is not evaluated.
const offerReached = (offer: Obj | undefined, rooms: Set<string>, npcs: Set<string>) => {
  if (offer?.target?.kind === 'detail') return rooms.has(refString(offer.target.room));
  if (offer?.target?.kind === 'npc') return npcs.has(refString(offer.target.npc));
  return offer;
};

/**
 * What a player can never reach from the initial state, and what content nothing uses
 * (cartridge.md Content reports). ponytail: static initial state only; dialogue choices and
 * reaction chains wait for a consumer.
 */
export function reachReport(c: Obj) {
  const { edges } = contentGraph(c);
  const keyed = reach(c);
  const shut = reach(c, false);
  const refs = (section: string) => Object.keys((c[section] ?? {}) as Obj);
  const absent = (xs: Iterable<string>, set: Set<string>) =>
    [...xs].filter((x) => !set.has(x)).sort();
  const out = (from: string, kind: string) =>
    edges.filter((e) => e.from === from && kindOf(e.to) === kind).map((e) => e.to);
  const inbound = (ref: string) => edges.filter((e) => e.to === ref);
  const location = (ref: string) => c.items[ref].location;
  const template = (ref: string) => location(ref).in === 'template';
  const placed = refs('items').filter((i) => !template(i));
  const npcs = new Set(refs('npcs').filter((n) => out(n, 'room').some((r) => keyed.rooms.has(r))));
  // an item an NPC holds is in reach with the NPC (bought, looted or received)
  const held = (i: string) => location(i).in === 'npc' && npcs.has(refString(location(i).npc));
  const unheld = placed.filter((i) => !held(i));
  const dialogues = new Set(
    refs('dialogues').filter((d) => npcs.has(refString(c.dialogues[d].npc))),
  );
  const reached = [...keyed.rooms, ...keyed.items, ...npcs, ...dialogues];
  const offered = refs('quests').filter((q) => offerReached(c.quests[q].offer, keyed.rooms, npcs));
  const quests = new Set([...offered, ...reached.flatMap((r) => out(r, 'quest'))]);
  return {
    unreachable: {
      rooms: absent(refs('rooms'), keyed.rooms),
      items: absent(unheld, keyed.items),
      npcs: absent(refs('npcs'), npcs),
      dialogues: absent(refs('dialogues'), dialogues),
      quests: absent(refs('quests'), quests),
    },
    behind_lock: { rooms: absent(keyed.rooms, shut.rooms), items: absent(keyed.items, shut.items) },
    orphan_items: refs('items')
      .filter((i) => template(i) && !inbound(i).length)
      .sort(),
    orphan_facts: orphanFacts(factUsage(c)),
  };
}

// N2: facts nothing names, only writes or only reads; the facts the engine owns are left out
function orphanFacts(rows: FactUsage[]) {
  const refs = (status?: string) => rows.filter((r) => r.status === status).map((r) => r.ref);
  return { unused: refs('unused'), write_only: refs('write_only'), read_only: refs('read_only') };
}

// king of the statuses, worst first: an orphan before a fact both sides use (F1's sort); `both` is
// absent from the list, so it sorts after every status in it
const TROUBLE = ['read_only', 'write_only', 'unused'];

// A reaction on one of these runs once per quest or level, so its writes do not accumulate
// (lib/loka/content/lint_facts.ex:14)
const ONCE = new Set(['quest_resolved', 'quest_failed', 'quest_activated', 'level_reached']);

/** Whether one definition's `fact.adjust` may run more than once, L2a's rule
 * (`lib/loka/content/lint_facts.ex:64-120`): a scene's writes happen once, a quest's unless it is
 * repeatable, a reaction's when it is `once` or sits on a one-shot event of a quest that is not
 * repeatable. Everything else may repeat. ponytail: a dialogue choice's `once` is not attributed
 * here either, so those count as repeating, like L2a. */
function repeats(c: Obj, section: string, def: Obj): boolean {
  if (section === 'scenes') return false;
  if (section === 'quests') return def.repeatable !== true;
  if (section !== 'reactions') return true;
  if (def.once === true) return false;
  const on = def.on as Obj | undefined;
  if (!isObj(on) || !ONCE.has(String(on.event))) return true;
  const q = isObj(on.quest) ? refString(on.quest as never) : undefined;
  return q === undefined || (c.quests as Obj)?.[q]?.repeatable !== true;
}

/** Every positive `fact.adjust` amount inside `v`, added to `out` per fact ref. */
function amounts(v: unknown, out: Map<string, number>) {
  if (Array.isArray(v)) return v.forEach((x) => amounts(x, out));
  if (!isObj(v)) return;
  if (v.op === 'fact.adjust' && isObj(v.fact) && typeof v.amount === 'number' && v.amount > 0) {
    const ref = refString(v.fact as never);
    out.set(ref, (out.get(ref) ?? 0) + v.amount);
  }
  Object.values(v).forEach((x) => amounts(x, out));
}

/** Every positive `fact.adjust` amount a fact's once-only writes add, by fact ref: the `once` sum
 * of L2a (`lib/loka/content/lint_facts.ex:148`), so W4's ceiling cannot drift from the lint's. */
function onceAmounts(c: Obj): Map<string, number> {
  const out = new Map<string, number>();
  for (const [section, v] of Object.entries(c))
    if (isObj(v))
      for (const [ref, def] of Object.entries(v))
        if (REF.test(ref) && isObj(def) && !repeats(c, section, def)) amounts(def, out);
  return out;
}

/** Every declared fact with its type, default, scopes, meaning, its read and write counts and which
 * side is missing (F1 and W4 of docs/design/story-tooling.md), worst first then by key. The facts
 * the engine owns are left out: the compiler's reserved ones and every engine write site. */
export function factUsage(c: Obj): FactUsage[] {
  const { edges } = contentGraph(c);
  const engine = new Set([
    ...Object.keys(expectedFacts(c)).map((k) => `${c.manifest.id}@${c.manifest.version}:fact/${k}`),
    ...engineWrittenRefs(c),
  ]);
  const all = Object.entries((c.facts ?? {}) as Obj).filter(([ref]) => !engine.has(ref));
  const grown = onceAmounts(c);
  const count = (ref: string) => {
    const into = edges.filter((e) => e.to === ref);
    const write = into.filter(isWrite).length;
    return { write, read: into.filter((e) => isRead(e)).length };
  };
  // a fact no edge names is unused; writes without reads, or reads without writes, name the gap
  const status = ({ read, write }: { read: number; write: number }) =>
    !read && !write ? 'unused' : !read ? 'write_only' : !write ? 'read_only' : 'both';
  const rank = (f: FactUsage) => {
    const i = TROUBLE.indexOf(f.status);
    return i < 0 ? TROUBLE.length : i;
  };
  return all
    .map(([ref, spec]) => {
      const n = count(ref);
      const v = (spec.value_type ?? {}) as FactUsage['value_type'];
      const reach = (typeof v.default === 'number' ? v.default : 0) + (grown.get(ref) ?? 0);
      return {
        ref,
        key: ref.slice(ref.lastIndexOf('/') + 1),
        ...spec,
        ...n,
        status: status(n),
        reach,
      };
    })
    .sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key)) as FactUsage[];
}

if (import.meta.main) {
  const [file, ...rest] = process.argv.slice(2);
  if (!file || rest.length) {
    console.error('usage: node kernel/ts/play/reach.ts <artifact>');
    process.exit(2);
  }
  const loaded = loadCartridge(readFileSync(file), INSTALLED);
  if (!loaded.ok) {
    console.error(JSON.stringify(loaded.diagnostic));
    process.exit(1);
  }
  const c = loaded.cartridge as unknown as Obj;
  console.log(encode({ graph: contentGraph(c), report: reachReport(c) } as unknown as Json));
}
