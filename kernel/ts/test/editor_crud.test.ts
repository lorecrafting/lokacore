// The editor's create, edit and delete for every kind of the card registry
// (tools/author-panel/src/edit/registry.json), each through the route the panel sends it on
// (write.ts /new as App.tsx's palette, /change as a card's add menu, /delete as author.ts drop()),
// on a scaffolded cartridge that must compile after each step (docs/rnd/gui-editor-design-2026-11-04.md).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
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
import { added, definitionOf, diff } from '../play/card.ts';
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
const EXEMPT: Record<string, string> = {
  'cartridge create': 'one per cartridge: mix loka.new cartridge makes it with the folder',
  'cartridge delete': 'one per cartridge: deleting it is deleting the cartridge',
  'layout delete': 'a root file of cells: a room delete drops its row (write.ts remove)',
  'text delete': 'a root file of prose rows, written with the definitions that name them',
};
// Verbs the editor lacks today, each with its Beads issue.
const GAPS: Record<string, string> = {
  // no palette New: the kind is written by hand or by its card's parent
  'outline create': 'loka-wfrgk.86',
  'outline delete': 'loka-wfrgk.86',
  'scenes create': 'loka-wfrgk.86',
  'scenes delete': 'loka-wfrgk.86',
  'treatment:reverie create': 'loka-wfrgk.86',
  'treatment:reverie delete': 'loka-wfrgk.86',
  // the add menu's least value (card.ts added) is one the compiler refuses
  'items.edible edit': 'loka-wfrgk.62',
  'items.equip edit': 'loka-wfrgk.61',
  'items.block_chance edit': 'loka-wfrgk.84',
  'items.capacity edit': 'loka-wfrgk.84',
  'items.intended_level edit': 'loka-wfrgk.84',
  'liquids.amount edit': 'loka-wfrgk.84',
  'npcs.ambient edit': 'loka-wfrgk.84',
  'npcs.attack edit': 'loka-wfrgk.84',
  'npcs.spawn_template edit': 'loka-wfrgk.84',
  'populations.floor edit': 'loka-wfrgk.84',
  'populations.hunts edit': 'loka-wfrgk.84',
  'populations.pack edit': 'loka-wfrgk.84',
  'populations.sight edit': 'loka-wfrgk.84',
  'populations.trail edit': 'loka-wfrgk.84',
  'quests.offer edit': 'loka-wfrgk.84',
  'quests.repeatable edit': 'loka-wfrgk.84',
  'skills.hidden edit': 'loka-wfrgk.84',
  'skills.ranks edit': 'loka-wfrgk.84',
  // the add menu offers a field whose capability the cartridge does not lock
  'items.readable edit': 'loka-wfrgk.85',
  'rooms.dark edit': 'loka-wfrgk.85',
  'rooms.dark_description edit': 'loka-wfrgk.85',
  // /new wrote a set of files that name each other (or a template only the deleted one names)
  'transports delete': 'loka-wfrgk.87',
  'services delete': 'loka-wfrgk.87',
  'populations delete': 'loka-wfrgk.87',
  'npcs delete': 'loka-wfrgk.87', // still named by the services and transports sets
  'resources delete': 'loka-wfrgk.87', // still named by the services and transports sets
};

const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-crud-')));
const src = join(dir, 'src');
const artifact = join(dir, 'artifact.json');
const defs = JSON.parse(readFileSync(join(SCHEMAS, 'defs.schema.json'), 'utf8')).$defs;
const made = new Map<string, { file: string; key: string }>(); // kind → its definition
const needs = new Map<string, string>(); // kind → the kind /new first asked for ("no items yet")
const reds: string[] = [];
let w: ReturnType<typeof writer>;
let tree = '';

const read = (rel: string) => readFileSync(join(src, rel), 'utf8');
const post = async (url: string, sent: object) => {
  const [status, told] = (await w.post(url, sent)) as [number, any];
  return { ok: status === 200, status, told };
};
/** Compiles the scaffold and writes the artifact /delete reads its references from; a red names `what`. */
const compiles = (what: string) => {
  const out = compiled(src);
  if (typeof out === 'string') return void reds.push(`${what}: compile: ${out.slice(0, 300)}`);
  writeFileSync(artifact, JSON.stringify(out)); // author.ts write(): {canonical, sha256}
};
/** A card's load: the file's document and the sha its write sends back (GET /source). */
const open = async (rel: string) => {
  const [, s] = (await w.get(`/source?file=${encodeURIComponent(rel)}`)) as [number, any];
  return { doc: JSON.parse(s.bytes), was: s.sha256 as string };
};

