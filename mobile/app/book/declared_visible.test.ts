// Check (loka-kgd.174): state a cartridge declares reaches the player. For every stock cartridge,
// each declared resource pool and each declared status is in gameView(w) and on the Book's
// Character page, and each item a living NPC holds under world.theft is in the view and under
// Held on the NPC page. Breaks: a pool, status or held item the view drops or the Book stops
// drawing. Expected sets come from the compiled artifact's definition maps (resources, statuses,
// items, npcs: extends, bundles and the engine's hp, ma, mv included), never from the view.
// Room line variants are text-player only (mechanics.md:2301, book-ui.md:33), so not checked.
import { reactShim } from './__tests__/react-shim.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import {
  artifacts,
  besides,
  gameView,
  open,
  withStatuses,
  type World,
} from '../../authority/local-story/__tests__/declared-host.test.ts';
import { validate } from '../../authority/local-story/__tests__/validate.ts';

const ts = createRequire(import.meta.url)('typescript');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react') return { url: 'test:declared-react', shortCircuit: true };
    return specifier === 'react-native'
      ? { url: 'test:declared-native', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:declared-react')
      return reactShim(
        `({ ref: v => ({ current: v }), state: v => [v, () => {}], effect: () => {} })`,
      );
    if (url === 'test:declared-native')
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
const { CharacterPage } = await import('./sections.tsx');
const { NpcPage } = await import('./Npc.tsx');

function words(element: any): string[] {
  if (Array.isArray(element)) return element.flatMap(words);
  if (!element || typeof element !== 'object') return [];
  if (typeof element.type === 'function') return words(element.type(element.props));
  const flatten = (v: any): string =>
    Array.isArray(v) ? v.map(flatten).join('') : v === undefined || v === null ? '' : String(v);
  return element.type === 'Text'
    ? [flatten(element.props.children).toLowerCase()]
    : words(element.props.children);
}
const text = (key: string) => key;
const viewOf = (w: World) => {
  const view = gameView(w);
  assert.deepEqual(validate('GameView', view), []);
  return view;
};

// A pool the cartridge's spells charge beside the engine's ma, which the Book draws as the
// magic pool (showcase moved its spells to ma, 30c118de5): the player sees two magic pools, one
// unused. Fails rather than warns, as a warning in test output goes unread. Allowlisted cases
// are open content gaps: renaming the pool is a content and hash-fixture change. Shrink only.
const SPELL_POOL_BESIDE_MA = new Set(['spells_sampler']);
const spellPoolBesideMa = (w: World) => {
  const costs = Object.values(w.cartridge.scripted_actions ?? {})
    .filter((a: any) => a.target?.kind === 'spell')
    .flatMap((a: any) => (a.costs ?? []).map((x: any) => x.resource.key as string));
  return costs.length > 0 && !costs.includes('ma');
};

for (const [name, bytes] of artifacts()) {
  const w = open(bytes);
  // hello_sampler is a text-only greeting with no entry room.
  if (!w) continue;
  const c = w.cartridge;
  test(`${name}: declared pools and statuses are in the GameView and on the Character page`, () => {
    // No stock cartridge has a meal service, whose stock pool the view leaves out (resources.ts).
    const pools = Object.values(c.resources).map((r) => r.key);
    const statuses = Object.values(c.statuses ?? {}).map((s) => s.name);
    const view = viewOf(withStatuses(w));
    assert.deepEqual(view.resources.map((r) => r.resource.key).sort(), [...pools].sort());
    assert.deepEqual((view.conditions ?? []).map((x) => x.label).sort(), [...statuses].sort());
    const page = words(CharacterPage({ view, text, world: () => {} }));
    for (const k of pools)
      assert.ok(
        page.some((l) => l.startsWith(`${k}  `)),
        `pool ${k}`,
      );
    for (const s of statuses)
      assert.ok(
        page.some((l) => l.includes(s.toLowerCase())),
        `status ${s}`,
      );
    assert.equal(spellPoolBesideMa(w), SPELL_POOL_BESIDE_MA.has(name), 'spell pool beside ma');
  });

  // Held is scoped to world.theft (book-ui.md:476): elsewhere an NPC's holdings stay private.
  if (!c.world?.theft) continue;
  test(`${name}: each NPC's held items are in the GameView and under Held`, () => {
    for (const [ref, item] of Object.entries(c.items ?? {}) as [string, any][]) {
      if (item.location?.in !== 'npc') continue;
      const n = item.location.npc;
      const holder = `${n.cartridge_id}@${n.cartridge_version}:npc/${n.key}`;
      const npc = (c.npcs as any)[holder];
      // Shop stock is the shop page's, not Held (Npc.tsx held); an NPC's get lock keeps its
      // holdings private (mechanics.md:2960, the theft vault).
      if (npc.locks?.get) continue;
      const stock = (npc.shop?.offers ?? []).flatMap((o: any) => [
        o.item,
        ...(o.stock?.items ?? []),
      ]);
      if (stock.some((s: any) => s.key === item.key)) continue;
      const view = viewOf(besides(w, holder));
      const entity = view.entities.find((e) => e.id === w.entityIds[holder]);
      assert.ok(entity, `${holder} in the view`);
      assert.ok(
        ('contents' in entity ? (entity.contents ?? []) : []).some(
          (e) => e.id === w.entityIds[ref],
        ),
        `${ref} held in the view`,
      );
      const page = words(
        NpcPage({
          view,
          npc: entity,
          text,
          g: { on: () => [], word: [] },
          press() {},
          log: [],
          leave() {},
          open() {},
          talking: false,
        } as any),
      );
      const at = page.indexOf('held');
      assert.ok(
        at >= 0 && page.slice(at).includes(String(item.name).toLowerCase()),
        `${ref} under Held`,
      );
    }
  });
}
