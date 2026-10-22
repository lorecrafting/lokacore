import { reactShim } from './__tests__/react-shim.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { group, pagesAfter, restoredItemPages } from './model.ts';
import { presenter } from './presenter.ts';
import { foodHost, onlyFood, entity } from '../../authority/local-story/__tests__/food-host.ts';
import { openGame } from '../../authority/local-story/session.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fadeStub } from './__tests__/fade-stub.ts';
const require = createRequire(import.meta.url);
const ts = require('typescript');
registerHooks({
  resolve(s, c, next) {
    // The page curl needs Skia and Reanimated; a page_turn.e2e.ts concern, not these tests'.
    if (s === './fade.ts') return fadeStub;
    if (s === './PageTurn.tsx')
      return {
        url: 'data:text/javascript,export function PageTurn(p){return p.children}',
        shortCircuit: true,
      };
    if (s === 'react') return { url: 'test:d4-react', shortCircuit: true };
    return s === 'react-native' ? { url: 'test:d4-native', shortCircuit: true } : next(s, c);
  },
  load(url, c, next) {
    if (url === 'test:d4-react') return reactShim(`globalThis.d4Hooks`);
    if (url === 'test:d4-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',TextInput='TextInput',View='View',ScrollView='ScrollView',SafeAreaView='SafeAreaView',AccessibilityInfo={},Easing={},Animated={View:'View',Value:class {}},PanResponder={create:()=>({panHandlers:{}})};",
      };
    if (!url.endsWith('.tsx')) return next(url, c);
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
const { default: Book, BookView } = await import('./Book.tsx');
function nodes(e: any): any[] {
  if (Array.isArray(e)) return e.flatMap(nodes);
  if (!e || typeof e !== 'object') return [];
  return typeof e.type === 'function' ? nodes(e.type(e.props)) : [e, ...nodes(e.props?.children)];
}

// Breaks: Eat leaves Carrying/item pages open or routes receipt narration to spent item detail after settlement/reopen.
test('actual Book Item Eat returns World once on normal and uncertain settlement and cold remount', (t) => {
  for (const uncertain of [false, true]) {
    const dir = mkdtempSync(join(tmpdir(), 'loka-book-food-')),
      path = join(dir, 'save.db'),
      a = foodHost(path, onlyFood);
    let game = a.game;
    const id = entity(a.initial, 'item', 'apple_01');
    const take = game.invoke({ action_key: 'take', target_ids: [id], input: {} } as never);
    assert.equal(take.kind === 'saved' && take.decision.kind, 'accepted');
    const slots: any[] = [],
      cleanups: (() => void)[] = [];
    let at = 0;
    (globalThis as any).d4Hooks = {
      state(v: any) {
        const i = at++;
        if (!(i in slots)) slots[i] = typeof v === 'function' ? v() : v;
        return [
          slots[i],
          (next: any) => {
            slots[i] = typeof next === 'function' ? next(slots[i]) : next;
          },
        ];
      },
      ref(v: any) {
        const i = at++;
        return (slots[i] ??= { current: v });
      },
      effect(f: () => () => void) {
        const i = at++;
        if (!(i in slots)) {
          slots[i] = true;
          cleanups.push(f());
        }
      },
    };
    const draw = () => {
      at = 0;
      return Book({
        game,
        shell: { confirm: (go) => go(), learned: { seen: () => true, see: () => {} } },
        startOver: () => undefined,
      });
    };
    try {
      draw().props.go([{ kind: 'carrying' }, { kind: 'thing', id }], 1);
      const displayed = draw(),
        before = a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
      const rendered = nodes(
        Item({
          id,
          screen: displayed.props.screen,
          g: group(displayed.props.screen.buttons),
          press: displayed.props.press,
          open: assert.fail,
          world: assert.fail,
        }),
      );
      const eat = rendered.find(
        (n) => n.type === 'Pressable' && n.props.accessibilityLabel === 'Eat a loaf',
      );
      assert.ok(eat);
      assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, before);
      if (uncertain) {
        a.fault.kind = 'lost';
        a.fault.armed = true;
      }
      eat.props.onPress();
      if (uncertain) {
        assert.equal(game.pending(), true);
        assert.deepEqual(draw().props.stack, [{ kind: 'carrying' }, { kind: 'thing', id }]);
        a.fault.reads = false;
        assert.equal(game.pulse('active').kind, 'ready');
      }
      assert.deepEqual(draw().props.stack, []);
      const line = 'You eat the loaf. It fills the hollow.';
      assert.equal(draw().props.screen.log.filter((s) => s === line).length, 1);
      assert.deepEqual(draw().props.screen.detail(id), []);
      game.pulse('active');
      assert.equal(draw().props.screen.log.filter((s) => s === line).length, 1);
      cleanups.forEach((f) => f?.());
      slots.length = 0;
      cleanups.length = 0;
      a.reopen();
      game = openGame(a.db, a.b, a.host);
      const cold = draw();
      assert.ok(!cold.props.stack.some((p) => ['thing', 'carrying'].includes(p.kind)));
      if (cold.props.stack.some((p) => p.kind === 'chapter')) {
        const chapter = BookView(cold.props).props.children.props.children.props.children[0].props
          .children;
        chapter.props.chapterDone();
      }
      assert.deepEqual(draw().props.stack, []);
      assert.equal(draw().props.screen.log.filter((s) => s === line).length, 1);
      assert.equal(game.lastNarration()?.detail_id, undefined);
    } finally {
      cleanups.forEach((f) => f?.());
      a.sql.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }
});
