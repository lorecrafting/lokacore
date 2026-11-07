// The editor's create, edit and delete for every kind of the card registry
// (tools/author-panel/src/edit/registry.json), each through the route the panel sends it on
// (write.ts /new as App.tsx's palette, /change as a card's add menu, /delete as author.ts drop()),
// on a scaffolded cartridge that must compile after each step (docs/rnd/gui-editor-design-2026-11-04.md).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { added, allowed, definitionOf, diff } from '../play/card.ts';
import { compiled } from '../play/compiled.ts';
import { placed, REPO, SCHEMAS } from '../play/guard.ts';
import { writer } from '../play/write.ts';

const panel = (f: string) =>
  JSON.parse(readFileSync(join(REPO, 'tools/author-panel/src/edit', f), 'utf8'));
const registry: Record<string, unknown> = panel('registry.json');
const offered: string[] = panel('new.json'); // the palette's New kinds (shell.ts)
const kinds = [...new Set(Object.keys(registry).map((k) => k.split('.')[0]))];
const ROWS = ['facts', 'resources', 'attributes']; // write.ts: root files of keyed rows
// Kinds the editor rightly has no verb for, each with why.
const NAMED = 'refused: still named, at a file:line';
const EXEMPT: Record<string, string> = {
  'cartridge create': 'one per cartridge: mix loka.new cartridge makes it with the folder',
  'cartridge delete': 'one per cartridge: deleting it is deleting the cartridge',
  'layout delete': 'a root file of cells: a room delete drops its row (write.ts remove)',
  'text delete': 'a root file of prose rows, written with the definitions that name them',
  'outline delete': 'one per world, never compiled: source_schema.ex:39 @roots, source_files.ex:15',
  // refused while another names it, and the refusal names that file:line (delete the namer first)
  'transports delete': NAMED,
  'services delete': NAMED, // its provider NPC names its resource
  'npcs delete': NAMED, // the services and transports sets name it
  'resources delete': NAMED, // the services and transports sets name it
  'items delete': NAMED, // the quest a cutscene's /new writes names it
};
// Verbs the editor lacks today, each with its Beads issue.
const GAPS: Record<string, string> = {
  // no palette New: the kind is written by hand or by its card's parent
  'treatment:reverie create': 'loka-wfrgk.86.1',
  'treatment:reverie delete': 'loka-wfrgk.86.1',
  // the add menu's least value (card.ts added) is one the compiler refuses
  'items.block_chance edit': 'loka-wfrgk.84.1',
  'items.capacity edit': 'loka-wfrgk.84.1',
  'quests.offer edit': 'loka-wfrgk.84.1',
};

const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-crud-')));
const pristine = join(dir, 'pristine'); // the scaffold as mix loka.new wrote it
const defs = JSON.parse(readFileSync(join(SCHEMAS, 'defs.schema.json'), 'utf8')).$defs;
// The palette's New for a kind whose starter has another name (starters.ex dir_of).
const NEW_AS: Record<string, string> = { scenes: 'cutscene' };
const needs = new Map<string, string>(); // kind → the kind /new first asked for ("no items yet")
const reds: string[] = [];
/** A scratch cartridge: its source, the artifact /delete reads, its writer, the definitions made in it. */
type Scratch = {
  src: string;
  artifact: string;
  w: ReturnType<typeof writer>;
  made: Map<string, { file: string; key: string }>;
};
const scratch = (src: string): Scratch => {
  const artifact = `${src}.artifact.json`;
  return { src, artifact, w: writer(src, () => {}, undefined, artifact), made: new Map() };
};
let at: Scratch; // the cartridge the helpers below act on
let shared: Scratch; // every kind made in one: the create and delete tests'
let tree = '';

