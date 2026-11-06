// The Room card's details (play/room_card.ts): every expected answer is a hand-checked literal.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { detailed } from '../play/card.ts';

const defs = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../schemas/source/defs.schema.json'), 'utf8'),
).$defs;

// Break: a detail added on the Room card stays refused (InspectableDetail requires aliases and a
// description; the description's Book edit is "not on this page"), or a kept one is rewritten
// (loka-wfrgk.76): an alias the author cleared is refilled, or a renamed detail keeps its old key
// as alias. rjsf's placeholder key is no alias, so `newKey` gets only the `~`.
test('a new room detail takes a `~` description and its key as alias; a kept one is not refilled', () => {
  const cleft = { aliases: ['cleft'], description: { prose: 'k' } };
  const doc = { details: { cleft: { aliases: [] }, newKey: {}, well: { aliases: [] } } };
  assert.deepEqual(detailed({ details: { cleft } }, doc, defs).details, {
    cleft: { aliases: [] },
    newKey: { description: { prose: '~' } },
    well: { aliases: ['well'], description: { prose: '~' } },
  });
  const was = {
    details: { cleft, newKey: { description: { prose: '~' } }, pit: { aliases: ['hole'] } },
  };
  const renamed = { details: { crack: cleft, well: was.details.newKey, shaft: was.details.pit } };
  assert.deepEqual(detailed(was, renamed, defs).details, {
    crack: { ...cleft, aliases: ['crack'] },
    well: { aliases: ['well'], description: { prose: '~' } },
    shaft: { aliases: ['hole'], description: { prose: '~' } },
  });
  const cased = { details: { Crack: cleft } }; // a key that is no alias leaves the old one out
  assert.deepEqual(detailed(was, cased, defs).details, { Crack: { ...cleft, aliases: [] } });
});
