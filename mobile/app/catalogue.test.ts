// E1 (storybook-plan-2026-10-08.md): every exported Book UI component carries its doc comment, has
// its catalogue index line, and is imported by some story.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { specs } from './stories/specs.ts';

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
  'book/Chip.tsx:Row': 'a titled chip row, shown through Chip ReadingSize',
  'book/MapDrawing.tsx:MapDrawing': 'a drawing, shown through the map pages',
  'book/lines.tsx:Fault': 'a press that threw; reached live only, no story throws one',
};

// Every exported component, with its doc comment (stories/specs.ts, shared with the specs page).
const files = [
  ...readdirSync(new URL('book/', app))
    .filter((f) => f.endsWith('.tsx'))
    .sort() // one table order on every filesystem
    .map((f) => `book/${f}`),
  'SaveError.tsx',
];
const scanned = files.map((file) => specs(file, read(file)));
const exported = scanned.flatMap((s) => s.components);
const unknownExports = scanned.flatMap((s) => s.unknown);
const story = ({ doc }: { doc: string }) => /^- Story: (\w+)\.stories\.tsx$/m.exec(doc)?.[1];

// Breaks: a component loses its doc comment (or a private helper's JSDoc sits between), its
// `- Use:`, names a story file that does not exist, or is exported in a form the scan cannot see.
test('every exported component has a doc comment with Use: and an existing Story:', () => {
  const bad = exported
    .filter((c) => !/^- Use: /m.test(c.doc) || !stories.includes(`${story(c)}.stories.tsx`))
    .map(({ file, name }) => `${file}: ${name}`);
  assert.deepEqual([...bad, ...unknownExports], []);
});

// Breaks: the scan passes over a capitalised export form it cannot read, so that component has no spec.
test('the scan reports an export form it cannot read', () => {
  for (const src of ['export let Foo = 1;', 'export const A = 1, B = 2;'])
    assert.equal(specs('x.tsx', src).unknown.length, 1, src);
});

// Breaks: the catalogue index drops, duplicates or misfiles a component, or its Story column
// disagrees with the doc comment. `LOKA_WRITE_GEN=1` (bin/regen.sh) rewrites the table from the scan.
test('the catalogue index is the table generated from the exported components', () => {
  const path = '../../docs/BOOK-UI-COMPONENTS.md';
  const md = read(path);
  const table = /(?<=## Component catalogue\n[^|]*)\| Component \|.*\n(?:\|.*\n)*/.exec(md);
  assert.ok(table && table.index < md.indexOf('## Page turn'), 'the index sits under its heading');
  const rows = exported.map((c) => `| \`${c.name}\` | \`${c.file}\` | ${story(c)} |\n`);
  const text = `| Component | File | Story |\n|---|---|---|\n${rows.join('')}`;
  if (process.env.LOKA_WRITE_GEN)
    return writeFileSync(new URL(path, app), md.replace(table[0], text));
  assert.equal(table[0], text, 'stale: rerun bin/regen.sh');
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
// fonts are read through usePalette and `type`, so the groups checked are the named-value ones. Type
// roles are read at the Reading size, through useType() (`const t = useType()`; loka-x6t.86).
const NO_BOOK_CONSUMER: Record<string, string> = {
  'type.speaker': 'the Log line row: waits until the log projects a speaker',
  ...Object.fromEntries(
    [
      'pickup',
      'coin',
      'level',
      'skillNew',
      'questDone',
      'questFailed',
      'questGained',
      'chapter',
      'impact',
      'fightIn',
    ].map((k) => [
      `sound.${k}`,
      'reached as sound[name] in play(name); played by the cue that names it (cueSounds.ts)',
    ]),
  ),
  ...Object.fromEntries(
    ['light', 'medium', 'heavy'].map((k) => [
      `haptic.${k}`,
      'reached as tokens.haptic[kind] in haptic(kind); its first caller comes with loka-gj82.4',
    ]),
  ),
  'mix.spread': 'pitch variation waits for the real samples',
};
test('every token has a consumer outside tokens.ts', async () => {
  const tokens: Record<string, object> = await import('./book/tokens.ts');
  const book = readdirSync(new URL('book/', app)).filter(
    (f) => /\.tsx?$/.test(f) && f !== 'tokens.ts' && !f.endsWith('.test.ts'),
  );
  const files = [...book.map((f) => `book/${f}`), 'App.tsx', 'SaveError.tsx'].map(read);
  // `t.` counts as a type read only where `t` is the Reading-size type (useType() or a Type parameter).
  const typed = files.filter((f) => /useType\(\)|\bt: Type\b/.test(f)).join('\n');
  const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const code = stripComments(files.join('\n'));
  const groups = [
    'type',
    'space',
    'size',
    'radius',
    'opacity',
    'motion',
    'sound',
    'mix',
    'haptic',
    'nightSky',
  ];
  const typedCode = stripComments(typed);
  const consumed = (name: string) => {
    const [g, k] = name.split('.') as [string, string];
    return (
      new RegExp(`(\\b${g}|useType\\(\\))\\.${k}\\b`).test(code) ||
      (g === 'type' && new RegExp(`\\bt\\.${k}\\b`).test(typedCode)) ||
      (g === 'sound' && new RegExp(`\\bplay\\('${k}'\\)`).test(code)) ||
      (g === 'haptic' && new RegExp(`\\bhaptic\\('${k}'\\)`).test(code))
    );
  };
  const dead = groups.flatMap((g) =>
    Object.keys(tokens[g])
      .map((k) => `${g}.${k}`)
      .filter((name) => !(name in NO_BOOK_CONSUMER) && !consumed(name)),
  );
  assert.deepEqual(dead, []);
  assert.deepEqual(Object.keys(NO_BOOK_CONSUMER).filter(consumed), [], 'stale escape: remove it');
});
