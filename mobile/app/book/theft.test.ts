// Toolbox row 33 (docs/system/mechanics.md, Theft, fence and witnessed offense): an NPC's holdings
// render on its entry like a container's contents, through the real Item page and GameSession.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { group } from './model.ts';
import { presenter } from './presenter.ts';

const ts = createRequire(import.meta.url)('typescript');
const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
registerHooks({
  resolve(specifier, context, next) {
    // Components are called outside React: the palette context reads its default (light).
    if (specifier === 'react') return { url: 'test:item-react', shortCircuit: true };
    return specifier === 'react-native'
      ? { url: 'test:item-native', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:item-react')
      return {
        format: 'module',
        shortCircuit: true,
        source: `export * from ${JSON.stringify(react)}; export const useContext = c => c._currentValue;`,
      };
    if (url === 'test:item-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',View='View',ScrollView='ScrollView',AccessibilityInfo={};",
      };
    if (!url.endsWith('.tsx')) return next(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText,
    };
  },
});
const { Item } = await import('./Menu.tsx');

function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  return typeof element.type === 'function'
    ? nodes(element.type(element.props))
    : [element, ...nodes(element.props?.children)];
}

const scratch = mkdtempSync(join(tmpdir(), 'loka-theft-book-'));
let artifact;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/theft_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = JSON.parse(readFileSync(file, 'utf8'));
} finally {
  rmSync(scratch, { recursive: true });
}

const sorted = (v: any): any =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted(v[k])]),
        )
      : v;
const canonical = JSON.stringify(sorted(artifact.cartridge));
const bundle = { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };

// Breaks: GameView stops listing what a living NPC holds, or Item drops contents for a non-item
// entry. Expected page text is independent literals from the sampler's text.json.
test('a merchant entry lists the purse it holds; the purse offers Take', (t) => {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle);
  t.after(() => a.sql.close());
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const screen = book.screen();
  const page = (name: string) => {
    const id = a.game.view().view.entities.find((e) => e.name === name)?.id;
    assert.ok(id, name);
    return nodes(
      Item({ id, screen, g: group(screen.buttons), press: book.press, open() {}, world() {} }),
    );
  };
  const merchant = page('npc.merchant.short');
  const text = merchant.filter((n) => n.type === 'Text').map((n) => n.props.children);
  assert.deepEqual(text, [
    'A merchant',
    'A merchant with a fat purse.',
    'Inside',
    'A purse',
    'Leave',
  ]);
  assert.ok(
    screen.buttons.some((b) => b.label === 'Take a purse'),
    JSON.stringify(screen.buttons.map((b) => b.label)),
  );
});
