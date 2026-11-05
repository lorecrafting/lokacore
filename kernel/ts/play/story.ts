// The Story map's model (docs/system/cartridge.md#content-reports; docs/rnd/story-map-design-2026-11-05.md
// section 11 S1): reach.ts's content graph and reach report over the compiled artifact, plus the
// dialogue links it cannot see (a choice's `then` is a key, a reaction's `choice_resolved` names a
// choice), the `~` placeholders and the compiler's diagnostics by node, and outline.json's beats
// with their status and the seeds-and-payoffs check. live.ts serves it as `GET /story`;
// `bin/loka story <cartridge dir>` prints it. Potential findings for authors, not a check.
import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { isObj, step, type Obj } from '../src/content/cartridge_refs.ts';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { artifactBytes, compiled } from './compiled.ts';
import { contentGraph, reachReport } from './reach.ts';
import { files, todo } from './todo.ts';

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
    if (on?.event !== 'choice_resolved' || typeof on.choice !== 'string') continue;
    for (const [from, d] of dialogues)
      if (isObj(d.choices) && on.choice in d.choices)
        edges.push({ from, to, path: '.on.choice', op: 'choice_resolved' });
  }
  return edges;
}

// short ref (`<dir>/<key>`, scripted actions under actions/) => DefinitionRefString, and each ref's file
function shortRefs(c: Obj, nodes: { ref: string }[], source: string) {
  const refs = new Map<string, string>();
  for (const { ref } of nodes) {
    const section = Object.keys(c).find((s) => isObj(c[s]) && ref in (c[s] as Obj))!;
    const dir = section.replace(/^scripted_actions$/, 'actions');
    refs.set(`${dir}/${ref.slice(ref.lastIndexOf('/') + 1)}`, ref);
  }
  const rels = files(source);
  const fileOf = new Map<string, string>();
  for (const [short, ref] of refs) {
    const file = rels.find((r) => r.startsWith(`${short}.`));
    if (file) fileOf.set(ref, file);
  }
  return { refs, fileOf };
}

/** The model for `source` compiled to `dev`, with the compile's diagnostics. */
export function story(source: string, dev: Dev, diagnostics: Diagnostic[]) {
  const loaded = loadCartridge(artifactBytes(dev), INSTALLED);
  if (!loaded.ok) throw new Error(`the kernel refuses the artifact: ${JSON.stringify(loaded)}`);
  const c = loaded.cartridge as unknown as Obj;
  const graph = contentGraph(c);
  graph.edges.push(...links(c));
  const { refs, fileOf } = shortRefs(c, graph.nodes, source);
  const byNode = <T>(rows: T[], rel: (row: T) => string | undefined) => {
    const out: Record<string, T[]> = {};
    for (const [ref, file] of fileOf) {
      const mine = rows.filter((row) => rel(row) === file);
      if (mine.length) out[ref] = mine;
    }
    return out;
  };
  const todos = byNode(todo(source), (t) => t.file);
  return {
    hash: dev.sha256,
    graph,
    report: reachReport(c),
    todo: todos,
    diagnostics: byNode(diagnostics, (d) => d.rel),
    outline: beats(source, c, refs, todos),
  };
}

// A short ref's node: a dialogue choice `dialogues/<d>/<c>` is its dialogue's, when it has that choice.
function resolve(short: string, c: Obj, refs: Map<string, string>) {
  const [dir, key, choice] = short.split('/');
  const ref = refs.get(`${dir}/${key}`);
  if (choice === undefined) return ref;
  const choices = ref && (c.dialogues as Obj)[ref] && ((c.dialogues as Obj)[ref] as Obj).choices;
  return dir === 'dialogues' && isObj(choices) && choice in choices ? ref : undefined;
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

function beats(source: string, c: Obj, refs: Map<string, string>, todos: Record<string, unknown>) {
  const outline = readOutline(source);
  if (!outline || 'refused' in outline) return outline;
  const all = outline.parts.flatMap((p, part) => p.beats.map((b) => ({ ...b, part })));
  const rows = all.map(({ part, n, title, nodes = [] }) => {
    const bound = nodes.map((short) => resolve(short, c, refs));
    const missing = nodes.filter((_, i) => !bound[i]);
    const status =
      !nodes.length || missing.length ? 'missing' : bound.some((r) => r! in todos) ? '~' : 'built';
    return {
      part,
      n,
      ...(title !== undefined && { title }),
      status,
      ...(missing.length && { missing }),
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
  return { beats: rows, unpaid, unseeded };
}

/** live.ts's `GET /story`: the model built on the first ask after each compile (`stale()`), with
 * an ETag by its body's hash (an outline.json edit recompiles to the same artifact hash). */
export function storyRoute(source: string, artifact: string) {
  let model: { etag: string; body: string } | undefined;
  return {
    stale: () => (model = undefined),
    answer(request: IncomingMessage, response: ServerResponse, diagnostics: unknown[]) {
      if (request.method !== 'GET') return response.writeHead(405).end();
      if (!model) {
        const dev = JSON.parse(readFileSync(artifact, 'utf8')) as Dev;
        const body = JSON.stringify(story(source, dev, diagnostics as Diagnostic[]));
        model = { etag: `"${createHash('sha256').update(body).digest('hex')}"`, body };
      }
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
  const dev = compiled(source);
  if (typeof dev === 'string') {
    console.error(dev);
    process.exit(1);
  }
  // ponytail: compiled() keeps no --json diagnostics, so the CLI form has none; the watcher's has them.
  console.log(encode(story(source, dev, []) as unknown as Json));
}
