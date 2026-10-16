import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { fadeStub } from './__tests__/fade-stub.ts';
import type { DetailLine } from './presenter.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const react = pathToFileURL(require.resolve('react')).href;
registerHooks({
  resolve(specifier, context, next) {
    // The page curl needs Skia and Reanimated; a page_turn.e2e.ts concern, not these tests'.
    if (specifier === './fade.ts') return fadeStub;
    if (specifier === './PageTurn.tsx')
      return {
        url: 'data:text/javascript,export function PageTurn(p){return p.children}',
        shortCircuit: true,
      };
    if (specifier === 'react') return { url: 'test:keyboard-react', shortCircuit: true };
    if (specifier === 'react-native') return { url: 'test:keyboard-native', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:keyboard-react')
      return {
        format: 'module',
        shortCircuit: true,
        source: `export * from ${JSON.stringify(react)}; export const useContext = c => c._currentValue; export const useState = v => [typeof v === 'function' ? v() : v, () => {}]; export const useRef = v => ({ current: v }); export const useEffect = f => f();`,
      };
    if (url === 'test:keyboard-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',TextInput='TextInput',View='View',ScrollView='ScrollView',SafeAreaView='SafeAreaView',AccessibilityInfo={announceForAccessibility:()=>{}},Easing={},Animated={View:'View',Value:class {constructor(v){this.v=v}setValue(v){this.v=v}}},PanResponder={create:()=>({panHandlers:{}})};",
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
const { color } = await import('./tokens.ts');
const { Footer } = await import('./Footer.tsx');
const { StatusLine } = await import('./Status.tsx');
const { BookView } = await import('./Book.tsx');
const { CharacterPage } = await import('./sections.tsx');
const { StatusIcons, Tooltip, ringFraction } = await import('./StatusIcon.tsx');

function browser(t: { after: (cleanup: () => void) => void }) {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalElement = globalThis.Element;
  const listeners = new Map<string, (event: any) => void>();
  class Target {
    tag: string;
    role?: string;
    constructor(tag = 'div', role?: string) {
      this.tag = tag;
      this.role = role;
    }
    closest(selector: string) {
      const choices = selector.split(',').map((part) => part.trim());
      return choices.includes(this.tag) || (this.role && choices.includes(`[role="${this.role}"]`))
        ? this
        : null;
    }
  }
  (globalThis as any).Element = Target;
  (globalThis as any).window = {
    addEventListener: (type: string, listener: (event: any) => void) =>
      listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  };
  (globalThis as any).document = {};
  t.after(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).Element = originalElement;
  });
  const key = (name: string, more: Record<string, unknown> = {}) => {
    let prevented = false;
    listeners.get('keydown')?.({
      key: name,
      target: new Target(),
      defaultPrevented: false,
      preventDefault: () => {
        prevented = true;
      },
      ...more,
    });
    return prevented;
  };
  return { listeners, key, Target };
}

// Breaks: a shortcut chooses the wrong exit or steals a focused input's arrow keys.
test('web keyboard uses offered exits and keeps focused controls', (t) => {
  const { key, Target } = browser(t);
  const walked: string[] = [];
  const refusals: DetailLine[] = [];
  const exits = ['north', 'south', 'west', 'east', 'up', 'down'].map((direction) => ({
    direction,
    available: true,
  }));
  Footer({
    keyboardEnabled: true,
    exits,
    text: (key: string) => key,
    go: (direction: string) => walked.push(direction),
    refused: (line: DetailLine) => refusals.push(line),
    openMap: () => {},
    learned: { seen: () => true, see: () => {} },
  });
  for (const name of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'])
    assert.equal(key(name), true);
  assert.deepEqual(walked, ['north', 'south', 'west', 'east', 'up', 'down']);
  for (const tag of ['input', 'textarea', 'select'])
    assert.equal(key('ArrowUp', { target: new Target(tag) }), false);
  assert.equal(key('ArrowUp', { target: new Target('div', 'dialog') }), false);
  assert.equal(key('ArrowUp', { ctrlKey: true }), false);
  assert.equal(key('ArrowUp', { defaultPrevented: true }), false);
  assert.equal(key('Home'), false);
  assert.equal(walked.length, 6);
  exits.pop(); // no down exit is offered here
  assert.equal(key('PageDown'), false);
  exits[0] = { direction: 'north', available: false, reason: { code: 'exit_closed' } } as any;
  assert.equal(key('ArrowUp'), true);
  assert.equal(walked.length, 6);
  assert.deepEqual(refusals, [
    { kind: 'refused', reason: 'closed', text: 'The way north is closed.' },
  ]);
});

// Breaks: Book installs a World keyboard handler while a detail or save state owns input.
test('Book captures movement keys only on an active World page', (t) => {
  const { listeners, key } = browser(t);
  const pressed: string[] = [];
  const move = {
    label: 'North',
    action_key: 'move',
    target_ids: [],
    input: { direction: 'north' },
  };
  const screen = {
    buttons: [move],
    view: {
      place: { id: 'room' },
      time: 0,
      position: 'standing',
      exits: [{ direction: 'north', available: true }],
    },
    text: (key: string) => key,
    log: [],
    pending: false,
    catchingUp: false,
    fault: undefined,
  };
  const attempt = (change: Record<string, unknown> = {}, stack: unknown[] = []) => {
    listeners.clear();
    const current = { ...screen, ...change, view: { ...screen.view, ...(change.view as object) } };
    const book = BookView({
      palette: color.light,
      screen: current as any,
      stack: stack as any,
      flip: { turn: 0, dir: 1 },
      go: () => {},
      press: (button: any) => pressed.push(button.input.direction),
      refused: () => {},
      startOver: () => {},
      shell: { confirm: () => {}, learned: { seen: () => true, see: () => {} } },
    });
    const bottom = book.props.children.props.children[1];
    const footer = bottom
      .type(bottom.props)
      .props.children.find((child: any) => child?.type === Footer);
    if (footer) Footer(footer.props);
    return key('ArrowUp');
  };
  assert.equal(attempt(), true);
  assert.deepEqual(pressed, ['north']);
  for (const change of [
    { pending: true },
    { catchingUp: true },
    { fault: 'save failed' },
    { view: { scene: {} } },
    { view: { combat: {} } },
  ])
    assert.equal(attempt(change), false);
  for (const page of [{ kind: 'dialogue' }, { kind: 'thing', id: 'npc' }, { kind: 'chapter' }])
    assert.equal(attempt({}, [page]), false);
  assert.deepEqual(pressed, ['north']);
});

// Breaks: the chapter title page offers Back to World or an enabled Contents beside its Continue, or
// the locked Contents still shows its tappable colours (docs/system/book-ui.md, Chapters, scenes
// and recovery; BOOK-UI-COMPONENTS.md, Status line).
test('the chapter title page leaves only Continue', () => {
  const book = BookView({
    palette: color.light,
    screen: {
      buttons: [],
      view: {
        place: { id: 'room' },
        time: 0,
        exits: [],
        resources: [{ resource: { key: 'mv' }, current: 1, maximum: 9, tone: 'danger' }],
      },
      text: (key: string) => key,
      log: [],
      pending: false,
      catchingUp: false,
    } as any,
    stack: [{ kind: 'chapter' }],
    flip: { turn: 0, dir: 1 },
    go: () => {},
    press: () => {},
    refused: () => {},
    startOver: () => {},
    shell: { confirm: () => {}, learned: { seen: () => true, see: () => {} } },
  });
  const bottom = book.props.children.props.children[1];
  const [navigation, status] = bottom.type(bottom.props).props.children;
  assert.equal(navigation, false);
  assert.equal(status.props.locked, true);
  const button = StatusLine(status.props)
    .props.children[1].props.children.flat() // past the (absent) icon row: the row, then its items
    .find((c: any) => c?.key === 'contents').props.children[1]; // its " · " group: dot, button
  const contents = button.type(button.props);
  const colours = (e: any): string[] =>
    !e || typeof e !== 'object'
      ? []
      : [e.props?.style?.color, ...[e.props?.children].flat().flatMap(colours)].filter(Boolean);
  assert.deepEqual(new Set(colours(contents)), new Set(['#645c4f'])); // paper.dim
});

// Breaks: pennies (or any count) reach the status line, or take a band colour on the Character
// page, or the condition pools lose theirs
// (docs/system/book-ui.md#world-and-status-entry: hp, ma, mv on the line; bands on those only).
test('status shows hp, ma and mv only; Character bands those only, never pennies', () => {
  const pool = (key: string, tone: string) => ({
    resource: { key },
    current: 1,
    maximum: 9,
    tone,
    band: 'hurt',
  });
  const status = StatusLine({
    time: 0,
    resources: [pool('hp', 'danger'), pool('mv', 'warning'), pool('pennies', 'danger')],
    text: (key: string) => key,
    locked: false,
    pending: false,
    open: () => {},
  } as any);
  const button = status.props.children[1].props.children
    .flat()
    .find((c: any) => c?.key === 'contents').props.children[1];
  const contents = button.type(button.props);
  const shown = contents.props.children.props.children.map((t: any) => [
    t.key,
    t.props.style.color,
  ]);
  assert.deepEqual(shown, [
    ['hp', '#7b2d20'], // paper.danger
    ['mv', '#845512'], // paper.warning
  ]);
  const character = CharacterPage({
    resources: [pool('hp', 'danger'), pool('pennies', 'danger')],
    text: (key: string) => key,
    world: () => {},
  });
  assert.deepEqual(
    [character.props.children]
      .flat(2)
      .filter((t: any) => t?.key)
      .map((t: any) => [t.key, t.props.style.color]),
    [
      ['hp', '#7b2d20'], // paper.danger
      ['pennies', '#241f19'], // paper.fg
    ],
  );
});

// Breaks (toolbox row 31, trap 12): the weather only in the accessible label (a sighted player
// sees the same glyph in the rain), or season or tide missing from the label.
test('the status line shows the weather in words and names season and tide', () => {
  const status = StatusLine({
    time: 0,
    calendar: {
      day: 1,
      hour: 0,
      subdivision: 0,
      solar: 'night',
      lunar: 'full',
      weather: 'rain',
      season: 'autumn',
      tide: 'high',
    },
    text: (key: string) => key,
    locked: false,
    pending: false,
    open: () => {},
  } as any);
  const sky = status.props.children[1].props.children[0];
  assert.equal([sky.props.children].flat().join(''), '○ rain');
  assert.equal(
    sky.props.accessibilityLabel,
    'day 1, 00:00, night, full moon, rain, autumn, high tide',
  );
});

// Breaks: a sixth icon where the +N disc belongs (or the disc at five), a name losing its polarity or
// giving a permanent status a time, the glyph not falling back by polarity, a locked icon still a
// button, or the Character page dropping a condition's time, tick or sign
// (book-ui.md Conditions details; BOOK-UI-COMPONENTS.md, Status icon).
test('status icons: five then +N, named by label, time and polarity, pictures while locked', () => {
  const at = (label: string, kind?: string, ends_at?: number, per_tick?: number) =>
    ({ label, kind, ends_at, per_tick, resource: 'hp', tick_every: 60 }) as any;
  const five = [
    at('condition.fed', 'buff', 3600),
    at('poisoned', 'debuff', 960, -1),
    at('rested', undefined, 1320),
    at('scarred', 'debuff'),
    at('warded', 'buff', 810, 5),
  ];
  const text = (key: string) => (key === 'condition.fed' ? 'fed' : key);
  const icons = (conditions: any[], open?: () => void) => {
    const [shown, more] = StatusIcons({ conditions, time: 720, text, open }).props.children;
    return [...shown, more].filter(Boolean).map((e: any) => e.type(e.props));
  };
  const names = (es: any[]) => es.map((e) => e.props.accessibilityLabel);
  const opened: string[] = [];
  const open = () => opened.push('character');
  const shown = icons(five, open);
  assert.deepEqual(names(shown), [
    'fed, 48m remaining, buff, opens Character',
    'poisoned, 4m remaining, debuff, opens Character',
    'rested, 10m remaining, opens Character',
    'scarred, debuff, opens Character',
    'warded, 90s remaining, buff, opens Character',
  ]);
  const discOf = (e: any) => e.props.children.type(e.props.children.props);
  const glyphOf = (e: any) => discOf(e).props.children.props.children;
  assert.deepEqual(shown.map(glyphOf), ['◡', '−', '○', '−', '+']);
  const c = color.light;
  const look = (e: any) => {
    const disc = discOf(e).props;
    return [disc.style.backgroundColor, disc.style.borderColor, disc.children.props.style.color];
  };
  assert.deepEqual(shown.slice(0, 3).map(look), [
    [c.card, c.line, c.fg],
    [c.fg, c.danger, c.bg],
    [c.card, c.line, c.dim],
  ]);
  const six = icons([...five, at('mighty', 'buff', 4000)], open);
  assert.equal(six.length, 6);
  assert.equal(six[5].props.accessibilityLabel, '+1 more, opens Character');
  assert.equal(glyphOf(six[5]), '+1');
  six[5].props.onPress();
  assert.deepEqual(opened, ['character']);
  // Reduced motion (the fade stub): the tip shows at once, no fade started (no Animated.timing here).
  assert.equal(Tooltip({ text: 'fed' }).props.style.opacity.v, 1);
  const row = (props: object) =>
    StatusLine({ time: 720, resources: [], text, open: () => {}, openCharacter: open, ...props })
      .props.children[0];
  assert.equal(row({ conditions: five }).props.open, open);
  assert.equal(row({ conditions: five, locked: true }).props.open, undefined);
  assert.equal(row({ conditions: [] }), false);
  const locked = icons(five);
  assert.deepEqual(
    locked.map((e) => [e.type, e.props.accessibilityRole]),
    five.map(() => ['View', 'image']),
  );
  assert.equal(locked[0].props.accessibilityLabel, 'fed, 48m remaining, buff');
  // Locked, a debuff goes dim like the Contents button: the neutral look.
  assert.deepEqual(look(locked[1]), [c.card, c.line, c.dim]);
  const character = CharacterPage({
    view: { time: 720, conditions: five } as any,
    text,
    world: () => {},
  });
  const lines = [character.props.children]
    .flat(2)
    .filter(
      (t: any) =>
        t?.key?.startsWith?.('poisoned') ||
        t?.key?.startsWith?.('warded') ||
        t?.key?.startsWith?.('scarred'),
    )
    .map((t: any) => t.props.children);
  assert.deepEqual(lines, [
    'Poisoned · 4m remaining · -1 HP each 60s',
    'Scarred',
    'Warded · 90s remaining · +5 HP each 60s',
  ]);
});

// Breaks: the remaining share is not clamped to 0..1, a permanent status (or one without a duration)
// gets a ring, the arc runs counter-clockwise or starts off 12, or an empty ring keeps an arc
// (book-ui.md Conditions details; BOOK-UI-COMPONENTS.md, Status icon).
test('status icon countdown ring: remaining share of the duration, clockwise from 12', () => {
  const at = (ends_at?: number, duration?: number) =>
    ({ label: 'fed', kind: 'buff', ends_at, duration, resource: 'mv', tick_every: 1800 }) as any;
  const share = (ends_at?: number, duration?: number, time = 720) =>
    ringFraction(at(ends_at, duration), time);
  assert.equal(share(3600, 3600), 0.8);
  assert.equal(share(4320, 3600), 1); // exactly full
  assert.equal(share(4321, 3600), 1); // one past full, clamped
  assert.equal(share(4000, 3600, 0), 1); // reapplied longer than the duration, clamped
  assert.equal(share(720, 3600), 0); // exactly empty
  assert.equal(share(719, 3600), 0); // one past empty, clamped
  assert.equal(share(undefined, undefined), undefined); // permanent
  assert.equal(share(3600, undefined), undefined); // no duration
  assert.equal(share(undefined, 3600), undefined); // no end
  // The Icon's child: a Ring (track, then halves, then the disc) or the bare disc.
  const ring = (ends_at?: number, duration?: number, locked = false) => {
    const [icon] = StatusIcons({
      conditions: [at(ends_at, duration)],
      time: 720,
      text: (k: string) => k,
      open: locked ? undefined : () => {},
    }).props.children[0];
    return icon.type(icon.props).props.children;
  };
  const halves = (e: any) => {
    const [track, ...rest] = e.type(e.props).props.children;
    assert.equal(track.props.style.borderColor, color.light.dim);
    return rest
      .filter((h: any) => h && h.props.turn !== undefined)
      .map((h: any) => [h.props.right ? 'right' : 'left', h.props.turn, h.props.color]);
  };
  const fg = color.light.fg;
  assert.deepEqual(halves(ring(3600, 3600)), [
    ['right', 0, fg],
    ['left', 108, fg],
  ]); // 288 degrees
  assert.deepEqual(halves(ring(1620, 3600)), [['right', -90, fg]]); // a quarter: 12 to 3 o'clock
  assert.deepEqual(halves(ring(2520, 3600)), [['right', 0, fg]]); // exactly half: no left
  assert.deepEqual(halves(ring(720, 3600)), []); // empty: the track only
  // Each half clips its own side of the 34 px ring box and turns about the ring's centre.
  const [, right, left] = ring(3600, 3600).type(ring(3600, 3600).props).props.children;
  const place = (h: any) => {
    const clip = h.type(h.props);
    return [clip.props.style.left, clip.props.children.props.style.left];
  };
  assert.deepEqual(
    [place(right), place(left)],
    [
      [17, -17],
      [0, 0],
    ],
  );
  assert.equal(ring(undefined, undefined).props.look, 'buff'); // permanent: the bare disc
  // Locked: a line track and a dim arc, so the ring goes quiet with the disc.
  const shut = ring(3600, 3600, true);
  const [track, right2, left2] = shut.type(shut.props).props.children;
  assert.deepEqual(
    [track.props.style.borderColor, right2.props.color, left2.props.color],
    [color.light.line, color.light.dim, color.light.dim],
  );
});
