// E1 (storybook-plan-2026-10-08.md): every exported Book UI component carries its doc comment, has
// its catalogue index line, and is imported by some story.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = new URL('./', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, app), 'utf8');
const stories = readdirSync(new URL('stories/', app)).filter((f) => f.endsWith('.tsx'));

// Not drawn on their own: each with its reason.
const EXEMPT: Record<string, string> = {
  'book/Text.tsx:Text': 'every line of every story',
  'book/pages.tsx:Tap': 'shown through VerbLine and the room title',
  'book/lines.tsx:Here': 'the room page lines, shown through the RoomPage stories',
  'book/StatusIcon.tsx:Tooltip':
    'the status icon tip, shown through the StatusIcon Held and Focused stories',
  'book/Chip.tsx:Row': 'a titled chip row, shown through the WordBar stories and Chip ReadingSize',
  'book/MapDrawing.tsx:MapDrawing': 'a drawing, shown through the map pages',
};

// Every exported component, with its doc comment: a function, const or `{ X as Name }` export of a
// capitalised name. Any other capitalised export form is listed so the scan cannot silently miss one.
const files = [
  ...readdirSync(new URL('book/', app))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `book/${f}`),
  'SaveError.tsx',
];
const EXPORT = /^export (?:(?:default )?(?:function|const) ([A-Z]\w*)|\{ \w+ as ([A-Z]\w*) \})/gm;
const KNOWN =
  /^export (?:(?:default )?function \w+|(?:default )?const \w+ =|(?:type|interface)\b|\{ \w+ as [A-Z]\w* \}|\{ [a-z]\w* \})/;
const MULTI = /^export (?:default )?const .*, [A-Z]\w* =/; // `export const A = …, B = …`
const unknownExports: string[] = [];
const exported = files.flatMap((file) => {
  const src = read(file);
  for (const [line] of src.matchAll(/^export .*/gm))
    if (!KNOWN.test(line) || MULTI.test(line)) unknownExports.push(`${file}: ${line}`);
  return [...src.matchAll(EXPORT)].map((m) => ({
    file,
    name: m[1] ?? m[2]!,
    doc: /\/\*\*((?:(?!\*\/)[^])*)\*\/\s*$/.exec(src.slice(0, m.index))?.[1] ?? '',
  }));
});
const story = ({ doc }: { doc: string }) => /^ \* - Story: (\w+)\.stories\.tsx$/m.exec(doc)?.[1];

// Breaks: a component loses its doc comment (or a private helper's JSDoc sits between), its
// `- Use:`, names a story file that does not exist, or is exported in a form the scan cannot see.
test('every exported component has a doc comment with Use: and an existing Story:', () => {
  const bad = exported
    .filter((c) => !/^ \* - Use: /m.test(c.doc) || !stories.includes(`${story(c)}.stories.tsx`))
    .map(({ file, name }) => `${file}: ${name}`);
  assert.deepEqual([...bad, ...unknownExports], []);
});

// Breaks: the catalogue index drops, duplicates or misfiles a component, or its Story column
// disagrees with the doc comment.
test('the catalogue index lists each exported component once, with its file and story', () => {
  const md = read('../../docs/BOOK-UI-COMPONENTS.md');
  const [start, end] = [md.indexOf('## Component catalogue'), md.indexOf('## Page turn')];
  assert.ok(start >= 0 && end > start, 'the index sits between its heading and Page turn');
  const index = md.slice(start, end);
  const rows = [...index.matchAll(/^\| `(\w+)` \| `([\w/.]+)` \| (\w+) \|$/gm)];
  assert.deepEqual(
    rows.map(([, name, file, s]) => `${file}:${name}:${s}`).sort(),
    exported.map((c) => `${c.file}:${c.name}:${story(c)}`).sort(),
  );
});

// A story or a story helper (stories/screen.tsx) imports it, named or as the default.
test('every exported component has a story that imports it', () => {
  const imports = stories.flatMap((s) =>
    [
      ...read(`stories/${s}`).matchAll(
        /import\s+(?:type\s+)?(?:\{([^}]*)\}|(\w+))\s+from\s+'\.\.\/((?:book\/)?\w+\.tsx)'/g,
      ),
    ].flatMap(([, names, fallback, file]) =>
      (names ?? fallback!).split(',').map((n) => `${file}:${n.trim().split(/\s+as\s+/)[0]}`),
    ),
  );
  const missing = exported
    .map(({ file, name }) => `${file}:${name}`)
    .filter((key) => !(key in EXEMPT) && !imports.includes(key));
  assert.deepEqual(missing, []);
});

// Breaks: a token no component reads (a dead value the catalogue still describes). Palette roles and
// fonts are read through usePalette and `type`, so the groups checked are the named-value ones.
const NO_BOOK_CONSUMER: Record<string, string> = {
  'space.hair': 'read only by dev chrome (the picker overlay, the System dashboard)',
  'size.speechBar': 'the Log line row: waits until the log projects a speaker',
  'type.speaker': 'the Log line row: waits until the log projects a speaker',
};
test('every token has a consumer outside tokens.ts', async () => {
  const tokens: Record<string, object> = await import('./book/tokens.ts');
  const book = readdirSync(new URL('book/', app)).filter(
    (f) => /\.tsx?$/.test(f) && f !== 'tokens.ts' && !f.endsWith('.test.ts'),
  );
  const code = [...book.map((f) => `book/${f}`), 'App.tsx', 'SaveError.tsx'].map(read).join('\n');
  const groups = ['type', 'space', 'size', 'radius', 'opacity', 'motion', 'sound', 'nightSky'];
  const dead = groups.flatMap((g) =>
    Object.keys(tokens[g])
      .map((k) => `${g}.${k}`)
      .filter(
        (name) =>
          !(name in NO_BOOK_CONSUMER) &&
          !new RegExp(`\\b${name.replace('.', '\\.')}\\b`).test(code),
      ),
  );
  assert.deepEqual(dead, []);
});
