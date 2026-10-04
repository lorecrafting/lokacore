// Real book components and session; native hosts are leaves, so this is no device/layout proof.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { openGame } from '../../authority/local-story/session.ts';
import { initialPages, pagesAfter, type Page } from './model.ts';
import { presenter } from './presenter.ts';

const ts = createRequire(import.meta.url)('typescript');
registerHooks({
  resolve(specifier, context, next) {
    return specifier === 'react-native'
      ? { url: 'test:native-hosts', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:native-hosts')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',View='View',ScrollView='ScrollView',SafeAreaView='SafeAreaView',AccessibilityInfo={},Easing={},Animated={View:'View'},PanResponder={};",
      };
    if (!url.endsWith('.tsx')) return next(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    };
  },
});
const { BookView } = await import('./Book.tsx');
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/cartridge_sampler_hash.json', import.meta.url),
    'utf8',
  ),
);

// Expand pure components only. Native animation and map gestures are exercised in Simulator review.
function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  if (typeof element.type === 'function') {
    if (element.type.name === 'Footer') return [element];
    return nodes(
      element.type.name === 'Turn' ? element.props.children : element.type(element.props),
    );
  }
  return [element, ...nodes(element.props?.children)];
}
const words = (element: any): string =>
  Array.isArray(element)
    ? element.map(words).join('')
    : typeof element === 'string' || typeof element === 'number'
      ? String(element)
      : words(element?.props?.children ?? []);

function book() {
  const sql = new DatabaseSync(':memory:');
  const game = openGame(
    {
      execSync: (s) => sql.exec(s),
      isInTransactionSync: () => sql.isTransaction,
      runSync: (s, ...p) => sql.prepare(s).run(...p),
      getFirstSync: (s, ...p) => sql.prepare(s).get(...p) ?? null,
      getAllSync: (s, ...p) => sql.prepare(s).all(...p),
    } as never,
    fixture,
    { newId: randomUUID, kernel_version: `loka-kernel@${'0'.repeat(40)}` },
  );
  const p = presenter(game);
  let stack: Page[] = initialPages(game.view().view);
  const draw = () =>
    nodes(
      BookView({
        screen: p.screen(),
        stack,
        flip: { turn: 0, dir: 1 },
        go: (pages) => {
          stack = pages;
        },
        press: (b, detail) => {
          const before = game.view().view;
          const line = p.press(b, detail);
          stack = pagesAfter(stack, before, game.view().view);
          return line;
        },
        refused: () => {},
        startOver: () => {},
        shell: { confirm: (f) => f(), learned: { seen: () => true, see: () => {} } },
      }),
    );
  const buttons = () => draw().filter((n) => n.type === 'Pressable' && !n.props.disabled);
  const labels = () => buttons().map((n) => n.props.accessibilityLabel);
  const tap = (label: string) => {
    const button = buttons().find((n) => n.props.accessibilityLabel === label);
    assert.ok(button, label);
    button.props.onPress();
  };
  const map = () => {
    const footer = draw().find((n) => n.type.name === 'Footer');
    assert.ok(footer);
    footer.props.openMap();
  };
  const text = () =>
    draw()
      .filter((n) => n.type === 'Text')
      .map(words);
  tap('Continue'); // opening chapter acknowledgement, through the actual route callback
  return { p, game, sql, draw, labels, tap, map, text };
}

// Breaks: room Ways returns, or a detail's Back still pops to Character instead of the world.
test('room is focused while Map retains directions and every detail returns to the world', () => {
  const h = book();
  assert.ok(h.labels().includes('Old Bram, open'));
  assert.equal(h.text().includes('North'), false);
  assert.equal(h.text().includes('Beyond north: Well Lane — a brass lantern.'), false);
  h.map();
  assert.ok(h.labels().includes('Go north'));
  assert.ok(h.text().includes('Beyond north: Well Lane — a brass lantern.'));
  h.tap('Back to World');
  h.tap(h.labels().find((s) => s.startsWith('Character,'))!);
  h.tap('Carrying');
  h.tap('Back to World');
  assert.ok(h.labels().includes('Old Bram, open'));
  assert.equal(h.labels().includes('Carrying'), false);
  h.sql.close();
});

// Breaks: NPC taps stay inline, choice Back closes its saved continuation, or choice results leak to room.
test('NPC details own choices and results while Back preserves the pending conversation', () => {
  const h = book();
  h.tap('Old Bram, open');
  assert.equal(h.labels().includes('Old Bram, open'), false);
  h.tap('Talk to Old Bram');
  const continuation = h.game.view().view.choice!.continuation_id;
  h.tap('Back to World');
  assert.equal(h.game.view().view.choice!.continuation_id, continuation);
  h.tap('Old Bram, open');
  assert.ok(h.labels().includes('Close'));
  h.tap('Back to World');
  h.map();
  h.tap('Go north');
  h.tap('Continue conversation');
  h.tap('Close');
  assert.equal(h.game.view().view.choice, undefined);
  assert.ok(h.text().includes('You leave the question for now.'));
  h.tap('Back to World');
  h.map();
  h.tap('Go south');
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  h.tap("Offer to fetch Bram's lantern");
  assert.ok(
    h.text().some((t) => t.includes("You say you'll fetch it. Bram nods toward the path north.")),
  );
  h.tap('Back to World');
  assert.equal(
    h.text().some((t) => t.includes("You say you'll fetch it. Bram nods toward the path north.")),
    false,
  );
  h.map();
  h.tap('Go north');
  h.tap('a brass lantern, open');
  h.tap('Take a brass lantern');
  h.tap('Back to World');
  h.map();
  h.tap('Go south');
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  h.tap('Keep the lantern');
  assert.equal(h.game.view().view.scene!.index, 1);
  assert.deepEqual(h.labels(), ['Continue']);
  h.sql.close();
});

// Breaks: Character still offers position verbs, or the status shortcut disappears after sitting.
test('only the room position target opens offered controls and a seated player can stand', () => {
  const h = book();
  h.tap('Position, standing');
  h.tap('Sit');
  assert.equal(h.game.view().view.position, 'sitting');
  assert.equal(h.labels().includes('Position, sitting'), false);
  h.tap('Back to World');
  h.tap('Position, sitting');
  h.tap('Stand');
  assert.equal(h.game.view().view.position, 'standing');
  h.tap('Back to World');
  h.tap(h.labels().find((s) => s.startsWith('Character,'))!);
  assert.deepEqual(
    h.labels().filter((s) => ['Stand', 'Sit', 'Rest', 'Sleep'].includes(s)),
    [],
  );
  assert.equal(h.labels().includes('Position, standing'), false);
  h.sql.close();
});

// Breaks: retrying an NPC's unconfirmed choice from Map forgets its original detail context.
test('an NPC choice retried from the world keeps its result in the original detail', () => {
  const h = book();
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  const bram = h.game.view().view.choice!.speaker_id!;
  h.sql.exec('PRAGMA query_only = 1');
  h.tap("Offer to fetch Bram's lantern");
  assert.equal(h.game.pending(), true);
  h.tap('Back to World');
  h.sql.exec('PRAGMA query_only = 0');
  h.map();
  h.tap('Go north'); // GameSession retries the choice, so no move occurs.
  assert.equal(h.game.pending(), false);
  assert.equal(h.game.view().view.place.title.key, 'room.ferry_landing.title');
  assert.deepEqual(h.p.screen().log, []);
  assert.equal(
    h.p.screen().detail(bram).at(-1),
    "You say you'll fetch it. Bram nods toward the path north.",
  );
  h.sql.close();
});
