// The Combat hotbar (book-ui.md, Combat hotbar): its slots, presses, opener list, wedge and drawings,
// on the mounted Book over controlled, schema-valid fight views.
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validate } from '../../authority/local-story/__tests__/validate.ts';
import { nodes, view } from './__tests__/combat-book.test.ts';
import { mounted } from './__tests__/mounted.ts';
import { pressable } from './__tests__/control.test.ts';
import { actionGlyphs, OPENER } from './actionGlyphs.ts';
import { LABEL } from './labels.ts';
import { fallback, glyphs } from './statusGlyphs.ts';

const { share, wedgeMs } = await import('./Hotbar.tsx');
const { AccessibilityInfo } = (await import('react-native')) as any;
(globalThis as any).CanvasKit = {}; // so the slots' lazy drawings are drawn, their props readable

const act = (action_key: string, more = {}) => ({
  action_key,
  label: `action.${action_key}`,
  available: true,
  input: [],
  target: { kind: 'none' },
  ...more,
});
const barred = { available: false, reason: { code: 'invalid_state' } };
// A rat fight with the base flee and stand, Cast offered, and `more` actions and spell words.
const fight = (more: object[], spell_words?: object[], extra = {}) => {
  const v = view({
    actions: [...(view() as any).actions, act('cast'), ...more],
    ...(spell_words && { spell_words }),
    ...extra,
  });
  const id = '00000000-0000-4000-8000-000000000000'; // the harness's ids are not schema ids
  const wire = JSON.stringify(v).replace(/"(character|room|fight|rat)"/g, `"${id}"`);
  assert.deepEqual(validate('GameView', JSON.parse(wire)), []);
  return v;
};
const all = (h: ReturnType<typeof mounted>) => {
  const drawn: any[] = [];
  h.node((n) => (drawn.push(n), false));
  return drawn;
};
const isGlyph = (n: any) => n?.props && 'state' in n.props && 'd' in n.props;
// The strip's drawings in order: three slots, then the opener.
const glyphsOf = (h: ReturnType<typeof mounted>) =>
  all(h)
    .filter(isGlyph)
    .map((n) => [n.props.d, n.props.state]);
// The strip's focusable slots by name (an unavailable slot is exposed disabled, so no control).
const slots = (h: ReturnType<typeof mounted>) =>
  all(h)
    .filter((n) => n.type === 'Pressable' && nodes(n.props.children).some(isGlyph))
    .map((n) => [n.props.accessibilityLabel, pressable(n)]);
const sends = (h: ReturnType<typeof mounted>) => {
  const sent: any[] = [];
  h.game.invoke = ((a: any) => (sent.push(a), { kind: 'stale_view' })) as never;
  return sent;
};

// Breaks: a page verb (look, cast) or an aimed action in a slot, spell words before the scripted
// actions, a barred filler dropped so the next one takes its place, or a word slot that sends no word.
test('the slots fill in GameView order; a barred one keeps its place', () => {
  const h = mounted(
    fight(
      [
        act('look'),
        act('shove'),
        act('kick', barred),
        act('flamma', { command: 'cast', target: { kind: 'entity', scopes: ['room_occupants'] } }),
      ],
      [
        { word: 'ward', available: true },
        { word: 'lux', available: true },
      ],
    ),
  );
  assert.deepEqual(glyphsOf(h), [
    [fallback.neutral, 'ready'],
    [fallback.neutral, 'barred'],
    [glyphs['condition.warded'], 'ready'],
    [OPENER, 'ready'],
  ]);
  assert.deepEqual(slots(h), [
    ['action.shove', true],
    ['action.kick, not now', false],
    ['ward, cast', true],
    [LABEL.hotbarOpener, true],
  ]);
  const sent = sends(h);
  h.tap('ward, cast');
  assert.deepEqual([sent[0].action_key, sent[0].input], ['cast', { word: 'ward' }]);
});

// Breaks: an empty slot drawn as a button or focusable, or a strip with nothing to hold.
test('fewer than three fillers leave hairline rings; no filler, no strip', () => {
  const h = mounted(fight([], [{ word: 'ward', available: true }]));
  assert.deepEqual(
    glyphsOf(h).map(([, state]) => state),
    ['ready', 'empty', 'empty', 'ready'],
  );
  assert.deepEqual(
    slots(h).map(([name]) => name),
    ['ward, cast', LABEL.hotbarOpener],
  );
  const strip = (v: any) =>
    all(mounted(v)).some(
      (n) => n.props?.role === 'group' && n.props['aria-label'] === LABEL.hotbar,
    );
  assert.ok(strip(fight([act('shove')])));
  assert.ok(!strip(fight([act('look')])), 'a page verb and no word: no strip');
  assert.ok(!strip(view({ spell_words: [{ word: 'ward', available: true }] })), 'no Cast offered');
});

// Breaks: a barred slot that sends, or reads its sentence twice or never.
test('a barred press sends nothing and reads its reason sentence once', () => {
  const h = mounted(fight([act('kick', barred)]));
  const sent = sends(h);
  const read: string[] = [];
  AccessibilityInfo.announceForAccessibility = (s: string) => read.push(s);
  const kick = all(h).find((n) => n.props?.accessibilityLabel === 'action.kick, not now');
  kick.props.onPress();
  assert.deepEqual(sent, []);
  const sentence = "You can't do that—not now.";
  assert.deepEqual(read, [sentence]);
  assert.equal(h.texts().filter((t) => t === sentence).length, 1, 'its polite region, once');
});

