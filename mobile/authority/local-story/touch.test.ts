// The Lantern by touch (R6P P5b; pre-release-proof.md:55-61, 06 §43, 04 §16): the smoke controller
// over the compiled Lantern (protocol/fixtures/cartridge_lantern_hash.json) on Node with real SQLite
// (node:sqlite), one connection per simulated process. Expected values are literals from the
// cartridge text (cartridges/lantern_proof/text.json) and the fixture's day: 06:00 to Bram's 19:00.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { read } from '../../../kernel/ts/test/read.ts';
import { openSmoke, playSmoke } from './smoke.ts';

const LANTERN = read('protocol/fixtures/cartridge_lantern_hash.json') as never;
const CARRY = 'You keep the lantern. Bram nods once and points you down the bank.';
const LEAVE = 'You hand Bram the lantern. He lifts it toward the reeds and calls the others in.';
const PLAIN_LANDING =
  'A slick wooden landing runs out into the reeds. The ferry rocks at its rope. An old gate stands in the west fence.';
// Accept the quest, fetch the lantern from the shelter by the green and the reed bank, come back.
const FETCH = [
  "Offer to fetch Bram's lantern",
  'Go north',
  'Go east',
  'Go east',
  'Take a brass lantern',
  'Go west',
  'Go west',
  'Go south',
];

type P = (string | number | null)[];
const adapt = (sql: DatabaseSync) => ({
  execSync: (s: string) => void sql.exec(s),
  isInTransactionSync: () => sql.isTransaction,
  runSync: (s: string, ...p: P) => sql.prepare(s).run(...p),
  getFirstSync: <T>(s: string, ...p: P) => (sql.prepare(s).get(...p) ?? null) as T | null,
  getAllSync: <T>(s: string, ...p: P) => sql.prepare(s).all(...p) as T[],
});
const processOn = (path: string) => {
  const sql = new DatabaseSync(path);
  const smoke = openSmoke(adapt(sql), LANTERN, randomUUID);
  const screen = () => smoke.screen();
  const find = (label: string, from = screen()) =>
    [...from.buttons, ...from.waits].find((b) => b.label === label) ?? assert.fail(label);
  const tap = (...labels: string[]) => labels.forEach((l) => smoke.press(find(l)));
  const revision = () => sql.prepare('SELECT revision FROM head').get()!.revision;
  return { sql, smoke, screen, find, tap, revision };
};
const fresh = () => processOn(join(mkdtempSync(join(tmpdir(), 'loka-touch-')), 'save.db'));

// Breaks: a choose button whose input lacks the continuation (or names the choice wrong), so the
// press is refused; or a choice drawn without its Close (a trap, 06 §43).
test('talk by day offers one button per choice and Close; carry narrates', () => {
  const a = fresh();
  a.tap(...FETCH, 'Talk Bram the ferryman');
  const { view, buttons } = a.screen();
  const continuation_id = view.choice!.continuation_id;
  assert.deepEqual(
    buttons
      .filter((b) => ['choose', 'close_choice'].includes(b.action_key))
      .map((b) => [b.label, b.input]),
    [
      ['Carry it along the bank', { choice_id: 'carry', continuation_id }],
      ['Leave it with the search party', { choice_id: 'leave', continuation_id }],
      ['Close', {}],
    ],
  );
  a.tap('Carry it along the bank');
  assert.equal(a.screen().log.at(-1), CARRY);
});

// Breaks (04 §16): a token read when the button is pressed rather than when its screen was drawn
// (it then always matches), or a stale reply logged as a refusal code.
test('a second press from the same screen is a stale view and changes nothing', () => {
  const a = fresh();
  const drawn = a.screen();
  a.smoke.press(a.find("Offer to fetch Bram's lantern", drawn));
  const revision = a.revision();
  a.smoke.press(a.find('Go north', drawn));
  assert.equal(a.revision(), revision);
  assert.equal(a.screen().view.place.title.key, 'room.landing.title');
  assert.deepEqual(a.screen().log.slice(-3), [
    'You take on the task. It is in your journal.',
    '> Go north',
    'The page had changed; here it is again.',
  ]);
  a.tap('Go north'); // the redrawn screen's buttons are current
  assert.equal(a.screen().view.place.title.key, 'room.green.title');
});

// Breaks (06 §43, 06:1404): a reopen whose log starts empty, so a crash right after the choice
// loses its narration; or one that shows a narration in a game that has none.
test('a reopen shows the last committed narration first; a fresh game none', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-touch-')), 'save.db');
  const a = processOn(path);
  assert.deepEqual(a.screen().log, []);
  a.tap(...FETCH, 'Talk Bram the ferryman', 'Leave it with the search party');
  a.sql.close();
  assert.deepEqual(processOn(path).screen().log, [LEAVE]);
});

