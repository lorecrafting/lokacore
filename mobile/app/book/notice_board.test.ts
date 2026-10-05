// size: allow 650, Read and Study routes/retry/recovery share one controlled Book renderer
// Real Book routes and authority; native leaves are not device/layout evidence.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { elapsedHost, receipts } from '../../authority/local-story/__tests__/elapsed-host.test.ts';

const require = createRequire(import.meta.url),
  ts = require('typescript');
const react = pathToFileURL(require.resolve('react')).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react') return { url: 'test:notice-state', shortCircuit: true };
    return specifier === 'react-native'
      ? { url: 'test:notice-native', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:notice-state')
      return {
        format: 'module',
        shortCircuit: true,
        source: `export * from ${JSON.stringify(react)}; export const useState=v=>globalThis[Symbol.for('notice-state')](v); export const useRef=v=>useState(()=>({current:v}))[0]; export const useEffect=(f,d)=>globalThis[Symbol.for('notice-effect')](f,d);`,
      };
    if (url === 'test:notice-native')
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
const bundle = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/missing_child_v009_hash.json', import.meta.url),
    'utf8',
  ),
);
const landing = '05f6aca0-79cd-83fe-8096-bae95b0730e8';
const whistle = '58ee172d-aa6f-8023-a3c1-a1d46af6d167';
const cellar = 'f14e477f-cecc-897a-bee7-c573aa5c76c3';
const whistleBody = 'Lost a tin whistle? Ask at the Drowned Lantern.';
const cellarBody = 'Maud needs help clearing rats from the cellar. Speak to her at the bar.';
const landingBody = 'Keep the landing clear. Tie boats to the mooring post.';
function nodes(e: any): any[] {
  if (Array.isArray(e)) return e.flatMap(nodes);
  if (!e || typeof e !== 'object') return [];
  if (typeof e.type === 'function') {
    if (e.type.name === 'Footer') return [e];
    if (e.type.name === 'Turn') return [e, ...nodes(e.props.children)];
    return nodes(e.type(e.props));
  }
  return [e, ...nodes(e.props?.children)];
}
const words = (e: any): string =>
  Array.isArray(e)
    ? e.map(words).join('')
    : typeof e === 'string' || typeof e === 'number'
      ? String(e)
      : words(e?.props?.children ?? []);
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
function preview(input = bundle, path = ':memory:') {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, input);
  const state: any[] = [],
    effects = new Map<number, { deps: any[]; cleanup?: () => void }>();
  let slot = 0;
  const draw = () => {
    slot = 0;
    const queued: (() => void)[] = [];
    (globalThis as any)[Symbol.for('notice-state')] = (v: any) => {
      const i = slot++;
      if (!(i in state)) state[i] = typeof v === 'function' ? v() : v;
      return [
        state[i],
        (next: any) => {
          state[i] = typeof next === 'function' ? next(state[i]) : next;
        },
      ];
    };
    (globalThis as any)[Symbol.for('notice-effect')] = (f: any, deps: any[]) => {
      const i = slot++,
        old = effects.get(i);
      if (old && deps.every((d, j) => Object.is(d, old.deps[j]))) return;
      queued.push(() => {
        old?.cleanup?.();
        effects.set(i, { deps, cleanup: f() });
      });
    };
    const result = nodes(
      Book({
        game: a.game,
        startOver: () => undefined,
        shell: { confirm: (f) => f(), learned: { seen: () => true, see: () => {} } },
      }),
    );
    queued.forEach((f) => f());
    return result;
  };
  const labels = () =>
    draw()
      .filter((n) => n.type === 'Pressable' && !n.props.disabled)
      .map((n) => n.props.accessibilityLabel);
  const tap = (label: string) => {
    const b = draw().find(
      (n) => n.type === 'Pressable' && !n.props.disabled && n.props.accessibilityLabel === label,
    );
    assert.ok(b, label);
    b.props.onPress();
  };
  const text = () =>
    draw()
      .filter((n) => n.type === 'Text')
      .map((n) => words(n.props.children));
  draw();
  tap('Continue');
  return {
    ...a,
    draw,
    tap,
    labels,
    text,
    presenter: () => state[0],
    stack: () => state[1],
    walk: (direction: string) =>
      draw()
        .find((n) => n.type.name === 'Footer')
        .props.go(direction),
  };
}

