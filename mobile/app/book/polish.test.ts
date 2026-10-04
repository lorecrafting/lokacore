// Real book components and session; native hosts are leaves, so this is no device/layout proof.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { openGame } from '../../authority/local-story/session.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const react = pathToFileURL(require.resolve('react')).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react') return { url: 'test:book-state', shortCircuit: true };
    return specifier === 'react-native'
      ? { url: 'test:native-hosts', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:book-state')
      return {
        format: 'module',
        shortCircuit: true,
        source: `export * from ${JSON.stringify(react)}; export const useState = v => globalThis[Symbol.for('loka-book-test-state')](v);`,
      };
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
const { default: Book } = await import('./Book.tsx');
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
    if (element.type.name === 'Turn') return [element, ...nodes(element.props.children)];
    return nodes(element.type(element.props));
  }
  return [element, ...nodes(element.props?.children)];
}
const words = (element: any): string =>
  Array.isArray(element)
    ? element.map(words).join('')
    : typeof element === 'string' || typeof element === 'number'
      ? String(element)
      : words(element?.props?.children ?? []);

function book(cartridge = fixture) {
  const sql = new DatabaseSync(':memory:');
  const game = openGame(
    {
      execSync: (s) => sql.exec(s),
      isInTransactionSync: () => sql.isTransaction,
      runSync: (s, ...p) => sql.prepare(s).run(...p),
      getFirstSync: (s, ...p) => sql.prepare(s).get(...p) ?? null,
      getAllSync: (s, ...p) => sql.prepare(s).all(...p),
    } as never,
    cartridge,
    { newId: randomUUID, kernel_version: `loka-kernel@${'0'.repeat(40)}` },
  );
  const state: any[] = [];
  let slot = 0;
  const useState = (initial: any) => {
    const i = slot++;
    if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
    return [
      state[i],
      (v: any) => {
        state[i] = typeof v === 'function' ? v(state[i]) : v;
      },
    ];
  };
  const draw = () => {
    slot = 0;
    (globalThis as any)[Symbol.for('loka-book-test-state')] = useState;
    return nodes(
      Book({
        game,
        startOver: () => undefined,
        shell: { confirm: (f) => f(), learned: { seen: () => true, see: () => {} } },
      }),
    );
  };
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
  draw();
  if (game.view().view.chapter) tap('Continue'); // actual chapter route callback
  return {
    get p() {
      return state[0];
    },
    game,
    sql,
    draw,
    labels,
    tap,
    map,
    text,
  };
}

// Breaks: room title scrolls away, room Ways returns, or Back pops to Contents instead of World.
test('room is focused while Map retains directions and every detail returns to the world', () => {
  const h = book();
  const roomScroll = h.draw().find((n) => n.type === 'ScrollView');
  assert.equal(words(roomScroll).includes('Ferry Landing'), false);
  assert.ok(words(roomScroll).includes('Reeds crowd a slick wooden landing'));
  assert.ok(nodes(roomScroll).some((n) => n.props.accessibilityLabel === 'Old Bram, open'));
  assert.ok(h.text().includes('Ferry Landing'));
  assert.equal(h.labels().includes('Look, Ferry Landing'), false); // sampler offers no Look
  assert.ok(h.labels().includes('Old Bram, open'));
  assert.equal(h.text().includes('North'), false);
  assert.equal(h.text().includes('Beyond north: Well Lane — a brass lantern.'), false);
  h.map();
  assert.ok(h.labels().includes('Go north'));
  assert.ok(h.text().includes('Beyond north: Well Lane — a brass lantern.'));
  h.tap('Back to World');
  h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
  h.tap('Equipment & Inventory');
  h.tap('Back to World');
  assert.ok(h.labels().includes('Old Bram, open'));
  assert.equal(h.labels().includes('Equipment & Inventory'), false);
  const sections = ['Character', 'Equipment & Inventory', 'Map', 'Journal', 'Settings'];
  for (const section of sections) {
    h.tap(h.labels().find((label) => label.startsWith('Contents,'))!);
    assert.deepEqual(
      h.labels().filter((label) => sections.includes(label)),
      sections,
    );
    assert.ok(h.text().includes('Contents'));
    h.tap(section);
    assert.ok(h.text().includes(section));
    assert.deepEqual(
      h.labels().filter((label) => sections.includes(label)),
      [],
    );
    h.tap('Back to World');
    assert.ok(h.labels().includes('Old Bram, open'));
  }
  h.sql.close();
});

