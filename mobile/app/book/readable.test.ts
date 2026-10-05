import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { elapsedHost, receipts } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { localSession } from '../../authority/local-story/session.ts';
import { group, intentOf } from './model.ts';
import { presenter } from './presenter.ts';

const bundle = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/missing_child_v004_hash.json', import.meta.url),
    'utf8',
  ),
);
// Independent Python IdSource literals for the harness context and Missing Child release.
const notice = '251e7a71-b5ad-8d22-858b-533e52cc5415';
const board = 'e368b8b9-c4a5-8d0e-82a0-da17e2d59fe2';
const noticeBody = 'Keep the landing clear. Tie boats to the mooring post.';
const boardBody = 'Lost a tin whistle? Ask at the Drowned Lantern.';

function preview(path = ':memory:', bundled = bundle) {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundled);
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const button = (label: string) =>
    book.screen().buttons.find((b) => b.label === label) ?? assert.fail(label);
  const tap = (...labels: string[]) => labels.forEach((label) => book.press(button(label)));
  const state = () => ({
    rows: a.sql.prepare('SELECT * FROM state_row ORDER BY section, key').all(),
    head: a.sql.prepare('SELECT clock, rng FROM head').get(),
  });
  return { ...a, book, button, tap, state };
}

// Breaks: Read loses its exact target, mutates gameplay state, substitutes observational prose,
// or appends confirmed writing to World rather than the notice detail.
test('production Read targets retain confirmed detail messages without changing state', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  for (const [label, target, body] of [
    ['Read the notice', notice, noticeBody],
    ['Read Lost tin whistle', board, boardBody],
  ]) {
    const before = a.state();
    for (let repetition = 0; repetition < 2; repetition++) {
      const control = a.button(label);
      assert.deepEqual(intentOf(control), {
        action_key: 'read',
        target_ids: [target],
        input: {},
        view_freshness_token: a.game.view().token,
      });
      assert.ok(group([control]).place.includes(control));
      assert.ok(
        a.book
          .screen()
          .view.actions.some(
            (action) => action.action_key === 'read' && action.target_ids?.[0] === target,
          ),
      );
      a.book.press(control);
      assert.equal(a.book.screen().detail(target).at(-1), body);
      assert.equal(
        a.book
          .screen()
          .detail(target)
          .filter((line) => line === body).length,
        repetition + 1,
      );
      assert.deepEqual(a.book.screen().combatLog, []);
      assert.equal(a.book.screen().log.includes(body), false);
      assert.deepEqual(a.state(), before);
    }
    if (target === notice) a.tap('Go north', 'Go east');
  }
});

// Breaks: a durable Read with a lost acknowledgement prints early, retries with a
// new invocation, duplicates prose, or loses its pinned body/target on cold reopen.
test('uncertain Read recovers its one receipt and narration, then reads again after cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-readable-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  let a = preview(path);
  t.after(() => a.sql.close());
  const before = a.state();
  const pin = a.sql.prepare('SELECT pin FROM save').get()!.pin;
  assert.equal(JSON.parse(pin as string).content_hash, bundle.sha256);
  const control = a.button('Read the notice');
  const token = control.token;
  a.fault.kind = 'lost';
  a.fault.armed = true;
  a.book.press(control);
  assert.equal(a.game.pending(), true);
  const id = a.game.pendingInvocation();
  assert.ok(id);
  assert.equal(a.book.screen().log.includes(noticeBody), false);
  const receipt = a.sql.prepare('SELECT * FROM receipt WHERE invocation_id = ?').get(id);
  assert.ok(receipt);
  assert.equal(receipts(a.sql), 1);
  a.book.press(control);
  assert.equal(a.game.pendingInvocation(), id);
  assert.equal(a.book.screen().log.includes(noticeBody), false);
  a.fault.reads = false;
  a.book.press(control);
  assert.equal(a.game.pending(), false);
  assert.deepEqual(a.sql.prepare('SELECT * FROM receipt WHERE invocation_id = ?').get(id), receipt);
  assert.equal(receipts(a.sql), 1);
  assert.deepEqual(a.book.screen().detail(notice), [noticeBody]);
  assert.deepEqual(a.book.screen().log, []);
  assert.deepEqual(control.target_ids, [notice]);
  assert.equal(control.token, token);
  assert.deepEqual(a.state(), before);
  a.sql.close();
  a = preview(path);
  assert.equal(a.sql.prepare('SELECT pin FROM save').get()!.pin, pin);
  assert.deepEqual(a.state(), before);
  assert.deepEqual(a.book.screen().detail(notice), [noticeBody]);
  assert.deepEqual(a.book.screen().log, []);
  assert.deepEqual(a.button('Read the notice').target_ids, [notice]);
  a.tap('Read the notice');
  assert.deepEqual(a.book.screen().detail(notice), [noticeBody, noticeBody]);
  assert.deepEqual(a.book.screen().log, []);
  assert.equal(receipts(a.sql), 2);
  assert.deepEqual(a.state(), before);
});

