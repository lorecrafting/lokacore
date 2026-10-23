// The Reading size (docs/system/book-ui.md#world-and-status-entry) over literal sizes, not the token table.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTENTS } from './__tests__/control.test.ts';
import { book, nodes } from './__tests__/polish-book.test.ts';
import { readingFactor, readingSize, readingType, tapBleed } from './reading.ts';
import { type } from './tokens.ts';

const lines = (f: number) => {
  const t = readingType(f);
  return { body: [t.body.fontSize, t.body.lineHeight], log: [t.log.fontSize, t.log.lineHeight] };
};

// Breaks: a step or the cap off its value, a size left unrounded, a role left fixed (loka-x6t.86:
// every role scales, titles and small included), a modifier given a size, or the bleed not clamped
// at a line taller than a touch target.
test('each step scales every text role, the system scale stops at the cap, modifiers pass through', () => {
  const max = readingFactor('larger', 2);
  const steps = [
    readingFactor('standard', 1),
    readingFactor('large', 1),
    readingFactor('larger', 1),
    max,
  ];
  assert.deepEqual(steps.map(lines), [
    { body: [18, 28], log: [17, 26] },
    { body: [21, 32], log: [20, 30] },
    { body: [23, 36], log: [22, 34] },
    { body: [27, 42], log: [26, 39] },
  ]);
  const sized = (role: 'control' | 'pageTitle' | 'small') =>
    steps.map((f) => [readingType(f)[role].fontSize, readingType(f)[role].lineHeight]);
  assert.deepEqual(sized('control'), [
    [14, 20],
    [16, 23],
    [18, 26],
    [21, 30],
  ]);
  assert.deepEqual(sized('pageTitle'), [
    [26, 30],
    [30, 35],
    [34, 39],
    [39, 45],
  ]);
  assert.deepEqual(sized('small'), [
    [13, 19],
    [15, 22],
    [17, 25],
    [20, 29],
  ]);
  assert.equal(readingType(max).control.fontFamily, type.control.fontFamily);
  assert.deepEqual(
    steps.map((f) => tapBleed(readingType(f).body.lineHeight)),
    [8, 6, 4, 1],
  );
  assert.equal(tapBleed(48), 0);
  const big = readingType(max);
  assert.deepEqual(
    [big.speaker, big.tag, big.runningHead, big.tile].map((r) => r.fontSize),
    [26, 20, 18, 35],
  );
  assert.deepEqual([big.named, big.italic], [type.named, type.italic]);
});

// Breaks: a stored value that is not a step, or a store that throws, reaches the Book; a failed
// write throws into the Settings press.
test('the stored Reading size reads Standard unless it is a step, and a failed write is kept quiet', () => {
  const store = (v: string | null) =>
    readingSize({ getItemSync: () => v, setItemSync: () => {} }, 'k');
  assert.deepEqual(
    ['large', 'huge', null].map((v) => store(v).get()),
    ['large', 'standard', 'standard'],
  );
  const broken = readingSize(
    {
      getItemSync: () => {
        throw new Error('locked');
      },
      setItemSync: () => {
        throw new Error('full');
      },
    },
    'k',
  );
  assert.equal(broken.get(), 'standard');
  assert.doesNotThrow(() => broken.set('larger'));
});

// Breaks: the Settings row not a radio group with one checked step, the chosen chip not drawn inverted,
// the choice not saved or not reaching the page, the launch not reading the stored step, or the system
// scale ignored.
test('Settings chooses the Reading size: saved, shown inverted, and the pages grow with it', () => {
  const saved: string[] = [];
  const h = book(undefined, undefined, undefined, undefined, {
    get: () => 'large',
    set: (s) => saved.push(s),
    fontScale: () => 1.2,
  });
  const drawn = () => h.draw();
  const chips = () => drawn().filter((n) => n.props?.accessibilityRole === 'radio');
  const body = () =>
    drawn().filter((n) => n.type === 'Text' && n.props.style?.lineHeight === 42).length;
  h.tap(CONTENTS);
  h.tap('Settings');
  assert.deepEqual(
    chips().map((n) => [n.props.accessibilityLabel, n.props['aria-checked']]),
    [
      ['Standard', false],
      ['Large', true],
      ['Larger', false],
    ],
  );
  const [plain, chosen] = chips().map((n) => [
    n.props.style,
    nodes(n.props.children)[0].props.style,
  ]);
  const page = drawn().find((n) => n.type === 'SafeAreaView').props.style.backgroundColor;
  assert.deepEqual(
    [chosen[0].backgroundColor, chosen[1].color],
    [plain[1].color, page], // the ink fill, the page's word
  );
  assert.equal(chosen[1].fontSize, 19); // control 14 x 1.15 x 1.2
  h.tap('Larger');
  assert.deepEqual(saved, ['larger']);
  assert.equal(nodes(chips()[2].props.children)[0].props.style.fontSize, 21); // 1.3 x 1.2 caps at 1.5
  // the system never scales a Book line again
  assert.ok(drawn().every((n) => n.type !== 'Text' || n.props.allowFontScaling === false));
  h.tap('Back to World');
  assert.ok(body() > 0); // body 28 x 1.5
  // loka-x6t.86: the title and the status line scale too (pageTitle 26/30, small 13/19 x 1.5); the
  // room's title is centred (owner mvl8eti4yeoe; detail page titles stay left)
  const sized = (n: any) =>
    n.type === 'Text' && [n.props.style?.fontSize, n.props.style?.lineHeight];
  const title = drawn().find((n) => String(sized(n)) === '39,45');
  assert.equal(title.props.style.textAlign, 'center');
  assert.ok(drawn().some((n) => String(sized(n)) === '20,29'));
  assert.ok(drawn().some((n) => n.type === 'Pressable' && n.props.style?.paddingVertical === 1));
});
