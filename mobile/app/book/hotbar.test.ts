// The Combat hotbar (book-ui.md, Combat hotbar): its slots, presses, opener list, wedge and drawings,
// on the mounted Book over controlled, schema-valid fight views.
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { basename } from 'node:path';
import { test } from 'node:test';
import { validate } from '../../authority/local-story/__tests__/validate.ts';
import { nodes, view } from './__tests__/combat-book.test.ts';
import { mounted } from './__tests__/mounted.ts';
import { pressable } from './__tests__/control.test.ts';
import { actionGlyphs, OPENER } from './actionGlyphs.ts';
import { LABEL } from './labels.ts';
import { fallback, glyphs } from './statusGlyphs.ts';
import { opacity, size, space } from './tokens.ts';

// The slot drawing's hosts as leaves, so its Inked elements are readable (as effects_turn.test.ts).
const stubs: Record<string, string> = {
  '@shopify/react-native-skia':
    "export const Canvas='Canvas',Circle='Circle',Group='Group',Path='Path';",
  'react-native-reanimated':
    'export const Easing={linear:t=>t},useDerivedValue=f=>({value:f()}),useReducedMotion=()=>false,' +
    'useSharedValue=value=>({value}),withTiming=v=>v;',
};
registerHooks({
  resolve: (specifier, context, next) =>
    stubs[specifier]
      ? { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true }
      : next(specifier, context),
});
const { share } = await import('./Hotbar.tsx');
const {
  arc,
  default: HotbarGlyph,
  frame,
  inked,
  still,
  wedgeMs,
} = await import('./HotbarGlyph.tsx');
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
  h.tap('action.shove');
  assert.equal(sent[1].action_key, 'shove', 'a scripted slot sends its own action');
});

// Breaks: an empty slot drawn as a button or focusable, or a strip with nothing to hold (a page verb,
// a refused Cast's words, a fight over).
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
  assert.ok(!strip(fight([act('peer', { command: 'look' })])), 'a page verb by its command');
  const ward = [{ word: 'ward', available: true }];
  const castBarred = view({
    actions: [...(view() as any).actions, act('cast', barred)],
    spell_words: ward,
  });
  assert.ok(!strip(castBarred), 'Cast listed but refused: no word slot');
  assert.ok(!strip(view({ spell_words: [{ word: 'ward', available: true }] })), 'no Cast offered');
  assert.ok(!strip(fight([act('shove')], undefined, { combat: undefined })), 'the fight over');
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
  const cooling = {
    word: 'ward',
    available: false,
    reason: { code: 'cooldown' },
    ends_at: 20,
    duration: 40,
  };
  const h = mounted(fight([act('shove'), act('kick', barred)], [cooling], { entities: [rat] }));
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
  h.tap(LABEL.hotbarOpener);
  assert.equal(expanded(), false, 'a second press closes');
  h.tap(LABEL.hotbarOpener);
  const kicks = all(h).filter(
    (n) => n.type === 'Pressable' && /kick|ward/.test(n.props.accessibilityLabel),
  );
  assert.deepEqual(
    kicks.map(pressable),
    [false, false, false, false],
    'barred and cooling: row and slot',
  );
  let focused = 0;
  h.control(LABEL.hotbarOpener).props.ref.current = { focus: () => focused++ };
  h.answer({ kind: 'pending' });
  h.tap('action.shove'); // the list's row: sends, closes, and the action is pending
  assert.equal(focused, 1, 'closing puts focus back on the opener');
  h.tap(LABEL.hotbarOpener);
  h.tap('action.shove');
  assert.equal(expanded(), true, 'a row pressed while an action is pending keeps the list');
});

