// The lines sheet (docs/design/story-tooling.md, W3): one row per text key of a cartridge, for
// proofreading an area in order and, later, for voice work. `bin/loka lines <cartridge dir>
// [--speaker <key>] [--csv]` prints it. The gate column reads `why_words.ts`'s own sentence, and
// the keys read the compiled artifact: a scene file's keys exist only after lowering.
import { readFileSync } from 'node:fs';
import { join, resolve as absolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { isObj, type Obj } from '../src/content/cartridge_refs.ts';
import { artifactBytes, compiled } from './compiled.ts';
import { files, blank, words } from './todo.ts';
import { sentences } from './why_words.ts';

type Dev = { canonical: string; sha256: string };
export type Line = {
  key: string;
  words: number;
  /** The line's speaker, else the node that owns it (a choice label has no speaker). */
  speaker: string;
  at: string;
  /** The gate in the explainer's sentence form; empty when nothing gates it. */
  gate: string;
  placeholder: boolean;
  bytes: number;
};
type Owner = { speaker: string; gate: string };

const gate = (def: Obj) =>
  sentences(def as never)
    .map((r) => r.text)
    .join('; ');
// the words as written: `todo.ts`'s own rule and own counting, so the two sheets cannot disagree
const written = (text: string) =>
  text
    .split('\n')
    .filter((l) => !blank(l))
    .reduce((n, l) => n + words(l), 0);
const strings = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v) || isObj(v)
      ? Object.values(v).flatMap(strings)
      : [];

/** Every text key's owner: a dialogue's or scene's `npc` is its lines' speaker, its policy their
 * gate, and a choice's own policy that choice's; anything else names its node. */
function owners(c: Obj, text: Record<string, string>) {
  const out: Map<string, Owner> = new Map();
  const own = (node: string, def: Obj, keys: unknown, gateText: string) => {
    const speaker = `${(def.npc as Obj | undefined)?.key ?? ''}` || node;
    for (const key of new Set(strings(keys)))
      if (key in text && !out.has(key)) out.set(key, { speaker, gate: gateText });
  };
  for (const [section, value] of Object.entries(c))
    for (const [ref, def] of isObj(value) ? Object.entries(value) : [])
      if (isObj(def) && ref.includes('@')) {
        const node = `${section.replace(/^scripted_actions$/, 'actions')}/${def.key ?? ref}`;
        const gated = def.policy ? gate(def) : '';
        // a choice's `needs:` gates its words before the dialogue's `when:` does
        for (const choice of Object.values((def.choices ?? {}) as Record<string, Obj>))
          own(node, def, choice, choice.policy ? gate(choice) : gated);
        own(node, def, def, gated);
      }
  return out;
}

/** The source line each key is written on: its `"key":` line, else the scene or cut line that
 * says its first words (a lowered key's own line). */
function index(source: string) {
  const keys = new Map<string, string>();
  const prose: { at: string; text: string }[] = [];
  for (const rel of files(source)) {
    const scene = /\.(scene|cut)$/.test(rel);
    readFileSync(join(source, rel), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const at = `${rel}:${i + 1}`;
        const named = /"([^"]+)":/.exec(line);
        if (!scene && named && !keys.has(named[1]!)) keys.set(named[1]!, at);
        if (scene) prose.push({ at, text: line.trim() });
      });
  }
  const said = (first: string) =>
    prose.find(
      (p) =>
        p.text.endsWith(`: ${first}`) ||
        [`- ${first}`, `* ${first}`, first].includes(p.text) ||
        p.text.includes(`"${first}`),
    );
  return (key: string, text: string) => {
    const first = text.split('\n')[0]!.trim();
    return keys.get(key) ?? (first ? said(first)?.at : undefined) ?? '';
  };
}

/** One row per text key of `source` compiled to `dev`, keys in order, `--speaker` filtering to
 * that speaker's lines. */
export function lines(dir: string, { speaker }: { speaker?: string } = {}, dev?: Dev): Line[] {
  const source = absolute(dir); // mise runs mix from the kernel, not this cwd
  const built = dev ?? build(source);
  const loaded = loadCartridge(artifactBytes(built), INSTALLED);
  if (!loaded.ok) throw new Error(`the kernel refuses the artifact: ${JSON.stringify(loaded)}`);
  const c = loaded.cartridge as unknown as Obj;
  const text = (c.text ?? {}) as Record<string, string>;
  const owner = owners(c, text);
  const where = index(source);
  return Object.keys(text)
    .sort()
    .map((key) => {
      const found = owner.get(key);
      return {
        key,
        words: written(text[key]!),
        speaker: found?.speaker ?? '',
        at: where(key, text[key]!),
        gate: found?.gate ?? '',
        placeholder: text[key]!.split('\n').some(blank),
        bytes: Buffer.byteLength(text[key]!, 'utf8'),
      };
    })
    .filter((row) => speaker === undefined || row.speaker === speaker);
}

const quoted = (v: string | number | boolean) =>
  typeof v === 'number' || typeof v === 'boolean'
    ? String(v)
    : /[",\n]/.test(v)
      ? `"${v.replace(/"/g, '""')}"`
      : v;

/** The rows as CSV: a header, then one line each. */
export function csv(rows: Line[]): string {
  const line = (r: Line) =>
    [r.key, r.words, r.speaker, r.at, r.gate, r.placeholder, r.bytes].map(quoted).join(',');
  return ['key,words,speaker,at,gate,placeholder,bytes', ...rows.map(line)].join('\n') + '\n';
}

// compiled() is the CLI's own compile: a caller with an artifact passes it (as the tests do).
function build(source: string) {
  const dev = compiled(source);
  if (typeof dev === 'string') {
    console.error(dev);
    process.exit(1);
  }
  return dev;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const shape = (name: string) => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : (args.splice(i, 2)[1] ?? ''); // '' when no value follows
  };
  const speaker = shape('--speaker');
  const csvAt = args.indexOf('--csv');
  if (csvAt >= 0) args.splice(csvAt, 1);
  const [source, ...rest] = args;
  if (!source || rest.length || speaker === '') {
    console.error('usage: bin/loka lines <cartridge dir> [--speaker <key>] [--csv]');
    process.exit(2);
  }
  const rows = lines(source, { speaker });
  process.stdout.write(csvAt >= 0 ? csv(rows) : `${JSON.stringify(rows, null, 2)}\n`);
}