const read = (rel: string) => readFileSync(join(at.src, rel), 'utf8');
const post = async (url: string, sent: object) => {
  const [status, told] = (await at.w.post(url, sent)) as [number, any];
  return { ok: status === 200, status, told };
};
/** Compiles the scaffold and writes the artifact /delete reads its references from; a red names `what`. */
const compiles = (what: string) => {
  const out = compiled(at.src);
  if (typeof out === 'string') return !reds.push(`${what}: compile: ${out.slice(0, 300)}`);
  writeFileSync(at.artifact, JSON.stringify(out)); // author.ts write(): {canonical, sha256}
  return true;
};
/** A card's load: the file's document and the sha its write sends back (GET /source). */
const open = async (rel: string) => {
  const [, s] = (await at.w.get(`/source?file=${encodeURIComponent(rel)}`)) as [number, any];
  return { doc: JSON.parse(s.bytes), was: s.sha256 as string };
};
/** /new for `k`, first making each kind it asks for; else a red. */
async function make(k: string, asked: string[] = []): Promise<string | undefined> {
  if (at.made.has(k)) return;
  const r = await post('/new', { kind: NEW_AS[k] ?? k, name: `cov_${k}` });
  if (r.ok) {
    const file = (r.told.files as string[]).find((f) => placed(f)?.dir === k) ?? `${k}.json`;
    at.made.set(k, { file, key: `cov_${k}` });
    return compiles(`${k} create`) ? undefined : reds.pop();
  }
  const want = /no ([a-z_]+) yet/.exec(String(r.told))?.[1];
  if (!want || asked.includes(want)) return `${k} create: ${String(r.told).slice(0, 200)}`;
  needs.set(k, want);
  return (await make(want, [...asked, k])) ?? make(k, [...asked, want]);
}

before(() => {
  tree = status();
  // CI has mix but no mise: the stub runs the command (as ci.yml's kernel job does)
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin/mise'), '#!/bin/sh\nshift 2\nexec "$@"\n');
  chmodSync(join(dir, 'bin/mise'), 0o755);
  process.env.PATH = `${join(dir, 'bin')}:${process.env.PATH}`;
  execFileSync('mix', ['loka.new', 'cartridge', pristine], { cwd: REPO, stdio: 'ignore' });
  // the capabilities no /new locks, so items.edible, items.readable and rooms.dark are offered and tried
  const cart = JSON.parse(readFileSync(join(pristine, 'cartridge.json'), 'utf8'));
  Object.assign(cart.requires.capabilities, { food: 1, readable: 1, light: 1 });
  writeFileSync(join(pristine, 'cartridge.json'), JSON.stringify(cart, null, 2));
  cpSync(pristine, join(dir, 'src'), { recursive: true });
  at = shared = scratch(join(dir, 'src'));
  compiles('scaffold');
});
after(() => rmSync(dir, { recursive: true, force: true }));

test('every GAPS and EXEMPT row names a registry kind or field and a verb', () => {
  // Breaks: a misspelt row (it exempts nothing and hides nothing) or one left for a dropped kind.
  const bad = [...Object.keys(GAPS), ...Object.keys(EXEMPT)].filter((row) => {
    const [what, verb] = row.split(' ');
    return verb === 'edit' ? !Object.hasOwn(registry, what) : !kinds.includes(what);
  });
  assert.deepEqual(bad, []);
});

test('every registry kind is created through /new and compiles; a create gap that now works is red', async () => {
  reds.length = 0; // each test reports its own
  // Breaks: a registry kind the palette cannot make, or whose /new writes a cartridge that does not compile.
  for (const k of kinds) {
    const gap = GAPS[`${k} create`];
    if (EXEMPT[`${k} create`]) {
      if (offered.includes(NEW_AS[k] ?? k))
        reds.push(`${k} create: new.json offers it, drop its EXEMPT row`);
      continue;
    }
    if (!offered.includes(NEW_AS[k] ?? k)) {
      if (!gap) reds.push(`${k} create: not in new.json`);
      continue;
    }
    const red = await make(k);
    if (red && !gap) reds.push(red);
    if (gap && at.made.has(k))
      reds.push(`${k} create: works now, stale gap: drop its GAPS row (${gap})`);
  }
  assert.deepEqual(reds, []);
});