// Breaks: a share measured from the wrong end, a cooling slot drawn barred, rounds left not rounded up
// or not from the fight's interval, or a wedge that tweens under reduced motion or on a fresh cooldown.
test('a cooling slot draws the elapsed share; reduced motion steps it', () => {
  assert.equal(share({ ends_at: 40, duration: 20 }, 25), 0.25);
  assert.equal(share({ ends_at: 40, duration: 20 }, 50), 1);
  assert.equal(share({}, 25), undefined);
  assert.equal(share({ ends_at: 40, duration: 0 }, 25), undefined, 'no duration, no wedge');
  const cooling = {
    word: 'ward',
    available: false,
    reason: { code: 'cooldown' },
    ends_at: 20,
    duration: 40,
  };
  const combat = { ...(view() as any).combat, interval: 3 };
  const h = mounted(fight([], [cooling], { combat }));
  const ward = all(h).find((n) => isGlyph(n) && n.props.d === glyphs['condition.warded']);
  assert.deepEqual([ward.props.state, ward.props.share], ['cooling', 0.75]); // time 10, from -20
  // Rounds left at time 10: ceil(10 / 3) of ceil(40 / 3).
  const slot = all(h).find(
    (n) => n.type === 'Pressable' && /^ward/.test(n.props.accessibilityLabel),
  );
  assert.deepEqual(slot.props.accessibilityValue, { min: 0, max: 14, now: 4 });
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

// The showcase's scripted actions drawn with the neutral mark until the designer draws them (loka-x6t.138).
const neutral =
  'carve_spoon chop cook_feast cook_stew cook_stew_croft disarm_cellar disarm_plate fish_croft force_grate force_hall_cupboard force_iron_door force_strongbox force_tollhouse_door gather_ash gather_attic_ash hide lift_store_bar look_about pick_hall_strongbox pick_strongbox play_fold_song play_song pull_a pull_b pull_c raise_timbered_hut saw search_cellar search_cleft search_floor search_pool_cleft shout_begone shout_begone_cellar shout_warning shove_drover think_hall_lectern think_lectern think_letter throw_bones throw_fold_bones turn_wheel_1 turn_wheel_2 turn_wheel_3 yard_hide'.split(
    ' ',
  );

// Breaks: a drawing off statusGlyphs' frame (ink outside 3 to 21, more than four strokes), or a
// showcase slot key with no drawing, which would fall back to the neutral mark at render.
test('every action drawing keeps the frame, and every showcase slot key has one', () => {
  for (const [key, d] of Object.entries({ ...actionGlyphs, OPENER })) {
    const { out, subpaths } = points(d);
    assert.ok(subpaths >= 1 && subpaths <= 4, `${key}: ${subpaths} subpaths`);
    for (const [x, y] of out)
      assert.ok(x >= 3 && x <= 21 && y >= 3 && y <= 21, `${key}: ${x},${y} off the frame`);
  }
  // slotsOf's fillers as the kernel projects them (commands/actions.ts cartridge, keyed): a scripted
  // action (no registered `command`) not aimed by a held tool, by its file key; an unaimed spell, by its word.
  const root = new URL('../../../', import.meta.url);
  const keys = globSync('cartridges/toolbox_showcase/**/actions/*.json', { cwd: root }).flatMap(
    (f) => {
      const { command, target = {} } = JSON.parse(readFileSync(new URL(f, root), 'utf8'));
      if (command || target.kind === 'use') return [];
      if (target.kind === 'spell') return target.aimed ? [] : [target.word as string];
      return [basename(f, '.json')];
    },
  );
  assert.ok(keys.includes('ward') && keys.includes('pull_a')); // the glob found words and scripted actions
  assert.deepEqual(
    keys.filter((k) => !(k in actionGlyphs) && !neutral.includes(k)),
    [],
  );
});

// Every element a drawing holds, depth first.
const tree = (n: any): any[] =>
  n?.props ? [n, ...[n.props.children].flat(Infinity).flatMap(tree)] : [];
const c = { fg: 'fg', dim: 'dim', bg: 'bg', line: 'line', action: 'action' } as any;
const end = (d: string) =>
  d
    .match(/(-?[\d.]+) (-?[\d.]+)Z?$/)!
    .slice(1)
    .map(Number);

// Breaks: a wedge not from 12 o'clock or not clockwise, a large-arc flag on the wrong side of half, a
// seam on the wrong radius, or a slot off the touch target or the glyph off the disc's centre.
test('the cooling wedge sweeps clockwise from 12; the drawing sits centred in a touch-sized disc', () => {
  const { SIDE, MID, R } = frame;
  assert.deepEqual([MID * 2, R * 2], [SIDE, size.touch]);
  const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]!) < 1e-9);
  assert.ok(close(end(arc(R, 0.25)), [MID + R, MID]), "a quarter ends at 3 o'clock");
  assert.ok(arc(R, 0.25).startsWith(`M${MID} ${MID - R}`), 'an arc starts at 12');
  assert.ok(
    arc(R, 0.25, true).startsWith(`M${MID} ${MID}L${MID} ${MID - R}`),
    'a wedge from the centre',
  );
  assert.match(arc(R, 0.75), / 0 1 1 /, 'past half: the large arc');
  assert.match(arc(R, 0.5), / 0 0 1 /, 'half: the small arc');
  assert.ok(
    close(end(still(0.25).seams as string), [MID + R, MID]),
    'the second seam on the share',
  );
  const g = tree(inked(c, 'M3 3', 'ready')).find((n) => n.props.transform);
  const [{ translateX }, { translateY }, { scale }] = g.props.transform;
  assert.equal(translateX, translateY);
  assert.equal(translateX + 12 * scale, MID, 'the 24 box centred');
  assert.equal(translateX, MID - R + space.md, 'the glyph inset in the disc');
});

// Breaks: a state drawn with another's disc, wedge, ring or thinning (icon-style-guide.md, States), or a
// still slot that keeps its WebGL context.
test('each Inked state draws its own disc, wedge and ring', () => {
  const { R } = frame;
  const drawn = (state: any) =>
    tree(
      inked(c, 'M3 3', state, state === 'barred' || state === 'cooling' ? still(0.5) : undefined),
    ).map((n) => [n.type, n.props.color ?? n.props.opacity, n.props.r ?? n.props.style ?? null]);
  const empty = inked(c, 'M3 3', 'empty') as any;
  assert.deepEqual(
    [empty.type, empty.props.color, empty.props.r + size.rule / 2],
    ['Circle', 'line', R],
  );
  const disc = (color: string) => ['Circle', color, R];
  const glyph = ['Path', 'bg', 'stroke'];
  assert.deepEqual(drawn('ready'), [
    ['Group', 1, null],
    disc('fg'),
    ['Group', undefined, null],
    glyph,
  ]);
  assert.equal(drawn('pressed')[0]![1], 1 - opacity.press);
  assert.deepEqual(drawn('barred').slice(1), [disc('dim'), ['Group', undefined, null], glyph]);
  assert.deepEqual(drawn('cooling').slice(1, 4), [
    disc('dim'),
    ['Path', 'fg', null],
    ['Path', 'bg', 'stroke'],
  ]);
  const ring = drawn('focused').at(-1)!;
  assert.deepEqual(
    [ring[0], ring[1], (ring[2] as number) - size.focus / 2 - R],
    ['Circle', 'action', size.focus],
  );
  const canvas = (state: any) => (HotbarGlyph({ d: 'M3 3', state, share: 0.5 }) as any).props;
  assert.deepEqual(
    [
      canvas('cooling').__destroyWebGLContextAfterRender,
      canvas('ready').__destroyWebGLContextAfterRender,
    ],
    [false, true],
  );
});
