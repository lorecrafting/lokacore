// In dev a cartridge that cannot build its world, or restore a save whose rows parse, names its
// cause and offers no start over; "save damaged" stays for an unreadable save (save.md, refusals).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { read } from '../../../../kernel/ts/test/read.ts';
import { localSession, openGame } from '../session.ts';
import { bundle as codex } from './priory-fixture.ts';
import { sqliteHost } from './elapsed-host.test.ts';

const { canonical, sha256 } = read('protocol/fixtures/toolbox_showcase_hash.json');
const toolbox = { canonical, sha256 };
const refusal = (open: () => unknown) => {
  try {
    open();
  } catch (e) {
    return { message: (e as Error).message, kind: ((e as Error).cause as { kind?: string })?.kind };
  }
  assert.fail('the game opened');
};
// A dev save of the toolbox whose first container row holds `value`: a stranger id parses but
// does not restore; '{' does not parse.
function saveWith(value: string) {
  const a = sqliteHost();
  openGame(a.db, toolbox, { ...a.host, dev: true });
  const row = a.sql
    .prepare("SELECT key FROM state_row WHERE section = 'containers' LIMIT 1")
    .get() as { key: string };
  a.sql
    .prepare("UPDATE state_row SET value = ? WHERE section = 'containers' AND key = ?")
    .run(value, row.key);
  const rows = () =>
    JSON.stringify(a.sql.prepare('SELECT * FROM state_row ORDER BY section, key').all());
  return { ...a, rows, before: rows() };
}
const STRANGER = '"00000000-0000-4000-8000-000000000000"';

// Breaks: store.ts restored() or authority.ts folds the cartridge's failure into save_corrupt
// (the damaged-save screen with Start over); control: the same save in a release is save_corrupt.
test('in dev a parsed save the cartridge cannot restore is a cartridge_error that writes nothing', () => {
  const a = saveWith(STRANGER);
  const r = refusal(() => openGame(a.db, toolbox, { ...a.host, dev: true }));
  assert.deepEqual(r, {
    kind: 'cartridge_error',
    message: 'SyntaxError: malformed JSON: the saved world does not fit the cartridge',
  });
  assert.equal(a.rows(), a.before);
  const s = localSession(
    () => a.db,
    () => assert.fail('removed'),
    toolbox,
    { ...a.host, dev: true },
  );
  assert.equal(s.failed()?.kind, 'cartridge_error');
  assert.equal(s.failed()?.startOver, false);
  assert.equal(s.startOver(), undefined);
  assert.equal(a.rows(), a.before);
  assert.equal(refusal(() => openGame(a.db, toolbox, a.host)).kind, 'save_corrupt');
});

// Breaks: dev classifies by mode, not by cause, so a save whose rows do not parse is blamed on the files.
test('in dev a save whose rows do not parse is still save_corrupt', () => {
  const a = saveWith('{');
  assert.equal(
    refusal(() => openGame(a.db, toolbox, { ...a.host, dev: true })).kind,
    'save_corrupt',
  );
});

// Breaks: session.ts built() is dropped around cartridgeOf/newWorld/openStory, so a cartridge that
// does not load or whose genesis cannot be saved reaches the Book untyped, its cause unnamed.
test('in dev a cartridge that does not load or build its first save names the cause; a release stays untyped', () => {
  const broken = { canonical, sha256: '0'.repeat(64) };
  const nowhere = codex((c) => (c.entry.key = 'nowhere'));
  for (const [bundled, text] of [
    [broken, 'CONTENT_HASH_MISMATCH'],
    [nowhere, 'invalid_canonical'],
  ] as const) {
    const a = sqliteHost();
    const r = refusal(() => openGame(a.db, bundled, { ...a.host, dev: true }));
    assert.equal(r.kind, 'cartridge_error');
    assert.match(r.message, new RegExp(text));
    assert.equal(
      a.sql.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'save'").get()?.n ?? 0,
      0,
    );
    assert.equal(refusal(() => openGame(sqliteHost().db, bundled, a.host)).kind, undefined);
  }
});
