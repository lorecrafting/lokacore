// The Story map's model (docs/system/cartridge.md#content-reports; docs/rnd/story-map-design-2026-11-05.md
// section 11 S1): reach.ts's content graph and reach report over the compiled artifact, plus the
// dialogue links it cannot see (a choice's `then` is a key, a reaction's `choice_resolved` names a
// choice), the `~` placeholders and the compiler's diagnostics by node, and outline.json's beats
// with their status and the seeds-and-payoffs check. live.ts serves it as `GET /story`;
// `bin/loka story <cartridge dir>` prints it. Potential findings for authors, not a check.
import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { join, resolve as absolute } from 'node:path';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { isObj, step, type Obj } from '../src/content/cartridge_refs.ts';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { artifactBytes, compiled } from './compiled.ts';
import { contentGraph, reachReport } from './reach.ts';
import { placed } from './guard.ts';
import { files, todo, type Todo } from './todo.ts';
import { choiceCounts, keysIn, wordsByNode } from './story_counts.ts';
import { refString } from '../src/runtime/decision.ts';

type Dev = { canonical: string; sha256: string };
type Diagnostic = { rel?: string };
type Beat = { n: number; title?: string; nodes?: string[]; seeds?: string[]; pays?: string[] };
type Outline = { parts: { title?: string; minutes?: number; beats: Beat[] }[] };

const strings = (v: unknown) =>
  v === undefined || (Array.isArray(v) && v.every((s) => typeof s === 'string'));
// The shape of schemas/source/outline.schema.json, by hand: ajv is a dev dependency only.
const isOutline = (o: unknown): o is Outline =>
  isObj(o) &&
  Array.isArray(o.parts) &&
  o.parts.every(
    (p) =>
      isObj(p) &&
      Array.isArray(p.beats) &&
      p.beats.every(
        (b) =>
          isObj(b) &&
          Number.isInteger(b.n) &&
          strings(b.nodes) &&
          strings(b.seeds) &&
          strings(b.pays),
      ),
  );

/** Each choice's `then`/`then_failed` (not `end`) as an edge to that dialogue, and each
 * `choice_resolved` reaction filtered on a choice key as an edge from every dialogue with that choice. */
function links(c: Obj) {
  const dialogues = Object.entries((c.dialogues ?? {}) as Obj) as [string, Obj][];
  const edges: { from: string; to: string; path: string; op: string }[] = [];
  for (const [from, d] of dialogues)
    for (const [choice, o] of Object.entries((d.choices ?? {}) as Record<string, Obj>))
      for (const field of ['then', 'then_failed'])
        if (typeof o[field] === 'string' && o[field] !== 'end')
          edges.push({
            from,
            to: `${from.slice(0, from.indexOf(':'))}:dialogue/${o[field]}`,
            path: `${step('choices')}${step(choice)}${step(field)}`,
            op: field,
          });
  for (const [to, r] of Object.entries((c.reactions ?? {}) as Record<string, Obj>)) {
    const on = r.on as Obj;
    if (on?.event !== 'choice_resolved') continue; // the kernel's load checks choice is a string
    for (const [from, d] of dialogues)
      if (isObj(d.choices) && (on.choice as string) in d.choices)
        edges.push({ from, to, path: '.on.choice', op: 'choice_resolved' });
  }
  return edges;
}

// short ref (`<dir>/<key>`, scripted actions under actions/) => DefinitionRefString, and each ref's definition
function shortRefs(c: Obj, nodes: { ref: string }[]) {
  const refs = new Map<string, string>();
  const defs = new Map<string, unknown>();
  for (const { ref } of nodes) {
    const section = Object.keys(c).find((s) => isObj(c[s]) && ref in (c[s] as Obj))!;
    const dir = section.replace(/^scripted_actions$/, 'actions');
    refs.set(`${dir}/${ref.slice(ref.lastIndexOf('/') + 1)}`, ref);
    defs.set(ref, (c[section] as Obj)[ref]);
  }
  return { refs, defs };
}

// A source file's node by guard.ts's placed() (area folders too); a `.scene` is a dialogue (Source.placed).
function nodeOf(rel: string | undefined, refs: Map<string, string>) {
  const at = rel === undefined ? undefined : placed(rel);
  return at && refs.get(`${at.ext === 'scene' ? 'dialogues' : at.dir}/${at.key}`);
}

