// The Map keeps the current room in view on its level (book-ui.md, Map; loka-x6t.100).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { book, bundle } from './__tests__/polish-book.test.ts';
import { CONTENTS } from './__tests__/control.test.ts';

// Breaks: the map scrolls only when its drawing changes size, so going back to the current room's
// level, when both levels draw the same size, leaves the marker off a narrow page.
// map_positions.json: the shore steps two rooms (144 each) east of the inn, the undercroft below.
test('the Map scrolls back to the current room when its level is shown again', () => {
  const b = book(bundle('toolbox_showcase_hash'));
  for (const d of ['down', 'up', 'east']) (b.map(), b.tap(`Go ${d}`));
  b.tap(CONTENTS);
  b.tap('Map');
  const xs: number[] = [];
  const scroller = b.draw().find((n) => n.type === 'ScrollView' && n.props.horizontal);
  scroller.props.ref.current = { scrollTo: (o: { x: number }) => xs.push(o.x) };
  b.tap('Previous map level');
  b.draw();
  b.tap('Next map level');
  b.draw();
  assert.deepEqual(xs, [288]);
});