before(() => {
  tree = status();
  // CI has mix but no mise: the stub runs the command (as ci.yml's kernel job does)
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin/mise'), '#!/bin/sh\nshift 2\nexec "$@"\n');
  chmodSync(join(dir, 'bin/mise'), 0o755);
  process.env.PATH = `${join(dir, 'bin')}:${process.env.PATH}`;
  execFileSync('mix', ['loka.new', 'cartridge', src], { cwd: REPO, stdio: 'ignore' });
  w = writer(src, () => {}, undefined, artifact);
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

test('every registry kind is created through /new and compiles', async () => {
  reds.length = 0; // each test reports its own
  // Breaks: a registry kind the palette cannot make, or whose /new writes a cartridge that does not compile.
  const pending = kinds.filter((k) => !EXEMPT[`${k} create`] && !GAPS[`${k} create`]);
  for (const k of pending.filter((k) => !offered.includes(k)))
    reds.push(`${k} create: not in new.json`);
  let left = pending.filter((k) => offered.includes(k));
  // a kind refused for a missing prerequisite ("no items yet") waits for the kind that makes one
  for (let progress = true; left.length && progress;) {
    progress = false;
    for (const k of left) {
      const r = await post('/new', { kind: k, name: `cov_${k}` });
      if (!r.ok) {
        const want = /no ([a-z_]+) yet/.exec(String(r.told))?.[1];
        if (want) needs.set(k, want);
        else reds.push(`${k} create: ${String(r.told).slice(0, 200)}`);
        if (!want) left = left.filter((x) => x !== k);
        continue;
      }
      const file = (r.told.files as string[]).find((f) => placed(f)?.dir === k) ?? `${k}.json`;
      made.set(k, { file, key: `cov_${k}` });
      left = left.filter((x) => x !== k);
      progress = true;
      compiles(`${k} create`);
    }
  }
  for (const k of left) reds.push(`${k} create: still refused (needs ${needs.get(k)})`);
  assert.deepEqual(reds, []);
});

test('every field a card draws takes its add-menu value through /change and compiles', async () => {
  reds.length = 0; // each test reports its own
  let posted = 0;
  // Breaks: an add-menu value (card.ts added) the compiler refuses, or a /change the writer refuses.
  for (const [k, { file }] of made) {
    if (!placed(file)) continue; // a row file's rows are its one registry field
    for (const f of Object.keys(registry)
      .filter((r) => r.startsWith(`${k}.`))
      .map((r) => r.slice(k.length + 1))) {
      const gap = GAPS[`${k}.${f} edit`];
      const { doc, was } = await open(file);
      const edited = added(doc, f, defs, definitionOf(defs, k, doc));
      if (!edited) continue; // present, or the author picks it (a string, an enum, a key)
      const r = await post('/change', { file, was, ops: diff(doc, edited) });
      posted++;
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
  }
  compiles('edits');
  assert.deepEqual(reds, []);
  assert.ok(posted > 50, `only ${posted} add-menu values were sent: added() offers nothing`);
});

test('a definition another names is refused, then every one deletes through /delete and compiles', async () => {
  reds.length = 0; // each test reports its own
  // Breaks: /delete leaving a dangling reference (users() skipped), or not removing the file or row.
  for (const [k, p] of needs) {
    const named = made.get(p);
    if (!made.has(k) || !named) continue;
    const r = await del(p);
    if (r.ok || !/still named by/.test(String(r.told)))
      reds.push(`${p} delete: not refused while ${k} names it`);
  }
  for (const k of [...made.keys()].reverse()) {
    if (EXEMPT[`${k} delete`] || GAPS[`${k} delete`]) continue;
    const { file, key } = made.get(k)!;
    const r = await del(k);
    if (!r.ok) reds.push(`${k} delete: ${String(r.told).slice(0, 200)}`);
    else if (
      ROWS.includes(k) ? Object.hasOwn(JSON.parse(read(file))[k], key) : existsSync(join(src, file))
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

/** author.ts drop(): the file's sha from /source, then /delete with the row key for a root file. */
async function del(k: string) {
  const { file, key } = made.get(k)!;
  const { was } = await open(file);
  return post('/delete', { file, was, ...(!file.includes('/') && { key }) });
}