const add = <T>(into: Record<string, T[]>, ref: string | undefined, row: T) => {
  if (ref) (into[ref] ??= []).push(row);
};

/** `/todo` by node: a definition's own file's rows, and text.json's `~` keys the definition names. */
function todoByNode(source: string, refs: Map<string, string>, defs: Map<string, unknown>) {
  const out: Record<string, Todo[]> = {};
  for (const row of todo(source))
    if (row.file !== 'text.json') add(out, nodeOf(row.file, refs), row);
    else
      for (const [ref, def] of defs) {
        const named = new Set(keysIn(def));
        const placeholders = row.placeholders.filter((k) => named.has(k));
        if (placeholders.length) add(out, ref, { ...row, placeholders });
      }
  return out;
}

/** The model for `source` compiled to `dev`, with the compile's diagnostics. */
export function story(source: string, dev: Dev, diagnostics: Diagnostic[]) {
  const loaded = loadCartridge(artifactBytes(dev), INSTALLED);
  if (!loaded.ok) throw new Error(`the kernel refuses the artifact: ${JSON.stringify(loaded)}`);
  const c = loaded.cartridge as unknown as Obj;
  const graph = contentGraph(c);
  graph.edges.push(...links(c));
  const report = reachReport(c);
  const { refs, defs } = shortRefs(c, graph.nodes);
  const todos = todoByNode(source, refs, defs);
  const byNode: Record<string, Diagnostic[]> = {};
  for (const d of diagnostics) add(byNode, nodeOf(d.rel, refs), d);
  const unreached = new Set(Object.values(report.unreachable).flat());
  return {
    hash: dev.sha256,
    graph,
    report,
    todo: todos,
    diagnostics: byNode,
    outline: beats(source, { refs, defs, todos, unreached }),
    map: rooms(source, c, refs),
    words: wordsByNode(defs, (c.text ?? {}) as Record<string, unknown>),
    choices: choiceCounts(c),
  };
}

/** The editor map's rooms (docs/design/editor-map-and-story-rulings.md E3a): each with its source
 * file, its area (the folder, or an `areas/<name>.json` bundle; null at the root), its title's
 * words, its exits and its layout.json cell (`at`, absent when unplaced). */
function rooms(source: string, c: Obj, refs: Map<string, string>) {
  const file = new Map<string, [string, string | null]>();
  for (const rel of files(source)) {
    const bundle = /^areas\/([a-z0-9_]+)\.json$/.exec(rel)?.[1];
    if (!bundle) {
      const ref = nodeOf(rel, refs);
      if (ref) file.set(ref, [rel, placed(rel)!.area]);
      continue;
    }
    let held: Obj;
    try {
      held = JSON.parse(readFileSync(join(source, rel), 'utf8')) as Obj;
    } catch {
      continue; // a half-typed bundle is the compiler's to report; its rooms keep no file
    }
    for (const key of Object.keys(held.rooms ?? {}))
      file.set(refs.get(`rooms/${key}`) ?? '', [rel, bundle]);
  }
  const at = new Map(
    ((c.layout ?? []) as Obj[]).map(({ room, x, y, z }) => [refString(room as never), { x, y, z }]),
  );
  return Object.entries((c.rooms ?? {}) as Record<string, Obj>).map(([ref, r]) => ({
    ref,
    key: r.key as string,
    file: file.get(ref)?.[0],
    area: file.get(ref)?.[1] ?? null,
    title: ((c.text ?? {}) as Obj)[r.name] ?? r.name,
    exits: Object.entries(r.exits as Record<string, Obj>).map(([dir, e]) => ({
      dir,
      to: e.to.key as string,
      ...(e.barrier && { barrier: e.barrier.key as string }),
      ...(e.hidden_until && { hidden: true }),
    })),
    at: at.get(ref),
  }));
}

type Bound = {
  refs: Map<string, string>;
  defs: Map<string, unknown>;
  todos: Record<string, unknown>;
  unreached: Set<string>;
};

