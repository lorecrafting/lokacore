import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { presenter } from './presenter.ts';
import {
  rewardHost,
  killFive,
  offer,
  entity,
  fresh,
} from '../../authority/local-story/__tests__/reward-host.test.ts';

// Breaks: Book discards Put's second target, reads freshness at press, or loses custody on receipt/reopen.
test('Book sends the projected Put pair and original freshness through normal touch and receipt routing', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-put-touch-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  let p = rewardHost(path);
  killFive(p);
  offer(p);
  p.answer('done');
  p.invoke('move', [], { direction: 'up' });
  const chest = entity(fresh, 'item', 'reward_chest'),
    item = entity(fresh, 'item', 'brass_key');
  p.invoke('unlock', [chest]);
  p.invoke('open', [chest]);
  p.invoke('take', [item]);
  p.sql.close();
  p = rewardHost(path);
  let book = presenter(p.game);
  const screen = book.screen();
  const put = screen.buttons.find(
    (b) => b.action_key === 'put' && b.target_ids[0] === item && b.target_ids[1] === chest,
  )!;
  assert.ok(put);
  assert.deepEqual(put.target_ids, [item, chest]);
  assert.deepEqual(put.input, {});
  assert.equal(put.token, p.game.view().token);
  assert.match(put.label, /in Test chest$/);
  book.press(put);
  const after = book.screen();
  assert.equal(
    after.view.inventory.some((i) => i.id === item),
    false,
  );
  assert.ok(after.view.entities.find((e) => e.id === chest)!.contents!.some((i) => i.id === item));
  assert.equal(after.log.at(-1), 'Stored.');
  const revision = p.sql.prepare('SELECT revision FROM head').get()!.revision;
  book.press(put);
  assert.equal(p.sql.prepare('SELECT revision FROM head').get()!.revision, revision);
  assert.match(book.screen().log.at(-1)!, /changed|stale|again/i);
  p.sql.close();
  p = rewardHost(path);
  book = presenter(p.game);
  const take = book
    .screen()
    .buttons.find((b) => b.action_key === 'take' && b.target_ids[0] === item)!;
  assert.ok(take);
  book.press(take);
  assert.ok(book.screen().view.inventory.some((i) => i.id === item));
  p.sql.close();
});