// Breaks: NPC taps stay inline, choice Back closes its saved continuation, or choice results leak to room.
test('NPC details own choices and results while Leave preserves the pending conversation', () => {
  const h = book();
  h.tap('Old Bram, open');
  const turn = () => h.draw().find((n) => n.type.name === 'Turn').props.turn;
  const entered = turn();
  assert.equal(h.labels().includes('Old Bram, open'), false);
  assert.equal(h.labels().includes('Back to World'), false);
  h.tap('Talk to Old Bram');
  assert.equal(turn(), entered);
  const speaker = h.game.view().view.choice!.speaker_id!;
  const prompt =
    'Bram keeps his eyes on the reeds. "My lantern’s beside the well, and I can’t leave the ferry. Would you fetch it?"';
  assert.deepEqual(h.p.screen().detail(speaker), [prompt]);
  h.draw();
  h.draw();
  assert.deepEqual(h.p.screen().detail(speaker), [prompt]);
  const scroll = h.draw().find((n) => n.type === 'ScrollView');
  assert.deepEqual(
    nodes(scroll).filter((n) => n.type === 'Pressable'),
    [],
  );
  assert.ok(h.labels().includes('Close'));
  assert.ok(h.labels().includes('Leave'));
  const continuation = h.game.view().view.choice!.continuation_id;
  h.tap('Leave');
  assert.equal(h.game.view().view.choice!.continuation_id, continuation);
  h.tap('Old Bram, open');
  assert.ok(h.labels().includes('Close'));
  h.tap('Leave');
  h.map();
  h.tap('Go north');
  h.tap('Continue conversation');
  h.tap('Close');
  assert.equal(h.game.view().view.choice, undefined);
  assert.ok(h.text().some((t) => t.includes('You leave the question for now.')));
  h.tap('Leave');
  h.map();
  h.tap('Go south');
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  const beforeResult = turn();
  h.tap("Offer to fetch Bram's lantern");
  assert.equal(turn(), beforeResult);
  assert.deepEqual(h.p.screen().detail(speaker), [
    prompt,
    'You leave the question for now.',
    prompt,
    "You say you'll fetch it. Bram nods toward the path north.",
  ]);
  assert.ok(
    h.text().some((t) => t.includes("You say you'll fetch it. Bram nods toward the path north.")),
  );
  h.tap('Leave');
  assert.equal(
    h.text().some((t) => t.includes("You say you'll fetch it. Bram nods toward the path north.")),
    false,
  );
  h.map();
  h.tap('Go north');
  h.tap('a brass lantern, open');
  h.tap('Take a brass lantern');
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
  h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
  h.tap('Character');
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
  h.tap('Leave');
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

// Breaks: an unconfirmed Take leaves the detail or announces success; retry loses its original
// target name or leaves Map open; a queued stale Take reopens its obsolete detail.
test('only confirmed pickup returns World, including a retry from another page', () => {
  const h = book();
  h.map();
  h.tap('Go north');
  h.tap('a brass lantern, open');
  assert.deepEqual(
    h.labels().filter((s) => !s.startsWith('Contents,')),
    ['Take a brass lantern', 'Leave'],
  );
  const drawnTake = h.draw().find((n) => n.props.accessibilityLabel === 'Take a brass lantern');
  h.sql.exec('PRAGMA query_only = 1');
  h.tap('Take a brass lantern');
  assert.equal(h.game.pending(), true);
  assert.ok(h.labels().includes('Leave'));
  assert.deepEqual(h.game.view().view.inventory, []);
  assert.equal(
    h.p.screen().log.some((s: string) => s === 'You pick up a brass lantern.'),
    false,
  );
  assert.match(h.p.screen().fault!, /readonly/);
  h.tap('Leave');
  h.sql.exec('PRAGMA query_only = 0');
  h.map();
  h.tap('Go south'); // retries Take; the player remains at Well Lane
  assert.equal(h.game.view().view.place.title.key, 'room.well_lane.title');
  assert.ok(h.text().includes('Well Lane'));
  assert.equal(h.labels().includes('Take a brass lantern'), false);
  assert.equal(h.p.screen().log.at(-1), 'You pick up a brass lantern.');
  h.draw();
  h.draw();
  assert.equal(h.p.screen().log.at(-1), 'You pick up a brass lantern.');
  drawnTake.props.onPress();
  assert.ok(h.labels().includes('Position, standing'));
  assert.equal(h.labels().includes('Leave'), false);
  assert.equal(
    h.p.screen().log.filter((s: string) => s === 'You pick up a brass lantern.').length,
    1,
  );
  h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
  h.tap('Equipment & Inventory');
  assert.ok(h.text().includes('Held'));
  h.tap('a brass lantern, open');
  assert.ok(h.labels().includes('Drop a brass lantern'));
  const token = h.game.view().token;
  h.tap('Leave');
  assert.equal(h.game.view().token, token);
  assert.ok(h.text().includes('Well Lane'));
  h.sql.close();
});

// Breaks: the item-only Give returns, or the guard rejects a complete Give with a real recipient.
test('touch omits incomplete Give but the complete item and recipient command remains valid', () => {
  const h = book();
  h.map();
  h.tap('Go north');
  h.tap('a brass lantern, open');
  h.tap('Take a brass lantern');
  const item = h.game.view().view.inventory[0];
  assert.equal(item.actions.find((a) => a.action_key === 'give')?.available, true);
  assert.equal(
    h.p.screen().buttons.some((b) => b.action_key === 'give'),
    false,
  );
  const token = h.game.view().token;
  const receipts = () => h.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  const before = receipts();
  h.p.press({ label: 'Give', action_key: 'give', target_ids: [item.id], input: {}, token });
  assert.equal(h.game.view().token, token);
  assert.equal(receipts(), before);
  h.map();
  h.tap('Go south');
  const npc = h.game.view().view.entities.find((e) => e.kind === 'npc')!;
  h.p.press({
    label: 'Give',
    action_key: 'give',
    target_ids: [item.id, npc.id],
    input: {},
    token: h.game.view().token,
  });
  assert.deepEqual(h.game.view().view.inventory, []);
  assert.notEqual(h.game.view().token, token);
  h.sql.close();
});

// Breaks: inventory Drop stays in detail, falsely succeeds while pending, or retry loses its name.
test('inventory Drop returns World with one named event only after confirmation', () => {
  const h = book();
  h.map();
  h.tap('Go north');
  h.tap('a brass lantern, open');
  h.tap('Take a brass lantern');
  h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
  h.tap('Equipment & Inventory');
  h.tap('a brass lantern, open');
  assert.equal(h.labels().includes('Take a brass lantern'), false);
  assert.ok(h.labels().includes('Drop a brass lantern'));
  h.sql.exec('PRAGMA query_only = 1');
  h.tap('Drop a brass lantern');
  assert.equal(h.game.pending(), true);
  assert.equal(h.game.view().view.inventory.length, 1);
  assert.ok(h.labels().includes('Leave'));
  assert.equal(
    h.p.screen().log.some((s: string) => s === 'You drop a brass lantern.'),
    false,
  );
  h.tap('Leave');
  h.sql.exec('PRAGMA query_only = 0');
  h.map();
  h.tap('Go south'); // retries Drop without walking
  assert.deepEqual(h.game.view().view.inventory, []);
  assert.ok(h.labels().includes('a brass lantern, open'));
  assert.ok(h.labels().includes('Position, standing'));
  assert.equal(h.labels().includes('Leave'), false);
  assert.equal(h.p.screen().log.at(-1), 'You drop a brass lantern.');
  h.draw();
  h.draw();
  assert.equal(h.p.screen().log.filter((s: string) => s === 'You drop a brass lantern.').length, 1);
  h.sql.close();
});

// Breaks: NPC history scoping also captures container results in a hidden item-only log.
test('other item actions retain their detail and World consequences', () => {
  const items = JSON.parse(
    readFileSync(
      new URL('../../../protocol/fixtures/cartridge_locks_hash.json', import.meta.url),
      'utf8',
    ),
  );
  const h = book(items);
  h.tap('a sewing box, open');
  h.tap('Open a sewing box');
  assert.ok(h.labels().includes('Leave'));
  assert.ok(h.labels().includes('Close a sewing box'));
  assert.equal(h.p.screen().log.at(-1), 'Opened.');
  h.tap('Leave');
  assert.ok(h.labels().includes('a sewing box, open'));
  h.sql.close();
});