// A short ref's node: a dialogue choice `dialogues/<d>/<c>` is its dialogue's, when it has that choice.
function resolve(short: string, { refs, defs }: Bound) {
  const [dir, key, choice] = short.split('/');
  const ref = refs.get(`${dir}/${key}`);
  if (choice === undefined || !ref) return ref;
  const d = defs.get(ref);
  return dir === 'dialogues' && isObj(d) && isObj(d.choices) && choice in d.choices
    ? ref
    : undefined;
}

function readOutline(source: string): Outline | { refused: string } | null {
  const file = join(source, 'outline.json');
  if (!existsSync(file)) return null;
  let outline: unknown;
  try {
    outline = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    return { refused: `outline.json: ${(e as Error).message}` };
  }
  return isOutline(outline)
    ? outline
    : { refused: 'outline.json: not the shape of schemas/source/outline.schema.json' };
}

function beats(source: string, bound: Bound) {
  const outline = readOutline(source);
  if (!outline || 'refused' in outline) return outline;
  const all = outline.parts.flatMap((p, part) => p.beats.map((b) => ({ ...b, part })));
  const rows = all.map(({ part, n, title, nodes = [] }) => {
    const refs = nodes.map((short) => resolve(short, bound));
    const missing = nodes.filter((_, i) => !refs[i]);
    const status =
      !nodes.length || missing.length
        ? 'missing'
        : refs.some((r) => r! in bound.todos)
          ? '~'
          : refs.every((r) => bound.unreached.has(r!))
            ? 'unreached'
            : 'built';
    return {
      part,
      n,
      ...(title !== undefined && { title }),
      status,
      ...(missing.length && { missing }),
      nodes: [...new Set(refs.filter((r) => r !== undefined))],
    };
  });
  // each seed needs a pays in a later beat, each pays a seed in an earlier one (outline order)
  const unpaid = all.flatMap((b, i) =>
    (b.seeds ?? [])
      .filter((s) => !all.slice(i + 1).some((l) => l.pays?.includes(s)))
      .map((seed) => ({ seed, n: b.n })),
  );
  const unseeded = all.flatMap((b, i) =>
    (b.pays ?? [])
      .filter((p) => !all.slice(0, i).some((e) => e.seeds?.includes(p)))
      .map((pays) => ({ pays, n: b.n })),
  );
  return { parts: outline.parts.map((p) => p.title ?? null), beats: rows, unpaid, unseeded };
}

/** live.ts's `GET /story`: the model built on the first ask after each compile (`stale()`), with
 * an ETag by its body's hash (an outline.json edit recompiles to the same artifact hash).
 * `keep()` builds it now if none is built: a Hold serves that whole model to its end (§7). */
export function storyRoute(source: string, artifact: string) {
  let model: { etag: string; body: string } | undefined;
  const build = (diagnostics: unknown[]) => {
    if (model) return model;
    const dev = JSON.parse(readFileSync(artifact, 'utf8')) as Dev;
    const body = JSON.stringify(story(source, dev, diagnostics as Diagnostic[]));
    return (model = { etag: `"${createHash('sha256').update(body).digest('hex')}"`, body });
  };
  return {
    stale: () => (model = undefined),
    // With no artifact yet there is no model to keep; a GET then answers as it did before.
    keep: (diagnostics: unknown[]) => existsSync(artifact) && build(diagnostics),
    answer(request: IncomingMessage, response: ServerResponse, diagnostics: unknown[]) {
      if (request.method !== 'GET') return response.writeHead(405).end();
      const model = build(diagnostics);
      if (request.headers['if-none-match'] === model.etag)
        return response.writeHead(304, { etag: model.etag }).end();
      response.writeHead(200, { 'content-type': 'application/json', etag: model.etag });
      response.end(model.body);
    },
  };
}

if (import.meta.main) {
  const [source, ...rest] = process.argv.slice(2);
  if (!source || rest.length) {
    console.error('usage: bin/loka story <cartridge dir>');
    process.exit(2);
  }
  const dev = compiled(absolute(source)); // mise runs mix from the kernel, not this cwd
  if (typeof dev === 'string') {
    console.error(dev);
    process.exit(1);
  }
  // ponytail: compiled() keeps no --json diagnostics, so the CLI form has none; the watcher's has them.
  console.log(encode(story(source, dev, []) as unknown as Json));
}
