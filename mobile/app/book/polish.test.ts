// Real book components and session; native hosts are leaves, so this is no device/layout proof.
// size: allow 750, Book routes, elapsed completion and carrying note regressions share one real-session adapter
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { openGame } from '../../authority/local-story/session.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import type { GameSubscription } from '../../packages/game-view/session.ts';

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
        source: `export * from ${JSON.stringify(react)}; export const useState = v => globalThis[Symbol.for('loka-book-test-state')](v); export const useRef = v => useState(() => ({ current: v }))[0]; export const useEffect = (f,d) => globalThis[Symbol.for('loka-book-test-effect')](f,d);`,
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
const bundle = (name = 'containers_cartridge_sampler_hash') =>
  JSON.parse(
    readFileSync(new URL(`../../../protocol/fixtures/${name}.json`, import.meta.url), 'utf8'),
  );
const fixture = bundle();

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

function book(cartridge = fixture, existing?: ReturnType<typeof elapsedHost>) {
  const sql = existing?.sql ?? new DatabaseSync(':memory:');
  const clock = existing?.clock ?? { wall: 10000, mono: 0 };
  let failedNarrationAfter: number | undefined;
  const game =
    existing?.game ??
    openGame(
      {
        execSync: (s) => sql.exec(s),
        isInTransactionSync: () => sql.isTransaction,
        runSync: (s, ...p) => sql.prepare(s).run(...p),
        getFirstSync: (s, ...p) => sql.prepare(s).get(...p) ?? null,
        getAllSync: (s, ...p) => sql.prepare(s).all(...p),
      } as never,
      cartridge,
      {
        newId: randomUUID,
        kernel_version: `loka-kernel@${'0'.repeat(40)}`,
        time: { wall: () => clock.wall, monotonic: () => clock.mono },
      },
    );
  const narration = game.lastNarration;
  game.lastNarration = (command_id?: string) => {
    const revision = sql.prepare('SELECT revision FROM head').get()!.revision as number;
    if (failedNarrationAfter !== undefined && revision > failedNarrationAfter) {
      failedNarrationAfter = undefined;
      sql.exec('SELECT * FROM missing_narration');
    }
    return narration(command_id);
  };
  const state: any[] = [];
  let slot = 0;
  const effects = new Map<number, { deps: unknown[]; cleanup?: () => void }>();
  const queued: (() => void)[] = [];
  const useEffect = (f: () => (() => void) | undefined, deps: unknown[]) => {
    const i = slot++,
      old = effects.get(i);
    if (old && old.deps.length === deps.length && deps.every((d, j) => Object.is(d, old.deps[j])))
      return;
    queued.push(() => {
      old?.cleanup?.();
      effects.set(i, { deps, cleanup: f() });
    });
  };
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
    (globalThis as any)[Symbol.for('loka-book-test-effect')] = useEffect;
    const rendered = nodes(
      Book({
        game,
        startOver: () => undefined,
        shell: { confirm: (f) => f(), learned: { seen: () => true, see: () => {} } },
      }),
    );
    for (const effect of queued.splice(0)) effect();
    return rendered;
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
    get stack() {
      return state[1];
    },
    game,
    sql,
    clock,
    unmount: () => {
      for (const e of effects.values()) e.cleanup?.();
    },
    failNarration: () =>
      (failedNarrationAfter = sql.prepare('SELECT revision FROM head').get()!.revision as number),
    draw,
    labels,
    tap,
    map,
    text,
  };
}