// Breaks: direct Read stays on World, child targets are swapped, Back clears the parent,
// navigation writes receipts, or the confirmed body is drawn outside description/log/options order.
test('landing detail and two board children read exact targets and pop back without navigation receipts', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  assert.ok(!a.labels().includes('Read the notice'));
  a.tap('Landing notice');
  assert.deepEqual(a.stack(), [{ kind: 'notice', id: landing }]);
  assert.deepEqual(a.text().slice(0, 4), [
    'Landing notice',
    'A weathered notice is nailed to the mooring post.',
    landingBody,
    'Leave',
  ]);
  assert.equal(receipts(a.sql), 1);
  a.tap('Leave');
  assert.deepEqual(a.stack(), []);
  assert.equal(receipts(a.sql), 1);
  assert.ok(!a.text().includes(landingBody));
  a.walk('north');
  a.walk('east');
  a.draw();
  const count = receipts(a.sql);
  a.tap('Notice board');
  assert.equal(receipts(a.sql), count);
  assert.deepEqual(a.text().slice(0, 4), [
    'Notice board',
    'Two notices are pinned to a wooden board beside the bar.',
    'Lost tin whistle',
    'Help in the cellar',
  ]);
  for (const [title, id, description, body] of [
    [
      'Lost tin whistle',
      whistle,
      'A small handwritten notice asks about a missing whistle.',
      whistleBody,
    ],
    ['Help in the cellar', cellar, 'A notice from Maud asks for help below the inn.', cellarBody],
  ]) {
    const before = receipts(a.sql);
    a.tap(title);
    assert.equal(a.stack().at(-1).id, id);
    assert.deepEqual(a.text().slice(0, 4), [title, description, body, 'Back to board']);
    const receipt = JSON.parse(
      a.sql.prepare('SELECT command FROM receipt ORDER BY revision DESC LIMIT 1').get()!
        .command as string,
    );
    assert.equal(receipt.payload.target_id, id);
    assert.equal(receipts(a.sql), before + 1);
    a.tap('Back to board');
    assert.equal(a.stack().at(-1).kind, 'board');
    assert.equal(receipts(a.sql), before + 1);
  }
  a.tap('Back to World');
  assert.deepEqual(a.stack(), []);
  assert.ok(!a.text().includes(whistleBody) && !a.text().includes(cellarBody));
});

// Breaks: a south exit or its reciprocal is missing, or the first fen clues disappear from Book.
test('the south search reaches the oak and returns through visible fox clues', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  for (const [direction, title] of [
    ['south', 'room.reed_path.title'],
    ['south', 'room.reed_bank.title'],
    ['west', 'room.willow_shade.title'],
    ['south', 'room.drowned_oak.title'],
    ['north', 'room.willow_shade.title'],
    ['east', 'room.reed_bank.title'],
    ['north', 'room.reed_path.title'],
    ['north', 'room.ferry_landing.title'],
  ]) {
    a.walk(direction);
    assert.equal(a.game.view().view.place.title.key, title);
    if (title === 'room.reed_path.title' && direction === 'south') {
      a.tap('Fox prints');
      assert.equal(a.text()[0], 'Fox prints');
      assert.ok(
        a
          .text()
          .includes(
            'The prints are small and close-set. They turn into the reeds; following them by sight ends at the first pool of dark water.',
          ),
      );
      a.tap('Leave');
    }
    if (title === 'room.reed_bank.title' && direction === 'south') {
      const before = storyRows(a);
      a.tap('Tracks');
      assert.equal(a.text()[0], 'Tracks');
      assert.ok(
        a
          .text()
          .includes(
            'Several narrow marks cross the bank toward the water. Wet reeds hide where they continue.',
          ),
      );
      a.tap('Leave');
      assert.deepEqual(storyRows(a), before);
    }
  }
  assert.deepEqual(a.game.view().view.journal, []);
});

