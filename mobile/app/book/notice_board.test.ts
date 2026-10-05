// Real Book routes and authority; native leaves are not device/layout evidence.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    new URL('../../../protocol/fixtures/missing_child_v004_hash.json', import.meta.url),
    'utf8',
  ),
);
const landing = '251e7a71-b5ad-8d22-858b-533e52cc5415';
const whistle = 'e368b8b9-c4a5-8d0e-82a0-da17e2d59fe2';
const cellar = '15349791-fa65-81f7-b378-bb8212b808d2';
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
function preview(input = bundle) {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, input);
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
    assert.deepEqual(a.text().slice(0, 4), [title, description, body, 'Back']);
    const receipt = JSON.parse(
      a.sql.prepare('SELECT command FROM receipt ORDER BY revision DESC LIMIT 1').get()!
        .command as string,
    );
    assert.equal(receipt.payload.target_id, id);
    assert.equal(receipts(a.sql), before + 1);
    a.tap('Back');
    assert.equal(a.stack().at(-1).kind, 'board');
    assert.equal(receipts(a.sql), before + 1);
  }
  a.tap('Back to World');
  assert.deepEqual(a.stack(), []);
  assert.ok(!a.text().includes(whistleBody) && !a.text().includes(cellarBody));
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
  a.tap('Back');
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
    c.actions['ashmere_missing_child@0.0.4:action/read'] = action('read', false);
    if (alias) c.actions['ashmere_missing_child@0.0.4:action/consult'] = action('consult', true);
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