// Breaks: confirmed pelt Take returns to World, leaves the stale pelt child open, or restores
// its pickup on the World log instead of the exact corpse after reopening.
test('corpse Contents Take returns to its detail with one local pickup and Back to World', () => {
  const chapter = bundle('missing_child_c3_provisional_hash');
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, chapter);
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) => {
    const reply = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') assert.equal(reply.decision.kind, 'accepted');
  };
  for (const direction of ['south', 'south', 'east']) invoke('move', [], { direction });
  const member = a.game.view().view.entities.find((e) => e.name === 'npc.fen_hound.short')!;
  invoke('attack', [member.id]);
  let corpse = a.game.view().view.entities.find((e) => e.name === 'item.hound_corpse.short');
  for (let i = 0; i < 20 && !corpse; i++) {
    a.clock.wall += 3000;
    a.clock.mono += 3000;
    assert.equal(a.game.pulse().kind, 'ready');
    corpse = a.game.view().view.entities.find((e) => e.name === 'item.hound_corpse.short');
  }
  assert.ok(corpse);
  const pelt = corpse.contents!.find((e) => e.name === 'item.hound_pelt.short')!;
  const h = book(chapter, a);
  h.tap(h.labels().find((x) => x.includes('hound corpse') && x.includes('open'))!);
  h.tap(h.labels().find((x) => x.includes('hound pelt') && x.includes('open'))!);
  assert.deepEqual(
    h.stack.map((p: any) => p.id),
    [corpse.id, pelt.id],
  );
  assert.ok(
    h.labels().some((x) => x.startsWith('Take')),
    JSON.stringify(h.labels()),
  );
  h.tap(h.labels().find((x) => x.startsWith('Take'))!);
  assert.deepEqual(
    h.stack.map((p: any) => p.id),
    [corpse.id],
  );
  assert.equal(
    h.p
      .screen()
      .detail(corpse.id)
      .filter((x: string) => x === 'You pick up a hound pelt.').length,
    1,
  );
  assert.equal(h.p.screen().log.includes('You pick up a hound pelt.'), false);
  assert.ok(h.game.view().view.inventory.some((e) => e.id === pelt.id));
  h.tap('Leave');
  assert.deepEqual(h.stack, []);
  const drop = h.game.invoke({ action_key: 'drop', target_ids: [pelt.id], input: {} } as never);
  assert.equal(drop.kind, 'saved');
  if (drop.kind === 'saved') assert.equal(drop.decision.kind, 'accepted');
  h.unmount();
  const reopened = book(chapter, { ...a, game: openGame(a.db, chapter, a.host) });
  assert.equal(reopened.p.screen().log.includes('You pick up a hound pelt.'), false);
  reopened.tap(reopened.labels().find((x) => x.includes('hound corpse') && x.includes('open'))!);
  assert.equal(
    reopened.p
      .screen()
      .detail(corpse.id)
      .filter((x: string) => x === 'You pick up a hound pelt.').length,
    1,
  );
  reopened.unmount();
  a.sql.close();
});