// Break: cold Continue hides restored notice text, requiring another Read to display it,
// or restores a child without its board and duplicates the committed message/receipt.
test('cold Continue shows the confirmed notice once and restores its return route without Read', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-notice-reopen-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const [title, id, body] of [
    ['Landing notice', landing, landingBody],
    ['Help in the cellar', cellar, cellarBody],
  ]) {
    const path = join(dir, id + '.db');
    let a = preview(bundle, path);
    if (id === cellar) {
      a.walk('north');
      a.walk('east');
      a.tap('Notice board');
    }
    a.tap(title);
    const saved = a.sql.prepare('SELECT * FROM receipt ORDER BY revision').all();
    a.sql.close();
    a = preview(bundle, path);
    assert.equal(a.text().filter((line) => line === body).length, 1);
    assert.equal(a.stack().at(-1)?.id, id);
    assert.deepEqual(a.sql.prepare('SELECT * FROM receipt ORDER BY revision').all(), saved);
    assert.deepEqual(a.presenter().screen().log, []);
    a.tap(id === landing ? 'Leave' : 'Back to board');
    if (id === cellar) {
      assert.equal(a.stack().at(-1).kind, 'board');
      a.tap('Back to World');
    }
    assert.deepEqual(a.stack(), []);
    assert.deepEqual(a.sql.prepare('SELECT * FROM receipt ORDER BY revision').all(), saved);
    a.sql.close();
  }
});

// Breaks: pending Read reveals source prose before commit confirmation or renders it twice on retry.
test('an uncertain child read keeps an empty detail until its one receipt is confirmed', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  a.fault.kind = 'lost';
  a.fault.armed = true;
  a.tap('Landing notice');
  assert.ok(!a.text().includes(landingBody));
  assert.equal(receipts(a.sql), 1);
  a.tap('Leave');
  a.tap('Landing notice');
  assert.ok(!a.text().includes(landingBody));
  a.fault.reads = false;
  a.tap('Leave');
  a.tap('Landing notice');
  assert.equal(a.text().filter((s) => s === landingBody).length, 1);
  assert.equal(receipts(a.sql), 1);
  assert.deepEqual(a.presenter().screen().log, []);
});

// Breaks: elapsed-only notifications clear nested routes, or a room change retains a notice page.
test('long elapsed redraw retains board route and a real room change prunes it', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  a.walk('north');
  a.walk('east');
  a.draw();
  a.tap('Notice board');
  a.tap('Lost tin whistle');
  a.tap('Back to board');
  const captured = a
    .draw()
    .find((n) => n.type === 'Pressable' && n.props.accessibilityLabel === 'Lost tin whistle');
  const route = a.stack();
  a.clock.wall += 71000;
  a.clock.mono += 71000;
  assert.equal(a.game.pulse().kind, 'ready');
  a.draw();
  assert.deepEqual(a.stack(), route);
  captured.props.onPress();
  assert.equal(a.presenter().screen().detail(whistle).length, 2);
  a.draw()
    .find((n) => n.type === 'Pressable' && n.props.accessibilityLabel.startsWith('Contents,'))
    .props.onPress();
  a.tap('Map');
  a.tap('Go west');
  a.draw();
  assert.deepEqual(a.stack(), []);
  assert.ok(!a.text().includes(whistleBody));
});

