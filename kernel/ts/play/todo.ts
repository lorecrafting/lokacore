// Still to write: every `~` placeholder in a cartridge source, grouped by the file (beat) that
// owns it, with the words already written there (docs/system/cartridge.md#still-to-write).
// `bin/loka todo <cartridge dir>` prints the list; the author panel's Write tab reads it over
// live.ts `GET /todo`. The release compile's refusal is mix loka.compile's (text keys, after
// lowering); this is the writer's list, so it reads the source as written, by the same line rule.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Todo = { file: string; words: number; placeholders: string[] };

/** The source tree's regular files, relative, text.json first (a key's definition beats a
 * mention); checkpoints are the author's, not the cartridge's. */
export const files = (dir: string, under = ''): string[] =>
  readdirSync(join(dir, under), { withFileTypes: true })
    .flatMap((f) => (f.isDirectory() ? files(dir, join(under, f.name)) : join(under, f.name)))
    .filter((rel) => !rel.startsWith('checkpoints/'))
    .sort() // readdir order differs by platform
    .sort((a, b) => Number(b === 'text.json') - Number(a === 'text.json'));

type Prose = [at: string, text: string];
// A definition's prose: every {"prose": "<words>"} marker by path (its other strings are keys
// and names, not the writer's words).
function markers(value: unknown, at = '', into: Prose[] = []) {
  if (typeof value !== 'object' || value === null) return into;
  if ('prose' in value && typeof value.prose === 'string') into.push([at, value.prose]);
  else for (const [k, v] of Object.entries(value)) markers(v, at ? `${at}.${k}` : k, into);
  return into;
}

// text.json's prose: every string value by key.
const catalog = (value: unknown): Prose[] =>
  Object.entries(value ?? {}).filter((e): e is Prose => typeof e[1] === 'string');

// A scene's prose: each speaker line, narration line and choice label by line number, `npc:`,
// `when:`, `with:`, `gives:`, `sets:` and `quest:` being keys (lib/loka/content/scene_files.ex).
const sceneLines = (text: string): Prose[] =>
  text.split('\n').flatMap((raw, i): Prose[] => {
    // A `~` standing for a key still needs writing, and the compile refuses it until then.
    if (/^(?:npc|when|with|gives|sets|quest):(?:\s.*)?\s~$/.test(raw.trim())) {
      return [[`line ${i + 1}`, '~']];
    }
    const said = /^(?:- |\* |(?!npc:|when:|with:|gives:|sets:|quest:)[^:\s]+:\s)(.*)$/.exec(
      raw.trim(),
    );
    return said ? [[`line ${i + 1}`, said[1]]] : [];
  });

// A cutscene's prose: every line but the `---` that closes it.
const cutLines = (text: string): Prose[] =>
  text.split('\n').flatMap((raw, i): Prose[] => {
    const line = raw.trim();
    return line && line !== '---' ? [[`line ${i + 1}`, line]] : [];
  });

const blank = (line: string) => line.trim() === '~';
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Each file holding a placeholder, in path order, with its placeholder paths and the word
 * count of its prose already written. A file that is not JSON is the compiler's to report. */
export function todo(source: string): Todo[] {
  const rows: Todo[] = [];
  for (const file of files(source)
    .filter((rel) => /\.(json|scene|cut)$/.test(rel))
    .sort()) {
    const raw = readFileSync(join(source, file), 'utf8');
    let lines = file.endsWith('.cut') ? cutLines(raw) : sceneLines(raw);
    if (file.endsWith('.json'))
      try {
        const parsed: unknown = JSON.parse(raw);
        lines = file === 'text.json' ? catalog(parsed) : markers(parsed);
      } catch {
        continue;
      }
    const placeholders = lines.filter(([, text]) => text.split('\n').some(blank)).map(([at]) => at);
    if (!placeholders.length) continue;
    const written = lines.flatMap(([, text]) => text.split('\n').filter((l) => !blank(l)));
    rows.push({ file, words: written.reduce((a, l) => a + words(l), 0), placeholders });
  }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir] = process.argv.slice(2);
  if (!dir) {
    console.error('usage: bin/loka todo <cartridge dir>');
    process.exit(2);
  }
  const rows = todo(dir);
  if (!rows.length) console.log('Nothing left to write.');
  for (const row of rows) {
    console.log(`${row.file} (${row.words} words written)`);
    for (const at of row.placeholders) console.log(`  ${at}`);
  }
}
