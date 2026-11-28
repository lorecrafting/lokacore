// In dev a cartridge that cannot build its world, or restore a save whose rows parse, names its
// cause and offers no start over; "save damaged" stays for an unreadable save (save.md, refusals).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { read } from '../../../../kernel/ts/test/read.ts';
import { newWorld } from '../../../../kernel/ts/src/index.ts';
import { ElapsedRecoveryError } from '../elapsed-store.ts';
import { adopt, type Story } from '../save.ts';
import { corrupt } from '../store.ts';
import { cartridgeOf, CONTEXT, localSession, openGame, SEED } from '../session.ts';
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
    message: 'the saved world does not fit the cartridge',
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

// Breaks: session.ts built() is dropped around cartridgeOf/newWorld, so a cartridge that does not
// load reaches the Book untyped, its cause unnamed.
test('in dev a cartridge that does not load names the cause; a release stays untyped', () => {
  const broken = { canonical, sha256: '0'.repeat(64) };
  const a = sqliteHost();
  const r = refusal(() => openGame(a.db, broken, { ...a.host, dev: true }));
  assert.equal(r.kind, 'cartridge_error');
  assert.match(r.message, /CONTENT_HASH_MISMATCH/);
  assert.equal(
    a.sql.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'save'").get()?.n ?? 0,
    0,
  );
  assert.equal(refusal(() => openGame(sqliteHost().db, broken, a.host)).kind, undefined);
});

// Breaks: save.ts adopt() lets a dev CartridgeError escape a mid-play reload, so a commit another
// tab wrote fails untyped instead of as save_corrupt (only the open names a cartridge_error).
test('a mid-play reload of a dev save that does not fit is save_corrupt', () => {
  const a = saveWith(STRANGER);
  const fresh = newWorld(cartridgeOf(toolbox), CONTEXT as never, SEED as never);
  const s = { db: a.db, fresh, host: { ...a.host, dev: true } } as unknown as Story;
  assert.throws(
    () => adopt(s),
    (e) => e instanceof ElapsedRecoveryError && e.kind === 'save_corrupt',
  );
});

// Breaks: store.ts corrupt() reads a dev cartridge_error whose text says "malformed" as a corrupt
// file, so localSession offers a Start over that deletes the save (session.ts reopen's replace).
test('a dev cartridge_error is never a corrupt file, whatever its text', () => {
  const told = (cause?: object) => Object.assign(new Error('TypeError: malformed rule'), { cause });
  assert.equal(corrupt(told({ kind: 'cartridge_error' })), false);
  assert.equal(corrupt(told()), true); // control: the same text untyped is a corrupt file
});