// Breaks: room title scrolls away, room Ways returns, or Back pops to Contents instead of World.
test('room is focused while Map retains directions and every detail returns to the world', () => {
  const h = book();
  const roomScroll = h.draw().find((n) => n.type === 'ScrollView');
  assert.equal(words(roomScroll).includes('Ferry Landing'), false);
  assert.ok(words(roomScroll).includes('Reeds crowd a slick wooden landing'));
  assert.ok(nodes(roomScroll).some((n) => n.props.accessibilityLabel === 'Old Bram, open'));
  assert.ok(h.text().includes('Ferry Landing'));
  const drawnLook = h.draw().find((n) => n.props.accessibilityLabel === 'Look, Ferry Landing');
  assert.ok(drawnLook);
  const receipts = () => h.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  assert.equal(receipts(), 0);
  const token = h.game.view().token;
  h.tap('Look, Ferry Landing');
  assert.equal(receipts(), 1);
  assert.notEqual(h.game.view().token, token);
  assert.equal(h.game.view().view.place.title.key, 'room.ferry_landing.title');
  assert.deepEqual(h.p.screen().log, []);
  drawnLook.props.onPress(); // this captured title has the pre-Look freshness token
  assert.equal(receipts(), 1);
  assert.deepEqual(h.p.screen().log, ['The page had changed; here it is again.']);
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

// Breaks: a recovery read after commit escapes the press, hiding the result and retaining retry context.
test('a postcommit narration read fault preserves the saved result and clears retry context', () => {
  const h = book();
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  const speaker = h.game.view().view.choice!.speaker_id!;
  const result = "You say you'll fetch it. Bram nods toward the path north.";
  h.failNarration(); // Only narration recovery after an actual newly committed revision faults.
  assert.doesNotThrow(() => h.tap("Offer to fetch Bram's lantern"));
  assert.equal(h.game.pending(), false);
  assert.equal(h.game.view().view.journal[0].state, 'active');
  assert.deepEqual(h.p.screen().detail(speaker).slice(-2), [
    result,
    { text: 'Journal updated', event: true },
  ]);
  assert.ok(
    h
      .text()
      .includes('Saved result; narration recovery unavailable: no such table: missing_narration'),
  );
  h.tap('Leave');
  h.map();
  h.tap('Go north'); // a fresh move, not a replay of the committed choice
  assert.ok(h.text().includes('Well Lane'));
  assert.equal(
    h.p
      .screen()
      .detail(speaker)
      .filter((s: string) => s === result).length,
    1,
  );
  assert.equal(h.p.screen().fault, undefined);
  assert.deepEqual(h.p.screen().log, []);
  h.tap('a brass lantern, open');
  h.tap('Take a brass lantern');
  assert.deepEqual(h.p.screen().log, ['You pick up a brass lantern.']);
  h.sql.close();
});

// Breaks: Leave is redundant or closes optimistically, journal cues look like speech, or controls leave the log.
test('NPC history has distinct journal events and one confirmed Leave after the scrolling log', () => {
  const h = book();
  h.tap('Old Bram, open');
  const turn = () => h.draw().find((n) => n.type.name === 'Turn').props.turn;
  const entered = turn();
  assert.deepEqual(h.text().slice(0, 2), [
    'Old Bram',
    'A ferryman with rope-scarred hands and a coat that has never been dry.',
  ]);
  h.tap('Talk to Old Bram');
  assert.equal(turn(), entered);
  const speaker = h.game.view().view.choice!.speaker_id!;
  const prompt =
    'Bram keeps his eyes on the reeds. "My lantern’s beside the well, and I can’t leave the ferry. Would you fetch it?"';
  assert.deepEqual(h.p.screen().detail(speaker), [prompt]);
  const scroll = h.draw().find((n) => n.type === 'ScrollView');
  const controls = nodes(scroll);
  assert.ok(
    controls.findIndex((n) => words(n) === prompt) <
      controls.findIndex((n) => n.type === 'Pressable'),
  );
  assert.deepEqual(
    controls.filter((n) => n.type === 'Pressable').map((n) => n.props.accessibilityLabel),
    ["Offer to fetch Bram's lantern", 'Leave'],
  );
  h.tap('Leave');
  assert.equal(h.game.view().view.choice, undefined);
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
  h.tap('Map');
  h.tap('Go north'); // local section navigation preserves the pending choice
  h.tap('Continue conversation');
  h.tap('Leave'); // actual offered Close works without a projected speaker
  assert.equal(h.game.view().view.choice, undefined);
  h.map();
  h.tap('Go south');
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  const beforeResult = turn();
  h.tap("Offer to fetch Bram's lantern");
  assert.equal(turn(), beforeResult);
  assert.deepEqual(h.p.screen().detail(speaker), [
    prompt,
    prompt,
    prompt,
    "You say you'll fetch it. Bram nods toward the path north.",
    { text: 'Journal updated', event: true },
  ]);
  const flow = nodes(h.draw().find((n) => n.type === 'ScrollView'));
  assert.deepEqual(h.text().slice(0, 2), [
    'Old Bram',
    'A ferryman with rope-scarred hands and a coat that has never been dry.',
  ]);
  const cue = flow.findIndex((n) => n.type === 'Text' && words(n) === 'Journal updated');
  assert.equal(flow[cue].props.style.fontStyle, 'italic');
  assert.ok(cue < flow.findIndex((n) => n.type === 'Pressable'));
  h.tap('Leave');
  assert.equal(h.text().includes('Journal updated'), false);
  h.map();
  h.tap('Go north');
  h.tap('a brass lantern, open');
  const drawnTake = h.draw().find((n) => n.props.accessibilityLabel === 'Take a brass lantern');
  h.clock.wall += 250;
  h.clock.mono += 250;
  assert.equal(h.game.pulse().kind, 'ready');
  drawnTake.props.onPress(); // Breaks: the old-token shortcut keeps an item page after confirmed pickup.
  h.map();
  h.tap('Go south');
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  h.tap('Keep the lantern');
  assert.equal(h.game.view().view.scene!.index, 1);
  assert.deepEqual(h.labels(), ['Continue']);
  h.sql.close();
});

// Breaks: direct cycling opens a page, flips World, skips a legal state or reuses a new freshness token.
test('only World position taps directly cycle the offered states with captured freshness', () => {
  const h = book();
  const turn = h.draw().find((n) => n.type.name === 'Turn').props.turn;
  const drawn = h.draw().find((n) => n.props.accessibilityLabel === 'Position, standing');
  for (const [from, to] of [
    ['standing', 'sitting'],
    ['sitting', 'resting'],
    ['resting', 'sleeping'],
    ['sleeping', 'standing'],
  ]) {
    h.tap(`Position, ${from}`);
    assert.equal(h.game.view().view.position, to);
    assert.equal(h.draw().find((n) => n.type.name === 'Turn').props.turn, turn);
    assert.ok(h.labels().includes('Old Bram, open'));
  }
  const token = h.game.view().token;
  drawn.props.onPress();
  assert.equal(h.game.view().token, token);
  assert.equal(h.game.view().view.position, 'standing');
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
  h.tap('Leave'); // still unconfirmed, so detail remains
  assert.deepEqual(
    h.p
      .screen()
      .detail(bram)
      .filter((line) => typeof line !== 'string'),
    [],
  );
  h.sql.exec('PRAGMA query_only = 0');
  h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
  h.tap('Map');
  h.tap('Go north'); // GameSession retries the choice, so no move occurs.
  assert.equal(h.game.pending(), false);
  assert.equal(h.game.view().view.place.title.key, 'room.ferry_landing.title');
  assert.deepEqual(h.p.screen().log, []);
  assert.deepEqual(h.p.screen().detail(bram).slice(-2), [
    "You say you'll fetch it. Bram nods toward the path north.",
    { text: 'Journal updated', event: true },
  ]);
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
  assert.deepEqual(h.text().slice(0, 2), [
    'A brass lantern',
    'Dented brass with a horn window, oil sloshing inside.',
  ]);
  assert.equal(h.labels().includes('Take a brass lantern'), false);
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
  assert.equal(h.p.screen().log.filter((s: string) => s === 'You drop a brass lantern.').length, 1);
  h.sql.close();
});

// Breaks: a retained container result is hidden or leaks into World instead of its item detail.
test('other item actions retain their detail and show their consequences there', () => {
  const items = JSON.parse(
    readFileSync(
      new URL('../../../protocol/fixtures/containers_cartridge_locks_hash.json', import.meta.url),
      'utf8',
    ),
  );
  const h = book(items);
  h.tap('a sewing box, open');
  h.tap('Open a sewing box');
  assert.ok(h.labels().includes('Leave'));
  assert.ok(h.labels().includes('Close a sewing box'));
  assert.ok(h.text().includes('Opened.'));
  assert.equal(h.p.screen().log.includes('Opened.'), false);
  h.tap('Leave');
  assert.ok(h.labels().includes('a sewing box, open'));
  h.sql.close();
});

// Breaks: a confirmed boundary is ignored/coalesced, resets the chapter acknowledgment,
// flips a same-room page, or removes a departed speaker's actual continuation/history.
test('elapsed confirmed boundaries retain Conversation and chapter acknowledgment without page flips', () => {
  const h = book(bundle('containers_sampler_v010_hash'));
  try {
    h.tap('Old Bram, open');
    h.tap('Talk to Old Bram');
    const speaker = h.game.view().view.choice!.speaker_id!;
    const before = [...h.p.screen().detail(speaker)];
    const turn = () => h.draw().find((n) => n.type.name === 'Turn').props.turn;
    const opened = turn();
    h.clock.wall = 82000;
    h.clock.mono = 72000;
    assert.equal(h.game.pulse().kind, 'ready');
    assert.equal(h.game.view().view.time, 68400);
    assert.ok(h.text().includes('Conversation'));
    assert.ok(h.labels().includes('Leave'));
    assert.ok(h.text().includes('They are not here to answer. Find them, or close this.'));
    assert.deepEqual(h.p.screen().detail(speaker), before);
    assert.deepEqual(h.p.screen().log, ['Old Bram leaves.']);
    assert.equal(turn(), opened);
    // Consecutive committed boundaries in one host pulse must each be consumed, despite batching.
    h.clock.wall = 1810000;
    h.clock.mono = 1800000;
    assert.equal(h.game.pulse().kind, 'ready');
    assert.deepEqual(h.p.screen().log, [
      'Old Bram leaves.',
      'Old Bram arrives.',
      'Old Bram leaves.',
    ]);
    assert.equal(turn(), opened);
    h.tap('Leave');
    assert.equal(h.game.view().view.choice, undefined);
    assert.ok(h.text().includes('Ferry Landing'));
    assert.equal(
      h.p.screen().log.filter((s: string) => s.includes('leave the question')).length,
      0,
    );
    const worldTurn = turn();
    h.clock.wall = 2602000;
    h.clock.mono = 2592000;
    assert.equal(h.game.pulse().kind, 'ready');
    assert.equal(h.game.view().view.time, 194400);
    assert.ok(h.labels().includes('Old Bram, open'));
    assert.equal(turn(), worldTurn);
  } finally {
    h.unmount();
    h.sql.close();
  }
});

// Breaks: B's conflict drops delayed A's item context, or terminal replay duplicates its pickup.
test('delayed Take returns once with its original item name after a conflicting tap', () => {
  const a = elapsedHost(),
    h = book(fixture, a),
    completed: GameSubscription[] = [];
  h.game.subscribe((u) => {
    if (u.kind === 'completion') completed.push(u);
  });
  try {
    h.tap('a brass lantern, open');
    h.clock.wall += 15984000;
    h.clock.mono = 15984000;
    h.tap('Take a brass lantern');
    const id = h.game.pendingInvocation();
    assert.ok(id);
    assert.equal(h.p.screen().pending, false);
    assert.ok(h.text().includes('Catching up…'));
    assert.ok(h.labels().includes('Leave'));
    const different = { label: 'Rest', action_key: 'rest', target_ids: [], input: {} };
    h.p.press(different);
    assert.equal(h.game.pendingInvocation(), id);
    const refused = h.game.invoke({ action_key: 'rest' as never, target_ids: [], input: {} });
    assert.equal(refused.kind, 'conflict');
    assert.equal(
      h.p.update({
        kind: 'completion',
        invocation_id: 'another-action',
        intent: { action_key: 'rest' as never, target_ids: [], input: {} },
        before: h.game.view(),
        reply: refused,
      }),
      false,
    );
    assert.equal(h.game.pendingInvocation(), id);
    assert.equal(h.game.pulse().kind, 'ready');
    assert.ok(h.text().includes('Ferry Landing'));
    assert.equal(
      h.p.screen().log.filter((s: string) => s === 'You pick up a brass lantern.').length,
      1,
    );
    assert.equal(h.p.screen().log.includes('Taken.'), false);
    assert.equal(h.p.update(completed[0]), false);
    assert.equal(
      h.p.screen().log.filter((s: string) => s === 'You pick up a brass lantern.').length,
      1,
    );
    h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
    h.tap('Equipment & Inventory');
    h.tap('a brass lantern, open');
    const turn = h.draw().find((n) => n.type.name === 'Turn').props.turn;
    h.clock.wall += 20;
    h.clock.mono += 20;
    h.game.pulse();
    assert.ok(h.labels().includes('Drop a brass lantern'));
    assert.equal(h.draw().find((n) => n.type.name === 'Turn').props.turn, turn);
  } finally {
    h.unmount();
    h.sql.close();
  }
});

// Breaks: delayed quest completion loses original NPC history or repeats the neutral journal event.
test('delayed actual quest completion adds one authored result and Journal updated in original history', () => {
  const h = book(bundle('containers_sampler_v010_hash')),
    completed: GameSubscription[] = [];
  h.game.subscribe((u) => {
    if (u.kind === 'completion') completed.push(u);
  });
  try {
    h.tap('Old Bram, open');
    h.tap('Talk to Old Bram');
    const speaker = h.game.view().view.choice!.speaker_id!;
    h.clock.wall += 15552000;
    h.clock.mono = 15552000;
    h.tap("Offer to fetch Bram's lantern");
    assert.equal(h.game.pending(), true);
    assert.equal(h.game.pulse().kind, 'ready');
    assert.equal(h.game.view().view.time, 842400);
    assert.equal(h.game.view().view.journal[0].state, 'active');
    const history = h.p.screen().detail(speaker);
    assert.equal(
      history.filter(
        (s: unknown) => s === "You say you'll fetch it. Bram nods toward the path north.",
      ).length,
      1,
    );
    assert.deepEqual(
      history.filter((s: unknown) => typeof s !== 'string'),
      [{ text: 'Journal updated', event: true }],
    );
    assert.equal(h.p.update(completed[0]), false);
    assert.equal(history.filter((s: unknown) => typeof s !== 'string').length, 1);
  } finally {
    h.unmount();
    h.sql.close();
  }
});

// Breaks: available-only buttons hide the carrying reason, or shedding worn load leaves a stale note.
test('actual trunk detail explains refused Take and restores its button after Remove then Drop', () => {
  const h = book();
  const go = (direction: string) => {
    h.map();
    h.tap(`Go ${direction}`);
  };
  const take = (name: string) => {
    h.tap(`${name}, open`);
    h.tap(`Take ${name}`);
  };
  go('north');
  take('a brass lantern');
  go('east');
  go('up');
  take('a brass key');
  take('a wool cloak');
  const carrying = () => {
    h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
    h.tap('Equipment & Inventory');
  };
  carrying();
  h.tap('a wool cloak, open');
  h.tap('Wear a wool cloak');
  h.tap('Leave');
  go('up');
  h.tap('an old trunk, open');
  assert.ok(h.text().includes('Take: too heavy to carry.'));
  assert.equal(h.labels().includes('Take an old trunk'), false);
  h.tap('Leave');
  carrying();
  h.tap('a wool cloak, open');
  h.tap('Remove a wool cloak');
  assert.equal(h.labels().includes('Drop a wool cloak'), true);
  h.tap('Drop a wool cloak');
  h.tap('an old trunk, open');
  assert.equal(
    h.text().some((s) => s.includes('too heavy to carry')),
    false,
  );
  assert.ok(h.labels().includes('Take an old trunk'));
  h.tap('Take an old trunk');
  assert.ok(h.game.view().view.inventory.some((e) => e.name === 'item.trunk.short'));
  h.unmount();
  h.sql.close();
});
