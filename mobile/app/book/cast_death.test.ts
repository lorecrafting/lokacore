// A fight opened by a cast whose rounds and the player's death commit while the Book waits, then
// drain inside the next press (playtest pass 1, row R6): every round line and the death line still
// reach the Combat page.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';

// The spell sampler with a wight that always claws for 2, a player at 3 hp, a lit crypt and flamma
// aimed at the room's occupants (loka-x6t.109).
function cartridge() {
  const dir = mkdtempSync(join(tmpdir(), 'loka-cast-death-'));
  const source = new URL('../../../cartridges/spell_effects_sampler', import.meta.url);
  const edit = (file: string, change: (json: any) => void) => {
    const json = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    change(json);
    writeFileSync(join(dir, file), JSON.stringify(json));
  };
  try {
    cpSync(fileURLToPath(source), dir, { recursive: true });
    edit('npcs/wight.json', (j) => (j.attack = { chance: 100, damage_min: 2, damage_max: 2 }));
    edit('resources.json', (j) => (j.resources.hp.start = 3));
    edit('rooms/crypt.json', (j) => delete j.dark_description);
    edit('cartridge.json', (j) => (j.requires.kernel_api.at_least = '1.119'));
    edit('actions/flamma.json', (j) => {
      j.target.aimed = { scopes: ['room_occupants'] };
      delete j.outcomes.success.sequence[0].npc;
    });
    return compiled(dir);
  } finally {
    rmSync(dir, { recursive: true });
  }
}

// Breaks: receipts committed between frames (drained by the press) never reach the Book, so the
// Combat page keeps only the bolt line and nothing says you fell (book-ui.md, Combat).
test('cast-opened fight: rounds drained by a press still print every round and the death', (t) => {
  const b = book(cartridge() as never);
  t.after(() => b.sql.close());
  b.map();
  b.tap('Go east');
  b.tap('A wight, open');
  b.tap('Cast a spell…');
  b.tap('Flamma, cast flamma on a wight'); // the aimed spell's row on the wight's page
  b.clock.wall += 6000; // two rounds at rate 50, no frame in between
  b.clock.mono += 6000;
  b.tap('Flee');
  assert.deepEqual(b.p.screen().combatLog, [
    'A bolt of fire leaps from your hand.',
    'You miss the wight.',
    'The wight claws you.',
    'The wight claws you.',
    'You fall.',
  ]);
});
