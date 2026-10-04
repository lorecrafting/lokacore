// The Lantern by touch (R6P P5b; pre-release-proof.md:55-61, 06 §43, 04 §16): the smoke controller
// over the compiled Lantern (protocol/fixtures/cartridge_lantern_hash.json) on Node with real SQLite
// (node:sqlite), one connection per simulated process. Expected values are literals from the
// cartridge text (cartridges/lantern_proof/text.json); the Lantern has no wait (owner decision,
// docs/decisions/owner-decision-untimed-lantern-2026-10-02.md), so Bram is always at the landing.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { openGame } from '../../authority/local-story/session.ts';
import { absent, group } from './model.ts';
import { presenter } from './presenter.ts';
import { reason } from './words.ts';

const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../protocol/fixtures/${name}`, import.meta.url), 'utf8'));
const LANTERN = read('cartridge_lantern_hash.json');
const FERRY = read('cartridge_ferry_hash.json');
const CARRY = 'You keep the lantern. Bram nods once and points you down the bank.';
const LEAVE = 'You hand Bram the lantern. He lifts it toward the reeds and calls the others in.';
const LANDING =
  "Bram steadies the ferry with his boot. Across the water, someone's lantern swings once between the reeds and goes dark. An old gate stands in the west fence.";
const ACCEPT = "You say you'll fetch it. Bram nods toward the path north.";
// Accept the quest from Bram, fetch the lantern from the shelter by the green and the reed bank,
// come back.
const FETCH = [
  'Talk to Bram the ferryman',
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
const processOn = (path: string, cartridge = LANTERN) => {
  const sql = new DatabaseSync(path);
  const smoke = presenter(
    openGame(adapt(sql), cartridge, {
      newId: randomUUID,
      kernel_version: `loka-kernel@${'0'.repeat(40)}`,
    }),
  );
  const screen = () => smoke.screen();
  const find = (label: string, from = screen()) =>
    from.buttons.find((b) => b.label === label) ?? assert.fail(label);
  const tap = (...labels: string[]) => labels.forEach((l) => smoke.press(find(l)));
  const revision = () => sql.prepare('SELECT revision FROM head').get()!.revision;
  return { sql, smoke, screen, find, tap, revision };
};
const fresh = (cartridge = LANTERN) =>
  processOn(join(mkdtempSync(join(tmpdir(), 'loka-touch-')), 'save.db'), cartridge);

// Breaks: a choose button whose input lacks the continuation (or names the choice wrong), so the
// press is refused; or a choice drawn without its Close (a trap, 06 §43).
test('talk by day offers one button per choice and Close; carry narrates', () => {
  const a = fresh();
  a.tap(...FETCH, 'Talk to Bram the ferryman');
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
  a.tap('Talk to Bram the ferryman');
  const drawn = a.screen();
  a.smoke.press(a.find("Offer to fetch Bram's lantern", drawn));
  const revision = a.revision();
  a.smoke.press(a.find('Go north', drawn));
  assert.equal(a.revision(), revision);
  assert.equal(a.screen().view.place.title.key, 'room.landing.title');
  assert.deepEqual(a.screen().log.slice(-2), [ACCEPT, 'The page had changed; here it is again.']);
  a.tap('Go north'); // the redrawn screen's buttons are current
  assert.equal(a.screen().view.place.title.key, 'room.green.title');
});

// Breaks (06 §43, 06:1404): a reopen whose log starts empty, so a crash right after the choice
// loses its narration; or one that shows a narration in a game that has none.
test('a reopen shows the last committed narration first; a fresh game none', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'loka-touch-')), 'save.db');
  const a = processOn(path);
  assert.deepEqual(a.screen().log, []);
  a.tap(...FETCH, 'Talk to Bram the ferryman', 'Leave it with the search party');
  a.sql.close();
  assert.deepEqual(processOn(path).screen().log, [LEAVE]);
});

// Breaks (06 §43, :1402): a choice that blocks walking away, answers open without Bram, a Close
// that changes the outcome (sets the plan or ends the quest), or a closed talk that cannot be
// opened again where Bram is.
test('walked away: the choices say why, Close leaves the quest open, the landing resolves it', () => {
  const a = fresh();
  a.tap(...FETCH, 'Talk to Bram the ferryman', 'Go north');
  assert.deepEqual(
    a.screen().view.choice!.choices.map((o) => [o.choice_id, o.available || o.reason.code]),
    [
      ['carry', 'not_present'],
      ['leave', 'not_present'],
    ],
  );
  assert.ok(!a.screen().buttons.some((b) => b.action_key === 'choose'));
  assert.equal(absent(a.screen().view), 'They are not here to answer. Find them, or close this.');
  a.tap('Close');
  assert.equal(a.screen().view.choice, undefined);
  assert.deepEqual(
    a.screen().view.journal.map((q) => q.state),
    ['active'],
  );
  a.tap('Go south');
  const { view, text } = a.screen();
  assert.equal(text(view.place.description.key), LANDING); // search_plan unset
  a.tap('Talk to Bram the ferryman', 'Carry it along the bank');
  assert.equal(a.screen().log.at(-1), CARRY);
  assert.deepEqual(
    a.screen().view.journal.map((q) => q.state),
    ['resolved'],
  );
});

// Breaks (R6P Polish notes 1, 13): a raw outcome or refusal code in the log (`moved`,
// `choice_opened`, "You can't: exit_locked"), a take with no answer, or a look that logs its echo.
// A code is a lower-case word or has an underscore; story text has neither.
const CODE = /^[a-z_]+$|[a-z]_[a-z]/;
test('the log has story words, never a kernel code, across both endings', () => {
  const a = fresh();
  a.tap(...FETCH.slice(0, 5));
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
  assert.equal(a.screen().log.at(-1), "You can't do that: locked.");
  a.tap('Talk to Bram the ferryman', 'Go north', 'Close', 'Go south');
  a.tap('Talk to Bram the ferryman', 'Carry it along the bank');
  const b = fresh();
  b.tap(...FETCH, 'Talk to Bram the ferryman', 'Leave it with the search party');
  const lines = [...a.screen().log, ...b.screen().log];
  assert.deepEqual(
    lines.filter((l) => CODE.test(l)),
    [],
  );
  assert.ok(lines.includes(CARRY) && lines.includes(LEAVE));
});

// Breaks (note 3): items counted as comers (a dropped lantern "arrives"), the diff run across a
// place change (walking away from Bram logs "Bram the ferryman leaves"), or an NPC's scheduled
// leaving not logged (the Lantern has no schedule: the ferry fixture's Bram leaves at 19:00).
test('an NPC who leaves while you stay is logged, and nothing else', () => {
  const comings = (log: string[]) => log.filter((l) => / (leaves|arrives)\.$/.test(l));
  const a = fresh();
  a.tap(...FETCH, 'Go north', 'Go south', 'Drop a brass lantern');
  assert.deepEqual(comings(a.screen().log), []);
  const f = fresh(FERRY);
  const wait = { label: 'Wait', action_key: 'wait', target_ids: [], input: { until: 19 * 3600 } };
  f.smoke.press(wait);
  assert.deepEqual(comings(f.screen().log), ['Bram the ferryman leaves.']);
});

// Breaks (note 2, review F-2): a refusal code the Lantern reaches with no words, so a closed
// answer reads "…: not present" or a refusal "…: invalid state". Each code is reached for real.
test('closed answers and a stale answer give their reason in words, not their code', () => {
  const a = fresh();
  const spaced = (code: string) => code.replaceAll('_', ' ');
  const closed = () =>
    a.screen().view.choice!.choices.map((o) => (o.available ? '' : o.reason.code));
  a.tap(...FETCH, 'Talk to Bram the ferryman', 'Drop a brass lantern');
  const reached = closed();
  const { continuation_id } = a.screen().view.choice!;
  a.tap('Take a brass lantern', 'Go north');
  reached.push(...closed());
  assert.deepEqual(reached, ['not_owned', 'not_owned', 'not_present', 'not_present']);
  for (const code of reached) assert.notEqual(reason(code), spaced(code));
  a.tap('Close');
  const input = { choice_id: 'carry', continuation_id };
  a.smoke.press({ label: 'Carry', action_key: 'choose', target_ids: [], input });
  assert.match(a.screen().log.at(-1)!, /^You can't do that: /);
  assert.ok(!a.screen().log.at(-1)!.includes(spaced('invalid_state')));
});

// Breaks: a per-exit unlock/open button loses its direction or is sent as an item action,
// so the real authority cannot transition the gate despite the held key.
test('the Lantern gate unlocks and opens through its projected exit buttons', () => {
  const a = fresh();
  a.tap(...FETCH);
  assert.deepEqual(
    group(a.screen().buttons)
      .door('west')
      .map((b) => b.label),
    ['Unlock the old gate (west)'],
  );
  a.tap('Unlock the old gate (west)');
  assert.equal(a.screen().view.exits.find((e) => e.direction === 'west')!.door!.state, 'closed');
  a.tap('Open the old gate (west)');
  const west = a.screen().view.exits.find((e) => e.direction === 'west')!;
  assert.equal(west.door!.state, 'open');
  assert.equal(west.available, true);
  a.sql.close();
});
