// The smoke screen's controller on Node with real SQLite (node:sqlite), one connection per
// simulated process, as local_story.test.ts does. Expected values are literals read from the
// items fixture (protocol/fixtures/cartridge_items_hash.json): the Ferry Landing holds Bram and
// a leather satchel with an exit north to the Village Green.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { read } from '../../../kernel/ts/test/read.ts';
import { openSmoke } from './smoke.ts';

type P = (string | number | null)[];
const processOn = (path: string) => {
  const sql = new DatabaseSync(path);
  const smoke = openSmoke(
    {
      execSync: (s) => sql.exec(s),
      runSync: (s, ...p: P) => sql.prepare(s).run(...p),
      getFirstSync: <T>(s: string, ...p: P) => (sql.prepare(s).get(...p) ?? null) as T | null,
      getAllSync: <T>(s: string, ...p: P) => sql.prepare(s).all(...p) as T[],
    },
    read('protocol/fixtures/cartridge_items_hash.json') as never,
  );
  const now = () => {
    const { view, text, buttons, log } = smoke.screen();
    return {
      place: text(view.place.title.key),
      carrying: view.inventory.map((e) => text(e.name)),
      buttons: buttons.map((b) => b.label),
      log: [...log],
    };
  };
  const press = (label: string) =>
    smoke.press(smoke.screen().buttons.find((b) => b.label === label)!);
  return { sql, now, press };
};

// Breaks: a button that sends the wrong invocation (target, direction or actor), a world that is
// not committed through the authority, a restart that loads the fresh world instead of the save,
// or invocation ids that restart at 1 after a restart (the receipt of the first take would then
// make the next press a conflict instead of a move).
test('a scripted session survives a restart and plays on', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-sm-')), 'save.db');
  const a = processOn(path);
  assert.equal(a.now().place, 'Ferry Landing');
  assert.deepEqual(a.now().buttons, ['look', 'scan', 'Go north', 'take a leather satchel']);
  a.press('take a leather satchel');
  assert.deepEqual(a.now().carrying, ['a leather satchel']);
  assert.deepEqual(a.now().log, ['> take a leather satchel', 'taken']);
  a.press('Go north');
  assert.equal(a.now().place, 'Village Green');
  a.sql.close();

  const b = processOn(path);
  assert.equal(b.now().place, 'Village Green');
  assert.deepEqual(b.now().carrying, ['a leather satchel']);
  assert.deepEqual(b.now().log, []);
  assert.ok(b.now().buttons.includes('drop a leather satchel'));
  b.press('Go south');
  assert.deepEqual(b.now().log, ['> Go south', 'moved']);
  assert.equal(b.now().place, 'Ferry Landing');
});