// Breaks: the first unavailable offer masks a valid alias, or absent/refused exact offers
// become actionable because the presenter guesses the Read key or title.
test('notice entries use available exact-target aliases and expose unavailable reasons', (t) => {
  const variant = (alias: boolean) => {
    const c = structuredClone(bundle.value);
    const action = (key: string, permitted: boolean) => ({
      key,
      label: 'actions.read_notice',
      accessibility: 'actions.read_notice',
      command: 'read',
      priority: permitted ? 0 : 10,
      input: [],
      target: { kind: 'entity', scopes: ['inspectable_details'] },
      policy: {
        policy_version: 1,
        root: permitted
          ? { op: 'time_window', from: 18, to: 19 }
          : { op: 'not', item: { op: 'time_window', from: 18, to: 19 } },
      },
    });
    c.actions['ashmere_missing_child@0.0.9:action/read'] = action('read', false);
    if (alias) c.actions['ashmere_missing_child@0.0.9:action/consult'] = action('consult', true);
    const canonical = JSON.stringify(sorted(c));
    return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
  };
  const blocked = preview(variant(false));
  t.after(() => blocked.sql.close());
  assert.ok(!blocked.labels().includes('Landing notice'));
  assert.ok(blocked.text().some((s) => s.startsWith('Landing notice: ')));
  assert.equal(receipts(blocked.sql), 0);
  const a = preview(variant(true));
  t.after(() => a.sql.close());
  a.tap('Landing notice');
  assert.ok(a.text().includes(landingBody));
  assert.equal(receipts(a.sql), 1);
  assert.deepEqual(a.presenter().screen().log, []);
});

const storyRows = (a: ReturnType<typeof preview>) =>
  a.sql
    .prepare(
      "SELECT * FROM state_row WHERE section IN ('facts', 'quests', 'created', 'containers') ORDER BY section, key",
    )
    .all();

// Breaks: the opening NPC is absent or clock-gated, a direction choice resolves the wrong
// narration, conversation leaks into World, or informational talk grants quest/fact/reward state.
test('Elspeth stays reachable all day and her Book replies direct a newcomer along usable exits', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  const elspeth = 'a443f590-c8d3-86d8-9972-75e09b637bed';
  for (let hour = 0; hour < 24; hour++) {
    assert.ok(
      a.game
        .view()
        .view.entities.find((e) => e.id === elspeth)
        ?.actions.some((offer) => offer.action_key === 'elspeth' && offer.available),
    );
    a.clock.wall += 72000;
    a.clock.mono += 72000;
    assert.equal(a.game.pulse().kind, 'ready');
    a.draw();
  }
  const before = storyRows(a);
  a.tap('Elspeth, open');
  assert.equal(a.stack().at(-1).id, elspeth);
  assert.ok(a.text().some((s) => s.includes('her eyes search every face')));
  for (const [label, key, answer] of [
    [
      '“Which way is the village?”',
      'narration.elspeth.directions',
      '“North from here, up Well Lane,” Elspeth says. “Keep going north and you’ll reach Village Green. That’s the heart of Ashmere.”',
    ],
    [
      '“Is there an inn nearby?”',
      'narration.elspeth.inn',
      '“Go north to Well Lane, then east into the Drowned Lantern. Maud keeps the inn. Speak to her at the bar; she’ll tell you what needs doing.”',
    ],
    [
      '“Who is Wren?”',
      'narration.elspeth.wren',
      '“My son.” Elspeth looks back at the river. “He’s always off exploring, but he should have been home by now.”',
    ],
  ]) {
    a.tap('Talk to Elspeth');
    assert.equal(a.game.view().view.choice?.speaker_id, elspeth);
    a.tap(label);
    assert.equal(a.game.lastNarration()?.lines[0].key, key);
    assert.ok(a.text().includes(answer));
    assert.deepEqual(a.presenter().screen().log, []);
  }
  assert.deepEqual(a.game.view().view.journal, []);
  assert.deepEqual(storyRows(a), before);
  a.tap('Talk to Elspeth');
  a.tap('Leave');
  assert.deepEqual(a.stack(), []);
  assert.deepEqual(a.presenter().screen().log, []);
  a.walk('north');
  assert.equal(a.game.view().view.place.title.key, 'room.well_lane.title');
  a.walk('east');
  assert.ok(a.game.view().view.entities.some((e) => e.name === 'npc.maud.short'));
  a.walk('west');
  a.walk('north');
  assert.equal(a.game.view().view.place.title.key, 'room.village_green.title');
});

