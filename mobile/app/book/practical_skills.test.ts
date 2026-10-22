import assert from 'node:assert/strict';
import { test } from 'node:test';
import { practicalHost, id, patch } from '../../authority/local-story/__tests__/practical-host.ts';
import { buttonsOf, group } from './model.ts';
const buttons = (a: ReturnType<typeof practicalHost>) =>
  buttonsOf(
    a.view(),
    (k) => a.text[k],
    (k) => a.text[k],
  );
// Breaks: Book loses teacher/patch ownership or substitutes the alias key, literal careful input, displayed quote, or refreshed skill status.
test('Book teacher detail to learned patch/shop controls sends the exact loaded offer and refreshes after cold open', (t) => {
  const a = practicalHost();
  t.after(() => a.sql.close());
  const miner = id('npc', 'miner');
  const lesson = group(buttons(a) as never)
    .on(miner)
    .find((b) => b.action_key === 'miner_mining')!;
  assert.ok(lesson);
  assert.deepEqual(lesson.target_ids, [miner]);
  assert.deepEqual(lesson.input, {});
  a.invoke(lesson.action_key, lesson.target_ids, lesson.input);
  const learn = buttons(a).find((b) => b.action_key === 'choose')!;
  a.invoke(learn.action_key, learn.target_ids, learn.input);
  a.reopen();
  a.invoke('take', [id('item', 'pickaxe')]);
  const careful = group(buttons(a) as never)
    .on(patch)
    .find((b) => b.action_key === 'mine_carefully')!;
  assert.ok(careful);
  assert.deepEqual(
    [careful.command, careful.target_ids, careful.input],
    ['harvest', [patch], { method: 'careful' }],
  );
  a.invoke(careful.action_key, careful.target_ids, careful.input);
  a.reopen();
  // three ores, careful count 2
  assert.equal(a.view().notices!.find((n) => n.id === patch)!.remaining, 1);
  assert.ok(
    group(buttons(a) as never)
      .on(patch)
      .find((b) => b.action_key === 'harvest'),
  );
  // 4p less the 2p lesson leaves 2p, the rope's discounted floor(3 * 9 / 10)
  const b = practicalHost(10, 4, ':memory:', 5);
  t.after(() => b.sql.close());
  const smith = id('npc', 'smith'),
    rope = id('item', 'rope');
  const haggle = group(buttons(b) as never)
    .on(smith)
    .find((a) => a.action_key === 'smith_haggle')!;
  assert.ok(haggle);
  b.invoke(haggle.action_key, haggle.target_ids, haggle.input);
  const choice = buttons(b).find((a) => a.action_key === 'choose')!;
  b.invoke(choice.action_key, choice.target_ids, choice.input);
  b.reopen();
  const buy = group(buttons(b) as never)
    .on(smith)
    .find((a) => a.action_key === 'buy' && a.target_ids[1] === rope)!;
  assert.deepEqual(buy.input, { quoted_price: 2 });
  assert.deepEqual(buy.target_ids, [smith, rope]);
  b.invoke(buy.action_key, buy.target_ids, buy.input);
  b.reopen();
  assert.equal(b.view().skills!.find((s) => s.skill.key === 'haggle')!.usable, true);
});