// Breaks: a stale notice control is retargeted to another room's readable, or a
// rejected detail target invents the readable body in the World log.
test('stale and refused Read retain their target and never narrate an unread body', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  const stale = a.button('Read the notice');
  const captured = intentOf(stale);
  a.tap('Go north', 'Go east');
  const before = a.state();
  const count = receipts(a.sql);
  a.book.press(stale);
  assert.equal(receipts(a.sql), count);
  assert.deepEqual(intentOf(stale), captured);
  assert.equal(a.book.screen().log.at(-1), 'The page had changed; here it is again.');
  a.book.press({
    ...a.button('Read Lost tin whistle'),
    target_ids: [notice],
  });
  assert.equal(receipts(a.sql), count + 1);
  const refused = JSON.parse(
    a.sql.prepare('SELECT response FROM receipt ORDER BY rowid DESC LIMIT 1').get()!
      .response as string,
  );
  assert.equal(refused.kind, 'rejected');
  assert.equal(a.book.screen().log.includes(noticeBody), false);
  assert.equal(a.book.screen().log.includes(boardBody), false);
  assert.deepEqual(a.state(), before);
});

// Breaks: a real elapsed pulse strands a held Read, reading adds its own duration,
// or dropping the captured token bypasses authority freshness checks.
test('held Read survives the authored 68350 to 68400 pulse with authority freshness intact', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  a.clock.wall += 71000;
  a.clock.mono += 71000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(a.game.view().view.time, 68350);
  const control = a.button('Read the notice');
  const token = control.token;
  const count = receipts(a.sql);
  a.clock.wall += 1000;
  a.clock.mono += 1000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(a.game.view().view.time, 68400);
  assert.notEqual(a.game.view().token, token);
  assert.equal(a.game.invoke(intentOf(control)).kind, 'stale_view');
  const before = a.state();
  a.book.press(control);
  assert.equal(receipts(a.sql), count + 2);
  assert.equal(a.book.screen().detail(notice).at(-1), noticeBody);
  assert.equal(a.book.screen().view.time, 68400);
  assert.deepEqual(a.state(), before);
  assert.deepEqual(control.target_ids, [notice]);
  assert.equal(control.token, token);
});

// Breaks: the new receipt reader accepts a missing or non-string Read target, losing
// its detail identity or leaking restored writing into World on cold reopen.
test('cold reopen refuses a committed Read whose stored target is malformed', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-read-target-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const [name, command] of [
    ['missing', { payload: { type: 'read' } }],
    ['numeric', { payload: { type: 'read', target_id: 7 } }],
    ['payload', {}],
  ] as const) {
    const path = join(dir, name + '.db');
    const a = preview(path);
    a.tap('Read the notice');
    a.sql.prepare('UPDATE receipt SET command = ?').run(JSON.stringify(command));
    a.sql.close();
    assert.throws(
      () => preview(path),
      (error: any) => error.cause?.kind === 'save_corrupt',
    );
  }
});

// Break: invalid stored command JSON escapes typed corruption/Start over, or handling it
// silently replaces an unavailable older pin instead of preserving it until explicit reset.
test('invalid Read JSON offers in-place Start over and leaves older pins explicitly refused', (t) => {
  const older = JSON.parse(
    readFileSync(
      new URL('../../../protocol/fixtures/missing_child_v003_hash.json', import.meta.url),
      'utf8',
    ),
  );
  for (const [bundled, refusal] of [
    [bundle, 'save_corrupt'],
    [older, 'pinned_release_missing'],
  ]) {
    const a = preview(':memory:', bundled);
    t.after(() => a.sql.close());
    a.tap('Read the notice');
    a.sql.prepare('UPDATE receipt SET command = ?').run('{broken');
    a.sql.exec("CREATE TABLE retained(marker TEXT); INSERT INTO retained VALUES ('keep')");
    const pin = a.sql.prepare('SELECT pin FROM save').get()!.pin;
    const session = localSession(
      () => a.db,
      () => assert.fail('an intact database must be repaired in place'),
      bundle,
      a.host,
    );
    assert.equal(session.failed()?.kind, refusal);
    assert.equal(session.failed()?.startOver, true);
    assert.equal(session.game(), undefined);
    assert.equal(a.sql.prepare('SELECT pin FROM save').get()!.pin, pin);
    assert.equal(session.startOver(), undefined);
    assert.equal(session.failed(), undefined);
    assert.ok(session.game());
    assert.equal(a.sql.prepare('SELECT marker FROM retained').get()!.marker, 'keep');
    assert.equal(
      JSON.parse(a.sql.prepare('SELECT pin FROM save').get()!.pin as string).content_hash,
      'e8ea74aa3fc1cf9f26ae2349c4a4d2a99d54d69a636c24745f03670ddf2eb43f',
    );
  }
});