// Breaks: the opener list drawn outside Combat's one-open-list state, so it and a foe's list are
// open together, or an opener that does not say it is open.
test("the opener's list and a foe's list share the one open list", () => {
  const rat = {
    id: 'rat',
    kind: 'npc',
    name: 'npc.rat',
    actions: [
      act('flamma', {
        command: 'cast',
        label: 'spell.flamma',
        target: { kind: 'entity', scopes: ['room_occupants'] },
      }),
    ],
  };
  const h = mounted(fight([act('shove')], undefined, { entities: [rat] }));
  const expanded = () => h.control(LABEL.hotbarOpener).props['aria-expanded'];
  assert.equal(expanded(), false);
  h.tap(LABEL.hotbarOpener);
  assert.equal(expanded(), true);
  assert.ok(h.texts().includes('action.shove'), 'the list, a card per filler');
  const foe = () => h.control(/flamma, cast on/).props['aria-expanded'];
  h.tap(/flamma, cast on/);
  assert.deepEqual([expanded(), foe()], [false, true]);
  assert.ok(!h.texts().includes('action.shove'), "the foe's list closed the hotbar's");
  h.tap(LABEL.hotbarOpener);
  assert.deepEqual([expanded(), foe()], [true, false]);
});

// Breaks: a share measured from the wrong end, a cooling slot drawn barred, or a wedge that tweens
// under reduced motion or on a fresh cooldown.
test('a cooling slot draws the elapsed share; reduced motion steps it', () => {
  assert.equal(share({ ends_at: 40, duration: 20 }, 25), 0.25);
  assert.equal(share({ ends_at: 40, duration: 20 }, 50), 1);
  assert.equal(share({}, 25), undefined);
  const h = mounted(
    fight(
      [],
      [{ word: 'ward', available: false, reason: { code: 'cooldown' }, ends_at: 20, duration: 40 }],
    ),
  );
  const ward = all(h).find((n) => isGlyph(n) && n.props.d === glyphs['condition.warded']);
  assert.deepEqual([ward.props.state, ward.props.share], ['cooling', 0.75]); // time 10, from -20
  assert.ok(wedgeMs(0.25, 0.5, 500, false) > 0);
  assert.equal(wedgeMs(0.25, 0.5, 500, true), 0);
  assert.equal(wedgeMs(0.75, 0.1, 500, false), 0, 'a fresh cooldown jumps');
});

// Every point a path reaches (end and control points; an arc's end widened by its radius).
function points(d: string) {
  const out: [number, number][] = [];
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    subpaths = 0;
  const arity: Record<string, number> = {
    M: 2,
    L: 2,
    H: 1,
    V: 1,
    C: 6,
    S: 4,
    Q: 4,
    T: 2,
    A: 7,
    Z: 0,
  };
  for (const [, c, args] of d.matchAll(/([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi)) {
    const n = (args!.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
    const C = c!.toUpperCase(),
      rel = c !== C,
      k = arity[C]!;
    if (C === 'Z') [x, y] = [sx, sy];
    for (let i = 0; k && i < n.length; i += k) {
      const a = n.slice(i, i + k);
      const ox = rel ? x : 0,
        oy = rel ? y : 0;
      if (C === 'H') x = ox + a[0]!;
      else if (C === 'V') y = oy + a[0]!;
      else if (C === 'A') {
        [x, y] = [ox + a[5]!, oy + a[6]!];
        const r = Math.max(a[0]!, a[1]!);
        out.push([x - r, y - r], [x + r, y + r]);
      } else {
        for (let j = 0; j < k - 2; j += 2) out.push([ox + a[j]!, oy + a[j + 1]!]);
        [x, y] = [ox + a[k - 2]!, oy + a[k - 1]!];
      }
      if (C === 'M' && i === 0) [sx, sy, subpaths] = [x, y, subpaths + 1];
      out.push([x, y]);
    }
  }
  return { out, subpaths };
}

// Breaks: a drawing off statusGlyphs' frame (ink outside 3 to 21, more than four strokes), or a
// showcase slot key with no drawing, which would fall back to the neutral mark at render.
test('every action drawing keeps the frame, and every showcase slot key has one', () => {
  for (const [key, d] of Object.entries({ ...actionGlyphs, OPENER })) {
    const { out, subpaths } = points(d);
    assert.ok(subpaths >= 1 && subpaths <= 4, `${key}: ${subpaths} subpaths`);
    for (const [x, y] of out)
      assert.ok(x >= 3 && x <= 21 && y >= 3 && y <= 21, `${key}: ${x},${y} off the frame`);
  }
  const root = new URL('../../../', import.meta.url);
  const keys = globSync('cartridges/toolbox_showcase/**/actions/*.json', { cwd: root })
    .map((f) => JSON.parse(readFileSync(new URL(f, root), 'utf8')).target)
    .filter((t) => t?.kind === 'spell' && !t.aimed)
    .map((t) => t.word as string);
  assert.ok(keys.length > 0); // the glob found the showcase's unaimed words
  assert.deepEqual(
    keys.filter((k) => !(k in actionGlyphs)),
    [],
  );
});
