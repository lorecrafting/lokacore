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

// Breaks: a step or the cap off its value, a size left unrounded, a fixed role scaled, a line
// height added to a role without one, or the bleed not clamped at a line taller than a touch target.
test('each step scales the reading roles, the system scale stops at the cap, the rest stays fixed', () => {
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
  assert.deepEqual(
    steps.map((f) => readingType(f).control),
    [14, 16, 18, 21].map((fontSize) => ({ ...type.control, fontSize })),
  );
  assert.deepEqual(
    steps.map((f) => tapBleed(readingType(f).body.lineHeight)),
    [8, 6, 4, 1],
  );
  assert.equal(tapBleed(48), 0);
  const big = readingType(max);
  assert.deepEqual([big.small.fontSize, big.small.lineHeight], [13, 19]);
  assert.deepEqual(
    [big.tile, big.pageTitle, big.roomTitle],
    [type.tile, type.pageTitle, type.roomTitle],
  );
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
  h.tap('Back to World');
  assert.ok(body() > 0); // body 28 x 1.5
  assert.ok(drawn().some((n) => n.type === 'Pressable' && n.props.style?.paddingVertical === 1));
});
