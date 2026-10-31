// The author panel (tools/author-panel) stays out of the app (docs/system/cartridge.md#author-preview):
// none of its own packages in mobile/app's dependencies, no app module or Metro config naming it,
// so no release, test or e2e bundle carries it.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const APP = join(import.meta.dirname, '..');
const deps = (dir: string) => {
  const p = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  return Object.keys({ ...p.dependencies, ...p.devDependencies });
};
// Used by the app before the panel existed; anything else the panel pulls in is the panel's own.
const SHARED = new Set([
  'react',
  'react-dom',
  'typescript',
  '@types/react',
  '@types/react-dom',
  'vite',
]);

// Breaks: a panel package (radix-ui, tailwind, shadcn's helpers; vite is already Storybook's) is installed into mobile/app,
// or an app module or metro.config.js reaches into tools/author-panel.
test('nothing of the author panel enters mobile/app', () => {
  const app = new Set(deps(APP));
  assert.deepEqual(
    deps(join(APP, '../../tools/author-panel')).filter((d) => !SHARED.has(d) && app.has(d)),
    [],
  );
  const sources = execFileSync('git', ['ls-files', '-z', '--', '*.ts', '*.tsx', '*.js', '*.cjs'], {
    cwd: APP,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
  const imports = /(?:from|import|require\()\s*['"][^'"]*author-panel/;
  assert.deepEqual(
    sources.filter((f) => imports.test(readFileSync(join(APP, f), 'utf8'))),
    [],
  );
});
