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
const { Item, ThingPage } = await import('./Menu.tsx');
const { NpcDetail, NpcPage } = await import('./Npc.tsx');

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

// Breaks: GameView stops listing what a living NPC holds, the NPC page (Body's route for an NPC)
// drops its Held list or its line stops opening the item's page, or a living NPC's holdings list
// under Inside instead of Held (designer, row 33). Expected page text is independent literals from the sampler's text.json.
test('a merchant entry lists the purse it holds; the purse offers Take', (t) => {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle);
  t.after(() => a.sql.close());
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const screen = book.screen();
  const id = (name: string) => {
    const found = a.game.view().view.entities.find((e) => e.name === name)?.id;
    assert.ok(found, name);
    return found;
  };
  const opened: unknown[] = [];
  const g = group(screen.buttons);
  const merchant = nodes(
    NpcDetail({
      screen,
      g,
      press: book.press,
      speaker: id('npc.merchant.short'),
      world() {},
      open: (r) => opened.push(r),
    }),
  );
  const text = merchant.filter((n) => n.type === 'Text').map((n) => n.props.children);
  assert.deepEqual(text, [
    'A merchant',
    'A merchant with a fat purse.',
    'Held',
    'A purse',
    'Leave',
  ]);
  merchant.find((n) => n.props.accessibilityLabel === 'A purse, open').props.onPress();
  const [purse] = opened as { kind: string; id: string }[];
  assert.equal(purse?.kind, 'thing');
  const item = nodes(Item({ id: purse.id, screen, g, press: book.press, open() {}, world() {} }));
  const words = item.filter((n) => n.type === 'Text').map((n) => n.props.children);
  assert.ok(words.includes('A purse') && words.includes('Take a purse'), JSON.stringify(words));
  // A container (any non-NPC entry) keeps Inside.
  const box = { id: 'box', kind: 'item', name: 'box', actions: [] };
  const coin = { ...box, id: 'coin', name: 'coin' };
  const shelf = nodes(
    ThingPage({ thing: box, text: (k: string) => k, actions: [], log: [], contents: [coin] }),
  );
  assert.ok(shelf.some((n) => n.props.children === 'Inside'));
  // Held lists only this NPC's things, and steps aside while a conversation runs.
  const m = { id: 'm', kind: 'npc', name: 'm', actions: [] };
  const held = (talking: boolean) =>
    nodes(
      NpcPage({
        view: {
          entities: [m, { ...box, container_id: 'm' }, { ...coin, container_id: 'other' }],
          inventory: [],
        },
        npc: m,
        text: (k: string) => k,
        g: { on: () => [] },
        press() {},
        log: [],
        leave() {},
        open() {},
        talking,
      } as any),
    )
      .filter((n) => n.type === 'Text')
      .map((n) => n.props.children);
  assert.deepEqual(held(false).slice(1), ['Held', 'Box', 'Leave']);
  assert.ok(!held(true).includes('Held'));
});