// Breaks: a village clue is routed as a place control or loses authored identity/options.
test('Q1 drawing opens full item detail with Take and local Leave', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  a.walk('north');
  a.walk('north');
  const before = receipts(a.sql);
  a.tap('a fox drawing, open');
  assert.deepEqual(a.text().slice(0, 4), [
    'A fox drawing',
    "A child's charcoal drawing shows a fox among tall reeds. The paper is creased and muddy. There is no name on it.",
    'Take a fox drawing',
    'Leave',
  ]);
  assert.equal(receipts(a.sql), before);
  a.tap('Leave');
  assert.deepEqual(a.stack(), []);
  assert.equal(receipts(a.sql), before);
  a.tap('a fox drawing, open');
  a.tap('Take a fox drawing');
  assert.deepEqual(a.stack(), []);
  assert.ok(a.text().includes('You pick up a fox drawing.'));
  assert.deepEqual(a.game.view().view.journal, []);
});

// Breaks: details lose their visible Book link, noun title or authored body, or inspection
// silently grants quest/fact/custody state. Route traversal alone cannot detect these omissions.
test('plank and hollow open descriptive noun detail pages without story credit', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  for (const direction of ['south', 'south', 'south']) a.walk(direction);
  for (const [title, body] of [
    ['Plank', 'The plank is worn but steady, with a dry line across the mire.'],
    ['Hollow', 'Flattened grass and old fox bones mark a place where something has rested.'],
  ]) {
    const before = storyRows(a);
    a.tap(title);
    assert.equal(a.text()[0], title);
    assert.ok(a.text().includes(body));
    a.tap('Leave');
    assert.deepEqual(storyRows(a), before);
    assert.deepEqual(a.game.view().view.journal, []);
    if (title !== 'Hollow') a.walk('south');
  }
});

const tracks = '86b28f4e-f743-87f8-8375-2ead5c2c295c';
const studyBody =
  'You kneel beside the tracks. Small footprints run south across the mire toward Fox Hollow. They give you a lead, but Wren remains unfound.';
const startSearch = (a: ReturnType<typeof preview>) => {
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) => {
    const r = a.game.invoke({
      action_key: action_key as never,
      target_ids: target_ids as never,
      input,
    });
    assert.ok(r.kind === 'saved' && r.decision.kind === 'accepted', JSON.stringify(r));
  };
  const answer = (choice_id: string) =>
    invoke('choose', [], {
      choice_id,
      continuation_id: a.game.view().view.choice!.continuation_id,
    });
  invoke('elspeth', ['a443f590-c8d3-86d8-9972-75e09b637bed']);
  answer('accept');
  invoke('move', [], { direction: 'north' });
  invoke('move', [], { direction: 'north' });
  invoke('take', ['1f15fe56-3e56-8cfa-812b-1f231844c782']);
  invoke('move', [], { direction: 'south' });
  invoke('move', [], { direction: 'south' });
  invoke('elspeth', ['a443f590-c8d3-86d8-9972-75e09b637bed']);
  answer('report');
  a.walk('south');
  a.walk('south');
  a.draw();
};

