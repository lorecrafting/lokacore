// Toolbox row 33 (docs/system/mechanics.md, Theft, fence and witnessed offense): an NPC's holdings
// render on its entry like a container's contents, through the real Item page and GameSession.
import { reactShim } from './__tests__/react-shim.ts';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { group } from './model.ts';
import { presenter } from './presenter.ts';
import { LABEL } from './labels.ts';

const ts = createRequire(import.meta.url)('typescript');
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
      return reactShim('({ state: v => [v, () => {}], effect: () => {} })');
    if (url === 'test:item-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',TextInput='TextInput',View='View',ScrollView='ScrollView',AccessibilityInfo={};",
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
const { InsidePage, Item, ThingPage } = await import('./Menu.tsx');
const { NpcDetail, NpcPage } = await import('./Npc.tsx');

function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  return typeof element.type === 'function'
    ? nodes(element.type(element.props))
    : [element, ...nodes(element.props?.children)];
}
// A Text's words, its inline links' words included.
const line = (n: any): string =>
  typeof n === 'string'
    ? n
    : Array.isArray(n)
      ? n.map(line).join('')
      : n?.props
        ? line(n.props.children)
        : '';
const texts = (ns: any[]) => ns.filter((n) => n.type === 'Text').map(line);

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
// lists it again or loses Look, or the Look page's carried sentence drops the item or stops
// opening its page (designer, row 33; loka-aqnc). Expected page text is independent literals from the sampler's text.json.
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
  assert.deepEqual(texts(merchant), [
    'A merchant',
    'A merchant with a fat purse.',
    'Look',
    'Leave',
  ]);
  merchant.find((n) => n.props.accessibilityLabel === LABEL.lookPerson).props.onPress();
  assert.deepEqual(opened.pop(), { kind: 'inside', id: id('npc.merchant.short') });
  const look = nodes(
    InsidePage({ screen, id: id('npc.merchant.short'), open: (r) => opened.push(r), close() {} }),
  );
  assert.deepEqual(texts(look).slice(0, 3), [
    'A merchant',
    'A merchant with a fat purse.',
    'A merchant carries a purse.',
  ]);
  look.find((n) => n.props.accessibilityLabel === 'a purse, open').props.onPress();
  const [purse] = opened as { kind: string; id: string }[];
  assert.equal(purse?.kind, 'thing');
  const item = nodes(Item({ id: purse.id, screen, g, press: book.press, open() {}, world() {} }));
  const words = item.filter((n) => n.type === 'Text').map((n) => n.props.children);
  assert.deepEqual(words.slice(-3), ['A merchant is holding it.', 'Lift', 'Leave']); // pass-1 E14
  // A container (any non-NPC entry) offers Look inside, its contents on their own page (loka-mo0p).
  const box = { id: 'box', kind: 'item', name: 'box', actions: [] };
  const coin = { ...box, id: 'coin', name: 'coin' };
  const view = { entities: [box, { ...coin, container_id: 'box' }], inventory: [] };
  const shelf = nodes(
    ThingPage({ thing: box, text: (k: string) => k, actions: [], log: [], view } as any),
  ).map((n) => n.props.children);
  assert.ok(shelf.includes(LABEL.lookInside) && !shelf.includes(LABEL.inside));
  // Look stands in for the list and steps aside while a conversation runs; the Look page carries
  // only this person's things, shop stock left out (Npc.tsx Rules, InsidePage).
  const m = { id: 'm', kind: 'npc', name: 'm', actions: [], shop: [{ item_id: 'coin' }] };
  const npcView = {
    entities: [
      m,
      { ...box, container_id: 'm' },
      { ...coin, container_id: 'm' },
      { ...box, id: 'b2', name: 'b2', container_id: 'other' },
    ],
    inventory: [],
  };
  const page = (talking: boolean) =>
    texts(
      nodes(
        NpcPage({
          view: npcView,
          npc: m,
          text: (k: string) => k,
          g: { on: () => [], word: [] },
          press() {},
          log: [],
          leave() {},
          open() {},
          look() {},
          talking,
        } as any),
      ),
    );
  assert.deepEqual(page(false), ['M', 'Look', 'Leave']);
  assert.deepEqual(page(true), ['M', 'Leave the conversation']);
  const carried = InsidePage({
    screen: { view: npcView, text: (k: string) => k },
    id: 'm',
    open() {},
  } as any);
  // The sentence, then its inline link's own Text; the coin is shop stock, b2 another's.
  assert.deepEqual(texts(nodes(carried)), ['M', 'M carries box.', 'box', 'Close']);
});
