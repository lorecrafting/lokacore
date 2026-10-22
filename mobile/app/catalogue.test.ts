// E1 (storybook-plan-2026-10-08.md): every exported Book UI component carries its doc comment, has
// its catalogue index line, and is imported by some story.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = new URL('./', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, app), 'utf8');
const stories = readdirSync(new URL('stories/', app)).filter((f) => f.endsWith('.stories.tsx'));

// Not drawn on their own: each with its reason.
const EXEMPT: Record<string, string> = {
  Tap: 'shown through VerbLine and the room title',
  Here: 'the room page lines, shown through the RoomPage stories',
  Tooltip: 'the status icon tip, shown through the StatusIcon Held and Focused stories',
  'Chip:Row': 'a titled chip row, shown through the WordBar stories and Chip ReadingSize',
};
const EXEMPT_FILES = { 'MapDrawing.tsx': 'a drawing, shown through the map pages' };

// Every exported component, `book/<file>:<name>`, with the source before its export.
const files = [
  ...readdirSync(new URL('book/', app))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `book/${f}`),
  'SaveError.tsx',
];
const exported = files.flatMap((file) => {
  const src = read(file);
  return [...src.matchAll(/^export (?:default )?(?:function|const) ([A-Z]\w*)/gm)].map((m) => ({
    file,
    name: m[1],
    doc: /\/\*\*((?:(?!\*\/)[^])*)\*\/\s*$/.exec(src.slice(0, m.index))?.[1] ?? '',
  }));
});

// Breaks: a component loses its doc comment (or a private helper's JSDoc sits between), its `Use:`,
// or names a story file that does not exist.
test('every exported component has a doc comment with Use: and an existing Story:', () => {
  const bad = exported
    .filter(({ doc }) => {
      const story = /\* Story: (\w+\.stories\.tsx)$/m.exec(doc)?.[1];
      return !/\* Use: /.test(doc) || !story || !stories.includes(story);
    })
    .map(({ file, name }) => `${file}: ${name}`);
  assert.deepEqual(bad, []);
});

// Breaks: the catalogue index drops, duplicates or misfiles a component, or its Story column
// disagrees with the doc comment.
test('the catalogue index lists each exported component once, with its file and story', () => {
  const md = read('../../docs/BOOK-UI-COMPONENTS.md');
  const index = md.slice(md.indexOf('## Component catalogue'), md.indexOf('## Page turn'));
  const rows = [
    ...index.matchAll(/^\| `(\w+)` \| \[[^\]]+\]\(\.\.\/mobile\/app\/([\w/.]+)\) \| (\w+) \|$/gm),
  ];
  assert.deepEqual(
    rows.map(([, name, file, story]) => `${file}:${name}:${story}`).sort(),
    exported
      .map(({ file, name, doc }) => `${file}:${name}:${/\* Story: (\w+)\./m.exec(doc)?.[1]}`)
      .sort(),
  );
});

// A story or a story helper (stories/screen.tsx) imports it, named or as the default.
test('every exported component has a story that imports it', () => {
  const sources = readdirSync(new URL('stories/', app)).filter((f) => f.endsWith('.tsx'));
  const imports = sources.flatMap((story) =>
    [
      ...read(`stories/${story}`).matchAll(
        /import\s+(?:type\s+)?(?:\{([^}]*)\}|(\w+))\s+from\s+'\.\.\/book\/(\w+)\.tsx'/g,
      ),
    ].flatMap(([, names, fallback, file]) =>
      (names ?? fallback!).split(',').map((n) => `${file}:${n.trim().split(/\s+as\s+/)[0]}`),
    ),
  );
  const files = readdirSync(new URL('book/', app)).filter(
    (f) => f.endsWith('.tsx') && !(f in EXEMPT_FILES),
  );
  const missing = files.flatMap((file) =>
    [...read(`book/${file}`).matchAll(/^export (?:default )?(?:function|const) ([A-Z]\w*)/gm)]
      .map(([, name]) => name)
      .filter(
        (name) =>
          !(name in EXEMPT) &&
          !(`${file.slice(0, -4)}:${name}` in EXEMPT) &&
          !imports.includes(`${file.slice(0, -4)}:${name}`),
      )
      .map((name) => `${file}: ${name}`),
  );
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
