// E1 (storybook-plan-2026-10-08.md): every catalogue Story file exists, and every exported Book UI
// component is imported by some story.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = new URL('./', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, app), 'utf8');
const stories = readdirSync(new URL('stories/', app)).filter((f) => f.endsWith('.stories.tsx'));

// Not drawn on their own: each with its reason.
const EXEMPT: Record<string, string> = {
  Tap: 'shown through VerbLine and the room title',
  SkillDetails: 'a block of the Character page; batch 4 shows it there',
  ItemDetails: 'a block of the Thing page; batch 4 shows it there',
  // batch 4 empties this list: whole pages get stories from screenFrom
  ...Object.fromEntries(
    'RoomPage ThingPage NpcPage ContentsPage Item NpcDetail CharacterPage AncestryPage JournalPage CarryingPage MapPage SettingsPage ChapterPage ScenePage NoticePage NoticeEntries DreamPage DreamResume Combat DiscoveredMap Body BookView Book'
      .split(' ')
      .map((name) => [name, 'whole page, batch 4']),
  ),
};
const EXEMPT_FILES = { 'MapDrawing.tsx': 'a drawing, shown through the map pages' };

test('every catalogue Story file exists', () => {
  const rows = read('../../docs/BOOK-UI-COMPONENTS.md')
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| Room page |')); // batch 4 adds its story
  const missing = rows.flatMap((row) => {
    const story = row.split('|').at(-2)!;
    return [...story.matchAll(/`stories\/(\w+)\.stories\.tsx`/g)]
      .filter(([, name]) => !stories.includes(`${name}.stories.tsx`))
      .map(([file]) => `${row.split('|')[1].trim()}: ${file}`);
  });
  assert.deepEqual(missing, []);
});

test('every exported component has a story that imports it', () => {
  const imports = stories.flatMap((story) =>
    [
      ...read(`stories/${story}`).matchAll(
        /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'\.\.\/book\/(\w+)\.tsx'/g,
      ),
    ].flatMap(([, names, file]) =>
      names.split(',').map((n) => `${file}:${n.trim().split(/\s+as\s+/)[0]}`),
    ),
  );
  const files = readdirSync(new URL('book/', app)).filter(
    (f) => f.endsWith('.tsx') && !(f in EXEMPT_FILES),
  );
  const missing = files.flatMap((file) =>
    [...read(`book/${file}`).matchAll(/^export function ([A-Z]\w*)/gm)]
      .map(([, name]) => name)
      .filter((name) => !(name in EXEMPT) && !imports.includes(`${file.slice(0, -4)}:${name}`))
      .map((name) => `${file}: ${name}`),
  );
  assert.deepEqual(missing, []);
});
