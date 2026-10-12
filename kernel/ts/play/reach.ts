// `node kernel/ts/play/reach.ts <artifact>` (docs/system/cartridge.md#content-reports): loads a
// `mix loka.compile` artifact and prints its content graph and static reachability report as one
// canonical JSON document. A report for authors, not a check: nothing reads its output.
import { readFileSync } from 'node:fs';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { reach } from '../src/content/cartridge_barriers.ts';
import { engineWrittenRefs, expectedFacts } from '../src/content/cartridge_position.ts';
import { isObj, step, type Obj } from '../src/content/cartridge_refs.ts';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { refString } from '../src/runtime/decision.ts';

type Edge = { from: string; to: string; path: string; op?: string };

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
  ['service', /^\.benefit\.fact$/],
];
const isWrite = (e: Edge) =>
  e.op === 'fact.assign' ||
  e.op === 'fact.adjust' ||
  SITES.some(([at, path]) => (kindOf(e.from) ?? e.from) === at && path.test(e.path));
// a topic's fact is also read: the codex (GameView topics) lists the topics whose fact holds
const isRead = (e: Edge) => !isWrite(e) || kindOf(e.from) === 'topic';

/** Nodes: every definition of a map keyed by DefinitionRefString; edges: every DefinitionRef in it. */
export function contentGraph(c: Obj): { nodes: { ref: string; kind: string }[]; edges: Edge[] } {
  const nodes: { ref: string; kind: string }[] = [];
  const edges: Edge[] = [];
  // op: the `op` of the object directly holding this value (through arrays), when it has one
  const walk = (v: unknown, from: string, path: string, op?: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, from, `${path}[${i}]`, op));
    if (!isObj(v)) return;
    if (typeof v.cartridge_id === 'string' && typeof v.kind === 'string')
      return void edges.push({ from, to: refString(v as never), path, ...(op && { op }) });
    for (const [k, x] of Object.entries(v)) walk(x, from, `${path}${step(k)}`, v.op);
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
  // a quest with its own offer can start through it (quest@1); the offer's policy is not evaluated
  const offered = refs('quests').filter((q) => c.quests[q].offer);
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
    orphan_facts: orphanFacts(c, inbound),
  };
}

// N2: facts nothing names, only writes or only reads; the facts the engine owns are left out
function orphanFacts(c: Obj, inbound: (ref: string) => Edge[]) {
  const engine = new Set([
    ...Object.keys(expectedFacts(c)).map((k) => `${c.manifest.id}@${c.manifest.version}:fact/${k}`),
    ...engineWrittenRefs(c),
  ]);
  const facts = Object.keys((c.facts ?? {}) as Obj).filter((f) => !engine.has(f));
  return {
    unused: facts.filter((f) => !inbound(f).length).sort(),
    write_only: facts.filter((f) => inbound(f).length && !inbound(f).some(isRead)).sort(),
    read_only: facts.filter((f) => inbound(f).length && !inbound(f).some(isWrite)).sort(),
  };
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