// Breaks (03 §15, OFF-07): a reopen that swallows a corrupt narration receipt (SQLite's "malformed
// JSON") and plays on over it, so the damage is never shown and no start over is offered.
test('a corrupt narration receipt fails the reopen, with start over offered', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-touch-')), 'save.db');
  const a = processOn(path);
  a.tap(...FETCH, 'Talk Bram the ferryman', 'Leave it with the search party');
  a.sql.exec(
    "UPDATE receipt SET response = '{' WHERE revision = (SELECT max(revision) FROM receipt)",
  );
  a.sql.close();
  const c = playSmoke(
    () => adapt(new DatabaseSync(path)),
    () => {},
    LANTERN,
    { newId: randomUUID },
  );
  assert.equal(c.game(), undefined);
  assert.match(c.failed()!.message, /malformed JSON/);
  assert.equal(c.failed()!.replace, true);
});

// Breaks (06 §43, :1402): a choice that blocks Wait, a Close that changes the outcome (sets the
// plan or ends the quest), or a closed talk that cannot be opened again where Bram is.
test('Bram gone at night: the choices say why, Close leaves the quest open, the green resolves it', () => {
  const a = fresh();
  a.tap(...FETCH, 'Talk Bram the ferryman', 'Wait until 19:00');
  assert.deepEqual(
    a.screen().view.choice!.choices.map((o) => [o.choice_id, o.available || o.reason.code]),
    [
      ['carry', 'not_present'],
      ['leave', 'not_present'],
    ],
  );
  assert.ok(!a.screen().buttons.some((b) => b.action_key === 'choose'));
  a.tap('Close');
  const { view, text } = a.screen();
  assert.equal(view.choice, undefined);
  assert.deepEqual(
    view.journal.map((q) => q.state),
    ['active'],
  );
  assert.equal(text(view.place.description.key), PLAIN_LANDING); // search_plan unset
  a.tap('Go north', 'Talk Bram the ferryman', 'Carry it along the bank');
  assert.equal(a.screen().log.at(-1), CARRY);
  assert.deepEqual(
    a.screen().view.journal.map((q) => q.state),
    ['resolved'],
  );
});

// Breaks: an hour missing or off by one (a wait to now, or past the 23:00 cap), or waits offered
// after the last hour.
test('the waits run from the next whole hour to 23:00', () => {
  const a = fresh();
  const waits = a.screen().waits;
  assert.deepEqual(
    waits.map((b) => b.label),
    [
      'Wait until 07:00',
      'Wait until 08:00',
      'Wait until 09:00',
      'Wait until 10:00',
      'Wait until 11:00',
      'Wait until 12:00',
      'Wait until 13:00',
      'Wait until 14:00',
      'Wait until 15:00',
      'Wait until 16:00',
      'Wait until 17:00',
      'Wait until 18:00',
      'Wait until 19:00',
      'Wait until 20:00',
      'Wait until 21:00',
      'Wait until 22:00',
      'Wait until 23:00',
    ],
  );
  assert.deepEqual([waits[0]!.input, waits[16]!.input], [{ until: 25200 }, { until: 82800 }]);
  a.tap('Wait until 23:00');
  assert.deepEqual(a.screen().waits, []);
});

// Breaks (R6P Polish notes 1, 13): a raw outcome or refusal code in the log (`moved`,
// `choice_opened`, "You can't: exit_locked"), a take with no answer, or a look that logs its echo.
// A code is a lower-case word or has an underscore; story text has neither.
const CODE = /^[a-z_]+$|[a-z]_[a-z]/;
test('the log has story words, never a kernel code, across both endings', () => {
  const a = fresh();
  a.tap("Offer to fetch Bram's lantern", 'Go north', 'Go east', 'Go east');
  const lantern = a.screen().view.entities.find((e) => e.kind === 'item')!.id;
  const on = a.screen().buttons.filter((b) => b.target_ids.includes(lantern));
  assert.deepEqual(
    on.map((b) => b.label),
    ['Take a brass lantern'],
  );
  a.tap('Take a brass lantern');
  assert.equal(a.screen().log.at(-1), 'Taken.');
  const look = a.find('Look');
  const before = [...a.screen().log];
  a.smoke.press(look);
  assert.deepEqual(a.screen().log, before);
  a.tap('Go west', 'Go west', 'Go south', 'Scan');
  const locked = {
    label: 'Go west',
    action_key: 'move',
    target_ids: [],
    input: { direction: 'west' },
  };
  a.smoke.press(locked);
  a.tap('Talk Bram the ferryman', 'Wait until 19:00', 'Close', 'Go north');
  a.tap('Talk Bram the ferryman', 'Carry it along the bank');
  const b = fresh();
  b.tap(...FETCH, 'Talk Bram the ferryman', 'Leave it with the search party');
  const lines = [...a.screen().log, ...b.screen().log];
  assert.deepEqual(
    lines.filter((l) => CODE.test(l)),
    [],
  );
  assert.ok(lines.includes(CARRY) && lines.includes(LEAVE));
});

// Breaks (note 3): items counted as comers (a dropped lantern "arrives"), or the diff run across a
// place change (walking away from Bram logs "Bram the ferryman leaves").
test('an NPC who leaves while you stay is logged, and nothing else', () => {
  const a = fresh();
  a.tap(...FETCH, 'Go north', 'Go south', 'Drop a brass lantern', 'Wait until 19:00');
  assert.deepEqual(
    a.screen().log.filter((l) => / (leaves|arrives)\.$/.test(l)),
    ['Bram the ferryman leaves.'],
  );
});