// Breaks: Notice recipe buttons disappear from the shared builder, leak to World, carry a
// fabricated command target, or fail live-clock refresh; entry must still Read before Study.
test('Study is a detail-only empty-target control after Read/history and refreshes across elapsed redraw', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  startSearch(a);
  assert.ok(a.labels().includes('Tracks'));
  assert.ok(!a.labels().includes('Study tracks'));
  const study = a
    .presenter()
    .screen()
    .buttons.find((b: any) => b.action_key === 'study_tracks');
  assert.equal(study.detail_id, tracks);
  assert.deepEqual(study.target_ids, []);
  a.tap('Tracks');
  const row = a.sql.prepare('SELECT command FROM receipt ORDER BY revision DESC LIMIT 1').get()!;
  assert.equal(JSON.parse(row.command as string).payload.type, 'read');
  assert.deepEqual(a.stack(), [{ kind: 'notice', id: tracks }]);
  assert.ok(a.labels().indexOf('Study tracks') < a.labels().indexOf('Leave'));
  const text = a.text();
  assert.ok(text.indexOf('Tracks') < text.indexOf('Study tracks'));
  const captured = a
    .draw()
    .find((n) => n.type === 'Pressable' && n.props.accessibilityLabel === 'Study tracks');
  a.clock.wall += 1000;
  a.clock.mono += 1000;
  assert.equal(a.game.pulse().kind, 'ready');
  a.draw();
  captured.props.onPress();
  assert.equal(
    a
      .presenter()
      .screen()
      .detail(tracks)
      .filter((line: any) => line === studyBody).length,
    1,
  );
  assert.ok(!a.presenter().screen().log.includes(studyBody));
  const command = JSON.parse(
    a.sql.prepare('SELECT command FROM receipt ORDER BY revision DESC LIMIT 1').get()!
      .command as string,
  );
  assert.equal(command.payload.type, 'perform');
  assert.equal(command.payload.action, 'study_tracks');
  assert.equal(command.payload.target_id, undefined);
  assert.ok(!a.labels().includes('Study tracks')); // unavailable is a reason, never a button
  const after = a.text();
  assert.ok(after.indexOf(studyBody) < after.findIndex((s) => s.startsWith('Study tracks:')));
  const count = receipts(a.sql);
  a.tap('Leave');
  assert.equal(receipts(a.sql), count);
  assert.deepEqual(a.stack(), []);
});

// Breaks: lost Study acknowledgement renders success before confirmation, refreshes a sent
// retry's token/context, or fails to restore one detail-local narration after cold reopen.
test('pending Study retains its detail context and restores exactly once without World narration', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-study-book-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  let a = preview(bundle, path);
  startSearch(a);
  a.tap('Tracks');
  a.fault.kind = 'lost';
  a.fault.armed = true;
  a.tap('Study tracks');
  assert.ok(!a.text().includes(studyBody));
  const rows = a.sql.prepare('SELECT * FROM receipt ORDER BY revision').all();
  a.tap('Leave');
  a.fault.reads = false;
  a.presenter().press(
    a
      .presenter()
      .screen()
      .buttons.find((b: any) => b.action_key === 'look'),
  );
  assert.equal(
    a
      .presenter()
      .screen()
      .detail(tracks)
      .filter((line: any) => line === studyBody).length,
    1,
  );
  assert.deepEqual(a.sql.prepare('SELECT * FROM receipt ORDER BY revision').all(), rows);
  a.sql.close();
  a = preview(bundle, path);
  assert.deepEqual(a.stack(), [{ kind: 'notice', id: tracks }]);
  assert.equal(a.text().filter((line) => line === studyBody).length, 1);
  assert.deepEqual(a.presenter().screen().log, []);
  assert.deepEqual(a.sql.prepare('SELECT * FROM receipt ORDER BY revision').all(), rows);
  a.tap('Leave');
  a.walk('north');
  a.draw();
  a.sql.close();
  a = preview(bundle, path);
  assert.deepEqual(a.stack(), []);
  assert.ok(!a.text().includes(studyBody));
  assert.deepEqual(a.presenter().screen().detail(tracks), [studyBody]);
  assert.deepEqual(a.presenter().screen().log, []);
  a.sql.close();
});
