// The Map page as dots and lines (book-ui.md, Minimap, map and presentation controls; loka-wz6f).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { book } from './__tests__/polish-book.test.ts';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';

const showcase = () => book(compiled('cartridges/toolbox_showcase') as never);
const INN = 'Crossroads Inn';

// Breaks: the Map draws action, Where or Go cards again, a room name or Back to map inside it, or loses an
// unexplored exit's open dot or its name.
test('the Map at the start: the inn ringed, an open dot per exit, no actions', () => {
  const h = showcase();
  h.map();
  assert.deepEqual(h.labels().sort(), [
    'Back to World',
    `${INN}, current place`,
    ...['above', 'below', 'east of', 'north of', 'south of', 'west of'].map(
      (d) => `Unexplored, ${d} ${INN}`,
    ),
  ]);
  assert.equal(h.text().includes(INN), false); // only the caption ever names a dot
  h.sql.close();
});

// Breaks: a tapped dot does not caption its room, an open dot names the room it leads to, or a
// level change keeps the other level's caption.
test('a tapped dot names its room under the map; an open dot reads Unexplored', () => {
  const h = showcase();
  for (const d of ['east', 'west', 'down']) h.go(d);
  h.map();
  h.tap('Next map level'); // the inn's level, from the undercroft's
  assert.deepEqual(
    h.labels().filter((l) => !l.startsWith('Unexplored')),
    ['Previous map level', 'Tidewater Steps', INN, 'Back to World'],
  );
  h.tap(INN);
  assert.ok(h.text().includes(INN));
  h.tap(`Unexplored, north of ${INN}`);
  assert.ok(h.text().includes('Unexplored'));
  assert.equal(h.text().includes(INN), false);
  h.tap('Tidewater Steps');
  h.tap('Previous map level');
  assert.equal(h.text().includes('Tidewater Steps'), false);
  h.sql.close();
});
