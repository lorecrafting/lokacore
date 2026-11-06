// Every card file in every cartridge, loaded through the card's data path (write.ts GET /source
// and /schema/<dir>; rjsf's form state under card.ts FORM_DEFAULTS, as Generic.tsx draws it; the
// commit's card.ts diff/applied/apart; write.ts POST /change) and saved unchanged, keeps its bytes;
// a seeded sample of one-leaf edits writes only that leaf, and /undo gives the file's bytes back.
// Expected bytes are the files' own, read before the run (docs/rnd/gui-editor-design-2026-11-04.md §4).
// rjsf's form state is taken on load: the Form reports it on mount or with the first edit, either way
// the next commit writes it.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { after, test } from 'node:test';
import { getDefaultFormState, type RJSFSchema } from '@rjsf/utils';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { applied, apart, diff, FORM_DEFAULTS } from '../play/card.ts';
import type { Op, Step } from '../play/edit_model.ts';
import { DIRS, placed, REPO, ROOTS } from '../play/guard.ts';
import { writer } from '../play/write.ts';

const validator = customizeValidator({ AjvClass: Ajv2020 });
const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'loka-roundtrip-')));
after(() => rmSync(tmp, { recursive: true, force: true }));
cpSync(join(REPO, 'cartridges'), tmp, { recursive: true }); // the writes land in the copy
const cartridges = readdirSync(tmp).sort();
const walk = (at: string): string[] =>
  readdirSync(at, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(at, e.name)) : [join(at, e.name)],
  );
// the files a card opens: a definition (guard.ts placed) or a root file /schema serves
const cards = (root: string) =>
  walk(root)
    .map((f) => relative(root, f))
    .filter((rel) => {
      const at = placed(rel);
      return at ? at.ext === 'json' && DIRS.includes(at.dir) : ROOTS.includes(rel.slice(0, -5));
    })
    .sort();
const original = new Map(
  cartridges.flatMap((c) =>
    cards(join(tmp, c)).map((rel) => [`${c}/${rel}`, readFileSync(join(tmp, c, rel), 'utf8')]),
  ),
);
const writers = new Map(cartridges.map((c) => [c, writer(join(tmp, c), () => {})]));
const schemas = new Map<string, RJSFSchema>();

/** The card's load: the file, its schema, the form's state; and the ops its commit would write. */
async function opened(c: string, rel: string) {
  const w = writers.get(c)!;
  const [, s] = (await w.get(`/source?file=${encodeURIComponent(rel)}`)) as [number, any];
  if (!schemas.has(s.kind))
    schemas.set(s.kind, (await w.get(`/schema/${s.kind}`))![1] as RJSFSchema);
  const schema = schemas.get(s.kind)!;
  const doc = JSON.parse(s.bytes);
  const commit = (draft: unknown): Op[] =>
    apart(
      diff(
        doc,
        applied(doc, getDefaultFormState(validator, schema, draft, schema, false, FORM_DEFAULTS)),
      ),
      [],
    );
  return { w, s, doc, commit };
}
const post = async (c: string, url: string, sent: object) => {
  const [status, body] = (await writers.get(c)!.post(url, sent)) as [number, any];
  assert.equal(
    status,
    200,
    `${url} ${JSON.stringify(sent).slice(0, 200)}: ${JSON.stringify(body)}`,
  );
  return body;
};

test('a card saved with no change writes nothing that alters the file', async () => {
  // Breaks: a schema default (FORM_DEFAULTS) or card.ts diff/applied adding, dropping or retyping
  // a field the author never touched; the write path re-encoding values it was not sent.
  const altered: string[] = [];
  for (const [at, bytes] of original) {
    const c = at.slice(0, at.indexOf('/'));
    const rel = at.slice(c.length + 1);
    const { s, doc, commit } = await opened(c, rel);
    const ops = commit(doc);
    if (!ops.length) continue;
    await post(c, '/change', { file: rel, was: s.sha256, ops });
    if (readFileSync(join(tmp, at), 'utf8') !== bytes)
      altered.push(`${at}: ${ops.map((o) => o.path.join('.')).join(', ')}`);
  }
  assert.deepEqual(altered, [], 'a no-change save altered these files (file: the paths it wrote)');
});

// a seeded draw (mulberry32): the same sample on every run
let seed = 0x6c6f6b61;
const draw = (n: number) => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n) | 0;
};
const leaves = (v: unknown, path: Step[] = []): [Step[], unknown][] =>
  v !== null && typeof v === 'object'
    ? Object.entries(v).flatMap(([k, x]) => leaves(x, [...path, Array.isArray(v) ? Number(k) : k]))
    : [[path, v]];
const edited = (v: unknown) =>
  typeof v === 'number' ? v + 1 : typeof v === 'boolean' ? !v : typeof v === 'string' ? `${v}x` : 0;
const SAMPLE = 60;

test('a one-leaf edit writes that leaf only, and its undo gives the file back byte for byte', async () => {
  // Breaks: a commit writing more than the author's edit (rjsf defaults, a union read as its const
  // branch); /undo restoring a re-encoded document instead of the journal's bytes.
  const files = [...original.keys()];
  for (let i = 0; i < SAMPLE; i++) {
    const at = files[draw(files.length)];
    const c = at.slice(0, at.indexOf('/'));
    const rel = at.slice(c.length + 1);
    const before = readFileSync(join(tmp, at), 'utf8'); // a no-change save may have rewritten it
    const { s, doc, commit } = await opened(c, rel);
    const all = leaves(doc);
    const [path, value] = all[draw(all.length)];
    const want = structuredClone(doc);
    let box: any = want;
    for (const k of path.slice(0, -1)) box = box[k];
    if (path.length) box[path.at(-1)!] = edited(value);
    const ops = commit(path.length ? want : edited(value));
    if (!ops.length) continue; // the form held the value back (a refusal stands): nothing written
    const { id } = await post(c, '/change', { file: rel, was: s.sha256, ops });
    assert.deepEqual(
      JSON.parse(readFileSync(join(tmp, at), 'utf8')),
      path.length ? want : edited(value),
      `${at} ${path.join('.')}`,
    );
    await post(c, '/undo', { id });
    assert.equal(readFileSync(join(tmp, at), 'utf8'), before, `${at} ${path.join('.')}: undo`);
  }
});