test('every field a card draws takes its add-menu value through /change and compiles', async () => {
  reds.length = 0; // each test reports its own
  const posted = new Set<string>();
  // Breaks: an add-menu value (card.ts added) the compiler refuses, or a /change the writer refuses.
  // Each kind is made in a fresh scaffold, so a field needs only the capabilities its kind's /new locks.
  try {
    for (const k of shared.made.keys()) {
      const src = join(dir, `edit-${k.replace(':', '_')}`);
      cpSync(pristine, src, { recursive: true });
      at = scratch(src);
      const red = await make(k);
      if (red) reds.push(`${k} edit: ${red}`);
      const { file } = at.made.get(k) ?? {};
      // a row file's rows are its one registry field; outline.json's fields are its card's
      if (!file || (!placed(file) && k !== 'outline')) continue;
      for (const f of Object.keys(registry)
        .filter((r) => r.startsWith(`${k}.`))
        .map((r) => r.slice(k.length + 1))) {
        const gap = GAPS[`${k}.${f} edit`];
        const { doc, was } = await open(file);
        // the card's menu (Entity.tsx, Action.tsx: the whole cartridge.json as its world)
        const cart = JSON.parse(read('cartridge.json'));
        const caps = cart.requires?.capabilities ?? {};
        if (!allowed(k, [f], caps, doc, k === 'actions' ? cart : cart.world).length) {
          if (gap)
            reds.push(`${k}.${f} edit: not offered now, stale gap: drop its GAPS row (${gap})`);
          continue;
        }
        const edited = added(doc, f, defs, definitionOf(defs, k, doc));
        if (!edited) continue; // present, or the author picks it (a string, an enum, a key)
        const r = await post('/change', { file, was, ops: diff(doc, edited) });
        posted.add(`${k}.${f}`);
        if (!r.ok) {
          if (!gap) reds.push(`${k}.${f} edit: ${String(r.told).slice(0, 200)}`);
          continue;
        }
        const before = reds.length;
        compiles(`${k}.${f} edit`);
        if (gap) {
          // a gap still red stays out of the list; one now green must leave GAPS
          if (reds.length > before) reds.length = before;
          else reds.push(`${k}.${f} edit: compiles now, drop its GAPS row (${gap})`);
        }
        if (reds.length > before || gap) await post('/undo', { id: r.told.id }); // the next field starts green
      }
      rmSync(at.src, { recursive: true });
    }
  } finally {
    at = shared;
  }
  assert.deepEqual(reds, []);
  assert.ok(
    posted.size > 50,
    `only ${posted.size} add-menu values were sent: added() offers nothing`,
  );
  for (const f of ['items.readable', 'rooms.dark']) assert.ok(posted.has(f), `${f} never sent`);
});

test('a definition another names is refused, then every one deletes through /delete and compiles', async () => {
  reds.length = 0; // each test reports its own
  // Breaks: /delete leaving a dangling reference (users() skipped), or not removing the file or row;
  // a delete gap that now works (it is attempted, and undone when it breaks the compile).
  for (const [k, p] of needs) {
    if (!at.made.has(k) || !at.made.has(p)) continue;
    const r = await del(p);
    if (r.ok || !/still named by/.test(String(r.told)))
      reds.push(`${p} delete: not refused while ${k} names it`);
  }
  for (const k of [...at.made.keys()].reverse()) {
    if (EXEMPT[`${k} delete`] === NAMED) {
      const r = await del(k);
      if (r.ok || !/\.\w+:[1-9]\d*/.test(String(r.told)))
        reds.push(
          `${k} delete: not refused at the namer's file:line: ${JSON.stringify(r.told).slice(0, 400)}`,
        );
    }
    if (EXEMPT[`${k} delete`]) continue; // a root file of the cartridge, or named: never deleted here
    const gap = GAPS[`${k} delete`];
    const { file, key } = at.made.get(k)!;
    const r = await del(k);
    if (gap) {
      if (!r.ok) continue; // refused: the gap holds
      if (compiles(`${k} delete`))
        reds.push(`${k} delete: works now, stale gap: drop its GAPS row (${gap})`);
      else {
        reds.pop(); // the gap holds; undo it so later deletes compile against a whole cartridge
        await post('/undo', { id: r.told.id });
      }
      continue;
    }
    if (!r.ok) reds.push(`${k} delete: ${String(r.told).slice(0, 200)}`);
    else if (
      ROWS.includes(k)
        ? Object.hasOwn(JSON.parse(read(file))[k], key)
        : existsSync(join(at.src, file))
    )
      reds.push(`${k} delete: ${file} still holds it`);
    else compiles(`${k} delete`);
  }
  assert.deepEqual(reds, []);
  assert.equal(status(), tree, 'a write outside the scratch cartridge');
});

/** The repo's changed files past Beads, which flushes on its own (a /new writing to the repo shows). */
function status() {
  return execFileSync('git', ['status', '--porcelain', '--', '.', ':!.beads'], {
    cwd: REPO,
    encoding: 'utf8',
  });
}

/** author.ts drop(): the file's sha from /source, then /delete with the row key for a root file,
 * sent again with the shas of the other files it takes when the writer names them. */
async function del(k: string) {
  const { file, key } = at.made.get(k)!;
  const { was } = await open(file);
  const sent = { file, was, ...(ROWS.includes(k) && { key }) };
  const r = await post('/delete', sent);
  const set: { file: string; sha256: string }[] | undefined = r.told?.set;
  if (!set) return r;
  return post('/delete', { ...sent, also: Object.fromEntries(set.map((m) => [m.file, m.sha256])) });
}
